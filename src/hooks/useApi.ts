import { useCallback, useEffect, useRef, useState } from "react";

interface ApiState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** True only on the very first load — lets pages show skeletons vs. refetch spinners. */
  initialLoading: boolean;
  refetch: () => void;
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
}

/**
 * Runs an async loader and exposes the four states the requirements demand:
 * loading, success, error (with retry), and — handled by callers — empty.
 *
 * The loader must be a REAL API call; this hook never invents data.
 */
export function useApi<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: { enabled?: boolean } = {},
): ApiState<T> {
  const enabled = options.enabled ?? true;
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(enabled);
  const [initialLoading, setInitialLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setInitialLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setDataState(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (updater: T | ((prev: T | null) => T | null)) =>
      setDataState((prev) =>
        typeof updater === "function" ? (updater as (p: T | null) => T | null)(prev) : updater,
      ),
    [],
  );

  return { data, error, loading, initialLoading, refetch, setData };
}
