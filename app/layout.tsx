import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import Link from "next/link";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const SITE_URL = "https://worldcuproulette.com";
const DESCRIPTION =
  "Spin the wheel, draft your World Cup nations, and win the pool when your team lifts the trophy. The random-team World Cup 2026 pool — no skill, pure luck.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "World Cup Roulette",
    template: "%s · World Cup Roulette",
  },
  description: DESCRIPTION,
  applicationName: "World Cup Roulette",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "World Cup Roulette",
    title: "World Cup Roulette — Spin the Wheel. Get Your Team. Win It All!",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "World Cup Roulette — Spin the Wheel. Get Your Team. Win It All!",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html
        lang="en"
        className={`${oswald.variable} ${inter.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col bg-background text-on-surface">
          <header className="sticky top-0 z-50 border-b border-white/10 bg-surface/80 shadow-md backdrop-blur-md">
            <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-8">
              <Link
                href="/"
                className="whitespace-nowrap font-display text-lg font-bold uppercase italic tracking-tighter text-primary sm:text-xl md:text-2xl"
              >
                World Cup Roulette
              </Link>
              <nav className="flex items-center gap-3 sm:gap-4 md:gap-6">
                <Show when="signed-in">
                  <Link
                    href="/pools"
                    className="whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
                  >
                    My Pools
                  </Link>
                  <Link
                    href="/pools/new"
                    className="whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
                  >
                    Create Pool
                  </Link>
                  <UserButton />
                </Show>
                <Show when="signed-out">
                  <SignInButton>
                    <button className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton>
                    <button className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90">
                      Join now
                    </button>
                  </SignUpButton>
                </Show>
              </nav>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">{children}</main>
          <footer className="border-t border-outline-variant bg-surface-container-lowest py-8">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-3 px-4 md:flex-row md:px-8">
              <span className="font-display text-lg font-bold uppercase italic tracking-tighter text-on-surface">
                World Cup Roulette
              </span>
              <div className="flex items-center gap-5 text-xs uppercase tracking-widest">
                <Link
                  href="/contact"
                  className="text-on-surface-variant transition-colors hover:text-primary"
                >
                  ✉️ Contact
                </Link>
                <a
                  href="https://x.com/nicky_robby"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-on-surface-variant transition-colors hover:text-primary"
                >
                  𝕏 @nicky_robby
                </a>
              </div>
              <p className="text-xs uppercase tracking-widest text-on-surface-variant">
                Spin · Draft · Lift the Cup — World Cup 2026
              </p>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
