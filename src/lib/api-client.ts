export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    // Connect to port 3351 on same host (localhost or Tailscale IP)
    return `${protocol}//${hostname}:3351`;
  }
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3351";
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; message?: string; status: number }> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      ...options,
      credentials: "include", // send cookies
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: json.message || `Request failed with status ${res.status}`,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: (json.data !== undefined ? json.data : json) as T,
      message: json.message,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal terhubung ke API backend";
    return {
      ok: false,
      status: 0,
      message,
    };
  }
}
