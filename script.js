// Simple in-memory data store (no backend)
let db = {
  users: [],        // {id,email,phone,password,verified,biometricEnabled,balancePending,balanceAvailable}
  currentUserId: null,
  listings: [],     // {id,title,price,unit,cat,desc,location,providerId,visible,createdAt}
  messages: {},     // threadId -> [{fromId,text,at}]
  transactions: []  // {id,listId,price,providerId,buyerId,fee,providerReceives,at}
};

const SERVICE_FEE_RATE = 0.02; // 2% charged to provider on completed sale

// helpers
const randId = (p='id') => p + '_' + Math.random().toString(36).slice(2,9);
const money = v => Number.parseFloat(v).toFixed(2);

// UI helpers
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  updateHeader();
  if(id==='home') renderHome();
  if(id==='consumer') renderConsumerFeed();
  if(id==='search') renderSearchResults();
  if(id==='providerDash') renderProviderDashboard();
  if(id==='messages') renderThreads();
  if(id==='transactions') renderTransactions();
  if(id==='settings') renderSettings();
}

function updateHeader(){
  const el = document.getElementById('userInfo');
  const user = db.users.find(u=>u.id===db.currentUserId);
  el.innerHTML = user ? `${user.email} • $${money(user.balanceAvailable||0)} avail` : 'Not signed in';
}

// Auth flows
function register(){
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const pass = document.getElementById('regPass').value;
  if(!email || !pass){ alert('Email and password required'); return; }
  const u = {id: randId('u'), email, phone, password: pass, verified:false, biometricEnabled:false, balancePending:0, balanceAvailable:0};
  db.users.push(u);
  alert('Verification email sent to '+email+' (code 123456).');
  showScreen('verify');
}

function simulateGoogleSignup(){
  const email = 'google.user@campus.edu';
  const u = {id: randId('u'), email, phone:'', password:'', verified:true, biometricEnabled:false, balancePending:0, balanceAvailable:0};
  db.users.push(u); db.currentUserId = u.id;
  alert('Signed in with Google as '+email);
  showScreen('home');
}

function verifyAccount(){
  const code = document.getElementById('verifyCode').value.trim();
  if(code==='123456'){
    const last = db.users[db.users.length-1];
    last.verified = true;
    db.currentUserId = last.id;
    alert('Verified. Account ready.');
    showScreen('home');
  } else alert('Bad code. Use 123456 to simulate');
}

function login(){
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const user = db.users.find(u=>u.email===email && u.password===pass);
  if(user){
    if(!user.verified){ alert('Please verify your account first.'); showScreen('verify'); return; }
    db.currentUserId = user.id;
    if(document.getElementById('enableBiometric').checked) user.biometricEnabled = true;
    alert('Logged in');
    showScreen('home');
  } else { alert('Login failed'); }
}

function logout(){
  db.currentUserId = null;
  showScreen('login');
}

// Listings
function publishResource(){
  const title = document.getElementById('resTitle').value.trim();
  const price = parseFloat(document.getElementById('resPrice').value);
  const unit = document.getElementById('resUnit').value;
  const cat = document.getElementById('resCat').value;
  const desc = document.getElementById('resDesc').value.trim();
  const loc = document.getElementById('resLocation').value.trim();
  const contactEmail = document.getElementById('resEmail').value.trim() || (db.users.find(u=>u.id===db.currentUserId)||{}).email;
  if(!title || isNaN(price) || !desc){ alert('Please complete title, price and description'); return; }
  const listing = { id: randId('L'), title, price: money(price), unit, cat, desc, location:loc, providerId: db.currentUserId, visible:true, contactEmail, createdAt: Date.now() };
  db.listings.push(listing);
  alert('Published: ' + title);
  showScreen('providerDash');
}

// Renderers
function renderHome(){
  const el = document.getElementById('homeFeed');
  el.innerHTML = '';
  const recent = db.listings.slice().reverse().slice(0,6);
  if(!recent.length) el.innerHTML = '<p class="small">No listings yet. Publish one!</p>';
  recent.forEach(l=>{
    const div = document.createElement('div'); div.className='card';
    div.innerHTML = `<strong>${l.cat}</strong>: ${l.title} — $${l.price} <div class="small">${l.unit} • ${l.location || ''}</div>`;
    div.onclick = ()=>openListing(l.id);
    el.appendChild(div);
  })
}

let currentListing = null;
function openListing(listId){
  const l = db.listings.find(x=>x.id===listId); if(!l) return;
  currentListing = l;
  document.getElementById('listingTitle').innerText = `${l.title} — $${l.price}`;
  document.getElementById('listingMeta').innerText = `${l.cat} • ${l.unit} • ${l.location}`;
  document.getElementById('listingDesc').innerText = l.desc;
  const provider = db.users.find(u=>u.id===l.providerId) || {email:'unknown'};
  document.getElementById('listingProvider').innerHTML = `Provider: ${provider.email} ${provider.verified ? '• Verified' : ''}`;
  document.getElementById('listingNotes').innerHTML = `<div class="small">Fee: 2% charged to provider upon completed purchase. Platform records transaction and updates provider payout.</div>`;
  showScreen('listing');
}

function renderProviderDashboard(){
  const providerId = db.currentUserId;
  const listings = db.listings.filter(l=>l.providerId===providerId);
  document.getElementById('providerListings').innerHTML = listings.length ? '' : '<p class="small">No listings</p>';
  listings.forEach(l=>{
    const div = document.createElement('div'); div.className='card';
    div.innerHTML = `${l.title} — $${l.price} <div class="small">${l.cat} • ${l.unit} • ${l.location}</div>`;
    div.onclick = ()=>openListing(l.id);
    document.getElementById('providerListings').appendChild(div);
  });
  const u = db.users.find(u=>u.id===providerId) || {};
  document.getElementById('statActive').innerText = listings.length;
  document.getElementById('statPending').innerText = money(u.balancePending || 0);
  document.getElementById('statAvailable').innerText = money(u.balanceAvailable || 0);
}

function renderConsumerFeed(){
  const el = document.getElementById('consumerFeed'); el.innerHTML = '';
  db.listings.forEach(l=>{
    const div = document.createElement('div'); div.className='card';
    div.innerHTML = `<strong>${l.cat}</strong>: ${l.title} — $${l.price} <div class="small">${l.unit} • ${l.location}</div>`;
    div.onclick = ()=>openListing(l.id);
    el.appendChild(div);
  })
}

// Search
function performSearch(){
  const t = document.getElementById('searchTerm').value.trim().toLowerCase();
  const res = db.listings.filter(l => l.title.toLowerCase().includes(t) || l.cat.toLowerCase().includes(t));
  const out = document.getElementById('searchResults'); out.innerHTML = '';
  if(!res.length) out.innerHTML = '<p class="small">No results</p>';
  res.forEach(l=>{
    const div = document.createElement('div'); div.className='card';
    div.innerHTML = `<strong>${l.cat}</strong>: ${l.title} — $${l.price}`;
    div.onclick = ()=>openListing(l.id);
    out.appendChild(div);
  })
}
function clearSearch(){ document.getElementById('searchTerm').value=''; document.getElementById('searchResults').innerHTML=''; }

// Purchase flow
function openPurchase(){
  const p = currentListing;
  if(!p) return;
  const buyer = db.users.find(u=>u.id===db.currentUserId);
  if(!buyer){ alert('Please login to buy.'); showScreen('login'); return; }
  // show summary & calculate fee
  const price = Number(p.price);
  const fee = Number((price * SERVICE_FEE_RATE).toFixed(2)); // 2% of price
  const providerReceives = Number((price - fee).toFixed(2));
  document.getElementById('purchaseSummary').innerHTML = `
    <div class="card"><strong>${p.title}</strong><div class="small">${p.cat} • ${p.unit}</div></div>
    <p>Price: $${money(price)}</p>
    <p>Provider fee (2%): $${money(fee)} (charged to provider upon completion)</p>
    <p>Provider receives: $${money(providerReceives)}</p>
    <p class="small">You will be charged: $${money(price)} (platform will handle payout)</p>
  `;
  showScreen('purchase');
}

function completePurchase(){
  const l = currentListing; if(!l) return;
  const price = Number(l.price);
  const fee = Number((price * SERVICE_FEE_RATE).toFixed(2));
  const providerReceives = Number((price - fee).toFixed(2));
  const tx = {
    id: randId('T'),
    listId: l.id,
    price: money(price),
    providerId: l.providerId,
    buyerId: db.currentUserId,
    fee: money(fee),
    providerReceives: money(providerReceives),
    at: Date.now()
  };
  db.transactions.push(tx);
  // Update provider balances: pending -> funds available for withdrawal (simulate immediate)
  const provider = db.users.find(u=>u.id===l.providerId);
  if(provider){
    provider.balanceAvailable = Number((Number(provider.balanceAvailable||0) + providerReceives).toFixed(2));
    // platform collects fee (we won't track platform balance in detail here)
  }
  alert('Payment simulated — transaction complete. Receipt recorded.');
  showScreen('transactions');
}

// Transactions view
function renderTransactions(){
  const el = document.getElementById('transactionList'); el.innerHTML='';
  if(!db.transactions.length) el.innerHTML = '<p class="small">No transactions yet</p>';
  db.transactions.slice().reverse().forEach(t=>{
    const div = document.createElement('div'); div.className='card';
    const buyer = db.users.find(u=>u.id===t.buyerId) || {};
    div.innerHTML = `<strong>${t.id}</strong><div class="small">Listing ${t.listId} • $${t.price} • Fee $${t.fee} • Provider gets $${t.providerReceives}</div><div class="small">Buyer: ${buyer.email || 'unknown'}</div>`;
    el.appendChild(div);
  })
}

// Messaging (simple)
function openChat(providerId){
  if(!db.currentUserId){ alert('Login to message'); showScreen('login'); return; }
  const thread = `thread_${[db.currentUserId, providerId].sort().join('_')}`;
  if(!db.messages[thread]) db.messages[thread]=[];
  window.currentThread = thread;
  const provider = db.users.find(u=>u.id===providerId) || {email:'unknown'};
  document.getElementById('chatWith').innerText = 'Chat with ' + provider.email;
  renderChat();
  showScreen('chat');
}

function renderThreads(){
  const el = document.getElementById('threads'); el.innerHTML='';
  for(const k in db.messages){
    const msgs = db.messages[k];
    const otherId = k.split('_').find(id=> id !== db.currentUserId);
    const other = db.users.find(u=>u.id===otherId) || {email:'unknown'};
    const div = document.createElement('div'); div.className='card';
    div.innerHTML = `<strong>${other.email}</strong><div class="small">${msgs.length} messages</div>`;
    div.onclick = ()=>{ window.currentThread = k; renderChat(); showScreen('chat'); };
    el.appendChild(div);
  }
  if(!Object.keys(db.messages).length) el.innerHTML = '<p class="small">No messages yet</p>';
}

function renderChat(){
  const box = document.getElementById('chatBox'); box.innerHTML='';
  const arr = db.messages[window.currentThread] || [];
  arr.forEach(item=>{
    const d = document.createElement('div'); d.className='card';
    d.innerHTML = `<div class="small">${item.from===db.currentUserId?'You':'Them'} • ${new Date(item.at).toLocaleString()}</div><div>${item.text}</div>`;
    box.appendChild(d);
  })
}

function sendMessage(){
  const txt = document.getElementById('chatMsg').value.trim(); if(!txt) return;
  const arr = db.messages[window.currentThread] || (db.messages[window.currentThread]=[]);
  arr.push({from: db.currentUserId, text: txt, at: Date.now()});
  document.getElementById('chatMsg').value='';
  renderChat();
}

// Save listing
function saveListing(id){
  alert('Listing saved locally (prototype)');
}

// Provider payout
function requestPayout(){
  const u = db.users.find(us=>us.id===db.currentUserId);
  if(!u) { alert('Login as provider'); showScreen('login'); return; }
  if(Number(u.balanceAvailable) <= 0) { alert('No available balance'); return; }
  alert(`Payout request: $${money(u.balanceAvailable)}. (simulate sending to bank account)`);
  u.balanceAvailable = 0;
  renderProviderDashboard();
}

// Settings view
function renderSettings(){
  const u = db.users.find(us=>us.id===db.currentUserId) || {};
  document.getElementById('settingsEmail').innerText = u.email || '';
  document.getElementById('settingsPhone').innerText = u.phone || '';
}

// debug / test helpers (create sample data)
(function seed(){
  // create two users
  const u1 = {id: randId('u'), email:'alex@campus.edu', phone:'', password:'123', verified:true, biometricEnabled:false, balancePending:0, balanceAvailable:0};
  const u2 = {id: randId('u'), email:'jamie@campus.edu', phone:'', password:'123', verified:true, biometricEnabled:false, balancePending:0, balanceAvailable:0};
  db.users.push(u1,u2);
  // one listing
  db.listings.push({id:randId('L'),title:'Dorm Room Near Science Bldg',price:'400.00',unit:'per-month',cat:'Rooms',desc:'Sublease spring term',location:'Science Building',providerId:u1.id,visible:true,createdAt:Date.now()});
  db.listings.push({id:randId('L'),title:'Calculus Textbook (2nd ed)',price:'20.00',unit:'one-time',cat:'Books',desc:'Good condition',location:'Campus Bookstore',providerId:u2.id,visible:true,createdAt:Date.now()});
})();
