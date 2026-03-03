"use client";
import { useState, useEffect, useRef, useCallback } from "react";
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
async function fmp(ep){try{var r=await fetch("/api/fmp?endpoint="+encodeURIComponent(ep));console.log("[FMP client] "+ep+" → HTTP "+r.status);if(!r.ok){console.warn("[FMP client] HTTP error for "+ep+": "+r.status);return null}var d=await r.json();console.log("[FMP client] "+ep+" → "+(Array.isArray(d)?d.length+" items":d===null?"null":typeof d));return d}catch(e){console.warn("FMP:",ep,e);return null}}

// ═══ FINNHUB (server proxy — earnings, metrics, news, analysts) ═══
async function finnhub(ep){try{var r=await fetch("/api/finnhub?endpoint="+encodeURIComponent(ep));if(!r.ok){console.warn("[Finnhub] HTTP "+r.status+" for "+ep);return null}var d=await r.json();if(d&&d.error){console.warn("[Finnhub] API error for "+ep+":",d.error);return null}return d}catch(e){console.warn("[Finnhub] fetch error:",ep,e);return null}}

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
  s=s.replace(/\s*-\s*/g," \u2014 ");
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
// Legacy name → metricId mapping for existing user data
var LEGACY_MAP={};METRICS.forEach(function(m){LEGACY_MAP[m.label.toLowerCase()]=m.id});
var _la={"revenue growth":"revGrowth","eps growth":"epsGrowth","gross margin":"grossMargin","operating margin":"opMargin","net margin":"netMargin","return on equity":"roe","return on assets":"roa","return on invested capital":"roic","p/e":"pe","pe ratio":"pe","p/e ratio":"pe","p/b":"pb","price to book":"pb","current ratio":"currentRatio","debt to equity":"debtEquity","debt/equity":"debtEquity","d/e ratio":"debtEquity","dividend yield":"divYield","book value per share":"bvps","free cash flow":"fcfPerShare","fcf":"fcfPerShare","fcf margin":"fcfPerShare","revenue per share":"revPerShare","ebitda":"ebitdaPerShare","ebitda margin":"ebitdaPerShare","rev/share":"revPerShare","revenue growth yoy":"revGrowth","eps growth yoy":"epsGrowth"};
Object.keys(_la).forEach(function(k){LEGACY_MAP[k]=_la[k]});
function resolveMetricId(kpi){if(kpi.metricId)return kpi.metricId;var n=kpi.name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return LEGACY_MAP[n]||null}
function isCustomKpi(name){if(METRIC_MAP[name])return false;var n=name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return!LEGACY_MAP[n]}

async function lookupTicker(ticker){var t=ticker.toUpperCase().trim();
  try{
    var p=await fmp("profile?symbol="+t);
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
      return{name:pr.companyName,sector:pr.sector||pr.industry||"",industry:pr.industry||"",earningsDate:ed,earningsTime:et,domain:domain,irUrl:irUrl||"",price:pr.price||0,lastDiv:pr.lastDiv||0,mktCap:pr.mktCap||0}}
  }catch(e){console.warn("FMP lookup failed:",e)}
  return{error:"Not found — enter details manually"}}
async function fetchPrice(ticker){try{var p=await fmp("profile?symbol="+ticker);if(p&&p.length&&p[0].price)return{price:p[0].price,lastDiv:p[0].lastDiv||0};return null}catch(e){return null}}
// FMP Financial Statements (FREE tier — 250 req/day, 5 years annual)
var _fincache={};
async function fetchFinancialStatements(ticker,period){
  var key=ticker+"-"+(period||"annual");if(_fincache[key])return _fincache[key];
  try{
    console.log("[ThesisAlpha] Fetching financials via SEC EDGAR for "+ticker+" ("+period+")");
    // Primary: SEC EDGAR (free, no API key needed)
    var r=await fetch("/api/sec?ticker="+encodeURIComponent(ticker)+"&period="+(period||"annual"));
    if(r.ok){var d=await r.json();
      if(d&&!d.error&&(d.income&&d.income.length>0||d.balance&&d.balance.length>0||d.cashflow&&d.cashflow.length>0)){
        console.log("[ThesisAlpha] SEC EDGAR success — income:"+d.income.length+" balance:"+d.balance.length+" cf:"+d.cashflow.length);
        var res={income:d.income||[],balance:d.balance||[],cashflow:d.cashflow||[],source:"sec-edgar"};
        _fincache[key]=res;return res}
      console.log("[ThesisAlpha] SEC EDGAR returned empty, trying FMP fallback...")}
    else{console.warn("[ThesisAlpha] SEC route HTTP "+r.status+", trying FMP fallback...")}
    // Fallback: FMP (if user has premium plan)
    var isQ=period==="quarter";var lim=isQ?20:5;
    var qs="?period="+(isQ?"quarter":"annual")+"&limit="+lim;
    var results=await Promise.all([fmp("income-statement/"+ticker+qs),fmp("balance-sheet-statement/"+ticker+qs),fmp("cash-flow-statement/"+ticker+qs)]);
    var _is=results[0],_bs=results[1],_cf=results[2];
    if(_is&&(_is._fmpError||!Array.isArray(_is)))_is=null;
    if(_bs&&(_bs._fmpError||!Array.isArray(_bs)))_bs=null;
    if(_cf&&(_cf._fmpError||!Array.isArray(_cf)))_cf=null;
    console.log("[ThesisAlpha] FMP fallback — income:"+(_is||[]).length+" balance:"+(_bs||[]).length+" cf:"+(_cf||[]).length);
    var res={income:(_is||[]).reverse(),balance:(_bs||[]).reverse(),cashflow:(_cf||[]).reverse(),source:"fmp"};
    if(res.income.length>0||res.balance.length>0||res.cashflow.length>0)_fincache[key]=res;
    return res}catch(e){console.warn("[ThesisAlpha] fetchFinancials error:",e);return{income:[],balance:[],cashflow:[]}}}

async function fetchEarnings(co,kpis){
  var results=[];var quarter="";var summary="";var srcUrl="";var srcLabel="";var snapshot={};
  // Step 1: Finnhub basic financials (FREE, $0)
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
      var fhMap={
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
      // Match user's tracked KPIs by metric ID (supports legacy names)
      if(kpis&&kpis.length){kpis.forEach(function(k){
        var metricId=resolveMetricId(k);
        var found=metricId?fhMap[metricId]:null;
        if(found&&found.v!=null){results.push({kpi_name:k.metricId||metricId||k.name,actual_value:found.v,status:eS(k.rule,k.value,found.v),excerpt:found.label+" (Finnhub)"})}
        else if(metricId&&!isCustomKpi(metricId)){results.push({kpi_name:k.metricId||metricId||k.name,actual_value:null,status:"unclear",excerpt:"Not available from Finnhub"})}})}}}catch(e){console.warn("Finnhub metrics:",e)}
  if(!results.length&&!quarter&&!Object.keys(snapshot).length)return{found:false,reason:"No earnings data found for "+co.ticker+". Finnhub may not cover this ticker."};
  console.log("[ThesisAlpha] fetchEarnings result for "+co.ticker+":",{found:true,quarter:quarter,resultsCount:results.length,snapshotKeys:Object.keys(snapshot).length,summary:summary.substring(0,80)});
  return{found:true,quarter:quarter||"Latest",summary:summary||"Earnings data retrieved.",results:results,sourceUrl:srcUrl,sourceLabel:srcLabel||"Finnhub",snapshot:snapshot}}
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
var DARK={bg:"#121217",side:"#0c0c14",card:"#1c1c28",bdr:"#2a2a3a",bdr2:"#363648",txt:"#f0f0f5",mid:"#b0b0c0",dim:"#6e6e82",blue:"#5b9bf6",grn:"#4ade80",red:"#f87171",amb:"#fbbf24",acc:"#818CF8",prim:"#F6C244",primTxt:"#1A1A1A"};
var LIGHT={bg:"#F5F0FA",side:"#FFFFFF",card:"#FFFFFF",bdr:"#E2D8EE",bdr2:"#D0C4DE",txt:"#1A1128",mid:"#4A3D5C",dim:"#8878A0",blue:"#5B3E96",grn:"#16A34A",red:"#DC2626",amb:"#D97706",acc:"#5B3E96",prim:"#5B3E96",primTxt:"#FFFFFF"};
var fm="'JetBrains Mono','SF Mono',monospace",fh="'Instrument Serif',Georgia,serif",fb="'DM Sans','Helvetica Neue',sans-serif";
function TLogo(p){var s=p.size||28;return<img src="/logo.png" width={s} height={s} style={{borderRadius:6,objectFit:"contain"}} alt="T"/>}
// (sector suggestions removed — using predefined METRICS dropdown)
var FOLDERS=[{id:"why-i-own",label:"Why I Own It",icon:"lightbulb"},{id:"my-writeups",label:"My Write-Ups",icon:"edit"},{id:"deep-dives",label:"Other Deep Dives",icon:"search"},{id:"reports",label:"Reports & Presentations",icon:"bar"},{id:"notes",label:"Quick Notes",icon:"file"}];
var SAMPLE=[{id:1,ticker:"NVDA",name:"NVIDIA Corporation",sector:"Semiconductors",domain:"nvidia.com",irUrl:"https://investor.nvidia.com",earningsDate:"2026-02-26",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:"https://investor.nvidia.com",sourceLabel:"Q4 FY26",earningSummary:"Data Center revenue surged 93% YoY to $39.2B.",thesisNote:"AI capex cycle still early innings.",position:{shares:50,avgCost:128.5},conviction:9,convictionHistory:[{date:"2025-06-01",rating:8,note:"Strong but expensive"},{date:"2025-11-20",rating:9,note:"Data center demand insatiable"},{date:"2026-01-15",rating:9,note:"AI capex still accelerating"}],status:"portfolio",docs:[{id:1,title:"Core Thesis: AI Infrastructure",folder:"why-i-own",content:"NVIDIA is the picks-and-shovels play on AI. Data center GPU demand is insatiable.",updatedAt:"2026-01-15T10:00:00Z"}],earningsHistory:[{quarter:"Q3 2025",summary:"Revenue $35.1B (+94% YoY). Data Center $30.8B. Gross margin 74.6%.",results:[{kpi_name:"Data Center Revenue",actual_value:30.8,status:"met",excerpt:"Data Center $30.8B"},{kpi_name:"Gross Margin",actual_value:74.6,status:"met",excerpt:"GAAP GM 74.6%"}],sourceUrl:"https://investor.nvidia.com",sourceLabel:"NVIDIA Press Release",checkedAt:"2025-11-20T18:00:00Z"},{quarter:"Q2 2025",summary:"Revenue $30.0B (+122% YoY). Data Center $26.3B. Gross margin 75.1%.",results:[{kpi_name:"Data Center Revenue",actual_value:26.3,status:"met",excerpt:"Data Center $26.3B"},{kpi_name:"Gross Margin",actual_value:75.1,status:"met",excerpt:"GAAP GM 75.1%"}],sourceUrl:"https://investor.nvidia.com",sourceLabel:"NVIDIA Press Release",checkedAt:"2025-08-28T18:00:00Z"}],kpis:[{id:1,name:"Data Center Revenue",target:"\u226535B",rule:"gte",value:35,unit:"B",period:"Q4 FY26",notes:"",lastResult:{actual:39.2,status:"met",excerpt:"Data Center revenue was $39.2B."}},{id:2,name:"Gross Margin",target:"\u226573%",rule:"gte",value:73,unit:"%",period:"Q4 FY26",notes:"GAAP",lastResult:{actual:73.5,status:"met",excerpt:"GAAP gross margin was 73.5%."}}]},{id:2,ticker:"CRWD",name:"CrowdStrike",sector:"Cybersecurity",domain:"crowdstrike.com",irUrl:"https://ir.crowdstrike.com",earningsDate:"2026-03-04",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:null,sourceLabel:null,earningSummary:null,thesisNote:"Post-outage recovery.",position:{shares:0,avgCost:0},conviction:6,convictionHistory:[{date:"2025-09-01",rating:5,note:"Outage fallout"},{date:"2026-01-10",rating:6,note:"Recovery underway"}],status:"watchlist",docs:[],earningsHistory:[],kpis:[{id:1,name:"Net New ARR",target:"\u2265220M",rule:"gte",value:220,unit:"M",period:"Q4 FY26",notes:"",lastResult:null},{id:2,name:"Gross Retention",target:"\u226595%",rule:"gte",value:95,unit:"%",period:"Q4 FY26",notes:"",lastResult:null}]}];
var dU=function(d){if(!d||d==="TBD")return 999;return Math.ceil((new Date(d)-new Date())/864e5)};
var fD=function(d){try{return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch(e){return d}};
var fT=function(ts){if(!ts)return"";var d=new Date(ts);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})};
var nId=function(a){return a.length?Math.max.apply(null,a.map(function(x){return x.id}))+1:1};
function gH(kpis){var ev=kpis.filter(function(k){return k.lastResult});if(!ev.length)return{l:"Pending",c:"#6B7280"};var m=ev.filter(function(k){return k.lastResult.status==="met"}).length;var p=Math.round(m/ev.length*100);return p>=80?{l:"Strong",c:"#22C55E"}:p>=50?{l:"Mixed",c:"#F59E0B"}:{l:"Weak",c:"#EF4444"}}
var bT=function(r,v,u){return(r==="gte"?"\u2265":r==="lte"?"\u2264":"=")+" "+v+(u||"")};
var eS=function(r,t,a){var n=parseFloat(a);if(isNaN(n))return"unclear";return r==="gte"?(n>=t?"met":"missed"):r==="lte"?(n<=t?"met":"missed"):(n===t?"met":"missed")};
function CoLogo(p){var _s=useState(0),a=_s[0],sA=_s[1];var sz=p.size||24;
  if(p.domain&&a===0)return<img src={"https://logo.clearbit.com/"+p.domain} width={sz} height={sz} style={{borderRadius:4,background:"#2a2a3a",objectFit:"contain",flexShrink:0}} onError={function(){sA(1)}} alt=""/>;
  if(p.domain&&a===1)return<img src={"https://www.google.com/s2/favicons?domain="+p.domain+"&sz=64"} width={sz} height={sz} style={{borderRadius:4,background:"#2a2a3a",objectFit:"contain",flexShrink:0}} onError={function(){sA(2)}} alt=""/>;
  return<div style={{width:sz,height:sz,borderRadius:4,background:"#2a2a3a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*.4,fontWeight:700,color:"#6e6e82",fontFamily:fm,flexShrink:0}}>{(p.ticker||"?")[0]}</div>}
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
function Modal(p){var K=p.K||DARK;return<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(10px)",animation:"fadeInFast .15s ease-out"}} onClick={p.onClose}><div className="ta-slide" style={{background:K.card,border:"1px solid "+K.bdr2,borderRadius:16,padding:"28px 32px",width:p.w||500,maxWidth:"92vw",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,.4)"}} onClick={function(e){e.stopPropagation()}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><h2 style={{margin:0,fontSize:17,fontWeight:500,color:K.txt,fontFamily:fh}}>{p.title}</h2><button onClick={p.onClose} style={{background:"none",border:"none",color:K.dim,fontSize:18,cursor:"pointer",padding:"4px 8px",borderRadius:6}} onMouseEnter={function(e){e.target.style.color=K.txt}} onMouseLeave={function(e){e.target.style.color=K.dim}}>{"\u2715"}</button></div>{p.children}</div></div>}
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
  <div className="ta-slide" style={{width:400,padding:"48px 40px",background:K.card,border:"1px solid "+K.bdr,borderRadius:20,boxShadow:theme==="dark"?"0 32px 64px rgba(0,0,0,.4)":"0 32px 64px rgba(0,0,0,.08)"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:28}}><TLogo size={24}/><span style={{fontSize:16,fontWeight:600,letterSpacing:2,fontFamily:fm,color:K.txt}}>ThesisAlpha</span></div>
    <h2 style={{fontSize:28,fontFamily:fh,fontWeight:400,margin:"0 0 8px",textAlign:"center",color:K.txt}}>{mode==="login"?"Welcome back":"Create account"}</h2>
    <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 32px"}}>{mode==="login"?"Sign in to your portfolio":"Start tracking your thesis"}</p>
    {err&&<div style={{background:K.red+"12",border:"1px solid "+K.red+"30",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:K.red}}>{err}</div>}
    <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Email</label>
      <input type="email" value={email} onChange={function(e){setEmail(e.target.value);setErr("")}} placeholder="you@email.com" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <div style={{marginBottom:24}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Password</label>
      <input type="password" value={pw} onChange={function(e){setPw(e.target.value);setErr("")}} placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <button onClick={submit} disabled={ld2} style={{width:"100%",background:K.prim||K.acc,color:K.primTxt||"#fff",border:"none",padding:"14px",borderRadius:12,fontSize:14,fontWeight:600,cursor:ld2?"wait":"pointer",fontFamily:fb,marginBottom:16,opacity:ld2?.6:1}}>{ld2?"...":(mode==="login"?"Sign In":"Create Account")}</button>
    <div style={{textAlign:"center",fontSize:13,color:K.dim}}>{mode==="login"?"Don't have an account? ":"Already have an account? "}<span onClick={function(){setMode(mode==="login"?"signup":"login");setErr("")}} style={{color:K.acc,cursor:"pointer"}}>{mode==="login"?"Sign up":"Sign in"}</span></div>
  </div></div>)}

// ═══ TRACKER APP ═══
function TrackerApp(props){
  var _th=useState(function(){try{return localStorage.getItem("ta-theme")||"dark"}catch(e){return"dark"}}),theme=_th[0],setTheme=_th[1];
  var K=theme==="dark"?DARK:LIGHT;var S=mkS(K);var isDark=theme==="dark";
  function toggleTheme(){var n=theme==="dark"?"light":"dark";setTheme(n);try{localStorage.setItem("ta-theme",n)}catch(e){}}
  var _c=useState(SAMPLE),cos=_c[0],setCos=_c[1];var _l=useState(false),loaded=_l[0],setLoaded=_l[1];
  var _s=useState(null),selId=_s[0],setSelId=_s[1];var _ek=useState(null),expKpi=_ek[0],setExpKpi=_ek[1];
  var _sp=useState(null),subPage=_sp[0],setSubPage=_sp[1];
  var _dt=useState("overview"),detailTab=_dt[0],setDetailTab=_dt[1];
  var _m=useState(null),modal=_m[0],setModal=_m[1];var _ck=useState({}),checkSt=_ck[0],setCheckSt=_ck[1];
  var _pg=useState("dashboard"),page=_pg[0],setPage=_pg[1];
  var _n=useState([]),notifs=_n[0],setNotifs=_n[1];var _sn=useState(false),showNotifs=_sn[0],setShowNotifs=_sn[1];
  var _st2=useState("portfolio"),sideTab=_st2[0],setSideTab=_st2[1];
  var _an=useState(function(){try{return localStorage.getItem("ta-autonotify")==="true"}catch(e){return false}}),autoNotify=_an[0],setAutoNotify=_an[1];
  var _em=useState(function(){try{return localStorage.getItem("ta-emailnotify")==="true"}catch(e){return false}}),emailNotify=_em[0],setEmailNotify=_em[1];
  var _pr=useState(false),priceLoading=_pr[0],setPriceLoading=_pr[1];
  var DEFAULT_DASH={showSummary:true,showPrices:true,showPositions:true,showHeatmap:true,showSectors:true,showDividends:true,showAnalyst:true,showBuyZone:true};
  var _ds=useState(function(){try{var s=localStorage.getItem("ta-dashsettings");return s?Object.assign({},DEFAULT_DASH,JSON.parse(s)):DEFAULT_DASH}catch(e){return DEFAULT_DASH}}),dashSet=_ds[0],setDashSet=_ds[1];
  function toggleDash(key){setDashSet(function(p){var n=Object.assign({},p);n[key]=!n[key];try{localStorage.setItem("ta-dashsettings",JSON.stringify(n))}catch(e){}return n})}
  var saveTimer=useRef(null);var cloudTimer=useRef(null);
  // ── Inject global CSS for animations & polish ──
  useEffect(function(){
    if(typeof document==="undefined")return;
    var id="ta-global-css";if(document.getElementById(id))return;
    var style=document.createElement("style");style.id=id;
    style.textContent=[
      "@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes fadeInFast{from{opacity:0}to{opacity:1}}",
      "@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}",
      "@keyframes spin{to{transform:rotate(360deg)}}",
      "@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}",
      ".ta-fade{animation:fadeIn .3s ease-out both}",
      ".ta-slide{animation:slideUp .35s ease-out both}",
      ".ta-card{transition:border-color .2s ease,box-shadow .2s ease,transform .15s ease}",
      ".ta-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.12);transform:translateY(-1px)}",
      ".ta-btn{transition:all .15s ease}",
      ".ta-btn:hover{filter:brightness(1.15)}",
      ".ta-btn:active{transform:translateY(0.5px)}",
      ".ta-skel{background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 50%,transparent 100%);background-size:200% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:6px}",
      "::-webkit-scrollbar{width:6px;height:6px}",
      "::-webkit-scrollbar-track{background:transparent}",
      "::-webkit-scrollbar-thumb{background:rgba(120,120,160,.2);border-radius:3px}",
      "::-webkit-scrollbar-thumb:hover{background:rgba(120,120,160,.35)}",
      "input:focus,textarea:focus,select:focus{border-color:rgba(129,140,248,.5)!important;box-shadow:0 0 0 3px rgba(129,140,248,.1)!important;transition:all .15s ease}",
      "button{transition:all .12s ease}",
      "select{transition:border-color .15s ease}",
      ".ta-side-item{transition:background .15s ease,border-color .15s ease}",
      ".ta-side-item:hover{background:rgba(129,140,248,.06)}",
      ".ta-tab{transition:all .15s ease;position:relative}",
      ".ta-tab:hover{color:#f0f0f5}",
    ].join("\n");
    document.head.appendChild(style);
    return function(){var el=document.getElementById(id);if(el)el.remove()}},[]);
  // ── Load data ──
  useEffect(function(){
    // Load: try cloud first (cross-device), then localStorage (offline cache), then SAMPLE
    async function loadData(){
      var cloudData=await cloudLoad(props.userId);
      if(cloudData&&cloudData.cos&&cloudData.cos.length>0){
        setCos(cloudData.cos.map(function(c){return Object.assign({docs:[],earningsHistory:[],position:{shares:0,avgCost:0,currentPrice:0},conviction:0,convictionHistory:[],status:"portfolio",industry:"",lastDiv:0,divPerShare:0,divFrequency:"quarterly",exDivDate:"",researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0},c)}));
        if(cloudData.notifs)setNotifs(cloudData.notifs);
        svS("ta-data",cloudData);// cache locally
        setLoaded(true);return}
      // Fallback to localStorage
      var local=await ldS("ta-data");
      if(local&&local.cos&&local.cos.length>0){
        setCos(local.cos.map(function(c){return Object.assign({docs:[],earningsHistory:[],position:{shares:0,avgCost:0,currentPrice:0},conviction:0,convictionHistory:[],status:"portfolio",industry:"",lastDiv:0,divPerShare:0,divFrequency:"quarterly",exDivDate:"",researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0},c)}));
        if(local.notifs)setNotifs(local.notifs);
        // First login on this account — push local data to cloud
        cloudSave(props.userId,local);
        setLoaded(true);return}
      // Brand new user — use sample data
      setLoaded(true)}
    loadData()},[]);
  // Auto-refresh prices on load (FMP profile is free, ~1 req per company)
  useEffect(function(){if(!loaded||cos.length===0)return;
    var t=setTimeout(function(){refreshPrices()},2000);return function(){clearTimeout(t)}},[loaded]);
  // Auto-notify: when earnings date has passed, automatically check them
  var autoCheckDone=useRef({});
  useEffect(function(){if(!loaded||!autoNotify)return;
    cos.forEach(function(c){if(c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)<=0&&dU(c.earningsDate)>=-3){
      // Auto-check if not already checked and not already in progress
      var key=c.ticker+"-"+c.earningsDate;
      if(!c.lastChecked&&!autoCheckDone.current[key]&&!checkSt[c.id]){
        autoCheckDone.current[key]=true;
        setTimeout(function(){checkOne(c.id).then(function(){
          // Send browser push if enabled
          if(typeof Notification!=="undefined"&&Notification.permission==="granted"){
            try{new Notification("ThesisAlpha: "+c.ticker,{body:"Earnings results are now available",icon:"/logo.png"})}catch(e){}}
          // Build email notification if enabled
          if(emailNotify){sendEarningsEmail(c)}
        })},Math.random()*3000+1000)}// Stagger 1-4s
      else if(!c.lastChecked&&!notifs.some(function(n){return n.ticker===c.ticker&&n.type==="ready"})){
        setNotifs(function(p){return[{id:Date.now()+Math.random(),type:"ready",ticker:c.ticker,msg:"Earnings released \u2014 click Check Earnings to view",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}}});
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
  useEffect(function(){if(!loaded)return;var payload={cos:cos,notifs:notifs};
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(function(){svS("ta-data",payload)},500);
    if(cloudTimer.current)clearTimeout(cloudTimer.current);
    cloudTimer.current=setTimeout(function(){cloudSave(props.userId,payload)},2000);
    return function(){if(saveTimer.current)clearTimeout(saveTimer.current);if(cloudTimer.current)clearTimeout(cloudTimer.current)}},[cos,notifs,loaded]);
  // Reset expired earnings dates to TBD then auto-lookup via Finnhub (FREE, $0)
  useEffect(function(){if(!loaded)return;
    var toFetch=[];
    cos.forEach(function(c){
      if(c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)<-7){
        setCos(function(p){return p.map(function(x){return x.id===c.id?Object.assign({},x,{earningsDate:"TBD",earningsTime:"TBD"}):x})});
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
      setNotifs(function(p){return[{id:Date.now()+Math.random(),type:"upcoming",ticker:c.ticker,msg:"Earnings in "+d+"d \u2014 "+fD(c.earningsDate)+" "+c.earningsTime,time:new Date().toISOString(),read:false,ed:c.earningsDate}].concat(p).slice(0,30)})})},[loaded,cos]);
  var sel=cos.find(function(c){return c.id===selId})||null;
  var upd=function(id,fn){setCos(function(p){return p.map(function(c){return c.id===id?(typeof fn==="function"?fn(c):Object.assign({},c,fn)):c})})};
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
        setNotifs(function(p){return[{id:Date.now(),type:"found",ticker:co.ticker,msg:(r.quarter||"")+" results found",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}
      else{setCheckSt(function(p){var n=Object.assign({},p);n[cid]="not-yet";return n});upd(cid,{lastChecked:new Date().toISOString()})}}
    catch(e){console.warn("checkOne error:",e);setCheckSt(function(p){var n=Object.assign({},p);n[cid]="error";return n})}
    setTimeout(function(){setCheckSt(function(p){var n=Object.assign({},p);delete n[cid];return n})},6000)}
  async function checkAll(){var all=cos.filter(function(c){return c.status==="portfolio"||c.status==="watchlist"});for(var i=0;i<all.length;i++){await checkOne(all[i].id);await new Promise(function(r){setTimeout(r,1200)})}}
  async function refreshPrices(){setPriceLoading(true);
    for(var i=0;i<cos.length;i++){var c=cos[i];try{var r=await fetchPrice(c.ticker);
      if(r&&r.price){upd(c.id,function(prev){var updates={position:Object.assign({},prev.position,{currentPrice:r.price})};
        // Auto-populate dividend from FMP if user hasn't manually set one
        if(r.lastDiv>0&&!prev.divPerShare){updates.divPerShare=r.lastDiv;updates.lastDiv=r.lastDiv}
        return Object.assign({},prev,updates)})}}catch(e){}
      await new Promise(function(res){setTimeout(res,300)})}setPriceLoading(false)}
  function toggleAutoNotify(){var nv=!autoNotify;setAutoNotify(nv);try{localStorage.setItem("ta-autonotify",String(nv))}catch(e){}
    if(nv){requestPushPermission();
      setNotifs(function(p){return[{id:Date.now(),type:"system",ticker:"",msg:"Auto-notify enabled \u2014 earnings will be checked and you'll be notified",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}}
  function toggleEmailNotify(){var nv=!emailNotify;setEmailNotify(nv);try{localStorage.setItem("ta-emailnotify",String(nv))}catch(e){}}

  // ── Modals ─────────────────────────────────────────────────
  function AddModal(){var _f=useState({ticker:"",name:"",sector:"",earningsDate:"",earningsTime:"AMC",domain:"",irUrl:"",thesis:"",status:"portfolio"}),f=_f[0],setF=_f[1];
    var _ls=useState("idle"),ls=_ls[0],setLs=_ls[1];var _lm=useState(""),lm=_lm[0],setLm=_lm[1];var tmr=useRef(null);
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    async function doLookup(t){setLs("loading");setLm("");try{var r=await lookupTicker(t);
      if(r&&r.error){setLs("error");setLm(r.error)}
      else if(r&&r.name){setF(function(p){return Object.assign({},p,{name:p.name||r.name||"",sector:p.sector||r.sector||"",earningsDate:p.earningsDate||r.earningsDate||"",earningsTime:r.earningsTime||p.earningsTime,domain:p.domain||r.domain||"",irUrl:p.irUrl||r.irUrl||"",_price:r.price||0,_lastDiv:r.lastDiv||0,_industry:r.industry||""})});setLs("done");setLm("Auto-filled \u2713"+(r.earningsDate&&r.earningsDate!=="TBD"?" (incl. earnings date)":""))}
      else{setLs("error");setLm("Not found")}}catch(e){setLs("error");setLm("Lookup failed — try manually")}}
    function onTicker(v){set("ticker",v);if(tmr.current)clearTimeout(tmr.current);var t=v.toUpperCase().trim();
      if(t.length>=1&&t.length<=6&&/^[A-Z.]+$/.test(t)){setLs("idle");tmr.current=setTimeout(function(){doLookup(t)},1000)}else{setLs("idle");setLm("")}}
    function submit(){if(!f.ticker.trim()||!f.name.trim())return;if(tmr.current)clearTimeout(tmr.current);
      var nc={id:nId(cos),ticker:f.ticker.toUpperCase().trim(),name:f.name.trim(),sector:f.sector.trim(),industry:f._industry||"",domain:f.domain.trim(),irUrl:f.irUrl.trim(),earningsDate:f.earningsDate||"TBD",earningsTime:f.earningsTime,thesisNote:f.thesis.trim(),kpis:[],docs:[],earningsHistory:[],researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0,position:{shares:0,avgCost:0,currentPrice:f._price||0},conviction:0,convictionHistory:[],status:f.status||"portfolio",lastDiv:f._lastDiv||0,divPerShare:f._lastDiv||0,divFrequency:"quarterly",exDivDate:"",lastChecked:null,notes:"",earningSummary:null,sourceUrl:null,sourceLabel:null};
      setCos(function(p){return p.concat([nc])});setSelId(nc.id);setModal(null)}
    useEffect(function(){return function(){if(tmr.current)clearTimeout(tmr.current)}},[]);
    return<Modal title="Add Company" onClose={function(){if(tmr.current)clearTimeout(tmr.current);setModal(null)}} K={K}>
      <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"0 16px"}}><div><Inp label="Ticker" value={f.ticker} onChange={onTicker} placeholder="AAPL" K={K} spellCheck={false} autoCorrect="off" autoComplete="off"/>
        {ls!=="idle"&&<div style={{fontSize:11,color:ls==="loading"?K.dim:ls==="done"?K.grn:K.amb,marginTop:-10,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
          {ls==="loading"&&<span style={{display:"inline-block",width:10,height:10,border:"2px solid "+K.bdr2,borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>}{ls==="loading"?"Looking up\u2026":lm}</div>}</div>
        <Inp label="Company Name" value={f.name} onChange={function(v){set("name",v)}} placeholder="Apple Inc." K={K}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}><Inp label="Sector" value={f.sector} onChange={function(v){set("sector",v)}} placeholder="Technology" K={K}/><Inp label="Earnings Date" value={f.earningsDate} onChange={function(v){set("earningsDate",v)}} type="date" K={K}/><Sel label="Timing" value={f.earningsTime} onChange={function(v){set("earningsTime",v)}} options={[{v:"BMO",l:"Before Open"},{v:"AMC",l:"After Close"}]} K={K}/></div>
      <Inp label="Investment Thesis" value={f.thesis} onChange={function(v){set("thesis",v)}} ta placeholder="Why do you own this?" K={K}/>
      <Sel label="Add to" value={f.status} onChange={function(v){set("status",v)}} options={[{v:"portfolio",l:"Portfolio (I own this)"},{v:"watchlist",l:"Watchlist (Researching)"},{v:"toohard",l:"Too Hard (Outside circle)"}]} K={K}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}><button style={S.btn} onClick={function(){if(tmr.current)clearTimeout(tmr.current);setModal(null)}}>Cancel</button>
        <button style={Object.assign({},S.btnP,{opacity:f.ticker.trim()&&f.name.trim()?1:.4})} onClick={submit} disabled={!f.ticker.trim()||!f.name.trim()}>Add Company</button></div></Modal>}
  function EditModal(){if(!sel)return null;var _f=useState({ticker:sel.ticker,name:sel.name,sector:sel.sector,earningsDate:sel.earningsDate==="TBD"?"":sel.earningsDate,earningsTime:sel.earningsTime,domain:sel.domain||"",irUrl:sel.irUrl||""}),f=_f[0],setF=_f[1];var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    return<Modal title="Edit Company" onClose={function(){setModal(null)}} K={K}>
      <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"0 16px"}}><Inp label="Ticker" value={f.ticker} onChange={function(v){set("ticker",v)}} K={K}/><Inp label="Name" value={f.name} onChange={function(v){set("name",v)}} K={K}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}><Inp label="Sector" value={f.sector} onChange={function(v){set("sector",v)}} K={K}/><Inp label="Earnings Date" value={f.earningsDate} onChange={function(v){set("earningsDate",v)}} type="date" K={K}/><Sel label="Timing" value={f.earningsTime} onChange={function(v){set("earningsTime",v)}} options={[{v:"BMO",l:"Before Open"},{v:"AMC",l:"After Close"},{v:"TBD",l:"TBD"}]} K={K}/></div>
      <Inp label="Logo Domain" value={f.domain} onChange={function(v){set("domain",v)}} placeholder="apple.com" K={K}/>
      <Inp label="IR URL" value={f.irUrl} onChange={function(v){set("irUrl",v)}} placeholder="https://investor.apple.com" K={K}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}><button style={S.btnD} onClick={function(){setModal({type:"del"})}}>Delete Company</button><div style={{flex:1}}/><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnP} onClick={function(){upd(selId,{ticker:f.ticker.toUpperCase().trim(),name:f.name.trim(),sector:f.sector.trim(),domain:f.domain.trim(),irUrl:f.irUrl.trim(),earningsDate:f.earningsDate||"TBD",earningsTime:f.earningsTime});setModal(null)}}>Save</button></div></Modal>}
  function ThesisModal(){if(!sel)return null;var _v=useState(sel.thesisNote||""),v=_v[0],sv2=_v[1];
    return<Modal title={sel.ticker+" \u2014 Thesis"} onClose={function(){setModal(null)}} K={K}><Inp value={v} onChange={sv2} ta placeholder="Why do you own this?" K={K}/><div style={{display:"flex",justifyContent:"flex-end",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnP} onClick={function(){upd(selId,{thesisNote:v.trim()});setModal(null)}}>Save</button></div></Modal>}
  function KpiModal(){if(!sel)return null;var kid=modal.data;var ex=kid?sel.kpis.find(function(k){return k.id===kid}):null;
    var _f=useState({metricId:ex?ex.metricId||"":"",rule:ex?ex.rule:"gte",value:ex?String(ex.value):"",period:ex?ex.period:""}),f=_f[0],setF=_f[1];var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    // Filter out already-tracked metrics
    var used=sel.kpis.map(function(k){return k.metricId});
    var avail=METRICS.filter(function(m){return!used.includes(m.id)||m.id===(ex&&ex.metricId)});
    var cats={};avail.forEach(function(m){if(!cats[m.cat])cats[m.cat]=[];cats[m.cat].push(m)});
    var selMet=f.metricId?METRIC_MAP[f.metricId]:null;
    function doSave(){if(!f.metricId||isNaN(parseFloat(f.value)))return;var met=METRIC_MAP[f.metricId];var nv=parseFloat(f.value);
      var kd={metricId:f.metricId,name:met.label,rule:f.rule,value:nv,unit:met.unit,period:f.period.trim(),target:bT(f.rule,nv,met.unit),notes:""};
      if(ex)upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.map(function(k){return k.id===kid?Object.assign({},k,kd):k})})});
      else upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.concat([Object.assign({id:nId(c.kpis),lastResult:null},kd)])})});setModal(null)}
    return<Modal title={ex?"Edit Metric":"Track Metric"} onClose={function(){setModal(null)}} w={520} K={K}>
      {/* Metric picker grid */}
      {!ex&&<div style={{marginBottom:20}}>
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:12,fontFamily:fm}}>Choose Metric</div>
        {Object.keys(cats).map(function(cat){return<div key={cat} style={{marginBottom:12}}>
          <div style={{fontSize:10,color:K.dim,marginBottom:6,fontFamily:fm}}>{cat}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {cats[cat].map(function(m){var isSel=f.metricId===m.id;
              return<button key={m.id} onClick={function(){set("metricId",m.id);if(!f.value&&m.unit==="%")set("value","");}} style={{background:isSel?K.acc+"20":K.bg,border:"1px solid "+(isSel?K.acc:K.bdr),borderRadius:6,padding:"6px 12px",fontSize:11,color:isSel?K.acc:K.mid,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400}}>{m.label}</button>})}</div></div>})}</div>}
      {ex&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:14,fontWeight:500,color:K.txt}}>{selMet?selMet.label:ex.name}</div><div style={{fontSize:11,color:K.dim}}>{selMet?selMet.cat:""}</div></div>}
      {f.metricId&&<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
          <Sel label="Rule" value={f.rule} onChange={function(v){set("rule",v)}} options={[{v:"gte",l:"\u2265 At least"},{v:"lte",l:"\u2264 At most"},{v:"eq",l:"= Exactly"}]} K={K}/>
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
      <Sel label="Save to Folder" value={f.folder} onChange={function(v){set("folder",v)}} options={FOLDERS.map(function(fo){return{v:fo.id,l:fo.icon+" "+fo.label}})} K={K}/>
      <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>Content</label>
        <textarea value={f.content} onChange={function(e){set("content",e.target.value)}} rows={10} placeholder="Write your analysis, notes, or paste external research..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.7}}/></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:12}}>{ex&&<button style={S.btnD} onClick={function(){upd(selId,function(c){return Object.assign({},c,{docs:c.docs.filter(function(d){return d.id!==did})})});setModal(null)}}>Delete</button>}<div style={{flex:1}}/><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.title.trim()?1:.4})} onClick={doSave}>Save</button></div></Modal>}
  function PositionModal(){if(!sel)return null;var pos=sel.position||{shares:0,avgCost:0};
    var _f=useState({shares:String(pos.shares||""),avgCost:String(pos.avgCost||""),currentPrice:String(pos.currentPrice||""),divPerShare:String(sel.divPerShare||sel.lastDiv||""),divFrequency:sel.divFrequency||"quarterly",exDivDate:sel.exDivDate||"",targetPrice:String(sel.targetPrice||"")}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    var mult=f.divFrequency==="monthly"?12:f.divFrequency==="quarterly"?4:f.divFrequency==="semi"?2:1;
    var annDiv=parseFloat(f.divPerShare||0)*mult;
    var yld=f.currentPrice?annDiv/parseFloat(f.currentPrice)*100:0;
    var tp=parseFloat(f.targetPrice);var cp=parseFloat(f.currentPrice);var inBuyZone=tp>0&&cp>0&&cp<=tp;
    return<Modal title={"Position \u2014 "+sel.ticker} onClose={function(){setModal(null)}} w={480} K={K}>
      <Inp label="Shares Held" value={f.shares} onChange={function(v){set("shares",v)}} type="number" placeholder="0" K={K}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Average Cost per Share" value={f.avgCost} onChange={function(v){set("avgCost",v)}} type="number" placeholder="0.00" K={K}/>
      <Inp label="Current Price" value={f.currentPrice} onChange={function(v){set("currentPrice",v)}} type="number" placeholder="0.00" K={K}/></div>
      {f.shares&&f.avgCost&&f.currentPrice&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:14,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>COST BASIS</div><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>${(parseFloat(f.shares)*parseFloat(f.avgCost)).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>MKT VALUE</div><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>${(parseFloat(f.shares)*parseFloat(f.currentPrice)).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>GAIN/LOSS</div><div style={{fontSize:14,fontWeight:600,color:((parseFloat(f.currentPrice)-parseFloat(f.avgCost))/parseFloat(f.avgCost)*100)>=0?K.grn:K.red,fontFamily:fm}}>{((parseFloat(f.currentPrice)-parseFloat(f.avgCost))/parseFloat(f.avgCost)*100).toFixed(1)}%</div></div></div></div>}
      {/* Price alert / Buy zone */}
      <div style={{borderTop:"1px solid "+K.bdr,paddingTop:16,marginTop:8,marginBottom:8}}><div style={{fontSize:11,color:K.dim,letterSpacing:2,textTransform:"uppercase",fontFamily:fm,marginBottom:12}}>Price Alert</div></div>
      <Inp label="Buy Below / Target Price" value={f.targetPrice} onChange={function(v){set("targetPrice",v)}} type="number" placeholder="Set a buy target" K={K}/>
      {tp>0&&cp>0&&<div style={{background:inBuyZone?K.grn+"10":K.bg,border:"1px solid "+(inBuyZone?K.grn+"40":K.bdr),borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14}}>{inBuyZone?"\u2705":"\u23F3"}</span>
        <span style={{fontSize:12,color:inBuyZone?K.grn:K.dim,fontWeight:500}}>{inBuyZone?"In the buy zone! Current $"+cp.toFixed(2)+" \u2264 target $"+tp.toFixed(2):"Waiting — current $"+cp.toFixed(2)+" is "+(((cp-tp)/tp*100).toFixed(1))+"% above target $"+tp.toFixed(2)}</span></div>}
      {/* Dividends */}
      <div style={{borderTop:"1px solid "+K.bdr,paddingTop:16,marginTop:8,marginBottom:8}}><div style={{fontSize:11,color:K.dim,letterSpacing:2,textTransform:"uppercase",fontFamily:fm,marginBottom:12}}>Dividend</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Dividend per Payment" value={f.divPerShare} onChange={function(v){set("divPerShare",v)}} type="number" placeholder="0.00" K={K}/>
      <Sel label="Frequency" value={f.divFrequency} onChange={function(v){set("divFrequency",v)}} options={[{v:"quarterly",l:"Quarterly"},{v:"monthly",l:"Monthly"},{v:"semi",l:"Semi-Annual"},{v:"annual",l:"Annual"},{v:"none",l:"No Dividend"}]} K={K}/></div>
      <Inp label="Ex-Dividend Date (next)" value={f.exDivDate} onChange={function(v){set("exDivDate",v)}} type="date" K={K}/>
      {parseFloat(f.divPerShare)>0&&f.divFrequency!=="none"&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:14,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>ANNUAL DIV</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>${annDiv.toFixed(2)}</div></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>YIELD</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>{yld.toFixed(2)}%</div></div>
          {f.shares&&<div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>ANNUAL INCOME</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>${(parseFloat(f.shares)*annDiv).toFixed(0)}</div></div>}</div></div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnP} onClick={function(){upd(selId,{position:{shares:parseFloat(f.shares)||0,avgCost:parseFloat(f.avgCost)||0,currentPrice:parseFloat(f.currentPrice)||0},divPerShare:parseFloat(f.divPerShare)||0,divFrequency:f.divFrequency,exDivDate:f.exDivDate,targetPrice:parseFloat(f.targetPrice)||0});setModal(null)}}>Save</button></div></Modal>}
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
    function toggleFlag(id){setFlags(function(p){var n=Object.assign({},p);n[id]=!p[id];return n})}
    function saveConviction(){var hist=(sel.convictionHistory||[]).slice();var biasArr=BIAS_CHECKS.filter(function(b){return flags[b.id]}).map(function(b){return b.label});hist.push({date:new Date().toISOString().split("T")[0],rating:r,note:n2.trim(),biasFlags:biasArr});upd(selId,{conviction:r,convictionHistory:hist.slice(-20)});setModal(null)}
    if(step==="checklist")return<Modal title={"\u2708\uFE0F Pre-Flight Checklist \u2014 "+sel.ticker} onClose={function(){setModal(null)}} w={520} K={K}>
      <div style={{fontSize:12,color:K.mid,lineHeight:1.6,marginBottom:16}}>Before updating conviction, pause and honestly assess each bias. Flag any that apply right now.</div>
      <div style={{marginBottom:16}}>
        {BIAS_CHECKS.map(function(b){var flagged=flags[b.id];var answered=flags[b.id]!==undefined;return<div key={b.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 14px",marginBottom:4,borderRadius:8,background:flagged?K.red+"08":answered?K.grn+"06":"transparent",border:"1px solid "+(flagged?K.red+"25":answered?K.grn+"20":K.bdr),cursor:"pointer",transition:"all .15s"}} onClick={function(){toggleFlag(b.id)}}>
          <div style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:flagged?K.red+"15":answered?K.grn+"15":K.bg,border:"1px solid "+(flagged?K.red+"30":answered?K.grn+"30":K.bdr)}}>{flagged?<IC name="alert" size={13} color={K.red}/>:answered?<IC name="check" size={13} color={K.grn}/>:<IC name={b.icon} size={13} color={K.dim}/>}</div>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:flagged?K.red:K.txt,marginBottom:2}}>{b.label}</div>
            <div style={{fontSize:11,color:K.dim,lineHeight:1.4}}>{b.q}</div></div>
          <div style={{fontSize:9,color:flagged?K.red:answered?K.grn:K.dim,fontFamily:fm,flexShrink:0,paddingTop:4}}>{flagged?"FLAGGED":answered?"CLEAR":"tap"}</div>
        </div>})}</div>
      {flagCount>=3&&<div style={{background:K.amb+"12",border:"1px solid "+K.amb+"30",borderRadius:8,padding:"10px 14px",marginBottom:14}}><div style={{fontSize:12,fontWeight:600,color:K.amb,marginBottom:2}}>{"\u26A0"} {flagCount} biases flagged</div><div style={{fontSize:11,color:K.mid}}>Consider whether this is the right time to act. Munger: {'"'}The big money is not in the buying and selling, but in the waiting.{'"'}</div></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{Object.keys(flags).length}/{BIAS_CHECKS.length} reviewed</div>
        <div style={{display:"flex",gap:8}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button>
        <button style={Object.assign({},S.btnP,{opacity:allAnswered?1:.35})} onClick={function(){if(allAnswered)setStep("rate")}}>Continue to Rating {"\u2192"}</button></div></div></Modal>;
    return<Modal title={"Conviction Rating \u2014 "+sel.ticker} onClose={function(){setModal(null)}} w={440} K={K}>
      {flagCount>0&&<div style={{background:K.amb+"10",border:"1px solid "+K.amb+"25",borderRadius:6,padding:"8px 12px",marginBottom:16,fontSize:11,color:K.amb,fontFamily:fm}}>{"\u26A0"} {flagCount} bias flag{flagCount>1?"s":""} active: {BIAS_CHECKS.filter(function(b){return flags[b.id]}).map(function(b){return b.label}).join(", ")}</div>}
      <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:48,fontWeight:700,color:r>=8?K.grn:r>=5?K.amb:K.red,fontFamily:fm}}>{r}</div><div style={{fontSize:11,color:K.dim}}>out of 10</div></div>
      <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>{[1,2,3,4,5,6,7,8,9,10].map(function(v){return<button key={v} onClick={function(){setR(v)}} style={{width:32,height:32,borderRadius:6,border:"1px solid "+(v===r?K.acc:K.bdr),background:v===r?K.acc+"20":K.bg,color:v===r?K.acc:K.dim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{v}</button>})}</div>
      <Inp label="Note (optional)" value={n2} onChange={setN2} placeholder="Why this rating?" K={K}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}><button style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,padding:0}} onClick={function(){setStep("checklist")}}>{"\u2190"} Back to checklist</button>
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
    return<Modal title={"Enter Earnings \u2014 "+sel.ticker} onClose={function(){setModal(null)}} w={540} K={K}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Quarter" value={f.quarter} onChange={function(v){set("quarter",v)}} placeholder="Q4 2025" K={K}/><Inp label="Source Label" value={f.sourceLabel} onChange={function(v){set("sourceLabel",v)}} placeholder="Press Release" K={K}/></div>
      <Inp label="Source URL" value={f.sourceUrl} onChange={function(v){set("sourceUrl",v)}} placeholder="https://..." K={K}/>
      <Inp label="Summary" value={f.summary} onChange={function(v){set("summary",v)}} ta placeholder="Revenue of $X, up Y% YoY. EPS of $Z..." K={K}/>
      {sel.kpis.length>0&&<div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:8,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>KPI Results</label>
        {sel.kpis.map(function(k){return<div key={k.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:12,color:K.mid,flex:1}}>{k.name} <span style={{color:K.dim}}>({k.target})</span></span>
          <input type="number" value={kr[k.id]||""} onChange={function(e){setKr(function(p){var n=Object.assign({},p);n[k.id]=e.target.value;return n})}} placeholder="Actual" style={{width:100,background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 12px",fontSize:12,fontFamily:fm,outline:"none"}}/></div>})}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.quarter.trim()&&f.summary.trim()?1:.4})} onClick={doSave}>Save Earnings</button></div></Modal>}
  function exportPDF(){if(!sel)return;var c=sel;var h=gH(c.kpis);var pos=c.position||{};
    var html='<!DOCTYPE html><html><head><title>'+c.ticker+' Thesis</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;color:#1a1a1a;padding:48px;max-width:800px;margin:0 auto}h1{font-size:28px;margin-bottom:4px}h2{font-size:14px;text-transform:uppercase;letter-spacing:3px;color:#888;margin:28px 0 12px;border-bottom:1px solid #ddd;padding-bottom:6px}.meta{color:#666;font-size:14px;margin-bottom:24px}.card{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:12px}.row{display:flex;gap:16px;margin-bottom:8px}.col{flex:1}.label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px}.val{font-size:16px;font-weight:600}.grn{color:#16a34a}.red{color:#dc2626}.amb{color:#d97706}@media print{body{padding:24px}}</style></head><body>';
    html+='<h1>'+c.ticker+' \u2014 '+c.name+'</h1><div class="meta">'+c.sector+' \u2022 Generated '+(new Date().toLocaleDateString())+'</div>';
    if(c.conviction)html+='<div class="card"><div class="row"><div class="col"><div class="label">Conviction</div><div class="val">'+(c.conviction)+'/10</div></div>';
    if(pos.shares)html+='<div class="col"><div class="label">Position</div><div class="val">'+pos.shares+' shares @ $'+pos.avgCost+'</div></div>';
    if(pos.currentPrice)html+='<div class="col"><div class="label">Current</div><div class="val">$'+pos.currentPrice+' ('+((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)+'%)</div></div>';
    html+='</div></div>';
    if(c.thesisNote)html+='<h2>Investment Thesis</h2><div class="card"><p>'+c.thesisNote+'</p></div>';
    if(c.earningSummary)html+='<h2>Latest Earnings</h2><div class="card"><p>'+c.earningSummary+'</p></div>';
    if(c.kpis.length){html+='<h2>Key Metrics</h2>';c.kpis.forEach(function(k){var st=k.lastResult?k.lastResult.status:"pending";
      html+='<div class="card"><div class="row"><div class="col"><strong>'+k.name+'</strong><br/><span style="color:#888">Target: '+k.target+'</span></div><div class="col" style="text-align:right"><div class="val '+(st==="met"?"grn":st==="missed"?"red":"")+'">'+(k.lastResult?k.lastResult.actual+(k.unit||""):"Pending")+'</div><div class="label">'+st.toUpperCase()+'</div></div></div></div>'})}
    if(c.earningsHistory&&c.earningsHistory.length){html+='<h2>Earnings History</h2>';c.earningsHistory.slice(0,8).forEach(function(e){html+='<div class="card"><strong>'+e.quarter+'</strong><p>'+e.summary+'</p></div>'})}
    if(c.convictionHistory&&c.convictionHistory.length){html+='<h2>Conviction History</h2><div class="card">';c.convictionHistory.forEach(function(ch){html+='<div style="margin-bottom:6px"><strong>'+ch.date+':</strong> '+ch.rating+'/10'+(ch.note?' \u2014 '+ch.note:'')+(ch.biasFlags&&ch.biasFlags.length?' <span style="color:#d97706">[Flags: '+ch.biasFlags.join(', ')+']</span>':'')+'</div>'});html+='</div>'}
    if(c.decisions&&c.decisions.length){html+='<h2>Decision Ledger</h2>';c.decisions.slice(0,10).forEach(function(d){html+='<div class="card"><strong class="'+(d.action==="BUY"||d.action==="ADD"?"grn":"red")+'">'+d.action+'</strong> \u2014 '+new Date(d.date).toLocaleDateString()+(d.convictionAtTime?' (C:'+d.convictionAtTime+')':'')+(d.outcome?' \u2014 <strong class="'+(d.outcome==="right"?"grn":"red")+'">'+d.outcome.toUpperCase()+'</strong>':'')+'<p>'+d.reasoning+'</p>'+(d.invalidator?'<p style="color:#dc2626;font-size:13px">\u26A0 Kill thesis if: '+d.invalidator+'</p>':'')+'</div>'})}
    html+='<div style="margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#aaa">ThesisAlpha \u2022 thesisalpha.io</div></body></html>';
    var w=window.open("","_blank");w.document.write(html);w.document.close();w.print()}
  function exportCSV(list){
    var rows=[["Ticker","Company","Sector","Status","Shares","Avg Cost","Current Price","Return %","Market Value","Conviction","Earnings Date","KPIs Met","Target Price","Thesis"]];
    list.forEach(function(c){var pos=c.position||{};var ret=pos.avgCost>0&&pos.currentPrice>0?((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(2):"";
      var val=pos.shares>0&&pos.currentPrice>0?(pos.shares*pos.currentPrice).toFixed(0):"";
      var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;var total=c.kpis.filter(function(k){return k.lastResult}).length;
      rows.push([c.ticker,'"'+c.name+'"',c.sector,c.status||"portfolio",pos.shares||"",pos.avgCost||"",pos.currentPrice||"",ret,val,c.conviction||"",c.earningsDate||"",total>0?met+"/"+total:"",c.targetPrice||"",'"'+(c.thesisNote||"").replace(/"/g,"''")+'"'])});
    var csv=rows.map(function(r){return r.join(",")}).join("\n");
    var blob=new Blob([csv],{type:"text/csv"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="thesisalpha-portfolio-"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(url)}
  function SettingsModal(){
    var items=[{k:"showSummary",l:"Portfolio Summary Cards",d:"Total value, return, best/worst performer"},{k:"showPrices",l:"Stock Prices on Cards",d:"Show current price on company cards"},{k:"showPositions",l:"Position Details on Cards",d:"Show shares, return % on company cards"},{k:"showHeatmap",l:"Portfolio Heatmap",d:"Color-coded portfolio performance map"},{k:"showSectors",l:"Sector Concentration",d:"Sector breakdown chart"},{k:"showDividends",l:"Dividend Overview",d:"Dividend income tracking and yields"},{k:"showAnalyst",l:"Analyst & Insider Data",d:"Recommendations, price targets, insider trades"},{k:"showBuyZone",l:"Buy Zone Indicators",d:"Show when price is below analyst targets"}];
    return<Modal title="Dashboard Settings" onClose={function(){setModal(null)}} K={K} w={480}>
      <div style={{fontSize:12,color:K.dim,marginBottom:20}}>Customize your dashboard. Toggle features to make it as clean or feature-packed as you want.</div>
      {items.map(function(it){return<div key={it.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid "+K.bdr}}>
        <div><div style={{fontSize:13,color:K.txt,fontWeight:500}}>{it.l}</div><div style={{fontSize:11,color:K.dim,marginTop:2}}>{it.d}</div></div>
        <button onClick={function(){toggleDash(it.k)}} style={{width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",background:dashSet[it.k]?K.acc:K.bdr2,position:"relative",transition:"background .2s",flexShrink:0}}>
          <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:dashSet[it.k]?23:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/></button></div>})}
      <div style={{marginTop:20,textAlign:"right"}}><button onClick={function(){setModal(null)}} style={S.btnP}>Done</button></div></Modal>}
  function renderModal(){if(!modal)return null;var map={add:AddModal,edit:EditModal,thesis:ThesisModal,kpi:KpiModal,result:ResultModal,del:DelModal,doc:DocModal,position:PositionModal,conviction:ConvictionModal,manualEarnings:ManualEarningsModal,settings:SettingsModal};var C=map[modal.type];return C?<C/>:null}

  // ── Sidebar + TopBar ──────────────────────────────────────
  function Sidebar(){var pCos=cos.filter(function(c){return(c.status||"portfolio")===sideTab});
    return<div style={{width:240,minWidth:240,background:K.side,borderRight:"1px solid "+K.bdr,height:"100vh",position:"sticky",top:0,display:"flex",flexDirection:"column",overflowY:"auto"}}>
    <div style={{padding:"18px 20px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={function(){setSelId(null)}}><TLogo size={22} dark={isDark}/><span style={{fontSize:13,fontWeight:600,color:K.txt,letterSpacing:1.5,fontFamily:fm}}>ThesisAlpha</span></div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:!selId&&page==="dashboard"?K.blue+"10":"transparent",borderLeft:!selId&&page==="dashboard"?"2px solid "+K.blue:"2px solid transparent"}} onClick={function(){setSelId(null);setPage("dashboard")}}><span style={{fontSize:12,color:!selId&&page==="dashboard"?K.blue:K.mid,fontWeight:!selId&&page==="dashboard"?600:400,fontFamily:fm}}>Portfolio Overview</span></div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="hub"?K.acc+"10":"transparent",borderLeft:page==="hub"?"2px solid "+K.acc:"2px solid transparent"}} onClick={function(){setSelId(null);setPage("hub")}}><span style={{fontSize:12,color:page==="hub"?K.acc:K.mid,fontWeight:page==="hub"?600:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="book" size={14} color={page==="hub"?K.acc:K.mid}/>Owner's Hub</span></div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="analytics"?K.acc+"10":"transparent",borderLeft:page==="analytics"?"2px solid "+K.acc:"2px solid transparent"}} onClick={function(){setSelId(null);setPage("analytics")}}><span style={{fontSize:12,color:page==="analytics"?K.acc:K.mid,fontWeight:page==="analytics"?600:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="bar" size={14} color={page==="analytics"?K.acc:K.mid}/>Analytics</span></div>
    <div style={{padding:"10px 16px 6px"}}>
      <select value={sideTab} onChange={function(e){setSideTab(e.target.value)}} style={{width:"100%",background:K.bg,border:"1px solid "+(sideTab==="portfolio"?K.acc:sideTab==="toohard"?K.red:K.amb)+"50",borderRadius:8,color:sideTab==="portfolio"?K.acc:sideTab==="toohard"?K.red:K.amb,padding:"9px 14px",fontSize:12,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
        <option value="portfolio">Portfolio ({cos.filter(function(c){return(c.status||"portfolio")==="portfolio"}).length})</option>
        <option value="watchlist">Watchlist ({cos.filter(function(c){return c.status==="watchlist"}).length})</option>
        <option value="toohard">Too Hard ({cos.filter(function(c){return c.status==="toohard"}).length})</option>
      </select></div>
    <div style={{flex:1,overflowY:"auto",paddingTop:4}}>{pCos.map(function(c){var active=selId===c.id,h=gH(c.kpis),d=dU(c.earningsDate);
      return<div key={c.id} className="ta-side-item" style={{padding:"10px 16px 10px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,background:active?K.blue+"10":"transparent",borderLeft:active?"2px solid "+K.blue:"2px solid transparent"}} onClick={function(){setSelId(c.id);setExpKpi(null);setSubPage(null);setDetailTab("overview");setPage("dashboard")}}>
        <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:active?K.txt:K.mid,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:10,color:K.dim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div></div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}><div style={{width:6,height:6,borderRadius:"50%",background:h.c}}/>
          {d>=0&&d<=7&&<div style={{fontSize:9,color:K.amb,fontWeight:600,fontFamily:fm}}>{d}d</div>}
          {c.earningsDate==="TBD"&&<div style={{fontSize:9,color:K.dim,fontFamily:fm}}>TBD</div>}</div></div>})}</div>
    <div style={{padding:"12px 16px",borderTop:"1px solid "+K.bdr}}><button style={Object.assign({},S.btnP,{width:"100%",padding:"8px",fontSize:11})} onClick={function(){setModal({type:"add"})}}>+ Add Company</button></div></div>}
  function TopBar(){
    return<div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"12px 32px",borderBottom:"1px solid "+K.bdr,background:K.card+"e6",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50,gap:12}}>
    <button onClick={toggleTheme} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}} title={isDark?"Light mode":"Dark mode"}>{isDark?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}</button>
    <div style={{position:"relative",cursor:"pointer",padding:4}} onClick={function(){setShowNotifs(!showNotifs);if(!showNotifs)setNotifs(function(p){return p.map(function(n){return Object.assign({},n,{read:true})})})}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={unread>0?K.mid:K.dim} strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      {unread>0&&<div style={{position:"absolute",top:1,right:1,width:8,height:8,borderRadius:"50%",background:K.grn,border:"2px solid "+K.card}}/>}</div>
    {showNotifs&&<div style={{position:"absolute",top:48,right:32,width:380,maxHeight:420,overflowY:"auto",background:K.card,border:"1px solid "+K.bdr2,borderRadius:12,boxShadow:"0 16px 48px rgba(0,0,0,.3)",zIndex:100}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>Notifications</span>{notifs.length>0&&<button style={Object.assign({},S.btn,{padding:"2px 8px",fontSize:10})} onClick={function(){setNotifs([])}}>Clear</button>}</div>
      {notifs.length===0?<div style={{padding:"36px 18px",textAlign:"center",fontSize:12,color:K.dim}}>No notifications</div>:notifs.slice(0,15).map(function(n){return<div key={n.id} style={{padding:"12px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:n.type==="found"?K.grn:K.amb,flexShrink:0,marginTop:4}}/><div><div style={{fontSize:12,color:K.txt,fontFamily:fm}}><strong>{n.ticker}</strong> <span style={{color:K.mid,fontWeight:400}}>{n.msg}</span></div><div style={{fontSize:10,color:K.dim,marginTop:3}}>{fT(n.time)}</div></div></div>})}</div>}
    <button onClick={function(){setModal({type:"settings"})}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}} title="Dashboard Settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
    <button onClick={function(){props.onLogout()}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:10})}>Logout</button>
    <div style={{width:28,height:28,borderRadius:"50%",background:K.acc+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:K.acc,fontWeight:600,fontFamily:fm}}>{(props.user||"U")[0].toUpperCase()}</div></div>}

  // ── AI Detectors (simplified reference — same logic, theme-aware) ──
  // ── Research Links (paste URLs per holding) ──
  function ResearchLinks(p){var c=p.company;var links=c.researchLinks||[];
    var _adding=useState(false),adding=_adding[0],setAdding=_adding[1];
    var _url=useState(""),url=_url[0],setUrl=_url[1];var _label=useState(""),label=_label[0],setLabel=_label[1];var _cat=useState("article"),cat=_cat[0],setCat=_cat[1];
    var cats=[{v:"article",l:"Article"},{v:"report",l:"Report/Filing"},{v:"video",l:"Video/Podcast"},{v:"twitter",l:"Twitter/X Thread"},{v:"other",l:"Other"}];
    var catIcons={article:"news",report:"file",video:"video",twitter:"msg",other:"link"};
    function addLink(){if(!url.trim())return;
      var newLink={id:Date.now(),url:url.trim(),label:label.trim()||url.trim().replace(/https?:\/\/(www\.)?/,"").split("/")[0],category:cat,addedAt:new Date().toISOString()};
      upd(c.id,function(prev){return Object.assign({},prev,{researchLinks:(prev.researchLinks||[]).concat([newLink])})});
      setUrl("");setLabel("");setAdding(false)}
    function removeLink(lid){upd(c.id,function(prev){return Object.assign({},prev,{researchLinks:(prev.researchLinks||[]).filter(function(l){return l.id!==lid})})})}
    return<div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}><IC name="link" size={14} color={K.dim}/>Research</div><button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setAdding(!adding)}}>+ Add Link</button></div>
      {adding&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
        <Inp label="URL" value={url} onChange={setUrl} placeholder="https://..." K={K}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Label (optional)" value={label} onChange={setLabel} placeholder="Article title" K={K}/><Sel label="Type" value={cat} onChange={setCat} options={cats} K={K}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:url.trim()?1:.4})} onClick={addLink}>Add</button></div></div>}
      {links.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:20,textAlign:"center",fontSize:12,color:K.dim}}>Save links to articles, reports, podcasts.</div>}
      {links.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        {links.map(function(l,i){return<div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<links.length-1?"1px solid "+K.bdr:"none"}}>
          <IC name={catIcons[l.category]||"link"} size={14} color={K.dim}/>
          <a href={l.url} target="_blank" rel="noreferrer" style={{flex:1,fontSize:12,color:K.blue,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.label}</a>
          <span style={{fontSize:9,color:K.dim,fontFamily:fm,whiteSpace:"nowrap"}}>{l.category}</span>
          <button onClick={function(){removeLink(l.id)}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:12,padding:2,opacity:.5}}>{"\u2715"}</button></div>})}</div>}</div>}

  // ── Decision Journal (BUY/SELL/HOLD log) ──
  function DecisionJournal(p){var c=p.company;var decisions=c.decisions||[];
    var _adding=useState(false),adding=_adding[0],setAdding=_adding[1];
    var _exp2=useState(null),expDec=_exp2[0],setExpDec=_exp2[1];
    var _f=useState({action:"BUY",price:"",shares:"",reasoning:"",invalidator:"",timeHorizon:"long"}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p2){var n=Object.assign({},p2);n[k]=v;return n})};
    function addDecision(){if(!f.reasoning.trim()||!f.invalidator.trim())return;
      var entry={id:Date.now(),action:f.action,price:f.price?parseFloat(f.price):null,shares:f.shares?parseInt(f.shares):null,reasoning:f.reasoning.trim(),invalidator:f.invalidator.trim(),timeHorizon:f.timeHorizon,convictionAtTime:c.conviction||0,date:new Date().toISOString(),priceAtTime:c.position&&c.position.currentPrice?c.position.currentPrice:null,outcome:null,outcomeNote:"",biasFlags:[]};
      upd(c.id,function(prev){return Object.assign({},prev,{decisions:[entry].concat(prev.decisions||[]).slice(0,50)})});
      setF({action:"BUY",price:"",shares:"",reasoning:"",invalidator:"",timeHorizon:"long"});setAdding(false)}
    function markOutcome(decId,outcome){upd(c.id,function(prev){return Object.assign({},prev,{decisions:(prev.decisions||[]).map(function(d){return d.id===decId?Object.assign({},d,{outcome:outcome,outcomeDate:new Date().toISOString()}):d})})})}
    var actionColors={BUY:K.grn,SELL:K.red,HOLD:K.amb,TRIM:K.red,ADD:K.grn,PASS:K.dim};
    var actionIcons={BUY:"\u2191",SELL:"\u2193",ADD:"\u2191",TRIM:"\u2193",HOLD:"\u2014",PASS:"\u2718"};
    var scored=decisions.filter(function(d){return d.outcome});var rights=scored.filter(function(d){return d.outcome==="right"}).length;
    return<div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}><IC name="edit" size={14} color={K.dim}/>Decision Ledger</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>{scored.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{rights}/{scored.length} right ({Math.round(rights/scored.length*100)}%)</span>}
        <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setAdding(!adding)}}>+ Log Decision</button></div></div>
      {adding&&<div style={{background:K.card,border:"1px solid "+K.acc+"30",borderRadius:12,padding:"20px 24px",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:600,color:K.acc,marginBottom:14,fontFamily:fm,letterSpacing:2}}>NEW DECISION ENTRY</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Sel label="Action" value={f.action} onChange={function(v){set("action",v)}} options={[{v:"BUY",l:"BUY"},{v:"SELL",l:"SELL"},{v:"ADD",l:"ADD"},{v:"TRIM",l:"TRIM"},{v:"HOLD",l:"HOLD"},{v:"PASS",l:"PASS"}]} K={K}/>
          <Inp label="Price" value={f.price} onChange={function(v){set("price",v)}} type="number" placeholder="$" K={K}/>
          <Inp label="Shares" value={f.shares} onChange={function(v){set("shares",v)}} type="number" placeholder="Qty" K={K}/>
          <Sel label="Horizon" value={f.timeHorizon} onChange={function(v){set("timeHorizon",v)}} options={[{v:"short",l:"< 1yr"},{v:"medium",l:"1\u20133yr"},{v:"long",l:"3\u201310yr"}]} K={K}/></div>
        <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,color:K.txt,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600}}>Why am I making this decision? *</label>
          <textarea value={f.reasoning} onChange={function(e){set("reasoning",e.target.value)}} rows={3} placeholder="Core thesis. What do I believe that the market doesn't?" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"12px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
        <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,color:K.red,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600}}>{"\u26A0"} What would prove me wrong? *</label>
          <textarea value={f.invalidator} onChange={function(e){set("invalidator",e.target.value)}} rows={2} placeholder="Specific events or metrics that would kill this thesis" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.red+"25",borderRadius:6,color:K.txt,padding:"12px",fontSize:12,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
        {c.conviction>0&&<div style={{fontSize:11,color:K.dim,marginBottom:12,fontFamily:fm}}>Conviction snapshot: <span style={{color:c.conviction>=8?K.grn:c.conviction>=5?K.amb:K.red,fontWeight:600}}>{c.conviction}/10</span></div>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.reasoning.trim()&&f.invalidator.trim()?1:.3})} onClick={addDecision}>Save to Ledger</button></div></div>}
      {decisions.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:24,textAlign:"center"}}><div style={{fontSize:13,color:K.dim,marginBottom:4}}>No decisions logged yet</div><div style={{fontSize:11,color:K.dim}}>Record every BUY, SELL, or PASS with your reasoning and invalidation criteria.</div></div>}
      {decisions.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        {decisions.slice(0,10).map(function(d,i){var isExp=expDec===d.id;return<div key={d.id} style={{padding:"12px 16px",borderBottom:i<Math.min(decisions.length,10)-1?"1px solid "+K.bdr:"none",cursor:"pointer",background:isExp?K.acc+"06":"transparent"}} onClick={function(){setExpDec(isExp?null:d.id)}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontWeight:700,fontSize:11,color:actionColors[d.action]||K.txt,fontFamily:fm,letterSpacing:1}}>{actionIcons[d.action]||""} {d.action}</span>
            {d.convictionAtTime>0&&<span style={{fontSize:9,color:K.dim,fontFamily:fm,background:K.bdr,padding:"1px 5px",borderRadius:3}}>C:{d.convictionAtTime}</span>}
            {d.timeHorizon&&<span style={{fontSize:9,color:K.dim,fontFamily:fm,background:K.bg,border:"1px solid "+K.bdr,padding:"1px 5px",borderRadius:3}}>{d.timeHorizon==="short"?"<1y":d.timeHorizon==="medium"?"1-3y":"3-10y"}</span>}
            {d.outcome&&<span style={{fontSize:9,fontWeight:600,color:d.outcome==="right"?K.grn:d.outcome==="wrong"?K.red:K.amb,fontFamily:fm,padding:"1px 6px",borderRadius:3,background:(d.outcome==="right"?K.grn:d.outcome==="wrong"?K.red:K.amb)+"15"}}>{d.outcome.toUpperCase()}</span>}
            {d.shares&&<span style={{fontSize:10,color:K.mid,fontFamily:fm}}>{d.shares} sh</span>}
            {d.price&&<span style={{fontSize:10,color:K.mid,fontFamily:fm}}>@${d.price}</span>}
            <span style={{marginLeft:"auto",fontSize:9,color:K.dim,fontFamily:fm}}>{new Date(d.date).toLocaleDateString()}</span></div>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{d.reasoning}</div>
          {isExp&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid "+K.bdr}}>
            {d.invalidator&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:K.red,fontFamily:fm,letterSpacing:1,marginBottom:2,fontWeight:600}}>{"\u26A0"} INVALIDATION CRITERIA</div><div style={{fontSize:11,color:K.mid,lineHeight:1.5}}>{d.invalidator}</div></div>}
            {d.priceAtTime&&<div style={{fontSize:10,color:K.dim,marginBottom:6,fontFamily:fm}}>Price at entry: ${d.priceAtTime}</div>}
            {d.biasFlags&&d.biasFlags.length>0&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:K.amb,fontFamily:fm,letterSpacing:1,marginBottom:2,fontWeight:600}}>BIAS FLAGS</div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{d.biasFlags.map(function(b,bi){return<span key={bi} style={{fontSize:9,color:K.amb,background:K.amb+"15",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>{b}</span>})}</div></div>}
            {!d.outcome&&<div style={{display:"flex",gap:6,marginTop:6}}><span style={{fontSize:10,color:K.dim,fontFamily:fm,lineHeight:"24px"}}>Outcome:</span>
              <button style={{fontSize:10,color:K.grn,background:K.grn+"12",border:"1px solid "+K.grn+"30",borderRadius:4,padding:"2px 10px",cursor:"pointer",fontFamily:fm}} onClick={function(e){e.stopPropagation();markOutcome(d.id,"right")}}>Right</button>
              <button style={{fontSize:10,color:K.red,background:K.red+"12",border:"1px solid "+K.red+"30",borderRadius:4,padding:"2px 10px",cursor:"pointer",fontFamily:fm}} onClick={function(e){e.stopPropagation();markOutcome(d.id,"wrong")}}>Wrong</button>
              <button style={{fontSize:10,color:K.amb,background:K.amb+"12",border:"1px solid "+K.amb+"30",borderRadius:4,padding:"2px 10px",cursor:"pointer",fontFamily:fm}} onClick={function(e){e.stopPropagation();markOutcome(d.id,"mixed")}}>Mixed</button></div>}
          </div>}</div>})}</div>}</div>}

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
            <span style={{fontSize:11,color:K.blue}}>{"\u2197"}</span></a>})}</div></div>}

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
        <button style={Object.assign({},S.btnP,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>+ New Note</button></div>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={function(){setAf("all")}} style={{background:af==="all"?K.acc+"20":"transparent",border:"1px solid "+(af==="all"?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 12px",fontSize:11,color:af==="all"?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>All ({docs.length})</button>
        {FOLDERS.map(function(fo){return<button key={fo.id} onClick={function(){setAf(fo.id)}} style={{background:af===fo.id?K.acc+"20":"transparent",border:"1px solid "+(af===fo.id?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 12px",fontSize:11,color:af===fo.id?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>{fo.icon} {fo.label} {folderCounts[fo.id]>0?"("+folderCounts[fo.id]+")":""}</button>})}</div>
      {filtered.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:28,textAlign:"center"}}><div style={{fontSize:13,color:K.dim,marginBottom:8}}>{af==="all"?"No notes yet for "+c.ticker:"No notes in this folder"}</div><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>Create your first note</button></div>}
      {filtered.map(function(d){var fo=FOLDERS.find(function(f){return f.id===d.folder});
        return<div key={d.id} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:8,cursor:"pointer"}} onClick={function(){setModal({type:"doc",data:d.id})}}>
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
        {c.sourceUrl&&<a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:K.blue,textDecoration:"none"}}>{c.sourceLabel||"Source"} {"\u2197"}</a>}</div>
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
      metrics.push({id:"grossMargin",name:"Gross Margin Stability",score:Math.min(10,Math.max(1,Math.round((gmAvg/10)+3-(gmStd*5)))),value:gmAvg.toFixed(1)+"%",detail:"Avg "+gmAvg.toFixed(1)+"% (\u00B1"+gmStd.toFixed(1)+"%)",trend:gm.map(function(v){return v*100}),icon:"shield",desc:"High & stable margins indicate pricing power"})}
    else{var revs0=vals(recent,"revenue");var gps0=vals(recent,"grossProfit");
      if(revs0.length>=2&&gps0.length>=2){var gmC=gps0.map(function(g,i){return revs0[i]?g/revs0[i]:null}).filter(function(v){return v!=null});
        if(gmC.length>=2){var gmA=avg(gmC)*100;var gmS=stdDev(gmC)*100;
          metrics.push({id:"grossMargin",name:"Gross Margin Stability",score:Math.min(10,Math.max(1,Math.round((gmA/10)+3-(gmS*5)))),value:gmA.toFixed(1)+"%",detail:"Avg "+gmA.toFixed(1)+"% (\u00B1"+gmS.toFixed(1)+"%)",trend:gmC.map(function(v){return v*100}),icon:"shield",desc:"High & stable margins indicate pricing power"})}}}
    // 2. REVENUE GROWTH
    var revs=vals(recent,"revenue");
    if(revs.length>=3){var growths=[];for(var gi=1;gi<revs.length;gi++){growths.push((revs[gi]-revs[gi-1])/Math.abs(revs[gi-1])*100)}
      var grAvg=avg(growths);var grStd=stdDev(growths);
      metrics.push({id:"revGrowth",name:"Revenue Growth",score:Math.min(10,Math.max(1,Math.round(grAvg>30?8:grAvg>15?7:grAvg>5?6:grAvg>0?4:2)+Math.round(2-(grStd||0)/10))),value:(grAvg>=0?"+":"")+grAvg.toFixed(1)+"%",detail:"CAGR "+(grAvg>=0?"+":"")+grAvg.toFixed(1)+"% (\u00B1"+(grStd||0).toFixed(1)+"%)",trend:growths,icon:"trending",desc:"Consistent growth signals durable demand"})}
    // 3. OPERATING LEVERAGE
    var om=vals(recent,"operatingIncomeRatio");
    if(om.length<2){var oi2=vals(recent,"operatingIncome");if(oi2.length>=2&&revs.length>=2){om=oi2.map(function(o,i){return revs[i]?o/revs[i]:null}).filter(function(v){return v!=null})}}
    if(om.length>=2){var omFirst=om[0]*100;var omLast=om[om.length-1]*100;var omAvg=avg(om)*100;var expanding=omLast>omFirst;
      metrics.push({id:"opLeverage",name:"Operating Leverage",score:Math.min(10,Math.max(1,Math.round(omAvg>25?8:omAvg>15?7:omAvg>8?6:omAvg>0?4:2)+(expanding?1:-1))),value:omAvg.toFixed(1)+"%",detail:(expanding?"\u2191 Expanding":"\u2193 Contracting")+" ("+omFirst.toFixed(1)+"% \u2192 "+omLast.toFixed(1)+"%)",trend:om.map(function(v){return v*100}),icon:"gear",desc:"Expanding operating margins signal scale advantages"})}
    // 4. ROIC
    if(recent.length>=2&&recentBal.length>=2){var roics=[];for(var ri=0;ri<Math.min(recent.length,recentBal.length);ri++){var opInc=recent[ri].operatingIncome||recent[ri].netIncome;var ta=recentBal[ri]?recentBal[ri].totalAssets:null;var cl=recentBal[ri]?recentBal[ri].totalCurrentLiabilities||0:0;if(opInc!=null&&ta&&(ta-cl)>0)roics.push(opInc/(ta-cl)*100)}
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
      metrics.push({id:"netMargin",name:"Net Margin Trend",score:Math.min(10,Math.max(1,Math.round(nmA>20?8:nmA>12?7:nmA>5?5:nmA>0?3:1)+(imp?1:0))),value:nmA.toFixed(1)+"%",detail:(imp?"\u2191":"\u2193")+" "+nmF.toFixed(1)+"% \u2192 "+nmL.toFixed(1)+"%",trend:nm.map(function(v){return v*100}),icon:"bar",desc:"Improving profitability = strengthening position"})}
    if(metrics.length===0)return null;
    var composite=Math.round(avg(metrics.map(function(m){return m.score})));
    return{metrics:metrics,composite:composite,years:recent.length}}

  function moatLabel(score){return score>=8?"Wide Moat":score>=6?"Narrow Moat":score>=4?"Weak Moat":"No Moat"}
  function moatColor(score){return score>=8?K.grn:score>=6?K.amb:K.red}

  // ── Moat Durability Tracker ─────────────────────────────
  function MoatTracker(p){var c=p.company;
    var _data=useState(null),data=_data[0],setData=_data[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    useEffect(function(){setLd(true);
      fetchFinancialStatements(c.ticker,"annual").then(function(r){setData(r);setLd(false)}).catch(function(){setLd(false)})},[c.ticker]);
    var moat=calcMoatFromData(data);
    var cLabel=!moat?"Insufficient Data":moatLabel(moat.composite);
    var cColor=!moat?K.dim:moatColor(moat.composite);
    return<div style={{padding:"0 32px 60px",maxWidth:900}}>
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"24px 0 12px"}}>
        <button onClick={function(){setSubPage(null)}} style={{background:"none",border:"none",color:K.acc,fontSize:13,cursor:"pointer",fontFamily:fm,padding:0}}>{"\u2190"} Back</button>
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
          <div style={{fontSize:36,fontWeight:700,color:cColor,fontFamily:fm,lineHeight:1}}>{moat.composite}</div>
          <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>/10</div></div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:500,color:cColor,fontFamily:fh,marginBottom:4}}>{cLabel}</div>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.7}}>{moat.composite>=8?"This company shows strong competitive advantages across multiple dimensions. Durable moats deserve premium conviction.":moat.composite>=6?"Some competitive advantages are visible, but not all dimensions are strong. Monitor for moat erosion.":moat.composite>=4?"Limited competitive advantages detected. This company may be vulnerable to competition.":"No clear competitive moat identified. High conviction requires a special thesis."}</div>
          <div style={{fontSize:10,color:K.dim,marginTop:8,fontFamily:fm}}>Based on {moat.years} years of SEC EDGAR data · {moat.metrics.length} dimensions analyzed</div></div></div>
      {/* Individual Metrics */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {moat.metrics.map(function(m){
          var barColor=m.score>=8?K.grn:m.score>=6?K.amb:K.red;
          return<div key={m.id} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <IC name={m.icon} size={16} color={K.dim}/>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{m.name}</div></div>
              <div style={{fontSize:22,fontWeight:700,color:barColor,fontFamily:fm}}>{m.score}</div></div>
            {/* Score bar */}
            <div style={{height:6,borderRadius:3,background:K.bdr,marginBottom:8,overflow:"hidden"}}>
              <div style={{height:"100%",width:m.score*10+"%",borderRadius:3,background:barColor,transition:"width .3s"}}/></div>
            <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:2}}>{m.value}</div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:6}}>{m.detail}</div>
            {/* Mini sparkline */}
            {m.trend&&m.trend.length>=2&&<div style={{display:"flex",alignItems:"flex-end",gap:2,height:24,marginTop:4}}>
              {m.trend.map(function(v,ti){var mx=Math.max.apply(null,m.trend);var mn=Math.min.apply(null,m.trend);var range=mx-mn||1;var h=Math.max(3,((v-mn)/range)*22);
                return<div key={ti} style={{flex:1,height:h,borderRadius:2,background:barColor+"60"}}/>})}</div>}
            <div style={{fontSize:10,color:K.dim,lineHeight:1.4,marginTop:8,fontStyle:"italic"}}>{m.desc}</div></div>})}</div>
      {/* Munger quote */}
      <div style={{marginTop:24,padding:"16px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:12}}>
        <div style={{fontSize:12,color:K.mid,lineHeight:1.7,fontStyle:"italic"}}>{"\u201C"}The key to investing is not assessing how much an industry is going to affect society, or how much it will grow, but rather determining the competitive advantage of any given company and, above all, the durability of that advantage.{"\u201D"}</div>
        <div style={{fontSize:11,color:K.dim,marginTop:6,fontFamily:fm}}>{"\u2014"} Warren Buffett (Munger's partner)</div></div>
      </div>}</div>}

  // ── Financial Statements — Full Page (Morningstar-style) ──
  var IS_ITEMS=[{k:"revenue",l:"Revenue",b:1},{k:"costOfRevenue",l:"Cost of Revenue"},{k:"grossProfit",l:"Gross Profit",b:1},{k:"grossProfitRatio",l:"Gross Margin",p:1,d:1},{},{k:"researchAndDevelopmentExpenses",l:"R&D Expenses"},{k:"sellingGeneralAndAdministrativeExpenses",l:"SG&A Expenses"},{k:"operatingExpenses",l:"Total Operating Expenses"},{k:"operatingIncome",l:"Operating Income",b:1},{k:"operatingIncomeRatio",l:"Operating Margin",p:1,d:1},{},{k:"interestExpense",l:"Interest Expense"},{k:"totalOtherIncomeExpensesNet",l:"Other Income / Expense"},{k:"incomeBeforeTax",l:"Income Before Tax"},{k:"incomeTaxExpense",l:"Income Tax Expense"},{k:"netIncome",l:"Net Income",b:1},{k:"netIncomeRatio",l:"Net Margin",p:1,d:1},{},{k:"eps",l:"EPS (Basic)",b:1,sm:1},{k:"epsdiluted",l:"EPS (Diluted)",b:1,sm:1},{k:"weightedAverageShsOut",l:"Shares Outstanding"},{k:"weightedAverageShsOutDil",l:"Diluted Shares"},{k:"ebitda",l:"EBITDA",b:1},{k:"depreciationAndAmortization",l:"D&A"}];
  var BS_ITEMS=[{k:"cashAndCashEquivalents",l:"Cash & Equivalents"},{k:"shortTermInvestments",l:"Short-term Investments"},{k:"netReceivables",l:"Receivables"},{k:"inventory",l:"Inventory"},{k:"totalCurrentAssets",l:"Total Current Assets",b:1},{},{k:"propertyPlantEquipmentNet",l:"PP&E (Net)"},{k:"goodwillAndIntangibleAssets",l:"Goodwill & Intangibles"},{k:"longTermInvestments",l:"Long-term Investments"},{k:"totalNonCurrentAssets",l:"Total Non-Current Assets"},{k:"totalAssets",l:"Total Assets",b:1},{},{k:"accountPayables",l:"Accounts Payable"},{k:"shortTermDebt",l:"Short-term Debt"},{k:"totalCurrentLiabilities",l:"Total Current Liabilities",b:1},{k:"longTermDebt",l:"Long-term Debt"},{k:"totalNonCurrentLiabilities",l:"Total Non-Current Liabilities"},{k:"totalLiabilities",l:"Total Liabilities",b:1},{},{k:"retainedEarnings",l:"Retained Earnings"},{k:"totalStockholdersEquity",l:"Stockholders' Equity",b:1},{},{k:"totalDebt",l:"Total Debt"},{k:"netDebt",l:"Net Debt"}];
  var CF_ITEMS=[{k:"netIncome",l:"Net Income"},{k:"depreciationAndAmortization",l:"D&A"},{k:"stockBasedCompensation",l:"Stock-Based Compensation"},{k:"changeInWorkingCapital",l:"Changes in Working Capital"},{k:"operatingCashFlow",l:"Operating Cash Flow",b:1},{},{k:"capitalExpenditure",l:"Capital Expenditures"},{k:"acquisitionsNet",l:"Acquisitions"},{k:"purchasesOfInvestments",l:"Purchases of Investments"},{k:"salesMaturitiesOfInvestments",l:"Sales of Investments"},{k:"netCashUsedForInvestingActivites",l:"Investing Cash Flow",b:1},{},{k:"debtRepayment",l:"Debt Repayment"},{k:"commonStockRepurchased",l:"Share Buybacks"},{k:"dividendsPaid",l:"Dividends Paid"},{k:"netCashUsedProvidedByFinancingActivities",l:"Financing Cash Flow",b:1},{},{k:"freeCashFlow",l:"Free Cash Flow",b:1}];
  var STMT_TABS=[{id:"income",l:"Income Statement",items:IS_ITEMS},{id:"balance",l:"Balance Sheet",items:BS_ITEMS},{id:"cashflow",l:"Cash Flow",items:CF_ITEMS}];
  function fmtBig(v,pct){if(v==null||isNaN(v))return"\u2014";if(pct)return(v*100).toFixed(1)+"%";
    var neg=v<0;var a=Math.abs(v);var s;if(a>=1e12)s=(a/1e12).toFixed(1)+"T";else if(a>=1e9)s=(a/1e9).toFixed(2)+"B";else if(a>=1e6)s=(a/1e6).toFixed(1)+"M";else if(a>=1e3)s=(a/1e3).toFixed(1)+"K";else s=Math.abs(v)<100?v.toFixed(2):a.toFixed(0);return(neg?"-":"")+"$"+s}
  function fmtCell(v,item){if(v==null||v===undefined)return"\u2014";var n=Number(v);if(isNaN(n))return"\u2014";if(item.p)return(n*100).toFixed(1)+"%";if(item.sm)return"$"+n.toFixed(2);return fmtBig(n)}
  function FinancialsPage(p){var c=p.company;
    var _data=useState(null),data=_data[0],setData=_data[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    var _per=useState("annual"),per=_per[0],setPer=_per[1];
    var _tab=useState("income"),tab=_tab[0],setTab=_tab[1];
    var _chart=useState("revenue"),chart=_chart[0],setChart=_chart[1];
    var _hov=useState(null),hov=_hov[0],setHov=_hov[1];
    var _diag=useState(""),diag=_diag[0],setDiag=_diag[1];
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
    var cDef=chartItems.find(function(ci){return ci.k===chart})||chartItems[0];
    // Build chart points from whichever statement has the data
    var allRows=[].concat(data?data.income:[],data?data.balance:[],data?data.cashflow:[]);
    var dateMap={};rows.forEach(function(r){dateMap[r.date]=r});
    // For chart, find data across all statements
    var chartRows=rows.map(function(r){var v=r[cDef.k];if(v==null&&data){var inc=(data.income||[]).find(function(x){return x.date===r.date});var bal=(data.balance||[]).find(function(x){return x.date===r.date});var cf=(data.cashflow||[]).find(function(x){return x.date===r.date});if(inc&&inc[cDef.k]!=null)v=inc[cDef.k];else if(bal&&bal[cDef.k]!=null)v=bal[cDef.k];else if(cf&&cf[cDef.k]!=null)v=cf[cDef.k]}return{date:r.date,period:r.period||"FY",val:v!=null?Number(v):null}}).filter(function(pt){return pt.val!=null});
    var vals=chartRows.map(function(pt){return pt.val});var mx=Math.max.apply(null,vals.concat([0]));var mn=Math.min.apply(null,vals.concat([0]));var range=mx-mn||1;var hasNeg=mn<0;
    var cW=Math.max(500,chartRows.length*52);var cH=160;var zeroY=hasNeg?10+(mx/range)*140:150;var barW=Math.min(36,Math.max(14,(cW-40)/Math.max(chartRows.length,1)-6));
    return<div style={{padding:"0 32px 60px",maxWidth:1100}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"24px 0 12px"}}>
        <button onClick={function(){setSubPage(null)}} style={{background:"none",border:"none",color:K.acc,fontSize:13,cursor:"pointer",fontFamily:fm,padding:0}}>{"\u2190"} Back</button>
        <CoLogo domain={c.domain} ticker={c.ticker} size={32}/>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker} <span style={{fontWeight:300,color:K.mid,fontSize:15}}>Financial Statements</span></div>
          <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.name} · {c.sector}{data&&data.source?<span style={{marginLeft:8,fontSize:9,padding:"2px 6px",borderRadius:3,background:data.source==="sec-edgar"?K.grn+"15":K.acc+"15",color:data.source==="sec-edgar"?K.grn:K.acc}}>{"Source: "+(data.source==="sec-edgar"?"SEC EDGAR":"FMP")}</span>:""}</div></div>
        <div style={{display:"flex",gap:4}}>{["annual","quarter"].map(function(v){return<button key={v} onClick={function(){setPer(v)}} style={{padding:"6px 16px",fontSize:11,fontFamily:fm,fontWeight:per===v?600:400,background:per===v?K.acc+"20":"transparent",color:per===v?K.acc:K.dim,border:"1px solid "+(per===v?K.acc+"40":K.bdr),borderRadius:6,cursor:"pointer"}}>{v==="annual"?"Annual":"Quarterly"}</button>})}</div></div>
      {/* Statement Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid "+K.bdr}}>
        {STMT_TABS.map(function(t){return<button key={t.id} onClick={function(){setTab(t.id)}} style={{padding:"10px 20px",fontSize:12,fontFamily:fm,fontWeight:tab===t.id?600:400,color:tab===t.id?K.acc:K.dim,background:"transparent",border:"none",borderBottom:tab===t.id?"2px solid "+K.acc:"2px solid transparent",cursor:"pointer",marginBottom:-1}}>{t.l}</button>})}</div>
      {ld?<div style={{padding:"32px 0"}}><div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:24}}>
        {[0,1,2,3,4,5].map(function(i){return<div key={i} style={{display:"flex",gap:12,marginBottom:12}}>
          <div className="ta-skel" style={{height:12,flex:1,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/></div>})}</div>
        <div style={{textAlign:"center",fontSize:11,color:K.dim,marginTop:16,fontFamily:fm}}>Loading {c.ticker} financial data from SEC EDGAR...</div></div>:
      rows.length===0?<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>No {stab.l.toLowerCase()} data available for {c.ticker}</div><div style={{fontSize:11,color:K.dim,lineHeight:1.8,maxWidth:500,margin:"0 auto"}}>Data is fetched from SEC EDGAR (free). This company may not have XBRL filings, or the data may use non-standard XBRL tags.<br/>
        {diag&&<div style={{marginTop:8,padding:"8px 12px",background:K.red+"10",border:"1px solid "+K.red+"20",borderRadius:6,color:K.amb,fontSize:10,fontFamily:fm,textAlign:"left"}}>{diag}</div>}
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
        <button onClick={function(){setLd(true);setDiag("");delete _fincache[c.ticker+"-"+(per||"annual")];fetchFinancialStatements(c.ticker,per==="quarter"?"quarter":"annual").then(function(r){setData(r);setLd(false);var ic=(r&&r.income?r.income.length:0);if(ic===0)setDiag("Still 0 rows. Check browser console for details.")}).catch(function(e){setLd(false);setDiag("Error: "+e.message)})}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",color:K.acc,padding:"6px 14px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:fm}}>Retry</button></div></div></div>:
      <div>
      {/* Chart section */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>
          {chartItems.map(function(ci){return<button key={ci.k} onClick={function(){setChart(ci.k)}} style={{padding:"3px 10px",fontSize:10,fontFamily:fm,background:chart===ci.k?K.acc+"18":"transparent",color:chart===ci.k?K.acc:K.dim,border:"1px solid "+(chart===ci.k?K.acc+"30":"transparent"),borderRadius:5,cursor:"pointer",whiteSpace:"nowrap"}}>{ci.l}</button>})}</div>
        {chartRows.length>0?<div style={{overflowX:"auto"}}><svg width={cW} height={cH} style={{display:"block"}}>
          <line x1={0} y1={zeroY} x2={cW} y2={zeroY} stroke={K.bdr} strokeWidth={1} strokeDasharray={hasNeg?"4,3":"0"}/>
          {chartRows.map(function(pt,i){var x=20+i*((cW-40)/chartRows.length);var val=pt.val;var barH=Math.abs(val)/range*140;var y=val>=0?zeroY-barH:zeroY;var isHov=hov===i;var col=val>=0?K.acc:K.red;
            var prev=i>0?chartRows[i-1].val:null;var yoy=prev&&prev!==0?((val-prev)/Math.abs(prev)*100):null;
            return<g key={i} onMouseEnter={function(){setHov(i)}} onMouseLeave={function(){setHov(null)}} style={{cursor:"pointer"}}>
              <rect x={x} y={y} width={barW} height={Math.max(barH,2)} rx={3} fill={isHov?col:col+"80"}/>
              {isHov&&<text x={x+barW/2} y={val>=0?y-6:y+barH+14} textAnchor="middle" fill={K.txt} fontSize={10} fontFamily="JetBrains Mono" fontWeight={600}>{cDef.p?(val*100).toFixed(1)+"%":fmtBig(val)}</text>}
              {isHov&&yoy!=null&&<text x={x+barW/2} y={val>=0?y-18:y+barH+26} textAnchor="middle" fill={yoy>=0?K.grn:K.red} fontSize={9} fontFamily="JetBrains Mono">{yoy>=0?"+":""}{yoy.toFixed(1)}%</text>}
              <text x={x+barW/2} y={cH-2} textAnchor="middle" fill={K.dim} fontSize={per==="quarter"?7:9} fontFamily="JetBrains Mono">{per==="quarter"?(pt.period+" '"+pt.date.substring(2,4)):pt.date.substring(0,4)}</text>
            </g>})}</svg></div>:<div style={{padding:20,textAlign:"center",fontSize:11,color:K.dim}}>No chart data for {cDef.l}</div>}
      </div>
      {/* Full data table */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:fm}}>
          <thead><tr><th style={{position:"sticky",left:0,background:K.card,padding:"10px 14px",textAlign:"left",color:K.dim,borderBottom:"2px solid "+K.bdr,fontWeight:500,minWidth:200,zIndex:2}}>
            {stab.l} ({per==="quarter"?"Quarterly":"Annual"})</th>
            {rows.map(function(r,i){return<th key={i} style={{padding:"10px 12px",textAlign:"right",color:K.dim,borderBottom:"2px solid "+K.bdr,fontWeight:500,whiteSpace:"nowrap",minWidth:90}}>{per==="quarter"?(r.period||"")+" '"+(r.date||"").substring(2,4):(r.date||"").substring(0,4)}</th>})}</tr></thead>
          <tbody>{stab.items.map(function(item,ri){
            if(!item.k)return<tr key={ri}><td colSpan={rows.length+1} style={{height:8,background:K.bg}}></td></tr>;
            return<tr key={ri} style={{background:item.b?K.acc+"06":"transparent"}}>
              <td style={{position:"sticky",left:0,background:item.b?K.acc+"08":K.card,padding:"7px 14px",color:item.d?K.dim:item.b?K.txt:K.mid,fontWeight:item.b?600:400,borderBottom:"1px solid "+K.bdr,fontSize:item.b?11:10.5,zIndex:1}}>{item.l}</td>
              {rows.map(function(r,ci){var v=r[item.k];var yoy=null;if(ci>0&&rows[ci-1]){var prev=rows[ci-1][item.k];if(prev&&v&&!item.p)yoy=((Number(v)-Number(prev))/Math.abs(Number(prev))*100)}
                return<td key={ci} style={{padding:"7px 12px",textAlign:"right",color:v!=null&&Number(v)<0?K.red:item.d?K.dim:item.b?K.txt:K.mid,fontWeight:item.b?600:400,borderBottom:"1px solid "+K.bdr,whiteSpace:"nowrap",fontSize:item.b?11:10.5}}>
                  <div>{fmtCell(v,item)}</div>
                  {yoy!=null&&!isNaN(yoy)&&<div style={{fontSize:9,color:yoy>=0?K.grn:K.red,marginTop:1}}>{yoy>=0?"+":""}{yoy.toFixed(1)}%</div>}
                </td>})}</tr>})}</tbody>
        </table></div></div>
      <div style={{fontSize:10,color:K.dim,marginTop:12,padding:"0 4px"}}>Source: Financial Modeling Prep (SEC filings) · {per==="annual"?"Annual":"Quarterly"} data · {rows.length} periods</div>
      </div>}
    </div>}
  function DetailView(){if(!sel)return null;var c=sel;var h=gH(c.kpis);var cs=checkSt[c.id];var pos=c.position||{};var conv=c.conviction||0;
    var TABS=[{id:"overview",label:"Overview",icon:"overview"},{id:"analysis",label:"Analysis",icon:"analysis"},{id:"journal",label:"Journal",icon:"journal"}];
    return<div style={{padding:"0 32px 60px",maxWidth:900}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"28px 0 16px"}}><CoLogo domain={c.domain} ticker={c.ticker} size={36}/>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker}<span style={{fontWeight:300,color:K.mid,marginLeft:8,fontSize:16}}>{c.name}</span></div>
          <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}><span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.sector}</span><span style={{fontSize:11,color:K.dim}}>{"\u2022"}</span><span style={{fontSize:11,color:dU(c.earningsDate)<=7&&dU(c.earningsDate)>=0?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"Earnings: TBD":"Earnings: "+fD(c.earningsDate)+" "+c.earningsTime}</span>
            <span style={{fontSize:11,color:K.dim}}>{"\u2022"}</span><button onClick={function(){var next=c.status==="portfolio"?"watchlist":c.status==="watchlist"?"toohard":"portfolio";upd(c.id,{status:next})}} style={{background:(c.status||"portfolio")==="portfolio"?K.grn+"15":c.status==="toohard"?K.red+"15":K.amb+"15",border:"1px solid "+((c.status||"portfolio")==="portfolio"?K.grn+"40":c.status==="toohard"?K.red+"40":K.amb+"40"),borderRadius:4,padding:"1px 8px",fontSize:10,color:(c.status||"portfolio")==="portfolio"?K.grn:c.status==="toohard"?K.red:K.amb,cursor:"pointer",fontFamily:fm,fontWeight:600}}>{(c.status||"portfolio")==="portfolio"?"Portfolio":c.status==="toohard"?"Too Hard":"Watchlist"}</button></div></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{c.irUrl&&<a href={c.irUrl} target="_blank" rel="noopener noreferrer" style={Object.assign({},S.btn,{display:"inline-flex",alignItems:"center",gap:5,textDecoration:"none",padding:"5px 12px",fontSize:11})}>IR{"\u2197"}</a>}
          <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"edit"})}}>Settings</button>
          <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){exportPDF()}}>PDF</button>
          <button style={Object.assign({},S.btnD,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"del"})}}>Remove</button></div></div>
      {/* Tab Navigation */}
      <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:"1px solid "+K.bdr}}>
        {TABS.map(function(t){var active=detailTab===t.id;return<button key={t.id} className="ta-tab" onClick={function(){setDetailTab(t.id)}} style={{background:"none",border:"none",borderBottom:active?"2px solid "+K.acc:"2px solid transparent",color:active?K.txt:K.dim,padding:"12px 20px",fontSize:12,fontFamily:fb,fontWeight:active?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}><IC name={t.icon} size={14} color={active?K.acc:K.dim}/>{t.label}</button>})}</div>
      {/* ═══ OVERVIEW TAB ═══ */}
      {detailTab==="overview"&&<div className="ta-fade">
        {/* Position + Conviction */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",cursor:"pointer"}} onClick={function(){setModal({type:"position"})}}>
            <div style={S.sec}>Position</div>
            {pos.shares>0?<div style={{display:"flex",gap:16}}>
              <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>SHARES</div><div style={{fontSize:16,fontWeight:600,color:K.txt,fontFamily:fm}}>{pos.shares}</div></div>
              <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>AVG COST</div><div style={{fontSize:16,fontWeight:600,color:K.txt,fontFamily:fm}}>${pos.avgCost}</div></div>
              {pos.currentPrice>0&&<div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>RETURN</div><div style={{fontSize:16,fontWeight:600,color:((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?K.grn:K.red,fontFamily:fm}}>{((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)}%</div></div>}
            </div>:<div style={{fontSize:12,color:K.dim}}>Click to add position</div>}</div>
          <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",cursor:"pointer"}} onClick={function(){setModal({type:"conviction"})}}>
            <div style={S.sec}>Conviction</div>
            {conv>0?<div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:28,fontWeight:700,color:conv>=8?K.grn:conv>=5?K.amb:K.red,fontFamily:fm}}>{conv}</div>
              <div style={{flex:1}}><div style={{height:6,borderRadius:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:conv*10+"%",borderRadius:3,background:conv>=8?K.grn:conv>=5?K.amb:K.red}}/></div>
                {c.convictionHistory&&c.convictionHistory.length>1&&<div style={{fontSize:10,color:K.dim,marginTop:4}}>{c.convictionHistory.length} updates</div>}</div>
            </div>:<div style={{fontSize:12,color:K.dim}}>Click to rate conviction</div>}</div></div>
        {/* Thesis */}
        {c.thesisNote?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:20}}><div style={S.sec}>Investment Thesis</div><div style={{fontSize:13,color:K.mid,lineHeight:1.6,cursor:"pointer"}} onClick={function(){setModal({type:"thesis"})}}>{c.thesisNote}</div></div>
          :<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:"18px 20px",marginBottom:20,cursor:"pointer",textAlign:"center"}} onClick={function(){setModal({type:"thesis"})}}><div style={{fontSize:12,color:K.dim}}>Click to write your investment thesis</div></div>}
        {/* Earnings */}
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          <button style={Object.assign({},S.btnP,{padding:"7px 16px",fontSize:11})} onClick={function(){setModal({type:"manualEarnings"})}}>Enter Earnings</button>
          <button style={Object.assign({},S.btnChk,{padding:"7px 16px",fontSize:11,opacity:cs==="checking"?.6:1})} onClick={function(){checkOne(c.id)}} disabled={cs==="checking"}>{cs==="checking"?"Checking\u2026":cs==="found"?"\u2713 Found":cs==="not-yet"?"Not Yet":cs==="error"?"\u2718 Error":"Check Earnings"}</button></div>
        <EarningsReportCard company={c}/>
        <EarningsTimeline company={c}/>
        {/* KPIs */}
        <div style={{marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}>Key Metrics</div><button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"kpi"})}}>+ Add</button></div>
          {c.kpis.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:24,textAlign:"center",fontSize:12,color:K.dim}}>No metrics yet. Track what matters.</div>}
          {c.kpis.map(function(k){return<div key={k.id} className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:8,cursor:"pointer"}} onClick={function(){setExpKpi(expKpi===k.id?null:k.id)}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><div style={S.dot(k.lastResult?k.lastResult.status:null)}/>
              <div style={{flex:1}}><div style={{fontSize:13,color:K.txt,fontWeight:500}}>{k.name}</div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{k.target}{k.period?" \u2022 "+k.period:""}</div></div>
              {k.lastResult&&<div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:600,color:k.lastResult.status==="met"?K.grn:K.red,fontFamily:fm}}>{k.lastResult.actual}{k.unit||""}</div><div style={{fontSize:10,color:k.lastResult.status==="met"?K.grn:K.red,fontFamily:fm}}>{k.lastResult.status.toUpperCase()}</div></div>}
              {!k.lastResult&&<span style={{fontSize:11,color:K.dim}}>Pending</span>}</div>
            {expKpi===k.id&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid "+K.bdr,display:"flex",gap:8}}>
              <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:10})} onClick={function(e){e.stopPropagation();setModal({type:"result",data:k.id})}}>Enter Result</button>
              <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:10})} onClick={function(e){e.stopPropagation();setModal({type:"kpi",data:k.id})}}>Edit</button>
              {k.lastResult&&k.lastResult.excerpt&&<div style={{flex:1,fontSize:11,color:K.dim,fontStyle:"italic",paddingLeft:8}}>"{k.lastResult.excerpt}"</div>}</div>}</div>})}</div>
      </div>}
      {/* ═══ ANALYSIS TAB ═══ */}
      {detailTab==="analysis"&&<div className="ta-fade">
        {/* Moat Tracker link */}
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:12,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={function(){setSubPage("moat")}}>
          <div><div style={S.sec}><IC name="moat" size={14} color={K.dim}/>Moat Durability</div><div style={{fontSize:12,color:K.mid}}>Competitive advantage scoring — margin stability, ROIC, FCF quality, financial fortress</div></div>
          <span style={{fontSize:18,color:K.acc}}>{"\u2192"}</span></div>
        {/* Financials link */}
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:20,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={function(){setSubPage("financials")}}>
          <div><div style={S.sec}><IC name="chart" size={14} color={K.dim}/>Financial Statements</div><div style={{fontSize:12,color:K.mid}}>Income statement, balance sheet & cash flow — interactive charts and full data tables</div></div>
          <span style={{fontSize:18,color:K.acc}}>{"\u2192"}</span></div>
        {/* Analyst & Insider */}
        {dashSet.showAnalyst&&<AnalystInsiders company={c}/>}
        {/* SEC Filings */}
        <SECFilings company={c}/>
        {/* Thesis Scorecard */}
        <ThesisScorecard company={c}/>
        {/* Attribution */}
        <div style={{padding:"16px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:12,marginTop:8}}><div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>{"\u2139\uFE0F"} Powered by <a href="https://data.sec.gov" target="_blank" rel="noopener noreferrer" style={{color:K.blue,textDecoration:"none"}}>SEC EDGAR</a> + <a href="https://site.financialmodelingprep.com" target="_blank" rel="noopener noreferrer" style={{color:K.blue,textDecoration:"none"}}>FMP</a> + <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" style={{color:K.blue,textDecoration:"none"}}>Finnhub</a></div></div>
      </div>}
      {/* ═══ JOURNAL TAB ═══ */}
      {detailTab==="journal"&&<div className="ta-fade">
        {/* Conviction History */}
        {c.convictionHistory&&c.convictionHistory.length>1&&<div style={{marginBottom:28}}>
          <div style={S.sec}>Conviction History</div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px"}}>
            <div style={{display:"flex",alignItems:"flex-end",gap:2,height:60,marginBottom:8}}>
              {c.convictionHistory.map(function(ch,i){var pct=ch.rating*10;return<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{fontSize:9,fontWeight:600,color:ch.rating>=8?K.grn:ch.rating>=5?K.amb:K.red,fontFamily:fm}}>{ch.rating}</div>
                <div style={{width:"100%",maxWidth:24,height:pct+"%",minHeight:3,borderRadius:3,background:ch.rating>=8?K.grn:ch.rating>=5?K.amb:K.red}}/></div>})}
            </div>
            <div style={{display:"flex",gap:2}}>
              {c.convictionHistory.map(function(ch,i){return<div key={i} style={{flex:1,textAlign:"center",fontSize:8,color:K.dim,fontFamily:fm}}>{ch.date.substring(5)}</div>})}
            </div>
            {c.convictionHistory.length>0&&<div style={{marginTop:10,fontSize:11,color:K.dim}}>Latest: {c.convictionHistory[c.convictionHistory.length-1].note||"No note"}</div>}
            {c.convictionHistory.length>0&&c.convictionHistory[c.convictionHistory.length-1].biasFlags&&c.convictionHistory[c.convictionHistory.length-1].biasFlags.length>0&&<div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>{c.convictionHistory[c.convictionHistory.length-1].biasFlags.map(function(b,bi){return<span key={bi} style={{fontSize:9,color:K.amb,background:K.amb+"12",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>{"\u26A0"} {b}</span>})}</div>}
          </div></div>}
        {/* Decision Journal */}
        <DecisionJournal company={c}/>
        {/* Research Links */}
        <ResearchLinks company={c}/>
        {/* Thesis Vault (docs) */}
        <ThesisVault company={c}/>
        {/* Empty state for Journal */}
        {(!c.convictionHistory||c.convictionHistory.length<=1)&&(!c.decisions||c.decisions.length===0)&&(!c.researchLinks||c.researchLinks.length===0)&&(!c.docs||c.docs.length===0)&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:"40px 20px",textAlign:"center"}}>
          <div style={{marginBottom:8}}><IC name="journal" size={24} color={K.dim}/></div>
          <div style={{fontSize:13,color:K.dim,marginBottom:4}}>Your investment journal is empty</div>
          <div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>Record decisions, save research links, write thesis documents, and track conviction changes over time. This becomes your most valuable asset.</div></div>}
      </div>}
    </div>}
  // ── Owner's Hub ─────────────────────────────────────────
  function OwnersHub(){
    // Gather all docs from all companies
    var allDocs=[];cos.forEach(function(c){(c.docs||[]).forEach(function(d){allDocs.push(Object.assign({},d,{ticker:c.ticker,companyName:c.name,companyId:c.id,domain:c.domain}))})});
    // Also gather thesis notes as virtual docs
    cos.forEach(function(c){if(c.thesisNote){allDocs.push({id:"thesis-"+c.id,title:"Investment Thesis",content:c.thesisNote,folder:"why-i-own",ticker:c.ticker,companyName:c.name,companyId:c.id,domain:c.domain,updatedAt:null,isThesis:true})}});
    allDocs.sort(function(a,b){return(b.updatedAt||"")<(a.updatedAt||"")?-1:1});
    var _hf=useState("all"),hf=_hf[0],setHf=_hf[1];
    var _hc=useState("all"),hc=_hc[0],setHc=_hc[1];
    var _hd=useState(null),hd=_hd[0],setHd=_hd[1];
    var companies=cos.map(function(c){return{ticker:c.ticker,id:c.id}});
    var filtered=allDocs.filter(function(d){return(hf==="all"||d.folder===hf)&&(hc==="all"||d.companyId===parseInt(hc))});
    var selectedDoc=hd?allDocs.find(function(d){return d.id===hd}):null;
    function exportDocPDF(doc){
      var formatted=autoFormat(doc.content);
      var html='<!DOCTYPE html><html><head><title>'+doc.ticker+' \u2014 '+doc.title+'</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;color:#1a1a1a;padding:48px;max-width:700px;margin:0 auto;line-height:1.8}h1{font-size:22px;margin-bottom:4px}h2{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#888;margin-bottom:24px}p{margin-bottom:16px;font-size:14px}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#aaa}@media print{body{padding:24px}}</style></head><body>';
      html+='<h1>'+doc.ticker+' \u2014 '+doc.title+'</h1>';
      html+='<h2>'+doc.companyName+(doc.updatedAt?' \u2022 '+new Date(doc.updatedAt).toLocaleDateString():'')+'</h2>';
      formatted.split("\n\n").forEach(function(p){html+='<p>'+p+'</p>'});
      html+='<div class="footer">ThesisAlpha \u2022 Owner\'s Hub</div></body></html>';
      var w=window.open("","_blank");w.document.write(html);w.document.close();w.print()}
    return<div style={{padding:"0 32px 60px",maxWidth:1000}}>
      <div style={{padding:"28px 0 20px"}}><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>Owner's Hub</h1><p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{allDocs.length} documents across {companies.length} companies</p></div>
      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <select value={hc} onChange={function(e){setHc(e.target.value);setHd(null)}} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"7px 12px",fontSize:11,fontFamily:fm,outline:"none"}}>
          <option value="all">All Companies</option>
          {companies.map(function(c){return<option key={c.id} value={c.id}>{c.ticker}</option>})}</select>
        <button onClick={function(){setHf("all");setHd(null)}} style={{background:hf==="all"?K.acc+"20":"transparent",border:"1px solid "+(hf==="all"?K.acc+"50":K.bdr),borderRadius:6,padding:"6px 14px",fontSize:11,color:hf==="all"?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>All</button>
        {FOLDERS.map(function(fo){var ct=allDocs.filter(function(d){return d.folder===fo.id&&(hc==="all"||d.companyId===parseInt(hc))}).length;
          return<button key={fo.id} onClick={function(){setHf(fo.id);setHd(null)}} style={{background:hf===fo.id?K.acc+"20":"transparent",border:"1px solid "+(hf===fo.id?K.acc+"50":K.bdr),borderRadius:6,padding:"6px 14px",fontSize:11,color:hf===fo.id?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>{fo.icon} {fo.label}{ct>0?" ("+ct+")":""}</button>})}</div>
      <div style={{display:"grid",gridTemplateColumns:selectedDoc?"340px 1fr":"1fr",gap:20}}>
        {/* Doc list */}
        <div>
          {filtered.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:32,textAlign:"center"}}><div style={{fontSize:13,color:K.dim,marginBottom:8}}>No documents yet</div><div style={{fontSize:12,color:K.dim}}>Add notes in company pages and they'll appear here.</div></div>}
          {filtered.map(function(d){var fo=FOLDERS.find(function(f){return f.id===d.folder});var isActive=hd===d.id;
            return<div key={d.id} style={{background:isActive?K.acc+"08":K.card,border:"1px solid "+(isActive?K.acc+"30":K.bdr),borderRadius:12,padding:"14px 18px",marginBottom:8,cursor:"pointer",transition:"all .15s"}} onClick={function(){setHd(isActive?null:d.id)}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <CoLogo domain={d.domain} ticker={d.ticker} size={18}/>
                <span style={{fontSize:10,fontWeight:600,color:K.mid,fontFamily:fm}}>{d.ticker}</span>
                <span style={{fontSize:10,color:K.dim}}>{fo?fo.icon:""}</span>
                <span style={{flex:1}}/>
                <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{d.updatedAt?new Date(d.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>
              <div style={{fontSize:13,fontWeight:500,color:K.txt}}>{d.title}</div>
              {!selectedDoc&&d.content&&<div style={{fontSize:12,color:K.dim,lineHeight:1.5,marginTop:4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{d.content.substring(0,200)}</div>}
            </div>})}</div>
        {/* Doc detail / reader */}
        {selectedDoc&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"24px 28px",position:"sticky",top:80,maxHeight:"calc(100vh - 120px)",overflowY:"auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <CoLogo domain={selectedDoc.domain} ticker={selectedDoc.ticker} size={22}/>
            <div style={{flex:1}}><div style={{fontSize:15,fontWeight:500,color:K.txt}}>{selectedDoc.title}</div>
              <div style={{fontSize:11,color:K.dim}}>{selectedDoc.companyName}{selectedDoc.updatedAt?" \u2022 "+new Date(selectedDoc.updatedAt).toLocaleDateString():""}</div></div>
            <button onClick={function(){exportDocPDF(selectedDoc)}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:10})}>PDF</button>
            {!selectedDoc.isThesis&&<button onClick={function(){setSelId(selectedDoc.companyId);setPage("dashboard");setModal({type:"doc",data:selectedDoc.id})}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:10})}>Edit</button>}
          </div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{autoFormat(selectedDoc.content)}</div>
        </div>}
      </div></div>}

  // ── Portfolio Analytics ─────────────────────────────────
  // ── Portfolio Analytics (Munger-focused) ─────────────────
  function PortfolioAnalytics(){
    var portCos=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
    var _moats=useState({}),moats=_moats[0],setMoats=_moats[1];
    var _ldM=useState(true),ldM=_ldM[0],setLdM=_ldM[1];
    var _prog=useState(0),prog=_prog[0],setProg=_prog[1];
    useEffect(function(){if(portCos.length===0){setLdM(false);return}
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
    var dimAvgs={};dimIds.forEach(function(d){var scores=withMoat.map(function(x){return x.dims[d]?x.dims[d].score:null}).filter(function(v){return v!=null});dimAvgs[d]=scores.length>0?Math.round(scores.reduce(function(s,v){return s+v},0)/scores.length):null});

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
        pricing:x.dims.grossMargin?x.dims.grossMargin.score:null,
        roic:x.dims.roic?x.dims.roic.score:null,
        fcf:x.dims.fcfConversion?x.dims.fcfConversion.score:null}
    }).sort(function(a,b){return b.moat-a.moat});

    // Munger "wonderful at fair price" filter — flag companies with ROIC < 6 or fortress < 4
    var redFlags=withMoat.filter(function(x){
      var r=x.dims.roic?x.dims.roic.score:10;var f=x.dims.fortress?x.dims.fortress.score:10;
      return r<5||f<4});

    var secStyle={fontSize:11,letterSpacing:1,textTransform:"uppercase",color:K.dim,marginBottom:14,fontWeight:600,fontFamily:fb,display:"flex",alignItems:"center",gap:8};

    return<div style={{padding:"0 32px 60px",maxWidth:1100}}>
      <div style={{padding:"28px 0 20px"}}><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>Portfolio Analytics</h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{portCos.length} portfolio companies{ldM?" \u2022 Analyzing ("+prog+"/"+portCos.length+")":withMoat.length>0?" \u2022 "+withMoat.length+" analyzed":""}</p></div>

      {ldM?<div style={{padding:40,textAlign:"center"}}><div style={{fontSize:13,color:K.dim}}>Analyzing financial quality of {portCos.length} companies...</div>
        <div style={{height:4,borderRadius:2,background:K.bdr,maxWidth:300,margin:"16px auto"}}><div style={{height:"100%",borderRadius:2,background:K.acc,width:(portCos.length>0?prog/portCos.length*100:0)+"%",transition:"width .3s"}}/></div></div>:
      <div>
      {/* ── Munger's 4 Pillars ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:24}}>
        {[{label:"Business Quality",val:avgMoat,sub:avgMoat>0?moatLabel(avgMoat):"",icon:"shield"},
          {label:"Financial Strength",val:fortressAvg,sub:fortressAvg>=8?"Fortress":fortressAvg>=6?"Solid":fortressAvg>=4?"Adequate":"Fragile",icon:"castle"},
          {label:"Pricing Power",val:pricingAvg,sub:pricingAvg>=8?"Exceptional":pricingAvg>=6?"Strong":pricingAvg>=4?"Moderate":"Weak",icon:"dollar"},
          {label:"Capital Efficiency",val:roicAvg,sub:roicAvg>=8?"Outstanding":roicAvg>=6?"Good":roicAvg>=4?"Fair":"Poor",icon:"target"}
        ].map(function(card){var v=card.val;var clr=v>=8?K.grn:v>=6?K.acc:v>=4?K.amb:v?K.red:K.dim;
          return<div key={card.label} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><IC name={card.icon} size={14} color={K.dim}/><div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:K.dim,fontWeight:600,fontFamily:fb}}>{card.label}</div></div>
            <div style={{fontSize:28,fontWeight:700,color:clr,fontFamily:fm}}>{v||"\u2014"}<span style={{fontSize:12,fontWeight:400,color:K.dim}}>/10</span></div>
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
          if(x.dims.grossMargin&&x.dims.grossMargin.score<4)issues.push("Weak margins ("+x.dims.grossMargin.value+")");
          return<div key={x.company.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,cursor:"pointer",padding:"8px 12px",background:K.card,borderRadius:8,border:"1px solid "+K.bdr}} onClick={function(){setSelId(x.company.id);setDetailTab("analysis");setPage("dashboard")}}>
            <CoLogo domain={x.company.domain} ticker={x.company.ticker} size={24}/>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{x.company.ticker}</div>
              <div style={{fontSize:10,color:K.red,fontFamily:fb}}>{issues.join(" \u2022 ")}</div></div>
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
            return<tr key={q.id} style={{cursor:"pointer"}} onClick={function(){setSelId(q.id);setDetailTab("analysis");setPage("dashboard")}}>
              <td style={{padding:"10px 10px",fontSize:11,color:K.dim,fontFamily:fm,borderBottom:"1px solid "+K.bdr+"50"}}>{i+1}</td>
              <td style={{padding:"10px 10px",borderBottom:"1px solid "+K.bdr+"50"}}><div style={{display:"flex",alignItems:"center",gap:8}}><CoLogo domain={q.domain} ticker={q.ticker} size={20}/><span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{q.ticker}</span></div></td>
              <td style={{padding:"10px 10px",textAlign:"center",borderBottom:"1px solid "+K.bdr+"50"}}><span style={{fontSize:13,fontWeight:700,color:moatColor(q.moat),fontFamily:fm,background:moatColor(q.moat)+"15",padding:"3px 10px",borderRadius:4}}>{q.moat}</span></td>
              {[q.fortress,q.pricing,q.roic,q.fcf].map(function(v,vi){return<td key={vi} style={{padding:"10px 10px",textAlign:"center",fontSize:13,fontWeight:600,color:v?cellClr(v):K.dim,fontFamily:fm,borderBottom:"1px solid "+K.bdr+"50"}}>{v||"\u2014"}</td>})}</tr>})}</tbody></table></div></div>}

      {/* ── Munger Quote ── */}
      {withMoat.length>0&&<div style={{padding:"20px 24px",background:K.card,border:"1px solid "+K.bdr,borderRadius:12}}>
        <div style={{fontSize:13,color:K.mid,lineHeight:1.7,fontStyle:"italic",fontFamily:fh}}>{"\"Over the long term, it\u2019s hard for a stock to earn a much better return than the business which underlies it earns. If the business earns 6% on capital over 40 years and you hold it for that 40 years, you\u2019re not going to make much different than a 6% return.\""}</div>
        <div style={{fontSize:11,color:K.dim,marginTop:8,fontFamily:fb}}>{"\u2014"} Charlie Munger</div></div>}

      {portCos.length===0&&<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim}}>No portfolio companies yet. Add companies and set their status to Portfolio.</div></div>}
      </div>}</div>}


  function Dashboard(){var filtered=cos.filter(function(c){return(c.status||"portfolio")===sideTab});
    // Sector diversification
    var sectors={};filtered.forEach(function(c){var s=c.sector||"Other";sectors[s]=(sectors[s]||0)+1});
    var sectorList=Object.keys(sectors).sort(function(a,b){return sectors[b]-sectors[a]});
    // Dividend data
    var divCos=filtered.filter(function(c){return(c.divPerShare||c.lastDiv)>0&&c.divFrequency!=="none"});
    var totalAnnualDiv=divCos.reduce(function(sum,c){var pos=c.position||{};var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;return sum+(pos.shares||0)*(c.divPerShare||c.lastDiv||0)*mult},0);
    return<div style={{padding:"0 32px 60px",maxWidth:1100}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"28px 0 20px"}}><div><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>{sideTab==="portfolio"?"Portfolio":sideTab==="toohard"?"Too-Hard Pile":"Watchlist"}</h1><p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{filtered.length} companies{sideTab==="toohard"?" \u2022 Outside your circle of competence":priceLoading?" \u2022 Updating prices\u2026":""}</p></div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={toggleAutoNotify} style={{display:"flex",alignItems:"center",gap:6,background:autoNotify?K.grn+"15":"transparent",border:"1px solid "+(autoNotify?K.grn+"40":K.bdr),borderRadius:6,padding:"7px 14px",fontSize:11,color:autoNotify?K.grn:K.dim,cursor:"pointer",fontFamily:fm}} title={autoNotify?"Auto-check ON — will auto-fetch earnings when they drop":"Click to enable: auto-checks earnings when released"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={autoNotify?K.grn:"none"} stroke={autoNotify?K.grn:K.dim} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {autoNotify?"Auto-check ON":"Auto-check"}</button>
        {autoNotify&&<button onClick={toggleEmailNotify} style={{display:"flex",alignItems:"center",gap:5,background:emailNotify?K.blue+"15":"transparent",border:"1px solid "+(emailNotify?K.blue+"40":K.bdr),borderRadius:6,padding:"7px 12px",fontSize:11,color:emailNotify?K.blue:K.dim,cursor:"pointer",fontFamily:fm}} title={emailNotify?"Email notifications ON — opens mailto when earnings drop":"Click to also get email when earnings drop"}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={emailNotify?K.blue:K.dim} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
          {emailNotify?"Email ON":"+ Email"}</button>}
        <button style={S.btnChk} onClick={checkAll}>Check All</button>
        <button style={Object.assign({},S.btn,{padding:"9px 14px",fontSize:11})} onClick={function(){exportCSV(filtered)}}>CSV</button>
        <button style={Object.assign({},S.btnP,{padding:"9px 18px",fontSize:12})} onClick={function(){setModal({type:"add"})}}>+ Add</button></div></div>
    {dashSet.showSummary&&sideTab==="portfolio"&&function(){
      var held=filtered.filter(function(c){var p=c.position||{};return p.shares>0&&p.avgCost>0&&p.currentPrice>0});
      if(held.length===0)return null;
      var totalCost=held.reduce(function(s,c){return s+(c.position.shares*c.position.avgCost)},0);
      var totalValue=held.reduce(function(s,c){return s+(c.position.shares*c.position.currentPrice)},0);
      var totalReturn=totalValue-totalCost;var totalReturnPct=totalCost>0?(totalReturn/totalCost*100):0;
      var isUp=totalReturn>=0;
      var best=null,worst=null;held.forEach(function(c){var pct=(c.position.currentPrice-c.position.avgCost)/c.position.avgCost*100;if(!best||pct>best.pct)best={ticker:c.ticker,pct:pct};if(!worst||pct<worst.pct)worst={ticker:c.ticker,pct:pct}});
      return<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16,marginBottom:20}}>
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
          <div style={{fontSize:18,fontWeight:600,color:K.grn,fontFamily:fm}}>{best?best.ticker:"\u2014"}</div>
          <div style={{fontSize:11,color:K.grn,marginTop:4,fontFamily:fm}}>{best?(best.pct>=0?"+":"")+best.pct.toFixed(1)+"%":""}</div></div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
          <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:8,fontFamily:fm}}>Worst Performer</div>
          <div style={{fontSize:18,fontWeight:600,color:K.red,fontFamily:fm}}>{worst?worst.ticker:"\u2014"}</div>
          <div style={{fontSize:11,color:K.red,marginTop:4,fontFamily:fm}}>{worst?(worst.pct>=0?"+":"")+worst.pct.toFixed(1)+"%":""}</div></div>
      </div>}()}
    {/* Analytics quick link */}
    {sideTab==="portfolio"&&filtered.length>=2&&<div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",gap:16}} onClick={function(){setPage("analytics")}}>
      <IC name="bar" size={18} color={K.acc}/>
      <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>Portfolio Analytics</div><div style={{fontSize:11,color:K.dim}}>Business quality, financial strength, pricing power & capital efficiency across your holdings</div></div>
      <span style={{fontSize:16,color:K.acc}}>{"\u2192"}</span></div>}
    {sideTab==="toohard"&&<div style={{background:K.red+"08",border:"1px solid "+K.red+"20",borderRadius:12,padding:"14px 20px",marginBottom:20}}><div style={{fontSize:12,fontWeight:600,color:K.red,marginBottom:4}}>Circle of Competence</div><div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>{"\"Acknowledging what you don\u2019t know is the dawning of wisdom.\" Companies here are outside your circle \u2014 too complex, too unpredictable, or require expertise you don\u2019t have. That\u2019s not failure. That\u2019s discipline."}</div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16,marginBottom:28}}>
      {filtered.map(function(c,ci){var h=gH(c.kpis);var d=dU(c.earningsDate);var cs2=checkSt[c.id];var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;var total=c.kpis.filter(function(k){return k.lastResult}).length;var pos=c.position||{};
        return<div key={c.id} className="ta-card ta-fade" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",cursor:"pointer",position:"relative",animationDelay:Math.min(ci*40,400)+"ms"}} onClick={function(){setSelId(c.id);setDetailTab("overview")}}>
          <button onClick={function(e){e.stopPropagation();setCos(function(p){return p.filter(function(x){return x.id!==c.id})})}} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:K.dim,fontSize:14,cursor:"pointer",padding:4,opacity:.4}} title="Remove">{"\u2715"}</button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><CoLogo domain={c.domain} ticker={c.ticker} size={28}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}{dashSet.showPrices&&pos.currentPrice>0&&<span style={{fontWeight:400,color:K.dim,marginLeft:8,fontSize:12}}>${pos.currentPrice.toFixed(2)}</span>}</div><div style={{fontSize:11,color:K.dim}}>{c.name}</div></div><span style={S.badge(h.c)}>{h.l}</span></div>
          {dashSet.showPositions&&pos.shares>0&&pos.avgCost>0&&pos.currentPrice>0&&<div style={{display:"flex",gap:12,marginBottom:10,padding:"8px 10px",background:K.bg,borderRadius:6}}>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{pos.shares} shares</span>
            <span style={{fontSize:11,color:((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?K.grn:K.red,fontWeight:600,fontFamily:fm}}>{((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?"+":""}{((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)}%</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>${(pos.shares*pos.currentPrice).toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:"1px solid "+K.bdr}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:d>=0&&d<=7?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"TBD":(d<=0?"Reported":d+"d \u2014 "+fD(c.earningsDate))}</span>
              {dashSet.showBuyZone&&c.targetPrice>0&&pos.currentPrice>0&&pos.currentPrice<=c.targetPrice&&<span style={{fontSize:9,fontWeight:600,color:K.grn,background:K.grn+"15",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>BUY ZONE</span>}</div>
            <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{total>0?met+"/"+total+" met":c.kpis.length+" KPIs"}{cs2==="checking"?" \u23F3":""}</div></div></div>})}</div>
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
      <div style={{display:"grid",gridTemplateColumns:(dashSet.showSectors&&dashSet.showDividends)?"1fr 1fr":"1fr",gap:16}}>
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
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:K.mid}}>{s}</span><span style={{fontSize:11,color:warn?K.amb:K.dim,fontWeight:warn?600:400,fontFamily:fm}}>{pct}%{warn?" \u26A0":""}</span></div>
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
  return(<div style={{display:"flex",height:"100vh",background:K.bg,color:K.txt,fontFamily:fb,overflow:"hidden"}}>{renderModal()}<Sidebar/><div style={{flex:1,overflowY:"auto"}}><TopBar/><div key={contentKey} className="ta-fade">{page==="hub"?<OwnersHub/>:page==="analytics"?<PortfolioAnalytics/>:sel&&subPage==="financials"?<FinancialsPage company={sel}/>:sel&&subPage==="moat"?<MoatTracker company={sel}/>:sel?<DetailView/>:<Dashboard/>}</div></div></div>)}

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
  if(!ready)return<div style={{background:"#121217",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{width:32,height:32,border:"2px solid #2a2a3a",borderTopColor:"#818CF8",borderRadius:"50%",animation:"spin .8s linear infinite"}}/><span style={{color:"#6e6e82",fontSize:12,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1}}>ThesisAlpha</span></div>;
  if(!user)return<LoginPage onAuth={onAuth}/>;
  return<TrackerApp user={user.email||""} userId={user.id} onLogout={onLogout}/>;
}
