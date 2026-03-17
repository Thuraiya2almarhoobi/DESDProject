import { CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { PublicPortalShell } from '../../components/portal/PublicPortalShell';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { getPortalDefinition, SelfServiceRole } from '../../lib/portalConfig';

const PASSWORD_MIN_LENGTH = 10;

interface RoleRegisterPageProps {
  role: SelfServiceRole;
}

type PasswordStrength = 'Weak' | 'Medium' | 'Strong';

export function RoleRegisterPage({ role }: RoleRegisterPageProps) {
  const definition = getPortalDefinition(role);
  const navigate = useNavigate();
  const { logout, registerCommunity, registerCustomer, registerProducer, registerRestaurant } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [orgType, setOrgType] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const passwordChecks = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordMatch = password.length > 0 && password === confirmPassword;
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
      ? Boolean(email && fullName && phone && deliveryAddress && postcode && acceptTerms)
      : role === 'PRODUCER'
        ? Boolean(email && businessName && contactName && phone && businessAddress && postcode)
        : role === 'COMMUNITY'
          ? Boolean(email && organisationName && orgType && contactName && phone)
          : Boolean(email && businessName && contactName && phone);

  const canSubmit =
    Object.values(passwordChecks).every(Boolean) &&
    passwordMatch &&
    isRoleFieldsValid &&
    !submitting;

  const renderPasswordRule = (label: string, passed: boolean) => (
    <div className={`flex items-center gap-2 text-xs ${passed ? 'text-green-700' : 'text-[oklch(0.38_0.03_145)]'}`}>
      {passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
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

    if (!passwordMatch) {
      setError('Password confirmation does not match.');
      return;
    }

    setSubmitting(true);

    const result =
      role === 'CUSTOMER'
        ? await registerCustomer({
            email,
            password,
            confirm_password: confirmPassword,
            full_name: fullName,
            phone,
            delivery_address: deliveryAddress,
            postcode,
            accept_terms: acceptTerms,
          })
        : role === 'PRODUCER'
          ? await registerProducer({
              email,
              password,
              confirm_password: confirmPassword,
              business_name: businessName,
              contact_name: contactName,
              phone,
              business_address: businessAddress,
              postcode,
            })
          : role === 'COMMUNITY'
            ? await registerCommunity({
                email,
                password,
                confirm_password: confirmPassword,
                organisation_name: organisationName,
                org_type: orgType,
                contact_name: contactName,
                phone,
              })
            : await registerRestaurant({
                email,
                password,
                confirm_password: confirmPassword,
                business_name: businessName,
                contact_name: contactName,
                phone,
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
      eyebrow={`${definition.shortTitle} Registration`}
      title={definition.registerHeading ?? 'Create account'}
      description={definition.registerDescription ?? 'Complete the registration form for this stakeholder role.'}
      accentClassName={definition.accentClassName}
      backHref="/select-portal?mode=register"
      backLabel="Back to Portal"
      insight="This form only collects fields required by the existing backend registration endpoint for this stakeholder type."
    >
      <div className="space-y-6">
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${role}-register-password`}>Password</Label>
            <Input
              id={`${role}-register-password`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <p className={`text-sm font-medium ${strengthClassName}`}>Strength: {passwordStrength}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {renderPasswordRule(`At least ${PASSWORD_MIN_LENGTH} characters`, passwordChecks.minLength)}
              {renderPasswordRule('One uppercase letter', passwordChecks.uppercase)}
              {renderPasswordRule('One lowercase letter', passwordChecks.lowercase)}
              {renderPasswordRule('One number', passwordChecks.number)}
              {renderPasswordRule('One special character', passwordChecks.special)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${role}-register-confirm-password`}>Confirm Password</Label>
            <Input
              id={`${role}-register-confirm-password`}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            {confirmPassword && !passwordMatch ? (
              <p className="text-xs text-red-700">Passwords do not match.</p>
            ) : null}
          </div>

          {role === 'CUSTOMER' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="customer-full-name">Full Name</Label>
                <Input
                  id="customer-full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-delivery-address">Delivery Address</Label>
                <Input
                  id="customer-delivery-address"
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-postcode">Postcode</Label>
                <Input
                  id="customer-postcode"
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value)}
                  required
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-[oklch(0.32_0.03_145)]">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(event) => setAcceptTerms(event.target.checked)}
                  className="mt-1"
                />
                <span>I accept the terms and conditions.</span>
              </label>
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
                <Label htmlFor="producer-contact-name">Contact Name</Label>
                <Input
                  id="producer-contact-name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producer-phone">Phone</Label>
                <Input
                  id="producer-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producer-business-address">Business Address</Label>
                <Input
                  id="producer-business-address"
                  value={businessAddress}
                  onChange={(event) => setBusinessAddress(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producer-postcode">Postcode</Label>
                <Input
                  id="producer-postcode"
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value)}
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
                <Label htmlFor="community-contact-name">Contact Name</Label>
                <Input
                  id="community-contact-name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="community-phone">Phone</Label>
                <Input
                  id="community-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
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
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                />
              </div>
            </>
          ) : null}

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
