import { CatalogCard, CatalogCardItem } from "./catalog-card";

export function CatalogGrid({ items }: { items: CatalogCardItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        표시할 항목이 없습니다.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <CatalogCard key={item.id} item={item} />
      ))}
    </div>
  );
}
