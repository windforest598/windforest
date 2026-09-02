/**
 * report.html V6.0 渲染器功能冒烟
 * 用零依赖 DOM stub 执行真实内联脚本 + 真实报告 JSON，
 * 断言 renderV6 分支被命中且输出符合 V6.0 契约。
 *
 * 运行： node fullstack/scripts/smoke-report-v6.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOY = resolve(__dirname, '../../deploy');
const REPORTS = join(DEPLOY, 'data/reports');

// ── 提取内联脚本 ──
const html = readFileSync(join(DEPLOY, 'report.html'), 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!blocks.length) { console.error('❌ 未找到内联脚本'); process.exit(1); }
const scriptCode = blocks.join('\n;\n');

// ── DOM stub ──
function makeEl(id) {
  const el = {
    id,
    _html: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { return c; }, removeChild() {}, remove() {},
    querySelector() { return makeEl('q'); }, querySelectorAll() { return []; },
    focus() {}, click() {}, closest() { return null; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) { el._html = v; },
  });
  return el;
}

function buildEnv({ stockCode, market, name }) {
  const els = new Map();
  const base = {
    getElementById(id) {
      if (!els.has(id)) els.set(id, makeEl(id));
      return els.get(id);
    },
    querySelector(s) { return makeEl(String(s)); },
    querySelectorAll() { return []; },
    createElement(t) { return makeEl(t); },
    addEventListener() {},
    body: makeEl('body'),
    documentElement: makeEl('html'),
    title: '',
  };
  const document = new Proxy(base, {
    get(t, k) { return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });

  const location = {
    search: '?code=' + stockCode + '&market=' + market + '&name=' + encodeURIComponent(name),
    hostname: 'localhost',
    pathname: '/report.html',
    href: 'http://localhost/report.html',
    reload() {},
  };

  const fetchStub = (url) => {
    const u = String(url);
    const m = /data\/reports\/([A-Za-z0-9_]+)\.json/.exec(u);
    if (m) {
      const f = join(REPORTS, m[1] + '.json');
      if (existsSync(f)) {
        const txt = readFileSync(f, 'utf8');
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve(JSON.parse(txt)),
          text: () => Promise.resolve(txt),
        });
      }
    }
    return Promise.resolve({
      ok: false, status: 404,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    });
  };

  const sandbox = {
    console, document, location, fetch: fetchStub,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, setImmediate,
    encodeURIComponent, decodeURIComponent, TextEncoder, TextDecoder, URL, URLSearchParams,
    alert() {}, confirm() { return true; },
    navigator: { userAgent: 'node-smoke', language: 'zh-CN' },
    Chart: function () { return { destroy() {}, update() {} }; },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  return { sandbox, els };
}

async function drain(n = 60) {
  for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 50));
  for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
}

// ── 断言器 ──
let failures = 0;
function must(cond, label, extra) {
  if (cond) { console.log('   ✅ ' + label); }
  else { console.log('   ❌ ' + label + (extra ? '  → ' + extra : '')); failures++; }
}

async function runCase({ stockCode, market, name, file, expect }) {
  console.log('\n──────── ' + name + ' (' + stockCode + '.' + market + ') ────────');
  const { sandbox, els } = buildEnv({ stockCode, market, name });

  let vmError = null;
  try {
    vm.createContext(sandbox);
    vm.runInContext(scriptCode, sandbox, { filename: 'report.html:inline' });
  } catch (e) { vmError = e; }
  await drain();

  must(!vmError, '脚本执行无运行时异常', vmError && vmError.message);

  const main = els.get('mainContent');
  const out = main ? main.innerHTML : '';
  must(!!out, 'mainContent 已写入 HTML', 'innerHTML 为空');

  // V6.0 分支命中（旧分支会输出 "PMQD V5.9 综合评分"）
  must(out.includes('PMQD V6.0'), '命中 V6.0 渲染分支（非 V5.9 回退）',
    out.includes('PMQD V5.9') ? '仍走了旧渲染器' : '');
  must(!out.includes('深度分析数据正在准备中'), '未落到「无数据」兜底');

  // 核心结论
  const d = JSON.parse(readFileSync(join(REPORTS, file + '.json'), 'utf8'));
  must(out.includes(String(d.pmqd.total)), 'PMQD 总分渲染 (' + d.pmqd.total + ')');
  const ratingTxt = /★/.test(String(d.overallRating)) ? d.overallRating : '综合评级 ' + d.overallRating;
  must(out.includes(ratingTxt), '评级渲染 (' + d.overallRating + ')');
  must(out.includes('策略 ' + d.strategy), '策略渲染 (' + d.strategy + ')');
  must(out.includes(d.determinism), '确定性徽标渲染 (' + d.determinism + ')');

  // ── V6.0.7 规范落地断言 ──
  must(out.includes('固定权重 P40/M18/Q30/D12'), 'PMQD 固定权重口径公示');
  if (d.ratingLabel) must(out.includes(d.ratingLabel), '评级标签渲染 (' + d.ratingLabel + ')');
  if (d.positionHint) must(out.includes(d.positionHint), '仓位提示渲染 (' + d.positionHint + ')');
  if (d.downgrades && d.downgrades.length) {
    must(out.includes('降档：'), '降档原因公示 ×' + d.downgrades.length);
  }
  must(out.includes('决策仪表盘'), '决策仪表盘区块存在');
  if (d.safety && d.safety.score != null) {
    must(out.includes(d.safety.score + '/50'), '安全边际三问 ' + d.safety.score + '/50（每问 17 分）');
  }
  if (d.health8d && d.health8d.score != null) {
    must(out.includes(d.health8d.score + '/30'), '8 维体检 ' + d.health8d.score + '/30（每维 4 分）');
  }
  if (d.kelly && d.kelly.finalPosition != null) {
    const posPct = (Number(d.kelly.finalPosition) * 100).toFixed(1) + '%';
    must(out.includes(posPct), '凯利建议仓位渲染 ' + posPct);
    must(Number(d.kelly.finalPosition) <= Number(d.kelly.ceiling) + 1e-9,
      '仓位不超策略上限 ' + posPct + ' ≤ ' + (Number(d.kelly.ceiling) * 100).toFixed(0) + '%');
    must(out.includes('内在值锚 PE = 12.5×'), '内在值锚 12.5× 公示');
  }
  if (d.corrections && d.corrections.length) {
    must(out.includes('V6.0.7 结构性修正留痕（' + d.corrections.length + '）'),
      'V6.0.7 修正留痕 ×' + d.corrections.length);
    must(d.corrections.every(c => c.rule && c.note), '每项修正均带 rule + note');
  }

  // V6.0 新增模块（旧内核没有）
  const ids = (d.modules || []).map(m => m.id);
  const v6New = ['industry_scan', 'user_value', 'cognitive_risk', 'hold_test'].filter(x => ids.includes(x));
  must(v6New.length > 0, 'V6.0 新增模块已渲染: ' + v6New.join('/'));

  const titles = (d.modules || []).map(m => (m.title && m.title.zh) || m.id);
  const shown = titles.filter(t => out.includes(t));
  must(shown.length >= 10, '模块标题渲染数 ' + shown.length + '/' + titles.length + '（≥10）');

  // 真实行情
  const mk = d.market || {};
  if (mk.price != null) must(out.includes(Number(mk.price).toFixed(2)), '现价渲染 ' + mk.price);
  if (mk.low52 != null && mk.high52 != null) {
    must(out.includes(mk.low52 + '~' + mk.high52), '52 周区间渲染 ' + mk.low52 + '~' + mk.high52);
  }
  must(out.includes(mk.asOf || '—'), '行情抓取时间公示');

  // 头部价格条 + 红涨绿跌
  const sPrice = els.get('sPrice');
  if (sPrice && mk.price != null) {
    must(sPrice.textContent.startsWith(expect.symbol), '头部币种符号 ' + expect.symbol + ' → ' + sPrice.textContent);
    const chg = mk.changePct || 0;
    const wantDown = chg < 0;
    must(sPrice.style.color === (wantDown ? 'var(--green)' : 'var(--red)'),
      '红涨绿跌着色正确 (chg ' + chg + ' → ' + sPrice.style.color + ')');
    const sChg = els.get('sChg');
    must(!!sChg && sChg.textContent.includes(wantDown ? '▼' : '▲'), '涨跌箭头方向 ' + (sChg ? sChg.textContent : '—'));
  }

  // 数据缺口 / 一致性校验
  must(out.includes('数据缺口'), '数据缺口公示区块存在');
  must(out.includes('穿透不到就标注'), '铁律说明文案存在');
  if (d.dataGaps && d.dataGaps.length) {
    must(out.includes('（' + d.dataGaps.length + '）'), '缺口计数 ' + d.dataGaps.length + ' 项');
  }
  const checks = (d.coherence && d.coherence.checks) || [];
  must(out.includes('一致性校验'), '一致性校验区块存在');
  const okChecks = checks.filter(c => out.includes(c.name)).length;
  must(checks.length === 0 || okChecks === checks.length,
    '一致性校验项 ' + okChecks + '/' + checks.length + ' 全部渲染');

  // 待核验标注
  const unverified = Object.keys(d.pmqd.verified || {}).filter(k => !d.pmqd.verified[k]);
  if (unverified.length) {
    const cnt = (out.match(/待核验/g) || []).length;
    must(cnt >= unverified.length, '未核验维度标注「待核验」×' + cnt + '（需 ≥' + unverified.length + '）');
  }

  console.log('   ℹ️  HTML 长度 ' + out.length + ' 字符 · section ' + (out.match(/class="section"/g) || []).length + ' 个');
}

// ── 执行 ──
console.log('══════ report.html V6.0 渲染冒烟 ══════');
console.log('内联脚本块: ' + blocks.length + ' | 报告目录: ' + REPORTS);

await runCase({
  stockCode: '01114', market: 'hk', name: '华晨中国', file: '01114',
  expect: { symbol: 'HK$' },
});
await runCase({
  stockCode: '000333', market: 'sz', name: '美的集团', file: '000333',
  expect: { symbol: '¥' },
});
await runCase({
  stockCode: '00700', market: 'hk', name: '腾讯控股', file: '00700',
  expect: { symbol: 'HK$' },
});

console.log('\n══════════════════════════════════════');
if (failures === 0) console.log('✅ 全部冒烟通过 — V6.0 渲染器功能正常');
else console.log('❌ 失败 ' + failures + ' 项');
process.exit(failures === 0 ? 0 : 1);
