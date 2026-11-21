import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactChanges, contacts, notes, type NewContact } from "@/db/schema";
import { contactFields } from "@/lib/contact-fields";
import type { KeepInTouchFrequency } from "@/lib/keep-in-touch";

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

type ContactFilter = { withoutFrequency?: boolean };

function contactsWhere(query: string | undefined, { withoutFrequency }: ContactFilter) {
  const search = query?.trim();
  return and(
    search ? ilike(contacts.name, `%${escapeLikePattern(search)}%`) : undefined,
    withoutFrequency ? isNull(contacts.keepInTouchFrequency) : undefined,
  );
}

/** One page of the list by name. `limit` and `offset` are left out to get everything. */
export async function listContacts(
  query?: string,
  options: ContactFilter & { limit?: number; offset?: number } = {},
) {
  const rows = db
    .select({ id: contacts.id, name: contacts.name, howWeMet: contacts.howWeMet, phone: contacts.phone })
    .from(contacts)
    .where(contactsWhere(query, options))
    // The id breaks ties between equal names: without it the same name could repeat or vanish between pages
    .orderBy(asc(contacts.name), asc(contacts.id));
  if (options.limit === undefined) return rows;
  return rows.limit(options.limit).offset(options.offset ?? 0);
}

/** How many contacts match: the same conditions as `listContacts`, without the page. */
export async function countContacts(query?: string, options: ContactFilter = {}) {
  const [row] = await db.select({ total: count() }).from(contacts).where(contactsWhere(query, options));
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

export async function listContactChanges(contactId: string) {
  return db
    .select()
    .from(contactChanges)
    .where(eq(contactChanges.contactId, contactId))
    // Rows of one save share the time; within it they follow the order of the form fields (enum order)
    .orderBy(desc(contactChanges.changedAt), asc(contactChanges.field));
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

type ContactValues = Pick<NewContact, "name" | "howWeMet" | "phone" | "email">;

/**
 * Saves the edited fields and writes one history row per changed field, in one transaction.
 * The row is locked while we compare, so two saves at once go one after another and the
 * second one records what the first one left as the old value.
 */
export async function updateContact(
  id: string,
  values: ContactValues,
): Promise<"ok" | "unchanged" | "not_found"> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(contacts).where(eq(contacts.id, id)).for("update");
    if (!current) return "not_found";

    // Empty and missing are the same thing; values are already trimmed by the form check
    const changes = contactFields.flatMap((field) => {
      const oldValue = current[field] || null;
      const newValue = values[field] || null;
      return oldValue === newValue ? [] : [{ contactId: id, field, oldValue, newValue }];
    });
    if (changes.length === 0) return "unchanged";

    // clock_timestamp() after the lock, not now(): now() is the start of the transaction, and a save
    // that started earlier but waited for the lock would get an earlier time than the one before it
    // Kept as text and cast back in the database: a JS Date would cut the microseconds
    const [{ changedAt }] = await tx.execute<{ changedAt: string }>(sql`select clock_timestamp()::text as "changedAt"`);
    await tx.update(contacts).set(values).where(eq(contacts.id, id));
    await tx.insert(contactChanges).values(changes.map((change) => ({ ...change, changedAt: sql`${changedAt}::timestamptz` })));
    return "ok";
  });
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
