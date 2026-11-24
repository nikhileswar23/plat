import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { S, ACC, E, C, ABI, why, F, sh, eq, Z, CONTRACT, SEPOLIA_HEX, simOwners } from './chain.js';
import { Ctx } from './ctx.js';
import Home from './pages/Home.jsx';
import Plot from './pages/Plot.jsx';
import AuctionPage from './pages/AuctionPage.jsx';
import Registrar from './pages/Registrar.jsx';
import Login from './pages/Login.jsx';

const addrOf = s => { s = s.trim(); const k = Object.keys(ACC).find(k => k.toLowerCase() === s.toLowerCase()); return k ? ACC[k] : s };
const KEY = 'plat:auth';
const saved = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) } catch (e) { return null } };

export default function App() {
  const [mode, setMode] = useState('live'), [role, setRole] = useState('Alice');
  const [addr, setAddr] = useState(CONTRACT), [auth, setAuth] = useState(saved);
  const [reg, setReg] = useState(null), [regErr, setRegErr] = useState(''), [tick, setTick] = useState(0), [log, setLog] = useState([]);
  const me = mode === 'demo' ? ACC[role] : (auth?.address || Z); S.mode = mode; S.me = me;
  const isRegistrar = mode === 'demo' ? role === 'Registrar' : !!(auth && reg && eq(reg, auth.address));
  const bump = () => setTick(t => t + 1);
  const loc = useLocation();
  const note = (ok, label, msg = '', stamp = 'Refused') => setLog(l => [{ ok, label, msg, stamp, id: Math.random() }, ...l].slice(0, 10));

  const login = async (choose) => {
    try {
      if (!window.ethereum) throw new Error('MetaMask not found. Install it from metamask.io, then reload this page.');
      try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_HEX }] }) }
      catch (e) { throw new Error('Please switch MetaMask to the Sepolia test network, then try again.') }
      if (choose === true) await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      const provider = new E.BrowserProvider(window.ethereum), sg = await provider.getSigner(), a = await sg.getAddress();
      const net = await provider.getNetwork();
      const msg = `Plat wants you to sign in with your wallet.\n\nAddress: ${a}\nChain ID: ${net.chainId}\nNonce: ${E.hexlify(E.randomBytes(8))}\nIssued at: ${new Date().toISOString()}`;
      const sig = await sg.signMessage(msg);
      if (!eq(E.verifyMessage(msg, sig), a)) throw new Error('The signature did not match this wallet.');
      if (addr.trim()) S.ct = new E.Contract(addr.trim(), ABI, sg);
      const s = { address: a, issued: Date.now() }; sessionStorage.setItem(KEY, JSON.stringify(s));
      setAuth(s); setMode('live'); note(true, 'Sign in', sh(a)); bump();
    } catch (e) { note(false, 'Sign in', why(e), 'Failed') }
  };
  const logout = () => { sessionStorage.removeItem(KEY); S.ct = null; setAuth(null); setReg(null); note(true, 'Sign out'); bump() };

  // Restore a session after reload without prompting again; drop it if the wallet account changed.
  useEffect(() => {
    const s = saved(); if (!s || !window.ethereum) return;
    const p = new E.BrowserProvider(window.ethereum);
    p.listAccounts().then(async accs => {
      const a = accs.find(x => eq(x.address, s.address));
      if (!a) return logout();
      if (addr.trim()) S.ct = new E.Contract(addr.trim(), ABI, await p.getSigner()); bump();
    }, () => {});
  }, []);
  useEffect(() => {
    const eth = window.ethereum; if (!eth?.on) return;
    const h = () => { if (saved()) logout() };
    const r = () => window.location.reload(); eth.on('accountsChanged', h); eth.on('chainChanged', r); return () => { eth.removeListener('accountsChanged', h); eth.removeListener('chainChanged', r) };
  }, []);
  useEffect(() => { if (mode === 'live' && auth && S.ct) C('registrar', 0n).then(r => { setReg(r); setRegErr('') }, e => { setReg(null); setRegErr(why(e)) }); else setReg(null) }, [mode, auth, tick]);

  const act = async (label, name, args, v = 0n) => {
    if (mode === 'live' && !auth) { note(false, label, 'Sign in with MetaMask first.', 'Sign in'); return false }
    try { const r = await C(name, v, ...args); note(true, label, typeof r === 'bigint' ? F(r) + ' ETH paid out' : ''); bump(); return true }
    catch (e) { note(false, label, why(e)); bump(); return false }
  };
  const who = a => eq(a, Z) ? 'none' : mode === 'live' && eq(a, me) ? 'You' : Object.keys(ACC).find(k => eq(ACC[k], a)) || sh(a);

  return (
    <Ctx.Provider value={{ mode, me, tick, act, note, who, addrOf, auth, login, logout, addr, setAddr, isRegistrar, log, bump }}>
      <div className="topo" aria-hidden="true" />
      <header>
        <Link to="/" className="brand"><svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><path d="M5 12 L24 5 L35 16 L31 33 L9 35 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="20" cy="21" r="4" fill="currentColor" /></svg><div><h1>Plat</h1><span>Sealed-bid property auctions</span></div></Link>
        <nav className="nav"><NavLink to="/" end>Plots</NavLink><NavLink to="/registrar">Land office</NavLink></nav>
        <div className="ctl">
          <div className="seg" role="group" aria-label="Mode">
            <button aria-pressed={mode === 'demo'} onClick={() => setMode('demo')}>Simulation</button>
            <button aria-pressed={mode === 'live'} onClick={() => setMode('live')}>Live contract</button>
          </div>
          {mode === 'demo'
            ? <><label htmlFor="who" style={{ margin: 0 }}>Acting as</label>
                <select id="who" value={role} onChange={e => setRole(e.target.value)}>
                  {Object.keys(ACC).map(n => <option key={n} value={n}>{n}{simOwners().has(ACC[n]) ? ' (owner)' : ''}</option>)}
                </select></>
            : auth
              ? <span className="who"><Link to="/login"><span className="badge s0">{isRegistrar ? 'Registrar' : 'Signed in'} {sh(auth.address)}</span></Link><button className="btn alt" style={{ margin: 0 }} onClick={logout}>Sign out</button></span>
              : <Link className="btn" style={{ margin: 0 }} to="/login">Sign in with MetaMask</Link>}
        </div>
      </header>
      <main>
        <div className="page" key={loc.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plot/:id" element={<Plot />} />
          <Route path="/plot/:id/auction" element={<AuctionPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registrar" element={mode === 'live' && !isRegistrar
            ? <section className="card"><h2>Land office</h2><p>This area is for the registrar wallet. {auth ? 'The wallet you signed in with is not the registrar.' : 'Sign in with the registrar wallet to continue.'}</p>
              {auth && <dl className="kv"><dt>Contract in use</dt><dd><code>{addr}</code></dd><dt>Its registrar</dt><dd>{reg ? <code>{reg}</code> : 'Could not be read from this address. Check it is the contract (not a wallet) deployed on Sepolia. ' + regErr}</dd><dt>Your wallet</dt><dd><code>{auth.address}</code></dd></dl>}{!auth && <Link className="btn" to="/login">Sign in with MetaMask</Link>}</section>
            : <Registrar />} />
        </Routes>
        </div>
        <section className="card" style={{ margin: '16px 0 24px' }} aria-labelledby="hl">
          <h2 id="hl">What the contract did</h2>
          {log.length === 0 && <p className="empty">Every action you try appears here, accepted or refused.</p>}
          <ul className="log" aria-live="polite">
            {log.map(l => <li key={l.id} className={l.ok ? '' : 'no'}>
              {!l.ok && <span className="stamp new">{l.stamp}</span>}
              <div><b>{l.label}</b><br />{l.ok ? 'Accepted' + (l.msg ? ': ' + l.msg : '') : l.msg}</div>
            </li>)}
          </ul>
        </section>
      </main>
    </Ctx.Provider>
  );
}
