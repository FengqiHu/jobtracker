import * as React from "react"

import { cn } from "@/lib/utils"

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[120px] w-full rounded-[12px] bg-white px-4 py-3 text-sm text-[#242424] shadow-card outline-none placeholder:text-[#a0a0a0] focus-visible:ring-2 focus-visible:ring-[#3b82f680]",
      className
    )}
    {...props}
  />
))
Textarea.displayName = "Textarea"
