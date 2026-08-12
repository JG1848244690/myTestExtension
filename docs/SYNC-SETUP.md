# 云同步设置指南

本插件的"会话/书签云同步"功能依赖一个独立后端(本仓库的姊妹项目 `tasks-api` 的 `xy-newtab` 分支)。
本指南说明**一次性配置步骤**。

---

## 1. Google Cloud Console 配置(开发者做一次)

登录 [Google Cloud Console](https://console.cloud.google.com/) 完成下面几步:

### 1.1 创建项目(可选)
如果还没有 GCP 项目,创建一个新的(`项目名称` 任意)。

### 1.2 启用 API
- 左侧菜单 → "API 和服务" → "库"
- 搜索 **"Google Identity"** 或 **"Google+ API"**,点击启用

### 1.3 配置 OAuth 同意屏幕
- 左侧菜单 → "API 和服务" → "OAuth 同意屏幕"
- 用户类型选 **"外部"**(个人开发者),点创建
- 填写应用名称、用户支持邮箱、开发者联系邮箱 → 保存
- "范围" 步骤添加 `openid`、`email`、`profile`
- "测试用户" 添加你自己要测试的 Gmail

### 1.4 创建 OAuth 2.0 客户端 ID
- 左侧菜单 → "API 和服务" → "凭据"
- 顶部 → "创建凭据" → "OAuth 2.0 客户端 ID"
- 应用类型: **Web 应用**(因为 redirect 是 `chromiumapp.org`)
- 名称:任意(如 `myTestExtension dev`)
- **已授权的重定向 URI**: 添加一项:
  ```
  https://<EXTENSION_ID>.chromiumapp.org/
  ```
  `<EXTENSION_ID>` 是在 chrome://extensions 开发者模式加载后,扩展卡片上显示的 ID
  (如 `abcdefghijklmnopqrstuvwxyz123456`)
- 创建后会弹出 Client ID 和 Client Secret,**复制保存** ⚠️

---

## 2. 插件侧配置(开发者)

打开 `src/utils/syncConfig.ts`,把 `GOOGLE_CLIENT_ID` 改成你刚拿到的 Client ID:

```typescript
export const GOOGLE_CLIENT_ID = '1063346324199-xxxxx.apps.googleusercontent.com';
//                                  ↑ 填这里
```

**注意:**
- 只填 Client ID(公开信息),**Client Secret 绝对不要写进插件代码**
- Client Secret 只配在后端 `.env`

---

## 3. 后端侧配置(开发者)

后端在 `tasks-api` 仓库的 `xy-newtab` 分支。复制 `.env.example` 为 `.env`:

```bash
cd ../tasks-api
cp .env.example .env
```

填入:

```
GOOGLE_CLIENT_ID=1063346324199-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx    # ⚠️ 极度敏感
```

⚠️ **Client Secret 安全提示**:
- 这是用来在后端用 `code` 换 `access_token` 的密钥,等同于 OAuth 应用的"密码"
- **绝不能提交到 git**(.env 已在 .gitignore)
- **绝不能放进前端代码**(浏览器一加载就暴露)
- **绝不能贴到聊天、issue、邮件里** —应该立刻撤销 + 重新生成
- 上生产前考虑用 secret manager(Vault / AWS Secrets Manager / Doppler 等)

---

## 4. 跑起来

### 4.1 起后端
```bash
cd ../tasks-api   # xy-newtab 分支
pnpm install       # 首次
pnpm db:push       # 把 schema 推到 PG
pnpm dev           # 起 http://localhost:9999
```

### 4.2 起插件
```bash
cd myTestExtension
pnpm install
pnpm dev           # 起 wxt dev server
```

### 4.3 加载插件
1. 打开 Chrome,访问 `chrome://extensions`
2. 右上角打开"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `myTestExtension/.output/chrome-mv3/`(wxt dev 跑起来后才会有)
5. 记下扩展 ID(如 `abc...`),回到第 1.4 步把 redirect URI 补上,**回到 wxt dev 重新加载插件**(扩展 ID 会变)

### 4.4 登录测试
1. 点击扩展图标打开 popup
2. 切到"会话"标签
4. 点击 "Google 登录" 按钮
5. 浏览器弹出 Google 授权页,登录并同意
6. 回到 popup,看到你的头像和邮箱
7. 点击"上传到云端"或"从云端下载"测试同步

---

## 5. 常见问题

### Q: launchWebAuthFlow 报 "redirect_uri_mismatch"
**A:** Google Console 上配置的 redirect URI 必须和 `getExtensionId()` 拼出来的完全一致:
```
https://<扩展 ID>.chromiumapp.org/
```
注意最后那个斜杠不能漏。每次重载插件 ID 会变,要重新配置。

### Q: 后端报 "redirect_uri not allowed"
**A:** 插件发的 `redirectUri` 必须匹配 `GOOGLE_ALLOWED_REDIRECT_REGEX`(默认 `^https://[a-z]+\.chromiumapp\.org/$`)。如果用别的 redirect scheme,改这个变量。

### Q: 上传时 409 version mismatch
**A:** 云端版本比本地新(其他设备更新过)。UI 会弹窗提示,你选择下载再上传。

### Q: 怎么在多个设备间共享
- 两个 Chrome 都装同一个扩展,加载同一个 Google 账号登录就行
- 数据以 email 为 key,跨设备共享

---

## 6. 数据流总结

```
┌──────────────┐                          ┌──────────────┐
│  Popup       │  1. launchWebAuthFlow    │   Google     │
│  (chrome.*)  │  ──────────────────────> │ OAuth Server │
│              │  <─ ?code=xxx            │              │
│              │                          └──────────────┘
│              │
│              │  2. POST /sync/auth/google
│              │     { code, redirectUri }
│              │  ──────────────────────────────────────┐
│              │                                        │
│              │                                        ▼
│              │                          ┌──────────────────────┐
│              │                          │   后端 tasks-api     │
│              │                          │                      │
│              │                          │  3. POST /token      │
│              │                          │     code + id + sec  │──┐
│              │                          │                      │  │
│              │                          │  4. <─ access_token  │<─┘
│              │                          │                      │
│              │                          │  5. GET /userinfo    │──┐
│              │                          │                      │  │
│              │                          │  6. <─ user{...}     │<─┘
│              │                          │                      │
│              │                          │  7. upsert users    │
│              │                          │  8. INSERT session  │
│              │                          │                      │
│              │  9. <─ { sessionToken, user }
│              │  ──────────────────────────────────────┘
│              │
│              │  10. 缓存 sessionToken + user 到 local storage
│              │
│              │  11. 上传/下载: PUT/GET /sync/bookmarks
│              │      Authorization: Bearer <sessionToken>
└──────────────┘
```
