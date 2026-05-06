/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the RegisterPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { AddressLookupFields, formatAddressLines } from '../components/AddressLookupFields';
import { MarketingAuthNav } from '../components/MarketingAuthNav';
import { useAuth } from '../contexts/AuthContext';
import { isValidEmail, isValidPhone, validateRequiredText } from '../lib/formValidation';
import { UserRole } from '../types';
import '../../styles/marketing-auth.css';

type RegisterRole = Exclude<UserRole, 'ADMIN'>;

/**
 * PASSWORD_MIN_LENGTH boundary.
 *
 * This exported unit supports the file role: Implements the RegisterPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const PASSWORD_MIN_LENGTH = 10;

const roleOptions: Array<{ value: RegisterRole; label: string; icon: string; description: string }> = [
  { value: 'CUSTOMER', label: 'Customer', icon: '\u{1F6D2}', description: 'Shop fresh local products' },
  { value: 'PRODUCER', label: 'Producer', icon: '\u{1F33E}', description: 'Sell your local produce' },
  { value: 'COMMUNITY', label: 'Community', icon: '\u{1F465}', description: 'Coordinate bulk orders' },
  { value: 'RESTAURANT', label: 'Restaurant', icon: '\u{1F3EA}', description: 'Source for your kitchen' },
];

const registerRoles = roleOptions.map((option) => option.value);

function isRegisterRole(value: string): value is RegisterRole {
  return registerRoles.includes(value as RegisterRole);
}

type PasswordStrength = 'Weak' | 'Medium' | 'Strong';
type DraftAddress = { line1: string; line2: string; city: string; postcode: string };
const EMPTY_ADDRESS: DraftAddress = { line1: '', line2: '', city: '', postcode: '' };

function composeName(firstName: string, middleName: string, lastName: string): string {
  return [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

/**
 * RegisterPage boundary.
 *
 * This exported unit supports the file role: Implements the RegisterPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { registerCommunity, registerCustomer, registerProducer, registerRestaurant } = useAuth();

  const [role, setRole] = useState<RegisterRole>('CUSTOMER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState<DraftAddress>(EMPTY_ADDRESS);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [producerContactFirstName, setProducerContactFirstName] = useState('');
  const [producerContactMiddleName, setProducerContactMiddleName] = useState('');
  const [producerContactLastName, setProducerContactLastName] = useState('');
  const [producerPhone, setProducerPhone] = useState('');
  const [producerAddress, setProducerAddress] = useState<DraftAddress>(EMPTY_ADDRESS);
  const [organisationName, setOrganisationName] = useState('');
  const [orgType, setOrgType] = useState('');
  const [communityContactFirstName, setCommunityContactFirstName] = useState('');
  const [communityContactMiddleName, setCommunityContactMiddleName] = useState('');
  const [communityContactLastName, setCommunityContactLastName] = useState('');
  const [restaurantContactFirstName, setRestaurantContactFirstName] = useState('');
  const [restaurantContactMiddleName, setRestaurantContactMiddleName] = useState('');
  const [restaurantContactLastName, setRestaurantContactLastName] = useState('');
  const [sharedPhone, setSharedPhone] = useState('');
  const [communityAddress, setCommunityAddress] = useState<DraftAddress>(EMPTY_ADDRESS);
  const [restaurantAddress, setRestaurantAddress] = useState<DraftAddress>(EMPTY_ADDRESS);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const requestedRole = (searchParams.get('role') || '').toUpperCase();
    if (requestedRole && isRegisterRole(requestedRole)) {
      setRole(requestedRole);
    }
  }, [searchParams]);

  const passwordChecks = useMemo(() => {
    return {
      minLength: password.length >= PASSWORD_MIN_LENGTH,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const passwordStrength = useMemo<PasswordStrength>(() => {
    const meetsRequiredRules = Object.values(passwordChecks).every(Boolean);
    const extraEntropy = new Set(password).size >= 8;
    if (!meetsRequiredRules) {
      return 'Weak';
    }
    if (password.length >= 12 && extraEntropy) {
      return 'Strong';
    }
    return 'Medium';
  }, [password, passwordChecks]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const passwordMatch = password.length > 0 && password === confirmPassword;
  const activePhone = role === 'CUSTOMER' ? customerPhone : role === 'PRODUCER' ? producerPhone : sharedPhone;
  const emailValid = !email.trim() || isValidEmail(email);
  const phoneValid = !activePhone.trim() || isValidPhone(activePhone);
  const canSubmit =
    isPasswordValid &&
    passwordMatch &&
    emailValid &&
    phoneValid &&
    (role !== 'CUSTOMER' || acceptTerms) &&
    !loading &&
    !registrationComplete;
  const passwordFeedbackVisible = password.length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!isPasswordValid) {
      setError('Password must satisfy all required security rules.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Enter a valid email address, for example name@example.com.');
      return;
    }

    if (!isValidPhone(activePhone)) {
      setError('Enter a valid UK phone number, for example 07123 456789 or +44 7123 456789.');
      return;
    }

    if (!passwordMatch) {
      setError('Password confirmation does not match.');
      return;
    }

    const nameError =
      role === 'CUSTOMER'
        ? validateRequiredText(firstName, 'First name') || validateRequiredText(lastName, 'Last name')
        : role === 'PRODUCER'
          ? validateRequiredText(businessName, 'Business name') ||
            validateRequiredText(producerContactFirstName, 'Contact first name') ||
            validateRequiredText(producerContactLastName, 'Contact last name')
          : role === 'COMMUNITY'
            ? validateRequiredText(organisationName, 'Organisation name') ||
              validateRequiredText(orgType, 'Organisation type') ||
              validateRequiredText(communityContactFirstName, 'Contact first name') ||
              validateRequiredText(communityContactLastName, 'Contact last name')
            : validateRequiredText(businessName, 'Business name') ||
              validateRequiredText(restaurantContactFirstName, 'Contact first name') ||
              validateRequiredText(restaurantContactLastName, 'Contact last name');
    if (nameError) {
      setError(nameError);
      return;
    }

    if (role === 'CUSTOMER' && !acceptTerms) {
      setError('You must accept terms and conditions.');
      return;
    }

    setLoading(true);

    let result;

    if (role === 'CUSTOMER') {
      result = await registerCustomer({
        email,
        password,
        confirm_password: confirmPassword,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        phone: customerPhone,
        delivery_address: formatAddressLines(customerAddress.line1, customerAddress.line2),
        delivery_address_line1: customerAddress.line1,
        delivery_address_line2: customerAddress.line2,
        postcode: customerAddress.postcode,
        accept_terms: acceptTerms,
      });
    } else if (role === 'PRODUCER') {
      result = await registerProducer({
        email,
        password,
        confirm_password: confirmPassword,
        business_name: businessName,
        contact_name: composeName(producerContactFirstName, producerContactMiddleName, producerContactLastName),
        contact_first_name: producerContactFirstName,
        contact_middle_name: producerContactMiddleName,
        contact_last_name: producerContactLastName,
        phone: producerPhone,
        business_address: formatAddressLines(producerAddress.line1, producerAddress.line2),
        business_address_line1: producerAddress.line1,
        business_address_line2: producerAddress.line2,
        postcode: producerAddress.postcode,
      });
    } else if (role === 'COMMUNITY') {
      result = await registerCommunity({
        email,
        password,
        confirm_password: confirmPassword,
        organisation_name: organisationName,
        org_type: orgType,
        contact_name: composeName(communityContactFirstName, communityContactMiddleName, communityContactLastName),
        contact_first_name: communityContactFirstName,
        contact_middle_name: communityContactMiddleName,
        contact_last_name: communityContactLastName,
        phone: sharedPhone,
        delivery_address: formatAddressLines(communityAddress.line1, communityAddress.line2),
        delivery_address_line1: communityAddress.line1,
        delivery_address_line2: communityAddress.line2,
        postcode: communityAddress.postcode,
      });
    } else {
      result = await registerRestaurant({
        email,
        password,
        confirm_password: confirmPassword,
        business_name: businessName,
        contact_name: composeName(restaurantContactFirstName, restaurantContactMiddleName, restaurantContactLastName),
        contact_first_name: restaurantContactFirstName,
        contact_middle_name: restaurantContactMiddleName,
        contact_last_name: restaurantContactLastName,
        phone: sharedPhone,
        delivery_address: formatAddressLines(restaurantAddress.line1, restaurantAddress.line2),
        delivery_address_line1: restaurantAddress.line1,
        delivery_address_line2: restaurantAddress.line2,
        postcode: restaurantAddress.postcode,
      });
    }

    if (result.success) {
      const message = result.message || 'Registration successful. Please check your email to verify your account.';
      setRegistrationComplete(true);
      setSuccessMessage(message);
      toast.success(message);
    } else {
      setRegistrationComplete(false);
      setError(result.error);
    }

    setLoading(false);
  };

  const strengthClassName =
    passwordStrength === 'Strong'
      ? 'lfm-password-strength lfm-strength-strong'
      : passwordStrength === 'Medium'
        ? 'lfm-password-strength lfm-strength-medium'
        : 'lfm-password-strength lfm-strength-weak';

  const renderPasswordRule = (label: string, passed: boolean) => (
    <div className={passed ? 'lfm-password-rule-ok' : 'lfm-password-rule-miss'}>
      {passed ? '[x]' : '[ ]'} {label}
    </div>
  );

  return (
    <div className="lfm-auth-page">
      <MarketingAuthNav active="register" />

      <main className="lfm-auth-main">
        <section className="lfm-modal-panel lfm-modal-panel-wide" aria-labelledby="register-title">
          <h1 id="register-title" className="lfm-modal-title">
            Join Us
          </h1>
          <p className="lfm-modal-subtitle">Choose your role to get started.</p>

          {error && <div className="lfm-alert lfm-alert-error">{error}</div>}
          {successMessage && <div className="lfm-alert lfm-alert-success">{successMessage}</div>}

          <form className="lfm-login-form" onSubmit={handleSubmit}>
            <div>
              <div className="lfm-role-selector-grid">
                {roleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`lfm-role-selector${role === option.value ? ' active' : ''}`}
                    onClick={() => setRole(option.value)}
                  >
                    <div className="role-icon" aria-hidden="true">
                      {option.icon}
                    </div>
                    <h4>{option.label}</h4>
                    <p>{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="lfm-register-grid">
              <div className="lfm-form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={email.length > 0 && !emailValid}
                  required
                />
                {email.length > 0 && !emailValid && (
                  <span className="lfm-password-rule-miss">Enter a valid email address.</span>
                )}
              </div>

              <div className="lfm-form-group">
                <label htmlFor="password">Password</label>
                <div className="lfm-password-field">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="lfm-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwordFeedbackVisible ? (
                  <>
                    <p className={strengthClassName}>Strength: {passwordStrength}</p>
                    <div className="lfm-password-rules">
                      {renderPasswordRule(`At least ${PASSWORD_MIN_LENGTH} characters`, passwordChecks.minLength)}
                      {renderPasswordRule('One uppercase letter', passwordChecks.uppercase)}
                      {renderPasswordRule('One lowercase letter', passwordChecks.lowercase)}
                      {renderPasswordRule('One number', passwordChecks.number)}
                      {renderPasswordRule('One special character', passwordChecks.special)}
                    </div>
                  </>
                ) : (
                  <p className="lfm-form-help">Start typing to see password strength guidance.</p>
                )}
              </div>

              <div className="lfm-form-group full">
                <label htmlFor="confirm-password">Confirm Password</label>
                <div className="lfm-password-field">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="lfm-password-toggle"
                    aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                    aria-pressed={showConfirmPassword}
                    onClick={() => setShowConfirmPassword((current) => !current)}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && !passwordMatch && <span className="lfm-password-rule-miss">Passwords do not match.</span>}
              </div>

              {role === 'CUSTOMER' && (
                <>
                  <div className="lfm-form-group">
                    <label htmlFor="first-name">First Name</label>
                    <input
                      id="first-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="middle-name">Middle Name (Optional)</label>
                    <input
                      id="middle-name"
                      value={middleName}
                      onChange={(event) => setMiddleName(event.target.value)}
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="last-name">Last Name</label>
                    <input
                      id="last-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="customer-phone">Phone</label>
                    <input
                      id="customer-phone"
                      type="tel"
                      inputMode="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      aria-invalid={customerPhone.length > 0 && !phoneValid}
                      required
                    />
                    {customerPhone.length > 0 && !phoneValid && (
                      <span className="lfm-password-rule-miss">Enter a valid UK phone number.</span>
                    )}
                  </div>
                  <div className="lfm-form-group full">
                    <AddressLookupFields
                      idPrefix="register-customer-address"
                      line1={customerAddress.line1}
                      line2={customerAddress.line2}
                      city={customerAddress.city}
                      postcode={customerAddress.postcode}
                      onChange={(field, value) => setCustomerAddress((previous) => ({ ...previous, [field]: value }))}
                      lookupLabel="Find delivery address or postcode"
                      required
                    />
                  </div>
                  <div className="lfm-form-group full">
                    <label className="lfm-checkbox" htmlFor="accept-terms" style={{ marginTop: '0.35rem' }}>
                      <input
                        id="accept-terms"
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(event) => setAcceptTerms(event.target.checked)}
                        required
                      />
                      <span>I accept the terms and conditions and privacy policy.</span>
                    </label>
                  </div>
                </>
              )}

              {role === 'PRODUCER' && (
                <>
                  <div className="lfm-form-group">
                    <label htmlFor="business-name">Business Name</label>
                    <input
                      id="business-name"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="producer-contact-first-name">Contact First Name</label>
                    <input
                      id="producer-contact-first-name"
                      value={producerContactFirstName}
                      onChange={(event) => setProducerContactFirstName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="producer-contact-middle-name">Contact Middle Name (Optional)</label>
                    <input
                      id="producer-contact-middle-name"
                      value={producerContactMiddleName}
                      onChange={(event) => setProducerContactMiddleName(event.target.value)}
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="producer-contact-last-name">Contact Last Name</label>
                    <input
                      id="producer-contact-last-name"
                      value={producerContactLastName}
                      onChange={(event) => setProducerContactLastName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="producer-phone">Phone</label>
                    <input
                      id="producer-phone"
                      type="tel"
                      inputMode="tel"
                      value={producerPhone}
                      onChange={(event) => setProducerPhone(event.target.value)}
                      aria-invalid={producerPhone.length > 0 && !phoneValid}
                      required
                    />
                    {producerPhone.length > 0 && !phoneValid && (
                      <span className="lfm-password-rule-miss">Enter a valid UK phone number.</span>
                    )}
                  </div>
                  <div className="lfm-form-group full">
                    <AddressLookupFields
                      idPrefix="register-producer-address"
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
              )}

              {role === 'COMMUNITY' && (
                <>
                  <div className="lfm-form-group">
                    <label htmlFor="organisation-name">Organisation Name</label>
                    <input
                      id="organisation-name"
                      value={organisationName}
                      onChange={(event) => setOrganisationName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="organisation-type">Organisation Type</label>
                    <input
                      id="organisation-type"
                      value={orgType}
                      onChange={(event) => setOrgType(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="community-contact-first-name">Contact First Name</label>
                    <input
                      id="community-contact-first-name"
                      value={communityContactFirstName}
                      onChange={(event) => setCommunityContactFirstName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="community-contact-middle-name">Contact Middle Name (Optional)</label>
                    <input
                      id="community-contact-middle-name"
                      value={communityContactMiddleName}
                      onChange={(event) => setCommunityContactMiddleName(event.target.value)}
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="community-contact-last-name">Contact Last Name</label>
                    <input
                      id="community-contact-last-name"
                      value={communityContactLastName}
                      onChange={(event) => setCommunityContactLastName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="community-phone">Phone</label>
                    <input
                      id="community-phone"
                      type="tel"
                      inputMode="tel"
                      value={sharedPhone}
                      onChange={(event) => setSharedPhone(event.target.value)}
                      aria-invalid={sharedPhone.length > 0 && !phoneValid}
                      required
                    />
                    {sharedPhone.length > 0 && !phoneValid && (
                      <span className="lfm-password-rule-miss">Enter a valid UK phone number.</span>
                    )}
                  </div>
                  <div className="lfm-form-group full">
                    <AddressLookupFields
                      idPrefix="register-community-address"
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
              )}

              {role === 'RESTAURANT' && (
                <>
                  <div className="lfm-form-group">
                    <label htmlFor="restaurant-business-name">Business Name</label>
                    <input
                      id="restaurant-business-name"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="restaurant-contact-first-name">Contact First Name</label>
                    <input
                      id="restaurant-contact-first-name"
                      value={restaurantContactFirstName}
                      onChange={(event) => setRestaurantContactFirstName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="restaurant-contact-middle-name">Contact Middle Name (Optional)</label>
                    <input
                      id="restaurant-contact-middle-name"
                      value={restaurantContactMiddleName}
                      onChange={(event) => setRestaurantContactMiddleName(event.target.value)}
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="restaurant-contact-last-name">Contact Last Name</label>
                    <input
                      id="restaurant-contact-last-name"
                      value={restaurantContactLastName}
                      onChange={(event) => setRestaurantContactLastName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group full">
                    <label htmlFor="restaurant-phone">Phone</label>
                    <input
                      id="restaurant-phone"
                      type="tel"
                      inputMode="tel"
                      value={sharedPhone}
                      onChange={(event) => setSharedPhone(event.target.value)}
                      aria-invalid={sharedPhone.length > 0 && !phoneValid}
                      required
                    />
                    {sharedPhone.length > 0 && !phoneValid && (
                      <span className="lfm-password-rule-miss">Enter a valid UK phone number.</span>
                    )}
                  </div>
                  <div className="lfm-form-group full">
                    <AddressLookupFields
                      idPrefix="register-restaurant-address"
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
              )}
            </div>

            <div className="lfm-register-actions">
              <button type="submit" className="lfm-btn-submit full" disabled={!canSubmit}>
                {loading ? 'Creating account...' : 'Register'}
              </button>

              {registrationComplete && (
                <button type="button" className="lfm-btn lfm-btn-primary" onClick={() => navigate('/login')}>
                  Continue to Login
                </button>
              )}

              <Link to="/login" className="lfm-btn lfm-btn-secondary">
                Back to Login
              </Link>
            </div>
          </form>

          <p className="lfm-auth-switch">
            Already have an account? <Link to="/login">Sign in instead</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
