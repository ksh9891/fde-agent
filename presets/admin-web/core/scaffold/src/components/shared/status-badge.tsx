import { Badge } from "@/components/ui/badge";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
}

const STATUS_MAP: Record<string, BadgeVariant> = {
  "확정": "default",
  "완료": "default",
  "활성": "default",
  "승인": "default",
  "대기": "secondary",
  "보류": "secondary",
  "진행중": "secondary",
  "취소": "destructive",
  "삭제": "destructive",
  "거절": "destructive",
  "비활성": "outline",
};

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const resolvedVariant = variant ?? STATUS_MAP[status] ?? "outline";

  return <Badge variant={resolvedVariant}>{status}</Badge>;
}
