'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { EngagementBadges } from '@/components/engagement-badges';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import type { SentEmailDetail } from '@/lib/types';

export function SentEmailDetailSheet({
  emailId,
  open,
  onOpenChange,
  onSynced,
}: {
  emailId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSynced?: () => void;
}) {
  const [detail, setDetail] = useState<SentEmailDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingBrevo, setSyncingBrevo] = useState(false);

  useEffect(() => {
    if (!open || !emailId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void api
      .getSentEmailDetail(emailId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load email');
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, emailId, onOpenChange]);

  async function syncBrevo() {
    if (!emailId) return;
    setSyncingBrevo(true);
    try {
      const result = await api.syncBrevoEvents({ outreachEmailId: emailId });
      if (!result.configured) {
        toast.error(result.message ?? 'Brevo API key not configured');
        return;
      }
      toast.success(
        `Brevo sync: ${result.created ?? 0} new event(s) recorded`,
      );
      const refreshed = await api.getSentEmailDetail(emailId);
      setDetail(refreshed);
      onSynced?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Brevo sync failed');
    } finally {
      setSyncingBrevo(false);
    }
  }

  async function syncGmail() {
    setSyncing(true);
    try {
      const result = await api.syncGmailReplies(50);
      toast.success(
        `Gmail sync: ${result.processed ?? 0} processed, ${result.matched ?? 0} matched`,
      );
      if (emailId) {
        const refreshed = await api.getSentEmailDetail(emailId);
        setDetail(refreshed);
      }
      onSynced?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gmail sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const email = detail?.outreachEmail;
  const lead = email?.lead;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b px-4 py-4 pr-12">
          <SheetTitle className="line-clamp-2">
            {email?.subject ?? 'Sent email'}
          </SheetTitle>
          <SheetDescription className="break-words">
            {lead ? (
              <>
                To{' '}
                <Link
                  href={`/leads/${lead.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {lead.name}
                </Link>{' '}
                · {lead.company}
              </>
            ) : (
              'Loading…'
            )}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center px-4 py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : email && lead && detail ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="space-y-5 pb-2">
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Engagement</h3>
                <EngagementBadges
                  engagement={detail.engagement}
                  leadStatus={lead.status}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={lead.status} />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={syncingBrevo}
                    onClick={() => void syncBrevo()}
                  >
                    {syncingBrevo ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 size-3" />
                    )}
                    Sync Brevo events
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={syncing}
                    onClick={() => void syncGmail()}
                  >
                    {syncing ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 size-3" />
                    )}
                    Sync Gmail replies
                  </Button>
                </div>
              </section>

              <Separator />

              <section className="grid gap-2 text-sm">
                <h3 className="font-medium">Delivery</h3>
                <InfoRow label="Sent at" value={formatDate(email.sentAt)} />
                <InfoRow label="Sent to" value={email.sentTo ?? lead.email} />
                <InfoRow label="Lead email" value={lead.email} />
                <InfoRow
                  label="Provider"
                  value={`${email.provider} · ${email.model}`}
                />
                <InfoRow label="Brevo message ID" value={email.brevoMessageId} />
                {email.sendError ? (
                  <p className="break-words text-destructive">{email.sendError}</p>
                ) : null}
              </section>

              <Separator />

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Event timeline</h3>
                {email.emailEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Brevo or Gmail events recorded yet. Sync Brevo events for
                    opens/clicks, or Gmail sync for replies.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {email.emailEvents.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{ev.eventType}</p>
                          <p className="break-words text-xs text-muted-foreground">
                            {ev.source}
                            {ev.recipientEmail ? ` · ${ev.recipientEmail}` : ''}
                          </p>
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(ev.occurredAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator />

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Email body</h3>
                <pre className="overflow-hidden whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm font-sans">
                  {email.body}
                </pre>
              </section>

              <section className="grid gap-2 text-sm">
                <h3 className="font-medium">Lead links</h3>
                {lead.githubUrl ? (
                  <ExternalLinkRow href={lead.githubUrl} label="GitHub" />
                ) : null}
                {lead.linkedinUrl ? (
                  <ExternalLinkRow href={lead.linkedinUrl} label="LinkedIn" />
                ) : null}
                <ExternalLinkRow href={lead.profileUrl} label="Profile" />
              </section>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,8rem)_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right sm:text-left">
        {value ?? '—'}
      </span>
    </div>
  );
}

function ExternalLinkRow({ href, label }: { href: string; label: string }) {
  const url = href.startsWith('http') ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}
