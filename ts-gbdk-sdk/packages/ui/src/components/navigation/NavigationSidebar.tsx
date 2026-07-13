import { useState } from "react";
import { FiBookOpen, FiFolder, FiPlus } from "react-icons/fi";
import { SidebarSection } from "./SidebarSection";

export function NavigationSidebar() {
  const [projectFolderName, setProjectFolderName] = useState<string | null>(
    null,
  );
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const handleCreateProject = async () => {
    const browserWindow = window as Window & {
      showDirectoryPicker?: () => Promise<any>;
    };

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
      setIsCreatingProject(true);
      setProjectError(null);

      const parentDirectoryHandle = await browserWindow.showDirectoryPicker();
      const projectDirectoryHandle =
        await parentDirectoryHandle.getDirectoryHandle(projectName, {
          create: true,
        });

      setProjectFolderName(projectDirectoryHandle.name);
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

  return (
    <aside className="app-sidebar" aria-label="Menu de navegação">
      <div className="sidebar-title">Explorer</div>

      <SidebarSection title="Arquivos">
        {!projectFolderName ? (
          <button
            type="button"
            className="nav-create-project"
            onClick={handleCreateProject}
            disabled={isCreatingProject}
          >
            <FiPlus aria-hidden="true" />
            <span>
              {isCreatingProject ? "Criando projeto..." : "+ Criar Projeto"}
            </span>
          </button>
        ) : (
          <div className="nav-item">
            <FiFolder aria-hidden="true" />
            <span>{projectFolderName}</span>
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
