import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dataSource = await getDb();
    await dataSource.query("SELECT 1");

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json(
      { status: "unhealthy" },
      { status: 503 },
    );
  }
}
