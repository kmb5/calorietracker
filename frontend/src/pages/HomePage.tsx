// NOTE: TEMPORARY HOMEPAGE JUST FOR DEMO PURPOSES!

import { IngredientSearch } from "../components/IngredientSearch";
import { useAuth } from "../hooks/useAuth";

export function HomePage() {
  const { logout } = useAuth();

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 px-5">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        CalorieTracker v3
      </h1>
      <div className="w-full max-w-sm">
        <IngredientSearch
          onSelect={(ing) => console.log("selected:", ing)}
          onAdd={(detail) => console.log("add to log:", detail)}
        />
      </div>
      <button
        onClick={logout}
        className="border-border text-ink-mid hover:border-primary hover:text-primary mt-4 rounded-md border px-4 py-2 text-sm transition"
        style={{ cursor: "pointer" }}
      >
        Sign out
      </button>
    </div>
  );
}
