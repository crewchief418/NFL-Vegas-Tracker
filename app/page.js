"use client";

import { useEffect, useMemo, useState } from "react";

const tabs = ["Game Tracker", "Win/Loss", "Against Spread", "Over/Under", "Points"];
const inputStyle = { background: "#111b28", color: "#f3f6fa", border: "1px solid #34465c", borderRadius: 8, padding: "10px 12px", minWidth: 0 };
const buttonStyle = { background: "#e7b84e", color: "#151b24", border: 0, borderRadius: 8, padding: "10px 15px", fontWeight: 800, cursor: "pointer" };

function pct(n, d) { return d ? `${(n / d * 100).toFixed(1)}%` : "—"; }

export default function Home() {
  const [tab, setTab] = useState("Game Tracker");
  const [competition, setCompetition] = useState("regular");
  const [season, setSeason] = useState("all");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const [games, setGames] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ away_score: "", home_score: "", favorite_team: "", favorite_spread: "", spread_text: "" });
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importSecret, setImportSecret] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [newGame, setNewGame] = useState({ season: new Date().getFullYear(), game_date: "", game_time: "", away_team: "", home_team: "", favorite_team: "", favorite_spread: "", spread_text: "", game_type: "" });

  async function loadGames() {
    setBusy(true);
    setMessage("");
    try {
      const qs = new URLSearchParams({ competition });
      if (season !== "all") qs.set("season", season);
      if (team !== "all") qs.set("team", team);
      if (status === "completed") qs.set("completed", "1");
      if (status === "upcoming") qs.set("completed", "0");
      const response = await fetch(`/api/games?${qs}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load games");
      setGames(data.games || []);
      setSelected((current) => current && data.games.some(g => g.source_game_id === current.source_game_id) ? current : null);
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { loadGames(); }, [competition, season, team, status]);

  const seasons = useMemo(() => [...new Set(games.map(g => g.season))].sort((a,b) => b-a), [games]);
  const teams = useMemo(() => [...new Set(games.flatMap(g => [g.away_team,g.home_team]))].sort(), [games]);
  const completed = games.filter(g => g.away_score != null);
  const homeWins = completed.filter(g => g.home_score > g.away_score).length;
  const awayWins = completed.length - homeWins;
  const selectedGame = games.find(g => g.source_game_id === selected?.source_game_id) || null;

  function chooseGame(game) {
    setSelected(game);
    setForm({
      away_score: game.away_score ?? "",
      home_score: game.home_score ?? "",
      favorite_team: game.favorite_team || (Number(game.spread_points) < 0 ? game.away_team : Number(game.spread_points) > 0 ? game.home_team : ""),
      favorite_spread: game.favorite_spread ?? (game.spread_points == null ? "" : Math.abs(Number(game.spread_points))),
      spread_text: game.spread_text ?? ""
    });
    setMessage("");
  }

  async function saveGame() {
    if (!selectedGame) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/games", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, spread_text: form.favorite_team === "PK" ? "PK" : "", competition_type: competition, source_game_id: selectedGame.source_game_id, away_team: selectedGame.away_team, home_team: selectedGame.home_team })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");
      setMessage(data.ats_result === "push" ? "Saved · ATS push" : "Game result saved");
      await loadGames();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function importWorkbook(e) {
    e.preventDefault();
    if (!importFile || !importSecret) { setMessage("Choose the workbook and enter the import key."); return; }
    setBusy(true); setMessage("");
    try {
      const body = new FormData();
      body.append("file", importFile);
      const response = await fetch("/api/import", { method:"POST", headers:{"x-import-secret":importSecret}, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      setShowImport(false);
      setImportSecret("");
      setImportFile(null);
      const summary = (data.counts || []).map(x => `${x.count} ${x.competition_type}`).join(" · ");
      setMessage(`Workbook import complete: ${data.inserted.toLocaleString()} added, ${data.alreadyPresent.toLocaleString()} already existed. ${summary}`);
      setSeason("all"); setTeam("all"); setStatus("all");
      await loadGames();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function createGame(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newGame, competition_type: competition }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create game");
      setShowNew(false); setMessage(`Game created · #${data.source_game_id}`); setSeason(String(newGame.season)); setTeam("all"); setStatus("all");
      await loadGames();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  const statRows = useMemo(() => {
    const rows = teams.map(name => {
      const played = completed.filter(g => g.home_team === name || g.away_team === name);
      const wins = played.filter(g => (g.home_team === name && g.home_score > g.away_score) || (g.away_team === name && g.away_score > g.home_score)).length;
      const losses = played.length - wins;
      const asHome = played.filter(g => g.home_team === name);
      const asAway = played.filter(g => g.away_team === name);
      const over = played.filter(g => g.total_points != null && g.total_points > Number(g.total_points) * 0 + 0).length;
      return { name, played: played.length, wins, losses, winPct: pct(wins, played.length), home: asHome.length, away: asAway.length, over };
    });
    return rows.sort((a,b) => b.winPct.localeCompare(a.winPct) || b.wins-a.wins);
  }, [teams, completed]);

  return (
    <main className="shell">
      <header className="topbar">
        <div><div className="eyebrow">NFL DATA & BETTING ANALYTICS</div><h1>NFL Vegas Tracker</h1><p>Game results · point spreads · historical trends</p></div>
        <div className="season-mark">NFL <b>TRACKER</b><span>EST. 2013</span></div>
      </header>
      <section className="metrics">
        <div><span>GAMES IN VIEW</span><strong>{games.length.toLocaleString()}</strong></div>
        <div><span>COMPLETED</span><strong>{completed.length.toLocaleString()}</strong></div>
        <div><span>HOME WINS</span><strong>{homeWins.toLocaleString()}</strong></div>
        <div><span>AWAY WINS</span><strong>{awayWins.toLocaleString()}</strong></div>
      </section>
      <nav className="tabs">{tabs.map(t => <button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}</nav>
      <section className="panel">
        <div className="toolbar">
          <div><h2>{tab}</h2><p>{competition === "regular" ? "Regular season" : "Playoffs"} · historical game database</p></div>
          <div className="filters">
            <select style={inputStyle} value={competition} onChange={e=>{setCompetition(e.target.value);setSeason("all");setTeam("all");}}><option value="regular">Regular Season</option><option value="playoffs">Playoffs</option></select>
            <select style={inputStyle} value={season} onChange={e=>setSeason(e.target.value)}><option value="all">All Seasons</option>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select>
            <select style={inputStyle} value={team} onChange={e=>setTeam(e.target.value)}><option value="all">All Teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select>
            <select style={inputStyle} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Games</option><option value="completed">Completed</option><option value="upcoming">Not Played</option></select>
            <button className="secondary" onClick={()=>setShowImport(true)}>Import Workbook</button><button style={buttonStyle} onClick={()=>setShowNew(true)}>+ Add Game</button>
          </div>
        </div>
        {message && <div className="notice">{message}</div>}
        {tab === "Game Tracker" ? <div className="tracker-layout">
          <div className="game-list">
            <div className="list-head"><span>DATE / MATCHUP</span><span>RESULT</span></div>
            {busy && !games.length ? <p className="empty">Loading games…</p> : games.map(g=><button key={g.source_game_id} className={selectedGame?.source_game_id===g.source_game_id?"game-row chosen":"game-row"} onClick={()=>chooseGame(g)}>
              <span><b>{g.away_team} @ {g.home_team}</b><small>{g.game_date} · {g.game_time || "Time TBD"} · {g.game_type || "Game"}</small></span>
              <span className="score">{g.away_score == null ? "—" : `${g.away_score} - ${g.home_score}`}</span>
            </button>)}
            {!games.length && !busy && <p className="empty">No games match these filters. Historical data will appear here after import.</p>}
          </div>
          <aside className="editor">
            {selectedGame ? <>
              <span className="eyebrow">GAME EDITOR · #{selectedGame.source_game_id}</span>
              <h3>{selectedGame.away_team} <i>@</i> {selectedGame.home_team}</h3>
              <p className="muted">{selectedGame.game_date} · {selectedGame.season} {selectedGame.game_type || ""}</p>
              <label>{selectedGame.away_team} score<input style={inputStyle} type="number" min="0" value={form.away_score} onChange={e=>setForm({...form,away_score:e.target.value})}/></label>
              <label>{selectedGame.home_team} score<input style={inputStyle} type="number" min="0" value={form.home_score} onChange={e=>setForm({...form,home_score:e.target.value})}/></label>
              <label>Favorite team<select style={inputStyle} value={form.favorite_team} onChange={e=>setForm({...form,favorite_team:e.target.value,spread_text:""})}><option value="">No favorite / select team</option><option value={selectedGame.away_team}>{selectedGame.away_team}</option><option value={selectedGame.home_team}>{selectedGame.home_team}</option><option value="PK">Pick’em (PK)</option></select></label>
              {form.favorite_team !== "PK" && <label>Spread (points)<input style={inputStyle} type="number" min="0" step="0.5" value={form.favorite_spread} onChange={e=>setForm({...form,favorite_spread:e.target.value,spread_text:""})} placeholder="e.g. 3.5"/></label>}
              {form.favorite_team === "PK" && <p className="muted">Pick’em game · no team is favored.</p>}
              <div className="editor-meta"><span>Current total</span><b>{form.away_score!=="" && form.home_score!=="" ? Number(form.away_score)+Number(form.home_score) : "—"}</b></div>
              <button style={{...buttonStyle,width:"100%",marginTop:16}} disabled={busy} onClick={saveGame}>{busy?"Saving…":"Update Game Result"}</button>
            </> : <div className="select-prompt"><div>◈</div><h3>Select a game</h3><p>Choose a matchup from the list to edit its score and betting line.</p></div>}
          </aside>
        </div> : <div className="analytics">
          <div className="analytics-intro"><span className="eyebrow">SEASON ANALYTICS</span><h3>{tab} breakdown</h3><p>Calculated from completed games currently in view.</p></div>
          <div className="table-wrap"><table><thead><tr><th>TEAM</th><th>G</th><th>W</th><th>L</th><th>WIN %</th><th>HOME</th><th>AWAY</th></tr></thead><tbody>
            {statRows.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{r.played}</td><td>{r.wins}</td><td>{r.losses}</td><td>{r.winPct}</td><td>{r.home}</td><td>{r.away}</td></tr>)}
            {!statRows.length && <tr><td colSpan="7" className="empty">No imported games to analyze yet.</td></tr>}
          </tbody></table></div>
          <p className="muted">The detailed original Win/Loss, Against the Spread, Over/Under, and Points calculations are still being ported from the spreadsheet logic. This view does not substitute guessed calculations for those original reports.</p>
        </div>}
      </section>
      {showImport && <div className="modal-backdrop" onClick={()=>setShowImport(false)}><form className="modal" onSubmit={importWorkbook} onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><span className="eyebrow">HISTORICAL DATA</span><h2>Import NFL Scores workbook</h2></div><button type="button" className="close" onClick={()=>setShowImport(false)}>×</button></div>
        <p className="muted">Select the original NFL Scores.xlsx file. The importer reads only Data_Picks and Playoff_Data_Picks, skips season-heading rows, and avoids duplicate game IDs.</p>
        <label>Workbook file<input style={inputStyle} type="file" accept=".xlsx,.xls" onChange={e=>setImportFile(e.target.files?.[0] || null)} required/></label>
        <label>One-time import key<input style={inputStyle} type="password" autoComplete="off" value={importSecret} onChange={e=>setImportSecret(e.target.value)} required/></label>
        <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowImport(false)}>Cancel</button><button style={buttonStyle} disabled={busy}>{busy?"Importing…":"Import workbook"}</button></div>
      </form></div>}
      {showNew && <div className="modal-backdrop" onClick={()=>setShowNew(false)}><form className="modal" onSubmit={createGame} onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><span className="eyebrow">MANUAL ENTRY</span><h2>Add New Game</h2></div><button type="button" className="close" onClick={()=>setShowNew(false)}>×</button></div>
        <div className="form-grid">
          <label>Season<input style={inputStyle} type="number" value={newGame.season} onChange={e=>setNewGame({...newGame,season:e.target.value})} required/></label>
          <label>Game type<input style={inputStyle} value={newGame.game_type} onChange={e=>setNewGame({...newGame,game_type:e.target.value})} placeholder="Regular / Wild Card…"/></label>
          <label>Date<input style={inputStyle} type="date" value={newGame.game_date} onChange={e=>setNewGame({...newGame,game_date:e.target.value})} required/></label>
          <label>Time<input style={inputStyle} type="time" value={newGame.game_time} onChange={e=>setNewGame({...newGame,game_time:e.target.value})}/></label>
          <label>Away team<input style={inputStyle} value={newGame.away_team} onChange={e=>setNewGame({...newGame,away_team:e.target.value})} required/></label>
          <label>Home team<input style={inputStyle} value={newGame.home_team} onChange={e=>setNewGame({...newGame,home_team:e.target.value})} required/></label>
          <label>Favorite team<select style={inputStyle} value={newGame.favorite_team} onChange={e=>setNewGame({...newGame,favorite_team:e.target.value,spread_text:""})}><option value="">Select favorite</option><option value={newGame.away_team} disabled={!newGame.away_team}>{newGame.away_team || "Away team"}</option><option value={newGame.home_team} disabled={!newGame.home_team}>{newGame.home_team || "Home team"}</option><option value="PK">Pick’em (PK)</option></select></label>
          {newGame.favorite_team !== "PK" && <label>Spread (points)<input style={inputStyle} type="number" min="0" step="0.5" value={newGame.favorite_spread} onChange={e=>setNewGame({...newGame,favorite_spread:e.target.value,spread_text:""})} placeholder="e.g. 3.5"/></label>}
          {newGame.favorite_team === "PK" && <p className="muted">Pick’em · no favorite and no points.</p>}
        </div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowNew(false)}>Cancel</button><button style={buttonStyle} disabled={busy}>{busy?"Creating…":"Create Game"}</button></div>
      </form></div>}
    </main>
  );
}
