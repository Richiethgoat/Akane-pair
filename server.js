const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_DIR = path.join(__dirname, 'Akane-MD');
const ENV_PATH = path.join(BOT_DIR, '.env');
let botProc = null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

app.post('/start', (req, res) => {
  if (botProc) return res.status(400).send('Bot already running');
  botProc = spawn('node', ['index.js'], { cwd: BOT_DIR });
  botProc.stdout.on('data', d=>console.log(d.toString()));
  botProc.stderr.on('data', d=>console.error(d.toString()));
  botProc.on('exit', code=>{ console.log(`Bot exited ${code}`); botProc=null; });
  res.send('Bot started');
});

app.post('/stop', (req, res) => {
  if (!botProc) return res.status(400).send('Bot not running');
  botProc.kill(); botProc = null;
  res.send('Bot stopped');
});

app.post('/set-session', (req, res) => {
  const session = req.body.session;
  if (!session) return res.status(400).send('Session ID required');
  let env = fs.existsSync(ENV_PATH)? fs.readFileSync(ENV_PATH,'utf-8'): '';
  if (!env.includes('SESSION_ID=')) env += `SESSION_ID=${session}\n`;
  else env = env.replace(/SESSION_ID=.*/g, `SESSION_ID=${session}`);
  fs.writeFileSync(ENV_PATH, env);
  res.send('Session updated');
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));