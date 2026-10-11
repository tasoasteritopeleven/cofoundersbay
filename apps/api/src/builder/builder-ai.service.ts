import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';
import {
  BuilderDocumentType,
  GenerateContentDto,
} from './dto/builder.dto';

interface AIProviderConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
}

const BUILDER_AI_CACHE_POLICY_VERSION = 'v2';

export interface GenerationResult {
  content: Record<string, any>;
  tokensUsed: number;
  latencyMs: number;
  model: string;
}

@Injectable()
export class BuilderAIService {
  private readonly logger = new Logger(BuilderAIService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async generateDocumentContent(
    userId: string,
    dto: GenerateContentDto,
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const config = this.getAIConfig(dto.model);

    await this.assertWorkspaceAccess(userId, dto.workspaceId, 'editor');
    
    // Build prompt based on document type and context
    const prompt = this.buildPrompt(dto);
    const promptHash = this.hashPrompt([
      BUILDER_AI_CACHE_POLICY_VERSION,
      dto.workspaceId,
      userId,
      config.model,
      prompt,
    ].join('\n'));

    // Cache hits are scoped to the authenticated actor and workspace. A prompt
    // hash alone can otherwise disclose generated private context across teams.
    const cached = await this.checkCache(promptHash, dto.workspaceId, userId, config.model);
    if (cached) {
      return {
        content: cached.response as Record<string, any>,
        tokensUsed: cached.tokensUsed || 0,
        latencyMs: 0,
        model: cached.model,
      };
    }

    // Log generation request
    const generation = await this.prisma.builderAIGeneration.create({
      data: {
        workspaceId: dto.workspaceId,
        userId,
        documentType: dto.documentType,
        sectionKey: dto.sectionKey,
        prompt,
        promptHash,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        status: 'pending',
      },
    });

    try {
      let result: { content: Record<string, any>; tokensUsed: number };

      if (config.provider === 'openai') {
        result = await this.callOpenAI(prompt, config);
      } else {
        result = await this.callAnthropic(prompt, config);
      }

      const latencyMs = Date.now() - startTime;

      // Update generation record
      await this.prisma.builderAIGeneration.update({
        where: { id: generation.id },
        data: {
          response: result.content,
          tokensUsed: result.tokensUsed,
          latencyMs,
          status: 'completed',
          completedAt: new Date(),
          costCents: this.calculateCost(result.tokensUsed, config.model),
        },
      });

      return {
        content: result.content,
        tokensUsed: result.tokensUsed,
        latencyMs,
        model: config.model,
      };
    } catch (error) {
      // Log error
      await this.prisma.builderAIGeneration.update({
        where: { id: generation.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  async generateSection(
    userId: string,
    workspaceId: string,
    documentType: BuilderDocumentType,
    sectionKey: string,
    context: Record<string, any>,
  ): Promise<Record<string, any>> {
    const result = await this.generateDocumentContent(userId, {
      workspaceId,
      documentType,
      sectionKey,
      context,
    });

    return result.content;
  }

  async generateApplicationAnswer(
    userId: string,
    workspaceId: string,
    question: string,
    context: Record<string, any>,
  ): Promise<string> {
    await this.assertWorkspaceAccess(userId, workspaceId, 'editor');

    const prompt = this.buildApplicationAnswerPrompt(question, context);
    const config = this.getAIConfig();

    const result = await this.callProvider(prompt, config);
    return result.content.answer || '';
  }

  async generateReadinessRecommendations(
    workspaceId: string,
    dimension: string,
    criteria: any[],
  ): Promise<string[]> {
    const incompleteCriteria = criteria.filter((c) => !c.completed);
    
    if (incompleteCriteria.length === 0) {
      return ['All criteria met! Consider advancing to the next stage.'];
    }

    const prompt = `Based on the following incomplete startup readiness criteria for the "${dimension}" dimension, provide 3-5 actionable recommendations:

Incomplete criteria:
${incompleteCriteria.map((c) => `- ${c.name}: ${c.description}`).join('\n')}

Provide specific, actionable recommendations that a startup founder can implement immediately. Format as a JSON array of strings.`;

    const config = this.getAIConfig();
    const result = await this.callProvider(prompt, config);

    return result.content.recommendations || [];
  }

  async improveContent(
    content: string,
    documentType: BuilderDocumentType,
    feedback?: string,
  ): Promise<string> {
    const prompt = `Improve the following ${documentType.replace('_', ' ')} content:

${content}

${feedback ? `User feedback: ${feedback}` : ''}

Provide an improved version that is more compelling, clear, and professional. Return the improved content as a JSON object with an "improved" field.`;

    const config = this.getAIConfig();
    const result = await this.callProvider(prompt, config);

    return result.content.improved || content;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private getAIConfig(modelOverride?: string): AIProviderConfig {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    // Prefer Anthropic if available, fallback to OpenAI
    if (anthropicKey) {
      return {
        provider: 'anthropic',
        model: modelOverride || 'claude-3-sonnet-20240229',
        apiKey: anthropicKey,
        maxTokens: 4096,
        temperature: 0.7,
      };
    }

    if (openaiKey) {
      return {
        provider: 'openai',
        model: modelOverride || 'gpt-4-turbo-preview',
        apiKey: openaiKey,
        maxTokens: 4096,
        temperature: 0.7,
      };
    }

    // Fallback to mock for development
    return {
      provider: 'openai',
      model: 'mock',
      apiKey: '',
      maxTokens: 4096,
      temperature: 0.7,
    };
  }

  private buildPrompt(dto: GenerateContentDto): string {
    const basePrompts: Record<string, string> = {
      idea_core: `Generate a comprehensive startup idea core document with the following structure:
- Problem: A clear, compelling problem statement
- Solution: How your product/service solves the problem
- Target Customer: Who experiences this problem most acutely
- Unique Value: What makes your solution different
- Assumptions: Key assumptions that need validation
- Pain Points: Specific pain points you're addressing

Context: ${JSON.stringify(dto.context || {})}

Return as a JSON object matching this structure.`,

      business_model_canvas: `Generate a Business Model Canvas with all 9 building blocks:
- Customer Segments: Who are your most important customers?
- Value Propositions: What value do you deliver?
- Channels: How do you reach customers?
- Customer Relationships: What type of relationship?
- Revenue Streams: How do you make money?
- Key Resources: What assets are required?
- Key Activities: What must you do?
- Key Partnerships: Who are your partners?
- Cost Structure: What are the costs?

Context: ${JSON.stringify(dto.context || {})}

Return as a JSON object with arrays for each section.`,

      market_analysis: `Generate a comprehensive market analysis including:
- TAM (Total Addressable Market): Size and description
- SAM (Serviceable Addressable Market): Size and description
- SOM (Serviceable Obtainable Market): Size and description
- Competitors: List of competitors with strengths/weaknesses
- ICP (Ideal Customer Profile): Demographics, behaviors, needs
- Personas: 2-3 detailed customer personas
- Trends: Key market trends
- Positioning: How you differentiate

Context: ${JSON.stringify(dto.context || {})}

Return as a JSON object.`,

      pitch_deck: `Generate pitch deck slide content for a startup presentation:
- Cover: Company name, tagline
- Problem: The problem you're solving
- Solution: Your solution
- Market: Market size and opportunity
- Product: Product overview and demo points
- Business Model: How you make money
- Traction: Key metrics and milestones
- Team: Team overview
- Competition: Competitive landscape
- Financials: Key financial projections
- Ask: What you're raising and use of funds

Context: ${JSON.stringify(dto.context || {})}

Return as a JSON object with slide content.`,

      application: `Draft accelerator or grant answers for the programme in context.programId.
Return JSON { "answers": { "<questionId>": "<text>" } }.
Fill only questions whose current answer is empty in context.current.
Do not invent users, press metrics, ARR, Sequoia, San Francisco HQ, or a second founder history.
If traction is needed, use the $750K seed ($375K committed by Athens Tech Angels) and Builder artefacts already in context — not invented MRR or user counts.
Respect each question's maxLength.

Context: ${JSON.stringify(dto.context || {})}

Return as a JSON object with an answers map.`,

      mvp_plan: `Generate an MVP (Minimum Viable Product) plan including:
- Scope: What's in and out of scope
- Features: Prioritized feature list with MoSCoW
- Sprints: 4-6 sprint plan with deliverables
- Team Gaps: Skills needed
- Risks: Key risks and mitigations
- Success Criteria: How you'll measure success

Context: ${JSON.stringify(dto.context || {})}

Return as a JSON object.`,

      financial_plan: `Generate a financial plan including:
- Startup Costs: Initial investment needed
- Operating Costs: Monthly/annual operating expenses
- Revenue Streams: Revenue sources and projections
- Funding Rounds: Planned funding rounds
- Unit Economics: CAC, LTV, margins
- Scenarios: Best/base/worst case projections

Context: ${JSON.stringify(dto.context || {})}

Return as a JSON object.`,
    };

    const basePrompt = basePrompts[dto.documentType] || 
      `Generate content for a ${dto.documentType} document. Context: ${JSON.stringify(dto.context || {})}. Return as JSON.`;

    if (dto.customPrompt) {
      return `${basePrompt}\n\nAdditional instructions: ${dto.customPrompt}`;
    }

    return basePrompt;
  }

  private buildApplicationAnswerPrompt(question: string, context: Record<string, any>): string {
    return `You are helping a startup founder answer an accelerator or grant question.

Question: ${question}

Startup Context:
${JSON.stringify(context, null, 2)}

Write an authentic answer that:
1. Directly addresses the question
2. Uses only facts in the context (Idea Core, GTM, seed)
3. Does not invent users, press metrics, ARR, Sequoia, or a second founder history
4. Treats traction as the $750K seed ($375K committed by Athens Tech Angels) when the context has no other numbers
5. Stays within the question's maxLength when provided

Return as JSON with an "answer" field containing the response.`;
  }

  private async callProvider(
    prompt: string,
    config: AIProviderConfig,
  ): Promise<{ content: Record<string, any>; tokensUsed: number }> {
    if (config.provider === 'openai') {
      return this.callOpenAI(prompt, config);
    }
    return this.callAnthropic(prompt, config);
  }

  private async callOpenAI(
    prompt: string,
    config: AIProviderConfig,
  ): Promise<{ content: Record<string, any>; tokensUsed: number }> {
    if (config.model === 'mock') {
      return this.getMockResponse(prompt);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert startup advisor and business strategist. Always respond with valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`OpenAI API error: ${error}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    const tokensUsed = data.usage?.total_tokens || 0;

    return { content, tokensUsed };
  }

  private async callAnthropic(
    prompt: string,
    config: AIProviderConfig,
  ): Promise<{ content: Record<string, any>; tokensUsed: number }> {
    if (config.model === 'mock') {
      return this.getMockResponse(prompt);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nRespond with valid JSON only.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Anthropic API error: ${error}`);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.content[0]?.text || '{}';
    
    // Extract JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    const content = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    return { content, tokensUsed };
  }

  private getMockResponse(prompt: string): { content: Record<string, any>; tokensUsed: number } {
    // Return mock data for development without API keys
    if (prompt.includes('business_model_canvas')) {
      return {
        content: {
          customerSegments: ['Early-stage startups', 'Tech entrepreneurs', 'Accelerator participants'],
          valuePropositions: ['AI-powered startup formation', 'Comprehensive workspace', 'Expert guidance'],
          channels: ['Direct web platform', 'Partner accelerators', 'Content marketing'],
          customerRelationships: ['Self-service platform', 'Community support', 'Premium consulting'],
          revenueStreams: ['SaaS subscriptions', 'Enterprise licenses', 'Consulting services'],
          keyResources: ['AI technology', 'Expert network', 'Platform infrastructure'],
          keyActivities: ['Platform development', 'AI model training', 'Community building'],
          keyPartnerships: ['Accelerators', 'VCs', 'Universities'],
          costStructure: ['Engineering team', 'AI compute', 'Marketing'],
        },
        tokensUsed: 500,
      };
    }

    if (prompt.includes('market_analysis')) {
      return {
        content: {
          tam: { value: 50000000000, description: 'Global startup services market' },
          sam: { value: 5000000000, description: 'Digital startup tools and platforms' },
          som: { value: 100000000, description: 'AI-powered startup formation tools' },
          competitors: [
            { name: 'Notion', strengths: ['Flexibility'], weaknesses: ['Not startup-specific'] },
            { name: 'Canva', strengths: ['Design tools'], weaknesses: ['Limited business tools'] },
          ],
          icp: {
            demographics: 'Tech-savvy founders, 25-45 years old',
            behaviors: 'Active in startup communities, seeking efficiency',
            needs: 'Comprehensive tools, expert guidance, time savings',
          },
          personas: [
            {
              name: 'First-time Founder',
              description: 'Technical background, needs business guidance',
              goals: 'Launch MVP, raise seed funding',
            },
          ],
          trends: ['AI adoption', 'Remote-first startups', 'No-code movement'],
          positioning: 'The AI-powered startup operating system',
        },
        tokensUsed: 600,
      };
    }

    if (prompt.includes('answers map') || prompt.includes('accelerator or grant answers')) {
      return {
        content: {
          answers: {
            yc1: 'Harbor OS for early-stage founders.',
          },
        },
        tokensUsed: 80,
      };
    }

    if (prompt.includes('accelerator or grant question')) {
      return {
        content: { answer: 'Harbor OS for early-stage founders.' },
        tokensUsed: 40,
      };
    }

    // Default mock response
    return {
      content: {
        generated: true,
        message: 'This is mock content for development. Configure OPENAI_API_KEY or ANTHROPIC_API_KEY for real generation.',
        timestamp: new Date().toISOString(),
      },
      tokensUsed: 100,
    };
  }

  private async checkCache(
    promptHash: string,
    workspaceId: string,
    userId: string,
    model: string,
  ): Promise<any | null> {
    const cached = await this.prisma.builderAIGeneration.findFirst({
      where: {
        promptHash,
        workspaceId,
        userId,
        model,
        status: 'completed',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hour cache
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cached;
  }

  private async assertWorkspaceAccess(
    userId: string,
    workspaceId: string,
    requiredRole: 'viewer' | 'commenter' | 'editor' | 'owner',
  ): Promise<void> {
    const workspace = await this.prisma.builderWorkspace.findUnique({
      where: { id: workspaceId },
      select: {
        ownerId: true,
        collaborators: {
          where: { userId, isActive: true },
          select: { role: true },
          take: 1,
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId === userId) {
      return;
    }

    const collaborator = workspace.collaborators[0];
    if (!collaborator) {
      throw new ForbiddenException('Access denied');
    }

    const roleHierarchy = ['viewer', 'commenter', 'editor', 'owner'];
    if (roleHierarchy.indexOf(collaborator.role) < roleHierarchy.indexOf(requiredRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private hashPrompt(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex').substring(0, 32);
  }

  private calculateCost(tokens: number, model: string): number {
    // Approximate costs in cents per 1K tokens
    const costs: Record<string, number> = {
      'gpt-4-turbo-preview': 3, // $0.03 per 1K tokens (average of input/output)
      'gpt-4': 6,
      'gpt-3.5-turbo': 0.2,
      'claude-3-opus-20240229': 7.5,
      'claude-3-sonnet-20240229': 1.5,
      'claude-3-haiku-20240307': 0.125,
    };

    const costPer1K = costs[model] || 1;
    return Math.ceil((tokens / 1000) * costPer1K);
  }
}
