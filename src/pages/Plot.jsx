import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { C, F, W, sh, SN, SAMPLE, rnd, hashFile, hashTxt, secretKey, loadSecret, saveSecret, why, runDemo } from '../chain.js';
import { useApp, useData, useNow } from '../ctx.js';
import { sb, BUCKET } from '../supabase.js';

const dt = t => new Date(Number(t) * 1000).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const COL = ['var(--line)', 'var(--amber)', 'var(--seal)'], DASH = ['', '9 6', '2 6'];

function Parcel({ id, st }) {
  const pts = [[14, 22], [150, 10], [206, 48], [188, 104], [40, 110]];
  return (<svg className="parcel" viewBox="0 0 220 120" role="img" aria-label={'Parcel boundary, ' + SN[st]}>
    <path d="M14 22 L150 10 L206 48 L188 104 L40 110 Z" fill="none" stroke={COL[st]} strokeWidth="3" strokeDasharray={DASH[st]} />
    {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={COL[st]} />)}
    <text x="104" y="66" textAnchor="middle" fontFamily="Spectral,serif" fontSize="20" fill="currentColor">Plot {id}</text></svg>);
}

function Verify({ id }) {
  const [r, setR] = useState();
  const check = async h => { try { setR({ ok: await C('verifyDeed', 0n, id, h), h }) } catch (e) { setR({ err: why(e) }) } };
  return (<>
    <h3>Check a deed</h3>
    <p className="hint">Pick a file. It is hashed in your browser and compared with the registered hash. The file never leaves your device.</p>
    <input type="file" aria-label="Deed file" onChange={async e => e.target.files[0] && check(await hashFile(e.target.files[0]))} />
    <div className="chips" style={{ marginTop: 6 }}>
      <button className="btn alt" onClick={() => check(hashTxt(SAMPLE))}>Try the sample deed</button>
      <button className="btn alt" onClick={() => check(hashTxt(SAMPLE.replace('Plot 101', 'Plot 110')))}>Try an edited copy</button>
    </div>
    {r && <div className={'res ' + (r.err || !r.ok ? 'bad' : 'good')} aria-live="polite">
      {r.err || <><b>{r.ok ? 'Genuine: matches the registered deed.' : 'Does not match the registered deed.'}</b><br /><code>{r.h}</code></>}</div>}
  </>);
}

export default function Plot() {
  const id = Number(useParams().id), { who, me } = useApp();
  const p = useData(() => C('properties', 0n, id), [id]), h = useData(() => C('getHistory', 0n, id), [id]);
  return (
    <div className="grid">
      <section className="card" aria-labelledby="hp">
        <h2 id="hp">Plot {id}</h2>
        {p === undefined ? <p className="empty">Loading…</p> : !p?.exists ? <p className="empty">No plot {id} is registered yet.</p> : <>
          <Parcel id={id} st={Number(p.status)} />
          <dl className="kv"><dt>Status</dt><dd><span className={'badge s' + p.status}>{SN[p.status]}</span>{Number(p.status) === 1 && ' Listing is locked. A second sale is refused.'}</dd>
            <dt>Owner</dt><dd>{who(p.owner)} <code>{sh(p.owner)}</code></dd><dt>Location</dt><dd>{p.location}</dd>
            <dt>Deed hash</dt><dd><code>{p.deedHash}</code>{sb && <> <a href={sb.storage.from(BUCKET).getPublicUrl(id + '/' + p.deedHash).data.publicUrl} target="_blank" rel="noreferrer">Open deed file</a></>}</dd></dl></>}
        <h3>History</h3>
        <ol className="tl">{(h || []).map((e, k) => <li key={k} className={e.kind === 'SOLD' ? 'sold' : ''}>
          <b>{e.kind === 'SOLD' ? `Sold for ${F(e.price)} ETH` : e.kind[0] + e.kind.slice(1).toLowerCase()}</b>
          {e.kind === 'REGISTERED' ? ` to ${who(e.to)}` : e.kind === 'SOLD' ? ` to ${who(e.to)} from ${who(e.from)}` : ''}
          <small>{dt(e.timestamp)}{e.auctionId > 0n && ` · auction ${e.auctionId}`}</small></li>)}</ol>
        <Verify id={id} />
      </section>
      <section className="card">
        <h2>Auction</h2>
        {p?.exists && String(me || '').toLowerCase() === String(p.owner).toLowerCase()
          ? <><p className="hint">You own this plot. Set the price and run the auction on its own page.</p>
              <Link className="btn" to={'/plot/' + id + '/auction'}>Open auction page</Link></>
          : <p className="hint">Only the plot’s owner can set up an auction for it.</p>}
      </section>
    </div>
  );
}
