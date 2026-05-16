/**
 * AdminDashboard
 *
 * Four-tab admin panel: Promotions | System Ingredients | Bulk Import | Users
 * Desktop-primary layout (sidebar nav) that degrades gracefully at mobile widths.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { AdminPromotionsTab } from "./AdminPromotionsTab";
import { AdminIngredientsTab } from "./AdminIngredientsTab";
import { AdminBulkImportTab } from "./AdminBulkImportTab";
import { AdminUsersTab } from "./AdminUsersTab";

type Tab = "promotions" | "ingredients" | "bulk-import" | "users";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "promotions",
    label: "Promotions",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    id: "ingredients",
    label: "System Ingredients",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    ),
  },
  {
    id: "bulk-import",
    label: "Bulk Import",
    icon: (
      <svg
        width="18"
        height="18"
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
    ),
  },
  {
    id: "users",
    label: "Users",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export function AdminDashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("promotions");

  return (
    <div className="bg-background flex min-h-screen flex-col lg:flex-row">
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col lg:min-h-screen lg:w-60 lg:flex-shrink-0"
        style={{ background: "hsl(var(--foreground))" }}
      >
        {/* Brand */}
        <div
          className="border-b px-6 py-6"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Link to="/" className="group flex cursor-pointer items-center gap-2.5">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px]"
              style={{ background: "hsl(var(--primary))" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
            <div>
              <p
                className="text-[13px] leading-none font-semibold"
                style={{ color: "rgba(255,255,255,0.95)" }}
              >
                CalorieTracker
              </p>
              <p
                className="mt-0.5 text-[10px] font-medium tracking-wide uppercase"
                style={{ color: "hsl(var(--primary))" }}
              >
                Admin Panel
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop tab navigation */}
        <nav className="hidden flex-1 px-3 py-4 lg:block">
          <p
            className="mb-2 px-3 text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Management
          </p>
          <ul className="space-y-0.5">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-[14px] font-medium transition-all"
                  style={{
                    background:
                      activeTab === tab.id ? "rgba(201,86,43,0.18)" : "transparent",
                    color:
                      activeTab === tab.id
                        ? "hsl(var(--primary))"
                        : "rgba(255,255,255,0.65)",
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(255,255,255,0.06)";
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "rgba(255,255,255,0.9)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "transparent";
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "rgba(255,255,255,0.65)";
                    }
                  }}
                >
                  <span
                    style={{
                      color:
                        activeTab === tab.id
                          ? "hsl(var(--primary))"
                          : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout (desktop) */}
        <div
          className="hidden border-t px-3 py-4 lg:block"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={logout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-[13px] font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "rgba(255,255,255,0.7)";
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "rgba(255,255,255,0.4)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile tab switcher + header) */}
        <header className="bg-card border-border flex items-center justify-between gap-4 border-b px-4 py-4 lg:px-8">
          <div>
            <h1 className="font-display text-foreground text-xl leading-tight font-bold">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-[12px]">
              Admin control panel
            </p>
          </div>
          {/* Mobile: sign out */}
          <button
            onClick={logout}
            className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-[8px] p-2 transition-colors lg:hidden"
            aria-label="Sign out"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </header>

        {/* Mobile tab bar */}
        <div className="bg-card border-border overflow-x-auto border-b lg:hidden">
          <div className="flex min-w-max gap-1 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-medium whitespace-nowrap transition-colors"
                style={{
                  borderBottomColor:
                    activeTab === tab.id ? "hsl(var(--primary))" : "transparent",
                  color:
                    activeTab === tab.id
                      ? "hsl(var(--primary))"
                      : "hsl(var(--muted-foreground))",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <main className="flex-1 px-4 py-6 lg:px-8">
          {activeTab === "promotions" && <AdminPromotionsTab />}
          {activeTab === "ingredients" && <AdminIngredientsTab />}
          {activeTab === "bulk-import" && <AdminBulkImportTab />}
          {activeTab === "users" && <AdminUsersTab />}
        </main>
      </div>
    </div>
  );
}
