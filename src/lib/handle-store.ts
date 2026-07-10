/**
 * Persists a single FileSystemDirectoryHandle (the DJ's chosen drive
 * root) in IndexedDB so they don't have to re-run the folder picker on
 * every page load. Browsers support structured-cloning these handles
 * into IndexedDB; permission still needs to be re-verified per session
 * via requestPermission, which is why loadRootHandle re-checks it.
 */
const DB_NAME = "crate-builder";
const STORE = "handles";
const KEY = "driveRoot";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  if (!handle) return null;

  const perm = await (handle as any).queryPermission({ mode: "readwrite" });
  if (perm === "granted") return handle;
  const requested = await (handle as any).requestPermission({ mode: "readwrite" });
  return requested === "granted" ? handle : null;
}
