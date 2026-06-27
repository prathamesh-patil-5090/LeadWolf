'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import type { Lead, LeadTimeline, OutreachEmail } from '@/lib/types';

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [emails, setEmails] = useState<OutreachEmail[]>([]);
  const [timeline, setTimeline] = useState<LeadTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [l, e, t] = await Promise.all([
        api.getLead(params.id),
        api.getLeadEmails(params.id),
        api.getLeadTimeline(params.id),
      ]);
      setLead(l);
      setEmails(e);
      setTimeline(t);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function runAction(
    key: string,
    fn: () => Promise<unknown>,
    success: string,
  ) {
    setActionLoading(key);
    try {
      const result = await fn();
      if (
        result &&
        typeof result === 'object' &&
        'skipped' in result &&
        (result as { skipped?: boolean }).skipped
      ) {
        const reason = (result as { reason?: string }).reason;
        toast.warning(
          reason === 'not_verified'
            ? 'Skipped — verify the contact email first'
            : reason === 'no_email'
              ? 'Skipped — no contact email on this lead'
              : reason === 'already_generated'
                ? 'Email already exists — use regenerate to replace it'
                : `Skipped (${reason ?? 'unknown'})`,
        );
      } else if (
        result &&
        typeof result === 'object' &&
        'emails' in result &&
        Array.isArray((result as { emails?: OutreachEmail[] }).emails)
      ) {
        const genEmails = (result as { emails: OutreachEmail[] }).emails;
        const failed = genEmails.find((e) => e.error);
        if (failed?.error) {
          toast.error(`Generation failed: ${failed.error}`);
        } else if (genEmails.length > 0) {
          toast.success(success);
        } else {
          toast.warning('No email was saved');
        }
      } else {
        toast.success(success);
      }
      await load();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading && !lead) {
    return (
      <>
        <PageHeader title="Loading…" backHref="/leads" backLabel="Back to leads" />
        <div className="flex flex-1 items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <PageHeader title="Lead not found" backHref="/leads" backLabel="Back to leads" />
        <div className="p-4 sm:p-6">
          <p className="text-muted-foreground">This lead does not exist or was removed.</p>
        </div>
      </>
    );
  }

  const primaryEmail =
    emails.find((e) => e.isPrimary && !e.error && e.subject) ??
    emails.find((e) => !e.error && e.subject) ??
    emails.find((e) => e.isPrimary) ??
    emails[0];
  const generationFailed = primaryEmail?.error;

  return (
    <>
      <PageHeader
        title={lead.name}
        description={`${lead.role} at ${lead.company}`}
        backHref="/leads"
        backLabel="Back to leads"
      />
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Profile</CardTitle>
                <StatusBadge status={lead.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Email" value={lead.email} />
              <Field label="Location" value={lead.location} />
              <Field label="Company site" value={lead.companyWebsite} link />
              <Field label="GitHub" value={lead.githubUrl} link />
              <Field label="LinkedIn" value={lead.linkedinUrl ?? lead.profileUrl} link />
              <Field label="Verified" value={lead.verified ? `Yes (${lead.contactConfidence ?? 0}%)` : 'No'} />
            </CardContent>
          </Card>

          {lead.pipelineError ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Pipeline error</CardTitle>
                <CardDescription>
                  Failed at {lead.pipelineFailedStep ?? 'unknown step'}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">{lead.pipelineError}</CardContent>
            </Card>
          ) : null}

          <Tabs defaultValue="email">
            <TabsList className="h-auto w-full max-w-full flex-wrap justify-start gap-1 sm:w-fit sm:flex-nowrap">
              <TabsTrigger value="email">Outreach email</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {primaryEmail?.subject
                      ? primaryEmail.subject
                      : generationFailed
                        ? 'Generation failed'
                        : 'No email yet'}
                  </CardTitle>
                  {primaryEmail ? (
                    <CardDescription>
                      {primaryEmail.provider} · {primaryEmail.model}
                      {primaryEmail.sentAt
                        ? ` · Sent ${new Date(primaryEmail.sentAt).toLocaleString()}`
                        : ''}
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {primaryEmail?.body ? (
                    <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm font-sans">
                      {primaryEmail.body}
                    </pre>
                  ) : generationFailed ? (
                    <p className="text-sm text-destructive">{primaryEmail.error}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {lead.email
                        ? 'Click Generate email in Actions to create outreach copy.'
                        : 'Discover a contact email first, then generate outreach.'}
                      {!lead.verified && lead.email ? (
                        <>
                          {' '}
                          Contact is not verified yet — run Verify contact or
                          generate anyway.
                        </>
                      ) : null}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {!timeline?.events.length ? (
                    <p className="text-sm text-muted-foreground">No events yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {timeline.events.map((ev) => (
                        <li
                          key={ev.id}
                          className="flex flex-col gap-0.5 text-sm sm:flex-row sm:justify-between"
                        >
                          <span className="font-medium">{ev.eventType}</span>
                          <span className="text-muted-foreground">
                            {new Date(ev.occurredAt).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Run pipeline steps for this lead</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <ActionButton
                label="Re-queue pipeline"
                loading={actionLoading === 'enqueue'}
                onClick={() =>
                  runAction('enqueue', () => api.enqueueLead(lead.id), 'Queued')
                }
              />
              <ActionButton
                label="Enrich"
                loading={actionLoading === 'enrich'}
                onClick={() =>
                  runAction('enrich', () => api.enrichLead(lead.id), 'Enriched')
                }
              />
              <ActionButton
                label="Verify contact"
                loading={actionLoading === 'verify'}
                onClick={() =>
                  runAction(
                    'verify',
                    () => api.verifyLead(lead.id),
                    'Contact verified',
                  )
                }
              />
              <ActionButton
                label="Generate email"
                loading={actionLoading === 'email'}
                onClick={() =>
                  runAction(
                    'email',
                    () => api.generateEmail(lead.id, true),
                    'Email generated',
                  )
                }
              />
              <ActionButton
                label="Send (Brevo)"
                loading={actionLoading === 'send'}
                onClick={() =>
                  runAction('send', () => api.sendLead(lead.id), 'Send initiated')
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  link,
}: {
  label: string;
  value?: string | null;
  link?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      {!value ? (
        <p>—</p>
      ) : link ? (
        <a
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 break-all text-primary hover:underline"
        >
          {value}
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <p className="break-all">{value}</p>
      )}
    </div>
  );
}

function ActionButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="w-full justify-start"
      disabled={loading}
      onClick={onClick}
    >
      {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}
