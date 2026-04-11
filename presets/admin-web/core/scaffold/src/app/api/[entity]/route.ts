import { NextRequest, NextResponse } from "next/server";
import { createDataStore } from "@/lib/data-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;
  const store = createDataStore(entity);
  return NextResponse.json(store.getAll());
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;
  const store = createDataStore(entity);
  const body = await request.json();
  const created = store.create(body);
  return NextResponse.json(created, { status: 201 });
}
