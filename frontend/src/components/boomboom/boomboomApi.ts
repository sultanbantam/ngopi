import { getValidAccessToken } from '../../utils/session';

export const BOOMBOOM_API_BASE = 'https://api.ngopi.top/api/boomboom';

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

export async function fetchBoomBoomDashboard() {
  const res = await fetch(`${BOOMBOOM_API_BASE}/dashboard`, {
    headers: await authHeaders(false),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, `HTTP ${res.status}`));
  return json;
}

export async function activateBoomBoomConsent(requestedRole = 'passenger') {
  const res = await fetch(`${BOOMBOOM_API_BASE}/consent`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({ requested_role: requestedRole }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Failed to activate BoomBoom SSO'));
  return json;
}

export async function registerBoomBoomDriver(payload: {
  vehicleType: string;
  vehiclePlate: string;
  vehicleModel?: string;
  serviceArea: string;
  isEv: boolean;
}) {
  const res = await fetch(`${BOOMBOOM_API_BASE}/driver/register`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Driver registration failed'));
  return json;
}

export async function toggleBoomBoomDriverOnline() {
  const res = await fetch(`${BOOMBOOM_API_BASE}/driver/toggle-online`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Failed to toggle online status'));
  return json;
}

export async function createBoomBoomTrip(payload: {
  serviceType: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  distanceKm: number;
  isEv: boolean;
  notes?: string;
}) {
  const res = await fetch(`${BOOMBOOM_API_BASE}/trips`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Booking failed'));
  return json;
}

export async function acceptBoomBoomTrip(tripId: string) {
  const res = await fetch(`${BOOMBOOM_API_BASE}/trips/${tripId}/accept`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Failed to accept trip'));
  return json;
}

export async function completeBoomBoomTrip(tripId: string) {
  const res = await fetch(`${BOOMBOOM_API_BASE}/trips/${tripId}/complete`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Failed to complete trip'));
  return json;
}

export async function cancelBoomBoomTrip(tripId: string) {
  const res = await fetch(`${BOOMBOOM_API_BASE}/trips/${tripId}/cancel`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify({}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMsg(json, 'Failed to cancel trip'));
  return json;
}
