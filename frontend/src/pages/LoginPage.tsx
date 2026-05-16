import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../client/core/ApiError";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Field-level errors
  const [usernameErr, setUsernameErr] = useState(false);
  const [passwordErr, setPasswordErr] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUsernameErr(false);
    setPasswordErr(false);

    const username = usernameRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";

    let hasErr = false;
    if (!username) {
      setUsernameErr(true);
      hasErr = true;
    }
    if (!password) {
      setPasswordErr(true);
      hasErr = true;
    }
    if (hasErr) return;

    setLoading(true);
    try {
      await login({ username, password });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Invalid credentials. Please check your username and password.");
        } else if (err.status === 403) {
          setError("Your account has been deactivated. Please contact support.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      {/* Animated background */}
      <div className="bg-layer" />

      <div className="brand">
        <BrandMark />
        <h1 className="brand-title">
          Calorie<span>Tracker</span>
        </h1>
        <p className="brand-subtitle">Cook smarter. Know what you eat.</p>
      </div>

      <div className="card">
        <div className="card-handle" />
        <h2 className="card-title">Welcome back</h2>
        <p className="card-desc">Sign in to your kitchen diary.</p>

        {/* Error alert */}
        {error && (
          <div className="alert alert-error">
            <svg
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="8" />
              <path d="M9 5.5v4M9 12.5h.01" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="field">
            <label htmlFor="login-username">Username</label>
            <input
              ref={usernameRef}
              id="login-username"
              type="text"
              name="username"
              placeholder="your_username"
              autoComplete="username"
              autoCapitalize="off"
              className={usernameErr ? "error-input" : ""}
              onChange={() => {
                setUsernameErr(false);
                setError(null);
              }}
            />
            {usernameErr && (
              <div className="field-error">
                <ErrorIcon />
                Username is required
              </div>
            )}
          </div>

          {/* Password */}
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className="password-wrap">
              <input
                ref={passwordRef}
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className={passwordErr ? "error-input" : ""}
                onChange={() => {
                  setPasswordErr(false);
                  setError(null);
                }}
              />
              <button
                type="button"
                className="toggle-pw"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {passwordErr && (
              <div className="field-error">
                <ErrorIcon />
                Password is required
              </div>
            )}
          </div>

          <div className="forgot-row">
            <a className="forgot-link" href="#">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className={`btn-primary${loading ? "loading" : ""}`}
            disabled={loading}
          >
            <span className="btn-text">Sign In</span>
            <div className="btn-spinner" />
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        <p className="auth-switch">
          No account yet? <Link to="/register">Create one — it&apos;s free</Link>
        </p>
      </div>
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

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z" strokeLinecap="round" />
      <circle cx="9" cy="9" r="2.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M10.73 10.73A2 2 0 0 0 12 14a2 2 0 0 0 1.27-3.27" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
