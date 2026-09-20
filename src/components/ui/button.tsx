import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-navy text-on-navy hover:bg-navy/90",
        coral: "bg-coral text-white hover:bg-coral/90",
        outline: "border border-border-strong bg-paper text-ink hover:bg-cream",
        ghost: "text-ink-muted hover:bg-black/[0.04] hover:text-ink",
        danger: "bg-coral text-white hover:bg-coral/90",
        subtle: "bg-black/[0.04] text-ink hover:bg-black/[0.07]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        lg: "h-10 px-6 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
