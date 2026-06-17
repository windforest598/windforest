// ═══════════════════════════════════════════════
// 风林慧策 — MailChannels 邮件发送服务
// Cloudflare Workers 免费集成，1000封/天
// ═══════════════════════════════════════════════

interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

/**
 * Send email via MailChannels (free with Cloudflare Workers)
 * Requires the domain to have SPF record for mailchannels.net
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const fromAddr = (typeof (globalThis as any).MAILCHANNELS_FROM !== 'undefined' ? (globalThis as any).MAILCHANNELS_FROM : null)
      || 'noreply@windforest.pages.dev';

    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: options.to }],
        }],
        from: {
          email: fromAddr,
          name: '风林慧策 AI',
        },
        subject: options.subject,
        content: [{
          type: 'text/html',
          value: options.htmlContent,
        }],
      }),
    });

    if (response.ok) {
      console.log(`Email sent to ${options.to}: ${options.subject}`);
      return true;
    }

    // MailChannels returns 202 on success, not 200
    if (response.status === 202) {
      return true;
    }

    const body = await response.text();
    console.error(`MailChannels error (${response.status}): ${body}`);
    return false;
  } catch (err) {
    console.error('MailChannels send error:', err);
    return false;
  }
}

/**
 * Build HTML email for PMQD analysis alert
 */
export function buildPMQDAlertEmail(
  stockName: string,
  stockCode: string,
  analysis: {
    pmqdTotal: number;
    pmqdStars: string;
    pmqdVerdict: string;
    kellyF: number;
    price: number;
    changePct: number;
    pe: number;
  }
): string {
  const changeColor = analysis.changePct >= 0 ? '#C0392B' : '#2D7A3E';
  const changeSign = analysis.changePct >= 0 ? '+' : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #F8F9FA; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #0D2137, #152D4A); padding: 28px 24px; text-align: center;">
      <h1 style="color: #D4A43A; margin: 0; font-size: 20px; letter-spacing: 2px;">风林慧策 · PMQD 分析更新</h1>
    </div>
    <div style="padding: 24px;">
      <h2 style="color: #0D2137; margin: 0 0 16px; font-size: 18px;">${stockName} (${stockCode})</h2>
      <div style="background: #F8F9FA; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #5F6368; font-size: 14px;">最新价格</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; font-size: 16px; color: #0D2137;">¥${analysis.price.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #5F6368; font-size: 14px;">涨跌幅</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; font-size: 16px; color: ${changeColor};">${changeSign}${analysis.changePct.toFixed(2)}%</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #5F6368; font-size: 14px;">PE(TTM)</td>
            <td style="padding: 6px 0; text-align: right; font-size: 14px; color: #202124;">${analysis.pe.toFixed(2)}x</td>
          </tr>
        </table>
      </div>
      <div style="background: #FFF8E7; border-left: 3px solid #D4A43A; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #5F6368;">PMQD 综合评分</p>
        <p style="margin: 0; font-size: 28px; font-weight: 800; color: #0D2137;">${analysis.pmqdTotal} <span style="font-size: 14px; font-weight: 400;">/ 100</span> ${analysis.pmqdStars}</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #5F6368;">${analysis.pmqdVerdict} · 凯利仓位: ${(analysis.kellyF * 100).toFixed(0)}%</p>
      </div>
      <a href="https://windforest.pages.dev/report.html?code=${stockCode}" style="display: block; text-align: center; background: #D4A43A; color: white; text-decoration: none; padding: 12px; border-radius: 8px; font-weight: 700; letter-spacing: 1px;">查看完整分析报告 →</a>
      <p style="margin: 16px 0 0; font-size: 11px; color: #9AA0A6; text-align: center;">
        此邮件由风林慧策 AI 自动生成。如需取消订阅，<a href="https://windforest.pages.dev/dashboard.html?code=${stockCode}" style="color: #D4A43A;">点击这里</a>。
      </p>
    </div>
  </div>
</body>
</html>`;
}
