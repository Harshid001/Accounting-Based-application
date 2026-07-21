"use client";

import { useEffect, useState } from "react";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (running in standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed before
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed) return;

    // Detect iOS
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(iOS);

    if (iOS) {
      // Show iOS manual instructions
      setShowBanner(true);
      return;
    }

    // Listen for Chrome/Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (isInstalled || !showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe animate-slide-up">
      <div
        className="relative flex items-start gap-3 rounded-2xl p-4 shadow-2xl border"
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          borderColor: "rgba(99,102,241,0.4)",
          boxShadow: "0 -4px 30px rgba(99,102,241,0.2), 0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Icon */}
        <div
          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          <Smartphone className="w-6 h-6 text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">Install AFMS App</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-snug">
            {isIOS
              ? "Tap the Share button then 'Add to Home Screen'"
              : "Install for quick access — works offline too!"}
          </p>

          {/* iOS Steps */}
          {isIOS && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-0.5">1. Tap Share ⎙</span>
              <span className="text-xs text-slate-500">→</span>
              <span className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-0.5">2. Add to Home Screen</span>
            </div>
          )}

          {/* Android Install Button */}
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-1.5 transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              <Download className="w-3.5 h-3.5" />
              Install Now
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
