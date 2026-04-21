"use client";

import { useEffect, useState } from "react";
import { CatalogGrid } from "@/components/shared/catalog-grid";
import type { CatalogCardItem } from "@/components/shared/catalog-card";
import { fetchAll } from "@/lib/api-client";

interface ExampleItem {
  id: string;
  name: string;
  price?: string;
  status?: string;
  [key: string]: unknown;
}

export default function ExampleListPage() {
  const [items, setItems] = useState<ExampleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll<ExampleItem>("example").then((d) => {
      setItems(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;

  const cards: CatalogCardItem[] = items.map((it) => ({
    id: it.id,
    title: it.name,
    subtitle: it.status,
    priceLabel: it.price,
    href: `/example/${it.id}`,
  }));

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="mb-6 text-2xl font-bold">예시 목록</h2>
      <CatalogGrid items={cards} />
    </section>
  );
}
