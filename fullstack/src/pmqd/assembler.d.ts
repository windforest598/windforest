// V6.0 内核类型声明 — 让 TS 侧可安全 import 纯 JS 引擎（wrangler/esbuild 直接打包 .js）

export interface PMQDModule {
  id: string;
  layer: 'meta' | 'gate' | 'core' | 'risk' | 'decision' | 'conditional';
  title: { zh: string; en: string };
  data: Record<string, any>;
  render?: { html?: Function; md?: Function; docx?: Function };
}

export interface CoherenceCheck {
  name: string;
  pass: boolean;
  note: string;
}

export interface PMQDContract {
  meta: {
    stock: string;
    name: string;
    analyst: string;
    framework: string;
    engine: string;
    generatedAt: string;
    determinism: string;
    l1Fetch?: any;
  };
  modules: PMQDModule[];
  coherence: { passed: boolean; checks: CoherenceCheck[] };
  strategy: string | null;
  veto: { module: string; reason: string } | null;
  overallRating: string;
}

export declare function assemble(input: {
  stock: string;
  name?: string;
  strategyPref?: string | null;
  l1Data?: Record<string, any>;
  l1Query?: Record<string, any>;
  certification?: any;
  userOverrides?: Record<string, any>;
}): Promise<PMQDContract>;

export declare function renderReport(
  contract: PMQDContract,
  format?: 'html' | 'md' | 'docx',
  ctx?: any,
): string;
