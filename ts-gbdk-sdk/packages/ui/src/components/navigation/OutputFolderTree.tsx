import { FiFile, FiFolder } from "react-icons/fi";
import type { FolderNode } from "./NavigationTree.types";

type OutputFolderTreeProps = {
  root: FolderNode;
};

function OutputFolderNode({
  folder,
  depth,
}: {
  folder: FolderNode;
  depth: number;
}): JSX.Element {
  return (
    <div key={folder.path} className="nav-tree-node">
      <div
        className="nav-folder-button nav-folder-readonly"
        style={{ paddingLeft: `${1.2 + depth * 0.9}rem` }}
      >
        <FiFolder aria-hidden="true" />
        <span>{folder.name}</span>
      </div>

      <div className="nav-tree-children">
        {folder.folders.map((childFolder) => (
          <OutputFolderNode
            key={childFolder.path}
            folder={childFolder}
            depth={depth + 1}
          />
        ))}

        {folder.files.map((file) => (
          <div
            key={file.path}
            className="nav-file-item nav-file-readonly"
            style={{ paddingLeft: `${2.25 + depth * 0.9}rem` }}
          >
            <FiFile aria-hidden="true" />
            <span>{file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OutputFolderTree({ root }: OutputFolderTreeProps): JSX.Element {
  return <OutputFolderNode folder={root} depth={0} />;
}
