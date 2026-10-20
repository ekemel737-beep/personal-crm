import Link from "next/link";

export function BackLink() {
  return (
    <Link
      href="/"
      className="self-start font-display text-label font-medium underline-offset-4 decoration-(length:--border-width-strong) hover:underline"
    >
      ← Все контакты
    </Link>
  );
}
