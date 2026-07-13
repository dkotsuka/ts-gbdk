import { useCallback, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiFile,
  FiFilePlus,
  FiFolder,
  FiFolderPlus,
  FiPlus,
} from "react-icons/fi";
import { SidebarSection } from "./SidebarSection";

type BrowserFileSystemEntry = {
  kind: "directory" | "file";
  name: string;
};

type BrowserFileSystemDirectoryHandle = {
  name: string;
  values: () => AsyncIterable<BrowserFileSystemEntry>;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<BrowserFileSystemDirectoryHandle>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemFileHandle>;
};

type BrowserWindow = Window & {
  showDirectoryPicker?: () => Promise<BrowserFileSystemDirectoryHandle>;
};

type FolderNode = {
  path: string;
  name: string;
  handle: BrowserFileSystemDirectoryHandle;
  folders: FolderNode[];
  files: FileNode[];
};

type FileNode = {
  path: string;
  name: string;
  handle: FileSystemFileHandle;
};

type NavigationSidebarProps = {
  activeFilePath: string | null;
  onOpenFile: (
    filePath: string,
    fileName: string,
    fileHandle: FileSystemFileHandle,
  ) => Promise<void>;
};

async function buildFolderTree(
  handle: BrowserFileSystemDirectoryHandle,
  parentPath = "",
): Promise<FolderNode> {
  const path = parentPath ? `${parentPath}/${handle.name}` : handle.name;
  const folders: FolderNode[] = [];
  const files: FileNode[] = [];

  for await (const entry of handle.values()) {
    if (entry.kind === "directory") {
      const childHandle = await handle.getDirectoryHandle(entry.name);
      const folderNode = await buildFolderTree(childHandle, path);
      folders.push(folderNode);
      continue;
    }

    if (entry.name.endsWith(".ts")) {
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

export function NavigationSidebar({
  activeFilePath,
  onOpenFile,
}: NavigationSidebarProps) {
  const [projectRoot, setProjectRoot] = useState<FolderNode | null>(null);
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

  const refreshProjectTree = useCallback(
    async (
      rootHandle: BrowserFileSystemDirectoryHandle,
      keepSelectedPath = true,
    ) => {
      const tree = await buildFolderTree(rootHandle);
      setProjectRoot(tree);

      if (!keepSelectedPath || !selectedFolderPath) {
        setSelectedFolderPath(tree.path);
        return;
      }

      const selectedStillExists = Boolean(
        findFolderByPath(tree, selectedFolderPath),
      );
      setSelectedFolderPath(
        selectedStillExists ? selectedFolderPath : tree.path,
      );
    },
    [selectedFolderPath],
  );

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

  const renderFolderNode = (folder: FolderNode, depth = 0): JSX.Element => {
    const isSelected = selectedFolderPath === folder.path;

    return (
      <div key={folder.path} className="nav-tree-node">
        <button
          type="button"
          className={`nav-folder-button${isSelected ? " is-selected" : ""}`}
          onClick={() => setSelectedFolderPath(folder.path)}
          style={{ paddingLeft: `${1.2 + depth * 0.9}rem` }}
        >
          <FiFolder aria-hidden="true" />
          <span>{folder.name}</span>
        </button>

        {folder.folders.map((childFolder) =>
          renderFolderNode(childFolder, depth + 1),
        )}

        {folder.files.map((file) => (
          <button
            key={file.path}
            type="button"
            className={`nav-file-item${activeFilePath === file.path ? " is-active" : ""}`}
            style={{ paddingLeft: `${2.25 + depth * 0.9}rem` }}
            onClick={() => {
              void handleOpenTsFile(file);
            }}
          >
            <FiFile aria-hidden="true" />
            <span>{file.name}</span>
          </button>
        ))}
      </div>
    );
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
            {renderFolderNode(projectRoot)}
          </div>
        )}

        {projectError ? (
          <div className="nav-error-text">{projectError}</div>
        ) : null}
      </SidebarSection>

      <SidebarSection title="Documentação">
        <div className="nav-item">
          <FiBookOpen aria-hidden="true" />
          <span>Sem itens por enquanto</span>
        </div>
      </SidebarSection>
    </aside>
  );
}
