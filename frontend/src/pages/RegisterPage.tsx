import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../client/core/ApiError";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../hooks/useAuth";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pwStrength, setPwStrength] = useState<PwStrength | null>(null);

  // Field-level errors
  const [usernameErr, setUsernameErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function onPasswordChange(val: string) {
    setPasswordErr(null);
    setPwStrength(val ? calcStrength(val) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlert(null);
    setUsernameErr(null);
    setEmailErr(null);
    setPasswordErr(null);

    const username = usernameRef.current?.value.trim() ?? "";
    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";

    let hasErr = false;
    if (username.length < 3) {
      setUsernameErr(
        username ? "Username must be at least 3 characters" : "Username is required"
      );
      hasErr = true;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailErr(email ? "Please enter a valid email address" : "Email is required");
      hasErr = true;
    }
    if (password.length < 8) {
      setPasswordErr(
        password ? "Password must be at least 8 characters" : "Password is required"
      );
      hasErr = true;
    }
    if (hasErr) return;

    setLoading(true);
    try {
      await register({ username, email, password });
      navigate("/", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const detail: string =
          typeof err.body === "object" && err.body !== null && "detail" in err.body
            ? String((err.body as { detail: unknown }).detail)
            : "Registration failed. Please try again.";

        // NOTE: These checks rely on the exact wording of the backend's 400
        // error message text. If the backend error messages change, these
        // branches will silently fall through to the generic alert. A future
        // improvement is to return a machine-readable error code from the API
        // (e.g. { code: "USERNAME_TAKEN", detail: "..." }) and key on that
        // instead, or use HTTP 409 Conflict with a specific body field.
        if (detail.toLowerCase().includes("username")) {
          setAlert("Username already registered. Please choose a different one.");
          setUsernameErr("Username already taken");
        } else if (detail.toLowerCase().includes("email")) {
          setAlert("Email already registered. Did you mean to sign in?");
          setEmailErr("Email already in use");
        } else {
          setAlert(detail);
        }
      } else {
        setAlert("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="bg-layer" />

      <div className="brand">
        <BrandMark />
        <h1 className="brand-title">
          Calorie<span>Tracker</span>
        </h1>
        <p className="brand-subtitle">Start your journey today.</p>
      </div>

      <div className="card">
        <div className="card-handle" />
        <h2 className="card-title">Create account</h2>
        <p className="card-desc">Join to start tracking your recipes and nutrition.</p>

        {/* Server-level error alert */}
        {alert && (
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
            <span>{alert}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="field">
            <label htmlFor="reg-username">Username</label>
            <input
              ref={usernameRef}
              id="reg-username"
              type="text"
              name="username"
              placeholder="chef_marco"
              autoComplete="username"
              autoCapitalize="off"
              minLength={3}
              maxLength={64}
              className={usernameErr ? "error-input" : ""}
              onChange={() => {
                setUsernameErr(null);
                setAlert(null);
              }}
            />
            {usernameErr && (
              <div className="field-error">
                <ErrorIcon />
                {usernameErr}
              </div>
            )}
          </div>

          {/* Email */}
          <div className="field">
            <label htmlFor="reg-email">Email address</label>
            <input
              ref={emailRef}
              id="reg-email"
              type="email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
              className={emailErr ? "error-input" : ""}
              onChange={() => {
                setEmailErr(null);
                setAlert(null);
              }}
            />
            {emailErr && (
              <div className="field-error">
                <ErrorIcon />
                {emailErr}
              </div>
            )}
          </div>

          {/* Password */}
          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <div className="password-wrap">
              <input
                ref={passwordRef}
                id="reg-password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                minLength={8}
                className={passwordErr ? "error-input" : ""}
                onChange={(e) => onPasswordChange(e.target.value)}
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

            {/* Strength meter */}
            {pwStrength && (
              <div className="pw-strength visible">
                <div className="pw-strength-bar">
                  <div
                    className="pw-strength-fill"
                    style={{ width: pwStrength.pct, background: pwStrength.color }}
                  />
                </div>
                <span className="pw-strength-label" style={{ color: pwStrength.color }}>
                  {pwStrength.label}
                </span>
              </div>
            )}

            {passwordErr && (
              <div className="field-error">
                <ErrorIcon />
                {passwordErr}
              </div>
            )}
          </div>

          <button
            type="submit"
            className={`btn-primary${loading ? "loading" : ""}`}
            style={{ marginTop: "4px" }}
            disabled={loading}
          >
            <span className="btn-text">Create Account</span>
            <div className="btn-spinner" />
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in instead</Link>
        </p>
      </div>
    </div>
  );
}

// ── Password strength ─────────────────────────────────────────────────────────

interface PwStrength {
  pct: string;
  color: string;
  label: string;
}

function calcStrength(val: string): PwStrength {
  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels: PwStrength[] = [
    { pct: "20%", color: "#E05C3A", label: "Too short" },
    { pct: "40%", color: "#E07C3A", label: "Weak" },
    { pct: "60%", color: "#C9962B", label: "Fair" },
    { pct: "80%", color: "#4A9B6B", label: "Good" },
    { pct: "100%", color: "#2B7A4C", label: "Strong" },
  ];
  return levels[Math.min(score, 4)];
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
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path
        d="M13.5 6.5C12.3 7.7 10.7 8.5 9 8.5 5.9 8.5 3 6 3 6M3 6s-.7-.8-1-1.5M15 6s.7-.8 1-1.5M6 10.5 4.5 12M12 10.5l1.5 1.5M9 9v2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="2" y1="2" x2="16" y2="16" strokeLinecap="round" />
    </svg>
  );
}
