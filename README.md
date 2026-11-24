# Plat: sealed-bid property auction app (React + Vite)

    npm install
    cp .env.example .env     # add contract address, optional Supabase URL and anon key
    npm run dev              # open the printed http://localhost:5173 address

Pages: Plots (home), Plot detail (history, deed check, auction), Land office (registrar).
"Simulation" runs the contract rules in the browser. "Live contract" uses MetaMask with the address from .env.
Supabase (optional): public bucket "property-files" that allows anon uploads. Files are stored as <plotId>/<deedHash>.

## Sign in
Wallet login: the user signs a message in MetaMask, the app verifies the signature, and the session lives in sessionStorage.
The registrar role is read from the contract (`registrar()`). Browsing and deed checks need no sign-in.
This is client-side only. For a production system, verify the signature on a server (for example a Supabase Edge Function) before issuing a session.

## Deployment
Sepolia (chain 11155111). Contract 0x75a3cf0b32f96e321c10d9bb16820fc35647f59e. Registrar 0x9c49F02037743E02fe05346e061cD014910FF7a5.
Browsing needs no wallet (public RPC). Sign-in switches MetaMask to Sepolia. Register plot 101 from the registrar account first.
