"use client"

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(console.error);
    }
  }, []);

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
