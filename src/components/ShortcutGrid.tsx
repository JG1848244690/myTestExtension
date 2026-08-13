import { useState, useMemo } from 'react';
import { Plus, Trash2, X, Search } from 'lucide-react';
import { ShortcutCard } from './ShortcutCard';
import { ShortcutDialog } from './ShortcutDialog';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { useDebounce } from '@/src/hooks/useDebounce';
import { UI_CONFIG } from '@/src/utils/constants';
import type { Shortcut, LayoutType } from '@/src/utils/types';
import { useI18n } from '@/src/i18n';

interface ShortcutGridProps {
  shortcuts: Shortcut[];
  layout?: LayoutType;
  onLayoutChange?: (layout: LayoutType) => void;
  onAdd: (data: { name: string; url: string; icon?: string }) => void;
  onUpdate: (id: string, data: Partial<Omit<Shortcut, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  onRemove: (id: string) => void;
  onBatchRemove?: (ids: string[]) => void;
}

export function ShortcutGrid({
  shortcuts,
  onAdd,
  onUpdate,
  onRemove,
  onBatchRemove
}: ShortcutGridProps) {
  const { t } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 防抖搜索
  const debouncedQuery = useDebounce(searchQuery, UI_CONFIG.SEARCH_DEBOUNCE_DELAY);

  // 过滤快捷方式
  const filteredShortcuts = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return shortcuts;
    }
    const query = debouncedQuery.toLowerCase();
    return shortcuts.filter(
      s => s.name.toLowerCase().includes(query) ||
           s.url.toLowerCase().includes(query)
    );
  }, [shortcuts, debouncedQuery]);

  const handleAddClick = () => {
    setEditingShortcut(null);
    setIsQuickMode(true); // 网格中的添加按钮使用快捷模式
    setDialogOpen(true);
  };

  const handleEditClick = (shortcut: Shortcut) => {
    setEditingShortcut(shortcut);
    setDialogOpen(true);
  };

  const handleSave = (data: { name: string; url: string; icon?: string }) => {
    if (editingShortcut) {
      onUpdate(editingShortcut.id, data);
    } else {
      onAdd(data);
    }
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredShortcuts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredShortcuts.map(s => s.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (onBatchRemove) {
      onBatchRemove(Array.from(selectedIds));
    } else {
      // 降级：逐个删除
      selectedIds.forEach(id => onRemove(id));
    }
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  return (
    <div className="w-full max-w-4xl">
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          {isSelectMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                <Checkbox
                  checked={selectedIds.size === filteredShortcuts.length && filteredShortcuts.length > 0}
                  onCheckedChange={handleSelectAll}
                  className="mr-2"
                />
                {selectedIds.size === filteredShortcuts.length ? t('common.deselectAll') : t('common.selectAll')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('common.selectedCount', { n: selectedIds.size })}
              </span>
            </>
          ) : (
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('shortcuts.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9"
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
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSelectMode ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t('shortcuts.deleteSelected', { n: selectedIds.size })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectMode}
              >
                <X className="w-4 h-4 mr-1" />
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <>
              {shortcuts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectMode}
                >
                  {t('common.batchManage')}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddClick}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('common.add')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 固定三行的网格容器 */}
      <div className="relative">
        {/* 搜索结果提示 */}
        {debouncedQuery.trim() && (
          <div className="mb-2 text-sm text-muted-foreground">
            {filteredShortcuts.length > 0
              ? t('common.foundResults', { n: filteredShortcuts.length })
              : t('common.noResults')}
          </div>
        )}

        {/* 网格容器 - 固定高度，内部滚动 */}
        <div
          className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-70 overflow-y-auto overflow-x-hidden p-1 pt-2 scroll-container"
        >
          {filteredShortcuts.map((shortcut) => (
            <div key={shortcut.id} className="relative">
              {isSelectMode && (
                <div className="absolute top-1 left-1 z-10">
                  <Checkbox
                    checked={selectedIds.has(shortcut.id)}
                    onCheckedChange={() => toggleSelect(shortcut.id)}
                    className="bg-background border-white/20 dark:border-black/10"
                  />
                </div>
              )}
              <ShortcutCard
                shortcut={shortcut}
                onEdit={handleEditClick}
                onRemove={onRemove}
                isSelectMode={isSelectMode}
                isSelected={selectedIds.has(shortcut.id)}
                onSelect={() => toggleSelect(shortcut.id)}
              />
            </div>
          ))}

          {/* 添加按钮 - 非选择模式且无搜索时显示 */}
          {!isSelectMode && !debouncedQuery.trim() && (
            <Button
              variant="outline"
              onClick={handleAddClick}
              className="flex flex-col items-center justify-center p-4 rounded-xl h-[100px] border-dashed border-2 hover:border-primary/50 hover:bg-accent/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="mt-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                {t('common.add')}
              </span>
            </Button>
          )}
        </div>

        {/* 滚动提示 - 当内容超出时显示渐变 */}
        {filteredShortcuts.length > 24 && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      <ShortcutDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        shortcut={editingShortcut}
        onSave={handleSave}
        quickMode={isQuickMode}
      />
    </div>
  );
}
