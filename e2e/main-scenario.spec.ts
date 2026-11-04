// Checks the success criteria from specs/01-продуктовая-идея.md in a real browser.
import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const createdNames: string[] = [];

// Remove only the contacts this test created, so repeated runs don't pile up test data.
test.afterAll(async () => {
  if (createdNames.length === 0) return;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  await sql`delete from contacts where name in ${sql(createdNames)}`;
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
  await expect(page.getByRole("list", { name: "Все контакты" }).getByRole("listitem")).toHaveCount(totalCount);

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
  await expect(page.getByRole("list", { name: "Все контакты" }).getByRole("listitem")).toHaveCount(totalCount + 1);

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
  await expect(page.getByRole("list", { name: "Все контакты" }).getByRole("listitem")).toHaveCount(total - 1);
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
  await expect(checkboxes).toHaveCount(total);
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
  await expect(checkboxes).toHaveCount(total);
  await expect(page.getByRole("checkbox", { name: first })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: second })).toBeChecked();
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
  await page.goto("/");
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
  await expect(fullList(page).getByRole("link", { name: new RegExp(noted) })).toBeVisible();
  expect(await listedInBlock(page, [noted])).toEqual([]);

  // Same with the browser's Back button.
  await fullList(page).getByRole("link", { name: new RegExp(noted) }).click();
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

  // Still in the full list, and counted in "Всего".
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
  await expect(fullList(page).getByRole("listitem")).toHaveCount(forgotten);
  await expect(fullList(page).getByRole("link", { name: new RegExp(plain) })).toBeVisible();
  await expect(fullList(page).getByRole("link", { name: new RegExp(overdue) })).toHaveCount(0);
  expect(await readTotal(page)).toBe(total);
  await expect(forgottenLink(page)).toHaveAttribute("aria-current", "true");
  await expect(blockTitle(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Сбросить" })).toBeVisible();

  // Reset and the browser's Back button both bring the whole list and the block back.
  await page.getByRole("link", { name: "Сбросить" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(fullList(page).getByRole("listitem")).toHaveCount(total);
  await expect(blockTitle(page)).toBeVisible();
  await forgottenLink(page).click();
  await expect(page).toHaveURL(/\?nofreq=1$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(fullList(page).getByRole("listitem")).toHaveCount(total);

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
  await openHome(page);
  await forgottenLink(page).click();
  await expect(page).toHaveURL(/\?nofreq=1$/);
  await page.getByRole("button", { name: "Удалить контакты" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(forgotten);
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
