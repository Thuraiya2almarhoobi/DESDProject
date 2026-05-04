/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the ResetPasswordPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CheckCircle2, XCircle } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { confirmPasswordReset } from '../services/authService';

/**
 * PASSWORD_MIN_LENGTH boundary.
 *
 * This exported unit supports the file role: Implements the ResetPasswordPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const PASSWORD_MIN_LENGTH = 10;

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const passwordChecks = useMemo(() => {
    return {
      minLength: password.length >= PASSWORD_MIN_LENGTH,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const passwordMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = !!token && passwordValid && passwordMatch && !loading;

  const renderRule = (label: string, passed: boolean) => (
    <div className={`flex items-center gap-2 text-xs ${passed ? 'text-green-700' : 'text-gray-600'}`}>
      {passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
      <span>{label}</span>
    </div>
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Reset token is missing.');
      return;
    }
    if (!passwordValid) {
      setError('Password does not meet all required rules.');
      return;
    }
    if (!passwordMatch) {
      setError('Password confirmation does not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await confirmPasswordReset(token, password);
      setMessage(response.detail);
    } catch (err) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        setError(err.message || 'Password reset failed.');
      } else {
        setError('Password reset failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.96_0.02_145)] via-[oklch(0.94_0.03_142)] to-[oklch(0.92_0.04_150)]">
      <SiteHeader />
      <main className="flex items-center justify-center p-4 pt-10">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>Choose a strong new password for your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!!message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            {!!error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {renderRule(`At least ${PASSWORD_MIN_LENGTH} characters`, passwordChecks.minLength)}
                {renderRule('One uppercase letter', passwordChecks.uppercase)}
                {renderRule('One lowercase letter', passwordChecks.lowercase)}
                {renderRule('One number', passwordChecks.number)}
                {renderRule('One special character', passwordChecks.special)}
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
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {loading ? 'Resetting...' : 'Reset password'}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/login')}>
                Back to login
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
