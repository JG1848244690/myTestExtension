/**
 * 新的 settings hook：薄壳
 */

import { useStoreState } from '@/src/lib/store';
import { settingsStore, settingsActions } from '@/src/store/settings';
import { SEARCH_ENGINES } from '@/src/utils/constants';
import type { SearchEngineType, SearchEngineOption, BackgroundSetting, LayoutType } from '@/src/utils/types';
import type { Locale } from '@/src/i18n';

export function useSettingsStore() {
  const settings = useStoreState(settingsStore, (s) => s);
  const engineOption: SearchEngineOption =
    SEARCH_ENGINES.find((e) => e.id === settings.searchEngine) || SEARCH_ENGINES[0];

  return {
    settings,
    engine: settings.searchEngine,
    engineOption,
    engineOptions: SEARCH_ENGINES,
    layout: (settings.layout ?? 'group') as LayoutType,
    setEngine: (engine: SearchEngineType) => settingsActions.patch({ searchEngine: engine }),
    setBackground: (background: BackgroundSetting) => settingsActions.patch({ background }),
    setLanguage: (language: Locale) => settingsActions.patch({ language }),
    setLayout: (layout: LayoutType) => settingsActions.patch({ layout }),
    patchSettings: settingsActions.patch,
    importSettings: settingsActions.replace,
  };
}