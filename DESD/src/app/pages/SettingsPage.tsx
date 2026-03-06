import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';

interface CustomerSettings {
  sustainabilityMessageEnabled: boolean;
  showFoodMilesBadge: boolean;
  marketingEmailsEnabled: boolean;
  orderStatusEmailsEnabled: boolean;
  defaultMapRadiusMiles: number;
}

const SETTINGS_STORAGE_KEY = 'desd_customer_settings';

const DEFAULT_SETTINGS: CustomerSettings = {
  sustainabilityMessageEnabled: true,
  showFoodMilesBadge: true,
  marketingEmailsEnabled: false,
  orderStatusEmailsEnabled: true,
  defaultMapRadiusMiles: 20,
};

function loadSettings(): CustomerSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CustomerSettings>;
    return {
      sustainabilityMessageEnabled:
        typeof parsed.sustainabilityMessageEnabled === 'boolean'
          ? parsed.sustainabilityMessageEnabled
          : DEFAULT_SETTINGS.sustainabilityMessageEnabled,
      showFoodMilesBadge:
        typeof parsed.showFoodMilesBadge === 'boolean'
          ? parsed.showFoodMilesBadge
          : DEFAULT_SETTINGS.showFoodMilesBadge,
      marketingEmailsEnabled:
        typeof parsed.marketingEmailsEnabled === 'boolean'
          ? parsed.marketingEmailsEnabled
          : DEFAULT_SETTINGS.marketingEmailsEnabled,
      orderStatusEmailsEnabled:
        typeof parsed.orderStatusEmailsEnabled === 'boolean'
          ? parsed.orderStatusEmailsEnabled
          : DEFAULT_SETTINGS.orderStatusEmailsEnabled,
      defaultMapRadiusMiles:
        typeof parsed.defaultMapRadiusMiles === 'number'
          ? parsed.defaultMapRadiusMiles
          : DEFAULT_SETTINGS.defaultMapRadiusMiles,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<CustomerSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const saveSettings = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
    toast.success('Settings updated.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Marketplace
          </Button>
          <Button variant="outline" onClick={() => navigate('/account')}>
            Account Information
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Configure customer preferences and default behavior.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>General Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sustainability Message</p>
                <p className="text-sm text-gray-600">Show “Go Green” guidance near food miles.</p>
              </div>
              <Switch
                checked={settings.sustainabilityMessageEnabled}
                onCheckedChange={(value) =>
                  setSettings((prev) => ({ ...prev, sustainabilityMessageEnabled: value }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Food Miles Badge</p>
                <p className="text-sm text-gray-600">Display food miles on product/cart cards.</p>
              </div>
              <Switch
                checked={settings.showFoodMilesBadge}
                onCheckedChange={(value) => setSettings((prev) => ({ ...prev, showFoodMilesBadge: value }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Order Status Emails</p>
                <p className="text-sm text-gray-600">Receive updates when order statuses change.</p>
              </div>
              <Switch
                checked={settings.orderStatusEmailsEnabled}
                onCheckedChange={(value) =>
                  setSettings((prev) => ({ ...prev, orderStatusEmailsEnabled: value }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Marketing Emails</p>
                <p className="text-sm text-gray-600">Receive promotions and community updates.</p>
              </div>
              <Switch
                checked={settings.marketingEmailsEnabled}
                onCheckedChange={(value) =>
                  setSettings((prev) => ({ ...prev, marketingEmailsEnabled: value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="settings-map-radius">Default Map Radius (miles)</Label>
              <Input
                id="settings-map-radius"
                type="number"
                min="1"
                max="200"
                value={String(settings.defaultMapRadiusMiles)}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (!Number.isFinite(parsed)) {
                    return;
                  }
                  setSettings((prev) => ({ ...prev, defaultMapRadiusMiles: parsed }));
                }}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={saveSettings}>
            <Save className="size-4 mr-2" />
            Save Settings
          </Button>
          <Button variant="outline" onClick={() => navigate('/orders/history')}>
            View Order History
          </Button>
          <Button variant="outline" onClick={() => navigate('/account')}>
            Edit Account
          </Button>
        </div>
      </main>
    </div>
  );
}
