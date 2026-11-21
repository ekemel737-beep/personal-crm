// Checks the success criteria from specs/01-продуктовая-идея.md in a real browser.
import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const createdNames: string[] = [];
const createdPrefixes: string[] = [];

// The list shows a page at a time: 25 contacts unless the address says otherwise.
const PAGE_SIZE = 25;
const onPage = (count: number) => Math.min(count, PAGE_SIZE);

// Remove only the contacts this test created, so repeated runs don't pile up test data.
test.afterAll(async () => {
  if (createdNames.length === 0 && createdPrefixes.length === 0) return;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  if (createdNames.length > 0) await sql`delete from contacts where name in ${sql(createdNames)}`;
  // Series of contacts made for the pages tests are removed by their common beginning
  for (const prefix of createdPrefixes) await sql`delete from contacts where name like ${prefix + "%"}`;
  await sql.end();
});

test("list, add, find, append a note, see it from another browser", async ({ page, browser, baseURL }) => {
  const stamp = Date.now();
  const name = `Проверкин Тест ${stamp}`;
  const note = `Договорились созвониться в пятницу (${stamp})`;
  createdNames.push(name);

  // Opened the app: the full contact list is visible.
  await page.goto("/");
  const total = page.getByText(/^Всего: \d+/);
  await expect(total).toBeVisible();
  const totalCount = Number((await total.textContent())?.match(/\d+/)?.[0]);
  await expect(page.getByRole("list", { name: "Все контакты" }).getByRole("listitem")).toHaveCount(onPage(totalCount));

  // Added a contact: it opens in its card and shows up in the list.
  await page.getByRole("link", { name: "Добавить контакт" }).click();
  await page.getByLabel("Имя").fill(name);
  await page.getByLabel("Откуда знакомы").fill("Автотест");
  await page.getByLabel("Телефон").fill("+7 900 000-00-00");
  await page.getByLabel("Почта").fill("test@example.com");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByText("test@example.com")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("list", { name: "Все контакты" }).getByRole("listitem")).toHaveCount(onPage(totalCount + 1));

  // Found the contact by name and opened the card.
  await page.getByLabel("Поиск по имени").fill(name.toLowerCase());
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByRole("list", { name: "Все контакты" }).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);

  // Appended a note: it shows up right away and survives a reload.
  await page.getByLabel("Новая заметка").fill(note);
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText(note)).toBeVisible();
  await expect(page.getByLabel("Новая заметка")).toHaveValue("");
  const cardUrl = page.url();
  await page.reload();
  await expect(page.getByText(note)).toBeVisible();

  // Same address in another browser (fresh context, nothing shared): same data.
  const otherBrowser = await browser.newContext();
  const otherPage = await otherBrowser.newPage();
  await otherPage.goto(cardUrl);
  await expect(otherPage.getByText(name)).toBeVisible();
  await expect(otherPage.getByText(note)).toBeVisible();
  await otherPage.goto(`${baseURL}/?q=${encodeURIComponent(name)}`);
  await expect(otherPage.getByRole("list", { name: "Все контакты" }).getByRole("listitem")).toHaveCount(1);
  await otherBrowser.close();
});

test("contact without a name is not saved", async ({ page }) => {
  await page.goto("/contacts/new");
  await page.getByLabel("Телефон").fill("+7 900 111-11-11");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Введите имя")).toBeVisible();
  await expect(page).toHaveURL(/\/contacts\/new$/);
  await expect(page.getByLabel("Телефон")).toHaveValue("+7 900 111-11-11");
});

async function addContact(page: Page, name: string) {
  createdNames.push(name);
  await page.goto("/contacts/new");
  await page.getByLabel("Имя").fill(name);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);
}

async function readTotal(page: Page) {
  const total = page.getByText(/^Всего: \d+/);
  await expect(total).toBeVisible();
  return Number((await total.textContent())?.match(/\d+/)?.[0]);
}

async function countInDb(contactId: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [row] = await sql`
    select
      (select count(*) from contacts where id = ${contactId})::int as contacts,
      (select count(*) from notes where contact_id = ${contactId})::int as notes
  `;
  await sql.end();
  return { contacts: row.contacts, notes: row.notes };
}

async function search(page: Page, name: string) {
  await page.getByLabel("Поиск по имени").fill(name);
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByText(/^Найдено: 1 контакт$/)).toBeVisible();
}

test("delete a contact from its card", async ({ page, browser }) => {
  const stamp = Date.now();
  const name = `Удалялкин Карточка ${stamp}`;
  await addContact(page, name);
  const cardUrl = page.url();
  const contactId = cardUrl.split("/").pop()!;
  await page.getByLabel("Новая заметка").fill("Заметка, которая исчезнет");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText("Заметка, которая исчезнет")).toBeVisible();
  expect(await countInDb(contactId)).toEqual({ contacts: 1, notes: 1 });

  // Reach the card by clicking, so the browser and the router remember the list and the card.
  await page.goto("/");
  const total = await readTotal(page);
  await search(page, name);
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(cardUrl);

  // Cancel and Esc change nothing.
  const dialog = page.getByRole("alertdialog");
  const deleteButton = page.getByRole("button", { name: "Удалить контакт" });
  await deleteButton.click();
  await expect(dialog.getByRole("heading", { name: "Удалить контакт?" })).toBeVisible();
  await expect(dialog.getByText(name)).toBeVisible();
  // An accidental Enter must not delete anything.
  await expect(dialog.getByRole("button", { name: "Отмена" })).toBeFocused();
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toHaveCount(0);
  await deleteButton.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await countInDb(contactId)).toEqual({ contacts: 1, notes: 1 });

  // Confirm: the list opens without the contact, and the dialog doesn't follow.
  await deleteButton.click();
  await dialog.getByRole("button", { name: "Удалить" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(dialog).toHaveCount(0);
  expect(await readTotal(page)).toBe(total - 1);
  await expect(page.getByRole("list", { name: "Все контакты" }).getByRole("listitem")).toHaveCount(onPage(total - 1));
  await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
  expect(await countInDb(contactId)).toEqual({ contacts: 0, notes: 0 });

  // Back doesn't show the deleted card.
  await page.goBack();
  await expect(page.getByText(`Никого не нашлось по запросу «${name}».`)).toBeVisible();
  await expect(page.getByRole("heading", { name })).toHaveCount(0);

  // The old address is gone, in this browser and in another one.
  await page.goto(cardUrl);
  await expect(page.getByRole("heading", { name: "Такой страницы нет" })).toBeVisible();
  const otherBrowser = await browser.newContext();
  const otherPage = await otherBrowser.newPage();
  await otherPage.goto(cardUrl);
  await expect(otherPage.getByRole("heading", { name: "Такой страницы нет" })).toBeVisible();
  await otherBrowser.close();
});

test("delete several contacts from the list", async ({ page }) => {
  const stamp = Date.now();
  const first = `Удалялкин Первый ${stamp}`;
  const second = `Удалялкин Второй ${stamp}`;
  const kept = `Удалялкин Остаётся ${stamp}`;
  for (const name of [first, second, kept]) await addContact(page, name);

  await page.goto("/");
  const total = await readTotal(page);
  const enterButton = page.getByRole("button", { name: "Удалить контакты" });
  const deleteSelected = page.getByRole("button", { name: /^Удалить выбранные/ });
  const leaveButton = page.getByRole("button", { name: "Отмена" });
  const checkboxes = page.getByRole("checkbox");
  const dialog = page.getByRole("alertdialog");

  // Normal mode: no checkboxes. Delete mode: one per row, and nothing to delete yet.
  await expect(checkboxes).toHaveCount(0);
  await enterButton.click();
  await expect(checkboxes).toHaveCount(onPage(total));
  await expect(deleteSelected).toBeDisabled();
  await expect(deleteSelected).toHaveText("Удалить выбранные");

  // Pressing a row toggles it and doesn't open the card.
  await search(page, first);
  const url = page.url();
  await page.getByText(first).click();
  await expect(page.getByRole("checkbox", { name: first })).toBeChecked();
  await expect(deleteSelected).toHaveText("Удалить выбранные: 1");
  await expect(page).toHaveURL(url);
  await page.getByText(first).click();
  await expect(page.getByRole("checkbox", { name: first })).not.toBeChecked();
  await expect(deleteSelected).toBeDisabled();
  await page.getByText(first).click();

  // The selection survives a new search and a reset.
  await search(page, second);
  await expect(deleteSelected).toHaveText("Удалить выбранные: 1");
  await page.getByText(second).click();
  await expect(deleteSelected).toHaveText("Удалить выбранные: 2");
  await search(page, first);
  await expect(page.getByRole("checkbox", { name: first })).toBeChecked();
  await page.getByRole("link", { name: "Сбросить" }).click();
  await expect(checkboxes).toHaveCount(onPage(total));
  await expect(deleteSelected).toHaveText("Удалить выбранные: 2");
  // These three are not on the first page, so look at them one by one through the search
  await search(page, first);
  await expect(page.getByRole("checkbox", { name: first })).toBeChecked();
  await search(page, second);
  await expect(page.getByRole("checkbox", { name: second })).toBeChecked();
  await search(page, kept);
  await expect(page.getByRole("checkbox", { name: kept })).not.toBeChecked();

  // The dialog shows only the number; canceling it keeps the mode and the selection.
  await deleteSelected.click();
  await expect(dialog.getByRole("heading", { name: "Удалить 2 контакта?" })).toBeVisible();
  await expect(dialog.getByText(first)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(deleteSelected).toHaveText("Удалить выбранные: 2");

  // Confirm with both selected contacts off screen: they go, and the same search is back to normal.
  await search(page, kept);
  await deleteSelected.click();
  await dialog.getByRole("button", { name: "Удалить" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(checkboxes).toHaveCount(0);
  await expect(enterButton).toBeVisible();
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByRole("link", { name: new RegExp(kept) })).toBeVisible();
  // The contact that stays is somewhere in the list: open its page
  await page.goto(`/?page=${await pageOfName(kept)}`);
  expect(await readTotal(page)).toBe(total - 2);
  await expect(page.getByRole("link", { name: new RegExp(first) })).toHaveCount(0);
  await expect(page.getByRole("link", { name: new RegExp(second) })).toHaveCount(0);
  await expect(page.getByRole("link", { name: new RegExp(kept) })).toBeVisible();

  // Leaving the mode clears the selection and deletes nothing.
  await enterButton.click();
  await page.getByText(kept).click();
  await expect(deleteSelected).toHaveText("Удалить выбранные: 1");
  await leaveButton.click();
  await expect(checkboxes).toHaveCount(0);
  await expect(page.getByRole("link", { name: new RegExp(kept) })).toBeVisible();
  await enterButton.click();
  await expect(page.getByRole("checkbox", { name: kept })).not.toBeChecked();
  await expect(deleteSelected).toBeDisabled();
});

// --- Keep in touch ---

type Frequency = "week" | "month" | "quarter" | "year";

/** The page of the list a contact is on, found the way the list is ordered: by name in the database. */
async function pageOfName(name: string, options: { withoutFrequency?: boolean } = {}) {
  const before = await withDb(async (sql) => {
    const [row] = options.withoutFrequency
      ? await sql`select count(*)::int as n from contacts where name < ${name} and keep_in_touch_frequency is null`
      : await sql`select count(*)::int as n from contacts where name < ${name}`;
    return row.n as number;
  });
  return Math.floor(before / PAGE_SIZE) + 1;
}

async function withDb<T>(run: (sql: postgres.Sql) => Promise<T>) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

/** Inserts a contact straight into the database, with a creation date `createdAgo` in the past (a PostgreSQL interval). */
async function insertContact(name: string, options: { frequency?: Frequency; createdAgo?: string } = {}) {
  createdNames.push(name);
  return withDb(async (sql) => {
    const [row] = await sql`
      insert into contacts (name, keep_in_touch_frequency, created_at)
      values (${name}, ${options.frequency ?? null}, now() - ${options.createdAgo ?? "0 seconds"}::interval)
      returning id
    `;
    return row.id as string;
  });
}

async function insertNote(contactId: string, createdAgo: string) {
  await withDb(
    (sql) => sql`
      insert into notes (contact_id, body, created_at)
      values (${contactId}, 'Тестовая заметка', now() - ${createdAgo}::interval)
    `,
  );
}

async function setFrequencyInDb(contactId: string, frequency: Frequency | null) {
  await withDb((sql) => sql`update contacts set keep_in_touch_frequency = ${frequency} where id = ${contactId}`);
}

async function readFrequencyFromDb(contactId: string) {
  return withDb(async (sql) => {
    const [row] = await sql`select keep_in_touch_frequency as frequency from contacts where id = ${contactId}`;
    return (row?.frequency ?? null) as Frequency | null;
  });
}

const blockTitle = (page: Page) => page.getByRole("heading", { name: /^Пора связаться/ });
const blockList = (page: Page) => page.getByRole("list", { name: "Пора связаться" });
const blockRows = (page: Page) => blockList(page).getByRole("listitem");
const fullList = (page: Page) => page.getByRole("list", { name: "Все контакты" });
const showAllButton = (page: Page) => page.getByRole("button", { name: /^Показать всех/ });

/** Opens the home page and returns the number from the block's title (0 when there is no block). */
async function openHome(page: Page) {
  await page.goto("/");
  await readTotal(page);
  if ((await blockTitle(page).count()) === 0) return 0;
  return Number((await blockTitle(page).textContent())?.match(/\d+/)?.[0]);
}

/** Expands the block if needed and says which of the given contacts it lists. */
async function listedInBlock(page: Page, names: string[]) {
  if ((await showAllButton(page).count()) > 0) await showAllButton(page).click();
  const listed: string[] = [];
  for (const name of names) {
    if ((await blockList(page).getByText(name).count()) > 0) listed.push(name);
  }
  return listed;
}

test("keep-in-touch frequency: default, saved, cleared, deleted contact", async ({ page, browser }) => {
  const name = `Частотин Выбор ${Date.now()}`;
  await addContact(page, name);
  const cardUrl = page.url();
  const contactId = cardUrl.split("/").pop()!;
  const select = page.getByLabel("Как часто общаться");

  // Nothing chosen by default.
  await expect(select).toHaveValue("");
  await expect(select.locator("option")).toHaveText([
    "Не задано",
    "Раз в неделю",
    "Раз в месяц",
    "Раз в квартал",
    "Раз в год",
  ]);

  // The choice is saved at once, with no button, and survives a reload and another browser.
  await select.selectOption({ label: "Раз в месяц" });
  await expect.poll(() => readFrequencyFromDb(contactId)).toBe("month");
  await page.reload();
  await expect(select).toHaveValue("month");
  const otherBrowser = await browser.newContext();
  const otherPage = await otherBrowser.newPage();
  await otherPage.goto(cardUrl);
  await expect(otherPage.getByLabel("Как часто общаться")).toHaveValue("month");
  await otherBrowser.close();

  // It can be cleared.
  await select.selectOption({ label: "Не задано" });
  await expect.poll(() => readFrequencyFromDb(contactId)).toBeNull();
  await page.reload();
  await expect(select).toHaveValue("");

  // The contact was deleted in another tab: a message appears next to the select.
  await withDb((sql) => sql`delete from contacts where id = ${contactId}`);
  await select.selectOption({ label: "Раз в неделю" });
  await expect(page.getByText("Контакт не найден")).toBeVisible();
});

test("no overdue contacts: no block", async ({ page }) => {
  const someoneHasFrequency = await withDb(
    async (sql) => (await sql`select 1 from contacts where keep_in_touch_frequency is not null limit 1`).length > 0,
  );
  test.skip(someoneHasFrequency, "The database already has contacts with a frequency, so the block may be legitimately shown");

  await openHome(page);
  await expect(blockTitle(page)).toHaveCount(0);
  await expect(blockList(page)).toHaveCount(0);
});

test("overdue rules", async ({ page }) => {
  const stamp = Date.now();
  const olderNote = `Правилов Старая заметка ${stamp}`;
  const newerNote = `Правилов Свежая заметка ${stamp}`;
  const oldNoNotes = `Правилов Давний без заметок ${stamp}`;
  const newNoNotes = `Правилов Новый без заметок ${stamp}`;
  const noFrequency = `Правилов Без частоты ${stamp}`;
  const switched = `Правилов Смена частоты ${stamp}`;

  const olderNoteId = await insertContact(olderNote, { frequency: "month", createdAgo: "1 year" });
  await insertNote(olderNoteId, "40 days");
  const newerNoteId = await insertContact(newerNote, { frequency: "month", createdAgo: "1 year" });
  await insertNote(newerNoteId, "100 days");
  await insertNote(newerNoteId, "10 days");
  await insertContact(oldNoNotes, { frequency: "month", createdAgo: "6 months" });
  await insertContact(newNoNotes, { frequency: "month" });
  const noFrequencyId = await insertContact(noFrequency, { createdAgo: "5 years" });
  await insertNote(noFrequencyId, "4 years");
  const switchedId = await insertContact(switched, { frequency: "month", createdAgo: "1 year" });
  await insertNote(switchedId, "10 days");

  const all = [olderNote, newerNote, oldNoNotes, newNoNotes, noFrequency, switched];
  await openHome(page);
  expect(await listedInBlock(page, all)).toEqual([olderNote, oldNoNotes]);

  // Switching the frequency doesn't count as contact: the same 10-day-old note is now past a week.
  await setFrequencyInDb(switchedId, "week");
  await openHome(page);
  expect(await listedInBlock(page, all)).toEqual([olderNote, oldNoNotes, switched]);

  // PostgreSQL does the month arithmetic: Jan 31 + 1 month is the end of February, not March.
  const endOfFebruary = await withDb(async (sql) => {
    const [row] = await sql`select to_char('2027-01-31'::timestamptz + interval '1 month', 'YYYY-MM-DD') as day`;
    return row.day;
  });
  expect(endOfFebruary).toBe("2027-02-28");
});

test("a note restarts the countdown; row text and link", async ({ page }) => {
  const stamp = Date.now();
  const noted = `Заметкин Просроченный ${stamp}`;
  const twelve = `Заметкин Двенадцать ${stamp}`;
  const today = `Заметкин Сегодня ${stamp}`;

  const notedId = await insertContact(noted, { frequency: "week", createdAgo: "30 days" });
  await insertContact(twelve, { frequency: "week", createdAgo: "19 days 1 hour" });
  await insertContact(today, { frequency: "week", createdAgo: "7 days 1 hour" });

  // Row text: how long overdue and the frequency; less than a day is "today".
  await openHome(page);
  if ((await showAllButton(page).count()) > 0) await showAllButton(page).click();
  await expect(blockRows(page).filter({ hasText: twelve })).toContainText("просрочено на 12 дней · раз в неделю");
  await expect(blockRows(page).filter({ hasText: today })).toContainText("срок истёк сегодня · раз в неделю");

  // The row opens the card.
  await blockList(page).getByRole("link", { name: new RegExp(noted) }).click();
  await expect(page).toHaveURL(`/contacts/${notedId}`);
  await expect(page.getByRole("heading", { name: noted })).toBeVisible();

  // A note, then back by the link: the contact is gone from the block, with no page reload.
  await page.getByLabel("Новая заметка").fill("Созвонились");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText("Созвонились")).toBeVisible();
  await page.getByRole("link", { name: "← Все контакты" }).click();
  await expect(page).toHaveURL(/\/$/);
  await readTotal(page);
  expect(await listedInBlock(page, [noted])).toEqual([]);

  // Same with the browser's Back button: overdue again, open it from the block, add a note, go back.
  await withDb((sql) => sql`update notes set created_at = now() - interval '30 days' where contact_id = ${notedId}`);
  await openHome(page);
  if ((await showAllButton(page).count()) > 0) await showAllButton(page).click();
  await blockList(page).getByRole("link", { name: new RegExp(noted) }).click();
  await expect(page).toHaveURL(`/contacts/${notedId}`);
  await page.getByLabel("Новая заметка").fill("Ещё одна");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText("Ещё одна")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  expect(await listedInBlock(page, [noted])).toEqual([]);

  // The period passes again: the contact returns.
  await withDb((sql) => sql`update notes set created_at = now() - interval '8 days' where contact_id = ${notedId}`);
  await openHome(page);
  expect(await listedInBlock(page, [noted])).toEqual([noted]);
});

test("block: order, count, five rows, hiding, deleting", async ({ page }) => {
  const stamp = Date.now();
  const names = Array.from({ length: 6 }, (_, i) => `Просрочкин ${i} ${stamp}`);

  const baseline = await openHome(page);
  const totalBefore = await readTotal(page);

  // Six very old contacts; the higher the index, the longer overdue, whatever the frequency.
  // week: created = due - 7 days; year: created = due - 1 year. Steps of 10 days absorb leap-year wobble.
  for (const [i, name] of names.entries()) {
    const days = i * 10 + 10;
    const frequency: Frequency = i % 2 === 0 ? "week" : "year";
    await insertContact(name, {
      frequency,
      createdAgo: frequency === "week" ? `20 years ${days + 7} days` : `21 years ${days} days`,
    });
  }

  await page.goto("/");
  expect(await readTotal(page)).toBe(totalBefore + 6);
  await expect(blockTitle(page)).toHaveText(`Пора связаться · ${baseline + 6}`);

  // Five rows and a button; the button expands the rest in the same order.
  await expect(blockRows(page)).toHaveCount(5);
  await expect(showAllButton(page)).toHaveText(`Показать всех: ${baseline + 6}`);
  await showAllButton(page).click();
  await expect(blockRows(page)).toHaveCount(baseline + 6);
  await expect(showAllButton(page)).toHaveCount(0);
  const rows = await blockRows(page).allTextContents();
  const ownOrder = rows.map((text) => names.findIndex((name) => text.includes(name))).filter((i) => i >= 0);
  expect(ownOrder).toEqual([5, 4, 3, 2, 1, 0]);

  // Still in the full list (on its own page), and counted in "Всего".
  await page.goto(`/?page=${await pageOfName(names[0])}`);
  await expect(fullList(page).getByRole("link", { name: new RegExp(names[0]) })).toBeVisible();

  // Search hides the block, reset brings it back.
  await search(page, names[0]);
  await expect(blockTitle(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Сбросить" }).click();
  await expect(blockTitle(page)).toBeVisible();

  // Delete mode hides it, leaving the mode brings it back.
  await page.getByRole("button", { name: "Удалить контакты" }).click();
  await expect(blockTitle(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Отмена" }).click();
  await expect(blockTitle(page)).toBeVisible();

  // A deleted contact leaves the block without a reload.
  await blockRows(page).filter({ hasText: names[5] }).getByRole("link").click();
  await page.getByRole("button", { name: "Удалить контакт" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(blockTitle(page)).toHaveText(`Пора связаться · ${baseline + 5}`);
  await expect(blockList(page).getByText(names[5])).toHaveCount(0);

  // Five rows or fewer: no button.
  if (baseline === 0) {
    await expect(blockRows(page)).toHaveCount(5);
    await expect(showAllButton(page)).toHaveCount(0);
  }
});

// --- "Могут быть забытыми" ---

const forgottenLink = (page: Page) => page.getByRole("link", { name: /^Могут быть забытыми: \d+$/ });

async function readForgotten(page: Page) {
  await expect(forgottenLink(page)).toBeVisible();
  return Number((await forgottenLink(page).textContent())?.match(/\d+/)?.[0]);
}

test("could be forgotten: two counts, filter, search, delete", async ({ page }) => {
  const stamp = Date.now();
  const plain = `Забытов Без частоты ${stamp}`;
  const withFrequency = `Забытов С частотой ${stamp}`;
  const overdue = `Забытов Просрочен ${stamp}`;
  const plainId = await insertContact(plain);
  const withFrequencyId = await insertContact(withFrequency);
  await insertContact(overdue, { frequency: "week", createdAgo: "30 years" });

  // Two numbers side by side: all contacts, and those without a frequency.
  await page.goto("/");
  const total = await readTotal(page);
  const forgotten = await readForgotten(page);
  expect(forgotten).toBeGreaterThanOrEqual(2);
  await expect(blockTitle(page)).toBeVisible();

  // Choosing a frequency on the card moves the contact out of the count; the total stays.
  await page.goto(`/contacts/${withFrequencyId}`);
  await page.getByLabel("Как часто общаться").selectOption({ label: "Раз в месяц" });
  await expect.poll(() => readFrequencyFromDb(withFrequencyId)).toBe("month");
  await page.goto("/");
  expect(await readTotal(page)).toBe(total);
  expect(await readForgotten(page)).toBe(forgotten - 1);

  // Clearing it brings the contact back into the count.
  await setFrequencyInDb(withFrequencyId, null);
  await openHome(page);
  expect(await readForgotten(page)).toBe(forgotten);

  // The filter: only contacts without a frequency, the total is unchanged, no block, "Сбросить" is shown.
  await forgottenLink(page).click();
  await expect(page).toHaveURL(/\/\?nofreq=1$/);
  await expect(fullList(page).getByRole("listitem")).toHaveCount(onPage(forgotten));
  await expect(fullList(page).getByRole("link", { name: new RegExp(overdue) })).toHaveCount(0);
  expect(await readTotal(page)).toBe(total);
  await expect(forgottenLink(page)).toHaveAttribute("aria-current", "true");
  await expect(blockTitle(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Сбросить" })).toBeVisible();

  // Reset and the browser's Back button both bring the whole list and the block back.
  await page.getByRole("link", { name: "Сбросить" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(fullList(page).getByRole("listitem")).toHaveCount(onPage(total));
  await expect(blockTitle(page)).toBeVisible();
  await forgottenLink(page).click();
  await expect(page).toHaveURL(/\?nofreq=1$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(fullList(page).getByRole("listitem")).toHaveCount(onPage(total));

  // Our contact without a frequency is in the filtered list, on its own page.
  await page.goto(`/?nofreq=1&page=${await pageOfName(plain, { withoutFrequency: true })}`);
  await expect(fullList(page).getByRole("link", { name: new RegExp(plain) })).toBeVisible();
  await page.goto("/");
  await readTotal(page);

  // A search drops the filter and shows neither the count nor the filter.
  await forgottenLink(page).click();
  await expect(page).toHaveURL(/\?nofreq=1$/);
  await page.getByLabel("Поиск по имени").fill(plain);
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page).toHaveURL(/\?q=/);
  await expect(page).not.toHaveURL(/nofreq/);
  await expect(page.getByText(/^Найдено: 1 контакт$/)).toBeVisible();
  await expect(forgottenLink(page)).toHaveCount(0);
  await expect(page.getByText("Никто не будет забыт")).toHaveCount(0);

  // Delete mode works on the filtered list; the count goes down by one.
  await page.goto(`/?nofreq=1&page=${await pageOfName(plain, { withoutFrequency: true })}`);
  await readTotal(page);
  const rowsOnPage = await fullList(page).getByRole("listitem").count();
  await page.getByRole("button", { name: "Удалить контакты" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(rowsOnPage);
  await page.getByText(plain).click();
  await page.getByRole("button", { name: "Удалить выбранные: 1" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(forgottenLink(page)).toHaveText(`Могут быть забытыми: ${forgotten - 1}`);
  expect(await countInDb(plainId)).toEqual({ contacts: 0, notes: 0 });
});

test("everyone has a frequency: nobody will be forgotten", async ({ page }) => {
  const someoneWithout = await withDb(
    async (sql) => (await sql`select 1 from contacts where keep_in_touch_frequency is null limit 1`).length > 0,
  );
  test.skip(someoneWithout, "The database has contacts without a frequency, so this can't be checked without changing them");

  await page.goto("/");
  await expect(page.getByText("Никто не будет забыт")).toBeVisible();
  await expect(forgottenLink(page)).toHaveCount(0);
  // An old filter link shows the whole list, not an empty one.
  await page.goto("/?nofreq=1");
  await expect(page.getByText("Никто не будет забыт")).toBeVisible();
});

// --- Contact edit and history ---

type ContactFieldValues = { name?: string; howWeMet?: string; phone?: string; email?: string };

const fieldLabels = { name: "Имя", howWeMet: "Откуда знакомы", phone: "Телефон", email: "Почта" } as const;

/** Inserts a contact with the given fields straight into the database. */
async function insertFullContact(name: string, fields: { howWeMet?: string; phone?: string; email?: string } = {}) {
  const id = await insertContact(name);
  await withDb(
    (sql) => sql`
      update contacts
      set how_we_met = ${fields.howWeMet ?? null}, phone = ${fields.phone ?? null}, email = ${fields.email ?? null}
      where id = ${id}
    `,
  );
  return id;
}

async function readChanges(contactId: string) {
  return withDb(
    (sql) => sql`
      select field, old_value as "oldValue", new_value as "newValue", changed_at as "changedAt"
      from contact_changes
      where contact_id = ${contactId}
      order by changed_at, field
    `,
  );
}

async function readContactFromDb(contactId: string) {
  return withDb(async (sql) => {
    const [row] = await sql`
      select name, how_we_met as "howWeMet", phone, email, keep_in_touch_frequency as frequency
      from contacts where id = ${contactId}
    `;
    return row;
  });
}

async function fillEditForm(page: Page, fields: ContactFieldValues) {
  for (const [field, value] of Object.entries(fields) as [keyof ContactFieldValues, string][]) {
    await page.getByLabel(fieldLabels[field]).fill(value);
  }
}

/** Opens the edit form of the contact, fills the fields and saves; ends on the card. */
async function saveEdit(page: Page, contactId: string, fields: ContactFieldValues) {
  await page.goto(`/contacts/${contactId}/edit`);
  await fillEditForm(page, fields);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(`/contacts/${contactId}`);
}

const cardValue = (page: Page, label: string) =>
  page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd");
const historyLink = (page: Page) => page.getByRole("button", { name: /^История изменений · \d+$/ });
const historyDialog = (page: Page) => page.getByRole("dialog", { name: "История изменений" });

test("edit a contact: form, saving, checks, cancel, deleted contact", async ({ page, browser }) => {
  const stamp = Date.now();
  const oldName = `Правкин Старый ${stamp}`;
  const newName = `Правкин Новый ${stamp}`;
  const id = await insertFullContact(oldName, { howWeMet: "Автотест", phone: "+7 900 111-11-11", email: "a@example.com" });
  createdNames.push(newName);
  await setFrequencyInDb(id, "month");
  await insertNote(id, "1 day");

  // The button opens the form with the current values.
  await page.goto(`/contacts/${id}`);
  await page.getByRole("link", { name: "Редактировать" }).click();
  await expect(page).toHaveURL(`/contacts/${id}/edit`);
  await expect(page.getByRole("heading", { name: "Редактирование контакта" })).toBeVisible();
  await expect(page.getByLabel("Имя")).toHaveValue(oldName);
  await expect(page.getByLabel("Откуда знакомы")).toHaveValue("Автотест");
  await expect(page.getByLabel("Телефон")).toHaveValue("+7 900 111-11-11");
  await expect(page.getByLabel("Почта")).toHaveValue("a@example.com");

  // Saving: the card shows the new values, also after a reload and in another browser.
  await fillEditForm(page, { name: newName, phone: "+7 911 222-22-22" });
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(`/contacts/${id}`);
  await expect(page.getByRole("heading", { name: newName })).toBeVisible();
  await expect(cardValue(page, "Телефон")).toHaveText("+7 911 222-22-22");
  await page.reload();
  await expect(cardValue(page, "Телефон")).toHaveText("+7 911 222-22-22");
  const otherBrowser = await browser.newContext();
  const otherPage = await otherBrowser.newPage();
  await otherPage.goto(`/contacts/${id}`);
  await expect(otherPage.getByRole("heading", { name: newName })).toBeVisible();
  await otherBrowser.close();

  // The frequency and the notes stay as they were.
  await expect(page.getByLabel("Как часто общаться")).toHaveValue("month");
  expect((await readContactFromDb(id)).frequency).toBe("month");
  expect((await countInDb(id)).notes).toBe(1);

  // The list shows the new name and not the old one.
  await page.goto(`/?q=${encodeURIComponent(newName)}`);
  await expect(fullList(page).getByRole("link", { name: new RegExp(newName) })).toBeVisible();
  await page.goto(`/?q=${encodeURIComponent(oldName)}`);
  await expect(page.getByText(`Никого не нашлось по запросу «${oldName}».`)).toBeVisible();

  // Clearing an optional field: a dash in the card.
  await saveEdit(page, id, { phone: "" });
  await expect(cardValue(page, "Телефон")).toHaveText("—");

  // Checks: nothing is saved, the form stays open with what was typed.
  await page.goto(`/contacts/${id}/edit`);
  await page.getByLabel("Имя").fill("");
  await page.getByLabel("Откуда знакомы").fill("Ввели и не сохранили");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Введите имя")).toBeVisible();
  await expect(page).toHaveURL(`/contacts/${id}/edit`);
  await expect(page.getByLabel("Откуда знакомы")).toHaveValue("Ввели и не сохранили");
  await fillEditForm(page, { name: newName, email: "не адрес" });
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Неверный адрес почты")).toBeVisible();
  expect(await readContactFromDb(id)).toMatchObject({ name: newName, howWeMet: "Автотест", email: "a@example.com" });
  expect((await readChanges(id)).length).toBe(3);

  // Cancel: back to the card, nothing changed.
  await fillEditForm(page, { email: "a@example.com", howWeMet: "Ещё одно" });
  await page.getByRole("link", { name: "Отмена" }).click();
  await expect(page).toHaveURL(`/contacts/${id}`);
  await expect(cardValue(page, "Откуда знакомы")).toHaveText("Автотест");
  expect((await readChanges(id)).length).toBe(3);

  // The contact was deleted in another tab: a message, the form stays open.
  await page.goto(`/contacts/${id}/edit`);
  await withDb((sql) => sql`delete from contacts where id = ${id}`);
  await page.getByLabel("Имя").fill(`${newName} 2`);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Контакт не найден")).toBeVisible();
  await expect(page).toHaveURL(`/contacts/${id}/edit`);
  await expect(page.getByLabel("Имя")).toHaveValue(`${newName} 2`);
});

test("history is recorded only for what changed", async ({ page }) => {
  const stamp = Date.now();
  const name = `Историков Запись ${stamp}`;
  createdNames.push(`${name} 2`);
  const id = await insertFullContact(name, { phone: "+7 900 111-11-11", email: "h@example.com" });

  // One field: one record with the old and the new value.
  await saveEdit(page, id, { phone: "+7 911 222-22-22" });
  expect(await readChanges(id)).toMatchObject([{ field: "phone", oldValue: "+7 900 111-11-11", newValue: "+7 911 222-22-22" }]);

  // Several fields in one save: one record each, with one time.
  await saveEdit(page, id, { name: `${name} 2`, email: "h2@example.com" });
  createdNames.push(`${name} 2`);
  const afterTwo = await readChanges(id);
  expect(afterTwo.map((row) => row.field)).toEqual(["phone", "name", "email"]);
  expect(afterTwo[1].changedAt.getTime()).toBe(afterTwo[2].changedAt.getTime());

  // Saved as it was, with spaces around, or an empty field left empty: nothing is written.
  await saveEdit(page, id, {});
  await saveEdit(page, id, { phone: "  +7 911 222-22-22  ", howWeMet: "   " });
  expect((await readChanges(id)).length).toBe(3);

  // The field was empty: the old value of the record is empty.
  await saveEdit(page, id, { howWeMet: "Познакомились на автотесте" });
  const last = (await readChanges(id)).at(-1)!;
  expect(last).toMatchObject({ field: "howWeMet", oldValue: null, newValue: "Познакомились на автотесте" });

  // A new contact has no history; the frequency and notes don't write to it.
  const created = `Историков Новый ${stamp}`;
  await addContact(page, created);
  const newId = page.url().split("/").pop()!;
  expect(await readChanges(newId)).toEqual([]);
  await page.getByLabel("Как часто общаться").selectOption({ label: "Раз в неделю" });
  await expect.poll(() => readFrequencyFromDb(newId)).toBe("week");
  await page.getByLabel("Новая заметка").fill("Просто заметка");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText("Просто заметка")).toBeVisible();
  expect(await readChanges(newId)).toEqual([]);
});

test("history link and window", async ({ page, browser }) => {
  const stamp = Date.now();
  const name = `Историков Окно ${stamp}`;
  const id = await insertFullContact(name, { phone: "+7 900 111-11-11" });

  // No edits yet: the link stays, the window says so.
  await page.goto("/");
  await page.getByLabel("Поиск по имени").fill(name);
  await page.getByRole("button", { name: "Найти" }).click();
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(`/contacts/${id}`);
  await expect(historyLink(page)).toHaveText("История изменений · 0");
  await historyLink(page).click();
  await expect(historyDialog(page).getByText("Изменений пока не было.")).toBeVisible();
  await expect(page).toHaveURL(`/contacts/${id}`);

  // Three ways to close it.
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await expect(historyDialog(page)).toHaveCount(0);
  await historyLink(page).click();
  await historyDialog(page).getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(historyDialog(page)).toHaveCount(0);
  await historyLink(page).click();
  await page.keyboard.press("Escape");
  await expect(historyDialog(page)).toHaveCount(0);

  // The browser's Back button leaves no window over the other page.
  await historyLink(page).click();
  await expect(historyDialog(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\?q=/);
  await expect(historyDialog(page)).toHaveCount(0);

  // A record: date, field, "old → new"; an empty old value is a dash; the number in the link grows.
  await saveEdit(page, id, { phone: "+7 911 222-22-22" });
  await expect(historyLink(page)).toHaveText("История изменений · 1");
  await historyLink(page).click();
  await expect(historyDialog(page).getByText("Телефон: +7 900 111-11-11 → +7 911 222-22-22")).toBeVisible();
  await expect(historyDialog(page).locator("time")).toHaveCount(1);
  await page.keyboard.press("Escape");

  await saveEdit(page, id, { howWeMet: "Новая подпись" });
  await expect(historyLink(page)).toHaveText("История изменений · 2");
  await historyLink(page).click();
  const records = historyDialog(page).getByRole("listitem");
  await expect(records).toHaveCount(2);
  // Newest on top
  await expect(records.nth(0)).toContainText("Откуда знакомы: — → Новая подпись");
  await expect(records.nth(1)).toContainText("Телефон: +7 900 111-11-11 → +7 911 222-22-22");
  await page.keyboard.press("Escape");

  // The same history after a reload and in another browser.
  await page.reload();
  await expect(historyLink(page)).toHaveText("История изменений · 2");
  const otherBrowser = await browser.newContext();
  const otherPage = await otherBrowser.newPage();
  await otherPage.goto(`/contacts/${id}`);
  await expect(historyLink(otherPage)).toHaveText("История изменений · 2");
  await historyLink(otherPage).click();
  await expect(historyDialog(otherPage).getByRole("listitem")).toHaveCount(2);
  await otherBrowser.close();
});

test("two edits at once and deleting a contact with history", async ({ page }) => {
  const stamp = Date.now();
  const name = `Историков Гонка ${stamp}`;
  const id = await insertFullContact(name, { phone: "+7 900 000-00-00" });

  // Two tabs open the form while the phone is the same; the first saves, then the second.
  const secondTab = await page.context().newPage();
  await page.goto(`/contacts/${id}/edit`);
  await secondTab.goto(`/contacts/${id}/edit`);
  await page.getByLabel("Телефон").fill("+7 900 111-11-11");
  await secondTab.getByLabel("Телефон").fill("+7 900 222-22-22");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(`/contacts/${id}`);
  await secondTab.getByRole("button", { name: "Сохранить" }).click();
  await expect(secondTab).toHaveURL(`/contacts/${id}`);
  await secondTab.close();

  // The second record's old value is what the first one left, and it is the newer one.
  const rows = await readChanges(id);
  expect(rows).toMatchObject([
    { field: "phone", oldValue: "+7 900 000-00-00", newValue: "+7 900 111-11-11" },
    { field: "phone", oldValue: "+7 900 111-11-11", newValue: "+7 900 222-22-22" },
  ]);
  expect(rows[1].changedAt.getTime()).toBeGreaterThan(rows[0].changedAt.getTime());

  // Deleting the contact removes its history too.
  await page.goto(`/contacts/${id}`);
  await page.getByRole("button", { name: "Удалить контакт" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await countInDb(id)).toEqual({ contacts: 0, notes: 0 });
  expect(await readChanges(id)).toEqual([]);
});

// --- Pages of the list ---

/** Adds `count` contacts "<prefix> 01", "<prefix> 02", ... in one go; they are removed after the run by their prefix. */
async function insertContactSeries(prefix: string, count: number) {
  createdPrefixes.push(prefix);
  await withDb(
    (sql) => sql`
      insert into contacts (name)
      select ${prefix} || ' ' || lpad(g::text, 2, '0') from generate_series(1, ${count}::int) g
    `,
  );
}

const pagerTop = (page: Page) => page.getByRole("navigation", { name: "Страницы сверху" });
const pagerBottom = (page: Page) => page.getByRole("navigation", { name: "Страницы снизу" });
const rows = (page: Page) => fullList(page).getByRole("listitem");

async function rowTexts(page: Page) {
  return (await rows(page).allTextContents()).map((text) => text.trim());
}

test("pages of the list: size, buttons, numbers, wrong addresses", async ({ page, browser }) => {
  const stamp = Date.now();
  const prefix = `Страничкин ${stamp}`;
  await insertContactSeries(prefix, 60);
  const search = `/?q=${encodeURIComponent(prefix)}`;
  const overdue = `Страничкин Просрочен ${stamp}`;
  await insertContact(overdue, { frequency: "week", createdAgo: "40 years" });

  // 60 found, 25 on a page, three pages; the same control above and under the list.
  await page.goto(search);
  await expect(page.getByText("Найдено: 60 контактов")).toBeVisible();
  await expect(rows(page)).toHaveCount(25);
  await expect(pagerTop(page).getByText("Страница 1 из 3")).toBeVisible();
  await expect(pagerBottom(page).getByText("Страница 1 из 3")).toBeVisible();
  const first = await rowTexts(page);
  expect(first[0]).toBe(`${prefix} 01`);

  // Forward: the next 25, the address keeps the search; "Назад" is dimmed on the first page.
  await expect(pagerTop(page).locator('[aria-disabled="true"]')).toHaveText(["Назад"]);
  await pagerTop(page).getByRole("link", { name: "Вперёд" }).click();
  await expect(page).toHaveURL(new RegExp(`q=.*&page=2$`));
  await expect(pagerTop(page).getByText("Страница 2 из 3")).toBeVisible();
  await expect(pagerTop(page).getByRole("link", { name: "Страница 2" })).toHaveAttribute("aria-current", "page");
  const second = await rowTexts(page);
  expect(second).toHaveLength(25);
  expect(second[0]).toBe(`${prefix} 26`);

  // A number leads to its page; the last page is short and "Вперёд" is dimmed there.
  await pagerBottom(page).getByRole("link", { name: "Страница 3" }).click();
  await expect(pagerTop(page).getByText("Страница 3 из 3")).toBeVisible();
  const third = await rowTexts(page);
  expect(third).toHaveLength(10);
  expect(new Set([...first, ...second, ...third]).size).toBe(60);
  await expect(pagerTop(page).locator('[aria-disabled="true"]')).toHaveText(["Вперёд"]);
  await pagerTop(page).getByRole("link", { name: "Назад" }).click();
  await expect(pagerTop(page).getByText("Страница 2 из 3")).toBeVisible();

  // The page is in the address: another browser opens the same one.
  const otherBrowser = await browser.newContext();
  const otherPage = await otherBrowser.newPage();
  await otherPage.goto(`${search}&page=2`);
  expect((await rowTexts(otherPage))[0]).toBe(`${prefix} 26`);
  await otherBrowser.close();

  // Wrong values: a bad number is the first page, a number too big is the last one, a bad size is 25.
  for (const bad of ["abc", "0", "-2", "1.5"]) {
    await page.goto(`${search}&page=${bad}`);
    await expect(pagerTop(page).getByText("Страница 1 из 3")).toBeVisible();
  }
  await page.goto(`${search}&page=999`);
  await expect(pagerTop(page).getByText("Страница 3 из 3")).toBeVisible();
  await expect(rows(page)).toHaveCount(10);
  await page.goto(`${search}&size=7`);
  await expect(rows(page)).toHaveCount(25);

  // Size: a new one starts from the first page and is kept while moving around.
  await page.goto(`${search}&page=3`);
  await pagerTop(page).getByRole("link", { name: "10", exact: true }).click();
  await expect(page).toHaveURL(/size=10/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(pagerTop(page).getByText("Страница 1 из 6")).toBeVisible();
  await expect(rows(page)).toHaveCount(10);
  await expect(pagerTop(page).getByRole("link", { name: "10", exact: true })).toHaveAttribute("aria-current", "true");
  await pagerTop(page).getByRole("link", { name: "Вперёд" }).click();
  await expect(page).toHaveURL(/size=10/);
  await pagerTop(page).getByRole("link", { name: "100", exact: true }).click();
  await expect(rows(page)).toHaveCount(60);
  await expect(pagerTop(page).getByText("Страница 1 из 1")).toBeVisible();

  // Many pages: first, last, the current one and its neighbours, dots between.
  await page.goto(`${search}&size=10&page=3`);
  for (const shown of ["1", "2", "3", "4", "6"]) {
    await expect(pagerTop(page).getByRole("link", { name: `Страница ${shown}`, exact: true })).toBeVisible();
  }
  await expect(pagerTop(page).getByRole("link", { name: "Страница 5", exact: true })).toHaveCount(0);
  await expect(pagerTop(page).getByText("…").locator("visible=true")).toHaveCount(1);

  // The size survives a new search and "Сбросить", but not a visit without it in the address.
  await page.getByLabel("Поиск по имени").fill(`${prefix} 0`);
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page).toHaveURL(/size=10/);
  await expect(page.getByText("Найдено: 9 контактов")).toBeVisible();
  // Nine are not enough for pages: no control at all.
  await expect(page.getByRole("navigation", { name: /^Страницы/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Сбросить" }).click();
  await expect(page).toHaveURL(/\/\?size=10$/);
  await expect(rows(page)).toHaveCount(10);
  await page.goto("/");
  await expect(rows(page)).toHaveCount(onPage(await readTotal(page)));

  // The whole list: 25 on the first page, pages without repeats, a short last page.
  const total = await readTotal(page);
  const pages = Math.ceil(total / PAGE_SIZE);
  await expect(pagerTop(page).getByText(`Страница 1 из ${pages}`)).toBeVisible();
  const plainFirst = await rowTexts(page);
  await page.goto("/?page=2");
  await readTotal(page);
  const plainSecond = await rowTexts(page);
  expect(plainSecond).toHaveLength(PAGE_SIZE);
  expect(plainSecond.filter((text) => plainFirst.includes(text))).toEqual([]);
  await page.goto("/?page=999999");
  await expect(rows(page)).toHaveCount(total - PAGE_SIZE * (pages - 1));

  // The "Пора связаться" block is on the first page only.
  await page.goto("/");
  await expect(blockTitle(page)).toBeVisible();
  await page.goto("/?page=2");
  await readTotal(page);
  await expect(blockTitle(page)).toHaveCount(0);
  await pagerTop(page).getByRole("link", { name: "Назад" }).click();
  await expect(blockTitle(page)).toBeVisible();
});

test("pages with the filter, the counts and delete mode", async ({ page }) => {
  const stamp = Date.now();
  const prefix = `Страничкин Удаление ${stamp}`;
  await insertContactSeries(prefix, 11);
  const search = `/?q=${encodeURIComponent(prefix)}&size=10`;

  // A new search starts from the first page.
  await page.goto(`${search}&page=2`);
  await expect(pagerTop(page).getByText("Страница 2 из 2")).toBeVisible();
  await page.getByLabel("Поиск по имени").fill(prefix);
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(pagerTop(page).getByText("Страница 1 из 2")).toBeVisible();
  await expect(page.getByText("Найдено: 11 контактов")).toBeVisible();

  // The filter is cut into pages too; "Всего" and the filter count stay whole numbers.
  await page.goto("/");
  const total = await readTotal(page);
  const forgotten = await readForgotten(page);
  await forgottenLink(page).click();
  await expect(page).toHaveURL(/\?nofreq=1$/);
  await expect(rows(page)).toHaveCount(onPage(forgotten));
  expect(await readTotal(page)).toBe(total);
  expect(await readForgotten(page)).toBe(forgotten);
  await expect(pagerTop(page).getByText(`Страница 1 из ${Math.ceil(forgotten / PAGE_SIZE)}`)).toBeVisible();
  await pagerTop(page).getByRole("link", { name: "Вперёд" }).click();
  await expect(page).toHaveURL(/\?nofreq=1&page=2$/);
  await expect(blockTitle(page)).toHaveCount(0);

  // Delete mode: the selection survives moving between pages, and the dialog counts all of it.
  await page.goto(search);
  const checkboxes = page.getByRole("checkbox");
  await page.getByRole("button", { name: "Удалить контакты" }).click();
  await expect(checkboxes).toHaveCount(10);
  await page.getByText(`${prefix} 01`).click();
  await expect(page.getByRole("button", { name: "Удалить выбранные: 1" })).toBeVisible();
  await pagerTop(page).getByRole("link", { name: "Вперёд" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(checkboxes).toHaveCount(1);
  await page.getByText(`${prefix} 11`).click();
  await expect(page.getByRole("button", { name: "Удалить выбранные: 2" })).toBeVisible();
  await pagerTop(page).getByRole("link", { name: "Назад" }).click();
  await expect(page.getByRole("checkbox", { name: `${prefix} 01` })).toBeChecked();
  await expect(page.getByRole("button", { name: "Удалить выбранные: 2" })).toBeVisible();

  // Deleting what is selected on two pages.
  await page.getByRole("button", { name: "Удалить выбранные: 2" }).click();
  await expect(page.getByRole("alertdialog").getByRole("heading", { name: "Удалить 2 контакта?" })).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByText("Найдено: 9 контактов")).toBeVisible();
  const left = await withDb(
    async (sql) =>
      (await sql`select count(*)::int as n from contacts where name like ${prefix + "%"}`)[0].n as number,
  );
  expect(left).toBe(9);

  // An address with a page that is gone shows the last page that exists.
  await page.goto(`/?q=${encodeURIComponent(prefix)}&size=10&page=5`);
  await expect(rows(page)).toHaveCount(9);

  // The only contact of the last page is deleted from that page: the page before it is shown, not an empty one.
  const lonely = `Страничкин Пустая ${stamp}`;
  await insertContactSeries(lonely, 11);
  await page.goto(`/?q=${encodeURIComponent(lonely)}&size=10&page=2`);
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Удалить контакты" }).click();
  await page.getByText(`${lonely} 11`).click();
  await page.getByRole("button", { name: "Удалить выбранные: 1" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByText("Найдено: 10 контактов")).toBeVisible();
  await expect(rows(page)).toHaveCount(10);
});

test("pages control on a narrow screen: arrows and a single row of numbers", async ({ page }) => {
  const stamp = Date.now();
  const prefix = `Страничкин Узкий ${stamp}`;
  await insertContactSeries(prefix, 60);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/?q=${encodeURIComponent(prefix)}&size=10&page=3`);
  await expect(pagerTop(page).getByText("Страница 3 из 6")).toBeVisible();

  // Only the first, the current and the last number, with dots between.
  for (const shown of ["1", "3", "6"]) {
    await expect(pagerTop(page).getByRole("link", { name: `Страница ${shown}`, exact: true })).toBeVisible();
  }
  for (const hidden of ["2", "4", "5"]) {
    await expect(pagerTop(page).getByRole("link", { name: `Страница ${hidden}`, exact: true })).toHaveCount(0);
  }
  await expect(pagerTop(page).getByText("…").locator("visible=true")).toHaveCount(2);

  // Arrows instead of the words; the words stay as the names for screen readers.
  const back = pagerTop(page).getByRole("link", { name: "Назад" });
  const forward = pagerTop(page).getByRole("link", { name: "Вперёд" });
  await expect(back.locator("svg")).toBeVisible();
  await expect(forward.locator("svg")).toBeVisible();

  // Arrows and numbers sit in one row, and the page doesn't scroll sideways.
  const row = await Promise.all(
    [back, pagerTop(page).getByRole("link", { name: "Страница 1", exact: true }), pagerTop(page).getByRole("link", { name: "Страница 3", exact: true }), pagerTop(page).getByRole("link", { name: "Страница 6", exact: true }), forward].map(
      async (link) => (await link.boundingBox())!.y,
    ),
  );
  expect(Math.max(...row) - Math.min(...row)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // An arrow works: from the last page (a number too big) one step back.
  await page.goto(`/?q=${encodeURIComponent(prefix)}&size=10&page=999`);
  await expect(pagerTop(page).getByText("Страница 6 из 6")).toBeVisible();
  await back.click();
  await expect(pagerTop(page).getByText("Страница 5 из 6")).toBeVisible();
});
