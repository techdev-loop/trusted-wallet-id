import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 will-change-transform",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-primary/92 hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px] active:scale-[0.985] active:translate-y-0",
        destructive: "bg-destructive text-destructive-foreground shadow-[var(--shadow-sm)] hover:bg-destructive/90",
        outline: "border border-input/80 bg-background/92 text-foreground shadow-[var(--shadow-xs)] hover:bg-muted/70 hover:border-border hover:shadow-[var(--shadow-sm)] active:scale-[0.985]",
        secondary: "bg-secondary text-secondary-foreground shadow-[var(--shadow-xs)] hover:bg-secondary/80 hover:-translate-y-[1px]",
        ghost: "text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:-translate-y-[1px]",
        link: "text-accent underline-offset-4 hover:underline",
        accent: "gradient-accent text-accent-foreground shadow-[var(--shadow-accent)] hover:shadow-[var(--shadow-lg)] hover:brightness-110 hover:-translate-y-[1px] active:scale-[0.985] active:translate-y-0",
        "hero-outline": "border border-primary-foreground/25 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/18 backdrop-blur-sm active:scale-[0.985]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
