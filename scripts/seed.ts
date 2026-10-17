// Fills an empty database with fake contacts and notes for local testing.
// Refuses to run if contacts already exist, so real data is never mixed with fakes.
import "dotenv/config";
import { fakerRU as faker } from "@faker-js/faker";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { contacts, notes, type NewContact } from "../src/db/schema";

const CONTACT_COUNT = 1000;
const BATCH_SIZE = 500;

const HOW_WE_MET = [
  () => `Работали вместе в «${faker.company.name()}»`,
  () => `Учились в одной группе в ${faker.location.city()}`,
  () => `Познакомились на конференции в ${faker.location.city()}`,
  () => "Через общих друзей",
  () => "Соседи по дому",
  () => "Друг детства",
  () => `Познакомились в поездке в ${faker.location.city()}`,
  () => "Ходим в один спортзал",
  () => `Клиент по проекту в «${faker.company.name()}»`,
  () => "Познакомились на дне рождения у общего друга",
  () => "Вместе учились на курсах английского",
  () => "Родственник жены",
];

const NOTE_TEMPLATES = [
  () => `Договорились созвониться ${faker.helpers.arrayElement(["на следующей неделе", "в конце месяца", "после праздников", "в понедельник"])}.`,
  () => `Обещал прислать контакты знакомого ${faker.person.jobTitle().toLowerCase()}.`,
  () => `Переехал в ${faker.location.city()}, звал в гости.`,
  () => `Обсуждали совместный проект, нужно вернуться к теме через месяц.`,
  () => `Поздравил с днём рождения. Подарок: ${faker.commerce.productName().toLowerCase()}.`,
  () => `Сменил работу, теперь в «${faker.company.name()}».`,
  () => `Попросил совета по поводу ремонта, скинул ему номер мастера.`,
  () => `Встретились на кофе, ${faker.helpers.arrayElement(["всё хорошо", "много работы", "ждут ребёнка", "собирается в отпуск"])}.`,
  () => `Договорились вместе сходить на ${faker.helpers.arrayElement(["футбол", "концерт", "выставку", "рыбалку"])}.`,
  () => `Дал почитать книгу, нужно забрать.`,
];

function maybe<T>(probability: number, value: () => T): T | null {
  return Math.random() < probability ? value() : null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(contacts);
    if (existing > 0) {
      console.log(`Database already has ${existing} contacts, seeding skipped.`);
      return;
    }

    const rows: NewContact[] = Array.from({ length: CONTACT_COUNT }, () => {
      const sex = faker.person.sexType();
      const firstName = faker.person.firstName(sex);
      const lastName = faker.person.lastName(sex);
      return {
        name: `${firstName} ${lastName}`,
        howWeMet: maybe(0.9, () => faker.helpers.arrayElement(HOW_WE_MET)()),
        phone: maybe(0.85, () => faker.phone.number({ style: "international" })),
        email: maybe(0.7, () => faker.internet.email({ firstName, lastName }).toLowerCase()),
        createdAt: faker.date.past({ years: 3 }),
      };
    });

    let noteCount = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const inserted = await db
        .insert(contacts)
        .values(rows.slice(i, i + BATCH_SIZE))
        .returning({ id: contacts.id, createdAt: contacts.createdAt });

      const noteRows = inserted.flatMap((contact) =>
        Array.from({ length: faker.number.int({ min: 0, max: 4 }) }, () => ({
          contactId: contact.id,
          body: faker.helpers.arrayElement(NOTE_TEMPLATES)(),
          createdAt: faker.date.between({ from: contact.createdAt, to: new Date() }),
        })),
      );
      if (noteRows.length > 0) await db.insert(notes).values(noteRows);
      noteCount += noteRows.length;
    }

    console.log(`Seeded ${rows.length} contacts and ${noteCount} notes.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
