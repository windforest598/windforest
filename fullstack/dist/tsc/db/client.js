// ═══════════════════════════════════════════════
// 风林慧策 — Cloudflare D1 数据库客户端
// Workers 环境：通过 c.env.DB (D1 binding) 访问
// 本地开发：通过 wrangler d1 execute 或 miniflare
// ═══════════════════════════════════════════════
// D1 数据库实例通过 Workers binding 注入
// 在 wrangler.toml 中配置: [[d1_databases]] binding = "DB"
// 在 Workers 代码中: c.env.DB
// 获取 D1 数据库实例（从 Hono Context 或任意有 env.DB 的对象）
// 类型使用 any 以兼容 Hono Context 的宽松类型系统
export function getDB(c) {
    const db = c?.env?.DB;
    if (!db) {
        throw new Error('D1 binding not configured. Ensure [[d1_databases]] is set in wrangler.toml.');
    }
    return db;
}
//# sourceMappingURL=client.js.map