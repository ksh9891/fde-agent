import { mkdir, cp, writeFile, readFile } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";
import { execa } from "execa";
export class Provisioner {
    workspaceRoot;
    presetsDir;
    palettesDir;
    constructor(options) {
        this.workspaceRoot = options.workspaceRoot;
        this.presetsDir = options.presetsDir;
        this.palettesDir = options.palettesDir;
    }
    async create(input) {
        const workspace = resolve(join(this.workspaceRoot, input.runId));
        // Create workspace + meta
        await mkdir(workspace, { recursive: true });
        await mkdir(join(workspace, "meta"), { recursive: true });
        // Copy preset scaffold if exists (exclude node_modules and .next)
        const presetDir = join(this.presetsDir, input.preset, "core", "scaffold");
        if (existsSync(presetDir)) {
            await cp(presetDir, join(workspace, "app"), {
                recursive: true,
                filter: (src) => !src.includes("node_modules") && !src.includes(".next"),
            });
        }
        else {
            await mkdir(join(workspace, "app"), { recursive: true });
        }
        // Install dependencies in workspace
        const appDir = join(workspace, "app");
        if (existsSync(join(appDir, "package.json"))) {
            console.log("[FDE-AGENT] Installing dependencies in workspace...");
            await execa("npm", ["install"], { cwd: appDir, timeout: 120_000 });
            console.log("[FDE-AGENT] Dependencies installed");
            // Install Playwright browser
            await this.installPlaywrightBrowser(appDir);
        }
        // Copy palette if exists
        const palettePath = join(this.palettesDir, `${input.palette}.json`);
        if (existsSync(palettePath)) {
            await cp(palettePath, join(workspace, "app", "design-tokens.json"));
        }
        // Copy preset rules if exists
        const rulesDir = join(this.presetsDir, input.preset, "rules");
        if (existsSync(rulesDir)) {
            await cp(rulesDir, join(workspace, "app"), { recursive: true });
        }
        // Generate skeleton pages for each entity
        if (input.entities && input.entities.length > 0) {
            console.log("[FDE-AGENT] Generating entity page skeletons...");
            await this.generateEntitySkeletons(appDir, input.entities, input.entitySlugMap ?? {});
            console.log("[FDE-AGENT] Entity skeletons generated");
            // Generate template E2E tests
            const testPackDir = join(this.presetsDir, input.preset, "test-pack", "scenarios");
            if (existsSync(testPackDir)) {
                console.log("[FDE-AGENT] Generating template E2E tests...");
                await this.generateTemplateE2ETests(appDir, input.entities, input.entitySlugMap ?? {}, testPackDir);
                console.log("[FDE-AGENT] Template E2E tests generated");
            }
        }
        return workspace;
    }
    async generateEntitySkeletons(appDir, entities, slugMap) {
        // Generate types file
        const typesLines = [];
        typesLines.push("// Auto-generated entity types — Builder should enhance this");
        typesLines.push("");
        // Generate seed data file
        const seedLines = [];
        seedLines.push("// Auto-generated seed data — Builder should enhance this");
        seedLines.push("");
        for (const entity of entities) {
            const slug = slugMap[entity.name] ?? entity.name.toLowerCase();
            const typeName = slug.charAt(0).toUpperCase() + slug.slice(1, -1); // "reservations" → "Reservation"
            // Type definition
            typesLines.push(`export interface ${typeName} {`);
            typesLines.push(`  id: string;`);
            for (const field of entity.fields) {
                typesLines.push(`  ${this.toFieldKey(field)}: string;`);
            }
            typesLines.push(`}`);
            typesLines.push("");
            // Seed data array
            seedLines.push(`export const ${slug}Seed = [`);
            const sampleValues = this.getRealisticSampleData(entity.name, entity.fields);
            for (let i = 0; i < sampleValues.length; i++) {
                const fields = entity.fields
                    .map((f) => `    ${this.toFieldKey(f)}: "${sampleValues[i][f] ?? ""}"`)
                    .join(",\n");
                seedLines.push(`  {\n    id: "${i + 1}",\n${fields}\n  },`);
            }
            seedLines.push(`];`);
            seedLines.push("");
            // Generate list page
            const listPageDir = join(appDir, "src", "app", "(admin)", slug);
            await mkdir(listPageDir, { recursive: true });
            await writeFile(join(listPageDir, "page.tsx"), this.generateListPage(entity, slug, typeName));
            // Generate detail page
            const detailPageDir = join(listPageDir, "[id]");
            await mkdir(detailPageDir, { recursive: true });
            await writeFile(join(detailPageDir, "page.tsx"), this.generateDetailPage(entity, slug, typeName));
            // Generate new/create page
            const newPageDir = join(listPageDir, "new");
            await mkdir(newPageDir, { recursive: true });
            await writeFile(join(newPageDir, "page.tsx"), this.generateFormPage(entity, slug, typeName));
            // Generate edit page
            const editPageDir = join(detailPageDir, "edit");
            await mkdir(editPageDir, { recursive: true });
            await writeFile(join(editPageDir, "page.tsx"), this.generateEditPage(entity, slug, typeName));
        }
        // Write types file
        await writeFile(join(appDir, "src", "lib", "types.ts"), typesLines.join("\n"));
        // Write seed data file
        await writeFile(join(appDir, "src", "lib", "seed-data.ts"), seedLines.join("\n"));
        // Generate seed API route
        await this.generateSeedRoute(appDir, entities, slugMap);
        // Update sidebar nav in admin layout
        await this.updateAdminLayout(appDir, entities, slugMap);
    }
    generateListPage(entity, slug, typeName) {
        const columns = entity.fields
            .map((f) => `    { key: "${this.toFieldKey(f)}", title: "${f}" },`)
            .join("\n");
        return `"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { fetchAll } from "@/lib/api-client";
import type { ${typeName} } from "@/lib/types";

const columns = [
${columns}
];

export default function ${typeName}ListPage() {
  const router = useRouter();
  const [data, setData] = useState<${typeName}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll<${typeName}>("${slug}").then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="p-4">로딩 중...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">${entity.name} 목록</h2>
        <Button onClick={() => router.push("/${slug}/new")}>새 ${entity.name}</Button>
      </div>
      <DataTable
        data={data}
        columns={columns}
        searchKey="${this.toFieldKey(entity.fields[0])}"
        searchPlaceholder="${entity.fields[0]}(으)로 검색..."
        onRowClick={(row) => router.push(\`/${slug}/\${row.id}\`)}
      />
    </div>
  );
}
`;
    }
    generateDetailPage(entity, slug, typeName) {
        const fieldRows = entity.fields
            .map((f) => `          <div>
            <dt className="text-sm text-muted-foreground">${f}</dt>
            <dd className="text-lg">{item?.${this.toFieldKey(f)} ?? "-"}</dd>
          </div>`)
            .join("\n");
        return `"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchById, deleteItem } from "@/lib/api-client";
import type { ${typeName} } from "@/lib/types";

export default function ${typeName}DetailPage() {
  const params = useParams();
  const router = useRouter();
  const [item, setItem] = useState<${typeName} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchById<${typeName}>("${slug}", params.id as string).then((d) => { setItem(d); setLoading(false); });
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteItem("${slug}", params.id as string);
    router.push("/${slug}");
  };

  if (loading) return <div className="p-4">로딩 중...</div>;

  if (!item) {
    return <div className="p-4">항목을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => router.push("/${slug}")}>목록</Button>
        <Button variant="outline" onClick={() => router.push(\`/${slug}/\${params.id}/edit\`)}>수정</Button>
        <Button variant="destructive" onClick={handleDelete}>삭제</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>${entity.name} 상세</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
${fieldRows}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
`;
    }
    generateFormPage(entity, slug, typeName) {
        const fields = entity.fields
            .map((f) => `    { name: "${this.toFieldKey(f)}", label: "${f}", type: "text" as const, required: true },`)
            .join("\n");
        return `"use client";

import { useRouter } from "next/navigation";
import { FormBuilder } from "@/components/shared/form-builder";
import { createItem } from "@/lib/api-client";

const fields = [
${fields}
];

export default function New${typeName}Page() {
  const router = useRouter();

  const handleSubmit = async (data: Record<string, unknown>) => {
    await createItem("${slug}", data);
    router.push("/${slug}");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">새 ${entity.name}</h2>
      <FormBuilder
        fields={fields}
        onSubmit={handleSubmit}
        submitLabel="저장"
      />
    </div>
  );
}
`;
    }
    generateEditPage(entity, slug, typeName) {
        const fields = entity.fields
            .map((f) => `    { name: "${this.toFieldKey(f)}", label: "${f}", type: "text" as const, required: true },`)
            .join("\n");
        return `"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { FormBuilder } from "@/components/shared/form-builder";
import { fetchById, updateItem } from "@/lib/api-client";
import type { ${typeName} } from "@/lib/types";

const fields = [
${fields}
];

export default function Edit${typeName}Page() {
  const params = useParams();
  const router = useRouter();
  const [item, setItem] = useState<${typeName} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchById<${typeName}>("${slug}", params.id as string).then((d) => { setItem(d); setLoading(false); });
  }, [params.id]);

  if (loading) return <div className="p-4">로딩 중...</div>;

  if (!item) {
    return <div className="p-4">항목을 찾을 수 없습니다.</div>;
  }

  const handleSubmit = async (data: Record<string, unknown>) => {
    await updateItem("${slug}", params.id as string, data);
    router.push(\`/${slug}/\${params.id}\`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">${entity.name} 수정</h2>
      <FormBuilder
        fields={fields}
        onSubmit={handleSubmit}
        defaultValues={item as unknown as Record<string, unknown>}
        submitLabel="수정"
      />
    </div>
  );
}
`;
    }
    getRealisticSampleData(entityName, fields) {
        const samples = {
            "객실": [
                { "객실번호": "101", "타입": "디럭스 트윈", "층": "1층", "상태": "사용가능", "가격": "250,000" },
                { "객실번호": "102", "타입": "디럭스 더블", "층": "1층", "상태": "사용가능", "가격": "280,000" },
                { "객실번호": "201", "타입": "스위트", "층": "2층", "상태": "사용중", "가격": "450,000" },
                { "객실번호": "202", "타입": "디럭스 트윈", "층": "2층", "상태": "청소중", "가격": "250,000" },
                { "객실번호": "203", "타입": "스탠다드 더블", "층": "2층", "상태": "사용가능", "가격": "180,000" },
                { "객실번호": "301", "타입": "프리미엄 스위트", "층": "3층", "상태": "사용가능", "가격": "650,000" },
                { "객실번호": "302", "타입": "디럭스 트윈", "층": "3층", "상태": "사용중", "가격": "250,000" },
                { "객실번호": "303", "타입": "스탠다드 트윈", "층": "3층", "상태": "사용가능", "가격": "160,000" },
                { "객실번호": "401", "타입": "로얄 스위트", "층": "4층", "상태": "점검중", "가격": "850,000" },
                { "객실번호": "402", "타입": "디럭스 더블", "층": "4층", "상태": "사용가능", "가격": "280,000" },
                { "객실번호": "501", "타입": "펜트하우스", "층": "5층", "상태": "사용가능", "가격": "1,200,000" },
                { "객실번호": "502", "타입": "디럭스 트윈", "층": "5층", "상태": "사용중", "가격": "250,000" },
            ],
            "예약": [
                { "예약번호": "RSV-2026-0001", "고객명": "김민수", "객실": "301호 프리미엄 스위트", "체크인": "2026-04-15", "체크아웃": "2026-04-17", "상태": "확정" },
                { "예약번호": "RSV-2026-0002", "고객명": "이서연", "객실": "201호 스위트", "체크인": "2026-04-16", "체크아웃": "2026-04-19", "상태": "확정" },
                { "예약번호": "RSV-2026-0003", "고객명": "박지훈", "객실": "102호 디럭스 더블", "체크인": "2026-04-18", "체크아웃": "2026-04-20", "상태": "대기" },
                { "예약번호": "RSV-2026-0004", "고객명": "최예진", "객실": "501호 펜트하우스", "체크인": "2026-04-20", "체크아웃": "2026-04-25", "상태": "확정" },
                { "예약번호": "RSV-2026-0005", "고객명": "정우성", "객실": "101호 디럭스 트윈", "체크인": "2026-04-14", "체크아웃": "2026-04-16", "상태": "체크아웃 완료" },
                { "예약번호": "RSV-2026-0006", "고객명": "한소희", "객실": "402호 디럭스 더블", "체크인": "2026-04-21", "체크아웃": "2026-04-23", "상태": "대기" },
                { "예약번호": "RSV-2026-0007", "고객명": "송민호", "객실": "203호 스탠다드 더블", "체크인": "2026-04-17", "체크아웃": "2026-04-18", "상태": "취소" },
                { "예약번호": "RSV-2026-0008", "고객명": "윤아름", "객실": "302호 디럭스 트윈", "체크인": "2026-04-19", "체크아웃": "2026-04-22", "상태": "확정" },
                { "예약번호": "RSV-2026-0009", "고객명": "장도윤", "객실": "401호 로얄 스위트", "체크인": "2026-04-25", "체크아웃": "2026-04-28", "상태": "대기" },
                { "예약번호": "RSV-2026-0010", "고객명": "오수진", "객실": "303호 스탠다드 트윈", "체크인": "2026-04-22", "체크아웃": "2026-04-24", "상태": "확정" },
            ],
            "고객": [
                { "고객번호": "C-001", "이름": "김민수", "연락처": "010-1234-5678", "등급": "VIP" },
                { "고객번호": "C-002", "이름": "이서연", "연락처": "010-2345-6789", "등급": "VIP" },
                { "고객번호": "C-003", "이름": "박지훈", "연락처": "010-3456-7890", "등급": "일반" },
                { "고객번호": "C-004", "이름": "최예진", "연락처": "010-4567-8901", "등급": "VVIP" },
                { "고객번호": "C-005", "이름": "정우성", "연락처": "010-5678-9012", "등급": "일반" },
                { "고객번호": "C-006", "이름": "한소희", "연락처": "010-6789-0123", "등급": "VIP" },
                { "고객번호": "C-007", "이름": "송민호", "연락처": "010-7890-1234", "등급": "일반" },
                { "고객번호": "C-008", "이름": "윤아름", "연락처": "010-8901-2345", "등급": "VIP" },
                { "고객번호": "C-009", "이름": "장도윤", "연락처": "010-9012-3456", "등급": "VVIP" },
                { "고객번호": "C-010", "이름": "오수진", "연락처": "010-0123-4567", "등급": "일반" },
                { "고객번호": "C-011", "이름": "강현우", "연락처": "010-1111-2222", "등급": "VIP" },
                { "고객번호": "C-012", "이름": "임수빈", "연락처": "010-3333-4444", "등급": "일반" },
            ],
        };
        // If we have predefined data for this entity, use it
        if (samples[entityName]) {
            return samples[entityName];
        }
        // Fallback: generate generic but somewhat realistic data
        const result = [];
        for (let i = 1; i <= 10; i++) {
            const row = {};
            for (const field of fields) {
                row[field] = this.generateGenericValue(field, i);
            }
            result.push(row);
        }
        return result;
    }
    generateGenericValue(field, index) {
        const lower = field.toLowerCase();
        if (lower.includes("번호") || lower.includes("id"))
            return `${field.replace("번호", "")}-${String(index).padStart(3, "0")}`;
        if (lower.includes("이름") || lower.includes("명")) {
            const names = ["김민수", "이서연", "박지훈", "최예진", "정우성", "한소희", "송민호", "윤아름", "장도윤", "오수진"];
            return names[(index - 1) % names.length];
        }
        if (lower.includes("연락처") || lower.includes("전화"))
            return `010-${String(1000 + index).slice(1)}-${String(5000 + index).slice(1)}`;
        if (lower.includes("상태")) {
            const statuses = ["활성", "대기", "완료", "취소"];
            return statuses[(index - 1) % statuses.length];
        }
        if (lower.includes("날짜") || lower.includes("일시"))
            return `2026-04-${String(10 + index).padStart(2, "0")}`;
        if (lower.includes("가격") || lower.includes("금액"))
            return `${(index * 50000).toLocaleString()}`;
        if (lower.includes("등급")) {
            const grades = ["일반", "VIP", "VVIP"];
            return grades[(index - 1) % grades.length];
        }
        return `${field} ${index}`;
    }
    async generateSeedRoute(appDir, entities, slugMap) {
        const seedRouteDir = join(appDir, "src", "app", "api", "seed");
        await mkdir(seedRouteDir, { recursive: true });
        const imports = entities
            .map((e) => {
            const slug = slugMap[e.name] ?? e.name.toLowerCase();
            return `import { ${slug}Seed } from "@/lib/seed-data";`;
        })
            .join("\n");
        const storeCreations = entities
            .map((e) => {
            const slug = slugMap[e.name] ?? e.name.toLowerCase();
            return `  const ${slug}Store = createDataStore("${slug}");\n  ${slug}Store.seed(${slug}Seed);`;
        })
            .join("\n\n");
        const routeContent = `import { NextResponse } from "next/server";
import { createDataStore } from "@/lib/data-store";
${imports}

export async function POST() {
${storeCreations}

  return NextResponse.json({ seeded: true });
}
`;
        await writeFile(join(seedRouteDir, "route.ts"), routeContent);
    }
    async updateAdminLayout(appDir, entities, slugMap) {
        const layoutPath = join(appDir, "src", "app", "(admin)", "layout.tsx");
        if (!existsSync(layoutPath))
            return;
        const navItems = entities
            .map((e) => {
            const slug = slugMap[e.name] ?? e.name.toLowerCase();
            return `    { title: "${e.name}", href: "/${slug}" },`;
        })
            .join("\n");
        const layoutContent = `"use client";

import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef } from "react";

const navItems = [
    { title: "대시보드", href: "/dashboard" },
${navItems}
];

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const seeded = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true;
      fetch("/api/seed", { method: "POST" }).catch(() => {});
    }
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminLayout navItems={navItems} title="관리자">
      {children}
    </AdminLayout>
  );
}
`;
        await writeFile(layoutPath, layoutContent);
    }
    async installPlaywrightBrowser(appDir) {
        console.log("[FDE-AGENT] Installing Playwright Chromium browser...");
        try {
            await execa("npx", ["playwright", "install", "chromium"], {
                cwd: appDir,
                timeout: 120_000,
            });
            console.log("[FDE-AGENT] Playwright Chromium installed");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`env_issue: Playwright browser install failed — ${message}`);
        }
    }
    async generateTemplateE2ETests(appDir, entities, slugMap, testPackDir) {
        const e2eDir = join(appDir, "e2e");
        await mkdir(e2eDir, { recursive: true });
        // Copy dashboard template as-is
        const dashboardTemplate = join(testPackDir, "dashboard.template.ts");
        if (existsSync(dashboardTemplate)) {
            const content = await readFile(dashboardTemplate, "utf-8");
            await writeFile(join(e2eDir, "dashboard.spec.ts"), content);
        }
        // Generate per-entity E2E tests from templates
        for (const entity of entities) {
            const slug = slugMap[entity.name] ?? entity.name.toLowerCase();
            // list-view
            const listTemplate = join(testPackDir, "list-view.template.ts");
            if (existsSync(listTemplate)) {
                let content = await readFile(listTemplate, "utf-8");
                content = content.replace("'__ENTITY_NAME__'", `'${entity.name}'`);
                content = content.replace("'__ENTITY_PATH__'", `'/${slug}'`);
                content = content.replace("'__SEARCH_FIELD__'", `'${entity.fields[0]}'`);
                await writeFile(join(e2eDir, `${slug}-list.spec.ts`), content);
            }
            // detail-view
            const detailTemplate = join(testPackDir, "detail-view.template.ts");
            if (existsSync(detailTemplate)) {
                let content = await readFile(detailTemplate, "utf-8");
                content = content.replace("'__ENTITY_NAME__'", `'${entity.name}'`);
                content = content.replace("'__DETAIL_PATH__'", `'/${slug}/1'`);
                await writeFile(join(e2eDir, `${slug}-detail.spec.ts`), content);
            }
            // form-submit
            const formTemplate = join(testPackDir, "form-submit.template.ts");
            if (existsSync(formTemplate)) {
                let content = await readFile(formTemplate, "utf-8");
                content = content.replace("'__ENTITY_NAME__'", `'${entity.name}'`);
                content = content.replace("'__FORM_PATH__'", `'/${slug}/new'`);
                // Replace REQUIRED_FIELDS with actual field data (first 3 fields)
                const fieldsToUse = entity.fields.slice(0, 3);
                const fieldEntries = fieldsToUse
                    .map((f) => `  { label: "${f}", value: "테스트 ${f}" },`)
                    .join("\n");
                content = content.replace(/const REQUIRED_FIELDS: \{ label: string; value: string \}\[\] = \[\n\s*\/\/ Test Writer fills these in\n\];/, `const REQUIRED_FIELDS: { label: string; value: string }[] = [\n${fieldEntries}\n];`);
                await writeFile(join(e2eDir, `${slug}-form.spec.ts`), content);
            }
        }
    }
    toFieldKey(koreanField) {
        // Simple Korean field name to camelCase key mapping
        const map = {
            "객실번호": "roomNumber",
            "타입": "type",
            "층": "floor",
            "상태": "status",
            "가격": "price",
            "예약번호": "reservationNumber",
            "고객명": "customerName",
            "객실": "room",
            "체크인": "checkIn",
            "체크아웃": "checkOut",
            "고객번호": "customerNumber",
            "이름": "name",
            "연락처": "phone",
            "등급": "grade",
        };
        return map[koreanField] ?? koreanField.replace(/\s/g, "");
    }
}
//# sourceMappingURL=provisioner.js.map