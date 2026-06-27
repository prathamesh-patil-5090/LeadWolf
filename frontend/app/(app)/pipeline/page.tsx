'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { PipelineLogsTable } from '@/components/pipeline/pipeline-logs-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import type { PipelineLogs } from '@/lib/types';

export default function PipelinePage() {
  const [logs, setLogs] = useState<PipelineLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryingPending, setRetryingPending] = useState(false);
  const [retryingLeadId, setRetryingLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLogs(await api.getPipelineLogs(100));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load pipeline logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  async function retryAllPending() {
    setRetryingPending(true);
    try {
      const result = await api.retryPending(100);
      toast.success(
        `Queued ${result.requeued ?? 0} pending lead(s) (${result.alreadyInQueue ?? 0} already in queue)`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to queue pending leads');
    } finally {
      setRetryingPending(false);
    }
  }

  async function retryAllFailed() {
    setRetryingAll(true);
    try {
      const result = await api.retryFailed(50);
      toast.success(`Re-queued ${result.requeued ?? 0} failed lead(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setRetryingAll(false);
    }
  }

  async function retryLead(leadId: string) {
    setRetryingLeadId(leadId);
    try {
      await api.enqueueLead(leadId);
      toast.success('Lead re-queued for pipeline');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to re-queue lead');
    } finally {
      setRetryingLeadId(null);
    }
  }

  const queue = logs?.queue;

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Full pipeline activity — pending, failed, and completed runs"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-1 size-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={retryingPending}
              onClick={() => void retryAllPending()}
            >
              {retryingPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              Queue pending
            </Button>
            <Button
              size="sm"
              disabled={retryingAll}
              onClick={() => void retryAllFailed()}
            >
              {retryingAll ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              Retry all failed
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-6">
        {loading && !logs ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : queue ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <QueueCard
                title="Queue"
                value={queue.enabled ? 'BullMQ' : 'Sync mode'}
                hint={queue.enabled ? 'Redis connected' : 'LEAD_PIPELINE_SYNC=true'}
              />
              <QueueCard title="Waiting" value={String(queue.waiting)} />
              <QueueCard title="Active" value={String(queue.active)} highlight={queue.active > 0} />
              <QueueCard title="Delayed" value={String(queue.delayed)} />
              <QueueCard title="Completed (Redis)" value={String(queue.completed)} />
              <QueueCard
                title="Failed (Redis)"
                value={String(queue.failed)}
                danger={queue.failed > 0}
              />
              <QueueCard
                title="Failed (DB)"
                value={String(logs?.failed.length ?? 0)}
                danger={(logs?.failed.length ?? 0) > 0}
              />
            </div>

            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">
                  Pending ({logs?.pending.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="failed">
                  Failed ({logs?.failed.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed ({logs?.completed.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                <LogCard
                  title="Pending & in progress"
                  description="Leads waiting in BullMQ (waiting, active, delayed) or progressing through pipeline steps in the database."
                  actions={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retryingPending || (logs?.pending.length ?? 0) === 0}
                      onClick={() => void retryAllPending()}
                    >
                      {retryingPending ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : null}
                      Queue all not queued
                    </Button>
                  }
                >
                  {logs ? (
                    <PipelineLogsTable
                      entries={logs.pending}
                      stepLabels={logs.stepLabels}
                      variant="pending"
                      onRetry={(id) => void retryLead(id)}
                      retryingId={retryingLeadId}
                    />
                  ) : null}
                </LogCard>
              </TabsContent>

              <TabsContent value="failed">
                <LogCard
                  title="Failed runs"
                  description="BullMQ failed jobs and leads with FAILED_* status, including step and error message."
                >
                  {logs ? (
                    <PipelineLogsTable
                      entries={logs.failed}
                      stepLabels={logs.stepLabels}
                      variant="failed"
                      onRetry={(id) => void retryLead(id)}
                      retryingId={retryingLeadId}
                    />
                  ) : null}
                </LogCard>
              </TabsContent>

              <TabsContent value="completed">
                <LogCard
                  title="Completed"
                  description="Leads that reached sent, opened, replied, or bounced — and recently finished BullMQ jobs."
                >
                  {logs ? (
                    <PipelineLogsTable
                      entries={logs.completed}
                      stepLabels={logs.stepLabels}
                      variant="completed"
                    />
                  ) : null}
                </LogCard>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </>
  );
}

function QueueCard({
  title,
  value,
  hint,
  danger,
  highlight,
}: {
  title: string;
  value: string;
  hint?: string;
  danger?: boolean;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle
          className={`text-xl tabular-nums ${
            danger ? 'text-destructive' : highlight ? 'text-primary' : ''
          }`}
        >
          {value}
        </CardTitle>
        {hint ? (
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}

function LogCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 pb-2">{children}</CardContent>
    </Card>
  );
}
