import type { Theme } from "../../types/theme";
import { ThemeToggle } from "../theme/ThemeToggle";

type AppHeaderProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

export function AppHeader({ theme, onToggleTheme }: AppHeaderProps) {
  return (
    <header className="app-header">
      <strong className="app-title">ts-gbdk SDK</strong>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}
