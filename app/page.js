"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Loading database…");
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    fetch("/api/games?summary=1")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load games");
        setCounts(data);
        setStatus("Connected");
      })
      .catch((error) => setStatus(error.message));
  }, []);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 22px" }}>
      <header style={{ borderBottom: "1px solid #344052", paddingBottom: 22, marginBottom: 28 }}>
        <div style={{ color: "#9eacbd", fontSize: 12, letterSpacing: 3, fontWeight: 700 }}>NFL DATA & ANALYTICS</div>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 54px)", margin: "10px 0 4px" }}>NFL Vegas Tracker</h1>
        <p style={{ color: "#aab6c5", margin: 0 }}>Historical game results, point spreads, and betting trends.</p>
      </header>
      <section style={{ background: "#192433", border: "1px solid #344052", borderRadius: 14, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Database status</h2>
          <span style={{ color: status === "Connected" ? "#65d6a1" : "#f3c66b", fontWeight: 700 }}>{status}</span>
        </div>
        {counts && <div style={{ display: "flex", gap: 36, flexWrap: "wrap", marginTop: 24 }}>
          <div><div style={{ color: "#9eacbd", fontSize: 12 }}>REGULAR SEASON</div><strong style={{ fontSize: 30 }}>{counts.regular ?? 0}</strong></div>
          <div><div style={{ color: "#9eacbd", fontSize: 12 }}>PLAYOFFS</div><strong style={{ fontSize: 30 }}>{counts.playoffs ?? 0}</strong></div>
          <div><div style={{ color: "#9eacbd", fontSize: 12 }}>TOTAL GAMES</div><strong style={{ fontSize: 30 }}>{counts.total ?? 0}</strong></div>
        </div>}
        <p style={{ color: "#9eacbd", marginBottom: 0, lineHeight: 1.5 }}>The application foundation is in place. The historical workbook import and original analytics screens are the next build steps.</p>
      </section>
    </main>
  );
}
