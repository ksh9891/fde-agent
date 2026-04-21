import { ReactNode } from "react";
import { PublicLayout } from "@/components/layout/public-layout";

export default function PublicGroupLayout({ children }: { children: ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}
