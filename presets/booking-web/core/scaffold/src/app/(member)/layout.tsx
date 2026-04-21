import { ReactNode } from "react";
import { MemberLayout } from "@/components/layout/member-layout";
import { AuthGate } from "@/components/shared/auth-gate";

export default function MemberGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <MemberLayout>{children}</MemberLayout>
    </AuthGate>
  );
}
