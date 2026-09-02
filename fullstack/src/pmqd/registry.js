// Module registry — flattens all layer files into one ordered list.
// Order = coherence order: meta(shell) → gate → core → risk → decision → conditional.

import { reportHeader } from './modules/meta.js';
import { integrityReview, strategyClassification } from './modules/gate.js';
import {
  industryScan, userValue, financialPenetration, pmqdScoring, safetyMargin,
} from './modules/core.js';
import { healthCheck8d, cognitiveRisk } from './modules/risk.js';
import { kellyPosition, masterCase, ratingConclusion } from './modules/decision.js';
import { implicitCash, holdTest } from './modules/conditional.js';

// Explicit layer order guarantees dependencies resolve (e.g. rating_conclusion after pmqd_scoring).
export const MODULES = [
  reportHeader,
  integrityReview, strategyClassification,
  industryScan, userValue, financialPenetration, pmqdScoring, safetyMargin,
  healthCheck8d, cognitiveRisk,
  kellyPosition, masterCase, ratingConclusion,
  implicitCash, holdTest,
];

export const LAYER_ORDER = ['meta', 'gate', 'core', 'risk', 'decision', 'conditional'];
