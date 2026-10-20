import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

// Pill field, like the search pill on the landing
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-full border-strong border-ink bg-paper px-5 text-field text-ink transition-colors placeholder:text-ink-soft disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-signal lg:h-13",
        className
      )}
      {...props}
    />
  )
}

export { Input }
