"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ContactFormState } from "@/lib/contact-schema";
import type { ContactField } from "@/lib/contact-fields";
import { ArrowIcon } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { name: "name", label: "Имя", type: "text", placeholder: "Иван Петров", required: true },
  { name: "howWeMet", label: "Откуда знакомы", type: "text", placeholder: "Работали вместе в «Ромашке»" },
  { name: "phone", label: "Телефон", type: "tel", placeholder: "+7 900 123-45-67" },
  { name: "email", label: "Почта", type: "email", placeholder: "ivan@example.com" },
] as const;

type ContactFormProps = {
  action: (prev: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  /** Current values when editing; the new-contact form starts empty. */
  initialValues?: Partial<Record<ContactField, string>>;
  submitLabel?: string;
  /** Where "Отмена" leads; no cancel link when omitted. */
  cancelHref?: string;
};

// Desktop: a sheet of rows, label in the left 3 columns and the field next to it
export function ContactForm({ action, initialValues, submitLabel = "Сохранить", cancelHref }: ContactFormProps) {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col border-t-strong lg:grid lg:grid-cols-12 lg:gap-x-8" noValidate>
      {FIELDS.map((field) => {
        const error = state.errors?.[field.name];
        const id = `contact-${field.name}`;
        return (
          <div
            key={field.name}
            className="flex flex-col gap-2.5 border-b py-5 lg:col-span-12 lg:grid lg:grid-cols-subgrid lg:items-center lg:py-6"
          >
            <Label htmlFor={id} className="lg:col-span-3">
              {field.label}
              {"required" in field && <span>*</span>}
            </Label>
            <div className="flex flex-col gap-2 lg:col-span-6">
              <Input
                id={id}
                name={field.name}
                type={field.type}
                placeholder={field.placeholder}
                defaultValue={state.values?.[field.name] ?? initialValues?.[field.name]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                autoFocus={field.name === "name"}
              />
              {error && (
                <p id={`${id}-error`} className="px-5 text-meta font-medium">
                  {error}
                </p>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex flex-col gap-4 pt-8 lg:col-span-6 lg:col-start-4">
        {state.error && (
          <p role="alert" className="text-meta font-medium">
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Сохраняю…" : submitLabel}
            <ArrowIcon className="lg:size-6" />
          </Button>
          {cancelHref && (
            <Link href={cancelHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>
              Отмена
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
