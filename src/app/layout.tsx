import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "КЭШ — личная CRM",
  description: "Контакты людей, которых я знаю лично",
};

export const viewport: Viewport = {
  // Same as --color-paper
  themeColor: "#F1EEE7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full">
      <body className="flex min-h-full flex-col">
        {/* Same header as on the landing: logo left, tagline right */}
        <header className="mx-auto w-full max-w-page px-6 pt-5 lg:px-20 lg:pt-8">
          <div className="flex h-11 items-center justify-between lg:h-12">
            <Link href="/" className="font-display text-logo font-bold">
              КЭШ
            </Link>
            <p className="text-label font-medium">Личная CRM</p>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
