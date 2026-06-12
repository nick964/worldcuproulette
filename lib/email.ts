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
      You have <strong style="color:#ffe16d">${m.spins} spin${m.spins === 1 ? "" : "s"}</strong>
      to draw your World Cup nations.
    </p>
    <a href="${poolUrl}" style="display:inline-block;background:#82db6f;color:#003a00;font-weight:bold;padding:14px 28px;border-radius:10px;text-decoration:none;margin:16px 0">SPIN NOW 🎡</a>
    <p style="color:#899483;font-size:12px;margin:0">
      Hold the team that lifts the trophy and you win the pool. Good luck!
    </p>
  </div>
</div>`,
      text: `${poolName} just locked! You have ${m.spins} spin${m.spins === 1 ? "" : "s"} to draw your World Cup nations. Spin now: ${poolUrl}`,
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
