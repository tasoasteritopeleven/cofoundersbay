import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const SKILLS = [
  { name: 'Product Management', slug: 'product-management', category: 'business' },
  { name: 'Software Engineering', slug: 'software-engineering', category: 'technical' },
  { name: 'Design (UI/UX)', slug: 'design-ui-ux', category: 'design' },
  { name: 'Marketing', slug: 'marketing', category: 'business' },
  { name: 'Sales', slug: 'sales', category: 'business' },
  { name: 'Finance', slug: 'finance', category: 'business' },
  { name: 'Legal', slug: 'legal', category: 'business' },
  { name: 'Data Science', slug: 'data-science', category: 'technical' },
  { name: 'DevOps', slug: 'devops', category: 'technical' },
  { name: 'Mobile Development', slug: 'mobile-development', category: 'technical' },
  { name: 'Frontend Development', slug: 'frontend-development', category: 'technical' },
  { name: 'Backend Development', slug: 'backend-development', category: 'technical' },
  { name: 'Fundraising', slug: 'fundraising', category: 'business' },
  { name: 'Strategy', slug: 'strategy', category: 'business' },
  { name: 'Operations', slug: 'operations', category: 'business' },
];

const DEMO_USERS = [
  { email: 'founder@demo.com', role: 'founder' as const, displayName: 'Alex Founder', headline: 'Building the future of fintech', bio: 'Serial entrepreneur with 2 exits. Currently building a revolutionary payment platform.' },
  { email: 'mentor@demo.com', role: 'mentor' as const, displayName: 'Sarah Mentor', headline: 'Startup Advisor & Angel Investor', bio: '15+ years in tech. Helped 50+ startups scale from seed to Series B.' },
  { email: 'investor@demo.com', role: 'investor' as const, displayName: 'Michael Investor', headline: 'Partner at Venture Capital Fund', bio: 'Investing in early-stage B2B SaaS. Previously founded and sold two companies.' },
  { email: 'org@demo.com', role: 'org' as const, displayName: 'TechHub Accelerator', headline: 'Leading Startup Accelerator', bio: 'We help founders build, launch, and scale their startups. 200+ alumni, $500M+ raised.', tagline: 'Accelerating Tomorrow\'s Unicorns', website: 'https://techhub.accelerator', mission: 'To identify and empower the next generation of world-changing founders through intensive mentorship, resources, and community support.', industry: 'Startup Accelerator, Venture Capital', focus: 'B2B SaaS, FinTech, HealthTech, EdTech', size: '11-50 employees' },
  { email: 'admin@demo.com', role: 'admin' as const, displayName: 'Platform Admin', headline: 'CoFounderBay Team', bio: 'Platform administrator and support.' },
];

const DEMO_OPPORTUNITIES = [
  { title: 'Technical Co-Founder for AI Startup', type: 'cofounder' as const, company: 'StealthAI', location: 'San Francisco, CA', isRemote: true, description: 'Looking for a technical co-founder to build an AI-powered analytics platform. Equity: 20-30%.', tags: ['AI', 'Machine Learning', 'Python'] },
  { title: 'Senior Full-Stack Developer', type: 'job' as const, company: 'GrowthTech', location: 'New York, NY', isRemote: true, description: 'Join our Series A startup building the next-gen marketing platform.', tags: ['React', 'Node.js', 'TypeScript'] },
  { title: 'Seed Investment - HealthTech', type: 'investment' as const, company: 'MedFlow', location: 'Boston, MA', isRemote: false, description: 'Raising $1.5M seed round for our healthcare automation platform. 10x MRR growth.', tags: ['HealthTech', 'SaaS', 'B2B'] },
  { title: 'Strategic Partnership - EdTech', type: 'partnership' as const, company: 'LearnHub', location: 'Remote', isRemote: true, description: 'Seeking partnerships with coding bootcamps and universities for our learning platform.', tags: ['EdTech', 'Partnership', 'B2B'] },
  { title: 'Mentor for First-Time Founders', type: 'mentorship' as const, company: null, location: 'Remote', isRemote: true, description: 'Experienced founder offering mentorship to first-time founders. Focus on product-market fit and fundraising.', tags: ['Mentorship', 'Fundraising', 'Product'] },
];

const DEMO_LEARNING_RESOURCES = [
  { title: 'How to Find Product-Market Fit', type: 'article' as const, category: 'product', url: 'https://example.com/pmf', author: 'Marc Andreessen', difficulty: 'intermediate' as const, tags: ['Product', 'Strategy'], description: 'The definitive guide to finding product-market fit for your startup.' },
  { title: 'Fundraising Masterclass', type: 'video' as const, category: 'fundraising', url: 'https://example.com/fundraising', author: 'Y Combinator', duration: 120, difficulty: 'beginner' as const, tags: ['Fundraising', 'Pitch'], description: 'Learn how to raise your seed round from YC partners.' },
  { title: 'Startup Legal Essentials', type: 'course' as const, category: 'legal', url: 'https://example.com/legal', author: 'Startup Law School', duration: 300, difficulty: 'beginner' as const, tags: ['Legal', 'Incorporation'], description: 'Everything you need to know about startup legal structure.' },
  { title: 'The Lean Startup', type: 'book' as const, category: 'product', url: 'https://example.com/lean-startup', author: 'Eric Ries', difficulty: 'beginner' as const, tags: ['Lean', 'MVP', 'Product'], description: 'The classic guide to building startups using lean methodology.' },
  { title: 'How I Built This', type: 'podcast' as const, category: 'inspiration', url: 'https://example.com/hibt', author: 'Guy Raz', duration: 45, difficulty: 'beginner' as const, tags: ['Inspiration', 'Stories'], description: 'Stories behind the people who created some of the world\'s best known companies.' },
  { title: 'Pitch Deck Template', type: 'template' as const, category: 'fundraising', url: 'https://example.com/pitch-template', author: 'Sequoia Capital', difficulty: 'beginner' as const, tags: ['Pitch', 'Template', 'Fundraising'], description: 'The Sequoia pitch deck template used by successful startups.' },
  { title: 'Financial Model Tool', type: 'tool' as const, category: 'finance', url: 'https://example.com/financial-model', author: 'Standard Metrics', difficulty: 'intermediate' as const, tags: ['Finance', 'Modeling', 'SaaS'], description: 'Build your startup financial model with this interactive tool.' },
];

const DEMO_MARKETPLACE_SERVICES = [
  { title: 'Startup Legal Package', category: 'legal' as const, providerName: 'Startup Law Firm', pricing: '$2,500', description: 'Complete legal package for incorporation, SAFE notes, and founder agreements.', tags: ['Incorporation', 'SAFE', 'Legal'] },
  { title: 'Fractional CFO Services', category: 'finance' as const, providerName: 'FinancePartners', pricing: '$3,000/mo', description: 'Part-time CFO services for startups. Financial modeling, fundraising support, and board reporting.', tags: ['CFO', 'Finance', 'Fundraising'] },
  { title: 'Growth Marketing Agency', category: 'marketing' as const, providerName: 'GrowthHackers Inc', pricing: 'Custom', description: 'Full-service growth marketing for B2B SaaS startups. SEO, paid ads, and content marketing.', tags: ['Marketing', 'Growth', 'SEO'] },
  { title: 'MVP Development', category: 'development' as const, providerName: 'BuildFast Studio', pricing: '$15,000+', description: 'We build MVPs in 4-6 weeks. React, Node.js, and mobile apps.', tags: ['MVP', 'Development', 'React'] },
  { title: 'Brand & UI Design', category: 'design' as const, providerName: 'DesignCraft', pricing: '$5,000+', description: 'Complete brand identity and UI/UX design for startups.', tags: ['Design', 'Branding', 'UI/UX'] },
];

async function main() {
  // Seed skills
  for (const s of SKILLS) {
    await prisma.skill.upsert({
      where: { slug: s.slug },
      create: s,
      update: { name: s.name, category: s.category },
    });
  }
  console.log(`Seeded ${SKILLS.length} skills`);

  // Seed demo users
  const passwordHash = await bcrypt.hash('demo123', 10);
  const createdUsers: { id: string; role: string }[] = [];

  for (const u of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      const user = await prisma.user.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          email: u.email,
          slug: u.email.split('@')[0].replace(/[^a-z0-9]/g, '-'),
          passwordHash,
          role: u.role,
          emailVerified: true,
          hasCompletedOnboarding: true,
          profile: {
            create: {
              displayName: u.displayName,
              headline: u.headline,
              bio: u.bio,
              ...(u.role === 'org' && {
                tagline: u.tagline,
                website: u.website,
                mission: u.mission,
                industry: u.industry,
                focus: u.focus,
                size: u.size,
              }),
            },
          },
        } as any,
      });
      createdUsers.push({ id: user.id, role: user.role });
      console.log(`Created demo user: ${u.email}`);
    } else {
      createdUsers.push({ id: existing.id, role: existing.role });
    }
  }

  // Get a founder user for creating content
  const founderUser = createdUsers.find(u => u.role === 'founder') || createdUsers[0];
  if (!founderUser) {
    console.log('No users found, skipping content seeding');
    return;
  }

  // Seed opportunities
  const existingOpportunities = await prisma.opportunity.count();
  if (existingOpportunities === 0) {
    for (const o of DEMO_OPPORTUNITIES) {
      await prisma.opportunity.create({
        data: {
          title: o.title,
          type: o.type,
          company: o.company,
          location: o.location,
          isRemote: o.isRemote,
          description: o.description,
          tags: o.tags,
          createdById: founderUser.id,
        },
      });
    }
    console.log(`Seeded ${DEMO_OPPORTUNITIES.length} opportunities`);
  }

  // Seed learning resources
  const existingResources = await prisma.learningResource.count();
  if (existingResources === 0) {
    for (const r of DEMO_LEARNING_RESOURCES) {
      await prisma.learningResource.create({
        data: {
          title: r.title,
          type: r.type,
          category: r.category,
          url: r.url,
          author: r.author,
          duration: r.duration,
          difficulty: r.difficulty,
          tags: r.tags,
          description: r.description,
          createdById: founderUser.id,
        },
      });
    }
    console.log(`Seeded ${DEMO_LEARNING_RESOURCES.length} learning resources`);
  }

  // Seed marketplace services
  const existingServices = await prisma.marketplaceService.count();
  if (existingServices === 0) {
    for (const s of DEMO_MARKETPLACE_SERVICES) {
      await prisma.marketplaceService.create({
        data: {
          title: s.title,
          category: s.category,
          providerName: s.providerName,
          pricing: s.pricing,
          description: s.description,
          tags: s.tags,
          createdById: founderUser.id,
        },
      });
    }
    console.log(`Seeded ${DEMO_MARKETPLACE_SERVICES.length} marketplace services`);
  }

  // Seed sample poll
  const existingPoll = await prisma.poll.findFirst();
  if (!existingPoll) {
    const poll = await prisma.poll.create({
      data: {
        creatorId: founderUser.id,
        question: 'What topic should we cover in the next community call?',
        isActive: true,
        options: {
          create: [
            { label: 'Fundraising & term sheets', sortOrder: 0 },
            { label: 'Product-market fit', sortOrder: 1 },
            { label: 'Hiring first team', sortOrder: 2 },
          ],
        },
      },
    });
    console.log(`Seeded sample poll: ${poll.id}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
