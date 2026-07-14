export type BrowserFileSystemEntry = {
  kind: "directory" | "file";
  name: string;
};

export type BrowserFileSystemDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<BrowserFileSystemEntry>;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<BrowserFileSystemDirectoryHandle>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemFileHandle>;
  removeEntry: (
    name: string,
    options?: { recursive?: boolean },
  ) => Promise<void>;
  queryPermission?: (descriptor?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
};

export type FolderNode = {
  path: string;
  name: string;
  handle: BrowserFileSystemDirectoryHandle;
  folders: FolderNode[];
  files: FileNode[];
};

export type FileNode = {
  path: string;
  name: string;
  handle: FileSystemFileHandle;
};
