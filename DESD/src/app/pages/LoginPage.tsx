import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Sprout } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      // Role-aware redirects (TC-001/002)
      const normalized = email.toLowerCase();
      const user = normalized.includes('customer')
        ? 'customer'
        : normalized.includes('producer')
        ? 'producer'
        : 'admin';
      
      if (user === 'customer') {
        navigate('/marketplace');
      } else if (user === 'producer') {
        navigate('/producer/dashboard');
      } else {
        navigate('/admin/commission');
      }
    } else {
      setError(result.error || 'Login failed');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[oklch(0.96_0.02_145)] via-[oklch(0.94_0.03_142)] to-[oklch(0.92_0.04_150)] p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 size-14 bg-gradient-to-br from-[oklch(0.45_0.12_155)] to-[oklch(0.55_0.10_150)] rounded-full flex items-center justify-center shadow-md">
            <Sprout className="size-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Local Food Marketplace</CardTitle>
          <CardDescription>Sign in to connect with local farmers</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="mt-6 p-4 bg-gradient-to-br from-[oklch(0.96_0.02_145)] to-[oklch(0.94_0.03_142)] rounded-lg text-sm space-y-2 border border-[oklch(0.88_0.02_145)]">
              <p className="font-medium text-[oklch(0.45_0.12_155)]">Demo Accounts:</p>
              <div className="space-y-1 text-[oklch(0.40_0.05_150)]">
                <p><strong>Customer:</strong> customer@example.com</p>
                <p><strong>Producer:</strong> producer@example.com</p>
                <p><strong>Admin:</strong> admin@example.com</p>
                <p className="text-xs mt-2 text-muted-foreground">Password: DemoPass123!</p>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
