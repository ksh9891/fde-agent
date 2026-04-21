import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDataStore } from "@/lib/data-store";
import { memberStore } from "@/lib/member-store";

export interface Reservation {
  id: string;
  memberId: string;
  itemId: string;
  guestName: string;
  reservedAt: string;
  status: string;
  [key: string]: unknown;
}

const reservationStore = createDataStore<Reservation>("reservations");

const schema = z.object({
  memberId: z.string().min(1),
  itemId: z.string().min(1),
  guestName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
  const { memberId, itemId, guestName } = parsed.data;

  const member = memberStore.getById(memberId);
  if (!member) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // TODO(builder): eval spec requirement에 따라 여기에서
  //   1) 카탈로그 항목 재고 확인(0이면 거부)
  //   2) 회원유형 접근권 확인(allowed_types 미포함이면 거부)
  //   3) 성공 시 item.stock -= 1 업데이트
  //   규칙은 eval spec의 BR-xxx 기반으로 Builder가 구현한다.

  const reservation = reservationStore.create({
    memberId,
    itemId,
    guestName,
    reservedAt: new Date().toISOString(),
    status: "확정",
  } as Omit<Reservation, "id">);

  return NextResponse.json(reservation, { status: 201 });
}

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const all = reservationStore.getAll();
  const filtered = memberId ? all.filter((r) => r.memberId === memberId) : all;
  return NextResponse.json(filtered);
}
