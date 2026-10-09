import type { Application, Draft } from "../shared.ts";

async function call<T>(path: string, method = "GET", body?: Draft): Promise<T> {
  const res = await fetch(`/api/applications${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body && JSON.stringify(body),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error ?? res.statusText);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export const list = () => call<Application[]>("");
export const create = (row: Draft) => call<Application>("", "POST", row);
export const update = (id: number, row: Draft) => call<Application>(`/${id}`, "PUT", row);
export const remove = (id: number) => call<null>(`/${id}`, "DELETE");
