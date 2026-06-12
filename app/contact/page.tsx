import { currentUser } from "@clerk/nextjs/server";
import { sendContactMessage } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

// Public contact page — submissions are emailed to the site owner via Resend.
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  const user = await currentUser();
  const defaultName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "";
  const defaultEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 md:px-8">
      <h1 className="font-display text-3xl font-semibold uppercase italic tracking-tight md:text-4xl">
        Get in touch
      </h1>
      <p className="mt-1 text-on-surface-variant">
        Questions, problems, or a stuck spin? Send a message and we&apos;ll
        get back to you by email.
      </p>

      {sent ? (
        <div className="gold-glow glass-card mt-8 rounded-xl border-secondary-fixed/30 p-8 text-center">
          <div className="text-4xl">📬</div>
          <h2 className="mt-3 font-display text-xl font-bold uppercase italic">
            Message sent!
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Thanks for reaching out — we&apos;ll reply to your email as soon
            as we can. Back to the pools in the meantime?
          </p>
        </div>
      ) : (
        <form action={sendContactMessage} className="glass-card mt-8 space-y-5 rounded-xl p-6">
          {/* honeypot: humans never see it, bots fill it */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="contact-name"
                className="block px-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
              >
                Name <span className="text-outline">(optional)</span>
              </label>
              <input
                id="contact-name"
                name="name"
                maxLength={80}
                defaultValue={defaultName}
                placeholder="Your name"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-outline/60 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="contact-email"
                className="block px-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
              >
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                maxLength={120}
                defaultValue={defaultEmail}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-outline/60 focus:border-primary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="contact-message"
              className="block px-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
            >
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={5}
              maxLength={2000}
              placeholder="What's going on?"
              className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm outline-none transition-colors placeholder:text-outline/60 focus:border-primary"
            />
          </div>
          <SubmitButton
            pendingLabel="Sending…"
            className="pitch-glow w-full rounded-xl bg-primary py-3.5 font-display text-lg font-bold uppercase tracking-wider text-on-primary transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            Send message
          </SubmitButton>
          <p className="text-center text-[10px] uppercase tracking-widest text-on-surface-variant">
            Or email{" "}
            <a
              href="mailto:nickr964@gmail.com"
              className="text-primary hover:underline"
            >
              nickr964@gmail.com
            </a>{" "}
            · DM{" "}
            <a
              href="https://x.com/nicky_robby"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @nicky_robby
            </a>
          </p>
        </form>
      )}
    </div>
  );
}
