import { useState, useEffect } from 'react';
import { Save, RotateCcw, Trash2, History, ExternalLink, Loader2, AlertCircle, LogIn, LogOut, Mail, Upload, Download, Check } from 'lucide-react';
import type { SyncUser } from '@/src/utils/googleAuth';
import { Button } from '@/src/components/ui/button';
import { sendMessage } from '@/messaging';
import { useDirty } from '@/src/hooks/useSync';
import type { TabSession } from '@/src/utils/types';

function SessionTab() {
  const [sessions, setSessions] = useState<TabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SyncUser | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const sessionsDirty = useDirty('sessions');
  const [syncBusy, setSyncBusy] = useState<null | 'upload' | 'download'>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  // 加载当前登录用户
  const loadCurrentUser = async () => {
    try {
      const user = await sendMessage('auth/get-user', undefined);
      setCurrentUser(user);
    } catch (err) {
      console.error('[SessionTab] Failed to load user:', err);
    }
  };

  // 加载会话列表
  const loadSessions = async () => {
    try {
      const list = await sendMessage('tab-sessions/list', undefined);
      setSessions(list);
    } catch (err) {
      console.error('[SessionTab] Failed to load sessions:', err);
      setError('加载会话失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadSessions();
  }, []);

  // 保存当前标签页
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await sendMessage('tab-sessions/save', undefined);
      if (result.success && result.session) {
        await loadSessions();
      } else {
        setError(result.error || '保存失败');
      }
    } catch (err) {
      console.error('[SessionTab] Failed to save session:', err);
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 恢复会话
  const handleRestore = async (sessionId: string) => {
    setRestoringId(sessionId);
    setError(null);
    try {
      const result = await sendMessage('tab-sessions/restore', sessionId);
      if (!result.success) {
        setError(result.error || '恢复失败');
      }
    } catch (err) {
      console.error('[SessionTab] Failed to restore session:', err);
      setError('恢复失败');
    } finally {
      setRestoringId(null);
    }
  };

  // 删除会话
  const handleDelete = async (sessionId: string) => {
    setError(null);
    try {
      const result = await sendMessage('tab-sessions/delete', sessionId);
      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      } else {
        setError(result.error || '删除失败');
      }
    } catch (err) {
      console.error('[SessionTab] Failed to delete session:', err);
      setError('删除失败');
    }
  };

  // Google 登录
  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const result = await sendMessage('auth/login', undefined);
      if (result.success && result.user) {
        setCurrentUser(result.user);
      } else {
        setLoginError(result.error || '登录失败');
      }
    } catch (err) {
      console.error('[SessionTab] Login error:', err);
      setLoginError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoginLoading(false);
    }
  };

  // 登出
  const handleLogout = async () => {
    if (!window.confirm('确定要退出登录吗?登出后云同步将不可用。')) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      const result = await sendMessage('auth/logout', undefined);
      if (result.success) {
        setCurrentUser(null);
      } else {
        setLoginError(result.error || '登出失败');
      }
    } catch (err) {
      console.error('[SessionTab] Logout error:', err);
      setLoginError(err instanceof Error ? err.message : '登出失败');
    } finally {
      setLoginLoading(false);
    }
  };

  // 会话云同步:上传 / 下载(手动覆盖式)
  const handleSyncUpload = async () => {
    setSyncBusy('upload');
    setSyncMsg(null);
    setSyncErr(null);
    try {
      const res = await sendMessage('sync/upload', 'sessions');
      if (res.success) setSyncMsg('已上传到云端');
      else setSyncErr(res.error || '上传失败');
    } catch (err) {
      setSyncErr(err instanceof Error ? err.message : '上传失败');
    } finally {
      setSyncBusy(null);
    }
  };

  const handleSyncDownload = async () => {
    if (!window.confirm('从云端下载将用云端会话覆盖本地,确定?')) return;
    setSyncBusy('download');
    setSyncMsg(null);
    setSyncErr(null);
    try {
      const res = await sendMessage('sync/download', 'sessions');
      if (res.success) {
        setSyncMsg('已从云端下载');
        await loadSessions(); // 本地会话已被覆盖,刷新列表
      } else {
        setSyncErr(res.error || '下载失败');
      }
    } catch (err) {
      setSyncErr(err instanceof Error ? err.message : '下载失败');
    } finally {
      setSyncBusy(null);
    }
  };

  // 计算相对时间
  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  };

  return (
    <div className="p-3 space-y-3">
      {/* 保存按钮 */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            保存中...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            保存当前标签页
          </>
        )}
      </Button>

      {/* 会话云同步区块(仅登录后显示)见登录态下方 */}

      {/* 登录态 */}
      <div className="border border-white/20 dark:border-black/10 rounded-lg p-3 bg-muted/30">
        {currentUser ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {currentUser.picture ? (
                <img
                  src={currentUser.picture}
                  alt=""
                  className="w-7 h-7 rounded-full shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                  {(currentUser.name || currentUser.email)[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {currentUser.name || currentUser.email}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {currentUser.email}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={loginLoading}
              className="gap-1 h-7 text-xs"
            >
              <LogOut className="w-3 h-3" />
              退出
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="w-3.5 h-3.5" />
              未登录,云同步不可用
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleLogin}
              disabled={loginLoading}
              className="gap-1 h-7 text-xs"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  登录中…
                </>
              ) : (
                <>
                  <LogIn className="w-3 h-3" />
                  Google 登录
                </>
              )}
            </Button>
          </div>
        )}
        {loginError && (
          <div className="flex items-center gap-2 text-xs text-red-500 mt-2">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {loginError}
          </div>
        )}
      </div>

      {/* 会话云同步(登录后显示) */}
      {currentUser && (
        <div className="border border-white/20 dark:border-black/10 rounded-lg p-3 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium flex items-center gap-1.5">
              会话云同步
              {sessionsDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-red-500"
                  title="有未同步到云端的本地会话"
                />
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 h-8 text-xs"
              disabled={syncBusy !== null}
              onClick={handleSyncUpload}
            >
              {syncBusy === 'upload' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              上传到云
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 h-8 text-xs"
              disabled={syncBusy !== null}
              onClick={handleSyncDownload}
            >
              {syncBusy === 'download' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              从云下载
            </Button>
          </div>
          {syncMsg && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Check className="w-3 h-3 shrink-0" />
              {syncMsg}
            </div>
          )}
          {syncErr && (
            <div className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {syncErr}
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 rounded-lg p-2">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </div>
      )}

      {/* 会话列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          加载中...
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <History className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">暂无保存的会话</p>
          <p className="text-xs mt-1 opacity-60">点击上方按钮保存当前标签页</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="border border-white/20 dark:border-black/10 rounded-lg p-3 space-y-2 hover:bg-accent/30 transition-colors"
            >
              {/* 会话头信息 */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {session.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{getRelativeTime(session.createdAt)}</span>
                    <span>·</span>
                    <span>{session.tabCount} 个标签页</span>
                    {session.tabCount >= 30 && (
                      <>
                        <span>·</span>
                        <span className="text-amber-500" title="已达到 30 个标签页上限">上限</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 标签页预览 */}
              {session.tabs.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-[72px] overflow-hidden">
                  {session.tabs.slice(0, 3).map((tab, index) => (
                    <div key={index} className="truncate flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      <span>{tab.title || tab.url}</span>
                    </div>
                  ))}
                  {session.tabs.length > 3 && (
                    <div className="text-[10px] opacity-60">
                      还有 {session.tabs.length - 3} 个标签页...
                    </div>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleRestore(session.id)}
                  disabled={restoringId === session.id}
                  className="flex-1 gap-1.5 h-8 text-xs"
                >
                  {restoringId === session.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      恢复中...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3 h-3" />
                      恢复
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(session.id)}
                  className="gap-1.5 h-8 text-xs text-red-500 hover:text-red-600 border-red-500/30 hover:border-red-500/50"
                >
                  <Trash2 className="w-3 h-3" />
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SessionTab;
