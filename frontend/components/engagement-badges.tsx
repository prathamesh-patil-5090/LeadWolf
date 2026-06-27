import { Badge } from '@/components/ui/badge';
import type { EmailEngagement } from '@/lib/types';

export function EngagementBadges({
  engagement,
  leadStatus,
}: {
  engagement: EmailEngagement;
  leadStatus?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {engagement.delivered ? (
        <Badge variant="secondary" className="text-xs">
          Delivered
        </Badge>
      ) : null}
      {engagement.opened ? (
        <Badge variant="secondary" className="text-xs">
          Opened
        </Badge>
      ) : null}
      {engagement.clicked ? (
        <Badge variant="secondary" className="text-xs">
          Clicked
        </Badge>
      ) : null}
      {engagement.replied || leadStatus === 'REPLIED' ? (
        <Badge className="text-xs">Replied</Badge>
      ) : null}
      {engagement.bounced || leadStatus === 'BOUNCED' ? (
        <Badge variant="destructive" className="text-xs">
          Bounced
        </Badge>
      ) : null}
      {engagement.gmailReplyDetected ? (
        <Badge variant="outline" className="text-xs">
          Gmail reply
        </Badge>
      ) : null}
      {!engagement.opened &&
      !engagement.replied &&
      !engagement.bounced &&
      leadStatus !== 'REPLIED' &&
      leadStatus !== 'BOUNCED' ? (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          No engagement yet
        </Badge>
      ) : null}
    </div>
  );
}
