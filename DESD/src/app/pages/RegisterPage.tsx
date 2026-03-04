import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Sprout, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';

type RegisterRole = Exclude<UserRole, 'ADMIN'>;

const PASSWORD_MIN_LENGTH = 10;

const roleOptions: Array<{ value: RegisterRole; label: string }> = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'PRODUCER', label: 'Producer' },
  { value: 'COMMUNITY', label: 'Community' },
  { value: 'RESTAURANT', label: 'Restaurant' },
];

type PasswordStrength = 'Weak' | 'Medium' | 'Strong';

export function RegisterPage() {
  const navigate = useNavigate();
  const {
    registerCommunity,
    registerCustomer,
    registerProducer,
    registerRestaurant,
  } = useAuth();

  const [role, setRole] = useState<RegisterRole>('CUSTOMER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const renderRule = (label: string, passed: boolean) => (
    <div className={`flex items-center gap-2 text-xs ${passed ? 'text-green-700' : 'text-gray-600'}`}>
      {passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
      <span>{label}</span>
    </div>
  );

  const strengthColor = passwordStrength === 'Strong'
    ? 'text-green-700'
    : passwordStrength === 'Medium'
      ? 'text-amber-700'
      : 'text-red-700';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[oklch(0.96_0.02_145)] via-[oklch(0.94_0.03_142)] to-[oklch(0.92_0.04_150)] p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 size-14 bg-gradient-to-br from-[oklch(0.45_0.12_155)] to-[oklch(0.55_0.10_150)] rounded-full flex items-center justify-center shadow-md">
            <Sprout className="size-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Choose a stakeholder role and complete registration</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {successMessage && (
              <Alert>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value as RegisterRole)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <p className={`text-sm font-medium ${strengthColor}`}>Strength: {passwordStrength}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {renderRule(`At least ${PASSWORD_MIN_LENGTH} characters`, passwordChecks.minLength)}
                {renderRule('One uppercase letter', passwordChecks.uppercase)}
                {renderRule('One lowercase letter', passwordChecks.lowercase)}
                {renderRule('One number', passwordChecks.number)}
                {renderRule('One special character', passwordChecks.special)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
              {confirmPassword && !passwordMatch && (
                <p className="text-xs text-red-700">Passwords do not match.</p>
              )}
            </div>

            {role === 'CUSTOMER' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery-address">Delivery Address</Label>
                  <Input
                    id="delivery-address"
                    value={customerDeliveryAddress}
                    onChange={(event) => setCustomerDeliveryAddress(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-postcode">Postcode</Label>
                  <Input
                    id="customer-postcode"
                    value={customerPostcode}
                    onChange={(event) => setCustomerPostcode(event.target.value)}
                    required
                  />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(event) => setAcceptTerms(event.target.checked)}
                    className="mt-1"
                    required
                  />
                  <span>I accept the terms and conditions.</span>
                </label>
              </>
            )}

            {role === 'PRODUCER' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="producer-contact-name">Contact Name</Label>
                  <Input
                    id="producer-contact-name"
                    value={producerContactName}
                    onChange={(event) => setProducerContactName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="producer-phone">Phone</Label>
                  <Input
                    id="producer-phone"
                    value={producerPhone}
                    onChange={(event) => setProducerPhone(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-address">Business Address</Label>
                  <Input
                    id="business-address"
                    value={producerBusinessAddress}
                    onChange={(event) => setProducerBusinessAddress(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="producer-postcode">Postcode</Label>
                  <Input
                    id="producer-postcode"
                    value={producerPostcode}
                    onChange={(event) => setProducerPostcode(event.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {role === 'COMMUNITY' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organisation Name</Label>
                  <Input
                    id="org-name"
                    value={organisationName}
                    onChange={(event) => setOrganisationName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-type">Organisation Type</Label>
                  <Input
                    id="org-type"
                    value={orgType}
                    onChange={(event) => setOrgType(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Contact Name</Label>
                  <Input
                    id="contact-name"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="community-phone">Phone</Label>
                  <Input
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
                  <Label htmlFor="restaurant-contact-name">Contact Name</Label>
                  <Input
                    id="restaurant-contact-name"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restaurant-phone">Phone</Label>
                  <Input
                    id="restaurant-phone"
                    value={sharedPhone}
                    onChange={(event) => setSharedPhone(event.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {!isPasswordValid && (
              <p className="text-xs text-red-700">Password does not meet all required rules.</p>
            )}

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading ? 'Creating account...' : 'Register'}
            </Button>

            {registrationComplete && (
              <Button type="button" className="w-full" onClick={() => navigate('/login')}>
                Continue to Login
              </Button>
            )}

            <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/login')}>
              Back to login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
