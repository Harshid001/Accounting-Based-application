"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam === "OAuthAccountNotLinked") {
      setError("An account already exists with this email. Please sign in with your password instead.")
    } else if (errorParam === "AccessDenied") {
      setError("Access denied.")
    } else if (errorParam) {
      setError("An error occurred during authentication.")
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError("Invalid email or password")
      setLoading(false)
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const { Capacitor } = await import("@capacitor/core")
      
      if (Capacitor.isNativePlatform()) {
        const { GoogleSignIn } = await import("@capawesome/capacitor-google-sign-in")
        
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) {
          const err = new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
          err.name = "ConfigurationError";
          throw err;
        }

        await GoogleSignIn.initialize({
          clientId: clientId,
          scopes: ['profile', 'email']
        });

        const googleResult = await GoogleSignIn.signIn()
        
        if (googleResult.idToken) {
          const result = await signIn("google-native", {
            googleIdToken: googleResult.idToken,
            redirect: false,
          })
          
          if (result?.error) {
            setError(result.error)
            setLoading(false)
          } else {
            router.push("/dashboard")
            router.refresh()
          }
        } else {
          setError("Failed to get Google token")
          setLoading(false)
        }
      } else {
        signIn("google", { callbackUrl: "/dashboard" })
      }
    } catch (err: any) {
      if (err?.name === "ConfigurationError") {
        console.error("Configuration Error:", err);
        setError("Sign-in temporarily unavailable (configuration error).");
      } else if (err?.code === "SIGN_IN_CANCELED" || err?.message?.includes("cancel")) {
        console.log("User canceled Google sign-in:", err);
        setError(""); // Clear the step trace so the UI resets cleanly
      } else {
        console.error("Google sign in error:", err);
        setError("Google sign in failed");
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4 animate-fade-in">
      <div className="w-full max-w-md glass-card rounded-2xl p-8 animate-slide-up">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">Welcome to AFMS</h1>
          <p className="text-sm font-medium text-muted-foreground">Accounting Firm Management System</p>
        </div>
        
        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm font-medium text-destructive animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@afms.com"
              className="h-11 bg-background/50 focus:bg-background transition-colors"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-background/50 focus:bg-background transition-colors"
              required
            />
          </div>
          <Button type="submit" className="w-full h-11 text-base hover-lift mt-2 font-medium" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="relative mt-8 mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-semibold tracking-wider">
              Or continue with
            </span>
          </div>
        </div>

        <Button 
          variant="outline" 
          type="button" 
          className="w-full h-11 text-base hover-lift font-medium bg-background hover:bg-background/80" 
          disabled={loading}
          onClick={handleGoogleSignIn}
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Google
        </Button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-950 dark:to-indigo-950" />}>
      <LoginForm />
    </Suspense>
  )
}
