import { useState, useRef, useEffect } from 'react';
import { Download, Upload, AlertCircle, Check, Chrome, Loader2, CloudUpload, CloudDownload } from 'lucide-react';
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
import { storage } from '@wxt-dev/storage';
import { LOCAL_STORAGE_KEY } from '@/src/utils/constants';

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
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [previewData, setPreviewData] = useState<ExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isChromeImporting, setIsChromeImporting] = useState(false);
  const [syncing, setSyncing] = useState<'upload' | 'download' | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 打开弹窗时读取最后同步时间
  useEffect(() => {
    if (open) {
      storage.getItem<number>(LOCAL_STORAGE_KEY.LAST_SYNC).then(v => setLastSyncAt(v ?? null));
    }
  }, [open]);

  // 计算相对时间
  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  };

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
      setError(err instanceof Error ? err.message : '文件解析失败');
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
        setError(result.error || '导入失败');
        return;
      }

      if (result.shortcuts.length === 0) {
        setError('未找到可导入的书签');
        return;
      }

      const importedCount = await addShortcuts(result.shortcuts);

      if (importedCount === 0) {
        setSuccessMsg('没有新书签需要导入（已跳过重复）');
      } else {
        const skipped = result.shortcuts.length - importedCount;
        setSuccessMsg(`成功从 Chrome 书签导入 ${importedCount} 个${skipped > 0 ? `（跳过 ${skipped} 个重复）` : ''}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chrome 书签导入失败');
    } finally {
      setIsChromeImporting(false);
    }
  };

  // 上传书签到云端
  const handleSyncUpload = async () => {
    setSyncing('upload');
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await sendMessage('bookmarks/sync-upload', undefined);
      if (result.success) {
        const ts = result.lastSyncAt ?? Date.now();
        setLastSyncAt(ts);
        setSuccessMsg(`已上传 ${shortcuts.length} 个书签、${groups.length} 个分组到云端`);
      } else {
        setError(result.error || '上传失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setSyncing(null);
    }
  };

  // 从云端下载书签
  const handleSyncDownload = async () => {
    // 二次确认: 下载会全量覆盖本地书签和分组
    const totalLocal = shortcuts.length + groups.length;
    const message = totalLocal > 0
      ? `当前有 ${shortcuts.length} 个书签、${groups.length} 个分组，确定要从云端下载并覆盖吗？\n\n该操作只清空本地书签和分组,不影响会话存档。`
      : '确定要从云端下载书签和分组吗？';

    if (!window.confirm(message)) return;

    setSyncing('download');
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await sendMessage('bookmarks/sync-download', undefined);
      if (result.success) {
        const ts = result.lastSyncAt ?? Date.now();
        setLastSyncAt(ts);
        setSuccessMsg('已从云端下载，关闭弹窗查看最新数据');
        // storage.watch 会自动触发 useShortcuts/useGroups 重载
      } else {
        setError(result.error || '下载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败');
    } finally {
      setSyncing(null);
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
          <DialogTitle>导入导出书签</DialogTitle>
          <DialogDescription>
            备份或恢复你的分组和书签数据
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 书签 + 分组云同步 */}
          <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">书签同步</p>
                <p className="text-sm text-muted-foreground">
                  通过 Google 账号跨设备同步书签和分组
                </p>
              </div>
              {lastSyncAt && (
                <span className="text-xs text-muted-foreground shrink-0">
                  上次同步: {getRelativeTime(lastSyncAt)}
                </span>
              )}
            </div>
            {/* ⚠️ 云同步维护中 — 后端就绪前按钮禁用 */}
            <div className="text-xs text-amber-500 bg-amber-500/10 rounded px-2 py-1.5">
              维护中：云同步功能暂时不可用（详见 docs/2026-06-02-cloud-sync-fix-plan.md）
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncUpload}
                disabled // ⚠️ 维护中：禁用
                title="云同步维护中"
                className="flex-1"
              >
                <CloudUpload className="w-4 h-4 mr-2" />
                上传到云端
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncDownload}
                disabled // ⚠️ 维护中：禁用
                title="云同步维护中"
                className="flex-1"
              >
                <CloudDownload className="w-4 h-4 mr-2" />
                从云端下载
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ 会话存档请在浏览器工具栏图标中单独同步;云端总配额 100KB,数据量较大时可能上传失败。
            </p>
          </div>

          {/* 导出按钮 */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
            <div>
              <p className="font-medium">导出数据</p>
              <p className="text-sm text-muted-foreground">
                导出 {shortcuts.length} 个书签，{groups.length} 个分组
              </p>
            </div>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              导出
            </Button>
          </div>

          {/* 从 Chrome 书签导入 */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
            <div>
              <p className="font-medium">从 Chrome 书签导入</p>
              <p className="text-sm text-muted-foreground">
                一键同步浏览器书签栏
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
              导入
            </Button>
          </div>

          {/* 从文件导入 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">从备份文件导入</p>
                <p className="text-xs text-muted-foreground">支持 .json 格式</p>
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
                选择文件
              </Button>
            </div>

            {/* 预览数据 */}
            {previewData && (
              <div className="p-3 rounded-xl border bg-muted/30 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>
                    {previewData.shortcuts.length} 个书签，{previewData.groups.length} 个分组
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
                    合并
                  </Button>
                  <Button
                    variant={importMode === 'replace' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImportMode('replace')}
                    className="flex-1"
                  >
                    替换
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {importMode === 'merge'
                    ? '合并：保留现有数据，添加新数据（跳过重复URL）'
                    : '替换：清空现有数据，使用导入的数据'}
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
            关闭
          </Button>
          <Button onClick={handleImport} disabled={!previewData}>
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
