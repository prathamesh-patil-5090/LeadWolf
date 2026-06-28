'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { SearchRecipe } from '@/lib/types';

export function SearchRecipesPicker({
  activeRecipeId,
  onSelect,
  onSave,
  saving,
}: {
  activeRecipeId: string | null;
  onSelect: (recipe: SearchRecipe) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [recipes, setRecipes] = useState<SearchRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecipes(await api.listSearchRecipes());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRecipe = recipes.find((r) => r.id === activeRecipeId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4" />
          Search recipes
        </CardTitle>
        <CardDescription>
          Pick a saved CRag outreach search — it fills the form below. Edit
          fields, then save or start search.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          recipes.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
                activeRecipeId === recipe.id &&
                  'border-primary bg-primary/5 ring-1 ring-primary/20',
              )}
              onClick={() => onSelect(recipe)}
            >
              <p className="font-medium text-sm">{recipe.name}</p>
              {recipe.description ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {recipe.description}
                </p>
              ) : null}
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {recipe.query}
                {recipe.location ? ` · ${recipe.location}` : ''}
                {recipe.roles.length > 0
                  ? ` · ${recipe.roles.length} roles`
                  : recipe.role
                    ? ` · ${recipe.role}`
                    : ''}
                {' · '}
                {recipe.limit} max
              </p>
            </button>
          ))
        )}

        {activeRecipe ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <Save className="mr-1 size-3" />
            )}
            Save “{activeRecipe.name}”
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function recipeToFormValues(recipe: SearchRecipe) {
  return {
    query: recipe.query,
    role: recipe.role ?? '',
    rolesText: recipe.roles.join('\n'),
    location: recipe.location ?? '',
    company: recipe.company ?? '',
    limit: recipe.limit,
    expandTechRoles: recipe.expandTechRoles,
  };
}
