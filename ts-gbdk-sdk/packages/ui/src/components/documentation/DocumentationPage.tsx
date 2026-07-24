import { FiBookOpen } from "react-icons/fi";
import type {
  DocumentationCatalogContext,
  DocumentationEntry,
  DocumentationStatus,
} from "../navigation/sections/documentationCatalog";

type DocumentationPageProps = {
  selectedEntry: DocumentationEntry | null;
  context: DocumentationCatalogContext;
  onClose: () => void;
};

const STATUS_LABEL: Record<DocumentationStatus, string> = {
  ready: "Pronto",
  declare: "Requer declare",
  limited: "Limitado no MVP",
};

function buildMainFileLabel(hasMainFile: boolean): string {
  return hasMainFile ? "src/main.ts" : "src/main.ts (crie o arquivo)";
}

export function DocumentationPage({
  selectedEntry,
  context,
  onClose,
}: DocumentationPageProps) {
  const mainFileLabel = buildMainFileLabel(context.hasMainFile);

  if (!selectedEntry) {
    return (
      <section className="documentation-page" aria-label="Documentação GBDK">
        <header className="documentation-page-header">
          <div className="documentation-page-title-wrap">
            <FiBookOpen aria-hidden="true" />
            <h2>Documentação GBDK</h2>
          </div>
          <button
            type="button"
            className="documentation-close"
            onClick={onClose}
          >
            Voltar ao editor
          </button>
        </header>

        <div className="documentation-page-empty">
          <strong>Selecione uma função no índice da sidebar.</strong>
          <span>
            O conteúdo completo com assinatura C, TypeScript e guia de
            implementação aparecerá aqui.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="documentation-page" aria-label="Documentação GBDK">
      <header className="documentation-page-header">
        <div className="documentation-page-title-wrap">
          <FiBookOpen aria-hidden="true" />
          <h2>{selectedEntry.name}</h2>
        </div>
        <button type="button" className="documentation-close" onClick={onClose}>
          Voltar ao editor
        </button>
      </header>

      <div className="documentation-page-meta">
        <span>Header: {selectedEntry.header}</span>
        <span>Categoria: {selectedEntry.category}</span>
        <span className={`documentation-status status-${selectedEntry.status}`}>
          {STATUS_LABEL[selectedEntry.status]}
        </span>
      </div>

      <section className="documentation-usage-summary">
        <h3>Uso breve</h3>
        <p>{selectedEntry.usageSummary}</p>
      </section>

      <section className="documentation-guide">
        <h3>Como implementar no projeto TypeScript</h3>
        <ol>
          <li>
            {context.hasProject
              ? `Abra ${mainFileLabel} no projeto ${context.projectName ?? "ativo"}.`
              : "Crie ou abra um projeto e use src/main.ts como ponto de entrada."}
          </li>
          <li>
            Adicione a assinatura TypeScript abaixo (declare function/const).
          </li>
          <li>
            Use a chamada em updateFrame() ou main() respeitando o subconjunto
            TS suportado.
          </li>
          <li>
            Compile; se houver TSGBDK de erro, ajuste o código antes do build
            nativo.
          </li>
        </ol>
      </section>

      <section className="documentation-snippet-block">
        <h3>Assinatura C</h3>
        <pre>{selectedEntry.cSignature}</pre>
      </section>

      <section className="documentation-snippet-block">
        <h3>TypeScript no projeto</h3>
        <pre>{selectedEntry.tsDeclaration}</pre>
      </section>

      <section className="documentation-snippet-block">
        <h3>Exemplo de uso</h3>
        <pre>{selectedEntry.tsUsage}</pre>
      </section>

      <section className="documentation-note-block">
        <h3>Notas</h3>
        <p>{selectedEntry.notes}</p>
      </section>
    </section>
  );
}
