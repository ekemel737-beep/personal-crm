"use client";

import { useActionState } from "react";
import { createContactAction, type ContactFormState } from "@/app/actions";
import { ArrowIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { name: "name", label: "Имя", type: "text", placeholder: "Иван Петров", required: true },
  { name: "howWeMet", label: "Откуда знакомы", type: "text", placeholder: "Работали вместе в «Ромашке»" },
  { name: "phone", label: "Телефон", type: "tel", placeholder: "+7 900 123-45-67" },
  { name: "email", label: "Почта", type: "email", placeholder: "ivan@example.com" },
] as const;

// Desktop: a sheet of rows, label in the left 3 columns and the field next to it
export function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(createContactAction, {});

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
                defaultValue={state.values?.[field.name]}
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
      <div className="pt-8 lg:col-span-6 lg:col-start-4">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Сохраняю…" : "Сохранить"}
          <ArrowIcon className="lg:size-6" />
        </Button>
      </div>
    </form>
  );
}
