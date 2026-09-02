// ═══════════════════════════════════════
// 本地存储封装
// ═══════════════════════════════════════

module.exports = {
  get: function(key) {
    try { return wx.getStorageSync(key); }
    catch(e) { return null; }
  },
  set: function(key, value) {
    try { wx.setStorageSync(key, value); return true; }
    catch(e) { return false; }
  },
  remove: function(key) {
    try { wx.removeStorageSync(key); return true; }
    catch(e) { return false; }
  },
  getToken: function() {
    return wx.getStorageSync('wf_token') || '';
  },
  setToken: function(token) {
    wx.setStorageSync('wf_token', token);
  },
  getUser: function() {
    return wx.getStorageSync('wf_user') || null;
  },
  setUser: function(user) {
    wx.setStorageSync('wf_user', user);
  },
  clearAuth: function() {
    wx.removeStorageSync('wf_token');
    wx.removeStorageSync('wf_user');
  },
  isLoggedIn: function() {
    return !!wx.getStorageSync('wf_token');
  }
};
