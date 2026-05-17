/**
 * CustomIngredientFormPage
 *
 * Handles both create (/ingredients/new) and edit (/ingredients/:id/edit).
 * - Create: form pre-fills the name from router `state.name` (passed by the search CTA)
 * - Edit: fetches ingredient by id, pre-fills all fields
 * - Delete: confirmation dialog before calling DELETE
 *
 * Layout matches the prototype's ci-nav-bar / ci-scroll-body pattern.
 */
import { useEffect, useRef, useState } from "react";
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
  { value: "g", label: "g — grams" },
  { value: "ml", label: "ml — millilitres" },
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
  const formRef = useRef<HTMLFormElement>(null);

  const [form, setForm] = useState<FormState>(() => {
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
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      await deleteIngredientIngredientsIngredientIdDelete({ ingredientId: Number(id) });
      toast({ title: "Ingredient deleted", variant: "success" });
      navigate("/");
    } catch {
      toast({ title: "Failed to delete ingredient", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Loading spinner ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(var(--background))",
        }}
      >
        <svg
          style={{
            color: "hsl(var(--primary))",
            animation: "authSpin 0.7s linear infinite",
          }}
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
      </div>
    );
  }

  const submitLabel = isSubmitting
    ? isEditing
      ? "Saving…"
      : "Creating…"
    : isEditing
      ? "Save Changes"
      : "Create Ingredient";

  const previewIcon = form.icon || UNIT_ICONS[form.unit] || "🍽️";

  return (
    <div style={{ background: "hsl(var(--background))", minHeight: "100vh" }}>
      {/* ── Header ── */}
      <div className="ci-header-wrap">
        <div className="ci-nav-bar">
          <button
            type="button"
            className="ci-nav-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <polyline points="11 4 5 9 11 14" />
            </svg>
          </button>
          <span className="ci-nav-title">
            {isEditing ? "Edit Ingredient" : "New Ingredient"}
          </span>
          <button
            type="submit"
            form="ci-form"
            className="ci-nav-action"
            disabled={isSubmitting}
          >
            Save
          </button>
        </div>
      </div>

      {/* ── Form ── */}
      <form id="ci-form" ref={formRef} onSubmit={handleSubmit} noValidate>
        <div className="ci-scroll-body">
          {/* ── Name ── */}
          <div style={{ marginBottom: 20 }}>
            <div className="ci-section-label">Name</div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="ci-name" className="sr-only">
                Name
              </label>
              <input
                id="ci-name"
                type="text"
                placeholder="Ingredient name…"
                value={form.name}
                autoCapitalize="words"
                className={errors.name && touched.name ? "error-input" : ""}
                onChange={(e) => handleChange("name", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, name: true }))}
              />
              {touched.name && errors.name && (
                <div className="field-error">
                  <ErrorIcon />
                  {errors.name}
                </div>
              )}
            </div>
          </div>

          {/* ── Icon ── */}
          <div style={{ marginBottom: 20 }}>
            <div className="ci-section-label">
              Icon{" "}
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
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className="ci-icon-btn"
                onClick={() => setShowEmojiPicker((v) => !v)}
                aria-label="Choose icon"
              >
                {previewIcon}
              </button>
              <span
                style={{
                  fontSize: 13,
                  color: "hsl(var(--muted-foreground))",
                  lineHeight: 1.45,
                }}
              >
                {form.icon ? "Tap to change icon" : "Tap to choose an emoji icon"}
                {!form.icon && (
                  <>
                    <br />
                    <span style={{ fontSize: 11 }}>
                      Defaults to {UNIT_ICONS[form.unit] ?? "🍽️"} based on unit
                    </span>
                  </>
                )}
              </span>
            </div>

            {/* Emoji grid */}
            {showEmojiPicker && (
              <div className="ci-emoji-grid open" style={{ marginTop: 8 }}>
                {FOOD_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`ci-emoji-btn${form.icon === emoji ? "selected" : ""}`}
                    aria-label={emoji}
                    onClick={() => {
                      handleChange("icon", emoji);
                      setShowEmojiPicker(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                {form.icon && (
                  <button
                    type="button"
                    className="ci-emoji-btn"
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: 11,
                      color: "hsl(var(--muted-foreground))",
                      height: "auto",
                      paddingBlock: 6,
                    }}
                    onClick={() => {
                      handleChange("icon", "");
                      setShowEmojiPicker(false);
                    }}
                  >
                    ✕ Use default
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Unit & Portion ── */}
          <div style={{ marginBottom: 20 }}>
            <div className="ci-section-label">Unit &amp; Portion</div>
            <div className="ci-field-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="ci-unit">Unit</label>
                <select
                  id="ci-unit"
                  value={form.unit}
                  onChange={(e) => handleChange("unit", e.target.value)}
                >
                  {UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="ci-portion">Portion size</label>
                <input
                  id="ci-portion"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={form.portion_size}
                  className={
                    errors.portion_size && touched.portion_size ? "error-input" : ""
                  }
                  onChange={(e) => handleChange("portion_size", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, portion_size: true }))}
                />
                {touched.portion_size && errors.portion_size && (
                  <div className="field-error">
                    <ErrorIcon />
                    {errors.portion_size}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Nutrition ── */}
          <div style={{ marginBottom: 20 }}>
            <div className="ci-section-label">Nutrition per 100 g</div>

            <div className="field">
              <label htmlFor="ci-kcal">Calories (kcal) *</label>
              <input
                id="ci-kcal"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                value={form.kcal}
                className={errors.kcal && touched.kcal ? "error-input" : ""}
                onChange={(e) => handleChange("kcal", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, kcal: true }))}
              />
              {touched.kcal && errors.kcal && (
                <div className="field-error">
                  <ErrorIcon />
                  {errors.kcal}
                </div>
              )}
            </div>

            <div className="ci-field-row">
              <div className="field">
                <label htmlFor="ci-protein">Protein (g)</label>
                <input
                  id="ci-protein"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={form.protein}
                  className={errors.protein && touched.protein ? "error-input" : ""}
                  onChange={(e) => handleChange("protein", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, protein: true }))}
                />
                {touched.protein && errors.protein && (
                  <div className="field-error">
                    <ErrorIcon />
                    {errors.protein}
                  </div>
                )}
              </div>
              <div className="field">
                <label htmlFor="ci-fat">Fat (g)</label>
                <input
                  id="ci-fat"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={form.fat}
                  className={errors.fat && touched.fat ? "error-input" : ""}
                  onChange={(e) => handleChange("fat", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, fat: true }))}
                />
                {touched.fat && errors.fat && (
                  <div className="field-error">
                    <ErrorIcon />
                    {errors.fat}
                  </div>
                )}
              </div>
            </div>

            <div className="ci-field-row">
              <div className="field">
                <label htmlFor="ci-carbs">Carbohydrates (g)</label>
                <input
                  id="ci-carbs"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={form.carbohydrates}
                  className={
                    errors.carbohydrates && touched.carbohydrates ? "error-input" : ""
                  }
                  onChange={(e) => handleChange("carbohydrates", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, carbohydrates: true }))}
                />
                {touched.carbohydrates && errors.carbohydrates && (
                  <div className="field-error">
                    <ErrorIcon />
                    {errors.carbohydrates}
                  </div>
                )}
              </div>
              <div className="field">
                <label htmlFor="ci-fiber">Fiber (g)</label>
                <input
                  id="ci-fiber"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={form.fiber}
                  className={errors.fiber && touched.fiber ? "error-input" : ""}
                  onChange={(e) => handleChange("fiber", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, fiber: true }))}
                />
                {touched.fiber && errors.fiber && (
                  <div className="field-error">
                    <ErrorIcon />
                    {errors.fiber}
                  </div>
                )}
              </div>
            </div>

            <div className="field">
              <label htmlFor="ci-sodium">Sodium (mg)</label>
              <input
                id="ci-sodium"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                value={form.sodium}
                className={errors.sodium && touched.sodium ? "error-input" : ""}
                onChange={(e) => handleChange("sodium", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, sodium: true }))}
              />
              {touched.sodium && errors.sodium && (
                <div className="field-error">
                  <ErrorIcon />
                  {errors.sodium}
                </div>
              )}
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}
          >
            <button
              type="submit"
              className={`btn-primary${isSubmitting ? "loading" : ""}`}
              disabled={isSubmitting}
            >
              <span className="btn-text">{submitLabel}</span>
              <div className="btn-spinner" />
            </button>

            {isEditing && (
              <button
                type="button"
                className="btn-danger"
                aria-label="Delete ingredient"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting}
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
                Delete Ingredient
              </button>
            )}
          </div>
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

// ── Icon helpers ──────────────────────────────────────────────────────────────

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
          Delete ingredient?
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "hsl(var(--muted-foreground))",
            lineHeight: 1.55,
            marginBottom: 24,
          }}
        >
          This will permanently remove the ingredient. It won't appear in search results
          anymore.
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
              color: "hsl(var(--ink-mid))",
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
