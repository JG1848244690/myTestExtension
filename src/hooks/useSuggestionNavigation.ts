/**
 * 建议下拉的键盘导航 hook
 *
 * 职责：维护 selectedIndex，处理键盘 ↑↓/Enter/Esc，
 * 提供 scrollToSelectedItem 让选中项始终可见。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { SuggestionGroup, SuggestionItem } from './useSearchSuggestions';

interface UseSuggestionNavigationParams {
  groups: SuggestionGroup[];
  /** 当建议项被激活（点击/回车）时触发 */
  onSelect: (item: SuggestionItem) => void;
  /** 当用户按 Esc 或输入清空时可调用以重置选择 */
  onReset?: () => void;
}

interface UseSuggestionNavigationReturn {
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  itemRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  /** 给 <input> 的 onKeyDown 用 */
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** 滚动到指定全局索引的项 */
  scrollToSelectedItem: (index: number) => void;
  /** 重置选中索引（query 变化时使用） */
  resetSelection: () => void;
  /** 拿到当前全局索引对应的建议项 */
  findItemByGlobalIndex: (globalIndex: number) => SuggestionItem | null;
}

export function useSuggestionNavigation({
  groups,
  onSelect,
  onReset,
}: UseSuggestionNavigationParams): UseSuggestionNavigationReturn {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // 计算当前总条目数
  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  // 滚动到可见区域
  const scrollToSelectedItem = useCallback((index: number) => {
    const doScroll = () => {
      const itemElement = itemRefs.current.get(index);
      const listEl = document.querySelector<HTMLDivElement>('[data-suggestion-list]');
      if (itemElement && listEl) {
        const itemTop = itemElement.offsetTop;
        const itemHeight = itemElement.offsetHeight;
        const scrollTop = listEl.scrollTop;
        const containerHeight = listEl.clientHeight;

        // 项在可视区域上方
        if (itemTop < scrollTop) {
          listEl.scrollTo({ top: itemTop, behavior: 'instant' });
        }
        // 项在可视区域下方
        else if (itemTop + itemHeight > scrollTop + containerHeight) {
          listEl.scrollTo({
            top: itemTop - containerHeight + itemHeight,
            behavior: 'instant',
          });
        }
      }
    };

    if (!itemRefs.current.has(index)) {
      setTimeout(doScroll, 10);
    } else {
      doScroll();
    }
  }, []);

  // 全局索引 → item
  const findItemByGlobalIndex = useCallback(
    (globalIndex: number): SuggestionItem | null => {
      let current = 0;
      for (const group of groups) {
        for (const item of group.items) {
          if (current === globalIndex) return item;
          current++;
        }
      }
      return null;
    },
    [groups]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const total = groups.reduce((sum, g) => sum + g.items.length, 0);

      if (total === 0) {
        // 没有建议时，回车直接搜索
        if (e.key === 'Enter' && onReset) onReset();
        return;
      }

      const safeIndex = Math.min(selectedIndex, total - 1);
      let next = safeIndex;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          next = safeIndex < total - 1 ? safeIndex + 1 : 0;
          break;
        case 'ArrowUp':
          e.preventDefault();
          next = safeIndex > 0 ? safeIndex - 1 : total - 1;
          break;
        case 'Enter':
          e.preventDefault();
          if (safeIndex >= 0) {
            const item = findItemByGlobalIndex(safeIndex);
            if (item) onSelect(item);
          } else if (onReset) {
            onReset();
          }
          return;
        case 'Escape':
          setSelectedIndex(-1);
          return;
        default:
          return;
      }

      setSelectedIndex(next);
      // 延迟滚动，确保 DOM 已更新
      setTimeout(() => scrollToSelectedItem(next), 0);
    },
    [groups, selectedIndex, findItemByGlobalIndex, onSelect, onReset, scrollToSelectedItem]
  );

  const resetSelection = useCallback(() => setSelectedIndex(-1), []);

  // groups 变化时清空 refs（让重新渲染的项能重新注册）
  useEffect(() => {
    itemRefs.current.clear();
  }, [groups]);

  return {
    selectedIndex,
    setSelectedIndex,
    itemRefs,
    handleKeyDown,
    scrollToSelectedItem,
    resetSelection,
    findItemByGlobalIndex,
  };
}