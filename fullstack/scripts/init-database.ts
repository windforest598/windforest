// ═══════════════════════════════════════════════
// 风林慧策 — 数据库初始化/种子数据脚本
// 运行: npx tsx scripts/init-database.ts
// 目的: 通过 wrangler d1 execute 在 D1 中创建表并导入种子数据
// 注意: 需要已登录 wrangler (npx wrangler login)
// ═══════════════════════════════════════════════

import { execSync } from 'child_process';
import * as path from 'path';

const DB_NAME = 'windforest-db';

function runWrangler(args: string): string {
  try {
    return execSync(`npx wrangler d1 execute ${DB_NAME} ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    console.error(`wrangler error: ${err.stderr || err.message}`);
    throw err;
  }
}

async function initDatabase() {
  console.log('🔧 初始化风林慧策 D1 数据库...\n');

  const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
  const seedPath = path.join(__dirname, '..', 'src', 'db', 'seed.sql');

  // Step 1: Create tables
  console.log('📋 创建数据库表...');
  const schemaOutput = runWrangler(`--file="${schemaPath}"`);
  console.log(schemaOutput);
  console.log('✅ Schema ready\n');

  // Step 2: Import seed data
  console.log('🌱 导入种子数据 (178只股票)...');
  const seedOutput = runWrangler(`--file="${seedPath}"`);
  console.log(seedOutput);

  // Step 3: Verify
  console.log('\n📊 验证数据...');
  const countOutput = runWrangler(`--command="SELECT market_type, COUNT(*) as cnt FROM stocks GROUP BY market_type"`);
  console.log(countOutput);

  console.log('\n🎉 数据库初始化完成！');
}

initDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
