"use client";

import { useActionState, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDeleteDialog({
  trigger,
  title,
  description,
  action,
  children,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  action: (formData: FormData) => Promise<void>;
  /** Hidden inputs with what to delete. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [, formAction, pending] = useActionState<null, FormData>(async (_prev, formData) => {
    try {
      await action(formData);
    } finally {
      // Close explicitly, also when the action redirects: Next.js hides the page
      // instead of unmounting it, and the dialog is portaled outside of that page.
      setOpen(false);
    }
    return null;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <form action={formAction}>
          {children}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <Button type="submit" disabled={pending}>
              {pending ? "Удаляю…" : "Удалить"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
