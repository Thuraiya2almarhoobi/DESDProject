/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the SettingsPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useSafeBack } from '../lib/navigation';
import { SiteHeader } from '../components/SiteHeader';
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

/**
 * SETTINGS_STORAGE_KEY boundary.
 *
 * This exported unit supports the file role: Implements the SettingsPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const SETTINGS_STORAGE_KEY = 'desd_customer_settings';

const DEFAULT_SETTINGS: CustomerSettings = {
  sustainabilityMessageEnabled: true,
  showFoodMilesBadge: true,
  marketingEmailsEnabled: false,
  orderStatusEmailsEnabled: true,
  defaultMapRadiusMiles: 20,
};

function storageKeyForRole(role?: string | null): string {
  if (!role || role === 'CUSTOMER') {
    return SETTINGS_STORAGE_KEY;
  }
  return `desd_${role.toLowerCase()}_settings`;
}

function loadSettings(storageKey: string): CustomerSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  const raw = window.localStorage.getItem(storageKey);
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

/**
 * SettingsPage boundary.
 *
 * This exported unit supports the file role: Implements the SettingsPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const goBack = useSafeBack('/marketplace');
  const { user } = useAuth();
  const [settings, setSettings] = useState<CustomerSettings>(DEFAULT_SETTINGS);
  const storageKey = storageKeyForRole(user?.role);
  const pageTitle =
    user?.role === 'COMMUNITY'
      ? 'Community Settings'
      : user?.role === 'RESTAURANT'
        ? 'Restaurant Settings'
        : 'Settings';
  const pageDescription =
    user?.role === 'COMMUNITY'
      ? 'Configure community ordering, food-mile visibility, and organisation delivery preferences.'
      : user?.role === 'RESTAURANT'
        ? 'Configure kitchen ordering, delivery updates, and supply-planning preferences.'
        : 'Configure customer preferences and default behavior.';
  const backToMarketplaceButton = (
    <Button variant="ghost" onClick={goBack}>
      <ArrowLeft className="mr-2 size-4" />
      Back to Marketplace
    </Button>
  );

  useEffect(() => {
    setSettings(loadSettings(storageKey));
  }, [storageKey]);

  const saveSettings = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
    }
    toast.success('Settings updated.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {backToMarketplaceButton}
          <Button variant="outline" onClick={() => navigate('/account')}>
            Account Information
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">{pageTitle}</h1>
          <p className="text-sm text-gray-600 mt-1">{pageDescription}</p>
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
