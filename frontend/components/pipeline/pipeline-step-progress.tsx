'use client';

import { cn } from '@/lib/utils';
import type { PipelineLogEntry, PipelineStep } from '@/lib/types';

const STEP_ORDER: PipelineStep[] = [
  'ENRICHMENT',
  'COMPANY_DISCOVERY',
  'CONTACT_DISCOVERY',
  'VERIFICATION',
  'EMAIL_GENERATION',
  'CAMPAIGN_SENDING',
  'GMAIL_SYNC',
];

export function PipelineStepProgress({
  entry,
  stepLabels,
  compact,
}: {
  entry: PipelineLogEntry;
  stepLabels: Record<PipelineStep, string>;
  compact?: boolean;
}) {
  const completed = new Set(entry.completedSteps);
  const next = entry.nextStep;
  const failed = entry.failedStep;

  return (
    <div className={cn('flex flex-wrap gap-1', compact && 'max-w-[320px]')}>
      {STEP_ORDER.map((step) => {
        const isDone = completed.has(step);
        const isNext = next === step && !isDone;
        const isFailed = failed === step;

        return (
          <span
            key={step}
            title={stepLabels[step]}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight',
              isFailed && 'bg-destructive/15 text-destructive',
              isDone && !isFailed && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
              isNext && !isFailed && 'bg-primary/15 text-primary ring-1 ring-primary/30',
              !isDone && !isNext && !isFailed && 'bg-muted text-muted-foreground',
            )}
          >
            {compact ? stepLabels[step].split(' ')[0] : stepLabels[step]}
          </span>
        );
      })}
    </div>
  );
}
