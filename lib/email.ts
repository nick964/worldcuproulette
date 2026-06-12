// Transactional email via Resend's REST API (no SDK dependency).
//
// Clerk only sends its own auth emails (sign-in codes, invitations) and has
// no general-purpose email API, so pool notifications go through Resend.
// Setup: create a Resend account, verify the worldcuproulette.com domain
// (SPF + DKIM records), then set:
//   RESEND_API_KEY  — required for emails to send
//   EMAIL_FROM      — optional, defaults to pools@worldcuproulette.com
// Without RESEND_API_KEY the helpers log and no-op; email must never block
// gameplay actions.

type LockEmailMember = { email: string; name: string; spins: number };

// Contact-form submission, forwarded to the site owner with reply-to set to
// the sender so a normal email reply goes straight back to them.
export async function sendContactEmail({
  fromName,
  fromEmail,
  message,
}: {
  fromName: string;
  fromEmail: string;
  message: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — contact form disabled");
    return false;
  }
  const from =
    process.env.EMAIL_FROM ?? "World Cup Roulette <pools@worldcuproulette.com>";
  const to = process.env.CONTACT_EMAIL ?? "nickr964@gmail.com";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: [fromEmail],
        subject: `📨 Contact form: ${fromName || fromEmail}`,
        html: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
  <p style="font-size:12px;color:#666;margin:0 0 12px">
    worldcuproulette.com contact form
  </p>
  <p style="margin:0 0 4px"><strong>From:</strong> ${escapeHtml(fromName || "(no name)")} &lt;${escapeHtml(fromEmail)}&gt;</p>
  <div style="background:#f4f4f4;border-radius:8px;padding:16px;margin-top:12px;white-space:pre-wrap;font-size:14px;line-height:1.6">${escapeHtml(message)}</div>
  <p style="font-size:12px;color:#666;margin-top:12px">Reply to this email to answer them directly.</p>
</div>`,
        text: `From: ${fromName || "(no name)"} <${fromEmail}>\n\n${message}`,
      }),
    });
    if (!res.ok) {
      console.error("[email] contact send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] contact send errored:", e);
    return false;
  }
}

// Sent when the owner removes someone from an open pool.
export async function sendMemberKickedEmail({
  email,
  name,
  poolName,
  reason,
}: {
  email: string;
  name: string;
  poolName: string;
  reason: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — skipping kicked email");
    return;
  }
  const from =
    process.env.EMAIL_FROM ?? "World Cup Roulette <pools@worldcuproulette.com>";
  const safePool = escapeHtml(poolName);
  const reasonBlock = reason
    ? `<div style="background:#31362e;border-radius:8px;padding:14px 16px;margin:16px 0">
         <p style="color:#bfcab7;font-size:11px;letter-spacing:1px;margin:0 0 6px">MESSAGE FROM THE POOL OWNER</p>
         <p style="color:#dfe4d8;font-size:14px;line-height:1.5;margin:0">${escapeHtml(reason)}</p>
       </div>`
    : "";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `You've been removed from ${poolName}`,
        html: `
<div style="background:#10150e;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#1c2119;border:1px solid #404a3b;border-radius:12px;padding:32px;color:#dfe4d8">
    <p style="color:#82db6f;font-weight:bold;letter-spacing:2px;font-size:12px;margin:0">WORLD CUP ROULETTE</p>
    <h1 style="color:#ffffff;font-size:22px;margin:12px 0">You've been removed from ${safePool}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0">
      Hey ${escapeHtml(name)} — the owner of <strong>${safePool}</strong> has
      removed you from the pool.
    </p>
    ${reasonBlock}
    <p style="color:#899483;font-size:12px;margin:0">
      Think it's a mistake? Reach out to the pool owner — they can send you a
      fresh invite link while the pool is still open.
    </p>
  </div>
</div>`,
        text: `You've been removed from ${poolName}.${reason ? ` Message from the owner: ${reason}` : ""} If you think it's a mistake, contact the pool owner for a new invite link.`,
      }),
    });
    if (!res.ok) {
      console.error("[email] kicked email failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[email] kicked email errored:", e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendPoolLockedEmails({
  poolName,
  poolUrl,
  members,
}: {
  poolName: string;
  poolUrl: string;
  members: LockEmailMember[];
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — skipping pool-locked emails");
    return;
  }
  const from =
    process.env.EMAIL_FROM ?? "World Cup Roulette <pools@worldcuproulette.com>";
  const safePool = escapeHtml(poolName);

  const batch = members
    .filter((m) => m.email)
    .map((m) => ({
      from,
      to: [m.email],
      subject: `🎡 ${poolName} is locked — spin for your teams!`,
      html: `
<div style="background:#10150e;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#1c2119;border:1px solid #404a3b;border-radius:12px;padding:32px;color:#dfe4d8">
    <p style="color:#82db6f;font-weight:bold;letter-spacing:2px;font-size:12px;margin:0">WORLD CUP ROULETTE</p>
    <h1 style="color:#ffffff;font-size:24px;margin:12px 0">🔒 ${safePool} just locked!</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 4px">
      Hey ${escapeHtml(m.name)} — the squad is set and the draft is live.
      ${
        m.spins > 0
          ? `You have <strong style="color:#ffe16d">${m.spins} more spin${m.spins === 1 ? "" : "s"}</strong> to finish drawing your World Cup nations.`
          : `Your first spin already covered your full allotment — you're all drafted. Watch the standings!`
      }
    </p>
    <a href="${poolUrl}" style="display:inline-block;background:#82db6f;color:#003a00;font-weight:bold;padding:14px 28px;border-radius:10px;text-decoration:none;margin:16px 0">${m.spins > 0 ? "SPIN NOW 🎡" : "VIEW STANDINGS 🏆"}</a>
    <p style="color:#899483;font-size:12px;margin:0">
      Hold the team that lifts the trophy and you win the pool. Good luck!
    </p>
  </div>
</div>`,
      text:
        m.spins > 0
          ? `${poolName} just locked! You have ${m.spins} more spin${m.spins === 1 ? "" : "s"} to draw your World Cup nations. Spin now: ${poolUrl}`
          : `${poolName} just locked! Your first spin already covered your full allotment — you're all drafted. Standings: ${poolUrl}`,
    }));

  if (batch.length === 0) return;

  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error(
        "[email] Resend batch failed:",
        res.status,
        await res.text(),
      );
    }
  } catch (e) {
    console.error("[email] Resend request errored:", e);
  }
}
