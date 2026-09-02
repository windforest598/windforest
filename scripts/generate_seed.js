#!/usr/bin/env node
// Generate comprehensive D1 seed.sql from lgt data + existing stocks
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/work/WorkBuddy/2026-06-10-15-02-17';
const OUT = BASE + '/fullstack/src/db/seed.sql';

// Parse all lgt data files
function parseLgtFiles() {
  const stocks = [];
  const seen = new Set();
  
  // Read sh files
  for (let i = 0; i <= 15; i++) {
    const f = `${BASE}/tmp_lgt_sh_${i}.txt`;
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, 'utf-8');
    const lines = content.split('\n');
    lines.forEach(line => {
      const m = line.match(/^\| (sh\d{6}|sz\d{6}|bj\d{6}) \| (.+) \|$/);
      if (m) {
        const full = m[1];
        const code = full.replace(/^(sh|sz|bj)/, '');
        const name = m[2].trim();
        const market = full.substring(0, 2);
        // Check for duplicates
        const key = full + '|ashare';
        if (!seen.has(key)) {
          seen.add(key);
          stocks.push({ full, code, name, market, type: 'ashare', sector: classify(name, full) });
        }
      }
    });
  }
  
  // Read sz files  
  for (let i = 0; i <= 17; i++) {
    const f = `${BASE}/tmp_lgt_sz_${i}.txt`;
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, 'utf-8');
    const lines = content.split('\n');
    lines.forEach(line => {
      const m = line.match(/^\| (sh\d{6}|sz\d{6}|bj\d{6}) \| (.+) \|$/);
      if (m) {
        const full = m[1];
        const code = full.replace(/^(sh|sz|bj)/, '');
        const name = m[2].trim();
        const market = full.substring(0, 2);
        const key = full + '|ashare';
        if (!seen.has(key)) {
          seen.add(key);
          stocks.push({ full, code, name, market, type: 'ashare', sector: classify(name, full) });
        }
      }
    });
  }
  
  return stocks;
}

// Simple sector classifier
function classify(name, code) {
  if (/银行/.test(name)) return '银行';
  if (/证券|券商/.test(name) || code === 'sz300059') return '券商';
  if (/保险/.test(name)) return '保险';
  if (/酒$|酒业/.test(name) || /茅台|五粮液|汾酒|泸州/.test(name)) return '白酒';
  if (/乳业|伊利|海天|食品|双汇|金龙鱼/.test(name)) return '食品';
  if (/家电|海尔|美的|格力/.test(name)) return '家电';
  if (/汽车|长安|长城|比亚迪|赛力斯/.test(name)) return '汽车';
  if (/电池|宁德|亿纬|国轩|天赐|阳光电源/.test(name)) return '新能源';
  if (/光伏|隆基|通威|晶澳|晶科/.test(name)) return '光伏';
  if (/医药|恒瑞|迈瑞|药明|同仁堂|片仔癀|白药|智飞/.test(name)) return '医药';
  if (/医疗|爱尔|爱美客|联影/.test(name)) return '医疗';
  if (/芯片|半导体|中芯|中微|寒武纪|海光|澜起/.test(name)) return '半导体';
  if (/科技|立讯|京东方|蓝思|中兴|浪潮/.test(name)) return '科技';
  if (/软件|金山|用友|恒生/.test(name)) return '软件';
  if (/AI|科大讯飞|昆仑万维/.test(name)) return 'AI';
  if (/电信|移动|联通/.test(name)) return '电信';
  if (/石油|石化|神华|煤炭|海油/.test(name)) return '能源';
  if (/电力|水电|核电|三峡|华能|华电|国电/.test(name)) return '电力';
  if (/矿业|紫金|江西铜业|铜陵|云铝|洛阳钼业/.test(name)) return '有色';
  if (/钢铁|宝钢|海螺水泥/.test(name)) return '建材';
  if (/三一|中联|徐工/.test(name)) return '机械';
  if (/地产|万科|保利|招商蛇口/.test(name)) return '地产';
  if (/军工|沈飞|西飞|航发|船舶/.test(name)) return '军工';
  if (/航空|铁路|顺丰|圆通|中远/.test(name)) return '物流';
  if (/建筑|中铁|铁建|中交|能建/.test(name)) return '基建';
  if (/化工|万华|华鲁|恒力|荣盛|卫星/.test(name)) return '化工';
  if (/牧原|温氏/.test(name)) return '农牧';
  if (/金$|黄金/.test(name)) return '有色';
  return '其他';
}

// Generate pinyin (simplified - use common abbreviations known)
function getPinyin(name, code) {
  const known = {
    '招商银行': 'CMB', '工商银行': 'ICBC', '农业银行': 'ABC',
    '建设银行': 'CCB', '中国银行': 'BOC', '交通银行': 'BoCom',
    '兴业银行': 'CIB', '平安银行': 'PAB', '浦发银行': 'SPDB',
    '中信银行': 'CITIC', '邮储银行': 'PSBC', '光大银行': 'CEB',
    '中国平安': 'Ping An', '中国人寿': 'China Life',
    '中信证券': 'CITIC Sec', '华泰证券': 'HTSC',
    '贵州茅台': 'Kweichow Moutai', '五粮液': 'Wuliangye',
    '美的集团': 'Midea', '格力电器': 'Gree', '海尔智家': 'Haier',
    '宁德时代': 'CATL', '比亚迪': 'BYD',
    '腾讯控股': 'Tencent', '阿里巴巴': 'Alibaba',
    // Generic generation for others
  };
  if (known[name]) return known[name];
  // Return first 4 chars of name as simple pinyin indicator
  return name.substring(0, 4);
}

// Main
console.log('Parsing lgt data files...');
const aStocks = parseLgtFiles();
console.log(`Parsed ${aStocks.length} A-share stocks`);

// Read existing seed to get HK/US stocks
const existingSeed = fs.readFileSync(OUT, 'utf-8');

// Extract non-A-share lines from existing seed
const lines = existingSeed.split('\n');
let hkLines = '';
let usLines = '';
let inA = false;
let inHK = false;
let inUS = false;
lines.forEach(l => {
  if (l.includes('-- A股')) { inA = true; inHK = false; inUS = false; }
  else if (l.includes('-- 港股')) { inA = false; inHK = true; inUS = false; }
  else if (l.includes('-- 美股') || l.includes('-- US')) { inA = false; inHK = false; inUS = true; }
  else if (l.includes('CREATE') || l.includes('INSERT') || l.trim() === '' || l.includes('--')) { /* skip header */ }
  
  if (inHK && l.includes('INSERT')) hkLines += l + '\n';
  if (inUS && l.includes('INSERT')) usLines += l + '\n';
});

// Generate output
let output = `-- ═══════════════════════════════════════════════
-- 风林慧策 — 种子数据 (${aStocks.length}只A股 + 港股 + 美股)
-- 自动生成，来源：westock-data 沪股通/深股通成份股 (${new Date().toISOString().split('T')[0]})
-- ═══════════════════════════════════════════════

-- START TRANSACTION
`;

// A-shares in batches of 100
output += `\n-- ═══ A股 — 沪深两市 (共${aStocks.length}只) ═══\n`;
let batchCount = 0;
for (let i = 0; i < aStocks.length; i += 100) {
  const batch = aStocks.slice(i, i + 100);
  output += `INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin) VALUES\n`;
  const values = batch.map(s => {
    const pinyin = getPinyin(s.name, s.full).replace(/'/g, "''");
    const sector = s.sector.replace(/'/g, "''");
    return `('${s.code}', '${s.full}', '${s.market}', 'ashare', '${s.name.replace(/'/g, "''")}', '${sector}', '${pinyin}')`;
  });
  output += values.join(',\n') + ';\n';
  batchCount++;
}

// Add HK stocks from existing seed
output += `\n-- ═══ 港股 ═══\n`;
output += hkLines;

// Add US stocks from existing seed
output += `\n-- ═══ 美股 ═══\n`;
output += usLines;

// Add additional HK stocks (new ones not in original seed)
output += `\n-- ═══ 港股 — 补充 ═══\n`;
const extraHK = [
  ['00780', 'hk00780', 'hk', '同程旅行', '互联网', 'Tongcheng'],
  ['09698', 'hk09698', 'hk', '万国数据-SW', '互联网', 'GDS'],
  ['06862', 'hk06862', 'hk', '海底捞', '餐饮', 'Haidilao'],
  ['09633', 'hk09633', 'hk', '农夫山泉', '食品', 'Nongfu'],
  ['02319', 'hk02319', 'hk', '蒙牛乳业', '食品', 'Mengniu'],
  ['00020', 'hk00020', 'hk', '商汤-W', 'AI', 'SenseTime'],
  ['00001', 'hk00001', 'hk', '长和', '综合', 'CK Hutchison'],
  ['00016', 'hk00016', 'hk', '新鸿基地产', '地产', 'SHK Properties'],
  ['00066', 'hk00066', 'hk', '港铁公司', '交通', 'MTR'],
  ['0823', 'hk00823', 'hk', '领展房产基金', 'REIT', 'Link REIT'],
  ['00288', 'hk00288', 'hk', '万洲国际', '食品', 'WH Group'],
  ['06186', 'hk06186', 'hk', '中国飞鹤', '食品', 'Feihe'],
  ['01093', 'hk01093', 'hk', '石药集团', '医药', 'CSPC'],
  ['01177', 'hk01177', 'hk', '中国生物制药', '医药', 'Sino Biopharm'],
  ['00522', 'hk00522', 'hk', 'ASMPT', '半导体', 'ASMPT'],
  ['00669', 'hk00669', 'hk', '创科实业', '制造', 'TTI'],
  ['01209', 'hk01209', 'hk', '华润万象生活', '物业', 'CR Mixc Lifestyle'],
  ['00011', 'hk00011', 'hk', '恒生银行', '银行', 'Hang Seng Bank'],
  ['00002', 'hk00002', 'hk', '中电控股', '电力', 'CLP'],
  ['00003', 'hk00003', 'hk', '香港中华煤气', '公用', 'Towngas'],
  ['00006', 'hk00006', 'hk', '电能实业', '电力', 'Power Assets'],
  ['01658', 'hk01658', 'hk', '邮储银行', '银行', 'PSBC'],
  ['03968', 'hk03968', 'hk', '招商银行', '银行', 'CMB'],
  ['06030', 'hk06030', 'hk', '中信证券', '券商', 'CITIC Sec'],
  ['06886', 'hk06886', 'hk', 'HTSC', '券商', 'HTSC'],
  ['01211', 'hk01211', 'hk', '比亚迪股份', '汽车', 'BYD'],
  ['00175', 'hk00175', 'hk', '吉利汽车', '汽车', 'Geely'],
  ['02333', 'hk02333', 'hk', '长城汽车', '汽车', 'Great Wall'],
  ['09863', 'hk09863', 'hk', '零跑汽车', '汽车', 'Leapmotor'],
  ['09810', 'hk09810', 'hk', '极氪', '汽车', 'Zeekr'],
  ['02018', 'hk02018', 'hk', '瑞声科技', '电子', 'AAC Tech'],
  ['00753', 'hk00753', 'hk', '中国国航', '航空', 'Air China'],
  ['01109', 'hk01109', 'hk', '华润置地', '地产', 'CR Land'],
  ['00168', 'hk00168', 'hk', '青岛啤酒', '食品', 'Tsingtao'],
  ['02238', 'hk02238', 'hk', '广汽集团', '汽车', 'GAC'],
];
if (extraHK.length > 0) {
  const vals = extraHK.map(s => 
    `('${s[0]}', '${s[1]}', '${s[2]}', 'hkshare', '${s[3]}', '${s[4]}', '${s[5]}')`
  );
  output += `INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin) VALUES\n${vals.join(',\n')};\n`;
}

// Additional US stocks
output += `\n-- ═══ 美股 — 补充 ═══\n`;
const extraUS = [
  ['INTC', 'usINTC', 'us', 'Intel', '半导体', 'Intel'],
  ['ORCL', 'usORCL', 'us', 'Oracle', '软件', 'Oracle'],
  ['CSCO', 'usCSCO', 'us', 'Cisco', '科技', 'Cisco'],
  ['IBM', 'usIBM', 'us', 'IBM', '科技', 'IBM'],
  ['SAP', 'usSAP', 'us', 'SAP SE', '软件', 'SAP'],
  ['NOW', 'usNOW', 'us', 'ServiceNow', '软件', 'ServiceNow'],
  ['UBER', 'usUBER', 'us', 'Uber', '出行', 'Uber'],
  ['ABNB', 'usABNB', 'us', 'Airbnb', '出行', 'Airbnb'],
  ['MU', 'usMU', 'us', 'Micron', '半导体', 'Micron'],
  ['ARM', 'usARM', 'us', 'Arm Holdings', '半导体', 'ARM'],
  ['TSM', 'usTSM', 'us', 'TSMC (ADR)', '半导体', 'TSMC'],
  ['MRK', 'usMRK', 'us', 'Merck & Co.', '医药', 'Merck'],
  ['PFE', 'usPFE', 'us', 'Pfizer', '医药', 'Pfizer'],
  ['LLY', 'usLLY', 'us', 'Eli Lilly', '医药', 'Lilly'],
  ['NKE', 'usNKE', 'us', 'Nike', '消费', 'Nike'],
  ['SBUX', 'usSBUX', 'us', 'Starbucks', '消费', 'Starbucks'],
  ['MCD', 'usMCD', 'us', 'McDonald\'s', '餐饮', 'McDonald\'s'],
  ['BA', 'usBA', 'us', 'Boeing', '航天', 'Boeing'],
];
if (extraUS.length > 0) {
  const vals = extraUS.map(s => 
    `('${s[0]}', '${s[1]}', '${s[2]}', 'usshare', '${s[3]}', '${s[4]}', '${s[5]}')`
  );
  output += `INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin) VALUES\n${vals.join(',\n')};\n`;
}

fs.writeFileSync(OUT, output);
console.log(`Written to ${OUT}`);
console.log(`Total INSERT lines: ${(output.match(/INSERT/g) || []).length}`);
