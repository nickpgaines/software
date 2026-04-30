import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export type CustomerPin = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  formatted_address: string | null;
  latitude: number;
  longitude: number;
  is_recurring: number;
};

export async function GET() {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT id, name, phone, address, formatted_address, latitude, longitude, is_recurring
         FROM customers
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
    )
    .all()) as CustomerPin[];
  return NextResponse.json(rows);
}
