// No "server-only" and no database imports: used by the schema, the server and client components.
// The order is the order of the form fields; the history is sorted by it too.

export const contactFields = ["name", "howWeMet", "phone", "email"] as const;

export type ContactField = (typeof contactFields)[number];

export const contactFieldLabels: Record<ContactField, string> = {
  name: "Имя",
  howWeMet: "Откуда знакомы",
  phone: "Телефон",
  email: "Почта",
};
