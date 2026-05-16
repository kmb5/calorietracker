/**
 * AdminPromotionsTab
 *
 * Lists pending promotion requests.
 * Approve removes the row; Reject prompts for a note then removes it.
 */
import { useEffect, useState } from "react";
import {
  listPromotionsAdminIngredientsPromotionsGet,
  approvePromotionAdminIngredientsPromotionsIngredientIdApprovePost,
  rejectPromotionAdminIngredientsPromotionsIngredientIdRejectPost,
} from "../../client/services.gen";
import type { IngredientDetail } from "../../client/types.gen";
import { useToast } from "../../hooks/useToast";

export function AdminPromotionsTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<IngredientDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-row state for reject flow
  const [rejectRow, setRejectRow] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [submitting, setSubmitting] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listPromotionsAdminIngredientsPromotionsGet();
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setError("Failed to load promotions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleApprove(id: number) {
    setSubmitting(id);
    try {
      await approvePromotionAdminIngredientsPromotionsIngredientIdApprovePost({
        ingredientId: id,
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Promotion approved", variant: "success" });
    } catch {
      toast({ title: "Failed to approve", variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleReject(id: number) {
    if (!rejectNote.trim()) {
      toast({ title: "A rejection note is required", variant: "destructive" });
      return;
    }
    setSubmitting(id);
    try {
      await rejectPromotionAdminIngredientsPromotionsIngredientIdRejectPost({
        ingredientId: id,
        requestBody: { rejection_note: rejectNote.trim() },
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
      setRejectRow(null);
      setRejectNote("");
      toast({ title: "Promotion rejected" });
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return <LoadingSkeleton rows={3} />;
  }

  if (error) {
    return <ErrorBanner message={error} />;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full text-3xl">
          ⭐
        </div>
        <div className="text-center">
          <p className="font-display text-foreground text-xl font-bold">
            No pending promotions
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            When users request system ingredient promotions, they'll appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-muted-foreground text-sm">
        {items.length} pending {items.length === 1 ? "request" : "requests"}
      </p>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-card border-border shadow-card-sm rounded-[14px] border p-5"
          >
            <div className="flex items-start gap-4">
              {/* Icon + name */}
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] text-xl"
                style={{ background: "hsl(var(--secondary))" }}
              >
                {item.icon ?? "🍽️"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-foreground text-[15px] font-semibold">
                    {item.name}
                  </p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      background: "hsl(var(--secondary))",
                      color: "hsl(var(--secondary-foreground))",
                    }}
                  >
                    {item.unit}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-[13px]">
                  {item.kcal} kcal · {item.protein}g protein · {item.fat}g fat ·{" "}
                  {item.carbohydrates}g carbs
                </p>
              </div>

              {/* Actions */}
              {rejectRow !== item.id && (
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={submitting === item.id}
                    className="cursor-pointer rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: "hsl(var(--success-bg))",
                      color: "hsl(var(--success))",
                    }}
                  >
                    {submitting === item.id ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => {
                      setRejectRow(item.id);
                      setRejectNote("");
                    }}
                    disabled={submitting === item.id}
                    className="border-border hover:bg-muted text-muted-foreground cursor-pointer rounded-[8px] border px-4 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>

            {/* Inline reject note input */}
            {rejectRow === item.id && (
              <div className="border-border mt-4 border-t pt-4">
                <label className="text-muted-foreground mb-1.5 block text-[11px] font-semibold tracking-wide uppercase">
                  Rejection note <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Explain why this ingredient was not promoted…"
                  rows={2}
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus:border-primary w-full resize-none rounded-[10px] border px-3.5 py-2.5 text-[14px] transition-all outline-none focus:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)]"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleReject(item.id)}
                    disabled={submitting === item.id || !rejectNote.trim()}
                    className="bg-destructive text-destructive-foreground cursor-pointer rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting === item.id ? "Rejecting…" : "Confirm Reject"}
                  </button>
                  <button
                    onClick={() => {
                      setRejectRow(null);
                      setRejectNote("");
                    }}
                    disabled={submitting === item.id}
                    className="border-border hover:bg-muted text-muted-foreground cursor-pointer rounded-[8px] border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="max-w-4xl animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-muted h-20 rounded-[14px]" />
      ))}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-destructive/10 border-destructive/20 text-destructive max-w-lg rounded-[10px] border px-4 py-3 text-sm">
      {message}
    </div>
  );
}
