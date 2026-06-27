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
              <TableCell className="max-w-[160px] truncate">{lead.role}</TableCell>
            ) : null}
            {show('company') ? (
              <TableCell className="max-w-[160px] truncate">{lead.company}</TableCell>
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
