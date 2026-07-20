// Minimal augmentation for the File System Access API surface this app
// uses. TS's bundled dom lib doesn't fully type showDirectoryPicker or
// FileSystemFileHandle.createWritable, so we declare just what we call.
export {};

declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemDirectoryHandle {
    queryPermission(options?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
    requestPermission(options?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
    entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
  }
}
