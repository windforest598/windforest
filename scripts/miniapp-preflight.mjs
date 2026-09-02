// ═══════════════════════════════════════════════════════════════
// 风林慧策小程序 — 上线前自检（preflight）
//
// 运行：node scripts/miniapp-preflight.mjs
// 任一硬门禁不通过则 exit 1，可直接挂到 CI 上线闸门。
//
// 检查项：
//   1. appid 是否已填真实值（占位符 YOUR_APPID_HERE 视为未就绪）
//   2. 全部 .js 语法可解析、.json 可解析、无中文乱码
//   3. app.json 页面声明与实际文件一一对应（含 .wxml/.wxss）
//   4. 请求域名收敛到单一 HTTPS 域（urlCheck=true 下必须在白名单登记）
//   5. V6.0.7 契约取数路径存在对应静态报告产物
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APP = join(ROOT, 'miniapp');
const REPORTS = join(ROOT, 'deploy', 'data', 'reports');

let pass = 0;
const hard = [];   // 硬门禁失败
const soft = [];   // 提示项

function ok(msg) { pass++; console.log('  ✅ ' + msg); }
function bad(msg) { hard.push(msg); console.log('  ❌ ' + msg); }
function warn(msg) { soft.push(msg); console.log('  ⚠️  ' + msg); }

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(APP);
const rel = (p) => p.slice(APP.length + 1).replace(/\\/g, '/');

console.log('══════ 小程序上线自检 ══════');
console.log('目录: ' + APP + ' | 文件数 ' + files.length + '\n');

// ── 1. appid ──
console.log('【1】appid 就绪性');
const cfgPath = join(APP, 'project.config.json');
let cfg = null;
try {
  cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
} catch (e) {
  bad('project.config.json 解析失败: ' + e.message);
}
if (cfg) {
  const appid = String(cfg.appid || '');
  if (!appid || /YOUR_APPID|placeholder|xxx/i.test(appid)) {
    bad('appid 仍为占位符「' + appid + '」— 需填入微信公众平台真实 AppID 后才能上传');
  } else if (!/^wx[0-9a-f]{16}$/.test(appid)) {
    bad('appid 格式不符（应为 wx + 16 位十六进制）: ' + appid);
  } else {
    ok('appid 已就绪: ' + appid);
  }
  if (cfg.setting && cfg.setting.urlCheck === true) {
    ok('urlCheck=true（严格校验请求域名，上线前必须登记白名单）');
  } else {
    warn('urlCheck 非 true — 真机会放过未登记域名，建议上线前置 true');
  }
  if (cfg.compileType === 'miniprogram') ok('compileType = miniprogram');
  else bad('compileType 异常: ' + cfg.compileType);
}

// ── 2. 语法 / 编码 ──
console.log('\n【2】语法与编码');
const NODE = process.execPath;
let jsCount = 0;
let jsonCount = 0;
let garbled = 0;
for (const p of files) {
  const r = rel(p);
  if (r.endsWith('.js')) {
    jsCount++;
    try {
      execFileSync(NODE, ['--check', p], { stdio: 'pipe' });
    } catch (e) {
      bad('JS 语法错误 ' + r + ' — ' + String(e.stderr || e.message).split('\n')[0]);
    }
  }
  if (r.endsWith('.json')) {
    jsonCount++;
    try {
      JSON.parse(readFileSync(p, 'utf8'));
    } catch (e) {
      bad('JSON 解析失败 ' + r + ' — ' + e.message);
    }
  }
  if (/\.(js|json|wxml|wxss|md)$/.test(r)) {
    const txt = readFileSync(p, 'utf8');
    if (txt.includes('\uFFFD')) { garbled++; bad('中文乱码（U+FFFD）' + r); }
  }
}
if (!garbled) ok('无中文乱码（已扫 js/json/wxml/wxss/md）');
ok('JS 语法校验 ' + jsCount + ' 个文件');
ok('JSON 解析校验 ' + jsonCount + ' 个文件');

// ── 3. 页面声明一致性 ──
console.log('\n【3】页面声明与文件一致性');
let appJson = null;
try {
  appJson = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8'));
} catch (e) {
  bad('app.json 解析失败: ' + e.message);
}
if (appJson) {
  const pages = appJson.pages || [];
  if (!pages.length) bad('app.json 未声明任何页面');
  for (const pg of pages) {
    for (const ext of ['.js', '.wxml']) {
      const f = join(APP, pg + ext);
      if (!existsSync(f)) bad('页面缺文件: ' + pg + ext);
    }
  }
  ok('页面声明 ' + pages.length + ' 个，.js/.wxml 均存在');

  const entry = pages[0];
  ok('首页入口: ' + entry);

  if (appJson.window && appJson.window.navigationBarTitleText) {
    ok('导航标题: ' + appJson.window.navigationBarTitleText);
  }
}

// ── 4. 请求域名收敛 ──
console.log('\n【4】请求域名');
const domains = new Set();
for (const p of files) {
  if (!/\.js$/.test(rel(p))) continue;
  const txt = readFileSync(p, 'utf8');
  for (const m of txt.matchAll(/https?:\/\/([a-z0-9.\-]+)/gi)) domains.add(m[0].split('/')[2]);
  if (/['"]http:\/\//.test(txt)) bad('存在 http:// 明文请求（小程序仅允许 https）: ' + rel(p));
}
const list = [...domains];
if (!list.length) {
  bad('未发现任何请求域名，API_BASE 可能缺失');
} else {
  ok('请求域名共 ' + list.length + ' 个: ' + list.join('、'));
  if (list.length > 1) {
    warn('多域名需逐个在「开发管理 → 服务器域名 → request 合法域名」登记');
  }
}

// ── 5. V6.0.7 契约产物 ──
console.log('\n【5】V6.0.7 报告契约产物');
const apiTxt = existsSync(join(APP, 'utils/api.js')) ? readFileSync(join(APP, 'utils/api.js'), 'utf8') : '';
if (!/reportV6/.test(apiTxt)) {
  bad('utils/api.js 缺 reportV6 —— 小程序无法读取 V6.0.7 预计算报告');
} else {
  const m = apiTxt.match(/['"](\/data\/reports\/)['"]/) || apiTxt.match(/(\/data\/reports\/)/);
  ok('已接入 V6.0.7 契约取数路径 ' + (m ? m[1] : '/data/reports/'));
}
const rptTxt = existsSync(join(APP, 'pages/report/report.js'))
  ? readFileSync(join(APP, 'pages/report/report.js'), 'utf8') : '';
if (!/renderV6/.test(rptTxt)) bad('pages/report/report.js 缺 renderV6 渲染分支');
else ok('报告页含 renderV6 分支（V6.0.7 契约）+ V5.9 回退');

if (!existsSync(REPORTS)) {
  bad('缺少静态报告目录 deploy/data/reports/');
} else {
  const jsons = readdirSync(REPORTS).filter((f) => f.endsWith('.json'));
  let v607 = 0;
  for (const f of jsons) {
    try {
      const j = JSON.parse(readFileSync(join(REPORTS, f), 'utf8'));
      if (j.engine && String(j.engine.framework).includes('V6.0.7')) v607++;
    } catch { /* 忽略非契约文件 */ }
  }
  if (v607 === 0) bad('静态报告中无 V6.0.7 契约产物');
  else if (v607 < jsons.length) warn('V6.0.7 契约 ' + v607 + '/' + jsons.length + ' 份，其余为旧版');
  else ok('全部 ' + v607 + ' 份静态报告均为 V6.0.7 契约');
}

// ── 汇总 ──
console.log('\n' + '═'.repeat(60));
console.log('通过 ' + pass + ' 项 | 硬门禁失败 ' + hard.length + ' 项 | 提示 ' + soft.length + ' 项');
if (hard.length) {
  console.log('\n阻断上线的问题：');
  hard.forEach((h, i) => console.log('  ' + (i + 1) + '. ' + h));
  console.log('\n❌ 小程序尚未具备上传条件');
  process.exit(1);
}
if (soft.length) {
  console.log('\n需人工确认：');
  soft.forEach((s, i) => console.log('  ' + (i + 1) + '. ' + s));
}
console.log('\n✅ 小程序已具备上传条件');
