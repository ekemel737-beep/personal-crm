import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listContacts } from "@/lib/contacts";
import { pluralize } from "@/lib/format";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold">Контакты</h1>
        <Link href="/contacts/new" className={buttonVariants()}>
          Добавить контакт
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Загружаю контакты…</p>}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ContactList({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const contacts = await listContacts(query);

  return (
    <div className="space-y-4">
      <Form action="/" className="flex gap-2" role="search">
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Поиск по имени"
          aria-label="Поиск по имени"
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Найти
        </Button>
        {query && (
          <Link href="/" className={buttonVariants({ variant: "ghost" })}>
            Сбросить
          </Link>
        )}
      </Form>

      <p className="text-sm text-muted-foreground">
        {query ? "Найдено: " : "Всего: "}
        {pluralize(contacts.length, { one: "контакт", few: "контакта", many: "контактов" })}
      </p>

      {contacts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {query ? `Никого не нашлось по запросу «${query}».` : "Контактов пока нет. Добавьте первый."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <Link
                href={`/contacts/${contact.id}`}
                className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{contact.name}</span>
                  {contact.howWeMet && (
                    <span className="block truncate text-sm text-muted-foreground">{contact.howWeMet}</span>
                  )}
                </span>
                {contact.phone && (
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{contact.phone}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
