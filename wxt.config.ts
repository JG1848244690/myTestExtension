import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  vite: () => ({
    plugins: [tailwindcss()],
  }),

  manifest: {
    name: '序言',
    description: '简洁高效的新标签页',
    permissions: ['storage', 'tabs', 'bookmarks', 'identity', 'identity.email'],
    host_permissions: [
      'https://www.google.com/*',
      'https://*.google.com/*',
      'https://*.gstatic.com/*',
      'https://favicon.im/*',
      'https://icons.duckduckgo.com/*',
      'https://icon.horse/*',
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
  },
});
