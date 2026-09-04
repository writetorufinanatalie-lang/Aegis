import { useEffect, useState } from "react";

/**
 * Minimal hash-based router. Gives every page a real, shareable, refreshable URL
 * (#/overview, #/business/portfolio, ...) and a genuine "not found" state for any hash
 * that doesn't match a known page, instead of silently doing nothing or showing a blank screen.
 */
export function currentHashSegment(): string {
  return window.location.hash.replace(/^#\/?/, "").split("?")[0];
}

export function useHashRoute<T extends string>(validPages: readonly T[], defaultPage: T): [T | "not-found", (page: T) => void] {
  const resolve = (): T | "not-found" => {
    const raw = currentHashSegment();
    if (!raw) return defaultPage;
    return (validPages as readonly string[]).includes(raw) ? (raw as T) : "not-found";
  };
  const [page, setPageState] = useState<T | "not-found">(resolve);
  useEffect(() => {
    const onHashChange = () => setPageState(resolve());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const navigate = (next: T) => {
    if (currentHashSegment() === next) { setPageState(next); return; }
    window.location.hash = `/${next}`;
  };
  return [page, navigate];
}
