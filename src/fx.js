import { useState, useEffect } from 'react';

// ETH to AED rate. Tries a live price, falls back to a fixed demo rate so the demo never breaks.
// Change FALLBACK to whatever rate you want to show if the live fetch fails.
export const FALLBACK = 11000;
let cache = null;

export function useRate() {
  const [r, setR] = useState(cache ? { rate: cache.rate, live: true } : { rate: FALLBACK, live: false });
  useEffect(() => {
    if (cache && Date.now() - cache.t < 60000) return;
    let off = false;
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=aed')
      .then(x => x.json())
      .then(d => { const v = d?.ethereum?.aed; if (v > 0) { cache = { rate: v, t: Date.now() }; if (!off) setR({ rate: v, live: true }); } })
      .catch(() => {});
    return () => { off = true; };
  }, []);
  return r;
}

export const aedToEth = (aed, rate) => { const n = parseFloat(aed); return n > 0 && rate > 0 ? (n / rate).toFixed(6) : '0'; };
export const fmtAed = n => 'AED ' + Math.round(n).toLocaleString('en-US');
