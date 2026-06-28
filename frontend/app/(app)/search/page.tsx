'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import {
  recipeToFormValues,
  SearchRecipesPicker,
} from '@/components/search-recipes-picker';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type { Lead, LeadSearchJob, LeadSearchJobStatus, SearchRecipe } from '@/lib/types';

const LIMIT_OPTIONS = [5, 10, 25, 50, 100] as const;

function parseRolesInput(text: string) {
  return text
    .split(/[\n,]+/)
    .map((role) => role.trim())
    .filter(Boolean);
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('Senior Software Engineers India');
  const [role, setRole] = useState('');
  const [rolesText, setRolesText] = useState('');
  const [location, setLocation] = useState('India');
  const [company, setCompany] = useState('');
  const [limit, setLimit] = useState(25);
  const [expandTechRoles, setExpandTechRoles] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [job, setJob] = useState<LeadSearchJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsedRoles = parseRolesInput(rolesText);
  const useMultipleRoles = parsedRoles.length > 0;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (!jobId) return;

    void api
      .getSearchJob(jobId)
      .then((loaded) => {
        setJob(loaded);
        if (loaded.status === 'PENDING' || loaded.status === 'RUNNING') {
          void pollJob(loaded.id);
        }
      })
      .catch(() => {
        toast.error('Failed to load search job');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function loadRecipe(recipe: SearchRecipe) {
    const values = recipeToFormValues(recipe);
    setQuery(values.query);
    setRole(values.role);
    setRolesText(values.rolesText);
    setLocation(values.location);
    setCompany(values.company);
    setLimit(values.limit);
    setExpandTechRoles(values.expandTechRoles);
    setActiveRecipeId(recipe.id);
    toast.message(`Loaded “${recipe.name}”`);
  }

  async function saveActiveRecipe() {
    if (!activeRecipeId) return;

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      toast.error('Query must be at least 2 characters');
      return;
    }

    setSavingRecipe(true);
    try {
      const roles = parseRolesInput(rolesText);
      await api.updateSearchRecipe(activeRecipeId, {
        query: trimmedQuery,
        role: roles.length > 0 ? '' : role.trim() || undefined,
        roles,
        location: location.trim() || undefined,
        company: company.trim() || undefined,
        limit,
        expandTechRoles,
      });
      toast.success('Recipe saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save recipe');
    } finally {
      setSavingRecipe(false);
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollJob(jobId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const updated = await api.getSearchJob(jobId);
        setJob(updated);
        if (updated.status === 'COMPLETED' || updated.status === 'FAILED') {
          stopPolling();
          if (updated.status === 'COMPLETED') {
            toast.success(
              `Found ${updated.newLeadsFound} new lead(s) (${updated.skippedExisting} skipped)`,
            );
          } else {
            toast.error(updated.error ?? 'Search failed');
          }
        }
      } catch (e) {
        stopPolling();
        toast.error(e instanceof Error ? e.message : 'Poll failed');
      }
    }, 2000);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      toast.error('Query must be at least 2 characters');
      return;
    }

    setSubmitting(true);
    try {
      const started = await api.startSearch({
        query: trimmedQuery,
        role: useMultipleRoles ? undefined : role.trim() || undefined,
        roles: useMultipleRoles ? parsedRoles : undefined,
        expandTechRoles,
        location: location.trim() || undefined,
        company: company.trim() || undefined,
        limit,
      });
      setJob(started);
      if (started.status === 'COMPLETED' || started.status === 'FAILED') {
        if (started.status === 'COMPLETED') {
          toast.success(
            `Search done — ${started.newLeadsFound} new lead(s)`,
          );
        } else {
          toast.error(started.error ?? 'Search failed');
        }
      } else {
        toast.message('Search queued — polling for results…');
        void pollJob(started.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Lead search"
        description="Discover developers via GitHub + LinkedIn (Bright Data when configured)"
      />
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="space-y-4">
          <SearchRecipesPicker
            activeRecipeId={activeRecipeId}
            onSelect={loadRecipe}
            onSave={() => void saveActiveRecipe()}
            saving={savingRecipe}
          />

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>New search</CardTitle>
            <CardDescription>
              Maps to <code className="text-xs">POST /api/leads/search</code>.
              Async when{' '}
              <code className="text-xs">LEAD_SEARCH_SYNC=false</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
              <div className="grid gap-1.5">
                <Label htmlFor="query">
                  Query <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Senior Software Engineers India"
                  minLength={2}
                  maxLength={200}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Main search phrase (2–200 chars). Used for GitHub and LinkedIn
                  discovery keywords.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="India, Berlin, remote…"
                    maxLength={100}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme AI, Stripe…"
                    maxLength={100}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Role targeting</p>
                  <p className="text-xs text-muted-foreground">
                    GitHub runs one search per role. LinkedIn uses role terms in
                    discovery queries.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="role">Single role</Label>
                  <Input
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="CTO, Senior Software Engineer…"
                    maxLength={100}
                    disabled={useMultipleRoles}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="roles">Multiple roles</Label>
                  <Textarea
                    id="roles"
                    value={rolesText}
                    onChange={(e) => setRolesText(e.target.value)}
                    placeholder={'CTO\nVP Engineering\nStaff Engineer'}
                    rows={4}
                    className="min-h-20 font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    One role per line or comma-separated. Overrides single role
                    when filled.
                  </p>
                </div>

                <label className="flex items-start gap-2">
                  <Checkbox
                    checked={expandTechRoles}
                    onCheckedChange={(checked) =>
                      setExpandTechRoles(checked === true)
                    }
                    disabled={Boolean(role.trim()) || useMultipleRoles}
                  />
                  <span className="text-sm leading-snug">
                    <span className="font-medium">Expand tech roles</span>
                    <span className="block text-xs text-muted-foreground">
                      When no role is set, search ~50 GitHub tech titles (CTO,
                      Staff Engineer, ML Engineer, …). Default on the API.
                    </span>
                  </span>
                </label>
              </div>

              <Separator />

              <div className="grid gap-1.5">
                <Label htmlFor="limit">Result limit</Label>
                <Select
                  value={String(limit)}
                  onValueChange={(v) => setLimit(Number(v ?? 25))}
                >
                  <SelectTrigger id="limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIMIT_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} leads max
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Search className="mr-2 size-4" />
                    Start search
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Search job</CardTitle>
                <CardDescription>
                  {job
                    ? `Job ${job.id.slice(0, 8)}… · started ${new Date(job.createdAt).toLocaleString()}`
                    : 'Run a search to see status and discovered leads'}
                </CardDescription>
              </div>
              {job ? <JobStatusBadge status={job.status} /> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!job ? (
              <p className="text-sm text-muted-foreground">No active job.</p>
            ) : (
              <>
                <SearchCriteriaSummary job={job} />

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="New leads" value={job.newLeadsFound} />
                  <Stat label="Total found" value={job.leadsFound} />
                  <Stat label="Skipped (dupes)" value={job.skippedExisting} />
                  <Stat label="Limit" value={job.limit} />
                </div>

                {job.error ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {job.error}
                  </p>
                ) : null}

                {job.status === 'PENDING' || job.status === 'RUNNING' ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {job.status === 'PENDING'
                      ? 'Queued — waiting for worker…'
                      : 'Running search providers…'}
                  </div>
                ) : null}

                {job.leads?.length ? (
                  <div className="rounded-md border">
                    <div className="divide-y md:hidden">
                      {job.leads.map((lead: Lead) => (
                        <Link
                          key={lead.id}
                          href={`/leads/${lead.id}`}
                          className="block space-y-1.5 p-4 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium">{lead.name}</p>
                              <p className="truncate text-sm text-muted-foreground">
                                {lead.role}
                              </p>
                            </div>
                            <StatusBadge status={lead.status} />
                          </div>
                          <p className="text-sm">{lead.company}</p>
                          {lead.location ? (
                            <p className="text-xs text-muted-foreground">
                              {lead.location}
                            </p>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                    <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {job.leads.map((lead: Lead) => (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <Link
                                href={`/leads/${lead.id}`}
                                className="font-medium hover:underline"
                              >
                                {lead.name}
                              </Link>
                              {lead.location ? (
                                <p className="text-xs text-muted-foreground">
                                  {lead.location}
                                </p>
                              ) : null}
                            </TableCell>
                            <TableCell className="max-w-[140px] truncate text-sm">
                              {lead.role}
                            </TableCell>
                            <TableCell className="max-w-[120px] truncate text-sm">
                              {lead.company}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={lead.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                ) : job.status === 'COMPLETED' ? (
                  <p className="text-sm text-muted-foreground">
                    Search completed with no new leads returned.
                  </p>
                ) : null}

                {job.newLeadsFound > 0 ? (
                  <Button variant="outline" size="sm" nativeButton={false} render={
                    <Link href="/leads">View all leads</Link>
                  } />
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SearchCriteriaSummary({ job }: { job: LeadSearchJob }) {
  const roleSummary =
    job.roles && job.roles.length > 0
      ? job.roles.join(', ')
      : job.role
        ? job.role
        : job.expandTechRoles !== false
          ? 'All tech roles (expanded)'
          : 'Any (no role filter)';

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <p className="mb-2 font-medium">Search criteria</p>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        <CriteriaRow label="Query" value={job.query} />
        <CriteriaRow label="Roles" value={roleSummary} />
        <CriteriaRow label="Location" value={job.location} />
        <CriteriaRow label="Company" value={job.company} />
      </dl>
    </div>
  );
}

function CriteriaRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value?.trim() ? value : '—'}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function JobStatusBadge({ status }: { status: LeadSearchJobStatus }) {
  const variant =
    status === 'COMPLETED'
      ? 'secondary'
      : status === 'FAILED'
        ? 'destructive'
        : status === 'RUNNING'
          ? 'default'
          : 'outline';

  return <Badge variant={variant}>{status}</Badge>;
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
