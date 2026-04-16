import * as React from "react"

import { cn } from "@/lib/utils"

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[10px] bg-white px-4 py-2 text-sm text-[#242424] shadow-card outline-none placeholder:text-[#a0a0a0] focus-visible:ring-2 focus-visible:ring-[#3b82f680]",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"
