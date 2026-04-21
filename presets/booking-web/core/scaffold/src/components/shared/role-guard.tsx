"use client";

import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <p className="text-lg font-medium text-muted-foreground">
          권한이 없습니다
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          이 페이지에 접근할 수 있는 권한이 부족합니다.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
