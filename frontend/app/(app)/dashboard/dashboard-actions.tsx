'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export function DashboardActions() {
  const router = useRouter();

  async function syncGmail() {
    try {
      const result = await api.syncGmailReplies();
      toast.success(
        `Gmail sync: ${result.processed ?? 0} processed, ${result.matched ?? 0} matched`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gmail sync failed');
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void syncGmail()}>
      Sync Gmail replies
    </Button>
  );
}
