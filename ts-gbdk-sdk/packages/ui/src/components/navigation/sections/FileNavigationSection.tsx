import {
  FiFilePlus,
  FiFolder,
  FiFolderPlus,
  FiPlus,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { IconActionButton } from "../IconActionButton";
import { ProjectFolderTree } from "../ProjectFolderTree";
import { SidebarSection } from "../SidebarSection";
import type { FileNode, FolderNode } from "../NavigationTree.types";

type FileNavigationSectionProps = {
  projectRoot: FolderNode | null;
  activeFilePath: string | null;
  selectedFolderPath: string | null;
  selectedFolder: FolderNode | null;
  isSelectedRootFolder: boolean;
  isCreatingProject: boolean;
  isOpeningProject: boolean;
  isUpdatingTree: boolean;
  isCompilingProject: boolean;
  projectError: string | null;
  projectStatus: string | null;
  onCreateProject: () => void;
  onOpenProject: () => void;
  onCloseProject: () => void;
  onCreateChildFolder: () => void;
  onCreateTsFile: () => void;
  onDeleteFolder: () => void;
  onSelectFolder: (folderPath: string) => void;
  onOpenFile: (file: FileNode) => Promise<void>;
  onDeleteFile: (file: FileNode, parentFolder: FolderNode) => Promise<void>;
};

export function FileNavigationSection({
  projectRoot,
  activeFilePath,
  selectedFolderPath,
  selectedFolder,
  isSelectedRootFolder,
  isCreatingProject,
  isOpeningProject,
  isUpdatingTree,
  isCompilingProject,
  projectError,
  projectStatus,
  onCreateProject,
  onOpenProject,
  onCloseProject,
  onCreateChildFolder,
  onCreateTsFile,
  onDeleteFolder,
  onSelectFolder,
  onOpenFile,
  onDeleteFile,
}: FileNavigationSectionProps): JSX.Element {
  return (
    <SidebarSection
      title="Arquivos"
      actions={
        projectRoot ? (
          <>
            <IconActionButton
              title="Abrir projeto"
              disabled={isOpeningProject || isUpdatingTree}
              onClick={onOpenProject}
            >
              <FiFolder aria-hidden="true" />
            </IconActionButton>
            <IconActionButton
              title="Fechar projeto"
              disabled={isOpeningProject || isUpdatingTree}
              onClick={onCloseProject}
            >
              <FiX aria-hidden="true" />
            </IconActionButton>
            <IconActionButton
              title="Nova pasta"
              disabled={isUpdatingTree || isCompilingProject || !selectedFolder}
              onClick={onCreateChildFolder}
            >
              <FiFolderPlus aria-hidden="true" />
            </IconActionButton>
            <IconActionButton
              title="Novo arquivo"
              disabled={isUpdatingTree || isCompilingProject || !selectedFolder}
              onClick={onCreateTsFile}
            >
              <FiFilePlus aria-hidden="true" />
            </IconActionButton>
            <IconActionButton
              title={
                isSelectedRootFolder
                  ? "A pasta raiz não pode ser deletada"
                  : "Deletar pasta"
              }
              ariaLabel={
                isSelectedRootFolder
                  ? "A pasta raiz não pode ser deletada"
                  : "Deletar pasta"
              }
              disabled={
                isUpdatingTree ||
                isCompilingProject ||
                !selectedFolder ||
                isSelectedRootFolder
              }
              onClick={onDeleteFolder}
            >
              <FiTrash2 aria-hidden="true" />
            </IconActionButton>
          </>
        ) : null
      }
    >
      {!projectRoot ? (
        <div className="nav-project-actions">
          <button
            type="button"
            className="nav-create-project"
            onClick={onCreateProject}
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
            onClick={onOpenProject}
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
            onSelectFolder={onSelectFolder}
            onOpenFile={onOpenFile}
            onDeleteFile={onDeleteFile}
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
  );
}
