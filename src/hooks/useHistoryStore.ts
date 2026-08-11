/**
 * 新的 history hook：薄壳
 */

import { useStoreState } from '@/src/lib/store';
import { historyStore, historyActions } from '@/src/store/history';

export function useHistoryStore() {
  const history = useStoreState(historyStore, (s) => s);

  return {
    history,
    addHistory: historyActions.add,
    clearHistory: historyActions.clear,
    removeHistoryItem: historyActions.remove,
    searchHistory: historyActions.search,
  };
}