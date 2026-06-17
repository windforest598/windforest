// ═══════════════════════════════════════════════
// 风林慧策 API — /api/trigger-analysis 路由
// 触发 GitHub Actions 按需分析
// ═══════════════════════════════════════════════

import { Hono } from 'hono';
import type { TriggerResponse } from '../types';

export const triggerRoute = new Hono();

triggerRoute.post('/', async (c) => {
  try {
    const body = await c.req.json<{ code: string; market: string }>();
    const { code, market } = body;

    if (!code) {
      return c.json({ status: 'error', message: 'Missing code' } as TriggerResponse, 400);
    }

    const ghToken = (typeof (globalThis as any).GH_PAT !== 'undefined' ? (globalThis as any).GH_PAT : null);

    const repoOwner = (typeof (globalThis as any).GH_REPO_OWNER !== 'undefined' ? (globalThis as any).GH_REPO_OWNER : null);

    const repoName = (typeof (globalThis as any).GH_REPO_NAME !== 'undefined' ? (globalThis as any).GH_REPO_NAME : null);

    if (!ghToken || !repoOwner || !repoName) {
      // If GitHub Actions not configured, return a helpful message
      return c.json({
        status: 'error',
        message: '后台分析服务尚未配置。每日自动分析将在市场收盘后运行，请稍后查看结果。',
      } satisfies TriggerResponse);
    }

    // Trigger adhoc-analysis workflow
    const workflowUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/adhoc-analysis.yml/dispatches`;

    const response = await fetch(workflowUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          stock_code: `${market || 'sz'}${code}`,
          market: market || 'sz',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    return c.json({
      status: 'triggered',
      workflow_url: `https://github.com/${repoOwner}/${repoName}/actions/workflows/adhoc-analysis.yml`,
      message: '分析已触发，预计3-5分钟完成。请稍后刷新查看结果。',
    } satisfies TriggerResponse);
  } catch (err) {
    console.error('Trigger error:', err);
    return c.json({
      status: 'error',
      message: '触发分析失败，请稍后重试',
    } satisfies TriggerResponse, 500);
  }
});
