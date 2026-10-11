import type { CfbGlyphName } from '@/components/icons/CfbGlyph';

export interface ApplicationQuestion {
  id: string;
  question: string;
  answer: string;
  maxLength?: number;
  tips?: string;
  required: boolean;
}

export interface ApplicationTemplate {
  id: string;
  name: string;
  description: string;
  descKey?: 'app_yc_desc' | 'app_ts_desc' | 'app_uni_desc' | 'app_grant_desc';
  glyph: CfbGlyphName;
  deadline?: string;
  deadlineKey?: 'app_deadline_rolling' | 'app_deadline_varies';
  website?: string;
  questions: ApplicationQuestion[];
  status: 'draft' | 'in-progress' | 'completed' | 'submitted';
}

export const APPLICATION_PROGRAM_IDS = ['yc', 'techstars', 'university', 'grant'] as const;
export type ApplicationProgramId = (typeof APPLICATION_PROGRAM_IDS)[number];

const APPLICATION_STALE_SNIPPETS = [
  'Sequoia',
  'TechCrunch',
  'Product Hunt',
  'San Francisco',
  '$3M ARR',
  '$5K MRR',
  '$50K MRR',
  '1,000+ registered',
  '150+ successful',
  'ex-Google',
  'ex-Stripe',
  '2 exits',
  '2 successful exits',
  'This preview does not invent',
  'cold list of twelve teams',
];

export function requiredCompletion(app: { questions: ApplicationQuestion[] }): number {
  const required = app.questions.filter((q) => q.required);
  if (required.length === 0) return 100;
  const answered = required.filter((q) => q.answer.trim().length > 0);
  return Math.round((answered.length / required.length) * 100);
}

export function deriveApplicationStatus(
  app: ApplicationTemplate,
): ApplicationTemplate['status'] {
  if (app.status === 'submitted') return 'submitted';
  const pct = requiredCompletion(app);
  if (pct === 0) return 'draft';
  if (pct === 100) return 'completed';
  return 'in-progress';
}

export function clipApplicationAnswer(text: string, maxLength?: number): string {
  const trimmed = text.trim();
  if (!maxLength || trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trimEnd();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asApplicationList(saved: unknown): unknown[] | null {
  if (Array.isArray(saved)) return saved;
  const outer = asRecord(saved);
  if (!outer) return null;
  if (Array.isArray(outer.applications)) return outer.applications;
  const nested = asRecord(outer.applications);
  if (!nested) return null;
  if (Array.isArray(nested.applications)) return nested.applications;
  if (Array.isArray(nested.list)) return nested.list;
  return null;
}

export function seedApplications(): ApplicationTemplate[] {
  return APPLICATION_TEMPLATES.map((tpl) => ({ ...tpl, status: 'draft' as const }));
}

export function mergeSavedApplications(saved: unknown): ApplicationTemplate[] {
  const seed = seedApplications();
  const list = asApplicationList(saved);
  if (!list) return seed;
  return seed.map((tpl) => {
    const match = list.find((item) => item && typeof item === 'object' && (item as { id?: string }).id === tpl.id) as
      | { questions?: { id: string; answer?: string }[]; status?: ApplicationTemplate['status'] }
      | undefined;
    if (!match) return tpl;
    const questions = tpl.questions.map((q) => {
      const found = match.questions?.find((mq) => mq.id === q.id);
      return found && typeof found.answer === 'string' ? { ...q, answer: found.answer } : q;
    });
    const next = { ...tpl, questions, status: match.status ?? tpl.status };
    return { ...next, status: deriveApplicationStatus(next) };
  });
}

export function pickGeneratedAnswers(raw: unknown): Record<string, string> {
  const rec = asRecord(raw);
  if (!rec) return {};
  const source = asRecord(rec.answers) ?? rec;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && value.trim()) out[key] = value;
  }
  return out;
}

export function mergeEmptyApplicationAnswers(
  app: ApplicationTemplate,
  incoming: Record<string, string>,
): ApplicationTemplate {
  const questions = app.questions.map((q) => {
    if (q.answer.trim()) return q;
    const draft = incoming[q.id];
    if (typeof draft !== 'string' || !draft.trim()) return q;
    return { ...q, answer: clipApplicationAnswer(draft, q.maxLength) };
  });
  const next = { ...app, questions };
  return { ...next, status: deriveApplicationStatus(next) };
}

export function isStaleHarborApplicationBlob(blob: string): boolean {
  return APPLICATION_STALE_SNIPPETS.some((snippet) => blob.includes(snippet));
}

/** Harbor-honest drafts. Preview generate and empty-only merge both read this. */
export function harborApplicationDrafts(programId: string): Record<string, string> {
  return HARBOR_APPLICATION_DRAFTS[programId] ?? {};
}

const HARBOR_APPLICATION_DRAFTS: Record<string, Record<string, string>> = {
  yc: {
    yc1: 'Harbor OS for early-stage founders.',
    yc2: 'Harbor is one workspace that matches people and turns the idea into artefacts. Graph, readiness, and builder sit in the same product so founders stop stitching matching, messaging, and fundraising tools.',
    yc3: 'Athens, Greece. After YC the company stays in Athens and EU time zones.',
    yc4: 'Elena Papadopoulos is Founder & CEO. The complementary-cofounder role (technical + commercial pair) is open on Projects.',
    yc5: 'Elena is building Harbor because matching, messaging, and fundraising live in separate products. Domain: early-stage founder tooling and complementary-cofounder search.',
    yc6: 'Directories stop at the intro; docs tools never match. Harbor keeps the graph, readiness, and builder together so a founder can test a complementary pair on real artefacts.',
    yc7: 'Standalone matching directories and spreadsheets-plus-chat.',
    yc8: 'Subscriptions and paid expert reviews on drafts. Seed is $750K (Athens Tech Angels committed $375K).',
    yc9: 'Athens and EU founder networks first, through warm intros. Shareable Idea Core, GTM board, and the pitch for the $750K seed.',
    yc10: 'Founders need complementary skills on the same artefacts, not another isolated intro. The workspace and readiness scoring came from that.',
    yc11: '',
    yc12: 'To land the complementary cofounder and close the remaining $375K of the seed alongside founders who have done both.',
  },
  techstars: {
    ts1: 'Harbor OS for early-stage founders — graph, readiness, and builder in one product.',
    ts2: 'Founders waste weeks stitching matching, messaging, and fundraising tools.',
    ts3: 'One workspace that matches people and turns the idea into artefacts.',
    ts4: 'Subscriptions and paid expert reviews on drafts.',
    ts5: '$375K of the $750K seed committed by Athens Tech Angels, plus shareable Builder artefacts.',
    ts6: 'Graph + readiness + builder in the same product, instead of a directory that stops at the intro.',
    ts7: 'Elena Papadopoulos, Founder & CEO. Complementary-cofounder role (technical + commercial pair) is open.',
    ts8: 'Mentor-led structure while the complementary cofounder joins and the remaining $375K of the seed closes.',
    ts9: 'Close the remaining $375K of the seed, land the complementary cofounder, and keep artefacts shareable.',
  },
  university: {
    uni1: 'Harbor',
    uni2: 'Harbor OS for early-stage founders. Elena Papadopoulos is Founder & CEO. A complementary cofounder (technical + commercial) is still open. Graph, readiness, and builder sit in one product. Seed is $750K, $375K committed by Athens Tech Angels.',
    uni3: 'Founders waste weeks stitching matching, messaging, and fundraising tools.',
    uni4: 'One workspace that matches people and turns the idea into artefacts.',
    uni5: 'Early-stage founders looking for a complementary cofounder, especially Athens and EU time zones.',
    uni6: 'Elena Papadopoulos, Founder & CEO. Complementary-cofounder role is listed on Projects.',
    uni7: 'Idea Core, BMC, GTM board, and a pitch for the $750K seed.',
    uni8: 'Mentorship, founder-network intros in Athens, and review on the same artefacts.',
    uni9: 'Tied to Harbor milestones: complementary cofounder, remaining $375K close, shareable Idea Core and GTM board.',
    uni10: '',
  },
  grant: {
    gr1: 'Harbor: operating system for early-stage founders',
    gr2: 'Harbor keeps matching, readiness, and builder artefacts in one workspace so founders stop stitching tools. Elena Papadopoulos is Founder & CEO; a complementary cofounder is open. Seed $750K, $375K committed by Athens Tech Angels.',
    gr3: 'Matching, messaging, and fundraising live in separate products, so the plan and the match never sit together.',
    gr4: 'Graph + readiness + builder in the same product. Founders write Idea Core, BMC, and a pitch on the same workspace they use to find a complementary cofounder.',
    gr5: 'Product graph, readiness scoring attached to drafts, and builder artefacts.',
    gr6: 'Early-stage founder tooling — matching, messaging, and fundraising in one category. Category sizing lives on Market in Builder.',
    gr7: 'Elena Papadopoulos, Founder & CEO. Complementary-cofounder role (technical + commercial pair) is open.',
    gr8: 'Use of funds follows the $750K seed on the pitch deck: product, go-to-market, team, operations.',
    gr9: 'A shareable plan, a complementary cofounder, and the remaining $375K of the seed closed.',
    gr10: 'Subscriptions and expert reviews on drafts after the seed, all inside the Harbor workspace.',
  },
};

export const APPLICATION_TEMPLATES: Omit<ApplicationTemplate, 'status'>[] = [
  {
    id: 'yc',
    name: 'Y Combinator',
    description: 'The most prestigious startup accelerator',
    descKey: 'app_yc_desc',
    glyph: 'award',
    deadline: 'Rolling admissions',
    deadlineKey: 'app_deadline_rolling',
    website: 'https://www.ycombinator.com/apply',
    questions: [
      { id: 'yc1', question: 'Describe what your company does in 50 characters or less.', answer: '', maxLength: 50, tips: 'Be extremely concise. Think elevator pitch in one sentence.', required: true },
      { id: 'yc2', question: 'What is your company going to make? Please describe your product and what it does or will do.', answer: '', maxLength: 500, tips: 'Focus on the product, not the market. Be specific about what you\'re building.', required: true },
      { id: 'yc3', question: 'Where do you live now, and where would the company be based after YC?', answer: '', required: true },
      { id: 'yc4', question: 'How long have the founders known one another and how did you meet?', answer: '', tips: 'YC values strong founder relationships. Be honest about your history.', required: true },
      { id: 'yc5', question: 'Why did you pick this idea to work on? Do you have domain expertise in this area?', answer: '', maxLength: 500, tips: 'Show your unique insight and why you\'re the right team.', required: true },
      { id: 'yc6', question: 'What\'s new about what you\'re making? What substitutes do people resort to because it doesn\'t exist yet?', answer: '', maxLength: 500, tips: 'Highlight your innovation and current workarounds.', required: true },
      { id: 'yc7', question: 'Who are your competitors? Who might become competitors?', answer: '', maxLength: 500, tips: 'Show you understand the landscape. Don\'t say "no competitors".', required: true },
      { id: 'yc8', question: 'How do or will you make money? How much could you make?', answer: '', maxLength: 500, tips: 'Be specific about your business model and market size.', required: true },
      { id: 'yc9', question: 'How will you get users? If your idea is the type that faces a chicken-and-egg problem, how will you overcome it?', answer: '', maxLength: 500, tips: 'Show a concrete go-to-market strategy.', required: true },
      { id: 'yc10', question: 'What have you learned so far from working on your product?', answer: '', maxLength: 500, tips: 'Share insights from customer discovery and building.', required: false },
      { id: 'yc11', question: 'If you have already participated in an incubator or accelerator, which one?', answer: '', required: false },
      { id: 'yc12', question: 'Why do you want to be part of Y Combinator?', answer: '', maxLength: 300, tips: 'Be specific about what you hope to gain from YC.', required: true },
    ],
  },
  {
    id: 'techstars',
    name: 'Techstars',
    description: 'Global accelerator network',
    descKey: 'app_ts_desc',
    glyph: 'flag',
    deadline: 'Varies by program',
    deadlineKey: 'app_deadline_varies',
    website: 'https://www.techstars.com/accelerators',
    questions: [
      { id: 'ts1', question: 'What does your company do? (One sentence)', answer: '', maxLength: 100, required: true },
      { id: 'ts2', question: 'What problem are you solving?', answer: '', maxLength: 500, required: true },
      { id: 'ts3', question: 'What is your solution?', answer: '', maxLength: 500, required: true },
      { id: 'ts4', question: 'What is your business model?', answer: '', maxLength: 300, required: true },
      { id: 'ts5', question: 'What traction do you have?', answer: '', maxLength: 500, tips: 'Include metrics, users, revenue, partnerships.', required: true },
      { id: 'ts6', question: 'What is your competitive advantage?', answer: '', maxLength: 300, required: true },
      { id: 'ts7', question: 'Tell us about your team.', answer: '', maxLength: 500, required: true },
      { id: 'ts8', question: 'Why Techstars? Why this program specifically?', answer: '', maxLength: 300, required: true },
      { id: 'ts9', question: 'What do you hope to accomplish during the program?', answer: '', maxLength: 300, required: true },
    ],
  },
  {
    id: 'university',
    name: 'University Incubator',
    description: 'Academic startup programs',
    descKey: 'app_uni_desc',
    glyph: 'book',
    website: '/opportunities',
    questions: [
      { id: 'uni1', question: 'Project/Startup Name', answer: '', required: true },
      { id: 'uni2', question: 'Executive Summary (max 300 words)', answer: '', maxLength: 2000, required: true },
      { id: 'uni3', question: 'Problem Statement', answer: '', maxLength: 500, required: true },
      { id: 'uni4', question: 'Proposed Solution', answer: '', maxLength: 500, required: true },
      { id: 'uni5', question: 'Target Market', answer: '', maxLength: 300, required: true },
      { id: 'uni6', question: 'Team Background and Qualifications', answer: '', maxLength: 500, required: true },
      { id: 'uni7', question: 'Current Stage of Development', answer: '', maxLength: 300, required: true },
      { id: 'uni8', question: 'Resources Needed from the Incubator', answer: '', maxLength: 300, required: true },
      { id: 'uni9', question: 'Timeline and Milestones', answer: '', maxLength: 500, required: true },
      { id: 'uni10', question: 'Connection to University (if any)', answer: '', required: false },
    ],
  },
  {
    id: 'grant',
    name: 'Innovation Grant',
    description: 'Government and foundation grants',
    descKey: 'app_grant_desc',
    glyph: 'building',
    website: '/fundraising',
    questions: [
      { id: 'gr1', question: 'Project Title', answer: '', required: true },
      { id: 'gr2', question: 'Abstract (max 250 words)', answer: '', maxLength: 1500, required: true },
      { id: 'gr3', question: 'Problem/Need Statement', answer: '', maxLength: 1000, required: true },
      { id: 'gr4', question: 'Innovation Description', answer: '', maxLength: 1500, required: true },
      { id: 'gr5', question: 'Technical Approach', answer: '', maxLength: 1500, required: true },
      { id: 'gr6', question: 'Market Opportunity', answer: '', maxLength: 1000, required: true },
      { id: 'gr7', question: 'Team Qualifications', answer: '', maxLength: 1000, required: true },
      { id: 'gr8', question: 'Budget Overview', answer: '', maxLength: 500, required: true },
      { id: 'gr9', question: 'Expected Outcomes and Impact', answer: '', maxLength: 1000, required: true },
      { id: 'gr10', question: 'Sustainability Plan', answer: '', maxLength: 500, required: true },
    ],
  },
];

/** Saved workspace seed: YC and university in motion, Techstars and grant still empty. */
export const PREVIEW_APPLICATION_SEED = {
  applications: [
    {
      id: 'yc',
      questions: [
        { id: 'yc1', answer: HARBOR_APPLICATION_DRAFTS.yc.yc1 },
        { id: 'yc2', answer: HARBOR_APPLICATION_DRAFTS.yc.yc2 },
        { id: 'yc3', answer: HARBOR_APPLICATION_DRAFTS.yc.yc3 },
      ],
    },
    {
      id: 'university',
      questions: [
        { id: 'uni1', answer: HARBOR_APPLICATION_DRAFTS.university.uni1 },
        { id: 'uni2', answer: HARBOR_APPLICATION_DRAFTS.university.uni2 },
      ],
    },
  ],
};
