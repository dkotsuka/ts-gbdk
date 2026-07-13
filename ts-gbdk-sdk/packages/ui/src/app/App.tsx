import { AppHeader } from "../components/layout/AppHeader";
import { useTheme } from "../hooks/useTheme";

function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="app">
      <AppHeader theme={theme} onToggleTheme={toggleTheme} />
    </main>
  );
}

export default App;
