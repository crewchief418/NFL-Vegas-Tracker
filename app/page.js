"use client";

import { useEffect, useMemo, useState } from "react";

const tabs = ["Game Tracker", "Win/Loss", "Against Spread", "Over/Under", "Points"];
const inputStyle = { background: "#111b28", color: "#f3f6fa", border: "1px solid #34465c", borderRadius: 8, padding: "10px 12px", minWidth: 0, width: "100%" };
const buttonStyle = { background: "#e7b84e", color: "#151b24", border: 0, borderRadius: 8, padding: "10px 15px", fontWeight: 800, cursor: "pointer" };
function pct(n,d) { return d ? (n/d*100).toFixed(1)+"%" : "—"; }
function record(w,l,p=0) { return `${w}-${l}${p ? "-"+p : ""}`; }

export default function Home() {
  const [tab,setTab]=useState("Game Tracker"), [competition,setCompetition]=useState("regular"), [season,setSeason]=useState("all"), [team,setTeam]=useState("all"), [status,setStatus]=useState("all");
  const [games,setGames]=useState([]), [busy,setBusy]=useState(false), [message,setMessage]=useState(""), [selected,setSelected]=useState(null);
  const [form,setForm]=useState({away_score:"",home_score:"",favorite_team:"",favorite_spread:"",spread_text:"",over_under_line:""});
  const [showNew,setShowNew]=useState(false), [showImport,setShowImport]=useState(false), [importSecret,setImportSecret]=useState(""), [importFile,setImportFile]=useState(null);
  const [newGame,setNewGame]=useState({season:new Date().getFullYear(),game_date:"",game_time:"",away_team:"",home_team:"",favorite_team:"",favorite_spread:"",spread_text:"",over_under_line:"",game_type:""});

  async function loadGames() {
    setBusy(true); setMessage("");
    try {
      const qs=new URLSearchParams({competition});
      if(season!=="all") qs.set("season",season);
      if(team!=="all") qs.set("team",team);
      if(status==="completed") qs.set("completed","1");
      if(status==="upcoming") qs.set("completed","0");
      const response=await fetch("/api/games?"+qs), data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to load games");
      setGames(data.games||[]);
      setSelected(current=>current && data.games.some(g=>g.source_game_id===current.source_game_id)?current:null);
    } catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  useEffect(()=>{loadGames();},[competition,season,team,status]);
  const seasons=useMemo(()=>[...new Set(games.map(g=>g.season))].sort((a,b)=>b-a),[games]);
  const teams=useMemo(()=>[...new Set(games.flatMap(g=>[g.away_team,g.home_team]))].sort(),[games]);
  const completed=games.filter(g=>g.away_score!=null&&g.home_score!=null);
  const homeWins=completed.filter(g=>g.home_score>g.away_score).length, awayWins=completed.length-homeWins;
  const selectedGame=games.find(g=>g.source_game_id===selected?.source_game_id)||null;

  function chooseGame(g) {
    setSelected(g);
    setForm({
      away_score:g.away_score??"",home_score:g.home_score??"",
      favorite_team:g.favorite_team||(Number(g.spread_points)<0?g.away_team:Number(g.spread_points)>0?g.home_team:""),
      favorite_spread:g.favorite_spread??(g.spread_points==null?"":Math.abs(Number(g.spread_points))),
      spread_text:g.spread_text??"",over_under_line:g.over_under_line??""
    });
    setMessage("");
  }
  async function saveGame() {
    if(!selectedGame)return;
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/games",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,competition_type:competition,source_game_id:selectedGame.source_game_id,away_team:selectedGame.away_team,home_team:selectedGame.home_team})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Save failed");
      setMessage(data.ats_result==="push"?"Saved · ATS push":"Game and betting lines saved");await loadGames();
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  async function importWorkbook(e) {
    e.preventDefault();if(!importFile||!importSecret){setMessage("Choose the workbook and enter the import key.");return;}
    setBusy(true);setMessage("");
    try {
      const body=new FormData();body.append("file",importFile);
      const response=await fetch("/api/import",{method:"POST",headers:{"x-import-secret":importSecret},body}),data=await response.json();
      if(!response.ok)throw new Error(data.error||"Import failed");
      setShowImport(false);setImportSecret("");setImportFile(null);
      setMessage(`Workbook import complete: ${data.inserted.toLocaleString()} added, ${data.alreadyPresent.toLocaleString()} already existed.`);
      setSeason("all");setTeam("all");setStatus("all");await loadGames();
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  async function createGame(e) {
    e.preventDefault();setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/games",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...newGame,competition_type:competition})}),data=await response.json();
      if(!response.ok)throw new Error(data.error||"Could not create game");
      setShowNew(false);setMessage(`Game created · #${data.source_game_id}`);setSeason(String(newGame.season));setTeam("all");setStatus("all");await loadGames();
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }

  const analytics=useMemo(()=>{
    return teams.map(name=>{
      const played=completed.filter(g=>g.home_team===name||g.away_team===name);
      const wins=played.filter(g=>(g.home_team===name&&g.home_score>g.away_score)||(g.away_team===name&&g.away_score>g.home_score)).length;
      const home=played.filter(g=>g.home_team===name),away=played.filter(g=>g.away_team===name);
      const homeW=home.filter(g=>g.home_score>g.away_score).length,awayW=away.filter(g=>g.away_score>g.home_score).length;
      const ats=played.filter(g=>g.ats_result==="away"||g.ats_result==="home"||g.ats_result==="push");
      const atsW=ats.filter(g=>(g.ats_result==="away"&&g.away_team===name)||(g.ats_result==="home"&&g.home_team===name)).length;
      const atsL=ats.filter(g=>(g.ats_result==="away"&&g.home_team===name)||(g.ats_result==="home"&&g.away_team===name)).length;
      const atsP=ats.filter(g=>g.ats_result==="push").length;
      const ou=played.filter(g=>g.over_under_line!=null&&g.total_points!=null);
      const overs=ou.filter(g=>Number(g.total_points)>Number(g.over_under_line)).length;
      const unders=ou.filter(g=>Number(g.total_points)<Number(g.over_under_line)).length;
      const pushes=ou.length-overs-unders;
      const pf=played.reduce((s,g)=>s+(g.home_team===name?Number(g.home_score):Number(g.away_score)),0);
      const pa=played.reduce((s,g)=>s+(g.home_team===name?Number(g.away_score):Number(g.home_score)),0);
      return {name,played:played.length,wins,losses:played.length-wins,winPct:pct(wins,played.length),home:record(homeW,home.length-homeW),away:record(awayW,away.length-awayW),ats:record(atsW,atsL,atsP),atsGames:ats.length,over:record(overs,unders,pushes),ouGames:ou.length,pf,pa,diff:pf-pa};
    });
  },[teams,completed]);

  function analyticsTable() {
    let headers=[], cells= r=>[];
    if(tab==="Win/Loss"){headers=["TEAM","G","W","L","WIN %","HOME W-L","AWAY W-L"];cells=r=>[r.name,r.played,r.wins,r.losses,r.winPct,r.home,r.away];}
    if(tab==="Against Spread"){headers=["TEAM","ATS W-L-P","GRADED GAMES","COVER %"];cells=r=>[r.name,r.ats,r.atsGames,pct(r.ats.split("-").slice(0,1)[0],r.atsGames)];}
    if(tab==="Over/Under"){headers=["TEAM","OVER-UNDER-PUSH","GRADED GAMES","OVER %"];cells=r=>[r.name,r.over,r.ouGames,pct(r.over.split("-")[0],r.ouGames)];}
    if(tab==="Points"){headers=["TEAM","G","POINTS FOR","POINTS AGAINST","DIFFERENTIAL","AVG POINTS"];cells=r=>[r.name,r.played,r.pf,r.pa,r.diff,r.played?(r.pf/r.played).toFixed(1):"—"];}
    return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{analytics.map(r=><tr key={r.name}>{cells(r).map((v,i)=><td key={i}>{i===0?<b>{v}</b>:v}</td>)}</tr>)}{!analytics.length&&<tr><td colSpan={headers.length} className="empty">No imported games to analyze yet.</td></tr>}</tbody></table></div>;
  }

  return <main className="shell">
    <header className="topbar"><div><div className="eyebrow">NFL DATA & BETTING ANALYTICS</div><h1>NFL Vegas Tracker</h1><p>Game results · point spreads · historical trends</p></div><div className="season-mark">NFL <b>TRACKER</b><span>EST. 2013</span></div></header>
    <section className="metrics"><div><span>GAMES IN VIEW</span><strong>{games.length.toLocaleString()}</strong></div><div><span>COMPLETED</span><strong>{completed.length.toLocaleString()}</strong></div><div><span>HOME WINS</span><strong>{homeWins.toLocaleString()}</strong></div><div><span>AWAY WINS</span><strong>{awayWins.toLocaleString()}</strong></div></section>
    <nav className="tabs">{tabs.map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}</nav>
    <section className="panel"><div className="toolbar"><div><h2>{tab}</h2><p>{competition==="regular"?"Regular season":"Playoffs"} · historical game database</p></div><div className="filters">
      <select style={inputStyle} value={competition} onChange={e=>{setCompetition(e.target.value);setSeason("all");setTeam("all");}}><option value="regular">Regular Season</option><option value="playoffs">Playoffs</option></select>
      <select style={inputStyle} value={season} onChange={e=>setSeason(e.target.value)}><option value="all">All Seasons</option>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <select style={inputStyle} value={team} onChange={e=>setTeam(e.target.value)}><option value="all">All Teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select>
      <select style={inputStyle} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Games</option><option value="completed">Completed</option><option value="upcoming">Not Played</option></select>
      <button className="secondary" onClick={()=>setShowImport(true)}>Import Workbook</button><button style={buttonStyle} onClick={()=>setShowNew(true)}>+ Add Game</button>
    </div></div>
    {message&&<div className="notice">{message}</div>}
    {tab==="Game Tracker"?<div className="tracker-layout">
      <div className="game-list"><div className="list-head"><span>DATE / MATCHUP</span><span>RESULT</span></div>
        {busy&&!games.length?<p className="empty">Loading games…</p>:games.map(g=><button key={g.source_game_id} className={selectedGame?.source_game_id===g.source_game_id?"game-row chosen":"game-row"} onClick={()=>chooseGame(g)}>
          <span><b>{g.away_team} @ {g.home_team}</b><small>{g.game_date} · {g.game_time||"Time TBD"} · {g.game_type||"Game"}{g.favorite_team? ` · Fav: ${g.favorite_team} -${g.favorite_spread??""}`:""}{g.over_under_line!=null?` · O/U ${g.over_under_line}`:""}</small></span><span className="score">{g.away_score==null?"—":`${g.away_score} - ${g.home_score}`}</span>
        </button>)}
        {!games.length&&!busy&&<p className="empty">No games match these filters. Import historical data to populate the tracker.</p>}
      </div>
      <aside className="editor">{selectedGame?<><span className="eyebrow">GAME EDITOR · #{selectedGame.source_game_id}</span><h3>{selectedGame.away_team} <i>@</i> {selectedGame.home_team}</h3><p className="muted">{selectedGame.game_date} · {selectedGame.season} {selectedGame.game_type||""}</p>
        <label>{selectedGame.away_team} score<input style={inputStyle} type="number" min="0" value={form.away_score} onChange={e=>setForm({...form,away_score:e.target.value})}/></label>
        <label>{selectedGame.home_team} score<input style={inputStyle} type="number" min="0" value={form.home_score} onChange={e=>setForm({...form,home_score:e.target.value})}/></label>
        <div className="form-grid">
          <label>Favorite team<select style={inputStyle} value={form.favorite_team} onChange={e=>setForm({...form,favorite_team:e.target.value})}><option value="">No favorite</option><option value={selectedGame.away_team}>{selectedGame.away_team}</option><option value={selectedGame.home_team}>{selectedGame.home_team}</option><option value="PK">Pick’em (PK)</option></select></label>
          <label>Spread (points)<input style={inputStyle} type="number" min="0" step="0.5" value={form.favorite_spread} disabled={form.favorite_team==="PK"} onChange={e=>setForm({...form,favorite_spread:e.target.value})} placeholder="e.g. 3.5"/></label>
          <label className="full">Over/under total<input style={inputStyle} type="number" min="0" step="0.5" value={form.over_under_line} onChange={e=>setForm({...form,over_under_line:e.target.value})} placeholder="e.g. 44.5"/></label>
        </div>
        {form.favorite_team==="PK"&&<p className="muted">Pick’em · spread is automatically zero.</p>}
        <div className="editor-meta"><span>Actual game total</span><b>{form.away_score!==""&&form.home_score!==""?Number(form.away_score)+Number(form.home_score):"—"}</b></div>
        <button style={{...buttonStyle,width:"100%",marginTop:16}} disabled={busy} onClick={saveGame}>{busy?"Saving…":"Update Game Result & Lines"}</button>
      </>:<div className="select-prompt"><div>◈</div><h3>Select a game</h3><p>Choose a matchup to edit its scores, favorite, spread, and over/under line.</p></div>}</aside>
    </div>:<div className="analytics"><div className="analytics-intro"><span className="eyebrow">SEASON ANALYTICS</span><h3>{tab} breakdown</h3><p>{tab==="Against Spread"?"ATS results are graded against the favorite's spread.":tab==="Over/Under"?"Compares actual combined score with the entered betting total.":tab==="Points"?"Points scored and allowed by each team.":"Win-loss records split by home and away games."} Only completed games currently in view are included.</p></div>{analyticsTable()}</div>}
    </section>
    {showImport&&<div className="modal-backdrop" onClick={()=>setShowImport(false)}><form className="modal" onSubmit={importWorkbook} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">HISTORICAL DATA</span><h2>Import NFL Scores workbook</h2></div><button type="button" className="close" onClick={()=>setShowImport(false)}>×</button></div><p className="muted">Reads Data_Picks and Playoff_Data_Picks, skips heading rows, and avoids duplicate game IDs.</p><label>Workbook file<input style={inputStyle} type="file" accept=".xlsx,.xls" onChange={e=>setImportFile(e.target.files?.[0]||null)} required/></label><label>One-time import key<input style={inputStyle} type="password" autoComplete="off" value={importSecret} onChange={e=>setImportSecret(e.target.value)} required/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowImport(false)}>Cancel</button><button style={buttonStyle} disabled={busy}>{busy?"Importing…":"Import workbook"}</button></div></form></div>}
    {showNew&&<div className="modal-backdrop" onClick={()=>setShowNew(false)}><form className="modal" onSubmit={createGame} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MANUAL ENTRY</span><h2>Add New Game</h2></div><button type="button" className="close" onClick={()=>setShowNew(false)}>×</button></div>
      <div className="form-grid">
        <label>Season<input style={inputStyle} type="number" value={newGame.season} onChange={e=>setNewGame({...newGame,season:e.target.value})} required/></label><label>Game type<input style={inputStyle} value={newGame.game_type} onChange={e=>setNewGame({...newGame,game_type:e.target.value})} placeholder="Regular / Wild Card…"/></label>
        <label>Date<input style={inputStyle} type="date" value={newGame.game_date} onChange={e=>setNewGame({...newGame,game_date:e.target.value})} required/></label><label>Time<input style={inputStyle} type="time" value={newGame.game_time} onChange={e=>setNewGame({...newGame,game_time:e.target.value})}/></label>
        <label>Away team<input style={inputStyle} value={newGame.away_team} onChange={e=>setNewGame({...newGame,away_team:e.target.value})} required/></label><label>Home team<input style={inputStyle} value={newGame.home_team} onChange={e=>setNewGame({...newGame,home_team:e.target.value})} required/></label>
        <label>Favorite team<select style={inputStyle} value={newGame.favorite_team} onChange={e=>setNewGame({...newGame,favorite_team:e.target.value})}><option value="">No favorite</option><option value={newGame.away_team} disabled={!newGame.away_team}>{newGame.away_team||"Away team"}</option><option value={newGame.home_team} disabled={!newGame.home_team}>{newGame.home_team||"Home team"}</option><option value="PK">Pick’em (PK)</option></select></label>
        <label>Spread (points)<input style={inputStyle} type="number" min="0" step="0.5" value={newGame.favorite_spread} disabled={newGame.favorite_team==="PK"} onChange={e=>setNewGame({...newGame,favorite_spread:e.target.value})} placeholder="e.g. 3.5"/></label>
        <label className="full">Over/under total<input style={inputStyle} type="number" min="0" step="0.5" value={newGame.over_under_line} onChange={e=>setNewGame({...newGame,over_under_line:e.target.value})} placeholder="e.g. 44.5"/></label>
      </div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowNew(false)}>Cancel</button><button style={buttonStyle} disabled={busy}>{busy?"Creating…":"Create Game"}</button></div></form></div>}
  </main>;
}
