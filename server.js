const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { MongoClient } = require('mongodb');

// Brevo (ex Sendinblue) API key - usa HTTP, non bloccato da Render, nessun dominio richiesto
const brevoApiKey = process.env.BREVO_API_KEY || null;

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.json');
const EMAILS_FILE = path.join(__dirname, 'emails.json');
const KEY_FILE = path.join(__dirname, 'key.pem');
const CERT_FILE = path.join(__dirname, 'cert.pem');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const EVENT_SETTINGS_FILE = path.join(__dirname, 'event_settings.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Persisted state for participants and simulated emails
let participantsStore = [];
let simulatedEmails = [];
let useMongo = false;

// SSE (Server-Sent Events) clients for real-time dashboard updates
let sseClients = [];

function broadcastEvent(type, data) {
  sseClients.forEach(client => {
    try {
      client.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    } catch (e) {
      console.error("Errore invio evento SSE ad un client:", e);
    }
  });
}

// SMTP & Event Config values (initialized to defaults, loaded dynamically by helper)
let smtpConfig = { enabled: false, host: '', port: '465', user: '', pass: '' };
let eventConfig = {
  title: process.env.EVENT_TITLE || "Mio Evento Speciale",
  date: process.env.EVENT_DATE || new Date().toISOString().split('T')[0],
  time: process.env.EVENT_TIME || "20:00",
  location: process.env.EVENT_LOCATION || "Roma"
};

function loadConfigFromFiles() {
  // SMTP Config
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    smtpConfig = {
      enabled: true,
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || '465',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    };
    console.log('SMTP configurato tramite variabili d\'ambiente.');
  } else if (fs.existsSync(SETTINGS_FILE)) {
    try {
      smtpConfig = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      console.log('SMTP configurato tramite settings.json locale.');
    } catch (e) {
      console.error("Errore lettura settings.json:", e);
    }
  }

  // Event Config
  if (process.env.EVENT_TITLE) {
    eventConfig = {
      title: process.env.EVENT_TITLE,
      date: process.env.EVENT_DATE || new Date().toISOString().split('T')[0],
      time: process.env.EVENT_TIME || "20:00",
      location: process.env.EVENT_LOCATION || "Roma"
    };
    console.log('Configurazione evento caricata da variabili d\'ambiente.');
  } else if (fs.existsSync(EVENT_SETTINGS_FILE)) {
    try {
      eventConfig = JSON.parse(fs.readFileSync(EVENT_SETTINGS_FILE, 'utf8'));
      console.log('Configurazione evento caricata da event_settings.json locale.');
    } catch (e) {
      console.error("Errore lettura event_settings.json:", e);
    }
  }
}
loadConfigFromFiles();

// Database integration variables
const MONGODB_URI = process.env.MONGODB_URI || null;
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
let mongoClient = null;
let db = null;
let supabase = null;
let useSupabase = false;

async function initSupabaseConnection() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Supabase non configurato. Il server continuerà con il fallback locale.');
    return false;
  }
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    useSupabase = true;
    console.log('Connessione a Supabase stabilita.');
    return true;
  } catch (error) {
    console.error('Errore connessione Supabase:', error.message);
    supabase = null;
    useSupabase = false;
    return false;
  }
}

async function initMongoConnection() {
  if (!MONGODB_URI) {
    console.log("MONGODB_URI non definita. Il server funzionerà in modalità locale (senza persistenza cloud).");
    useMongo = false;
    return false;
  }
  try {
    console.log("Connessione a MongoDB in corso...");
    const mongoOptions = {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      tls: true
    };

    if (process.env.MONGO_TLS_INSECURE === 'true') {
      mongoOptions.tlsInsecure = true;
      mongoOptions.tlsAllowInvalidHostnames = true;
    }

    mongoClient = new MongoClient(MONGODB_URI, mongoOptions);
    await mongoClient.connect();
    db = mongoClient.db();
    useMongo = true;
    console.log("Connessione a MongoDB stabilita con successo.");
    return true;
  } catch (error) {
    console.error("Errore durante la connessione a MongoDB:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    mongoClient = null;
    db = null;
    useMongo = false;
    return false;
  }
}

async function syncFromDb() {
  if (!db) return;
  console.log("Sincronizzazione dati da MongoDB...");
  try {
    const participantsDoc = await db.collection('app_data').findOne({ key: 'participants' });
    if (participantsDoc && Array.isArray(participantsDoc.value)) {
      participantsStore = participantsDoc.value;
      fs.writeFileSync(DB_FILE, JSON.stringify(participantsStore, null, 2));
    } else if (fs.existsSync(DB_FILE)) {
      const localParticipants = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      await db.collection('app_data').updateOne(
        { key: 'participants' },
        { $set: { key: 'participants', value: localParticipants, updatedAt: new Date() } },
        { upsert: true }
      );
      participantsStore = localParticipants;
    }

    const emailsDoc = await db.collection('app_data').findOne({ key: 'emails' });
    if (emailsDoc && Array.isArray(emailsDoc.value)) {
      simulatedEmails = emailsDoc.value;
      fs.writeFileSync(EMAILS_FILE, JSON.stringify(simulatedEmails, null, 2));
    } else if (fs.existsSync(EMAILS_FILE)) {
      const localEmails = JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf8'));
      await db.collection('app_data').updateOne(
        { key: 'emails' },
        { $set: { key: 'emails', value: localEmails, updatedAt: new Date() } },
        { upsert: true }
      );
      simulatedEmails = localEmails;
    }

    const settingsDoc = await db.collection('app_data').findOne({ key: 'settings' });
    if (settingsDoc && settingsDoc.value) {
      smtpConfig = settingsDoc.value.smtpConfig || smtpConfig;
      eventConfig = settingsDoc.value.eventConfig || eventConfig;
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(smtpConfig, null, 2));
      fs.writeFileSync(EVENT_SETTINGS_FILE, JSON.stringify(eventConfig, null, 2));
    }
  } catch (err) {
    console.error('Errore sincronizzazione MongoDB:', err.message);
  }
  console.log('Sincronizzazione da MongoDB completata.');
}

async function backupToDb() {
  if (!db) return;
  try {
    await db.collection('app_data').updateOne(
      { key: 'participants' },
      { $set: { key: 'participants', value: participantsStore, updatedAt: new Date() } },
      { upsert: true }
    );
    await db.collection('app_data').updateOne(
      { key: 'emails' },
      { $set: { key: 'emails', value: simulatedEmails, updatedAt: new Date() } },
      { upsert: true }
    );
    await db.collection('app_data').updateOne(
      { key: 'settings' },
      { $set: { key: 'settings', value: { smtpConfig, eventConfig }, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error('Errore backup dati su MongoDB:', err.message);
  }
}

// Generate SSL certificates for optional HTTPS access (local testing on mobile camera)
function generateSSLCertificates() {
  if (!fs.existsSync(KEY_FILE) || !fs.existsSync(CERT_FILE)) {
    console.log("Generazione certificati SSL self-signed...");
    try {
      execSync(`openssl req -subj '/CN=localhost' -x509 -newkey rsa:2048 -nodes -keyout "${KEY_FILE}" -out "${CERT_FILE}" -days 365`, { stdio: 'ignore' });
      console.log("Certificati SSL generati.");
    } catch (e) {
      console.log("Openssl non disponibile o errore generazione, l'avvio HTTPS potrebbe fallire. Verrà usato solo HTTP.");
    }
  }
}
generateSSLCertificates();

function loadPersistedData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      participantsStore = JSON.parse(raw);
    } else {
      participantsStore = [];
    }
  } catch (error) {
    console.error("Errore lettura database partecipanti:", error);
    participantsStore = [];
  }

  try {
    if (fs.existsSync(EMAILS_FILE)) {
      simulatedEmails = JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf8'));
    } else {
      simulatedEmails = [];
    }
  } catch (error) {
    console.error("Errore lettura archivio email:", error);
    simulatedEmails = [];
  }
}
loadPersistedData();

// Helper to read database
function readParticipants() {
  return Array.isArray(participantsStore) ? participantsStore : [];
}

// Helper to write database
async function persistToRemote() {
  if (useSupabase && supabase) {
    try {
      await supabase.from('app_data').upsert([
        { key: 'participants', value: participantsStore },
        { key: 'emails', value: simulatedEmails },
        { key: 'settings', value: { smtpConfig, eventConfig } }
      ], { onConflict: 'key' });
    } catch (error) {
      console.error('Errore salvataggio Supabase:', error.message);
    }
  } else if (useMongo && db) {
    try {
      await backupToDb();
    } catch (error) {
      console.error('Errore backup MongoDB:', error.message);
    }
  }
}

function writeParticipants(data) {
  try {
    participantsStore = Array.isArray(data) ? data : [];
    fs.writeFileSync(DB_FILE, JSON.stringify(participantsStore, null, 2));
    persistToRemote().catch(() => {});
    return true;
  } catch (error) {
    console.error("Errore scrittura database partecipanti:", error);
    return false;
  }
}

function writeEmails(data) {
  try {
    simulatedEmails = Array.isArray(data) ? data : [];
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(simulatedEmails, null, 2));
    persistToRemote().catch(() => {});
    return true;
  } catch (error) {
    console.error("Errore scrittura archivio email:", error);
    return false;
  }
}

// Helper to get local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if ((alias.family === 'IPv4' || alias.family === 4) && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

// Helper: Format date in IT style
function formatDateIt(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Helper: Simulate email sending and trigger real SMTP delivery if active
function sendSimulatedEmail(participant) {
  const emailId = `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const emailObj = {
    id: emailId,
    to: participant.email,
    subject: `🎟️ Il tuo biglietto d'ingresso per l'evento - ${participant.name} ${participant.surname}`,
    body: `Ciao <strong>${participant.name} ${participant.surname}</strong>,<br><br>ecco il tuo pass di ingresso per l'evento. Ti preghiamo di mostrare questo codice QR all'ingresso per effettuare il check-in.<br><br>Grazie e a presto!<br><em>Lo staff dell'evento</em>`,
    qrCode: participant.qrCode,
    participantId: participant.id,
    note: typeof participant.note === 'string' ? participant.note.trim() : '',
    sentAt: new Date().toISOString(),
    smtpStatus: smtpConfig.enabled ? "In invio..." : "Disattivato (Solo Simulazione)",
    smtpError: null
  };

  // Prepend to simulated emails store and persist it
  simulatedEmails.unshift(emailObj);
  writeEmails(simulatedEmails);

  // If real SMTP is configured, attempt real email delivery
  if (smtpConfig && smtpConfig.enabled) {
    sendRealEmail(emailObj, participant);
  }

  return emailObj;
}

// Helper: Send real email
async function sendRealEmail(emailObj, participant) {
  try {
    // Priorità 1: Brevo API (HTTP, mai bloccato, nessun dominio richiesto)
    if (brevoApiKey) {
      await sendViaBrevo(emailObj, participant);
      return;
    }
    // Priorità 2: nodemailer SMTP (sviluppo locale)
    const port = parseInt(smtpConfig.port) || 587;
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      },
      tls: { rejectUnauthorized: false }
    });

    const htmlContent = buildEmailHtml(participant, 'cid:qrcode');

    const mailOptions = {
      from: `"EventAccess" <${smtpConfig.user}>`,
      to: emailObj.to,
      subject: emailObj.subject,
      html: htmlContent,
      attachments: [
        {
          filename: 'qrcode.png',
          content: participant.qrCode.split(',')[1],
          encoding: 'base64',
          cid: 'qrcode'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    
    // Update status in simulated list
    const foundEmail = simulatedEmails.find(e => e.id === emailObj.id);
    if (foundEmail) {
      foundEmail.smtpStatus = 'Inviata con successo';
    }
  } catch (error) {
    console.error(`Errore nell'invio dell'email reale a ${participant.email}:`, error);
    const foundEmail = simulatedEmails.find(e => e.id === emailObj.id);
    if (foundEmail) {
      foundEmail.smtpStatus = 'Errore di invio';
      foundEmail.smtpError = error.message;
    }
  }
}

// Helper: Invia email tramite Brevo API (HTTP - mai bloccato da Render, nessun dominio richiesto)
async function sendViaBrevo(emailObj, participant) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || smtpConfig.user || 'noreply@smile-eventi.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Smile Eventi';
  const htmlContent = buildEmailHtml(participant, `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${participant.id}`);

  const payload = JSON.stringify({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: emailObj.to }],
    subject: emailObj.subject,
    htmlContent: htmlContent
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }
    };

    const req = require('https').request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const found = simulatedEmails.find(e => e.id === emailObj.id);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (found) found.smtpStatus = 'Inviata con successo';
          resolve();
        } else {
          let errMsg = `Errore Brevo (${res.statusCode})`;
          try {
            const parsed = JSON.parse(data);
            if (parsed && parsed.message) errMsg = parsed.message;
            if (parsed && parsed.code) errMsg += ` [Code: ${parsed.code}]`;
          } catch (e) {}
          const detailedError = `${errMsg} (Sender: ${senderEmail})`;
          console.error('Errore Brevo:', detailedError, 'Payload sent:', payload);
          if (found) { found.smtpStatus = 'Errore di invio'; found.smtpError = detailedError; }
          reject(new Error(detailedError));
        }
      });
    });

    req.on('error', (e) => {
      console.error('Errore connessione Brevo:', e);
      reject(e);
    });
    req.write(payload);
    req.end();
  });
}

// Helper: costruisce l'HTML dell'email biglietto con design premium a tema chiaro (massima compatibilità)
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml(participant, qrCodeSrc) {
  const noteBlock = participant && participant.note && participant.note.trim()
    ? `<div style="margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 12px; line-height: 1.5;"><strong style="display:block; margin-bottom:4px; color:#0f172a;">Nota personalizzata</strong>${escapeHtml(participant.note.trim())}</div>`
    : '';

  return `
    <div style="background-color: #f1f5f9; padding: 30px 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 460px; margin: 0 auto; text-align: left; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 24px;">
            <p style="font-size: 14px; color: #0f172a; margin-top: 0; margin-bottom: 6px; font-weight: 600;">Ciao ${participant.name} ${participant.surname},</p>
            <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px; margin-top: 0;">ecco il pass ufficiale d'ingresso digitale per partecipare all'evento. Ti preghiamo di mostrare il codice QR al personale all'ingresso.</p>
            
            <!-- Ticket Card (Tema Chiaro ad Alto Contrasto) -->
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 2px solid #f1f5f9; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
              <!-- Ticket Header -->
              <tr>
                <td style="padding: 20px; border-bottom: 2px dashed #f1f5f9; background-color: #fafafa;">
                  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                    <tr>
                      <td style="font-size: 24px; width: 36px; vertical-align: middle; line-height: 1;">🎟️</td>
                      <td style="vertical-align: middle;">
                        <div style="font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; line-height: 1.2;">${eventConfig.title}</div>
                        <div style="display: inline-block; font-size: 8px; font-weight: 700; color: #7c3aed; background-color: #f3e8ff; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.8px; margin-top: 3px; text-transform: uppercase;">BIGLIETTO DIGITALE</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Ticket Info -->
              <tr>
                <td style="padding: 20px;">
                  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-size: 11px;">
                    <tr>
                      <td style="width: 55%; padding-bottom: 12px; vertical-align: top;">
                        <div style="color: #64748b; font-size: 9px; font-weight: bold; margin-bottom: 3px; letter-spacing: 0.5px;">PARTECIPANTE</div>
                        <div style="color: #0f172a; font-size: 14px; font-weight: bold;">${participant.name} ${participant.surname}</div>
                      </td>
                      <td style="width: 45%; text-align: right; vertical-align: top; padding-bottom: 12px;">
                        <div style="color: #64748b; font-size: 9px; font-weight: bold; margin-bottom: 3px; letter-spacing: 0.5px;">TICKET ID</div>
                        <div style="color: #7c3aed; font-size: 13px; font-weight: bold; font-family: monospace;">${participant.id}</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="vertical-align: top; padding-top: 4px;">
                        <div style="color: #64748b; font-size: 9px; font-weight: bold; margin-bottom: 3px; letter-spacing: 0.5px;">📅 DATA & ORA</div>
                        <div style="color: #0f172a; font-size: 13px; font-weight: bold; line-height: 1.3;">
                          <span>${formatDateIt(eventConfig.date)}</span><br>
                          <span style="font-size: 11px; opacity: 0.85; color: #475569;">Ore ${eventConfig.time}</span>
                        </div>
                      </td>
                      <td style="text-align: right; vertical-align: top; padding-top: 4px;">
                        <div style="color: #64748b; font-size: 9px; font-weight: bold; margin-bottom: 3px; letter-spacing: 0.5px;">📍 LUOGO</div>
                        <div style="color: #0f172a; font-size: 13px; font-weight: bold;">${eventConfig.location}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Perforated Divider -->
              <tr>
                <td style="padding: 0 10px; height: 10px; background-color: transparent;">
                  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                    <tr>
                      <td style="width: 10px; height: 20px; background-color: #ffffff; border-radius: 0 10px 10px 0; border-right: 2px solid #f1f5f9;"></td>
                      <td style="border-bottom: 2px dashed #f1f5f9; height: 10px; vertical-align: middle;"></td>
                      <td style="width: 10px; height: 20px; background-color: #ffffff; border-radius: 10px 0 0 10px; border-left: 2px solid #f1f5f9;"></td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Ticket QR Section -->
              <tr>
                <td style="padding: 10px 20px 24px 20px; text-align: center;">
                  <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto; background-color: #ffffff; border-radius: 14px; padding: 14px; border: 1px solid #e2e8f0; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
                    <tr>
                      <td>
                        <img src="${qrCodeSrc}" alt="QR Code" style="width: 140px; height: 140px; display: block;">
                      </td>
                    </tr>
                  </table>
                  <div style="color: #64748b; font-size: 8px; font-weight: bold; margin-top: 8px; letter-spacing: 1px;">MOSTRA AL CHECK-IN</div>
                </td>
              </tr>
            </table>
            <!-- Info Footer Notice -->
            <div style="margin-top: 20px; padding: 12px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; text-align: left;">
              ${noteBlock}
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">
                💡 Il biglietto è valido per un solo ingresso. All'arrivo, il codice verrà scansionato per convalidare l'accesso in tempo reale.
              </p>
            </div>
          </td>
        </tr>
      </table>
    </div>`;
}

// Database Initialization helper (creates initial test guest list with QR codes)
async function initDatabase() {
  const initial = [
    { id: "evt-mrossi-1234", name: "Mario", surname: "Rossi", email: "mario.rossi@example.com", status: "Non Inviato", qrCode: "", checkedInAt: null, note: "" },
    { id: "evt-fverdi-5678", name: "Francesca", surname: "Verdi", email: "francesca.verdi@example.com", status: "Non Inviato", qrCode: "", checkedInAt: null, note: "" },
    { id: "evt-gbianchi-9012", name: "Giuseppe", surname: "Bianchi", email: "giuseppe.bianchi@example.com", status: "Non Inviato", qrCode: "", checkedInAt: null, note: "" }
  ];
  
  for (let p of initial) {
    try {
      p.qrCode = await QRCode.toDataURL(p.id);
    } catch (err) {
      console.error("Errore generazione QR per guest iniziale:", err);
    }
  }
  
  writeParticipants(initial);
  return initial;
}

// API Routes

// 1. Get system info (IP and Ports for dashboard scanner setup)
app.get('/api/system-info', (req, res) => {
  const ip = getLocalIpAddress();
  // Su Render, usa l'URL pubblico automatico (RENDER_EXTERNAL_URL)
  const publicBase = process.env.RENDER_EXTERNAL_URL || null;
  res.json({
    ipAddress: ip,
    port: PORT,
    httpsPort: HTTPS_PORT,
    sslActive: fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE),
    scannerUrl: publicBase ? `${publicBase}/scanner.html` : `http://${ip}:${PORT}/scanner.html`,
    scannerSecureUrl: publicBase ? `${publicBase}/scanner.html` : `https://${ip}:${HTTPS_PORT}/scanner.html`
  });
});


// 2. Get list of participants
app.get('/api/participants', (req, res) => {
  res.json(readParticipants());
});

// 3. Create participant
app.post('/api/participants', async (req, res) => {
  const { name, surname, email, note } = req.body;
  if (!name || !surname || !email) {
    return res.status(400).json({ error: "Nome, Cognome e Email sono obbligatori." });
  }

  try {
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const cleanedName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanedSurname = surname.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const id = `evt-${cleanedName}-${cleanedSurname}-${uniqueSuffix}`;

    const qrCodeDataUrl = await QRCode.toDataURL(id);

    const newParticipant = {
      id,
      name: name.trim(),
      surname: surname.trim(),
      email: email.trim(),
      status: "Inviato",
      qrCode: qrCodeDataUrl,
      checkedInAt: null,
      note: typeof note === 'string' ? note.trim() : ''
    };

    const participants = readParticipants();
    participants.push(newParticipant);
    writeParticipants(participants);

    // Simulate sending email
    const emailObj = sendSimulatedEmail(newParticipant);

    // Notify active dashboards via SSE
    broadcastEvent('update', participants);

    res.status(201).json({ participant: newParticipant, email: emailObj });
  } catch (error) {
    console.error("Errore creazione partecipante:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

// 4. Update participant status manually (e.g., Cancel ticket)
app.put('/api/participants/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const participants = readParticipants();
  const index = participants.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Partecipante non trovato" });
  }

  participants[index].status = status;
  writeParticipants(participants);

  // Broadcast update to real-time clients
  broadcastEvent('update', participants);

  res.json(participants[index]);
});

// 5. Delete participant
app.delete('/api/participants/:id', (req, res) => {
  const { id } = req.params;
  const participants = readParticipants();
  const filtered = participants.filter(p => p.id !== id);

  if (participants.length === filtered.length) {
    return res.status(404).json({ error: "Partecipante non trovato" });
  }

  writeParticipants(filtered);

  // Broadcast update to real-time clients
  broadcastEvent('update', filtered);

  res.json({ message: "Partecipante rimosso con successo" });
});

// 6. Generate and send email to a specific participant
app.post('/api/participants/:id/send-email', (req, res) => {
  const { id } = req.params;
  const { note } = req.body || {};
  const participants = readParticipants();
  const index = participants.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Partecipante non trovato" });
  }

  // Update status to "Inviato" if it was changed
  participants[index].status = "Inviato";
  if (typeof note === 'string') {
    participants[index].note = note.trim();
  }
  writeParticipants(participants);

  const emailObj = sendSimulatedEmail(participants[index]);

  // Broadcast update
  broadcastEvent('update', participants);

  res.json({ message: "Email inviata con successo", email: emailObj, participant: participants[index] });
});

// 7. Bulk Import Participants (from CSV)
app.post('/api/participants/bulk', async (req, res) => {
  try {
    const { list } = req.body;
    if (!list || !Array.isArray(list)) {
      return res.status(400).json({ error: "Dati non validi o lista mancante." });
    }

    const participants = readParticipants();
    const addedList = [];

    for (const p of list) {
      const { name, surname, email, note } = p;
      if (!name || !surname || !email) continue;

      const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
      const cleanedName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanedSurname = surname.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const id = `evt-${cleanedName}-${cleanedSurname}-${uniqueSuffix}`;

      const qrCodeDataUrl = await QRCode.toDataURL(id);

      const newParticipant = {
        id,
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        status: "Inviato",
        qrCode: qrCodeDataUrl,
        checkedInAt: null,
        note: typeof note === 'string' ? note.trim() : ''
      };

      participants.push(newParticipant);
      addedList.push(newParticipant);
      
      // Automatically simulate sending email
      sendSimulatedEmail(newParticipant);
    }

    writeParticipants(participants);

    // Broadcast update
    broadcastEvent('update', participants);

    res.status(201).json({ message: `Importati ${addedList.length} partecipanti con successo.`, count: addedList.length });
  } catch (error) {
    console.error("Errore importazione bulk:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

// 8. Bulk Send to all non-cancelled participants
app.post('/api/participants/send-all', (req, res) => {
  const { note } = req.body || {};
  const participants = readParticipants();
  let sentCount = 0;
  
  participants.forEach(p => {
    if (p.status !== "Annullato") {
      if (typeof note === 'string') {
        p.note = note.trim();
      }
      sendSimulatedEmail(p);
      p.status = "Inviato";
      sentCount++;
    }
  });

  writeParticipants(participants);

  // Broadcast update
  broadcastEvent('update', participants);

  res.json({ message: `Simulato invio per ${sentCount} partecipanti.` });
});

// 9. Perform Check-in API Request (used by scanner mobile or dashboard shortcut)
app.post('/api/participants/check-in', (req, res) => {
  const { qrCodeContent } = req.body;
  if (!qrCodeContent) {
    return res.status(400).json({ error: "Contenuto del codice QR mancante." });
  }

  const participants = readParticipants();
  const index = participants.findIndex(p => p.id === qrCodeContent);

  if (index === -1) {
    return res.status(404).json({
      status: "ERRORE",
      message: "Codice QR non riconosciuto o biglietto non presente nel database."
    });
  }

  const participant = participants[index];

  if (participant.status === "Annullato") {
    return res.json({
      status: "ANNULLATO",
      message: `ATTENZIONE: QUESTO BIGLIETTO È STATO ANNULLATO`,
      name: participant.name,
      surname: participant.surname
    });
  }

  if (participant.status === "Utilizzato") {
    return res.json({
      status: "GIA_UTILIZZATO",
      name: participant.name,
      surname: participant.surname,
      usedAt: participant.checkedInAt
    });
  }

  // Case: Success check-in
  participants[index].status = "Utilizzato";
  participants[index].checkedInAt = new Date().toISOString();
  writeParticipants(participants);

  // Broadcast the update immediately so dashboard synchronizes
  broadcastEvent('update', participants);

  res.json({
    status: "SUCCESSO",
    name: participant.name,
    surname: participant.surname
  });
});

// 10. Get simulated email list
app.get('/api/emails', (req, res) => {
  res.json(simulatedEmails);
});

// 10b. TEST SMTP - invia email di prova e mostra risultato dettagliato
app.get('/api/test-email', async (req, res) => {
  const testTo = req.query.to || smtpConfig.user;
  try {
    if (!smtpConfig.enabled || !smtpConfig.user || !smtpConfig.pass) {
      return res.json({
        success: false,
        error: 'SMTP non configurato o disattivato',
        smtpConfig: { host: smtpConfig.host, port: smtpConfig.port, user: smtpConfig.user, enabled: smtpConfig.enabled }
      });
    }
    const testPort = parseInt(smtpConfig.port) || 587;
    const transporter = require('nodemailer').createTransport({
      host: smtpConfig.host,
      port: testPort,
      secure: testPort === 465,
      requireTLS: testPort === 587,
      auth: { user: smtpConfig.user, pass: smtpConfig.pass },
      tls: { rejectUnauthorized: false }
    });
    await transporter.verify();
    await transporter.sendMail({
      from: `"Smile Test" <${smtpConfig.user}>`,
      to: testTo,
      subject: '✅ Test Email - Smile Funziona!',
      html: '<h2>✅ Connessione SMTP funzionante!</h2><p>Il sistema email di Smile è configurato correttamente.</p>'
    });
    res.json({ success: true, message: `Email di test inviata a ${testTo}`, smtpUser: smtpConfig.user });
  } catch (error) {
    res.json({ success: false, error: error.message, code: error.code, smtpUser: smtpConfig.user });
  }
});

// 11. Clear simulated email list
app.delete('/api/emails', (req, res) => {
  simulatedEmails = [];
  writeEmails(simulatedEmails);
  res.json({ message: "Inviate svuotate" });
});

// 12. Get SMTP settings
app.get('/api/settings/smtp', (req, res) => {
  res.json(smtpConfig);
});

// 13. Save SMTP settings
app.post('/api/settings/smtp', (req, res) => {
  const { host, port, user, pass, enabled } = req.body;
  if (enabled && (!host || !port || !user || !pass)) {
    return res.status(400).json({ error: "Tutti i campi SMTP sono obbligatori se l'invio reale è attivo." });
  }

  smtpConfig = { host, port, user, pass, enabled: enabled === true };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(smtpConfig, null, 2));
    if (useMongo) {
      backupToDb().catch(() => {});
    }
  } catch (e) {
    console.error("Errore salvataggio impostazioni SMTP:", e);
  }
  res.json({ message: "Configurazione SMTP salvata con successo", enabled: smtpConfig.enabled });
});

// 14. Get event details settings
app.get('/api/settings/event', (req, res) => {
  res.json(eventConfig);
});

// 15. Save event details settings
app.post('/api/settings/event', (req, res) => {
  const { title, date, time, location } = req.body;
  if (!title || !date || !time || !location) {
    return res.status(400).json({ error: "Tutti i campi dell'evento sono obbligatori." });
  }
  
  eventConfig = { title, date, time, location };
  try {
    fs.writeFileSync(EVENT_SETTINGS_FILE, JSON.stringify(eventConfig, null, 2));
    if (useMongo) {
      backupToDb().catch(() => {});
    }
    
    // Broadcast event details changes
    broadcastEvent('event_update', eventConfig);
  } catch (e) {
    console.error("Errore salvataggio impostazioni evento:", e);
  }
  res.json({ message: "Configurazione evento salvata con successo", eventConfig });
});

// 16. SSE endpoint for real-time dashboard updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  // Send initial event update
  res.write(`data: ${JSON.stringify({ type: 'event_update', data: eventConfig })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// Start listening and initialize DB if needed
async function startServer() {
  const supabaseConnected = await initSupabaseConnection();
  const mongoConnected = !supabaseConnected ? await initMongoConnection() : false;
  if (supabaseConnected) {
    try {
      const { data } = await supabase.from('app_data').select('*');
      if (Array.isArray(data)) {
        const participantsRow = data.find(item => item.key === 'participants');
        const emailsRow = data.find(item => item.key === 'emails');
        const settingsRow = data.find(item => item.key === 'settings');
        if (participantsRow) participantsStore = participantsRow.value || [];
        if (emailsRow) simulatedEmails = emailsRow.value || [];
        if (settingsRow && settingsRow.value) {
          smtpConfig = settingsRow.value.smtpConfig || smtpConfig;
          eventConfig = settingsRow.value.eventConfig || eventConfig;
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(participantsStore, null, 2));
        fs.writeFileSync(EMAILS_FILE, JSON.stringify(simulatedEmails, null, 2));
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(smtpConfig, null, 2));
        fs.writeFileSync(EVENT_SETTINGS_FILE, JSON.stringify(eventConfig, null, 2));
      }
    } catch (error) {
      console.error('Errore caricamento dati da Supabase:', error.message);
    }
  } else if (mongoConnected) {
    await syncFromDb();
    loadConfigFromFiles();
  }

  await loadOrInitParticipants();

  // Start HTTP server
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Server HTTP (Dashboard Event Access) avviato!`);
    console.log(`Accedi all'interfaccia di amministrazione:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`==================================================`);
  });

  // Start HTTPS server for mobile scanner if SSL certificates exist
  if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    try {
      const httpsOptions = {
        key: fs.readFileSync(KEY_FILE),
        cert: fs.readFileSync(CERT_FILE)
      };
      https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        const ip = getLocalIpAddress();
        console.log(`==================================================`);
        console.log(`Server HTTPS (Scanner smartphone) avviato!`);
        console.log(`Accedi da smartphone per testare:`);
        console.log(`👉 https://${ip}:${HTTPS_PORT}/scanner.html`);
        console.log(`==================================================`);
      });
    } catch (error) {
      console.error("Errore durante l'avvio del server HTTPS:", error);
    }
  }
}

async function loadOrInitParticipants() {
  if (!fs.existsSync(DB_FILE)) {
    console.log("Inizializzazione database.json con partecipanti di prova...");
    await initDatabase();
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  buildEmailHtml,
  app,
  startServer,
  readParticipants,
  writeParticipants,
  writeEmails
};
