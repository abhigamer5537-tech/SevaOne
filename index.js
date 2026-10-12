require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Razorpay = require('razorpay');
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb', verify: (req, _res, buf) => { if (req.originalUrl.startsWith('/api/payments/webhook')) req.rawBody = Buffer.from(buf); } }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false } });
const catalog = {
  pan: { name: 'PAN Card सहायता', amount: 15000 }, form: { name: 'ऑनलाइन फॉर्म', amount: 10000 },
  labour: { name: 'लेबर कार्ड सहायता', amount: 10000 }, print: { name: 'प्रिंट / फोटोकॉपी', amount: 500 },
  photo: { name: 'फोटो / पासपोर्ट फोटो', amount: 5000 }, lamination: { name: 'लैमिनेशन', amount: 3000 },
  mobile: { name: 'मोबाइल सॉफ्टवेयर सहायता', amount: 20000 }, repair: { name: 'मोबाइल रिपेयर जाँच', amount: 10000 },
  bill: { name: 'बिल भुगतान सहायता', amount: 2000 }, resume: { name: 'रिज्यूमे / टाइपिंग', amount: 10000 },
  ticket: { name: 'ट्रेन टिकट सहायता', amount: 5000 }, other: { name: 'अन्य डिजिटल सेवा', amount: 10000 }
};
const razorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error('Razorpay keys are not configured on server');
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};
const id = () => 'S1' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, app: 'SevaOne', database: 'connected' }); }
  catch { res.status(503).json({ ok: false, error: 'Database unavailable' }); }
});
app.post('/api/orders', async (req, res) => {
  const { serviceId, customerName, phone, state, district, pincode, referralCode = '', note = '' } = req.body || {};
  const service = catalog[serviceId];
  if (!service) return res.status(400).json({ error: 'यह सेवा सर्वर की मूल्य सूची में नहीं है।' });
  if (typeof customerName !== 'string' || !customerName.trim() || !/^\d{10}$/.test(String(phone || '')) || typeof state !== 'string' || !state || typeof district !== 'string' || !district || !/^\d{6}$/.test(String(pincode || ''))) return res.status(400).json({ error: 'ग्राहक का नाम, मोबाइल, राज्य, जिला और सही PIN भरें।' });
  const orderId = id();
  try {
    await pool.query(`INSERT INTO orders(id,service_id,service_name,amount_paise,customer_name,phone,state,district,pincode,referral_code,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [orderId, serviceId, service.name, service.amount, customerName.trim().slice(0,100), String(phone), state.slice(0,80), district.slice(0,80), String(pincode), String(referralCode).slice(0,10), String(note).slice(0,500)]);
    res.status(201).json({ order: { id: orderId, amount: service.amount, serviceName: service.name } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'ऑर्डर सेव नहीं हो सका।' }); }
});
app.post('/api/payments/create', async (req, res) => {
  const orderId = String(req.body?.orderId || '');
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [orderId]);
    const order = rows[0]; if (!order) return res.status(404).json({ error: 'ऑर्डर नहीं मिला।' });
    if (order.payment_status === 'Paid') return res.status(409).json({ error: 'यह ऑर्डर पहले ही Paid है।' });
    if (order.razorpay_order_id) return res.json({ keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: order.razorpay_order_id, amount: order.amount_paise, currency: 'INR' });
    const rpOrder = await razorpay().orders.create({ amount: order.amount_paise, currency: 'INR', receipt: order.id, notes: { sevaone_order_id: order.id, service_id: order.service_id } });
    await pool.query('UPDATE orders SET razorpay_order_id=$1,payment_status=$2 WHERE id=$3', [rpOrder.id, 'Payment Started', order.id]);
    res.json({ keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Razorpay ऑर्डर नहीं बन सका। सर्वर कॉन्फ़िगरेशन जाँचें।' }); }
});
app.post('/api/payments/verify', async (req, res) => {
  const { orderId, razorpay_order_id: rpOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  if (![orderId, rpOrderId, paymentId, signature].every(v => typeof v === 'string' && v.length < 256)) return res.status(400).json({ verified: false, error: 'पेमेंट सत्यापन डेटा अधूरा है।' });
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1 AND razorpay_order_id=$2', [orderId, rpOrderId]);
    const order = rows[0]; if (!order) return res.status(404).json({ verified: false, error: 'ऑर्डर और पेमेंट का मिलान नहीं हुआ।' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${rpOrderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ verified: false, error: 'Signature गलत है।' });
    // Verify the payment/order details with Razorpay before marking paid.
    const rp = razorpay(); const payment = await rp.payments.fetch(paymentId);
    if (payment.order_id !== rpOrderId || Number(payment.amount) !== Number(order.amount_paise) || payment.currency !== 'INR' || payment.status !== 'captured') return res.status(400).json({ verified: false, error: 'Razorpay पेमेंट विवरण मेल नहीं खाते या भुगतान पूरा नहीं हुआ।' });
    await pool.query(`UPDATE orders SET payment_status='Paid',razorpay_payment_id=$1,paid_at=NOW() WHERE id=$2`, [paymentId, orderId]);
    res.json({ verified: true, orderId, paymentId });
  } catch (e) { console.error(e); res.status(500).json({ verified: false, error: 'पेमेंट की पुष्टि अभी नहीं हो सकी। दोबारा भुगतान न करें; स्थिति जाँचें।' }); }
});
// Razorpay Dashboard webhook URL: /api/payments/webhook. Configure the same secret in .env and Dashboard.
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).send('Webhook secret not configured');
    const sig = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;
    if (!rawBody) return res.status(400).send('Missing raw webhook body');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (typeof sig !== 'string' || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(400).send('Invalid signature');
    const event = JSON.parse(rawBody.toString('utf8'));
    const eventId = req.headers['x-razorpay-event-id'] || null;
    await pool.query('INSERT INTO payment_events(event_id,event_type,payload) VALUES($1,$2,$3) ON CONFLICT(event_id) DO NOTHING', [eventId, event.event || 'unknown', event]);
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const entity = event.payload?.payment?.entity || event.payload?.order?.entity;
      const rpOrderId = entity?.order_id || entity?.id;
      const paymentId = event.payload?.payment?.entity?.id || null;
      if (rpOrderId) await pool.query(`UPDATE orders SET payment_status='Paid',razorpay_payment_id=COALESCE($1,razorpay_payment_id),paid_at=COALESCE(paid_at,NOW()) WHERE razorpay_order_id=$2`, [paymentId, rpOrderId]);
    }
    res.json({ received: true });
  } catch (e) { console.error(e); res.status(500).send('Webhook handling failed'); }
});
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*path', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
const port = Number(process.env.PORT || 3000);
(async () => {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(1); }
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  app.listen(port, '0.0.0.0', () => console.log(`SevaOne listening on ${port}`));
})().catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
