/**
 * CustomIngredientFormPage
 *
 * Handles both create (/ingredients/new) and edit (/ingredients/:id/edit).
 * - Create: form pre-fills the name from router `state.name` (passed by the search CTA)
 * - Edit: fetches ingredient by id, pre-fills all fields
 * - Delete: confirmation dialog before calling DELETE
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  createIngredientIngredientsPost,
  getIngredientIngredientsIngredientIdGet,
  updateIngredientIngredientsIngredientIdPatch,
  deleteIngredientIngredientsIngredientIdDelete,
} from "../client/services.gen";
import type { UnitType } from "../client/types.gen";
import { useToast } from "../hooks/useToast";

// ── Food emoji picker data ────────────────────────────────────────────────────
const FOOD_EMOJIS = [
  "🍎",
  "🍊",
  "🍋",
  "🍇",
  "🍓",
  "🫐",
  "🍑",
  "🥝",
  "🍅",
  "🫒",
  "🥦",
  "🥕",
  "🧅",
  "🥔",
  "🌽",
  "🥑",
  "🍆",
  "🫑",
  "🥒",
  "🧄",
  "🍗",
  "🥩",
  "🥚",
  "🧀",
  "🥛",
  "🍳",
  "🥓",
  "🌭",
  "🍔",
  "🍕",
  "🫙",
  "🥫",
  "🧈",
  "🥜",
  "🫘",
  "🌾",
  "🍞",
  "🥐",
  "🥖",
  "🧆",
  "🍚",
  "🍜",
  "🍝",
  "🍲",
  "🥗",
  "🫕",
  "🍱",
  "🥡",
  "🍣",
  "🐟",
  "🧂",
  "🫚",
  "🍯",
  "🧃",
  "🥤",
  "🫖",
  "☕",
  "🧋",
  "🥂",
  "🍷",
];

// Unit-based fallback icons
const UNIT_ICONS: Record<string, string> = {
  g: "⚖️",
  ml: "💧",
  tablespoon: "🥄",
  piece: "🔵",
};

// ── Form state type ───────────────────────────────────────────────────────────
interface FormState {
  name: string;
  icon: string;
  unit: UnitType;
  portion_size: string;
  kcal: string;
  protein: string;
  fat: string;
  carbohydrates: string;
  fiber: string;
  sodium: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: "",
  icon: "",
  unit: "g",
  portion_size: "100",
  kcal: "",
  protein: "",
  fat: "",
  carbohydrates: "",
  fiber: "",
  sodium: "",
};

const UNIT_OPTIONS: { value: UnitType; label: string }[] = [
  { value: "g", label: "Grams (g)" },
  { value: "ml", label: "Millilitres (ml)" },
  { value: "tablespoon", label: "Tablespoon" },
  { value: "piece", label: "Piece" },
];

// ── Validation ────────────────────────────────────────────────────────────────
function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) errors.name = "Name is required";
  if (
    !form.portion_size ||
    isNaN(Number(form.portion_size)) ||
    Number(form.portion_size) <= 0
  )
    errors.portion_size = "Must be a positive number";
  if (form.kcal === "" || isNaN(Number(form.kcal)) || Number(form.kcal) < 0)
    errors.kcal = "Required, must be ≥ 0";
  if (form.protein === "" || isNaN(Number(form.protein)) || Number(form.protein) < 0)
    errors.protein = "Required, must be ≥ 0";
  if (form.fat === "" || isNaN(Number(form.fat)) || Number(form.fat) < 0)
    errors.fat = "Required, must be ≥ 0";
  if (
    form.carbohydrates === "" ||
    isNaN(Number(form.carbohydrates)) ||
    Number(form.carbohydrates) < 0
  )
    errors.carbohydrates = "Required, must be ≥ 0";
  if (form.fiber === "" || isNaN(Number(form.fiber)) || Number(form.fiber) < 0)
    errors.fiber = "Required, must be ≥ 0";
  if (form.sodium === "" || isNaN(Number(form.sodium)) || Number(form.sodium) < 0)
    errors.sodium = "Required, must be ≥ 0";

  return errors;
}

// ── Main component ────────────────────────────────────────────────────────────
export function CustomIngredientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const isEditing = Boolean(id);

  const [form, setForm] = useState<FormState>(() => {
    // Pre-fill name from search state (navigate state from IngredientSearch)
    const nameFromState = (location.state as { name?: string } | null)?.name ?? "";
    return { ...EMPTY_FORM, name: nameFromState };
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Load ingredient for edit ───────────────────────────────────────────────
  useEffect(() => {
    if (!isEditing || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getIngredientIngredientsIngredientIdGet({
          ingredientId: Number(id),
        });
        if (cancelled) return;
        setForm({
          name: data.name,
          icon: data.icon ?? "",
          unit: data.unit,
          portion_size: String(data.portion_size),
          kcal: String(data.kcal),
          protein: String(data.protein),
          fat: String(data.fat),
          carbohydrates: String(data.carbohydrates),
          fiber: String(data.fiber),
          sodium: String(data.sodium),
        });
      } catch {
        if (!cancelled) {
          toast({ title: "Ingredient not found", variant: "destructive" });
          navigate("/");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEditing, navigate, toast]);

  // ── Field change ───────────────────────────────────────────────────────────
  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // ── Derived preview icon ───────────────────────────────────────────────────
  const previewIcon = form.icon || UNIT_ICONS[form.unit] || "🍽️";

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Mark all touched
    const allTouched = Object.keys(form).reduce(
      (acc, k) => ({ ...acc, [k]: true }),
      {} as typeof touched
    );
    setTouched(allTouched);

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit,
        portion_size: Number(form.portion_size),
        kcal: Number(form.kcal),
        protein: Number(form.protein),
        fat: Number(form.fat),
        carbohydrates: Number(form.carbohydrates),
        fiber: Number(form.fiber),
        sodium: Number(form.sodium),
        icon: form.icon || null,
      };

      if (isEditing && id) {
        await updateIngredientIngredientsIngredientIdPatch({
          ingredientId: Number(id),
          requestBody: payload,
        });
        toast({ title: "Ingredient updated", variant: "success" });
      } else {
        await createIngredientIngredientsPost({ requestBody: payload });
        toast({
          title: "Ingredient created",
          description: "It now appears in search results.",
          variant: "success",
        });
      }
      navigate("/");
    } catch {
      toast({
        title: isEditing
          ? "Failed to update ingredient"
          : "Failed to create ingredient",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteIngredientIngredientsIngredientIdDelete({
        ingredientId: Number(id),
      });
      toast({ title: "Ingredient deleted", variant: "success" });
      navigate("/");
    } catch {
      toast({ title: "Failed to delete ingredient", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="text-primary animate-spin"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-muted-foreground text-sm">Loading ingredient…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* ── Header ── */}
      <header className="bg-card border-border sticky top-0 z-10 border-b px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground cursor-pointer rounded-full p-1.5 transition-colors"
            aria-label="Go back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="font-display text-foreground flex-1 text-lg leading-snug font-bold">
            {isEditing ? "Edit Ingredient" : "New Ingredient"}
          </h1>
          {isEditing && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive hover:bg-destructive/10 cursor-pointer rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors"
              aria-label="Delete ingredient"
            >
              Delete
            </button>
          )}
        </div>
      </header>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
          {/* ── Icon + Name row ── */}
          <div className="flex items-start gap-3">
            {/* Icon button */}
            <div className="flex-shrink-0">
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-[0.5px] uppercase">
                Icon
              </p>
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="bg-secondary border-border hover:border-primary relative flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-[14px] border-[1.5px] text-2xl transition-all hover:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)]"
                aria-label={`Pick emoji. Current: ${previewIcon}`}
              >
                {previewIcon}
                {form.icon && (
                  <span className="bg-primary absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] text-white">
                    ✓
                  </span>
                )}
              </button>
            </div>

            {/* Name field */}
            <div className="min-w-0 flex-1">
              <label
                htmlFor="field-name"
                className="text-muted-foreground mb-1.5 block text-[11px] font-semibold tracking-[0.5px] uppercase"
              >
                Name <span className="text-destructive">*</span>
              </label>
              <input
                id="field-name"
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                placeholder="e.g. Oat milk"
                className={`border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary h-[52px] w-full rounded-[14px] border-[1.5px] px-3.5 text-[15px] transition-all outline-none focus:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)] ${
                  touched.name && errors.name
                    ? "border-destructive focus:border-destructive"
                    : ""
                }`}
                aria-describedby={
                  touched.name && errors.name ? "error-name" : undefined
                }
              />
              {touched.name && errors.name && (
                <p id="error-name" className="text-destructive mt-1.5 text-[12px]">
                  {errors.name}
                </p>
              )}
            </div>
          </div>

          {/* ── Emoji picker dropdown ── */}
          {showEmojiPicker && (
            <div className="bg-card border-border shadow-card rounded-[16px] border-[1.5px] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.5px] uppercase">
                  Choose icon
                </p>
                {form.icon && (
                  <button
                    type="button"
                    onClick={() => {
                      handleChange("icon", "");
                    }}
                    className="text-muted-foreground hover:text-foreground cursor-pointer text-[12px] underline-offset-2 hover:underline"
                  >
                    Use default
                  </button>
                )}
              </div>
              <div className="grid grid-cols-10 gap-1.5">
                {FOOD_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      handleChange("icon", emoji);
                      setShowEmojiPicker(false);
                    }}
                    className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] text-xl transition-colors ${
                      form.icon === emoji
                        ? "bg-primary/15 ring-primary ring-2"
                        : "hover:bg-muted"
                    }`}
                    aria-label={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground mt-3 text-center text-[11px]">
                Fallback when none selected:{" "}
                <span className="font-semibold">{UNIT_ICONS[form.unit] ?? "🍽️"}</span>{" "}
                (based on unit)
              </p>
            </div>
          )}

          {/* ── Unit + Portion size ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="field-unit"
                className="text-muted-foreground mb-1.5 block text-[11px] font-semibold tracking-[0.5px] uppercase"
              >
                Unit <span className="text-destructive">*</span>
              </label>
              <select
                id="field-unit"
                value={form.unit}
                onChange={(e) => handleChange("unit", e.target.value)}
                className="border-border bg-card text-foreground focus:border-primary h-[52px] w-full cursor-pointer appearance-none rounded-[14px] border-[1.5px] px-3.5 text-[15px] transition-all outline-none focus:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)]"
              >
                {UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="field-portion"
                className="text-muted-foreground mb-1.5 block text-[11px] font-semibold tracking-[0.5px] uppercase"
              >
                Portion size <span className="text-destructive">*</span>
              </label>
              <input
                id="field-portion"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.portion_size}
                onChange={(e) => handleChange("portion_size", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, portion_size: true }))}
                className={`border-border bg-card text-foreground focus:border-primary h-[52px] w-full rounded-[14px] border-[1.5px] px-3.5 text-[15px] transition-all outline-none focus:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)] ${
                  touched.portion_size && errors.portion_size
                    ? "border-destructive"
                    : ""
                }`}
              />
              {touched.portion_size && errors.portion_size && (
                <p className="text-destructive mt-1 text-[12px]">
                  {errors.portion_size}
                </p>
              )}
            </div>
          </div>

          {/* ── Nutrition section ── */}
          <div>
            <p className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-[0.6px] uppercase">
              Nutrition per portion
            </p>

            {/* kcal full width */}
            <NutritionField
              id="field-kcal"
              label="Calories (kcal)"
              unit="kcal"
              value={form.kcal}
              error={touched.kcal ? errors.kcal : undefined}
              onChange={(v) => handleChange("kcal", v)}
              onBlur={() => setTouched((p) => ({ ...p, kcal: true }))}
              required
              accent
            />

            {/* 2-col grid for macros */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <NutritionField
                id="field-protein"
                label="Protein"
                unit="g"
                value={form.protein}
                error={touched.protein ? errors.protein : undefined}
                onChange={(v) => handleChange("protein", v)}
                onBlur={() => setTouched((p) => ({ ...p, protein: true }))}
                required
              />
              <NutritionField
                id="field-fat"
                label="Fat"
                unit="g"
                value={form.fat}
                error={touched.fat ? errors.fat : undefined}
                onChange={(v) => handleChange("fat", v)}
                onBlur={() => setTouched((p) => ({ ...p, fat: true }))}
                required
              />
              <NutritionField
                id="field-carbs"
                label="Carbohydrates"
                unit="g"
                value={form.carbohydrates}
                error={touched.carbohydrates ? errors.carbohydrates : undefined}
                onChange={(v) => handleChange("carbohydrates", v)}
                onBlur={() => setTouched((p) => ({ ...p, carbohydrates: true }))}
                required
              />
              <NutritionField
                id="field-fiber"
                label="Fiber"
                unit="g"
                value={form.fiber}
                error={touched.fiber ? errors.fiber : undefined}
                onChange={(v) => handleChange("fiber", v)}
                onBlur={() => setTouched((p) => ({ ...p, fiber: true }))}
                required
              />
              <div className="col-span-2">
                <NutritionField
                  id="field-sodium"
                  label="Sodium"
                  unit="mg"
                  value={form.sodium}
                  error={touched.sodium ? errors.sodium : undefined}
                  onChange={(v) => handleChange("sodium", v)}
                  onBlur={() => setTouched((p) => ({ ...p, sodium: true }))}
                  required
                />
              </div>
            </div>
          </div>

          {/* ── Submit button ── */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-terra-dark shadow-terra w-full cursor-pointer rounded-[14px] py-4 text-[15px] font-semibold transition-all hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {isEditing ? "Saving…" : "Creating…"}
              </span>
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Create Ingredient"
            )}
          </button>

          {/* Bottom spacing for mobile */}
          <div className="h-8" />
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

// ── Sub-components ────────────────────────────────────────────────────────────

interface NutritionFieldProps {
  id: string;
  label: string;
  unit: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  required?: boolean;
  accent?: boolean;
}

function NutritionField({
  id,
  label,
  unit,
  value,
  error,
  onChange,
  onBlur,
  required,
  accent,
}: NutritionFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-muted-foreground mb-1.5 block text-[11px] font-medium"
      >
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="0"
          className={`border-border bg-card text-foreground placeholder:text-muted-foreground/50 focus:border-primary h-[48px] w-full rounded-[12px] border-[1.5px] pr-10 pl-3.5 text-[15px] transition-all outline-none focus:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)] ${
            error ? "border-destructive focus:border-destructive" : ""
          } ${accent ? "font-semibold" : ""}`}
        />
        <span
          className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] font-medium ${accent ? "text-primary" : "text-muted-foreground"}`}
        >
          {unit}
        </span>
      </div>
      {error && <p className="text-destructive mt-1 text-[12px]">{error}</p>}
    </div>
  );
}

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
        className="bg-card border-border mb-0 w-full max-w-lg rounded-t-[20px] border-t px-5 pt-3 pb-8 shadow-[0_-8px_40px_rgba(0,0,0,0.2)]"
      >
        {/* Handle */}
        <div className="mb-5 flex justify-center">
          <div className="bg-border h-1 w-9 rounded-full" />
        </div>

        <div className="bg-destructive/10 mb-2 flex h-12 w-12 items-center justify-center rounded-full">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="hsl(var(--destructive))"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </div>

        <h2
          id="delete-dialog-title"
          className="font-display text-foreground mt-3 text-xl font-bold"
        >
          Delete ingredient?
        </h2>
        <p className="text-muted-foreground mt-1.5 text-[14px] leading-relaxed">
          This will permanently remove the ingredient. It won't appear in search results
          anymore.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground flex-1 cursor-pointer rounded-[12px] py-3.5 text-[15px] font-semibold transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="bg-muted text-foreground border-border hover:bg-muted/70 flex-1 cursor-pointer rounded-[12px] border py-3.5 text-[15px] font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
