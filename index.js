// 1. استدعاء المكتبات
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

// 2. إنشاء تطبيق Express
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 3. إعداد الاتصال بقاعدة بيانات PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('خطأ في الاتصال أو الاستعلام من قاعدة بيانات PostgreSQL:', err);
  } else {
    console.log('تم الاتصال بقاعدة بيانات PostgreSQL بنجاح. الوقت الحالي:', res.rows[0].now);
  }
});

// --- المسارات (ROUTES) للعملاء ---

// POST /clients - لإضافة عميل جديد
app.post('/clients', async (req, res) => {
  let { name, civil_id, phone, email, address, notes } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'اسم العميل مطلوب.' });
  }

  civil_id = civil_id && civil_id.trim() !== '' ? civil_id.trim() : null;
  phone = phone && phone.trim() !== '' ? phone.trim() : null;
  email = email && email.trim() !== '' ? email.trim() : null;
  address = address && address.trim() !== '' ? address.trim() : null;
  notes = notes && notes.trim() !== '' ? notes.trim() : null;

  if (civil_id && civil_id.length !== 12) {
    return res.status(400).json({ error: 'الرقم المدني يجب أن يتكون من 12 رقمًا إذا تم إدخاله.' });
  }
  if (phone && phone.length !== 8) {
    return res.status(400).json({ error: 'رقم الهاتف يجب أن يتكون من 8 أرقام إذا تم إدخاله.' });
  }

  let clientCode = null;
  const clientValues = [];
  let sql;

  try {
    if (civil_id) {
      const checkCivilIdSql = 'SELECT id FROM clients WHERE civil_id = $1';
      const civilIdCheckResult = await pool.query(checkCivilIdSql, [civil_id]);
      if (civilIdCheckResult.rows.length > 0) {
        return res.status(409).json({ error: 'فشل في إضافة العميل. الرقم المدني مستخدم مسبقاً.' });
      }

      const lastCodeSql = "SELECT client_code FROM clients WHERE client_code IS NOT NULL ORDER BY CAST(SUBSTRING(client_code FROM 2) AS INTEGER) DESC LIMIT 1";
      const lastCodeResult = await pool.query(lastCodeSql);
      let nextNumericCode = 1;
      if (lastCodeResult.rows.length > 0 && lastCodeResult.rows[0].client_code) {
        nextNumericCode = parseInt(lastCodeResult.rows[0].client_code.substring(1)) + 1;
      }
      clientCode = 'N' + String(nextNumericCode).padStart(5, '0');

      sql = `
        INSERT INTO clients (name, civil_id, phone, email, address, notes, client_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;`;
      clientValues.push(name, civil_id, phone, email, address, notes, clientCode);
    } else {
      sql = `
        INSERT INTO clients (name, civil_id, phone, email, address, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;`;
      clientValues.push(name, civil_id, phone, email, address, notes);
    }

    const result = await pool.query(sql, clientValues);
    console.log('تمت إضافة عميل جديد بنجاح:', result.rows[0]);
    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('خطأ عند إضافة العميل: ', err);
    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('email')) {
        return res.status(409).json({ error: 'فشل في إضافة العميل. البريد الإلكتروني مستخدم مسبقاً.' });
      }
    }
    res.status(500).json({ error: 'حدث خطأ أثناء محاولة إضافة العميل.' });
  }
});

// GET /clients - لعرض جميع العملاء
app.get('/clients', async (req, res) => {
  const sql = 'SELECT id, client_code, name, civil_id, phone, email, address, notes, created_at FROM clients ORDER BY created_at DESC';
  try {
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('خطأ عند جلب العملاء: ', err);
    res.status(500).json({ error: 'حدث خطأ أثناء محاولة جلب العملاء.' });
  }
});

// --- تشغيل الخادم ---
app.listen(port, () => {
  console.log(`خادم إدارة ورشة النجارة يعمل الآن على المنفذ ${port}`);
});