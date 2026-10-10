'use client';

import {
  Lightbulb, Users, TrendingUp, Target, Briefcase,
  GraduationCap, Building2, Rocket, FileSearch, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { BilingualText } from '@/components/common/BilingualText';
import { RESEARCH_TEMPLATE_I18N, RESEARCH_TAG_EL, researchEn, researchEl } from '@/lib/i18n/strings-research';
import { cn } from '@/lib/utils';

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tags: string[];
  initialNodes: Array<{
    type: 'note';
    title: string;
    content: string;
    posX: number;
    posY: number;
    width: number;
    height: number;
    color?: string;
  }>;
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'startup-validation',
    name: 'Startup Idea Validation',
    description: 'Validate your startup idea with structured research',
    icon: Lightbulb,
    color: '#F59E0B',
    tags: ['validation', 'research', 'startup'],
    initialNodes: [
      {
        type: 'note',
        title: 'Problem Statement',
        content: '<h2>Problem</h2><p>What problem are you solving?</p><ul><li>Who experiences this problem?</li><li>How painful is it?</li><li>How are they solving it today?</li></ul>',
        posX: 100,
        posY: 100,
        width: 300,
        height: 250,
        color: '#FEF3C7',
      },
      {
        type: 'note',
        title: 'Target Customer',
        content: '<h2>Customer Segment</h2><p>Who is your ideal customer?</p><ul><li>Demographics</li><li>Behaviors</li><li>Pain points</li><li>Budget</li></ul>',
        posX: 450,
        posY: 100,
        width: 300,
        height: 250,
        color: '#DBEAFE',
      },
      {
        type: 'note',
        title: 'Solution',
        content: '<h2>Proposed Solution</h2><p>How will you solve this problem?</p><ul><li>Key features</li><li>Unique value proposition</li><li>Why now?</li></ul>',
        posX: 800,
        posY: 100,
        width: 300,
        height: 250,
        color: '#D1FAE5',
      },
      {
        type: 'note',
        title: 'Market Size',
        content: '<h2>Market Analysis</h2><ul><li>TAM (Total Addressable Market)</li><li>SAM (Serviceable Addressable Market)</li><li>SOM (Serviceable Obtainable Market)</li></ul>',
        posX: 100,
        posY: 400,
        width: 300,
        height: 200,
        color: '#FCE7F3',
      },
      {
        type: 'note',
        title: 'Competition',
        content: '<h2>Competitive Landscape</h2><p>Who are your competitors?</p><ul><li>Direct competitors</li><li>Indirect competitors</li><li>Your differentiation</li></ul>',
        posX: 450,
        posY: 400,
        width: 300,
        height: 200,
        color: '#FEE2E2',
      },
    ],
  },
  {
    id: 'cofounder-evaluation',
    name: 'Co-founder Evaluation',
    description: 'Evaluate potential co-founders systematically',
    icon: Users,
    color: '#8B5CF6',
    tags: ['team', 'cofounder', 'evaluation'],
    initialNodes: [
      {
        type: 'note',
        title: 'Skills Assessment',
        content: '<h2>Technical & Business Skills</h2><ul><li>Technical expertise</li><li>Business acumen</li><li>Industry experience</li><li>Network strength</li></ul>',
        posX: 100,
        posY: 100,
        width: 320,
        height: 220,
        color: '#EDE9FE',
      },
      {
        type: 'note',
        title: 'Values & Vision',
        content: '<h2>Alignment Check</h2><ul><li>Long-term vision</li><li>Work ethic expectations</li><li>Risk tolerance</li><li>Exit expectations</li></ul>',
        posX: 470,
        posY: 100,
        width: 320,
        height: 220,
        color: '#DBEAFE',
      },
      {
        type: 'note',
        title: 'Working Style',
        content: '<h2>Collaboration Fit</h2><ul><li>Communication style</li><li>Decision-making approach</li><li>Conflict resolution</li><li>Remote vs in-person</li></ul>',
        posX: 100,
        posY: 370,
        width: 320,
        height: 220,
        color: '#D1FAE5',
      },
      {
        type: 'note',
        title: 'Red Flags & Concerns',
        content: '<h2>Watch Out For</h2><ul><li>Past conflicts</li><li>Commitment level</li><li>Financial situation</li><li>Other obligations</li></ul>',
        posX: 470,
        posY: 370,
        width: 320,
        height: 220,
        color: '#FEE2E2',
      },
    ],
  },
  {
    id: 'market-research',
    name: 'Market Research',
    description: 'Comprehensive market analysis framework',
    icon: TrendingUp,
    color: '#10B981',
    tags: ['market-analysis', 'research', 'strategy'],
    initialNodes: [
      {
        type: 'note',
        title: 'Industry Overview',
        content: '<h2>Industry Analysis</h2><ul><li>Market size & growth</li><li>Key trends</li><li>Regulatory environment</li><li>Technology shifts</li></ul>',
        posX: 100,
        posY: 100,
        width: 300,
        height: 200,
        color: '#D1FAE5',
      },
      {
        type: 'note',
        title: 'Customer Segments',
        content: '<h2>Target Segments</h2><ul><li>Segment 1: Description</li><li>Segment 2: Description</li><li>Segment 3: Description</li></ul>',
        posX: 450,
        posY: 100,
        width: 300,
        height: 200,
        color: '#DBEAFE',
      },
      {
        type: 'note',
        title: 'Competitive Analysis',
        content: '<h2>Key Competitors</h2><p>Analyze top 5 competitors:</p><ul><li>Strengths</li><li>Weaknesses</li><li>Market position</li><li>Pricing</li></ul>',
        posX: 800,
        posY: 100,
        width: 300,
        height: 200,
        color: '#FEE2E2',
      },
      {
        type: 'note',
        title: 'Market Opportunities',
        content: '<h2>Opportunities</h2><ul><li>Underserved segments</li><li>Emerging needs</li><li>Technology gaps</li><li>Geographic expansion</li></ul>',
        posX: 275,
        posY: 350,
        width: 300,
        height: 200,
        color: '#FEF3C7',
      },
      {
        type: 'note',
        title: 'Threats & Risks',
        content: '<h2>Market Risks</h2><ul><li>New entrants</li><li>Substitute products</li><li>Economic factors</li><li>Regulatory changes</li></ul>',
        posX: 625,
        posY: 350,
        width: 300,
        height: 200,
        color: '#FCE7F3',
      },
    ],
  },
  {
    id: 'investor-pitch',
    name: 'Investor Pitch Prep',
    description: 'Prepare for investor meetings and pitches',
    icon: Target,
    color: '#EF4444',
    tags: ['funding', 'investor', 'pitch-deck'],
    initialNodes: [
      {
        type: 'note',
        title: 'Pitch Deck Outline',
        content: '<h2>Key Slides</h2><ol><li>Problem</li><li>Solution</li><li>Market Size</li><li>Business Model</li><li>Traction</li><li>Team</li><li>Financials</li><li>Ask</li></ol>',
        posX: 100,
        posY: 100,
        width: 280,
        height: 280,
        color: '#FEE2E2',
      },
      {
        type: 'note',
        title: 'Key Metrics',
        content: '<h2>Traction & KPIs</h2><ul><li>MRR/ARR</li><li>Growth rate</li><li>CAC / LTV</li><li>Churn rate</li><li>User engagement</li></ul>',
        posX: 430,
        posY: 100,
        width: 280,
        height: 200,
        color: '#D1FAE5',
      },
      {
        type: 'note',
        title: 'Investor Questions',
        content: '<h2>Anticipated Questions</h2><ul><li>Why now?</li><li>Why you?</li><li>What\'s your moat?</li><li>How will you use funds?</li><li>What\'s your exit strategy?</li></ul>',
        posX: 760,
        posY: 100,
        width: 280,
        height: 200,
        color: '#DBEAFE',
      },
      {
        type: 'note',
        title: 'Target Investors',
        content: '<h2>Investor List</h2><p>Research and list potential investors:</p><ul><li>Name, Fund, Focus</li><li>Portfolio companies</li><li>Check size</li><li>Intro path</li></ul>',
        posX: 265,
        posY: 350,
        width: 280,
        height: 200,
        color: '#FEF3C7',
      },
      {
        type: 'note',
        title: 'Due Diligence Prep',
        content: '<h2>Documents Ready</h2><ul><li>Cap table</li><li>Financial model</li><li>Legal docs</li><li>Customer references</li><li>Technical architecture</li></ul>',
        posX: 595,
        posY: 350,
        width: 280,
        height: 200,
        color: '#EDE9FE',
      },
    ],
  },
  {
    id: 'mentorship-session',
    name: 'Mentorship Session',
    description: 'Prepare for and document mentorship sessions',
    icon: GraduationCap,
    color: '#6366F1',
    tags: ['mentor-notes', 'guidance', 'learning'],
    initialNodes: [
      {
        type: 'note',
        title: 'Session Goals',
        content: '<h2>What I Want to Achieve</h2><ul><li>Goal 1</li><li>Goal 2</li><li>Goal 3</li></ul>',
        posX: 100,
        posY: 100,
        width: 300,
        height: 180,
        color: '#EDE9FE',
      },
      {
        type: 'note',
        title: 'Questions to Ask',
        content: '<h2>Key Questions</h2><ol><li>Question 1</li><li>Question 2</li><li>Question 3</li></ol>',
        posX: 450,
        posY: 100,
        width: 300,
        height: 180,
        color: '#DBEAFE',
      },
      {
        type: 'note',
        title: 'Session Notes',
        content: '<h2>Key Takeaways</h2><p>Document insights and advice here...</p>',
        posX: 100,
        posY: 330,
        width: 400,
        height: 200,
        color: '#D1FAE5',
      },
      {
        type: 'note',
        title: 'Action Items',
        content: '<h2>Next Steps</h2><ul><li>[ ] Action 1</li><li>[ ] Action 2</li><li>[ ] Action 3</li></ul>',
        posX: 550,
        posY: 330,
        width: 300,
        height: 200,
        color: '#FEF3C7',
      },
    ],
  },
  {
    id: 'due-diligence',
    name: 'Due Diligence',
    description: 'Comprehensive due diligence checklist',
    icon: FileSearch,
    color: '#0EA5E9',
    tags: ['due-diligence', 'investor', 'evaluation'],
    initialNodes: [
      {
        type: 'note',
        title: 'Team Assessment',
        content: '<h2>Founders & Team</h2><ul><li>Background checks</li><li>Track record</li><li>Skill gaps</li><li>References</li></ul>',
        posX: 100,
        posY: 100,
        width: 280,
        height: 200,
        color: '#DBEAFE',
      },
      {
        type: 'note',
        title: 'Market Validation',
        content: '<h2>Market Check</h2><ul><li>Market size verification</li><li>Customer interviews</li><li>Competitive landscape</li><li>Industry trends</li></ul>',
        posX: 430,
        posY: 100,
        width: 280,
        height: 200,
        color: '#D1FAE5',
      },
      {
        type: 'note',
        title: 'Financial Review',
        content: '<h2>Financials</h2><ul><li>Revenue verification</li><li>Unit economics</li><li>Burn rate</li><li>Projections analysis</li></ul>',
        posX: 760,
        posY: 100,
        width: 280,
        height: 200,
        color: '#FEF3C7',
      },
      {
        type: 'note',
        title: 'Legal & IP',
        content: '<h2>Legal Review</h2><ul><li>Corporate structure</li><li>IP ownership</li><li>Contracts review</li><li>Litigation history</li></ul>',
        posX: 265,
        posY: 350,
        width: 280,
        height: 200,
        color: '#FCE7F3',
      },
      {
        type: 'note',
        title: 'Technical Assessment',
        content: '<h2>Technology</h2><ul><li>Architecture review</li><li>Scalability</li><li>Security audit</li><li>Technical debt</li></ul>',
        posX: 595,
        posY: 350,
        width: 280,
        height: 200,
        color: '#EDE9FE',
      },
    ],
  },
];

interface BoardTemplatesDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: BoardTemplate) => void;
  onStartBlank?: () => void;
}

export const TEMPLATE_GLYPH: Record<string, CfbGlyphName> = {
  'startup-validation': 'spark',
  'cofounder-evaluation': 'people',
  'market-research': 'chart',
  'investor-pitch': 'target',
  'mentorship-session': 'mentor',
  'due-diligence': 'shield',
};

export function ResearchTemplateTile({
  template,
  onSelect,
}: {
  template: BoardTemplate;
  onSelect: (template: BoardTemplate) => void;
}) {
  const copy = RESEARCH_TEMPLATE_I18N[template.id];
  const glyph = TEMPLATE_GLYPH[template.id] ?? 'research';
  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={cn(
        'flex min-h-11 items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-left',
        'transition-colors hover:border-border hover:bg-muted/30',
      )}
    >
      <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary-accessible">
        <CfbGlyph name={glyph} className="icon-sm" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="page-section font-semibold leading-snug">
          {copy ? <BilingualText en={copy.name.en} el={copy.name.el} compact wrap /> : template.name}
        </div>
        <div className="mt-1 text-xs leading-snug text-muted-foreground">
          {copy ? (
            <BilingualText en={copy.description.en} el={copy.description.el} wrap />
          ) : (
            template.description
          )}
        </div>
        {/* Pills, so three tags and a count do not read as one phrase. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
          {template.tags.map((tag) => (
            <span key={tag}>
              <BilingualText en={tag} el={RESEARCH_TAG_EL[tag] ?? tag} compact />
            </span>
          ))}
          <span className="px-0.5 tabular-nums">
            {template.initialNodes.length}{' '}
            <BilingualText en={researchEn('tpl_nodes')} el={researchEl('tpl_nodes')} compact />
          </span>
        </div>
      </div>
    </button>
  );
}

export function BoardTemplatesDialog({
  open,
  onClose,
  onSelectTemplate,
  onStartBlank,
}: BoardTemplatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[80vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <BilingualText en={researchEn('tpl_dialog_title')} el={researchEl('tpl_dialog_title')} />
          </DialogTitle>
          <DialogDescription>
            <BilingualText en={researchEn('tpl_dialog_desc')} el={researchEl('tpl_dialog_desc')} />
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-3 py-2">
          {BOARD_TEMPLATES.map((template) => (
            <ResearchTemplateTile
              key={template.id}
              template={template}
              onSelect={(tpl) => {
                onSelectTemplate(tpl);
                onClose();
              }}
            />
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              onClose();
              onStartBlank?.();
            }}
          >
            <BilingualText en={researchEn('tpl_blank')} el={researchEl('tpl_blank')} compact />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
