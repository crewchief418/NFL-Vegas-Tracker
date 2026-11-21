"use client";

import { useEffect, useMemo, useState } from "react";

const tabs = ["Game Tracker", "Team Performance", "Against Spread", "Over/Under", "Head-to-Head", "Season Trends", "Win/Loss", "Points"];
const divisions = {
  "AFC East":["Bills","Dolphins","Patriots","Jets"], "AFC North":["Ravens","Bengals","Browns","Steelers"],
  "AFC South":["Texans","Colts","Jaguars","Titans"], "AFC West":["Broncos","Chiefs","Raiders","Chargers"],
  "NFC East":["Cowboys","Giants","Eagles","Commanders"], "NFC North":["Bears","Lions","Packers","Vikings"],
  "NFC South":["Falcons","Panthers","Saints","Buccaneers"], "NFC West":["Cardinals","Rams","49ers","Seahawks"]
};
const teamDivision = Object.fromEntries(Object.entries(divisions).flatMap(([division,names])=>names.map(name=>[name,division])));
const inputStyle = { background: "#111b28", color: "#f3f6fa", border: "1px solid #34465c", borderRadius: 8, padding: "10px 12px", minWidth: 0, width: "100%" };
const buttonStyle = { background: "#e7b84e", color: "#151b24", border: 0, borderRadius: 8, padding: "10px 15px", fontWeight: 800, cursor: "pointer" };
function pct(n,d) { return d ? (n/d*100).toFixed(1)+"%" : "—"; }
function record(w,l,p=0) { return `${w}-${l}${p ? "-"+p : ""}`; }

export default function Home() {
  const [tab,setTab]=useState("Game Tracker"), [competition,setCompetition]=useState("regular"), [season,setSeason]=useState("all"), [team,setTeam]=useState("all"), [status,setStatus]=useState("all"), [opponent,setOpponent]=useState("all");
  const [games,setGames]=useState([]), [busy,setBusy]=useState(false), [message,setMessage]=useState(""), [selected,setSelected]=useState(null), [showEditor,setShowEditor]=useState(false), [gameSearch,setGameSearch]=useState("");
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
  const visibleGames=games.filter(g=>!gameSearch||`${g.away_team} ${g.home_team} ${g.game_date} ${g.source_game_id}`.toLowerCase().includes(gameSearch.toLowerCase()));
  const ouGradedCount=completed.filter(g=>g.over_under_line!=null&&g.total_points!=null).length;

  function chooseGame(g) {
    setSelected(g);
    setForm({
      away_score:g.away_score??"",home_score:g.home_score??"",
      favorite_team:g.favorite_team||(Number(g.spread_points)<0?g.away_team:Number(g.spread_points)>0?g.home_team:""),
      favorite_spread:g.favorite_spread??(g.spread_points==null?"":Math.abs(Number(g.spread_points))),
      spread_text:g.spread_text??"",over_under_line:g.over_under_line??""
    });
    setMessage("");
    setShowEditor(true);
  }
  function moveSelected(direction) {
    const index=games.findIndex(g=>g.source_game_id===selectedGame?.source_game_id);
    const next=games[index+direction];
    if(next) chooseGame(next);
  }
  async function saveGame() {
    if(!selectedGame)return;
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/games",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,competition_type:selectedGame.competition_type,source_game_id:selectedGame.source_game_id,away_team:selectedGame.away_team,home_team:selectedGame.home_team})});
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

  const teamPerformance=useMemo(()=>teams.map(name=>{
    const played=completed.filter(g=>g.home_team===name||g.away_team===name);
    const split=(gamesFor)=>{
      const w=gamesFor.filter(g=>(g.home_team===name&&g.home_score>g.away_score)||(g.away_team===name&&g.away_score>g.home_score)).length;
      const l=gamesFor.filter(g=>(g.home_team===name&&g.home_score<g.away_score)||(g.away_team===name&&g.away_score<g.home_score)).length;
      const t=gamesFor.length-w-l;
      return {w,l,t,g:gamesFor.length,pct:gamesFor.length?pct(w+t*.5,gamesFor.length):"—"};
    };
    const home=played.filter(g=>g.home_team===name), away=played.filter(g=>g.away_team===name);
    const division=played.filter(g=>teamDivision[name]&&teamDivision[g.home_team===name?g.away_team:g.home_team]===teamDivision[name]);
    const nonDivision=played.filter(g=>!teamDivision[name]||teamDivision[g.home_team===name?g.away_team:g.home_team]!==teamDivision[name]);
    const pf=played.reduce((sum,g)=>sum+Number(g.home_team===name?g.home_score:g.away_score),0);
    const pa=played.reduce((sum,g)=>sum+Number(g.home_team===name?g.away_score:g.home_score),0);
    return {name,overall:split(played),home:split(home),away:split(away),division:split(division),nonDivision:split(nonDivision),pf,pa,ppg:played.length?(pf/played.length).toFixed(1):"—",papg:played.length?(pa/played.length).toFixed(1):"—"};
  }).sort((a,b)=>b.overall.pct==="—"?1:a.overall.pct==="—"?-1:Number(b.overall.pct.replace("%",""))-Number(a.overall.pct.replace("%",""))),[teams,completed]);
  const focusedTeam=team==="all"?null:teamPerformance.find(t=>t.name===team);

  const matchupTeam=team==="all"?(teams[0]||""):team;
  const matchupOpponent=opponent==="all"?(teams.find(t=>t!==matchupTeam)||""):opponent;
  const matchupGames=completed.filter(g=>(g.home_team===matchupTeam&&g.away_team===matchupOpponent)||(g.away_team===matchupTeam&&g.home_team===matchupOpponent)).sort((a,b)=>b.game_date.localeCompare(a.game_date));
  const matchupWins=matchupGames.filter(g=>(g.home_team===matchupTeam&&g.home_score>g.away_score)||(g.away_team===matchupTeam&&g.away_score>g.home_score)).length;
  const matchupLosses=matchupGames.filter(g=>(g.home_team===matchupTeam&&g.home_score<g.away_score)||(g.away_team===matchupTeam&&g.away_score<g.home_score)).length;
  const atsPerformance=useMemo(()=>teams.map(name=>{
    const played=completed.filter(g=>(g.home_team===name||g.away_team===name)&&["home","away","push"].includes(g.ats_result)&&g.spread_points!=null);
    const stat=arr=>{const w=arr.filter(g=>g.covered_team===name).length,p=arr.filter(g=>g.ats_result==="push").length,l=arr.length-w-p;return {w,l,p,g:arr.length,cover:pct(w,arr.length-p)};};
    const favorite=g=>Number(g.spread_points)!==0&&((g.home_team===name&&Number(g.spread_points)>0)||(g.away_team===name&&Number(g.spread_points)<0));
    const home=played.filter(g=>g.home_team===name),away=played.filter(g=>g.away_team===name),fav=played.filter(favorite),dog=played.filter(g=>Number(g.spread_points)!==0&&!favorite(g)),even=played.filter(g=>Number(g.spread_points)===0);
    const div=played.filter(g=>teamDivision[g.home_team===name?g.away_team:g.home_team]===teamDivision[name]);
    const band=(lo,hi)=>played.filter(g=>Math.abs(Number(g.spread_points))>=lo&&(hi==null||Math.abs(Number(g.spread_points))<hi));
    return {name,overall:stat(played),home:stat(home),away:stat(away),favorite:stat(fav),dog:stat(dog),even:stat(even),homeFav:stat(home.filter(favorite)),homeDog:stat(home.filter(g=>Number(g.spread_points)!==0&&!favorite(g))),homeEven:stat(home.filter(g=>Number(g.spread_points)===0)),awayFav:stat(away.filter(favorite)),awayDog:stat(away.filter(g=>Number(g.spread_points)!==0&&!favorite(g))),awayEven:stat(away.filter(g=>Number(g.spread_points)===0)),division:stat(div),nonDivision:stat(played.filter(g=>!div.includes(g))),bands:[["0–2.5",stat(band(.01,3))],["3–6.5",stat(band(3,7))],["7–9.5",stat(band(7,10))],["10+",stat(band(10,null))]]};
  }),[teams,completed]);
  const focusedATS=atsPerformance.find(r=>r.name===team);
  const ouPerformance=useMemo(()=>teams.map(name=>{
    const played=completed.filter(g=>(g.home_team===name||g.away_team===name)&&g.over_under_line!=null&&g.total_points!=null);
    const result=arr=>{const over=arr.filter(g=>Number(g.total_points)>Number(g.over_under_line)).length,under=arr.filter(g=>Number(g.total_points)<Number(g.over_under_line)).length,push=arr.length-over-under;return {over,under,push,g:arr.length,pct:pct(over,arr.length-push)};};
    const favorite=g=>Number(g.spread_points)!==0&&((g.home_team===name&&Number(g.spread_points)>0)||(g.away_team===name&&Number(g.spread_points)<0));
    const div=played.filter(g=>teamDivision[g.home_team===name?g.away_team:g.home_team]===teamDivision[name]);
    return {name,overall:result(played),home:result(played.filter(g=>g.home_team===name)),away:result(played.filter(g=>g.away_team===name)),favorite:result(played.filter(favorite)),underdog:result(played.filter(g=>Number(g.spread_points)!==0&&!favorite(g))),even:result(played.filter(g=>Number(g.spread_points)===0)),division:result(div),nonDivision:result(played.filter(g=>!div.includes(g)))};
  }),[teams,completed]);
  const focusedOU=ouPerformance.find(r=>r.name===team);
  const seasonTrends=useMemo(()=>[...new Set(completed.map(g=>g.season))].sort((a,b)=>a-b).map(year=>{const list=completed.filter(g=>g.season===year),ats=list.filter(g=>["home","away","push"].includes(g.ats_result)),ou=list.filter(g=>g.over_under_line!=null&&g.total_points!=null);const over=ou.filter(g=>Number(g.total_points)>Number(g.over_under_line)).length,under=ou.filter(g=>Number(g.total_points)<Number(g.over_under_line)).length,push=ou.length-over-under;const home=list.filter(g=>g.home_score>g.away_score).length,away=list.filter(g=>g.away_score>g.home_score).length;const fav=ats.filter(g=>Number(g.spread_points)!==0),favPush=fav.filter(g=>g.ats_result==="push").length,favW=fav.filter(g=>g.covered_team===(Number(g.spread_points)>0?g.home_team:g.away_team)).length,favL=fav.length-favPush-favW;return {year,g:list.length,home,away,favW,favL,favPush,over,under,push,avg:list.length?(list.reduce((s,g)=>s+Number(g.total_points||0),0)/list.length).toFixed(1):"—"};}),[completed]);
  function analyticsTable() {
    let headers=[], cells= r=>[];
    if(tab==="Win/Loss"){headers=["TEAM","G","W","L","WIN %","HOME W-L","AWAY W-L"];cells=r=>[r.name,r.played,r.wins,r.losses,r.winPct,r.home,r.away];}
    if(tab==="Against Spread"){headers=["TEAM","ATS W-L-P","GRADED GAMES","COVER %"];cells=r=>[r.name,r.ats,r.atsGames,r.atsGames?pct(Number(r.ats.split("-")[0]),Math.max(0,r.atsGames-Number(r.ats.split("-")[2]||0))):"—"];}
    if(tab==="Over/Under"){headers=["TEAM","OVER-UNDER-PUSH","GRADED GAMES","OVER %"];cells=r=>[r.name,r.ouGames?r.over:"—",r.ouGames,pct(Number(r.over.split("-")[0]),Math.max(0,r.ouGames-Number(r.over.split("-")[2]||0)))];}
    if(tab==="Points"){headers=["TEAM","G","POINTS FOR","POINTS AGAINST","DIFFERENTIAL","AVG POINTS"];cells=r=>[r.name,r.played,r.pf,r.pa,r.diff,r.played?(r.pf/r.played).toFixed(1):"—"];}
    if(tab==="Over/Under" && ouGradedCount===0) return <div className="empty-state"><div className="eyebrow">OVER / UNDER DATA</div><h3>No Vegas over/under lines are available for this selection</h3><p>The Vegas line is imported from column I (Total) in Data_Picks and Playoff_Data_Picks. The actual combined game total is calculated separately from the final scores. Historical lines are available from 2020 onward where the workbook has a value.</p><button style={buttonStyle} onClick={()=>setTab("Game Tracker")}>Go to Game Tracker</button></div>;
    return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{analytics.map(r=><tr key={r.name}>{cells(r).map((v,i)=><td key={i}>{i===0?<b>{v}</b>:v}</td>)}</tr>)}{!analytics.length&&<tr><td colSpan={headers.length} className="empty">No imported games to analyze yet.</td></tr>}</tbody></table></div>;
  }

  return <main className="shell">
    <header className="topbar"><div><div className="eyebrow">NFL DATA & BETTING ANALYTICS</div><h1>NFL Vegas Tracker</h1><p>Game results · point spreads · historical trends</p></div><div className="season-mark">NFL <b>TRACKER</b><span>EST. 2013</span></div></header>
    <section className="metrics"><div><span>GAMES IN VIEW</span><strong>{games.length.toLocaleString()}</strong></div><div><span>COMPLETED</span><strong>{completed.length.toLocaleString()}</strong></div><div><span>HOME WINS</span><strong>{homeWins.toLocaleString()}</strong></div><div><span>AWAY WINS</span><strong>{awayWins.toLocaleString()}</strong></div></section>
    <nav className="tabs">{tabs.map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}</nav>
    <section className="panel"><div className="toolbar"><div><h2>{tab}</h2><p>{competition==="regular"?"Regular season":"Playoffs"} · historical game database</p></div><div className="filters">
      <select style={inputStyle} value={competition} onChange={e=>{setCompetition(e.target.value);setSeason("all");setTeam("all");setOpponent("all");}}><option value="all">Regular + Playoffs</option><option value="regular">Regular Season</option><option value="playoffs">Playoffs</option></select>
      <select style={inputStyle} value={season} onChange={e=>setSeason(e.target.value)}><option value="all">All Seasons</option>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <select style={inputStyle} value={team} onChange={e=>setTeam(e.target.value)}><option value="all">All Teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select>
      <select style={inputStyle} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Games</option><option value="completed">Completed</option><option value="upcoming">Not Played</option></select>
      <button className="secondary" onClick={()=>setShowImport(true)}>Import Workbook</button><button style={buttonStyle} disabled={competition==="all"} title={competition==="all"?"Choose Regular Season or Playoffs to add a game":""} onClick={()=>setShowNew(true)}>+ Add Game</button>
    </div></div>
    {message&&<div className="notice">{message}</div>}
    {tab==="Game Tracker"?<div className="tracker-layout">
      <div className="game-list"><div className="game-search"><input aria-label="Search games" style={inputStyle} placeholder="Search team, date, or game ID…" value={gameSearch} onChange={e=>setGameSearch(e.target.value)}/><span>{visibleGames.length.toLocaleString()} games</span></div><div className="list-head"><span>DATE / MATCHUP</span><span>RESULT</span></div>
        {busy&&!games.length?<p className="empty">Loading games…</p>:visibleGames.map(g=><button key={g.source_game_id} className={selectedGame?.source_game_id===g.source_game_id?"game-row chosen":"game-row"} onClick={()=>chooseGame(g)}>
          <span><b>{g.away_team} @ {g.home_team}</b><small>{g.game_date} · {g.game_time||"Time TBD"} · {g.game_type||"Game"}{g.favorite_team? ` · Fav: ${g.favorite_team} -${g.favorite_spread??""}`:""}{g.over_under_line!=null?` · O/U ${g.over_under_line}`:""}</small></span><span className="score">{g.away_score==null?"—":`${g.away_score} - ${g.home_score}`}</span>
        </button>)}
        {!visibleGames.length&&!busy&&<p className="empty">No games match this search and filter.</p>}
      </div>

    </div>:tab==="Team Performance"?<div className="analytics"><div className="analytics-intro"><span className="eyebrow">HISTORICAL TEAM RECORDS</span><h3>{focusedTeam?focusedTeam.name+" performance":"All-team performance"}</h3><p>Completed games only · win percentage counts ties as half a win · division opponents are based on NFL division alignment.</p></div>
      {focusedTeam?<><div className="performance-cards"><div className="performance-card"><span>OVERALL</span><strong>{record(focusedTeam.overall.w,focusedTeam.overall.l,focusedTeam.overall.t)}</strong><small>{focusedTeam.overall.pct} · {focusedTeam.overall.g} games</small></div><div className="performance-card"><span>HOME</span><strong>{record(focusedTeam.home.w,focusedTeam.home.l,focusedTeam.home.t)}</strong><small>{focusedTeam.home.pct} · {focusedTeam.home.g} games</small></div><div className="performance-card"><span>AWAY</span><strong>{record(focusedTeam.away.w,focusedTeam.away.l,focusedTeam.away.t)}</strong><small>{focusedTeam.away.pct} · {focusedTeam.away.g} games</small></div><div className="performance-card"><span>POINTS PER GAME</span><strong>{focusedTeam.ppg} – {focusedTeam.papg}</strong><small>Scored · allowed</small></div></div>
      <div className="performance-splits"><div><h4>Opponent breakdown</h4>{[["Division opponents",focusedTeam.division],["Non-division opponents",focusedTeam.nonDivision]].map(([label,r])=><div className="split-row" key={label}><span>{label}</span><b>{record(r.w,r.l,r.t)}</b><strong>{r.pct}</strong><small>{r.g} games</small></div>)}</div><div><h4>Home vs. away winning percentage</h4>{[["Home",focusedTeam.home],["Away",focusedTeam.away]].map(([label,r])=><div className="bar-row" key={label}><div><span>{label}</span><b>{r.pct}</b></div><div className="bar-track"><i style={{width:r.pct==="—"?"0":r.pct}}/></div><small>{record(r.w,r.l,r.t)} · {r.g} games</small></div>)}</div></div></>:<div className="table-wrap"><table className="performance-table"><thead><tr><th>TEAM</th><th>W-L-T</th><th>WIN %</th><th>HOME</th><th>AWAY</th><th>DIVISION</th><th>NON-DIVISION</th><th>PF/G</th><th>PA/G</th></tr></thead><tbody>{teamPerformance.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{record(r.overall.w,r.overall.l,r.overall.t)}</td><td><b>{r.overall.pct}</b></td><td>{record(r.home.w,r.home.l,r.home.t)}</td><td>{record(r.away.w,r.away.l,r.away.t)}</td><td>{record(r.division.w,r.division.l,r.division.t)}</td><td>{record(r.nonDivision.w,r.nonDivision.l,r.nonDivision.t)}</td><td>{r.ppg}</td><td>{r.papg}</td></tr>)}</tbody></table></div>}
    </div>:<div className="analytics"><div className="analytics-intro"><span className="eyebrow">HISTORICAL ANALYTICS</span><h3>{tab} breakdown</h3><p>Completed games only · sample sizes are shown with each result.</p></div>
    {tab==="Over/Under" && (focusedOU ? <><div className="performance-cards">{[["OVERALL",focusedOU.overall],["HOME",focusedOU.home],["AWAY",focusedOU.away],["FAVORITE",focusedOU.favorite],["UNDERDOG",focusedOU.underdog],["EVEN",focusedOU.even],["DIVISION",focusedOU.division],["NON-DIVISION",focusedOU.nonDivision]].map(([label,r])=><div className="performance-card" key={label}><span>{label}</span><strong>{r.over}-{r.under}-{r.push}</strong><small>{r.pct} over · {r.g} games</small></div>)}</div></> : <div className="table-wrap"><table><thead><tr><th>TEAM</th><th>OVER-UNDER-PUSH</th><th>GAMES</th><th>OVER %</th><th>HOME</th><th>AWAY</th><th>FAVORITE</th><th>UNDERDOG</th><th>DIVISION</th><th>NON-DIV</th></tr></thead><tbody>{ouPerformance.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{r.overall.over}-{r.overall.under}-{r.overall.push}</td><td>{r.overall.g}</td><td>{r.overall.pct}</td><td>{r.home.over}-{r.home.under}-{r.home.push}</td><td>{r.away.over}-{r.away.under}-{r.away.push}</td><td>{r.favorite.over}-{r.favorite.under}-{r.favorite.push}</td><td>{r.underdog.over}-{r.underdog.under}-{r.underdog.push}</td><td>{r.division.over}-{r.division.under}-{r.division.push}</td><td>{r.nonDivision.over}-{r.nonDivision.under}-{r.nonDivision.push}</td></tr>)}</tbody></table></div>)}
    {tab==="Against Spread" && (focusedATS ? <><div className="performance-cards">{[["OVERALL",focusedATS.overall],["HOME",focusedATS.home],["AWAY",focusedATS.away],["FAVORITE",focusedATS.favorite],["UNDERDOG",focusedATS.dog],["EVEN",focusedATS.even],["DIVISION",focusedATS.division],["NON-DIVISION",focusedATS.nonDivision]].map(([label,r])=><div className="performance-card" key={label}><span>{label}</span><strong>{record(r.w,r.l,r.p)}</strong><small>{r.cover} cover · {r.g} games</small></div>)}</div><div className="performance-splits"><div><h4>Home / away status</h4>{[["Home favorite",focusedATS.homeFav],["Home underdog",focusedATS.homeDog],["Home even",focusedATS.homeEven],["Away favorite",focusedATS.awayFav],["Away underdog",focusedATS.awayDog],["Away even",focusedATS.awayEven]].map(([label,r])=><div className="split-row" key={label}><span>{label}</span><b>{record(r.w,r.l,r.p)}</b><strong>{r.cover}</strong><small>{r.g} games</small></div>)}</div><div><h4>Spread size</h4>{focusedATS.bands.map(([label,r])=><div className="split-row" key={label}><span>{label}</span><b>{record(r.w,r.l,r.p)}</b><strong>{r.cover}</strong><small>{r.g} games</small></div>)}</div></div></> : <div className="table-wrap"><table><thead><tr><th>TEAM</th><th>ATS W-L-P</th><th>GAMES</th><th>COVER %</th><th>FAVORITE</th><th>UNDERDOG</th><th>HOME</th><th>AWAY</th><th>DIVISION</th><th>NON-DIV</th></tr></thead><tbody>{atsPerformance.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{record(r.overall.w,r.overall.l,r.overall.p)}</td><td>{r.overall.g}</td><td>{r.overall.cover}</td><td>{record(r.favorite.w,r.favorite.l,r.favorite.p)} · {r.favorite.cover}</td><td>{record(r.dog.w,r.dog.l,r.dog.p)} · {r.dog.cover}</td><td>{record(r.home.w,r.home.l,r.home.p)} · {r.home.cover}</td><td>{record(r.away.w,r.away.l,r.away.p)} · {r.away.cover}</td><td>{record(r.division.w,r.division.l,r.division.p)} · {r.division.cover}</td><td>{record(r.nonDivision.w,r.nonDivision.l,r.nonDivision.p)} · {r.nonDivision.cover}</td></tr>)}</tbody></table></div>)}
    {tab==="Head-to-Head" && <><div className="h2h-controls"><label>Team<select style={inputStyle} value={matchupTeam} onChange={e=>{setTeam(e.target.value);setOpponent("all");}}>{teams.map(t=><option key={t}>{t}</option>)}</select></label><label>Opponent<select style={inputStyle} value={matchupOpponent} onChange={e=>setOpponent(e.target.value)}>{teams.filter(t=>t!==matchupTeam).map(t=><option key={t}>{t}</option>)}</select></label></div><div className="performance-cards"><div className="performance-card"><span>{matchupTeam} RECORD</span><strong>{record(matchupWins,matchupLosses,matchupGames.length-matchupWins-matchupLosses)}</strong><small>{matchupGames.length} meetings</small></div><div className="performance-card"><span>LAST MEETING</span><strong>{matchupGames[0]?.game_date||"—"}</strong><small>{matchupGames[0]?matchupGames[0].away_team+" "+matchupGames[0].away_score+" – "+matchupGames[0].home_score+" "+matchupGames[0].home_team:"No games"}</small></div></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>SEASON</th><th>MATCHUP</th><th>SCORE</th><th>WINNER</th><th>ATS COVER</th><th>O/U</th></tr></thead><tbody>{matchupGames.map(g=><tr key={g.source_game_id}><td>{g.game_date}</td><td>{g.season}</td><td>{g.away_team} @ {g.home_team}</td><td>{g.away_score} – {g.home_score}</td><td>{g.away_score>g.home_score?g.away_team:g.home_score>g.away_score?g.home_team:"Tie"}</td><td>{g.ats_result==="push"?"Push":g.covered_team||"—"}</td><td>{g.over_under_line==null?"—":Number(g.total_points)>Number(g.over_under_line)?"Over":Number(g.total_points)<Number(g.over_under_line)?"Under":"Push"}</td></tr>)}</tbody></table></div></>}
    {tab==="Season Trends" && <div className="table-wrap"><table><thead><tr><th>SEASON</th><th>GAMES</th><th>HOME WINS</th><th>AWAY WINS</th><th>FAVORITE ATS W-L-P</th><th>FAV COVER %</th><th>OVER</th><th>UNDER</th><th>O/U PUSH</th><th>AVG TOTAL</th></tr></thead><tbody>{seasonTrends.map(r=><tr key={r.year}><td><b>{r.year}</b></td><td>{r.g}</td><td>{r.home}</td><td>{r.away}</td><td>{record(r.favW,r.favL,r.favPush)}</td><td>{pct(r.favW,r.favW+r.favL)}</td><td>{r.over}</td><td>{r.under}</td><td>{r.push}</td><td>{r.avg}</td></tr>)}</tbody></table></div>}
    {["Win/Loss","Points"].includes(tab) && analyticsTable()}
    </div>}
    </section>
    {showEditor&&selectedGame&&<div className="modal-backdrop editor-backdrop" onClick={()=>setShowEditor(false)}><section className="editor editor-modal" onClick={e=>e.stopPropagation()}><div className="editor-modal-head"><div><span className="eyebrow">GAME EDITOR · #{selectedGame.source_game_id}</span><h3>{selectedGame.away_team} <i>@</i> {selectedGame.home_team}</h3><p className="muted">{selectedGame.game_date} · {selectedGame.season} {selectedGame.game_type||""}</p></div><button className="close" onClick={()=>setShowEditor(false)}>×</button></div>
      <div className="editor-nav"><button className="secondary" onClick={()=>moveSelected(-1)} disabled={games.findIndex(g=>g.source_game_id===selectedGame.source_game_id)===0}>← Previous game</button><button className="secondary" onClick={()=>moveSelected(1)} disabled={games.findIndex(g=>g.source_game_id===selectedGame.source_game_id)===games.length-1}>Next game →</button></div>
      <div className="score-grid"><label>{selectedGame.away_team} score<input autoFocus style={inputStyle} type="number" min="0" value={form.away_score} onChange={e=>setForm({...form,away_score:e.target.value})}/></label><label>{selectedGame.home_team} score<input style={inputStyle} type="number" min="0" value={form.home_score} onChange={e=>setForm({...form,home_score:e.target.value})}/></label></div>
      <div className="form-grid"><label>Favorite team<select style={inputStyle} value={form.favorite_team} onChange={e=>setForm({...form,favorite_team:e.target.value})}><option value="">No favorite</option><option value={selectedGame.away_team}>{selectedGame.away_team}</option><option value={selectedGame.home_team}>{selectedGame.home_team}</option><option value="PK">Pick’em (PK)</option></select></label><label>Spread (points)<input style={inputStyle} type="number" min="0" step="0.5" value={form.favorite_spread} disabled={form.favorite_team==="PK"} onChange={e=>setForm({...form,favorite_spread:e.target.value})} placeholder="e.g. 3.5"/></label><label className="full">Over/under betting line<input style={inputStyle} type="number" min="0" step="0.5" value={form.over_under_line} onChange={e=>setForm({...form,over_under_line:e.target.value})} placeholder="e.g. 44.5"/></label></div>
      {form.favorite_team==="PK"&&<p className="muted">Pick’em · spread is automatically zero.</p>}
      <div className="editor-meta"><span>Actual game total (from scores)</span><b>{form.away_score!==""&&form.home_score!==""?Number(form.away_score)+Number(form.home_score):"—"}</b></div>
      <button style={{...buttonStyle,width:"100%",marginTop:16}} disabled={busy} onClick={saveGame}>{busy?"Saving…":"Save Game Results & Lines"}</button>
    </section></div>}
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
