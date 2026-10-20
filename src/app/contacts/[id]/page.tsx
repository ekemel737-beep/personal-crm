import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { Container } from "@/components/container";
import { NoteForm } from "@/components/note-form";
import { getContact, listNotes } from "@/lib/contacts";
import { formatDateTime, pluralize } from "@/lib/format";

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <>
      <Container className="flex flex-col pt-10 lg:pt-16">
        <BackLink />
      </Container>
      <Suspense
        fallback={
          <Container className="pt-6">
            <p className="text-body text-ink-soft">Загружаю карточку…</p>
          </Container>
        }
      >
        <ContactDetails params={params} />
      </Suspense>
    </>
  );
}

async function ContactDetails({ params }: Pick<PageProps<"/contacts/[id]">, "params">) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [contact, notes] = await Promise.all([getContact(id), listNotes(id)]);
  if (!contact) notFound();

  return (
    <>
      <Container className="flex flex-col gap-8 pt-4 pb-14 lg:gap-12 lg:pt-6 lg:pb-20">
        <h1 className="font-display text-title font-bold wrap-break-word hyphens-auto">{contact.name}</h1>
        <dl className="border-t-strong lg:grid lg:grid-cols-12 lg:gap-x-8">
          <Field label="Откуда знакомы">{contact.howWeMet}</Field>
          <Field label="Телефон">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="underline-offset-4 hover:underline">
                {contact.phone}
              </a>
            )}
          </Field>
          <Field label="Почта">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="break-all underline-offset-4 hover:underline">
                {contact.email}
              </a>
            )}
          </Field>
        </dl>
      </Container>

      {/* Notes sit on a sand band, like the "Знакомо?" block on the landing */}
      <section aria-labelledby="notes-title" className="flex-1 bg-sand">
        <Container className="flex flex-col gap-8 pt-14 pb-16 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:pt-20 lg:pb-24">
          <h2 id="notes-title" className="font-display text-label font-medium lg:col-span-3">
            Заметки · {pluralize(notes.length, { one: "запись", few: "записи", many: "записей" })}
          </h2>
          <div className="flex flex-col gap-10 lg:col-span-6 lg:gap-12">
            <NoteForm contactId={contact.id} />
            {notes.length === 0 ? (
              <p className="text-body">Заметок пока нет.</p>
            ) : (
              <ol className="border-t-strong">
                {notes.map((note) => (
                  <li key={note.id} className="flex flex-col gap-2 border-b py-5 lg:py-6">
                    <time dateTime={note.createdAt.toISOString()} className="font-display text-label font-medium">
                      {formatDateTime(note.createdAt)}
                    </time>
                    <p className="text-body whitespace-pre-wrap">{note.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}

// One row of the details sheet: caption in the left 3 columns on desktop, value next to it
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-b py-4 lg:col-span-12 lg:grid lg:grid-cols-subgrid lg:items-baseline lg:py-5">
      <dt className="font-display text-label font-medium lg:col-span-3">{label}</dt>
      <dd className="text-body lg:col-span-9">{children || <span className="text-ink-soft">—</span>}</dd>
    </div>
  );
}
