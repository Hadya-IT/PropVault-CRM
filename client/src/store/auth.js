import { create } from 'zustand';
import { api, setUnauthorizedHandler } from '../lib/api';
import { msal, msalReady, loginRequest } from '../auth/msal';

export const useAuth = create((set, get) => ({
  status: 'loading', // loading | anonymous | authenticated
  user: null,
  entities: [],
  devLogin: false,
  error: null,

  async bootstrap() {
    // Coming back from Microsoft? Exchange the ID token for our session cookie first.
    try {
      const redirect = await msalReady();
      if (redirect?.idToken) {
        await api.post('/auth/login', { idToken: redirect.idToken });
        await msal.clearCache().catch(() => {});
        window.history.replaceState(null, '', '/');
      }
    } catch (e) {
      set({ error: e?.message || 'Sign-in failed' });
    }
    try {
      const cfg = await api.get('/auth/config').catch(() => ({ devLogin: false }));
      set({ devLogin: Boolean(cfg?.devLogin) });
      const me = await api.get('/me');
      set({ status: 'authenticated', user: me.user, entities: me.entities, error: null });
    } catch {
      set({ status: 'anonymous', user: null, entities: [] });
    }
  },

  async refresh() {
    const me = await api.get('/me');
    set({ user: me.user, entities: me.entities });
  },

  async loginMicrosoft() {
    set({ error: null });
    try {
      await msalReady();
      await msal.loginRedirect(loginRequest); // page navigates to Microsoft and comes back
    } catch (e) {
      set({ error: e?.message || 'Sign-in failed' });
    }
  },

  async loginDev(email) {
    set({ error: null });
    try {
      await api.post('/auth/dev-login', { email });
      await get().bootstrap();
    } catch (e) {
      set({ error: e.message });
    }
  },

  async logout() {
    await api.post('/auth/logout').catch(() => {});
    set({ status: 'anonymous', user: null, entities: [] });
  },
}));

setUnauthorizedHandler(() => {
  if (useAuth.getState().status === 'authenticated') useAuth.setState({ status: 'anonymous', user: null, entities: [] });
});