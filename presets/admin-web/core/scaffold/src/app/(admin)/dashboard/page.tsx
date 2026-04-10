"use client";

import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ShoppingCart, TrendingUp, Activity } from "lucide-react";

const stats = [
  {
    title: "오늘 방문자",
    value: "1,234",
    description: "어제 대비 +12%",
    icon: <Users className="size-4" />,
  },
  {
    title: "신규 주문",
    value: 56,
    description: "어제 대비 +8건",
    icon: <ShoppingCart className="size-4" />,
  },
  {
    title: "매출",
    value: "₩2,450,000",
    description: "이번 주 누적",
    icon: <TrendingUp className="size-4" />,
  },
  {
    title: "처리 대기",
    value: 12,
    description: "확인이 필요합니다",
    icon: <Activity className="size-4" />,
  },
];

const recentItems = [
  { id: 1, title: "주문 #1023", status: "처리 완료", time: "10분 전" },
  { id: 2, title: "주문 #1022", status: "배송 중", time: "30분 전" },
  { id: 3, title: "문의 #456", status: "답변 대기", time: "1시간 전" },
  { id: 4, title: "주문 #1021", status: "처리 완료", time: "2시간 전" },
  { id: 5, title: "회원가입", status: "신규 가입", time: "3시간 전" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">오늘 현황</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.status}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>알림</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 py-2 border-b">
                <div className="mt-0.5 size-2 rounded-full bg-destructive shrink-0" />
                <div>
                  <p className="text-sm font-medium">재고 부족 알림</p>
                  <p className="text-xs text-muted-foreground">
                    3개 상품의 재고가 부족합니다.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-2 border-b">
                <div className="mt-0.5 size-2 rounded-full bg-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">시스템 업데이트</p>
                  <p className="text-xs text-muted-foreground">
                    다음 점검 예정: 4월 15일 02:00
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-2">
                <div className="mt-0.5 size-2 rounded-full bg-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">신규 리뷰</p>
                  <p className="text-xs text-muted-foreground">
                    오늘 5개의 새로운 리뷰가 등록되었습니다.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
