/** Static payloads so Cloudflare preview never waits on localhost:3001. */

import { mergeNodeMetadata } from './canvas/canvas-geometry';
import { DEMO_CRITERIA } from './readiness-demo';
import { MENTOR_DEMO_ALUMNUS, MENTOR_DEMO_EARNINGS, MENTOR_DEMO_MENTEES, mentorDemoRating } from './demo/mentor-world';
import { previewOrgApi } from './demo/org-api';
import { previewCommitmentsApi } from './demo/commitments-world';
import { previewSavedSearchesApi } from './demo/saved-searches-world';
import { previewVerificationApi } from './demo/verification-world';
import { previewUpdatesApi } from './demo/updates-world';
import { previewSavedItemsApi } from './demo/saved-items-world';
import { readDemoVisibility, writeDemoVisibility } from './demo/visibility-world';
import { previewOpenToApi } from './demo/open-to-world';
import { previewIntrosApi } from './demo/intros-world';
import { previewSkillEvidenceApi } from './demo/skill-evidence-world';
import { previewTransparencyApi } from './demo/transparency-world';
import { previewScoutApi } from './demo/scout-world';
import { addComposedPost } from './feed-demo';
import { heuristicConnections, heuristicExtract, heuristicQuestions, heuristicSynthesis, placeVariants } from '@cofounderbay/shared';
import type { FeedPost } from './api';
import { ORG, ORG_FOUNDERS, ORG_INVESTORS, ORG_MENTORS, ORG_SLUG, ORG_STAFF } from './demo/org-world';
import {
  harborApplicationDrafts,
  isStaleHarborApplicationBlob,
  mergeSavedApplications,
  PREVIEW_APPLICATION_SEED,
  requiredCompletion,
} from '@/components/builder/application-model';

const NOW = '2026-09-04T10:00:00.000Z';

// Declared first: module-level seeds (analytics, mentorships) read the demo
// clock while this file loads.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function previewClockOffsetMs(now: number = Date.now()): number {
  const weeks = Math.floor((now - Date.parse(NOW)) / WEEK_MS);
  return weeks > 0 ? weeks * WEEK_MS : 0;
}

/**
 * "Now" on the demo's own calendar. Records stamped at request time (a new
 * comment, an activity series ending today) use this, not Date.now(): every
 * payload is moved forward to the reader's week on the way out
 * (resolvePreviewApiNow), and a real-clock stamp would be moved with it into
 * the future.
 */
function previewNowMs(): number {
  return Date.now() - previewClockOffsetMs();
}

function seedPreviewGtmNodes() {
  const base = {
    boardId: 'board-gtm',
    url: null as string | null,
    uploadId: null as string | null,
    upload: null as unknown,
    zIndex: 1,
    collapsed: false,
    locked: false,
    refEntityType: null as string | null,
    refEntityId: null as string | null,
    builderDocumentId: null as string | null,
    metadata: null as unknown,
    tags: [] as string[],
    createdAt: NOW,
    updatedAt: NOW,
  };
  return [
    { ...base, id: 'n-gtm-problem', type: 'note', title: 'Problem', content: '<p>Founders waste weeks stitching matching, messaging, and fundraising tools. Early-stage founders feel it; today they cope with directories, spreadsheets, and chat threads.</p><p>Οι ιδρυτές χάνουν εβδομάδες ράβοντας εργαλεία matching, μηνυμάτων και χρηματοδότησης. Το νιώθουν ιδρυτές πρώιμου σταδίου· σήμερα το λύνουν με καταλόγους, spreadsheets και threads.</p>', posX: 80, posY: 80, width: 280, height: 200, color: '#FEF3C7' },
    { ...base, id: 'n-gtm-customer', type: 'note', title: 'Customer', content: '<p>Complementary cofounder searchers — technical + commercial pairs. Job: find a partner and turn the idea into shareable artefacts.</p><p>Αναζήτηση συμπληρωματικού συνιδρυτή — τεχνικό + εμπορικό ζεύγος. Εργασία: εύρεση συνεταίρου και μετατροπή της ιδέας σε παραδοτέα που μοιράζονται.</p>', posX: 400, posY: 80, width: 280, height: 200, color: '#DBEAFE' },
    { ...base, id: 'n-gtm-channel', type: 'note', title: 'Channels', content: '<p>Discover, matches, and shareable Builder docs. First path: founder networks in Athens and EU time zones, then mentor intros.</p><p>Discover, matches και παραδοτέα Builder που μοιράζονται. Πρώτη διαδρομή: δίκτυα ιδρυτών στην Αθήνα και ζώνες ΕΕ, μετά γνωριμίες με μέντορες.</p>', posX: 720, posY: 80, width: 280, height: 200, color: '#D1FAE5' },
    { ...base, id: 'n-gtm-offer', type: 'note', title: 'Offer', content: '<p>One workspace: graph + readiness + builder. First conversion: a filled Idea Core and a research board they can share.</p><p>Ένας χώρος εργασίας: γράφος + ετοιμότητα + builder. Πρώτη μετατροπή: συμπληρωμένος Πυρήνας ιδέας και πίνακας έρευνας που μοιράζεται.</p>', posX: 80, posY: 320, width: 280, height: 200, color: '#FCE7F3' },
    { ...base, id: 'n-gtm-comp', type: 'note', title: 'Competition', content: '<p>Direct: matching directories that stop at the intro. Indirect: spreadsheets and chat that stitch matching, messaging, and fundraising by hand.</p><p>Άμεσος: κατάλογοι matching που σταματούν στην εισαγωγή. Έμμεσος: spreadsheets και chat που ράβουν matching, μηνύματα και χρηματοδότηση στο χέρι.</p>', posX: 400, posY: 320, width: 280, height: 200, color: '#FEE2E2' },
    { ...base, id: 'n-gtm-metrics', type: 'note', title: 'Metrics', content: '<p>Seed: $375K committed of a $750K target. Lead: Athens Tech Angels.</p><p>Γύρος: $375K δεσμευμένα από στόχο $750K. Lead: Athens Tech Angels.</p>', posX: 720, posY: 320, width: 280, height: 200, color: '#EDE9FE' },
  ];
}

type PreviewGtmNode = ReturnType<typeof seedPreviewGtmNodes>[number];
type PreviewGtmConnector = {
  id: string;
  boardId: string;
  fromNodeId: string;
  toNodeId: string;
  label: string | null;
  color: string | null;
  style: string;
};

let previewGtmBoardNodes: PreviewGtmNode[] = seedPreviewGtmNodes();
let previewGtmConnectors: PreviewGtmConnector[] = [];
let previewGtmCanvasState: Record<string, unknown> = {};
let previewGtmRemoved = false;

/** Fast Refresh can keep the old generic GTM notes while `seedPreviewGtmNodes` already returns Harbor. */
const PREVIEW_GTM_LEGACY_SNIPPETS = [
  'Who experiences this, how painful is it',
  'Segment, jobs to be done, budget, and buying path',
  'Where will the first 100 customers find you',
  'Pricing, packaging, and the first conversion moment',
  'Direct, indirect, and the wedge you own',
  'Activation, retention, and the weekly number that proves GTM',
];

function applyHarborGtmSeedIfStale() {
  const seeded = seedPreviewGtmNodes();
  const seededIds = new Set(seeded.map((node) => node.id));
  let changed = false;
  previewGtmBoardNodes = previewGtmBoardNodes.map((node) => {
    const fresh = seeded.find((row) => row.id === node.id);
    if (!fresh) return node;
    const content = typeof node.content === 'string' ? node.content : '';
    if (!PREVIEW_GTM_LEGACY_SNIPPETS.some((snippet) => content.includes(snippet))) return node;
    changed = true;
    return { ...node, title: fresh.title, content: fresh.content, updatedAt: fresh.updatedAt };
  });
  for (const fresh of seeded) {
    if (previewGtmBoardNodes.some((node) => node.id === fresh.id)) continue;
    previewGtmBoardNodes = [...previewGtmBoardNodes, fresh];
    changed = true;
  }
  if (!previewGtmBoardNodes.some((node) => seededIds.has(node.id))) {
    previewGtmBoardNodes = [...seeded, ...previewGtmBoardNodes];
    changed = true;
  }
  if (changed || previewGtmMeta.description === 'Sample research board for the preview.') {
    previewGtmMeta = {
      ...previewGtmMeta,
      description: 'Harbor GTM notes aligned with Idea Core and the $750K seed.',
      icon: previewGtmMeta.icon === 'flask' ? 'sparkles' : previewGtmMeta.icon,
      updatedAt: new Date(previewNowMs()).toISOString(),
    };
  }
}
const ME_ID = 'preview-demo-user';
let previewGtmMeta: {
  title: string;
  description: string | null;
  visibility: string;
  tags: string[];
  color: string | null;
  icon: string | null;
  isPinned: boolean;
  isArchived: boolean;
  updatedAt: string;
} = {
  title: 'Go-to-market canvas',
  description: 'Harbor GTM notes aligned with Idea Core and the $750K seed.',
  visibility: 'private',
  tags: ['gtm'],
  color: '#6756dc',
  icon: 'sparkles',
  isPinned: true,
  isArchived: false,
  updatedAt: NOW,
};

function previewGtmSummary() {
  return {
    id: 'board-gtm',
    ownerId: ME_ID,
    title: previewGtmMeta.title,
    description: previewGtmMeta.description,
    visibility: previewGtmMeta.visibility,
    canvasState: Object.keys(previewGtmCanvasState).length ? previewGtmCanvasState : {},
    tags: previewGtmMeta.tags,
    color: previewGtmMeta.color,
    icon: previewGtmMeta.icon,
    isPinned: previewGtmMeta.isPinned,
    isArchived: previewGtmMeta.isArchived,
    nodeCount: previewGtmBoardNodes.length,
    createdAt: NOW,
    updatedAt: previewGtmMeta.updatedAt,
  };
}

function previewGtmBoardResponse() {
  if (previewGtmRemoved) return { board: null };
  applyHarborGtmSeedIfStale();
  return {
    board: {
      ...previewGtmSummary(),
      nodes: previewGtmBoardNodes,
      connectors: previewGtmConnectors,
    },
  };
}
type ExtraPreviewBoard = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  visibility: string;
  canvasState: Record<string, unknown>;
  tags: string[];
  color: string | null;
  icon: string | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: PreviewGtmNode[];
  connectors: PreviewGtmConnector[];
};

let previewExtraResearchBoards: ExtraPreviewBoard[] = [];

function previewStringTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
}

function summarizeExtraBoard(board: ExtraPreviewBoard) {
  return {
    id: board.id,
    ownerId: board.ownerId,
    title: board.title,
    description: board.description,
    visibility: board.visibility,
    canvasState: board.canvasState,
    tags: board.tags,
    color: board.color,
    icon: board.icon,
    isPinned: board.isPinned,
    isArchived: board.isArchived,
    nodeCount: board.nodes.length,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
  };
}

function listPreviewResearchBoardSummaries(archived: boolean) {
  applyHarborGtmSeedIfStale();
  const items = [
    ...(previewGtmRemoved ? [] : [previewGtmSummary()]),
    ...previewExtraResearchBoards.map(summarizeExtraBoard),
  ];
  return items.filter((board) => Boolean(board.isArchived) === archived);
}

function findExtraPreviewBoard(boardId: string) {
  return previewExtraResearchBoards.find((board) => board.id === boardId);
}

function extraBoardResponse(board: ExtraPreviewBoard) {
  return {
    board: {
      ...summarizeExtraBoard(board),
      nodes: board.nodes,
      connectors: board.connectors,
    },
  };
}

function makePreviewResearchNode(boardId: string, body: Record<string, unknown>): PreviewGtmNode {
  const now = new Date(previewNowMs()).toISOString();
  return {
    id: `n-preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    boardId,
    url: null,
    uploadId: null,
    upload: null,
    zIndex: typeof body.zIndex === 'number' ? body.zIndex : 1,
    collapsed: body.collapsed === true,
    locked: body.locked === true,
    refEntityType: typeof body.refEntityType === 'string' ? body.refEntityType : null,
    refEntityId: typeof body.refEntityId === 'string' ? body.refEntityId : null,
    builderDocumentId: typeof body.builderDocumentId === 'string' ? body.builderDocumentId : null,
    metadata: body.metadata ?? null,
    tags: previewStringTags(body.tags),
    createdAt: now,
    updatedAt: now,
    type: typeof body.type === 'string' ? body.type : 'note',
    title: typeof body.title === 'string' ? body.title : 'Note',
    content: typeof body.content === 'string' ? body.content : '',
    posX: typeof body.posX === 'number' ? body.posX : 80,
    posY: typeof body.posY === 'number' ? body.posY : 80,
    width: typeof body.width === 'number' ? body.width : 280,
    height: typeof body.height === 'number' ? body.height : 200,
    color: (typeof body.color === 'string' ? body.color : null) as unknown as string,
  };
}

function applyPreviewNodePatch(node: PreviewGtmNode, body: Record<string, unknown>): PreviewGtmNode {
  const incomingContent = typeof body.content === 'string' ? body.content : undefined;
  const content = incomingContent
    && PREVIEW_GTM_LEGACY_SNIPPETS.some((snippet) => incomingContent.includes(snippet))
    ? seedPreviewGtmNodes().find((row) => row.id === node.id)?.content ?? incomingContent
    : incomingContent;
  return {
    ...node,
    ...(typeof body.title === 'string' ? { title: body.title } : {}),
    ...(typeof content === 'string' ? { content } : {}),
    ...(typeof body.url === 'string' || body.url === null ? { url: body.url as string | null } : {}),
    ...(typeof body.posX === 'number' ? { posX: body.posX } : {}),
    ...(typeof body.posY === 'number' ? { posY: body.posY } : {}),
    ...(typeof body.width === 'number' ? { width: body.width } : {}),
    ...(typeof body.height === 'number' ? { height: body.height } : {}),
    ...(typeof body.zIndex === 'number' ? { zIndex: body.zIndex } : {}),
    ...(typeof body.color === 'string' || body.color === null ? { color: body.color as string } : {}),
    ...(typeof body.collapsed === 'boolean' ? { collapsed: body.collapsed } : {}),
    ...(typeof body.locked === 'boolean' ? { locked: body.locked } : {}),
    ...(body.metadata !== undefined ? { metadata: mergeNodeMetadata(node.metadata, body.metadata) } : {}),
    ...(Array.isArray(body.tags) ? { tags: previewStringTags(body.tags) } : {}),
    ...(typeof body.builderDocumentId === 'string' || body.builderDocumentId === null
      ? { builderDocumentId: body.builderDocumentId as string | null }
      : {}),
    updatedAt: new Date(previewNowMs()).toISOString(),
  };
}

function applyPreviewNodeBatch(nodes: PreviewGtmNode[], updates: unknown[]): PreviewGtmNode[] {
  return nodes.map((node) => {
    const patch = updates.find((row) => row && typeof row === 'object' && (row as { id?: string }).id === node.id) as Record<string, unknown> | undefined;
    if (!patch) return node;
    return {
      ...node,
      posX: typeof patch.posX === 'number' ? patch.posX : node.posX,
      posY: typeof patch.posY === 'number' ? patch.posY : node.posY,
      width: typeof patch.width === 'number' ? patch.width : node.width,
      height: typeof patch.height === 'number' ? patch.height : node.height,
      zIndex: typeof patch.zIndex === 'number' ? patch.zIndex : node.zIndex,
      updatedAt: new Date(previewNowMs()).toISOString(),
    };
  });
}

function applyPreviewBoardMeta<T extends {
  title: string;
  description: string | null;
  visibility: string;
  tags: string[];
  color: string | null;
  icon: string | null;
  isPinned: boolean;
  isArchived: boolean;
  updatedAt: string;
}>(target: T, body: Record<string, unknown>, stamp: string): T {
  return {
    ...target,
    ...(typeof body.title === 'string' ? { title: body.title } : {}),
    ...(typeof body.description === 'string' || body.description === null ? { description: body.description as string | null } : {}),
    ...(typeof body.visibility === 'string' ? { visibility: body.visibility } : {}),
    ...(Array.isArray(body.tags) ? { tags: previewStringTags(body.tags) } : {}),
    ...(typeof body.color === 'string' || body.color === null ? { color: body.color as string | null } : {}),
    ...(typeof body.icon === 'string' || body.icon === null ? { icon: body.icon as string | null } : {}),
    ...(typeof body.isPinned === 'boolean' ? { isPinned: body.isPinned } : {}),
    ...(typeof body.isArchived === 'boolean' ? { isArchived: body.isArchived } : {}),
    updatedAt: stamp,
  };
}

function patchPreviewConnector(connector: PreviewGtmConnector, body: Record<string, unknown>): PreviewGtmConnector {
  return {
    ...connector,
    label: typeof body.label === 'string' ? body.label : connector.label,
    color: typeof body.color === 'string' ? body.color : connector.color,
    style: typeof body.style === 'string' ? body.style : connector.style,
  };
}

type PreviewResearchComment = {
  id: string;
  nodeId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  commentType: string;
  resolved: boolean;
  posX: number | null;
  posY: number | null;
  parentId: string | null;
  author: { id: string; displayName: string; avatarUrl?: string };
  createdAt: string;
  updatedAt: string;
};

let previewResearchComments: PreviewResearchComment[] = [];

function makePreviewResearchComment(nodeId: string, body: Record<string, unknown>): PreviewResearchComment {
  const now = new Date(previewNowMs()).toISOString();
  return {
    id: `preview-cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nodeId,
    authorId: ME_ID,
    authorName: 'Alex Demo',
    authorAvatar: null,
    body: typeof body.body === 'string' ? body.body : '',
    commentType: typeof body.commentType === 'string' ? body.commentType : 'general',
    resolved: false,
    posX: typeof body.posX === 'number' ? body.posX : null,
    posY: typeof body.posY === 'number' ? body.posY : null,
    parentId: typeof body.parentId === 'string' ? body.parentId : null,
    author: { id: ME_ID, displayName: 'Alex Demo' },
    createdAt: now,
    updatedAt: now,
  };
}

const PREVIEW_AI_CONVERSATIONS: Array<{
  id: string;
  userId: string;
  agentId: string;
  title: string;
  messages: unknown[];
  createdAt: string;
  updatedAt: string;
}> = [];

const PREVIEW_BUILDER_WS_ID = 'preview-ws-harbor';

type PreviewBuilderDoc = {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  description?: string;
  content: Record<string, unknown>;
  status: 'draft' | 'in_progress' | 'review' | 'approved' | 'archived';
  completionPercent: number;
  aiGenerated: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

let previewBuilderDocs: PreviewBuilderDoc[] = [
  {
    id: 'preview-doc-idea',
    workspaceId: PREVIEW_BUILDER_WS_ID,
    type: 'idea_core',
    title: 'Idea Core',
    description: 'Problem, audience, and unique value — sample for preview.',
    content: {
      problemStatement: 'Founders waste weeks stitching matching, messaging, and fundraising tools.',
      targetAudience: 'Early-stage founders looking for a complementary cofounder',
      solution: 'One workspace that matches people and turns the idea into artifacts.',
      uniqueValue: 'Graph + readiness + builder in the same product',
    },
    status: 'in_progress',
    // What the Idea Core stage computes from this content: four of its eight fields.
    completionPercent: 50,
    aiGenerated: false,
    version: 2,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preview-doc-bmc',
    workspaceId: PREVIEW_BUILDER_WS_ID,
    type: 'business_model_canvas',
    title: 'Business Model Canvas',
    description: 'Draft canvas — sample for preview.',
    content: {
      valueProposition: 'Faster path from idea to a shareable plan',
    },
    status: 'draft',
    // One of the canvas's nine blocks.
    completionPercent: 11,
    aiGenerated: false,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preview-doc-market',
    workspaceId: PREVIEW_BUILDER_WS_ID,
    type: 'market_analysis',
    title: 'Market Analysis',
    description: 'Sizing and positioning — sample for preview.',
    content: {
      tam: {
        value: '',
        description: 'Early-stage founder tooling — matching, messaging, and fundraising in one category.',
        sources: '',
      },
    },
    status: 'draft',
    completionPercent: 0,
    aiGenerated: false,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preview-doc-pitch',
    workspaceId: PREVIEW_BUILDER_WS_ID,
    type: 'pitch_deck',
    title: 'Pitch Deck',
    description: 'Investor deck — sample for preview.',
    content: {
      deckType: 'investor',
      companyName: 'Harbor',
      tagline: 'The operating system for early-stage founders.',
      askAmount: '$750,000',
      useOfFunds: [],
      slides: [
        {
          id: 'slide-cover',
          type: 'cover',
          title: 'Cover',
          content: 'Harbor\n\nThe operating system for early-stage founders.',
          notes: '',
          order: 0,
        },
        {
          id: 'slide-problem',
          type: 'problem',
          title: 'Problem',
          content: 'Founders waste weeks stitching matching, messaging, and fundraising tools.',
          notes: '',
          order: 1,
        },
      ],
    },
    status: 'in_progress',
    completionPercent: 17,
    aiGenerated: false,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preview-doc-application',
    workspaceId: PREVIEW_BUILDER_WS_ID,
    type: 'application',
    title: 'Program applications',
    description: 'YC, Techstars, university, and grant drafts — sample for preview.',
    content: { ...PREVIEW_APPLICATION_SEED },
    status: 'in_progress',
    completionPercent: previewApplicationCompletionPercent(),
    aiGenerated: false,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

type PreviewDocVersion = {
  id: string;
  documentId: string;
  version: number;
  versionLabel: string | null;
  changesSummary: string | null;
  createdAt: string;
  changedById: string | null;
  changedBy: { id: string; displayName: string; avatarUrl?: string | null } | null;
  content: Record<string, unknown>;
};

const PREVIEW_IDEA_V1 = {
  problemStatement: 'Founders waste weeks stitching matching, messaging, and fundraising tools.',
  targetAudience: 'Early-stage founders looking for a complementary cofounder',
};

const PREVIEW_IDEA_V2 = {
  ...PREVIEW_IDEA_V1,
  solution: 'One workspace that matches people and turns the idea into artifacts.',
  uniqueValue: 'Graph + readiness + builder in the same product',
};

const PREVIEW_PITCH_V1 = {
  deckType: 'investor',
  companyName: 'Harbor',
  tagline: 'The operating system for early-stage founders.',
  askAmount: '$750,000',
  useOfFunds: [] as string[],
  slides: [
    {
      id: 'slide-cover',
      type: 'cover',
      title: 'Cover',
      content: 'Harbor\n\nThe operating system for early-stage founders.',
      notes: '',
      order: 0,
    },
    {
      id: 'slide-problem',
      type: 'problem',
      title: 'Problem',
      content: 'Founders waste weeks stitching matching, messaging, and fundraising tools.',
      notes: '',
      order: 1,
    },
  ],
};

/** Empty-slide fill only on the client. Numbers match Harbor Idea Core, Market, and the $750K seed. */
const PREVIEW_PITCH_GENERATE = {
  companyName: 'Harbor',
  tagline: 'Graph + readiness + builder in the same product',
  askAmount: '$750,000',
  useOfFunds: [
    'Product (40%) — matching, artefacts, and readiness in one workspace',
    'Go-to-market (30%) — founders who already sit in the graph',
    'Team (20%) — complementary hires around the founder OS',
    'Operations (10%) — infrastructure and legal for the seed',
  ],
  slides: [
    {
      id: 'gen-cover',
      type: 'cover',
      title: 'Cover',
      content: 'Harbor\n\nThe operating system for early-stage founders.',
      notes: 'Name, line, why now. Five seconds.',
      order: 0,
    },
    {
      id: 'gen-problem',
      type: 'problem',
      title: 'Problem',
      content: 'Founders waste weeks stitching matching, messaging, and fundraising tools.',
      notes: 'Stay with the Idea Core problem.',
      order: 1,
    },
    {
      id: 'gen-solution',
      type: 'solution',
      title: 'Solution',
      content: 'One workspace that matches people and turns the idea into artifacts.',
      notes: 'Same sentence as Idea Core. Show the workspace, do not add a second product.',
      order: 2,
    },
    {
      id: 'gen-market',
      type: 'market',
      title: 'Market',
      content:
        'TAM: $4B — founder tooling; matching, messaging, and fundraising in one category.\nSAM: $400M — early-stage matching and workspace tools.\nSOM: $12M — first three years among complementary-cofounder searches.',
      notes: 'Same TAM/SAM/SOM as Market Analysis. Investors will check the round page.',
      order: 3,
    },
    {
      id: 'gen-product',
      type: 'product',
      title: 'Product',
      content:
        '• Matching on the founder graph\n• Builder artefacts in the same workspace\n• Readiness scoring attached to the drafts\n• Expert review on those drafts, not a separate stack',
      notes: 'Walk the workspace. Cover, problem, and ask are already on the page.',
      order: 4,
    },
    {
      id: 'gen-traction',
      type: 'traction',
      title: 'Traction',
      content:
        'Seed in progress: $375K committed of a $750K target.\nLead: Athens Tech Angels.',
      notes: 'Same raised and target as Fundraising.',
      order: 5,
    },
    {
      id: 'gen-bmc',
      type: 'business-model',
      title: 'Business Model',
      content: 'Subscriptions and paid expert reviews on drafts — a faster path from idea to a shareable plan.',
      notes: 'BMC value proposition plus revenue streams. Keep it to what the canvas already says.',
      order: 6,
    },
    {
      id: 'gen-comp',
      type: 'competition',
      title: 'Competition',
      content:
        'Direct: standalone matching directories that stop at the intro.\nIndirect: spreadsheets and chat threads that stitch matching, messaging, and fundraising by hand.\nHarbor keeps the graph, the artefacts, and readiness in one product.',
      notes: 'Same competitors as Market Analysis.',
      order: 7,
    },
    {
      id: 'gen-team',
      type: 'team',
      title: 'Team',
      content: 'Elena Papadopoulos — Founder & CEO at Harbor.',
      notes: 'Only people who already exist in this workspace.',
      order: 8,
    },
    {
      id: 'gen-fin',
      type: 'financials',
      title: 'Financials',
      content: 'Seed: $750,000 SAFE.\nCommitted: $375K.\nRunway target: 18–24 months from this round.',
      notes: 'Same target and raised amount as the Harbor seed round.',
      order: 9,
    },
    {
      id: 'gen-ask',
      type: 'ask',
      title: 'The Ask',
      content:
        'Raising: $750,000 seed (SAFE).\nUse of funds:\n• Product (40%)\n• Go-to-market (30%)\n• Team (20%)\n• Operations (10%)',
      notes: 'The ask field on this deck is $750,000 — the same figure as Fundraising.',
      order: 10,
    },
    {
      id: 'gen-close',
      type: 'closing',
      title: 'Closing',
      content: 'Harbor\n\nGraph + readiness + builder in the same product.\n\nLet’s build the next artefact together.',
      notes: 'Repeat the name and the unique value. Leave a next step, not a new claim.',
      order: 11,
    },
  ],
};

let previewDocVersions: PreviewDocVersion[] = [
  {
    id: 'preview-ver-idea-1',
    documentId: 'preview-doc-idea',
    version: 1,
    versionLabel: 'v1',
    changesSummary: 'First draft — problem and audience.',
    createdAt: NOW,
    changedById: ME_ID,
    changedBy: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null },
    content: PREVIEW_IDEA_V1,
  },
  {
    id: 'preview-ver-idea-2',
    documentId: 'preview-doc-idea',
    version: 2,
    versionLabel: 'v2',
    changesSummary: 'Added solution and unique value.',
    createdAt: NOW,
    changedById: ME_ID,
    changedBy: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null },
    content: PREVIEW_IDEA_V2,
  },
  {
    id: 'preview-ver-bmc-1',
    documentId: 'preview-doc-bmc',
    version: 1,
    versionLabel: 'v1',
    changesSummary: 'Draft value proposition.',
    createdAt: NOW,
    changedById: ME_ID,
    changedBy: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null },
    content: {
      valueProposition: 'Faster path from idea to a shareable plan',
    },
  },
  {
    id: 'preview-ver-market-1',
    documentId: 'preview-doc-market',
    version: 1,
    versionLabel: 'v1',
    changesSummary: 'Draft market notes.',
    createdAt: NOW,
    changedById: ME_ID,
    changedBy: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null },
    content: {
      tam: {
        value: '',
        description: 'Early-stage founder tooling — matching, messaging, and fundraising in one category.',
        sources: '',
      },
    },
  },
  {
    id: 'preview-ver-pitch-1',
    documentId: 'preview-doc-pitch',
    version: 1,
    versionLabel: 'v1',
    changesSummary: 'First draft — cover, problem, Harbor ask.',
    createdAt: NOW,
    changedById: ME_ID,
    changedBy: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null },
    content: PREVIEW_PITCH_V1,
  },
  {
    id: 'preview-ver-application-1',
    documentId: 'preview-doc-application',
    version: 1,
    versionLabel: 'v1',
    changesSummary: 'First draft — Harbor YC and university answers.',
    createdAt: NOW,
    changedById: ME_ID,
    changedBy: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null },
    content: { ...PREVIEW_APPLICATION_SEED },
  },
];

function listPreviewVersions(documentId: string) {
  return previewDocVersions
    .filter((row) => row.documentId === documentId)
    .sort((a, b) => b.version - a.version)
    .map(({ content: _content, ...rest }) => rest);
}

function previewApplicationCompletionPercent(): number {
  const apps = mergeSavedApplications(PREVIEW_APPLICATION_SEED);
  return apps.length
    ? Math.round(apps.reduce((sum, app) => sum + requiredCompletion(app), 0) / apps.length)
    : 0;
}

function ensurePreviewApplicationDoc() {
  const found = previewBuilderDocs.find((d) => d.type === 'application');
  const seedDoc: PreviewBuilderDoc = {
    id: 'preview-doc-application',
    workspaceId: PREVIEW_BUILDER_WS_ID,
    type: 'application',
    title: 'Program applications',
    description: 'YC, Techstars, university, and grant drafts — sample for preview.',
    content: { ...PREVIEW_APPLICATION_SEED },
    status: 'in_progress',
    completionPercent: previewApplicationCompletionPercent(),
    aiGenerated: false,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
  if (!found) {
    previewBuilderDocs = [...previewBuilderDocs, seedDoc];
    return;
  }
  if (isStaleHarborApplicationBlob(JSON.stringify(found.content ?? {}))) {
    previewBuilderDocs = previewBuilderDocs.map((d) =>
      d.id === found.id
        ? {
            ...d,
            title: seedDoc.title,
            description: seedDoc.description,
            content: seedDoc.content,
            status: seedDoc.status,
            completionPercent: seedDoc.completionPercent,
          }
        : d,
    );
  }
}

const PREVIEW_BUILDER_COLLABORATORS = [
  {
    id: 'preview-collab-owner',
    userId: ME_ID,
    role: 'owner',
    isActive: true,
    invitedAt: NOW,
    acceptedAt: NOW,
    user: {
      id: ME_ID,
      displayName: 'Alex Demo',
      email: 'demo@cofounderbay.com',
    },
  },
];

/**
 * The recommendation each dimension carries when it is not yet done. These are
 * the Builder's own advice, keyed by dimension so they survive the scores being
 * derived rather than written out.
 */
const BUILDER_READINESS_ADVICE: Record<string, string> = {
  team: 'Complete cofounder search on Discover',
  market: 'Run 5 customer interviews',
  product: 'Scope an MVP in Planner',
  business: 'Fill the Business Model Canvas',
  funding: 'Start a 10-slide pitch deck',
  execution: 'Set the next 30-day milestone',
};

/** The same bands /readiness colours its dimension chips with. */
function readinessStatus(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 40) return 'needs-work';
  return 'critical';
}

/**
 * Scored from DEMO_CRITERIA rather than written out again.
 *
 * This payload used to carry its own six numbers, which disagreed with the six
 * /readiness computes from the criteria - two answers to one question, a click
 * apart, under a link labelled "full readiness report". A dimension's score is
 * the weight of its completed criteria, which is exactly how the real endpoint
 * scores it, so the Builder and the report now move together.
 */
const PREVIEW_BUILDER_DIMENSIONS = Object.entries(DEMO_CRITERIA).map(([dimension, criteria]) => {
  const score = criteria.reduce((sum, c) => sum + (c.completed ? c.weight : 0), 0);
  return {
    dimension,
    score,
    maxScore: 100,
    status: readinessStatus(score),
    criteria: criteria.map((c) => ({ id: c.id, name: c.name, completed: c.completed, weight: c.weight })),
    recommendations: score >= 100 ? [] : [BUILDER_READINESS_ADVICE[dimension]].filter(Boolean),
  };
});

const PREVIEW_BUILDER_OVERALL = Math.round(
  PREVIEW_BUILDER_DIMENSIONS.reduce((sum, d) => sum + d.score, 0) /
    (PREVIEW_BUILDER_DIMENSIONS.length || 1),
);

const READINESS_AUDIENCE_WEIGHTS: Record<string, { accelerator: number; investor: number }> = {
  team: { accelerator: 25, investor: 30 },
  market: { accelerator: 20, investor: 25 },
  product: { accelerator: 20, investor: 20 },
  business: { accelerator: 15, investor: 15 },
  funding: { accelerator: 10, investor: 5 },
  execution: { accelerator: 10, investor: 5 },
};

function previewAudienceScore(audience: 'accelerator' | 'investor'): number {
  const weightSum = PREVIEW_BUILDER_DIMENSIONS.reduce(
    (sum, d) => sum + (READINESS_AUDIENCE_WEIGHTS[d.dimension]?.[audience] ?? 0),
    0,
  );
  if (!weightSum) return 0;
  return Math.round(
    (PREVIEW_BUILDER_DIMENSIONS.reduce((sum, d) => {
      const w = READINESS_AUDIENCE_WEIGHTS[d.dimension]?.[audience] ?? 0;
      return sum + (d.score / (d.maxScore || 100)) * w;
    }, 0) /
      weightSum) *
      100,
  );
}

/** Same nested `assessment` envelope the Nest assess endpoint returns. */
const PREVIEW_BUILDER_ASSESSMENT = {
  overallScore: PREVIEW_BUILDER_OVERALL,
  overallMax: 100,
  dimensions: PREVIEW_BUILDER_DIMENSIONS,
  lastAssessedAt: NOW,
  acceleratorReadiness: previewAudienceScore('accelerator'),
  investorReadiness: previewAudienceScore('investor'),
};

const PREVIEW_BUILDER_READINESS = {
  workspaceId: PREVIEW_BUILDER_WS_ID,
  overallScore: PREVIEW_BUILDER_OVERALL,
  overallStatus: readinessStatus(PREVIEW_BUILDER_OVERALL),
  readinessLevel:
    PREVIEW_BUILDER_OVERALL >= 80 ? 'ready' : PREVIEW_BUILDER_OVERALL >= 55 ? 'developing' : 'early',
  dimensions: PREVIEW_BUILDER_DIMENSIONS,
  assessment: PREVIEW_BUILDER_ASSESSMENT,
  // Named from criteria that are actually still open, so the blockers cannot
  // outlive the work they describe.
  blockers: [
    ...(DEMO_CRITERIA.market ?? [])
      .filter((c) => !c.completed && /interview/i.test(c.name))
      .map(() => 'No customer interviews logged yet'),
    ...(DEMO_CRITERIA.business ?? [])
      .filter((c) => !c.completed && /pricing|unit economics/i.test(c.name))
      .slice(0, 1)
      .map(() => 'Business model still a draft'),
  ],
  nextMilestones: [
    'Finish Idea Core problem and unique value',
    'Draft BMC value proposition and channels',
    'Book 5 discovery interviews',
  ],
  assessedAt: NOW,
};

type PreviewMilestone = {
  id: string;
  ownerId: string;
  collaboratorId: string | null;
  collaborator: { id: string; displayName: string; avatarUrl: string | null } | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  category: string | null;
  dueDate: string | null;
  completedAt: string | null;
  progress: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};


let previewMilestones: PreviewMilestone[] = [];

function previewMilestoneSummary() {
  const counts = { todo: 0, in_progress: 0, blocked: 0, completed: 0, cancelled: 0 };
  let overdue = 0;
  let dueSoon = 0;
  const now = previewNowMs();
  const soon = now + 7 * 24 * 60 * 60 * 1000;
  for (const m of previewMilestones) {
    counts[m.status] = (counts[m.status] ?? 0) + 1;
    if (m.dueDate && m.status !== 'completed' && m.status !== 'cancelled') {
      const due = new Date(m.dueDate).getTime();
      if (due < now) overdue += 1;
      else if (due <= soon) dueSoon += 1;
    }
  }
  const total = previewMilestones.length;
  return {
    counts,
    total,
    overdue,
    dueSoon,
    completionRate: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
  };
}

function previewBuilderWorkspace() {
  ensurePreviewApplicationDoc();
  return {
    id: PREVIEW_BUILDER_WS_ID,
    name: 'Harbor',
    slug: 'harbor',
    description: 'Sample workspace — preview demo, not live founder data.',
    status: 'active',
    visibility: 'private',
    startupName: 'Harbor',
    industry: 'SaaS',
    stage: 'pre-seed',
    targetMarket: 'Early-stage founders',
    createdAt: NOW,
    updatedAt: NOW,
    owner: {
      id: ME_ID,
      displayName: 'Alex Demo',
    },
    documentCount: previewBuilderDocs.length,
    collaboratorCount: PREVIEW_BUILDER_COLLABORATORS.length,
    overallReadiness: PREVIEW_BUILDER_READINESS.overallScore,
    documents: previewBuilderDocs,
    collaborators: PREVIEW_BUILDER_COLLABORATORS,
  };
}

/**
 * The demo people's roles and schools, for the profile's Experience and
 * Education sections. Companies are the demo world's own (Harbor, Taverna OS,
 * Orion Grid, Aegean Lab, Meridian); schools are invented.
 */
const DEMO_HISTORY: Record<string, { experience: Array<{ title: string; company: string; start: string; end: string }>; education: Array<{ school: string; degree: string; start: string; end: string }> }> = {
  'user-elena': {
    experience: [
      { title: 'Founder & CEO', company: 'Harbor', start: '2024', end: '' },
      { title: 'Head of Product', company: 'Aegean Lab', start: '2020', end: '2024' },
      { title: 'Product manager', company: 'Meltemi', start: '2017', end: '2020' },
    ],
    education: [{ school: 'Pnyx School of Business', degree: 'MSc Management', start: '2015', end: '2017' }],
  },
  'user-marcus': {
    experience: [
      { title: 'Technical co-founder', company: 'Taverna OS', start: '2023', end: '' },
      { title: 'Senior engineer', company: 'Orion Grid', start: '2019', end: '2023' },
    ],
    education: [{ school: 'Spree Institute of Computing', degree: 'BSc Computer Science', start: '2013', end: '2017' }],
  },
  'user-sarah': {
    experience: [
      { title: 'Startup mentor', company: 'Aegean Lab', start: '2021', end: '' },
      { title: 'Founder (three companies)', company: 'Independent', start: '2010', end: '2021' },
    ],
    education: [],
  },
  'user-nikos': {
    experience: [
      { title: 'Angel investor', company: 'Independent', start: '2018', end: '' },
      { title: 'Partner', company: 'Meridian Deep Tech Fund', start: '2013', end: '2018' },
    ],
    education: [],
  },
};

const PEOPLE = [
  {
    id: 'hit-elena',
    userId: 'user-elena',
    displayName: 'Elena Papadopoulos',
    headline: 'Founder & CEO at Harbor',
    bio: 'Building the operating system for early-stage founders.',
    avatarUrl: null,
    location: 'Athens, Greece',
    role: 'founder',
    skillNames: ['Product', 'Growth', 'Fundraising'],
    skills: ['Product', 'Growth'],
    industries: ['SaaS'],
    matchScore: 92,
    matchReasons: ['Complementary skills', 'Same stage'],
    lookingFor: 'technical cofounder',
    availability: 'full-time',
    lastSeenSecondsAgo: 120,
    joinedAt: '2026-02-11T09:00:00.000Z',
  },
  {
    id: 'hit-marcus',
    userId: 'user-marcus',
    displayName: 'Marcus Chen',
    headline: 'Technical cofounder · Full-stack',
    bio: 'Ships MVPs in weeks. Looking for a complementary founder.',
    avatarUrl: null,
    location: 'Berlin, Germany',
    role: 'cofounder',
    skillNames: ['TypeScript', 'Next.js', 'AI'],
    skills: ['TypeScript', 'AI'],
    industries: ['Developer tools'],
    matchScore: 88,
    matchReasons: ['Skills overlap', 'Active this week'],
    lookingFor: 'business cofounder',
    availability: 'full-time',
    lastSeenSecondsAgo: 240,
    joinedAt: '2026-06-03T09:00:00.000Z',
  },
  {
    id: 'hit-sarah',
    userId: 'user-sarah',
    displayName: 'Dr. Sarah Kim',
    headline: 'Startup mentor · Ex-Google · 3x founder',
    bio: 'Helping first-time founders reach product-market fit.',
    avatarUrl: null,
    location: 'London, UK',
    role: 'mentor',
    skillNames: ['Mentoring', 'Go-to-market', 'Leadership'],
    skills: ['Mentoring', 'GTM'],
    industries: ['Marketplace'],
    matchScore: 81,
    matchReasons: ['Mentor match'],
    lookingFor: 'mentees',
    availability: 'part-time',
    lastSeenSecondsAgo: 9000,
    joinedAt: '2025-11-22T09:00:00.000Z',
  },
  {
    id: 'hit-nikos',
    userId: 'user-nikos',
    displayName: 'Nikos Andreou',
    headline: 'Angel investor · Seed',
    bio: 'Invests in Mediterranean B2B SaaS at pre-seed and seed.',
    avatarUrl: null,
    location: 'Limassol, Cyprus',
    role: 'investor',
    skillNames: ['Investing', 'Networks'],
    skills: ['Investing'],
    industries: ['Fintech', 'SaaS'],
    matchScore: 76,
    matchReasons: ['Stage fit'],
    lookingFor: 'deal flow',
    availability: 'flexible',
    // The API filters `investmentStages` on the role payload's `stages`.
    investmentStages: ['pre-seed', 'seed'],
    lastSeenSecondsAgo: null,
    joinedAt: '2026-09-01T09:00:00.000Z',
  },
];

const SHORTLIST_IDS = new Set<string>(['user-marcus']);

const CONVERSATIONS = [
  {
    id: 'conv-elena',
    type: 'direct' as const,
    recipient: {
      id: 'user-elena',
      displayName: 'Elena Papadopoulos',
      headline: 'Founder & CEO at Harbor',
      avatarUrl: null,
      role: 'founder',
      isOnline: true,
      lastSeenAt: NOW,
    },
    lastMessage: {
      id: 'msg-elena-2',
      body: 'Want to compare notes on the research canvas this week?',
      senderId: 'user-elena',
      createdAt: NOW,
    },
    unreadCount: 1,
    isPinned: true,
    isArchived: false,
    updatedAt: NOW,
  },
  {
    id: 'conv-marcus',
    type: 'direct' as const,
    recipient: {
      id: 'user-marcus',
      displayName: 'Marcus Chen',
      headline: 'Technical cofounder',
      avatarUrl: null,
      role: 'cofounder',
      isOnline: false,
      lastSeenAt: '2026-09-03T18:20:00.000Z',
    },
    lastMessage: {
      id: 'msg-marcus-1',
      body: 'I sketched a Next.js + Nest starter we can reuse.',
      senderId: ME_ID,
      createdAt: '2026-09-03T18:20:00.000Z',
    },
    unreadCount: 0,
    isPinned: false,
    isArchived: false,
    updatedAt: '2026-09-03T18:20:00.000Z',
  },
];

const MESSAGES: Record<string, Array<Record<string, unknown>>> = {
  'conv-elena': [
    {
      id: 'msg-elena-1',
      conversationId: 'conv-elena',
      senderId: ME_ID,
      body: 'Loved your Harbor update — the founder OS angle is sharp.',
      createdAt: '2026-09-03T16:00:00.000Z',
      sender: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null, role: 'founder' },
      attachments: [],
    },
    {
      id: 'msg-elena-2',
      conversationId: 'conv-elena',
      senderId: 'user-elena',
      body: 'Want to compare notes on the research canvas this week?',
      createdAt: NOW,
      sender: { id: 'user-elena', displayName: 'Elena Papadopoulos', avatarUrl: null, role: 'founder' },
      attachments: [],
    },
  ],
  'conv-marcus': [
    {
      id: 'msg-marcus-1',
      conversationId: 'conv-marcus',
      senderId: ME_ID,
      body: 'I sketched a Next.js + Nest starter we can reuse.',
      createdAt: '2026-09-03T18:20:00.000Z',
      sender: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null, role: 'founder' },
      attachments: [],
    },
  ],
};

const CONNECTIONS = [
  {
    id: 'conn-elena',
    requesterId: 'user-elena',
    receiverId: ME_ID,
    status: 'pending',
    message: 'Would love to swap intros in the Athens founder circle.',
    createdAt: NOW,
    updatedAt: NOW,
    requester: {
      id: 'user-elena',
      displayName: 'Elena Papadopoulos',
      avatarUrl: null,
      role: 'founder',
      headline: 'Founder & CEO at Harbor',
    },
    receiver: {
      id: ME_ID,
      displayName: 'Alex Demo',
      avatarUrl: null,
      role: 'founder',
      headline: 'Founder exploring CoFounderBay',
    },
  },
  {
    id: 'conn-sarah',
    requesterId: ME_ID,
    receiverId: 'user-sarah',
    status: 'accepted',
    message: 'Could we book a mentoring intro?',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-02T09:00:00.000Z',
    requester: {
      id: ME_ID,
      displayName: 'Alex Demo',
      avatarUrl: null,
      role: 'founder',
      headline: 'Founder exploring CoFounderBay',
    },
    receiver: {
      id: 'user-sarah',
      displayName: 'Dr. Sarah Kim',
      avatarUrl: null,
      role: 'mentor',
      headline: 'Startup mentor · Ex-Google',
    },
  },
];

const NOTIFICATIONS = [
  {
    id: 'notif-1',
    type: 'connection',
    title: 'Elena Papadopoulos sent a connection request',
    body: 'Would love to swap intros in the Athens founder circle.',
    link: '/connections',
    meta: {},
    createdAt: NOW,
    readAt: null,
  },
  {
    id: 'notif-2',
    type: 'message',
    title: 'New message from Elena Papadopoulos',
    body: 'Want to compare notes on the research canvas this week?',
    link: '/messages',
    meta: {},
    createdAt: NOW,
    readAt: null,
  },
  {
    id: 'notif-3',
    type: 'match',
    title: '3 new cofounder matches',
    body: 'Marcus Chen is an 88% match.',
    link: '/matches',
    meta: {},
    createdAt: '2026-09-03T08:00:00.000Z',
    readAt: '2026-09-03T09:00:00.000Z',
  },
];

const FEED_POSTS = [
  {
    id: 'post-1',
    author: {
      id: 'user-elena',
      displayName: 'Elena Papadopoulos',
      headline: 'Founder & CEO at Harbor',
      role: 'founder',
    },
    type: 'milestone',
    content: 'Athens Tech Angels committed $375K to the Harbor seed. Next: the remaining $375K and a complementary cofounder.',
    likes: 47,
    comments: 12,
    shares: 5,
    isLiked: false,
    isBookmarked: false,
    createdAt: NOW,
    tags: ['fundraising', 'seed'],
  },
  {
    id: 'post-2',
    author: {
      id: 'user-marcus',
      displayName: 'Marcus Chen',
      headline: 'Technical cofounder',
      role: 'cofounder',
    },
    type: 'question',
    content: 'What is your go-to stack for MVPs in 2026 — Next.js + Nest or something leaner?',
    likes: 23,
    comments: 31,
    shares: 2,
    isLiked: true,
    isBookmarked: true,
    createdAt: '2026-09-03T08:15:00.000Z',
    tags: ['tech', 'mvp'],
  },
];

const ME_PROFILE = {
  profile: {
    id: 'preview-demo-profile',
    userId: ME_ID,
    displayName: 'Alex Demo',
    headline: 'Founder exploring CoFounderBay',
    bio: 'This is a preview profile with sample data so you can walk the product without a backend.',
    location: 'Athens, Greece',
    timezone: 'Europe/Athens',
    languages: ['English', 'Greek'],
    avatarUrl: null,
    rolePayload: {
      stage: 'idea',
      lookingFor: ['cofounder', 'mentor'],
      // Roles and schools for the profile's Experience section; fictional names only.
      experience: [
        { title: 'Founder', company: 'Alex Demo Studio', start: '2025', end: '' },
        { title: 'Product designer', company: 'Aegean Lab', start: '2021', end: '2025' },
      ],
      education: [{ school: 'Pnyx School of Business', degree: 'MSc Innovation', start: '2019', end: '2021' }],
    },
    visibilityRules: null,
    role: 'founder',
    email: 'demo@cofounderbay.com',
    skills: [
      { skillId: 'product', skillName: 'Product', slug: 'product', level: 'advanced' },
      { skillId: 'growth', skillName: 'Growth', slug: 'growth', level: 'intermediate' },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: NOW,
  },
  hasCompletedOnboarding: true,
};

const PREVIEW_MILESTONE_ELENA = {
  id: 'user-elena',
  displayName: 'Elena Papadopoulos',
  avatarUrl: null,
} as const;

function previewMilestoneCollaborator(id: string | null) {
  if (id === PREVIEW_MILESTONE_ELENA.id) {
    return { id: PREVIEW_MILESTONE_ELENA.id, displayName: PREVIEW_MILESTONE_ELENA.displayName, avatarUrl: null };
  }
  return null;
}

/**
 * Harbor tracker aligned with Idea Core, the GTM board, and the $750K seed.
 * Fast Refresh can keep the old generic titles while this already returns Harbor.
 */
function seedPreviewMilestones(): PreviewMilestone[] {
  const stamp = { ownerId: ME_ID, createdAt: NOW, updatedAt: NOW };
  return [
    { ...stamp, id: 'ms-1', collaboratorId: null, collaborator: null, title: 'Complementary cofounder — technical + commercial pair', description: 'Job: find a complementary cofounder.', status: 'todo', priority: 'high', category: 'hiring', dueDate: '2026-10-15T17:00:00.000Z', completedAt: null, progress: 0, notes: null },
    { ...stamp, id: 'ms-2', collaboratorId: null, collaborator: null, title: 'First founder-network path in Athens', description: 'Discover, matches, and shareable Builder docs. First path: founder networks in Athens and EU time zones.', status: 'todo', priority: 'medium', category: 'growth', dueDate: '2026-10-01T17:00:00.000Z', completedAt: null, progress: 0, notes: null },
    { ...stamp, id: 'ms-3', collaboratorId: null, collaborator: null, title: 'File Harbor trademark', description: 'Optional legal step.', status: 'todo', priority: 'low', category: 'other', dueDate: null, completedAt: null, progress: 0, notes: null },
    { ...stamp, id: 'ms-4', collaboratorId: PREVIEW_MILESTONE_ELENA.id, collaborator: previewMilestoneCollaborator(PREVIEW_MILESTONE_ELENA.id), title: 'Close $750K seed', description: '$375K committed of a $750K target. Lead: Athens Tech Angels.', status: 'in_progress', priority: 'high', category: 'fundraising', dueDate: '2026-08-20T17:00:00.000Z', completedAt: null, progress: 50 /* $375K of $750K */, notes: 'Same target as the Harbor pitch ask.' },
    { ...stamp, id: 'ms-5', collaboratorId: null, collaborator: null, title: 'Shareable Idea Core and GTM board', description: 'First conversion from the GTM offer: a filled Idea Core and a research board they can share.', status: 'in_progress', priority: 'medium', category: 'product', dueDate: '2026-09-12T17:00:00.000Z', completedAt: null, progress: 40, notes: null },
    { ...stamp, id: 'ms-6', collaboratorId: null, collaborator: null, title: 'Warm intro from Athens founder networks', description: 'Waiting on a warm intro from Athens founder networks.', status: 'blocked', priority: 'high', category: 'partnerships', dueDate: '2026-10-01T17:00:00.000Z', completedAt: null, progress: 20, notes: null },
    // Tracks the Builder canvas, which is a draft with one of nine blocks filled.
    { ...stamp, id: 'ms-9', collaboratorId: null, collaborator: null, title: 'BMC v1 in Builder', description: 'Value proposition and channels next; one of the nine blocks is filled.', status: 'in_progress', priority: 'medium', category: 'product', dueDate: '2026-09-30T17:00:00.000Z', completedAt: null, progress: 11, notes: null },
    { ...stamp, id: 'ms-7', collaboratorId: null, collaborator: null, title: 'Idea Core v1 in Builder', description: 'Problem, complementary-cofounder audience, graph + readiness + builder.', status: 'completed', priority: 'medium', category: 'product', dueDate: '2026-06-20T17:00:00.000Z', completedAt: '2026-06-18T12:00:00.000Z', progress: 100, notes: null },
    { ...stamp, id: 'ms-8', collaboratorId: null, collaborator: null, title: 'First mentor office hours', description: null, status: 'completed', priority: 'low', category: 'growth', dueDate: '2026-07-15T17:00:00.000Z', completedAt: '2026-07-14T12:00:00.000Z', progress: 100, notes: null },
    { ...stamp, id: 'ms-10', collaboratorId: null, collaborator: null, title: 'Pitch deck outline for the $750K seed', description: 'Same ask as the Harbor pitch deck.', status: 'completed', priority: 'high', category: 'fundraising', dueDate: '2026-08-01T17:00:00.000Z', completedAt: '2026-07-30T12:00:00.000Z', progress: 100, notes: null },
    { ...stamp, id: 'ms-11', collaboratorId: null, collaborator: null, title: 'Readiness score above 40', description: null, status: 'completed', priority: 'medium', category: 'other', dueDate: '2026-08-10T17:00:00.000Z', completedAt: '2026-08-08T12:00:00.000Z', progress: 100, notes: null },
    { ...stamp, id: 'ms-12', collaboratorId: null, collaborator: null, title: 'GTM canvas on Research', description: 'Harbor GTM notes aligned with Idea Core and the $750K seed.', status: 'completed', priority: 'medium', category: 'product', dueDate: '2026-08-25T17:00:00.000Z', completedAt: '2026-08-22T12:00:00.000Z', progress: 100, notes: null },
  ];
}

const PREVIEW_MILESTONE_LEGACY_TITLES = new Set([
  'Launch beta to first 20 users',
  'Hire first engineer',
  'File trademark',
  'Close seed round',
  'Ship onboarding checklist',
  'Sign university MoU',
  'Publish landing page',
  'Pitch deck outline',
  'Intro call with first accelerator',
]);

const PREVIEW_MILESTONE_LEGACY_SNIPPETS = [
  'Invite waitlist, instrument onboarding',
  'Scorecard, three finalists',
  'Pilot cohort of 12 teams',
  'Term sheet in, data room current, 8 meetings booked',
  'Founder can finish setup without a call',
  'Two angels waiting on traction slide',
  'not a cold list of twelve teams',
];

function applyHarborMilestoneSeedIfStale() {
  const seeded = seedPreviewMilestones();
  previewMilestones = previewMilestones.map((row) => {
    const fresh = seeded.find((s) => s.id === row.id);
    if (!fresh) return row;
    const description = row.description ?? '';
    const staleTitle = PREVIEW_MILESTONE_LEGACY_TITLES.has(row.title);
    const staleBody = PREVIEW_MILESTONE_LEGACY_SNIPPETS.some((snippet) => description.includes(snippet));
    if (!staleTitle && !staleBody) return row;
    return { ...fresh };
  });
}

previewMilestones = seedPreviewMilestones();

/*
 * Showcase areas. /events, /jobs, /groups and /opportunities used to fall
 * through to `kitchenSink()`, which answers with a truthy grab-bag: the pages
 * rendered empty, and their stat tiles fell back to invented copy ("40+").
 * These fixtures give each area a real, internally consistent world — the same
 * cast as the rest of the demo — so every count on screen is counted from the
 * rows below it.
 */
const PREVIEW_EVENT_HOSTS = {
  elena: { id: 'user-elena', displayName: 'Elena Papadopoulos', avatarUrl: null, role: 'founder' },
  marcus: { id: 'user-marcus', displayName: 'Marcus Chen', avatarUrl: null, role: 'cofounder' },
  sarah: { id: 'user-sarah', displayName: 'Dr. Sarah Kim', avatarUrl: null, role: 'mentor' },
  nikos: { id: 'user-nikos', displayName: 'Nikos Andreou', avatarUrl: null, role: 'investor' },
} as const;

type PreviewEvent = {
  id: string;
  title: string;
  description: string;
  eventType: 'meetup' | 'webinar' | 'workshop' | 'demo_day' | 'networking' | 'other';
  mode: 'online' | 'in-person' | 'hybrid';
  startAt: string;
  endAt: string;
  timezone: string | null;
  location: string | null;
  isOnline: boolean;
  meetingUrl: string | null;
  capacity: number | null;
  coverImageUrl: string | null;
  attendeesCount: number;
  host: { id: string; displayName: string; avatarUrl: string | null; role: string };
  viewerRsvp: 'going' | 'interested' | 'not_going' | null;
  isFeatured?: boolean;
};

const PREVIEW_EVENTS: PreviewEvent[] = [
  {
    id: 'ev-demo-day',
    // Hosted by the Athens Founders group's owner: "Seed Cohort 12" named a
    // programme no organisation in the demo runs.
    title: 'Athens Founders Pitch Night',
    description: 'Twelve teams from the Athens Founders community pitch to pre-seed and seed investors, eight minutes each, followed by open networking.',
    eventType: 'demo_day', mode: 'in-person',
    startAt: '2026-09-11T16:00:00.000Z', endAt: '2026-09-11T18:30:00.000Z',
    timezone: 'Europe/Athens', location: 'Stegi, Athens', isOnline: false, meetingUrl: null,
    capacity: 120, coverImageUrl: null, attendeesCount: 84,
    host: PREVIEW_EVENT_HOSTS.elena, viewerRsvp: 'going', isFeatured: true,
  },
  {
    id: 'ev-office-hours',
    title: 'Fundraising Office Hours',
    description: 'Bring one slide and one question. Marcus reviews narrative, traction framing and the ask, live.',
    eventType: 'webinar', mode: 'online',
    startAt: '2026-09-09T15:00:00.000Z', endAt: '2026-09-09T16:00:00.000Z',
    timezone: 'Europe/Athens', location: null, isOnline: true, meetingUrl: 'https://meet.cofounderbay.com/office-hours',
    capacity: 100, coverImageUrl: null, attendeesCount: 47,
    host: PREVIEW_EVENT_HOSTS.marcus, viewerRsvp: 'interested',
  },
  {
    id: 'ev-discovery',
    title: 'Product Discovery Workshop',
    description: 'A working session on interview design, signal vs. noise in early feedback, and deciding what not to build.',
    eventType: 'workshop', mode: 'hybrid',
    startAt: '2026-09-17T09:00:00.000Z', endAt: '2026-09-17T12:00:00.000Z',
    timezone: 'Europe/Athens', location: 'Aegean Venture Lab, Athens', isOnline: true, meetingUrl: 'https://meet.cofounderbay.com/discovery',
    capacity: 40, coverImageUrl: null, attendeesCount: 32,
    host: PREVIEW_EVENT_HOSTS.sarah, viewerRsvp: null,
  },
  {
    id: 'ev-coffee',
    title: 'Founder Coffee — Thessaloniki',
    description: 'An informal morning meetup. No pitches, no agenda: whoever shows up sets the table.',
    eventType: 'networking', mode: 'in-person',
    startAt: '2026-09-24T07:30:00.000Z', endAt: '2026-09-24T09:00:00.000Z',
    timezone: 'Europe/Athens', location: 'Aristotelous Square, Thessaloniki', isOnline: false, meetingUrl: null,
    capacity: 25, coverImageUrl: null, attendeesCount: 18,
    host: PREVIEW_EVENT_HOSTS.nikos, viewerRsvp: null,
  },
  {
    id: 'ev-ai-features',
    title: 'Shipping AI Features Without a Data Team',
    description: 'What a two-person team can actually put in production: evaluation, cost control and the failure modes users forgive.',
    eventType: 'webinar', mode: 'online',
    startAt: '2026-10-01T17:00:00.000Z', endAt: '2026-10-01T18:00:00.000Z',
    timezone: 'Europe/Athens', location: null, isOnline: true, meetingUrl: 'https://meet.cofounderbay.com/ai-features',
    capacity: null, coverImageUrl: null, attendeesCount: 156,
    host: PREVIEW_EVENT_HOSTS.marcus, viewerRsvp: 'going',
  },
  {
    id: 'ev-saas-metrics',
    title: 'SaaS Metrics Meetup #14',
    description: 'Three founders open their dashboards and explain the number that changed their roadmap this quarter.',
    eventType: 'meetup', mode: 'in-person',
    startAt: '2026-10-08T17:30:00.000Z', endAt: '2026-10-08T20:00:00.000Z',
    timezone: 'Europe/Athens', location: 'Found.ation, Athens', isOnline: false, meetingUrl: null,
    capacity: 80, coverImageUrl: null, attendeesCount: 63,
    host: PREVIEW_EVENT_HOSTS.elena, viewerRsvp: null,
  },
  {
    id: 'ev-pitch-clinic',
    title: 'Pitch Clinic — Seed Narrative',
    description: 'Recorded session: rebuilding a deck around one claim, with two teams workshopped end to end.',
    eventType: 'workshop', mode: 'online',
    startAt: '2026-08-21T16:00:00.000Z', endAt: '2026-08-21T17:30:00.000Z',
    timezone: 'Europe/Athens', location: null, isOnline: true, meetingUrl: 'https://meet.cofounderbay.com/pitch-clinic',
    capacity: 60, coverImageUrl: null, attendeesCount: 54,
    host: PREVIEW_EVENT_HOSTS.sarah, viewerRsvp: 'going',
  },
  {
    id: 'ev-summer-mixer',
    title: 'Summer Founders Mixer',
    description: 'The July rooftop mixer — 91 founders, operators and angels from the Athens ecosystem.',
    eventType: 'networking', mode: 'in-person',
    startAt: '2026-07-10T18:00:00.000Z', endAt: '2026-07-10T21:00:00.000Z',
    timezone: 'Europe/Athens', location: 'Six d.o.g.s, Athens', isOnline: false, meetingUrl: null,
    capacity: 120, coverImageUrl: null, attendeesCount: 91,
    host: PREVIEW_EVENT_HOSTS.nikos, viewerRsvp: null,
  },
];

const PREVIEW_JOBS = [
  { id: 'job-founding-eng', title: 'Founding Engineer', role: 'engineering', location: 'Athens, Greece', isRemote: false, type: 'full-time', isFeatured: true, creator: { id: 'user-elena', displayName: 'Elena Papadopoulos', avatarUrl: null }, href: '/profiles/user-elena' },
  { id: 'job-growth-lead', title: 'Growth Lead', role: 'marketing', location: 'Remote — EU time zones', isRemote: true, type: 'full-time', creator: { id: 'user-marcus', displayName: 'Marcus Chen', avatarUrl: null }, href: '/profiles/user-marcus' },
  { id: 'job-product-designer', title: 'Product Designer (Founding)', role: 'design', location: 'Athens, Greece', isRemote: false, type: 'full-time', creator: { id: 'user-elena', displayName: 'Elena Papadopoulos', avatarUrl: null }, href: '/profiles/user-elena' },
  { id: 'job-data-contract', title: 'Data Scientist — 3-month contract', role: 'data', location: 'Remote', isRemote: true, type: 'contract', creator: { id: 'user-sarah', displayName: 'Dr. Sarah Kim', avatarUrl: null }, href: '/profiles/user-sarah' },
  { id: 'job-bizdev-see', title: 'Business Development, Southeast Europe', role: 'sales', location: 'Thessaloniki, Greece', isRemote: false, type: 'full-time', creator: { id: 'user-nikos', displayName: 'Nikos Andreou', avatarUrl: null }, href: '/profiles/user-nikos' },
  { id: 'job-backend-intern', title: 'Backend Engineering Intern', role: 'engineering', location: 'Remote', isRemote: true, type: 'internship', creator: { id: 'user-marcus', displayName: 'Marcus Chen', avatarUrl: null }, href: '/profiles/user-marcus' },
];

type PreviewGroup = {
  id: string; name: string; slug: string; description: string | null;
  privacy: 'public' | 'private' | 'secret'; category: string | null; tags: string[];
  coverImageUrl: string | null; avatarUrl: string | null;
  rules: { title: string; description: string }[];
  memberCount: number; postCount: number; eventCount: number;
  createdAt: string; updatedAt: string;
  createdBy: { id: string; displayName: string; avatarUrl: string | null; headline: string | null; role: string } | null;
  isMember: boolean; memberRole: 'owner' | 'admin' | 'moderator' | 'member' | null;
};

const PREVIEW_GROUP_RULES = [
  { title: 'Keep it specific', description: 'Ask about a real decision you are facing, not a hypothetical.' },
  { title: 'No cold pitching', description: 'Introductions are welcome in the monthly thread, not in every post.' },
];

const PREVIEW_GROUP_FOUNDERS = {
  elena: { id: 'user-elena', displayName: 'Elena Papadopoulos', avatarUrl: null, headline: 'Founder & CEO at Harbor', role: 'founder' },
  marcus: { id: 'user-marcus', displayName: 'Marcus Chen', avatarUrl: null, headline: 'Technical cofounder · Full-stack', role: 'cofounder' },
  sarah: { id: 'user-sarah', displayName: 'Dr. Sarah Kim', avatarUrl: null, headline: 'ML lead and advisor', role: 'mentor' },
  nikos: { id: 'user-nikos', displayName: 'Nikos Andreou', avatarUrl: null, headline: 'Angel investor', role: 'investor' },
  sofia: { id: 'user-sofia', displayName: 'Sofia Alexiou', avatarUrl: null, headline: 'Founder at Meltemi', role: 'founder' },
};

const PREVIEW_GROUPS: PreviewGroup[] = [
  { id: 'grp-athens-founders', name: 'Athens Founders', slug: 'athens-founders', description: 'The local room: hiring, landlords, accountants, and who is actually raising.', privacy: 'public', category: 'Local', tags: ['athens', 'community'], coverImageUrl: null, avatarUrl: null, rules: PREVIEW_GROUP_RULES, memberCount: 428, postCount: 76, eventCount: 6, createdAt: '2025-03-14T09:00:00.000Z', updatedAt: NOW, createdBy: PREVIEW_GROUP_FOUNDERS.elena, isMember: true, memberRole: 'member' },
  { id: 'grp-saas-metrics', name: 'SaaS Metrics Circle', slug: 'saas-metrics-circle', description: 'Monthly benchmark swaps. Bring your numbers, leave with context.', privacy: 'public', category: 'Industry', tags: ['saas', 'metrics'], coverImageUrl: null, avatarUrl: null, rules: PREVIEW_GROUP_RULES, memberCount: 312, postCount: 54, eventCount: 3, createdAt: '2025-06-02T09:00:00.000Z', updatedAt: NOW, createdBy: PREVIEW_GROUP_FOUNDERS.marcus, isMember: true, memberRole: 'moderator' },
  { id: 'grp-ai-builders', name: 'AI Builders EU', slug: 'ai-builders-eu', description: 'Practitioners shipping AI features in European products — evaluation, cost, and regulation.', privacy: 'public', category: 'Technology', tags: ['ai', 'engineering'], coverImageUrl: null, avatarUrl: null, rules: PREVIEW_GROUP_RULES, memberCount: 1204, postCount: 180, eventCount: 9, createdAt: '2024-11-20T09:00:00.000Z', updatedAt: NOW, createdBy: PREVIEW_GROUP_FOUNDERS.sarah, isMember: false, memberRole: null },
  { id: 'grp-preseed-fundraising', name: 'Pre-Seed Fundraising', slug: 'pre-seed-fundraising', description: 'Term sheets, SAFEs and cap tables, read by people who have signed them.', privacy: 'private', category: 'Fundraising', tags: ['fundraising', 'legal'], coverImageUrl: null, avatarUrl: null, rules: PREVIEW_GROUP_RULES, memberCount: 186, postCount: 41, eventCount: 2, createdAt: '2025-01-09T09:00:00.000Z', updatedAt: NOW, createdBy: PREVIEW_GROUP_FOUNDERS.marcus, isMember: false, memberRole: null },
  { id: 'grp-product-craft', name: 'Product & Design Craft', slug: 'product-design-craft', description: 'Critique threads for real screens, with the constraint that made them that way.', privacy: 'public', category: 'Product', tags: ['product', 'design'], coverImageUrl: null, avatarUrl: null, rules: PREVIEW_GROUP_RULES, memberCount: 254, postCount: 33, eventCount: 1, createdAt: '2025-04-18T09:00:00.000Z', updatedAt: NOW, createdBy: PREVIEW_GROUP_FOUNDERS.elena, isMember: false, memberRole: null },
  { id: 'grp-women-founders-gr', name: 'Women Founders Greece', slug: 'women-founders-greece', description: 'Peer support and introductions for women building companies in Greece.', privacy: 'public', category: 'Community', tags: ['community', 'greece'], coverImageUrl: null, avatarUrl: null, rules: PREVIEW_GROUP_RULES, memberCount: 97, postCount: 12, eventCount: 4, createdAt: '2025-08-01T09:00:00.000Z', updatedAt: NOW, createdBy: PREVIEW_GROUP_FOUNDERS.elena, isMember: false, memberRole: null },
  { id: 'grp-b2b-sales', name: 'B2B Sales for Technical Founders', slug: 'b2b-sales-technical-founders', description: 'Just opened. The first discussion thread goes up after the kickoff call.', privacy: 'public', category: 'Sales', tags: ['sales', 'b2b'], coverImageUrl: null, avatarUrl: null, rules: PREVIEW_GROUP_RULES, memberCount: 143, postCount: 0, eventCount: 0, createdAt: '2026-08-30T09:00:00.000Z', updatedAt: NOW, createdBy: PREVIEW_GROUP_FOUNDERS.nikos, isMember: false, memberRole: null },
];

/** The newest posts in a group, from the people the rest of the showcase already has. */
function previewGroupPosts(group: PreviewGroup) {
  const F = PREVIEW_GROUP_FOUNDERS;
  const byGroup: Record<string, { author: (typeof F)[keyof typeof F]; content: string; days: number; comments: number; reactions: number; pinned?: boolean }[]> = {
    'grp-athens-founders': [
      { author: F.elena, content: 'Harbor is hiring a first account executive in Athens. Greek and English, B2B SaaS, someone who likes a blank page. Intros welcome.', days: -1, comments: 6, reactions: 14, pinned: true },
      { author: F.sofia, content: 'Anyone switched accountants this year? Looking for someone who understands SAFEs and does not bill by the email.', days: -2, comments: 9, reactions: 5 },
      { author: F.nikos, content: 'Office hours for pre-seed founders on Thursday at 17:00, Syntagma. Bring your deck and your hardest question.', days: -4, comments: 3, reactions: 11 },
    ],
    'grp-saas-metrics': [
      { author: F.marcus, content: 'This month\'s benchmark swap: net revenue retention for teams under €1M ARR. Share yours in the thread, anonymised is fine.', days: -1, comments: 12, reactions: 18, pinned: true },
      { author: F.elena, content: 'We moved from monthly to annual prepay and our cash runway went from 11 to 16 months. Happy to share the pricing page before and after.', days: -3, comments: 7, reactions: 21 },
    ],
  };
  const rows = byGroup[group.id] ?? [
    { author: group.createdBy as (typeof F)[keyof typeof F], content: `Welcome to ${group.name}. Introduce yourself: what you are building and what you need this month.`, days: -6, comments: 4, reactions: 9, pinned: true },
  ];
  return rows.map((row, i) => ({
    id: `${group.id}-post-${i}`,
    groupId: group.id,
    content: row.content,
    mediaUrls: [],
    isPinned: Boolean(row.pinned),
    createdAt: previewIsoInDays(row.days, 10 + i),
    editedAt: null,
    commentCount: row.comments,
    reactionCount: row.reactions,
    myReaction: null,
    author: { id: row.author.id, displayName: row.author.displayName, avatarUrl: null, headline: row.author.headline, role: row.author.role },
  }));
}

/** The members a group shows by name: its founder, the reader when joined, and the cast. */
function previewGroupMembers(group: PreviewGroup) {
  const F = PREVIEW_GROUP_FOUNDERS;
  const people = [group.createdBy as (typeof F)[keyof typeof F], F.elena, F.sofia, F.marcus, F.nikos]
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);
  return [
    ...people.map((p, i) => ({
      userId: p.id,
      role: i === 0 ? 'owner' : 'member',
      joinedAt: previewIsoInDays(-120 + i * 9, 10),
      user: { id: p.id, displayName: p.displayName, avatarUrl: null, headline: p.headline, role: p.role },
    })),
    ...(group.isMember ? [{ userId: ME_ID, role: group.memberRole ?? 'member', joinedAt: previewIsoInDays(-60, 10), user: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null, headline: 'Founder', role: 'founder' } }] : []),
  ];
}

const PREVIEW_OPPORTUNITIES = [
  { id: 'opp-technical-cofounder', title: 'Technical co-founder — vertical SaaS for logistics', description: 'Design partner signed, 14 interviews done, no engineer. Equity, not salary, until the pre-seed closes.', type: 'cofounder', company: 'Meltemi', location: 'Athens, Greece', isRemote: false, url: null, tags: ['cofounder', 'logistics', 'saas'], deadline: '2026-10-15T00:00:00.000Z', isActive: true, createdBy: { displayName: 'Sofia Alexiou', avatarUrl: null }, createdAt: '2026-08-26T09:00:00.000Z' },
  { id: 'opp-fractional-cto', title: 'Fractional CTO — two days a week', description: 'Six-month engagement to take an existing prototype to production and hire the first two engineers.', type: 'job', company: 'Harbor', location: 'Remote — EU time zones', isRemote: true, url: null, tags: ['engineering', 'leadership'], deadline: '2026-09-30T00:00:00.000Z', isActive: true, createdBy: { displayName: 'Elena Papadopoulos', avatarUrl: null }, createdAt: '2026-08-29T09:00:00.000Z' },
  { id: 'opp-angel-syndicate', title: 'Angel syndicate — pre-seed allocation', description: 'Open allocation alongside a lead. Greek and Cypriot SaaS teams with a paying design partner.', type: 'investment', company: 'Andreou Angels', location: 'Remote', isRemote: true, url: null, tags: ['fundraising', 'pre-seed'], deadline: '2026-11-01T00:00:00.000Z', isActive: true, createdBy: { displayName: 'Nikos Andreou', avatarUrl: null }, createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'opp-design-partner', title: 'Design partner wanted — ops teams of 20 to 200', description: 'Free for six months in exchange for weekly feedback sessions and a public case study.', type: 'partnership', company: 'Harbor', location: 'Remote', isRemote: true, url: null, tags: ['partnership', 'b2b'], deadline: null, isActive: true, createdBy: { displayName: 'Elena Papadopoulos', avatarUrl: null }, createdAt: '2026-08-18T09:00:00.000Z' },
  { id: 'opp-mentor-ml', title: 'Mentorship — ML evaluation and cost control', description: 'Four sessions with a practitioner, for teams putting their first model in front of customers.', type: 'mentorship', company: null, location: 'Remote', isRemote: true, url: null, tags: ['ai', 'mentorship'], deadline: '2026-10-05T00:00:00.000Z', isActive: true, createdBy: { displayName: 'Dr. Sarah Kim', avatarUrl: null }, createdAt: '2026-09-02T09:00:00.000Z' },
  { id: 'opp-aegean-bootcamp', title: 'Pre-seed Bootcamp · Spring 2027 — applications open', description: 'Six weeks from idea to first paying customer, in Athens. Ten places; applications close three weeks from now.', type: 'other', company: 'Aegean Venture Lab', location: 'Athens, Greece', isRemote: false, url: null, tags: ['program', 'pre-seed'], deadline: '2026-10-16T00:00:00.000Z', isActive: true, createdBy: { displayName: 'Anna Lambrou', avatarUrl: null }, createdAt: '2026-09-15T09:00:00.000Z' },
  { id: 'opp-aegean-mentors', title: 'Mentors wanted — fintech compliance and payments', description: 'Two hours a month with the Autumn 2026 cohort. Ledgerly and Thalia are both building on payments rails.', type: 'mentorship', company: 'Aegean Venture Lab', location: 'Athens, Greece', isRemote: true, url: null, tags: ['mentorship', 'fintech'], deadline: null, isActive: true, createdBy: { displayName: 'Anna Lambrou', avatarUrl: null }, createdAt: '2026-09-10T09:00:00.000Z' },
  { id: 'opp-gtm-advisor', title: 'GTM advisor — Southeast Europe expansion', description: 'Advisory shares for someone who has sold B2B software into Greece, Romania and Bulgaria.', type: 'other', company: 'Meltemi', location: 'Thessaloniki, Greece', isRemote: false, url: null, tags: ['gtm', 'advisory'], deadline: null, isActive: true, createdBy: { displayName: 'Sofia Alexiou', avatarUrl: null }, createdAt: '2026-07-22T09:00:00.000Z' },
];

/*
 * The investor's board. One row per startup, at whatever stage — the watchlist,
 * the pipeline and the portfolio read the same rows through different filters,
 * so the demo cannot show a company as invested on one screen and missing on
 * another.
 */
type PreviewDeal = {
  id: string;
  name: string;
  tagline: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  logoUrl: string | null;
  companyStage: string | null;
  teamSize: number | null;
  pipelineStage: string;
  starred: boolean;
  alertsEnabled: boolean;
  notes: string | null;
  tags: string[];
  currency: string;
  askAmountCents: number | null;
  investedCents: number | null;
  currentValueCents: number | null;
  investedAt: string | null;
  status: string;
  lastActivityAt: string;
  createdAt: string;
  founder: { id: string; displayName: string; avatarUrl: string | null; headline: string | null } | null;
  recentEvents: Array<{ id: string; type: string; title: string; body: string | null; createdAt: string }>;
};

const PREVIEW_DEALS: PreviewDeal[] = [
  {
    id: 'deal-harbor', name: 'Harbor', tagline: 'The operating system for early-stage founders.',
    industry: 'SaaS', location: 'Athens, Greece', website: null, logoUrl: null,
    companyStage: 'seed', teamSize: 4, pipelineStage: 'negotiating', starred: true, alertsEnabled: true,
    notes: 'Term sheet out. Waiting on the traction slide.', tags: ['saas', 'b2b'],
    currency: 'EUR', askAmountCents: 75_000_000, investedCents: null, currentValueCents: null,
    investedAt: null, status: 'active',
    lastActivityAt: '2026-09-03T14:00:00.000Z', createdAt: '2026-05-02T09:00:00.000Z',
    founder: { id: 'user-elena', displayName: 'Elena Papadopoulos', avatarUrl: null, headline: 'Founder & CEO at Harbor' },
    recentEvents: [
      { id: 'ev-h1', type: 'stage_change', title: 'Moved to negotiating', body: null, createdAt: '2026-09-03T14:00:00.000Z' },
      { id: 'ev-h2', type: 'deck', title: 'Sent an updated deck', body: null, createdAt: '2026-08-27T10:00:00.000Z' },
    ],
  },
  {
    id: 'deal-meltemi', name: 'Meltemi', tagline: 'Vertical SaaS for logistics operators.',
    industry: 'Logistics', location: 'Thessaloniki, Greece', website: null, logoUrl: null,
    companyStage: 'pre_seed', teamSize: 2, pipelineStage: 'due_diligence', starred: true, alertsEnabled: true,
    notes: 'Design partner signed. No engineer yet.', tags: ['logistics', 'saas'],
    currency: 'EUR', askAmountCents: 25_000_000, investedCents: null, currentValueCents: null,
    investedAt: null, status: 'active',
    lastActivityAt: '2026-09-01T09:00:00.000Z', createdAt: '2026-06-14T09:00:00.000Z',
    founder: { id: 'user-sofia', displayName: 'Sofia Alexiou', avatarUrl: null, headline: 'Founder at Meltemi' },
    recentEvents: [
      { id: 'ev-m1', type: 'milestone', title: 'First paying design partner', body: null, createdAt: '2026-09-01T09:00:00.000Z' },
    ],
  },
  {
    id: 'deal-aegis', name: 'Aegis Health', tagline: 'Triage support for community clinics.',
    industry: 'HealthTech', location: 'Patras, Greece', website: null, logoUrl: null,
    companyStage: 'seed', teamSize: 6, pipelineStage: 'invested', starred: false, alertsEnabled: true,
    notes: null, tags: ['health', 'ai'],
    currency: 'EUR', askAmountCents: 60_000_000, investedCents: 10_000_000, currentValueCents: 14_500_000,
    investedAt: '2026-02-11T09:00:00.000Z', status: 'active',
    lastActivityAt: '2026-08-20T09:00:00.000Z', createdAt: '2025-11-03T09:00:00.000Z',
    founder: { id: 'user-christina', displayName: 'Christina Mavrou', avatarUrl: null, headline: 'Founder at Aegis Health' },
    recentEvents: [
      { id: 'ev-a1', type: 'update', title: 'Q2 update: 3 clinics live', body: null, createdAt: '2026-08-20T09:00:00.000Z' },
    ],
  },
  {
    id: 'deal-orion', name: 'Orion Grid', tagline: 'Demand response for small utilities.',
    industry: 'CleanTech', location: 'Remote', website: null, logoUrl: null,
    companyStage: 'series_a', teamSize: 14, pipelineStage: 'invested', starred: true, alertsEnabled: false,
    notes: null, tags: ['energy'],
    currency: 'EUR', askAmountCents: null, investedCents: 25_000_000, currentValueCents: 41_000_000,
    investedAt: '2025-09-30T09:00:00.000Z', status: 'active',
    lastActivityAt: '2026-07-18T09:00:00.000Z', createdAt: '2025-04-08T09:00:00.000Z',
    founder: { id: 'user-dimitris', displayName: 'Dimitris Kostas', avatarUrl: null, headline: 'Founder at Orion Grid' },
    recentEvents: [
      { id: 'ev-o1', type: 'fundraise', title: 'Closed a Series A extension', body: null, createdAt: '2026-07-18T09:00:00.000Z' },
    ],
  },
  {
    id: 'deal-kolo', name: 'Kolo Labs', tagline: 'Developer tooling for embedded teams.',
    industry: 'DevTools', location: 'Remote', website: null, logoUrl: null,
    companyStage: 'pre_seed', teamSize: 3, pipelineStage: 'discovered', starred: false, alertsEnabled: true,
    notes: 'Saw the demo day pitch. Worth a first call.', tags: ['devtools'],
    currency: 'EUR', askAmountCents: 20_000_000, investedCents: null, currentValueCents: null,
    investedAt: null, status: 'active',
    lastActivityAt: '2026-09-04T07:00:00.000Z', createdAt: '2026-09-02T09:00:00.000Z',
    founder: { id: 'user-yannis', displayName: 'Yannis Petrou', avatarUrl: null, headline: 'Founder at Kolo Labs' },
    recentEvents: [
      { id: 'ev-k1', type: 'update', title: 'Added to the board', body: null, createdAt: '2026-09-02T09:00:00.000Z' },
    ],
  },
  {
    id: 'deal-thalia', name: 'Thalia', tagline: 'Booking and payments for independent studios.',
    industry: 'FinTech', location: 'Athens, Greece', website: null, logoUrl: null,
    companyStage: 'seed', teamSize: 5, pipelineStage: 'reviewing', starred: false, alertsEnabled: true,
    notes: null, tags: ['fintech', 'smb'],
    currency: 'EUR', askAmountCents: 45_000_000, investedCents: null, currentValueCents: null,
    investedAt: null, status: 'active',
    lastActivityAt: '2026-08-29T09:00:00.000Z', createdAt: '2026-07-21T09:00:00.000Z',
    founder: { id: 'user-maria', displayName: 'Maria Georgiou', avatarUrl: null, headline: 'Founder at Thalia' },
    recentEvents: [
      { id: 'ev-t1', type: 'team', title: 'Hired a second engineer', body: null, createdAt: '2026-08-29T09:00:00.000Z' },
    ],
  },
  {
    id: 'deal-vela', name: 'Vela', tagline: 'Marketplace for refurbished lab equipment.',
    industry: 'Marketplace', location: 'Heraklion, Greece', website: null, logoUrl: null,
    companyStage: 'pre_seed', teamSize: 2, pipelineStage: 'passed', starred: false, alertsEnabled: false,
    notes: 'Passed — market too thin for the model as pitched.', tags: ['marketplace'],
    currency: 'EUR', askAmountCents: 15_000_000, investedCents: null, currentValueCents: null,
    investedAt: null, status: 'active',
    lastActivityAt: '2026-06-12T09:00:00.000Z', createdAt: '2026-04-30T09:00:00.000Z',
    founder: null,
    recentEvents: [
      { id: 'ev-v1', type: 'stage_change', title: 'Moved to passed', body: null, createdAt: '2026-06-12T09:00:00.000Z' },
    ],
  },
];

const PREVIEW_PIPELINE_STAGES = [
  'discovered', 'reviewing', 'meeting', 'due_diligence', 'negotiating', 'invested', 'passed',
] as const;

function pathnameOf(path: string) {
  return path.split('?')[0] ?? path;
}

/* ── Analytics ──
   Shapes here mirror UserMetrics / AnalyticsProfileView / AnalyticsEngagement /
   AnalyticsTopContent / WeeklySummary in `lib/api.ts`. Before these existed the
   analytics endpoints fell through to `kitchenSink()`, which answers with a
   truthy grab-bag that has no `metrics` key — so `if (overview)` passed and the
   page then crashed on the first nested read. */
const PREVIEW_USER_METRICS = {
  profileViews: 248,
  profileViewsChange: 12,
  newConnections: 17,
  newConnectionsChange: 5,
  messagesSent: 63,
  messagesSentChange: -8,
  engagementRate: 34,
  engagementRateChange: 3,
  searchAppearances: 91,
  searchAppearancesChange: 0,
  activityScore: 72,
  activityScoreChange: 6,
};

function previewProfileViews() {
  const seed = [31, 27, 44, 38, 52, 29, 27];
  return seed.map((views, i) => {
    const d = new Date(previewNowMs() - (seed.length - 1 - i) * 86_400_000);
    return {
      date: d.toISOString().slice(0, 10),
      views,
      uniqueVisitors: Math.max(1, Math.round(views * 0.62)),
    };
  });
}

const PREVIEW_ANALYTICS_OVERVIEW = {
  metrics: PREVIEW_USER_METRICS,
  profileViews: previewProfileViews(),
  engagement: { connections: 17, messages: 63, likes: 128, comments: 41, shares: 12 },
  topContent: [
    { id: 'post-gtm', type: 'post' as const, title: 'How we picked our first 10 design partners', views: 412, engagement: 63, date: NOW },
    { id: 'post-hiring', type: 'post' as const, title: 'What I look for in a technical co-founder', views: 287, engagement: 48, date: NOW },
    { id: 'profile-me', type: 'profile' as const, title: 'Profile view spike after demo day', views: 154, engagement: 22, date: NOW },
  ],
  weeklySummary: {
    mostActiveDay: 'Tuesday',
    peakHour: '14:00–15:00',
    avgResponseTime: '3h 20m',
    totalInteractions: 261,
  },
};

/**
 * A date relative to now, so "upcoming" stays upcoming whenever the showcase
 * is opened. Evaluated when a request is answered, never during render, so it
 * cannot disagree between the server pass and hydration.
 */
function previewIsoInDays(days: number, hour = 14): string {
  const d = new Date(previewNowMs() + days * 86_400_000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

type PreviewBooking = {
  id: string;
  mentorId: string;
  menteeId: string;
  startAt: string;
  endAt: string;
  timezone: string | null;
  meetingType: 'video' | 'in_person' | 'chat';
  meetingUrl: string | null;
  notes: string | null;
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed';
  priceCents: number | null;
  currency: string | null;
  mentor: { id: string; displayName: string; avatarUrl: string | null };
  mentee: { id: string; displayName: string; avatarUrl: string | null };
};

function previewBookingPerson(id: string, fallbackName: string) {
  const u = PREVIEW_ADMIN_USERS.find((x) => x.id === id);
  const p = PEOPLE.find((x) => x.userId === id);
  return { id, displayName: u?.name ?? p?.displayName ?? fallbackName, avatarUrl: null };
}

const previewBookingSeed = (
  id: string,
  mentorId: string,
  menteeId: string,
  menteeName: string,
  status: PreviewBooking['status'],
  days: number,
  hour: number,
) => ({
  id,
  mentorId,
  menteeId,
  startAt: previewIsoInDays(days, hour),
  endAt: previewIsoInDays(days, hour + 1),
  timezone: 'Europe/Athens',
  meetingType: 'video' as const,
  meetingUrl: status === 'confirmed' ? `https://meet.example.com/${id}` : null,
  notes: null,
  status,
  priceCents: null,
  currency: null,
  mentor: previewBookingPerson(mentorId, 'Mentor'),
  mentee: previewBookingPerson(menteeId, menteeName),
});

/**
 * The demo's bookings: the store /mentoring's "Book session" writes and every
 * session list now reads beside the mentorship sessions. One the reader
 * mentors (Sofia, who already has a relationship), one from a founder with no
 * relationship yet (Giorgos), and one where the reader is the mentee (Sarah).
 * Seeded lazily: the people table it resolves names from is declared later.
 */
let previewBookings: PreviewBooking[] | null = null;
function previewBookingsState(): PreviewBooking[] {
  previewBookings ??= [
    previewBookingSeed('preview-book-sofia', ME_ID, 'user-sofia', 'Sofia Alexiou', 'confirmed', 3, 11),
    previewBookingSeed('preview-book-giorgos', ME_ID, 'user-giorgos', 'Giorgos Vlachos', 'requested', 5, 10),
    previewBookingSeed('preview-book-sarah', 'user-sarah', ME_ID, 'Alex Demo', 'confirmed', 4, 15),
  ];
  return previewBookings;
}

/** The demo mentor's weekly hours: the Tuesday and Thursday slots /mentor/* books into. */
let previewAvailability: { id: string; mentorId: string; weekday: number; startTime: string; endTime: string; timezone: string | null }[] = [
  { id: 'avail-1', mentorId: 'preview-demo-user', weekday: 2, startTime: '10:00', endTime: '13:00', timezone: 'Europe/Athens' },
  { id: 'avail-2', mentorId: 'preview-demo-user', weekday: 4, startTime: '10:00', endTime: '14:00', timezone: 'Europe/Athens' },
  { id: 'avail-3', mentorId: 'preview-demo-user', weekday: 5, startTime: '16:00', endTime: '18:00', timezone: 'Europe/Athens' },
];

const PREVIEW_COACHING_REL_ID = 'preview-rel-sarah';

/**
 * The founder's one coaching relationship.
 *
 * Dr. Sarah Kim is the demo's mentor on /matches, /jobs, /opportunities and
 * the dashboard's upcoming panel; she is the coach here too, rather than a
 * fourth person invented for this page.
 */
const PREVIEW_MENTORSHIP_RELATIONSHIPS = [
  {
    id: PREVIEW_COACHING_REL_ID,
    mentorId: 'user-sarah',
    menteeId: ME_ID,
    status: 'active' as const,
    goals: { primary: 'Reach product-market fit' },
    focusAreas: ['Execution', 'Product roadmap', 'Go-to-market'],
    startedAt: '2026-07-15T09:00:00.000Z',
    completedAt: null,
    nextSessionAt: previewIsoInDays(2),
    totalSessions: 3,
    mentor: {
      id: 'user-sarah',
      displayName: 'Dr. Sarah Kim',
      headline: 'Startup mentor - Ex-Google - 3x founder',
      avatarUrl: null,
    },
    mentee: {
      id: ME_ID,
      displayName: 'Alex Demo',
      headline: 'Founder at Harbor',
      avatarUrl: null,
      role: 'founder',
    },
  },
];

/** Three sessions: the one the dashboard announces, and the two behind it. */
function previewMentorshipSessions() {
  return [
    {
      id: 'preview-msess-3',
      relationshipId: PREVIEW_COACHING_REL_ID,
      title: 'Roadmap review before the seed round',
      description: null,
      scheduledAt: previewIsoInDays(2),
      duration: 45,
      timezone: 'Europe/Athens',
      meetingType: 'video' as const,
      meetingUrl: 'https://meet.example.com/harbor-roadmap',
      meetingLocation: null,
      status: 'scheduled' as const,
      agenda: 'Walk the 12-slide narrative, then cut the roadmap to what closes the round.',
      mentorNotes: null,
      menteeNotes: null,
      actionItems: [] as Record<string, unknown>[],
      mentorRating: null,
      menteeRating: null,
      createdAt: '2026-09-10T09:00:00.000Z',
    },
    {
      id: 'preview-msess-2',
      relationshipId: PREVIEW_COACHING_REL_ID,
      title: 'Pricing and unit economics',
      description: null,
      scheduledAt: previewIsoInDays(-9),
      duration: 60,
      timezone: 'Europe/Athens',
      meetingType: 'video' as const,
      meetingUrl: null,
      meetingLocation: null,
      status: 'completed' as const,
      agenda: 'Test the pricing story against five real conversations.',
      mentorNotes: null,
      menteeNotes:
        'Charge per seat, not per workspace - the value scales with the team, and the objection we kept hearing was about seats we were not charging for.',
      actionItems: [
        { task: 'Rewrite the pricing page around seats', done: true },
        { task: 'Run five pricing conversations', done: true },
        { task: 'Recompute unit economics at the new price', done: false },
      ] as Record<string, unknown>[],
      mentorRating: null,
      menteeRating: 5,
      createdAt: '2026-09-01T09:00:00.000Z',
    },
    {
      id: 'preview-msess-1',
      relationshipId: PREVIEW_COACHING_REL_ID,
      title: 'First 20 beta users',
      description: null,
      scheduledAt: previewIsoInDays(-23),
      duration: 45,
      timezone: 'Europe/Athens',
      meetingType: 'video' as const,
      meetingUrl: null,
      meetingLocation: null,
      status: 'completed' as const,
      agenda: 'Who to invite first, and what to measure once they are in.',
      mentorNotes: null,
      menteeNotes:
        'Invite in cohorts of five so onboarding friction is visible, and measure the second session rather than the first.',
      actionItems: [
        { task: 'Invite the first cohort of five', done: true },
        { task: 'Instrument second-session return', done: false },
      ] as Record<string, unknown>[],
      mentorRating: null,
      menteeRating: 4,
      createdAt: '2026-08-18T09:00:00.000Z',
    },
  ];
}

/**
 * The reader's other side: the founders they mentor.
 *
 * `/mentorship/relationships?role=mentor` answered with the reader's own
 * coaching relationship, so /mentor/mentees listed "Alex Demo" as Alex Demo's
 * mentee. The mentees are the founders of Meltemi, Kolo Labs and Thalia, plus
 * one finished mentorship (demo/mentor-world), and the sessions, requests and
 * dashboard figures below are counted from these rows.
 */
const ME_AS_MENTOR = { id: ME_ID, displayName: 'Alex Demo', headline: 'Founder at Harbor · mentors early founders', avatarUrl: null };
const MENTOR_SIDE_FOCUS: Record<string, string[]> = {
  'user-sofia': ['Pricing', 'Sales hiring'],
  'user-yannis': ['Fundraising', 'Developer go-to-market'],
  'user-maria': ['Product', 'Payments'],
  'user-dimitris': ['Go-to-market', 'Enterprise pilots'],
};
function previewMentorSideRelationships() {
  const active = MENTOR_DEMO_MENTEES.map((p, i) => ({
    id: `preview-mrel-${p.id}`,
    mentorId: ME_ID,
    menteeId: p.id,
    status: 'active' as const,
    goals: { primary: MENTOR_SIDE_FOCUS[p.id]?.[0] ?? 'Growth' },
    focusAreas: MENTOR_SIDE_FOCUS[p.id] ?? [],
    startedAt: previewIsoInDays(-60 - i * 21, 9),
    completedAt: null,
    nextSessionAt: previewIsoInDays(1 + i * 2, 10 + i * 2),
    totalSessions: [4, 3, 2][i] ?? 1,
    mentor: ME_AS_MENTOR,
    mentee: { id: p.id, displayName: p.name, headline: p.headline, avatarUrl: null, role: 'founder' },
  }));
  const done = {
    id: `preview-mrel-${MENTOR_DEMO_ALUMNUS.id}`,
    mentorId: ME_ID,
    menteeId: MENTOR_DEMO_ALUMNUS.id,
    status: 'completed' as const,
    goals: { primary: 'Go-to-market' },
    focusAreas: MENTOR_SIDE_FOCUS[MENTOR_DEMO_ALUMNUS.id],
    startedAt: previewIsoInDays(-240, 9),
    completedAt: previewIsoInDays(-60, 9),
    nextSessionAt: null,
    totalSessions: 6,
    mentor: ME_AS_MENTOR,
    mentee: { id: MENTOR_DEMO_ALUMNUS.id, displayName: MENTOR_DEMO_ALUMNUS.name, headline: MENTOR_DEMO_ALUMNUS.headline, avatarUrl: null, role: 'founder' },
  };
  return [...active, done];
}
/** The next session with each active mentee: what the dashboard and /mentor/sessions list. */
function previewMentorSideSessions() {
  return previewMentorSideRelationships()
    .filter((r) => r.status === 'active')
    .map((r, i) => ({
      id: `preview-msess-${r.menteeId}`,
      relationshipId: r.id,
      title: `${r.focusAreas[0] ?? 'Check-in'} with ${r.mentee.displayName.split(' ')[0]}`,
      description: null,
      scheduledAt: r.nextSessionAt as string,
      duration: [60, 45, 30][i] ?? 45,
      timezone: 'Europe/Athens',
      meetingType: 'video' as const,
      meetingUrl: `https://meet.example.com/${r.menteeId}`,
      meetingLocation: null,
      status: 'scheduled' as const,
      agenda: null,
      mentorNotes: null,
      menteeNotes: null,
      actionItems: [] as Record<string, unknown>[],
      mentorRating: null,
      menteeRating: null,
      createdAt: previewIsoInDays(-7, 9),
    }));
}
/**
 * The sessions each mentorship has already held - as many as its
 * `totalSessions` says (4 + 3 + 2 + 6 = the 15 the mentor dashboard counts),
 * the most recent carrying the topics /mentor/earnings bills for.
 */
function previewMentorSidePastSessions() {
  return previewMentorSideRelationships().flatMap((r, ri) => {
    const billed = MENTOR_DEMO_EARNINGS.filter((e) => e.menteeId === r.menteeId).sort((a, b) => a.ago - b.ago);
    const first = r.mentee.displayName.split(' ')[0];
    const lastDay = r.status === 'completed' ? 60 : 2 + ri * 2;
    return Array.from({ length: r.totalSessions }, (_, k) => {
      const bill = billed[k];
      const ago = bill?.ago ?? lastDay + k * 12;
      const duration = bill?.duration ?? 45;
      return {
        id: `preview-msess-${r.menteeId}-past-${k + 1}`,
        relationshipId: r.id,
        title: bill?.topic ?? `${r.focusAreas[k % Math.max(1, r.focusAreas.length)] ?? 'Check-in'} with ${first}`,
        description: null,
        scheduledAt: previewIsoInDays(-ago, 10 + (k % 3) * 2),
        duration,
        timezone: 'Europe/Athens',
        meetingType: 'video' as const,
        meetingUrl: null,
        meetingLocation: null,
        status: 'completed' as const,
        agenda: null,
        mentorNotes: null,
        menteeNotes: null,
        actionItems: [] as Record<string, unknown>[],
        mentorRating: null,
        menteeRating: null,
        createdAt: previewIsoInDays(-ago - 7, 9),
      };
    });
  });
}
/** Two founders waiting for an answer, and the request that became Sofia's mentorship. */
function previewMentorRequests() {
  const req = (id: string, who: { id: string; name: string; headline: string }, status: 'pending' | 'accepted', days: number, message: string, focusAreas: string[]) => ({
    id,
    requesterId: who.id,
    mentorId: ME_ID,
    message,
    goals: null,
    focusAreas,
    preferredFormat: 'video',
    status,
    createdAt: previewIsoInDays(-days, 11),
    updatedAt: previewIsoInDays(-days, 11),
    requester: { id: who.id, displayName: who.name, headline: who.headline, avatarUrl: null, role: 'founder' },
    mentor: { id: ME_ID, displayName: 'Alex Demo', headline: ME_AS_MENTOR.headline, avatarUrl: null },
  });
  return [
    req('preview-mreq-katerina', { id: 'user-katerina', name: 'Katerina Nikolaou', headline: 'Founder at Ledgerly' }, 'pending', 1,
      'We are pricing a climate-fintech product for SMEs and keep undercharging. Could we talk through how you priced Harbor?', ['Pricing']),
    req('preview-mreq-giorgos', { id: 'user-giorgos', name: 'Giorgos Vlachos', headline: 'Founder at Agora B2B' }, 'pending', 3,
      'Two-sided marketplace, 40 suppliers live, buyers are slow to come back. Looking for help on retention before our seed.', ['Go-to-market', 'Fundraising']),
    req('preview-mreq-sofia', { id: 'user-sofia', name: 'Sofia Alexiou', headline: 'Founder at Meltemi' }, 'accepted', 70,
      'Logistics SaaS, first ten customers. I would value a monthly session on pricing and the first sales hire.', ['Pricing', 'Sales hiring']),
  ];
}

/**
 * The reader's provider side: four services and the founders who asked for
 * them.
 *
 * /provider/dashboard, /dashboard/provider, /provider/inquiries, /projects,
 * /reviews and /services each carried their own sample (John Doe, TechStart
 * Inc, Sarah W., "Startup Legal Package") and their own totals. They now read
 * these rows through the endpoints they already call, so a project here is a
 * project there, and the rating is the average of the reviews listed.
 */
const PROVIDER_ME = { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null };
const PREVIEW_PROVIDER_SERVICES = [
  { id: 'svc-seed-model', title: 'Seed-round financial model', category: 'finance', pricing: '€1,800 fixed', description: 'A three-statement model built around your raise, with the assumptions an investor will ask about written down.', tags: ['fundraising', 'model'], isActive: true, isFeatured: true },
  { id: 'svc-incorporation', title: 'Incorporation & shareholder agreement', category: 'legal', pricing: '€1,200 fixed', description: 'Company set-up in Greece or Cyprus, cap table and a founders\' agreement that survives a seed round.', tags: ['legal', 'cap table'], isActive: true, isFeatured: false },
  { id: 'svc-fractional-cfo', title: 'Fractional CFO', category: 'finance', pricing: '€95 / hour', description: 'Monthly close, investor updates and runway planning, a day or two a month.', tags: ['finance'], isActive: true, isFeatured: false },
  { id: 'svc-deck-review', title: 'Pitch deck review', category: 'consulting', pricing: '€400 fixed', description: 'One written review and one call on narrative, traction and the ask.', tags: ['pitch'], isActive: false, isFeatured: false },
] as const;
function previewProviderServices() {
  return PREVIEW_PROVIDER_SERVICES.map((svc, i) => ({
    ...svc,
    tags: [...svc.tags],
    providerName: 'Harbor Advisory',
    providerLogo: null,
    contactUrl: null,
    websiteUrl: null,
    createdAt: previewIsoInDays(-120 + i * 20, 9),
  }));
}
function previewProviderInquiries() {
  const svc = (id: string) => {
    const s = PREVIEW_PROVIDER_SERVICES.find((x) => x.id === id)!;
    return { id: s.id, title: s.title, category: s.category };
  };
  const row = (
    id: string,
    client: { id: string; displayName: string },
    offerId: string,
    status: 'open' | 'in_discussion' | 'accepted' | 'completed',
    days: number,
    message: string,
    extra: { agreedPrice?: number; rating?: number; reviewComment?: string; budgetEstimate?: number } = {},
  ) => ({
    id,
    status,
    message,
    responseMessage: status === 'open' ? null : 'Thanks - happy to help. Here is how I would approach it.',
    agreedScope: extra.agreedPrice ? 'As discussed on the call' : null,
    budgetEstimate: extra.budgetEstimate ?? null,
    agreedPrice: extra.agreedPrice ?? null,
    currency: 'EUR',
    timelineExpected: status === 'open' ? 'Within a month' : null,
    rating: extra.rating ?? null,
    reviewComment: extra.reviewComment ?? null,
    createdAt: previewIsoInDays(-days, 10),
    resolvedAt: status === 'completed' ? previewIsoInDays(-Math.max(1, days - 20), 17) : null,
    offer: svc(offerId),
    client: { ...client, avatarUrl: null },
    provider: PROVIDER_ME,
  });
  return [
    row('inq-katerina', { id: 'user-katerina', displayName: 'Katerina Nikolaou' }, 'svc-seed-model', 'open', 1,
      'Raising a €1.2M seed for Ledgerly in Q1. Our model is a spreadsheet of hopes - can you build one investors will trust?', { budgetEstimate: 1800 }),
    row('inq-giorgos', { id: 'user-giorgos', displayName: 'Giorgos Vlachos' }, 'svc-incorporation', 'in_discussion', 3,
      'Two founders, one angel committed. We need the company set up and a shareholder agreement before the money lands.'),
    row('inq-sofia', { id: 'user-sofia', displayName: 'Sofia Alexiou' }, 'svc-fractional-cfo', 'accepted', 18,
      'Meltemi needs a monthly close and a runway view we can show the board.', { agreedPrice: 3800 }),
    row('inq-yannis', { id: 'user-yannis', displayName: 'Yannis Petrou' }, 'svc-seed-model', 'completed', 45,
      'Kolo Labs seed model, with the hardware revenue split out.', { agreedPrice: 1800, rating: 5, reviewComment: 'The model answered every question our lead asked before they asked it.' }),
    row('inq-maria', { id: 'user-maria', displayName: 'Maria Georgiou' }, 'svc-incorporation', 'completed', 70,
      'Thalia incorporation in Cyprus and a founders\' agreement.', { agreedPrice: 1200, rating: 4, reviewComment: 'Clear, fast, and the agreement held up in due diligence. Slightly slow on the Cyprus filing.' }),
    row('inq-dimitris', { id: 'user-dimitris', displayName: 'Dimitris Kostas' }, 'svc-fractional-cfo', 'completed', 110,
      'Orion Grid needs a CFO for the utility pilots, two days a month.', { agreedPrice: 5700, rating: 5, reviewComment: 'Turned our pilots into a board pack we were proud of.' }),
  ];
}

/**
 * The platform as an admin sees it: the same people as everywhere else.
 *
 * With no admin handler the directory fell through to the generic fallback,
 * so /admin/users drew its own sample (Tom Brown, Lisa Martinez...) and
 * /admin/user-management another (David Kim...), neither of them anyone the
 * founder, investor or mentor pages had met. Both read this list now, and the
 * admin home's totals are counted from it and from the demo's own events,
 * groups, jobs and connections.
 */
const PREVIEW_ADMIN_USERS = [
  { id: ME_ID, name: 'Alex Demo', email: 'alex@harbor.example', role: 'admin', status: 'active', joined: -400, seen: 0 },
  { id: 'user-elena', name: 'Elena Papadopoulos', email: 'elena@harbor.example', role: 'founder', status: 'active', joined: -380, seen: 0 },
  { id: 'user-marcus', name: 'Marcus Chen', email: 'marcus@marcuschen.dev', role: 'founder', status: 'active', joined: -300, seen: -1 },
  { id: 'user-sarah', name: 'Dr. Sarah Kim', email: 'sarah@sarahkim.co', role: 'mentor', status: 'active', joined: -500, seen: -2 },
  { id: 'user-nikos', name: 'Nikos Andreou', email: 'nikos@andreou.vc', role: 'investor', status: 'active', joined: -450, seen: -1 },
  { id: 'user-sofia', name: 'Sofia Alexiou', email: 'sofia@meltemi.example', role: 'founder', status: 'active', joined: -200, seen: 0 },
  { id: 'user-yannis', name: 'Yannis Petrou', email: 'yannis@kololabs.example', role: 'founder', status: 'active', joined: -190, seen: -3 },
  { id: 'user-maria', name: 'Maria Georgiou', email: 'maria@thalia.example', role: 'founder', status: 'active', joined: -160, seen: -5 },
  { id: 'user-dimitris', name: 'Dimitris Kostas', email: 'dimitris@oriongrid.example', role: 'founder', status: 'active', joined: -420, seen: -12 },
  { id: 'user-katerina', name: 'Katerina Nikolaou', email: 'katerina@ledgerly.example', role: 'founder', status: 'active', joined: -20, seen: -1 },
  { id: 'user-giorgos', name: 'Giorgos Vlachos', email: 'giorgos@agorab2b.example', role: 'founder', status: 'active', joined: -14, seen: -3 },
  { id: 'user-anna', name: 'Anna Lambrou', email: 'anna@aegeanlab.example', role: 'org', status: 'active', joined: -600, seen: -1 },
  { id: 'user-spyros', name: 'Spyros Karras', email: 'deals@quickfunding.example', role: 'founder', status: 'suspended', joined: -9, seen: -8 },
] as const;
function previewAdminUsers() {
  return PREVIEW_ADMIN_USERS.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    moderationStatus: u.status,
    createdAt: previewIsoInDays(u.joined, 9),
    lastSeenAt: previewIsoInDays(u.seen, 12),
    profile: { displayName: u.name, avatarUrl: null },
    reportsCount: u.id === 'user-spyros' ? 2 : 0,
  }));
}
/**
 * The abuse monitor's flags, about the same account the moderation queue is
 * about: Spyros is reported for spam, suspended, and flagged by detection for
 * the burst of messages that got him reported. The dismissed flag is the
 * founder whose off-topic post /admin's resolved report already mentions.
 */
function previewAbuseFlags() {
  const who = (id: string) => {
    const u = PREVIEW_ADMIN_USERS.find((x) => x.id === id)!;
    return { userId: u.id, email: u.email, displayName: u.name };
  };
  return [
    { id: 'flag-1', ...who('user-spyros'), type: 'burst_spam', severity: 0.82, description: 'Sent 46 near-identical messages to founders within 20 minutes.', metadata: { messages: 46, windowMinutes: 20 }, status: 'pending', resolvedAt: null, resolvedById: null, actionTaken: null, createdAt: previewIsoInDays(-1, 9) },
    { id: 'flag-2', ...who('user-spyros'), type: 'fake_collaboration', severity: 0.64, description: 'Listed as a collaborator on three projects whose owners never invited him.', metadata: { projects: 3 }, status: 'pending', resolvedAt: null, resolvedById: null, actionTaken: null, createdAt: previewIsoInDays(-2, 16) },
    { id: 'flag-3', ...who('user-giorgos'), type: 'low_quality_repetition', severity: 0.31, description: 'Posted the same launch update in four groups on one afternoon.', metadata: { groups: 4 }, status: 'dismissed', resolvedAt: previewIsoInDays(-11, 9), resolvedById: ME_ID, actionTaken: 'safe', createdAt: previewIsoInDays(-12, 14) },
  ];
}
function previewAdminReports() {
  const person = (id: string) => {
    const u = PREVIEW_ADMIN_USERS.find((x) => x.id === id)!;
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  };
  const spyros = { ...person('user-spyros'), moderationStatus: 'suspended' as const };
  return [
    { id: 'rep-1', type: 'spam' as const, status: 'pending' as const, reason: 'Sends the same "guaranteed funding" message to every founder in Athens.', context: null, createdAt: previewIsoInDays(-1, 10), updatedAt: previewIsoInDays(-1, 10), resolvedAt: null, reporter: person('user-sofia'), reported: spyros },
    { id: 'rep-2', type: 'fake' as const, status: 'pending' as const, reason: 'Claims to be an investor at a fund that has never heard of him.', context: null, createdAt: previewIsoInDays(-2, 15), updatedAt: previewIsoInDays(-2, 15), resolvedAt: null, reporter: person('user-nikos'), reported: spyros },
    { id: 'rep-3', type: 'inappropriate' as const, status: 'resolved' as const, reason: 'An off-topic post in Athens Founders, since removed by its author.', context: null, createdAt: previewIsoInDays(-12, 11), updatedAt: previewIsoInDays(-11, 9), resolvedAt: previewIsoInDays(-11, 9), reporter: person('user-maria'), reported: { ...person('user-giorgos'), moderationStatus: 'active' as const } },
  ];
}

/**
 * The mentor directory, from the people the showcase already knows.
 *
 * Built from PEOPLE rather than written out, so a coach on this page is
 * someone a visitor can also meet on /matches and /discover.
 */
function previewMentors() {
  // The showcase's mentor plus the organisation's pool (the viewer excluded),
  // so /coaching, /mentoring and /admin/mentorship-management name the same
  // coaches /org/mentors lists. An investor is not a mentor profile.
  const sarah = PEOPLE.find((p) => p.userId === 'user-sarah')!;
  const org = ORG_MENTORS.filter((m) => m.id !== ME_ID && m.id !== sarah.userId);
  return [
    {
      id: `preview-mentor-${sarah.userId}`,
      userId: sarah.userId,
      displayName: sarah.displayName,
      headline: sarah.headline ?? null,
      bio: sarah.bio ?? null,
      avatarUrl: null,
      location: sarah.location ?? null,
      industries: sarah.industries ?? [],
      skills: sarah.skillNames ?? [],
      startupStages: ['pre_seed', 'seed'],
      yearsExperience: 15,
      availabilityStatus: 'available' as 'available' | 'limited' | 'unavailable',
      isFree: false,
      hourlyRate: 150 as number | null,
      currency: 'EUR' as string | null,
      sessionCount: 9,
      rating: 4.5 as number | null,
      reviewCount: 2,
    },
    ...org.map((m, i) => ({
      id: `preview-mentor-${m.id}`,
      userId: m.id,
      displayName: m.name,
      headline: m.headline,
      bio: `Mentors early-stage founders on ${m.expertise.slice(0, 2).join(' and ').toLowerCase()}.`,
      avatarUrl: null,
      location: m.location,
      industries: [] as string[],
      skills: m.expertise,
      startupStages: ['pre_seed', 'seed'],
      yearsExperience: null,
      availabilityStatus: (i === 0 ? 'limited' : 'available') as 'available' | 'limited' | 'unavailable',
      isFree: true,
      hourlyRate: null,
      currency: null,
      // Thanos has held sessions with his two climate founders; Ioanna has
      // joined the pool but not yet been matched.
      sessionCount: m.mentees.length ? 5 : 0,
      rating: m.mentees.length ? 4.8 : null,
      reviewCount: m.mentees.length ? 2 : 0,
    })),
  ];
}

/**
 * Expert reviews of the Harbor deliverables.
 *
 * The Builder banner offers a review of the founder's artifacts; these are
 * what that offer leads to. The experts are the showcase's own mentors, so a
 * visitor meets the same people here, on /coaching and in /matches.
 */
function previewExpertReviews() {
  const sarah = {
    id: 'user-sarah',
    displayName: 'Dr. Sarah Kim',
    headline: 'Startup mentor - Ex-Google - 3x founder',
    avatarUrl: null,
  };
  const nikos = {
    id: 'user-nikos',
    displayName: 'Nikos Andreou',
    headline: 'Angel investor - Seed',
    avatarUrl: null,
  };
  const me = {
    id: ME_ID,
    displayName: 'Alex Demo',
    headline: 'Founder at Harbor',
    avatarUrl: null,
  };

  return [
    {
      id: 'preview-exrev-1',
      requester: me,
      expert: sarah,
      workspaceId: PREVIEW_BUILDER_WS_ID,
      reviewType: 'pitch_deck',
      status: 'submitted',
      requestMessage: 'Twelve slides for the seed round. Is the traction slide honest enough?',
      documents: [] as Record<string, unknown>[],
      summaryFeedback:
        'The narrative holds until slide six, where the traction claim outruns the evidence behind it. Lead with the retention curve you already have rather than the pipeline you hope for - it is the stronger number and it is the one you can defend.',
      strengths: [
        { area: 'Problem', comment: 'Named in one sentence, with a cost attached to it.' },
        { area: 'Team', comment: 'The complementary-skills story lands without being laboured.' },
      ] as Record<string, unknown>[],
      improvements: [
        { area: 'Traction', recommendation: 'Replace the pipeline figure with second-week retention.' },
        { area: 'Ask', recommendation: 'State the use of funds in three lines, not eight.' },
      ] as Record<string, unknown>[],
      scoreOverall: 7,
      scoresByArea: { problem: 8, team: 8, traction: 5, market: 7, ask: 6 },
      isPaid: false,
      agreedFee: null,
      currency: 'EUR',
      requestedAt: previewIsoInDays(-18, 9),
      acceptedAt: previewIsoInDays(-17, 9),
      dueDate: previewIsoInDays(-10, 9),
      submittedAt: previewIsoInDays(-11, 9),
      rating: 5,
      ratingComment: 'Changed what we led with. Worth the week of waiting.',
    },
    {
      id: 'preview-exrev-2',
      requester: me,
      expert: nikos,
      workspaceId: PREVIEW_BUILDER_WS_ID,
      reviewType: 'business_model',
      status: 'in_progress',
      requestMessage: 'The BMC is still a draft - mainly want a read on the pricing block.',
      documents: [] as Record<string, unknown>[],
      summaryFeedback: null,
      strengths: [] as Record<string, unknown>[],
      improvements: [] as Record<string, unknown>[],
      scoreOverall: null,
      scoresByArea: {} as Record<string, number>,
      isPaid: false,
      agreedFee: null,
      currency: 'EUR',
      requestedAt: previewIsoInDays(-6, 9),
      acceptedAt: previewIsoInDays(-5, 9),
      dueDate: previewIsoInDays(4, 9),
      submittedAt: null,
      rating: null,
      ratingComment: null,
    },
    {
      id: 'preview-exrev-3',
      requester: me,
      expert: sarah,
      workspaceId: PREVIEW_BUILDER_WS_ID,
      reviewType: 'financial_model',
      status: 'requested',
      requestMessage: 'Three-year model, first pass. Mostly checking the assumptions are not silly.',
      documents: [] as Record<string, unknown>[],
      summaryFeedback: null,
      strengths: [] as Record<string, unknown>[],
      improvements: [] as Record<string, unknown>[],
      scoreOverall: null,
      scoresByArea: {} as Record<string, number>,
      isPaid: true,
      agreedFee: 250,
      currency: 'EUR',
      requestedAt: previewIsoInDays(-2, 9),
      acceptedAt: null,
      dueDate: previewIsoInDays(9, 9),
      submittedAt: null,
      rating: null,
      ratingComment: null,
    },
  ];
}

/**
 * The expert directory, from the same mentors /coaching lists.
 *
 * Their standing is counted from the reviews above rather than written out, so
 * the directory and the review list cannot disagree about how many reviews an
 * expert has delivered.
 */
function previewExperts() {
  const reviews = previewExpertReviews();
  return previewMentors().map((m) => {
    const delivered = reviews.filter((r) => r.expert.id === m.userId && r.status === 'submitted');
    const ratings = delivered.map((r) => r.rating).filter((r): r is number => r != null);
    return {
      id: m.userId,
      userId: m.userId,
      displayName: m.displayName,
      headline: m.headline,
      bio: m.bio,
      avatarUrl: m.avatarUrl,
      skills: m.skills,
      specializations: m.skills,
      industries: m.industries,
      isVerified: m.availabilityStatus === 'available',
      isFree: m.isFree,
      feeFrom: m.isFree ? null : m.hourlyRate,
      currency: m.currency ?? 'EUR',
      completedReviews: delivered.length,
      rating: ratings.length
        ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
        : null,
    };
  });
}

function kitchenSink() {
  return {
    ok: true,
    success: true,
    items: [],
    data: [],
    results: [],
    hits: PEOPLE,
    suggestions: PEOPLE,
    posts: FEED_POSTS,
    notifications: NOTIFICATIONS,
    conversations: CONVERSATIONS,
    connections: CONNECTIONS,
    boards: listPreviewResearchBoardSummaries(false),
    events: [],
    members: [],
    users: [],
    groups: [],
    jobs: [],
    opportunities: [],
    programs: [],
    milestones: [],
    subscription: null,
    profile: ME_PROFILE.profile,
    // Zero, like the lists: the fallback answers every unhandled list endpoint
    // with an empty `programs` / `items` / `rules`, and a total of four beside
    // them put "Total Programs 4", "Total Skills 4" and "Total Rules 4" over
    // "No programs found", "No skills yet" and "No automation rules".
    total: 0,
    hasMore: false,
    nextCursor: null,
    count: 2,
    enabled: false,
    accounts: [],
    ids: [],
    skills: [
      { id: 'product', name: 'Product', slug: 'product', category: 'business' },
      { id: 'growth', name: 'Growth', slug: 'growth', category: 'business' },
      { id: 'typescript', name: 'TypeScript', slug: 'typescript', category: 'engineering' },
    ],
    agents: [
      {
        id: 'general',
        name: 'General assistant',
        description: 'Preview AI helper',
        suggestedQuestions: ['How do I find a cofounder?', 'What should I do next?'],
      },
    ],
    models: [],
    available: false,
    default: 'general',
  };
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  try {
    if (typeof init?.body === 'string') return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * The demo world keeps time with the reader's calendar.
 *
 * Every date here was written against one frozen day (`NOW`, 4 Sept 2026).
 * The pages compare against the real clock, so as weeks passed the demo
 * contradicted itself: /events listed "upcoming" events that /events/[id]
 * called ended, milestones due in "a week" were a month overdue, and the
 * feed's "2 days ago" was three weeks old. The payloads now move forward by
 * whole weeks - weekdays and times of day stay what the seed intended - to
 * the reader's current week, and a date sent in (a new milestone's due date)
 * moves back by the same amount before it is stored, so a round trip is
 * exact. `resolvePreviewApi` answers on the seed's calendar; where it asks
 * "what is now" (the upcoming/past split, request-time stamps) it uses
 * `previewNowMs()`, which is the seed day whenever the system clock is pinned
 * to it - as the preview tests do.
 */

function shiftIso(value: string, offsetMs: number): string {
  if (ISO_DATE_TIME.test(value)) return new Date(Date.parse(value) + offsetMs).toISOString();
  if (ISO_DATE.test(value)) return new Date(Date.parse(`${value}T00:00:00.000Z`) + offsetMs).toISOString().slice(0, 10);
  return value;
}

/** Moves every ISO date in a payload by `offsetMs`. Pure; returns a copy. */
export function shiftPreviewDates<T>(payload: T, offsetMs: number): T {
  if (!offsetMs) return payload;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return shiftIso(v, offsetMs);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = walk(x);
      return out;
    }
    return v;
  };
  return walk(payload) as T;
}

/** The preview API as the app sees it: on the reader's calendar. */
export function resolvePreviewApiNow(path: string, init?: RequestInit): unknown {
  const offset = previewClockOffsetMs();
  if (!offset) return resolvePreviewApi(path, init);
  let shiftedInit = init;
  if (typeof init?.body === 'string') {
    try {
      shiftedInit = { ...init, body: JSON.stringify(shiftPreviewDates(JSON.parse(init.body), -offset)) };
    } catch {
      /* not JSON: pass through */
    }
  }
  return shiftPreviewDates(resolvePreviewApi(path, shiftedInit), offset);
}

/** Returns a payload for preview, or null to fall through (never used — always resolve). */
export function resolvePreviewApi(path: string, init?: RequestInit): unknown {
  const pathname = pathnameOf(path);
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = parseBody(init);

  // The organisation, its programs and its tenant: one world, one module.
  const orgAnswer = previewOrgApi(pathname, path, method, previewIsoInDays);
  if (orgAnswer !== undefined) return orgAnswer;
  // Need cards and the commitment ladder: the demo world applies the same
  // shared rules as the API, and throws its refusals in the API's shape.
  const commitmentsAnswer = previewCommitmentsApi(pathname, path, method, body, previewNowMs());
  if (commitmentsAnswer !== undefined) return commitmentsAnswer;
  const verificationAnswer = previewVerificationApi(pathname, method, (body ?? {}) as Record<string, unknown>, previewNowMs());
  if (verificationAnswer !== undefined) return verificationAnswer;
  // Saved searches answer in the API's shapes instead of the generic fallback.
  const savedSearchAnswer = previewSavedSearchesApi(pathname, method, (body ?? {}) as Record<string, unknown>, previewNowMs());
  if (savedSearchAnswer !== undefined) return savedSearchAnswer;
  // Following and founder updates, with the API's rules and refusals.
  const updatesAnswer = previewUpdatesApi(pathname, method, (body ?? {}) as Record<string, unknown>, previewNowMs());
  if (updatesAnswer !== undefined) return updatesAnswer;
  // Saved listings and jobs, looked up in the demo's own lists.
  const savedItemsAnswer = previewSavedItemsApi(
    pathname,
    new URLSearchParams(path.split('?')[1] ?? ''),
    method,
    (body ?? {}) as Record<string, unknown>,
    previewNowMs(),
    (kind, itemId) => (kind === 'opportunity'
      ? PREVIEW_OPPORTUNITIES.find((o) => o.id === itemId)?.title
      : PREVIEW_JOBS.find((j) => j.id === itemId)?.title) ?? null,
  );
  if (savedItemsAnswer !== undefined) return savedItemsAnswer;
  // "Open to" and warm introductions; accepting an introduction answers the
  // need card in the commitments world above.
  const openToAnswer = previewOpenToApi(pathname, method, (body ?? {}) as Record<string, unknown>, previewNowMs());
  if (openToAnswer !== undefined) return openToAnswer;
  const introsAnswer = previewIntrosApi(pathname, path, method, (body ?? {}) as Record<string, unknown>, previewNowMs());
  if (introsAnswer !== undefined) return introsAnswer;
  // Skills tied to the demo's own completed work.
  const evidenceAnswer = previewSkillEvidenceApi(pathname, method, (body ?? {}) as Record<string, unknown>, previewNowMs());
  if (evidenceAnswer !== undefined) return evidenceAnswer;
  // The co-founder scout: proposals only, from the demo world's people.
  const scoutAnswer = previewScoutApi(pathname, method, (body ?? {}) as Record<string, unknown>, previewNowMs());
  if (scoutAnswer !== undefined) return scoutAnswer;
  // The transparency report: what this demo session's rules refused.
  const transparencyAnswer = previewTransparencyApi(pathname, path, previewNowMs());
  if (transparencyAnswer !== undefined) return transparencyAnswer;
  // The landing page's counts, counted from the demo world so demo mode
  // shows the demo's real numbers rather than fabricated ones.
  if (pathname === '/api/public/stats') {
    const memberIds = new Set<string>([
      ME_ID,
      ...PEOPLE.map((p) => p.userId),
      ...ORG_STAFF.map((p) => p.id),
      ...ORG_MENTORS.map((p) => p.id),
      ...ORG_INVESTORS.map((p) => p.id),
      ...Object.keys(ORG_FOUNDERS),
    ]);
    const mentorIds = new Set<string>([
      ...PEOPLE.filter((p) => p.role === 'mentor').map((p) => p.userId),
      ...ORG_MENTORS.map((p) => p.id),
    ]);
    return {
      members: memberIds.size,
      mentors: mentorIds.size,
      connections: CONNECTIONS.filter((c) => c.status === 'accepted').length,
      events: PREVIEW_EVENTS.length,
      organizations: 1,
      measuredAt: new Date(previewNowMs()).toISOString(),
    };
  }

  if (pathname === `/api/org/${ORG_SLUG}/opportunities`) {
    const opportunities = PREVIEW_OPPORTUNITIES.filter((o) => o.company === ORG.name);
    return { opportunities, total: opportunities.length };
  }

  if (pathname === '/api/auth/me') {
    return {
      user: {
        id: ME_ID,
        email: 'demo@cofounderbay.com',
        role: 'founder',
        emailVerified: true,
      },
    };
  }
  if (pathname === '/api/me/profile') {
    // Settings' visibility switches are stored for the demo; the rest of the
    // profile stays the demo's own.
    // The switches live on the profile, as the API keeps them (`profile.visibilityRules`).
    if (method === 'PATCH' && body && typeof body === 'object' && 'visibilityRules' in (body as Record<string, unknown>)) {
      return { ...ME_PROFILE.profile, visibilityRules: writeDemoVisibility((body as Record<string, unknown>).visibilityRules) };
    }
    return { ...ME_PROFILE, profile: { ...ME_PROFILE.profile, visibilityRules: readDemoVisibility() ?? ME_PROFILE.profile.visibilityRules } };
  }
  if (pathname === '/api/auth/refresh' || pathname === '/api/auth/logout') {
    return { ok: true };
  }

  if (pathname.startsWith('/api/search/profiles') || pathname === '/api/search' || pathname.startsWith('/api/v1/search')) {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const q = params.get('q')?.toLowerCase() ?? '';
    const location = params.get('location')?.toLowerCase() ?? '';
    const category = params.get('category') ?? 'all';
    // `roles` narrows the directory the way the API does: /mentoring asks for
    // mentors and was shown every founder in the fixtures as one.
    const roles = (params.get('roles') ?? '').split(',').filter(Boolean);
    const investmentStages = (params.get('investmentStages') ?? '').split(',').filter(Boolean);
    // The organisation's other mentors join the directory when mentors are
    // asked for, so /mentoring lists the coaches /org/mentors already shows.
    const orgMentorHits = ORG_MENTORS.filter((m) => m.id !== ME_ID && !PEOPLE.some((p) => p.userId === m.id)).map((m) => ({
      id: `hit-${m.id}`,
      userId: m.id,
      displayName: m.name,
      headline: m.headline,
      bio: `Mentors early-stage founders on ${m.expertise.slice(0, 2).join(' and ').toLowerCase()}.`,
      avatarUrl: null,
      location: m.location,
      role: 'mentor',
      skillNames: m.expertise,
      skills: m.expertise.slice(0, 2),
      industries: [] as string[],
      matchScore: undefined as number | undefined,
      matchReasons: [] as string[],
      lookingFor: 'mentees',
      availability: 'part-time',
      lastSeenSecondsAgo: 86_400,
      joinedAt: previewIsoInDays(-m.joined, 9),
    }));
    const pool = roles.includes('mentor') ? [...PEOPLE, ...orgMentorHits] : PEOPLE;
    // The sheet's industry, skill and commitment filters, as the API applies
    // them; a place matches in either language («Λεμεσός» finds "Limassol").
    const listParam = (name: string) => (params.get(name) ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
    const industries = listParam('industries');
    const skills = listParam('skills');
    const commitment = listParam('commitment');
    const places = location ? placeVariants(location).map((v) => v.toLowerCase()) : [];
    const people = pool.filter((p) => {
      const blob = `${p.displayName} ${p.headline} ${p.bio} ${p.skillNames.join(' ')} ${p.lookingFor} ${p.role}`.toLowerCase();
      const qOk = !q || q.split(/\s+/).every((token) => blob.includes(token) || p.location.toLowerCase().includes(token));
      const locOk = !location || places.some((v) => p.location.toLowerCase().includes(v) || blob.includes(v));
      // A co-founder candidate is a founder account in the API's role enum.
      const roleOk = !roles.length || roles.includes(p.role) || (p.role === 'cofounder' && roles.includes('founder'));
      const industryOk = !industries.length || p.industries.some((i) => industries.includes(i.toLowerCase()));
      const skillOk = !skills.length || p.skillNames.some((sk) => skills.includes(sk.toLowerCase()));
      const commitmentOk = !commitment.length || commitment.includes(String(p.availability ?? '').toLowerCase());
      const stages: readonly string[] = 'investmentStages' in p && Array.isArray(p.investmentStages) ? p.investmentStages : [];
      const stageOk = !investmentStages.length || investmentStages.some((st) => stages.includes(st));
      return qOk && locOk && roleOk && stageOk && industryOk && skillOk && commitmentOk;
    });
    const peopleHits = people.map((p) => ({
      id: p.userId,
      type: 'user' as const,
      title: p.displayName,
      subtitle: p.headline,
      description: p.bio,
      href: `/profiles/${p.userId}`,
      meta: { location: p.location },
      tags: p.skillNames,
    }));
    const mentors = peopleHits.filter((_, i) => people[i]?.role === 'mentor');
    const jobs = [
      {
        id: 'job-fullstack',
        type: 'job' as const,
        title: 'Technical cofounder',
        subtitle: 'Harbor · Full-time',
        description: 'Ship the founder OS. TypeScript, Next.js, Nest.',
        href: '/jobs',
        meta: { location: 'Athens / Remote' },
        tags: ['TypeScript', 'Next.js'],
      },
    ].filter((j) => !q || `${j.title} ${j.description} ${j.subtitle}`.toLowerCase().includes(q));
    const events = [
      {
        id: 'event-mixer',
        type: 'event' as const,
        title: 'Startup Networking Mixer',
        subtitle: 'Athens',
        description: 'Founders, mentors, and angels — one evening.',
        href: '/events',
        meta: { location: 'Athens' },
      },
    ].filter((e) => !q || `${e.title} ${e.description}`.toLowerCase().includes(q));
    const groups = [
      {
        id: 'group-founders',
        type: 'group' as const,
        title: 'Mediterranean Founders',
        subtitle: 'Community',
        description: 'Early-stage founders across GR / CY / the Med.',
        href: '/groups',
      },
    ].filter((g) => !q || `${g.title} ${g.description}`.toLowerCase().includes(q));
    const opportunities = [
      {
        id: 'opp-seed',
        type: 'opportunity' as const,
        title: 'Pre-seed office hours',
        subtitle: 'Harbor Angels',
        description: '15-minute intro slots for Mediterranean B2B SaaS.',
        href: '/opportunities',
      },
    ].filter((o) => !q || `${o.title} ${o.description}`.toLowerCase().includes(q));

    const results = category === 'all'
      ? [...peopleHits, ...jobs, ...events, ...groups, ...opportunities]
      : category === 'mentors'
        ? mentors
        : category === 'people'
          ? peopleHits
          : category === 'jobs'
            ? jobs
            : category === 'events'
              ? events
              : category === 'groups'
                ? groups
                : category === 'opportunities'
                  ? opportunities
                  : peopleHits;

    /*
     * Presence is a five-minute window on `lastSeenAt`, the same rule the API
     * and the directory header use. The fixtures carry an age rather than a
     * timestamp so the demo has someone online whenever it is opened, and the
     * header counts are derived from the very rows below them — the directory
     * cannot show "2 online" over a list where nobody has a dot.
     */
    const nowSeconds = Math.floor(previewNowMs() / 1000);
    const weekAgo = new Date(previewNowMs() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const directoryHits = people.map((p) => ({
      ...p,
      createdAt: Math.floor(new Date(p.joinedAt).getTime() / 1000),
      lastSeenAt: p.lastSeenSecondsAgo == null ? null : nowSeconds - p.lastSeenSecondsAgo,
    }));

    return {
      hits: directoryHits,
      // The demo's one paid-plan member, so the labelled slot can be seen.
      promotedUserIds: directoryHits.some((h) => h.userId === 'user-sarah') ? ['user-sarah'] : [],
      results,
      // Profile search counts profiles: /members said "8 members found" over
      // four cards, because this counted every result type (people, jobs,
      // events, groups). The network search keeps its all-types total.
      total: pathname.startsWith('/api/search/profiles') ? directoryHits.length : results.length,
      stats: {
        onlineNow: directoryHits.filter((p) => p.lastSeenAt != null && nowSeconds - p.lastSeenAt <= 300).length,
        newThisWeek: people.filter((p) => p.joinedAt >= weekAgo).length,
        mentors: people.filter((p) => p.role === 'mentor').length,
      },
      categories: {
        people: peopleHits.length,
        jobs: jobs.length,
        events: events.length,
        groups: groups.length,
        mentors: mentors.length,
        opportunities: opportunities.length,
      },
    };
  }
  // The match detail page (/matches/[userId]) reads this one, and it has to come
  // before the generic /api/recommendations branch below or it never matches.
  // Without it the page fell through to the generic fallback, whose object has no
  // `overall`, and every match rendered "Could not load compatibility data."
  // Shape must match MatchVsResult in lib/api.ts.
  if (/^\/api\/recommendations\/vs\//.test(pathname)) {
    const targetId = pathname.split('/').pop() ?? '';
    const target = PEOPLE.find((p) => p.userId === targetId) ?? PEOPLE[0];
    const score = target.matchScore ?? 80;
    return {
      overall: { score, confidence: Math.min(99, score + 4) },
      breakdown: [
        { key: 'skills', label: 'Skills', score: Math.min(100, score + 5), color: 'hsl(var(--status-success-mark))' },
        { key: 'stage', label: 'Stage', score: Math.max(0, score - 7), color: 'hsl(var(--status-info-mark))' },
        { key: 'industry', label: 'Industry', score: Math.min(100, score + 2), color: 'hsl(var(--status-accent-mark))' },
        { key: 'location', label: 'Location', score: Math.max(0, score - 18), color: 'hsl(var(--status-warning-mark))' },
        { key: 'values', label: 'Values', score: Math.max(0, score - 3), color: 'hsl(var(--status-success-mark))' },
      ],
      badges: ['Complementary skills', 'Same stage'],
      sharedStrengths: [
        { icon: 'target', label: 'Both focused on early-stage traction' },
        { icon: 'spark', label: 'Overlapping product instincts' },
      ],
      frictionPoints: [
        {
          icon: 'clock',
          title: 'Different time zones',
          description: 'Plan a fixed weekly overlap so decisions do not wait a day.',
        },
      ],
      workStyle: {
        axes: ['Pace', 'Structure', 'Risk', 'Detail', 'Autonomy'],
        source: [78, 62, 70, 55, 80],
        target: [70, 74, 58, 72, 66],
      },
      reasons: target.matchReasons ?? ['Complementary skills'],
      sourceProfile: {
        id: ME_ID,
        role: 'founder',
        displayName: 'Alex Demo',
        headline: 'Founder — building CoFounderBay',
        avatarUrl: undefined,
        location: 'Athens, Greece',
      },
      targetProfile: {
        id: target.userId,
        role: target.role,
        displayName: target.displayName,
        headline: target.headline,
        avatarUrl: target.avatarUrl ?? undefined,
        location: target.location,
      },
    };
  }
  /*
   * The compatibility modal reads the engine's per-dimension breakdown. In the
   * demo there is no engine, so the axes are computed here from the very
   * fields the two profiles show — skills held in common, industry, city — and
   * never from the overall score. A breakdown derived from its own summary is
   * the thing this endpoint exists to replace.
   */
  const vsMatch = pathname.match(/^\/api\/recommendations\/vs\/([^/]+)$/);
  if (vsMatch) {
    const target = PEOPLE.find((p) => p.userId === vsMatch[1] || p.id === vsMatch[1]);
    if (!target) return { error: 'Not found' };
    const mySkills = ME_PROFILE.profile.skills.map((sk) => sk.skillName.toLowerCase());
    const theirSkills = target.skillNames.map((n) => n.toLowerCase());
    const shared = theirSkills.filter((n) => mySkills.includes(n));
    const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));
    const sameCity = target.location.split(',')[0]?.trim() === ME_PROFILE.profile.location.split(',')[0]?.trim();
    const sameCountry = target.location.split(',').pop()?.trim() === ME_PROFILE.profile.location.split(',').pop()?.trim();
    // A co-founder search rewards complement, not similarity: the skills axis
    // reads what they bring that the viewer does not.
    const complement = pct(theirSkills.length - shared.length, Math.max(theirSkills.length, 1));
    // Six categorical axes -> the six chart slots. These strings resolve in
    // the DOM (FactorRow paints them as inline `background`), so they follow
    // the active theme instead of a fixed Tailwind palette.
    const axes = [
      { key: 'role', label: 'Role Complementarity', score: target.role === ME_PROFILE.profile.role ? 45 : 88, color: 'hsl(var(--primary))' },
      { key: 'skills', label: 'Skills & Expertise', score: complement, color: 'hsl(var(--chart-2))' },
      { key: 'semantic', label: 'Vision & Goals', score: target.matchScore ?? 50, color: 'hsl(var(--chart-4))' },
      { key: 'industry', label: 'Industry Alignment', score: target.industries.includes('SaaS') ? 82 : 40, color: 'hsl(var(--chart-3))' },
      { key: 'location', label: 'Location Fit', score: sameCity ? 100 : sameCountry ? 70 : 35, color: 'hsl(var(--chart-5))' },
      { key: 'behavioral', label: 'Platform Activity', score: target.lastSeenSecondsAgo == null ? 30 : 85, color: 'hsl(var(--chart-6))' },
    ];
    return {
      overall: {
        score: Math.round(axes.reduce((sum, ax) => sum + ax.score, 0) / axes.length),
        confidence: Math.min(95, 40 + theirSkills.length * 10),
      },
      breakdown: axes,
      badges: axes.filter((ax) => ax.score >= 80).map((ax) => ax.label).slice(0, 3),
      sharedStrengths: shared.length
        ? [`Both of you work on ${shared.join(' and ')}.`]
        : [],
      frictionPoints: sameCity ? [] : [`Different cities — ${target.location} and ${ME_PROFILE.profile.location}.`],
      reasons: target.matchReasons,
    };
  }
  if (pathname.startsWith('/api/recommendations') || pathname.startsWith('/api/matching/recommendations')) {
    return { suggestions: PEOPLE };
  }

  if (pathname === '/api/messages/conversations') {
    return { conversations: CONVERSATIONS };
  }
  if (pathname === '/api/messages/conversations/direct' && method === 'POST') {
    return { conversationId: 'conv-elena' };
  }
  const messagesMatch = pathname.match(/^\/api\/messages\/conversations\/([^/]+)\/messages$/);
  if (messagesMatch) {
    return { messages: MESSAGES[messagesMatch[1]] ?? [] };
  }
  const validationMatch = pathname.match(/^\/api\/messages\/conversations\/([^/]+)\/validation/);
  if (validationMatch) {
    return {
      success: true,
      validationState: {
        mode: 'casual',
        initiatedBy: null,
        initiatedAt: null,
        acceptedBy: null,
        acceptedAt: null,
        lastValidatedAt: null,
        validationHash: null,
        transcriptAvailable: false,
      },
    };
  }

  if (pathname === '/api/notifications' || pathname.startsWith('/api/notifications?')) {
    return { notifications: NOTIFICATIONS, nextCursor: null };
  }
  if (pathname === '/api/notifications/unread-count') {
    return { count: 2 };
  }

  // The account export, built from the demo's own records the way the API
  // builds it from the database: only what the demo user owns or sent.
  if (pathname === '/api/account/export') {
    const all = ['profile', 'messages', 'connections', 'activity', 'milestones', 'settings'];
    const asked = (new URLSearchParams(path.split('?')[1] ?? '').get('sections') ?? '').split(',').filter((x) => all.includes(x));
    const sections = asked.length ? all.filter((x) => asked.includes(x)) : all;
    const p = ME_PROFILE.profile;
    const data: Record<string, unknown> = {};
    if (sections.includes('profile')) {
      data.profile = {
        account: { id: ME_ID, email: p.email, role: p.role, emailVerified: true, twoFactorEnabled: false, createdAt: p.createdAt },
        profile: { displayName: p.displayName, headline: p.headline, bio: p.bio, location: p.location, timezone: p.timezone, languages: p.languages, rolePayload: p.rolePayload },
        skills: p.skills.map((s) => s.skillName),
      };
    }
    if (sections.includes('messages')) {
      const sent = Object.values(MESSAGES).flat().filter((m) => m.senderId === ME_ID).map((m) => ({ id: m.id, conversationId: m.conversationId, body: m.body, createdAt: m.createdAt }));
      data.messages = { sent: { items: sent, truncated: false } };
    }
    if (sections.includes('connections')) {
      data.connections = {
        items: CONNECTIONS.filter((c) => c.requesterId === ME_ID || c.receiverId === ME_ID).map((c) => ({
          id: c.id,
          direction: c.requesterId === ME_ID ? 'sent' : 'received',
          otherUserId: c.requesterId === ME_ID ? c.receiverId : c.requesterId,
          status: c.status,
          createdAt: c.createdAt,
        })),
        truncated: false,
      };
    }
    if (sections.includes('activity')) {
      data.activity = { notifications: { items: NOTIFICATIONS.map((n) => ({ type: n.type, title: n.title, createdAt: n.createdAt })), truncated: false } };
    }
    if (sections.includes('milestones')) {
      applyHarborMilestoneSeedIfStale();
      data.milestones = { items: previewMilestones.filter((m) => m.ownerId === ME_ID).map((m) => ({ id: m.id, title: m.title, status: m.status, dueDate: m.dueDate, progress: m.progress })), truncated: false };
    }
    if (sections.includes('settings')) {
      data.settings = { visibilityRules: p.visibilityRules, twoFactorEnabled: false, emailVerified: true, linkedAccounts: { google: false, linkedin: false } };
    }
    return { format: 'cofounderbay-export-v1', exportedAt: new Date(previewNowMs()).toISOString(), userId: ME_ID, sections, unavailable: [], data };
  }

  if (pathname.startsWith('/api/connections')) {
    // Withdrawing a request the demo user sent. The showcase keeps no server
    // state, so it answers the shape the caller reads and nothing more.
    if (method === 'DELETE') {
      return { ok: true, connectionId: pathname.split('/')[3] ?? '' };
    }
    if (pathname.includes('/status/')) {
      return { status: 'pending', connectionId: 'conn-elena', direction: 'received' };
    }
    if (method === 'GET') {
      const type = new URLSearchParams(path.split('?')[1] ?? '').get('type');
      const connections =
        type === 'sent'
          ? CONNECTIONS.filter((c) => c.requesterId === ME_ID)
          : type === 'accepted'
            ? CONNECTIONS.filter((c) => c.status === 'accepted')
            : type === 'received'
              ? CONNECTIONS.filter((c) => c.receiverId === ME_ID && c.status === 'pending')
              : CONNECTIONS;
      return { connections };
    }
    if (method === 'POST') {
      const receiverId = String(body.receiverId ?? 'user-marcus');
      const person = PEOPLE.find((p) => p.userId === receiverId) ?? PEOPLE[1];
      const created = {
        id: `conn-${Date.now()}`,
        requesterId: ME_ID,
        receiverId: person.userId,
        status: 'pending',
        message: String(body.message ?? ''),
        createdAt: NOW,
        updatedAt: NOW,
        requester: {
          id: ME_ID,
          displayName: 'Alex Demo',
          avatarUrl: null,
          role: 'founder',
          headline: 'Founder exploring CoFounderBay',
        },
        receiver: {
          id: person.userId,
          displayName: person.displayName,
          avatarUrl: null,
          role: person.role,
          headline: person.headline,
        },
      };
      CONNECTIONS.unshift(created);
      return { connection: created, ok: true };
    }
    return { connection: CONNECTIONS[0], ok: true };
  }

  if (pathname === '/api/dashboard/stats') {
    return {
      activeProfiles: 1840,
      matchesThisWeek: 12,
      trendPercent: 18,
      chartData: [
        { label: 'Mon', value: 4 },
        { label: 'Tue', value: 7 },
        { label: 'Wed', value: 6 },
        { label: 'Thu', value: 9 },
        { label: 'Fri', value: 12 },
      ],
      // Counted from the demo world rather than stated, so the /discover
      // header agrees with the directory and the groups list below it.
      founders: PEOPLE.filter((p) => p.role === 'founder').length,
      mentors: PEOPLE.filter((p) => p.role === 'mentor').length,
      successfulMatches: CONNECTIONS.length,
      communities: PREVIEW_GROUPS.length,
    };
  }
  if (pathname === '/api/dashboard/me') {
    return {
      pendingReceived: 1,
      totalConnections: 8,
      newConnectionsThisWeek: 2,
      unreadMessages: 1,
      unreadNotifications: 2,
      upcomingEvents: 3,
      activeMilestones: 4,
    };
  }
  if (pathname.startsWith('/api/dashboard/activity')) {
    return {
      items: [
        {
          id: 'act-1',
          type: 'connection',
          title: 'Elena Papadopoulos wants to connect',
          author: 'Elena Papadopoulos',
          timeAgo: '2h',
          href: '/connections',
          createdAt: NOW,
        },
        {
          id: 'act-2',
          type: 'match',
          title: 'New match: Marcus Chen',
          author: 'Marcus Chen',
          timeAgo: '1d',
          href: '/matches',
          createdAt: '2026-09-03T08:00:00.000Z',
        },
      ],
      total: 2,
      hasMore: false,
    };
  }
  if (pathname === '/api/dashboard/venture-readiness') {
    /*
     * Platform engagement, not startup readiness - two different questions that
     * used to wear the same name here.
     *
     * This endpoint asks how much of the platform the founder has actually
     * used; /readiness asks how close the venture is to raising. This payload
     * once answered with three dimensions called Team, Product and Market -
     * three of the six names /readiness uses for the other question - so the
     * two screens looked like they disagreed about one number when they were
     * never measuring the same thing. The six below are the dimensions
     * `computeVentureReadiness` really returns, with its real weights.
     *
     * Every score is derived from `signals` with that method's own thresholds,
     * so the demo agrees with what the other demo screens show: one research
     * board holding six items (/research), two documents in one workspace
     * (/builder), eight connections and one mentoring session.
     */
    const signals = {
      boardCount: 1,
      totalNodes: 6,
      docCount: 2,
      connectionCount: 8,
      sessionCount: 1,
      recentConnectionCount: 2,
      eventRsvpCount: 2,
      groupCount: 2,
    };

    // 9 of the 10 profile checks - everything but "7+ skills", which is why the
    // profile-strength card says "Skills (5+)".
    const profileScore = 90;
    // 20 for having a board + 20 for five or more nodes.
    const researchScore = 40;
    // 20 for having a workspace + 20 for at least one document.
    const artifactScore = 40;
    // 15 + 15 for eight connections, + 20 for one session.
    const collaborationScore = 50;
    // 50 for at least one connection accepted in the last 14 days.
    const momentumScore = 50;
    // 25 for an event RSVP + 25 for a group membership.
    const ecosystemScore = 50;

    const dimensions = [
      { key: 'profile', label: 'Profile Depth', score: profileScore, weight: 15, href: '/profile' },
      { key: 'research', label: 'Research Depth', score: researchScore, weight: 20, href: '/research' },
      { key: 'artifacts', label: 'Artifact Quality', score: artifactScore, weight: 25, href: '/builder' },
      { key: 'collaboration', label: 'Collaboration', score: collaborationScore, weight: 20, href: '/connections' },
      { key: 'momentum', label: 'Momentum (14d)', score: momentumScore, weight: 10, href: '/activity' },
      { key: 'ecosystem', label: 'Ecosystem Engagement', score: ecosystemScore, weight: 10, href: '/events' },
    ];

    return {
      overall: Math.round(
        profileScore * 0.15 +
          researchScore * 0.2 +
          artifactScore * 0.25 +
          collaborationScore * 0.2 +
          momentumScore * 0.1 +
          ecosystemScore * 0.1,
      ),
      dimensions,
      lowestDimension: [...dimensions].sort((a, b) => a.score - b.score)[0],
      signals,
    };
  }

  // Publishing a pitch in the demo: kept for the session; the public page then
  // shows the sample deck, since the demo's slides are not on a server.
  if (pathname.startsWith('/api/pitch/publication')) {
    const KEY = 'cfb:demo-pitch-publication:v1';
    const read = (): Record<string, { id: string; isPublic: boolean; allowContact: boolean; views: number; contactRequests: number }> => {
      try {
        return JSON.parse(window.sessionStorage.getItem(KEY) ?? '{}');
      } catch {
        return {};
      }
    };
    const write = (state: ReturnType<typeof read>) => {
      try {
        window.sessionStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        // storage blocked: the change lasts this page view
      }
    };
    const state = read();
    if (method === 'GET') {
      const documentId = new URLSearchParams(path.split('?')[1] ?? '').get('documentId') ?? '';
      return { pitch: state[documentId] ?? null };
    }
    if (method === 'POST') {
      const documentId = typeof body.documentId === 'string' ? body.documentId : '';
      const previous = state[documentId];
      state[documentId] = { id: previous?.id ?? `demo-${documentId || 'deck'}`, isPublic: true, allowContact: body.allowContact !== false, views: previous?.views ?? 0, contactRequests: previous?.contactRequests ?? 0 };
      write(state);
      return { pitch: state[documentId] };
    }
    if (method === 'DELETE') {
      const documentId = decodeURIComponent(pathname.split('/').pop() ?? '');
      if (state[documentId]) state[documentId].isPublic = false;
      write(state);
      return { ok: true };
    }
  }
  // The demo keeps a composed post for the session and says it did not store it.
  if (pathname === '/api/feed/posts' && method === 'POST') {
    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 3000) : '';
    const type = typeof body.type === 'string' ? (body.type as FeedPost['type']) : 'update';
    const [post] = addComposedPost({ content, type, author: { id: 'me', displayName: 'You', headline: undefined } });
    return { post, stored: false };
  }
  if (pathname.startsWith('/api/feed/personalized')) {
    return { posts: FEED_POSTS, hasMore: false };
  }
  if (pathname === '/api/feed/preferences') {
    return {
      topics: ['fundraising', 'product'],
      roles: ['founder', 'mentor'],
      contentTypes: ['update', 'milestone', 'question'],
      interactionWeights: { likes: 1, comments: 1, shares: 1, bookmarks: 1 },
      timeDecayHours: 72,
      diversityBoost: 0.2,
    };
  }
  if (pathname.startsWith('/api/feed/trending')) {
    return {
      topics: [
        { tag: 'fundraising', posts: 42, engagement: 210, growth: 18 },
        { tag: 'ai', posts: 31, engagement: 180, growth: 24 },
      ],
    };
  }

  if (pathname === '/api/research/boards') {
    if (method === 'POST') {
      const now = new Date(previewNowMs()).toISOString();
      const board: ExtraPreviewBoard = {
        id: `board-preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId: ME_ID,
        title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Untitled board',
        description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
        visibility: typeof body.visibility === 'string' ? body.visibility : 'private',
        canvasState: {},
        tags: previewStringTags(body.tags),
        color: typeof body.color === 'string' ? body.color : null,
        icon: typeof body.icon === 'string' ? body.icon : 'document',
        isPinned: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        nodes: [],
        connectors: [],
      };
      previewExtraResearchBoards = [board, ...previewExtraResearchBoards];
      return { board: summarizeExtraBoard(board) };
    }
    const archived = path.includes('archived=1') || path.includes('archived=true');
    return { boards: listPreviewResearchBoardSummaries(archived) };
  }
  if (pathname.startsWith('/api/research/boards/')) {
    const rest = pathname.replace(/^\/api\/research\/boards\//, '');
    const segments = rest.split('/').filter(Boolean);
    const boardId = segments[0];
    const extra = findExtraPreviewBoard(boardId);
    const isGtm = boardId === 'board-gtm' && !previewGtmRemoved;
    if (!isGtm && !extra) {
      if (method === 'GET') return { board: null };
      return { ok: false, board: null };
    }

    // The AI panel in the demo: the same deterministic reading the API falls
    // back to without a model (`@cofounderbay/shared` canvas assist rules).
    if (segments[1] === 'ai' && method === 'POST') {
      const boardNodes = (isGtm ? previewGtmBoardNodes : extra?.nodes ?? []).map((n) => ({
        id: n.id,
        title: typeof n.title === 'string' ? n.title : '',
        content: typeof n.content === 'string' ? n.content : '',
      }));
      const ids = Array.isArray(body.nodeIds) ? body.nodeIds.filter((v): v is string => typeof v === 'string') : [];
      const picked = ids.length ? boardNodes.filter((n) => ids.includes(n.id)) : boardNodes;
      switch (segments[2]) {
        case 'extract':
          return { nodes: heuristicExtract(typeof body.text === 'string' ? body.text : ''), fallback: true };
        case 'connections':
          return { connections: heuristicConnections(picked), fallback: true };
        case 'synthesize':
          return { synthesis: heuristicSynthesis(picked), fallback: true };
        case 'questions':
          return { questions: heuristicQuestions(boardNodes, typeof body.focus === 'string' ? body.focus.trim() : ''), fallback: true };
        case 'chat':
          return {
            reply: `This is the demo, so no model reads the board. It holds ${boardNodes.length} notes; open the canvas copilot with the AI service running for a real answer.`,
            fallback: true,
          };
        default:
          break;
      }
    }
    if (segments[1] === 'nodes' && segments[2] === 'batch' && method === 'PATCH') {
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (isGtm) {
        previewGtmBoardNodes = applyPreviewNodeBatch(previewGtmBoardNodes, updates);
      } else if (extra) {
        extra.nodes = applyPreviewNodeBatch(extra.nodes, updates);
        extra.updatedAt = new Date(previewNowMs()).toISOString();
      }
      return { ok: true };
    }
    if (segments[1] === 'nodes' && method === 'POST') {
      const node = makePreviewResearchNode(boardId, body);
      if (isGtm) {
        previewGtmBoardNodes = [...previewGtmBoardNodes, node];
      } else if (extra) {
        extra.nodes = [...extra.nodes, node];
        extra.updatedAt = new Date(previewNowMs()).toISOString();
      }
      return { node };
    }
    if (segments[1] === 'connectors' && method === 'POST') {
      const connector: PreviewGtmConnector = {
        id: `c-preview-${Date.now()}`,
        boardId,
        fromNodeId: typeof body.fromNodeId === 'string' ? body.fromNodeId : '',
        toNodeId: typeof body.toNodeId === 'string' ? body.toNodeId : '',
        label: typeof body.label === 'string' ? body.label : null,
        color: typeof body.color === 'string' ? body.color : null,
        style: typeof body.style === 'string' ? body.style : 'solid',
      };
      if (isGtm) {
        previewGtmConnectors = [...previewGtmConnectors, connector];
      } else if (extra) {
        extra.connectors = [...extra.connectors, connector];
        extra.updatedAt = new Date(previewNowMs()).toISOString();
      }
      return { connector };
    }
    if (method === 'DELETE') {
      if (isGtm) previewGtmRemoved = true;
      else previewExtraResearchBoards = previewExtraResearchBoards.filter((board) => board.id !== boardId);
      return { ok: true };
    }
    if (method === 'PATCH' || method === 'PUT') {
      const stamp = new Date(previewNowMs()).toISOString();
      if (isGtm) {
        previewGtmMeta = applyPreviewBoardMeta(previewGtmMeta, body, stamp);
        if (body.canvasState && typeof body.canvasState === 'object') {
          previewGtmCanvasState = { ...previewGtmCanvasState, ...(body.canvasState as Record<string, unknown>) };
        }
        return previewGtmBoardResponse();
      }
      if (extra) {
        const next = applyPreviewBoardMeta(extra, body, stamp);
        if (body.canvasState && typeof body.canvasState === 'object') {
          next.canvasState = { ...extra.canvasState, ...(body.canvasState as Record<string, unknown>) };
        }
        previewExtraResearchBoards = previewExtraResearchBoards.map((board) => (board.id === extra.id ? next : board));
        return extraBoardResponse(next);
      }
    }
    if (isGtm) return previewGtmBoardResponse();
    return extra ? extraBoardResponse(extra) : { board: null };
  }

  const nodeItemMatch = pathname.match(/^\/api\/research\/nodes\/([^/]+)$/);
  if (nodeItemMatch) {
    const nodeId = nodeItemMatch[1];
    if (method === 'DELETE') {
      previewGtmBoardNodes = previewGtmBoardNodes.filter((n) => n.id !== nodeId);
      previewGtmConnectors = previewGtmConnectors.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId);
      previewExtraResearchBoards = previewExtraResearchBoards.map((board) =>
        board.nodes.some((n) => n.id === nodeId)
          ? {
              ...board,
              nodes: board.nodes.filter((n) => n.id !== nodeId),
              connectors: board.connectors.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId),
              updatedAt: new Date(previewNowMs()).toISOString(),
            }
          : board,
      );
      return { ok: true };
    }
    if (method === 'PATCH' || method === 'PUT') {
      let updated: PreviewGtmNode | undefined;
      if (previewGtmBoardNodes.some((n) => n.id === nodeId)) {
        previewGtmBoardNodes = previewGtmBoardNodes.map((node) => {
          if (node.id !== nodeId) return node;
          updated = applyPreviewNodePatch(node, body);
          return updated;
        });
      } else {
        previewExtraResearchBoards = previewExtraResearchBoards.map((board) => {
          if (!board.nodes.some((n) => n.id === nodeId)) return board;
          const nodes = board.nodes.map((node) => {
            if (node.id !== nodeId) return node;
            updated = applyPreviewNodePatch(node, body);
            return updated;
          });
          return { ...board, nodes, updatedAt: new Date(previewNowMs()).toISOString() };
        });
      }
      return { node: updated ?? null };
    }
  }

  const connectorItemMatch = pathname.match(/^\/api\/research\/connectors\/([^/]+)$/);
  if (connectorItemMatch) {
    const connectorId = connectorItemMatch[1];
    if (method === 'DELETE') {
      previewGtmConnectors = previewGtmConnectors.filter((c) => c.id !== connectorId);
      previewExtraResearchBoards = previewExtraResearchBoards.map((board) =>
        board.connectors.some((c) => c.id === connectorId)
          ? {
              ...board,
              connectors: board.connectors.filter((c) => c.id !== connectorId),
              updatedAt: new Date(previewNowMs()).toISOString(),
            }
          : board,
      );
      return { ok: true };
    }
    if (method === 'PATCH') {
      let updated: PreviewGtmConnector | undefined;
      if (previewGtmConnectors.some((c) => c.id === connectorId)) {
        previewGtmConnectors = previewGtmConnectors.map((connector) => {
          if (connector.id !== connectorId) return connector;
          updated = patchPreviewConnector(connector, body);
          return updated;
        });
      } else {
        previewExtraResearchBoards = previewExtraResearchBoards.map((board) => {
          if (!board.connectors.some((c) => c.id === connectorId)) return board;
          const connectors = board.connectors.map((connector) => {
            if (connector.id !== connectorId) return connector;
            updated = patchPreviewConnector(connector, body);
            return updated;
          });
          return { ...board, connectors, updatedAt: new Date(previewNowMs()).toISOString() };
        });
      }
      return { connector: updated ?? null };
    }
  }

  const nodeCommentsMatch = pathname.match(/^\/api\/research\/nodes\/([^/]+)\/comments$/);
  if (nodeCommentsMatch) {
    const nodeId = nodeCommentsMatch[1];
    if (method === 'GET') {
      const comments = previewResearchComments.filter((c) => c.nodeId === nodeId && !c.parentId);
      return {
        comments: comments.map((c) => ({
          ...c,
          replies: previewResearchComments.filter((r) => r.parentId === c.id),
        })),
      };
    }
    if (method === 'POST') {
      const comment = makePreviewResearchComment(nodeId, body);
      previewResearchComments = [...previewResearchComments, comment];
      return { comment };
    }
  }

  const commentItemMatch = pathname.match(/^\/api\/research\/comments\/([^/]+)$/);
  if (commentItemMatch) {
    const commentId = commentItemMatch[1];
    if (method === 'PATCH') {
      previewResearchComments = previewResearchComments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              body: typeof body.body === 'string' ? body.body : c.body,
              resolved: typeof body.resolved === 'boolean' ? body.resolved : c.resolved,
              updatedAt: new Date(previewNowMs()).toISOString(),
            }
          : c,
      );
      const comment = previewResearchComments.find((c) => c.id === commentId);
      return { comment: comment ?? makePreviewResearchComment('preview-node', body) };
    }
    if (method === 'DELETE') {
      previewResearchComments = previewResearchComments.filter((c) => c.id !== commentId && c.parentId !== commentId);
      return { ok: true };
    }
  }

  if (pathname === '/api/skills' || pathname.startsWith('/api/skills?')) {
    return kitchenSink().skills;
  }

  if (pathname === '/api/billing/subscription' || pathname.startsWith('/api/billing/subscription')) {
    return { subscription: null };
  }
  if (pathname.startsWith('/api/auth/2fa') || pathname.includes('two-factor')) {
    return { enabled: false };
  }
  if (pathname.includes('linked-accounts')) {
    return { accounts: [] };
  }

  if (pathname === '/api/roles/dashboard-context') {
    return {
      primaryRole: 'existing_founder',
      allRoles: [
        {
          id: 'preview-founder',
          roleType: 'existing_founder',
          scope: 'global',
          isPrimary: true,
          isVerified: true,
        },
      ],
      permissions: ['*'],
      dashboard: {
        defaultRoute: '/dashboard/founder',
        dashboardWidgets: [],
        sidebarItems: [],
        features: [],
      },
      organizations: [],
      tenants: [],
    };
  }

  if (pathname === '/api/shortlist/ids') {
    return { ids: [...SHORTLIST_IDS] };
  }
  if (pathname === '/api/shortlist' || pathname.startsWith('/api/shortlist?')) {
    if (method === 'POST') {
      const userId = String(body.userId ?? '');
      if (userId) SHORTLIST_IDS.add(userId);
      return { ok: true, saved: true, id: `sl-${userId || 'new'}` };
    }
    const items = PEOPLE.filter((p) => SHORTLIST_IDS.has(p.userId)).map((p) => ({
      id: `sl-${p.userId}`,
      userId: p.userId,
      note: null,
      savedAt: NOW,
      profile: {
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        headline: p.headline,
        role: p.role,
        location: p.location,
        skills: p.skills,
      },
    }));
    return { items, nextCursor: null };
  }
  if (pathname.startsWith('/api/shortlist/')) {
    const rest = pathname.replace('/api/shortlist/', '');
    const userId = rest.replace(/\/note$/, '');
    if (method === 'DELETE') {
      SHORTLIST_IDS.delete(userId);
      return { ok: true, saved: false };
    }
    if (method === 'PATCH') {
      return { ok: true };
    }
  }

  if (pathname === '/api/graph/me') {
    return {
      me: {
        id: ME_ID,
        displayName: 'Alex Demo',
        headline: 'Founder exploring CoFounderBay',
        role: 'founder',
        location: 'Athens, Greece',
        avatarUrl: null,
      },
      unreadMessages: 1,
      pendingIntros: 1,
      unreadNotifications: 2,
      readiness: { overall: 42, lowestLabel: 'Product', lowestHref: '/builder' },
      nextAction: { id: 'review-intros', label: 'Review pending intros', href: '/connections' },
    };
  }

  if (pathname === '/api/ai/health') {
    return { available: false, models: [] };
  }
  if (pathname === '/api/ai/agents') {
    return {
      agents: [
        {
          id: 'general',
          name: 'CoFounderBay Assistant',
          description: 'Search, intro, message, and navigate from one chat',
          suggestedQuestions: [
            'What should I do next?',
            'Find a technical cofounder in Athens',
            'Show my best matches',
          ],
        },
        {
          id: 'matching',
          name: 'Matching',
          description: 'Explain and act on cofounder matches',
          suggestedQuestions: ['Show my best matches', 'Connect with Elena'],
        },
      ],
    };
  }
  if (pathname === '/api/ai/models') {
    return { models: [], default: 'copilot' };
  }
  if (pathname === '/api/ai/preferences' || pathname.startsWith('/api/ai/preferences')) {
    return {
      preferences: {
        preferredModel: 'copilot',
        preferredProvider: 'platform',
        temperature: 0.7,
        maxTokens: 2048,
        responseStyle: 'concise',
        responseLanguage: 'en',
        useEmoji: false,
        enableStreaming: true,
        enableSuggestions: true,
        enableContextMemory: true,
        enableAutoSave: true,
        saveConversations: true,
        shareForTraining: false,
        anonymizeData: true,
        defaultAgent: 'general',
      },
    };
  }
  if (pathname === '/api/ai/conversations' && method === 'POST') {
    const conv = {
      id: `ai-conv-${Date.now()}`,
      userId: ME_ID,
      agentId: String(body.agentId ?? 'general'),
      title: String(body.title ?? 'New Conversation'),
      messages: [] as unknown[],
      createdAt: NOW,
      updatedAt: NOW,
    };
    PREVIEW_AI_CONVERSATIONS.unshift(conv);
    return { conversation: conv };
  }
  if (pathname === '/api/ai/conversations') {
    return { conversations: PREVIEW_AI_CONVERSATIONS };
  }
  const aiConvMatch = pathname.match(/^\/api\/ai\/conversations\/([^/]+)$/);
  if (aiConvMatch) {
    const conv = PREVIEW_AI_CONVERSATIONS.find((c) => c.id === aiConvMatch[1]);
    return { conversation: conv ?? PREVIEW_AI_CONVERSATIONS[0] ?? null, deleted: method === 'DELETE' };
  }
  if (pathname === '/api/ai/chat' || pathname === '/api/ai/chat/stream') {
    const text = String(body.message ?? '');
    // The server does two things with a `conversationId` that this layer
    // ignored: it appends both turns to the thread, and — if the thread is
    // still called "New Conversation" — it renames it after the first user
    // message (ai-conversation.service.ts:151, 50 chars + ellipsis). Without
    // either, every demo thread stayed "Νέα συνομιλία" forever and reopened
    // empty; the visitor's /ai sidebar was four identical rows. Same rule,
    // same truncation, so the two modes read alike.
    const convId = typeof body.conversationId === 'string' ? body.conversationId : null;
    const conv = convId ? PREVIEW_AI_CONVERSATIONS.find((c) => c.id === convId) : undefined;
    if (conv && text) {
      const reply = `Preview copilot received: “${text}”. Use the in-app assistant tools for live graph actions.`;
      const at = new Date(previewNowMs()).toISOString();
      conv.messages.push(
        { id: `ai-msg-${Date.now()}-u`, role: 'user', content: text, createdAt: at },
        { id: `ai-msg-${Date.now()}-a`, role: 'assistant', content: reply, model: 'copilot', createdAt: at },
      );
      conv.updatedAt = at;
      if (conv.title === 'New Conversation' || conv.title === 'New conversation' || !conv.title) {
        conv.title = text.slice(0, 50) + (text.length > 50 ? '...' : '');
      }
    }
    return {
      message: text
        ? `Preview copilot received: “${text}”. Use the in-app assistant tools for live graph actions.`
        : 'Preview copilot is ready.',
      agent: 'general',
      model: 'copilot',
      fallback: true,
    };
  }
  if (pathname.startsWith('/api/ai/')) {
    return { ok: true, available: false, agents: [], models: [], conversations: PREVIEW_AI_CONVERSATIONS, messages: [] };
  }

  // /profiles/[userId] had no demo handler at all, so it fell through to the
  // generic fallback and every field came back undefined: a "?" avatar, no name,
  // "undefined on CoFounderBay" under the title, and three empty skill chips
  // whose missing skillId also tripped React's duplicate-key warning. Resolved
  // from PEOPLE so a card opened from Discover shows the person that was clicked.
  if (/^\/api\/profiles\/[^/]+$/.test(pathname)) {
    const id = pathname.split('/').pop() ?? '';
    const person =
      PEOPLE.find((p) => p.userId === id || p.id === id) ?? PEOPLE[0];
    const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      id: person.id,
      userId: person.userId,
      displayName: person.displayName,
      headline: person.headline,
      bio: person.bio,
      location: person.location,
      timezone: 'Europe/Athens',
      languages: ['English'],
      avatarUrl: person.avatarUrl,
      rolePayload: {
        lookingFor: person.lookingFor ? [person.lookingFor] : [],
        availability: person.availability,
        industries: person.industries,
        ...(DEMO_HISTORY[person.userId] ?? {}),
      },
      visibilityRules: null,
      role: person.role,
      skills: person.skillNames.map((name) => ({
        skillId: slug(name),
        skillName: name,
        slug: slug(name),
        level: 'advanced',
      })),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: NOW,
    };
  }

  // The workspace panels on /builder had no demo handlers at all, so every one
  // of them fell through to the generic fallback -- an object with none of the
  // fields they read. WorkspaceReadinessPanel then crashed the page on
  // `data.dimensions[key]`, because its only guard was `if (!data)`.
  if (/^\/api\/gamification\/workspaces\/[^/]+\/readiness$/.test(pathname)) {
    const dimensions = {
      problemClarity: 72,
      solutionClarity: 64,
      marketUnderstanding: 48,
      productDefinition: 55,
      teamCompleteness: 40,
      executionReadiness: 58,
      validationScore: 35,
      artifactCompleteness: 61,
    };
    // Signals, not prose. The service answers with the raw facts behind each
    // dimension and leaves the sentence to the web (lib/readiness-evidence.ts);
    // this used to answer with eight hand-written English sentences instead,
    // which is why the showcase read "Problem statement written and reviewed"
    // while the live product read "idea_core at 50%". A preview that writes
    // better copy than the product is not a preview of the product.
    //
    // Every figure below matches what the Harbor workspace shows elsewhere:
    // five documents averaging 61%, a solo founder, four reviews with two
    // approved, eight feedback rounds at 63% applied.
    const signals: Record<string, Record<string, string | number | boolean>> = {
      problemClarity:      { docType: 'idea_core', completion: 50, approved: false },
      solutionClarity:     { docType: '', completion: 0, inferred: true },
      marketUnderstanding: { docType: 'market_analysis', completion: 0 },
      productDefinition:   { docType: 'mvp_plan', completion: 55 },
      teamCompleteness:    { memberCount: 1, collaborators: 0 },
      executionReadiness:  { completedReviews: 2, totalReviews: 4, approvalRate: 0.5 },
      validationScore:     { feedbackCount: 8, appliedRate: 0.63 },
      artifactCompleteness: { docCount: 5, avgCompletion: 61, approvedDocs: 0 },
    };
    const weight = 1 / Object.keys(dimensions).length;
    return {
      workspaceId: pathname.split('/')[4] ?? 'preview-ws-harbor',
      score: 54,
      bottleneckFactor: 0.92,
      dimensions,
      dimensionBreakdown: Object.fromEntries(
        Object.entries(dimensions).map(([k, score]) => [
          k,
          {
            score,
            weight,
            weightedContribution: Math.round(score * weight * 100) / 100,
            // Kept only as the fallback the web uses for a dimension whose
            // signals are missing; the sentence comes from the signals.
            detail: '',
            signals: signals[k] ?? {},
          },
        ]),
      ),
      updatedAt: NOW,
    };
  }

  if (/^\/api\/gamification\/workspaces\/[^/]+\/momentum$/.test(pathname)) {
    return {
      workspaceId: pathname.split('/')[4] ?? 'preview-ws-harbor',
      score: 61,
      velocity: 1.84,
      recentActivityScore: 66,
      collaborationDensity: 48,
      breakdown: {
        activeContributors: 3,
        recentMeaningfulActions: 14,
        meaningful7d: 9,
        meaningful14d: 14,
        velocityScore: 62,
        recentActivityScore: 66,
        collaborationDensityScore: 48,
        feedbackLoopScore: 54,
        milestoneRateScore: 58,
        artifactProgressEvents: 7,
        momentumLevel: 'Strong',
      },
      updatedAt: NOW,
    };
  }

  if (/^\/api\/gamification\/workspaces\/[^/]+\/contributions$/.test(pathname)) {
    // An array, not an object with a `contributors` field -- the panel maps over
    // the response directly.
    const wsId = pathname.split('/')[4] ?? 'preview-ws-harbor';
    const contributor = (
      userId: string,
      score: number,
      explain: string,
      b: Partial<Record<string, number>>,
    ) => ({
      userId,
      workspaceId: wsId,
      score,
      rawScore: score,
      breakdown: {
        artifactsCreated: 0,
        artifactsImproved: 0,
        feedbackGiven: 0,
        feedbackApplied: 0,
        collaborationActions: 0,
        usageByTeam: 0,
        recentArtifactsCreated: 0,
        recentArtifactsImproved: 0,
        recentFeedbackApplied: 0,
        ...b,
      },
      explain,
      updatedAt: NOW,
    });
    return [
      contributor(ME_ID, 58, 'Created most of the workspace artefacts', {
        artifactsCreated: 6, artifactsImproved: 9, collaborationActions: 12, recentArtifactsImproved: 3,
      }),
      contributor('user-marcus', 29, 'Improved the product and MVP documents', {
        artifactsImproved: 7, feedbackGiven: 3, collaborationActions: 5, recentArtifactsImproved: 2,
      }),
      contributor('user-sarah', 13, 'Reviewed the pitch and market sections', {
        feedbackGiven: 5, feedbackApplied: 4, recentFeedbackApplied: 2,
      }),
    ];
  }

  if (/^\/api\/gamification\/workspaces\/[^/]+\/mentor/.test(pathname)) {
    return {
      workspaceId: pathname.split('/')[4] ?? 'preview-ws-harbor',
      feedbackCount: 8,
      appliedFeedbackCount: 5,
      unresolvedFeedback: 3,
      appliedFeedbackRate: 0.63,
      avgResponseTimeHrs: 14.5,
      // Fractions, like the live endpoint. gamification.service derives all
      // three in [0, 1] and the panel renders them as `score * 100`, so the
      // 0-100 figures that used to sit here drew "Speed 6200%", "Depth 5400%"
      // and "Low Burden 3800%" with every bar pinned full. Same mistake the XP
      // block below already carries a note about: the scale is part of the
      // contract, and a preview that invents its own is not a preview.
      speedScore: 0.62,
      depthScore: 0.54,
      burdenScore: 0.38,
      // improvementScore is the one that really is 0-100 (service line ~1072
      // multiplies the weighted parts by 100), and the panel prints it as
      // "46/100" rather than scaling it.
      improvementScore: 46,
      lastFeedbackAt: NOW,
      updatedAt: NOW,
    };
  }

  if (pathname === '/api/gamification/users/me/xp' || pathname.endsWith('/xp')) {
    return {
      // Consistent with the real ladder in apps/api gamification.types.ts, which
      // is what the widget renders against: level 3 "Builder" spans 500-1000 XP,
      // and `levelProgress` is a **percentage**, not a fraction. It used to read
      // `level: 3, totalXp: 420, levelProgress: 0.68` — 420 XP is level 2 on that
      // ladder, and 0.68 rendered as an all-but-empty bar labelled "1%" beside a
      // badge promising only 80 XP to go. 920 keeps both the level and the "80 to
      // next" and makes the bar agree with them: (920-500)/(1000-500) = 84%.
      userId: ME_ID,
      totalXp: 920,
      level: 3,
      levelLabel: 'Builder',
      xpToNextLevel: 80,
      levelProgress: 84,
      // The showcase's last week, in the event vocabulary EVENT_CONFIG uses on
      // the server (apps/api gamification.types.ts). Used to be `[]`, which left
      // /reputation's Overview and History empty for the one account every
      // visitor sees. These are the actions the rest of the demo already
      // implies: two Builder artifacts, a closed milestone, a mentor review
      // acted on, a collaborator invited. Amounts are the config's base XP
      // (25/40/50/60/80/100), so a reader cross-checking against the ladder
      // finds them exact. No STREAK_BONUS row: its base is 0 and the server
      // computes it, so a literal here would be an invented number.
      recentEvents: [
        { id: 'xp-1', eventType: 'IMPROVE_ARTIFACT', xpAmount: 40, entityType: 'artifact', metadata: null, createdAt: previewIsoInDays(0, 8) },
        { id: 'xp-2', eventType: 'APPLY_FEEDBACK', xpAmount: 80, entityType: 'review', metadata: null, createdAt: previewIsoInDays(-1, 9) },
        { id: 'xp-3', eventType: 'RECEIVE_MENTOR_FEEDBACK', xpAmount: 60, entityType: 'review', metadata: null, createdAt: previewIsoInDays(-2, 18) },
        { id: 'xp-4', eventType: 'COMPLETE_MILESTONE', xpAmount: 100, entityType: 'milestone', metadata: null, createdAt: previewIsoInDays(-3, 11) },
        { id: 'xp-5', eventType: 'CREATE_ARTIFACT', xpAmount: 25, entityType: 'artifact', metadata: null, createdAt: previewIsoInDays(-5, 14) },
        { id: 'xp-6', eventType: 'INVITE_COLLABORATOR', xpAmount: 50, entityType: 'workspace', metadata: null, createdAt: previewIsoInDays(-6, 10) },
      ],
      // Four days running, the last of them today: the events above fall on
      // each of them. A fixed date drifted a week behind the streak it ended.
      streak: { currentStreak: 4, longestStreak: 7, lastActiveDate: new Date(previewNowMs() - 2 * 3_600_000).toISOString() },
    };
  }
  // useMyStreak() fetches the streak on its own endpoint, not from the XP payload
  // above. Without this branch it fell through to the generic fallback, whose
  // object has no currentStreak/longestStreak — which is why the dashboard read
  // "undefined day streak · Best: undefined days" in demo mode.
  if (pathname === '/api/gamification/users/me/streak' || pathname.endsWith('/streak')) {
    return { currentStreak: 4, longestStreak: 7, lastActiveDate: new Date(previewNowMs() - 2 * 3_600_000).toISOString() };
  }
  if (pathname === '/api/gamification/users/me/badges' || pathname.endsWith('/badges')) {
    return [
      {
        id: 'badge-early',
        key: 'early-adopter',
        name: 'Early adopter',
        description: 'Joined the preview',
        category: 'special',
        rarity: 'common',
        awardedAt: NOW,
      },
    ];
  }
  if (pathname === '/api/analytics/achievements') {
    return null;
  }
  if (pathname === '/api/builder/workspaces') {
    if (method === 'POST') return previewBuilderWorkspace();
    const ws = previewBuilderWorkspace();
    return {
      data: [ws],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasMore: false },
    };
  }
  const builderWsMatch = pathname.match(/^\/api\/builder\/workspaces\/([^/]+)$/);
  if (builderWsMatch) {
    return previewBuilderWorkspace();
  }
  const builderActivityMatch = pathname.match(/^\/api\/builder\/workspaces\/([^/]+)\/activity$/);
  if (builderActivityMatch) {
    return {
      activities: [
        {
          id: 'preview-act-1',
          workspaceId: PREVIEW_BUILDER_WS_ID,
          action: 'document.updated',
          entityType: 'document',
          entityId: 'preview-doc-idea',
          metadata: { title: 'Idea Core' },
          createdAt: NOW,
          user: { id: ME_ID, displayName: 'Alex Demo' },
        },
        {
          id: 'preview-act-2',
          workspaceId: PREVIEW_BUILDER_WS_ID,
          action: 'workspace.created',
          entityType: 'workspace',
          entityId: PREVIEW_BUILDER_WS_ID,
          createdAt: NOW,
          user: { id: ME_ID, displayName: 'Alex Demo' },
        },
      ],
    };
  }
  const builderCollabMatch = pathname.match(/^\/api\/builder\/workspaces\/([^/]+)\/collaborators$/);
  if (builderCollabMatch) {
    if (method === 'POST') {
      const role = typeof body.role === 'string' ? body.role : 'viewer';
      const userId = typeof body.userId === 'string' ? body.userId : 'preview-guest';
      return {
        id: `preview-collab-${Date.now()}`,
        userId,
        role,
        isActive: true,
        invitedAt: new Date(previewNowMs()).toISOString(),
        user: {
          id: userId,
          displayName: userId,
          email: `${userId}@example.com`,
        },
      };
    }
    return PREVIEW_BUILDER_COLLABORATORS;
  }
  if (pathname === '/api/builder/readiness/assess' && method === 'POST') {
    return PREVIEW_BUILDER_READINESS;
  }
  if (pathname === '/api/builder/documents' && method === 'POST') {
    const type = typeof body.type === 'string' ? body.type : 'custom';
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Untitled';
    const doc: PreviewBuilderDoc = {
      id: `preview-doc-${Date.now()}`,
      workspaceId: PREVIEW_BUILDER_WS_ID,
      type,
      title,
      content: {},
      status: 'draft',
      completionPercent: 0,
      aiGenerated: false,
      version: 1,
      createdAt: new Date(previewNowMs()).toISOString(),
      updatedAt: new Date(previewNowMs()).toISOString(),
    };
    previewBuilderDocs = [doc, ...previewBuilderDocs];
    return doc;
  }

  if (pathname === '/api/builder/ai/generate' && method === 'POST') {
    const documentType = typeof body.documentType === 'string' ? body.documentType : '';
    if (documentType === 'idea_core') {
      return {
        content: {
          timing: 'Matching and fundraising tools are fragmenting just as more first-time founders start remotely.',
          marketSize: '$4B TAM for founder tooling; $400M SAM in early-stage matching.',
          assumptions: [
            'Founders will write the idea in one workspace instead of five tools.',
            'A complementary cofounder is discoverable from the same graph.',
          ],
          painPoints: [
            'Matching, messaging, and fundraising live in separate products.',
            'Readiness advice is disconnected from the artefacts.',
          ],
        },
        tokensUsed: 0,
        latencyMs: 18,
        model: 'preview',
      };
    }
    if (documentType === 'business_model_canvas') {
      return {
        content: {
          keyPartners: 'Complementary founders, mentors, and the programmes that already sit in the same graph.',
          keyActivities: 'Matching, artefact writing, readiness scoring, and keeping the plan in one workspace.',
          keyResources: 'The founder graph, the readiness model, and the builder artefacts themselves.',
          customerRelationships: 'Workspace collaboration, comments, and expert review on the same drafts.',
          channels: 'Discover, matches, and shareable documents for mentors and investors.',
          customerSegments: 'Early-stage founders looking for a complementary cofounder.',
          costStructure: 'Product, matching, and the expert-review marketplace.',
          revenueStreams: 'Subscriptions and paid expert reviews on drafts.',
        },
        tokensUsed: 0,
        latencyMs: 18,
        model: 'preview',
      };
    }
    if (documentType === 'market_analysis') {
      return {
        content: {
          tam: {
            value: '$4B',
            description: 'Founder tooling — matching, messaging, and fundraising in one category.',
            sources: 'Category estimate aligned with Idea Core market size.',
          },
          sam: {
            value: '$400M',
            description: 'Early-stage matching and workspace tools in English-speaking ecosystems.',
            methodology: 'Top-down from founder-tooling TAM, limited to early-stage matching.',
          },
          som: {
            value: '$12M',
            description: 'Realistic share in the first three years among complementary-cofounder searches.',
            assumptions: 'Low single-digit take of SAM; subscription plus expert-review attach.',
          },
          directCompetitors: [
            {
              name: 'Standalone matching directories',
              description: 'Profile boards that introduce founders but stop at the intro.',
              strengths: [],
              weaknesses: [],
              pricing: 'Freemium',
              marketShare: '',
            },
          ],
          indirectCompetitors: [
            {
              name: 'Spreadsheets and chat threads',
              description: 'Founders stitch matching, messaging, and fundraising by hand.',
              strengths: [],
              weaknesses: [],
              pricing: 'Free',
              marketShare: '',
            },
          ],
          idealCustomerProfile: {
            demographics: 'Early-stage founders looking for a complementary cofounder.',
            psychographics: 'Want one workspace instead of five tools.',
            painPoints: [],
            buyingBehavior: 'Subscribe when the artefacts and the match live in the same place.',
            decisionCriteria: [],
            budget: '$50–500/month',
          },
          personas: [
            {
              name: 'Alex, first-time founder',
              role: 'Looking for a complementary cofounder',
              goals: [],
              frustrations: [],
              quote: 'Matching, messaging, and fundraising live in separate products.',
            },
          ],
          trends: [
            {
              trend: 'Remote-first team formation',
              impact: 'positive',
              timeframe: '2024–2027',
              confidence: 80,
            },
          ],
          positioning:
            'For early-stage founders who need a complementary cofounder, CoFounderBay is the workspace that matches people and turns the idea into artefacts. Unlike directories or generic docs, the graph, readiness, and builder sit in one product.',
          competitiveAdvantage: 'Graph + readiness + builder in the same product.',
          differentiators: [
            'Matching and artefacts in one workspace',
            'Readiness scoring attached to the drafts',
          ],
        },
        tokensUsed: 0,
        latencyMs: 18,
        model: 'preview',
      };
    }
    if (documentType === 'pitch_deck') {
      return {
        content: PREVIEW_PITCH_GENERATE,
        tokensUsed: 0,
        latencyMs: 18,
        model: 'preview',
      };
    }
    if (documentType === 'application') {
      const ctx = body.context && typeof body.context === 'object' && !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : {};
      const programId = typeof ctx.programId === 'string' ? ctx.programId : 'yc';
      return {
        content: { answers: harborApplicationDrafts(programId) },
        tokensUsed: 0,
        latencyMs: 18,
        model: 'preview',
      };
    }
    return { content: {}, tokensUsed: 0, latencyMs: 8, model: 'preview' };
  }

  if (pathname === '/api/builder/ai/generate-application-answer' && method === 'POST') {
    const ctx = body.context && typeof body.context === 'object' && !Array.isArray(body.context)
      ? (body.context as Record<string, unknown>)
      : {};
    const programId = typeof ctx.programId === 'string' ? ctx.programId : 'yc';
    const questionId = typeof ctx.questionId === 'string' ? ctx.questionId : '';
    const drafts = harborApplicationDrafts(programId);
    const answer =
      (questionId && drafts[questionId]) ||
      Object.values(drafts).find((value) => value.trim()) ||
      'Harbor OS for early-stage founders.';
    return { answer };
  }

  const builderSectionMatch = pathname.match(/^\/api\/builder\/documents\/([^/]+)\/sections\/([^/]+)$/);
  if (builderSectionMatch && (method === 'PATCH' || method === 'PUT')) {
    const found = previewBuilderDocs.find((d) => d.id === builderSectionMatch[1]);
    const sectionKey = builderSectionMatch[2];
    const payload = body.content && typeof body.content === 'object' && !Array.isArray(body.content)
      ? (body.content as Record<string, unknown>)
      : {};
    if (found) {
      const stamp = new Date(previewNowMs()).toISOString();
      const nextVersion = found.version + 1;
      const nextContent = { ...found.content, ...payload, [sectionKey]: payload };
      const next: PreviewBuilderDoc = {
        ...found,
        content: nextContent,
        version: nextVersion,
        updatedAt: stamp,
        status: found.status === 'draft' ? 'in_progress' : found.status,
      };
      previewBuilderDocs = previewBuilderDocs.map((d) => (d.id === found.id ? next : d));
      previewDocVersions = [
        {
          id: `preview-ver-${found.id}-${nextVersion}`,
          documentId: found.id,
          version: nextVersion,
          versionLabel: `v${nextVersion}`,
          changesSummary: `Saved ${sectionKey}.`,
          createdAt: stamp,
          changedById: ME_ID,
          changedBy: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null },
          content: nextContent,
        },
        ...previewDocVersions,
      ];
      return {
        id: `preview-sec-${sectionKey}`,
        sectionKey,
        sectionTitle: sectionKey,
        sortOrder: 0,
        content: payload,
        isComplete: false,
        aiGenerated: false,
      };
    }
    return {
      id: `preview-sec-${sectionKey}`,
      sectionKey,
      content: payload,
      isComplete: false,
      aiGenerated: false,
    };
  }

  const builderVersionsMatch = pathname.match(/^\/api\/builder\/documents\/([^/]+)\/versions$/);
  if (builderVersionsMatch) {
    return listPreviewVersions(builderVersionsMatch[1]);
  }

  const collabVersionsMatch = pathname.match(/^\/api\/collab\/documents\/([^/]+)\/versions$/);
  if (collabVersionsMatch) {
    return listPreviewVersions(collabVersionsMatch[1]);
  }

  const collabBranchesMatch = pathname.match(/^\/api\/collab\/documents\/([^/]+)\/branches/);
  if (collabBranchesMatch) return [];

  const collabProposalsMatch = pathname.match(/^\/api\/collab\/documents\/([^/]+)\/proposals/);
  if (collabProposalsMatch) return [];

  if (pathname === '/api/collab/share-links' && method === 'POST') {
    const token = `preview-${Math.random().toString(36).slice(2, 10)}`;
    return {
      id: `preview-share-${Date.now()}`,
      documentId: typeof body.documentId === 'string' ? body.documentId : undefined,
      workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId : undefined,
      token,
      permissions: body.permissions === 'comment' || body.permissions === 'suggest' ? body.permissions : 'view',
      label: typeof body.label === 'string' ? body.label : undefined,
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
      viewCount: 0,
      isActive: true,
      createdAt: new Date(previewNowMs()).toISOString(),
      createdBy: { id: ME_ID, displayName: 'Alex Demo' },
    };
  }

  if (pathname === '/api/collab/versions/restore' && method === 'POST') {
    const documentId = typeof body.documentId === 'string' ? body.documentId : '';
    const targetVersion = typeof body.targetVersion === 'number' ? body.targetVersion : Number(body.targetVersion);
    const found = previewBuilderDocs.find((d) => d.id === documentId);
    const target = previewDocVersions.find((row) => row.documentId === documentId && row.version === targetVersion);
    if (!found || !target) {
      return { documentId, previousVersion: 0, restoredFromVersion: targetVersion || 0, newVersion: 0 };
    }
    const stamp = new Date(previewNowMs()).toISOString();
    const previousVersion = found.version;
    const newVersion = previousVersion + 1;
    const nextContent = { ...target.content };
    const next: PreviewBuilderDoc = {
      ...found,
      content: nextContent,
      version: newVersion,
      updatedAt: stamp,
    };
    previewBuilderDocs = previewBuilderDocs.map((d) => (d.id === found.id ? next : d));
    previewDocVersions = [
      {
        id: `preview-ver-${found.id}-${newVersion}`,
        documentId: found.id,
        version: newVersion,
        versionLabel: `v${newVersion}`,
        changesSummary: `Restored from v${targetVersion}.`,
        createdAt: stamp,
        changedById: ME_ID,
        changedBy: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null },
        content: nextContent,
      },
      ...previewDocVersions,
    ];
    return {
      documentId: found.id,
      previousVersion,
      restoredFromVersion: targetVersion,
      newVersion,
    };
  }

  const builderDocMatch = pathname.match(/^\/api\/builder\/documents\/([^/]+)$/);
  if (builderDocMatch) {
    ensurePreviewApplicationDoc();
    const found = previewBuilderDocs.find((d) => d.id === builderDocMatch[1]);
    if ((method === 'PUT' || method === 'PATCH') && found) {
      const next = { ...found, ...body, updatedAt: new Date(previewNowMs()).toISOString() } as PreviewBuilderDoc;
      previewBuilderDocs = previewBuilderDocs.map((d) => (d.id === found.id ? next : d));
      return next;
    }
    return found ?? previewBuilderDocs[0];
  }

  // -- Mentorship, which /coaching reads from the founder's side --------------
  if (pathname === '/api/mentorship/relationships') {
    const role = new URLSearchParams(path.split('?')[1] ?? '').get('role');
    return { relationships: role === 'mentor' ? previewMentorSideRelationships() : PREVIEW_MENTORSHIP_RELATIONSHIPS };
  }
  if (pathname === '/api/mentorship/requests/received') {
    return { requests: previewMentorRequests() };
  }
  if (pathname === '/api/mentorship/dashboard/mentor') {
    const rels = previewMentorSideRelationships();
    const rating = mentorDemoRating();
    return {
      activeMentees: rels.filter((r) => r.status === 'active').length,
      pendingRequests: previewMentorRequests().filter((r) => r.status === 'pending').length,
      completedMentorships: rels.filter((r) => r.status === 'completed').length,
      upcomingSessions: previewMentorSideSessions().length,
      totalSessions: rels.reduce((s, r) => s + r.totalSessions, 0),
      averageRating: rating.average,
      recentActivity: [],
    };
  }
  const mentorshipSessionsMatch = pathname.match(
    /^\/api\/mentorship\/relationships\/([^/]+)\/sessions$/,
  );
  if (mentorshipSessionsMatch) {
    return {
      sessions:
        mentorshipSessionsMatch[1] === PREVIEW_COACHING_REL_ID
          ? previewMentorshipSessions()
          : [...previewMentorSideSessions(), ...previewMentorSidePastSessions()].filter((x) => x.relationshipId === mentorshipSessionsMatch[1]),
    };
  }
  if (pathname === '/api/mentorship/sessions/upcoming') {
    // Both sides of the reader's calendar, as the endpoint returns them: the
    // session with their own mentor and the ones they give.
    return {
      sessions: [...previewMentorshipSessions().filter((x) => x.status === 'scheduled'), ...previewMentorSideSessions()]
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    };
  }
  if (pathname === '/api/mentorship/mentors') {
    const mentors = previewMentors();
    return { mentors, total: mentors.length, page: 1, totalPages: 1 };
  }

  // -- Expert reviews, over the model that had no controller until now -------
  if (pathname === '/api/expert-reviews/experts') {
    const experts = previewExperts();
    return { experts, total: experts.length };
  }
  if (pathname === '/api/expert-reviews/summary') {
    const reviews = previewExpertReviews();
    const rated = reviews.filter((r) => r.rating != null);
    const scored = reviews.filter((r) => r.scoreOverall != null);
    return {
      total: reviews.length,
      open: reviews.filter((r) => ['requested', 'accepted', 'in_progress'].includes(r.status))
        .length,
      submitted: reviews.filter((r) => r.status === 'submitted').length,
      avgRating: rated.length
        ? Number((rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length).toFixed(1))
        : null,
      avgScore: scored.length
        ? Number((scored.reduce((a, r) => a + (r.scoreOverall ?? 0), 0) / scored.length).toFixed(1))
        : null,
    };
  }
  if (pathname === '/api/expert-reviews') {
    // `side` picks whose reviews: the ones the reader asked for, or the ones
    // asked of them. Every demo review is the reader's own request, so the
    // expert side is empty rather than the same list twice.
    const side = new URLSearchParams(path.split('?')[1] ?? '').get('side');
    const reviews = previewExpertReviews().filter((r) =>
      side === 'expert' ? r.expert?.id === ME_ID : side === 'requester' ? r.requester?.id === ME_ID : true,
    );
    return { reviews, total: reviews.length };
  }

  if (pathname === '/api/milestones/summary') {
    applyHarborMilestoneSeedIfStale();
    return previewMilestoneSummary();
  }
  if (pathname === '/api/milestones') {
    applyHarborMilestoneSeedIfStale();
    if (method === 'POST') {
      const collaboratorId = typeof body.collaboratorId === 'string' ? body.collaboratorId : null;
      const created: PreviewMilestone = {
        id: `preview-ms-${Date.now()}`,
        ownerId: ME_ID,
        collaboratorId,
        collaborator: previewMilestoneCollaborator(collaboratorId),
        title: typeof body.title === 'string' ? body.title : 'Untitled milestone',
        description: typeof body.description === 'string' ? body.description : null,
        status: (body.status as PreviewMilestone['status']) || 'todo',
        priority: (body.priority as PreviewMilestone['priority']) || 'medium',
        category: typeof body.category === 'string' ? body.category : null,
        dueDate: typeof body.dueDate === 'string' ? body.dueDate : null,
        completedAt: body.status === 'completed' ? new Date(previewNowMs()).toISOString() : null,
        progress: typeof body.progress === 'number' ? body.progress : 0,
        notes: typeof body.notes === 'string' ? body.notes : null,
        createdAt: new Date(previewNowMs()).toISOString(),
        updatedAt: new Date(previewNowMs()).toISOString(),
      };
      previewMilestones = [created, ...previewMilestones];
      return created;
    }
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const status = params.get('status');
    const priority = params.get('priority');
    const category = params.get('category');
    const filtered = previewMilestones.filter((m) => {
      if (status && m.status !== status) return false;
      if (priority && m.priority !== priority) return false;
      if (category && m.category !== category) return false;
      return true;
    });
    return { milestones: filtered, nextCursor: null, total: filtered.length };
  }
  const milestoneMatch = pathname.match(/^\/api\/milestones\/([^/]+)$/);
  if (milestoneMatch) {
    applyHarborMilestoneSeedIfStale();
    const found = previewMilestones.find((m) => m.id === milestoneMatch[1]);
    if (method === 'DELETE') {
      previewMilestones = previewMilestones.filter((m) => m.id !== milestoneMatch[1]);
      return { ok: true };
    }
    if ((method === 'PATCH' || method === 'PUT') && found) {
      const seeded = seedPreviewMilestones().find((s) => s.id === found.id);
      const nextTitle = typeof body.title === 'string' ? body.title : found.title;
      const nextDescription = typeof body.description === 'string' ? body.description : found.description;
      const refuseLegacy =
        !!seeded &&
        (PREVIEW_MILESTONE_LEGACY_TITLES.has(nextTitle) ||
          PREVIEW_MILESTONE_LEGACY_SNIPPETS.some((snippet) => (nextDescription ?? '').includes(snippet)));
      const status = (typeof body.status === 'string' ? body.status : found.status) as PreviewMilestone['status'];
      const completing = status === 'completed' && found.status !== 'completed';
      const collaboratorId =
        body.collaboratorId === undefined
          ? found.collaboratorId
          : typeof body.collaboratorId === 'string'
            ? body.collaboratorId
            : null;
      const next: PreviewMilestone = {
        ...found,
        ...body,
        id: found.id,
        ownerId: found.ownerId,
        title: refuseLegacy ? seeded.title : nextTitle,
        description: refuseLegacy ? seeded.description : nextDescription,
        collaboratorId,
        collaborator: previewMilestoneCollaborator(collaboratorId) ?? (collaboratorId === found.collaboratorId ? found.collaborator : null),
        status,
        updatedAt: new Date(previewNowMs()).toISOString(),
        completedAt: completing
          ? found.completedAt ?? new Date(previewNowMs()).toISOString()
          : status !== 'completed'
            ? null
            : found.completedAt,
        progress: completing ? 100 : typeof body.progress === 'number' ? body.progress : found.progress,
      };
      previewMilestones = previewMilestones.map((m) => (m.id === found.id ? next : m));
      return next;
    }
    return found ?? previewMilestones[0];
  }

  if (pathname === '/api/analytics/overview') {
    return PREVIEW_ANALYTICS_OVERVIEW;
  }
  if (pathname === '/api/analytics/metrics') {
    return PREVIEW_USER_METRICS;
  }
  if (pathname === '/api/analytics/profile-views') {
    return PREVIEW_ANALYTICS_OVERVIEW.profileViews;
  }
  if (pathname === '/api/analytics/engagement') {
    return PREVIEW_ANALYTICS_OVERVIEW.engagement;
  }
  if (pathname === '/api/analytics/top-content') {
    return PREVIEW_ANALYTICS_OVERVIEW.topContent;
  }
  if (pathname === '/api/analytics/weekly-summary') {
    return PREVIEW_ANALYTICS_OVERVIEW.weeklySummary;
  }

  /*
   * Showcase areas. Each of these filters the fixtures the way the real
   * endpoint filters rows, so the tabs, search boxes and chips on those pages
   * do something — a control that always returns the same list reads as broken
   * long before anyone checks whether a backend is attached.
   */
  if (pathname === '/api/events' || pathname.startsWith('/api/events?')) {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const scope = params.get('scope') ?? 'upcoming';
    const q = params.get('q')?.toLowerCase() ?? '';
    const mode = params.get('mode');
    const limit = Number(params.get('limit') ?? 48);
    // Against the demo clock, not the frozen seed day: the payload is moved
    // forward by whole weeks, so "now" on the seed's calendar is
    // previewNowMs(). Comparing with NOW listed as upcoming an event that had
    // happened up to a week before the reader opened the page.
    const demoNow = new Date(previewNowMs()).toISOString();
    const startsAfterNow = (e: PreviewEvent) => e.startAt >= demoNow;
    const events = PREVIEW_EVENTS
      .filter((e) => (
        scope === 'past' ? !startsAfterNow(e)
          : scope === 'mine' ? e.viewerRsvp != null
            : startsAfterNow(e)
      ))
      .filter((e) => !mode || e.mode === mode)
      .filter((e) => !q || `${e.title} ${e.description} ${e.location ?? ''} ${e.host.displayName}`.toLowerCase().includes(q))
      // Upcoming reads forwards; past reads backwards, most recent first.
      .sort((a, b) => (scope === 'past' ? b.startAt.localeCompare(a.startAt) : a.startAt.localeCompare(b.startAt)))
      .slice(0, limit);
    return { events };
  }
  if (pathname.startsWith('/api/events/') && pathname.endsWith('/rsvp')) {
    const id = pathname.split('/')[3];
    const status = typeof body.status === 'string' ? body.status : 'going';
    return { ok: true, eventId: id, viewerRsvp: status === 'not_going' ? null : status };
  }
  if (pathname.startsWith('/api/events/')) {
    const id = pathname.split('/')[3];
    const event = PREVIEW_EVENTS.find((e) => e.id === id);
    return { event: event ?? null };
  }

  if (pathname === '/api/jobs' || pathname.startsWith('/api/jobs?')) {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const limit = Number(params.get('limit') ?? 50);
    return { jobs: PREVIEW_JOBS.slice(0, limit) };
  }

  if (pathname === '/api/groups/my') {
    return {
      groups: PREVIEW_GROUPS
        .filter((g) => g.isMember)
        .map((g) => ({ ...g, memberRole: g.memberRole ?? 'member', joinedAt: '2026-05-12T09:00:00.000Z' })),
    };
  }
  if (pathname === '/api/groups' || pathname.startsWith('/api/groups?')) {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const category = params.get('category');
    const privacy = params.get('privacy');
    const search = params.get('search')?.toLowerCase() ?? '';
    const sort = params.get('sort') ?? 'popular';
    const onlyMine = params.get('myGroups') === 'true';
    const limit = Number(params.get('limit') ?? 30);
    const offset = Number(params.get('offset') ?? 0);
    const matched = PREVIEW_GROUPS
      .filter((g) => !onlyMine || g.isMember)
      .filter((g) => !category || g.category === category)
      .filter((g) => !privacy || g.privacy === privacy)
      .filter((g) => !search || `${g.name} ${g.description ?? ''} ${g.tags.join(' ')} ${g.category ?? ''}`.toLowerCase().includes(search))
      .sort((a, b) => (
        sort === 'recent' ? b.createdAt.localeCompare(a.createdAt)
          // "Trending" is conversation per member, so a small, busy room can
          // outrank a large quiet one — which is the whole point of the sort.
          : sort === 'trending' ? (b.postCount / b.memberCount) - (a.postCount / a.memberCount)
            : b.memberCount - a.memberCount
      ));
    const groups = matched.slice(offset, offset + limit);
    return { groups, total: matched.length, hasMore: offset + groups.length < matched.length };
  }
  if (pathname.startsWith('/api/groups/') && (pathname.endsWith('/join') || pathname.endsWith('/leave'))) {
    return { ok: true, groupId: pathname.split('/')[3], isMember: pathname.endsWith('/join') };
  }
  if (pathname.startsWith('/api/groups/')) {
    const parts = pathname.split('/');
    const id = parts[3];
    const group = PREVIEW_GROUPS.find((g) => g.id === id || g.slug === id);
    // Comments under a post: none yet in the showcase.
    if (parts[4] === 'posts' && parts[6] === 'comments') return { comments: [], total: 0, hasMore: false };
    if (!group) {
      if (parts[4] === 'posts') return { posts: [], total: 0, hasMore: false };
      if (parts[4] === 'members') return { members: [], total: 0 };
      return { group: null, isMember: false, memberRole: null };
    }
    if (parts[4] === 'posts') {
      const posts = previewGroupPosts(group);
      return { posts, total: group.postCount, hasMore: group.postCount > posts.length };
    }
    if (parts[4] === 'members') return { members: previewGroupMembers(group), total: group.memberCount };
    // The client reads membership beside the group, not inside it: nested,
    // it read false, so /groups said "joined" and the group said "Join".
    return {
      group: { ...group, members: previewGroupMembers(group) },
      isMember: group.isMember,
      memberRole: group.memberRole,
    };
  }

  if (pathname === '/api/opportunities' || pathname.startsWith('/api/opportunities?')) {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const type = params.get('type');
    const isRemote = params.get('isRemote');
    const search = params.get('search')?.toLowerCase() ?? '';
    const limit = Number(params.get('limit') ?? 20);
    const offset = Number(params.get('offset') ?? 0);
    const matched = PREVIEW_OPPORTUNITIES
      .filter((o) => !type || o.type === type)
      .filter((o) => isRemote == null || o.isRemote === (isRemote === 'true'))
      .filter((o) => !search || `${o.title} ${o.description ?? ''} ${o.company ?? ''} ${o.tags.join(' ')}`.toLowerCase().includes(search));
    const opportunities = matched.slice(offset, offset + limit);
    return { opportunities, total: matched.length, hasMore: offset + opportunities.length < matched.length };
  }

  // `/api/sso/memberships` is answered by previewOrgApi: the reader is a
  // program partner at the demo's one organisation (demo/org-world.ts).

  // Writes the assistant can now make (Wave C), answered with the shapes the
  // controllers return. Nothing here is stored: the demo's lists stay as they
  // are, the way the invite POST below already behaves.
  if (/^\/api\/programs\/[^/]+\/apply$/.test(pathname) && method === 'POST') {
    const programId = pathname.split('/')[3];
    return { participant: { id: `pp-${Date.now()}`, programId, userId: ME_ID, status: 'applied', appliedAt: new Date(previewNowMs()).toISOString() } };
  }
  if (pathname === '/api/endorsements' && method === 'POST') {
    const sent = (body ?? {}) as { toUserId?: string; content?: string; skill?: string };
    return {
      endorsement: {
        id: `end-${Date.now()}`,
        fromUserId: ME_ID,
        fromUser: { id: ME_ID, displayName: 'Alex Demo', avatarUrl: null, headline: 'Founder' },
        toUserId: sent.toUserId ?? '',
        skill: sent.skill ?? null,
        content: sent.content ?? '',
        relationship: null,
        isPublic: true,
        isApproved: false,
        createdAt: new Date(previewNowMs()).toISOString(),
      },
    };
  }
  if (/^\/api\/endorsements\/[^/]+$/.test(pathname) && method === 'DELETE') {
    return { ok: true };
  }
  if (/^\/api\/mentorship\/requests\/[^/]+\/respond$/.test(pathname) && method === 'POST') {
    const sent = (body ?? {}) as { accept?: boolean };
    return { request: { id: pathname.split('/')[4], status: sent.accept ? 'accepted' : 'declined' } };
  }

  // Session bookings: the other mentoring store. `scope` picks whose side;
  // POST starts as requested; PATCH carries the mentor's answer, as the API does.
  if (pathname === '/api/mentor/bookings') {
    if (method === 'POST') {
      const sent = (body ?? {}) as { mentorId?: string; startAt?: string; endAt?: string; timezone?: string; meetingType?: PreviewBooking['meetingType']; notes?: string };
      const created: PreviewBooking = {
        id: `preview-book-${Date.now().toString(36)}`,
        mentorId: sent.mentorId ?? 'user-sarah',
        menteeId: ME_ID,
        startAt: sent.startAt ?? previewIsoInDays(7, 11),
        endAt: sent.endAt ?? previewIsoInDays(7, 12),
        timezone: sent.timezone ?? null,
        meetingType: sent.meetingType ?? 'video',
        meetingUrl: null,
        notes: sent.notes ?? null,
        status: 'requested',
        priceCents: null,
        currency: null,
        mentor: previewBookingPerson(sent.mentorId ?? 'user-sarah', 'Mentor'),
        mentee: previewBookingPerson(ME_ID, 'Alex Demo'),
      };
      previewBookings = [...previewBookingsState(), created];
      return { booking: created };
    }
    const scope = new URLSearchParams(path.split('?')[1] ?? '').get('scope');
    const rows = previewBookingsState().filter((b) =>
      scope === 'mentor' ? b.mentorId === ME_ID : scope === 'mentee' ? b.menteeId === ME_ID : true,
    );
    return { bookings: rows };
  }
  const bookingMatch = pathname.match(/^\/api\/mentor\/bookings\/([^/]+)$/);
  if (bookingMatch && (method === 'PATCH' || method === 'PUT')) {
    const sent = (body ?? {}) as { status?: PreviewBooking['status']; meetingUrl?: string | null; notes?: string | null };
    const found = previewBookingsState().find((b) => b.id === bookingMatch[1]);
    if (!found) return { booking: null };
    const next: PreviewBooking = {
      ...found,
      status: sent.status ?? found.status,
      meetingUrl: sent.meetingUrl !== undefined ? sent.meetingUrl : found.meetingUrl ?? (sent.status === 'confirmed' ? `https://meet.example.com/${found.id}` : null),
      notes: sent.notes !== undefined ? sent.notes : found.notes,
    };
    previewBookings = previewBookingsState().map((b) => (b.id === found.id ? next : b));
    return { booking: next };
  }

  // The reader's weekly hours as a mentor. PUT replaces them, as the API does,
  // and keeps them for the rest of the preview session.
  if (pathname === '/api/mentor/availability') {
    if (method === 'PUT') {
      const sent = (body ?? {}) as { slots?: { weekday: number; startTime: string; endTime: string; timezone?: string }[] };
      previewAvailability = (sent.slots ?? []).map((slot, i) => ({
        id: `avail-${i + 1}`,
        mentorId: ME_ID,
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timezone: slot.timezone ?? null,
      }));
    }
    return { slots: previewAvailability };
  }

  // Invitations the demo account has sent: two joined, two pending, one
  // lapsed. Same people the organisation's roster and the pipeline use.
  if (pathname === '/api/invites' && method === 'POST') {
    // Sending an invite in the demo answers with the invite it would create;
    // nothing is stored, so the list below does not grow.
    const sent = (body ?? {}) as { email?: string; message?: string };
    return { invite: { id: `inv-${Date.now()}`, email: sent.email ?? '', message: sent.message ?? null, status: 'pending', createdAt: new Date().toISOString(), acceptedAt: null, expiresAt: previewIsoInDays(30) } };
  }
  if (/^\/api\/invites\/[^/]+$/.test(pathname) && method === 'DELETE') {
    return { ok: true };
  }
  if (pathname === '/api/invites/stats') {
    // Ioanna verified and connected; Thanos joined and has done nothing yet.
    return { stats: { total: 5, pending: 2, accepted: 2, active: 1, remaining: 45 } };
  }
  if (pathname === '/api/invites') {
    const invites = [
      { id: 'inv-ioanna', email: 'ioanna@aegeanlab.example', message: null, status: 'accepted', createdAt: previewIsoInDays(-220), acceptedAt: previewIsoInDays(-219), expiresAt: null },
      { id: 'inv-thanos', email: 'thanos@rigas.energy', message: null, status: 'accepted', createdAt: previewIsoInDays(-160), acceptedAt: previewIsoInDays(-150), expiresAt: null },
      { id: 'inv-eleni', email: 'eleni@anemosstorage.example', message: 'Join the climate track cohort channel here.', status: 'pending', createdAt: previewIsoInDays(-6), acceptedAt: null, expiresAt: previewIsoInDays(24) },
      { id: 'inv-petros', email: 'petros@kymaenergy.example', message: null, status: 'pending', createdAt: previewIsoInDays(-2), acceptedAt: null, expiresAt: previewIsoInDays(28) },
      { id: 'inv-old', email: 'hello@old-venture.example', message: null, status: 'expired', createdAt: previewIsoInDays(-120), acceptedAt: null, expiresAt: previewIsoInDays(-90) },
    ];
    return { invites, total: invites.length };
  }
  if (pathname === '/api/admin/users') {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const q = params.get('q')?.toLowerCase() ?? '';
    const users = previewAdminUsers().filter((u) => !q || `${u.profile.displayName} ${u.email}`.toLowerCase().includes(q));
    return { users };
  }
  if (pathname === '/api/admin/reports') {
    const status = new URLSearchParams(path.split('?')[1] ?? '').get('status');
    return { reports: previewAdminReports().filter((r) => !status || r.status === status) };
  }
  if (pathname === '/api/admin/skills') {
    // The skills the demo's profiles carry, counted over those profiles, in the
    // taxonomy page's own categories. "Energy markets" is the one the audit
    // log records the admin adding.
    const SKILLS: Array<[string, string]> = [
      ['TypeScript', 'Technical'], ['Next.js', 'Technical'], ['AI', 'Technical'],
      ['Product', 'Product'], ['Growth', 'Marketing'], ['Go-to-market', 'Business'],
      ['Fundraising', 'Finance'], ['Pricing', 'Business'], ['Hiring', 'Operations'],
      ['Leadership', 'Business'], ['Mentoring', 'Other'], ['Energy markets', 'Business'],
    ];
    const holders = (name: string) =>
      PEOPLE.filter((p) => p.skillNames.includes(name)).length +
      ORG_MENTORS.filter((m) => m.expertise.includes(name)).length;
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const q = params.get('q')?.toLowerCase() ?? '';
    const category = params.get('category');
    const items = SKILLS
      .map(([name, cat]) => ({ id: `skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), category: cat, count: holders(name) }))
      .filter((sk) => (!q || sk.name.toLowerCase().includes(q)) && (!category || sk.category === category))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    return { items, total: items.length };
  }
  if (pathname === '/api/admin/audit-logs') {
    // What the admin did to the rows the other admin screens show: the
    // suspension behind Spyros's status, the resolved report and the
    // dismissed flag, the featured demo day. Actions are AdminService's own.
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const me = PREVIEW_ADMIN_USERS.find((u) => u.id === ME_ID)!;
    const entry = (id: string, action: string, entityType: string, entityId: string, meta: Record<string, unknown>, days: number, hour: number) => ({
      id, actorId: me.id, actorEmail: me.email, action, entityType, entityId, meta, createdAt: previewIsoInDays(days, hour),
    });
    const all = [
      entry('audit-5', 'user.suspend', 'user', 'user-spyros', { reason: 'Two spam reports in two days; suspended pending review.' }, -1, 11),
      entry('audit-4', 'content.feature', 'event', 'ev-demo-day', { reason: 'Athens Founders pitch night' }, -3, 10),
      entry('audit-3', 'report.resolve', 'report', 'rep-3', { note: 'Post removed by its author.', banUser: false }, -11, 9),
      entry('audit-2', 'skill.create', 'skill', 'skill-energy-markets', { name: 'Energy markets' }, -30, 15),
      entry('audit-1', 'user.role_change', 'user', 'user-anna', { oldRole: 'founder', newRole: 'org' }, -120, 12),
    ];
    const action = params.get('action');
    const entityType = params.get('entityType');
    const rows = all.filter((l) => (!action || l.action === action) && (!entityType || l.entityType === entityType));
    const limit = Number(params.get('limit') ?? 50);
    const offset = Number(params.get('offset') ?? 0);
    return { logs: rows.slice(offset, offset + limit), total: rows.length };
  }
  if (pathname === '/api/admin/abuse/stats') {
    const flags = previewAbuseFlags();
    const count = (st: string) => flags.filter((f) => f.status === st).length;
    const offenders = new Map<string, { userId: string; email: string; displayName: string | null; flagCount: number; maxSeverity: number }>();
    for (const f of flags) {
      const o = offenders.get(f.userId) ?? { userId: f.userId, email: f.email, displayName: f.displayName, flagCount: 0, maxSeverity: 0 };
      o.flagCount += 1;
      o.maxSeverity = Math.max(o.maxSeverity, f.severity);
      offenders.set(f.userId, o);
    }
    return {
      totalFlags: flags.length,
      pendingFlags: count('pending'),
      actionedFlags: count('actioned'),
      dismissedFlags: count('dismissed'),
      byType: flags.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.type]: (acc[f.type] ?? 0) + 1 }), {}),
      topOffenders: [...offenders.values()].sort((a, b) => b.flagCount - a.flagCount),
    };
  }
  if (pathname === '/api/admin/abuse') {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const status = params.get('status');
    const type = params.get('type');
    const flags = previewAbuseFlags().filter((f) => (!status || f.status === status) && (!type || f.type === type));
    return { flags, total: flags.length };
  }
  if (pathname === '/api/admin/health') {
    // One API process that has been up for six days; the figures are the
    // shape HealthController measures, not a claim about a real server.
    return {
      status: 'healthy',
      timestamp: new Date(previewNowMs()).toISOString(),
      uptime: 6 * 86_400 + 4 * 3_600 + 12 * 60,
      services: { database: { status: 'up', latency: 4 }, memory: { used: 182, total: 256, percentage: 71 } },
      version: '1.0.0',
    };
  }
  if (pathname === '/api/admin/stats') {
    const users = previewAdminUsers();
    const usersByRole = users.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    }, {});
    const dayMs = 86_400_000;
    const since = (days: number, key: 'createdAt' | 'lastSeenAt') =>
      users.filter((u) => previewNowMs() - Date.parse(u[key]) <= days * dayMs).length;
    return {
      stats: {
        totalUsers: users.length,
        usersByRole,
        newUsersToday: since(1, 'createdAt'),
        newUsersThisWeek: since(7, 'createdAt'),
        newUsersThisMonth: since(30, 'createdAt'),
        activeUsersToday: since(1, 'lastSeenAt'),
        activeUsersThisWeek: since(7, 'lastSeenAt'),
        activeUsersThisMonth: since(30, 'lastSeenAt'),
        totalConnections: CONNECTIONS.length,
        totalMessages: CONVERSATIONS.length,
        totalEvents: PREVIEW_EVENTS.length,
        totalGroups: PREVIEW_GROUPS.length,
        totalJobs: PREVIEW_JOBS.length,
        pendingReports: previewAdminReports().filter((r) => r.status === 'pending').length,
      },
    };
  }
  if (pathname === '/api/services/inquiries') {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const kind = params.get('kind');
    const status = params.get('status');
    const limit = Number(params.get('limit') ?? 50);
    const rows = previewProviderInquiries()
      .filter((r) => kind !== 'projects' || r.status === 'accepted' || r.status === 'completed')
      .filter((r) => kind !== 'reviews' || r.rating != null)
      .filter((r) => !status || r.status === status);
    return { inquiries: rows.slice(0, limit), total: rows.length };
  }
  if (pathname === '/api/services/summary') {
    const rows = previewProviderInquiries();
    const count = (st: string) => rows.filter((r) => r.status === st).length;
    const rated = rows.filter((r) => r.rating != null);
    const services = PREVIEW_PROVIDER_SERVICES;
    return {
      offers: { total: services.length, active: services.filter((x) => x.isActive).length },
      inquiryCounts: { open: count('open'), in_discussion: count('in_discussion'), accepted: count('accepted'), declined: count('declined'), completed: count('completed'), cancelled: count('cancelled') },
      openInquiries: count('open') + count('in_discussion'),
      projects: count('accepted') + count('completed'),
      reviewCount: rated.length,
      avgRating: rated.length ? Math.round((rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    };
  }
  if (pathname === '/api/marketplace/mine') {
    const services = previewProviderServices();
    return { services, total: services.length, hasMore: false };
  }
  if (pathname === '/api/investor/summary') {
    const invested = PREVIEW_DEALS.filter((d) => d.pipelineStage === 'invested');
    const deployedCents = invested.reduce((sum, d) => sum + (d.investedCents ?? 0), 0);
    const currentValueCents = invested.reduce((sum, d) => sum + (d.currentValueCents ?? d.investedCents ?? 0), 0);
    return {
      stageCounts: Object.fromEntries(
        PREVIEW_PIPELINE_STAGES.map((stage) => [
          stage,
          PREVIEW_DEALS.filter((d) => d.pipelineStage === stage).length,
        ]),
      ),
      totalDeals: PREVIEW_DEALS.length,
      investments: invested.length,
      deployedCents,
      currentValueCents,
      returnPct:
        deployedCents > 0
          ? Math.round(((currentValueCents - deployedCents) / deployedCents) * 100)
          : null,
    };
  }
  if (pathname === '/api/investor/activity' || pathname.startsWith('/api/investor/activity?')) {
    const limit = Number(new URLSearchParams(path.split('?')[1] ?? '').get('limit') ?? 20);
    const activity = PREVIEW_DEALS
      .flatMap((deal) =>
        deal.recentEvents.map((event) => ({
          id: event.id,
          dealId: deal.id,
          dealName: deal.name,
          logoUrl: deal.logoUrl,
          type: event.type,
          title: event.title,
          body: event.body,
          createdAt: event.createdAt,
        })),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
    return { activity };
  }
  if (pathname === '/api/investor/deals' && method === 'POST') {
    // Watching a startup from Scouting. The showcase keeps no server state, so
    // it answers the shape the caller reads rather than pretending to persist.
    const name = typeof body.name === 'string' ? body.name : 'New deal';
    return {
      deal: {
        ...PREVIEW_DEALS[0],
        id: `deal-preview-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        pipelineStage: 'discovered',
        starred: false,
        investedCents: null,
        currentValueCents: null,
        investedAt: null,
        recentEvents: [],
      },
    };
  }
  if (pathname === '/api/investor/deals' || pathname.startsWith('/api/investor/deals?')) {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const stage = params.get('pipelineStage');
    const starred = params.get('starred');
    const status = params.get('status');
    const search = params.get('search')?.toLowerCase() ?? '';
    const limit = Number(params.get('limit') ?? 50);
    const offset = Number(params.get('offset') ?? 0);
    const matched = PREVIEW_DEALS
      .filter((d) => !stage || d.pipelineStage === stage)
      .filter((d) => starred == null || d.starred === (starred === 'true'))
      .filter((d) => !status || d.status === status)
      .filter((d) => !search || `${d.name} ${d.tagline ?? ''} ${d.industry ?? ''}`.toLowerCase().includes(search))
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    const deals = matched.slice(offset, offset + limit);
    return { deals, total: matched.length, hasMore: offset + deals.length < matched.length };
  }
  if (pathname.startsWith('/api/investor/deals/')) {
    const id = pathname.split('/')[4];
    const deal = PREVIEW_DEALS.find((d) => d.id === id);
    if (method !== 'GET') return deal ? { ok: true, deal } : { ok: false, deal: null };
    return { deal: deal ?? null };
  }

  if (method !== 'GET') {
    return { ok: true, success: true, ...body, id: 'preview-mutation' };
  }

  // No handler matched. `kitchenSink()` answers with a truthy grab-bag, which is
  // useful for list screens but silently wrong for any endpoint that returns a
  // specific object: `if (data)` passes and the page crashes on the first nested
  // read instead. Surfacing it in dev turns that mystery crash into a one-line
  // "this endpoint has no preview handler".
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[preview-api] No demo handler for ${method} ${pathname} — returning the generic fallback. `
      + 'If a page reads a specific field off this response, add a handler with the real shape.',
    );
  }
  return kitchenSink();
}
