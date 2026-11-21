import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ContactRows, DeleteModeBar, DeleteModeProvider } from "@/components/contact-delete-mode";
import { Container } from "@/components/container";
import { ArrowIcon, SearchIcon } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { KeepInTouchBlock } from "@/components/keep-in-touch-block";
import { ListPager } from "@/components/list-pager";
import { Input } from "@/components/ui/input";
import { countContacts, listContacts, listOverdueContacts } from "@/lib/contacts";
import { pluralize } from "@/lib/format";
import { buildListHref, DEFAULT_PAGE_SIZE, pageSizes, parsePage, parsePageSize } from "@/lib/list-params";

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
      <DeleteModeProvider>
        <Suspense fallback={<p className="text-body text-ink-soft">Загружаю контакты…</p>}>
          <ContactList searchParams={searchParams} />
        </Suspense>
      </DeleteModeProvider>
    </Container>
  );
}

async function ContactList({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection();
  const { q, nofreq, page: pageParam, size: sizeParam } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const size = parsePageSize(sizeParam);

  // "Могут быть забытыми" is about the plain list: a search shows neither the count nor the filter
  const [total, withoutFrequency] = query
    ? [null, null]
    : await Promise.all([countContacts(), countContacts(undefined, { withoutFrequency: true })]);
  // With nobody left without a frequency, an old ?nofreq=1 link shows the whole list, not an empty one
  const filtered = !query && nofreq === "1" && (withoutFrequency ?? 0) > 0;

  // How many contacts the list has now, to cut it into pages; a page past the last one becomes the last one
  const matching = query ? await countContacts(query) : filtered ? (withoutFrequency ?? 0) : (total ?? 0);
  const pages = Math.max(1, Math.ceil(matching / size));
  const page = Math.min(parsePage(pageParam), pages);

  // The "Пора связаться" block belongs to the first page of the plain list: no search, no filter, no block
  const [contacts, overdue] = await Promise.all([
    listContacts(query, { withoutFrequency: filtered, limit: size, offset: (page - 1) * size }),
    query || filtered || page > 1 ? [] : listOverdueContacts(),
  ]);

  return (
    <>
      <KeepInTouchBlock contacts={overdue} />
      <ContactListBody
        query={query}
        contacts={contacts}
        count={query ? matching : (total ?? 0)}
        withoutFrequency={withoutFrequency}
        filtered={filtered}
        page={page}
        pages={pages}
        size={size}
        showPager={matching > Math.min(...pageSizes)}
      />
    </>
  );
}

function ContactListBody({
  query,
  contacts,
  count,
  withoutFrequency,
  filtered,
  page,
  pages,
  size,
  showPager,
}: {
  query: string;
  /** This page. */
  contacts: Awaited<ReturnType<typeof listContacts>>;
  /** "Найдено" for a search, otherwise "Всего": all the contacts, not just this page. */
  count: number;
  withoutFrequency: number | null;
  filtered: boolean;
  page: number;
  pages: number;
  size: number;
  showPager: boolean;
}) {
  const location = { q: query, nofreq: filtered };

  return (
    <div className="flex flex-col gap-6 border-t-strong pt-6 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:gap-y-8 lg:pt-8">
      <Form action="/" className="flex flex-wrap gap-2 lg:col-span-9 lg:col-start-4 lg:gap-3" role="search">
        {/* A new search starts from the first page, but keeps the page size */}
        {size !== DEFAULT_PAGE_SIZE && <input type="hidden" name="size" value={size} />}
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
        {(query || filtered) && (
          <Link href={buildListHref({ size })} className={buttonVariants({ variant: "ghost", className: "lg:h-13" })}>
            Сбросить
          </Link>
        )}
      </Form>

      {/* Desktop: the counts are a caption in the left 3 columns, search and list on the right */}
      <div className="flex flex-col gap-2 font-display text-label font-medium lg:col-span-3 lg:row-start-1 lg:pt-4">
        <p>
          {query ? "Найдено: " : "Всего: "}
          {pluralize(count, { one: "контакт", few: "контакта", many: "контактов" })}
        </p>
        {withoutFrequency === 0 && <p>Никто не будет забыт</p>}
        {withoutFrequency !== null && withoutFrequency > 0 && (
          <Link
            href={buildListHref({ nofreq: !filtered, size })}
            aria-current={filtered ? "true" : undefined}
            className="self-start underline underline-offset-4 decoration-(length:--border-width-strong) aria-[current=true]:bg-ink aria-[current=true]:px-2 aria-[current=true]:text-paper aria-[current=true]:no-underline"
          >
            Могут быть забытыми: {withoutFrequency}
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:col-span-9 lg:col-start-4">
        <DeleteModeBar hasContacts={contacts.length > 0} />
        {showPager && <ListPager label="Страницы сверху" location={location} page={page} pages={pages} size={size} />}
        {contacts.length === 0 ? (
          <p className="bg-sand px-6 py-12 text-center text-body">
            {query ? `Никого не нашлось по запросу «${query}».` : "Контактов пока нет. Добавьте первый."}
          </p>
        ) : (
          <ContactRows contacts={contacts} />
        )}
        {showPager && <ListPager label="Страницы снизу" location={location} page={page} pages={pages} size={size} />}
      </div>
    </div>
  );
}
