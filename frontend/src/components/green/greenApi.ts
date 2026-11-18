import { getValidAccessToken } from '../../utils/session';

export const GREEN_API_BASE = 'https://api.ngopi.top/api/green';
export const UPLOAD_PRIVATE_URL = 'https://api.ngopi.top/api/upload?scope=private';

function extractErrorMsg(json: any, fallback: string): string {
  if (!json) return fallback;
  if (typeof json.error === 'string') return json.error;
  if (typeof json.message === 'string') return json.message;
  if (json.error && typeof json.error === 'object') {
    return json.error.message || JSON.stringify(json.error);
  }
  return fallback;
}

async function authHeaders(isJson = true): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** Convert any serialized Decimal object ({ s, e, d }) into a plain JS number. */
function sanitizeDecimals(val: any): any {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if ('s' in val && 'e' in val && Array.isArray(val.d)) {
    const sign = val.s === -1 ? -1 : 1;
    const digits: number[] = val.d;
    if (digits.length === 0) return 0;
    const rawStr = digits.map((chunk, idx) => (idx === 0 ? String(chunk) : String(chunk).padStart(7, '0'))).join('');
    const dotPos = (val.e as number) + 1;
    let numStr: string;
    if (dotPos <= 0) {
      numStr = '0.' + '0'.repeat(-dotPos) + rawStr;
    } else if (dotPos >= rawStr.length) {
      numStr = rawStr + '0'.repeat(dotPos - rawStr.length);
    } else {
      numStr = rawStr.slice(0, dotPos) + '.' + rawStr.slice(dotPos);
    }
    const parsed = sign * Number(numStr);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(val)) return val.map(sanitizeDecimals);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    out[k] = sanitizeDecimals(v);
  }
  return out;
}

export async function fetchGreenCatalog() {
  const res = await fetch(`${GREEN_API_BASE}/catalog`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Failed to load catalog'));
  return sanitizeDecimals(json);
}

export async function fetchGreenDashboard() {
  const res = await fetch(`${GREEN_API_BASE}/dashboard`, {
    headers: await authHeaders(false),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, `HTTP ${res.status}`));
  return sanitizeDecimals(json);
}

export async function fetchGreenSubmissions(category = 'all', status = 'all') {
  const qs = new URLSearchParams({ category, status }).toString();
  const res = await fetch(`${GREEN_API_BASE}/submissions?${qs}`, {
    headers: await authHeaders(false),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, `HTTP ${res.status}`));
  return sanitizeDecimals(json.items || []);
}

export async function submitGreenActivity(payload: any) {
  const res = await fetch(`${GREEN_API_BASE}/submissions`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Submission failed'));
  return json.submission;
}

export async function deleteGreenSubmission(submissionId: string) {
  const res = await fetch(`${GREEN_API_BASE}/submissions/${submissionId}`, {
    method: 'DELETE',
    headers: await authHeaders(false),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Delete failed'));
  return json;
}

export async function uploadPrivateEvidenceFile(file: File | Blob | { uri: string; name: string; type: string }, fileNameOverride?: string) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Authentication required for evidence upload');

  const form = new FormData();
  if (file instanceof Blob) {
    form.append('file', file, fileNameOverride || (file as File).name || 'evidence.jpg');
  } else {
    form.append('file', file as any);
  }

  const res = await fetch(UPLOAD_PRIVATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Upload failed'));
  return {
    fileUrl: json.url || json.path || json.fileUrl,
    fileName: json.originalname || fileNameOverride || (file as any).name || 'evidence.jpg',
    mimeType: json.mimetype || (file as any).type || 'image/jpeg',
    fileSize: Number(json.size || (file as any).size || 0),
  };
}

export async function fetchGreenReports(category = 'all', status = 'all') {
  const qs = new URLSearchParams({ category, status }).toString();
  const res = await fetch(`${GREEN_API_BASE}/reports?${qs}`, {
    headers: await authHeaders(false),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Failed to load reports'));
  return sanitizeDecimals(json.reports || []);
}

export async function monitorGreenPlant(plantId: string, healthStatus: string, notes: string) {
  const res = await fetch(`${GREEN_API_BASE}/plants/${plantId}/monitor`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ healthStatus, notes }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Monitoring failed'));
  return json;
}

export async function joinGreenChallenge(challengeId: string, optInBoard = false) {
  const res = await fetch(`${GREEN_API_BASE}/challenges/${challengeId}/join`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ optInBoard }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Failed to join challenge'));
  return json;
}

export async function fetchAdminGreenQueue(status = 'pending') {
  const res = await fetch(`${GREEN_API_BASE}/admin/submissions?status=${encodeURIComponent(status)}`, {
    headers: await authHeaders(false),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, `HTTP ${res.status}`));
  return sanitizeDecimals(json.items || []);
}

export async function verifyAdminGreenSubmission(
  submissionId: string,
  decision: 'verified' | 'rejected' | 'needs_info' | 'reversed',
  reason: string
) {
  const res = await fetch(`${GREEN_API_BASE}/admin/submissions/${submissionId}/verify`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ decision, reason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Verification failed'));
  return json;
}

export async function fetchMyAdminApplication() {
  const res = await fetch(`${GREEN_API_BASE}/admin-application/me`, {
    headers: await authHeaders(false),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, `HTTP ${res.status}`));
  return json;
}

export async function applyForGreenAdmin(payload: {
  depositMethod: 'points' | 'bmc';
  bmcTxRef?: string;
  notes?: string;
}) {
  const res = await fetch(`${GREEN_API_BASE}/admin-application/apply`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Failed to submit admin application'));
  return json;
}

export async function fetchSuperadminOverview() {
  const res = await fetch(`${GREEN_API_BASE}/superadmin/overview`, {
    headers: await authHeaders(false),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, `HTTP ${res.status}`));
  return json;
}

export async function superadminPromoteUser(payload: {
  username: string;
  action: 'promote' | 'demote';
  reason?: string;
}) {
  const res = await fetch(`${GREEN_API_BASE}/superadmin/promote`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Role update failed'));
  return json;
}

export async function superadminReviewApplication(
  applicationId: string,
  decision: 'approved' | 'rejected',
  reason?: string
) {
  const res = await fetch(`${GREEN_API_BASE}/superadmin/applications/${applicationId}/review`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ decision, reason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Application review failed'));
  return json;
}
