import { useState, useEffect } from 'react';
import { Save, RotateCcw, Trash2, History, ExternalLink, Loader2, AlertCircle, LogIn, LogOut, Mail, Upload, Download, Check } from 'lucide-react';
import type { SyncUser } from '@/src/utils/googleAuth';
import { Button } from '@/src/components/ui/button';
import { sendMessage } from '@/messaging';
import { useDirty } from '@/src/hooks/useSync';
import type { TabSession } from '@/src/utils/types';
import { useI18n } from '@/src/i18n';

function SessionTab() {
  const { t } = useI18n();
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
      setError(t('popup.session.loadFail'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadSessions();
    // 故意仅首挂载触发;loadSessions 内部已自带 i18n fallback,语言切换后下一次打开会自动用新文案
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setError(result.error || t('popup.session.saveFail'));
      }
    } catch (err) {
      console.error('[SessionTab] Failed to save session:', err);
      setError(t('popup.session.saveFail'));
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
        setError(result.error || t('popup.session.restoreFail'));
      }
    } catch (err) {
      console.error('[SessionTab] Failed to restore session:', err);
      setError(t('popup.session.restoreFail'));
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
        setError(result.error || t('popup.session.deleteFail'));
      }
    } catch (err) {
      console.error('[SessionTab] Failed to delete session:', err);
      setError(t('popup.session.deleteFail'));
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
        setLoginError(result.error || t('popup.session.loginFail'));
      }
    } catch (err) {
      console.error('[SessionTab] Login error:', err);
      setLoginError(err instanceof Error ? err.message : t('popup.session.loginFail'));
    } finally {
      setLoginLoading(false);
    }
  };

  // 登出
  const handleLogout = async () => {
    if (!window.confirm(t('popup.session.logoutConfirm'))) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      const result = await sendMessage('auth/logout', undefined);
      if (result.success) {
        setCurrentUser(null);
      } else {
        setLoginError(result.error || t('popup.session.logoutFail'));
      }
    } catch (err) {
      console.error('[SessionTab] Logout error:', err);
      setLoginError(err instanceof Error ? err.message : t('popup.session.logoutFail'));
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
      if (res.success) setSyncMsg(t('popup.session.uploaded'));
      else setSyncErr(res.error || t('popup.session.uploadFail'));
    } catch (err) {
      setSyncErr(err instanceof Error ? err.message : t('popup.session.uploadFail'));
    } finally {
      setSyncBusy(null);
    }
  };

  const handleSyncDownload = async () => {
    if (!window.confirm(t('popup.session.downloadConfirm'))) return;
    setSyncBusy('download');
    setSyncMsg(null);
    setSyncErr(null);
    try {
      const res = await sendMessage('sync/download', 'sessions');
      if (res.success) {
        setSyncMsg(t('popup.session.downloaded'));
        await loadSessions(); // 本地会话已被覆盖,刷新列表
      } else {
        setSyncErr(res.error || t('popup.session.downloadFail'));
      }
    } catch (err) {
      setSyncErr(err instanceof Error ? err.message : t('popup.session.downloadFail'));
    } finally {
      setSyncBusy(null);
    }
  };

  // 计算相对时间
  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return t('popup.session.justNow');
    if (diff < 3600000) return t('popup.session.minutesAgo', { n: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('popup.session.hoursAgo', { n: Math.floor(diff / 3600000) });
    return t('popup.session.daysAgo', { n: Math.floor(diff / 86400000) });
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
            {t('popup.session.saving')}
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            {t('popup.session.saveCurrent')}
          </>
        )}
      </Button>

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
              {t('popup.session.logout')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="w-3.5 h-3.5" />
              {t('popup.session.loggedOutHint')}
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
                  {t('popup.session.loginLoading')}
                </>
              ) : (
                <>
                  <LogIn className="w-3 h-3" />
                  {t('popup.session.loginButton')}
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
              {t('popup.session.cloudSyncTitle')}
              {sessionsDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-red-500"
                  title={t('popup.session.cloudSyncDirty')}
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
              {t('popup.session.uploadToCloud')}
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
              {t('popup.session.downloadFromCloud')}
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
          {t('popup.search.loading')}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <History className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">{t('popup.session.noSessions')}</p>
          <p className="text-xs mt-1 opacity-60">{t('popup.session.noSessionsHint')}</p>
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
                    <span>{t('popup.session.tabs', { n: session.tabCount })}</span>
                    {session.tabCount >= 30 && (
                      <>
                        <span>·</span>
                        <span className="text-amber-500" title={t('popup.session.tabsLimitTitle')}>{t('popup.session.tabsLimit')}</span>
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
                      {t('popup.session.moreTabs', { n: session.tabs.length - 3 })}
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
                      {t('popup.session.restoring')}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3 h-3" />
                      {t('popup.session.restore')}
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
                  {t('popup.session.delete')}
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