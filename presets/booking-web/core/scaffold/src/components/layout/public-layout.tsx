"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface PublicLayoutProps {
  children: ReactNode;
  brand?: string;
  catalogPath?: string;
  catalogLabel?: string;
}

export function PublicLayout({
  children,
  brand = "예약 서비스",
  catalogPath,
  catalogLabel,
}: PublicLayoutProps) {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold">
            {brand}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {catalogPath && (
              <Link href={catalogPath} className="text-muted-foreground hover:text-foreground">
                {catalogLabel ?? "카탈로그"}
              </Link>
            )}
            {isAuthenticated ? (
              <>
                <Link href="/my/reservations" className="text-muted-foreground hover:text-foreground">
                  내 예약
                </Link>
                <span className="text-muted-foreground">{user?.name}</span>
                <Button size="sm" variant="outline" onClick={logout}>
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-muted-foreground hover:text-foreground">
                  로그인
                </Link>
                <Link href="/signup">
                  <Button size="sm">회원가입</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {brand}
        </div>
      </footer>
    </div>
  );
}
