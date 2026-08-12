import { useState, useMemo } from 'react';
import { Plus, Trash2, X, Move, Search, Download } from 'lucide-react';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { ShortcutGroupCard } from './ShortcutGroupCard';
import { ShortcutCard } from './ShortcutCard';
import { ShortcutDialog } from './ShortcutDialog';
import { GroupDialog } from './GroupDialog';
import { MigrateDialog } from './MigrateDialog';
import { ImportExportDialog } from './ImportExportDialog';
import { useDebounce } from '@/src/hooks/useDebounce';
import { UI_CONFIG } from '@/src/utils/constants';
import type { Shortcut, ShortcutGroup } from '@/src/utils/types';

interface GroupLayoutProps {
  groups: ShortcutGroup[];
  shortcuts: Shortcut[];
  bookmarksDirty?: boolean;
  onToggleGroupExpand: (id: string) => void;
  onAddGroup: (data: { name: string; color?: string }) => void;
  onUpdateGroup: (id: string, data: Partial<Omit<ShortcutGroup, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  onRemoveGroup: (id: string) => void;
  onAddShortcutToGroup: (groupId: string, shortcutId: string) => void;
  onAddShortcut: (data: { name: string; url: string }) => Promise<Shortcut>;
  onAddShortcuts?: (items: { name: string; url: string }[]) => Promise<number>;
  onUpdateShortcut: (id: string, data: Partial<Omit<Shortcut, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  onRemoveShortcut: (id: string) => void;
  onBatchRemoveShortcuts?: (ids: string[]) => void;
  onMoveShortcutsToGroup?: (sourceGroupId: string | null, targetGroupId: string | null, shortcutIds: string[]) => void;
  onImportData?: (shortcuts: Shortcut[], groups: ShortcutGroup[]) => void;
  onReorderGroups?: (activeId: string, overId: string) => void;
  onReorderShortcutsInGroup?: (groupId: string, activeId: string, overId: string) => void;
  getUngroupedShortcutIds: (ids: string[]) => string[];
}

// 可排序的分组卡片包装器
interface SortableGroupCardProps {
  group: ShortcutGroup;
  shortcuts: Shortcut[];
  allGroups: ShortcutGroup[];
  onToggleExpand: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onAddShortcut: () => void;
  onEditShortcut: (shortcut: Shortcut) => void;
  onRemoveShortcut: (id: string) => void;
  onBatchRemoveShortcuts?: (ids: string[]) => void;
  onMigrateShortcuts?: (targetGroupId: string | null, shortcutIds: string[]) => void;
  onReorderShortcutsInGroup?: (groupId: string, activeId: string, overId: string) => void;
}

function SortableGroupCard({
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
}: SortableGroupCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ShortcutGroupCard
        group={group}
        shortcuts={shortcuts}
        allGroups={allGroups}
        onToggleExpand={onToggleExpand}
        onEdit={onEdit}
        onRemove={onRemove}
        onAddShortcut={onAddShortcut}
        onEditShortcut={onEditShortcut}
        onRemoveShortcut={onRemoveShortcut}
        onBatchRemoveShortcuts={onBatchRemoveShortcuts}
        onMigrateShortcuts={onMigrateShortcuts}
        onReorderShortcutsInGroup={onReorderShortcutsInGroup}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

export function GroupLayout({
  groups,
  shortcuts,
  bookmarksDirty,
  onToggleGroupExpand,
  onAddGroup,
  onUpdateGroup,
  onRemoveGroup,
  onAddShortcutToGroup,
  onAddShortcut,
  onAddShortcuts,
  onUpdateShortcut,
  onRemoveShortcut,
  onBatchRemoveShortcuts,
  onMoveShortcutsToGroup,
  onImportData,
  onReorderGroups,
  onReorderShortcutsInGroup,
  getUngroupedShortcutIds,
}: GroupLayoutProps) {
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);
  const [importExportDialogOpen, setImportExportDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ShortcutGroup | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 防抖搜索
  const debouncedQuery = useDebounce(searchQuery, UI_CONFIG.SEARCH_DEBOUNCE_DELAY);

  // 未分组批量管理状态
  const [isUngroupedSelectMode, setIsUngroupedSelectMode] = useState(false);
  const [ungroupedSelectedIds, setUngroupedSelectedIds] = useState<Set<string>>(new Set());
  const [ungroupedMigrateDialogOpen, setUngroupedMigrateDialogOpen] = useState(false);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 需要移动5px才开始拖拽，避免误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 拖拽结束处理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      onReorderGroups?.(active.id as string, over.id as string);
    }
  };

  // 获取分组内的快捷方式（按照 group.shortcutIds 的顺序）
  const getGroupShortcuts = (group: ShortcutGroup): Shortcut[] => {
    const result = group.shortcutIds
      .map(id => shortcuts.find(s => s.id === id))
      .filter((s): s is Shortcut => s !== undefined);
    console.log('[GroupLayout] getGroupShortcuts', group.name, 'shortcutIds:', group.shortcutIds, 'result:', result.map(s => s.name));
    return result;
  };

  // 获取未分组的快捷方式（使用 useMemo 避免重复计算）
  const ungroupedShortcuts = useMemo(() => {
    const ids = getUngroupedShortcutIds(shortcuts.map(s => s.id));
    return shortcuts.filter(s => ids.includes(s.id));
  }, [shortcuts, getUngroupedShortcutIds]);

  // 搜索过滤逻辑
  const filteredData = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return {
        groups: groups.map(group => ({
          group,
          shortcuts: getGroupShortcuts(group),
        })),
        ungroupedShortcuts,
        totalResults: shortcuts.length,
      };
    }

    const query = debouncedQuery.toLowerCase();
    const matchesSearch = (s: Shortcut) =>
      s.name.toLowerCase().includes(query) ||
      s.url.toLowerCase().includes(query);

    // 过滤分组
    const filteredGroups = groups.map(group => {
      const groupShortcuts = getGroupShortcuts(group).filter(matchesSearch);
      return { group, shortcuts: groupShortcuts };
    }).filter(item => item.shortcuts.length > 0);

    // 过滤未分组
    const filteredUngrouped = ungroupedShortcuts.filter(matchesSearch);

    const totalResults = filteredGroups.reduce((sum, item) => sum + item.shortcuts.length, 0) + filteredUngrouped.length;

    return {
      groups: filteredGroups,
      ungroupedShortcuts: filteredUngrouped,
      totalResults,
    };
  }, [groups, shortcuts, ungroupedShortcuts, debouncedQuery]);

  // 添加分组
  const handleAddGroup = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  };

  // 编辑分组
  const handleEditGroup = (group: ShortcutGroup) => {
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  // 保存分组
  const handleSaveGroup = (data: { name: string; color?: string }) => {
    if (editingGroup) {
      onUpdateGroup(editingGroup.id, data);
    } else {
      onAddGroup(data);
    }
  };

  // 添加快捷方式到分组
  const handleAddShortcutToGroup = (groupId: string) => {
    setCurrentGroupId(groupId);
    setEditingShortcut(null);
    setIsQuickMode(true);
    setShortcutDialogOpen(true);
  };

  // 添加未分组快捷方式
  const handleAddUngroupedShortcut = () => {
    setCurrentGroupId(null);
    setEditingShortcut(null);
    setIsQuickMode(true);
    setShortcutDialogOpen(true);
  };

  // 保存快捷方式（区分新建和编辑）
  const handleSaveShortcut = async (data: { name: string; url: string }) => {
    if (editingShortcut) {
      // 编辑模式：更新现有快捷方式
      onUpdateShortcut(editingShortcut.id, data);
    } else {
      // 新建模式：创建新快捷方式
      const shortcut = await onAddShortcut(data);
      // 如果是在分组内添加，则添加到分组
      if (currentGroupId && shortcut) {
        onAddShortcutToGroup(currentGroupId, shortcut.id);
      }
    }
  };

  // 未分组批量选择
  const toggleUngroupedSelect = (id: string) => {
    const newSelected = new Set(ungroupedSelectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setUngroupedSelectedIds(newSelected);
  };

  const toggleUngroupedSelectMode = () => {
    setIsUngroupedSelectMode(!isUngroupedSelectMode);
    setUngroupedSelectedIds(new Set());
  };

  const handleUngroupedSelectAll = () => {
    if (ungroupedSelectedIds.size === ungroupedShortcuts.length) {
      setUngroupedSelectedIds(new Set());
    } else {
      setUngroupedSelectedIds(new Set(ungroupedShortcuts.map(s => s.id)));
    }
  };

  const handleUngroupedBatchDelete = () => {
    if (ungroupedSelectedIds.size === 0) return;
    if (onBatchRemoveShortcuts) {
      onBatchRemoveShortcuts(Array.from(ungroupedSelectedIds));
    } else {
      ungroupedSelectedIds.forEach(id => onRemoveShortcut(id));
    }
    setUngroupedSelectedIds(new Set());
    setIsUngroupedSelectMode(false);
  };

  const handleUngroupedMigrate = (targetGroupId: string | null) => {
    if (ungroupedSelectedIds.size === 0 || !onMoveShortcutsToGroup) return;
    onMoveShortcutsToGroup(null, targetGroupId, Array.from(ungroupedSelectedIds));
    setUngroupedSelectedIds(new Set());
    setIsUngroupedSelectMode(false);
  };

  return (
    <div className="w-full max-w-4xl space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="搜索快捷方式..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 bg-white/10 dark:bg-black/10 backdrop-blur-xl border border-white/20 dark:border-black/10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-sm"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setImportExportDialogOpen(true)}
              title="导入导出"
            >
              <Download className="w-4 h-4" />
            </Button>
            {bookmarksDirty && (
              <span
                title="有未同步到云端的本地书签,点开上传"
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-background"
              />
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleAddGroup}>
            <Plus className="w-4 h-4 mr-1" />
            新建分组
          </Button>
        </div>
      </div>

      {/* 搜索结果提示 */}
      {debouncedQuery.trim() && (
        <div className="text-sm text-muted-foreground">
          {filteredData.totalResults > 0
            ? `找到 ${filteredData.totalResults} 个结果`
            : '无匹配结果'}
        </div>
      )}

      {/* 分组列表 - 固定高度，内部滚动 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredData.groups.map(g => g.group.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4 scroll-container max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
            {filteredData.groups.map(({ group, shortcuts: groupShortcuts }) => (
              <SortableGroupCard
                key={group.id}
                group={group}
                shortcuts={groupShortcuts}
                allGroups={groups}
                onToggleExpand={() => onToggleGroupExpand(group.id)}
                onEdit={() => handleEditGroup(group)}
                onRemove={() => onRemoveGroup(group.id)}
                onAddShortcut={() => handleAddShortcutToGroup(group.id)}
                onEditShortcut={(shortcut) => {
                  setEditingShortcut(shortcut);
                  setIsQuickMode(false); // 编辑时使用完整表单模式
                  setShortcutDialogOpen(true);
                }}
                onRemoveShortcut={onRemoveShortcut}
                onBatchRemoveShortcuts={onBatchRemoveShortcuts}
                onMigrateShortcuts={(targetGroupId, shortcutIds) => {
                  onMoveShortcutsToGroup?.(group.id, targetGroupId, shortcutIds);
                }}
                onReorderShortcutsInGroup={onReorderShortcutsInGroup}
              />
            ))}

        {/* 未分组的快捷方式 */}
        {(filteredData.ungroupedShortcuts.length > 0 || (isUngroupedSelectMode && !debouncedQuery.trim())) && (
          <div className="rounded-xl border border-dashed border-white/20 dark:border-black/10 bg-white/10 dark:bg-black/10 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/20">
            <div className="sticky top-0 z-10 flex items-center justify-between p-3 border-b border-white/20 dark:border-black/10 bg-white/5 dark:bg-black/5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                {isUngroupedSelectMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleUngroupedSelectAll}
                    >
                      <Checkbox
                        checked={ungroupedSelectedIds.size === ungroupedShortcuts.length && ungroupedShortcuts.length > 0}
                        onCheckedChange={handleUngroupedSelectAll}
                        className="mr-1 h-3 w-3"
                      />
                      {ungroupedSelectedIds.size === ungroupedShortcuts.length ? '取消' : '全选'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      已选择 {ungroupedSelectedIds.size} 项
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-sm text-muted-foreground">
                      未分组
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({ungroupedShortcuts.length})
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isUngroupedSelectMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setUngroupedMigrateDialogOpen(true)}
                      disabled={ungroupedSelectedIds.size === 0}
                    >
                      <Move className="w-3 h-3 mr-1" />
                      迁移
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleUngroupedBatchDelete}
                      disabled={ungroupedSelectedIds.size === 0}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      删除
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={toggleUngroupedSelectMode}
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
                      onClick={toggleUngroupedSelectMode}
                    >
                      批量管理
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleAddUngroupedShortcut}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                {filteredData.ungroupedShortcuts.map((shortcut) => (
                  <div key={shortcut.id} className="relative">
                    {isUngroupedSelectMode && (
                      <div className="absolute top-1 left-1 z-10">
                        <Checkbox
                          checked={ungroupedSelectedIds.has(shortcut.id)}
                          onCheckedChange={() => toggleUngroupedSelect(shortcut.id)}
                          className="bg-background border-white/20 dark:border-black/10"
                        />
                      </div>
                    )}
                    <ShortcutCard
                      shortcut={shortcut}
                      onEdit={(s) => {
                        setEditingShortcut(s);
                        setIsQuickMode(false); // 编辑时使用完整表单模式
                        setShortcutDialogOpen(true);
                      }}
                      onRemove={onRemoveShortcut}
                      isSelectMode={isUngroupedSelectMode}
                      isSelected={ungroupedSelectedIds.has(shortcut.id)}
                      onSelect={() => toggleUngroupedSelect(shortcut.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 空状态 */}
        {filteredData.groups.length === 0 && filteredData.ungroupedShortcuts.length === 0 && (
          debouncedQuery.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">无匹配结果</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm mb-4">暂无快捷方式</p>
              <Button variant="outline" onClick={handleAddUngroupedShortcut}>
                <Plus className="w-4 h-4 mr-1" />
                添加快捷方式
              </Button>
            </div>
          )
        )}
      </div>
        </SortableContext>
      </DndContext>

      {/* 分组弹窗 */}
      <GroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        group={editingGroup}
        onSave={handleSaveGroup}
      />

      {/* 快捷方式弹窗 */}
      <ShortcutDialog
        open={shortcutDialogOpen}
        onOpenChange={setShortcutDialogOpen}
        shortcut={editingShortcut}
        onSave={handleSaveShortcut}
        quickMode={isQuickMode}
      />

      {/* 未分组迁移弹窗 */}
      <MigrateDialog
        open={ungroupedMigrateDialogOpen}
        onOpenChange={setUngroupedMigrateDialogOpen}
        groups={groups}
        currentGroupId={null}
        onMigrate={handleUngroupedMigrate}
        selectedCount={ungroupedSelectedIds.size}
      />

      {/* 导入导出弹窗 */}
      <ImportExportDialog
        open={importExportDialogOpen}
        onOpenChange={setImportExportDialogOpen}
        shortcuts={shortcuts}
        groups={groups}
        onImport={(newShortcuts, newGroups) => {
          onImportData?.(newShortcuts, newGroups);
        }}
        addShortcuts={async (items) => {
          if (!onAddShortcuts) {
            // fallback: 逐个添加
            for (const item of items) {
              await onAddShortcut(item);
            }
            return items.length;
          }
          return onAddShortcuts(items);
        }}
      />
    </div>
  );
}
