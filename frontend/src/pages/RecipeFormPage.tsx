/**
 * RecipeFormPage
 *
 * Handles both create (/recipes/new) and edit (/recipes/:id/edit).
 * - Create: empty form, POST /recipes on save, navigate to /recipes/:id
 * - Edit: fetches /recipes/:id, pre-fills, PATCH on save, navigate to /recipes/:id
 * - Edit: Delete with confirmation → DELETE /recipes/:id → navigate to /recipes
 * - Edit: Duplicate → POST /recipes/:id/duplicate → navigate to /recipes/:newId/edit
 *
 * Each ingredient row uses an inline search combobox powered by the
 * searchIngredientsIngredientsSearchGet service.
 *
 * Layout follows the s-recipe-create screen in docs/prototypes/app/index.html.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createRecipeRecipesPost,
  deleteRecipeRecipesRecipeIdDelete,
  duplicateRecipeRecipesRecipeIdDuplicatePost,
  getRecipeRecipesRecipeIdGet,
  searchIngredientsIngredientsSearchGet,
  updateRecipeRecipesRecipeIdPatch,
} from "../client/services.gen";
import type { IngredientSearchResult } from "../client/types.gen";
import { useToast } from "../hooks/useToast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface IngredientRow {
  /** Stable key for React's reconciler */
  key: string;
  ingredient: IngredientSearchResult | null;
  amount: string;
  /** Error message for this row's amount */
  amountError: string;
}

interface FormErrors {
  name: string;
  ingredients: string;
}

// ── Debounce helper ────────────────────────────────────────────────────────────
const DEBOUNCE_MS = 300;

// ── Inline ingredient search row ───────────────────────────────────────────────

interface IngredientRowSearchProps {
  row: IngredientRow;
  rowIndex: number;
  onSelectIngredient: (rowKey: string, ingredient: IngredientSearchResult) => void;
  onClearIngredient: (rowKey: string) => void;
  onAmountChange: (rowKey: string, value: string) => void;
  onRemove: (rowKey: string) => void;
}

function IngredientRowSearch({
  row,
  rowIndex,
  onSelectIngredient,
  onClearIngredient,
  onAmountChange,
  onRemove,
}: IngredientRowSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IngredientSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentQueryRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    setHighlightedIndex(0);
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    currentQueryRef.current = trimmed;
    debounceRef.current = setTimeout(async () => {
      const firedFor = trimmed;
      setIsLoading(true);
      try {
        const data = await searchIngredientsIngredientsSearchGet({ q: firedFor });
        if (currentQueryRef.current === firedFor) setResults(data);
      } catch {
        if (currentQueryRef.current === firedFor) setResults([]);
      } finally {
        if (currentQueryRef.current === firedFor) setIsLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const handleSelect = useCallback(
    (ingredient: IngredientSearchResult) => {
      onSelectIngredient(row.key, ingredient);
      setQuery("");
      setResults([]);
      setIsOpen(false);
    },
    [row.key, onSelectIngredient]
  );

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(Math.min(highlightedIndex + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(Math.max(highlightedIndex - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[highlightedIndex]) handleSelect(results[highlightedIndex]);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setQuery("");
        inputRef.current?.blur();
        break;
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const unit = row.ingredient?.unit === "ml" ? "ml" : "g";

  return (
    <div className="ingredient-form-row" style={{ position: "relative" }}>
      {/* Drag handle */}
      <div className="ingredient-row-handle" aria-hidden="true">
        <svg
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2 4h10M2 7h10M2 10h10" />
        </svg>
      </div>

      {/* Ingredient name / search input */}
      {row.ingredient ? (
        <button
          type="button"
          className="ingredient-search-input"
          style={{
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            border: "none",
            fontFamily: "var(--font-body)",
          }}
          onClick={() => onClearIngredient(row.key)}
          title="Click to change ingredient"
        >
          {row.ingredient.icon && (
            <span style={{ marginRight: 6, fontSize: 15 }}>{row.ingredient.icon}</span>
          )}
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.ingredient.name}
          </span>
        </button>
      ) : (
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls={`ingredient-listbox-${rowIndex}`}
            aria-label={`Search ingredient for row ${rowIndex + 1}`}
            autoComplete="off"
            className="ingredient-search-input"
            placeholder="Search ingredient…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query) setIsOpen(true);
            }}
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            style={{ display: "block", width: "100%", height: "100%", minHeight: 52 }}
          />

          {/* Dropdown results */}
          {isOpen && (
            <div
              id={`ingredient-listbox-${rowIndex}`}
              role="listbox"
              aria-label="Ingredient search results"
              className="ingredient-row-results"
            >
              {isLoading && (
                <div
                  style={{
                    padding: "10px 12px",
                    fontSize: 13,
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  Searching…
                </div>
              )}
              {!isLoading && query && results.length === 0 && (
                <div
                  style={{
                    padding: "10px 12px",
                    fontSize: 13,
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  No results for "{query}"
                </div>
              )}
              {results.map((ingredient, i) => (
                <div
                  key={ingredient.id}
                  role="option"
                  aria-selected={i === highlightedIndex}
                  className="ingredient-row-result-item"
                  onMouseDown={(e) => {
                    // Prevent blur on input before click
                    e.preventDefault();
                  }}
                  onClick={() => handleSelect(ingredient)}
                  onMouseEnter={() => setHighlightedIndex(i)}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>
                    {ingredient.icon ?? "🍽️"}
                  </span>
                  <span className="ingredient-row-result-name">{ingredient.name}</span>
                  <span className="ingredient-row-result-kcal">
                    {Math.round(ingredient.kcal)} kcal
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Right column: amount + unit + remove */}
      <div className="ingredient-right-col">
        <input
          type="number"
          className="ingredient-amount-input"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="0"
          value={row.amount}
          aria-label="Amount"
          onChange={(e) => onAmountChange(row.key, e.target.value)}
        />
        <span className="ingredient-unit-label">{unit}</span>
        <button
          type="button"
          className="ingredient-remove-btn"
          aria-label="Remove ingredient"
          onClick={() => onRemove(row.key)}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Row amount error */}
      {row.amountError && (
        <div
          className="ingredient-form-error"
          style={{
            position: "absolute",
            bottom: -18,
            left: 32,
            zIndex: 10,
          }}
        >
          {row.amountError}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

let rowCounter = 0;
function newRowKey() {
  return `row-${++rowCounter}`;
}

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditing = Boolean(id);
  const recipeId = id ? parseInt(id, 10) : null;

  // ── Form state ──
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<IngredientRow[]>([]);

  // ── UI state ──
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({ name: "", ingredients: "" });
  const [touched, setTouched] = useState<{ name: boolean }>({ name: false });

  // ── Load recipe in edit mode ──
  useEffect(() => {
    if (!recipeId) return;

    let cancelled = false;

    async function loadRecipe() {
      try {
        const recipe = await getRecipeRecipesRecipeIdGet({ recipeId: recipeId! });
        if (cancelled) return;
        setIsLoading(false);
        setName(recipe.name);
        setDescription(recipe.description ?? "");
        setRows(
          recipe.ingredients
            .sort((a, b) => a.display_order - b.display_order)
            .map((ri) => ({
              key: newRowKey(),
              ingredient: {
                id: ri.ingredient.id,
                name: ri.ingredient.name,
                unit: ri.ingredient.unit,
                portion_size: ri.ingredient.portion_size,
                kcal: ri.ingredient.kcal,
                is_system: ri.ingredient.is_system,
                icon: ri.ingredient.icon,
              },
              amount: String(ri.amount),
              amountError: "",
            }))
        );
      } catch {
        if (cancelled) return;
        setIsLoading(false);
        toast({ variant: "destructive", title: "Could not load recipe" });
        navigate("/recipes");
      }
    }

    void loadRecipe();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  // ── Row handlers ──
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { key: newRowKey(), ingredient: null, amount: "", amountError: "" },
    ]);
    // Clear ingredients error when a row is added
    setErrors((e) => ({ ...e, ingredients: "" }));
  };

  const handleRemoveRow = (rowKey: string) => {
    setRows((prev) => prev.filter((r) => r.key !== rowKey));
  };

  const handleSelectIngredient = (
    rowKey: string,
    ingredient: IngredientSearchResult
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.key === rowKey ? { ...r, ingredient, amountError: "" } : r))
    );
    setErrors((e) => ({ ...e, ingredients: "" }));
  };

  const handleClearIngredient = (rowKey: string) => {
    setRows((prev) =>
      prev.map((r) => (r.key === rowKey ? { ...r, ingredient: null } : r))
    );
  };

  const handleAmountChange = (rowKey: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.key === rowKey ? { ...r, amount: value, amountError: "" } : r))
    );
  };

  // ── Validation ──
  function validate(): boolean {
    const newErrors: FormErrors = { name: "", ingredients: "" };
    const newRowErrors: Record<string, string> = {};
    let valid = true;

    if (!name.trim()) {
      newErrors.name = "Recipe name is required";
      valid = false;
    }

    const filledRows = rows.filter((r) => r.ingredient !== null);
    if (filledRows.length === 0) {
      newErrors.ingredients = "At least one ingredient is required";
      valid = false;
    }

    for (const row of filledRows) {
      const amt = parseFloat(row.amount);
      if (!row.amount || isNaN(amt) || amt <= 0) {
        newRowErrors[row.key] = "Amount must be greater than 0";
        valid = false;
      }
    }

    setErrors(newErrors);
    setTouched({ name: true });
    if (Object.keys(newRowErrors).length > 0) {
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          amountError: newRowErrors[r.key] ?? r.amountError,
        }))
      );
    }

    return valid;
  }

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const ingredientPayload = rows
      .filter((r) => r.ingredient !== null)
      .map((r, i) => ({
        ingredient_id: r.ingredient!.id,
        amount: parseFloat(r.amount),
        display_order: i,
      }));

    setIsSubmitting(true);
    try {
      if (isEditing && recipeId) {
        const updated = await updateRecipeRecipesRecipeIdPatch({
          recipeId,
          requestBody: {
            name: name.trim(),
            description: description.trim() || null,
            ingredients: ingredientPayload,
          },
        });
        navigate(`/recipes/${updated.id}`);
      } else {
        const created = await createRecipeRecipesPost({
          requestBody: {
            name: name.trim(),
            description: description.trim() || null,
            ingredients: ingredientPayload,
          },
        });
        navigate(`/recipes/${created.id}`);
      }
    } catch {
      toast({
        variant: "destructive",
        title: isEditing ? "Failed to update recipe" : "Failed to create recipe",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!recipeId) return;
    setIsDeleting(true);
    try {
      await deleteRecipeRecipesRecipeIdDelete({ recipeId });
      navigate("/recipes");
    } catch {
      toast({ variant: "destructive", title: "Failed to delete recipe" });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ── Duplicate ──
  const handleDuplicate = async () => {
    if (!recipeId) return;
    setIsDuplicating(true);
    try {
      const result = await duplicateRecipeRecipesRecipeIdDuplicatePost({ recipeId });
      navigate(`/recipes/${result.id}/edit`);
    } catch {
      toast({ variant: "destructive", title: "Failed to duplicate recipe" });
    } finally {
      setIsDuplicating(false);
    }
  };

  const pageTitle = isEditing ? "Edit Recipe" : "New Recipe";
  const pageSubtitle = isEditing
    ? "Edit the details below"
    : "Fill in the details below";

  // ── Render ──
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          color: "hsl(var(--muted-foreground))",
          fontFamily: "var(--font-body)",
          fontSize: 15,
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "hsl(var(--background))",
      }}
    >
      {/* ── App header ── */}
      <header className="app-header">
        <button
          type="button"
          className="header-icon-btn"
          aria-label="Back"
          onClick={() =>
            navigate(isEditing && recipeId ? `/recipes/${recipeId}` : "/recipes")
          }
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
          <h1 className="app-header-title">{pageTitle}</h1>
          <p className="app-header-sub">{pageSubtitle}</p>
        </div>
      </header>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} noValidate style={{ flex: 1 }}>
        <div className="form-body">
          {/* Recipe name */}
          <div className="field">
            <label htmlFor="recipe-name">Recipe name</label>
            <input
              id="recipe-name"
              type="text"
              placeholder="e.g. Lemon Herb Chicken"
              value={name}
              className={touched.name && errors.name ? "error-input" : ""}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: "" }));
              }}
              onBlur={() => setTouched((p) => ({ ...p, name: true }))}
            />
            {touched.name && errors.name && (
              <div className="field-error">
                <ErrorIcon />
                {errors.name}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="field">
            <label htmlFor="recipe-description">
              Description{" "}
              <span
                style={{
                  fontWeight: 400,
                  textTransform: "none",
                  fontSize: 10,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                optional
              </span>
            </label>
            <textarea
              id="recipe-description"
              placeholder="A short description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Ingredients section */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.6px",
                  textTransform: "uppercase",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                Ingredients
              </span>
              {rows.length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "hsl(var(--primary))",
                  }}
                >
                  {rows.length} added
                </span>
              )}
            </div>

            {rows.length > 0 && (
              <div className="ingredient-form-rows" style={{ marginBottom: 8 }}>
                {rows.map((row, i) => (
                  <IngredientRowSearch
                    key={row.key}
                    row={row}
                    rowIndex={i}
                    onSelectIngredient={handleSelectIngredient}
                    onClearIngredient={handleClearIngredient}
                    onAmountChange={handleAmountChange}
                    onRemove={handleRemoveRow}
                  />
                ))}
              </div>
            )}

            {errors.ingredients && (
              <div className="ingredient-form-error" style={{ marginBottom: 6 }}>
                {errors.ingredients}
              </div>
            )}

            <button type="button" className="add-ingredient-btn" onClick={handleAddRow}>
              <svg
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M9 3v12M3 9h12" />
              </svg>
              Add ingredient
            </button>
          </div>
        </div>

        {/* ── Form actions ── */}
        <div className="form-actions">
          <button
            type="submit"
            className={"btn-primary" + (isSubmitting ? " loading" : "")}
            disabled={isSubmitting}
          >
            <span className="btn-text">Save Recipe</span>
            <div className="btn-spinner" />
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              navigate(isEditing && recipeId ? `/recipes/${recipeId}` : "/recipes")
            }
            disabled={isSubmitting}
          >
            Cancel
          </button>

          {/* Danger zone — edit mode only */}
          {isEditing && (
            <div className="danger-zone">
              <div className="danger-zone-title">Danger zone</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDuplicate}
                  disabled={isDuplicating || isSubmitting}
                  style={{ justifyContent: "center" }}
                >
                  <svg
                    viewBox="0 0 18 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    style={{ width: 16, height: 16 }}
                  >
                    <rect x="6" y="6" width="9" height="9" rx="2" />
                    <path d="M3 12V3h9" />
                  </svg>
                  {isDuplicating ? "Duplicating…" : "Duplicate Recipe"}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting || isSubmitting}
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
                  Delete Recipe
                </button>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* ── Delete confirmation dialog ── */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          isDeleting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

// ── Icon helper ───────────────────────────────────────────────────────────────

function ErrorIcon() {
  return (
    <svg viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
      <path d="M6.5 0a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 6.5 0Zm.813 8.938H5.688V7.874h1.625v1.063Zm0-2.125H5.688v-3.25h1.625v3.25Z" />
    </svg>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        style={{
          background: "hsl(var(--card))",
          borderTop: "1px solid hsl(var(--border))",
          borderRadius: "20px 20px 0 0",
          padding: "0 20px 40px",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Handle */}
        <div
          style={{ display: "flex", justifyContent: "center", padding: "12px 0 20px" }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "hsl(var(--border))",
            }}
          />
        </div>

        <h2
          id="delete-dialog-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 700,
            color: "hsl(var(--foreground))",
            marginBottom: 8,
          }}
        >
          Delete Recipe?
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "hsl(var(--muted-foreground))",
            lineHeight: 1.55,
            marginBottom: 24,
          }}
        >
          This will permanently remove the recipe. This action cannot be undone.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              flex: 1,
              height: 50,
              background: "#B83232",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontFamily: "var(--font-body)",
              fontSize: 15,
              fontWeight: 600,
              cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {isDeleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              flex: 1,
              height: 50,
              background: "transparent",
              color: "hsl(var(--muted-foreground))",
              border: "1.5px solid hsl(var(--border))",
              borderRadius: 8,
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
