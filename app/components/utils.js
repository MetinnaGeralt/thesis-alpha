// app/components/utils.js
// Auto-extracted from page.js — pure functions, no React, no JSX
import { METRICS, METRIC_MAP } from './constants';

// ═══ LOCAL STORAGE ═══
function ldS(k){try{var r=localStorage.getItem(k);return Promise.resolve(r?JSON.parse(r):null)}catch(e){return Promise.resolve(null)}}
function svS(k,d){try{localStorage.setItem(k,JSON.stringify(d))}catch(e){}return Promise.resolve()}

// ═══ CACHE ═══
var _cache={};var CACHE_TTL=3600000;
function cacheGet(k){var e=_cache[k];if(!e)return null;if(Date.now()-e.t>CACHE_TTL){delete _cache[k];return null}return e.d}
function cacheSet(k,d){_cache[k]={d:d,t:Date.now()};return d}

// ═══ TEXT UTILITIES ═══
function xJSON(text){if(!text)throw new Error("empty");var c=text.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();var d=0,s=-1;
  for(var i=0;i<c.length;i++){if(c[i]==="{"){if(d===0)s=i;d++}else if(c[i]==="}"){d--;if(d===0&&s>=0)return JSON.parse(c.substring(s,i+1))}}throw new Error("No JSON")}
function stripCite(s){if(!s)return s;return s.replace(/<\/?cite[^>]*>/gi,"").replace(/<\/?antml:cite[^>]*>/gi,"").trim()}
// Auto-format text: capitalize sentences, fix spacing, clean up
function autoFormat(text){if(!text)return text;
  var s=text.trim();
  // Fix multiple spaces
  s=s.replace(/  +/g," ");
  // Fix multiple newlines
  s=s.replace(/\n{3,}/g,"\n\n");
  // Capitalize after sentence endings
  s=s.replace(/(^|[.!?]\s+)([a-z])/g,function(m,p,c){return p+c.toUpperCase()});
  // Capitalize first character
  s=s.charAt(0).toUpperCase()+s.slice(1);
  // Fix standalone "i " -> "I "
  s=s.replace(/(^|\s)i(\s|'|$)/g,function(m,b,a){return b+"I"+a});
  // Add period at end if missing
  s=s.replace(/([a-zA-Z0-9%])$/,"$1.");
  // Fix spacing after commas
  s=s.replace(/,([^\s])/g,", $1");
  // Clean up dash spacing
  s=s.replace(/\s*-\s*/g," — ");
  // Format paragraphs nicely
  var paras=s.split(/\n\n+/);
  return paras.map(function(p){return p.trim()}).filter(function(p){return p}).join("\n\n")}

// ═══ SCORING ═══
function calcOwnerScore(cos){
  var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
  if(portfolio.length===0)return{total:0,breakdown:{thesis:0,kpi:0,journal:0,conviction:0,moat:0,balance:0},max:100};
  // 1. Thesis completeness (20 pts)
  var thesisP=0;portfolio.forEach(function(c){var score=0;
    if(c.thesisNote&&c.thesisNote.length>20)score+=1;
    if(c.thesisNote&&(c.thesisNote.indexOf("## CORE")>=0||c.thesisNote.length>200))score+=1;
    if(c.thesisNote&&(c.thesisNote.indexOf("## MOAT")>=0||c.thesisNote.indexOf("moat")>=0))score+=1;
    if(c.thesisNote&&(c.thesisNote.indexOf("## RISKS")>=0||c.thesisNote.indexOf("risk")>=0))score+=1;
    if(c.thesisNote&&(c.thesisNote.indexOf("## SELL")>=0||c.thesisNote.indexOf("sell")>=0))score+=1;
    if(c.thesisVersions&&c.thesisVersions.length>1)score+=1;
    // Conviction drift penalty: conviction not updated in 120+ days
    if(c.conviction>0&&c.convictionHistory&&c.convictionHistory.length>0){var lastCH=c.convictionHistory[c.convictionHistory.length-1];var chAge=lastCH.date?Math.ceil((new Date()-new Date(lastCH.date))/864e5):999;if(chAge>120)score=Math.max(0,score-1)}
    // Staleness penalty: decay 1pt per 90 days without update
    if(c.thesisNote&&c.thesisUpdatedAt){var ageDays=Math.ceil((new Date()-new Date(c.thesisUpdatedAt))/864e5);if(ageDays>180)score=Math.max(0,score-2);else if(ageDays>90)score=Math.max(0,score-1)}
    thesisP+=Math.min(score,6)});
  thesisP=Math.round(thesisP/portfolio.length/6*20);
  // 2. KPI discipline (20 pts)
  var kpiP=0;portfolio.forEach(function(c){var score=0;
    if(c.kpis&&c.kpis.length>=2)score+=2;if(c.kpis&&c.kpis.length>=4)score+=1;
    var tracked=(c.kpis||[]).filter(function(k){return k.lastResult}).length;
    if(tracked>0)score+=2;if(c.earningsHistory&&c.earningsHistory.length>=2)score+=1;
    kpiP+=Math.min(score,5)});
  kpiP=Math.round(kpiP/portfolio.length/5*20);
  // 3. Journal consistency (20 pts)
  var jrnP=0;portfolio.forEach(function(c){var score=0;
    var decs=c.decisions||[];if(decs.length>=1)score+=2;if(decs.length>=3)score+=1;
    var withReason=decs.filter(function(d){return d.reasoning&&d.reasoning.length>10}).length;if(withReason>=1)score+=1;
    var withOutcome=decs.filter(function(d){return d.outcome}).length;if(withOutcome>=1)score+=1;
    jrnP+=Math.min(score,5)});
  jrnP=Math.round(jrnP/portfolio.length/5*20);
  // 4. Conviction hygiene (15 pts)
  var convP=0;portfolio.forEach(function(c){var score=0;
    if(c.conviction>0)score+=2;if(c.convictionHistory&&c.convictionHistory.length>=2)score+=2;
    var lastConv=c.convictionHistory&&c.convictionHistory.length?c.convictionHistory[c.convictionHistory.length-1]:null;
    if(lastConv&&lastConv.biasFlags)score+=1;
    convP+=Math.min(score,5)});
  convP=Math.round(convP/portfolio.length/5*15);
  // 5. Moat vigilance (10 pts)
  var moatP=0;portfolio.forEach(function(c){var score=0;var mt=c.moatTypes||{};
    var active=Object.keys(mt).filter(function(k){return mt[k]&&mt[k].active}).length;
    if(active>=1)score+=2;if(active>=2)score+=1;
    if(c.morningstarMoat)score+=1;if(c.moatTrend)score+=1;
    moatP+=Math.min(score,5)});
  moatP=Math.round(moatP/portfolio.length/5*10);
  // 6. Portfolio balance (15 pts)
  var balP=0;if(portfolio.length>=3)balP+=5;else if(portfolio.length>=2)balP+=3;
  var sectors={};portfolio.forEach(function(c){var s=c.sector||"Other";sectors[s]=(sectors[s]||0)+1});
  var maxConc=Math.max.apply(null,Object.values(sectors).length?Object.values(sectors):[1])/Math.max(portfolio.length,1);
  if(maxConc<=0.4)balP+=5;else if(maxConc<=0.6)balP+=3;
  var styles={};portfolio.forEach(function(c){if(c.investStyle)styles[c.investStyle]=1});
  if(Object.keys(styles).length>=2)balP+=5;else if(Object.keys(styles).length>=1)balP+=3;
  balP=Math.min(balP,15);
  var totalP=thesisP+kpiP+jrnP+convP+moatP+balP;
  return{total:totalP,breakdown:{thesis:thesisP,kpi:kpiP,journal:jrnP,conviction:convP,moat:moatP,balance:balP},max:100}}
function classifyPortfolio(portfolio){
  if(!portfolio||portfolio.length===0)return{summary:"",color:"#a0a0a0"};
  // ── Per-company signal extraction (position-weighted) ─────────────────
  var wGrowth=0,wYield=0,wROIC=0,wGrossMargin=0,wPE=0;
  var growthN=0,yieldN=0,roicN=0,marginN=0,peN=0;
  portfolio.forEach(function(c){
    var pos=c.position||{};
    var w=Math.max((pos.shares||0)*(pos.currentPrice||0),1);
    var snap=c.financialSnapshot||{};
    if(snap.revGrowth&&snap.revGrowth.numVal!=null){wGrowth+=snap.revGrowth.numVal*w;growthN+=w}
    var dps=c.divPerShare||c.lastDiv||0;
    var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
    var divYld=pos.currentPrice>0?(dps*mult/pos.currentPrice*100):0;
    if(divYld>=1.5){wYield+=divYld*w;yieldN+=w}
    if(snap.roic&&snap.roic.numVal!=null){wROIC+=snap.roic.numVal*w;roicN+=w}
    if(snap.grossMargin&&snap.grossMargin.numVal!=null){wGrossMargin+=snap.grossMargin.numVal*w;marginN+=w}
    if(snap.pe&&snap.pe.numVal!=null&&snap.pe.numVal>0&&snap.pe.numVal<100){wPE+=snap.pe.numVal*w;peN+=w}
  });
  var avgGrowth = growthN>0 ? wGrowth/growthN   : null;
  var avgYield  = yieldN>0  ? wYield/yieldN      : 0;
  var avgROIC   = roicN>0   ? wROIC/roicN        : null;
  var avgMargin = marginN>0 ? wGrossMargin/marginN : null;
  var avgPE     = peN>0     ? wPE/peN            : null;
  var n=portfolio.length;
  var divPayerCount=portfolio.filter(function(c){
    var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;
    var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
    return pos.currentPrice>0&&(dps*mult/pos.currentPrice*100)>=1.5}).length;
  var divFraction=divPayerCount/n;
  // ── Derive boolean signals ─────────────────────────────────────────────
  var isConcentrated = n<=5;
  var isHighGrowth   = avgGrowth!==null && avgGrowth>=18;
  var isMidGrowth    = avgGrowth!==null && avgGrowth>=9 && avgGrowth<18;
  var isLowGrowth    = avgGrowth!==null && avgGrowth<9;
  var isQuality      = (avgROIC!==null&&avgROIC>=15)||(avgMargin!==null&&avgMargin>=40);
  var isDeepIncome   = avgYield>=3.5 && divFraction>=0.5;
  var isDivGrowth    = avgYield>=2.0 && divFraction>=0.4 && !isHighGrowth;
  var isValue        = avgPE!==null && avgPE<15 && !isHighGrowth && !isMidGrowth;
  var hasData        = growthN>0||roicN>0||marginN>0;
  // investStyle tiebreaker (no financial data)
  var styleCounts={};
  portfolio.forEach(function(c){var s=c.investStyle||"";if(s)styleCounts[s]=(styleCounts[s]||0)+1});
  var topStyle=Object.keys(styleCounts).sort(function(a,b){return styleCounts[b]-styleCounts[a]})[0]||"";
  // ── Build sentence from stacked signals ────────────────────────────────
  // Part 1: concentration prefix
  var conc = isConcentrated ? "Concentrated, " : (n>=10 ? "Diversified, " : "");
  // Part 2: core style (the most honest signal we have)
  var core, color;
  if(isQuality && isHighGrowth){core="high-growth quality compounder";color="#22C55E";}
  else if(isQuality && isMidGrowth){core="quality compounder";color="#22C55E";}
  else if(isQuality && isDeepIncome){core="quality income portfolio";color="#4ade80";}
  else if(isQuality){core="quality-focused portfolio";color="#22C55E";}
  else if(isHighGrowth){core="growth-oriented portfolio";color="#6ea8fe";}
  else if(isDeepIncome && isLowGrowth){core="income-focused portfolio";color="#fbbf24";}
  else if(isDivGrowth && isMidGrowth){core="dividend-growth portfolio";color="#4ade80";}
  else if(isDivGrowth){core="income & growth portfolio";color="#a3e635";}
  else if(isMidGrowth){core="balanced growth portfolio";color="#6ea8fe";}
  else if(isValue){core="value-oriented portfolio";color:"#f87171";color="#f87171";}
  else if(!hasData){
    // fall back to style tags
    var styleMap={"growth":"growth-oriented","aggressive":"high-growth","quality":"quality-focused","compounder":"quality compounder","value":"value-oriented","income":"income-focused","dividend":"dividend-income"};
    core=(styleMap[topStyle]||"balanced")+" portfolio";color="#a0a0a0";}
  else{core="balanced portfolio";color="#a0a0a0";}
  // Part 3: optional modifier (avoids redundancy with core)
  var mod="";
  if(isDivGrowth&&!core.includes("dividend")&&!core.includes("income")){mod=", with growing dividends";}
  else if(isDeepIncome&&!core.includes("income")&&avgYield>0){mod=", income-generating";}
  else if(avgGrowth!==null&&avgGrowth>=25&&!core.includes("high-growth")){mod=", high-growth";}
  // Capitalise first letter
  var sentence=(conc+core+mod).trim();
  sentence=sentence.charAt(0).toUpperCase()+sentence.slice(1);
  return{summary:sentence,color:color,label:core}
}
function calcMastery(c){
  var d={added:true,thesis:false,tracked:false,monitored:false,disciplined:false,mastered:false};
  // Star 2: Thesis written (core + at least 1 section)
  if(c.thesisNote&&c.thesisNote.trim().length>30){var hasSec=c.thesisNote.indexOf("## MOAT")>=0||c.thesisNote.indexOf("## RISKS")>=0||c.thesisNote.indexOf("## SELL")>=0;if(hasSec)d.thesis=true}
  // Star 3: KPIs defined + conviction rated
  if(c.kpis&&c.kpis.length>=2&&c.conviction>0)d.tracked=true;
  // Star 4: Earnings checked + moat classified
  var mt=c.moatTypes||{};var hasMoat=Object.keys(mt).some(function(k){return mt[k]&&mt[k].active});
  if(c.earningsHistory&&c.earningsHistory.length>=1&&hasMoat)d.monitored=true;
  // Star 5: Decision logged + thesis reviewed within 90 days
  var fresh=c.thesisUpdatedAt&&Math.ceil((new Date()-new Date(c.thesisUpdatedAt))/864e5)<90;
  if(c.decisions&&c.decisions.length>=1&&fresh)d.disciplined=true;
  // Star 6: 3+ quarters earnings, 3+ conviction updates, fresh thesis
  if(c.earningsHistory&&c.earningsHistory.length>=3&&c.convictionHistory&&c.convictionHistory.length>=3&&fresh)d.mastered=true;
  var stars=1;if(d.thesis)stars=2;if(d.thesis&&d.tracked)stars=3;if(stars>=3&&d.monitored)stars=4;if(stars>=4&&d.disciplined)stars=5;if(stars>=5&&d.mastered)stars=6;
  var lb=["Added","Thesis","Tracked","Monitored","Disciplined","Mastered"];
  var cl=["#6B7280","#3B82F6","#F59E0B","#EC4899","#8B5CF6","#22C55E"];
  return{stars:stars,max:6,label:lb[stars-1],color:cl[stars-1],pct:Math.round(stars/6*100),details:d}}


// ═══ METRIC RESOLUTION ═══
var LEGACY_MAP={};METRICS.forEach(function(m){LEGACY_MAP[m.label.toLowerCase()]=m.id});
var _la={"revenue growth":"revGrowth","eps growth":"epsGrowth","gross margin":"grossMargin","operating margin":"opMargin","net margin":"netMargin","fcf margin":"fcfMargin","free cash flow margin":"fcfMargin","r&d margin":"rndMargin","r&d to revenue":"rndMargin","sga margin":"sgaMargin","sga to revenue":"sgaMargin","return on equity":"roe","return on assets":"roa","return on invested capital":"roic","p/e":"pe","pe ratio":"pe","p/e ratio":"pe","p/b":"pb","price to book":"pb","p/s":"ps","price to sales":"ps","ev/ebitda":"evEbitda","ev/fcf":"evFcf","ev/revenue":"evRevenue","peg":"peg","peg ratio":"peg","current ratio":"currentRatio","quick ratio":"quickRatio","debt to equity":"debtEquity","debt/equity":"debtEquity","d/e ratio":"debtEquity","net debt/ebitda":"netDebtEbitda","interest coverage":"interestCoverage","dividend yield":"divYield","book value per share":"bvps","free cash flow":"fcfPerShare","fcf":"fcfPerShare","fcf yield":"fcfYield","fcf per share":"fcfPerShare","revenue per share":"revPerShare","ebitda":"ebitdaPerShare","ebitda margin":"ebitdaPerShare","rev/share":"revPerShare","revenue growth yoy":"revGrowth","eps growth yoy":"epsGrowth","shareholder yield":"shareholderYield","total shareholder yield":"shareholderYield","buyback yield":"buybackYield","graham number":"grahamNum","graham":"grahamNum","vs graham":"grahamDiscount"};
Object.keys(_la).forEach(function(k){LEGACY_MAP[k]=_la[k]});
function resolveMetricId(kpi){if(kpi.metricId)return kpi.metricId;var n=kpi.name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return LEGACY_MAP[n]||null}
function isCustomKpi(name){if(METRIC_MAP[name])return false;var n=name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return!LEGACY_MAP[n]}

// ═══ TICKER HELPERS ═══
function toFinnhubSymbol(ticker){
  var SUFFIX_MAP={".TO":":TSX",".V":":TSXV",".L":":LSE",".DE":":XETRA",".PA":":EPA",
    ".AS":":ENXTAM",".HK":":HKEX",".AX":":ASX",".NS":":NSE",".BO":":BSE",
    ".MI":":XMIL",".MC":":XMAD",".SW":":SWX",".ST":":STO",".OL":":OSLO",
    ".CO":":CPH",".HE":":HEL",".BR":":ENXTBR",".LS":":ENXTLS",".AT":":XATH",
    ".NZ":":NZX"};
  var t=ticker.toUpperCase();
  for(var sfx in SUFFIX_MAP){if(t.endsWith(sfx))return t.slice(0,t.length-sfx.length)+SUFFIX_MAP[sfx]}
  return ticker}
// Detect if a ticker is non-US (has exchange suffix)
function isIntlTicker(ticker){return /\.(TO|V|L|DE|PA|AS|HK|AX|NS|BO|MI|MC|SW|ST|OL|CO|HE|BR|LS|AT|NZ)$/i.test(ticker)}

// ═══ DIVIDEND HELPERS ═══
function estimatePayMonths(c){
  var freq=c.divFrequency||"quarterly";
  if(freq==="monthly")return[0,1,2,3,4,5,6,7,8,9,10,11];
  if(freq==="none")return[];
  // Use actual ex-div date if available — most accurate
  if(c.exDivDate&&c.exDivDate!=""){
    var exM=new Date(c.exDivDate).getMonth();
    // Advance to a future or recent ex-div (dates can be stale)
    if(freq==="annual")return[exM];
    if(freq==="semi")return[exM,(exM+6)%12];
    // Quarterly: derive cycle from last known ex-div month
    return[exM,(exM+3)%12,(exM+6)%12,(exM+9)%12]}
  // No ex-div date: use ticker hash to spread companies across cycles
  // so not every unknown payer lands in the same 3 months
  if(freq==="annual")return[5]; // June default
  if(freq==="semi")return[2,8]; // Mar/Sep default
  // Quarterly: pick cycle based on ticker first char to spread load
  var t=c.ticker||"A";var code=t.charCodeAt(0);var offset=code%3; // 0,1,2
  return[offset,(offset+3)%12,(offset+6)%12,(offset+9)%12]}

// ═══ SMALL UTILS ═══
var dU=function(d){if(!d||d==="TBD")return 999;return Math.ceil((new Date(d)-new Date())/864e5)};
var fD=function(d){try{return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch(e){return d}};
var fT=function(ts){if(!ts)return"";var d=new Date(ts);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})};
var nId=function(a){return a.length?Math.max.apply(null,a.map(function(x){return x.id}))+1:1};
function gH(kpis){var ev=kpis.filter(function(k){return k.lastResult});if(!ev.length)return{l:"Pending",c:"#6B7280"};var m=ev.filter(function(k){return k.lastResult.status==="met"}).length;var p=Math.round(m/ev.length*100);return p>=80?{l:"Strong",c:"#22C55E"}:p>=50?{l:"Mixed",c:"#F59E0B"}:{l:"Weak",c:"#EF4444"}}
var bT=function(r,v,u){return(r==="gte"?"≥":r==="lte"?"≤":"=")+" "+v+(u||"")};
var eS=function(r,t,a){var n=parseFloat(a);if(isNaN(n))return"unclear";return r==="gte"?(n>=t?"met":"missed"):r==="lte"?(n<=t?"met":"missed"):(n===t?"met":"missed")};



// ── Shared analysis utilities ──

function fmtBig(v,pct){if(v==null||isNaN(v))return"—";if(pct)return(v*100).toFixed(1)+"%";
  var neg=v<0;var a=Math.abs(v);var s;if(a>=1e12)s=(a/1e12).toFixed(1)+"T";else if(a>=1e9)s=(a/1e9).toFixed(2)+"B";else if(a>=1e6)s=(a/1e6).toFixed(1)+"M";else if(a>=1e3)s=(a/1e3).toFixed(1)+"K";else s=Math.abs(v)<100?v.toFixed(2):a.toFixed(0);return(neg?"-":"")+"$"+s}

function getValMetricValue(vm,snap,price,company){
  if(vm.calc){var v=vm.calc(snap,price,company);return v}
  if(vm.snap&&snap[vm.snap]){var sv=snap[vm.snap];return sv.numVal!=null?sv.numVal:parseFloat(String(sv.value).replace(/[^0-9.\-]/g,""))||null}
  return null}

function buildPrompt(type, c){
  var p=c.position||{};
  var ticker=c.ticker||"this company";
  var name=c.name||ticker;
  var _parsedThesis=parseThesis(c.thesisNote);
  var thesis=c.thesisNote||"No thesis written yet.";
  var thesisMoat=_parsedThesis.moat||"";
  var thesisRisk=_parsedThesis.risks||"";
  var thesisSell=_parsedThesis.sell||"";
  var conviction=c.conviction||0;
  var sector=c.sector||"Unknown sector";
  var style=(c.investStyle||"").replace(/_/g," ");
  var kpis=(c.kpis||[]).map(function(k){return"- "+k.label+(k.target?" (target: "+k.target+(k.unit||"")+")":"")+(k.results&&k.results.length>0?" — last result: "+k.results[k.results.length-1].value:"")}).join("\n")||"No KPIs defined yet.";
  var decisions=(c.decisions||[]).slice(-8).map(function(d){return"["+d.date+"] "+d.action.toUpperCase()+": "+(d.reasoning||"No reasoning logged")}).join("\n")||"No decisions logged.";
  var journal=(c.journalEntries||[]).slice(-5).map(function(e){return"["+((e.date||e.createdAt)||"").slice(0,10)+"] "+(e.title?e.title+": ":"")+((e.content||"").slice(0,300))}).join("\n")||"No journal entries yet.";
  var convHistory=(c.convictionHistory||[]).slice(-6).map(function(h){return h.date.slice(0,10)+" → "+(h.rating||h.score||0)+"/10"+(h.note?" ("+h.note+")":"")}).join("\n")||("Current: "+conviction+"/10");
  var posSize=p.shares>0&&p.currentPrice>0?(p.shares*p.currentPrice).toFixed(0):"unknown";
  var earnDate=c.earningsDate?c.earningsDate:"unknown date";
  var monthsHeld=p.purchaseDate?Math.round((Date.now()-new Date(p.purchaseDate))/(1000*60*60*24*30))+" months":"unknown duration";

  if(type==="challenge"){
return"You are a rigorous investment analyst. I am not asking for general research on "+ticker+". I am asking you to challenge MY specific investment case using only my own words below.\n\n--- MY INVESTMENT CONTEXT ---\n\nCompany: "+name+" ("+ticker+")\nSector: "+sector+"\nInvestment style: "+style+"\nConviction: "+conviction+"/10\nPosition held for: "+monthsHeld+"\n\nMY THESIS:\n"+thesis+"\n\nMY MOAT ARGUMENT:\n"+(thesisMoat||"Not written.")+"\n\nRISKS I HAVE ACKNOWLEDGED:\n"+(thesisRisk||"Not written.")+"\n\nMY SELL CRITERIA:\n"+(thesisSell||"Not written.")+"\n\nKPIs I TRACK:\n"+kpis+"\n\nRECENT DECISIONS:\n"+decisions+"\n\n--- YOUR TASK ---\n\n1. Identify the 3 weakest assumptions in my thesis above. Be specific — reference my own words.\n2. Present the strongest possible bear case. What do I most likely have wrong?\n3. List 3 questions I should be able to answer confidently but probably cannot.\n4. Rate my thesis quality 1–10 and explain exactly what would make it stronger.\n\nBe direct. Be uncomfortable. That is the point.";
  }
  if(type==="earnings"){
return"You are a focused investment analyst preparing a pre-earnings briefing.\n\nIMPORTANT: This is not a generic earnings preview. I want a briefing tailored entirely to my investment thesis and the specific metrics I track.\n\n--- MY INVESTMENT CONTEXT ---\n\nCompany: "+name+" ("+ticker+")\nEarnings date: "+earnDate+"\nMy conviction: "+conviction+"/10\nPosition value: $"+posSize+"\n\nMY THESIS (why I own this):\n"+thesis+"\n\nTHE SPECIFIC KPIs I TRACK:\n"+kpis+"\n\nMY SELL CRITERIA:\n"+(thesisSell||"Not written.")+"\n\nRECENT DECISIONS:\n"+decisions+"\n\n--- YOUR TASK ---\n\n1. Based on MY thesis — not consensus estimates — what are the exact 2–3 numbers I must see to maintain conviction?\n2. What single question should I be listening for on the call that most investors will not think to ask?\n3. What result would force me to seriously revisit my sell criteria?\n4. What is the most likely way this earnings report could be misleading — strong headline numbers masking thesis deterioration?\n\nFocus only on what matters for my specific investment case. Ignore what does not.";
  }
  if(type==="annual"){
return"You are a disciplined long-term investor conducting an annual review. I need you to tell me honestly whether I should still own this.\n\n--- MY ORIGINAL INVESTMENT CASE ---\n\nCompany: "+name+" ("+ticker+")\nHeld for approximately: "+monthsHeld+"\nCurrent conviction: "+conviction+"/10\n\nORIGINAL THESIS:\n"+thesis+"\n\nORIGINAL MOAT ARGUMENT:\n"+(thesisMoat||"Not written.")+"\n\nORIGINAL SELL CRITERIA:\n"+(thesisSell||"Not written.")+"\n\n--- WHAT HAS HAPPENED ---\n\nCONVICTION HISTORY:\n"+convHistory+"\n\nDECISIONS (recent):\n"+decisions+"\n\nJOURNAL ENTRIES (recent):\n"+journal+"\n\nKPIs I TRACK:\n"+kpis+"\n\n--- YOUR TASK ---\n\n1. Based on my own words: is my original thesis intact, weakened, or broken? Be specific.\n2. What is the single most important thing that has changed since I invested?\n3. Am I holding for the right reasons, or showing signs of sunk cost bias? What evidence in my own notes points to which?\n4. If I did not already own this — knowing what I know now — would I buy it today at this price?\n5. What is the most important question I need to answer before my next annual review?\n\nBe honest. I can handle it.";
  }
  if(type==="bear"){
return"You are a short-seller conducting due diligence on a company I currently own.\n\nIMPORTANT: I believe in this investment. I am asking you to build the strongest possible case AGAINST it — not to make me sell, but to ensure I have genuinely stress-tested my position.\n\n--- MY INVESTMENT CONTEXT ---\n\nCompany: "+name+" ("+ticker+")\nSector: "+sector+"\nMy conviction: "+conviction+"/10\n\nMY BULL CASE (what I believe):\n"+thesis+"\n\nMY MOAT ARGUMENT:\n"+(thesisMoat||"Not written.")+"\n\nRISKS I HAVE ALREADY ACKNOWLEDGED:\n"+(thesisRisk||"None logged.")+"\n\n--- YOUR TASK ---\n\nBuild the most compelling bear case for "+ticker+". Structure it as follows:\n\n1. THE CORE BEAR THESIS — 2–3 sentences a short-seller would pitch to their fund.\n2. THE 3 FATAL FLAWS — attack my specific bull case arguments above.\n3. THE PATH TO -50% — what sequence of events gets us there from today?\n4. THE RED FLAGS I AM IGNORING — what signals am I likely rationalising away?\n5. THE QUESTIONS I CANNOT ANSWER — what would I need to disprove to sleep soundly?\n\nDo not be balanced. Be a bear. I already know the bull case.";
  }
  if(type==="sell"){
return"You are a trusted advisor helping me avoid an emotional investment decision.\n\nIMPORTANT: I am considering selling my position in "+ticker+". Before I act, I want you to challenge whether I am following my own investment framework or acting on emotion.\n\n--- MY INVESTMENT FRAMEWORK ---\n\nCompany: "+name+" ("+ticker+")\nCurrent conviction: "+conviction+"/10\nShares held: "+(p.shares||"unknown")+"\nHeld for: "+monthsHeld+"\n\nMY ORIGINAL THESIS:\n"+thesis+"\n\nMY SELL CRITERIA (written when I was calm and rational):\n"+(thesisSell||"No sell criteria written. This itself is a red flag.")+"\n\nRECENT DECISIONS AND REASONING:\n"+decisions+"\n\nRECENT JOURNAL ENTRIES:\n"+journal+"\n\n--- YOUR TASK ---\n\n1. Review my sell criteria above. Has any of them actually been triggered? Be specific — reference the criteria I wrote.\n2. What is the real reason I am likely considering selling — fear, boredom, recency bias, or a genuine thesis change? What evidence points to which?\n3. Ask me the 3 hardest questions I must answer honestly before I sell.\n4. If my sell criteria have NOT been triggered, what is the cost of selling early?\n5. What would a patient, rational investor do in this situation?\n\nHelp me think clearly — not feel better.";
  }
  if(type==="valuation"){
var price=p.currentPrice||0;var cost=p.avgCost||0;
return"You are a valuation analyst. I am not asking for a price target. I am asking you to stress-test the valuation assumptions embedded in my thesis.\n\n--- MY INVESTMENT CONTEXT ---\n\nCompany: "+name+" ("+ticker+")\nSector: "+sector+"\nCurrent price: $"+price.toFixed(2)+"\nMy average cost: $"+cost.toFixed(2)+"\nConviction: "+conviction+"/10\n\nMY THESIS AND MOAT ARGUMENT:\n"+thesis+"\n"+(thesisMoat?("\nMY MOAT ARGUMENT:\n"+thesisMoat):"")+"\n\nKPIs I TRACK:\n"+kpis+"\n\n--- YOUR TASK ---\n\n1. What implicit growth and margin assumptions must be true for the current price to be fair value? Spell them out.\n2. What is the most common valuation mistake investors make with this type of business?\n3. At what price would this become obviously cheap, and what assumptions would have to hold?\n4. What single financial metric would most change your view on fair value if it came in 20% below expectations?\n5. What does my thesis get right about the business that the market may be undervaluing?\n\nBe specific. Use the context I have given you.";
  }
  if(type==="macro"){
return"You are a macro risk analyst reviewing my single-stock investment through a top-down lens.\n\n--- MY INVESTMENT CONTEXT ---\n\nCompany: "+name+" ("+ticker+")\nSector: "+sector+"\nInvestment style: "+style+"\nConviction: "+conviction+"/10\n\nMY THESIS:\n"+thesis+"\n\nRISKS I HAVE ACKNOWLEDGED:\n"+(thesisRisk||"None logged.")+"\n\n--- YOUR TASK ---\n\n1. What are the 3 macro scenarios (rates, recession, FX, geopolitics, regulation) that would most damage this investment? Be specific to this sector and business model.\n2. Is my thesis explicitly or implicitly dependent on a particular macro environment continuing? Name the assumption.\n3. What would a 200bps rate move in either direction mean for this company specifically?\n4. What is the single biggest exogenous risk I appear to be ignoring?\n5. If I believe in this company's fundamentals but the macro turns against it — what is my playbook?\n\nFocus on risks I have not already named in my thesis.";
  }
  if(type==="initiation"){
return"You are a senior analyst writing an initiation memo. I am considering adding "+name+" ("+ticker+") to my portfolio.\n\nIMPORTANT: I want you to structure this as a rigorous buy/don't buy framework — not a price target, but a set of questions and thresholds I need to clear before committing capital.\n\n--- MY CONTEXT ---\n\nCompany: "+name+" ("+ticker+")\nSector: "+sector+"\nMy investment style: "+style+"\n\nWHAT I KNOW SO FAR:\n"+(thesis&&thesis.length>20?thesis:"I am still in research mode — limited thesis written yet.")+"\n\n--- YOUR TASK ---\n\n1. What are the 5 most important questions to answer before buying this company?\n2. What would constitute a genuinely durable moat in this business — and does the current business model qualify?\n3. What are the 3 things that bulls consistently get wrong about this type of business?\n4. What would make you say \'do not buy this at any price\'?\n5. Draft 3 specific sell criteria I should set before I buy a single share.\n\nHelp me build a rigorous entry framework — not excitement.";
  }
  return "";
}

function calcMoatFromData(finData,businessModelType){
    if(!finData)return null;
    var inc=finData.income||[],bal=finData.balance||[],cf=finData.cashflow||[];
    if(inc.length<2)return null;
    // Ensure oldest-first ordering (FMP returns newest-first)
    function sortOldFirst(arr){if(arr.length<2)return arr;var a=arr.slice();if(a[0].date&&a[1].date&&a[0].date>a[1].date)a.reverse();else if(a[0].calendarYear&&a[1].calendarYear&&parseInt(a[0].calendarYear)>parseInt(a[1].calendarYear))a.reverse();return a}
    inc=sortOldFirst(inc);bal=sortOldFirst(bal);cf=sortOldFirst(cf);
    function vals(rows,k){return rows.map(function(r){return r[k]}).filter(function(v){return v!=null&&!isNaN(v)})}
    function avg(arr){return arr.length?arr.reduce(function(s,v){return s+v},0)/arr.length:null}
    function stdDev(arr){var m=avg(arr);if(m===null||arr.length<2)return null;return Math.sqrt(arr.reduce(function(s,v){return s+Math.pow(v-m,2)},0)/arr.length)}
    var recent=inc.slice(-5);var recentBal=bal.slice(-5);var recentCf=cf.slice(-5);
    var metrics=[];
    // 1. GROSS MARGIN
    var gm=vals(recent,"grossProfitRatio");
    if(gm.length>=2){var gmAvg=avg(gm)*100;var gmStd=stdDev(gm)*100;
      metrics.push({id:"grossMargin",name:"Gross Margin Stability",score:(function(){var _isDistrib=businessModelType==="distributor";var _base=_isDistrib?(gmAvg>=20?8:gmAvg>=12?7:gmAvg>=8?6:gmAvg>=5?5:3):(gmAvg>=60?8:gmAvg>=40?7:gmAvg>=25?6:gmAvg>=15?4:2);return Math.min(10,Math.max(1,Math.round(_base+(gmStd<3?1:gmStd>10?-1:0))))})(),value:gmAvg.toFixed(1)+"%",detail:"Avg "+gmAvg.toFixed(1)+"% (±"+gmStd.toFixed(1)+"%)"+((businessModelType==="distributor")?" [distributor — thin margin expected]":""),trend:gm.map(function(v){return v*100}),icon:"shield",desc:businessModelType==="distributor"?"Distributors win on scale and asset turns, not gross margin. Stability matters more than the absolute level.":"High & stable margins indicate pricing power"})}
    else{var revs0=vals(recent,"revenue");var gps0=vals(recent,"grossProfit");
      if(revs0.length>=2&&gps0.length>=2){var gmC=gps0.map(function(g,i){return revs0[i]?g/revs0[i]:null}).filter(function(v){return v!=null});
        if(gmC.length>=2){var gmA=avg(gmC)*100;var gmS=stdDev(gmC)*100;
          metrics.push({id:"grossMargin",name:"Gross Margin Stability",score:Math.min(10,Math.max(1,Math.round(gmA>=60?8:gmA>=40?7:gmA>=25?6:gmA>=15?4:2)+(gmS<3?1:gmS>10?-1:0))),value:gmA.toFixed(1)+"%",detail:"Avg "+gmA.toFixed(1)+"% (±"+gmS.toFixed(1)+"%)",trend:gmC.map(function(v){return v*100}),icon:"shield",desc:"High & stable margins indicate pricing power"})}}}
    // 2. REVENUE GROWTH
    var revs=vals(recent,"revenue");
    if(revs.length>=3){var growths=[];for(var gi=1;gi<revs.length;gi++){if(revs[gi-1]>0){growths.push((revs[gi]-revs[gi-1])/revs[gi-1]*100)}}
      var grAvg=avg(growths);var grStd=stdDev(growths);
      metrics.push({id:"revGrowth",name:"Revenue Growth",score:Math.min(10,Math.max(1,Math.round(grAvg>30?8:grAvg>15?7:grAvg>5?6:grAvg>0?4:2)+Math.round(2-(grStd||0)/10))),value:(grAvg>=0?"+":"")+grAvg.toFixed(1)+"%",detail:"CAGR "+(grAvg>=0?"+":"")+grAvg.toFixed(1)+"% (±"+(grStd||0).toFixed(1)+"%)",trend:growths,icon:"trending",desc:"Consistent growth signals durable demand"})}
    // 3. OPERATING LEVERAGE
    var om=vals(recent,"operatingIncomeRatio");
    if(om.length<2){var oi2=vals(recent,"operatingIncome");if(oi2.length>=2&&revs.length>=2){om=oi2.map(function(o,i){return revs[i]?o/revs[i]:null}).filter(function(v){return v!=null})}}
    if(om.length>=2){var omFirst=om[0]*100;var omLast=om[om.length-1]*100;var omAvg=avg(om)*100;var expanding=omLast>omFirst;
      metrics.push({id:"opLeverage",name:"Operating Leverage",score:Math.min(10,Math.max(1,Math.round(omAvg>25?8:omAvg>15?7:omAvg>8?6:omAvg>0?4:2)+(expanding?1:-1))),value:omAvg.toFixed(1)+"%",detail:(expanding?"↑ Expanding":"↓ Contracting")+" ("+omFirst.toFixed(1)+"% → "+omLast.toFixed(1)+"%)",trend:om.map(function(v){return v*100}),icon:"gear",desc:"Expanding operating margins signal scale advantages"})}
    // 4. ROIC — proper invested capital = equity + total debt - cash (excludes excess cash sitting on balance sheet)
    if(recent.length>=2&&recentBal.length>=2){var roics=[];for(var ri=0;ri<Math.min(recent.length,recentBal.length);ri++){
      var opInc=recent[ri].operatingIncome!=null?recent[ri].operatingIncome:recent[ri].netIncome;
      var eq=recentBal[ri]?recentBal[ri].totalStockholdersEquity:null;
      var td=recentBal[ri]?(recentBal[ri].totalDebt||((recentBal[ri].longTermDebt||0)+(recentBal[ri].shortTermDebt||0))):0;
      var cash=recentBal[ri]?(recentBal[ri].cashAndCashEquivalents||0):0;
      var ic=eq!=null?(eq+td-cash):null;
      // Fallback: if invested capital is tiny/negative (net cash > equity+debt), use equity alone
      if(ic!=null&&ic<eq*0.1&&eq>0)ic=eq;
      if(opInc!=null&&ic&&ic>0)roics.push(opInc/ic*100)}
      if(roics.length>=2){
        var _roicAvg=avg(roics);
        var _isAcquirer=businessModelType==="serial_acquirer";
        var _isFinancial=businessModelType==="financial";
        var _roicThresh=_isAcquirer?8:15;
        var _roicScore=_isAcquirer
          ?Math.min(10,Math.max(1,Math.round(_roicAvg>20?9:_roicAvg>15?8:_roicAvg>10?7:_roicAvg>8?6:_roicAvg>5?5:3)))
          :Math.min(10,Math.max(1,Math.round(_roicAvg>30?9:_roicAvg>20?8:_roicAvg>15?7:_roicAvg>10?6:_roicAvg>5?4:2)));
        var _roicDesc=_isAcquirer?"ROIC is understated for serial acquirers due to ongoing M&A deployment. A growing acquired portfolio with improving organic returns matters more than the absolute number.":"High ROIC is the hallmark of a true moat";
        var _roicName=_isAcquirer?"ROIC (acquisition-adjusted)":"Return on Invested Capital";
        metrics.push({id:"roic",name:_roicName,score:_roicScore,value:_roicAvg.toFixed(1)+"%",detail:"Avg ROIC "+_roicAvg.toFixed(1)+"% over "+roics.length+"yr"+(_isAcquirer?" [serial acquirer — lower threshold applied]":""),trend:roics,icon:"target",desc:_roicDesc})}}
    // 5. FCF CONVERSION
    if(recentCf.length>=2&&recent.length>=2){var fcfC=[];for(var fi=0;fi<Math.min(recentCf.length,recent.length);fi++){var fcf=recentCf[fi].freeCashFlow!=null?recentCf[fi].freeCashFlow:((recentCf[fi].operatingCashFlow!=null&&recentCf[fi].capitalExpenditure!=null)?(recentCf[fi].operatingCashFlow+Math.min(0,recentCf[fi].capitalExpenditure)):null);var ni=recent[fi].netIncome;if(fcf!=null&&ni&&ni>0)fcfC.push(fcf/ni*100)}
      if(fcfC.length>=2){metrics.push({id:"fcfConversion",name:"FCF Conversion",score:Math.min(10,Math.max(1,Math.round(avg(fcfC)>120?9:avg(fcfC)>100?8:avg(fcfC)>80?7:avg(fcfC)>50?5:avg(fcfC)>0?3:1))),value:avg(fcfC).toFixed(0)+"%",detail:"FCF/NI ratio avg "+avg(fcfC).toFixed(0)+"%",trend:fcfC,icon:"dollar",desc:"High FCF relative to net income shows earnings quality"})}}
    // 6. FINANCIAL FORTRESS
    if(recentBal.length>=1&&recent.length>=1){var lastBal=recentBal[recentBal.length-1];var lastInc=recent[recent.length-1];var nd=lastBal.netDebt||(lastBal.totalDebt||0)-(lastBal.cashAndCashEquivalents||0);var ebitda=lastInc.ebitda||(lastInc.operatingIncome&&lastInc.depreciationAndAmortization?(lastInc.operatingIncome+Math.abs(lastInc.depreciationAndAmortization)):null);
      if(ebitda&&ebitda>0){var ratio=nd/ebitda;
        // Business model-adjusted leverage tolerance
        var _bmt=businessModelType||"competitive";
        var _rawFortress=ratio<0?10:ratio<1?8:ratio<2?7:ratio<3?5:ratio<5?3:1;
        var _floorByBM=_bmt==="monopoly"?7:_bmt==="oligopoly"?6:_bmt==="niche"?5:_bmt==="commodity"?1:3;
        var _fortressScore=Math.min(10,Math.max(_floorByBM,Math.round(_rawFortress)));
        var _adjNote=(_bmt==="monopoly"||_bmt==="oligopoly")&&ratio>=2?" (adjusted for "+_bmt+")":"";
        metrics.push({id:"fortress",name:"Financial Fortress",score:_fortressScore,value:ratio<0?"Net Cash":ratio.toFixed(1)+"x",detail:"Net Debt/EBITDA = "+(ratio<0?"Net Cash":ratio.toFixed(1)+"x")+_adjNote,trend:null,icon:"castle",desc:"Low leverage = resilience and optionality. Score adjusts for business model type."})}
      else if(nd<0){metrics.push({id:"fortress",name:"Financial Fortress",score:9,value:"Net Cash",detail:"More cash than debt",trend:null,icon:"castle",desc:"Low leverage = resilience and optionality"})}}
    // 7. R&D
    var rds=[];for(var rdi=0;rdi<recent.length;rdi++){var rd=recent[rdi].researchAndDevelopmentExpenses;var rv2=recent[rdi].revenue;if(rd&&rv2)rds.push(rd/rv2*100)}
    if(rds.length>=2){metrics.push({id:"rdIntensity",name:"R&D Investment",score:Math.min(10,Math.max(1,Math.round(avg(rds)>20?8:avg(rds)>12?7:avg(rds)>6?6:avg(rds)>3?5:3))),value:avg(rds).toFixed(1)+"%",detail:"R&D/Revenue avg "+avg(rds).toFixed(1)+"%",trend:rds,icon:"flask",desc:"Sustained R&D builds innovation moats"})}
    // 8. NET MARGIN
    var nm=vals(recent,"netIncomeRatio");
    if(nm.length<2&&revs.length>=2){var nis=vals(recent,"netIncome");if(nis.length>=2){nm=nis.map(function(n,i){return revs[i]?n/revs[i]:null}).filter(function(v){return v!=null})}}
    if(nm.length>=2){var nmF=nm[0]*100;var nmL=nm[nm.length-1]*100;var nmA=avg(nm)*100;var imp=nmL>nmF;
      metrics.push({id:"netMargin",name:"Net Margin Trend",score:Math.min(10,Math.max(1,Math.round(nmA>20?8:nmA>12?7:nmA>5?5:nmA>0?3:1)+(imp?1:0))),value:nmA.toFixed(1)+"%",detail:(imp?"↑":"↓")+" "+nmF.toFixed(1)+"% → "+nmL.toFixed(1)+"%",trend:nm.map(function(v){return v*100}),icon:"bar",desc:"Improving profitability = strengthening position"})}
    if(metrics.length===0)return null;
    var composite=Math.round(avg(metrics.map(function(m){return m.score})));
    return{metrics:metrics,composite:composite,years:recent.length}}


function calcMorningSignals(K, portfolio, library){
  var signals = [];
  var now = Date.now();

  // ── LAYER 1: Ownership × Process — alignment mismatches ──
  var alignData = calcAlignmentSignals(portfolio);
  if(alignData.mismatches.length > 0){
    var top = alignData.mismatches[0];
    signals.push({
      layer: "alignment",
      priority: top.severity === "high" ? 1 : 2,
      icon: "alert",
      color: top.color,
      title: top.ticker + ": conviction/size mismatch",
      sub: top.msg,
      action: "AI Review",
      onAction: {type: "ai", aiType: top.aiType, c: top.c},
      secondary: "View holding",
      onSecondary: {type: "go", c: top.c}
    });
  }

  // ── LAYER 1b: Conviction LOW + position LARGE ──────────────────
  portfolio.forEach(function(c){
    if(!c.conviction||c.conviction===0)return;
    if(c.conviction>=5)return; // only flag low conviction
    var pos=c.position||{};
    if(!(pos.shares>0&&pos.currentPrice>0))return;
    var val=pos.shares*pos.currentPrice;
    var totalV=portfolio.reduce(function(s,x){var p=x.position||{};return s+(p.shares>0&&p.currentPrice>0?p.shares*p.currentPrice:0)},0);
    if(totalV<=0)return;
    var pct=Math.round(val/totalV*100);
    if(pct<10)return; // only flag meaningful positions
    var lastReview=c.thesisUpdatedAt?Math.ceil((Date.now()-new Date(c.thesisUpdatedAt))/864e5):null;
    signals.push({
      layer:"conv_size",
      priority:1,
      icon:"alert",
      color:K.amb,
      title:c.ticker+" conviction is your lowest \u2014 it\u2019s also your largest position",
      sub:"Conviction: "+c.conviction+"/10 \u00b7 Position weight: "+pct+"% \u00b7 "+(lastReview?("Last reviewed: "+lastReview+"d ago"):"Thesis not reviewed"),
      action:"Review thesis",
      onAction:{type:"go",c:c,modal:"thesis"},
      secondary:"Challenge AI",
      onSecondary:{type:"ai",aiType:"challenge",c:c}
    });
  });

  // ── LAYER 1c: Stale thesis — post last earnings ──────────────────
  portfolio.forEach(function(c){
    if(!c.thesisUpdatedAt)return;
    var days=Math.ceil((Date.now()-new Date(c.thesisUpdatedAt))/864e5);
    if(days<90)return;
    // Only add if not already covered by alignment signal
    if(signals.some(function(s){return s.layer==="conv_size"&&s.title.indexOf(c.ticker)>=0}))return;
    signals.push({
      layer:"stale_thesis",
      priority:2,
      icon:"file",
      color:K.blue||"#3B82F6",
      title:c.ticker+" thesis hasn\u2019t been reviewed since "+Math.round(days/30)+" months ago",
      sub:"Thesis health \u00b7 Last updated: "+days+"d ago",
      action:"Re-read thesis",
      onAction:{type:"go",c:c},
      secondary:"Challenge AI",
      onSecondary:{type:"ai",aiType:"challenge",c:c}
    });
  });

  // ── LAYER 2: Process — KPI miss streak (2+ consecutive) ──
  portfolio.forEach(function(c){
    if(!c.kpis || c.kpis.length === 0) return;
    c.kpis.forEach(function(kpi){
      var results = kpi.results || [];
      if(results.length < 2) return;
      var last2 = results.slice(-2);
      var bothMissed = last2.every(function(r){
        if(!kpi.target || !r.value) return false;
        var v = parseFloat(r.value);
        var t = parseFloat(kpi.target);
        if(isNaN(v) || isNaN(t)) return false;
        return v < t;
      });
      if(bothMissed){
        signals.push({
          layer: "kpi_streak",
          priority: 2,
          icon: "bar",
          color: K.red,
          title: c.ticker + ": " + kpi.label + " missed 2 quarters",
          sub: "Target " + kpi.target + (kpi.unit||"") + " — missed in both recent checks. Bear case?",
          action: "Bear Case",
          onAction: {type: "ai", aiType: "bear", c: c},
          secondary: "View KPIs",
          onSecondary: {type: "go", c: c}
        });
      }
    });
  });

  // ── LAYER 3: Process — conviction drop alert ──────────────
  portfolio.forEach(function(c){
    var hist = c.convictionHistory || [];
    if(hist.length < 2) return;
    var last = hist[hist.length - 1].rating;
    var prev = hist[hist.length - 2].rating;
    var drop = prev - last;
    if(drop >= 2){
      var hasSell = (function(){var s=parseThesis(c.thesisNote);return s.sell&&s.sell.trim().length>10})();
      signals.push({
        layer: "conviction_drop",
        priority: 2,
        icon: "trending",
        color: K.amb,
        title: c.ticker + ": conviction dropped " + drop + " points",
        sub: prev + "/10 → " + last + "/10" + (hasSell ? ". Sell criteria written." : ". No sell criteria — write them now."),
        action: hasSell ? "Sell Check" : "Add Sell Criteria",
        onAction: hasSell
          ? {type: "ai", aiType: "sell", c: c}
          : {type: "go", c: c, modal: "thesis"},
        secondary: "Challenge thesis",
        onSecondary: {type: "ai", aiType: "challenge", c: c}
      });
    }
  });

  // ── LAYER 4: Library × Process — tagged items + earnings ──
  var libItems = (library && library.items) || [];
  var earningsSoon = portfolio.filter(function(c){
    return c.earningsDate && c.earningsDate !== "TBD"
      && dU(c.earningsDate) >= 0 && dU(c.earningsDate) <= 7;
  });
  earningsSoon.forEach(function(c){
    var tagged = libItems.filter(function(it){return it.ticker === c.ticker});
    if(tagged.length > 0){
      signals.push({
        layer: "library_earnings",
        priority: 2,
        icon: "book",
        color: K.acc,
        title: tagged.length + " saved item" + (tagged.length > 1 ? "s" : "") + " tagged to " + c.ticker,
        sub: c.ticker + " reports in " + dU(c.earningsDate) + "d — review your saved material before the call",
        action: "Open Library",
        onAction: {type: "library"},
        secondary: "Pre-Earnings AI",
        onSecondary: {type: "ai", aiType: "earnings", c: c}
      });
    }
  });

  // ── LAYER 5: Decision post-mortems (decisions >90d with no outcome) ──
  portfolio.forEach(function(c){
    var decs = (c.decisions||[]).filter(function(d){
      if(d.cardType!=="decision"&&(d.cardType||!d.reasoning))return false;
      if(d.outcome)return false; // already reviewed
      if(!d.date)return false;
      var ageDays = Math.ceil((Date.now()-new Date(d.date))/864e5);
      return ageDays >= 90;
    });
    if(decs.length > 0){
      var oldest = decs[decs.length-1];
      var ageDays = Math.ceil((Date.now()-new Date(oldest.date))/864e5);
      signals.push({
        layer:"postmortem",
        priority:3,
        icon:"clock",
        color:K.blue||"#3B82F6",
        title:c.ticker+": decision needs a post-mortem",
        sub:(oldest.action||"Decision")+" logged "+ageDays+"d ago — was your reasoning right?",
        action:"Post-Mortem",
        onAction:{type:"postmortem", c:c, dec:oldest},
        secondary:"View journal",
        onSecondary:{type:"go", c:c}
      });
    }
  });

  // LAYER 6: Ownership anniversaries
  portfolio.forEach(function(c){
    if(!c.purchaseDate)return;
    var _rawHeld=Math.ceil((Date.now()-new Date(c.purchaseDate))/864e5);var daysHeld=(_rawHeld>0&&_rawHeld<18250)?_rawHeld:0;
    [1,2,3,5,7,10].forEach(function(yr){
      var target=yr*365;
      if(daysHeld>=target&&daysHeld<target+7){
        var pos=c.position||{};var ret=pos.avgCost>0&&pos.currentPrice>0?((pos.currentPrice-pos.avgCost)/pos.avgCost*100):null;
        signals.push({layer:"anniversary",priority:3,icon:"shield",color:"#D4AF37",
          title:yr+"yr anniversary owning "+c.ticker+" "+String.fromCodePoint(0x1F389),
          sub:"You\u2019ve held "+c.name+" for "+yr+" year"+(yr>1?"s":"")+(ret!=null?" \u00b7 "+(ret>=0?"+":"")+ret.toFixed(1)+"% return":"")+". Does the thesis still hold?",
          action:"Review thesis",onAction:{type:"go",c:c,modal:"thesis"},
          secondary:"Annual AI check",onSecondary:{type:"ai",aiType:"annual",c:c}});
      }
    });
  });

  // LAYER 7: Above intrinsic value estimate
  portfolio.forEach(function(c){
    if(!c.ivEstimate||c.ivEstimate<=0)return;
    var cp=(c.position||{}).currentPrice||0;if(!cp)return;
    var prem=(cp-c.ivEstimate)/c.ivEstimate*100;
    if(prem<15)return;
    signals.push({layer:"above_iv",priority:2,icon:"trending",color:K.amb,
      title:c.ticker+" is trading "+prem.toFixed(0)+"% above your IV estimate",
      sub:"Your IV: "+cSym+c.ivEstimate.toFixed(0)+" \u00b7 Current: "+cSym+cp.toFixed(0)+". Is conviction keeping up with price?",
      action:"Review valuation",onAction:{type:"go",c:c,modal:"valuation"},
      secondary:"Sell discipline",onSecondary:{type:"ai",aiType:"sell",c:c}});
  });

  // Sort by priority, cap at 4
  signals.sort(function(a, b){ return a.priority - b.priority });
  return signals.slice(0, 4);
}

function calcAlignmentSignals(K, portCos){
  var held=portCos.filter(function(c){
    var p=c.position||{};return p.shares>0&&p.currentPrice>0;
  });
  if(held.length<2)return{mismatches:[],flags:[],score:100};

  var totalValue=held.reduce(function(s,c){
    return s+c.position.shares*c.position.currentPrice;
  },0);
  if(totalValue<=0)return{mismatches:[],flags:[],score:100};

  var items=held.map(function(c){
    var val=c.position.shares*c.position.currentPrice;
    var pct=val/totalValue*100;
    var conviction=c.conviction||0;
    var hasThesis=c.thesisNote&&c.thesisNote.trim().length>40;
    var hasSell=(function(){var s=parseThesis(c.thesisNote);return s.sell&&s.sell.trim().length>10})();
    var convHistory=c.convictionHistory||[];
    var trend=convHistory.length>=2
      ?convHistory[convHistory.length-1].rating-convHistory[convHistory.length-2].rating
      :0;
    var staleDays=c.lastReviewed
      ?Math.ceil((Date.now()-new Date(c.lastReviewed))/864e5)
      :999;
    return{c:c,val:val,pct:pct,conviction:conviction,hasThesis:hasThesis,hasSell:hasSell,trend:trend,staleDays:staleDays};
  }).sort(function(a,b){return b.pct-a.pct});

  // Compute conviction-weighted ideal allocation
  // Ideal pct for each holding = conviction/sumConviction * 100
  var sumConv=items.reduce(function(s,i){return s+(i.conviction||1)},0);
  items=items.map(function(item){
    var idealPct=sumConv>0?(item.conviction||1)/sumConv*100:100/items.length;
    var drift=item.pct-idealPct;
    return Object.assign({},item,{idealPct:idealPct,drift:drift});
  });

  var mismatches=[];
  var flags=[];

  items.forEach(function(item){
    var ticker=item.c.ticker;
    // High weight, low conviction
    if(item.pct>=15&&item.conviction>0&&item.conviction<=4){
      mismatches.push({
        type:"overweight_low_conviction",
        severity:"high",
        color:"#ef4444",
        ticker:ticker,
        c:item.c,
        msg:ticker+" is "+item.pct.toFixed(1)+"% of your portfolio but conviction is only "+item.conviction+"/10",
        action:"Review position size or rebuild conviction",
        aiType:"challenge",
        pct:item.pct,
        conviction:item.conviction
      });
    }
    // Biggest position has falling conviction
    else if(item===items[0]&&item.trend<=-2){
      mismatches.push({
        type:"top_holding_falling",
        severity:"high",
        color:"#ef4444",
        ticker:ticker,
        c:item.c,
        msg:"Your largest holding "+ticker+" ("+item.pct.toFixed(1)+"%) had conviction drop "+Math.abs(item.trend)+" points last review",
        action:"Sell discipline check or bear case",
        aiType:"sell",
        pct:item.pct,
        conviction:item.conviction
      });
    }
    // High conviction, undersized
    else if(item.conviction>=8&&item.pct<5&&items.length>=3){
      mismatches.push({
        type:"underweight_high_conviction",
        severity:"medium",
        color:K.amb,
        ticker:ticker,
        c:item.c,
        msg:ticker+" is your highest conviction holding ("+item.conviction+"/10) but only "+item.pct.toFixed(1)+"% of portfolio",
        action:"Consider whether sizing matches conviction",
        aiType:"annual",
        pct:item.pct,
        conviction:item.conviction
      });
    }
    // Large position, no thesis written
    if(item.pct>=10&&!item.hasThesis){
      flags.push({
        type:"no_thesis",
        severity:"medium",
        color:K.amb,
        ticker:ticker,
        c:item.c,
        msg:ticker+" is "+item.pct.toFixed(1)+"% of portfolio but has no written thesis",
        action:"Write a thesis"
      });
    }
    // Falling conviction + no sell criteria
    if(item.trend<=-2&&!item.hasSell){
      flags.push({
        type:"falling_no_sell",
        severity:"medium",
        color:K.amb,
        ticker:ticker,
        c:item.c,
        msg:ticker+" conviction is falling but no sell criteria are written",
        action:"Define your exit before emotion does"
      });
    }
  });

  // ── Sell trigger: flag held positions where conviction just dropped below 5 ──
  items.forEach(function(item){
    var c2=item.c;
    var pos=c2.position||{};
    var isHeld=pos.shares>0&&pos.currentPrice>0;
    if(!isHeld)return;
    if(item.conviction<=0)return; // not set yet, not a trigger
    var hist=c2.convictionHistory||[];
    var justDropped=hist.length>=2&&(hist[hist.length-1].rating||hist[hist.length-1].score||0)<=4&&(hist[hist.length-2].rating||hist[hist.length-2].score||0)>4;
    var hasSellCheck=(c2.decisions||[]).some(function(d){return d._isSellCheck&&d.date&&Math.ceil((Date.now()-new Date(d.date))/864e5)<30});
    if(justDropped&&!hasSellCheck){
      flags.push({type:"sell_trigger",severity:"high",color:K.red,ticker:c2.ticker,c:c2,
        msg:c2.ticker+" conviction just crossed below 5 — time for a sell discipline check",
        action:"Run sell check",_sellCheck:true});
    }
  });

  // Alignment score: 100 minus deductions
  var deductions=mismatches.filter(function(m){return m.severity==="high"}).length*20
    +mismatches.filter(function(m){return m.severity==="medium"}).length*10
    +flags.filter(function(f){return f.severity==="medium"}).length*5;
  var score=Math.max(0,100-deductions);

  return{mismatches:mismatches,flags:flags,score:score,items:items};
}

export {
  ldS, svS,
  cacheGet, cacheSet,
  xJSON, stripCite, autoFormat,
  calcOwnerScore, classifyPortfolio, calcMastery,
  resolveMetricId, isCustomKpi,
  toFinnhubSymbol, isIntlTicker,
  estimatePayMonths,
  dU, fD, fT, nId, gH, bT, eS,
  fmtBig, getValMetricValue, buildPrompt, calcMoatFromData,
  calcMorningSignals, calcAlignmentSignals
};
