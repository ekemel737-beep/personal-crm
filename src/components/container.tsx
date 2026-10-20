import { cn } from "@/lib/utils";

/** Page-width wrapper with the same width and side padding as the landing. */
export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-page px-6 lg:px-20", className)} {...props} />;
}
