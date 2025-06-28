const express = require('express');
const cors = require('cors');
const Boom = require('@hapi/boom');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
} = require('@fizzxydev/baileys-pro');

const app = express();
app.use(cors());
app.use(express.json());

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
  
  kunle.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || !messages[0]) return;
    const msg = messages[0];
    console.log(`📥 [${phone}] Message received:`, msg.message);
  });
  
  sessions.set(phone, kunle);
  return kunle;
}

app.post('/pair', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^[0-9]{8,15}$/.test(phone)) {
    const error = Boom.badRequest('Invalid phone number');
    return res.status(error.output.statusCode).json(error.output.payload);
  }
  
  try {
    const kunle = await createOrGetSession(phone);
    
    if (!kunle.authState.creds.registered) {
      const code = await kunle.requestPairingCode(phone, 'KING-RICH');
      return res.json({ code });
    } else {
      return res.json({ message: 'Already paired' });
    }
  } catch (err) {
    const error = Boom.badImplementation(err.message || 'Unknown error');
    return res.status(error.output.statusCode).json(error.output.payload);
  }
});

app.listen(3000, () => console.log('🚀 Richie Host server running at http://localhost:3000'));