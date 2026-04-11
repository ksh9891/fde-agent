import { mkdir, cp, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";
import { execa } from "execa";

interface ProvisionerOptions {
  workspaceRoot: string;
  presetsDir: string;
  palettesDir: string;
}

interface EntityDef {
  name: string;
  fields: string[];
}

interface ProvisionInput {
  runId: string;
  preset: string;
  palette: string;
  entities?: EntityDef[];
  entitySlugMap?: Record<string, string>;
}

export class Provisioner {
  private workspaceRoot: string;
  private presetsDir: string;
  private palettesDir: string;

  constructor(options: ProvisionerOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.presetsDir = options.presetsDir;
    this.palettesDir = options.palettesDir;
  }

  async create(input: ProvisionInput): Promise<string> {
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
    } else {
      await mkdir(join(workspace, "app"), { recursive: true });
    }

    // Install dependencies in workspace
    const appDir = join(workspace, "app");
    if (existsSync(join(appDir, "package.json"))) {
      console.log("[FDE-AGENT] Installing dependencies in workspace...");
      await execa("npm", ["install"], { cwd: appDir, timeout: 120_000 });
      console.log("[FDE-AGENT] Dependencies installed");
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
    }

    return workspace;
  }

  private async generateEntitySkeletons(
    appDir: string,
    entities: EntityDef[],
    slugMap: Record<string, string>
  ): Promise<void> {
    // Generate mock data file
    const mockDataLines: string[] = [];
    mockDataLines.push("// Auto-generated mock data — Builder should enhance this");
    mockDataLines.push("");

    for (const entity of entities) {
      const slug = slugMap[entity.name] ?? entity.name.toLowerCase();
      const typeName = slug.charAt(0).toUpperCase() + slug.slice(1, -1); // "reservations" → "Reservation"

      // Type definition
      mockDataLines.push(`export interface ${typeName} {`);
      mockDataLines.push(`  id: string;`);
      for (const field of entity.fields) {
        mockDataLines.push(`  ${this.toFieldKey(field)}: string;`);
      }
      mockDataLines.push(`}`);
      mockDataLines.push("");

      // Mock data array
      mockDataLines.push(`export const ${slug}Data: ${typeName}[] = [`);
      for (let i = 1; i <= 10; i++) {
        const fields = entity.fields.map((f) => `    ${this.toFieldKey(f)}: "${f} ${i}"`).join(",\n");
        mockDataLines.push(`  {\n    id: "${i}",\n${fields}\n  },`);
      }
      mockDataLines.push(`];`);
      mockDataLines.push("");

      // Generate list page
      const listPageDir = join(appDir, "src", "app", "(admin)", slug);
      await mkdir(listPageDir, { recursive: true });
      await writeFile(
        join(listPageDir, "page.tsx"),
        this.generateListPage(entity, slug, typeName)
      );

      // Generate detail page
      const detailPageDir = join(listPageDir, "[id]");
      await mkdir(detailPageDir, { recursive: true });
      await writeFile(
        join(detailPageDir, "page.tsx"),
        this.generateDetailPage(entity, slug, typeName)
      );

      // Generate new/create page
      const newPageDir = join(listPageDir, "new");
      await mkdir(newPageDir, { recursive: true });
      await writeFile(
        join(newPageDir, "page.tsx"),
        this.generateFormPage(entity, slug, typeName)
      );
    }

    // Write mock data file
    await writeFile(join(appDir, "src", "lib", "mock-data.ts"), mockDataLines.join("\n"));

    // Update sidebar nav in admin layout
    await this.updateAdminLayout(appDir, entities, slugMap);
  }

  private generateListPage(entity: EntityDef, slug: string, typeName: string): string {
    const columns = entity.fields
      .map((f) => `    { key: "${this.toFieldKey(f)}", title: "${f}" },`)
      .join("\n");

    return `"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ${slug}Data } from "@/lib/mock-data";

const columns = [
${columns}
];

export default function ${typeName}ListPage() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">${entity.name} 목록</h2>
        <Button onClick={() => router.push("/${slug}/new")}>새 ${entity.name}</Button>
      </div>
      <DataTable
        data={${slug}Data}
        columns={columns}
        searchKey="${this.toFieldKey(entity.fields[0])}"
        searchPlaceholder="${entity.fields[0]}(으)로 검색..."
        onRowClick={(row) => router.push(\`/${slug}/\${(row as Record<string, unknown>).id}\`)}
      />
    </div>
  );
}
`;
  }

  private generateDetailPage(entity: EntityDef, slug: string, typeName: string): string {
    const fieldRows = entity.fields
      .map(
        (f) =>
          `          <div>
            <dt className="text-sm text-muted-foreground">${f}</dt>
            <dd className="text-lg">{item?.${this.toFieldKey(f)} ?? "-"}</dd>
          </div>`
      )
      .join("\n");

    return `"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ${slug}Data } from "@/lib/mock-data";

export default function ${typeName}DetailPage() {
  const params = useParams();
  const router = useRouter();
  const item = ${slug}Data.find((d) => d.id === params.id);

  if (!item) {
    return <div className="p-4">항목을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => router.push("/${slug}")}>목록</Button>
        <Button variant="outline" onClick={() => router.push(\`/${slug}/\${params.id}/edit\`)}>수정</Button>
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

  private generateFormPage(entity: EntityDef, slug: string, typeName: string): string {
    const fields = entity.fields
      .map(
        (f) =>
          `    { name: "${this.toFieldKey(f)}", label: "${f}", type: "text" as const, required: true },`
      )
      .join("\n");

    return `"use client";

import { useRouter } from "next/navigation";
import { FormBuilder } from "@/components/shared/form-builder";

const fields = [
${fields}
];

export default function New${typeName}Page() {
  const router = useRouter();

  const handleSubmit = (data: Record<string, unknown>) => {
    console.log("Submitted:", data);
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

  private async updateAdminLayout(
    appDir: string,
    entities: EntityDef[],
    slugMap: Record<string, string>
  ): Promise<void> {
    const layoutPath = join(appDir, "src", "app", "(admin)", "layout.tsx");
    if (!existsSync(layoutPath)) return;

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
import { useEffect } from "react";

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

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

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

  private toFieldKey(koreanField: string): string {
    // Simple Korean field name to camelCase key mapping
    const map: Record<string, string> = {
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
