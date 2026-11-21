import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contactFields } from "../lib/contact-fields";
import { keepInTouchFrequencies } from "../lib/keep-in-touch";

export const keepInTouchFrequency = pgEnum("keep_in_touch_frequency", keepInTouchFrequencies);

export const contactField = pgEnum("contact_field", contactFields);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    // NULL means "not set": such a contact is never overdue
    keepInTouchFrequency: keepInTouchFrequency("keep_in_touch_frequency"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contacts_name_idx").on(table.name)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notes_contact_id_idx").on(table.contactId, table.createdAt)],
);

// One row per changed field of one save; rows of one save share changed_at. Gone with the contact.
export const contactChanges = pgTable(
  "contact_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    field: contactField("field").notNull(),
    // NULL means the field was empty
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contact_changes_contact_id_idx").on(table.contactId, table.changedAt)],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type ContactChange = typeof contactChanges.$inferSelect;
