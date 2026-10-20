import Link from "next/link";
import { Container } from "@/components/container";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-start gap-6 pt-10 pb-16 lg:gap-8 lg:pt-16 lg:pb-24">
      <h1 className="font-display text-title font-bold">Такой страницы нет</h1>
      <p className="text-body">Возможно, контакт не существует или ссылка неверная.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        К списку контактов
      </Link>
    </Container>
  );
}
