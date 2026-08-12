# 无感云同步 - 交接文档

## 已完成（可工作）

### 1. 核心模块 `src/utils/syncAuto.ts`
完整存在，导出：
- `setupSyncAuto()` - background 启动时调用
- `queuePush(scope: "bookmarks" | "sessions")` - hooks 调用
- `syncAll()` - 完整同步两边
- `syncOneScope(scope)` - 单 scope 同步
- `mergeBookmarks(local, server)` - per-item last-write-wins by updatedAt
- `mergeSessions(local, server)` - 同样按 createdAt 取较新

### 2. 配置文件 `src/utils/syncConfig.ts`
- `SYNC_API_BASE_URL = "http://localhost:9999"`
- `GOOGLE_CLIENT_ID` - 用户已配置
- `SYNC_API.GOOGLE_LOGOUT = "/sync/auth/google"`
- `SYNC_LOCAL_KEYS.SESSION_TOKEN = "local:sync.sessionToken"`
- `SYNC_LOCAL_KEYS.USER = "local:sync.user"`

### 3. Google Auth `src/utils/googleAuth.ts`
- `loginWithGoogle()` - launchWebAuthFlow 拿 code -> 发后端 -> 拿 sessionToken
- `saveLoginLocally(sessionToken, user)`
- `clearLoginLocally()`
- `readSessionToken()`
- `readCurrentUser()`
- `decodeIdToken()` (id_token JWT 解析)

### 4. `messaging/index.ts`
**已更新**，新增/删除：
- 新增 `'sync/queue-push': (data: { scope: "bookmarks" | "sessions" }) => void`
- 新增 `'sync/on-new-tab': () => { ok: boolean }`
- 保留 `'auth/login'`, `'auth/logout'`, `'auth/get-user'`
- **删除**所有 `'bookmarks/sync-*'`, `'tab-sessions/sync-*'` 消息

### 5. `entrypoints/background.ts`
**部分完成**：
- 已加 `'sync/queue-push'` 和 `'sync/on-new-tab'` handlers
- 已加 `'auth/login'`, `'auth/logout'`, `'auth/get-user'` handlers
- **⚠️ 缺失 imports**：需要加
  ```typescript
  import { setupSyncAuto, syncAll, queuePush } from "@/src/utils/syncAuto";
  import {
    loginWithGoogle,
    saveLoginLocally,
    readSessionToken,
    readCurrentUser,
    clearLoginLocally,
  } from "@/src/utils/googleAuth";
  import { SYNC_API_BASE_URL, SYNC_API } from "@/src/utils/syncConfig";
  ```
- **⚠️ 调用 setupSyncAuto()** 在 defineBackground 内、console.log 之后
- 还残留 `buildBookmarkPayload` 函数（没人用了，可以删）

## 需要完成的步骤

### 步骤 1: 修 `entrypoints/background.ts`

1. 添加缺失的 imports（看上面）
2. 在 defineBackground 内 console.log 后加 `setupSyncAuto().catch(...)`
3. 删除未使用的 `buildBookmarkPayload` 函数（搜索 `const buildBookmarkPayload`）
4. 删除未使用的 imports: `SyncResult` 如果没用了、`TabSession`、`ShortcutGroup` 看情况
5. 跑 `tsc --noEmit` 确认 0 错误

### 步骤 2: 删 `src/components/ImportExportDialog.tsx` 的同步 UI
删除：
- `handleSyncUpload` 函数
- `handleSyncDownload` 函数
- 所有 `CloudUpload`/`CloudDownload` 相关 JSX（"书签同步" 那块）
- 删掉 `syncing` state、`lastSyncAt` state
- imports 里的 `CloudUpload`, `CloudDownload` 不再用了可以删
- 删 `syncConfig` 的 import 如果不再用

### 步骤 3: 删 `entrypoints/popup/SessionTab.tsx` 的同步 UI
删除：
- "会话云同步"区域整个 JSX 块（"上次同步" 行 + 两个按钮 + "⚠️ 会话存档请..." 那行）
- `handleSyncUpload` 和 `handleSyncDownload` 函数
- `syncing` state, `lastSyncAt` state
- 但 **保留**：登录态那块（currentUser 显示、Google 登录按钮、退出按钮）

### 步骤 4: 在 `entrypoints/newtab/App.tsx` 挂载时触发 sync
在 `useEffect` 里加：
```typescript
useEffect(() => {
  if (storesReady) {
    sendMessage("sync/on-new-tab", undefined).catch(console.warn);
  }
}, [storesReady]);
```
import `sendMessage` from `@/messaging`

### 步骤 5: hooks 在 mutation 后 queue push
在 `src/hooks/useShortcutsStore.ts` 和 `src/hooks/useGroupsStore.ts` 里：
- import `sendMessage` from `@/messaging`
- 在每个返回的 action wrapper 里调 `void sendMessage("sync/queue-push", { scope: "bookmarks" })`

**但是 hooks 调用 sendMessage 会跨 context (UI → background)，可能有性能问题**。
更优雅的方案：在 `src/store/shortcuts.ts` 和 `src/store/groups.ts` 的 `scheduleWrite` 里调：
```typescript
import { sendMessage } from "@/messaging";

const scheduleWrite = (value) => {
  // ... 现有逻辑 ...
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    // 现有 flush 逻辑
    if (v) {
      cell.write(v).catch(...);
      // 写完后通知 background
      void sendMessage("sync/queue-push", { scope: "bookmarks" });
    }
  }, 50);
};
```

这样所有 mutation（不论从哪个 hook 触发）都会自动排队 push。

注意：`sendMessage` 在 store 里调用是 fire-and-forget，会触发 background 的 queuePush。

### 步骤 6: SessionTab 里的 `auth/get-user` 仍然要保留
只是 `bookmarks/sync-upload` 等消息删了。SessionTab 的 `sendMessage("auth/login"...)`, `sendMessage("auth/get-user"...)`, `sendMessage("auth/logout"...)` 都保留。

### 步骤 7: build & test
1. `pnpm build:dev` 或直接 `wxt build -b chrome -m development`
2. 加载到 chrome://extensions
3. 测试场景：
   - 未登录 -> 加书签 -> 关闭 -> 重开 -> 书签还在（纯本地）
   - 登录 -> 立刻触发 syncAll() -> 后端有数据了
   - 登录后加书签 -> debounce 1s 后服务端收到
   - 开新标签页 -> 触发 sync/on-new-tab -> 拉到云端数据

### 步骤 8: 完成后端也跑起来
后端在 `D:\code-gh\tasks-api` 的 `xy-newtab` 分支，跑 `pnpm dev`（确保 .env 有 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET）。

## 测试场景 checklist

- [ ] 未登录时所有 mutation 工作正常，不报错
- [ ] 登录瞬间触发 syncAll，看到后端日志有 GET + PUT 请求
- [ ] 登录后加书签，1 秒内服务端收到
- [ ] 在另一台设备登录同一 Google 账号，开新标签页能拉到第一台设备的书签
- [ ] 两台设备同时改不同书签，都能保存（last-write-wins 不冲突）
- [ ] 网络断开时 mutation 不报错（push 静默失败）
- [ ] 401 时 token 自动清，UI 显示未登录

## 关键文件位置

```
src/utils/
├── syncAuto.ts          <- 核心 sync 逻辑 ✅
├── syncApi.ts           <- HTTP 客户端（不变）
├── syncConfig.ts        <- 配置 ✅
└── googleAuth.ts        <- OAuth ✅

messaging/index.ts          <- ✅ 已更新

entrypoints/
├── background.ts         <- ⚠️ 缺 imports，需要补
├── newtab/App.tsx        <- 需加 sync/on-new-tab 调用
└── popup/SessionTab.tsx  <- 需删同步 UI

src/components/
└── ImportExportDialog.tsx <- 需删同步 UI

src/store/
├── shortcuts.ts          <- 可选: 在 scheduleWrite 里 queue push
└── groups.ts             <- 同上
