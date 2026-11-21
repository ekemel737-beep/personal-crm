import type { ContactChange } from "@/db/schema";
import { contactFieldLabels } from "@/lib/contact-fields";
import { formatDateTime } from "@/lib/format";

const EMPTY = "—";

/** The records, newest first as they come from the database. Read only. */
export function ContactHistoryList({ changes }: { changes: ContactChange[] }) {
  if (changes.length === 0) return <p className="text-body">Изменений пока не было.</p>;

  return (
    <ol className="border-t-strong">
      {changes.map((change) => (
        <li key={change.id} className="flex flex-col gap-1.5 border-b py-4">
          <time dateTime={change.changedAt.toISOString()} className="font-display text-label font-medium">
            {formatDateTime(change.changedAt)}
          </time>
          <p className="text-body wrap-break-word">
            {contactFieldLabels[change.field]}: {change.oldValue ?? EMPTY} → {change.newValue ?? EMPTY}
          </p>
        </li>
      ))}
    </ol>
  );
}
