/**
 * Device and Session ID helper for multi-device support.
 * Ties active sessions to session_id + device_id, persisting device_id across logins.
 */

const DEVICE_ID_KEY = 'pos_device_id';
const SESSION_ID_KEY = 'pos_session_id';

export const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'device_server';
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId || !deviceId.trim()) {
    deviceId = 'device_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now());
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const generateSessionId = (): string => {
  return 'sess_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now());
};

export const getCurrentSessionId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_ID_KEY);
};

export const setCurrentSessionId = (sessionId: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_ID_KEY, sessionId);
};

export const clearCurrentSessionId = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_ID_KEY);
};
