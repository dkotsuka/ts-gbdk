import type { ReactNode } from "react";
import { FiChevronDown } from "react-icons/fi";

type SidebarSectionProps = {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
};

export function SidebarSection({
  title,
  actions,
  children,
}: SidebarSectionProps) {
  return (
    <details className="nav-section" open>
      <summary className="nav-section-summary">
        <span className="nav-section-title-wrap">
          <FiChevronDown className="nav-chevron" aria-hidden="true" />
          <span>{title}</span>
        </span>
        {actions ? (
          <span
            className="nav-section-actions"
            onClick={(event) => event.stopPropagation()}
          >
            {actions}
          </span>
        ) : null}
      </summary>
      <div className="nav-section-content">{children}</div>
    </details>
  );
}
