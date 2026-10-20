import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Pill buttons from the landing: display font, text left, optional ArrowIcon right
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center rounded-full font-display font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper [&_[data-slot=arrow]]:text-signal",
        signal: "bg-signal text-ink",
        outline: "border-strong border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
        ghost: "text-ink hover:bg-sand",
        link: "text-ink underline underline-offset-4 decoration-(length:--border-width-strong) hover:no-underline",
      },
      size: {
        default: "h-12 justify-center gap-3 px-6 text-button",
        sm: "h-10 justify-center gap-2 px-4 text-button",
        lg: "h-14 justify-between gap-6 px-6 text-button-lg lg:h-16 lg:gap-12 lg:px-8",
        icon: "size-12 justify-center",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
