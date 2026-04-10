"use client";

import { DataTable, Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

interface ExampleItem {
  id: number;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  [key: string]: unknown;
}

const mockData: ExampleItem[] = [
  { id: 1, name: "김철수", email: "kim@example.com", status: "활성", createdAt: "2026-04-01" },
  { id: 2, name: "이영희", email: "lee@example.com", status: "대기", createdAt: "2026-04-02" },
  { id: 3, name: "박민수", email: "park@example.com", status: "활성", createdAt: "2026-04-03" },
  { id: 4, name: "정수진", email: "jung@example.com", status: "비활성", createdAt: "2026-04-04" },
  { id: 5, name: "홍길동", email: "hong@example.com", status: "활성", createdAt: "2026-04-05" },
  { id: 6, name: "최유나", email: "choi@example.com", status: "대기", createdAt: "2026-04-05" },
  { id: 7, name: "강동원", email: "kang@example.com", status: "활성", createdAt: "2026-04-06" },
  { id: 8, name: "윤서연", email: "yoon@example.com", status: "취소", createdAt: "2026-04-06" },
  { id: 9, name: "임재현", email: "lim@example.com", status: "활성", createdAt: "2026-04-07" },
  { id: 10, name: "송하영", email: "song@example.com", status: "대기", createdAt: "2026-04-08" },
  { id: 11, name: "오지훈", email: "oh@example.com", status: "활성", createdAt: "2026-04-09" },
  { id: 12, name: "한소희", email: "han@example.com", status: "활성", createdAt: "2026-04-10" },
];

const columns: Column<ExampleItem>[] = [
  { key: "id", title: "ID" },
  { key: "name", title: "이름" },
  { key: "email", title: "이메일" },
  {
    key: "status",
    title: "상태",
    render: (value) => <StatusBadge status={String(value)} />,
  },
  { key: "createdAt", title: "등록일" },
];

export default function ExampleListPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">예시 목록</h2>
      </div>
      <DataTable
        data={mockData}
        columns={columns}
        searchKey="name"
        searchPlaceholder="이름으로 검색..."
        pageSize={10}
      />
    </div>
  );
}
