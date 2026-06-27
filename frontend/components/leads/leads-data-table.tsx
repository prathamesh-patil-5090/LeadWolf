'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LeadColumnId } from '@/lib/leads-table-prefs';
import type { Lead } from '@/lib/types';

export function LeadsDataTable({
  leads,
  visibleColumns,
}: {
  leads: Lead[];
  visibleColumns: LeadColumnId[];
}) {
  const show = (id: LeadColumnId) => visibleColumns.includes(id);

  return (
    <>
      <div className="divide-y md:hidden">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="block space-y-2 p-4 transition-colors hover:bg-muted/40 active:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{lead.name}</p>
                {show('role') ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {lead.role}
                  </p>
                ) : null}
              </div>
              {show('status') ? <StatusBadge status={lead.status} /> : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {show('company') ? (
                <MobileField label="Company" value={lead.company} />
              ) : null}
              {show('email') ? (
                <MobileField
                  label="Email"
                  value={lead.email ?? '—'}
                  className="col-span-2"
                />
              ) : null}
              {show('location') ? (
                <MobileField label="Location" value={lead.location ?? '—'} />
              ) : null}
              {show('verified') ? (
                <MobileField
                  label="Verified"
                  value={
                    lead.verified
                      ? `Yes (${lead.contactConfidence ?? 0}%)`
                      : 'No'
                  }
                />
              ) : null}
              {show('createdAt') ? (
                <MobileField
                  label="Added"
                  value={new Date(lead.createdAt).toLocaleDateString()}
                />
              ) : null}
              {show('pipeline') && lead.pipelineError ? (
                <MobileField
                  label="Pipeline"
                  value={lead.pipelineError}
                  className="col-span-2 text-destructive"
                />
              ) : null}
            </dl>
          </Link>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {show('name') ? <TableHead>Name</TableHead> : null}
              {show('role') ? <TableHead>Role</TableHead> : null}
              {show('company') ? <TableHead>Company</TableHead> : null}
              {show('email') ? <TableHead>Email</TableHead> : null}
              {show('location') ? <TableHead>Location</TableHead> : null}
              {show('status') ? <TableHead>Status</TableHead> : null}
              {show('verified') ? <TableHead>Verified</TableHead> : null}
              {show('github') ? <TableHead>GitHub</TableHead> : null}
              {show('linkedin') ? <TableHead>LinkedIn</TableHead> : null}
              {show('createdAt') ? <TableHead>Added</TableHead> : null}
              {show('pipeline') ? <TableHead>Pipeline</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id} className="hover:bg-muted/40">
                {show('name') ? (
                  <TableCell>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium hover:underline"
                    >
                      {lead.name}
                    </Link>
                  </TableCell>
                ) : null}
                {show('role') ? (
                  <TableCell className="max-w-[160px] truncate">
                    {lead.role}
                  </TableCell>
                ) : null}
                {show('company') ? (
                  <TableCell className="max-w-[160px] truncate">
                    {lead.company}
                  </TableCell>
                ) : null}
                {show('email') ? (
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {lead.email ?? '—'}
                  </TableCell>
                ) : null}
                {show('location') ? (
                  <TableCell className="max-w-[140px] truncate text-muted-foreground">
                    {lead.location ?? '—'}
                  </TableCell>
                ) : null}
                {show('status') ? (
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                ) : null}
                {show('verified') ? (
                  <TableCell className="text-sm">
                    {lead.verified
                      ? `Yes (${lead.contactConfidence ?? 0}%)`
                      : 'No'}
                  </TableCell>
                ) : null}
                {show('github') ? (
                  <TableCell>
                    <LinkCell url={lead.githubUrl} />
                  </TableCell>
                ) : null}
                {show('linkedin') ? (
                  <TableCell>
                    <LinkCell url={lead.linkedinUrl ?? lead.profileUrl} />
                  </TableCell>
                ) : null}
                {show('createdAt') ? (
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </TableCell>
                ) : null}
                {show('pipeline') ? (
                  <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                    {lead.pipelineError ?? '—'}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function MobileField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function LinkCell({ url }: { url?: string | null }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  const href = url.startsWith('http') ? url : `https://${url}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      Link
      <ExternalLink className="size-3" />
    </a>
  );
}
