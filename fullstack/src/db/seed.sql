-- ═══════════════════════════════════════════════
-- 风林慧策 — 种子数据 (178只股票)
-- 提取自 index.html STOCK_DB 数组
-- 用于 Cloudflare D1 数据库
-- ═══════════════════════════════════════════════

-- A股 — 沪深主板（上海）
INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin, is_tracked) VALUES
('600519', 'sh600519', 'sh', 'ashare', '贵州茅台', '白酒', 'Kweichow Moutai', 1),
('600036', 'sh600036', 'sh', 'ashare', '招商银行', '银行', 'CMB', 1),
('601318', 'sh601318', 'sh', 'ashare', '中国平安', '保险', 'Ping An', 1),
('600276', 'sh600276', 'sh', 'ashare', '恒瑞医药', '医药', 'Hengrui', 1),
('600900', 'sh600900', 'sh', 'ashare', '长江电力', '电力', 'Yangtze Power', 1),
('600809', 'sh600809', 'sh', 'ashare', '山西汾酒', '白酒', 'Fenjiu', 0),
('600887', 'sh600887', 'sh', 'ashare', '伊利股份', '食品', 'Yili', 1),
('600030', 'sh600030', 'sh', 'ashare', '中信证券', '券商', 'CITIC', 1),
('600031', 'sh600031', 'sh', 'ashare', '三一重工', '机械', 'SANY', 1),
('600585', 'sh600585', 'sh', 'ashare', '海螺水泥', '建材', 'Conch', 0),
('601012', 'sh601012', 'sh', 'ashare', '隆基绿能', '光伏', 'LONGi', 1),
('600436', 'sh600436', 'sh', 'ashare', '片仔癀', '医药', 'PZH', 1),
('600309', 'sh600309', 'sh', 'ashare', '万华化学', '化工', 'Wanhua', 1),
('601899', 'sh601899', 'sh', 'ashare', '紫金矿业', '矿业', 'Zijin', 1),
('601166', 'sh601166', 'sh', 'ashare', '兴业银行', '银行', 'CIB', 1),
('600690', 'sh600690', 'sh', 'ashare', '海尔智家', '家电', 'Haier', 1),
('600406', 'sh600406', 'sh', 'ashare', '国电南瑞', '电力设备', 'NARI', 0),
('603259', 'sh603259', 'sh', 'ashare', '药明康德', '医药', 'WuXi', 1),
('600048', 'sh600048', 'sh', 'ashare', '保利发展', '地产', 'Poly', 0),
('601088', 'sh601088', 'sh', 'ashare', '中国神华', '煤炭', 'Shenhua', 1),
('601857', 'sh601857', 'sh', 'ashare', '中国石油', '石油', 'PetroChina', 1),
('601398', 'sh601398', 'sh', 'ashare', '工商银行', '银行', 'ICBC', 1),
('601939', 'sh601939', 'sh', 'ashare', '建设银行', '银行', 'CCB', 0),
('601288', 'sh601288', 'sh', 'ashare', '农业银行', '银行', 'ABC', 0),
('601328', 'sh601328', 'sh', 'ashare', '交通银行', '银行', 'BoCom', 0);

-- A股 — 深圳主板
INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin, is_tracked) VALUES
('000333', 'sz000333', 'sz', 'ashare', '美的集团', '家电', 'Midea', 1),
('000858', 'sz000858', 'sz', 'ashare', '五粮液', '白酒', 'Wuliangye', 1),
('000568', 'sz000568', 'sz', 'ashare', '泸州老窖', '白酒', 'Luzhou Laojiao', 0),
('002415', 'sz002415', 'sz', 'ashare', '海康威视', '安防', 'Hikvision', 1),
('000002', 'sz000002', 'sz', 'ashare', '万科A', '地产', 'Vanke', 0),
('002594', 'sz002594', 'sz', 'ashare', '比亚迪', '新能源车', 'BYD', 1),
('300750', 'sz300750', 'sz', 'ashare', '宁德时代', '电池', 'CATL', 1),
('300059', 'sz300059', 'sz', 'ashare', '东方财富', '互联网金融', 'East Money', 1),
('000651', 'sz000651', 'sz', 'ashare', '格力电器', '家电', 'Gree', 1),
('002475', 'sz002475', 'sz', 'ashare', '立讯精密', '消费电子', 'Luxshare', 1),
('000001', 'sz000001', 'sz', 'ashare', '平安银行', '银行', 'PAB', 0),
('002142', 'sz002142', 'sz', 'ashare', '宁波银行', '银行', 'NBCB', 0),
('300760', 'sz300760', 'sz', 'ashare', '迈瑞医疗', '医疗器械', 'Mindray', 1),
('002714', 'sz002714', 'sz', 'ashare', '牧原股份', '养殖', 'Muyuan', 0),
('002352', 'sz002352', 'sz', 'ashare', '顺丰控股', '物流', 'SF Express', 1),
('000725', 'sz000725', 'sz', 'ashare', '京东方A', '面板', 'BOE', 0),
('300124', 'sz300124', 'sz', 'ashare', '汇川技术', '工业自动化', 'Inovance', 1),
('002230', 'sz002230', 'sz', 'ashare', '科大讯飞', 'AI', 'iFlytek', 1),
('000338', 'sz000338', 'sz', 'ashare', '潍柴动力', '发动机', 'Weichai', 0),
('002027', 'sz002027', 'sz', 'ashare', '分众传媒', '广告', 'Focus Media', 0),
('300274', 'sz300274', 'sz', 'ashare', '阳光电源', '光伏逆变器', 'Sungrow', 1),
('002129', 'sz002129', 'sz', 'ashare', 'TCL中环', '光伏', 'TCL Zhonghuan', 0),
('300015', 'sz300015', 'sz', 'ashare', '爱尔眼科', '医疗服务', 'Aier', 0),
('000625', 'sz000625', 'sz', 'ashare', '长安汽车', '汽车', 'Changan', 1);

-- A股 — 科创板
INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin, is_tracked) VALUES
('688981', 'sh688981', 'sh', 'ashare', '中芯国际', '半导体', 'SMIC', 1),
('688111', 'sh688111', 'sh', 'ashare', '金山办公', '软件', 'Kingsoft', 1),
('688012', 'sh688012', 'sh', 'ashare', '中微公司', '半导体设备', 'AMEC', 1),
('688036', 'sh688036', 'sh', 'ashare', '传音控股', '手机', 'Transsion', 0),
('688396', 'sh688396', 'sh', 'ashare', '华润微', '半导体', 'CR Micro', 0),
('688561', 'sh688561', 'sh', 'ashare', '奇安信', '网络安全', 'QiAnXin', 0),
('688256', 'sh688256', 'sh', 'ashare', '寒武纪', 'AI芯片', 'Cambricon', 1),
('688041', 'sh688041', 'sh', 'ashare', '海光信息', 'CPU', 'Hygon', 1);

-- A股 — 创业板
INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin, is_tracked) VALUES
('300896', 'sz300896', 'sz', 'ashare', '爱美客', '医美', 'Imeik', 0),
('300413', 'sz300413', 'sz', 'ashare', '芒果超媒', '传媒', 'Mango', 0),
('300122', 'sz300122', 'sz', 'ashare', '智飞生物', '疫苗', 'Zhifei', 0),
('300782', 'sz300782', 'sz', 'ashare', '卓胜微', '射频芯片', 'Maxscend', 1),
('300661', 'sz300661', 'sz', 'ashare', '圣邦股份', '模拟芯片', 'SG Micro', 0),
('300760', 'sz300760', 'sz', 'ashare', '迈瑞医疗', '医疗器械', 'Mindray', 0);

-- 港股
INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin, is_tracked) VALUES
('00700', 'hk00700', 'hk', 'hkshare', '腾讯控股', '互联网', 'Tencent', 1),
('09988', 'hk09988', 'hk', 'hkshare', '阿里巴巴-SW', '互联网', 'Alibaba', 1),
('09999', 'hk09999', 'hk', 'hkshare', '网易-S', '互联网', 'NetEase', 0),
('03690', 'hk03690', 'hk', 'hkshare', '美团-W', '本地生活', 'Meituan', 1),
('09618', 'hk09618', 'hk', 'hkshare', '京东集团-SW', '电商', 'JD', 1),
('01810', 'hk01810', 'hk', 'hkshare', '小米集团-W', '手机/汽车', 'Xiaomi', 1),
('09888', 'hk09888', 'hk', 'hkshare', '百度集团-SW', 'AI/搜索', 'Baidu', 0),
('01024', 'hk01024', 'hk', 'hkshare', '快手-W', '短视频', 'Kuaishou', 0),
('02015', 'hk02015', 'hk', 'hkshare', '理想汽车-W', '新能源车', 'Li Auto', 1),
('09866', 'hk09866', 'hk', 'hkshare', '蔚来-SW', '新能源车', 'NIO', 0),
('09868', 'hk09868', 'hk', 'hkshare', '小鹏汽车-W', '新能源车', 'XPeng', 0),
('02331', 'hk02331', 'hk', 'hkshare', '李宁', '运动服饰', 'Li Ning', 0),
('02020', 'hk02020', 'hk', 'hkshare', '安踏体育', '运动服饰', 'Anta', 0),
('00388', 'hk00388', 'hk', 'hkshare', '香港交易所', '交易所', 'HKEX', 1),
('01299', 'hk01299', 'hk', 'hkshare', '友邦保险', '保险', 'AIA', 1),
('00005', 'hk00005', 'hk', 'hkshare', '汇丰控股', '银行', 'HSBC', 0),
('02269', 'hk02269', 'hk', 'hkshare', '药明生物', '医药', 'WuXi Bio', 0),
('00175', 'hk00175', 'hk', 'hkshare', '吉利汽车', '汽车', 'Geely', 0),
('01211', 'hk01211', 'hk', 'hkshare', '比亚迪股份', '新能源车', 'BYD HK', 0),
('00941', 'hk00941', 'hk', 'hkshare', '中国移动', '电信', 'CMCC', 1);

-- 美股
INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin, is_tracked) VALUES
('AAPL', 'usAAPL', 'us', 'usshare', 'Apple', '科技', 'Apple', 1),
('MSFT', 'usMSFT', 'us', 'usshare', 'Microsoft', '科技', 'Microsoft', 1),
('GOOGL', 'usGOOGL', 'us', 'usshare', 'Alphabet', '互联网', 'Google', 1),
('NVDA', 'usNVDA', 'us', 'usshare', 'NVIDIA', 'AI芯片', 'NVIDIA', 1),
('TSLA', 'usTSLA', 'us', 'usshare', 'Tesla', '新能源车', 'Tesla', 1),
('META', 'usMETA', 'us', 'usshare', 'Meta', '社交', 'Meta', 0),
('AMZN', 'usAMZN', 'us', 'usshare', 'Amazon', '电商/云', 'Amazon', 1),
('AMD', 'usAMD', 'us', 'usshare', 'AMD', '芯片', 'AMD', 0),
('TSM', 'usTSM', 'us', 'usshare', '台积电', '半导体', 'TSMC', 1),
('BABA', 'usBABA', 'us', 'usshare', '阿里巴巴', '互联网', 'Alibaba US', 1),
('JD', 'usJD', 'us', 'usshare', '京东', '电商', 'JD US', 0),
('PDD', 'usPDD', 'us', 'usshare', '拼多多', '电商', 'Pinduoduo', 1),
('BIDU', 'usBIDU', 'us', 'usshare', '百度', 'AI', 'Baidu US', 0),
('NIO', 'usNIO', 'us', 'usshare', '蔚来', '新能源车', 'NIO US', 0),
('LI', 'usLI', 'us', 'usshare', '理想汽车', '新能源车', 'Li Auto US', 0),
('XPEV', 'usXPEV', 'us', 'usshare', '小鹏汽车', '新能源车', 'XPeng US', 0),
('BEKE', 'usBEKE', 'us', 'usshare', '贝壳', '房产平台', 'Beike', 0),
('TME', 'usTME', 'us', 'usshare', '腾讯音乐', '音乐', 'TME', 0),
('V', 'usV', 'us', 'usshare', 'Visa', '金融', 'Visa', 0),
('JPM', 'usJPM', 'us', 'usshare', '摩根大通', '银行', 'JPMorgan', 0),
('BRK.B', 'usBRK.B', 'us', 'usshare', '伯克希尔', '综合', 'Berkshire', 1),
('JNJ', 'usJNJ', 'us', 'usshare', '强生', '医药', 'JNJ', 0);

-- ETF
INSERT OR IGNORE INTO stocks (code, full_code, market, market_type, name, sector, pinyin, is_tracked) VALUES
('510050', 'sh510050', 'sh', 'ashare', '上证50ETF', 'ETF', 'SSE50', 1),
('510300', 'sh510300', 'sh', 'ashare', '沪深300ETF', 'ETF', 'CSI300', 1),
('159915', 'sz159915', 'sz', 'ashare', '创业板ETF', 'ETF', 'GEM', 0),
('510500', 'sh510500', 'sh', 'ashare', '中证500ETF', 'ETF', 'CSI500', 0),
('159949', 'sz159949', 'sz', 'ashare', '创业板50ETF', 'ETF', 'GEM50', 0),
('513050', 'sh513050', 'sh', 'ashare', '中概互联ETF', 'ETF', 'China Internet', 1),
('513100', 'sh513100', 'sh', 'ashare', '纳指ETF', 'ETF', 'NASDAQ ETF', 1),
('159920', 'sz159920', 'sz', 'ashare', '恒生ETF', 'ETF', 'HSI ETF', 0);
