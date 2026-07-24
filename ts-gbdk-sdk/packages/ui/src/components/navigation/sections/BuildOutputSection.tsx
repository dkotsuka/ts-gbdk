import { useEffect } from "react";
import { FiFile, FiPlay } from "react-icons/fi";
import type { FileNode } from "../NavigationTree.types";
import { IconActionButton } from "../IconActionButton";
import { SidebarSection } from "../SidebarSection";

type BuildOutputSectionProps = {
  projectName: string;
  outputRomFiles: FileNode[];
  selectedOutputRomPath: string | null;
  onDetectLatestVersion: (version: string) => void;
  onSelectOutputRom: (file: FileNode) => void;
  onRunSelectedRom: () => void;
  isOpeningProject: boolean;
  isUpdatingTree: boolean;
  isCompilingProject: boolean;
  compileTarget: "gb" | "gbc";
  onChangeCompileTarget: (target: "gb" | "gbc") => void;
  buildBumpType: "major" | "minor" | "path";
  onChangeBuildBumpType: (type: "major" | "minor" | "path") => void;
  nextVersionPreview: string;
  compileLogs: string[];
  onCompileProject: () => void;
};

function parseVersionTuple(version: string): [number, number, number] {
  const parts = version.split(".");
  return [Number(parts[0] ?? 0), Number(parts[1] ?? 0), Number(parts[2] ?? 0)];
}

function compareVersionTuple(
  a: [number, number, number],
  b: [number, number, number],
): number {
  if (a[0] !== b[0]) {
    return a[0] - b[0];
  }

  if (a[1] !== b[1]) {
    return a[1] - b[1];
  }

  return a[2] - b[2];
}

function findLatestBuildVersion(
  romFiles: FileNode[],
  projectName: string,
): string | null {
  const safeProjectName = projectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const versionRegex = new RegExp(
    `^${safeProjectName}-v(\\d+)\\.(\\d+)\\.(\\d+)\\.(gb|gbc)$`,
    "i",
  );

  let latest: [number, number, number] | null = null;
  for (const file of romFiles) {
    const match = file.name.match(versionRegex);
    if (!match) {
      continue;
    }

    const tuple: [number, number, number] = [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    ];

    if (!latest || compareVersionTuple(tuple, latest) > 0) {
      latest = tuple;
    }
  }

  if (!latest) {
    return null;
  }

  return `${latest[0]}.${latest[1]}.${latest[2]}`;
}

export function BuildOutputSection({
  projectName,
  outputRomFiles,
  selectedOutputRomPath,
  onDetectLatestVersion,
  onSelectOutputRom,
  onRunSelectedRom,
  isOpeningProject,
  isUpdatingTree,
  isCompilingProject,
  compileTarget,
  onChangeCompileTarget,
  buildBumpType,
  onChangeBuildBumpType,
  nextVersionPreview,
  compileLogs,
  onCompileProject,
}: BuildOutputSectionProps): JSX.Element {
  const hasSelectedOutputRom =
    selectedOutputRomPath !== null &&
    outputRomFiles.some((file) => file.path === selectedOutputRomPath);

  useEffect(() => {
    const latestVersion = findLatestBuildVersion(outputRomFiles, projectName);
    onDetectLatestVersion(latestVersion ?? "0.0.0");
  }, [outputRomFiles, projectName, onDetectLatestVersion]);

  return (
    <SidebarSection title="Saída">
      <div className="nav-output-list">
        {outputRomFiles.length > 0 ? (
          outputRomFiles.map((file) => (
            <button
              key={file.path}
              type="button"
              className={`nav-item nav-output-item${
                selectedOutputRomPath === file.path ? " is-selected" : ""
              }`}
              onClick={() => {
                onSelectOutputRom(file);
              }}
            >
              <FiFile aria-hidden="true" />
              <span>{file.name}</span>
            </button>
          ))
        ) : (
          <div className="nav-output-empty">
            Nenhum arquivo .gb/.gbc encontrado.
          </div>
        )}
      </div>

      <div className="nav-output-build-controls">
        <div className="nav-compile-controls">
          <label className="nav-compile-label" htmlFor="compile-target">
            Alvo de ROM:
          </label>
          <select
            id="compile-target"
            className="nav-compile-select"
            value={compileTarget}
            onChange={(event) => {
              onChangeCompileTarget(event.target.value as "gb" | "gbc");
            }}
            disabled={isCompilingProject}
            aria-label="Selecionar alvo de ROM"
            title="Selecionar alvo de ROM"
          >
            <option value="gb">GB (.gb)</option>
            <option value="gbc">GBC (.gbc)</option>
          </select>

          <IconActionButton
            title="Compilar projeto"
            disabled={isOpeningProject || isUpdatingTree || isCompilingProject}
            onClick={onCompileProject}
          >
            <FiPlay aria-hidden="true" />
          </IconActionButton>

          <IconActionButton
            title={
              hasSelectedOutputRom
                ? "Rodar ROM selecionada"
                : "Selecione uma ROM para rodar"
            }
            disabled={
              !hasSelectedOutputRom ||
              isOpeningProject ||
              isUpdatingTree ||
              isCompilingProject
            }
            onClick={onRunSelectedRom}
          >
            <FiPlay aria-hidden="true" />
          </IconActionButton>
        </div>

        <fieldset className="nav-build-type-group">
          <legend>Tipo de build (versão)</legend>
          <label>
            <input
              type="radio"
              name="build-bump-type"
              value="major"
              checked={buildBumpType === "major"}
              onChange={() => {
                onChangeBuildBumpType("major");
              }}
              disabled={isCompilingProject}
            />
            <span>major</span>
          </label>
          <label>
            <input
              type="radio"
              name="build-bump-type"
              value="minor"
              checked={buildBumpType === "minor"}
              onChange={() => {
                onChangeBuildBumpType("minor");
              }}
              disabled={isCompilingProject}
            />
            <span>minor</span>
          </label>
          <label>
            <input
              type="radio"
              name="build-bump-type"
              value="path"
              checked={buildBumpType === "path"}
              onChange={() => {
                onChangeBuildBumpType("path");
              }}
              disabled={isCompilingProject}
            />
            <span>path</span>
          </label>
        </fieldset>

        <div className="nav-version-preview">
          Próxima versão: v{nextVersionPreview}
        </div>
      </div>

      {compileLogs.length > 0 ? (
        <div className="nav-compile-logs" aria-live="polite">
          {compileLogs.map((logEntry, index) => (
            <div key={`compile-log-${index}`} className="nav-compile-log-entry">
              {logEntry}
            </div>
          ))}
        </div>
      ) : null}
    </SidebarSection>
  );
}
