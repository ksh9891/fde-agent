import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export interface DataStore<T extends { id: string }> {
  getAll(): T[];
  getById(id: string): T | undefined;
  create(item: Omit<T, "id">): T;
  update(id: string, data: Partial<T>): T | undefined;
  remove(id: string): boolean;
  seed(items: T[]): void;
}

export function createDataStore<T extends { id: string }>(entityName: string): DataStore<T> {
  const filePath = join(DATA_DIR, `${entityName}.json`);

  function read(): T[] {
    ensureDataDir();
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  }

  function write(data: T[]): void {
    ensureDataDir();
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  return {
    getAll: () => read(),
    getById: (id) => read().find((item) => item.id === id),
    create: (item) => {
      const items = read();
      const newId = String(Math.max(0, ...items.map((i) => Number(i.id) || 0)) + 1);
      const newItem = { ...item, id: newId } as T;
      items.push(newItem);
      write(items);
      return newItem;
    },
    update: (id, data) => {
      const items = read();
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) return undefined;
      items[index] = { ...items[index], ...data };
      write(items);
      return items[index];
    },
    remove: (id) => {
      const items = read();
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      write(items);
      return true;
    },
    seed: (items) => {
      if (read().length === 0) {
        write(items);
      }
    },
  };
}
