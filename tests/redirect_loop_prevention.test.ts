/**
 * Redirect-Loop Prevention Tests
 *
 * Verifies the fixes for ERR_TOO_MANY_REDIRECTS:
 *  1. getRedirectTarget never returns a target equal to the pathname (no self-loops).
 *  2. Public auth destinations (/login, /pending-approval) are never redirected.
 *  3. Root "/" passes through proxy (the page.tsx handles single-hop navigation).
 *  4. proxy.ts builds redirects from request.nextUrl (protocol-safe), not request.url.
 */
import { describe, it, expect } from "vitest"
import { getRedirectTarget } from "@/lib/middleware-logic"

describe("Redirect-Loop Prevention — getRedirectTarget edge cases", () => {
  describe("Public auth destinations are never redirected", () => {
    it("/login with no role → null (no loop)", () => {
      expect(getRedirectTarget("/login", undefined)).toBeNull()
    })

    it("/login with CLIENT role → null (no loop)", () => {
      expect(getRedirectTarget("/login", "CLIENT")).toBeNull()
    })

    it("/login with ADMIN role → null (no loop)", () => {
      expect(getRedirectTarget("/login", "ADMIN")).toBeNull()
    })

    it("/pending-approval with no role → null (no loop)", () => {
      expect(getRedirectTarget("/pending-approval", undefined)).toBeNull()
    })

    it("/pending-approval with CLIENT role → null (no loop)", () => {
      expect(getRedirectTarget("/pending-approval", "CLIENT")).toBeNull()
    })
  })

  describe("Root path passes through (page.tsx handles single-hop nav)", () => {
    it("/ with no role → null", () => {
      expect(getRedirectTarget("/", undefined)).toBeNull()
    })

    it("/ with CLIENT role → null", () => {
      expect(getRedirectTarget("/", "CLIENT")).toBeNull()
    })

    it("/ with ADMIN role → null", () => {
      expect(getRedirectTarget("/", "ADMIN")).toBeNull()
    })
  })

  describe("No self-redirect loops", () => {
    it("CLIENT on /client-view → null (not /client-view)", () => {
      expect(getRedirectTarget("/client-view", "CLIENT")).toBeNull()
    })

    it("CLIENT on /client-view/invoices → null", () => {
      expect(getRedirectTarget("/client-view/invoices", "CLIENT")).toBeNull()
    })

    it("ADMIN on /dashboard → null (not /dashboard)", () => {
      expect(getRedirectTarget("/dashboard", "ADMIN")).toBeNull()
    })

    it("ACCOUNTANT on /dashboard/tasks → null", () => {
      expect(getRedirectTarget("/dashboard/tasks", "ACCOUNTANT")).toBeNull()
    })
  })

  describe("Established auth-routing rules still hold", () => {
    it("Unauthenticated → /dashboard redirects to /login", () => {
      expect(getRedirectTarget("/dashboard", undefined)).toBe("/login")
      expect(getRedirectTarget("/dashboard/tasks", undefined)).toBe("/login")
    })

    it("Unauthenticated → /client-view redirects to /login", () => {
      expect(getRedirectTarget("/client-view", undefined)).toBe("/login")
    })

    it("Unauthenticated → /api/* returns 401", () => {
      expect(getRedirectTarget("/api/invoices", undefined)).toBe("401")
    })

    it("CLIENT → /dashboard redirects to /client-view", () => {
      expect(getRedirectTarget("/dashboard", "CLIENT")).toBe("/client-view")
      expect(getRedirectTarget("/dashboard/clients/123", "CLIENT")).toBe("/client-view")
    })
  })
})

describe("proxy.ts — protocol-safe redirect construction", () => {
  it("builds redirects from request.nextUrl.clone(), not request.url", async () => {
    const fs = await import("fs")
    const proxyContent = fs.readFileSync(
      "d:/NewVolumeE/Accounting Business App/src/proxy.ts",
      "utf-8"
    )
    expect(proxyContent).toContain("request.nextUrl.clone()")
    expect(proxyContent).not.toContain("new URL(target, request.url)")
  })

  it("still imports getRedirectTarget from middleware-logic.ts", async () => {
    const fs = await import("fs")
    const proxyContent = fs.readFileSync(
      "d:/NewVolumeE/Accounting Business App/src/proxy.ts",
      "utf-8"
    )
    expect(proxyContent).toContain('import { getRedirectTarget } from "@/lib/middleware-logic"')
    expect(proxyContent).toContain("getRedirectTarget(pathname, role)")
  })
})

describe("app/page.tsx — single-hop root navigation", () => {
  it("uses getServerSession for role-aware single-hop redirect", async () => {
    const fs = await import("fs")
    const pageContent = fs.readFileSync(
      "d:/NewVolumeE/Accounting Business App/src/app/page.tsx",
      "utf-8"
    )
    expect(pageContent).toContain("getServerSession(authOptions)")
    expect(pageContent).toContain('redirect("/login")')
    expect(pageContent).toContain('redirect("/client-view")')
    expect(pageContent).toContain('redirect("/dashboard")')
  })
})

describe("Layouts — session?.user null safety", () => {
  it("dashboard/layout.tsx checks session?.user, not session", async () => {
    const fs = await import("fs")
    const content = fs.readFileSync(
      "d:/NewVolumeE/Accounting Business App/src/app/dashboard/layout.tsx",
      "utf-8"
    )
    expect(content).toContain("if (!session?.user)")
    expect(content).not.toContain("if (!session)")
  })

  it("client-view/layout.tsx checks session?.user, not session", async () => {
    const fs = await import("fs")
    const content = fs.readFileSync(
      "d:/NewVolumeE/Accounting Business App/src/app/(client-portal)/client-view/layout.tsx",
      "utf-8"
    )
    expect(content).toContain("if (!session?.user)")
    expect(content).not.toContain("if (!session)")
  })
})
