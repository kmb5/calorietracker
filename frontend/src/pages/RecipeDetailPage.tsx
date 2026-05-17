/**
 * RecipeDetailPage — /recipes/:id
 *
 * Read-only view of a single recipe showing:
 *  - Recipe name + description
 *  - Last cooked date and weight (only if last_cooked_at is set)
 *  - Ingredient list in display_order with amounts
 *  - "Start Cooking" button (placeholder link to cooking mode)
 *  - "Edit Recipe" button → /recipes/:id/edit
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRecipeRecipesRecipeIdGet } from "../client/services.gen";
import type { RecipeDetail } from "../client/types.gen";
import { formatRelative } from "../lib/dateUtils";

// ── RecipeDetailPage ──────────────────────────────────────────────────────────

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const recipeId = id ? Number(id) : NaN;
  const isInvalidId = !id || isNaN(recipeId);

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(!isInvalidId);
  const [error, setError] = useState<string | null>(
    isInvalidId ? "Invalid recipe ID." : null
  );

  useEffect(() => {
    if (isInvalidId) return;

    let cancelled = false;
    getRecipeRecipesRecipeIdGet({ recipeId })
      .then((data) => {
        if (!cancelled) setRecipe(data);
      })
      .catch(() => {
        if (!cancelled) setError("Recipe not found.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isInvalidId, recipeId]);

  return (
    <div className="app-screen" style={{ overflowY: "auto" }}>
      {/* Header */}
      <div className="app-header app-header-compact">
        <button
          className="header-icon-btn"
          onClick={() => navigate("/recipes")}
          aria-label="Back"
        >
          <svg
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M11 4l-5 5 5 5" />
          </svg>
        </button>
        <div className="app-header-titles">
          <h1 className="app-header-title">{recipe ? recipe.name : "Recipe"}</h1>
        </div>
        {recipe && (
          <button
            className="header-icon-btn"
            onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
            aria-label="Edit"
          >
            <svg
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <path d="M13 2l3 3-9 9H4v-3L13 2Z" />
            </svg>
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="mx-5 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && recipe && (
        <>
          {/* Hero */}
          <div className="detail-hero">
            <span className="detail-recipe-icon" aria-hidden="true">
              🍳
            </span>
            <h2 className="detail-title">{recipe.name}</h2>
            {recipe.description && <p className="detail-desc">{recipe.description}</p>}
            <div className="detail-meta-row">
              <div className="detail-meta-chip">
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
                {recipe.last_cooked_at
                  ? `Last cooked ${formatRelative(recipe.last_cooked_at)}`
                  : "Never cooked"}
              </div>
              <div className="detail-meta-chip">
                <svg
                  viewBox="0 0 13 13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <path d="M2 11 6.5 2 11 11M3.5 8h6" />
                </svg>
                {recipe.ingredients.length}{" "}
                {recipe.ingredients.length === 1 ? "ingredient" : "ingredients"}
              </div>
            </div>
          </div>

          {/* Last cook panel (only if ever cooked) */}
          {recipe.last_cooked_at && recipe.last_cooked_weight_g && (
            <div className="cooked-panel">
              <div className="cooked-panel-icon">
                <svg
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <rect x="3" y="8" width="12" height="8" rx="2" />
                  <path d="M9 2v6M6 4l3-2 3 2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="cooked-panel-label">Last cook</div>
                <div className="cooked-panel-value">
                  {recipe.last_cooked_weight_g}g cooked
                </div>
                <div className="cooked-panel-sub">
                  {formatRelative(recipe.last_cooked_at)}
                </div>
              </div>
            </div>
          )}

          {/* Ingredients */}
          <div className="section-card">
            <div className="section-header">
              <span className="section-title">Ingredients</span>
              <span className="section-count">{recipe.ingredients.length}</span>
            </div>
            {recipe.ingredients.map((ri) => (
              <div className="ingredient-row" key={ri.id}>
                <div className="ingredient-dot" />
                <span className="ingredient-name">{ri.ingredient.name}</span>
                <span className="ingredient-amount">
                  {ri.amount} {ri.ingredient.unit}
                </span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="detail-actions">
            <button
              className="btn-primary"
              onClick={() => navigate(`/recipes/${recipe.id}/cook`)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <svg
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                style={{ width: 16, height: 16 }}
              >
                <path d="M9 2C5.1 2 2 5.1 2 9s3.1 7 7 7 7-3.1 7-7" />
                <path d="M14 2l4 4-6 6" />
              </svg>
              Start Cooking Mode
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
            >
              <svg
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              >
                <path d="M13 2l3 3-9 9H4v-3L13 2Z" />
              </svg>
              Edit Recipe
            </button>
          </div>
        </>
      )}
    </div>
  );
}
