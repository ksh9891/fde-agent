"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AdminLayout, NavItem } from "@/components/layout/admin-layout";
import {
  LayoutDashboard,
  List,
  Settings,
  Users,
} from "lucide-react";

const navItems: NavItem[] = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: <LayoutDashboard className="size-4" />,
  },
  {
    title: "예시 목록",
    href: "/example",
    icon: <List className="size-4" />,
  },
  {
    title: "사용자 관리",
    href: "/users",
    icon: <Users className="size-4" />,
    roles: ["admin"],
  },
  {
    title: "설정",
    href: "/settings",
    icon: <Settings className="size-4" />,
    roles: ["admin", "manager"],
  },
];

export default function AdminGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <AdminLayout
      navItems={navItems}
      userRole={user?.memberType}
      userName={user?.name}
    >
      {children}
    </AdminLayout>
  );
}
