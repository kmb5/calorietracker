import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { promoteIngredientIngredientsIngredientIdPromotePost } from "../../client/services.gen";
import type { IngredientDetail } from "../../client/types.gen";
import { Badge } from "../ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { useToast } from "../../hooks/useToast";

interface MacroRowProps {
  label: string;
  value: number;
  unit: string;
  /** 0–1 fill ratio for the bar */
  fill: number;
  colorClass: string;
}

function MacroCard({ label, value, unit, fill, colorClass }: MacroRowProps) {
  return (
    <div className="bg-muted border-border rounded-[10px] border p-3.5">
      <p className="text-muted-foreground mb-1 text-[11px] font-medium">{label}</p>
      <p className="font-display text-foreground text-xl leading-none font-bold">
        {value % 1 === 0 ? value : value.toFixed(1)}
        <span className="text-muted-foreground ml-0.5 text-[11px] font-normal">
          {unit}
        </span>
      </p>
      <div className="bg-border mt-2 h-[3px] overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${Math.min(fill * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface IngredientDetailSheetProps {
  detail: IngredientDetail | null;
  isLoading: boolean;
  open: boolean;
  onClose: () => void;
  onAdd?: (detail: IngredientDetail) => void;
  /** Called after a successful promote so parent can update state */
  onPromoted?: (updated: IngredientDetail) => void;
}

export function IngredientDetailSheet({
  detail,
  isLoading,
  open,
  onClose,
  onAdd,
  onPromoted,
}: IngredientDetailSheetProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isPromoting, setIsPromoting] = useState(false);
  // Local pending state — reset when sheet opens for a different ingredient
  const [localPromotionPending, setLocalPromotionPending] = useState(false);

  const portionLabel =
    detail?.unit === "tablespoon"
      ? `per ${detail.portion_size} tbsp`
      : detail?.unit === "piece"
        ? `per ${detail.portion_size} piece${detail.portion_size !== 1 ? "s" : ""}`
        : `per ${detail?.portion_size}${detail?.unit}`;

  // Whether the promote button should show as "Pending review"
  const isPending = localPromotionPending || detail?.is_promotion_pending === true;

  async function handlePromote() {
    if (!detail) return;
    setIsPromoting(true);
    try {
      const updated = await promoteIngredientIngredientsIngredientIdPromotePost({
        ingredientId: detail.id,
      });
      setLocalPromotionPending(true);
      onPromoted?.(updated);
      toast({
        title: "Submitted for review",
        description: "An admin will review your ingredient.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Failed to submit for review",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPromoting(false);
    }
  }

  function handleSheetOpenChange(o: boolean) {
    if (!o) {
      setLocalPromotionPending(false);
      onClose();
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card border-border max-h-[90vh] overflow-y-auto rounded-t-[20px] border-t px-0 pb-0"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="bg-border h-1 w-9 rounded-full" />
        </div>

        <SheetHeader className="border-border border-b px-5 pt-1 pb-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Icon */}
              {!isLoading && detail && (
                <div className="bg-secondary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-xl">
                  {detail.icon ||
                    (detail.unit === "g"
                      ? "⚖️"
                      : detail.unit === "ml"
                        ? "💧"
                        : detail.unit === "tablespoon"
                          ? "🥄"
                          : "🔵")}
                </div>
              )}
              <SheetTitle className="font-display text-foreground text-xl leading-snug font-bold">
                {isLoading ? (
                  <span className="bg-muted block h-6 w-48 animate-pulse rounded" />
                ) : (
                  (detail?.name ?? "—")
                )}
              </SheetTitle>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {isLoading ? (
              <span className="bg-muted block h-5 w-16 animate-pulse rounded-full" />
            ) : detail?.is_system ? (
              <Badge
                variant="secondary"
                className="bg-secondary text-primary text-[10px] font-semibold tracking-wide uppercase"
              >
                System
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-[hsl(214_50%_55%)] bg-[hsl(214_60%_96%)] text-[10px] font-semibold tracking-wide text-[hsl(214_50%_45%)] uppercase dark:bg-[hsl(214_40%_12%)]"
              >
                Custom
              </Badge>
            )}
            <span className="text-muted-foreground text-[13px]">{portionLabel}</span>
          </div>
        </SheetHeader>

        <div className="px-5 pt-4 pb-4">
          <p className="text-muted-foreground mb-3.5 text-[11px] font-semibold tracking-[0.7px] uppercase">
            Nutrition per portion
          </p>

          {/* Kcal hero */}
          <div className="bg-secondary relative mb-4 overflow-hidden rounded-[14px] p-5">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 200px 100px at 50% 100%, hsl(16 65% 48% / 0.15) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex flex-col items-center">
              <div className="flex items-end gap-1">
                <span className="font-display text-primary text-[44px] leading-none font-bold">
                  {isLoading ? "—" : Math.round(detail?.kcal ?? 0)}
                </span>
                <span className="text-primary mb-1.5 text-[15px] font-medium">
                  kcal
                </span>
              </div>
              <span className="text-muted-foreground mt-1 text-[11px] font-semibold tracking-[0.5px] uppercase">
                Calories
              </span>
            </div>
          </div>

          {/* Macro grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`bg-muted animate-pulse rounded-[10px] p-3.5 ${i === 4 ? "col-span-2" : ""}`}
                  style={{ height: 76 }}
                />
              ))}
            </div>
          ) : detail ? (
            <div className="grid grid-cols-2 gap-2.5">
              <MacroCard
                label="Protein"
                value={detail.protein}
                unit="g"
                fill={detail.protein / 50}
                colorClass="bg-[hsl(143_30%_45%)]"
              />
              <MacroCard
                label="Fat"
                value={detail.fat}
                unit="g"
                fill={detail.fat / 40}
                colorClass="bg-[hsl(38_65%_55%)]"
              />
              <MacroCard
                label="Carbohydrates"
                value={detail.carbohydrates}
                unit="g"
                fill={detail.carbohydrates / 80}
                colorClass="bg-primary"
              />
              <MacroCard
                label="Fiber"
                value={detail.fiber}
                unit="g"
                fill={detail.fiber / 15}
                colorClass="bg-[hsl(100_30%_48%)]"
              />
              <div className="col-span-2">
                <MacroCard
                  label="Sodium"
                  value={detail.sodium}
                  unit="mg"
                  fill={detail.sodium / 500}
                  colorClass="bg-[hsl(220_30%_55%)]"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* CTA area */}
        {!isLoading && detail && (
          <div className="border-border space-y-2.5 border-t px-5 pt-4 pb-8">
            {/* Add to log */}
            {onAdd && (
              <button
                onClick={() => onAdd(detail)}
                className="bg-primary text-primary-foreground hover:bg-terra-dark shadow-terra w-full cursor-pointer rounded-[10px] py-3 text-sm font-semibold transition-all hover:-translate-y-px active:translate-y-0"
              >
                Add to log
              </button>
            )}

            {/* Custom ingredient actions */}
            {!detail.is_system && (
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/ingredients/${detail.id}/edit`);
                  }}
                  className="bg-muted text-foreground border-border hover:bg-muted/80 flex-1 cursor-pointer rounded-[10px] border py-3 text-sm font-medium transition"
                >
                  Edit
                </button>
                <button
                  onClick={handlePromote}
                  disabled={isPending || isPromoting}
                  className={`flex-1 cursor-pointer rounded-[10px] py-3 text-sm font-semibold transition-all ${
                    isPending
                      ? "bg-muted text-muted-foreground border-border cursor-default border"
                      : "border border-[hsl(214_50%_55%)] bg-[hsl(214_60%_96%)] text-[hsl(214_50%_45%)] hover:bg-[hsl(214_55%_92%)]"
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                  aria-label={isPending ? "Pending review" : "Submit for review"}
                >
                  {isPromoting ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg
                        className="animate-spin"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Submitting…
                    </span>
                  ) : isPending ? (
                    "Pending review"
                  ) : (
                    "Submit for review"
                  )}
                </button>
              </div>
            )}

            {/* Close */}
            {!onAdd && detail.is_system && (
              <button
                onClick={onClose}
                className="bg-muted text-ink-mid border-border hover:bg-muted/80 w-full cursor-pointer rounded-[10px] border px-4 py-3 text-sm font-medium transition"
              >
                Close
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
