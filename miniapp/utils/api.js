// ═══════════════════════════════════════
// API 请求封装 — 替代 fetch()
// ═══════════════════════════════════════

var API_BASE = 'https://api.windforest.cn';

function getToken() {
  return wx.getStorageSync('wf_token') || '';
}

function getHeaders(auth) {
  var h = { 'Content-Type': 'application/json' };
  if (auth) h['Authorization'] = 'Bearer ' + getToken();
  return h;
}

// ── GET 请求 ──
function get(path, auth) {
  return new Promise(function(resolve, reject) {
    wx.request({
      url: API_BASE + path,
      header: getHeaders(auth),
      method: 'GET',
      success: function(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Token 过期
          wx.removeStorageSync('wf_token');
          wx.removeStorageSync('wf_user');
          resolve({ status: 'error', message: '请重新登录' });
        } else {
          reject(res.data);
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}

// ── POST 请求 ──
function post(path, data, auth) {
  return new Promise(function(resolve, reject) {
    wx.request({
      url: API_BASE + path,
      header: getHeaders(auth),
      method: 'POST',
      data: data,
      success: function(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res.data);
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}

// ── API 方法 ──
module.exports = {
  // 搜索股票
  search: function(q) {
    return get('/api/search?q=' + encodeURIComponent(q), false);
  },

  // 获取行情
  quote: function(code, market) {
    return get('/api/quote/' + (market || 'sz') + code, false);
  },

  // 注册
  register: function(phone, email, password) {
    return post('/api/auth/register', {
      username: phone, email: email, password: password
    }, false);
  },

  // 登录
  login: function(phone, password) {
    return post('/api/auth/login', {
      username: phone, password: password
    }, false);
  },

  // 获取用户信息
  me: function() {
    return get('/api/auth/me', true);
  },

  // PMQD 分析（V5.9 扁平契约，需登录）
  analysis: function(code, market) {
    var p = 'code=' + encodeURIComponent(code) + '&market=' + encodeURIComponent(market);
    return get('/api/analysis?' + p, true);
  },

  // PMQD V6.0.7 预计算报告（静态资产，与 API 同域，无需额外域名白名单）
  // 路径：https://api.windforest.cn/data/reports/<cleanCode>.json
  reportV6: function(code) {
    var clean = String(code || '').replace(/^(sh|sz|bj|hk|us)/i, '');
    return get('/data/reports/' + encodeURIComponent(clean) + '.json', false);
  },

  // 热点股票
  hotStocks: function() {
    return get('/api/hot-stocks', false);
  },

  // 订阅
  subscribe: function(plan) {
    return post('/api/subscribe', { plan: plan }, true);
  },

  API_BASE: API_BASE
};
