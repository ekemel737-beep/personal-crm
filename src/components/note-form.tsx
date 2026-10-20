"use client";

import { useActionState } from "react";
import { addNoteAction, type NoteFormState } from "@/app/actions";
import { ArrowIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NoteForm({ contactId }: { contactId: string }) {
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(addNoteAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="contactId" value={contactId} />
      <Label htmlFor="note-body">Новая заметка</Label>
      <Textarea
        id="note-body"
        name="body"
        rows={3}
        placeholder="О чём поговорили, о чём договорились"
        defaultValue={state.body}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "note-body-error" : undefined}
      />
      {state.error && (
        <p id="note-body-error" className="text-meta font-medium">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-1 self-start">
        {pending ? "Сохраняю…" : "Добавить заметку"}
        <ArrowIcon />
      </Button>
    </form>
  );
}
