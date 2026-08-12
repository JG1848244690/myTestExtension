import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  vite: () => ({
    plugins: [tailwindcss()],
  }),

  manifest: ({ browser }) => ({
    name: '序言',
    description: '简洁高效的新标签页',
    // ===== 固定 Chrome 扩展 ID =====
    // 填的是公钥(SPKI DER base64)。Chrome 算 ID 用 SHA256(public_key_der),
    // 填公钥跟填私钥算出的 ID 一致。配套商店 ID: lanccjojcmdklbhnbmbfemiabnpbgoga
    // 来源:Web Store 后台 "View public key" 复制的 PEM 格式公钥。
    // 本地 build + unpacked / zip 加载 → ID = lanccjojcmdklbhnbmbfemiabnpbgoga
    // (与商店分配的 ID 一致,OAuth redirect_uri 不再 mismatch)
    //
    // 上传 Web Store 时:商店会拒绝 manifest.key 字段,所以上传前需要手动剔除
    //(本地 build → 解压 zip → 删 manifest.json 的 key 字段 → 重打 zip → 上传)。
    // Edge 不接受 manifest.key(Edge Add-ons 政策),仅 chrome 构建注入。
    ...(browser === 'chrome'
      ? {
          key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtwviahYyO4WgRBeskNPGEbc3d+n3azzZbiz4gdl7QGtWsyXe5EI5RZc93t8sTrGpFsO50W5DGqm/NP2/SeFz3K43KLAVzqlllAtLCYm4YLCn+M1a3U+sxYMUERGiRwmfxvs+/3njQkkTdhbUDz39HOxxtCaoYpmPnA+9nqZVcNUMvJU9OgHu0hUmo4n/tRCyDkIyPrjYFPboJ6njXMsL/7q3poB1Is9u1LiT+uxGxuukB0RZs8sB+gxM3X3XjkyaX1Z3+J1+tVb0d8IxiYJjEFCKkYAZDjiOOZb3O6QGEOFHNb+ZysFDYJzMaZ9tW9pt9ruUP3igwPTkkzCdAzwxfQIDAQAB',
        }
      : {}),

    // launchWebAuthFlow 只需要 identity 权限(不要 identity.email,那是 getAuthToken 才需要)
    permissions: ['storage', 'tabs', 'bookmarks', 'identity'],
    host_permissions: [
      'https://www.google.com/*',
      'https://*.google.com/*',
      'https://*.gstatic.com/*',
      'https://favicon.im/*',
      'https://icons.duckduckgo.com/*',
      'https://icon.horse/*',
      // xy-tab 后端:nginx /api/* 反代到容器内 :9999
      'https://kskbl.com.cn/*',
    ],
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Y',
          mac: 'Command+Y',
        },
        description: '打开快捷搜索面板',
      },
    },
  }),
});
