import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { updateContactAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { Container } from "@/components/container";
import { ContactForm } from "@/components/contact-form";
import { getContact } from "@/lib/contacts";

export default function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  return (
    <Container className="flex flex-col gap-8 pt-10 pb-16 lg:gap-12 lg:pt-16 lg:pb-24">
      <div className="flex flex-col gap-4 lg:gap-6">
        <BackLink />
        <h1 className="font-display text-title font-bold">Редактирование контакта</h1>
      </div>
      <Suspense fallback={<p className="text-body text-ink-soft">Загружаю форму…</p>}>
        <EditForm params={params} />
      </Suspense>
    </Container>
  );
}

async function EditForm({ params }: Pick<PageProps<"/contacts/[id]/edit">, "params">) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const contact = await getContact(id);
  if (!contact) notFound();

  const initialValues = {
    name: contact.name,
    howWeMet: contact.howWeMet ?? "",
    phone: contact.phone ?? "",
    email: contact.email ?? "",
  };

  return (
    <ContactForm
      // A new key when the stored values change: a page that was hidden by Activity shows them, not old input
      key={JSON.stringify(initialValues)}
      action={updateContactAction.bind(null, id)}
      initialValues={initialValues}
      cancelHref={`/contacts/${id}`}
    />
  );
}
