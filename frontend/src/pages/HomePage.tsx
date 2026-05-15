import { useAuth } from "../hooks/useAuth";

export function HomePage() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        CalorieTracker v3
      </h1>
      <p className="text-muted-foreground">
        You&apos;re logged in! Dashboard coming soon.
      </p>
      <button
        onClick={logout}
        className="mt-4 rounded-md border border-border px-4 py-2 text-sm text-ink-mid transition hover:border-primary hover:text-primary"
        style={{ cursor: "pointer" }}
      >
        Sign out
      </button>
    </div>
  );
}
