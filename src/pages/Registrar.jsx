import { useState } from 'react';
import { E, hashFile, hashTxt, SAMPLE } from '../chain.js';
import { useApp } from '../ctx.js';
import { sb, BUCKET } from '../supabase.js';

export default function Registrar() {
  const { act, note, addrOf } = useApp();
  const [f, setF] = useState({ id: '101', own: '', loc: 'Plot 101, Palm Ridge (fake data)', hash: '', fid: '101', why: 'Court order' });
  const [file, setFile] = useState(null);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const register = async () => {
    const id = Number(f.id), h = f.hash.trim(), owner = addrOf(f.own);
    if (!E.isAddress(owner)) return note(false, 'Register plot ' + id, 'The owner must be a full 0x… wallet address, not a name.', 'Check input');
    if (!/^0x[0-9a-fA-F]{64}$/.test(h)) return note(false, 'Register plot ' + id, 'Choose a deed file (or the sample) so the deed hash is filled in.', 'Check input');
    if (await act('Register plot ' + id, 'registerProperty', [id, owner, h, f.loc]) && sb && file) {
      const { error } = await sb.storage.from(BUCKET).upload(id + '/' + h, file, { upsert: true });
      error ? note(false, 'Upload deed file', error.message, 'Failed') : note(true, 'Upload deed file', 'Stored off-chain. Only the hash is on-chain.');
    }
  };
  return (
    <div className="grid">
      <section className="card" aria-labelledby="hr">
        <h2 id="hr">Register a plot</h2>
        <div className="row"><div><label htmlFor="rid">Plot ID</label><input id="rid" type="number" value={f.id} onChange={set('id')} /></div>
          <div><label htmlFor="rown">Owner wallet</label><input id="rown" value={f.own} onChange={set('own')} placeholder="0x…" /></div></div>
        <label htmlFor="rloc">Location</label><input id="rloc" style={{ width: '100%' }} value={f.loc} onChange={set('loc')} />
        <label htmlFor="rhash">Deed hash</label><input id="rhash" style={{ width: '100%' }} value={f.hash} onChange={set('hash')} placeholder="Choose a deed file or use the sample" />
        <div className="ctl" style={{ marginTop: 6 }}>
          <input type="file" aria-label="Deed file" onChange={async e => { const x = e.target.files[0]; if (x) { setFile(x); setF(v => ({ ...v, hash: '' })); const h = await hashFile(x); setF(v => ({ ...v, hash: h })) } }} />
          <button className="btn alt" style={{ margin: 0 }} onClick={() => { setFile(null); setF(v => ({ ...v, hash: hashTxt(SAMPLE) })) }}>Use sample deed</button>
        </div>
        <button className="btn" onClick={register}>Register plot</button>
      </section>
      <section className="card">
        <h2>Freeze or unfreeze</h2>
        <div className="row"><div><label htmlFor="fid">Plot ID</label><input id="fid" type="number" value={f.fid} onChange={set('fid')} /></div>
          <div><label htmlFor="why">Reason</label><input id="why" value={f.why} onChange={set('why')} /></div></div>
        <button className="btn" onClick={() => act('Freeze plot ' + f.fid, 'freezeProperty', [Number(f.fid), f.why])}>Freeze</button>{' '}
        <button className="btn alt" onClick={() => act('Unfreeze plot ' + f.fid, 'unfreezeProperty', [Number(f.fid)])}>Unfreeze</button>
        <p className="hint">Any wallet can press these. The contract refuses everyone but the registrar, which is the point of the demo.</p>
      </section>
    </div>
  );
}
