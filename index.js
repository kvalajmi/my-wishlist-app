// 1. استدعاء المكتبات
const express = require('express');
const { Pool } = require('pg'); // لاستخدام PostgreSQL
const path = require('path');

// 2. إنشاء تطبيق Express
const app = express();
const port = process.env.PORT || 3000;

// Middleware (برمجيات وسيطة)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 3. إعداد الاتصال بقاعدة بيانات PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // هذا ما ستستخدمه Render (سنضبطه لاحقاً)
  // للتشغيل المحلي المبدئي (بدون قاعدة بيانات بعد)، يمكن تعليق هذا أو توفير قيم افتراضية إذا لزم الأمر
  // ولكن بما أننا سننشئ قاعدة بيانات على Render قريباً، سنعتمد على DATABASE_URL
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// اختبار الاتصال بقاعدة البيانات
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('خطأ في الاتصال أو الاستعلام من قاعدة بيانات PostgreSQL:', err);
    console.log('تأكد أن متغير البيئة DATABASE_URL تم تعيينه بشكل صحيح إذا كنت تنشر التطبيق.');
    console.log('إذا كنت تشغل محلياً، تأكد أن قاعدة بيانات PostgreSQL تعمل وأن معلومات الاتصال صحيحة (إذا لم تستخدم DATABASE_URL).');
  } else {
    console.log('تم الاتصال بقاعدة بيانات PostgreSQL بنجاح. الوقت الحالي من الخادم:', res.rows[0].now);
  }
});

// -------------------------------------------------------------------
// --- المسارات (ROUTES) للعملاء ---
// -------------------------------------------------------------------

// POST /clients - لإضافة عميل جديد
app.post('/clients', async (req, res) => {
  const { name, civil_id, phone, email, address, notes } = req.body;

  // تحقق مبدئي من البيانات (يمكن إضافة المزيد من التحققات)
  if (!name || !civil_id) {
    return res.status(400).json({ error: 'الاسم والرقم المدني مطلوبان.' });
  }
  if (civil_id.length !== 12) { // افتراض أن الرقم المدني يجب أن يكون 12 رقماً
      return res.status(400).json({ error: 'الرقم المدني يجب أن يتكون من 12 أرقام.' });
  }

  // (يمكن إضافة client_code هنا أو تركه لقاعدة البيانات لتوليده إذا كان هناك تسلسل)
  const sql = `
    INSERT INTO clients (name, civil_id, phone, email, address, notes)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;`; // RETURNING * سيعيد كل بيانات العميل المضاف
  const values = [name, civil_id, phone, email, address, notes];

  try {
    const result = await pool.query(sql, values);
    console.log('تمت إضافة عميل جديد بنجاح:', result.rows[0]);
    // بدلاً من إعادة التوجيه، سنرسل بيانات العميل المضاف كـ JSON
    // هذا أفضل للـ APIs التي قد تتفاعل معها واجهة أمامية مبنية بـ JavaScript بشكل كامل
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('خطأ عند إضافة العميل: ', err);
    // تحقق إذا كان الخطأ بسبب قيمة مكررة (مثل الرقم المدني أو الإيميل)
    if (err.code === '23505') { // 23505 هو كود خطأ القيمة المكررة في PostgreSQL
        return res.status(409).json({ error: 'فشل في إضافة العميل. الرقم المدني أو البريد الإلكتروني مستخدم مسبقاً.' });
    }
    res.status(500).json({ error: 'حدث خطأ أثناء محاولة إضافة العميل.' });
  }
});

// GET /clients - لعرض جميع العملاء
app.get('/clients', async (req, res) => {
  const sql = 'SELECT id, name, civil_id, phone, email, address, notes, created_at FROM clients ORDER BY created_at DESC';
  try {
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('خطأ عند جلب العملاء: ', err);
    res.status(500).json({ error: 'حدث خطأ أثناء محاولة جلب العملاء.' });
  }
});

// (سنضيف مسارات المشاريع هنا لاحقاً)

// -------------------------------------------------------------------
// --- تشغيل الخادم ---
// -------------------------------------------------------------------
app.listen(port, () => {
  console.log(`خادم إدارة ورشة النجارة يعمل الآن على المنفذ ${port}`);
});