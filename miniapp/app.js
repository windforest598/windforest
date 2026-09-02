// ═══════════════════════════════════════════════
// 风林慧策 微信小程序 — App 入口
// ═══════════════════════════════════════════════

App({
  onLaunch: function () {
    // 恢复登录状态
    var token = wx.getStorageSync('wf_token');
    var user = wx.getStorageSync('wf_user');
    this.globalData.token = token || null;
    this.globalData.user = user || null;

    // 获取系统信息
    var sys = wx.getSystemInfoSync();
    this.globalData.systemInfo = sys;
    this.globalData.statusBarHeight = sys.statusBarHeight;
  },

  // ── 全局数据 ──
  globalData: {
    token: null,
    user: null,
    systemInfo: null,
    statusBarHeight: 20,
    // API 配置
    API_BASE: 'https://api.windforest.cn',
    // PMQD 品牌色
    colors: {
      navy: '#1E40AF',
      teal: '#0D9488',
      amber: '#B45309',
      purple: '#7C3AED',
      gold: '#CA8A04',
      red: '#DC2626',
      green: '#16A34A',
      surface: '#F8F9FA',
      text: '#1A1A2E',
      text2: '#6B7280',
      border: '#E5E7EB'
    },
    // 股票数据库 (嵌入核心股票)
    STOCK_DB: []
  }
});
