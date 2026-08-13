/**
 * 搜索建议下拉列表
 *
 * 纯展示组件：通过 portal 渲染到 document.body，
 * 位置由 anchorRef 元素动态计算。
 */

import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Clock, Globe, Loader2, TrendingUp, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { SuggestionGroup, SuggestionItem } from '@/src/hooks/useSearchSuggestions';
import { useI18n } from '@/src/i18n';

interface SuggestionDropdownProps {
  /** 锚点元素（输入框容器），用于计算下拉位置 */
  anchorRef: RefObject<HTMLElement | null>;
  /** 列表容器 ref，用于点击外部关闭 */
  containerRef?: RefObject<HTMLDivElement>;
  groups: SuggestionGroup[];
  selectedIndex: number;
  itemRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  onSelect: (item: SuggestionItem) => void;
  onMouseEnterItem: (globalIndex: number) => void;
  onRemoveHistory: (e: MouseEvent, queryText: string) => void;
  onClearHistory: () => void;
  hasHistory: boolean;
  scrollToSelectedItem: (index: number) => void;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

export function SuggestionDropdown({
  anchorRef,
  groups,
  selectedIndex,
  itemRefs,
  onSelect,
  onMouseEnterItem,
  onRemoveHistory,
  onClearHistory,
  hasHistory,
  scrollToSelectedItem,
}: SuggestionDropdownProps) {
  const { t } = useI18n();
  const [position, setPosition] = useState<DropdownPosition>({ top: 0, left: 0, width: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  // 把 group.type 映射到 i18n key
  const TYPE_KEY: Record<SuggestionItem['type'], string> = {
    history: 'search.groups.history',
    shortcut: 'search.groups.shortcuts',
    suggestion: 'search.groups.suggestions',
  };

  // 根据 anchorRef 实时计算下拉位置
  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, [anchorRef, groups]);

  // 给每项选 icon
  const renderIcon = (item: SuggestionItem) => {
    switch (item.type) {
      case 'history':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'shortcut':
        return <Globe className="w-4 h-4 text-primary" />;
      case 'suggestion':
        return <TrendingUp className="w-4 h-4 text-orange-500" />;
    }
  };

  // 计算全局索引（跨组）
  const globalIndexOf = (groupIdx: number, itemIdx: number): number => {
    let total = 0;
    for (let i = 0; i < groupIdx; i++) total += groups[i].items.length;
    return total + itemIdx;
  };

  return createPortal(
    <div
      className={cn(
        'fixed z-[10001]',
        'bg-white/10 dark:bg-black/10 backdrop-blur-xl',
        'border border-white/20 dark:border-black/10 rounded-xl shadow-2xl',
        // 之前是 'animate-in fade-in-0 slide-in-from-top-2 duration-200',
        // slide-in-from-top-2 会让下拉从 -8px 高度滑下来,在 newtab 顶部居中的 input
        // 下方看起来像从「左上角」掉下来。删 slide 只留 fade,直接淡入到位。
        'overflow-hidden animate-in fade-in-0 duration-150'
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: '400px',
      }}
    >
      <div
        ref={listRef}
        data-suggestion-list
        className="overflow-y-auto max-h-[360px]"
      >
        {groups.map((group, groupIndex) => {
          // group.title 可能是 '历史记录'/'快捷方式'/'搜索建议'(默认 zh_CN);
          // 兜底:若 group.title 不在 TYPE_KEY 映射里(可能是自定义),保留原值
          const titleKey = TYPE_KEY[group.items[0]?.type ?? 'history'];
          return (
            <div key={group.title}>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                {t(titleKey)}
              </div>

            {group.items.map((item, itemIndex) => {
              const globalIndex = globalIndexOf(groupIndex, itemIndex);
              const isSelected = selectedIndex === globalIndex;

              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(globalIndex, el);
                  }}
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => {
                    onMouseEnterItem(globalIndex);
                    scrollToSelectedItem(globalIndex);
                  }}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 cursor-pointer transition-all duration-100',
                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                        isSelected ? 'bg-primary/20' : 'bg-muted'
                      )}
                    >
                      {renderIcon(item)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{item.text}</div>
                      {item.url && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.url.replace(/^https?:\/\//, '').split('/')[0]}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {item.type === 'history' && (
                      <button
                        onClick={(e) => onRemoveHistory(e, item.text)}
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          isSelected ? 'hover:bg-primary/20' : 'hover:bg-muted'
                        )}
                        title={t('search.remove')}
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                    <div
                      className={cn(
                        'p-1.5 rounded-md transition-colors',
                        isSelected ? 'bg-primary/20' : ''
                      )}
                    >
                      <ArrowRight
                        className={cn(
                          'w-3.5 h-3.5 transition-all',
                          isSelected
                            ? 'text-primary translate-x-0.5'
                            : 'text-muted-foreground'
                        )}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-white/20 dark:border-black/10 bg-white/10 dark:bg-black/10 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">↑↓</kbd>
            {t('search.nav')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd>
            {t('search.enter')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Esc</kbd>
            {t('search.esc')}
          </span>
        </div>
        {hasHistory && (
          <button onClick={onClearHistory} className="hover:text-destructive transition-colors">
            {t('search.clearHistory')}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}