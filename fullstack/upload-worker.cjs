// upload-worker.js — 通过 Cloudflare API 直接上传 Worker（绕过 Wrangler CLI 网络问题）
const fs = require('fs');
const https = require('https');

const ACCOUNT_ID = '15c2945c1130560bdeed9757fc61ddae';
const SCRIPT_NAME = 'windforest-api';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.API_TOKEN;

if (!API_TOKEN) {
  console.error('❌ 请设置环境变量 CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

// 读取文件
const metadata = JSON.parse(fs.readFileSync('dist/metadata.json', 'utf8'));
const scriptContent = fs.readFileSync('dist/worker.js', 'utf8');

// 构造 multipart/form-data
const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
const CRLF = '\r\n';

let body = '';

// metadata 部分
body += '--' + boundary + CRLF;
body += 'Content-Disposition: form-data; name="metadata"' + CRLF;
body += 'Content-Type: application/json' + CRLF;
body += CRLF;
body += JSON.stringify(metadata) + CRLF;

// script 部分
body += '--' + boundary + CRLF;
body += 'Content-Disposition: form-data; name="script"; filename="worker.js"' + CRLF;
body += 'Content-Type: application/javascript' + CRLF;
body += CRLF;
body += scriptContent + CRLF;

// 结束边界
body += '--' + boundary + '--' + CRLF;

const postData = Buffer.from(body);

const options = {
  hostname: 'api.cloudflare.com',
  path: `/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`,
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': postData.length,
  },
};

console.log(`📡 上传 Worker 到 Cloudflare...`);
console.log(`   Account: ${ACCOUNT_ID}`);
console.log(`   Script:  ${SCRIPT_NAME}`);
console.log(`   Body size: ${postData.length} bytes`);

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`\n📬 响应状态码: ${res.statusCode}`);
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      if (json.success) {
        console.log('\n✅ Worker 上传成功！');
        console.log(`🌐 URL: https://${SCRIPT_NAME}.workers.dev`);
      } else {
        console.error('\n❌ 上传失败:', json.errors || json.messages);
      }
    } catch (e) {
      console.log('响应内容:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('❌ 请求失败:', e.message);
});

req.write(postData);
req.end();
