const BASE_URL = "/api";

export async function fetchAll<T>(entity: string): Promise<T[]> {
  const res = await fetch(`${BASE_URL}/${entity}`);
  if (!res.ok) throw new Error(`Failed to fetch ${entity}`);
  return res.json();
}

export async function fetchById<T>(entity: string, id: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${entity}/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch ${entity}/${id}`);
  return res.json();
}

export async function createItem<T>(entity: string, data: Partial<T>): Promise<T> {
  const res = await fetch(`${BASE_URL}/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create ${entity}`);
  return res.json();
}

export async function updateItem<T>(entity: string, id: string, data: Partial<T>): Promise<T> {
  const res = await fetch(`${BASE_URL}/${entity}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update ${entity}/${id}`);
  return res.json();
}

export async function deleteItem(entity: string, id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${entity}/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete ${entity}/${id}`);
}
