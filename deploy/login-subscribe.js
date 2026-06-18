/* ══════ LOGIN / REGISTER / SUBSCRIBE — DOM构建版 ══════ */
var API_BASE = (function () {
  if (location.hostname.endsWith('.pages.dev')) return 'https://windforest-api.414946437.workers.dev';
  if (location.hostname === 'windforest.cn' || location.hostname === 'www.windforest.cn') return 'https://api.windforest.cn';
  if (location.hostname.endsWith('github.io')) return 'https://api.windforest.cn';
  if (location.hostname === 'localhost' || location.port) return 'http://localhost:8787';
  return 'https://api.windforest.cn';
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
  if (!resp.ok) throw new Error(data.message || '请求失败(' + resp.status + ')');
  return data;
}

/* ── 完整Modal CSS（补充） ── */
var MODAL_CSS = '';

/* ── DOM构建辅助 ── */
function el(tag, attrs, children) {
  var e = document.createElement(tag);
  if (attrs) { for (var k in attrs) { if (k === 'className') e.className = attrs[k]; else if (k === 'innerHTML') e.innerHTML = attrs[k]; else if (k === 'style') { for (var sk in attrs.style) e.style[sk] = attrs.style[sk]; } else e.setAttribute(k, attrs[k]); } }
  if (children) { if (typeof children === 'string') e.textContent = children; else if (Array.isArray(children)) children.forEach(function(c) { if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c); }); }
  return e;
}

/* ═══════════ 登录/注册Modal ═══════════ */
// 验证码倒计时
var codeTimer = null, codeCountdown = 0;

function buildLoginModal() {
  if (document.getElementById('loginModal')) return;
  var overlay = el('div', {className:'modal-overlay', id:'loginModal', style:{display:'none'}});
  
  // 关闭按钮
  var closeBtn = el('button', {className:'login-close', innerHTML:'&#10005;', style:{position:'absolute',top:'12px',right:'14px',border:'none',background:'none',cursor:'pointer',fontSize:'1.2rem',color:'#9CA3AF',zIndex:'1'}});
  closeBtn.onclick = closeLogin;
  
  var panel = el('div', {className:'', style:{background:'white',borderRadius:'12px',padding:'0',width:'92%',maxWidth:'400px',margin:'auto',position:'relative',boxShadow:'0 8px 32px rgba(0,0,0,0.2)'}});
  
  // 头部：轮播图区域
  var headerArea = el('div', {style:{background:'linear-gradient(135deg, #1E40AF, #3B82F6)', padding:'28px 24px 24px', borderRadius:'12px 12px 0 0', textAlign:'center', color:'white', position:'relative'}});
  headerArea.appendChild(el('div', {innerHTML:'<svg width="36" height="36" viewBox="0 0 100 100" fill="none"><g transform="translate(50,50)"><path d="M0,-4 C6,-12 12,-26 6,-38 C4,-42 0,-42 -2,-38 C-8,-26 -4,-12 0,-4Z" fill="#FFD700" transform="rotate(45)"/><path d="M0,-4 C6,-12 12,-26 6,-38 C4,-42 0,-42 -2,-38 C-8,-26 -4,-12 0,-4Z" fill="#0D9488" transform="rotate(135)"/><path d="M0,-4 C6,-12 12,-26 6,-38 C4,-42 0,-42 -2,-38 C-8,-26 -4,-12 0,-4Z" fill="#B45309" transform="rotate(225)"/><path d="M0,-4 C6,-12 12,-26 6,-38 C4,-42 0,-42 -2,-38 C-8,-26 -4,-12 0,-4Z" fill="#7C3AED" transform="rotate(315)"/><circle cx="0" cy="0" r="6" fill="#CA8A04"/></g></svg>', style:{marginBottom:'10px'}}));
  headerArea.appendChild(el('h2', {style:{fontSize:'1.15rem',fontWeight:'700',margin:'0 0 4px',letterSpacing:'1px'}}, '风林慧策'));
  headerArea.appendChild(el('div', {style:{fontSize:'0.75rem',opacity:'0.85'}}, 'PMQD 价值投资 AI 分析平台'));
  
  // 登录方式标签
  var loginMethod = 'password'; // 'password' | 'code'
  var tabBar = el('div', {style:{display:'flex',margin:'0 24px',borderBottom:'1px solid #E5E7EB'}});
  
  var pwTab = el('div', {className:'', style:{flex:'1',padding:'12px 0',textAlign:'center',fontSize:'0.88rem',cursor:'pointer',borderBottom:'2px solid #1E40AF',color:'#1E40AF',fontWeight:'600'}}, '账号登录');
  var codeTab = el('div', {className:'', style:{flex:'1',padding:'12px 0',textAlign:'center',fontSize:'0.88rem',cursor:'pointer',borderBottom:'2px solid transparent',color:'#6B7280',fontWeight:'400'}}, '验证码登录');
  
  pwTab.onclick = function() { loginMethod = 'password'; pwTab.style.cssText = 'flex:1;padding:12px 0;text-align:center;font-size:0.88rem;cursor:pointer;border-bottom:2px solid #1E40AF;color:#1E40AF;font-weight:600'; codeTab.style.cssText = 'flex:1;padding:12px 0;text-align:center;font-size:0.88rem;cursor:pointer;border-bottom:2px solid transparent;color:#6B7280;font-weight:400'; updateLoginForm(); };
  codeTab.onclick = function() { loginMethod = 'code'; codeTab.style.cssText = 'flex:1;padding:12px 0;text-align:center;font-size:0.88rem;cursor:pointer;border-bottom:2px solid #1E40AF;color:#1E40AF;font-weight:600'; pwTab.style.cssText = 'flex:1;padding:12px 0;text-align:center;font-size:0.88rem;cursor:pointer;border-bottom:2px solid transparent;color:#6B7280;font-weight:400'; updateLoginForm(); };
  
  tabBar.appendChild(pwTab);
  tabBar.appendChild(codeTab);
  
  // 表单容器
  var formArea = el('div', {style:{padding:'24px'}});
  var formEl = el('form', {id:'loginFormEl'});
  formEl.onsubmit = function(e) { e.preventDefault(); handleLoginSubmit(); };
  
  // 手机号/邮箱输入
  formEl.appendChild(el('label', {style:{display:'block',fontSize:'0.78rem',color:'#6B7280',marginBottom:'6px'}}, '手机号 / 邮箱'));
  var accountInput = el('input', {type:'text',id:'loginAccount',placeholder:'请输入手机号或邮箱',style:{width:'100%',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',marginBottom:'14px'}});
  accountInput.onfocus = function() { this.style.borderColor = '#1E40AF'; };
  accountInput.onblur = function() { this.style.borderColor = '#E5E7EB'; };
  formEl.appendChild(accountInput);
  
  // 密码输入（密码登录时显示）
  var pwdRow = el('div', {id:'pwdRow'});
  pwdRow.appendChild(el('label', {style:{display:'block',fontSize:'0.78rem',color:'#6B7280',marginBottom:'6px'}}, '密码'));
  var pwdInput = el('input', {type:'password',id:'loginPassword',placeholder:'请输入密码',style:{width:'100%',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',marginBottom:'14px'}});
  pwdInput.onfocus = function() { this.style.borderColor = '#1E40AF'; };
  pwdInput.onblur = function() { this.style.borderColor = '#E5E7EB'; };
  pwdRow.appendChild(pwdInput);
  formEl.appendChild(pwdRow);
  
  // 验证码输入（验证码登录时显示）
  var codeRow = el('div', {id:'codeRow',style:{display:'none'}});
  codeRow.appendChild(el('label', {style:{display:'block',fontSize:'0.78rem',color:'#6B7280',marginBottom:'6px'}}, '验证码'));
  var codeWrap = el('div', {style:{display:'flex',gap:'10px',marginBottom:'14px'}});
  var codeInput = el('input', {type:'text',id:'loginCode',placeholder:'请输入验证码',style:{flex:'1',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'0.9rem',outline:'none',boxSizing:'border-box'}});
  codeInput.onfocus = function() { this.style.borderColor = '#1E40AF'; };
  codeInput.onblur = function() { this.style.borderColor = '#E5E7EB'; };
  var codeBtn = el('button', {type:'button',id:'sendCodeBtn',style:{padding:'10px 16px',background:'#1E40AF',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'0.85rem',whiteSpace:'nowrap'}}, '获取验证码');
  codeBtn.onclick = function() { sendVerificationCode(); };
  codeWrap.appendChild(codeInput);
  codeWrap.appendChild(codeBtn);
  codeRow.appendChild(codeWrap);
  formEl.appendChild(codeRow);
  
  // 登录按钮
  var submitBtn = el('button', {type:'submit',style:{width:'100%',padding:'12px',background:'#1E40AF',color:'white',border:'none',borderRadius:'8px',fontSize:'0.92rem',cursor:'pointer',fontWeight:'600'}}, '登 录');
  formEl.appendChild(submitBtn);
  
  formArea.appendChild(formEl);
  
  // 底部：注册入口
  var footer = el('div', {style:{padding:'0 24px 20px',textAlign:'center',fontSize:'0.8rem',color:'#6B7280'}});
  footer.appendChild(document.createTextNode('还没有账号？'));
  var regLink = el('a', {style:{color:'#1E40AF',cursor:'pointer',fontWeight:'500',marginLeft:'4px'}}, '立即注册');
  regLink.onclick = function() { closeLogin(); setTimeout(function() { openRegisterModal(); }, 200); };
  footer.appendChild(regLink);
  footer.appendChild(el('br'));
  footer.appendChild(el('a', {style:{color:'#9CA3AF',fontSize:'0.7rem',cursor:'pointer',display:'inline-block',marginTop:'8px'}}, '遇到问题？联系客服 service@windforest.cn'));
  
  panel.appendChild(closeBtn);
  panel.appendChild(headerArea);
  panel.appendChild(tabBar);
  panel.appendChild(formArea);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  
  // 背景点击关闭
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeLogin(); });
  
  document.body.appendChild(overlay);
  
  // 更新表单显示
  window._updateLoginForm = function() {
    if (loginMethod === 'password') {
      pwdRow.style.display = '';
      codeRow.style.display = 'none';
    } else {
      pwdRow.style.display = 'none';
      codeRow.style.display = '';
    }
  };
}

function updateLoginForm() { if (window._updateLoginForm) window._updateLoginForm(); }

/* ═══════════ 验证码（开发模式：任意6位数通过） ═══════════ */
function sendVerificationCode() {
  var account = document.getElementById('loginAccount');
  if (!account || !account.value.trim()) { alert('请先输入手机号或邮箱'); return; }
  var val = account.value.trim();
  var isPhone = /^1[3-9]\d{9}$/.test(val);
  var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  if (!isPhone && !isEmail) { alert('请输入有效的手机号或邮箱'); return; }
  
  // 开发模式：直接提示
  alert('验证码已发送（开发模式验证码：123456）');
  var btn = document.getElementById('sendCodeBtn');
  if (btn) { btn.textContent = '已发送'; btn.disabled = true; setTimeout(function() { btn.textContent = '重新获取'; btn.disabled = false; }, 60000); }
  
  // TODO: 生产环境调用后端API发送真实验证码
  // apiFetch('/api/auth/send-code', {method:'POST', body:JSON.stringify({target: val})})
}

/* ═══════════ 登录/注册Modal ═══════════ */
function openLogin() {
  buildLoginModal();
  var modal = document.getElementById('loginModal');
  if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}
function closeLogin() {
  var modal = document.getElementById('loginModal');
  if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

function handleLoginSubmit() {
  var account = document.getElementById('loginAccount').value.trim();
  if (!account) { alert('请输入手机号或邮箱'); return; }
  
  var loginMethod = window._loginMethod || 'password'; // 通过全局变量获取当前登录方式
  
  // 开发模式：直接模拟登录成功
  if (account && account.length >= 3) {
    // 直接用localStorage模拟登录
    var fakeToken = 'dev_token_' + Date.now();
    setToken(fakeToken);
    localStorage.setItem('wf_user', JSON.stringify({account: account, plan: 'free', createdAt: new Date().toISOString()}));
    alert('登录成功（开发模式）');
    closeLogin();
    updateLoginState();
    setTimeout(checkAuthRedirect, 300);
    return;
  }
  
  // 生产模式：调用API
  var pwd = document.getElementById('loginPassword');
  var code = document.getElementById('loginCode');
  var isCodeMode = code && code.parentElement.parentElement.style.display !== 'none';
  
  var payload = { account: account };
  if (isCodeMode) {
    payload.code = code.value.trim();
    if (!payload.code || payload.code.length < 4) { alert('请输入验证码'); return; }
  } else {
    payload.password = pwd ? pwd.value : '';
    if (!payload.password) { alert('请输入密码'); return; }
  }
  
  apiFetch('/api/auth/login', {method:'POST', body:JSON.stringify(payload)})
    .then(function(data) {
      setToken(data.data.token);
      localStorage.setItem('wf_user', JSON.stringify(data.data.user));
      alert('登录成功！');
      closeLogin();
      updateLoginState();
      setTimeout(checkAuthRedirect, 300);
    })
    .catch(function(err) {
      alert('登录失败：' + err.message);
    });
}

/* ═══════════ 注册Modal ═══════════ */
function buildRegisterModal() {
  if (document.getElementById('registerModal')) return;
  var overlay = el('div', {className:'modal-overlay', id:'registerModal', style:{display:'none'}});
  
  var closeBtn = el('button', {className:'login-close', innerHTML:'&#10005;', style:{position:'absolute',top:'12px',right:'14px',border:'none',background:'none',cursor:'pointer',fontSize:'1.2rem',color:'#9CA3AF',zIndex:'1'}});
  closeBtn.onclick = closeRegister;
  
  var panel = el('div', {style:{background:'white',borderRadius:'12px',padding:'0',width:'92%',maxWidth:'400px',margin:'auto',position:'relative',boxShadow:'0 8px 32px rgba(0,0,0,0.2)'}});
  
  // 头部
  var headerArea = el('div', {style:{background:'linear-gradient(135deg, #CA8A04, #E5B80B)', padding:'28px 24px 24px', borderRadius:'12px 12px 0 0', textAlign:'center', color:'white'}});
  headerArea.appendChild(el('h2', {style:{fontSize:'1.15rem',fontWeight:'700',margin:'0 0 4px',letterSpacing:'1px'}}, '创建账户'));
  headerArea.appendChild(el('div', {style:{fontSize:'0.75rem',opacity:'0.85'}}, '注册即享一次免费完整分析'));
  
  // 表单
  var formArea = el('div', {style:{padding:'24px'}});
  var formEl = el('form');
  formEl.onsubmit = function(e) { e.preventDefault(); handleRegisterSubmit(); };
  
  // 手机号
  formEl.appendChild(el('label', {style:{display:'block',fontSize:'0.78rem',color:'#6B7280',marginBottom:'6px'}}, '手机号'));
  var phoneInput = el('input', {type:'tel',id:'regPhone',placeholder:'请输入手机号',style:{width:'100%',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',marginBottom:'14px'}});
  phoneInput.onfocus = function() { this.style.borderColor = '#CA8A04'; };
  phoneInput.onblur = function() { this.style.borderColor = '#E5E7EB'; };
  formEl.appendChild(phoneInput);
  
  // 邮箱（可选，订阅时需要）
  formEl.appendChild(el('label', {style:{display:'block',fontSize:'0.78rem',color:'#6B7280',marginBottom:'6px'}}, '邮箱（用于接收分析报告，选填）'));
  var emailInput = el('input', {type:'email',id:'regEmail',placeholder:'请输入邮箱地址',style:{width:'100%',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',marginBottom:'14px'}});
  emailInput.onfocus = function() { this.style.borderColor = '#CA8A04'; };
  emailInput.onblur = function() { this.style.borderColor = '#E5E7EB'; };
  formEl.appendChild(emailInput);
  
  // 密码
  formEl.appendChild(el('label', {style:{display:'block',fontSize:'0.78rem',color:'#6B7280',marginBottom:'6px'}}, '设置密码'));
  var pwdInput = el('input', {type:'password',id:'regPassword',placeholder:'6位以上密码',style:{width:'100%',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',marginBottom:'14px'}});
  pwdInput.onfocus = function() { this.style.borderColor = '#CA8A04'; };
  pwdInput.onblur = function() { this.style.borderColor = '#E5E7EB'; };
  formEl.appendChild(pwdInput);
  
  // 确认密码
  formEl.appendChild(el('label', {style:{display:'block',fontSize:'0.78rem',color:'#6B7280',marginBottom:'6px'}}, '确认密码'));
  var pwd2Input = el('input', {type:'password',id:'regPassword2',placeholder:'再次输入密码',style:{width:'100%',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',marginBottom:'14px'}});
  pwd2Input.onfocus = function() { this.style.borderColor = '#CA8A04'; };
  pwd2Input.onblur = function() { this.style.borderColor = '#E5E7EB'; };
  formEl.appendChild(pwd2Input);
  
  // 验证码
  formEl.appendChild(el('label', {style:{display:'block',fontSize:'0.78rem',color:'#6B7280',marginBottom:'6px'}}, '验证码'));
  var codeWrap2 = el('div', {style:{display:'flex',gap:'10px',marginBottom:'14px'}});
  var codeInput2 = el('input', {type:'text',id:'regCode',placeholder:'请输入验证码',style:{flex:'1',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'0.9rem',outline:'none',boxSizing:'border-box'}});
  codeInput2.onfocus = function() { this.style.borderColor = '#CA8A04'; };
  codeInput2.onblur = function() { this.style.borderColor = '#E5E7EB'; };
  var codeBtn2 = el('button', {type:'button',id:'regSendCodeBtn',style:{padding:'10px 16px',background:'#CA8A04',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'0.85rem',whiteSpace:'nowrap'}}, '获取验证码');
  codeBtn2.onclick = function() {
    var phone = document.getElementById('regPhone').value.trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) { alert('请输入有效的手机号'); return; }
    alert('验证码已发送（开发模式验证码：123456）');
    codeBtn2.textContent = '已发送'; codeBtn2.disabled = true;
    setTimeout(function() { codeBtn2.textContent = '重新获取'; codeBtn2.disabled = false; }, 60000);
  };
  codeWrap2.appendChild(codeInput2);
  codeWrap2.appendChild(codeBtn2);
  formEl.appendChild(codeWrap2);
  
  // 协议
  var agreeRow = el('div', {style:{display:'flex',alignItems:'flex-start',gap:'6px',marginBottom:'18px',fontSize:'0.75rem',color:'#9CA3AF'}});
  var agreeCheck = el('input', {type:'checkbox',id:'regAgree',checked:'checked',style:{marginTop:'2px'}});
  agreeRow.appendChild(agreeCheck);
  agreeRow.appendChild(document.createTextNode('注册即表示同意《服务协议》和《隐私政策》'));
  formEl.appendChild(agreeRow);
  
  // 注册按钮
  var submitBtn2 = el('button', {type:'submit',style:{width:'100%',padding:'12px',background:'linear-gradient(135deg,#CA8A04,#E5B80B)',color:'white',border:'none',borderRadius:'8px',fontSize:'0.92rem',cursor:'pointer',fontWeight:'600'}}, '注册并领取免费体验');
  formEl.appendChild(submitBtn2);
  
  formArea.appendChild(formEl);
  
  // 底部
  var footer2 = el('div', {style:{padding:'0 24px 20px',textAlign:'center',fontSize:'0.8rem',color:'#6B7280'}});
  footer2.appendChild(document.createTextNode('已有账号？'));
  var loginLink = el('a', {style:{color:'#1E40AF',cursor:'pointer',fontWeight:'500',marginLeft:'4px'}}, '去登录');
  loginLink.onclick = function() { closeRegister(); setTimeout(function() { openLogin(); }, 200); };
  footer2.appendChild(loginLink);
  
  panel.appendChild(closeBtn);
  panel.appendChild(headerArea);
  panel.appendChild(formArea);
  panel.appendChild(footer2);
  overlay.appendChild(panel);
  
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeRegister(); });
  
  document.body.appendChild(overlay);
}

function openRegisterModal() {
  buildRegisterModal();
  var modal = document.getElementById('registerModal');
  if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}
function closeRegister() {
  var modal = document.getElementById('registerModal');
  if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

function handleRegisterSubmit() {
  var phone = document.getElementById('regPhone').value.trim();
  var email = document.getElementById('regEmail').value.trim();
  var pwd = document.getElementById('regPassword').value;
  var pwd2 = document.getElementById('regPassword2').value;
  var code = document.getElementById('regCode').value.trim();
  var agree = document.getElementById('regAgree');
  
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { alert('请输入有效的手机号'); return; }
  if (!pwd || pwd.length < 6) { alert('密码至少为6位'); return; }
  if (pwd !== pwd2) { alert('两次密码不一致'); return; }
  if (!code || code.length < 4) { alert('请输入验证码'); return; }
  if (agree && !agree.checked) { alert('请阅读并同意服务协议'); return; }
  
  // 开发模式：验证码123456直接通过
  if (code !== '123456') { alert('验证码错误（开发模式请输入123456）'); return; }
  
  // 直接模拟注册成功
  var fakeToken = 'dev_token_' + Date.now();
  setToken(fakeToken);
  var userData = {account: phone, email: email, plan: 'free', freeTrialUsed: 0, createdAt: new Date().toISOString()};
  localStorage.setItem('wf_user', JSON.stringify(userData));
  alert('注册成功！已赠送您1次完整分析免费体验。');
  closeRegister();
  updateLoginState();
  setTimeout(checkAuthRedirect, 300);
  
  // 生产模式调用API：
  // apiFetch('/api/auth/register', {method:'POST', body:JSON.stringify({account:phone, email:email, password:pwd, code:code})})
}

/* ═══════════ 订阅Modal ═══════════ */
function buildSubscribeModal() {
  if (document.getElementById('subscribeModal')) return;
  var overlay = el('div', {className:'subscribe-overlay', id:'subscribeModal', style:{display:'none'}});
  var panel = el('div', {className:'subscribe-panel', style:{background:'white',borderRadius:'12px',padding:'36px 32px 28px',width:'92%',maxWidth:'520px',margin:'auto',position:'relative',boxShadow:'0 8px 32px rgba(0,0,0,0.2)',maxHeight:'90vh',overflowY:'auto'}});
  
  panel.appendChild(el('button', {className:'subscribe-close', innerHTML:'&#10005;', style:{position:'absolute',top:'12px',right:'14px',border:'none',background:'none',cursor:'pointer',fontSize:'1.2rem',color:'#9CA3AF'}, onclick:function(){closeSubscribe()}}));
  panel.appendChild(el('h2', {style:{fontFamily:'PingFang SC,Microsoft YaHei,sans-serif',fontSize:'1.3rem',color:'#1E40AF',letterSpacing:'2px',marginBottom:'4px'}}, '解锁完整分析'));
  panel.appendChild(el('div', {className:'', style:{fontSize:'0.76rem',color:'#9CA3AF',marginBottom:'22px'}}, '选择订阅方案，畅享风林慧策全部功能'));
  
  // 邮箱收集（订阅必须提供邮箱）
  panel.appendChild(el('label', {style:{display:'block',fontSize:'0.78rem',color:'#6B7280',marginBottom:'6px',fontWeight:'500'}}, '接收分析报告的邮箱 *'));
  var emailInput = el('input', {type:'email',id:'subEmail',placeholder:'请输入用于接收报告的邮箱',style:{width:'100%',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',marginBottom:'16px'}});
  emailInput.onfocus = function() { this.style.borderColor = '#1E40AF'; };
  emailInput.onblur = function() { this.style.borderColor = '#E5E7EB'; };
  panel.appendChild(emailInput);
  
  // 方案卡片
  var plans = [
    {name:'年费会员', desc:'约 ¥49.8/月，不限次分析', price:'¥598', unit:'/年', icon:'📅'},
    {name:'月费会员', desc:'灵活订阅，随时取消', price:'¥60', unit:'/月', icon:'📆'},
    {name:'10天体验', desc:'体验价，不限次分析', price:'¥30', unit:'/10天', icon:'⏳'},
    {name:'免费体验一次', desc:'注册即送，无需付费', price:'免费', unit:'', icon:'🎁', free:true}
  ];
  var planCards = el('div', {style:{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'18px'}});
  plans.forEach(function(p, i) {
    var card = el('div', {style:{display:'flex',alignItems:'center',padding:'16px 20px',border:'1.5px solid '+(i===0?'#CA8A04':'#E5E7EB'),borderRadius:'12px',cursor:'pointer',gap:'16px',background:i===0?'#FFF9E6':'',borderStyle:p.free?'dashed':'solid'}});
    card.onclick = function() {
      selectPlan(i);
      // Visual feedback
      planCards.querySelectorAll('div[style*="display:flex;align-items:center"]').forEach(function(c) {
        c.style.borderColor = '#E5E7EB'; c.style.background = '';
      });
      card.style.borderColor = '#CA8A04'; card.style.background = '#FFF9E6';
    };
    card.appendChild(el('span', {style:{fontSize:'1.6rem',flexShrink:'0'}}, p.icon));
    var info = el('div', {style:{flex:'1'}});
    info.appendChild(el('div', {style:{fontSize:'0.92rem',fontWeight:'700',color:p.free?'#2D7A3E':'#1A1A2E'}}, p.name));
    info.appendChild(el('div', {style:{fontSize:'0.74rem',color:'#9CA3AF',marginTop:'2px'}}, p.desc));
    card.appendChild(info);
    var price = el('div', {style:{fontSize:'1.1rem',fontWeight:'700',color:p.free?'#2D7A3E':'#1E40AF',whiteSpace:'nowrap'}});
    price.appendChild(document.createTextNode(p.price));
    if (p.unit) price.appendChild(el('span', {style:{fontSize:'0.72rem',fontWeight:'400',color:'#9CA3AF'}}, p.unit));
    card.appendChild(price);
    planCards.appendChild(card);
  });
  panel.appendChild(planCards);
  
  // 订阅按钮
  var subBtn = el('button', {id:'subscribeBtnEl', style:{width:'100%',padding:'13px',background:'#CA8A04',color:'white',border:'none',borderRadius:'10px',fontSize:'0.95rem',fontWeight:'700',cursor:'pointer',letterSpacing:'1px'}}, '立即订阅 · ¥60/月');
  subBtn.onclick = function() { handleSubscribe(); };
  panel.appendChild(subBtn);
  panel.appendChild(el('div', {style:{fontSize:'0.72rem',color:'#9CA3AF',textAlign:'center',marginTop:'12px'}}, '🔒 支付安全 · 微信/支付宝均可 · 订阅后可随时取消'));
  
  overlay.appendChild(panel);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeSubscribe(); });
  document.body.appendChild(overlay);
}

function openSubscribe() {
  buildSubscribeModal();
  // 预填邮箱
  var user = localStorage.getItem('wf_user');
  if (user) {
    try { var u = JSON.parse(user); if (u.email) { var e = document.getElementById('subEmail'); if (e) e.value = u.email; } } catch(ex) {}
  }
  var modal = document.getElementById('subscribeModal');
  if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}
function closeSubscribe() {
  var modal = document.getElementById('subscribeModal');
  if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

function selectPlan(i) {
  currentPlan = i;
  var btn = document.getElementById('subscribeBtnEl');
  if (!btn) return;
  var prices = ['¥598/年', '¥60/月', '¥30/10天', '免费体验'];
  btn.textContent = i === 3 ? '开始免费体验' : '立即订阅 · ' + prices[i];
}

function handleSubscribe() {
  var email = document.getElementById('subEmail');
  if (!email || !email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    alert('请提供有效的邮箱以接收分析报告');
    return;
  }
  if (currentPlan === 3) {
    alert('免费体验已激活！请登录后使用。');
    closeSubscribe();
    return;
  }
  // 生产模式：跳转支付
  alert('即将跳转支付页面（开发模式：已模拟订阅成功）\n邮箱：' + email.value.trim() + '\n方案：' + currentPlan);
  // TODO: 实际支付回调
  closeSubscribe();
}

/* ═══════════ 用户状态更新（兼容index/dashboard/report） ═══════════ */
function updateLoginState() {
  var token = getToken();
  var areas = document.querySelectorAll('#headerLoginArea, .top-bar-actions, .header-actions');
  var btnArea = null;
  for (var i = 0; i < areas.length; i++) { if (areas[i]) { btnArea = areas[i]; break; } }
  if (!btnArea) return;

  if (token) {
    var user = localStorage.getItem('wf_user');
    var displayName = '用户';
    if (user) {
      try { var u = JSON.parse(user); displayName = (u.email || u.account || '用户').substring(0, 12); } catch(e) {}
    }
    btnArea.innerHTML =
      '<span style="font-size:0.8rem;color:#6B7280;margin-right:8px;">' + displayName + '</span>' +
      '<button class="header-btn btn-subscribe" onclick="openSubscribe()" style="padding:7px 14px;">订阅</button>' +
      '<button class="header-btn" onclick="clearToken();location.reload()" style="padding:7px 14px;background:#E5E7EB;">退出</button>';
  } else {
    btnArea.innerHTML =
      '<button class="header-btn" onclick="openLogin()" style="padding:7px 16px;background:var(--navy);color:white;">登录</button>' +
      '<button class="header-btn btn-subscribe" onclick="openRegisterModal()" style="padding:7px 16px;">注册</button>';
  }
}

/* ── 认证后重定向 ── */
function checkAuthRedirect() {
  var redirect = localStorage.getItem('wf_redirect_after_auth');
  if (!redirect) return;
  if (redirect === 'subscribe') { localStorage.removeItem('wf_redirect_after_auth'); if (typeof openSubscribe === 'function') setTimeout(function(){openSubscribe();},500); return; }
  if (redirect === 'report') { localStorage.removeItem('wf_redirect_after_auth'); if (typeof openReport === 'function') setTimeout(function(){openReport();},300); return; }
}

/* ═══════════ About/Framework Modals ═══════════ */
function openAbout() {
  var id = 'aboutModal';
  if (!document.getElementById(id)) {
    var ov = el('div', {className:'modal-overlay', id:id, style:{display:'none'}});
    var pn = el('div', {className:'modal-panel', style:{maxWidth:'600px',background:'white',borderRadius:'12px',padding:'30px',boxShadow:'0 8px 32px rgba(0,0,0,0.15)',maxHeight:'85vh',overflowY:'auto',margin:'auto'}});
    pn.innerHTML = '<button class="modal-close" style="position:absolute;top:12px;right:14px;border:none;background:none;cursor:pointer;font-size:1.2rem;color:#9CA3AF;z-index:1" onclick="closeAbout()">&#10005;</button><h2 style="margin-bottom:4px;"><span style="color:#CA8A04">风</span>林<span style="color:#CA8A04">慧</span>策</h2><div style="font-size:0.76rem;color:#9CA3AF;margin-bottom:16px">PMQD 价值投资 AI 分析师</div><h3 style="font-size:0.85rem;color:#1E40AF;margin:12px 0 6px">使命</h3><p style="font-size:0.85rem;line-height:1.8">让每一位普通投资者，都拥有一套科学、系统、可复用的价值投资决策框架。</p><h3 style="font-size:0.85rem;color:#1E40AF;margin:12px 0 6px">愿景</h3><p style="font-size:0.85rem;line-height:1.8">成为中国价值投资者首选的AI智能投资评估平台。</p><div style="font-size:0.72rem;color:#9CA3AF;margin-top:16px;padding-top:12px;border-top:1px solid #E5E7EB">免责声明：所有分析结论仅供参考，不构成任何投资建议。</div>';
    pn.style.position = 'relative';
    ov.appendChild(pn);
    ov.addEventListener('click', function(e) { if (e.target === ov) closeAbout(); });
    document.body.appendChild(ov);
  }
  var m = document.getElementById(id);
  m.style.display = 'flex'; document.body.style.overflow = 'hidden';
}
function closeAbout() {
  var m = document.getElementById('aboutModal');
  if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
}

/* ═══════════ Init ═══════════ */
document.addEventListener('DOMContentLoaded', function () {
  // 预构建所有modal（但隐藏）
  buildLoginModal();
  buildRegisterModal();
  buildSubscribeModal();
  updateLoginState();
});
