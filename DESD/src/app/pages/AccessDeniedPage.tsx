import { useNavigate } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardPathForRole } from '../lib/roleRouting';

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGoBack = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(getDashboardPathForRole(user.role));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)] p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 size-16 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldAlert className="size-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-gray-600">
            Your account ({user?.role}) doesn't have the required permissions to view this resource.
          </p>
          
          <div className="flex flex-col gap-2">
            <Button onClick={handleGoBack} className="w-full">
              Go to Dashboard
            </Button>
            <Button onClick={logout} variant="outline" className="w-full">
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
