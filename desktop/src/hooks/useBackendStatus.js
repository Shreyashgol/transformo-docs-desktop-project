import { useCallback, useEffect, useState } from 'react';

/** Live backend status pushed from the main process, plus a restart action. */
export function useBackendStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = window.transformo.backend.onStatusChange((next) => {
      if (active) setStatus(next);
    });
    void window.transformo.backend.getStatus().then((initial) => {
      // A pushed update may already have arrived; keep whichever is newer.
      if (active) setStatus((prev) => (prev && prev.since >= initial.since ? prev : initial));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const restart = useCallback(async () => {
    setStatus({ state: 'starting', since: Date.now() });
    setStatus(await window.transformo.backend.restart());
  }, []);

  return { status, restart };
}
