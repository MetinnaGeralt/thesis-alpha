"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ═══ SUPABASE AUTH ═══
var supabase = typeof window !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : null;

// ═══ STORAGE (local + cloud) ═══
function ldS(k){try{var r=localStorage.getItem(k);return Promise.resolve(r?JSON.parse(r):null)}catch(e){return Promise.resolve(null)}}
function svS(k,d){try{localStorage.setItem(k,JSON.stringify(d))}catch(e){}return Promise.resolve()}
// Cloud sync via Supabase
async function cloudLoad(userId){if(!supabase||!userId)return null;
  try{var res=await supabase.from("portfolios").select("data").eq("user_id",userId).single();
    if(res.error||!res.data)return null;return res.data.data}catch(e){console.warn("Cloud load:",e);return null}}
async function cloudSave(userId,payload){if(!supabase||!userId)return;
  try{await supabase.from("portfolios").upsert({user_id:userId,data:payload,updated_at:new Date().toISOString()},{onConflict:"user_id"})}catch(e){console.warn("Cloud save:",e)}}

// ═══ FMP (server proxy — profiles & prices) ═══
// ═══ API CACHE (1hr TTL — saves ~80% of FMP quota) ═══
var _cache={};var CACHE_TTL=3600000;
function cacheGet(k){var e=_cache[k];if(!e)return null;if(Date.now()-e.t>CACHE_TTL){delete _cache[k];return null}return e.d}
function cacheSet(k,d){_cache[k]={d:d,t:Date.now()};return d}

async function fmp(ep){var cached=cacheGet("fmp:"+ep);if(cached!==null){console.log("[FMP cache] "+ep+" → HIT");return cached}try{var r=await fetch("/api/fmp?endpoint="+encodeURIComponent(ep));console.log("[FMP client] "+ep+" → HTTP "+r.status);if(!r.ok){console.warn("[FMP client] HTTP error for "+ep+": "+r.status);return null}var d=await r.json();console.log("[FMP client] "+ep+" → "+(Array.isArray(d)?d.length+" items":d===null?"null":typeof d));if(d)cacheSet("fmp:"+ep,d);return d}catch(e){console.warn("FMP:",ep,e);return null}}

// ═══ FINNHUB (server proxy — earnings, metrics, news, analysts) ═══
async function finnhub(ep){var cached=cacheGet("fh:"+ep);if(cached!==null){console.log("[Finnhub cache] "+ep+" → HIT");return cached}try{var r=await fetch("/api/finnhub?endpoint="+encodeURIComponent(ep));if(!r.ok){console.warn("[Finnhub] HTTP "+r.status+" for "+ep);return null}var d=await r.json();if(d&&d.error){console.warn("[Finnhub] API error for "+ep+":",d.error);return null}if(d)cacheSet("fh:"+ep,d);return d}catch(e){console.warn("[Finnhub] fetch error:",ep,e);return null}}

// ═══ AI (server proxy) ═══
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
// ═══ NO AI — all data from free APIs (Finnhub + FMP) ═══

// ═══ DATA FUNCTIONS ═══
// Predefined metrics — each maps to an exact Finnhub field
var METRICS=[
  {id:"eps",label:"EPS",unit:"$",cat:"Earnings",fh:"earnings"},
  {id:"grossMargin",label:"Gross Margin",unit:"%",cat:"Margins"},
  {id:"opMargin",label:"Operating Margin",unit:"%",cat:"Margins"},
  {id:"netMargin",label:"Net Margin",unit:"%",cat:"Margins"},
  {id:"roe",label:"ROE",unit:"%",cat:"Returns"},
  {id:"roa",label:"ROA",unit:"%",cat:"Returns"},
  {id:"roic",label:"ROIC",unit:"%",cat:"Returns"},
  {id:"revGrowth",label:"Revenue Growth YoY",unit:"%",cat:"Growth"},
  {id:"epsGrowth",label:"EPS Growth YoY",unit:"%",cat:"Growth"},
  {id:"revPerShare",label:"Revenue Per Share",unit:"$",cat:"Revenue"},
  {id:"fcfPerShare",label:"Free Cash Flow / Share",unit:"$",cat:"Cash Flow"},
  {id:"pe",label:"P/E Ratio",unit:"x",cat:"Valuation"},
  {id:"pb",label:"P/B Ratio",unit:"x",cat:"Valuation"},
  {id:"currentRatio",label:"Current Ratio",unit:"x",cat:"Health"},
  {id:"debtEquity",label:"Debt / Equity",unit:"x",cat:"Health"},
  {id:"divYield",label:"Dividend Yield",unit:"%",cat:"Income"},
  {id:"bvps",label:"Book Value / Share",unit:"$",cat:"Valuation"},
  {id:"ebitdaPerShare",label:"EBITDA / Share",unit:"$",cat:"Earnings"}
];
var METRIC_MAP={};METRICS.forEach(function(m){METRIC_MAP[m.id]=m});
// ── Investment Style System ──
var INVEST_STYLES=[
  {id:"quality",label:"Quality Compounder",icon:"shield",color:"#22C55E",
    desc:"Wide moat, durable earnings, compound forever. Think Visa, Costco, MSFT.",
    kpis:["roic","grossMargin","opMargin","fcfPerShare","roe"],
    thesisPrompt:"What makes this a durable competitive advantage? How does the moat compound over time?",
    moatPrompt:"What protects this business from competition for the next 10+ years?",
    riskPrompt:"What could erode the moat? Disruption, complacency, regulatory change?",
    sellPrompt:"At what valuation does even a great compounder become a sell?"},
  {id:"growth",label:"High Growth",icon:"trending",color:"#3B82F6",
    desc:"Rapid revenue growth, path to profitability matters. Think early CrowdStrike, Shopify.",
    kpis:["revGrowth","grossMargin","opMargin","revPerShare","epsGrowth"],
    thesisPrompt:"What's the total addressable market? Why will this company win it?",
    moatPrompt:"What creates winner-take-most dynamics? Network effects, switching costs, data moats?",
    riskPrompt:"Can growth sustain? Competition, customer concentration, burn rate?",
    sellPrompt:"What growth deceleration would signal the thesis is broken?"},
  {id:"prerev",label:"Pre-Revenue / Speculative",icon:"flask",color:"#EC4899",
    desc:"No financials yet — catalysts and optionality matter. Think biotech, early-stage tech.",
    kpis:["currentRatio","debtEquity"],
    thesisPrompt:"What's the specific catalyst? FDA approval, product launch, key partnership?",
    moatPrompt:"What IP, regulatory, or first-mover advantage exists? What's the optionality?",
    riskPrompt:"Cash runway? Binary risk events? Dilution risk? What kills this if it fails?",
    sellPrompt:"What catalyst failure or timeline miss would make you exit?"},
  {id:"dividend",label:"Dividend / Income",icon:"dollar",color:"#F59E0B",
    desc:"Stable cash flows, growing dividends. Think JNJ, Realty Income, Coca-Cola.",
    kpis:["divYield","fcfPerShare","debtEquity","roe","opMargin"],
    thesisPrompt:"Why is this dividend safe and growing? What drives the underlying cash flow?",
    moatPrompt:"What ensures pricing power and demand stability through economic cycles?",
    riskPrompt:"Payout ratio sustainability? Interest rate sensitivity? Earnings cyclicality?",
    sellPrompt:"What dividend cut, yield threshold, or growth stall would trigger a sell?"},
  {id:"garp",label:"GARP",icon:"bar",color:"#8B5CF6",
    desc:"Growth at a reasonable price. PEG matters. Think FICO, Danaher, Mastercard.",
    kpis:["revGrowth","epsGrowth","pe","grossMargin","roic"],
    thesisPrompt:"Is this growth fairly priced? What's the PEG ratio telling you?",
    moatPrompt:"What competitive advantage sustains above-market growth without excessive risk?",
    riskPrompt:"Multiple compression risk? Can growth justify the premium? Cyclical exposure?",
    sellPrompt:"At what P/E or PEG does the risk/reward no longer favor holding?"},
  {id:"value",label:"Deep Value",icon:"search",color:"#6366F1",
    desc:"Trading below intrinsic value. Margin of safety is everything. Think Buffett's cigar butts.",
    kpis:["pb","pe","currentRatio","debtEquity","bvps"],
    thesisPrompt:"What's the intrinsic value? Why is the market mispricing this asset?",
    moatPrompt:"Is there hidden asset value, franchise value, or earnings power the market ignores?",
    riskPrompt:"Value trap risk? Is it cheap for a reason? Management quality? Balance sheet?",
    sellPrompt:"What's your intrinsic value estimate? At what price do you sell?"},
  {id:"turnaround",label:"Turnaround",icon:"gear",color:"#EF4444",
    desc:"Broken but fixable. Catalyst for recovery needed. Think post-crisis plays.",
    kpis:["debtEquity","opMargin","currentRatio","revGrowth","fcfPerShare"],
    thesisPrompt:"What's broken and what's the specific fix? New management, restructuring, spinoff?",
    moatPrompt:"What underlying franchise value survives the current problems?",
    riskPrompt:"Can the company survive long enough? Liquidity risk? Execution risk on the turnaround plan?",
    sellPrompt:"What timeline for recovery? What would prove the turnaround thesis is dead?"}
];
var STYLE_MAP={};INVEST_STYLES.forEach(function(s){STYLE_MAP[s.id]=s});
var MSTAR_RATINGS=["Wide","Narrow","None","Not Rated"];
function calcOwnerScore(cos){
  var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
  if(portfolio.length===0)return{total:0,breakdown:{thesis:0,kpi:0,journal:0,conviction:0,moat:0,balance:0},max:100};
  // 1. Thesis completeness (20 pts)
  var thesisP=0;portfolio.forEach(function(c){var score=0;
    if(c.thesisNote&&c.thesisNote.length>20)score+=2;
    if(c.thesisNote&&c.thesisNote.indexOf("## MOAT")>=0)score+=1;
    if(c.thesisNote&&c.thesisNote.indexOf("## RISKS")>=0)score+=1;
    if(c.thesisNote&&c.thesisNote.indexOf("## SELL")>=0)score+=1;
    if(c.thesisVersions&&c.thesisVersions.length>1)score+=1;
    // Staleness penalty: decay 1pt per 90 days without update
    if(c.thesisNote&&c.thesisUpdatedAt){var ageDays=Math.ceil((new Date()-new Date(c.thesisUpdatedAt))/864e5);if(ageDays>180)score=Math.max(0,score-2);else if(ageDays>90)score=Math.max(0,score-1)}
    thesisP+=Math.min(score,5)});
  thesisP=Math.round(thesisP/portfolio.length/5*20);
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

// Legacy name → metricId mapping for existing user data
var LEGACY_MAP={};METRICS.forEach(function(m){LEGACY_MAP[m.label.toLowerCase()]=m.id});
var _la={"revenue growth":"revGrowth","eps growth":"epsGrowth","gross margin":"grossMargin","operating margin":"opMargin","net margin":"netMargin","return on equity":"roe","return on assets":"roa","return on invested capital":"roic","p/e":"pe","pe ratio":"pe","p/e ratio":"pe","p/b":"pb","price to book":"pb","current ratio":"currentRatio","debt to equity":"debtEquity","debt/equity":"debtEquity","d/e ratio":"debtEquity","dividend yield":"divYield","book value per share":"bvps","free cash flow":"fcfPerShare","fcf":"fcfPerShare","fcf margin":"fcfPerShare","revenue per share":"revPerShare","ebitda":"ebitdaPerShare","ebitda margin":"ebitdaPerShare","rev/share":"revPerShare","revenue growth yoy":"revGrowth","eps growth yoy":"epsGrowth"};
Object.keys(_la).forEach(function(k){LEGACY_MAP[k]=_la[k]});
function resolveMetricId(kpi){if(kpi.metricId)return kpi.metricId;var n=kpi.name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return LEGACY_MAP[n]||null}
function isCustomKpi(name){if(METRIC_MAP[name])return false;var n=name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return!LEGACY_MAP[n]}

async function lookupTicker(ticker){var t=ticker.toUpperCase().trim();
  try{
    var p=await fmp("profile/"+t);
    if(p&&p.length&&p[0].companyName){var pr=p[0],domain="",irUrl="";
      if(pr.website){try{domain=new URL(pr.website).hostname.replace("www.","")}catch(e){domain=pr.website.replace(/https?:\/\/(www\.)?/,"").split("/")[0]}
        irUrl="https://www.google.com/search?q="+encodeURIComponent(t+" "+pr.companyName+" investor relations")+"&btnI=1"}
      // Grab earnings date from Finnhub (free, $0) — include date range for better coverage
      var ed="TBD",et="TBD";
      try{var from2=new Date(Date.now()-30*86400000).toISOString().slice(0,10);var to2=new Date(Date.now()+120*86400000).toISOString().slice(0,10);
        var ec=await finnhub("calendar/earnings?symbol="+t+"&from="+from2+"&to="+to2);
        if(ec&&ec.earningsCalendar&&ec.earningsCalendar.length){
          var now=new Date().toISOString().slice(0,10);
          var upcoming=ec.earningsCalendar.filter(function(e){return e.date>=now}).sort(function(a,b){return a.date>b.date?1:-1});
          if(upcoming.length){ed=upcoming[0].date;et=upcoming[0].hour===0?"BMO":upcoming[0].hour===1?"AMC":"TBD"}
          else{var recent=ec.earningsCalendar.sort(function(a,b){return b.date>a.date?1:-1});
            if(recent.length){ed=recent[0].date;et=recent[0].hour===0?"BMO":recent[0].hour===1?"AMC":"TBD"}}}}catch(e){}
      return{name:pr.companyName,sector:pr.sector||pr.industry||"",industry:pr.industry||"",earningsDate:ed,earningsTime:et,domain:domain,irUrl:irUrl||"",price:pr.price||0,lastDiv:pr.lastDiv||0,mktCap:pr.mktCap||0,description:pr.description||"",ceo:pr.ceo||"",employees:pr.fullTimeEmployees||0,country:pr.country||"",exchange:pr.exchangeShortName||pr.exchange||"",ipoDate:pr.ipoDate||"",image:pr.image||""}}
  }catch(e){console.warn("FMP lookup failed:",e)}
  return{error:"Not found — enter details manually"}}
async function fetchPrice(ticker){try{var p=await fmp("profile/"+ticker);if(p&&p.length&&p[0].price)return{price:p[0].price,lastDiv:p[0].lastDiv||0};return null}catch(e){return null}}
// Fetch dividend details from FMP
async function fetchDividendInfo(ticker){try{
  var hist=await fmp("historical-price-full/stock_dividend/"+ticker);
  if(!hist||!hist.historical||!hist.historical.length)return null;
  var divs=hist.historical.slice(0,12); // last 12 dividends
  var latest=divs[0];
  // Determine frequency from gaps between payments
  var freq="quarterly";
  if(divs.length>=3){
    var gaps=[];for(var i=1;i<Math.min(divs.length,6);i++){
      var d1=new Date(divs[i-1].date);var d2=new Date(divs[i].date);
      gaps.push(Math.round((d1-d2)/(1000*60*60*24)))}
    var avgGap=gaps.reduce(function(s,v){return s+v},0)/gaps.length;
    if(avgGap<45)freq="monthly";else if(avgGap<120)freq="quarterly";else if(avgGap<240)freq="semi";else freq="annual"}
  return{divPerShare:latest.dividend||latest.adjDividend||0,divFrequency:freq,exDivDate:latest.date||"",lastDiv:latest.dividend||latest.adjDividend||0}
}catch(e){console.warn("[FMP] dividend fetch error:",e);return null}}
// FMP Financial Statements (FREE tier — 250 req/day, 5 years annual)
var _fincache={};
async function fetchFinancialStatements(ticker,period){
  var key=ticker+"-"+(period||"annual");if(_fincache[key])return _fincache[key];
  try{
    // Primary: FMP (Starter plan — 300 req/min, 5yr history)
    var isQ=period==="quarter";var lim=isQ?20:5;
    var qs="?period="+(isQ?"quarter":"annual")+"&limit="+lim;
    console.log("[ThesisAlpha] Fetching financials via FMP for "+ticker+" ("+period+")");
    var results=await Promise.all([fmp("income-statement/"+ticker+qs),fmp("balance-sheet-statement/"+ticker+qs),fmp("cash-flow-statement/"+ticker+qs)]);
    var _is=results[0],_bs=results[1],_cf=results[2];
    if(_is&&(_is._fmpError||!Array.isArray(_is)))_is=null;
    if(_bs&&(_bs._fmpError||!Array.isArray(_bs)))_bs=null;
    if(_cf&&(_cf._fmpError||!Array.isArray(_cf)))_cf=null;
    if((_is&&_is.length>0)||(_bs&&_bs.length>0)||(_cf&&_cf.length>0)){
      console.log("[ThesisAlpha] FMP success — income:"+(_is||[]).length+" balance:"+(_bs||[]).length+" cf:"+(_cf||[]).length);
      var res={income:(_is||[]).reverse(),balance:(_bs||[]).reverse(),cashflow:(_cf||[]).reverse(),source:"fmp"};
      _fincache[key]=res;return res}
    console.log("[ThesisAlpha] FMP returned empty, trying SEC EDGAR fallback...");
    // Fallback: SEC EDGAR (free, no API key needed)
    var r=await fetch("/api/sec?ticker="+encodeURIComponent(ticker)+"&period="+(period||"annual"));
    if(r.ok){var d=await r.json();
      if(d&&!d.error&&(d.income&&d.income.length>0||d.balance&&d.balance.length>0||d.cashflow&&d.cashflow.length>0)){
        console.log("[ThesisAlpha] SEC EDGAR fallback success — income:"+d.income.length+" balance:"+d.balance.length+" cf:"+d.cashflow.length);
        var res={income:d.income||[],balance:d.balance||[],cashflow:d.cashflow||[],source:"sec-edgar"};
        _fincache[key]=res;return res}}
    return{income:[],balance:[],cashflow:[]}}catch(e){console.warn("[ThesisAlpha] fetchFinancials error:",e);return{income:[],balance:[],cashflow:[]}}}

// ═══ HISTORICAL PRICE DATA (FMP Starter) ═══
var _pricecache={};
async function fetchHistoricalPrice(ticker,range){
  var key=ticker+"-"+(range||"1Y");if(_pricecache[key])return _pricecache[key];
  try{
    var days=range==="6M"?180:range==="2Y"?730:range==="5Y"?1825:365;
    var from=new Date(Date.now()-days*86400000).toISOString().slice(0,10);
    var to=new Date().toISOString().slice(0,10);
    var r=await fmp("historical-price-full/"+ticker+"?from="+from+"&to="+to);
    if(r&&r.historical&&r.historical.length>0){
      var pts=r.historical.reverse();
      _pricecache[key]=pts;return pts}
    return[]}catch(e){console.warn("[ThesisAlpha] Price history error:",e);return[]}}

// ═══ FMP KEY METRICS + RATIOS (Starter plan) ═══
var _fmpmetricscache={};
async function fetchFMPMetrics(ticker){
  if(_fmpmetricscache[ticker])return _fmpmetricscache[ticker];
  try{
    var results=await Promise.all([fmp("ratios-ttm/"+ticker),fmp("key-metrics-ttm/"+ticker)]);
    var ratios=results[0]&&Array.isArray(results[0])&&results[0].length?results[0][0]:null;
    var km=results[1]&&Array.isArray(results[1])&&results[1].length?results[1][0]:null;
    if(!ratios&&!km)return null;
    var out={ratios:ratios||{},km:km||{}};
    _fmpmetricscache[ticker]=out;
    console.log("[ThesisAlpha] FMP metrics for "+ticker+": ratios="+Object.keys(out.ratios).length+" km="+Object.keys(out.km).length);
    return out;
  }catch(e){console.warn("[ThesisAlpha] FMP metrics error:",e);return null}}

async function fetchEarnings(co,kpis){
  var results=[];var quarter="";var summary="";var srcUrl="";var srcLabel="";var snapshot={};
  // Step 1: Finnhub basic financials (FREE, $0)
  var fhMap={};
  try{var met=await finnhub("stock/metric?symbol="+co.ticker+"&metric=all");
    var earn=await finnhub("stock/earnings?symbol="+co.ticker);
    console.log("[ThesisAlpha] Finnhub metric for "+co.ticker+":",met?"keys: "+Object.keys(met.metric||{}).length:"null");
    console.log("[ThesisAlpha] Finnhub earnings for "+co.ticker+":",earn?earn.length+" quarters":"null");
    if(met&&met.metric){var m=met.metric;
      // Build raw snapshot for display regardless of KPIs
      if(earn&&earn.length&&earn[0].actual!=null)snapshot.eps={label:"EPS",value:"$"+earn[0].actual,beat:earn[0].estimate!=null?earn[0].actual>=earn[0].estimate:null,detail:earn[0].estimate!=null?"Est: $"+earn[0].estimate:""};
      if(m["revenuePerShareTTM"])snapshot.revPerShare={label:"Revenue/Share",value:"$"+m["revenuePerShareTTM"].toFixed(2)};
      if(m["grossMarginTTM"]!=null)snapshot.grossMargin={label:"Gross Margin",value:(m["grossMarginTTM"]).toFixed(1)+"%"};
      if(m["operatingMarginTTM"]!=null)snapshot.opMargin={label:"Operating Margin",value:(m["operatingMarginTTM"]).toFixed(1)+"%"};
      if(m["netProfitMarginTTM"]!=null)snapshot.netMargin={label:"Net Margin",value:(m["netProfitMarginTTM"]).toFixed(1)+"%"};
      if(m["roeTTM"]!=null)snapshot.roe={label:"ROE",value:(m["roeTTM"]).toFixed(1)+"%"};
      if(m["roicTTM"]!=null)snapshot.roic={label:"ROIC",value:(m["roicTTM"]).toFixed(1)+"%"};
      if(m["currentRatioQuarterly"])snapshot.currentRatio={label:"Current Ratio",value:m["currentRatioQuarterly"].toFixed(2)};
      if(m["totalDebt/totalEquityQuarterly"])snapshot.debtEquity={label:"Debt/Equity",value:m["totalDebt/totalEquityQuarterly"].toFixed(2)};
      if(m["peTTM"])snapshot.pe={label:"P/E",value:m["peTTM"].toFixed(1)};
      if(m["pbQuarterly"])snapshot.pb={label:"P/B",value:m["pbQuarterly"].toFixed(2)};
      if(m["freeCashFlowPerShareTTM"])snapshot.fcf={label:"FCF/Share",value:"$"+m["freeCashFlowPerShareTTM"].toFixed(2)};
      if(m["revenueGrowthTTMYoy"]!=null)snapshot.revGrowth={label:"Rev Growth YoY",value:(m["revenueGrowthTTMYoy"]).toFixed(1)+"%",positive:m["revenueGrowthTTMYoy"]>=0};
      if(m["epsGrowthTTMYoy"]!=null)snapshot.epsGrowth={label:"EPS Growth YoY",value:(m["epsGrowthTTMYoy"]).toFixed(1)+"%",positive:m["epsGrowthTTMYoy"]>=0};
      if(m["52WeekHigh"])snapshot.hi52={label:"52w High",value:"$"+m["52WeekHigh"].toFixed(2)};
      if(m["52WeekLow"])snapshot.lo52={label:"52w Low",value:"$"+m["52WeekLow"].toFixed(2)};
      // Map Finnhub data to predefined metric IDs
      fhMap={
        eps:{v:earn&&earn.length?earn[0].actual:null,label:earn&&earn.length?"$"+earn[0].actual:"N/A"},
        grossMargin:{v:m["grossMarginTTM"]!=null?m["grossMarginTTM"]:null,label:m["grossMarginTTM"]!=null?m["grossMarginTTM"].toFixed(1)+"%":"N/A"},
        opMargin:{v:m["operatingMarginTTM"]!=null?m["operatingMarginTTM"]:null,label:m["operatingMarginTTM"]!=null?m["operatingMarginTTM"].toFixed(1)+"%":"N/A"},
        netMargin:{v:m["netProfitMarginTTM"]!=null?m["netProfitMarginTTM"]:null,label:m["netProfitMarginTTM"]!=null?m["netProfitMarginTTM"].toFixed(1)+"%":"N/A"},
        roe:{v:m["roeTTM"]!=null?m["roeTTM"]:null,label:m["roeTTM"]!=null?m["roeTTM"].toFixed(1)+"%":"N/A"},
        roa:{v:m["roaTTM"]!=null?m["roaTTM"]:null,label:m["roaTTM"]!=null?m["roaTTM"].toFixed(1)+"%":"N/A"},
        roic:{v:m["roicTTM"]!=null?m["roicTTM"]:null,label:m["roicTTM"]!=null?m["roicTTM"].toFixed(1)+"%":"N/A"},
        revGrowth:{v:m["revenueGrowthTTMYoy"]!=null?m["revenueGrowthTTMYoy"]:null,label:m["revenueGrowthTTMYoy"]!=null?m["revenueGrowthTTMYoy"].toFixed(1)+"%":"N/A"},
        epsGrowth:{v:m["epsGrowthTTMYoy"]!=null?m["epsGrowthTTMYoy"]:null,label:m["epsGrowthTTMYoy"]!=null?m["epsGrowthTTMYoy"].toFixed(1)+"%":"N/A"},
        revPerShare:{v:m["revenuePerShareTTM"],label:m["revenuePerShareTTM"]?"$"+m["revenuePerShareTTM"].toFixed(2):"N/A"},
        fcfPerShare:{v:m["freeCashFlowPerShareTTM"],label:m["freeCashFlowPerShareTTM"]?"$"+m["freeCashFlowPerShareTTM"].toFixed(2):"N/A"},
        pe:{v:m["peTTM"],label:m["peTTM"]?m["peTTM"].toFixed(1):"N/A"},
        pb:{v:m["pbQuarterly"],label:m["pbQuarterly"]?m["pbQuarterly"].toFixed(2):"N/A"},
        currentRatio:{v:m["currentRatioQuarterly"],label:m["currentRatioQuarterly"]?m["currentRatioQuarterly"].toFixed(2):"N/A"},
        debtEquity:{v:m["totalDebt/totalEquityQuarterly"],label:m["totalDebt/totalEquityQuarterly"]?m["totalDebt/totalEquityQuarterly"].toFixed(2):"N/A"},
        divYield:{v:m["dividendYieldIndicatedAnnual"]!=null?m["dividendYieldIndicatedAnnual"]:null,label:m["dividendYieldIndicatedAnnual"]!=null?m["dividendYieldIndicatedAnnual"].toFixed(2)+"%":"N/A"},
        bvps:{v:m["bookValuePerShareQuarterly"],label:m["bookValuePerShareQuarterly"]?"$"+m["bookValuePerShareQuarterly"].toFixed(2):"N/A"},
        ebitdaPerShare:{v:m["ebitdPerShareTTM"],label:m["ebitdPerShareTTM"]?"$"+m["ebitdPerShareTTM"].toFixed(2):"N/A"}};
      // Get quarter from earnings data
      if(earn&&earn.length){quarter="Q"+(earn[0].quarter||"?")+" "+(earn[0].year||"");
        srcUrl="https://finnhub.io/";srcLabel="Finnhub"}
      // Build summary from Finnhub data
      var sumParts=[];
      if(earn&&earn.length&&earn[0].actual!=null)sumParts.push("EPS: $"+earn[0].actual+(earn[0].estimate!=null?" (est: $"+earn[0].estimate+")":""));
      if(m["revenuePerShareTTM"])sumParts.push("Rev/sh: $"+m["revenuePerShareTTM"].toFixed(2));
      if(m["grossMarginTTM"]!=null)sumParts.push("Gross: "+(m["grossMarginTTM"]).toFixed(1)+"%");
      if(m["roeTTM"]!=null)sumParts.push("ROE: "+(m["roeTTM"]).toFixed(1)+"%");
      summary=(quarter||"Latest")+": "+sumParts.join(", ");
    }}catch(e){console.warn("Finnhub metrics:",e)}

  // Step 2: FMP key-metrics + ratios (Starter plan — fills Finnhub gaps)
  try{var fmpM=await fetchFMPMetrics(co.ticker);
    if(fmpM){var ra=fmpM.ratios;var km=fmpM.km;
      // Build FMP metric map — only values that exist
      var fmpMap={
        grossMargin:{v:ra.grossProfitMarginTTM!=null?ra.grossProfitMarginTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        opMargin:{v:ra.operatingProfitMarginTTM!=null?ra.operatingProfitMarginTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        netMargin:{v:ra.netProfitMarginTTM!=null?ra.netProfitMarginTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        roe:{v:ra.returnOnEquityTTM!=null?ra.returnOnEquityTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        roa:{v:ra.returnOnAssetsTTM!=null?ra.returnOnAssetsTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        roic:{v:ra.returnOnCapitalEmployedTTM!=null?ra.returnOnCapitalEmployedTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        pe:{v:km.peRatioTTM!=null?km.peRatioTTM:null,fmt:function(v){return v.toFixed(1)}},
        pb:{v:km.priceToBookRatioTTM!=null?km.priceToBookRatioTTM:null,fmt:function(v){return v.toFixed(2)}},
        currentRatio:{v:ra.currentRatioTTM!=null?ra.currentRatioTTM:null,fmt:function(v){return v.toFixed(2)}},
        debtEquity:{v:km.debtToEquityTTM!=null?km.debtToEquityTTM:null,fmt:function(v){return v.toFixed(2)}},
        divYield:{v:km.dividendYieldTTM!=null?km.dividendYieldTTM*100:null,fmt:function(v){return v.toFixed(2)+"%"}},
        revPerShare:{v:km.revenuePerShareTTM!=null?km.revenuePerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}},
        fcfPerShare:{v:km.freeCashFlowPerShareTTM!=null?km.freeCashFlowPerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}},
        bvps:{v:km.bookValuePerShareTTM!=null?km.bookValuePerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}},
        ebitdaPerShare:{v:km.enterpriseValueOverEBITDATTM!=null?km.enterpriseValueOverEBITDATTM:null,fmt:function(v){return v.toFixed(2)}},
        revGrowth:{v:ra.revenueGrowthTTM!=null?ra.revenueGrowthTTM*100:(km.revenueGrowthTTM!=null?km.revenueGrowthTTM*100:null),fmt:function(v){return v.toFixed(1)+"%"}},
        epsGrowth:{v:km.earningsGrowthTTM!=null?km.earningsGrowthTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        eps:{v:km.netIncomePerShareTTM!=null?km.netIncomePerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}}};
      // Fill gaps: merge FMP into fhMap where Finnhub returned null
      var fmpFilled=0;
      Object.keys(fmpMap).forEach(function(key){
        if(fmpMap[key].v!=null){
          if(!fhMap[key]||fhMap[key].v==null){
            fhMap[key]={v:fmpMap[key].v,label:fmpMap[key].fmt(fmpMap[key].v)+" (FMP)"};fmpFilled++}
        }});
      // Enrich snapshot with FMP data where Finnhub didn't have it
      if(!snapshot.grossMargin&&fmpMap.grossMargin.v!=null)snapshot.grossMargin={label:"Gross Margin",value:fmpMap.grossMargin.fmt(fmpMap.grossMargin.v),source:"FMP"};
      if(!snapshot.opMargin&&fmpMap.opMargin.v!=null)snapshot.opMargin={label:"Operating Margin",value:fmpMap.opMargin.fmt(fmpMap.opMargin.v),source:"FMP"};
      if(!snapshot.netMargin&&fmpMap.netMargin.v!=null)snapshot.netMargin={label:"Net Margin",value:fmpMap.netMargin.fmt(fmpMap.netMargin.v),source:"FMP"};
      if(!snapshot.roe&&fmpMap.roe.v!=null)snapshot.roe={label:"ROE",value:fmpMap.roe.fmt(fmpMap.roe.v),source:"FMP"};
      if(!snapshot.roic&&fmpMap.roic.v!=null)snapshot.roic={label:"ROIC",value:fmpMap.roic.fmt(fmpMap.roic.v),source:"FMP"};
      if(!snapshot.pe&&fmpMap.pe.v!=null)snapshot.pe={label:"P/E",value:fmpMap.pe.fmt(fmpMap.pe.v),source:"FMP"};
      if(!snapshot.pb&&fmpMap.pb.v!=null)snapshot.pb={label:"P/B",value:fmpMap.pb.fmt(fmpMap.pb.v),source:"FMP"};
      if(!snapshot.currentRatio&&fmpMap.currentRatio.v!=null)snapshot.currentRatio={label:"Current Ratio",value:fmpMap.currentRatio.fmt(fmpMap.currentRatio.v),source:"FMP"};
      if(!snapshot.debtEquity&&fmpMap.debtEquity.v!=null)snapshot.debtEquity={label:"Debt/Equity",value:fmpMap.debtEquity.fmt(fmpMap.debtEquity.v),source:"FMP"};
      if(!snapshot.fcf&&fmpMap.fcfPerShare.v!=null)snapshot.fcf={label:"FCF/Share",value:fmpMap.fcfPerShare.fmt(fmpMap.fcfPerShare.v),source:"FMP"};
      if(!snapshot.revGrowth&&fmpMap.revGrowth.v!=null)snapshot.revGrowth={label:"Rev Growth YoY",value:fmpMap.revGrowth.fmt(fmpMap.revGrowth.v),positive:fmpMap.revGrowth.v>=0,source:"FMP"};
      if(!snapshot.epsGrowth&&fmpMap.epsGrowth.v!=null)snapshot.epsGrowth={label:"EPS Growth YoY",value:fmpMap.epsGrowth.fmt(fmpMap.epsGrowth.v),positive:fmpMap.epsGrowth.v>=0,source:"FMP"};
      // Extra FMP-only metrics for snapshot
      if(km.marketCapTTM!=null&&!snapshot.mktCap)snapshot.mktCap={label:"Market Cap",value:"$"+(km.marketCapTTM/1e9).toFixed(1)+"B",source:"FMP"};
      if(km.evToSalesTTM!=null&&!snapshot.evSales)snapshot.evSales={label:"EV/Sales",value:km.evToSalesTTM.toFixed(1)+"x",source:"FMP"};
      if(km.evToFreeCashFlowTTM!=null&&!snapshot.evFcf)snapshot.evFcf={label:"EV/FCF",value:km.evToFreeCashFlowTTM.toFixed(1)+"x",source:"FMP"};
      if(ra.payoutRatioTTM!=null&&!snapshot.payoutRatio)snapshot.payoutRatio={label:"Payout Ratio",value:(ra.payoutRatioTTM*100).toFixed(0)+"%",source:"FMP"};
      if(km.tangibleBookValuePerShareTTM!=null&&!snapshot.tangBvps)snapshot.tangBvps={label:"Tangible BV/Share",value:"$"+km.tangibleBookValuePerShareTTM.toFixed(2),source:"FMP"};
      if(km.grahamNumberTTM!=null&&!snapshot.graham)snapshot.graham={label:"Graham Number",value:"$"+km.grahamNumberTTM.toFixed(2),source:"FMP"};
      if(!srcLabel&&fmpFilled>0){srcUrl="https://financialmodelingprep.com";srcLabel="FMP"}
      console.log("[ThesisAlpha] FMP enriched "+co.ticker+": "+fmpFilled+" gaps filled, snapshot now "+Object.keys(snapshot).length+" keys");
    }}catch(e){console.warn("FMP metrics enrichment:",e)}

  // Step 3: Match user's tracked KPIs from merged map
  if(kpis&&kpis.length){kpis.forEach(function(k){
    var metricId=resolveMetricId(k);
    var found=metricId?fhMap[metricId]:null;
    if(found&&found.v!=null){results.push({kpi_name:k.metricId||metricId||k.name,actual_value:found.v,status:eS(k.rule,k.value,found.v),excerpt:found.label})}
    else if(metricId&&!isCustomKpi(metricId)){results.push({kpi_name:k.metricId||metricId||k.name,actual_value:null,status:"unclear",excerpt:"Not available from Finnhub or FMP"})}})}

  if(!results.length&&!quarter&&!Object.keys(snapshot).length)return{found:false,reason:"No earnings data found for "+co.ticker+". Neither Finnhub nor FMP returned metrics."};
  console.log("[ThesisAlpha] fetchEarnings result for "+co.ticker+":",{found:true,quarter:quarter,resultsCount:results.length,snapshotKeys:Object.keys(snapshot).length,summary:summary.substring(0,80)});
  return{found:true,quarter:quarter||"Latest",summary:summary||"Earnings data retrieved.",results:results,sourceUrl:srcUrl,sourceLabel:srcLabel||"Finnhub+FMP",snapshot:snapshot}}
// Earnings date lookup — Finnhub only ($0, no AI)
async function lookupNextEarnings(ticker){
  try{var from3=new Date(Date.now()-30*86400000).toISOString().slice(0,10);var to3=new Date(Date.now()+120*86400000).toISOString().slice(0,10);
    var ec=await finnhub("calendar/earnings?symbol="+ticker+"&from="+from3+"&to="+to3);
    if(ec&&ec.earningsCalendar&&ec.earningsCalendar.length){
      var now=new Date().toISOString().slice(0,10);
      var upcoming=ec.earningsCalendar.filter(function(e){return e.date>=now}).sort(function(a,b){return a.date>b.date?1:-1});
      if(upcoming.length)return{earningsDate:upcoming[0].date,earningsTime:upcoming[0].hour===0?"BMO":upcoming[0].hour===1?"AMC":"TBD"};
      var recent=ec.earningsCalendar.sort(function(a,b){return b.date>a.date?1:-1});
      if(recent.length)return{earningsDate:recent[0].date,earningsTime:recent[0].hour===0?"BMO":recent[0].hour===1?"AMC":"TBD"}}}catch(e){}
  return{earningsDate:"TBD",earningsTime:"TBD"}}
// Finnhub data — all FREE tier ($0)
async function fetchInsiders(ticker){try{var r=await finnhub("stock/insider-transactions?symbol="+ticker);return r&&r.data?(r.data).slice(0,15):[]}catch(e){return[]}}
async function fetchRecommendations(ticker){try{var r=await finnhub("stock/recommendation?symbol="+ticker);return(r||[]).slice(0,6)}catch(e){return[]}}
async function fetchEPSHistory(ticker){try{var r=await finnhub("stock/earnings?symbol="+ticker);return(r||[]).slice(0,8)}catch(e){return[]}}
async function fetchPeers(ticker){try{var r=await finnhub("stock/peers?symbol="+ticker);return(r||[]).filter(function(p){return p!==ticker}).slice(0,8)}catch(e){return[]}}
async function fetchCompanyNews(ticker,days){try{var to=new Date().toISOString().slice(0,10);var from=new Date(Date.now()-(days||14)*86400000).toISOString().slice(0,10);
  var n=await finnhub("company-news?symbol="+ticker+"&from="+from+"&to="+to);return(n||[]).slice(0,8)}catch(e){return[]}}
// SEC filings from Finnhub (FREE, $0)
async function fetchFilings(ticker){try{var r=await finnhub("stock/filings?symbol="+ticker+"&from="+new Date(Date.now()-180*86400000).toISOString().slice(0,10));return(r||[]).slice(0,12)}catch(e){return[]}}
async function fetchPriceTarget(ticker){try{var r=await finnhub("stock/price-target?symbol="+ticker);return r&&r.targetMean?r:null}catch(e){return null}}

// ═══ THEME SYSTEM ═══
var DARK={bg:"#1a1a1a",side:"#141414",card:"#242424",bdr:"#333333",bdr2:"#444444",txt:"#eeeeee",mid:"#b0b0b0",dim:"#777777",blue:"#6ea8fe",grn:"#4ade80",red:"#f87171",amb:"#fbbf24",acc:"#a0a0a0",prim:"#ffffff",primTxt:"#1a1a1a"};
var LIGHT={bg:"#f7f7f7",side:"#ffffff",card:"#ffffff",bdr:"#e0e0e0",bdr2:"#d0d0d0",txt:"#1a1a1a",mid:"#4a4a4a",dim:"#888888",blue:"#2563eb",grn:"#16a34a",red:"#dc2626",amb:"#d97706",acc:"#555555",prim:"#1a1a1a",primTxt:"#ffffff"};
var FOREST={bg:"#f0f0f0",side:"#235a00",card:"#ffffff",bdr:"#e5e5e5",bdr2:"#d4d4d4",txt:"#4b4b4b",mid:"#6f6f6f",dim:"#afafaf",blue:"#1cb0f6",grn:"#58cc02",red:"#ff4b4b",amb:"#ffc800",acc:"#58cc02",prim:"#58cc02",primTxt:"#ffffff",purple:"#ce82ff"};
var PURPLE={bg:"#13111c",side:"#0e0c16",card:"#1e1a2e",bdr:"#302a48",bdr2:"#443c64",txt:"#e8e4f0",mid:"#a89fc4",dim:"#6b6188",blue:"#818cf8",grn:"#4ade80",red:"#f87171",amb:"#fbbf24",acc:"#a78bfa",prim:"#a78bfa",primTxt:"#13111c"};
var BLOOMBERG={bg:"#000000",side:"#0a0a0a",card:"#1a1a1a",bdr:"#333333",bdr2:"#444444",txt:"#ffffff",mid:"#cccccc",dim:"#888888",blue:"#4488ff",grn:"#00d26a",red:"#ff3333",amb:"#ff8800",acc:"#ff8800",prim:"#ff8800",primTxt:"#000000"};
var PAYPAL={bg:"#f5f7fa",side:"#003087",card:"#ffffff",bdr:"#d9e2ef",bdr2:"#c1cee0",txt:"#1a1a2e",mid:"#4a5568",dim:"#8899aa",blue:"#003087",grn:"#00a651",red:"#d93025",amb:"#f5a623",acc:"#003087",prim:"#003087",primTxt:"#ffffff"};
var THEMES={dark:DARK,light:LIGHT,forest:FOREST,purple:PURPLE,paypal:PAYPAL,bloomberg:BLOOMBERG};
var fm="'JetBrains Mono','SF Mono',monospace",fh="'Instrument Serif',Georgia,serif",fb="'DM Sans','Helvetica Neue',sans-serif";
function TLogo(p){var s=p.size||28;return<img src="/logo.png" width={s} height={s} style={{borderRadius:6,objectFit:"contain"}} alt="T"/>}
// (sector suggestions removed — using predefined METRICS dropdown)
var FOLDERS=[{id:"why-i-own",label:"Why I Own It",icon:"lightbulb"},{id:"my-writeups",label:"Investment Memos",icon:"edit"},{id:"deep-dives",label:"Research Clips",icon:"link"},{id:"reports",label:"IR Library",icon:"bar"},{id:"notes",label:"Quick Notes",icon:"file"}];
var SAMPLE=[{id:1,ticker:"NVDA",name:"NVIDIA Corporation",sector:"Semiconductors",domain:"nvidia.com",irUrl:"https://investor.nvidia.com",earningsDate:"2026-02-26",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:"https://investor.nvidia.com",sourceLabel:"Q4 FY26",earningSummary:"Data Center revenue surged 93% YoY to $39.2B.",description:"NVIDIA designs and sells graphics processing units and system-on-chip units. The company's GPUs are the dominant platform for AI training and inference, powering data centers for hyperscalers, enterprises, and sovereign AI initiatives worldwide.",ceo:"Jensen Huang",employees:29600,country:"US",exchange:"NASDAQ",ipoDate:"1999-01-22",mktCap:3400000000000,thesisNote:"AI capex cycle still early innings.\n\n## MOAT\nNVIDIA owns the CUDA ecosystem — switching costs are massive. Every ML framework, every training pipeline, every inference stack is optimized for NVIDIA GPUs. This is a platform moat, not just a hardware moat.\n\n## RISKS\nCustom silicon (Google TPU, Amazon Trainium, AMD MI300) could erode share. Concentration in hyperscaler capex — if AI spending pauses, revenue craters.\n\n## SELL CRITERIA\nData Center growth below 30% YoY for 2 consecutive quarters. Gross margins below 65% sustained. Major customer (MSFT/GOOG/AMZN) publicly shifting >50% of AI training to non-NVIDIA silicon.",investStyle:"growth",position:{shares:50,avgCost:128.5},conviction:9,convictionHistory:[{date:"2025-06-01",rating:8,note:"Strong but expensive"},{date:"2025-11-20",rating:9,note:"Data center demand insatiable"},{date:"2026-01-15",rating:9,note:"AI capex still accelerating"}],status:"portfolio",docs:[{id:1,title:"Core Thesis: AI Infrastructure",folder:"why-i-own",content:"NVIDIA is the picks-and-shovels play on AI. Data center GPU demand is insatiable.",updatedAt:"2026-01-15T10:00:00Z"}],earningsHistory:[{quarter:"Q3 2025",summary:"Revenue $35.1B (+94% YoY). Data Center $30.8B. Gross margin 74.6%.",results:[{kpi_name:"Data Center Revenue",actual_value:30.8,status:"met",excerpt:"Data Center $30.8B"},{kpi_name:"Gross Margin",actual_value:74.6,status:"met",excerpt:"GAAP GM 74.6%"}],sourceUrl:"https://investor.nvidia.com",sourceLabel:"NVIDIA Press Release",checkedAt:"2025-11-20T18:00:00Z"},{quarter:"Q2 2025",summary:"Revenue $30.0B (+122% YoY). Data Center $26.3B. Gross margin 75.1%.",results:[{kpi_name:"Data Center Revenue",actual_value:26.3,status:"met",excerpt:"Data Center $26.3B"},{kpi_name:"Gross Margin",actual_value:75.1,status:"met",excerpt:"GAAP GM 75.1%"}],sourceUrl:"https://investor.nvidia.com",sourceLabel:"NVIDIA Press Release",checkedAt:"2025-08-28T18:00:00Z"}],kpis:[{id:1,name:"Data Center Revenue",target:"≥35B",rule:"gte",value:35,unit:"B",period:"Q4 FY26",notes:"",lastResult:{actual:39.2,status:"met",excerpt:"Data Center revenue was $39.2B."}},{id:2,name:"Gross Margin",target:"≥73%",rule:"gte",value:73,unit:"%",period:"Q4 FY26",notes:"GAAP",lastResult:{actual:73.5,status:"met",excerpt:"GAAP gross margin was 73.5%."}}]},{id:2,ticker:"CRWD",name:"CrowdStrike",sector:"Cybersecurity",domain:"crowdstrike.com",irUrl:"https://ir.crowdstrike.com",earningsDate:"2026-03-04",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:null,sourceLabel:null,earningSummary:null,description:"CrowdStrike provides cloud-delivered endpoint and workload protection. Its Falcon platform uses AI to detect and prevent breaches in real time across endpoints, cloud workloads, identity, and data.",ceo:"George Kurtz",employees:8500,country:"US",exchange:"NASDAQ",ipoDate:"2019-06-12",mktCap:85000000000,thesisNote:"Post-outage recovery.\n\n## MOAT\nFalcon platform has deep endpoint integration — rip-and-replace is painful. Threat intelligence network effect: more endpoints = better detection.\n\n## RISKS\nBrand damage from July 2024 outage may linger. Competitive pressure from SentinelOne, Palo Alto. Government contracts at risk.\n\n## SELL CRITERIA\nGross retention dropping below 95%. Net new ARR below $200M for 2+ quarters. Another major incident.",investStyle:"growth",position:{shares:0,avgCost:0},conviction:6,convictionHistory:[{date:"2025-09-01",rating:5,note:"Outage fallout"},{date:"2026-01-10",rating:6,note:"Recovery underway"}],status:"watchlist",docs:[],earningsHistory:[],kpis:[{id:1,name:"Net New ARR",target:"≥220M",rule:"gte",value:220,unit:"M",period:"Q4 FY26",notes:"",lastResult:null},{id:2,name:"Gross Retention",target:"≥95%",rule:"gte",value:95,unit:"%",period:"Q4 FY26",notes:"",lastResult:null}]}];
var dU=function(d){if(!d||d==="TBD")return 999;return Math.ceil((new Date(d)-new Date())/864e5)};
var fD=function(d){try{return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch(e){return d}};
var fT=function(ts){if(!ts)return"";var d=new Date(ts);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})};
var nId=function(a){return a.length?Math.max.apply(null,a.map(function(x){return x.id}))+1:1};
function gH(kpis){var ev=kpis.filter(function(k){return k.lastResult});if(!ev.length)return{l:"Pending",c:"#6B7280"};var m=ev.filter(function(k){return k.lastResult.status==="met"}).length;var p=Math.round(m/ev.length*100);return p>=80?{l:"Strong",c:"#22C55E"}:p>=50?{l:"Mixed",c:"#F59E0B"}:{l:"Weak",c:"#EF4444"}}
var bT=function(r,v,u){return(r==="gte"?"≥":r==="lte"?"≤":"=")+" "+v+(u||"")};
var eS=function(r,t,a){var n=parseFloat(a);if(isNaN(n))return"unclear";return r==="gte"?(n>=t?"met":"missed"):r==="lte"?(n<=t?"met":"missed"):(n===t?"met":"missed")};
function CoLogo(p){var _s=useState(0),a=_s[0],sA=_s[1];var sz=p.size||24;
  if(p.domain&&a===0)return<img src={"https://logo.clearbit.com/"+p.domain} width={sz} height={sz} style={{borderRadius:4,background:"transparent",objectFit:"contain",flexShrink:0}} onError={function(){sA(1)}} alt=""/>;
  if(p.domain&&a===1)return<img src={"https://www.google.com/s2/favicons?domain="+p.domain+"&sz=64"} width={sz} height={sz} style={{borderRadius:4,background:"transparent",objectFit:"contain",flexShrink:0}} onError={function(){sA(2)}} alt=""/>;
  return<div style={{width:sz,height:sz,borderRadius:4,background:"rgba(128,128,128,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*.4,fontWeight:700,color:"rgba(128,128,128,.6)",fontFamily:fm,flexShrink:0}}>{(p.ticker||"?")[0]}</div>}
// ── Icon System (clean line SVGs, NotebookLM-inspired) ──
function IC(p){var s=p.size||16,c=p.color||"currentColor",w=p.strokeWidth||1.5;
  var paths={
    overview:"M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
    analysis:"M21 21H4.6c-.56 0-.84 0-1.054-.109a1 1 0 0 1-.437-.437C3 20.24 3 19.96 3 19.4V3m17 5-4.5 4.5L12 9l-4 4",
    journal:"M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z",
    moat:"M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h0M15 9h0",
    chart:"M3 3v18h18M7 16l4-4 4 4 5-6",
    link:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    book:"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
    target:"M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M2 12h2M20 12h2M12 2v2M12 20v2",
    shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    trending:"M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
    gear:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    dollar:"M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    castle:"M3 21h18M5 21V7l3-2 4-2 4 2 3 2v14",
    flask:"M10 2v6.292a1 1 0 0 1-.293.707L4.17 14.536A3 3 0 0 0 6.293 20h11.414A3 3 0 0 0 19.83 14.536L14.293 8.999A1 1 0 0 1 14 8.292V2M8.5 2h7",
    bar:"M18 20V10M12 20V4M6 20v-6",
    file:"M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7",
    folder:"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
    edit:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
    search:"M11 11m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0M21 21l-4.35-4.35",
    clock:"M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0M12 6v6l4 2",
    users:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    check:"M20 6L9 17l-5-5",
    plus:"M12 5v14M5 12h14",
    alert:"M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    dice:"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
    lightbulb:"M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
    news:"M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
    video:"M23 7l-7 5 7 5zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
    msg:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
  };
  var d=paths[p.name]||paths.file;
  return<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={p.style||{flexShrink:0}}><path d={d}/></svg>}

function mkS(K){return{btn:{background:"transparent",border:"1px solid "+K.bdr,color:K.mid,padding:"8px 16px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:fm,transition:"all .15s ease"},btnP:{background:K.prim,border:"1px solid "+K.prim,color:K.primTxt,padding:"9px 18px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:fm,fontWeight:600,transition:"all .15s ease"},btnD:{background:"transparent",border:"1px solid #7F1D1D",color:K.red,padding:"8px 16px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:fm,transition:"all .15s ease"},btnChk:{background:K.blue+"12",border:"1px solid "+K.blue+"40",color:K.blue,padding:"9px 18px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:fm,fontWeight:600,transition:"all .15s ease"},sec:{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:K.dim,marginBottom:12,fontWeight:600,fontFamily:fb,display:"flex",alignItems:"center",gap:8},badge:function(c){return{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:500,color:c,background:c+"15",padding:"3px 10px",borderRadius:6,fontFamily:fm}},dot:function(s){return{width:8,height:8,borderRadius:"50%",background:s==="met"?"#22C55E":s==="missed"?"#EF4444":"#555",flexShrink:0}}}}
function Modal(p){var K=p.K||DARK;var mob=typeof window!=="undefined"&&window.innerWidth<768;return<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(10px)",animation:"fadeInFast .15s ease-out"}} onClick={p.onClose}><div className="ta-slide ta-modal-inner" style={{background:K.card,border:mob?"none":"1px solid "+K.bdr2,borderRadius:mob?"16px 16px 0 0":16,padding:mob?"24px 20px 32px":"28px 32px",width:mob?"100%":p.w||500,maxWidth:mob?"100%":"92vw",maxHeight:mob?"90vh":"85vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,.4)"}} onClick={function(e){e.stopPropagation()}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><h2 style={{margin:0,fontSize:mob?15:17,fontWeight:500,color:K.txt,fontFamily:fh}}>{p.title}</h2><button onClick={p.onClose} style={{background:"none",border:"none",color:K.dim,fontSize:18,cursor:"pointer",padding:"4px 8px",borderRadius:6}} onMouseEnter={function(e){e.target.style.color=K.txt}} onMouseLeave={function(e){e.target.style.color=K.dim}}>{"✕"}</button></div>{p.children}</div></div>}
function Inp(p){var K=p.K||DARK;var b={width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fm,outline:"none"};return<div style={{marginBottom:16}}>{p.label&&<label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>{p.label}</label>}{p.ta?<textarea value={p.value} onChange={function(e){p.onChange(e.target.value)}} placeholder={p.placeholder} rows={3} style={Object.assign({},b,{resize:"vertical"})}/>:<input type={p.type||"text"} value={p.value} onChange={function(e){p.onChange(e.target.value)}} placeholder={p.placeholder} spellCheck={p.spellCheck!==undefined?p.spellCheck:true} autoCorrect={p.autoCorrect||"on"} autoComplete={p.autoComplete||"on"} style={b}/>}</div>}
function Sel(p){var K=p.K||DARK;return<div style={{marginBottom:16}}>{p.label&&<label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>{p.label}</label>}<select value={p.value} onChange={function(e){p.onChange(e.target.value)}} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fm,outline:"none"}}>{p.options.map(function(o){return<option key={o.v} value={o.v}>{o.l}</option>})}</select></div>}

// ═══ LOGIN ═══
function LoginPage(props){
  var _e=useState(""),email=_e[0],setEmail=_e[1];var _p=useState(""),pw=_p[0],setPw=_p[1];
  var _err=useState(""),err=_err[0],setErr=_err[1];var _mode=useState("login"),mode=_mode[0],setMode=_mode[1];
  var _ld=useState(false),ld2=_ld[0],setLd=_ld[1];
  var _th=useState(function(){try{return localStorage.getItem("ta-theme")||"light"}catch(e){return"light"}}),theme=_th[0],setTheme=_th[1];
  var K=theme==="dark"?DARK:LIGHT;
  function toggleTheme(){var n=theme==="dark"?"light":"dark";setTheme(n);try{localStorage.setItem("ta-theme",n)}catch(e){}}
  async function submit(){if(!email.trim()||!pw.trim()){setErr("Please fill in all fields.");return}setLd(true);setErr("");
    try{
      if(mode==="signup"){if(pw.length<6){setErr("Password must be 6+ characters.");setLd(false);return}
        var res=await supabase.auth.signUp({email:email.trim(),password:pw});
        if(res.error){setErr(res.error.message);setLd(false);return}
        if(res.data.user&&!res.data.session){setErr("Check your email for a confirmation link, then sign in.");setLd(false);setMode("login");return}
        props.onAuth(res.data.user)}
      else{var res2=await supabase.auth.signInWithPassword({email:email.trim(),password:pw});
        if(res2.error){setErr(res2.error.message);setLd(false);return}
        props.onAuth(res2.data.user)}
    }catch(e){setErr("Something went wrong.");setLd(false)}}
  return(<div style={{background:K.bg,color:K.txt,minHeight:"100vh",fontFamily:fb,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
  <button onClick={toggleTheme} style={{position:"absolute",top:20,right:24,background:"none",border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}}>{theme==="dark"?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}</button>
  <div className="ta-slide ta-login-box" style={{width:400,padding:"48px 40px",background:K.card,border:"1px solid "+K.bdr,borderRadius:20,boxShadow:theme==="dark"?"0 32px 64px rgba(0,0,0,.4)":"0 32px 64px rgba(0,0,0,.08)"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:28}}><TLogo size={24}/><span style={{fontSize:16,fontWeight:600,letterSpacing:2,fontFamily:fm,color:K.txt}}>ThesisAlpha</span></div>
    <h2 style={{fontSize:28,fontFamily:fh,fontWeight:400,margin:"0 0 8px",textAlign:"center",color:K.txt}}>{mode==="login"?"Welcome back":"Create account"}</h2>
    <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 32px"}}>{mode==="login"?"Sign in to your portfolio":"Start tracking your thesis"}</p>
    {err&&<div style={{background:K.red+"12",border:"1px solid "+K.red+"30",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:K.red}}>{err}</div>}
    <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Email</label>
      <input type="email" value={email} onChange={function(e){setEmail(e.target.value);setErr("")}} placeholder="you@email.com" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <div style={{marginBottom:24}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Password</label>
      <input type="password" value={pw} onChange={function(e){setPw(e.target.value);setErr("")}} placeholder={"••••••••"} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <button onClick={submit} disabled={ld2} style={{width:"100%",background:K.prim||K.acc,color:K.primTxt||"#fff",border:"none",padding:"14px",borderRadius:12,fontSize:14,fontWeight:600,cursor:ld2?"wait":"pointer",fontFamily:fb,marginBottom:16,opacity:ld2?.6:1}}>{ld2?"...":(mode==="login"?"Sign In":"Create Account")}</button>
    <div style={{textAlign:"center",fontSize:13,color:K.dim}}>{mode==="login"?"Don't have an account? ":"Already have an account? "}<span onClick={function(){setMode(mode==="login"?"signup":"login");setErr("")}} style={{color:K.acc,cursor:"pointer"}}>{mode==="login"?"Sign up":"Sign in"}</span></div>
  </div></div>)}

// ═══ TRACKER APP ═══
function TrackerApp(props){
  var _th=useState(function(){try{return localStorage.getItem("ta-theme")||"dark"}catch(e){return"dark"}}),theme=_th[0],setTheme=_th[1];
  var K=THEMES[theme]||DARK;var S=mkS(K);var isDark=theme==="dark"||theme==="purple"||theme==="bloomberg";
  // Per-theme font overrides — Forest uses Duolingo-style rounded fonts
  var isForest=theme==="forest";
  if(isForest){fm="'Nunito','DM Sans','Helvetica Neue',sans-serif";fh="'Nunito','DM Sans','Helvetica Neue',sans-serif";fb="'Nunito','DM Sans','Helvetica Neue',sans-serif";S=mkS(K)}
  else if(theme==="bloomberg"){fm="'Consolas','Courier New',monospace";fh="'Consolas','Courier New',monospace";fb="'Consolas','Courier New',monospace";S=mkS(K)}
  else{fm="'JetBrains Mono','SF Mono',monospace";fh="'Instrument Serif',Georgia,serif";fb="'DM Sans','Helvetica Neue',sans-serif";S=mkS(K)}
  var sideDark=isDark||theme==="forest"||theme==="paypal"; // Forest and PayPal have dark sidebar on light bg
  var sideText=sideDark?"#ffffff":K.txt;var sideMid=sideDark?"#ffffffcc":K.mid;var sideDim2=sideDark?"#ffffff88":K.dim;
  // Bloomberg Terminal overrides fonts via CSS injection (see global CSS useEffect)
  var bm=theme==="bloomberg";
  function cycleTheme(){var streakWeeks=(typeof streakData!=="undefined"&&streakData.current)||0;var available=["light","dark"];if(streakWeeks>=1){available.push("forest");available.push("purple")}if(streakWeeks>=3){available.push("paypal")}if(streakWeeks>=5){available.push("bloomberg")}var idx=available.indexOf(theme);var n=available[(idx+1)%available.length];setTheme(n);try{localStorage.setItem("ta-theme",n)}catch(e){}}
  function toggleTheme(){var n=theme==="light"?"dark":"light";setTheme(n);try{localStorage.setItem("ta-theme",n)}catch(e){}}
  var _c=useState(SAMPLE),cos=_c[0],setCos=_c[1];var _l=useState(false),loaded=_l[0],setLoaded=_l[1];
  var _s=useState(null),selId=_s[0],_setSelIdRaw=_s[1];
  function setSelId(id){_setSelIdRaw(id);try{if(id){window.history.pushState({selId:id},"",window.location.pathname)}else{window.history.pushState({page:page,selId:null},"",window.location.pathname)}}catch(e){}}var _ek=useState(null),expKpi=_ek[0],setExpKpi=_ek[1];
  var _sp=useState(null),subPage=_sp[0],setSubPage=_sp[1];
  var _dt=useState("dossier"),detailTab=_dt[0],setDetailTab=_dt[1];
  var _m=useState(null),modal=_m[0],setModal=_m[1];var _ck=useState({}),checkSt=_ck[0],setCheckSt=_ck[1];
  var _pg=useState("dashboard"),page=_pg[0],_setPageRaw=_pg[1];
  function setPage(p){_setPageRaw(p);try{window.history.pushState({page:p,selId:null},"",window.location.pathname)}catch(e){}}
  var _n=useState([]),notifs=_n[0],setNotifs=_n[1];var _sn=useState(false),showNotifs=_sn[0],setShowNotifs=_sn[1];
  var _st2=useState("portfolio"),sideTab=_st2[0],setSideTab=_st2[1];
  var _sideHov=useState(null),sideHover=_sideHov[0],setSideHover=_sideHov[1];
  var _flyY=useState(80),flyY=_flyY[0],setFlyY=_flyY[1];
  var _an=useState(function(){try{return localStorage.getItem("ta-autonotify")==="true"}catch(e){return false}}),autoNotify=_an[0],setAutoNotify=_an[1];
  var _em=useState(function(){try{return localStorage.getItem("ta-emailnotify")==="true"}catch(e){return false}}),emailNotify=_em[0],setEmailNotify=_em[1];
  var _pr=useState(false),priceLoading=_pr[0],setPriceLoading=_pr[1];
  // ── Subscription / Tier ──
  var FREE_LIMIT=3;var TRIAL_BASE=14;var TRIAL_BONUS=16;var TRIAL_TOTAL=TRIAL_BASE+TRIAL_BONUS;var THESIS_UNLOCK=3;
  var _plan=useState(function(){try{return localStorage.getItem("ta-plan")||"free"}catch(e){return"free"}}),plan=_plan[0],setPlan=_plan[1];
  var _stripeCustomer=useState(null),stripeCustomerId=_stripeCustomer[0],setStripeCustomerId=_stripeCustomer[1];
  var _showUpgrade=useState(false),showUpgrade=_showUpgrade[0],setShowUpgrade=_showUpgrade[1];
  var _upgradeCtx=useState(""),upgradeCtx=_upgradeCtx[0],setUpgradeCtx=_upgradeCtx[1];
  // ── Trial State ──
  var _trial=useState(function(){try{var t=localStorage.getItem("ta-trial");return t?JSON.parse(t):null}catch(e){return null}}),trial=_trial[0],setTrial=_trial[1];
  function saveTrial(t){setTrial(t);try{localStorage.setItem("ta-trial",JSON.stringify(t))}catch(e){}}
  // Trial computations
  var trialDaysLeft=trial&&trial.start?Math.max(0,Math.ceil(((trial.bonusEarned?TRIAL_TOTAL:TRIAL_BASE)*864e5+new Date(trial.start).getTime()-Date.now())/864e5)):0;
  var trialActive=trial&&trial.start&&trialDaysLeft>0;
  var trialExpired=trial&&trial.start&&trialDaysLeft<=0&&plan!=="pro";
  var trialBonusEarned=trial&&trial.bonusEarned;
  // Count complete theses (all 4 sections filled with >15 chars each)
  var completeTheses=cos.filter(function(c){if(!c.thesisNote)return false;var p=parseThesis(c.thesisNote);return p.core&&p.core.trim().length>15&&p.moat&&p.moat.trim().length>15&&p.risks&&p.risks.trim().length>15&&p.sell&&p.sell.trim().length>15}).length;
  var thesisProgress=Math.min(completeTheses,THESIS_UNLOCK);
  // isPro = paid subscriber OR active trial
  var isPro=plan==="pro"||trialActive;
  var canAdd=true; // Unlimited free companies — Pro gates data features, not company count
  function requirePro(ctx){if(isPro)return true;setUpgradeCtx(ctx||"");setShowUpgrade(true);return false}
  function openManage(){if(!stripeCustomerId){setShowUpgrade(true);setUpgradeCtx("manage");return}fetch("/api/stripe/portal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customerId:stripeCustomerId})}).then(function(r){return r.json()}).then(function(d){if(d.url)window.location.href=d.url}).catch(function(e){console.warn("Portal error:",e);setShowUpgrade(true);setUpgradeCtx("manage")})}
  var DEFAULT_DASH={portfolioView:"list",showSummary:true,showPrices:true,showPositions:true,showHeatmap:false,showSectors:false,showDividends:true,showAnalyst:false,showBuyZone:false,showPriceChart:true,showOwnerScore:true,showPreEarnings:true};
  var _ds=useState(function(){try{var s=localStorage.getItem("ta-dashsettings");return s?Object.assign({},DEFAULT_DASH,JSON.parse(s)):DEFAULT_DASH}catch(e){return DEFAULT_DASH}}),dashSet=_ds[0],setDashSet=_ds[1];
  
  var _wr=useState(function(){try{var s=localStorage.getItem('ta-weekly-reviews');return s?JSON.parse(s):[]}catch(e){return[]}}),weeklyReviews=_wr[0],setWeeklyReviews=_wr[1];
  function saveReview(rev){setWeeklyReviews(function(p){var n=[rev].concat(p).slice(0,100);try{localStorage.setItem('ta-weekly-reviews',JSON.stringify(n))}catch(e){}
    addXP(25,"Weekly review");updateStreak(true);
    if(p.length===0)setTimeout(function(){checkMilestone("first_review",String.fromCodePoint(0x1F6E1)+" First weekly review completed! Discipline starts here.");showCelebration(String.fromCodePoint(0x1F6E1)+" First Review","You completed your first weekly conviction check-in. This is how great investors build discipline.",null,"#4ade80")},500);
    return n})}
  function getWeekId(){var d=new Date();var day=d.getDay();var diff=d.getDate()-day+(day===0?-6:1);var mon=new Date(d.setDate(diff));return mon.toISOString().split('T')[0]}
  var currentWeekReviewed=weeklyReviews.length>0&&weeklyReviews[0].weekId===getWeekId();
  var reviewStreak=function(){var s=0;var wk=new Date();for(var i=0;i<weeklyReviews.length;i++){var rid=weeklyReviews[i].weekId;var expect=new Date(wk);expect.setDate(expect.getDate()-expect.getDay()+(expect.getDay()===0?-6:1)-s*7);var expId=expect.toISOString().split('T')[0];if(rid===expId)s++;else break}return s}();
  // Old reviewStreak milestones removed — handled by streakData system

  var ASSET_CLASSES=[
    {id:"stocks",label:"Stocks",color:"#F59E0B",icon:"trending"},
    {id:"crypto",label:"Crypto",color:"#8B5CF6",icon:"shield"},
    {id:"bonds",label:"Bonds",color:"#3B82F6",icon:"castle"},
    {id:"realestate",label:"Real Estate",color:"#10B981",icon:"book"},
    {id:"gold",label:"Gold",color:"#EAB308",icon:"dollar"},
    {id:"silver",label:"Silver",color:"#94A3B8",icon:"shield"},
    {id:"commodities",label:"Commodities",color:"#78716C",icon:"gear"},
    {id:"cash",label:"Cash & Savings",color:"#6366F1",icon:"dollar"},
    {id:"pension",label:"Pension / 401k",color:"#EC4899",icon:"castle"},
    {id:"alternatives",label:"Alternatives",color:"#14B8A6",icon:"flask"},
    {id:"other",label:"Other",color:"#A1A1AA",icon:"target"}
  ];
  var _assets=useState(function(){try{var s=localStorage.getItem('ta-assets');return s?JSON.parse(s):{positions:[],snapshots:[]}}catch(e){return{positions:[],snapshots:[]}}}),assets=_assets[0],setAssets=_assets[1];
  function saveAssets(fn){setAssets(function(prev){var next=typeof fn==="function"?fn(prev):fn;try{localStorage.setItem('ta-assets',JSON.stringify(next))}catch(e){}return next})}
  function toggleDash(key){setDashSet(function(p){var n=Object.assign({},p);n[key]=!n[key];try{localStorage.setItem("ta-dashsettings",JSON.stringify(n))}catch(e){}return n})}
  var _ob=useState(0),obStep=_ob[0],setObStep=_ob[1];
  var _obPath=useState(""),obPath=_obPath[0],setObPath=_obPath[1];
  var _mob=useState(false),isMobile=_mob[0],setIsMobile=_mob[1];
  var _sideOpen=useState(false),sideOpen=_sideOpen[0],setSideOpen=_sideOpen[1];
  var _dashGameExp=useState(function(){try{return localStorage.getItem("ta-dash-game-expanded")==="true"}catch(e){return false}}),dashGameExpanded=_dashGameExp[0],setDashGameExpanded=_dashGameExp[1];
  var _showListCfg=useState(false),showListCfg=_showListCfg[0],setShowListCfg=_showListCfg[1];
  function toggleDashGame(){var n=!dashGameExpanded;setDashGameExpanded(n);try{localStorage.setItem("ta-dash-game-expanded",n?"true":"false")}catch(e){}}
  var LEVELS=[{min:0,name:"Novice",next:25,icon:"🌱"},{min:25,name:"Apprentice",next:50,icon:"📚"},{min:50,name:"Practitioner",next:70,icon:"🔭"},{min:70,name:"Disciplined",next:85,icon:"⭐"},{min:85,name:"Master",next:100,icon:"🏆"}];
  function getLevel(score){var lv=LEVELS[0];LEVELS.forEach(function(l){if(score>=l.min)lv=l});return lv}
  // Toast system for celebrations
  var _toast=useState(null),toast=_toast[0],setToast=_toast[1];
  var _confetti=useState(false),showConfetti=_confetti[0],setConfetti=_confetti[1];
  function launchConfetti(duration){setConfetti(true);setTimeout(function(){setConfetti(false)},duration||3000)}
  function celebrate(msg,type,duration){showToast(msg,type||"levelup",duration||6000);launchConfetti(duration||3000)}
  // Celebration overlay for big moments
  var _celebOverlay=useState(null),celebOverlay=_celebOverlay[0],setCelebOverlay=_celebOverlay[1];
  function showCelebration(title,subtitle,icon,color){setCelebOverlay({title:title,subtitle:subtitle,icon:icon,color:color||K.acc});setTimeout(function(){setCelebOverlay(null)},4500)}
  // Track milestones for first-time celebrations
  var _milestones=useState(function(){try{var s=localStorage.getItem('ta-milestones');return s?JSON.parse(s):{}}catch(e){return{}}}),milestones=_milestones[0],setMilestones=_milestones[1];
  function checkMilestone(key,msg){if(!milestones[key]){var nm=Object.assign({},milestones);nm[key]=new Date().toISOString();setMilestones(nm);try{localStorage.setItem('ta-milestones',JSON.stringify(nm))}catch(e){}showToast(msg,"milestone",5000);return true}return false}
  var toastTimer=useRef(null);
  var _prevStreak=useRef(0);
  function showToast(msg,type,duration){setToast({msg:msg,type:type||"info"});if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(function(){setToast(null)},duration||5000)}
  // Owner's Score expanded state on dashboard
  var _osExp=useState(false),osExpanded=_osExp[0],setOsExpanded=_osExp[1];
  // ── XP System ──
  var _xp=useState(function(){try{return JSON.parse(localStorage.getItem("ta-xp"))||{total:0,history:[]}}catch(e){return{total:0,history:[]}}}),xp=_xp[0],setXp=_xp[1];
  var _xpFloat=useState(null),xpFloat=_xpFloat[0],setXpFloat=_xpFloat[1];
  var _showProfile=useState(false),showProfile=_showProfile[0],setShowProfile=_showProfile[1];
  var _avatarUrl=useState(function(){try{return localStorage.getItem("ta-avatar")||""}catch(e){return""}}),avatarUrl=_avatarUrl[0],setAvatarUrl=_avatarUrl[1];
  var avatarFileRef=useRef(null);
  var _username=useState(function(){try{return localStorage.getItem("ta-username")||""}catch(e){return""}}),username=_username[0],setUsername=_username[1];
  var _editingName=useState(false),editingName=_editingName[0],setEditingName=_editingName[1];
  var _nameInput=useState(""),nameInput=_nameInput[0],setNameInput=_nameInput[1];
  function saveUsername(){var n=nameInput.trim();if(!n)return;setUsername(n);try{localStorage.setItem("ta-username",n)}catch(e){}setEditingName(false);showToast("Username set to "+n,"info",3000)}
  // ── Owner's Chest System ──
  var INVESTOR_QUOTES=[
    {q:"The stock market is a device for transferring money from the impatient to the patient.",a:"Warren Buffett"},
    {q:"In the short run, the market is a voting machine but in the long run, it is a weighing machine.",a:"Benjamin Graham"},
    {q:"The best investment you can make is in yourself.",a:"Warren Buffett"},
    {q:"Risk comes from not knowing what you are doing.",a:"Warren Buffett"},
    {q:"The most important quality for an investor is temperament, not intellect.",a:"Warren Buffett"},
    {q:"It is remarkable how much long-term advantage people like us have gotten by trying to be consistently not stupid, instead of trying to be very intelligent.",a:"Charlie Munger"},
    {q:"Spend each day trying to be a little wiser than you were when you woke up.",a:"Charlie Munger"},
    {q:"The big money is not in the buying and selling, but in the waiting.",a:"Charlie Munger"},
    {q:"Knowing what you don't know is more useful than being brilliant.",a:"Charlie Munger"},
    {q:"Go to bed smarter than when you woke up.",a:"Charlie Munger"},
    {q:"Know what you own, and know why you own it.",a:"Peter Lynch"},
    {q:"The person that turns over the most rocks wins the game.",a:"Peter Lynch"},
    {q:"Never invest in any idea you can't illustrate with a crayon.",a:"Peter Lynch"},
    {q:"Behind every stock is a company. Find out what it's doing.",a:"Peter Lynch"},
    {q:"Time is the friend of the wonderful company, the enemy of the mediocre.",a:"Warren Buffett"},
    {q:"The four most dangerous words in investing are: this time it's different.",a:"John Templeton"},
    {q:"An investment in knowledge pays the best interest.",a:"Benjamin Franklin"},
    {q:"Price is what you pay. Value is what you get.",a:"Warren Buffett"},
    {q:"Only buy something that you'd be perfectly happy to hold if the market shut down for 10 years.",a:"Warren Buffett"},
    {q:"The goal of each investor should be to create a portfolio of look-through earnings that delivers the highest possible total a decade from now.",a:"Warren Buffett"},
    {q:"You make most of your money in a bear market, you just don't realize it at the time.",a:"Shelby Cullom Davis"},
    {q:"Investing without research is like playing stud poker and never looking at the cards.",a:"Peter Lynch"},
    {q:"Compound interest is the eighth wonder of the world.",a:"Albert Einstein"},
    {q:"The market is not a casino. Stocks represent fractional ownership of real businesses.",a:"Joel Greenblatt"},
    {q:"Buying good businesses at bargain prices is the secret to making lots of money.",a:"Joel Greenblatt"},
    {q:"We look for businesses that can compound at 15%+ with minimal risk.",a:"Dev Kantesaria"},
    {q:"Only invest in good companies, don't overpay, do nothing.",a:"Terry Smith"},
    {q:"We invest in quality businesses with strong free cash flow.",a:"Chris Hohn"},
    {q:"The trick is not to pick the right company. The trick is to essentially buy the whole stock market.",a:"John Bogle"},
    {q:"Do not take yearly results too seriously. Instead, focus on four or five year averages.",a:"Warren Buffett"}
  ];
  var BADGE_POOL=[
    {id:"disciplined_owner",label:"Disciplined Owner",icon:String.fromCodePoint(0x1F3AF),desc:"Completed 4+ weekly reviews"},
    {id:"consistent_compounder",label:"Consistent Compounder",icon:String.fromCodePoint(0x1F4C8),desc:"Maintained a 4+ week streak"},
    {id:"thesis_architect",label:"Thesis Architect",icon:String.fromCodePoint(0x1F4DD),desc:"Written theses for 5+ holdings"},
    {id:"conviction_caller",label:"Conviction Caller",icon:String.fromCodePoint(0x1F525),desc:"Rated conviction on all holdings"},
    {id:"process_master",label:"Process Master",icon:String.fromCodePoint(0x2B50),desc:"Reached level 10+"},
    {id:"iron_hand",label:"Iron Hand",icon:String.fromCodePoint(0x1F91D),desc:"8+ week streak without a freeze"},
    {id:"early_bird",label:"Early Bird",icon:String.fromCodePoint(0x1F426),desc:"Reviewed on Friday before market close"},
    {id:"deep_diver",label:"Deep Diver",icon:String.fromCodePoint(0x1F30A),desc:"Tracked 20+ KPIs across portfolio"}
  ];
  var _chestRewards=useState(function(){try{return JSON.parse(localStorage.getItem("ta-chest"))||{quotes:[],badges:[],history:[]}}catch(e){return{quotes:[],badges:[],history:[]}}}),chestRewards=_chestRewards[0],setChestRewards=_chestRewards[1];
  var _doubleXP=useState(function(){try{var d=localStorage.getItem("ta-doublexp");return d&&new Date(d)>new Date()?d:null}catch(e){return null}}),doubleXP=_doubleXP[0],setDoubleXP=_doubleXP[1];
  var _chestOverlay=useState(null),chestOverlay=_chestOverlay[0],setChestOverlay=_chestOverlay[1];
  var _latestWeeklyReward=useState(null),latestWeeklyReward=_latestWeeklyReward[0],setLatestWeeklyReward=_latestWeeklyReward[1];
  var isDoubleXP=doubleXP&&new Date(doubleXP)>new Date();
  // ── 7-Day Quest System ──
  var _questData=useState(function(){try{return JSON.parse(localStorage.getItem("ta-quests"))||{weekId:null,completed:[]}}catch(e){return{weekId:null,completed:[]}}}),questData=_questData[0],setQuestData=_questData[1];
  function completeQuest(qid){
    setQuestData(function(p){var n=Object.assign({},p,{weekId:getWeekId(),completed:(p.completed||[]).concat([qid])});try{localStorage.setItem("ta-quests",JSON.stringify(n))}catch(e){}return n});
    addXP(8,"Quest completed")}
  function openQuestChest(){
    // Guaranteed uncommon or better
    var roll=Math.random();var reward;
    if(roll<0.15){
      var locked=[{w:4,n:"Charlie Munger"},{w:8,n:"Warren Buffett"},{w:12,n:"Joel Greenblatt"},{w:16,n:"Peter Lynch"},{w:20,n:"Shelby Cullom Davis"},{w:24,n:"Chris Hohn"}];
      var nextLens=locked.find(function(l){return l.w>(streakData.current||0)});
      if(nextLens){reward={type:"lens",tier:"rare",label:"Early Lens Unlock!",desc:nextLens.n+" lens unlocked one week early!",icon:String.fromCodePoint(0x1F513),xp:30,lensWeek:nextLens.w}}
      else{reward={type:"xp",tier:"rare",label:"Jackpot!",desc:"+50 bonus points for quest mastery",icon:String.fromCodePoint(0x1F4B0),xp:50}}
    }else if(roll<0.5){
      reward={type:"doublexp",tier:"uncommon",label:"Double Points!",desc:"All actions give 2× points for the next 24 hours",icon:String.fromCodePoint(0x26A1),xp:0}
    }else if(roll<0.75){
      var unearned=BADGE_POOL.filter(function(b){return!(chestRewards.badges||[]).find(function(eb){return eb.id===b.id})});
      if(unearned.length>0){var badge=unearned[Math.floor(Math.random()*unearned.length)];
        reward={type:"badge",tier:"uncommon",label:"New Badge!",desc:badge.label+" — "+badge.desc,icon:badge.icon,xp:15,badge:badge}}
      else{reward={type:"xp",tier:"uncommon",label:"Bonus Points!",desc:"+25 process points",icon:String.fromCodePoint(0x2728),xp:25}}
    }else{
      var available=INVESTOR_QUOTES.filter(function(q){return!(chestRewards.quotes||[]).find(function(eq){return eq.q===q.q})});
      if(available.length>0){var quote=available[Math.floor(Math.random()*available.length)];
        reward={type:"quote",tier:"uncommon",label:"Rare Wisdom!",desc:quote.q,author:quote.a,icon:String.fromCodePoint(0x1F4DC),xp:10,quote:quote}}
      else{reward={type:"xp",tier:"uncommon",label:"Bonus Points!",desc:"+20 process points",icon:String.fromCodePoint(0x2728),xp:20}}}
    // Apply
    setChestRewards(function(p){
      var n=Object.assign({},p,{history:[{reward:reward.label,tier:reward.tier,date:new Date().toISOString()}].concat((p.history||[]).slice(0,50))});
      if(reward.type==="quote"&&reward.quote)n.quotes=(p.quotes||[]).concat([reward.quote]).slice(-30);
      if(reward.type==="badge"&&reward.badge)n.badges=(p.badges||[]).concat([reward.badge]);
      try{localStorage.setItem("ta-chest",JSON.stringify(n))}catch(e){}return n});
    if(reward.xp>0)addXP(reward.xp,"Quest reward: "+reward.label);
    if(reward.type==="freeze")setStreakData(function(p){var n=Object.assign({},p,{freezes:(p.freezes||0)+1});try{localStorage.setItem("ta-streak",JSON.stringify(n))}catch(e){}return n});
    if(reward.type==="doublexp"){var exp=new Date(Date.now()+86400000).toISOString();setDoubleXP(exp);try{localStorage.setItem("ta-doublexp",exp)}catch(e){}}
    if(reward.type==="lens"&&reward.lensWeek){setStreakData(function(p){var n=Object.assign({},p,{current:Math.max(p.current||0,reward.lensWeek)});try{localStorage.setItem("ta-streak",JSON.stringify(n))}catch(e){}return n})}
    setChestOverlay(reward)}
  function rollChestReward(){
    var roll=Math.random();var reward;
    if(roll<0.05){
      // RARE: Early lens unlock or badge
      if(Math.random()<0.5){
        // Early lens unlock
        var locked=[{w:4,n:"Charlie Munger"},{w:8,n:"Warren Buffett"},{w:12,n:"Joel Greenblatt"},{w:16,n:"Peter Lynch"},{w:20,n:"Shelby Cullom Davis"},{w:24,n:"Chris Hohn"}];
        var nextLens=locked.find(function(l){return l.w>(streakData.current||0)});
        if(nextLens){reward={type:"lens",tier:"rare",label:"Early Lens Unlock!",desc:nextLens.n+" lens unlocked one week early!",icon:String.fromCodePoint(0x1F513),xp:0,lensWeek:nextLens.w}}
        else{reward={type:"xp",tier:"rare",label:"Jackpot!",desc:"+50 bonus process points",icon:String.fromCodePoint(0x1F4B0),xp:50}}
      }else{
        // Badge
        var unearned=BADGE_POOL.filter(function(b){return!(chestRewards.badges||[]).find(function(eb){return eb.id===b.id})});
        if(unearned.length>0){var badge=unearned[Math.floor(Math.random()*unearned.length)];
          reward={type:"badge",tier:"rare",label:"New Badge!",desc:badge.label+" — "+badge.desc,icon:badge.icon,xp:10,badge:badge}}
        else{reward={type:"xp",tier:"rare",label:"Jackpot!",desc:"+50 bonus process points",icon:String.fromCodePoint(0x1F4B0),xp:50}}}
    }else if(roll<0.30){
      // UNCOMMON: Double points or insight quote
      if(Math.random()<0.6){
        reward={type:"doublexp",tier:"uncommon",label:"Double Points!",desc:"All actions give 2× points for the next 24 hours",icon:String.fromCodePoint(0x26A1),xp:0}}
      else{
        var available=INVESTOR_QUOTES.filter(function(q){return!(chestRewards.quotes||[]).find(function(eq){return eq.q===q.q})});
        if(available.length>0){var quote=available[Math.floor(Math.random()*available.length)];
          reward={type:"quote",tier:"uncommon",label:"Rare Quote!",desc:quote.q,author:quote.a,icon:String.fromCodePoint(0x1F4DC),xp:5,quote:quote}}
        else{reward={type:"xp",tier:"uncommon",label:"Bonus Points!",desc:"+15 process points",icon:String.fromCodePoint(0x2728),xp:15}}}
    }else{
      // COMMON: Bonus points or streak freeze or quote
      var r2=Math.random();
      if(r2<0.4){
        var bonusXP=[10,12,15,18,20][Math.floor(Math.random()*5)];
        reward={type:"xp",tier:"common",label:"+"+bonusXP+" Bonus",desc:"Extra process points for your dedication",icon:String.fromCodePoint(0x2B50),xp:bonusXP}}
      else if(r2<0.65){
        reward={type:"freeze",tier:"common",label:"Streak Freeze!",desc:"Protection against missing one week",icon:String.fromCodePoint(0x1F6E1),xp:0}}
      else{
        var available2=INVESTOR_QUOTES.filter(function(q){return!(chestRewards.quotes||[]).find(function(eq){return eq.q===q.q})});
        if(available2.length>0){var quote2=available2[Math.floor(Math.random()*available2.length)];
          reward={type:"quote",tier:"common",label:"Investor Wisdom",desc:quote2.q,author:quote2.a,icon:String.fromCodePoint(0x1F4D6),xp:0,quote:quote2}}
        else{reward={type:"xp",tier:"common",label:"+15 Bonus",desc:"Extra process points",icon:String.fromCodePoint(0x2B50),xp:15}}}}
    return reward}
  function openChest(){
    var reward=rollChestReward();
    // Apply reward
    setChestRewards(function(p){
      var n=Object.assign({},p,{history:[{reward:reward.label,tier:reward.tier,date:new Date().toISOString()}].concat((p.history||[]).slice(0,50))});
      if(reward.type==="quote"&&reward.quote)n.quotes=(p.quotes||[]).concat([reward.quote]).slice(-30);
      if(reward.type==="badge"&&reward.badge)n.badges=(p.badges||[]).concat([reward.badge]);
      try{localStorage.setItem("ta-chest",JSON.stringify(n))}catch(e){}return n});
    if(reward.xp>0)addXP(reward.xp,"Reward: "+reward.label);
    if(reward.type==="freeze")setStreakData(function(p){var n=Object.assign({},p,{freezes:(p.freezes||0)+1});try{localStorage.setItem("ta-streak",JSON.stringify(n))}catch(e){}return n});
    if(reward.type==="doublexp"){var exp=new Date(Date.now()+86400000).toISOString();setDoubleXP(exp);try{localStorage.setItem("ta-doublexp",exp)}catch(e){}}
    if(reward.type==="lens"&&reward.lensWeek){setStreakData(function(p){var n=Object.assign({},p,{current:Math.max(p.current||0,reward.lensWeek)});try{localStorage.setItem("ta-streak",JSON.stringify(n))}catch(e){}return n})}
    setChestOverlay(reward);setLatestWeeklyReward(reward)}
  function handleAvatarUpload(e){var f=e.target.files[0];if(!f)return;
    // Compress avatar to max 128x128 to keep cloud payload small
    var reader=new FileReader();reader.onload=function(ev){
      var img=new Image();img.onload=function(){
        var canvas=document.createElement("canvas");var sz=128;canvas.width=sz;canvas.height=sz;
        var ctx=canvas.getContext("2d");
        // Crop to square center
        var s=Math.min(img.width,img.height);var sx=(img.width-s)/2;var sy=(img.height-s)/2;
        ctx.drawImage(img,sx,sy,s,s,0,0,sz,sz);
        var url=canvas.toDataURL("image/jpeg",0.8);
        setAvatarUrl(url);try{localStorage.setItem("ta-avatar",url)}catch(e){}
      };img.src=ev.target.result};reader.readAsDataURL(f)}
  // ── XP Level Curve (Pokemon Go-inspired exponential) ──
  var XP_LEVELS=[0,50,120,200,300,500,750,1050,1400,1800,2300,2900,3600,4500,5600,7000,8700,10800,13500,17000,21000,26000,32000,39000,47000,56000,66000,78000,92000,108000,126000,147000,171000,198000,229000,264000,303000,347000,396000,451000,500000];
  function getXPLevel(totalXP){for(var i=XP_LEVELS.length-1;i>=0;i--){if(totalXP>=XP_LEVELS[i])return{level:i+1,xpForLevel:XP_LEVELS[i],xpForNext:i<XP_LEVELS.length-1?XP_LEVELS[i+1]:XP_LEVELS[i]*1.2,current:totalXP}}return{level:1,xpForLevel:0,xpForNext:50,current:0}}
  var xpLevel=getXPLevel(xp.total);
  var xpPct=xpLevel.xpForNext>xpLevel.xpForLevel?Math.round((xp.total-xpLevel.xpForLevel)/(xpLevel.xpForNext-xpLevel.xpForLevel)*100):100;
  function addXP(amount,label){
    var actualAmount=isDoubleXP?amount*2:amount;
    var prevLevel=getXPLevel(xp.total).level;
    trackDailyActivity();
    setXp(function(p){var n={total:p.total+actualAmount,history:[{amount:actualAmount,label:label+(isDoubleXP?" (2×)":""),date:new Date().toISOString()}].concat(p.history).slice(0,100)};try{localStorage.setItem("ta-xp",JSON.stringify(n))}catch(e){}
      var newLevel=getXPLevel(n.total).level;
      if(newLevel>prevLevel)setTimeout(function(){celebrate("Level "+newLevel+" reached!","levelup",6000);showCelebration(String.fromCodePoint(0x2B50)+" Level "+newLevel,"You're growing as an owner-operator. Keep building your process.",null,newLevel>=20?"#FFD700":newLevel>=10?K.grn:K.acc)},2500);
      return n});setXpFloat({amount:actualAmount,label:label+(isDoubleXP?" 2×":""),id:Date.now()});setTimeout(function(){setXpFloat(null)},2000)}
  // ── Weekly Streak with Freeze ──
  var _streakData=useState(function(){try{return JSON.parse(localStorage.getItem("ta-streak"))||{current:0,best:0,freezes:0,lastWeek:null,frozenWeek:null}}catch(e){return{current:0,best:0,freezes:0,lastWeek:null,frozenWeek:null}}}),streakData=_streakData[0],setStreakData=_streakData[1];
  // ── Daily Activity Streak ──
  var _dailyStreak=useState(function(){try{return JSON.parse(localStorage.getItem("ta-daily"))||{current:0,best:0,lastDate:null}}catch(e){return{current:0,best:0,lastDate:null}}}),dailyStreak=_dailyStreak[0],setDailyStreak=_dailyStreak[1];
  var todayStr=new Date().toISOString().slice(0,10);
  var didActivityToday=dailyStreak.lastDate===todayStr;
  function trackDailyActivity(){
    setDailyStreak(function(p){
      if(p.lastDate===todayStr)return p; // Already tracked today
      var yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
      var consecutive=p.lastDate===yesterday?(p.current||0)+1:1;
      var n={current:consecutive,best:Math.max(consecutive,p.best||0),lastDate:todayStr};
      try{localStorage.setItem("ta-daily",JSON.stringify(n))}catch(e){}
      if(consecutive>1&&consecutive>(p.current||0))showToast(consecutive+" day streak! Keep building the habit.","info",2500);
      return n})}
  function updateStreak(completed){setStreakData(function(p){var thisWeek=getWeekId();if(p.lastWeek===thisWeek)return p;var n=Object.assign({},p);if(completed){n.current=(p.current||0)+1;n.lastWeek=thisWeek;if(n.current>n.best)n.best=n.current;if(n.current%4===0)n.freezes=(n.freezes||0)+1}else{var lastW=p.lastWeek;var weeksGap=lastW?Math.floor((new Date()-new Date(lastW.replace(/W/g,"-W").replace(/^(\d{4})(\d{2})$/,"$1-W$2")))/604800000):99;if(weeksGap<=2&&p.freezes>0){n.freezes=p.freezes-1;n.frozenWeek=thisWeek}else{n.current=0}}try{localStorage.setItem("ta-streak",JSON.stringify(n))}catch(e){}
      // Check for new lens unlocks
      var newUnlock=null;[{w:4,n:"Charlie Munger"},{w:8,n:"Warren Buffett"},{w:12,n:"Joel Greenblatt"},{w:16,n:"Peter Lynch"},{w:20,n:"Shelby Cullom Davis"},{w:24,n:"Chris Hohn"}].forEach(function(u){if(n.current>=u.w&&(p.current||0)<u.w)newUnlock=u});
      if(newUnlock)setTimeout(function(){showToast("New lens unlocked: "+newUnlock.n+"! "+newUnlock.w+"-week streak reward.","milestone",6000)},1000);
      // Early streak rewards
      if(n.current>=1&&(p.current||0)<1)setTimeout(function(){showToast("Week 1 streak! Forest and Purple themes unlocked. Click the theme toggle to try them.","milestone",5000)},newUnlock?7500:1000);
      if(n.current>=2&&(p.current||0)<2)setTimeout(function(){showToast("Week 2 streak! Research Export Pack unlocked. Export your thesis + data for AI analysis.","milestone",5000)},newUnlock?7500:1000);
      if(n.current>=3&&(p.current||0)<3)setTimeout(function(){showToast("Week 3 streak! PayPal Blue theme unlocked. The crisp, professional blue look.","milestone",5000)},newUnlock?7500:1000);
      if(n.current>=5&&(p.current||0)<5)setTimeout(function(){showToast("Week 5 streak! Bloomberg Terminal theme unlocked. The iconic black & orange look is yours.","milestone",6000)},newUnlock?7500:1000);
      return n})}
  // Track score for milestone detection
  var prevScoreLevel=useRef(null);
  var globalOS=calcOwnerScore(cos);var currentLevel=getLevel(globalOS.total);
  useEffect(function(){if(!loaded||cos.filter(function(c){return(c.status||"portfolio")==="portfolio"}).length===0)return;
    var os=calcOwnerScore(cos);var lv=getLevel(os.total);
    prevScoreLevel.current=lv.name},[cos,loaded]);
  useEffect(function(){if(typeof window==="undefined")return;
    // Browser back button handler
    useEffect(function(){function onPop(e){
      if(e.state){if(e.state.selId){_setSelIdRaw(e.state.selId)}else{_setSelIdRaw(null);if(e.state.page)_setPageRaw(e.state.page)}}
      else{_setSelIdRaw(null);_setPageRaw("dashboard")}}
      window.addEventListener("popstate",onPop);return function(){window.removeEventListener("popstate",onPop)}},[]);
    function check(){setIsMobile(window.innerWidth<768)}
    check();window.addEventListener("resize",check);return function(){window.removeEventListener("resize",check)}},[]);
  var saveTimer=useRef(null);var cloudTimer=useRef(null);
  // ── Inject global CSS for animations & polish ──
  useEffect(function(){
    if(typeof document==="undefined")return;
    var id="ta-global-css";var prev=document.getElementById(id);if(prev)prev.remove();
    var style=document.createElement("style");style.id=id;
    var hov=isDark?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)";
    var hovTxt=isDark?"#eeeeee":"#1a1a1a";
    var scrollT=isDark?"rgba(255,255,255,.1)":"rgba(0,0,0,.12)";
    var scrollH=isDark?"rgba(255,255,255,.2)":"rgba(0,0,0,.2)";
    var focusC=isDark?"rgba(255,255,255,.25)":"rgba(0,0,0,.15)";
    var focusS=isDark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)";
    var shimC=isDark?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)";
    var cardSh=isDark?"rgba(0,0,0,.2)":"rgba(0,0,0,.08)";
    style.textContent=[
      "@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes fadeInFast{from{opacity:0}to{opacity:1}}",
      "@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}",
      "@keyframes spin{to{transform:rotate(360deg)}}",
      "@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}",
      "@keyframes confettiFall{0%{transform:translateY(-100vh) rotate(0deg);opacity:1}70%{opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}",
      "@keyframes celebratePop{0%{transform:scale(0) rotate(-10deg);opacity:0}50%{transform:scale(1.15) rotate(3deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}",
      "@keyframes glowPulse{0%,100%{box-shadow:0 0 8px rgba(255,215,0,.3)}50%{box-shadow:0 0 24px rgba(255,215,0,.6)}}",
      "@keyframes streakFlame{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}",
      ".ta-celebrate{animation:celebratePop .5s cubic-bezier(.175,.885,.32,1.275) both}",
      ".ta-glow{animation:glowPulse 2s ease-in-out infinite}",
      ".ta-fade{animation:fadeIn .3s ease-out both}",
      ".ta-slide{animation:slideUp .35s ease-out both}",
      ".ta-card{transition:border-color .2s ease,box-shadow .2s ease,transform .15s ease}",
      ".ta-card:hover{box-shadow:0 4px 20px "+cardSh+";transform:translateY(-1px)}",
      ".ta-btn{transition:all .15s ease}",
      ".ta-btn:hover{filter:brightness(1.15)}",
      ".ta-btn:active{transform:translateY(0.5px)}",
      ".ta-skel{background:linear-gradient(90deg,transparent 0%,"+shimC+" 50%,transparent 100%);background-size:200% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:6px}",
      "::-webkit-scrollbar{width:6px;height:6px}",
      "::-webkit-scrollbar-track{background:transparent}",
      "::-webkit-scrollbar-thumb{background:"+scrollT+";border-radius:3px}",
      "::-webkit-scrollbar-thumb:hover{background:"+scrollH+"}",
      "input:focus,textarea:focus,select:focus{border-color:"+focusC+"!important;box-shadow:0 0 0 3px "+focusS+"!important;transition:all .15s ease}",
      "button{transition:all .12s ease}",
      "select{transition:border-color .15s ease}",
      ".ta-side-item{transition:background .15s ease,border-color .15s ease}",
      ".ta-side-item:hover{background:"+hov+"}",
      ".ta-tab{transition:all .15s ease;position:relative}",
      ".ta-tab:hover{color:"+hovTxt+"}",
      "@media(max-width:767px){",
      "  .ta-card:hover{box-shadow:none!important;transform:none!important}",
      "  .ta-side-item:hover{background:transparent!important}",
      "  .ta-modal-inner{width:100vw!important;max-width:100vw!important;max-height:100vh!important;height:100vh!important;border-radius:0!important;border:none!important;padding:20px 16px!important;box-shadow:none!important}",
      "  .ta-mob-1col{grid-template-columns:1fr!important}",
      "  .ta-detail-pad{padding:0 16px 40px!important}",
      "  .ta-detail-head{flex-direction:column!important;align-items:flex-start!important;gap:12px!important}",
      "  .ta-detail-actions{flex-wrap:wrap!important}",
      "  .ta-ob-card{width:100%!important;max-width:100%!important;padding:24px 20px!important}",
      "  .ta-ob-pillars{flex-direction:column!important;gap:12px!important}",
      "  .ta-login-box{width:100%!important;max-width:100%!important;padding:32px 20px!important;border-radius:12px!important}",
      "  .ta-notif-panel{width:calc(100vw - 24px)!important;right:12px!important;left:12px!important;max-height:70vh!important}",
      "  .ta-analytics-4col{grid-template-columns:1fr 1fr!important}",
      "  .ta-form-row{grid-template-columns:1fr!important}",
      "  .ta-form-3col{grid-template-columns:1fr 1fr!important}",
      "  .ta-grid-cards{grid-template-columns:1fr!important}",
      "  .ta-grid-2col{grid-template-columns:1fr!important}",
      "  .ta-grid-4col{grid-template-columns:1fr 1fr!important}",
      "  .ta-grid-docs{grid-template-columns:1fr!important}",
      "  .ta-onboard-steps{grid-template-columns:1fr!important}",
      "  .ta-page-pad{padding:0 12px 40px!important}",
      "  .ta-detail-tabs{overflow-x:auto!important;-webkit-overflow-scrolling:touch}",
      "  .ta-detail-tabs button{white-space:nowrap!important;flex-shrink:0!important;padding:12px 14px!important}",
      "  .ta-summary-grid{grid-template-columns:1fr 1fr!important}",
      "  .ta-style-wrap{flex-wrap:wrap!important}",
      "}",
      bm?"*{font-family:'Consolas','Courier New',monospace!important}h1,h2,h3{font-family:'Consolas','Courier New',monospace!important;text-transform:uppercase;letter-spacing:1px}":"",
      isForest?"*{font-family:'Nunito','DM Sans','Helvetica Neue',sans-serif!important;letter-spacing:0}h1,h2,h3{font-family:'Nunito','DM Sans',sans-serif!important;font-weight:800!important;letter-spacing:-0.5px!important}button{border-radius:12px!important;font-family:'Nunito',sans-serif!important;font-weight:700!important}input,textarea,select{border-radius:10px!important;font-family:'Nunito',sans-serif!important}":"",
    ].join("\n");
    document.head.appendChild(style);
    // Load theme-specific fonts via link tag
    var fontId="ta-theme-font";var prevFont=document.getElementById(fontId);if(prevFont)prevFont.remove();
    if(isForest){var link=document.createElement("link");link.id=fontId;link.rel="stylesheet";link.href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap";document.head.appendChild(link)}
    return function(){var el=document.getElementById(id);if(el)el.remove();var fl=document.getElementById(fontId);if(fl)fl.remove()}},[isDark,theme]);
  // ── Load data ──
  useEffect(function(){
    // Load: try cloud first (cross-device), then localStorage (offline cache), then SAMPLE
    async function loadData(){
      var cloudData=await cloudLoad(props.userId);
      if(cloudData&&cloudData.cos&&cloudData.cos.length>0){
        setCos(cloudData.cos.map(function(c){return Object.assign({docs:[],earningsHistory:[],position:{shares:0,avgCost:0,currentPrice:0},conviction:0,convictionHistory:[],status:"portfolio",industry:"",lastDiv:0,divPerShare:0,divFrequency:"quarterly",exDivDate:"",researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0,investStyle:"",moatTypes:{},pricingPower:null,morningstarMoat:"",moatTrend:"",thesisVersions:[],thesisUpdatedAt:"",purchaseDate:""},c)}));
        if(cloudData.notifs)setNotifs(cloudData.notifs);
        if(cloudData.trial){saveTrial(cloudData.trial)}
        if(cloudData.profile){
          if(cloudData.profile.username){setUsername(cloudData.profile.username);try{localStorage.setItem("ta-username",cloudData.profile.username)}catch(e){}}
          if(cloudData.profile.avatar){setAvatarUrl(cloudData.profile.avatar);try{localStorage.setItem("ta-avatar",cloudData.profile.avatar)}catch(e){}}
          if(cloudData.profile.xp){setXp(cloudData.profile.xp);try{localStorage.setItem("ta-xp",JSON.stringify(cloudData.profile.xp))}catch(e){}}
          if(cloudData.profile.streak){setStreakData(cloudData.profile.streak);try{localStorage.setItem("ta-streak",JSON.stringify(cloudData.profile.streak))}catch(e){}}
          if(cloudData.profile.dailyStreak){setDailyStreak(cloudData.profile.dailyStreak);try{localStorage.setItem("ta-daily",JSON.stringify(cloudData.profile.dailyStreak))}catch(e){}}
          if(cloudData.profile.milestones){setMilestones(cloudData.profile.milestones);try{localStorage.setItem("ta-milestones",JSON.stringify(cloudData.profile.milestones))}catch(e){}}
          if(cloudData.profile.weeklyReviews){setWeeklyReviews(cloudData.profile.weeklyReviews);try{localStorage.setItem("ta-weekly-reviews",JSON.stringify(cloudData.profile.weeklyReviews))}catch(e){}}
          if(cloudData.profile.dashSettings){setDashSet(Object.assign({},DEFAULT_DASH,cloudData.profile.dashSettings));try{localStorage.setItem("ta-dashsettings",JSON.stringify(cloudData.profile.dashSettings))}catch(e){}}
          if(cloudData.profile.theme&&!localStorage.getItem("ta-theme")){setTheme(cloudData.profile.theme);try{localStorage.setItem("ta-theme",cloudData.profile.theme)}catch(e){}}
          if(cloudData.profile.chest){setChestRewards(cloudData.profile.chest);try{localStorage.setItem("ta-chest",JSON.stringify(cloudData.profile.chest))}catch(e){}}
          if(cloudData.profile.quests){setQuestData(cloudData.profile.quests);try{localStorage.setItem("ta-quests",JSON.stringify(cloudData.profile.quests))}catch(e){}}
          if(cloudData.profile.doubleXP){setDoubleXP(cloudData.profile.doubleXP);try{localStorage.setItem("ta-doublexp",cloudData.profile.doubleXP)}catch(e){}}
        }
        svS("ta-data",cloudData);// cache locally
        setLoaded(true);return}
      // Fallback to localStorage
      var local=await ldS("ta-data");
      if(local&&local.cos&&local.cos.length>0){
        setCos(local.cos.map(function(c){return Object.assign({docs:[],earningsHistory:[],position:{shares:0,avgCost:0,currentPrice:0},conviction:0,convictionHistory:[],status:"portfolio",industry:"",lastDiv:0,divPerShare:0,divFrequency:"quarterly",exDivDate:"",researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0,investStyle:"",moatTypes:{},pricingPower:null,morningstarMoat:"",moatTrend:"",thesisVersions:[],thesisUpdatedAt:"",purchaseDate:""},c)}));
        if(local.notifs)setNotifs(local.notifs);
        if(local.trial){saveTrial(local.trial)}
        if(local.profile){
          if(local.profile.username){setUsername(local.profile.username);try{localStorage.setItem("ta-username",local.profile.username)}catch(e){}}
          if(local.profile.avatar){setAvatarUrl(local.profile.avatar);try{localStorage.setItem("ta-avatar",local.profile.avatar)}catch(e){}}
          if(local.profile.xp){setXp(local.profile.xp);try{localStorage.setItem("ta-xp",JSON.stringify(local.profile.xp))}catch(e){}}
          if(local.profile.streak){setStreakData(local.profile.streak);try{localStorage.setItem("ta-streak",JSON.stringify(local.profile.streak))}catch(e){}}
          if(local.profile.dailyStreak){setDailyStreak(local.profile.dailyStreak);try{localStorage.setItem("ta-daily",JSON.stringify(local.profile.dailyStreak))}catch(e){}}
          if(local.profile.milestones){setMilestones(local.profile.milestones);try{localStorage.setItem("ta-milestones",JSON.stringify(local.profile.milestones))}catch(e){}}
          if(local.profile.weeklyReviews){setWeeklyReviews(local.profile.weeklyReviews);try{localStorage.setItem("ta-weekly-reviews",JSON.stringify(local.profile.weeklyReviews))}catch(e){}}
          if(local.profile.dashSettings){setDashSet(Object.assign({},DEFAULT_DASH,local.profile.dashSettings));try{localStorage.setItem("ta-dashsettings",JSON.stringify(local.profile.dashSettings))}catch(e){}}
          if(local.profile.theme&&!localStorage.getItem("ta-theme")){setTheme(local.profile.theme);try{localStorage.setItem("ta-theme",local.profile.theme)}catch(e){}}
          if(local.profile.chest){setChestRewards(local.profile.chest);try{localStorage.setItem("ta-chest",JSON.stringify(local.profile.chest))}catch(e){}}
          if(local.profile.quests){setQuestData(local.profile.quests);try{localStorage.setItem("ta-quests",JSON.stringify(local.profile.quests))}catch(e){}}
          if(local.profile.doubleXP){setDoubleXP(local.profile.doubleXP);try{localStorage.setItem("ta-doublexp",local.profile.doubleXP)}catch(e){}}
        }
        // First login on this account — push local data to cloud
        cloudSave(props.userId,local);
        setLoaded(true);return}
      // Brand new user — use sample data
      try{if(!localStorage.getItem("ta-onboarded"))setObStep(1)}catch(e){setObStep(1)}
      // Start trial for new users
      if(!trial||!trial.start){saveTrial({start:new Date().toISOString(),bonusEarned:false,bonusEarnedAt:null})}
      setLoaded(true)}
    loadData();
    // Load subscription status
    if(supabase&&props.userId){supabase.from("subscriptions").select("plan,status,stripe_customer_id,current_period_end").eq("user_id",props.userId).single().then(function(res){
      if(res.data&&res.data.plan){var isActive=res.data.status==="active"||res.data.status==="trialing";var notExpired=!res.data.current_period_end||new Date(res.data.current_period_end)>new Date();
        var p=(isActive&&notExpired&&res.data.plan==="pro")?"pro":"free";setPlan(p);try{localStorage.setItem("ta-plan",p)}catch(e){}
        if(res.data.stripe_customer_id)setStripeCustomerId(res.data.stripe_customer_id)}}).catch(function(){})}
    // Handle Stripe redirect (?upgraded=true)
    if(typeof window!=="undefined"){var sp=new URLSearchParams(window.location.search);
      if(sp.get("upgraded")==="true"){window.history.replaceState({},"",window.location.pathname);
        // Poll for webhook to complete (Stripe webhook may arrive within seconds)
        var attempts=0;var poll=setInterval(function(){attempts++;if(attempts>10){clearInterval(poll);return}
          if(supabase&&props.userId){supabase.from("subscriptions").select("plan,status,stripe_customer_id").eq("user_id",props.userId).single().then(function(res2){
            if(res2.data&&res2.data.plan==="pro"){clearInterval(poll);setPlan("pro");try{localStorage.setItem("ta-plan","pro")}catch(e){}
              if(res2.data.stripe_customer_id)setStripeCustomerId(res2.data.stripe_customer_id);
              celebrate("✨ Welcome to Pro! All data features unlocked.","levelup",6000);showCelebration("⚡ Pro Activated","You now have access to earnings data, moat analysis, financial statements, and more. Happy investing!",null,"#4ade80")}})
            .catch(function(){})}},2000)}}
    },[]);
  // ── Trial: auto-start for existing users who don't have one ──
  useEffect(function(){if(!loaded||plan==="pro")return;
    if(!trial||!trial.start){saveTrial({start:new Date().toISOString(),bonusEarned:false,bonusEarnedAt:null})}},[loaded,plan]);
  // ── Trial: watch for thesis unlock bonus ──
  useEffect(function(){if(!loaded||!trial||!trial.start||trial.bonusEarned||plan==="pro")return;
    if(completeTheses>=THESIS_UNLOCK){
      saveTrial(Object.assign({},trial,{bonusEarned:true,bonusEarnedAt:new Date().toISOString()}));
      celebrate(String.fromCodePoint(0x1F3C6)+" Discipline recognized! +"+TRIAL_BONUS+" days of full access unlocked.","milestone",8000);
      showCelebration(String.fromCodePoint(0x1F3C6)+" Skin in the Game","You logged "+THESIS_UNLOCK+" complete investment theses. "+TRIAL_BONUS+" additional days of full Pro access have been unlocked. Now, let’s stress-test the rest of your portfolio.",null,"#4ade80");
      setNotifs(function(p){return[{id:Date.now(),type:"milestone",ticker:"",msg:"Trial extended! "+TRIAL_BONUS+" bonus days earned for completing "+THESIS_UNLOCK+" theses",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}},[loaded,completeTheses,trial]);
  // Auto-refresh prices on load — PRO only (uses FMP API)
  useEffect(function(){if(!loaded||cos.length===0||!isPro)return;
    var t=setTimeout(function(){refreshPrices()},2000);return function(){clearTimeout(t)}},[loaded,isPro]);
  // Auto-notify: when earnings date has passed, automatically check them
  var autoCheckDone=useRef({});
  useEffect(function(){if(!loaded||!autoNotify||!isPro)return;
    cos.forEach(function(c){if(c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)<=0&&dU(c.earningsDate)>=-3){
      // Auto-check if not already checked and not already in progress
      var key=c.ticker+"-"+c.earningsDate;
      if((!c.lastChecked||(!c.earningSummary&&c.lastChecked&&(Date.now()-new Date(c.lastChecked).getTime())>86400000))&&!autoCheckDone.current[key]&&!checkSt[c.id]){
        autoCheckDone.current[key]=true;
        setTimeout(function(){checkOne(c.id).then(function(){
          // Send browser push if enabled
          if(typeof Notification!=="undefined"&&Notification.permission==="granted"){
            try{new Notification("ThesisAlpha: "+c.ticker,{body:"Earnings results are now available",icon:"/logo.png"})}catch(e){}}
          // Queue email alert notification (non-disruptive — user clicks to open)
          if(emailNotify){setNotifs(function(p){return[{id:Date.now()+Math.random(),type:"email-alert",ticker:c.ticker,msg:"Earnings results available — click to send summary",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}
        })},Math.random()*3000+1000)}// Stagger 1-4s
      else if(!c.lastChecked&&!notifs.some(function(n){return n.ticker===c.ticker&&n.type==="ready"})){
        setNotifs(function(p){return[{id:Date.now()+Math.random(),type:"ready",ticker:c.ticker,msg:"Earnings released — click Check Earnings to view",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}}});
    return undefined},[loaded,autoNotify,cos]);
  // Send earnings email via mailto (free, no backend needed)
  function sendEarningsEmail(c){
    var sub="ThesisAlpha: "+c.ticker+" earnings released";
    var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;
    var total=c.kpis.filter(function(k){return k.lastResult}).length;
    var body=c.ticker+" ("+c.name+") earnings are out.\n\n";
    if(c.earningSummary)body+="Summary: "+c.earningSummary+"\n\n";
    if(total>0)body+="KPIs: "+met+"/"+total+" met\n";
    c.kpis.forEach(function(k){if(k.lastResult)body+=k.name+": "+k.lastResult.actual+(k.unit||"")+" ("+(k.lastResult.status||"pending")+")\n"});
    body+="\nOpen ThesisAlpha to review.";
    window.open("mailto:"+encodeURIComponent(props.user)+"?subject="+encodeURIComponent(sub)+"&body="+encodeURIComponent(body),"_blank")}
  // Request browser notification permission
  function requestPushPermission(){if(typeof Notification!=="undefined"&&Notification.permission==="default"){Notification.requestPermission()}}
  // DEBOUNCED SAVE — localStorage fast (500ms), cloud slower (2s)
  useEffect(function(){if(!loaded)return;var payload={cos:cos,notifs:notifs,trial:trial,profile:{username:username,avatar:avatarUrl,xp:xp,streak:streakData,dailyStreak:dailyStreak,milestones:milestones,weeklyReviews:weeklyReviews,dashSettings:dashSet,theme:theme,chest:chestRewards,doubleXP:doubleXP,quests:questData}};
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(function(){svS("ta-data",payload)},500);
    if(cloudTimer.current)clearTimeout(cloudTimer.current);
    cloudTimer.current=setTimeout(function(){cloudSave(props.userId,payload)},2000);
    return function(){if(saveTimer.current)clearTimeout(saveTimer.current);if(cloudTimer.current)clearTimeout(cloudTimer.current)}},[cos,notifs,trial,loaded,username,avatarUrl,xp,streakData,dailyStreak,milestones,weeklyReviews,dashSet,chestRewards,doubleXP,questData]);
  // Reset expired earnings dates to TBD then auto-lookup via Finnhub (FREE, $0)
  useEffect(function(){if(!loaded)return;
    var toFetch=[];
    cos.forEach(function(c){
      if(c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)<-7){
        setCos(function(p){return p.map(function(x){return x.id===c.id?Object.assign({},x,{earningsDate:"TBD",earningsTime:"TBD",lastChecked:null}):x})});
        toFetch.push(c)}
      else if(!c.earningsDate||c.earningsDate==="TBD"){toFetch.push(c)}});
    // Staggered Finnhub lookups (free, no AI, no cost)
    if(!toFetch.length)return;
    var i=0;var tmr=setInterval(function(){if(i>=toFetch.length){clearInterval(tmr);return}
      var c=toFetch[i];i++;
      lookupNextEarnings(c.ticker).then(function(r){if(r&&r.earningsDate&&r.earningsDate!=="TBD"){
        setCos(function(p){return p.map(function(x){return x.id===c.id?Object.assign({},x,{earningsDate:r.earningsDate,earningsTime:r.earningsTime||"TBD"}):x})})}}).catch(function(){})
    },500);// 500ms between calls — Finnhub allows 60/min
    return function(){clearInterval(tmr)}},[loaded]);
  // Upcoming earnings notification (no AI — just a reminder)
  useEffect(function(){if(!loaded)return;cos.forEach(function(c){if(!c.earningsDate||c.earningsDate==="TBD")return;var d=dU(c.earningsDate);
    if(d>0&&d<=7&&!c.kpis.some(function(k){return k.lastResult})&&!notifs.some(function(n){return n.ticker===c.ticker&&n.type==="upcoming"&&n.ed===c.earningsDate}))
      setNotifs(function(p){return[{id:Date.now()+Math.random(),type:"upcoming",ticker:c.ticker,msg:"Earnings in "+d+"d — "+fD(c.earningsDate)+" "+c.earningsTime,time:new Date().toISOString(),read:false,ed:c.earningsDate}].concat(p).slice(0,30)})})},[loaded,cos]);
  var sel=cos.find(function(c){return c.id===selId})||null;
  // Close notif panel when navigating
  useEffect(function(){setShowNotifs(false)},[selId,page,subPage]);
  var upd=function(id,fn){setCos(function(p){return p.map(function(c){return c.id===id?(typeof fn==="function"?fn(c):Object.assign({},c,fn)):c})})};
  // ── Structured Journal Entry System ──
  function logJournalEntry(companyId,entry){
    var base={id:Date.now()+Math.random(),date:new Date().toISOString(),cardType:entry.cardType||"note"};
    var full=Object.assign(base,entry);
    upd(companyId,function(prev){return Object.assign({},prev,{decisions:[full].concat(prev.decisions||[]).slice(0,80)})});
    return full}
  var delCo=function(id){setCos(function(p){return p.filter(function(c){return c.id!==id})});setSelId(null);setModal(null)};
  var unread=notifs.filter(function(n){return!n.read}).length;
  async function checkOne(cid){var co=cos.find(function(c){return c.id===cid});if(!co)return;
    setCheckSt(function(p){var n=Object.assign({},p);n[cid]="checking";return n});
    try{var r=await fetchEarnings(co,co.kpis||[]);
      // Also fetch news (free, $0)
      var news=await fetchCompanyNews(co.ticker,14).catch(function(){return[]});
      if(r.found){setCos(function(prev){return prev.map(function(c){if(c.id!==cid)return c;
        var earningsHistory=c.earningsHistory||[];
        var newEntry={quarter:r.quarter||"Latest",summary:stripCite(r.summary||""),results:(r.results||[]).map(function(x){return{kpi_name:x.kpi_name,actual_value:x.actual_value,status:x.status,excerpt:stripCite(x.excerpt||"")}}),sourceUrl:r.sourceUrl,sourceLabel:stripCite(r.sourceLabel||""),checkedAt:new Date().toISOString()};
        var exists=earningsHistory.findIndex(function(h){return h.quarter===newEntry.quarter});
        if(exists>=0){earningsHistory=earningsHistory.slice();earningsHistory[exists]=newEntry}else{earningsHistory=[newEntry].concat(earningsHistory)}
        return Object.assign({},c,{lastChecked:new Date().toISOString(),earningSummary:stripCite(r.summary||c.earningSummary),sourceUrl:r.sourceUrl||c.sourceUrl,sourceLabel:stripCite(r.sourceLabel||c.sourceLabel||""),earningsHistory:earningsHistory.slice(0,20),financialSnapshot:r.snapshot||c.financialSnapshot||{},latestNews:news.length?news:c.latestNews||[],kpis:c.kpis.map(function(k){var mid=resolveMetricId(k);var m=r.results.find(function(x){return x.kpi_name===mid||x.kpi_name===(k.metricId||k.name)});return m&&m.actual_value!=null?Object.assign({},k,{lastResult:{actual:m.actual_value,status:eS(k.rule,k.value,m.actual_value),excerpt:stripCite(m.excerpt||"")}}):k})})})});
        setCheckSt(function(p){var n=Object.assign({},p);n[cid]="found";return n});
        // Auto-log earnings review journal entry
        var kpiResults=(r.results||[]);var metCount=kpiResults.filter(function(x){return x.status==="met"}).length;var totalKpis=kpiResults.length;
        logJournalEntry(cid,{cardType:"earnings_review",ticker:co.ticker,quarter:r.quarter||"Latest",summary:stripCite(r.summary||""),kpisMet:metCount,kpisTotal:totalKpis,kpiDetails:kpiResults.map(function(x){return{name:x.kpi_name,actual:x.actual_value,status:x.status}}),priceAtTime:co.position&&co.position.currentPrice?co.position.currentPrice:null,convictionAtTime:co.conviction||0,action:"",trigger:"",thesisImpact:"",userNote:""});
        setNotifs(function(p){return[{id:Date.now(),type:"found",ticker:co.ticker,msg:(r.quarter||"")+" results found",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}
      else{setCheckSt(function(p){var n=Object.assign({},p);n[cid]="not-yet";return n})}}
    catch(e){console.warn("checkOne error:",e);setCheckSt(function(p){var n=Object.assign({},p);n[cid]="error";return n})}
    setTimeout(function(){setCheckSt(function(p){var n=Object.assign({},p);delete n[cid];return n})},6000)}
  async function checkAll(){var all=cos.filter(function(c){return c.status==="portfolio"||c.status==="watchlist"});for(var i=0;i<all.length;i++){await checkOne(all[i].id);await new Promise(function(r){setTimeout(r,1200)})}}
  async function refreshPrices(){setPriceLoading(true);
    for(var i=0;i<cos.length;i++){var c=cos[i];try{var r=await fetchPrice(c.ticker);
      if(r&&r.price){upd(c.id,function(prev){var updates={position:Object.assign({},prev.position,{currentPrice:r.price})};
        // Auto-populate dividend from FMP if user hasn't manually set one
        if(r.lastDiv>0&&!prev.divPerShare){updates.divPerShare=r.lastDiv;updates.lastDiv=r.lastDiv}
        return Object.assign({},prev,updates)});
        // Fetch detailed dividend info if we have a lastDiv but no exDivDate
        if(r.lastDiv>0&&(!c.exDivDate||c.exDivDate==="")){fetchDividendInfo(c.ticker).then(function(dInfo){if(dInfo&&dInfo.divPerShare>0){upd(c.id,function(prev){var du={};if(!prev.divPerShare||prev.divPerShare===0)du.divPerShare=dInfo.divPerShare;if(!prev.divFrequency||prev.divFrequency==="quarterly")du.divFrequency=dInfo.divFrequency;if(!prev.exDivDate)du.exDivDate=dInfo.exDivDate;if(!prev.lastDiv)du.lastDiv=dInfo.lastDiv;return Object.keys(du).length>0?Object.assign({},prev,du):prev})}}).catch(function(){})}
      }}catch(e){}
      await new Promise(function(res){setTimeout(res,300)})}setPriceLoading(false)}
  function toggleAutoNotify(){var nv=!autoNotify;setAutoNotify(nv);try{localStorage.setItem("ta-autonotify",String(nv))}catch(e){}
    if(nv){requestPushPermission();
      setNotifs(function(p){return[{id:Date.now(),type:"system",ticker:"",msg:"Auto-notify enabled — earnings will be checked and you'll be notified",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}}
  function toggleEmailNotify(){var nv=!emailNotify;setEmailNotify(nv);try{localStorage.setItem("ta-emailnotify",String(nv))}catch(e){}}

  // ── Modals ─────────────────────────────────────────────────
  function AddModal(){var _f=useState({ticker:"",name:"",sector:"",earningsDate:"",earningsTime:"AMC",domain:"",irUrl:"",thesis:"",status:"portfolio",investStyle:"",purchaseDate:""}),f=_f[0],setF=_f[1];
    var _ls=useState("idle"),ls=_ls[0],setLs=_ls[1];var _lm=useState(""),lm=_lm[0],setLm=_lm[1];var tmr=useRef(null);
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    async function doLookup(t){setLs("loading");setLm("");try{var r=await lookupTicker(t);
      if(r&&r.error){setLs("error");setLm(r.error)}
      else if(r&&r.name){setF(function(p){return Object.assign({},p,{name:p.name||r.name||"",sector:p.sector||r.sector||"",earningsDate:p.earningsDate||r.earningsDate||"",earningsTime:r.earningsTime||p.earningsTime,domain:p.domain||r.domain||"",irUrl:p.irUrl||r.irUrl||"",_price:r.price||0,_lastDiv:r.lastDiv||0,_industry:r.industry||"",_description:r.description||"",_ceo:r.ceo||"",_employees:r.employees||0,_country:r.country||"",_exchange:r.exchange||"",_ipoDate:r.ipoDate||"",_mktCap:r.mktCap||0})});setLs("done");setLm("Auto-filled ✓"+(r.earningsDate&&r.earningsDate!=="TBD"?" (incl. earnings date)":""))}
      else{setLs("error");setLm("Not found")}}catch(e){setLs("error");setLm("Lookup failed — try manually")}}
    function onTicker(v){set("ticker",v);if(tmr.current)clearTimeout(tmr.current);var t=v.toUpperCase().trim();
      if(t.length>=1&&t.length<=6&&/^[A-Za-z.]+$/.test(t)){setLs("idle");tmr.current=setTimeout(function(){doLookup(t)},1000)}else{setLs("idle");setLm("")}}
    function submit(){if(!f.ticker.trim()||!f.name.trim())return;if(tmr.current)clearTimeout(tmr.current);
      var nc={id:nId(cos),ticker:f.ticker.toUpperCase().trim(),name:f.name.trim(),sector:f.sector.trim(),industry:f._industry||"",domain:f.domain.trim(),irUrl:f.irUrl.trim(),earningsDate:f.earningsDate||"TBD",earningsTime:f.earningsTime,thesisNote:f.thesis.trim(),kpis:[],docs:[],earningsHistory:[],researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0,position:{shares:0,avgCost:0,currentPrice:f._price||0},conviction:0,convictionHistory:[],status:f.status||"portfolio",investStyle:f.investStyle||"",lastDiv:f._lastDiv||0,divPerShare:f._lastDiv||0,divFrequency:"quarterly",exDivDate:"",lastChecked:null,notes:"",earningSummary:null,sourceUrl:null,sourceLabel:null,moatTypes:{},pricingPower:null,morningstarMoat:"",moatTrend:"",thesisVersions:[],thesisUpdatedAt:"",purchaseDate:f.purchaseDate||"",description:f._description||"",ceo:f._ceo||"",employees:f._employees||0,country:f._country||"",exchange:f._exchange||"",ipoDate:f._ipoDate||"",mktCap:f._mktCap||0};
      setCos(function(p){return p.concat([nc])});setSelId(nc.id);setModal(null)}
    useEffect(function(){return function(){if(tmr.current)clearTimeout(tmr.current)}},[]);
    return<Modal title="Add Company" onClose={function(){if(tmr.current)clearTimeout(tmr.current);setModal(null)}} K={K}>
      <div className="ta-form-row" style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"0 16px"}}><div><Inp label="Ticker" value={f.ticker} onChange={onTicker} placeholder="AAPL" K={K} spellCheck={false} autoCorrect="off" autoComplete="off"/>
        {ls!=="idle"&&<div style={{fontSize:11,color:ls==="loading"?K.dim:ls==="done"?K.grn:K.amb,marginTop:-10,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
          {ls==="loading"&&<span style={{display:"inline-block",width:10,height:10,border:"2px solid "+K.bdr2,borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>}{ls==="loading"?"Looking up…":lm}</div>}</div>
        <Inp label="Company Name" value={f.name} onChange={function(v){set("name",v)}} placeholder="Apple Inc." K={K}/></div>
      <div className="ta-form-3col" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}><Inp label="Sector" value={f.sector} onChange={function(v){set("sector",v)}} placeholder="Technology" K={K}/><Inp label="Earnings Date" value={f.earningsDate} onChange={function(v){set("earningsDate",v)}} type="date" K={K}/><Sel label="Timing" value={f.earningsTime} onChange={function(v){set("earningsTime",v)}} options={[{v:"BMO",l:"Before Open"},{v:"AMC",l:"After Close"}]} K={K}/></div>
      <Inp label="Investment Thesis" value={f.thesis} onChange={function(v){set("thesis",v)}} ta placeholder="Why do you own this?" K={K}/>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:K.dim,marginBottom:8,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Investment Style</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {INVEST_STYLES.map(function(st){var isSel=f.investStyle===st.id;return<button key={st.id} onClick={function(){set("investStyle",isSel?"":st.id)}} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:6,border:"1px solid "+(isSel?st.color+"60":K.bdr),background:isSel?st.color+"15":"transparent",color:isSel?st.color:K.mid,fontSize:11,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400,transition:"all .15s"}}>
            <IC name={st.icon} size={10} color={isSel?st.color:K.dim}/>{st.label}</button>})}</div>
        {f.investStyle&&STYLE_MAP[f.investStyle]&&<div style={{fontSize:10,color:K.dim,marginTop:6,lineHeight:1.4}}>{STYLE_MAP[f.investStyle].desc}</div>}
      </div>
      <Sel label="Add to" value={f.status} onChange={function(v){set("status",v)}} options={[{v:"portfolio",l:"Portfolio (I own this)"},{v:"watchlist",l:"Watchlist (Researching)"},{v:"toohard",l:"Too Hard (Outside circle)"}]} K={K}/>
      {f.status==="portfolio"&&<Inp label="Purchase Date *" value={f.purchaseDate} onChange={function(v){set("purchaseDate",v)}} type="date" K={K}/>}
      {f.status==="portfolio"&&!f.purchaseDate&&<div style={{fontSize:10,color:K.amb,marginTop:-8,marginBottom:8}}>When did you first buy this? Helps track your ownership timeline.</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}><button style={S.btn} onClick={function(){if(tmr.current)clearTimeout(tmr.current);setModal(null)}}>Cancel</button>
        <button style={Object.assign({},S.btnP,{opacity:f.ticker.trim()&&f.name.trim()&&(f.status!=="portfolio"||f.purchaseDate)?1:.4})} onClick={submit} disabled={!f.ticker.trim()||!f.name.trim()||(f.status==="portfolio"&&!f.purchaseDate)}>Add Company</button></div></Modal>}
  function EditModal(){if(!sel)return null;var _f=useState({ticker:sel.ticker,name:sel.name,sector:sel.sector,earningsDate:sel.earningsDate==="TBD"?"":sel.earningsDate,earningsTime:sel.earningsTime,domain:sel.domain||"",irUrl:sel.irUrl||"",investStyle:sel.investStyle||""}),f=_f[0],setF=_f[1];var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    return<Modal title="Edit Company" onClose={function(){setModal(null)}} K={K}>
      <div className="ta-form-row" style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"0 16px"}}><Inp label="Ticker" value={f.ticker} onChange={function(v){set("ticker",v)}} K={K}/><Inp label="Name" value={f.name} onChange={function(v){set("name",v)}} K={K}/></div>
      <div className="ta-form-3col" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}><Inp label="Sector" value={f.sector} onChange={function(v){set("sector",v)}} K={K}/><Inp label="Earnings Date" value={f.earningsDate} onChange={function(v){set("earningsDate",v)}} type="date" K={K}/><Sel label="Timing" value={f.earningsTime} onChange={function(v){set("earningsTime",v)}} options={[{v:"BMO",l:"Before Open"},{v:"AMC",l:"After Close"},{v:"TBD",l:"TBD"}]} K={K}/></div>
      <Inp label="Logo Domain" value={f.domain} onChange={function(v){set("domain",v)}} placeholder="apple.com" K={K}/>
      <Inp label="IR URL" value={f.irUrl} onChange={function(v){set("irUrl",v)}} placeholder="https://investor.apple.com" K={K}/>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:K.dim,marginBottom:8,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Investment Style</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {INVEST_STYLES.map(function(st){var isSel=f.investStyle===st.id;return<button key={st.id} onClick={function(){set("investStyle",isSel?"":st.id)}} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:6,border:"1px solid "+(isSel?st.color+"60":K.bdr),background:isSel?st.color+"15":"transparent",color:isSel?st.color:K.mid,fontSize:11,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400,transition:"all .15s"}}>
            <IC name={st.icon} size={10} color={isSel?st.color:K.dim}/>{st.label}</button>})}</div></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}><button style={S.btnD} onClick={function(){setModal({type:"del"})}}>Delete Company</button><div style={{flex:1}}/><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnP} onClick={function(){upd(selId,{ticker:f.ticker.toUpperCase().trim(),name:f.name.trim(),sector:f.sector.trim(),domain:f.domain.trim(),irUrl:f.irUrl.trim(),earningsDate:f.earningsDate||"TBD",earningsTime:f.earningsTime,investStyle:f.investStyle});setModal(null)}}>Save</button></div></Modal>}
  function parseThesis(note){if(!note)return{core:"",moat:"",risks:"",sell:""};
    var sections={core:"",moat:"",risks:"",sell:""};var cur="core";
    var lines=(note||"").split("\n");
    for(var i=0;i<lines.length;i++){var l=lines[i].trim();
      if(/^##?\s*MOAT/i.test(l)||/^##?\s*COMPETITIVE/i.test(l)){cur="moat";continue}
      if(/^##?\s*RISK/i.test(l)||/^##?\s*KEY RISK/i.test(l)){cur="risks";continue}
      if(/^##?\s*SELL/i.test(l)||/^##?\s*INVALIDAT/i.test(l)){cur="sell";continue}
      sections[cur]+=(sections[cur]?"\n":"")+lines[i]}
    Object.keys(sections).forEach(function(k){sections[k]=sections[k].trim()});return sections}
  function joinThesis(s){var parts=[];if(s.core)parts.push(s.core);if(s.moat)parts.push("## MOAT\n"+s.moat);if(s.risks)parts.push("## RISKS\n"+s.risks);if(s.sell)parts.push("## SELL CRITERIA\n"+s.sell);return parts.join("\n\n")}
  function ThesisModal(){if(!sel)return null;var parsed=parseThesis(sel.thesisNote);
    var _f=useState(parsed),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    var sty=STYLE_MAP[sel.investStyle];
    var sections=[
      {key:"core",label:"Why I Own It",placeholder:sty?sty.thesisPrompt:"What makes this a great business? What's the core thesis?",icon:"lightbulb",color:K.acc},
      {key:"moat",label:"Competitive Moat",placeholder:sty?sty.moatPrompt:"What protects this business? Switching costs, brand, network effects, cost advantages, regulatory barriers?",icon:"castle",color:K.grn},
      {key:"risks",label:"Key Risks",placeholder:sty?sty.riskPrompt:"What could go wrong? Competition, regulation, technology disruption, management risk?",icon:"alert",color:K.amb},
      {key:"sell",label:"What Would Make Me Sell",placeholder:sty?sty.sellPrompt:"Define your exit criteria upfront. What conditions would break this thesis?",icon:"target",color:K.red}];
    // Live quality scoring
    var filled=sections.filter(function(s){return f[s.key]&&f[s.key].trim().length>15}).length;
    var totalWords=sections.reduce(function(a,s){return a+(f[s.key]||"").trim().split(/\s+/).filter(function(w){return w}).length},0);
    var qualityPct=Math.round(filled/4*100);
    var qualityColor=qualityPct>=100?K.grn:qualityPct>=75?K.acc:qualityPct>=50?K.amb:K.dim;
    var qualityLabel=qualityPct>=100?"Complete thesis":qualityPct>=75?"Almost there":qualityPct>=50?"Good start":"Needs more detail";
    var isChanged=(joinThesis(f)!==sel.thesisNote);
    return<Modal title={sel.ticker+" — Investment Thesis"} onClose={function(){setModal(null)}} w={580} K={K}>
      {/* Quality meter */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"10px 14px",background:K.bg,borderRadius:8}}>
        <div style={{position:"relative",width:40,height:40,flexShrink:0}}>
          <svg width={40} height={40} viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke={K.bdr} strokeWidth="3"/><circle cx="20" cy="20" r="16" fill="none" stroke={qualityColor} strokeWidth="3" strokeDasharray={Math.round(qualityPct/100*100)+" 100"} strokeLinecap="round" transform="rotate(-90 20 20)"/></svg>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:qualityColor,fontFamily:fm}}>{filled}/4</div></div>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:600,color:qualityColor}}>{qualityLabel}</div>
          <div style={{fontSize:10,color:K.dim}}>{totalWords} words · {filled} of 4 sections filled</div></div>
        <div style={{display:"flex",gap:4}}>
          {sections.map(function(s){var done=f[s.key]&&f[s.key].trim().length>15;
            return<div key={s.key} style={{width:20,height:20,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",background:done?s.color+"15":"transparent",border:"1px solid "+(done?s.color+"30":K.bdr)}} title={s.label}>
              {done?<IC name="check" size={10} color={s.color}/>:<IC name={s.icon} size={9} color={K.dim}/>}</div>})}</div></div>
      <div style={{fontSize:12,color:K.dim,marginBottom:16,lineHeight:1.6}}>A well-structured thesis forces clarity. Munger: "If you can't state the argument against your position, you don't understand it well enough."</div>
      {sections.map(function(sec){var wordCount=(f[sec.key]||"").trim().split(/\s+/).filter(function(w){return w}).length;var done=f[sec.key]&&f[sec.key].trim().length>15;
        return<div key={sec.key} style={{marginBottom:16}}>
        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:done?sec.color:K.mid,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600}}>
          {done?<IC name="check" size={11} color={sec.color}/>:<IC name={sec.icon} size={12} color={K.dim}/>}{sec.label}
          {wordCount>0&&<span style={{fontSize:9,color:K.dim,fontWeight:400,textTransform:"none",letterSpacing:0,marginLeft:"auto"}}>{wordCount}w</span>}</label>
        <textarea value={f[sec.key]} onChange={function(e){set(sec.key,e.target.value)}} placeholder={sec.placeholder} rows={sec.key==="core"?4:2} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+(done?sec.color+"30":K.bdr),borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6,transition:"border-color .2s"}}/></div>})}
      {sel.thesisVersions&&sel.thesisVersions.length>0&&<div style={{borderTop:"1px solid "+K.bdr,paddingTop:12,marginTop:8,marginBottom:8}}>
        <div style={{fontSize:10,color:K.dim,letterSpacing:1,textTransform:"uppercase",fontFamily:fm,marginBottom:8}}>Version History ({sel.thesisVersions.length} snapshots)</div>
        <div style={{maxHeight:100,overflowY:"auto"}}>{sel.thesisVersions.slice().reverse().slice(0,8).map(function(v,i){
          return<div key={i} style={{fontSize:11,color:K.mid,marginBottom:4,paddingLeft:8,borderLeft:"2px solid "+K.bdr}}>
          <span style={{fontFamily:fm,color:K.dim,fontSize:10}}>{v.date}</span> {"—"} {v.summary||"Updated"}</div>})}</div></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
        {isChanged&&<div style={{fontSize:10,color:K.acc,fontFamily:fm}}>Unsaved changes</div>}
        {!isChanged&&<div/>}
        <div style={{display:"flex",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:isChanged?1:.4})} onClick={function(){if(!isChanged){setModal(null);return}var newNote=joinThesis(f);var versions=(sel.thesisVersions||[]).slice();if(newNote.trim()&&newNote!==sel.thesisNote){versions.push({date:new Date().toISOString().split("T")[0],summary:f.core?f.core.substring(0,80):"Updated thesis"})}upd(selId,{thesisNote:newNote,thesisVersions:versions.slice(-30),thesisUpdatedAt:new Date().toISOString()});
              // Auto-log thesis snapshot
              logJournalEntry(selId,{cardType:"thesis_snapshot",ticker:sel.ticker,version:versions.length+1,sectionsFilled:filled,core:f.core?f.core.substring(0,120):"",hasMoat:!!f.moat,hasRisks:!!f.risks,hasSell:!!f.sell,isNew:!sel.thesisNote||sel.thesisNote.trim().length<20});if(filled===4){checkMilestone("thesis4","✨ Complete thesis! All 4 sections written.");addXP(20,"Complete thesis")}else{showToast("✓ Thesis saved — "+filled+"/4 sections complete","info",3000);addXP(10,"Thesis updated")};if(sel.kpis.length===0)setTimeout(function(){showToast("Next step: define 2-3 KPIs that prove your thesis → click + Add under Key Metrics","info",5000)},1500);setModal(null)}}>Save & Snapshot</button></div></div></Modal>}
  function KpiModal(){if(!sel)return null;var kid=modal.data;var ex=kid?sel.kpis.find(function(k){return k.id===kid}):null;
    var _f=useState({metricId:ex?ex.metricId||"":"",rule:ex?ex.rule:"gte",value:ex?String(ex.value):"",period:ex?ex.period:""}),f=_f[0],setF=_f[1];var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    // Filter out already-tracked metrics
    var used=sel.kpis.map(function(k){return k.metricId});
    var avail=METRICS.filter(function(m){return!used.includes(m.id)||m.id===(ex&&ex.metricId)});
    var sty=STYLE_MAP[sel.investStyle];var recIds=sty?sty.kpis:[];
    var cats={};avail.forEach(function(m){if(!cats[m.cat])cats[m.cat]=[];cats[m.cat].push(m)});
    var selMet=f.metricId?METRIC_MAP[f.metricId]:null;
    function doSave(){if(!f.metricId||isNaN(parseFloat(f.value)))return;var met=METRIC_MAP[f.metricId];var nv=parseFloat(f.value);
      var kd={metricId:f.metricId,name:met.label,rule:f.rule,value:nv,unit:met.unit,period:f.period.trim(),target:bT(f.rule,nv,met.unit),notes:""};
      if(ex)upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.map(function(k){return k.id===kid?Object.assign({},k,kd):k})})});
      else upd(selId,function(c){var newKpis=c.kpis.concat([Object.assign({id:nId(c.kpis),lastResult:null},kd)]);
        if(newKpis.length===1)setTimeout(function(){checkMilestone("first_kpi",""+String.fromCodePoint(0x1F3AF)+" First KPI tracked! You're measuring what matters.")},300);
        addXP(5,"KPI added");
        if(!c.conviction||c.conviction===0)setTimeout(function(){showToast("Nice! Now rate your conviction 1-10 → click the Conviction card","info",5000)},2000);
        return Object.assign({},c,{kpis:newKpis})});setModal(null)}
    return<Modal title={ex?"Edit Metric":"Track Metric"} onClose={function(){setModal(null)}} w={520} K={K}>
      {/* Metric picker grid */}
      {!ex&&<div style={{marginBottom:20}}>
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:12,fontFamily:fm}}>Choose Metric{sty?" • "+sty.label+" recommendations highlighted":""}</div>
        {sty&&recIds.length>0&&<div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:sty.color,marginBottom:6,fontFamily:fm}}>Recommended for {sty.label}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {recIds.map(function(rid){var m=METRIC_MAP[rid];if(!m||used.includes(m.id))return null;var isSel=f.metricId===m.id;
              return<button key={m.id} onClick={function(){set("metricId",m.id)}} style={{background:isSel?sty.color+"20":sty.color+"08",border:"1px solid "+(isSel?sty.color:sty.color+"40"),borderRadius:6,padding:"6px 12px",fontSize:11,color:isSel?sty.color:K.txt,cursor:"pointer",fontFamily:fm,fontWeight:600}}>{m.label}</button>}).filter(Boolean)}</div></div>}
        {Object.keys(cats).map(function(cat){return<div key={cat} style={{marginBottom:12}}>
          <div style={{fontSize:10,color:K.dim,marginBottom:6,fontFamily:fm}}>{cat}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {cats[cat].map(function(m){var isSel=f.metricId===m.id;var isRec=recIds.includes(m.id);
              return<button key={m.id} onClick={function(){set("metricId",m.id);if(!f.value&&m.unit==="%")set("value","");}} style={{background:isSel?K.acc+"20":K.bg,border:"1px solid "+(isSel?K.acc:isRec&&sty?sty.color+"40":K.bdr),borderRadius:6,padding:"6px 12px",fontSize:11,color:isSel?K.acc:K.mid,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400}}>{m.label}</button>})}</div></div>})}</div>}
      {ex&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:14,fontWeight:500,color:K.txt}}>{selMet?selMet.label:ex.name}</div><div style={{fontSize:11,color:K.dim}}>{selMet?selMet.cat:""}</div></div>}
      {f.metricId&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
          <Sel label="Rule" value={f.rule} onChange={function(v){set("rule",v)}} options={[{v:"gte",l:"≥ At least"},{v:"lte",l:"≤ At most"},{v:"eq",l:"= Exactly"}]} K={K}/>
          <Inp label={"Target"+(selMet?" ("+selMet.unit+")":"")} value={f.value} onChange={function(v){set("value",v)}} type="number" placeholder={selMet&&selMet.unit==="%"?"e.g. 20":"e.g. 5"} K={K}/>
          <Inp label="Period (optional)" value={f.period} onChange={function(v){set("period",v)}} placeholder="Q4 2025" K={K}/></div>
        <div style={{fontSize:11,color:K.dim,marginTop:4,marginBottom:12}}>Auto-fetched from Finnhub when you click Check Earnings</div></div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}>{ex&&<button style={S.btnD} onClick={function(){upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.filter(function(k){return k.id!==kid})})});setModal(null)}}>Delete</button>}<div style={{flex:1}}/><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.metricId&&f.value?1:.4})} onClick={doSave}>Save</button></div></Modal>}
  function ResultModal(){if(!sel)return null;var kpi=sel.kpis.find(function(k){return k.id===modal.data});if(!kpi)return null;
    var _a=useState(kpi.lastResult?String(kpi.lastResult.actual):""),a=_a[0],setA=_a[1];var _ex=useState(kpi.lastResult?kpi.lastResult.excerpt||"":""),ex=_ex[0],setEx=_ex[1];var pv=a?eS(kpi.rule,kpi.value,a):null;
    return<Modal title="Enter Result" onClose={function(){setModal(null)}} w={440} K={K}><div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"14px 18px",marginBottom:20}}><div style={{fontSize:14,color:K.txt}}>{kpi.name}</div><div style={{fontSize:12,color:K.dim}}>Target: {kpi.target}</div></div>
      <Inp label="Actual Value" value={a} onChange={setA} type="number" K={K}/>
      {pv&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"8px 12px",borderRadius:6,background:pv==="met"?"#22C55E10":"#EF444410"}}><div style={S.dot(pv)}/><span style={{fontSize:12,color:pv==="met"?"#22C55E":"#EF4444",fontWeight:500,fontFamily:fm}}>{pv.toUpperCase()}</span></div>}
      <Inp label="Evidence" value={ex} onChange={setEx} ta placeholder="Source..." K={K}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}>{kpi.lastResult&&<button style={S.btnD} onClick={function(){upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.map(function(k){return k.id===modal.data?Object.assign({},k,{lastResult:null}):k})})});setModal(null)}}>Clear</button>}<div style={{flex:1}}/><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:a?1:.4})} onClick={function(){if(!a)return;upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.map(function(k){return k.id===modal.data?Object.assign({},k,{lastResult:{actual:parseFloat(a),status:eS(kpi.rule,kpi.value,a),excerpt:ex.trim()}}):k})})});setModal(null)}}>Save</button></div></Modal>}
  function DelModal(){if(!sel)return null;return<Modal title="Delete Company" onClose={function(){setModal(null)}} w={380} K={K}><p style={{fontSize:13,color:K.mid,marginTop:0}}>Delete <strong style={{color:K.txt}}>{sel.ticker}</strong> and all data?</p><div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:16}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnD} onClick={function(){delCo(selId)}}>Delete</button></div></Modal>}
  function DocModal(){if(!sel)return null;var did=modal.data;var ex=did?sel.docs.find(function(d){return d.id===did}):null;
    var _f=useState({title:ex?ex.title:"",content:ex?ex.content:"",folder:ex?ex.folder:"notes"}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    function doSave(){if(!f.title.trim())return;var doc={title:f.title.trim(),content:f.content,folder:f.folder,updatedAt:new Date().toISOString()};
      if(ex){upd(selId,function(c){return Object.assign({},c,{docs:c.docs.map(function(d){return d.id===did?Object.assign({},d,doc):d})})})}
      else{upd(selId,function(c){return Object.assign({},c,{docs:c.docs.concat([Object.assign({id:nId(c.docs)},doc)])})})}setModal(null)}
    return<Modal title={ex?"Edit Note":"New Note"} onClose={function(){setModal(null)}} w={560} K={K}>
      <Inp label="Title" value={f.title} onChange={function(v){set("title",v)}} placeholder="e.g. Q4 2025 Earnings Analysis" K={K}/>
      <Sel label="Save to Folder" value={f.folder} onChange={function(v){set("folder",v)}} options={FOLDERS.map(function(fo){return{v:fo.id,l:fo.label}})} K={K}/>
      <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>Content</label>
        <textarea value={f.content} onChange={function(e){set("content",e.target.value)}} rows={10} placeholder="Write your analysis, notes, or paste external research..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.7}}/></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:12}}>{ex&&<button style={S.btnD} onClick={function(){upd(selId,function(c){return Object.assign({},c,{docs:c.docs.filter(function(d){return d.id!==did})})});setModal(null)}}>Delete</button>}<div style={{flex:1}}/><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.title.trim()?1:.4})} onClick={doSave}>Save</button></div></Modal>}
  // ── Investment Memo Builder ──
  function MemoModal(){if(!sel)return null;var c2=sel;var pos=c2.position||{};var sec2=parseThesis(c2.thesisNote);
    var os2=calcOwnerScore([c2]);var h2=gH(c2.kpis);var style2=c2.investStyle&&STYLE_MAP[c2.investStyle]?STYLE_MAP[c2.investStyle]:null;
    var activeMoats=MOAT_TYPES.filter(function(t){return c2.moatTypes&&c2.moatTypes[t.id]&&c2.moatTypes[t.id].active});
    var latestEarnings=c2.earningsHistory&&c2.earningsHistory.length>0?c2.earningsHistory[0]:null;
    var _f=useState({whyNow:"",valuation:"",sizing:"",risksWatching:"",outlook:""}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    function saveMemo(){
      var content="## WHY NOW\n"+f.whyNow+"\n\n## VALUATION\n"+f.valuation+"\n\n## POSITION SIZING\n"+f.sizing+"\n\n## RISKS I\'M WATCHING\n"+f.risksWatching+"\n\n## 12-MONTH OUTLOOK\n"+f.outlook;
      upd(selId,function(prev){return Object.assign({},prev,{docs:prev.docs.concat([{id:nId(prev.docs),title:"Investment Memo — "+new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),content:content,folder:"my-writeups",updatedAt:new Date().toISOString(),isMemo:true,memoData:{whyNow:f.whyNow,valuation:f.valuation,sizing:f.sizing,risksWatching:f.risksWatching,outlook:f.outlook}}])})});
      addXP(15,"Investment memo");showToast("\u2713 Investment memo saved for "+c2.ticker,"info",3000);setModal(null)}
    function exportMemoPDF(){
      var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+c2.ticker+' Investment Memo \u2014 ThesisAlpha</title>';
      html+='<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">';
      html+='<style>@page{size:A4;margin:22mm 20mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Inter",sans-serif;color:#1a1a2e;font-size:12px;line-height:1.7;background:#fff}';
      html+='.page{max-width:680px;margin:0 auto;padding:40px 48px}';
      html+='.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #1a1a2e;margin-bottom:20px}';
      html+='.hdr h1{font-family:"Playfair Display",Georgia,serif;font-size:30px;font-weight:700;letter-spacing:-.5px;line-height:1.1}';
      html+='.hdr .sub{font-size:12px;color:#6b7280;margin-top:4px}';
      html+='.logo{font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase}';
      html+='.snap{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;padding:16px;background:#fafafa;border-radius:10px;border:1px solid #e5e7eb}';
      html+='.snap-item{text-align:center}.snap-label{font-family:"JetBrains Mono",monospace;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:4px}.snap-val{font-size:18px;font-weight:700;font-family:"JetBrains Mono",monospace}';
      html+='.thesis-box{padding:14px 18px;background:#fafafa;border-left:4px solid #1a1a2e;border-radius:0 8px 8px 0;margin-bottom:20px;font-style:italic;line-height:1.7}';
      html+='.sec-h{font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#6b7280;margin:24px 0 10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}';
      html+='.body-text{font-size:12px;line-height:1.8;color:#374151;margin-bottom:16px}';
      html+='.footer{margin-top:32px;padding-top:12px;border-top:2px solid #1a1a2e;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}';
      html+='.grn{color:#16a34a}.red{color:#dc2626}.amb{color:#d97706}';
      html+='</style></head><body><div class="page">';
      // Header
      html+='<div class="hdr"><div><h1>'+c2.ticker+'</h1><div class="sub">'+c2.name+' \u00b7 '+(c2.sector||"")+' \u00b7 Investment Memo</div></div>';
      html+='<div style="text-align:right"><div class="logo">ThesisAlpha</div><div style="font-size:9px;color:#9ca3af;margin-top:4px">'+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})+'</div></div></div>';
      // Snapshot
      html+='<div class="snap">';
      html+='<div class="snap-item"><div class="snap-label">Price</div><div class="snap-val">'+(pos.currentPrice?"$"+pos.currentPrice:"\u2014")+'</div></div>';
      html+='<div class="snap-item"><div class="snap-label">Conviction</div><div class="snap-val '+(c2.conviction>=7?"grn":c2.conviction>=4?"amb":"red")+'">'+(c2.conviction||"\u2014")+'/10</div></div>';
      html+='<div class="snap-item"><div class="snap-label">KPIs</div><div class="snap-val">'+h2.l+'</div></div>';
      html+='<div class="snap-item"><div class="snap-label">Process</div><div class="snap-val">'+os2.total+'/100</div></div></div>';
      // Thesis
      if(sec2.core){html+='<div class="sec-h">MY THESIS</div><div class="thesis-box">'+autoFormat(sec2.core)+'</div>'}
      // User sections
      if(f.whyNow.trim()){html+='<div class="sec-h">WHY NOW</div><div class="body-text">'+autoFormat(f.whyNow)+'</div>'}
      if(f.valuation.trim()){html+='<div class="sec-h">VALUATION</div><div class="body-text">'+autoFormat(f.valuation)+'</div>'}
      if(f.sizing.trim()){html+='<div class="sec-h">POSITION SIZING</div><div class="body-text">'+autoFormat(f.sizing)+'</div>'}
      if(f.risksWatching.trim()){html+='<div class="sec-h">RISKS I\'M WATCHING</div><div class="body-text">'+autoFormat(f.risksWatching)+'</div>'}
      if(f.outlook.trim()){html+='<div class="sec-h">12-MONTH OUTLOOK</div><div class="body-text">'+autoFormat(f.outlook)+'</div>'}
      // Footer
      html+='<div class="footer"><div style="font-family:JetBrains Mono,monospace;font-weight:700;letter-spacing:2px;color:#1a1a2e;text-transform:uppercase">ThesisAlpha</div>';
      html+='<div>'+c2.ticker+' \u00b7 '+c2.name+' \u00b7 '+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})+'</div></div>';
      html+='<div style="font-size:8px;color:#9ca3af;margin-top:8px;font-style:italic">For personal research only. Not financial advice.</div>';
      html+='</div></body></html>';
      var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.print()},600)}
    return<Modal title={"Investment Memo — "+c2.ticker} onClose={function(){setModal(null)}} w={640} K={K}>
      {/* Auto-populated snapshot */}
      <div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 18px",marginBottom:20}}>
        <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:10}}>SNAPSHOT (auto-filled)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm}}>PRICE</div><div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>{pos.currentPrice?"$"+pos.currentPrice:"—"}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm}}>CONVICTION</div><div style={{fontSize:16,fontWeight:700,color:c2.conviction>=7?K.grn:c2.conviction>=4?K.amb:K.red,fontFamily:fm}}>{c2.conviction||"—"}/10</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm}}>KPIs</div><div style={{fontSize:14,fontWeight:600,color:h2.c,fontFamily:fm}}>{h2.l}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm}}>MOAT</div><div style={{fontSize:14,fontWeight:600,color:activeMoats.length>0?K.grn:K.dim,fontFamily:fm}}>{activeMoats.length>0?activeMoats.length+" types":"—"}</div></div></div>
        {sec2.core&&<div style={{marginTop:10,padding:"8px 12px",background:K.card,borderLeft:"3px solid "+K.acc,borderRadius:"0 6px 6px 0",fontSize:11,color:K.mid,fontStyle:"italic",lineHeight:1.5}}>{sec2.core.substring(0,150)}{sec2.core.length>150?"...":""}</div>}
      </div>
      {/* Structured prompts */}
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>WHY NOW? <span style={{fontWeight:400,color:K.dim}}>— What’s the catalyst or timing argument?</span></label>
        <textarea value={f.whyNow} onChange={function(e){set("whyNow",e.target.value)}} rows={3} placeholder="Recent earnings beat, sector rotation, valuation reset, management change..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>VALUATION <span style={{fontWeight:400,color:K.dim}}>— Your work on what it’s worth</span></label>
        <textarea value={f.valuation} onChange={function(e){set("valuation",e.target.value)}} rows={3} placeholder="P/E vs peers, DCF assumptions, historical range, margin of safety..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>POSITION SIZING <span style={{fontWeight:400,color:K.dim}}>— Why this allocation?</span></label>
        <textarea value={f.sizing} onChange={function(e){set("sizing",e.target.value)}} rows={2} placeholder="Portfolio weight, concentration risk, how this fits..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:K.red,marginBottom:4,fontFamily:fm}}>RISKS I’M WATCHING <span style={{fontWeight:400,color:K.dim}}>— Beyond thesis risks</span></label>
        <textarea value={f.risksWatching} onChange={function(e){set("risksWatching",e.target.value)}} rows={2} placeholder="What specifically keeps you up at night?" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.red+"20",borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:18}}><label style={{display:"block",fontSize:11,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>12-MONTH OUTLOOK <span style={{fontWeight:400,color:K.dim}}>— What do you expect to happen?</span></label>
        <textarea value={f.outlook} onChange={function(e){set("outlook",e.target.value)}} rows={2} placeholder="Revenue trajectory, catalysts, bear vs bull case..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <button onClick={exportMemoPDF} style={Object.assign({},S.btn,{display:"flex",alignItems:"center",gap:5})}><IC name="file" size={12} color={K.mid}/>Export PDF</button>
        <div style={{display:"flex",gap:8}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button>
          <button style={Object.assign({},S.btnP,{opacity:f.whyNow.trim()||f.valuation.trim()?1:.4})} onClick={saveMemo}>Save Memo</button></div></div></Modal>}
  // ── Research Clipper ──
  function ClipModal(){if(!sel)return null;var c2=sel;
    var _f=useState({url:"",title:"",takeaway:"",thesisImpact:"unchanged",source:""}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    function saveClip(){if(!f.title.trim()&&!f.url.trim())return;
      var title=f.title.trim()||f.url.trim();
      upd(selId,function(prev){return Object.assign({},prev,{docs:prev.docs.concat([{id:nId(prev.docs),title:title,content:f.takeaway.trim(),folder:"deep-dives",updatedAt:new Date().toISOString(),isClip:true,clipData:{url:f.url.trim(),source:f.source.trim(),thesisImpact:f.thesisImpact,savedAt:new Date().toISOString()}}])})});
      addXP(5,"Research clipped");showToast("\u2713 Research clipped for "+c2.ticker,"info",3000);setModal(null)}
    return<Modal title={"Clip Research — "+c2.ticker} onClose={function(){setModal(null)}} w={520} K={K}>
      <div style={{display:"flex",gap:12,marginBottom:14}}>
        <div style={{width:40,height:40,borderRadius:10,background:K.blue+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><IC name="link" size={18} color={K.blue}/></div>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt}}>Save research for {c2.ticker}</div>
          <div style={{fontSize:11,color:K.dim}}>Clip an article, report, or podcast with your takeaway</div></div></div>
      <Inp label="URL (optional)" value={f.url} onChange={function(v){set("url",v)}} placeholder="https://..." K={K}/>
      <Inp label="Title / Headline *" value={f.title} onChange={function(v){set("title",v)}} placeholder="e.g. NVIDIA's CUDA Moat Is Deeper Than You Think" K={K}/>
      <Inp label="Source" value={f.source} onChange={function(v){set("source",v)}} placeholder="e.g. Fabricated Intelligence, Company 10-K, Podcast" K={K}/>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>MY TAKEAWAY <span style={{fontWeight:400,color:K.dim}}>— What did you learn?</span></label>
        <textarea value={f.takeaway} onChange={function(e){set("takeaway",e.target.value)}} rows={3} placeholder="The key insight and how it affects your thesis..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:18}}><label style={{display:"block",fontSize:11,fontWeight:600,color:K.txt,marginBottom:6,fontFamily:fm}}>THESIS IMPACT</label>
        <div style={{display:"flex",gap:6}}>
          {[{v:"strengthened",l:"Strengthened",c:K.grn},{v:"unchanged",l:"Unchanged",c:K.dim},{v:"weakened",l:"Weakened",c:K.red}].map(function(opt){return<button key={opt.v} onClick={function(){set("thesisImpact",opt.v)}} style={{flex:1,padding:"8px 12px",borderRadius:6,border:"1px solid "+(f.thesisImpact===opt.v?opt.c+"50":K.bdr),background:f.thesisImpact===opt.v?opt.c+"12":"transparent",color:f.thesisImpact===opt.v?opt.c:K.dim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{opt.l}</button>})}</div></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button>
        <button style={Object.assign({},S.btnP,{opacity:f.title.trim()?1:.4})} onClick={saveClip}>Save Clip</button></div></Modal>}
  // ── IR Library Entry Modal ──
  function IREntryModal(){if(!sel)return null;var c2=sel;
    var _f=useState({title:"",url:"",quarter:"",notes:""}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    function saveIR(){if(!f.title.trim())return;
      upd(selId,function(prev){return Object.assign({},prev,{docs:prev.docs.concat([{id:nId(prev.docs),title:f.title.trim(),content:f.notes.trim(),folder:"reports",updatedAt:new Date().toISOString(),isIR:true,irData:{url:f.url.trim(),quarter:f.quarter.trim()}}])})});
      showToast("\u2713 IR link saved","info",2000);setModal(null)}
    return<Modal title={"IR Library — "+c2.ticker} onClose={function(){setModal(null)}} w={480} K={K}>
      <Inp label="Title *" value={f.title} onChange={function(v){set("title",v)}} placeholder="e.g. Q4 FY26 Earnings Deck, Annual Report 2025" K={K}/>
      <Inp label="URL" value={f.url} onChange={function(v){set("url",v)}} placeholder="https://investor.example.com/..." K={K}/>
      <Inp label="Quarter / Period" value={f.quarter} onChange={function(v){set("quarter",v)}} placeholder="e.g. Q4 FY26" K={K}/>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>YOUR NOTES <span style={{fontWeight:400,color:K.dim}}>— Key takeaways from this document</span></label>
        <textarea value={f.notes} onChange={function(e){set("notes",e.target.value)}} rows={3} placeholder="Management guided for... Key metric change was... Watch for..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button>
        <button style={Object.assign({},S.btnP,{opacity:f.title.trim()?1:.4})} onClick={saveIR}>Save</button></div></Modal>}
    function PositionModal(){if(!sel)return null;var pos=sel.position||{shares:0,avgCost:0};
    var _f=useState({shares:String(pos.shares||""),avgCost:String(pos.avgCost||""),currentPrice:String(pos.currentPrice||""),divPerShare:String(sel.divPerShare||sel.lastDiv||""),divFrequency:sel.divFrequency||"quarterly",exDivDate:sel.exDivDate||"",targetPrice:String(sel.targetPrice||""),purchaseDate:sel.purchaseDate||""}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    var mult=f.divFrequency==="monthly"?12:f.divFrequency==="quarterly"?4:f.divFrequency==="semi"?2:1;
    var annDiv=parseFloat(f.divPerShare||0)*mult;
    var yld=f.currentPrice?annDiv/parseFloat(f.currentPrice)*100:0;
    var tp=parseFloat(f.targetPrice);var cp=parseFloat(f.currentPrice);var inBuyZone=tp>0&&cp>0&&cp<=tp;
    return<Modal title={"Position — "+sel.ticker} onClose={function(){setModal(null)}} w={480} K={K}>
      <Inp label="Shares Held" value={f.shares} onChange={function(v){set("shares",v)}} type="number" placeholder="0" K={K}/>
      <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Average Cost per Share" value={f.avgCost} onChange={function(v){set("avgCost",v)}} type="number" placeholder="0.00" K={K}/>
      <Inp label="Current Price" value={f.currentPrice} onChange={function(v){set("currentPrice",v)}} type="number" placeholder="0.00" K={K}/></div>
      <Inp label="Purchase Date" value={f.purchaseDate} onChange={function(v){set("purchaseDate",v)}} type="date" K={K}/>
      {f.shares&&f.avgCost&&f.currentPrice&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:14,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>COST BASIS</div><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>${(parseFloat(f.shares)*parseFloat(f.avgCost)).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>MKT VALUE</div><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>${(parseFloat(f.shares)*parseFloat(f.currentPrice)).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>GAIN/LOSS</div><div style={{fontSize:14,fontWeight:600,color:((parseFloat(f.currentPrice)-parseFloat(f.avgCost))/parseFloat(f.avgCost)*100)>=0?K.grn:K.red,fontFamily:fm}}>{((parseFloat(f.currentPrice)-parseFloat(f.avgCost))/parseFloat(f.avgCost)*100).toFixed(1)}%</div></div></div></div>}
      {/* Price alert / Buy zone */}
      <div style={{borderTop:"1px solid "+K.bdr,paddingTop:16,marginTop:8,marginBottom:8}}><div style={{fontSize:11,color:K.dim,letterSpacing:2,textTransform:"uppercase",fontFamily:fm,marginBottom:12}}>Price Alert</div></div>
      <Inp label="Buy Below / Target Price" value={f.targetPrice} onChange={function(v){set("targetPrice",v)}} type="number" placeholder="Set a buy target" K={K}/>
      {tp>0&&cp>0&&<div style={{background:inBuyZone?K.grn+"10":K.bg,border:"1px solid "+(inBuyZone?K.grn+"40":K.bdr),borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14}}>{inBuyZone?"✅":"⏳"}</span>
        <span style={{fontSize:12,color:inBuyZone?K.grn:K.dim,fontWeight:500}}>{inBuyZone?"In the buy zone! Current $"+cp.toFixed(2)+" ≤ target $"+tp.toFixed(2):"Waiting — current $"+cp.toFixed(2)+" is "+(((cp-tp)/tp*100).toFixed(1))+"% above target $"+tp.toFixed(2)}</span></div>}
      {/* Dividends */}
      <div style={{borderTop:"1px solid "+K.bdr,paddingTop:16,marginTop:8,marginBottom:8}}><div style={{fontSize:11,color:K.dim,letterSpacing:2,textTransform:"uppercase",fontFamily:fm,marginBottom:12}}>Dividend</div></div>
      <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Dividend per Payment" value={f.divPerShare} onChange={function(v){set("divPerShare",v)}} type="number" placeholder="0.00" K={K}/>
      <Sel label="Frequency" value={f.divFrequency} onChange={function(v){set("divFrequency",v)}} options={[{v:"quarterly",l:"Quarterly"},{v:"monthly",l:"Monthly"},{v:"semi",l:"Semi-Annual"},{v:"annual",l:"Annual"},{v:"none",l:"No Dividend"}]} K={K}/></div>
      <Inp label="Ex-Dividend Date (next)" value={f.exDivDate} onChange={function(v){set("exDivDate",v)}} type="date" K={K}/>
      {parseFloat(f.divPerShare)>0&&f.divFrequency!=="none"&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:14,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>ANNUAL DIV</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>${annDiv.toFixed(2)}</div></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>YIELD</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>{yld.toFixed(2)}%</div></div>
          {f.shares&&<div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>ANNUAL INCOME</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>${(parseFloat(f.shares)*annDiv).toFixed(0)}</div></div>}</div></div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnP} onClick={function(){upd(selId,{position:{shares:parseFloat(f.shares)||0,avgCost:parseFloat(f.avgCost)||0,currentPrice:parseFloat(f.currentPrice)||0},divPerShare:parseFloat(f.divPerShare)||0,divFrequency:f.divFrequency,exDivDate:f.exDivDate,targetPrice:parseFloat(f.targetPrice)||0,purchaseDate:f.purchaseDate||""});setModal(null)}}>Save</button></div></Modal>}
  var BIAS_CHECKS=[
    {id:"confirmation",label:"Confirmation Bias",q:"Am I only seeking information that confirms my existing belief?",icon:"search"},
    {id:"anchoring",label:"Anchoring",q:"Am I anchored to a specific price, target, or past event?",icon:"target"},
    {id:"recency",label:"Recency Bias",q:"Am I overweighting recent events vs. the long-term picture?",icon:"clock"},
    {id:"fomo",label:"FOMO",q:"Am I acting because others are, or because I fear missing out?",icon:"users"},
    {id:"sunk",label:"Sunk Cost",q:"Am I holding on because of what I've already invested (time, money, ego)?",icon:"link"},
    {id:"competence",label:"Circle of Competence",q:"Do I truly understand this business, its moat, and its risks?",icon:"target"},
    {id:"narrative",label:"Narrative Fallacy",q:"Am I seduced by a compelling story rather than the numbers?",icon:"book"},
    {id:"overconfidence",label:"Overconfidence",q:"Have I considered the base rate of being wrong on calls like this?",icon:"dice"}
  ];
  function ConvictionModal(){if(!sel)return null;
    var _step=useState("checklist"),step=_step[0],setStep=_step[1];
    var _flags=useState({}),flags=_flags[0],setFlags=_flags[1];
    var _r=useState(sel.conviction||5),r=_r[0],setR=_r[1];
    var _n2=useState(""),n2=_n2[0],setN2=_n2[1];
    var flagCount=Object.values(flags).filter(function(v){return v}).length;
    var allAnswered=Object.keys(flags).length===BIAS_CHECKS.length;
    var prevRating=sel.convictionHistory&&sel.convictionHistory.length>0?sel.convictionHistory[sel.convictionHistory.length-1].rating:null;
    var delta=prevRating!==null?r-prevRating:null;
    function toggleFlag(id){setFlags(function(p){var n=Object.assign({},p);n[id]=!p[id];return n})}
    function saveConviction(){var hist=(sel.convictionHistory||[]).slice();var biasArr=BIAS_CHECKS.filter(function(b){return flags[b.id]}).map(function(b){return b.label});hist.push({date:new Date().toISOString().split("T")[0],rating:r,note:n2.trim(),biasFlags:biasArr});upd(selId,{conviction:r,convictionHistory:hist.slice(-20)});
      var deltaMsg=delta!==null&&delta!==0?(delta>0?" (+"+delta+")":"  ("+delta+")"):"";showToast("✓ "+sel.ticker+" conviction: "+r+"/10"+deltaMsg,"info",3000);addXP(8,"Conviction rated");setModal(null)}
    if(step==="checklist")return<Modal title={"✈️ Pre-Flight Checklist — "+sel.ticker} onClose={function(){setModal(null)}} w={520} K={K}>
      <div style={{fontSize:12,color:K.mid,lineHeight:1.6,marginBottom:16}}>Before updating conviction, pause and honestly assess each bias. Flag any that apply right now.</div>
      <div style={{marginBottom:16}}>
        {BIAS_CHECKS.map(function(b){var flagged=flags[b.id];var answered=flags[b.id]!==undefined;return<div key={b.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 14px",marginBottom:4,borderRadius:8,background:flagged?K.red+"08":answered?K.grn+"06":"transparent",border:"1px solid "+(flagged?K.red+"25":answered?K.grn+"20":K.bdr),cursor:"pointer",transition:"all .15s"}} onClick={function(){toggleFlag(b.id)}}>
          <div style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:flagged?K.red+"15":answered?K.grn+"15":K.bg,border:"1px solid "+(flagged?K.red+"30":answered?K.grn+"30":K.bdr)}}>{flagged?<IC name="alert" size={13} color={K.red}/>:answered?<IC name="check" size={13} color={K.grn}/>:<IC name={b.icon} size={13} color={K.dim}/>}</div>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:flagged?K.red:K.txt,marginBottom:2}}>{b.label}</div>
            <div style={{fontSize:11,color:K.dim,lineHeight:1.4}}>{b.q}</div></div>
          <div style={{fontSize:9,color:flagged?K.red:answered?K.grn:K.dim,fontFamily:fm,flexShrink:0,paddingTop:4}}>{flagged?"FLAGGED":answered?"CLEAR":"tap"}</div>
        </div>})}</div>
      {flagCount>=3&&<div style={{background:K.amb+"12",border:"1px solid "+K.amb+"30",borderRadius:8,padding:"10px 14px",marginBottom:14}}><div style={{fontSize:12,fontWeight:600,color:K.amb,marginBottom:2}}>{"⚠"} {flagCount} biases flagged</div><div style={{fontSize:11,color:K.mid}}>Consider whether this is the right time to act. Munger: {'"'}The big money is not in the buying and selling, but in the waiting.{'"'}</div></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{Object.keys(flags).length}/{BIAS_CHECKS.length} reviewed</div>
        <div style={{display:"flex",gap:8}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button>
        <button style={Object.assign({},S.btnP,{opacity:allAnswered?1:.35})} onClick={function(){if(allAnswered)setStep("rate")}}>Continue to Rating {"→"}</button></div></div></Modal>;
    return<Modal title={"Conviction Rating — "+sel.ticker} onClose={function(){setModal(null)}} w={440} K={K}>
      {flagCount>0&&<div style={{background:K.amb+"10",border:"1px solid "+K.amb+"25",borderRadius:6,padding:"8px 12px",marginBottom:16,fontSize:11,color:K.amb,fontFamily:fm}}>{"⚠"} {flagCount} bias flag{flagCount>1?"s":""} active: {BIAS_CHECKS.filter(function(b){return flags[b.id]}).map(function(b){return b.label}).join(", ")}</div>}
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:48,fontWeight:700,color:r>=8?K.grn:r>=5?K.amb:K.red,fontFamily:fm,lineHeight:1}}>{r}</div>
        <div style={{fontSize:11,color:K.dim}}>out of 10</div>
        {/* Delta from previous */}
        {delta!==null&&delta!==0&&<div style={{fontSize:13,fontWeight:600,color:delta>0?K.grn:K.red,fontFamily:fm,marginTop:4}}>
          {delta>0?"▲ +"+delta:"▼ "+delta} from last ({prevRating}/10)</div>}
        {delta===0&&prevRating!==null&&<div style={{fontSize:11,color:K.dim,marginTop:4}}>Same as last ({prevRating}/10)</div>}
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>{[1,2,3,4,5,6,7,8,9,10].map(function(v){return<button key={v} onClick={function(){setR(v)}} style={{width:32,height:32,borderRadius:6,border:"1px solid "+(v===r?K.acc:K.bdr),background:v===r?K.acc+"20":K.bg,color:v===r?K.acc:K.dim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{v}</button>})}</div>
      {/* Mini sparkline of history */}
      {sel.convictionHistory&&sel.convictionHistory.length>1&&<div style={{textAlign:"center",marginBottom:14}}>
        <svg width={Math.min(sel.convictionHistory.length*24,280)} height={32} viewBox={"0 0 "+Math.min(sel.convictionHistory.length*24,280)+" 32"}>
          {(function(){var ch=sel.convictionHistory.slice(-12);var w=Math.min(ch.length*24,280);
            var pts=ch.map(function(p,i){return{x:ch.length>1?i/(ch.length-1)*w:w/2,y:30-2-(p.rating/10)*26,r:p.rating}});
            var line=pts.map(function(p,i){return(i===0?"M":"L")+p.x.toFixed(1)+","+p.y.toFixed(1)}).join(" ");
            return React.createElement(React.Fragment,null,
              React.createElement("path",{d:line,fill:"none",stroke:K.bdr,strokeWidth:1.5}),
              pts.map(function(p,i){var cl=p.r>=8?K.grn:p.r>=5?K.amb:K.red;return React.createElement("circle",{key:i,cx:p.x.toFixed(1),cy:p.y.toFixed(1),r:3,fill:cl,stroke:K.bg,strokeWidth:1.5})}))})()}
        </svg>
        <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>{sel.convictionHistory.length} updates over time</div></div>}
      <Inp label="Note (optional)" value={n2} onChange={setN2} placeholder="Why this rating? What changed?" K={K}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}><button style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,padding:0}} onClick={function(){setStep("checklist")}}>{"←"} Back to checklist</button>
        <div style={{display:"flex",gap:8}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnP} onClick={saveConviction}>Save</button></div></div></Modal>}
  function ManualEarningsModal(){if(!sel)return null;
    var _f=useState({quarter:"",summary:"",sourceUrl:"",sourceLabel:""}),f=_f[0],setF=_f[1];
    var _kr=useState({}),kr=_kr[0],setKr=_kr[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    function doSave(){if(!f.quarter.trim()||!f.summary.trim())return;
      var results=sel.kpis.map(function(k){var v=kr[k.id];return{kpi_name:k.metricId||k.name,actual_value:v!==undefined&&v!==""?parseFloat(v):null,status:v!==undefined&&v!==""?eS(k.rule,k.value,parseFloat(v)):"unclear",excerpt:"Manual entry"}});
      var entry={quarter:f.quarter.trim(),summary:f.summary.trim(),results:results,sourceUrl:f.sourceUrl.trim(),sourceLabel:f.sourceLabel.trim()||"Manual Entry",checkedAt:new Date().toISOString()};
      upd(selId,function(c){var hist=(c.earningsHistory||[]).slice();var ex=hist.findIndex(function(h){return h.quarter===entry.quarter});
        if(ex>=0)hist[ex]=entry;else hist.unshift(entry);
        return Object.assign({},c,{earningSummary:entry.summary,sourceUrl:entry.sourceUrl,sourceLabel:entry.sourceLabel,lastChecked:entry.checkedAt,earningsHistory:hist.slice(0,20),
          kpis:c.kpis.map(function(k){var v=kr[k.id];return v!==undefined&&v!==""?Object.assign({},k,{lastResult:{actual:parseFloat(v),status:eS(k.rule,k.value,parseFloat(v)),excerpt:"Manual — "+f.quarter}}):k})})});setModal(null)}
    return<Modal title={"Enter Earnings — "+sel.ticker} onClose={function(){setModal(null)}} w={540} K={K}>
      <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Quarter" value={f.quarter} onChange={function(v){set("quarter",v)}} placeholder="Q4 2025" K={K}/><Inp label="Source Label" value={f.sourceLabel} onChange={function(v){set("sourceLabel",v)}} placeholder="Press Release" K={K}/></div>
      <Inp label="Source URL" value={f.sourceUrl} onChange={function(v){set("sourceUrl",v)}} placeholder="https://..." K={K}/>
      <Inp label="Summary" value={f.summary} onChange={function(v){set("summary",v)}} ta placeholder="Revenue of $X, up Y% YoY. EPS of $Z..." K={K}/>
      {sel.kpis.length>0&&<div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:8,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>KPI Results</label>
        {sel.kpis.map(function(k){return<div key={k.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:12,color:K.mid,flex:1}}>{k.name} <span style={{color:K.dim}}>({k.target})</span></span>
          <input type="number" value={kr[k.id]||""} onChange={function(e){setKr(function(p){var n=Object.assign({},p);n[k.id]=e.target.value;return n})}} placeholder="Actual" style={{width:100,background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 12px",fontSize:12,fontFamily:fm,outline:"none"}}/></div>})}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.quarter.trim()&&f.summary.trim()?1:.4})} onClick={doSave}>Save Earnings</button></div></Modal>}
  function exportPDF(){if(!sel)return;var c=sel;var h=gH(c.kpis);var pos=c.position||{};var sec=parseThesis(c.thesisNote);
    var os=calcOwnerScore([c]);var conv=c.conviction||0;var daysToEarn=c.earningsDate&&c.earningsDate!=="TBD"?dU(c.earningsDate):null;
    var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;
    var total=c.kpis.filter(function(k){return k.lastResult}).length;
    var activeMoats=MOAT_TYPES.filter(function(t){return c.moatTypes&&c.moatTypes[t.id]&&c.moatTypes[t.id].active});
    var style=c.investStyle&&STYLE_MAP[c.investStyle]?STYLE_MAP[c.investStyle]:null;
    // Conviction chart SVG
    var convSvg="";
    if(c.convictionHistory&&c.convictionHistory.length>1){var ch=c.convictionHistory.slice(-12);var cw=320;var chh=60;
      convSvg='<svg width="'+cw+'" height="'+chh+'" viewBox="0 0 '+cw+' '+chh+'" style="display:block;margin:8px 0">';
      convSvg+='<line x1="0" y1="'+chh/2+'" x2="'+cw+'" y2="'+chh/2+'" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="3,3"/>';
      var pts=ch.map(function(p,i){var x=i/(ch.length-1)*cw;var y=chh-4-(p.rating/10)*(chh-8);return{x:x,y:y,r:p.rating}});
      var line=pts.map(function(p,i){return(i===0?"M":"L")+p.x.toFixed(1)+","+p.y.toFixed(1)}).join(" ");
      convSvg+='<path d="'+line+'" fill="none" stroke="#2563eb" stroke-width="1.5"/>';
      pts.forEach(function(p){var cl=p.r>=8?"#16a34a":p.r>=5?"#2563eb":"#dc2626";convSvg+='<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3" fill="'+cl+'" stroke="white" stroke-width="1.5"/>'});
      convSvg+='</svg>'}
    // Moat bars SVG
    var moatSvg="";
    if(c._moatCache&&c._moatCache.composite!=null){var mc=c._moatCache;var dims2=[{k:"grossMargin",l:"Pricing Power"},{k:"revGrowth",l:"Revenue Growth"},{k:"opLeverage",l:"Operating Leverage"},{k:"roic",l:"Capital Efficiency"},{k:"fcfConversion",l:"Earnings Quality"},{k:"fortress",l:"Financial Strength"},{k:"netMargin",l:"Profitability"},{k:"rdIntensity",l:"R&D Investment"}];
      var visibleDims=dims2.filter(function(dm){return mc[dm.k]!=null&&mc[dm.k]>0});
      if(visibleDims.length>0){moatSvg='<svg width="340" height="'+(visibleDims.length*26+10)+'" viewBox="0 0 340 '+(visibleDims.length*26+10)+'" style="display:block;margin:10px 0">';
      visibleDims.forEach(function(dm,i){var v=mc[dm.k];var y2=i*26+6;var cl=v>=8?"#16a34a":v>=6?"#2563eb":v>=4?"#d97706":"#dc2626";
        moatSvg+='<text x="0" y="'+(y2+11)+'" font-size="10" fill="#6b7280" font-family="Inter,sans-serif">'+dm.l+'</text>';
        moatSvg+='<rect x="120" y="'+y2+'" width="170" height="14" rx="3" fill="#f3f4f6"/>';
        moatSvg+='<rect x="120" y="'+y2+'" width="'+(v/10*170).toFixed(0)+'" height="14" rx="3" fill="'+cl+'"/>';
        moatSvg+='<text x="300" y="'+(y2+11)+'" font-size="11" font-weight="600" fill="'+cl+'" font-family="JetBrains Mono,monospace">'+v.toFixed(1)+'</text>'});
      moatSvg+='</svg>'}}
    // KPI table rows
    var kpiRows="";if(c.kpis.length>0){
      kpiRows='<table class="kpi-table"><thead><tr><th align="left">Metric</th><th align="right">Target</th><th align="right">Actual</th><th align="center">Status</th></tr></thead><tbody>';
      c.kpis.forEach(function(k){var st=k.lastResult?k.lastResult.status:"pending";var stClr=st==="met"?"#16a34a":st==="missed"?"#dc2626":"#9ca3af";var stIcon=st==="met"?"✓":st==="missed"?"✗":"•";
        var mDef=METRIC_MAP[k.metricId||""]||{};var unit=mDef.unit||k.unit||"";
        kpiRows+='<tr><td>'+((mDef.label||k.name)+(unit?" ("+unit+")":""))+'</td><td align="right" class="mono">'+(k.rule==="gte"?"≥":k.rule==="lte"?"≤":"=")+' '+k.value+'</td><td align="right" class="mono" style="color:'+stClr+'">'+(k.lastResult?k.lastResult.actual:"—")+'</td><td align="center" style="color:'+stClr+';font-weight:700">'+stIcon+'</td></tr>'});
      kpiRows+='</tbody></table>'}
    // Decision table
    var decRows="";if(c.decisions&&c.decisions.length>0){
      decRows='<table class="dec-table"><thead><tr><th>Date</th><th>Action</th><th>Reasoning</th><th>Outcome</th></tr></thead><tbody>';
      c.decisions.slice(0,10).forEach(function(d){var clr=d.action==="BUY"||d.action==="ADD"?"#16a34a":"#dc2626";
        decRows+='<tr><td class="mono" style="white-space:nowrap">'+(d.date?d.date.substring(0,10):"")+'</td><td style="color:'+clr+';font-weight:700">'+d.action+'</td><td style="max-width:280px">'+((d.reasoning||"").substring(0,120)+(d.reasoning&&d.reasoning.length>120?"...":""))+'</td><td class="mono" style="color:'+(d.outcome==="right"?"#16a34a":d.outcome==="wrong"?"#dc2626":"#9ca3af")+'">'+(d.outcome||"—")+'</td></tr>'});
      decRows+='</tbody></table>'}
    var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+c.ticker+' Research Note — ThesisAlpha</title>';
    html+='<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">';
    html+='<style>';
    html+='@page{size:A4;margin:24mm 20mm 20mm 20mm}';
    html+='*{margin:0;padding:0;box-sizing:border-box}';
    html+='body{font-family:"Inter",sans-serif;color:#1a1a2e;padding:0;font-size:12px;line-height:1.7;background:#fff}';
    html+='.page{max-width:680px;margin:0 auto;padding:40px 48px}';
    // Header
    html+='.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #1a1a2e;margin-bottom:24px}';
    html+='.hdr-left h1{font-family:"Playfair Display",Georgia,serif;font-size:32px;font-weight:700;color:#1a1a2e;letter-spacing:-.5px;line-height:1.1}';
    html+='.hdr-left .sub{font-family:"Inter",sans-serif;font-size:13px;color:#6b7280;margin-top:4px}';
    html+='.hdr-right{text-align:right}';
    html+='.logo{font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;letter-spacing:2px;color:#1a1a2e;text-transform:uppercase}';
    html+='.logo-sub{font-family:"Inter",sans-serif;font-size:9px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-top:2px}';
    html+='.date{font-family:"JetBrains Mono",monospace;font-size:10px;color:#6b7280;margin-top:8px}';
    // Meta strip
    html+='.meta-strip{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px}';
    html+='.meta-tag{font-family:"JetBrains Mono",monospace;font-size:9px;font-weight:600;padding:3px 10px;border-radius:4px;letter-spacing:.5px}';
    // Stat cards
    html+='.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}';
    html+='.stat{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;text-align:center}';
    html+='.stat-label{font-family:"JetBrains Mono",monospace;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:4px}';
    html+='.stat-val{font-family:"JetBrains Mono",monospace;font-size:20px;font-weight:700;line-height:1.2}';
    html+='.stat-sub{font-size:10px;color:#9ca3af;margin-top:2px}';
    // Section headers
    html+='.sec-h{font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#6b7280;margin:28px 0 12px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}';
    // Thesis blocks
    html+='.thesis-core{font-family:"Playfair Display",Georgia,serif;font-size:14px;line-height:1.8;color:#1a1a2e;margin-bottom:16px;padding:16px 20px;background:#fafafa;border-radius:8px;border-left:4px solid #1a1a2e}';
    html+='.thesis-section{padding:10px 16px;border-radius:6px;margin-bottom:8px;background:#fafafa;font-size:12px;line-height:1.7;color:#374151}';
    html+='.thesis-section.moat{border-left:3px solid #16a34a}';
    html+='.thesis-section.risks{border-left:3px solid #d97706}';
    html+='.thesis-section.sell{border-left:3px solid #dc2626}';
    html+='.ts-label{font-family:"JetBrains Mono",monospace;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}';
    html+='.ts-label.moat{color:#16a34a}.ts-label.risks{color:#d97706}.ts-label.sell{color:#dc2626}';
    // Tables
    html+='.kpi-table,.dec-table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}';
    html+='.kpi-table th,.dec-table th{font-family:"JetBrains Mono",monospace;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;padding:6px 10px;border-bottom:2px solid #e5e7eb;font-weight:600}';
    html+='.kpi-table td,.dec-table td{padding:8px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top}';
    html+='.mono{font-family:"JetBrains Mono",monospace}';
    // Moat badges
    html+='.moat-badges{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}';
    html+='.moat-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:6px;font-size:11px;font-weight:600;border:1px solid #e5e7eb}';
    html+='.moat-badge .dots{display:flex;gap:2px}';
    html+='.moat-badge .dot{width:6px;height:6px;border-radius:50%}';
    // Footer
    html+='.footer{margin-top:36px;padding-top:14px;border-top:2px solid #1a1a2e;display:flex;justify-content:space-between;align-items:center}';
    html+='.footer-left{font-family:"JetBrains Mono",monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#1a1a2e;text-transform:uppercase}';
    html+='.footer-right{font-size:9px;color:#9ca3af;text-align:right}';
    html+='.footer-disc{font-size:8px;color:#9ca3af;margin-top:8px;line-height:1.4;font-style:italic}';
    html+='.grn{color:#16a34a}.red{color:#dc2626}.amb{color:#d97706}.blue{color:#2563eb}';
    html+='@media print{.page{padding:0}.no-print{display:none}}';
    html+='</style></head><body><div class="page">';

    // ═══ HEADER ═══
    html+='<div class="hdr"><div class="hdr-left"><h1>'+c.ticker+'</h1>';
    html+='<div class="sub">'+c.name+(c.sector?' · '+c.sector:'')+(c.industry?' · '+c.industry:'')+'</div></div>';
    html+='<div class="hdr-right"><div class="logo"><svg width="14" height="14" viewBox="0 0 100 100" style="vertical-align:middle;margin-right:4px"><rect width="100" height="100" rx="16" fill="#1a1a2e"/><path d="M50 18L82 78H18L50 18Z" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"/><path d="M50 38L66 70H34L50 38Z" fill="white"/></svg>ThesisAlpha</div>';
    html+='<div class="logo-sub">Investment Research Note</div>';
    html+='<div class="date">'+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})+'</div></div></div>';

    // ═══ META STRIP ═══
    html+='<div class="meta-strip">';
    if(style)html+='<span class="meta-tag" style="background:'+style.color+'10;color:'+style.color+';border:1px solid '+style.color+'30">'+style.label+'</span>';
    html+='<span class="meta-tag" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0">'+h.l+'</span>';
    if(c.morningstarMoat)html+='<span class="meta-tag" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a">M★ '+c.morningstarMoat+(c.moatTrend?' · '+c.moatTrend:'')+'</span>';
    if(daysToEarn!==null&&daysToEarn>=0)html+='<span class="meta-tag" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a">Earnings: '+daysToEarn+'d — '+c.earningsDate+'</span>';
    html+='</div>';

    // ═══ KEY METRICS STRIP ═══
    html+='<div class="stats">';
    html+='<div class="stat"><div class="stat-label">Conviction</div><div class="stat-val '+(conv>=8?"grn":conv>=5?"":"red")+'">'+(conv>0?conv+'/10':'—')+'</div></div>';
    if(pos.currentPrice>0)html+='<div class="stat"><div class="stat-label">Price</div><div class="stat-val">$'+pos.currentPrice.toFixed(2)+'</div>'+(pos.avgCost>0?'<div class="stat-sub '+(pos.currentPrice>=pos.avgCost?"grn":"red")+'">'+(((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?"+":"")+((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)+'% return</div>':'')+'</div>';
    if(pos.shares>0)html+='<div class="stat"><div class="stat-label">Position</div><div class="stat-val">'+pos.shares+'</div><div class="stat-sub">shares · $'+(pos.shares*pos.currentPrice).toLocaleString(undefined,{maximumFractionDigits:0})+'</div></div>';
    html+='<div class="stat"><div class="stat-label">KPIs</div><div class="stat-val '+(total>0?(met===total?"grn":met>0?"amb":"red"):"")+'">'+(total>0?met+'/'+total:'—')+'</div><div class="stat-sub">met</div></div>';
    if(os&&os.total>0)html+='<div class="stat"><div class="stat-label">Owner\'s Score</div><div class="stat-val '+(os.total>=80?"grn":os.total>=50?"amb":"red")+'">'+os.total+'</div><div class="stat-sub">/ 100</div></div>';
    html+='</div>';

    // ═══ POSITION DETAILS ═══
    if(pos.shares>0||c.purchaseDate){html+='<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px;padding:12px 16px;background:#fafafa;border-radius:8px;border:1px solid #f3f4f6;font-size:11px;color:#6b7280">';
      if(pos.avgCost>0)html+='<span><strong style="color:#1a1a2e">Avg Cost:</strong> $'+pos.avgCost.toFixed(2)+'</span>';
      if(pos.shares>0&&pos.currentPrice>0)html+='<span><strong style="color:#1a1a2e">Cost Basis:</strong> $'+(pos.shares*pos.avgCost).toLocaleString(undefined,{maximumFractionDigits:0})+'</span><span><strong style="color:#1a1a2e">Market Value:</strong> $'+(pos.shares*pos.currentPrice).toLocaleString(undefined,{maximumFractionDigits:0})+'</span>';
      if(c.purchaseDate)html+='<span><strong style="color:#1a1a2e">Owned Since:</strong> '+fD(c.purchaseDate)+'</span>';
      var dps=c.divPerShare||c.lastDiv||0;if(dps>0){var divMult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;var annDiv2=dps*divMult;
        html+='<span><strong style="color:#16a34a">Dividend:</strong> $'+dps.toFixed(2)+'/'+(c.divFrequency==="monthly"?"mo":c.divFrequency==="semi"?"semi":c.divFrequency==="annual"?"yr":"qtr")+' ('+((pos.currentPrice>0?(annDiv2/pos.currentPrice*100).toFixed(2):0))+'% yield)</span>';
        if(pos.shares>0)html+='<span><strong style="color:#16a34a">Annual Income:</strong> $'+(pos.shares*annDiv2).toFixed(0)+'</span>'}
      html+='</div>'}

    // ═══ INVESTMENT THESIS ═══
    if(sec.core||sec.moat||sec.risks||sec.sell){
      html+='<div class="sec-h">Investment Thesis</div>';
      if(sec.core)html+='<div class="thesis-core">'+sec.core.replace(/\n/g,"<br/>")+'</div>';
      if(sec.moat)html+='<div class="thesis-section moat"><div class="ts-label moat">▲ Competitive Moat</div>'+sec.moat.replace(/\n/g,"<br/>")+'</div>';
      if(sec.risks)html+='<div class="thesis-section risks"><div class="ts-label risks">⚠ Key Risks</div>'+sec.risks.replace(/\n/g,"<br/>")+'</div>';
      if(sec.sell)html+='<div class="thesis-section sell"><div class="ts-label sell">✗ Sell Criteria</div>'+sec.sell.replace(/\n/g,"<br/>")+'</div>'}

    // ═══ MOAT CLASSIFICATION ═══
    if(activeMoats.length>0){html+='<div class="sec-h">Moat Classification</div>';
      html+='<div class="moat-badges">';
      activeMoats.forEach(function(t){var d2=c.moatTypes[t.id];var str=d2.strength||3;
        html+='<div class="moat-badge" style="border-color:'+t.color+'30;background:'+t.color+'08"><span style="color:'+t.color+';font-weight:700">'+t.label+'</span><span class="dots">';
        for(var di=0;di<5;di++){html+='<span class="dot" style="background:'+(di<str?t.color:"#e5e7eb")+'"></span>'}
        html+='</span></div>'});html+='</div>'}

    // ═══ MOAT DURABILITY SCORES ═══
    if(moatSvg){html+='<div class="sec-h">Moat Durability Analysis'+(c._moatCache?' — '+c._moatCache.composite.toFixed(1)+'/10':'')+'</div>';html+=moatSvg}

    // ═══ KEY PERFORMANCE INDICATORS ═══
    if(kpiRows){html+='<div class="sec-h">Key Performance Indicators</div>';html+=kpiRows}

    // ═══ CONVICTION HISTORY ═══
    if(convSvg){html+='<div class="sec-h">Conviction History</div>';html+=convSvg;
      html+='<div style="display:flex;gap:16px;font-size:10px;color:#9ca3af;margin-top:4px">';
      if(c.convictionHistory.length>0){var first=c.convictionHistory[0];var last=c.convictionHistory[c.convictionHistory.length-1];
        html+='<span>'+first.date.substring(0,10)+': '+first.rating+'/10</span><span>→</span><span>'+last.date.substring(0,10)+': '+last.rating+'/10</span>'}
      html+='</div>'}

    // ═══ DECISION LEDGER ═══
    if(decRows){html+='<div class="sec-h">Decision Ledger</div>';html+=decRows}

    // ═══ EARNINGS HISTORY ═══
    if(c.earningsHistory&&c.earningsHistory.length){html+='<div class="sec-h">Earnings History</div>';
      c.earningsHistory.slice(0,4).forEach(function(e){
        html+='<div style="padding:8px 14px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:6px"><span class="mono" style="font-size:11px;font-weight:700;color:#1a1a2e">'+e.quarter+'</span>';
        html+='<div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.5">'+((e.summary||"").substring(0,200))+'</div></div>'})}

    // ═══ FINANCIAL SNAPSHOT ═══
    if(c.financialSnapshot&&Object.keys(c.financialSnapshot).length>0){html+='<div class="sec-h">Financial Snapshot</div>';
      html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">';
      var snap=c.financialSnapshot;Object.keys(snap).forEach(function(k){var s=snap[k];if(!s||!s.value)return;
        html+='<div style="padding:6px 10px;border:1px solid #f3f4f6;border-radius:4px"><div style="font-size:9px;color:#9ca3af;font-family:JetBrains Mono,monospace;letter-spacing:.5px">'+s.label+'</div><div class="mono" style="font-size:13px;font-weight:600;color:#1a1a2e">'+s.value+'</div></div>'});
      html+='</div>'}

    // ═══ FOOTER ═══
    html+='<div class="footer"><div class="footer-left"><svg width="12" height="12" viewBox="0 0 100 100" style="vertical-align:middle;margin-right:3px"><rect width="100" height="100" rx="16" fill="#1a1a2e"/><path d="M50 18L82 78H18L50 18Z" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"/><path d="M50 38L66 70H34L50 38Z" fill="white"/></svg>ThesisAlpha</div>';
    html+='<div class="footer-right"><div style="font-family:JetBrains Mono,monospace;font-size:10px;color:#6b7280">'+c.ticker+' · '+c.name+'</div>';
    html+='<div>'+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})+'</div></div></div>';
    html+='<div class="footer-disc">This document was generated by ThesisAlpha for personal investment research purposes. It does not constitute financial advice. All data is sourced from third-party providers and may contain errors. Past performance does not indicate future results.</div>';
    html+='</div></body></html>';
    var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.print()},600)}

  // ── Research Export Pack (for NotebookLM, ChatGPT, etc.) ──
  function exportResearch(cid){var c=cos.find(function(x){return x.id===cid});if(!c)return;
    var sec=parseThesis(c.thesisNote);var pos=c.position||{};
    var lines=[];
    lines.push("# "+c.ticker+" — "+c.name);
    lines.push("Sector: "+c.sector+(c.industry?" / "+c.industry:""));
    lines.push("Status: "+(c.status||"portfolio")+(c.investStyle?" | Style: "+c.investStyle:""));
    lines.push("Generated: "+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}));
    if(c.purchaseDate)lines.push("Owned since: "+c.purchaseDate);
    lines.push("");
    // Position
    if(pos.shares>0){lines.push("## Position");lines.push("Shares: "+pos.shares+" | Avg Cost: $"+pos.avgCost+" | Current: $"+(pos.currentPrice||0));
      var ret=pos.avgCost>0&&pos.currentPrice>0?((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)+"%":"N/A";
      lines.push("Return: "+ret+" | Market Value: $"+(pos.shares*(pos.currentPrice||0)).toLocaleString());lines.push("")}
    // Thesis
    lines.push("## Investment Thesis");
    if(sec.core){lines.push("### Core Thesis");lines.push(sec.core);lines.push("")}
    if(sec.moat){lines.push("### Moat Analysis");lines.push(sec.moat);lines.push("")}
    if(sec.risks){lines.push("### Key Risks");lines.push(sec.risks);lines.push("")}
    if(sec.sell){lines.push("### Sell Criteria");lines.push(sec.sell);lines.push("")}
    // Conviction
    lines.push("## Conviction: "+(c.conviction||0)+"/10");
    if(c.convictionHistory&&c.convictionHistory.length>0){lines.push("History:");c.convictionHistory.forEach(function(ch){lines.push("- "+ch.date.substring(0,10)+": "+ch.rating+"/10"+(ch.note?" — "+ch.note:""))});lines.push("")}
    // KPIs
    if(c.kpis&&c.kpis.length>0){lines.push("## KPI Tracking");c.kpis.forEach(function(k){var status=k.lastResult?k.lastResult.status:"pending";var actual=k.lastResult?"Last: "+k.lastResult.actual+(k.unit||""):"No data yet";
      lines.push("- "+k.name+": Target "+k.target+" | "+actual+" | Status: "+status)});lines.push("")}
    // Earnings History
    if(c.earningsHistory&&c.earningsHistory.length>0){lines.push("## Earnings History");c.earningsHistory.forEach(function(e){lines.push("### "+e.quarter);if(e.summary)lines.push(e.summary);
      if(e.results&&e.results.length>0){e.results.forEach(function(r){lines.push("- "+r.kpi_name+": "+r.actual_value+" ("+r.status+")")})}lines.push("")})}
    // Financial Snapshot
    if(c.financialSnapshot&&Object.keys(c.financialSnapshot).length>0){lines.push("## Financial Snapshot (Latest)");Object.keys(c.financialSnapshot).forEach(function(k){var s=c.financialSnapshot[k];if(s&&s.value)lines.push("- "+s.label+": "+s.value)});lines.push("")}
    // Moat types
    var mt=c.moatTypes||{};var activeMoats=MOAT_TYPES.filter(function(t){return mt[t.id]&&mt[t.id].active});
    if(activeMoats.length>0){lines.push("## Moat Classification");activeMoats.forEach(function(t){var d=mt[t.id];lines.push("- "+t.label+" (strength: "+((d.strength||3))+"/5)"+(d.notes?" — "+d.notes:""))});lines.push("")}
    // Decisions
    if(c.decisions&&c.decisions.length>0){lines.push("## Research Journal");c.decisions.slice(0,10).forEach(function(d){lines.push("- "+d.date.substring(0,10)+" "+d.action+(d.price?" @ $"+d.price:"")+(d.shares?" ("+d.shares+" shares)":""));if(d.reasoning)lines.push("  Reasoning: "+d.reasoning);if(d.outcome)lines.push("  Outcome: "+d.outcome+(d.outcomeNote?" — "+d.outcomeNote:""))});lines.push("")}
    // Dividends
    var dps=c.divPerShare||c.lastDiv||0;
    if(dps>0){var mult2=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
      lines.push("## Dividend");lines.push("Per payment: $"+dps.toFixed(2)+" ("+c.divFrequency+") | Annual: $"+(dps*mult2).toFixed(2));
      if(pos.currentPrice>0)lines.push("Yield: "+((dps*mult2)/pos.currentPrice*100).toFixed(2)+"%");lines.push("")}
    lines.push("---");lines.push("Exported from ThesisAlpha | "+c.ticker+" | "+new Date().toISOString().substring(0,10));
    var txt=lines.join("\n");
    navigator.clipboard.writeText(txt).then(function(){showToast("Research pack copied — paste into NotebookLM, ChatGPT, or any AI tool","milestone",4000)}).catch(function(){
      var blob=new Blob([txt],{type:"text/markdown"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=c.ticker+"_research_export.md";a.click();URL.revokeObjectURL(url);showToast("Downloaded "+c.ticker+"_research_export.md","milestone",3000)})}
  function exportCSV(list){
    var rows=[["Ticker","Company","Sector","Status","Shares","Avg Cost","Current Price","Return %","Market Value","Conviction","Earnings Date","KPIs Met","Target Price","Thesis"]];
    list.forEach(function(c){var pos=c.position||{};var ret=pos.avgCost>0&&pos.currentPrice>0?((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(2):"";
      var val=pos.shares>0&&pos.currentPrice>0?(pos.shares*pos.currentPrice).toFixed(0):"";
      var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;var total=c.kpis.filter(function(k){return k.lastResult}).length;
      rows.push([c.ticker,'"'+c.name+'"',c.sector,c.status||"portfolio",pos.shares||"",pos.avgCost||"",pos.currentPrice||"",ret,val,c.conviction||"",c.earningsDate||"",total>0?met+"/"+total:"",c.targetPrice||"",'"'+(c.thesisNote||"").replace(/"/g,"''")+'"'])});
    var csv=rows.map(function(r){return r.join(",")}).join("\n");
    var blob=new Blob([csv],{type:"text/csv"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="thesisalpha-portfolio-"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(url)}
  function SettingsModal(){
    var _st=useState("widgets"),sTab=_st[0],setSTab=_st[1];
    var items=[{k:"showSummary",l:"Portfolio Summary Cards",d:"Total value, return, best/worst performer"},{k:"showOwnerScore",l:"Owner’s Score",d:"Process quality score"},{k:"showPriceChart",l:"Price Chart",d:"Historical price with entry points"},{k:"showPreEarnings",l:"Pre-Earnings Briefing",d:"Auto-generated when earnings within 14 days"},{k:"showPrices",l:"Stock Prices on Cards",d:"Show current price"},{k:"showPositions",l:"Position Details on Cards",d:"Show shares, return %"},{k:"showHeatmap",l:"Portfolio Heatmap",d:"Color-coded performance map"},{k:"showSectors",l:"Sector Concentration",d:"Sector breakdown chart"},{k:"showDividends",l:"Dividend Overview",d:"Dividend income tracking"},{k:"showAnalyst",l:"Analyst & Insider Data",d:"Recommendations, price targets"},{k:"showBuyZone",l:"Buy Zone Indicators",d:"Show when price is below targets"}];
    var allThemes=[{id:"light",name:"Light",desc:"Clean and bright",color:"#f7f7f7",accent:"#1a1a1a",unlock:0},{id:"dark",name:"Dark",desc:"Easy on the eyes",color:"#1a1a1a",accent:"#ffffff",unlock:0},{id:"forest",name:"Forest",desc:"Duolingo-inspired, playful",color:"#f0f0f0",accent:"#58cc02",unlock:1},{id:"purple",name:"Purple",desc:"Financial purple",color:"#13111c",accent:"#a78bfa",unlock:1},{id:"paypal",name:"PayPal Blue",desc:"Professional blue",color:"#f5f7fa",accent:"#003087",unlock:3},{id:"bloomberg",name:"Bloomberg",desc:"Terminal black & orange",color:"#000000",accent:"#ff8800",unlock:5}];
    return<Modal title="Settings" onClose={function(){setModal(null)}} K={K} w={500}>
      {/* Tab bar */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid "+K.bdr}}>{[{id:"widgets",l:"Widgets"},{id:"themes",l:"Themes"},{id:"rewards",l:"Rewards"}].map(function(t){return<button key={t.id} onClick={function(){setSTab(t.id)}} style={{padding:"8px 16px",fontSize:12,fontFamily:fm,fontWeight:sTab===t.id?600:400,color:sTab===t.id?K.acc:K.dim,background:"transparent",border:"none",borderBottom:sTab===t.id?"2px solid "+K.acc:"2px solid transparent",cursor:"pointer",marginBottom:-1}}>{t.l}</button>})}</div>
      {/* ── Widgets Tab ── */}
      {sTab==="widgets"&&<div>
        <div style={{fontSize:12,color:K.dim,marginBottom:16}}>Toggle dashboard widgets on or off.</div>
        {items.map(function(it){return<div key={it.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid "+K.bdr}}>
          <div><div style={{fontSize:13,color:K.txt,fontWeight:500}}>{it.l}</div><div style={{fontSize:11,color:K.dim,marginTop:2}}>{it.d}</div></div>
          <button onClick={function(){toggleDash(it.k)}} style={{width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",background:dashSet[it.k]?K.acc:K.bdr2,position:"relative",transition:"background .2s",flexShrink:0}}>
            <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:dashSet[it.k]?23:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/></button></div>})}
      </div>}
      {/* ── Themes Tab ── */}
      {sTab==="themes"&&<div>
        <div style={{fontSize:12,color:K.dim,marginBottom:16}}>Unlock new themes by building your weekly streak.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {allThemes.map(function(t){var unlocked=(streakData.current||0)>=t.unlock;var active=theme===t.id;
            return<div key={t.id} style={{borderRadius:10,border:"2px solid "+(active?K.acc:unlocked?K.bdr:"transparent"),background:unlocked?K.card:K.bg,padding:"14px 16px",cursor:unlocked?"pointer":"default",opacity:unlocked?1:.5,position:"relative"}} onClick={function(){if(unlocked){setTheme(t.id);try{localStorage.setItem("ta-theme",t.id)}catch(e){}}}}>
              {!unlocked&&<div style={{position:"absolute",top:8,right:8,fontSize:12}}>{String.fromCodePoint(0x1F512)}</div>}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:28,height:28,borderRadius:6,background:t.color,border:"1px solid "+K.bdr,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:10,height:10,borderRadius:2,background:t.accent}}/></div>
                <div><div style={{fontSize:12,fontWeight:600,color:unlocked?K.txt:K.dim}}>{t.name}</div>
                  <div style={{fontSize:9,color:K.dim}}>{t.desc}</div></div></div>
              {!unlocked&&<div style={{fontSize:9,color:K.dim,fontFamily:fm}}>Week {t.unlock} streak</div>}
              {active&&<div style={{fontSize:9,color:K.acc,fontFamily:fm,fontWeight:600}}>Active</div>}
            </div>})}</div>
      </div>}
      {/* ── Rewards Tab ── */}
      {sTab==="rewards"&&<div>
        <div style={{fontSize:12,color:K.dim,marginBottom:16}}>Complete your Weekly Review every week to build a streak. Each milestone unlocks new features and investor lenses.</div>
        <div style={{display:"grid",gap:6}}>
          {[{w:1,icon:String.fromCodePoint(0x1F3A8),label:"Forest & Purple themes",desc:"Two new color palettes"},
            {w:2,icon:String.fromCodePoint(0x1F916),label:"Research Export Pack",desc:"One-click export for AI tools"},
            {w:3,icon:String.fromCodePoint(0x1F4B3),label:"PayPal Blue theme",desc:"Crisp professional blue"},
            {w:4,icon:String.fromCodePoint(0x1F9D0),label:"Charlie Munger lens",desc:"Quality at Scale"},
            {w:5,icon:String.fromCodePoint(0x1F4BB),label:"Bloomberg Terminal theme",desc:"The iconic black & orange"},
            {w:8,icon:String.fromCodePoint(0x1F3E6),label:"Warren Buffett lens",desc:"Owner Earnings"},
            {w:12,icon:String.fromCodePoint(0x2728),label:"Joel Greenblatt lens",desc:"Magic Formula"},
            {w:16,icon:String.fromCodePoint(0x1F4DA),label:"Peter Lynch lens",desc:"Growth at a Price"},
            {w:20,icon:String.fromCodePoint(0x1F4C8),label:"Shelby Cullom Davis lens",desc:"Davis Double Play"},
            {w:24,icon:String.fromCodePoint(0x1F3AF),label:"Chris Hohn lens",desc:"Activist Value"}
          ].map(function(r){var unlocked=(streakData.current||0)>=r.w;return<div key={r.w} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:unlocked?K.grn+"06":"transparent",border:"1px solid "+(unlocked?K.grn+"20":K.bdr),borderRadius:8,opacity:unlocked?1:.7}}>
            <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:unlocked?600:400,color:unlocked?K.txt:K.mid}}>{r.label}</div>
              <div style={{fontSize:10,color:K.dim}}>{r.desc}</div></div>
            <div style={{fontSize:10,fontFamily:fm,color:unlocked?K.grn:K.dim,fontWeight:600,flexShrink:0}}>{unlocked?"✓":"Wk "+r.w}</div></div>})}</div>
        <div style={{fontSize:10,color:K.dim,marginTop:10,fontStyle:"italic"}}>Current streak: {streakData.current||0} week{(streakData.current||0)!==1?"s":""}. {streakData.freezes>0?streakData.freezes+" freeze"+(streakData.freezes>1?"s":"")+" available. ":""}Earn a freeze every 4 consecutive weeks.</div>
        <div style={{marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={function(){setModal(null);setObStep(1)}} style={{background:"none",border:"none",color:K.dim,fontSize:11,cursor:"pointer",padding:0,fontFamily:fm}}>Replay welcome tour</button>
          <button onClick={function(){setModal(null)}} style={S.btnP}>Done</button></div>
      </div>}
    </Modal>}
  // ── Upgrade Modal ──────────────────────────────────────────
  function UpgradeModal(){
    var _loading=useState(null),loading=_loading[0],setLoading=_loading[1];
    var ctxMsg={"trial-ending":"Your trial ends in "+trialDaysLeft+" day"+(trialDaysLeft!==1?"s":"")+". Lock in Pro to keep your data features.","trial-expired":"Your "+(!trialBonusEarned?TRIAL_BASE:TRIAL_TOTAL)+"-day trial has ended. Your theses and data are safe — upgrade to continue using data features.",companies:"Upgrade to unlock data features.",earnings:"Earnings checking is a Pro feature.",financials:"Financial statements are a Pro feature.",charts:"Price charts are a Pro feature.",analysts:"Analyst data is a Pro feature.",import:"CSV import is a Pro feature.",export:"Premium PDF export is a Pro feature."}[upgradeCtx]||"Unlock the full ThesisAlpha experience.";
    function startCheckout(priceId){setLoading(priceId);
      fetch("/api/stripe/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({priceId:priceId,userId:props.userId,email:props.user})}).then(function(r){return r.json()}).then(function(d){if(d.url)window.location.href=d.url;else{setLoading(null);showToast("Checkout error — please try again","info",4000)}}).catch(function(e){setLoading(null);showToast("Connection error","info",3000)})}
    return<Modal title="Upgrade to Owner’s Plan" onClose={function(){setShowUpgrade(false)}} w={520} K={K}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:13,color:K.mid,lineHeight:1.7}}>{ctxMsg}</div>
        <div style={{fontSize:12,color:K.dim,marginTop:4}}>Your process tools stay free forever. Add real-time data to supercharge them.</div></div>
      {/* Feature list */}
      <div style={{background:K.bg,borderRadius:10,padding:"16px 20px",marginBottom:24}}>
        {[{t:"Auto earnings check + notifications",i:"⚡"},{t:"Financial statements (10yr history)",i:"📊"},{t:"Data-driven moat analysis (8 metrics)",i:"🏰"},{t:"Analyst targets + insider trades",i:"📋"},{t:"Price charts with conviction markers",i:"📈"},{t:"Community benchmarks & consensus",i:"👥"},{t:"Premium PDF export",i:"📄"}].map(function(f){return<div key={f.t} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0"}}>
          <span style={{fontSize:14,width:20,textAlign:"center"}}>{f.i}</span>
          <span style={{fontSize:12,color:K.txt,fontFamily:fm}}>{f.t}</span></div>})}</div>
      {/* Pricing cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 16px",textAlign:"center"}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:10}}>Monthly</div>
          <div style={{fontSize:28,fontWeight:700,color:K.txt,fontFamily:fm}}>$9<span style={{fontSize:12,fontWeight:400,color:K.dim}}>/mo</span></div>
          <div style={{fontSize:10,color:K.dim,marginBottom:14}}>Cancel anytime</div>
          <button onClick={function(){startCheckout(typeof window!=="undefined"&&window.__TA_STRIPE_MONTHLY||"price_monthly")}} disabled={loading==="monthly"} style={Object.assign({},S.btn,{width:"100%",padding:"10px",fontSize:12,opacity:loading==="monthly"?.5:1})}>{loading==="monthly"?"Redirecting…":"Start Monthly"}</button></div>
        <div style={{background:K.card,border:"2px solid "+K.acc,borderRadius:12,padding:"20px 16px",textAlign:"center",position:"relative"}}>
          <div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:K.acc,color:K.bg,fontSize:9,fontWeight:700,padding:"2px 10px",borderRadius:10,fontFamily:fm,letterSpacing:1}}>BEST VALUE</div>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:10}}>Annual</div>
          <div style={{fontSize:28,fontWeight:700,color:K.txt,fontFamily:fm}}>$79<span style={{fontSize:12,fontWeight:400,color:K.dim}}>/yr</span></div>
          <div style={{fontSize:10,color:K.grn,marginBottom:14}}>Save 27% — $6.58/mo</div>
          <button onClick={function(){startCheckout(typeof window!=="undefined"&&window.__TA_STRIPE_ANNUAL||"price_annual")}} disabled={loading==="annual"} style={Object.assign({},S.btnP,{width:"100%",padding:"10px",fontSize:12,opacity:loading==="annual"?.5:1})}>{loading==="annual"?"Redirecting…":"Start Annual"}</button></div></div>
      <div style={{textAlign:"center",fontSize:10,color:K.dim,lineHeight:1.6}}>Free forever: unlimited companies, thesis editor, conviction tracking, weekly reviews, decision journal, all process tools</div>
    </Modal>}
  function renderModal(){if(!modal)return null;var map={add:AddModal,edit:EditModal,thesis:ThesisModal,kpi:KpiModal,result:ResultModal,del:DelModal,doc:DocModal,memo:MemoModal,clip:ClipModal,irentry:IREntryModal,position:PositionModal,conviction:ConvictionModal,manualEarnings:ManualEarningsModal,settings:SettingsModal,csvImport:CSVImportModal};var C=map[modal.type];return C?<C/>:null}

  // ── Onboarding Flow ──────────────────────────────────────
  function finishOnboarding(){setObStep(0);try{localStorage.setItem("ta-onboarded","true")}catch(e){}}
  function OnboardingFlow(){
    var _ot=useState(""),oTicker=_ot[0],setOTicker=_ot[1];
    var _on=useState(""),oName=_on[0],setOName=_on[1];
    var _os=useState(""),oSector=_os[0],setOSector=_os[1];
    var _ol=useState("idle"),oLook=_ol[0],setOLook=_ol[1];
    var _od=useState(""),oDomain=_od[0],setODomain=_od[1];
    var _oi=useState(""),oIndustry=_oi[0],setOIndustry=_oi[1];
    var _op=useState(0),oPrice=_op[0],setOPrice=_op[1];
    var _ost=useState(""),oStyle=_ost[0],setOStyle=_ost[1];
    var oTmr=useRef(null);
    function onTickerChange(v){setOTicker(v);if(oTmr.current)clearTimeout(oTmr.current);
      var t=v.toUpperCase().trim();
      if(t.length>=1&&t.length<=6&&/^[A-Za-z.]+$/.test(t)){setOLook("loading");
        oTmr.current=setTimeout(function(){lookupTicker(t).then(function(r){
          if(r&&r.name){setOName(r.name||"");setOSector(r.sector||"");setODomain(r.domain||"");setOIndustry(r.industry||"");setOPrice(r.price||0);setOLook("done")}
          else{setOLook("error")}
        }).catch(function(){setOLook("error")})},800)}
      else{setOLook("idle")}}
    function addOnboardingCompany(){
      if(!oTicker.trim()||!oName.trim())return;
      var nc={id:nId(cos),ticker:oTicker.toUpperCase().trim(),name:oName.trim(),sector:oSector,industry:oIndustry,domain:oDomain,irUrl:"",earningsDate:"TBD",earningsTime:"AMC",thesisNote:"",kpis:[],docs:[],earningsHistory:[],researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0,position:{shares:0,avgCost:0,currentPrice:oPrice},conviction:0,convictionHistory:[],status:"portfolio",investStyle:oStyle,lastDiv:0,divPerShare:0,divFrequency:"quarterly",exDivDate:"",lastChecked:null,notes:"",earningSummary:null,sourceUrl:null,sourceLabel:null,moatTypes:{},pricingPower:null,morningstarMoat:"",moatTrend:"",thesisVersions:[],thesisUpdatedAt:""};
      setCos(function(p){return p.concat([nc])});setSelId(nc.id);setObStep(4)}
    var overlay={position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999};
    var card={background:K.card,border:"1px solid "+K.bdr,borderRadius:isMobile?0:16,width:isMobile?"100%":520,maxWidth:isMobile?"100%":"90vw",maxHeight:isMobile?"100vh":"90vh",height:isMobile?"100vh":"auto",overflowY:"auto",padding:isMobile?"24px 20px":"36px 40px",position:"relative"};
    var stepDots=function(){return<div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:28}}>
      {[1,2,3,4,5].map(function(s){return<div key={s} style={{width:s===obStep?24:8,height:8,borderRadius:4,background:s===obStep?K.acc:s<obStep?K.acc+"60":K.bdr,transition:"all .3s"}}/>})}</div>};
    // Step 1: Welcome
    if(obStep===1)return<div style={overlay}><div className="ta-slide" style={card}>
      {stepDots()}
      <div style={{textAlign:"center",marginBottom:24}}>
        <TLogo size={36} dark={isDark}/>
        <h1 style={{fontSize:28,fontWeight:400,color:K.txt,fontFamily:fh,margin:"16px 0 8px"}}>Think like an owner</h1>
        <p style={{fontSize:14,color:K.mid,lineHeight:1.7,margin:0,maxWidth:380,marginLeft:"auto",marginRight:"auto"}}>ThesisAlpha helps you invest with discipline. Write a thesis for every holding, track what matters, and review when earnings drop.</p></div>
      <div style={{background:K.bg,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[{icon:"lightbulb",label:"Thesis First",desc:"Every position starts with a written reason to own it"},
            {icon:"target",label:"Track KPIs",desc:"Define the metrics that prove or disprove your thesis"},
            {icon:"bar",label:"Earnings Check",desc:"When results drop, see instantly if your thesis holds"},
            {icon:"castle",label:"Moat Analysis",desc:"Score competitive advantages with real financial data"}
          ].map(function(item){return<div key={item.label} style={{flex:1,textAlign:"center"}}>
            <div style={{width:36,height:36,borderRadius:8,background:K.acc+"15",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}><IC name={item.icon} size={16} color={K.acc}/></div>
            <div style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:3}}>{item.label}</div>
            <div style={{fontSize:10,color:K.dim,lineHeight:1.4}}>{item.desc}</div></div>})}</div></div>
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        <button onClick={function(){setObPath("fresh");setCos([]);setObStep(2)}} style={Object.assign({},S.btnP,{padding:"10px 24px",fontSize:13})}>Start Fresh</button>
        <button onClick={function(){setObPath("demo");setObStep(2)}} style={Object.assign({},S.btn,{padding:"10px 24px",fontSize:13})}>Explore with Demo Data</button></div>
      <button onClick={finishOnboarding} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:4}}>{"✕"}</button>
    </div></div>;
    // Step 2: Path-dependent
    if(obStep===2&&obPath==="fresh")return<div style={overlay}><div className="ta-slide" style={card}>
      {stepDots()}
      <h2 style={{fontSize:22,fontWeight:400,color:K.txt,fontFamily:fh,margin:"0 0 6px",textAlign:"center"}}>Add your first company</h2>
      <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 24px"}}>Type a ticker and we'll auto-fill the details</p>
      <div style={{marginBottom:16}}>
        <label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Ticker</label>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <input value={oTicker} onChange={function(e){onTickerChange(e.target.value)}} placeholder="AAPL" style={{flex:"0 0 120px",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"10px 14px",fontSize:16,fontFamily:fm,fontWeight:600,outline:"none",textTransform:"uppercase",letterSpacing:1}} spellCheck={false} autoFocus/>
          {oLook==="loading"&&<span style={{display:"inline-block",width:14,height:14,border:"2px solid "+K.bdr2,borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>}
          {oLook==="done"&&<span style={{fontSize:12,color:K.grn,fontFamily:fm}}>{"✓"} Found</span>}
          {oLook==="error"&&<span style={{fontSize:12,color:K.amb}}>Not found — type name below</span>}
        </div></div>
      {(oLook==="done"||oLook==="error")&&<div style={{marginBottom:16}}>
        <label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Company Name</label>
        <input value={oName} onChange={function(e){setOName(e.target.value)}} placeholder="Apple Inc." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"10px 14px",fontSize:14,fontFamily:fb,outline:"none"}}/>
      </div>}
      {oLook==="done"&&oSector&&<div style={{display:"flex",gap:8,marginBottom:20}}>
        <span style={{fontSize:11,color:K.mid,background:K.bg,padding:"4px 10px",borderRadius:6,fontFamily:fm}}>{oSector}</span>
        {oDomain&&<span style={{fontSize:11,color:K.dim,background:K.bg,padding:"4px 10px",borderRadius:6,fontFamily:fm}}>{oDomain}</span>}
      </div>}
      {(oLook==="done"||oLook==="error")&&<div style={{marginBottom:20}}>
        <label style={{display:"block",fontSize:11,color:K.dim,marginBottom:8,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Investment Style</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {INVEST_STYLES.map(function(st){var isSel=oStyle===st.id;return<button key={st.id} onClick={function(){setOStyle(isSel?"":st.id)}} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 11px",borderRadius:6,border:"1px solid "+(isSel?st.color+"60":K.bdr),background:isSel?st.color+"15":"transparent",color:isSel?st.color:K.mid,fontSize:10,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400,transition:"all .15s"}}>
            <IC name={st.icon} size={9} color={isSel?st.color:K.dim}/>{st.label}</button>})}</div>
        {oStyle&&STYLE_MAP[oStyle]&&<div style={{fontSize:10,color:K.dim,marginTop:6}}>{STYLE_MAP[oStyle].desc}</div>}
      </div>}
      <div style={{display:"flex",gap:12,justifyContent:"space-between",marginTop:8}}>
        <button onClick={function(){setObStep(1)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:12})}>{"←"} Back</button>
        <div style={{display:"flex",gap:10}}>
          <button onClick={function(){setObStep(3)}} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",padding:"9px 12px"}}>Skip for now</button>
          <button onClick={addOnboardingCompany} style={Object.assign({},S.btnP,{padding:"9px 20px",fontSize:12,opacity:oTicker.trim()&&oName.trim()?1:.4})} disabled={!oTicker.trim()||!oName.trim()}>Add & Continue</button></div></div>
      <button onClick={finishOnboarding} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:4}}>{"✕"}</button>
    </div></div>;
    if(obStep===2&&obPath==="demo")return<div style={overlay}><div className="ta-slide" style={card}>
      {stepDots()}
      <h2 style={{fontSize:22,fontWeight:400,color:K.txt,fontFamily:fh,margin:"0 0 6px",textAlign:"center"}}>Meet your demo portfolio</h2>
      <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 24px"}}>We've loaded two companies so you can explore every feature</p>
      <div style={{display:"grid",gap:12,marginBottom:24}}>
        {cos.filter(function(c){return c.status==="portfolio"}).map(function(c){return<div key={c.id} style={{display:"flex",alignItems:"center",gap:14,background:K.bg,borderRadius:10,padding:"14px 18px",border:"1px solid "+K.bdr}}>
          <CoLogo domain={c.domain} ticker={c.ticker} size={32}/>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:12,color:K.dim}}>{c.name}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:11,color:K.mid,fontFamily:fm}}>{c.kpis.length} KPIs tracked</div>
            {c.thesisNote&&<div style={{fontSize:10,color:K.grn,fontFamily:fm}}>Thesis written</div>}</div></div>})}
        {cos.filter(function(c){return c.status==="watchlist"}).length>0&&<div style={{fontSize:11,color:K.dim,textAlign:"center"}}>+ {cos.filter(function(c){return c.status==="watchlist"}).length} on watchlist</div>}
      </div>
      <div style={{background:K.acc+"08",border:"1px solid "+K.acc+"25",borderRadius:8,padding:"12px 16px",marginBottom:20}}>
        <div style={{fontSize:12,color:K.acc,fontWeight:600,marginBottom:4}}>Try this</div>
        <div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>Click on NVDA to see a fully built-out thesis, KPI tracking, and conviction history. Edit anything to make it yours.</div></div>
      <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
        <button onClick={function(){setObStep(1)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:12})}>{"←"} Back</button>
        <button onClick={function(){setObStep(3)}} style={Object.assign({},S.btnP,{padding:"9px 20px",fontSize:12})}>Next {"→"}</button></div>
      <button onClick={finishOnboarding} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:4}}>{"✕"}</button>
    </div></div>;
    // Step 3: The Owner's Loop
    if(obStep===3)return<div style={overlay}><div className="ta-slide" style={card}>
      {stepDots()}
      <h2 style={{fontSize:22,fontWeight:400,color:K.txt,fontFamily:fh,margin:"0 0 6px",textAlign:"center"}}>The Owner's Loop</h2>
      <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 28px"}}>Every great investor follows this cycle. ThesisAlpha makes it effortless.</p>
      <div className="ta-onboard-steps" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
        {[{num:"1",icon:"lightbulb",title:"Write Your Thesis",desc:"Why do you own this? What's the moat? When would you sell? Write it down before you buy.",color:K.grn},
          {num:"2",icon:"target",title:"Define KPIs",desc:"Pick 2-3 metrics that prove your thesis. Revenue growth, margins, retention — whatever matters most.",color:K.blue},
          {num:"3",icon:"bar",title:"Check Earnings",desc:"When results drop, we auto-check your KPIs against real data. See instantly if your thesis holds.",color:K.amb},
          {num:"4",icon:"castle",title:"Review & Decide",desc:"Score the moat, update conviction, log your decision. The Research Journal keeps you honest.",color:K.acc}
        ].map(function(step){return<div key={step.num} style={{background:K.bg,borderRadius:10,padding:"18px 20px",border:"1px solid "+K.bdr,position:"relative"}}>
          <div style={{position:"absolute",top:12,right:14,fontSize:24,fontWeight:700,color:step.color+"20",fontFamily:fm}}>{step.num}</div>
          <div style={{width:32,height:32,borderRadius:7,background:step.color+"15",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}><IC name={step.icon} size={15} color={step.color}/></div>
          <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:4}}>{step.title}</div>
          <div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>{step.desc}</div></div>})}</div>
      <div style={{textAlign:"center",fontSize:12,color:K.mid,fontStyle:"italic",marginBottom:20,fontFamily:fh,lineHeight:1.6}}>{"“"}The goal of each investor should be to create a portfolio that will deliver him or her the highest possible look-through earnings a decade or so from now.{"”"} {"—"} Warren Buffett</div>
      <div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px",marginBottom:20,textAlign:"left"}}>
        <div style={{fontSize:11,fontWeight:600,color:K.acc,fontFamily:fm,marginBottom:6}}>Your process builds over time</div>
        <div style={{fontSize:11,color:K.mid,lineHeight:1.7}}>Every action — writing a thesis, tracking KPIs, reviewing conviction — builds your <strong>Owner’s Score</strong>. The score measures how disciplined your process is, not whether your stocks go up. Show up consistently, and you’ll unlock investor lenses, themes, and insights along the way.</div></div>
      <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
        <button onClick={function(){setObStep(2)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:12})}>{"←"} Back</button>
        <button onClick={function(){setObStep(4)}} style={Object.assign({},S.btnP,{padding:"9px 20px",fontSize:12})}>Next {"→"}</button></div>
      <button onClick={finishOnboarding} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:4}}>{"✕"}</button>
    </div></div>;
    // Step 4: Guide to write thesis for the company they just added
    if(obStep===4){var firstCo=cos.find(function(c){return c.id===selId})||cos[cos.length-1];
      return<div style={overlay}><div className="ta-slide" style={card}>
      {stepDots()}
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:36,marginBottom:12}}>{"✍️"}</div>
        <h2 style={{fontSize:22,fontWeight:400,color:K.txt,fontFamily:fh,margin:"0 0 6px"}}>Now write your thesis</h2>
        <p style={{fontSize:13,color:K.dim,margin:0}}>Why do you own <strong style={{color:K.txt}}>{firstCo?firstCo.ticker:"this company"}</strong>? This is the foundation of owner-operator investing.</p></div>
      <div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:10,padding:"16px 20px",marginBottom:20}}>
        <div style={{fontSize:12,color:K.mid,lineHeight:1.8}}>
          A complete thesis has 4 sections:<br/>
          <strong style={{color:K.grn}}>1. Core Thesis</strong> — Why you own it<br/>
          <strong style={{color:K.blue}}>2. Moat</strong> — What protects the business<br/>
          <strong style={{color:K.amb}}>3. Risks</strong> — What could go wrong<br/>
          <strong style={{color:K.red}}>4. Sell Criteria</strong> — When you'd walk away</div></div>
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        <button onClick={function(){finishOnboarding();if(firstCo){setSelId(firstCo.id);setDetailTab("dossier");setPage("dashboard");setModal({type:"thesis"})}}} style={Object.assign({},S.btnP,{padding:"12px 28px",fontSize:14})}>Write Thesis {"→"}</button></div>
      <button onClick={function(){finishOnboarding()}} style={{display:"block",margin:"16px auto 0",background:"none",border:"none",color:K.dim,fontSize:11,cursor:"pointer"}}>Skip — I'll do this later</button>
      <button onClick={finishOnboarding} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:4}}>{"✕"}</button>
    </div></div>}
    // Step 5: Quick start tips (shown if they skip thesis)
    if(obStep===5)return<div style={overlay}><div className="ta-slide" style={card}>
      {stepDots()}
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:36,marginBottom:12}}>{"✓"}</div>
        <h2 style={{fontSize:22,fontWeight:400,color:K.txt,fontFamily:fh,margin:"0 0 6px"}}>You're all set</h2>
        <p style={{fontSize:13,color:K.dim,margin:0}}>Three things that matter most</p></div>
      <div style={{display:"grid",gap:10,marginBottom:24}}>
        {[{action:"Write a thesis for every holding",desc:"The discipline of writing forces clarity",icon:"lightbulb",color:K.grn},
          {action:"Track 2-3 KPIs per company",desc:"Define what 'working' looks like in numbers",icon:"target",color:K.blue},
          {action:"Do your Weekly Review every Sunday",desc:"3 minutes that compound over years",icon:"shield",color:K.amb}
        ].map(function(hint){return<div key={hint.action} style={{display:"flex",alignItems:"center",gap:12,background:K.bg,borderRadius:8,padding:"12px 16px",border:"1px solid "+K.bdr}}>
          <div style={{width:32,height:32,borderRadius:7,background:hint.color+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><IC name={hint.icon} size={14} color={hint.color}/></div>
          <div><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{hint.action}</div>
            <div style={{fontSize:10,color:K.dim}}>{hint.desc}</div></div></div>})}</div>
      <div style={{textAlign:"center"}}>
        <button onClick={function(){finishOnboarding();if(selId){setDetailTab("dossier")}}} style={Object.assign({},S.btnP,{padding:"12px 36px",fontSize:14})}>Start Investing</button></div>
      <button onClick={finishOnboarding} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:4}}>{"✕"}</button>
    </div></div>;
    return null}

  // ── Sidebar + TopBar ──────────────────────────────────────
  var _sq=useState(""),sideSearch=_sq[0],setSideSearch=_sq[1];
  function Sidebar(){var pCos=cos.filter(function(c){return(c.status||"portfolio")===sideTab});
    if(sideSearch.trim()){var q=sideSearch.toLowerCase();pCos=pCos.filter(function(c){return c.ticker.toLowerCase().indexOf(q)>=0||c.name.toLowerCase().indexOf(q)>=0||(c.sector||"").toLowerCase().indexOf(q)>=0})}
    if(isMobile&&!sideOpen)return null;
    function navClick(fn){return function(){fn();if(isMobile)setSideOpen(false)}}
    return<div>{isMobile&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:299}} onClick={function(){setSideOpen(false)}}/>}
    <div style={{width:isMobile?280:240,minWidth:isMobile?280:240,background:K.side,borderRight:"1px solid "+K.bdr,height:"100vh",position:isMobile?"fixed":"sticky",top:0,left:0,display:"flex",flexDirection:"column",overflowY:"auto",zIndex:isMobile?300:1,boxShadow:isMobile?"4px 0 24px rgba(0,0,0,.3)":"none",transition:"transform .2s ease"}}>
    <div style={{padding:"18px 20px",borderBottom:"1px solid "+(sideDark?K.bdr2:K.bdr),display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={navClick(function(){setSelId(null)})}><TLogo size={22} dark={sideDark}/><span style={{fontSize:13,fontWeight:600,color:sideText,letterSpacing:1.5,fontFamily:fm}}>ThesisAlpha</span>{isMobile&&<div style={{flex:1}}/> }{isMobile&&<button onClick={function(){setSideOpen(false)}} style={{background:"none",border:"none",color:sideDim2,fontSize:18,cursor:"pointer",padding:4}}>{"✕"}</button>}</div>
    <div style={{position:"relative"}} onMouseEnter={function(e){setSideHover("portfolio");setFlyY(e.currentTarget.getBoundingClientRect().top)}} onMouseLeave={function(){setSideHover(null)}}>
    <div style={{padding:"12px 20px",cursor:"pointer",background:!selId&&page==="dashboard"?K.blue+"10":"transparent",borderLeft:!selId&&page==="dashboard"?"2px solid "+K.blue:"2px solid transparent"}} onClick={navClick(function(){setSelId(null);setPage("dashboard")})}><span style={{fontSize:12,color:!selId&&page==="dashboard"?K.blue:sideMid,fontWeight:!selId&&page==="dashboard"?600:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="overview" size={14} color={!selId&&page==="dashboard"?K.blue:sideMid}/>Portfolio Overview</span></div>
    {sideHover==="portfolio"&&!isMobile&&<div style={{position:"fixed",left:(isMobile?280:240),top:flyY,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 0",boxShadow:"0 4px 16px rgba(0,0,0,.2)",zIndex:9999,minWidth:160}} onMouseEnter={function(){setSideHover("portfolio")}} onMouseLeave={function(){setSideHover(null)}}>
      {[{l:"Portfolio",pg:"dashboard",icon:"overview"},{l:"Analytics",pg:"analytics",icon:"bar"},{l:"Earnings Calendar",pg:"calendar",icon:"target"},{l:"Dividends",pg:"dividends",icon:"dollar"},{l:"Timeline",pg:"timeline",icon:"trending"}].map(function(sub){return<div key={sub.pg} onClick={navClick(function(){setSelId(null);setPage(sub.pg);setSideHover(null)})} style={{padding:"8px 16px",cursor:"pointer",fontSize:11,color:K.mid,fontFamily:fm,display:"flex",alignItems:"center",gap:8}} onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"10"}} onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}><IC name={sub.icon} size={12} color={K.dim}/>{sub.l}</div>})}</div>}</div>
    <div style={{position:"relative"}} onMouseEnter={function(e){setSideHover("hub");setFlyY(e.currentTarget.getBoundingClientRect().top)}} onMouseLeave={function(){setSideHover(null)}}>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="hub"?K.acc+"10":"transparent",borderLeft:page==="hub"?"2px solid "+K.acc:"2px solid transparent"}} onClick={navClick(function(){setSelId(null);setPage("hub")})}><span style={{fontSize:12,color:page==="hub"?K.acc:sideMid,fontWeight:page==="hub"?600:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="book" size={14} color={page==="hub"?K.acc:sideMid}/>Owner's Hub</span></div>
    {sideHover==="hub"&&!isMobile&&<div style={{position:"fixed",left:(isMobile?280:240),top:flyY,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 0",boxShadow:"0 4px 16px rgba(0,0,0,.2)",zIndex:9999,minWidth:160}} onMouseEnter={function(){setSideHover("hub")}} onMouseLeave={function(){setSideHover(null)}}>
      {[{l:"Command Center",pg:"hub",icon:"trending"},{l:"Research Journal",pg:"hub",icon:"book"},{l:"Research Trail",pg:"hub",icon:"file"},{l:"Investor Lenses",pg:"hub",icon:"search"},{l:"How It Works",pg:"hub",icon:"lightbulb"}].map(function(sub){return<div key={sub.l} onClick={navClick(function(){setSelId(null);setPage("hub");setSideHover(null)})} style={{padding:"8px 16px",cursor:"pointer",fontSize:11,color:K.mid,fontFamily:fm,display:"flex",alignItems:"center",gap:8}} onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"10"}} onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}><IC name={sub.icon} size={12} color={K.dim}/>{sub.l}</div>})}</div>}</div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="review"?K.grn+"10":"transparent",borderLeft:page==="review"?"2px solid "+K.grn:"2px solid transparent"}} onClick={navClick(function(){setSelId(null);setPage("review")})}><span style={{fontSize:12,color:page==="review"?K.grn:sideMid,fontWeight:page==="review"?600:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="shield" size={14} color={page==="review"?K.grn:sideMid}/>Weekly Review{!currentWeekReviewed&&<span style={{width:6,height:6,borderRadius:"50%",background:K.grn,display:"inline-block"}}/>}</span></div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="assets"?K.amb+"10":"transparent",borderLeft:page==="assets"?"2px solid "+K.amb:"2px solid transparent"}} onClick={navClick(function(){setSelId(null);setPage("assets")})}><span style={{fontSize:12,color:page==="assets"?K.amb:sideMid,fontWeight:page==="assets"?600:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="dollar" size={14} color={page==="assets"?K.amb:sideMid}/>All Assets</span></div>
    {/* More pages accessible via links, not sidebar */}
    {/* Plan badge */}
    <div style={{padding:"10px 20px"}}>
      {plan==="pro"?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:K.grn+"10",border:"1px solid "+K.grn+"25",borderRadius:8,cursor:"pointer"}} onClick={openManage}>
        <span style={{fontSize:10,fontWeight:700,color:K.grn,fontFamily:fm,letterSpacing:1}}>PRO</span>
        <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>Manage plan</span></div>
      :trialActive?<div style={{padding:"10px 14px",background:K.acc+"08",border:"1px solid "+K.acc+"20",borderRadius:8}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:10,fontWeight:700,color:K.acc,fontFamily:fm,letterSpacing:1}}>TRIAL</span>
          <span style={{fontSize:10,color:trialDaysLeft<=3?K.red:trialDaysLeft<=7?K.amb:K.dim,fontWeight:600,fontFamily:fm}}>{trialDaysLeft}d left</span></div>
        {!trialBonusEarned&&<div>
          <div style={{display:"flex",gap:3,marginBottom:4}}>{[0,1,2].map(function(i){return<div key={i} style={{flex:1,height:4,borderRadius:2,background:i<thesisProgress?K.grn:K.bdr,transition:"background .3s"}}/>})}</div>
          <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>{thesisProgress}/{THESIS_UNLOCK} theses {"→"} +{TRIAL_BONUS} days</div></div>}
        {trialBonusEarned&&<div style={{fontSize:9,color:K.grn,fontFamily:fm}}>{"✓"} Bonus earned — {TRIAL_TOTAL} day trial</div>}</div>
      :<button onClick={function(){setShowUpgrade(true);setUpgradeCtx(trialExpired?"trial-expired":"")}} style={{width:"100%",padding:"9px 14px",background:"transparent",border:"1px solid "+K.acc+"40",borderRadius:8,fontSize:11,color:K.acc,cursor:"pointer",fontFamily:fm,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Upgrade to Pro</button>}</div>
    <div style={{padding:"10px 16px 6px"}}>
      <select value={sideTab} onChange={function(e){setSideTab(e.target.value)}} style={{width:"100%",background:K.bg,border:"1px solid "+(sideTab==="portfolio"?K.acc:sideTab==="toohard"?K.red:K.amb)+"50",borderRadius:8,color:sideTab==="portfolio"?K.acc:sideTab==="toohard"?K.red:K.amb,padding:"9px 14px",fontSize:12,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
        <option value="portfolio">Portfolio ({cos.filter(function(c){return(c.status||"portfolio")==="portfolio"}).length})</option>
        <option value="watchlist">Watchlist ({cos.filter(function(c){return c.status==="watchlist"}).length})</option>
        <option value="toohard">Too Hard ({cos.filter(function(c){return c.status==="toohard"}).length})</option>
      </select>
      {cos.length>4&&<input value={sideSearch} onChange={function(e){setSideSearch(e.target.value)}} placeholder="Search..." style={{width:"100%",boxSizing:"border-box",marginTop:8,background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"7px 10px",fontSize:11,fontFamily:fm,outline:"none"}}/>}</div>
    <div style={{flex:1,overflowY:"auto",paddingTop:4}}>{pCos.map(function(c){var active=selId===c.id,h=gH(c.kpis),d=dU(c.earningsDate);
      return<div key={c.id} className="ta-side-item" style={{padding:"10px 16px 10px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,background:active?K.blue+"10":"transparent",borderLeft:active?"2px solid "+K.blue:"2px solid transparent"}} onClick={navClick(function(){setSelId(c.id);setExpKpi(null);setSubPage(null);setDetailTab("dossier");setPage("dashboard")})}>
        <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:active?sideText:sideMid,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:10,color:sideDim2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div></div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}><div style={{width:6,height:6,borderRadius:"50%",background:h.c}}/>
          {d>=0&&d<=7&&<div style={{fontSize:9,color:K.amb,fontWeight:600,fontFamily:fm}}>{d}d</div>}
          {c.earningsDate==="TBD"&&<div style={{fontSize:9,color:sideDim2,fontFamily:fm}}>TBD</div>}</div></div>})}</div>
    <div style={{padding:"12px 16px",borderTop:"1px solid "+K.bdr,display:"flex",gap:6}}>
      <button style={Object.assign({},S.btnP,{flex:1,padding:"8px",fontSize:11})} onClick={function(){setModal({type:"add"});if(isMobile)setSideOpen(false)}}>+ Add</button>
      <button style={Object.assign({},S.btn,{padding:"8px 12px",fontSize:11})} onClick={function(){if(requirePro("import")){setModal({type:"csvImport"});if(isMobile)setSideOpen(false)}}} title="Bulk import tickers">Import</button></div></div></div>}
  function TopBar(){
    return<div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:isMobile?"10px 16px":"12px 32px",borderBottom:"1px solid "+K.bdr,background:K.card+"e6",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50,gap:isMobile?8:12}}>
    {isMobile&&<button onClick={function(){setSideOpen(true)}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,marginRight:"auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>}
    {isMobile&&<div style={{position:"absolute",left:"50%",transform:"translateX(-50%)"}}><TLogo size={18} dark={isDark}/></div>}
    <button onClick={toggleTheme} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}} title={theme==="light"?"Light":"Dark"+(theme==="forest"?" Forest":"")+(theme==="purple"?" Purple":"")+(((streakData.current||0)<1&&(theme==="dark"||theme==="light"))?" — streak 1 wk to unlock more themes":"")}>{isDark?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}</button>
    <div style={{position:"relative",cursor:"pointer",padding:4}} onClick={function(){setShowNotifs(!showNotifs);if(!showNotifs)setNotifs(function(p){return p.map(function(n){return Object.assign({},n,{read:true})})})}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={unread>0?K.mid:K.dim} strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      {unread>0&&<div style={{position:"absolute",top:1,right:1,width:8,height:8,borderRadius:"50%",background:K.grn,border:"2px solid "+K.card}}/>}</div>
    {showNotifs&&<div style={{position:"fixed",inset:0,zIndex:99}} onClick={function(){setShowNotifs(false)}}/>}
    {showNotifs&&<div className="ta-notif-panel" style={{position:"absolute",top:48,right:isMobile?12:32,width:isMobile?"calc(100vw - 24px)":380,maxHeight:isMobile?"70vh":420,overflowY:"auto",background:K.card,border:"1px solid "+K.bdr2,borderRadius:12,boxShadow:"0 16px 48px rgba(0,0,0,.3)",zIndex:100}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>Notifications</span>{notifs.length>0&&<button style={Object.assign({},S.btn,{padding:"2px 8px",fontSize:10})} onClick={function(){setNotifs([])}}>Clear</button>}</div>
      {notifs.length===0?<div style={{padding:"36px 18px",textAlign:"center",fontSize:12,color:K.dim}}>No notifications</div>:notifs.slice(0,15).map(function(n){return<div key={n.id} style={{padding:"12px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"flex-start",gap:10,cursor:n.type==="email-alert"?"pointer":"default"}} onClick={function(){if(n.type==="email-alert"){var fresh=cos.find(function(c){return c.ticker===n.ticker});if(fresh)sendEarningsEmail(fresh);setNotifs(function(p){return p.filter(function(x){return x.id!==n.id})})}}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:n.type==="found"?K.grn:n.type==="upcoming"?K.amb:n.type==="ready"?K.blue:n.type==="system"?K.acc:n.type==="price-alert"?"#9333EA":n.type==="milestone"?"#FFD700":n.type==="email-alert"?K.blue:K.dim,flexShrink:0,marginTop:4}}/><div><div style={{fontSize:12,color:K.txt,fontFamily:fm}}><strong>{n.ticker}</strong> <span style={{color:K.mid,fontWeight:400}}>{n.msg}</span>{n.type==="email-alert"&&<span style={{fontSize:10,color:K.blue,marginLeft:6}}>Send email</span>}</div><div style={{fontSize:10,color:K.dim,marginTop:3}}>{fT(n.time)}</div></div></div>})}</div>}
    <button onClick={function(){setModal({type:"settings"})}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}} title="Dashboard Settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
    <button onClick={function(){props.onLogout()}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:10})}>Logout</button>
    {/* Avatar + Level Badge */}
    <div style={{position:"relative",cursor:"pointer"}} onClick={function(){setShowProfile(!showProfile)}}>
      {avatarUrl?<img src={avatarUrl} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",border:"2px solid "+K.acc}}/>
        :<div style={{width:34,height:34,borderRadius:"50%",background:K.acc+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:K.acc,fontWeight:600,fontFamily:fm,border:"2px solid "+K.acc+"40"}}>{(username||props.user||"U")[0].toUpperCase()}</div>}
      <div style={{position:"absolute",bottom:-5,right:-8,background:K.prim,color:K.primTxt,fontSize:8,fontWeight:800,fontFamily:fm,padding:"2px 5px",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid "+K.card,lineHeight:1,whiteSpace:"nowrap"}}>{globalOS.total}</div>
    </div></div>}

  // ── AI Detectors (simplified reference — same logic, theme-aware) ──
  // ── Research Links (paste URLs per holding) ──
  function ResearchLinks(p){var c=p.company;var links=c.researchLinks||[];
    var _adding=useState(false),adding=_adding[0],setAdding=_adding[1];
    var _url=useState(""),url=_url[0],setUrl=_url[1];var _label=useState(""),label=_label[0],setLabel=_label[1];var _cat=useState("article"),cat=_cat[0],setCat=_cat[1];
    var cats=[{v:"article",l:"Article"},{v:"report",l:"Report/Filing"},{v:"video",l:"Video/Podcast"},{v:"twitter",l:"Twitter/X Thread"},{v:"other",l:"Other"}];
    var catIcons={article:"news",report:"file",video:"video",twitter:"msg",other:"link"};
    function addLink(){if(!url.trim())return;
      var u=url.trim();var autoLabel=u;
      try{var pu=new URL(u.startsWith("http")?u:"https://"+u);var host=pu.hostname.replace("www.","");
        var path=pu.pathname.replace(/^\/|\/$/g,"").replace(/-|_/g," ");
        if(path&&path.length>3&&path.length<80){var segs=path.split("/");autoLabel=host.split(".")[0]+" — "+segs[segs.length-1].replace(/\.[^.]+$/,"")}
        else{autoLabel=host}}catch(e){autoLabel=u.replace(/https?:\/\/(www\.)?/,"").split("/")[0]}
      var newLink={id:Date.now(),url:u.startsWith("http")?u:"https://"+u,label:label.trim()||autoLabel,category:cat,addedAt:new Date().toISOString()};
      upd(c.id,function(prev){return Object.assign({},prev,{researchLinks:(prev.researchLinks||[]).concat([newLink])})});
      setUrl("");setLabel("");setAdding(false)}
    function removeLink(lid){upd(c.id,function(prev){return Object.assign({},prev,{researchLinks:(prev.researchLinks||[]).filter(function(l){return l.id!==lid})})})}
    return<div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}><IC name="link" size={14} color={K.dim}/>Research</div><button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setAdding(!adding)}}>+ Add Link</button></div>
      {adding&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
        <Inp label="URL" value={url} onChange={setUrl} placeholder="https://..." K={K}/>
        <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Label (optional)" value={label} onChange={setLabel} placeholder="Article title" K={K}/><Sel label="Type" value={cat} onChange={setCat} options={cats} K={K}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:url.trim()?1:.4})} onClick={addLink}>Add</button></div></div>}
      {links.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:20,textAlign:"center",fontSize:12,color:K.dim}}>Save links to articles, reports, podcasts.</div>}
      {links.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        {links.map(function(l,i){return<div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<links.length-1?"1px solid "+K.bdr:"none"}}>
          <IC name={catIcons[l.category]||"link"} size={14} color={K.dim}/>
          <a href={l.url} target="_blank" rel="noreferrer" style={{flex:1,fontSize:12,color:K.blue,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.label}</a>
          <span style={{fontSize:9,color:K.dim,fontFamily:fm,whiteSpace:"nowrap"}}>{l.category}</span>
          <button onClick={function(){removeLink(l.id)}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:12,padding:2,opacity:.5}}>{"✕"}</button></div>})}</div>}</div>}

  // ── Research Journal (structured card system) ──
  var CARD_STYLES={decision:{icon:"edit",color:"#3B82F6",label:"Decision"},earnings_review:{icon:"bar",color:"#F59E0B",label:"Earnings Review"},thesis_snapshot:{icon:"lightbulb",color:"#8B5CF6",label:"Thesis Update"},conviction_shift:{icon:"trending",color:"#EC4899",label:"Conviction Shift"},note:{icon:"file",color:"#6B7280",label:"Note"}};
  function JournalCard(p){var d=p.entry;var ct=CARD_STYLES[d.cardType]||CARD_STYLES.note;var actionColors={BUY:K.grn,SELL:K.red,HOLD:K.amb,TRIM:K.red,ADD:K.grn,PASS:K.dim};
    return<div style={{background:K.card,border:"1px solid "+K.bdr,borderLeft:"3px solid "+ct.color,borderRadius:10,padding:"14px 18px",marginBottom:10}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div style={{width:24,height:24,borderRadius:6,background:ct.color+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><IC name={ct.icon} size={12} color={ct.color}/></div>
        <span style={{fontSize:10,fontWeight:700,color:ct.color,fontFamily:fm,letterSpacing:1,textTransform:"uppercase"}}>{ct.label}</span>
        {d.ticker&&<span style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm}}>{d.ticker}</span>}
        {d.action&&d.cardType==="decision"&&<span style={{fontSize:9,fontWeight:700,color:actionColors[d.action]||K.txt,background:(actionColors[d.action]||K.dim)+"15",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>{d.action}</span>}
        {d.outcome&&<span style={{fontSize:9,fontWeight:600,color:d.outcome==="right"?K.grn:d.outcome==="wrong"?K.red:K.amb,fontFamily:fm,background:(d.outcome==="right"?K.grn:d.outcome==="wrong"?K.red:K.amb)+"12",padding:"1px 6px",borderRadius:3}}>{d.outcome}</span>}
        <span style={{marginLeft:"auto",fontSize:9,color:K.dim,fontFamily:fm}}>{d.date?new Date(d.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):""}</span></div>
      {/* ── DECISION CARD ── */}
      {d.cardType==="decision"&&<div>
        {/* Auto-context row */}
        {(d.priceAtTime||d.convictionAtTime>0)&&<div style={{display:"flex",gap:12,marginBottom:8,padding:"6px 10px",background:K.bg,borderRadius:6,fontSize:10,color:K.dim,fontFamily:fm}}>
          {d.priceAtTime>0&&<span>Price: ${d.priceAtTime}</span>}
          {d.convictionAtTime>0&&<span>Conviction: {d.convictionAtTime}/10</span>}
          {d.timeHorizon&&<span>{d.timeHorizon==="short"?"<1yr":d.timeHorizon==="medium"?"1-3yr":"3-10yr"}</span>}
          {d.shares&&<span>{d.shares} shares</span>}</div>}
        {d.reasoning&&<div style={{marginBottom:6}}><div style={{fontSize:9,color:ct.color,fontFamily:fm,letterSpacing:1,fontWeight:600,marginBottom:3}}>REASONING</div>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>{d.reasoning}</div></div>}
        {d.invalidator&&<div style={{padding:"8px 10px",background:K.red+"06",borderRadius:6,border:"1px solid "+K.red+"15",marginBottom:6}}>
          <div style={{fontSize:9,color:K.red,fontFamily:fm,letterSpacing:1,fontWeight:600,marginBottom:2}}>WHAT WOULD PROVE ME WRONG</div>
          <div style={{fontSize:11,color:K.mid,lineHeight:1.5}}>{d.invalidator}</div></div>}
      </div>}
      {/* ── EARNINGS REVIEW CARD ── */}
      {d.cardType==="earnings_review"&&<div>
        {d.quarter&&<div style={{fontSize:12,fontWeight:600,color:K.txt,marginBottom:6}}>{d.quarter}</div>}
        {d.kpisTotal>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {(d.kpiDetails||[]).map(function(k,ki){return<div key={ki} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:4,background:(k.status==="met"?K.grn:K.red)+"10",border:"1px solid "+(k.status==="met"?K.grn:K.red)+"20",fontSize:10,fontFamily:fm}}>
            <span style={{color:k.status==="met"?K.grn:K.red,fontWeight:600}}>{k.status==="met"?"✓":"✗"}</span>
            <span style={{color:K.mid}}>{k.name}</span>
            {k.actual!=null&&<span style={{color:k.status==="met"?K.grn:K.red,fontWeight:600}}>{k.actual}</span>}</div>})}</div>}
        {d.kpisTotal>0&&<div style={{fontSize:11,fontWeight:600,color:d.kpisMet===d.kpisTotal?K.grn:d.kpisMet>0?K.amb:K.red,fontFamily:fm,marginBottom:6}}>{d.kpisMet}/{d.kpisTotal} KPIs met</div>}
        {d.summary&&<div style={{fontSize:11,color:K.mid,lineHeight:1.5,marginBottom:6}}>{d.summary.substring(0,200)}</div>}
        {d.userNote&&<div style={{padding:"6px 10px",background:K.bg,borderRadius:6,marginTop:4}}>
          <div style={{fontSize:9,color:ct.color,fontFamily:fm,letterSpacing:1,fontWeight:600,marginBottom:2}}>MY TAKE</div>
          <div style={{fontSize:11,color:K.mid,lineHeight:1.5}}>{d.userNote}</div></div>}
      </div>}
      {/* ── THESIS SNAPSHOT CARD ── */}
      {d.cardType==="thesis_snapshot"&&<div>
        <div style={{fontSize:12,color:K.mid,lineHeight:1.5,marginBottom:8}}>{d.isNew?"Initial thesis written":"Thesis updated to v"+d.version}</div>
        {d.core&&<div style={{padding:"8px 12px",background:K.bg,borderRadius:6,borderLeft:"2px solid "+ct.color,fontSize:11,color:K.mid,lineHeight:1.5,fontStyle:"italic",marginBottom:6}}>{"“"}{d.core}...{"”"}</div>}
        <div style={{display:"flex",gap:3}}>
          {[{k:"core",c:K.acc,l:"Core"},{k:"hasMoat",c:K.grn,l:"Moat"},{k:"hasRisks",c:K.amb,l:"Risks"},{k:"hasSell",c:K.red,l:"Sell"}].map(function(s){var done=s.k==="core"?d.sectionsFilled>=1:d[s.k];
            return<span key={s.k} style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:done?s.c+"15":"transparent",color:done?s.c:K.dim,fontFamily:fm,border:"1px solid "+(done?s.c+"25":K.bdr)}}>{done?"●":"○"} {s.l}</span>})}</div>
      </div>}
      {/* ── CONVICTION SHIFT CARD ── */}
      {d.cardType==="conviction_shift"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:22,fontWeight:800,color:d.prevConviction>=7?K.grn:d.prevConviction>=4?K.amb:K.red,fontFamily:fm}}>{d.prevConviction}</span>
            <span style={{fontSize:14,color:K.dim}}>{"→"}</span>
            <span style={{fontSize:22,fontWeight:800,color:d.newConviction>=7?K.grn:d.newConviction>=4?K.amb:K.red,fontFamily:fm}}>{d.newConviction}</span>
            <span style={{fontSize:11,fontWeight:600,color:d.delta>0?K.grn:K.red,fontFamily:fm}}>{d.delta>0?"+":""}{d.delta}</span></div>
          {d.action&&d.action!=="hold"&&<span style={{fontSize:9,fontWeight:700,color:d.action==="add"?K.grn:d.action==="sell"?K.red:K.amb,background:(d.action==="add"?K.grn:d.action==="sell"?K.red:K.amb)+"15",padding:"2px 8px",borderRadius:3,fontFamily:fm,textTransform:"uppercase"}}>{d.action}</span>}</div>
        {d.note&&<div style={{fontSize:11,color:K.mid,lineHeight:1.5}}>{d.note}</div>}
      </div>}
      {/* ── LEGACY/NOTE CARD ── */}
      {(!d.cardType||d.cardType==="note")&&d.reasoning&&<div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>{d.reasoning}</div>}
    </div>}
  function DecisionJournal(p){var c=p.company;var decisions=c.decisions||[];
    var _adding=useState(false),adding=_adding[0],setAdding=_adding[1];
    var _f=useState({action:"BUY",price:"",shares:"",reasoning:"",invalidator:"",timeHorizon:"long"}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p2){var n=Object.assign({},p2);n[k]=v;return n})};
    function addDecision(){if(!f.reasoning.trim())return;
      logJournalEntry(c.id,{cardType:"decision",ticker:c.ticker,action:f.action,price:f.price?parseFloat(f.price):null,shares:f.shares?parseInt(f.shares):null,reasoning:f.reasoning.trim(),invalidator:f.invalidator.trim(),timeHorizon:f.timeHorizon,convictionAtTime:c.conviction||0,priceAtTime:c.position&&c.position.currentPrice?c.position.currentPrice:null,outcome:null,outcomeNote:""});
      addXP(8,"Decision logged");
      var allDecCount=0;cos.forEach(function(cc){allDecCount+=(cc.decisions||[]).length});
      if(allDecCount<=1)setTimeout(function(){checkMilestone("first_decision",String.fromCodePoint(0x1F4DD)+" First decision logged! Your journal has begun.")},300);
      setF({action:"BUY",price:"",shares:"",reasoning:"",invalidator:"",timeHorizon:"long"});setAdding(false)}
    function markOutcome(decId,outcome){upd(c.id,function(prev){return Object.assign({},prev,{decisions:(prev.decisions||[]).map(function(d){return d.id===decId?Object.assign({},d,{outcome:outcome,outcomeDate:new Date().toISOString()}):d})})})}
    var scored=decisions.filter(function(d){return d.outcome});var rights=scored.filter(function(d){return d.outcome==="right"}).length;
    return<div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}><IC name="book" size={14} color={K.dim}/>Research Journal</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>{scored.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{rights}/{scored.length} right ({Math.round(rights/scored.length*100)}%)</span>}
        <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setAdding(!adding)}}>+ Log Decision</button></div></div>
      {adding&&<div style={{background:K.card,border:"1px solid "+K.acc+"30",borderRadius:12,padding:"20px 24px",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:600,color:K.acc,marginBottom:14,fontFamily:fm,letterSpacing:2}}>NEW DECISION</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Sel label="Action" value={f.action} onChange={function(v){set("action",v)}} options={[{v:"BUY",l:"BUY"},{v:"SELL",l:"SELL"},{v:"ADD",l:"ADD"},{v:"TRIM",l:"TRIM"},{v:"HOLD",l:"HOLD"},{v:"PASS",l:"PASS"}]} K={K}/>
          <Inp label="Price" value={f.price} onChange={function(v){set("price",v)}} type="number" placeholder="$" K={K}/>
          <Inp label="Shares" value={f.shares} onChange={function(v){set("shares",v)}} type="number" placeholder="Qty" K={K}/>
          <Sel label="Horizon" value={f.timeHorizon} onChange={function(v){set("timeHorizon",v)}} options={[{v:"short",l:"< 1yr"},{v:"medium",l:"1-3yr"},{v:"long",l:"3-10yr"}]} K={K}/></div>
        <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,color:K.txt,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600}}>Why am I making this decision? *</label>
          <textarea value={f.reasoning} onChange={function(e){set("reasoning",e.target.value)}} rows={3} placeholder="What do I believe that the market doesn't?" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"12px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
        <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,color:K.red,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600}}>What would prove me wrong?</label>
          <textarea value={f.invalidator} onChange={function(e){set("invalidator",e.target.value)}} rows={2} placeholder="Specific events or metrics that would invalidate this" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.red+"25",borderRadius:6,color:K.txt,padding:"12px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
        {/* Auto-context preview */}
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          {c.conviction>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm,background:K.bg,padding:"3px 8px",borderRadius:4,border:"1px solid "+K.bdr}}>Conviction: {c.conviction}/10</span>}
          {c.position&&c.position.currentPrice>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm,background:K.bg,padding:"3px 8px",borderRadius:4,border:"1px solid "+K.bdr}}>Price: ${c.position.currentPrice}</span>}
          {c.kpis.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm,background:K.bg,padding:"3px 8px",borderRadius:4,border:"1px solid "+K.bdr}}>{c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length}/{c.kpis.filter(function(k){return k.lastResult}).length} KPIs met</span>}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.reasoning.trim()?1:.3})} onClick={addDecision}>Save to Journal</button></div></div>}
      {/* Journal entries — beautiful cards */}
      {decisions.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:24,textAlign:"center"}}><div style={{fontSize:36,marginBottom:8}}>{"📖"}</div><div style={{fontSize:13,color:K.dim,marginBottom:4}}>Your research journal is empty</div><div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>Entries appear automatically as you check earnings, update your thesis, and adjust conviction. You can also log decisions manually.</div></div>}
      {decisions.length>0&&<div>
        {decisions.slice(0,15).map(function(d){return<div key={d.id}>
          <JournalCard entry={d}/>
          {/* Outcome scoring for decisions */}
          {d.cardType==="decision"&&!d.outcome&&<div style={{display:"flex",gap:6,padding:"0 18px 10px",marginTop:-6}}>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm,lineHeight:"24px"}}>Score:</span>
            <button style={{fontSize:10,color:K.grn,background:K.grn+"12",border:"1px solid "+K.grn+"30",borderRadius:4,padding:"2px 10px",cursor:"pointer",fontFamily:fm}} onClick={function(){markOutcome(d.id,"right")}}>Right</button>
            <button style={{fontSize:10,color:K.red,background:K.red+"12",border:"1px solid "+K.red+"30",borderRadius:4,padding:"2px 10px",cursor:"pointer",fontFamily:fm}} onClick={function(){markOutcome(d.id,"wrong")}}>Wrong</button>
            <button style={{fontSize:10,color:K.amb,background:K.amb+"12",border:"1px solid "+K.amb+"30",borderRadius:4,padding:"2px 10px",cursor:"pointer",fontFamily:fm}} onClick={function(){markOutcome(d.id,"mixed")}}>Mixed</button></div>}
        </div>})}</div>}
    </div>}

  // ── SEC Filings (Finnhub FREE) ──
  function SECFilings(p){var c=p.company;
    var _filings=useState(null),filings=_filings[0],setFilings=_filings[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    useEffect(function(){setLd(true);fetchFilings(c.ticker).then(function(r){setFilings(r);setLd(false)}).catch(function(){setLd(false)})},[c.ticker]);
    if(ld)return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:20,marginBottom:20}}><div style={S.sec}>SEC Filings</div><div style={{fontSize:11,color:K.dim}}>Loading...</div></div>;
    if(!filings||!filings.length)return null;
    var formColors={"10-K":K.blue,"10-Q":K.acc,"8-K":K.amb,"4":K.grn,SC:K.dim};
    return<div style={{marginBottom:20}}>
      <div style={Object.assign({},S.sec,{marginBottom:12})}>SEC Filings</div>
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        {filings.slice(0,8).map(function(f,i){var form=(f.form||"").toUpperCase();var color=formColors[form]||K.dim;
          return<a key={i} href={f.filingUrl||f.reportUrl||"#"} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<7?"1px solid "+K.bdr:"none",textDecoration:"none"}}>
            <span style={{background:color+"15",color:color,fontFamily:fm,fontWeight:600,fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid "+color+"30",minWidth:36,textAlign:"center"}}>{form}</span>
            <span style={{flex:1,fontSize:11,color:K.mid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.symbol} — filed {f.filedDate||f.acceptedDate||""}</span>
            <span style={{fontSize:11,color:K.blue}}>{"↗"}</span></a>})}</div></div>}

  // ── Thesis Scorecard (quarterly self-review) ──
  function ThesisScorecard(p){var c=p.company;var reviews=c.thesisReviews||[];
    var _adding=useState(false),adding=_adding[0],setAdding=_adding[1];
    var _f=useState({status:"intact",note:""}),f=_f[0],setF=_f[1];
    function addReview(){
      var entry={id:Date.now(),date:new Date().toISOString(),status:f.status,note:f.note.trim()};
      upd(c.id,function(prev){return Object.assign({},prev,{thesisReviews:[entry].concat(prev.thesisReviews||[]).slice(0,20)})});
      setF({status:"intact",note:""});setAdding(false)}
    var statusColors={intact:K.grn,weakened:K.amb,broken:K.red};
    var statusLabels={intact:"Thesis Intact",weakened:"Partially Weakened",broken:"Thesis Broken"};
    return<div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}><IC name="target" size={14} color={K.dim}/>Thesis Scorecard</div><button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setAdding(!adding)}}>+ Review</button></div>
      {adding&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
        <div style={{fontSize:12,color:K.mid,marginBottom:12}}>Is your original thesis still intact?</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>{["intact","weakened","broken"].map(function(s){return<button key={s} onClick={function(){setF(function(p2){return Object.assign({},p2,{status:s})})}} style={{flex:1,padding:"10px",borderRadius:8,fontSize:12,fontWeight:f.status===s?600:400,cursor:"pointer",fontFamily:fm,background:f.status===s?statusColors[s]+"15":"transparent",border:"1px solid "+(f.status===s?statusColors[s]+"50":K.bdr),color:f.status===s?statusColors[s]:K.dim}}>{statusLabels[s]}</button>})}</div>
        <div style={{marginBottom:12}}><textarea value={f.note} onChange={function(e){setF(function(p2){return Object.assign({},p2,{note:e.target.value})})}} rows={2} placeholder="What changed? What would break this thesis?" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical"}}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={S.btnP} onClick={addReview}>Save Review</button></div></div>}
      {reviews.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:20,textAlign:"center",fontSize:12,color:K.dim}}>Periodically review: is your thesis still intact?</div>}
      {reviews.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        {reviews.slice(0,6).map(function(r,i){return<div key={r.id} style={{padding:"10px 16px",borderBottom:i<Math.min(reviews.length,6)-1?"1px solid "+K.bdr:"none",display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:statusColors[r.status]||K.dim,marginTop:5,flexShrink:0}}/>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:statusColors[r.status]||K.mid,fontFamily:fm}}>{statusLabels[r.status]||r.status}</div>
            {r.note&&<div style={{fontSize:11,color:K.dim,lineHeight:1.5,marginTop:2}}>{r.note}</div>}</div>
          <span style={{fontSize:9,color:K.dim,fontFamily:fm,whiteSpace:"nowrap"}}>{new Date(r.date).toLocaleDateString()}</span></div>})}</div>}</div>}

  // ── Notes Editor (local state, debounced sync) ────────────
  function ThesisVault(p){var c=p.company;var docs=c.docs||[];
    var _af=useState("all"),af=_af[0],setAf=_af[1];
    var filtered=af==="all"?docs:docs.filter(function(d){return d.folder===af});
    var folderCounts={};FOLDERS.forEach(function(f){folderCounts[f.id]=docs.filter(function(d){return d.folder===f.id}).length});
    return<div style={{marginBottom:28}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={S.sec}><IC name="folder" size={14} color={K.dim}/>Thesis Vault</div>
        <div style={{display:"flex",gap:4}}>
          <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:10})} onClick={function(){setModal({type:"memo"})}}>+ Memo</button>
          <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:10})} onClick={function(){setModal({type:"clip"})}}>+ Clip</button>
          <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:10})} onClick={function(){setModal({type:"irentry"})}}>+ IR Link</button>
          <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:10})} onClick={function(){setModal({type:"doc"})}}>+ Note</button></div></div>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={function(){setAf("all")}} style={{background:af==="all"?K.acc+"20":"transparent",border:"1px solid "+(af==="all"?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 12px",fontSize:11,color:af==="all"?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>All ({docs.length})</button>
        {FOLDERS.map(function(fo){return<button key={fo.id} onClick={function(){setAf(fo.id)}} style={{background:af===fo.id?K.acc+"20":"transparent",border:"1px solid "+(af===fo.id?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 12px",fontSize:11,color:af===fo.id?K.acc:K.dim,cursor:"pointer",fontFamily:fm,display:"inline-flex",alignItems:"center",gap:5}}><IC name={fo.icon} size={11} color={af===fo.id?K.acc:K.dim}/>{fo.label} {folderCounts[fo.id]>0?"("+folderCounts[fo.id]+")":""}</button>})}</div>
      {filtered.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:28,textAlign:"center"}}><div style={{fontSize:13,color:K.dim,marginBottom:8}}>{af==="all"?"No notes yet for "+c.ticker:"No notes in this folder"}</div><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>Create note</button><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11,marginLeft:6})} onClick={function(){setModal({type:"memo"})}}>Write memo</button><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11,marginLeft:6})} onClick={function(){setModal({type:"clip"})}}>Clip research</button></div>}
      {filtered.map(function(d){var fo=FOLDERS.find(function(f){return f.id===d.folder});
        return<div key={d.id} style={{background:K.card,border:"1px solid "+(d.isClip?K.blue+"30":d.isIR?K.amb+"30":d.isMemo?K.acc+"30":K.bdr),borderLeft:d.isClip?"3px solid "+K.blue:d.isIR?"3px solid "+K.amb:d.isMemo?"3px solid "+K.acc:"3px solid transparent",borderRadius:10,padding:"14px 20px",marginBottom:8,cursor:"pointer"}} onClick={function(){setModal({type:d.isMemo?"memo":d.isClip?"doc":d.isIR?"doc":"doc",data:d.id})}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <IC name="file" size={12} color={K.dim}/>
            <span style={{fontSize:13,fontWeight:500,color:K.txt,flex:1}}>{d.title}</span>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{d.updatedAt?new Date(d.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>
          {d.content&&<div style={{fontSize:12,color:K.dim,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{d.content.substring(0,200)}</div>}</div>})}</div>}

  function EarningsTimeline(p){var c=p.company;var hist=c.earningsHistory||[];
    if(!hist.length)return null;
    // Group by year
    var years={};hist.forEach(function(h){
      var m=h.quarter.match(/(Q[1-4])\s*(\d{4})/i);
      var yr=m?m[2]:"Other";var qt=m?m[1]:h.quarter;
      if(!years[yr])years[yr]={};years[yr][qt]=h});
    var sortedYears=Object.keys(years).sort().reverse();
    var _selYear=useState(sortedYears[0]),selYear=_selYear[0],setSelYear=_selYear[1];
    var _selQ=useState(null),selQ=_selQ[0],setSelQ=_selQ[1];
    var quarters=["Q1","Q2","Q3","Q4"];
    var selectedEntry=selQ&&years[selYear]?years[selYear][selQ]:null;
    return<div style={{marginBottom:20}}>
      <div style={S.sec}>Earnings History</div>
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px"}}>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {sortedYears.map(function(yr){return<button key={yr} onClick={function(){setSelYear(yr);setSelQ(null)}} style={{background:selYear===yr?K.acc+"20":"transparent",border:"1px solid "+(selYear===yr?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 14px",fontSize:12,fontWeight:600,color:selYear===yr?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>{yr}</button>})}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          {quarters.map(function(qt){var entry=years[selYear]?years[selYear][qt]:null;
            return<div key={qt} onClick={function(){if(entry)setSelQ(selQ===qt?null:qt)}} style={{background:entry?(selQ===qt?K.acc+"15":K.bg):K.bg,border:"1px solid "+(entry?(selQ===qt?K.acc+"40":K.bdr):K.bdr),borderRadius:8,padding:"10px 12px",cursor:entry?"pointer":"default",opacity:entry?1:.4,textAlign:"center",transition:"all .2s"}}>
              <div style={{fontSize:12,fontWeight:600,color:entry?K.txt:K.dim,fontFamily:fm}}>{qt}</div>
              {entry&&<div style={{fontSize:10,color:K.dim,marginTop:4}}>&#x2713; Tracked</div>}
              {!entry&&<div style={{fontSize:10,color:K.dim,marginTop:4}}>&mdash;</div>}</div>})}</div>
        {selectedEntry&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+K.bdr}}>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.6,marginBottom:8}}>{selectedEntry.summary}</div>
          {selectedEntry.results&&selectedEntry.results.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
            {selectedEntry.results.map(function(r,i){return<div key={i} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,padding:"6px 12px"}}>
              <div style={{fontSize:10,color:K.dim}}>{METRIC_MAP[r.kpi_name]?METRIC_MAP[r.kpi_name].label:r.kpi_name}</div>
              <div style={{fontSize:13,fontWeight:600,color:r.status==="met"?K.grn:r.status==="missed"?K.red:K.mid,fontFamily:fm}}>{r.actual_value!=null?r.actual_value:"—"}</div></div>})}</div>}
          {selectedEntry.sourceUrl&&<a href={selectedEntry.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:K.blue,textDecoration:"none"}}>{selectedEntry.sourceLabel||"Source"} &#x2197;</a>}
          <div style={{fontSize:10,color:K.dim,marginTop:4}}>Checked: {fT(selectedEntry.checkedAt)}</div></div>}</div></div>}

  // ── Detail View ───────────────────────────────────────────
  // ── Finnhub-Powered Sections (all FREE, $0) ────────────
  // ── Earnings Report Card (appears after Check Earnings) ──
  function EarningsReportCard(p){var c=p.company;var snap=c.financialSnapshot||{};var news=c.latestNews||[];
    var hasSnap=Object.keys(snap).length>0;var hasSummary=!!c.earningSummary;var hasNews=news.length>0;var hasHistory=c.earningsHistory&&c.earningsHistory.length>0;
    if(!hasSnap&&!hasSummary&&!hasHistory)return null;
    return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden",marginBottom:20}}>
      <div style={{padding:"16px 24px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:14,fontWeight:600,color:K.txt}}>Earnings Report {hasHistory?c.earningsHistory[0].quarter:""}</div>
          {c.lastChecked&&<div style={{fontSize:10,color:K.dim,marginTop:2}}>Updated {fT(c.lastChecked)}</div>}</div>
        {c.sourceUrl&&<a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:K.blue,textDecoration:"none"}}>{c.sourceLabel||"Source"} {"↗"}</a>}</div>
      {/* Summary text — always shows if available */}
      {hasSummary&&<div style={{padding:"14px 24px",borderBottom:hasSnap||hasNews?"1px solid "+K.bdr:"none",fontSize:13,color:K.mid,lineHeight:1.6}}>{c.earningSummary}</div>}
      {/* Financial grid */}
      {hasSnap&&<div style={{padding:"16px 24px",borderBottom:hasNews?"1px solid "+K.bdr:"none"}}>
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:10,fontFamily:fm}}>Key Financials</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8}}>
          {Object.keys(snap).map(function(k){var item=snap[k];
            return<div key={k} style={{background:K.bg,borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:9,color:K.dim,marginBottom:4,fontFamily:fm}}>{item.label}</div>
              <div style={{fontSize:14,fontWeight:600,color:item.positive!=null?(item.positive?K.grn:K.red):item.beat!=null?(item.beat?K.grn:K.red):K.txt,fontFamily:fm}}>{item.value}</div>
              {item.detail&&<div style={{fontSize:9,color:K.dim,marginTop:2}}>{item.detail}</div>}</div>})}</div></div>}
      {!hasSnap&&hasSummary&&<div style={{padding:"12px 24px",fontSize:11,color:K.dim}}>Click Check Earnings again if financial details don't appear — Finnhub may have rate-limited this request.</div>}
      {/* Recent news */}
      {hasNews&&<div style={{padding:"12px 24px"}}>
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:8,fontFamily:fm}}>Recent News</div>
        {news.slice(0,4).map(function(n,i){return<a key={i} href={n.url} target="_blank" rel="noreferrer" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<3?"1px solid "+K.bdr:"none",textDecoration:"none",gap:8}}>
          <span style={{fontSize:11,color:K.mid,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.headline}</span>
          <span style={{fontSize:9,color:K.dim,whiteSpace:"nowrap",fontFamily:fm}}>{n.source} · {new Date(n.datetime*1000).toLocaleDateString()}</span></a>})}</div>}</div>}

  // ── Analyst & Insider Section (all FREE endpoints) ──
  function AnalystInsiders(p){var c=p.company;
    if(!isPro){return<div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:20,marginBottom:16}}>
      <div style={S.sec}><IC name="users" size={14} color={K.dim}/>Analyst Targets & Insider Activity</div>
      <div style={{background:K.bg,borderRadius:8,padding:"24px 20px",textAlign:"center"}}>
        <div style={{fontSize:12,color:K.mid,marginBottom:8}}>Analyst price targets, recommendations, insider transactions, SEC filings & company news</div>
        <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("analysts")}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",color:K.acc,padding:"6px 16px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:fm}}>Upgrade to Unlock</button>
      </div></div>}
    var _recs=useState(null),recs=_recs[0],setRecs=_recs[1];
    var _eps=useState(null),eps=_eps[0],setEps=_eps[1];
    var _txns=useState(null),txns=_txns[0],setTxns=_txns[1];
    var _peers=useState(null),peers=_peers[0],setPeers=_peers[1];
    var _pt=useState(null),pt=_pt[0],setPt=_pt[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    useEffect(function(){setLd(true);
      Promise.all([fetchRecommendations(c.ticker).catch(function(){return[]}),fetchEPSHistory(c.ticker).catch(function(){return[]}),fetchInsiders(c.ticker).catch(function(){return[]}),fetchPeers(c.ticker).catch(function(){return[]}),fetchPriceTarget(c.ticker).catch(function(){return null})]).then(function(res){setRecs(res[0]);setEps(res[1]);setTxns(res[2]);setPeers(res[3]);setPt(res[4]);setLd(false)}).catch(function(e){console.warn("[ThesisAlpha] AnalystInsiders error:",e);setLd(false)})},[c.ticker]);
    if(ld)return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:20,marginBottom:20}}><div style={S.sec}>Market Intelligence</div><div style={{fontSize:11,color:K.dim}}>Loading...</div></div>;
    var hasRecs=recs&&recs.length>0;var hasEps=eps&&eps.length>0;var hasTxns=txns&&txns.length>0;var hasPeers=peers&&peers.length>0;var hasPt=pt&&pt.targetMean;
    if(!hasRecs&&!hasEps&&!hasTxns&&!hasPeers&&!hasPt)return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:20,marginBottom:20}}><div style={S.sec}>Market Intelligence</div><div style={{fontSize:12,color:K.dim,padding:"8px 0"}}>No Finnhub data available for {c.ticker}.</div></div>;
    // Beat streak
    var beatStreak=0;if(hasEps){for(var bi=0;bi<eps.length;bi++){if(eps[bi].actual!=null&&eps[bi].estimate!=null&&eps[bi].actual>=eps[bi].estimate)beatStreak++;else break}}
    var curPrice=(c.position&&c.position.currentPrice)?c.position.currentPrice:0;
    return<div style={{marginBottom:20}}>
      {/* Price Target bar */}
      {hasPt&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:12}}>
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:10,fontFamily:fm}}>Analyst Price Target</div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>
              <span>Low ${pt.targetLow?pt.targetLow.toFixed(0):"?"}</span><span>Mean ${pt.targetMean.toFixed(0)}</span><span>High ${pt.targetHigh?pt.targetHigh.toFixed(0):"?"}</span></div>
            {function(){var lo=pt.targetLow||pt.targetMean*0.7;var hi=pt.targetHigh||pt.targetMean*1.3;var range=hi-lo;if(!range)return null;
              var meanPct=Math.max(0,Math.min(100,(pt.targetMean-lo)/range*100));
              var curPct=curPrice?Math.max(0,Math.min(100,(curPrice-lo)/range*100)):null;
              return<div style={{position:"relative",height:8,borderRadius:4,background:K.bdr,marginBottom:6}}>
                <div style={{position:"absolute",left:0,top:0,height:"100%",width:meanPct+"%",borderRadius:4,background:K.acc+"40"}}/>
                {curPct!=null&&<div style={{position:"absolute",top:-4,left:"calc("+curPct+"% - 4px)",width:8,height:16,borderRadius:2,background:curPrice<=pt.targetMean?K.grn:K.red,border:"2px solid "+K.card}} title={"Current: $"+curPrice.toFixed(2)}/>}
                <div style={{position:"absolute",top:-3,left:"calc("+meanPct+"% - 1px)",width:2,height:14,background:K.acc}} title={"Target: $"+pt.targetMean.toFixed(0)}/></div>}()}</div>
          {curPrice>0&&<div style={{textAlign:"right",minWidth:80}}>
            <div style={{fontSize:16,fontWeight:600,color:pt.targetMean>curPrice?K.grn:K.red,fontFamily:fm}}>{pt.targetMean>curPrice?"+":""}{((pt.targetMean-curPrice)/curPrice*100).toFixed(0)}%</div>
            <div style={{fontSize:9,color:K.dim}}>upside</div></div>}</div>
        <div style={{fontSize:10,color:K.dim,marginTop:4}}>{pt.lastUpdated?"Updated "+pt.lastUpdated:""}</div></div>}
      {/* Beat streak badge */}
      {hasEps&&beatStreak>=2&&<div style={{background:K.grn+"10",border:"1px solid "+K.grn+"30",borderRadius:12,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        <IC name="trending" size={16} color={K.grn}/>
        <span style={{fontSize:12,color:K.grn,fontWeight:600,fontFamily:fm}}>{beatStreak} Quarter Beat Streak</span>
        <span style={{fontSize:11,color:K.dim}}>Consecutively beat EPS estimates</span></div>}
      {/* Analyst + EPS row */}
      <div style={{display:"grid",gridTemplateColumns:hasRecs&&hasEps?"1fr 1fr":"1fr",gap:12,marginBottom:12}}>
        {hasRecs&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px"}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:10,fontFamily:fm}}>Analyst Consensus</div>
          {function(){var r=recs[0];var total=(r.buy||0)+(r.hold||0)+(r.sell||0)+(r.strongBuy||0)+(r.strongSell||0);if(!total)return null;
            var buys=(r.strongBuy||0)+(r.buy||0);var sells=(r.strongSell||0)+(r.sell||0);
            return<div><div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",marginBottom:8}}>
              {r.strongBuy>0&&<div style={{width:(r.strongBuy/total*100)+"%",background:"#00C853"}}/>}
              {r.buy>0&&<div style={{width:(r.buy/total*100)+"%",background:"#66BB6A"}}/>}
              {r.hold>0&&<div style={{width:(r.hold/total*100)+"%",background:K.amb}}/>}
              {r.sell>0&&<div style={{width:(r.sell/total*100)+"%",background:"#EF5350"}}/>}
              {r.strongSell>0&&<div style={{width:(r.strongSell/total*100)+"%",background:"#C62828"}}/>}</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontFamily:fm}}>
                <span style={{color:K.grn}}>Buy: {buys}</span><span style={{color:K.amb}}>Hold: {r.hold||0}</span><span style={{color:K.red}}>Sell: {sells}</span></div>
              <div style={{fontSize:10,color:K.dim,marginTop:4}}>{r.period} · {total} analysts</div></div>}()}</div>}
        {hasEps&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px"}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:10,fontFamily:fm}}>EPS History</div>
          {eps.slice(0,4).map(function(e,i){var beat=e.actual!=null&&e.estimate!=null?e.actual>=e.estimate:null;var pct=e.estimate?((e.actual-e.estimate)/Math.abs(e.estimate)*100):0;
            return<div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm,width:50}}>Q{e.quarter} {String(e.year).slice(2)}</span>
              <span style={{fontSize:11,fontWeight:600,color:beat?K.grn:beat===false?K.red:K.txt,fontFamily:fm,width:50}}>${e.actual!=null?e.actual.toFixed(2):"?"}</span>
              <span style={{fontSize:9,color:K.dim,fontFamily:fm}}>est ${e.estimate!=null?e.estimate.toFixed(2):"?"}</span>
              <span style={{fontSize:9,fontWeight:600,color:beat?K.grn:beat===false?K.red:K.dim,fontFamily:fm,marginLeft:"auto"}}>{beat!=null?(pct>=0?"+":"")+pct.toFixed(1)+"%":""}</span></div>})}</div>}</div>
      {/* Insider Transactions */}
      {hasTxns&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:12}}>
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:10,fontFamily:fm}}>Insider Transactions</div>
        {txns.slice(0,6).map(function(t,i){var isBuy=t.change>0;
          return<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,fontSize:11}}>
            <span style={{color:isBuy?K.grn:K.red,fontWeight:600,fontFamily:fm,width:36,fontSize:10}}>{isBuy?"BUY":"SELL"}</span>
            <span style={{color:K.mid,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
            <span style={{color:K.dim,fontFamily:fm,whiteSpace:"nowrap"}}>{Math.abs(t.change).toLocaleString()} sh</span>
            <span style={{color:K.dim,fontFamily:fm,fontSize:10}}>{t.transactionDate}</span></div>})}</div>}
      {/* Peers */}
      {hasPeers&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px"}}>
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:8,fontFamily:fm}}>Peer Companies</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{peers.map(function(p,i){return<span key={i} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:4,padding:"3px 10px",fontSize:11,color:K.mid,fontFamily:fm}}>{p}</span>})}</div></div>}
    </div>}

  // ── Moat Calculator (shared) ────────────────────────────
  function calcMoatFromData(finData){
    if(!finData)return null;
    var inc=finData.income||[],bal=finData.balance||[],cf=finData.cashflow||[];
    if(inc.length<2)return null;
    function vals(rows,k){return rows.map(function(r){return r[k]}).filter(function(v){return v!=null&&!isNaN(v)})}
    function avg(arr){return arr.length?arr.reduce(function(s,v){return s+v},0)/arr.length:null}
    function stdDev(arr){var m=avg(arr);if(m===null||arr.length<2)return null;return Math.sqrt(arr.reduce(function(s,v){return s+Math.pow(v-m,2)},0)/arr.length)}
    var recent=inc.slice(-5);var recentBal=bal.slice(-5);var recentCf=cf.slice(-5);
    var metrics=[];
    // 1. GROSS MARGIN
    var gm=vals(recent,"grossProfitRatio");
    if(gm.length>=2){var gmAvg=avg(gm)*100;var gmStd=stdDev(gm)*100;
      metrics.push({id:"grossMargin",name:"Gross Margin Stability",score:Math.min(10,Math.max(1,Math.round((gmAvg/10)+3-(gmStd*5)))),value:gmAvg.toFixed(1)+"%",detail:"Avg "+gmAvg.toFixed(1)+"% (±"+gmStd.toFixed(1)+"%)",trend:gm.map(function(v){return v*100}),icon:"shield",desc:"High & stable margins indicate pricing power"})}
    else{var revs0=vals(recent,"revenue");var gps0=vals(recent,"grossProfit");
      if(revs0.length>=2&&gps0.length>=2){var gmC=gps0.map(function(g,i){return revs0[i]?g/revs0[i]:null}).filter(function(v){return v!=null});
        if(gmC.length>=2){var gmA=avg(gmC)*100;var gmS=stdDev(gmC)*100;
          metrics.push({id:"grossMargin",name:"Gross Margin Stability",score:Math.min(10,Math.max(1,Math.round((gmA/10)+3-(gmS*5)))),value:gmA.toFixed(1)+"%",detail:"Avg "+gmA.toFixed(1)+"% (±"+gmS.toFixed(1)+"%)",trend:gmC.map(function(v){return v*100}),icon:"shield",desc:"High & stable margins indicate pricing power"})}}}
    // 2. REVENUE GROWTH
    var revs=vals(recent,"revenue");
    if(revs.length>=3){var growths=[];for(var gi=1;gi<revs.length;gi++){growths.push((revs[gi]-revs[gi-1])/Math.abs(revs[gi-1])*100)}
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
      if(roics.length>=2){metrics.push({id:"roic",name:"Return on Invested Capital",score:Math.min(10,Math.max(1,Math.round(avg(roics)>30?9:avg(roics)>20?8:avg(roics)>15?7:avg(roics)>10?6:avg(roics)>5?4:2))),value:avg(roics).toFixed(1)+"%",detail:"Avg ROIC "+avg(roics).toFixed(1)+"% over "+roics.length+"yr",trend:roics,icon:"target",desc:"High ROIC is the hallmark of a true moat"})}}
    // 5. FCF CONVERSION
    if(recentCf.length>=2&&recent.length>=2){var fcfC=[];for(var fi=0;fi<Math.min(recentCf.length,recent.length);fi++){var fcf=recentCf[fi].freeCashFlow||recentCf[fi].operatingCashFlow;var ni=recent[fi].netIncome;if(fcf!=null&&ni&&ni>0)fcfC.push(fcf/ni*100)}
      if(fcfC.length>=2){metrics.push({id:"fcfConversion",name:"FCF Conversion",score:Math.min(10,Math.max(1,Math.round(avg(fcfC)>120?9:avg(fcfC)>100?8:avg(fcfC)>80?7:avg(fcfC)>50?5:avg(fcfC)>0?3:1))),value:avg(fcfC).toFixed(0)+"%",detail:"FCF/NI ratio avg "+avg(fcfC).toFixed(0)+"%",trend:fcfC,icon:"dollar",desc:"High FCF relative to net income shows earnings quality"})}}
    // 6. FINANCIAL FORTRESS
    if(recentBal.length>=1&&recent.length>=1){var lastBal=recentBal[recentBal.length-1];var lastInc=recent[recent.length-1];var nd=lastBal.netDebt||(lastBal.totalDebt||0)-(lastBal.cashAndCashEquivalents||0);var ebitda=lastInc.ebitda||(lastInc.operatingIncome&&lastInc.depreciationAndAmortization?(lastInc.operatingIncome+Math.abs(lastInc.depreciationAndAmortization)):null);
      if(ebitda&&ebitda>0){var ratio=nd/ebitda;metrics.push({id:"fortress",name:"Financial Fortress",score:Math.min(10,Math.max(1,Math.round(ratio<0?10:ratio<1?8:ratio<2?7:ratio<3?5:ratio<5?3:1))),value:ratio<0?"Net Cash":ratio.toFixed(1)+"x",detail:"Net Debt/EBITDA = "+(ratio<0?"Net Cash":ratio.toFixed(1)+"x"),trend:null,icon:"castle",desc:"Low leverage = resilience and optionality"})}
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

  function moatLabel(score){return score>=8?"Wide Moat":score>=6?"Narrow Moat":score>=4?"Weak Moat":"No Moat"}
  function moatColor(score){return score>=8?K.grn:score>=6?K.amb:K.red}

  // ── Moat Type Classification System ──────────────────────
  var MOAT_TYPES=[
    {id:"brand",label:"Brand Power",icon:"shield",color:"#8B5CF6",
      desc:"Customers pay a premium for the name. Think Apple, Hermès, Coca-Cola.",
      signals:["Consumer-facing","High gross margins","Premium pricing"],
      sectors:["Consumer Cyclical","Consumer Defensive","Communication Services"]},
    {id:"switching",label:"Switching Costs",icon:"link",color:"#3B82F6",
      desc:"Painful or expensive for customers to leave. Think SAP, Oracle, Adobe.",
      signals:["Enterprise SaaS","Data lock-in","Workflow integration","Training costs"],
      sectors:["Technology","Industrials","Healthcare"]},
    {id:"network",label:"Network Effects",icon:"users",color:"#10B981",
      desc:"Each new user makes the product more valuable. Think Visa, Meta, Uber.",
      signals:["Platform/marketplace","User-generated content","Payment rails"],
      sectors:["Technology","Communication Services","Financial Services"]},
    {id:"cost",label:"Cost Advantage",icon:"dollar",color:"#F59E0B",
      desc:"Structurally lower costs than competitors. Think Costco, GEICO, Ryanair.",
      signals:["Scale economies","Process innovation","Geographic advantage"],
      sectors:["Consumer Defensive","Industrials","Basic Materials","Utilities"]},
    {id:"ip",label:"IP & Patents",icon:"flask",color:"#EC4899",
      desc:"Legal barriers protect the product. Think pharma patents, semiconductor IP.",
      signals:["High R&D spend","Patent portfolio","Regulatory approval required"],
      sectors:["Healthcare","Technology","Industrials"]},
    {id:"regulatory",label:"Regulatory Barrier",icon:"castle",color:"#6366F1",
      desc:"Government licenses or regulations limit competition. Think utilities, banks, defense.",
      signals:["Licensed industry","Government contracts","Capital requirements"],
      sectors:["Financial Services","Utilities","Industrials","Energy"]},
    {id:"mission",label:"Mission Critical",icon:"target",color:"#EF4444",
      desc:"Failure is catastrophic — customers can't risk switching. Think ASML, Palantir, Veeva.",
      signals:["Deep workflow integration","Compliance dependency","No viable alternatives"],
      sectors:["Technology","Healthcare","Industrials","Energy"]}
  ];

  function suggestMoatTypes(company,moatData){
    var suggestions=[];var sec=(company.sector||"").toLowerCase();var ind=(company.industry||"").toLowerCase();
    var gm=null,rd=null,opM=null;
    if(moatData&&moatData.metrics){moatData.metrics.forEach(function(m){
      if(m.id==="grossMargin")gm=m.score;
      if(m.id==="rdIntensity")rd=m.score;
      if(m.id==="opLeverage")opM=m.score})}
    MOAT_TYPES.forEach(function(mt){var score=0;var reasons=[];
      // Sector match
      var secMatch=mt.sectors.some(function(s){return sec.indexOf(s.toLowerCase())>=0});
      if(secMatch){score+=2;reasons.push("Sector match")}
      // Financial signal matching
      if(mt.id==="brand"&&gm&&gm>=7){score+=3;reasons.push("High gross margins ("+gm+"/10)")}
      if(mt.id==="brand"&&(sec.indexOf("consumer")>=0||ind.indexOf("luxury")>=0||ind.indexOf("apparel")>=0||ind.indexOf("beverage")>=0)){score+=2;reasons.push("Consumer-facing industry")}
      if(mt.id==="switching"&&(ind.indexOf("software")>=0||ind.indexOf("saas")>=0||ind.indexOf("cloud")>=0||ind.indexOf("enterprise")>=0)){score+=3;reasons.push("Software/SaaS industry")}
      if(mt.id==="switching"&&opM&&opM>=7){score+=1;reasons.push("Strong operating margins suggest sticky customers")}
      if(mt.id==="network"&&(ind.indexOf("platform")>=0||ind.indexOf("marketplace")>=0||ind.indexOf("social")>=0||ind.indexOf("payment")>=0||ind.indexOf("exchange")>=0)){score+=4;reasons.push("Platform/marketplace business")}
      if(mt.id==="cost"&&gm&&gm<5&&opM&&opM>=5){score+=3;reasons.push("Low margins but efficient operations")}
      if(mt.id==="cost"&&(ind.indexOf("retail")>=0||ind.indexOf("discount")>=0||ind.indexOf("warehouse")>=0)){score+=2;reasons.push("Scale-driven retail")}
      if(mt.id==="ip"&&rd&&rd>=6){score+=3;reasons.push("High R&D investment ("+rd+"/10)")}
      if(mt.id==="ip"&&(ind.indexOf("pharma")>=0||ind.indexOf("biotech")>=0||ind.indexOf("semiconductor")>=0)){score+=3;reasons.push("Patent-heavy industry")}
      if(mt.id==="regulatory"&&(ind.indexOf("bank")>=0||ind.indexOf("insurance")>=0||ind.indexOf("utilit")>=0||ind.indexOf("defense")>=0||ind.indexOf("aerospace")>=0)){score+=3;reasons.push("Regulated industry")}
      if(mt.id==="mission"&&(ind.indexOf("medical")>=0||ind.indexOf("defense")>=0||ind.indexOf("infrastructure")>=0||ind.indexOf("cybersec")>=0)){score+=3;reasons.push("Mission-critical industry")}
      if(mt.id==="mission"&&opM&&opM>=8&&gm&&gm>=8){score+=2;reasons.push("Very high margins suggest irreplaceability")}
      if(score>=3)suggestions.push({id:mt.id,score:score,reasons:reasons})});
    return suggestions.sort(function(a,b){return b.score-a.score}).slice(0,4)}

  // ── Price Chart with Entry Points + Conviction Markers ──
  function PriceChart(p){var c=p.company;
    if(!isPro){return<div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:20,marginBottom:20}}>
      <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Price History</div>
      <div style={{background:K.bg,borderRadius:8,padding:"28px 20px",textAlign:"center"}}>
        <div style={{fontSize:13,color:K.mid,marginBottom:8}}>Price charts with entry points, conviction markers & earnings dates</div>
        <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("charts")}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",color:K.acc,padding:"6px 16px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:fm}}>Upgrade to Unlock</button>
      </div></div>}
    var _pts=useState(null),pts=_pts[0],setPts=_pts[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    var _range=useState("1Y"),range=_range[0],setRange=_range[1];
    var _hov=useState(null),hov=_hov[0],setHov=_hov[1];
    useEffect(function(){setLd(true);
      fetchHistoricalPrice(c.ticker,range).then(function(r){setPts(r);setLd(false)}).catch(function(){setLd(false)})},[c.ticker,range]);
    if(ld)return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:20,marginBottom:20}}>
      <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Price History</div>
      <div className="ta-skel" style={{height:140,background:K.bdr,borderRadius:8}}/></div>;
    if(!pts||pts.length<5)return null;
    var cW=Math.max(600,pts.length>200?700:pts.length*3.5);var cH=160;var pad={l:0,r:0,t:10,b:20};
    var prices=pts.map(function(p2){return p2.close});
    var mn=Math.min.apply(null,prices);var mx=Math.max.apply(null,prices);var rng=mx-mn||1;
    function x(i){return pad.l+i/(pts.length-1)*(cW-pad.l-pad.r)}
    function y(v){return pad.t+(mx-v)/rng*(cH-pad.t-pad.b)}
    var line=pts.map(function(p2,i){return(i===0?"M":"L")+x(i).toFixed(1)+","+y(p2.close).toFixed(1)}).join(" ");
    var area=line+" L"+x(pts.length-1)+","+(cH-pad.b)+" L"+x(0)+","+(cH-pad.b)+" Z";
    // Entry points from decisions
    var entries=[];(c.decisions||[]).forEach(function(d){if(!d.date||(!d.price&&!d.priceAtTime))return;
      var dStr=d.date.substring(0,10);var closest=null;var minDiff=Infinity;
      pts.forEach(function(p2,i){var diff=Math.abs(new Date(p2.date)-new Date(dStr));if(diff<minDiff){minDiff=diff;closest=i}});
      if(closest!==null&&minDiff<7*864e5)entries.push({idx:closest,action:d.action,price:d.price||d.priceAtTime,date:dStr})});
    // Conviction changes
    var convMarks=[];(c.convictionHistory||[]).forEach(function(ch){if(!ch.date)return;
      var closest=null;var minDiff=Infinity;
      pts.forEach(function(p2,i){var diff=Math.abs(new Date(p2.date)-new Date(ch.date));if(diff<minDiff){minDiff=diff;closest=i}});
      if(closest!==null&&minDiff<7*864e5)convMarks.push({idx:closest,rating:ch.rating,date:ch.date})});
    // Earnings dates
    var earnDates=[];(c.earningsHistory||[]).forEach(function(eh){if(!eh.checkedAt)return;
      var dStr=eh.checkedAt.substring(0,10);var closest=null;var minDiff=Infinity;
      pts.forEach(function(p2,i){var diff=Math.abs(new Date(p2.date)-new Date(dStr));if(diff<minDiff){minDiff=diff;closest=i}});
      if(closest!==null&&minDiff<14*864e5)earnDates.push({idx:closest,quarter:eh.quarter})});
    var hovPt=hov!==null?pts[hov]:null;var lastPt=pts[pts.length-1];var firstPt=pts[0];
    var totalRet=((lastPt.close-firstPt.close)/firstPt.close*100);
    var ranges=["6M","1Y","2Y","5Y"];
    return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:isMobile?"14px":"16px 20px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Price History</div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {hovPt&&<span style={{fontSize:11,fontFamily:fm,color:K.txt,marginRight:8}}>{hovPt.date} <strong>${hovPt.close.toFixed(2)}</strong></span>}
          <span style={{fontSize:10,fontWeight:600,color:totalRet>=0?K.grn:K.red,fontFamily:fm,marginRight:8}}>{totalRet>=0?"+":""}{totalRet.toFixed(1)}% ({range})</span>
          {ranges.map(function(r){return<button key={r} onClick={function(){setRange(r)}} style={{padding:"3px 8px",fontSize:10,fontFamily:fm,background:range===r?K.acc+"18":"transparent",color:range===r?K.acc:K.dim,border:"1px solid "+(range===r?K.acc+"30":"transparent"),borderRadius:4,cursor:"pointer"}}>{r}</button>})}</div></div>
      <div style={{overflowX:"auto"}}>
        <svg width={cW} height={cH} style={{display:"block"}} onMouseLeave={function(){setHov(null)}}>
          <defs><linearGradient id={"pg-"+c.id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={totalRet>=0?K.grn:K.red} stopOpacity="0.15"/>
            <stop offset="100%" stopColor={totalRet>=0?K.grn:K.red} stopOpacity="0.01"/></linearGradient></defs>
          <path d={area} fill={"url(#pg-"+c.id+")"}/>
          <path d={line} fill="none" stroke={totalRet>=0?K.grn:K.red} strokeWidth="1.5"/>
          {/* Hover detection rects */}
          {pts.map(function(p2,i){return<rect key={i} x={x(i)-3} y={0} width={6} height={cH} fill="transparent" onMouseEnter={function(){setHov(i)}}/>})}
          {/* Hover crosshair */}
          {hov!==null&&<g><line x1={x(hov)} y1={pad.t} x2={x(hov)} y2={cH-pad.b} stroke={K.dim} strokeWidth="0.5" strokeDasharray="3,3"/>
            <circle cx={x(hov)} cy={y(pts[hov].close)} r={3} fill={K.txt} stroke={K.card} strokeWidth="2"/></g>}
          {/* Entry point markers */}
          {entries.map(function(e,i){var cx2=x(e.idx);var cy2=y(pts[e.idx].close);var isBuy=e.action==="BUY"||e.action==="ADD";
            return<g key={"e"+i}><circle cx={cx2} cy={cy2} r={5} fill={isBuy?K.grn:K.red} stroke={K.card} strokeWidth="2"/>
              <text x={cx2} y={cy2-10} textAnchor="middle" fill={isBuy?K.grn:K.red} fontSize="8" fontFamily="JetBrains Mono" fontWeight="600">{e.action}</text></g>})}
          {/* Conviction markers */}
          {convMarks.map(function(cm,i){var cx2=x(cm.idx);var clr=cm.rating>=8?K.grn:cm.rating>=5?K.amb:K.red;
            return<g key={"c"+i}><line x1={cx2} y1={cH-pad.b} x2={cx2} y2={cH-pad.b+3} stroke={clr} strokeWidth="2"/>
              <text x={cx2} y={cH-pad.b+12} textAnchor="middle" fill={clr} fontSize="8" fontFamily="JetBrains Mono" fontWeight="600">{cm.rating}</text></g>})}
          {/* Earnings markers */}
          {earnDates.map(function(ed,i){var cx2=x(ed.idx);
            return<g key={"ed"+i}><line x1={cx2} y1={pad.t} x2={cx2} y2={cH-pad.b} stroke={K.amb} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.5"/>
              <text x={cx2} y={pad.t-2} textAnchor="middle" fill={K.amb} fontSize="7" fontFamily="JetBrains Mono" opacity="0.7">E</text></g>})}
          {/* Price axis labels */}
          <text x={cW-2} y={y(mx)+4} textAnchor="end" fill={K.dim} fontSize="9" fontFamily="JetBrains Mono">${mx.toFixed(0)}</text>
          <text x={cW-2} y={y(mn)-2} textAnchor="end" fill={K.dim} fontSize="9" fontFamily="JetBrains Mono">${mn.toFixed(0)}</text>
        </svg></div>
      {/* Legend */}
      {(entries.length>0||convMarks.length>0)&&<div style={{display:"flex",gap:14,marginTop:8,flexWrap:"wrap"}}>
        {entries.length>0&&<span style={{fontSize:9,color:K.dim,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:K.grn}}/> Buy/Add <span style={{width:8,height:8,borderRadius:"50%",background:K.red}}/> Sell/Trim</span>}
        {convMarks.length>0&&<span style={{fontSize:9,color:K.dim,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:2,background:K.amb}}/> Conviction updates</span>}
        {earnDates.length>0&&<span style={{fontSize:9,color:K.dim,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:8,color:K.amb,fontWeight:700}}>E</span> Earnings</span>}</div>}
    </div>}

  // ── Moat Durability Tracker ─────────────────────────────
  function MoatTracker(p){var c=p.company;
    var _data=useState(null),data=_data[0],setData=_data[1];
    var _ld=useState(!isPro),ld=_ld[0],setLd=_ld[1];
    useEffect(function(){if(!isPro){setLd(false);return}setLd(true);
      fetchFinancialStatements(c.ticker,"annual").then(function(r){setData(r);setLd(false)}).catch(function(){setLd(false)})},[c.ticker,isPro]);
    var moat=calcMoatFromData(data);
    var adjComposite=moat?moat.composite:null;
    if(moat&&c.pricingPower&&c.pricingPower.score!=null){var gmOrig=moat.metrics.find(function(m){return m.id==="grossMargin"});if(gmOrig){var total=moat.metrics.reduce(function(s,m){return s+m.score},0);var adjTotal=total-gmOrig.score+c.pricingPower.score;adjComposite=Math.round(adjTotal/moat.metrics.length)}}
    // Cache moat for PDF export (only if changed)
    useEffect(function(){if(moat&&moat.composite!=null){var cache={composite:adjComposite||moat.composite};moat.metrics.forEach(function(m){cache[m.id]=m.score;cache[m.id+"_val"]=m.value});if(c.pricingPower&&c.pricingPower.score!=null)cache.grossMargin=c.pricingPower.score;
      if(!c._moatCache||c._moatCache.composite!==cache.composite)upd(c.id,{_moatCache:cache})}},[moat?moat.composite:null,c.pricingPower?c.pricingPower.score:null]);
    var cLabel=!moat?"Insufficient Data":moatLabel(adjComposite);
    var cColor=!moat?K.dim:moatColor(adjComposite);
    return<div className="ta-page-pad" style={{padding:"0 32px 60px",maxWidth:900}}>
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"24px 0 12px"}}>
        <button onClick={function(){setSubPage(null)}} style={{background:"none",border:"none",color:K.acc,fontSize:13,cursor:"pointer",fontFamily:fm,padding:0}}>{"←"} Back</button>
        <CoLogo domain={c.domain} ticker={c.ticker} size={32}/>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker} <span style={{fontWeight:300,color:K.mid,fontSize:15}}>Moat Analysis</span></div>
          <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.name} · {c.sector}</div></div></div>
      {ld?<div style={{padding:"32px 0"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[0,1,2,3].map(function(i){return<div key={i} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:22}}>
          <div className="ta-skel" style={{height:14,width:"60%",background:K.bdr,marginBottom:12}}/>
          <div className="ta-skel" style={{height:6,background:K.bdr,marginBottom:8}}/>
          <div className="ta-skel" style={{height:10,width:"40%",background:K.bdr}}/></div>})}</div>
        <div style={{textAlign:"center",fontSize:11,color:K.dim,marginTop:16,fontFamily:fm}}>Analyzing {c.ticker} competitive advantages...</div></div>:
      !moat?<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>Insufficient financial data to analyze moat</div><div style={{fontSize:11,color:K.dim}}>Need at least 2 years of financial statements from SEC EDGAR.</div></div>:
      <div>
      {/* Composite Score */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"28px 32px",marginBottom:24,display:"flex",alignItems:"center",gap:32}}>
        <div style={{width:100,height:100,borderRadius:"50%",border:"4px solid "+cColor,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div style={{fontSize:36,fontWeight:700,color:cColor,fontFamily:fm,lineHeight:1}}>{adjComposite}</div>
          <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>/10</div></div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:500,color:cColor,fontFamily:fh,marginBottom:4}}>{cLabel}</div>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.7}}>{adjComposite>=8?"This company shows strong competitive advantages across multiple dimensions. Durable moats deserve premium conviction.":adjComposite>=6?"Some competitive advantages are visible, but not all dimensions are strong. Monitor for moat erosion.":adjComposite>=4?"Limited competitive advantages detected. This company may be vulnerable to competition.":"No clear competitive moat identified. High conviction requires a special thesis."}</div>
          <div style={{fontSize:10,color:K.dim,marginTop:8,fontFamily:fm}}>Based on {moat.years} years of SEC EDGAR data · {moat.metrics.length} dimensions analyzed{c.pricingPower&&c.pricingPower.score!=null?" · Pricing power adjusted by owner":""}
          </div></div></div>
      {/* Moat Type Classification */}
      {function(){var mt=c.moatTypes||{};var suggestions=suggestMoatTypes(c,moat);
        var hasSuggestions=suggestions.length>0;
        var classified=MOAT_TYPES.filter(function(t){return mt[t.id]&&mt[t.id].active});
        var unclassified=MOAT_TYPES.filter(function(t){return!mt[t.id]||!mt[t.id].active});
        function toggleType(tid){var prev=c.moatTypes||{};var cur=prev[tid]||{};var next=Object.assign({},prev);
          var wasActive=cur.active;
          next[tid]=Object.assign({},cur,{active:!cur.active,strength:cur.strength||3,note:cur.note||""});
          upd(c.id,{moatTypes:next});
          if(!wasActive){var anyPrevMoats=false;cos.forEach(function(cc){var mt2=cc.moatTypes||{};Object.keys(mt2).forEach(function(k){if(mt2[k]&&mt2[k].active)anyPrevMoats=true})});
            if(!anyPrevMoats)setTimeout(function(){checkMilestone("first_moat",String.fromCodePoint(0x1F3F0)+" First moat classified! Understanding competitive advantages is key.")},300)}}
        function setStrength(tid,val){var prev=c.moatTypes||{};var next=Object.assign({},prev);
          next[tid]=Object.assign({},prev[tid]||{},  {strength:val});upd(c.id,{moatTypes:next})}
        function setNote(tid,val){var prev=c.moatTypes||{};var next=Object.assign({},prev);
          next[tid]=Object.assign({},prev[tid]||{},{note:val});upd(c.id,{moatTypes:next})}
        return<div style={{marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={S.sec}><IC name="castle" size={14} color={K.dim}/>Moat Classification</div></div>
          {/* Morningstar Reference + Moat Trend */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px"}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>MORNINGSTAR RATING</div>
              <select value={c.morningstarMoat||""} onChange={function(e){upd(c.id,{morningstarMoat:e.target.value})}} style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:c.morningstarMoat==="Wide"?K.grn:c.morningstarMoat==="Narrow"?K.amb:K.txt,padding:"8px 10px",fontSize:12,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
                <option value="">Not Set</option><option value="Wide">★ Wide Moat</option><option value="Narrow">★ Narrow Moat</option><option value="None">No Moat</option><option value="Not Rated">Not Rated</option></select></div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px"}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>MOAT TREND</div>
              <select value={c.moatTrend||""} onChange={function(e){upd(c.id,{moatTrend:e.target.value})}} style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:c.moatTrend==="Strengthening"?K.grn:c.moatTrend==="Eroding"?K.red:K.txt,padding:"8px 10px",fontSize:12,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
                <option value="">Not Set</option><option value="Strengthening">▲ Strengthening</option><option value="Stable">─ Stable</option><option value="Eroding">▼ Eroding</option></select></div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px"}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>YOUR vs M★</div>
              {(function(){var yourWidth=classified.length>=3?"Wide":classified.length>=1?"Narrow":"None";var mstar=c.morningstarMoat||"";
                var agree=mstar&&yourWidth===mstar;var disagree=mstar&&mstar!=="Not Rated"&&yourWidth!==mstar;
                return<div style={{fontSize:12,color:agree?K.grn:disagree?K.amb:K.dim,fontWeight:600,fontFamily:fm}}>
                  {!mstar?"Set Morningstar rating":agree?"✓ Aligned":disagree?"⚠ Divergent":"—"}</div>})()}</div></div>
          {/* Active moat types */}
          {classified.length>0&&<div style={{marginBottom:16}}>
            {classified.map(function(t){var d=mt[t.id]||{};var sug=suggestions.find(function(s){return s.id===t.id});
              return<div key={t.id} style={{background:K.card,border:"1px solid "+t.color+"40",borderLeft:"4px solid "+t.color,borderRadius:12,padding:"16px 20px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <IC name={t.icon} size={16} color={t.color}/>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt}}>{t.label}</div>
                    <div style={{fontSize:11,color:K.dim,lineHeight:1.5}}>{t.desc}</div></div>
                  <button onClick={function(){toggleType(t.id)}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:12,padding:4,opacity:.5}} title="Remove">{"✕"}</button></div>
                {/* Strength rating */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:10,color:K.dim,fontFamily:fm,width:70}}>STRENGTH</span>
                  <div style={{display:"flex",gap:3}}>
                    {[1,2,3,4,5].map(function(v){return<button key={v} onClick={function(){setStrength(t.id,v)}} style={{width:28,height:24,borderRadius:4,border:"1px solid "+(v<=d.strength?t.color+"60":K.bdr),background:v<=d.strength?t.color+"20":"transparent",color:v<=d.strength?t.color:K.dim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{v}</button>})}</div>
                  <span style={{fontSize:10,color:t.color,fontFamily:fm,marginLeft:4}}>{d.strength>=5?"Dominant":d.strength>=4?"Strong":d.strength>=3?"Moderate":d.strength>=2?"Weak":"Fragile"}</span></div>
                {/* Note */}
                <textarea value={d.note||""} onChange={function(e){setNote(t.id,e.target.value)}} placeholder={"Why does "+c.ticker+" have "+t.label.toLowerCase()+"? Be specific..."} rows={2} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 12px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.5}}/>
                {sug&&sug.reasons.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>
                  {sug.reasons.map(function(r,ri){return<span key={ri} style={{fontSize:9,color:t.color,background:t.color+"10",padding:"2px 8px",borderRadius:3,fontFamily:fm}}>{r}</span>})}</div>}
              </div>})}</div>}
          {/* Suggestions + unclassified */}
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}>
            {classified.length===0&&<div style={{fontSize:12,color:K.mid,marginBottom:12,lineHeight:1.6}}>What type of competitive advantage does {c.ticker} have? Select the moat sources that apply. {hasSuggestions?"We've highlighted likely matches based on "+c.ticker+"'s sector and financials.":""}</div>}
            {classified.length>0&&<div style={{fontSize:11,color:K.dim,marginBottom:10}}>Add more moat sources:</div>}
            <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {unclassified.map(function(t){var sug=suggestions.find(function(s){return s.id===t.id});var isSuggested=!!sug;
                return<button key={t.id} onClick={function(){toggleType(t.id)}} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",borderRadius:8,cursor:"pointer",textAlign:"left",background:isSuggested?t.color+"08":"transparent",border:"1px solid "+(isSuggested?t.color+"35":K.bdr),transition:"all .15s"}}>
                  <div style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:t.color+"15",flexShrink:0,marginTop:1}}>
                    <IC name={t.icon} size={14} color={t.color}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:isSuggested?K.txt:K.mid,display:"flex",alignItems:"center",gap:5}}>{t.label}
                      {isSuggested&&<span style={{fontSize:8,fontWeight:700,color:t.color,background:t.color+"15",padding:"1px 5px",borderRadius:3,fontFamily:fm}}>LIKELY</span>}</div>
                    <div style={{fontSize:10,color:K.dim,lineHeight:1.4,marginTop:2}}>{t.desc.split(".")[0]+"."}</div>
                    {isSuggested&&<div style={{fontSize:9,color:t.color,marginTop:3,fontFamily:fm}}>{sug.reasons[0]}</div>}
                  </div></button>})}</div></div>
        </div>}()}

      {/* ── Pricing Power Assessment ── */}
      {function(){
        var pp=c.pricingPower||{};var gmMetric=moat.metrics.find(function(m){return m.id==="grossMargin"});
        var gmScore=gmMetric?gmMetric.score:null;var gmVal=gmMetric?gmMetric.value:"N/A";
        var qs=[
          {id:"raised",q:"Has this company raised prices in the last 2 years without meaningful customer loss?",tip:"Look for revenue growth outpacing volume growth, or explicit price increase announcements."},
          {id:"switch",q:"Would customers face significant pain, cost, or risk to switch?",tip:"Consider workflow integration, data migration, retraining, regulatory re-approval, or mid-contract lock-in."},
          {id:"substitute",q:"Is there a lack of close substitutes for what this company sells?",tip:"If the product disappeared tomorrow, could customers easily replicate it elsewhere?"},
          {id:"margin",q:"Have gross margins been stable or expanding over 5+ years?",tip:"Expanding margins through inflation = strong evidence. Declining margins = pricing pressure."}
        ];
        var answers=pp.answers||{};
        var yesCount=Object.values(answers).filter(function(v){return v==="yes"}).length;
        var partialCount=Object.values(answers).filter(function(v){return v==="partial"}).length;
        var answered=Object.keys(answers).length;
        // Auto-suggest: start from GM base, boost for structural answers
        var suggested=gmScore||5;
        if(answered>=3){suggested=Math.round(2+yesCount*2+partialCount*1);suggested=Math.min(10,Math.max(1,suggested))}
        var finalScore=pp.score!=null?pp.score:null;
        var displayScore=finalScore!=null?finalScore:gmScore;
        var scoreColor=displayScore>=8?K.grn:displayScore>=6?K.amb:displayScore>=4?"#F59E0B":K.red;
        var isOverridden=finalScore!=null&&gmScore!=null&&finalScore!==gmScore;

        function setAnswer(qid,val){var prev=c.pricingPower||{};var na=Object.assign({},prev.answers||{});na[qid]=val;
          upd(c.id,{pricingPower:Object.assign({},prev,{answers:na})})}
        function setScore(val){var prev=c.pricingPower||{};upd(c.id,{pricingPower:Object.assign({},prev,{score:val})})}
        function setNote(val){var prev=c.pricingPower||{};upd(c.id,{pricingPower:Object.assign({},prev,{note:val})})}
        function clearOverride(){var prev=c.pricingPower||{};upd(c.id,{pricingPower:Object.assign({},prev,{score:null})})}

        return<div style={{marginBottom:24}}>
          <div style={S.sec}><IC name="shield" size={14} color={K.dim}/>Pricing Power Assessment</div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"22px 24px"}}>
            {/* Header with scores */}
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18,paddingBottom:14,borderBottom:"1px solid "+K.bdr}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1}}>DATA SCORE</div>
                <div style={{fontSize:16,fontWeight:700,color:gmScore?scoreColor:K.dim,fontFamily:fm}}>{gmScore||"—"}<span style={{fontSize:10,fontWeight:400,color:K.dim}}>/10</span></div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>Gross margin: {gmVal}</div>
              </div>
              {finalScore!=null&&<div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:10,color:K.acc,fontFamily:fm,letterSpacing:1}}>YOUR SCORE</div>
                <div style={{fontSize:22,fontWeight:700,color:scoreColor,fontFamily:fm}}>{finalScore}<span style={{fontSize:10,fontWeight:400,color:K.dim}}>/10</span></div>
                {isOverridden&&<span style={{fontSize:8,fontWeight:700,color:K.acc,background:K.acc+"15",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>OVERRIDE</span>}
              </div>}
            </div>
            {/* Guided questions */}
            <div style={{fontSize:11,color:K.mid,fontFamily:fm,marginBottom:14,lineHeight:1.5}}>Gross margins alone miss structural pricing power. Answer these to get a better score:</div>
            {qs.map(function(q){var val=answers[q.id]||"";
              return<div key={q.id} style={{marginBottom:14}}>
                <div style={{fontSize:12,color:K.txt,lineHeight:1.5,marginBottom:6}}>{q.q}</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {["yes","partial","no"].map(function(opt){
                    var active=val===opt;var clr=opt==="yes"?K.grn:opt==="partial"?K.amb:K.red;
                    return<button key={opt} onClick={function(){setAnswer(q.id,active?"":opt)}}
                      style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+(active?clr+"60":K.bdr),
                        background:active?clr+"15":"transparent",color:active?clr:K.dim,
                        fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm,textTransform:"capitalize"}}>{opt}</button>})}
                  <span style={{fontSize:10,color:K.dim,fontFamily:fm,marginLeft:8,fontStyle:"italic"}}>{q.tip}</span>
                </div>
              </div>})}
            {/* Suggested + final score */}
            {answered>=3&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 18px",marginTop:6}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1}}>SUGGESTED SCORE</div>
                <div style={{fontSize:16,fontWeight:700,color:suggested>=8?K.grn:suggested>=6?K.amb:K.red,fontFamily:fm}}>{suggested}/10</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>({yesCount} yes, {partialCount} partial, {answered-yesCount-partialCount} no)</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:K.dim,fontFamily:fm,width:80}}>SET SCORE</span>
                <div style={{display:"flex",gap:3}}>
                  {[1,2,3,4,5,6,7,8,9,10].map(function(v){
                    var active=finalScore===v;var clr=v>=8?K.grn:v>=6?K.amb:v>=4?"#F59E0B":K.red;
                    return<button key={v} onClick={function(){setScore(v)}}
                      style={{width:28,height:26,borderRadius:4,border:"1px solid "+(active?clr+"80":v===suggested?K.acc+"40":K.bdr),
                        background:active?clr+"20":v===suggested?K.acc+"08":"transparent",
                        color:active?clr:v===suggested?K.acc:K.dim,
                        fontSize:11,fontWeight:active?700:500,cursor:"pointer",fontFamily:fm}}>{v}</button>})}
                </div>
                {finalScore!=null&&<button onClick={clearOverride} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:10,fontFamily:fm,marginLeft:8,textDecoration:"underline"}}>Clear</button>}
              </div>
            </div>}
            {/* Note */}
            <textarea value={pp.note||""} onChange={function(e){setNote(e.target.value)}}
              placeholder={"Why does "+c.ticker+" have "+(finalScore>=7?"strong":"weak")+" pricing power? What’s the structural reason?"}
              rows={2} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 12px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.5,marginTop:12}}/>
          </div>
        </div>}()}
      {/* Individual Metrics */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {moat.metrics.map(function(m){
          var ppOverride=m.id==="grossMargin"&&c.pricingPower&&c.pricingPower.score!=null;
          var displayScore=ppOverride?c.pricingPower.score:m.score;
          var barColor=displayScore>=8?K.grn:displayScore>=6?K.amb:K.red;
          return<div key={m.id} style={{background:K.card,border:"1px solid "+(ppOverride?K.acc+"40":K.bdr),borderRadius:12,padding:"18px 22px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <IC name={m.icon} size={16} color={K.dim}/>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{ppOverride?"Pricing Power (Owner)":m.name}</div>
                {ppOverride&&<div style={{fontSize:9,color:K.acc,fontFamily:fm}}>Data score: {m.score}/10 · Overridden by your assessment</div>}</div>
              <div style={{fontSize:22,fontWeight:700,color:barColor,fontFamily:fm}}>{displayScore}</div></div>
            {/* Score bar */}
            <div style={{height:6,borderRadius:3,background:K.bdr,marginBottom:8,overflow:"hidden"}}>
              <div style={{height:"100%",width:displayScore*10+"%",borderRadius:3,background:barColor,transition:"width .3s"}}/></div>
            <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:2}}>{m.value}</div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:6}}>{m.detail}</div>
            {/* Mini sparkline */}
            {m.trend&&m.trend.length>=2&&<div style={{display:"flex",alignItems:"flex-end",gap:2,height:24,marginTop:4}}>
              {m.trend.map(function(v,ti){var mx=Math.max.apply(null,m.trend);var mn=Math.min.apply(null,m.trend);var range=mx-mn||1;var h=Math.max(3,((v-mn)/range)*22);
                return<div key={ti} style={{flex:1,height:h,borderRadius:2,background:barColor+"60"}}/>})}</div>}
            <div style={{fontSize:10,color:K.dim,lineHeight:1.4,marginTop:8,fontStyle:"italic"}}>{m.desc}</div></div>})}</div>
      {/* Munger quote */}
      <div style={{marginTop:24,padding:"16px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:12}}>
        <div style={{fontSize:12,color:K.mid,lineHeight:1.7,fontStyle:"italic"}}>{"“"}The key to investing is not assessing how much an industry is going to affect society, or how much it will grow, but rather determining the competitive advantage of any given company and, above all, the durability of that advantage.{"”"}</div>
        <div style={{fontSize:11,color:K.dim,marginTop:6,fontFamily:fm}}>{"—"} Warren Buffett (Munger's partner)</div></div>
      </div>}</div>}

  // ── Financial Statements — Full Page (Morningstar-style) ──
  var IS_ITEMS=[{k:"revenue",l:"Revenue",b:1},{k:"costOfRevenue",l:"Cost of Revenue"},{k:"grossProfit",l:"Gross Profit",b:1},{k:"grossProfitRatio",l:"Gross Margin",p:1,d:1},{},{k:"researchAndDevelopmentExpenses",l:"R&D Expenses"},{k:"sellingGeneralAndAdministrativeExpenses",l:"SG&A Expenses"},{k:"operatingExpenses",l:"Total Operating Expenses"},{k:"operatingIncome",l:"Operating Income",b:1},{k:"operatingIncomeRatio",l:"Operating Margin",p:1,d:1},{},{k:"interestExpense",l:"Interest Expense"},{k:"totalOtherIncomeExpensesNet",l:"Other Income / Expense"},{k:"incomeBeforeTax",l:"Income Before Tax"},{k:"incomeTaxExpense",l:"Income Tax Expense"},{k:"netIncome",l:"Net Income",b:1},{k:"netIncomeRatio",l:"Net Margin",p:1,d:1},{},{k:"eps",l:"EPS (Basic)",b:1,sm:1},{k:"epsdiluted",l:"EPS (Diluted)",b:1,sm:1},{k:"weightedAverageShsOut",l:"Shares Outstanding"},{k:"weightedAverageShsOutDil",l:"Diluted Shares"},{k:"ebitda",l:"EBITDA",b:1},{k:"depreciationAndAmortization",l:"D&A"}];
  var BS_ITEMS=[{k:"cashAndCashEquivalents",l:"Cash & Equivalents"},{k:"shortTermInvestments",l:"Short-term Investments"},{k:"netReceivables",l:"Receivables"},{k:"inventory",l:"Inventory"},{k:"totalCurrentAssets",l:"Total Current Assets",b:1},{},{k:"propertyPlantEquipmentNet",l:"PP&E (Net)"},{k:"goodwillAndIntangibleAssets",l:"Goodwill & Intangibles"},{k:"longTermInvestments",l:"Long-term Investments"},{k:"totalNonCurrentAssets",l:"Total Non-Current Assets"},{k:"totalAssets",l:"Total Assets",b:1},{},{k:"accountPayables",l:"Accounts Payable"},{k:"shortTermDebt",l:"Short-term Debt"},{k:"totalCurrentLiabilities",l:"Total Current Liabilities",b:1},{k:"longTermDebt",l:"Long-term Debt"},{k:"totalNonCurrentLiabilities",l:"Total Non-Current Liabilities"},{k:"totalLiabilities",l:"Total Liabilities",b:1},{},{k:"retainedEarnings",l:"Retained Earnings"},{k:"totalStockholdersEquity",l:"Stockholders' Equity",b:1},{},{k:"totalDebt",l:"Total Debt"},{k:"netDebt",l:"Net Debt"}];
  var CF_ITEMS=[{k:"netIncome",l:"Net Income"},{k:"depreciationAndAmortization",l:"D&A"},{k:"stockBasedCompensation",l:"Stock-Based Compensation"},{k:"changeInWorkingCapital",l:"Changes in Working Capital"},{k:"operatingCashFlow",l:"Operating Cash Flow",b:1},{},{k:"capitalExpenditure",l:"Capital Expenditures"},{k:"acquisitionsNet",l:"Acquisitions"},{k:"purchasesOfInvestments",l:"Purchases of Investments"},{k:"salesMaturitiesOfInvestments",l:"Sales of Investments"},{k:"netCashUsedForInvestingActivites",l:"Investing Cash Flow",b:1},{},{k:"debtRepayment",l:"Debt Repayment"},{k:"commonStockRepurchased",l:"Share Buybacks"},{k:"dividendsPaid",l:"Dividends Paid"},{k:"netCashUsedProvidedByFinancingActivities",l:"Financing Cash Flow",b:1},{},{k:"freeCashFlow",l:"Free Cash Flow",b:1}];
  var STMT_TABS=[{id:"income",l:"Income Statement",items:IS_ITEMS},{id:"balance",l:"Balance Sheet",items:BS_ITEMS},{id:"cashflow",l:"Cash Flow",items:CF_ITEMS}];
  function fmtBig(v,pct){if(v==null||isNaN(v))return"—";if(pct)return(v*100).toFixed(1)+"%";
    var neg=v<0;var a=Math.abs(v);var s;if(a>=1e12)s=(a/1e12).toFixed(1)+"T";else if(a>=1e9)s=(a/1e9).toFixed(2)+"B";else if(a>=1e6)s=(a/1e6).toFixed(1)+"M";else if(a>=1e3)s=(a/1e3).toFixed(1)+"K";else s=Math.abs(v)<100?v.toFixed(2):a.toFixed(0);return(neg?"-":"")+"$"+s}
  function fmtCell(v,item){if(v==null||v===undefined)return"—";var n=Number(v);if(isNaN(n))return"—";if(item.p)return(n*100).toFixed(1)+"%";if(item.sm)return"$"+n.toFixed(2);return fmtBig(n)}
  function FinancialsPage(p){var c=p.company;
    function exportFinancialsPDF(){
      if(!data||!rows||rows.length===0)return;
      var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+c.ticker+' Financial Statements — ThesisAlpha</title>';
      html+='<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">';
      html+='<style>@page{size:A4 landscape;margin:16mm 14mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Inter",sans-serif;color:#1a1a2e;font-size:10px;line-height:1.5;background:#fff}';
      html+='.page{max-width:1100px;margin:0 auto;padding:32px 36px}';
      html+='.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid #1a1a2e;margin-bottom:20px}';
      html+='.hdr h1{font-family:"Playfair Display",Georgia,serif;font-size:28px;font-weight:700;color:#1a1a2e;letter-spacing:-.5px;line-height:1.1}';
      html+='.hdr .sub{font-size:11px;color:#6b7280;margin-top:3px}';
      html+='.logo{font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;letter-spacing:2px;color:#1a1a2e;text-transform:uppercase}';
      html+='.logo-sub{font-size:8px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-top:2px}';
      html+='table{width:100%;border-collapse:collapse;font-size:9.5px;font-family:"JetBrains Mono","SF Mono",monospace}';
      html+='th{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;padding:6px 8px;border-bottom:2px solid #e5e7eb;font-weight:600;white-space:nowrap}';
      html+='td{padding:5px 8px;border-bottom:1px solid #f3f4f6;white-space:nowrap}';
      html+='tr.bold td{font-weight:700;color:#1a1a2e;border-bottom:1px solid #e5e7eb}';
      html+='tr.spacer td{height:6px;border:none;background:#fafafa}';
      html+='.dim{color:#9ca3af}.grn{color:#16a34a}.red{color:#dc2626}.amb{color:#d97706}';
      html+='.yoy{font-size:8px;margin-top:1px}';
      html+='.footer{margin-top:24px;padding-top:10px;border-top:2px solid #1a1a2e;display:flex;justify-content:space-between;align-items:center}';
      html+='.footer-left{font-family:"JetBrains Mono",monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#1a1a2e;text-transform:uppercase}';
      html+='.footer-right{font-size:8px;color:#9ca3af;text-align:right}';
      html+='.disc{font-size:7px;color:#9ca3af;margin-top:6px;font-style:italic;line-height:1.4}';
      html+='@media print{.page{padding:0}.no-print{display:none}}</style></head><body><div class="page">';
      // Header
      html+='<div class="hdr"><div><h1>'+c.ticker+'</h1><div class="sub">'+c.name+' · '+c.sector+' · '+(stab.l)+' ('+(per==="quarter"?"Quarterly":"Annual")+')</div></div>';
      html+='<div style="text-align:right"><div class="logo">ThesisAlpha</div><div class="logo-sub">Financial Statements</div>';
      html+='<div style="font-family:JetBrains Mono,monospace;font-size:9px;color:#6b7280;margin-top:6px">'+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})+'</div></div></div>';
      // Table
      html+='<table><thead><tr><th align="left" style="min-width:160px;position:sticky;left:0;background:#fff">'+stab.l+'</th>';
      rows.forEach(function(r){html+='<th align="right">'+(per==="quarter"?(r.period||"")+" '"+(r.date||"").substring(2,4):(r.date||"").substring(0,4))+'</th>'});
      html+='</tr></thead><tbody>';
      stab.items.forEach(function(item){
        if(!item.k){html+='<tr class="spacer"><td colspan="'+(rows.length+1)+'"></td></tr>';return}
        html+='<tr'+(item.b?' class="bold"':'')+'><td'+(item.d?' class="dim"':'')+'>'+(item.l)+'</td>';
        rows.forEach(function(r,ci){var v=r[item.k];var yoy=null;
          if(ci>0&&rows[ci-1]){var prev=rows[ci-1][item.k];if(prev&&v&&!item.p)yoy=((Number(v)-Number(prev))/Math.abs(Number(prev))*100)}
          var vStr=fmtCell(v,item);var clr=v!=null&&Number(v)<0?' class="red"':(item.d?' class="dim"':'');
          html+='<td align="right"'+clr+'>'+vStr;
          if(yoy!=null&&!isNaN(yoy))html+='<div class="yoy '+(yoy>=0?"grn":"red")+'">'+(yoy>=0?"+":"")+yoy.toFixed(1)+'%</div>';
          html+='</td>'});
        html+='</tr>'});
      html+='</tbody></table>';
      // Footer
      html+='<div class="footer"><div class="footer-left">ThesisAlpha</div>';
      html+='<div class="footer-right"><div style="font-family:JetBrains Mono,monospace;font-size:9px;color:#6b7280">'+c.ticker+' · '+c.name+'</div>';
      html+='<div>'+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})+'</div></div></div>';
      html+='<div class="disc">Source: '+(data.source==="sec-edgar"?"SEC EDGAR":"Financial Modeling Prep")+' · Generated by ThesisAlpha · For personal research only. Not financial advice. Verify all data before making investment decisions.</div>';
      html+='</div></body></html>';
      var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.print()},600)}
    if(!isPro){return<div style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:1100}}>
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"24px 0 12px"}}>
        <button onClick={function(){setSubPage(null)}} style={{background:"none",border:"none",color:K.acc,fontSize:13,cursor:"pointer",fontFamily:fm,padding:0}}>{"←"} Back</button>
        <CoLogo domain={c.domain} ticker={c.ticker} size={32}/>
        <div><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker} <span style={{fontWeight:300,color:K.mid,fontSize:15}}>Financial Statements</span></div></div></div>
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:16,padding:"48px 32px",textAlign:"center",marginTop:16}}>
        <div style={{fontSize:36,marginBottom:16}}>📊</div>
        <div style={{fontSize:18,fontWeight:600,color:K.txt,fontFamily:fh,marginBottom:8}}>10-Year Financial Statements</div>
        <div style={{fontSize:13,color:K.mid,lineHeight:1.7,maxWidth:420,margin:"0 auto 24px"}}>Income statements, balance sheets, cash flow — annual and quarterly. Powered by FMP with SEC EDGAR fallback.</div>
        <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("financials")}} style={Object.assign({},S.btnP,{padding:"12px 32px",fontSize:13})}>Upgrade to Unlock</button>
      </div></div>}
    var _data=useState(null),data=_data[0],setData=_data[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    var _per=useState("annual"),per=_per[0],setPer=_per[1];
    var _tab=useState("income"),tab=_tab[0],setTab=_tab[1];
    var _chart=useState(["revenue"]),chartSel=_chart[0],setChartSel=_chart[1];
    var _hov=useState(null),hov=_hov[0],setHov=_hov[1];
    var _diag=useState(""),diag=_diag[0],setDiag=_diag[1];
    var CHART_COLORS=["#1cb0f6","#58cc02","#ff9600","#ce82ff","#ff4b4b","#ffc800","#3B82F6","#EC4899","#14B8A6","#8B5CF6","#EF4444","#F59E0B","#6366F1","#10B981"];
    useEffect(function(){setLd(true);setDiag("");
      fetchFinancialStatements(c.ticker,per==="quarter"?"quarter":"annual").then(function(r){
        setData(r);setLd(false);
        var ic=(r&&r.income?r.income.length:0),bc=(r&&r.balance?r.balance.length:0),cc=(r&&r.cashflow?r.cashflow.length:0);
        if(ic===0&&bc===0&&cc===0){setDiag("All statements returned 0 rows. Check browser console (F12) for [FMP client] logs, or visit /api/fmp-test?ticker="+c.ticker+" to diagnose.")}
      }).catch(function(e){setLd(false);setDiag("Fetch error: "+e.message)})},[c.ticker,per]);
    var stab=STMT_TABS.find(function(t){return t.id===tab})||STMT_TABS[0];
    var rows=data?data[tab]:[];if(!rows)rows=[];

    // Chart data
    var chartItems=[{k:"revenue",l:"Revenue"},{k:"grossProfit",l:"Gross Profit"},{k:"operatingIncome",l:"Op. Income"},{k:"netIncome",l:"Net Income"},{k:"ebitda",l:"EBITDA"},{k:"eps",l:"EPS",sm:1},{k:"freeCashFlow",l:"Free Cash Flow"},{k:"operatingCashFlow",l:"Op. Cash Flow"},{k:"totalAssets",l:"Total Assets"},{k:"totalDebt",l:"Total Debt"},{k:"totalStockholdersEquity",l:"Equity"},{k:"grossProfitRatio",l:"Gross Margin",p:1},{k:"operatingIncomeRatio",l:"Op. Margin",p:1},{k:"netIncomeRatio",l:"Net Margin",p:1}];
    function toggleChartMetric(key){setChartSel(function(prev){return prev.indexOf(key)>=0?prev.filter(function(k){return k!==key}):[].concat(prev,[key]).slice(-6)})}
    // Build multi-metric chart data — use dates from longest statement so chart persists across tabs
    var _allDates={};if(data){["income","balance","cashflow"].forEach(function(st){(data[st]||[]).forEach(function(r){if(r.date)_allDates[r.date]=true})})}
    var dates=Object.keys(_allDates).sort();
    if(dates.length===0)dates=rows.map(function(r){return r.date}).filter(Boolean);
    var chartSeries=chartSel.map(function(key,si){
      var def=chartItems.find(function(ci){return ci.k===key})||{k:key,l:key};
      var pts=dates.map(function(dt){var v=null;if(data){var inc=(data.income||[]).find(function(x){return x.date===dt});var bal=(data.balance||[]).find(function(x){return x.date===dt});var cf=(data.cashflow||[]).find(function(x){return x.date===dt});if(inc&&inc[key]!=null)v=Number(inc[key]);else if(bal&&bal[key]!=null)v=Number(bal[key]);else if(cf&&cf[key]!=null)v=Number(cf[key])}return{date:dt,val:v}}).filter(function(p){return p.val!=null});
      return{key:key,def:def,pts:pts,color:CHART_COLORS[si%CHART_COLORS.length]}});
    // Compute shared axes
    var allVals=[];chartSeries.forEach(function(s){s.pts.forEach(function(p){allVals.push(p.val)})});
    var hasPctMix=chartSel.some(function(k){var d=chartItems.find(function(ci){return ci.k===k});return d&&d.p})&&chartSel.some(function(k){var d=chartItems.find(function(ci){return ci.k===k});return!d||!d.p});
    var cW=Math.max(500,dates.length*60);var cH=200;var pad={l:60,r:20,t:20,b:30};var plotW=cW-pad.l-pad.r;var plotH=cH-pad.t-pad.b;
    return<div style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:1100}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"24px 0 12px"}}>
        <button onClick={function(){setSubPage(null)}} style={{background:"none",border:"none",color:K.acc,fontSize:13,cursor:"pointer",fontFamily:fm,padding:0}}>{"←"} Back</button>
        <CoLogo domain={c.domain} ticker={c.ticker} size={32}/>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker} <span style={{fontWeight:300,color:K.mid,fontSize:15}}>Financial Statements</span></div>
          <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.name} · {c.sector}{data&&data.source?<span style={{marginLeft:8,fontSize:9,padding:"2px 6px",borderRadius:3,background:data.source==="sec-edgar"?K.grn+"15":K.acc+"15",color:data.source==="sec-edgar"?K.grn:K.acc}}>{"Source: "+(data.source==="sec-edgar"?"SEC EDGAR":"FMP")}</span>:""}</div></div>
        <div style={{display:"flex",gap:4}}>{["annual","quarter"].map(function(v){return<button key={v} onClick={function(){setPer(v)}} style={{padding:"6px 16px",fontSize:11,fontFamily:fm,fontWeight:per===v?600:400,background:per===v?K.acc+"20":"transparent",color:per===v?K.acc:K.dim,border:"1px solid "+(per===v?K.acc+"40":K.bdr),borderRadius:6,cursor:"pointer"}}>{v==="annual"?"Annual":"Quarterly"}</button>})}
          <button onClick={exportFinancialsPDF} disabled={!data||ld} style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11,opacity:data&&!ld?1:.4,display:"flex",alignItems:"center",gap:5})}><IC name="file" size={12} color={K.mid}/>PDF</button></div></div>
      {/* Statement Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid "+K.bdr}}>
        {STMT_TABS.map(function(t){return<button key={t.id} onClick={function(){setTab(t.id)}} style={{padding:"10px 20px",fontSize:12,fontFamily:fm,fontWeight:tab===t.id?600:400,color:tab===t.id?K.acc:K.dim,background:"transparent",border:"none",borderBottom:tab===t.id?"2px solid "+K.acc:"2px solid transparent",cursor:"pointer",marginBottom:-1}}>{t.l}</button>})}</div>
      {ld?<div style={{padding:"32px 0"}}><div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:24}}>
        {[0,1,2,3,4,5].map(function(i){return<div key={i} style={{display:"flex",gap:12,marginBottom:12}}>
          <div className="ta-skel" style={{height:12,flex:1,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/></div>})}</div>
        <div style={{textAlign:"center",fontSize:11,color:K.dim,marginTop:16,fontFamily:fm}}>Loading {c.ticker} financial data from FMP...</div></div>:
      rows.length===0?<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>No {stab.l.toLowerCase()} data available for {c.ticker}</div><div style={{fontSize:11,color:K.dim,lineHeight:1.8,maxWidth:500,margin:"0 auto"}}>Data is fetched from FMP (primary) with SEC EDGAR as fallback. This company may not have filings available.<br/>
        {diag&&<div style={{marginTop:8,padding:"8px 12px",background:K.red+"10",border:"1px solid "+K.red+"20",borderRadius:6,color:K.amb,fontSize:10,fontFamily:fm,textAlign:"left"}}>{diag}</div>}
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
        <button onClick={function(){setLd(true);setDiag("");delete _fincache[c.ticker+"-"+(per||"annual")];fetchFinancialStatements(c.ticker,per==="quarter"?"quarter":"annual").then(function(r){setData(r);setLd(false);var ic=(r&&r.income?r.income.length:0);if(ic===0)setDiag("Still 0 rows. Check browser console for details.")}).catch(function(e){setLd(false);setDiag("Error: "+e.message)})}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",color:K.acc,padding:"6px 14px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:fm}}>Retry</button></div></div></div>:
      <div>
      {/* Interactive multi-metric chart */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>
          {chartItems.map(function(ci,ci2){var isOn=chartSel.indexOf(ci.k)>=0;var col=isOn?CHART_COLORS[chartSel.indexOf(ci.k)%CHART_COLORS.length]:K.dim;
            return<button key={ci.k} onClick={function(){toggleChartMetric(ci.k)}} style={{padding:"3px 10px",fontSize:10,fontFamily:fm,background:isOn?col+"18":"transparent",color:isOn?col:K.dim,border:"1px solid "+(isOn?col+"40":"transparent"),borderRadius:5,cursor:"pointer",whiteSpace:"nowrap",transition:"all .2s",fontWeight:isOn?600:400}}>
              {isOn&&<span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:col,marginRight:4}}/>}{ci.l}</button>})}</div>
        {hasPctMix&&<div style={{fontSize:9,color:K.amb,fontFamily:fm,marginBottom:8}}>{"⚠"} Mixing % and $ metrics — values share the Y-axis</div>}
        {chartSeries.length>0&&dates.length>0?(function(){
          var numSeries=chartSeries.length;var numDates=dates.length;
          var groupW=Math.max(30,plotW/numDates-8);var barW2=Math.max(8,Math.min(28,(groupW-4)/numSeries));
          var groupGap=(plotW-groupW*numDates)/Math.max(numDates-1,1);
          // Per-series: compute min/max for shared axis
          var allV=[];chartSeries.forEach(function(s){s.pts.forEach(function(p){allV.push(p.val)})});
          var gMx=Math.max.apply(null,allV.concat([0]));var gMn=Math.min.apply(null,allV.concat([0]));var gRange=gMx-gMn||1;
          var zeroY=gMn>=0?pad.t+plotH:pad.t+(gMx/gRange)*plotH;
          // Y-axis labels
          var ySteps=[gMn,gMn+(gRange*0.25),gMn+(gRange*0.5),gMn+(gRange*0.75),gMx];
          return<div style={{overflowX:"auto",position:"relative"}}>
            <svg width={cW} height={cH} style={{display:"block"}}>
              {/* Grid lines + Y labels */}
              {ySteps.map(function(v,i){var y=pad.t+(1-(v-gMn)/gRange)*plotH;
                return<g key={i}><line x1={pad.l} y1={y} x2={cW-pad.r} y2={y} stroke={K.bdr} strokeWidth={1} strokeDasharray={i===0?"0":"3,3"}/>
                  <text x={pad.l-6} y={y+3} textAnchor="end" fill={K.dim} fontSize={8} fontFamily="JetBrains Mono,monospace">{chartSeries.length===1&&chartSeries[0].def.p?(v*100).toFixed(0)+"%":fmtBig(v)}</text></g>})}
              {/* Zero line if needed */}
              {gMn<0&&<line x1={pad.l} y1={zeroY} x2={cW-pad.r} y2={zeroY} stroke={K.txt+"40"} strokeWidth={1.5}/>}
              {/* Grouped bars */}
              {dates.map(function(dt,di){
                var groupX=pad.l+di*(groupW+(numDates>1?groupGap:0));
                return<g key={di}>
                  {chartSeries.map(function(s,si){
                    var pt=s.pts.find(function(p){return p.date===dt});if(!pt)return null;
                    var val=pt.val;var barH=Math.abs(val-Math.max(gMn,0))/gRange*plotH;
                    if(gMn<0){barH=Math.abs(val)/gRange*plotH}
                    var y=val>=0?zeroY-barH:zeroY;
                    var bx=groupX+(si*(barW2+1));
                    var isHov2=hov===dt;
                    return<rect key={s.key} x={bx} y={val>=0?zeroY-(val-Math.max(gMn,0))/gRange*plotH:zeroY} width={barW2} height={Math.max(Math.abs(val-(gMn>=0?gMn:0))/gRange*plotH,2)} rx={2} fill={isHov2?s.color:s.color+"90"} style={{transition:"fill .15s",animation:"fadeInFast .3s ease both",animationDelay:(di*30+si*60)+"ms"}}/>})}
                  {/* Date label */}
                  <text x={groupX+groupW/2} y={cH-4} textAnchor="middle" fill={hov===dt?K.txt:K.dim} fontSize={per==="quarter"?7:9} fontWeight={hov===dt?600:400} fontFamily="JetBrains Mono,monospace">{per==="quarter"?((rows[di]||{}).period||"")+" '"+dt.substring(2,4):dt.substring(0,4)}</text>
                  {/* Hover zone */}
                  <rect x={groupX-2} y={pad.t} width={groupW+4} height={plotH} fill="transparent" style={{cursor:"pointer"}} onMouseEnter={function(){setHov(dt)}} onMouseLeave={function(){setHov(null)}}/>
                </g>})}
            </svg>
            {/* Hover tooltip */}
            {hov&&(function(){var hi=dates.indexOf(hov);if(hi<0)return null;var tx=pad.l+hi*(groupW+(numDates>1?groupGap:0));
              return<div style={{position:"absolute",left:Math.min(Math.max(tx,8),cW-170),top:8,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"8px 12px",boxShadow:"0 4px 16px rgba(0,0,0,.2)",pointerEvents:"none",zIndex:10,minWidth:130}}>
                <div style={{fontSize:9,color:K.dim,fontFamily:fm,marginBottom:4}}>{per==="quarter"?((rows[hi]||{}).period||"")+" "+hov:hov.substring(0,4)}</div>
                {chartSeries.map(function(s){var pt=s.pts.find(function(p){return p.date===hov});if(!pt)return null;
                  var prev=s.pts[s.pts.indexOf(pt)-1];var yoy=prev&&prev.val!==0?((pt.val-prev.val)/Math.abs(prev.val)*100):null;
                  return<div key={s.key} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{width:6,height:6,borderRadius:2,background:s.color,flexShrink:0}}/>
                    <span style={{fontSize:10,color:K.mid,fontFamily:fm,flex:1}}>{s.def.l}</span>
                    <span style={{fontSize:10,fontWeight:700,color:s.color,fontFamily:fm}}>{s.def.p?(pt.val*100).toFixed(1)+"%":s.def.sm?"$"+pt.val.toFixed(2):fmtBig(pt.val)}</span>
                    {yoy!=null&&<span style={{fontSize:8,color:yoy>=0?K.grn:K.red,fontFamily:fm}}>{yoy>=0?"+":""}{yoy.toFixed(0)}%</span>}</div>})}</div>})()}
          </div>})():<div style={{padding:20,textAlign:"center",fontSize:11,color:K.dim}}>Click metrics above to chart them</div>}
        {/* Legend */}
        {chartSeries.length>0&&<div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
          {chartSeries.map(function(s){return<div key={s.key} style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:8,height:3,borderRadius:2,background:s.color}}/>
            <span style={{fontSize:9,color:s.color,fontFamily:fm,fontWeight:600}}>{s.def.l}</span></div>})}</div>}
      </div>
      {/* Full data table */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:fm}}>
          <thead><tr><th style={{position:"sticky",left:0,background:K.card,padding:"10px 14px",textAlign:"left",color:K.dim,borderBottom:"2px solid "+K.bdr,fontWeight:500,minWidth:200,zIndex:2}}>
            {stab.l} ({per==="quarter"?"Quarterly":"Annual"})</th>
            {rows.map(function(r,i){return<th key={i} style={{padding:"10px 12px",textAlign:"right",color:K.dim,borderBottom:"2px solid "+K.bdr,fontWeight:500,whiteSpace:"nowrap",minWidth:90}}>{per==="quarter"?(r.period||"")+" '"+(r.date||"").substring(2,4):(r.date||"").substring(0,4)}</th>})}</tr></thead>
          <tbody>{stab.items.map(function(item,ri){
            if(!item.k)return<tr key={ri}><td colSpan={rows.length+1} style={{height:8,background:K.bg}}></td></tr>;
            var isCharted=chartSel.indexOf(item.k)>=0;var chartColor=isCharted?CHART_COLORS[chartSel.indexOf(item.k)%CHART_COLORS.length]:null;
            return<tr key={ri} style={{background:isCharted?chartColor+"08":item.b?K.acc+"06":"transparent",cursor:"pointer",transition:"background .15s"}} onClick={function(){toggleChartMetric(item.k)}}>
              <td style={{position:"sticky",left:0,background:isCharted?chartColor+"10":item.b?K.acc+"08":K.card,padding:"7px 14px",color:isCharted?chartColor:item.d?K.dim:item.b?K.txt:K.mid,fontWeight:item.b||isCharted?600:400,borderBottom:"1px solid "+K.bdr,fontSize:item.b?11:10.5,zIndex:1,borderLeft:isCharted?"3px solid "+chartColor:"3px solid transparent"}}>
                {item.l}</td>
              {rows.map(function(r,ci){var v=r[item.k];var yoy=null;if(ci>0&&rows[ci-1]){var prev=rows[ci-1][item.k];if(prev&&v&&!item.p)yoy=((Number(v)-Number(prev))/Math.abs(Number(prev))*100)}
                return<td key={ci} style={{padding:"7px 12px",textAlign:"right",color:isCharted?chartColor:v!=null&&Number(v)<0?K.red:item.d?K.dim:item.b?K.txt:K.mid,fontWeight:item.b||isCharted?600:400,borderBottom:"1px solid "+K.bdr,whiteSpace:"nowrap",fontSize:item.b?11:10.5}}>
                  <div>{fmtCell(v,item)}</div>
                  {yoy!=null&&!isNaN(yoy)&&<div style={{fontSize:9,color:yoy>=0?K.grn:K.red,marginTop:1}}>{yoy>=0?"+":""}{yoy.toFixed(1)}%</div>}
                </td>})}</tr>})}</tbody>
        </table></div></div>
      <div style={{fontSize:10,color:K.dim,marginTop:12,padding:"0 4px"}}>Source: Financial Modeling Prep (SEC filings) · {per==="annual"?"Annual":"Quarterly"} data · {rows.length} periods</div>
      </div>}
    </div>}
  function DetailView(){if(!sel)return null;var c=sel;var h=gH(c.kpis);var cs=checkSt[c.id];var pos=c.position||{};var conv=c.conviction||0;
    var _sm=useState(false),showMore=_sm[0],setShowMore=_sm[1];
    // Moat data for dossier display
    var _moatD=useState(null),dossierMoat=_moatD[0],setDossierMoat=_moatD[1];
    var _keyFin=useState(null),keyFin=_keyFin[0],setKeyFin=_keyFin[1];
    var _hovD=useState(null),hovD=_hovD[0],setHovD=_hovD[1];
    var _descExp=useState(false),descExpanded=_descExp[0],setDescExpanded=_descExp[1];
    useEffect(function(){
      // Backfill description from FMP profile if missing (free for all users)
      if(!c.description){fmp("profile/"+c.ticker).then(function(p){
        if(p&&p.length&&p[0].description){upd(c.id,{description:p[0].description||"",ceo:p[0].ceo||"",employees:p[0].fullTimeEmployees||0,country:p[0].country||"",exchange:p[0].exchangeShortName||p[0].exchange||"",ipoDate:p[0].ipoDate||"",mktCap:p[0].mktCap||0})}}).catch(function(){})}
      // Financial data for moat + key metrics (Pro only)
      if(!isPro)return;
      fetchFinancialStatements(c.ticker,"annual").then(function(r){
        if(r){setDossierMoat(calcMoatFromData(r));
          var inc=r.income||[];var cf=r.cashflow||[];
          var pts=inc.map(function(row,i){var cfRow=cf[i]||{};return{date:row.date,revenue:row.revenue,netIncome:row.netIncome,fcf:cfRow.freeCashFlow||cfRow.operatingCashFlow,sbc:cfRow.stockBasedCompensation||row.stockBasedCompensation}}).filter(function(p){return p.revenue!=null});
          if(pts.length>0)setKeyFin(pts)}
      }).catch(function(){})
    },[c.ticker,isPro]);
    var TABS=[{id:"dossier",label:"Dossier",icon:"overview"},{id:"financials",label:"Financials",icon:"chart"},{id:"research",label:"Research",icon:"book"}];
    return<div className="ta-detail-pad" style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:900}}>
      {/* Mobile back button */}
      {isMobile&&<button onClick={function(){setSelId(null)}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:K.mid,fontSize:12,cursor:"pointer",padding:"12px 0 4px",fontFamily:fm}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Back to portfolio</button>}
      {/* Header */}
      <div className="ta-detail-head" style={{display:"flex",alignItems:"center",gap:14,padding:"28px 0 16px"}}><CoLogo domain={c.domain} ticker={c.ticker} size={isMobile?28:36}/>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker}<span style={{fontWeight:300,color:K.mid,marginLeft:8,fontSize:16}}>{c.name}</span></div>
          <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}><span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.sector}</span>
            {c.investStyle&&STYLE_MAP[c.investStyle]&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:600,color:STYLE_MAP[c.investStyle].color,background:STYLE_MAP[c.investStyle].color+"12",padding:"1px 8px",borderRadius:4,fontFamily:fm}}><IC name={STYLE_MAP[c.investStyle].icon} size={9} color={STYLE_MAP[c.investStyle].color}/>{STYLE_MAP[c.investStyle].label}</span>}
            <span style={{fontSize:11,color:K.dim}}>{"•"}</span><span style={{fontSize:11,color:dU(c.earningsDate)<=7&&dU(c.earningsDate)>=0?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"Earnings: TBD":"Earnings: "+fD(c.earningsDate)+" "+c.earningsTime}</span>
            <span style={{fontSize:11,color:K.dim}}>{"•"}</span><button onClick={function(){var next=c.status==="portfolio"?"watchlist":c.status==="watchlist"?"toohard":"portfolio";upd(c.id,{status:next})}} style={{background:(c.status||"portfolio")==="portfolio"?K.grn+"15":c.status==="toohard"?K.red+"15":K.amb+"15",border:"1px solid "+((c.status||"portfolio")==="portfolio"?K.grn+"40":c.status==="toohard"?K.red+"40":K.amb+"40"),borderRadius:4,padding:"1px 8px",fontSize:10,color:(c.status||"portfolio")==="portfolio"?K.grn:c.status==="toohard"?K.red:K.amb,cursor:"pointer",fontFamily:fm,fontWeight:600}}>{(c.status||"portfolio")==="portfolio"?"Portfolio":c.status==="toohard"?"Too Hard":"Watchlist"}</button></div></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{c.irUrl&&<a href={c.irUrl} target="_blank" rel="noopener noreferrer" style={Object.assign({},S.btn,{display:"inline-flex",alignItems:"center",gap:5,textDecoration:"none",padding:"5px 12px",fontSize:11})}>IR{"↗"}</a>}
          <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"edit"})}}>Settings</button>
          <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11,opacity:(streakData.current||0)>=2?1:.5})} onClick={function(){if((streakData.current||0)<2){showToast("Research Export unlocks at week 2 streak. "+((streakData.current||0)===0?"Start your streak with a weekly review!":(2-(streakData.current||0))+" week"+(2-(streakData.current||0)>1?"s":"")+" to go!"),"info",4000);return}exportResearch(c.id)}} title={(streakData.current||0)>=2?"Copy thesis + KPIs + history for NotebookLM or ChatGPT":"Unlocks at week 2 streak"}>{(streakData.current||0)<2?String.fromCodePoint(0x1F512)+" ":""}Export AI</button>
          <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){exportPDF()}}>PDF</button>
          <button style={Object.assign({},S.btnD,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"del"})}}>Remove</button></div></div>
      {/* Moat type badges */}
      {function(){var mt=c.moatTypes||{};var active=MOAT_TYPES.filter(function(t){return mt[t.id]&&mt[t.id].active});
        if(active.length===0)return null;
        return<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8,paddingBottom:8}}>
          {active.map(function(t){var d=mt[t.id];var dots=d.strength||3;
            return<div key={t.id} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:6,background:t.color+"12",border:"1px solid "+t.color+"30",cursor:"pointer"}} onClick={function(){setDetailTab("research");setSubPage("moat")}}>
              <IC name={t.icon} size={10} color={t.color}/>
              <span style={{fontSize:10,fontWeight:600,color:t.color,fontFamily:fm}}>{t.label}</span>
              <span style={{fontSize:8,color:t.color,fontFamily:fm,letterSpacing:1}}>{"•".repeat(dots)}{"·".repeat(5-dots)}</span>
            </div>})}</div>}()}
      {/* Process indicators — compact badges showing key scores */}
      {(function(){var os2=calcOwnerScore([c]);var conv2=c.conviction||0;
        var mt=c.moatTypes||{};var activeMoats=MOAT_TYPES.filter(function(t){return mt[t.id]&&mt[t.id].active}).length;
        var hasKpis=c.kpis.length>0;var hasThesis=c.thesisNote&&c.thesisNote.trim().length>20;
        var items=[];
        if(conv2>0)items.push({label:"Conviction",value:conv2+"/10",color:conv2>=7?K.grn:conv2>=4?K.amb:K.red});
        if(hasKpis){var kh=gH(c.kpis);items.push({label:"KPIs",value:kh.l,color:kh.c})}
        if(activeMoats>0)items.push({label:"Moat",value:activeMoats+" type"+(activeMoats>1?"s":""),color:"#9333EA"});
        if(os2.total>0)items.push({label:"Process",value:os2.total+"/100",color:os2.total>=70?K.grn:os2.total>=40?K.amb:K.red});
        if(items.length===0)return null;
        return<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10,paddingBottom:6}}>
          {items.map(function(it,ii){return<div key={ii} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:6,background:it.color+"08",border:"1px solid "+it.color+"20"}}>
            <span style={{fontSize:9,color:it.color,fontFamily:fm,fontWeight:600}}>{it.label}</span>
            <span style={{fontSize:10,color:it.color,fontWeight:700,fontFamily:fm}}>{it.value}</span></div>})}</div>})()}
      {/* Community conviction consensus */}
      {conv>0&&(function(){
        var portOwners=cos.filter(function(x){return(x.status||"portfolio")==="portfolio"}).length;
        var hist=c.convictionHistory||[];var avgConv=hist.length>0?Math.round(hist.reduce(function(s,h){return s+h.rating},0)/hist.length*10)/10:conv;
        return<div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 14px",background:K.bg,borderRadius:8,marginBottom:8}}>
          <IC name="users" size={14} color={K.dim}/>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:K.mid}}><span style={{fontWeight:600,color:K.txt,fontFamily:fm}}>{conv}/10</span> conviction · {hist.length} rating{hist.length!==1?"s":""} over time{hist.length>=3?" · avg "+avgConv:""}</div>
            <div style={{fontSize:9,color:K.dim,marginTop:1}}>Community consensus coming as more owners join ThesisAlpha</div></div>
        </div>})()}
      {/* Tab Navigation */}
      <div className="ta-detail-tabs" style={{display:"flex",gap:0,marginBottom:24,borderBottom:"1px solid "+K.bdr}}>
        {TABS.map(function(t){var active=detailTab===t.id;return<button key={t.id} className="ta-tab" onClick={function(){if(t.id==="financials"){setSubPage("financials")}else{setDetailTab(t.id);setSubPage(null)}}} style={{background:"none",border:"none",borderBottom:active?"2px solid "+K.acc:"2px solid transparent",color:active?K.txt:K.dim,padding:"12px 20px",fontSize:12,fontFamily:fb,fontWeight:active?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}><IC name={t.icon} size={14} color={active?K.acc:K.dim}/>{t.label}{t.id==="financials"&&isPro&&<span style={{fontSize:8,color:K.grn,fontFamily:fm,marginLeft:2}}>PRO</span>}</button>})}</div>
      {/* ═══ OVERVIEW TAB ═══ */}
      {/* ═══ DOSSIER TAB — Munger's pinned sheet ═══ */}
      {detailTab==="dossier"&&<div className="ta-fade">
        {/* Company Summary — auto-fetched from FMP */}
        {c.description&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.7,marginBottom:8}}>{descExpanded||c.description.length<=200?c.description:c.description.substring(0,200)+"…"}
            {c.description.length>200&&<button onClick={function(){setDescExpanded(!descExpanded)}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,padding:0,marginLeft:4}}>{descExpanded?"Show less":"Read more"}</button>}</div>
          {(c.ceo||c.employees||c.mktCap||c.exchange)&&<div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:10,color:K.dim,fontFamily:fm}}>
            {c.ceo&&<span>CEO: <strong style={{color:K.mid}}>{c.ceo}</strong></span>}
            {c.employees>0&&<span>Employees: <strong style={{color:K.mid}}>{c.employees.toLocaleString()}</strong></span>}
            {c.mktCap>0&&<span>Mkt Cap: <strong style={{color:K.mid}}>{c.mktCap>=1e12?"$"+(c.mktCap/1e12).toFixed(1)+"T":c.mktCap>=1e9?"$"+(c.mktCap/1e9).toFixed(0)+"B":"$"+(c.mktCap/1e6).toFixed(0)+"M"}</strong></span>}
            {c.exchange&&<span>{c.exchange}</span>}
            {c.country&&<span>{c.country}</span>}
            {c.ipoDate&&<span>IPO: {c.ipoDate.substring(0,4)}</span>}
          </div>}
        </div>}

        {/* Pre-Earnings Briefing */}
        {dashSet.showPreEarnings&&c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)>=0&&dU(c.earningsDate)<=14&&<div style={{background:K.amb+"08",border:"1px solid "+K.amb+"25",borderRadius:12,padding:"16px 20px",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><IC name="target" size={16} color={K.amb}/><span style={{fontSize:13,fontWeight:600,color:K.amb}}>Earnings in {dU(c.earningsDate)}d</span><span style={{fontSize:10,color:K.amb,fontFamily:fm,marginLeft:"auto"}}>{fD(c.earningsDate)} {c.earningsTime}</span></div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {c.kpis.map(function(k){return<div key={k.id} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:6,background:K.card,border:"1px solid "+K.bdr,fontSize:10,fontFamily:fm}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:k.lastResult?k.lastResult.status==="met"?K.grn:K.red:K.dim}}/>{k.name} <span style={{color:K.dim}}>Target: {k.target}</span></div>})}
          </div></div>}

        {/* ── 1. THE STORY ── */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600}}>THE STORY</div>
            <button onClick={function(){setModal({type:"thesis"})}} style={{background:"none",border:"none",color:K.acc,fontSize:10,cursor:"pointer",fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><IC name="edit" size={10} color={K.acc}/>Edit thesis</button></div>
          {c.thesisNote?(function(){var sec=parseThesis(c.thesisNote);
            return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
              <div style={{fontSize:14,color:K.txt,lineHeight:1.8,marginBottom:sec.moat||sec.risks||sec.sell?16:0}}>{sec.core}</div>
              {sec.moat&&<div style={{padding:"10px 14px",background:K.bg,borderRadius:8,borderLeft:"3px solid "+K.grn,marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,color:K.grn,fontFamily:fm,letterSpacing:1,marginBottom:3}}>MOAT</div>
                <div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>{sec.moat}</div></div>}
              {sec.risks&&<div style={{padding:"10px 14px",background:K.bg,borderRadius:8,borderLeft:"3px solid "+K.amb,marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,color:K.amb,fontFamily:fm,letterSpacing:1,marginBottom:3}}>RISKS</div>
                <div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>{sec.risks}</div></div>}
              {sec.sell&&<div style={{padding:"10px 14px",background:K.bg,borderRadius:8,borderLeft:"3px solid "+K.red}}>
                <div style={{fontSize:9,fontWeight:700,color:K.red,fontFamily:fm,letterSpacing:1,marginBottom:3}}>SELL CRITERIA</div>
                <div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>{sec.sell}</div></div>}
            </div>})()
          :<div style={{background:K.card,border:"1px dashed "+K.acc+"40",borderRadius:12,padding:"32px 24px",textAlign:"center",cursor:"pointer"}} onClick={function(){setModal({type:"thesis"})}}>
            <div style={{fontSize:13,color:K.acc,fontWeight:600,marginBottom:4}}>Write your thesis</div>
            <div style={{fontSize:11,color:K.dim}}>Why do you own {c.ticker}? What’s the moat? When would you sell?</div></div>}
        </div>

        {/* Investment style */}
        {!c.investStyle&&<div style={{background:K.acc+"06",border:"1px solid "+K.acc+"20",borderRadius:10,padding:"12px 16px",marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:600,color:K.acc,marginBottom:6,fontFamily:fm}}>What type of investment is {c.ticker}?</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {INVEST_STYLES.map(function(st){return<button key={st.id} onClick={function(){upd(c.id,{investStyle:st.id})}} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:5,border:"1px solid "+st.color+"30",background:st.color+"08",color:st.color,fontSize:9,cursor:"pointer",fontFamily:fm,fontWeight:600}}>
              <IC name={st.icon} size={8} color={st.color}/>{st.label}</button>})}</div></div>}

        {/* ── 2. THE EVIDENCE ── */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600,marginBottom:10}}>THE EVIDENCE</div>
          {/* KPI Scorecard */}
          {c.kpis.length>0?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:12,fontWeight:600,color:K.txt}}>KPI Scorecard</span>
              <span style={S.badge(h.c)}>{h.l}</span></div>
            {c.kpis.map(function(k){
              var hist=[];if(c.earningsHistory){c.earningsHistory.forEach(function(e){if(e.results){var match=e.results.find(function(r){return r.kpi_name===k.name});if(match)hist.push({q:e.quarter,v:match.actual_value,s:match.status})}})}
              return<div key={k.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+K.bdr+"40"}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:k.lastResult?k.lastResult.status==="met"?K.grn:K.red:K.dim,flexShrink:0}}/>
                <span style={{fontSize:11,color:K.txt,flex:1}}>{k.name}</span>
                <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{k.target}</span>
                {k.lastResult&&<span style={{fontSize:10,fontWeight:600,color:k.lastResult.status==="met"?K.grn:K.red,fontFamily:fm}}>{k.lastResult.actual}{METRIC_MAP[k.metricId]?METRIC_MAP[k.metricId].unit:""}</span>}
                {hist.length>=2&&<div style={{display:"flex",gap:2}}>{hist.slice(0,4).reverse().map(function(hh,hi){return<div key={hi} style={{width:4,height:12,borderRadius:1,background:hh.s==="met"?K.grn:K.red}}/>})}</div>}
              </div>})}
            <button onClick={function(){setModal({type:"kpi"})}} style={{background:"none",border:"none",color:K.acc,fontSize:10,cursor:"pointer",fontFamily:fm,marginTop:8,padding:0}}>+ Add KPI</button>
          </div>
          :<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:"20px",textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:12,color:K.dim,marginBottom:6}}>No KPIs tracked yet</div>
            <button onClick={function(){setModal({type:"kpi"})}} style={Object.assign({},S.btn,{fontSize:10,padding:"5px 12px"})}>+ Add KPIs</button></div>}
          {/* Earnings check */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            <button style={Object.assign({},S.btnChk,{padding:"6px 14px",fontSize:11,flex:1,opacity:cs==="checking"?.6:1})} onClick={function(){if(requirePro("earnings"))checkOne(c.id)}} disabled={cs==="checking"}>{cs==="checking"?"Checking…":cs==="found"?"✓ Found":cs==="not-yet"?"Not Yet":cs==="error"?"✘ Error":"Check Earnings"}</button>
            <button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"manualEarnings"})}}>Enter Manually</button></div>
          {/* Latest earnings card from journal */}
          {(function(){var latestEarnings=(c.decisions||[]).find(function(d2){return d2.cardType==="earnings_review"});
            if(latestEarnings)return<JournalCard entry={latestEarnings}/>;return null})()}
        </div>

        {/* ── 3. THE LEDGER ── */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600}}>THE LEDGER</div>
            <button onClick={function(){setModal({type:"conviction"})}} style={{background:"none",border:"none",color:K.acc,fontSize:10,cursor:"pointer",fontFamily:fm}}>Rate conviction</button></div>
          {/* Conviction + Position row */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:12}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px",cursor:"pointer"}} onClick={function(){setModal({type:"conviction"})}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>CONVICTION</span>
                <span style={{fontSize:24,fontWeight:800,color:conv>=7?K.grn:conv>=4?K.amb:conv>0?K.red:K.dim,fontFamily:fm}}>{conv||"—"}<span style={{fontSize:12,fontWeight:400,color:K.dim}}>/10</span></span></div>
              {c.convictionHistory&&c.convictionHistory.length>1&&<div style={{display:"flex",gap:2,marginTop:8}}>
                {c.convictionHistory.slice(-12).map(function(ch,i){return<div key={i} style={{flex:1,height:Math.max(4,ch.rating*4),borderRadius:2,background:ch.rating>=7?K.grn:ch.rating>=4?K.amb:K.red,opacity:.7}}/>})}</div>}
            </div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px",cursor:"pointer"}} onClick={function(){setModal({type:"position"})}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>POSITION</div>
              {pos.shares>0?<div>
                <div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>{pos.shares} shares @ ${pos.avgCost}</div>
                {pos.currentPrice>0&&<div style={{fontSize:12,color:((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?K.grn:K.red,fontFamily:fm,marginTop:2}}>{((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?"+":""}{((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)}% (${((pos.currentPrice-pos.avgCost)*pos.shares).toFixed(0)})</div>}
              </div>:<div style={{fontSize:12,color:K.dim}}>Click to add position</div>}
            </div></div>
          {/* Recent decisions */}
          {(function(){var recent=(c.decisions||[]).filter(function(d2){return d2.cardType==="decision"||(!d2.cardType&&d2.reasoning)}).slice(0,2);
            if(recent.length===0)return null;
            return<div>{recent.map(function(d2){return<JournalCard key={d2.id} entry={d2}/>})}</div>})()}
        </div>

        {/* ── OWNER'S NUMBERS ── */}
        {(function(){var snap=c.financialSnapshot||{};var hasSnap=Object.keys(snap).length>0;
          if(!hasSnap)return null;
          // Group metrics
          var valuation=[];var returns=[];var divInfo=[];var health=[];
          if(snap.pe)valuation.push({l:"P/E",v:snap.pe.value,tip:"Price to earnings"});
          if(snap.pb)valuation.push({l:"P/B",v:snap.pb.value,tip:"Price to book"});
          if(snap.fcf)valuation.push({l:"FCF/Share",v:snap.fcf.value,tip:"Free cash flow per share"});
          if(snap.hi52&&snap.lo52){var cp=pos.currentPrice||0;if(cp>0){var pctOfHi=((cp/parseFloat(snap.hi52.value.replace("$","")))*100).toFixed(0);valuation.push({l:"vs 52w High",v:pctOfHi+"%",tip:"Current price as % of 52-week high",isNeutral:true})}}
          if(snap.roic)returns.push({l:"ROIC",v:snap.roic.value,tip:"Return on invested capital",isGood:parseFloat(snap.roic.value)>=12});
          if(snap.roe)returns.push({l:"ROE",v:snap.roe.value,tip:"Return on equity",isGood:parseFloat(snap.roe.value)>=15});
          if(snap.grossMargin)returns.push({l:"Gross Margin",v:snap.grossMargin.value,tip:"Revenue minus COGS"});
          if(snap.opMargin)returns.push({l:"Op. Margin",v:snap.opMargin.value,tip:"Operating income / revenue"});
          if(snap.netMargin)returns.push({l:"Net Margin",v:snap.netMargin.value,tip:"Net income / revenue"});
          if(snap.revGrowth)returns.push({l:"Rev Growth",v:snap.revGrowth.value,tip:"Year-over-year revenue growth",isGood:snap.revGrowth.positive});
          // Dividend info
          if(c.divPerShare>0||c.lastDiv>0){var ann=(c.divPerShare||c.lastDiv||0)*(c.divFrequency==="monthly"?12:c.divFrequency==="quarterly"?4:c.divFrequency==="semi"?2:1);
            var yld=pos.currentPrice>0?(ann/pos.currentPrice*100):0;
            divInfo.push({l:"Dividend",v:"$"+(c.divPerShare||c.lastDiv||0).toFixed(2)+" / "+c.divFrequency});
            if(yld>0)divInfo.push({l:"Yield",v:yld.toFixed(2)+"%",isGood:yld>=2});
            if(c.exDivDate)divInfo.push({l:"Ex-Div",v:fD(c.exDivDate)})}
          if(snap.currentRatio)health.push({l:"Current Ratio",v:snap.currentRatio.value,isGood:parseFloat(snap.currentRatio.value)>=1.5});
          if(snap.debtEquity)health.push({l:"Debt/Equity",v:snap.debtEquity.value,isGood:parseFloat(snap.debtEquity.value)<1});
          var sections=[];
          if(valuation.length>0)sections.push({title:"VALUATION",items:valuation,color:K.blue});
          if(returns.length>0)sections.push({title:"RETURNS & GROWTH",items:returns,color:K.grn});
          if(divInfo.length>0)sections.push({title:"DIVIDENDS",items:divInfo,color:K.amb});
          if(health.length>0)sections.push({title:"FINANCIAL HEALTH",items:health,color:K.mid});
          if(sections.length===0)return null;
          return<div style={{marginBottom:24}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600,marginBottom:10}}>OWNER'S NUMBERS</div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}>
              {sections.map(function(sec,si){return<div key={si} style={{marginBottom:si<sections.length-1?14:0}}>
                <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:sec.color,fontFamily:fm,fontWeight:700,marginBottom:6}}>{sec.title}</div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:"6px 16px"}}>
                  {sec.items.map(function(item,ii){return<div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid "+K.bdr+"30"}}>
                    <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{item.l}</span>
                    <span style={{fontSize:11,fontWeight:600,fontFamily:fm,color:item.isGood===true?K.grn:item.isGood===false?K.red:item.isNeutral?K.mid:K.txt}}>{item.v}</span></div>})}</div></div>})}</div></div>})()}

                {/* ── 4. THE MOAT ── */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600}}>THE MOAT</div>
            <button onClick={function(){setSubPage("moat")}} style={{background:"none",border:"none",color:K.acc,fontSize:10,cursor:"pointer",fontFamily:fm}}>Full analysis {"→"}</button></div>
          {dossierMoat?(function(){
            var comp=dossierMoat.composite;var mColor=comp>=8?K.grn:comp>=6?K.amb:K.red;
            var mLabel=comp>=8?"Wide Moat":comp>=6?"Narrow Moat":comp>=4?"Weak Moat":"No Moat";
            return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
                <div style={{width:56,height:56,borderRadius:"50%",border:"3px solid "+mColor,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontSize:22,fontWeight:800,color:mColor,fontFamily:fm,lineHeight:1}}>{comp}</div>
                  <div style={{fontSize:7,color:K.dim,fontFamily:fm}}>/10</div></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600,color:mColor,fontFamily:fh}}>{mLabel}</div>
                  <div style={{fontSize:10,color:K.dim}}>{dossierMoat.years}yr data · {dossierMoat.metrics.length} dimensions</div></div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {(function(){var mt2=c.moatTypes||{};return MOAT_TYPES.filter(function(t2){return mt2[t2.id]&&mt2[t2.id].active}).map(function(t2){
                    return<span key={t2.id} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:8,color:t2.color,background:t2.color+"10",padding:"2px 7px",borderRadius:3,fontFamily:fm,fontWeight:600}}><IC name={t2.icon} size={8} color={t2.color}/>{t2.label}</span>})})()}</div></div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"4px 16px"}}>
                {dossierMoat.metrics.slice(0,8).map(function(m){var barColor=m.score>=8?K.grn:m.score>=6?K.amb:K.red;
                  return<div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0"}}>
                    <span style={{fontSize:9,color:K.mid,fontFamily:fm,width:isMobile?90:110,flexShrink:0}}>{m.name.length>18?m.name.substring(0,18)+"…":m.name}</span>
                    <div style={{flex:1,height:6,borderRadius:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:(m.score*10)+"%",borderRadius:3,background:barColor,transition:"width .4s"}}/></div>
                    <span style={{fontSize:9,fontWeight:700,color:barColor,fontFamily:fm,width:20,textAlign:"right"}}>{m.score.toFixed(0)}</span></div>})}</div>
            </div>})()
          :!isPro?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px",textAlign:"center"}}>
            <div style={{fontSize:12,color:K.dim,marginBottom:8}}>Moat analysis powered by financial data</div>
            <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("financials")}} style={Object.assign({},S.btn,{fontSize:10,padding:"5px 14px"})}>Upgrade to unlock</button></div>
          :<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px",textAlign:"center"}}>
            <div className="ta-skel" style={{height:10,width:"60%",background:K.bdr,margin:"0 auto 8px",borderRadius:4}}/>
            <div className="ta-skel" style={{height:6,background:K.bdr,borderRadius:3}}/></div>}
        </div>

        {/* ── 5. KEY METRICS CHART ── */}
        {keyFin&&keyFin.length>=2&&<div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600}}>KEY METRICS</div>
            <button onClick={function(){if(isPro)setSubPage("financials");else{setShowUpgrade(true);setUpgradeCtx("financials")}}} style={{background:"none",border:"none",color:K.acc,fontSize:10,cursor:"pointer",fontFamily:fm}}>Full financials {"→"}</button></div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}>
            <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
              {[{k:"revenue",l:"Revenue",c:"#1cb0f6"},{k:"netIncome",l:"Net Income",c:"#58cc02"},{k:"fcf",l:"Free Cash Flow",c:"#ff9600"},{k:"sbc",l:"Stock-Based Comp",c:"#ce82ff"}].map(function(m){
                return<div key={m.k} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:8,height:8,borderRadius:2,background:m.c}}/>
                  <span style={{fontSize:9,color:K.mid,fontFamily:fm}}>{m.l}</span></div>})}</div>
            {(function(){
              var MK=[{k:"revenue",c:"#1cb0f6"},{k:"netIncome",c:"#58cc02"},{k:"fcf",c:"#ff9600"},{k:"sbc",c:"#ce82ff"}];
              var allV2=[];keyFin.forEach(function(p2){MK.forEach(function(m){if(p2[m.k]!=null)allV2.push(p2[m.k])})});
              if(allV2.length===0)return null;
              var gMx2=Math.max.apply(null,allV2.concat([0]));var gMn2=Math.min.apply(null,allV2.concat([0]));var gRange2=gMx2-gMn2||1;
              var cW3=Math.max(400,keyFin.length*80);var cH3=180;var pad3={l:50,r:10,t:16,b:26};
              var plotW3=cW3-pad3.l-pad3.r;var plotH3=cH3-pad3.t-pad3.b;
              var nD=keyFin.length;var nS=4;
              var gW=Math.max(30,plotW3/nD-8);var bW=Math.max(6,Math.min(16,(gW-4)/nS));
              var gG=nD>1?(plotW3-gW*nD)/(nD-1):0;
              var zY=gMn2>=0?pad3.t+plotH3:pad3.t+(gMx2/gRange2)*plotH3;
              return<div style={{overflowX:"auto",position:"relative"}}>
                <svg width={cW3} height={cH3} style={{display:"block"}}>
                  {[0,0.25,0.5,0.75,1].map(function(f,fi){var y=pad3.t+f*plotH3;var val=gMx2-(f*gRange2);
                    return<g key={fi}><line x1={pad3.l} y1={y} x2={cW3-pad3.r} y2={y} stroke={K.bdr} strokeWidth={1} strokeDasharray="3,3"/>
                      <text x={pad3.l-6} y={y+3} textAnchor="end" fill={K.dim} fontSize={8} fontFamily="JetBrains Mono,monospace">{fmtBig(val)}</text></g>})}
                  {gMn2<0&&<line x1={pad3.l} y1={zY} x2={cW3-pad3.r} y2={zY} stroke={K.txt+"40"} strokeWidth={1.5}/>}
                  {keyFin.map(function(pt,di){
                    var gX=pad3.l+di*(gW+(nD>1?gG:0));
                    return<g key={di}>
                      {MK.map(function(m,si){
                        var val=pt[m.k];if(val==null)return null;
                        var barH2=Math.abs(val)/gRange2*plotH3;
                        var y2=val>=0?zY-barH2:zY;
                        if(gMn2>=0){y2=pad3.t+plotH3-(val-gMn2)/gRange2*plotH3;barH2=(val-gMn2)/gRange2*plotH3}
                        return<rect key={m.k} x={gX+(si*(bW+1))} y={y2} width={bW} height={Math.max(barH2,2)} rx={2} fill={hovD===pt.date?m.c:m.c+"90"} style={{transition:"fill .15s",animation:"fadeInFast .3s ease both",animationDelay:(di*30+si*50)+"ms"}}/>})}
                      <text x={gX+gW/2} y={cH3-4} textAnchor="middle" fill={K.dim} fontSize={9} fontFamily="JetBrains Mono,monospace">{pt.date?pt.date.substring(0,4):""}</text>
                      <rect x={gX-2} y={pad3.t} width={gW+4} height={plotH3} fill="transparent" style={{cursor:"pointer"}} onMouseEnter={function(){setHovD(pt.date)}} onMouseLeave={function(){setHovD(null)}}/>
                    </g>})}
                </svg>
                {hovD&&(function(){var hi=keyFin.findIndex(function(p2){return p2.date===hovD});if(hi<0)return null;var pt=keyFin[hi];
                  var tx=pad3.l+hi*(gW+(nD>1?gG:0));
                  return<div style={{position:"absolute",left:Math.min(Math.max(tx,8),cW3-160),top:4,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"8px 12px",boxShadow:"0 4px 16px rgba(0,0,0,.2)",pointerEvents:"none",zIndex:10,minWidth:130}}>
                    <div style={{fontSize:9,color:K.dim,fontFamily:fm,marginBottom:4}}>{pt.date?pt.date.substring(0,4):""}</div>
                    {MK.map(function(m){return pt[m.k]!=null?<div key={m.k} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{width:6,height:6,borderRadius:2,background:m.c,flexShrink:0}}/>
                      <span style={{fontSize:9,color:K.mid,fontFamily:fm,flex:1}}>{m.k==="revenue"?"Revenue":m.k==="netIncome"?"Net Income":m.k==="fcf"?"FCF":"SBC"}</span>
                      <span style={{fontSize:10,fontWeight:700,color:m.c,fontFamily:fm}}>{fmtBig(pt[m.k])}</span></div>:null})}</div>})()}
              </div>})()}
          </div>
        </div>}

        {/* ── LINKS ── */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:20}}>
          <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}} onClick={function(){if(isPro){setSubPage("financials")}else{setShowUpgrade(true);setUpgradeCtx("financials")}}}>
            <IC name="chart" size={16} color={K.blue}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt}}>Full Financials</div>
              <div style={{fontSize:9,color:K.dim}}>Income, balance, cash flow</div></div>
            {!isPro&&<span style={{fontSize:8,color:K.acc,fontFamily:fm,background:K.acc+"12",padding:"2px 5px",borderRadius:3}}>PRO</span>}
            <span style={{color:K.acc}}>{"→"}</span></div>
          {c.irUrl&&<a href={c.irUrl} target="_blank" rel="noopener noreferrer" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}>
            <IC name="link" size={16} color={K.mid}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt}}>Investor Relations</div>
              <div style={{fontSize:9,color:K.dim}}>{c.domain||"IR page"}</div></div>
            <span style={{color:K.acc}}>{"↗"}</span></a>}
        </div>
        {/* Research preview */}
        {(c.decisions||[]).length+(c.docs||[]).length>0&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600}}>RESEARCH TRAIL</div>
            <button onClick={function(){setDetailTab("research")}} style={{background:"none",border:"none",color:K.acc,fontSize:10,cursor:"pointer",fontFamily:fm}}>View all {"→"}</button></div>
          {(c.decisions||[]).concat((c.docs||[]).map(function(d2){return Object.assign({},d2,{cardType:d2.isClip?"clip":d2.isMemo?"memo":d2.isIR?"ir":"doc",date:d2.updatedAt})})).sort(function(a,b){return(b.date||"")>(a.date||"")?1:-1}).slice(0,3).map(function(d2,di){
            return d2.cardType&&CARD_STYLES[d2.cardType]?<JournalCard key={di} entry={d2}/>:<div key={di} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"10px 14px",marginBottom:6,fontSize:11,color:K.mid}}>
              <span style={{fontWeight:600,color:K.txt}}>{d2.title||d2.ticker||""}</span> {d2.content?d2.content.substring(0,80)+"...":d2.reasoning?d2.reasoning.substring(0,80)+"...":""}</div>})}</div>}

        {/* Charts & analyst data (collapsible) */}
        {dashSet.showPriceChart&&<PriceChart company={c}/>}
        {dashSet.showAnalyst&&<AnalystInsiders company={c}/>}
      </div>}

      {/* ═══ RESEARCH TAB — chronological timeline ═══ */}
      {detailTab==="research"&&<div className="ta-fade">
        {/* Create buttons */}
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
          <button style={Object.assign({},S.btnP,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"memo"})}}>+ Memo</button>
          <button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"clip"})}}>+ Clip Research</button>
          <button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"irentry"})}}>+ IR Link</button>
          <button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>+ Note</button></div>
        {/* Inline decision form */}
        <DecisionJournal company={c}/>
        {/* Documents — memos, clips, notes */}
        <ThesisVault company={c}/>
        {/* Research links */}
        <ResearchLinks company={c}/>
        {/* Stats */}
        {function(){var nDec=(c.decisions||[]).length;var nDoc=(c.docs||[]).length;var nConv=(c.convictionHistory||[]).length;
          var hasData=nDec>0||nDoc>0||nConv>1;
          return hasData?<div style={{display:"flex",gap:12,marginBottom:16}}>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{nDec} entries</span>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{nDoc} docs</span>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{nConv} conviction updates</span>
          </div>:null}()}
        {/* SEC Filings */}
        <SECFilings company={c}/>
        {/* Thesis Scorecard */}
        <ThesisScorecard company={c}/>
        {/* Conviction History */}
        {c.convictionHistory&&c.convictionHistory.length>1&&<div style={{marginBottom:20}}>
          <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Conviction Over Time</div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px"}}>
            <div style={{display:"flex",alignItems:"flex-end",gap:2,height:50,marginBottom:6}}>
              {c.convictionHistory.map(function(ch,i){var pct=ch.rating*10;return<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{fontSize:8,fontWeight:600,color:ch.rating>=8?K.grn:ch.rating>=5?K.amb:K.red,fontFamily:fm}}>{ch.rating}</div>
                <div style={{width:"100%",maxWidth:20,height:pct+"%",minHeight:2,borderRadius:2,background:ch.rating>=8?K.grn:ch.rating>=5?K.amb:K.red}}/></div>})}
            </div>
            <div style={{display:"flex",gap:2}}>
              {c.convictionHistory.map(function(ch,i){return<div key={i} style={{flex:1,textAlign:"center",fontSize:7,color:K.dim,fontFamily:fm}}>{ch.date.substring(5)}</div>})}
            </div></div></div>}
        {/* Attribution */}
        <div style={{padding:"12px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10,marginTop:8}}><div style={{fontSize:10,color:K.dim,lineHeight:1.6}}>{"ℹ️"} Data from SEC EDGAR + FMP + Finnhub</div></div>
      </div>}

    </div>}
  // ── Owner's Hub ─────────────────────────────────────────
  function OwnersHub(){
    var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
    var watchlist=cos.filter(function(c){return c.status==="watchlist"});
    var os=calcOwnerScore(cos);var bd=os.breakdown;
    // Decision stats
    var allDecs=[];cos.forEach(function(c){(c.decisions||[]).forEach(function(d){allDecs.push(Object.assign({},d,{ticker:c.ticker}))})});
    var scored=allDecs.filter(function(d){return d.outcome});var rights=scored.filter(function(d){return d.outcome==="right"}).length;
    var dqPct=scored.length>0?Math.round(rights/scored.length*100):0;
    // Streak: consecutive days with any activity (decision, thesis edit, kpi check)
    var activityDates={};allDecs.forEach(function(d){if(d.date)activityDates[d.date.substring(0,10)]=true});
    cos.forEach(function(c){if(c.thesisUpdatedAt)activityDates[c.thesisUpdatedAt.substring(0,10)]=true;
      (c.earningsHistory||[]).forEach(function(h){if(h.checkedAt)activityDates[h.checkedAt.substring(0,10)]=true})});
    var streak=dailyStreak.current||0;
    // Thesis health
    var withThesis=portfolio.filter(function(c){return c.thesisNote});
    var staleTheses=withThesis.filter(function(c){var lastTouch=c.thesisUpdatedAt?new Date(c.thesisUpdatedAt):null;
      var reviews=c.thesisReviews||[];var lastReview=reviews.length>0?new Date(reviews[0].date):null;
      var latest=lastTouch&&lastReview?(lastTouch>lastReview?lastTouch:lastReview):lastTouch||lastReview;
      return!latest||Math.ceil((new Date()-latest)/864e5)>90});
    // Upcoming earnings
    var upcoming=portfolio.filter(function(c){return c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)>=0&&dU(c.earningsDate)<=14}).sort(function(a,b){return dU(a.earningsDate)-dU(b.earningsDate)});
    // Build smart actions
    var actions=[];
    if(upcoming.length>0){var uc=upcoming[0];actions.push({icon:"target",color:K.amb,title:uc.ticker+" earnings in "+dU(uc.earningsDate)+"d",desc:"Review your "+uc.kpis.length+" KPIs and thesis before results drop",action:"Prepare",onClick:function(){setSelId(uc.id);setDetailTab("dossier");setPage("dashboard")}})}
    var noThesis=portfolio.filter(function(c){return!c.thesisNote});
    if(noThesis.length>0)actions.push({icon:"lightbulb",color:K.grn,title:noThesis.length+" holding"+(noThesis.length>1?"s":"")+" without a thesis",desc:"Every position needs a written reason to own it",action:"Write thesis",onClick:function(){setSelId(noThesis[0].id);setModal({type:"thesis"})}});
    if(staleTheses.length>0)actions.push({icon:"clock",color:K.amb,title:staleTheses.length+" thesis"+(staleTheses.length>1?" reviews":"")+" overdue",desc:"Quarterly review keeps your thinking sharp",action:"Review",onClick:function(){setSelId(staleTheses[0].id);setModal({type:"thesis"})}});
    var noKpi=portfolio.filter(function(c){return c.kpis.length===0});
    if(!currentWeekReviewed)actions.push({icon:"shield",color:K.grn,title:"Weekly review due",desc:"Confirm conviction across "+portfolio.length+" holdings — takes 3 minutes",action:"Start Review",onClick:function(){setPage("review")}});
    if(noKpi.length>0)actions.push({icon:"bar",color:K.blue,title:noKpi.length+" holding"+(noKpi.length>1?"s":"")+" with no KPIs",desc:"Define the metrics that prove or disprove your thesis",action:"Add KPIs",onClick:function(){setSelId(noKpi[0].id);setDetailTab("dossier");setPage("dashboard")}});
    var noConv=portfolio.filter(function(c){return!c.conviction||c.conviction===0});
    if(noConv.length>0&&actions.length<5)actions.push({icon:"trending",color:"#9333EA",title:noConv.length+" holding"+(noConv.length>1?"s":"")+" unrated",desc:"Rate your conviction 1–10 for each position",action:"Rate",onClick:function(){setSelId(noConv[0].id);setModal({type:"conviction"})}});
    var noMoat=portfolio.filter(function(c){var mt=c.moatTypes||{};return!Object.keys(mt).some(function(k){return mt[k]&&mt[k].active})});
    if(noMoat.length>0&&actions.length<5)actions.push({icon:"castle",color:K.acc,title:noMoat.length+" holding"+(noMoat.length>1?"s":"")+" with no moat classified",desc:"Identify competitive advantages to track over time",action:"Classify",onClick:function(){setSelId(noMoat[0].id);setSubPage("moat");setPage("dashboard")}});
    // Tabs
    var _ht=useState("command"),ht=_ht[0],setHt=_ht[1];
    var _lens2=useState("smith"),activeLens=_lens2[0],setActiveLens=_lens2[1];
    var _ld=useState({}),lensData=_ld[0],setLensData=_ld[1];
    var _lensLoading=useState(false),lensLoading=_lensLoading[0],setLensLoading=_lensLoading[1];
    // Auto-fetch financial metrics when Lenses tab is opened
    useEffect(function(){
      if(ht!=="lenses")return;
      var portCos2=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
      var needsFetch=portCos2.filter(function(c){return!lensData[c.ticker]});
      if(needsFetch.length===0)return;
      setLensLoading(true);
      var fetchAll=async function(){
        var data=Object.assign({},lensData);
        for(var i=0;i<needsFetch.length;i++){
          var c=needsFetch[i];
          try{
            var fin=await fetchFinancialStatements(c.ticker,"annual");
            if(fin){
              var moatResult=calcMoatFromData(fin);
              if(moatResult&&moatResult.metrics){
                var vals={};
                moatResult.metrics.forEach(function(m){
                  var num=parseFloat(String(m.value).replace(/[^0-9.\-]/g,""));
                  vals[m.id]={score:m.score,value:m.value,num:isNaN(num)?null:num};
                });
                data[c.ticker]=vals;
              }
            }
          }catch(e){console.warn("[Lenses] fetch error for",c.ticker,e)}
        }
        setLensData(data);setLensLoading(false);
      };fetchAll();
    },[ht,cos.length]);
    // Document vault (kept from before)
    var allDocs=[];cos.forEach(function(c){(c.docs||[]).forEach(function(d){allDocs.push(Object.assign({},d,{ticker:c.ticker,companyName:c.name,companyId:c.id,domain:c.domain}))})});
    cos.forEach(function(c){if(c.thesisNote){allDocs.push({id:"thesis-"+c.id,title:"Investment Thesis",content:c.thesisNote,folder:"why-i-own",ticker:c.ticker,companyName:c.name,companyId:c.id,domain:c.domain,updatedAt:c.thesisUpdatedAt||null,isThesis:true})}});
    // Auto-populate IR library from earnings history
    cos.forEach(function(c){(c.earningsHistory||[]).forEach(function(e,ei){
      allDocs.push({id:"earnings-"+c.id+"-"+ei,title:e.quarter+" Earnings"+(e.sourceLabel?" — "+e.sourceLabel:""),content:e.summary||"",folder:"reports",ticker:c.ticker,companyName:c.name,companyId:c.id,domain:c.domain,updatedAt:e.checkedAt||null,isAutoIR:true,irData:{url:e.sourceUrl||c.irUrl||"",quarter:e.quarter}})})});
    allDocs.sort(function(a,b){return(b.updatedAt||"")<(a.updatedAt||"")?-1:1});
    var _hf=useState("all"),hf=_hf[0],setHf=_hf[1];
    var _hc=useState("all"),hc=_hc[0],setHc=_hc[1];
    var _hd=useState(null),hd=_hd[0],setHd=_hd[1];
    var companies=cos.map(function(c){return{ticker:c.ticker,id:c.id}});
    var filteredDocs=allDocs.filter(function(d){return(hf==="all"||d.folder===hf)&&(hc==="all"||d.companyId===parseInt(hc))});
    var selectedDoc=hd?allDocs.find(function(d){return d.id===hd}):null;
    function exportDocPDF(doc){
      var formatted=autoFormat(doc.content);
      var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+doc.ticker+' — '+doc.title+'</title>';
      html+='<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">';
      html+='<style>@page{size:A4;margin:24mm 20mm 20mm 20mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Inter",sans-serif;color:#1a1a2e;padding:0;background:#fff}.page{max-width:680px;margin:0 auto;padding:40px 48px}';
      html+='.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #1a1a2e;margin-bottom:28px}';
      html+='.hdr h1{font-family:"Playfair Display",Georgia,serif;font-size:28px;font-weight:700;color:#1a1a2e;letter-spacing:-.5px;line-height:1.1}';
      html+='.hdr .sub{font-size:13px;color:#6b7280;margin-top:4px}.hdr .logo{font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;letter-spacing:2px;color:#1a1a2e;text-transform:uppercase;text-align:right}';
      html+='.hdr .logo-sub{font-family:"Inter",sans-serif;font-size:9px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-top:2px;text-align:right}';
      html+='.hdr .date{font-family:"JetBrains Mono",monospace;font-size:10px;color:#6b7280;margin-top:8px;text-align:right}';
      html+='.content{font-family:"Playfair Display",Georgia,serif;font-size:14px;line-height:1.9;color:#1a1a2e}';
      html+='.content p{margin-bottom:18px}';
      html+='.footer{margin-top:40px;padding-top:14px;border-top:2px solid #1a1a2e;display:flex;justify-content:space-between;align-items:center}';
      html+='.footer-l{font-family:"JetBrains Mono",monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#1a1a2e;text-transform:uppercase}';
      html+='.footer-r{font-size:9px;color:#9ca3af;text-align:right}';
      html+='@media print{.page{padding:0}}</style></head><body><div class="page">';
      html+='<div class="hdr"><div><h1>'+doc.ticker+' — '+doc.title+'</h1>';
      html+='<div class="sub">'+doc.companyName+'</div></div>';
      html+='<div><div class="logo"><svg width="12" height="12" viewBox="0 0 100 100" style="vertical-align:middle;margin-right:3px"><rect width="100" height="100" rx="16" fill="#1a1a2e"/><path d="M50 18L82 78H18L50 18Z" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"/><path d="M50 38L66 70H34L50 38Z" fill="white"/></svg>ThesisAlpha</div>';
      html+='<div class="logo-sub">Owner’s Hub</div>';
      html+='<div class="date">'+(doc.updatedAt?new Date(doc.updatedAt).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}))+'</div></div></div>';
      html+='<div class="content">';
      formatted.split("\n\n").forEach(function(p){if(p.trim())html+='<p>'+p.replace(/\n/g,"<br/>")+'</p>'});
      html+='</div>';
      html+='<div class="footer"><div class="footer-l"><svg width="12" height="12" viewBox="0 0 100 100" style="vertical-align:middle;margin-right:3px"><rect width="100" height="100" rx="16" fill="#1a1a2e"/><path d="M50 18L82 78H18L50 18Z" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"/><path d="M50 38L66 70H34L50 38Z" fill="white"/></svg>ThesisAlpha</div>';
      html+='<div class="footer-r"><div style="font-family:JetBrains Mono,monospace;font-size:10px;color:#6b7280">'+doc.ticker+' · '+doc.companyName+'</div>';
      html+='<div>'+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})+'</div></div></div>';
      html+='</div></body></html>';
      var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.print()},600)}

    // Score level names + next milestone (uses shared LEVELS)
    var currentLevel=getLevel(os.total);
    var nextMilestone=currentLevel.next;var pctToNext=nextMilestone>currentLevel.min?Math.round((os.total-currentLevel.min)/(nextMilestone-currentLevel.min)*100):100;

    return<div className="ta-page-pad" style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:1000}}>
      {/* Header with score ring + unified progress */}
      <div style={{padding:"28px 0 24px",display:"flex",alignItems:isMobile?"flex-start":"center",gap:isMobile?16:24,flexDirection:isMobile?"column":"row"}}>
        <div style={{display:"flex",alignItems:"center",gap:20,flex:1}}>
          <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
            <svg width={80} height={80} viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke={K.bdr} strokeWidth="5"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke={os.total>=85?"#FFD700":os.total>=70?K.grn:os.total>=50?K.amb:os.total>=25?K.blue:K.red} strokeWidth="5" strokeDasharray={Math.round(os.total/100*214)+" 214"} strokeLinecap="round" transform="rotate(-90 40 40)"/></svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontSize:24,fontWeight:700,color:os.total>=85?"#FFD700":os.total>=70?K.grn:os.total>=50?K.amb:os.total>=25?K.blue:K.red,fontFamily:fm,lineHeight:1}}>{os.total}</div>
              <div style={{fontSize:8,color:K.dim,fontFamily:fm}}>/ 100</div></div></div>
          <div><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>Owner's Hub</h1>
            <div style={{fontSize:13,color:K.mid,marginTop:2}}>Process Health <span style={{color:K.dim}}>·</span> <span style={{fontSize:11,color:os.total>=80?K.grn:os.total>=50?K.amb:K.red}}>{os.total>=80?"Strong":os.total>=50?"Improving":"Needs attention"}</span></div>
            {/* Progress bar + level name */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8}}>
              <div style={{width:140,height:4,borderRadius:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:pctToNext+"%",borderRadius:2,background:os.total>=85?"#FFD700":os.total>=70?K.grn:os.total>=50?K.amb:K.blue,transition:"width .3s"}}/></div>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{currentLevel.icon} {currentLevel.name}</span>
              <span style={{fontSize:9,color:K.dim,fontFamily:fm}}>{xp.total.toLocaleString()} pts</span>
            </div></div></div>
        {/* Quick stats — consolidated */}
        <div style={{display:"flex",gap:isMobile?12:16}}>
          <div style={{textAlign:"center",padding:"8px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10}}>
            <div style={{fontSize:20,fontWeight:700,color:streak>0?K.grn:K.dim,fontFamily:fm}}>{streak>0?String.fromCodePoint(0x1F525)+" ":""}{streak}</div>
            <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>day streak</div></div>
          <div style={{textAlign:"center",padding:"8px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10}}>
            <div style={{fontSize:20,fontWeight:700,color:dqPct>=70?K.grn:dqPct>=50?K.amb:scored.length>0?K.red:K.dim,fontFamily:fm}}>{scored.length>0?dqPct+"%":"—"}</div>
            <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>batting avg</div></div>
          <div style={{textAlign:"center",padding:"8px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10}}>
            <div style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fm}}>{allDecs.length}</div>
            <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>decisions</div></div></div></div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid "+K.bdr}}>
        {[{id:"command",l:"Command Center",icon:"trending"},{id:"community",l:"Community",icon:"users"},{id:"lenses",l:"Investor Lenses",icon:"search"},{id:"journal",l:"Research Journal",icon:"book"},{id:"docs",l:"Research Trail",icon:"file"},{id:"guide",l:"How It Works",icon:"lightbulb"}].map(function(tab){
          return<button key={tab.id} onClick={function(){setHt(tab.id)}} style={{display:"flex",alignItems:"center",gap:6,padding:isMobile?"10px 12px":"10px 20px",fontSize:12,fontFamily:fm,fontWeight:ht===tab.id?600:400,color:ht===tab.id?K.acc:K.dim,background:"transparent",border:"none",borderBottom:ht===tab.id?"2px solid "+K.acc:"2px solid transparent",cursor:"pointer",marginBottom:-1}}>
            <IC name={tab.icon} size={12} color={ht===tab.id?K.acc:K.dim}/>{tab.l}</button>})}</div>

      {/* ═══ COMMAND CENTER TAB ═══ */}
      {ht==="command"&&<div>
        {/* ═══ 7-DAY QUEST ═══ */}
        {(function(){
          var wk=getWeekId();
          var qCompleted=questData.weekId===wk?(questData.completed||[]):[];
          // Generate quests: mix of portfolio-gap fixes + rotating challenges
          var quests=[];
          var noThesis=portfolio.filter(function(c2){return!c2.thesisNote||c2.thesisNote.trim().length<20});
          var noKpi=portfolio.filter(function(c2){return c2.kpis.length===0});
          var noConv=portfolio.filter(function(c2){return!c2.conviction||c2.conviction===0});
          var noMoat=portfolio.filter(function(c2){var mt=c2.moatTypes||{};return!Object.keys(mt).some(function(k){return mt[k]&&mt[k].active})});
          var staleT=portfolio.filter(function(c2){if(!c2.thesisUpdatedAt)return false;return Math.ceil((new Date()-new Date(c2.thesisUpdatedAt))/864e5)>90});
          function tks(arr){return arr.slice(0,2).map(function(c2){return c2.ticker}).join(", ")+(arr.length>2?" + "+(arr.length-2):"");}
          // Fixed quests from portfolio gaps
          if(noThesis.length>0)quests.push({id:"thesis",text:"Write a thesis for "+tks(noThesis),icon:"lightbulb",color:K.acc,done:false,onClick:function(){setSelId(noThesis[0].id);setDetailTab("dossier");setPage("dashboard");setModal({type:"thesis"})}});
          if(noKpi.length>0)quests.push({id:"kpi",text:"Add KPIs for "+tks(noKpi),icon:"target",color:K.blue,done:false,onClick:function(){setSelId(noKpi[0].id);setDetailTab("dossier");setPage("dashboard");setTimeout(function(){setModal({type:"kpi"})},100)}});
          if(noConv.length>0)quests.push({id:"conv",text:"Rate conviction for "+tks(noConv),icon:"trending",color:K.amb,done:false,onClick:function(){setSelId(noConv[0].id);setPage("dashboard");setModal({type:"conviction"})}});
          if(staleT.length>0)quests.push({id:"stale",text:"Review stale thesis for "+tks(staleT),icon:"clock",color:K.red,done:false,onClick:function(){setSelId(staleT[0].id);setDetailTab("dossier");setPage("dashboard");setModal({type:"thesis"})}});
          if(noMoat.length>0&&quests.length<4)quests.push({id:"moat",text:"Classify moat for "+tks(noMoat),icon:"castle",color:"#9333EA",done:false,onClick:function(){setSelId(noMoat[0].id);setSubPage("moat");setPage("dashboard")}});
          if(!currentWeekReviewed)quests.push({id:"review",text:"Complete your Weekly Review",icon:"shield",color:K.grn,done:false,onClick:function(){setPage("review")}});
          // Rotating challenges based on week seed
          var weekNum=parseInt(wk.replace(/\D/g,""))||0;
          var rotating=[
            {id:"r_oldest",text:"Review your oldest thesis",icon:"book",color:K.blue,done:false,check:function(){return portfolio.length>0&&portfolio.every(function(c2){return!c2.thesisUpdatedAt||Math.ceil((new Date()-new Date(c2.thesisUpdatedAt))/864e5)<7})},onClick:function(){var oldest=portfolio.filter(function(c2){return c2.thesisNote}).sort(function(a,b){return(a.thesisUpdatedAt||"")>(b.thesisUpdatedAt||"")?1:-1})[0];if(oldest){setSelId(oldest.id);setPage("dashboard");setModal({type:"thesis"})}}},
            {id:"r_kpiall",text:"Ensure every holding has 2+ KPIs",icon:"target",color:K.blue,done:false,check:function(){return portfolio.every(function(c2){return c2.kpis.length>=2})},onClick:function(){var t=portfolio.find(function(c2){return c2.kpis.length<2});if(t){setSelId(t.id);setDetailTab("dossier");setPage("dashboard")}}},
            {id:"r_convall",text:"Rate conviction for all holdings",icon:"trending",color:K.amb,done:false,check:function(){return portfolio.every(function(c2){return c2.conviction>0})},onClick:function(){var t=portfolio.find(function(c2){return!c2.conviction});if(t){setSelId(t.id);setPage("dashboard");setModal({type:"conviction"})}}},
            {id:"r_decision",text:"Log a BUY, SELL, or HOLD decision",icon:"edit",color:K.acc,done:false,check:function(){var recent=[];cos.forEach(function(c2){(c2.decisions||[]).forEach(function(d){if(d.date&&new Date(d.date)>new Date(Date.now()-604800000))recent.push(d)})});return recent.length>0},onClick:function(){if(portfolio[0]){setSelId(portfolio[0].id);setDetailTab("research");setPage("dashboard")}}},
            {id:"r_export",text:"Export a research note",icon:"file",color:K.mid,done:false,check:function(){return false},onClick:function(){if(portfolio[0]){setSelId(portfolio[0].id);setDetailTab("dossier");setPage("dashboard")}}},
            {id:"r_moatall",text:"Classify moats for all holdings",icon:"castle",color:"#9333EA",done:false,check:function(){return portfolio.every(function(c2){var mt=c2.moatTypes||{};return Object.keys(mt).some(function(k){return mt[k]&&mt[k].active})})},onClick:function(){var t=portfolio.find(function(c2){var mt=c2.moatTypes||{};return!Object.keys(mt).some(function(k){return mt[k]&&mt[k].active})});if(t){setSelId(t.id);setSubPage("moat");setPage("dashboard")}}}
          ];
          // Pick 2 rotating based on week seed
          var available2=rotating.filter(function(r){return!quests.find(function(q){return q.id===r.id.replace("r_","")})});
          var pick1=available2[weekNum%available2.length];
          var pick2=available2[(weekNum+3)%available2.length];
          if(pick1&&pick2&&pick1.id===pick2.id)pick2=available2[(weekNum+1)%available2.length];
          if(pick1)quests.push(pick1);
          if(pick2&&pick2.id!==pick1.id)quests.push(pick2);
          // Limit to 5 quests max
          quests=quests.slice(0,5);
          // Mark completed
          quests.forEach(function(q){
            if(qCompleted.indexOf(q.id)>=0)q.done=true;
            // Auto-detect completion for fixed quests
            if(q.id==="thesis"&&noThesis.length===0)q.done=true;
            if(q.id==="kpi"&&noKpi.length===0)q.done=true;
            if(q.id==="conv"&&noConv.length===0)q.done=true;
            if(q.id==="stale"&&staleT.length===0)q.done=true;
            if(q.id==="moat"&&noMoat.length===0)q.done=true;
            if(q.id==="review"&&currentWeekReviewed)q.done=true;
            if(q.check&&q.check())q.done=true});
          var doneCount=quests.filter(function(q){return q.done}).length;
          var allDone2=doneCount===quests.length&&quests.length>0;
          var questPct=quests.length>0?Math.round(doneCount/quests.length*100):0;
          // Check if quest chest already claimed this week
          var questChestClaimed=questData.weekId===wk&&(questData.chestClaimed||false);
          return<div style={{marginBottom:20}}>
            {/* Quest header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:K.txt}}>7-Day Quest</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>Resets every Monday · {doneCount}/{quests.length} complete</div></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:80,height:6,borderRadius:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:questPct+"%",borderRadius:3,background:allDone2?K.grn:K.acc,transition:"width .5s"}}/></div>
                <span style={{fontSize:11,fontWeight:600,color:allDone2?K.grn:K.acc,fontFamily:fm}}>{questPct}%</span></div></div>
            {/* Quest list */}
            <div style={{display:"grid",gap:6}}>
              {quests.map(function(q){return<div key={q.id} className={q.done?"":"ta-card"} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:q.done?K.grn+"06":K.card,border:"1px solid "+(q.done?K.grn+"20":K.bdr),borderRadius:10,cursor:q.done?"default":"pointer",opacity:q.done?.7:1}} onClick={q.done?undefined:q.onClick}>
                <div style={{width:24,height:24,borderRadius:"50%",border:"2px solid "+(q.done?K.grn:q.color),background:q.done?K.grn:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {q.done?<IC name="check" size={12} color="#fff" strokeWidth={3}/>:<IC name={q.icon} size={10} color={q.color}/>}</div>
                <div style={{flex:1,fontSize:12,color:q.done?K.dim:K.txt,textDecoration:q.done?"line-through":"none"}}>{q.text}</div>
                {!q.done&&<span style={{fontSize:10,color:q.color,fontFamily:fm,fontWeight:600,flexShrink:0}}>+8 pts</span>}
                {q.done&&<span style={{fontSize:10,color:K.grn,fontFamily:fm}}>{"✓"}</span>}
              </div>})}</div>
            {/* Quest reward preview */}
            {!allDone2&&<div style={{marginTop:12,padding:"10px 16px",background:K.bg,borderRadius:8,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:28,height:28,borderRadius:8,background:"#a78bfa15",display:"flex",alignItems:"center",justifyContent:"center",animation:"glowPulse 2s ease-in-out infinite"}}><IC name="dice" size={14} color="#a78bfa"/></div>
              <div style={{fontSize:11,color:K.dim}}>Complete all quests to unlock a <strong style={{color:"#a78bfa"}}>guaranteed Uncommon+</strong> chest reward</div></div>}
            {/* Quest complete + claim */}
            {allDone2&&!questChestClaimed&&<div style={{marginTop:12,textAlign:"center",padding:"20px",background:"linear-gradient(135deg,"+K.acc+"08,#a78bfa08)",border:"1px solid #a78bfa30",borderRadius:12}}>
              <div style={{fontSize:20,marginBottom:8}}>{String.fromCodePoint(0x1F3C6)}</div>
              <div style={{fontSize:14,fontWeight:600,color:K.txt,marginBottom:4}}>All quests complete!</div>
              <div style={{fontSize:11,color:K.dim,marginBottom:12}}>You've earned a guaranteed Uncommon or Rare chest</div>
              <button onClick={function(){setQuestData(function(p){var n=Object.assign({},p,{weekId:getWeekId(),chestClaimed:true});try{localStorage.setItem("ta-quests",JSON.stringify(n))}catch(e){}return n});setTimeout(function(){openQuestChest()},300)}} style={Object.assign({},S.btnP,{padding:"10px 28px",fontSize:13,background:"#a78bfa",borderColor:"#a78bfa"})}>Open Quest Reward</button></div>}
            {allDone2&&questChestClaimed&&<div style={{marginTop:12,textAlign:"center",padding:"14px",background:K.grn+"06",border:"1px solid "+K.grn+"20",borderRadius:8}}>
              <div style={{fontSize:12,color:K.grn,fontWeight:500}}>Quest reward claimed this week ✓</div>
              <div style={{fontSize:10,color:K.dim}}>New quests arrive Monday</div></div>}
          </div>})()}

        {/* Upcoming earnings */}
        {upcoming.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:20}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.amb,marginBottom:10,fontFamily:fm}}>Earnings This Fortnight</div>
          {upcoming.map(function(c){var d3=dU(c.earningsDate);return<div key={c.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid "+K.bdr,cursor:"pointer"}} onClick={function(){setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}>
            <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
            <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</span>
            <span style={{fontSize:11,color:K.dim,flex:1}}>{c.name}</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.kpis.length} KPIs</span>
            <span style={{fontSize:12,fontWeight:700,color:d3<=3?K.red:K.amb,fontFamily:fm,minWidth:40,textAlign:"right"}}>{d3===0?"Today":d3===1?"1d":d3+"d"}</span></div>})}</div>}

        {/* Recent decisions (last 5) */}
        {allDecs.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm}}>Recent Decisions</div>
            <button onClick={function(){setHt("journal")}} style={{fontSize:10,color:K.acc,background:"none",border:"none",cursor:"pointer",fontFamily:fm}}>View all {"→"}</button></div>
          {allDecs.sort(function(a,b){return(b.date||"")<(a.date||"")?-1:1}).slice(0,5).map(function(dec,i){
            var clr=dec.action==="BUY"||dec.action==="ADD"?K.grn:dec.action==="SELL"||dec.action==="TRIM"?K.red:dec.action==="HOLD"?K.blue:K.amb;
            return<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<4?"1px solid "+K.bdr:"none"}}>
              <span style={{fontSize:9,fontWeight:700,color:clr,background:clr+"12",padding:"2px 8px",borderRadius:3,fontFamily:fm,minWidth:36,textAlign:"center"}}>{dec.action}</span>
              <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{dec.ticker}</span>
              <span style={{fontSize:11,color:K.dim,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dec.reasoning?dec.reasoning.substring(0,60)+"...":""}</span>
              {dec.outcome&&<span style={{fontSize:9,color:dec.outcome==="right"?K.grn:dec.outcome==="wrong"?K.red:dec.outcome==="lucky"?"#9333EA":K.amb,fontFamily:fm,fontWeight:600}}>{dec.outcome}</span>}
              <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{dec.date?fD(dec.date):""}</span></div>})}</div>}
        {/* ═══ COMMUNITY BENCHMARK ═══ */}
        <div style={{marginTop:24}}>
          <div style={S.sec}><IC name="users" size={14} color={K.dim}/>Community</div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
            <div style={{display:"flex",alignItems:isMobile?"flex-start":"center",gap:16,flexDirection:isMobile?"column":"row"}}>
              {/* Your score */}
              <div style={{flex:1}}>
                <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>YOUR PROCESS SCORE</div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:36,fontWeight:800,color:globalOS.total>=70?K.grn:globalOS.total>=40?K.amb:K.red,fontFamily:fm}}>{globalOS.total}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:K.txt}}>{currentLevel.icon} {currentLevel.name}</div>
                    <div style={{fontSize:11,color:K.dim}}>Top investors maintain 70+ process scores</div></div></div>
              </div>
              {/* Benchmark */}
              <div style={{flex:1,padding:"16px 20px",background:K.bg,borderRadius:10,textAlign:"center"}}>
                <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>COMMUNITY BENCHMARK</div>
                <div style={{fontSize:13,color:K.mid,lineHeight:1.7,marginBottom:8}}>ThesisAlpha is in early access. As more owners join, you'll see how your process compares.</div>
                <div style={{display:"flex",justifyContent:"center",gap:12}}>
                  <div style={{padding:"6px 12px",background:K.card,borderRadius:6,border:"1px solid "+K.bdr}}>
                    <div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>{portfolio.length}</div>
                    <div style={{fontSize:8,color:K.dim}}>Your holdings</div></div>
                  <div style={{padding:"6px 12px",background:K.card,borderRadius:6,border:"1px solid "+K.bdr}}>
                    <div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>{weeklyReviews.length}</div>
                    <div style={{fontSize:8,color:K.dim}}>Reviews done</div></div>
                  <div style={{padding:"6px 12px",background:K.card,borderRadius:6,border:"1px solid "+K.bdr}}>
                    <div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>{allDecs.length}</div>
                    <div style={{fontSize:8,color:K.dim}}>Decisions logged</div></div></div>
                <div style={{fontSize:9,color:K.acc,marginTop:10,fontFamily:fm}}>{"🌱"} You're among the first owners. Early adopters shape the community.</div>
              </div></div>
          </div>
        </div>
      </div>}

      {/* ═══ COMMUNITY TAB ═══ */}
      {ht==="community"&&<div>
        {/* Community header */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:18,fontWeight:500,color:K.txt,fontFamily:fh,marginBottom:6}}>Community Benchmarks</div>
          <div style={{fontSize:12,color:K.dim,lineHeight:1.7}}>See how your process compares to other ThesisAlpha owners. All data is anonymous — only aggregate scores are shared.</div></div>

        {/* ── Process Score Benchmark ── */}
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <IC name="bar" size={16} color={K.acc}/>
            <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>Process Score Ranking</div></div>
          {/* Your score */}
          <div style={{display:"flex",alignItems:"center",gap:16,padding:"14px 18px",background:K.acc+"06",border:"1px solid "+K.acc+"20",borderRadius:10,marginBottom:16}}>
            <div style={{position:"relative",width:48,height:48,flexShrink:0}}>
              <svg width={48} height={48} viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke={K.bdr} strokeWidth="3"/><circle cx="24" cy="24" r="20" fill="none" stroke={os.total>=70?K.grn:os.total>=40?K.amb:K.acc} strokeWidth="3" strokeDasharray={Math.round(os.total/100*126)+" 126"} strokeLinecap="round" transform="rotate(-90 24 24)"/></svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:os.total>=70?K.grn:os.total>=40?K.amb:K.acc,fontFamily:fm}}>{os.total}</div></div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:K.txt}}>Your Process Score</div>
              <div style={{fontSize:11,color:K.dim}}>{currentLevel.name} — {os.total>=80?"Top-tier discipline":os.total>=50?"Building strong habits":"Room to grow"}</div></div></div>
          {/* Benchmark placeholder — honest pre-launch state */}
          <div style={{background:K.bg,borderRadius:10,padding:"24px 20px",textAlign:"center",border:"1px dashed "+K.bdr}}>
            <div style={{fontSize:28,marginBottom:8,opacity:.6}}>{String.fromCodePoint(0x1F4CA)}</div>
            <div style={{fontSize:13,fontWeight:600,color:K.txt,marginBottom:4}}>Benchmarks coming soon</div>
            <div style={{fontSize:11,color:K.dim,lineHeight:1.6,maxWidth:340,margin:"0 auto"}}>Once more owners join ThesisAlpha, you'll see how your process score ranks against the community — percentile, average, and distribution.</div></div>
        </div>

        {/* ── Conviction Consensus ── */}
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <IC name="trending" size={16} color={K.grn}/>
            <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>Conviction Consensus</div></div>
          <div style={{fontSize:11,color:K.dim,marginBottom:16,lineHeight:1.6}}>See how other owners rate their conviction on the same companies you hold. Are you more bullish or cautious than the crowd?</div>
          {/* Per-holding conviction comparison */}
          {portfolio.length>0?<div>
            {portfolio.map(function(c2){var conv2=c2.conviction||0;
              return<div key={c2.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid "+K.bdr+"30"}}>
                <CoLogo domain={c2.domain} ticker={c2.ticker} size={24}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c2.ticker}</div>
                  <div style={{fontSize:10,color:K.dim}}>{c2.name}</div></div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:700,color:conv2>=7?K.grn:conv2>=4?K.amb:K.red,fontFamily:fm}}>{conv2>0?conv2+"/10":"—"}</div>
                  <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>Your rating</div></div>
                <div style={{textAlign:"right",minWidth:60}}>
                  <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>—</div>
                  <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>Community</div></div>
              </div>})}
            <div style={{textAlign:"center",padding:"12px 0",fontSize:10,color:K.dim,fontStyle:"italic"}}>Community averages will appear as more owners rate these companies.</div>
          </div>:<div style={{textAlign:"center",padding:"20px",color:K.dim,fontSize:12}}>Add companies to your portfolio to see conviction comparisons.</div>}
        </div>

        {/* ── Community Activity ── */}
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <IC name="users" size={16} color={K.blue}/>
            <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>Community Activity</div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
            <div style={{textAlign:"center",padding:"16px 12px",background:K.bg,borderRadius:8}}>
              <div style={{fontSize:22,fontWeight:700,color:K.dim,fontFamily:fm}}>—</div>
              <div style={{fontSize:9,color:K.dim,marginTop:4}}>Active Owners</div></div>
            <div style={{textAlign:"center",padding:"16px 12px",background:K.bg,borderRadius:8}}>
              <div style={{fontSize:22,fontWeight:700,color:K.dim,fontFamily:fm}}>—</div>
              <div style={{fontSize:9,color:K.dim,marginTop:4}}>Reviews This Week</div></div>
            <div style={{textAlign:"center",padding:"16px 12px",background:K.bg,borderRadius:8}}>
              <div style={{fontSize:22,fontWeight:700,color:K.dim,fontFamily:fm}}>—</div>
              <div style={{fontSize:9,color:K.dim,marginTop:4}}>Theses Written</div></div>
          </div>
          <div style={{background:K.acc+"06",border:"1px solid "+K.acc+"15",borderRadius:8,padding:"12px 16px",textAlign:"center"}}>
            <div style={{fontSize:11,color:K.acc,fontWeight:600,marginBottom:2}}>You're an early adopter</div>
            <div style={{fontSize:10,color:K.dim,lineHeight:1.6}}>Community features are building as more investors join. Your early activity helps shape how benchmarks work for everyone.</div></div>
        </div>

        {/* ── Shared Thesis Library (future) ── */}
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <IC name="book" size={16} color={"#9333EA"}/>
            <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>Thesis Library</div>
            <span style={{fontSize:9,color:"#9333EA",background:"#9333EA15",padding:"2px 8px",borderRadius:4,fontFamily:fm,fontWeight:600}}>COMING SOON</span></div>
          <div style={{fontSize:12,color:K.dim,lineHeight:1.7,marginBottom:12}}>Read how other owners think about the companies you hold. No price targets — just investment reasoning, moat analysis, and sell criteria shared by real owners.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {["Share your thesis","Read others' reasoning","Learn new frameworks"].map(function(f2){return<div key={f2} style={{padding:"10px 12px",background:K.bg,borderRadius:6,textAlign:"center"}}>
              <div style={{fontSize:10,color:K.mid,lineHeight:1.5}}>{f2}</div></div>})}</div>
        </div>
      </div>}

      {/* ═══ INVESTOR LENSES TAB ═══ */}
      {ht==="lenses"&&<div>
        {(function(){
          // Parse numeric value from moat cache strings like "45.2%", "+12.3%", "Net Cash", "1.5x"
          function parseVal(v){if(v==null)return null;if(typeof v==="number")return v;var s=String(v).replace(/[^\d.\-]/g,"");return s?parseFloat(s):null}
          // Lens definitions with ACTUAL S&P 500 benchmarks
          var LENSES=[
            {id:"smith",name:"Terry Smith",subtitle:"Fundsmith Filter",unlock:0,quote:"Only invest in good companies, don’t overpay, do nothing.",
              metrics:[
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:25,desc:"Pricing power — can the business charge a premium?"},
                {id:"roic",label:"ROCE / ROIC",sp500:15,unit:"%",weight:25,desc:"Returns on capital — is the business capital-efficient?"},
                {id:"opLeverage",label:"Operating Margin",sp500:13,unit:"%",weight:20,desc:"Operational efficiency — does scale create profit?"},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:20,desc:"Earnings quality — does profit turn into real cash?"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:10,desc:"Financial strength — lower is better",invert:true}
              ]},
            {id:"kantesaria",name:"Dev Kantesaria",subtitle:"Compounder Checklist",unlock:0,quote:"We look for businesses that can compound at 15%+ with minimal risk of permanent loss.",
              metrics:[
                {id:"revGrowth",label:"Revenue Growth",sp500:5,unit:"%",weight:20,desc:"Organic demand growth — is the TAM expanding?"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:20,desc:"Above 60% signals a capital-light moat"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:15,desc:"Bottom-line profitability after all costs"},
                {id:"fcfConversion",label:"FCF Conversion",sp500:85,unit:"%",weight:20,desc:"Free cash flow quality — the real yield"},
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:15,desc:"Capital efficiency — the engine of compounding"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:10,desc:"Low debt = low risk of permanent impairment",invert:true}
              ]},
            {id:"munger",name:"Charlie Munger",subtitle:"Quality at Scale",unlock:4,quote:"A great business at a fair price is superior to a fair business at a great price.",
              metrics:[
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:25,desc:"The single best measure of a moat"},
                {id:"grossMargin",label:"Pricing Power (Gross Margin)",sp500:45,unit:"%",weight:20,desc:"Can they raise prices without losing customers?"},
                {id:"opLeverage",label:"Operating Margin",sp500:13,unit:"%",weight:15,desc:"Do margins expand as revenue grows?"},
                {id:"revGrowth",label:"Revenue Growth",sp500:5,unit:"%",weight:15,desc:"Sustainable growth within circle of competence"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:15,desc:"Trending up = strengthening position"},
                {id:"rdIntensity",label:"R&D / Revenue",sp500:3,unit:"%",weight:10,desc:"Reinvesting to widen the moat"}
              ]},
            {id:"buffett",name:"Warren Buffett",subtitle:"Owner Earnings",unlock:8,quote:"It’s far better to buy a wonderful company at a fair price than a fair company at a wonderful price.",
              metrics:[
                {id:"netMargin",label:"Net Margin (Owner Earnings)",sp500:12,unit:"%",weight:20,desc:"What the owner actually takes home"},
                {id:"roic",label:"Return on Equity",sp500:15,unit:"%",weight:20,desc:"How much profit per dollar of equity?"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:20,desc:"Conservative balance sheet = margin of safety",invert:true},
                {id:"grossMargin",label:"Gross Margin Stability",sp500:45,unit:"%",weight:20,desc:"Stable margins = durable competitive advantage"},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:20,desc:"Consistent cash generation year after year"}
              ]},
            {id:"greenblatt",name:"Joel Greenblatt",subtitle:"Magic Formula",unlock:12,quote:"Buying good businesses at bargain prices is the secret to making lots of money.",
              metrics:[
                {id:"roic",label:"Return on Capital",sp500:15,unit:"%",weight:35,desc:"The first pillar of the Magic Formula — high ROIC = good business"},
                {id:"netMargin",label:"Earnings Yield",sp500:12,unit:"%",weight:35,desc:"The second pillar — high earnings yield = bargain price"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:10,desc:"Pricing power supporting high returns"},
                {id:"fortress",label:"Debt Level",sp500:1.5,unit:"x",weight:10,desc:"Low leverage = less risk",invert:true},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:10,desc:"Real cash backing up the earnings"}
              ]},
            {id:"lynch",name:"Peter Lynch",subtitle:"Growth at a Price",unlock:16,quote:"Know what you own, and know why you own it.",
              metrics:[
                {id:"revGrowth",label:"Revenue / Earnings Growth",sp500:5,unit:"%",weight:30,desc:"The engine — is the company growing fast enough?"},
                {id:"fortress",label:"Debt Level",sp500:1.5,unit:"x",weight:20,desc:"Low debt = can survive a downturn",invert:true},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:20,desc:"Strong cash flow funds future growth"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:15,desc:"Are margins expanding as the company scales?"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:15,desc:"Is growth translating to bottom line?"}
              ]},
            {id:"davis",name:"Shelby Cullom Davis",subtitle:"Davis Double Play",unlock:20,quote:"You make most of your money in a bear market, you just don’t realize it at the time.",
              metrics:[
                {id:"revGrowth",label:"Earnings Growth",sp500:5,unit:"%",weight:25,desc:"Growing earnings = rising stock price (first play)"},
                {id:"netMargin",label:"Net Margin Expansion",sp500:12,unit:"%",weight:20,desc:"Expanding margins = multiple expansion (second play)"},
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:20,desc:"Capital efficiency sustains compounding"},
                {id:"fortress",label:"Balance Sheet Strength",sp500:1.5,unit:"x",weight:15,desc:"Survive the bear market to reap the double play",invert:true},
                {id:"fcfConversion",label:"Cash Generation",sp500:85,unit:"%",weight:10,desc:"Real cash flow backing earnings growth"},
                {id:"grossMargin",label:"Pricing Power",sp500:45,unit:"%",weight:10,desc:"Durable margins through cycles"}
              ]},
            {id:"hohn",name:"Chris Hohn",subtitle:"Activist Value",unlock:24,quote:"We invest in quality businesses with strong free cash flow and push for better capital allocation.",
              metrics:[
                {id:"fcfConversion",label:"FCF Conversion",sp500:85,unit:"%",weight:30,desc:"Free cash flow relative to earnings — the real return"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:20,desc:"Is management improving profitability?"},
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:15,desc:"Capital efficiency — allocating capital wisely?"},
                {id:"opLeverage",label:"Operating Margin",sp500:13,unit:"%",weight:20,desc:"Operational efficiency gains over time"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:15,desc:"Capital discipline",invert:true}
              ]}
          ];
          var lens=LENSES.find(function(l){return l.id===activeLens&&(l.unlock===0||(streakData.current||0)>=l.unlock)})||LENSES[0];
          var portCos=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"&&lensData[c.ticker]});
          var totalVal=0;portCos.forEach(function(c){var p=c.position||{};totalVal+=(p.shares||0)*(p.currentPrice||0)});
          // Build actual values per holding per metric
          var portMetrics=lens.metrics.map(function(m){
            var weightedVal=0;var weightSum=0;var holdingData=[];
            portCos.forEach(function(c){
              var td=lensData[c.ticker];if(!td)return;
              var metricData=td[m.id];if(!metricData)return;
              var numVal=metricData.num;var rawVal=metricData.value||"";
              // For fortress (Net Debt/EBITDA), value is like "1.5x" or "Net Cash"
              if(m.id==="fortress"&&String(rawVal).indexOf("Net Cash")>=0)numVal=-0.5;
              if(numVal!=null){
                var pos=c.position||{};var val=(pos.shares||0)*(pos.currentPrice||0);
                var w=totalVal>0?val/totalVal:1/portCos.length;
                weightedVal+=numVal*w;weightSum+=w;
                holdingData.push({ticker:c.ticker,value:numVal,raw:rawVal,weight:Math.round(w*100)})}});
            var avgVal=weightSum>0?weightedVal/weightSum:null;
            var delta=avgVal!=null?(m.invert?m.sp500-avgVal:avgVal-m.sp500):null;
            return{id:m.id,label:m.label,unit:m.unit,weight:m.weight,desc:m.desc,invert:m.invert,portfolioVal:avgVal,sp500:m.sp500,delta:delta,holdings:holdingData}});
          // Weighted composite: percentage of metrics beating S&P
          var beating=portMetrics.filter(function(m){return m.delta!=null&&m.delta>0}).length;
          var measured=portMetrics.filter(function(m){return m.portfolioVal!=null}).length;
          var beatPct=measured>0?Math.round(beating/measured*100):0;
          var fmtVal=function(v,unit,invert){
            if(v==null)return"—";
            if(unit==="x")return(v<0?"Net Cash":v.toFixed(1)+"x");
            return v.toFixed(1)+unit};
          var clr=function(delta){if(delta==null)return K.dim;return delta>0?K.grn:delta<-2?K.red:K.amb};
          return<div>
            {/* Lens selector pills */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
              {LENSES.map(function(l){var active=l.id===activeLens;var locked=l.unlock>0&&(streakData.current||0)<l.unlock;var weeksLeft=locked?l.unlock-(streakData.current||0):0;
                return<button key={l.id} onClick={function(){if(!locked)setActiveLens(l.id)}} style={{padding:"7px 14px",borderRadius:8,border:"1px solid "+(active?K.acc+"60":locked?K.bdr:K.bdr),background:active?K.acc+"10":locked?K.bg:"transparent",color:active?K.acc:locked?K.dim:K.mid,fontSize:11,fontWeight:active?600:400,cursor:locked?"default":"pointer",fontFamily:fm,opacity:locked?.6:1,position:"relative"}}>
                  {locked&&<span style={{position:"absolute",top:-4,right:-4,fontSize:10}}>{String.fromCodePoint(0x1F512)}</span>}
                  {l.name}
                  {locked&&<span style={{display:"block",fontSize:8,color:K.dim,marginTop:1}}>Week {l.unlock} streak</span>}
                </button>})}</div>
            {/* Lens header */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div><div style={{fontSize:18,fontWeight:500,color:K.txt,fontFamily:fh}}>{lens.name} <span style={{fontWeight:300,color:K.dim,fontSize:14}}>{lens.subtitle}</span></div></div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:24,fontWeight:700,color:beatPct>=70?K.grn:beatPct>=40?K.amb:K.red,fontFamily:fm}}>{beatPct}%</div>
                  <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>metrics above S&P 500</div></div></div>
              <div style={{fontSize:12,color:K.mid,fontStyle:"italic",lineHeight:1.6}}>“{lens.quote}”</div>
            </div>
            {/* Metrics table with actual values */}
            {lensLoading&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:40,textAlign:"center"}}>
              <div style={{display:"inline-block",width:20,height:20,border:"2px solid "+K.bdr,borderTopColor:K.acc,borderRadius:"50%",animation:"spin .8s linear infinite",marginBottom:12}}/>
              <div style={{fontSize:13,color:K.dim}}>Fetching financial data for your holdings…</div></div>}
            {!lensLoading&&portCos.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:40,textAlign:"center"}}>
              <div style={{fontSize:14,color:K.dim,marginBottom:8}}>No financial data yet</div>
              <div style={{fontSize:12,color:K.dim}}>Add portfolio companies with position data. Financial metrics are fetched automatically from FMP.</div></div>}
            {!lensLoading&&portCos.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{borderBottom:"2px solid "+K.bdr}}>
                  <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>Metric</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600,width:50}}>Weight</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>Your Portfolio</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>S&P 500</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>vs Benchmark</th>
                  <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>By Holding</th>
                </tr></thead>
                <tbody>{portMetrics.map(function(m){
                  return<tr key={m.id} style={{borderBottom:"1px solid "+K.bdr+"60"}}>
                    <td style={{padding:"12px 14px"}}><div style={{fontWeight:500,color:K.txt}}>{m.label}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>{m.desc}</div></td>
                    <td style={{textAlign:"center",padding:"12px 8px",fontSize:11,color:K.dim,fontFamily:fm}}>{m.weight}%</td>
                    <td style={{textAlign:"center",padding:"12px 8px"}}>
                      <div style={{fontSize:18,fontWeight:700,color:m.portfolioVal!=null?clr(m.delta):K.dim,fontFamily:fm}}>{fmtVal(m.portfolioVal,m.unit,m.invert)}</div></td>
                    <td style={{textAlign:"center",padding:"12px 8px"}}>
                      <div style={{fontSize:14,color:K.dim,fontFamily:fm}}>{fmtVal(m.sp500,m.unit)}</div></td>
                    <td style={{textAlign:"center",padding:"12px 8px"}}>
                      {m.delta!=null?<span style={{fontSize:12,fontWeight:600,color:clr(m.delta),fontFamily:fm,background:clr(m.delta)+"10",padding:"3px 10px",borderRadius:4}}>{m.delta>=0?"+":""}{m.delta.toFixed(1)}{m.unit==="x"?"x":m.unit}</span>:<span style={{color:K.dim}}>—</span>}</td>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{m.holdings.slice(0,8).map(function(h){
                        var hDelta=m.invert?m.sp500-h.value:h.value-m.sp500;
                        return<span key={h.ticker} style={{fontSize:9,fontFamily:fm,padding:"2px 6px",borderRadius:3,background:hDelta>0?K.grn+"12":hDelta>-2?K.amb+"12":K.red+"12",color:hDelta>0?K.grn:hDelta>-2?K.amb:K.red}} title={h.raw}>{h.ticker} {h.raw||fmtVal(h.value,m.unit)}</span>})}</div></td>
                  </tr>})}</tbody>
              </table>
              <div style={{padding:"12px 14px",borderTop:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:10,color:K.dim}}>Weighted by position value. {portCos.length} of {cos.filter(function(c){return(c.status||"portfolio")==="portfolio"}).length} holdings have data. Financial metrics via FMP.</div>
                <div style={{display:"flex",gap:8,fontSize:9,color:K.dim}}><span style={{color:K.grn}}>● Above S&P</span><span style={{color:K.amb}}>● Near S&P</span><span style={{color:K.red}}>● Below S&P</span></div></div>
            </div>}
          </div>})()}
      </div>}

      {/* ═══ DECISION JOURNAL TAB ═══ */}
      {ht==="journal"&&<div>
        {allDecs.length===0?<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:40,textAlign:"center"}}>
          <div style={{fontSize:14,color:K.dim,marginBottom:8}}>No decisions logged yet</div>
          <div style={{fontSize:12,color:K.dim}}>Entries appear automatically as you check earnings, update theses, and adjust conviction during weekly reviews.</div></div>:
        <div>
          <div style={{fontSize:12,color:K.dim,marginBottom:16}}>
            {allDecs.length} decision{allDecs.length>1?"s":""} logged · {scored.length} scored · {rights} right · batting avg: {scored.length>0?dqPct+"%":"N/A"}</div>
          {allDecs.sort(function(a,b){return(b.date||"")<(a.date||"")?-1:1}).map(function(dec,i){
            var clr=dec.action==="BUY"||dec.action==="ADD"?K.grn:dec.action==="SELL"||dec.action==="TRIM"?K.red:dec.action==="HOLD"?K.blue:K.amb;
            return<div key={i} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 18px",marginBottom:8,borderLeft:"3px solid "+clr}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{fontSize:10,fontWeight:700,color:clr,background:clr+"12",padding:"2px 10px",borderRadius:4,fontFamily:fm}}>{dec.action}</span>
                <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{dec.ticker}</span>
                {dec.price&&<span style={{fontSize:11,color:K.dim,fontFamily:fm}}>@ ${dec.price}</span>}
                <span style={{flex:1}}/>
                {dec.outcome&&<span style={{fontSize:10,fontWeight:600,color:dec.outcome==="right"?K.grn:dec.outcome==="wrong"?K.red:dec.outcome==="lucky"?"#9333EA":K.amb,background:(dec.outcome==="right"?K.grn:dec.outcome==="wrong"?K.red:dec.outcome==="lucky"?"#9333EA":K.amb)+"12",padding:"2px 8px",borderRadius:3,fontFamily:fm}}>{dec.outcome}</span>}
                <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{dec.date?fD(dec.date):""}</span></div>
              {dec.reasoning&&<div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>{dec.reasoning}</div>}
              {dec.invalidation&&<div style={{fontSize:11,color:K.amb,marginTop:6,fontStyle:"italic"}}>{"Invalidation: "+dec.invalidation}</div>}
            </div>})}
        </div>}
      </div>}

      {/* ═══ DOCUMENT VAULT TAB ═══ */}
      {ht==="docs"&&<div>
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
          <select value={hc} onChange={function(e){setHc(e.target.value);setHd(null)}} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"7px 12px",fontSize:11,fontFamily:fm,outline:"none"}}>
            <option value="all">All Companies</option>
            {companies.map(function(c){return<option key={c.id} value={c.id}>{c.ticker}</option>})}</select>
          <button onClick={function(){setHf("all");setHd(null)}} style={{background:hf==="all"?K.acc+"20":"transparent",border:"1px solid "+(hf==="all"?K.acc+"50":K.bdr),borderRadius:6,padding:"6px 14px",fontSize:11,color:hf==="all"?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>All</button>
          {FOLDERS.map(function(fo){var ct=allDocs.filter(function(d2){return d2.folder===fo.id&&(hc==="all"||d2.companyId===parseInt(hc))}).length;
            return<button key={fo.id} onClick={function(){setHf(fo.id);setHd(null)}} style={{background:hf===fo.id?K.acc+"20":"transparent",border:"1px solid "+(hf===fo.id?K.acc+"50":K.bdr),borderRadius:6,padding:"6px 14px",fontSize:11,color:hf===fo.id?K.acc:K.dim,cursor:"pointer",fontFamily:fm,display:"inline-flex",alignItems:"center",gap:5}}><IC name={fo.icon} size={11} color={hf===fo.id?K.acc:K.dim}/>{fo.label}{ct>0?" ("+ct+")":""}</button>})}</div>
        <div className="ta-grid-docs" style={{display:"grid",gridTemplateColumns:selectedDoc?"340px 1fr":"1fr",gap:20}}>
          <div>
            {filteredDocs.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:32,textAlign:"center"}}><div style={{fontSize:13,color:K.dim,marginBottom:8}}>No documents yet</div><div style={{fontSize:12,color:K.dim}}>Add notes in company pages and they'll appear here.</div></div>}
            {filteredDocs.map(function(d3){var fo=FOLDERS.find(function(f){return f.id===d3.folder});var isActive=hd===d3.id;
              return<div key={d3.id} style={{background:isActive?K.acc+"08":K.card,border:"1px solid "+(isActive?K.acc+"30":K.bdr),borderRadius:12,padding:"14px 18px",marginBottom:8,cursor:"pointer",transition:"all .15s"}} onClick={function(){setHd(isActive?null:d3.id)}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <CoLogo domain={d3.domain} ticker={d3.ticker} size={18}/>
                  <span style={{fontSize:10,fontWeight:600,color:K.mid,fontFamily:fm}}>{d3.ticker}</span>
                  <IC name={fo?fo.icon:"file"} size={12} color={K.dim}/>
                  <span style={{flex:1}}/>
                  <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{d3.updatedAt?new Date(d3.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>
                <div style={{fontSize:13,fontWeight:500,color:K.txt}}>{d3.title}</div>
                {!selectedDoc&&d3.content&&<div style={{fontSize:12,color:K.dim,lineHeight:1.5,marginTop:4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{d3.content.substring(0,200)}</div>}
              </div>})}</div>
          {selectedDoc&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"24px 28px",position:"sticky",top:80,maxHeight:"calc(100vh - 120px)",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <CoLogo domain={selectedDoc.domain} ticker={selectedDoc.ticker} size={22}/>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:500,color:K.txt}}>{selectedDoc.title}</div>
                <div style={{fontSize:11,color:K.dim}}>{selectedDoc.companyName}{selectedDoc.updatedAt?" • "+new Date(selectedDoc.updatedAt).toLocaleDateString():""}</div></div>
              <button onClick={function(){if(requirePro("export"))exportDocPDF(selectedDoc)}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:10})}>{isPro?"PDF":"⚡ PDF"}</button>
              {!selectedDoc.isThesis&&<button onClick={function(){setSelId(selectedDoc.companyId);setPage("dashboard");setModal({type:"doc",data:selectedDoc.id})}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:10})}>Edit</button>}
            </div>
            <div style={{fontSize:13,color:K.mid,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{autoFormat(selectedDoc.content)}</div>
          </div>}
        </div>
      </div>}

      {/* ═══ HOW IT WORKS TAB ═══ */}
      {ht==="guide"&&<div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"24px 28px",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:500,color:K.txt,fontFamily:fh,marginBottom:12}}>The Owner's Mindset</div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.8,marginBottom:16}}>ThesisAlpha tracks how well you follow a disciplined investment process — not whether your stocks go up. The Owner's Score measures the quality of your process across 6 dimensions. Research shows that investors who maintain a written thesis, track KPIs, and review regularly outperform those who don't.</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            {[{icon:"lightbulb",color:K.acc,title:"Thesis Quality (20 pts)",desc:"Write a thesis with 4 sections: why you own it, competitive moat, key risks, and sell criteria. Version it over time. Keep it fresh — stale theses lose points."},
              {icon:"target",color:K.blue,title:"KPI Discipline (20 pts)",desc:"Track 2+ KPIs per holding (revenue growth, margins, ROIC, etc). Check earnings when they drop. Build a track record of measured results."},
              {icon:"book",color:K.grn,title:"Journal Consistency (20 pts)",desc:"Log every BUY, SELL, ADD, TRIM with written reasoning. Tag outcomes later (right/wrong/mixed). This is how you learn from mistakes."},
              {icon:"trending",color:K.amb,title:"Conviction Hygiene (15 pts)",desc:"Rate conviction 1–10 for each position. Update quarterly. Run bias checks (confirmation, anchoring, FOMO, sunk cost). Track how conviction evolves."},
              {icon:"castle",color:"#9333EA",title:"Moat Vigilance (10 pts)",desc:"Classify moat types (brand, switching costs, network effects, etc). Add Morningstar's rating for reference. Track whether the moat is strengthening or eroding."},
              {icon:"bar",color:K.mid,title:"Portfolio Balance (15 pts)",desc:"Diversify across 3+ holdings, keep sector concentration below 40%, and use 2+ investment styles. This isn't about returns — it's about thoughtful construction."}
            ].map(function(item){return<div key={item.title} style={{padding:"14px 16px",background:K.bg,borderRadius:8,border:"1px solid "+K.bdr}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><IC name={item.icon} size={14} color={item.color}/>
                <span style={{fontSize:12,fontWeight:600,color:item.color,fontFamily:fm}}>{item.title}</span></div>
              <div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>{item.desc}</div></div>})}
          </div>
        </div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"24px 28px"}}>
          <div style={{fontSize:18,fontWeight:500,color:K.txt,fontFamily:fh,marginBottom:12}}>Process Level System</div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.8,marginBottom:16}}>Every action builds your process score — writing theses, tracking KPIs, rating conviction, completing weekly reviews. Show up consistently and watch your score grow.</div>
          <div style={{display:"flex",alignItems:"center",gap:16,padding:"14px 18px",background:K.acc+"08",border:"1px solid "+K.acc+"30",borderRadius:10,marginBottom:12}}>
            <div style={{fontSize:28,fontWeight:800,color:K.acc,fontFamily:fm}}>{currentLevel.icon+" "+currentLevel.name}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:K.mid,marginBottom:4}}>{xp.total.toLocaleString()} / {xpLevel.xpForNext.toLocaleString()} pts</div>
              <div style={{height:6,borderRadius:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:xpPct+"%",borderRadius:3,background:K.acc}}/></div></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{label:"Write thesis",xp:"+10 pts",sub:"(+20 if all 4 sections)"},{label:"Add KPI",xp:"+5 pts",sub:""},{label:"Rate conviction",xp:"+8 pts",sub:""},{label:"Weekly review",xp:"+25 pts",sub:"(biggest reward)"}].map(function(r){return<div key={r.label} style={{padding:"8px 12px",background:K.bg,borderRadius:6}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:K.mid}}>{r.label}</span><span style={{fontSize:11,fontWeight:600,color:K.grn,fontFamily:fm}}>{r.xp}</span></div>
              {r.sub&&<div style={{fontSize:9,color:K.dim}}>{r.sub}</div>}</div>})}</div>
        </div>
      </div>}
    </div>}


  // ── Portfolio Analytics ─────────────────────────────────



  // ── All Assets — Net Worth Tracker ──────────────────────
  function AllAssets(){
    var _addOpen=useState(false),addOpen=_addOpen[0],setAddOpen=_addOpen[1];
    var _editId=useState(null),editId=_editId[0],setEditId=_editId[1];
    var _form=useState({classId:"stocks",name:"",value:"",currency:"USD",note:"",startDate:""}),form=_form[0],setForm=_form[1];
    var _hovIdx=useState(null),hovIdx=_hovIdx[0],setHovIdx=_hovIdx[1];
    var _chartRange=useState("ALL"),chartRange=_chartRange[0],setChartRange=_chartRange[1];
    var _histPrices=useState(null),histPrices=_histPrices[0],setHistPrices=_histPrices[1];

    var positions=assets.positions||[];
    var snapshots=(assets.snapshots||[]).slice().sort(function(a,b){return a.date.localeCompare(b.date)});

    // Compute stock portfolio value from ThesisAlpha holdings
    var stockValue=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"&&c.position&&c.position.shares>0&&c.position.currentPrice>0}).reduce(function(s,c){return s+(c.position.shares*c.position.currentPrice)},0);

    // Total value per class
    var classTotals={};positions.forEach(function(p){if(!classTotals[p.classId])classTotals[p.classId]=0;classTotals[p.classId]+=p.value||0});
    // Auto-include stock portfolio if user hasn't manually added stocks
    var hasManualStocks=positions.some(function(p){return p.classId==="stocks"});
    if(!hasManualStocks&&stockValue>0){classTotals["stocks"]=(classTotals["stocks"]||0)+stockValue}
    var totalValue=Object.values(classTotals).reduce(function(s,v){return s+v},0);

    // Allocation data for pie chart
    var allocData=ASSET_CLASSES.filter(function(ac){return classTotals[ac.id]>0}).map(function(ac){return{id:ac.id,label:ac.label,value:classTotals[ac.id],color:ac.color,pct:totalValue>0?classTotals[ac.id]/totalValue*100:0}}).sort(function(a,b){return b.value-a.value});

    // Auto-snapshot: once per month
    useEffect(function(){if(positions.length===0&&stockValue===0)return;
      var today=new Date().toISOString().split("T")[0].substring(0,7);
      var lastSnap=snapshots.length>0?snapshots[snapshots.length-1]:null;
      if(!lastSnap||lastSnap.date.substring(0,7)!==today){
        var snap={date:new Date().toISOString().split("T")[0],values:Object.assign({},classTotals),total:totalValue};
        saveAssets(function(prev){return Object.assign({},prev,{snapshots:(prev.snapshots||[]).concat([snap]).slice(-120)})})}},[positions.length,totalValue]);

    // Build stacked chart data — enhanced with historical stock prices
    useEffect(function(){
      // Fetch historical prices for portfolio stocks to build value-over-time
      var stockHoldings=cos.filter(function(c2){return(c2.status||"portfolio")==="portfolio"&&c2.position&&c2.position.shares>0&&c2.purchaseDate});
      if(stockHoldings.length===0){setHistPrices(null);return}
      var pricePromises=stockHoldings.map(function(c2){return fetchHistoricalPrice(c2.ticker,"5Y").then(function(pts){return{ticker:c2.ticker,shares:c2.position.shares,purchaseDate:c2.purchaseDate,points:pts||[]}}).catch(function(){return{ticker:c2.ticker,shares:c2.position.shares,purchaseDate:c2.purchaseDate,points:[]}})});
      Promise.all(pricePromises).then(function(results){
        // Build date -> total value map
        var dateMap={};
        results.forEach(function(r){
          var buyDate=r.purchaseDate;
          r.points.forEach(function(pt){
            if(pt.date>=buyDate){
              if(!dateMap[pt.date])dateMap[pt.date]={stocks:0,other:0};
              dateMap[pt.date].stocks+=(r.shares*pt.close)}})});
        // Sample monthly
        var allDates=Object.keys(dateMap).sort();
        var monthly=[];var lastMonth="";
        allDates.forEach(function(d){var m=d.substring(0,7);if(m!==lastMonth){lastMonth=m;monthly.push(d)}});
        if(allDates.length>0&&monthly[monthly.length-1]!==allDates[allDates.length-1])monthly.push(allDates[allDates.length-1]);
        var histData=monthly.map(function(d){return{date:d,stockVal:dateMap[d]?dateMap[d].stocks:0}});
        setHistPrices(histData)}).catch(function(){setHistPrices(null)})},[cos.length]);

    var chartData=snapshots.slice();
    // Merge historical stock price data with manual asset snapshots
    if(histPrices&&histPrices.length>0){
      // Build from historical prices + manual positions
      var manualTotal=positions.reduce(function(s,p3){return p3.classId!=="stocks"?s+(p3.value||0):s},0);
      chartData=histPrices.map(function(hp){return{date:hp.date,values:{stocks:hp.stockVal},total:hp.stockVal+manualTotal}});
      // Layer in manual asset snapshots for non-stock classes
      snapshots.forEach(function(snap){var existing=chartData.find(function(d){return d.date===snap.date});
        if(existing){Object.keys(snap.values||{}).forEach(function(k){if(k!=="stocks")existing.values[k]=(snap.values[k]||0)});existing.total=Object.values(existing.values).reduce(function(s,v){return s+v},0)}})
    }
    // Add current point
    if(totalValue>0){var today2=new Date().toISOString().split("T")[0];
      if(!chartData.length||chartData[chartData.length-1].date!==today2){chartData.push({date:today2,values:Object.assign({},classTotals),total:totalValue})}}
    // Filter by range
    if(chartRange!=="ALL"&&chartData.length>0){
      var cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-({M3:3,M6:6,Y1:12,Y2:24,Y5:60}[chartRange]||1200));
      var cutStr=cutoff.toISOString().split("T")[0];chartData=chartData.filter(function(d){return d.date>=cutStr})}

    // Get unique class IDs across all snapshots
    var chartClasses=[];var seenClasses={};chartData.forEach(function(d){Object.keys(d.values||{}).forEach(function(k){if(!seenClasses[k]){seenClasses[k]=true;chartClasses.push(k)}})});
    chartClasses=ASSET_CLASSES.filter(function(ac){return seenClasses[ac.id]});

    // SVG stacked area chart
    var cW=700,cH=260,padL=60,padR=20,padT=20,padB=30;
    var plotW=cW-padL-padR,plotH=cH-padT-padB;
    var maxTotal=Math.max.apply(null,chartData.map(function(d){return d.total||0}).concat([1]));

    function cx(i){return padL+(chartData.length>1?i/(chartData.length-1)*plotW:plotW/2)}
    function cy(v){return padT+plotH-Math.min(v/maxTotal,1)*plotH}

    // Build stacked paths
    var stackedPaths=[];
    if(chartData.length>=2){
      // Build cumulative layers
      chartClasses.forEach(function(ac,li){
        var pts=chartData.map(function(d,di){
          var below=0;for(var bi=0;bi<li;bi++){below+=(d.values||{})[chartClasses[bi].id]||0}
          var val=below+((d.values||{})[ac.id]||0);
          return{x:cx(di),yTop:cy(val),yBot:cy(below)}});
        var topLine=pts.map(function(p,i){return(i===0?"M":"L")+p.x.toFixed(1)+","+p.yTop.toFixed(1)}).join(" ");
        var botLine=pts.slice().reverse().map(function(p,i){return(i===0?"M":"L")+p.x.toFixed(1)+","+p.yBot.toFixed(1)}).join(" ");
        var areaPath=topLine+" "+botLine.replace("M","L")+" Z";
        stackedPaths.push({path:areaPath,color:ac.color,label:ac.label,id:ac.id})})}

    // Y axis labels
    var yLabels=[];for(var yi=0;yi<=4;yi++){var yv=maxTotal*yi/4;yLabels.push({v:yv,y:cy(yv),label:yv>=1e6?(yv/1e6).toFixed(1)+"M":yv>=1e3?Math.round(yv/1e3)+"k":""+Math.round(yv)})}
    // X axis labels
    var xLabels=[];if(chartData.length>0){var step2=Math.max(1,Math.floor(chartData.length/6));
      for(var xi=0;xi<chartData.length;xi+=step2){xLabels.push({x:cx(xi),label:chartData[xi].date.substring(0,7)})}}

    // Hovered point data
    var hovData=hovIdx!==null&&chartData[hovIdx]?chartData[hovIdx]:null;

    // Donut/Pie chart SVG
    function PieChart(){
      var r=80,cx2=90,cy2=90,thick=28;
      var total2=allocData.reduce(function(s,d){return s+d.value},0);
      var angle=0;
      var arcs=allocData.map(function(d){
        var sweep=total2>0?d.value/total2*Math.PI*2:0;
        var startA=angle;angle+=sweep;
        var midR=r-thick/2;
        var x1=cx2+r*Math.cos(startA-Math.PI/2);var y1=cy2+r*Math.sin(startA-Math.PI/2);
        var x2=cx2+r*Math.cos(startA+sweep-Math.PI/2);var y2=cy2+r*Math.sin(startA+sweep-Math.PI/2);
        var ix1=cx2+(r-thick)*Math.cos(startA-Math.PI/2);var iy1=cy2+(r-thick)*Math.sin(startA-Math.PI/2);
        var ix2=cx2+(r-thick)*Math.cos(startA+sweep-Math.PI/2);var iy2=cy2+(r-thick)*Math.sin(startA+sweep-Math.PI/2);
        var large=sweep>Math.PI?1:0;
        if(sweep<0.01)return null;
        var path="M"+x1.toFixed(1)+","+y1.toFixed(1)+" A"+r+","+r+" 0 "+large+" 1 "+x2.toFixed(1)+","+y2.toFixed(1)+" L"+ix2.toFixed(1)+","+iy2.toFixed(1)+" A"+(r-thick)+","+(r-thick)+" 0 "+large+" 0 "+ix1.toFixed(1)+","+iy1.toFixed(1)+" Z";
        return{path:path,color:d.color,label:d.label,pct:d.pct}}).filter(Boolean);

      return<svg width={180} height={180} viewBox="0 0 180 180">
        {arcs.map(function(a,i){return<path key={i} d={a.path} fill={a.color} opacity={0.85}><title>{a.label}: {a.pct.toFixed(1)}%</title></path>})}
        <text x={cx2} y={cy2-6} textAnchor="middle" fill={K.txt} fontSize="14" fontWeight="700" fontFamily="JetBrains Mono">{totalValue>=1e6?(totalValue/1e6).toFixed(1)+"M":totalValue>=1e3?Math.round(totalValue/1e3)+"k":Math.round(totalValue)}</text>
        <text x={cx2} y={cy2+10} textAnchor="middle" fill={K.dim} fontSize="9" fontFamily="JetBrains Mono">TOTAL</text>
      </svg>}

    function addPosition(){
      if(!form.name.trim()||!form.value)return;
      var newPos={id:Date.now(),classId:form.classId,name:form.name.trim(),value:parseFloat(form.value)||0,currency:form.currency||"USD",note:form.note,startDate:form.startDate||null,addedAt:new Date().toISOString()};
      saveAssets(function(prev){
        var newPositions=(prev.positions||[]).concat([newPos]);
        var newSnaps=(prev.snapshots||[]).slice();
        // If startDate provided, backfill monthly snapshots
        if(form.startDate){
          var start=new Date(form.startDate+"-01");var now=new Date();
          var allPos=newPositions;
          while(start<=now){
            var mKey=start.toISOString().split("T")[0].substring(0,7)+"-01";
            var exists=newSnaps.some(function(s){return s.date.substring(0,7)===mKey.substring(0,7)});
            if(!exists){
              var snapVals={};allPos.forEach(function(p2){
                var pStart=p2.startDate?p2.startDate+"-01":p2.addedAt.substring(0,10);
                if(mKey>=pStart){if(!snapVals[p2.classId])snapVals[p2.classId]=0;snapVals[p2.classId]+=p2.value||0}});
              // Include auto stocks
              var hasManual=allPos.some(function(p2){return p2.classId==="stocks"&&(!p2.startDate||mKey>=p2.startDate+"-01")});
              if(!hasManual&&stockValue>0)snapVals["stocks"]=(snapVals["stocks"]||0)+stockValue;
              var snapTotal=Object.values(snapVals).reduce(function(s,v){return s+v},0);
              if(snapTotal>0)newSnaps.push({date:mKey,values:snapVals,total:snapTotal})}
            start.setMonth(start.getMonth()+1)}}
        newSnaps.sort(function(a,b){return a.date.localeCompare(b.date)});
        return Object.assign({},prev,{positions:newPositions,snapshots:newSnaps.slice(-120)})});
      setForm({classId:"stocks",name:"",value:"",currency:"USD",note:"",startDate:""});setAddOpen(false);
      showToast("✓ Asset added","info",2000)}

    function updatePosition(id,updates){
      saveAssets(function(prev){return Object.assign({},prev,{positions:(prev.positions||[]).map(function(p){return p.id===id?Object.assign({},p,updates):p})})})}

    function removePosition(id){
      saveAssets(function(prev){return Object.assign({},prev,{positions:(prev.positions||[]).filter(function(p){return p.id!==id})})})}

    function fmtVal(v){if(v>=1e6)return(v/1e6).toFixed(2)+"M";if(v>=1e3)return(v/1e3).toFixed(1)+"k";return Math.round(v).toLocaleString()}

    return<div style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:1000}}>
      <div style={{padding:"28px 0 20px"}}>
        <h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>All Assets</h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>Your complete net worth — every asset class in one view</p></div>

      {/* Summary Cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:12,marginBottom:24}}>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 20px"}}>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>NET WORTH</div>
          <div style={{fontSize:22,fontWeight:700,color:K.txt,fontFamily:fm}}>{fmtVal(totalValue)}</div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{positions.length+(stockValue>0&&!hasManualStocks?1:0)} positions</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 20px"}}>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>ASSET CLASSES</div>
          <div style={{fontSize:22,fontWeight:700,color:K.acc,fontFamily:fm}}>{allocData.length}</div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>diversified across</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 20px"}}>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>LARGEST HOLDING</div>
          <div style={{fontSize:14,fontWeight:700,color:allocData[0]?allocData[0].color:K.dim,fontFamily:fm}}>{allocData[0]?allocData[0].label:"—"}</div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{allocData[0]?allocData[0].pct.toFixed(1)+"%":"Add assets"}</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 20px"}}>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>STOCKS</div>
          <div style={{fontSize:14,fontWeight:700,color:K.grn,fontFamily:fm}}>{stockValue>0?fmtVal(stockValue+(hasManualStocks?0:0)):"—"}</div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{!hasManualStocks&&stockValue>0?"from ThesisAlpha portfolio":"—"}</div></div>
      </div>

      {/* Stacked Chart + Pie */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 220px",gap:20,marginBottom:24}}>
        {/* Stacked Area Chart */}
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={S.sec}><IC name="chart" size={14} color={K.dim}/>Portfolio Value Over Time</div>
            <div style={{display:"flex",gap:3}}>
              {["M3","M6","Y1","Y2","Y5","ALL"].map(function(r){return<button key={r} onClick={function(){setChartRange(r)}}
                style={{padding:"3px 8px",fontSize:9,fontFamily:fm,background:chartRange===r?K.acc+"18":"transparent",color:chartRange===r?K.acc:K.dim,border:"1px solid "+(chartRange===r?K.acc+"30":"transparent"),borderRadius:4,cursor:"pointer"}}>{r}</button>})}</div></div>

          {chartData.length<2?<div style={{padding:"60px 20px",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>{String.fromCodePoint(0x1F4C8)}</div>
            <div style={{fontSize:13,color:K.dim}}>Add assets below to start tracking your net worth.</div>
            <div style={{fontSize:11,color:K.dim,marginTop:4}}>The chart builds over time as monthly snapshots are recorded.</div></div>:
          <div style={{overflowX:"auto"}}>
            <svg width={cW} height={cH} style={{display:"block"}} onMouseLeave={function(){setHovIdx(null)}}>
              <defs>{chartClasses.map(function(ac){return<linearGradient key={ac.id} id={"ag-"+ac.id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ac.color} stopOpacity="0.7"/>
                <stop offset="100%" stopColor={ac.color} stopOpacity="0.2"/></linearGradient>})}</defs>
              {/* Grid lines */}
              {yLabels.map(function(yl,i){return<g key={i}><line x1={padL} y1={yl.y} x2={cW-padR} y2={yl.y} stroke={K.bdr} strokeWidth="0.5"/>
                <text x={padL-8} y={yl.y+3} textAnchor="end" fill={K.dim} fontSize="9" fontFamily="JetBrains Mono">{yl.label}</text></g>})}
              {/* Stacked areas */}
              {stackedPaths.map(function(sp,i){return<path key={sp.id} d={sp.path} fill={"url(#ag-"+sp.id+")"} stroke={sp.color} strokeWidth="1.5" strokeLinejoin="round"/>})}
              {/* Hover detection */}
              {chartData.map(function(d,i){return<rect key={i} x={cx(i)-Math.max(2,plotW/chartData.length/2)} y={padT} width={Math.max(4,plotW/chartData.length)} height={plotH} fill="transparent"
                onMouseEnter={function(){setHovIdx(i)}}/>})}
              {/* Hover line */}
              {hovIdx!==null&&<line x1={cx(hovIdx)} y1={padT} x2={cx(hovIdx)} y2={padT+plotH} stroke={K.dim} strokeWidth="0.5" strokeDasharray="3,3"/>}
              {/* X axis labels */}
              {xLabels.map(function(xl,i){return<text key={i} x={xl.x} y={cH-4} textAnchor="middle" fill={K.dim} fontSize="9" fontFamily="JetBrains Mono">{xl.label}</text>})}
            </svg>
            {/* Hover tooltip */}
            {hovData&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"10px 14px",marginTop:8}}>
              <div style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:4}}>{hovData.date} — Total: {fmtVal(hovData.total)}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {ASSET_CLASSES.filter(function(ac){return(hovData.values||{})[ac.id]>0}).map(function(ac){return<div key={ac.id} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:8,height:8,borderRadius:2,background:ac.color}}/>
                  <span style={{fontSize:10,color:K.mid,fontFamily:fm}}>{ac.label}: {fmtVal((hovData.values||{})[ac.id])}</span></div>})}</div></div>}
          </div>}
          {/* Legend */}
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:12}}>
            {chartClasses.map(function(ac){return<div key={ac.id} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:10,borderRadius:2,background:ac.color}}/>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{ac.label}</span></div>})}</div>
        </div>

        {/* Pie Chart + Allocation */}
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 20px"}}>
          <div style={Object.assign({},S.sec,{marginBottom:14})}><IC name="target" size={14} color={K.dim}/>Allocation</div>
          {allocData.length===0?<div style={{padding:"40px 0",textAlign:"center",color:K.dim,fontSize:11}}>No assets yet</div>:
          <div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><PieChart/></div>
            {allocData.map(function(d){return<div key={d.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+K.bdr+"50"}}>
              <div style={{width:8,height:8,borderRadius:2,background:d.color,flexShrink:0}}/>
              <div style={{flex:1,fontSize:11,color:K.txt,fontFamily:fm}}>{d.label}</div>
              <div style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm}}>{d.pct.toFixed(1)}%</div>
            </div>})}</div>}
        </div>
      </div>

      {/* Positions list */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={S.sec}><IC name="dollar" size={14} color={K.dim}/>Your Assets</div>
        <button onClick={function(){setAddOpen(!addOpen);setEditId(null)}} style={Object.assign({},S.btnP,{fontSize:11,padding:"6px 16px"})}>{addOpen?"Cancel":"+ Add Asset"}</button></div>

      {/* Add form */}
      {addOpen&&<div style={{background:K.card,border:"1px solid "+K.acc+"40",borderRadius:12,padding:"20px 24px",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>ASSET CLASS</div>
            <select value={form.classId} onChange={function(e){setForm(Object.assign({},form,{classId:e.target.value}))}}
              style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 10px",fontSize:12,fontFamily:fm,outline:"none"}}>
              {ASSET_CLASSES.map(function(ac){return<option key={ac.id} value={ac.id}>{ac.label}</option>})}</select></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>NAME</div>
            <input value={form.name} onChange={function(e){setForm(Object.assign({},form,{name:e.target.value}))}} placeholder="e.g. Bitcoin, Gold ETF, Rental property..."
              style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 10px",fontSize:12,fontFamily:fm,outline:"none"}}/></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 2fr",gap:12,marginBottom:12}}>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>VALUE</div>
            <input value={form.value} onChange={function(e){setForm(Object.assign({},form,{value:e.target.value}))}} placeholder="100000" type="number"
              style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 10px",fontSize:12,fontFamily:fm,outline:"none"}}/></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>CURRENCY</div>
            <select value={form.currency} onChange={function(e){setForm(Object.assign({},form,{currency:e.target.value}))}}
              style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 10px",fontSize:12,fontFamily:fm,outline:"none"}}>
              {["USD","EUR","NOK","GBP","SEK","DKK","CHF","JPY","CAD","AUD"].map(function(c2){return<option key={c2} value={c2}>{c2}</option>})}</select></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>OWNED SINCE</div>
            <input value={form.startDate} onChange={function(e){setForm(Object.assign({},form,{startDate:e.target.value}))}} type="month"
              style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 10px",fontSize:12,fontFamily:fm,outline:"none"}}/></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>NOTE (optional)</div>
            <input value={form.note} onChange={function(e){setForm(Object.assign({},form,{note:e.target.value}))}} placeholder="Any details..."
              style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 10px",fontSize:12,fontFamily:fm,outline:"none"}}/></div></div>
        <button onClick={addPosition} style={Object.assign({},S.btnP,{width:"100%"})}>Add Asset</button></div>}

      {/* Auto-synced stocks card */}
      {!hasManualStocks&&stockValue>0&&<div style={{background:K.card,border:"1px solid "+ASSET_CLASSES[0].color+"30",borderLeft:"4px solid "+ASSET_CLASSES[0].color,borderRadius:12,padding:"14px 20px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:10,height:10,borderRadius:2,background:ASSET_CLASSES[0].color}}/>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Stocks (ThesisAlpha Portfolio)</div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>Auto-synced from your {cos.filter(function(c2){return(c2.status||"portfolio")==="portfolio"&&c2.position&&c2.position.shares>0}).length} portfolio holdings</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>{fmtVal(stockValue)}</div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{totalValue>0?(stockValue/totalValue*100).toFixed(1)+"%":""}
          </div></div></div>}

      {/* Position cards */}
      {positions.map(function(p){
        var ac=ASSET_CLASSES.find(function(a){return a.id===p.classId})||ASSET_CLASSES[ASSET_CLASSES.length-1];
        var isEditing=editId===p.id;
        return<div key={p.id} style={{background:K.card,border:"1px solid "+(isEditing?K.acc+"40":K.bdr),borderLeft:"4px solid "+ac.color,borderRadius:12,padding:"14px 20px",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:10,height:10,borderRadius:2,background:ac.color}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{p.name}</div>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{ac.label}{p.startDate?" · Since "+p.startDate:""}{p.note?" · "+p.note:""}{p.currency&&p.currency!=="USD"?" · "+p.currency:""}</div></div>
            <div style={{textAlign:"right",marginRight:8}}>
              {isEditing?<input value={p.value} onChange={function(e){updatePosition(p.id,{value:parseFloat(e.target.value)||0})}} type="number"
                style={{width:100,background:K.bg,border:"1px solid "+K.bdr,borderRadius:4,color:K.txt,padding:"4px 8px",fontSize:14,fontFamily:fm,textAlign:"right",outline:"none"}}/>:
              <div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>{fmtVal(p.value)}</div>}
              <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{totalValue>0?(p.value/totalValue*100).toFixed(1)+"%":""}</div></div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={function(){setEditId(isEditing?null:p.id)}} style={{background:"none",border:"none",color:K.acc,cursor:"pointer",fontSize:11,fontFamily:fm,padding:4}}>{isEditing?"Done":"Edit"}</button>
              <button onClick={function(){removePosition(p.id)}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:11,padding:4,opacity:.5}}>{"✕"}</button></div>
          </div></div>})}

      {positions.length===0&&stockValue===0&&<div style={{textAlign:"center",padding:"48px 20px",color:K.dim}}>
        <div style={{fontSize:36,marginBottom:12}}>{String.fromCodePoint(0x1F3E0)}</div>
        <div style={{fontSize:14}}>Track your complete net worth</div>
        <div style={{fontSize:12,marginTop:4}}>Add all your assets — stocks, crypto, real estate, gold, pension — to see the full picture.</div>
        <div style={{fontSize:11,marginTop:8,color:K.acc}}>Stock positions from your ThesisAlpha portfolio are included automatically.</div></div>}

      {/* Monthly snapshot prompt */}
      {positions.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginTop:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <IC name="target" size={14} color={K.dim}/>
          <div style={{flex:1}}><div style={{fontSize:11,color:K.mid,fontFamily:fm}}>Update your asset values monthly to build your net worth chart. Snapshots are saved automatically when values change.</div></div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{snapshots.length} snapshot{snapshots.length!==1?"s":""} recorded</div></div></div>}
    </div>}

  // ── Portfolio Timeline / Memory ──────────────────────────
  function PortfolioTimeline(){
    var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"||c.decisions&&c.decisions.length>0});
    var _filter=useState("all"),filter=_filter[0],setFilter=_filter[1];

    // Collect all events across all companies
    var events=[];
    portfolio.forEach(function(c){
      // Thesis versions
      (c.thesisVersions||[]).forEach(function(v){events.push({type:"thesis",date:v.date,ticker:c.ticker,domain:c.domain,id:c.id,
        title:"Thesis updated",detail:v.summary||"Updated thesis",icon:"lightbulb",color:K.acc})});
      // Conviction changes
      (c.convictionHistory||[]).forEach(function(v){events.push({type:"conviction",date:v.date,ticker:c.ticker,domain:c.domain,id:c.id,
        title:"Conviction → "+v.rating+"/10",detail:v.note||"",icon:"trending",color:v.rating>=7?K.grn:v.rating>=4?K.amb:K.red,rating:v.rating})});
      // Decisions
      (c.decisions||[]).forEach(function(d){events.push({type:"decision",date:d.date,ticker:c.ticker,domain:c.domain,id:c.id,
        title:d.action+" — "+c.ticker,detail:d.note||"",icon:d.action==="BUY"||d.action==="ADD"?"trending":d.action==="SELL"?"target":"shield",
        color:d.action==="BUY"||d.action==="ADD"?K.grn:d.action==="SELL"?K.red:K.amb,action:d.action,
        conviction:d.conviction,horizon:d.horizon})});
      // Earnings checks
      (c.earningsHistory||[]).forEach(function(e){events.push({type:"earnings",date:e.checkedAt?e.checkedAt.split("T")[0]:null,ticker:c.ticker,domain:c.domain,id:c.id,
        title:e.quarter+" earnings checked",detail:e.summary?e.summary.substring(0,120):"",icon:"target",color:K.blue,
        kpisMet:e.results?e.results.filter(function(r){return r.status==="met"}).length:0,
        kpisTotal:e.results?e.results.length:0})});
    });
    // Weekly reviews
    weeklyReviews.forEach(function(r){events.push({type:"review",date:r.date?r.date.split("T")[0]:r.weekId,ticker:"ALL",domain:"",id:null,
      title:"Weekly review completed",detail:r.summary.total+" holdings, "+r.summary.changed+" conviction changes, avg "+r.summary.avgConv+"/10",
      icon:"shield",color:K.grn,entries:r.entries})});

    // Sort by date descending
    events=events.filter(function(e){return e.date}).sort(function(a,b){return b.date.localeCompare(a.date)});

    // Filter
    var filtered=filter==="all"?events:events.filter(function(e){return e.type===filter});

    // Group by month
    var months={};filtered.forEach(function(e){var key=e.date.substring(0,7);if(!months[key])months[key]=[];months[key].push(e)});

    return<div style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:800}}>
      <div style={{padding:"28px 0 20px"}}><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>Portfolio Timeline</h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{events.length} events across {portfolio.length} holdings — your investment memory</p></div>

      {/* Filters */}
      <div style={{display:"flex",gap:6,marginBottom:24,flexWrap:"wrap"}}>
        {[{id:"all",l:"All Events",n:events.length},{id:"decision",l:"Decisions",n:events.filter(function(e){return e.type==="decision"}).length},
          {id:"conviction",l:"Conviction",n:events.filter(function(e){return e.type==="conviction"}).length},
          {id:"thesis",l:"Thesis",n:events.filter(function(e){return e.type==="thesis"}).length},
          {id:"earnings",l:"Earnings",n:events.filter(function(e){return e.type==="earnings"}).length},
          {id:"review",l:"Reviews",n:events.filter(function(e){return e.type==="review"}).length}
        ].map(function(f){return<button key={f.id} onClick={function(){setFilter(f.id)}}
          style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+(filter===f.id?K.acc:K.bdr),
            background:filter===f.id?K.acc+"12":"transparent",color:filter===f.id?K.acc:K.dim,
            fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{f.l} ({f.n})</button>})}</div>

      {filtered.length===0&&<div style={{textAlign:"center",padding:60,color:K.dim}}>
        <div style={{fontSize:36,marginBottom:12}}>{String.fromCodePoint(0x1F4AD)}</div>
        <div style={{fontSize:14}}>No events yet</div>
        <div style={{fontSize:12,marginTop:4}}>Your timeline will fill as you log decisions, update convictions, and check earnings.</div></div>}

      {/* Timeline */}
      {Object.keys(months).sort().reverse().map(function(monthKey){
        var monthEvents=months[monthKey];
        var monthLabel=new Date(monthKey+"-01").toLocaleDateString("en-US",{year:"numeric",month:"long"});
        return<div key={monthKey} style={{marginBottom:32}}>
          <div style={{fontSize:11,fontWeight:700,color:K.dim,fontFamily:fm,letterSpacing:2,textTransform:"uppercase",marginBottom:12,paddingBottom:8,borderBottom:"1px solid "+K.bdr}}>{monthLabel} · {monthEvents.length} event{monthEvents.length!==1?"s":""}</div>
          {monthEvents.map(function(ev,ei){
            return<div key={ei} style={{display:"flex",gap:14,marginBottom:2}}>
              {/* Timeline line */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:24,flexShrink:0}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:ev.color,border:"2px solid "+K.card,flexShrink:0,marginTop:6,zIndex:1}}/>
                {ei<monthEvents.length-1&&<div style={{width:1,flex:1,background:K.bdr}}/>}
              </div>
              {/* Event card */}
              <div style={{flex:1,background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px",marginBottom:8,cursor:ev.id?"pointer":"default"}}
                onClick={ev.id?function(){setSelId(ev.id);setPage("dashboard")}:undefined}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {ev.domain&&<CoLogo domain={ev.domain} ticker={ev.ticker} size={18}/>}
                  <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{ev.ticker!=="ALL"?ev.ticker+" — ":""}{ev.title}</div>
                  <div style={{marginLeft:"auto",fontSize:10,color:K.dim,fontFamily:fm}}>{fD(ev.date)}</div>
                </div>
                {ev.detail&&<div style={{fontSize:11,color:K.mid,marginTop:4,lineHeight:1.5}}>{ev.detail}</div>}
                {ev.type==="decision"&&ev.conviction&&<div style={{display:"flex",gap:8,marginTop:6}}>
                  <span style={{fontSize:9,color:K.dim,fontFamily:fm}}>C:{ev.conviction}</span>
                  {ev.horizon&&<span style={{fontSize:9,color:K.dim,fontFamily:fm}}>{ev.horizon}</span>}</div>}
                {ev.type==="earnings"&&ev.kpisTotal>0&&<div style={{fontSize:10,color:ev.kpisMet===ev.kpisTotal?K.grn:K.amb,fontFamily:fm,marginTop:4}}>{ev.kpisMet}/{ev.kpisTotal} KPIs met</div>}
              </div>
            </div>})}</div>})}
    </div>}

  // ── Weekly Owner's Review ──────────────────────────────
  function WeeklyReview(){
    var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
    var weekId=getWeekId();var alreadyDone=weeklyReviews.length>0&&weeklyReviews[0].weekId===weekId;
    var today=new Date().getDay(); // 0=Sun,1=Mon,...5=Fri,6=Sat
    var isReviewDay=today===0||today===5||today===6; // Fri, Sat, Sun
    var dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var nextReviewDay=today<5?"Friday":(today===5||today===6)?"today":"Friday";
    var _step=useState(alreadyDone?"done":"intro"),step=_step[0],setStep=_step[1];
    var _idx=useState(0),idx=_idx[0],setIdx=_idx[1];
    var _revs=useState({}),revs=_revs[0],setRevs=_revs[1];
    var _notes=useState({}),notes=_notes[0],setNotes=_notes[1];
    var _actions=useState({}),actions=_actions[0],setActions=_actions[1];
    var c=portfolio[idx];
    var prevReview=alreadyDone?weeklyReviews[0]:null;
    // Countdown timer to next Friday
    var _ct=useState(null),countdownStr=_ct[0],setCountdownStr=_ct[1];
    useEffect(function(){
      if(isReviewDay)return;
      function tick(){var now=new Date();var fri=new Date(now);var daysUntil=(5-now.getDay()+7)%7;if(daysUntil===0)daysUntil=7;fri.setDate(now.getDate()+daysUntil);fri.setHours(0,0,0,0);
        var diff=fri-now;if(diff<=0){setCountdownStr(null);return}
        var d2=Math.floor(diff/86400000);var h=Math.floor((diff%86400000)/3600000);var m=Math.floor((diff%3600000)/60000);var s=Math.floor((diff%60000)/1000);
        setCountdownStr((d2>0?d2+"d ":"")+h+"h "+m+"m "+s+"s")}
      tick();var iv=setInterval(tick,1000);return function(){clearInterval(iv)}},[isReviewDay]);

    function startReview(){setStep("review");setIdx(0);setRevs({});setNotes({});setActions({})}
    function setConv(id,val){setRevs(function(p){var n=Object.assign({},p);n[id]=val;return n})}
    function setNote(id,val){setNotes(function(p){var n=Object.assign({},p);n[id]=val;return n})}
    function setAction(id,val){setActions(function(p){var n=Object.assign({},p);n[id]=val;return n})}
    function nextHolding(){if(idx<portfolio.length-1){setIdx(idx+1)}else{setStep("summary")}}
    function prevHolding(){if(idx>0)setIdx(idx-1)}
    function finishReview(){
      var entries=portfolio.map(function(c2){return{ticker:c2.ticker,id:c2.id,prev:c2.conviction||0,
        new:revs[c2.id]!=null?revs[c2.id]:c2.conviction||0,note:notes[c2.id]||"",action:actions[c2.id]||"hold"}});
      var rev={weekId:weekId,date:new Date().toISOString(),entries:entries,
        summary:{total:portfolio.length,changed:entries.filter(function(e){return e.prev!==e.new}).length,
        avgConv:Math.round(entries.reduce(function(s,e){return s+e.new},0)/Math.max(entries.length,1)*10)/10}};
      saveReview(rev);
      entries.forEach(function(e){if(e.new!==e.prev||e.note){
        var hist=(cos.find(function(x){return x.id===e.id})||{}).convictionHistory||[];
        hist=hist.slice();hist.push({date:new Date().toISOString().split("T")[0],rating:e.new,note:"Weekly review"+(e.note?" — "+e.note:"")});
        upd(e.id,{conviction:e.new,convictionHistory:hist.slice(-20)})}});
      // Auto-log conviction shifts for significant changes
      entries.forEach(function(e2){if(Math.abs(e2.new-e2.prev)>=2){
        logJournalEntry(e2.id,{cardType:"conviction_shift",ticker:e2.ticker,prevConviction:e2.prev,newConviction:e2.new,delta:e2.new-e2.prev,note:e2.note||"",action:e2.action||"hold",weekId:weekId})}});
      showToast("✓ Weekly review logged — "+rev.summary.changed+" conviction change"+(rev.summary.changed!==1?"s":""),"info",4000);
      // Open Weekly Insight after a brief delay
      setTimeout(function(){openChest()},1500);
      setStep("done")}

    var streakColor=(streakData.current||0)>=8?K.grn:(streakData.current||0)>=4?K.amb:K.mid;

    return<div style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:800}}>
      <div style={{padding:"28px 0 20px"}}><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>Weekly Owner’s Review</h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>3 minutes to confirm or adjust conviction across your portfolio</p></div>

      {/* Streak banner */}
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:12,marginBottom:24}}>
        <div style={{fontSize:32,fontWeight:700,color:streakColor,fontFamily:fm,lineHeight:1}}>{streakData.current||0}</div>
        <div><div style={{fontSize:13,fontWeight:600,color:K.txt}}>week streak</div>
          <div style={{fontSize:11,color:K.dim}}>{(streakData.current||0)>=4?"Excellent discipline — keep it going":(streakData.current||0)>=1?"Building the habit":"Start your first weekly review"}</div></div>
        <div style={{marginLeft:"auto",display:"flex",gap:3}}>
          {[0,1,2,3,4,5,6,7].map(function(i){return<div key={i} style={{width:8,height:24,borderRadius:2,background:i<(streakData.current||0)?streakColor:K.bdr}}/>})}</div>
      </div>

      {step!=="review"&&(function(){
        // Chest preview - always show one of each tier to build curiosity
        var previewTiers=["common","uncommon","rare"];
        var tierColors={rare:"#FFD700",uncommon:"#a78bfa",common:K.mid};
        var tierLabels={rare:"Rare",uncommon:"Uncommon",common:"Common"};
        var tierIcons={rare:String.fromCodePoint(0x1F48E),uncommon:String.fromCodePoint(0x2728),common:String.fromCodePoint(0x2B50)};
        var tierOdds={rare:"5%",uncommon:"25%",common:"70%"};
        var tierHints={rare:"Early lens unlock, profile badge",uncommon:"2× points boost, rare quote",common:"Bonus points, streak freeze, wisdom"};

        return<div style={{padding:"48px 20px"}}>
        {/* ── LOCKED STATE: Countdown + Preview ── */}
        {!isReviewDay&&!currentWeekReviewed&&<div>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:48,marginBottom:12}}>{String.fromCodePoint(0x1F512)}</div>
            <div style={{fontSize:22,fontWeight:500,color:K.txt,fontFamily:fh,marginBottom:4}}>Weekly Review</div>
            <div style={{fontSize:13,color:K.dim}}>Opens every Friday through Sunday</div></div>
          {/* Countdown */}
          {countdownStr&&<div style={{textAlign:"center",marginBottom:28}}>
            <div style={{display:"inline-block",background:K.card,border:"1px solid "+K.bdr,borderRadius:14,padding:"20px 36px"}}>
              <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>Opens In</div>
              <div style={{fontSize:32,fontWeight:800,color:K.acc,fontFamily:fm,letterSpacing:2}}>{countdownStr}</div></div></div>}
          {/* Chest Preview */}
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:14}}>This Week's Insight Contains…</div>
            <div style={{display:"flex",justifyContent:"center",gap:16}}>
              {previewTiers.map(function(tier,i){return<div key={i} style={{width:100,height:130,borderRadius:12,background:K.card,border:"2px solid "+tierColors[tier]+"50",boxShadow:"0 4px 20px "+tierColors[tier]+"15",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:tierColors[tier]}}/>
                <div style={{fontSize:24,marginBottom:4}}>{tierIcons[tier]}</div>
                <div style={{fontSize:9,fontWeight:600,color:tierColors[tier],fontFamily:fm,letterSpacing:1}}>{tierLabels[tier].toUpperCase()}</div>
                <div style={{fontSize:8,color:K.dim,marginTop:2}}>{tierOdds[tier]} chance</div>
                <div style={{fontSize:7,color:K.dim,marginTop:4,padding:"0 8px",textAlign:"center",lineHeight:1.3}}>{tierHints[tier]}</div></div>})}</div>
            <div style={{fontSize:11,color:K.dim,marginTop:14,lineHeight:1.6}}>Bonus points, streak freezes, investor wisdom, 2× point boosts, badges, or a rare early lens unlock.</div></div>
          <button disabled style={{background:K.prim,color:K.primTxt,border:"none",borderRadius:8,padding:"12px 32px",fontSize:14,fontWeight:600,fontFamily:fm,opacity:.35,cursor:"not-allowed"}}>Available Friday</button>
        </div>}

        {/* ── REVIEW DAY: Ready to go ── */}
        {isReviewDay&&!currentWeekReviewed&&<div style={{textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>{String.fromCodePoint(0x1F4CB)}</div>
          <div style={{fontSize:22,fontWeight:500,color:K.txt,fontFamily:fh,marginBottom:8}}>Ready for your weekly check-in?</div>
          <div style={{fontSize:13,color:K.dim,marginBottom:24,maxWidth:400,margin:"0 auto 24px",lineHeight:1.7}}>Go through each holding. Confirm or adjust conviction. Flag any actions. Takes about 3 minutes.</div>
          <div style={{background:K.grn+"08",border:"1px solid "+K.grn+"25",borderRadius:10,padding:"14px 18px",marginBottom:20,display:"inline-block",textAlign:"left"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <div style={{width:32,height:32,borderRadius:8,background:"#a78bfa15",display:"flex",alignItems:"center",justifyContent:"center",animation:"glowPulse 2s ease-in-out infinite"}}><IC name="dice" size={16} color="#a78bfa"/></div>
              <span style={{fontSize:13,fontWeight:600,color:K.txt}}>Weekly Insight awaits</span></div>
            <div style={{fontSize:11,color:K.mid,lineHeight:1.6}}>Complete your review to earn <strong style={{color:K.grn}}>+25 pts</strong> and claim a weekly insight. Could be bonus points, a streak freeze, investor wisdom, 2× points, or even a rare lens unlock.</div></div>
          <br/><button onClick={startReview} style={Object.assign({},S.btnP,{fontSize:14,padding:"12px 32px"})}>Start Review</button>
        </div>}

        {/* ── DONE STATE ── */}
        {currentWeekReviewed&&<div>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:56,marginBottom:12,animation:"glowPulse 2.5s ease-in-out infinite",display:"inline-block",filter:"drop-shadow(0 0 12px rgba(255,215,0,.4))"}}>{String.fromCodePoint(0x1F3C6)}</div>
            <div style={{fontSize:22,fontWeight:500,color:K.txt,fontFamily:fh,marginBottom:6}}>This week’s review is complete</div>
            <div style={{fontSize:13,color:K.dim,maxWidth:400,margin:"0 auto",lineHeight:1.7}}>Come back next week to keep your streak alive and earn your next weekly insight.</div>
          </div>
          {/* Countdown */}
          {countdownStr&&!isReviewDay&&<div style={{textAlign:"center",marginBottom:20}}>
            <div style={{display:"inline-block",background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 24px"}}>
              <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:4}}>Next Review In</div>
              <div style={{fontSize:20,fontWeight:700,color:K.acc,fontFamily:fm}}>{countdownStr}</div></div></div>}
          {/* This week's reward */}
          {(function(){
            var reward=latestWeeklyReward;
            var histEntry=chestRewards.history&&chestRewards.history.length>0?chestRewards.history[0]:null;
            var tierColors2={rare:"#FFD700",uncommon:"#a78bfa",common:K.mid};
            var tierLabels2={rare:"Rare",uncommon:"Uncommon",common:"Common"};
            if(reward)return<div style={{textAlign:"center",padding:"20px 16px",background:K.card,borderRadius:12,border:"1px solid "+(tierColors2[reward.tier]||K.bdr)+"40",marginBottom:16,maxWidth:360,margin:"0 auto 16px"}}>
              <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:tierColors2[reward.tier]||K.dim,fontFamily:fm,marginBottom:6}}>{"THIS WEEK’S REWARD — "+tierLabels2[reward.tier||"common"]}</div>
              <div style={{fontSize:32,marginBottom:4}}>{reward.icon}</div>
              <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fh,marginBottom:2}}>{reward.label}</div>
              <div style={{fontSize:11,color:K.mid,lineHeight:1.5}}>{reward.desc}</div>
              {reward.author&&<div style={{fontSize:10,color:K.dim,fontStyle:"italic",marginTop:2}}>{"— "+reward.author}</div>}
              {reward.xp>0&&<div style={{marginTop:6}}><span style={{fontSize:10,fontWeight:600,color:K.grn,fontFamily:fm}}>+{reward.xp} pts</span></div>}
            </div>;
            if(histEntry)return<div style={{textAlign:"center",padding:"14px 16px",background:K.card,borderRadius:12,border:"1px solid "+K.bdr,marginBottom:16,maxWidth:360,margin:"0 auto 16px"}}>
              <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:tierColors2[histEntry.tier]||K.dim,fontFamily:fm,marginBottom:4}}>{"LATEST REWARD — "+tierLabels2[histEntry.tier||"common"]}</div>
              <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{histEntry.reward}</div>
            </div>;
            return null})()}
          {/* Reward history */}
          {chestRewards.history&&chestRewards.history.length>1&&<div style={{maxWidth:360,margin:"0 auto 20px",background:K.card,borderRadius:10,border:"1px solid "+K.bdr,padding:"14px 16px"}}>
            <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>PAST REWARDS</div>
            <div style={{maxHeight:140,overflow:"auto"}}>
            {chestRewards.history.slice(1,15).map(function(h,hi){
              var tc2=h.tier==="rare"?"#FFD700":h.tier==="uncommon"?"#a78bfa":K.dim;
              var d2=h.date?new Date(h.date):null;
              var ds2=d2?d2.toLocaleDateString("en-US",{month:"short",day:"numeric"}):"";
              return<div key={hi} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:hi<Math.min(chestRewards.history.length-1,14)-1?"1px solid "+K.bdr+"30":"none"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:tc2,flexShrink:0}}/>
                <div style={{fontSize:10,color:K.txt,fontFamily:fm,flex:1}}>{h.reward}</div>
                <div style={{fontSize:8,color:tc2,fontWeight:600,fontFamily:fm}}>{h.tier}</div>
                <div style={{fontSize:8,color:K.dim,fontFamily:fm}}>{ds2}</div>
              </div>})}</div>
          </div>}
        </div>}
      </div>})()}

      {step==="review"&&c&&<div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{idx+1} / {portfolio.length}</div>
          <div style={{flex:1,height:4,borderRadius:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:((idx+1)/portfolio.length*100)+"%",borderRadius:2,background:K.acc,transition:"width .3s"}}/></div>
        </div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:14,padding:"28px 32px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <CoLogo domain={c.domain} ticker={c.ticker} size={36}/>
            <div><div style={{fontSize:18,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker}</div>
              <div style={{fontSize:11,color:K.dim}}>{c.name}</div></div>
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>CURRENT CONVICTION</div>
              <div style={{fontSize:22,fontWeight:700,color:c.conviction>=7?K.grn:c.conviction>=4?K.amb:K.red,fontFamily:fm}}>{c.conviction||"—"}/10</div></div>
          </div>
          {/* Quick thesis reminder */}
          {c.thesisNote&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"10px 14px",marginBottom:16,maxHeight:80,overflow:"hidden"}}>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:4}}>YOUR THESIS</div>
            <div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{c.thesisNote.split("\n")[0].substring(0,200)}</div></div>}
          {/* Munger reflection prompt */}
          {(function(){var prompts=["If you couldn\u2019t look at the stock price for 5 years, would you still own this?","What do you understand about this business that the market doesn\u2019t?","Would you be comfortable if this was your only holding?","Is this business better or worse than when you first bought it?","Are you holding because of conviction or because selling feels like admitting a mistake?","What would a smart skeptic say about your thesis?","Has anything structurally changed, or is this just noise?","Would you buy more at today\u2019s price?"];
            var pi=(idx+c.id)%prompts.length;
            return<div style={{background:K.bg,borderRadius:8,padding:"10px 14px",marginBottom:16,borderLeft:"2px solid "+K.acc}}>
              <div style={{fontSize:11,color:K.mid,lineHeight:1.6,fontStyle:"italic"}}>{prompts[pi]}</div></div>})()}
          {/* Conviction adjustment */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:8}}>ADJUST CONVICTION</div>
            <div style={{display:"flex",gap:4}}>
              {[1,2,3,4,5,6,7,8,9,10].map(function(v){var cur=revs[c.id]!=null?revs[c.id]:c.conviction;var active=cur===v;
                var clr=v>=7?K.grn:v>=4?K.amb:K.red;
                return<button key={v} onClick={function(){setConv(c.id,v)}}
                  style={{flex:1,height:36,borderRadius:6,border:"1px solid "+(active?clr:K.bdr),background:active?clr+"20":"transparent",
                    color:active?clr:K.dim,fontSize:13,fontWeight:active?700:500,cursor:"pointer",fontFamily:fm}}>{v}</button>})}</div>
            {revs[c.id]!=null&&revs[c.id]!==c.conviction&&<div style={{fontSize:10,color:K.acc,fontFamily:fm,marginTop:4}}>Changed from {c.conviction} to {revs[c.id]}</div>}
          </div>
          {/* Action flag */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:8}}>ACTION THIS WEEK</div>
            <div style={{display:"flex",gap:6}}>
              {[{id:"hold",l:"Hold",c:K.mid},{id:"add",l:"Add",c:K.grn},{id:"trim",l:"Trim",c:K.amb},{id:"review",l:"Deep Review",c:K.acc},{id:"sell",l:"Consider Sell",c:K.red}].map(function(a){
                var act=actions[c.id]||"hold";
                return<button key={a.id} onClick={function(){setAction(c.id,a.id)}}
                  style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+(act===a.id?a.c+"60":K.bdr),
                    background:act===a.id?a.c+"12":"transparent",color:act===a.id?a.c:K.dim,
                    fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{a.l}</button>})}</div></div>
          {/* Note */}
          <input value={notes[c.id]||""} onChange={function(e){setNote(c.id,e.target.value)}} placeholder="Quick note (optional)..."
            style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 12px",fontSize:12,fontFamily:fm,outline:"none"}}/>
          {/* Nav */}
          <div style={{display:"flex",gap:12,marginTop:20}}>
            <button onClick={prevHolding} disabled={idx===0} style={Object.assign({},S.btn,{opacity:idx===0?.3:1})}>← Prev</button>
            <div style={{flex:1}}/>
            <button onClick={nextHolding} style={S.btnP}>{idx===portfolio.length-1?"Finish →":"Next →"}</button>
          </div>
        </div>
      </div>}

      {step==="summary"&&<div style={{position:"fixed",inset:0,zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.6)",backdropFilter:"blur(8px)",animation:"fadeInFast .2s ease"}}>
        <div className="ta-celebrate" style={{background:K.card,borderRadius:20,padding:isMobile?"24px 20px":"36px 40px",width:isMobile?"94vw":460,maxWidth:"94vw",maxHeight:"90vh",overflow:"auto",position:"relative",border:"2px solid "+K.grn+"40",boxShadow:"0 0 60px "+K.grn+"15, 0 20px 60px rgba(0,0,0,.3)"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,"+K.grn+","+K.acc+","+K.grn+")",backgroundSize:"200% 100%"}}/>
          {/* Header */}
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:56,marginBottom:8,animation:"glowPulse 2.5s ease-in-out infinite",display:"inline-block",filter:"drop-shadow(0 0 16px rgba(255,215,0,.5))"}}>{String.fromCodePoint(0x1F3C6)}</div>
            <div style={{fontSize:22,fontWeight:600,color:K.txt,fontFamily:fh,marginBottom:4}}>Review Complete</div>
            <div style={{fontSize:12,color:K.dim,lineHeight:1.6}}>Confirm to save convictions and open your weekly chest.</div>
          </div>
          {/* Stats row */}
          <div style={{display:"flex",justifyContent:"center",gap:24,marginBottom:20}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:K.txt,fontFamily:fm,lineHeight:1}}>{portfolio.length}</div><div style={{fontSize:9,color:K.dim,marginTop:2}}>Reviewed</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:K.acc,fontFamily:fm,lineHeight:1}}>{Object.keys(revs).filter(function(k){return revs[k]!==(cos.find(function(x){return x.id===parseInt(k)||x.id===k})||{}).conviction}).length}</div><div style={{fontSize:9,color:K.dim,marginTop:2}}>Changed</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,color:K.grn,fontFamily:fm,lineHeight:1}}>{Object.values(actions).filter(function(a){return a!=="hold"}).length}</div><div style={{fontSize:9,color:K.dim,marginTop:2}}>Actions</div></div>
          </div>
          {/* Compact holdings — horizontal wrap pills */}
          <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:24,maxHeight:120,overflow:"auto"}}>
            {portfolio.map(function(c2){var newConv=revs[c2.id]!=null?revs[c2.id]:c2.conviction;var changed=newConv!==c2.conviction;var act=actions[c2.id]||"hold";
              return<div key={c2.id} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:changed?K.acc+"10":K.bg,border:"1px solid "+(changed?K.acc+"30":K.bdr),fontSize:11,fontFamily:fm}}>
                <span style={{fontWeight:600,color:K.txt}}>{c2.ticker}</span>
                {changed?<span style={{color:K.acc,fontWeight:600}}>{c2.conviction+"→"+newConv}</span>:<span style={{color:K.dim}}>{newConv}</span>}
                {act!=="hold"&&<span style={{fontSize:8,fontWeight:700,color:act==="add"?K.grn:act==="sell"?K.red:K.amb,textTransform:"uppercase"}}>{act}</span>}
              </div>})}</div>
          {/* Chest preview */}
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:K.grn+"08",border:"1px solid "+K.grn+"20",borderRadius:8,padding:"8px 16px"}}>
              <span style={{fontSize:18,animation:"glowPulse 2s ease-in-out infinite"}}>{String.fromCodePoint(0x1F381)}</span>
              <span style={{fontSize:11,color:K.grn,fontWeight:600,fontFamily:fm}}>+25 pts & Weekly Insight awaits</span></div></div>
          {/* CTA */}
          <button onClick={finishReview} className="ta-glow" style={Object.assign({},S.btnP,{fontSize:16,padding:"16px 0",borderRadius:12,width:"100%",fontWeight:700,background:K.grn,border:"2px solid "+K.grn,color:"#ffffff",boxShadow:"0 4px 20px "+K.grn+"40"})}>
            {String.fromCodePoint(0x2705)+" Complete Review & Claim Insight"}</button>
          <div style={{textAlign:"center",marginTop:12}}><button onClick={function(){setStep("review");setIdx(0)}} style={{background:"none",border:"none",color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fm}}>← Go back and edit</button></div>
        </div>
      </div>}

      {step==="done"&&<div>
        {/* ── This week's reward ── */}
        {(latestWeeklyReward||chestRewards.history.length>0)&&(function(){
          var reward=latestWeeklyReward;
          var tierColors={rare:"#FFD700",uncommon:"#a78bfa",common:K.mid};
          var tierLabels={rare:"Rare",uncommon:"Uncommon",common:"Common"};
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:14,padding:"28px 24px",marginBottom:20}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:48,marginBottom:8,animation:"glowPulse 2.5s ease-in-out infinite",display:"inline-block",filter:"drop-shadow(0 0 12px rgba(255,215,0,.4))"}}>{String.fromCodePoint(0x1F3C6)}</div>
              <div style={{fontSize:14,fontWeight:600,color:"#FFD700",fontFamily:fm,letterSpacing:1,marginBottom:4}}>THIS WEEK'S REVIEW COMPLETE</div>
              <div style={{fontSize:12,color:K.dim}}>Come back next week to keep the streak alive.</div></div>
            {reward&&<div style={{textAlign:"center",padding:"20px 16px",background:K.bg,borderRadius:12,border:"1px solid "+(tierColors[reward.tier]||K.bdr)+"40",marginBottom:16}}>
              <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:tierColors[reward.tier]||K.dim,fontFamily:fm,marginBottom:6}}>{"THIS WEEK’S REWARD — "+tierLabels[reward.tier||"common"]}</div>
              <div style={{fontSize:36,marginBottom:6}}>{reward.icon}</div>
              <div style={{fontSize:16,fontWeight:600,color:K.txt,fontFamily:fh,marginBottom:4}}>{reward.label}</div>
              <div style={{fontSize:12,color:K.mid,lineHeight:1.6,maxWidth:300,margin:"0 auto"}}>{reward.desc}</div>
              {reward.author&&<div style={{fontSize:11,color:K.dim,fontStyle:"italic",marginTop:4}}>{"— "+reward.author}</div>}
              {reward.xp>0&&<div style={{display:"inline-block",background:K.grn+"12",border:"1px solid "+K.grn+"25",borderRadius:6,padding:"3px 10px",marginTop:8}}>
                <span style={{fontSize:11,fontWeight:600,color:K.grn,fontFamily:fm}}>+{reward.xp} pts</span></div>}
            </div>}
            {/* Previously earned rewards */}
            {chestRewards.history.length>0&&<div>
              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:10}}>REWARD HISTORY</div>
              <div style={{maxHeight:180,overflow:"auto"}}>
              {chestRewards.history.slice(0,20).map(function(h,hi){
                var tc=h.tier==="rare"?"#FFD700":h.tier==="uncommon"?"#a78bfa":K.dim;
                var d=h.date?new Date(h.date):null;
                var dateStr=d?d.toLocaleDateString("en-US",{month:"short",day:"numeric"}):"";
                return<div key={hi} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:hi<Math.min(chestRewards.history.length,20)-1?"1px solid "+K.bdr+"30":"none"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:tc,flexShrink:0}}/>
                  <div style={{fontSize:11,color:K.txt,fontFamily:fm,flex:1}}>{h.reward}</div>
                  <div style={{fontSize:9,color:tc,fontWeight:600,fontFamily:fm,textTransform:"uppercase"}}>{h.tier}</div>
                  <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>{dateStr}</div>
                </div>})}</div>
            </div>}
          </div>})()}

        {/* Past reviews */}
        {weeklyReviews.length>0&&<div style={{marginTop:12}}>
          <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Review History</div>
          {weeklyReviews.slice(0,12).map(function(r,ri){
            return<div key={ri} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 18px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>Week of {r.weekId}</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{r.summary.total} holdings · {r.summary.changed} changes · avg {r.summary.avgConv}/10</div></div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {r.entries.map(function(e){var changed=e.prev!==e.new;
                  return<div key={e.ticker} style={{padding:"3px 8px",borderRadius:4,background:changed?K.acc+"12":K.bg,border:"1px solid "+(changed?K.acc+"30":K.bdr),fontSize:10,fontFamily:fm,color:changed?K.acc:K.dim}}>
                    {e.ticker} {changed?e.prev+"→"+e.new:e.new}</div>})}</div>
            </div>})}</div>}
      </div>}
    </div>}

  // ── Portfolio Analytics (Munger-focused) ─────────────────
  function PortfolioAnalytics(){
    var portCos=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
    var _moats=useState({}),moats=_moats[0],setMoats=_moats[1];
    var _ldM=useState(true),ldM=_ldM[0],setLdM=_ldM[1];
    var _prog=useState(0),prog=_prog[0],setProg=_prog[1];
    useEffect(function(){if(portCos.length===0||!isPro){setLdM(false);return}
      var done=0;var results={};
      portCos.forEach(function(c){
        fetchFinancialStatements(c.ticker,"annual").then(function(r){
          var m=calcMoatFromData(r);if(m)results[c.id]=m;done++;setProg(done);
          if(done>=portCos.length){setMoats(results);setLdM(false)}
        }).catch(function(){done++;setProg(done);if(done>=portCos.length){setMoats(results);setLdM(false)}})})
    },[cos.length]);

    // Build enriched holdings with per-dimension scores
    var withMoat=portCos.filter(function(c2){return moats[c2.id]}).map(function(c2){
      var m=moats[c2.id];var dims={};m.metrics.forEach(function(met){dims[met.id]=met});
      return{company:c2,moat:m,dims:dims}});

    // Dimension averages across the portfolio
    var dimIds=["grossMargin","revGrowth","opLeverage","roic","fcfConversion","fortress","rdIntensity","netMargin"];
    var dimLabels={grossMargin:"Pricing Power",revGrowth:"Revenue Growth",opLeverage:"Operating Leverage",roic:"Capital Efficiency",fcfConversion:"Earnings Quality",fortress:"Financial Strength",rdIntensity:"R&D Moat",netMargin:"Profitability"};
    var dimIcons={grossMargin:"shield",revGrowth:"trending",opLeverage:"gear",roic:"target",fcfConversion:"dollar",fortress:"castle",rdIntensity:"flask",netMargin:"bar"};
    var dimAvgs={};dimIds.forEach(function(d){var scores=withMoat.map(function(x){
      if(d==="grossMargin"&&x.company.pricingPower&&x.company.pricingPower.score!=null)return x.company.pricingPower.score;
      return x.dims[d]?x.dims[d].score:null}).filter(function(v){return v!=null});
      dimAvgs[d]=scores.length>0?Math.round(scores.reduce(function(s,v){return s+v},0)/scores.length):null});

    var avgMoat=withMoat.length>0?Math.round(withMoat.reduce(function(s,x){return s+x.moat.composite},0)/withMoat.length):0;

    // Munger summary pillars
    var fortressAvg=dimAvgs.fortress;var pricingAvg=dimAvgs.grossMargin;var roicAvg=dimAvgs.roic;var fcfAvg=dimAvgs.fcfConversion;

    // Strongest / weakest
    var sorted=withMoat.slice().sort(function(a,b){return b.moat.composite-a.moat.composite});
    var strongest=sorted.slice(0,3);var weakest=sorted.slice().reverse().slice(0,3);

    // Table data
    var holdings=withMoat.map(function(x){
      return{ticker:x.company.ticker,domain:x.company.domain,id:x.company.id,moat:x.moat.composite,
        fortress:x.dims.fortress?x.dims.fortress.score:null,
        pricing:(x.company.pricingPower&&x.company.pricingPower.score!=null)?x.company.pricingPower.score:(x.dims.grossMargin?x.dims.grossMargin.score:null),
        roic:x.dims.roic?x.dims.roic.score:null,
        fcf:x.dims.fcfConversion?x.dims.fcfConversion.score:null}
    }).sort(function(a,b){return b.moat-a.moat});

    // Munger "wonderful at fair price" filter — flag companies with ROIC < 6 or fortress < 4
    var redFlags=withMoat.filter(function(x){
      var r=x.dims.roic?x.dims.roic.score:10;var f=x.dims.fortress?x.dims.fortress.score:10;
      return r<5||f<4});

    var secStyle={fontSize:11,letterSpacing:1,textTransform:"uppercase",color:K.dim,marginBottom:14,fontWeight:600,fontFamily:fb,display:"flex",alignItems:"center",gap:8};

    return<div style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:1100}}>
      <div style={{padding:"28px 0 20px"}}><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>Portfolio Analytics</h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{portCos.length} portfolio companies{ldM?" • Analyzing ("+prog+"/"+portCos.length+")":withMoat.length>0?" • "+withMoat.length+" analyzed":""}</p></div>

      {ldM?<div style={{padding:40,textAlign:"center"}}><div style={{fontSize:13,color:K.dim}}>Analyzing financial quality of {portCos.length} companies...</div>
        <div style={{height:4,borderRadius:2,background:K.bdr,maxWidth:300,margin:"16px auto"}}><div style={{height:"100%",borderRadius:2,background:K.acc,width:(portCos.length>0?prog/portCos.length*100:0)+"%",transition:"width .3s"}}/></div></div>:
      <div>
      {/* ── Munger's 4 Pillars ── */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:12,marginBottom:24}}>
        {[{label:"Business Quality",val:avgMoat,sub:avgMoat>0?moatLabel(avgMoat):"",icon:"shield"},
          {label:"Financial Strength",val:fortressAvg,sub:fortressAvg>=8?"Fortress":fortressAvg>=6?"Solid":fortressAvg>=4?"Adequate":"Fragile",icon:"castle"},
          {label:"Pricing Power",val:pricingAvg,sub:pricingAvg>=8?"Exceptional":pricingAvg>=6?"Strong":pricingAvg>=4?"Moderate":"Weak",icon:"dollar"},
          {label:"Capital Efficiency",val:roicAvg,sub:roicAvg>=8?"Outstanding":roicAvg>=6?"Good":roicAvg>=4?"Fair":"Poor",icon:"target"}
        ].map(function(card){var v=card.val;var clr=v>=8?K.grn:v>=6?K.acc:v>=4?K.amb:v?K.red:K.dim;
          return<div key={card.label} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><IC name={card.icon} size={14} color={K.dim}/><div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:K.dim,fontWeight:600,fontFamily:fb}}>{card.label}</div></div>
            <div style={{fontSize:28,fontWeight:700,color:clr,fontFamily:fm}}>{v||"—"}<span style={{fontSize:12,fontWeight:400,color:K.dim}}>/10</span></div>
            <div style={{fontSize:10,color:clr,marginTop:4,fontFamily:fb}}>{v?card.sub:""}</div></div>})}</div>

      {/* ── Portfolio Quality Profile (all 8 dimensions) ── */}
      {withMoat.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
        <div style={secStyle}><IC name="bar" size={14} color={K.dim}/>Portfolio Quality Profile</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {dimIds.map(function(d){var avg2=dimAvgs[d];if(avg2===null)return null;
            var clr=avg2>=8?K.grn:avg2>=6?K.acc:avg2>=4?K.amb:K.red;
            return<div key={d} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0"}}>
              <IC name={dimIcons[d]} size={14} color={K.dim}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:12,color:K.mid,fontFamily:fb}}>{dimLabels[d]}</span>
                  <span style={{fontSize:12,fontWeight:600,color:clr,fontFamily:fm}}>{avg2}</span></div>
                <div style={{height:4,borderRadius:2,background:K.bdr}}><div style={{height:"100%",width:avg2*10+"%",borderRadius:2,background:clr,transition:"width .5s"}}/></div></div></div>})}
        </div>
        <div style={{marginTop:14,fontSize:11,color:K.dim,lineHeight:1.6,fontFamily:fb}}>Average scores across {withMoat.length} companies. Dimensions below 6 are portfolio-wide vulnerabilities.</div></div>}

      {/* ── Red Flags: Munger "avoid losers" ── */}
      {redFlags.length>0&&<div style={{background:K.red+"08",border:"1px solid "+K.red+"20",borderRadius:12,padding:"20px 24px",marginBottom:24}}>
        <div style={secStyle}><IC name="alert" size={14} color={K.red}/>Needs Attention</div>
        <div style={{fontSize:12,color:K.mid,marginBottom:14,lineHeight:1.6,fontFamily:fb}}>These holdings have weak capital efficiency or fragile balance sheets. Munger would ask: why do I own this?</div>
        {redFlags.map(function(x){var issues=[];
          if(x.dims.roic&&x.dims.roic.score<5)issues.push("Low ROIC ("+x.dims.roic.value+")");
          if(x.dims.fortress&&x.dims.fortress.score<4)issues.push("Weak balance sheet ("+x.dims.fortress.value+")");
          if(x.dims.fcfConversion&&x.dims.fcfConversion.score<4)issues.push("Poor FCF conversion ("+x.dims.fcfConversion.value+")");
          if(x.dims.grossMargin){var ppOver=(x.company.pricingPower&&x.company.pricingPower.score!=null)?x.company.pricingPower.score:x.dims.grossMargin.score;if(ppOver<4)issues.push("Weak pricing power ("+ppOver+"/10)")};
          return<div key={x.company.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,cursor:"pointer",padding:"8px 12px",background:K.card,borderRadius:8,border:"1px solid "+K.bdr}} onClick={function(){setSelId(x.company.id);setDetailTab("research");setPage("dashboard")}}>
            <CoLogo domain={x.company.domain} ticker={x.company.ticker} size={24}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{x.company.ticker}</div>
              <div style={{fontSize:10,color:K.red,fontFamily:fb}}>{issues.join(" • ")}</div></div>
            <div style={{fontSize:16,fontWeight:700,color:moatColor(x.moat.composite),fontFamily:fm}}>{x.moat.composite}</div></div>})}</div>}

      {/* ── Strongest / Weakest ── */}
      {withMoat.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
          <div style={secStyle}><IC name="trending" size={14} color={K.grn}/>Strongest Businesses</div>
          {strongest.map(function(x){return<div key={x.company.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,cursor:"pointer",padding:"6px 0"}} onClick={function(){setSelId(x.company.id);setPage("dashboard")}}>
            <CoLogo domain={x.company.domain} ticker={x.company.ticker} size={24}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{x.company.ticker}</div><div style={{fontSize:10,color:K.dim,fontFamily:fb}}>{moatLabel(x.moat.composite)}</div></div>
            <div style={{fontSize:18,fontWeight:700,color:moatColor(x.moat.composite),fontFamily:fm}}>{x.moat.composite}</div></div>})}</div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
          <div style={secStyle}><IC name="alert" size={14} color={K.amb}/>Weakest Links</div>
          {weakest.map(function(x){return<div key={x.company.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,cursor:"pointer",padding:"6px 0"}} onClick={function(){setSelId(x.company.id);setPage("dashboard")}}>
            <CoLogo domain={x.company.domain} ticker={x.company.ticker} size={24}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{x.company.ticker}</div><div style={{fontSize:10,color:K.dim,fontFamily:fb}}>{moatLabel(x.moat.composite)}</div></div>
            <div style={{fontSize:18,fontWeight:700,color:moatColor(x.moat.composite),fontFamily:fm}}>{x.moat.composite}</div></div>})}</div></div>}

      {/* ── Holdings Quality Table ── */}
      {holdings.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
        <div style={secStyle}><IC name="overview" size={14} color={K.dim}/>Holdings Quality</div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["","Company","Moat","Fortress","Pricing","ROIC","Earnings Q."].map(function(h){return<th key={h} style={{textAlign:h===""||h==="Company"?"left":"center",padding:"8px 10px",fontSize:10,color:K.dim,borderBottom:"1px solid "+K.bdr,fontFamily:fb,fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>})}</tr></thead>
          <tbody>{holdings.map(function(q,i){
            function cellClr(v){return v>=8?K.grn:v>=6?K.acc:v>=4?K.amb:v?K.red:K.dim}
            return<tr key={q.id} style={{cursor:"pointer"}} onClick={function(){setSelId(q.id);setDetailTab("research");setPage("dashboard")}}>
              <td style={{padding:"10px 10px",fontSize:11,color:K.dim,fontFamily:fm,borderBottom:"1px solid "+K.bdr+"50"}}>{i+1}</td>
              <td style={{padding:"10px 10px",borderBottom:"1px solid "+K.bdr+"50"}}><div style={{display:"flex",alignItems:"center",gap:8}}><CoLogo domain={q.domain} ticker={q.ticker} size={20}/><span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{q.ticker}</span></div></td>
              <td style={{padding:"10px 10px",textAlign:"center",borderBottom:"1px solid "+K.bdr+"50"}}><span style={{fontSize:13,fontWeight:700,color:moatColor(q.moat),fontFamily:fm,background:moatColor(q.moat)+"15",padding:"3px 10px",borderRadius:4}}>{q.moat}</span></td>
              {[q.fortress,q.pricing,q.roic,q.fcf].map(function(v,vi){return<td key={vi} style={{padding:"10px 10px",textAlign:"center",fontSize:13,fontWeight:600,color:v?cellClr(v):K.dim,fontFamily:fm,borderBottom:"1px solid "+K.bdr+"50"}}>{v||"—"}</td>})}</tr>})}</tbody></table></div></div>}

      {/* ── Investment Style Distribution ── */}
      {function(){var styleCounts={};portCos.forEach(function(co){var sid=co.investStyle||"unset";styleCounts[sid]=(styleCounts[sid]||0)+1});
        var hasStyles=portCos.some(function(co){return co.investStyle});
        if(!hasStyles)return null;
        var total=portCos.length;
        return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
          <div style={secStyle}><IC name="bar" size={14} color={K.dim}/>Investment Style Mix</div>
          <div style={{fontSize:12,color:K.dim,marginBottom:16}}>How your portfolio is distributed across investment approaches.</div>
          <div style={{display:"flex",gap:3,height:28,borderRadius:6,overflow:"hidden",marginBottom:14}}>
            {INVEST_STYLES.map(function(st){var cnt=styleCounts[st.id]||0;if(!cnt)return null;
              return<div key={st.id} style={{flex:cnt,background:st.color,display:"flex",alignItems:"center",justifyContent:"center",minWidth:cnt/total>0.12?0:28}} title={st.label+": "+cnt}>
                <span style={{fontSize:10,fontWeight:700,color:"#fff",fontFamily:fm}}>{cnt}</span></div>}).filter(Boolean)}
            {styleCounts.unset&&<div style={{flex:styleCounts.unset,background:K.bdr,display:"flex",alignItems:"center",justifyContent:"center"}} title={"Unclassified: "+styleCounts.unset}>
              <span style={{fontSize:10,fontWeight:700,color:K.dim,fontFamily:fm}}>{styleCounts.unset}</span></div>}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {INVEST_STYLES.map(function(st){var cnt=styleCounts[st.id]||0;if(!cnt)return null;
              var pct=Math.round(cnt/total*100);var names=portCos.filter(function(co){return co.investStyle===st.id}).map(function(co){return co.ticker});
              return<div key={st.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:st.color+"08",border:"1px solid "+st.color+"25",borderRadius:8,flex:"1 1 200px"}}>
                <IC name={st.icon} size={14} color={st.color}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{st.label} <span style={{fontWeight:400,color:st.color}}>{pct}%</span></div>
                  <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{names.join(", ")}</div></div></div>}).filter(Boolean)}
            {styleCounts.unset&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,flex:"1 1 200px"}}>
              <IC name="alert" size={14} color={K.dim}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:K.mid,fontFamily:fm}}>Unclassified <span style={{fontWeight:400,color:K.dim}}>{Math.round(styleCounts.unset/total*100)}%</span></div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{portCos.filter(function(co){return!co.investStyle}).map(function(co){return co.ticker}).join(", ")}</div></div></div>}
          </div>
        </div>}()}
      {/* ── Moat Source Map ── */}
      {function(){var typeCounts={};var typeCompanies={};
        portCos.forEach(function(co){var mt=co.moatTypes||{};
          MOAT_TYPES.forEach(function(t){if(mt[t.id]&&mt[t.id].active){typeCounts[t.id]=(typeCounts[t.id]||0)+1;
            if(!typeCompanies[t.id])typeCompanies[t.id]=[];
            typeCompanies[t.id].push({ticker:co.ticker,strength:mt[t.id].strength||3})}})});
        var activeTypes=MOAT_TYPES.filter(function(t){return typeCounts[t.id]});
        var unclass=portCos.filter(function(co){var mt2=co.moatTypes||{};return!MOAT_TYPES.some(function(t){return mt2[t.id]&&mt2[t.id].active})});
        if(activeTypes.length===0)return null;
        return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
          <div style={secStyle}><IC name="castle" size={14} color={K.dim}/>Moat Source Map</div>
          <div style={{fontSize:12,color:K.dim,marginBottom:16}}>What protects your portfolio? Distribution of competitive advantages across holdings.</div>
          <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {activeTypes.map(function(t){var cos2=typeCompanies[t.id]||[];var avgStr=cos2.length?Math.round(cos2.reduce(function(s,x){return s+x.strength},0)/cos2.length*10)/10:0;
              return<div key={t.id} style={{padding:"14px 16px",borderRadius:8,background:t.color+"08",border:"1px solid "+t.color+"25"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{width:24,height:24,borderRadius:5,background:t.color+"15",display:"flex",alignItems:"center",justifyContent:"center"}}><IC name={t.icon} size={12} color={t.color}/></div>
                  <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{t.label}</div></div>
                  <span style={{fontSize:18,fontWeight:700,color:t.color,fontFamily:fm}}>{cos2.length}</span></div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {cos2.sort(function(a,b){return b.strength-a.strength}).map(function(x){
                    return<span key={x.ticker} style={{fontSize:10,fontWeight:600,color:t.color,background:t.color+"15",padding:"2px 8px",borderRadius:3,fontFamily:fm}}>{x.ticker} {"•".repeat(x.strength)}</span>})}</div>
                <div style={{fontSize:10,color:K.dim,marginTop:6,fontFamily:fm}}>Avg strength: {avgStr}/5</div></div>})}</div>
          {unclass.length>0&&<div style={{marginTop:12,padding:"10px 14px",background:K.amb+"08",border:"1px solid "+K.amb+"25",borderRadius:8}}>
              <div style={{fontSize:11,color:K.amb,fontWeight:600}}>Unclassified: {unclass.map(function(c2){return c2.ticker}).join(", ")}</div>
              <div style={{fontSize:10,color:K.dim,marginTop:2}}>Visit the Moat Tracker for each company to classify their competitive advantages.</div></div>}
        </div>}()}

      {/* ── Munger Quote ── */}
      {withMoat.length>0&&<div style={{padding:"20px 24px",background:K.card,border:"1px solid "+K.bdr,borderRadius:12}}>
        <div style={{fontSize:13,color:K.mid,lineHeight:1.7,fontStyle:"italic",fontFamily:fh}}>{"\"Over the long term, it’s hard for a stock to earn a much better return than the business which underlies it earns. If the business earns 6% on capital over 40 years and you hold it for that 40 years, you’re not going to make much different than a 6% return.\""}</div>
        <div style={{fontSize:11,color:K.dim,marginTop:8,fontFamily:fb}}>{"—"} Charlie Munger</div></div>}

      {portCos.length===0&&<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim}}>No portfolio companies yet. Add companies and set their status to Portfolio.</div></div>}
      </div>}</div>}


  // ── Dividend Hub ──────────────────────────────────────
  function DividendHub(){
    var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
    var divPayers=portfolio.filter(function(c){var dps=c.divPerShare||c.lastDiv||0;return dps>0});
    var nonPayers=portfolio.filter(function(c){var dps=c.divPerShare||c.lastDiv||0;return dps<=0});
    // Sort by annual yield desc
    divPayers.sort(function(a,b){
      var aPos=a.position||{};var bPos=b.position||{};
      var aDps=a.divPerShare||a.lastDiv||0;var bDps=b.divPerShare||b.lastDiv||0;
      var aMult=a.divFrequency==="monthly"?12:a.divFrequency==="semi"?2:a.divFrequency==="annual"?1:4;
      var bMult=b.divFrequency==="monthly"?12:b.divFrequency==="semi"?2:b.divFrequency==="annual"?1:4;
      var aYld=aPos.currentPrice?aDps*aMult/aPos.currentPrice:0;var bYld=bPos.currentPrice?bDps*bMult/bPos.currentPrice:0;
      return bYld-aYld});
    var totalAnnual=0;var totalValue=0;
    divPayers.forEach(function(c){var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
      totalAnnual+=(pos.shares||0)*dps*mult;totalValue+=(pos.shares||0)*(pos.currentPrice||0)});
    var portfolioYield=totalValue>0?(totalAnnual/totalValue*100):0;
    var monthlyIncome=totalAnnual/12;
    // Estimate next payout based on ex-div dates
    var freqLabel=function(f){return f==="monthly"?"Monthly":f==="semi"?"Semi-Annual":f==="annual"?"Annual":"Quarterly"};
    // Approximate next payment months based on frequency
    function estimatePayMonths(c){
      var freq=c.divFrequency||"quarterly";
      if(freq==="monthly")return[0,1,2,3,4,5,6,7,8,9,10,11];
      if(freq==="annual")return c.exDivDate?[new Date(c.exDivDate).getMonth()]:[5];
      if(freq==="semi")return c.exDivDate?[new Date(c.exDivDate).getMonth(),(new Date(c.exDivDate).getMonth()+6)%12]:[2,8];
      // Quarterly: if we have ex-div date, estimate 4 quarters from it
      if(c.exDivDate){var m=new Date(c.exDivDate).getMonth();return[m,(m+3)%12,(m+6)%12,(m+9)%12]}
      return[2,5,8,11]}
    var monthNames=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    // Build monthly income calendar
    var monthlyBreakdown=monthNames.map(function(mn,mi){
      var income=0;var payers=[];
      divPayers.forEach(function(c){var months=estimatePayMonths(c);if(months.indexOf(mi)===-1)return;
        var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var payout=(pos.shares||0)*dps;
        if(payout>0){income+=payout;payers.push({ticker:c.ticker,amount:payout})}});
      return{month:mn,income:income,payers:payers}});
    var maxMonthly=Math.max.apply(null,monthlyBreakdown.map(function(m){return m.income}))||1;
    return<div className="ta-page-pad" style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:960}}>
      <div style={{padding:"28px 0 20px"}}><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>Dividend Hub</h1>
        <p style={{margin:"6px 0 0",fontSize:13,color:K.dim}}>Track income from your dividend-paying holdings</p></div>
      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:12,marginBottom:24}}>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:1}}>ANNUAL INCOME</div><div style={{fontSize:22,fontWeight:700,color:K.grn,fontFamily:fm}}>${totalAnnual.toFixed(0)}</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:1}}>MONTHLY AVG</div><div style={{fontSize:22,fontWeight:700,color:K.grn,fontFamily:fm}}>${monthlyIncome.toFixed(0)}</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:1}}>PORTFOLIO YIELD</div><div style={{fontSize:22,fontWeight:700,color:K.acc,fontFamily:fm}}>{portfolioYield.toFixed(2)}%</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:1}}>PAYERS</div><div style={{fontSize:22,fontWeight:700,color:K.txt,fontFamily:fm}}>{divPayers.length}<span style={{fontSize:13,color:K.dim,fontWeight:400}}>/{portfolio.length}</span></div></div>
      </div>
      {/* Monthly income calendar */}
      {totalAnnual>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
        <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:14,fontFamily:fm}}>Monthly Income Calendar</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(12, 1fr)",gap:isMobile?4:8}}>
          {monthlyBreakdown.map(function(m,i){var h=m.income>0?Math.max(8,Math.round(m.income/maxMonthly*60)):4;var isNow=new Date().getMonth()===i;
            return<div key={i} style={{textAlign:"center"}}>
              <div style={{height:80,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}}>
                {m.income>0&&<div style={{fontSize:isMobile?7:9,color:K.grn,fontFamily:fm,marginBottom:2}}>${m.income.toFixed(0)}</div>}
                <div style={{width:"100%",height:h,background:m.income>0?K.grn:K.bdr,borderRadius:3,opacity:m.income>0?0.7:0.3}}/>
              </div>
              <div style={{fontSize:isMobile?8:10,color:isNow?K.acc:K.dim,fontWeight:isNow?700:400,fontFamily:fm,marginTop:4}}>{m.month}</div>
            </div>})}
        </div>
      </div>}
      {/* Payers table */}
      {divPayers.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
        <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:14,fontFamily:fm}}>Dividend Payers</div>
        <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid "+K.bdr}}>
            <th style={{textAlign:"left",padding:"8px 10px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>Company</th>
            <th style={{textAlign:"right",padding:"8px 10px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>Per Payment</th>
            <th style={{textAlign:"center",padding:"8px 10px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>Frequency</th>
            <th style={{textAlign:"right",padding:"8px 10px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>Yield</th>
            <th style={{textAlign:"right",padding:"8px 10px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>Annual/Share</th>
            <th style={{textAlign:"right",padding:"8px 10px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>Annual Income</th>
            {!isMobile&&<th style={{textAlign:"right",padding:"8px 10px",fontSize:10,color:K.dim,fontFamily:fm,fontWeight:600}}>Ex-Div Date</th>}
          </tr></thead>
          <tbody>{divPayers.map(function(c){
            var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;
            var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
            var annDps=dps*mult;var yld=pos.currentPrice?annDps/pos.currentPrice*100:0;
            var annIncome=(pos.shares||0)*annDps;
            return<tr key={c.id} style={{borderBottom:"1px solid "+K.bdr+"60",cursor:"pointer"}} onClick={function(){setSelId(c.id);setPage("dashboard");setSubPage(null)}}>
              <td style={{padding:"10px 10px",display:"flex",alignItems:"center",gap:8}}>
                <CoLogo domain={c.domain} ticker={c.ticker} size={20}/>
                <div><div style={{fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:10,color:K.dim}}>{c.name}</div></div></td>
              <td style={{textAlign:"right",padding:"10px 10px",color:K.txt,fontFamily:fm}}>${dps.toFixed(2)}</td>
              <td style={{textAlign:"center",padding:"10px 10px",color:K.mid,fontFamily:fm,fontSize:11}}>{freqLabel(c.divFrequency)}</td>
              <td style={{textAlign:"right",padding:"10px 10px",color:K.grn,fontWeight:600,fontFamily:fm}}>{yld.toFixed(2)}%</td>
              <td style={{textAlign:"right",padding:"10px 10px",color:K.txt,fontFamily:fm}}>${annDps.toFixed(2)}</td>
              <td style={{textAlign:"right",padding:"10px 10px",color:K.grn,fontWeight:600,fontFamily:fm}}>{pos.shares>0?"$"+annIncome.toFixed(0):<span style={{color:K.dim,fontSize:10}}>Add shares</span>}</td>
              {!isMobile&&<td style={{textAlign:"right",padding:"10px 10px",color:K.amb,fontFamily:fm,fontSize:11}}>{c.exDivDate?fD(c.exDivDate):"—"}</td>}
            </tr>})}</tbody>
        </table></div>
        {/* Total row */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 10px 0",borderTop:"2px solid "+K.bdr,marginTop:4}}>
          <span style={{fontSize:13,color:K.mid,fontWeight:500}}>Total Annual Income</span>
          <span style={{fontSize:16,fontWeight:700,color:K.grn,fontFamily:fm}}>${totalAnnual.toFixed(0)}</span></div>
      </div>}
      {/* Non-payers */}
      {nonPayers.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}>
        <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:10,fontFamily:fm}}>Non-Dividend Holdings ({nonPayers.length})</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{nonPayers.map(function(c){
          return<div key={c.id} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",background:K.bg,borderRadius:6,cursor:"pointer"}} onClick={function(){setSelId(c.id);setPage("dashboard");setSubPage(null)}}>
            <CoLogo domain={c.domain} ticker={c.ticker} size={16}/><span style={{fontSize:11,color:K.mid,fontFamily:fm}}>{c.ticker}</span></div>})}</div>
      </div>}
      {divPayers.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:K.dim}}>
        <div style={{fontSize:36,marginBottom:12}}>{String.fromCodePoint(0x1F4B0)}</div>
        <div style={{fontSize:14,marginBottom:6}}>No dividend data yet</div>
        <div style={{fontSize:12}}>Set dividends for your holdings in Position settings</div>
      </div>}
    </div>}

  // ── Earnings Calendar ──────────────────────────────────────
  function EarningsCalendar(){
    var allCos=cos.filter(function(c){return c.status==="portfolio"||c.status==="watchlist"});
    var upcoming=allCos.filter(function(c){return c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)>=0}).sort(function(a,b){return a.earningsDate>b.earningsDate?1:-1});
    var recent=allCos.filter(function(c){return c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)<0&&dU(c.earningsDate)>=-30}).sort(function(a,b){return b.earningsDate>a.earningsDate?-1:1});
    var tbdCos=allCos.filter(function(c){return!c.earningsDate||c.earningsDate==="TBD"});
    return<div className="ta-page-pad" style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:900}}>
      <div style={{padding:"28px 0 20px"}}><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>Earnings Calendar</h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{upcoming.length} upcoming · {recent.length} recent · {tbdCos.length} TBD</p></div>
      {/* This week */}
      {function(){var thisWeek=upcoming.filter(function(c){return dU(c.earningsDate)<=7});
        if(!thisWeek.length)return null;
        return<div style={{marginBottom:24}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.amb,marginBottom:10,fontFamily:fm,fontWeight:600}}>This Week</div>
          {thisWeek.map(function(c){var d=dU(c.earningsDate);var h=gH(c.kpis);
            return<div key={c.id} className="ta-card" style={{background:K.card,border:"1px solid "+K.amb+"30",borderLeft:"4px solid "+K.amb,borderRadius:12,padding:"14px 20px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:14}} onClick={function(){setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}>
              <CoLogo domain={c.domain} ticker={c.ticker} size={28}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker} <span style={{fontWeight:400,color:K.mid}}>{c.name}</span></div>
                <div style={{fontSize:11,color:K.dim,marginTop:2}}>{c.kpis.length} KPIs tracked · Conviction: {c.conviction||"—"}/10</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:K.amb,fontFamily:fm}}>{d===0?"Today":d===1?"Tomorrow":d+"d"}</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{fD(c.earningsDate)} {c.earningsTime}</div></div>
              <span style={S.badge(h.c)}>{h.l}</span></div>})}</div>}()}
      {/* Upcoming (>7 days) */}
      {function(){var later=upcoming.filter(function(c){return dU(c.earningsDate)>7});
        if(!later.length)return null;
        return<div style={{marginBottom:24}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:10,fontFamily:fm,fontWeight:600}}>Upcoming</div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
            {later.map(function(c,i){var d=dU(c.earningsDate);
              return<div key={c.id} style={{padding:"12px 16px",borderBottom:i<later.length-1?"1px solid "+K.bdr:"none",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={function(){setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}>
                <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
                <div style={{flex:1}}><span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</span> <span style={{fontSize:11,color:K.dim}}>{c.name}</span></div>
                <span style={{fontSize:11,color:K.mid,fontFamily:fm}}>{fD(c.earningsDate)} {c.earningsTime}</span>
                <span style={{fontSize:10,color:K.dim,fontFamily:fm,minWidth:30,textAlign:"right"}}>{d}d</span></div>})}</div></div>}()}
      {/* Recently reported */}
      {recent.length>0&&<div style={{marginBottom:24}}>
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:10,fontFamily:fm,fontWeight:600}}>Recently Reported</div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
          {recent.map(function(c,i){var h=gH(c.kpis);
            return<div key={c.id} style={{padding:"12px 16px",borderBottom:i<recent.length-1?"1px solid "+K.bdr:"none",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={function(){setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}>
              <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
              <div style={{flex:1}}><span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</span> <span style={{fontSize:11,color:K.dim}}>{c.name}</span></div>
              <span style={S.badge(h.c)}>{h.l}</span>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{fD(c.earningsDate)}</span></div>})}</div></div>}
      {tbdCos.length>0&&<div><div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:10,fontFamily:fm,fontWeight:600}}>Date Not Set ({tbdCos.length})</div>
        <div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>Earnings dates auto-update via Finnhub. These companies don't have a known upcoming date yet: {tbdCos.map(function(c){return c.ticker}).join(", ")}</div></div>}
    </div>}

  // ── CSV Import Modal ──────────────────────────────────────
  function CSVImportModal(){
    var _txt=useState(""),txt=_txt[0],setTxt=_txt[1];
    var _status=useState(null),status=_status[0],setStatus=_status[1];
    var _results=useState([]),results=_results[0],setResults=_results[1];
    var _importing=useState(false),importing=_importing[0],setImporting=_importing[1];
    function parseTickers(){var lines=txt.split(/[\n,;]+/).map(function(l){return l.trim().toUpperCase().replace(/[^A-Z.]/g,"")}).filter(function(l){return l.length>=1&&l.length<=6});
      var existing=cos.map(function(c){return c.ticker});
      return lines.filter(function(t,i){return lines.indexOf(t)===i&&existing.indexOf(t)<0})}
    var tickers=parseTickers();
    async function doImport(){if(!tickers.length)return;setImporting(true);setResults([]);
      var res=[];
      for(var i=0;i<tickers.length;i++){var t=tickers[i];
        try{setStatus("Looking up "+t+" ("+(i+1)+"/"+tickers.length+")...");
          var r=await lookupTicker(t);
          if(r&&!r.error){var nc={id:nId(cos.concat(res.filter(function(x){return x.ok}).map(function(x){return x.co}))),ticker:t,name:r.name,sector:r.sector||"",industry:r.industry||"",domain:r.domain||"",irUrl:r.irUrl||"",earningsDate:r.earningsDate||"TBD",earningsTime:r.earningsTime||"AMC",thesisNote:"",kpis:[],docs:[],earningsHistory:[],researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0,position:{shares:0,avgCost:0,currentPrice:r.price||0},conviction:0,convictionHistory:[],status:"watchlist",investStyle:"",lastDiv:r.lastDiv||0,divPerShare:r.lastDiv||0,divFrequency:"quarterly",exDivDate:"",lastChecked:null,notes:"",earningSummary:null,sourceUrl:null,sourceLabel:null,moatTypes:{},pricingPower:null,morningstarMoat:"",moatTrend:"",thesisVersions:[],thesisUpdatedAt:""};
            res.push({ticker:t,ok:true,name:r.name,co:nc})}
          else{res.push({ticker:t,ok:false,err:r.error||"Not found"})}}
        catch(e){res.push({ticker:t,ok:false,err:"Lookup failed"})}
        setResults(res.slice());
        await new Promise(function(r2){setTimeout(r2,400)})}
      // Add all successful
      var newCos=res.filter(function(x){return x.ok}).map(function(x){return x.co});
      if(newCos.length>0){setCos(function(p){return p.concat(newCos)})}
      setStatus(null);setImporting(false)}
    return<Modal title="Import Companies" onClose={function(){if(!importing)setModal(null)}} w={520} K={K}>
      <div style={{fontSize:12,color:K.dim,marginBottom:16,lineHeight:1.6}}>Paste tickers separated by commas, newlines, or semicolons. Each will be looked up via FMP and added to your Watchlist.</div>
      <textarea value={txt} onChange={function(e){setTxt(e.target.value)}} placeholder={"AAPL\nMSFT\nGOOG\nAMZN"} rows={5} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"12px",fontSize:13,fontFamily:fm,outline:"none",resize:"vertical",lineHeight:1.6}} disabled={importing}/>
      {tickers.length>0&&!importing&&<div style={{fontSize:11,color:K.acc,marginTop:8,fontFamily:fm}}>{tickers.length} new ticker{tickers.length>1?"s":""} found: {tickers.slice(0,15).join(", ")}{tickers.length>15?" +"+( tickers.length-15)+" more":""}</div>}
      {results.length>0&&<div style={{marginTop:12,maxHeight:160,overflowY:"auto"}}>{results.map(function(r){
        return<div key={r.ticker} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:11}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:r.ok?K.grn:K.red}}/>
          <span style={{fontWeight:600,color:K.txt,fontFamily:fm}}>{r.ticker}</span>
          <span style={{color:r.ok?K.mid:K.red}}>{r.ok?r.name:r.err}</span></div>})}</div>}
      {status&&<div style={{fontSize:11,color:K.acc,marginTop:8,fontFamily:fm}}>{status}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:16}}>
        <button style={S.btn} onClick={function(){if(!importing)setModal(null)}} disabled={importing}>Cancel</button>
        <button style={Object.assign({},S.btnP,{opacity:tickers.length>0&&!importing?1:.4})} onClick={doImport} disabled={!tickers.length||importing}>{importing?"Importing...":"Import "+tickers.length+" Companies"}</button></div></Modal>}

  // ── Watchlist Price Alerts ──────────────────────────────
  useEffect(function(){if(!loaded)return;
    cos.forEach(function(c){
      if(c.status==="watchlist"&&c.targetPrice>0&&c.position&&c.position.currentPrice>0&&c.position.currentPrice<=c.targetPrice){
        if(!notifs.some(function(n){return n.ticker===c.ticker&&n.type==="price-alert"&&n.price===c.targetPrice})){
          setNotifs(function(p){return[{id:Date.now()+Math.random(),type:"price-alert",ticker:c.ticker,msg:"Price $"+c.position.currentPrice.toFixed(2)+" is at or below your target of $"+c.targetPrice,time:new Date().toISOString(),read:false,price:c.targetPrice}].concat(p).slice(0,30)})}}})
  },[cos,loaded]);

  function Dashboard(){var filtered=cos.filter(function(c){return(c.status||"portfolio")===sideTab});
    // Sector diversification
    var sectors={};filtered.forEach(function(c){var s=c.sector||"Other";sectors[s]=(sectors[s]||0)+1});
    var sectorList=Object.keys(sectors).sort(function(a,b){return sectors[b]-sectors[a]});
    // Dividend data
    var divCos=filtered.filter(function(c){return(c.divPerShare||c.lastDiv)>0&&c.divFrequency!=="none"});
    var totalAnnualDiv=divCos.reduce(function(sum,c){var pos=c.position||{};var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;return sum+(pos.shares||0)*(c.divPerShare||c.lastDiv||0)*mult},0);
    return<div style={{padding:isMobile?"0 12px 60px":"0 32px 60px",maxWidth:1100}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"28px 0 20px"}}><div><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>{sideTab==="portfolio"?"Portfolio":sideTab==="toohard"?"Too-Hard Pile":"Watchlist"}</h1><p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{filtered.length} companies{sideTab==="toohard"?" • Outside your circle of competence":priceLoading?" • Updating prices…":""}</p></div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={function(){if(requirePro("earnings"))toggleAutoNotify()}} style={{display:"flex",alignItems:"center",gap:6,background:autoNotify?K.grn+"15":"transparent",border:"1px solid "+(autoNotify?K.grn+"40":K.bdr),borderRadius:6,padding:"7px 14px",fontSize:11,color:autoNotify?K.grn:K.dim,cursor:"pointer",fontFamily:fm}} title={autoNotify?"Auto-check ON — will auto-fetch earnings when they drop":"Click to enable: auto-checks earnings when released"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={autoNotify?K.grn:"none"} stroke={autoNotify?K.grn:K.dim} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {autoNotify?"Auto-check ON":"Auto-check"}</button>
        {autoNotify&&<button onClick={toggleEmailNotify} style={{display:"flex",alignItems:"center",gap:5,background:emailNotify?K.blue+"15":"transparent",border:"1px solid "+(emailNotify?K.blue+"40":K.bdr),borderRadius:6,padding:"7px 12px",fontSize:11,color:emailNotify?K.blue:K.dim,cursor:"pointer",fontFamily:fm}} title={emailNotify?"Get an email summary when earnings are found":"Get email summaries when earnings drop"}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={emailNotify?K.blue:K.dim} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
          {emailNotify?"Email Alert ON":"+ Email Alert"}</button>}
        <button style={S.btnChk} onClick={function(){if(requirePro("earnings"))checkAll()}}>Check All</button>
        <button style={Object.assign({},S.btn,{padding:"9px 14px",fontSize:11})} onClick={function(){exportCSV(filtered)}}>CSV</button>
        <button style={Object.assign({},S.btnP,{padding:"9px 18px",fontSize:12})} onClick={function(){setModal({type:"add"})}}>+ Add</button></div></div>
    {/* ── XP Float Animation ── */}
    {xpFloat&&<div key={xpFloat.id} style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:9999,pointerEvents:"none",animation:"xpfloat 1.8s ease-out forwards"}}>
      <div style={{fontSize:28,fontWeight:800,color:K.grn,fontFamily:fm,textShadow:"0 2px 8px rgba(0,0,0,0.3)",display:"flex",alignItems:"center",gap:6}}>+{xpFloat.amount}
        <span style={{fontSize:12,fontWeight:400,color:K.mid}}>{xpFloat.label}</span></div></div>}
    <style dangerouslySetInnerHTML={{__html:"@keyframes xpfloat{0%{opacity:1;transform:translate(-50%,-50%) scale(0.8)}20%{opacity:1;transform:translate(-50%,-60%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-120%) scale(0.9)}}"}}/>
    {/* ── Today's Focus Card (hero element, always first) ── */}
    {sideTab==="portfolio"&&filtered.length>0&&(function(){
      var focus=null;
      var portfolio=filtered;
      // Priority 1: Earnings within 3 days
      var urgent=portfolio.filter(function(c){return c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)>=0&&dU(c.earningsDate)<=3}).sort(function(a,b){return dU(a.earningsDate)-dU(b.earningsDate)});
      if(urgent.length>0){var uc=urgent[0];focus={color:K.amb,icon:"target",title:uc.ticker+" reports "+(dU(uc.earningsDate)===0?"today":dU(uc.earningsDate)===1?"tomorrow":"in "+dU(uc.earningsDate)+"d"),desc:"Review your thesis and "+uc.kpis.length+" KPIs before results drop",btn:"Prepare now",onClick:function(){setSelId(uc.id);setDetailTab("dossier");setPage("dashboard")}}}
      // Priority 2: Weekly review not done
      if(!focus&&!currentWeekReviewed){focus={color:K.grn,icon:"shield",title:"Weekly review time",desc:"Confirm your conviction across "+portfolio.length+" holdings. Takes 3 minutes.",btn:"Start review",onClick:function(){setPage("review")}}}
      // Priority 3: Thesis missing
      if(!focus){var noT=portfolio.filter(function(c){return!c.thesisNote||c.thesisNote.trim().length<20});if(noT.length>0)focus={color:K.acc,icon:"lightbulb",title:"Write your thesis for "+noT[0].ticker,desc:"Why do you own it? What's the moat? When would you sell?",btn:"Write thesis",onClick:function(){setSelId(noT[0].id);setPage("dashboard");setModal({type:"thesis"})}}}
      // Priority 4: Stale thesis
      if(!focus){var staleT=portfolio.filter(function(c){return c.thesisUpdatedAt&&Math.ceil((new Date()-new Date(c.thesisUpdatedAt))/864e5)>90}).sort(function(a,b){return new Date(a.thesisUpdatedAt)-new Date(b.thesisUpdatedAt)});if(staleT.length>0)focus={color:K.red,icon:"clock",title:staleT[0].ticker+" thesis is getting stale",desc:"Last updated "+(Math.ceil((new Date()-new Date(staleT[0].thesisUpdatedAt))/864e5))+" days ago. Still accurate?",btn:"Review thesis",onClick:function(){setSelId(staleT[0].id);setPage("dashboard");setModal({type:"thesis"})}}}
      // Priority 5: Missing conviction
      if(!focus){var noC=portfolio.filter(function(c){return!c.conviction});if(noC.length>0)focus={color:K.amb,icon:"trending",title:"Rate your conviction for "+noC[0].ticker,desc:"How confident are you in this position? 1-10.",btn:"Rate now",onClick:function(){setSelId(noC[0].id);setPage("dashboard");setModal({type:"conviction"})}}}
      // Priority 6: Missing KPIs
      if(!focus){var noK=portfolio.filter(function(c){return c.kpis.length===0});if(noK.length>0)focus={color:K.blue||K.acc,icon:"bar",title:"Add KPIs for "+noK[0].ticker,desc:"Define the metrics that prove or disprove your thesis — revenue, margins, retention.",btn:"Add KPIs",onClick:function(){setSelId(noK[0].id);setDetailTab("dossier");setPage("dashboard");setTimeout(function(){setModal({type:"kpi"})},100)}}}
      // Priority 7: Missing moat classification
      if(!focus){var noM=portfolio.filter(function(c){var mt=c.moatTypes||{};return!Object.keys(mt).some(function(k){return mt[k]&&mt[k].active})});if(noM.length>0)focus={color:"#9333EA",icon:"castle",title:"Classify the moat for "+noM[0].ticker,desc:"What gives this company its competitive advantage? Network effects, switching costs, brand?",btn:"Classify moat",onClick:function(){setSelId(noM[0].id);setSubPage("moat");setPage("dashboard")}}}
      // Priority 8: Missing position data
      if(!focus){var noPos=portfolio.filter(function(c){var p=c.position||{};return!p.shares||p.shares===0});if(noPos.length>0)focus={color:K.mid,icon:"trending",title:"Log your position in "+noPos[0].ticker,desc:"Add your shares and average cost to track performance.",btn:"Add position",onClick:function(){setSelId(noPos[0].id);setPage("dashboard")}}}
      // Did something today? Show encouragement, else generic prompt
      if(!focus&&didActivityToday)focus={color:K.grn,icon:"check",title:"Done for today",desc:"You showed up. Come back tomorrow to keep your streak alive.",btn:null,onClick:null};
      if(!focus)focus={color:K.acc,icon:"lightbulb",title:"Explore your portfolio",desc:"Open any holding to deepen your thesis, review KPIs, or check earnings history.",btn:null,onClick:null};
      return<div style={{background:focus.color+"08",border:"1px solid "+focus.color+"25",borderRadius:12,padding:"16px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:44,height:44,borderRadius:10,background:focus.color+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><IC name={focus.icon} size={20} color={focus.color}/></div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:focus.color,fontFamily:fm,marginBottom:2}}>Today's Focus</div>
          <div style={{fontSize:14,fontWeight:600,color:K.txt}}>{focus.title}</div>
          <div style={{fontSize:11,color:K.mid,marginTop:2}}>{focus.desc}</div></div>
        {focus.btn&&<button onClick={focus.onClick} style={{background:focus.color,color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm,whiteSpace:"nowrap"}}>{focus.btn}</button>}
      </div>})()}
    {/* ── Compact Streak/Process bar (collapsible, hidden until first action) ── */}
    {sideTab==="portfolio"&&filtered.length>0&&xp.total>0&&<div style={{marginBottom:16}}>
      {/* Compact summary line — always visible */}
      <div onClick={toggleDashGame} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 14px",background:K.card,border:"1px solid "+K.bdr,borderRadius:dashGameExpanded?"10px 10px 0 0":10,cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
          <span style={{fontSize:12}}>{String.fromCodePoint(0x1F525)}</span>
          <span style={{fontSize:11,fontWeight:600,color:dailyStreak.current>0?K.acc:K.dim,fontFamily:fm}}>{dailyStreak.current}d</span>
          <span style={{width:1,height:12,background:K.bdr}}/>
          <span style={{fontSize:11,fontWeight:600,color:streakData.current>0?K.grn:K.dim,fontFamily:fm}}>{streakData.current}w</span>
          {!didActivityToday&&dailyStreak.current>0&&<span style={{fontSize:9,color:K.amb,fontFamily:fm}}>streak expires tonight</span>}
          {didActivityToday&&<span style={{fontSize:9,color:K.grn,fontFamily:fm}}>{"✓ active"}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{position:"relative",width:22,height:22,flexShrink:0}}>
            <svg width={22} height={22} viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" fill="none" stroke={K.bdr} strokeWidth="2"/><circle cx="11" cy="11" r="9" fill="none" stroke={globalOS.total>=70?K.grn:globalOS.total>=40?K.amb:K.acc} strokeWidth="2" strokeDasharray={Math.round(globalOS.total/100*56)+" 56"} strokeLinecap="round" transform="rotate(-90 11 11)"/></svg>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:globalOS.total>=70?K.grn:globalOS.total>=40?K.amb:K.acc,fontFamily:fm}}>{globalOS.total}</div></div>
          <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{currentLevel.name}</span>
          {isDoubleXP&&<span style={{fontSize:9,color:K.amb,fontFamily:fm}}>{String.fromCodePoint(0x26A1)+" 2×"}</span>}
          <svg width="10" height="10" viewBox="0 0 10 10" style={{transform:dashGameExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}><path d="M2 3.5L5 6.5L8 3.5" stroke={K.dim} strokeWidth="1.5" fill="none"/></svg>
        </div>
      </div>
      {/* Expanded detail — full streak/XP cards */}
      {dashGameExpanded&&<div style={{display:"flex",gap:12,padding:"12px 14px",background:K.card,borderTop:"1px solid "+K.bdr+"50",borderRadius:"0 0 10px 10px",border:"1px solid "+K.bdr,borderTopColor:K.bdr+"50"}}>
        {/* Daily Streak */}
        <div onClick={function(e){e.stopPropagation();setPage("hub")}} style={{background:K.bg,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",flex:1}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:dailyStreak.current>0?K.acc:K.dim,fontFamily:fm,lineHeight:1}}>{dailyStreak.current>0?String.fromCodePoint(0x1F525)+" ":""}{dailyStreak.current}</div>
            <div style={{fontSize:9,color:dailyStreak.current>0?K.acc:K.dim,fontFamily:fm}}>Day Streak</div></div></div>
        {/* Weekly Streak */}
        <div style={{background:K.bg,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flex:2}}>
          <div style={{fontSize:20,fontWeight:800,color:streakData.current>0?K.grn:K.dim,fontFamily:fm,lineHeight:1}}>{streakData.current}</div>
          <div>
            <div style={{fontSize:10,fontWeight:600,color:streakData.current>0?K.grn:K.dim}}>Week Streak</div>
            <div style={{fontSize:8,color:K.dim}}>{streakData.current>0?"Best: "+streakData.best:currentWeekReviewed?"Reviewed "+String.fromCodePoint(0x2713):"Review due"}</div>
            {(function(){var rewards=[{w:1,r:"Themes"},{w:2,r:"AI Export"},{w:3,r:"PayPal Blue"},{w:4,r:"Munger"},{w:5,r:"Bloomberg"},{w:8,r:"Buffett"},{w:12,r:"Greenblatt"},{w:16,r:"Lynch"},{w:20,r:"Davis"},{w:24,r:"Hohn"}];var next=rewards.find(function(x){return x.w>(streakData.current||0)});
              return next?<div style={{fontSize:7,color:K.acc,fontFamily:fm}}>{String.fromCodePoint(0x1F381)+" Unlock at wk "+next.w}</div>:null})()}</div>
          {streakData.freezes>0&&<div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:3,background:K.blue+"10",borderRadius:4,padding:"2px 6px"}}>
            <span style={{fontSize:10}}>{"🛡️"}</span>
            <span style={{fontSize:8,color:K.blue,fontFamily:fm}}>{streakData.freezes}</span></div>}</div>
        {/* Process Score */}
        <div style={{background:K.bg,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flex:1,cursor:"pointer"}} onClick={function(e){e.stopPropagation();setPage("hub")}}>
          <div style={{position:"relative",width:32,height:32,flexShrink:0}}>
            <svg width={32} height={32} viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke={K.bdr} strokeWidth="2.5"/><circle cx="16" cy="16" r="13" fill="none" stroke={globalOS.total>=70?K.grn:globalOS.total>=40?K.amb:K.acc} strokeWidth="2.5" strokeDasharray={Math.round(globalOS.total/100*82)+" 82"} strokeLinecap="round" transform="rotate(-90 16 16)"/></svg>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:globalOS.total>=70?K.grn:globalOS.total>=40?K.amb:K.acc,fontFamily:fm}}>{globalOS.total}</div></div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm}}>Process</div>
            <div style={{fontSize:8,color:K.dim}}>{currentLevel.icon} {currentLevel.name}</div></div></div>
      </div>}
    </div>}
    {/* ── Getting Started Quest (persistent onboarding) ── */}
    {sideTab==="portfolio"&&filtered.length>0&&!milestones.onboard_dismissed&&(function(){
      var portfolio=filtered;
      var hasThesis=portfolio.some(function(c){return c.thesisNote&&c.thesisNote.trim().length>20});
      var hasKpi=portfolio.some(function(c){return c.kpis.length>=2});
      var hasConviction=portfolio.some(function(c){return c.conviction>0});
      var hasReview=weeklyReviews.length>0;
      var steps=[
        {done:hasThesis,label:"Write a thesis",icon:"lightbulb",color:K.grn,onClick:function(){var t=portfolio.find(function(c2){return!c2.thesisNote||c2.thesisNote.trim().length<20})||portfolio[0];setSelId(t.id);setPage("dashboard");setModal({type:"thesis"})}},
        {done:hasKpi,label:"Add 2+ KPIs",icon:"target",color:K.blue,onClick:function(){var t=portfolio.find(function(c2){return c2.kpis.length<2})||portfolio[0];setSelId(t.id);setDetailTab("dossier");setPage("dashboard");setTimeout(function(){setModal({type:"kpi"})},100)}},
        {done:hasConviction,label:"Rate conviction",icon:"trending",color:K.amb,onClick:function(){var t=portfolio.find(function(c2){return!c2.conviction})||portfolio[0];setSelId(t.id);setPage("dashboard");setModal({type:"conviction"})}},
        {done:hasReview,label:"Weekly review",icon:"shield",color:"#9333EA",onClick:function(){setPage("review")}}
      ];
      var completed=steps.filter(function(s){return s.done}).length;
      if(completed>=4){
        // Auto-dismiss when all done (celebrate)
        if(!milestones.onboard_complete){checkMilestone("onboard_complete",String.fromCodePoint(0x1F389)+" Owner's Loop complete! You've built the foundation of a disciplined investor.");
          showCelebration(String.fromCodePoint(0x1F389)+" Owner's Loop Complete","You've written a thesis, tracked KPIs, rated conviction, and completed a review. The foundation is set.",null,K.grn);
          var nm2=Object.assign({},milestones);nm2.onboard_dismissed=true;setMilestones(nm2);try{localStorage.setItem("ta-milestones",JSON.stringify(nm2))}catch(e){}}
        return null}
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13}}>{"🎯"}</span>
            <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>Getting Started</span>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{completed}/4</span></div>
          <button onClick={function(){var nm3=Object.assign({},milestones);nm3.onboard_dismissed=true;setMilestones(nm3);try{localStorage.setItem("ta-milestones",JSON.stringify(nm3))}catch(e){}}} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",padding:2}}>{"✕"}</button></div>
        {/* Progress bar */}
        <div style={{display:"flex",gap:3,marginBottom:12}}>
          {steps.map(function(s,i){return<div key={i} style={{flex:1,height:4,borderRadius:2,background:s.done?K.grn:K.bdr,transition:"background .3s"}}/>})}</div>
        {/* Step buttons */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {steps.map(function(s,i){return<button key={i} onClick={s.done?undefined:s.onClick} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:6,border:"1px solid "+(s.done?K.grn+"40":s.color+"30"),background:s.done?K.grn+"08":"transparent",color:s.done?K.grn:s.color,fontSize:10,fontWeight:600,cursor:s.done?"default":"pointer",fontFamily:fm,opacity:s.done?.7:1}}>
            {s.done?<IC name="check" size={9} color={K.grn}/>:<IC name={s.icon} size={9} color={s.color}/>}{s.label}</button>})}</div>
      </div>})()}
    {dashSet.showSummary&&sideTab==="portfolio"&&function(){
      var held=filtered.filter(function(c){var p=c.position||{};return p.shares>0&&p.avgCost>0&&p.currentPrice>0});
      if(held.length===0)return null;
      var totalCost=held.reduce(function(s,c){return s+(c.position.shares*c.position.avgCost)},0);
      var totalValue=held.reduce(function(s,c){return s+(c.position.shares*c.position.currentPrice)},0);
      var totalReturn=totalValue-totalCost;var totalReturnPct=totalCost>0?(totalReturn/totalCost*100):0;
      var isUp=totalReturn>=0;
      var best=null,worst=null;held.forEach(function(c){var pct=(c.position.currentPrice-c.position.avgCost)/c.position.avgCost*100;if(!best||pct>best.pct)best={ticker:c.ticker,pct:pct};if(!worst||pct<worst.pct)worst={ticker:c.ticker,pct:pct}});
      return<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:isMobile?10:16,marginBottom:20}}>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
          <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:8,fontFamily:fm}}>Total Value</div>
          <div style={{fontSize:22,fontWeight:600,color:K.txt,fontFamily:fm}}>${totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          <div style={{fontSize:11,color:K.dim,marginTop:4,fontFamily:fm}}>Cost: ${totalCost.toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
          <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:8,fontFamily:fm}}>Total Return</div>
          <div style={{fontSize:22,fontWeight:600,color:isUp?K.grn:K.red,fontFamily:fm}}>{isUp?"+":""}{totalReturnPct.toFixed(1)}%</div>
          <div style={{fontSize:11,color:isUp?K.grn:K.red,marginTop:4,fontFamily:fm}}>{isUp?"+":""}${totalReturn.toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
          <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:8,fontFamily:fm}}>Best Performer</div>
          <div style={{fontSize:18,fontWeight:600,color:K.grn,fontFamily:fm}}>{best?best.ticker:"—"}</div>
          <div style={{fontSize:11,color:K.grn,marginTop:4,fontFamily:fm}}>{best?(best.pct>=0?"+":"")+best.pct.toFixed(1)+"%":""}</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
          <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:8,fontFamily:fm}}>Worst Performer</div>
          <div style={{fontSize:18,fontWeight:600,color:K.red,fontFamily:fm}}>{worst?worst.ticker:"—"}</div>
          <div style={{fontSize:11,color:K.red,marginTop:4,fontFamily:fm}}>{worst?(worst.pct>=0?"+":"")+worst.pct.toFixed(1)+"%":""}</div></div>
      </div>}()}
    {/* Analytics quick link */}

    {/* View toggle */}
    {filtered.length>0&&<div style={{display:"flex",justifyContent:"flex-end",gap:4,marginBottom:12}}>
      <button onClick={function(){setDashSet(function(p){var n=Object.assign({},p,{portfolioView:"list"});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}} style={{padding:"5px 10px",fontSize:10,fontFamily:fm,background:dashSet.portfolioView==="list"||!dashSet.portfolioView?K.acc+"18":"transparent",color:dashSet.portfolioView==="list"||!dashSet.portfolioView?K.acc:K.dim,border:"1px solid "+(dashSet.portfolioView==="list"||!dashSet.portfolioView?K.acc+"40":K.bdr),borderRadius:5,cursor:"pointer"}}><IC name="file" size={10} color={dashSet.portfolioView==="list"||!dashSet.portfolioView?K.acc:K.dim}/> List</button>
      <button onClick={function(){setDashSet(function(p){var n=Object.assign({},p,{portfolioView:"cards"});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}} style={{padding:"5px 10px",fontSize:10,fontFamily:fm,background:dashSet.portfolioView==="cards"?K.acc+"18":"transparent",color:dashSet.portfolioView==="cards"?K.acc:K.dim,border:"1px solid "+(dashSet.portfolioView==="cards"?K.acc+"40":K.bdr),borderRadius:5,cursor:"pointer"}}><IC name="overview" size={10} color={dashSet.portfolioView==="cards"?K.acc:K.dim}/> Cards</button></div>}
    {/* Nordnet-style list view */}
    {filtered.length>0&&dashSet.portfolioView!=="cards"&&(function(){
      var totalVal=filtered.reduce(function(s,cc){var p2=cc.position||{};return s+(p2.shares>0&&p2.currentPrice>0?p2.shares*p2.currentPrice:0)},0);
      var listCols=dashSet.listCols||{};
      function togCol(k){setDashSet(function(p){var lc=Object.assign({},p.listCols||{});lc[k]=!lc[k];var n=Object.assign({},p,{listCols:lc});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden",marginBottom:28}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",padding:"10px 20px",borderBottom:"2px solid "+K.bdr,fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",gap:0}}>
          <span style={{width:40}}/>
          <span style={{flex:1,minWidth:100}}>Company</span>
          <span style={{width:75,textAlign:"right"}}>Avg Price</span>
          <span style={{width:65,textAlign:"right"}}>Return</span>
          {!isMobile&&<span style={{width:85,textAlign:"right"}}>Value</span>}
          <span style={{width:isMobile?70:150,paddingLeft:8}}>Allocation</span>
          {listCols.conviction&&<span style={{width:40,textAlign:"center"}}>Conv.</span>}
          {listCols.kpis&&!isMobile&&<span style={{width:55,textAlign:"right"}}>KPIs</span>}
          {listCols.earnings&&!isMobile&&<span style={{width:60,textAlign:"right"}}>Earn.</span>}
          {listCols.price&&!isMobile&&<span style={{width:70,textAlign:"right"}}>Price</span>}
          <span style={{width:28,textAlign:"right",position:"relative"}}>
            <button onClick={function(e){e.stopPropagation();setShowListCfg(!showListCfg)}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",alignItems:"center"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
            {showListCfg&&<div style={{position:"absolute",right:0,top:22,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"8px 0",boxShadow:"0 4px 16px rgba(0,0,0,.25)",zIndex:50,minWidth:155,textTransform:"none",letterSpacing:0}} onClick={function(e){e.stopPropagation()}}>
              <div style={{padding:"4px 14px 6px",fontSize:10,color:K.dim,fontWeight:600}}>Show columns</div>
              {[{k:"price",l:"Current Price"},{k:"conviction",l:"Conviction"},{k:"kpis",l:"KPI Status"},{k:"earnings",l:"Earnings Date"}].map(function(col){return<div key={col.k} onClick={function(){togCol(col.k)}} style={{padding:"6px 14px",cursor:"pointer",fontSize:11,color:K.mid,fontFamily:fm,display:"flex",alignItems:"center",gap:8}} onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"08"}} onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
                <div style={{width:14,height:14,borderRadius:3,border:"1.5px solid "+(listCols[col.k]?K.acc:K.bdr),background:listCols[col.k]?K.acc:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {listCols[col.k]&&<svg width="8" height="8" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" fill="none"/></svg>}</div>
                {col.l}</div>})}</div>}
          </span></div>
        {/* Rows — sorted by allocation (largest first) */}
        {filtered.slice().sort(function(a,b){var va=(a.position&&a.position.shares>0&&a.position.currentPrice>0)?a.position.shares*a.position.currentPrice:0;var vb=(b.position&&b.position.shares>0&&b.position.currentPrice>0)?b.position.shares*b.position.currentPrice:0;return vb-va}).map(function(cc,ci){
          var p2=cc.position||{};var val=p2.shares>0&&p2.currentPrice>0?p2.shares*p2.currentPrice:0;
          var ret=p2.shares>0&&p2.avgCost>0&&p2.currentPrice>0?((p2.currentPrice-p2.avgCost)/p2.avgCost*100):null;
          var weight=totalVal>0&&val>0?(val/totalVal*100):0;
          var h2=gH(cc.kpis);var d2=dU(cc.earningsDate);
          return<div key={cc.id} style={{display:"flex",alignItems:"center",padding:"12px 20px",borderBottom:"1px solid "+K.bdr+"40",cursor:"pointer",transition:"background .1s",gap:0}} onClick={function(){setSelId(cc.id);setDetailTab("dossier")}}
            onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06"}} onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
            <span style={{width:40}}><CoLogo domain={cc.domain} ticker={cc.ticker} size={26}/></span>
            <span style={{flex:1,minWidth:100}}>
              <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{cc.ticker}</div>
              <div style={{fontSize:10,color:K.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140}}>{cc.name}</div></span>
            <span style={{width:75,textAlign:"right",fontSize:11,color:K.mid,fontFamily:fm}}>{p2.avgCost>0?"$"+p2.avgCost.toFixed(2):"\u2014"}</span>
            <span style={{width:65,textAlign:"right",fontSize:12,fontWeight:600,fontFamily:fm,color:ret!=null?(ret>=0?K.grn:K.red):K.dim}}>{ret!=null?(ret>=0?"+":"")+ret.toFixed(1)+"%":"\u2014"}</span>
            {!isMobile&&<span style={{width:85,textAlign:"right",fontSize:11,color:K.txt,fontFamily:fm}}>{val>0?"$"+val.toLocaleString(undefined,{maximumFractionDigits:0}):"\u2014"}</span>}
            <span style={{width:isMobile?70:150,paddingLeft:8}}>
              {weight>0?<div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{flex:1,height:10,borderRadius:5,background:K.blue+"18",overflow:"hidden"}}>
                  <div style={{height:"100%",width:Math.min(weight,100)+"%",borderRadius:5,background:K.blue,transition:"width .4s"}}/></div>
                <span style={{fontSize:9,color:K.blue,fontFamily:fm,fontWeight:600,minWidth:30,textAlign:"right"}}>{weight.toFixed(1)}%</span></div>:<div style={{height:10}}/>}
            </span>
            {listCols.conviction&&<span style={{width:40,textAlign:"center"}}>{cc.conviction>0?<span style={{fontSize:12,fontWeight:700,color:cc.conviction>=7?K.grn:cc.conviction>=4?K.amb:K.red,fontFamily:fm}}>{cc.conviction}</span>:<span style={{fontSize:10,color:K.dim}}>\u2014</span>}</span>}
            {listCols.kpis&&!isMobile&&<span style={{width:55,textAlign:"right"}}><span style={S.badge(h2.c)}>{h2.l}</span></span>}
            {listCols.earnings&&!isMobile&&<span style={{width:60,textAlign:"right",fontSize:10,color:d2>=0&&d2<=7?K.amb:K.dim,fontFamily:fm}}>{cc.earningsDate==="TBD"?"TBD":d2<=0?"Done":d2+"d"}</span>}
            {listCols.price&&!isMobile&&<span style={{width:70,textAlign:"right",fontSize:11,color:K.txt,fontFamily:fm}}>{p2.currentPrice>0?"$"+p2.currentPrice.toFixed(2):"\u2014"}</span>}
            <span style={{width:28}}/>
          </div>})}
      </div>})()}
    {/* Card view */}
    {filtered.length>0&&dashSet.portfolioView==="cards"&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:16,marginBottom:28}}>
      {filtered.map(function(c,ci){var h=gH(c.kpis);var d=dU(c.earningsDate);var cs2=checkSt[c.id];var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;var total=c.kpis.filter(function(k){return k.lastResult}).length;var pos=c.position||{};
        return<div key={c.id} className="ta-card ta-fade" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",cursor:"pointer",position:"relative",animationDelay:Math.min(ci*40,400)+"ms"}} onClick={function(){setSelId(c.id);setDetailTab("dossier")}}>
          <button onClick={function(e){e.stopPropagation();setCos(function(p){return p.filter(function(x){return x.id!==c.id})})}} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:K.dim,fontSize:14,cursor:"pointer",padding:4,opacity:.4}} title="Remove">{"✕"}</button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><CoLogo domain={c.domain} ticker={c.ticker} size={28}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}{dashSet.showPrices&&pos.currentPrice>0&&<span style={{fontWeight:400,color:K.dim,marginLeft:8,fontSize:12}}>${pos.currentPrice.toFixed(2)}</span>}</div><div style={{fontSize:11,color:K.dim}}>{c.name}</div></div><span style={S.badge(h.c)}>{h.l}</span></div>
          {dashSet.showPositions&&pos.shares>0&&pos.avgCost>0&&pos.currentPrice>0&&<div style={{display:"flex",gap:12,marginBottom:10,padding:"8px 10px",background:K.bg,borderRadius:6}}>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{pos.shares} shares</span>
            <span style={{fontSize:11,color:((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?K.grn:K.red,fontWeight:600,fontFamily:fm}}>{((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?"+":""}{((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)}%</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>${(pos.shares*pos.currentPrice).toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>}
          {/* Investment style + Moat type micro-badges */}
          {c.investStyle&&STYLE_MAP[c.investStyle]&&<div style={{display:"flex",gap:4,marginBottom:8}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:9,fontWeight:600,color:STYLE_MAP[c.investStyle].color,background:STYLE_MAP[c.investStyle].color+"10",padding:"2px 7px",borderRadius:3,fontFamily:fm}}><IC name={STYLE_MAP[c.investStyle].icon} size={8} color={STYLE_MAP[c.investStyle].color}/>{STYLE_MAP[c.investStyle].label}</span></div>}
          {function(){var mt=c.moatTypes||{};var active=MOAT_TYPES.filter(function(t){return mt[t.id]&&mt[t.id].active});
            if(active.length===0)return null;
            return<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
              {active.slice(0,4).map(function(t){return<span key={t.id} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:9,color:t.color,background:t.color+"10",padding:"1px 6px",borderRadius:3,fontFamily:fm}}>
                <IC name={t.icon} size={8} color={t.color}/>{t.label.split(" ")[0]}</span>})}</div>}()}
          {/* Progress Path — Owner's Loop */}
          {(function(){var sec=parseThesis(c.thesisNote);var steps=[
            {id:"thesis",label:"Thesis",done:c.thesisNote&&c.thesisNote.trim().length>20,color:K.grn},
            {id:"kpis",label:"KPIs",done:c.kpis.length>=2,color:K.blue},
            {id:"conviction",label:"Conviction",done:c.conviction>0,color:K.amb},
            {id:"moat",label:"Moat",done:(function(){var mt=c.moatTypes||{};return Object.keys(mt).some(function(k){return mt[k]&&mt[k].active})})(),color:"#9333EA"},
            {id:"earnings",label:"Checked",done:c.lastChecked!=null,color:K.acc}];
            var completed=steps.filter(function(s){return s.done}).length;
            if(completed===5)return null; // Don't show if all complete
            return<div style={{display:"flex",alignItems:"center",gap:3,marginBottom:10}}>
              {steps.map(function(s,i){return React.createElement(React.Fragment,{key:s.id},
                <div style={{display:"flex",alignItems:"center",gap:3}} title={s.label+(s.done?" ✓":" — not done")}>
                  <div style={{width:16,height:16,borderRadius:"50%",background:s.done?s.color:K.bdr,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:s.done?"#fff":K.dim,fontWeight:700}}>{s.done?"✓":(i+1)}</div>
                  <span style={{fontSize:8,color:s.done?s.color:K.dim,fontFamily:fm}}>{s.label}</span></div>,
                i<4&&<div style={{width:8,height:1,background:s.done?s.color:K.bdr}}/>)})}</div>})()}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:"1px solid "+K.bdr}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:d>=0&&d<=7?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"TBD":(d<=0?"Reported":d+"d — "+fD(c.earningsDate))}</span>
              {dashSet.showBuyZone&&c.targetPrice>0&&pos.currentPrice>0&&pos.currentPrice<=c.targetPrice&&<span style={{fontSize:9,fontWeight:600,color:K.grn,background:K.grn+"15",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>BUY ZONE</span>}</div>
            <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{total>0?met+"/"+total+" met":c.kpis.length+" KPIs"}{cs2==="checking"?" ⏳":""}</div></div></div>})}</div>}
    {sideTab==="portfolio"&&filtered.length>=2&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>
      {[{label:"Analytics",icon:"bar",color:K.acc,pg:"analytics",desc:"Moat scores & quality"},
        {label:"Earnings",icon:"target",color:K.amb,pg:"calendar",desc:"Upcoming & recent"},
        {label:"Dividends",icon:"dollar",color:K.grn,pg:"dividends",desc:"Income tracking"},
        {label:"Timeline",icon:"trending",color:K.blue,pg:"timeline",desc:"Your history"}
      ].map(function(lnk){return<div key={lnk.label} className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 14px",cursor:"pointer",textAlign:"center"}} onClick={function(){setSelId(null);setPage(lnk.pg)}}>
        <IC name={lnk.icon} size={16} color={lnk.color}/>
        <div style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm,marginTop:4}}>{lnk.label}</div>
        <div style={{fontSize:9,color:K.dim}}>{lnk.desc}</div></div>})}</div>}
    {sideTab==="toohard"&&<div style={{background:K.red+"08",border:"1px solid "+K.red+"20",borderRadius:12,padding:"14px 20px",marginBottom:20}}><div style={{fontSize:12,fontWeight:600,color:K.red,marginBottom:4}}>Circle of Competence</div><div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>{"\"Acknowledging what you don’t know is the dawning of wisdom.\" Companies here are outside your circle — too complex, too unpredictable, or require expertise you don’t have. That’s not failure. That’s discipline."}</div></div>}
    {/* Enhanced empty state */}
    {filtered.length===0&&<div className="ta-fade" style={{padding:"60px 20px",textAlign:"center",maxWidth:480,margin:"0 auto"}}>
      <div style={{width:56,height:56,borderRadius:12,background:K.acc+"12",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><IC name={sideTab==="portfolio"?"trending":sideTab==="watchlist"?"search":"alert"} size={24} color={K.acc}/></div>
      <h3 style={{fontSize:20,fontWeight:400,color:K.txt,fontFamily:fh,margin:"0 0 8px"}}>{sideTab==="portfolio"?"Your portfolio is empty":sideTab==="watchlist"?"Nothing on your watchlist yet":"Too-Hard Pile is empty"}</h3>
      <p style={{fontSize:13,color:K.dim,lineHeight:1.7,margin:"0 0 24px"}}>{sideTab==="portfolio"?"Add the companies you own. Write a thesis for each one, track the KPIs that matter, and check them when earnings drop.":sideTab==="watchlist"?"Add companies you're researching but haven't bought yet. When your thesis is clear and the price is right, promote them to your portfolio.":"Companies you've decided are outside your circle of competence. It takes wisdom to know what you don't know."}</p>
      <button onClick={function(){setModal({type:"add"})}} style={Object.assign({},S.btnP,{padding:"10px 24px",fontSize:13})}>+ Add Your First Company</button>
      {sideTab==="portfolio"&&<div className="ta-grid-2col" style={{marginTop:32,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,textAlign:"left"}}>
        {[{icon:"lightbulb",title:"Thesis-driven",desc:"Every position needs a written reason to own it"},{icon:"target",title:"KPI tracking",desc:"Define metrics that prove or disprove your thesis"},{icon:"bar",title:"Earnings autopilot",desc:"Auto-check results against your KPIs"},{icon:"castle",title:"Moat analysis",desc:"Score competitive advantages with real data"}].map(function(f){return<div key={f.title} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",background:K.bg,borderRadius:8,border:"1px solid "+K.bdr}}>
          <IC name={f.icon} size={14} color={K.acc} style={{marginTop:2,flexShrink:0}}/>
          <div><div style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm}}>{f.title}</div>
            <div style={{fontSize:10,color:K.dim,lineHeight:1.4,marginTop:2}}>{f.desc}</div></div></div>})}</div>}
    </div>}
    {sideTab==="portfolio"&&filtered.length>0&&(dashSet.showHeatmap||dashSet.showSectors||dashSet.showDividends)&&<div style={{marginBottom:28}}>
      {/* Portfolio Heatmap */}
      {dashSet.showHeatmap&&function(){var withPrice=filtered.filter(function(c){var p=c.position||{};return p.currentPrice>0&&p.avgCost>0&&p.shares>0});
        if(withPrice.length<2)return null;
        return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:16}}>
          <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:14,fontFamily:fm}}>Portfolio Heatmap</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {withPrice.sort(function(a,b){return(b.position.shares*b.position.currentPrice)-(a.position.shares*a.position.currentPrice)}).map(function(c2){
              var pos2=c2.position;var pct=(pos2.currentPrice-pos2.avgCost)/pos2.avgCost*100;var val=pos2.shares*pos2.currentPrice;
              var totalVal=withPrice.reduce(function(s,x){return s+(x.position.shares*x.position.currentPrice)},0);var weight=val/totalVal*100;
              var clr=pct>=20?"#00C853":pct>=5?"#66BB6A":pct>=0?"#A5D6A7":pct>=-10?"#EF9A9A":pct>=-20?"#EF5350":"#C62828";
              var minW=Math.max(60,weight*3);
              return<div key={c2.id} onClick={function(){setSelId(c2.id)}} style={{background:clr+"20",border:"1px solid "+clr+"40",borderRadius:6,padding:"8px 12px",cursor:"pointer",minWidth:minW,flex:weight>15?"1 1 "+minW+"px":"0 1 "+minW+"px"}}>
                <div style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm}}>{c2.ticker}</div>
                <div style={{fontSize:13,fontWeight:700,color:clr,fontFamily:fm}}>{pct>=0?"+":""}{pct.toFixed(1)}%</div>
                <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>{weight.toFixed(0)}% of portfolio</div></div>})}</div></div>}()}
      <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:(dashSet.showSectors&&dashSet.showDividends)?"1fr 1fr":"1fr",gap:16}}>
      {/* Sector Concentration (value-weighted) */}
      {dashSet.showSectors&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
        <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:14,fontFamily:fm}}>Sector Concentration</div>
        {function(){var sectorVal={};var totalVal=0;
          filtered.forEach(function(c2){var s=c2.sector||"Other";var pos2=c2.position||{};var val=pos2.shares>0&&pos2.currentPrice>0?pos2.shares*pos2.currentPrice:0;sectorVal[s]=(sectorVal[s]||0)+val;totalVal+=val});
          var useValue=totalVal>0;
          return Object.keys(useValue?sectorVal:sectors).sort(function(a,b){return(useValue?sectorVal[b]-sectorVal[a]:sectors[b]-sectors[a])}).map(function(s){
            var pct=useValue?Math.round(sectorVal[s]/totalVal*100):Math.round(sectors[s]/filtered.length*100);
            var warn=pct>=50;
            return<div key={s} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:K.mid}}>{s}</span><span style={{fontSize:11,color:warn?K.amb:K.dim,fontWeight:warn?600:400,fontFamily:fm}}>{pct}%{warn?" ⚠":""}</span></div>
              <div style={{height:4,borderRadius:2,background:K.bdr}}><div style={{height:"100%",width:pct+"%",borderRadius:2,background:warn?K.amb:K.acc}}/></div></div>})}()}</div>}
      {/* Dividends */}
      {dashSet.showDividends&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
        <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:14,fontFamily:fm}}>Dividend Overview</div>
        {divCos.length===0&&<div style={{fontSize:12,color:K.dim,padding:"16px 0",textAlign:"center"}}>No dividend-paying holdings detected.<br/><span style={{fontSize:11}}>Set dividends in Position settings.</span></div>}
        {divCos.map(function(c){var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;var annDiv=dps*mult;var yld=pos.currentPrice?annDiv/pos.currentPrice*100:0;var annPayout=(pos.shares||0)*annDiv;
          return<div key={c.id} style={{marginBottom:8,padding:"10px 12px",background:K.bg,borderRadius:6}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <CoLogo domain={c.domain} ticker={c.ticker} size={20}/>
              <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,flex:1}}>{c.ticker}</span>
              <span style={{fontSize:11,fontWeight:600,color:K.grn,fontFamily:fm}}>{yld.toFixed(2)}% yield</span></div>
            <div style={{display:"flex",gap:12,paddingLeft:30}}>
              <span style={{fontSize:11,color:K.mid,fontFamily:fm}}>${dps.toFixed(2)}/{c.divFrequency==="monthly"?"mo":c.divFrequency==="semi"?"semi":c.divFrequency==="annual"?"yr":"qtr"}</span>
              {pos.shares>0&&<span style={{fontSize:11,color:K.grn,fontFamily:fm}}>${annPayout.toFixed(0)}/yr income</span>}
              {c.exDivDate&&<span style={{fontSize:11,color:K.amb,fontFamily:fm}}>Ex-div: {fD(c.exDivDate)}</span>}
              {!pos.shares&&<span style={{fontSize:10,color:K.dim}}>Add shares for income calc</span>}
            </div></div>})}
        {divCos.length>0&&totalAnnualDiv>0&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:K.mid}}>Est. Annual Income</span>
          <span style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>${totalAnnualDiv.toFixed(0)}</span></div>}
      </div>}</div></div>}
    </div>}
  var contentKey=(page||"dash")+"-"+(selId||"none")+"-"+(subPage||"main");
  return(<div style={{display:"flex",height:"100vh",background:K.bg,color:K.txt,fontFamily:fb,overflow:"hidden"}}>{renderModal()}{showUpgrade&&<UpgradeModal/>}{obStep>0&&<OnboardingFlow/>}
    {/* ── Weekly Insight Overlay ── */}
    {chestOverlay&&<div style={{position:"fixed",inset:0,zIndex:10002,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",animation:"fadeInFast .3s ease"}} onClick={function(){setChestOverlay(null)}}>
      <div className="ta-celebrate" style={{textAlign:"center",padding:"40px 48px",borderRadius:20,background:K.card,maxWidth:380,position:"relative",overflow:"hidden",border:"2px solid "+(chestOverlay.tier==="rare"?"#FFD700":chestOverlay.tier==="uncommon"?"#a78bfa":K.acc),boxShadow:"0 0 60px "+(chestOverlay.tier==="rare"?"rgba(255,215,0,.4)":chestOverlay.tier==="uncommon"?"rgba(167,139,250,.3)":"rgba(0,0,0,.3)")+", 0 20px 60px rgba(0,0,0,.3)"}} onClick={function(e){e.stopPropagation()}}>
        {/* Tier glow bar */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:chestOverlay.tier==="rare"?"linear-gradient(90deg,#FFD700,#FF8C00,#FFD700)":chestOverlay.tier==="uncommon"?"linear-gradient(90deg,#a78bfa,#818cf8,#a78bfa)":K.acc}}/>
        {/* Tier label */}
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:chestOverlay.tier==="rare"?"#FFD700":chestOverlay.tier==="uncommon"?"#a78bfa":K.dim,fontFamily:fm,marginBottom:8}}>{chestOverlay.tier==="rare"?"Rare Find!":chestOverlay.tier==="uncommon"?"Uncommon":"Reward"}</div>
        {/* Icon */}
        <div style={{fontSize:56,marginBottom:12,animation:"streakFlame 1s ease infinite"}}>{chestOverlay.icon}</div>
        {/* Title */}
        <div style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:6}}>{chestOverlay.label}</div>
        {/* Description */}
        <div style={{fontSize:13,color:K.mid,lineHeight:1.7,marginBottom:chestOverlay.author?4:16}}>{chestOverlay.desc}</div>
        {chestOverlay.author&&<div style={{fontSize:11,color:K.dim,fontStyle:"italic",marginBottom:16}}>{"— "+chestOverlay.author}</div>}
        {/* XP earned */}
        {chestOverlay.xp>0&&<div style={{display:"inline-block",background:K.grn+"12",border:"1px solid "+K.grn+"25",borderRadius:6,padding:"4px 12px",marginBottom:12}}>
          <span style={{fontSize:12,fontWeight:600,color:K.grn,fontFamily:fm}}>+{chestOverlay.xp} pts</span></div>}
        <div><button onClick={function(){setChestOverlay(null)}} style={Object.assign({},S.btnP,{padding:"10px 28px",fontSize:12})}>Collect</button></div>
      </div></div>}
    {celebOverlay&&<div style={{position:"fixed",inset:0,zIndex:10001,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",animation:"fadeInFast .3s ease"}} onClick={function(){setCelebOverlay(null)}}>
      <div className="ta-celebrate" style={{textAlign:"center",padding:"48px 60px",borderRadius:20,background:K.card,border:"2px solid "+(celebOverlay.color||K.acc),boxShadow:"0 0 80px "+(celebOverlay.color||K.acc)+"30, 0 0 40px "+(celebOverlay.color||K.acc)+"15, 0 20px 60px rgba(0,0,0,.3)",maxWidth:420,animation:"celebratePop .5s cubic-bezier(.175,.885,.32,1.275) both, glowPulse 2s ease-in-out infinite"}}>
        <div style={{fontSize:56,marginBottom:16,animation:"streakFlame 1s ease infinite"}}>{celebOverlay.icon||String.fromCodePoint(0x1F389)}</div>
        <div style={{fontSize:24,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:8}}>{celebOverlay.title}</div>
        <div style={{fontSize:13,color:K.mid,lineHeight:1.7,marginBottom:20}}>{celebOverlay.subtitle}</div>
        <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>Click anywhere to continue</div>
      </div></div>}
    {showConfetti&&<div style={{position:"fixed",inset:0,zIndex:10000,pointerEvents:"none",overflow:"hidden"}}>
      {Array.from({length:50}).map(function(_,i){
        var colors=["#FFD700","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE"];
        var left=Math.random()*100;var delay=Math.random()*2;var size=Math.random()*8+4;var dur=Math.random()*2+2;
        return React.createElement("div",{key:i,style:{position:"absolute",left:left+"%",top:-20,width:size,height:size,borderRadius:Math.random()>.5?"50%":"2px",background:colors[i%colors.length],animation:"confettiFall "+dur+"s "+delay+"s ease-in both"}})})}</div>}
    {toast&&<div className="ta-fade" style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:toast.type==="levelup"?"14px 28px":"10px 24px",borderRadius:12,background:toast.type==="levelup"?"linear-gradient(135deg, #FFD700 0%, #FFA500 100%)":toast.type==="streak"?"linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)":toast.type==="milestone"?"linear-gradient(135deg, #667eea 0%, #764ba2 100%)":K.card,border:"1px solid "+(toast.type==="levelup"?"#FFD700":toast.type==="streak"?"#FF6B6B":toast.type==="milestone"?"#764ba2":K.bdr),boxShadow:"0 8px 32px rgba(0,0,0,.25)",display:"flex",alignItems:"center",gap:12,cursor:"pointer",maxWidth:420}} onClick={function(){setToast(null)}}>
      <div style={{fontSize:toast.type==="levelup"||toast.type==="milestone"||toast.type==="streak"?14:12,fontWeight:toast.type==="levelup"||toast.type==="milestone"||toast.type==="streak"?700:500,color:toast.type==="levelup"||toast.type==="streak"?"#1a1a2e":toast.type==="milestone"?K.txt:K.txt,fontFamily:fm}}>{toast.msg}</div>
      {toast.type==="levelup"&&<button onClick={function(e){e.stopPropagation();setPage("hub");setToast(null)}} style={{background:"rgba(0,0,0,.15)",border:"none",borderRadius:6,padding:"4px 12px",fontSize:10,color:"#1a1a2e",cursor:"pointer",fontFamily:fm,fontWeight:600,whiteSpace:"nowrap"}}>View Hub</button>}
    </div>}
    <Sidebar/><div style={{flex:1,overflowY:"auto",width:isMobile?"100%":"auto"}}><TopBar/>
    {/* ── Profile Panel ── */}
    {showProfile&&<div style={{position:"fixed",inset:0,zIndex:199}} onClick={function(){setShowProfile(false)}}/>}
    {showProfile&&(function(){
      var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
      var withThesis=portfolio.filter(function(c){return c.thesisNote&&c.thesisNote.trim().length>20}).length;
      var totalKpis=portfolio.reduce(function(s,c){return s+c.kpis.length},0);
      var totalDecisions=0;cos.forEach(function(c){totalDecisions+=(c.decisions||[]).length});
      var reviewCount=weeklyReviews.length;
      var xpToNext=xpLevel.xpForNext-xp.total;
      return<div className="ta-slide" style={{position:"fixed",top:56,right:isMobile?12:32,width:isMobile?"calc(100vw - 24px)":360,maxHeight:"80vh",overflowY:"auto",background:K.card,border:"1px solid "+K.bdr2,borderRadius:12,boxShadow:"0 16px 48px rgba(0,0,0,.3)",zIndex:200,padding:"24px"}} onClick={function(e){e.stopPropagation()}}>
        {/* Avatar + Level */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
          <div style={{position:"relative",cursor:"pointer"}} onClick={function(){avatarFileRef.current&&avatarFileRef.current.click()}}>
            {avatarUrl?<img src={avatarUrl} style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",border:"3px solid "+K.acc}}/>
              :<div style={{width:64,height:64,borderRadius:"50%",background:K.acc+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:K.acc,fontWeight:700,fontFamily:fm,border:"3px solid "+K.acc+"40"}}>{(username||props.user||"U")[0].toUpperCase()}</div>}
            <div style={{position:"absolute",bottom:-3,right:-10,background:K.prim,color:K.primTxt,fontSize:9,fontWeight:800,fontFamily:fm,padding:"2px 7px",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid "+K.card,whiteSpace:"nowrap"}}>{globalOS.total}</div>
            <div style={{position:"absolute",top:0,right:0,background:K.card,border:"1px solid "+K.bdr,borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center"}}><IC name="edit" size={9} color={K.dim}/></div>
            <input ref={avatarFileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarUpload}/>
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:600,color:K.txt}}>{username||props.user||"Investor"}</div>
            {!username&&!editingName&&<button onClick={function(){setEditingName(true);setNameInput("")}} style={{background:"none",border:"none",color:K.acc,fontSize:10,cursor:"pointer",fontFamily:fm,padding:0}}>Set username</button>}
            {editingName&&<div style={{display:"flex",gap:6,marginTop:4}}><input value={nameInput} onChange={function(e){setNameInput(e.target.value)}} placeholder="Choose a username" maxLength={20} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:4,color:K.txt,padding:"4px 8px",fontSize:11,fontFamily:fm,width:140,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")saveUsername()}} autoFocus/><button onClick={saveUsername} style={{background:K.acc,color:K.primTxt,border:"none",borderRadius:4,padding:"4px 10px",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:fm}}>Save</button></div>}
            {username&&<div style={{fontSize:10,color:K.dim}}>{props.user}</div>}
            <div style={{fontSize:12,color:K.acc,fontWeight:600,fontFamily:fm}}>Level {xpLevel.level}</div>
            <div style={{fontSize:10,color:K.dim,marginTop:2}}>{xp.total.toLocaleString()} pts total</div></div></div>
        {/* XP Progress to next level */}
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>
            <span>Level {xpLevel.level}</span><span>{xpToNext>0?xpToNext.toLocaleString()+" pts to Level "+(xpLevel.level+1):"Max level!"}</span></div>
          <div style={{height:8,borderRadius:4,background:K.bdr,overflow:"hidden"}}>
            <div style={{height:"100%",width:xpPct+"%",borderRadius:4,background:K.acc,transition:"width .3s"}}/></div></div>
        {/* Stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
          {[{label:"Streak",value:streakData.current||0,sub:"weeks",color:K.grn},
            {label:"Reviews",value:reviewCount,sub:"completed",color:K.blue},
            {label:"Decisions",value:totalDecisions,sub:"logged",color:K.amb}
          ].map(function(s){return<div key={s.label} style={{background:K.bg,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:s.color,fontFamily:fm}}>{s.value}</div>
            <div style={{fontSize:9,color:K.dim}}>{s.sub}</div></div>})}</div>
        {/* Portfolio stats */}
        <div style={{background:K.bg,borderRadius:8,padding:"14px 16px",marginBottom:20}}>
          <div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:10}}>Portfolio Activity</div>
          <div style={{display:"grid",gap:6}}>
            {[{label:"Companies tracked",value:portfolio.length,icon:"overview"},
              {label:"Theses written",value:withThesis,icon:"lightbulb"},
              {label:"KPIs tracked",value:totalKpis,icon:"target"},
              {label:"Best streak",value:(streakData.best||0)+" weeks",icon:"shield"}
            ].map(function(s){return<div key={s.label} style={{display:"flex",alignItems:"center",gap:8}}>
              <IC name={s.icon} size={12} color={K.dim}/>
              <span style={{fontSize:11,color:K.mid,flex:1}}>{s.label}</span>
              <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{s.value}</span></div>})}</div></div>
        {/* Double XP indicator */}
        {isDoubleXP&&<div style={{background:K.amb+"12",border:"1px solid "+K.amb+"25",borderRadius:8,padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14}}>{String.fromCodePoint(0x26A1)}</span>
          <div><div style={{fontSize:11,fontWeight:600,color:K.amb}}>2× Points Active</div>
            <div style={{fontSize:9,color:K.dim}}>Expires {new Date(doubleXP).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div></div></div>}
        {/* Badges */}
        {(chestRewards.badges||[]).length>0&&<div style={{marginBottom:16}}>
          <div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>Badges</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {(chestRewards.badges||[]).map(function(b){return<div key={b.id} title={b.desc} style={{display:"flex",alignItems:"center",gap:4,background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,padding:"4px 10px"}}>
              <span style={{fontSize:14}}>{b.icon}</span>
              <span style={{fontSize:10,fontWeight:600,color:K.txt,fontFamily:fm}}>{b.label}</span></div>})}</div></div>}
        {/* Collected Quotes */}
        {(chestRewards.quotes||[]).length>0&&<div style={{marginBottom:16}}>
          <div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>Collected Wisdom ({(chestRewards.quotes||[]).length})</div>
          <div style={{maxHeight:120,overflowY:"auto"}}>
            {(chestRewards.quotes||[]).slice(-5).reverse().map(function(q,i){return<div key={i} style={{padding:"6px 0",borderBottom:"1px solid "+K.bdr+"40"}}>
              <div style={{fontSize:11,color:K.mid,fontStyle:"italic",lineHeight:1.5}}>{"“"+q.q+"”"}</div>
              <div style={{fontSize:9,color:K.dim,textAlign:"right"}}>{"— "+q.a}</div></div>})}</div></div>}
        {/* Recent Activity history */}
        {xp.history.length>0&&<div>
          <div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>Recent Activity</div>
          <div style={{maxHeight:140,overflowY:"auto"}}>
            {xp.history.slice(0,10).map(function(h,i){return<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid "+K.bdr+"40"}}>
              <span style={{fontSize:11,color:K.mid}}>{h.label}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,fontWeight:600,color:K.grn,fontFamily:fm}}>+{h.amount}</span>
                <span style={{fontSize:9,color:K.dim}}>{fD(h.date)}</span></div></div>})}</div></div>}
        <div style={{marginTop:16,textAlign:"center"}}>
          <button onClick={function(){setShowProfile(false)}} style={S.btn}>Close</button></div>
      </div>})()}
    {trial&&trial.start&&plan!=="pro"&&function(){
      var urgent=trialDaysLeft<=3;var warn=trialDaysLeft<=7&&!urgent;
      var barColor=urgent?K.red:warn?K.amb:K.acc;
      // Active trial banner
      if(trialActive){return<div style={{padding:isMobile?"10px 14px":"10px 32px",background:barColor+"08",borderBottom:"1px solid "+barColor+"20",display:"flex",alignItems:isMobile?"flex-start":"center",gap:isMobile?10:16,flexDirection:isMobile?"column":"row"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
          <div style={{fontSize:11,fontWeight:600,color:barColor,fontFamily:fm}}>{trialDaysLeft}d left</div>
          <div style={{fontSize:11,color:K.mid}}>{trialBonusEarned?"Full trial — "+TRIAL_TOTAL+" days earned":"Pro trial — complete "+THESIS_UNLOCK+" theses to earn +"+TRIAL_BONUS+" more days"}</div></div>
        {!trialBonusEarned&&<div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",gap:3}}>{[0,1,2].map(function(i){return<div key={i} style={{width:24,height:6,borderRadius:3,background:i<thesisProgress?K.grn:K.bdr,transition:"background .3s"}}/>})}</div>
          <span style={{fontSize:10,color:thesisProgress>=THESIS_UNLOCK?K.grn:K.dim,fontFamily:fm}}>{thesisProgress}/{THESIS_UNLOCK}</span></div>}
        {urgent&&<button onClick={function(){setShowUpgrade(true);setUpgradeCtx("trial-ending")}} style={{padding:"5px 14px",fontSize:10,fontWeight:600,background:K.red+"15",border:"1px solid "+K.red+"40",color:K.red,borderRadius:6,cursor:"pointer",fontFamily:fm,whiteSpace:"nowrap"}}>Upgrade Now</button>}
      </div>}
      // Expired trial banner
      if(trialExpired){return<div style={{padding:isMobile?"12px 14px":"12px 32px",background:K.amb+"10",borderBottom:"1px solid "+K.amb+"25",display:"flex",alignItems:"center",gap:16}}>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.amb}}>Your Pro trial has ended</div>
          <div style={{fontSize:11,color:K.mid,marginTop:2}}>Your theses, decisions, and data are safe. Upgrade to keep using data features.</div></div>
        <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("trial-expired")}} style={Object.assign({},S.btnP,{padding:"8px 20px",fontSize:11,whiteSpace:"nowrap"})}>Upgrade to Pro</button></div>}
      return null}()}<div key={contentKey} className="ta-fade" style={isMobile?{padding:"0 4px"}:undefined}>{page==="hub"?<OwnersHub/>:page==="assets"?<AllAssets/>:page==="review"?<WeeklyReview/>:page==="timeline"?<PortfolioTimeline/>:page==="analytics"?<PortfolioAnalytics/>:page==="calendar"?<EarningsCalendar/>:page==="dividends"?<DividendHub/>:sel&&subPage==="financials"?<FinancialsPage company={sel}/>:sel&&subPage==="moat"?<MoatTracker company={sel}/>:sel?<DetailView/>:<Dashboard/>}</div></div></div>)}

// ═══ ROOT ═══
export default function App(){
  var _user=useState(null),user=_user[0],setUser=_user[1];
  var _ready=useState(false),ready=_ready[0],setReady=_ready[1];
  useEffect(function(){if(!supabase){setReady(true);return}
    supabase.auth.getSession().then(function(res){if(res.data.session)setUser(res.data.session.user);setReady(true)});
    var sub=supabase.auth.onAuthStateChange(function(event,session){setUser(session?session.user:null)});
    return function(){sub.data.subscription.unsubscribe()}},[]);
  function onAuth(u){setUser(u)}
  async function onLogout(){if(supabase)await supabase.auth.signOut();setUser(null)}
  if(!ready){var _ltheme="dark";try{_ltheme=localStorage.getItem("ta-theme")||"dark"}catch(e){}var _ldark=_ltheme==="dark";
    return<div style={{background:_ldark?"#1a1a1a":"#f7f7f7",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{width:32,height:32,border:"2px solid "+(_ldark?"#333":"#ddd"),borderTopColor:_ldark?"#fff":"#1a1a1a",borderRadius:"50%",animation:"spin .8s linear infinite"}}/><span style={{color:_ldark?"#777":"#888",fontSize:12,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1}}>ThesisAlpha</span></div>}
  if(!user)return<LoginPage onAuth={onAuth}/>;
  return<TrackerApp user={user.email||""} userId={user.id} onLogout={onLogout}/>;
}
