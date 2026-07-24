import { useCallback, useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import { WorkspaceEditor } from "../components/editor/WorkspaceEditor";
import { NavigationSidebar } from "../components/navigation/NavigationSidebar";
import { EmulatorPanel } from "../components/emulator/EmulatorPanel";
import type { RomSelection } from "../components/emulator/EmulatorPanel";
import type { EmulatorMode } from "../components/emulator/gameboyCore";
import { useTheme } from "../hooks/useTheme";
import type { FileNode } from "../components/navigation/NavigationTree.types";

type EditorFile = {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  handle: FileSystemFileHandle;
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [savingFilePath, setSavingFilePath] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedRom, setSelectedRom] = useState<RomSelection | null>(null);
  const [activeRom, setActiveRom] = useState<RomSelection | null>(null);
  const [emulatorMode, setEmulatorMode] = useState<EmulatorMode>("gbc");

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
          return [
            ...currentFiles,
            {
              path: filePath,
              name: fileName,
              content,
              savedContent: content,
              handle: fileHandle,
            },
          ];
        }

        return currentFiles.map((currentFile) =>
          currentFile.path === filePath
            ? {
                ...currentFile,
                content,
                savedContent: content,
                name: fileName,
                handle: fileHandle,
              }
            : currentFile,
        );
      });

      setSaveError(null);
      setActiveFilePath(filePath);
    },
    [],
  );

  const handleUpdateFileContent = useCallback(
    (filePath: string, content: string) => {
      setOpenFiles((currentFiles) =>
        currentFiles.map((currentFile) =>
          currentFile.path === filePath
            ? { ...currentFile, content }
            : currentFile,
        ),
      );
    },
    [],
  );

  const handleSaveFile = useCallback(
    async (filePath: string) => {
      const targetFile = openFiles.find((file) => file.path === filePath);

      if (!targetFile) {
        return;
      }

      try {
        setSaveError(null);
        setSavingFilePath(filePath);

        const writable = await targetFile.handle.createWritable();
        await writable.write(targetFile.content);
        await writable.close();

        setOpenFiles((currentFiles) =>
          currentFiles.map((currentFile) =>
            currentFile.path === filePath
              ? { ...currentFile, savedContent: currentFile.content }
              : currentFile,
          ),
        );
      } catch {
        setSaveError("Não foi possível salvar o arquivo atual.");
      } finally {
        setSavingFilePath(null);
      }
    },
    [openFiles],
  );

  const handleCloseProject = useCallback(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
    setSavingFilePath(null);
    setSaveError(null);
    setSelectedRom(null);
    setActiveRom(null);
  }, []);

  const handleDeleteFile = useCallback((filePath: string) => {
    setOpenFiles((currentFiles) =>
      currentFiles.filter((file) => file.path !== filePath),
    );
    setActiveFilePath((current) => (current === filePath ? null : current));
  }, []);

  const handleRunRom = useCallback((rom: FileNode) => {
    const selected: RomSelection = {
      path: rom.path,
      name: rom.name,
      handle: rom.handle,
    };

    setSelectedRom(selected);
    setActiveRom(selected);
  }, []);

  const handleSelectRom = useCallback((rom: FileNode) => {
    setSelectedRom({
      path: rom.path,
      name: rom.name,
      handle: rom.handle,
    });
  }, []);

  return (
    <main className="app app-shell">
      <NavigationSidebar
        activeFilePath={activeFilePath}
        onCloseProject={handleCloseProject}
        onDeleteFile={handleDeleteFile}
        onSelectRom={handleSelectRom}
        onRunRom={handleRunRom}
        onOpenFile={handleOpenFile}
      />
      <section className="app-main">
        <AppHeader theme={theme} onToggleTheme={toggleTheme} />
        <section className="app-workspace">
          <WorkspaceEditor
            activeFilePath={activeFilePath}
            files={openFiles}
            isSaving={Boolean(
              activeFilePath && savingFilePath === activeFilePath,
            )}
            saveError={saveError}
            onChangeFileContent={handleUpdateFileContent}
            onSaveFile={handleSaveFile}
            onSelectFile={setActiveFilePath}
          />
          <EmulatorPanel
            selectedRom={selectedRom}
            activeRom={activeRom}
            mode={emulatorMode}
            onChangeMode={setEmulatorMode}
            onRunSelectedRom={() => {
              if (selectedRom) {
                setActiveRom({ ...selectedRom });
              }
            }}
          />
        </section>
      </section>
    </main>
  );
}

export default App;
