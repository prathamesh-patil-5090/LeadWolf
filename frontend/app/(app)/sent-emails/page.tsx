'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { EngagementBadges } from '@/components/engagement-badges';
import { PageHeader } from '@/components/page-header';
import { PaginationBar } from '@/components/pagination-bar';
import { SentEmailDetailSheet } from '@/components/sent-email-detail-sheet';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { LEAD_STATUS_LABELS } from '@/lib/status';
import type { LeadStatus, SentEmailRow } from '@/lib/types';

const STATUS_FILTERS = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];

export default function SentEmailsPage() {
  const [rows, setRows] = useState<SentEmailRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [leadStatus, setLeadStatus] = useState<string>('all');
  const [repliesOnly, setRepliesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listSentEmails({
        page,
        pageSize: 25,
        leadStatus: leadStatus === 'all' ? undefined : leadStatus,
        hasReply: repliesOnly || undefined,
      });
      setRows(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load sent emails');
    } finally {
      setLoading(false);
    }
  }, [page, leadStatus, repliesOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  function openRow(row: SentEmailRow) {
    setSelectedId(row.id);
    setSheetOpen(true);
  }

  async function syncAllGmail() {
    setSyncing(true);
    try {
      const result = await api.syncGmailReplies(50);
      toast.success(
        `Gmail sync: ${result.processed ?? 0} processed, ${result.matched ?? 0} replies matched`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gmail sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Sent emails"
        description={`${total} outreach emails sent via Brevo`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
            <Button
              size="sm"
              disabled={syncing}
              onClick={() => void syncAllGmail()}
            >
              {syncing ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 size-4" />
              )}
              Sync Gmail replies
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-3">
          <div className="grid w-full max-w-xs gap-1.5">
            <Label>Lead status</Label>
            <Select
              value={leadStatus}
              onValueChange={(v) => {
                setPage(1);
                setLeadStatus(v ?? 'all');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid w-full max-w-xs gap-1.5">
            <Label>Filter</Label>
            <Select
              value={repliesOnly ? 'replies' : 'all'}
              onValueChange={(v) => {
                setPage(1);
                setRepliesOnly(v === 'replies');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sent emails</SelectItem>
                <SelectItem value="replies">Replies only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Click a row to view the full email, Brevo/Gmail event timeline, and
          sync Gmail replies for that lead.
        </p>

        <div className="rounded-md border">
          <div className="divide-y md:hidden">
            {loading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                No sent emails yet. Pipeline auto-send or POST /leads/:id/send
                will populate this table.
              </div>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="w-full space-y-2 p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
                  onClick={() => openRow(row)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{row.lead.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.sentTo ?? row.lead.email ?? '—'}
                      </p>
                    </div>
                    <StatusBadge status={row.lead.status} />
                  </div>
                  <p className="line-clamp-2 text-sm">{row.subject}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {row.sentAt
                        ? new Date(row.sentAt).toLocaleString()
                        : '—'}
                    </span>
                    <EngagementBadges
                      engagement={row.engagement}
                      leadStatus={row.lead.status}
                    />
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Lead status</TableHead>
                <TableHead>Engagement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No sent emails yet. Pipeline auto-send or POST /leads/:id/send
                    will populate this table.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openRow(row)}
                  >
                    <TableCell>
                      <div className="font-medium">{row.lead.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.sentTo ?? row.lead.email ?? '—'}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {row.subject}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {row.sentAt
                        ? new Date(row.sentAt).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.lead.status} />
                    </TableCell>
                    <TableCell>
                      <EngagementBadges
                        engagement={row.engagement}
                        leadStatus={row.lead.status}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        <PaginationBar
          summary={`Page ${page} of ${totalPages}`}
          page={page}
          totalPages={totalPages}
          onPrevious={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      </div>

      <SentEmailDetailSheet
        emailId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSynced={() => void load()}
      />
    </>
  );
}
