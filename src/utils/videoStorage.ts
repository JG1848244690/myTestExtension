/**
 * IndexedDB 存视频背景 Blob
 *
 * 为什么不用 chrome.storage.local:
 *   - chrome.storage.local 限 5MB per item,视频背景普遍超过。
 *   - IndexedDB 单条记录理论无上限。
 *
 * 作用域:
 *   - newtab / popup / background 三个 context 共享同一个 origin
 *     (chrome-extension://<id>/),所以 IndexedDB 数据跨 context 可见。
 *
 * 卸载扩展 = IndexedDB 数据丢失(预期行为,因为扩展本身的 state 也丢了)。
 */

const DB_NAME = 'xy-tab-video-bg';
const DB_VERSION = 1;
const STORE = 'videos';
const KEY = 'background';

export interface StoredVideo {
  blob: Blob;
  fileName: string;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

export async function saveBackgroundVideo(blob: Blob, fileName: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.put({ blob, fileName, savedAt: Date.now() } satisfies StoredVideo, KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function loadBackgroundVideo(): Promise<StoredVideo | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(KEY);
    req.onsuccess = () => resolve((req.result as StoredVideo | undefined) ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearBackgroundVideo(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.delete(KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}