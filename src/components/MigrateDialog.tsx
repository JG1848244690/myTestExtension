import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import type { ShortcutGroup } from '@/src/utils/types';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n';

/** 模式:迁移(source 移除)/ 复制(source 保留) */
type Mode = 'move' | 'copy';

interface MigrateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ShortcutGroup[];
  currentGroupId: string | null; // null 表示当前在"未分组"
  onMigrate: (targetGroupId: string | null) => void;
  onCopy?: (targetGroupId: string | null) => void;
  selectedCount: number;
}

export function MigrateDialog({
  open,
  onOpenChange,
  groups,
  currentGroupId,
  onMigrate,
  onCopy,
  selectedCount,
}: MigrateDialogProps) {
  const { t } = useI18n();
  // 复制模式可选 — 没传 onCopy 时回退到迁移模式
  const canCopy = !!onCopy;
  const [mode, setMode] = useState<Mode>('move');

  const handleSelect = (targetGroupId: string | null) => {
    if (mode === 'copy' && onCopy) {
      onCopy(targetGroupId);
    } else {
      onMigrate(targetGroupId);
    }
    onOpenChange(false);
  };

  // 过滤掉当前分组(自己不能迁/复制到自己)
  const availableGroups = groups.filter(g => g.id !== currentGroupId);

  const groupColorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    cyan: 'bg-cyan-500',
  };

  const title = mode === 'copy' ? t('groups.copyTitle') : t('groups.migrateTitle');
  const desc = mode === 'copy'
    ? t('groups.copyDesc', { n: selectedCount })
    : t('groups.migrateDesc', { n: selectedCount });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        {/* 模式 tab(只在允许复制时显示) */}
        {canCopy && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted/50 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('move')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                mode === 'move'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('groups.modeMove')}
            </button>
            <button
              type="button"
              onClick={() => setMode('copy')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                mode === 'copy'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('groups.modeCopy')}
            </button>
          </div>
        )}

        <div className="max-h-[300px] overflow-y-auto overflow-x-hidden mt-2">
          <div className="space-y-1">
            {/* 未分组选项 - 仅当不在未分组时显示 */}
            {currentGroupId !== null && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleSelect(null)}
              >
                <div className="w-4 h-4 rounded bg-muted border border-dashed border-white/20 dark:border-black/10" />
                <span>{t('groups.ungrouped')}</span>
              </Button>
            )}

            {/* 分组列表 */}
            {availableGroups.map((group) => (
              <Button
                key={group.id}
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleSelect(group.id)}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded",
                    group.color ? groupColorMap[group.color] : 'bg-muted'
                  )}
                />
                <div className="flex flex-col items-start">
                  <span>{group.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('groups.shortcutCount', { n: group.shortcutIds.length })}
                  </span>
                </div>
              </Button>
            ))}

            {availableGroups.length === 0 && currentGroupId === null && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {t('groups.noMigrateTarget')}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}