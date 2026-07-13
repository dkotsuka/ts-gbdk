import { FiMoon, FiSun } from "react-icons/fi";
import type { Theme } from "../../types/theme";

type ThemeToggleProps = {
  theme: Theme;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label="Alternar tema"
      aria-pressed={theme === "dark"}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
      <span className="theme-toggle-icon" aria-hidden="true">
        {theme === "dark" ? <FiMoon /> : <FiSun />}
      </span>
    </button>
  );
}
