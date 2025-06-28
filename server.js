const express = require('express');
const cors = require('cors');
const Boom = require('@hapi/boom');
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
} = require('@fizzxydev/baileys-pro');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map(); // phone -> socket

async function createOrGetSession(phone) {
  if (sessions.has(phone)) return sessions.get(phone);
  
  const { state, saveCreds } = await useMultiFileAuthState(`./auth/${phone}`);
  const kunle = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.macOS('Richie Host'),
  });
  
  kunle.ev.on('creds.update', saveCreds);
  kunle.ev.on('connection.update', (update) => {
    console.log(`📶 [${phone}] Connection Update:`, update.connection || 'no status');
    if (update.lastDisconnect) {
      console.log(`⚠️ [${phone}] Disconnected:`, update.lastDisconnect?.error?.message || update.lastDisconnect);
    }
    if (update.connection === 'open') {
      console.log(`✅ [${phone}] Connected`);
    }
  });
  
  kunle.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages || !messages[0]) return;
    const msg = messages[0];
    console.log(`📥 [${phone}] Message received:`, msg.message);
  });

  sessions.set(phone, kunle);
  return kunle;
}

app.get('/pair', async (req, res) => {
  const { phone } = req.query;

  if (!phone) {
    return res.status(400).json({
      status: 'error',
      message: '🚫 Missing phone number in URL.',
      usage: 'GET /pair?phone=2349012345678',
      example: 'http://localhost:3000/pair?phone=2349012345678'
    });
  }

  if (!/^[0-9]{8,15}$/.test(phone)) {
    return res.status(400).json({
      status: 'error',
      message: '❌ Invalid phone number format.',
      hint: 'Only digits allowed. No +, no spaces.',
      correct_example: '/pair?phone=2349012345678'
    });
  }

  try {
    const kunle = await createOrGetSession(phone);

    if (!kunle.authState.creds.registered) {
      const code = await kunle.requestPairingCode(phone, 'KING-RICH');
      return res.json({ status: 'success', message: '✅ Pairing code generated', code });
    } else {
      return res.json({ status: 'info', message: 'Already paired.' });
    }
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: '🔥 Server error during pairing.',
      details: err.message || 'Unknown issue'
    });
  }
});

app.listen(3000, () => console.log('🚀 Richie Host server running at http://localhost:3000'));