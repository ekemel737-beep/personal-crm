"use client";

import { useState, useTransition } from "react";
import { setKeepInTouchFrequencyAction } from "@/app/actions";
import { NativeSelect } from "@/components/ui/native-select";
import {
  frequencyOptionLabels,
  keepInTouchFrequencies,
  noFrequencyLabel,
  type KeepInTouchFrequency,
} from "@/lib/keep-in-touch";

const label = "Как часто общаться";

/** Saves the choice right away. The value is kept in state: a form action would reset the select to its old value. */
export function KeepInTouchSelect({
  contactId,
  initialValue,
}: {
  contactId: string;
  initialValue: KeepInTouchFrequency | null;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    setValue(next);
    setError(undefined);
    startTransition(async () => {
      const result = await setKeepInTouchFrequencyAction(contactId, next);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 lg:max-w-xs">
      <NativeSelect
        aria-label={label}
        value={value}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "keep-in-touch-error" : undefined}
        onChange={(event) => handleChange(event.target.value)}
      >
        <option value="">{noFrequencyLabel}</option>
        {keepInTouchFrequencies.map((frequency) => (
          <option key={frequency} value={frequency}>
            {frequencyOptionLabels[frequency]}
          </option>
        ))}
      </NativeSelect>
      {error && (
        <p id="keep-in-touch-error" role="alert" className="text-meta font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
