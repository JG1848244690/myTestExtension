/**
 * 云同步相关的 React hooks
 *
 * - useSyncAuth: 登录态(user / login / logout / loading / error),SessionTab 和 ImportExportDialog 复用
 * - useDirty(scope): 订阅脏标记(红点),跨 context 实时更新
 */

import { useState, useCallback, useEffect } from 'react';
import { sendMessage } from '@/messaging';
import type { SyncUser } from '@/src/utils/googleAuth';
import { readDirty, watchDirty, type SyncScope } from '@/src/utils/syncDirty';

// ============================================================
// 登录态
// ============================================================

export function useSyncAuth() {
  const [user, setUser] = useState<SyncUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sendMessage('auth/get-user', undefined)
      .then((u) => setUser(u))
      .catch(() => {});
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sendMessage('auth/login', undefined);
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        setError(res.error || '登录失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sendMessage('auth/logout', undefined);
      if (res.success) {
        setUser(null);
      } else {
        setError(res.error || '登出失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登出失败');
    } finally {
      setLoading(false);
    }
  }, []);

  return { user, setUser, login, logout, loading, error, setError };
}

// ============================================================
// 脏标记(红点)
// ============================================================

/** 订阅某个 scope 的脏标记,本地变更→true,同步成功→false(跨 context 实时) */
export function useDirty(scope: SyncScope): boolean {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    readDirty(scope).then((d) => {
      if (active) setDirty(d);
    });
    const unsub = watchDirty(scope, (d) => setDirty(d));
    return () => {
      active = false;
      unsub();
    };
  }, [scope]);

  return dirty;
}
