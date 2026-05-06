import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../contexts/AuthContext';
import { useSafeBack } from '../../lib/navigation';
import {
  fetchProducerNotifications,
  type NotificationTone,
  type ProducerNotificationItem as NotificationItem,
} from '../../lib/producerNotifications';
import { SiteHeader } from '../../components/SiteHeader';
import { PageLoadingSkeleton } from '../../components/LoadingSkeletons';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';

const notificationToneClass: Record<NotificationTone, string> = {
  urgent: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  neutral: 'border-[#ded5c6] bg-[#f5f0e8] text-[var(--rich-soil)]',
  success: 'border-[color-mix(in_srgb,var(--forest-green)_25%,white)] bg-[color-mix(in_srgb,var(--forest-green)_7%,white)] text-[var(--forest-green)]',
};

export function ProducerNotificationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useSafeBack('/producer/dashboard');
  const { user } = useAuth();
  const producerEmail = (user?.email || 'producer@example.com').trim().toLowerCase();
  const searchQuery = new URLSearchParams(location.search).get('q') || '';

  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadNotifications = async () => {
      setLoading(true);
      try {
        const payload = await fetchProducerNotifications(producerEmail);
        if (!mounted) {
          return;
        }
        setNotifications(payload);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load notifications.');
        setNotifications([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadNotifications();
    return () => {
      mounted = false;
    };
  }, [producerEmail]);

  const visibleNotifications = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) {
      return notifications;
    }
    return notifications.filter((item) =>
      [item.title, item.description, item.urgency, item.tone].join(' ').toLowerCase().includes(normalizedSearch),
    );
  }, [notifications, searchQuery]);

  return (
    <div className="min-h-screen bg-[#fbfaf4]">
      <SiteHeader searchPlaceholder="Search notifications by urgency, order, stock, season..." />
      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-5 lg:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Dashboard
          </Button>
          <Badge variant="secondary">{visibleNotifications.length} shown</Badge>
        </div>
        <section className="mb-5 rounded-2xl border border-[#e4e1d8] bg-[#fffdf8] p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--earth-accent)]">Producer notifications</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--rich-soil)]">All Notifications</h1>
          <p className="mt-1 text-sm text-[var(--warm-earth)]">Review every sales, stock, and seasonality signal with urgency labels.</p>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-600">
              Search: <span className="font-medium text-gray-900">{searchQuery}</span>
            </p>
          )}
        </section>

        {loading ? (
          <PageLoadingSkeleton rows={4} cards={3} />
        ) : (
          <div className="grid gap-3">
            {visibleNotifications.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.id} className={`border ${notificationToneClass[item.tone]}`}>
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <Icon className="mt-0.5 size-5 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold">{item.title}</h2>
                          <Badge variant="outline" className="bg-white/70">
                            {item.urgency}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm opacity-85">{item.description}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="shrink-0 bg-white/75" onClick={() => navigate(item.path)}>
                      Open
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
