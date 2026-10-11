import { describe, expect, it } from 'vitest';
import { planCopilotTools } from './copilot-planner';
import { EVAL_CASES, WRITE_TOOLS, type EvalCase } from './copilotEval.fixture';

/**
 * Wave F: how often the rule planner - what the assistant falls back to when
 * no model is answering - proposes the right thing for sixty requests, half
 * in Greek. The bar is 95%, overall and per language; a miss is printed with
 * what was planned, so a regression names itself.
 */

type Verdict = { c: EvalCase; ok: boolean; why: string };

function judge(c: EvalCase): Verdict {
  const planned = planCopilotTools(c.message);
  const hit = planned.find((t) => t.name === c.tool);
  if (!hit) return { c, ok: false, why: `planned ${planned.map((t) => t.name).join(', ') || 'nothing'}` };
  for (const [key, value] of Object.entries(c.args ?? {})) {
    if (hit.args[key] !== value) return { c, ok: false, why: `${key}=${JSON.stringify(hit.args[key])}, wanted ${JSON.stringify(value)}` };
  }
  if (c.read) {
    const write = planned.find((t) => WRITE_TOOLS.has(t.name));
    if (write) return { c, ok: false, why: `a question planned the write ${write.name}` };
  }
  return { c, ok: true, why: '' };
}

const isGreek = (text: string) => /[Ͱ-Ͽ]/.test(text);

describe('assistant evaluation (82 requests, EN/EL)', () => {
  const verdicts = EVAL_CASES.map(judge);
  const misses = verdicts.filter((v) => !v.ok);
  const score = (list: Verdict[]) => list.filter((v) => v.ok).length / list.length;

  it('has eighty-two cases, forty-one in each language', () => {
    expect(EVAL_CASES).toHaveLength(82);
    expect(EVAL_CASES.filter((c) => isGreek(c.message))).toHaveLength(41);
  });

  it('plans the right capability for at least 95% of them, in each language', () => {
    const report = misses.map((v) => `  ✗ ${v.c.message} → ${v.c.tool}: ${v.why}`).join('\n');
    const overall = score(verdicts);
    const en = score(verdicts.filter((v) => !isGreek(v.c.message)));
    const el = score(verdicts.filter((v) => isGreek(v.c.message)));
    // Printed on every run, so the number in the docs can be checked.
    console.log(`copilot eval: ${(overall * 100).toFixed(1)}% overall · EN ${(en * 100).toFixed(1)}% · EL ${(el * 100).toFixed(1)}%${report ? `\n${report}` : ''}`);
    expect(overall, report).toBeGreaterThanOrEqual(0.95);
    expect(en, report).toBeGreaterThanOrEqual(0.95);
    expect(el, report).toBeGreaterThanOrEqual(0.95);
  });
});
