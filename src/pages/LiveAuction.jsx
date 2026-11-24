import { useState, useEffect, useRef } from 'react';
import { useRate } from '../fx.js';
import { useApp } from '../ctx.js';
import { W } from '../chain.js';

// Live open-bid auction, simulated in the browser (no contract calls).
// Prices are integers in milli-ETH to avoid floating point errors.
const MEMBERS = ['Bob', 'Carol', 'Dan'];
const STEPS = [50, 100, 500]; // AED
const aed = n => Math.round(n).toLocaleString('en-US');

const CSS = `
.lv-stage{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:14px 0 6px}
.lv-price{font:600 clamp(36px,6vw,52px)/1 "Source Serif 4",Georgia,serif;animation:lvpop .35s}
.lv-price small{font:400 16px "Source Sans 3",system-ui,sans-serif;color:var(--mute)}
.lv-ring{position:relative;width:56px;height:56px;flex:none;opacity:.35;transition:opacity .3s}
.lv-ring.on{opacity:1}
.lv-ring svg{transform:rotate(-90deg);display:block}
.lv-ring circle{fill:none;stroke-width:5}
.lv-ring .bg{stroke:var(--rule)}
.lv-ring .fg{stroke:var(--brand);stroke-linecap:round;stroke-dasharray:151}
.lv-ring.last .fg{stroke:var(--seal)}
.lv-ring.on .fg{animation:lvdrain 2s linear forwards}
.lv-ring b{position:absolute;inset:0;display:grid;place-items:center;font:600 22px "Source Serif 4",Georgia,serif}
.lv-ring.on b{animation:lvpop .35s}
.lv .btn:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
.lv .btn:disabled:hover{transform:none;background:var(--brand)}
@keyframes lvdrain{to{stroke-dashoffset:151}}
@keyframes lvpop{40%{transform:scale(1.12)}}
`;

export default function LiveAuction({ id }) {
  const [s, setS] = useState({ phase: 'idle', price: 0, leader: -1, count: 0, bump: 0 });
  const [base, setBase] = useState('1000');
  const [me, setMe] = useState(0);
  const [step, setStep] = useState(50);
  const [custom, setCustom] = useState('');
  const [log, setLog] = useState([]);
  const say = (ok, msg) => setLog(l => [{ ok, msg }, ...l].slice(0, 6));
  const { rate, live } = useRate(), toEth = n => (n / rate).toFixed(4);
  const { act, mode } = useApp(), sold = useRef(false), sim = mode === 'demo';

  // Countdown: 3, 2, 1 with two seconds each. A raise sets count back to 3 and bumps the effect.
  useEffect(() => {
    if (s.phase !== 'live' || s.count < 1) return;
    const t = setTimeout(() => setS(x => x.count <= 1 ? { ...x, phase: 'closed', count: 0 } : { ...x, count: x.count - 1 }), 2000);
    return () => clearTimeout(t);
  }, [s.phase, s.count, s.bump]);

  useEffect(() => {
    if (s.phase !== 'closed' || sold.current) return;
    sold.current = true;
    say(true, `Sold to ${MEMBERS[s.leader]} for AED ${aed(s.price)}. The plot now belongs to ${MEMBERS[s.leader]}.`);
    act(`Live auction sale: plot ${id} to ${MEMBERS[s.leader]}`, 'liveSale', [id, MEMBERS[s.leader], W((s.price / rate).toFixed(6))]);
  }, [s.phase]);

  const start = async () => {
    const b = Math.round(parseFloat(base));
    if (!sim) return say(false, 'The live auction is a simulation. Switch to Simulation mode to use it.');
    if (s.phase !== 'idle') return say(false, 'An auction is already running or finished. Reset to start again.');
    if (!(b > 0)) return say(false, 'Base price must be above 0.');
    if (!await act(`Lock plot ${id} for the live auction`, 'liveLock', [id])) return say(false, 'The plot can’t be auctioned now. Only its owner or the registrar can start, and it must not be frozen or in another auction.');
    sold.current = false;
    setS({ phase: 'live', price: b, leader: -1, count: 0, bump: 0 });
    say(true, `Auction started at AED ${aed(b)}.`);
  };

  const raise = () => {
    const amt = custom !== '' ? Math.round(parseFloat(custom)) : step;
    if (s.phase !== 'live') return say(false, 'No auction is running.');
    if (!(amt > 0)) return say(false, `${MEMBERS[me]}: raise amount must be above 0.`);
    if (me === s.leader) return say(false, `${MEMBERS[me]} already holds the highest bid.`);
    setS(x => ({ ...x, price: x.price + amt, leader: me, count: 3, bump: x.bump + 1 }));
    setCustom('');
    say(true, `${MEMBERS[me]} raised by AED ${aed(amt)} to AED ${aed(s.price + amt)}.`);
  };

  const reset = () => { if (s.phase === 'live') act(`Cancel live auction on plot ${id}`, 'liveUnlock', [id]); sold.current = false; setS({ phase: 'idle', price: 0, leader: -1, count: 0, bump: 0 }); setLog([]); };
  const ringOn = s.phase === 'live' && s.count > 0;
  const gap = { margin: '4px 0 8px' };

  return (
    <section className="card lv" aria-labelledby="hl">
      <style>{CSS}</style>
      <h2 id="hl">Live auction <span className="badge s1">Simulation</span></h2>
      <p className="hint">Open bidding for plot {id}. Simulation only. When the countdown ends, the last bidder wins and becomes the plot’s owner here. Rate: 1 ETH ≈ AED {aed(rate)} ({live ? 'live' : 'demo rate'}).</p>

      <div className="lv-stage">
        <div>
          <div className="lv-price" key={s.price} aria-live="polite">
            {s.phase === 'idle' ? '—' : <>{aed(s.price)} <small>AED · ≈ {toEth(s.price)} ETH</small></>}
          </div>
          <p className="hint" style={{ margin: '6px 0 0' }}>
            {s.phase === 'idle' ? 'Auction has not started.'
              : s.phase === 'closed' ? `Sold to ${MEMBERS[s.leader]}.`
              : s.leader < 0 ? 'Waiting for the first bid.' : `Highest bid: ${MEMBERS[s.leader]}`}
          </p>
        </div>
        <div className={'lv-ring' + (ringOn ? ' on' : '') + (ringOn && s.count === 1 ? ' last' : '')} aria-live="polite" aria-label="Countdown">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle className="bg" cx="28" cy="28" r="24" />
            <circle className="fg" key={s.bump + '-' + s.count} cx="28" cy="28" r="24" />
          </svg>
          <b key={s.count}>{s.phase === 'closed' ? '✓' : ringOn ? s.count : 3}</b>
        </div>
      </div>

      <h3>Registrar</h3>
      <div className="row"><div><label htmlFor="lvb">Base price (AED)</label><input id="lvb" value={base} onChange={e => setBase(e.target.value)} /></div></div>
      <button className="btn" onClick={start} disabled={s.phase !== 'idle' || !sim}>Start auction</button>{' '}
      <button className="btn alt" onClick={reset}>Reset demo</button>

      <h3>Participants</h3>
      <dl className="kv">
        {MEMBERS.map((m, i) => (
          <div key={m} style={{ display: 'contents' }}>
            <dt>{m}</dt><dd>{i === s.leader ? <span className="badge s1">Highest bid</span> : 'Registered'}</dd>
          </div>
        ))}
      </dl>

      <p className="hint">Bidding as</p>
      <div className="seg" style={gap} role="group" aria-label="Bidding as">
        {MEMBERS.map((m, i) => <button key={m} aria-pressed={i === me} onClick={() => setMe(i)}>{m}</button>)}
      </div>
      <p className="hint">Raise the bid by (AED)</p>
      <div className="seg" style={gap} role="group" aria-label="Raise amount">
        {STEPS.map(v => <button key={v} aria-pressed={v === step && custom === ''} onClick={() => { setStep(v); setCustom(''); }}>+{aed(v)}</button>)}
      </div>
      <div className="row"><div><label htmlFor="lvc">Or a custom amount</label><input id="lvc" value={custom} onChange={e => setCustom(e.target.value)} placeholder="e.g. 250" /></div></div>
      <button className="btn" onClick={raise} disabled={s.phase !== 'live'}>Raise bid</button>

      <h3>What happened</h3>
      {log.length === 0 ? <p className="empty">Every bid you try appears here, accepted or refused.</p> :
        <ul className="log">{log.map((e, k) => (
          <li key={k} className={e.ok ? '' : 'no'}>{e.ok ? <b>Accepted</b> : <span className="stamp">Refused</span>}<span>{e.msg}</span></li>
        ))}</ul>}
    </section>
  );
}
