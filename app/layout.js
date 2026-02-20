import "./globals.css";

export const metadata = {
  title: "ThesisAlpha — Investment Thesis Tracker",
  description: "Track earnings KPIs, detect narrative drift, and expose Q&A evasion with AI.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='10' fill='%23fff'/><path d='M18 20H82V36H60V80H46V36H18V20Z' fill='%23000'/></svg>" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
