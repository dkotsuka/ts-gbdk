import { existsSync } from "node:fs";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

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

function makefileTemplate(projectName) {
  return [
    "ifndef GBDK_HOME",
    "$(error Please set GBDK_HOME to your GBDK root path)",
    "endif",
    "",
    "LCC = $(GBDK_HOME)/bin/lcc",
    `PROJECTNAME = ${projectName}`,
    "CSOURCES = $(wildcard src/*.c)",
    "",
    "all: gb",
    "",
    "gb:",
    "\t$(LCC) -o build/$(PROJECTNAME).gb $(CSOURCES)",
    "",
    "gbc:",
    "\t$(LCC) -Wm-yC -o build/$(PROJECTNAME).gbc $(CSOURCES)",
    "",
    "clean:",
    "\trm -f build/*.gb build/*.gbc build/*.ihx build/*.map build/*.sym src/*.o",
    "",
  ].join("\n");
}

function hasLccExecutable(gbdkHome) {
  return (
    existsSync(join(gbdkHome, "bin", "lcc")) ||
    existsSync(join(gbdkHome, "bin", "lcc.exe"))
  );
}

function normalizeGbdkHomeForMake(gbdkHome) {
  return String(gbdkHome || "").replace(/\\/g, "/");
}

function resolveGbdkHome() {
  const attempts = [];
  const rawCandidates = [];

  if (process.env.GBDK_HOME) {
    rawCandidates.push(process.env.GBDK_HOME);
  }

  rawCandidates.push(
    resolve(process.cwd(), "gbdk-2020"),
    resolve(process.cwd(), "..", "gbdk-2020"),
    resolve(process.cwd(), "..", "..", "gbdk-2020"),
    resolve(process.cwd(), "..", "..", "..", "gbdk-2020"),
    resolve(process.cwd(), "..", "..", "..", "..", "gbdk-2020"),
  );

  if (process.platform === "win32") {
    rawCandidates.push("C:/gbdk", "C:/tools/gbdk", "C:/gbdk-2020");
  }

  const candidates = [...new Set(rawCandidates.filter(Boolean))];
  for (const candidate of candidates) {
    attempts.push(candidate);
    if (hasLccExecutable(candidate)) {
      return {
        gbdkHome: normalizeGbdkHomeForMake(candidate),
        attempts,
      };
    }
  }

  return {
    gbdkHome: null,
    attempts,
  };
}

async function detectArtifact(buildDir, target) {
  if (!existsSync(buildDir)) {
    return null;
  }

  const extension = target === "gbc" ? ".gbc" : ".gb";
  const entries = await readdir(buildDir);
  const candidates = [];

  for (const name of entries) {
    if (!name.endsWith(extension)) {
      continue;
    }

    const fullPath = join(buildDir, name);
    const metadata = await stat(fullPath);
    candidates.push({ fullPath, mtime: metadata.mtimeMs });
  }

  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.fullPath ?? null;
}

function runMake(outDir, target) {
  return new Promise((resolveRun) => {
    const logs = [];
    const cmdCandidates =
      process.platform === "win32" ? ["make", "mingw32-make"] : ["make"];
    const gbdkResolution = resolveGbdkHome();

    if (!gbdkResolution.gbdkHome) {
      logs.push(
        "GBDK_HOME não configurado: defina a variável de ambiente apontando para a raiz do GBDK (com bin/lcc).",
      );
      logs.push("Exemplo (Windows): setx GBDK_HOME C:/caminho/para/gbdk");
      if (gbdkResolution.attempts.length > 0) {
        logs.push(`Tentativas: ${gbdkResolution.attempts.join(" | ")}`);
      }

      resolveRun({ ok: false, exitCode: 2, logs });
      return;
    }

    const makeEnv = {
      ...process.env,
      GBDK_HOME: gbdkResolution.gbdkHome,
    };
    logs.push(`GBDK_HOME=${gbdkResolution.gbdkHome}`);

    const runCandidate = (index) => {
      const command = cmdCandidates[index];
      const child = spawn(command, [target], {
        cwd: outDir,
        shell: false,
        env: makeEnv,
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
          logs.push(
            `comando '${command}' não encontrado, tentando próximo candidato...`,
          );
          runCandidate(index + 1);
          return;
        }

        logs.push(`erro ao executar '${command}': ${error.message}`);
        resolveRun({ ok: false, exitCode: 1, logs });
      });

      child.on("close", (code) => {
        resolveRun({ ok: code === 0, exitCode: code ?? 1, logs });
      });
    };

    runCandidate(0);
  });
}

async function compilePayload({ projectName, target, cSource, headerSource }) {
  const tempRoot = await mkdtemp(join(tmpdir(), "ts-gbdk-build-"));
  const outDir = join(tempRoot, "gbdk-out");
  const outSrcDir = join(outDir, "src");
  const outBuildDir = join(outDir, "build");

  try {
    await mkdir(outSrcDir, { recursive: true });
    await mkdir(outBuildDir, { recursive: true });

    await writeFile(join(outSrcDir, "main.c"), cSource, "utf8");
    await writeFile(join(outSrcDir, "main.h"), headerSource, "utf8");
    await writeFile(
      join(outDir, "Makefile"),
      makefileTemplate(projectName),
      "utf8",
    );

    const result = await runMake(outDir, target);
    const artifactPath = await detectArtifact(outBuildDir, target);
    let artifactBase64 = null;
    let artifactName = null;

    if (artifactPath) {
      const artifactBytes = await readFile(artifactPath);
      artifactBase64 = artifactBytes.toString("base64");
      artifactName =
        artifactPath.split(/[\\/]/).pop() || `${projectName}.${target}`;
    }

    return {
      ok: result.ok,
      exitCode: result.exitCode,
      logs: result.logs,
      artifactName,
      artifactBase64,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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
    const projectName =
      typeof body.projectName === "string" ? body.projectName.trim() : "";
    const target = body.target === "gbc" ? "gbc" : "gb";
    const cSource = typeof body.cSource === "string" ? body.cSource : "";
    const headerSource =
      typeof body.headerSource === "string" ? body.headerSource : "";

    if (!projectName) {
      sendJson(res, 400, { ok: false, error: "projectName is required" });
      return;
    }

    if (!cSource.trim()) {
      sendJson(res, 400, { ok: false, error: "cSource is required" });
      return;
    }

    if (!headerSource.trim()) {
      sendJson(res, 400, { ok: false, error: "headerSource is required" });
      return;
    }

    const result = await compilePayload({
      projectName,
      target,
      cSource,
      headerSource,
    });

    sendJson(res, 200, {
      ok: result.ok,
      exitCode: result.exitCode,
      logs: result.logs,
      artifactName: result.artifactName,
      artifactBase64: result.artifactBase64,
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Build failed",
    });
  }
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.warn(
      `ts-gbdk build server already running at http://${HOST}:${PORT}; skipping startup`,
    );
    process.exit(0);
  }

  console.error(
    `ts-gbdk build server failed to start at http://${HOST}:${PORT}: ${error.message}`,
  );
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`ts-gbdk build server listening at http://${HOST}:${PORT}`);
});
