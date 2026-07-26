import pako from 'pako';
import { Resend } from 'resend';

export const config = {
  maxDuration: 60,
};

const FROM_ADDRESS = 'Stephane Kopilot <stephane@kopilot-finance.fr>';
const ADMIN_UIDS = [
  'mcsF5DgzPzTjQZ0w1flAggqanEF2',
  'UID_ASSOCIE_A_REMPLACER',
];

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function parseRecipients(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : String(value).split(/[,;]/);
  return arr.map(s => s.trim()).filter(isValidEmail);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      htmlGz,
      htmlBase64,
      filename,
      to,
      cc,
      subject,
      message,
      uid,
    } = req.body || {};

    if (!ADMIN_UIDS.includes(uid)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const toList = parseRecipients(to);
    const ccList = parseRecipients(cc);
    if (toList.length === 0) {
      return res.status(400).json({ error: 'Destinataire (To) invalide ou manquant' });
    }
    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ error: 'Sujet manquant' });
    }

    let html;
    if (htmlGz) {
      const compressed = Uint8Array.from(atob(htmlGz), c => c.charCodeAt(0));
      html = pako.inflate(compressed, { to: 'string' });
    } else if (htmlBase64) {
      html = Buffer.from(htmlBase64, 'base64').toString('utf-8');
    } else {
      return res.status(400).json({ error: 'No HTML provided' });
    }

    console.log('[send-report] HTML length:', html.length, '| to:', toList.length, '| cc:', ccList.length);

    const token = process.env.BROWSERLESS_TOKEN;
    if (!token) throw new Error('BROWSERLESS_TOKEN env variable missing in Vercel');
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error('RESEND_API_KEY env variable missing in Vercel');

    const browserlessResponse = await fetch(
      `https://chrome.browserless.io/pdf?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: html,
          options: {
            width: '1280px',
            height: '720px',
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: false,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
          },
          gotoOptions: {
            waitUntil: 'networkidle0',
            timeout: 30000
          },
          waitForTimeout: 1500
        })
      }
    );

    if (!browserlessResponse.ok) {
      const errText = await browserlessResponse.text();
      console.error('[send-report] Browserless error:', browserlessResponse.status, errText);
      throw new Error('Browserless ' + browserlessResponse.status + ': ' + errText);
    }

    const pdfBuffer = Buffer.from(await browserlessResponse.arrayBuffer());
    console.log('[send-report] PDF generated, size:', pdfBuffer.length);

    const safeName = (filename || 'rapport.pdf').replace(/[^A-Za-z0-9._-]/g, '_');
    const rawMessage = String(message || '').slice(0, 5000);
    const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0A1E6E;line-height:1.5">
      ${escapeHtml(rawMessage).replace(/\n/g, '<br>')}
      <hr style="border:none;border-top:1px solid #E2E8F0;margin:18px 0">
      <div style="font-size:11px;color:#64748B">Envoyé via Kopilot Finance — kopilot-finance.fr</div>
    </div>`;

    const resend = new Resend(resendKey);
    const sendPayload = {
      from: FROM_ADDRESS,
      to: toList,
      subject: String(subject).slice(0, 200),
      html: htmlBody,
      text: rawMessage,
      attachments: [
        {
          filename: safeName,
          content: pdfBuffer,
        },
      ],
    };
    if (ccList.length > 0) sendPayload.cc = ccList;

    const { data, error } = await resend.emails.send(sendPayload);

    if (error) {
      console.error('[send-report] Resend error:', error);
      return res.status(502).json({ error: 'Resend failed', message: error.message || String(error) });
    }

    console.log('[send-report] Email sent, id:', data?.id);
    return res.status(200).json({ ok: true, id: data?.id, pdfSize: pdfBuffer.length });

  } catch (err) {
    console.error('[send-report] Erreur:', err);
    return res.status(500).json({
      error: 'Send report failed',
      message: err.message
    });
  }
}
