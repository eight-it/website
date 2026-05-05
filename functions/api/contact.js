import { EmailMessage } from 'cloudflare:email';

const SENDER    = 'noreply@forms.eightit.com';
const RECIPIENT = 'info@eightit.com';

function sanitizeHeader(s) {
  return String(s).replace(/[\r\n]/g, ' ').trim().slice(0, 200);
}

function buildRaw({ name, email, message }) {
  return [
    'MIME-Version: 1.0',
    `Date: ${new Date().toUTCString()}`,
    `From: Eight IT Website <${SENDER}>`,
    `Reply-To: ${sanitizeHeader(name)} <${sanitizeHeader(email)}>`,
    `To: ${RECIPIENT}`,
    `Subject: New contact from ${sanitizeHeader(name)}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    message,
  ].join('\r\n');
}

export async function onRequestPost(context) {
  try {
    const form    = await context.request.formData();
    const name    = (form.get('name')    || '').trim();
    const email   = (form.get('email')   || '').trim();
    const message = (form.get('message') || '').trim();

    if (!name || !email || !message) {
      return Response.json({ ok: false, error: 'All fields are required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (!context.env.EMAIL) {
      // Binding not configured — return success so the form can be tested visually
      return Response.json({ ok: true });
    }

    const msg = new EmailMessage(SENDER, RECIPIENT, buildRaw({ name, email, message }));
    await context.env.EMAIL.send(msg);

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[contact]', err);
    return Response.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
