import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface ProfileSuggestions {
  headline: string | null;
  bio: string | null;
  missingElements: string[];
  improvements: string[];
  completionScore: number;
}

export interface MeetingNotesSummary {
  summary: string;
  actionItems: string[];
  keyTakeaways: string[];
  followUps: string[];
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly openaiKey: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') ?? null;
  }

  async getProfileSuggestions(userId: string): Promise<ProfileSuggestions> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { skills: { include: { skill: true } } } } },
    });

    if (!user?.profile) {
      return this.buildFallbackSuggestions(null);
    }

    const profile = user.profile;
    const skills = (profile.skills ?? []).map((s: any) => s.skill?.name ?? s.skillId);

    if (this.openaiKey) {
      try {
        return await this.callOpenAI(profile, skills, user.role);
      } catch (err) {
        this.logger.warn('OpenAI call failed, using rule-based suggestions', err);
      }
    }

    return this.buildFallbackSuggestions(profile, skills, user.role);
  }

  async summarizeMeetingNotes(notes: string): Promise<MeetingNotesSummary> {
    if (!notes?.trim()) {
      return { summary: '', actionItems: [], keyTakeaways: [], followUps: [] };
    }

    if (this.openaiKey) {
      try {
        return await this.callOpenAIForMeetingNotes(notes);
      } catch (err) {
        this.logger.warn('OpenAI meeting notes failed, using extraction', err);
      }
    }

    return this.extractMeetingNotesFallback(notes);
  }

  private async callOpenAI(profile: any, skills: string[], role: string): Promise<ProfileSuggestions> {
    const prompt = `You are a professional profile coach for a startup networking platform.

User Profile:
- Role: ${role}
- Display Name: ${profile.displayName ?? 'Not set'}
- Headline: ${profile.headline ?? 'Not set'}
- Bio: ${profile.bio ?? 'Not set'}
- Location: ${profile.location ?? 'Not set'}
- Skills: ${skills.length > 0 ? skills.join(', ') : 'None added'}
- Availability: ${profile.availability ?? 'Not set'}

Respond with a JSON object with exactly these fields:
{
  "headline": "improved headline string or null if already great",
  "bio": "improved bio string or null if already great",
  "missingElements": ["list of missing profile elements"],
  "improvements": ["list of specific improvement suggestions"],
  "completionScore": <number 0-100>
}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
  }

  private async callOpenAIForMeetingNotes(notes: string): Promise<MeetingNotesSummary> {
    const prompt = `Summarize these meeting notes concisely. Respond with JSON:
{
  "summary": "2-3 sentence summary",
  "actionItems": ["concrete action items"],
  "keyTakeaways": ["main insights"],
  "followUps": ["follow-up items"]
}

Notes:
${notes.slice(0, 3000)}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.5,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content);
  }

  private buildFallbackSuggestions(profile: any, skills: string[] = [], role = 'founder'): ProfileSuggestions {
    const missing: string[] = [];
    const improvements: string[] = [];
    let score = 20;

    if (!profile) {
      return {
        headline: `${role.charAt(0).toUpperCase() + role.slice(1)} at CoFounderBay`,
        bio: `I am a ${role} looking to connect with the right people to build something great.`,
        missingElements: ['Display name', 'Headline', 'Bio', 'Location', 'Skills', 'Avatar'],
        improvements: ['Complete all profile sections to get discovered', 'Add your top 5 skills', 'Write a compelling bio'],
        completionScore: 10,
      };
    }

    if (!profile.avatarUrl) { missing.push('Profile photo'); } else { score += 15; }
    if (!profile.headline || profile.headline.length < 10) {
      missing.push('Professional headline');
      improvements.push('Add a headline that describes your role and focus area (e.g. "Founder @ HealthTech startup | former product lead")');
    } else { score += 20; }

    if (!profile.bio || profile.bio.length < 50) {
      missing.push('Bio / About section');
      improvements.push('Write a bio of at least 100 words describing your background, goals, and what you\'re looking for');
    } else if (profile.bio.length < 150) {
      improvements.push('Expand your bio — profiles with 150+ word bios get 3x more connection requests');
      score += 10;
    } else { score += 20; }

    if (skills.length === 0) {
      missing.push('Skills');
      improvements.push('Add at least 5 skills to improve your match score by up to 40%');
    } else if (skills.length < 5) {
      improvements.push(`You have ${skills.length} skills. Add ${5 - skills.length} more to maximize matches`);
      score += 10;
    } else { score += 15; }

    if (!profile.location) { missing.push('Location'); improvements.push('Add your location to find local co-founders and investors'); } else { score += 5; }
    if (!profile.availability) { missing.push('Availability'); } else { score += 5; }

    const roleMap: Record<string, string> = {
      founder: `Founder building [your product] | Seeking [co-founder role] & investors | ${profile.location ?? 'Remote'}`,
      mentor: `${skills[0] ?? 'Tech'} Mentor | Helping founders scale | ${profile.location ?? 'Remote'}`,
      investor: `Angel Investor | ${profile.location ?? 'Remote'} | Interested in [focus area]`,
      org: `${profile.displayName ?? 'Organization'} | Connecting founders with resources`,
    };

    return {
      headline: !profile.headline || profile.headline.length < 10 ? (roleMap[role] ?? roleMap.founder) : null,
      bio: !profile.bio || profile.bio.length < 50
        ? `I'm a ${role} with expertise in ${skills.slice(0, 3).join(', ') || 'my field'}. I'm looking to connect with the right people to ${role === 'founder' ? 'build my startup and find co-founders or investors' : role === 'mentor' ? 'mentor early-stage founders' : role === 'investor' ? 'discover promising startups to back' : 'support the startup ecosystem'}.`
        : null,
      missingElements: missing,
      improvements,
      completionScore: Math.min(100, score),
    };
  }

  private extractMeetingNotesFallback(notes: string): MeetingNotesSummary {
    const lines = notes.split('\n').map((l) => l.trim()).filter(Boolean);
    const actionItems = lines.filter((l) => /^(action|todo|task|follow.?up|ai:|to do):/i.test(l) || /^\[x?\]/.test(l));
    const summary = lines.slice(0, 3).join(' ').slice(0, 300);
    return {
      summary: summary || notes.slice(0, 200),
      actionItems: actionItems.slice(0, 5),
      keyTakeaways: lines.slice(0, 3),
      followUps: [],
    };
  }
}
