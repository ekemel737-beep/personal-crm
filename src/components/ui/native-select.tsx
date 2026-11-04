import * as React from "react"
import { cn } from "@/lib/utils"

// Native select (the list is handier on a phone), styled like Input
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-12 w-full min-w-0 rounded-full border-strong border-ink bg-paper px-5 text-field text-ink transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-signal lg:h-13",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
