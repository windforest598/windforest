#!/usr/bin/env node
// Generate comprehensive STOCK_DB from CSI 300 + HK + US data
const fs = require('fs');

// Current existing stocks (from index.html STOCK_DB)
const existing = new Set();

// Sector classification by stock name keywords
function classifySector(name, code, market) {
  name = name || '';
  // 银行
  if (/银行/.test(name)) return '银行';
  // 券商/证券
  if (/证券|券商/.test(name) || code === 'sz300059') return '券商';
  // 保险
  if (/保险|平安$/.test(name) && code !== 'sz000001') return '保险';
  // 白酒
  if (/酒$|酒业/.test(name) || /茅台|五粮液|汾酒|泸州老窖|洋河|古井/.test(name)) return '白酒';
  // 食品饮料/乳业/调味品
  if (/乳业|伊利|蒙牛|海天|调味|食品|饮料|双汇|金龙鱼|东鹏/.test(name)) return '消费';
  // 家电
  if (/家电|海尔|美的|格力|苏泊尔/.test(name)) return '家电';
  // 汽车/新能源车
  if (/汽车|比亚迪|赛力斯|长城|长安|上汽|广汽|宇通|拓普/.test(name)) return '汽车';
  // 电池/新能源
  if (/电池|宁德|亿纬|国轩|天赐|阳光电源|隆基|通威|晶澳|晶科|大全|德业|阿特斯/.test(name)) return '新能源';
  // 光伏 (same as 新能源 but more specific)
  if (/光伏/.test(name)) return '新能源';
  // 医药
  if (/医药|恒瑞|迈瑞|药明|同仁堂|片仔癀|白药|智飞|长春高新|爱尔|复星|万泰|华润|科伦|华东/.test(name)) return '医药';
  // 器械/医疗
  if (/医疗|器械|爱美客|新产业|联影/.test(name)) return '医药';
  // 半导体/芯片
  if (/芯片|半导体|中芯|北方华创|兆易|中微|华虹|寒武纪|海光|澜起|韦尔|豪威|华大九天|龙芯/.test(name)) return '芯片';
  // 科技/软件
  if (/软件|金山|用友|恒生|科技|立讯|蓝思|京东方|中兴|中科曙光|浪潮/.test(name)) return '科技';
  // AI/通信
  if (/AI|科大讯飞|昆仑万维|同花顺/.test(name)) return 'AI';
  // 电信
  if (/中国移动|中国电信|中国联通/.test(name)) return '电信';
  // 能源/石油/煤炭
  if (/石油|石化|神华|煤炭|中煤能源|陕西煤业|中国海油|中国铀业/.test(name)) return '能源';
  // 公用事业/电力
  if (/电力|水电|核电|三峡|国电|华能|华电|浙能|川投|国投|中国广核/.test(name)) return '公用事业';
  // 矿业/有色
  if (/矿业|紫金|江西铜业|铜陵有色|云铝|南山铝业|厦门钨业|洛阳钼业|北方稀土/.test(name)) return '有色';
  // 钢铁/建材
  if (/钢铁|宝钢|建材|海螺水泥|中国巨石/.test(name)) return '建材';
  // 工程机械
  if (/三一|中联|徐工|潍柴/.test(name)) return '机械';
  // 地产
  if (/地产|万科|保利|招商蛇口/.test(name)) return '地产';
  // 军工
  if (/军工|沈飞|西飞|航发|中国船舶|中船|中国重工|中航机载/.test(name)) return '军工';
  // 交通/物流
  if (/航空|铁路|高速|港口|大秦|顺丰|圆通|中远/.test(name)) return '物流';
  // 建筑
  if (/建筑|中铁|铁建|中交|中国能建|中国电建|中国化学/.test(name)) return '基建';
  // 化工
  if (/万华|华鲁|恒力|荣盛|卫星|巨化/.test(name)) return '化工';
  // 农牧
  if (/牧原|温氏|海大|养殖/.test(name)) return '农牧';
  // 免税/消费
  if (/中国中免/.test(name)) return '消费';
  // ETF
  if (/ETF/.test(name)) return 'ETF';
  // 券商（剩下的）
  if (/中信建投|中金公司|广发证券|国信证券|申万宏源|浙江证券|中国银河|中信证券|华泰证券|东方财富/.test(name)) return '券商';
  // 能源
  if (/黄金/.test(name)) return '有色';
  // 物流
  if (/中国国航|南方航空|春秋/.test(name)) return '物流';
  // 半导体
  if (/闻泰/.test(name)) return '科技';
  if (/三安/.test(name)) return '芯片';
  if (/中国动力/.test(name)) return '军工';
  return '其他';
}

// Read CSI 300 data
const csi300 = fs.readFileSync('C:/Users/work/WorkBuddy/2026-06-10-15-02-17/tmp_csi300.txt', 'utf-8');
const csiLines = csi300.split('\n');

// Parse CSI 300 stocks
const csiStocks = [];
const seen = new Set();

csiLines.forEach(line => {
  const m = line.match(/^\| (sh\d{6}|sz\d{6}|bj\d{6}) \| (.+) \|$/);
  if (m) {
    const code = m[1];
    const name = m[2].trim();
    const market = code.startsWith('sh') ? 'sh' : code.startsWith('sz') ? 'sz' : 'bj';
    const stockKey = code + '|ashare';
    if (!seen.has(stockKey)) {
      seen.add(stockKey);
      csiStocks.push({ code, name, market });
    }
  }
});

console.log(`Parsed ${csiStocks.length} CSI 300 stocks`);

// Define priority stocks to include (removing less important ones to keep DB manageable)
// We'll include ~150-180 A-shares

// First, include current existing stocks (they're well curated)
const existingAStocks = `sh600036,sh601398,sh601288,sh601939,sh601328,sz000001,sh601166,sh600016,sh600030,sh601688,sz300059,sh601318,sh601628,sh601601,sh600519,sz000858,sz000568,sz002304,sh600809,sz000596,sh600887,sz002714,sh600690,sz000651,sz000333,sz002032,sz300750,sz002594,sh601012,sh600438,sz002459,sh688223,sh601899,sh600585,sz000002,sh600276,sz300760,sz000538,sh600436,sz300015,sh603259,sz300122,sz000661,sh688981,sz002371,sh603986,sh688012,sz002415,sz002236,sz000725,sz002475,sz300433,sh688111,sh601857,sh600028,sh601088,sh600900,sh600905,sh600886,sz003816,sh600941,sh601728,sh600050,sz002230,sz300033,sz300124,sz002050,sh600760,sh600893,sz000768,sh601989,sh600150,sh510300,sh510050,sh510500,sz159915,sh588000`.split(',');

const existingHKStocks = `hk00700,hk09988,hk09999,hk03690,hk09618,hk01810,hk09888,hk02015,hk09866,hk09868,hk01211,hk02269,hk02382,hk02020,hk02331,hk09626,hk09660,hk01347,hk00981,hk00175,hk00388,hk00005,hk01299,hk01398,hk03988,hk00883,hk00941,hk00728,hk02057,hk09901,hk02628,hk02318,hk01024,hk01833,hk06098,hk06060,hk01928,hk00027,hk02828,hk02800`.split(',');

const existingUSStocks = `AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA,BRK.B,JPM,V,JNJ,WMT,PG,XOM,UNH,COST,HD,AVGO,CRM,AMD,NFLX,DIS,BAC,KO,PEP,ADBE,QCOM,TXN,ASML,BABA,JD,PDD,BIDU,NIO,XPEV,LI,TME,BILI,NTES,ZTO,BEKE,YUMC,DIDIY,FUTU,SPY,QQQ,IWM,GLD,VOO`.split(',');

// Build new A-share stock list
// Priority 1: keep all existing stocks
// Priority 2: add CSI 300 stocks that are important and not already included

const codeToName = {};
csiStocks.forEach(s => { codeToName[s.code] = s.name; });

// Additional important A-shares not in existing list (from CSI 300)
const additionalAShares = [
  // 银行 - expand
  { code: 'sh601009', name: '南京银行', market: 'sh' },
  { code: 'sh601169', name: '北京银行', market: 'sh' },
  { code: 'sh601229', name: '上海银行', market: 'sh' },
  { code: 'sh601838', name: '成都银行', market: 'sh' },
  { code: 'sh601818', name: '光大银行', market: 'sh' },
  { code: 'sh601658', name: '邮储银行', market: 'sh' },
  { code: 'sh601916', name: '浙商银行', market: 'sh' },
  { code: 'sh600000', name: '浦发银行', market: 'sh' },
  { code: 'sh600015', name: '华夏银行', market: 'sh' },
  { code: 'sh601988', name: '中国银行', market: 'sh' },
  // 券商 - expand
  { code: 'sh601878', name: '浙商证券', market: 'sh' },
  { code: 'sh601881', name: '中国银河', market: 'sh' },
  { code: 'sh601066', name: '中信建投', market: 'sh' },
  { code: 'sh601995', name: '中金公司', market: 'sh' },
  { code: 'sz000776', name: '广发证券', market: 'sz' },
  { code: 'sz002736', name: '国信证券', market: 'sz' },
  { code: 'sz000166', name: '申万宏源', market: 'sz' },
  // 保险 - expand
  { code: 'sh601336', name: '新华保险', market: 'sh' },
  // 消费 - expand
  { code: 'sh603288', name: '海天味业', market: 'sh' },
  { code: 'sh605499', name: '东鹏饮料', market: 'sh' },
  { code: 'sz000895', name: '双汇发展', market: 'sz' },
  { code: 'sz300999', name: '金龙鱼', market: 'sz' },
  { code: 'sh600600', name: '青岛啤酒', market: 'sh' },
  // 新能源 - expand
  { code: 'sz300274', name: '阳光电源', market: 'sz' },
  { code: 'sz300014', name: '亿纬锂能', market: 'sz' },
  { code: 'sz002074', name: '国轩高科', market: 'sz' },
  { code: 'sz002709', name: '天赐材料', market: 'sz' },
  { code: 'sh605117', name: '德业股份', market: 'sh' },
  { code: 'sz002460', name: '赣锋锂业', market: 'sz' },
  { code: 'sz002466', name: '天齐锂业', market: 'sz' },
  { code: 'sh688303', name: '大全能源', market: 'sh' },
  { code: 'sh688472', name: '阿特斯', market: 'sh' },
  // 汽车 - expand
  { code: 'sh601127', name: '赛力斯', market: 'sh' },
  { code: 'sh601633', name: '长城汽车', market: 'sh' },
  { code: 'sz000625', name: '长安汽车', market: 'sz' },
  { code: 'sh600104', name: '上汽集团', market: 'sh' },
  { code: 'sh600066', name: '宇通客车', market: 'sh' },
  { code: 'sh601689', name: '拓普集团', market: 'sh' },
  // 医药 - expand
  { code: 'sh600085', name: '同仁堂', market: 'sh' },
  { code: 'sh603392', name: '万泰生物', market: 'sh' },
  { code: 'sz000963', name: '华东医药', market: 'sz' },
  { code: 'sz002422', name: '科伦药业', market: 'sz' },
  { code: 'sz000999', name: '华润三九', market: 'sz' },
  { code: 'sh688271', name: '联影医疗', market: 'sh' },
  // 芯片 - expand
  { code: 'sh688041', name: '海光信息', market: 'sh' },
  { code: 'sh688008', name: '澜起科技', market: 'sh' },
  { code: 'sz301269', name: '华大九天', market: 'sz' },
  { code: 'sh688047', name: '龙芯中科', market: 'sh' },
  { code: 'sh603501', name: '豪威集团', market: 'sh' },
  { code: 'sh688126', name: '沪硅产业', market: 'sh' },
  // 科技 - expand
  { code: 'sz000063', name: '中兴通讯', market: 'sz' },
  { code: 'sh603019', name: '中科曙光', market: 'sh' },
  { code: 'sz000977', name: '浪潮信息', market: 'sz' },
  { code: 'sh600570', name: '恒生电子', market: 'sh' },
  { code: 'sh688036', name: '传音控股', market: 'sh' },
  // 能源 - expand
  { code: 'sh600938', name: '中国海油', market: 'sh' },
  { code: 'sh601225', name: '陕西煤业', market: 'sh' },
  { code: 'sh601898', name: '中煤能源', market: 'sh' },
  { code: 'sh601001', name: '中国铀业', market: 'sh' },
  // 公用事业 - expand
  { code: 'sh601985', name: '中国核电', market: 'sh' },
  { code: 'sh600011', name: '华能国际', market: 'sh' },
  { code: 'sh600027', name: '华电国际', market: 'sh' },
  { code: 'sh600023', name: '浙能电力', market: 'sh' },
  { code: 'sh600674', name: '川投能源', market: 'sh' },
  { code: 'sh600795', name: '国电电力', market: 'sh' },
  { code: 'sh600025', name: '华能水电', market: 'sh' },
  // 有色 - expand
  { code: 'sh600362', name: '江西铜业', market: 'sh' },
  { code: 'sz000630', name: '铜陵有色', market: 'sz' },
  { code: 'sz000807', name: '云铝股份', market: 'sz' },
  { code: 'sh600219', name: '南山铝业', market: 'sh' },
  { code: 'sh600549', name: '厦门钨业', market: 'sh' },
  { code: 'sh603993', name: '洛阳钼业', market: 'sh' },
  { code: 'sh600111', name: '北方稀土', market: 'sh' },
  // 建材/化工 - expand
  { code: 'sh600309', name: '万华化学', market: 'sh' },
  { code: 'sh600426', name: '华鲁恒升', market: 'sh' },
  { code: 'sh600346', name: '恒力石化', market: 'sh' },
  { code: 'sz002493', name: '荣盛石化', market: 'sz' },
  { code: 'sz002648', name: '卫星化学', market: 'sz' },
  { code: 'sh600160', name: '巨化股份', market: 'sh' },
  { code: 'sh600019', name: '宝钢股份', market: 'sh' },
  { code: 'sh600176', name: '中国巨石', market: 'sh' },
  // 机械/基建
  { code: 'sh600031', name: '三一重工', market: 'sh' },
  { code: 'sz000157', name: '中联重科', market: 'sz' },
  { code: 'sz000425', name: '徐工机械', market: 'sz' },
  { code: 'sz000338', name: '潍柴动力', market: 'sz' },
  { code: 'sh601668', name: '中国建筑', market: 'sh' },
  { code: 'sh601390', name: '中国中铁', market: 'sh' },
  { code: 'sh601186', name: '中国铁建', market: 'sh' },
  { code: 'sh601800', name: '中国交建', market: 'sh' },
  { code: 'sh601868', name: '中国能建', market: 'sh' },
  { code: 'sh601669', name: '中国电建', market: 'sh' },
  { code: 'sh601117', name: '中国化学', market: 'sh' },
  // 军工 - expand
  { code: 'sh600372', name: '中航机载', market: 'sh' },
  { code: 'sh600482', name: '中国动力', market: 'sh' },
  { code: 'sz002179', name: '中航光电', market: 'sz' },
  // 物流/交通 - expand
  { code: 'sz002352', name: '顺丰控股', market: 'sz' },
  { code: 'sh601006', name: '大秦铁路', market: 'sh' },
  { code: 'sh601816', name: '京沪高铁', market: 'sh' },
  { code: 'sh601919', name: '中远海控', market: 'sh' },
  { code: 'sh600233', name: '圆通速递', market: 'sh' },
  { code: 'sh601111', name: '中国国航', market: 'sh' },
  { code: 'sh600029', name: '南方航空', market: 'sh' },
  // 地产 - expand
  { code: 'sz001979', name: '招商蛇口', market: 'sz' },
  { code: 'sh600048', name: '保利发展', market: 'sh' },
  // 农牧 - expand
  { code: 'sz300498', name: '温氏股份', market: 'sz' },
  // 免税/消费
  { code: 'sh601888', name: '中国中免', market: 'sh' },
  // 科技/AI
  { code: 'sz300418', name: '昆仑万维', market: 'sz' },
  { code: 'sz000938', name: '紫光股份', market: 'sz' },
  { code: 'sz002027', name: '分众传媒', market: 'sz' },
  // 化工
  { code: 'sz000792', name: '盐湖股份', market: 'sz' },
  // 黄金
  { code: 'sh600547', name: '山东黄金', market: 'sh' },
  { code: 'sh600489', name: '中金黄金', market: 'sh' },
  // 医疗
  { code: 'sz300896', name: '爱美客', market: 'sz' },
  { code: 'sz300832', name: '新产业', market: 'sz' },
  // 芯片扩展
  { code: 'sz002049', name: '紫光国微', market: 'sz' },
  { code: 'sz002916', name: '深南电路', market: 'sz' },
  { code: 'sz300661', name: '圣邦股份', market: 'sz' },
  // 安防
  { code: 'sz300408', name: '三环集团', market: 'sz' },
  // 消费电子
  { code: 'sz002241', name: '歌尔股份', market: 'sz' },
  { code: 'sz002600', name: '领益智造', market: 'sz' },
  // 汽车电子
  { code: 'sz002920', name: '德赛西威', market: 'sz' },
  // 互联网
  { code: 'sz300251', name: '光线传媒', market: 'sz' },
  { code: 'sz300803', name: '指南针', market: 'sz' },
  
  // Special name overrides (not in CSI 300 name lookup)
  { code: 'sz003816', name: '中国广核', market: 'sz' },
  { code: 'sh510300', name: '沪深300ETF', market: 'sh' },
  { code: 'sh510050', name: '上证50ETF', market: 'sh' },
  { code: 'sh510500', name: '中证500ETF', market: 'sh' },
  { code: 'sz159915', name: '创业板ETF', market: 'sz' },
  { code: 'sh588000', name: '科创50ETF', market: 'sh' },
  { code: 'sz002032', name: '苏泊尔', market: 'sz' },
  { code: 'sh600016', name: '民生银行', market: 'sh' },
  { code: 'sh601166', name: '兴业银行', market: 'sh' },
  { code: 'sh601288', name: '农业银行', market: 'sh' },
  { code: 'sh601328', name: '交通银行', market: 'sh' },
  { code: 'sh601398', name: '工商银行', market: 'sh' },
  { code: 'sh601628', name: '中国人寿', market: 'sh' },
  { code: 'sh601601', name: '中国太保', market: 'sh' },
  { code: 'sh601688', name: '华泰证券', market: 'sh' },
  { code: 'sh601899', name: '紫金矿业', market: 'sh' },
  { code: 'sh601989', name: '中国重工', market: 'sh' },
  { code: 'sh600436', name: '片仔癀', market: 'sh' },
  { code: 'sh600438', name: '通威股份', market: 'sh' },
  { code: 'sh688223', name: '晶科能源', market: 'sh' },
  { code: 'sh688981', name: '中芯国际', market: 'sh' },
  { code: 'sh603986', name: '兆易创新', market: 'sh' },
  { code: 'sh688012', name: '中微公司', market: 'sh' },
  { code: 'sz300124', name: '汇川技术', market: 'sz' },
  { code: 'sz300750', name: '宁德时代', market: 'sz' },
  { code: 'sz002594', name: '比亚迪', market: 'sz' },
  { code: 'sz300059', name: '东方财富', market: 'sz' },
  { code: 'sz002230', name: '科大讯飞', market: 'sz' },
  { code: 'sz002415', name: '海康威视', market: 'sz' },
  { code: 'sz002236', name: '大华股份', market: 'sz' },
  { code: 'sz002050', name: '三花智控', market: 'sz' },
  { code: 'sz300760', name: '迈瑞医疗', market: 'sz' },
  { code: 'sz300122', name: '智飞生物', market: 'sz' },
  { code: 'sz000661', name: '长春高新', market: 'sz' },
  { code: 'sz300015', name: '爱尔眼科', market: 'sz' },
  { code: 'sz002459', name: '晶澳科技', market: 'sz' },
  { code: 'sz000538', name: '云南白药', market: 'sz' },
  { code: 'sh603259', name: '药明康德', market: 'sh' },
  { code: 'sh600276', name: '恒瑞医药', market: 'sh' },
  { code: 'sz002371', name: '北方华创', market: 'sz' },
  { code: 'sz300033', name: '同花顺', market: 'sz' },
  // Additional important stocks NOT in CSI 300
  // 港股通热门
  { code: 'sh600196', name: '复星医药', market: 'sh' },
  { code: 'sh600703', name: '三安光电', market: 'sh' },
  { code: 'sh600745', name: '闻泰科技', market: 'sh' },
  { code: 'sh600584', name: '长电科技', market: 'sh' },
  { code: 'sz002185', name: '华天科技', market: 'sz' },
  { code: 'sz002156', name: '通富微电', market: 'sz' },
  { code: 'sz002463', name: '沪电股份', market: 'sz' },
  { code: 'sz300502', name: '新易盛', market: 'sz' },
  { code: 'sz300308', name: '中际旭创', market: 'sz' },
  { code: 'sz300394', name: '天孚通信', market: 'sz' },
];

// Additional HK stocks (beyond existing 40)
const additionalHKStocks = [
  // 科技/互联网
  { code: 'hk00780', n: '同程旅行', p: 'Tongcheng' },
  { code: 'hk09698', n: '万国数据-SW', p: 'GDS' },
  { code: 'hk06690', n: '海尔智家', p: 'Haier' },
  { code: 'hk01057', n: '浙江沪杭甬' },
  // 消费
  { code: 'hk06862', n: '海底捞', p: 'Haidilao' },
  { code: 'hk09633', n: '农夫山泉', p: 'Nongfu' },
  { code: 'hk06186', n: '中国飞鹤' },
  { code: 'hk02018', n: '瑞声科技' },
  { code: 'hk00288', n: '万洲国际', p: 'WHGroup' },
  { code: 'hk02319', n: '蒙牛乳业', p: 'Mengniu' },
  { code: 'hk00168', n: '青岛啤酒', p: 'Tsingtao' },
  // 医药
  { code: 'hk06185', n: '康龙化成' },
  { code: 'hk01093', n: '石药集团' },
  { code: 'hk01177', n: '中国生物制药' },
  { code: 'hk00020', n: '商汤-W', p: 'SenseTime' },
  // 汽车
  { code: 'hk09863', n: '零跑汽车' },
  { code: 'hk09810', n: '极氪' },
  // 金融
  { code: 'hk02601', n: '中国太保' },
  { code: 'hk01658', n: '邮储银行' },
  { code: 'hk03968', n: '招商银行', p: 'CMB' },
  { code: 'hk00998', n: '中信银行' },
  { code: 'hk06886', n: 'HTSC' },
  { code: 'hk06030', n: '中信证券' },
  // 地产/物业
  { code: 'hk00016', n: '新鸿基地产', p: 'SHKProps' },
  { code: 'hk00001', n: '长和', p: 'CKHutchison' },
  { code: 'hk00002', n: '中电控股', p: 'CLP' },
  { code: 'hk00003', n: '香港中华煤气' },
  { code: 'hk00006', n: '电能实业' },
  { code: 'hk00011', n: '恒生银行', p: 'HangSengBank' },
  { code: 'hk00066', n: '港铁公司', p: 'MTR' },
  { code: 'hk0823', n: '领展房产基金', p: 'LinkREIT' },
  { code: 'hk01209', n: '华润万象生活' },
  // 消费品牌
  { code: 'hk02333', n: '长城汽车', p: 'GreatWall' },
  { code: 'hk02238', n: '广汽集团' },
  { code: 'hk00753', n: '中国国航' },
  { code: 'hk01109', n: '华润置地' },
  { code: 'hk00669', n: '创科实业', p: 'TTI' },
  // 半导体
  { code: 'hk00522', n: 'ASMPT' },
];

// Additional US stocks
const additionalUSStocks = [
  { code: 'INTC', n: 'Intel', s: '芯片', p: '英特尔' },
  { code: 'ORCL', n: 'Oracle', s: '软件', p: '甲骨文' },
  { code: 'CSCO', n: 'Cisco', s: '科技', p: '思科' },
  { code: 'IBM', n: 'IBM', s: '科技' },
  { code: 'SAP', n: 'SAP SE', s: '软件' },
  { code: 'NOW', n: 'ServiceNow', s: '软件' },
  { code: 'UBER', n: 'Uber', s: '出行' },
  { code: 'ABNB', n: 'Airbnb', s: '出行' },
  { code: 'SQ', n: 'Block (Square)', s: '支付' },
  { code: 'PYPL', n: 'PayPal', s: '支付' },
  { code: 'SNAP', n: 'Snap Inc.', s: '社交' },
  { code: 'PLTR', n: 'Palantir', s: '软件' },
  { code: 'MU', n: 'Micron', s: '芯片', p: '美光' },
  { code: 'ARM', n: 'Arm Holdings', s: '芯片' },
  { code: 'TSM', n: 'TSMC (ADR)', s: '芯片', p: '台积电' },
  { code: 'MRK', n: 'Merck & Co.', s: '医药', p: '默克' },
  { code: 'PFE', n: 'Pfizer', s: '医药', p: '辉瑞' },
  { code: 'ABBV', n: 'AbbVie', s: '医药' },
  { code: 'LLY', n: 'Eli Lilly', s: '医药', p: '礼来' },
  { code: 'NKE', n: 'Nike', s: '消费品', p: '耐克' },
  { code: 'SBUX', n: 'Starbucks', s: '消费', p: '星巴克' },
  { code: 'MCD', n: 'McDonald\'s', s: '餐饮', p: '麦当劳' },
  { code: 'BA', n: 'Boeing', s: '航天', p: '波音' },
  { code: 'GE', n: 'GE Aerospace', s: '工业' },
  { code: 'CAT', n: 'Caterpillar', s: '机械' },
  { code: 'CMG', n: 'Chipotle', s: '餐饮' },
];

// Build output
function generateOutput() {
  let output = 'var STOCK_DB = [\n';
  output += '  // === A-SHARE (沪深) ===\n';
  
  // A-shares first
  const aCodeSet = new Set(existingAStocks);
  const allAStocks = [];
  
  // Process all A-shares
  const processedACodes = new Set();
  
  // First pass: existing stocks
  existingAStocks.forEach(code => {
    const name = codeToName[code] || code;
    const market = code.substring(0, 2);
    const sector = classifySector(name, code, 'ashare');
    allAStocks.push({ code, name, market, sector });
    processedACodes.add(code);
  });
  
  // Second pass: additional stocks
  additionalAShares.forEach(s => {
    if (!processedACodes.has(s.code)) {
      const sector = classifySector(s.name || codeToName[s.code], s.code, 'ashare');
      allAStocks.push({ code: s.code, name: s.name || codeToName[s.code], market: s.market || s.code.substring(0,2), sector });
      processedACodes.add(s.code);
    }
  });
  
  // Sort by sector then by code
  allAStocks.sort((a, b) => {
    if (a.sector !== b.sector) return a.sector.localeCompare(b.sector);
    return a.code.localeCompare(b.code);
  });
  
  // Generate output organized by sector
  let currentSector = '';
  allAStocks.forEach(s => {
    if (s.sector !== currentSector) {
      output += `  // ${s.sector}\n`;
      currentSector = s.sector;
    }
    // Check if stock name has a common English pinyin abbreviation
    output += `  {c:"${s.code}",n:"${s.name}",m:"${s.market}",mk:"ashare",s:"${s.sector}"},\n`;
  });
  
  // HK stocks
  output += '\n  // === HK SHARES ===\n';
  existingHKStocks.forEach(code => {
    // We'll keep the existing names
    const cleanCode = code.replace('hk', '');
    const hkNameMap = {
      'hk00700': '腾讯控股', 'hk09988': '阿里巴巴-SW', 'hk09999': '网易-S',
      'hk03690': '美团-W', 'hk09618': '京东集团-SW', 'hk01810': '小米集团-W',
      'hk09888': '百度集团-SW', 'hk02015': '理想汽车-W', 'hk09866': '蔚来-SW',
      'hk09868': '小鹏汽车-W', 'hk01211': '比亚迪股份', 'hk02269': '药明生物',
      'hk02382': '舜宇光学科技', 'hk02020': '安踏体育', 'hk02331': '李宁',
      'hk09626': '哔哩哔哩-W', 'hk09660': '地平线机器人-W', 'hk01347': '华虹半导体',
      'hk00981': '中芯国际', 'hk00175': '吉利汽车', 'hk00388': '香港交易所',
      'hk00005': '汇丰控股', 'hk01299': '友邦保险', 'hk01398': '工商银行',
      'hk03988': '中国银行', 'hk00883': '中国海洋石油', 'hk00941': '中国移动',
      'hk00728': '中国电信', 'hk02057': '中通快递-W', 'hk09901': '新东方-S',
      'hk02628': '中国人寿', 'hk02318': '中国平安', 'hk01024': '快手-W',
      'hk01833': '平安好医生', 'hk06098': '碧桂园服务', 'hk06060': '众安在线',
      'hk01928': '金沙中国', 'hk00027': '银河娱乐',
      'hk02828': '恒生中国企业ETF', 'hk02800': '盈富基金',
    };
    const name = hkNameMap[code] || code;
    const clean = code.replace('hk', '');
    output += `  {c:"${clean}",n:"${name}",m:"hk",mk:"hkshare"},\n`;
  });
  
  // Add additional HK stocks
  additionalHKStocks.forEach(s => {
    const cleanCode = s.code.replace('hk', '');
    // Check if already added
    if (!existingHKStocks.includes(s.code)) {
      let extra = `  {c:"${cleanCode}",n:"${s.n}",m:"hk",mk:"hkshare"`;
      if (s.p) extra += `,p:"${s.p}"`;
      extra += '},\n';
      output += extra;
    }
  });
  
  // US stocks
  output += '\n  // === US SHARES ===\n';
  const usNameMap = {
    'AAPL': 'Apple Inc.', 'MSFT': 'Microsoft', 'GOOGL': 'Alphabet (Google)',
    'AMZN': 'Amazon', 'NVDA': 'NVIDIA', 'META': 'Meta Platforms',
    'TSLA': 'Tesla', 'BRK.B': 'Berkshire Hathaway', 'JPM': 'JPMorgan Chase',
    'V': 'Visa', 'JNJ': 'Johnson & Johnson', 'WMT': 'Walmart',
    'PG': 'Procter & Gamble', 'XOM': 'Exxon Mobil', 'UNH': 'UnitedHealth',
    'COST': 'Costco', 'HD': 'Home Depot', 'AVGO': 'Broadcom',
    'CRM': 'Salesforce', 'AMD': 'AMD', 'NFLX': 'Netflix',
    'DIS': 'Walt Disney', 'BAC': 'Bank of America', 'KO': 'Coca-Cola',
    'PEP': 'PepsiCo', 'ADBE': 'Adobe', 'QCOM': 'Qualcomm',
    'TXN': 'Texas Instruments', 'ASML': 'ASML Holding',
    'BABA': 'Alibaba Group', 'JD': 'JD.com', 'PDD': 'PDD Holdings',
    'BIDU': 'Baidu', 'NIO': 'NIO Inc.', 'XPEV': 'XPeng Inc.',
    'LI': 'Li Auto', 'TME': 'Tencent Music', 'BILI': 'Bilibili',
    'NTES': 'NetEase', 'ZTO': 'ZTO Express', 'BEKE': 'KE Holdings',
    'YUMC': 'Yum China', 'DIDIY': 'DiDi Global', 'FUTU': 'Futu Holdings',
    'SPY': 'SPDR S&P 500 ETF', 'QQQ': 'Invesco QQQ Trust',
    'IWM': 'iShares Russell 2000', 'GLD': 'SPDR Gold Trust',
    'VOO': 'Vanguard S&P 500'
  };
  
  const us_pinyin = {
    'AAPL': '苹果', 'MSFT': '微软', 'GOOGL': '谷歌', 'AMZN': '亚马逊',
    'NVDA': '英伟达', 'META': '脸书', 'TSLA': '特斯拉',
    'BRK.B': '伯克希尔', 'JPM': '摩根大通', 'JNJ': '强生',
    'WMT': '沃尔玛', 'PG': '宝洁', 'XOM': '埃克森美孚', 'COST': '好市多',
    'HD': '家得宝', 'NFLX': '奈飞', 'DIS': '迪士尼', 'BAC': '美国银行',
    'KO': '可口可乐', 'PEP': '百事', 'QCOM': '高通', 'ASML': '阿斯麦',
    'BABA': '阿里巴巴', 'JD': '京东', 'PDD': '拼多多', 'BIDU': '百度',
    'NIO': '蔚来', 'XPEV': '小鹏', 'LI': '理想', 'TME': '腾讯音乐',
    'BILI': '哔哩哔哩', 'NTES': '网易', 'ZTO': '中通快递', 'BEKE': '贝壳',
    'YUMC': '百胜中国', 'DIDIY': '滴滴', 'FUTU': '富途'
  };
  
  const usSectors = {
    'AAPL': '科技', 'MSFT': '科技', 'GOOGL': '科技', 'AMZN': '电商',
    'NVDA': '芯片', 'META': '社交', 'TSLA': '汽车', 'BRK.B': '投资',
    'JPM': '银行', 'V': '支付', 'JNJ': '医药', 'WMT': '零售',
    'PG': '消费品', 'XOM': '能源', 'UNH': '医疗', 'COST': '零售',
    'HD': '零售', 'AVGO': '芯片', 'CRM': '软件', 'AMD': '芯片',
    'NFLX': '流媒体', 'DIS': '娱乐', 'BAC': '银行', 'KO': '饮料',
    'PEP': '饮料', 'ADBE': '软件', 'QCOM': '芯片', 'TXN': '芯片',
    'ASML': '设备', 'BABA': '电商', 'JD': '电商', 'PDD': '电商',
    'BIDU': '搜索', 'NIO': '汽车', 'XPEV': '汽车', 'LI': '汽车',
    'TME': '音乐', 'BILI': '视频', 'NTES': '游戏', 'ZTO': '物流',
    'BEKE': '房产', 'YUMC': '餐饮', 'DIDIY': '出行', 'FUTU': '券商',
    'SPY': 'ETF', 'QQQ': 'ETF', 'IWM': 'ETF', 'GLD': '黄金', 'VOO': 'ETF'
  };
  
  existingUSStocks.forEach(code => {
    const name = usNameMap[code] || code;
    const pinyin = us_pinyin[code] || '';
    const sector = usSectors[code] || '科技';
    let extra = `  {c:"${code}",n:"${name}",m:"us",mk:"usshare",s:"${sector}"`;
    if (pinyin) extra += `,p:"${pinyin}"`;
    extra += '},\n';
    output += extra;
  });
  
  additionalUSStocks.forEach(s => {
    const pinyin = us_pinyin[s.code] || s.p || '';
    let extra = `  {c:"${s.code}",n:"${s.n}",m:"us",mk:"usshare",s:"${s.sector}"`;
    if (pinyin) extra += `,p:"${pinyin}"`;
    extra += '},\n';
    output += extra;
  });
  
  output += '];\n';
  return output;
}

const result = generateOutput();
fs.writeFileSync('C:/Users/work/WorkBuddy/2026-06-10-15-02-17/tmp_stock_db_output.txt', result);
console.log('Generated stock DB');
console.log(`Line count: ${result.split('\n').length}`);

// Count stocks
const stockCount = (result.match(/{c:"/g) || []).length;
console.log(`Total stocks: ${stockCount}`);
