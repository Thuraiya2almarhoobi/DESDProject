/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the ForgotPasswordPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';

import { SiteHeader } from '../components/SiteHeader';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { requestPasswordReset } from '../services/authService';

/**
 * GENERIC_RESET_MESSAGE boundary.
 *
 * This exported unit supports the file role: Implements the ForgotPasswordPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const GENERIC_RESET_MESSAGE = 'If the email exists, a reset link has been sent.';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await requestPasswordReset(email);
      setMessage(response.detail || GENERIC_RESET_MESSAGE);
    } catch {
      setMessage(GENERIC_RESET_MESSAGE);
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
            <CardTitle className="text-2xl">Forgot Password</CardTitle>
            <CardDescription>Enter your email and we will send a reset link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!!message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
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
