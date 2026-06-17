// ═══════════════════════════════════════════════
// 风林慧策 — D1 命令行辅助工具（Node.js 脚本用）
// 通过 wrangler d1 execute 与 D1 数据库交互
// ═══════════════════════════════════════════════

import { execSync } from 'child_process';

const DB_NAME = 'windforest-db';

// 执行 SQL 查询（SELECT），返回解析后的行数据
export function query(sql: string, params: (string | number | null)[] = []): Record<string, unknown>[] {
  const fullSql = buildSql(sql, params);
  const output = runWrangler(fullSql);

  // 解析 wrangler d1 execute 的表格输出
  return parseTableOutput(output);
}

// 执行 SQL 命令（INSERT/UPDATE/DELETE），返回影响行数
export function execute(sql: string, params: (string | number | null)[] = []): number {
  const fullSql = buildSql(sql, params);
  const output = runWrangler(fullSql);
  // wrangler d1 execute 对于写操作不返回行数，返回 0
  return output.includes('OK') ? 1 : 0;
}

// 获取单个结果
export function queryOne(sql: string, params: (string | number | null)[] = []): Record<string, unknown> | null {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

function buildSql(sql: string, params: (string | number | null)[]): string {
  if (params.length === 0) return sql;

  let paramIndex = 0;
  return sql.replace(/\?/g, () => {
    const val = params[paramIndex++];
    if (val === null) return 'NULL';
    if (typeof val === 'number') return String(val);
    // String: escape single quotes
    return `'${String(val).replace(/'/g, "''")}'`;
  });
}

function runWrangler(sql: string): string {
  try {
    // Escape double quotes in SQL for command line
    const escaped = sql.replace(/"/g, '\\"');
    return execSync(`npx wrangler d1 execute ${DB_NAME} --command="${escaped}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
  } catch (err: any) {
    const stderr = err.stderr || err.message || '';
    // Ignore "UNIQUE constraint" errors
    if (stderr.includes('UNIQUE constraint')) return '';
    console.error(`D1 error: ${stderr.substring(0, 200)}`);
    throw err;
  }
}

// 解析 wrangler d1 execute --command 的表格输出
// 格式: 列名用 | 分隔，数据行也用 | 分隔
function parseTableOutput(output: string): Record<string, unknown>[] {
  const lines = output.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 找到表头行（以 | 开头的第一行）
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('│') || lines[i].startsWith('|')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  // 解析列名
  const headers = lines[headerIndex]
    .split('|')
    .map(h => h.trim())
    .filter(h => h.length > 0);

  const results: Record<string, unknown>[] = [];

  // 解析数据行（跳过头行和分隔行）
  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('│') && !line.startsWith('|')) continue;

    const values = line
      .split('|')
      .map(v => v.trim())
      .filter((_, idx) => idx > 0 && idx <= headers.length);

    if (values.length !== headers.length) continue;

    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      let val: string | number | null = values[j];

      // 尝试转换数字
      if (val && !isNaN(Number(val)) && val !== '') {
        val = Number(val);
      }
      if (val === '' || val === 'NULL') val = null;

      row[key] = val;
    }
    results.push(row);
  }

  return results;
}
