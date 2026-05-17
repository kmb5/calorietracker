import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { IngredientDetail, IngredientSearchResult } from "../../client/types.gen";
import { Badge } from "../ui/badge";
import { IngredientDetailSheet } from "./IngredientDetailSheet";
import { useIngredientSearch } from "./useIngredientSearch";

// ── Unit labels ────────────────────────────────────────────────────────────────
const UNIT_LABELS: Record<string, string> = {
  g: "per 100g",
  ml: "per 100ml",
  tablespoon: "per tbsp",
  piece: "per piece",
};

// ── Unit fallback icons ────────────────────────────────────────────────────────
const UNIT_ICONS: Record<string, string> = {
  g: "⚖️",
  ml: "💧",
  tablespoon: "🥄",
  piece: "🔵",
};

interface IngredientSearchResultRowProps {
  ingredient: IngredientSearchResult;
  isHighlighted: boolean;
  onSelect: (ingredient: IngredientSearchResult) => void;
  onMouseEnter: () => void;
}

function IngredientResultRow({
  ingredient,
  isHighlighted,
  onSelect,
  onMouseEnter,
}: IngredientSearchResultRowProps) {
  return (
    <div
      role="option"
      aria-selected={isHighlighted}
      tabIndex={-1}
      className={`border-border flex min-h-[60px] cursor-pointer items-center gap-3 border-b px-3.5 py-3 transition-colors last:border-0 ${
        isHighlighted ? "bg-primary/10" : "hover:bg-primary/5"
      }`}
      onClick={() => onSelect(ingredient)}
      onMouseEnter={onMouseEnter}
    >
      <div className="bg-muted flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-lg">
        {ingredient.icon ?? UNIT_ICONS[ingredient.unit] ?? "🍽️"}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium transition-colors ${
            isHighlighted ? "text-primary" : "text-foreground"
          }`}
        >
          {ingredient.name}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-primary text-xs font-semibold">
            {Math.round(ingredient.kcal)} kcal
          </span>
          <span className="text-muted-foreground text-[11px]">
            {UNIT_LABELS[ingredient.unit] ?? `per ${ingredient.unit}`}
          </span>
          {ingredient.is_system ? (
            <Badge
              variant="secondary"
              className="bg-secondary text-primary px-1.5 py-0 text-[10px] font-semibold tracking-wide uppercase"
            >
              <span className="mr-1 inline-block h-1 w-1 rounded-full bg-current" />
              System
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-[hsl(214_50%_55%)] bg-[hsl(214_60%_96%)] px-1.5 py-0 text-[10px] font-semibold tracking-wide text-[hsl(214_50%_45%)] uppercase dark:bg-[hsl(214_40%_12%)]"
            >
              <span className="mr-1 inline-block h-1 w-1 rounded-full bg-current" />
              Custom
            </Badge>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg
        className="text-border flex-shrink-0"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface IngredientSearchProps {
  /** Called when the user selects an ingredient from the dropdown */
  onSelect?: (ingredient: IngredientSearchResult) => void;
  /** Called when "Add to log" is tapped inside the detail sheet */
  onAdd?: (detail: IngredientDetail) => void;
  placeholder?: string;
  /** Optional wrapper class for the root div */
  className?: string;
}

export function IngredientSearch({
  onSelect,
  onAdd,
  placeholder = "Search ingredients…",
  className,
}: IngredientSearchProps) {
  const {
    query,
    setQuery,
    results,
    isLoading,
    isOpen,
    setIsOpen,
    selected,
    select,
    clear,
    detail,
    isDetailLoading,
    openDetail,
    closeDetail,
    updateDetail,
    highlightedIndex,
    setHighlightedIndex,
  } = useIngredientSearch();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isDetailOpen = detail !== null || isDetailLoading;

  // Fire external onSelect when selection changes
  useEffect(() => {
    if (selected) onSelect?.(selected);
  }, [selected, onSelect]);

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
        if (results[highlightedIndex]) select(results[highlightedIndex]);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setQuery("");
        inputRef.current?.blur();
        break;
    }
  }

  // Scroll highlighted row into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const highlighted = list.querySelector("[aria-selected='true']");
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      {/* ── Selected chip ── */}
      {selected ? (
        <div>
          {/* Chip row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 10px 0 14px",
              height: 52,
              border: "1.5px solid hsl(var(--primary))",
              borderRadius: 14,
              background: "hsl(var(--secondary))",
              boxShadow: "0 0 0 3px rgba(201,86,43,0.10)",
            }}
          >
            {/* Checkmark */}
            <svg
              style={{ color: "hsl(var(--primary))", flexShrink: 0 }}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>

            {/* Name */}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 15,
                fontWeight: 500,
                color: "hsl(var(--foreground))",
              }}
            >
              {selected.name}
            </span>

            {/* Badge */}
            {selected.is_system ? (
              <Badge
                variant="secondary"
                className="bg-secondary text-primary mr-1 flex-shrink-0 px-1.5 py-0 text-[10px] font-semibold tracking-wide uppercase"
              >
                <span className="mr-1 inline-block h-1 w-1 rounded-full bg-current" />
                System
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="mr-1 flex-shrink-0 border-[hsl(214_50%_55%)] bg-[hsl(214_60%_96%)] px-1.5 py-0 text-[10px] font-semibold tracking-wide text-[hsl(214_50%_45%)] uppercase"
              >
                <span className="mr-1 inline-block h-1 w-1 rounded-full bg-current" />
                Custom
              </Badge>
            )}

            {/* Clear */}
            <button
              onClick={clear}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "none",
                background: "rgba(201,86,43,0.15)",
                color: "hsl(var(--primary))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
              aria-label="Clear selection"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Action buttons below chip */}
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button
              onClick={() => openDetail(selected.id)}
              aria-label="View nutrition details"
              className="btn-primary"
              style={{ flex: 1, height: 48, fontSize: 14, gap: 6 }}
            >
              View full nutrition
              <svg
                width="14"
                height="14"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 9h10M9 4l5 5-5 5" />
              </svg>
            </button>
            <button
              onClick={() => {
                clear();
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              aria-label="Search again"
              className="btn-secondary"
              style={{ width: 48, height: 48, flexShrink: 0 }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        /* ── Search input ── */
        <div className="relative">
          {/* Search icon */}
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2 items-center">
            {isLoading ? (
              <svg
                className="animate-spin"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
          </span>

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls="ingredient-listbox"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query) setIsOpen(true);
            }}
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            placeholder={placeholder}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary h-[52px] w-full rounded-[14px] border-[1.5px] pr-10 pl-11 text-[15px] transition-all outline-none focus:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)]"
          />

          {/* Clear button */}
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="bg-muted text-ink-mid hover:bg-muted/70 absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 transition-colors"
              aria-label="Clear search"
              tabIndex={-1}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── Dropdown ── */}
      {isOpen && !selected && (
        <div
          id="ingredient-listbox"
          role="listbox"
          aria-label="Search results"
          ref={listRef}
          className="border-border bg-card absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-[14px] border-[1.5px] shadow-[0_8px_40px_hsl(33_53%_7%_/_0.16),0_2px_8px_hsl(33_53%_7%_/_0.08)]"
        >
          {/* Results header */}
          {results.length > 0 && (
            <div className="bg-muted border-border text-muted-foreground border-b px-3.5 py-2 text-[11px] font-semibold tracking-[0.6px] uppercase">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </div>
          )}

          {/* Result rows */}
          {results.map((ingredient, i) => (
            <IngredientResultRow
              key={ingredient.id}
              ingredient={ingredient}
              isHighlighted={i === highlightedIndex}
              onSelect={(ing) => select(ing)}
              onMouseEnter={() => setHighlightedIndex(i)}
            />
          ))}

          {/* No results */}
          {!isLoading && query && results.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-10">
              <span className="text-4xl opacity-50">🔍</span>
              <p className="font-display text-foreground text-base font-bold">
                No ingredients found
              </p>
              <p className="text-muted-foreground text-center text-[13px] leading-relaxed">
                No results for <strong>"{query}"</strong>.<br />
                You can add it as a custom ingredient.
              </p>
              <Link
                to="/ingredients/new"
                state={{ name: query }}
                className="bg-primary text-primary-foreground hover:bg-terra-dark shadow-terra mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-5 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-px"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create custom ingredient
              </Link>
            </div>
          )}

          {/* Keyboard hint */}
          {results.length > 0 && (
            <div className="bg-muted border-border text-muted-foreground flex items-center gap-2 border-t px-3.5 py-2 text-[11px]">
              <kbd className="bg-card border-border text-ink-mid rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                ↑
              </kbd>
              <kbd className="bg-card border-border text-ink-mid rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                ↓
              </kbd>
              <span>navigate</span>
              <span className="text-border">·</span>
              <kbd className="bg-card border-border text-ink-mid rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                ↵
              </kbd>
              <span>select</span>
              <span className="text-border">·</span>
              <kbd className="bg-card border-border text-ink-mid rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                Esc
              </kbd>
              <span>close</span>
            </div>
          )}
        </div>
      )}

      {/* ── Detail sheet ── */}
      <IngredientDetailSheet
        detail={detail}
        isLoading={isDetailLoading}
        open={isDetailOpen}
        onClose={closeDetail}
        onAdd={onAdd}
        onPromoted={(updated) => {
          // Use the returned value directly to avoid an extra GET round-trip.
          updateDetail(updated);
        }}
      />
    </div>
  );
}
