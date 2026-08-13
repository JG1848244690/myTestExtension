import { useState, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/src/components/ui/sheet';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Checkbox } from '@/src/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import {
  PRESET_COLORS,
  PRESET_IMAGES,
  SIZE_OPTIONS,
  DEFAULT_BACKGROUND_COLOR,
} from '@/src/utils/constants';
import type { BackgroundSetting, BackgroundType, BackgroundSize } from '@/src/utils/types';
import { Image, Palette, Maximize2, RotateCcw, Upload, Globe, Video, Volume2, VolumeX, Trash2 } from 'lucide-react';
import { useI18n, SUPPORTED_LOCALES, type Locale } from '@/src/i18n';
import { useSettingsStore } from '@/src/hooks/useSettingsStore';
import {
  saveBackgroundVideo,
  clearBackgroundVideo,
} from '@/src/utils/videoStorage';

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setting: BackgroundSetting;
  onSave: (setting: BackgroundSetting) => void;
}

/** 预设色 key → 词典 key 的映射(避免在 JSX 里嵌 i18n key) */
const PRESET_COLOR_KEY = {
  '#1a1a2e': 'midNightBlue',
  '#16213e': 'starPurple',
  '#0f0f23': 'geekBlack',
  '#1e3a3a': 'mintGreen',
  '#2d2d44': 'warmOrange',
  '#2e1f2e': 'rosePink',
  '#1a2a3a': 'glacierBlue',
  '#1a2e1a': 'forestGreen',
} as const;

/** 预设图 URL → 词典 key 的映射 */
const PRESET_IMAGE_KEY = {
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80': 'starry',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80': 'mountain',
  'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80': 'city',
  'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80': 'wave',
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80': 'forest',
  'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&q=80': 'sunset',
} as const;

export function SettingsSheet({
  open,
  onOpenChange,
  setting,
  onSave,
}: SettingsSheetProps) {
  const { t, locale } = useI18n();
  const { settings, setLanguage } = useSettingsStore();

  const [type, setType] = useState<BackgroundType>(setting.type || 'none');
  const [color, setColor] = useState(setting.color || DEFAULT_BACKGROUND_COLOR);
  const [imageUrl, setImageUrl] = useState(setting.imageUrl || '');
  const [size, setSize] = useState<BackgroundSize>(setting.size || 'cover');
  const [opacity, setOpacity] = useState(setting.opacity ?? 1);
  const [muted, setMuted] = useState(setting.muted ?? true);
  const [videoFileName, setVideoFileName] = useState(setting.videoFileName || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // 当弹窗打开时，同步最新设置
  useEffect(() => {
    if (open) {
      setType(setting.type || 'none');
      setColor(setting.color || DEFAULT_BACKGROUND_COLOR);
      setImageUrl(setting.imageUrl || '');
      setSize(setting.size || 'cover');
      setOpacity(setting.opacity ?? 1);
      setMuted(setting.muted ?? true);
      setVideoFileName(setting.videoFileName || '');
    }
  }, [open, setting]);

  // 即时保存
  const saveSetting = (newSetting: BackgroundSetting) => {
    onSave(newSetting);
  };

  // 类型变化时即时保存
  const handleTypeChange = (newType: BackgroundType) => {
    setType(newType);
    const newSetting: BackgroundSetting = {
      type: newType,
      ...(newType === 'color' && { color }),
      ...(newType === 'image' && { imageUrl, size, opacity }),
      ...(newType === 'video' && { videoFileName, muted, size, opacity }),
    };
    saveSetting(newSetting);
  };

  // 颜色变化时即时保存
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    if (type === 'color') {
      saveSetting({ type: 'color', color: newColor });
    }
  };

  // 图片URL变化时即时保存
  const handleImageUrlChange = (newUrl: string) => {
    setImageUrl(newUrl);
    if (type === 'image' && newUrl) {
      saveSetting({ type: 'image', imageUrl: newUrl, size, opacity });
    }
  };

  // 本地图片上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert(t('settings.bg.invalidType'));
      return;
    }

    // 检查文件大小 (限制 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert(t('settings.bg.tooLarge'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleImageUrlChange(dataUrl);
      }
    };
    reader.readAsDataURL(file);

    // 清空 input 以便重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 适配方式变化时即时保存
  const handleSizeChange = (newSize: BackgroundSize) => {
    setSize(newSize);
    if (type === 'image' && imageUrl) {
      saveSetting({ type: 'image', imageUrl, size: newSize, opacity });
    }
    if (type === 'video') {
      saveSetting({ type: 'video', videoFileName, muted, size: newSize, opacity });
    }
  };

  // 透明度变化时即时保存
  const handleOpacityChange = (newOpacity: number) => {
    setOpacity(newOpacity);
    if (type === 'image' && imageUrl) {
      saveSetting({ type: 'image', imageUrl, size, opacity: newOpacity });
    }
    if (type === 'video') {
      saveSetting({ type: 'video', videoFileName, muted, size, opacity: newOpacity });
    }
  };

  // 重置
  const handleReset = () => {
    setType('none');
    setColor(DEFAULT_BACKGROUND_COLOR);
    setImageUrl('');
    setSize('cover');
    setOpacity(1);
    setMuted(true);
    setVideoFileName('');
    void clearBackgroundVideo().catch(() => {});
    saveSetting({ type: 'none' });
    onOpenChange(false);
  };

  // 视频文件上传(本地用户自选的文件,无大小限制,只校验类型)
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 仅接受 mp4 / webm(简化版:只判断 mime + 扩展名)
    const ok =
      file.type.startsWith('video/mp4') ||
      file.type.startsWith('video/webm') ||
      file.name.toLowerCase().endsWith('.mp4') ||
      file.name.toLowerCase().endsWith('.webm');
    if (!ok) {
      alert(t('settings.bg.videoInvalidType'));
      return;
    }
    try {
      await saveBackgroundVideo(file, file.name);
      setVideoFileName(file.name);
      setType('video');
      saveSetting({
        type: 'video',
        videoFileName: file.name,
        muted,
        size,
        opacity,
      });
    } catch (err) {
      console.error('[bg] save video failed:', err);
      alert(t('settings.bg.videoSaveFailed'));
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // 删除当前视频
  const handleVideoRemove = async () => {
    await clearBackgroundVideo().catch(() => {});
    setVideoFileName('');
    saveSetting({ type: 'none' });
    setType('none');
  };

  // 静音切换
  const handleMutedChange = (newMuted: boolean) => {
    setMuted(newMuted);
    if (type === 'video') {
      saveSetting({ type: 'video', videoFileName, muted: newMuted, size, opacity });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-80 sm:max-w-80 overflow-y-auto
          bg-white/20 dark:bg-black/20
          backdrop-blur-xl
          border-l border-white/20 dark:border-black/10
          shadow-2xl shadow-black/10 dark:shadow-black/50
          data-[state=open]:animate-in data-[state=closed]:animate-out
          data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right
          duration-300"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            {t('settings.title')}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* 语言切换 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              {t('settings.language')}
            </Label>
            <Select value={settings.language ?? locale} onValueChange={(v) => setLanguage(v as Locale)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {t(`settings.languageOptions.${loc}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 背景类型选择 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('settings.bg.typeLabel')}</Label>
            <div className="flex gap-2">
              <Button
                variant={type === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeChange('none')}
                className="flex-1"
              >
                {t('settings.bg.type.none')}
              </Button>
              <Button
                variant={type === 'color' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeChange('color')}
                className="flex-1 gap-1.5"
              >
                <Palette className="w-3.5 h-3.5" />
                {t('settings.bg.type.color')}
              </Button>
              <Button
                variant={type === 'image' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeChange('image')}
                className="flex-1 gap-1.5"
              >
                <Image className="w-3.5 h-3.5" />
                {t('settings.bg.type.image')}
              </Button>
              <Button
                variant={type === 'video' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeChange('video')}
                className="flex-1 gap-1.5"
              >
                <Video className="w-3.5 h-3.5" />
                {t('settings.bg.type.video')}
              </Button>
            </div>
          </div>

          {/* 纯色设置 */}
          {type === 'color' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.bg.presetColors')}</Label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map((preset) => {
                    const colorKey = PRESET_COLOR_KEY[preset.color as keyof typeof PRESET_COLOR_KEY];
                    const colorName = colorKey ? t(`settings.bg.presetColor.${colorKey}`) : preset.name;
                    return (
                      <button
                        key={preset.color}
                        onClick={() => handleColorChange(preset.color)}
                        className={`w-10 h-10 rounded-xl border-2 transition-all ${
                          color === preset.color
                            ? 'border-primary scale-110 shadow-md'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset.color }}
                        title={colorName}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.bg.customColor')}</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer rounded-lg"
                  />
                  <Input
                    value={color}
                    onChange={(e) => handleColorChange(e.target.value)}
                    placeholder={DEFAULT_BACKGROUND_COLOR}
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
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_IMAGES.map((preset) => {
                    const imageKey = PRESET_IMAGE_KEY[preset.url as keyof typeof PRESET_IMAGE_KEY];
                    const imageName = imageKey ? t(`settings.bg.presetImage.${imageKey}`) : preset.name;
                    return (
                      <button
                        key={preset.url}
                        onClick={() => handleImageUrlChange(preset.url)}
                        className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                          imageUrl === preset.url
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-transparent hover:ring-2 hover:ring-muted'
                        }`}
                        title={imageName}
                      >
                        <img
                          src={preset.url}
                          alt={imageName}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent text-white text-xs py-1.5 text-center font-medium">
                          {imageName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 自定义图片 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t('settings.bg.customImage')}</Label>

                {/* 上传按钮 */}
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {t('settings.bg.uploadLocal')}
                  </Button>
                </div>

                {/* 分隔线 */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{t('settings.bg.or')}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* URL 输入 */}
                <Input
                  value={imageUrl}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  placeholder={t('settings.bg.pasteUrl')}
                  className="w-full"
                />

                {/* 当前图片预览 */}
                {imageUrl && !PRESET_IMAGES.some(p => p.url === imageUrl) && (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-white/20 dark:border-black/10">
                    <img
                      src={imageUrl}
                      alt={t('settings.bg.currentBg')}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
                    <span className="absolute bottom-2 left-2 text-xs text-white">
                      {t('settings.bg.currentBg')}
                    </span>
                  </div>
                )}
              </div>

              {/* 适配方式 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" />
                  {t('settings.bg.size')}
                </Label>
                <Select value={size} onValueChange={(v) => handleSizeChange(v as BackgroundSize)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((opt) => {
                      const SIZE_KEY = {
                        cover: 'cover',
                        contain: 'contain',
                        auto: 'auto',
                        '100% 100%': 'stretch',
                      } as const;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(`settings.bg.sizeOptions.${SIZE_KEY[opt.value]}`)}
                        </SelectItem>
                      );
                    })}
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
                  onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* 视频背景设置 */}
          {type === 'video' && (
            <div className="space-y-5">
              {/* 选择视频文件 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings.bg.videoFile')}</Label>
                <div className="flex gap-2">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,.mp4,.webm"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {videoFileName
                      ? t('settings.bg.videoReplace')
                      : t('settings.bg.videoUpload')}
                  </Button>
                  {videoFileName && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleVideoRemove}
                      title={t('settings.bg.videoRemove')}
                      className="text-destructive hover:text-destructive px-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {videoFileName && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                    <Video className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate flex-1" title={videoFileName}>{videoFileName}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('settings.bg.videoHint')}
                </p>
              </div>

              {/* 静音开关 */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  {t('settings.bg.videoMuted')}
                </Label>
                <Checkbox
                  checked={muted}
                  onCheckedChange={(v) => handleMutedChange(v === true)}
                />
              </div>

              {/* 适配方式 + 透明度 复用 image 的 state + Select */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" />
                  {t('settings.bg.size')}
                </Label>
                <Select value={size} onValueChange={(v) => handleSizeChange(v as BackgroundSize)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((opt) => {
                      const SIZE_KEY = {
                        cover: 'cover',
                        contain: 'contain',
                        auto: 'auto',
                        '100% 100%': 'stretch',
                      } as const;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(`settings.bg.sizeOptions.${SIZE_KEY[opt.value]}`)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

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
                  onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* 重置按钮 */}
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              onClick={handleReset}
              size="sm"
              className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('settings.bg.resetDefault')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}