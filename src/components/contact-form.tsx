"use client";

import { useActionState } from "react";
import { createContactAction, type ContactFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { name: "name", label: "Имя", type: "text", placeholder: "Иван Петров", required: true },
  { name: "howWeMet", label: "Откуда знакомы", type: "text", placeholder: "Работали вместе в «Ромашке»" },
  { name: "phone", label: "Телефон", type: "tel", placeholder: "+7 900 123-45-67" },
  { name: "email", label: "Почта", type: "email", placeholder: "ivan@example.com" },
] as const;

export function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(createContactAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {FIELDS.map((field) => {
        const error = state.errors?.[field.name];
        const id = `contact-${field.name}`;
        return (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={id}>
              {field.label}
              {"required" in field && <span className="text-destructive">*</span>}
            </Label>
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
              <p id={`${id}-error`} className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}
      <Button type="submit" disabled={pending}>
        {pending ? "Сохраняю…" : "Сохранить"}
      </Button>
    </form>
  );
}
