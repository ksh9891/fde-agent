import { createDataStore } from "./data-store";

export interface Member {
  id: string;
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
  ownerNumber?: string;
  memberType: string; // "owner" | "general" 등 — preset은 값을 강제하지 않음. Builder가 requirement에 따라 결정.
  [key: string]: unknown;
}

export const memberStore = createDataStore<Member>("members");

export function findMemberByUsername(username: string): Member | undefined {
  return memberStore.getAll().find((m) => m.username === username);
}
