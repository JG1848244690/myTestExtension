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

interface MigrateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ShortcutGroup[];
  currentGroupId: string | null; // null 表示当前在"未分组"
  onMigrate: (targetGroupId: string | null) => void;
  selectedCount: number;
}

export function MigrateDialog({
  open,
  onOpenChange,
  groups,
  currentGroupId,
  onMigrate,
  selectedCount,
}: MigrateDialogProps) {
  const { t } = useI18n();
  const handleSelect = (targetGroupId: string | null) => {
    onMigrate(targetGroupId);
    onOpenChange(false);
  };

  // 过滤掉当前分组
  const availableGroups = groups.filter(g => g.id !== currentGroupId);

  const groupColorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    cyan: 'bg-cyan-500',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{t('groups.migrateTitle')}</DialogTitle>
          <DialogDescription>
            {t('groups.migrateDesc', { n: selectedCount })}
          </DialogDescription>
        </DialogHeader>
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
