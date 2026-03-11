import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Save, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiJson } from '../lib/api';
import { useSafeBack } from '../lib/navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface AccountMePayload {
  user: {
    id: number;
    email: string;
    role: string;
  };
  profile: {
    full_name?: string;
    phone?: string;
    allergies_text?: string;
    preferences_text?: string;
    default_address?: number | null;
  } | null;
  addresses: Array<{
    id: number;
    label: string;
    line1: string;
    city: string;
    postcode: string;
    is_default: boolean;
  }>;
}

interface OrdersProfilePayload {
  full_name: string;
  phone: string;
  delivery_address: string;
  postcode: string;
}

export function AccountPage() {
  const navigate = useNavigate();
  const goBack = useSafeBack('/marketplace');
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [preferencesText, setPreferencesText] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [defaultAddressId, setDefaultAddressId] = useState<string>('none');
  const [addresses, setAddresses] = useState<AccountMePayload['addresses']>([]);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const [me, orderProfile] = await Promise.all([
          apiJson<AccountMePayload>('/api/accounts/me/'),
          apiJson<OrdersProfilePayload>('/api/orders/profile/'),
        ]);

        if (!mounted) {
          return;
        }

        setEmail(me.user.email || user?.email || '');
        setRole(me.user.role || user?.role || 'CUSTOMER');
        setFullName(orderProfile.full_name || me.profile?.full_name || '');
        setPhone(orderProfile.phone || me.profile?.phone || '');
        setAllergiesText(me.profile?.allergies_text || '');
        setPreferencesText(me.profile?.preferences_text || '');
        setDeliveryAddress(orderProfile.delivery_address || '');
        setPostcode(orderProfile.postcode || '');
        setAddresses(me.addresses || []);
        setDefaultAddressId(
          me.profile?.default_address ? String(me.profile.default_address) : 'none',
        );
      } catch (error) {
        if (mounted) {
          toast.error(error instanceof Error ? error.message : 'Unable to load account details.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [user?.email, user?.role]);

  const saveAccount = async () => {
    setSaving(true);
    try {
      await Promise.all([
        apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({
            profile: {
              full_name: fullName,
              phone,
              allergies_text: allergiesText,
              preferences_text: preferencesText,
              default_address: defaultAddressId === 'none' ? null : Number(defaultAddressId),
            },
          }),
        }),
        apiJson('/api/orders/profile/', {
          method: 'PUT',
          body: JSON.stringify({
            full_name: fullName,
            phone,
            delivery_address: deliveryAddress,
            postcode,
          }),
        }),
      ]);

      toast.success('Account details updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save account details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Marketplace
          </Button>
          <Button variant="outline" onClick={() => navigate('/orders/history')}>
            Order History
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Account Information</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your profile, allergen preferences, and delivery details.</p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">Loading account details...</CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="size-5" />
                  Basic Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="account-email">Email</Label>
                    <Input id="account-email" value={email} disabled />
                  </div>
                  <div>
                    <Label htmlFor="account-role">Role</Label>
                    <Input id="account-role" value={role} disabled />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="account-full-name">Full Name</Label>
                    <Input
                      id="account-full-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-phone">Phone</Label>
                    <Input
                      id="account-phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="account-allergies">Allergens / Avoidance Notes</Label>
                  <Textarea
                    id="account-allergies"
                    value={allergiesText}
                    onChange={(event) => setAllergiesText(event.target.value)}
                    placeholder="e.g., Nuts, Milk, Gluten"
                  />
                </div>
                <div>
                  <Label htmlFor="account-preferences">Food Preferences</Label>
                  <Textarea
                    id="account-preferences"
                    value={preferencesText}
                    onChange={(event) => setPreferencesText(event.target.value)}
                    placeholder="e.g., Organic only, no shellfish"
                  />
                </div>
                <div>
                  <Label htmlFor="account-default-address">Default Address (Account)</Label>
                  <Select value={defaultAddressId} onValueChange={setDefaultAddressId}>
                    <SelectTrigger id="account-default-address">
                      <SelectValue placeholder="Select default address" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default address</SelectItem>
                      {addresses.map((address) => (
                        <SelectItem key={address.id} value={String(address.id)}>
                          {address.label}: {address.line1}, {address.city} {address.postcode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="account-delivery-address">Delivery Address</Label>
                  <Input
                    id="account-delivery-address"
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="account-postcode">Postcode</Label>
                  <Input
                    id="account-postcode"
                    value={postcode}
                    onChange={(event) => setPostcode(event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button onClick={saveAccount} disabled={saving}>
                <Save className="size-4 mr-2" />
                {saving ? 'Saving...' : 'Save Account'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/settings')}>
                Go to Settings
              </Button>
              <Button variant="outline" onClick={() => navigate('/orders/history')}>
                View Order History
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
