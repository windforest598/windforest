# 风林慧策 微信小程序

> AI 驱动的价值投资分析平台 — 微信小程序版

## 快速部署

### 1. 注册小程序账号
前往 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册微信小程序账号，获取 **AppID**。

### 2. 配置 AppID
打开 `project.config.json`，将 `"appid": "YOUR_APPID_HERE"` 替换为你的 AppID。

### 3. 配置 API 域名白名单
登录小程序后台 → 开发管理 → 开发设置 → 服务器域名：
- **request 合法域名**：`https://api.windforest.cn`
- **request 合法域名**：`https://windforest598.github.io`

### 4. 打开项目
1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目 → 选择 `miniapp/` 目录
3. 填写 AppID → 点击确定

### 5. 预览 & 上传
- 点击「预览」在手机上扫码测试
- 点击「上传」提交到微信审核
- 审核通过后点击「发布」上线

## 项目结构

```
miniapp/
├── app.js              # 应用入口，全局数据
├── app.json            # 页面路由配置
├── app.wxss            # 全局样式（PMQD 品牌色）
├── project.config.json # 微信开发者工具配置
├── pages/
│   ├── index/          # 搜索首页（股票搜索 + 登录/注册）
│   ├── dashboard/       # PMQD 分析看板
│   └── report/          # 深度分析报告（15 模块）
├── components/
│   └── stock-search/    # 股票搜索组件（363 只离线数据库）
└── utils/
    ├── api.js           # wx.request 封装（对标 Web fetch）
    ├── storage.js       # wx.setStorageSync 封装
    └── stocks.js        # 363 只 A/港/美股数据库
```

## 架构

```
微信小程序 (WXML/WXSS/JS)
    │
    ├─ wx.request() ──→ https://api.windforest.cn (Cloudflare Workers)
    │                    └── 登录/注册/搜索/PMQD分析/行情
    │
    ├─ 离线数据库 ──→ stocks.js (363只股票本地搜索)
    │
    └─ CDN 缓存 ──→ windforest598.github.io/windforest/data/
                     └── market_snapshot.json (PMQD 日评)
```

## 与 Web 版的对应关系

| Web 版 | 小程序 |
|--------|--------|
| `fetch()` | `wx.request()` |
| `localStorage` | `wx.setStorageSync()` |
| `document.getElementById()` | `setData()` + WXML 数据绑定 |
| `onclick` | `bindtap` |
| `index.html` | `pages/index/index` |
| `dashboard.html` | `pages/dashboard/dashboard` |
| `report.html` | `pages/report/report` |
| `login-subscribe.js` | 内嵌到 `pages/index/index.js` |

## 开发模式验证码

开发阶段验证码固定为 **123456**，生产环境可接入微信云开发或第三方短信服务。
