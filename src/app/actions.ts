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
  updateContact,
} from "@/lib/contacts";
import { contactFields } from "@/lib/contact-fields";
import { parseContactForm, type ContactFormState } from "@/lib/contact-schema";
import { keepInTouchFrequencies } from "@/lib/keep-in-touch";

export async function createContactAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = parseContactForm(formData);
  if ("state" in parsed) return parsed.state;

  const contact = await createContact(parsed.data);
  redirect(`/contacts/${contact.id}`);
}

export async function updateContactAction(
  contactId: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = parseContactForm(formData);
  if ("state" in parsed) return parsed.state;

  const result = z.uuid().safeParse(contactId).success ? await updateContact(contactId, parsed.data) : "not_found";
  if (result === "not_found") {
    // Keep what was typed: the form stays open
    const values = Object.fromEntries(contactFields.map((field) => [field, String(formData.get(field) ?? "")]));
    return { error: "Контакт не найден", values };
  }

  // The name and the phone are also shown on the home page
  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  // Replace, so the browser's back button doesn't lead to the form with the old values
  redirect(`/contacts/${contactId}`, RedirectType.replace);
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
