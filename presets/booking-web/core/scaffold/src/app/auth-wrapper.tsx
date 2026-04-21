"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";

export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
