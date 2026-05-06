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
import { AddressLookupFields, formatAddressLines } from '../components/AddressLookupFields';
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

function splitFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const tokens = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return { firstName: '', middleName: '', lastName: '' };
  }
  if (tokens.length === 1) {
    return { firstName: tokens[0], middleName: '', lastName: '' };
  }
  if (tokens.length === 2) {
    return { firstName: tokens[0], middleName: '', lastName: tokens[1] };
  }
  return {
    firstName: tokens[0],
    middleName: tokens.slice(1, -1).join(' '),
    lastName: tokens[tokens.length - 1],
  };
}

function composeFullName(firstName: string, middleName: string, lastName: string): string {
  return [firstName, middleName, lastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
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
  const [savingDeliveryProfile, setSavingDeliveryProfile] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState('');

  const [email, setEmail] = useState('');
  const [displayRole, setDisplayRole] = useState<UserRole>('CUSTOMER');
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [preferencesText, setPreferencesText] = useState('');
  const [customerAddressDraft, setCustomerAddressDraft] = useState<AddressDraft>({
    ...EMPTY_ADDRESS_DRAFT,
    label: 'Delivery Address',
  });
  const [defaultAddressId, setDefaultAddressId] = useState('none');

  const [producerBusinessName, setProducerBusinessName] = useState('');
  const [producerContactFirstName, setProducerContactFirstName] = useState('');
  const [producerContactMiddleName, setProducerContactMiddleName] = useState('');
  const [producerContactLastName, setProducerContactLastName] = useState('');
  const [producerPhone, setProducerPhone] = useState('');
  const [farmOriginText, setFarmOriginText] = useState('');
  const [leadTimeHours, setLeadTimeHours] = useState('48');
  const [producerAddressDraft, setProducerAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);

  const [organisationName, setOrganisationName] = useState('');
  const [organisationType, setOrganisationType] = useState('');
  const [communityContactFirstName, setCommunityContactFirstName] = useState('');
  const [communityContactMiddleName, setCommunityContactMiddleName] = useState('');
  const [communityContactLastName, setCommunityContactLastName] = useState('');
  const [communityPhone, setCommunityPhone] = useState('');
  const [communityAddressDraft, setCommunityAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);

  const [restaurantBusinessName, setRestaurantBusinessName] = useState('');
  const [restaurantContactFirstName, setRestaurantContactFirstName] = useState('');
  const [restaurantContactMiddleName, setRestaurantContactMiddleName] = useState('');
  const [restaurantContactLastName, setRestaurantContactLastName] = useState('');
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

  const updateCustomerAddressDraft = (field: keyof AddressDraft, value: string | boolean | number | null) => {
    setCustomerAddressDraft((previous) => ({ ...previous, [field]: value }));
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
        line1: customerAddressDraft.line1.trim(),
        line2: customerAddressDraft.line2.trim(),
        city: customerAddressDraft.city.trim() || existingAddress?.city || inferCityFromAddress(customerAddressDraft.line1),
        postcode: customerAddressDraft.postcode.trim(),
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
    [customerAddressDraft, defaultAddressId],
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
        const parsedName = splitFullName(orderProfile.full_name || asString(profile.full_name));
        setFirstName(asString(profile.first_name) || parsedName.firstName);
        setMiddleName(asString(profile.middle_name) || parsedName.middleName);
        setLastName(asString(profile.last_name) || parsedName.lastName);
        setPhone(orderProfile.phone || asString(profile.phone));
        setAllergiesText(asString(profile.allergies_text));
        setPreferencesText(asString(profile.preferences_text));
        setCustomerAddressDraft({
          id: preferredAddress?.id || null,
          label: preferredAddress?.label || 'Delivery Address',
          line1: preferredAddress?.line1 || orderProfile.delivery_address || '',
          line2: preferredAddress?.line2 || '',
          city: preferredAddress?.city || inferCityFromAddress(preferredAddress?.line1 || orderProfile.delivery_address || ''),
          postcode: preferredAddress?.postcode || orderProfile.postcode || '',
          isDefault: preferredAddress?.is_default ?? true,
        });
        setDefaultAddressId(preferredAddress ? String(preferredAddress.id) : 'none');
      }

      if (nextRole === 'PRODUCER') {
        const addressId = asNumber(profile.address);
        const address = findAddressById(me.addresses, addressId) || me.addresses[0];
        const parsedContactName = splitFullName(asString(profile.contact_name));
        setProducerBusinessName(asString(profile.business_name));
        setProducerContactFirstName(asString(profile.contact_first_name) || parsedContactName.firstName);
        setProducerContactMiddleName(asString(profile.contact_middle_name) || parsedContactName.middleName);
        setProducerContactLastName(asString(profile.contact_last_name) || parsedContactName.lastName);
        setProducerPhone(asString(profile.phone));
        setFarmOriginText(asString(profile.farm_origin_text));
        setLeadTimeHours(String(asNumber(profile.lead_time_hours) || 48));
        setProducerAddressDraft(toAddressDraft(address, 'Business Address'));
      }

      if (nextRole === 'COMMUNITY') {
        const addressId = asNumber(profile.delivery_address);
        const address = findAddressById(me.addresses, addressId) || me.addresses[0];
        const parsedContactName = splitFullName(asString(profile.contact_name));
        setOrganisationName(asString(profile.organisation_name));
        setOrganisationType(asString(profile.org_type));
        setCommunityContactFirstName(asString(profile.contact_first_name) || parsedContactName.firstName);
        setCommunityContactMiddleName(asString(profile.contact_middle_name) || parsedContactName.middleName);
        setCommunityContactLastName(asString(profile.contact_last_name) || parsedContactName.lastName);
        setCommunityPhone(asString(profile.phone));
        setCommunityAddressDraft(toAddressDraft(address, 'Delivery Address'));
      }

      if (nextRole === 'RESTAURANT') {
        const addressId = asNumber(profile.delivery_address);
        const address = findAddressById(me.addresses, addressId) || me.addresses[0];
        const parsedContactName = splitFullName(asString(profile.contact_name));
        setRestaurantBusinessName(asString(profile.business_name));
        setRestaurantContactFirstName(asString(profile.contact_first_name) || parsedContactName.firstName);
        setRestaurantContactMiddleName(asString(profile.contact_middle_name) || parsedContactName.middleName);
        setRestaurantContactLastName(asString(profile.contact_last_name) || parsedContactName.lastName);
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
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error('First name and last name are required.');
        }
        const fullName = composeFullName(firstName, middleName, lastName);
        const syncedDefaultAddressId = await syncCustomerDefaultAddress(addresses);
        const deliveryAddress = formatAddressLines(customerAddressDraft.line1, customerAddressDraft.line2);
        await Promise.all([
          apiJson('/api/accounts/me/', {
            method: 'PATCH',
            body: JSON.stringify({
              profile: {
                full_name: fullName,
                first_name: firstName,
                middle_name: middleName,
                last_name: lastName,
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
              postcode: customerAddressDraft.postcode,
            }),
          }),
        ]);
      } else if (displayRole === 'PRODUCER') {
        if (!producerContactFirstName.trim() || !producerContactLastName.trim()) {
          throw new Error('Contact first name and contact last name are required.');
        }
        const producerContactName = composeFullName(producerContactFirstName, producerContactMiddleName, producerContactLastName);
        const addressId = await upsertAddress(producerAddressDraft, 'Business Address');
        await apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({
            profile: {
              business_name: producerBusinessName,
              contact_name: producerContactName,
              contact_first_name: producerContactFirstName,
              contact_middle_name: producerContactMiddleName,
              contact_last_name: producerContactLastName,
              phone: producerPhone,
              farm_origin_text: farmOriginText,
              lead_time_hours: Number(leadTimeHours) || 48,
              address: addressId,
            },
          }),
        });
      } else if (displayRole === 'COMMUNITY') {
        if (!communityContactFirstName.trim() || !communityContactLastName.trim()) {
          throw new Error('Contact first name and contact last name are required.');
        }
        const communityContactName = composeFullName(communityContactFirstName, communityContactMiddleName, communityContactLastName);
        const addressId = await upsertAddress(communityAddressDraft, 'Delivery Address');
        await apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({
            profile: {
              organisation_name: organisationName,
              org_type: organisationType,
              contact_name: communityContactName,
              contact_first_name: communityContactFirstName,
              contact_middle_name: communityContactMiddleName,
              contact_last_name: communityContactLastName,
              phone: communityPhone,
              delivery_address: addressId,
            },
          }),
        });
      } else if (displayRole === 'RESTAURANT') {
        if (!restaurantContactFirstName.trim() || !restaurantContactLastName.trim()) {
          throw new Error('Contact first name and contact last name are required.');
        }
        const restaurantContactName = composeFullName(restaurantContactFirstName, restaurantContactMiddleName, restaurantContactLastName);
        const addressId = await upsertAddress(restaurantAddressDraft, 'Delivery Address');
        await apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({
            profile: {
              business_name: restaurantBusinessName,
              contact_name: restaurantContactName,
              contact_first_name: restaurantContactFirstName,
              contact_middle_name: restaurantContactMiddleName,
              contact_last_name: restaurantContactLastName,
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

  const saveDeliveryProfile = async () => {
    setSavingDeliveryProfile(true);
    try {
      if (displayRole === 'CUSTOMER') {
        const syncedDefaultAddressId = await syncCustomerDefaultAddress(addresses);
        const deliveryAddress = formatAddressLines(customerAddressDraft.line1, customerAddressDraft.line2);
        await Promise.all([
          apiJson('/api/accounts/me/', {
            method: 'PATCH',
            body: JSON.stringify({
              profile: {
                default_address: syncedDefaultAddressId,
              },
            }),
          }),
          apiJson('/api/orders/profile/', {
            method: 'PUT',
            body: JSON.stringify({
              full_name: composeFullName(firstName, middleName, lastName),
              phone,
              delivery_address: deliveryAddress,
              postcode: customerAddressDraft.postcode,
            }),
          }),
        ]);
      } else if (displayRole === 'PRODUCER') {
        const addressId = await upsertAddress(producerAddressDraft, 'Business Address');
        await apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({ profile: { address: addressId } }),
        });
      } else if (displayRole === 'COMMUNITY') {
        const addressId = await upsertAddress(communityAddressDraft, 'Delivery Address');
        await apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({ profile: { delivery_address: addressId } }),
        });
      } else if (displayRole === 'RESTAURANT') {
        const addressId = await upsertAddress(restaurantAddressDraft, 'Delivery Address');
        await apiJson('/api/accounts/me/', {
          method: 'PATCH',
          body: JSON.stringify({ profile: { delivery_address: addressId } }),
        });
      } else {
        toast.info('Admin accounts do not have a delivery profile.');
        return;
      }

      await getMe().catch(() => undefined);
      await loadProfile();
      toast.success('Delivery profile saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save delivery profile.');
    } finally {
      setSavingDeliveryProfile(false);
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
    options?: { useLookup?: boolean },
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
        <AddressLookupFields
          idPrefix={heading}
          line1={addressDraft.line1}
          line2={addressDraft.line2}
          city={addressDraft.city}
          postcode={addressDraft.postcode}
          onChange={(field, value) => updateAddress(field, value)}
          lookupLabel={options?.useLookup ? 'Find address or postcode' : 'Address lookup'}
        />
      </div>
    </div>
  );

  const renderDeliveryProfileCard = (
    addressDraft: AddressDraft,
    updateAddress: (field: keyof AddressDraft, value: string | boolean | number | null) => void,
    title = 'Delivery Profile',
    idPrefix = 'delivery-profile',
    options?: { useLookup?: boolean },
  ) => (
    <Card
      ref={deliveryProfileRef}
      className={cn(
        'transition-colors duration-300',
        highlightedSection === 'delivery-profile' && 'border-green-500 ring-2 ring-green-200',
      )}
    >
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Save address changes here without changing the rest of the account profile.
          </p>
        </div>
        <Button onClick={saveDeliveryProfile} disabled={savingDeliveryProfile}>
          <Save className="mr-2 size-4" />
          {savingDeliveryProfile ? 'Saving...' : 'Save Delivery Profile'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderAddressFields(addressDraft, updateAddress, idPrefix, options)}
      </CardContent>
    </Card>
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
                        <Label htmlFor="customer-first-name">First Name</Label>
                        <Input
                          id="customer-first-name"
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="customer-middle-name">Middle Name (Optional)</Label>
                        <Input
                          id="customer-middle-name"
                          value={middleName}
                          onChange={(event) => setMiddleName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="customer-last-name">Last Name</Label>
                        <Input
                          id="customer-last-name"
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
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
                          <SelectItem value="none">Create delivery profile</SelectItem>
                          {addresses.map((address) => (
                            <SelectItem key={address.id} value={String(address.id)}>
                              {address.label}: {[address.line1, address.line2, address.city, address.postcode].filter(Boolean).join(', ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {renderDeliveryProfileCard(
                  customerAddressDraft,
                  updateCustomerAddressDraft,
                  'Delivery Profile',
                  'customer-delivery',
                  { useLookup: true },
                )}
              </>
            )}

            {displayRole === 'PRODUCER' && (
              <>
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
                        <Label htmlFor="producer-contact-first-name">Contact First Name</Label>
                        <Input
                          id="producer-contact-first-name"
                          value={producerContactFirstName}
                          onChange={(event) => setProducerContactFirstName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="producer-contact-middle-name">Contact Middle Name (Optional)</Label>
                        <Input
                          id="producer-contact-middle-name"
                          value={producerContactMiddleName}
                          onChange={(event) => setProducerContactMiddleName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="producer-contact-last-name">Contact Last Name</Label>
                        <Input
                          id="producer-contact-last-name"
                          value={producerContactLastName}
                          onChange={(event) => setProducerContactLastName(event.target.value)}
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
                  </CardContent>
                </Card>
                {renderDeliveryProfileCard(producerAddressDraft, updateProducerAddressDraft, 'Delivery Profile', 'producer-delivery', {
                  useLookup: true,
                })}
              </>
            )}

            {displayRole === 'COMMUNITY' && (
              <>
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
                        <Label htmlFor="community-contact-first-name">Contact First Name</Label>
                        <Input
                          id="community-contact-first-name"
                          value={communityContactFirstName}
                          onChange={(event) => setCommunityContactFirstName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="community-contact-middle-name">Contact Middle Name (Optional)</Label>
                        <Input
                          id="community-contact-middle-name"
                          value={communityContactMiddleName}
                          onChange={(event) => setCommunityContactMiddleName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="community-contact-last-name">Contact Last Name</Label>
                        <Input
                          id="community-contact-last-name"
                          value={communityContactLastName}
                          onChange={(event) => setCommunityContactLastName(event.target.value)}
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
                  </CardContent>
                </Card>
                {renderDeliveryProfileCard(communityAddressDraft, updateCommunityAddressDraft, 'Delivery Profile', 'community-delivery', {
                  useLookup: true,
                })}
              </>
            )}

            {displayRole === 'RESTAURANT' && (
              <>
                <Card>
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
                        <Label htmlFor="restaurant-contact-first-name">Contact First Name</Label>
                        <Input
                          id="restaurant-contact-first-name"
                          value={restaurantContactFirstName}
                          onChange={(event) => setRestaurantContactFirstName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="restaurant-contact-middle-name">Contact Middle Name (Optional)</Label>
                        <Input
                          id="restaurant-contact-middle-name"
                          value={restaurantContactMiddleName}
                          onChange={(event) => setRestaurantContactMiddleName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="restaurant-contact-last-name">Contact Last Name</Label>
                        <Input
                          id="restaurant-contact-last-name"
                          value={restaurantContactLastName}
                          onChange={(event) => setRestaurantContactLastName(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="restaurant-phone">Phone</Label>
                        <Input
                          id="restaurant-phone"
                          value={restaurantPhone}
                          onChange={(event) => setRestaurantPhone(event.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {renderDeliveryProfileCard(restaurantAddressDraft, updateRestaurantAddressDraft, 'Delivery Profile', 'restaurant-delivery', {
                  useLookup: true,
                })}
              </>
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
