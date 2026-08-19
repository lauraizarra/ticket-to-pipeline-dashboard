"use client";

import { CSSProperties, FormEvent, useEffect, useState } from "react";

const navy = "#121e43";
const teal = "#00b296";
const cyan = "#16b8c5";
const muted = "#64748b";

const styles: Record<string, CSSProperties> = {
  screen: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 32,
    background:
      "radial-gradient(circle at 24% 18%, rgba(0,178,150,0.18), transparent 28%), radial-gradient(circle at 78% 76%, rgba(22,184,197,0.18), transparent 32%), linear-gradient(135deg, #041b36 0%, #121e43 56%, #0b4f74 100%)",
  },
  card: {
    width: "min(520px, 100%)",
    borderTop: `5px solid ${teal}`,
    borderRadius: 28,
    background: "rgba(255,255,255,0.965)",
    boxShadow: "0 28px 80px rgba(2, 8, 23, 0.3)",
    padding: 34,
    fontFamily:
      '"Infra", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
  },
  mark: {
    width: 58,
    height: 58,
    display: "grid",
    placeItems: "center",
    borderRadius: 18,
    background: `linear-gradient(135deg, ${teal}, ${cyan})`,
    color: navy,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },
  brandTitle: {
    margin: 0,
    color: navy,
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 760,
    letterSpacing: "-0.03em",
  },
  brandCopy: {
    margin: "5px 0 0",
    color: muted,
    fontSize: 13,
    fontWeight: 500,
  },
  pill: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(0,178,150,0.12)",
    color: "#047968",
    fontSize: 11,
    fontWeight: 850,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "14px 0 12px",
    color: navy,
    fontFamily:
      '"Nexa", "Montserrat", "Inter", ui-sans-serif, system-ui, sans-serif',
    fontSize: "clamp(34px, 4vw, 46px)",
    lineHeight: 1.02,
    fontWeight: 560,
    letterSpacing: "-0.055em",
  },
  copy: {
    margin: "0 0 22px",
    color: muted,
    fontSize: 16,
    lineHeight: 1.5,
    fontWeight: 430,
  },
  alertSuccess: {
    borderRadius: 14,
    padding: "13px 14px",
    marginBottom: 18,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: 13,
    fontWeight: 750,
  },
  alertError: {
    borderRadius: 14,
    padding: "13px 14px",
    marginBottom: 18,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: 750,
  },
  form: {
    display: "grid",
    gap: 10,
  },
  label: {
    color: navy,
    fontSize: 12,
    fontWeight: 850,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  passwordField: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #cfe1f5",
    borderRadius: 16,
    background: "#f8fbff",
    padding: 4,
    boxShadow: "inset 0 0 0 1px rgba(22,184,197,0.12)",
  },
  input: {
    minWidth: 0,
    flex: 1,
    border: 0,
    outline: 0,
    background: "transparent",
    padding: "13px 12px",
    color: navy,
    fontSize: 16,
  },
  ghostButton: {
    border: 0,
    borderRadius: 12,
    background: "transparent",
    color: muted,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    padding: "10px 12px",
  },
  submit: {
    marginTop: 4,
    border: 0,
    borderRadius: 16,
    background: `linear-gradient(90deg, ${teal}, ${cyan})`,
    color: "#ffffff",
    padding: "16px 18px",
    fontSize: 15,
    fontWeight: 850,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(0,178,150,0.22)",
  },
  footer: {
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid #e8f0fa",
  },
  footerStrong: {
    display: "block",
    color: navy,
    fontSize: 13,
    marginBottom: 6,
  },
  footerCopy: {
    margin: 0,
    color: muted,
    fontSize: 12,
    lineHeight: 1.45,
  },
};

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [logoutMessage, setLogoutMessage] = useState(false);
  const [nextPath, setNextPath] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLogoutMessage(params.get("logout") === "1");
    setNextPath(params.get("next") || "/");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password,
        next: nextPath,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setStatus("error");
      setError(result?.error || "No se pudo iniciar sesión.");
      return;
    }

    window.location.href = result.redirectTo || "/";
  }

  return (
    <main style={styles.screen}>
      <section style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.mark}>T2P</div>
          <div>
            <h1 style={styles.brandTitle}>Ticket to Pipeline</h1>
            <p style={styles.brandCopy}>Dashboard de Gestión CPSM, TAM, COM</p>
          </div>
        </div>

        <span style={styles.pill}>Acceso restringido</span>

        <h2 style={styles.title}>Ingresa al dashboard</h2>
        <p style={styles.copy}>
          Escribe la contraseña autorizada para consultar la gestión de tickets,
          cumplimiento y pipeline asociado.
        </p>

        {logoutMessage && (
          <div style={styles.alertSuccess}>
            La sesión se cerró correctamente.
          </div>
        )}

        {status === "error" && (
          <div style={styles.alertError}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="dashboard-password" style={styles.label}>Contraseña</label>

          <div style={styles.passwordField}>
            <input
              id="dashboard-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              style={styles.input}
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              style={styles.ghostButton}
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>

          <button
            style={{
              ...styles.submit,
              opacity: status === "loading" ? 0.72 : 1,
              cursor: status === "loading" ? "wait" : "pointer",
            }}
            type="submit"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Validando..." : "Ingresar de forma segura"}
          </button>
        </form>

        <div style={styles.footer}>
          <strong style={styles.footerStrong}>Sesión protegida</strong>
          <p style={styles.footerCopy}>
            El acceso caduca automáticamente después de 8 horas y puede cerrarse desde el dashboard.
          </p>
        </div>
      </section>
    </main>
  );
}
