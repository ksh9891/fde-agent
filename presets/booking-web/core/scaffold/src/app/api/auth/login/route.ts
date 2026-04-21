import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findMemberByUsername } from "@/lib/member-store";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const member = findMemberByUsername(username);
  if (!member || member.password !== password) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const { password: _pw, ...safe } = member;
  return NextResponse.json(safe);
}
