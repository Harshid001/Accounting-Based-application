"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, XIcon } from "lucide-react";
import { ClientSidebarNav } from "./client-sidebar-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ClientMobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden shrink-0 h-10 w-10 text-foreground" />
        }
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle navigation</span>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 isolate z-50 bg-black/40 duration-300 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden"
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-0 left-0 z-50 flex h-full w-4/5 max-w-sm flex-col bg-background shadow-2xl ring-1 ring-foreground/10 outline-none duration-300 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left md:hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-6 py-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md">
                A
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground font-heading">
                AFMS
              </span>
            </div>
            <DialogPrimitive.Close
              render={<Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" />}
            >
              <XIcon className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Nav Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1" onClick={(e) => {
            // Close the sheet when clicking a link
            if ((e.target as HTMLElement).closest('a')) {
              setOpen(false);
            }
          }}>
            <ClientSidebarNav />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
