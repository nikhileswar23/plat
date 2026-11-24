import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { C, SN, sh, eq, Z } from '../chain.js';
import { useApp, useData } from '../ctx.js';

export default function Home() {
  const { mode, who, me } = useApp(), nav = useNavigate(), [id, setId] = useState('');
  const rows = useData(async () => { const { listPlots } = await import('../chain.js'); return Promise.all((await listPlots()).map(async id => ({ id, p: await C('properties', 0n, id) }))) }, [mode]);
  return (<>
    <section className="hero">
      <p>Plat sells land by sealed-bid auction. Bids stay secret until the reveal, a listed plot can’t be sold twice, and every owner and price stays in a public history.</p>
      <form className="bar" onSubmit={e => { e.preventDefault(); id && nav('/plot/' + id) }}>
        <input type="number" min="1" value={id} onChange={e => setId(e.target.value)} placeholder="Plot ID" aria-label="Plot ID" />
        <button className="btn" style={{ margin: 0 }}>Open plot</button>
      </form>
    </section>
    <h3>Registered plots</h3>
    <div className="plots">
      {rows?.length ? rows.map(({ id, p }) => (
        <div key={id} className="card pcard">
          <Link to={'/plot/' + id} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
            <b>Plot {id}</b> <span className={'badge s' + p.status}>{SN[p.status]}</span>
            <p className="hint">{p.location}<br />Owner {who(p.owner)} <code>{sh(p.owner)}</code></p>
          </Link>
          {!eq(me, Z) && String(me || '').toLowerCase() === String(p.owner).toLowerCase() &&
            <Link className="btn" to={'/plot/' + id + '/auction'}>Auction</Link>}
        </div>)) : <p className="empty">{rows === undefined ? 'Loading…' : (mode === 'live' ? 'No plots are registered on this contract yet. The registrar can add plot 101 in the Land office, or open a plot above by its ID.' : 'No plots yet.')}</p>}
    </div>
  </>);
}
