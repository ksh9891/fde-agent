import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { memberStore, findMemberByUsername, type Member } from "@/lib/member-store";

const signupSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  ownerNumber: z.string().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { username, password, name, phone, email, ownerNumber } = parsed.data;

  if (findMemberByUsername(username)) {
    return NextResponse.json(
      { error: "USERNAME_TAKEN" },
      { status: 409 }
    );
  }

  const memberType = ownerNumber && ownerNumber.length > 0 ? "owner" : "general";

  const created = memberStore.create({
    username,
    password,
    name,
    phone,
    email: email || undefined,
    ownerNumber: ownerNumber || undefined,
    memberType,
  } as Omit<Member, "id">);

  // never return password
  const { password: _pw, ...safe } = created;
  return NextResponse.json(safe, { status: 201 });
}
