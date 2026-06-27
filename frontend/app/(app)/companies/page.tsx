'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Loader2 } from 'lucide-react';
import { CompanyDetailSheet } from '@/components/company-detail-sheet';
import { PageHeader } from '@/components/page-header';
import { PaginationBar } from '@/components/pagination-bar';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Company } from '@/lib/types';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listCompanies(page, 20);
      setCompanies(data.items);
      setTotalPages(data.totalPages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCompany(company: Company) {
    setSelectedId(company.id);
    setSheetOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Companies"
        description="Discovered company domains and scraped data"
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Click a row to view the full company profile saved in the database.
        </p>

        <div className="rounded-md border">
          <div className="divide-y md:hidden">
            {loading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="mx-auto size-5 animate-spin" />
              </div>
            ) : companies.length === 0 ? (
              <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                No companies yet. Run company discovery on enriched leads.
              </div>
            ) : (
              companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full space-y-1.5 p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
                  onClick={() => openCompany(c)}
                >
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-primary">
                    {c.domain}
                    {c.website ? (
                      <ExternalLink className="ml-1 inline size-3" />
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{c.industry ?? '—'}</span>
                    <span>
                      {c.discoveredAt
                        ? new Date(c.discoveredAt).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Discovered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No companies yet. Run company discovery on enriched leads.
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openCompany(c)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {c.website ? (
                        <a
                          href={
                            c.website.startsWith('http')
                              ? c.website
                              : `https://${c.website}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.domain}
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        c.domain
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.industry ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.discoveredAt
                        ? new Date(c.discoveredAt).toLocaleDateString()
                        : '—'}
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

      <CompanyDetailSheet
        companyId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
