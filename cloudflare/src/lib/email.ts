// Password-reset email delivery via Resend (free tier: 3,000/month, plain
// HTTP API -- no SMTP needed, works natively from a Worker's fetch()).
// Replaces Appwrite's native POST /account/recovery email, which went dark
// along with the rest of the project.
//
// Requires the RESEND_API_KEY Worker secret and a verified sending domain
// (khabardarjeeling.in) in the Resend dashboard -- set up once, manually,
// by the site owner; not something this code can provision itself.
//
// Best-effort by design, matching every other outward-facing side effect
// in this codebase (push notifications, etc): a delivery failure here
// must never surface as an error to the caller, since routes/auth.ts's
// POST /request-password-reset always returns a generic 200 regardless of
// whether the email address exists OR whether sending succeeded, to avoid
// leaking either fact to whoever's asking.

export async function sendPasswordResetEmail(
  env: { RESEND_API_KEY?: string },
  to: string,
  rawToken: string
): Promise<void> {
  if (!env.RESEND_API_KEY) return; // not configured yet -- silently no-op, same "fail gracefully" convention as everything else here

  const resetUrl = `https://khabardarjeeling.in/auth/reset?token=${encodeURIComponent(rawToken)}`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Khabar Darjeeling <noreply@khabardarjeeling.in>',
        to: [to],
        subject: 'Reset your Khabar Darjeeling password',
        html:
          `<p>Someone requested a password reset for this email address on Khabar Darjeeling. ` +
          `If that was you, click below to set a new password. This link expires in 1 hour.</p>` +
          `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
          `<p>If you didn't request this, you can safely ignore this email.</p>`,
      }),
    });
  } catch {
    // Best-effort -- see file header. Nothing to do with a network failure
    // here except not let it propagate.
  }
}
