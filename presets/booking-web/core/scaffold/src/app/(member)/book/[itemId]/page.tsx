"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchById } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CatalogItem {
  id: string;
  name: string;
  price?: string;
  [key: string]: unknown;
}

export default function BookingFormPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const itemId = params.itemId as string;
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Builder: eval spec의 카탈로그 엔티티 slug로 교체.
    // 아래 "example"은 scaffold 예시 — 리조트 eval spec의 경우 "rooms"로 바꾼다.
    fetchById<CatalogItem>("example", itemId).then(setItem);
  }, [itemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: user.id, itemId, guestName }),
    });
    if (res.ok) {
      router.push("/my/reservations");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "예약에 실패했습니다.");
    }
    setSubmitting(false);
  };

  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>예약 진행</CardTitle>
        </CardHeader>
        <CardContent>
          {item && (
            <div className="mb-4 space-y-1">
              <p className="text-sm text-muted-foreground">상품</p>
              <p className="font-medium">{item.name}</p>
              {item.price && <p className="text-sm">{item.price}</p>}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="guestName">투숙자 이름</Label>
              <Input
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "예약 중..." : "예약하기"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
