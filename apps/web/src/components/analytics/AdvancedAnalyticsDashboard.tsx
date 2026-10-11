'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Calendar,
  Eye,
  Heart,
  Share2,
  Target,
  Award,
  Activity,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';

interface AnalyticsMetric {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
  }>;
}

export function AdvancedAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const metrics: AnalyticsMetric[] = [
    {
      label: 'Profile Views',
      value: '2,847',
      change: 12.5,
      trend: 'up',
      icon: <Eye className="icon-sm" />,
    },
    {
      label: 'Connections',
      value: 156,
      change: 8.2,
      trend: 'up',
      icon: <Users className="icon-sm" />,
    },
    {
      label: 'Messages Sent',
      value: 423,
      change: -3.1,
      trend: 'down',
      icon: <MessageSquare className="icon-sm" />,
    },
    {
      label: 'Events Attended',
      value: 12,
      change: 20.0,
      trend: 'up',
      icon: <Calendar className="icon-sm" />,
    },
    {
      label: 'Post Engagement',
      value: '1,234',
      change: 15.3,
      trend: 'up',
      icon: <Heart className="icon-sm" />,
    },
    {
      label: 'Profile Shares',
      value: 89,
      change: 5.7,
      trend: 'up',
      icon: <Share2 className="icon-sm" />,
    },
  ];

  const engagementData: ChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Profile Views',
        data: [120, 150, 180, 220, 190, 240, 280],
        color: 'hsl(var(--primary))',
      },
      {
        label: 'Interactions',
        data: [80, 95, 110, 130, 120, 145, 160],
        color: 'hsl(var(--accent))',
      },
    ],
  };

  const connectionGrowth = [
    { month: 'Jan', count: 45 },
    { month: 'Feb', count: 62 },
    { month: 'Mar', count: 78 },
    { month: 'Apr', count: 95 },
    { month: 'May', count: 118 },
    { month: 'Jun', count: 156 },
  ];

  const topSkills = [
    { skill: 'Product Management', endorsements: 45, percentage: 90 },
    { skill: 'Startup Strategy', endorsements: 38, percentage: 76 },
    { skill: 'Team Leadership', endorsements: 32, percentage: 64 },
    { skill: 'Fundraising', endorsements: 28, percentage: 56 },
    { skill: 'Marketing', endorsements: 24, percentage: 48 },
  ];

  const activityBreakdown = [
    { category: 'Networking', percentage: 35, color: 'bg-primary' },
    { category: 'Messaging', percentage: 25, color: 'bg-accent' },
    { category: 'Events', percentage: 20, color: 'bg-secondary' },
    { category: 'Content', percentage: 15, color: 'bg-muted' },
    { category: 'Other', percentage: 5, color: 'bg-border' },
  ];

  const recentAchievements = [
    {
      title: 'Networking Pro',
      description: 'Connected with 100+ founders',
      date: '2 days ago',
      icon: <Users className="icon-md" />,
      color: 'text-primary-accessible',
    },
    {
      title: 'Active Contributor',
      description: 'Posted 50+ valuable insights',
      date: '1 week ago',
      icon: <Activity className="icon-md" />,
      color: 'text-accent',
    },
    {
      title: 'Event Enthusiast',
      description: 'Attended 10+ events',
      date: '2 weeks ago',
      icon: <Calendar className="icon-md" />,
      color: 'text-secondary',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight"><BilingualText en="Analytics Dashboard" el="Πίνακας αναλυτικών" compact /></h2>
          <p className="text-muted-foreground">
            <BilingualText en="Track your performance and engagement metrics" el="Παρακολουθήστε απόδοση και συμμετοχή" wrap />
          </p>
        </div>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
          <TabsList>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
            <TabsTrigger value="90d">90 Days</TabsTrigger>
            <TabsTrigger value="1y">1 Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.label}
              </CardTitle>
              <div className="text-muted-foreground">{metric.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="page-stat text-xl font-bold">{metric.value}</div>
              <p className={cn(
                "text-xs flex items-center gap-1 mt-1",
                metric.trend === 'up' ? 'text-status-success' : 
                metric.trend === 'down' ? 'text-status-danger' : 
                'text-muted-foreground'
              )}>
                <TrendingUp className={cn(
                  "icon-sm",
                  metric.trend === 'down' && 'rotate-180'
                )} aria-hidden="true" />
                {Math.abs(metric.change)}% from last period
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Engagement Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="icon-md" />
              <BilingualText en="Weekly Engagement" el="Εβδομαδιαία συμμετοχή" compact />
            </CardTitle>
            <CardDescription>
              <BilingualText en="Profile views and interactions over the past week" el="Προβολές προφίλ και αλληλεπιδράσεις την τελευταία εβδομάδα" wrap />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-end justify-between gap-2">
              {engagementData.labels.map((label, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col gap-1">
                    {engagementData.datasets.map((dataset, datasetIndex) => (
                      <div
                        key={datasetIndex}
                        className="w-full rounded-t transition-all hover:opacity-80"
                        style={{
                          height: `${(dataset.data[index] / Math.max(...dataset.data)) * 200}px`,
                          backgroundColor: dataset.color,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4">
              {engagementData.datasets.map((dataset, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dataset.color }}
                  />
                  <span className="text-sm">{dataset.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Connection Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="icon-md" />
              <BilingualText en="Connection Growth" el="Αύξηση συνδέσεων" compact />
            </CardTitle>
            <CardDescription>
              <BilingualText en="Your network expansion over time" el="Η ανάπτυξη του δικτύου σας στον χρόνο" compact wrap />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-end justify-between gap-3">
              {connectionGrowth.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-primary rounded-t transition-all hover:opacity-80 cursor-pointer"
                    style={{
                      height: `${(item.count / Math.max(...connectionGrowth.map(i => i.count))) * 250}px`,
                    }}
                  />
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">{item.month}</div>
                    <div className="text-sm font-semibold">{item.count}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Analytics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Top Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="icon-md" />
              <BilingualText en="Top Skills" el="Κορυφαίες δεξιότητες" compact />
            </CardTitle>
            <CardDescription>
              <BilingualText en="Most endorsed skills on your profile" el="Οι δεξιότητες με τις περισσότερες συστάσεις" wrap />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topSkills.map((skill, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{skill.skill}</span>
                  <span className="text-muted-foreground">
                    {skill.endorsements} endorsements
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${skill.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Activity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="icon-md" />
              <BilingualText en="Activity Breakdown" el="Ανάλυση δραστηριότητας" compact />
            </CardTitle>
            <CardDescription>
              <BilingualText en="How you spend your time on the platform" el="Πώς περνάτε τον χρόνο σας στην πλατφόρμα" wrap />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityBreakdown.map((activity, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{activity.category}</span>
                    <span className="text-muted-foreground">
                      {activity.percentage}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all", activity.color)}
                      style={{ width: `${activity.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="icon-md" />
            <BilingualText en="Recent Achievements" el="Πρόσφατα επιτεύγματα" compact />
          </CardTitle>
          <CardDescription>
            <BilingualText en="Your latest milestones and accomplishments" el="Τα πιο πρόσφατα ορόσημα και επιτεύγματά σας" wrap />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentAchievements.map((achievement, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className={cn("p-2 rounded-lg bg-muted", achievement.color)}>
                  {achievement.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{achievement.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {achievement.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {achievement.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
