import { ReactNode, Suspense } from "react";
import { MemberLayout } from "@/components/layout/member-layout";
import { AuthGate } from "@/components/shared/auth-gate";

export default function MemberGroupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthGate>
        <MemberLayout>{children}</MemberLayout>
      </AuthGate>
    </Suspense>
  );
}
