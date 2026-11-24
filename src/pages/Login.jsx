import { Link } from 'react-router-dom';
import { useApp } from '../ctx.js';

export default function Login() {
  const { auth, login, logout, addr, setAddr, isRegistrar } = useApp();
  return (
    <div className="grid">
      <section className="card" aria-labelledby="hli">
        <h2 id="hli">{auth ? 'You are signed in' : 'Sign in with MetaMask'}</h2>
        {auth ? <>
          <dl className="kv"><dt>Wallet</dt><dd><code>{auth.address}</code></dd><dt>Role</dt><dd>{isRegistrar ? 'Registrar (land office)' : 'Participant'}</dd></dl>
          <p className="hint">Plot owners are recognised plot by plot, from the contract’s own record.</p>
          <Link className="btn" to="/">Browse plots</Link> <button className="btn alt" onClick={logout}>Sign out</button> <button className="btn alt" onClick={async () => { logout(); await login(true) }}>Use a different account</button>
        </> : <>
          <p>Your wallet is your account. There is no password to store or lose.</p>
          <label htmlFor="ca">Contract address</label>
          <input id="ca" style={{ width: '100%' }} value={addr} onChange={e => setAddr(e.target.value)} placeholder="0x… (from your testnet deployment)" />
          <button className="btn" onClick={() => login()}>Sign in with MetaMask</button>
        </>}
      </section>
      <section className="card">
        <h2>How sign-in works</h2>
        <ol>
          <li>MetaMask asks you to sign a short message. It shows your address, the network and a one-time nonce.</li>
          <li>The app checks the signature against your address. That proves you control the wallet.</li>
          <li>Signing costs no gas and moves no funds.</li>
          <li>The registrar is whichever wallet deployed the contract. Everyone else is a participant.</li>
        </ol>
        <p className="hint">Browsing plots, reading history and checking a deed need no sign-in. Bidding, listing and the land office do. The contract checks every action again, so a screen alone can’t grant any power.</p>
      </section>
    </div>
  );
}
