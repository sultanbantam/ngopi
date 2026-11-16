import * as SecureStore from '../../utils/storage';

export const GREEN_API_BASE = 'https://api.ngopi.top/api/green';
export const UPLOAD_PRIVATE_URL = 'https://api.ngopi.top/api/upload?scope=private';

async function authHeaders(isJson = true): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync('token');
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function fetchGreenCatalog() {
  const res = await fetch(`${GREEN_API_BASE}/catalog`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Failed to load catalog');
  return json;
}

export async function fetchGreenDashboard() {
  const res = await fetch(`${GREEN_API_BASE}/dashboard`, {
    headers: await authHeaders(false),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export async function fetchGreenSubmissions(category = 'all', status = 'all') {
  const qs = new URLSearchParams({ category, status }).toString();
  const res = await fetch(`${GREEN_API_BASE}/submissions?${qs}`, {
    headers: await authHeaders(false),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json.items || [];
}

export async function submitGreenActivity(payload: any) {
  const res = await fetch(`${GREEN_API_BASE}/submissions`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Submission failed');
  return json.submission;
}

export async function uploadPrivateEvidenceFile(file: File | { uri: string; name: string; type: string }) {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('Authentication required for evidence upload');

  const form = new FormData();
  form.append('file', file as any);

  const res = await fetch(UPLOAD_PRIVATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Upload failed');
  return {
    fileUrl: json.url || json.path || json.fileUrl,
    fileName: json.originalname || (file as any).name || 'evidence.jpg',
    mimeType: json.mimetype || (file as any).type || 'image/jpeg',
    fileSize: Number(json.size || (file as any).size || 0),
  };
}

export async function fetchGreenReports(category = 'all', status = 'all') {
  const qs = new URLSearchParams({ category, status }).toString();
  const res = await fetch(`${GREEN_API_BASE}/reports?${qs}`, {
    headers: await authHeaders(false),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Failed to load reports');
  return json.reports || [];
}

export async function monitorGreenPlant(plantId: string, healthStatus: string, notes: string) {
  const res = await fetch(`${GREEN_API_BASE}/plants/${plantId}/monitor`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ healthStatus, notes }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Monitoring failed');
  return json;
}

export async function joinGreenChallenge(challengeId: string, optInBoard = false) {
  const res = await fetch(`${GREEN_API_BASE}/challenges/${challengeId}/join`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ optInBoard }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Failed to join challenge');
  return json;
}

export async function fetchAdminGreenQueue(status = 'pending') {
  const res = await fetch(`${GREEN_API_BASE}/admin/submissions?status=${encodeURIComponent(status)}`, {
    headers: await authHeaders(false),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json.items || [];
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
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Verification failed');
  return json;
}
