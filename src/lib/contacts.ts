import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, notes, type NewContact } from "@/db/schema";
import type { KeepInTouchFrequency } from "@/lib/keep-in-touch";

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listContacts(query?: string, options: { withoutFrequency?: boolean } = {}) {
  const search = query?.trim();
  return db
    .select({ id: contacts.id, name: contacts.name, howWeMet: contacts.howWeMet, phone: contacts.phone })
    .from(contacts)
    .where(
      and(
        search ? ilike(contacts.name, `%${escapeLikePattern(search)}%`) : undefined,
        options.withoutFrequency ? isNull(contacts.keepInTouchFrequency) : undefined,
      ),
    )
    .orderBy(asc(contacts.name));
}

export async function countContacts() {
  const [row] = await db.select({ total: count() }).from(contacts);
  return row.total;
}

/** Contacts with no keep-in-touch frequency: nobody reminds the user about them. */
export async function countWithoutFrequency() {
  const [row] = await db.select({ total: count() }).from(contacts).where(isNull(contacts.keepInTouchFrequency));
  return row.total;
}

/**
 * Contacts whose keep-in-touch period has passed, the longest overdue first.
 * Last contact = newest note, or the date the contact was added when there are none.
 * Everything is computed in one query, so PostgreSQL handles calendar months
 * (Jan 31 + 1 month = last day of Feb) and takes "now" from a single source.
 */
export async function listOverdueContacts() {
  const rows = await db.execute<{
    id: string;
    name: string;
    frequency: KeepInTouchFrequency;
    overdue_days: number;
  }>(sql`
    select id, name, frequency, floor(extract(epoch from (now() - due_at)) / 86400)::int as overdue_days
    from (
      select
        c.id,
        c.name,
        c.keep_in_touch_frequency as frequency,
        coalesce((select max(n.created_at) from notes n where n.contact_id = c.id), c.created_at)
          + case c.keep_in_touch_frequency
              when 'week' then interval '7 days'
              when 'month' then interval '1 month'
              when 'quarter' then interval '3 months'
              when 'year' then interval '12 months'
            end as due_at
      from contacts c
      where c.keep_in_touch_frequency is not null
    ) overdue
    where due_at < now()
    order by due_at asc, name asc
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    frequency: row.frequency,
    overdueDays: row.overdue_days,
  }));
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

/** Returns false when the contact doesn't exist (e.g. it was deleted in another tab). */
export async function setKeepInTouchFrequency(contactId: string, frequency: KeepInTouchFrequency | null) {
  const updated = await db
    .update(contacts)
    .set({ keepInTouchFrequency: frequency })
    .where(eq(contacts.id, contactId))
    .returning({ id: contacts.id });
  return updated.length > 0;
}

// One statement, so either all contacts go or none. Their notes go too: the foreign key cascades.
export async function deleteContacts(ids: string[]) {
  await db.delete(contacts).where(inArray(contacts.id, ids));
}
