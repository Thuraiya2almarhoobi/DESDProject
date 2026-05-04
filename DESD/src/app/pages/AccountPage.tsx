/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the AccountPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowLeft, Building2, Save, ShieldCheck, Store, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiJson } from '../lib/api';
import { getPreferredAddress } from '../lib/accountLocation';
import { getDashboardPathForRole } from '../lib/roleRouting';
import { useSafeBack } from '../lib/navigation';
import { SiteHeader } from '../components/SiteHeader';
import { PageLoadingSkeleton } from '../components/LoadingSkeletons';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cn } from '../components/ui/utils';
import { UserRole } from '../types';

interface AddressRecord {
  id: number;
  label: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  is_default: boolean;
}

interface AccountMePayload {
  user: {
    id: number;
    email: string;
    role: UserRole;
  };
  profile: Record<string, unknown> | null;
  addresses: AddressRecord[];
}

interface OrdersProfilePayload {
  full_name: string;
  phone: string;
  delivery_address: string;
  postcode: string;
}

interface AddressDraft {
  id: number | null;
  label: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  isDefault: boolean;
}

/**
 * EMPTY_ADDRESS_DRAFT boundary.
 *
 * This exported unit supports the file role: Implements the AccountPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const EMPTY_ADDRESS_DRAFT: AddressDraft = {
  id: null,
  label: '',
  line1: '',
  line2: '',
  city: '',
  postcode: '',
  isDefault: true,
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function inferCityFromAddress(line1: string): string {
  const parts = line1
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return 'Bristol';
}

function toAddressDraft(address: AddressRecord | undefined, fallbackLabel: string): AddressDraft {
  if (!address) {
    return {
      ...EMPTY_ADDRESS_DRAFT,
      label: fallbackLabel,
    };
  }
  return {
    id: address.id,
    label: address.label || fallbackLabel,
    line1: address.line1 || '',
    line2: address.line2 || '',
    city: address.city || '',
    postcode: address.postcode || '',
    isDefault: address.is_default,
  };
}

function findAddressById(addresses: AddressRecord[], id: number | null): AddressRecord | undefined {
  if (!id) {
    return undefined;
  }
  return addresses.find((address) => address.id === id);
}

function titleForRole(role: UserRole): string {
  switch (role) {
    case 'PRODUCER':
      return 'Producer Account';
    case 'COMMUNITY':
      return 'Community Account';
    case 'RESTAURANT':
      return 'Restaurant Account';
    case 'ADMIN':
      return 'Admin Account';
    case 'CUSTOMER':
    default:
      return 'Account Information';
  }
}

function descriptionForRole(role: UserRole): string {
  switch (role) {
    case 'PRODUCER':
      return 'Manage business details, dispatch postcode, and lead-time settings.';
    case 'COMMUNITY':
      return 'Manage organisation contacts and the delivery profile used for group orders.';
    case 'RESTAURANT':
      return 'Manage restaurant contact details and the delivery address used for recurring orders.';
    case 'ADMIN':
      return 'Review the core platform-admin identity attached to this account.';
    case 'CUSTOMER':
    default:
      return 'Manage your profile, allergen preferences, and delivery details.';
  }
}

function iconForRole(role: UserRole) {
  switch (role) {
    case 'PRODUCER':
      return Store;
    case 'COMMUNITY':
      return Users;
    case 'RESTAURANT':
      return Building2;
    case 'ADMIN':
      return ShieldCheck;
    case 'CUSTOMER':
    default:
      return UserRound;
  }
}

/**
 * AccountPage boundary.
 *
 * This exported unit supports the file role: Implements the AccountPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function AccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBackToMarketplace = useSafeBack('/marketplace');
  const { user, getMe } = useAuth();
  const role = (user?.role || 'CUSTOMER') as UserRole;
  const backPath = role === 'CUSTOMER' ? '/marketplace' : getDashboardPathForRole(role);
  const backLabel = role === 'CUSTOMER' ? 'Back to Marketplace' : 'Back to Dashboard';
/**
 * TitleIcon boundary.
 *
 * This exported unit supports the file role: Implements the AccountPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
  const TitleIcon = iconForRole(role);

  const deliveryProfileRef = useRef<HTMLDivElement | null>(null);
  const businessProfileRef = useRef<HTMLDivElement | null>(null);
  const organisationProfileRef = useRef<HTMLDivElement | null>(null);
  const adminProfileRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState('');

  const [email, setEmail] = useState('');
  const [displayRole, setDisplayRole] = useState<UserRole>('CUSTOMER');
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [preferencesText, setPreferencesText] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [defaultAddressId, setDefaultAddressId] = useState('none');

  const [producerBusinessName, setProducerBusinessName] = useState('');
  const [producerContactName, setProducerContactName] = useState('');
  const [producerPhone, setProducerPhone] = useState('');
  const [farmOriginText, setFarmOriginText] = useState('');
  const [leadTimeHours, setLeadTimeHours] = useState('48');
  const [producerAddressDraft, setProducerAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);

  const [organisationName, setOrganisationName] = useState('');
  const [organisationType, setOrganisationType] = useState('');
  const [communityContactName, setCommunityContactName] = useState('');
  const [communityPhone, setCommunityPhone] = useState('');
  const [communityAddressDraft, setCommunityAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);

  const [restaurantBusinessName, setRestaurantBusinessName] = useState('');
  const [restaurantContactName, setRestaurantContactName] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [restaurantAddressDraft, setRestaurantAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);

  const updateProducerAddressDraft = (field: keyof AddressDraft, value: string | boolean | number | null) => {
    setProducerAddressDraft((previous) => ({ ...previous, [field]: value }));
  };

  const updateCommunityAddressDraft = (field: keyof AddressDraft, value: string | boolean | number | null) => {
    setCommunityAddressDraft((previous) => ({ ...previous, [field]: value }));
  };

  const updateRestaurantAddressDraft = (field: keyof AddressDraft, value: string | boolean | number | null) => {
    setRestaurantAddressDraft((previous) => ({ ...previous, [field]: value }));
  };

  const syncCustomerDefaultAddress = useCallback(
    async (currentAddresses: AddressRecord[]) => {
      const existingAddress =
        (defaultAddressId !== 'none'
          ? currentAddresses.find((address) => String(address.id) === defaultAddressId)
          : undefined) ||
        currentAddresses.find((address) => address.is_default) ||
        currentAddresses[0];

      const payload = {
        label: existingAddress?.label || 'Delivery Address',
        line1: deliveryAddress.trim(),
        line2: existingAddress?.line2 || '',
        city: existingAddress?.city || inferCityFromAddress(deliveryAddress),
        postcode: postcode.trim(),
        is_default: true,
      };

      if (existingAddress) {
        const updated = await apiJson<AddressRecord>(`/api/accounts/addresses/${existingAddress.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        return updated.id;
      }

      const created = await apiJson<AddressRecord>('/api/accounts/addresses/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return created.id;
    },
    [defaultAddressId, deliveryAddress, postcode],
  );

  const upsertAddress = useCallback(async (draft: AddressDraft, fallbackLabel: string) => {
    if (!draft.line1.trim()) {
      throw new Error('Address line 1 is required.');
    }
    if (!draft.postcode.trim()) {
      throw new Error('Postcode is required.');
    }

    const payload = {
      label: draft.label.trim() || fallbackLabel,
      line1: draft.line1.trim(),
      line2: draft.line2.trim(),
      city: draft.city.trim() || inferCityFromAddress(draft.line1),
      postcode: draft.postcode.trim(),
      is_default: draft.isDefault,
    };

    if (draft.id) {
      const updated = await apiJson<AddressRecord>(`/api/accounts/addresses/${draft.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return updated.id;
    }

    const created = await apiJson<AddressRecord>('/api/accounts/addresses/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return created.id;
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const me = await apiJson<AccountMePayload>('/api/accounts/me/');
      const nextRole = me.user.role || role;
      const profile = me.profile || {};

      setEmail(me.user.email || user?.email || '');
      setDisplayRole(nextRole);
      setAddresses(me.addresses || []);

      if (nextRole === 'CUSTOMER') {
        const orderProfile = await apiJson<OrdersProfilePayload>('/api/orders/profile/');
        const preferredAddress = getPreferredAddress(nextRole, profile, me.addresses);
        setFullName(orderProfile.full_name || asString(profile.full_name));
        setPhone(orderProfile.phone || asString(profile.phone));
        setAllergiesText(asString(profile.allergies_text));
        setPreferencesText(asString(profile.preferences_text));
        setDeliveryAddress(preferredAddress?.line1 || orderProfile.delivery_address || '');
        setPostcode(preferredAddress?.postcode || orderProfile.postcode || '');
        setDefaultAddressId(preferredAddress ? String(preferredAddress.id) : 'none');
      }

      if (nextRole === 'PRODUCER') {
        const addressId = asNumber(profile.address);
        const address = findAddressById(me.addresses, addressId) || me.addresses[0];
        setProducerBusinessName(asString(profile.business_name));
        setProducerContactName(asString(profile.contact_name));
        setProducerPhone(asString(profile.phone));
        setFarmOriginText(asString(profile.farm_origin_text));
        setLeadTimeHours(String(asNumber(profile.lead_time_hours) || 48));
        setProducerAddressDraft(toAddressDraft(address, 'Business Address'));
      }

      if (nextRole === 'COMMUNITY') {
        const addressId = asNumber(profile.delivery_address);
        const address = findAddressById(me.addresses, addressId) || me.addresses[0];
        setOrganisationName(asString(profile.organisation_name));
        setOrganisationType(asString(profile.org_type));
        setCommunityContactName(asString(profile.contact_name));
        setCommunityPhone(asString(profile.phone));
        setCommunityAddressDraft(toAddressDraft(address, 'Delivery Address'));
      }

      if (nextRole === 'RESTAURANT') {
        const addressId = asNumber(profile.delivery_address);
        const address = findAddressById(me.addresses, addressId) || me.addresses[0];
        setRestaurantBusinessName(asString(profile.business_name));
        setRestaurantContactName(asString(profile.contact_name));
        setRestaurantPhone(asString(profile.phone));
        setRestaurantAddressDraft(toAddressDraft(address, 'Delivery Address'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load account details.');
    } finally {
      setLoading(false);
    }
  }, [role, user?.email]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const nextSectionId = location.hash.replace('#', '').trim();
    if (!nextSectionId) {
      return;
    }

    const sectionMap = {
      'delivery-profile': deliveryProfileRef,
      'business-profile': businessProfileRef,
      'organisation-profile': organisationProfileRef,
      'admin-profile': adminProfileRef,
    };

    const targetRef = sectionMap[nextSectionId];
    if (!targetRef?.current) {
      return;
    }

    targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightedSection(nextSectionId);

    const timeoutId = window.setTimeout(() => {
      setHighlightedSection('');
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [loading, location.hash]);

  const saveAccount = async () => {
    setSaving(true);
    try {
      if (displayRole === 'CUSTOMER') {
        const syncedDefaultAddressId = await syncCustomerDefaultAddress(addresses);
        await Promise.all([
          apiJson('/api/accounts/me/', {
            method: 'PATCH',
            body: JSON.stringify({
              profile: {
                full_name: fullName,
                phone,
                allergies_text: allergiesText,
                preferences_text: preferencesText,
                default_address: syncedDefaultAddressId,
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
      } else if (displayRole === 'PRODUCER') {
        const addressId = await upsertAddress(producerAddressDraft, 'Business Address');
        await apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({
            profile: {
              business_name: producerBusinessName,
              contact_name: producerContactName,
              phone: producerPhone,
              farm_origin_text: farmOriginText,
              lead_time_hours: Number(leadTimeHours) || 48,
              address: addressId,
            },
          }),
        });
      } else if (displayRole === 'COMMUNITY') {
        const addressId = await upsertAddress(communityAddressDraft, 'Delivery Address');
        await apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({
            profile: {
              organisation_name: organisationName,
              org_type: organisationType,
              contact_name: communityContactName,
              phone: communityPhone,
              delivery_address: addressId,
            },
          }),
        });
      } else if (displayRole === 'RESTAURANT') {
        const addressId = await upsertAddress(restaurantAddressDraft, 'Delivery Address');
        await apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({
            profile: {
              business_name: restaurantBusinessName,
              contact_name: restaurantContactName,
              phone: restaurantPhone,
              delivery_address: addressId,
            },
          }),
        });
      } else {
        toast.info('Admin accounts do not have editable profile fields in this build.');
        return;
      }

      await getMe().catch(() => undefined);
      await loadProfile();
      toast.success('Account details updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save account details.');
    } finally {
      setSaving(false);
    }
  };

  const headerActions = useMemo(() => {
    if (displayRole === 'CUSTOMER') {
      return (
        <>
          <Button variant="outline" onClick={() => navigate('/orders/history')}>
            Order History
          </Button>
          <Button variant="outline" onClick={() => navigate('/settings')}>
            Settings
          </Button>
        </>
      );
    }

    return (
      <Button variant="outline" onClick={() => navigate(getDashboardPathForRole(displayRole))}>
        Dashboard
      </Button>
    );
  }, [displayRole, navigate]);

  const renderAddressFields = (
    addressDraft: AddressDraft,
    updateAddress: (field: keyof AddressDraft, value: string | boolean | number | null) => void,
    heading: string,
  ) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor={`${heading}-label`}>Label</Label>
        <Input
          id={`${heading}-label`}
          value={addressDraft.label}
          onChange={(event) => updateAddress('label', event.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${heading}-line1`}>Address Line 1</Label>
        <Input
          id={`${heading}-line1`}
          value={addressDraft.line1}
          onChange={(event) => updateAddress('line1', event.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${heading}-line2`}>Address Line 2</Label>
        <Input
          id={`${heading}-line2`}
          value={addressDraft.line2}
          onChange={(event) => updateAddress('line2', event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${heading}-city`}>City</Label>
        <Input
          id={`${heading}-city`}
          value={addressDraft.city}
          onChange={(event) => updateAddress('city', event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${heading}-postcode`}>Postcode</Label>
        <Input
          id={`${heading}-postcode`}
          value={addressDraft.postcode}
          onChange={(event) => updateAddress('postcode', event.target.value)}
        />
      </div>
    </div>
  );

  const backButton = (
    <Button variant="ghost" onClick={role === 'CUSTOMER' ? goBackToMarketplace : () => navigate(backPath)}>
      <ArrowLeft className="mr-2 size-4" />
      {backLabel}
    </Button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {backButton}
          <div className="flex flex-wrap gap-3">{headerActions}</div>
        </div>

        <div>
          <h1 className="text-3xl font-semibold">{titleForRole(displayRole)}</h1>
          <p className="mt-1 text-sm text-gray-600">{descriptionForRole(displayRole)}</p>
        </div>

        {loading ? (
          <PageLoadingSkeleton rows={4} cards={3} />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TitleIcon className="size-5" />
                  Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="account-email">Email</Label>
                  <Input id="account-email" value={email} disabled />
                </div>
                <div>
                  <Label htmlFor="account-role">Role</Label>
                  <Input id="account-role" value={displayRole} disabled />
                </div>
              </CardContent>
            </Card>

            {displayRole === 'CUSTOMER' && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserRound className="size-5" />
                      Customer Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="customer-full-name">Full Name</Label>
                        <Input
                          id="customer-full-name"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="customer-phone">Phone</Label>
                        <Input
                          id="customer-phone"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="customer-allergies">Allergens / Avoidance Notes</Label>
                      <Textarea
                        id="customer-allergies"
                        value={allergiesText}
                        onChange={(event) => setAllergiesText(event.target.value)}
                        placeholder="e.g., Nuts, Milk, Gluten"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer-preferences">Food Preferences</Label>
                      <Textarea
                        id="customer-preferences"
                        value={preferencesText}
                        onChange={(event) => setPreferencesText(event.target.value)}
                        placeholder="e.g., Organic only, low food miles"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer-default-address">Default Address Record</Label>
                      <Select value={defaultAddressId} onValueChange={setDefaultAddressId}>
                        <SelectTrigger id="customer-default-address">
                          <SelectValue placeholder="Select default address" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Create from delivery profile</SelectItem>
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

                <Card
                  ref={deliveryProfileRef}
                  className={cn(
                    'transition-colors duration-300',
                    highlightedSection === 'delivery-profile' && 'border-green-500 ring-2 ring-green-200',
                  )}
                >
                  <CardHeader>
                    <CardTitle>Delivery Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="customer-delivery-address">Delivery Address</Label>
                      <Input
                        id="customer-delivery-address"
                        value={deliveryAddress}
                        onChange={(event) => setDeliveryAddress(event.target.value)}
                      />
                    </div>
                    <div className="max-w-sm">
                      <Label htmlFor="customer-postcode">Postcode</Label>
                      <Input
                        id="customer-postcode"
                        value={postcode}
                        onChange={(event) => setPostcode(event.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {displayRole === 'PRODUCER' && (
              <Card
                ref={businessProfileRef}
                className={cn(
                  'transition-colors duration-300',
                  highlightedSection === 'business-profile' && 'border-green-500 ring-2 ring-green-200',
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="size-5" />
                    Producer Business Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="producer-business-name">Business Name</Label>
                      <Input
                        id="producer-business-name"
                        value={producerBusinessName}
                        onChange={(event) => setProducerBusinessName(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="producer-contact-name">Contact Name</Label>
                      <Input
                        id="producer-contact-name"
                        value={producerContactName}
                        onChange={(event) => setProducerContactName(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="producer-phone">Phone</Label>
                      <Input
                        id="producer-phone"
                        value={producerPhone}
                        onChange={(event) => setProducerPhone(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="producer-lead-time">Lead Time (hours)</Label>
                      <Input
                        id="producer-lead-time"
                        type="number"
                        min="1"
                        value={leadTimeHours}
                        onChange={(event) => setLeadTimeHours(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="producer-origin">Farm Origin / Story</Label>
                    <Textarea
                      id="producer-origin"
                      value={farmOriginText}
                      onChange={(event) => setFarmOriginText(event.target.value)}
                      placeholder="Tell customers where your produce comes from."
                    />
                  </div>
                  {renderAddressFields(producerAddressDraft, updateProducerAddressDraft, 'producer-address')}
                </CardContent>
              </Card>
            )}

            {displayRole === 'COMMUNITY' && (
              <Card
                ref={organisationProfileRef}
                className={cn(
                  'transition-colors duration-300',
                  highlightedSection === 'organisation-profile' && 'border-green-500 ring-2 ring-green-200',
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="size-5" />
                    Community Organisation Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="community-organisation-name">Organisation Name</Label>
                      <Input
                        id="community-organisation-name"
                        value={organisationName}
                        onChange={(event) => setOrganisationName(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="community-organisation-type">Organisation Type</Label>
                      <Input
                        id="community-organisation-type"
                        value={organisationType}
                        onChange={(event) => setOrganisationType(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="community-contact-name">Contact Name</Label>
                      <Input
                        id="community-contact-name"
                        value={communityContactName}
                        onChange={(event) => setCommunityContactName(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="community-phone">Phone</Label>
                      <Input
                        id="community-phone"
                        value={communityPhone}
                        onChange={(event) => setCommunityPhone(event.target.value)}
                      />
                    </div>
                  </div>
                  {renderAddressFields(communityAddressDraft, updateCommunityAddressDraft, 'community-address')}
                </CardContent>
              </Card>
            )}

            {displayRole === 'RESTAURANT' && (
              <Card
                ref={deliveryProfileRef}
                className={cn(
                  'transition-colors duration-300',
                  highlightedSection === 'delivery-profile' && 'border-green-500 ring-2 ring-green-200',
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="size-5" />
                    Restaurant Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="restaurant-business-name">Business Name</Label>
                      <Input
                        id="restaurant-business-name"
                        value={restaurantBusinessName}
                        onChange={(event) => setRestaurantBusinessName(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="restaurant-contact-name">Contact Name</Label>
                      <Input
                        id="restaurant-contact-name"
                        value={restaurantContactName}
                        onChange={(event) => setRestaurantContactName(event.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="restaurant-phone">Phone</Label>
                      <Input
                        id="restaurant-phone"
                        value={restaurantPhone}
                        onChange={(event) => setRestaurantPhone(event.target.value)}
                      />
                    </div>
                  </div>
                  {renderAddressFields(restaurantAddressDraft, updateRestaurantAddressDraft, 'restaurant-address')}
                </CardContent>
              </Card>
            )}

            {displayRole === 'ADMIN' && (
              <Card
                ref={adminProfileRef}
                className={cn(
                  'transition-colors duration-300',
                  highlightedSection === 'admin-profile' && 'border-green-500 ring-2 ring-green-200',
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-5" />
                    Admin Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-gray-700">
                  <p>This admin account can access commission reporting and platform controls.</p>
                  <p>Profile editing is intentionally limited because there is no separate admin profile model in the current backend.</p>
                </CardContent>
              </Card>
            )}

            {displayRole !== 'ADMIN' && (
              <div className="flex flex-wrap gap-3">
                <Button onClick={saveAccount} disabled={saving}>
                  <Save className="mr-2 size-4" />
                  {saving ? 'Saving...' : 'Save Account'}
                </Button>
                <Button variant="outline" onClick={() => navigate(getDashboardPathForRole(displayRole))}>
                  Return to Dashboard
                </Button>
                {displayRole === 'CUSTOMER' && (
                  <Button variant="outline" onClick={() => navigate('/orders/history')}>
                    View Order History
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
