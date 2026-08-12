import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import type {
  BackgroundSetting,
  BackgroundType,
  BackgroundSize,
} from '@/src/utils/types';
import { Image, Palette, Maximize2, Trash2, RotateCcw } from 'lucide-react';
import { useI18n } from '@/src/i18n';

interface BackgroundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setting: BackgroundSetting;
  onSave: (setting: BackgroundSetting) => void;
}

// 预设背景色 — name 字段仅作 fallback key,实际渲染走 i18n
const PRESET_COLORS = [
  { key: 'midNightBlue', name: '深夜蓝', color: '#1a1a2e' },
  { key: 'starPurple', name: '星空紫', color: '#16213e' },
  { key: 'geekBlack', name: '极客黑', color: '#0f0f23' },
  { key: 'mintGreen', name: '薄荷绿', color: '#1e3a3a' },
  { key: 'warmOrange', name: '暖阳橙', color: '#2d2d44' },
  { key: 'rosePink', name: '玫瑰粉', color: '#2e1f2e' },
  { key: 'glacierBlue', name: '冰川蓝', color: '#1a2a3a' },
  { key: 'forestGreen', name: '森林绿', color: '#1a2e1a' },
];

// 预设背景图
const PRESET_IMAGES = [
  { key: 'starry', name: '星空', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80' },
  { key: 'mountain', name: '山脉', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80' },
  { key: 'city', name: '城市', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80' },
  { key: 'wave', name: '海浪', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80' },
  { key: 'forest', name: '森林', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80' },
  { key: 'sunset', name: '日落', url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&q=80' },
];

// 适配方式选项 — label 字段仅作 fallback key,实际渲染走 i18n
const SIZE_OPTIONS: { value: BackgroundSize; key: 'cover' | 'contain' | 'auto' | 'stretch'; label: string }[] = [
  { value: 'cover', key: 'cover', label: '覆盖 (cover)' },
  { value: 'contain', key: 'contain', label: '适应 (contain)' },
  { value: 'auto', key: 'auto', label: '原始大小 (auto)' },
  { value: '100% 100%', key: 'stretch', label: '拉伸 (100% 100%)' },
];

export function BackgroundDialog({
  open,
  onOpenChange,
  setting,
  onSave,
}: BackgroundDialogProps) {
  const { t } = useI18n();
  const [type, setType] = useState<BackgroundType>(setting.type || 'none');
  const [color, setColor] = useState(setting.color || '#1a1a2e');
  const [imageUrl, setImageUrl] = useState(setting.imageUrl || '');
  const [size, setSize] = useState<BackgroundSize>(setting.size || 'cover');
  const [opacity, setOpacity] = useState(setting.opacity ?? 1);

  // 当弹窗打开时，同步最新设置
  useEffect(() => {
    if (open) {
      setType(setting.type || 'none');
      setColor(setting.color || '#1a1a2e');
      setImageUrl(setting.imageUrl || '');
      setSize(setting.size || 'cover');
      setOpacity(setting.opacity ?? 1);
    }
  }, [open, setting]);

  const handleSave = () => {
    const newSetting: BackgroundSetting = {
      type,
      ...(type === 'color' && { color }),
      ...(type === 'image' && { imageUrl, size, opacity }),
    };
    onSave(newSetting);
    onOpenChange(false);
  };

  const handleReset = () => {
    const defaultSetting: BackgroundSetting = { type: 'none' };
    onSave(defaultSetting);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Palette className="w-5 h-5" />
            {t('settings.bg.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 背景类型选择 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('settings.bg.typeLabel')}</Label>
            <div className="flex gap-2">
              <Button
                variant={type === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setType('none')}
                className="flex-1"
              >
                {t('settings.bg.type.none')}
              </Button>
              <Button
                variant={type === 'color' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setType('color')}
                className="flex-1 gap-1.5"
              >
                <Palette className="w-3.5 h-3.5" />
                {t('settings.bg.type.color')}
              </Button>
              <Button
                variant={type === 'image' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setType('image')}
                className="flex-1 gap-1.5"
              >
                <Image className="w-3.5 h-3.5" />
                {t('settings.bg.type.image')}
              </Button>
            </div>
          </div>

          {/* 纯色设置 */}
          {type === 'color' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.bg.presetColors')}</Label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => setColor(preset.color)}
                      className={`w-12 h-12 rounded-xl border-2 transition-all ${
                        color === preset.color
                          ? 'border-primary scale-110 shadow-md'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: preset.color }}
                      title={t(`settings.bg.presetColor.${preset.key}`)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.bg.customColor')}</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer rounded-lg"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#1a1a2e"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 图片设置 */}
          {type === 'image' && (
            <div className="space-y-5">
              {/* 预设图片 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.bg.presetImages')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PRESET_IMAGES.map((preset) => (
                    <button
                      key={preset.url}
                      onClick={() => setImageUrl(preset.url)}
                      className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                        imageUrl === preset.url
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-transparent hover:ring-2 hover:ring-muted'
                      }`}
                      title={t(`settings.bg.presetImage.${preset.key}`)}
                    >
                      <img
                        src={preset.url}
                        alt={t(`settings.bg.presetImage.${preset.key}`)}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-sm py-2 text-center font-medium">
                        {t(`settings.bg.presetImage.${preset.key}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 自定义 URL */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.bg.customImage')}</Label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder={t('settings.bg.pasteUrl')}
                  className="w-full"
                />
              </div>

              {/* 适配方式 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" />
                  {t('settings.bg.size')}
                </Label>
                <Select value={size} onValueChange={(v) => setSize(v as BackgroundSize)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(`settings.bg.sizeOptions.${opt.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 透明度 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t('settings.bg.opacityPercent', { p: Math.round(opacity * 100) })}
                </Label>
                <Input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* 底部操作按钮 */}
        <div className="flex justify-between items-center pt-4 border-t mt-6">
          <Button variant="ghost" onClick={handleReset} size="sm" className="gap-1.5 text-muted-foreground">
            <RotateCcw className="w-3.5 h-3.5" />
            {t('settings.bg.reset')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} size="sm">
              {t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
