import { Rocket, GraduationCap, TrendingUp, Building2 } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type RoleType = 'founder' | 'mentor' | 'investor' | 'org';

const roleConfig: Record<RoleType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  founder: { label: 'Founder', icon: Rocket },
  mentor: { label: 'Mentor', icon: GraduationCap },
  investor: { label: 'Investor', icon: TrendingUp },
  org: { label: 'Organization', icon: Building2 },
};

type RoleBadgeProps = {
  role?: string | null;
  showIcon?: boolean;
  size?: BadgeProps['size'];
  className?: string;
  animated?: boolean;
};

function normalizeRole(raw: string): RoleType | null {
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (key === 'founder' || key === 'mentor' || key === 'investor' || key === 'org') return key;
  if (key === 'cofounder' || key === 'co_founder' || key === 'technical_talent' || key === 'operator') {
    return 'founder';
  }
  if (key === 'advisor' || key === 'coach') return 'mentor';
  if (key === 'angel' || key === 'angel_investor' || key === 'vc' || key === 'vc_analyst' || key === 'vc_scout') {
    return 'investor';
  }
  if (key === 'organization' || key === 'admin' || key === 'community_manager') return 'org';
  return null;
}

export function RoleBadge({ 
  role, 
  showIcon = true, 
  size = 'md',
  className,
  animated = false,
}: RoleBadgeProps) {
  if (typeof role !== 'string' || !role.trim()) {
    return null;
  }

  const roleKey = normalizeRole(role);
  const config = roleKey ? roleConfig[roleKey] : undefined;
  
  if (!config || !roleKey) {
    return <Badge variant="secondary" size={size} className={className}>{role}</Badge>;
  }

  const Icon = config.icon;
  const variant = roleKey as BadgeProps['variant'];

  return (
    <Badge 
      variant={variant} 
      size={size}
      className={cn(
        animated && 'animate-scale-in',
        className
      )}
    >
      {showIcon && <Icon className={cn('icon-sm', animated && 'animate-bounce-subtle')} />}
      {config.label}
    </Badge>
  );
}
