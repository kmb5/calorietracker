import { useAuth } from "../hooks/useAuth";

export function HomePage() {
  const { logout } = useAuth();

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        CalorieTracker v3
      </h1>
      <p className="text-muted-foreground">
        You&apos;re logged in! Dashboard coming soon.
      </p>
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
