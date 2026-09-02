// ═══════════════════════════════════════
// 风林慧策 — 深度分析报告逻辑
// ═══════════════════════════════════════

var api = require('../../utils/api.js');
var storage = require('../../utils/storage.js');

Page({
  data: {
    report: {
      name: '', code: '', market: 'sz',
      pmqd_total: 0, pmqd_verdict: '', pmqd_stars: '',
      strategy: '', strategy_reason: '',
      price: 0, changePct: 0,
      pe: '--', pb: '--', roe: '--', divYield: '--',
      marketCap: '--', netCash: '--',
      kelly_f: 0, kelly_verdict: '',
      safety: [], insights: []
    },
    dims: [],
    healthChecks: [],
    financeRules: [],
    debtMetrics: [],
    verdictClass: ''
  },

  onLoad: function(options) {
    var code = options.code || '000333';
    var market = options.market || 'sz';
    var name = options.name || '';
    this.code = code;
    this.market = market;

    this.setData({
      'report.name': name,
      'report.code': code,
      'report.market': market
    });

    this.loadReport();
  },

  loadReport: function() {
    var that = this;

    // 优先取 PMQD V6.0.7 预计算报告（同域静态资产，真实行情 + 完整契约）
    api.reportV6(that.code).then(function(d) {
      if (d && d.modules && d.engine && d.engine.framework) {
        that.renderV6(d);
        return;
      }
      that.fallbackAnalysis();
    }).catch(function() {
      that.fallbackAnalysis();
    });
  },

  // 回退：V5.9 扁平契约（/api/analysis，需登录）
  fallbackAnalysis: function() {
    var that = this;
    api.analysis(that.code, that.market).then(function(res) {
      if (res.status === 'ok' && res.data) {
        that.renderReport(res.data);
      } else {
        that.renderDefault();
      }
    }).catch(function() {
      that.renderDefault();
    });
  },

  // ── PMQD V6.0.7 契约渲染 ──
  renderV6: function(d) {
    var r = this.data.report;
    var pmqd = d.pmqd || {};
    var mk = d.market || {};
    var kl = d.kelly || {};
    var total = pmqd.total || 0;

    r.name = (d.stock && d.stock.name) || r.name;
    r.code = (d.stock && d.stock.code) || r.code;
    r.market = (d.stock && d.stock.market) || r.market;
    r.pmqd_total = total;
    r.pmqd_stars = d.stars || d.overallRating || '';
    r.pmqd_verdict = d.ratingLabel || '';
    r.strategy = d.strategy || '';
    r.strategy_reason = d.ratingNarrative || '';
    r.price = mk.price != null ? mk.price : 0;
    r.changePct = mk.changePct != null ? mk.changePct : 0;
    r.pe = mk.pe != null ? mk.pe : '待核验';
    r.pb = mk.pb != null ? mk.pb : '待核验';
    r.roe = mk.roe != null ? mk.roe + '%' : '待核验';
    r.divYield = mk.divYield != null ? mk.divYield + '%' : '待核验';
    r.marketCap = mk.marketCap != null ? Number(mk.marketCap).toFixed(0) + '亿' : '待核验';
    r.netCash = '待核验';
    r.kelly_f = kl.finalPosition != null ? Number((kl.finalPosition * 100).toFixed(1)) : 0;
    r.kelly_verdict = kl.ceiling != null
      ? '策略' + (d.strategy || '') + '上限 ' + (kl.ceiling * 100).toFixed(0) + '%'
      : '';

    // 安全边际三问 + 8 维体检（V6.0.7 分制）
    var safety = [];
    if (d.safety && d.safety.score != null) {
      safety.push('安全边际三问 ' + d.safety.score + '/50（每问 17 分）'
        + (d.safety.passed ? ' · 通过' : ' · 未通过'));
    }
    if (d.health8d && d.health8d.score != null) {
      safety.push('8 维体检 ' + d.health8d.score + '/30（每维 4 分）');
    }
    if (kl.pParts) {
      safety.push('催化确定性 ' + (kl.pParts.catalyst != null ? kl.pParts.catalyst : '—') + '/20');
    }
    r.safety = safety;

    // 洞察：降档原因 + V6.0.7 结构性修正 + 数据缺口（如实公示，不编造）
    var insights = [];
    (d.downgrades || []).forEach(function(x) { insights.push('降档：' + x); });
    (d.corrections || []).forEach(function(c) {
      insights.push('V6.0.7 修正 ' + (c.dim || '') + ' ' + c.from + '→' + c.to + '：' + (c.rule || ''));
    });
    (d.dataGaps || []).forEach(function(g) { insights.push('数据缺口：' + g); });
    r.insights = insights;

    var dims = [
      { letter: 'P', label: '价格安全边际', score: pmqd.P || 0, max: 40, color: '#1E40AF', pct: Math.round((pmqd.P || 0) / 40 * 100) },
      { letter: 'M', label: '行业/结构催化', score: pmqd.M || 0, max: 18, color: '#0D9488', pct: Math.round((pmqd.M || 0) / 18 * 100) },
      { letter: 'Q', label: '不可替代硬质量', score: pmqd.Q || 0, max: 30, color: '#B45309', pct: Math.round((pmqd.Q || 0) / 30 * 100) },
      { letter: 'D', label: '市场认知差', score: pmqd.D || 0, max: 12, color: '#7C3AED', pct: Math.round((pmqd.D || 0) / 12 * 100) }
    ];

    // 8 维体检：从 health_check_8d 模块取真实明细
    var h8mod = (d.modules || []).filter(function(m) { return m.id === 'health_check_8d'; })[0];
    var health = [];
    var per = h8mod && h8mod.data && h8mod.data.per;
    if (per && per.length) {
      // per 为数组：[{ dim, raw, pts }]，每维满分 4
      per.forEach(function(x) {
        health.push({ name: x.dim, status: x.pts + '/4', ok: x.pts >= 3 });
      });
    }

    this.setData({
      report: r,
      dims: dims,
      healthChecks: health.length > 0 ? health : this.defaultHealth(),
      financeRules: this.defaultRules(),
      debtMetrics: this.defaultDebt(),
      verdictClass: this.bandClass(total)
    });
  },

  bandClass: function(total) {
    if (total >= 90) return 'pmqd-star5';
    if (total >= 75) return 'pmqd-star4';
    if (total >= 60) return 'pmqd-star3';
    if (total >= 35) return 'pmqd-star2';
    return total > 0 ? 'pmqd-star1' : '';
  },

  renderReport: function(data) {
    var r = this.data.report;
    r.pmqd_total = data.pmqd_total || 0;
    r.pmqd_verdict = data.pmqd_verdict || '';
    r.pmqd_stars = data.pmqd_stars || '';
    r.strategy = data.strategy || '';
    r.strategy_reason = data.strategy_reason || '';
    r.price = data.price || 0;
    r.changePct = data.change_pct || 0;
    r.pe = data.pe || '--';
    r.pb = data.pb || '--';
    r.roe = data.roe || '--';
    r.divYield = data.div_yield || '--';
    r.marketCap = data.market_cap || '--';
    r.netCash = data.net_cash || '--';
    r.kelly_f = data.kelly_f || 0;
    r.kelly_verdict = data.kelly_verdict || '';
    r.safety = data.safety || [];
    r.insights = data.insights || [];

    var dims = [
      { letter: 'P', label: '价格安全边际', score: data.p || 0, max: 40, color: '#1E40AF', pct: Math.round((data.p || 0) / 40 * 100) },
      { letter: 'M', label: '行业/结构催化', score: data.m || 0, max: 18, color: '#0D9488', pct: Math.round((data.m || 0) / 18 * 100) },
      { letter: 'Q', label: '不可替代硬质量', score: data.q || 0, max: 30, color: '#B45309', pct: Math.round((data.q || 0) / 30 * 100) },
      { letter: 'D', label: '市场认知差', score: data.d || 0, max: 12, color: '#7C3AED', pct: Math.round((data.d || 0) / 12 * 100) }
    ];

    var health = (data.health || []).map(function(h) {
      return { name: h.name, status: h.status, ok: h.status && h.status.indexOf('✅') !== -1 };
    });

    var rules = (data.finance_rules || []).map(function(f) {
      return { name: f.name, value: f.value || '', desc: f.desc || '', pass: f.pass };
    });

    var debt = (data.debt || []).map(function(d) {
      return { label: d.label, val: d.val, ok: d.ok !== false };
    });

    // 星级分档统一走 V6.0.7 口径（90/75/60）
    var verdictClass = this.bandClass(data.pmqd_total || 0);

    this.setData({
      report: r, dims: dims,
      healthChecks: health.length > 0 ? health : this.defaultHealth(),
      financeRules: rules.length > 0 ? rules : this.defaultRules(),
      debtMetrics: debt.length > 0 ? debt : this.defaultDebt(),
      verdictClass: verdictClass
    });
  },

  renderDefault: function() {
    // 取数失败：一律显示「待分析 / --」，绝不填充模拟数值（PMQD 铁律）
    this.setData({
      dims: [
        { letter: 'P', label: '价格安全边际', score: 0, max: 40, color: '#1E40AF', pct: 0 },
        { letter: 'M', label: '行业/结构催化', score: 0, max: 18, color: '#0D9488', pct: 0 },
        { letter: 'Q', label: '不可替代硬质量', score: 0, max: 30, color: '#B45309', pct: 0 },
        { letter: 'D', label: '市场认知差', score: 0, max: 12, color: '#7C3AED', pct: 0 }
      ],
      healthChecks: this.defaultHealth(),
      financeRules: this.defaultRules(),
      debtMetrics: this.defaultDebt(),
      'report.pmqd_verdict': 'API 分析服务暂不可用',
      'report.strategy': '请稍后重试'
    });
  },

  defaultHealth: function() {
    return [
      { name: '盈利能力', status: '待分析', ok: false },
      { name: '成长性', status: '待分析', ok: false },
      { name: '现金流', status: '待分析', ok: false },
      { name: '资产负债', status: '待分析', ok: false },
      { name: '运营效率', status: '待分析', ok: false },
      { name: '分红回报', status: '待分析', ok: false },
      { name: '估值水平', status: '待分析', ok: false },
      { name: '管理层质量', status: '待分析', ok: false }
    ];
  },

  defaultRules: function() {
    return [
      { name: '类现金资产', value: '--', desc: '类现金是否覆盖短期有息负债', pass: false },
      { name: '有息负债率', value: '--', desc: '有息负债 / 总资产 < 50%', pass: false },
      { name: '永续债风险', value: '--', desc: '不存在重大永续债或优先股摊薄', pass: false },
      { name: '股息率', value: '--', desc: '近3年股息率 > 2% 且持续增长', pass: false }
    ];
  },

  defaultDebt: function() {
    return [
      { label: '流动比率', val: '--', ok: false },
      { label: '速动比率', val: '--', ok: false },
      { label: '利息覆盖', val: '--', ok: false },
      { label: '净负债/Ebitda', val: '--', ok: false },
      { label: '短债占比', val: '--', ok: false },
      { label: '现金/短债', val: '--', ok: false },
      { label: 'FCF/总负债', val: '--', ok: false }
    ];
  }
});
