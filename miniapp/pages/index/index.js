// ═══════════════════════════════════════
// 风林慧策 — 搜索首页逻辑
// ═══════════════════════════════════════

var api = require('../../utils/api.js');
var storage = require('../../utils/storage.js');
var STOCK_DB = require('../../utils/stocks.js');

Page({
  data: {
    user: null,
    hotStocks: [],

    // 登录 Modal
    showLoginModal: false,
    loginTab: 'sms',
    loginPhone: '',
    loginId: '',
    loginPwd: '',
    smsCode: '',
    smsCountdown: 0,

    // 注册 Modal
    showRegisterModal: false,
    regPhone: '',
    regEmail: '',
    regPwd: '',
    regSms: '',
    regSmsCountdown: 0
  },

  onLoad: function() {
    var user = storage.getUser();
    if (user) this.setData({ user: user });
    this.loadHotStocks();
  },

  onShow: function() {
    var user = storage.getUser();
    if (user && !this.data.user) {
      this.setData({ user: user });
    }
  },

  // ── 热门股票 ──
  loadHotStocks: function() {
    var that = this;
    // 先用本地数据展示
    var hot = [
      {code: '000333', market: 'sz', name: '美的集团'},
      {code: '600519', market: 'sh', name: '贵州茅台'},
      {code: '000858', market: 'sz', name: '五粮液'},
      {code: '00700', market: 'hk', name: '腾讯控股'},
      {code: '600900', market: 'sh', name: '长江电力'},
      {code: '601318', market: 'sh', name: '中国平安'},
      {code: '002415', market: 'sz', name: '海康威视'},
      {code: '300750', market: 'sz', name: '宁德时代'}
    ];
    that.setData({ hotStocks: hot });

    // 尝试 API 获取
    api.hotStocks().then(function(res) {
      if (res && res.stocks && res.stocks.length > 0) {
        that.setData({ hotStocks: res.stocks });
      }
    }).catch(function() {});
  },

  // ── 热门股票点击 ──
  onHotTap: function(e) {
    var ds = e.currentTarget.dataset;
    this.navigateToDashboard(ds.code, ds.market, ds.name);
  },

  // ── 搜索选择 ──
  onStockSelect: function(e) {
    var d = e.detail;
    this.navigateToDashboard(d.code, d.market, d.name);
  },

  navigateToDashboard: function(code, market, name) {
    var url = '/pages/dashboard/dashboard?code=' + encodeURIComponent(code) +
      '&market=' + encodeURIComponent(market || 'sz') +
      '&name=' + encodeURIComponent(name || '');
    wx.navigateTo({ url: url });
  },

  // ═══════ 登录 Modal ═══════
  showLogin: function() {
    this.setData({ showLoginModal: true, loginTab: 'sms' });
  },
  hideLogin: function() {
    this.setData({ showLoginModal: false });
  },
  showRegister: function() {
    this.setData({ showLoginModal: false, showRegisterModal: true });
  },
  hideRegister: function() {
    this.setData({ showRegisterModal: false });
  },
  switchTab: function(e) {
    this.setData({ loginTab: e.currentTarget.dataset.tab });
  },

  onLoginPhone: function(e) { this.setData({ loginPhone: e.detail.value }); },
  onLoginId: function(e) { this.setData({ loginId: e.detail.value }); },
  onLoginPwd: function(e) { this.setData({ loginPwd: e.detail.value }); },
  onSmsCode: function(e) { this.setData({ smsCode: e.detail.value }); },
  onRegPhone: function(e) { this.setData({ regPhone: e.detail.value }); },
  onRegEmail: function(e) { this.setData({ regEmail: e.detail.value }); },
  onRegPwd: function(e) { this.setData({ regPwd: e.detail.value }); },
  onRegSms: function(e) { this.setData({ regSms: e.detail.value }); },

  // ── 验证码（开发模式：123456 通过）──
  sendSms: function() {
    var that = this;
    wx.showToast({ title: '验证码: 123456', icon: 'none', duration: 2000 });
    that.setData({ smsCountdown: 60, regSmsCountdown: 60 });
    var timer = setInterval(function() {
      var s = that.data.smsCountdown - 1;
      var rs = that.data.regSmsCountdown - 1;
      that.setData({ smsCountdown: Math.max(0, s), regSmsCountdown: Math.max(0, rs) });
      if (s <= 0 && rs <= 0) clearInterval(timer);
    }, 1000);
  },

  // ── 验证码登录 ──
  handleLoginBySms: function() {
    var that = this;
    var phone = that.data.loginPhone.trim();
    var code = that.data.smsCode.trim();
    if (!phone) { wx.showToast({ title: '请输入手机号', icon: 'none' }); return; }
    if (code !== '123456') { wx.showToast({ title: '验证码错误（开发模式:123456）', icon: 'none' }); return; }

    // 开发模式自动注册/登录
    that.doLogin(phone, phone + '@dev.windforest.cn', 'dev123456');
  },

  // ── 密码登录 ──
  handleLoginByPwd: function() {
    var that = this;
    var id = that.data.loginId.trim();
    var pwd = that.data.loginPwd;
    if (!id || !pwd) { wx.showToast({ title: '请填写完整', icon: 'none' }); return; }
    that.doLogin(id, '', pwd);
  },

  // ── 注册 ──
  handleRegister: function() {
    var that = this;
    var phone = that.data.regPhone.trim();
    var email = that.data.regEmail.trim();
    var pwd = that.data.regPwd;
    var code = that.data.regSms.trim();

    if (!phone) { wx.showToast({ title: '请输入手机号', icon: 'none' }); return; }
    if (!pwd || pwd.length < 6) { wx.showToast({ title: '密码至少6位', icon: 'none' }); return; }
    if (code !== '123456') { wx.showToast({ title: '验证码错误', icon: 'none' }); return; }

    api.register(phone, email || phone + '@dev.windforest.cn', pwd).then(function(res) {
      if (res.status === 'ok') {
        wx.showToast({ title: '注册成功，自动登录', icon: 'success' });
        that.doLogin(phone, email, pwd);
      } else {
        wx.showToast({ title: res.message || '注册失败', icon: 'none' });
      }
    }).catch(function() {
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  // ── 实际登录 ──
  doLogin: function(id, email, pwd) {
    var that = this;
    api.login(id, pwd).then(function(res) {
      if (res.status === 'ok' && res.token) {
        storage.setToken(res.token);
        storage.setUser(res.user || { username: id, email: email });
        that.setData({
          user: res.user || { username: id, email: email },
          showLoginModal: false,
          showRegisterModal: false
        });
        wx.showToast({ title: '登录成功', icon: 'success' });
      } else if (res.status === 'error') {
        wx.showToast({ title: res.message, icon: 'none' });
      } else {
        // 开发模式：API 不可用时本地登录
        var user = { username: id, email: email || id + '@dev.windforest.cn' };
        storage.setToken('dev-token-' + Date.now());
        storage.setUser(user);
        that.setData({ user: user, showLoginModal: false, showRegisterModal: false });
        wx.showToast({ title: '离线模式登录', icon: 'none' });
      }
    }).catch(function() {
      // API 不可用，开发模式
      var user = { username: id, email: email || id + '@dev.windforest.cn' };
      storage.setToken('dev-token-' + Date.now());
      storage.setUser(user);
      that.setData({ user: user, showLoginModal: false, showRegisterModal: false });
      wx.showToast({ title: '离线模式登录', icon: 'none' });
    });
  },

  handleLogout: function() {
    storage.clearAuth();
    this.setData({ user: null });
    wx.showToast({ title: '已退出', icon: 'none' });
  },

  noop: function() {}
});
