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
    <a href="/guide" aria-label="Open the plain-English guide" style={{position:"fixed",right:14,bottom:"max(14px, env(safe-area-inset-bottom))",zIndex:1000,background:"#e7b84e",color:"#151b24",padding:"10px 14px",borderRadius:999,fontSize:13,fontWeight:900,textDecoration:"none",boxShadow:"0 4px 18px #0008"}}>❔ What does this mean?</a>
    <PwaInstall />
  </body></html>;
}