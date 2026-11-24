import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { C, F, W, rnd, secretKey, loadSecret, saveSecret, why, runDemo } from '../chain.js';
import { useApp, useData, useNow } from '../ctx.js';
import LiveAuction from './LiveAuction.jsx';
import { useRate, aedToEth, fmtAed } from '../fx.js';

const HINT = ['Bids are sealed. Only a hash and a deposit are public.', 'Bidders prove their bid. A different amount is rejected.', 'The reveal window is over. Anyone can settle.', 'Settled. Ownership moved and the sale is in the history.'];
const left = s => { s = Number(s); return s > 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 60)}m ${s % 60}s` };

function Auction({ id, isOwner }) {
  const { me, act, note, who, mode, log = [] } = useApp(), now = useNow(), last = log[0];
  const demo = async () => { runDemo(id).forEach(x => note(x.ok, x.label, x.msg)); await act('Full demo auction finished', 'noop', []) };
  const { rate, live } = useRate(), A = w => fmtAed(Number(w) / 1e18 * rate);
  const cur = useData(async () => { const n = Number(await C('auctionCount', 0n)); for (let i = n; i >= 1; i--) { const a = await C('auctions', 0n, i); if (Number(a.propertyId) === id) return { a, i } } return null }, [id]);
  const bid = useData(async () => cur ? C('bids', 0n, cur.i, me) : null, [cur?.i, me]);
  const [f, setF] = useState({ mb: '20', cs: '3600', rs: '3600', amt: '0.3', dep: '', ramt: '', rsec: '' });
  const [sec, setSec] = useState(rnd);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const i = cur?.i || 0, key = secretKey(i, me);
  useEffect(() => { const s = loadSecret(key); if (s) { setSec(s.secret); setF(x => ({ ...x, ramt: s.amount, rsec: s.secret })) } else setF(x => ({ ...x, ramt: '', rsec: '' })) }, [key]);
  const a = cur?.a, t = BigInt(now), ph = !a ? null : a.cancelled ? -1 : a.settled ? 3 : t < a.commitEnd ? 0 : t < a.revealEnd ? 1 : 2;
  const safe = (label, fn) => async () => { try { await fn() } catch (e) { note(false, label, why(e)) } };
  const list = safe('List plot ' + id, () => act('List plot ' + id, 'createAuction', [id, W(aedToEth(f.mb, rate)), BigInt(f.cs), BigInt(f.rs)]));
  const commit = safe('Commit sealed bid', async () => {
    const amt = W(f.amt), dep = f.dep.trim() ? W(f.dep) : amt, c = await C('makeCommitment', 0n, i, me, amt, sec);
    saveSecret(key, { amount: f.amt, secret: sec }); await act('Commit sealed bid', 'commitBid', [i, c], dep);
  });
  const reveal = safe('Reveal bid', () => act('Reveal bid', 'revealBid', [i, W(f.ramt), f.rsec.trim()]));
  const B = (label, name, cls = 'btn alt') => <button className={cls} onClick={() => act(label, name, [i])}>{label}</button>;
  return (
    <section className="card" aria-labelledby="ha">
      <h2 id="ha">Auction{cur ? ' ' + i : ''}</h2>
      <details className="hint" style={{ marginBottom: 8 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>What do commit and reveal mean?</summary>
        <p><b>Commit</b> is putting your bid in a sealed envelope. You send a scrambled fingerprint of your amount plus a secret, and a deposit. Nobody, not even the seller, can see the amount.</p>
        <p><b>Reveal</b> is opening the envelope after bidding closes. You send the real amount and your secret. The contract checks they match the fingerprint, so you can’t change your bid after seeing others.</p>
        <p><b>Settle</b> picks the highest revealed bid, moves the plot to that bidder and records the sale. Then everyone claims their money back and the seller claims the price.</p>
      </details>
      {mode === 'demo' && <p className="hint">Short on time? <button className="btn alt" style={{ margin: '0 0 0 6px' }} onClick={demo}>Run a full demo auction</button></p>}
      {ph === null && <p className="empty">This plot has no auction yet. The owner can list it below.</p>}
      {ph === -1 && <span className="badge s2">Cancelled</span>}
      {a && ph >= 0 && <>
        <div className="steps">{['Commit sealed bids', 'Reveal', 'Settle'].map((l, k) => <div key={l} className={k < ph ? 'done' : k === ph ? 'on' : ''}>{l}</div>)}</div>
        <p className="hint">{HINT[ph]} {ph === 0 ? 'Commit closes in ' + left(a.commitEnd - t) : ph === 1 ? 'Reveal closes in ' + left(a.revealEnd - t) : ''}</p>
        <dl className="kv"><dt>Seller</dt><dd>{who(a.seller)}</dd><dt>Minimum bid</dt><dd>{F(a.minBid)} ETH (≈ {A(a.minBid)})</dd><dt>Deposits held</dt><dd>{F(a.totalDeposits)} ETH</dd>
          {(a.revealedDeposits > 0n || ph >= 2) && <><dt>Highest revealed</dt><dd>{a.highestBid > 0n ? `${F(a.highestBid)} ETH (≈ ${A(a.highestBid)}) by ${who(a.highestBidder)}` : 'none'}</dd></>}
          <dt>You</dt><dd>{bid?.deposit > 0n ? `Committed ${F(bid.deposit)} ETH${bid.revealed ? ', revealed' : ', not revealed'}${bid.refunded ? ', refunded' : ''}.` : 'No bid in this auction.'}</dd></dl></>}
      {isOwner ? <>
      <h3>Seller</h3>
      <div className="row"><div><label htmlFor="mb">Minimum bid (AED)</label><input id="mb" value={f.mb} onChange={set('mb')} /></div>
        <div><label htmlFor="cs">Commit (sec)</label><input id="cs" value={f.cs} onChange={set('cs')} /></div>
        <div><label htmlFor="rs">Reveal (sec)</label><input id="rs" value={f.rs} onChange={set('rs')} /></div></div>
      <p className="hint">Sends {aedToEth(f.mb, rate)} ETH. Rate: 1 ETH ≈ {fmtAed(rate)} ({live ? 'live' : 'demo rate'}), locked when you list.</p>
      <p className="hint">Commit and reveal windows are in seconds. Use 600 or more so you have time to click through by hand, or use the Demo skip buttons.</p>
      <button className="btn" onClick={list}>List for auction</button> {B('Cancel auction', 'cancelAuction')} {B('Demo: skip to reveal', 'demoSkipToReveal')} {B('Demo: skip to end', 'demoSkipToEnd')}
      </> : <p className="hint">Only the plot’s owner can list or cancel the auction. As a bidder, use the commit and reveal steps below.</p>}
      <h3>Bidder: commit</h3>
      <div className="row"><div><label htmlFor="amt">Bid (ETH)</label><input id="amt" value={f.amt} onChange={set('amt')} /></div>
        <div><label htmlFor="dep">Deposit (ETH)</label><input id="dep" value={f.dep} onChange={set('dep')} placeholder="same as bid" /></div></div>
      <label htmlFor="sec">Secret (needed to reveal; keep it)</label>
      <div className="ctl"><input id="sec" size={28} readOnly value={sec} /><button className="btn alt" style={{ margin: 0 }} onClick={() => navigator.clipboard?.writeText(sec)}>Copy</button><button className="btn alt" style={{ margin: 0 }} onClick={() => setSec(rnd())}>New</button></div>
      <button className="btn" onClick={commit}>Commit sealed bid</button>
      <h3>Bidder: reveal</h3>
      <div className="row"><div><label htmlFor="ramt">Amount (ETH)</label><input id="ramt" value={f.ramt} onChange={set('ramt')} /></div>
        <div><label htmlFor="rsec">Secret</label><input id="rsec" value={f.rsec} onChange={set('rsec')} /></div></div>
      <button className="btn" onClick={reveal}>Reveal bid</button>
      <h3>Finish</h3>
      {B('Settle auction', 'settle', 'btn')} {B('Claim refund', 'claimRefund')} {B('Claim proceeds', 'claimProceeds')}
      {last && <div className={'res ' + (last.ok ? 'good' : 'bad')} aria-live="polite"><b>Last action: {last.label}</b><br />{last.ok ? 'Accepted' + (last.msg ? ': ' + last.msg : '') : 'Refused: ' + last.msg}</div>}
    </section>
  );
}

export default function AuctionPage() {
  const id = Number(useParams().id), { who, me } = useApp();
  const p = useData(() => C('properties', 0n, id), [id]);
  if (p === undefined) return <section className="card"><h2>Plot {id}</h2><p className="empty">Loading…</p></section>;
  if (!p?.exists) return <section className="card"><h2>Plot {id}</h2><p className="empty">No plot {id} is registered yet.</p><Link className="btn" to="/">Back to plots</Link></section>;
  if (String(me || '').toLowerCase() !== String(p.owner).toLowerCase()) return (
    <section className="card" aria-labelledby="hb">
      <h2 id="hb">Auction for plot {id}</h2>
      <p className="empty">Only the owner can open the auction page. {me ? <>You are acting as {who(me)}, and this plot belongs to {who(p.owner)}.</> : 'Sign in as the owner to open it.'}</p>
      <Link className="btn" to="/">Back to plots</Link>
    </section>
  );
  const isOwner = true;
  return (
    <>
      <p style={{ margin: '0 0 12px' }}><Link to={'/plot/' + id}>← Plot {id}</Link></p>
      <div className="grid"><Auction id={id} isOwner={isOwner} /><LiveAuction id={id} /></div>
    </>
  );
}
