// Checks the success criteria from specs/01-продуктовая-идея.md in a real browser.
import "dotenv/config";
import { expect, test } from "@playwright/test";
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
  expect(totalCount).toBeGreaterThanOrEqual(1000);
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
