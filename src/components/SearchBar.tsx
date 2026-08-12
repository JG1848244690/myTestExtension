/**
 * 搜索栏
 *
 * 编排层：组合 useSearchSuggestions（数据）+ useSuggestionNavigation（键盘）+
 * SuggestionDropdown（UI），自身只保留输入框、引擎选择、搜索按钮等 UI 元素。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useHistoryStore } from '@/src/hooks/useHistoryStore';
import {
  useSearchSuggestions,
  type SuggestionItem,
} from '@/src/hooks/useSearchSuggestions';
import { useSuggestionNavigation } from '@/src/hooks/useSuggestionNavigation';
import { SuggestionDropdown } from '@/src/components/SuggestionDropdown';
import type { SearchEngineType, SearchEngineOption, Shortcut } from '@/src/utils/types';
import { cn } from '@/src/lib/utils';
import { notifyNewtabNavigated } from '@/src/utils/navigationReset';
import { useI18n } from '@/src/i18n';

interface SearchBarProps {
  engine: SearchEngineType;
  engineOption: SearchEngineOption;
  engineOptions: SearchEngineOption[];
  onEngineChange: (engine: SearchEngineType) => void;
  onSearch: (query: string) => void;
  shortcuts?: Shortcut[];
}

export function SearchBar({
  engine,
  engineOption,
  engineOptions,
  onEngineChange,
  onSearch,
  shortcuts = [],
}: SearchBarProps) {
  const { t } = useI18n();
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 引擎名走 i18n(baidu 在字典里有专门 key;google/bing 直接用 SearchEngineOption.name)
  const getEngineName = (opt: SearchEngineOption) =>
    opt.id === 'baidu' ? t('searchEngine.baidu') : opt.name;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { history, addHistory, clearHistory, removeHistoryItem } = useHistoryStore();

  const { query, setQuery, groups, setGroups, isLoading } = useSearchSuggestions({
    engine,
    history,
    shortcuts,
  });

  const handleSuggestionSelect = useCallback(
    (item: SuggestionItem) => {
      if (item.type === 'shortcut' && item.url) {
        window.open(item.url, '_blank');
        notifyNewtabNavigated();
        setShowSuggestions(false);
      } else {
        setQuery(item.text);
        addHistory(item.text);
        onSearch(item.text);
        setShowSuggestions(false);
      }
    },
    [onSearch, setQuery, addHistory]
  );

  // 兜底：直接搜索当前 query（按 Enter 但没选中任何项时）
  const submitQuery = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    addHistory(trimmed);
    onSearch(trimmed);
    setShowSuggestions(false);
  }, [query, onSearch, addHistory]);

  const {
    selectedIndex,
    setSelectedIndex,
    itemRefs,
    handleKeyDown,
    scrollToSelectedItem,
    resetSelection,
  } = useSuggestionNavigation({
    groups,
    onSelect: handleSuggestionSelect,
    onReset: submitQuery,
  });

  // query 变化时重置选中
  useEffect(() => {
    resetSelection();
  }, [query, resetSelection]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target) &&
        // dropdown 用 portal 渲染，挂在 body 上，需检测
        !(target as HTMLElement).closest?.('[data-suggestion-list]') &&
        !(target as HTMLElement).closest?.('[data-suggestion-dropdown]')
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRemoveHistory = useCallback(
    (e: React.MouseEvent, queryText: string) => {
      e.stopPropagation();
      removeHistoryItem(queryText);
    },
    [removeHistoryItem]
  );

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setGroups([]);
  }, [clearHistory, setGroups]);

  return (
    <div ref={containerRef} className="w-full relative">
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-xl transition-all duration-200',
          'bg-white/10 dark:bg-black/10 backdrop-blur-xl',
          'border border-white/20 dark:border-black/10',
          'shadow-lg shadow-black/5 dark:shadow-black/20',
          showSuggestions && query
            ? 'ring-2 ring-primary/30 shadow-xl'
            : 'hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30'
        )}
      >
        <Select
          value={engine}
          onValueChange={(value) => onEngineChange(value as SearchEngineType)}
        >
          <SelectTrigger className="w-[100px] border-0 bg-transparent focus:ring-0 shrink-0 hover:bg-accent/50 rounded-xl transition-colors">
            <SelectValue>
              <span className="text-sm truncate">{getEngineName(engineOption)}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="z-[10000]">
            {engineOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.icon} {getEngineName(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-px h-8 bg-border/50 shrink-0" />

        <div className="flex-1 min-w-0 relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
              'text-base placeholder:text-muted-foreground pr-6'
            )}
          />
          {isLoading && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <Button
          onClick={() => submitQuery()}
          disabled={!query.trim()}
          className={cn(
            'rounded-xl px-6 shrink-0',
            'bg-primary/90 hover:bg-primary',
            'shadow-md shadow-primary/20',
            'transition-all duration-300',
            'hover:shadow-lg hover:shadow-primary/30',
            'disabled:opacity-50 disabled:shadow-none'
          )}
        >
          <Search className="w-4 h-4 mr-2" />
          {t('search.search')}
        </Button>
      </div>

      {showSuggestions && groups.length > 0 && (
        <SuggestionDropdown
          anchorRef={containerRef}
          groups={groups}
          selectedIndex={selectedIndex}
          itemRefs={itemRefs}
          onSelect={handleSuggestionSelect}
          onMouseEnterItem={setSelectedIndex}
          onRemoveHistory={handleRemoveHistory}
          onClearHistory={handleClearHistory}
          hasHistory={history.length > 0}
          scrollToSelectedItem={scrollToSelectedItem}
        />
      )}
    </div>
  );
}