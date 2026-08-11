import { useState, useEffect, useRef, useCallback } from 'react';
import { useShortcutsStore } from '@/src/hooks/useShortcutsStore';
import { useGroupsStore } from '@/src/hooks/useGroupsStore';
import { useStoresReady } from '@/src/lib/useStoresReady';
import { Search, Globe, ExternalLink, Keyboard, Plus, FolderOpen, Check, Loader2, History } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import type { Shortcut, ShortcutGroup } from '@/src/utils/types';
import { cn } from '@/src/lib/utils';
import SessionTab from './SessionTab';


// 璁剧疆缁勪欢
function SettingsTab() {
  const openShortcutsSettings = () => {
    browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  return (
    <div className="space-y-3">
      <div className="border border-white/20 dark:border-black/10 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Keyboard className="w-4 h-4" />
          蹇嵎閿缃?
        </div>
        <p className="text-xs text-muted-foreground">
          璁剧疆鍏ㄥ眬蹇嵎閿揩閫熸墦寮€鎼滅储闈㈡澘
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={openShortcutsSettings}
          className="w-full gap-2"
        >
          鍓嶅線璁剧疆蹇嵎閿?
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>
      <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
        鏇村璁剧疆锛堣儗鏅€佸竷灞€绛夛級璇峰湪 <strong>鏂版爣绛鹃〉</strong> 涓偣鍑诲彸涓婅璁剧疆鍥炬爣杩涜閰嶇疆
      </div>
    </div>
  );
}

// 蹇嵎娣诲姞缁勪欢
function AddTab({
  currentUrl,
  shortcutName,
  setShortcutName,
  selectedGroupId,
  setSelectedGroupId,
  groups,
  saving,
  saved,
  onAdd,
}: {
  currentUrl: string;
  shortcutName: string;
  setShortcutName: (v: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (v: string) => void;
  groups: ShortcutGroup[];
  saving: boolean;
  saved: boolean;
  onAdd: () => void;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    addInputRef.current?.focus();
  }, []);

  return (
    <div className="p-3 space-y-3">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">褰撳墠缃戝潃</label>
        <div className="text-xs p-2 bg-muted/50 rounded-lg truncate">
          {currentUrl || '鏃犳硶鑾峰彇褰撳墠缃戝潃'}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">鍚嶇О</label>
        <Input
          ref={addInputRef}
          value={shortcutName}
          onChange={(e) => setShortcutName(e.target.value)}
          placeholder="杈撳叆蹇嵎鏂瑰紡鍚嶇О"
          className="h-9"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">閫夋嫨鍒嗙粍锛堝彲閫夛級</label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setSelectedGroupId('')}
            className={cn(
              "flex items-center gap-1.5 p-2 rounded-lg border text-xs transition-colors",
              !selectedGroupId
                ? "border-primary bg-primary/10 text-primary"
                : "border-white/20 dark:border-black/10 hover:bg-accent/50"
            )}
          >
            <Globe className="w-3 h-3" />
            涓嶅垎缁?
          </button>
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className={cn(
                "flex items-center gap-1.5 p-2 rounded-lg border text-xs transition-colors truncate",
                selectedGroupId === group.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-white/20 dark:border-black/10 hover:bg-accent/50"
              )}
            >
              <FolderOpen className="w-3 h-3 shrink-0" />
              <span className="truncate">{group.name}</span>
            </button>
          ))}
        </div>
      </div>
      <Button
        onClick={onAdd}
        disabled={!shortcutName.trim() || saving || saved}
        className="w-full gap-2"
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" />
            宸叉坊鍔?
          </>
        ) : saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            淇濆瓨涓?..
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            娣诲姞鍒板揩鎹锋柟寮?
          </>
        )}
      </Button>
    </div>
  );
}

function App() {
  const storesReady = useStoresReady();
  const { shortcuts, addShortcut } = useShortcutsStore();
  const { groups, addShortcutToGroup } = useGroupsStore();

  const [activeTab, setActiveTab] = useState<'search' | 'add' | 'settings' | 'sessions'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // 蹇嵎娣诲姞鐘舵€佺敤
  const [currentUrl, setCurrentUrl] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [shortcutName, setShortcutName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 鍔犺浇褰撳墠鏍囩椤?
  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0] && tabs[0].url) {
        setCurrentUrl(tabs[0].url);
        setShortcutName(tabs[0].title || '');
      }
    });
  }, []);

  // 淇濆瓨蹇嵎鏂瑰紡
  const handleAddShortcut = async () => {
    if (!currentUrl || !shortcutName.trim()) return;

    setSaving(true);
    try {
      const created = await addShortcut({ name: shortcutName.trim(), url: currentUrl });
      if (selectedGroupId) {
        await addShortcutToGroup(selectedGroupId, created.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };
// 鎵撳紑缃戠珯
  const openUrl = (url: string) => {
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    browser.tabs.create({ url: finalUrl });
  };

  // 鎼滅储
  const handleSearch = (query: string) => {
    if (!query.trim()) return;
    if (query.includes('.') && !query.includes(' ')) {
      openUrl(query);
    } else {
      browser.tabs.create({ url: `https://www.bing.com/search?q=${encodeURIComponent(query)}` });
    }
  };

  const getShortcutById = (id: string): Shortcut | undefined => {
    return shortcuts.find(s => s.id === id);
  };

  const filteredShortcuts = groups
    .flatMap(group => group.shortcutIds.map(id => getShortcutById(id)).filter((s): s is Shortcut => s !== undefined))
    .concat(shortcuts.filter(s => !groups.some(g => g.shortcutIds.includes(s.id))))
    .filter(s =>
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.url.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 5);

  const openSelected = (index: number) => {
    if (index >= 0 && index < filteredShortcuts.length) {
      openUrl(filteredShortcuts[index].url);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= '1' && e.key <= '5' && e.ctrlKey) {
      e.preventDefault();
      openSelected(parseInt(e.key) - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => prev < filteredShortcuts.length - 1 ? prev + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredShortcuts.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) {
        openSelected(selectedIndex);
      } else if (searchQuery.trim()) {
        handleSearch(searchQuery);
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setSelectedIndex(-1);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="w-[380px] h-[400px] bg-background text-foreground flex flex-col relative">
      {/* 澶撮儴 */}
      <div className="flex items-center justify-between p-3 border-b border-white/20 dark:border-black/10">
        <h1 className="text-base font-bold">搴忚█</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') })}
          title="鎵撳紑鏂版爣绛鹃〉"
          className="h-7 w-7"
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>

      {/* 鏍囩鍒囨崲 */}
      <div className="flex border-b border-white/20 dark:border-black/10">
        <button
          onClick={() => setActiveTab('search')}
          className={cn(
            'flex-1 py-2 text-sm transition-colors',
            activeTab === 'search'
              ? 'text-primary border-b-2 border-primary font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          蹇嵎鎼滅储
        </button>
        <button
          onClick={() => setActiveTab('add')}
          className={cn(
            'flex-1 py-2 text-sm transition-colors',
            activeTab === 'add'
              ? 'text-primary border-b-2 border-primary font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          蹇嵎娣诲姞
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={cn(
            'flex-1 py-2 text-sm transition-colors flex items-center justify-center gap-1',
            activeTab === 'sessions'
              ? 'text-primary border-b-2 border-primary font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <History className="w-3.5 h-3.5" />
          浼氳瘽
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            'flex-1 py-2 text-sm transition-colors',
            activeTab === 'settings'
              ? 'text-primary border-b-2 border-primary font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          璁剧疆
        </button>
      </div>

      {/* 鍐呭鍖?*/}
      <div className="flex-1 overflow-y-auto pb-8">
        {activeTab === 'search' && (
          <div className="p-3 space-y-2">
            {/* 鎼滅储妗?*/}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="鎼滅储蹇嵎鏂瑰紡鎴栫綉鍧€..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                className="pl-9 h-10"
                autoFocus
              />
            </div>

            {/* 鎼滅储缁撴灉 */}
            {searchQuery && filteredShortcuts.length > 0 && (
              <div className="space-y-1">
                {filteredShortcuts.map((shortcut, index) => (
                  <button
                    key={shortcut.id}
                    onClick={() => openUrl(shortcut.url)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
                      index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <span className="w-5 h-5 rounded bg-primary/20 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{shortcut.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {shortcut.url.replace(/^https?:\/\//, '').split('/')[0]}
                      </div>
                    </div>
                  </button>
                ))}
                <div className="text-xs text-muted-foreground px-2 py-1">
                  鎸塩trl+ <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">1-5</kbd> 蹇€熸墦寮€
                </div>
              </div>
            )}

            {/* 绌虹姸鎬?*/}
            {(!storesReady) ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                鍔犺浇涓?..
              </div>
            ) : !searchQuery && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">杈撳叆鍏抽敭璇嶆悳绱㈠揩鎹锋柟寮</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <AddTab
            currentUrl={currentUrl}
            shortcutName={shortcutName}
            setShortcutName={setShortcutName}
            selectedGroupId={selectedGroupId}
            setSelectedGroupId={setSelectedGroupId}
            groups={groups}
            saving={saving}
            saved={saved}
            onAdd={handleAddShortcut}
          />
        )}

        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'sessions' && <SessionTab />}
      </div>

      {/* 搴曢儴涓荤珯閾炬帴 */}
      <div className="absolute bottom-0 left-0 right-0 py-2 text-center border-t border-white/10 dark:border-black/10 bg-background/80 backdrop-blur-sm">
        <a
          href="https://kskbl.com.cn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          搴忚█-xy
        </a>
      </div>
    </div>
  );
}

export default App;






