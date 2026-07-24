import { useCallback, useEffect, useMemo, useState } from "react";
import { compileToC } from "@ts-gbdk/compiler";
import type {
  BrowserFileSystemDirectoryHandle,
  FileNode,
  FolderNode,
} from "./NavigationTree.types";
import { BuildOutputSection } from "./sections/BuildOutputSection";
import { DocumentationSection } from "./sections/DocumentationSection";
import { FileNavigationSection } from "./sections/FileNavigationSection";

type BrowserWindow = Window & {
  showDirectoryPicker?: () => Promise<BrowserFileSystemDirectoryHandle>;
};

type NavigationSidebarProps = {
  activeFilePath: string | null;
  onCloseProject: () => void;
  onDeleteFile: (filePath: string) => void;
  onSelectRom: (file: FileNode) => void;
  onRunRom: (file: FileNode) => void;
  onOpenFile: (
    filePath: string,
    fileName: string,
    fileHandle: FileSystemFileHandle,
  ) => Promise<void>;
};

type CompileTarget = "gb" | "gbc";
type BuildBumpType = "major" | "minor" | "path";

const OUTPUT_FOLDER_NAME = "gbdk-out";
const BUILD_API_BASE_URL =
  import.meta.env.VITE_BUILD_API_BASE_URL ?? "http://127.0.0.1:4174";

const PERSISTENCE_DB_NAME = "ts-gbdk-ui-workspace";
const PERSISTENCE_STORE_NAME = "workspace";
const LAST_PROJECT_KEY = "last-project-handle";

type NativeBuildResponse = {
  ok: boolean;
  exitCode?: number;
  logs?: string[];
  artifactName?: string | null;
  artifactBase64?: string | null;
  error?: string;
};

async function writeTextFile(
  folderHandle: BrowserFileSystemDirectoryHandle,
  fileName: string,
  content: string,
): Promise<void> {
  const fileHandle = await folderHandle.getFileHandle(fileName, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function writeBinaryFile(
  folderHandle: BrowserFileSystemDirectoryHandle,
  fileName: string,
  buffer: ArrayBuffer,
): Promise<void> {
  const fileHandle = await folderHandle.getFileHandle(fileName, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(buffer);
  await writable.close();
}

async function compileProjectMain(
  rootHandle: BrowserFileSystemDirectoryHandle,
  rootPath: string,
  appendLog: (entry: string) => void,
): Promise<{ diagnostics: string[]; cSource: string; headerSource: string }> {
  appendLog("[1/6] Lendo src/main.ts...");
  const srcHandle = await rootHandle.getDirectoryHandle("src");
  const mainFileHandle = await srcHandle.getFileHandle("main.ts");
  const mainFile = await mainFileHandle.getFile();
  const source = await mainFile.text();

  appendLog("[2/6] Transpilando TypeScript para C...");
  const compileResult = compileToC({
    filePath: `${rootPath}/src/main.ts`,
    source,
  });

  appendLog("[3/6] Código C gerado em memória.");
  appendLog("[4/6] Enviando payload para compilação nativa...");

  return {
    diagnostics: compileResult.diagnostics,
    cSource: compileResult.cSource,
    headerSource: compileResult.headerSource,
  };
}

async function runNativeBuild(
  projectName: string,
  cSource: string,
  headerSource: string,
  target: CompileTarget,
): Promise<NativeBuildResponse> {
  const response = await fetch(`${BUILD_API_BASE_URL}/api/build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectName,
      cSource,
      headerSource,
      target,
    }),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({
      error: "Falha ao chamar serviço de build.",
    }))) as NativeBuildResponse;

    throw new Error(errorPayload.error ?? "Falha ao chamar serviço de build.");
  }

  return (await response.json()) as NativeBuildResponse;
}

function mapCompileErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      return "Não foi possível conectar ao servidor de build local (ui:server).";
    }

    return error.message;
  }

  return "Falha inesperada ao compilar.";
}

function bumpVersion(version: string, bumpType: BuildBumpType): string {
  const parts = version.split(".");
  const major = Number(parts[0] ?? 0);
  const minor = Number(parts[1] ?? 0);
  const patch = Number(parts[2] ?? 0);

  if (bumpType === "major") {
    return `${major + 1}.0.0`;
  }

  if (bumpType === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

function openPersistenceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(PERSISTENCE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(PERSISTENCE_STORE_NAME)) {
        database.createObjectStore(PERSISTENCE_STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function persistLastProjectHandle(
  handle: BrowserFileSystemDirectoryHandle,
): Promise<void> {
  const database = await openPersistenceDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      PERSISTENCE_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(PERSISTENCE_STORE_NAME);

    store.put(handle, LAST_PROJECT_KEY);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function loadLastProjectHandle(): Promise<BrowserFileSystemDirectoryHandle | null> {
  const database = await openPersistenceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      PERSISTENCE_STORE_NAME,
      "readonly",
    );
    const store = transaction.objectStore(PERSISTENCE_STORE_NAME);
    const request = store.get(LAST_PROJECT_KEY);

    request.onsuccess = () => {
      database.close();
      resolve(
        (request.result as BrowserFileSystemDirectoryHandle | undefined) ??
          null,
      );
    };

    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

async function clearLastProjectHandle(): Promise<void> {
  const database = await openPersistenceDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      PERSISTENCE_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(PERSISTENCE_STORE_NAME);

    store.delete(LAST_PROJECT_KEY);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function ensureProjectPermission(
  handle: BrowserFileSystemDirectoryHandle,
): Promise<boolean> {
  const permissionMode = { mode: "readwrite" as const };

  if (!handle.queryPermission && !handle.requestPermission) {
    return true;
  }

  if (handle.queryPermission) {
    const permissionState = await handle.queryPermission(permissionMode);

    if (permissionState === "granted") {
      return true;
    }
  }

  if (handle.requestPermission) {
    const permissionState = await handle.requestPermission(permissionMode);
    return permissionState === "granted";
  }

  return false;
}

async function createProjectScaffold(
  rootHandle: BrowserFileSystemDirectoryHandle,
): Promise<void> {
  const srcHandle = await rootHandle.getDirectoryHandle("src", {
    create: true,
  });
  await rootHandle.getDirectoryHandle("assets", { create: true });

  const gbdkOutHandle = await rootHandle.getDirectoryHandle("gbdk-out", {
    create: true,
  });

  await gbdkOutHandle.getDirectoryHandle("src", { create: true });
  await gbdkOutHandle.getDirectoryHandle("build", { create: true });

  try {
    await srcHandle.getFileHandle("main.ts");
  } catch {
    const mainFileHandle = await srcHandle.getFileHandle("main.ts", {
      create: true,
    });
    const writable = await mainFileHandle.createWritable();
    await writable.write(
      [
        "// main.ts - projeto gerado pelo ts-gbdk-sdk UI",
        "// Hello World mínimo compilável para começar.",
        "",
        "declare function vsync(): void;",
        "",
        "function helloWorld(): void {}",
        "",
        "function updateFrame(): void {",
        "  helloWorld();",
        "  vsync();",
        "}",
        "",
      ].join("\n"),
    );
    await writable.close();
  }
}

async function saveBuildArtifactsToProject(
  rootHandle: BrowserFileSystemDirectoryHandle,
  outputBaseName: string,
  target: CompileTarget,
  cSource: string,
  headerSource: string,
  artifactName: string,
  artifactBase64: string,
) {
  const outHandle = await rootHandle.getDirectoryHandle(OUTPUT_FOLDER_NAME, {
    create: true,
  });
  const outSrcHandle = await outHandle.getDirectoryHandle("src", {
    create: true,
  });
  const outBuildHandle = await outHandle.getDirectoryHandle("build", {
    create: true,
  });

  await writeTextFile(outSrcHandle, "main.c", cSource);
  await writeTextFile(outSrcHandle, "main.h", headerSource);

  const buildCommand = target === "gbc" ? "make gbc" : "make gb";
  await writeTextFile(outBuildHandle, "build-command.txt", `${buildCommand}\n`);

  const binaryString = window.atob(artifactBase64);
  const buffer = new ArrayBuffer(binaryString.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  await writeBinaryFile(outBuildHandle, artifactName, buffer);

  const legacyName = `${outputBaseName}.${target}`;
  if (legacyName !== artifactName) {
    await writeBinaryFile(outBuildHandle, legacyName, buffer);
  }
}

async function buildFolderTree(
  handle: BrowserFileSystemDirectoryHandle,
  parentPath = "",
  allFiles = false,
): Promise<FolderNode> {
  const path = parentPath ? `${parentPath}/${handle.name}` : handle.name;
  const folders: FolderNode[] = [];
  const files: FileNode[] = [];

  for await (const entry of handle.values()) {
    if (entry.kind === "directory") {
      const childHandle = await handle.getDirectoryHandle(entry.name);
      const folderNode = await buildFolderTree(childHandle, path, allFiles);
      folders.push(folderNode);
      continue;
    }

    if (allFiles || entry.name.endsWith(".ts")) {
      const fileHandle = await handle.getFileHandle(entry.name);
      files.push({
        path: `${path}/${entry.name}`,
        name: entry.name,
        handle: fileHandle,
      });
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return { path, name: handle.name, handle, folders, files };
}

function findFolderByPath(
  root: FolderNode | null,
  targetPath: string | null,
): FolderNode | null {
  if (!root || !targetPath) {
    return null;
  }

  if (root.path === targetPath) {
    return root;
  }

  for (const child of root.folders) {
    const found = findFolderByPath(child, targetPath);
    if (found) {
      return found;
    }
  }

  return null;
}

function findParentFolderByPath(
  root: FolderNode | null,
  targetPath: string | null,
): FolderNode | null {
  if (!root || !targetPath || root.path === targetPath) {
    return null;
  }

  for (const child of root.folders) {
    if (child.path === targetPath) {
      return root;
    }

    const foundParent = findParentFolderByPath(child, targetPath);
    if (foundParent) {
      return foundParent;
    }
  }

  return null;
}

function collectFolderFilePaths(folder: FolderNode): string[] {
  const currentFilePaths = folder.files.map((file) => file.path);
  const childFilePaths = folder.folders.flatMap((child) =>
    collectFolderFilePaths(child),
  );

  return [...currentFilePaths, ...childFilePaths];
}

function collectRomFiles(folder: FolderNode | null): FileNode[] {
  if (!folder) {
    return [];
  }

  const currentRomFiles = folder.files.filter(
    (file) => file.name.endsWith(".gb") || file.name.endsWith(".gbc"),
  );
  const childRomFiles = folder.folders.flatMap((child) =>
    collectRomFiles(child),
  );

  return [...currentRomFiles, ...childRomFiles].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function pickPreferredRomFile(
  romFiles: FileNode[],
  preferredTarget: CompileTarget,
): FileNode | null {
  const preferredExtension = preferredTarget === "gbc" ? ".gbc" : ".gb";
  const preferred = romFiles.find((file) =>
    file.name.toLowerCase().endsWith(preferredExtension),
  );

  if (preferred) {
    return preferred;
  }

  return romFiles[0] ?? null;
}

export function NavigationSidebar({
  activeFilePath,
  onCloseProject,
  onDeleteFile,
  onSelectRom,
  onRunRom,
  onOpenFile,
}: NavigationSidebarProps) {
  const [projectRoot, setProjectRoot] = useState<FolderNode | null>(null);
  const [outputRoot, setOutputRoot] = useState<FolderNode | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(
    null,
  );
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [isUpdatingTree, setIsUpdatingTree] = useState(false);
  const [isCompilingProject, setIsCompilingProject] = useState(false);
  const [compileTarget, setCompileTarget] = useState<CompileTarget>("gbc");
  const [buildBumpType, setBuildBumpType] = useState<BuildBumpType>("path");
  const [buildVersion, setBuildVersion] = useState("0.0.0");
  const [selectedOutputRomPath, setSelectedOutputRomPath] = useState<
    string | null
  >(null);
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);

  const appendCompileLog = useCallback((entry: string) => {
    setCompileLogs((current) => [...current, entry]);
  }, []);

  const selectedFolder = useMemo(
    () => findFolderByPath(projectRoot, selectedFolderPath),
    [projectRoot, selectedFolderPath],
  );

  const outputRomFiles = useMemo(
    () => collectRomFiles(outputRoot),
    [outputRoot],
  );

  const selectedOutputRom = useMemo(
    () =>
      outputRomFiles.find((file) => file.path === selectedOutputRomPath) ??
      null,
    [outputRomFiles, selectedOutputRomPath],
  );

  useEffect(() => {
    if (!projectRoot) {
      setBuildVersion("0.0.0");
    }
  }, [projectRoot]);

  useEffect(() => {
    if (!selectedOutputRomPath) {
      return;
    }

    const selectedStillExists = outputRomFiles.some(
      (file) => file.path === selectedOutputRomPath,
    );

    if (!selectedStillExists) {
      setSelectedOutputRomPath(null);
    }
  }, [outputRomFiles, selectedOutputRomPath]);

  useEffect(() => {
    if (selectedOutputRomPath) {
      return;
    }

    const preferredRom = pickPreferredRomFile(outputRomFiles, compileTarget);

    if (!preferredRom) {
      return;
    }

    setSelectedOutputRomPath(preferredRom.path);
    onSelectRom(preferredRom);
  }, [compileTarget, onSelectRom, outputRomFiles, selectedOutputRomPath]);

  const isSelectedRootFolder = useMemo(() => {
    if (!projectRoot || !selectedFolder) {
      return false;
    }

    return selectedFolder.path === projectRoot.path;
  }, [projectRoot, selectedFolder]);

  const refreshProjectTree = useCallback(
    async (
      rootHandle: BrowserFileSystemDirectoryHandle,
      keepSelectedPath = true,
    ) => {
      const fullTree = await buildFolderTree(rootHandle);

      const sourceTree: FolderNode = {
        ...fullTree,
        folders: fullTree.folders.filter((f) => f.name !== OUTPUT_FOLDER_NAME),
      };
      setProjectRoot(sourceTree);

      try {
        const outHandle =
          await rootHandle.getDirectoryHandle(OUTPUT_FOLDER_NAME);
        const outTree = await buildFolderTree(outHandle, fullTree.path, true);
        setOutputRoot(outTree);
      } catch {
        setOutputRoot(null);
      }

      setSelectedFolderPath((currentSelectedFolderPath) => {
        if (!keepSelectedPath || !currentSelectedFolderPath) {
          return sourceTree.path;
        }

        const selectedStillExists = Boolean(
          findFolderByPath(sourceTree, currentSelectedFolderPath),
        );

        return selectedStillExists
          ? currentSelectedFolderPath
          : sourceTree.path;
      });
    },
    [],
  );

  useEffect(() => {
    let isCancelled = false;

    const restoreLastProject = async () => {
      try {
        setProjectError(null);
        setIsOpeningProject(true);

        const lastProjectHandle = await loadLastProjectHandle();

        if (!lastProjectHandle || isCancelled) {
          return;
        }

        const hasPermission = await ensureProjectPermission(lastProjectHandle);

        if (!hasPermission || isCancelled) {
          return;
        }

        await refreshProjectTree(lastProjectHandle, false);
      } catch {
        await clearLastProjectHandle();

        if (!isCancelled) {
          setProjectError(
            "Não foi possível restaurar o último projeto aberto.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsOpeningProject(false);
        }
      }
    };

    void restoreLastProject();

    return () => {
      isCancelled = true;
    };
  }, [refreshProjectTree]);

  const handleCreateProject = async () => {
    const browserWindow = window as BrowserWindow;

    if (!browserWindow.showDirectoryPicker) {
      setProjectError("Seu navegador não suporta criação de pasta local.");
      setProjectStatus(null);
      return;
    }

    const projectNameInput = window.prompt(
      "Nome da pasta do projeto:",
      "novo-projeto",
    );
    const projectName = projectNameInput?.trim();

    if (!projectName) {
      return;
    }

    try {
      setProjectError(null);
      setProjectStatus(null);
      setIsCreatingProject(true);

      const parentDirectoryHandle = await browserWindow.showDirectoryPicker();
      const projectDirectoryHandle =
        await parentDirectoryHandle.getDirectoryHandle(projectName, {
          create: true,
        });

      await createProjectScaffold(projectDirectoryHandle);
      await persistLastProjectHandle(projectDirectoryHandle);
      await refreshProjectTree(projectDirectoryHandle, false);
    } catch (error) {
      const isUserAbortError =
        error instanceof DOMException && error.name === "AbortError";

      if (!isUserAbortError) {
        setProjectError(
          error instanceof Error
            ? error.message
            : "Não foi possível criar a pasta do projeto.",
        );
      }
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleOpenProject = async () => {
    const browserWindow = window as BrowserWindow;

    if (!browserWindow.showDirectoryPicker) {
      setProjectError("Seu navegador não suporta abertura de pasta local.");
      setProjectStatus(null);
      return;
    }

    try {
      setProjectError(null);
      setProjectStatus(null);
      setIsOpeningProject(true);

      const projectDirectoryHandle = await browserWindow.showDirectoryPicker();
      await persistLastProjectHandle(projectDirectoryHandle);
      await refreshProjectTree(projectDirectoryHandle, false);
    } catch (error) {
      const isUserAbortError =
        error instanceof DOMException && error.name === "AbortError";

      if (!isUserAbortError) {
        setProjectError(
          error instanceof Error
            ? error.message
            : "Não foi possível abrir o projeto.",
        );
      }
    } finally {
      setIsOpeningProject(false);
    }
  };

  const handleCloseProject = async () => {
    try {
      setProjectError(null);
      setProjectStatus(null);
      setIsOpeningProject(true);
      await clearLastProjectHandle();
      setProjectRoot(null);
      setOutputRoot(null);
      setSelectedFolderPath(null);
      setSelectedOutputRomPath(null);
      setBuildVersion("0.0.0");
      onCloseProject();
    } catch {
      setProjectError("Não foi possível fechar o projeto atual.");
    } finally {
      setIsOpeningProject(false);
    }
  };

  const handleCreateChildFolder = async () => {
    if (!selectedFolder) {
      return;
    }

    const folderNameInput = window.prompt("Nome da nova pasta:", "nova-pasta");
    const folderName = folderNameInput?.trim();

    if (!folderName) {
      return;
    }

    try {
      setProjectError(null);
      setProjectStatus(null);
      setIsUpdatingTree(true);
      await selectedFolder.handle.getDirectoryHandle(folderName, {
        create: true,
      });
      const rootHandle = projectRoot?.handle;
      if (rootHandle) {
        await refreshProjectTree(rootHandle);
      }
    } catch {
      setProjectError("Não foi possível criar a pasta filha.");
    } finally {
      setIsUpdatingTree(false);
    }
  };

  const handleCreateTsFile = async () => {
    if (!selectedFolder) {
      return;
    }

    const fileNameInput = window.prompt(
      "Nome do arquivo .ts:",
      "novo-arquivo.ts",
    );
    const fileNameRaw = fileNameInput?.trim();

    if (!fileNameRaw) {
      return;
    }

    const fileName = fileNameRaw.endsWith(".ts")
      ? fileNameRaw
      : `${fileNameRaw}.ts`;

    try {
      setProjectError(null);
      setProjectStatus(null);
      setIsUpdatingTree(true);
      await selectedFolder.handle.getFileHandle(fileName, { create: true });
      const rootHandle = projectRoot?.handle;
      if (rootHandle) {
        await refreshProjectTree(rootHandle);
      }
    } catch {
      setProjectError("Não foi possível criar o arquivo .ts.");
    } finally {
      setIsUpdatingTree(false);
    }
  };

  const handleOpenTsFile = async (file: FileNode) => {
    try {
      setProjectError(null);
      setProjectStatus(null);
      await onOpenFile(file.path, file.name, file.handle);
    } catch {
      setProjectError("Não foi possível abrir o arquivo selecionado.");
    }
  };

  const handleDeleteFile = async (file: FileNode, parentFolder: FolderNode) => {
    const confirmed = window.confirm(
      `Deletar "${file.name}"? Esta ação não pode ser desfeita.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setProjectError(null);
      setProjectStatus(null);
      setIsUpdatingTree(true);
      await parentFolder.handle.removeEntry(file.name);
      onDeleteFile(file.path);
      const rootHandle = projectRoot?.handle;
      if (rootHandle) {
        await refreshProjectTree(rootHandle);
      }
    } catch {
      setProjectError("Não foi possível deletar o arquivo.");
    } finally {
      setIsUpdatingTree(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!projectRoot || !selectedFolder || isSelectedRootFolder) {
      return;
    }

    const parentFolder = findParentFolderByPath(
      projectRoot,
      selectedFolder.path,
    );

    if (!parentFolder) {
      setProjectError("Não foi possível localizar a pasta pai para deletar.");
      setProjectStatus(null);
      return;
    }

    const hasChildren =
      selectedFolder.files.length > 0 || selectedFolder.folders.length > 0;

    if (hasChildren) {
      const confirmed = window.confirm(
        `A pasta "${selectedFolder.name}" contém arquivos ou subpastas. Deseja deletar mesmo assim?`,
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setProjectError(null);
      setProjectStatus(null);
      setIsUpdatingTree(true);

      await parentFolder.handle.removeEntry(selectedFolder.name, {
        recursive: hasChildren,
      });

      for (const filePath of collectFolderFilePaths(selectedFolder)) {
        onDeleteFile(filePath);
      }

      const rootHandle = projectRoot.handle;
      await refreshProjectTree(rootHandle);
    } catch {
      setProjectError("Não foi possível deletar a pasta selecionada.");
    } finally {
      setIsUpdatingTree(false);
    }
  };

  const handleCompileProject = async () => {
    if (!projectRoot) {
      return;
    }

    const nextVersion = bumpVersion(buildVersion, buildBumpType);
    const outputBaseName = `${projectRoot.name}-v${nextVersion}`;

    try {
      setProjectError(null);
      setProjectStatus(null);
      setCompileLogs([]);
      setIsCompilingProject(true);

      appendCompileLog(
        `Iniciando compilação do projeto '${projectRoot.name}' para ${compileTarget.toUpperCase()} (${buildBumpType} -> v${nextVersion})...`,
      );

      const compileResult = await compileProjectMain(
        projectRoot.handle,
        projectRoot.path,
        appendCompileLog,
      );

      appendCompileLog("[5/8] Executando compilação nativa no servidor...");
      const nativeBuildResult = await runNativeBuild(
        outputBaseName,
        compileResult.cSource,
        compileResult.headerSource,
        compileTarget,
      );

      for (const logEntry of nativeBuildResult.logs ?? []) {
        appendCompileLog(logEntry);
      }

      if (!nativeBuildResult.ok) {
        const hasGbdkHomeIssue = (nativeBuildResult.logs ?? []).some((log) =>
          log.toLowerCase().includes("gbdk_home"),
        );

        if (hasGbdkHomeIssue) {
          throw new Error(
            "GBDK_HOME não está configurado corretamente. Defina o caminho da instalação do GBDK (pasta que contém bin/lcc).",
          );
        }

        throw new Error(
          `Build nativo falhou (exit code ${nativeBuildResult.exitCode ?? 1}).`,
        );
      }

      if (
        !nativeBuildResult.artifactBase64 ||
        !nativeBuildResult.artifactName
      ) {
        throw new Error("Servidor não retornou o artefato compilado.");
      }

      appendCompileLog("[6/8] Salvando artefatos no projeto local...");
      await saveBuildArtifactsToProject(
        projectRoot.handle,
        outputBaseName,
        compileTarget,
        compileResult.cSource,
        compileResult.headerSource,
        nativeBuildResult.artifactName,
        nativeBuildResult.artifactBase64,
      );

      appendCompileLog("[7/8] Atualizando árvore de arquivos...");

      await refreshProjectTree(projectRoot.handle);
      setBuildVersion(nextVersion);

      if (compileResult.diagnostics.length > 0) {
        for (const diagnostic of compileResult.diagnostics) {
          appendCompileLog(`Aviso: ${diagnostic}`);
        }
        setProjectStatus(
          `Compilação concluída com ${compileResult.diagnostics.length} aviso(s).`,
        );
      } else {
        setProjectStatus(
          `Compilação concluída com sucesso. Artefato: ${outputBaseName}.${compileTarget}`,
        );
      }

      appendCompileLog(
        `[8/8] ROM salva: gbdk-out/build/${nativeBuildResult.artifactName}`,
      );
    } catch (error) {
      setProjectError(mapCompileErrorMessage(error));
      if (error instanceof Error) {
        appendCompileLog(`Erro: ${error.message}`);
      }
      appendCompileLog("Falha na compilação. Confira os detalhes acima.");
    } finally {
      setIsCompilingProject(false);
    }
  };

  const handleRunSelectedRom = () => {
    if (!selectedOutputRom) {
      return;
    }

    onRunRom(selectedOutputRom);
  };

  const handleChangeCompileTarget = (target: CompileTarget) => {
    setCompileTarget(target);

    const preferredRom = pickPreferredRomFile(outputRomFiles, target);

    if (!preferredRom) {
      return;
    }

    setSelectedOutputRomPath(preferredRom.path);
    onSelectRom(preferredRom);
  };

  return (
    <aside className="app-sidebar" aria-label="Menu de navegação">
      <div className="sidebar-title">Explorer</div>
      <FileNavigationSection
        projectRoot={projectRoot}
        activeFilePath={activeFilePath}
        selectedFolderPath={selectedFolderPath}
        selectedFolder={selectedFolder}
        isSelectedRootFolder={isSelectedRootFolder}
        isCreatingProject={isCreatingProject}
        isOpeningProject={isOpeningProject}
        isUpdatingTree={isUpdatingTree}
        isCompilingProject={isCompilingProject}
        projectError={projectError}
        projectStatus={projectStatus}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onCloseProject={() => {
          void handleCloseProject();
        }}
        onCreateChildFolder={handleCreateChildFolder}
        onCreateTsFile={handleCreateTsFile}
        onDeleteFolder={() => {
          void handleDeleteFolder();
        }}
        onSelectFolder={setSelectedFolderPath}
        onOpenFile={handleOpenTsFile}
        onDeleteFile={handleDeleteFile}
      />

      {projectRoot ? (
        <BuildOutputSection
          projectName={projectRoot.name}
          outputRomFiles={outputRomFiles}
          selectedOutputRomPath={selectedOutputRomPath}
          onDetectLatestVersion={setBuildVersion}
          onSelectOutputRom={(file) => {
            setSelectedOutputRomPath(file.path);
            onSelectRom(file);
          }}
          onRunSelectedRom={handleRunSelectedRom}
          isOpeningProject={isOpeningProject}
          isUpdatingTree={isUpdatingTree}
          isCompilingProject={isCompilingProject}
          compileTarget={compileTarget}
          onChangeCompileTarget={handleChangeCompileTarget}
          buildBumpType={buildBumpType}
          onChangeBuildBumpType={setBuildBumpType}
          nextVersionPreview={bumpVersion(buildVersion, buildBumpType)}
          compileLogs={compileLogs}
          onCompileProject={() => {
            void handleCompileProject();
          }}
        />
      ) : null}

      <DocumentationSection />
    </aside>
  );
}
