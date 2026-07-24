import { useMemo, useState } from "react";
import { FiBookOpen, FiSearch } from "react-icons/fi";
import { SidebarSection } from "../SidebarSection";
import {
  DOCUMENTATION_GROUPS,
  type DocumentationEntry,
  type DocumentationCatalogContext,
} from "./documentationCatalog";

type DocumentationSectionProps = {
  context: DocumentationCatalogContext;
  selectedEntryId: string | null;
  onSelectEntry: (entry: DocumentationEntry) => void;
};

function matchesQuery(entry: DocumentationEntry, query: string): boolean {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const fullText = [
    entry.name,
    entry.header,
    entry.category,
    entry.usageSummary,
    entry.notes,
    entry.tsDeclaration,
  ]
    .join(" ")
    .toLowerCase();
  return fullText.includes(normalized);
}

export function DocumentationSection({
  context,
  selectedEntryId,
  onSelectEntry,
}: DocumentationSectionProps): JSX.Element {
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(
    () =>
      DOCUMENTATION_GROUPS.map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => matchesQuery(entry, query)),
      })).filter((group) => group.entries.length > 0),
    [query],
  );

  const allVisibleEntries = useMemo(
    () => filteredGroups.flatMap((group) => group.entries),
    [filteredGroups],
  );

  return (
    <SidebarSection title="Documentação">
      <div className="nav-doc-index-intro">
        <FiBookOpen aria-hidden="true" />
        <span>Índice de funções GBDK</span>
      </div>

      <div className="nav-doc-index-context">
        {context.hasProject
          ? `Projeto: ${context.projectName ?? "ativo"}`
          : "Abra um projeto para aplicar os snippets"}
      </div>

      <label className="nav-doc-search" htmlFor="nav-doc-search-input">
        <FiSearch aria-hidden="true" />
        <input
          id="nav-doc-search-input"
          type="search"
          placeholder="Buscar função, header ou categoria"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </label>

      <div className="nav-doc-summary">
        {allVisibleEntries.length} função(ões) exibida(s)
      </div>

      <div className="nav-doc-groups nav-doc-groups-index">
        {filteredGroups.length > 0 ? (
          filteredGroups.map((group) => (
            <section key={group.id} className="nav-doc-group">
              <h4>{group.title}</h4>
              <p>{group.description}</p>

              {group.entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`nav-doc-index-item${selectedEntryId === entry.id ? " is-selected" : ""}`}
                  onClick={() => {
                    onSelectEntry(entry);
                  }}
                >
                  <span>{entry.name}</span>
                  <small className="nav-doc-index-usage">
                    {entry.usageSummary}
                  </small>
                  <small>{entry.header}</small>
                </button>
              ))}
            </section>
          ))
        ) : (
          <div className="nav-doc-empty">
            Nenhum item encontrado para este filtro.
          </div>
        )}
      </div>
    </SidebarSection>
  );
}
