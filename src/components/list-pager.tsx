import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { buildListHref, pageNumbers, pageSizes, type ListLocation } from "@/lib/list-params";
import { cn } from "@/lib/utils";

/**
 * "Страница N из M", back and forward, page numbers and the page size.
 * Plain links, so it works without JavaScript and the browser's Back button just works.
 */
export function ListPager({
  label,
  location,
  page,
  pages,
  size,
}: {
  /** Tells the two copies (above and under the list) apart for screen readers. */
  label: string;
  /** What the list shows now: search, filter. The page and the size are set per link. */
  location: Pick<ListLocation, "q" | "nofreq">;
  page: number;
  pages: number;
  size: number;
}) {
  const href = (target: { page?: number; size?: number }) =>
    buildListHref({ ...location, page: target.page, size: target.size ?? size });

  return (
    <nav aria-label={label} className="flex flex-col gap-3 py-2">
      {/* Narrow screen: the label on its own line, then arrows and numbers in one row that never wraps */}
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <p className="mr-2 font-display text-label font-medium">
          Страница {page} из {pages}
        </p>
        <div className="flex items-center justify-between gap-1 lg:justify-start lg:gap-2">
          <PagerStep direction="back" href={page > 1 ? href({ page: page - 1 }) : null} />
          {/* Two lists, one for each width: the narrow one has no neighbours of the current page */}
          <PageNumbers className="lg:hidden" entries={pageNumbers(page, pages, 0)} page={page} href={href} />
          <PageNumbers className="max-lg:hidden" entries={pageNumbers(page, pages)} page={page} href={href} />
          <PagerStep direction="forward" href={page < pages ? href({ page: page + 1 }) : null} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-display text-label font-medium">
        <span>На странице:</span>
        {pageSizes.map((option) => (
          <Link
            key={option}
            // A new size starts from the first page
            href={href({ size: option })}
            aria-current={option === size ? "true" : undefined}
            className="underline underline-offset-4 decoration-(length:--border-width-strong) aria-[current=true]:bg-ink aria-[current=true]:px-2 aria-[current=true]:text-paper aria-[current=true]:no-underline"
          >
            {option}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function PageNumbers({
  entries,
  page,
  href,
  className,
}: {
  entries: (number | "gap")[];
  page: number;
  href: (target: { page?: number }) => string;
  className: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 lg:gap-2", className)}>
      {entries.map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1 font-display text-label">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={href({ page: entry })}
            aria-current={entry === page ? "page" : undefined}
            aria-label={`Страница ${entry}`}
            className={cn(
              buttonVariants({ variant: entry === page ? "default" : "ghost", size: "sm" }),
              "min-w-10 px-3",
            )}
          >
            {entry}
          </Link>
        ),
      )}
    </div>
  );
}

/**
 * "Назад" / "Вперёд": a link, or a dimmed label when there is nowhere to go.
 * An arrow on a narrow screen and the word on a wide one; the word stays as the name for screen readers.
 */
function PagerStep({ direction, href }: { direction: "back" | "forward"; href: string | null }) {
  const className = cn(buttonVariants({ variant: "outline", size: "sm" }), "px-3 lg:px-4");
  const Arrow = direction === "back" ? ArrowLeftIcon : ArrowRightIcon;
  const content = (
    <>
      <Arrow aria-hidden="true" className="size-5 lg:hidden" strokeWidth={2.2} />
      <span className="max-lg:sr-only">{direction === "back" ? "Назад" : "Вперёд"}</span>
    </>
  );

  if (href === null) {
    return (
      <span aria-disabled="true" className={cn(className, "pointer-events-none opacity-50")}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
