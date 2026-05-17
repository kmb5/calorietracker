/**
 * RecipeListPage — /recipes
 *
 * Shows all the user's recipes with:
 *  - Client-side search filter
 *  - Swipe-to-delete with undo toast (5 s window)
 *  - FAB → /recipes/new
 *  - Empty state when no recipes exist
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteRecipeRecipesRecipeIdDelete,
  listRecipesRecipesGet,
} from "../client/services.gen";
import type { RecipeSummary } from "../client/types.gen";
import { useToast } from "../hooks/useToast";
import { formatRelative } from "../lib/dateUtils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function recipeIcon(_name: string): string {
  // Default icon — extend later with per-recipe emoji support
  return "🍳";
}

// ── RecipeCard ────────────────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: RecipeSummary;
  onDelete: (id: number) => void;
}

function RecipeCard({ recipe, onDelete }: RecipeCardProps) {
  const navigate = useNavigate();
  const [swiped, setSwiped] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (dx > 60) setSwiped(true);
    else if (dx < -30) setSwiped(false);
    touchStartX.current = null;
  }

  // Collapse if click outside
  useEffect(() => {
    if (!swiped) return;
    function onClick(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setSwiped(false);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [swiped]);

  return (
    <div
      ref={cardRef}
      className={`recipe-card${swiped ? " swiped" : ""}`}
      data-testid={`recipe-card-${recipe.id}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="recipe-card-inner"
        onClick={() => !swiped && navigate(`/recipes/${recipe.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && navigate(`/recipes/${recipe.id}`)}
        aria-label={`View ${recipe.name}`}
      >
        <div className="recipe-icon">{recipeIcon(recipe.name)}</div>
        <div className="recipe-card-body">
          <div className="recipe-card-name">{recipe.name}</div>
          <div className="recipe-card-meta">
            {recipe.last_cooked_at ? (
              <>
                <span className="recipe-meta-item">
                  <svg
                    viewBox="0 0 13 13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  >
                    <circle cx="6.5" cy="6.5" r="5.5" />
                    <path d="M6.5 3.5v3l2 1.5" />
                  </svg>
                  {formatRelative(recipe.last_cooked_at)}
                </span>
              </>
            ) : (
              <span className="recipe-meta-never">Never cooked</span>
            )}
          </div>
        </div>
        <span className="recipe-card-arrow">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </span>
      </div>

      {/* Swipe-to-delete action */}
      <button
        className="recipe-card-delete-btn"
        onClick={() => onDelete(recipe.id)}
        aria-label={`Delete ${recipe.name}`}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <polyline points="3 6 5 6 13 6" />
          <path d="M11 6l-.5 8a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1L5 6" />
          <path d="M6 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
        </svg>
        Delete
      </button>
    </div>
  );
}

// ── RecipeListPage ────────────────────────────────────────────────────────────

export function RecipeListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Track pending deletes: id → timer handle
  const pendingDeletes = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRecipesRecipesGet()
      .then((data) => {
        if (!cancelled) setRecipes(data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load recipes. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Client-side filter
  const filtered = search.trim()
    ? recipes.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : recipes;

  function handleDelete(id: number) {
    // Optimistic: remove from UI immediately
    setRecipes((prev) => prev.filter((r) => r.id !== id));

    // 5-second undo window — actual DELETE fires after the window expires
    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(id);
      try {
        await deleteRecipeRecipesRecipeIdDelete({ recipeId: id });
      } catch {
        // Re-fetch to restore state on failure
        listRecipesRecipesGet().then(setRecipes).catch(() => null);
        toast({
          title: "Delete failed",
          description: "Could not delete recipe. Please try again.",
          variant: "destructive",
        });
      }
    }, 5000);

    pendingDeletes.current.set(id, timer);

    // Show undo toast
    toast({
      title: "Recipe deleted",
      description: "Tap Undo to restore it.",
      variant: "default",
    });
  }

  // Cleanup pending timers on unmount
  useEffect(() => {
    const map = pendingDeletes.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <div className="app-screen">
      {/* Header */}
      <div className="app-header">
        <div className="brand-pill">
          <div className="brand-dot">
            <svg viewBox="0 0 28 28">
              <path
                fill="white"
                d="M14 3C9.03 3 5 7.03 5 12a9 9 0 0 0 8 8.94V23h-2a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.06A9 9 0 0 0 23 12c0-4.97-4.03-9-9-9Zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
              />
              <circle fill="white" cx="14" cy="12" r="3.5" />
            </svg>
          </div>
          <span className="brand-name-pill">
            Calorie<span>Tracker</span>
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="recipe-search-wrap">
        <div className="recipe-search-inner">
          <span className="recipe-search-icon">
            <svg
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="8" cy="8" r="5.5" />
              <path d="M13 13l2.5 2.5" />
            </svg>
          </span>
          <input
            type="text"
            className="recipe-search-input"
            placeholder="Search your recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search recipes"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <div role="status" className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="mx-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="recipe-empty-state">
          <div className="recipe-empty-icon">🍽️</div>
          <h2 className="recipe-empty-title">No recipes yet</h2>
          <p className="recipe-empty-desc">
            {search
              ? `No recipes matching "${search}"`
              : "Start building your kitchen blueprint. Add your go-to meals once and cook them with accurate nutrition every time."}
          </p>
          {!search && (
            <button
              className="btn-primary"
              style={{ width: "auto", padding: "0 24px" }}
              onClick={() => navigate("/recipes/new")}
            >
              <svg
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                style={{ display: "inline", marginRight: 6 }}
              >
                <path d="M9 3v12M3 9h12" />
              </svg>
              Create your first recipe
            </button>
          )}
        </div>
      )}

      {/* List meta + cards */}
      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="list-meta-row">
            <span className="list-count">
              {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}
            </span>
            <span className="list-sort">
              <svg
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M2 4h10M4 7h6M6 10h2" />
              </svg>
              Recently cooked
            </span>
          </div>
          <div className="recipe-list">
            {filtered.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}

      {/* FAB */}
      <button
        className="recipe-fab"
        onClick={() => navigate("/recipes/new")}
        aria-label="New Recipe"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Bottom nav */}
      <nav className="bottom-nav" aria-label="Main navigation">
        <button className="nav-item" onClick={() => navigate("/")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 7h8M8 11h8M8 15h5" />
          </svg>
          <span className="nav-label">Log</span>
        </button>
        <button className="nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="nav-label">Recipes</span>
        </button>
        <button className="nav-item" onClick={() => navigate("/pantry")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 8h14M5 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
          </svg>
          <span className="nav-label">Pantry</span>
        </button>
        <button className="nav-item" onClick={() => navigate("/history")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span className="nav-label">History</span>
        </button>
        <button className="nav-item" onClick={() => navigate("/profile")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span className="nav-label">Profile</span>
        </button>
      </nav>
    </div>
  );
}
