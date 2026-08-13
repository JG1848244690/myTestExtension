/**
 * 底部 macOS 风格 dock 栏布局
 *
 * 替代 GroupLayout 的"分组卡片"布局,中央留出搜索框空间,让视频/图片背景
 * 成为视觉主体。底层用 react-osx-dock 处理 magnification 动画。
 *
 * 内容显示:
 *   - 顶部固定搜索框(由父组件 App.tsx 渲染)
 *   - 底部 dock 栏(fixed bottom,水平居中)
 *   - dock 显示未分组的快捷方式(同 GroupLayout 的 ungrouped 概念)
 *   - 分组处理:暂时不显示在 dock 里,简化布局(后续可加"分组弹出")
 *
 * 交互:
 *   - 点击:window.open 打开网址
 *   - 拖拽:@dnd-kit/sortable 排序(沿用 GroupLayout 的 onReorderShortcuts)
 *   - hover:react-osx-dock 处理 magnification
 */

import { useEffect, useState } from 'react';
import { Dock } from 'react-osx-dock';
import { Search, Plus } from 'lucide-react';
import { useDebounce } from '@/src/hooks/useDebounce';
import { UI_CONFIG } from '@/src/utils/constants';
import type { Shortcut, ShortcutGroup } from '@/src/utils/types';
import { notifyNewtabNavigated } from '@/src/utils/navigationReset';
import { cn } from '@/src/lib/utils';
import { useI18n } from '@/src/i18n';
import {
  getFaviconWithFallback,
  generateInitialFallback,
} from '@/src/utils/faviconCache';

interface DockLayoutProps {
  shortcuts: Shortcut[];
  groups: ShortcutGroup[];
  /** 未分组快捷方式 id 列表(从 useGroupsStore.getUngroupedShortcutIds 来) */
  ungroupedIds: string[];
  onAdd: (data: { name: string; url: string; icon?: string }) => void;
  onUpdate: (id: string, data: Partial<Omit<Shortcut, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  onRemove: (id: string) => void;
  onBatchRemove?: (ids: string[]) => void;
  onMoveShortcutsToGroup?: (sourceGroupId: string | null, targetGroupId: string | null, shortcutIds: string[]) => void;
  // 暂时不接 onReorderShortcuts:group 模式排序由 GroupLayout 处理;
  // dock 内排序需要 ungrouped reorder API(useGroupsStore 还没有),后续补
  onAddGroup: (data: { name: string; color?: string }) => void;
  onImportData?: (shortcuts: Shortcut[], groups: ShortcutGroup[]) => void;
}

// 单个 dock item,简化为 click-only(排序暂不接,dock 内拖拽后续补 ungrouped reorder API)
function DockItem({ shortcut }: { shortcut: Shortcut }) {
  const [faviconSrc, setFaviconSrc] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    getFaviconWithFallback(shortcut.url, shortcut.name)
      .then(({ src }) => {
        if (mounted) setFaviconSrc(src);
      })
      .catch(() => {
        if (mounted) setFaviconSrc(generateInitialFallback(shortcut.name));
      });
    return () => {
      mounted = false;
    };
  }, [shortcut.url, shortcut.name]);

  return (
    <button
      onClick={() => {
        window.open(shortcut.url, '_blank');
        notifyNewtabNavigated();
      }}
      title={shortcut.name}
      className={cn(
        'w-12 h-12 rounded-2xl cursor-pointer',
        'bg-white/10 dark:bg-black/20 backdrop-blur-xl',
        'border border-white/20 dark:border-black/10',
        'flex items-center justify-center overflow-hidden',
        'shadow-md shadow-black/20',
        'hover:shadow-xl hover:shadow-black/30'
      )}
    >
      {faviconSrc ? (
        <img
          src={faviconSrc}
          alt={shortcut.name}
          className="w-7 h-7 rounded"
          draggable={false}
        />
      ) : (
        <span className="text-sm font-bold text-primary">
          {shortcut.name.charAt(0).toUpperCase()}
        </span>
      )}
    </button>
  );
}

export function DockLayout({
  shortcuts,
  ungroupedIds,
  onAdd,
  onAddGroup,
}: DockLayoutProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, UI_CONFIG.SEARCH_DEBOUNCE_DELAY);

  // 列出未分组 + 搜索过滤
  const dockShortcuts = ungroupedIds
    .map((id) => shortcuts.find((s) => s.id === id))
    .filter((s): s is Shortcut => s !== undefined)
    .filter((s) => {
      if (!debouncedQuery.trim()) return true;
      const q = debouncedQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q);
    });

  return (
    <div className="w-full min-h-screen flex flex-col items-center px-8 pt-8">
      {/* dock 内部嵌入的"搜索框"(为了 dock 模式下搜索框仍可访问)
          主搜索框在 App.tsx 渲染,这里只是 backup(放在右上角) */}
      <div className="w-full max-w-3xl relative z-50 mb-6">
        <DockSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onAdd={(data) => onAdd(data)}
        />
      </div>

      {/* 中间占位区:让背景成为视觉主体 */}
      <div className="flex-1" />

      {/* 底部 dock 栏 + 操作按钮 */}
      <div className="w-full flex items-end justify-between pb-6 px-4 relative z-10">
        {/* 左下:工具按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const name = prompt(t('groups.groupNamePlaceholder') as string);
              if (name) onAddGroup({ name });
            }}
            className="px-3 py-2 rounded-xl bg-white/10 dark:bg-black/20 backdrop-blur-xl
                       border border-white/20 text-sm text-muted-foreground
                       hover:text-foreground hover:bg-white/20 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            {t('groups.newGroup')}
          </button>
        </div>

        {/* 中下:dock 主体(react-osx-dock) */}
        <div className="flex-1 flex justify-center">
          {dockShortcuts.length > 0 ? (
            /* react-osx-dock:macOS magnification 风格 */
            <Dock
              itemWidth={48}
              magnification={1.6}
              magnifyDirection="up"
              className="bg-white/10 dark:bg-black/20 backdrop-blur-xl
                         border border-white/20 dark:border-black/10
                         rounded-2xl px-3 py-2 shadow-2xl shadow-black/30"
              backgroundClassName="bg-transparent"
            >
              {dockShortcuts.map((s) => (
                <DockItem key={s.id} shortcut={s} />
              ))}
            </Dock>
          ) : (
            <div className="text-sm text-muted-foreground bg-white/5 dark:bg-black/10
                            backdrop-blur-xl border border-dashed border-white/20
                            rounded-2xl px-6 py-4">
              {t('shortcuts.noShortcuts')}
            </div>
          )}
        </div>

        {/* 右下:空(占位) */}
        <div className="w-24" />
      </div>
    </div>
  );
}

// 简化的搜索框(独立于 SearchBar,避免引入 SearchBar 全部 props)
import { Input } from '@/src/components/ui/input';

function DockSearchBar({
  query,
  onQueryChange,
  onAdd,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onAdd: (data: { name: string; url: string }) => void;
}) {
  const { t } = useI18n();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = query.trim();
    if (!url) return;
    onAdd({ name: url, url });
  };
  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="pl-9 pr-8 h-9 bg-white/10 dark:bg-black/10 backdrop-blur-xl
                   border border-white/20 dark:border-black/10"
      />
    </form>
  );
}