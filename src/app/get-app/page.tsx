"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function GetAppPage() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Already installed as PWA?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) { setIsInstalled(true); return; }

    // iOS detection
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIsIOS(true); return;
    }

    // Capture Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) { setShowIOSGuide(true); return; }
    if (!installPrompt) {
      // Already visited, prompt may have been used — open app directly
      window.location.href = "/dashboard";
      return;
    }
    setInstalling(true);
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstalling(false);
    setInstallPrompt(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#030712", fontFamily: "'Inter', sans-serif", color: "#f1f5f9", overflowX: "hidden" }}>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 1.5rem", height: 64, display: "flex", alignItems: "center", background: "rgba(3,7,18,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "1.1rem" }}>A</div>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>AFMS</span>
          </div>
          <a href="/dashboard" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", border: "none", padding: "0.5rem 1.25rem", borderRadius: 10, fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", textDecoration: "none" }}>
            Open App
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "120px 1.5rem 80px", position: "relative", textAlign: "center" }}>
        {/* Glows */}
        <div style={{ position: "absolute", width: 600, height: 600, background: "rgba(99,102,241,0.12)", borderRadius: "50%", filter: "blur(120px)", top: -100, left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 400, height: 400, background: "rgba(139,92,246,0.08)", borderRadius: "50%", filter: "blur(100px)", bottom: 100, right: -100, pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 700, width: "100%" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", padding: "6px 16px", borderRadius: 100, fontSize: "0.8rem", fontWeight: 500, color: "#a5b4fc", marginBottom: "1.5rem" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", display: "inline-block", animation: "pulse 2s infinite" }} />
            Available on Android and iPhone — Free
          </div>

          <h1 style={{ fontSize: "clamp(2.5rem,6vw,4rem)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.04em", marginBottom: "1.25rem" }}>
            Your Accounting Firm,<br />
            <span style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              In Your Pocket.
            </span>
          </h1>

          <p style={{ fontSize: "1.1rem", color: "#94a3b8", lineHeight: 1.7, maxWidth: 540, margin: "0 auto 2.5rem" }}>
            Manage clients, invoices, compliance deadlines and your team — all from one powerful app on your phone.
          </p>

          {/* INSTALL BUTTON */}
          {isInstalled ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 16, padding: "1rem 2rem", color: "#34d399", fontWeight: 700, fontSize: "1.1rem" }}>
                ✅ App already installed!
              </div>
              <a href="/dashboard" style={{ color: "#a5b4fc", fontSize: "0.9rem" }}>Open Dashboard →</a>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <button
                onClick={handleInstall}
                disabled={installing}
                style={{ display: "inline-flex", alignItems: "center", gap: 12, background: installing ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", border: "none", padding: "1.1rem 2.5rem", borderRadius: 16, fontWeight: 800, fontSize: "1.15rem", cursor: "pointer", boxShadow: "0 8px 40px rgba(99,102,241,0.45)", transition: "all 0.2s", fontFamily: "inherit", letterSpacing: "-0.01em" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v14m-5-5 5 5 5-5" /><path d="M3 20h18" />
                </svg>
                {installing ? "Installing..." : isIOS ? "Install on iPhone" : installPrompt ? "Install App Now" : "Open App"}
              </button>

              {!isIOS && !installPrompt && (
                <p style={{ fontSize: "0.82rem", color: "#64748b", maxWidth: 360 }}>
                  💡 To get the install button: Open this page in <strong style={{ color: "#94a3b8" }}>Chrome on your phone</strong>, then tap the button above.
                </p>
              )}

              {installPrompt && (
                <p style={{ fontSize: "0.82rem", color: "#a5b4fc" }}>
                  ✅ Your device is ready — tap Install App Now!
                </p>
              )}
            </div>
          )}

          {/* DEVICE GUIDES */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1rem", marginTop: "3rem", textAlign: "left" }}>
            {/* Android */}
            <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>🤖</div>
                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Android (Chrome)</span>
              </div>
              <ol style={{ paddingLeft: "1.2rem", color: "#94a3b8", fontSize: "0.875rem", lineHeight: 2 }}>
                <li>Open this page in <strong style={{ color: "#e2e8f0" }}>Chrome</strong></li>
                <li>Tap <strong style={{ color: "#a5b4fc" }}>"Install App Now"</strong> above</li>
                <li>Confirm install in the popup</li>
                <li>✅ App is on your home screen!</li>
              </ol>
            </div>

            {/* iOS */}
            <div style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 16, padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>🍎</div>
                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>iPhone / iPad (Safari)</span>
              </div>
              <ol style={{ paddingLeft: "1.2rem", color: "#94a3b8", fontSize: "0.875rem", lineHeight: 2 }}>
                <li>Open this page in <strong style={{ color: "#e2e8f0" }}>Safari</strong></li>
                <li>Tap the <strong style={{ color: "#c4b5fd" }}>Share ⎙</strong> button</li>
                <li>Tap <strong style={{ color: "#c4b5fd" }}>"Add to Home Screen"</strong></li>
                <li>✅ App is on your home screen!</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "80px 1.5rem", background: "rgba(15,23,42,0.5)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6366f1", marginBottom: "0.75rem" }}>Features</p>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.8rem,4vw,2.5rem)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "3rem" }}>Everything your firm needs</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "1.25rem" }}>
            {[
              { icon: "👥", color: "#6366f1", title: "Client Management", desc: "Organise all clients with profiles, documents and compliance tracking." },
              { icon: "🧾", color: "#8b5cf6", title: "Smart Invoicing", desc: "Create invoices, track payments and generate PDFs automatically." },
              { icon: "📅", color: "#06b6d4", title: "Compliance Alerts", desc: "Never miss GST, Income Tax, or TDS deadlines for any client." },
              { icon: "📁", color: "#10b981", title: "Document Vault", desc: "Securely store and access all client documents from anywhere." },
              { icon: "✅", color: "#f59e0b", title: "Task Tracking", desc: "Assign tasks to staff and track progress in real time." },
              { icon: "🔐", color: "#ef4444", title: "Role-Based Access", desc: "Admin, Manager, Accountant and Client roles with controlled access." },
            ].map((f, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "1.5rem", transition: "all 0.3s" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${f.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", marginBottom: "0.9rem" }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.95rem" }}>{f.title}</h3>
                <p style={{ color: "#94a3b8", fontSize: "0.875rem", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.9rem" }}>A</div>
            <span style={{ fontWeight: 800 }}>AFMS</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#64748b" }}>2026 Accounting Firm Management System. All rights reserved.</p>
        </div>
      </footer>

      {/* iOS Modal */}
      {showIOSGuide && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={() => setShowIOSGuide(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px 24px 0 0", padding: "2rem 1.5rem 3rem", width: "100%", maxWidth: 500 }}>
            <button onClick={() => setShowIOSGuide(false)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(255,255,255,0.08)", border: "none", width: 32, height: 32, borderRadius: "50%", color: "#94a3b8", cursor: "pointer", fontSize: "0.85rem" }}>✕</button>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, textAlign: "center", marginBottom: "1.5rem" }}>Install on iPhone</h3>
            {[
              "Open this page in Safari (not Chrome)",
              "Tap the Share ⎙ button at the bottom",
              "Tap \"Add to Home Screen\"",
              "Tap Add in the top right",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>{i + 1}</div>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.5, paddingTop: 4 }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        * { box-sizing: border-box; }
        button:hover { opacity: 0.9; transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
