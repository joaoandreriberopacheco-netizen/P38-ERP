import React from "react"
import { cn } from "@/components/utils"

const buttonVariants = ({ variant = "default", size = "default", className = "" } = {}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 border border-primary/70 dark:border-transparent",
    destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-400",
    outline: "border border-border bg-background hover:bg-accent text-foreground font-medium",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    link: "text-primary underline-offset-4 hover:underline font-medium",
  };

  const sizes = {
    default: "h-10 px-4 py-2 tablet-landscape:h-11 tablet-landscape:px-5 tablet-landscape:text-base",
    sm: "h-9 rounded-md px-3 tablet-landscape:h-10 tablet-landscape:px-4 tablet-landscape:text-base",
    lg: "h-11 rounded-md px-8 tablet-landscape:h-12 tablet-landscape:px-9 tablet-landscape:text-base",
    icon: "h-10 w-10 tablet-landscape:h-11 tablet-landscape:w-11",
  };

  return cn(baseStyles, variants[variant], sizes[size], className);
}

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = "button"
  return (
    <Comp
      className={buttonVariants({ variant, size, className })}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }