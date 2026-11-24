import { createContext, useContext, useEffect, useState } from 'react';
export const Ctx = createContext();
export const useApp = () => useContext(Ctx);
// undefined = loading, null = nothing/failed
export function useData(fn, deps = []) {
  const { tick } = useApp(); const [d, setD] = useState();
  useEffect(() => { let ok = true; Promise.resolve().then(fn).then(x => ok && setD(x), () => ok && setD(null)); return () => { ok = false }; }, [tick, ...deps]);
  return d;
}
export function useNow() {
  const [n, setN] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => { const t = setInterval(() => setN(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t) }, []);
  return n;
}
