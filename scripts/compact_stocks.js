#!/usr/bin/env node
const fs = require('fs');

const BASE = 'C:/Users/work/WorkBuddy/2026-06-10-15-02-17';
const stocks = [];
const seen = new Set();

// Parse all lgt data files
const existingFiles = [];
for (let i = 0; i <= 17; i++) {
  for (const prefix of ['sh', 'sz']) {
    const f = BASE + '/tmp_lgt_' + prefix + '_' + i + '.txt';
    if (!fs.existsSync(f)) continue;
    existingFiles.push(f);
    const lines = fs.readFileSync(f, 'utf-8').split(/\r?\n/);
    lines.forEach(line => {
      const m = line.match(/^\| (sh\d{6}|sz\d{6}|bj\d{6}) \| (.+?) \|$/);
      if (m) {
        const full = m[1];
        const code = full.replace(/^(sh|sz|bj)/, '');
        const name = m[2].trim();
        const market = full.substring(0, 2);
        const key = full + '|a';
        if (!seen.has(key)) {
          seen.add(key);
          stocks.push({code, name, market});
        }
      }
    });
  }
}

console.log('Found', existingFiles.length, 'data files');

// Add HK stocks from seed.sql
const seedContent = fs.readFileSync(BASE + '/fullstack/src/db/seed.sql', 'utf-8');
const hkMatches = [...seedContent.matchAll(/'\s*(\d{5})\s*',\s*'hk\1'\s*,\s*'hk'\s*,\s*'hkshare'\s*,\s*'([^']*)'/g)];
hkMatches.forEach(m => {
  stocks.push({code: m[1], name: m[2], market: 'hk'});
});

// Add US stocks from existing frontend STOCK_DB
const html = fs.readFileSync(BASE + '/deploy/index.html', 'utf-8');
const usMatches = [...html.matchAll(/\{c:"(\w+\.?\w*)",n:"([^"]+)",m:"us"/g)];
usMatches.forEach(m => {
  stocks.push({code: m[1], name: m[2], market: 'us'});
});

// Dedup
const unique = [];
const seen2 = new Set();
stocks.forEach(s => {
  const key = s.market + '|' + s.code;
  if (!seen2.has(key)) { seen2.add(key); unique.push(s); }
});

console.log('Total unique stocks:', unique.length);
console.log('Sample:', JSON.stringify(unique.slice(0, 5)));

// Generate compact pipe-delimited string
const dataStr = unique.map(s => {
  const cleanName = s.name.replace(/,/g, ' ').replace(/"/g, '');
  return s.market + ':' + s.code + ':' + cleanName;
}).join('|');

console.log('Data string length:', dataStr.length, 'bytes');

// Also add a JS loader with search function
const js = `
// Compact stock database (${unique.length} stocks from westock-data)
// Format: market:code:name|market:code:name|...
var _COMPACT_STOCKS = "${dataStr}";

function parseStocks() {
  if (this._parsed) return this._parsed;
  this._parsed = _COMPACT_STOCKS.split('|').map(function(s) {
    var parts = s.split(':');
    return {c: parts[0] + parts[1], n: parts[2], m: parts[0], mk: parts[0] === 'hk' ? 'hkshare' : parts[0] === 'us' ? 'usshare' : 'ashare'};
  });
  return this._parsed;
}

// Override STOCK_DB with parsed compact data
try {
  STOCK_DB = parseStocks();
  console.log('Loaded ' + STOCK_DB.length + ' stocks from compact DB');
} catch(e) {}
`;

fs.writeFileSync(BASE + '/deploy/compact-stocks.js', js.trim());
console.log('Saved compact-stocks.js');

// Also generate the embedding code to insert into index.html
const embedCode = `
<script src="compact-stocks.js"></script>
`;
fs.writeFileSync(BASE + '/tmp_embed_hint.txt', embedCode);
console.log('Done. Total stock entries:', unique.length);
