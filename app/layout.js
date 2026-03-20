// app/layout.js
// Route segment config — prevents static prerendering of the app.
// Must live in a Server Component (no "use client").

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "ThesisAlpha",
  description: "The private dashboard for long-term investors.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ margin: 0, padding: 0, background: "#0f1117" }}>
      <body style={{ margin: 0, padding: 0, background: "#0f1117", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
