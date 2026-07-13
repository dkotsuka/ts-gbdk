type EditorFile = {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  handle: FileSystemFileHandle;
};

type WorkspaceEditorProps = {
  files: EditorFile[];
  activeFilePath: string | null;
  isSaving: boolean;
  saveError: string | null;
  onChangeFileContent: (filePath: string, content: string) => void;
  onSaveFile: (filePath: string) => Promise<void>;
  onSelectFile: (filePath: string) => void;
};

function getEditorLines(content: string): string[] {
  if (!content.length) {
    return [""];
  }

  return content.split(/\r?\n/);
}

export function WorkspaceEditor({
  files,
  activeFilePath,
  isSaving,
  saveError,
  onChangeFileContent,
  onSaveFile,
  onSelectFile,
}: WorkspaceEditorProps) {
  const activeFile = files.find((file) => file.path === activeFilePath) ?? null;
  const lines = activeFile ? getEditorLines(activeFile.content) : [];
  const hasUnsavedChanges = activeFile
    ? activeFile.content !== activeFile.savedContent
    : false;

  return (
    <section className="workspace-editor" aria-label="Editor de texto">
      <div className="editor-tabs" role="tablist" aria-label="Arquivos abertos">
        {files.length ? (
          files.map((file) => {
            const isActive = file.path === activeFilePath;

            return (
              <button
                key={file.path}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`editor-tab${isActive ? " is-active" : ""}`}
                onClick={() => onSelectFile(file.path)}
              >
                <span>{file.name}</span>
                {file.content !== file.savedContent ? (
                  <span className="editor-tab-dirty" aria-hidden="true">
                    *
                  </span>
                ) : null}
              </button>
            );
          })
        ) : (
          <div className="editor-empty-tab">Nenhum arquivo aberto</div>
        )}
      </div>

      {activeFile ? (
        <>
          <div className="editor-toolbar">
            <div className="editor-toolbar-file">{activeFile.path}</div>
            <button
              type="button"
              className="editor-save-button"
              onClick={() => {
                void onSaveFile(activeFile.path);
              }}
              disabled={!hasUnsavedChanges || isSaving}
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>

          {saveError ? (
            <div className="editor-save-error">{saveError}</div>
          ) : null}

          <div className="editor-surface">
            <div className="editor-gutter" aria-hidden="true">
              {lines.map((_, index) => (
                <div
                  key={`${activeFile.path}-line-${index + 1}`}
                  className="editor-line-number"
                >
                  {index + 1}
                </div>
              ))}
            </div>

            <textarea
              className="editor-textarea"
              spellCheck={false}
              value={activeFile.content}
              onChange={(event) => {
                onChangeFileContent(activeFile.path, event.target.value);
              }}
              aria-label={`Editor do arquivo ${activeFile.name}`}
            />
          </div>
        </>
      ) : (
        <div className="editor-empty-state">
          <strong>Abra um arquivo pelo menu de navegação.</strong>
          <span>
            O conteúdo será exibido aqui em um editor central com abas e
            numeração de linhas.
          </span>
        </div>
      )}
    </section>
  );
}
