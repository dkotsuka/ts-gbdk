type EditorFile = {
  path: string;
  name: string;
  content: string;
};

type WorkspaceEditorProps = {
  files: EditorFile[];
  activeFilePath: string | null;
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
  onSelectFile,
}: WorkspaceEditorProps) {
  const activeFile = files.find((file) => file.path === activeFilePath) ?? null;
  const lines = activeFile ? getEditorLines(activeFile.content) : [];

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
              </button>
            );
          })
        ) : (
          <div className="editor-empty-tab">Nenhum arquivo aberto</div>
        )}
      </div>

      {activeFile ? (
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

          <pre className="editor-code" tabIndex={0}>
            <code>
              {lines.map((line, index) => (
                <div
                  key={`${activeFile.path}-content-${index + 1}`}
                  className="editor-code-line"
                >
                  {line || " "}
                </div>
              ))}
            </code>
          </pre>
        </div>
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
