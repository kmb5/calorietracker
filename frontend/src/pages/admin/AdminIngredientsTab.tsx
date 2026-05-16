/**
 * AdminIngredientsTab
 *
 * Searchable table of all system ingredients.
 * Add: opens an inline form. Edit: pre-fills the same form. Delete: confirmation step.
 */
import { useEffect, useState, useCallback } from "react";
import {
  searchIngredientsIngredientsSearchGet,
  listSystemIngredientsAdminIngredientsGet,
  getAnyIngredientAdminIngredientsIngredientIdGet,
  createSystemIngredientAdminIngredientsPost,
  updateAnyIngredientAdminIngredientsIngredientIdPatch,
  deleteAnyIngredientAdminIngredientsIngredientIdDelete,
} from "../../client/services.gen";
import type {
  IngredientDetail,
  IngredientCreate,
  UnitType,
} from "../../client/types.gen";
import { ApiError } from "../../client/core/ApiError";
import { useToast } from "../../hooks/useToast";
import { LoadingSkeleton, ErrorBanner } from "./AdminPromotionsTab";

// ── Form state ────────────────────────────────────────────────────────────────

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
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "tablespoon", label: "Tablespoon" },
  { value: "piece", label: "Piece" },
];

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {};
  if (!form.name.trim()) e.name = "Required";
  if (!form.portion_size || Number(form.portion_size) <= 0)
    e.portion_size = "Must be > 0";
  for (const f of [
    "kcal",
    "protein",
    "fat",
    "carbohydrates",
    "fiber",
    "sodium",
  ] as const) {
    if (form[f] === "" || isNaN(Number(form[f])) || Number(form[f]) < 0)
      e[f] = "Required, ≥ 0";
  }
  return e;
}

function ingredientToForm(i: IngredientDetail): FormState {
  return {
    name: i.name,
    icon: i.icon ?? "",
    unit: i.unit,
    portion_size: String(i.portion_size),
    kcal: String(i.kcal),
    protein: String(i.protein),
    fat: String(i.fat),
    carbohydrates: String(i.carbohydrates),
    fiber: String(i.fiber),
    sodium: String(i.sodium),
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminIngredientsTab() {
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IngredientDetail[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Form mode: null = list, "add" = new, number = editing ingredient id
  const [formMode, setFormMode] = useState<null | "add" | number>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<IngredientDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Search ────────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    setSearchError(null);
    try {
      if (q) {
        const data = await searchIngredientsIngredientsSearchGet({
          q,
          limit: 50,
        });
        // searchIngredientsIngredientsSearchGet returns IngredientSearchResult[].
        // We only use name/icon/unit/kcal in the list view; full details are
        // fetched via getAnyIngredientAdminIngredientsIngredientIdGet when editing.
        setResults(
          data.map(
            (r) =>
              ({
                id: r.id,
                name: r.name,
                icon: r.icon ?? null,
                unit: r.unit,
                portion_size: r.portion_size,
                kcal: r.kcal,
                is_system: r.is_system,
                protein: 0,
                fat: 0,
                carbohydrates: 0,
                fiber: 0,
                sodium: 0,
                owner_id: null,
                is_promotion_pending: false,
                promotion_rejection_note: null,
              }) satisfies IngredientDetail
          )
        );
      } else {
        const data = await listSystemIngredientsAdminIngredientsGet();
        setResults(data);
      }
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setTouched({});
    setFormMode("add");
  }

  async function openEdit(ing: IngredientDetail) {
    try {
      const full = await getAnyIngredientAdminIngredientsIngredientIdGet({
        ingredientId: ing.id,
      });
      setForm(ingredientToForm(full));
    } catch {
      // Fall back to whatever we have in the list row
      setForm(ingredientToForm(ing));
    }
    setFormErrors({});
    setTouched({});
    setFormMode(ing.id);
  }

  function closeForm() {
    setFormMode(null);
  }

  function handleFieldChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allTouched = Object.keys(form).reduce(
      (acc, k) => ({ ...acc, [k]: true }),
      {} as typeof touched
    );
    setTouched(allTouched);
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    const payload: IngredientCreate = {
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

    try {
      if (formMode === "add") {
        await createSystemIngredientAdminIngredientsPost({ requestBody: payload });
        toast({ title: "Ingredient created", variant: "success" });
      } else if (typeof formMode === "number") {
        await updateAnyIngredientAdminIngredientsIngredientIdPatch({
          ingredientId: formMode,
          requestBody: payload,
        });
        toast({ title: "Ingredient updated", variant: "success" });
      }
      closeForm();
      await runSearch(query);
    } catch {
      toast({ title: "Save failed. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAnyIngredientAdminIngredientsIngredientIdDelete({
        ingredientId: deleteTarget.id,
      });
      setDeleteTarget(null);
      toast({ title: "Ingredient deleted", variant: "success" });
      await runSearch(query);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast({
          title: "Cannot delete — ingredient is in use",
          description:
            "This ingredient is referenced by at least one recipe or meal log entry.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Delete failed. Please try again.", variant: "destructive" });
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  // ── Render: form overlay ──────────────────────────────────────────────────
  if (formMode !== null) {
    return (
      <IngredientForm
        form={form}
        errors={formErrors}
        touched={touched}
        submitting={submitting}
        isEdit={formMode !== "add"}
        onFieldChange={handleFieldChange}
        onBlur={(field) => setTouched((p) => ({ ...p, [field]: true }))}
        onSubmit={handleSubmit}
        onCancel={closeForm}
      />
    );
  }

  // ── Render: list ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl space-y-5">
      {/* Search + Add button */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <svg
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
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
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search system ingredients…"
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary h-[44px] w-full rounded-[10px] border pr-4 pl-10 text-[14px] transition-all outline-none focus:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)]"
          />
        </div>
        <button
          onClick={openAdd}
          className="bg-primary text-primary-foreground hover:bg-terra-dark shadow-terra flex cursor-pointer items-center gap-2 rounded-[10px] px-4 py-2.5 text-[14px] font-semibold transition-all hover:-translate-y-px"
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
          Add ingredient
        </button>
      </div>

      {/* Results */}
      {initialLoad ? (
        <LoadingSkeleton rows={5} />
      ) : searchError ? (
        <ErrorBanner message={searchError} />
      ) : results.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">
            {query
              ? `No system ingredients matching "${query}"`
              : "No system ingredients found."}
          </p>
        </div>
      ) : (
        <div className="bg-card border-border shadow-card-sm overflow-hidden rounded-[14px] border">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-5 py-3 text-left text-[11px] font-semibold tracking-wide uppercase">
                  Name
                </th>
                <th className="text-muted-foreground hidden px-4 py-3 text-left text-[11px] font-semibold tracking-wide uppercase sm:table-cell">
                  Unit
                </th>
                <th className="text-muted-foreground hidden px-4 py-3 text-right text-[11px] font-semibold tracking-wide uppercase md:table-cell">
                  kcal
                </th>
                <th className="text-muted-foreground w-[120px] px-5 py-3 text-right text-[11px] font-semibold tracking-wide uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((ing, idx) => (
                <tr
                  key={ing.id}
                  className={`hover:bg-muted/50 transition-colors ${idx !== results.length - 1 ? "border-border border-b" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{ing.icon ?? "🍽️"}</span>
                      <span className="text-foreground font-medium">{ing.name}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-3.5 sm:table-cell">
                    {ing.unit}
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-3.5 text-right md:table-cell">
                    {ing.kcal}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(ing)}
                        className="border-border hover:bg-muted text-foreground cursor-pointer rounded-[7px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(ing)}
                        className="text-destructive hover:bg-destructive/10 cursor-pointer rounded-[7px] px-3 py-1.5 text-[12px] font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteTarget(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="bg-card border-border w-full max-w-md rounded-[16px] border p-6 shadow-[0_8px_40px_rgba(0,0,0,0.2)]"
          >
            <div className="bg-destructive/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
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
              className="font-display text-foreground text-xl font-bold"
            >
              Delete ingredient?
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              <strong className="text-foreground">{deleteTarget.name}</strong> will be
              permanently removed from the system ingredient library. This cannot be
              undone.
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              If this ingredient is referenced by any recipe or meal log, the deletion
              will be blocked.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground flex-1 cursor-pointer rounded-[10px] py-3 text-[14px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="bg-muted text-foreground border-border hover:bg-muted/70 flex-1 cursor-pointer rounded-[10px] border py-3 text-[14px] font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ingredient form ───────────────────────────────────────────────────────────

interface IngredientFormProps {
  form: FormState;
  errors: Partial<Record<keyof FormState, string>>;
  touched: Partial<Record<keyof FormState, boolean>>;
  submitting: boolean;
  isEdit: boolean;
  onFieldChange: (field: keyof FormState, value: string) => void;
  onBlur: (field: keyof FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function IngredientForm({
  form,
  errors,
  touched,
  submitting,
  isEdit,
  onFieldChange,
  onBlur,
  onSubmit,
  onCancel,
}: IngredientFormProps) {
  return (
    <div className="max-w-2xl">
      {/* Back link */}
      <button
        onClick={onCancel}
        className="text-muted-foreground hover:text-foreground mb-5 flex cursor-pointer items-center gap-1.5 text-[13px] transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to list
      </button>

      <h2 className="font-display text-foreground mb-6 text-2xl font-bold">
        {isEdit ? "Edit System Ingredient" : "Add System Ingredient"}
      </h2>

      <form onSubmit={onSubmit} noValidate>
        <div className="bg-card border-border shadow-card-sm space-y-5 rounded-[16px] border p-6">
          {/* Name + icon row */}
          <div className="grid grid-cols-[1fr_auto] items-start gap-4">
            <FormField
              id="ing-name"
              label="Name"
              required
              error={touched.name ? errors.name : undefined}
            >
              <input
                id="ing-name"
                type="text"
                value={form.name}
                onChange={(e) => onFieldChange("name", e.target.value)}
                onBlur={() => onBlur("name")}
                placeholder="e.g. Oat milk"
                className={fieldClass(touched.name, errors.name)}
              />
            </FormField>
            <FormField id="ing-icon" label="Icon">
              <input
                id="ing-icon"
                type="text"
                value={form.icon}
                onChange={(e) => onFieldChange("icon", e.target.value)}
                placeholder="🍽️"
                maxLength={4}
                className={`${fieldClass()} w-16 text-center text-xl`}
              />
            </FormField>
          </div>

          {/* Unit + Portion size */}
          <div className="grid grid-cols-2 gap-4">
            <FormField id="ing-unit" label="Unit" required>
              <select
                id="ing-unit"
                value={form.unit}
                onChange={(e) => onFieldChange("unit", e.target.value)}
                className={`${fieldClass()} cursor-pointer appearance-none`}
              >
                {UNIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="ing-portion"
              label="Portion size"
              required
              error={touched.portion_size ? errors.portion_size : undefined}
            >
              <input
                id="ing-portion"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.portion_size}
                onChange={(e) => onFieldChange("portion_size", e.target.value)}
                onBlur={() => onBlur("portion_size")}
                className={fieldClass(touched.portion_size, errors.portion_size)}
              />
            </FormField>
          </div>

          {/* Nutrition */}
          <div>
            <p className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-widest uppercase">
              Nutrition per portion
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {[
                { f: "kcal" as const, label: "Calories", unit: "kcal" },
                { f: "protein" as const, label: "Protein", unit: "g" },
                { f: "fat" as const, label: "Fat", unit: "g" },
                { f: "carbohydrates" as const, label: "Carbohydrates", unit: "g" },
                { f: "fiber" as const, label: "Fiber", unit: "g" },
                { f: "sodium" as const, label: "Sodium", unit: "mg" },
              ].map(({ f, label, unit }) => (
                <FormField
                  key={f}
                  id={`ing-${f}`}
                  label={`${label} (${unit})`}
                  required
                  error={touched[f] ? errors[f] : undefined}
                >
                  <input
                    id={`ing-${f}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={form[f]}
                    onChange={(e) => onFieldChange(f, e.target.value)}
                    onBlur={() => onBlur(f)}
                    placeholder="0"
                    className={fieldClass(touched[f], errors[f])}
                  />
                </FormField>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-terra-dark shadow-terra flex-1 cursor-pointer rounded-[12px] py-3.5 text-[15px] font-semibold transition-all hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save Changes"
                  : "Create Ingredient"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="bg-muted text-foreground border-border hover:bg-muted/70 cursor-pointer rounded-[12px] border px-6 py-3.5 text-[15px] font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function fieldClass(touched?: boolean, error?: string) {
  return `w-full h-[44px] px-3.5 rounded-[10px] border bg-muted text-foreground text-[14px] outline-none transition-all ${
    touched && error
      ? "border-destructive focus:border-destructive"
      : "border-border focus:border-primary focus:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)]"
  }`;
}

function FormField({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-muted-foreground mb-1.5 block text-[11px] font-semibold tracking-wide uppercase"
      >
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-destructive mt-1 text-[12px]">{error}</p>}
    </div>
  );
}
