import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <h1 className="font-heading text-2xl font-semibold">Такой страницы нет</h1>
      <p className="text-muted-foreground">Возможно, контакт не существует или ссылка неверная.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        К списку контактов
      </Link>
    </div>
  );
}
