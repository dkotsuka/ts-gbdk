import { FiBookOpen } from "react-icons/fi";
import { SidebarSection } from "../SidebarSection";

export function DocumentationSection(): JSX.Element {
  return (
    <SidebarSection title="Documentação">
      <div className="nav-item">
        <FiBookOpen aria-hidden="true" />
        <span>Sem itens por enquanto</span>
      </div>
    </SidebarSection>
  );
}
