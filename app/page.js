"use client";

import { useEffect, useMemo, useState } from "react";

const navGroups = [
  {label:"Games",items:["Game Tracker"]},
  {label:"Matchups",items:["Matchup Analyzer"]},
  {label:"Team Stats",items:["Team Performance","Win/Loss","Points"]},
  {label:"Betting",items:["Against Spread","Over/Under"]},
  {label:"Trends & Analysis",items:["Trend Finder","Season Trends","Game Drill-Down","Streak Tracker"]}
];
const tabs = navGroups.flatMap(group=>group.items);
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
const CURRENT_NFL_SEASON = new Date().getFullYear();
function isGameLocked(game) { return Number(game?.season) < CURRENT_NFL_SEASON; }


const teamAssets = {
  Bills:["AFC","Buffalo Bills","buffalo-bills","#164a8a"], Dolphins:["AFC","Miami Dolphins","miami-dolphins","#008e97"],
  Patriots:["AFC","New England Patriots","new-england-patriots","#002244"], Jets:["AFC","New York Jets","new-york-jets","#125740"],
  Ravens:["AFC","Baltimore Ravens","baltimore-ravens","#241773"], Bengals:["AFC","Cincinnati Bengals","cincinnati-bengals","#fb4f14"],
  Browns:["AFC","Cleveland Browns","cleveland-browns","#311d00"], Steelers:["AFC","Pittsburgh Steelers","pittsburgh-steelers","#ffb612"],
  Texans:["AFC","Houston Texans","houston-texans","#03202f"], Colts:["AFC","Indianapolis Colts","indianapolis-colts","#002c5f"],
  Jaguars:["AFC","Jacksonville Jaguars","jacksonville-jaguars","#006778"], Titans:["AFC","Tennessee Titans","tennessee-titans","#0c2340"],
  Broncos:["AFC","Denver Broncos","denver-broncos","#fb4f14"], Chiefs:["AFC","Kansas City Chiefs","kansas-city-chiefs","#e31837"],
  Raiders:["AFC","Las Vegas Raiders","las-vegas-raiders","#a5acaf"], Chargers:["AFC","Los Angeles Chargers","los-angeles-chargers","#0080c6"],
  Cowboys:["NFC","Dallas Cowboys","dallas-cowboys","#003594"], Giants:["NFC","New York Giants","new-york-giants","#0b2265"],
  Eagles:["NFC","Philadelphia Eagles","philadelphia-eagles","#004c54"], Commanders:["NFC","Washington Commanders","washington-commanders","#5a1414"],
  Bears:["NFC","Chicago Bears","chicago-bears","#0b162a"], Lions:["NFC","Detroit Lions","detroit-lions","#0076b6"],
  Packers:["NFC","Green Bay Packers","green-bay-packers","#203731"], Vikings:["NFC","Minnesota Vikings","minnesota-vikings","#4f2683"],
  Falcons:["NFC","Atlanta Falcons","atlanta-falcons","#a71930"], Panthers:["NFC","Carolina Panthers","carolina-panthers","#0085ca"],
  Saints:["NFC","New Orleans Saints","new-orleans-saints","#d3bc8d"], Buccaneers:["NFC","Tampa Bay Buccaneers","tampa-bay-buccaneers","#d50a0a"],
  Cardinals:["NFC","Arizona Cardinals","arizona-cardinals","#97233f"], Rams:["NFC","Los Angeles Rams","los-angeles-rams","#003594"],
  "49ers":["NFC","San Francisco 49ers","san-francisco-49ers","#aa0000"], Seahawks:["NFC","Seattle Seahawks","seattle-seahawks","#002244"]
};
function teamLogoUrl(team) {
  const info=teamAssets[team];
  if(!info)return "";
  return `https://cdn.jsdelivr.net/gh/frertommy/team-logos@main/NFL/${info[0]}/${encodeURIComponent(info[1])}/${info[2]}_big_circle.png`;
}
function TeamHelmetMark() {
  return <svg className="team-helmet-watermark" viewBox="0 0 180 130" aria-hidden="true">
    <path d="M27 79c0-37 26-63 65-63 34 0 59 21 64 53l-15 3-2 23H57c-18 0-30-6-30-16Z" fill="currentColor"/>
    <path d="M36 69c18-7 38-9 59-6 15 2 27 7 39 14l-4 14H57c-12 0-20-7-21-22Z" fill="#0b1420" opacity=".48"/>
    <path d="M124 67h28l12 9-4 7h-28m-8-16 5 29m-17-28 7 31m-20-31 8 31" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M51 96h74" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
  </svg>;
}
function TeamPicker({value,onChange,teams,placeholder="Choose a team",allowAll=false,compact=false,searchable=true}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState("");
  const current=teamAssets[value];
  const available=teams.filter(t=>teamAssets[t]&&t.toLowerCase().includes(query.toLowerCase()));
  const grouped=Object.entries(divisions).map(([division,names])=>[division,names.filter(t=>available.includes(t))]).filter(([,names])=>names.length);
  return <div className={`team-picker ${compact?"team-picker-compact":""}`}>
    <button type="button" className="team-picker-trigger" aria-expanded={open} onClick={()=>setOpen(!open)}>
      {current?<img src={teamLogoUrl(value)} alt="" className="team-picker-logo"/>:<span className="team-picker-empty">🏈</span>}
      <span className="team-picker-current">{value||placeholder}</span><span className="team-picker-chevron">▾</span>
    </button>
    {open&&<div className="team-picker-menu">
      {searchable&&<input className="team-picker-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search NFL teams…" autoFocus/>}
      {allowAll&&<button type="button" className="team-picker-all" onClick={()=>{onChange("all");setOpen(false);setQuery("");}}>All teams</button>}
      {grouped.map(([division,names])=><section className="team-picker-division" key={division}>
        <div className="team-picker-division-title">{division}</div>
        <div className="team-picker-grid">{names.map(name=>{
          const info=teamAssets[name];
          return <button type="button" key={name} className={`team-picker-option ${value===name?"selected":""}`} style={{"--team-accent":info[3]}} onClick={()=>{onChange(name);setOpen(false);setQuery("");}}>
            <span className="team-picker-art"><TeamHelmetMark/><img src={teamLogoUrl(name)} alt="" loading="lazy"/></span>
            <span>{name}</span>
          </button>;
        })}</div>
      </section>)}
      {!available.length&&<div className="team-picker-no-results">No teams found</div>}
    </div>}
  </div>;
}

export default function Home() {
  const [tab,setTab]=useState("Game Tracker"), [competition,setCompetition]=useState("regular"), [season,setSeason]=useState("all"), [team,setTeam]=useState("all"), [status,setStatus]=useState("all"), [openNav,setOpenNav]=useState(""), [menuOpen,setMenuOpen]=useState(false), [matchupA,setMatchupA]=useState("Bills"), [matchupB,setMatchupB]=useState("Dolphins"), [trendMetric,setTrendMetric]=useState("ats"), [trendWindow,setTrendWindow]=useState("10"), [streakMetric,setStreakMetric]=useState("wins"), [drilldown,setDrilldown]=useState({team:"all",metric:"all",label:"All completed games"});
  const [games,setGames]=useState([]), [busy,setBusy]=useState(false), [message,setMessage]=useState(""), [toast,setToast]=useState(""), [selected,setSelected]=useState(null), [showEditor,setShowEditor]=useState(false), [gameSearch,setGameSearch]=useState("");
  const [form,setForm]=useState({away_score:"",home_score:"",favorite_team:"",favorite_spread:"",spread_text:"",over_under_line:""});
  const [showNew,setShowNew]=useState(false);
  const [newGame,setNewGame]=useState({season:new Date().getFullYear(),game_date:"",game_time:"",away_team:"",home_team:"",favorite_team:"",favorite_spread:"",spread_text:"",over_under_line:"",game_type:""});

  async function loadGames() {
    setBusy(true); setMessage("");
    try {
      const qs=new URLSearchParams({competition});
      if(season!=="all") qs.set("season",season);
      if(team!=="all"&&!["Matchup Analyzer","Trend Finder","Game Drill-Down","Streak Tracker"].includes(tab)) qs.set("team",team);
      if(!["Game Drill-Down","Streak Tracker"].includes(tab)){
        if(status==="completed") qs.set("completed","1");
        if(status==="upcoming") qs.set("completed","0");
      }
      const response=await fetch("/api/games?"+qs), data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to load games");
      setGames(data.games||[]);
      setSelected(current=>current && data.games.some(g=>g.source_game_id===current.source_game_id)?current:null);
    } catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  useEffect(()=>{loadGames();},[competition,season,team,status,tab]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),2600);return ()=>clearTimeout(timer);},[toast]);
  const seasons=useMemo(()=>[...new Set(games.map(g=>g.season))].sort((a,b)=>b-a),[games]);
  const teams=useMemo(()=>[...new Set(games.flatMap(g=>[g.away_team,g.home_team]))].sort(),[games]);
  const completed=games.filter(g=>g.away_score!=null&&g.home_score!=null);
  const homeWins=completed.filter(g=>g.home_score>g.away_score).length, awayWins=completed.length-homeWins;
  const selectedGame=games.find(g=>g.source_game_id===selected?.source_game_id)||null;
  const visibleGames=games.filter(g=>!gameSearch||`${g.away_team} ${g.home_team} ${g.game_date} ${g.source_game_id}`.toLowerCase().includes(gameSearch.toLowerCase()));
  const ouGradedCount=completed.filter(g=>g.over_under_line!=null&&g.total_points!=null).length;

  function chooseGame(g) {
    if(isGameLocked(g)) { setMessage(`🔒 ${g.season} season games are locked. Only ${CURRENT_NFL_SEASON} season games can be edited.`); setShowEditor(false); return; }
    setMessage("");
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
      setShowEditor(false);setToast(data.ats_result==="push"?"Saved · ATS push":"Game saved");await loadGames();
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

  const atsPerformance=useMemo(()=>teams.map(name=>{
    const played=completed.filter(g=>(g.home_team===name||g.away_team===name)&&["home","away","push"].includes(g.ats_result)&&g.spread_points!=null);
    const stat=arr=>{const w=arr.filter(g=>g.covered_team===name).length,p=arr.filter(g=>g.ats_result==="push").length,l=arr.length-w-p;return {w,l,p,g:arr.length,cover:pct(w,arr.length-p)};};
    const favorite=g=>Number(g.spread_points)!==0&&((g.home_team===name&&Number(g.spread_points)>0)||(g.away_team===name&&Number(g.spread_points)<0));
    const home=played.filter(g=>g.home_team===name),away=played.filter(g=>g.away_team===name),fav=played.filter(favorite),dog=played.filter(g=>Number(g.spread_points)!==0&&!favorite(g)),even=played.filter(g=>Number(g.spread_points)===0);
    const div=played.filter(g=>teamDivision[g.home_team===name?g.away_team:g.home_team]===teamDivision[name]);
    const band=(lo,hi)=>played.filter(g=>Math.abs(Number(g.spread_points))>=lo&&(hi==null||Math.abs(Number(g.spread_points))<hi));
    return {name,overall:stat(played),home:stat(home),away:stat(away),favorite:stat(fav),dog:stat(dog),even:stat(even),homeFav:stat(home.filter(favorite)),homeDog:stat(home.filter(g=>Number(g.spread_points)!==0&&!favorite(g))),homeEven:stat(home.filter(g=>Number(g.spread_points)===0)),awayFav:stat(away.filter(favorite)),awayDog:stat(away.filter(g=>Number(g.spread_points)!==0&&!favorite(g))),awayEven:stat(away.filter(g=>Number(g.spread_points)===0)),division:stat(div),nonDivision:stat(played.filter(g=>!div.includes(g))),bands:[["0–2.5",stat(band(0,3))],["3–6.5",stat(band(3,7))],["7–9.5",stat(band(7,10))],["10+",stat(band(10,null))]]};
  }),[teams,completed]);
  const focusedATS=atsPerformance.find(r=>r.name===team);
  const ouPerformance=useMemo(()=>teams.map(name=>{
    const played=completed.filter(g=>(g.home_team===name||g.away_team===name)&&g.over_under_line!=null&&g.total_points!=null);
    const result=arr=>{const over=arr.filter(g=>Number(g.total_points)>Number(g.over_under_line)).length,under=arr.filter(g=>Number(g.total_points)<Number(g.over_under_line)).length,push=arr.length-over-under;return {over,under,push,g:arr.length,pct:pct(over,arr.length-push)};};
    const favorite=g=>Number(g.spread_points)!==0&&((g.home_team===name&&Number(g.spread_points)>0)||(g.away_team===name&&Number(g.spread_points)<0));
    const div=played.filter(g=>teamDivision[g.home_team===name?g.away_team:g.home_team]===teamDivision[name]);
    return {name,overall:result(played),home:result(played.filter(g=>g.home_team===name)),away:result(played.filter(g=>g.away_team===name)),favorite:result(played.filter(g=>g.spread_points!=null&&favorite(g))),underdog:result(played.filter(g=>g.spread_points!=null&&Number(g.spread_points)!==0&&!favorite(g))),even:result(played.filter(g=>g.spread_points!=null&&Number(g.spread_points)===0)),division:result(div),nonDivision:result(played.filter(g=>!div.includes(g)))};
  }),[teams,completed]);
  const focusedOU=ouPerformance.find(r=>r.name===team);
  const seasonTrends=useMemo(()=>[...new Set(completed.map(g=>g.season))].sort((a,b)=>a-b).map(year=>{const list=completed.filter(g=>g.season===year),ats=list.filter(g=>["home","away","push"].includes(g.ats_result)),ou=list.filter(g=>g.over_under_line!=null&&g.total_points!=null);const over=ou.filter(g=>Number(g.total_points)>Number(g.over_under_line)).length,under=ou.filter(g=>Number(g.total_points)<Number(g.over_under_line)).length,push=ou.length-over-under;const home=list.filter(g=>g.home_score>g.away_score).length,away=list.filter(g=>g.away_score>g.home_score).length;const fav=ats.filter(g=>Number(g.spread_points)!==0),favPush=fav.filter(g=>g.ats_result==="push").length,favW=fav.filter(g=>g.covered_team===(Number(g.spread_points)>0?g.home_team:g.away_team)).length,favL=fav.length-favPush-favW;return {year,g:list.length,home,away,favW,favL,favPush,over,under,push,avg:list.length?(list.reduce((s,g)=>s+Number(g.total_points||0),0)/list.length).toFixed(1):"—"};}),[completed]);

  const matchupHome=teams.includes(matchupA)?matchupA:(teams[0]||"");
  const matchupAway=teams.includes(matchupB)&&matchupB!==matchupHome?matchupB:(teams.find(t=>t!==matchupHome)||"");
  const matchupHistory=completed.filter(g=>(g.home_team===matchupHome&&g.away_team===matchupAway)||(g.home_team===matchupAway&&g.away_team===matchupHome)).sort((a,b)=>b.game_date.localeCompare(a.game_date));
  const matchupSummary=name=>{const rows=matchupHistory.filter(g=>g.home_team===name||g.away_team===name);const w=rows.filter(g=>(g.home_team===name&&g.home_score>g.away_score)||(g.away_team===name&&g.away_score>g.home_score)).length;const l=rows.filter(g=>(g.home_team===name&&g.home_score<g.away_score)||(g.away_team===name&&g.away_score<g.home_score)).length;const t=rows.length-w-l;const ats=rows.filter(g=>["home","away","push"].includes(g.ats_result));const aw=ats.filter(g=>g.covered_team===name).length,ap=ats.filter(g=>g.ats_result==="push").length;const ou=rows.filter(g=>g.over_under_line!=null&&g.total_points!=null);const over=ou.filter(g=>Number(g.total_points)>Number(g.over_under_line)).length,under=ou.filter(g=>Number(g.total_points)<Number(g.over_under_line)).length;const pf=rows.reduce((s,g)=>s+Number(g.home_team===name?g.home_score:g.away_score),0);return {w,l,t,g:rows.length,atsW:aw,atsL:ats.length-aw-ap,atsP:ap,atsN:ats.length,over,under,ouN:ou.length,ppg:rows.length?(pf/rows.length).toFixed(1):"—"};};
  const matchupAStats=matchupSummary(matchupHome), matchupBStats=matchupSummary(matchupAway);
  const trendRows=useMemo(()=>teams.map(name=>{let rows=completed.filter(g=>g.home_team===name||g.away_team===name).sort((a,b)=>b.game_date.localeCompare(a.game_date));if(trendWindow!=="all")rows=rows.slice(0,Number(trendWindow));const w=rows.filter(g=>(g.home_team===name&&g.home_score>g.away_score)||(g.away_team===name&&g.away_score>g.home_score)).length;const ats=rows.filter(g=>["home","away","push"].includes(g.ats_result));const atsW=ats.filter(g=>g.covered_team===name).length,atsP=ats.filter(g=>g.ats_result==="push").length;const ou=rows.filter(g=>g.over_under_line!=null&&g.total_points!=null);const over=ou.filter(g=>Number(g.total_points)>Number(g.over_under_line)).length,under=ou.filter(g=>Number(g.total_points)<Number(g.over_under_line)).length;const points=rows.reduce((s,g)=>s+Number(g.home_team===name?g.home_score:g.away_score),0);const n=trendMetric==="ats"?ats.length-atsP:trendMetric==="over"||trendMetric==="under"?ou.length-(ou.length-over-under):rows.length;const numerator=trendMetric==="wins"?w:trendMetric==="ats"?atsW:trendMetric==="over"?over:trendMetric==="under"?under:points;const metric=trendMetric==="points"?(rows.length?points/rows.length:-1):(n?numerator/n*100:-1);return {name,metric,label:metric<0?"—":trendMetric==="points"?metric.toFixed(1):metric.toFixed(1)+"%",g:rows.length,atsG:ats.length,ouG:ou.length,w,atsW,atsL:ats.length-atsW-atsP,atsP,over,under};}).filter(r=>r.metric>=0).sort((a,b)=>b.metric-a.metric),[teams,completed,trendMetric,trendWindow]);
  const trendTitle=({wins:"Win percentage",ats:"ATS cover percentage",over:"Over percentage",under:"Under percentage",points:"Points per game"})[trendMetric];
  const streakRows=useMemo(()=>teams.map(name=>{
    const rows=completed.filter(g=>g.home_team===name||g.away_team===name).sort((a,b)=>a.game_date.localeCompare(b.game_date)||Number(a.source_game_id)-Number(b.source_game_id));
    const outcome=g=>{
      if(streakMetric==="wins")return g.home_score===g.away_score?null:(g.home_team===name&&g.home_score>g.away_score)||(g.away_team===name&&g.away_score>g.home_score)?"W":"L";
      if(streakMetric==="losses")return g.home_score===g.away_score?null:(g.home_team===name&&g.home_score<g.away_score)||(g.away_team===name&&g.away_score<g.home_score)?"L":"W";
      if(streakMetric==="ats"||streakMetric==="atsLoss")return g.ats_result==="push"?null:g.covered_team===name?(streakMetric==="ats"?"C":"N"):["home","away"].includes(g.ats_result)?(streakMetric==="ats"?"N":"C"):null;
      if(streakMetric==="over"||streakMetric==="under"){
        if(g.over_under_line==null||g.total_points==null)return null;
        const over=Number(g.total_points)>Number(g.over_under_line),under=Number(g.total_points)<Number(g.over_under_line);
        return over?(streakMetric==="over"?"O":"N"):under?(streakMetric==="under"?"U":"N"):null;
      }
      return null;
    };
    const valid=rows.map(game=>({game,result:outcome(game)})).filter(x=>x.result);
    if(!valid.length)return {name,current:0,currentLabel:"—",longest:0,longestLabel:"—",games:0};
    const target=({wins:"W",losses:"L",ats:"C",atsLoss:"C",over:"O",under:"U"})[streakMetric];
    let current=0;
    for(let i=valid.length-1;i>=0&&valid[i].result===target;i--)current++;
    let best=0,run=0;
    for(const x of valid){if(x.result===target){run++;best=Math.max(best,run);}else run=0;}
    const label=({W:"WIN",L:"LOSS",C:streakMetric==="ats"?"COVER":"NO COVER",O:"OVER",U:"UNDER"})[target];
    return {name,current,currentLabel:current?label:"—",longest:best,longestLabel:best?label:"—",games:valid.length};
  }).sort((a,b)=>b.current-a.current||b.longest-a.longest),[teams,completed,streakMetric]);
  const drillGames=useMemo(()=>completed.filter(g=>{
    const d=drilldown;
    if(d.team!=="all"&&g.home_team!==d.team&&g.away_team!==d.team)return false;
    if(d.location==="home"&&d.team!=="all"&&g.home_team!==d.team)return false;
    if(d.location==="away"&&d.team!=="all"&&g.away_team!==d.team)return false;
    if(d.metric==="wins")return d.team==="all"?g.home_score!==g.away_score:(g.home_team===d.team&&g.home_score>g.away_score)||(g.away_team===d.team&&g.away_score>g.home_score);
    if(d.metric==="losses")return d.team==="all"?g.home_score!==g.away_score:(g.home_team===d.team&&g.home_score<g.away_score)||(g.away_team===d.team&&g.away_score<g.home_score);
    if(d.metric==="ats")return d.team==="all"?!!g.covered_team:g.covered_team===d.team;
    if(d.metric==="atsLoss")return ["home","away"].includes(g.ats_result)&&(d.team==="all"||((g.home_team===d.team||g.away_team===d.team)&&g.covered_team!==d.team));
    if(d.metric==="over")return g.over_under_line!=null&&g.total_points!=null&&Number(g.total_points)>Number(g.over_under_line);
    if(d.metric==="under")return g.over_under_line!=null&&g.total_points!=null&&Number(g.total_points)<Number(g.over_under_line);
    return true;
  }).sort((a,b)=>b.game_date.localeCompare(a.game_date)),[completed,drilldown]);
  function openDrilldown(teamName,metric,label,location="all"){setDrilldown({team:teamName||"all",metric:metric||"all",location,label:label||"All completed games"});setTab("Game Drill-Down");setStatus("all");setTeam("all");}

  function analyticsTable() {
    let headers=[], cells= r=>[];
    if(tab==="Win/Loss"){headers=["TEAM","G","W","L","WIN %","HOME W-L","AWAY W-L"];cells=r=>[r.name,r.played,r.wins,r.losses,r.winPct,r.home,r.away];}
    if(tab==="Against Spread"){headers=["TEAM","ATS W-L-P","GRADED GAMES","COVER %"];cells=r=>[r.name,r.ats,r.atsGames,r.atsGames?pct(Number(r.ats.split("-")[0]),Math.max(0,r.atsGames-Number(r.ats.split("-")[2]||0))):"—"];}
    if(tab==="Over/Under"){headers=["TEAM","OVER-UNDER-PUSH","GRADED GAMES","OVER %"];cells=r=>[r.name,r.ouGames?r.over:"—",r.ouGames,pct(Number(r.over.split("-")[0]),Math.max(0,r.ouGames-Number(r.over.split("-")[2]||0)))];}
    if(tab==="Points"){headers=["TEAM","G","POINTS FOR","POINTS AGAINST","DIFFERENTIAL","AVG POINTS"];cells=r=>[r.name,r.played,r.pf,r.pa,r.diff,r.played?(r.pf/r.played).toFixed(1):"—"];}
    if(tab==="Over/Under" && ouGradedCount===0) return <div className="empty-state"><div className="eyebrow">OVER / UNDER DATA</div><h3>No Vegas over/under lines are available for this selection</h3><p>The Vegas line is imported from column I (Total) in Data_Picks and Playoff_Data_Picks. The actual combined game total is calculated separately from the final scores. Historical lines are available from 2020 onward where the workbook has a value.</p><button style={buttonStyle} onClick={()=>setTab("Game Tracker")}>Go to Game Tracker</button></div>;
    return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{analytics.map(r=><tr key={r.name}>{cells(r).map((v,i)=><td key={i}>{i===0?<b>{v}</b>:v}</td>)}</tr>)}{!analytics.length&&<tr><td colSpan={headers.length} className="empty">No imported games to analyze yet.</td></tr>}</tbody></table></div>;
  }

  const activeNavGroup=navGroups.find(group=>group.items.includes(tab))?.label||"Games";

  return <main className="shell">
    <header className="topbar"><div className="topbar-brand"><button type="button" className="menu-toggle" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}>☰</button><div><div className="eyebrow">NFL DATA & BETTING ANALYTICS</div><h1>NFL Vegas Tracker</h1><p>Game results · point spreads · historical trends</p></div></div><div className="season-mark">NFL <b>TRACKER</b><span>EST. 2013</span></div></header>
    {tab==="Game Tracker"&&<section className="metrics"><div><span>GAMES IN VIEW</span><strong>{games.length.toLocaleString()}</strong></div><div><span>COMPLETED</span><strong>{completed.length.toLocaleString()}</strong></div><div><span>HOME WINS</span><strong>{homeWins.toLocaleString()}</strong></div><div><span>AWAY WINS</span><strong>{awayWins.toLocaleString()}</strong></div></section>}
    {menuOpen&&<><button type="button" className="drawer-scrim" aria-label="Close navigation menu" onClick={()=>setMenuOpen(false)}/><aside className="side-drawer" aria-label="Main navigation"><div className="drawer-head"><div><span className="eyebrow">NFL VEGAS TRACKER</span><h2>Navigation</h2></div><button type="button" className="drawer-close" aria-label="Close navigation menu" onClick={()=>setMenuOpen(false)}>×</button></div>{navGroups.map(group=><section className="drawer-group" key={group.label}><h3>{group.label}</h3>{group.items.map(item=><button type="button" key={item} className={tab===item?"selected":""} onClick={()=>{setTab(item);setMenuOpen(false);}}>{item}{tab===item&&<span>●</span>}</button>)}</section>)}</aside></>}
    <section className="panel"><div className="toolbar"><div><h2>{tab}</h2><p>{competition==="all"?"Regular season + playoffs":competition==="regular"?"Regular season":"Playoffs"} · historical game database</p></div><div className="filters">
      <select aria-label="Competition" style={inputStyle} value={competition} onChange={e=>{setCompetition(e.target.value);setSeason("all");setTeam("all");}}><option value="all">Regular + Playoffs</option><option value="regular">Regular Season</option><option value="playoffs">Playoffs</option></select>
      <select aria-label="Season" style={inputStyle} value={season} onChange={e=>setSeason(e.target.value)}><option value="all">All Seasons</option>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select>
      {["Team Performance","Against Spread","Over/Under","Win/Loss","Points"].includes(tab)&&<TeamPicker value={team} onChange={setTeam} teams={Object.keys(teamAssets)} allowAll placeholder="All Teams" compact/>}
      {tab==="Game Tracker"&&<select aria-label="Game status" style={inputStyle} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Games</option><option value="completed">Completed</option><option value="upcoming">Not Played</option></select>}
      {tab==="Game Tracker"&&<button style={buttonStyle} disabled={competition==="all"} title={competition==="all"?"Choose Regular Season or Playoffs to add a game":""} onClick={()=>setShowNew(true)}>+ Add Game</button>}
    </div></div>
    {message&&<div className="notice">{message}</div>}
    {toast&&<div className="save-toast" role="status" aria-live="polite"><span className="save-toast-mark">✓</span>{toast}</div>}
    {tab==="Game Tracker"?<div className="tracker-layout">
      <div className="game-list"><div className="game-search"><input aria-label="Search games" style={inputStyle} placeholder="Search team, date, or game ID…" value={gameSearch} onChange={e=>setGameSearch(e.target.value)}/><span>{visibleGames.length.toLocaleString()} games</span></div><div className="list-head"><span>DATE / MATCHUP</span><span>RESULT</span></div>
        {busy&&!games.length?<p className="empty">Loading games…</p>:visibleGames.map(g=><button key={g.source_game_id} className={selectedGame?.source_game_id===g.source_game_id?"game-row chosen":"game-row"} onClick={()=>chooseGame(g)}>
          <span><b>{g.away_team} @ {g.home_team}</b><small>{g.game_date} · {g.game_time||"Time TBD"} · {g.game_type||"Game"}{isGameLocked(g)?" · 🔒 Locked":""}{g.favorite_team? ` · Fav: ${g.favorite_team} -${g.favorite_spread??""}`:""}{g.over_under_line!=null?` · O/U ${g.over_under_line}`:""}</small></span><span className="score">{g.away_score==null?"—":`${g.away_score} - ${g.home_score}`}</span>
        </button>)}
        {!visibleGames.length&&!busy&&<p className="empty">No games match this search and filter.</p>}
      </div>

    </div>:tab==="Team Performance"?<div className="analytics"><div className="analytics-intro"><span className="eyebrow">HISTORICAL TEAM RECORDS</span><h3>{focusedTeam?focusedTeam.name+" performance":"All-team performance"}</h3><p>Completed games only · win percentage counts ties as half a win · division opponents are based on NFL division alignment.</p></div>
      {focusedTeam?<><div className="performance-cards"><div className="performance-card stat-click" role="button" tabIndex={0} onClick={()=>openDrilldown(focusedTeam.name,"all",focusedTeam.name+" overall games")}><span>OVERALL</span><strong>{record(focusedTeam.overall.w,focusedTeam.overall.l,focusedTeam.overall.t)}</strong><small>{focusedTeam.overall.pct} · {focusedTeam.overall.g} games</small></div><div className="performance-card stat-click" role="button" tabIndex={0} onClick={()=>openDrilldown(focusedTeam.name,"all",focusedTeam.name+" home games","home")}><span>HOME</span><strong>{record(focusedTeam.home.w,focusedTeam.home.l,focusedTeam.home.t)}</strong><small>{focusedTeam.home.pct} · {focusedTeam.home.g} games</small></div><div className="performance-card stat-click" role="button" tabIndex={0} onClick={()=>openDrilldown(focusedTeam.name,"all",focusedTeam.name+" away games","away")}><span>AWAY</span><strong>{record(focusedTeam.away.w,focusedTeam.away.l,focusedTeam.away.t)}</strong><small>{focusedTeam.away.pct} · {focusedTeam.away.g} games</small></div><div className="performance-card"><span>POINTS PER GAME</span><strong>{focusedTeam.ppg} – {focusedTeam.papg}</strong><small>Scored · allowed</small></div></div>
      <div className="performance-splits"><div><h4>Opponent breakdown</h4>{[["Division opponents",focusedTeam.division],["Non-division opponents",focusedTeam.nonDivision]].map(([label,r])=><div className="split-row" key={label}><span>{label}</span><b>{record(r.w,r.l,r.t)}</b><strong>{r.pct}</strong><small>{r.g} games</small></div>)}</div><div><h4>Home vs. away winning percentage</h4>{[["Home",focusedTeam.home],["Away",focusedTeam.away]].map(([label,r])=><div className="bar-row" key={label}><div><span>{label}</span><b>{r.pct}</b></div><div className="bar-track"><i style={{width:r.pct==="—"?"0":r.pct}}/></div><small>{record(r.w,r.l,r.t)} · {r.g} games</small></div>)}</div></div></>:<div className="table-wrap"><table className="performance-table"><thead><tr><th>TEAM</th><th>W-L-T</th><th>WIN %</th><th>HOME</th><th>AWAY</th><th>DIVISION</th><th>NON-DIVISION</th><th>PF/G</th><th>PA/G</th></tr></thead><tbody>{teamPerformance.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{record(r.overall.w,r.overall.l,r.overall.t)}</td><td><b>{r.overall.pct}</b></td><td>{record(r.home.w,r.home.l,r.home.t)}</td><td>{record(r.away.w,r.away.l,r.away.t)}</td><td>{record(r.division.w,r.division.l,r.division.t)}</td><td>{record(r.nonDivision.w,r.nonDivision.l,r.nonDivision.t)}</td><td>{r.ppg}</td><td>{r.papg}</td></tr>)}</tbody></table></div>}
    </div>:<div className="analytics"><div className="analytics-intro"><span className="eyebrow">HISTORICAL ANALYTICS</span><h3>{tab} breakdown</h3><p>Completed games only · sample sizes are shown with each result.</p></div>

    {tab==="Matchup Analyzer" && <><div className="matchup-hero"><div className="matchup-kicker">HEAD-TO-HEAD SCOUTING</div><div className="matchup-selectors"><label>TEAM ONE<TeamPicker value={matchupHome} onChange={setMatchupA} teams={Object.keys(teamAssets)} searchable={false}/></label><div className="versus">VS</div><label>TEAM TWO<TeamPicker value={matchupAway} onChange={setMatchupB} teams={Object.keys(teamAssets).filter(t=>t!==matchupHome)} searchable={false}/></label></div><div className="matchup-scoreboard"><div><span>{matchupHome}</span><strong>{matchupAStats.w}–{matchupAStats.l}–{matchupAStats.t}</strong><small>All-time W-L-T</small></div><div className="matchup-center"><b>{matchupHistory.length}</b><small>MEETINGS</small></div><div><span>{matchupAway}</span><strong>{matchupBStats.w}–{matchupBStats.l}–{matchupBStats.t}</strong><small>All-time W-L-T</small></div></div></div>
      <div className="matchup-grid"><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">BETTING PERFORMANCE</span><h4>ATS cover rate</h4></div><span className="viz-note">Pushes excluded</span></div>{[[matchupHome,matchupAStats],[matchupAway,matchupBStats]].map(([n,s])=><div className="compare-bar" key={n}><div><b>{n}</b><strong>{pct(s.atsW,s.atsN-s.atsP)}</strong></div><div className="bar-track"><i style={{width:pct(s.atsW,s.atsN-s.atsP)==="—"?"0":pct(s.atsW,s.atsN-s.atsP)}}/></div><small>{record(s.atsW,s.atsL,s.atsP)} · {s.atsN} graded games</small></div>)}</div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">TOTAL POINTS</span><h4>Over trend</h4></div><span className="viz-note">Graded totals</span></div>{[[matchupHome,matchupAStats],[matchupAway,matchupBStats]].map(([n,s])=><div className="compare-bar" key={n}><div><b>{n}</b><strong>{pct(s.over,s.over+s.under)}</strong></div><div className="bar-track over-track"><i style={{width:pct(s.over,s.over+s.under)==="—"?"0":pct(s.over,s.over+s.under)}}/></div><small>{s.over} over · {s.under} under · {s.ouN} games</small></div>)}</div></div>
      <div className="viz-card scoring-card"><div className="viz-heading"><div><span className="eyebrow">SCORING COMPARISON</span><h4>Average points per meeting</h4></div></div><div className="score-bars">{[[matchupHome,matchupAStats],[matchupAway,matchupBStats]].map(([n,s])=><div className="score-bar-col" key={n}><strong>{s.ppg}</strong><div className="score-bar-track"><i style={{height:s.ppg==="—"?"0":Math.min(100,Number(s.ppg)/40*100)+"%"}}/></div><span>{n}</span></div>)}</div></div>
      <div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">SERIES HISTORY</span><h4>Every recorded meeting</h4></div><span className="viz-note">{matchupHistory.length} games</span></div><div className="table-wrap matchup-history-table"><table><thead><tr><th>DATE</th><th>MATCHUP</th><th>FINAL</th><th>WINNER</th><th>SPREAD</th><th>ATS</th><th>TOTAL</th></tr></thead><tbody>{matchupHistory.map(g=><tr key={g.competition_type+"-"+g.source_game_id} onClick={()=>chooseGame(g)} className="clickable-game"><td>{g.game_date}</td><td>{g.away_team} @ {g.home_team}</td><td>{g.away_score}–{g.home_score}</td><td>{g.away_score>g.home_score?g.away_team:g.home_score>g.away_score?g.home_team:"Tie"}</td><td>{g.spread_text||"—"}</td><td>{g.ats_result==="push"?"Push":g.covered_team||"—"}</td><td>{g.over_under_line==null?"—":Number(g.total_points)>Number(g.over_under_line)?"Over":Number(g.total_points)<Number(g.over_under_line)?"Under":"Push"}</td></tr>)}</tbody></table></div><div className="matchup-history-mobile">{matchupHistory.map(g=><button type="button" key={g.competition_type+"-"+g.source_game_id} className="matchup-game-card" onClick={()=>chooseGame(g)}><div className="matchup-game-top"><b>{g.away_team} @ {g.home_team}</b><span>{g.game_date}</span></div><div className="matchup-game-score">{g.away_score} – {g.home_score}</div><div className="matchup-game-details"><span><small>WINNER</small>{g.away_score>g.home_score?g.away_team:g.home_score>g.away_score?g.home_team:"Tie"}</span><span><small>SPREAD</small>{g.spread_text||"—"}</span><span><small>ATS</small>{g.ats_result==="push"?"Push":g.covered_team||"—"}</span><span><small>TOTAL</small>{g.over_under_line==null?"—":Number(g.total_points)>Number(g.over_under_line)?"Over":Number(g.total_points)<Number(g.over_under_line)?"Under":"Push"}</span></div></button>)}</div>{!matchupHistory.length&&<p className="empty">No completed meetings for this matchup in the selected filters.</p>}</div></>}
    {tab==="Trend Finder" && <><div className="trend-controls"><label>RANK BY<select style={inputStyle} value={trendMetric} onChange={e=>setTrendMetric(e.target.value)}><option value="ats">ATS cover %</option><option value="over">Over %</option><option value="under">Under %</option><option value="wins">Win %</option><option value="points">Points per game</option></select></label><label>RECENT SAMPLE<select style={inputStyle} value={trendWindow} onChange={e=>setTrendWindow(e.target.value)}><option value="5">Last 5 games</option><option value="10">Last 10 games</option><option value="20">Last 20 games</option><option value="all">All games in filters</option></select></label></div><div className="trend-hero"><div><span className="eyebrow">NFL TREND LEADERBOARD</span><h3>{trendTitle}</h3><p>Ranked using each team's most recent {trendWindow==="all"?"available":trendWindow} completed games. Sample sizes are shown.</p></div><div className="trend-badge"><strong>{trendRows.length}</strong><span>TEAMS RANKED</span></div></div><div className="trend-layout"><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">LEAGUE LEADERS</span><h4>Top performers</h4></div></div>{trendRows.slice(0,10).map((r,i)=><button className="rank-row" key={r.name} onClick={()=>{setTeam(r.name);setTab("Team Performance");}}><span className="rank-number">{String(i+1).padStart(2,"0")}</span><span className="rank-team"><b>{r.name}</b><i><em style={{width:trendMetric==="points"?Math.min(100,r.metric/40*100)+"%":r.metric+"%"}}/></i></span><strong>{r.label}</strong><small>{trendMetric==="ats"?r.atsG+" ATS games":trendMetric==="over"||trendMetric==="under"?r.ouG+" totals":r.g+" games"}</small></button>)}</div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">NEEDS ATTENTION</span><h4>Bottom performers</h4></div></div>{trendRows.slice(-5).reverse().map((r,i)=><button className="rank-row bottom-rank" key={r.name} onClick={()=>{setTeam(r.name);setTab("Team Performance");}}><span className="rank-number">{String(trendRows.length-i).padStart(2,"0")}</span><span className="rank-team"><b>{r.name}</b><i><em style={{width:trendMetric==="points"?Math.min(100,r.metric/40*100)+"%":r.metric+"%"}}/></i></span><strong>{r.label}</strong><small>{trendMetric==="ats"?r.atsG+" ATS games":trendMetric==="over"||trendMetric==="under"?r.ouG+" totals":r.g+" games"}</small></button>)}</div></div><div className="trend-footnote">Percentages exclude pushes. Rankings use each team's most recent graded games within the selected season and competition filters.</div></>}
    {tab==="Over/Under" && (focusedOU ? <><div className="performance-cards">{[["OVERALL",focusedOU.overall],["HOME",focusedOU.home],["AWAY",focusedOU.away],["FAVORITE",focusedOU.favorite],["UNDERDOG",focusedOU.underdog],["EVEN",focusedOU.even],["DIVISION",focusedOU.division],["NON-DIVISION",focusedOU.nonDivision]].map(([label,r])=><div className="performance-card" key={label}><span>{label}</span><strong>{r.over}-{r.under}-{r.push}</strong><small>{r.pct} over · {r.g} games</small></div>)}</div></> : <div className="table-wrap"><table><thead><tr><th>TEAM</th><th>OVER-UNDER-PUSH</th><th>GAMES</th><th>OVER %</th><th>HOME</th><th>AWAY</th><th>FAVORITE</th><th>UNDERDOG</th><th>DIVISION</th><th>NON-DIV</th></tr></thead><tbody>{ouPerformance.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{r.overall.over}-{r.overall.under}-{r.overall.push}</td><td>{r.overall.g}</td><td>{r.overall.pct}</td><td>{r.home.over}-{r.home.under}-{r.home.push}</td><td>{r.away.over}-{r.away.under}-{r.away.push}</td><td>{r.favorite.over}-{r.favorite.under}-{r.favorite.push}</td><td>{r.underdog.over}-{r.underdog.under}-{r.underdog.push}</td><td>{r.division.over}-{r.division.under}-{r.division.push}</td><td>{r.nonDivision.over}-{r.nonDivision.under}-{r.nonDivision.push}</td></tr>)}</tbody></table></div>)}
    {tab==="Against Spread" && (focusedATS ? <><div className="performance-cards">{[["OVERALL",focusedATS.overall],["HOME",focusedATS.home],["AWAY",focusedATS.away],["FAVORITE",focusedATS.favorite],["UNDERDOG",focusedATS.dog],["EVEN",focusedATS.even],["DIVISION",focusedATS.division],["NON-DIVISION",focusedATS.nonDivision]].map(([label,r])=><div className="performance-card" key={label}><span>{label}</span><strong>{record(r.w,r.l,r.p)}</strong><small>{r.cover} cover · {r.g} games</small></div>)}</div><div className="performance-splits ats-splits"><div><h4>Home / away status</h4>{[["Home favorite",focusedATS.homeFav],["Home underdog",focusedATS.homeDog],["Home even",focusedATS.homeEven],["Away favorite",focusedATS.awayFav],["Away underdog",focusedATS.awayDog],["Away even",focusedATS.awayEven]].map(([label,r])=><div className="split-row ats-split-row" key={label}><span>{label}</span><b>{record(r.w,r.l,r.p)}</b><strong>{r.cover}</strong><small>{r.g} games</small></div>)}</div><div><h4>Spread size</h4>{focusedATS.bands.map(([label,r])=><div className="split-row ats-split-row" key={label}><span>{label}</span><b>{record(r.w,r.l,r.p)}</b><strong>{r.cover}</strong><small>{r.g} games</small></div>)}</div></div></> : <div className="table-wrap"><table><thead><tr><th>TEAM</th><th>ATS W-L-P</th><th>GAMES</th><th>COVER %</th><th>FAVORITE</th><th>UNDERDOG</th><th>HOME</th><th>AWAY</th><th>DIVISION</th><th>NON-DIV</th></tr></thead><tbody>{atsPerformance.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{record(r.overall.w,r.overall.l,r.overall.p)}</td><td>{r.overall.g}</td><td>{r.overall.cover}</td><td>{record(r.favorite.w,r.favorite.l,r.favorite.p)} · {r.favorite.cover}</td><td>{record(r.dog.w,r.dog.l,r.dog.p)} · {r.dog.cover}</td><td>{record(r.home.w,r.home.l,r.home.p)} · {r.home.cover}</td><td>{record(r.away.w,r.away.l,r.away.p)} · {r.away.cover}</td><td>{record(r.division.w,r.division.l,r.division.p)} · {r.division.cover}</td><td>{record(r.nonDivision.w,r.nonDivision.l,r.nonDivision.p)} · {r.nonDivision.cover}</td></tr>)}</tbody></table></div>)}
    {tab==="Game Drill-Down" && <><div className="trend-hero"><div><span className="eyebrow">STAT TO GAME EXPLORER</span><h3>{drilldown.label}</h3><p>Explore the actual completed games behind a statistic. Select a team and result type to narrow the history.</p></div><div className="trend-badge"><strong>{drillGames.length}</strong><span>GAMES</span></div></div><div className="trend-controls"><label>TEAM<TeamPicker value={drilldown.team} onChange={v=>setDrilldown({...drilldown,team:v,label:v==="all"?"All completed games":v+" game history"})} teams={Object.keys(teamAssets)} allowAll placeholder="All teams"/></label><label>RESULT TYPE<select style={inputStyle} value={drilldown.metric} onChange={e=>setDrilldown({...drilldown,metric:e.target.value,label:({all:"All completed games",wins:"Wins",losses:"Losses",ats:"ATS covers",atsLoss:"ATS non-covers",over:"Overs",under:"Unders"})[e.target.value]})}><option value="all">All completed games</option><option value="wins">Wins</option><option value="losses">Losses</option><option value="ats">ATS covers</option><option value="atsLoss">ATS non-covers</option><option value="over">Overs</option><option value="under">Unders</option></select></label><label>LOCATION<select style={inputStyle} value={drilldown.location||"all"} onChange={e=>setDrilldown({...drilldown,location:e.target.value})}><option value="all">Home + away</option><option value="home">Home games</option><option value="away">Away games</option></select></label></div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">GAME LOG</span><h4>{drillGames.length} matching games</h4></div><span className="viz-note">Select a row to open its game editor</span></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>SEASON</th><th>MATCHUP</th><th>FINAL</th><th>WINNER</th><th>SPREAD</th><th>ATS</th><th>O/U RESULT</th></tr></thead><tbody>{drillGames.map(g=><tr key={g.competition_type+"-"+g.source_game_id} className="clickable-game" onClick={()=>chooseGame(g)}><td>{g.game_date}</td><td>{g.season}</td><td>{g.away_team} @ {g.home_team}</td><td>{g.away_score}–{g.home_score}</td><td>{g.away_score>g.home_score?g.away_team:g.home_score>g.away_score?g.home_team:"Tie"}</td><td>{g.spread_text||"—"}</td><td>{g.ats_result==="push"?"Push":g.covered_team||"—"}</td><td>{g.over_under_line==null?"—":Number(g.total_points)>Number(g.over_under_line)?"Over":Number(g.total_points)<Number(g.over_under_line)?"Under":"Push"}</td></tr>)}</tbody></table></div>{!drillGames.length&&<p className="empty">No games match these filters.</p>}</div></>}
    {tab==="Streak Tracker" && <><div className="trend-controls"><label>STREAK CATEGORY<select style={inputStyle} value={streakMetric} onChange={e=>setStreakMetric(e.target.value)}><option value="wins">Winning streaks</option><option value="losses">Losing streaks</option><option value="ats">ATS cover streaks</option><option value="atsLoss">ATS non-cover streaks</option><option value="over">Over streaks</option><option value="under">Under streaks</option></select></label></div><div className="trend-hero"><div><span className="eyebrow">NFL STREAK BOARD</span><h3>{({wins:"Winning streaks",losses:"Losing streaks",ats:"ATS cover streaks",atsLoss:"ATS non-cover streaks",over:"Over streaks",under:"Under streaks"})[streakMetric]}</h3><p>Current and longest streaks across the selected season and competition. Pushes and ungraded betting outcomes are excluded.</p></div><div className="trend-badge"><strong>{streakRows.length}</strong><span>TEAMS</span></div></div><div className="trend-layout"><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">CURRENT RUN</span><h4>Active streak leaderboard</h4></div></div>{[...streakRows].sort((a,b)=>b.current-a.current).slice(0,16).map((r,i)=><button className="rank-row" key={r.name} onClick={()=>openDrilldown(r.name,streakMetric==="wins"?"wins":streakMetric==="losses"?"losses":streakMetric==="ats"?"ats":streakMetric==="atsLoss"?"atsLoss":streakMetric,"Recent "+r.name+" "+streakMetric+" results")}><span className="rank-number">{String(i+1).padStart(2,"0")}</span><span className="rank-team"><b>{r.name}</b><i><em style={{width:Math.min(100,r.current/10*100)+"%"}}/></i></span><strong>{r.current} {r.currentLabel}</strong><small>{r.games} graded</small></button>)}</div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">ALL-TIME HIGH</span><h4>Longest streaks</h4></div></div>{[...streakRows].sort((a,b)=>b.longest-a.longest).slice(0,16).map((r,i)=><button className="rank-row bottom-rank" key={r.name} onClick={()=>openDrilldown(r.name,"all",r.name+" complete game history")}><span className="rank-number">{String(i+1).padStart(2,"0")}</span><span className="rank-team"><b>{r.name}</b><i><em style={{width:Math.min(100,r.longest/15*100)+"%"}}/></i></span><strong>{r.longest} {r.longestLabel}</strong><small>{r.games} graded</small></button>)}</div></div><div className="trend-footnote">Current streak reflects the latest graded outcome. Streaks follow chronological game order; ties and pushes are excluded rather than counted as wins or losses.</div></>}
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
