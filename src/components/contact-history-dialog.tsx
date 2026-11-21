"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * The "История изменений · N" link and the window with the records (`children`, drawn on the server).
 * The window is portaled out of the page, and Next.js hides a page it leaves instead of removing it,
 * so the window remembers the address it was opened on and counts as closed on any other one.
 */
export function ContactHistoryDialog({ count, children }: { count: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);

  return (
    <Dialog open={openedOn === pathname} onOpenChange={(open) => setOpenedOn(open ? pathname : null)}>
      <DialogTrigger render={<Button variant="link" size="sm" className="self-start px-0" />}>
        История изменений · {count}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>История изменений</DialogTitle>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <DialogClose render={<Button variant="outline" size="sm" className="self-start" />}>Закрыть</DialogClose>
      </DialogContent>
    </Dialog>
  );
}
