import { useCallback, useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import { WorkspaceEditor } from "../components/editor/WorkspaceEditor";
import { NavigationSidebar } from "../components/navigation/NavigationSidebar";
import { useTheme } from "../hooks/useTheme";

type EditorFile = {
  path: string;
  name: string;
  content: string;
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const handleOpenFile = useCallback(
    async (
      filePath: string,
      fileName: string,
      fileHandle: FileSystemFileHandle,
    ) => {
      const file = await fileHandle.getFile();
      const content = await file.text();

      setOpenFiles((currentFiles) => {
        const existingIndex = currentFiles.findIndex(
          (currentFile) => currentFile.path === filePath,
        );

        if (existingIndex === -1) {
          return [...currentFiles, { path: filePath, name: fileName, content }];
        }

        return currentFiles.map((currentFile) =>
          currentFile.path === filePath
            ? { ...currentFile, content, name: fileName }
            : currentFile,
        );
      });

      setActiveFilePath(filePath);
    },
    [],
  );

  return (
    <main className="app app-shell">
      <NavigationSidebar
        activeFilePath={activeFilePath}
        onOpenFile={handleOpenFile}
      />
      <section className="app-main">
        <AppHeader theme={theme} onToggleTheme={toggleTheme} />
        <WorkspaceEditor
          activeFilePath={activeFilePath}
          files={openFiles}
          onSelectFile={setActiveFilePath}
        />
      </section>
    </main>
  );
}

export default App;
