/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the RoleRegisterPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { PublicPortalShell } from '../../components/portal/PublicPortalShell';
import { AddressLookupFields, formatAddressLines } from '../../components/AddressLookupFields';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { isValidEmail, isValidPhone, validateRequiredText } from '../../lib/formValidation';
import { getPortalDefinition, SelfServiceRole } from '../../lib/portalConfig';

/**
 * PASSWORD_MIN_LENGTH boundary.
 *
 * This exported unit supports the file role: Implements the RoleRegisterPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const PASSWORD_MIN_LENGTH = 10;

interface RoleRegisterPageProps {
  role: SelfServiceRole;
}

type PasswordStrength = 'Weak' | 'Medium' | 'Strong';
type DraftAddress = { line1: string; line2: string; city: string; postcode: string };

const EMPTY_ADDRESS: DraftAddress = { line1: '', line2: '', city: '', postcode: '' };

function composeName(firstName: string, middleName: string, lastName: string): string {
  return [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

const registrationSupportItems: Record<SelfServiceRole, string[]> = {
  CUSTOMER: ['A delivery address and postcode', 'A phone number for order updates', 'Agreement to marketplace terms'],
  PRODUCER: ['Business and contact names', 'A business address and postcode', 'A phone number for order coordination'],
  COMMUNITY: ['Organisation name and type', 'A delivery address and postcode', 'A contact person for group orders'],
  RESTAURANT: ['Business and contact names', 'A delivery address and postcode', 'A phone number for supply coordination'],
};

const registrationSupportSteps: Record<SelfServiceRole, string[]> = {
  CUSTOMER: [
    'Your customer profile is created for marketplace browsing and checkout.',
    'Saved delivery details are used to prepare future local orders faster.',
    'Order history and fulfilment updates stay connected to this account.',
  ],
  PRODUCER: [
    'Your producer account is prepared for stock, listings, and order management.',
    'Business details help customers understand who is supplying each product.',
    'Once approved, you can manage inventory and fulfilment from the producer workspace.',
  ],
  COMMUNITY: [
    'Your organisation profile is created for coordinated local-food ordering.',
    'Delivery and contact details keep group fulfilment clear for every order.',
    'Bulk order activity stays connected to the same community account.',
  ],
  RESTAURANT: [
    'Your restaurant profile is prepared for repeat supplier ordering.',
    'Delivery details support kitchen planning and scheduled supply runs.',
    'Future templates and order history stay tied to this business account.',
  ],
};

const registrationSupportHighlights: Record<SelfServiceRole, string[]> = {
  CUSTOMER: ['Browse local produce faster', 'Reuse saved delivery details', 'Track orders and manage reviews'],
  PRODUCER: ['Launch your producer workspace', 'Manage listings and stock', 'Receive order and payout updates'],
  COMMUNITY: ['Coordinate bulk local orders', 'Keep delivery contacts organised', 'Review fulfilment in one place'],
  RESTAURANT: ['Set up repeat supplier orders', 'Keep kitchen delivery details ready', 'Review upcoming order activity'],
};

export function RoleRegisterPage({ role }: RoleRegisterPageProps) {
  const definition = getPortalDefinition(role);
  const navigate = useNavigate();
  const { logout, registerCommunity, registerCustomer, registerProducer, registerRestaurant } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState<DraftAddress>(EMPTY_ADDRESS);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [producerContactFirstName, setProducerContactFirstName] = useState('');
  const [producerContactMiddleName, setProducerContactMiddleName] = useState('');
  const [producerContactLastName, setProducerContactLastName] = useState('');
  const [communityContactFirstName, setCommunityContactFirstName] = useState('');
  const [communityContactMiddleName, setCommunityContactMiddleName] = useState('');
  const [communityContactLastName, setCommunityContactLastName] = useState('');
  const [restaurantContactFirstName, setRestaurantContactFirstName] = useState('');
  const [restaurantContactMiddleName, setRestaurantContactMiddleName] = useState('');
  const [restaurantContactLastName, setRestaurantContactLastName] = useState('');
  const [producerAddress, setProducerAddress] = useState<DraftAddress>(EMPTY_ADDRESS);
  const [organisationName, setOrganisationName] = useState('');
  const [orgType, setOrgType] = useState('');
  const [communityAddress, setCommunityAddress] = useState<DraftAddress>(EMPTY_ADDRESS);
  const [restaurantAddress, setRestaurantAddress] = useState<DraftAddress>(EMPTY_ADDRESS);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordFeedbackVisible = password.length > 0;
  const confirmPasswordFeedbackVisible = confirmPassword.length > 0;

  const passwordChecks = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordMatch = password.length > 0 && password === confirmPassword;
  const currentPhoneValid = !phone.trim() || isValidPhone(phone);
  const currentEmailValid = !email.trim() || isValidEmail(email);
  const passwordStrength: PasswordStrength = !Object.values(passwordChecks).every(Boolean)
    ? 'Weak'
    : password.length >= 12 && new Set(password).size >= 8
      ? 'Strong'
      : 'Medium';
  const strengthClassName =
    passwordStrength === 'Strong'
      ? 'text-green-700'
      : passwordStrength === 'Medium'
        ? 'text-amber-700'
        : 'text-red-700';

  const isRoleFieldsValid =
    role === 'CUSTOMER'
      ? Boolean(email && firstName && lastName && phone && customerAddress.line1 && customerAddress.postcode)
      : role === 'PRODUCER'
        ? Boolean(
            email &&
              businessName &&
              producerContactFirstName &&
              producerContactLastName &&
              phone &&
              producerAddress.line1 &&
              producerAddress.postcode,
          )
        : role === 'COMMUNITY'
          ? Boolean(
              email &&
                organisationName &&
                orgType &&
                communityContactFirstName &&
                communityContactLastName &&
                phone &&
                communityAddress.line1 &&
                communityAddress.postcode,
            )
          : Boolean(
              email &&
                businessName &&
                restaurantContactFirstName &&
                restaurantContactLastName &&
                phone &&
                restaurantAddress.line1 &&
                restaurantAddress.postcode,
            );

  const canSubmit =
    Object.values(passwordChecks).every(Boolean) &&
    passwordMatch &&
    isRoleFieldsValid &&
    currentEmailValid &&
    currentPhoneValid &&
    acceptTerms &&
    !submitting;

  const renderPasswordRule = (label: string, passed: boolean) => (
    <div className={`flex items-center gap-2 text-xs ${passed ? 'text-green-700' : 'text-[oklch(0.38_0.03_145)]'}`}>
      {passed ? <CheckCircle2 className="size-4" /> : <span className="size-4 rounded-full border border-[#cbd6c8]" />}
      <span>{label}</span>
    </div>
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!Object.values(passwordChecks).every(Boolean)) {
      setError('Password must satisfy all required security rules.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Enter a valid email address, for example name@example.com.');
      return;
    }

    if (!isValidPhone(phone)) {
      setError('Enter a valid UK phone number, for example 07123 456789 or +44 7123 456789.');
      return;
    }

    const nameError =
      role === 'CUSTOMER'
        ? validateRequiredText(firstName, 'First name') || validateRequiredText(lastName, 'Last name')
        : role === 'PRODUCER'
          ? validateRequiredText(businessName, 'Business name', 3) ||
            validateRequiredText(producerContactFirstName, 'Contact first name') ||
            validateRequiredText(producerContactLastName, 'Contact last name')
          : role === 'COMMUNITY'
            ? validateRequiredText(organisationName, 'Organisation name', 3) ||
              validateRequiredText(orgType, 'Organisation type', 3) ||
              validateRequiredText(communityContactFirstName, 'Contact first name') ||
              validateRequiredText(communityContactLastName, 'Contact last name')
            : validateRequiredText(businessName, 'Business name', 3) ||
              validateRequiredText(restaurantContactFirstName, 'Contact first name') ||
              validateRequiredText(restaurantContactLastName, 'Contact last name');
    if (nameError) {
      setError(nameError);
      return;
    }

    if (!passwordMatch) {
      setError('Password confirmation does not match.');
      return;
    }

    if (!isRoleFieldsValid) {
      setError('Complete the required account and address fields before creating the account.');
      return;
    }

    if (!acceptTerms) {
      setError('You must accept the Terms and Conditions and Privacy Policy before creating an account.');
      return;
    }

    setSubmitting(true);

    const result =
      role === 'CUSTOMER'
        ? await registerCustomer({
            email,
            password,
            confirm_password: confirmPassword,
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            phone,
            delivery_address: formatAddressLines(customerAddress.line1, customerAddress.line2),
            delivery_address_line1: customerAddress.line1,
            delivery_address_line2: customerAddress.line2,
            postcode: customerAddress.postcode,
            accept_terms: acceptTerms,
          })
        : role === 'PRODUCER'
          ? await registerProducer({
              email,
              password,
              confirm_password: confirmPassword,
              business_name: businessName,
              contact_name: composeName(producerContactFirstName, producerContactMiddleName, producerContactLastName),
              contact_first_name: producerContactFirstName,
              contact_middle_name: producerContactMiddleName,
              contact_last_name: producerContactLastName,
              phone,
              business_address: formatAddressLines(producerAddress.line1, producerAddress.line2),
              business_address_line1: producerAddress.line1,
              business_address_line2: producerAddress.line2,
              postcode: producerAddress.postcode,
            })
          : role === 'COMMUNITY'
            ? await registerCommunity({
                email,
                password,
                confirm_password: confirmPassword,
                organisation_name: organisationName,
                org_type: orgType,
                contact_name: composeName(communityContactFirstName, communityContactMiddleName, communityContactLastName),
                contact_first_name: communityContactFirstName,
                contact_middle_name: communityContactMiddleName,
                contact_last_name: communityContactLastName,
                phone,
                delivery_address: formatAddressLines(communityAddress.line1, communityAddress.line2),
                delivery_address_line1: communityAddress.line1,
                delivery_address_line2: communityAddress.line2,
                postcode: communityAddress.postcode,
              })
            : await registerRestaurant({
                email,
                password,
                confirm_password: confirmPassword,
                business_name: businessName,
                contact_name: composeName(restaurantContactFirstName, restaurantContactMiddleName, restaurantContactLastName),
                contact_first_name: restaurantContactFirstName,
                contact_middle_name: restaurantContactMiddleName,
                contact_last_name: restaurantContactLastName,
                phone,
                delivery_address: formatAddressLines(restaurantAddress.line1, restaurantAddress.line2),
                delivery_address_line1: restaurantAddress.line1,
                delivery_address_line2: restaurantAddress.line2,
                postcode: restaurantAddress.postcode,
              });

    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    const successMessage = result.message?.toLowerCase().includes('verify')
      ? 'Account created successfully. Please log in. Check your email to verify.'
      : 'Account created successfully. Please log in.';

    logout();
    toast.success(successMessage);
    navigate(definition.loginPath, {
      replace: true,
      state: { message: successMessage },
    });
  };

  return (
    <PublicPortalShell
      title={definition.registerHeading ?? 'Create account'}
      description={definition.registerDescription ?? 'Complete the registration form for this stakeholder role.'}
      accentClassName={definition.accentClassName}
      backHref="/select-portal?mode=register"
      backLabel="Back to Portal"
      insight={definition.highlight}
      supportItems={registrationSupportItems[role]}
      supportSteps={registrationSupportSteps[role]}
      supportHighlights={registrationSupportHighlights[role]}
    >
      <div className="portal-register-form space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${role}-register-email`}>Email</Label>
            <Input
              id={`${role}-register-email`}
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={email.length > 0 && !currentEmailValid}
              required
            />
            {email.length > 0 && !currentEmailValid ? (
              <p className="text-xs text-red-700">Enter a valid email address.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${role}-register-password`}>Password</Label>
            <div className="relative">
              <Input
                id={`${role}-register-password`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-11"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {passwordFeedbackVisible ? (
              <>
                <p className={`text-sm font-medium ${strengthClassName}`}>Strength: {passwordStrength}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {renderPasswordRule(`At least ${PASSWORD_MIN_LENGTH} characters`, passwordChecks.minLength)}
                  {renderPasswordRule('One uppercase letter', passwordChecks.uppercase)}
                  {renderPasswordRule('One lowercase letter', passwordChecks.lowercase)}
                  {renderPasswordRule('One number', passwordChecks.number)}
                  {renderPasswordRule('One special character', passwordChecks.special)}
                </div>
              </>
            ) : (
              <p className="text-xs text-[#6a786c]">Start typing to see password strength guidance.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${role}-register-confirm-password`}>Confirm Password</Label>
            <div className="relative">
              <Input
                id={`${role}-register-confirm-password`}
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="pr-11"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                aria-pressed={showConfirmPassword}
                onClick={() => setShowConfirmPassword((current) => !current)}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {confirmPasswordFeedbackVisible && !passwordMatch ? (
              <p className="text-xs text-red-700">Passwords do not match.</p>
            ) : null}
          </div>

          {role === 'CUSTOMER' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="customer-first-name">First Name</Label>
                <Input
                  id="customer-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-middle-name">Middle Name (Optional)</Label>
                <Input
                  id="customer-middle-name"
                  value={middleName}
                  onChange={(event) => setMiddleName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-last-name">Last Name</Label>
                <Input
                  id="customer-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={phone.length > 0 && !currentPhoneValid}
                  required
                />
                {phone.length > 0 && !currentPhoneValid ? (
                  <p className="text-xs text-red-700">Enter a valid UK phone number.</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <AddressLookupFields
                  idPrefix="customer-address"
                  line1={customerAddress.line1}
                  line2={customerAddress.line2}
                  city={customerAddress.city}
                  postcode={customerAddress.postcode}
                  onChange={(field, value) => setCustomerAddress((previous) => ({ ...previous, [field]: value }))}
                  lookupLabel="Find delivery address or postcode"
                  required
                />
              </div>
            </>
          ) : null}

          {role === 'PRODUCER' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="producer-business-name">Business Name</Label>
                <Input
                  id="producer-business-name"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producer-contact-first-name">Contact First Name</Label>
                <Input
                  id="producer-contact-first-name"
                  value={producerContactFirstName}
                  onChange={(event) => setProducerContactFirstName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producer-contact-middle-name">Contact Middle Name (Optional)</Label>
                <Input
                  id="producer-contact-middle-name"
                  value={producerContactMiddleName}
                  onChange={(event) => setProducerContactMiddleName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producer-contact-last-name">Contact Last Name</Label>
                <Input
                  id="producer-contact-last-name"
                  value={producerContactLastName}
                  onChange={(event) => setProducerContactLastName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producer-phone">Phone</Label>
                <Input
                  id="producer-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={phone.length > 0 && !currentPhoneValid}
                  required
                />
                {phone.length > 0 && !currentPhoneValid ? (
                  <p className="text-xs text-red-700">Enter a valid UK phone number.</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <AddressLookupFields
                  idPrefix="producer-address"
                  line1={producerAddress.line1}
                  line2={producerAddress.line2}
                  city={producerAddress.city}
                  postcode={producerAddress.postcode}
                  onChange={(field, value) => setProducerAddress((previous) => ({ ...previous, [field]: value }))}
                  lookupLabel="Find business address or postcode"
                  required
                />
              </div>
            </>
          ) : null}

          {role === 'COMMUNITY' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="community-organisation-name">Organisation Name</Label>
                <Input
                  id="community-organisation-name"
                  value={organisationName}
                  onChange={(event) => setOrganisationName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="community-org-type">Organisation Type</Label>
                <Input
                  id="community-org-type"
                  value={orgType}
                  onChange={(event) => setOrgType(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="community-contact-first-name">Contact First Name</Label>
                <Input
                  id="community-contact-first-name"
                  value={communityContactFirstName}
                  onChange={(event) => setCommunityContactFirstName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="community-contact-middle-name">Contact Middle Name (Optional)</Label>
                <Input
                  id="community-contact-middle-name"
                  value={communityContactMiddleName}
                  onChange={(event) => setCommunityContactMiddleName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="community-contact-last-name">Contact Last Name</Label>
                <Input
                  id="community-contact-last-name"
                  value={communityContactLastName}
                  onChange={(event) => setCommunityContactLastName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="community-phone">Phone</Label>
                <Input
                  id="community-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={phone.length > 0 && !currentPhoneValid}
                  required
                />
                {phone.length > 0 && !currentPhoneValid ? (
                  <p className="text-xs text-red-700">Enter a valid UK phone number.</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <AddressLookupFields
                  idPrefix="community-address"
                  line1={communityAddress.line1}
                  line2={communityAddress.line2}
                  city={communityAddress.city}
                  postcode={communityAddress.postcode}
                  onChange={(field, value) => setCommunityAddress((previous) => ({ ...previous, [field]: value }))}
                  lookupLabel="Find delivery address or postcode"
                  required
                />
              </div>
            </>
          ) : null}

          {role === 'RESTAURANT' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="restaurant-business-name">Business Name</Label>
                <Input
                  id="restaurant-business-name"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant-contact-first-name">Contact First Name</Label>
                <Input
                  id="restaurant-contact-first-name"
                  value={restaurantContactFirstName}
                  onChange={(event) => setRestaurantContactFirstName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant-contact-middle-name">Contact Middle Name (Optional)</Label>
                <Input
                  id="restaurant-contact-middle-name"
                  value={restaurantContactMiddleName}
                  onChange={(event) => setRestaurantContactMiddleName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant-contact-last-name">Contact Last Name</Label>
                <Input
                  id="restaurant-contact-last-name"
                  value={restaurantContactLastName}
                  onChange={(event) => setRestaurantContactLastName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant-phone">Phone</Label>
                <Input
                  id="restaurant-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={phone.length > 0 && !currentPhoneValid}
                  required
                />
                {phone.length > 0 && !currentPhoneValid ? (
                  <p className="text-xs text-red-700">Enter a valid UK phone number.</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <AddressLookupFields
                  idPrefix="restaurant-address"
                  line1={restaurantAddress.line1}
                  line2={restaurantAddress.line2}
                  city={restaurantAddress.city}
                  postcode={restaurantAddress.postcode}
                  onChange={(field, value) => setRestaurantAddress((previous) => ({ ...previous, [field]: value }))}
                  lookupLabel="Find delivery address or postcode"
                  required
                />
              </div>
            </>
          ) : null}

          <div className="space-y-3 rounded-2xl border border-[color-mix(in_srgb,var(--forest-green)_16%,white)] bg-[color-mix(in_srgb,var(--forest-green)_4%,white)] p-4">
            <div className="flex items-start gap-3 text-sm leading-6 text-[oklch(0.32_0.03_145)]">
              <input
                id={`${role}-accept-terms`}
                type="checkbox"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                className="mt-1"
              />
              <span>
                <label htmlFor={`${role}-accept-terms`}>I accept the </label>
                <Link
                  to="/terms"
                  className="font-semibold text-[var(--forest-green)] underline underline-offset-4 hover:text-[oklch(0.28_0.06_140)]"
                >
                  Terms and Conditions
                </Link>
                {' '}and{' '}
                <Link
                  to="/privacy"
                  className="font-semibold text-[var(--forest-green)] underline underline-offset-4 hover:text-[oklch(0.28_0.06_140)]"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </div>
          </div>

          <div className="grid gap-3 pt-2">
            <Button type="submit" size="lg" disabled={!canSubmit}>
              {submitting ? 'Creating account...' : definition.registerButtonLabel}
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to="/select-portal?mode=register">Back to Portal</Link>
            </Button>
          </div>
        </form>
      </div>
    </PublicPortalShell>
  );
}
