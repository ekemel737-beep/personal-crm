"use client";

import { deleteContactAction } from "@/app/actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";

export function DeleteContactButton({ contactId, contactName }: { contactId: string; contactName: string }) {
  return (
    <ConfirmDeleteDialog
      trigger={
        <Button variant="outline" size="sm" className="self-start">
          Удалить контакт
        </Button>
      }
      title="Удалить контакт?"
      description={`Контакт «${contactName}» удалится насовсем вместе с заметками.`}
      action={deleteContactAction}
    >
      <input type="hidden" name="contactId" value={contactId} />
    </ConfirmDeleteDialog>
  );
}
