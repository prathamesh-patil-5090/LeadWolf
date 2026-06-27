import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api } from '@/lib/api';
import { DashboardActions } from './dashboard-actions';

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default async function DashboardPage() {
  let summary = null;
  let quota = null;
  let pipeline = null;
  let error: string | null = null;

  try {
    [summary, quota, pipeline] = await Promise.all([
      api.getSummary(),
      api.getQuota(),
      api.getPipelineStatus(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load dashboard';
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Outreach pipeline overview and API quotas"
        actions={<DashboardActions />}
      />
      <div className="space-y-6 p-4 sm:p-6">
        {error ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Backend unreachable</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Start the NestJS API with{' '}
              <code className="rounded bg-muted px-1">npm run start:dev</code> in{' '}
              <code className="rounded bg-muted px-1">backend/</code> and ensure{' '}
              <code className="rounded bg-muted px-1">NEXT_PUBLIC_API_URL</code>{' '}
              points to <code className="rounded bg-muted px-1">http://localhost:3001/api</code>.
            </CardContent>
          </Card>
        ) : null}

        {summary ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total leads" value={summary.leads.total} />
            <MetricCard title="Sent" value={summary.leads.sent} />
            <MetricCard
              title="Open rate"
              value={pct(summary.rates.openRate)}
              sub={`${summary.emails.opened} opens`}
            />
            <MetricCard
              title="Reply rate"
              value={pct(summary.rates.replyRate)}
              sub={`${summary.leads.replied} replied`}
            />
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {pipeline ? (
            <Card>
              <CardHeader>
                <CardTitle>Pipeline queue</CardTitle>
                <CardDescription>
                  {pipeline.enabled
                    ? 'BullMQ worker status'
                    : 'Sync mode — queue disabled'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <Stat label="Waiting" value={pipeline.waiting} />
                <Stat label="Active" value={pipeline.active} />
                <Stat label="Failed" value={pipeline.failed} highlight={pipeline.failed > 0} />
                <Stat label="Completed" value={pipeline.completed} />
                <Stat label="Delayed" value={pipeline.delayed} />
                <div className="flex items-end">
                  <Badge variant={pipeline.isEmpty ? 'secondary' : 'default'}>
                    {pipeline.isEmpty ? 'Idle' : 'Processing'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {quota ? (
            <Card>
              <CardHeader>
                <CardTitle>API quotas (today)</CardTitle>
                <CardDescription>Client-side rate limit tracking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <QuotaRow
                  name="Groq"
                  used={quota.groq.dailyUsed}
                  remaining={quota.groq.dailyRemaining}
                />
                <QuotaRow
                  name="OpenRouter"
                  used={quota.openRouter.dailyUsed}
                  remaining={quota.openRouter.dailyRemaining}
                />
                <QuotaRow
                  name="Brevo"
                  used={quota.brevo.dailyUsed}
                  remaining={quota.brevo.dailyRemaining}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function MetricCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {sub ? (
        <CardContent className="text-xs text-muted-foreground">{sub}</CardContent>
      ) : null}
    </Card>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-semibold tabular-nums ${highlight ? 'text-destructive' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

function QuotaRow({
  name,
  used,
  remaining,
}: {
  name: string;
  used: number;
  remaining: number | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-medium">{name}</span>
      <span className="tabular-nums text-muted-foreground">
        {used} used
        {remaining !== null ? ` · ${remaining} left` : ''}
      </span>
    </div>
  );
}
