import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true));
  }, []);

  const start = useCallback(({ token, user }) => {
    tokenStore.set(token);
    setUser(user);
    return user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      login: (login, password) => api('/auth/login', { method: 'POST', body: { login, password } }).then(start),
      signup: (fields) => api('/auth/signup', { method: 'POST', body: fields }).then(start),
      // Finishes a Discord/Twitch sign-in: the server hands back only a token.
      adopt: async (token) => {
        tokenStore.set(token);
        try {
          const { user } = await api('/auth/me');
          setUser(user);
          return user;
        } catch (err) {
          tokenStore.set(null);
          throw err;
        }
      },
      logout: () => {
        tokenStore.set(null);
        setUser(null);
      },
      setUser,
    }),
    [user, ready, start]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
