import { useState, useEffect } from 'react';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import type { Shortcut } from '@/src/utils/types';
import { getFaviconWithFallback, generateInitialFallback } from '@/src/utils/faviconCache';
import { cn } from '@/src/lib/utils';
import { notifyNewtabNavigated } from '@/src/utils/navigationReset';
import { useI18n } from '@/src/i18n';

interface ShortcutCardProps {
  shortcut: Shortcut;
  onEdit: (shortcut: Shortcut) => void;
  onRemove: (id: string) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function ShortcutCard({
  shortcut,
  onEdit,
  onRemove,
  isSelectMode = false,
  isSelected = false,
  onSelect
}: ShortcutCardProps) {
  const { t } = useI18n();
  const [faviconSrc, setFaviconSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadFavicon = async () => {
      setIsLoading(true);

      try {
        // 三级 fallback: 网络 → IndexedDB → 首字母
        const { src } = await getFaviconWithFallback(shortcut.url, shortcut.name);

        if (isMounted) {
          setFaviconSrc(src);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setFaviconSrc(generateInitialFallback(shortcut.name));
          setIsLoading(false);
        }
      }
    };

    loadFavicon();

    return () => {
      isMounted = false;
    };
  }, [shortcut.url, shortcut.name]);

  const handleClick = () => {
    if (isSelectMode) {
      onSelect?.();
    } else {
      window.open(shortcut.url, '_blank');
      notifyNewtabNavigated();
    }
  };

  return (
    <div
      onClick={handleClick}
      title={`${shortcut.name}\n${shortcut.url}`}
      className={cn(
        "flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all duration-300 group relative",
        "bg-white/10 dark:bg-black/10 backdrop-blur-xl",
        "border border-white/20 dark:border-black/10",
        "hover:bg-white/20 dark:hover:bg-black/20",
        "hover:border-primary/30 dark:hover:border-primary/30",
        "hover:shadow-lg hover:shadow-primary/5",
        "hover:-translate-y-0.5 hover:scale-[1.01]",
        "active:scale-[0.98]",
        isSelectMode && isSelected && "ring-2 ring-primary border-primary bg-primary/10"
      )}
    >
      {/* 选择模式下隐藏操作菜单 */}
      {!isSelectMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-xs">⋯</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onEdit(shortcut);
            }}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('common.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRemove(shortcut.id);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* 图标 */}
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shadow-sm transition-all",
        "bg-linear-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20",
        isSelectMode && isSelected && "ring-1 ring-primary"
      )}>
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : faviconSrc ? (
          <img
            src={faviconSrc}
            alt={shortcut.name}
            className="w-5 h-5 rounded"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="text-sm font-bold text-primary">${shortcut.name.charAt(0).toUpperCase()}</span>`;
              }
            }}
          />
        ) : (
          <span className="text-sm font-bold text-primary">
            {shortcut.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* 名称 */}
      <span className={cn(
        "mt-1 text-[10px] truncate max-w-full text-center leading-tight",
        isSelectMode && isSelected ? "text-primary font-medium" : "text-card-foreground"
      )}>
        {shortcut.name}
      </span>
    </div>
  );
}
