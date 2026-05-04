/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the VerifyEmailPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { SiteHeader } from '../components/SiteHeader';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { verifyEmail } from '../services/authService';

/**
 * VerifyEmailPage boundary.
 *
 * This exported unit supports the file role: Implements the VerifyEmailPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('token');
    if (!token) {
      setError('Verification token is missing.');
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const response = await verifyEmail(token);
        setMessage(response.detail);
      } catch (err) {
        const fallback = 'Invalid or expired verification token.';
        if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
          setError(err.message || fallback);
        } else {
          setError(fallback);
        }
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [location.search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.96_0.02_145)] via-[oklch(0.94_0.03_142)] to-[oklch(0.92_0.04_150)]">
      <SiteHeader />
      <main className="flex items-center justify-center p-4 pt-10">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Verify Email</CardTitle>
            <CardDescription>Confirm your account email to complete setup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Verifying token...</p>}
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
            <Button className="w-full" onClick={() => navigate('/login')}>
              Back to login
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
