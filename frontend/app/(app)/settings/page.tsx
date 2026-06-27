'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Database, Loader2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

const CONFIRM_TEXT = 'RESET';

export default function SettingsPage() {
  const [status, setStatus] = useState<{
    resetEnabled: boolean;
    redisConfigured: boolean;
  } | null>(null);
  const [dbConfirm, setDbConfirm] = useState('');
  const [redisConfirm, setRedisConfirm] = useState('');
  const [resettingDb, setResettingDb] = useState(false);
  const [resettingRedis, setResettingRedis] = useState(false);

  useEffect(() => {
    void api
      .getSettingsStatus()
      .then(setStatus)
      .catch(() => setStatus({ resetEnabled: false, redisConfigured: false }));
  }, []);

  async function handleResetDatabase() {
    if (dbConfirm !== CONFIRM_TEXT) return;
    setResettingDb(true);
    try {
      const result = await api.resetDatabase();
      const total = Object.values(result.deleted).reduce((a, b) => a + b, 0);
      toast.success(`Database cleared — ${total} row(s) deleted`);
      setDbConfirm('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Database reset failed');
    } finally {
      setResettingDb(false);
    }
  }

  async function handleResetRedis() {
    if (redisConfirm !== CONFIRM_TEXT) return;
    setResettingRedis(true);
    try {
      const result = await api.resetRedis();
      toast.success(result.message ?? 'Redis flushed');
      setRedisConfirm('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Redis reset failed');
    } finally {
      setResettingRedis(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Danger zone — destructive actions for local development"
      />

      <div className="space-y-6 p-6">
        {!status?.resetEnabled ? (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-amber-600" />
                Resets are disabled
              </CardTitle>
              <CardDescription>
                Set <code className="text-xs">ALLOW_DATA_RESET=true</code> in{' '}
                <code className="text-xs">backend/.env</code> and restart the
                API to enable database and Redis reset buttons.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Database className="size-4" />
              Reset database
            </CardTitle>
            <CardDescription>
              Permanently deletes all leads, companies, outreach emails, email
              events, search jobs, and search cursors from PostgreSQL. Schema
              stays intact.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid max-w-sm gap-1.5">
              <Label htmlFor="db-confirm">
                Type <span className="font-mono font-semibold">{CONFIRM_TEXT}</span>{' '}
                to confirm
              </Label>
              <Input
                id="db-confirm"
                value={dbConfirm}
                onChange={(e) => setDbConfirm(e.target.value)}
                placeholder={CONFIRM_TEXT}
                autoComplete="off"
              />
            </div>
            <Button
              variant="destructive"
              disabled={
                !status?.resetEnabled ||
                dbConfirm !== CONFIRM_TEXT ||
                resettingDb
              }
              onClick={() => void handleResetDatabase()}
            >
              {resettingDb ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Delete all database data
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-4" />
              Reset Redis
            </CardTitle>
            <CardDescription>
              Runs <code className="text-xs">FLUSHALL</code> on the Redis
              instance from <code className="text-xs">REDIS_URL</code>. Clears
              all BullMQ queues, job state, and cached keys.
              {!status?.redisConfigured ? (
                <span className="mt-1 block text-amber-600">
                  REDIS_URL is not configured on the backend.
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid max-w-sm gap-1.5">
              <Label htmlFor="redis-confirm">
                Type <span className="font-mono font-semibold">{CONFIRM_TEXT}</span>{' '}
                to confirm
              </Label>
              <Input
                id="redis-confirm"
                value={redisConfirm}
                onChange={(e) => setRedisConfirm(e.target.value)}
                placeholder={CONFIRM_TEXT}
                autoComplete="off"
              />
            </div>
            <Button
              variant="destructive"
              disabled={
                !status?.resetEnabled ||
                !status?.redisConfigured ||
                redisConfirm !== CONFIRM_TEXT ||
                resettingRedis
              }
              onClick={() => void handleResetRedis()}
            >
              {resettingRedis ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Flush Redis
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
