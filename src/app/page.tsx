import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/container";
import { ArrowIcon, SearchIcon } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listContacts } from "@/lib/contacts";
import { pluralize } from "@/lib/format";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Container className="flex flex-col gap-8 pt-10 pb-16 lg:gap-12 lg:pt-16 lg:pb-24">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="font-display text-title font-bold">Контакты</h1>
        <Link href="/contacts/new" className={buttonVariants({ variant: "signal", size: "lg" })}>
          Добавить контакт
          <ArrowIcon className="lg:size-6" />
        </Link>
      </div>
      <Suspense fallback={<p className="text-body text-ink-soft">Загружаю контакты…</p>}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function ContactList({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const contacts = await listContacts(query);

  // Desktop: the count is a caption in the left 3 columns, search and list on the right
  return (
    <div className="flex flex-col gap-6 border-t-strong pt-6 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:gap-y-8 lg:pt-8">
      <Form action="/" className="flex flex-wrap gap-2 lg:col-span-9 lg:col-start-4 lg:gap-3" role="search">
        <div className="relative min-w-0 flex-1 basis-56 lg:max-w-xl">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2" />
          <Input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Поиск по имени"
            aria-label="Поиск по имени"
            className="pl-12"
          />
        </div>
        <Button type="submit" variant="outline" className="lg:h-13">
          Найти
        </Button>
        {query && (
          <Link href="/" className={buttonVariants({ variant: "ghost", className: "lg:h-13" })}>
            Сбросить
          </Link>
        )}
      </Form>

      <p className="font-display text-label font-medium lg:col-span-3 lg:row-start-1 lg:pt-4">
        {query ? "Найдено: " : "Всего: "}
        {pluralize(contacts.length, { one: "контакт", few: "контакта", many: "контактов" })}
      </p>

      {contacts.length === 0 ? (
        <p className="bg-sand px-6 py-12 text-center text-body lg:col-span-9 lg:col-start-4">
          {query ? `Никого не нашлось по запросу «${query}».` : "Контактов пока нет. Добавьте первый."}
        </p>
      ) : (
        <ul className="border-t-strong lg:col-span-9 lg:col-start-4">
          {contacts.map((contact) => (
            <li key={contact.id} className="border-b">
              <Link
                href={`/contacts/${contact.id}`}
                className="flex flex-col gap-1 px-3 py-4 transition-colors hover:bg-sand focus-visible:-outline-offset-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 lg:px-4 lg:py-5"
              >
                <span className="min-w-0">
                  <span className="block text-name font-semibold">{contact.name}</span>
                  {contact.howWeMet && (
                    <span className="block truncate text-meta text-ink-soft">{contact.howWeMet}</span>
                  )}
                </span>
                {contact.phone && <span className="shrink-0 text-meta tabular-nums">{contact.phone}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
