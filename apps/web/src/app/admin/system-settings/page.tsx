'use client';

import { useState } from 'react';
import { Save, Settings, Mail, Shield, Globe } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { HelpCallout } from '@/components/common/HelpCallout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { BilingualText } from '@/components/common/BilingualText';

export default function SystemSettingsPage() {
  const { success } = useToast();
  const [maintenance, setMaintenance] = useState(false);
  const [signupOpen, setSignupOpen] = useState(true);
  const [supportEmail, setSupportEmail] = useState('support@cofounderbay.com');
  const [platformName, setPlatformName] = useState('CoFounderBay');

  const save = () => success('Settings saved', 'Platform configuration updated (demo).');

  return (
    <AppShell
      title="System settings"
      description="Global platform switches — maintenance mode, signups, support contact, and defaults."
      descriptionEl="Γενικοί διακόπτες της πλατφόρμας — λειτουργία συντήρησης, εγγραφές, επικοινωνία υποστήριξης και προεπιλογές."
      showHelp
      actions={
        <Button size="sm" onClick={save}>
          <Save className="icon-sm mr-1.5" /> <BilingualText en="Save changes" el="Αποθήκευση αλλαγών" compact />
        </Button>
      }
    >
      <HelpCallout id="admin-system-settings" title="Platform-wide settings">
        <p>
          <strong><BilingualText en="Maintenance mode" el="Λειτουργία συντήρησης" compact /></strong> shows a banner and blocks new sessions for non-admins.
          <strong> <BilingualText en="Registration" el="Εγγραφές" compact /></strong> toggle pauses new signups without affecting existing users.
        </p>
      </HelpCallout>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><BilingualText en="General" el="Γενικά" compact /></TabsTrigger>
          <TabsTrigger value="security"><BilingualText en="Security" el="Ασφάλεια" compact /></TabsTrigger>
          <TabsTrigger value="email"><BilingualText en="Email" el="Email" compact /></TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="icon-sm" /> <BilingualText en="Branding & access" el="Εμφάνιση & πρόσβαση" compact />
              </CardTitle>
              <CardDescription><BilingualText en="Visible to all users on public pages and emails." el="Ορατό σε όλους στις δημόσιες σελίδες και τα email." wrap /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform-name"><BilingualText en="Platform name" el="Όνομα πλατφόρμας" compact /></Label>
                <Input id="platform-name" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-email"><BilingualText en="Support email" el="Email υποστήριξης" compact /></Label>
                <Input id="support-email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="font-medium"><BilingualText en="Maintenance mode" el="Λειτουργία συντήρησης" compact /></p>
                  <p className="text-sm text-muted-foreground"><BilingualText en="Temporarily limit access for upgrades" el="Προσωρινός περιορισμός πρόσβασης για αναβαθμίσεις" wrap /></p>
                </div>
                <Switch checked={maintenance} onCheckedChange={setMaintenance} aria-label="Maintenance mode" />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="font-medium"><BilingualText en="Open registration" el="Ανοιχτές εγγραφές" compact /></p>
                  <p className="text-sm text-muted-foreground"><BilingualText en="Allow new account signups" el="Να επιτρέπονται νέοι λογαριασμοί" compact /></p>
                </div>
                <Switch checked={signupOpen} onCheckedChange={setSignupOpen} aria-label="Open registration" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="icon-sm" /> <BilingualText en="Security defaults" el="Προεπιλογές ασφάλειας" compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><BilingualText en="Session timeout: 7 days (refresh token rotation enabled)" el="Λήξη συνεδρίας: 7 ημέρες (με εναλλαγή refresh token)" wrap /></p>
              <p>2FA: optional for users, required for platform admins</p>
              <p><BilingualText en="Rate limiting: 100 req/min per IP on auth routes" el="Όριο αιτημάτων: 100/λεπτό ανά IP στις διαδρομές σύνδεσης" wrap /></p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="icon-sm" /> <BilingualText en="Email delivery" el="Αποστολή email" compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="from-name"><BilingualText en="From name" el="Όνομα αποστολέα" compact /></Label>
                <Input id="from-name" defaultValue="CoFounderBay" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-email"><BilingualText en="From email" el="Email αποστολέα" compact /></Label>
                <Input id="from-email" defaultValue="noreply@cofounderbay.com" />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 pt-2">
                <Globe className="icon-sm" /> <BilingualText en="SPF/DKIM configured per production deployment guide" el="SPF/DKIM ρυθμισμένα σύμφωνα με τον οδηγό παραγωγής" wrap />
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
