export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname || "127.0.0.1";
    const protocol = window.location.protocol || "http:";

    // Detect Tauri desktop environment, WebView2, or local development
    const isTauri =
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined ||
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined ||
      protocol === "tauri:" ||
      hostname === "tauri.localhost";

    if (
      isTauri ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      !hostname
    ) {
      return "http://127.0.0.1:3351";
    }

    // Remote access / Tailscale IP (e.g. 100.x.y.z or custom LAN IP)
    const scheme = protocol === "https:" ? "http:" : protocol;
    return `${scheme}//${hostname}:3351`;
  }
  return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:3351";
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
    const originalMsg = err instanceof Error ? err.message : String(err);
    const message =
      originalMsg === "Failed to fetch"
        ? `Gagal terhubung ke API backend (${baseUrl}). Pastikan service backend xClips berjalan di port 3351.`
        : originalMsg || "Gagal terhubung ke API backend";
    return {
      ok: false,
      status: 0,
      message,
    };
  }
}

