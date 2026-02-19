// ─── Bot de precios Craft World ───────────────────────────────────────────────
// Consulta las 29 pools en GeckoTerminal y guarda los datos en prices.json
// Se ejecuta automáticamente cada hora via GitHub Actions

const fs   = require('fs');
const https= require('https');

// ── Pools ──────────────────────────────────────────────────────────────────────
const POOLS = [
  {id:"1",  address:"0xc356cd52364541379ad4d31a889b7031e758220a"},
  {id:"2",  address:"0xf14ad4a21a9e71ba967b8b99e278d03a1933b44a"},
  {id:"3",  address:"0xe973dc221bb031010ec673105ed8b04c9e713b9d"},
  {id:"4",  address:"0xb287ea5a5cd4f2b74571e30fdec96241aa5163d9"},
  {id:"5",  address:"0x8b1a1b7b43a53904b0a05406c13399079e553501"},
  {id:"6",  address:"0x6d8839a585f7877a5e218a217c07334980f04a4a"},
  {id:"7",  address:"0xa09dda31b854720b6d2f28dee9c87b05d0b80d14"},
  {id:"8",  address:"0xd1d6bb059c97295f7437ad423111047cbcddf4c6"},
  {id:"9",  address:"0x6ccd01c951e57d82be8dccb90c01a58bfb4d83cd"},
  {id:"10", address:"0xe63f8cefea9a17a259bb3b375929bd10d5e1cdfa"},
  {id:"11", address:"0x54ae64826ca9d440ede8c33e6cf4cfa1a3aa5801"},
  {id:"12", address:"0xfa3a564b27deb29781f80032df662a4406eebef6"},
  {id:"13", address:"0x70c063f17dacb35e4b3df06c8f36020416a44a3c"},
  {id:"14", address:"0x4343846ebe54dcd40ba572275640230d533296e5"},
  {id:"15", address:"0x7aa1cc00ca62982ab10d12fd4f6b6687f33011ad"},
  {id:"16", address:"0x4782e36bbe6e9abca5357d3e43a090fa772de71b"},
  {id:"17", address:"0xda4145a4975b1219e85a233673187309c4840044"},
  {id:"18", address:"0x7bf03c63adfded079adbd9f807ccce0fd28b8fd8"},
  {id:"19", address:"0x0016c4c602cc1a96a9d35fe133a7e374d3cdc26d"},
  {id:"20", address:"0x0f8f4dcf1b6eb9f5c0e8fbb9cd6879aa3983c8bc"},
  {id:"21", address:"0x491a412400840651c243acfc1ed9947ffe8a4e8f"},
  {id:"22", address:"0x6f363e6760876a4c66730fbbefccdd3014b6220c"},
  {id:"23", address:"0xefc128c4cb990a5ecc88ff71e9efcc0eaef434d2"},
  {id:"24", address:"0x346e30b7ca273fb001eec84fabf2b693617df710"},
  {id:"25", address:"0x0ab775634107063a7c16c6c8e0fd6bda1f219ae6"},
  {id:"26", address:"0x0ffb7bd0bc009a01f9f9e95a0f563bad2189f151"},
  {id:"27", address:"0xb0a3c31aae83526fd6ee75aac552822d676f46b2"},
  {id:"28", address:"0xbb155716cd99d7ef8fd3fb45c91d39958c95b088"},
  {id:"29", address:"0x85172e7ff5040366fa5a3caf7b1bd969bb06b570"},
];

const DATA_FILE    = 'prices.json';
const THREE_DAYS   = 3 * 24 * 60 * 60 * 1000;
const GT_BASE      = 'https://api.geckoterminal.com/api/v2/networks/ronin/pools';

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function httpGet(url){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{
      headers:{
        'Accept':'application/json;version=20230302',
        'User-Agent':'CraftWorldPriceBot/1.0',
      }
    },(res)=>{
      let data='';
      res.on('data',chunk=>data+=chunk);
      res.on('end',()=>{
        if(res.statusCode===429) return reject(new Error('Rate limit (429)'));
        if(res.statusCode===404) return reject(new Error('Pool no encontrada (404)'));
        if(res.statusCode!==200) return reject(new Error(`HTTP ${res.statusCode}`));
        try{ resolve(JSON.parse(data)); }
        catch(e){ reject(new Error('JSON inválido')); }
      });
    });
    req.on('error',reject);
    req.setTimeout(15000,()=>{ req.destroy(); reject(new Error('Timeout 15s')); });
  });
}

async function fetchPoolWithRetry(address, retries=2){
  for(let attempt=1; attempt<=retries; attempt++){
    try{
      const json = await httpGet(`${GT_BASE}/${address}`);
      const a = json?.data?.attributes;
      if(!a) throw new Error('Sin atributos en respuesta');
      return {attrs:a, error:null};
    }catch(e){
      const definitive = e.message.includes('404') || e.message.includes('Rate limit');
      if(definitive || attempt===retries){
        return {attrs:null, error:e.message};
      }
      console.log(`  ↻ Reintentando (${attempt}/${retries})…`);
      await sleep(2000 * attempt);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main(){
  const timestamp = new Date().toISOString();
  const dateStr   = new Date().toLocaleString('es-ES',{timeZone:'America/El_Salvador'});

  console.log(`\n🤖 Craft World Price Bot`);
  console.log(`📅 ${dateStr} (El Salvador)`);
  console.log(`─────────────────────────────────────`);

  const newRecords = [];
  let ok = 0, errors = 0;

  for(let i=0; i<POOLS.length; i++){
    const pool = POOLS[i];
    const {attrs, error} = await fetchPoolWithRetry(pool.address);

    if(attrs){
      const nm = attrs.name || pool.address.slice(0,8)+'…';
      const basePriceUsd = attrs.base_token_price_usd || null;
      newRecords.push({
        poolId:        pool.id,
        address:       pool.address,
        name:          nm,
        baseToken:     nm.split(' / ')[0] || 'T0',
        quoteToken:    nm.split(' / ')[1] || 'T1',
        basePriceUsd,
        quotePriceUsd: attrs.quote_token_price_usd             || null,
        priceNative:   attrs.base_token_price_native_currency  || null,
        volume1h:      attrs.volume_usd?.h1                    || null,
        volume6h:      attrs.volume_usd?.h6                    || null,
        volume24h:     attrs.volume_usd?.h24                   || null,
        liquidity:     attrs.reserve_in_usd                    || null,
        fdv:           attrs.fdv_usd                           || null,
        chg5m:         attrs.price_change_percentage?.m5       || null,
        chg1h:         attrs.price_change_percentage?.h1       || null,
        chg6h:         attrs.price_change_percentage?.h6       || null,
        chg24h:        attrs.price_change_percentage?.h24      || null,
        txBuys24h:     attrs.transactions?.h24?.buys           || null,
        txSells24h:    attrs.transactions?.h24?.sells          || null,
        txTotal24h:    ((attrs.transactions?.h24?.buys||0)+(attrs.transactions?.h24?.sells||0)) || null,
        timestamp,
        error: null,
      });
      console.log(`  ✅ #${pool.id.padStart(2)} ${nm} → $${parseFloat(basePriceUsd||0).toPrecision(5)}`);
      ok++;
    } else {
      newRecords.push({
        poolId:pool.id, address:pool.address,
        name: pool.address.slice(0,8)+'…',
        basePriceUsd:null, quotePriceUsd:null,
        timestamp, error,
      });
      console.log(`  ⚠  #${pool.id.padStart(2)} ${pool.address.slice(0,12)}… → ${error}`);
      errors++;
    }

    if(i < POOLS.length-1) await sleep(500);
  }

  // ── Merge con historial existente (mantener 3 días) ─────────────────────────
  let existing = [];
  if(fs.existsSync(DATA_FILE)){
    try{
      existing = JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
      // Purgar registros viejos
      const cutoff = Date.now() - THREE_DAYS;
      existing = existing.filter(r => new Date(r.timestamp).getTime() > cutoff);
    }catch(e){
      console.log(`⚠ No se pudo leer ${DATA_FILE}, creando nuevo.`);
    }
  }

  const merged = [...existing, ...newRecords];
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2), 'utf8');

  console.log(`─────────────────────────────────────`);
  console.log(`✅ OK: ${ok}/${POOLS.length}  |  ⚠ Errores: ${errors}`);
  console.log(`💾 Total registros guardados: ${merged.length}`);
  console.log(`📁 Archivo: ${DATA_FILE} (${(fs.statSync(DATA_FILE).size/1024).toFixed(1)} KB)`);
}

main().catch(e=>{
  console.error('❌ Error fatal:', e.message);
  process.exit(1);
});
