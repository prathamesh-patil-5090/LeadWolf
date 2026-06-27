'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import type { CompanyDetail } from '@/lib/types';

export function CompanyDetailSheet({
  companyId,
  open,
  onOpenChange,
}: {
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !companyId) {
      setCompany(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void api
      .getCompany(companyId)
      .then((data) => {
        if (!cancelled) setCompany(data);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load company');
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, companyId, onOpenChange]);

  const hooks = normalizeHooks(company?.personalizationHooks);
  const emails = normalizeEmails(company?.discoveredEmails);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b px-4 py-4 pr-12">
          <SheetTitle className="line-clamp-2">
            {company?.name ?? 'Company'}
          </SheetTitle>
          <SheetDescription className="break-words">
            {company?.domain ?? 'Loading…'}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center px-4 py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : company ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="space-y-5 pb-2">
              <section className="grid gap-2 text-sm">
                <h3 className="font-medium">Overview</h3>
                <InfoRow label="Domain" value={company.domain} />
                <InfoRow label="Website" value={company.website} link />
                <InfoRow label="Industry" value={company.industry} />
                <InfoRow label="Discovered" value={formatDate(company.discoveredAt)} />
                <InfoRow label="Summarized" value={formatDate(company.summarizedAt)} />
                <InfoRow label="Updated" value={formatDate(company.updatedAt)} />
              </section>

              {company.summary ? (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">Summary</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {company.summary}
                    </p>
                  </section>
                </>
              ) : null}

              {company.products ? (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">Products & services</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {company.products}
                    </p>
                  </section>
                </>
              ) : null}

              {hooks.length > 0 ? (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">Personalization hooks</h3>
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {hooks.map((hook) => (
                        <li key={hook} className="break-words">
                          {hook}
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : null}

              {emails.length > 0 ? (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">Discovered emails</h3>
                    <ul className="space-y-2">
                      {emails.map((entry) => (
                        <li
                          key={`${entry.email}-${entry.source}`}
                          className="rounded-md border px-3 py-2 text-sm"
                        >
                          <p className="break-all font-medium">{entry.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.source}
                            {entry.page ? ` · ${entry.page}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : null}

              {company.leads && company.leads.length > 0 ? (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">
                      Linked leads ({company.leads.length})
                    </h3>
                    <ul className="space-y-2">
                      {company.leads.map((lead) => (
                        <li key={lead.id}>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="block rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                          >
                            <p className="font-medium">{lead.name}</p>
                            <p className="text-xs text-muted-foreground">{lead.role}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : null}

              {company.scrapedContent ? (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">Scraped website content</h3>
                    <pre className="max-h-64 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs font-sans">
                      {company.scrapedContent}
                    </pre>
                  </section>
                </>
              ) : null}
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
  link,
}: {
  label: string;
  value?: string | null;
  link?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,8rem)_1fr]">
      <span className="text-muted-foreground">{label}</span>
      {!value ? (
        <span>—</span>
      ) : link ? (
        <a
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 break-all text-primary hover:underline"
        >
          {value}
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <span className="min-w-0 break-words">{value}</span>
      )}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function normalizeHooks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.email !== 'string' || typeof record.source !== 'string') {
      return [];
    }
    return [
      {
        email: record.email,
        source: record.source,
        page: typeof record.page === 'string' ? record.page : undefined,
      },
    ];
  });
}
