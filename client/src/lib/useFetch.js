import { useEffect, useState } from 'react';
import { api } from './api.js';

// Loads `path` whenever it changes. Pass null to skip.
export default function useFetch(path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });

  useEffect(() => {
    if (!path) return undefined;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { signal: ctrl.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, error, loading: false });
      });
    return () => ctrl.abort();
  }, [path]);

  return { ...state, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}
