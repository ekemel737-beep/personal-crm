"use client";

import Link from "next/link";
import { createContext, memo, useCallback, useContext, useState } from "react";
import { deleteContactsAction } from "@/app/actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Contact } from "@/db/schema";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

type DeleteMode = {
  active: boolean;
  selectedIds: ReadonlySet<string>;
  enter: () => void;
  exit: () => void;
  toggle: (id: string) => void;
};

const DeleteModeContext = createContext<DeleteMode | null>(null);

function useDeleteMode() {
  const deleteMode = useContext(DeleteModeContext);
  if (!deleteMode) throw new Error("useDeleteMode must be used inside DeleteModeProvider");
  return deleteMode;
}

/**
 * Keeps the mode and the selection. It sits above the list's Suspense boundary and
 * changing `?q=` doesn't reset page state, so the selection survives between searches.
 */
export function DeleteModeProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const enter = () => setActive(true);
  const exit = () => {
    setActive(false);
    setSelectedIds(new Set());
  };

  return (
    <DeleteModeContext.Provider value={{ active, selectedIds, enter, exit, toggle }}>
      {children}
    </DeleteModeContext.Provider>
  );
}

/** The button that turns the mode on, and then deletes what's selected. */
export function DeleteModeBar({ hasContacts }: { hasContacts: boolean }) {
  const { active, selectedIds, enter, exit } = useDeleteMode();

  if (!active) {
    if (!hasContacts) return null;
    return (
      <Button variant="outline" size="sm" className="self-start" onClick={enter}>
        Удалить контакты
      </Button>
    );
  }

  const count = selectedIds.size;
  return (
    // Stays on screen while scrolling through a long list
    <div className="sticky top-0 z-10 flex flex-wrap gap-2 bg-paper py-2">
      <ConfirmDeleteDialog
        trigger={
          <Button size="sm" disabled={count === 0}>
            {count === 0 ? "Удалить выбранные" : `Удалить выбранные: ${count}`}
          </Button>
        }
        title={`Удалить ${pluralize(count, { one: "контакт", few: "контакта", many: "контактов" })}?`}
        description={`${count === 1 ? "Контакт удалится" : "Контакты удалятся"} насовсем вместе с заметками.`}
        action={async (formData) => {
          await deleteContactsAction(formData);
          exit();
        }}
      >
        {[...selectedIds].map((id) => (
          <input key={id} type="hidden" name="contactIds" value={id} />
        ))}
      </ConfirmDeleteDialog>
      <Button variant="ghost" size="sm" onClick={exit}>
        Отмена
      </Button>
    </div>
  );
}

type ContactRowData = Pick<Contact, "id" | "name" | "howWeMet" | "phone">;

export function ContactRows({ contacts }: { contacts: ContactRowData[] }) {
  const { active, selectedIds, toggle } = useDeleteMode();

  return (
    <ul className="border-t-strong">
      {contacts.map((contact) => (
        <li key={contact.id} className="border-b">
          <ContactRow
            contact={contact}
            deleteMode={active}
            selected={selectedIds.has(contact.id)}
            onToggle={toggle}
          />
        </li>
      ))}
    </ul>
  );
}

const rowSpacing = "px-3 py-4 transition-colors hover:bg-sand lg:px-4 lg:py-5";
const rowText = "flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6";

// Memo: with a thousand rows, a click on one checkbox should redraw only that row
const ContactRow = memo(function ContactRow({
  contact,
  deleteMode,
  selected,
  onToggle,
}: {
  contact: ContactRowData;
  deleteMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const details = (
    <>
      <span className="min-w-0">
        <span className="block text-name font-semibold">{contact.name}</span>
        {contact.howWeMet && <span className="block truncate text-meta text-ink-soft">{contact.howWeMet}</span>}
      </span>
      {contact.phone && <span className="shrink-0 text-meta tabular-nums">{contact.phone}</span>}
    </>
  );

  if (!deleteMode) {
    return (
      <Link href={`/contacts/${contact.id}`} className={cn(rowSpacing, rowText, "focus-visible:-outline-offset-2")}>
        {details}
      </Link>
    );
  }

  return (
    <label className={cn(rowSpacing, "flex cursor-pointer items-center gap-3 lg:gap-4", selected && "bg-sand")}>
      <Checkbox checked={selected} onCheckedChange={() => onToggle(contact.id)} />
      <span className={cn(rowText, "min-w-0 flex-1")}>{details}</span>
    </label>
  );
});
