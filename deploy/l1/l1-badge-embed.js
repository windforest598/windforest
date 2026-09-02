// report.html 集成：报告渲染完成后，追加"数据来源透明度 · L1 认证"面板。
// 完全解耦、异常安全——任何失败都不影响原报告。
import { mountL1Panel } from './l1-ui.js';

(function () {
  try {
    const params = new URLSearchParams(location.search);
    const code = params.get('code') || '000333';
    const marketParam = (params.get('market') || 'sz').toLowerCase();
    const name = params.get('name') || code;
    const market = marketParam === 'hk' ? 'HK' : marketParam === 'us' ? 'US' : 'A';

    const main = document.getElementById('mainContent');
    if (!main) return;

    let done = false;
    function mount() {
      if (done) return;
      if (document.getElementById('loadingState') || !main.querySelector('.section')) return;
      done = true;
      try {
        const section = document.createElement('section');
        section.className = 'section';
        section.id = 'l1Transparency';
        section.innerHTML =
          '<div class="section-title">数据来源透明度 · L1 官方信源认证</div>' +
          '<div id="l1Mount"></div>';
        main.appendChild(section);
        mountL1Panel(document.getElementById('l1Mount'), {
          code, market, name,
          apiBase: (typeof window !== 'undefined' && window.WFL1Config && window.WFL1Config.apiBase) || '',
          interactive: false,
        });
      } catch (e) { /* 不影响报告 */ }
    }

    const mo = new MutationObserver(mount);
    mo.observe(main, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); mount(); }, 4000);
  } catch (e) { /* 绝不影响报告 */ }
})();
