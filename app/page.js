"use client";

import { useEffect, useMemo, useState } from "react";

const navGroups = [
  {label:"Games",items:["Game Tracker"]},
  {label:"Matchups",items:["Matchup Analyzer"]},
  {label:"Team Stats",items:["Team Performance","Points"]},
  {label:"Betting",items:["Against Spread","Over/Under"]},
  {label:"Predictions",items:["Market Predictions"]},
  {label:"Trends & Analysis",items:["Trend Finder","Season Trends","Game Drill-Down","Streak Tracker"]},
  {label:"Advanced Analytics",items:["Market Insights","Situational Trends","Performance Insights"]}
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
function formatDate(value) { if(!value)return "—"; const parts=String(value).slice(0,10).split("-"); return parts.length===3?Number(parts[1])+"/"+Number(parts[2])+"/"+parts[0]:String(value); }
function localDateKey() { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); }
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
}
function formatGameTime(value) {
  if(!value)return "Time TBD";
  const parts=String(value).slice(0,5).split(":");
  if(parts.length!==2)return String(value);
  const hour=Number(parts[0]);
  return (hour%12||12)+":"+parts[1]+" "+(hour>=12?"PM":"AM")+" ET";
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
function TeamPicker({value,onChange,teams,placeholder="Choose a team",allowAll=false,compact=false}) {
  const [open,setOpen]=useState(false);
  const current=teamAssets[value];
  const available=teams.filter(t=>teamAssets[t]);
  const grouped=Object.entries(divisions).map(([division,names])=>[division,names.filter(t=>available.includes(t))]).filter(([,names])=>names.length);
  return <div className={`team-picker ${compact?"team-picker-compact":""}`}>
    <button type="button" className="team-picker-trigger" aria-expanded={open} onClick={()=>setOpen(!open)}>
      {current?<img src={teamLogoUrl(value)} alt="" className="team-picker-logo"/>:<span className="team-picker-empty">🏈</span>}
      <span className="team-picker-current">{value||placeholder}</span><span className="team-picker-chevron">▾</span>
    </button>
    {open&&<div className="team-picker-menu">
      {allowAll&&<button type="button" className="team-picker-all" onClick={()=>{onChange("all");setOpen(false);}}>All teams</button>}
      {grouped.map(([division,names])=><section className="team-picker-division" key={division}>
        <div className="team-picker-division-title">{division}</div>
        <div className="team-picker-grid">{names.map(name=>{
          const info=teamAssets[name];
          return <button type="button" key={name} className={`team-picker-option ${value===name?"selected":""}`} style={{"--team-accent":info[3]}} onClick={()=>{onChange(name);setOpen(false);}}>
            <span className="team-picker-art"><TeamHelmetMark/><img src={teamLogoUrl(name)} alt="" loading="lazy"/></span>
            <span>{name}</span>
          </button>;
        })}</div>
      </section>)}
    </div>}
  </div>;
}

export default function Home() {
  const [tab,setTab]=useState("Game Tracker"), [competition,setCompetition]=useState("regular"), [season,setSeason]=useState("all"), [team,setTeam]=useState("all"), [status,setStatus]=useState("all"), [openNav,setOpenNav]=useState(""), [menuOpen,setMenuOpen]=useState(false), [matchupA,setMatchupA]=useState("Bills"), [matchupB,setMatchupB]=useState("Dolphins"), [trendMetric,setTrendMetric]=useState("ats"), [trendWindow,setTrendWindow]=useState("10"), [streakMetric,setStreakMetric]=useState("wins"), [drilldown,setDrilldown]=useState({team:"all",metric:"all",label:"All completed games"});
  const [games,setGames]=useState([]), [busy,setBusy]=useState(false), [message,setMessage]=useState(""), [toast,setToast]=useState(""), [selected,setSelected]=useState(null), [showEditor,setShowEditor]=useState(false), [gameSearch,setGameSearch]=useState("");
  const [predictionData,setPredictionData]=useState(null), [predictionBusy,setPredictionBusy]=useState(false), [predictionError,setPredictionError]=useState(""), [predictionRefresh,setPredictionRefresh]=useState(0);
  const [dataRefreshBusy,setDataRefreshBusy]=useState(false), [dataRefreshMessage,setDataRefreshMessage]=useState("");
  const [closingLineRefreshBusy,setClosingLineRefreshBusy]=useState(false), [closingLineRefreshMessage,setClosingLineRefreshMessage]=useState("");
  const [form,setForm]=useState({away_score:"",home_score:"",favorite_team:"",favorite_spread:"",spread_text:"",over_under_line:""});
  const [showNew,setShowNew]=useState(false);
  const [newGame,setNewGame]=useState({season:new Date().getFullYear(),game_date:"",game_time:"",away_team:"",home_team:"",favorite_team:"",favorite_spread:"",spread_text:"",over_under_line:"",game_type:""});

  async function refreshDataFeeds(){
    setDataRefreshBusy(true);setDataRefreshMessage("");
    try{
      const response=await fetch("/api/data-refresh",{method:"POST"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to refresh free data");
      setDataRefreshMessage(`Updated ${Number(data.teamRows||0).toLocaleString()} team rows, ${Number(data.playerRows||0).toLocaleString()} player rows, ${Number(data.injuryRows||0).toLocaleString()} injury reports, and ${Number(data.weatherGames||0).toLocaleString()} weather records.`);
      setPredictionRefresh(value=>value+1);
    }catch(error){setDataRefreshMessage(error.message);}
    finally{setDataRefreshBusy(false);}
  }
  async function refreshClosingLines(retry=false){
    setClosingLineRefreshBusy(true);setClosingLineRefreshMessage("");
    try{
      const response=await fetch("/api/closing-lines",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({retry})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to refresh ESPN closing lines");
      setClosingLineRefreshMessage(`ESPN batch: ${Number(data.updated||0)} games updated · ${Number(data.totalLines||0).toLocaleString()} total lines saved · ${Number(data.remaining||0).toLocaleString()} still waiting.${retry?` ${Number(data.unmatched||0)} unmatched and ${Number(data.noOdds||0)} without odds in this retry batch.`:""}`);
      await loadGames();
      setPredictionRefresh(value=>value+1);
    }catch(error){setClosingLineRefreshMessage(error.message);}
    finally{setClosingLineRefreshBusy(false);}
  }

  async function loadGames() {
    setBusy(true); setMessage("");
    try {
      const qs=new URLSearchParams({competition});
      // The Game Tracker is a current-season workspace; historical records
      // are still loaded for every analytics page and remain in the database.
      if(tab==="Game Tracker") qs.set("season",String(CURRENT_NFL_SEASON));
      else if(season!=="all") qs.set("season",season);
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
  useEffect(()=>{if(tab!=="Market Predictions")loadGames();},[competition,season,team,status,tab]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),2600);return ()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{
    if(tab!=="Market Predictions")return;
    let cancelled=false;
    async function refreshPredictions(){
      setPredictionBusy(true);setPredictionError("");
      try{
        const saved=await fetch("/api/predictions",{method:"POST"});
        const savedData=await saved.json();
        if(!saved.ok)throw new Error(savedData.error||"Could not record forecasts");
        const response=await fetch("/api/predictions",{cache:"no-store"});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"Could not load predictions");
        if(!cancelled)setPredictionData(data);
      }catch(error){if(!cancelled)setPredictionError(error.message);}
      finally{if(!cancelled)setPredictionBusy(false);}
    }
    refreshPredictions();
    return()=>{cancelled=true;};
  },[tab,predictionRefresh]);
  const seasons=useMemo(()=>[...new Set(games.map(g=>g.season))].sort((a,b)=>b-a),[games]);
  const teams=useMemo(()=>[...new Set(games.flatMap(g=>[g.away_team,g.home_team]))].sort(),[games]);
  const completed=games.filter(g=>g.away_score!=null&&g.home_score!=null);
  const homeWins=completed.filter(g=>g.home_score>g.away_score).length, awayWins=completed.length-homeWins;
  const selectedGame=games.find(g=>g.source_game_id===selected?.source_game_id)||null;
  const visibleGames=games.filter(g=>!gameSearch||(`${g.away_team} ${g.home_team} ${g.game_date} ${formatDate(g.game_date)} ${g.source_game_id}`).toLowerCase().includes(gameSearch.toLowerCase()));
  const todayKey=localDateKey();
  const hasFinalScore=g=>g.away_score!=null&&g.home_score!=null;
  const needsResults=visibleGames.filter(g=>!hasFinalScore(g)&&String(g.game_date).slice(0,10)<todayKey).sort((a,b)=>b.game_date.localeCompare(a.game_date));
  const nextGames=visibleGames.filter(g=>!hasFinalScore(g)&&String(g.game_date).slice(0,10)>=todayKey).sort((a,b)=>a.game_date.localeCompare(b.game_date));
  const completedGames=visibleGames.filter(hasFinalScore).sort((a,b)=>b.game_date.localeCompare(a.game_date));
  const ouGradedCount=completed.filter(g=>g.over_under_line!=null&&g.total_points!=null).length;

  function chooseGame(g) {
    if(isGameLocked(g)) { setMessage(`🔒 ${g.season} season games are locked. Only ${CURRENT_NFL_SEASON} season games can be edited.`); setShowEditor(false); return; }
    setMessage("");
    setSelected(g);
    setForm({
      away_score:g.away_score??"",home_score:g.home_score??"",
      favorite_team:g.manual_favorite_team??(Number(g.manual_spread_points)<0?g.away_team:Number(g.manual_spread_points)>0?g.home_team:Number(g.manual_spread_points)===0?"PK":""),
      favorite_spread:g.manual_favorite_spread??(g.manual_spread_points==null?"":Math.abs(Number(g.manual_spread_points))),
      spread_text:g.spread_text??"",over_under_line:g.manual_over_under_line??""
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


  const marketInsights=useMemo(()=>{
    const graded=completed.filter(g=>g.over_under_line!=null&&g.total_points!=null);
    const bands=[["Under 38",g=>Number(g.over_under_line)<38],["38–42.5",g=>Number(g.over_under_line)>=38&&Number(g.over_under_line)<43],["43–47.5",g=>Number(g.over_under_line)>=43&&Number(g.over_under_line)<48],["48–52.5",g=>Number(g.over_under_line)>=48&&Number(g.over_under_line)<53],["53+",g=>Number(g.over_under_line)>=53]];
    const summarize=rows=>{const over=rows.filter(g=>Number(g.total_points)>Number(g.over_under_line)).length,under=rows.filter(g=>Number(g.total_points)<Number(g.over_under_line)).length,push=rows.length-over-under;return {games:rows.length,over,under,push,overPct:pct(over,rows.length-push),avgTotalError:rows.length?rows.reduce((s,g)=>s+Math.abs(Number(g.total_points)-Number(g.over_under_line)),0)/rows.length:0};};
    const spreadGraded=completed.filter(g=>g.spread_points!=null&&g.away_score!=null&&g.home_score!=null);
    const totalError=graded.length?graded.reduce((s,g)=>s+Math.abs(Number(g.total_points)-Number(g.over_under_line)),0)/graded.length:null;
    const spreadError=spreadGraded.length?spreadGraded.reduce((s,g)=>s+Math.abs((Number(g.home_score)-Number(g.away_score))-Number(g.spread_points)),0)/spreadGraded.length:null;
    return {bands:bands.map(([label,test])=>({label,...summarize(graded.filter(test))})),gradedCount:graded.length,spreadCount:spreadGraded.length,totalError,spreadError};
  },[completed]);
  const situationalInsights=useMemo(()=>{
    const dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayOrder=["Thursday","Sunday","Monday","Saturday","Friday","Tuesday","Wednesday"];
    const summarize=rows=>{const wins=rows.filter(g=>g.home_score>g.away_score).length,ats=rows.filter(g=>["home","away","push"].includes(g.ats_result)),fav=ats.filter(g=>Number(g.spread_points)!==0),favWins=fav.filter(g=>g.covered_team===(Number(g.spread_points)>0?g.home_team:g.away_team)).length,favPush=fav.filter(g=>g.ats_result==="push").length;return {games:rows.length,homeWins:wins,homeWinPct:pct(wins,rows.length),avgTotal:rows.length?(rows.reduce((s,g)=>s+Number(g.total_points||0),0)/rows.length).toFixed(1):"—",favoriteCover:pct(favWins,fav.length-favPush),gradedFavorites:fav.length};};
    const dayRows=dayOrder.map(day=>({label:day,...summarize(completed.filter(g=>dayNames[new Date(g.game_date+"T12:00:00").getDay()]===day))})).filter(r=>r.games);
    const timeGroups=[["Early window",g=>{const h=Number(String(g.game_time||"").slice(0,2));return Number.isFinite(h)&&h>=12&&h<15;}],["Afternoon window",g=>{const h=Number(String(g.game_time||"").slice(0,2));return Number.isFinite(h)&&h>=15&&h<18;}],["Evening window",g=>{const h=Number(String(g.game_time||"").slice(0,2));return Number.isFinite(h)&&(h>=18||h<5); }]];
    const timeRows=timeGroups.map(([label,test])=>({label,...summarize(completed.filter(g=>g.game_time&&test(g)))})).filter(r=>r.games);
    const missingTime=completed.filter(g=>!g.game_time).length;
    return {dayRows,timeRows,missingTime};
  },[completed]);
  const performanceInsights=useMemo(()=>{
    const rows=teams.map(name=>{
      const played=completed.filter(g=>g.home_team===name||g.away_team===name);
      const points=played.map(g=>Number(g.home_team===name?g.home_score:g.away_score));
      const mean=points.length?points.reduce((s,n)=>s+n,0)/points.length:0;
      const std=points.length?Math.sqrt(points.reduce((s,n)=>s+(n-mean)**2,0)/points.length):0;
      const margins=played.filter(g=>g.spread_points!=null).map(g=>{
        const homeMargin=Number(g.home_score)-Number(g.away_score);
        return g.home_team===name?homeMargin-Number(g.spread_points):-homeMargin+Number(g.spread_points);
      });
      const close=played.filter(g=>Math.abs(Number(g.home_score)-Number(g.away_score))<=7);
      const wins=close.filter(g=>(g.home_team===name&&g.home_score>g.away_score)||(g.away_team===name&&g.away_score>g.home_score)).length;
      const ties=close.filter(g=>Number(g.home_score)===Number(g.away_score)).length;
      return {name,g:played.length,ppg:points.length?mean.toFixed(1):"—",scoringStd:points.length?std.toFixed(1):"—",avgCoverMargin:margins.length?(margins.reduce((s,n)=>s+n,0)/margins.length).toFixed(1):"—",coverGames:margins.length,closeGames:close.length,closeWins:wins,closeTies:ties,closeLosses:close.length-wins-ties,closeWinPct:pct(wins,close.length-ties)};
    }).sort((a,b)=>Number(b.avgCoverMargin)-Number(a.avgCoverMargin));
    const margins=completed.map(g=>Math.abs(Number(g.home_score)-Number(g.away_score)));
    const buckets=[["1–3 points",g=>Math.abs(Number(g.home_score)-Number(g.away_score))<=3],["4–7 points",g=>Math.abs(Number(g.home_score)-Number(g.away_score))>=4&&Math.abs(Number(g.home_score)-Number(g.away_score))<=7],["8–14 points",g=>Math.abs(Number(g.home_score)-Number(g.away_score))>=8&&Math.abs(Number(g.home_score)-Number(g.away_score))<=14],["15+ points",g=>Math.abs(Number(g.home_score)-Number(g.away_score))>=15]];
    const marginRows=buckets.map(([label,test])=>{const games=completed.filter(test),ats=games.filter(g=>["home","away","push"].includes(g.ats_result)),ou=games.filter(g=>g.over_under_line!=null&&g.total_points!=null),over=ou.filter(g=>Number(g.total_points)>Number(g.over_under_line)).length,under=ou.filter(g=>Number(g.total_points)<Number(g.over_under_line)).length,push=ou.length-over-under;return {label,games:games.length,avgMargin:games.length?(games.reduce((s,g)=>s+Math.abs(Number(g.home_score)-Number(g.away_score)),0)/games.length).toFixed(1):"—",favCover:pct(ats.filter(g=>g.spread_points!=null&&Number(g.spread_points)!==0&&g.covered_team===(Number(g.spread_points)>0?g.home_team:g.away_team)).length,ats.filter(g=>g.spread_points!=null&&Number(g.spread_points)!==0&&g.ats_result!=="push").length),overPct:pct(over,ou.length-push)};});
    return {rows,marginRows};
  },[teams,completed]);
  const focusedPerformance=team==="all"?null:performanceInsights.rows.find(r=>r.name===team);
  const confidenceOrder={High:0,Moderate:1,Low:2,Lean:2};
  const visiblePredictions=[...(predictionData?.upcoming||[])].sort((a,b)=>(confidenceOrder[a.confidence]??3)-(confidenceOrder[b.confidence]??3)||String(a.game_date).localeCompare(String(b.game_date))||String(a.game_time||"").localeCompare(String(b.game_time||"")));
  const dataSourceLabels={nflverse_team_stats:"NFL team stats",nflverse_player_stats:"NFL player stats",nflverse_injuries:"Injury reports",open_meteo_weather:"Stadium weather",espn_closing_lines:"ESPN closing lines"};

  function analyticsTable() {
    let headers=[], cells= r=>[];
    if(tab==="Against Spread"){headers=["TEAM","ATS W-L-P","GRADED GAMES","COVER %"];cells=r=>[r.name,r.ats,r.atsGames,r.atsGames?pct(Number(r.ats.split("-")[0]),Math.max(0,r.atsGames-Number(r.ats.split("-")[2]||0))):"—"];}
    if(tab==="Over/Under"){headers=["TEAM","OVER-UNDER-PUSH","GRADED GAMES","OVER %"];cells=r=>[r.name,r.ouGames?r.over:"—",r.ouGames,pct(Number(r.over.split("-")[0]),Math.max(0,r.ouGames-Number(r.over.split("-")[2]||0)))];}
    if(tab==="Points"){headers=["TEAM","G","POINTS FOR","POINTS AGAINST","DIFFERENTIAL","AVG POINTS"];cells=r=>[r.name,r.played,r.pf,r.pa,r.diff,r.played?(r.pf/r.played).toFixed(1):"—"];}
    if(tab==="Over/Under" && ouGradedCount===0) return <div className="empty-state"><div className="eyebrow">OVER / UNDER DATA</div><h3>No Vegas over/under lines are available for this selection</h3><p>The Vegas line is imported from column I (Total) in Data_Picks and Playoff_Data_Picks. The actual combined game total is calculated separately from the final scores. Historical lines are available from 2020 onward where the workbook has a value.</p><button style={buttonStyle} onClick={()=>setTab("Game Tracker")}>Go to Game Tracker</button></div>;
    return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{([...analytics].sort((a,b)=>tab==="Points"?(b.played?b.pf/b.played:0)-(a.played?a.pf/a.played:0):0)).map(r=><tr key={r.name}>{cells(r).map((v,i)=><td key={i}>{i===0?<b>{v}</b>:v}</td>)}</tr>)}{!analytics.length&&<tr><td colSpan={headers.length} className="empty">No imported games to analyze yet.</td></tr>}</tbody></table></div>;
  }

  const activeNavGroup=navGroups.find(group=>group.items.includes(tab))?.label||"Games";

  return <main className="shell">
    <header className="topbar"><div className="topbar-brand"><button type="button" className="menu-toggle" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}>☰</button><div><div className="eyebrow">NFL DATA & BETTING ANALYTICS</div><h1>NFL Vegas Tracker</h1><p>Game results · point spreads · historical trends since 2013.</p></div></div></header>
    {tab==="Game Tracker"&&<section className="metrics"><div><span>GAMES IN VIEW</span><strong>{games.length.toLocaleString()}</strong></div><div><span>COMPLETED</span><strong>{completed.length.toLocaleString()}</strong></div><div><span>HOME WINS</span><strong>{homeWins.toLocaleString()}</strong></div><div><span>AWAY WINS</span><strong>{awayWins.toLocaleString()}</strong></div></section>}
    {menuOpen&&<><button type="button" className="drawer-scrim" aria-label="Close navigation menu" onClick={()=>setMenuOpen(false)}/><aside className="side-drawer" aria-label="Main navigation"><div className="drawer-head"><div><span className="eyebrow">NFL VEGAS TRACKER</span><h2>Navigation</h2></div><button type="button" className="drawer-close" aria-label="Close navigation menu" onClick={()=>setMenuOpen(false)}>×</button></div>{navGroups.map(group=><section className="drawer-group" key={group.label}><h3>{group.label}</h3>{group.items.map(item=><button type="button" key={item} className={tab===item?"selected":""} onClick={()=>{setTab(item);setMenuOpen(false);}}>{item}{tab===item&&<span>●</span>}</button>)}</section>)}</aside></>}
    <section className="panel"><div className="toolbar"><div><h2>{tab}</h2><p>{tab==="Market Predictions"?"Current NFL week · forecast grading":competition==="all"?"Regular season + playoffs":competition==="regular"?"Regular season":"Playoffs"} · {tab==="Market Predictions"?"all available seasons":"historical game database"}</p></div><div className="filters">
      {tab!=="Market Predictions"&&<select aria-label="Competition" style={inputStyle} value={competition} onChange={e=>{setCompetition(e.target.value);setSeason("all");setTeam("all");}}><option value="all">Regular + Playoffs</option><option value="regular">Regular Season</option><option value="playoffs">Playoffs</option></select>}
      {tab!=="Game Tracker"&&tab!=="Market Predictions"&&<select aria-label="Season" style={inputStyle} value={season} onChange={e=>setSeason(e.target.value)}><option value="all">All Seasons</option>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select>}
      {["Team Performance","Against Spread","Over/Under","Points","Performance Insights"].includes(tab)&&<TeamPicker value={team} onChange={setTeam} teams={Object.keys(teamAssets)} allowAll placeholder="All Teams" compact/>}
      {tab==="Game Tracker"&&<select aria-label="Game status" style={inputStyle} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Games</option><option value="completed">Completed</option><option value="upcoming">Not Played</option></select>}
      {tab==="Game Tracker"&&<button style={buttonStyle} disabled={competition==="all"} title={competition==="all"?"Choose Regular Season or Playoffs to add a game":""} onClick={()=>setShowNew(true)}>+ Add Game</button>}
    </div></div>
    {message&&<div className="notice">{message}</div>}
    {toast&&<div className="save-toast" role="status" aria-live="polite"><span className="save-toast-mark">✓</span>{toast}</div>}
    {tab==="Game Tracker"?<div className="tracker-layout">
      <div className="game-list"><div className="game-search"><input aria-label="Search games" style={inputStyle} placeholder="Search team, date, or game ID…" value={gameSearch} onChange={e=>setGameSearch(e.target.value)}/><span>{visibleGames.length.toLocaleString()} games</span></div>
        {busy&&!games.length?<p className="empty">Loading games…</p>:<>
          {needsResults.length>0&&<section className="tracker-group"><div className="tracker-group-heading"><span><b>Needs Results</b><small>Most recent past games missing final scores</small></span><strong>{needsResults.length}</strong></div>{needsResults.map(g=><button key={g.source_game_id} className={selectedGame?.source_game_id===g.source_game_id?"game-row chosen":"game-row"} onClick={()=>chooseGame(g)}><span><b>{g.away_team} @ {g.home_team}</b><small>{formatDate(g.game_date)} · {g.game_time||"Time TBD"} · {g.game_type||"Game"}{g.favorite_team?" · Fav: "+g.favorite_team+" -"+(g.favorite_spread??""):""}{g.over_under_line!=null?" · O/U "+g.over_under_line:""}</small>{((g.closing_spread_points!=null||g.closing_over_under_line!=null))&&<small className="closing-line-note">ESPN close: {g.closing_spread_points==null?"spread —":g.closing_spread_points===0?"PK":(g.closing_spread_points>0?g.home_team:g.away_team)+" -"+Math.abs(Number(g.closing_spread_points))} · O/U {g.closing_over_under_line??"—"} · {g.closing_provider||g.closing_line_status}</small>}</span><span className="score">0 - 0</span></button>)}</section>}
          {nextGames.map(g=><button key={g.source_game_id} className={selectedGame?.source_game_id===g.source_game_id?"game-row chosen":"game-row"} onClick={()=>chooseGame(g)}><span><b>{g.away_team} @ {g.home_team}</b><small>{formatDate(g.game_date)} · {g.game_time||"Time TBD"} · {g.game_type||"Game"}{g.favorite_team?" · Fav: "+g.favorite_team+" -"+(g.favorite_spread??""):""}{g.over_under_line!=null?" · O/U "+g.over_under_line:""}</small>{((g.closing_spread_points!=null||g.closing_over_under_line!=null))&&<small className="closing-line-note">ESPN close: {g.closing_spread_points==null?"spread —":g.closing_spread_points===0?"PK":(g.closing_spread_points>0?g.home_team:g.away_team)+" -"+Math.abs(Number(g.closing_spread_points))} · O/U {g.closing_over_under_line??"—"} · {g.closing_provider||g.closing_line_status}</small>}</span><span className="score">0 - 0</span></button>)}
          {completedGames.length>0&&<details className="tracker-completed" open={status==="completed"}><summary>Completed Games <span>{completedGames.length}</span></summary>{completedGames.map(g=><button key={g.source_game_id} className={selectedGame?.source_game_id===g.source_game_id?"game-row chosen":"game-row"} onClick={()=>chooseGame(g)}><span><b>{g.away_team} @ {g.home_team}</b><small>{formatDate(g.game_date)} · {g.game_time||"Time TBD"} · {g.game_type||"Game"}{g.favorite_team?" · Fav: "+g.favorite_team+" -"+(g.favorite_spread??""):""}{g.over_under_line!=null?" · O/U "+g.over_under_line:""}</small>{((g.closing_spread_points!=null||g.closing_over_under_line!=null))&&<small className="closing-line-note">ESPN close: {g.closing_spread_points==null?"spread —":g.closing_spread_points===0?"PK":(g.closing_spread_points>0?g.home_team:g.away_team)+" -"+Math.abs(Number(g.closing_spread_points))} · O/U {g.closing_over_under_line??"—"} · {g.closing_provider||g.closing_line_status}</small>}</span><span className="score">{g.away_score} - {g.home_score}</span></button>)}</details>}
        </>}
        {!visibleGames.length&&!busy&&<p className="empty">No games match this search and filter.</p>}
      </div>

    </div>:tab==="Team Performance"?<div className="analytics"><div className="analytics-intro"><span className="eyebrow">HISTORICAL TEAM RECORDS</span><h3>{focusedTeam?focusedTeam.name+" performance":"All-team performance"}</h3><p>Completed games only · win percentage counts ties as half a win · division opponents are based on NFL division alignment.</p></div>
      {focusedTeam?<><div className="performance-cards"><div className="performance-card stat-click" role="button" tabIndex={0} onClick={()=>openDrilldown(focusedTeam.name,"all",focusedTeam.name+" overall games")}><span>OVERALL</span><strong>{record(focusedTeam.overall.w,focusedTeam.overall.l,focusedTeam.overall.t)}</strong><small>{focusedTeam.overall.pct} · {focusedTeam.overall.g} games</small></div><div className="performance-card stat-click" role="button" tabIndex={0} onClick={()=>openDrilldown(focusedTeam.name,"all",focusedTeam.name+" home games","home")}><span>HOME</span><strong>{record(focusedTeam.home.w,focusedTeam.home.l,focusedTeam.home.t)}</strong><small>{focusedTeam.home.pct} · {focusedTeam.home.g} games</small></div><div className="performance-card stat-click" role="button" tabIndex={0} onClick={()=>openDrilldown(focusedTeam.name,"all",focusedTeam.name+" away games","away")}><span>AWAY</span><strong>{record(focusedTeam.away.w,focusedTeam.away.l,focusedTeam.away.t)}</strong><small>{focusedTeam.away.pct} · {focusedTeam.away.g} games</small></div><div className="performance-card"><span>POINTS PER GAME</span><strong>{focusedTeam.ppg} – {focusedTeam.papg}</strong><small>Scored · allowed</small></div></div>
      <div className="performance-splits"><div><h4>Opponent breakdown</h4>{[["Division opponents",focusedTeam.division],["Non-division opponents",focusedTeam.nonDivision]].map(([label,r])=><div className="split-row" key={label}><span>{label}</span><b>{record(r.w,r.l,r.t)}</b><strong>{r.pct}</strong><small>{r.g} games</small></div>)}</div><div><h4>Home vs. away winning percentage</h4>{[["Home",focusedTeam.home],["Away",focusedTeam.away]].map(([label,r])=><div className="bar-row" key={label}><div><span>{label}</span><b>{r.pct}</b></div><div className="bar-track"><i style={{width:r.pct==="—"?"0":r.pct}}/></div><small>{record(r.w,r.l,r.t)} · {r.g} games</small></div>)}</div></div></>:<div className="table-wrap"><table className="performance-table"><thead><tr><th>TEAM</th><th>W-L-T</th><th>WIN %</th><th>HOME</th><th>AWAY</th><th>DIVISION</th><th>NON-DIVISION</th><th>PF/G</th><th>PA/G</th></tr></thead><tbody>{teamPerformance.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{record(r.overall.w,r.overall.l,r.overall.t)}</td><td><b>{r.overall.pct}</b></td><td>{record(r.home.w,r.home.l,r.home.t)}</td><td>{record(r.away.w,r.away.l,r.away.t)}</td><td>{record(r.division.w,r.division.l,r.division.t)}</td><td>{record(r.nonDivision.w,r.nonDivision.l,r.nonDivision.t)}</td><td>{r.ppg}</td><td>{r.papg}</td></tr>)}</tbody></table></div>}
    </div>:<div className="analytics"><div className="analytics-intro"><span className="eyebrow">{tab==="Market Predictions"?"PREGAME MODEL":"HISTORICAL ANALYTICS"}</span><h3>{tab==="Market Predictions"?"Current week forecasts & model performance":tab+" breakdown"}</h3><p>{tab==="Market Predictions"?"This week's games only, with historical model testing and ongoing forecast grading.":"Completed games only · sample sizes are shown with each result."}</p></div>
    {tab==="Market Predictions" && <div className="prediction-dashboard">
      {predictionError&&<div className="notice">{predictionError}</div>}
      {!predictionData&&<div className="viz-card prediction-loading">{predictionBusy?"Building the historical backtest and upcoming forecasts…":"Prediction data is not available yet."}</div>}
      {predictionData&&<>
        <div className="prediction-topline"><div><span className="eyebrow">MODEL {predictionData.modelVersion}</span><p>NFL week: {predictionData.currentWeek?.start||"—"} to {predictionData.currentWeek?.end||"—"} · Model trained on {Number(predictionData.trainedGames||0).toLocaleString()} completed games</p></div><button type="button" style={buttonStyle} disabled={predictionBusy} onClick={()=>setPredictionRefresh(value=>value+1)}>{predictionBusy?"Refreshing…":"Refresh forecasts"}</button></div>
        <section className="prediction-phase">
          <div className="prediction-phase-head"><span className="prediction-phase-number">00</span><div><span className="eyebrow">FREE DATA INPUTS</span><h3>Data source health</h3><p>Your historical game records remain the foundation. These additional feeds enrich upcoming forecasts; live context adjustments are experimental and have not yet been validated in a historical out-of-sample backtest.</p></div></div>
          <div className="prediction-topline"><span className="trend-footnote">Free feeds · ESPN closing lines are saved separately from manually entered lines</span><button type="button" style={buttonStyle} disabled={dataRefreshBusy} onClick={refreshDataFeeds}>{dataRefreshBusy?"Refreshing free data…":"Refresh free data"}</button></div>
          {dataRefreshMessage&&<div className="notice" role="status">{dataRefreshMessage}</div>}
          <div className="prediction-topline"><span className="trend-footnote">Backfill completed games in batches of 80; rerun after each batch to continue</span><div className="prediction-action-group"><button type="button" style={buttonStyle} disabled={closingLineRefreshBusy} onClick={()=>refreshClosingLines(false)}>{closingLineRefreshBusy?"Loading ESPN lines…":"Refresh ESPN closing lines"}</button><button type="button" className="secondary" disabled={closingLineRefreshBusy} onClick={()=>refreshClosingLines(true)}>Retry unavailable</button></div></div>
          {closingLineRefreshMessage&&<div className="notice" role="status">{closingLineRefreshMessage}</div>}
          <div className="performance-cards prediction-stat-cards">
            <div className="performance-card"><span>YOUR GAME HISTORY</span><strong>{Number(predictionData.trainedGames||0).toLocaleString()}</strong><small>Completed games already in Neon</small></div>
            {Object.entries(dataSourceLabels).map(([key,label])=>{const source=(predictionData.dataSources||[]).find(row=>row.source===key);return <div className="performance-card" key={key}><span>{label}</span><strong>{!source||source.status==="never"?"Not synced":source.status==="ready"?"Ready":source.status==="syncing"?"Syncing":"Needs attention"}</strong><small>{Number(source?.row_count||0).toLocaleString()} records{source?.last_synced?" · "+new Date(source.last_synced).toLocaleString():""}{source?.last_error?" · "+source.last_error:""}</small></div>;})}
          </div>
          <p className="trend-footnote">Coverage in the latest forecast build: {Number(predictionData.dataCoverage?.teamStatRows||0).toLocaleString()} team-week records · {Number(predictionData.dataCoverage?.qbStatRows||0).toLocaleString()} QB-week records · {Number(predictionData.dataCoverage?.currentInjuryRows||0).toLocaleString()} current injury reports · {Number(predictionData.dataCoverage?.weatherGames||0).toLocaleString()} stadium weather records.</p>
        </section>
        <section className="prediction-phase">
          <div className="prediction-phase-head"><span className="prediction-phase-number">01</span><div><span className="eyebrow">PHASE 1 · HISTORICAL TEST</span><h3>Walk-forward backtest</h3><p>Each game is predicted using only games played before it. Ratings and recent form update after each final score.</p></div></div>
          <div className="performance-cards prediction-stat-cards">
            <div className="performance-card"><span>WINNER ACCURACY</span><strong>{predictionData.backtest.winner.accuracy==null?"—":predictionData.backtest.winner.accuracy+"%"}</strong><small>{predictionData.backtest.winner.correct} correct of {predictionData.backtest.winner.games} non-tie games</small></div>
            <div className="performance-card"><span>ATS PICK ACCURACY</span><strong>{predictionData.backtest.ats.accuracy==null?"—":predictionData.backtest.ats.accuracy+"%"}</strong><small>{predictionData.backtest.ats.correct} correct of {predictionData.backtest.ats.games} graded decisions · pushes excluded</small></div>
            <div className="performance-card"><span>OVER / UNDER ACCURACY</span><strong>{predictionData.backtest.overUnder.accuracy==null?"—":predictionData.backtest.overUnder.accuracy+"%"}</strong><small>{predictionData.backtest.overUnder.correct} correct of {predictionData.backtest.overUnder.games} graded totals · pushes excluded</small></div>
            <div className="performance-card"><span>PROJECTED MARGIN ERROR</span><strong>{predictionData.backtest.marginMae==null?"—":predictionData.backtest.marginMae+" pts"}</strong><small>Margin MAE · Total MAE {predictionData.backtest.totalMae==null?"—":predictionData.backtest.totalMae+" pts"} · {predictionData.backtest.games} tested games</small></div>
          </div>
          <div className="prediction-subgrid">
            <div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">MODEL CALIBRATION</span><h4>Accuracy by confidence band</h4></div></div>
              <div className="prediction-calibration">{predictionData.backtest.calibration.map(row=><div className="prediction-calibration-row" key={row.label}><span>{row.label}</span><div className="prediction-track"><i style={{width:row.accuracy==null?"0":row.accuracy+"%"}}/></div><b>{row.accuracy==null?"—":row.accuracy+"%"}</b><small>{row.games} games</small></div>)}</div>
            </div>
            <div className="viz-card prediction-method"><div className="viz-heading"><div><span className="eyebrow">HOW IT WORKS</span><h4>Model inputs</h4></div></div>
              <ul><li>Team Elo ratings with home-field advantage</li><li>Recent scoring and points allowed from each team's last 10 games</li><li>Season-to-season rating regression</li><li>Vegas spread and total lines when they are entered</li></ul>
              <p className="trend-footnote">Historical backtest is chronological; a game's final score is never used to predict that same game.</p>
            </div>
          </div>
        </section>
        <section className="prediction-phase">
          <div className="prediction-phase-head"><span className="prediction-phase-number">02</span><div><span className="eyebrow">PHASE 2 · UPCOMING GAMES</span><h3>Pregame predictions</h3><p>Only games in the current NFL week are shown. Forecasts are saved before kickoff; adding or changing a spread or total creates a separate market snapshot.</p></div></div>
          {predictionData.upcoming.length===0?<div className="viz-card"><p className="empty">No upcoming games remain in the current NFL week.</p></div>:<div className="prediction-game-grid">
            {visiblePredictions.map(game=>{
              const homePct=Math.round(game.predicted_home_win_probability*100),awayPct=100-homePct;
              const homeScore=(game.predicted_total_points+game.predicted_home_margin)/2,awayScore=game.predicted_total_points-homeScore;
              const favorite=homePct>=50?game.home_team:game.away_team;
              const vegasSpread=game.spread_points==null?null:Number(game.spread_points);
              const vegasTotal=game.over_under_line==null?null:Number(game.over_under_line);
              const modelMargin=Number(game.predicted_home_margin);
              const modelSpreadText=!Number.isFinite(modelMargin)?"Unavailable":Math.abs(modelMargin)<0.05?"Pick’em":(modelMargin>0?game.home_team:game.away_team)+" "+Math.abs(modelMargin).toFixed(1)+" pts";
              const vegasSpreadText=vegasSpread==null?"Waiting for line":!Number.isFinite(vegasSpread)?"Invalid line":vegasSpread===0?"Pick’em":(vegasSpread>0?game.home_team:game.away_team)+" -"+Math.abs(vegasSpread).toFixed(1);
              return <article className="prediction-game-card" key={game.competition_type+"-"+game.source_game_id}>
                <div className="prediction-game-meta"><span>{formatDate(game.game_date)} · {formatGameTime(game.game_time)}</span><span className={"prediction-confidence "+game.confidence.toLowerCase()}>{game.confidence} confidence</span></div>
                <div className="prediction-matchup"><div><small>AWAY</small><b>{game.away_team}</b><strong>{awayScore.toFixed(1)}</strong></div><span className="prediction-at">@</span><div><small>HOME</small><b>{game.home_team}</b><strong>{homeScore.toFixed(1)}</strong></div></div>
                <div className="prediction-win-label"><span>WIN PROBABILITY</span><b>{awayPct}% — {homePct}%</b></div>
                <div className="prediction-win-track"><i style={{width:awayPct+"%"}}/><i style={{width:homePct+"%"}}/></div>
                <div className="prediction-favorite">Model lean: <b>{favorite}</b></div>
                <div className="prediction-market-lines">
                  <div><span>VEGAS SPREAD</span><b>{vegasSpreadText}</b></div>
                  <div><span>MODEL SPREAD</span><b>{modelSpreadText}</b></div>
                  <div><span>VEGAS TOTAL</span><b>{vegasTotal==null?"Waiting for line":Number.isFinite(vegasTotal)?vegasTotal.toFixed(1):"Invalid line"}</b></div>
                  <div><span>MODEL TOTAL</span><b>{Number.isFinite(Number(game.predicted_total_points))?Number(game.predicted_total_points).toFixed(1):"Unavailable"}</b></div>
                </div>
                {(game.predicted_home_cover_probability!=null||game.predicted_over_probability!=null)&&<div className="prediction-probability-footer">{game.predicted_home_cover_probability!=null&&<span>Home cover: <b>{Math.round(game.predicted_home_cover_probability*100)}%</b></span>}{game.predicted_over_probability!=null&&<span>Over: <b>{Math.round(game.predicted_over_probability*100)}%</b></span>}</div>}
                {(game.feature_snapshot?.home_quarterback_report?.status||game.feature_snapshot?.away_quarterback_report?.status||game.feature_snapshot?.weather)&&<div className="prediction-probability-footer">{(game.feature_snapshot.home_quarterback_report?.status||game.feature_snapshot.away_quarterback_report?.status)&&<span>QB reports: <b>{[game.feature_snapshot.away_quarterback_report,game.feature_snapshot.home_quarterback_report].filter(x=>x?.status).map(x=>x.player+" — "+x.status).join(" · ")}</b></span>}{game.feature_snapshot.weather&&<span>{game.feature_snapshot.weather.stadium}: <b>{game.feature_snapshot.weather.wind_max_mph==null?"Indoor / no outdoor forecast":game.feature_snapshot.weather.wind_max_mph+" mph wind"}{game.feature_snapshot.weather.precipitation_in==null?"":" · "+game.feature_snapshot.weather.precipitation_in+" in precip"}</b></span>}<span><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo</a></span></div>}
              </article>;
            })}
          </div>}
          
          <p className="trend-footnote">No spread or total is assumed when a line is blank. Add the current Vegas lines in Game Tracker, then refresh forecasts to record a line-specific prediction.</p>
        </section>
        <section className="prediction-phase">
          <div className="prediction-phase-head"><span className="prediction-phase-number">03</span><div><span className="eyebrow">PHASE 3 · TRACK RECORD</span><h3>How the model performs</h3><p>Saved forecasts are matched to final scores automatically. This record uses the latest saved line snapshot for each game.</p></div></div>
          <div className="performance-cards prediction-stat-cards">
            <div className="performance-card"><span>SETTLED FORECASTS</span><strong>{predictionData.performance.settled}</strong><small>{predictionData.performance.saved} saved forecasts</small></div>
            <div className="performance-card"><span>WINNER ACCURACY</span><strong>{predictionData.performance.winner.accuracy==null?"—":predictionData.performance.winner.accuracy+"%"}</strong><small>{predictionData.performance.winner.correct} / {predictionData.performance.winner.games} decisions</small></div>
            <div className="performance-card"><span>ATS ACCURACY</span><strong>{predictionData.performance.ats.accuracy==null?"—":predictionData.performance.ats.accuracy+"%"}</strong><small>{predictionData.performance.ats.correct} / {predictionData.performance.ats.games} graded · pushes excluded</small></div>
            <div className="performance-card"><span>O/U ACCURACY</span><strong>{predictionData.performance.overUnder.accuracy==null?"—":predictionData.performance.overUnder.accuracy+"%"}</strong><small>{predictionData.performance.overUnder.correct} / {predictionData.performance.overUnder.games} graded · pushes excluded</small></div>
          </div>
          {predictionData.performance.settled===0?<div className="viz-card"><p className="empty">No saved forecasts have final scores yet. Upcoming predictions will be graded here automatically as you enter game results.</p></div>:<div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">CONFIDENCE TRACKING</span><h4>Winner accuracy by confidence</h4></div></div><div className="table-wrap"><table><thead><tr><th>CONFIDENCE</th><th>SETTLED PICKS</th><th>WINNER ACCURACY</th></tr></thead><tbody>{predictionData.performance.confidence.map(row=><tr key={row.level}><td><b>{row.level}</b></td><td>{row.games}</td><td>{row.accuracy==null?"—":row.accuracy+"%"}</td></tr>)}</tbody></table></div></div>}
          {predictionData.performance.recent.length>0&&<div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">LATEST SAVED FORECASTS</span><h4>Prediction history</h4></div></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>MATCHUP</th><th>MODEL WIN %</th><th>PROJECTED MARGIN</th><th>PROJECTED TOTAL</th><th>STATUS</th></tr></thead><tbody>{predictionData.performance.recent.map((row,i)=><tr key={row.game_date+row.away_team+row.home_team+i}><td>{formatDate(row.game_date)}</td><td><b>{row.away_team} @ {row.home_team}</b></td><td>{Math.round((row.predicted_home_win_probability)*100)}% home</td><td>{row.predicted_home_margin>0?row.home_team:row.away_team} {Math.abs(row.predicted_home_margin).toFixed(1)}</td><td>{row.predicted_total_points.toFixed(1)}</td><td>{row.settled?row.actual_score:"Pending"}</td></tr>)}</tbody></table></div></div>}
        </section>
        <p className="prediction-disclaimer">Research tool only, not betting advice. Probabilities are estimates from the data available in this tracker; missing injuries, weather, lineup changes, and market movement can materially affect outcomes. Small samples are less reliable.</p>
      </>}
    </div>}



    {tab==="Market Insights" && <><div className="analytics-intro"><span className="eyebrow">VEGAS LINE ACCURACY</span><h3>How closely did the market call it?</h3><p>Average absolute difference between the Vegas line recorded in your data and the final result. Lower error means a closer line. This is not a betting-profit calculation.</p></div><div className="performance-cards"><div className="performance-card"><span>SPREAD ERROR</span><strong>{marketInsights.spreadError==null?"—":marketInsights.spreadError.toFixed(1)+" pts"}</strong><small>{marketInsights.spreadCount} graded games · average absolute margin error</small></div><div className="performance-card"><span>TOTAL-LINE ERROR</span><strong>{marketInsights.totalError==null?"—":marketInsights.totalError.toFixed(1)+" pts"}</strong><small>{marketInsights.gradedCount} graded totals · average absolute total error</small></div></div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">TOTAL-LINE SEGMENTS</span><h4>Over / under outcomes by Vegas total</h4></div><span className="viz-note">Pushes excluded from percentage</span></div><div className="table-wrap"><table><thead><tr><th>VEGAS TOTAL</th><th>GAMES</th><th>OVER</th><th>UNDER</th><th>PUSH</th><th>OVER %</th><th>AVG TOTAL ERROR</th></tr></thead><tbody>{marketInsights.bands.map(r=><tr key={r.label}><td><b>{r.label}</b></td><td>{r.games}</td><td>{r.over}</td><td>{r.under}</td><td>{r.push}</td><td>{r.overPct}</td><td>{r.games?r.avgTotalError.toFixed(1)+" pts":"—"}</td></tr>)}</tbody></table></div><p className="trend-footnote">This adds total-line segmentation; spread-size ATS breakdowns remain in Against Spread and are not repeated here.</p></div></>}
    {tab==="Situational Trends" && <><div className="analytics-intro"><span className="eyebrow">WHEN GAMES ARE PLAYED</span><h3>Schedule-based results</h3><p>Compares outcomes by calendar day and recorded kickoff-time window. Home/away and divisional splits remain in Team Performance.</p></div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">DAY OF WEEK</span><h4>Results by game day</h4></div></div><div className="table-wrap"><table><thead><tr><th>DAY</th><th>GAMES</th><th>HOME WINS</th><th>HOME WIN %</th><th>AVG TOTAL POINTS</th><th>FAVORITE COVER %</th></tr></thead><tbody>{situationalInsights.dayRows.map(r=><tr key={r.label}><td><b>{r.label}</b></td><td>{r.games}</td><td>{r.homeWins}</td><td>{r.homeWinPct}</td><td>{r.avgTotal}</td><td>{r.favoriteCover}</td></tr>)}</tbody></table></div></div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">KICKOFF WINDOW</span><h4>Results by recorded kickoff time</h4></div></div><div className="table-wrap"><table><thead><tr><th>WINDOW</th><th>GAMES</th><th>HOME WIN %</th><th>AVG TOTAL POINTS</th><th>FAVORITE COVER %</th></tr></thead><tbody>{situationalInsights.timeRows.map(r=><tr key={r.label}><td><b>{r.label}</b></td><td>{r.games}</td><td>{r.homeWinPct}</td><td>{r.avgTotal}</td><td>{r.favoriteCover}</td></tr>)}</tbody></table></div><p className="trend-footnote">Kickoff windows use the time stored in the game record (Early 12:00–14:59, Afternoon 15:00–17:59, Evening 18:00–04:59). {situationalInsights.missingTime} completed games have no recorded time and are excluded from this breakdown. Times are shown as stored, not converted to your device timezone.</p></div></>}
    {tab==="Performance Insights" && <><div className="analytics-intro"><span className="eyebrow">MARGINS & CONSISTENCY</span><h3>{focusedPerformance?focusedPerformance.name+" deeper performance":"Team scoring and margin profile"}</h3><p>New measures beyond win percentage, points per game, ATS record, and streaks. Positive cover margin means the team beat its spread by that many points on average.</p></div>{focusedPerformance?<div className="performance-cards"><div className="performance-card"><span>AVERAGE COVER MARGIN</span><strong>{focusedPerformance.avgCoverMargin==="—"?"—":(Number(focusedPerformance.avgCoverMargin)>0?"+":"")+focusedPerformance.avgCoverMargin+" pts"}</strong><small>{focusedPerformance.coverGames} graded spread games</small></div><div className="performance-card"><span>SCORING VARIABILITY</span><strong>{focusedPerformance.scoringStd==="—"?"—":focusedPerformance.scoringStd+" pts"}</strong><small>Standard deviation of points scored · lower is steadier</small></div><div className="performance-card"><span>CLOSE GAMES (7 OR FEWER)</span><strong>{focusedPerformance.closeWins}-{focusedPerformance.closeLosses}-{focusedPerformance.closeTies}</strong><small>{focusedPerformance.closeWinPct} win rate · {focusedPerformance.closeGames} games</small></div><div className="performance-card"><span>POINTS PER GAME</span><strong>{focusedPerformance.ppg}</strong><small>Scored per completed game</small></div></div>:<div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">TEAM COMPARISON</span><h4>Cover margin and scoring consistency</h4></div></div><div className="table-wrap"><table><thead><tr><th>TEAM</th><th>GAMES</th><th>AVG COVER MARGIN</th><th>SPREAD GAMES</th><th>SCORING VARIABILITY</th><th>PPG</th><th>CLOSE GAMES</th><th>CLOSE-GAME WIN %</th></tr></thead><tbody>{performanceInsights.rows.map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{r.g}</td><td>{r.avgCoverMargin==="—"?"—":(Number(r.avgCoverMargin)>0?"+":"")+r.avgCoverMargin}</td><td>{r.coverGames}</td><td>{r.scoringStd}</td><td>{r.ppg}</td><td>{r.closeGames}</td><td>{r.closeWinPct}</td></tr>)}</tbody></table></div><p className="trend-footnote">Select a team using the team filter above for its expanded profile. Scoring variability is population standard deviation across completed games in the selected filters.</p></div>}<div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">FINAL MARGIN DISTRIBUTION</span><h4>Betting outcomes in close games vs. blowouts</h4></div></div><div className="table-wrap"><table><thead><tr><th>FINAL MARGIN</th><th>GAMES</th><th>AVG MARGIN</th><th>FAVORITE COVER %</th><th>OVER %</th></tr></thead><tbody>{performanceInsights.marginRows.map(r=><tr key={r.label}><td><b>{r.label}</b></td><td>{r.games}</td><td>{r.avgMargin}</td><td>{r.favCover}</td><td>{r.overPct}</td></tr>)}</tbody></table></div></div></>}

    {tab==="Matchup Analyzer" && <><div className="matchup-hero"><div className="matchup-kicker">HEAD-TO-HEAD SCOUTING</div><div className="matchup-selectors"><label>TEAM ONE<TeamPicker value={matchupHome} onChange={setMatchupA} teams={Object.keys(teamAssets)} searchable={false}/></label><div className="versus">VS</div><label>TEAM TWO<TeamPicker value={matchupAway} onChange={setMatchupB} teams={Object.keys(teamAssets).filter(t=>t!==matchupHome)} searchable={false}/></label></div><div className="matchup-scoreboard"><div><span>{matchupHome}</span><strong>{matchupAStats.w}–{matchupAStats.l}–{matchupAStats.t}</strong><small>All-time W-L-T</small></div><div className="matchup-center"><b>{matchupHistory.length}</b><small>MEETINGS</small></div><div><span>{matchupAway}</span><strong>{matchupBStats.w}–{matchupBStats.l}–{matchupBStats.t}</strong><small>All-time W-L-T</small></div></div></div>
      <div className="matchup-grid"><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">BETTING PERFORMANCE</span><h4>ATS cover rate</h4></div><span className="viz-note">Pushes excluded</span></div>{[[matchupHome,matchupAStats],[matchupAway,matchupBStats]].map(([n,s])=><div className="compare-bar" key={n}><div><b>{n}</b><strong>{pct(s.atsW,s.atsN-s.atsP)}</strong></div><div className="bar-track"><i style={{width:pct(s.atsW,s.atsN-s.atsP)==="—"?"0":pct(s.atsW,s.atsN-s.atsP)}}/></div><small>{record(s.atsW,s.atsL,s.atsP)} · {s.atsN} graded games</small></div>)}</div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">TOTAL POINTS</span><h4>Over trend</h4></div><span className="viz-note">Graded totals</span></div>{[[matchupHome,matchupAStats],[matchupAway,matchupBStats]].map(([n,s])=><div className="compare-bar" key={n}><div><b>{n}</b><strong>{pct(s.over,s.over+s.under)}</strong></div><div className="bar-track over-track"><i style={{width:pct(s.over,s.over+s.under)==="—"?"0":pct(s.over,s.over+s.under)}}/></div><small>{s.over} over · {s.under} under · {s.ouN} games</small></div>)}</div></div>
      <div className="viz-card scoring-card"><div className="viz-heading"><div><span className="eyebrow">SCORING COMPARISON</span><h4>Average points per meeting</h4></div></div><div className="score-bars">{[[matchupHome,matchupAStats],[matchupAway,matchupBStats]].map(([n,s])=><div className="score-bar-col" key={n}><strong>{s.ppg}</strong><div className="score-bar-track"><i style={{height:s.ppg==="—"?"0":Math.min(100,Number(s.ppg)/40*100)+"%"}}/></div><span>{n}</span></div>)}</div></div>
      <div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">SERIES HISTORY</span><h4>Every recorded meeting</h4></div><span className="viz-note">{matchupHistory.length} games</span></div><div className="table-wrap matchup-history-table"><table><thead><tr><th>DATE</th><th>MATCHUP</th><th>FINAL</th><th>WINNER</th><th>SPREAD</th><th>ATS</th><th>TOTAL</th></tr></thead><tbody>{matchupHistory.map(g=><tr key={g.competition_type+"-"+g.source_game_id} onClick={()=>chooseGame(g)} className="clickable-game"><td>{formatDate(g.game_date)}</td><td>{g.away_team} @ {g.home_team}</td><td>{g.away_score}–{g.home_score}</td><td>{g.away_score>g.home_score?g.away_team:g.home_score>g.away_score?g.home_team:"Tie"}</td><td>{g.spread_text||"—"}</td><td>{g.ats_result==="push"?"Push":g.covered_team||"—"}</td><td>{g.over_under_line==null?"—":Number(g.total_points)>Number(g.over_under_line)?"Over":Number(g.total_points)<Number(g.over_under_line)?"Under":"Push"}</td></tr>)}</tbody></table></div><div className="matchup-history-mobile">{matchupHistory.map(g=><button type="button" key={g.competition_type+"-"+g.source_game_id} className="matchup-game-card" onClick={()=>chooseGame(g)}><div className="matchup-game-top"><b>{g.away_team} @ {g.home_team}</b><span>{formatDate(g.game_date)}</span></div><div className="matchup-game-score">{g.away_score} – {g.home_score}</div><div className="matchup-game-details"><span><small>WINNER</small>{g.away_score>g.home_score?g.away_team:g.home_score>g.away_score?g.home_team:"Tie"}</span><span><small>SPREAD</small>{g.spread_text||"—"}</span><span><small>ATS</small>{g.ats_result==="push"?"Push":g.covered_team||"—"}</span><span><small>TOTAL</small>{g.over_under_line==null?"—":Number(g.total_points)>Number(g.over_under_line)?"Over":Number(g.total_points)<Number(g.over_under_line)?"Under":"Push"}</span></div></button>)}</div>{!matchupHistory.length&&<p className="empty">No completed meetings for this matchup in the selected filters.</p>}</div></>}
    {tab==="Trend Finder" && <><div className="trend-controls"><label>RANK BY<select style={inputStyle} value={trendMetric} onChange={e=>setTrendMetric(e.target.value)}><option value="ats">ATS cover %</option><option value="over">Over %</option><option value="under">Under %</option><option value="wins">Win %</option><option value="points">Points per game</option></select></label><label>RECENT SAMPLE<select style={inputStyle} value={trendWindow} onChange={e=>setTrendWindow(e.target.value)}><option value="5">Last 5 games</option><option value="10">Last 10 games</option><option value="20">Last 20 games</option><option value="all">All games in filters</option></select></label></div><div className="trend-hero"><div><span className="eyebrow">NFL TREND LEADERBOARD</span><h3>{trendTitle}</h3><p>Ranked using each team's most recent {trendWindow==="all"?"available":trendWindow} completed games. Sample sizes are shown.</p></div><div className="trend-badge"><strong>{trendRows.length}</strong><span className="trend-badge-label">TEAMS RANKED</span></div></div><div className="trend-layout"><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">LEAGUE LEADERS</span><h4>Top performers</h4></div></div>{trendRows.slice(0,10).map((r,i)=><button className="rank-row" key={r.name} onClick={()=>{setTeam(r.name);setTab("Team Performance");}}><span className="rank-number">{String(i+1).padStart(2,"0")}</span><span className="rank-team"><b>{r.name}</b><i><em style={{width:trendMetric==="points"?Math.min(100,r.metric/40*100)+"%":r.metric+"%"}}/></i></span><strong>{r.label}</strong><small>{trendMetric==="ats"?r.atsG+" ATS games":trendMetric==="over"||trendMetric==="under"?r.ouG+" totals":r.g+" games"}</small></button>)}</div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">NEEDS ATTENTION</span><h4>Bottom performers</h4></div></div>{trendRows.slice(-5).reverse().map((r,i)=><button className="rank-row bottom-rank" key={r.name} onClick={()=>{setTeam(r.name);setTab("Team Performance");}}><span className="rank-number">{String(trendRows.length-i).padStart(2,"0")}</span><span className="rank-team"><b>{r.name}</b><i><em style={{width:trendMetric==="points"?Math.min(100,r.metric/40*100)+"%":r.metric+"%"}}/></i></span><strong>{r.label}</strong><small>{trendMetric==="ats"?r.atsG+" ATS games":trendMetric==="over"||trendMetric==="under"?r.ouG+" totals":r.g+" games"}</small></button>)}</div></div><div className="trend-footnote">Percentages exclude pushes. Rankings use each team's most recent graded games within the selected season and competition filters.</div></>}
    {tab==="Over/Under" && (focusedOU ? <><div className="performance-cards">{[["OVERALL",focusedOU.overall],["HOME",focusedOU.home],["AWAY",focusedOU.away],["FAVORITE",focusedOU.favorite],["UNDERDOG",focusedOU.underdog],["EVEN",focusedOU.even],["DIVISION",focusedOU.division],["NON-DIVISION",focusedOU.nonDivision]].map(([label,r])=><div className="performance-card" key={label}><span>{label}</span><strong>{r.over}-{r.under}-{r.push}</strong><small>{r.pct} over · {r.g} games</small></div>)}</div></> : <div className="table-wrap"><table><thead><tr><th>TEAM</th><th>OVER-UNDER-PUSH</th><th>GAMES</th><th>OVER %</th><th>HOME</th><th>AWAY</th><th>FAVORITE</th><th>UNDERDOG</th><th>DIVISION</th><th>NON-DIV</th></tr></thead><tbody>{[...ouPerformance].sort((a,b)=>Number(b.overall.pct.replace("%","")||-1)-Number(a.overall.pct.replace("%","")||-1)).map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{r.overall.over}-{r.overall.under}-{r.overall.push}</td><td>{r.overall.g}</td><td>{r.overall.pct}</td><td>{r.home.over}-{r.home.under}-{r.home.push}</td><td>{r.away.over}-{r.away.under}-{r.away.push}</td><td>{r.favorite.over}-{r.favorite.under}-{r.favorite.push}</td><td>{r.underdog.over}-{r.underdog.under}-{r.underdog.push}</td><td>{r.division.over}-{r.division.under}-{r.division.push}</td><td>{r.nonDivision.over}-{r.nonDivision.under}-{r.nonDivision.push}</td></tr>)}</tbody></table></div>)}
    {tab==="Against Spread" && (focusedATS ? <><div className="performance-cards">{[["OVERALL",focusedATS.overall],["HOME",focusedATS.home],["AWAY",focusedATS.away],["FAVORITE",focusedATS.favorite],["UNDERDOG",focusedATS.dog],["EVEN",focusedATS.even],["DIVISION",focusedATS.division],["NON-DIVISION",focusedATS.nonDivision]].map(([label,r])=><div className="performance-card" key={label}><span>{label}</span><strong>{record(r.w,r.l,r.p)}</strong><small>{r.cover} cover · {r.g} games</small></div>)}</div><div className="performance-splits ats-splits"><div><h4>Home / away status</h4>{[["Home favorite",focusedATS.homeFav],["Home underdog",focusedATS.homeDog],["Home even",focusedATS.homeEven],["Away favorite",focusedATS.awayFav],["Away underdog",focusedATS.awayDog],["Away even",focusedATS.awayEven]].map(([label,r])=><div className="split-row ats-split-row" key={label}><span>{label}</span><b>{record(r.w,r.l,r.p)}</b><strong>{r.cover}</strong><small>{r.g} games</small></div>)}</div><div><h4>Spread size</h4>{focusedATS.bands.map(([label,r])=><div className="split-row ats-split-row" key={label}><span>{label}</span><b>{record(r.w,r.l,r.p)}</b><strong>{r.cover}</strong><small>{r.g} games</small></div>)}</div></div></> : <div className="table-wrap"><table><thead><tr><th>TEAM</th><th>ATS W-L-P</th><th>GAMES</th><th>COVER %</th><th>FAVORITE</th><th>UNDERDOG</th><th>HOME</th><th>AWAY</th><th>DIVISION</th><th>NON-DIV</th></tr></thead><tbody>{[...atsPerformance].sort((a,b)=>Number(b.overall.cover.replace("%","")||-1)-Number(a.overall.cover.replace("%","")||-1)).map(r=><tr key={r.name}><td><b>{r.name}</b></td><td>{record(r.overall.w,r.overall.l,r.overall.p)}</td><td>{r.overall.g}</td><td>{r.overall.cover}</td><td>{record(r.favorite.w,r.favorite.l,r.favorite.p)} · {r.favorite.cover}</td><td>{record(r.dog.w,r.dog.l,r.dog.p)} · {r.dog.cover}</td><td>{record(r.home.w,r.home.l,r.home.p)} · {r.home.cover}</td><td>{record(r.away.w,r.away.l,r.away.p)} · {r.away.cover}</td><td>{record(r.division.w,r.division.l,r.division.p)} · {r.division.cover}</td><td>{record(r.nonDivision.w,r.nonDivision.l,r.nonDivision.p)} · {r.nonDivision.cover}</td></tr>)}</tbody></table></div>)}
    {tab==="Game Drill-Down" && <><div className="trend-hero"><div><span className="eyebrow">STAT TO GAME EXPLORER</span><h3>{drilldown.label}</h3><p>Explore the actual completed games behind a statistic. Select a team and result type to narrow the history.</p></div><div className="trend-badge"><strong>{drillGames.length}</strong><span>GAMES</span></div></div><div className="trend-controls"><label>TEAM<TeamPicker value={drilldown.team} onChange={v=>setDrilldown({...drilldown,team:v,label:v==="all"?"All completed games":v+" game history"})} teams={Object.keys(teamAssets)} allowAll placeholder="All teams"/></label><label>RESULT TYPE<select style={inputStyle} value={drilldown.metric} onChange={e=>setDrilldown({...drilldown,metric:e.target.value,label:({all:"All completed games",wins:"Wins",losses:"Losses",ats:"ATS covers",atsLoss:"ATS non-covers",over:"Overs",under:"Unders"})[e.target.value]})}><option value="all">All completed games</option><option value="wins">Wins</option><option value="losses">Losses</option><option value="ats">ATS covers</option><option value="atsLoss">ATS non-covers</option><option value="over">Overs</option><option value="under">Unders</option></select></label><label>LOCATION<select style={inputStyle} value={drilldown.location||"all"} onChange={e=>setDrilldown({...drilldown,location:e.target.value})}><option value="all">Home + away</option><option value="home">Home games</option><option value="away">Away games</option></select></label></div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">GAME LOG</span><h4>{drillGames.length} matching games</h4></div><span className="viz-note">Select a row to open its game editor</span></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>SEASON</th><th>MATCHUP</th><th>FINAL</th><th>WINNER</th><th>SPREAD</th><th>ATS</th><th>O/U RESULT</th></tr></thead><tbody>{drillGames.map(g=><tr key={g.competition_type+"-"+g.source_game_id} className="clickable-game" onClick={()=>chooseGame(g)}><td>{formatDate(g.game_date)}</td><td>{g.season}</td><td>{g.away_team} @ {g.home_team}</td><td>{g.away_score}–{g.home_score}</td><td>{g.away_score>g.home_score?g.away_team:g.home_score>g.away_score?g.home_team:"Tie"}</td><td>{g.spread_text||"—"}</td><td>{g.ats_result==="push"?"Push":g.covered_team||"—"}</td><td>{g.over_under_line==null?"—":Number(g.total_points)>Number(g.over_under_line)?"Over":Number(g.total_points)<Number(g.over_under_line)?"Under":"Push"}</td></tr>)}</tbody></table></div>{!drillGames.length&&<p className="empty">No games match these filters.</p>}</div></>}
    {tab==="Streak Tracker" && <><div className="trend-controls"><label>STREAK CATEGORY<select style={inputStyle} value={streakMetric} onChange={e=>setStreakMetric(e.target.value)}><option value="wins">Winning streaks</option><option value="losses">Losing streaks</option><option value="ats">ATS cover streaks</option><option value="atsLoss">ATS non-cover streaks</option><option value="over">Over streaks</option><option value="under">Under streaks</option></select></label></div><div className="trend-hero"><div><span className="eyebrow">NFL STREAK BOARD</span><h3>{({wins:"Winning streaks",losses:"Losing streaks",ats:"ATS cover streaks",atsLoss:"ATS non-cover streaks",over:"Over streaks",under:"Under streaks"})[streakMetric]}</h3><p>Current and longest streaks across the selected season and competition. Pushes and ungraded betting outcomes are excluded.</p></div><div className="trend-badge"><strong>{streakRows.length}</strong><span>TEAMS</span></div></div><div className="trend-layout"><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">CURRENT RUN</span><h4>Active streak leaderboard</h4></div></div>{[...streakRows].sort((a,b)=>b.current-a.current).slice(0,16).map((r,i)=><button className="rank-row" key={r.name} onClick={()=>openDrilldown(r.name,streakMetric==="wins"?"wins":streakMetric==="losses"?"losses":streakMetric==="ats"?"ats":streakMetric==="atsLoss"?"atsLoss":streakMetric,"Recent "+r.name+" "+streakMetric+" results")}><span className="rank-number">{String(i+1).padStart(2,"0")}</span><span className="rank-team"><b>{r.name}</b><i><em style={{width:Math.min(100,r.current/10*100)+"%"}}/></i></span><strong>{r.current} {r.currentLabel}</strong><small>{r.games} graded</small></button>)}</div><div className="viz-card"><div className="viz-heading"><div><span className="eyebrow">ALL-TIME HIGH</span><h4>Longest streaks</h4></div></div>{[...streakRows].sort((a,b)=>b.longest-a.longest).slice(0,16).map((r,i)=><button className="rank-row bottom-rank" key={r.name} onClick={()=>openDrilldown(r.name,"all",r.name+" complete game history")}><span className="rank-number">{String(i+1).padStart(2,"0")}</span><span className="rank-team"><b>{r.name}</b><i><em style={{width:Math.min(100,r.longest/15*100)+"%"}}/></i></span><strong>{r.longest} {r.longestLabel}</strong><small>{r.games} graded</small></button>)}</div></div><div className="trend-footnote">Current streak reflects the latest graded outcome. Streaks follow chronological game order; ties and pushes are excluded rather than counted as wins or losses.</div></>}
    {tab==="Season Trends" && <div className="table-wrap"><table><thead><tr><th>SEASON</th><th>GAMES</th><th>HOME WINS</th><th>AWAY WINS</th><th>FAVORITE ATS W-L-P</th><th>FAV COVER %</th><th>OVER</th><th>UNDER</th><th>O/U PUSH</th><th>AVG TOTAL</th></tr></thead><tbody>{seasonTrends.map(r=><tr key={r.year}><td><b>{r.year}</b></td><td>{r.g}</td><td>{r.home}</td><td>{r.away}</td><td>{record(r.favW,r.favL,r.favPush)}</td><td>{pct(r.favW,r.favW+r.favL)}</td><td>{r.over}</td><td>{r.under}</td><td>{r.push}</td><td>{r.avg}</td></tr>)}</tbody></table></div>}
    {tab==="Points" && analyticsTable()}
    </div>}
    </section>
    {showEditor&&selectedGame&&<div className="modal-backdrop editor-backdrop" onClick={()=>setShowEditor(false)}><section className="editor editor-modal" onClick={e=>e.stopPropagation()}><div className="editor-modal-head"><div><span className="eyebrow">GAME EDITOR · #{selectedGame.source_game_id}</span><h3>{selectedGame.away_team} <i>@</i> {selectedGame.home_team}</h3><p className="muted">{formatDate(selectedGame.game_date)} · {selectedGame.season} {selectedGame.game_type||""}</p></div><button className="close" onClick={()=>setShowEditor(false)}>×</button></div>
      <div className="editor-nav"><button className="secondary" onClick={()=>moveSelected(-1)} disabled={games.findIndex(g=>g.source_game_id===selectedGame.source_game_id)===0}>← Previous game</button><button className="secondary" onClick={()=>moveSelected(1)} disabled={games.findIndex(g=>g.source_game_id===selectedGame.source_game_id)===games.length-1}>Next game →</button></div>
      <div className="score-grid"><label>{selectedGame.away_team} score<input autoFocus style={inputStyle} type="number" min="0" value={form.away_score} onChange={e=>setForm({...form,away_score:e.target.value})}/></label><label>{selectedGame.home_team} score<input style={inputStyle} type="number" min="0" value={form.home_score} onChange={e=>setForm({...form,home_score:e.target.value})}/></label></div>
      {(selectedGame.closing_spread_points!=null||selectedGame.closing_over_under_line!=null)&&<div className="editor-meta"><span>ESPN closing line · {selectedGame.closing_provider||"Sportsbook"}</span><b>{selectedGame.closing_spread_points==null?"Spread unavailable":selectedGame.closing_spread_points===0?"Pick’em":(selectedGame.closing_spread_points>0?selectedGame.home_team:selectedGame.away_team)+" -"+Math.abs(Number(selectedGame.closing_spread_points))} · O/U {selectedGame.closing_over_under_line??"—"}</b></div>}
      <div className="form-grid"><label>Manual favorite team<select style={inputStyle} value={form.favorite_team} onChange={e=>setForm({...form,favorite_team:e.target.value})}><option value="">No favorite</option><option value={selectedGame.away_team}>{selectedGame.away_team}</option><option value={selectedGame.home_team}>{selectedGame.home_team}</option><option value="PK">Pick’em (PK)</option></select></label><label>Manual spread (points)<input style={inputStyle} type="number" min="0" step="0.5" value={form.favorite_spread} disabled={form.favorite_team==="PK"} onChange={e=>setForm({...form,favorite_spread:e.target.value})} placeholder="e.g. 3.5"/></label><label className="full">Manual over/under line<input style={inputStyle} type="number" min="0" step="0.5" value={form.over_under_line} onChange={e=>setForm({...form,over_under_line:e.target.value})} placeholder="e.g. 44.5"/></label></div>
      {form.favorite_team==="PK"&&<p className="muted">Pick’em · spread is automatically zero.</p>}
      <div className="editor-meta"><span>Actual game total (from scores)</span><b>{form.away_score!==""&&form.home_score!==""?Number(form.away_score)+Number(form.home_score):"—"}</b></div>
      <button style={{...buttonStyle,width:"100%",marginTop:16}} disabled={busy} onClick={saveGame}>{busy?"Saving…":"Save Game Results & Lines"}</button>
    </section></div>}
    {showNew&&<div className="modal-backdrop" onClick={()=>setShowNew(false)}><form className="modal" onSubmit={createGame} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MANUAL ENTRY</span><h2>Add New Game</h2></div><button type="button" className="close" onClick={()=>setShowNew(false)}>×</button></div>
      <div className="form-grid">
        <label>Season<input style={inputStyle} type="number" value={newGame.season} onChange={e=>setNewGame({...newGame,season:e.target.value})} required/></label><label>Game type<select style={inputStyle} value={newGame.game_type} onChange={e=>setNewGame({...newGame,game_type:e.target.value})} required><option value="">Select game type</option><option value="regular season">Regular Season</option><option value="playoffs">Playoffs</option></select></label>
        <label>Date<input style={inputStyle} type="date" value={newGame.game_date} onChange={e=>setNewGame({...newGame,game_date:e.target.value})} required/></label><label>Time<input style={inputStyle} type="time" value={newGame.game_time} onChange={e=>setNewGame({...newGame,game_time:e.target.value})}/></label>
        <label>Away team<select style={inputStyle} value={newGame.away_team} onChange={e=>setNewGame({...newGame,away_team:e.target.value,favorite_team:e.target.value===newGame.favorite_team||newGame.home_team===newGame.favorite_team?newGame.favorite_team:""})} required><option value="">Select away team</option>{Object.keys(teamAssets).sort().map(name=><option key={name} value={name}>{name}</option>)}</select></label><label>Home team<select style={inputStyle} value={newGame.home_team} onChange={e=>setNewGame({...newGame,home_team:e.target.value,favorite_team:e.target.value===newGame.favorite_team||newGame.away_team===newGame.favorite_team?newGame.favorite_team:""})} required><option value="">Select home team</option>{Object.keys(teamAssets).sort().map(name=><option key={name} value={name}>{name}</option>)}</select></label>
        <label>Favorite team<select style={inputStyle} value={newGame.favorite_team} onChange={e=>setNewGame({...newGame,favorite_team:e.target.value})}><option value="">No favorite</option>{[newGame.away_team,newGame.home_team].filter(Boolean).map(name=><option key={name} value={name}>{name}</option>)}<option value="PK">Pick’em (PK)</option></select></label>
        <label>Spread (points)<input style={inputStyle} type="number" min="0" step="0.5" value={newGame.favorite_spread} disabled={newGame.favorite_team==="PK"} onChange={e=>setNewGame({...newGame,favorite_spread:e.target.value})} placeholder="e.g. 3.5"/></label>
        <label className="full">Over/under total<input style={inputStyle} type="number" min="0" step="0.5" value={newGame.over_under_line} onChange={e=>setNewGame({...newGame,over_under_line:e.target.value})} placeholder="e.g. 44.5"/></label>
      </div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowNew(false)}>Cancel</button><button style={buttonStyle} disabled={busy}>{busy?"Creating…":"Create Game"}</button></div></form></div>}
  </main>;
}
