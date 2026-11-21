import "./globals.css";

export const metadata = {
  title: "NFL Vegas Tracker",
  description: "Historical NFL game results, betting lines, and analytics.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
