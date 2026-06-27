'use client';

import Link from 'next/link';
import { Loader2, RotateCcw } from 'lucide-react';
import { PipelineStepProgress } from '@/components/pipeline/pipeline-step-progress';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PipelineLogEntry, PipelineStep } from '@/lib/types';

export function PipelineLogsTable({
  entries,
  stepLabels,
  variant,
  onRetry,
  retryingId,
}: {
  entries: PipelineLogEntry[];
  stepLabels: Record<PipelineStep, string>;
  variant: 'pending' | 'failed' | 'completed';
  onRetry?: (leadId: string) => void;
  retryingId?: string | null;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        {variant === 'pending' && 'No leads waiting in queue or in progress.'}
        {variant === 'failed' && 'No failed pipeline runs.'}
        {variant === 'completed' && 'No completed pipeline runs yet.'}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Pipeline steps</TableHead>
          {variant === 'pending' ? <TableHead>Queue</TableHead> : null}
          {variant === 'failed' ? <TableHead>Error</TableHead> : null}
          <TableHead>Updated</TableHead>
          <TableHead className="w-[100px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={`${entry.source}-${entry.jobId ?? entry.leadId}`}>
            <TableCell>
              <Link
                href={`/leads/${entry.leadId}`}
                className="font-medium hover:underline"
              >
                {entry.leadName}
              </Link>
              <div className="text-xs text-muted-foreground">
                {entry.company}
                {entry.email ? ` · ${entry.email}` : ''}
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge status={entry.status} />
            </TableCell>
            <TableCell>
              <PipelineStepProgress entry={entry} stepLabels={stepLabels} compact />
              {entry.nextStep && variant !== 'completed' ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Next: {stepLabels[entry.nextStep]}
                </p>
              ) : null}
            </TableCell>
            {variant === 'pending' ? (
              <TableCell>
                {entry.queueState ? (
                  <Badge variant="outline" className="capitalize">
                    {entry.queueState}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Not queued</span>
                )}
                {entry.attemptsMade ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Attempt {entry.attemptsMade}
                  </p>
                ) : null}
              </TableCell>
            ) : null}
            {variant === 'failed' ? (
              <TableCell className="max-w-[280px]">
                <p className="line-clamp-3 text-xs text-destructive">
                  {entry.error ?? 'Unknown error'}
                </p>
                {entry.failedStep ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Failed at {stepLabels[entry.failedStep]}
                    {entry.retryCount > 0 ? ` · ${entry.retryCount} retries` : ''}
                  </p>
                ) : null}
              </TableCell>
            ) : null}
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(entry.updatedAt).toLocaleString()}
              {entry.finishedAt ? (
                <p className="mt-0.5">Done {new Date(entry.finishedAt).toLocaleString()}</p>
              ) : null}
            </TableCell>
            <TableCell>
              {variant === 'failed' && onRetry ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={retryingId === entry.leadId}
                  onClick={() => onRetry(entry.leadId)}
                >
                  {retryingId === entry.leadId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" nativeButton={false} render={
                  <Link href={`/leads/${entry.leadId}`}>View</Link>
                } />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
