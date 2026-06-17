# 风林慧策 — 零成本全栈部署 · 操作指南 (D1 版)

## 架构升级：Turso → Cloudflare D1

原方案使用 Turso (LibSQL) 数据库，需要单独注册 Turso 账号并通过 GitHub OAuth 登录——在 Windows 环境下经常卡在 OAuth 流程。

**新方案：全 Cloudflare 技术栈**，零额外注册：
- 前端：Cloudflare Pages
- API：Cloudflare Workers (Hono + TypeScript)
- 数据库：Cloudflare D1 (SQLite 兼容，Workers 原生绑定)
- 计算：GitHub Actions

**全部在同一账号体系下，天然打通，零成本。**

---

## 你需要做的事（4 步，约 10 分钟）

### 第 1 步：创建 D1 数据库

1. 打开 https://dash.cloudflare.com，登录你的 Cloudflare 账号
2. 左侧菜单点 **Workers & Pages**
3. 顶部切到 **D1** 标签
4. 点 **Create database**
5. 名字填 `windforest-db`，确定

> 免费额度：每月 500 万行读取 + 10 万行写入，完全够用。

### 第 2 步：初始化数据库（建表 + 种子数据）

创建完成后，在 D1 数据库详情页切到 **Console** 标签，依次执行以下 SQL：

**建表**（复制 `fullstack/src/db/schema.sql` 全部内容粘贴到 Console 执行）

或者用 wrangler CLI 一键执行：

```bash
cd fullstack
npx wrangler d1 execute windforest-db --file=src/db/schema.sql
npx wrangler d1 execute windforest-db --file=src/db/seed.sql
```

### 第 3 步：获取 D1 database_id

在 D1 数据库详情页，你会看到类似这样的 ID：
```
windforest-db (ID: abc123-def456-ghi789)
```

把这个 ID 填到 `wrangler.toml` 的 `database_id` 字段：

```toml
[[d1_databases]]
binding = "DB"
database_name = "windforest-db"
database_id = "abc123-def456-ghi789"   # ← 替换为你的实际 ID
```

### 第 4 步：告诉我以下信息，我来完成部署

完成以上 3 步后，告诉我：
- D1 数据库的 `database_id`（从 Cloudflare Dashboard 复制）

然后我会帮你：
1. 初始化数据库（如果还没执行 SQL）
2. 部署 Workers API 到 Cloudflare
3. 部署前端 Pages

---

## 部署架构图

```
用户浏览器
    │
    ▼
Cloudflare Pages (windforest.pages.dev)
index.html / dashboard.html / report.html
    │ fetch /api/search, /api/auth, ...
    ▼
Cloudflare Workers (windforest-api.workers.dev)
Hono + TypeScript + JWT 鉴权
    │ c.env.DB (D1 binding)
    ▼
Cloudflare D1 (windforest-db)
178 只股票 + PMQD 分析缓存 + 用户订阅
    │
    ▼ (每日 08:00 自动)
GitHub Actions
每日 PMQD 分析 + 订阅邮件通知
```

---

## 成本：$0/月

| 服务 | 免费额度 | 实际用量 |
|------|----------|----------|
| Cloudflare Pages | 无限请求 | ~1000/天 |
| Cloudflare Workers | 10万请求/天 | ~5000/天 |
| Cloudflare D1 | 500万行读/月 + 10万行写/月 | <100万行 |
| GitHub Actions | 2000分钟/月 | ~60分钟/月 |
| **总计** | | **$0** |

---

## 与旧方案 (Turso) 的对比

| 维度 | Turso (旧) | D1 (新) |
|------|-----------|---------|
| 账号注册 | 需要单独注册 Turso | 零额外，Cloudflare 已有 |
| 登录方式 | 仅 GitHub OAuth (Windows 常卡) | Cloudflare 邮箱登录 |
| Workers 集成 | 通过 HTTP 客户端 | 原生 binding，零延迟 |
| SQL 兼容性 | LibSQL (SQLite 超集) | SQLite 标准 |
| 免费额度 | 10GB / 10亿行读 | 500万行读 / 10万行写 |
| 管理界面 | CLI 为主 | Dashboard Console |

---

## 已完成的代码迁移

1. ✅ `src/db/client.ts` — `@libsql/client` → D1 `c.env.DB` binding
2. ✅ 所有 8 个路由文件 — `getTursoClient()` → `getDB(c)`
3. ✅ `src/db/schema.sql` — 注释更新为 D1
4. ✅ `src/db/seed.sql` — 178 只股票种子数据
5. ✅ `package.json` — 移除 `@libsql/client` 依赖
6. ✅ `wrangler.toml` — 添加 `[[d1_databases]]` 绑定
7. ✅ `scripts/` — 全部改为 `wrangler d1 execute` + `d1-helper.ts`
8. ✅ D1 API 调用模式：`db.prepare(sql).bind(...).first()/.all()/.run()`

---

## 快速命令参考

```bash
# 本地开发
cd fullstack
npm run dev

# 部署 Workers API
npx wrangler deploy

# 部署前端 Pages
npx wrangler pages deploy public --project-name=windforest

# 数据库操作
npx wrangler d1 execute windforest-db --file=src/db/schema.sql
npx wrangler d1 execute windforest-db --file=src/db/seed.sql
npx wrangler d1 execute windforest-db --command="SELECT COUNT(*) FROM stocks"

# 导入分析种子数据
npx tsx scripts/seed-database.ts
```
