import { z } from "zod";
import type { ContactField } from "@/lib/contact-fields";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

/** Checks for the contact form, shared by adding and editing a contact. */
export const contactSchema = z.object({
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

export type ContactFormState = {
  errors?: Partial<Record<ContactField, string>>;
  values?: Partial<Record<ContactField, string>>;
  /** A problem with the whole form, e.g. the contact no longer exists. */
  error?: string;
};

/** Reads the form fields and checks them: either the clean data or the state to show back. */
export function parseContactForm(
  formData: FormData,
): { data: z.output<typeof contactSchema> } | { state: ContactFormState } {
  const values = {
    name: String(formData.get("name") ?? ""),
    howWeMet: String(formData.get("howWeMet") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  const parsed = contactSchema.safeParse(values);
  if (parsed.success) return { data: parsed.data };

  const errors: NonNullable<ContactFormState["errors"]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ContactField;
    errors[field] ??= issue.message;
  }
  return { state: { errors, values } };
}
