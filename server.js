// مدیریت ساختمان - سرور بدون وابستگی. اجرا: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const F=path.join(__dirname,'data.json'),PORT=process.env.PORT||3000;
let D={users:{},meta:{name:''},expenses:[],notices:[],chat:[],reqs:[],pays:[],polls:[],guests:[],sess:{}};
try{D={...D,...JSON.parse(fs.readFileSync(F,'utf8'))}}catch{}
const save=()=>{fs.writeFileSync(F+'.tmp',JSON.stringify(D));fs.renameSync(F+'.tmp',F)};
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
const nid=()=>Date.now().toString(36)+crypto.randomBytes(3).toString('hex');
const S=(v,n)=>String(v??'').trim().slice(0,n);
const bad=m=>{throw Object.assign(new Error(m),{code:400})};
const mgr=u=>{if(u.role!=='manager')throw Object.assign(new Error('فقط مدیر'),{code:403})};
const find=(arr,id)=>arr.find(x=>x.id===id)||bad('یافت نشد');
const fails={};
const A={
 setName:(u,b)=>{mgr(u);D.meta.name=S(b.name,60)},
 addExp:(u,b)=>{mgr(u);const a=+b.a;if(!(a>0))bad('مبلغ نامعتبر');D.expenses.unshift({id:nid(),c:S(b.c,40),a,n:S(b.n,120),t:Date.now()})},
 delExp:(u,b)=>{mgr(u);D.expenses=D.expenses.filter(x=>x.id!==b.id)},
 addNotice:(u,b)=>{mgr(u);if(!S(b.x,500))bad('متن خالی');D.notices.unshift({id:nid(),x:S(b.x,500),t:Date.now()})},
 delNotice:(u,b)=>{mgr(u);D.notices=D.notices.filter(x=>x.id!==b.id)},
 chat:(u,b)=>{const x=S(b.x,500);if(!x)bad('پیام خالی');D.chat.push({id:nid(),u:u.id,n:u.n,f:u.f,x,t:Date.now()});D.chat=D.chat.slice(-300)},
 addReq:(u,b)=>{if(!S(b.t,80))bad('عنوان لازم است');D.reqs.unshift({id:nid(),u:u.id,n:u.n,f:u.f,un:u.un,t:S(b.t,80),x:S(b.x,500),s:'جدید',d:Date.now()})},
 reqStatus:(u,b)=>{mgr(u);find(D.reqs,b.id).s=S(b.s,20)},
 addPoll:(u,b)=>{mgr(u);const o=(b.o||[]).map(x=>S(x,60)).filter(Boolean).slice(0,8);if(!S(b.q,150)||o.length<2)bad('سؤال و حداقل ۲ گزینه');D.polls.unshift({id:nid(),q:S(b.q,150),o,v:{},open:true})},
 vote:(u,b)=>{const p=find(D.polls,b.id);if(!p.open)bad('بسته شده');if(!(b.i>=0&&b.i<p.o.length))bad('گزینه نامعتبر');p.v[u.id]=b.i},
 closePoll:(u,b)=>{mgr(u);find(D.polls,b.id).open=false},
 delPoll:(u,b)=>{mgr(u);D.polls=D.polls.filter(x=>x.id!==b.id)},
 addGuest:(u,b)=>{if(!S(b.n,60))bad('نام مهمان لازم است');D.guests.unshift({id:nid(),u:u.id,o:u.n,f:u.f,un:u.un,n:S(b.n,60),d:S(b.d,30),p:S(b.p,20)})},
 delGuest:(u,b)=>{const g=find(D.guests,b.id);if(u.role==='manager'||g.u===u.id)D.guests=D.guests.filter(x=>x!==g)},
 addPay:(u,b)=>{mgr(u);const a=+b.a;find(Object.values(D.users).map(x=>({id:x.id})),b.u);if(!(a>0))bad('مبلغ نامعتبر');D.pays.unshift({id:nid(),u:b.u,a,n:S(b.n,80),t:Date.now()})},
 delPay:(u,b)=>{mgr(u);D.pays=D.pays.filter(x=>x.id!==b.id)},
 userStatus:(u,b)=>{mgr(u);const x=D.users[b.id]||bad('یافت نشد');if(x.id===u.id)bad('نمی‌توانید خودتان را تغییر دهید');x.status=['active','off'].includes(b.s)?b.s:bad('نامعتبر')},
 delUser:(u,b)=>{mgr(u);if(b.id===u.id)bad('امکان‌پذیر نیست');delete D.users[b.id]},
 resetPw:(u,b)=>{mgr(u);const x=D.users[b.id]||bad('یافت نشد');if(S(b.p,100).length<6)bad('رمز کوتاه است');x.h=hash(b.p,x.salt)},
 changePw:(u,b)=>{if(S(b.p,100).length<6)bad('رمز حداقل ۶ کاراکتر');u.h=hash(b.p,u.salt)}
};
const view=u=>{const m=u.role==='manager',pub=x=>({id:x.id,n:x.n,f:x.f,un:x.un,role:x.role});
 const us=Object.values(D.users);
 return{me:pub(u),bname:D.meta.name,expenses:D.expenses,notices:D.notices,chat:D.chat.slice(-100),
  users:m?us.map(x=>({...pub(x),ph:x.ph,status:x.status,t:x.t})):us.filter(x=>x.status==='active').map(pub),
  reqs:m?D.reqs:D.reqs.filter(x=>x.u===u.id),pays:m?D.pays:D.pays.filter(x=>x.u===u.id),
  guests:m?D.guests:D.guests.filter(x=>x.u===u.id),
  polls:D.polls.map(p=>({id:p.id,q:p.q,o:p.o,open:p.open,c:p.o.map((_,i)=>Object.values(p.v).filter(v=>v===i).length),my:p.v[u.id]}))}};
const send=(r,c,o,t='application/json; charset=utf-8')=>{r.writeHead(c,{'Content-Type':t,'Cache-Control':'no-store'});r.end(Buffer.isBuffer(o)||typeof o==='string'?o:JSON.stringify(o))};
http.createServer((q,r)=>{
 const url=q.url.split('?')[0];
 const ST={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/manifest.json':['manifest.json','application/manifest+json'],'/sw.js':['sw.js','text/javascript'],'/icon-192.png':['icon-192.png','image/png'],'/icon-512.png':['icon-512.png','image/png']};
 if(q.method==='GET'&&ST[url])return send(r,200,fs.readFileSync(path.join(__dirname,ST[url][0])),ST[url][1]);
 if(!url.startsWith('/api/'))return send(r,404,{e:'not found'});
 const user=D.sess[q.headers.authorization]&&D.users[D.sess[q.headers.authorization]];
 if(q.method==='GET'&&url==='/api/state')return user&&user.status==='active'?send(r,200,view(user)):send(r,401,{e:'نیاز به ورود'});
 let body='';q.on('data',c=>{body+=c;if(body.length>20000)q.destroy()});
 q.on('end',()=>{try{
  const b=JSON.parse(body||'{}');
  if(url==='/api/register'){
   const id=S(b.u,30).toLowerCase();
   if(!/^[a-z0-9_]{3,30}$/.test(id))bad('نام کاربری: حداقل ۳ حرف انگلیسی/عدد');
   if(S(b.p,100).length<6)bad('رمز حداقل ۶ کاراکتر');if(!S(b.n,60))bad('نام لازم است');
   if(!S(b.f,5)||!S(b.un,10))bad('طبقه و واحد لازم است');if(D.users[id])bad('نام کاربری تکراری است');
   const first=!Object.keys(D.users).length,salt=crypto.randomBytes(8).toString('hex');
   D.users[id]={id,n:S(b.n,60),f:S(b.f,5),un:S(b.un,10),ph:S(b.ph,20),salt,h:hash(b.p,salt),role:first?'manager':'resident',status:first?'active':'pending',t:Date.now()};
   save();return send(r,200,{ok:1,msg:first?'شما مدیر ساختمان هستید. وارد شوید.':'ثبت‌نام شد؛ منتظر تأیید مدیر باشید.'});
  }
  if(url==='/api/login'){
   const id=S(b.u,30).toLowerCase(),ip=q.socket.remoteAddress,k=ip+id;
   if((fails[k]||0)>=8)bad('تلاش زیاد؛ چند دقیقه بعد دوباره امتحان کنید');
   const x=D.users[id];
   if(!x||hash(String(b.p||''),x.salt)!==x.h){fails[k]=(fails[k]||0)+1;setTimeout(()=>delete fails[k],6e5);bad('نام کاربری یا رمز اشتباه است')}
   if(x.status==='pending')bad('حساب شما هنوز توسط مدیر تأیید نشده');if(x.status!=='active')bad('حساب غیرفعال است');
   const t=crypto.randomBytes(24).toString('hex');D.sess[t]=id;save();return send(r,200,{token:t});
  }
  if(!user||user.status!=='active')return send(r,401,{e:'نیاز به ورود'});
  if(url==='/api/logout'){delete D.sess[q.headers.authorization];save();return send(r,200,{ok:1})}
  if(url==='/api/act'){(A[b.k]||(()=>bad('عملیات نامعتبر')))(user,b);save();return send(r,200,{ok:1})}
  send(r,404,{e:'not found'});
 }catch(e){send(r,e.code||400,{e:e.code?e.message:'درخواست نامعتبر'})}});
}).listen(PORT,'0.0.0.0',()=>console.log('http://localhost:'+PORT));
