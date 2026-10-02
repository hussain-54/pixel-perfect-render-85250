import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
<<<<<<< HEAD
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold cursor-pointer transition-[color,background-color,border-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
=======
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-navy",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
<<<<<<< HEAD
        outline: "border border-border bg-white text-navy hover:border-royal/40 hover:bg-accent/60",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
        navy: "bg-navy text-navy-foreground hover:bg-navy-soft",
        bright: "bg-bright text-navy-foreground hover:bg-royal",
        "outline-light":
          "border border-navy-foreground/35 text-navy-foreground hover:bg-navy-foreground hover:text-navy",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 rounded-md px-3.5 text-xs",
        lg: "h-11 rounded-md px-6 text-sm",
=======
        outline: "border border-input bg-background hover:border-primary hover:text-primary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        navy: "bg-navy text-navy-foreground hover:bg-royal",
        bright: "bg-bright text-navy-foreground hover:bg-royal",
        "outline-light":
          "border border-navy-foreground/40 text-navy-foreground hover:bg-navy-foreground hover:text-navy",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-7 text-[0.95rem]",
>>>>>>> 9423b22b15d0fc187256137b3f5cacc91d5f572d
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
