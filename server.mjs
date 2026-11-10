import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
try {
  const envText = await readFile(join(root, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}
const paypalBase = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const catalog = [
  { id:'airlite', name:'Airlite ANC Headphones', category:'Audio', price:79, oldPrice:99, badge:'BEST VALUE', rating:'4.8', detail:'Quiet commute, all-day comfort', icon:'◉', color:'lilac' },
  { id:'metro', name:'Metro Sling Pack', category:'Carry', price:32, oldPrice:42, badge:'TRAVEL PICK', rating:'4.7', detail:'Hands-free, weather-ready storage', icon:'▱', color:'sand' },
  { id:'pocket', name:'Pocket Power 10K', category:'Power', price:24, oldPrice:35, badge:'LOWEST PRICE', rating:'4.9', detail:'A full extra charge on the go', icon:'ϟ', color:'mint' },
  { id:'softcase', name:'Softshell Carry Case', category:'Carry', price:18, oldPrice:24, badge:'ADD-ON', rating:'4.6', detail:'Protects your everyday tech', icon:'▰', color:'blue' },
  { id:'buds', name:'Daylight Wireless Buds', category:'Audio', price:49, oldPrice:64, badge:'LIGHTWEIGHT', rating:'4.5', detail:'Pocket-sized sound for the ride', icon:'◖', color:'coral' },
  { id:'cable', name:'Braided USB-C Cable', category:'Power', price:12, oldPrice:16, badge:'SMART ADD-ON', rating:'4.8', detail:'Durable, tangle-free 1.5 m cable', icon:'⌁', color:'lime' }
];
async function bodyJson(req) { let raw=''; for await (const part of req) { raw+=part; if(raw.length>18000) throw new Error('Request too large'); } return raw ? JSON.parse(raw) : {}; }
function send(res,status,value) { res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}); res.end(JSON.stringify(value)); }
async function paypalToken() {
  const id=process.env.PAYPAL_CLIENT_ID, secret=process.env.PAYPAL_CLIENT_SECRET;
  if(!id||!secret) throw new Error('Add PayPal sandbox credentials to .env to enable checkout.');
  const r=await fetch(paypalBase+'/v1/oauth2/token',{method:'POST',headers:{authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'content-type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  const data=await r.json(); if(!r.ok) throw new Error(data.error_description||'PayPal authentication failed.'); return data.access_token;
}
async function paypalPost(path,payload) {
  const token=await paypalToken();
  const r=await fetch(paypalBase+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','payPal-Request-Id':crypto.randomUUID()},body:JSON.stringify(payload)});
  const data=await r.json(); if(!r.ok) throw new Error(data.message||'PayPal request failed.'); return data;
}
function demoPlan(prompt,budget) {
  const words=prompt.toLowerCase();
  const picks=[];
  if(/headphone|audio|commut|flight|travel|work|focus|noise/.test(words)) picks.push('airlite','pocket','cable');
  else if(/power|charge|battery/.test(words)) picks.push('pocket','cable','metro');
  else if(/bag|carry|organ|travel/.test(words)) picks.push('metro','softcase','pocket');
  else picks.push('airlite','metro','pocket');
  const chosen=picks.map(id=>catalog.find(p=>p.id===id));
  const affordable=chosen.filter(p=>p.price<=budget);
  const used=affordable.reduce((n,p)=>n+p.price,0);
  const savings=affordable.reduce((n,p)=>n+p.oldPrice-p.price,0);
  return { title:'Your '+(words.match(/commut|travel|flight/)?'commute':'everyday')+' setup', insight:'A balanced shortlist that stays within your budget and prioritizes the essentials.', items:affordable, total:used, savings, confidence:'Curated demo mode', mode:'demo' };
}
async function makePlan(prompt,budget) {
  if(!process.env.OPENAI_API_KEY) return demoPlan(prompt,budget);
  const system='You are Mint, a careful AI shopping planner. From the catalog, select 2-3 products that best match a shopper goal and budget. Never exceed budget. Only use provided IDs. Return JSON with title (short), insight (one sentence), items (array of IDs). Mention tradeoffs, not unverifiable claims.';
  const payload={model:process.env.OPENAI_MODEL||'gpt-4o-mini',response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({goal:prompt,budget,currency:'USD',catalog:catalog.map(({id,name,category,price,detail})=>({id,name,category,price,detail}))})}],temperature:0.3};
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+process.env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify(payload)});
  const data=await r.json(); if(!r.ok) throw new Error(data.error?.message||'AI service is unavailable.');
  const parsed=JSON.parse(data.choices?.[0]?.message?.content||'{}');
  const items=(Array.isArray(parsed.items)?parsed.items:[]).map(id=>catalog.find(p=>p.id===id)).filter(Boolean).slice(0,3);
  let total=0; const safe=[]; for(const p of items) if(total+p.price<=budget){safe.push(p);total+=p.price;}
  return {title:String(parsed.title||'Your smart shortlist').slice(0,48),insight:String(parsed.insight||'A shortlist matched to your goal and budget.').slice(0,180),items:safe,total,savings:safe.reduce((n,p)=>n+p.oldPrice-p.price,0),confidence:'AI powered',mode:'ai'};
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end();}
    if(req.method==='GET'&&url.pathname==='/api/config') return send(res,200,{paypalClientId:process.env.PAYPAL_CLIENT_ID||'',paypalEnv:process.env.PAYPAL_ENV==='live'?'live':'sandbox',aiEnabled:Boolean(process.env.OPENAI_API_KEY),catalog});
    if(req.method==='POST'&&url.pathname==='/api/plan'){const b=await bodyJson(req);const budget=Math.max(12,Math.min(500,Number(b.budget)||100));const prompt=String(b.prompt||'').trim().slice(0,500);if(!prompt)return send(res,400,{error:'Tell Mint what you need first.'});return send(res,200,await makePlan(prompt,budget));}
    if(req.method==='POST'&&url.pathname==='/api/paypal/create-order'){
      const b=await bodyJson(req), ids=Array.isArray(b.ids)?b.ids.slice(0,6):[], items=ids.map(id=>catalog.find(p=>p.id===id)).filter(Boolean);
      if(!items.length)return send(res,400,{error:'Choose at least one item.'});
      const total=items.reduce((n,p)=>n+p.price,0).toFixed(2);
      const order=await paypalPost('/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{description:'Mint AI shopping plan',amount:{currency_code:'USD',value:total,breakdown:{item_total:{currency_code:'USD',value:total}}},items:items.map(p=>({name:p.name,quantity:'1',unit_amount:{currency_code:'USD',value:p.price.toFixed(2)}}))}],application_context:{brand_name:'Mint',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW'}});
      return send(res,200,{id:order.id});
    }
    if(req.method==='POST'&&url.pathname==='/api/paypal/capture-order'){const b=await bodyJson(req);if(!/^[A-Z0-9]+$/.test(String(b.orderID||'')))return send(res,400,{error:'Invalid PayPal order.'});const result=await paypalPost('/v2/checkout/orders/'+b.orderID+'/capture',{});return send(res,200,{id:result.id,status:result.status});}
    let path=normalize(decodeURIComponent(url.pathname)).replace(/^([.][.][/\\\\])+/, ''); if(path==='/'||path==='.') path='index.html';
    const file=join(root,'public',path);const data=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});res.end(data);
  } catch(error){const msg=error.message||'Something went wrong.';send(res,500,{error:msg});}
});
server.listen(port,()=>console.log('Mint is ready at http://localhost:'+port));
