import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, FolderOpen, Move, X, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { MigrateDialog } from './MigrateDialog';
import { ShortcutCard } from './ShortcutCard';
import type { Shortcut, ShortcutGroup } from '@/src/utils/types';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n';

// 可排序的快捷方式卡片包装器
interface SortableShortcutCardProps {
  id: string; // 带组前缀的唯一ID，格式: ${groupId}-${shortcutId}
  shortcut: Shortcut;
  onEdit: (shortcut: Shortcut) => void;
  onRemove: (id: string) => void;
  isSelectMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function SortableShortcutCard({
  id,
  shortcut,
  onEdit,
  onRemove,
  isSelectMode,
  isSelected,
  onSelect,
}: SortableShortcutCardProps) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative", isDragging && "z-50")}>
      {/* 拖拽手柄 */}
      {!isSelectMode && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-1 right-1 z-20 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-muted"
          aria-label={t('common.dragToReorder')}
        >
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
      {/* 选择模式的 checkbox */}
      {isSelectMode && (
        <div className="absolute top-1 left-1 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="bg-background border-white/20 dark:border-black/10"
          />
        </div>
      )}
      <div className={cn(isDragging && "opacity-50")}>
        <ShortcutCard
          shortcut={shortcut}
          onEdit={onEdit}
          onRemove={onRemove}
          isSelectMode={isSelectMode}
          isSelected={isSelected}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

interface ShortcutGroupCardProps {
  group: ShortcutGroup;
  shortcuts: Shortcut[];
  allGroups: ShortcutGroup[]; // 所有分组，用于迁移
  onToggleExpand: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onAddShortcut: () => void;
  onEditShortcut: (shortcut: Shortcut) => void;
  onRemoveShortcut: (id: string) => void;
  onBatchRemoveShortcuts?: (ids: string[]) => void;
  onMigrateShortcuts?: (targetGroupId: string | null, shortcutIds: string[]) => void;
  onReorderShortcutsInGroup?: (groupId: string, activeId: string, overId: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>; // 拖拽手柄 props（用于分组拖拽）
  isDragging?: boolean; // 分组是否被拖拽
}

export function ShortcutGroupCard({
  group,
  shortcuts,
  allGroups,
  onToggleExpand,
  onEdit,
  onRemove,
  onAddShortcut,
  onEditShortcut,
  onRemoveShortcut,
  onBatchRemoveShortcuts,
  onMigrateShortcuts,
  onReorderShortcutsInGroup,
  dragHandleProps,
  isDragging,
}: ShortcutGroupCardProps) {
  const { t } = useI18n();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);

  // 组内拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 需要移动5px才开始拖拽
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 生成带组前缀的唯一ID
  const sortableIds = shortcuts.map(s => `${group.id}-${s.id}`);

  // 组内拖拽结束处理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    console.log('[ShortcutGroupCard] handleDragEnd', { active: active.id, over: over?.id });

    if (over && active.id !== over.id) {
      // 解析真实ID
      const prefix = `${group.id}-`;
      const activeShortcutId = String(active.id).replace(prefix, '');
      const overShortcutId = String(over.id).replace(prefix, '');

      console.log('[ShortcutGroupCard] calling onReorderShortcutsInGroup', {
        groupId: group.id,
        activeShortcutId,
        overShortcutId,
      });

      onReorderShortcutsInGroup?.(group.id, activeShortcutId, overShortcutId);
    }
  };

  const groupColorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  };

  const colorClass = group.color ? groupColorMap[group.color] || '' : '';

  // sticky 头部背景色映射
  const stickyBgMap: Record<string, string> = {
    blue: 'bg-blue-500/20',
    green: 'bg-green-500/20',
    purple: 'bg-purple-500/20',
    orange: 'bg-orange-500/20',
    red: 'bg-red-500/20',
    cyan: 'bg-cyan-500/20',
  };
  const stickyBg = group.color ? stickyBgMap[group.color] || 'bg-muted/80' : 'bg-muted/80';

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds(new Set());
  };

  const handleSelectAll = () => {
    if (selectedIds.size === shortcuts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shortcuts.map(s => s.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (onBatchRemoveShortcuts) {
      onBatchRemoveShortcuts(Array.from(selectedIds));
    } else {
      selectedIds.forEach(id => onRemoveShortcut(id));
    }
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  const handleMigrate = (targetGroupId: string | null) => {
    if (selectedIds.size === 0 || !onMigrateShortcuts) return;
    onMigrateShortcuts(targetGroupId, Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  return (
    <div className={cn(
      "rounded-xl border bg-gradient-to-br transition-opacity",
      "bg-white/10 dark:bg-black/10 backdrop-blur-xl",
      "shadow-lg shadow-black/5 dark:shadow-black/20",
      isDragging && "opacity-50",
      colorClass || 'from-muted/50 to-muted/30 border-white/20 dark:border-black/10'
    )}>
      {/* 分组头部 - sticky 吸顶 */}
      <div className={cn(
        "sticky top-0 z-10 flex items-center justify-between p-3 backdrop-blur-sm rounded-t-xl",
        "bg-white/5 dark:bg-black/5"
      )}>
        <div className="flex items-center gap-1">
          {/* 拖拽手柄 */}
          {dragHandleProps && (
            <button
              {...dragHandleProps}
              className="flex items-center justify-center p-1 hover:bg-muted/50 rounded cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t('common.dragToReorder')}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
          {group.isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{group.name}</span>
          <span className="text-xs text-muted-foreground">
            ({shortcuts.length})
          </span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {isSelectMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={handleSelectAll}
              >
                <Checkbox
                  checked={selectedIds.size === shortcuts.length && shortcuts.length > 0}
                  onCheckedChange={handleSelectAll}
                  className="mr-1 h-3 w-3"
                />
                {selectedIds.size === shortcuts.length ? t('common.deselectAll') : t('common.selectAll')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => setMigrateDialogOpen(true)}
                disabled={selectedIds.size === 0}
              >
                <Move className="w-3 h-3 mr-1" />
                {t('common.migrate')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-2"
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                {t('common.delete')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={toggleSelectMode}
              >
                <X className="w-3 h-3" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  if (!group.isExpanded) {
                    onToggleExpand();
                  }
                  setTimeout(() => toggleSelectMode(), 100);
                }}
                disabled={shortcuts.length === 0}
              >
                {t('common.batchManage')}
              </Button>
              {group.isExpanded && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={onAddShortcut}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <span className="text-xs">⋯</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t('groups.editGroup')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* 选择模式提示 */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="px-3 py-1 bg-primary/10 text-xs text-primary border-b border-white/20 dark:border-black/10">
          {t('common.selectedCount', { n: selectedIds.size })}
        </div>
      )}

      {/* 分组内容 */}
      {group.isExpanded && (
        <div className="p-3">
          {shortcuts.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {shortcuts.map((shortcut) => {
                    const sortableId = `${group.id}-${shortcut.id}`;
                    return (
                      <SortableShortcutCard
                        key={sortableId}
                        id={sortableId}
                        shortcut={shortcut}
                        onEdit={onEditShortcut}
                        onRemove={onRemoveShortcut}
                        isSelectMode={isSelectMode}
                        isSelected={selectedIds.has(shortcut.id)}
                        onSelect={() => toggleSelect(shortcut.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FolderOpen className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">{t('groups.empty')}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onAddShortcut}
              >
                <Plus className="w-3 h-3 mr-1" />
                {t('groups.addShortcut')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 迁移弹窗 */}
      <MigrateDialog
        open={migrateDialogOpen}
        onOpenChange={setMigrateDialogOpen}
        groups={allGroups}
        currentGroupId={group.id}
        onMigrate={handleMigrate}
        selectedCount={selectedIds.size}
      />
    </div>
  );
}
