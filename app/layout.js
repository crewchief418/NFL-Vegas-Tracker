import "./globals.css";
import PwaInstall from "./pwa-install";

export const metadata = {
  title: "NFL Vegas Tracker",
  description: "NFL game results, betting lines, predictions, and plain-English analytics guide.",
  applicationName: "NFL Vegas Tracker",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "NFL Vegas", statusBarStyle: "black-translucent" },
};

export const viewport = { themeColor: "#0c1420", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return <html lang="en"><body>
    {children}

    <PwaInstall />
  </body></html>;
}