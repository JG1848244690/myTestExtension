import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { SearchBar } from '@/src/components/SearchBar';
import { GroupLayout } from '@/src/components/GroupLayout';
import { SettingsSheet } from '@/src/components/SettingsSheet';
import { Button } from '@/src/components/ui/button';
import { useShortcutsStore } from '@/src/hooks/useShortcutsStore';
import { useGroupsStore } from '@/src/hooks/useGroupsStore';
import { useSettingsStore } from '@/src/hooks/useSettingsStore';
import { useTheme } from '@/src/hooks/useTheme';
import { useStoresReady } from '@/src/lib/useStoresReady';
import { useStoreState } from '@/src/lib/store';
import { settingsStore } from '@/src/store/settings';
import { notifyNewtabNavigated } from '@/src/utils/navigationReset';
import type { BackgroundSetting } from '@/src/utils/types';

function App() {
  const storesReady = useStoresReady();

  // shortcuts
  const { shortcuts, addShortcut, addShortcuts, updateShortcut, removeShortcut, removeShortcuts, importShortcuts } =
    useShortcutsStore();
  // groups
  const {
    groups,
    addGroup,
    updateGroup,
    removeGroup,
    toggleGroupExpand,
    addShortcutToGroup,
    moveShortcutsToGroup,
    getUngroupedShortcutIds,
    importGroups,
    reorderGroups,
    reorderShortcutsInGroup,
  } = useGroupsStore();
  // settings
  const { engine, engineOption, engineOptions, setEngine, setBackground } = useSettingsStore();
  // settings.background 单独订阅（避免其他 settings 字段变化触发本组件 re-render）
  const background = useStoreState(settingsStore, (s) => s.background);

  const { mounted } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);

  // 跳转重置
  useEffect(() => {
    const handleNavigated = () => setResetNonce((n) => n + 1);
    window.addEventListener(NEWTAB_NAVIGATED_EVENT, handleNavigated);
    return () => window.removeEventListener(NEWTAB_NAVIGATED_EVENT, handleNavigated);
  }, []);

  // 等待主题 + stores 初始化
  if (!mounted || !storesReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">加载中...</div>
      </div>
    );
  }

  // 保存背景
  const handleSaveBackground = (setting: BackgroundSetting) => {
    setBackground(setting);
  };

  // 处理导入数据
  const handleImportData = async (newShortcuts: typeof shortcuts, newGroups: typeof groups) => {
    await Promise.all([importShortcuts(newShortcuts), importGroups(newGroups)]);
  };

  // 背景样式
  const getBackgroundStyle = (): React.CSSProperties => {
    if (!background || background.type === 'none') return {};
    if (background.type === 'color') return { backgroundColor: background.color };
    if (background.type === 'image' && background.imageUrl) {
      return {
        backgroundImage: 'url(' + background.imageUrl + ')',
        backgroundSize: background.size || 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    return {};
  };

  // 背景遮罩样式
  const getOverlayStyle = (): React.CSSProperties => {
    if (!background || background.type !== 'image' || background.opacity === undefined) return {};
    return { backgroundColor: 'rgba(0, 0, 0, ' + (1 - background.opacity) + ')' };
  };

  return (
    <div className="min-h-screen relative" style={getBackgroundStyle()}>
      {background?.type === 'image' && background.imageUrl && (
        <div className="fixed inset-0 z-0" style={getOverlayStyle()} />
      )}

      <div className="min-h-screen bg-transparent transition-colors duration-300 relative z-10">
        <div className="fixed top-4 right-4 z-10
          bg-white/20 dark:bg-black/20 backdrop-blur-xl
          border border-white/20 dark:border-black/10
          rounded-2xl p-2 shadow-lg shadow-black/5 dark:shadow-black/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="text-muted-foreground hover:text-foreground
              hover:bg-accent/50 rounded-xl transition-all duration-300"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-screen flex flex-col items-center px-8 pt-8">
          <div className="w-full max-w-3xl relative z-50 mb-6">
            <SearchBar
              key={'search-' + resetNonce}
              engine={engine}
              engineOption={engineOption}
              engineOptions={engineOptions}
              onEngineChange={setEngine}
              onSearch={useCallback((q: string) => {
                if (!q.trim()) return;
                window.open(engineOption.url + encodeURIComponent(q.trim()), '_blank');
                notifyNewtabNavigated();
              }, [engineOption])}
              shortcuts={shortcuts}
            />
          </div>

          <div className="w-full max-w-4xl flex-1 mt-16">
            <GroupLayout
              key={'groups-' + resetNonce}
              groups={groups}
              shortcuts={shortcuts}
              onToggleGroupExpand={toggleGroupExpand}
              onAddGroup={addGroup}
              onUpdateGroup={updateGroup}
              onRemoveGroup={removeGroup}
              onAddShortcutToGroup={addShortcutToGroup}
              onAddShortcut={addShortcut}
              onAddShortcuts={addShortcuts}
              onUpdateShortcut={updateShortcut}
              onRemoveShortcut={removeShortcut}
              onBatchRemoveShortcuts={removeShortcuts}
              onMoveShortcutsToGroup={moveShortcutsToGroup}
              onImportData={handleImportData}
              onReorderGroups={reorderGroups}
              onReorderShortcutsInGroup={reorderShortcutsInGroup}
              getUngroupedShortcutIds={getUngroupedShortcutIds}
            />
          </div>
        </div>

        <div className="fixed bottom-4 left-0 right-0 text-center text-muted-foreground text-sm">
          序章 · {shortcuts.length} 个快捷方式
        </div>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        setting={background || { type: 'none' }}
        onSave={handleSaveBackground}
      />
    </div>
  );
}

// 在组件外定义 NEWTAB_NAVIGATED_EVENT 常量（避免循环依赖）
import { NEWTAB_NAVIGATED_EVENT } from '@/src/utils/navigationReset';
import { useCallback } from 'react';

export default App;