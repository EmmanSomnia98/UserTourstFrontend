import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  CollaborationNotification,
  fetchCollaborationNotifications,
  markNotificationRead,
  respondToInvitation,
} from '@/app/api/collaboration';

type CollaborationNotificationsProps = {
  isAuthenticated: boolean;
  onOpenItinerary?: (itineraryId: string) => void;
  buttonClassName?: string;
  showLabel?: boolean;
};

function formatRelative(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  const diff = Date.now() - ms;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CollaborationNotifications({
  isAuthenticated,
  onOpenItinerary,
  buttonClassName,
  showLabel = false,
}: CollaborationNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CollaborationNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [inviteResolution, setInviteResolution] = useState<Record<string, 'accepted' | 'declined' | 'already_responded'>>({});

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setIsOpen(false);
      return;
    }

    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const next = await fetchCollaborationNotifications();
        if (!active) return;
        setItems(
          next.map((item) => {
            if (item.type !== 'invite') return item;
            const key = item.invitationId ?? item.id;
            if (!inviteResolution[key]) return item;
            return { ...item, read: true };
          })
        );
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load notifications.');
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 20_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [inviteResolution, isAuthenticated]);

  const getInviteResolution = (item: CollaborationNotification) => {
    if (item.type !== 'invite') return null;
    const key = item.invitationId ?? item.id;
    return inviteResolution[key] ?? null;
  };

  const getInviteStatusText = (item: CollaborationNotification) => {
    const status = getInviteResolution(item);
    if (status === 'accepted') return 'Invitation accepted.';
    if (status === 'declined') return 'Invitation declined.';
    if (status === 'already_responded') return 'Invitation already responded.';
    return null;
  };

  const markRead = async (item: CollaborationNotification) => {
    if (item.read) return;
    setItems((prev) => prev.map((candidate) => (candidate.id === item.id ? { ...candidate, read: true } : candidate)));
    try {
      await markNotificationRead(item.id);
    } catch {
      setItems((prev) => prev.map((candidate) => (candidate.id === item.id ? item : candidate)));
    }
  };

  const respondInvite = async (item: CollaborationNotification, action: 'accept' | 'decline') => {
    const invitationId = item.invitationId ?? item.id;
    setActingId(item.id);
    setError(null);
    try {
      await respondToInvitation(invitationId, action);
      setInviteResolution((prev) => ({ ...prev, [invitationId]: action === 'accept' ? 'accepted' : 'declined' }));
      setItems((prev) =>
        prev.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, read: true }
            : candidate
        )
      );
      try {
        await markNotificationRead(item.id);
      } catch {
        // Keep local read state even if mark-read call fails.
      }
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Failed to update invitation.';
      const normalized = message.toLowerCase();
      if (normalized.includes('(409)') || normalized.includes('already responded')) {
        setInviteResolution((prev) => ({ ...prev, [invitationId]: 'already_responded' }));
        setItems((prev) =>
          prev.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, read: true }
              : candidate
          )
        );
        try {
          await markNotificationRead(item.id);
        } catch {
          // Keep local read state even if mark-read call fails.
        }
      } else {
        setError(message);
      }
    } finally {
      setActingId(null);
    }
  };

  if (!isAuthenticated) return null;

  const panelClassName = showLabel
    ? 'absolute left-0 z-40 mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-xl'
    : 'absolute right-0 z-40 mt-2 w-[22rem] rounded-lg border border-slate-200 bg-white p-3 shadow-xl';
  const badgeClassName = showLabel
    ? 'absolute right-2 top-1/2 inline-flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white'
    : 'absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white';

  return (
    <div className={`relative ${showLabel ? 'w-full' : ''}`}>
      <Button
        variant="outline"
        size={showLabel ? undefined : 'icon'}
        className={showLabel ? buttonClassName : undefined}
        aria-label="Open collaboration notifications"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Bell className="h-4 w-4" />
        {showLabel && <span className="ml-2">Notifications</span>}
      </Button>
      {unreadCount > 0 && (
        <span className={badgeClassName}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      {isOpen && (
        <div className={panelClassName}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Collaboration</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
          {isLoading && <p className="text-xs text-slate-500">Loading notifications...</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {!isLoading && items.length === 0 && <p className="text-xs text-slate-500">No collaboration notifications.</p>}
          <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-md border p-2 text-sm ${item.read ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/40'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-600">{item.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatRelative(item.createdAt)}</p>
                  </div>
                  {!item.read && (
                    <Button variant="ghost" size="sm" onClick={() => void markRead(item)}>
                      Mark read
                    </Button>
                  )}
                </div>
                {item.type === 'invite' && !getInviteResolution(item) && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={actingId === item.id}
                      onClick={() => void respondInvite(item, 'accept')}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={actingId === item.id}
                      onClick={() => void respondInvite(item, 'decline')}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Decline
                    </Button>
                  </div>
                )}
                {item.type === 'invite' && getInviteStatusText(item) && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">{getInviteStatusText(item)}</p>
                )}
                {item.itineraryId && item.type !== 'invite' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenItinerary?.(item.itineraryId as string);
                    }}
                  >
                    Open itinerary
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
