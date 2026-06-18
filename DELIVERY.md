# 风林慧策 (WindForest Wisdom) — 技术交付文档

> AI 驱动的价值投资分析平台 · PMQD V5.9
> 版本: V3 | 日期: 2026-06-18 | 状态: 生产就绪

---

## 一、系统概要

### 1.1 定位
面向中国投资者的 A 股价值投资 AI 分析工具。覆盖 A 股（沪深）、港股、美股，提供 PMQD 四维评分、财务穿透、安全边际评估、凯利公式仓位建议。

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
- 预计算报告（8 只核心标的）即时显示
- 未缓存股票显示「触发实时分析」按钮

### 3.4 login-subscribe.js (认证模块)
- 纯 DOM API 构建，零模板字符串
- 开发模式验证码 `123456`，生产可接入短信
- 登录后 localStorage 存储 token + user
- 四档订阅方案（年 ¥598 / 月 ¥60 / 10天 ¥30 / 免费体验）

---

## 四、预计算分析报告

### 4.1 已缓存标的（8 只）

| 代码 | 名称 | PMQD | PE | ROE | 股息率 |
|------|------|------|-----|-----|--------|
| 000333 | 美的集团 | 72 | 13.6× | 28.3% | 4.2% |
| 600519 | 贵州茅台 | 68 | 22.5× | 32.5% | 2.8% |
| 300750 | 宁德时代 | 58 | 18.5× | 22.1% | 1.5% |
| 600690 | 海尔智家 | 70 | 14.5× | 17.2% | 3.5% |
| 000651 | 格力电器 | 64 | 8.5× | 22.5% | 6.8% |
| 002594 | 比亚迪 | 62 | 28.0× | 18.0% | 1.2% |
| 601318 | 中国平安 | 66 | 7.5× | 14.0% | 5.2% |
| 01114 | 华晨中国 | 48 | 6.5× | 8.5% | 12.0% |

### 4.2 报告 JSON 格式

```json
{
  "meta": { "stock": {"code":"000333","market":"sz","name":"美的集团"}, "engine":"PMQD V5.9" },
  "pmqd": { "total":72, "verdict":"优质低估", "dimensions":{...} },
  "valuation": { "pe":13.63, "pb":2.85, "roe":28.3, ... },
  "kelly": { "f":18.5, "verdict":"适度配置" },
  "safety": [...], "health": [...], "finance_rules": [...],
  "debt": [...], "insights": [...], "risks": [...]
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
