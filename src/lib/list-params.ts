// No "server-only": used by the home page (server) and the pager.

export const pageSizes = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

type RawParam = string | string[] | undefined;

/** Page size from the address; anything but one of the allowed numbers means the default. */
export function parsePageSize(value: RawParam): number {
  const size = typeof value === "string" ? Number(value) : NaN;
  return pageSizes.find((allowed) => allowed === size) ?? DEFAULT_PAGE_SIZE;
}

/** Page number from the address; anything but a whole number from 1 means the first page. */
export function parsePage(value: RawParam): number {
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

export type ListLocation = {
  q?: string;
  /** The "Могут быть забытыми" filter. */
  nofreq?: boolean;
  page?: number;
  size?: number;
};

/** Address of the list; the defaults (first page, 25 per page) are left out. */
export function buildListHref({ q, nofreq, page, size }: ListLocation): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (nofreq) params.set("nofreq", "1");
  if (page && page > 1) params.set("page", String(page));
  if (size && size !== DEFAULT_PAGE_SIZE) params.set("size", String(size));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

/**
 * Page numbers to show: the first, the last, the current one and `neighbours` pages around it
 * ("gap" stands for the rest). A narrow screen asks for no neighbours.
 */
export function pageNumbers(current: number, total: number, neighbours = 1): (number | "gap")[] {
  const around = Array.from({ length: neighbours * 2 + 1 }, (_, index) => current - neighbours + index);
  const shown = [...new Set([1, ...around, total])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  return shown.flatMap((page, index) => (index > 0 && page - shown[index - 1] > 1 ? ["gap" as const, page] : [page]));
}
