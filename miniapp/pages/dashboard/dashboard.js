// ═══════════════════════════════════════
// 风林慧策 — PMQD 看板逻辑
// ═══════════════════════════════════════

var api = require('../../utils/api.js');
var storage = require('../../utils/storage.js');
var STOCK_DB = require('../../utils/stocks.js');

Page({
  data: {
    loaded: false,
    stock: { name: '', code: '', market: 'sz', pmqd_total: 0 },
    verdictText: '',
    verdictClass: '',
    dims: []
  },

  onLoad: function(options) {
    var code = options.code || '000333';
    var market = options.market || 'sz';
    var name = options.name || '';
    this.code = code;
    this.market = market;

    this.setData({
      stock: { name: name, code: code, market: market, pmqd_total: 0 }
    });

    this.loadData();
  },

  loadData: function() {
    var that = this;

    // 1. 尝试 CDN 缓存
    that.loadCachedPmqd(function(cached) {
      if (cached) {
        that.renderData(cached);
        return;
      }

      // 2. 本地数据库回退
      that.loadLocalData();

      // 3. API 后台刷新
      that.loadApiData();
    });
  },

  // ── CDN 缓存 ──
  // 与 API 同域（Worker assets 托管 deploy/），只需登记一个 request 合法域名
  loadCachedPmqd: function(callback) {
    var that = this;
    wx.request({
      url: api.API_BASE + '/data/market_snapshot.json',
      success: function(res) {
        var data = res.data;
        if (data && data.pmqd_spotlight) {
          var full = that.market + that.code;
          for (var i = 0; i < data.pmqd_spotlight.length; i++) {
            var s = data.pmqd_spotlight[i];
            if ((s.market + s.code) === full && s.pmqd_total > 0) {
              callback(that.convertApiData(s));
              return;
            }
          }
        }
        callback(null);
      },
      fail: function() { callback(null); }
    });
  },

  // ── 本地数据 ──
  loadLocalData: function() {
    var that = this;
    for (var i = 0; i < STOCK_DB.length; i++) {
      var s = STOCK_DB[i];
      if (s.c === that.market + that.code) {
        var data = {
          name: s.n, code: that.code, market: that.market,
          pmqd_total: 0, pmqd_verdict: '数据加载中...', pmqd_stars: '',
          pmqd_P: { score: 0, max: 40, color: '#1E40AF', label: '价格安全边际' },
          pmqd_M: { score: 0, max: 18, color: '#0D9488', label: '行业/结构催化' },
          pmqd_Q: { score: 0, max: 30, color: '#B45309', label: '不可替代硬质量' },
          pmqd_D: { score: 0, max: 12, color: '#7C3AED', label: '市场认知差' },
          kelly_f: 0, kelly_verdict: '',
          safety: [],
          price: 0, changePct: 0
        };
        that.renderData(data);
        return;
      }
    }

    // 未知股票
    that.renderData({
      name: that.data.stock.name || that.code,
      code: that.code, market: that.market,
      pmqd_total: 0, pmqd_verdict: 'API 分析中...',
      pmqd_P: { score: 0, max: 40, color: '#1E40AF', label: '价格安全边际' },
      pmqd_M: { score: 0, max: 18, color: '#0D9488', label: '行业/结构催化' },
      pmqd_Q: { score: 0, max: 30, color: '#B45309', label: '不可替代硬质量' },
      pmqd_D: { score: 0, max: 12, color: '#7C3AED', label: '市场认知差' },
      kelly_f: 0, kelly_verdict: '',
      safety: [],
      price: 0, changePct: 0
    });
  },

  // ── API 数据 ──
  loadApiData: function() {
    var that = this;
    api.analysis(that.code, that.market).then(function(res) {
      if (res.status === 'ok' && res.data) {
        var data = that.convertApiData(res.data);
        that.renderData(data);
      }
    }).catch(function() {});
  },

  // ── 数据格式转换 ──
  convertApiData: function(apiData) {
    return {
      name: apiData.name || '',
      code: apiData.code || this.code,
      market: apiData.market || this.market,
      pmqd_total: apiData.pmqd_total || 0,
      pmqd_verdict: apiData.pmqd_verdict || '',
      pmqd_stars: apiData.pmqd_stars || '',
      pmqd_P: { score: apiData.p || apiData.pmqd_p_score || 0, max: 40, color: '#1E40AF', label: '价格安全边际' },
      pmqd_M: { score: apiData.m || apiData.pmqd_m_score || 0, max: 18, color: '#0D9488', label: '行业/结构催化' },
      pmqd_Q: { score: apiData.q || apiData.pmqd_q_score || 0, max: 30, color: '#B45309', label: '不可替代硬质量' },
      pmqd_D: { score: apiData.d || apiData.pmqd_d_score || 0, max: 12, color: '#7C3AED', label: '市场认知差' },
      kelly_f: apiData.kelly_f || 0,
      kelly_verdict: apiData.kelly_verdict || '',
      safety: apiData.safety || [],
      price: apiData.price || 0,
      changePct: apiData.change_pct || 0
    };
  },

  // ── 渲染 ──
  renderData: function(data) {
    var dims = [data.pmqd_P, data.pmqd_M, data.pmqd_Q, data.pmqd_D];
    var total = data.pmqd_total;

    var verdictText = '分析中...';
    var verdictClass = '';

    if (total >= 80) { verdictText = '深度价值，建议重仓'; verdictClass = 'pmqd-star5'; }
    else if (total >= 65) { verdictText = '优质低估，值得配置'; verdictClass = 'pmqd-star4'; }
    else if (total >= 50) { verdictText = '估值合理，保持观察'; verdictClass = 'pmqd-star3'; }
    else if (total >= 35) { verdictText = '安全边际不足'; verdictClass = 'pmqd-star2'; }
    else if (total > 0) { verdictText = '暂不具备投资价值'; verdictClass = 'pmqd-star1'; }

    this.setData({
      loaded: true,
      stock: data,
      dims: dims,
      verdictText: verdictText,
      verdictClass: verdictClass
    });
  },

  // ── 打开完整报告 ──
  openReport: function() {
    var token = storage.getToken();
    if (!token) {
      wx.showModal({
        title: '需要登录',
        content: '查看完整深度分析报告需要登录',
        confirmText: '去登录',
        success: function(res) {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/index/index' });
          }
        }
      });
      return;
    }

    var url = '/pages/report/report?code=' + encodeURIComponent(this.code) +
      '&market=' + encodeURIComponent(this.market) +
      '&name=' + encodeURIComponent(this.data.stock.name || '');
    wx.navigateTo({ url: url });
  }
});
