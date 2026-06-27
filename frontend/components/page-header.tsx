import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = 'Back',
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="border-b bg-background px-4 py-4 sm:px-6 sm:py-5">
      {backHref ? (
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'mb-3 inline-flex w-fit gap-1.5',
          )}
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
