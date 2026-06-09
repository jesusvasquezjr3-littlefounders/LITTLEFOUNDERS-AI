import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "strong" | "gradient"
  gradient?: "indigo" | "purple" | "blue" | "amber" | "emerald"
}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, variant = "default", gradient = "indigo", ...props }, ref) => {
    const variantClasses = {
      default: "liquid-glass",
      subtle: "liquid-glass-subtle",
      strong: "liquid-glass-strong",
      gradient: cn(
        "liquid-glass-strong bg-gradient-to-br",
        gradient === "indigo" && "from-indigo-600/10 via-purple-500/5 to-blue-600/10",
        gradient === "purple" && "from-purple-600/10 via-pink-500/5 to-rose-600/10",
        gradient === "blue" && "from-blue-600/10 via-cyan-500/5 to-teal-600/10",
        gradient === "amber" && "from-blue-600/10 via-violet-500/5 to-indigo-600/10",
        gradient === "emerald" && "from-emerald-600/10 via-green-500/5 to-teal-600/10"
      ),
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-3xl",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    )
  }
)
GlassPanel.displayName = "GlassPanel"

export { GlassPanel }
