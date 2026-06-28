'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Play, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type { SearchRecipe } from '@/lib/types';

const LIMIT_OPTIONS = [5, 10, 15, 25, 50] as const;

type RecipeDraft = {
  name: string;
  description: string;
  query: string;
  role: string;
  rolesText: string;
  location: string;
  company: string;
  limit: number;
  expandTechRoles: boolean;
};

function toDraft(recipe: SearchRecipe): RecipeDraft {
  return {
    name: recipe.name,
    description: recipe.description ?? '',
    query: recipe.query,
    role: recipe.role ?? '',
    rolesText: recipe.roles.join('\n'),
    location: recipe.location ?? '',
    company: recipe.company ?? '',
    limit: recipe.limit,
    expandTechRoles: recipe.expandTechRoles,
  };
}

function parseRoles(text: string) {
  return text
    .split(/[\n,]+/)
    .map((role) => role.trim())
    .filter(Boolean);
}

function draftsEqual(a: RecipeDraft, b: RecipeDraft) {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.query === b.query &&
    a.role === b.role &&
    a.rolesText === b.rolesText &&
    a.location === b.location &&
    a.company === b.company &&
    a.limit === b.limit &&
    a.expandTechRoles === b.expandTechRoles
  );
}

export function SearchRecipesPanel() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<SearchRecipe[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RecipeDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.listSearchRecipes();
      setRecipes(items);
      setDrafts(
        Object.fromEntries(items.map((recipe) => [recipe.id, toDraft(recipe)])),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(id: string, patch: Partial<RecipeDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id]!, ...patch },
    }));
  }

  async function saveRecipe(recipe: SearchRecipe) {
    const draft = drafts[recipe.id];
    if (!draft) return;

    if (draft.query.trim().length < 2) {
      toast.error('Query must be at least 2 characters');
      return;
    }

    setSavingId(recipe.id);
    try {
      const roles = parseRoles(draft.rolesText);
      const updated = await api.updateSearchRecipe(recipe.id, {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        query: draft.query.trim(),
        role: roles.length > 0 ? '' : draft.role.trim() || undefined,
        roles,
        location: draft.location.trim() || undefined,
        company: draft.company.trim() || undefined,
        limit: draft.limit,
        expandTechRoles: draft.expandTechRoles,
      });
      setRecipes((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDrafts((current) => ({
        ...current,
        [updated.id]: toDraft(updated),
      }));
      toast.success(`Saved “${updated.name}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save recipe');
    } finally {
      setSavingId(null);
    }
  }

  async function runRecipe(recipe: SearchRecipe) {
    const draft = drafts[recipe.id];
    if (!draft) return;

    if (draft.query.trim().length < 2) {
      toast.error('Query must be at least 2 characters');
      return;
    }

    setRunningId(recipe.id);
    try {
      const roles = parseRoles(draft.rolesText);
      const job = await api.startSearch({
        query: draft.query.trim(),
        role: roles.length > 0 ? undefined : draft.role.trim() || undefined,
        roles: roles.length > 0 ? roles : undefined,
        expandTechRoles: draft.expandTechRoles,
        location: draft.location.trim() || undefined,
        company: draft.company.trim() || undefined,
        limit: draft.limit,
      });
      toast.success(
        job.status === 'COMPLETED'
          ? `Search done — ${job.newLeadsFound} new lead(s)`
          : 'Search started — open Search page to track progress',
      );
      router.push(`/search?jobId=${job.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setRunningId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-24 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search recipes</CardTitle>
        <CardDescription>
          Saved CRag outreach searches — edit and save, or run directly.{' '}
          <Link href="/search" className="text-primary hover:underline">
            Open search page
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recipes.map((recipe) => {
          const draft = drafts[recipe.id];
          if (!draft) return null;

          const dirty = !draftsEqual(draft, toDraft(recipe));
          const useMultipleRoles = parseRoles(draft.rolesText).length > 0;

          return (
            <div
              key={recipe.id}
              className="space-y-3 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{recipe.name}</p>
                  <p className="text-xs text-muted-foreground">{recipe.slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savingId === recipe.id}
                    onClick={() => void saveRecipe(recipe)}
                  >
                    {savingId === recipe.id ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <Save className="mr-1 size-3" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    disabled={runningId === recipe.id || dirty}
                    title={dirty ? 'Save changes before running' : undefined}
                    onClick={() => void runRecipe(recipe)}
                  >
                    {runningId === recipe.id ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <Play className="mr-1 size-3" />
                    )}
                    Run search
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) =>
                      updateDraft(recipe.id, { name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={draft.description}
                    rows={2}
                    onChange={(e) =>
                      updateDraft(recipe.id, { description: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Query</Label>
                  <Input
                    value={draft.query}
                    onChange={(e) =>
                      updateDraft(recipe.id, { query: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Location</Label>
                  <Input
                    value={draft.location}
                    onChange={(e) =>
                      updateDraft(recipe.id, { location: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Single role</Label>
                  <Input
                    value={draft.role}
                    disabled={useMultipleRoles}
                    onChange={(e) =>
                      updateDraft(recipe.id, { role: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Company</Label>
                  <Input
                    value={draft.company}
                    onChange={(e) =>
                      updateDraft(recipe.id, { company: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Multiple roles (one per line)</Label>
                  <Textarea
                    value={draft.rolesText}
                    rows={3}
                    className="font-mono text-xs"
                    onChange={(e) =>
                      updateDraft(recipe.id, { rolesText: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Limit</Label>
                  <Select
                    value={String(draft.limit)}
                    onValueChange={(v) =>
                      updateDraft(recipe.id, { limit: Number(v ?? 15) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIMIT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} leads
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 self-end pb-2">
                  <Checkbox
                    checked={draft.expandTechRoles}
                    disabled={useMultipleRoles || Boolean(draft.role.trim())}
                    onCheckedChange={(checked) =>
                      updateDraft(recipe.id, {
                        expandTechRoles: checked === true,
                      })
                    }
                  />
                  <span className="text-sm">Expand tech roles</span>
                </label>
              </div>

              {dirty ? (
                <p className="text-xs text-amber-600">
                  Unsaved changes — click Save before running.
                </p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
