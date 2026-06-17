// ═══════════════════════════════════════════════
// 风林慧策 — 订阅邮件发送脚本
// 运行环境: GitHub Actions
// 检查需要发送的订阅通知并通过 MailChannels 发送
// ═══════════════════════════════════════════════

import { query, queryOne, execute } from './d1-helper';
import { sendEmail, buildPMQDAlertEmail } from '../src/services/mailchannels';

async function sendAlerts() {
  console.log('📧 风林慧策 — 订阅邮件发送\n');

  const subsResult = query(
    `SELECT s.id, s.email, s.stock_id, s.frequency_daily, s.frequency_weekly, s.frequency_alert,
            st.name as stock_name, st.code as stock_code, st.market
     FROM subscriptions s
     JOIN stocks st ON s.stock_id = st.id
     WHERE s.active = 1`
  );

  if (subsResult.length === 0) {
    console.log('📭 没有活跃的订阅');
    return;
  }

  console.log(`📋 找到 ${subsResult.length} 个活跃订阅\n`);

  let sentCount = 0;
  let errorCount = 0;

  for (const sub of subsResult) {
    const email = sub.email as string;
    const stockId = sub.stock_id as number;
    const stockName = sub.stock_name as string;
    const stockCode = sub.stock_code as string;
    const isDaily = sub.frequency_daily as number;
    const isWeekly = sub.frequency_weekly as number;
    const isAlert = sub.frequency_alert as number;

    try {
      const analysis = queryOne(
        `SELECT * FROM analysis_cache WHERE stock_id = ?`,
        [stockId]
      );

      if (!analysis) {
        console.log(`  ⏭️  ${stockName}: 无分析数据，跳过`);
        continue;
      }

      const mkt = queryOne(
        `SELECT price, change_pct, pe_ttm FROM market_data WHERE stock_id = ?`,
        [stockId]
      );

      if (!mkt) {
        console.log(`  ⏭️  ${stockName}: 无行情数据，跳过`);
        continue;
      }

      const changePct = Math.abs(mkt.change_pct as number);
      const peTtm = mkt.pe_ttm as number;

      const shouldAlert =
        (isAlert && changePct >= 5) ||
        (isAlert && (peTtm <= 10 || peTtm >= 30)) ||
        isDaily;

      if (!shouldAlert) {
        console.log(`  ⏭️  ${stockName}: 无触发条件`);
        continue;
      }

      const htmlContent = buildPMQDAlertEmail(
        stockName,
        stockCode,
        {
          pmqdTotal: analysis.pmqd_total as number,
          pmqdStars: analysis.pmqd_stars as string,
          pmqdVerdict: analysis.pmqd_verdict as string,
          kellyF: analysis.kelly_f as number,
          price: mkt.price as number,
          changePct: mkt.change_pct as number,
          pe: peTtm,
        }
      );

      const subject = `[风林慧策] ${stockName}(${stockCode}) PMQD分析更新 - 评分${analysis.pmqd_total}/${analysis.pmqd_stars}`;

      const isWeekday = [1, 2, 3, 4, 5].includes(new Date().getDay());
      if (isWeekly && !isDaily && !isWeekday) {
        console.log(`  ⏭️  ${stockName}: 周报模式，非工作日跳过`);
        continue;
      }

      const success = await sendEmail({
        to: email,
        subject,
        htmlContent,
      });

      if (success) {
        execute(
          `UPDATE subscriptions SET last_sent_at = datetime('now') WHERE id = ?`,
          [sub.id]
        );

        execute(
          `INSERT INTO refresh_log (stock_id, action, status) VALUES (?, 'alert', 'success')`,
          [stockId]
        );

        console.log(`  ✅ ${email} → ${stockName}(${stockCode})`);
        sentCount++;
      } else {
        console.log(`  ❌ ${email} → 发送失败`);
        errorCount++;
      }

      await sleep(1000);
    } catch (err: any) {
      console.error(`  ❌ ${email}: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 邮件发送完成: 成功 ${sentCount} 封, 失败 ${errorCount} 封`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

sendAlerts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
