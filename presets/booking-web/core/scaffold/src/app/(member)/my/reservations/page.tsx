"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Reservation {
  id: string;
  memberId: string;
  itemId: string;
  guestName: string;
  reservedAt: string;
  status: string;
}

export default function MyReservationsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/reservations?memberId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((list: Reservation[]) => {
        setReservations(list);
        setLoading(false);
      });
  }, [user]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <h2 className="text-2xl font-bold">내 예약</h2>
      {loading ? (
        <p className="text-muted-foreground">로딩 중...</p>
      ) : reservations.length === 0 ? (
        <p className="text-muted-foreground">예약 내역이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-base">예약번호 {r.id}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">상품 ID</p>
                  <p>{r.itemId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">투숙자</p>
                  <p>{r.guestName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">예약일</p>
                  <p>{new Date(r.reservedAt).toLocaleString("ko-KR")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">상태</p>
                  <p>{r.status}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
