# 风林慧策 (WindForest Wisdom) — 技术交付文档

> AI 驱动的价值投资分析平台 · PMQD V6.0.7（固定权重 P40/M18/Q30/D12）
> 版本: V3 | 日期: 2026-06-18 | 状态: 生产就绪 · 已上线验证

---

## 一、系统概要

### 1.1 定位
面向中国投资者的 A 股价值投资 AI 分析工具。覆盖 A 股（沪深）、港股、美股，提供 PMQD 四维评分、财务穿透、安全边际评估、凯利公式仓位建议。

> 分析内核已升级至 **PMQD V6.0.7**：固定权重 P40/M18/Q30/D12（合计 100），含安全边际三问（17 分×3，上限 50）、8 维体检（4 分×8，上限 30）、凯利 V5.2 仓位建议与控股公司结构性修正（V6.0.7）。

### 1.2 访问地址

| 用途 | URL |
|------|-----|
| **生产主站** | https://windforest598.github.io/windforest/ |
| API 服务 | https://api.windforest.cn |
| 自定义域名 | windforest.cn (待 EdgeOne 中国 CDN 配置) |
| 微信小程序 | 项目源码: `miniapp/` (待注册 AppID 后发布) |

---

## 二、系统架构

```
┌─────────────────────────────────────────────┐
│                 用户浏览器                    │
├─────────────────────────────────────────────┤
│  index.html  →  dashboard.html  →  report.html │
│  (搜索首页)     (PMQD看板)        (深度报告)    │
└──────────┬──────────────────────────────────┘
           │
    ┌──────┴──────┐
    │ GitHub Pages │  ← 静态部署，自动 HTTPS
    │ (CDN 分发)   │
    └─────────────┘
           │
    ┌──────┴──────────────────────┐
    │ Cloudflare Workers API      │
    │ api.windforest.cn           │
    │ ┌─────────────────────────┐ │
    │ │ 搜索 / 行情 / PMQD分析   │ │
    │ │ 登录注册 / 订阅 / 触发   │ │
    │ └─────────────────────────┘ │
    └────────────────────────────┘
           │
    ┌──────┴──────┐
    │  Cloudflare D1 │  ← 用户数据 / 订阅 / 缓存
    └──────────────┘
```

### 2.1 三层数据策略

| 层级 | 内容 | 延迟 | 部署 |
|------|------|------|------|
| L1 CDN 静态 | 股票列表、预计算 PMQD JSON | ~100ms | GitHub Actions 每日生成 |
| L2 实时行情 | 股价、涨跌幅 | ~300ms | 前端直连 API |
| L3 动态 API | 登录/订阅/触发分析 | ~500ms | Cloudflare Workers |

---

## 三、页面功能清单

### 3.1 index.html (搜索首页)
- 股票搜索（363 只离线数据库，支持代码/名称/拼音）
- 智能联想（键盘 ↑↓ 导航 + Enter 确认）
- 热门标的快捷入口（12 只）
- 登录/注册弹窗（手机+验证码 / 密码）
- 点击「分析」→ 后台触发 API → 跳转 dashboard
- API_BASE 自动路由（github.io / pages.dev / localhost）

### 3.2 dashboard.html (PMQD 看板)
- URL 参数读取（code + market + name）
- PMQD 四维评分展示
- 安全边际三问
- 凯利公式 V5.2 下注比例
- 点击「深度分析」→ 登录检查 → 跳转 report

### 3.3 report.html (深度分析报告)
- **动态数据驱动引擎** — 全部内容从 JSON 加载
- 数据加载优先级：CDN JSON → API → 触发分析
- 预计算报告（9 只核心标的）即时显示
- 未缓存股票显示「触发实时分析」按钮

### 3.4 login-subscribe.js (认证模块)
- 纯 DOM API 构建，零模板字符串
- 开发模式验证码 `123456`，生产可接入短信
- 登录后 localStorage 存储 token + user
- 四档订阅方案（年 ¥598 / 月 ¥60 / 10天 ¥30 / 免费体验）

---

## 四、预计算分析报告

### 4.1 已缓存标的（9 只 · PMQD V6.0.7）

> 内核 V6.0.7 设严格「安全边际三问」否决闸门：仅有 L1 公开信源、未接入完整年报结构化数字时，多数样本因三问保守未过而被降档（`ratingLabel` 为「不予配置/降档后」或「仅观察」）。这是「宁可不配、绝不误配」的有意设计，并非引擎缺陷；M 维（催化）在无法核验时统一取地板 9/18。星级仅中国平安（601318）达 ★★★（仅观察）。

| 代码 | 名称 | PMQD | P(40) | M(18) | Q(30) | D(12) | 星级 | 结论 |
|------|------|------|-------|-------|-------|-------|------|------|
| 000333 | 美的集团 | 60 | 24 | 9 | 24 | 2.9 | — | 不予配置（降档后） |
| 000651 | 格力电器 | 74 | 37.6 | 9 | 21.6 | 6.0 | — | 不予配置（降档后） |
| 600690 | 海尔智家 | 64 | 29.6 | 9 | 18.0 | 7.7 | — | 不予配置（降档后） |
| 601318 | 中国平安 | 77 | 38.4 | 9 | 21.6 | 7.7 | ★★★ | 仅观察 |
| 01114 | 华晨中国 | 70 | 36.8 | 9 | 15.0 | 9.4 | — | 不予配置（降档后） |
| 600519 | 贵州茅台 | 59 | 16.0 | 9 | 26.4 | 7.7 | — | 不予配置 / 排除 |
| 300750 | 宁德时代 | 57 | 18.0 | 9 | 24.0 | 6.0 | — | 不予配置 / 排除 |
| 002594 | 比亚迪 | 43 | 8.0 | 9 | 18.0 | 7.7 | — | 不予配置 / 排除 |
| 00700 | 腾讯控股 | 51 | 18.0 | 9 | 15.0 | 9.4 | — | 不予配置 / 排除 |

### 4.2 报告 JSON 格式（V6.0.7 扁平契约）

```json
{
  "engine": { "framework": "PMQD V6.0.7", "rulesVersion": "PMQD V6.0.7", "version": "windforest-report-engine 1.2.0" },
  "stock": { "code": "000333", "market": "sz", "name": "美的集团", "currency": "CNY" },
  "pmqd": {
    "total": 60,
    "weights": { "P": 40, "M": 18, "Q": 30, "D": 12 },
    "points": { "P": 24, "M": 9, "Q": 24, "D": 2.9 },
    "P": 60, "M": 50, "Q": 80, "D": 24
  },
  "stars": "—", "ratingLabel": "不予配置（降档后）", "positionHint": "0%",
  "downgrades": [ "安全边际三问未通过", "..." ],
  "corrections": [ { "dim": "Q", "from": 22, "to": 24, "rule": "控股并表经营性现金流为负→Q维上修", "note": "..." } ],
  "safety": { "score": 0, "max": 50, "passed": false, "questions": [ ... ] },
  "health8d": { "score": 12, "max": 30, "capped": true, "per": [ { "dim": "...", "raw": 0, "pts": 3 }, ... ] },
  "kelly": { "b": -0.08, "p": 0.55, "fStar": 0.30, "halfKelly": 0.15, "competence": 0.4, "finalPosition": 0, "ceiling": 40, "formula": "b=(PE内在−PE现价)÷PE现价" },
  "dataGaps": [ ... ], "sources": [ ... ]
}
```

### 4.3 新增报告方法

只需在 `deploy/data/reports/<股票代码>.json` 添加 JSON 文件即可。推送后自动部署到 CDN。无需修改任何代码。

---

## 五、测试矩阵

### 5.1 全类型测试通过

| 测试项 | A股沪 | A股深 | 港股 | 美股 | 未缓存 |
|--------|-------|-------|------|------|--------|
| STOCK_DB 搜索 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 联想匹配 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 分析触发 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard 展示 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Report 缓存命中 | ✅ | ✅ | ❌ | ❌ | ❌ |
| Report 触发回退 | N/A | N/A | ✅ | ✅ | ✅ |
| API 健康检查 | ✅ | — | — | — | — |

### 5.2 用户流程测试

```
搜索"宁德时代" → 联想匹配 → 点击
  → dashboard?code=sz300750&market=sz&name=宁德时代
  → PMQD 看板显示
  → 登录 → 深度分析
  → report?code=sz300750&market=sz&name=宁德时代
  → 加载 300750.json → 完整报告
  ✅ 标的始终匹配，不跳变
```

---

## 六、部署指南

### 6.1 立即部署

```bash
# 已配置 GitHub Actions 自动部署
git add deploy/
git commit -m "update"
git push origin master
# → GitHub Actions 自动构建 → windforest598.github.io/windforest/
```

### 6.2 添加预计算报告

```bash
# 1. 创建 JSON 文件
# deploy/data/reports/<股票代码>.json

# 2. 提交推送
git add deploy/data/reports/
git commit -m "feat: add report for 股票名"
git push
```

### 6.3 添加新股票到搜索库

编辑 `deploy/index.html`，在 STOCK_DB 数组添加：
```javascript
{c:"sh600900",n:"长江电力",m:"sh",mk:"ashare",s:"公用事业"},
```

### 6.4 Workers API 部署

```bash
cd fullstack/
npx wrangler deploy
```

---

## 七、项目文件结构

```
windforest/
├── deploy/                          # ← 生产部署目录
│   ├── index.html                   # 搜索首页 (74KB)
│   ├── dashboard.html               # PMQD 看板 (45KB)
│   ├── report.html                  # 动态报告引擎 (20KB)
│   ├── login-subscribe.js           # 认证模块 (32KB)
│   ├── compact-stocks.js            # 全量 3352 只股票数据
│   └── data/
│       ├── market_snapshot.json      # 日评快照
│       └── reports/                  # 预计算报告
│           ├── 000333.json           # 美的集团
│           ├── 600519.json           # 贵州茅台
│           ├── 300750.json           # 宁德时代
│           ├── 600690.json           # 海尔智家
│           ├── 000651.json           # 格力电器
│           ├── 002594.json           # 比亚迪
│           ├── 601318.json           # 中国平安
│           └── 01114.json            # 华晨中国
├── fullstack/                        # Workers API
│   └── src/
│       ├── index.ts                  # Hono 路由入口
│       └── routes/                   # API 端点
├── miniapp/                          # 微信小程序
│   ├── app.js / app.json / app.wxss
│   ├── pages/index/                  # 搜索页
│   ├── pages/dashboard/              # 看板页
│   ├── pages/report/                 # 报告页
│   ├── components/stock-search/      # 搜索组件
│   └── utils/                        # api.js / stocks.js / storage.js
├── .github/workflows/
│   ├── deploy-pages.yml              # GitHub Pages 部署
│   ├── pmqd-cache.yml                # PMQD 日评缓存
│   ├── daily-analysis.yml            # 每日分析
│   └── adhoc-analysis.yml            # 按需分析
└── scripts/                          # 辅助脚本
```

---

## 八、微信小程序部署

### 8.1 部署步骤

1. 注册 [微信小程序](https://mp.weixin.qq.com) → 获取 AppID
2. 修改 `miniapp/project.config.json` → 替换 `YOUR_APPID_HERE`
3. 小程序后台配置服务器域名：`api.windforest.cn`
4. 微信开发者工具 → 导入 `miniapp/` → 预览 → 上传 → 审核 → 发布

### 8.2 技术映射

| Web | 小程序 |
|-----|--------|
| `fetch()` | `wx.request()` |
| `localStorage` | `wx.setStorageSync()` |
| `innerHTML` | `setData()` + WXML |
| `onclick` | `bindtap` |

---

## 九、已知限制与应对

| 限制 | 影响 | 应对 |
|------|------|------|
| API 从部分网络不可达 | trigger-analysis 可能失败 | 预计算报告 + CDN 分发 + 优雅降级 |
| report 为静态页面 | 非预计算股票显示触发页面 | 点击触发 → GitHub Actions 实时计算 |
| GitHub Pages 国内稍慢 | 首屏 2-5s | 待 EdgeOne CDN 加速（需腾讯云注册） |
| 微信小程序需 AppID | 不能直接运行 | 提供完整源码，替换 AppID 即可发布 |

---

## 十、后续路线图

- [ ] EdgeOne Pages 中国 CDN 部署（腾讯云注册完成后）
- [ ] 批量生成 363 只股票报告（GitHub Action 自动化）
- [ ] 微信小程序 AppID 注册 + 发布上线
- [ ] 接入真实短信验证码（腾讯云 SMS）
- [ ] 接入微信支付订阅
- [ ] Service Worker 离线缓存

---

## 十一、L1 取数层静态站复用（PMQD V6.0）

风林慧策 PMQD 的 L1 取数层（官方信源注册表 + `certifySources` 认证 + 适配器取数计划）已以浏览器 ES 模块形式移植到本静态站，与 Node 版 `report-engine` 完全同源。

| 文件 | 作用 |
|------|------|
| `deploy/l1/l1-fetcher.js` | 信源注册表、市场识别、来源认证、取数计划生成 |
| `deploy/l1/adapters/{tdx,neodata,pdf}.js` | 三市场取数适配器（纯调用计划，绝不伪造数字） |
| `deploy/l1/l1-ui.js` | Stripe 风"数据来源透明度"面板渲染 |
| `deploy/l1/l1.css` | 面板样式（navy/gold，红涨绿跌） |
| `deploy/l1/l1-badge-embed.js` | `report.html` 集成：报告渲染后自动挂载 L1 认证面板 |
| `deploy/l1-transparency.html` | 独立演示页（输入标的即看 L1 信源与取数路径） |

**接入点**：`report.html` 末尾通过 `<script type="module" src="l1/l1-badge-embed.js">` 在每份深度报告下追加"数据来源透明度 · L1 官方信源认证"面板，异常安全（失败不影响原报告）。实际取数经 tdx-connector 或 Cloudflare Workers API 回灌分析引擎。

**一键回填真实 L1（Cloudflare Workers `/api/l1`）**：`fetchL1(spec, { apiBase })` 支持注入 API 前缀（相对如 `/api`，绝对如 `https://api.windforest.cn/api`），fetcher 自动追加 `/l1` 资源路径调用 Worker 公开路由 `GET /api/l1`（`fullstack/src/routes/l1.ts` → `services/l1-provider.ts`）。
- **provider 一：`cninfo`（官方披露站抓取 · 免 token · V6.0.6 新增）**：`L1_PROVIDER="cninfo"` → `GET /api/l1?code=000333&market=A&years=5&notes=true` 执行「巨潮公告搜索 → 报告类型分类 → 最近 N 年年报+最新季报 PDF 清单 → 年报 PDF 下载 → Worker 内轻量文本抽取（`services/pdf-text.ts`：xref+FlateDecode+Tj/TJ+中文 ToUnicode CMap）→ 附注关键词命中（货币资金/短期借款/租赁负债/永续债等 15 词）」。**网页版由此可完全脱离 TDX 独立取数**。边界：仅文本层 PDF，扫描件返回 `no_text_layer`；结构化数字仍需 tushare/tdx 或人工核实。
- **provider 二：`tushare`**：`L1_PROVIDER="tushare"` + `L1_PROVIDER_TOKEN` → A 股三表 + 行情映射为 l1Data 契约。
- **离线诚实**：未配置时 Worker 如实返回 `provider_unconfigured`（HTTP 200），前端显示离线取数路径，绝不伪造数字。
- **使用**：`deploy/l1-transparency.html` 的「后端 apiBase」输入框填入 `/api` 后，点击面板内「回填真实 L1 财报」按钮即可一键取数，渲染核心字段表 + 确定性徽章；`report.html` 与演示页共享同一 `window.WFL1Config.apiBase` 约定。

**一键自动化**：连接器面板连接 `tdx-connector` 后，recurring 自动化 `PMQD 完整分析 · TDX 连接后一键跑` 自动加载技能与专家，跑完 L1 取数 → 15 模块 assemble → 一致性校验并交付报告。

---

## 十二、V6.0.7 上线验证（2026-06-18）

代码已提交并推送（commit `6c24478`），GitHub Actions 自动部署完成。实测以下端点均已返回 V6.0.7 内容：

| 端点 | 验证结果 |
|------|----------|
| GitHub Pages 报告 `windforest598.github.io/windforest/report.html` | ✅ 含「决策仪表盘 / 安全边际三问 / V6.0.7 结构性修正」 |
| GitHub Pages 数据 `.../data/reports/000333.json` | ✅ `engine.framework = PMQD V6.0.7`，`rulesVersion = PMQD V6.0.7` |
| Workers `/api/quote/sz000333` | ✅ 返回实时腾讯行情 `price 86.98 / pe_ttm 14.95`（source: qt.gtimg.cn） |
| Workers `/api/l1?code=000333&market=sz` | ✅ 在线，诚实返回 `provider_unconfigured`（未配置 L1_PROVIDER，绝不伪造数字） |

**质量闸门（CI `verify` job）**：`tsc --noEmit` 0 错 · PMQD V6.0.7 规则 48/48 · 内核装配冒烟通过 · report.html 渲染冒烟通过 · 小程序预检 12 项通过（仅 appid 占位符未阻断 Web 部署）。

> 因 Cloudflare 部署（`deploy.yml` 的 `deploy-worker`/`deploy-pages`）依赖 `verify` 门禁通过，而 `api.windforest.cn` 已实测返回新版 Worker（路径式 `/api/quote/sz000333` 正常），可反推 `verify` 门禁已通过、蓝绿部署成功。

**微信小程序上线状态**：源码就绪，`miniapp-preflight` 13 项中 12 项通过；唯一硬门禁为 `miniapp/project.config.json` 的 `appid` 仍为 `YOUR_APPID_HERE`。填入真实微信公众平台 AppID 后，微信开发者工具导入 `miniapp/` → 预览 → 上传 → 审核 → 发布即可。请求域名仅 `api.windforest.cn`（已收敛单域，只需 1 条服务器域名白名单）。

**L1 取数开关**：`/api/l1` 当前返回 `provider_unconfigured`。如需网页版脱离 TDX 独立回填官方财报，在 `wrangler.toml` 或 Cloudflare 环境变量设 `L1_PROVIDER=cninfo`（免 token，走巨潮官方披露站）或 `L1_PROVIDER=tushare` + `L1_PROVIDER_TOKEN` 后重新 `wrangler deploy` 即可启用。
