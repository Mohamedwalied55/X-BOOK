const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString && !connectionString.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const db = (q, p = []) => pool.query(q, p);

function isValidEgyptianPhone(phone) {
  return /^01[0125]\d{8}$/.test(phone);
}

// دالة توثيق هويّة الطالب
function userAuth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'انتهت الجلسة، يرجى إعادة تسجيل الدخول' });
  }
}

function adminAuth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'غير مصرح' });
  try {
    req.admin = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'انتهت الجلسة' });
  }
}

async function init() {
  await db(`
    CREATE TABLE IF NOT EXISTS admins(id SERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, governorate TEXT, address TEXT, created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS teachers(id SERIAL PRIMARY KEY,name TEXT NOT NULL,subject TEXT DEFAULT '',bio TEXT DEFAULT '',image_data BYTEA,image_type TEXT,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS books(id SERIAL PRIMARY KEY,title TEXT NOT NULL,teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL,subject TEXT NOT NULL,grade TEXT NOT NULL,price NUMERIC(10,2) DEFAULT 0,available BOOLEAN DEFAULT true,featured BOOLEAN DEFAULT false,description TEXT DEFAULT '',cover_data BYTEA,cover_type TEXT,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE SET NULL, customer_name TEXT NOT NULL,phone TEXT NOT NULL,governorate TEXT NOT NULL,address TEXT NOT NULL,notes TEXT DEFAULT '',status TEXT DEFAULT 'جديد',total NUMERIC(10,2) DEFAULT 0,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS order_items(id SERIAL PRIMARY KEY,order_id INT REFERENCES orders(id) ON DELETE CASCADE,book_id INT REFERENCES books(id) ON DELETE SET NULL,title TEXT NOT NULL,price NUMERIC(10,2) NOT NULL,qty INT NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS site_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS site_media(key TEXT PRIMARY KEY,data BYTEA NOT NULL,mime_type TEXT NOT NULL,updated_at TIMESTAMPTZ DEFAULT now());
  `);

  const email = process.env.ADMIN_EMAIL || 'admin@xbook.local', pass = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  await db('INSERT INTO admins(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING', [email, await bcrypt.hash(pass, 10)]);
}

// ------------------- مسارات الطلاب (User Auth API) -------------------

// إنشاء حساب طالب جديد
app.post('/api/user/register', async (req, res) => {
  try {
    const { name, phone, password, governorate, address } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: 'الاسم ورقم الهاتف وكلمة المرور مطلوبة' });
    if (!isValidEgyptianPhone(phone)) return res.status(400).json({ error: 'يرجى إدخال رقم هاتف مصري صحيح' });

    const hash = await bcrypt.hash(password, 10);
    const r = await db(
      'INSERT INTO users(name, phone, password_hash, governorate, address) VALUES($1, $2, $3, $4, $5) RETURNING id, name, phone',
      [name, phone, hash, governorate || '', address || '']
    );

    const token = jwt.sign({ id: r.rows[0].id, name: r.rows[0].name, phone: r.rows[0].phone }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'رقم الهاتف مسجل بالفعل' });
    res.status(500).json({ error: e.message });
  }
});

// تسجيل دخول الطالب
app.post('/api/user/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const r = await db('SELECT * FROM users WHERE phone=$1', [phone]);
    if (!r.rowCount || !(await bcrypt.compare(password || '', r.rows[0].password_hash))) {
      return res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
    }
    const u = r.rows[0];
    const token = jwt.sign({ id: u.id, name: u.name, phone: u.phone }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: u.id, name: u.name, phone: u.phone, governorate: u.governorate, address: u.address } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// جلب طلبات الطالب الحالية
app.get('/api/user/orders', userAuth, async (req, res) => {
  try {
    const o = await db(`
      SELECT o.*, COALESCE(json_agg(json_build_object('title',oi.title,'price',oi.price,'qty',oi.qty)) FILTER (WHERE oi.id IS NOT NULL),'[]') items 
      FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id 
      WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.id DESC
    `, [req.user.id]);
    res.json({ orders: o.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------- إنشاء الطلب مع الربط بالحساب -------------------

app.post('/api/orders', async (req, res) => {
  const { customer_name, phone, governorate, address, notes, items, user_id } = req.body;
  if (!customer_name || !phone || !governorate || !address || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'أكمل بيانات الطلب' });
  }

  if (!isValidEgyptianPhone(phone)) {
    return res.status(400).json({ error: 'يرجى إدخال رقم هاتف مصري صحيح' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let total = 0, clean = [];
    for (const item of items) {
      const r = await client.query('SELECT id,title,price,available FROM books WHERE id=$1', [item.id]);
      if (!r.rowCount || !r.rows[0].available) continue;
      const qty = Math.max(1, Math.min(20, Number(item.qty) || 1));
      total += Number(r.rows[0].price) * qty;
      clean.push({ ...r.rows[0], qty });
    }
    if (!clean.length) throw Error('لا توجد كتب متاحة في السلة');
    
    const o = await client.query(
      'INSERT INTO orders(user_id, customer_name,phone,governorate,address,notes,total) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [user_id || null, customer_name, phone, governorate, address, notes || '', total]
    );
    
    for (const i of clean) {
      await client.query(
        'INSERT INTO order_items(order_id,book_id,title,price,qty) VALUES($1,$2,$3,$4,$5)',
        [o.rows[0].id, i.id, i.title, i.price, i.qty]
      );
    }
    await client.query('COMMIT');

    // تجهيز رابط الواتساب الجاهز لإرسال إشعار فوري
    const waPhone = '2' + phone;
    const waText = encodeURIComponent(`أهلاً ${customer_name}👋\nتم تسليم طلبك بنجاح في منصة XBOOK!\nرقم المهمة: #X-${o.rows[0].id}\nالإجمالي: ${total} ج.م\nحالة الطلب الحالية: جديد.`);
    const waLink = `https://wa.me/${waPhone}?text=${waText}`;

    res.json({ ok: true, order_id: o.rows[0].id, total, whatsapp_link: waLink });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// باقي مسارات المسؤول الأدمن...
app.get('/api/public', async (req, res) => {
  try {
    const [b, t, s, m] = await Promise.all([
      db(`SELECT b.id,b.title,b.subject,b.grade,b.price,b.available,b.featured,b.description,b.teacher_id,t.name teacher FROM books b LEFT JOIN teachers t ON t.id=b.teacher_id ORDER BY b.featured DESC,b.id DESC`),
      db('SELECT id,name,subject,bio,(image_data IS NOT NULL) has_image FROM teachers ORDER BY id'),
      db('SELECT key,value FROM site_settings'),
      db('SELECT key FROM site_media')
    ]);
    const settings = Object.fromEntries(s.rows.map(x => [x.key, x.value]));
    if (m.rows.some(x => x.key === 'hero')) settings.hero_image = '/api/media/site/hero';
    res.json({ books: b.rows, teachers: t.rows, settings });
  } catch (e) {
    res.status(500).json({ error: 'تعذر تحميل بيانات الموقع' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const r = await db('SELECT * FROM admins WHERE email=$1', [email]);
  if (!r.rowCount || !(await bcrypt.compare(password || '', r.rows[0].password_hash))) {
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  }
  res.json({ token: jwt.sign({ id: r.rows[0].id, email: r.rows[0].email }, JWT_SECRET, { expiresIn: '8h' }) });
});

app.get('/api/admin/data', adminAuth, async (req, res) => {
  try {
    const [b, t, o, s, m] = await Promise.all([
      db(`SELECT b.*,t.name teacher FROM books b LEFT JOIN teachers t ON t.id=b.teacher_id ORDER BY b.id DESC`),
      db('SELECT id,name,subject,bio,(image_data IS NOT NULL) has_image FROM teachers ORDER BY id DESC'),
      db(`SELECT o.*,COALESCE(json_agg(json_build_object('title',oi.title,'price',oi.price,'qty',oi.qty)) FILTER (WHERE oi.id IS NOT NULL),'[]') items FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.id DESC`),
      db('SELECT key,value FROM site_settings'),
      db('SELECT key FROM site_media')
    ]);
    res.json({ books: b.rows, teachers: t.rows, orders: o.rows, settings: Object.fromEntries(s.rows.map(x => [x.key, x.value])), media: m.rows.map(x => x.key) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// تحديث حالة الطلب وإرجاع رابط إرسال الواتساب التلقائي للأدمن
app.put('/api/admin/orders/:id', adminAuth, async (req, res) => {
  const allowed = ['جديد', 'قيد التجهيز', 'تم الشحن', 'مكتمل', 'ملغي'];
  const { status } = req.body;
  if (!allowed.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });

  const r = await db('UPDATE orders SET status=$1 WHERE id=$2 RETURNING customer_name, phone, total', [status, req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'الطلب غير موجود' });

  const order = r.rows[0];
  const waPhone = '2' + order.phone;
  const waText = encodeURIComponent(`مرحباً ${order.customer_name}👋\nتحديث جديد بشأن مهمتك #X-${req.params.id} على XBOOK:\nالحالة الحالية: [${status}]\nشكراً لتواصلك معنا!`);
  const waLink = `https://wa.me/${waPhone}?text=${waText}`;

  res.json({ ok: true, whatsapp_link: waLink });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

init().then(() => app.listen(PORT, () => console.log('XBOOK running on port ' + PORT))).catch(e => {
  console.error(e);
  process.exit(1);
});
