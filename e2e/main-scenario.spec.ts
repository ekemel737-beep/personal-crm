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
  await expect(page.getByRole("listitem")).toHaveCount(totalCount);

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
  await expect(page.getByRole("listitem")).toHaveCount(totalCount + 1);

  // Found the contact by name and opened the card.
  await page.getByLabel("Поиск по имени").fill(name.toLowerCase());
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByRole("listitem")).toHaveCount(1);
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
  await expect(otherPage.getByRole("listitem")).toHaveCount(1);
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
  await expect(page.getByRole("listitem")).toHaveCount(total - 1);
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
