/* ══════ LOGIN / REGISTER / SUBSCRIBE — 真实后端版 ══════ */
var API_BASE = (function () {
  if (location.hostname.endsWith('.pages.dev')) return 'https://windforest-api.workers.dev';
  if (location.hostname === 'localhost' || location.port) return 'http://localhost:8787';
  return '';  // same-origin
})();
var currentPlan = 1;

/* ── 工具函数 ── */
function getToken() { return localStorage.getItem('wf_token'); }

function setToken(token) { localStorage.setItem('wf_token', token); }

function clearToken() { localStorage.removeItem('wf_token'); localStorage.removeItem('wf_user'); }

async function apiFetch(path, options) {
  var headers = Object.assign({ 'Content-Type': 'application/json' }, (options && options.headers) || {});
  var token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var resp = await fetch(API_BASE + path, Object.assign({ headers: headers }, options));
  var data = await resp.json();
  if (!resp.ok) throw new Error(data.message || '请求失败');
  return data;
}

/* ── 弹窗 HTML 模板 ── */
var MODAL_HTML = '\
<div class="modal-overlay" id="loginModal">\
  <div class="login-modal">\
    <button class="login-close" onclick="closeLogin()">✕</button>\
    <div class="login-tabs">\
      <div class="login-tab active" id="loginTab" onclick="switchLoginTab(\'login\')">老用户登录</div>\
      <div class="login-tab" id="registerTab" onclick="switchLoginTab(\'register\')">注册新用户</div>\
    </div>\
    <form id="loginForm" onsubmit="handleLogin(event)">\
      <div class="login-field">\
        <label>账号</label>\
        <input type="text" id="loginAccount" placeholder="手机号 / 邮箱 / 用户名" autocomplete="username">\
      </div>\
      <div class="login-field">\
        <label>密码</label>\
        <input type="password" id="loginPassword" placeholder="请输入密码" autocomplete="current-password">\
      </div>\
      <button type="submit" class="login-btn">登 录</button>\
    </form>\
    <form id="registerForm" style="display:none;" onsubmit="handleRegister(event)">\
      <div class="login-field">\
        <label>设置账号</label>\
        <input type="text" id="regAccount" placeholder="手机号 / 邮箱 / 用户名" autocomplete="username">\
      </div>\
      <div class="login-field">\
        <label>设置密码</label>\
        <input type="password" id="regPassword" placeholder="6位以上密码" autocomplete="new-password">\
      </div>\
      <div class="login-field">\
        <label>确认密码</label>\
        <input type="password" id="regPassword2" placeholder="再次输入密码" autocomplete="new-password">\
      </div>\
      <button type="submit" class="login-btn gold-btn">注册并领取免费体验</button>\
    </form>\
    <div class="login-hint">已有账户？<a onclick="switchLoginTab(\'login\')">去登录</a></div>\
  </div>\
</div>\
\
<div class="subscribe-overlay" id="subscribeModal">\
  <div class="subscribe-panel">\
    <button class="subscribe-close" onclick="closeSubscribe()">✕</button>\
    <h2>🔓 解锁完整分析</h2>\
    <div class="subtitle">选择订阅方案，畅享风林慧策全部功能</div>\
    <div class="plan-cards" id="planCards">\
      <div class="plan-card" onclick="selectPlan(0)">\
        <span class="plan-icon">📅</span>\
        <div class="plan-info"><div class="plan-name">年费会员</div><div class="plan-desc">约 ¥49.8/月，不限次分析</div></div>\
        <div class="plan-price">¥598<span class="unit">/年</span></div>\
      </div>\
      <div class="plan-card selected" onclick="selectPlan(1)">\
        <span class="plan-icon">📆</span>\
        <div class="plan-info"><div class="plan-name">月费会员</div><div class="plan-desc">灵活订阅，随时取消，不限次分析</div></div>\
        <div class="plan-price">¥60<span class="unit">/月</span></div>\
      </div>\
      <div class="plan-card" onclick="selectPlan(2)">\
        <span class="plan-icon">⏳</span>\
        <div class="plan-info"><div class="plan-name">10天体验</div><div class="plan-desc">体验价，不限次分析，有效期内畅享</div></div>\
        <div class="plan-price">¥30<span class="unit">/10天</span></div>\
      </div>\
      <div class="plan-card free" onclick="selectPlan(3)">\
        <span class="plan-icon">🎁</span>\
        <div class="plan-info"><div class="plan-name">免费体验一次</div><div class="plan-desc">注册即送1次完整分析，无需付费</div></div>\
        <div class="plan-price" style="color:var(--green);">免费</div>\
      </div>\
    </div>\
    <button class="subscribe-btn" id="subscribeBtn" onclick="handleSubscribe()">立即订阅 · ¥60/月</button>\
    <div class="subscribe-hint">🔒 支付安全 · 微信/支付宝均可 · 订阅后可随时取消<br>如有疑问请联系客服：service@windforest.cn</div>\
  </div>\
</div>\
\
<div class="modal-overlay" id="aboutModal">\
  <div class="modal-panel" style="max-width:600px;">\
    <button class="modal-close" onclick="closeAbout()">✕</button>\
    <h2 style="margin-bottom:4px;"><span class="gold">风</span>林<span class="gold">慧</span>策</h2>\
    <div class="modal-sub">PMQD 价值投资 AI 分析师（PALA · 帕拉，简称老帕 · LP）</div>\
    <h3><span class="dot"></span>使命</h3>\
    <p>让每一位普通投资者，都拥有一套科学、系统、可复用的价值投资决策框架。</p>\
    <h3><span class="dot"></span>愿景</h3>\
    <p>成为中国价值投资者首选的AI智能投资评估平台——不是荐股工具，不是数据终端，而是<strong>经得起追溯、经得起核验的理性决策系统</strong>。</p>\
    <h3><span class="dot"></span>核心价值观</h3>\
    <div class="pill-row">\
      <span class="framework-pill" style="border-color:#1E40AF;color:#1E40AF;">风 · 敏锐洞察</span>\
      <span class="framework-pill" style="border-color:#0D9488;color:#0D9488;">林 · 缜密研究</span>\
      <span class="framework-pill" style="border-color:#B45309;color:#B45309;">火 · 果断出击</span>\
      <span class="framework-pill" style="border-color:#7C3AED;color:#7C3AED;">山 · 坚守纪律</span>\
      <span class="framework-pill" style="border-color:#CA8A04;color:#CA8A04;">慧 · 穿透本质</span>\
      <span class="framework-pill" style="border-color:#1E40AF;color:#1E40AF;">策 · 科学决策</span>\
    </div>\
    <h3><span class="dot"></span>品牌宣言</h3>\
    <p style="font-size:1rem;font-weight:600;color:var(--text);text-align:center;padding:12px 0;">风林之道，慧策于芯。<br>让每一次投资决策，都成为一场智慧的胜利。</p>\
    <h3><span class="dot"></span>四不原则</h3>\
    <div class="pill-row">\
      <span class="framework-pill highlight">事实不清不出</span>\
      <span class="framework-pill highlight">来源不明不引</span>\
      <span class="framework-pill highlight">逻辑不全不推</span>\
      <span class="framework-pill highlight">未经核验不采</span>\
    </div>\
    <h3><span class="dot"></span>我们的不同</h3>\
    <p>不同于传统荐股工具和数据终端，风林慧策是一套完整的<strong>理性决策系统</strong>——每一份分析结论都可追溯来源、可交叉验证、可复现推演。我们不推荐股票，我们提供决策框架。</p>\
    <div class="disclaimer">⚠️ 免责声明：风林慧策为 AI 辅助投资分析工具，所有分析结论仅供参考，不构成任何投资建议。投资有风险，入市需谨慎。</div>\
  </div>\
</div>\
\
<div class="modal-overlay" id="frameworkModal">\
  <div class="modal-panel">\
    <button class="modal-close" onclick="closeFramework()">✕</button>\
    <h2><span class="gold">风</span>林<span class="gold">慧</span>策</h2>\
    <div class="modal-sub">PMQD 价值投资分析框架</div>\
    <h3><span class="dot"></span>核心理念</h3>\
    <p>源自《孙子兵法》军争篇——<strong>"其疾如风，其徐如林，侵掠如火，不动如山"</strong>。将古典兵法智慧注入现代价值投资分析，构建四维量化评估体系。</p>\
    <h3><span class="dot"></span>PMQD 分析框架</h3>\
    <p>从四个维度对上市公司的长期投资价值进行全面评估：</p>\
    <div class="pill-row">\
      <span class="framework-pill highlight">P 价格安全</span>\
      <span class="framework-pill">M 行业催化</span>\
      <span class="framework-pill">Q 硬质量</span>\
      <span class="framework-pill highlight">D 认知差</span>\
    </div>\
    <p>每个维度包含多层子指标，综合量化后形成 0-100 分的 PMQD 总分及对应的投资策略建议。</p>\
    <h3><span class="dot"></span>覆盖市场</h3>\
    <div class="pill-row">\
      <span class="framework-pill">A股 · 沪深两市</span>\
      <span class="framework-pill">港股 · 香港联交所</span>\
      <span class="framework-pill">美股 · 纳斯达克 / 纽交所</span>\
    </div>\
    <h3><span class="dot"></span>分析方法</h3>\
    <p>多源数据交叉验证 · 财务穿透精算 · 估值定价模型 · 偿债能力诊断 · 管理层诚信审查 · 预期泡沫识别 · 安全边际评估</p>\
    <h3><span class="dot"></span>设计哲学</h3>\
    <div class="pill-row">\
      <span class="framework-pill">风 · 其疾如风</span>\
      <span class="framework-pill">林 · 其徐如林</span>\
      <span class="framework-pill">火 · 侵掠如火</span>\
      <span class="framework-pill">山 · 不动如山</span>\
    </div>\
    <p>风 = 紧随市场变化，快速捕捉信号；林 = 沉心静气，深入基本面研究；火 = 估值到位果断行动；山 = 优质标的坚定持有。</p>\
    <h3><span class="dot"></span>三大价值投资策略</h3>\
    <div style="display:flex;flex-direction:column;gap:10px;">\
      <div style="background:var(--surface);border-radius:8px;padding:12px 14px;border-left:4px solid #1E40AF;">\
        <strong style="color:#1E40AF;">策略一 · 绝对低估套利</strong>\
        <p style="margin:4px 0 0;font-size:0.8rem;color:var(--text2);">寻找跌破净资产、市值低于净现金、或5年内自由现金流可覆盖有效市值的标的。五种判定门坎任一满足即合格，仓位上限40%。</p>\
      </div>\
      <div style="background:var(--surface);border-radius:8px;padding:12px 14px;border-left:4px solid #0D9488;">\
        <strong style="color:#0D9488;">策略二 · 高质量逆风</strong>\
        <p style="margin:4px 0 0;font-size:0.8rem;color:var(--text2);">ROE≥15% + PE<12×双门槛。在优质公司遭遇短期逆风、市场过度反应时介入。核心评估维度：护城河深度、管理层能力、行业东风。仓位上限30%。</p>\
      </div>\
      <div style="background:var(--surface);border-radius:8px;padding:12px 14px;border-left:4px solid #B45309;">\
        <strong style="color:#B45309;">策略三 · 事件驱动 / 并购套利</strong>\
        <p style="margin:4px 0 0;font-size:0.8rem;color:var(--text2);">基于已正式公告的事件（并购、重组、私有化），年化利差≥12%、完成概率>80%、底层资产通过策略一检验。仓位上限15%。</p>\
      </div>\
    </div>\
    <h3><span class="dot"></span>安全边际三问</h3>\
    <p style="margin-bottom:6px;">每问回答"是"得17分（满分50），任一"否"触发评级降级或排除：</p>\
    <div style="display:flex;flex-direction:column;gap:6px;">\
      <div style="font-size:0.8rem;color:var(--text2);padding:6px 10px;background:var(--surface);border-radius:6px;">❶ <strong style="color:var(--text);">即使行业不复苏，公司是否不会破产退市？</strong>→ 净现金为正 + 有息负债 < 50%资产</div>\
      <div style="font-size:0.8rem;color:var(--text2);padding:6px 10px;background:var(--surface);border-radius:6px;">❷ <strong style="color:var(--text);">股票再跌50%，净资产能否支撑市值？</strong>→ 净现金 > 半价市值50%</div>\
      <div style="font-size:0.8rem;color:var(--text2);padding:6px 10px;background:var(--surface);border-radius:6px;">❸ <strong style="color:var(--text);">5年累计自由现金流能否覆盖有效市值？</strong>→ 有效回本期 ≤ 5年</div>\
    </div>\
    <h3><span class="dot"></span>八维体检</h3>\
    <div class="pill-row" style="gap:5px;">\
      <span class="framework-pill" style="font-size:0.68rem;">量价收增长</span>\
      <span class="framework-pill" style="font-size:0.68rem;">毛利率趋势</span>\
      <span class="framework-pill" style="font-size:0.68rem;">费用控制</span>\
      <span class="framework-pill" style="font-size:0.68rem;">有息负债变化</span>\
      <span class="framework-pill" style="font-size:0.68rem;">净现金水位</span>\
      <span class="framework-pill" style="font-size:0.68rem;">经营CF vs Capex</span>\
      <span class="framework-pill" style="font-size:0.68rem;">Capex方向</span>\
      <span class="framework-pill" style="font-size:0.68rem;">增长引擎</span>\
    </div>\
    <p style="font-size:0.8rem;color:var(--text2);">每维0–4分（满分30），系统扫描量价关系、利润率、费用效率、债务水位、现金流质量与第二增长曲线。</p>\
    <h3><span class="dot"></span>凯利公式仓位计算</h3>\
    <div style="background:var(--surface);border-radius:8px;padding:14px;text-align:center;">\
      <p style="font-family:monospace;font-size:0.85rem;color:var(--navy);margin-bottom:6px;"><strong>f* = (b × p − q) / b</strong></p>\
      <p style="font-size:0.75rem;color:var(--text2);margin:0;line-height:1.6;">\
        赔率 b =（内在PE − 当前PE）/ 当前PE，内在PE基准12.5×<br>\
        胜率 p = 安全边际三问（50pt）+ 八维体检（30pt折算）+ 催化剂确定性（20pt）<br>\
        最终推荐仓位 = 半凯利 × 能力圈系数（0.4–1.0），受策略仓位上限约束\
      </p>\
    </div>\
    <h3><span class="dot"></span>分析师宪章</h3>\
    <div style="display:flex;flex-direction:column;gap:6px;">\
      <div style="font-size:0.78rem;color:var(--text2);padding:5px 10px;background:var(--surface);border-radius:6px;">🔍 <strong style="color:var(--text);">四不原则</strong> — 事实不清不出、来源不明不引、逻辑不全不推、未经核验不采</div>\
      <div style="font-size:0.78rem;color:var(--text2);padding:5px 10px;background:var(--surface);border-radius:6px;">📏 <strong style="color:var(--text);">数据精度铁律</strong> — 市值2位小数/营收1位/PE 2位/百分比1位；市值≈股价×总股数（偏差<2%）</div>\
      <div style="font-size:0.78rem;color:var(--text2);padding:5px 10px;background:var(--surface);border-radius:6px;">🔬 <strong style="color:var(--text);">六穿透原则</strong> — 业务穿透、净资产穿透、现金穿透、利润穿透、债务穿透、隐蔽资产穿透</div>\
      <div style="font-size:0.78rem;color:var(--text2);padding:5px 10px;background:var(--surface);border-radius:6px;">📋 <strong style="color:var(--text);">诚信审查一票否决</strong> — 非标审计/财务造假/管理层被查/核心数据偏差>5% → 冻结报告</div>\
      <div style="font-size:0.78rem;color:var(--text2);padding:5px 10px;background:var(--surface);border-radius:6px;">✍️ <strong style="color:var(--text);">署名规则</strong> — 每份研报末尾必须署名：PALA（老帕）· 风林慧策</div>\
    </div>\
    <div class="disclaimer">⚠️ 免责声明：风林慧策为 AI 辅助投资分析工具，所有分析结论仅供参考，不构成任何投资建议。投资有风险，入市需谨慎。</div>\
  </div>\
</div>';

/* ── 确保弹窗已注入 ── */
function ensureModals() {
  if (document.getElementById('loginModal')) return;  // 已存在
  var container = document.createElement('div');
  container.id = 'modals-container';
  container.innerHTML = MODAL_HTML.replace(/\\n/g, '\n');
  document.body.appendChild(container);
}

/* ── Login / Register ── */
function openLogin() {
  ensureModals();
  document.getElementById('loginModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  if (typeof switchLoginTab === 'function') switchLoginTab('login');
}
function closeLogin() {
  var el = document.getElementById('loginModal');
  if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
}
function switchLoginTab(tab) {
  var loginTab = document.getElementById('loginTab');
  var registerTab = document.getElementById('registerTab');
  if (!loginTab || !registerTab) return;
  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  if (tab === 'login') {
    loginTab.classList.add('active'); registerTab.classList.remove('active');
    if (loginForm) loginForm.style.display = '';
    if (registerForm) registerForm.style.display = 'none';
  } else {
    loginTab.classList.remove('active'); registerTab.classList.add('active');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = '';
  }
}

/* ── 认证后重定向辅助 ── */
function checkAuthRedirect() {
  var redirect = localStorage.getItem('wf_redirect_after_auth');
  if (!redirect) return;
  // Don't clear yet — let the caller handle it
  if (redirect === 'subscribe') {
    localStorage.removeItem('wf_redirect_after_auth');
    // Open subscribe modal after login
    if (typeof openSubscribe === 'function') {
      setTimeout(function() { openSubscribe(); }, 500);
    }
    return;
  }
  if (redirect === 'report') {
    // After login/subscribe, re-trigger openReport to check subscription
    localStorage.removeItem('wf_redirect_after_auth');
    if (typeof openReport === 'function') {
      setTimeout(function() { openReport(); }, 300);
      return;
    }
    // Fallback: go directly to report
    var params = new URLSearchParams(window.location.search);
    var code = params.get('code') || '000333';
    var name = params.get('name') || '';
    var market = params.get('market') || 'sz';
    window.location.href = 'report.html?code=' + encodeURIComponent(code) +
      '&market=' + encodeURIComponent(market) +
      '&name=' + encodeURIComponent(name);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  var account = document.getElementById('loginAccount').value.trim();
  var password = document.getElementById('loginPassword').value;
  if (!account || !password) { alert('请填写完整信息'); return; }
  try {
    var data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account: account, password: password }),
    });
    setToken(data.data.token);
    localStorage.setItem('wf_user', JSON.stringify(data.data.user));
    alert('登录成功！欢迎回来。');
    closeLogin();
    updateLoginState();
    setTimeout(checkAuthRedirect, 300);
  } catch (err) {
    alert('登录失败：' + err.message);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  var account = document.getElementById('regAccount').value.trim();
  var pwd1 = document.getElementById('regPassword').value;
  var pwd2 = document.getElementById('regPassword2').value;
  if (!account || !pwd1 || !pwd2) { alert('请填写完整信息'); return; }
  if (pwd1.length < 6) { alert('密码至少为6位'); return; }
  if (pwd1 !== pwd2) { alert('两次密码不一致'); return; }
  try {
    var data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ account: account, password: pwd1 }),
    });
    setToken(data.data.token);
    localStorage.setItem('wf_user', JSON.stringify(data.data.user));
    alert('注册成功！🎁 已赠送您1次完整分析免费体验，快去试试吧。');
    closeLogin();
    updateLoginState();
    setTimeout(checkAuthRedirect, 300);
  } catch (err) {
    alert('注册失败：' + err.message);
  }
}

async function updateLoginState() {
  var token = getToken();
  // 支持多种页面布局 — 优先 #headerLoginArea（避免覆盖 .header-actions 中的深度分析等按钮）
  var areas = document.querySelectorAll('#headerLoginArea, .top-bar-actions');
  var btnArea = null;
  for (var i = 0; i < areas.length; i++) { if (areas[i]) { btnArea = areas[i]; break; } }
  if (!btnArea) return;

  if (token) {
    try {
      var data = await apiFetch('/api/auth/me', { method: 'GET' });
      var u = data.data;
      btnArea.innerHTML =
        '<span style="font-size:0.78rem;color:var(--text2);margin-right:8px;">👤 ' + (u.account || '用户') + '</span>' +
        (u.plan ? '<span style="font-size:0.72rem;background:var(--gold-pale);color:var(--gold);padding:2px 8px;border-radius:12px;margin-right:8px;">' + u.plan + '</span>' : '') +
        '<button class="top-link" style="font-size:0.78rem;background:none;border:none;cursor:pointer;" onclick="logout()">退出</button>' +
        '<button class="top-link-primary" style="background:var(--gold);color:white;" onclick="openSubscribe()">订阅</button>';
    } catch (err) {
      clearToken();
      showLoggedOut(btnArea);
    }
  } else {
    showLoggedOut(btnArea);
  }
}

function showLoggedOut(btnArea) {
  if (!btnArea) {
    var areas = document.querySelectorAll('#headerLoginArea, .top-bar-actions');
    for (var i = 0; i < areas.length; i++) { if (areas[i]) { btnArea = areas[i]; break; } }
  }
  if (!btnArea) return;
  btnArea.innerHTML =
    '<button class="top-link-primary" style="background:var(--navy);color:white;font-size:0.78rem;padding:6px 14px;border-radius:18px;border:none;cursor:pointer;" onclick="openLogin()">登录</button>' +
    '<button class="top-link-primary" style="background:var(--gold);color:white;font-size:0.78rem;padding:6px 14px;border-radius:18px;border:none;cursor:pointer;" onclick="openSubscribe()">订阅</button>';
}

function logout() { clearToken(); location.reload(); }

/* ── Subscribe ── */
function openSubscribe() {
  ensureModals();
  var token = getToken();
  if (!token) {
    localStorage.setItem('wf_redirect_after_auth', 'subscribe');
    openLogin(); return;
  }
  var modal = document.getElementById('subscribeModal');
  if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeSubscribe() {
  var el = document.getElementById('subscribeModal');
  if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
}

function selectPlan(index) {
  currentPlan = index;
  var cards = document.querySelectorAll('.plan-card');
  if (cards.length === 0) return;
  cards.forEach(function (c, i) { c.classList.toggle('selected', i === index); });
  var btn = document.getElementById('subscribeBtn');
  if (!btn) return;
  var prices = ['¥598/年', '¥60/月', '¥30/10天', '免费'];
  if (index === 3) {
    btn.textContent = '🎁 立即领取免费体验';
    btn.disabled = false;
  } else {
    btn.textContent = '立即订阅 · ' + prices[index];
    btn.disabled = false;
  }
}

async function handleSubscribe() {
  var token = getToken();
  if (!token) { closeSubscribe(); openLogin(); return; }

  if (currentPlan === 3) {
    try {
      var data = await apiFetch('/api/auth/me', { method: 'GET' });
      var u = data.data;
      if (u.freeTrialUsed > 0) { alert('您已使用过免费体验，请选择付费方案。'); return; }
      await apiFetch('/api/payment/create', {
        method: 'POST',
        body: JSON.stringify({ planIndex: 3, method: 'wechat' }),
      });
      alert('🎁 免费体验已激活！您已获得1次完整分析，快去搜索股票试试吧。');
      closeSubscribe();
      // After free trial activation, try redirect if pending
      setTimeout(function() {
        var redirect = localStorage.getItem('wf_redirect_after_auth');
        if (redirect === 'report' && typeof openReport === 'function') {
          localStorage.removeItem('wf_redirect_after_auth');
          openReport();
        }
      }, 300);
    } catch (err) {
      alert('操作失败：' + err.message);
    }
    return;
  }

  var method = await showPaymentMethodDialog();
  if (!method) return;

  try {
    var payData = await apiFetch('/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({ planIndex: currentPlan, method: method }),
    });

    if (method === 'wechat') {
      showWechatQR(payData.data.qrCode || payData.data.payUrl, payData.data.outTradeNo);
    } else {
      if (payData.data.payUrl) window.location.href = payData.data.payUrl;
    }
  } catch (err) {
    alert('创建支付订单失败：' + err.message);
  }
}

/* ── 支付方式选择对话框 ── */
function showPaymentMethodDialog() {
  return new Promise(function (resolve) {
    var bg = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:10001;';
    var box = 'background:white;border-radius:16px;padding:28px 24px;max-width:340px;width:88%;box-shadow:0 12px 40px rgba(0,0,0,0.18);text-align:center;';
    var overlay = document.createElement('div');
    overlay.style.cssText = bg;
    overlay.innerHTML =
      '<div style="' + box + '">' +
        '<h3 style="margin:0 0 18px;font-size:1.05rem;color:var(--navy);">选择支付方式</h3>' +
        '<button data-method="wechat" style="display:block;width:100%;padding:12px;margin-bottom:10px;border:2px solid #07C160;border-radius:10px;background:white;cursor:pointer;font-size:0.95rem;color:#07C160;font-weight:600;">🟢 微信支付</button>' +
        '<button data-method="alipay" style="display:block;width:100%;padding:12px;margin-bottom:10px;border:2px solid #1677FF;border-radius:10px;background:white;cursor:pointer;font-size:0.95rem;color:#1677FF;font-weight:600;">🔵 支付宝</button>' +
        '<button data-method="" style="display:block;width:100%;padding:10px;border:none;background:none;cursor:pointer;font-size:0.85rem;color:var(--text3);">取消</button>' +
      '</div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { resolve(null); overlay.remove(); }
    });
    overlay.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.getAttribute('data-method');
        overlay.remove();
        resolve(val || null);
      });
    });
    document.body.appendChild(overlay);
  });
}

/* ── 微信支付二维码弹窗 ── */
function showWechatQR(qrUrl, outTradeNo) {
  var bg = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:10002;';
  var box = 'background:white;border-radius:16px;padding:28px 24px;max-width:320px;width:88%;text-align:center;position:relative;';
  var overlay = document.createElement('div');
  overlay.style.cssText = bg;
  overlay.innerHTML =
    '<div style="' + box + '">' +
      '<button onclick="this.closest(\'.qr-overlay\').remove()" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text3);">✕</button>' +
      '<h3 style="margin:0 0 12px;font-size:1rem;color:var(--navy);">微信扫码支付</h3>' +
      '<div id="qrcode-container" style="margin:0 auto 12px;width:180px;height:180px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.78rem;color:var(--text3);">加载中...</div>' +
      '<p style="font-size:0.78rem;color:var(--text2);margin:0 0 6px;">请用微信扫描上方二维码</p>' +
      '<p id="pay-status" style="font-size:0.75rem;color:var(--text3);">支付成功后自动跳转...</p>' +
    '</div>';
  overlay.classList.add('qr-overlay');
  document.body.appendChild(overlay);

  var qrContainer = overlay.querySelector('#qrcode-container');
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(qrUrl || '');
  img.style.cssText = 'width:180px;height:180px;border-radius:6px;';
  img.onload = function () { qrContainer.innerHTML = ''; qrContainer.appendChild(img); };
  img.onerror = function () {
    qrContainer.innerHTML = '<span style="font-size:0.7rem;color:var(--text3);word-break:break-all;padding:8px;">' + (qrUrl || '') + '</span>';
  };

  var interval = setInterval(async function () {
    try {
      var d = await apiFetch('/api/payment/status?out_trade_no=' + encodeURIComponent(outTradeNo), { method: 'GET' });
      if (d.data && d.data.status === 'success') {
        clearInterval(interval);
        overlay.querySelector('#pay-status').textContent = '✅ 支付成功！正在刷新...';
        overlay.querySelector('#pay-status').style.color = '#07C160';
        // Keep redirect intent across reload
        var redirect = localStorage.getItem('wf_redirect_after_auth');
        setTimeout(function () {
          overlay.remove();
          if (redirect === 'report') {
            // Don't reload, just trigger openReport on the dashboard
            if (typeof openReport === 'function') {
              localStorage.removeItem('wf_redirect_after_auth');
              closeSubscribe();
              openReport();
            } else {
              location.reload();
            }
          } else {
            location.reload();
          }
        }, 1500);
      }
    } catch (e) { /* ignore */ }
  }, 3000);

  setTimeout(function () { clearInterval(interval); }, 1800000);
}

/* ── About ── */
function openAbout() {
  ensureModals();
  var modal = document.getElementById('aboutModal');
  if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeAbout() {
  var el = document.getElementById('aboutModal');
  if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
}

/* ── Framework ── */
function openFramework() {
  ensureModals();
  var modal = document.getElementById('frameworkModal');
  if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeFramework() {
  var el = document.getElementById('frameworkModal');
  if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', function () {
  ensureModals();
  updateLoginState();
  // 绑定弹窗背景点击关闭
  ['loginModal','subscribeModal','aboutModal','frameworkModal'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function (e) { if (e.target === this) el.classList.remove('active'); });
  });
});
