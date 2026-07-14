import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiFilePlus,
  FiFolder,
  FiFolderPlus,
  FiPlus,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { OutputFolderTree } from "./OutputFolderTree";
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

const OUTPUT_FOLDER_NAME = "gbdk-out";

const PERSISTENCE_DB_NAME = "ts-gbdk-ui-workspace";
const PERSISTENCE_STORE_NAME = "workspace";
const LAST_PROJECT_KEY = "last-project-handle";

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
  await rootHandle.getDirectoryHandle("src", { create: true });
  await rootHandle.getDirectoryHandle("assets", { create: true });

  const gbdkOutHandle = await rootHandle.getDirectoryHandle("gbdk-out", {
    create: true,
  });

  await gbdkOutHandle.getDirectoryHandle("src", { create: true });
  await gbdkOutHandle.getDirectoryHandle("build", { create: true });
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
  const [projectError, setProjectError] = useState<string | null>(null);

  const selectedFolder = useMemo(
    () => findFolderByPath(projectRoot, selectedFolderPath),
    [projectRoot, selectedFolderPath],
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
      return;
    }

    try {
      setProjectError(null);
      setIsOpeningProject(true);

      const projectDirectoryHandle = await browserWindow.showDirectoryPicker();
      await persistLastProjectHandle(projectDirectoryHandle);
      await refreshProjectTree(projectDirectoryHandle, false);
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
      setIsOpeningProject(true);
      await clearLastProjectHandle();
      setProjectRoot(null);
      setOutputRoot(null);
      setSelectedFolderPath(null);
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
                disabled={isUpdatingTree || !selectedFolder}
                title="Nova pasta"
                aria-label="Nova pasta"
              >
                <FiFolderPlus aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-icon-action"
                onClick={handleCreateTsFile}
                disabled={isUpdatingTree || !selectedFolder}
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
                  isUpdatingTree || !selectedFolder || isSelectedRootFolder
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
      </SidebarSection>

      {outputRoot ? (
        <SidebarSection title="Saída">
          <div className="nav-tree-wrapper">
            <OutputFolderTree root={outputRoot} />
          </div>
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
