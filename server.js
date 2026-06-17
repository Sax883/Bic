const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'bic-canada-secret';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'biccanada@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Power081';
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI environment variable.');
  process.exit(1);
}

let db;
let mongoClient;

async function connectDb() {
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db();
  try {
    await db.collection('clients').createIndex({ email: 1 }, { unique: true });
    await db.collection('messages').createIndex({ client_id: 1 });
    await db.collection('audit_logs').createIndex({ audit_id: 1 }, { unique: true });
  } catch (err) {
    console.warn('MongoDB index creation warning:', err.message);
  }
  console.log('Connected to MongoDB');
}

function getClientCollection() {
  return db.collection('clients');
}

function getMessagesCollection() {
  return db.collection('messages');
}

function getAuditCollection() {
  return db.collection('audit_logs');
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '3h' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function normalizeClient(client) {
  const defaultFinancials = {
    total_refund_eligible: 0,
    total_refund_initiated: 0,
    total_refund_pending: 0,
    total_refund_activated: 0,
    total_refund_settled: 0,
    paid_to_date: 0,
    amount_refunded: 0,
    remaining_balance: 0,
    outstanding_balance: 0,
    currency: 'CAD'
  };
  client.financials = { ...defaultFinancials, ...client.financials };
  client.progress = {
    audit_completed: false,
    refund_authorized: false,
    processing: false,
    funds_disbursed: false,
    ...client.progress
  };
  if (!client.admin_notes) client.admin_notes = '';
  if (!client.updated_at) client.updated_at = new Date().toISOString();
  return client;
}

async function authenticateClient(req, res, next) {
  const authHeader = req.headers.authorization || req.cookies.token;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'client') return res.status(401).json({ error: 'Unauthorized' });
  req.client = payload;
  next();
}

async function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization || req.cookies.token;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
  req.admin = payload;
  next();
}

app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));
app.use('/image', express.static(path.join(__dirname, 'image')));

app.post('/api/auth/client/login', async (req, res) => {
  const { email, password } = req.body;
  const client = await getClientCollection().findOne({ email, password_hash: password });
  if (!client) return res.status(400).json({ error: 'Invalid credentials' });
  const token = generateToken({ type: 'client', email: client.email, client_id: client.client_id, full_name: client.full_name });
  res.json({ token, client_id: client.client_id, full_name: client.full_name });
});

app.post('/api/auth/client/signup', async (req, res) => {
  const { full_name, email, password, enrollment_type, refund_amount } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'full_name, email, and password are required' });
  }
  const existing = await getClientCollection().findOne({ email });
  if (existing) return res.status(400).json({ error: 'Email already registered' });
  const idSuffix = Date.now().toString().slice(-4);
  const clientId = `BIC-2026-${idSuffix}`;
  const initiatedAmount = Number(refund_amount || 0);
  const newClient = {
    client_id: clientId,
    full_name,
    email,
    password_hash: password,
    enrollment_type,
    application_date: new Date().toISOString().slice(0, 10),
    status: 'Under Review',
    financials: {
      total_refund_eligible: 0,
      total_refund_initiated: initiatedAmount,
      total_refund_pending: initiatedAmount,
      total_refund_activated: 0,
      total_refund_settled: 0,
      paid_to_date: 0,
      amount_refunded: 0,
      remaining_balance: initiatedAmount,
      outstanding_balance: initiatedAmount,
      currency: 'CAD'
    },
    refund_history: [],
    progress: {
      audit_completed: false,
      refund_authorized: false,
      processing: false,
      funds_disbursed: false
    },
    admin_notes: 'New client registration pending verification.',
    payout_info: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  await getClientCollection().insertOne(newClient);
  res.json({ message: 'Signup successful. Please log in.', client_id: clientId });
});

app.post('/api/auth/client/forgot', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const client = await getClientCollection().findOne({ email });
  if (!client) return res.status(400).json({ error: 'Email not found' });
  res.json({ message: 'Password reset requested. Use your registered password or contact support.', email });
});

app.post('/api/auth/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(400).json({ error: 'Invalid admin credentials' });
  }
  const token = generateToken({ type: 'admin', email: ADMIN_EMAIL, name: 'BIC Canada Admin' });
  res.json({ token, name: 'BIC Canada Admin' });
});

app.get('/api/client/dashboard', authenticateClient, async (req, res) => {
  const client = await getClientCollection().findOne({ client_id: req.client.client_id });
  if (!client) return res.status(404).json({ error: 'Client data not found' });
  res.json({ client: normalizeClient(client) });
});

app.get('/api/admin/clients', authenticateAdmin, async (req, res) => {
  const clients = await getClientCollection().find().toArray();
  res.json({ clients: clients.map(normalizeClient) });
});

app.get('/api/admin/client/:clientId', authenticateAdmin, async (req, res) => {
  const client = await getClientCollection().findOne({ client_id: req.params.clientId });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json({ client: normalizeClient(client) });
});

app.post('/api/admin/update-refund', authenticateAdmin, async (req, res) => {
  const {
    client_id,
    total_refund_eligible,
    total_refund_initiated,
    total_refund_pending,
    total_refund_activated,
    total_refund_settled,
    paid_to_date,
    outstanding_balance,
    amount_to_refund,
    status,
    admin_notes,
    transaction_method,
    progress
  } = req.body;

  const client = await getClientCollection().findOne({ client_id });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const updatedClient = normalizeClient(client);
  const original = JSON.parse(JSON.stringify(updatedClient));

  updatedClient.financials.total_refund_eligible = Number(total_refund_eligible);
  updatedClient.financials.total_refund_initiated = Number(total_refund_initiated);
  updatedClient.financials.total_refund_pending = Number(total_refund_pending);
  updatedClient.financials.total_refund_activated = Number(total_refund_activated);
  updatedClient.financials.total_refund_settled = Number(total_refund_settled);
  updatedClient.financials.paid_to_date = Number(paid_to_date);
  updatedClient.financials.amount_refunded = Number(amount_to_refund);
  updatedClient.financials.outstanding_balance = Number(outstanding_balance);
  updatedClient.financials.remaining_balance = Number(
    (updatedClient.financials.outstanding_balance || updatedClient.financials.total_refund_initiated - updatedClient.financials.paid_to_date).toFixed(2)
  );
  updatedClient.status = status;
  updatedClient.admin_notes = admin_notes;
  updatedClient.progress = {
    audit_completed: Boolean(progress?.audit_completed),
    refund_authorized: Boolean(progress?.refund_authorized),
    processing: Boolean(progress?.processing),
    funds_disbursed: Boolean(progress?.funds_disbursed)
  };
  updatedClient.transaction_method = transaction_method;
  updatedClient.updated_at = new Date().toISOString();

  if (Number(amount_to_refund) > original.financials.amount_refunded) {
    updatedClient.refund_history.unshift({
      transaction_id: `TXN-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().slice(0, 10),
      amount: Number(amount_to_refund) - original.financials.amount_refunded,
      method: transaction_method || 'Direct Bank Transfer',
      status: status === 'Cleared' ? 'Completed' : status
    });
  }

  await getClientCollection().updateOne(
    { client_id },
    { $set: updatedClient }
  );

  await getAuditCollection().insertOne({
    audit_id: `AUD-${Date.now().toString().slice(-8)}`,
    admin: req.admin.email,
    client_id,
    changed_at: new Date().toISOString(),
    previous: {
      total_refund_eligible: original.financials.total_refund_eligible,
      amount_refunded: original.financials.amount_refunded,
      remaining_balance: original.financials.remaining_balance,
      status: original.status,
      admin_notes: original.admin_notes,
      progress: original.progress
    },
    updated: {
      total_refund_eligible: updatedClient.financials.total_refund_eligible,
      amount_refunded: updatedClient.financials.amount_refunded,
      remaining_balance: updatedClient.financials.remaining_balance,
      status: updatedClient.status,
      admin_notes: updatedClient.admin_notes,
      progress: updatedClient.progress
    }
  });

  res.json({ message: 'Client ledger updated successfully.', client: updatedClient });
});

app.post('/api/client/save-payout', authenticateClient, async (req, res) => {
  const { payout_method, payout_currency, account_name, bank_name, account_number, swift_code, postal_code, country, notes } = req.body;
  const client = await getClientCollection().findOne({ client_id: req.client.client_id });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const payoutInfo = {
    payout_method,
    payout_currency,
    account_name,
    bank_name,
    account_number,
    swift_code,
    postal_code,
    country,
    notes,
    updated_at: new Date().toISOString()
  };
  await getClientCollection().updateOne(
    { client_id: req.client.client_id },
    { $set: { payout_info: payoutInfo, updated_at: new Date().toISOString() } }
  );
  res.json({ message: 'Payment details saved successfully.', payout_info: payoutInfo });
});

app.post('/api/client/send-message', authenticateClient, async (req, res) => {
  const { message_text } = req.body;
  if (!message_text || message_text.trim().length === 0) return res.status(400).json({ error: 'Message cannot be empty' });
  await getMessagesCollection().insertOne({
    message_id: Date.now().toString(),
    client_id: req.client.client_id,
    client_name: req.client.full_name,
    message_text,
    sender: 'client',
    created_at: new Date().toISOString(),
    admin_reply: null,
    admin_reply_at: null
  });
  res.json({ message: 'Message sent successfully.' });
});

app.get('/api/admin/messages', authenticateAdmin, async (req, res) => {
  const messages = await getMessagesCollection().find().sort({ created_at: -1 }).toArray();
  res.json({ messages });
});

app.post('/api/admin/reply-message', authenticateAdmin, async (req, res) => {
  const { message_id, reply_text } = req.body;
  if (!reply_text || reply_text.trim().length === 0) return res.status(400).json({ error: 'Reply cannot be empty' });
  const result = await getMessagesCollection().findOneAndUpdate(
    { message_id },
    {
      $set: {
        admin_reply: reply_text,
        admin_reply_at: new Date().toISOString()
      }
    },
    { returnDocument: 'after' }
  );
  if (!result.value) return res.status(404).json({ error: 'Message not found' });
  res.json({ message: 'Reply sent successfully.' });
});

app.get('/api/client/messages', authenticateClient, async (req, res) => {
  const messages = await getMessagesCollection()
    .find({ client_id: req.client.client_id })
    .sort({ created_at: -1 })
    .toArray();
  res.json({ messages });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

async function startServer() {
  await connectDb();
  app.listen(PORT, () => {
    console.log(`BIC Canada Refund portal running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
