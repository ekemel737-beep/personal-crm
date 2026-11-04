"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import {
  createContact,
  createNote,
  deleteContacts,
  getContact,
  setKeepInTouchFrequency,
} from "@/lib/contacts";
import { keepInTouchFrequencies } from "@/lib/keep-in-touch";

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
  // A note restarts the keep-in-touch countdown, so the home page changes too
  revalidatePath("/");
  refresh();
  return {};
}

const frequencySchema = z.object({
  contactId: z.uuid("Контакт не найден"),
  frequency: z.union([z.enum(keepInTouchFrequencies), z.literal("")]),
});

export type FrequencyState = { error?: string };

export async function setKeepInTouchFrequencyAction(contactId: string, frequency: string): Promise<FrequencyState> {
  const parsed = frequencySchema.safeParse({ contactId, frequency });
  if (!parsed.success) return { error: "Не удалось сохранить частоту" };

  const found = await setKeepInTouchFrequency(parsed.data.contactId, parsed.data.frequency || null);
  if (!found) return { error: "Контакт не найден" };

  revalidatePath("/");
  return {};
}

export async function deleteContactAction(formData: FormData) {
  const parsed = z.uuid().safeParse(formData.get("contactId"));
  if (parsed.success) {
    await deleteContacts([parsed.data]);
    revalidatePath("/");
  }
  // Replace, so the browser's back button doesn't lead to the deleted card.
  redirect("/", RedirectType.replace);
}

export async function deleteContactsAction(formData: FormData) {
  const parsed = z.array(z.uuid()).min(1).safeParse(formData.getAll("contactIds"));
  if (!parsed.success) return;

  await deleteContacts(parsed.data);
  revalidatePath("/");
}
