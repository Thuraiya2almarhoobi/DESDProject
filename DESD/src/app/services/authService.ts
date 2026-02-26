import apiClient from '../lib/apiClient';
import {
  clearAuthStorage,
  getStoredRole,
  setAuthTokens,
  setStoredRole,
} from '../lib/tokenStorage';
import { UserRole } from '../types';

export interface AuthUserPayload {
  id: number;
  email: string;
  role: UserRole;
}

export interface AuthTokensPayload {
  access: string;
  refresh: string;
  user: AuthUserPayload;
}

export interface MePayload {
  user: AuthUserPayload;
  profile: Record<string, unknown> | null;
  addresses: Array<{
    id: number;
    label: string;
    line1: string;
    line2: string;
    city: string;
    postcode: string;
    is_default: boolean;
  }>;
}

export interface CustomerRegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  full_name: string;
  phone: string;
  delivery_address: string;
  postcode: string;
  accept_terms: boolean;
}

export interface ProducerRegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  business_name: string;
  contact_name: string;
  phone: string;
  business_address: string;
  postcode: string;
}

export interface CommunityRegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  organisation_name: string;
  org_type: string;
  contact_name: string;
  phone: string;
}

export interface RestaurantRegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  business_name: string;
  contact_name: string;
  phone: string;
}

function persistTokens(payload: AuthTokensPayload): void {
  setAuthTokens(payload.access, payload.refresh);
  setStoredRole(payload.user.role);
}

async function postAuthPayload<TPayload>(url: string, payload: TPayload): Promise<AuthTokensPayload> {
  const response = await apiClient.post<AuthTokensPayload>(url, payload);
  persistTokens(response.data);
  return response.data;
}

export function getStoredUserRole(): string | null {
  return getStoredRole();
}

export function logout(): void {
  clearAuthStorage();
}

export async function login(email: string, password: string): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/login/', { email, password });
}

export async function registerCustomer(payload: CustomerRegisterPayload): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/register/customer/', payload);
}

export async function registerProducer(payload: ProducerRegisterPayload): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/register/producer/', payload);
}

export async function registerCommunity(payload: CommunityRegisterPayload): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/register/community/', payload);
}

export async function registerRestaurant(payload: RestaurantRegisterPayload): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/register/restaurant/', payload);
}

export async function getMe(): Promise<MePayload> {
  const response = await apiClient.get<MePayload>('/accounts/me/');
  return response.data;
}
