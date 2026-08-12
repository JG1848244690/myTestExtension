import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import type { Shortcut } from '@/src/utils/types';
import { getGoogleFaviconUrl, extractDomain } from '@/src/utils/faviconCache';
import { useI18n } from '@/src/i18n';

interface ShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcut?: Shortcut | null;
  onSave: (data: { name: string; url: string; icon?: string }) => void;
  /** 快捷模式：粘贴URL后自动提取name，回车直接添加 */
  quickMode?: boolean;
}

/**
 * 从 URL 自动提取名称
 * https://github.com/anthropics → anthropics
 * https://google.com → Google
 * https://youtube.com/watch?v=xxx → youtube
 */
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.replace('www.', '');

    // 获取路径中的有意义部分（如 github.com/user/repo → user）
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);

    if (pathParts.length >= 2) {
      // 有多级路径，取第二部分（如 /anthropics/code → anthropics）
      return pathParts[1];
    }

    // 只有域名，去掉 .com 等后缀
    const name = hostname.split('.')[0];
    // 首字母大写
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return '';
  }
}

export function ShortcutDialog({ open, onOpenChange, shortcut, onSave, quickMode = false }: ShortcutDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('');
  const [urlInputKey, setUrlInputKey] = useState(0); // 用于重置输入框聚焦
  const isEditing = !!shortcut;

  // 当打开弹窗时，初始化表单数据
  useEffect(() => {
    if (open) {
      if (shortcut) {
        setName(shortcut.name);
        setUrl(shortcut.url);
        setIcon(shortcut.icon || '');
      } else {
        setName('');
        setUrl('');
        setIcon('');
      }
      // 快捷模式下，每次打开都重置并聚焦URL输入框
      if (quickMode && !shortcut) {
        setUrlInputKey(k => k + 1);
        setTimeout(() => {
          const input = document.getElementById('quick-url-input');
          if (input) input.focus();
        }, 50);
      }
    }
  }, [open, shortcut, quickMode]);

  // URL变化时自动提取name
  useEffect(() => {
    if (quickMode && url && !shortcut) {
      const extractedName = extractNameFromUrl(url);
      if (extractedName && !name) {
        setName(extractedName);
      }
    }
  }, [url, quickMode, shortcut]);

  // 预览图标（直接使用 Google Favicon URL）
  const previewIcon = url ? getGoogleFaviconUrl(extractDomain(url), 64) : '';

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    // 不传 icon，让 ShortcutCard 通过三级 fallback 自己获取和缓存
    onSave({
      name: name.trim(),
      url: url.trim(),
    });

    onOpenChange(false);
  };

  // 快捷模式：输入框回车直接提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // URL 或名称有内容就能提交
      if (url.trim() || name.trim()) {
        handleSubmit();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={quickMode ? 'sm:max-w-[480px]' : 'sm:max-w-[425px]'}>
        {quickMode ? (
          // 快捷模式：极简布局，无图标预览
          <div className="flex items-center gap-3 py-2">
            {/* 加号占位 */}
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <span className="text-2xl font-bold text-primary/50">+</span>
            </div>
            {/* 输入框 */}
            <div className="flex-1 flex items-center gap-2">
              <Input
                key={`quick-url-${urlInputKey}`}
                id="quick-url-input"
                placeholder={t('shortcuts.quickPlaceholder')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 h-10"
              />
              <Input
                placeholder={t('shortcuts.quickNamePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-28 h-10"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleSubmit()}
                disabled={!url.trim()}
                className="h-10 px-4"
              >
                {t('shortcuts.quickAdd')}
              </Button>
            </div>
          </div>
        ) : (
          // 普通模式：完整表单
          <>
            <DialogHeader>
              <DialogTitle>{isEditing ? t('shortcuts.editTitle') : t('shortcuts.addTitle')}</DialogTitle>
              <DialogDescription>
                {isEditing ? t('shortcuts.editDescription') : t('shortcuts.addDescription')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t('shortcuts.name')}</Label>
                  <Input
                    id="name"
                    placeholder={t('shortcuts.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="url">{t('shortcuts.url')}</Label>
                  <Input
                    id="url"
                    placeholder={t('shortcuts.urlPlaceholder')}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                {/* 图标预览 */}
                {previewIcon && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{t('shortcuts.iconPreview')}</span>
                    <img
                      src={previewIcon}
                      alt="Favicon"
                      className="w-8 h-8 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={!name.trim() || !url.trim()}>
                  {isEditing ? t('common.save') : t('common.add')}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
