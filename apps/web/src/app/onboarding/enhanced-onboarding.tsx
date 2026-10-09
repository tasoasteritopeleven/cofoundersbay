'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { takeReturnTo } from '@/lib/return-to';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Circle,
  Sparkles,
  Target,
  Users,
  Lightbulb,
  Rocket,
  Shield,
  Star,
  Zap,
  Globe,
  Briefcase,
  GraduationCap,
  Building2,
  Heart,
  Coffee,
  MapPin,
  Search,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { createProfile, uploadAvatar, listSkills,
  type Skill,
} from '@/lib/api';
import { analytics } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';

import { pressableProps } from '@/lib/pressable';
import { FactLine } from '@/components/common/FactLine';
const STEPS = [
  { id: 'welcome', title: 'Welcome to CoFounderBay', icon: Sparkles },
  { id: 'role', title: 'What\'s your role?', icon: Target },
  { id: 'profile', title: 'Build your profile', icon: Users },
  { id: 'skills', title: 'Your expertise', icon: Lightbulb },
  { id: 'values', title: 'Values & Work Style', icon: Heart },
  { id: 'match-prefs', title: 'Match Preferences', icon: Search },
  { id: 'preferences', title: 'Preferences', icon: Globe },
  { id: 'review', title: 'Review & Launch', icon: Rocket },
];

const ROLE_DESCRIPTIONS = {
  founder: {
    title: 'Founder',
    description: 'Building the next big thing',
    icon: Rocket,
    color: 'bg-primary',
    questions: [
      'What stage is your startup at?',
      'What are you looking for in a co-founder?',
      'What\'s your industry focus?',
    ],
  },
  mentor: {
    title: 'Mentor',
    description: 'Guiding the next generation',
    icon: GraduationCap,
    color: 'bg-status-success-mark',
    questions: [
      'What areas do you specialize in?',
      'What\'s your mentoring style?',
      'How much time can you commit?',
    ],
  },
  investor: {
    title: 'Investor',
    description: 'Fueling innovation and growth',
    icon: Briefcase,
    color: 'bg-status-accent-mark',
    questions: [
      'What\'s your investment focus?',
      'What stages do you invest in?',
      'What\'s your typical check size?',
    ],
  },
  org: {
    title: 'Organization',
    description: 'Supporting the ecosystem',
    icon: Building2,
    color: 'bg-status-warning-mark',
    questions: [
      'What type of organization are you?',
      'What programs do you offer?',
      'How can you help founders?',
    ],
  },
};

const SKILL_CATEGORIES = [
  'Technical',
  'Business',
  'Design',
  'Marketing',
  'Sales',
  'Finance',
  'Operations',
  'Legal',
  'Product',
  'Data',
];

const INDUSTRIES = [
  'SaaS',
  'E-commerce',
  'FinTech',
  'HealthTech',
  'EdTech',
  'CleanTech',
  'AI/ML',
  'Blockchain',
  'Gaming',
  'Social',
  'Mobile',
  'IoT',
  'Other',
];

const STAGES = ['Idea', 'MVP', 'Traction', 'Scaling', 'Established'];

const WORK_STYLES = [
  { id: 'async-first', label: 'Async-first', icon: '📬' },
  { id: 'real-time', label: 'Real-time collab', icon: '⚡' },
  { id: 'morning-person', label: 'Morning person', icon: '🌅' },
  { id: 'night-owl', label: 'Night owl', icon: '🦉' },
  { id: 'deep-work', label: 'Deep work blocks', icon: '🎯' },
  { id: 'flexible', label: 'Flexible hours', icon: '🔄' },
  { id: 'structured', label: 'Structured schedule', icon: '📅' },
  { id: 'remote-only', label: 'Remote only', icon: '🌍' },
  { id: 'in-person', label: 'In-person preferred', icon: '🤝' },
];

const CORE_VALUES = [
  'Mission-driven',
  'Fast iteration',
  'Quality over speed',
  'Work-life balance',
  'Ambitious growth',
  'Customer obsession',
  'Radical transparency',
  'Diversity & inclusion',
  'Sustainability',
  'Technical excellence',
  'Ownership mindset',
  'Frugality',
];

const AVAILABILITY_OPTIONS = [
  { value: 'full-time', label: 'Full-time (40h/week)' },
  { value: 'part-time', label: 'Part-time (20h/week)' },
  { value: 'few-hours', label: 'A few hours/week' },
  { value: 'flexible', label: 'Flexible / project-based' },
];

const LOOKING_FOR_ROLES = [
  'Technical Co-founder',
  'Business Co-founder',
  'CTO',
  'CPO',
  'CMO',
  'Lead Engineer',
  'Designer',
  'Advisor',
  'Mentor',
  'Investor',
  'Service Provider',
  'Community Member',
];

interface OnboardingData {
  role: string;
  displayName: string;
  headline: string;
  bio: string;
  location: string;
  timezone: string;
  languages: string[];
  avatarUrl?: string;
  skills: string[];
  rolePayload: Record<string, any>;
  preferences: {
    remote: boolean;
    locationPreference: string;
    commitment: string;
    notificationFrequency: string;
  };
  values: {
    workStyle: string[];
    coreValues: string[];
    availability: string;
  };
  matchPrefs: {
    lookingFor: string[];
    industries: string[];
    stages: string[];
  };
}

export default function EnhancedOnboardingPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    role: '',
    displayName: '',
    headline: '',
    bio: '',
    location: '',
    timezone: '',
    languages: [],
    skills: [],
    rolePayload: {},
    preferences: {
      remote: false,
      locationPreference: '',
      commitment: '',
      notificationFrequency: 'daily',
    },
    values: {
      workStyle: [],
      coreValues: [],
      availability: '',
    },
    matchPrefs: {
      lookingFor: [],
      industries: [],
      stages: [],
    },
  });
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const { data: skillsData } = useQuery({
    queryKey: qk('skills'),
    queryFn: () => listSkills(),
  });

  const createProfileMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      success('Profile created successfully!', 'Welcome to CoFounderBay');
      router.push(takeReturnTo('/dashboard'));
    },
    onError: (err: Error) => {
      showError('Failed to create profile', err.message || 'Please try again');
    },
  });

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      const stepId = STEPS[currentStep].id;
      void analytics.track('onboarding_step_completed', {
        step: stepId,
        step_index: currentStep,
      });
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleRoleSelect = (role: string) => {
    setData(prev => ({ ...prev, role }));
    void analytics.track('onboarding_started', { role });
    handleNext();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSkillToggle = (skillId: string) => {
    setData(prev => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter(id => id !== skillId)
        : [...prev.skills, skillId],
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let avatarUrl = data.avatarUrl;
      
      if (avatarFile) {
        const uploadResult = await uploadAvatar(avatarFile);
        avatarUrl = uploadResult.upload.url;
      }

      await createProfileMutation.mutateAsync({
        displayName: data.displayName,
        headline: data.headline,
        bio: data.bio,
        location: data.location,
        timezone: data.timezone,
        languages: data.languages,
        avatarUrl,
        rolePayload: {
          ...data.rolePayload,
          workStyle: data.values.workStyle,
          coreValues: data.values.coreValues,
          availability: data.values.availability,
          lookingFor: data.matchPrefs.lookingFor,
          industries: data.matchPrefs.industries,
          stages: data.matchPrefs.stages,
          remote: data.preferences.remote,
          commitment: data.preferences.commitment,
        },
        skillIds: data.skills,
      });
      
      // Analytics
      void analytics.track('onboarding_completed', {
        role: data.role,
        skills_count: data.skills.length,
      });
    } finally {
      setLoading(false);
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return <WelcomeStep onNext={handleNext} />;
      case 'role':
        return <RoleStep selectedRole={data.role} onSelect={handleRoleSelect} />;
      case 'profile':
        return (
          <ProfileStep
            data={data}
            setData={setData}
            avatarPreview={avatarPreview}
            onAvatarChange={handleAvatarChange}
          />
        );
      case 'skills':
        return (
          <SkillsStep
            selectedSkills={data.skills}
            onSkillToggle={handleSkillToggle}
            skillsData={skillsData}
          />
        );
      case 'values':
        return <ValuesStep data={data} setData={setData} />;
      case 'match-prefs':
        return <MatchPrefsStep data={data} setData={setData} />;
      case 'preferences':
        return <PreferencesStep data={data} setData={setData} />;
      case 'review':
        return (
          <ReviewStep
            data={data}
            onSubmit={handleSubmit}
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="icon-lg text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl xl:text-3xl font-semibold"><BilingualText en="CoFounderBay Onboarding" el="Ένταξη στο CoFounderBay" compact /></h1>
                <p className="text-muted-foreground"><BilingualText en="Let's build your profile together" el="Ας φτιάξουμε μαζί το προφίλ σας" wrap /></p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              {currentStep + 1} of {STEPS.length}
            </Badge>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          <div className="flex justify-between mt-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                    index <= currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {index < currentStep ? (
                    <CheckCircle className="icon-sm" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2',
                      index < currentStep ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-8 max-w-2xl mx-auto">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="gap-2"
          >
            <ArrowLeft className="icon-sm" />
            <BilingualText en="Previous" el="Προηγούμενο" compact />
          </Button>
          
          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              className="gap-2"
              disabled={
                (STEPS[currentStep].id === 'role' && !data.role) ||
                (STEPS[currentStep].id === 'profile' && (!data.displayName || !data.bio)) ||
                (STEPS[currentStep].id === 'values' && (data.values.workStyle.length === 0 || !data.values.availability))
              }
            >
              <BilingualText en="Next" el="Επόμενο" compact />
              <ArrowRight className="icon-sm" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || !data.displayName || !data.bio}
              className="gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <BilingualText en="Creating Profile..." el="Δημιουργία προφίλ…" compact />
                </>
              ) : (
                <>
                  <Rocket className="icon-sm" />
                  <BilingualText en="Launch Profile" el="Δημοσίευση προφίλ" compact />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-3 text-2xl">
          <Sparkles className="icon-xl text-primary-accessible" />
          <BilingualText en="Welcome to CoFounderBay" el="Καλώς ήρθατε στο CoFounderBay" compact />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-lg text-muted-foreground">
          <BilingualText en="The premier platform connecting founders, mentors, and investors" el="Η πλατφόρμα που συνδέει ιδρυτές, μέντορες και επενδυτές" wrap />
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-status-info-bg">
            <Users className="icon-xl text-status-info mb-2 mx-auto" />
            <h3 className="font-semibold mb-1"><BilingualText en="Smart Matching" el="Έξυπνες αντιστοιχίσεις" compact /></h3>
            <p className="text-sm text-muted-foreground">
              <BilingualText en="AI-powered connections based on skills and goals" el="Συνδέσεις με AI βάσει δεξιοτήτων και στόχων" wrap />
            </p>
          </div>
          <div className="p-4 rounded-lg bg-status-success-bg dark:bg-status-success-mark">
            <Shield className="icon-xl text-status-success mb-2 mx-auto" />
            <h3 className="font-semibold mb-1"><BilingualText en="Verified Profiles" el="Επαληθευμένα προφίλ" compact /></h3>
            <p className="text-sm text-muted-foreground">
              <BilingualText en="Trust and quality through verification system" el="Εμπιστοσύνη και ποιότητα μέσω επαλήθευσης" wrap />
            </p>
          </div>
          <div className="p-4 rounded-lg bg-status-accent-bg dark:bg-status-accent-mark">
            <Zap className="icon-xl text-status-accent mb-2 mx-auto" />
            <h3 className="font-semibold mb-1"><BilingualText en="Real-time Chat" el="Συνομιλία σε πραγματικό χρόνο" compact /></h3>
            <p className="text-sm text-muted-foreground">
              <BilingualText en="Instant communication with potential partners" el="Άμεση επικοινωνία με πιθανούς συνεργάτες" wrap />
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">What you'll get:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
            <div className="flex items-center gap-2">
              <CheckCircle className="icon-sm text-status-success" />
              <span className="text-sm"><BilingualText en="Personalized match recommendations" el="Εξατομικευμένες προτάσεις αντιστοιχίσεων" wrap /></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="icon-sm text-status-success" />
              <span className="text-sm"><BilingualText en="Access to exclusive events" el="Πρόσβαση σε αποκλειστικές εκδηλώσεις" compact /></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="icon-sm text-status-success" />
              <span className="text-sm"><BilingualText en="Mentorship opportunities" el="Ευκαιρίες καθοδήγησης" compact /></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="icon-sm text-status-success" />
              <span className="text-sm"><BilingualText en="Investor connections" el="Επαφές με επενδυτές" compact /></span>
            </div>
          </div>
        </div>

        <Button onClick={onNext} size="lg" className="w-full gap-2">
          <BilingualText en="Let's Get Started" el="Ας ξεκινήσουμε" compact />
          <ArrowRight className="icon-sm" />
        </Button>
      </CardContent>
    </Card>
  );
}

function RoleStep({ selectedRole, onSelect }: { selectedRole: string; onSelect: (role: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle><BilingualText en="What's your role in the startup ecosystem?" el="Ποιος είναι ο ρόλος σας στο οικοσύστημα;" wrap /></CardTitle>
        <p className="text-muted-foreground">
          <BilingualText en="Select the role that best describes you" el="Επιλέξτε τον ρόλο που σας περιγράφει καλύτερα" wrap />
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(ROLE_DESCRIPTIONS).map(([key, role]) => {
            const Icon = role.icon;
            return (
              <div
                key={key}
                onClick={() => onSelect(key)}
                {...pressableProps({ pressed: selectedRole === key })}
                className={cn(
                  'p-6 rounded-lg border-2 cursor-pointer transition-colors hover:border-primary/30',
                  selectedRole === key
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn('p-3 rounded-lg', role.color)}>
                    <Icon className="icon-lg text-ink" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{role.title}</h3>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileStep({
  data,
  setData,
  avatarPreview,
  onAvatarChange,
}: {
  data: OnboardingData;
  setData: (data: OnboardingData) => void;
  avatarPreview: string;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle><BilingualText en="Build your profile" el="Φτιάξτε το προφίλ σας" compact /></CardTitle>
        <p className="text-muted-foreground">
          <BilingualText en="Tell us about yourself" el="Πείτε μας για εσάς" compact />
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarPreview} />
              <AvatarFallback>
                {data.displayName ? data.displayName[0].toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 p-1 bg-primary rounded-full cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={onAvatarChange}
                className="hidden"
              />
              <div className="p-1 bg-white rounded-full">
                <div className="w-4 h-4 bg-primary rounded-full" />
              </div>
            </label>
          </div>
          <div>
            <h3 className="font-semibold"><BilingualText en="Profile Photo" el="Φωτογραφία προφίλ" compact /></h3>
            <p className="text-sm text-muted-foreground">
              <BilingualText en="Add a photo to build trust" el="Προσθέστε φωτογραφία για να χτίσετε εμπιστοσύνη" compact />
            </p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label htmlFor="ob-f1" className="block text-sm font-medium mb-2">Display Name *</label>
            <Input id="ob-f1"
              value={data.displayName}
              onChange={(e) => setData({ ...data, displayName: e.target.value })}
              placeholder="John Doe"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="ob-f2" className="block text-sm font-medium mb-2"><BilingualText en="Headline" el="Τίτλος" compact /></label>
            <Input id="ob-f2"
              value={data.headline}
              onChange={(e) => setData({ ...data, headline: e.target.value })}
              placeholder="Founder at Tech Startup"
              maxLength={300}
            />
          </div>

          <div>
            <label htmlFor="ob-f3" className="block text-sm font-medium mb-2">Bio *</label>
            <Textarea id="ob-f3"
              value={data.bio}
              onChange={(e) => setData({ ...data, bio: e.target.value })}
              placeholder={bilingualInline("Tell us about your background, experience, and what you're looking for…", "Πείτε μας για το υπόβαθρο, την εμπειρία σας και τι αναζητάτε…")}
              rows={4}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {data.bio.length}/5000 characters
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ob-f4" className="block text-sm font-medium mb-2"><BilingualText en="Location" el="Τοποθεσία" compact /></label>
              <Input id="ob-f4"
                value={data.location}
                onChange={(e) => setData({ ...data, location: e.target.value })}
                placeholder="San Francisco, CA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="ob-timezone"><BilingualText en="Timezone" el="Ζώνη ώρας" compact /></label>
              <Select value={data.timezone} onValueChange={(value) => setData({ ...data, timezone: value })}>
                <SelectTrigger id="ob-timezone">
                  <SelectValue placeholder={bilingualInline("Select timezone", "Επιλογή ζώνης ώρας")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York"><BilingualText en="Eastern Time" el="Ώρα ανατολικών ΗΠΑ" compact /></SelectItem>
                  <SelectItem value="America/Chicago"><BilingualText en="Central Time" el="Ώρα κεντρικών ΗΠΑ" compact /></SelectItem>
                  <SelectItem value="America/Denver"><BilingualText en="Mountain Time" el="Ώρα ορεινών ΗΠΑ" compact /></SelectItem>
                  <SelectItem value="America/Los_Angeles"><BilingualText en="Pacific Time" el="Ώρα Ειρηνικού" compact /></SelectItem>
                  <SelectItem value="Europe/London"><BilingualText en="London" el="Λονδίνο" compact /></SelectItem>
                  <SelectItem value="Europe/Paris"><BilingualText en="Paris" el="Παρίσι" compact /></SelectItem>
                  <SelectItem value="Asia/Tokyo"><BilingualText en="Tokyo" el="Τόκιο" compact /></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkillsStep({
  selectedSkills,
  onSkillToggle,
  skillsData,
}: {
  selectedSkills: string[];
  onSkillToggle: (skillId: string) => void;
  skillsData?: Skill[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredSkills = skillsData?.filter((skill: any) => {
    const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle><BilingualText en="Your expertise" el="Η εξειδίκευσή σας" compact /></CardTitle>
        <p className="text-muted-foreground">
          <BilingualText en="Select your skills and expertise areas" el="Επιλέξτε δεξιότητες και πεδία εξειδίκευσης" wrap />
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search and Filter */}
        <div className="space-y-4">
          <Input
            placeholder={bilingualInline("Search skills…", "Αναζήτηση δεξιοτήτων…")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-3 py-1 rounded-full text-sm',
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              )}
            >
              <BilingualText en="All" el="Όλα" compact />
            </button>
            {SKILL_CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'px-3 py-1 rounded-full text-sm',
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Skills */}
        {selectedSkills.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Selected Skills ({selectedSkills.length})</h3>
            <div className="flex flex-wrap gap-2">
              {selectedSkills.map(skillId => {
                const skill = skillsData?.find((s: any) => s.id === skillId);
                return (
                  <button
                    key={skillId}
                    type="button"
                    aria-label={bilingualInline(`Remove ${skill?.name ?? 'skill'}`, `Αφαίρεση ${skill?.name ?? 'δεξιότητας'}`)}
                    className={cn(badgeVariants({ variant: 'secondary' }), 'border-0 shadow-none !shadow-none gap-1 cursor-pointer')}
                    onClick={() => onSkillToggle(skillId)}
                  >
                    {skill?.name}
                    <span className="ml-1 text-xs" aria-hidden="true">×</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Skills */}
        <div>
          <h3 className="font-semibold mb-2"><BilingualText en="Available Skills" el="Διαθέσιμες δεξιότητες" compact /></h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {filteredSkills.map((skill: any) => (
              <button
                key={skill.id}
                onClick={() => onSkillToggle(skill.id)}
                className={cn(
                  'p-2 text-left rounded border transition-colors',
                  selectedSkills.includes(skill.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <div className="font-medium text-sm">{skill.name}</div>
                <div className="text-xs text-muted-foreground">{skill.category}</div>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PreferencesStep({ data, setData }: { data: OnboardingData; setData: (data: OnboardingData) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle><BilingualText en="Preferences" el="Προτιμήσεις" compact /></CardTitle>
        <p className="text-muted-foreground">
          <BilingualText en="Set your collaboration preferences" el="Ορίστε τις προτιμήσεις συνεργασίας" wrap />
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Remote Work */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold"><BilingualText en="Open to Remote Work" el="Ανοιχτός/ή σε εξ αποστάσεως" compact /></h3>
            <p className="text-sm text-muted-foreground">
              <BilingualText en="Work with people from anywhere" el="Συνεργασία με ανθρώπους από παντού" compact />
            </p>
          </div>
          <Checkbox
            checked={data.preferences.remote}
            onCheckedChange={(checked: boolean | 'indeterminate') =>
              setData({
                ...data,
                preferences: { ...data.preferences, remote: checked as boolean },
              })
            }
          />
        </div>

        {/* Commitment Level */}
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="ob-commitment"><BilingualText en="Commitment Level" el="Επίπεδο δέσμευσης" compact /></label>
          <Select
            value={data.preferences.commitment}
            onValueChange={(value) =>
              setData({
                ...data,
                preferences: { ...data.preferences, commitment: value },
              })
            }
          >
            <SelectTrigger id="ob-commitment">
              <SelectValue placeholder={bilingualInline("Select commitment level", "Επιλογή βαθμού δέσμευσης")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="part-time"><BilingualText en="Part-time" el="Μερική απασχόληση" compact /></SelectItem>
              <SelectItem value="full-time"><BilingualText en="Full-time" el="Πλήρης απασχόληση" compact /></SelectItem>
              <SelectItem value="flexible"><BilingualText en="Flexible" el="Ευέλικτο" compact /></SelectItem>
              <SelectItem value="advisor"><BilingualText en="Advisor only" el="Μόνο σύμβουλος" compact /></SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notification Frequency */}
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="ob-notiffreq"><BilingualText en="Notification Frequency" el="Συχνότητα ειδοποιήσεων" compact /></label>
          <Select
            value={data.preferences.notificationFrequency}
            onValueChange={(value) =>
              setData({
                ...data,
                preferences: { ...data.preferences, notificationFrequency: value },
              })
            }
          >
            <SelectTrigger id="ob-notiffreq">
              <SelectValue placeholder={bilingualInline("Select notification frequency", "Επιλογή συχνότητας ειδοποιήσεων")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="real-time"><BilingualText en="Real-time" el="Σε πραγματικό χρόνο" compact /></SelectItem>
              <SelectItem value="daily"><BilingualText en="Daily digest" el="Ημερήσια σύνοψη" compact /></SelectItem>
              <SelectItem value="weekly"><BilingualText en="Weekly digest" el="Εβδομαδιαία σύνοψη" compact /></SelectItem>
              <SelectItem value="important"><BilingualText en="Important only" el="Μόνο τα σημαντικά" compact /></SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({
  data,
  onSubmit,
  loading,
}: {
  data: OnboardingData;
  onSubmit: () => void;
  loading: boolean;
}) {
  const selectedRole = ROLE_DESCRIPTIONS[data.role as keyof typeof ROLE_DESCRIPTIONS];
  const RoleIcon = selectedRole?.icon || Target;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="icon-lg text-status-warning" />
          <BilingualText en="Review & Launch" el="Έλεγχος & δημοσίευση" compact />
        </CardTitle>
        <p className="text-muted-foreground">
          <BilingualText en="Review your profile before going live" el="Ελέγξτε το προφίλ σας πριν δημοσιευτεί" wrap />
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Summary */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-lg', selectedRole?.color)}>
              <RoleIcon className="icon-lg text-ink" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{data.displayName}</h3>
              <p className="text-muted-foreground">{selectedRole?.title}</p>
            </div>
          </div>

          {data.headline && (
            <div>
              <h4 className="font-medium mb-1"><BilingualText en="Headline" el="Τίτλος" compact /></h4>
              <p className="text-sm text-muted-foreground">{data.headline}</p>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-1"><BilingualText en="Bio" el="Βιογραφικό" compact /></h4>
            <p className="text-sm text-muted-foreground">{data.bio}</p>
          </div>

          {(data.location || data.timezone) && (
            <div className="grid grid-cols-2 gap-4">
              {data.location && (
                <div>
                  <h4 className="font-medium mb-1"><BilingualText en="Location" el="Τοποθεσία" compact /></h4>
                  <p className="text-sm text-muted-foreground">{data.location}</p>
                </div>
              )}
              {data.timezone && (
                <div>
                  <h4 className="font-medium mb-1"><BilingualText en="Timezone" el="Ζώνη ώρας" compact /></h4>
                  <p className="text-sm text-muted-foreground">{data.timezone}</p>
                </div>
              )}
            </div>
          )}

          {data.skills.length > 0 && (
            <div>
              <h4 className="font-medium mb-1"><BilingualText en={`Skills (${data.skills.length})`} el={`Δεξιότητες (${data.skills.length})`} compact /></h4>
              <FactLine className="text-sm text-foreground" items={[...data.skills.slice(0, 10), data.skills.length > 10 ? `+${data.skills.length - 10}` : null]} />
            </div>
          )}
        </div>

        {/* Values & Work Style Summary */}
        {(data.values.workStyle.length > 0 || data.values.coreValues.length > 0) && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="font-medium"><BilingualText en="Values & Work Style" el="Αξίες & τρόπος δουλειάς" compact /></h4>
            {data.values.availability && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground"><BilingualText en="Availability" el="Διαθεσιμότητα" compact /></span>
                <span>{AVAILABILITY_OPTIONS.find(a => a.value === data.values.availability)?.label ?? data.values.availability}</span>
              </div>
            )}
            {data.values.workStyle.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1"><BilingualText en="Work style" el="Τρόπος δουλειάς" compact /></p>
                <FactLine className="text-sm text-foreground" items={data.values.workStyle.map(id => WORK_STYLES.find(w => w.id === id)?.label ?? id)} />
              </div>
            )}
            {data.values.coreValues.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1"><BilingualText en="Core values" el="Βασικές αξίες" compact /></p>
                <FactLine className="text-sm text-foreground" items={data.values.coreValues} />
              </div>
            )}
          </div>
        )}

        {/* Match Preferences Summary */}
        {(data.matchPrefs.lookingFor.length > 0 || data.matchPrefs.industries.length > 0 || data.matchPrefs.stages.length > 0) && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="font-medium"><BilingualText en="Match Preferences" el="Προτιμήσεις αντιστοίχισης" compact /></h4>
            {data.matchPrefs.lookingFor.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1"><BilingualText en="Looking for" el="Αναζητά" compact /></p>
                <FactLine className="text-sm text-foreground" items={data.matchPrefs.lookingFor} />
              </div>
            )}
            {data.matchPrefs.industries.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1"><BilingualText en="Industries" el="Κλάδοι" compact /></p>
                <FactLine className="text-sm text-foreground" items={data.matchPrefs.industries} />
              </div>
            )}
            {data.matchPrefs.stages.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1"><BilingualText en="Startup stages" el="Στάδια startup" compact /></p>
                <FactLine className="text-sm text-foreground" items={data.matchPrefs.stages} />
              </div>
            )}
          </div>
        )}

        {/* Preferences Summary */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2"><BilingualText en="Preferences" el="Προτιμήσεις" compact /></h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Remote work:</span>
              <span>{data.preferences.remote ? 'Open' : 'Not preferred'}</span>
            </div>
            <div className="flex justify-between">
              <span>Commitment:</span>
              <span>{data.preferences?.commitment || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span>Notifications:</span>
              <span>{data.preferences.notificationFrequency}</span>
            </div>
          </div>
        </div>

        {/* Launch Button */}
        <Button onClick={onSubmit} disabled={loading} size="lg" className="w-full gap-2">
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <BilingualText en="Creating Profile..." el="Δημιουργία προφίλ…" compact />
            </>
          ) : (
            <>
              <Rocket className="icon-sm" />
              <BilingualText en="Launch Profile" el="Δημοσίευση προφίλ" compact />
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          <BilingualText en="By launching your profile, you agree to our Terms of Service and Privacy Policy" el="Με τη δημοσίευση αποδέχεστε τους Όρους χρήσης και την Πολιτική απορρήτου" wrap />
        </p>
      </CardContent>
    </Card>
  );
}

function ValuesStep({ data, setData }: { data: OnboardingData; setData: (d: OnboardingData) => void }) {
  const toggleWorkStyle = (id: string) => {
    const updated = data.values.workStyle.includes(id)
      ? data.values.workStyle.filter(w => w !== id)
      : [...data.values.workStyle, id];
    setData({ ...data, values: { ...data.values, workStyle: updated } });
  };

  const toggleCoreValue = (val: string) => {
    const updated = data.values.coreValues.includes(val)
      ? data.values.coreValues.filter(v => v !== val)
      : [...data.values.coreValues, val];
    setData({ ...data, values: { ...data.values, coreValues: updated } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="icon-md text-status-danger" />
          <BilingualText en="Values & Work Style" el="Αξίες & τρόπος δουλειάς" compact />
        </CardTitle>
        <p className="text-muted-foreground"><BilingualText en="Help us find people who match your working rhythm and values" el="Βοηθήστε μας να βρούμε ανθρώπους με τον ρυθμό και τις αξίες σας" wrap /></p>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Availability */}
        <div>
          <p id="ob-availability" className="block text-sm font-medium mb-3"><BilingualText en="Availability" el="Διαθεσιμότητα" compact /> <span className="text-status-danger">*</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-labelledby="ob-availability">
            {AVAILABILITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={data.values.availability === opt.value}
                onClick={() => setData({ ...data, values: { ...data.values, availability: opt.value } })}
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-all',
                  data.values.availability === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Work Style */}
        <div>
          <p id="ob-workstyle" className="block text-sm font-medium mb-1"><BilingualText en="Work Style" el="Τρόπος δουλειάς" compact /> <span className="text-status-danger">*</span></p>
          <p className="text-xs text-muted-foreground mb-3"><BilingualText en="Select all that apply" el="Επιλέξτε όσα ισχύουν" compact /></p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-labelledby="ob-workstyle">
            {WORK_STYLES.map(ws => (
              <button
                key={ws.id}
                type="button"
                aria-pressed={data.values.workStyle.includes(ws.id)}
                onClick={() => toggleWorkStyle(ws.id)}
                className={cn(
                  'p-3 rounded-lg border-2 text-left flex items-center gap-2 transition-all',
                  data.values.workStyle.includes(ws.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <span className="text-lg">{ws.icon}</span>
                <span className="text-xs font-medium leading-tight">{ws.label}</span>
              </button>
            ))}
          </div>
          {data.values.workStyle.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">{data.values.workStyle.length} selected</p>
          )}
        </div>

        {/* Core Values */}
        <div>
          <p id="ob-corevalues" className="block text-sm font-medium mb-1"><BilingualText en="Core Values" el="Βασικές αξίες" compact /></p>
          <p className="text-xs text-muted-foreground mb-3"><BilingualText en="Choose up to 5 that resonate most with you" el="Επιλέξτε έως 5 που σας εκφράζουν" wrap /></p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ob-corevalues">
            {CORE_VALUES.map(val => {
              const selected = data.values.coreValues.includes(val);
              const maxReached = data.values.coreValues.length >= 5;
              return (
                <button
                  key={val}
                  type="button"
                aria-pressed={selected}
                  onClick={() => toggleCoreValue(val)}
                  disabled={!selected && maxReached}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border-2 transition-all',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : maxReached
                        ? 'border-border text-muted-foreground opacity-40 cursor-not-allowed'
                        : 'border-border hover:border-primary/40'
                  )}
                >
                  {val}
                </button>
              );
            })}
          </div>
          {data.values.coreValues.length >= 5 && (
            <p className="text-xs text-status-warning mt-2"><BilingualText en="Maximum 5 values selected" el="Επιλέχθηκαν οι 5 αξίες (μέγιστο)" compact /></p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MatchPrefsStep({ data, setData }: { data: OnboardingData; setData: (d: OnboardingData) => void }) {
  const toggle = (field: 'lookingFor' | 'industries' | 'stages', val: string) => {
    const current = data.matchPrefs[field];
    const updated = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    setData({ ...data, matchPrefs: { ...data.matchPrefs, [field]: updated } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="icon-md text-muted-foreground" />
          <BilingualText en="Match Preferences" el="Προτιμήσεις αντιστοίχισης" compact />
        </CardTitle>
        <p className="text-muted-foreground"><BilingualText en="Tell us what you're looking for so we can find your best matches" el="Πείτε μας τι ψάχνετε για να βρούμε τις καλύτερες αντιστοιχίσεις" wrap /></p>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Looking For */}
        <div>
          <p id="ob-lookingfor" className="block text-sm font-medium mb-1"><BilingualText en="Who are you looking for?" el="Ποιον ψάχνετε;" compact wrap /></p>
          <p className="text-xs text-muted-foreground mb-3"><BilingualText en="Select all that apply" el="Επιλέξτε όσα ισχύουν" compact /></p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ob-lookingfor">
            {LOOKING_FOR_ROLES.map(role => (
              <button
                key={role}
                type="button"
                aria-pressed={data.matchPrefs.lookingFor.includes(role)}
                onClick={() => toggle('lookingFor', role)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm border-2 transition-all',
                  data.matchPrefs.lookingFor.includes(role)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {role}
              </button>
            ))}
          </div>
          {data.matchPrefs.lookingFor.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">{data.matchPrefs.lookingFor.length} selected</p>
          )}
        </div>

        {/* Industries */}
        <div>
          <p id="ob-industries" className="block text-sm font-medium mb-1"><BilingualText en="Industry Focus" el="Κλάδοι ενδιαφέροντος" compact /></p>
          <p className="text-xs text-muted-foreground mb-3"><BilingualText en="Which industries interest you most?" el="Ποιοι κλάδοι σας ενδιαφέρουν περισσότερο;" wrap /></p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ob-industries">
            {INDUSTRIES.map(ind => (
              <button
                key={ind}
                type="button"
                aria-pressed={data.matchPrefs.industries.includes(ind)}
                onClick={() => toggle('industries', ind)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm border-2 transition-all',
                  data.matchPrefs.industries.includes(ind)
                    ? 'border-primary bg-primary/10 border-primary text-primary-accessible'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        {/* Startup Stages */}
        <div>
          <p id="ob-stages" className="block text-sm font-medium mb-1"><BilingualText en="Preferred Startup Stage" el="Προτιμώμενο στάδιο startup" compact /></p>
          <p className="text-xs text-muted-foreground mb-3"><BilingualText en="What stages are you most interested in working with?" el="Με ποια στάδια σας ενδιαφέρει να δουλέψετε;" wrap /></p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ob-stages">
            {STAGES.map(stage => (
              <button
                key={stage}
                type="button"
                aria-pressed={data.matchPrefs.stages.includes(stage)}
                onClick={() => toggle('stages', stage)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm border-2 font-medium transition-all',
                  data.matchPrefs.stages.includes(stage)
                    ? 'border-primary bg-primary/5 text-primary-accessible'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>

        {data.matchPrefs.lookingFor.length === 0 && data.matchPrefs.industries.length === 0 && (
          <p className="text-sm text-center text-muted-foreground py-2 italic">
            <BilingualText en="You can skip this step — we'll refine your preferences later from your profile settings." el="Μπορείτε να παραλείψετε αυτό το βήμα — θα βελτιώσουμε τις προτιμήσεις σας αργότερα από τις ρυθμίσεις προφίλ." wrap />
          </p>
        )}
      </CardContent>
    </Card>
  );
}
