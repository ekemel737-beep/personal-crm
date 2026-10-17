const pluralRules = new Intl.PluralRules("ru-RU");

/** Picks the Russian word form for a number: one / few / many. */
export function pluralize(count: number, forms: { one: string; few: string; many: string }) {
  const rule = pluralRules.select(count);
  const word = rule === "one" ? forms.one : rule === "few" ? forms.few : forms.many;
  return `${count} ${word}`;
}

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}
