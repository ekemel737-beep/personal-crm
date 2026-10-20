import { cn } from "@/lib/utils";

// The same icons as on the landing, so buttons and search look identical.

/** Arrow for buttons; inside a button it nudges right on hover. */
export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      data-slot="arrow"
      className={cn(
        "size-5 shrink-0 motion-safe:transition-transform motion-safe:group-hover/button:translate-x-1",
        className,
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-4 shrink-0 lg:size-4.5", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}
