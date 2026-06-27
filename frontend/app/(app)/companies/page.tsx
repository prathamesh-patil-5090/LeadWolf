'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Loader2 } from 'lucide-react';
import { CompanyDetailSheet } from '@/components/company-detail-sheet';
import { PageHeader } from '@/components/page-header';
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
      <div className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          Click a row to view the full company profile saved in the database.
        </p>

        <div className="rounded-md border">
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

        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
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

      <CompanyDetailSheet
        companyId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
