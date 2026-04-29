import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "managerorder-admin-web",
    version: "9.5",
    timestamp: new Date().toISOString(),
  });
}
