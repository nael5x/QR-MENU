import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_BASE = `${BASE}/api`;
export const TOKEN_KEY = "auth_token";

export function fileUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${BASE}${path}`;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res: Response) {
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { detail: text };
  }
  if (!res.ok) {
    const msg = typeof body?.detail === "string" ? body.detail : "Request failed";
    throw new Error(msg);
  }
  return body;
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...(await authHeader()) } });
  return handle(res);
}

export async function apiSend(method: string, path: string, data?: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  return handle(res);
}

export const apiPost = (p: string, d?: any) => apiSend("POST", p, d);
export const apiPatch = (p: string, d?: any) => apiSend("PATCH", p, d);
export const apiDelete = (p: string) => apiSend("DELETE", p);

// Public (no auth)
export async function apiPublic(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  return handle(res);
}

// Multipart image upload — handles both native and web runtimes.
export async function uploadImage(uri: string, name: string, type: string): Promise<string> {
  const { Platform } = require("react-native");
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type } as any);
  }
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: { ...(await authHeader()) },
    body: form,
  });
  const body = await handle(res);
  return body.url as string;
}
