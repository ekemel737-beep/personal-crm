"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createContact, createNote, getContact } from "@/lib/contacts";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

const contactSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(200, "Имя слишком длинное"),
  howWeMet: optionalText(500, "Слишком длинный текст"),
  phone: optionalText(50, "Слишком длинный номер"),
  email: z
    .string()
    .trim()
    .max(200, "Слишком длинная почта")
    .refine((value) => value === "" || z.email().safeParse(value).success, "Неверный адрес почты")
    .transform((value) => value || null),
});

type ContactField = keyof z.input<typeof contactSchema>;

export type ContactFormState = {
  errors?: Partial<Record<ContactField, string>>;
  values?: Partial<Record<ContactField, string>>;
};

export async function createContactAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    howWeMet: String(formData.get("howWeMet") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    const errors: ContactFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField;
      errors[field] ??= issue.message;
    }
    return { errors, values };
  }

  const contact = await createContact(parsed.data);
  redirect(`/contacts/${contact.id}`);
}

const noteSchema = z.object({
  contactId: z.uuid("Контакт не найден"),
  body: z.string().trim().min(1, "Заметка пустая").max(5000, "Заметка слишком длинная"),
});

export type NoteFormState = { error?: string; body?: string };

export async function addNoteAction(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const body = String(formData.get("body") ?? "");
  const parsed = noteSchema.safeParse({ contactId: formData.get("contactId"), body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Не удалось сохранить заметку", body };
  }

  const contact = await getContact(parsed.data.contactId);
  if (!contact) return { error: "Контакт не найден", body };

  await createNote(contact.id, parsed.data.body);
  refresh();
  return {};
}
