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

export function getRoleLabel(role?: UserRole | null): string {
  switch (role) {
    case 'PRODUCER':
      return 'Producer';
    case 'COMMUNITY':
      return 'Community';
    case 'RESTAURANT':
      return 'Restaurant';
    case 'ADMIN':
      return 'Admin';
    case 'CUSTOMER':
    default:
      return 'Customer';
  }
}

export function getProfileAddressId(role?: UserRole | null, profile?: Record<string, unknown> | null): number | null {
  if (!role || !profile) {
    return null;
  }

  if (role === 'CUSTOMER') {
    return asNumber(profile.default_address);
  }

  if (role === 'PRODUCER') {
    return asNumber(profile.address);
  }

  if (role === 'COMMUNITY' || role === 'RESTAURANT') {
    return asNumber(profile.delivery_address);
  }

  return null;
}

export function getPreferredAddress(
  role?: UserRole | null,
  profile?: Record<string, unknown> | null,
  addresses: AddressRecord[] = [],
): AddressRecord | null {
  const profileAddressId = getProfileAddressId(role, profile);
  if (profileAddressId) {
    const profileAddress = addresses.find((address) => address.id === profileAddressId);
    if (profileAddress) {
      return profileAddress;
    }
  }

  return addresses.find((address) => address.is_default) || addresses[0] || null;
}

export function getPreferredPostcode(
  role?: UserRole | null,
  profile?: Record<string, unknown> | null,
  addresses: AddressRecord[] = [],
): string {
  return getPreferredAddress(role, profile, addresses)?.postcode || '';
}

export function formatDisplayPostcode(postcode: string | null | undefined): string {
  return (postcode || '').trim().toUpperCase();
}
