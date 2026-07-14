import type { ReactNode } from "react";

type IconActionButtonProps = {
  title: string;
  ariaLabel?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

export function IconActionButton({
  title,
  ariaLabel,
  disabled,
  onClick,
  children,
}: IconActionButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className="nav-icon-action"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
    >
      {children}
    </button>
  );
}
