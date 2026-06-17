// ═══════════════════════════════════════════════
// 风林慧策 — 市场交易时间检测
// ═══════════════════════════════════════════════

export interface MarketStatus {
  market: string;
  name: string;
  isOpen: boolean;
  nextEvent: string;
  nextEventTime: string;
  displayClass: string;
}

/**
 * Check if a market is currently open
 * Uses China Standard Time (UTC+8) for A-share
 * Uses local time for US (need to check US timezone)
 */
export function getMarketStatus(marketType: string): MarketStatus {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;

  // Beijing time offset (UTC+8)
  const bjHours = (now.getUTCHours() + 8) % 24;
  const bjMinutes = now.getUTCMinutes();

  if (marketType === 'ashare') {
    // A-share: 9:30-11:30, 13:00-15:00 Beijing time
    const morningSession = bjHours === 9 && bjMinutes >= 30 || bjHours === 10 || bjHours === 11 && bjMinutes <= 30;
    const afternoonSession = bjHours >= 13 && bjHours < 15;

    const isOpen = !isWeekend && (morningSession || afternoonSession);

    let nextEvent: string;
    let nextEventTime: string;
    if (isWeekend) {
      nextEvent = '周一开盘';
      nextEventTime = '09:30';
    } else if (bjHours < 9 || (bjHours === 9 && bjMinutes < 30)) {
      nextEvent = '今日开盘';
      nextEventTime = '09:30';
    } else if (bjHours === 11 && bjMinutes > 30 || bjHours === 12) {
      nextEvent = '午盘开盘';
      nextEventTime = '13:00';
    } else if (bjHours >= 15) {
      nextEvent = '已收盘';
      nextEventTime = '次日09:30';
    } else {
      nextEvent = '';
      nextEventTime = '';
    }

    return {
      market: 'ashare',
      name: '沪深A股',
      isOpen,
      nextEvent,
      nextEventTime,
      displayClass: isOpen ? 'open' : (bjHours >= 15 ? 'closed' : 'pre-market'),
    };
  }

  if (marketType === 'hkshare') {
    // HK: 9:30-12:00, 13:00-16:00 (same timezone)
    const morningSession = (bjHours === 9 && bjMinutes >= 30) || bjHours === 10 || bjHours === 11;
    const afternoonSession = bjHours >= 13 && bjHours < 16;

    const isOpen = !isWeekend && (morningSession || afternoonSession);

    return {
      market: 'hkshare',
      name: '港股',
      isOpen,
      nextEvent: isOpen ? '' : (bjHours < 9 ? '09:30开盘' : '已收盘'),
      nextEventTime: '',
      displayClass: isOpen ? 'open' : 'closed',
    };
  }

  // US market (Eastern Time, UTC-5, rough check)
  const etHours = (now.getUTCHours() - 5 + 24) % 24;
  const etMinutes = now.getUTCMinutes();
  const usSession = (etHours === 9 && etMinutes >= 30) || (etHours >= 10 && etHours < 16);
  const isUSOpen = !isWeekend && usSession;

  return {
    market: 'usshare',
    name: '美股',
    isOpen: isUSOpen,
    nextEvent: isUSOpen ? '' : '美东09:30开盘',
    nextEventTime: '',
    displayClass: isUSOpen ? 'open' : 'closed',
  };
}
