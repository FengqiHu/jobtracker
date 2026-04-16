import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-[0.08em] uppercase",
  {
    variants: {
      variant: {
        default: "bg-[#f3f3f3] text-[#242424]",
        applied: "bg-[#f1f1f1] text-[#242424]",
        interviewing: "bg-[#e9eef9] text-[#1e3a8a]",
        offer: "bg-[#ebf8ef] text-[#166534]",
        rejected: "bg-[#efefef] text-[#656565]",
        withdrawn: "bg-[#f4f4f4] text-[#7a7a7a]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
