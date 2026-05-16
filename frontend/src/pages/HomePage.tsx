// NOTE: TEMPORARY HOMEPAGE JUST FOR DEMO PURPOSES!

import { Link } from "react-router-dom";
import { IngredientSearch } from "../components/IngredientSearch";
import { useAuth } from "../hooks/useAuth";

// ── Small helper: a labelled test-flow card ───────────────────────────────────
function FlowCard({
  emoji,
  title,
  description,
  children,
}: {
  emoji: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card rounded-[16px] border-[1.5px] p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="text-xl leading-none">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-[13px] leading-snug font-semibold">
            {title}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function HomePage() {
  const { logout } = useAuth();

  return (
    <div className="bg-background text-foreground min-h-screen px-5 py-8">
      <div className="mx-auto max-w-sm space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            CalorieTracker v3
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dev sandbox — issue #11 · Custom Ingredient UI
          </p>
        </div>

        {/* ── Test panel ── */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.8px] uppercase">
            Feature test flows
          </p>
        </div>

        {/* Flow 1 — Create from scratch */}
        <FlowCard
          emoji="✏️"
          title="Create a custom ingredient"
          description="Opens the form with an empty name. Fill in nutrition values, pick an emoji icon, save — then find it in search below."
        >
          <Link
            to="/ingredients/new"
            className="bg-primary text-primary-foreground hover:bg-terra-dark shadow-terra flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-px"
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
            New ingredient
          </Link>
        </FlowCard>

        {/* Flow 2 — Search → "no results" CTA */}
        <FlowCard
          emoji="🔍"
          title="Search → create from no-results"
          description="Type a name that doesn't exist. The 'Create custom ingredient' CTA appears — click it to open the form with the name pre-filled."
        >
          <IngredientSearch
            onSelect={(ing) => console.log("[test] selected:", ing)}
            onAdd={(detail) => console.log("[test] add to log:", detail)}
            placeholder='Try "My secret sauce"…'
          />
        </FlowCard>

        {/* Flow 3 — Search → select → edit */}
        <FlowCard
          emoji="🔧"
          title="Edit / delete a custom ingredient"
          description="Search for a custom ingredient you've already created. Select it to open the detail sheet, then tap Edit to open the pre-filled form. You can also delete it from there."
        >
          <IngredientSearch
            onSelect={(ing) => console.log("[test] selected for edit:", ing)}
            onAdd={(detail) => console.log("[test] add to log:", detail)}
            placeholder="Search your custom ingredients…"
          />
        </FlowCard>

        {/* Flow 4 — Promote to system */}
        <FlowCard
          emoji="⭐"
          title="Request promotion to system ingredient"
          description="Select any custom ingredient, open its detail sheet, and tap the 'Suggest as system' button. The button should switch to 'Pending review' after the request is sent."
        >
          <IngredientSearch
            onSelect={(ing) => console.log("[test] selected for promote:", ing)}
            onAdd={(detail) => console.log("[test] add to log:", detail)}
            placeholder="Search custom ingredients…"
          />
        </FlowCard>

        {/* Divider */}
        <div className="border-border border-t" />

        {/* Sign out */}
        <button
          onClick={logout}
          className="border-border text-muted-foreground hover:border-primary hover:text-primary w-full cursor-pointer rounded-[10px] border px-4 py-2.5 text-sm transition"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
