const SENDER    = 'noreply@forms.eightit.com';
const RECIPIENT = 'info@eightit.com';

export async function onRequestPost(context) {
  try {
    const form    = await context.request.formData();

    const honeypot = (form.get('website') || '').trim();
    if (honeypot) {
      return Response.json({ ok: true });
    }

    const name    = (form.get('name')    || '').trim();
    const email   = (form.get('email')   || '').trim();
    const message = (form.get('message') || '').trim();

    if (!name || !email || !message) {
      return Response.json({ ok: false, error: 'All fields are required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const turnstileToken = (form.get('cf-turnstile-response') || '').trim();
    const turnstileSecret = context.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        return Response.json({ ok: false, error: 'Please complete the verification challenge.' }, { status: 400 });
      }
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        console.error('[contact] Turnstile failed', verifyData);
        return Response.json({ ok: false, error: 'Verification failed. Please try again.' }, { status: 400 });
      }
    }

    if (!context.env.RESEND_API_KEY) {
      return Response.json({ ok: true });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Eight IT Website <${SENDER}>`,
        to: RECIPIENT,
        reply_to: `${name} <${email}>`,
        subject: `New contact from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[contact]', res.status, err);
      return Response.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[contact]', err);
    return Response.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
