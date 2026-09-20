import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-border-strong bg-paper px-3 text-[13.5px] text-ink transition-colors placeholder:text-ink-faint focus-visible:border-coral focus-visible:outline-none disabled:opacity-50";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-9", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(field, "min-h-[76px] py-2", className)} {...props} />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, "h-9", className)} {...props} />;
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-[12.5px] font-medium text-ink-muted", className)}
      {...props}
    />
  );
}
