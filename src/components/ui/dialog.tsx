"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-paper p-6 shadow-[0_24px_48px_-12px_rgba(15,30,61,0.25)] focus:outline-none",
          className
        )}
        {...props}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="font-display text-[17px] font-semibold tracking-tight text-ink">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1 text-[12.5px] text-ink-muted">
              {description}
            </DialogPrimitive.Description>
          )}
          <DialogPrimitive.Close
            className="-mr-1 -mt-1 rounded p-1 text-ink-faint hover:bg-black/[0.05] hover:text-ink cursor-pointer"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
