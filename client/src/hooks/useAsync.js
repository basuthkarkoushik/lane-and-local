import { useCallback, useEffect, useState } from 'react';

// Runs an API call and gives back { data, error, loading, reload }
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err) => setState({ data: null, error: err.message, loading: false }));
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}