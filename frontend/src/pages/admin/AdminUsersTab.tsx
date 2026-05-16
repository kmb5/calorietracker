/**
 * AdminUsersTab
 *
 * Lists all users. Deactivate/Activate toggles is_active. Promote to Admin updates role.
 */
import { useEffect, useState } from "react";
import {
  listUsersAdminUsersGet,
  updateUserActiveAdminUsersUserIdPatch,
  updateUserRoleAdminUsersUserIdRolePatch,
} from "../../client/services.gen";
import type { UserAdminResponse } from "../../client/types.gen";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import { LoadingSkeleton, ErrorBanner } from "./AdminPromotionsTab";

export function AdminUsersTab() {
  const { toast } = useToast();
  // We need the current user's access token to determine their own ID (protect against self-modification)
  const { accessToken } = useAuth();

  const [users, setUsers] = useState<UserAdminResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Decode current user id from JWT (for "can't modify self" hint)
  const currentUserId = (() => {
    if (!accessToken) return null;
    try {
      const payload = JSON.parse(
        atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      ) as { sub?: string };
      return payload.sub ? Number(payload.sub) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listUsersAdminUsersGet();
        if (!cancelled) setUsers(data);
      } catch {
        if (!cancelled) setError("Failed to load users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleActive(user: UserAdminResponse) {
    setBusy(user.id);
    try {
      const updated = await updateUserActiveAdminUsersUserIdPatch({
        userId: user.id,
        requestBody: { is_active: !user.is_active },
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      toast({
        title: updated.is_active
          ? `${user.username} activated`
          : `${user.username} deactivated`,
        variant: updated.is_active ? "success" : undefined,
      });
    } catch {
      toast({ title: "Action failed. Please try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function promoteToAdmin(user: UserAdminResponse) {
    setBusy(user.id);
    try {
      const updated = await updateUserRoleAdminUsersUserIdRolePatch({
        userId: user.id,
        requestBody: { role: "admin" },
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      toast({ title: `${user.username} promoted to admin`, variant: "success" });
    } catch {
      toast({ title: "Action failed. Please try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="max-w-5xl space-y-5">
      {/* Search */}
      <div className="relative max-w-sm">
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or email…"
          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary h-[44px] w-full rounded-[10px] border pr-4 pl-10 text-[14px] transition-all outline-none focus:shadow-[0_0_0_3px_hsl(16_65%_48%_/_0.12)]"
        />
      </div>

      <p className="text-muted-foreground text-sm">
        {filtered.length} {filtered.length === 1 ? "user" : "users"}
        {search && ` matching "${search}"`}
      </p>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">No users found.</p>
        </div>
      ) : (
        <div className="bg-card border-border shadow-card-sm overflow-hidden rounded-[14px] border">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-5 py-3 text-left text-[11px] font-semibold tracking-wide uppercase">
                  User
                </th>
                <th className="text-muted-foreground hidden px-4 py-3 text-left text-[11px] font-semibold tracking-wide uppercase md:table-cell">
                  Email
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-[11px] font-semibold tracking-wide uppercase">
                  Role
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-[11px] font-semibold tracking-wide uppercase">
                  Status
                </th>
                <th className="text-muted-foreground w-[180px] px-5 py-3 text-right text-[11px] font-semibold tracking-wide uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, idx) => {
                const isSelf = user.id === currentUserId;
                const isBusy = busy === user.id;
                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-muted/50 transition-colors ${idx !== filtered.length - 1 ? "border-border border-b" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                          style={{
                            background:
                              user.role === "admin"
                                ? "hsl(260 50% 85%)"
                                : "hsl(var(--secondary))",
                            color:
                              user.role === "admin"
                                ? "hsl(260 50% 35%)"
                                : "hsl(var(--secondary-foreground))",
                          }}
                        >
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-foreground font-medium">{user.username}</p>
                          {isSelf && (
                            <p className="text-muted-foreground text-[11px]">You</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground hidden px-4 py-3.5 md:table-cell">
                      {user.email}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                        style={
                          user.role === "admin"
                            ? {
                                background: "hsl(260 50% 90%)",
                                color: "hsl(260 50% 35%)",
                              }
                            : {
                                background: "hsl(var(--muted))",
                                color: "hsl(var(--muted-foreground))",
                              }
                        }
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                        style={
                          user.is_active
                            ? {
                                background: "hsl(var(--success-bg))",
                                color: "hsl(var(--success))",
                              }
                            : {
                                background: "hsl(var(--destructive) / 0.1)",
                                color: "hsl(var(--destructive))",
                              }
                        }
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {isSelf ? (
                        <span className="text-muted-foreground text-[12px] italic">
                          —
                        </span>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          {/* Activate/Deactivate */}
                          <button
                            onClick={() => toggleActive(user)}
                            disabled={isBusy}
                            className="cursor-pointer rounded-[7px] border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            style={
                              user.is_active
                                ? {
                                    borderColor: "hsl(var(--destructive))",
                                    color: "hsl(var(--destructive))",
                                    background: "transparent",
                                  }
                                : {
                                    borderColor: "hsl(var(--success))",
                                    color: "hsl(var(--success))",
                                    background: "transparent",
                                  }
                            }
                          >
                            {isBusy ? "…" : user.is_active ? "Deactivate" : "Activate"}
                          </button>

                          {/* Promote to Admin */}
                          {user.role !== "admin" && (
                            <button
                              onClick={() => promoteToAdmin(user)}
                              disabled={isBusy}
                              className="border-border hover:bg-muted text-muted-foreground cursor-pointer rounded-[7px] border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBusy ? "…" : "Make Admin"}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
