'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Columns3, Loader2 } from 'lucide-react';
import { LeadsDataTable } from '@/components/leads/leads-data-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import {
  LEAD_COLUMNS,
  loadLeadsTablePrefs,
  saveLeadsTablePrefs,
  type LeadColumnId,
} from '@/lib/leads-table-prefs';
import { LEAD_STATUS_LABELS } from '@/lib/status';
import type { Lead, LeadStatus } from '@/lib/types';

const STATUSES = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];
const PAGE_SIZES = [10, 20, 50, 100] as const;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [prefs, setPrefs] = useState(loadLeadsTablePrefs);

  useEffect(() => {
    setPrefs(loadLeadsTablePrefs());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listLeads({
        page,
        pageSize: prefs.pageSize,
        role: role || undefined,
        company: company || undefined,
        status: status === 'all' ? undefined : status,
      });
      setLeads(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, role, company, status, prefs.pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleColumn(id: LeadColumnId, checked: boolean) {
    setPrefs((current) => {
      const col = LEAD_COLUMNS.find((c) => c.id === id);
      if (col?.alwaysVisible) return current;

      const visibleColumns = checked
        ? [...current.visibleColumns, id]
        : current.visibleColumns.filter((c) => c !== id);

      const next = { ...current, visibleColumns };
      saveLeadsTablePrefs(next);
      return next;
    });
  }

  function setPageSize(size: number) {
    setPage(1);
    setPrefs((current) => {
      const next = { ...current, pageSize: size };
      saveLeadsTablePrefs(next);
      return next;
    });
  }

  function resetColumns() {
    const defaults: typeof prefs = {
      visibleColumns: LEAD_COLUMNS.filter((c) => c.defaultVisible).map(
        (c) => c.id,
      ),
      pageSize: prefs.pageSize,
    };
    saveLeadsTablePrefs(defaults);
    setPrefs(defaults);
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${total} leads · ${prefs.visibleColumns.length} columns visible`}
        actions={
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Columns3 className="mr-1 size-4" />
                    Columns
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LEAD_COLUMNS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={prefs.visibleColumns.includes(col.id)}
                    disabled={col.alwaysVisible}
                    onCheckedChange={(checked) =>
                      toggleColumn(col.id, checked === true)
                    }
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={resetColumns}>
                  Reset to defaults
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid w-full max-w-xs gap-1.5">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              placeholder="CTO, Engineer…"
              value={role}
              onChange={(e) => {
                setPage(1);
                setRole(e.target.value);
              }}
            />
          </div>
          <div className="grid w-full max-w-xs gap-1.5">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              placeholder="Acme AI"
              value={company}
              onChange={(e) => {
                setPage(1);
                setCompany(e.target.value);
              }}
            />
          </div>
          <div className="grid w-full max-w-xs gap-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setPage(1);
                setStatus(v ?? 'all');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid w-full max-w-[120px] gap-1.5">
            <Label>Rows</Label>
            <Select
              value={String(prefs.pageSize)}
              onValueChange={(v) => setPageSize(Number(v ?? 20))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border">
          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              No leads found. Run a search to discover leads.
            </div>
          ) : (
            <LeadsDataTable leads={leads} visibleColumns={prefs.visibleColumns} />
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} · showing {leads.length} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
