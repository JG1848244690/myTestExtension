import { useState, useRef } from 'react';
import { Download, Upload, AlertCircle, Check, Chrome, Loader2, LogOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import type { Shortcut, ShortcutGroup, ExportData } from '@/src/utils/types';
import { exportData, parseImportFile, mergeImportData, replaceImportData, type ImportMode } from '@/src/utils/importExport';
import { sendMessage } from '@/messaging';
import { useSyncAuth, useDirty } from '@/src/hooks/useSync';
import { useI18n } from '@/src/i18n';

interface ImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Shortcut[];
  groups: ShortcutGroup[];
  onImport: (shortcuts: Shortcut[], groups: ShortcutGroup[]) => void;
  addShortcuts: (items: { name: string; url: string }[]) => Promise<number>;
}

export function ImportExportDialog({
  open,
  onOpenChange,
  shortcuts,
  groups,
  onImport,
  addShortcuts,
}: ImportExportDialogProps) {
  const { t } = useI18n();
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [previewData, setPreviewData] = useState<ExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isChromeImporting, setIsChromeImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 云同步(书签)
  const { user, login, logout, loading: authLoading, error: authError } = useSyncAuth();
  const bookmarksDirty = useDirty('bookmarks');
  const [syncBusy, setSyncBusy] = useState<null | 'upload' | 'download'>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  const handleExport = () => {
    exportData(shortcuts, groups);
    onOpenChange(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMsg(null);
    try {
      const data = await parseImportFile(file);
      setPreviewData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importExport.parseFail'));
      setPreviewData(null);
    }

    // 重置 input 以允许重复选择同一文件
    e.target.value = '';
  };

  const handleImport = () => {
    if (!previewData) return;

    let result: { shortcuts: Shortcut[]; groups: ShortcutGroup[] };

    if (importMode === 'merge') {
      result = mergeImportData(shortcuts, groups, previewData);
    } else {
      result = replaceImportData(previewData);
    }

    onImport(result.shortcuts, result.groups);
    setPreviewData(null);
    setError(null);
    onOpenChange(false);
  };

  const handleChromeImport = async () => {
    setIsChromeImporting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await sendMessage('shortcuts/import-from-newtab');

      if (!result.success) {
        setError(result.error || t('importExport.chromeImport'));
        return;
      }

      if (result.shortcuts.length === 0) {
        setError(t('importExport.chromeImportNone'));
        return;
      }

      const importedCount = await addShortcuts(result.shortcuts);

      if (importedCount === 0) {
        setSuccessMsg(t('importExport.chromeImportSkipAll'));
      } else {
        const skipped = result.shortcuts.length - importedCount;
        setSuccessMsg(t('importExport.chromeImportSuccess', { n: importedCount }) + (skipped > 0 ? t('importExport.chromeImportSkip', { n: skipped }) : ''));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importExport.chromeImportFail'));
    } finally {
      setIsChromeImporting(false);
    }
  };

  const handleSyncUpload = async () => {
    setSyncBusy('upload');
    setSyncMsg(null);
    setSyncErr(null);
    try {
      const res = await sendMessage('sync/upload', 'bookmarks');
      if (res.success) {
        setSyncMsg(t('importExport.uploadSuccess'));
      } else {
        setSyncErr(res.error || t('importExport.uploadFail'));
      }
    } catch (err) {
      setSyncErr(err instanceof Error ? err.message : t('importExport.uploadFail'));
    } finally {
      setSyncBusy(null);
    }
  };

  const handleSyncDownload = async () => {
    if (!window.confirm(t('importExport.downloadConfirm'))) return;
    setSyncBusy('download');
    setSyncMsg(null);
    setSyncErr(null);
    try {
      const res = await sendMessage('sync/download', 'bookmarks');
      if (res.success) {
        setSyncMsg(t('importExport.downloadSuccess'));
      } else {
        setSyncErr(res.error || t('importExport.downloadFail'));
      }
    } catch (err) {
      setSyncErr(err instanceof Error ? err.message : t('importExport.downloadFail'));
    } finally {
      setSyncBusy(null);
    }
  };

  const handleClose = () => {
    setPreviewData(null);
    setError(null);
    setSuccessMsg(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('importExport.title')}</DialogTitle>
          <DialogDescription>
            {t('importExport.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 书签云同步(手动:登录 + 上传/下载 + 红点) */}
          <div className="space-y-3 p-4 rounded-xl border bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium flex items-center gap-1.5">
                  {t('importExport.cloudSync')}
                  {bookmarksDirty && (
                    <span
                      className="w-2 h-2 rounded-full bg-red-500"
                      title={t('importExport.cloudSyncDirty')}
                    />
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user ? t('importExport.loggedIn', { email: user.email }) : t('importExport.loggedOut')}
                </p>
              </div>
              {user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  disabled={authLoading}
                  className="h-7 text-xs gap-1 shrink-0"
                >
                  <LogOut className="w-3 h-3" />
                  {t('importExport.logout')}
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={login}
                  disabled={authLoading}
                  className="h-7 text-xs gap-1 shrink-0"
                >
                  {authLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Chrome className="w-3 h-3" />
                  )}
                  {t('importExport.login')}
                </Button>
              )}
            </div>

            {user && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  disabled={syncBusy !== null}
                  onClick={handleSyncUpload}
                >
                  {syncBusy === 'upload' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {t('importExport.uploadToCloud')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  disabled={syncBusy !== null}
                  onClick={handleSyncDownload}
                >
                  {syncBusy === 'download' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {t('importExport.downloadFromCloud')}
                </Button>
              </div>
            )}

            {authError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {authError}
              </p>
            )}
            {syncMsg && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3 shrink-0" />
                {syncMsg}
              </p>
            )}
            {syncErr && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {syncErr}
              </p>
            )}
          </div>

          {/* 导出按钮 */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
            <div>
              <p className="font-medium">{t('importExport.exportTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {t('importExport.exportSummary', { shortcuts: shortcuts.length, groups: groups.length })}
              </p>
            </div>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              {t('importExport.export')}
            </Button>
          </div>

          {/* 从 Chrome 书签导入 */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
            <div>
              <p className="font-medium">{t('importExport.chromeImportTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {t('importExport.chromeImportDesc')}
              </p>
            </div>
            <Button
              onClick={handleChromeImport}
              variant="outline"
              size="sm"
              disabled={isChromeImporting}
            >
              {isChromeImporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Chrome className="w-4 h-4 mr-2" />
              )}
              {t('importExport.chromeImport')}
            </Button>
          </div>

          {/* 从文件导入 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('importExport.fileImportTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('importExport.fileImportDesc')}</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
              >
                <Upload className="w-4 h-4 mr-2" />
                {t('importExport.selectFile')}
              </Button>
            </div>

            {/* 预览数据 */}
            {previewData && (
              <div className="p-3 rounded-xl border bg-muted/30 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>
                    {t('importExport.previewSummary', { shortcuts: previewData.shortcuts.length, groups: previewData.groups.length })}
                  </span>
                </div>

                {/* 导入模式选择 */}
                <div className="flex gap-2">
                  <Button
                    variant={importMode === 'merge' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImportMode('merge')}
                    className="flex-1"
                  >
                    {t('importExport.mergeMode')}
                  </Button>
                  <Button
                    variant={importMode === 'replace' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImportMode('replace')}
                    className="flex-1"
                  >
                    {t('importExport.replaceMode')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {importMode === 'merge'
                    ? t('importExport.mergeModeDesc')
                    : t('importExport.replaceModeDesc')}
                </p>
              </div>
            )}

            {/* 成功提示 */}
            {successMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-green-500/50 bg-green-500/10 text-sm text-green-600 dark:text-green-400">
                <Check className="w-4 h-4 flex-shrink-0" />
                {successMsg}
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/50 bg-destructive/10 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.close')}
          </Button>
          <Button onClick={handleImport} disabled={!previewData}>
            {t('importExport.confirmImport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
