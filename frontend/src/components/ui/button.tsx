import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-button hover:shadow-button-hover active:shadow-button-active active:translate-y-1",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl shadow-button hover:shadow-button-hover active:shadow-button-active active:translate-y-1",
        outline:
          "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-2xl",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-2xl shadow-soft",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-2xl",
        link: "text-primary underline-offset-4 hover:underline",
        // Duolingo-style variants
        success: "bg-success text-success-foreground hover:bg-success/90 rounded-2xl shadow-button hover:shadow-button-hover active:shadow-button-active active:translate-y-1",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90 rounded-2xl shadow-button hover:shadow-button-hover active:shadow-button-active active:translate-y-1",
        fun: "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 rounded-2xl shadow-button hover:shadow-button-hover active:shadow-button-active active:translate-y-1 hover:scale-105",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-xl px-4 text-xs",
        lg: "h-14 rounded-2xl px-8 text-base",
        icon: "h-11 w-11 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
