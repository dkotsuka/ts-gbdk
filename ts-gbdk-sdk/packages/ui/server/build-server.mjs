import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const HOST = process.env.BUILD_SERVER_HOST || "127.0.0.1";
const PORT = Number(process.env.BUILD_SERVER_PORT || "4174");

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        rejectBody(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new Error("Invalid JSON body"));
      }
    });
    req.on("error", rejectBody);
  });
}

function detectArtifact(buildDir, target) {
  if (!existsSync(buildDir)) {
    return null;
  }

  const extension = target === "gbc" ? ".gbc" : ".gb";
  const candidates = readdirSync(buildDir)
    .filter((name) => name.endsWith(extension))
    .map((name) => ({
      name,
      fullPath: join(buildDir, name),
      mtime: statSync(join(buildDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return candidates[0]?.fullPath ?? null;
}

function runMake(outDir, target) {
  return new Promise((resolveRun) => {
    const logs = [];
    const cmdCandidates =
      process.platform === "win32" ? ["make", "mingw32-make"] : ["make"];

    const runCandidate = (index) => {
      const command = cmdCandidates[index];
      const child = spawn(command, [target], {
        cwd: outDir,
        shell: process.platform === "win32",
        env: process.env,
      });

      logs.push(`$ ${command} ${target}`);

      child.stdout.on("data", (chunk) => {
        logs.push(String(chunk).trimEnd());
      });

      child.stderr.on("data", (chunk) => {
        logs.push(String(chunk).trimEnd());
      });

      child.on("error", (error) => {
        const isNotFound = error && error.code === "ENOENT";
        if (isNotFound && index < cmdCandidates.length - 1) {
          runCandidate(index + 1);
          return;
        }

        resolveRun({ ok: false, exitCode: 1, logs });
      });

      child.on("close", (code) => {
        resolveRun({ ok: code === 0, exitCode: code ?? 1, logs });
      });
    };

    runCandidate(0);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/build") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  try {
    const body = await readBody(req);
    const projectDir =
      typeof body.projectDir === "string" ? body.projectDir : "";
    const target = body.target === "gbc" ? "gbc" : "gb";

    if (!projectDir) {
      sendJson(res, 400, { ok: false, error: "projectDir is required" });
      return;
    }

    const absoluteProjectDir = resolve(projectDir);
    const outDir = join(absoluteProjectDir, "gbdk-out");
    const makefilePath = join(outDir, "Makefile");

    if (!existsSync(makefilePath)) {
      sendJson(res, 400, {
        ok: false,
        error: "Makefile not found in gbdk-out",
      });
      return;
    }

    const result = await runMake(outDir, target);
    const artifactPath = detectArtifact(join(outDir, "build"), target);

    sendJson(res, 200, {
      ok: result.ok,
      exitCode: result.exitCode,
      logs: result.logs,
      artifactPath,
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Build failed",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ts-gbdk build server listening at http://${HOST}:${PORT}`);
});
