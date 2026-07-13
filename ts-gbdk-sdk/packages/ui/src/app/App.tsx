import { AppHeader } from "../components/layout/AppHeader";
import { NavigationSidebar } from "../components/navigation/NavigationSidebar";
import { useTheme } from "../hooks/useTheme";

function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="app app-shell">
      <NavigationSidebar />
      <section className="app-main">
        <AppHeader theme={theme} onToggleTheme={toggleTheme} />
        <div className="workspace-placeholder" />
      </section>
    </main>
  );
}

export default App;
