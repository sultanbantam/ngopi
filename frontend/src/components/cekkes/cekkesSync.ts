import { getValidAccessToken } from '../../utils/session';

const API_BASE = 'https://api.ngopi.top/api/cekkes';

export interface CekkesServerPayload {
  profile?: any;
  telemetry?: any;
  findings?: any;
  checklist?: any;
  checklistDate?: string;
}

export async function fetchCekkesServerState(): Promise<CekkesServerPayload | null> {
  try {
    const token = await getValidAccessToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/state`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPayload: CekkesServerPayload = {};

export function queueCekkesServerSync(partial: CekkesServerPayload) {
  pendingPayload = { ...pendingPayload, ...partial };
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const body = pendingPayload;
    pendingPayload = {};
    try {
      const token = await getValidAccessToken();
      if (!token) return;
      await fetch(`${API_BASE}/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      // keep local cache silently on network error
    }
  }, 1200);
}
