/**
 * AdminBulkImportTab
 *
 * JSON file upload → calls POST /admin/ingredients/bulk-import → shows result.
 */
import { useRef, useState } from "react";
import { bulkImportIngredientsAdminIngredientsBulkImportPost } from "../../client/services.gen";
import type { BulkImportItem, BulkImportResult } from "../../client/types.gen";
import { useToast } from "../../hooks/useToast";

export function AdminBulkImportTab() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  function handleFile(f: File) {
    setFile(f);
    setParseError(null);
    setResult(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleImport() {
    if (!file) return;
    setParseError(null);
    setResult(null);

    let items: BulkImportItem[];
    try {
      const text = await file.text();
      items = JSON.parse(text) as BulkImportItem[];
      if (!Array.isArray(items))
        throw new Error("JSON must be an array of ingredient objects.");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON file.");
      return;
    }

    setImporting(true);
    try {
      const res = await bulkImportIngredientsAdminIngredientsBulkImportPost({
        requestBody: items,
      });
      setResult(res);
      toast({
        title: `Import complete — ${res.total} ingredients processed`,
        variant: "success",
      });
    } catch {
      toast({
        title: "Import failed. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setParseError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-foreground text-2xl font-bold">Bulk Import</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload a JSON array of ingredient objects. Existing system ingredients with
          the same (name, unit) pair will be updated; new ones will be created.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="relative cursor-pointer rounded-[16px] border-2 border-dashed transition-all"
        style={{
          borderColor: dragging
            ? "hsl(var(--primary))"
            : file
              ? "hsl(var(--success))"
              : "hsl(var(--border))",
          background: dragging ? "hsl(var(--secondary))" : "hsl(var(--muted))",
          padding: "40px 24px",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          aria-label="Upload JSON file"
        />
        <div className="flex flex-col items-center gap-3 text-center">
          {file ? (
            <>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-3xl"
                style={{ background: "hsl(var(--success-bg))" }}
              >
                ✅
              </div>
              <div>
                <p className="text-foreground font-semibold">{file.name}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
                className="text-muted-foreground hover:text-destructive cursor-pointer text-sm underline transition-colors"
              >
                Remove file
              </button>
            </>
          ) : (
            <>
              <div className="bg-secondary flex h-14 w-14 items-center justify-center rounded-full">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div>
                <p className="text-foreground font-semibold">Drop a JSON file here</p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  or click to browse
                </p>
              </div>
              <p className="text-muted-foreground text-xs">Accepts .json files only</p>
            </>
          )}
        </div>
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-[10px] border px-4 py-3 text-sm">
          <strong>Parse error:</strong> {parseError}
        </div>
      )}

      {/* Format reference */}
      <div className="bg-card border-border shadow-card-sm rounded-[14px] border p-5">
        <p className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-widest uppercase">
          Expected JSON format
        </p>
        <pre className="text-foreground bg-muted overflow-x-auto rounded-[8px] p-4 font-mono text-[12px] leading-relaxed">{`[
  {
    "name": "Oat milk",
    "unit": "ml",
    "portion_size": 100,
    "kcal": 43,
    "protein": 1.0,
    "fat": 1.5,
    "carbohydrates": 6.3,
    "fiber": 0.8,
    "sodium": 0.05,
    "icon": "🥛"
  }
]`}</pre>
        <p className="text-muted-foreground mt-3 text-xs">
          Valid units:{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[11px]">g</code>,{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[11px]">ml</code>,{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[11px]">tablespoon</code>,{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[11px]">piece</code>. The{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[11px]">icon</code> field
          is optional.
        </p>
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={!file || importing}
        className="bg-primary text-primary-foreground shadow-terra hover:bg-terra-dark flex cursor-pointer items-center gap-2 rounded-[12px] px-6 py-3.5 text-[15px] font-semibold transition-all hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {importing ? (
          <>
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
            Importing…
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import
          </>
        )}
      </button>

      {/* Result summary */}
      {result && (
        <div
          className="shadow-card-sm rounded-[14px] border p-5"
          style={{
            background: "hsl(var(--success-bg))",
            borderColor: "hsl(var(--success) / 0.3)",
          }}
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <p
              className="text-[15px] font-semibold"
              style={{ color: "hsl(var(--success))" }}
            >
              Import complete
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Created", value: result.created, emoji: "✨" },
              { label: "Updated", value: result.updated, emoji: "🔄" },
              { label: "Total", value: result.total, emoji: "📊" },
            ].map(({ label, value, emoji }) => (
              <div key={label} className="rounded-[10px] bg-white/60 p-3 text-center">
                <p className="mb-1 text-2xl">{emoji}</p>
                <p
                  className="font-display text-2xl font-bold"
                  style={{ color: "hsl(var(--success))" }}
                >
                  {value}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[12px] font-medium">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={reset}
            className="mt-4 cursor-pointer text-sm underline transition-colors"
            style={{ color: "hsl(var(--success))" }}
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
