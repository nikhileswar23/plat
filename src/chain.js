import { ethers as E } from 'ethers';
export { E };
export const Z=E.ZeroAddress,W=x=>E.parseEther(String(x||0).trim()||'0'),F=x=>E.formatEther(x),sh=a=>a.slice(0,6)+'…'+a.slice(-4);
export const now=()=>Math.floor(Date.now()/1000);const T=()=>BigInt(now());
export const eq=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
export const ACC={Registrar:'0x'+'a1'.repeat(20),Alice:'0x'+'a2'.repeat(20),Bob:'0x'+'b3'.repeat(20),Carol:'0x'+'c4'.repeat(20),Dan:'0x'+'d5'.repeat(20)};
export const SAMPLE='Deed of transfer: Plot 101, Palm Ridge (sample, fake data)';
export const SN=['Available','In auction','Frozen'];
export const S={mode:'demo',me:ACC.Alice,ct:null};
/* ---------- in-browser simulation of PropertyAuction.sol ---------- */
const M={p:{},h:{},a:{},b:{},n:0};
const R=(c,m)=>{if(!c)throw new Error(m)};
const hist=(id,k,f,t,p,a)=>(M.h[id]??=[]).push({kind:k,from:f,to:t,price:p,timestamp:T(),auctionId:BigInt(a)});
M.p[101]={owner:ACC.Alice,deedHash:E.keccak256(E.toUtf8Bytes(SAMPLE)),location:'Plot 101, Palm Ridge (fake data)',status:0,exists:true};
M.h[101]=[{kind:'REGISTERED',from:Z,to:ACC.Alice,price:0n,timestamp:T()-2592000n,auctionId:0n}];
const MOCK={
 registrar:()=>ACC.Registrar,
 noop:()=>{},
 liveLock(me,v,id){const p=M.p[id];R(p&&p.exists,'No such plot');R(me===p.owner||me===ACC.Registrar,'Only the owner or the registrar can start an auction');R(p.status!==2,'Plot frozen');R(p.status===0,'Plot locked in auction');p.status=1;p.live=true},
 liveUnlock(me,v,id){const p=M.p[id];R(p&&p.live,'No live auction on this plot');p.status=0;p.live=false},
 liveSale(me,v,id,buyer,price){const p=M.p[id];R(p&&p.live,'No live auction on this plot');R(ACC[buyer],'Unknown buyer');const old=p.owner;p.owner=ACC[buyer];p.status=0;p.live=false;hist(id,'SOLD',old,ACC[buyer],price,0)},
 properties:(_,v,id)=>M.p[id]?{...M.p[id]}:{exists:false},auctionCount:()=>M.n,
 auctions:(_,v,i)=>M.a[i]?{...M.a[i]}:{seller:Z},
 bids:(_,v,i,a)=>({...(M.b[i]?.[a.toLowerCase()]||{deposit:0n})}),
 getHistory:(_,v,id)=>[...(M.h[id]||[])],
 verifyDeed:(_,v,id,h)=>{R(M.p[id],'No such plot');return M.p[id].deedHash===h},
 makeCommitment:(_,v,i,b,amt,s)=>E.solidityPackedKeccak256(['uint256','address','uint256','bytes32'],[i,b,amt,s]),
 registerProperty(me,v,id,o,h,l){R(me===ACC.Registrar,'Only registrar');R(!M.p[id],'Plot already exists');R(o!==Z,'Bad owner');M.p[id]={owner:o,deedHash:h,location:l,status:0,exists:true};hist(id,'REGISTERED',Z,o,0n,0)},
 freezeProperty(me,v,id){const p=M.p[id];R(me===ACC.Registrar,'Only registrar');R(p,'No such plot');R(p.status===0,'Plot not available');p.status=2;hist(id,'FROZEN',p.owner,p.owner,0n,0)},
 unfreezeProperty(me,v,id){const p=M.p[id];R(me===ACC.Registrar,'Only registrar');R(p,'No such plot');R(p.status===2,'Not frozen');p.status=0;hist(id,'UNFROZEN',p.owner,p.owner,0n,0)},
 createAuction(me,v,id,min,cs,rs){const p=M.p[id];R(p,'No such plot');R(me===p.owner,'Not the owner');R(p.status!==2,'Plot frozen');R(p.status===0,'Plot locked in auction');R(min>0n,'Min bid must be > 0');R(cs>0n&&rs>0n,'Bad durations');p.status=1;const t=T();M.a[++M.n]={propertyId:BigInt(id),seller:me,minBid:min,commitEnd:t+cs,revealEnd:t+cs+rs,totalDeposits:0n,revealedDeposits:0n,highestBid:0n,highestBidder:Z,settled:false,cancelled:false,proceedsClaimed:false}},
 commitBid(me,v,i,c){const a=M.a[i];R(a,'No such auction');R(!a.cancelled,'Auction cancelled');R(T()<a.commitEnd,'Bidding closed');R(me!==a.seller,'Seller cannot bid');R(v>=a.minBid,'Deposit below minimum');R(!(M.b[i]?.[me]?.deposit>0n),'Already committed');(M.b[i]??={})[me]={commitment:c,deposit:v,revealed:false,refunded:false};a.totalDeposits+=v},
 revealBid(me,v,i,amt,s){const a=M.a[i];R(a,'No such auction');R(!a.cancelled,'Auction cancelled');R(T()>=a.commitEnd,'Reveal not open');R(T()<a.revealEnd,'Reveal closed');const b=M.b[i]?.[me];R(b&&b.deposit>0n,'No bid found');R(!b.revealed,'Already revealed');R(MOCK.makeCommitment(0,0,i,me,amt,s)===b.commitment,'Hash mismatch');R(amt<=b.deposit,'Deposit too low');R(amt>=a.minBid,'Below minimum');b.revealed=true;a.revealedDeposits+=b.deposit;if(amt>a.highestBid){a.highestBid=amt;a.highestBidder=me}},
 settle(me,v,i){const a=M.a[i];R(a,'No such auction');R(!a.cancelled,'Auction cancelled');R(!a.settled,'Already settled');R(T()>=a.revealEnd,'Auction not finished');a.settled=true;const p=M.p[a.propertyId];p.status=0;if(a.highestBidder!==Z){const o=p.owner;p.owner=a.highestBidder;hist(a.propertyId,'SOLD',o,a.highestBidder,a.highestBid,i)}},
 cancelAuction(me,v,i){const a=M.a[i];R(a,'No such auction');R(me===a.seller,'Only seller');R(!a.cancelled&&!a.settled,'Already finished');R(T()<a.commitEnd,'Bidding closed');R(a.totalDeposits===0n,'Bids already placed');a.cancelled=true;M.p[a.propertyId].status=0},
 claimRefund(me,v,i){const a=M.a[i];R(a?.settled,'Auction not finished');const b=M.b[i]?.[me];R(b&&b.deposit>0n,'Not your deposit');R(b.revealed,'Deposit forfeited');R(!b.refunded,'Already refunded');b.refunded=true;return b.deposit-(me===a.highestBidder?a.highestBid:0n)},
 claimProceeds(me,v,i){const a=M.a[i];R(a&&me===a.seller,'Only seller');R(a.settled,'Auction not finished');R(!a.proceedsClaimed,'Already claimed');a.proceedsClaimed=true;return a.highestBid+a.totalDeposits-a.revealedDeposits},
 demoSkipToReveal(me,v,i){const a=M.a[i];R(a&&me===a.seller,'Only seller');if(a.commitEnd>T())a.commitEnd=T()},
 demoSkipToEnd(me,v,i){const a=M.a[i];R(a&&me===a.seller,'Only seller');if(a.commitEnd>T())a.commitEnd=T();if(a.revealEnd>T())a.revealEnd=T()}
};
/* ---------- live contract ---------- */
const ABI=['function registrar() view returns (address)','event PropertyRegistered(uint256 indexed propertyId,address indexed owner,bytes32 deedHash,string location)','function properties(uint256) view returns (address owner,bytes32 deedHash,string location,uint8 status,bool exists)','function auctionCount() view returns (uint256)','function auctions(uint256) view returns (uint256 propertyId,address seller,uint256 minBid,uint256 commitEnd,uint256 revealEnd,uint256 totalDeposits,uint256 revealedDeposits,uint256 highestBid,address highestBidder,bool settled,bool cancelled,bool proceedsClaimed)','function bids(uint256,address) view returns (bytes32 commitment,uint256 deposit,bool revealed,bool refunded)','function getHistory(uint256) view returns (tuple(string kind,address from,address to,uint256 price,uint256 timestamp,uint256 auctionId)[])','function verifyDeed(uint256,bytes32) view returns (bool)','function makeCommitment(uint256,address,uint256,bytes32) pure returns (bytes32)','function registerProperty(uint256,address,bytes32,string)','function freezeProperty(uint256,string)','function unfreezeProperty(uint256)','function createAuction(uint256,uint256,uint256,uint256) returns (uint256)','function commitBid(uint256,bytes32) payable','function revealBid(uint256,uint256,bytes32)','function settle(uint256)','function cancelAuction(uint256)','function claimRefund(uint256)','function claimProceeds(uint256)','function demoSkipToReveal(uint256)','function demoSkipToEnd(uint256)'];
const WR=new Set(['registerProperty','freezeProperty','unfreezeProperty','createAuction','commitBid','revealBid','settle','cancelAuction','claimRefund','claimProceeds','demoSkipToReveal','demoSkipToEnd']);
async function C(n,v,...a){
 if(S.mode==='demo')return MOCK[n](S.me,v,...a.map(x=>typeof x==='string'&&x.startsWith('0x')&&x.length===42?x.toLowerCase():x));
 if(!WR.has(n)){
  let r;
  try{r=await (S.ct||READ)[n](...a)}catch(e){if(S.ct)r=await READ[n](...a);else throw e}
  if(n==='properties'&&r&&r.exists)rememberId(a[0]);
  return r;
 }
 if(!S.ct)throw new Error('Sign in with MetaMask first');
 const tx=await S.ct[n](...a,v>0n?{value:v}:{});await tx.wait();
}
const why=e=>(e.reason||e.shortMessage||e.message||'Failed').replace(/^execution reverted:?\s*/i,'').replace(/^"|"$/g,'');

export { C, why, ABI };
export const rnd=()=>E.hexlify(E.randomBytes(32));
export const hashFile=async f=>E.keccak256(new Uint8Array(await f.arrayBuffer()));
export const hashTxt=t=>E.keccak256(E.toUtf8Bytes(t));
const mem=new Map();
export const secretKey=(i,me)=>i+':'+me.toLowerCase();
export const loadSecret=k=>{try{return JSON.parse(localStorage.getItem('plat:'+k))||mem.get(k)}catch(e){return mem.get(k)}};
export const saveSecret=(k,o)=>{mem.set(k,o);try{localStorage.setItem('plat:'+k,JSON.stringify(o))}catch(e){}};
export const CONTRACT=import.meta.env.VITE_CONTRACT||'0x75a3cf0b32f96e321c10d9bb16820fc35647f59e';
export const SEPOLIA_HEX='0xaa36a7';
const RPC=import.meta.env.VITE_RPC||'https://ethereum-sepolia-rpc.publicnode.com';
// Read-only contract: lets anyone browse plots, history and deeds with no wallet.
const READ=new E.Contract(CONTRACT,ABI,new E.JsonRpcProvider(RPC,11155111,{staticNetwork:true}));
const IDS='plat:plots';
function loadIds(){try{return JSON.parse(localStorage.getItem(IDS))||[]}catch(e){return []}}
export function rememberId(id){const s=new Set(loadIds());s.add(Number(id));try{localStorage.setItem(IDS,JSON.stringify([...s]))}catch(e){}}
// Plot list = events from the chain + plots this browser has seen + a probe of low IDs if event search fails.
export async function listPlots(){
  if(S.mode==='demo')return Object.keys(M.p).map(Number);
  const ids=new Set(loadIds());
  let found=false;
  for(const ct of [READ,S.ct].filter(Boolean)){
    try{
      const h=await ct.runner.provider.getBlockNumber();
      for(const r of [500000,100000,20000,2000]){
        try{(await ct.queryFilter(ct.filters.PropertyRegistered(),Math.max(0,h-r),h)).forEach(e=>ids.add(Number(e.args[0])));found=true;break}catch(e){}
      }
    }catch(e){}
    if(found)break;
  }
  if(!found)for(let i=1;i<=200;i++)ids.add(i);
  const out=[];
  await Promise.all([...ids].map(async id=>{
    try{const p=await (S.ct||READ).properties(id);if(p.exists)out.push(id)}
    catch(e){try{const p=await READ.properties(id);if(p.exists)out.push(id)}catch(e2){}}
  }));
  out.forEach(rememberId);
  return out.sort((x,y)=>x-y);
}

// One-click walkthrough for Simulation mode: runs a whole sealed-bid auction with three demo people.
export function runDemo(id){
  const out=[];
  const step=(label,fn)=>{try{const r=fn();out.push({ok:true,label,msg:typeof r==='bigint'?F(r)+' ETH paid out':''})}catch(e){out.push({ok:false,label,msg:why(e)});throw e}};
  const p=M.p[id];
  if(!p||!p.exists)return [{ok:false,label:'Run demo',msg:'No such plot'}];
  const owner=p.owner,names=Object.keys(ACC).filter(k=>k!=='Registrar'&&ACC[k]!==owner).slice(0,2);
  const [b1,b2]=names,n=M.n+1,s1=rnd(),s2=rnd(),a1=W('0.3'),a2=W('0.2');
  try{
    step('Seller lists the plot for auction',()=>MOCK.createAuction(owner,0n,id,W('0.1'),600n,600n));
    step(b1+' commits a sealed bid (amount hidden)',()=>MOCK.commitBid(ACC[b1],a1,n,MOCK.makeCommitment(0,0,n,ACC[b1],a1,s1)));
    step(b2+' commits a sealed bid (amount hidden)',()=>MOCK.commitBid(ACC[b2],a2,n,MOCK.makeCommitment(0,0,n,ACC[b2],a2,s2)));
    step('Bidding closes, reveal opens',()=>MOCK.demoSkipToReveal(owner,0n,n));
    step(b1+' reveals 0.3 ETH',()=>MOCK.revealBid(ACC[b1],0n,n,a1,s1));
    step(b2+' reveals 0.2 ETH',()=>MOCK.revealBid(ACC[b2],0n,n,a2,s2));
    step('Reveal closes',()=>MOCK.demoSkipToEnd(owner,0n,n));
    step('Settle: '+b1+' wins and becomes the owner',()=>MOCK.settle(owner,0n,n));
    step(b2+' claims the deposit back',()=>MOCK.claimRefund(ACC[b2],0n,n));
    step('Seller claims the sale price',()=>MOCK.claimProceeds(owner,0n,n));
  }catch(e){}
  return out;
}

// Accounts that currently own at least one plot in the simulation (for the 'Acting as' labels).
export const simOwners=()=>new Set(Object.values(M.p).map(p=>p.owner));
