import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";

// Smoke check for deploys: 200 only when the app is up and can reach the database.
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "database unavailable" }, { status: 503 });
  }
}
