// L1 数据透明度 UI — 把 L1 取数层渲染成 Stripe 风面板，复用于 report.html / dashboard / 演示页。
// 支持 interactive 模式：一键通过 fetchL1({apiBase}) 回填真实 L1 财报数据。
import { L1_SOURCE_REGISTRY, certifySources, classifyMarket, buildFetchPlan, fetchL1 } from './l1-fetcher.js';
import { buildReportList } from './report-acquisition.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 数值格式化：大数折算为「亿」，百分比保留两位小数。
function fmt(v, isPct) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return esc(v);
  if (isPct) return n.toFixed(2) + '%';
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + ' 亿';
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(2) + ' 万';
  return n.toFixed(2);
}

// 取数结果里优先展示的核心字段（与 l1Data 契约对齐）
const KEY_METRICS = [
  ['marketCap', '总市值', false],
  ['price', '现价', false],
  ['netCash', '净现金', false],
  ['dividendYield', '股息率(TTM)', true],
  ['revenue', '营业收入', false],
  ['netProfit', '净利润', false],
  ['netAssets', '净资产', false],
  ['totalLiabilities', '总负债', false],
  ['operatingCashFlow', '经营现金流', false],
  ['grossMargin', '毛利率', true],
  ['roe', 'ROE', true],
  ['debtRatio', '资产负债率', true],
];

// 组装视图数据（不取数，仅信源/计划/预期认证 + 多年度报告清单）
export function buildL1View(opts = {}) {
  const code = opts.code || '000333';
  const name = opts.name || code;
  const market = opts.market && L1_SOURCE_REGISTRY[opts.market] ? opts.market : classifyMarket(code);
  const reg = L1_SOURCE_REGISTRY[market];
  const reportTypes = opts.reportTypes && opts.reportTypes.length ? opts.reportTypes : ['annual'];
  const plan = buildFetchPlan({ stock: code, name, market, reportTypes });
  const expectedCert = certifySources(reg.officialSources.map((s) => s.name));
  const reportList = buildReportList({ stock: code, name, market, historyYears: opts.historyYears || 5 });
  return { code, name, market, reg, reportTypes, plan, expectedCert, reportList };
}

function badge(label, value, kind) {
  const color = { ok: 'var(--green)', gold: 'var(--gold)', info: 'var(--navy)', warn: 'var(--red)' }[kind] || 'var(--navy)';
  return `<span class="l1-badge" style="border-color:${color};color:${color}">${esc(label)}·${esc(value)}</span>`;
}

export function renderL1HTML(view) {
  const { code, name, market, reg, plan, expectedCert, reportList } = view;
  const badges =
    badge('市场', reg.label, 'info') +
    badge('L1认证', expectedCert.determinism, expectedCert.allL1 ? 'gold' : 'warn') +
    badge('取数通道', reg.structuredAdapter.toUpperCase(), 'info');

  const sources = reg.officialSources.map((s) =>
    `<a class="l1-src" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>`
  ).join('');

  const steps = plan.map((p) => `<li class="l1-step">${esc(p)}</li>`).join('');

  const reportItems = (reportList && reportList.reports || []).map((r) =>
    `<li class="l1-step"><b>${esc(r.label)}</b> · ${esc(r.officialSource)} — ${esc(r.purpose)}</li>`
  ).join('');
  const reportNote = reportList && reportList.note ? `<div class="l1-note" style="border:none;padding:0;">${esc(reportList.note)}</div>` : '';

  return `
    <div class="l1-badges">${badges}</div>
    <div class="l1-block">
      <div class="l1-block-title">官方信源（L1）</div>
      <div class="l1-srcs">${sources}</div>
    </div>
    <div class="l1-block">
      <div class="l1-block-title">官方报告清单（最近 ${reportList ? reportList.nYears : 5} 年年报 + 最新季报/半年报）</div>
      <ol class="l1-plan">${reportItems}</ol>
      ${reportNote}
    </div>
    <div class="l1-block">
      <div class="l1-block-title">取数路径（${esc(name)} · ${esc(code)}）</div>
      <ol class="l1-plan">${steps}</ol>
    </div>
    <div class="l1-note">${esc(expectedCert.note)}。实际取数经 tdx-connector / Workers API 回灌分析引擎；穿透类科目（净现金/有息负债等）须回原始报告附注核实，绝不伪造数字。</div>
  `;
}

// 渲染一次真实取数结果（fetchL1 返回值）
export function renderL1Result(result) {
  if (!result) return '';
  if (!result.ok) {
    const planHtml = (result.fetchPlan || []).map((p) => `<li class="l1-step">${esc(p)}</li>`).join('');
    return `
      <div class="l1-result l1-result-warn">
        <div class="l1-result-head">⚠ 未回填真实 L1：${esc(result.status || 'unknown')}</div>
        <div class="l1-note" style="border:none;padding:0;">${esc(result.error || '连接器未连接或未配置后端 apiBase。')}</div>
        ${planHtml ? `<div class="l1-block-title" style="margin-top:10px;">已标注取数路径</div><ol class="l1-plan">${planHtml}</ol>` : ''}
      </div>`;
  }
  const cert = result.certification || certifySources(result.sources || []);
  const certBadge = badge('确定性', cert.determinism, cert.allL1 ? 'gold' : 'warn');
  const rows = KEY_METRICS
    .map(([k, label, isPct]) => {
      const v = result.l1Data ? result.l1Data[k] : undefined;
      return `<tr><td>${esc(label)}</td><td>${fmt(v, isPct)}</td></tr>`;
    })
    .join('');
  const extra = result.l1Data && result.l1Data.reportDate
    ? `<div class="l1-note" style="border:none;padding:0 0 8px;">报告期：${esc(result.l1Data.reportDate)}${result.l1Data.currency ? ' · 币种 ' + esc(result.l1Data.currency) : ''}</div>`
    : '';
  const srcs = (result.sources || []).map((s) => esc(typeof s === 'string' ? s : s.name)).join('、');
  return `
    <div class="l1-result l1-result-ok">
      <div class="l1-badges">${certBadge}</div>
      <div class="l1-block-title">回填 L1 财报核心字段</div>
      ${extra}
      <table class="l1-data"><tbody>${rows}</tbody></table>
      <div class="l1-note" style="border:none;padding:8px 0 0;">来源：${srcs}</div>
      <div class="l1-note" style="border:none;padding:0;">${esc(cert.note)}</div>
    </div>`;
}

// 把面板挂载到指定容器。
// opts: { code, market?, name?, reportTypes?, apiBase?, fetcher?, interactive? }
//   - interactive 默认 true：渲染「回填真实 L1」按钮，点击经 fetchL1({apiBase}) 取数并显示结果。
//   - report.html 集成时传入 interactive:false（仅展示透明度面板）。
export function mountL1Panel(container, opts = {}) {
  if (!container) return;
  try {
    const view = buildL1View(opts);
    const interactive = opts.interactive !== false;
    const apiBase = opts.apiBase
      || (typeof window !== 'undefined' && window.WFL1Config && window.WFL1Config.apiBase) || '';

    let html = renderL1HTML(view);
    if (interactive) {
      html += `
        <div class="l1-actions">
          <button class="l1-btn" id="l1RefillBtn">回填真实 L1 财报</button>
          <span class="l1-apibase-note">${apiBase ? '后端：' + esc(apiBase) : '未配置 apiBase（离线计划模式）'}</span>
        </div>
        <div id="l1Result" class="l1-result-box"></div>`;
    }
    container.innerHTML = html;

    if (interactive) {
      const btn = container.querySelector('#l1RefillBtn');
      const box = container.querySelector('#l1Result');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '取数中…';
        box.innerHTML = '<div class="l1-note" style="border:none;padding:0;">正在调用后端 /api/l1 回灌真实 L1 数据…</div>';
        try {
          const spec = {
            stock: view.code, name: view.name, market: view.market,
            reportTypes: view.reportTypes, adapter: view.reg.structuredAdapter,
          };
          const result = await fetchL1(spec, { apiBase, fetcher: opts.fetcher });
          box.innerHTML = renderL1Result(result);
          if (typeof opts.onFetched === 'function') opts.onFetched(result);
        } catch (e) {
          box.innerHTML = `<div class="l1-note" style="border:none;padding:0;">取数异常：${esc(e.message || e)}</div>`;
        } finally {
          btn.disabled = false;
          btn.textContent = '重新回填真实 L1 财报';
        }
      });
    }
  } catch (e) {
    container.innerHTML = '<div class="l1-note">L1 透明度面板加载失败（不影响报告）。</div>';
  }
}

window.WFL1 = { mountL1Panel, buildL1View, renderL1HTML, renderL1Result };
