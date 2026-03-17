"use client";
// app/components/utils.js

var _cache={};var CACHE_TTL=3600000;
var KNOWN_MONTHLY=["O","MAIN","STAG","AGNC","SLG","GOOD","LTC","SPHD","JEPI","JEPQ","QYLD","RYLD","DIVO","EPR","LAND","PSEC","GAIN"];

function ldS(k){try{var r=localStorage.getItem(k);return Promise.resolve(r?JSON.parse(r):null)}catch(e){return Promise.resolve(null)}}

function svS(k,d){try{localStorage.setItem(k,JSON.stringify(d))}catch(e){}return Promise.resolve()}
// Cloud sync via Supabase

function cacheGet(k){var e=_cache[k];if(!e)return null;if(Date.now()-e.t>CACHE_TTL){delete _cache[k];return null}return e.d}

function cacheSet(k,d){_cache[k]={d:d,t:Date.now()};return d}

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

// Legacy name → metricId mapping for existing user data


var LEGACY_MAP={"revenue growth":"revGrowth","eps growth":"epsGrowth","gross margin":"grossMargin","operating margin":"opMargin","net margin":"netMargin","fcf margin":"fcfMargin","free cash flow margin":"fcfMargin","r&d margin":"rndMargin","r&d to revenue":"rndMargin","sga margin":"sgaMargin","sga to revenue":"sgaMargin","return on equity":"roe","return on assets":"roa","return on invested capital":"roic","p/e":"pe","pe ratio":"pe","p/e ratio":"pe","p/b":"pb","price to book":"pb","p/s":"ps","price to sales":"ps","ev/ebitda":"evEbitda","ev/fcf":"evFcf","ev/revenue":"evRevenue","peg":"peg","peg ratio":"peg","current ratio":"currentRatio","quick ratio":"quickRatio","debt to equity":"debtEquity","debt/equity":"debtEquity","d/e ratio":"debtEquity","net debt/ebitda":"netDebtEbitda","interest coverage":"interestCoverage","dividend yield":"divYield","book value per share":"bvps","free cash flow":"fcfPerShare","fcf":"fcfPerShare","fcf yield":"fcfYield","fcf per share":"fcfPerShare","revenue per share":"revPerShare","ebitda":"ebitdaPerShare","ebitda margin":"ebitdaPerShare","rev/share":"revPerShare","revenue growth yoy":"revGrowth","eps growth yoy":"epsGrowth","shareholder yield":"shareholderYield","total shareholder yield":"shareholderYield","buyback yield":"buybackYield","graham number":"grahamNum","graham":"grahamNum","vs graham":"grahamDiscount"};

function resolveMetricId(kpi){if(kpi.metricId)return kpi.metricId;var n=kpi.name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return LEGACY_MAP[n]||null}

function isCustomKpi(name){var n=name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return!LEGACY_MAP[n]}

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
// FMP Financial Statements (FREE tier — 250 req/day, 5 years annual)

var dU=function(d){if(!d||d==="TBD")return 999;return Math.ceil((new Date(d)-new Date())/864e5)};

var fD=function(d){try{return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch(e){return d}};

var fT=function(ts){if(!ts)return"";var d=new Date(ts);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})};

var nId=function(a){return a.length?Math.max.apply(null,a.map(function(x){return x.id}))+1:1};

function gH(kpis){var ev=kpis.filter(function(k){return k.lastResult});if(!ev.length)return{l:"Pending",c:"#6B7280"};var m=ev.filter(function(k){return k.lastResult.status==="met"}).length;var p=Math.round(m/ev.length*100);return p>=80?{l:"Strong",c:"#22C55E"}:p>=50?{l:"Mixed",c:"#F59E0B"}:{l:"Weak",c:"#EF4444"}}

var bT=function(r,v,u){return(r==="gte"?"≥":r==="lte"?"≤":"=")+" "+v+(u||"")};

var eS=function(r,t,a){var n=parseFloat(a);if(isNaN(n))return"unclear";return r==="gte"?(n>=t?"met":"missed"):r==="lte"?(n<=t?"met":"missed"):(n===t?"met":"missed")};

export {
  ldS,
  svS,
  cacheGet,
  cacheSet,
  xJSON,
  stripCite,
  autoFormat,
  calcOwnerScore,
  classifyPortfolio,
  calcMastery,
  resolveMetricId,
  isCustomKpi,
  toFinnhubSymbol,
  isIntlTicker,
  estimatePayMonths,
  dU,
  fD,
  fT,
  nId,
  gH,
  bT,
  eS,
};
