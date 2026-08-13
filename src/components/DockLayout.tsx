/**
 * 底部 macOS 风格 dock 栏布局(手写,0 依赖)
 *
 * 视觉:半透明毛玻璃 + 鼠标靠近的图标放大,周围图标轻微扩展
 * 内容:显示未分组的快捷方式
 * 交互:点击打开网址(排序留待 dock 内拖拽后续补 ungrouped reorder API)
 */

import React, { useEffect, useRef, useState } from 'react';
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
  onAddGroup: (data: { name: string; color?: string }) => void;
  onImportData?: (shortcuts: Shortcut[], groups: ShortcutGroup[]) => void;
}

// magnification 参数
const ITEM_BASE_PX = 52; // 基础宽高
const ITEM_HOVER_PX = 70; // 放大目标
const NEIGHBOR_HOVER_PX = 60; // 邻居轻微放大

// 单个 dock item
function DockItem({
  shortcut,
  scale,
}: {
  shortcut: Shortcut;
  /** 0~1,1 表示完全放大;0 表示基础尺寸;0.4~0.7 表示邻居 */
  scale: number;
}) {
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

  // 用 CSS 变量传递 scale,过渡动画走 transform,避免 reflow
  const size = ITEM_BASE_PX + (ITEM_HOVER_PX - ITEM_BASE_PX) * scale;
  return (
    <button
      onClick={() => {
        window.open(shortcut.url, '_blank');
        notifyNewtabNavigated();
      }}
      title={shortcut.name}
      style={
        {
          width: `${size}px`,
          height: `${size}px`,
          // 邻居轻微向上抬一点,模拟 macOS 凸起
          transform: `translateY(${-6 * scale}px)`,
          transitionDuration: '180ms',
        } as React.CSSProperties
      }
      className={cn(
        'shrink-0 rounded-2xl cursor-pointer overflow-hidden',
        'bg-white/15 dark:bg-black/30 backdrop-blur-2xl',
        'border border-white/25 dark:border-white/10',
        'flex items-center justify-center',
        'shadow-md shadow-black/15',
        'transition-all ease-out',
      )}
    >
      {faviconSrc ? (
        <img
          src={faviconSrc}
          alt={shortcut.name}
          className="rounded pointer-events-none"
          style={{ width: '60%', height: '60%' }}
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

/**
 * 手写 dock:鼠标在容器内移动 → 计算每个 item 与鼠标的距离 → 映射到 scale
 * 距离越近 scale 越大(最大 1),距离 ≤ 60px 给 0.5 邻居缩放,其余 0
 */
function Dock({ children }: { children: React.ReactNode[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const itemCount = Array.isArray(children) ? children.length : 1;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // 找最近的 item 中心点
    const itemSlot = rect.width / itemCount;
    const idx = Math.max(0, Math.min(itemCount - 1, Math.floor(x / itemSlot)));
    setHoverIndex(idx);
  };

  const handleMouseLeave = () => setHoverIndex(null);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'flex items-end gap-2 px-3 py-2',
        'bg-white/15 dark:bg-black/30 backdrop-blur-2xl',
        'border border-white/25 dark:border-white/10',
        'rounded-3xl shadow-2xl shadow-black/25',
      )}
    >
      {Array.isArray(children)
        ? children.map((child, i) => {
            // 计算 scale:被 hover 的 index → 1,邻居 ±1 → 0.4~0.5,其他 → 0
            let scale = 0;
            if (hoverIndex !== null) {
              const dist = Math.abs(i - hoverIndex);
              if (dist === 0) scale = 1;
              else if (dist === 1) scale = 0.45;
              else if (dist === 2) scale = 0.15;
            }
            // 克隆 child,注入 scale prop
            const childEl = child as React.ReactElement<{ scale: number }>;
            return (
              <div
                key={(childEl as { key?: string }).key ?? i}
                className="flex items-end"
                style={{
                  // 邻居位置留 padding,让放大后的图标能向上凸出而不被裁
                  paddingTop: `${ITEM_HOVER_PX - ITEM_BASE_PX}px`,
                  marginTop: `-${ITEM_HOVER_PX - ITEM_BASE_PX}px`,
                }}
              >
                {React.cloneElement(childEl, { scale })}
              </div>
            );
          })
        : null}
    </div>
  );
}

export function DockLayout({
  shortcuts,
  ungroupedIds,
  onAddGroup,
}: DockLayoutProps) {
  const { t } = useI18n();

  // 列出未分组
  const dockShortcuts = ungroupedIds
    .map((id) => shortcuts.find((s) => s.id === id))
    .filter((s): s is Shortcut => s !== undefined);

  return (
    <>
      {/* dock 主体:固定底部 + 水平居中 */}
      <div className="fixed bottom-6 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          {dockShortcuts.length > 0 ? (
            <Dock>
              {dockShortcuts.map((s) => (
                <DockItem key={s.id} shortcut={s} scale={0} />
              ))}
            </Dock>
          ) : (
            <div
              className="text-sm text-muted-foreground bg-white/10 dark:bg-black/20
                         backdrop-blur-2xl border border-dashed border-white/25
                         rounded-2xl px-6 py-4"
            >
              {t('shortcuts.noShortcuts')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}