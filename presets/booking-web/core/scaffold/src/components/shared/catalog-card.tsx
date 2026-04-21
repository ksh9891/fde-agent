import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface CatalogCardItem {
  id: string;
  title: string;
  subtitle?: string;
  priceLabel?: string;
  badgeLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  href: string;
}

export function CatalogCard({ item }: { item: CatalogCardItem }) {
  const content = (
    <Card className={item.disabled ? "opacity-60" : "hover:shadow-md transition-shadow"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{item.title}</CardTitle>
          {item.badgeLabel && (
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {item.badgeLabel}
            </span>
          )}
        </div>
        {item.subtitle && (
          <p className="text-sm text-muted-foreground">{item.subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        {item.priceLabel && <span className="font-semibold">{item.priceLabel}</span>}
        {item.disabled && item.disabledReason && (
          <span className="text-xs text-destructive">{item.disabledReason}</span>
        )}
      </CardContent>
    </Card>
  );
  if (item.disabled) return content;
  return <Link href={item.href}>{content}</Link>;
}
