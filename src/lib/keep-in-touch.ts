// No "server-only": used by both the server (card, actions, schema) and client components.
// Keep it free of imports, so the database code doesn't end up in the browser bundle.

export const keepInTouchFrequencies = ["week", "month", "quarter", "year"] as const;

export type KeepInTouchFrequency = (typeof keepInTouchFrequencies)[number];

/** Labels for the select on the contact card. */
export const frequencyOptionLabels: Record<KeepInTouchFrequency, string> = {
  week: "Раз в неделю",
  month: "Раз в месяц",
  quarter: "Раз в квартал",
  year: "Раз в год",
};

export const noFrequencyLabel = "Не задано";

/** Lower-case labels for the overdue block rows. */
export const frequencyRowLabels: Record<KeepInTouchFrequency, string> = {
  week: "раз в неделю",
  month: "раз в месяц",
  quarter: "раз в квартал",
  year: "раз в год",
};
