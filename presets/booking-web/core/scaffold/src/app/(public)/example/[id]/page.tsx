"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchById } from "@/lib/api-client";

interface ExampleItem {
  id: string;
  name: string;
  description?: string;
  price?: string;
  [key: string]: unknown;
}

export default function ExampleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [item, setItem] = useState<ExampleItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchById<ExampleItem>("example", id).then((d) => {
      setItem(d);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;
  if (!item) return <div className="p-8 text-center">항목을 찾을 수 없습니다.</div>;

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{item.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.description && <p className="text-muted-foreground">{item.description}</p>}
          {item.price && <p className="text-xl font-semibold">{item.price}</p>}
          <Link href={`/book/${item.id}`}>
            <Button size="lg">예약하기</Button>
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
