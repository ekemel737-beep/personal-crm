"use client";

import Link from "next/link";
import { useState } from "react";
import { useDeleteMode } from "@/components/contact-delete-mode";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { frequencyRowLabels, type KeepInTouchFrequency } from "@/lib/keep-in-touch";

const VISIBLE_ROWS = 5;

export type OverdueContact = {
  id: string;
  name: string;
  frequency: KeepInTouchFrequency;
  overdueDays: number;
};

/** "Пора связаться": overdue contacts, the longest overdue first. Hidden in delete mode. */
export function KeepInTouchBlock({ contacts }: { contacts: OverdueContact[] }) {
  const { active: deleteMode } = useDeleteMode();
  const [showAll, setShowAll] = useState(false);

  if (deleteMode || contacts.length === 0) return null;

  const visible = showAll ? contacts : contacts.slice(0, VISIBLE_ROWS);

  return (
    <section
      aria-labelledby="keep-in-touch-title"
      className="flex flex-col gap-4 bg-sand px-4 py-6 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:px-8 lg:py-8"
    >
      <h2 id="keep-in-touch-title" className="font-display text-label font-medium lg:col-span-3">
        Пора связаться · {contacts.length}
      </h2>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-9">
        <ul aria-label="Пора связаться" className="border-t-strong">
          {visible.map((contact) => (
            <li key={contact.id} className="border-b">
              <Link
                href={`/contacts/${contact.id}`}
                className="flex flex-col gap-1 px-3 py-4 transition-colors hover:bg-paper focus-visible:-outline-offset-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 lg:px-4 lg:py-5"
              >
                <span className="min-w-0 text-name font-semibold wrap-break-word">{contact.name}</span>
                <span className="shrink-0 text-meta text-ink-soft">{describeOverdue(contact)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {!showAll && contacts.length > VISIBLE_ROWS && (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setShowAll(true)}>
            Показать всех: {contacts.length}
          </Button>
        )}
      </div>
    </section>
  );
}

function describeOverdue({ overdueDays, frequency }: OverdueContact) {
  const overdue =
    overdueDays < 1
      ? "срок истёк сегодня"
      : `просрочено на ${pluralize(overdueDays, { one: "день", few: "дня", many: "дней" })}`;
  return `${overdue} · ${frequencyRowLabels[frequency]}`;
}
