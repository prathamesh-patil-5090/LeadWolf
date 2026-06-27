import { Badge } from '@/components/ui/badge';
import { LEAD_STATUS_LABELS, statusVariant } from '@/lib/status';
import type { LeadStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={statusVariant(status)} className="whitespace-nowrap">
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}
