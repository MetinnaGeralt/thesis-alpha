import "./globals.css";
export const metadata = {
  title: "ThesisAlpha",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/logo.png", // also shows on iOS home screen
  },
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `window.__TA_STRIPE_MONTHLY="${process.env.NEXT_PUBLIC_STRIPE_MONTHLY}";window.__TA_STRIPE_ANNUAL="${process.env.NEXT_PUBLIC_STRIPE_ANNUAL}";` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
