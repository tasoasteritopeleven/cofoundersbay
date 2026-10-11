'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  Save,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { BuilderStageHeader, BUILDER_BTN, BUILDER_STAT, BUILDER_STAT_LABEL, BUILDER_SUBTAB_LIST, BUILDER_SUBTAB_TRIGGER, useBuilderPrimaryText } from './BuilderStageChrome';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { bilingualInline } from '@/lib/i18n/format';
import { STATUS } from '@/lib/semantic-colors';

interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'must-have' | 'should-have' | 'could-have' | 'wont-have';
  complexity: 'low' | 'medium' | 'high';
  effort: string;
  riskLevel: 'low' | 'medium' | 'high';
  dependencies: string[];
  status: 'planned' | 'in-progress' | 'completed';
}

interface UserFlow {
  id: string;
  name: string;
  steps: string[];
  criticalPath: boolean;
}

interface TeamGap {
  skill: string;
  importance: 'critical' | 'important' | 'nice-to-have';
  currentCoverage: number;
  recommendation: string;
}

interface Sprint {
  id: string;
  name: string;
  duration: string;
  goals: string[];
  features: string[];
}

interface MVPData {
  scope: string;
  targetLaunchDate: string;
  features: Feature[];
  userFlows: UserFlow[];
  teamGaps: TeamGap[];
  sprints: Sprint[];
  risks: string[];
  successCriteria: string[];
  technicalComplexity: string;
  launchChecklist: string[];
}

interface MVPPlannerProps {
  onSave?: (data: MVPData) => void;
  initialData?: Partial<MVPData>;
}

const defaultMVPData: MVPData = {
  scope: '',
  targetLaunchDate: '',
  features: [],
  userFlows: [],
  teamGaps: [],
  sprints: [],
  risks: [],
  successCriteria: [],
  technicalComplexity: '',
  launchChecklist: []
};

/** Share of the eight plan parts with anything in them; the stage header and the stored document both use it. */
export function mvpCompletion(data: MVPData): number {
  const parts = [
    Boolean(data.scope),
    data.features.length > 0,
    data.userFlows.length > 0,
    data.teamGaps.length > 0,
    data.sprints.length > 0,
    data.risks.length > 0,
    data.successCriteria.length > 0,
    data.launchChecklist.length > 0,
  ];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
}

export function MVPPlanner({ onSave, initialData }: MVPPlannerProps) {
  const t = useBuilderPrimaryText();
  const [data, setData] = useState<MVPData>({ ...defaultMVPData, ...initialData });
  const [activeTab, setActiveTab] = useState('scope');
  const [isGenerating, setIsGenerating] = useState(false);
  const completionPercentage = mvpCompletion(data);

  const generateWithAI = async () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      setData(prev => ({
        ...prev,
        scope: 'Build a minimum viable platform that enables founders to discover co-founders, create shared workspaces, and generate basic startup documents with AI assistance.',
        features: [
          {
            id: '1',
            name: 'User Authentication & Profiles',
            description: 'Secure login, profile creation with skills, experience, and goals',
            priority: 'must-have',
            complexity: 'medium',
            effort: '2 weeks',
            riskLevel: 'low',
            dependencies: [],
            status: 'planned'
          },
          {
            id: '2',
            name: 'Co-founder Matching Algorithm',
            description: 'AI-powered matching based on complementary skills and goals',
            priority: 'must-have',
            complexity: 'high',
            effort: '3 weeks',
            riskLevel: 'medium',
            dependencies: ['1'],
            status: 'planned'
          },
          {
            id: '3',
            name: 'Startup Workspace',
            description: 'Shared workspace for teams to collaborate on documents',
            priority: 'must-have',
            complexity: 'high',
            effort: '4 weeks',
            riskLevel: 'medium',
            dependencies: ['1', '2'],
            status: 'planned'
          },
          {
            id: '4',
            name: 'AI Document Generation',
            description: 'Generate BMC, pitch decks, and other startup documents',
            priority: 'should-have',
            complexity: 'high',
            effort: '3 weeks',
            riskLevel: 'high',
            dependencies: ['3'],
            status: 'planned'
          },
          {
            id: '5',
            name: 'Messaging System',
            description: 'Real-time messaging between matched users',
            priority: 'must-have',
            complexity: 'medium',
            effort: '2 weeks',
            riskLevel: 'low',
            dependencies: ['1'],
            status: 'planned'
          }
        ],
        teamGaps: [
          {
            skill: 'AI/ML Engineering',
            importance: 'critical',
            currentCoverage: 30,
            recommendation: 'Hire AI engineer or partner with AI consultancy'
          },
          {
            skill: 'Product Design',
            importance: 'important',
            currentCoverage: 60,
            recommendation: 'Consider part-time designer or design agency'
          },
          {
            skill: 'DevOps/Infrastructure',
            importance: 'important',
            currentCoverage: 50,
            recommendation: 'Use managed services initially, hire later'
          }
        ],
        sprints: [
          {
            id: '1',
            name: 'Sprint 1: Foundation',
            duration: '2 weeks',
            goals: ['Set up infrastructure', 'Implement authentication', 'Basic profile system'],
            features: ['1']
          },
          {
            id: '2',
            name: 'Sprint 2: Core Matching',
            duration: '3 weeks',
            goals: ['Build matching algorithm', 'Create discovery interface', 'Implement messaging'],
            features: ['2', '5']
          },
          {
            id: '3',
            name: 'Sprint 3: Workspace',
            duration: '4 weeks',
            goals: ['Build collaborative workspace', 'Document templates', 'Team management'],
            features: ['3']
          },
          {
            id: '4',
            name: 'Sprint 4: AI Features',
            duration: '3 weeks',
            goals: ['Integrate AI generation', 'Build document editors', 'Testing & polish'],
            features: ['4']
          }
        ],
        risks: [
          'AI generation quality may not meet user expectations initially',
          'User acquisition and retention in competitive market',
          'Technical complexity of real-time collaboration features',
          'Dependency on third-party AI APIs (cost and reliability)'
        ],
        successCriteria: [
          '100 active users within first month',
          '20 successful co-founder matches',
          '50 startup workspaces created',
          'NPS score above 40',
          '< 5% churn rate'
        ]
      }));
      setIsGenerating(false);
    }, 3000);
  };

  const addFeature = () => {
    const newFeature: Feature = {
      id: Date.now().toString(),
      name: '',
      description: '',
      priority: 'should-have',
      complexity: 'medium',
      effort: '',
      riskLevel: 'medium',
      dependencies: [],
      status: 'planned'
    };
    setData(prev => ({ ...prev, features: [...prev.features, newFeature] }));
  };

  const updateFeature = (id: string, field: keyof Feature, value: Feature[keyof Feature]) => {
    setData(prev => ({
      ...prev,
      features: prev.features.map(f => f.id === id ? { ...f, [field]: value } : f)
    }));
  };

  const addSprint = () => {
    const newSprint: Sprint = {
      id: Date.now().toString(),
      name: `Sprint ${data.sprints.length + 1}`,
      duration: '2 weeks',
      goals: [],
      features: []
    };
    setData(prev => ({ ...prev, sprints: [...prev.sprints, newSprint] }));
  };

  const handleSave = () => {
    onSave?.(data);
  };

  const getPriorityColor = (priority: Feature['priority']) => {
    switch (priority) {
      case 'must-have': return 'bg-status-danger-mark';
      case 'should-have': return 'bg-status-warning-mark';
      case 'could-have': return 'bg-status-warning-mark';
      case 'wont-have': return 'bg-muted';
    }
  };

  const getComplexityColor = (complexity: Feature['complexity']) => {
    switch (complexity) {
      case 'low': return 'text-status-success';
      case 'medium': return 'text-status-warning';
      case 'high': return 'text-status-danger';
    }
  };

  return (
    <div className="space-y-6">
      <BuilderStageHeader
        glyph="flag"
        titleEn={builderEn('mvp_title')}
        titleEl={builderEl('mvp_title')}
        subtitleEn={builderEn('mvp_sub')}
        subtitleEl={builderEl('mvp_sub')}
        completion={completionPercentage}
        extraActions={
          <>
            <Button variant="outline" size="sm" className={BUILDER_BTN} onClick={generateWithAI} disabled={isGenerating}>
              {isGenerating ? <RefreshCw className="icon-sm mr-2 animate-spin" /> : <CfbGlyph name="spark" className="icon-sm mr-2" />}
              <BilingualText
                en={isGenerating ? builderEn('generating') : builderEn('ai_generate')}
                el={isGenerating ? builderEl('generating') : builderEl('ai_generate')}
                compact
              />
            </Button>
            <Button size="sm" className={BUILDER_BTN} onClick={handleSave}>
              <Save className="icon-sm mr-2" />
              <BilingualText en={builderEn('save')} el={builderEl('save')} compact />
            </Button>
          </>
        }
      />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={BUILDER_SUBTAB_LIST}>
          <TabsTrigger value="scope" className={BUILDER_SUBTAB_TRIGGER}>
            <CfbGlyph name="target" className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mvp_tab_scope')} el={builderEl('mvp_tab_scope')} compact />
          </TabsTrigger>
          <TabsTrigger value="features" className={BUILDER_SUBTAB_TRIGGER}>
            <CfbGlyph name="sliders" className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mvp_tab_feat')} el={builderEl('mvp_tab_feat')} compact />
          </TabsTrigger>
          <TabsTrigger value="sprints" className={BUILDER_SUBTAB_TRIGGER}>
            <CfbGlyph name="calendar" className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mvp_tab_sprints')} el={builderEl('mvp_tab_sprints')} compact />
          </TabsTrigger>
          <TabsTrigger value="team" className={BUILDER_SUBTAB_TRIGGER}>
            <CfbGlyph name="people" className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mvp_tab_team')} el={builderEl('mvp_tab_team')} compact />
          </TabsTrigger>
          <TabsTrigger value="risks" className={BUILDER_SUBTAB_TRIGGER}>
            <AlertTriangle className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mvp_tab_risks')} el={builderEl('mvp_tab_risks')} compact />
          </TabsTrigger>
        </TabsList>

        {/* Scope Tab */}
        <TabsContent value="scope" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <BilingualText en={builderEn('mvp_scope_card')} el={builderEl('mvp_scope_card')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="scope"><BilingualText en={builderEn('mvp_scope_label')} el={builderEl('mvp_scope_label')} compact /></Label>
                  <Textarea id="scope"
                    placeholder={t(builderEn('mvp_scope_ph'), builderEl('mvp_scope_ph'))}
                    value={data.scope}
                    onChange={(e) => setData(prev => ({ ...prev, scope: e.target.value }))}
                    className="min-h-[150px]"
                  />
                </div>
                <div>
                  <Label htmlFor="targetLaunchDate"><BilingualText en={builderEn('mvp_launch')} el={builderEl('mvp_launch')} compact /></Label>
                  <Input id="targetLaunchDate"
                    type="date"
                    value={data.targetLaunchDate}
                    onChange={(e) => setData(prev => ({ ...prev, targetLaunchDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="technicalComplexity"><BilingualText en={builderEn('mvp_complexity')} el={builderEl('mvp_complexity')} compact /></Label>
                  <Textarea id="technicalComplexity"
                    placeholder={t(builderEn('mvp_complexity_ph'), builderEl('mvp_complexity_ph'))}
                    value={data.technicalComplexity}
                    onChange={(e) => setData(prev => ({ ...prev, technicalComplexity: e.target.value }))}
                    className="min-h-[100px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <BilingualText en={builderEn('mvp_success')} el={builderEl('mvp_success')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.successCriteria.map((criteria, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle2 className="icon-sm text-status-success shrink-0" />
                    <Input
                      value={criteria}
                      onChange={(e) => {
                        const newCriteria = [...data.successCriteria];
                        newCriteria[index] = e.target.value;
                        setData(prev => ({ ...prev, successCriteria: newCriteria }));
                      }}
                      placeholder={t(builderEn('mvp_success_ph'), builderEl('mvp_success_ph'))}
                    />
                    <Button
                      aria-label="Remove item"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setData(prev => ({
                          ...prev,
                          successCriteria: prev.successCriteria.filter((_, i) => i !== index)
                        }));
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full ${BUILDER_BTN}`}
                  onClick={() => setData(prev => ({
                    ...prev,
                    successCriteria: [...prev.successCriteria, '']
                  }))}
                >
                  <BilingualText en={builderEn('mvp_add_success')} el={builderEl('mvp_add_success')} compact />
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <BilingualText en={builderEn('mvp_backlog')} el={builderEl('mvp_backlog')} compact />
              </CardTitle>
              <Button variant="outline" size="sm" className={BUILDER_BTN} onClick={addFeature}>
                <BilingualText en={builderEn('mvp_add_feat')} el={builderEl('mvp_add_feat')} compact />
              </Button>
            </CardHeader>
            <CardContent>
              {data.features.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CfbGlyph name="sliders" className="icon-xl mx-auto mb-2 opacity-50" />
                  <p><BilingualText en={builderEn('mvp_no_feat')} el={builderEl('mvp_no_feat')} /></p>
                </div>
              ) : (
                <div className="space-y-4">
                  {['must-have', 'should-have', 'could-have', 'wont-have'].map(priority => {
                    const priorityFeatures = data.features.filter(f => f.priority === priority);
                    if (priorityFeatures.length === 0) return null;
                    
                    return (
                      <div key={priority}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={cn('w-3 h-3 rounded-full', getPriorityColor(priority as Feature['priority']))} />
                          <h4 className="font-medium capitalize">{priority.replace('-', ' ')}</h4>
                          <Badge variant="secondary">{priorityFeatures.length}</Badge>
                        </div>
                        <div className="space-y-2 ml-5">
                          {priorityFeatures.map(feature => (
                            <Card key={feature.id} className="p-4">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div className="md:col-span-2">
                                  <Input
                                    value={feature.name}
                                    onChange={(e) => updateFeature(feature.id, 'name', e.target.value)}
                                    placeholder={bilingualInline("Feature name", "Όνομα λειτουργίας")}
                                    className="font-medium"
                                  />
                                  <Textarea
                                    value={feature.description}
                                    onChange={(e) => updateFeature(feature.id, 'description', e.target.value)}
                                    placeholder={bilingualInline("Description", "Περιγραφή")}
                                    className="mt-2 min-h-[60px]"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <select
                                    value={feature.priority}
                                    onChange={(e) => updateFeature(feature.id, 'priority', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-xl text-sm"
                                  >
                                    <option value="must-have">{t(builderEn('mvp_must'), builderEl('mvp_must'))}</option>
                                    <option value="should-have">{t(builderEn('mvp_should'), builderEl('mvp_should'))}</option>
                                    <option value="could-have">{t(builderEn('mvp_could'), builderEl('mvp_could'))}</option>
                                    <option value="wont-have">{t(builderEn('mvp_wont'), builderEl('mvp_wont'))}</option>
                                  </select>
                                  <select
                                    value={feature.complexity}
                                    onChange={(e) => updateFeature(feature.id, 'complexity', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-xl text-sm"
                                  >
                                    <option value="low">{t(builderEn('mvp_low_c'), builderEl('mvp_low_c'))}</option>
                                    <option value="medium">{t(builderEn('mvp_med_c'), builderEl('mvp_med_c'))}</option>
                                    <option value="high">{t(builderEn('mvp_high_c'), builderEl('mvp_high_c'))}</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Input
                                    value={feature.effort}
                                    onChange={(e) => updateFeature(feature.id, 'effort', e.target.value)}
                                    placeholder={bilingualInline("Effort (e.g., 2 weeks)", "Προσπάθεια (π.χ. 2 εβδομάδες)")}
                                  />
                                  <div className={cn('text-sm font-medium', getComplexityColor(feature.complexity))}>
                                    {feature.complexity.charAt(0).toUpperCase() + feature.complexity.slice(1)} Risk
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature Summary */}
          {data.features.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="text-center">
                  <div className={cn(BUILDER_STAT, STATUS.danger.text)}>
                    {data.features.filter(f => f.priority === 'must-have').length}
                  </div>
                  <div className={BUILDER_STAT_LABEL}>
                    <BilingualText en={builderEn('mvp_must')} el={builderEl('mvp_must')} compact />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center">
                  <div className={cn(BUILDER_STAT, STATUS.warning.text)}>
                    {data.features.filter(f => f.priority === 'should-have').length}
                  </div>
                  <div className={BUILDER_STAT_LABEL}>
                    <BilingualText en={builderEn('mvp_should')} el={builderEl('mvp_should')} compact />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center">
                  <div className={cn(BUILDER_STAT, STATUS.info.text)}>
                    {data.features.filter(f => f.priority === 'could-have').length}
                  </div>
                  <div className={BUILDER_STAT_LABEL}>
                    <BilingualText en={builderEn('mvp_could')} el={builderEl('mvp_could')} compact />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center">
                  <div className={cn(BUILDER_STAT, 'text-muted-foreground')}>
                    {data.features.filter(f => f.priority === 'wont-have').length}
                  </div>
                  <div className={BUILDER_STAT_LABEL}>
                    <BilingualText en={builderEn('mvp_wont')} el={builderEl('mvp_wont')} compact />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Sprints Tab */}
        <TabsContent value="sprints" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <BilingualText en={builderEn('mvp_sprints')} el={builderEl('mvp_sprints')} compact />
              </CardTitle>
              <Button variant="outline" size="sm" className={BUILDER_BTN} onClick={addSprint}>
                <BilingualText en={builderEn('mvp_add_sprint')} el={builderEl('mvp_add_sprint')} compact />
              </Button>
            </CardHeader>
            <CardContent>
              {data.sprints.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CfbGlyph name="calendar" className="icon-xl mx-auto mb-2 opacity-50" />
                  <p><BilingualText en={builderEn('mvp_no_sprint')} el={builderEl('mvp_no_sprint')} /></p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.sprints.map((sprint, index) => (
                    <Card key={sprint.id} className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Input
                              value={sprint.name}
                              onChange={(e) => {
                                const newSprints = [...data.sprints];
                                newSprints[index] = { ...sprint, name: e.target.value };
                                setData(prev => ({ ...prev, sprints: newSprints }));
                              }}
                              placeholder={bilingualInline("Sprint name", "Όνομα sprint")}
                              className="font-medium"
                            />
                            <Input
                              value={sprint.duration}
                              onChange={(e) => {
                                const newSprints = [...data.sprints];
                                newSprints[index] = { ...sprint, duration: e.target.value };
                                setData(prev => ({ ...prev, sprints: newSprints }));
                              }}
                              placeholder={bilingualInline("Duration (e.g., 2 weeks)", "Διάρκεια (π.χ. 2 εβδομάδες)")}
                            />
                          </div>
                          <div>
                            <p id="goals-cap" className="text-xs text-muted-foreground">Goals</p>
                            <div role="group" aria-labelledby="goals-cap" className="flex flex-wrap gap-2 mt-1">
                              {sprint.goals.map((goal, goalIndex) => (
                                <Badge key={goalIndex} variant="secondary" className="gap-1">
                                  {goal}
                                  <button
                                    onClick={() => {
                                      const newSprints = [...data.sprints];
                                      newSprints[index] = {
                                        ...sprint,
                                        goals: sprint.goals.filter((_, i) => i !== goalIndex)
                                      };
                                      setData(prev => ({ ...prev, sprints: newSprints }));
                                    }}
                                    className="ml-1 hover:text-destructive-accessible"
                                  >
                                    ×
                                  </button>
                                </Badge>
                              ))}
                              <Input
                                placeholder={bilingualInline("Add goal…", "Προσθήκη στόχου…")}
                                className="w-32 h-6 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.currentTarget.value) {
                                    const newSprints = [...data.sprints];
                                    newSprints[index] = {
                                      ...sprint,
                                      goals: [...sprint.goals, e.currentTarget.value]
                                    };
                                    setData(prev => ({ ...prev, sprints: newSprints }));
                                    e.currentTarget.value = '';
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Gaps Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CfbGlyph name="people" className="icon-sm" />
                <BilingualText en={builderEn('mvp_gaps')} el={builderEl('mvp_gaps')} compact />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.teamGaps.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CfbGlyph name="people" className="icon-xl mx-auto mb-2 opacity-50" />
                  <p><BilingualText en={builderEn('mvp_no_gaps')} el={builderEl('mvp_no_gaps')} /></p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.teamGaps.map((gap, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{gap.skill}</span>
                          <Badge variant={
                            gap.importance === 'critical' ? 'destructive' :
                            gap.importance === 'important' ? 'default' : 'secondary'
                          }>
                            {gap.importance}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {gap.currentCoverage}% covered
                        </span>
                      </div>
                      <Progress value={gap.currentCoverage} className="h-1.5 mb-3" />
                      <p className="text-sm text-muted-foreground">{gap.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="icon-sm text-status-warning" />
                <BilingualText en={builderEn('mvp_risks')} el={builderEl('mvp_risks')} compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.risks.map((risk, index) => (
                <div key={index} className="flex items-center gap-2">
                  <AlertTriangle className="icon-sm text-status-warning shrink-0" />
                  <Input
                    value={risk}
                    onChange={(e) => {
                      const newRisks = [...data.risks];
                      newRisks[index] = e.target.value;
                      setData(prev => ({ ...prev, risks: newRisks }));
                    }}
                    placeholder={t(builderEn('mvp_risk_ph'), builderEl('mvp_risk_ph'))}
                  />
                  <Button
                    aria-label="Remove item"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setData(prev => ({
                        ...prev,
                        risks: prev.risks.filter((_, i) => i !== index)
                      }));
                    }}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className={`w-full ${BUILDER_BTN}`}
                onClick={() => setData(prev => ({
                  ...prev,
                  risks: [...prev.risks, '']
                }))}
              >
                <BilingualText en={builderEn('mvp_add_risk')} el={builderEl('mvp_add_risk')} compact />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
