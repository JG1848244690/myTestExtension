/**
 * 统一 storage 适配层
 *
 * 设计动机：
 * - 散落各处的 storage.getItem("local:xxx") 字符串魔法值
 * - constants.ts 同时定义 STORAGE_KEY / LOCAL_STORAGE_KEY 容易混用
 * - 每个 hook 重复实现「读 -> 写 -> 订阅」逻辑
 */

import { storage } from '@wxt-dev/storage';

const NAMESPACE = 'local:';

type Unsubscribe = () => void;

/** WXT 的 storage 类型要求 key 带命名空间字面量前缀；这里 cast 一下 */
type NamespacedKey = `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`;
const ns = (key: string): NamespacedKey => (NAMESPACE + key) as NamespacedKey;

export function createStorageCell<T>(key: string) {
  const fullKey = ns(key);

  return {
    key: fullKey,
    rawKey: key,

    async read(): Promise<T | undefined> {
      // storage.getItem 返回 T | null，统一成 T | undefined
      const v = await storage.getItem<T>(fullKey);
      return v ?? undefined;
    },

    async readOr(defaultValue: T): Promise<T> {
      const v = await storage.getItem<T>(fullKey);
      return (v ?? undefined) ?? defaultValue;
    },

    async write(value: T): Promise<void> {
      await storage.setItem(fullKey, value);
    },

    watch(listener: (next: T | undefined) => void): Unsubscribe {
      return storage.watch<T>(fullKey, (next) => listener(next ?? undefined));
    },

    async remove(): Promise<void> {
      await storage.removeItem(fullKey);
    },
  };
}

export type StorageCell<T> = ReturnType<typeof createStorageCell<T>>;