import pako from 'pako';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { htmlGz, htmlBase64, filename } = req.body;

    let html;
    if (htmlGz) {
      const compressed = Uint8Array.from(atob(htmlGz), c => c.charCodeAt(0));
      html = pako.inflate(compressed, { to: 'string' });
    } else if (htmlBase64) {
      html = Buffer.from(htmlBase64, 'base64').toString('utf-8');
    } else {
      return res.status(400).json({ error: 'No HTML provided' });
    }

    console.log('[generate-pdf] HTML length:', html.length);

    const token = process.env.BROWSERLESS_TOKEN;
    if (!token) {
      throw new Error('BROWSERLESS_TOKEN env variable missing in Vercel');
    }

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
      console.error('[generate-pdf] Browserless error:', browserlessResponse.status, errText);
      throw new Error('Browserless ' + browserlessResponse.status + ': ' + errText);
    }

    const pdfBuffer = Buffer.from(await browserlessResponse.arrayBuffer());
    console.log('[generate-pdf] PDF generated via Browserless, size:', pdfBuffer.length);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + (filename || 'rapport.pdf') + '"');
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);

  } catch (err) {
    console.error('[generate-pdf] Erreur:', err);
    return res.status(500).json({
      error: 'PDF generation failed',
      message: err.message
    });
  }
}
