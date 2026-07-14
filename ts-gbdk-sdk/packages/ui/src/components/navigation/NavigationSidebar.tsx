import { useCallback, useEffect, useMemo, useState } from "react";
import { compileToC } from "@ts-gbdk/compiler";
import {
  FiBookOpen,
  FiFile,
  FiFilePlus,
  FiFolder,
  FiFolderPlus,
  FiPlus,
  FiPlay,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { ProjectFolderTree } from "./ProjectFolderTree";
import type {
  BrowserFileSystemDirectoryHandle,
  FileNode,
  FolderNode,
} from "./NavigationTree.types";
import { SidebarSection } from "./SidebarSection";

type BrowserWindow = Window & {
  showDirectoryPicker?: () => Promise<BrowserFileSystemDirectoryHandle>;
};

type NavigationSidebarProps = {
  activeFilePath: string | null;
  onCloseProject: () => void;
  onDeleteFile: (filePath: string) => void;
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
  artifactPath?: string | null;
  error?: string;
};

function makefileTemplate(projectName: string): string {
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

async function compileProjectMain(
  rootHandle: BrowserFileSystemDirectoryHandle,
  rootPath: string,
  target: CompileTarget,
  outputBaseName: string,
  appendLog: (entry: string) => void,
): Promise<{ diagnostics: string[] }> {
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

  appendLog("[3/6] Preparando diretórios de saída...");
  const outHandle = await rootHandle.getDirectoryHandle(OUTPUT_FOLDER_NAME, {
    create: true,
  });
  const outSrcHandle = await outHandle.getDirectoryHandle("src", {
    create: true,
  });
  const outBuildHandle = await outHandle.getDirectoryHandle("build", {
    create: true,
  });

  appendLog("[4/6] Gravando arquivos C gerados...");
  await writeTextFile(outSrcHandle, "main.c", compileResult.cSource);
  await writeTextFile(outSrcHandle, "main.h", compileResult.headerSource);
  await writeTextFile(outHandle, "Makefile", makefileTemplate(outputBaseName));

  appendLog(
    `[5/6] Preparando comando de build para alvo ${target.toUpperCase()}...`,
  );
  const buildCommand = target === "gbc" ? "make gbc" : "make gb";

  await writeTextFile(outBuildHandle, "build-command.txt", `${buildCommand}\n`);

  appendLog("[6/6] Artefatos prontos em gbdk-out/.\n");

  return { diagnostics: compileResult.diagnostics };
}

async function runNativeBuild(
  projectDir: string,
  target: CompileTarget,
): Promise<NativeBuildResponse> {
  const response = await fetch(`${BUILD_API_BASE_URL}/api/build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectDir, target }),
  });

  if (!response.ok) {
    const errorPayload = (await response
      .json()
      .catch(() => ({ error: "Falha ao chamar serviço de build." }))) as {
      error?: string;
    };

    throw new Error(errorPayload.error ?? "Falha ao chamar serviço de build.");
  }

  return (await response.json()) as NativeBuildResponse;
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

export function NavigationSidebar({
  activeFilePath,
  onCloseProject,
  onDeleteFile,
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
  const [compileTarget, setCompileTarget] = useState<CompileTarget>("gb");
  const [buildBumpType, setBuildBumpType] = useState<BuildBumpType>("path");
  const [buildVersion, setBuildVersion] = useState("0.0.0");
  const [projectSystemPath, setProjectSystemPath] = useState<string | null>(
    null,
  );
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
      setProjectSystemPath(null);
    } catch (error) {
      const isUserAbortError =
        error instanceof DOMException && error.name === "AbortError";

      if (!isUserAbortError) {
        setProjectError("Não foi possível criar a pasta do projeto.");
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
      setProjectSystemPath(null);
    } catch (error) {
      const isUserAbortError =
        error instanceof DOMException && error.name === "AbortError";

      if (!isUserAbortError) {
        setProjectError("Não foi possível abrir o projeto.");
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
      setProjectSystemPath(null);
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

    let localProjectPath = projectSystemPath;
    if (!localProjectPath) {
      const suggestedPath = `${projectRoot.name}`;
      const pathInput = window.prompt(
        "Informe o caminho absoluto local do projeto para executar o Makefile:",
        suggestedPath,
      );

      if (!pathInput?.trim()) {
        setProjectError("Compilação cancelada: caminho local não informado.");
        return;
      }

      localProjectPath = pathInput.trim();
      setProjectSystemPath(localProjectPath);
    }

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
        compileTarget,
        outputBaseName,
        appendCompileLog,
      );

      appendCompileLog("[7/8] Executando Makefile local...");
      const nativeBuildResult = await runNativeBuild(
        localProjectPath,
        compileTarget,
      );

      for (const logEntry of nativeBuildResult.logs ?? []) {
        appendCompileLog(logEntry);
      }

      if (!nativeBuildResult.ok) {
        throw new Error(
          `Build nativo falhou (exit code ${nativeBuildResult.exitCode ?? 1}).`,
        );
      }

      appendCompileLog("[8/8] Build concluído pelo Makefile.");

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

      if (nativeBuildResult.artifactPath) {
        appendCompileLog(`ROM gerado: ${nativeBuildResult.artifactPath}`);
      }
    } catch (error) {
      setProjectError(
        "Não foi possível compilar. Verifique o caminho local, GBDK_HOME e o conteúdo de src/main.ts.",
      );
      if (error instanceof Error) {
        appendCompileLog(`Erro: ${error.message}`);
      }
      appendCompileLog("Falha na compilação. Confira os detalhes acima.");
    } finally {
      setIsCompilingProject(false);
    }
  };

  return (
    <aside className="app-sidebar" aria-label="Menu de navegação">
      <div className="sidebar-title">Explorer</div>

      <SidebarSection
        title="Arquivos"
        actions={
          projectRoot ? (
            <>
              <button
                type="button"
                className="nav-icon-action"
                onClick={handleOpenProject}
                disabled={isOpeningProject || isUpdatingTree}
                title="Abrir projeto"
                aria-label="Abrir projeto"
              >
                <FiFolder aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-icon-action"
                onClick={() => {
                  void handleCloseProject();
                }}
                disabled={isOpeningProject || isUpdatingTree}
                title="Fechar projeto"
                aria-label="Fechar projeto"
              >
                <FiX aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-icon-action"
                onClick={handleCreateChildFolder}
                disabled={
                  isUpdatingTree || isCompilingProject || !selectedFolder
                }
                title="Nova pasta"
                aria-label="Nova pasta"
              >
                <FiFolderPlus aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-icon-action"
                onClick={handleCreateTsFile}
                disabled={
                  isUpdatingTree || isCompilingProject || !selectedFolder
                }
                title="Novo arquivo"
                aria-label="Novo arquivo"
              >
                <FiFilePlus aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-icon-action"
                onClick={() => {
                  void handleDeleteFolder();
                }}
                disabled={
                  isUpdatingTree ||
                  isCompilingProject ||
                  !selectedFolder ||
                  isSelectedRootFolder
                }
                title={
                  isSelectedRootFolder
                    ? "A pasta raiz não pode ser deletada"
                    : "Deletar pasta"
                }
                aria-label={
                  isSelectedRootFolder
                    ? "A pasta raiz não pode ser deletada"
                    : "Deletar pasta"
                }
              >
                <FiTrash2 aria-hidden="true" />
              </button>
            </>
          ) : null
        }
      >
        {!projectRoot ? (
          <div className="nav-project-actions">
            <button
              type="button"
              className="nav-create-project"
              onClick={handleCreateProject}
              disabled={isCreatingProject || isOpeningProject}
            >
              <FiPlus aria-hidden="true" />
              <span>
                {isCreatingProject ? "Criando projeto..." : "Novo projeto"}
              </span>
            </button>

            <button
              type="button"
              className="nav-open-project"
              onClick={handleOpenProject}
              disabled={isCreatingProject || isOpeningProject}
            >
              <FiFolder aria-hidden="true" />
              <span>
                {isOpeningProject
                  ? "Abrindo projeto..."
                  : "Abrir projeto existente"}
              </span>
            </button>
          </div>
        ) : (
          <div className="nav-tree-wrapper">
            <ProjectFolderTree
              root={projectRoot}
              activeFilePath={activeFilePath}
              selectedFolderPath={selectedFolderPath}
              isUpdatingTree={isUpdatingTree}
              onSelectFolder={setSelectedFolderPath}
              onOpenFile={handleOpenTsFile}
              onDeleteFile={handleDeleteFile}
            />
          </div>
        )}

        {projectError ? (
          <div className="nav-error-text">{projectError}</div>
        ) : null}

        {projectStatus ? (
          <div className="nav-status-text">{projectStatus}</div>
        ) : null}
      </SidebarSection>

      {projectRoot ? (
        <SidebarSection title="Saída">
          <div className="nav-output-list">
            {outputRomFiles.length > 0 ? (
              outputRomFiles.map((file) => (
                <div key={file.path} className="nav-item nav-output-item">
                  <FiFile aria-hidden="true" />
                  <span>{file.name}</span>
                </div>
              ))
            ) : (
              <div className="nav-output-empty">
                Nenhum arquivo .gb/.gbc encontrado.
              </div>
            )}
          </div>

          <div className="nav-output-build-controls">
            <div className="nav-compile-controls">
              <label className="nav-compile-label" htmlFor="compile-target">
                Alvo de ROM:
              </label>
              <select
                id="compile-target"
                className="nav-compile-select"
                value={compileTarget}
                onChange={(event) => {
                  setCompileTarget(event.target.value as CompileTarget);
                }}
                disabled={isCompilingProject}
                aria-label="Selecionar alvo de ROM"
                title="Selecionar alvo de ROM"
              >
                <option value="gb">GB (.gb)</option>
                <option value="gbc">GBC (.gbc)</option>
              </select>

              <button
                type="button"
                className="nav-icon-action"
                onClick={() => {
                  void handleCompileProject();
                }}
                disabled={
                  isOpeningProject || isUpdatingTree || isCompilingProject
                }
                title="Compilar projeto"
                aria-label="Compilar projeto"
              >
                <FiPlay aria-hidden="true" />
              </button>
            </div>

            <fieldset className="nav-build-type-group">
              <legend>Tipo de build (versão)</legend>
              <label>
                <input
                  type="radio"
                  name="build-bump-type"
                  value="major"
                  checked={buildBumpType === "major"}
                  onChange={() => {
                    setBuildBumpType("major");
                  }}
                  disabled={isCompilingProject}
                />
                <span>major</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="build-bump-type"
                  value="minor"
                  checked={buildBumpType === "minor"}
                  onChange={() => {
                    setBuildBumpType("minor");
                  }}
                  disabled={isCompilingProject}
                />
                <span>minor</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="build-bump-type"
                  value="path"
                  checked={buildBumpType === "path"}
                  onChange={() => {
                    setBuildBumpType("path");
                  }}
                  disabled={isCompilingProject}
                />
                <span>path</span>
              </label>
            </fieldset>

            <div className="nav-version-preview">
              Próxima versão: v{bumpVersion(buildVersion, buildBumpType)}
            </div>
          </div>

          {compileLogs.length > 0 ? (
            <div className="nav-compile-logs" aria-live="polite">
              {compileLogs.map((logEntry, index) => (
                <div
                  key={`compile-log-${index}`}
                  className="nav-compile-log-entry"
                >
                  {logEntry}
                </div>
              ))}
            </div>
          ) : null}
        </SidebarSection>
      ) : null}

      <SidebarSection title="Documentação">
        <div className="nav-item">
          <FiBookOpen aria-hidden="true" />
          <span>Sem itens por enquanto</span>
        </div>
      </SidebarSection>
    </aside>
  );
}
