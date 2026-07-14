import { FiFile, FiFolder, FiTrash2 } from "react-icons/fi";
import type { FileNode, FolderNode } from "./NavigationTree.types";

type ProjectFolderTreeProps = {
  root: FolderNode;
  activeFilePath: string | null;
  selectedFolderPath: string | null;
  isUpdatingTree: boolean;
  onSelectFolder: (folderPath: string) => void;
  onOpenFile: (file: FileNode) => Promise<void>;
  onDeleteFile: (file: FileNode, parentFolder: FolderNode) => Promise<void>;
};

function FolderNodeView({
  folder,
  depth,
  activeFilePath,
  selectedFolderPath,
  isUpdatingTree,
  onSelectFolder,
  onOpenFile,
  onDeleteFile,
}: {
  folder: FolderNode;
  depth: number;
  activeFilePath: string | null;
  selectedFolderPath: string | null;
  isUpdatingTree: boolean;
  onSelectFolder: (folderPath: string) => void;
  onOpenFile: (file: FileNode) => Promise<void>;
  onDeleteFile: (file: FileNode, parentFolder: FolderNode) => Promise<void>;
}): JSX.Element {
  const isSelected = selectedFolderPath === folder.path;

  return (
    <div key={folder.path} className="nav-tree-node">
      <button
        type="button"
        className={`nav-folder-button${isSelected ? " is-selected" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFolder(folder.path);
        }}
        style={{ paddingLeft: `${1.2 + depth * 0.9}rem` }}
      >
        <FiFolder aria-hidden="true" />
        <span>{folder.name}</span>
      </button>

      <div className="nav-tree-children">
        {folder.folders.map((childFolder) => (
          <FolderNodeView
            key={childFolder.path}
            folder={childFolder}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            selectedFolderPath={selectedFolderPath}
            isUpdatingTree={isUpdatingTree}
            onSelectFolder={onSelectFolder}
            onOpenFile={onOpenFile}
            onDeleteFile={onDeleteFile}
          />
        ))}

        {folder.files.map((file) => (
          <div key={file.path} className="nav-file-row">
            <button
              type="button"
              className={`nav-file-item${activeFilePath === file.path ? " is-active" : ""}`}
              style={{ paddingLeft: `${2.25 + depth * 0.9}rem` }}
              onClick={(event) => {
                event.stopPropagation();
                void onOpenFile(file);
              }}
            >
              <FiFile aria-hidden="true" />
              <span>{file.name}</span>
            </button>
            <button
              type="button"
              className="nav-file-delete"
              disabled={isUpdatingTree}
              title={`Deletar ${file.name}`}
              aria-label={`Deletar ${file.name}`}
              onClick={(event) => {
                event.stopPropagation();
                void onDeleteFile(file, folder);
              }}
            >
              <FiTrash2 aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectFolderTree({
  root,
  activeFilePath,
  selectedFolderPath,
  isUpdatingTree,
  onSelectFolder,
  onOpenFile,
  onDeleteFile,
}: ProjectFolderTreeProps): JSX.Element {
  return (
    <FolderNodeView
      folder={root}
      depth={0}
      activeFilePath={activeFilePath}
      selectedFolderPath={selectedFolderPath}
      isUpdatingTree={isUpdatingTree}
      onSelectFolder={onSelectFolder}
      onOpenFile={onOpenFile}
      onDeleteFile={onDeleteFile}
    />
  );
}
