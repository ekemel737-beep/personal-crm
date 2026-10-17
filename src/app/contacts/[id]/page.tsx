import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { NoteForm } from "@/components/note-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContact, listNotes } from "@/lib/contacts";
import { formatDateTime, pluralize } from "@/lib/format";

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <div className="space-y-4">
      <Link href="/" className="inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Все контакты
      </Link>
      <Suspense fallback={<p className="text-muted-foreground">Загружаю карточку…</p>}>
        <ContactDetails params={params} />
      </Suspense>
    </div>
  );
}

async function ContactDetails({ params }: Pick<PageProps<"/contacts/[id]">, "params">) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [contact, notes] = await Promise.all([getContact(id), listNotes(id)]);
  if (!contact) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">{contact.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
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
                <a href={`mailto:${contact.email}`} className="underline-offset-4 hover:underline">
                  {contact.email}
                </a>
              )}
            </Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Заметки{" "}
            <span className="font-normal text-muted-foreground">
              · {pluralize(notes.length, { one: "запись", few: "записи", many: "записей" })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <NoteForm contactId={contact.id} />
          {notes.length === 0 ? (
            <p className="text-muted-foreground">Заметок пока нет.</p>
          ) : (
            <ol className="space-y-4">
              {notes.map((note) => (
                <li key={note.id} className="border-l-2 pl-4">
                  <time dateTime={note.createdAt.toISOString()} className="text-xs text-muted-foreground">
                    {formatDateTime(note.createdAt)}
                  </time>
                  <p className="whitespace-pre-wrap">{note.body}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>{children || <span className="text-muted-foreground">—</span>}</dd>
    </>
  );
}
