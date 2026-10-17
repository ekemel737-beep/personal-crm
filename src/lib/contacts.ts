import "server-only";
import { asc, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { contacts, notes, type NewContact } from "@/db/schema";

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listContacts(query?: string) {
  const search = query?.trim();
  return db
    .select({ id: contacts.id, name: contacts.name, howWeMet: contacts.howWeMet, phone: contacts.phone })
    .from(contacts)
    .where(search ? ilike(contacts.name, `%${escapeLikePattern(search)}%`) : undefined)
    .orderBy(asc(contacts.name));
}

export async function getContact(id: string) {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return contact ?? null;
}

export async function listNotes(contactId: string) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt));
}

export async function createContact(data: NewContact) {
  const [contact] = await db.insert(contacts).values(data).returning({ id: contacts.id });
  return contact;
}

export async function createNote(contactId: string, body: string) {
  await db.insert(notes).values({ contactId, body });
}
