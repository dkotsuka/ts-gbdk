import type { ReactNode } from "react";
import { FiChevronDown } from "react-icons/fi";

type SidebarSectionProps = {
  title: string;
  children?: ReactNode;
};

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <details className="nav-section" open>
      <summary className="nav-section-summary">
        <FiChevronDown className="nav-chevron" aria-hidden="true" />
        <span>{title}</span>
      </summary>
      <div className="nav-section-content">{children}</div>
    </details>
  );
}
