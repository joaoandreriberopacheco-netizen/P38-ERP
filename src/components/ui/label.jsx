import React from "react"
import { cn } from "@/components/utils"

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-xs font-light leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 uppercase tracking-wider text-muted-foreground",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"

export { Label }