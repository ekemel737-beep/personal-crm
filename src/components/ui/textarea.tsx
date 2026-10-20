import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-28 w-full border-strong border-ink bg-paper px-5 py-4 text-field text-ink transition-colors placeholder:text-ink-soft disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-signal",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
