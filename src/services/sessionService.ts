import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, getCurrentSessionId, setCurrentSessionId, clearCurrentSessionId, generateSessionId } from '@/lib/deviceId';
import { isOnline } from './offlineStore';

export interface UserSession {
  id: string;
  user_id: string;
  tenant_id?: string | null;
  device_id: string;
  session_id: string;
  login_time: string;
  status: 'active' | 'logged_out' | 'expired';
}

const LOCAL_SESSIONS_KEY = 'pos_local_user_sessions';
const MAX_DEVICES_PER_USER = 5;

const getLocalSessions = (): UserSession[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalSessions = (sessions: UserSession[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
};

export const sessionService = {
  getDeviceId,
  getCurrentSessionId,

  /**
   * Register or renew an active session for (user_id, device_id).
   * Enforces max 5 devices per user. Expire oldest active session if limit exceeded.
   */
  createSession: async (userId: string, tenantId?: string | null, customDeviceId?: string): Promise<UserSession> => {
    const deviceId = customDeviceId || getDeviceId();
    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    const newSession: UserSession = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'us_' + Date.now(),
      user_id: userId,
      tenant_id: tenantId || null,
      device_id: deviceId,
      session_id: sessionId,
      login_time: now,
      status: 'active',
    };

    // Update local cache
    let localSessions = getLocalSessions();

    // Find active sessions for this user
    const userActiveSessions = localSessions.filter(s => s.user_id === userId && s.status === 'active');
    
    // Check if current device already had an active session
    const existingDeviceIdx = localSessions.findIndex(s => s.user_id === userId && s.device_id === deviceId && s.status === 'active');
    if (existingDeviceIdx !== -1) {
      localSessions[existingDeviceIdx].status = 'expired';
    }

    // Check max devices
    const distinctActiveDevices = new Set(
      localSessions.filter(s => s.user_id === userId && s.status === 'active' && s.device_id !== deviceId).map(s => s.device_id)
    );

    if (distinctActiveDevices.size >= MAX_DEVICES_PER_USER) {
      // Find oldest active session and expire it
      const oldest = localSessions
        .filter(s => s.user_id === userId && s.status === 'active')
        .sort((a, b) => new Date(a.login_time).getTime() - new Date(b.login_time).getTime())[0];
      if (oldest) {
        oldest.status = 'expired';
      }
    }

    localSessions.push(newSession);
    saveLocalSessions(localSessions);
    setCurrentSessionId(sessionId);

    // Sync to Supabase if available
    if (isOnline()) {
      try {
        // Expire any existing active session for this device
        await supabase
          .from('user_sessions' as any)
          .update({ status: 'expired', updated_at: now })
          .eq('user_id', userId)
          .eq('device_id', deviceId)
          .eq('status', 'active');

        // Check active sessions in cloud to enforce max 5
        const { data: activeRows } = await supabase
          .from('user_sessions' as any)
          .select('id, login_time, device_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('login_time', { ascending: true });

        if (activeRows && activeRows.length >= MAX_DEVICES_PER_USER) {
          const toExpire = activeRows.slice(0, activeRows.length - MAX_DEVICES_PER_USER + 1);
          const idsToExpire = toExpire.map((r: any) => r.id);
          if (idsToExpire.length > 0) {
            await supabase
              .from('user_sessions' as any)
              .update({ status: 'expired', updated_at: now })
              .in('id', idsToExpire);
          }
        }

        // Insert new active session
        await supabase.from('user_sessions' as any).insert({
          id: newSession.id,
          user_id: newSession.user_id,
          tenant_id: newSession.tenant_id,
          device_id: newSession.device_id,
          session_id: newSession.session_id,
          login_time: newSession.login_time,
          status: 'active',
        });
      } catch (err) {
        console.warn('[sessionService] Failed to sync session to cloud, continuing with local session:', err);
      }
    }

    return newSession;
  },

  /**
   * Logout ONLY current session_id. Other devices stay active!
   */
  logoutCurrentSession: async (customSessionId?: string): Promise<void> => {
    const sessionId = customSessionId || getCurrentSessionId();
    if (!sessionId) {
      clearCurrentSessionId();
      return;
    }

    const now = new Date().toISOString();

    // 1. Update local cache
    const localSessions = getLocalSessions();
    const match = localSessions.find(s => s.session_id === sessionId);
    if (match) {
      match.status = 'logged_out';
      saveLocalSessions(localSessions);
    }

    // 2. Clear current session ID locally (preserving device_id)
    clearCurrentSessionId();

    // 3. Update Supabase if online
    if (isOnline()) {
      try {
        await supabase
          .from('user_sessions' as any)
          .update({ status: 'logged_out', updated_at: now })
          .eq('session_id', sessionId);
      } catch (err) {
        console.warn('[sessionService] Failed to update logout status in cloud:', err);
      }
    }
  },

  /**
   * Validate if current session is active.
   */
  isCurrentSessionActive: async (): Promise<boolean> => {
    const sessionId = getCurrentSessionId();
    if (!sessionId) return false;

    // Check local first
    const localSessions = getLocalSessions();
    const match = localSessions.find(s => s.session_id === sessionId);
    if (match && match.status !== 'active') {
      return false;
    }

    // If online, verify cloud
    if (isOnline()) {
      try {
        const { data, error } = await supabase
          .from('user_sessions' as any)
          .select('status')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (!error && data) {
          return (data as any).status === 'active';
        }
      } catch (err) {
        // Fallback to local
      }
    }

    return !!match && match.status === 'active';
  },

  /**
   * Get active sessions for a user across all devices.
   */
  getActiveSessionsForUser: async (userId: string): Promise<UserSession[]> => {
    if (isOnline()) {
      try {
        const { data, error } = await supabase
          .from('user_sessions' as any)
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active');

        if (!error && data) {
          return data as UserSession[];
        }
      } catch {
        // fallback
      }
    }

    const localSessions = getLocalSessions();
    return localSessions.filter(s => s.user_id === userId && s.status === 'active');
  }
};
