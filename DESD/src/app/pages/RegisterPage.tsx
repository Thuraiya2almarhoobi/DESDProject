import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { MarketingAuthNav } from '../components/MarketingAuthNav';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import '../../styles/marketing-auth.css';

type RegisterRole = Exclude<UserRole, 'ADMIN'>;

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
  const [fullName, setFullName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerDeliveryAddress, setCustomerDeliveryAddress] = useState('');
  const [customerPostcode, setCustomerPostcode] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [producerContactName, setProducerContactName] = useState('');
  const [producerPhone, setProducerPhone] = useState('');
  const [producerBusinessAddress, setProducerBusinessAddress] = useState('');
  const [producerPostcode, setProducerPostcode] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [orgType, setOrgType] = useState('');
  const [contactName, setContactName] = useState('');
  const [sharedPhone, setSharedPhone] = useState('');
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
  const canSubmit = isPasswordValid && passwordMatch && (role !== 'CUSTOMER' || acceptTerms) && !loading && !registrationComplete;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!isPasswordValid) {
      setError('Password must satisfy all required security rules.');
      return;
    }

    if (!passwordMatch) {
      setError('Password confirmation does not match.');
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
        full_name: fullName,
        phone: customerPhone,
        delivery_address: customerDeliveryAddress,
        postcode: customerPostcode,
        accept_terms: acceptTerms,
      });
    } else if (role === 'PRODUCER') {
      result = await registerProducer({
        email,
        password,
        confirm_password: confirmPassword,
        business_name: businessName,
        contact_name: producerContactName,
        phone: producerPhone,
        business_address: producerBusinessAddress,
        postcode: producerPostcode,
      });
    } else if (role === 'COMMUNITY') {
      result = await registerCommunity({
        email,
        password,
        confirm_password: confirmPassword,
        organisation_name: organisationName,
        org_type: orgType,
        contact_name: contactName,
        phone: sharedPhone,
      });
    } else {
      result = await registerRestaurant({
        email,
        password,
        confirm_password: confirmPassword,
        business_name: businessName,
        contact_name: contactName,
        phone: sharedPhone,
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
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
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
                <p className={strengthClassName}>Strength: {passwordStrength}</p>
                <div className="lfm-password-rules">
                  {renderPasswordRule(`At least ${PASSWORD_MIN_LENGTH} characters`, passwordChecks.minLength)}
                  {renderPasswordRule('One uppercase letter', passwordChecks.uppercase)}
                  {renderPasswordRule('One lowercase letter', passwordChecks.lowercase)}
                  {renderPasswordRule('One number', passwordChecks.number)}
                  {renderPasswordRule('One special character', passwordChecks.special)}
                </div>
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
                    <label htmlFor="full-name">Full Name</label>
                    <input
                      id="full-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="customer-phone">Phone</label>
                    <input
                      id="customer-phone"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group full">
                    <label htmlFor="delivery-address">Delivery Address</label>
                    <input
                      id="delivery-address"
                      value={customerDeliveryAddress}
                      onChange={(event) => setCustomerDeliveryAddress(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="customer-postcode">Postcode</label>
                    <input
                      id="customer-postcode"
                      value={customerPostcode}
                      onChange={(event) => setCustomerPostcode(event.target.value)}
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
                      <span>I accept the terms and conditions.</span>
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
                    <label htmlFor="producer-contact-name">Contact Name</label>
                    <input
                      id="producer-contact-name"
                      value={producerContactName}
                      onChange={(event) => setProducerContactName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="producer-phone">Phone</label>
                    <input
                      id="producer-phone"
                      value={producerPhone}
                      onChange={(event) => setProducerPhone(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="producer-postcode">Postcode</label>
                    <input
                      id="producer-postcode"
                      value={producerPostcode}
                      onChange={(event) => setProducerPostcode(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group full">
                    <label htmlFor="producer-business-address">Business Address</label>
                    <input
                      id="producer-business-address"
                      value={producerBusinessAddress}
                      onChange={(event) => setProducerBusinessAddress(event.target.value)}
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
                    <label htmlFor="community-contact-name">Contact Name</label>
                    <input
                      id="community-contact-name"
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group">
                    <label htmlFor="community-phone">Phone</label>
                    <input
                      id="community-phone"
                      value={sharedPhone}
                      onChange={(event) => setSharedPhone(event.target.value)}
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
                    <label htmlFor="restaurant-contact-name">Contact Name</label>
                    <input
                      id="restaurant-contact-name"
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="lfm-form-group full">
                    <label htmlFor="restaurant-phone">Phone</label>
                    <input
                      id="restaurant-phone"
                      value={sharedPhone}
                      onChange={(event) => setSharedPhone(event.target.value)}
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
