"use client";

import Link from "next/link";

const sections = [
  { title: "Start here: Overview", icon: "🏈", purpose: "Your front page. It gives you the quick picture of what is happening across the NFL data in the app.", read: ["Look for the big-picture numbers first. They summarize the games currently included in your filters.", "Use it to spot something interesting, then open the page that explains that subject in more detail."], takeaway: "Think of this as the front page of a newspaper. It tells you where to look next." },
  { title: "Games", icon: "📅", purpose: "The game pages let you look at actual matchups and final scores.", pages: [
    ["Game Tracker", "The list of games. It is the place to check dates, matchups, scores, and game status. The current season is the working area for game updates."],
    ["Matchup Analyzer", "Puts two teams side by side and shows how they have done against each other in their past meetings. Old games are clues, not promises about the next game."],
    ["Game Drill-Down", "Opens the actual games behind a number. If a team has a certain record or trend, this page helps you see which games made that number."]
  ], takeaway: "These pages show what happened on the field. They are the ingredients used by the other pages." },
  { title: "Teams", icon: "🛡️", purpose: "These pages help you understand how teams score, win, and perform.", pages: [
    ["Team Performance", "A report card for each team. W-L-T means wins, losses, and ties. Win % is how often the team wins. Home and away splits show whether it performs differently at home or on the road. PF/G is points scored per game; PA/G is points allowed per game."],
    ["Points", "A closer look at scoring. Use it to compare how many points teams put on the board and how many they give up."]
  ], takeaway: "A team that scores a lot and allows few points is generally playing well, but always check how many games are in the sample." },
  { title: "Betting", icon: "🎯", purpose: "These pages compare game results with the numbers set before the game. They do not just ask who won.", pages: [
    ["Against Spread", "ATS means 'against the spread.' The spread is a head start or handicap. If a team is favored by 3.5 points, it needs to win by 4 or more to cover. If it loses by fewer than 3.5 or wins, the underdog covers. A push is an exact tie with the spread."],
    ["Over/Under", "The total is the predicted combined score. If the line is 44.5 and both teams score 50 points combined, that is an Over. If they score 40, that is an Under. Landing exactly on a whole-number line is a push."]
  ], takeaway: "Winning the real game and covering the spread are two different things. A team can win but still fail to cover." },
  { title: "Predictions", icon: "🔮", purpose: "These pages show what the computer expects before a game, how it reached that view, and how well its guesses have done.", pages: [
    ["Predictions", "The model's forecast for upcoming games: projected score, chance each team wins, and confidence. A 70% win chance means the model thinks that team would win about 7 out of 10 similar situations—not that the win is guaranteed."],
    ["Model Performance", "The report card for the prediction model. Winner accuracy is how often it chose the winning team. ATS and Over/Under accuracy show how often those picks were right when a line was available. Margin/total error shows how far its score estimates were from the real result; smaller is better."],
    ["Why This Pick", "Shows the main clues behind one forecast, such as team strength (Elo), recent scoring, points allowed, and available quarterback, injury, or weather information. These are clues the model considered, not proof that one factor caused the pick."],
    ["Simulation Center", "Plays the matchup thousands of times on a computer using patterns from past prediction errors. It estimates how often each team wins, covers, or goes Over/Under, and shows a range of possible scores. It is a what-if tool, not thousands of real games and not a guarantee."],
    ["Market Predictions", "Shows the model's forecasts alongside the betting-market information and the model's historical testing/data inputs. Use it to compare the model's view with the market's view; a disagreement is something to investigate, not an automatic bet."]
  ], takeaway: "A prediction is a best estimate, not a fact. The performance page tells you whether the model has earned your trust over time." },
  { title: "Analytics", icon: "📊", purpose: "These pages search the historical game records for patterns. They describe the past; they do not know what will happen next.", pages: [
    ["Trend Finder", "Ranks teams by a selected recent pattern—such as winning, covering the spread, or going Over. You can choose the last 5, 10, 20, or all games. The sample count matters: a trend over 5 games is much less evidence than one over 50."],
    ["Season Trends", "Compares seasons with each other, including home/away wins, favorite spread results, totals, and average combined score."],
    ["Streak Tracker", "Shows teams currently winning, losing, covering, or going Over/Under in a row, plus their longest streak in the selected history."],
    ["Market Insights", "Looks at how betting lines and market outcomes have behaved in the historical games. It can help show where market expectations have or have not matched results."],
    ["Situational Trends", "Breaks results into situations—such as home/away, favorite/underdog, or opponent type—so you can see whether performance changes in different settings."],
    ["Performance Insights", "Collects broader historical performance findings into a more readable view. Treat any pattern as a clue to investigate, not a rule that will always hold."]
  ], takeaway: "A pattern is more useful when it repeats over lots of games. A small sample can fool you." }
];

const glossary = [
  ["W-L-T", "Wins – Losses – Ties."],
  ["ATS", "Against the spread: did the team beat the handicap, not just win the game?"],
  ["O/U", "Over/Under: did the combined points finish above or below the total line?"],
  ["Favorite / Underdog", "The favorite is expected to win; the underdog is expected to lose. The spread shows the size of that expectation."],
  ["Elo", "A team-strength score. Beating a strong team usually helps more than beating a weak one; losing to a weak team usually hurts more."],
  ["Win probability", "The model's estimated chance of winning, written as a percentage."],
  ["Confidence", "A label for how strongly the model leans toward its pick. It is not a promise and should be judged against past results."],
  ["Backtest / walk-forward test", "A pretend test of the model on old games, while only letting it use information that would have been available before each game."],
  ["Calibration", "Checks whether probabilities match reality. If forecasts labeled 70% win about 70% of the time, they are well calibrated in that group."],
  ["MAE / error", "Average size of the model's miss. For example, a 6-point margin error means its predicted winning margin was off by 6 points on average. Lower is better."],
  ["Brier score / log loss", "Ways to grade probability forecasts. Lower is better; they reward probabilities that are both accurate and sensible."],
  ["Sample size", "How many games support a number. Always look at this before trusting a percentage."],
  ["Residual", "The difference between what the model predicted and what actually happened. Simulations reuse historical misses to create a range of possible outcomes."]
];

export default function PlainEnglishGuide() {
  return <main className="guide-shell">
    <style jsx>{`
      .guide-shell{min-height:100vh;background:#0b1420;color:#edf3fa;padding:28px 18px 80px;font-family:inherit}
      .guide-wrap{max-width:1040px;margin:0 auto}
      .guide-top{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:26px}
      .guide-back{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 15px;border:0;border-radius:8px;background:#e7b84e;color:#151b24;text-decoration:none;font:inherit;font-weight:800;cursor:pointer;transition:.16s ease}.guide-back:hover{background:#f0c65e}
      .guide-hero{padding:28px;border:1px solid #30445b;border-radius:18px;background:linear-gradient(135deg,#17283b,#101b2a);margin-bottom:22px}
      .eyebrow{color:#e8bd5a;font-size:12px;font-weight:900;letter-spacing:.12em}
      h1{font-size:clamp(30px,5vw,46px);line-height:1.08;margin:10px 0}
      .guide-hero p{font-size:17px;line-height:1.65;color:#c4d0de;max-width:760px;margin:0}
      .guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      .guide-card,.glossary-card{background:#111e2d;border:1px solid #2c4056;border-radius:15px;padding:20px;min-width:0}
      .guide-card h2,.glossary-card h2{font-size:21px;margin:0 0 9px}
      .guide-card p{color:#c5d0dc;line-height:1.55;margin:8px 0}
      .guide-card ul{padding-left:20px;margin:12px 0;color:#d9e2ec}
      .guide-card li{margin:10px 0;line-height:1.5}
      .guide-card b{color:#fff}
      .takeaway{border-left:3px solid #e8bd5a;background:#1a2a3b;padding:12px 14px;border-radius:0 9px 9px 0;margin-top:15px;color:#fff;line-height:1.5}
      .guide-section-title{font-size:25px;margin:30px 0 14px}
      .glossary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .term{padding:13px 14px;border-radius:11px;background:#111e2d;border:1px solid #2c4056}
      .term b{display:block;color:#f0c35d;margin-bottom:4px}
      .term span{color:#c8d3df;line-height:1.45}
      .rule{margin-top:18px;padding:18px;border-radius:14px;background:#18283a;border:1px solid #38506a;color:#d7e2ed;line-height:1.6}
      @media(max-width:700px){.guide-grid,.glossary{grid-template-columns:1fr}.guide-shell{padding:18px 12px 60px}.guide-hero{padding:21px}.guide-top{align-items:flex-start}.guide-card{padding:17px}}
    `}</style>
    <div className="guide-wrap">
      <div className="guide-top"><Link className="guide-back" href="/">← Back to NFL Vegas Tracker</Link><span className="eyebrow">PLAIN-ENGLISH GUIDE</span></div>
      <header className="guide-hero"><span className="eyebrow">NO FOOTBALL MATH DEGREE REQUIRED</span><h1>What Does This Mean?</h1><p>Think of this app as a big football notebook. It remembers games, compares teams, studies betting lines, and makes guesses about future games. This guide explains what each page is trying to tell you—in everyday language.</p></header>
      <div className="guide-grid">{sections.map(section=><section className="guide-card" key={section.title}>
        <h2>{section.icon} {section.title}</h2><p>{section.purpose}</p>
        {section.pages&&<ul>{section.pages.map(([name,description])=><li key={name}><b>{name}:</b> {description}</li>)}</ul>}
        {section.read&&<ul>{section.read.map(line=><li key={line}>{line}</li>)}</ul>}
        <div className="takeaway"><b>In simple terms:</b> {section.takeaway}</div>
      </section>)}</div>
      <h2 className="guide-section-title">The football-stat dictionary</h2>
      <div className="glossary">{glossary.map(([term,definition])=><div className="term" key={term}><b>{term}</b><span>{definition}</span></div>)}</div>
      <div className="rule"><b>Three rules that will save you from being fooled:</b><br/>1. A 75% prediction can still lose. It means 3 times out of 4 in similar situations, not every time.<br/>2. Always check how many games are behind a percentage. Five games is a tiny sample; hundreds tell us much more.<br/>3. Past patterns and computer simulations are tools for thinking, not crystal balls. Use them with the actual matchup, current information, and a little common sense.</div>
      <p style={{textAlign:"center",color:"#8fa1b5",fontSize:13,marginTop:24}}>This guide explains the app's numbers; it does not turn forecasts into guarantees.</p>
    </div>
  </main>;
}
