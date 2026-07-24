"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { ChevronDown, LogOut, Settings, UserCircle } from "lucide-react";

/**
 * Account button for the dashboard header.
 * Drop this in wherever the static "ADMIN" text currently lives, e.g.:
 *
 *   <div className="flex items-center justify-between">
 *     <h1>Dashboard</h1>
 *     <AccountMenu />
 *   </div>
 */
export default function AccountMenu() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const name = session?.user?.name ?? "Account";
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const image = session?.user?.image ?? null;
  const initial = name.charAt(0).toUpperCase();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-neutral-800 pl-1.5 pr-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 active:scale-95"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold uppercase overflow-hidden">
          {image ? (
            <Image src={image} alt={name} fill sizes="24px" className="object-cover" />
          ) : (
            initial
          )}
        </span>
        <span className="hidden sm:inline">{name}</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl"
        >
          <div className="border-b border-neutral-800 px-4 py-3">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            {session?.user?.email && (
              <p className="truncate text-xs text-neutral-400">{session.user.email}</p>
            )}
          </div>

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/account");
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-200 hover:bg-neutral-800"
          >
            <UserCircle size={16} />
            Manage account
          </button>

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/account?tab=settings");
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-200 hover:bg-neutral-800"
          >
            <Settings size={16} />
            Settings
          </button>

          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 border-t border-neutral-800 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-neutral-800"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
