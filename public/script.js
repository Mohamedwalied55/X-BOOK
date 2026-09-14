const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state={books:[],teachers:[],settings:{},cart:[],filters:{q:'',grade:'',subject:'',teacher:'',available:false}};
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=n=>Number(n||0).toLocaleString('ar-EG',{maximumFractionDigits:0});
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)}
function saveCart(){localStorage.xbookCart=JSON.stringify(state.cart)}
function loadCart(){try{state.cart=JSON.parse(localStorage.xbookCart||'[]')}catch{state.cart=[]}}
async function load(){const r=await fetch('/api/public');if(!r.ok)throw Error('تعذر تحميل البيانات');state=Object.assign(state,await r.json(),{filters:state.filters});applySettings();buildFilters();renderBooks();renderTeachers();renderCart();renderWhatsApp()}
function applySettings(){const s=state.settings||{};$('#heroBadge').textContent=s.hero_badge||'CLASSIFIED // XBOOK';$('#heroTitle').innerHTML=(s.hero_title||'رحلتك نحو الثانوية العامة').replace(/(الثانوية العامة|تبدأ من هنا\.?)/,'<em>$1</em>');$('#heroSubtitle').textContent=s.hero_subtitle||'كتبك .. مع أفضل الشروحات من أقوى المدرسين';$('#aboutText').textContent=s.about||'';if(s.hero_image){$('#heroArt').style.backgroundImage=`url('${s.hero_image}')`}}
function buildFilters(){const subs=[...new Set(state.books.map(b=>b.subject).filter(Boolean))].sort();$('#subject').innerHTML='<option value="">جميع المواد</option>'+subs.map(x=>`<option>${esc(x)}</option>`).join('');$('#teacher').innerHTML='<option value="">جميع المدرسين</option>'+state.teachers.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}
function filtered(){const f=state.filters,q=f.q.trim().toLowerCase();return state.books.filter(b=>(!q||[b.title,b.subject,b.grade,b.teacher].join(' ').toLowerCase().includes(q))&&(!f.grade||b.grade===f.grade)&&(!f.subject||b.subject===f.subject)&&(!f.teacher||String(b.teacher_id)===String(f.teacher))&&(!f.available||b.available))}
function cover(b){const colors={"فيزياء":"phy","كيمياء":"chem","أحياء":"bio","رياضيات":"math","لغة عربية":"arabic","اللغة الإنجليزية":"eng","إنجليزي":"eng"};const c=colors[b.subject]||'default';return `<div class="cover ${c}"><span>XBOOK</span><b>${esc(b.subject||'BOOK')}</b><strong>${esc(b.title)}</strong><small>${esc(b.grade)}</small><i>CLASSIFIED</i></div>`}
function renderBooks(){const arr=filtered();$('#result')?.remove();$('#empty').hidden=arr.length>0;$('#grid').innerHTML=arr.map(b=>`<article class="bookCard"><div class="bookCoverWrap">${cover(b)}${b.featured?'<span class="best">الأكثر مبيعاً</span>':''}</div><div class="bookInfo"><h3>${esc(b.title)}</h3><p class="teacherName">${esc(b.teacher||'مدرس XBOOK')}</p><p class="gradeText">${esc(b.grade)} • ${esc(b.subject)}</p><div class="bookBottom"><strong>${money(b.price)} ج.م</strong><button class="addBtn" data-id="${b.id}" ${b.available?'':'disabled'}>${b.available?'أضف إلى السلة':'غير متوفر'} <span>🛒</span></button></div></div></article>`).join('');$$('.addBtn').forEach(x=>x.onclick=()=>addToCart(Number(x.dataset.id)))}
function renderTeachers(){const list=state.teachers;$('#teachersGrid').innerHTML=list.map(t=>`<article class="teacherCard"><div class="teacherPhoto">${t.has_image?`<img src="/api/media/teacher/${t.id}" alt="${esc(t.name)}">`:'<span>TEACHER</span>'}</div><div><span class="eyebrow">TEACHER FILE</span><h3>${esc(t.name)}</h3><b>${esc(t.subject||'مدرس ثانوي')}</b><p>${esc(t.bio||'متخصص في شرح ومراجعة المادة الدراسية.')}</p><button class="teacherBooks" data-id="${t.id}">عرض كتبه ←</button></div></article>`).join('');$$('.teacherBooks').forEach(b=>b.onclick=()=>{$('#teacher').value=b.dataset.id;state.filters.teacher=b.dataset.id;document.querySelector('#books').scrollIntoView({behavior:'smooth'});renderBooks()})}
function addToCart(id){const b=state.books.find(x=>x.id===id);if(!b?.available)return;const x=state.cart.find(x=>x.id===id);if(x)x.qty=Math.min(20,x.qty+1);else state.cart.push({id,qty:1});saveCart();renderCart();toast('تمت إضافة الكتاب إلى السلة')}
function changeQty(id,delta){const x=state.cart.find(x=>x.id===id);if(!x)return;x.qty=Math.max(0,Math.min(20,x.qty+delta));state.cart=state.cart.filter(x=>x.qty>0);saveCart();renderCart()}
function renderCart(){let total=0,count=0;$('#cart').innerHTML=state.cart.map(x=>{const b=state.books.find(b=>b.id===x.id);if(!b)return '';const sub=Number(b.price)*x.qty;total+=sub;count+=x.qty;return `<div class="cartItem"><div>${cover(b)}</div><div><h4>${esc(b.title)}</h4><small>${money(b.price)} ج.م</small><div class="qty"><button data-id="${b.id}" data-d="-1">−</button><b>${x.qty}</b><button data-id="${b.id}" data-d="1">+</button></div></div></div>`}).join('')||'<div class="emptyCart">السلة فارغة. أضف كتبك لتبدأ المهمة.</div>';$('#total').textContent=money(total);$('#cartCount').textContent=count;$$('.qty button').forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.id),Number(b.dataset.d)))}
function openCart(){ $('#drawer').classList.add('open') } function closeCart(){ $('#drawer').classList.remove('open') }
function renderWhatsApp(){const nums=[state.settings.whatsapp1,state.settings.whatsapp2].filter(x=>x&&x.length>5);$('#waLinks').innerHTML=nums.map((n,i)=>`<a href="https://wa.me/${encodeURIComponent(n)}" target="_blank" rel="noopener">واتساب ${i+1}<span>↗</span></a>`).join('');$('#floatingWa').onclick=()=>nums.length===1?window.open('https://wa.me/'+encodeURIComponent(nums[0]),'_blank'):toast('اختر رقم الواتساب من قسم التواصل بالأسفل')}
function syncFilters(){state.filters.q=$('#search').value||$('#sideSearch').value;state.filters.grade=$('#grade').value;state.filters.subject=$('#subject').value;state.filters.teacher=$('#teacher').value;state.filters.available=$('#availableOnly').checked;$('#sideSearch').value=$('#search').value;renderBooks()}
$('#search').addEventListener('input',()=>{state.filters.q=$('#search').value;$('#sideSearch').value=$('#search').value;renderBooks()});$('#sideSearch').addEventListener('input',()=>{state.filters.q=$('#sideSearch').value;$('#search').value=$('#sideSearch').value;renderBooks()});['grade','subject','teacher','availableOnly'].forEach(id=>$('#'+id).addEventListener('change',syncFilters));$('#applyFilters').onclick=syncFilters;$('#clearFilters').onclick=()=>{$('#search').value='';$('#sideSearch').value='';$('#grade').value='';$('#subject').value='';$('#teacher').value='';$('#availableOnly').checked=false;syncFilters()};$('#viewAll').onclick=()=>{$('#clearFilters').click()};$$('.categoryCard').forEach(c=>c.onclick=()=>{$('#grade').value=c.dataset.grade;state.filters.grade=c.dataset.grade;document.querySelector('#books').scrollIntoView({behavior:'smooth'});renderBooks()});$('#cartBtn').onclick=openCart;$('#overlay').onclick=closeCart;$('#closeCart').onclick=closeCart;$('#checkoutBtn').onclick=()=>{if(!state.cart.length)return toast('أضف كتاباً إلى السلة أولاً');closeCart();$('#orderModal').classList.add('open')};$('#closeModal').onclick=()=>$('#orderModal').classList.remove('open');$('#orderModal').onclick=e=>{if(e.target.id==='orderModal')$('#orderModal').classList.remove('open')};$('#orderForm').onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));body.items=state.cart;try{const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);state.cart=[];saveCart();renderCart();e.target.reset();$('#orderModal').classList.remove('open');toast('تم إرسال الطلب رقم #'+d.order_id)}catch(err){toast(err.message)}};
$('#theme').onclick=()=>{document.body.classList.toggle('dark');localStorage.xbookDark=document.body.classList.contains('dark')?'1':'0'};if(localStorage.xbookDark==='1')document.body.classList.add('dark');loadCart();load().catch(e=>toast(e.message));
// --- إدارة نافذة تسجيل الدخول وحساب الطالب ---
let isRegisterMode = false;

function openUserAuthModal() {
  const modal = document.getElementById('userAuthModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeUserAuthModal() {
  const modal = document.getElementById('userAuthModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function toggleAuthMode(event) {
  if (event) event.preventDefault();
  isRegisterMode = !isRegisterMode;

  const title = document.getElementById('authTitle');
  const regFields = document.getElementById('registerFields');
  const submitBtn = document.getElementById('authSubmitBtn');
  const toggleLink = document.getElementById('toggleAuthMode');

  if (isRegisterMode) {
    title.textContent = 'إنشاء حساب جديد';
    regFields.style.display = 'block';
    submitBtn.textContent = 'إنشاء الحساب';
    toggleLink.textContent = 'لديك حساب بالفعل؟ تسجيل الدخول';
  } else {
    title.textContent = 'تسجيل الدخول';
    regFields.style.display = 'none';
    submitBtn.textContent = 'دخول';
    toggleLink.textContent = 'ليس لديك حساب؟ أنشئ حساب جديد';
  }
}

async function handleUserAuth() {
  const phone = document.getElementById('authPhone')?.value.trim();
  const password = document.getElementById('authPass')?.value.trim();

  if (!phone || !password) {
    alert('يرجى ملء جميع الحقول المطلوبة');
    return;
  }

  if (isRegisterMode) {
    const name = document.getElementById('regName')?.value.trim();
    const gov = document.getElementById('regGov')?.value.trim();
    const address = document.getElementById('regAddress')?.value.trim();

    if (!name || !gov || !address) {
      alert('يرجى إكمال بيانات إنشاء الحساب');
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password, governorate: gov, address })
      });
      const data = await res.json();
      if (res.ok) {
        alert('تم إنشاء الحساب بنجاح!');
        closeUserAuthModal();
      } else {
        alert(data.message || 'حدث خطأ أثناء إنشاء الحساب');
      }
    } catch (err) {
      alert('تعذر الاتصال بالسيرفر');
    }
  } else {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (res.ok) {
        alert('تم تسجيل الدخول بنجاح!');
        closeUserAuthModal();
      } else {
        alert(data.message || 'بيانات الدخول غير صحيحة');
      }
    } catch (err) {
      alert('تعذر الاتصال بالسيرفر');
    }
  }
}
