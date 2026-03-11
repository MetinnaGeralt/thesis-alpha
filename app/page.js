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
async function getAuthToken(){if(!supabase)return null;try{var s=await supabase.auth.getSession();return s.data.session?s.data.session.access_token:null}catch(e){return null}}
async function authFetch(url,opts){var token=await getAuthToken();var headers=Object.assign({"Content-Type":"application/json"},opts.headers||{});if(token)headers["Authorization"]="Bearer "+token;return fetch(url,Object.assign({},opts,{headers:headers}))}

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
  // Revenue & Growth
  {id:"revenue",label:"Revenue",unit:"$B",cat:"Revenue",fh:"revenue"},{id:"revGrowth",label:"Revenue Growth YoY",unit:"%",cat:"Revenue"},{id:"revPerShare",label:"Revenue Per Share",unit:"$",cat:"Revenue"},{id:"orgGrowth",label:"Organic Revenue Growth",unit:"%",cat:"Revenue"},{id:"arr",label:"Annual Recurring Revenue (ARR)",unit:"$M",cat:"Revenue"},{id:"nrr",label:"Net Revenue Retention",unit:"%",cat:"Revenue"},{id:"mrr",label:"Monthly Recurring Revenue (MRR)",unit:"$M",cat:"Revenue"},{id:"arpu",label:"ARPU",unit:"$",cat:"Revenue"},{id:"bookings",label:"Bookings / Backlog",unit:"$B",cat:"Revenue"},
  // Earnings & Profitability
  {id:"eps",label:"EPS",unit:"$",cat:"Earnings",fh:"earnings"},{id:"epsGrowth",label:"EPS Growth YoY",unit:"%",cat:"Earnings"},{id:"ebitda",label:"EBITDA",unit:"$B",cat:"Earnings"},{id:"ebitdaPerShare",label:"EBITDA / Share",unit:"$",cat:"Earnings"},{id:"ebitdaMargin",label:"EBITDA Margin",unit:"%",cat:"Earnings"},{id:"netIncome",label:"Net Income",unit:"$B",cat:"Earnings"},{id:"adjEPS",label:"Adjusted EPS",unit:"$",cat:"Earnings"},
  // Margins
  {id:"grossMargin",label:"Gross Margin",unit:"%",cat:"Margins"},{id:"opMargin",label:"Operating Margin",unit:"%",cat:"Margins"},{id:"netMargin",label:"Net Margin",unit:"%",cat:"Margins"},{id:"fcfMargin",label:"FCF Margin",unit:"%",cat:"Margins"},{id:"rndMargin",label:"R&D / Revenue",unit:"%",cat:"Margins"},{id:"sgaMargin",label:"SG&A / Revenue",unit:"%",cat:"Margins"},
  // Cash Flow
  {id:"fcf",label:"Free Cash Flow",unit:"$B",cat:"Cash Flow"},{id:"fcfPerShare",label:"FCF / Share",unit:"$",cat:"Cash Flow"},{id:"ocf",label:"Operating Cash Flow",unit:"$B",cat:"Cash Flow"},{id:"capex",label:"Capital Expenditure",unit:"$B",cat:"Cash Flow"},{id:"fcfConversion",label:"FCF Conversion",unit:"%",cat:"Cash Flow"},{id:"cashFromOps",label:"Cash from Operations",unit:"$B",cat:"Cash Flow"},
  // Returns
  {id:"roe",label:"ROE",unit:"%",cat:"Returns"},{id:"roa",label:"ROA",unit:"%",cat:"Returns"},{id:"roic",label:"ROIC",unit:"%",cat:"Returns"},{id:"roce",label:"ROCE",unit:"%",cat:"Returns"},{id:"rotce",label:"ROTCE",unit:"%",cat:"Returns"},
  // Valuation
  {id:"pe",label:"P/E Ratio",unit:"x",cat:"Valuation"},{id:"pb",label:"P/B Ratio",unit:"x",cat:"Valuation"},{id:"ps",label:"P/S Ratio",unit:"x",cat:"Valuation"},{id:"evEbitda",label:"EV/EBITDA",unit:"x",cat:"Valuation"},{id:"evRevenue",label:"EV/Revenue",unit:"x",cat:"Valuation"},{id:"evFcf",label:"EV/FCF",unit:"x",cat:"Valuation"},{id:"bvps",label:"Book Value / Share",unit:"$",cat:"Valuation"},{id:"peg",label:"PEG Ratio",unit:"x",cat:"Valuation"},
  // Health & Balance Sheet
  {id:"currentRatio",label:"Current Ratio",unit:"x",cat:"Health"},{id:"debtEquity",label:"Debt / Equity",unit:"x",cat:"Health"},{id:"netDebtEbitda",label:"Net Debt / EBITDA",unit:"x",cat:"Health"},{id:"interestCoverage",label:"Interest Coverage",unit:"x",cat:"Health"},{id:"cashOnHand",label:"Cash on Hand",unit:"$B",cat:"Health"},{id:"totalDebt",label:"Total Debt",unit:"$B",cat:"Health"},{id:"quickRatio",label:"Quick Ratio",unit:"x",cat:"Health"},
  // Income & Dividends
  {id:"divYield",label:"Dividend Yield",unit:"%",cat:"Income"},{id:"divPerShare",label:"Dividend / Share",unit:"$",cat:"Income"},{id:"payoutRatio",label:"Payout Ratio",unit:"%",cat:"Income"},{id:"divGrowth",label:"Dividend Growth YoY",unit:"%",cat:"Income"},{id:"buybackYield",label:"Buyback Yield",unit:"%",cat:"Income"},{id:"shareholderYield",label:"Shareholder Yield",unit:"%",cat:"Income"},
  // SaaS / Tech
  {id:"grossRetention",label:"Gross Retention Rate",unit:"%",cat:"SaaS"},{id:"netRetention",label:"Net Dollar Retention",unit:"%",cat:"SaaS"},{id:"cac",label:"Customer Acquisition Cost",unit:"$",cat:"SaaS"},{id:"ltv",label:"Customer LTV",unit:"$",cat:"SaaS"},{id:"ltvCac",label:"LTV/CAC Ratio",unit:"x",cat:"SaaS"},{id:"churnRate",label:"Churn Rate",unit:"%",cat:"SaaS"},{id:"ruleOf40",label:"Rule of 40",unit:"%",cat:"SaaS"},{id:"magicNumber",label:"Magic Number",unit:"x",cat:"SaaS"},
  // Users & Engagement
  {id:"mau",label:"Monthly Active Users (MAU)",unit:"M",cat:"Users"},{id:"dau",label:"Daily Active Users (DAU)",unit:"M",cat:"Users"},{id:"subscribers",label:"Subscribers",unit:"M",cat:"Users"},{id:"customers",label:"Customers",unit:"k",cat:"Users"},{id:"gmv",label:"GMV (Gross Merch Value)",unit:"$B",cat:"Users"},{id:"takeRate",label:"Take Rate",unit:"%",cat:"Users"},
  // Segment-specific
  {id:"sameStoreSales",label:"Same-Store Sales Growth",unit:"%",cat:"Retail"},{id:"storeCount",label:"Store Count",unit:"#",cat:"Retail"},{id:"revPerSqFt",label:"Revenue / Sq Ft",unit:"$",cat:"Retail"},{id:"occupancy",label:"Occupancy Rate",unit:"%",cat:"REIT"},{id:"ffo",label:"FFO / Share",unit:"$",cat:"REIT"},{id:"nim",label:"Net Interest Margin",unit:"%",cat:"Banking"},{id:"cet1",label:"CET1 Ratio",unit:"%",cat:"Banking"},{id:"combinedRatio",label:"Combined Ratio",unit:"%",cat:"Insurance"},{id:"ber",label:"Break-Even Ratio",unit:"%",cat:"Insurance"}
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
var SUPERINVESTORS=[
  {id:"berkshire",name:"Warren Buffett",fund:"Berkshire Hathaway",style:"Quality Value",desc:"Wonderful companies at fair prices. Concentrated, low turnover, moat-focused.",
    holdings:["AAPL","BAC","AXP","KO","CVX","OXY","MCO","KHC","CB","DVA","ALLY","VRSN","NU","AMZN","LLY"],
    traits:{quality:0.9,value:0.7,growth:0.2,income:0.5,concentration:0.8,turnover:0.1}},
  {id:"klarman",name:"Seth Klarman",fund:"Baupost Group",style:"Deep Value",desc:"Margin of safety obsessed. Contrarian, patient, often holds cash.",
    holdings:["LBTYA","LBTYK","QRTEA","FOXA","GOOGL","INTC","EBAY","WBD","PYPL","META","PARA","CRH","BEPC"],
    traits:{quality:0.4,value:0.95,growth:0.2,income:0.2,concentration:0.5,turnover:0.3}},
  {id:"ackman",name:"Bill Ackman",fund:"Pershing Square",style:"Activist Quality",desc:"Concentrated bets on high-quality businesses. Activist approach, pushes for value creation.",
    holdings:["GOOG","CMG","HLT","QSR","HHH","CP","LOW","NKE","UBER"],
    traits:{quality:0.8,value:0.5,growth:0.5,income:0.2,concentration:0.95,turnover:0.3}},
  {id:"smith",name:"Terry Smith",fund:"Fundsmith",style:"Quality Compounder",desc:"Buy good companies, don't overpay, do nothing. Ultra-low turnover, high ROIC focus.",
    holdings:["META","MSFT","NOVO-B","L'OREAL","IDEXX","VISA","ESTC","AMZN","MASI","WAT","POOL","FICO","PAYC","VEEV"],
    traits:{quality:0.95,value:0.3,growth:0.5,income:0.3,concentration:0.4,turnover:0.05}},
  {id:"hohn",name:"Chris Hohn",fund:"TCI Fund",style:"Activist FCF",desc:"Concentrated on free cash flow machines. Activist shareholder, pushes capital returns.",
    holdings:["GOOG","MSFT","V","MA","MCO","CPRT","GE","LHX","CSGP","SPGI","CDW"],
    traits:{quality:0.85,value:0.4,growth:0.4,income:0.3,concentration:0.8,turnover:0.15}},
  {id:"lynch",name:"Peter Lynch",fund:"Magellan Fund",style:"Growth at Reasonable Price",desc:"Know what you own. Everyday observation, PEG ratio, growth with margin of safety.",
    holdings:["COST","HD","SBUX","NKE","TJX","WMT","MCD","PG","UNH","ABBV","JNJ","PEP","AMGN","TMO"],
    traits:{quality:0.6,value:0.5,growth:0.7,income:0.4,concentration:0.2,turnover:0.4}},
  {id:"greenblatt",name:"Joel Greenblatt",fund:"Gotham Asset Mgmt",style:"Magic Formula",desc:"High ROIC + high earnings yield. Systematic, quantitative approach to value.",
    holdings:["GOOG","META","MSFT","AAPL","AMZN","BRK-B","UNH","JNJ","PG","V","MA","HD","COST"],
    traits:{quality:0.6,value:0.8,growth:0.4,income:0.2,concentration:0.3,turnover:0.5}},
  {id:"einhorn",name:"David Einhorn",fund:"Greenlight Capital",style:"Value + Shorts",desc:"Classic value investor who also shorts overvalued stocks. Contrarian, forensic accounting focus.",
    holdings:["GPRE","TECK","GTN","ODP","CNX","GEN","JACK","CC","BHF","PRDO"],
    traits:{quality:0.3,value:0.9,growth:0.2,income:0.3,concentration:0.6,turnover:0.4}},
  {id:"marks",name:"Howard Marks",fund:"Oaktree Capital",style:"Distressed/Contrarian",desc:"Second-level thinker. Buys when others panic. Focused on risk control and cycles.",
    holdings:["OC","TEL","WMB","BKNG","LYB","NRG","PVH","CZR","HCA","DAL"],
    traits:{quality:0.4,value:0.85,growth:0.2,income:0.4,concentration:0.4,turnover:0.3}},
  {id:"kantesaria",name:"Dev Kantesaria",fund:"Valley Forge Capital",style:"Quality Compounder",desc:"15%+ compounders with minimal risk of permanent loss. Ultra-concentrated, high conviction.",
    holdings:["MSFT","GOOG","V","MA","MCO","SPGI","ROP","FICO","CPRT","POOL"],
    traits:{quality:0.95,value:0.3,growth:0.5,income:0.1,concentration:0.9,turnover:0.05}},
  {id:"pabrai",name:"Mohnish Pabrai",fund:"Pabrai Investment Funds",style:"Cloner Value",desc:"Shamelessly clones the best ideas. Concentrated, high-conviction, Munger-inspired.",
    holdings:["COAL","TRMD","AMPS","JSPR","BATT","SATS","EXPE","TROW"],
    traits:{quality:0.5,value:0.8,growth:0.4,income:0.2,concentration:0.9,turnover:0.3}},
  {id:"burry",name:"Michael Burry",fund:"Scion Asset Mgmt",style:"Deep Value Contrarian",desc:"The Big Short. Extreme contrarian, forensic research, often against consensus.",
    holdings:["BABA","JD","GOOG","BKNG","ORLY","HCA","STLA","REAL"],
    traits:{quality:0.3,value:0.9,growth:0.3,income:0.1,concentration:0.7,turnover:0.7}},
  {id:"ainslie",name:"Lee Ainslie",fund:"Maverick Capital",style:"Long/Short Quality Growth",desc:"Growth-oriented with hedging. Deep fundamental research, sector-focused.",
    holdings:["MSFT","AMZN","META","GOOG","NVDA","CRM","SNOW","UBER","DASH","ABNB","COIN","DDOG"],
    traits:{quality:0.6,value:0.2,growth:0.9,income:0.0,concentration:0.4,turnover:0.5}},
  {id:"gayner",name:"Tom Gayner",fund:"Markel",style:"Patient Quality",desc:"Insurance-funded long-term equity portfolio. Patient, quality-focused, Buffett-inspired.",
    holdings:["BRK-B","GOOG","MSFT","DIS","BAM","AMZN","V","MA","HD","CME","WMT","KKR"],
    traits:{quality:0.8,value:0.5,growth:0.4,income:0.3,concentration:0.3,turnover:0.1}}
];
var MSTAR_RATINGS=["Wide","Narrow","None","Not Rated"];
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
var LEGACY_MAP={};METRICS.forEach(function(m){LEGACY_MAP[m.label.toLowerCase()]=m.id});
var _la={"revenue growth":"revGrowth","eps growth":"epsGrowth","gross margin":"grossMargin","operating margin":"opMargin","net margin":"netMargin","fcf margin":"fcfMargin","free cash flow margin":"fcfMargin","r&d margin":"rndMargin","r&d to revenue":"rndMargin","sga margin":"sgaMargin","sga to revenue":"sgaMargin","return on equity":"roe","return on assets":"roa","return on invested capital":"roic","p/e":"pe","pe ratio":"pe","p/e ratio":"pe","p/b":"pb","price to book":"pb","p/s":"ps","price to sales":"ps","ev/ebitda":"evEbitda","ev/fcf":"evFcf","ev/revenue":"evRevenue","peg":"peg","peg ratio":"peg","current ratio":"currentRatio","quick ratio":"quickRatio","debt to equity":"debtEquity","debt/equity":"debtEquity","d/e ratio":"debtEquity","net debt/ebitda":"netDebtEbitda","interest coverage":"interestCoverage","dividend yield":"divYield","book value per share":"bvps","free cash flow":"fcfPerShare","fcf":"fcfPerShare","fcf yield":"fcfYield","fcf per share":"fcfPerShare","revenue per share":"revPerShare","ebitda":"ebitdaPerShare","ebitda margin":"ebitdaPerShare","rev/share":"revPerShare","revenue growth yoy":"revGrowth","eps growth yoy":"epsGrowth","shareholder yield":"shareholderYield","total shareholder yield":"shareholderYield","buyback yield":"buybackYield","graham number":"grahamNum","graham":"grahamNum","vs graham":"grahamDiscount"};
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
      // Dividend data from Finnhub (free, reliable)
      var divData={lastDiv:0,divPerShare:0,divFrequency:"none",exDivDate:"",divYield:0};
      try{var fhDiv=await fetchDivFromFinnhub(t,pr.lastDiv);
        if(fhDiv&&fhDiv.payer){divData.divPerShare=fhDiv.divPerShare;divData.lastDiv=fhDiv.annualDiv||fhDiv.divPerShare;divData.divFrequency=fhDiv.divFrequency;divData.divYield=fhDiv.divYield}
      }catch(e){}
      // Fallback to FMP lastDiv if Finnhub missed it
      if(divData.divPerShare===0&&pr.lastDiv>0){divData.divPerShare=pr.lastDiv;divData.lastDiv=pr.lastDiv;divData.divFrequency="quarterly";divData.divYield=pr.price>0?pr.lastDiv*4/pr.price*100:0}
      return{name:pr.companyName,sector:pr.sector||pr.industry||"",industry:pr.industry||"",earningsDate:ed,earningsTime:et,domain:domain,irUrl:irUrl||"",price:pr.price||0,lastDiv:divData.lastDiv,divPerShare:divData.divPerShare,divFrequency:divData.divFrequency,exDivDate:divData.exDivDate,divYield:divData.divYield,mktCap:pr.mktCap||0,description:pr.description||"",ceo:pr.ceo||"",employees:pr.fullTimeEmployees||0,country:pr.country||"",exchange:pr.exchangeShortName||pr.exchange||"",ipoDate:pr.ipoDate||"",image:pr.image||""}}
  }catch(e){console.warn("FMP lookup failed:",e)}
  return{error:"Not found — enter details manually"}}
async function fetchPrice(ticker){try{var p=await fmp("profile/"+ticker);if(p&&p.length&&p[0].price)return{price:p[0].price,lastDiv:p[0].lastDiv||0,changes:p[0].changes||0,changesPercentage:p[0].changesPercentage||0};return null}catch(e){return null}}
async function fetchQuote(ticker){try{var q=await finnhub("quote?symbol="+ticker);if(q&&q.c>0)return{price:q.c,prevClose:q.pc||0,change:q.d||0,changePct:q.dp||0};return null}catch(e){return null}}
// Fetch dividend data from Finnhub (FREE tier — stock/metric endpoint)
var KNOWN_MONTHLY=["O","MAIN","STAG","AGNC","SLG","GOOD","LTC","SPHD","JEPI","JEPQ","QYLD","RYLD","DIVO","EPR","LAND","PSEC","GAIN"];
async function fetchDivFromFinnhub(ticker,fmpLastDiv){try{
  var met=await finnhub("stock/metric?symbol="+ticker+"&metric=all");
  if(!met||!met.metric)return null;var m=met.metric;
  var annDiv=m["dividendPerShareAnnual"]||0;
  var divYield=m["dividendYieldIndicatedAnnual"]||0;
  if(annDiv<=0&&divYield<=0)return{payer:false,divPerShare:0,divYield:0,divFrequency:"none"};
  var freq="quarterly";var perPayment=annDiv>0?annDiv/4:0;
  if(KNOWN_MONTHLY.indexOf(ticker.toUpperCase())>=0){freq="monthly";perPayment=annDiv/12}
  else if(fmpLastDiv&&fmpLastDiv>0&&annDiv>0){var ratio=Math.round(annDiv/fmpLastDiv);
    if(ratio>=10&&ratio<=14){freq="monthly";perPayment=annDiv/12}
    else if(ratio>=1.5&&ratio<=2.5){freq="semi";perPayment=annDiv/2}
    else if(ratio<=1.2){freq="annual";perPayment=annDiv}}
  return{payer:true,divPerShare:perPayment,annualDiv:annDiv,divYield:divYield,divFrequency:freq}
}catch(e){return null}}
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
// Shared: estimate which months a company pays dividends based on frequency + exDivDate
function estimatePayMonths(c){
  var freq=c.divFrequency||"quarterly";
  if(freq==="monthly")return[0,1,2,3,4,5,6,7,8,9,10,11];
  if(freq==="none")return[];
  if(freq==="annual")return c.exDivDate?[new Date(c.exDivDate).getMonth()]:[5];
  if(freq==="semi")return c.exDivDate?[new Date(c.exDivDate).getMonth(),(new Date(c.exDivDate).getMonth()+6)%12]:[2,8];
  // Quarterly: if we have ex-div date, estimate 4 quarters from it
  if(c.exDivDate){var m=new Date(c.exDivDate).getMonth();return[m,(m+3)%12,(m+6)%12,(m+9)%12]}
  return[2,5,8,11]}
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
      var incRows=(_is||[]).reverse().map(function(row){
        // Compute grossProfitRatio if missing but grossProfit and revenue exist
        if(row.grossProfitRatio==null&&row.grossProfit!=null&&row.revenue!=null&&row.revenue!==0)row.grossProfitRatio=row.grossProfit/row.revenue;
        // Compute operatingIncomeRatio if missing
        if(row.operatingIncomeRatio==null&&row.operatingIncome!=null&&row.revenue!=null&&row.revenue!==0)row.operatingIncomeRatio=row.operatingIncome/row.revenue;
        // Compute netIncomeRatio if missing
        if(row.netIncomeRatio==null&&row.netIncome!=null&&row.revenue!=null&&row.revenue!==0)row.netIncomeRatio=row.netIncome/row.revenue;
        return row});
      var res={income:incRows,balance:(_bs||[]).reverse(),cashflow:(_cf||[]).reverse(),source:"fmp"};
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
      if(earn&&earn.length&&earn[0].actual!=null)snapshot.eps={label:"EPS",numVal:earn[0].actual,value:"$"+earn[0].actual,beat:earn[0].estimate!=null?earn[0].actual>=earn[0].estimate:null,detail:earn[0].estimate!=null?"Est: $"+earn[0].estimate:""};
      if(m["revenuePerShareTTM"])snapshot.revPerShare={label:"Revenue/Share",numVal:m["revenuePerShareTTM"],value:"$"+m["revenuePerShareTTM"].toFixed(2)};
      if(m["grossMarginTTM"]!=null)snapshot.grossMargin={label:"Gross Margin",numVal:m["grossMarginTTM"],value:(m["grossMarginTTM"]).toFixed(1)+"%"};
      if(m["operatingMarginTTM"]!=null)snapshot.opMargin={label:"Operating Margin",numVal:m["operatingMarginTTM"],value:(m["operatingMarginTTM"]).toFixed(1)+"%"};
      if(m["netProfitMarginTTM"]!=null)snapshot.netMargin={label:"Net Margin",numVal:m["netProfitMarginTTM"],value:(m["netProfitMarginTTM"]).toFixed(1)+"%"};
      if(m["roeTTM"]!=null)snapshot.roe={label:"ROE",numVal:m["roeTTM"],value:(m["roeTTM"]).toFixed(1)+"%"};
      if(m["roicTTM"]!=null)snapshot.roic={label:"ROIC",numVal:m["roicTTM"],value:(m["roicTTM"]).toFixed(1)+"%"};
      if(m["currentRatioQuarterly"])snapshot.currentRatio={label:"Current Ratio",numVal:m["currentRatioQuarterly"],value:m["currentRatioQuarterly"].toFixed(2)};
      if(m["totalDebt/totalEquityQuarterly"])snapshot.debtEquity={label:"Debt/Equity",numVal:m["totalDebt/totalEquityQuarterly"],value:m["totalDebt/totalEquityQuarterly"].toFixed(2)};
      if(m["peTTM"])snapshot.pe={label:"P/E",numVal:m["peTTM"],value:m["peTTM"].toFixed(1)};
      if(m["pbQuarterly"])snapshot.pb={label:"P/B",numVal:m["pbQuarterly"],value:m["pbQuarterly"].toFixed(2)};
      if(m["freeCashFlowPerShareTTM"])snapshot.fcf={label:"FCF/Share",numVal:m["freeCashFlowPerShareTTM"],value:"$"+m["freeCashFlowPerShareTTM"].toFixed(2)};
      if(m["revenueGrowthTTMYoy"]!=null)snapshot.revGrowth={label:"Rev Growth YoY",numVal:m["revenueGrowthTTMYoy"],value:(m["revenueGrowthTTMYoy"]).toFixed(1)+"%",positive:m["revenueGrowthTTMYoy"]>=0};
      if(m["epsGrowthTTMYoy"]!=null)snapshot.epsGrowth={label:"EPS Growth YoY",numVal:m["epsGrowthTTMYoy"],value:(m["epsGrowthTTMYoy"]).toFixed(1)+"%",positive:m["epsGrowthTTMYoy"]>=0};
      if(m["52WeekHigh"])snapshot.hi52={label:"52w High",value:"$"+m["52WeekHigh"].toFixed(2)};
      if(m["52WeekLow"])snapshot.lo52={label:"52w Low",value:"$"+m["52WeekLow"].toFixed(2)};
      // 52w range position — where in the range is current price?
      if(m["52WeekHigh"]&&m["52WeekLow"]&&co.position&&co.position.currentPrice>0){var _rng=m["52WeekHigh"]-m["52WeekLow"];if(_rng>0){var _pPos=((co.position.currentPrice-m["52WeekLow"])/_rng*100);snapshot.rangePos={label:"52w Position",numVal:_pPos,value:_pPos.toFixed(0)+"% of range",positive:_pPos<40}}}
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
        ebitdaPerShare:{v:m["ebitdPerShareTTM"],label:m["ebitdPerShareTTM"]?"$"+m["ebitdPerShareTTM"].toFixed(2):"N/A"},
        rndMargin:{v:null,label:"N/A"},
        sgaMargin:{v:null,label:"N/A"},
        fcfMargin:{v:null,label:"N/A"},
        cashOnHand:{v:null,label:"N/A"},
        totalDebt:{v:null,label:"N/A"},
        ps:{v:null,label:"N/A"},
        evEbitda:{v:null,label:"N/A"},
        evRevenue:{v:null,label:"N/A"},
        interestCoverage:{v:null,label:"N/A"},
        quickRatio:{v:null,label:"N/A"},
        netDebtEbitda:{v:null,label:"N/A"},
        peg:{v:null,label:"N/A"},
        fcfYield:{v:null,label:"N/A"}};
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
        roic:{v:km.returnOnInvestedCapitalTTM!=null?km.returnOnInvestedCapitalTTM*100:ra.returnOnCapitalEmployedTTM!=null?ra.returnOnCapitalEmployedTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        pe:{v:km.peRatioTTM!=null?km.peRatioTTM:null,fmt:function(v){return v.toFixed(1)}},
        pb:{v:km.priceToBookRatioTTM!=null?km.priceToBookRatioTTM:null,fmt:function(v){return v.toFixed(2)}},
        currentRatio:{v:ra.currentRatioTTM!=null?ra.currentRatioTTM:null,fmt:function(v){return v.toFixed(2)}},
        debtEquity:{v:km.debtToEquityTTM!=null?km.debtToEquityTTM:null,fmt:function(v){return v.toFixed(2)}},
        divYield:{v:km.dividendYieldTTM!=null?km.dividendYieldTTM*100:null,fmt:function(v){return v.toFixed(2)+"%"}},
        revPerShare:{v:km.revenuePerShareTTM!=null?km.revenuePerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}},
        fcfPerShare:{v:km.freeCashFlowPerShareTTM!=null?km.freeCashFlowPerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}},
        bvps:{v:km.bookValuePerShareTTM!=null?km.bookValuePerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}},
        ebitdaPerShare:{v:null,fmt:function(v){return"$"+v.toFixed(2)}}, // FMP TTM endpoints don't provide EBITDA/share; Finnhub ebitdPerShareTTM is used instead
        revGrowth:{v:ra.revenueGrowthTTM!=null?ra.revenueGrowthTTM*100:(km.revenueGrowthTTM!=null?km.revenueGrowthTTM*100:null),fmt:function(v){return v.toFixed(1)+"%"}},
        epsGrowth:{v:km.earningsGrowthTTM!=null?km.earningsGrowthTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        eps:{v:km.netIncomePerShareTTM!=null?km.netIncomePerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}},
        // Additional metrics missing from Finnhub — FMP fills these
        ps:{v:km.priceToSalesRatioTTM!=null?km.priceToSalesRatioTTM:null,fmt:function(v){return v.toFixed(2)}},
        evEbitda:{v:km.enterpriseValueOverEBITDATTM!=null?km.enterpriseValueOverEBITDATTM:null,fmt:function(v){return v.toFixed(1)+"x"}},
        evRevenue:{v:km.evToSalesTTM!=null?km.evToSalesTTM:null,fmt:function(v){return v.toFixed(2)+"x"}},
        interestCoverage:{v:ra.interestCoverageTTM!=null?ra.interestCoverageTTM:null,fmt:function(v){return v.toFixed(1)+"x"}},
        quickRatio:{v:ra.quickRatioTTM!=null?ra.quickRatioTTM:null,fmt:function(v){return v.toFixed(2)}},
        netDebtEbitda:{v:ra.netDebtToEBITDATTM!=null?ra.netDebtToEBITDATTM:null,fmt:function(v){return v.toFixed(2)+"x"}},
        peg:{v:ra.priceEarningsToGrowthRatioTTM!=null?ra.priceEarningsToGrowthRatioTTM:null,fmt:function(v){return v.toFixed(2)}},
        fcfMargin:{v:(km.freeCashFlowPerShareTTM!=null&&km.revenuePerShareTTM!=null&&km.revenuePerShareTTM>0)?km.freeCashFlowPerShareTTM/km.revenuePerShareTTM*100:null,fmt:function(v){return v.toFixed(1)+"%"}},
        rndMargin:{v:ra.researchAndDevelopementToRevenueTTM!=null?ra.researchAndDevelopementToRevenueTTM*100:(ra.researchAndDevelopmentToRevenueTTM!=null?ra.researchAndDevelopmentToRevenueTTM*100:null),fmt:function(v){return v.toFixed(1)+"%"}},
        sgaMargin:{v:ra.sellingGeneralAndAdministrativeExpensesToRevenueTTM!=null?ra.sellingGeneralAndAdministrativeExpensesToRevenueTTM*100:(ra.sgaToRevenueTTM!=null?ra.sgaToRevenueTTM*100:null),fmt:function(v){return v.toFixed(1)+"%"}},
        cashOnHand:{v:km.cashPerShareTTM!=null?km.cashPerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}},
        totalDebt:{v:(km.debtToEquityTTM!=null&&km.bookValuePerShareTTM!=null&&km.bookValuePerShareTTM>0)?(km.debtToEquityTTM*km.bookValuePerShareTTM):null,fmt:function(v){return"$"+v.toFixed(2)}}};
      // Fill gaps: merge FMP into fhMap where Finnhub returned null
      var fmpFilled=0;
      Object.keys(fmpMap).forEach(function(key){
        if(fmpMap[key].v!=null){
          if(!fhMap[key]||fhMap[key].v==null){
            fhMap[key]={v:fmpMap[key].v,label:fmpMap[key].fmt(fmpMap[key].v)+" (FMP)"};fmpFilled++}
        }});
      // Enrich snapshot with FMP data where Finnhub didn't have it
      if(!snapshot.grossMargin&&fmpMap.grossMargin.v!=null)snapshot.grossMargin={label:"Gross Margin",numVal:fmpMap.grossMargin.v,value:fmpMap.grossMargin.fmt(fmpMap.grossMargin.v),source:"FMP"};
      if(!snapshot.opMargin&&fmpMap.opMargin.v!=null)snapshot.opMargin={label:"Operating Margin",numVal:fmpMap.opMargin.v,value:fmpMap.opMargin.fmt(fmpMap.opMargin.v),source:"FMP"};
      if(!snapshot.netMargin&&fmpMap.netMargin.v!=null)snapshot.netMargin={label:"Net Margin",numVal:fmpMap.netMargin.v,value:fmpMap.netMargin.fmt(fmpMap.netMargin.v),source:"FMP"};
      if(!snapshot.roe&&fmpMap.roe.v!=null)snapshot.roe={label:"ROE",numVal:fmpMap.roe.v,value:fmpMap.roe.fmt(fmpMap.roe.v),source:"FMP"};
      if(!snapshot.roic&&fmpMap.roic.v!=null)snapshot.roic={label:"ROIC",numVal:fmpMap.roic.v,value:fmpMap.roic.fmt(fmpMap.roic.v),source:"FMP"};
      if(!snapshot.pe&&fmpMap.pe.v!=null)snapshot.pe={label:"P/E",numVal:fmpMap.pe.v,value:fmpMap.pe.fmt(fmpMap.pe.v),source:"FMP"};
      if(!snapshot.pb&&fmpMap.pb.v!=null)snapshot.pb={label:"P/B",numVal:fmpMap.pb.v,value:fmpMap.pb.fmt(fmpMap.pb.v),source:"FMP"};
      if(!snapshot.currentRatio&&fmpMap.currentRatio.v!=null)snapshot.currentRatio={label:"Current Ratio",numVal:fmpMap.currentRatio.v,value:fmpMap.currentRatio.fmt(fmpMap.currentRatio.v),source:"FMP"};
      if(!snapshot.debtEquity&&fmpMap.debtEquity.v!=null)snapshot.debtEquity={label:"Debt/Equity",numVal:fmpMap.debtEquity.v,value:fmpMap.debtEquity.fmt(fmpMap.debtEquity.v),source:"FMP"};
      if(!snapshot.fcf&&fmpMap.fcfPerShare.v!=null)snapshot.fcf={label:"FCF/Share",numVal:fmpMap.fcfPerShare.v,value:fmpMap.fcfPerShare.fmt(fmpMap.fcfPerShare.v),source:"FMP"};
      if(!snapshot.revGrowth&&fmpMap.revGrowth.v!=null)snapshot.revGrowth={label:"Rev Growth YoY",numVal:fmpMap.revGrowth.v,value:fmpMap.revGrowth.fmt(fmpMap.revGrowth.v),positive:fmpMap.revGrowth.v>=0,source:"FMP"};
      if(!snapshot.epsGrowth&&fmpMap.epsGrowth.v!=null)snapshot.epsGrowth={label:"EPS Growth YoY",numVal:fmpMap.epsGrowth.v,value:fmpMap.epsGrowth.fmt(fmpMap.epsGrowth.v),positive:fmpMap.epsGrowth.v>=0,source:"FMP"};
      // Extra FMP-only metrics for snapshot
      if(km.marketCapTTM!=null&&!snapshot.mktCap){var _mc=km.marketCapTTM/1e9;snapshot.mktCap={label:"Market Cap",numVal:_mc,value:"$"+(_mc>=1000?(_mc/1000).toFixed(2)+"T":_mc.toFixed(1)+"B"),source:"FMP"};}
      if(km.evToSalesTTM!=null&&!snapshot.evSales)snapshot.evSales={label:"EV/Sales",numVal:km.evToSalesTTM,value:km.evToSalesTTM.toFixed(1)+"x",source:"FMP"};
      if(km.evToFreeCashFlowTTM!=null&&!snapshot.evFcf)snapshot.evFcf={label:"EV/FCF",numVal:km.evToFreeCashFlowTTM,value:km.evToFreeCashFlowTTM.toFixed(1)+"x",source:"FMP"};
      if(ra.payoutRatioTTM!=null&&!snapshot.payoutRatio)snapshot.payoutRatio={label:"Payout Ratio",numVal:ra.payoutRatioTTM*100,value:(ra.payoutRatioTTM*100).toFixed(0)+"%",source:"FMP"};
      if(km.tangibleBookValuePerShareTTM!=null&&!snapshot.tangBvps)snapshot.tangBvps={label:"Tangible BV/Share",numVal:km.tangibleBookValuePerShareTTM,value:"$"+km.tangibleBookValuePerShareTTM.toFixed(2),source:"FMP"};
      if(km.grahamNumberTTM!=null&&!snapshot.graham)snapshot.graham={label:"Graham Number",numVal:km.grahamNumberTTM,value:"$"+km.grahamNumberTTM.toFixed(2),source:"FMP"};
      // FCF Yield — try multiple FMP field name variants, then compute from fcfPerShare/price
      var _rawFcfYield=km.freeCashFlowYieldTTM!=null?km.freeCashFlowYieldTTM:(km.freeCashFlowYield!=null?km.freeCashFlowYield:(ra.freeCashFlowYieldTTM!=null?ra.freeCashFlowYieldTTM:null));
      // FMP returns this as a decimal (e.g. 0.035 = 3.5%) — multiply by 100
      if(_rawFcfYield!=null&&!snapshot.fcfYield){var _fmpFcfY=Math.abs(_rawFcfYield)<2?_rawFcfYield*100:_rawFcfYield;snapshot.fcfYield={label:"FCF Yield",numVal:_fmpFcfY,value:_fmpFcfY.toFixed(1)+"%",source:"FMP"};
        fhMap.fcfYield={v:_fmpFcfY,label:_fmpFcfY.toFixed(1)+"%"}}
      // Final fallback: compute from fcfPerShare (now in fhMap after FMP fill) and position price
      if(!snapshot.fcfYield&&fhMap.fcfPerShare&&fhMap.fcfPerShare.v!=null){
        var _fcfFallbackPrice=(co.position&&co.position.currentPrice>0)?co.position.currentPrice:(fhMap.pe&&fhMap.pe.v>0&&fhMap.eps&&fhMap.eps.v!=null?fhMap.pe.v*Math.abs(fhMap.eps.v):0);
        if(_fcfFallbackPrice>0){var _fcfYf=fhMap.fcfPerShare.v/_fcfFallbackPrice*100;snapshot.fcfYield={label:"FCF Yield",numVal:_fcfYf,value:_fcfYf.toFixed(1)+"%",source:"computed"};
          fhMap.fcfYield={v:_fcfYf,label:_fcfYf.toFixed(1)+"%"}}}
      // Newly-added FMP metrics → snapshot
      if(km.priceToSalesRatioTTM!=null&&!snapshot.ps)snapshot.ps={label:"P/S",numVal:km.priceToSalesRatioTTM,value:km.priceToSalesRatioTTM.toFixed(2),source:"FMP"};
      if(km.enterpriseValueOverEBITDATTM!=null&&!snapshot.evEbitda)snapshot.evEbitda={label:"EV/EBITDA",numVal:km.enterpriseValueOverEBITDATTM,value:km.enterpriseValueOverEBITDATTM.toFixed(1)+"x",source:"FMP"};
      if(km.evToSalesTTM!=null&&!snapshot.evRevenue)snapshot.evRevenue={label:"EV/Revenue",numVal:km.evToSalesTTM,value:km.evToSalesTTM.toFixed(2)+"x",source:"FMP"};
      if(ra.interestCoverageTTM!=null&&!snapshot.interestCoverage)snapshot.interestCoverage={label:"Interest Coverage",numVal:ra.interestCoverageTTM,value:ra.interestCoverageTTM.toFixed(1)+"x",source:"FMP"};
      if(ra.quickRatioTTM!=null&&!snapshot.quickRatio)snapshot.quickRatio={label:"Quick Ratio",numVal:ra.quickRatioTTM,value:ra.quickRatioTTM.toFixed(2),source:"FMP"};
      if(ra.netDebtToEBITDATTM!=null&&!snapshot.netDebtEbitda)snapshot.netDebtEbitda={label:"Net Debt/EBITDA",numVal:ra.netDebtToEBITDATTM,value:ra.netDebtToEBITDATTM.toFixed(2)+"x",source:"FMP"};
      if(ra.priceEarningsToGrowthRatioTTM!=null&&!snapshot.peg)snapshot.peg={label:"PEG",numVal:ra.priceEarningsToGrowthRatioTTM,value:ra.priceEarningsToGrowthRatioTTM.toFixed(2),source:"FMP"};
      if(fmpMap.fcfMargin&&fmpMap.fcfMargin.v!=null&&!snapshot.fcfMargin)snapshot.fcfMargin={label:"FCF Margin",numVal:fmpMap.fcfMargin.v,value:fmpMap.fcfMargin.v.toFixed(1)+"%",source:"FMP"};
      if(fmpMap.rndMargin&&fmpMap.rndMargin.v!=null&&!snapshot.rndMargin)snapshot.rndMargin={label:"R&D / Revenue",numVal:fmpMap.rndMargin.v,value:fmpMap.rndMargin.v.toFixed(1)+"%",source:"FMP"};
      if(fmpMap.sgaMargin&&fmpMap.sgaMargin.v!=null&&!snapshot.sgaMargin)snapshot.sgaMargin={label:"SG&A / Revenue",numVal:fmpMap.sgaMargin.v,value:fmpMap.sgaMargin.v.toFixed(1)+"%",source:"FMP"};
      if(fmpMap.cashOnHand&&fmpMap.cashOnHand.v!=null&&!snapshot.cashOnHand)snapshot.cashOnHand={label:"Cash/Share",numVal:fmpMap.cashOnHand.v,value:"$"+fmpMap.cashOnHand.v.toFixed(2),source:"FMP"};
      // Dividend growth — compute from FMP earningsGrowth or Finnhub divs history
      if(!snapshot.divGrowth){var _dg=ra.dividendGrowthTTM!=null?ra.dividendGrowthTTM*100:(km.dividendGrowthTTM!=null?km.dividendGrowthTTM*100:null);
        if(_dg!=null){snapshot.divGrowth={label:"Div Growth YoY",numVal:_dg,value:(_dg>=0?"+":"")+_dg.toFixed(1)+"%",source:"FMP"};
          fhMap.divGrowth={v:_dg,label:(_dg>=0?"+":"")+_dg.toFixed(1)+"%"}}}
      // Dividend yield — ensure it's in snapshot as a number
      if(km.dividendYieldTTM!=null&&!snapshot.divYield)snapshot.divYield={label:"Dividend Yield",value:(km.dividendYieldTTM*100).toFixed(2)+"%",numVal:km.dividendYieldTTM*100,source:"FMP"};
      if(!snapshot.divYield&&fhMap.divYield&&fhMap.divYield.v!=null)snapshot.divYield={label:"Dividend Yield",value:fhMap.divYield.v.toFixed(2)+"%",numVal:fhMap.divYield.v,source:"Finnhub"};
      // Shareholder yield = div yield + buyback yield (from FMP key-metrics)
      var _bbY=km.buybackYieldTTM!=null?km.buybackYieldTTM*100:null;
      if(_bbY==null&&km.stockBasedCompensationToRevenueTTM!=null)_bbY=null; // no fallback
      var _divY=snapshot.divYield?snapshot.divYield.numVal:0;
      if(_bbY!=null&&!snapshot.buybackYield){snapshot.buybackYield={label:"Buyback Yield",numVal:Math.max(0,_bbY),value:Math.max(0,_bbY).toFixed(2)+"%",source:"FMP"};fhMap.buybackYield={v:Math.max(0,_bbY),label:Math.max(0,_bbY).toFixed(2)+"%"}}
      if(!snapshot.shareholderYield){var _sy=_divY+(snapshot.buybackYield?snapshot.buybackYield.numVal:0);if(_sy>0){snapshot.shareholderYield={label:"Shareholder Yield",numVal:_sy,value:_sy.toFixed(2)+"%",source:"FMP"};fhMap.shareholderYield={v:_sy,label:_sy.toFixed(2)+"%"}}}
      if(!srcLabel&&fmpFilled>0){srcUrl="https://financialmodelingprep.com";srcLabel="FMP"}
      console.log("[ThesisAlpha] FMP enriched "+co.ticker+": "+fmpFilled+" gaps filled, snapshot now "+Object.keys(snapshot).length+" keys");
    }}catch(e){console.warn("FMP metrics enrichment:",e)}

  // Step 2b: Computed derived metrics
  var _implPrice=(co.position&&co.position.currentPrice>0)?co.position.currentPrice:(fhMap.pe&&fhMap.pe.v>0&&fhMap.eps&&fhMap.eps.v!=null?fhMap.pe.v*Math.abs(fhMap.eps.v):0);
  if(_implPrice>0){snapshot.livePrice={label:"Price",numVal:_implPrice,value:"$"+_implPrice.toFixed(2)}}
  if(fhMap.fcfPerShare&&fhMap.fcfPerShare.v!=null&&_implPrice>0&&!snapshot.fcfYield){var _fcfY=fhMap.fcfPerShare.v/_implPrice*100;fhMap.fcfYield={v:_fcfY,label:_fcfY.toFixed(1)+"%"};snapshot.fcfYield={label:"FCF Yield",numVal:_fcfY,value:_fcfY.toFixed(1)+"%"}}
  if(fhMap.pe&&fhMap.pe.v!=null&&fhMap.pe.v>0){var _ey=1/fhMap.pe.v*100;fhMap.earningsYield={v:_ey,label:_ey.toFixed(1)+"%"}}
  if(fhMap.fcfPerShare&&fhMap.fcfPerShare.v!=null&&fhMap.fcfPerShare.v>0&&co.position&&co.position.currentPrice>0){var _pFcf=co.position.currentPrice/fhMap.fcfPerShare.v;fhMap.priceToFcf={v:_pFcf,label:_pFcf.toFixed(1)+"x"}}
  // Graham number: sqrt(22.5 * EPS * BVPS) — classic intrinsic value estimate
  var _eps=snapshot.eps?snapshot.eps.numVal:null;
  var _bvps=fhMap.bvps&&fhMap.bvps.v!=null?fhMap.bvps.v:(fhMap.pb&&fhMap.pb.v>0&&_implPrice>0?_implPrice/fhMap.pb.v:null);
  if(_eps!=null&&_eps>0&&_bvps!=null&&_bvps>0){var _graham=Math.sqrt(22.5*_eps*_bvps);snapshot.grahamNum={label:"Graham Number",numVal:_graham,value:"$"+_graham.toFixed(2),source:"calc"};fhMap.grahamNum={v:_graham,label:"$"+_graham.toFixed(2)}}
  if(_implPrice>0&&snapshot.grahamNum){var _gDisc=(_implPrice-snapshot.grahamNum.numVal)/snapshot.grahamNum.numVal*100;snapshot.grahamDiscount={label:"vs Graham",numVal:_gDisc,value:(_gDisc>0?"+":"")+_gDisc.toFixed(0)+"%",positive:_gDisc<0,source:"calc"}}

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
async function fetchInstitutionalHolders(ticker){try{var r=await fmp("institutional-holder/"+ticker);if(r&&Array.isArray(r))return r.slice(0,10);return[]}catch(e){return[]}}
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
// ── Thesis Themes — landing page aesthetic: Outfit font, heavy rounding, purple accent ──
var THESIS_DARK={bg:"#16161D",side:"#0F0F14",card:"#1C1C26",bdr:"rgba(255,255,255,0.07)",bdr2:"rgba(255,255,255,0.14)",txt:"#ffffff",mid:"rgba(255,255,255,0.82)",dim:"rgba(255,255,255,0.56)",blue:"#3B82F6",grn:"#4ADE80",red:"#F87171",amb:"#FACC15",acc:"#6B4CE6",prim:"#6B4CE6",primTxt:"#ffffff"};
var THESIS_LIGHT={bg:"#F7F5F0",side:"#EFECE6",card:"#ffffff",bdr:"rgba(0,0,0,0.08)",bdr2:"rgba(0,0,0,0.14)",txt:"#16161D",mid:"rgba(22,22,29,0.75)",dim:"rgba(22,22,29,0.52)",blue:"#2563eb",grn:"#16a34a",red:"#dc2626",amb:"#d97706",acc:"#6B4CE6",prim:"#6B4CE6",primTxt:"#ffffff"};
var THEMES={thesis_dark:THESIS_DARK,thesis_light:THESIS_LIGHT,dark:DARK,light:LIGHT,forest:FOREST,purple:PURPLE,paypal:PAYPAL,bloomberg:BLOOMBERG};
var fm="'JetBrains Mono','SF Mono',monospace",fh="'Instrument Serif',Georgia,serif",fb="'DM Sans','Helvetica Neue',sans-serif";
// Global thesis flag — updated inside TrackerApp before mkS calls
var _isThesis=true;
function TLogo(p){var s=p.size||28;return<img src="/logo.png" width={s} height={s} style={{borderRadius:_isThesis?Math.round(s*0.22):6,objectFit:"contain"}} alt="T"/>}
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
  if(p.domain&&a===0)return<img src={"https://www.google.com/s2/favicons?domain="+p.domain+"&sz=128"} width={sz} height={sz} style={{borderRadius:4,background:"transparent",objectFit:"contain",flexShrink:0}} onError={function(){sA(1)}} loading="lazy" alt=""/>;
  if(p.domain&&a===1)return<img src={"https://logo.clearbit.com/"+p.domain} width={sz} height={sz} style={{borderRadius:4,background:"transparent",objectFit:"contain",flexShrink:0}} onError={function(){sA(2)}} loading="lazy" alt=""/>;
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

function mkS(K){
  var th=_isThesis;
  var br=th?999:8;
  var btnBase={cursor:"pointer",fontFamily:fm,transition:"all .15s ease",fontSize:th?13:12,fontWeight:th?700:400};
  var _mkDark=K.bg==="#16161D"||K.bg==="#0F0F14"||K.bg==="#0a0a0f"||K.bg==="#1a1a1a"||K.bg==="#0d1117"||K.bg==="#0a0e1a"||K.bg==="#1a1a2e";  var cardShadow=th?(_mkDark?"0 2px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15)":"0 4px 20px rgba(0,0,0,0.10), 0 1px 6px rgba(107,76,230,0.07), 0 0 0 1px rgba(0,0,0,0.04)"):"none";
  return{
    btn:Object.assign({},btnBase,{background:th?"rgba(255,255,255,0.06)":"transparent",border:"1px solid "+(th?"rgba(255,255,255,0.1)":K.bdr),color:th?K.txt:K.mid,padding:th?"9px 20px":"8px 16px",borderRadius:br}),
    btnP:Object.assign({},btnBase,{background:K.prim,border:"1px solid "+K.prim,color:K.primTxt,padding:th?"11px 28px":"9px 18px",borderRadius:br,fontWeight:700,boxShadow:th?"0 4px 20px "+K.prim+"60":"none",letterSpacing:th?"-0.2px":0}),
    btnD:Object.assign({},btnBase,{background:"transparent",border:"1px solid #7F1D1D",color:K.red,padding:th?"9px 20px":"8px 16px",borderRadius:br}),
    btnChk:Object.assign({},btnBase,{background:_mkDark?K.acc+"18":K.acc+"22",border:"1px solid "+K.acc+(_mkDark?"40":"60"),color:K.acc,padding:th?"11px 24px":"9px 18px",borderRadius:br,fontWeight:700,boxShadow:_mkDark?"none":"inset 0 1px 0 rgba(255,255,255,0.6)"}),
    sec:{fontSize:th?11:11,letterSpacing:th?0.5:1,textTransform:"uppercase",color:th?K.acc:K.dim,marginBottom:th?16:12,fontWeight:700,fontFamily:fm,display:"flex",alignItems:"center",gap:8},
    badge:function(c){return{display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:th?700:500,color:c,background:c+"18",padding:th?"4px 14px":"3px 10px",borderRadius:th?999:6,fontFamily:fm}},
    dot:function(s){return{width:8,height:8,borderRadius:"50%",background:s==="met"?"#22C55E":s==="missed"?"#EF4444":"#555",flexShrink:0}},
    card:{background:K.card,border:"1px solid "+K.bdr,borderRadius:th?20:6,padding:th?"24px 28px":"16px 20px",boxShadow:cardShadow},
    inp:{width:"100%",boxSizing:"border-box",background:th?"rgba(255,255,255,0.05)":K.bg,border:"1px solid "+K.bdr,borderRadius:th?14:6,color:K.txt,padding:th?"12px 18px":"10px 14px",fontSize:14,fontFamily:fm,outline:"none"},
  }
}
function Modal(p){var K=p.K||DARK;var mob=typeof window!=="undefined"&&window.innerWidth<768;var th=_isThesis;return<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(12px)",animation:"fadeInFast .15s ease-out"}} onClick={p.onClose}><div className="ta-slide ta-modal-inner" style={{background:K.card,border:mob?"none":"1px solid "+K.bdr2,borderRadius:mob?(th?"28px 28px 0 0":"16px 16px 0 0"):th?28:16,padding:mob?th?"28px 24px 36px":"24px 20px 32px":th?"32px 36px":"28px 32px",width:mob?"100%":p.w||500,maxWidth:mob?"100%":"92vw",maxHeight:mob?"90vh":"85vh",overflowY:"auto",boxShadow:th?"0 32px 80px rgba(0,0,0,.5)":"0 24px 64px rgba(0,0,0,.4)"}} onClick={function(e){e.stopPropagation()}}>{p.title?<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:th?28:24}}><h2 style={{margin:0,fontSize:mob?15:th?18:17,fontWeight:th?800:500,color:K.txt,fontFamily:fh,letterSpacing:th?"-0.5px":0}}>{p.title}</h2><button onClick={p.onClose} style={{background:th?"rgba(255,255,255,0.08)":"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:"6px 10px",borderRadius:th?999:6,lineHeight:1}} onMouseEnter={function(e){e.currentTarget.style.color=K.txt}} onMouseLeave={function(e){e.currentTarget.style.color=K.dim}}>{"✕"}</button></div>:<div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}><button onClick={p.onClose} style={{background:"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:"6px 10px",borderRadius:6,lineHeight:1}} onMouseEnter={function(e){e.currentTarget.style.color=K.txt}} onMouseLeave={function(e){e.currentTarget.style.color=K.dim}}>{"✕"}</button></div>}{p.children}</div></div>}
function Inp(p){var K=p.K||DARK;var th=_isThesis;var b={width:"100%",boxSizing:"border-box",background:th?"rgba(255,255,255,0.05)":K.bg,border:"1px solid "+K.bdr,borderRadius:th?14:6,color:K.txt,padding:th?"12px 18px":"10px 14px",fontSize:14,fontFamily:fm,outline:"none"};return<div style={{marginBottom:18}}>{p.label&&<label style={{display:"block",fontSize:th?12:11,color:K.dim,marginBottom:th?8:6,letterSpacing:th?0:.5,textTransform:th?"none":"uppercase",fontFamily:fm,fontWeight:th?600:400}}>{p.label}</label>}{p.ta?<textarea value={p.value} onChange={function(e){p.onChange(e.target.value)}} placeholder={p.placeholder} rows={3} style={Object.assign({},b,{resize:"vertical"})}/>:<input type={p.type||"text"} value={p.value} onChange={function(e){p.onChange(e.target.value)}} placeholder={p.placeholder} spellCheck={p.spellCheck!==undefined?p.spellCheck:true} autoCorrect={p.autoCorrect||"on"} autoComplete={p.autoComplete||"on"} style={b}/>}</div>}
function Sel(p){var K=p.K||DARK;var th=_isThesis;return<div style={{marginBottom:18}}>{p.label&&<label style={{display:"block",fontSize:th?12:11,color:K.dim,marginBottom:th?8:6,letterSpacing:th?0:.5,textTransform:th?"none":"uppercase",fontFamily:fm,fontWeight:th?600:400}}>{p.label}</label>}<select value={p.value} onChange={function(e){p.onChange(e.target.value)}} style={{width:"100%",boxSizing:"border-box",background:th?"rgba(255,255,255,0.05)":K.bg,border:"1px solid "+K.bdr,borderRadius:th?14:6,color:K.txt,padding:th?"12px 18px":"10px 14px",fontSize:14,fontFamily:fm,outline:"none"}}>{p.options.map(function(o){return<option key={o.v} value={o.v}>{o.l}</option>})}</select></div>}

// ═══ LOGIN ═══
function LoginPage(props){
  var _e=useState(""),email=_e[0],setEmail=_e[1];var _p=useState(""),pw=_p[0],setPw=_p[1];
  var _err=useState(""),err=_err[0],setErr=_err[1];var _mode=useState("login"),mode=_mode[0],setMode=_mode[1];
  var _ld=useState(false),ld2=_ld[0],setLd=_ld[1];
  var _th=useState(function(){try{var s=localStorage.getItem("ta-theme");if(s==="light"||!s)return"thesis_light";if(s==="dark")return"thesis_dark";return s}catch(e){return"thesis_light"}}),theme=_th[0],setTheme=_th[1];
  var K=THEMES[theme]||THESIS_LIGHT;
  function toggleTheme(){var n=theme==="thesis_dark"?"thesis_light":theme==="thesis_light"?"thesis_dark":theme==="dark"?"light":"dark";setTheme(n);try{localStorage.setItem("ta-theme",n)}catch(e){}}
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
  <button onClick={toggleTheme} style={{position:"absolute",top:20,right:24,background:"none",border:"1px solid "+K.bdr,borderRadius:999,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}}>{(theme==="dark"||theme==="thesis_dark")?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}</button>
  <div className="ta-slide ta-login-box" style={{width:400,padding:"48px 40px",background:K.card,border:"1px solid "+K.bdr,borderRadius:20,boxShadow:theme==="dark"?"0 32px 64px rgba(0,0,0,.4)":"0 32px 64px rgba(0,0,0,.08)"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:28}}><TLogo size={24}/><span style={{fontSize:16,fontWeight:600,letterSpacing:2,fontFamily:fm,color:K.txt}}>ThesisAlpha</span></div>
    <h2 style={{fontSize:28,fontFamily:fh,fontWeight:400,margin:"0 0 8px",textAlign:"center",color:K.txt}}>{mode==="login"?"Welcome back":"Create account"}</h2>
    <p style={{fontSize:14,color:K.dim,textAlign:"center",margin:"0 0 32px"}}>{mode==="login"?"Sign in to your portfolio":"Start tracking your thesis"}</p>
    {err&&<div style={{background:K.red+"12",border:"1px solid "+K.red+"30",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:K.red}}>{err}</div>}
    <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:K.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Email</label>
      <input type="email" value={email} onChange={function(e){setEmail(e.target.value);setErr("")}} placeholder="you@email.com" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <div style={{marginBottom:24}}><label style={{display:"block",fontSize:12,color:K.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Password</label>
      <input type="password" value={pw} onChange={function(e){setPw(e.target.value);setErr("")}} placeholder={"••••••••"} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <button onClick={submit} disabled={ld2} style={{width:"100%",background:K.prim||K.acc,color:K.primTxt||"#fff",border:"none",padding:"14px",borderRadius:12,fontSize:14,fontWeight:600,cursor:ld2?"wait":"pointer",fontFamily:fb,marginBottom:16,opacity:ld2?.6:1}}>{ld2?"...":(mode==="login"?"Sign In":"Create Account")}</button>
    <div style={{textAlign:"center",fontSize:14,color:K.dim}}>{mode==="login"?"Don't have an account? ":"Already have an account? "}<span onClick={function(){setMode(mode==="login"?"signup":"login");setErr("")}} style={{color:K.acc,cursor:"pointer"}}>{mode==="login"?"Sign up":"Sign in"}</span></div>
  </div></div>)}

// ═══ TRACKER APP ═══
function TrackerApp(props){
  (function(){try{var storedId=localStorage.getItem("ta-userid");
    if(storedId&&storedId!==props.userId){var savedTheme=localStorage.getItem("ta-theme");
      var keys=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf("ta-")===0)keys.push(k)}
      keys.forEach(function(k){localStorage.removeItem(k)});
      if(savedTheme)localStorage.setItem("ta-theme",savedTheme);
      localStorage.setItem("ta-userid",props.userId)}
    else if(!storedId){localStorage.setItem("ta-userid",props.userId)}}catch(e){}})();
  var _th=useState(function(){try{
    var saved=localStorage.getItem("ta-theme");
    if(saved==="light"){localStorage.setItem("ta-theme","thesis_light");return"thesis_light"}
    if(saved==="dark"){localStorage.setItem("ta-theme","thesis_dark");return"thesis_dark"}
    return saved||"thesis_dark";
  }catch(e){return"thesis_dark"}}),theme=_th[0],setTheme=_th[1];
  var isThesis=theme==="thesis_dark"||theme==="thesis_light";
  var isForest=theme==="forest";
  var bm=theme==="bloomberg";
  // Update global flag so mkS, Modal, Inp, Sel all pick up the right shape language
  _isThesis=isThesis;
  var K=THEMES[theme]||THESIS_DARK;
  if(isThesis){fm="'Outfit',sans-serif";fh="'Outfit',sans-serif";fb="'Outfit',sans-serif";}
  else if(isForest){fm="'Nunito','DM Sans','Helvetica Neue',sans-serif";fh="'Nunito','DM Sans','Helvetica Neue',sans-serif";fb="'Nunito','DM Sans','Helvetica Neue',sans-serif";}
  else if(bm){fm="'Consolas','Courier New',monospace";fh="'Consolas','Courier New',monospace";fb="'Consolas','Courier New',monospace";}
  else{fm="'JetBrains Mono','SF Mono',monospace";fh="'Instrument Serif',Georgia,serif";fb="'DM Sans','Helvetica Neue',sans-serif";}
  var S=mkS(K);
  var isDark=theme==="dark"||theme==="purple"||theme==="bloomberg"||theme==="thesis_dark";
  var sideDark=isDark||theme==="forest"||theme==="paypal";
  var sideText=sideDark?"#ffffff":K.txt;var sideMid=sideDark?"#ffffffcc":K.mid;var sideDim2=sideDark?"#ffffff88":K.dim;
  function cycleTheme(){var streakWeeks=(streakData&&streakData.current)||0;var available=["thesis_dark","thesis_light","dark","light"];if(streakWeeks>=1){available.push("forest");available.push("purple")}if(streakWeeks>=3){available.push("paypal")}if(streakWeeks>=5){available.push("bloomberg")}var idx=available.indexOf(theme);var n=available[(idx+1)%available.length];setTheme(n);try{localStorage.setItem("ta-theme",n)}catch(e){}}
  function toggleTheme(){var n=theme==="thesis_dark"?"thesis_light":theme==="thesis_light"?"thesis_dark":theme==="dark"?"light":"dark";setTheme(n);try{localStorage.setItem("ta-theme",n)}catch(e){}}
  var _c=useState([]),cos=_c[0],setCos=_c[1];var _l=useState(false),loaded=_l[0],setLoaded=_l[1];
  var _s=useState(null),selId=_s[0],setSelId=_s[1];var _ek=useState(null),expKpi=_ek[0],setExpKpi=_ek[1];
  var _sp=useState(null),subPage=_sp[0],setSubPage=_sp[1];
  var _dt=useState("dossier"),detailTab=_dt[0],setDetailTab=_dt[1];
  var _m=useState(null),modal=_m[0],setModal=_m[1];var _ck=useState({}),checkSt=_ck[0],setCheckSt=_ck[1];
  var _pg=useState("dashboard"),page=_pg[0],setPage=_pg[1];
  var _lens2=useState("smith"),activeLens=_lens2[0],setActiveLens=_lens2[1];
  var _fcs=useState(["revenue","netIncome"]),finChartSel=_fcs[0],setFinChartSel=_fcs[1];
  var _n=useState([]),notifs=_n[0],setNotifs=_n[1];var _sn=useState(false),showNotifs=_sn[0],setShowNotifs=_sn[1];
  var _st2=useState("portfolio"),sideTab=_st2[0],setSideTab=_st2[1];var _sideHov=useState(null),sideHover=_sideHov[0],setSideHover=_sideHov[1];var _flyY=useState(80),flyY=_flyY[0],setFlyY=_flyY[1];var _showListCfg=useState(false),showListCfg=_showListCfg[0],setShowListCfg=_showListCfg[1];
  var _guidedSetup=useState(null),guidedSetup=_guidedSetup[0],setGuidedSetup=_guidedSetup[1];
  var _showQLetter=useState(null),showQLetter=_showQLetter[0],setShowQLetter=_showQLetter[1];
  var _qL=useState(function(){try{var s=localStorage.getItem("ta-qletters");return s?JSON.parse(s):{}}catch(e){return{}}}),qLetters=_qL[0],setQLetters=_qL[1];
  var _uname=useState(function(){try{return localStorage.getItem("ta-username")||""}catch(e){return""}}),username=_uname[0],setUsername=_uname[1];
  var _avUrl=useState(function(){try{return localStorage.getItem("ta-avatar")||""}catch(e){return""}}),avatarUrl=_avUrl[0],setAvatarUrl=_avUrl[1];
  var _editN=useState(false),editingName=_editN[0],setEditingName=_editN[1];
  var _nameI=useState(""),nameInput=_nameI[0],setNameInput=_nameI[1];
  var avatarFileRef=useRef(null);
  var saveTimer=useRef(null);
  var cloudTimer=useRef(null);
  function saveUsername(){var v=nameInput.trim().slice(0,20);setUsername(v);try{localStorage.setItem("ta-username",v)}catch(e){}setEditingName(false);}
  function handleAvatarUpload(e){var file=e.target.files&&e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(ev){var url=ev.target.result;setAvatarUrl(url);try{localStorage.setItem("ta-avatar",url)}catch(e){}};reader.readAsDataURL(file);}
  var chestOverlay=null;function setChestOverlay(){}
  var xpFloat=null;
  var _hubTab=useState("command"),hubTab=_hubTab[0],setHubTab=_hubTab[1];
  var _cur=useState(function(){try{return localStorage.getItem("ta-currency")||"USD"}catch(e){return"USD"}}),currency=_cur[0],setCurrency=_cur[1];
  function saveCurrency(v){setCurrency(v);try{localStorage.setItem("ta-currency",v)}catch(e){}}
  var CURRENCIES=[{code:"USD",sym:"$",label:"US Dollar"},{code:"EUR",sym:"€",label:"Euro"},{code:"GBP",sym:"£",label:"British Pound"},{code:"NOK",sym:"kr ",label:"Norwegian Krone"},{code:"SEK",sym:"kr ",label:"Swedish Krona"},{code:"DKK",sym:"kr ",label:"Danish Krone"},{code:"CHF",sym:"CHF ",label:"Swiss Franc"},{code:"JPY",sym:"¥",label:"Japanese Yen"},{code:"AUD",sym:"A$",label:"Australian Dollar"},{code:"CAD",sym:"C$",label:"Canadian Dollar"},{code:"SGD",sym:"S$",label:"Singapore Dollar"},{code:"HKD",sym:"HK$",label:"Hong Kong Dollar"}];
  var cSym=(CURRENCIES.find(function(c){return c.code===currency})||CURRENCIES[0]).sym;
  var _rl=useState(function(){try{var s=localStorage.getItem("ta-readinglist");return s?JSON.parse(s):[]}catch(e){return[]}}),readingList=_rl[0],setReadingList=_rl[1];
  function saveRL(next){setReadingList(next);try{localStorage.setItem("ta-readinglist",JSON.stringify(next))}catch(e){}}
  var _an=useState(function(){try{return localStorage.getItem("ta-autonotify")==="true"}catch(e){return false}}),autoNotify=_an[0],setAutoNotify=_an[1];
  var _em=useState(function(){try{return localStorage.getItem("ta-emailnotify")==="true"}catch(e){return false}}),emailNotify=_em[0],setEmailNotify=_em[1];
  var _pr=useState(false),priceLoading=_pr[0],setPriceLoading=_pr[1];
  // ── Quick-Access FAB ──
  var _fabO=useState(false),fabOpen=_fabO[0],setFabOpen=_fabO[1];
  var _fabCfg=useState(function(){try{var s=localStorage.getItem("ta-fab-cfg");return s?JSON.parse(s):["trail","hub","review","add"]}catch(e){return["trail","hub","review","add"]}}),fabCfg=_fabCfg[0],setFabCfg=_fabCfg[1];
  var _fabCust=useState(false),fabCustomize=_fabCust[0],setFabCustomize=_fabCust[1];
  function saveFabCfg(v){setFabCfg(v);try{localStorage.setItem("ta-fab-cfg",JSON.stringify(v))}catch(e){}}
  // ── Command Palette ──
  var _cmd=useState(false),cmdOpen=_cmd[0],setCmdOpen=_cmd[1];
  var _cmdQ=useState(""),cmdQuery=_cmdQ[0],setCmdQuery=_cmdQ[1];
  var _cmdIdx=useState(0),cmdIdx=_cmdIdx[0],setCmdIdx=_cmdIdx[1];
  var cmdInputRef=useRef(null);
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
  function openManage(){if(!stripeCustomerId){setShowUpgrade(true);setUpgradeCtx("manage");return}authFetch("/api/stripe/portal",{method:"POST",body:JSON.stringify({customerId:stripeCustomerId})}).then(function(r){return r.json()}).then(function(d){if(d.url)window.location.href=d.url}).catch(function(e){console.warn("Portal error:",e);setShowUpgrade(true);setUpgradeCtx("manage")})}
  var DEFAULT_DASH={portfolioView:"list",showSummary:true,showPrices:true,showPositions:true,showHeatmap:false,showSectors:false,showDividends:true,showAnalyst:false,showBuyZone:false,showPriceChart:true,showOwnerScore:true,showPreEarnings:true};
  var _ds=useState(function(){try{var s=localStorage.getItem("ta-dashsettings");return s?Object.assign({},DEFAULT_DASH,JSON.parse(s)):DEFAULT_DASH}catch(e){return DEFAULT_DASH}}),dashSet=_ds[0],setDashSet=_ds[1];
  
  var _wr=useState(function(){try{var s=localStorage.getItem('ta-weekly-reviews');return s?JSON.parse(s):[]}catch(e){return[]}}),weeklyReviews=_wr[0],setWeeklyReviews=_wr[1];
  var _streakData=useState(function(){try{var s=localStorage.getItem('ta-streak');return s?JSON.parse(s):{current:0,best:0}}catch(e){return{current:0,best:0}}}),streakData=_streakData[0],setStreakData=_streakData[1];

  var _lib=useState(function(){try{var s=localStorage.getItem('ta-library');return s?JSON.parse(s):{folders:[],items:[]}}catch(e){return{folders:[],items:[]}}}),library=_lib[0],setLibrary=_lib[1];
  function saveLibrary(next){setLibrary(next);try{localStorage.setItem('ta-library',JSON.stringify(next))}catch(e){}}
  var _bn=useState(null),briefNews=_bn[0],setBriefNews=_bn[1];
  var _bnl=useState(false),briefNewsLoading=_bnl[0],setBriefNewsLoading=_bnl[1];
  var _bnp=useState(function(){try{var s=localStorage.getItem('ta-news-prefs');return s?JSON.parse(s):{leadership:true,capital:true,earnings:true,deals:true,product:true,restructuring:true,legal:true,insider:true}}catch(e){return{leadership:true,capital:true,earnings:true,deals:true,product:true,restructuring:true,legal:true,insider:true}}}),briefNewsPrefs=_bnp[0],setBriefNewsPrefs=_bnp[1];
  function saveBriefNewsPrefs(next){setBriefNewsPrefs(next);try{localStorage.setItem('ta-news-prefs',JSON.stringify(next))}catch(e){}}
  var NEWS_CATS=[
    {id:"leadership",label:"Leadership",desc:"CEO, exec changes, board moves",color:"#6ea8fe"},
    {id:"capital",label:"Capital",desc:"Buybacks, dividends, repurchases",color:"#4ade80"},
    {id:"earnings",label:"Earnings",desc:"Results, guidance, beat/miss",color:"#fbbf24"},
    {id:"deals",label:"Deals",desc:"M&A, partnerships, contracts",color:"#8B5CF6"},
    {id:"product",label:"Products",desc:"Launches, FDA, innovation",color:"#06B6D4"},
    {id:"restructuring",label:"Restructuring",desc:"Layoffs, cost cuts, spin-offs",color:"#f87171"},
    {id:"legal",label:"Legal",desc:"SEC, lawsuits, investigations",color:"#fbbf24"},
    {id:"insider",label:"Insider",desc:"Insider buys and sells",color:"#EC4899"}
  ];
  function classifyNews(headline,ticker,companyName){
    var h=headline||"";var hl=h.toLowerCase();var tl=(ticker||"").toLowerCase();
    var nl=(companyName||"").toLowerCase().split(" ")[0]; // first word of company name
    // ── Noise filters: discard these entirely ──────────────────────────────
    var noisePatterns=[
      /\d+\s+(stocks?|companies|shares|etfs?|funds?)\s+(to\s+)?(watch|buy|own|consider|know)/i,
      /best\s+stocks?/i,/top\s+\d+\s+stocks?/i,/stocks?\s+that\s+(could|might|may|will)/i,
      /stock\s+market\s+(today|week|update|wrap|recap|rally|selloff|plunge|surge)/i,
      /market\s+(wrap|update|recap|roundup|briefing|movers|watch)/i,
      /week(ly)?\s+(ahead|preview|roundup)/i,
      /analyst[s']?\s+(price\s+target|rating)\s+(on\s+)?\d+\s+stocks?/i,
      /etf\s+(investors?|holdings?|exposure)/i,
      /here[''']s\s+(why|what|how)\s+.{0,30}(stock|shares?)/i,
      /why\s+(investors?|analysts?)\s+(are|should|may)/i,
      /\d+\s+reasons?\s+(to\s+)?(buy|sell|own|avoid)/i,
      /should\s+you\s+(buy|sell|own)/i,
      /is\s+[\w\s]{2,25}(a\s+)?(good|great|solid)\s+(buy|investment|stock)/i,
      /warren\s+buffett|berkshire\s+hathaway/i, // unless it IS berkshire
      /cathie\s+wood|ark\s+invest/i,
      /hedge\s+fund[s']?\s+(bought|sold|added|trimmed)/i,
      /reddit|wsb|wallstreetbets|retail\s+investor/i,
      /penny\s+stock|meme\s+stock/i,
      /cramer/i
    ];
    for(var ni=0;ni<noisePatterns.length;ni++){if(noisePatterns[ni].test(h))return null}
    // ── Relevance: must be primarily ABOUT this company ────────────────────
    // Check company name or ticker appears in first 80 chars
    var first80=hl.substring(0,80);
    var subjectScore=0;
    if(first80.indexOf(tl)>=0)subjectScore+=3;
    if(nl.length>3&&first80.indexOf(nl)>=0)subjectScore+=2;
    // Hard pass: generic "company X and Y and Z" listicle pattern in headline
    var otherTickers=0;
    var tickerPattern=/\b[A-Z]{2,5}\b/g;var m;
    while((m=tickerPattern.exec(h))!==null){if(m[0]!==ticker&&m[0].length>=2&&m[0]!==m[0].toLowerCase())otherTickers++}
    if(otherTickers>=4)return null; // headline is about many companies, not this one
    if(subjectScore===0&&otherTickers>=2)return null;
    // ── Classify into owner-relevant categories ────────────────────────────
    if(/\bceo\b|chief\s+exec|cfo\b|coo\b|cto\b|board\s+(chair|member|director)|appoints?|names?\s+(new\s+)?(ceo|cfo|president)|steps?\s+down|resign[s]?|succession|executive\s+(hire|depart|exit|change)|leadership/.test(hl))
      return{cat:"leadership",label:"Leadership",color:"#6ea8fe"};
    if(/buyback|share\s+repurchase|repurchase\s+program|return(s|ing)?\s+(capital|cash)\s+to|special\s+dividend|dividend\s+(hike|raise|increase|cut|suspend|initiates?|declar|payout)|distribut/.test(hl))
      return{cat:"capital",label:"Capital",color:"#4ade80"};
    if(/insider\s+(buy|sell|purchas|acquir)|director\s+(buy|purchas|acquir|sell)|officer\s+(sell|buy|purchas|acquir)|form\s+4|13[dg]\b/.test(hl))
      return{cat:"insider",label:"Insider",color:"#EC4899"};
    if(/acqui[sr]|merger|takeover|buyout|acqui[sz]|spinoff|spin.off|divest|sells?\s+(unit|division|business|subsidiary)|strategic\s+(review|alternative)|goes?\s+private/.test(hl))
      return{cat:"deals",label:"M&A",color:"#8B5CF6"};
    if(/partner(s|ship)|agreement|contract\s+(wins?|award|signed?)|joint\s+venture|collaboration|licensing|supply\s+(agreement|deal)|deal\s+with|wins?\s+(contract|bid)/.test(hl))
      return{cat:"deals",label:"Deal",color:"#8B5CF6"};
    if(/layoff|lay.off|cut[s]?\s+job|job[s]?\s+cut|redundanc|restruc|workforce\s+(reduc|cut)|headcount|cost.cutting|cost\s+cut|downsiz|eliminat[es]+\s+(job|position|role)|rif\b/.test(hl))
      return{cat:"restructuring",label:"Restructuring",color:"#f87171"};
    if(/fda\s+(approv|clear|reject|approv)|drug\s+(approv|applic|trial|data)|phase\s+[123]|clinical\s+trial|product\s+launch|launches?\s+(new|its?)|unveil|announc[es]+\s+(new\s+)?(product|platform|service|feature)|new\s+(product|model|version|platform)/.test(hl))
      return{cat:"product",label:"Product",color:"#06B6D4"};
    if(/sec\s+(investigat|charg|subpoena|fine|settl)|class\s+action|lawsuit|litigation|regulat(or|ory)\s+(fine|penalt|action|order|investigat)|antitrust|doj\b|ftc\b|whistleblow|fraud|accounting\s+(irreg|error|restat)/.test(hl))
      return{cat:"legal",label:"Legal",color:"#fbbf24"};
    if(/earnings|quarterly\s+(results?|report)|annual\s+results?|q[1234]\s+(results?|earnings?|revenue)|revenue\s+(beats?|misses?|tops?|falls?|rises?|grew)|guidance\s+(raises?|cuts?|lower|higher|above|below)|beat[s]?\s+(estimate|expectation|consensus)|miss[es]+\s+(estimate|expectation)|outlook\s+(raise|cut|maintain)|reaffirm[s]?\s+guidance/.test(hl))
      return{cat:"earnings",label:"Earnings",color:"#fbbf24"};
    // If it passed noise filters and mentions the company but doesn't fit a category → skip
    // (better to show nothing than generic noise)
    if(subjectScore===0)return null;
    return null}
  async function loadBriefNews(companies){
    if(!companies||companies.length===0)return;
    var tickers=companies.map(function(c){return c.ticker});
    var CACHE_KEY="ta-brief-news";var CACHE_TTL=3600000;
    try{var cached=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");
      var cKey=tickers.slice().sort().join(",");
      if(cached&&cached.ts&&(Date.now()-cached.ts)<CACHE_TTL&&cached.key===cKey){setBriefNews(cached.items);return}}catch(e){}
    setBriefNewsLoading(true);
    try{
      var to=new Date().toISOString().slice(0,10);
      var from=new Date(Date.now()-14*86400000).toISOString().slice(0,10); // 14 days to get enough signal
      var results=await Promise.all(companies.map(function(co){
        return finnhub("company-news?symbol="+co.ticker+"&from="+from+"&to="+to)
          .then(function(news){
            if(!news||!news.length)return[];
            var classified=[];
            news.slice(0,25).forEach(function(n){ // check up to 25, keep best
              var cat=classifyNews(n.headline,co.ticker,co.name);
              if(!cat)return;
              classified.push({ticker:co.ticker,headline:n.headline,url:n.url,source:n.source,datetime:n.datetime,cat:cat.cat,label:cat.label,color:cat.color})});
            return classified})
          .catch(function(){return[]})}));
      var all=[].concat.apply([],results);
      // Deduplicate by normalised headline (first 70 chars, lowercase)
      var seen={};
      var deduped=all.filter(function(n){var key=n.headline.substring(0,70).toLowerCase().replace(/[^a-z0-9]/g,"");if(seen[key])return false;seen[key]=true;return true});
      deduped.sort(function(a,b){return b.datetime-a.datetime});
      var items=deduped.slice(0,40);
      setBriefNews(items);
      try{localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),key:tickers.slice().sort().join(","),items:items}))}catch(e){}
    }catch(e){console.warn("Brief news load error:",e)}
    setBriefNewsLoading(false)}
    function saveReview(rev){setWeeklyReviews(function(p){var n=[rev].concat(p).slice(0,100);try{localStorage.setItem('ta-weekly-reviews',JSON.stringify(n))}catch(e){}
    ;updateStreak(true);
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
  var _goals=useState(function(){try{var s=localStorage.getItem("ta-goals");return s?JSON.parse(s):{targetCAGR:12,horizon:10}}catch(e){return{targetCAGR:12,horizon:10}}}),goals=_goals[0],setGoals=_goals[1];
  function saveGoals(g){setGoals(g);try{localStorage.setItem("ta-goals",JSON.stringify(g))}catch(e){}}
  function saveAssets(fn){setAssets(function(prev){var next=typeof fn==="function"?fn(prev):fn;try{localStorage.setItem('ta-assets',JSON.stringify(next))}catch(e){}return next})}
  function toggleDash(key){setDashSet(function(p){var n=Object.assign({},p);n[key]=!n[key];try{localStorage.setItem("ta-dashsettings",JSON.stringify(n))}catch(e){}return n})}
  var _ob=useState(0),obStep=_ob[0],setObStep=_ob[1];
  var _obPath=useState(""),obPath=_obPath[0],setObPath=_obPath[1];
  // Onboarding form state — kept at parent level so OnboardingFlow re-renders don't wipe it
  var _oTicker=useState(""),oTicker=_oTicker[0],setOTicker=_oTicker[1];
  var _oName=useState(""),oName=_oName[0],setOName=_oName[1];
  var _oSector=useState(""),oSector=_oSector[0],setOSector=_oSector[1];
  var _oLook=useState("idle"),oLook=_oLook[0],setOLook=_oLook[1];
  var _oDomain=useState(""),oDomain=_oDomain[0],setODomain=_oDomain[1];
  var _oIndustry=useState(""),oIndustry=_oIndustry[0],setOIndustry=_oIndustry[1];
  var _oPrice=useState(0),oPrice=_oPrice[0],setOPrice=_oPrice[1];
  var _oStyle=useState(""),oStyle=_oStyle[0],setOStyle=_oStyle[1];
  var _oTCore=useState(""),oTCore=_oTCore[0],setOTCore=_oTCore[1];
  var _oTMoat=useState(""),oTMoat=_oTMoat[0],setOTMoat=_oTMoat[1];
  var _oTRisk=useState(""),oTRisk=_oTRisk[0],setOTRisk=_oTRisk[1];
  var _oTSell=useState(""),oTSell=_oTSell[0],setOTSell=_oTSell[1];
  var _oKpiSel=useState([]),oKpiSel=_oKpiSel[0],setOKpiSel=_oKpiSel[1];
  var _oKpiTargets=useState({}),oKpiTargets=_oKpiTargets[0],setOKpiTargets=_oKpiTargets[1];
  var _oCoId=useState(null),oCoId=_oCoId[0],setOCoId=_oCoId[1];
  var _oTmrRef=useRef(null);
  // Position fields in onboarding
  var _oShares=useState(""),oShares=_oShares[0],setOShares=_oShares[1];
  var _oAvgCost=useState(""),oAvgCost=_oAvgCost[0],setOAvgCost=_oAvgCost[1];
  var _oPurchDate=useState(""),oPurchDate=_oPurchDate[0],setOPurchDate=_oPurchDate[1];
  // Dossier spotlight tour
  var _tourStep=useState(0),tourStep=_tourStep[0],setTourStep=_tourStep[1];
  var _mob=useState(false),isMobile=_mob[0],setIsMobile=_mob[1];
  // Auto-trigger onboarding for brand-new users
  useEffect(function(){
    try{
      if(localStorage.getItem("ta-onboarded"))return;
      var t=setTimeout(function(){
        setCos(function(current){
          if(current.length===0)setObStep(1);
          return current;
        });
      },700);
      return function(){clearTimeout(t)};
    }catch(e){}
  },[]);
  // Responsive: track screen width
  useEffect(function(){
    function onResize(){setIsMobile(window.innerWidth<768);}
    onResize();
    window.addEventListener("resize",onResize);
    return function(){window.removeEventListener("resize",onResize);};
  },[]);
  var _sideOpen=useState(false),sideOpen=_sideOpen[0],setSideOpen=_sideOpen[1];
  var _dashGameExp=useState(function(){try{return localStorage.getItem("ta-dash-game-expanded")==="true"}catch(e){return false}}),dashGameExpanded=_dashGameExp[0],setDashGameExpanded=_dashGameExp[1];
  function toggleDashGame(){var n=!dashGameExpanded;setDashGameExpanded(n);try{localStorage.setItem("ta-dash-game-expanded",n?"true":"false")}catch(e){}}
  var LEVELS=[{min:0,name:"Novice",next:25,icon:"🌱"},{min:25,name:"Apprentice",next:50,icon:"📚"},{min:50,name:"Practitioner",next:70,icon:"🔭"},{min:70,name:"Disciplined",next:85,icon:"⭐"},{min:85,name:"Master",next:100,icon:"🏆"}];
  function getLevel(score){var lv=LEVELS[0];LEVELS.forEach(function(l){if(score>=l.min)lv=l});return lv}
  // Toast system for celebrations
  var _toast=useState(null),toast=_toast[0],setToast=_toast[1];
  function showToast(msg,type,duration){setToast({msg:msg,type:type||"info"});setTimeout(function(){setToast(null)},duration||3000)}
  var _confetti=useState(false),showConfetti=_confetti[0],setConfetti=_confetti[1];
  function launchConfetti(duration){setConfetti(true);setTimeout(function(){setConfetti(false)},duration||3000)}
  function celebrate(msg,type,duration){showToast(msg,type||"levelup",duration||6000);launchConfetti(duration||3000)}
  // Celebration overlay for big moments
  var _celebOverlay=useState(null),celebOverlay=_celebOverlay[0],setCelebOverlay=_celebOverlay[1];
  function showCelebration(title,subtitle,icon,color){setCelebOverlay({title:title,subtitle:subtitle,icon:icon,color:color||K.acc});setTimeout(function(){setCelebOverlay(null)},4500)}
  // Profile panel
  var _showProf=useState(false),showProfile=_showProf[0],setShowProfile=_showProf[1];
  // Track milestones for first-time celebrations
  var _milestones=useState(function(){try{var s=localStorage.getItem('ta-milestones');return s?JSON.parse(s):{}}catch(e){return{}}}),milestones=_milestones[0],setMilestones=_milestones[1];
  function checkMilestone(key,msg){if(!milestones[key]){var nm=Object.assign({},milestones);nm[key]=new Date().toISOString();setMilestones(nm);try{localStorage.setItem('ta-milestones',JSON.stringify(nm))}catch(e){}showToast(msg,"milestone",5000);return true}return false}

  // ── Achievement Badges ──

  useEffect(function(){if(!loaded)return;var payload={cos:cos,notifs:notifs,trial:trial,readingList:readingList,profile:{username:username,avatar:avatarUrl,milestones:milestones,weeklyReviews:weeklyReviews,dashSettings:dashSet,theme:theme}};
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(function(){svS("ta-data",payload)},500);
    if(cloudTimer.current)clearTimeout(cloudTimer.current);
    cloudTimer.current=setTimeout(function(){cloudSave(props.userId,payload)},2000);
    return function(){if(saveTimer.current)clearTimeout(saveTimer.current);if(cloudTimer.current)clearTimeout(cloudTimer.current)}},[cos,notifs,trial,loaded,username,avatarUrl,milestones,weeklyReviews,dashSet,theme,readingList]);
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
  // Auto-populate financialSnapshot for companies that don't have one yet
  useEffect(function(){if(!loaded)return;
    var needSnapshot=cos.filter(function(c){return(!c.financialSnapshot||Object.keys(c.financialSnapshot).length===0)&&c.ticker});
    if(!needSnapshot.length)return;
    var i=0;var tmr2=setInterval(function(){if(i>=needSnapshot.length){clearInterval(tmr2);return}
      var c=needSnapshot[i];i++;
      fetchEarnings(c,c.kpis||[]).then(function(r){if(r&&r.found&&r.snapshot&&Object.keys(r.snapshot).length>0){
        setCos(function(prev){return prev.map(function(x){if(x.id!==c.id)return x;
          // Only set snapshot if still empty (avoid overwriting a manual check)
          if(x.financialSnapshot&&Object.keys(x.financialSnapshot).length>0)return x;
          return Object.assign({},x,{financialSnapshot:r.snapshot,earningSummary:r.summary||x.earningSummary,sourceUrl:r.sourceUrl||x.sourceUrl,sourceLabel:r.sourceLabel||x.sourceLabel})})})}
      }).catch(function(e){console.warn("[ThesisAlpha] Auto-snapshot failed for "+c.ticker+":",e)})
    },1500);// stagger to respect rate limits
    return function(){clearInterval(tmr2)}},[loaded,cos.length]);
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
        return Object.assign({},c,{lastChecked:new Date().toISOString(),earningSummary:stripCite(r.summary||c.earningSummary),sourceUrl:r.sourceUrl||c.sourceUrl,sourceLabel:stripCite(r.sourceLabel||c.sourceLabel||""),earningsHistory:earningsHistory.slice(0,20),financialSnapshot:r.snapshot||c.financialSnapshot||{},latestNews:news.length?news:c.latestNews||[],kpis:c.kpis.map(function(k){var mid=resolveMetricId(k);var m=r.results.find(function(x){return x.kpi_name===mid||x.kpi_name===(k.metricId||k.name)});if(m&&m.actual_value!=null)return Object.assign({},k,{lastResult:{actual:m.actual_value,status:eS(k.rule,k.value,m.actual_value),excerpt:stripCite(m.excerpt||"")}});if(m&&m.status==="unclear")return Object.assign({},k,{lastResult:{actual:null,status:"unclear",excerpt:m.excerpt||"Not available"}});return k})})})});
        setCheckSt(function(p){var n=Object.assign({},p);n[cid]="found";return n});
        // Auto-log earnings review journal entry
        var kpiResults=(r.results||[]);var metCount=kpiResults.filter(function(x){return x.status==="met"}).length;var totalKpis=kpiResults.length;
        logJournalEntry(cid,{cardType:"earnings_review",ticker:co.ticker,quarter:r.quarter||"Latest",summary:stripCite(r.summary||""),kpisMet:metCount,kpisTotal:totalKpis,kpiDetails:kpiResults.map(function(x){return{name:x.kpi_name,actual:x.actual_value,status:x.status}}),priceAtTime:co.position&&co.position.currentPrice?co.position.currentPrice:null,convictionAtTime:co.conviction||0,action:"",trigger:"",thesisImpact:"",userNote:""});
        setNotifs(function(p){return[{id:Date.now(),type:"found",ticker:co.ticker,msg:(r.quarter||"")+" results found",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)});
        var _popKpis=co.kpis.filter(function(k){return k.lastResult&&k.lastResult.actual!=null});
        if(_popKpis.length>0){setModal({type:"earningsPopup",data:{ticker:co.ticker,quarter:r.quarter||"Latest",sourceLabel:r.sourceLabel||"FMP",kpis:_popKpis,summary:r.summary||""}})}else{showToast("\u2713 "+co.ticker+" \u2014 "+r.quarter+" results found","success",4000)}}
      else{setCheckSt(function(p){var n=Object.assign({},p);n[cid]="not-yet";return n})}}
    catch(e){console.warn("checkOne error:",e);setCheckSt(function(p){var n=Object.assign({},p);n[cid]="error";return n})}
    setTimeout(function(){setCheckSt(function(p){var n=Object.assign({},p);delete n[cid];return n})},6000)}
  async function checkAll(){var all=cos.filter(function(c){return c.status==="portfolio"||c.status==="watchlist"});for(var i=0;i<all.length;i++){await checkOne(all[i].id);await new Promise(function(r){setTimeout(r,1200)})}}
  async function refreshPrices(){setPriceLoading(true);
    for(var i=0;i<cos.length;i++){var c=cos[i];try{
      var rP=fetchPrice(c.ticker);var rQ=fetchQuote(c.ticker);
      var r=await rP;var q=await rQ;
      if(r&&r.price){var dayPct=0;var dayAbs=0;
        if(q&&q.changePct!=null){dayPct=q.changePct;dayAbs=q.change}
        else if(r.changesPercentage){dayPct=typeof r.changesPercentage==="string"?parseFloat(r.changesPercentage):r.changesPercentage;dayAbs=r.changes||0}
        upd(c.id,function(prev){return Object.assign({},prev,{position:Object.assign({},prev.position,{currentPrice:r.price}),_dayChange:dayAbs,_dayChangePct:dayPct})});
        if(!c.divPerShare||c.divPerShare===0){
          try{var fhDiv=await fetchDivFromFinnhub(c.ticker,r.lastDiv);
            if(fhDiv&&fhDiv.payer){upd(c.id,function(prev){return Object.assign({},prev,{divPerShare:fhDiv.divPerShare,lastDiv:fhDiv.annualDiv||fhDiv.divPerShare,divFrequency:fhDiv.divFrequency})})}
            else if(fhDiv){upd(c.id,function(prev){return Object.assign({},prev,{divFrequency:"none"})})}}catch(e){}}
      }}catch(e){}
      await new Promise(function(res){setTimeout(res,300)})}setPriceLoading(false)}
  function toggleAutoNotify(){var nv=!autoNotify;setAutoNotify(nv);try{localStorage.setItem("ta-autonotify",String(nv))}catch(e){}
    if(nv){requestPushPermission();
      setNotifs(function(p){return[{id:Date.now(),type:"system",ticker:"",msg:"Auto-notify enabled — earnings will be checked and you'll be notified",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}}
  function toggleEmailNotify(){var nv=!emailNotify;setEmailNotify(nv);try{localStorage.setItem("ta-emailnotify",String(nv))}catch(e){}}

  // ── Modals ─────────────────────────────────────────────────
  function AddModal(){var _f=useState({ticker:"",name:"",sector:"",earningsDate:"",earningsTime:"AMC",domain:"",irUrl:"",thesis:"",status:sideTab==="watchlist"?"watchlist":sideTab==="toohard"?"toohard":"portfolio",investStyle:"",purchaseDate:""}),f=_f[0],setF=_f[1];
    var _ls=useState("idle"),ls=_ls[0],setLs=_ls[1];var _lm=useState(""),lm=_lm[0],setLm=_lm[1];var tmr=useRef(null);
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    async function doLookup(t){setLs("loading");setLm("");try{var r=await lookupTicker(t);
      if(r&&r.error){setLs("error");setLm(r.error)}
      else if(r&&r.name){setF(function(p){return Object.assign({},p,{name:p.name||r.name||"",sector:p.sector||r.sector||"",earningsDate:p.earningsDate||r.earningsDate||"",earningsTime:r.earningsTime||p.earningsTime,domain:p.domain||r.domain||"",irUrl:p.irUrl||r.irUrl||"",_price:r.price||0,_lastDiv:r.lastDiv||0,_divPerShare:r.divPerShare||0,_divFrequency:r.divFrequency||"none",_exDivDate:r.exDivDate||"",_divYield:r.divYield||0,_industry:r.industry||"",_description:r.description||"",_ceo:r.ceo||"",_employees:r.employees||0,_country:r.country||"",_exchange:r.exchange||"",_ipoDate:r.ipoDate||"",_mktCap:r.mktCap||0})});setLs("done");
        var info=["Auto-filled ✓"];if(r.earningsDate&&r.earningsDate!=="TBD")info.push("Earnings: "+r.earningsDate);if(r.price)info.push("$"+r.price.toFixed(2));if(r.divYield>0)info.push("Div: "+r.divYield.toFixed(1)+"% ("+r.divFrequency+")");else if(r.price)info.push("No dividend");setLm(info.join(" · "))}
      else{setLs("error");setLm("Not found")}}catch(e){setLs("error");setLm("Lookup failed — try manually")}}
    function onTicker(v){set("ticker",v);if(tmr.current)clearTimeout(tmr.current);var t=v.toUpperCase().trim();
      if(t.length>=1&&t.length<=6&&/^[A-Za-z.]+$/.test(t)){setLs("idle");tmr.current=setTimeout(function(){doLookup(t)},500)}else{setLs("idle");setLm("")}}
    function submit(){if(!f.ticker.trim()||!f.name.trim())return;if(tmr.current)clearTimeout(tmr.current);
      var nc={id:nId(cos),ticker:f.ticker.toUpperCase().trim(),name:f.name.trim(),sector:f.sector.trim(),industry:f._industry||"",domain:f.domain.trim(),irUrl:f.irUrl.trim(),earningsDate:f.earningsDate||"TBD",earningsTime:f.earningsTime,thesisNote:f.thesis?f.thesis.trim():"",kpis:[],docs:[],earningsHistory:[],researchLinks:[],decisions:[],thesisReviews:[],targetPrice:f._targetPrice?parseFloat(f._targetPrice):0,position:{shares:parseFloat(f._shares)||0,avgCost:parseFloat(f._avgCost)||0,currentPrice:f._price||0},conviction:0,convictionHistory:[],status:f.status||"portfolio",investStyle:f.investStyle||"",tooHardReason:f._tooHardReason||"",parkedAt:f.status==="toohard"?new Date().toISOString().split("T")[0]:"",lastDiv:f._lastDiv||0,divPerShare:f._divPerShare||f._lastDiv||0,divFrequency:f._divFrequency||(f._lastDiv>0?"quarterly":"none"),exDivDate:f._exDivDate||"",_divChecked:true,lastChecked:null,notes:f._watchNote||"",earningSummary:null,sourceUrl:null,sourceLabel:null,moatTypes:{},pricingPower:null,morningstarMoat:"",moatTrend:"",thesisVersions:[],thesisUpdatedAt:"",addedAt:new Date().toISOString(),purchaseDate:f.purchaseDate||"",description:f._description||"",ceo:f._ceo||"",employees:f._employees||0,country:f._country||"",exchange:f._exchange||"",ipoDate:f._ipoDate||"",mktCap:f._mktCap||0};
      setCos(function(p){return p.concat([nc])});setSelId(nc.id);setDetailTab("dossier");if(f.status==="portfolio"){setGuidedSetup(nc.id)};
      // Contrarian badge — added while down 20%+
      var _p=nc.position;if(_p.currentPrice>0&&_p.avgCost>0&&((_p.currentPrice-_p.avgCost)/_p.avgCost)<=-0.2){checkMilestone("contrarian","⚔️ Contrarian move — bought during a 20%+ drawdown!")}
      
      setModal(null)}
    useEffect(function(){return function(){if(tmr.current)clearTimeout(tmr.current)}},[]);
    return<Modal title="Add Company" onClose={function(){if(tmr.current)clearTimeout(tmr.current);setModal(null)}} K={K}>
      <div className="ta-form-row" style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"0 16px"}}><div><Inp label="Ticker" value={f.ticker} onChange={onTicker} placeholder="AAPL" K={K} spellCheck={false} autoCorrect="off" autoComplete="off"/>
        {ls!=="idle"&&<div style={{fontSize:12,color:ls==="loading"?K.dim:ls==="done"?K.grn:K.amb,marginTop:-10,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
          {ls==="loading"&&<span style={{display:"inline-block",width:10,height:10,border:"2px solid "+K.bdr2,borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>}{ls==="loading"?"Looking up…":lm}</div>}</div>
        <Inp label="Company Name" value={f.name} onChange={function(v){set("name",v)}} placeholder="Apple Inc." K={K}/></div>
      <div className="ta-form-3col" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}><Inp label="Sector" value={f.sector} onChange={function(v){set("sector",v)}} placeholder="Technology" K={K}/><Inp label="Earnings Date" value={f.earningsDate} onChange={function(v){set("earningsDate",v)}} type="date" K={K}/><Sel label="Timing" value={f.earningsTime} onChange={function(v){set("earningsTime",v)}} options={[{v:"BMO",l:"Before Open"},{v:"AMC",l:"After Close"}]} K={K}/></div>
      <Sel label="Add to" value={f.status} onChange={function(v){set("status",v)}} options={[{v:"portfolio",l:"Portfolio (I own this)"},{v:"watchlist",l:"Watchlist (Researching)"},{v:"toohard",l:"Too Hard (Outside circle)"}]} K={K}/>
      {f.status==="toohard"&&<Inp label="Why is this too hard? (optional)" value={f._tooHardReason||""} onChange={function(v){set("_tooHardReason",v)}} placeholder="e.g. Requires pharma expertise I don't have. Revisit in 12 months." K={K}/>}
      {f.status==="portfolio"&&<Inp label="Investment Thesis" value={f.thesis} onChange={function(v){set("thesis",v)}} ta placeholder="Why do you own this?" K={K}/>}
      {f.status==="portfolio"&&<div style={{marginBottom:16}}>
        <div style={{fontSize:12,color:K.dim,marginBottom:8,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Investment Style</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {INVEST_STYLES.map(function(st){var isSel=f.investStyle===st.id;return<button key={st.id} onClick={function(){set("investStyle",isSel?"":st.id)}} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:6,border:"1px solid "+(isSel?st.color+"60":K.bdr),background:isSel?st.color+"15":"transparent",color:isSel?st.color:K.mid,fontSize:12,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400,transition:"all .15s"}}>
            <IC name={st.icon} size={10} color={isSel?st.color:K.dim}/>{st.label}</button>})}</div>
        {f.investStyle&&STYLE_MAP[f.investStyle]&&<div style={{fontSize:11,color:K.dim,marginTop:6,lineHeight:1.4}}>{STYLE_MAP[f.investStyle].desc}</div>}
      </div>}
      {f.status==="portfolio"&&<Inp label="Purchase Date *" value={f.purchaseDate} onChange={function(v){set("purchaseDate",v)}} type="date" K={K}/>}
      {f.status==="portfolio"&&!f.purchaseDate&&<div style={{fontSize:11,color:K.amb,marginTop:-8,marginBottom:8}}>When did you first buy this? Helps track your ownership timeline.</div>}
      {f.status==="portfolio"&&<div className="ta-form-row" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Shares" value={f._shares||""} onChange={function(v){set("_shares",v)}} type="number" placeholder="0" K={K}/><Inp label="Avg Cost per Share" value={f._avgCost||""} onChange={function(v){set("_avgCost",v)}} type="number" placeholder="0.00" K={K}/></div>}
      {f.status==="watchlist"&&<div className="ta-form-row" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Target Price" value={f._targetPrice||""} onChange={function(v){set("_targetPrice",v)}} type="number" placeholder="0.00" K={K}/><div style={{fontSize:11,color:K.dim,marginTop:24,lineHeight:1.5}}>Get notified when the stock reaches your target buy price.</div></div>}
      {f.status==="watchlist"&&<Inp label="Why are you watching?" value={f._watchNote||""} onChange={function(v){set("_watchNote",v)}} ta placeholder="What are you waiting for? Earnings, valuation, catalyst..." K={K}/>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}><button style={S.btn} onClick={function(){if(tmr.current)clearTimeout(tmr.current);setModal(null)}}>Cancel</button>
        <button style={Object.assign({},S.btnP,{opacity:f.ticker.trim()&&f.name.trim()&&(f.status!=="portfolio"||f.purchaseDate)?1:.4})} onClick={submit} disabled={!f.ticker.trim()||!f.name.trim()||(f.status==="portfolio"&&!f.purchaseDate)}>{f.status==="watchlist"?"Add to Watchlist":f.status==="toohard"?"Add to Too Hard":"Add Company"}</button></div></Modal>}
  function EditModal(){if(!sel)return null;var _f=useState({ticker:sel.ticker,name:sel.name,sector:sel.sector,earningsDate:sel.earningsDate==="TBD"?"":sel.earningsDate,earningsTime:sel.earningsTime,domain:sel.domain||"",irUrl:sel.irUrl||"",investStyle:sel.investStyle||""}),f=_f[0],setF=_f[1];var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    return<Modal title="Edit Company" onClose={function(){setModal(null)}} K={K}>
      <div className="ta-form-row" style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"0 16px"}}><Inp label="Ticker" value={f.ticker} onChange={function(v){set("ticker",v)}} K={K}/><Inp label="Name" value={f.name} onChange={function(v){set("name",v)}} K={K}/></div>
      <div className="ta-form-3col" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}><Inp label="Sector" value={f.sector} onChange={function(v){set("sector",v)}} K={K}/><Inp label="Earnings Date" value={f.earningsDate} onChange={function(v){set("earningsDate",v)}} type="date" K={K}/><Sel label="Timing" value={f.earningsTime} onChange={function(v){set("earningsTime",v)}} options={[{v:"BMO",l:"Before Open"},{v:"AMC",l:"After Close"},{v:"TBD",l:"TBD"}]} K={K}/></div>
      <Inp label="Logo Domain" value={f.domain} onChange={function(v){set("domain",v)}} placeholder="apple.com" K={K}/>
      <Inp label="IR URL" value={f.irUrl} onChange={function(v){set("irUrl",v)}} placeholder="https://investor.apple.com" K={K}/>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:12,color:K.dim,marginBottom:8,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Investment Style</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {INVEST_STYLES.map(function(st){var isSel=f.investStyle===st.id;return<button key={st.id} onClick={function(){set("investStyle",isSel?"":st.id)}} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:6,border:"1px solid "+(isSel?st.color+"60":K.bdr),background:isSel?st.color+"15":"transparent",color:isSel?st.color:K.mid,fontSize:12,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400,transition:"all .15s"}}>
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
    var sid=sel.investStyle||"default";
    // ── Sharp thinking questions per section per style ──────────
    var Q={
      core:{
        quality:"If someone bet you $1,000 this business earns less in 5 years than today, what\'s your counter-argument?",
        growth:"What\'s the TAM, and why does "+sel.ticker+" capture meaningful share rather than a better-capitalised competitor?",
        prerev:"What\'s the specific catalyst, and what\'s your evidence it happens within your expected timeframe?",
        dividend:"Why will this dividend still be growing in 10 years? What sustains the underlying cash generation?",
        garp:"Is the earnings growth rate above the P/E multiple? If not, what specifically justifies the premium?",
        value:"What does the market think this is worth — and what do they know that you disagree with?",
        turnaround:"What specifically is broken, who is fixing it, and what\'s the concrete evidence the fix is already working?",
        d:"If a smart investor took the other side of your trade on "+sel.ticker+", what would their best argument be? Now refute it."
      },
      moat:{
        quality:"Which moat type applies — switching costs, network effects, brand, cost advantage, or regulatory? Give one specific piece of evidence, not assertion.",
        growth:"Why does scale make this business harder to compete with over time, not easier? What compounds the advantage?",
        prerev:"What first-mover advantage exists that a fast-follower with 10x the funding couldn\'t replicate in 3 years?",
        dividend:"What prevents a lower-cost competitor from undercutting this business and forcing management to choose between the dividend and survival?",
        garp:"What\'s the specific mechanism that protects margins as competitors close the product gap?",
        value:"Is there hidden value — real assets, franchise value, earnings power — that the current price ignores? Be precise.",
        turnaround:"What underlying franchise survives the current problems? Why does this business have a right to exist after the fix?",
        d:"If a well-funded competitor entered this market tomorrow, what would take them the longest to replicate?"
      },
      risks:{
        quality:"What would have to be true for this moat to be weaker than you think? What\'s the highest-probability way you\'re wrong?",
        growth:"What slows the growth rate faster than expected — competition, market saturation, or customer churn? Rank the risks.",
        prerev:"If the lead catalyst fails, is there anything left? Name the binary risk and your rough probability it doesn\'t go your way.",
        dividend:"What specifically breaks the dividend — payout ratio creep, debt refinancing, earnings cyclicality? Which is most likely?",
        garp:"If the market re-rates this at a lower multiple, how long does it take for earnings growth to earn your money back?",
        value:"Why is this cheap? Be honest — is it a value trap or a market mistake? What\'s your evidence for which it is?",
        turnaround:"What\'s the realistic worst case if the turnaround takes twice as long as expected? Can you hold through it financially and emotionally?",
        d:"What\'s the one development that, if it happened, would make you admit you were wrong about this company?"
      },
      sell:{
        quality:"At what valuation does this become too expensive even for a great business? Set a ceiling — P/E, EV/EBIT, or price-to-FCF.",
        growth:"What growth deceleration signals the thesis is broken vs. a temporary blip? Name the metric and the threshold.",
        prerev:"What catalyst failure or timeline slip is the point of no return? Be specific — not \'if things look bad.\'",
        dividend:"At what payout ratio, dividend cut, or earnings miss is the income thesis broken?",
        garp:"At what P/E or PEG does this no longer qualify as \'reasonable\' for the growth rate you\'re betting on?",
        value:"At what price have you been proven right and should take profits? Set the number now, not when it\'s happening.",
        turnaround:"What timeline are you giving this? What would prove the turnaround is dead vs. just slow?",
        d:"Define 2-3 specific, measurable conditions that would make you sell. Not \'if things get bad\' — exact numbers."
      }
    };
    var getQ=function(sec){return Q[sec][sid]||Q[sec].d};
    // ── Auto-seed sell section from KPIs if blank ───────────────
    var kpiSeed=(function(){
      var kpis=sel.kpis||[];if(kpis.length===0)return null;
      var lines=kpis.map(function(k){
        var res=k.lastResult;var missed=res&&res.status==="missed";
        return"— "+k.name+" misses "+k.target+(missed?" (currently missing)":"")+" for 2 consecutive quarters"});
      return lines.join("\n")})();
    var sections=[
      {key:"core",label:"Why I Own It",icon:"lightbulb",color:K.acc},
      {key:"moat",label:"Competitive Moat",icon:"castle",color:K.grn},
      {key:"risks",label:"Key Risks",icon:"alert",color:K.amb},
      {key:"sell",label:"What Would Make Me Sell",icon:"target",color:K.red}];
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
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:qualityColor,fontFamily:fm}}>{filled}/4</div></div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:qualityColor}}>{qualityLabel}</div>
          <div style={{fontSize:11,color:K.dim}}>{totalWords} words · {filled} of 4 sections filled{sty?" · "+sty.label:""}</div></div>
        <div style={{display:"flex",gap:4}}>
          {sections.map(function(s){var done=f[s.key]&&f[s.key].trim().length>15;
            return<div key={s.key} style={{width:20,height:20,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",background:done?s.color+"15":"transparent",border:"1px solid "+(done?s.color+"30":K.bdr)}} title={s.label}>
              {done?<IC name="check" size={10} color={s.color}/>:<IC name={s.icon} size={9} color={K.dim}/>}</div>})}</div></div>
      <div style={{fontSize:13,color:K.dim,marginBottom:16,lineHeight:1.6,fontStyle:"italic"}}>{"\u201cIf you can\u2019t state the argument against your position, you don\u2019t understand it well enough.\u201d — Munger"}</div>
      {sections.map(function(sec){var wordCount=(f[sec.key]||"").trim().split(/\s+/).filter(function(w){return w}).length;var done=f[sec.key]&&f[sec.key].trim().length>15;
        var showSeed=sec.key==="sell"&&!f.sell&&kpiSeed;
        return<div key={sec.key} style={{marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:done?sec.color:K.mid,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600,flex:1}}>
          {done?<IC name="check" size={11} color={sec.color}/>:<IC name={sec.icon} size={12} color={K.dim}/>}{sec.label}
          {wordCount>0&&<span style={{fontSize:10,color:K.dim,fontWeight:400,textTransform:"none",letterSpacing:0,marginLeft:"auto"}}>{wordCount}w</span>}</label></div>
        {!done&&<div style={{fontSize:12,color:K.dim,fontStyle:"italic",marginBottom:6,lineHeight:1.5,paddingLeft:2}}>{getQ(sec.key)}</div>}
        {showSeed&&<div style={{marginBottom:8,padding:"10px 14px",background:K.red+"08",border:"1px solid "+K.red+"20",borderRadius:8}}>
          <div style={{fontSize:11,color:K.red,fontFamily:fm,fontWeight:600,marginBottom:5,letterSpacing:.3}}>KPI THRESHOLDS — USE AS A STARTING POINT</div>
          <pre style={{fontSize:12,color:K.mid,fontFamily:fb,margin:0,whiteSpace:"pre-wrap",lineHeight:1.6}}>{kpiSeed}</pre>
          <button onClick={function(){set("sell",kpiSeed)}} style={{marginTop:8,background:"none",border:"1px solid "+K.red+"30",borderRadius:4,padding:"3px 10px",fontSize:11,color:K.red,cursor:"pointer",fontFamily:fm}}>Paste into section</button>
        </div>}
        <textarea value={f[sec.key]} onChange={function(e){set(sec.key,e.target.value)}} placeholder={"Write here..."} rows={sec.key==="core"?4:3} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+(done?sec.color+"30":K.bdr),borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:14,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6,transition:"border-color .2s"}}/></div>})}
      {sel.thesisVersions&&sel.thesisVersions.length>0&&<div style={{borderTop:"1px solid "+K.bdr,paddingTop:12,marginTop:8,marginBottom:8}}>
        <div style={{fontSize:11,color:K.dim,letterSpacing:1,textTransform:"uppercase",fontFamily:fm,marginBottom:8}}>Version History ({sel.thesisVersions.length} snapshots)</div>
        <div style={{maxHeight:100,overflowY:"auto"}}>{sel.thesisVersions.slice().reverse().slice(0,8).map(function(v,i){
          return<div key={i} style={{fontSize:12,color:K.mid,marginBottom:4,paddingLeft:8,borderLeft:"2px solid "+K.bdr}}>
          <span style={{fontFamily:fm,color:K.dim,fontSize:11}}>{v.date}</span> {"—"} {v.summary||"Updated"}</div>})}</div></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
        {isChanged&&<div style={{fontSize:11,color:K.acc,fontFamily:fm}}>Unsaved changes</div>}
        {!isChanged&&<div/>}
        <div style={{display:"flex",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:isChanged?1:.4})} onClick={function(){if(!isChanged){setModal(null);return}var newNote=joinThesis(f);var versions=(sel.thesisVersions||[]).slice();if(newNote.trim()&&newNote!==sel.thesisNote){versions.push({date:new Date().toISOString().split("T")[0],summary:f.core?f.core.substring(0,80):"Updated thesis"})}upd(selId,{thesisNote:newNote,thesisVersions:versions.slice(-30),thesisUpdatedAt:new Date().toISOString()});
              // Auto-log thesis snapshot
              logJournalEntry(selId,{cardType:"thesis_snapshot",ticker:sel.ticker,version:versions.length+1,sectionsFilled:filled,core:f.core?f.core.substring(0,120):"",hasMoat:!!f.moat,hasRisks:!!f.risks,hasSell:!!f.sell,isNew:!sel.thesisNote||sel.thesisNote.trim().length<20});if(filled===4){checkMilestone("thesis4","✨ Complete thesis! All 4 sections written.")}else{var allMet=kpiResults.every(function(x){return x.status==="met"});var allMiss=kpiResults.every(function(x){return x.status!=="met"});
        var numMissed=kpiResults.filter(function(x){return x.status==="missed"}).length;
        if(totalKpis>0&&numMissed>0&&!allMet){showToast(co.ticker+": "+numMissed+" KPI"+(numMissed>1?"s":"")+" missed — review the thesis?","warn",5000)}
        if(totalKpis>0&&allMet){launchConfetti(3000);showCelebration(co.ticker+" KPIs: All Met!","Every metric hit its target. Your thesis is being confirmed by the numbers.",null,K.grn)}
        else if(totalKpis>0&&allMiss){showToast(co.ticker+" KPIs need attention - "+metCount+"/"+totalKpis+" met. Review your thesis.","info",6000)}
        else{showToast(co.ticker+" earnings checked - "+metCount+"/"+totalKpis+" KPIs met","info",4000)}};if(sel.kpis.length===0)setTimeout(function(){showToast("Next step: define 2-3 KPIs that prove your thesis → click + Add under Key Metrics","info",5000)},1500);setModal(null)}}>Save & Snapshot</button></div></div></Modal>}
  function KpiModal(){if(!sel)return null;var kid=modal.data;var ex=kid?sel.kpis.find(function(k){return k.id===kid}):null;
    var _f=useState({metricId:ex?ex.metricId||"":"",rule:ex?ex.rule:"gte",value:ex?String(ex.value):"",period:ex?ex.period:""}),f=_f[0],setF=_f[1];
    var _kpiS=useState(""),kpiSearch=_kpiS[0],setKpiSearch=_kpiS[1];var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    var _added=useState([]),added=_added[0],setAdded=_added[1];
    // Filter out already-tracked metrics AND just-added ones
    var used=sel.kpis.map(function(k){return k.metricId}).concat(added.map(function(a){return a.metricId}));
    var avail=METRICS.filter(function(m){return(!used.includes(m.id)||m.id===(ex&&ex.metricId))&&(!kpiSearch||m.label.toLowerCase().indexOf(kpiSearch.toLowerCase())>=0||m.cat.toLowerCase().indexOf(kpiSearch.toLowerCase())>=0||m.id.toLowerCase().indexOf(kpiSearch.toLowerCase())>=0)});
    var sty=STYLE_MAP[sel.investStyle];var recIds=sty?sty.kpis:[];
    var cats={};avail.forEach(function(m){if(!cats[m.cat])cats[m.cat]=[];cats[m.cat].push(m)});
    var selMet=f.metricId?METRIC_MAP[f.metricId]:null;
    function addOne(){if(!f.metricId||isNaN(parseFloat(f.value)))return;var met=METRIC_MAP[f.metricId];var nv=parseFloat(f.value);
      var kd={metricId:f.metricId,name:met.label,rule:f.rule,value:nv,unit:met.unit,period:f.period.trim(),target:bT(f.rule,nv,met.unit),notes:""};
      setAdded(function(p){return p.concat([kd])});setF({metricId:"",rule:"gte",value:"",period:f.period});setKpiSearch("")}
    function doSave(){
      if(f.metricId&&!isNaN(parseFloat(f.value))){var met=METRIC_MAP[f.metricId];var nv=parseFloat(f.value);
        var kd={metricId:f.metricId,name:met.label,rule:f.rule,value:nv,unit:met.unit,period:f.period.trim(),target:bT(f.rule,nv,met.unit),notes:""};
        added=added.concat([kd])}
      if(ex){var met2=METRIC_MAP[f.metricId];var nv2=parseFloat(f.value);var kd2={metricId:f.metricId,name:met2.label,rule:f.rule,value:nv2,unit:met2.unit,period:f.period.trim(),target:bT(f.rule,nv2,met2.unit),notes:""};
        upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.map(function(k){return k.id===kid?Object.assign({},k,kd2):k})})})
      } else if(added.length>0){
        upd(selId,function(c){var newKpis=c.kpis;added.forEach(function(kd3){newKpis=newKpis.concat([Object.assign({id:nId(newKpis),lastResult:null},kd3)])});
          if(c.kpis.length===0&&newKpis.length>=1)setTimeout(function(){checkMilestone("first_kpi",""+String.fromCodePoint(0x1F3AF)+" First KPI tracked! You're measuring what matters.")},300);
          ;
          if(!c.conviction||c.conviction===0)setTimeout(function(){showToast("Nice! Now rate your conviction 1-10 → click the Conviction card","info",5000)},2000);
          return Object.assign({},c,{kpis:newKpis})})}
      setModal(null)}
    return<Modal title={ex?"Edit Metric":"Track Metric"} onClose={function(){setModal(null)}} w={520} K={K}>
      {/* Metric picker with search */}
      {!ex&&<div style={{marginBottom:20}}>
        <input value={kpiSearch} onChange={function(e){setKpiSearch(e.target.value)}} placeholder="Search metrics..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"10px 14px",fontSize:14,fontFamily:fm,outline:"none",marginBottom:12}}/>
        <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:10,fontFamily:fm}}>Choose Metric{sty?" • "+sty.label+" recommendations highlighted":""}</div>
        {sty&&recIds.length>0&&<div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:sty.color,marginBottom:6,fontFamily:fm}}>Recommended for {sty.label}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {recIds.map(function(rid){var m=METRIC_MAP[rid];if(!m||used.includes(m.id))return null;var isSel=f.metricId===m.id;
              return<button key={m.id} onClick={function(){set("metricId",m.id)}} style={{background:isSel?sty.color+"20":sty.color+"08",border:"1px solid "+(isSel?sty.color:sty.color+"40"),borderRadius:6,padding:"6px 12px",fontSize:12,color:isSel?sty.color:K.txt,cursor:"pointer",fontFamily:fm,fontWeight:600}}>{m.label}</button>}).filter(Boolean)}</div></div>}
        <div style={{maxHeight:280,overflowY:"auto"}}>{Object.keys(cats).map(function(cat){return<div key={cat} style={{marginBottom:10}}>
          <div style={{fontSize:11,color:K.dim,marginBottom:6,fontFamily:fm}}>{cat}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {cats[cat].map(function(m){var isSel=f.metricId===m.id;var isRec=recIds.includes(m.id);
              return<button key={m.id} onClick={function(){set("metricId",m.id);if(!f.value&&m.unit==="%")set("value","");setKpiSearch("")}} style={{background:isSel?K.acc+"20":K.bg,border:"1px solid "+(isSel?K.acc:isRec&&sty?sty.color+"40":K.bdr),borderRadius:6,padding:"5px 10px",fontSize:11,color:isSel?K.acc:K.mid,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400}}>{m.label}</button>})}</div></div>})}</div></div>}
      {!ex&&!f.metricId&&kpiSearch&&avail.length===0&&<div style={{textAlign:"center",padding:"16px",color:K.dim}}>
        <div style={{fontSize:13,marginBottom:8}}>No matching metrics found</div>
        <button onClick={function(){set("metricId","custom_"+kpiSearch.toLowerCase().replace(/[^a-z0-9]/g,"_"))}} style={Object.assign({},S.btn,{fontSize:12})}>Create custom: "{kpiSearch}"</button></div>}
            {ex&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:14,fontWeight:500,color:K.txt}}>{selMet?selMet.label:ex.name}</div><div style={{fontSize:12,color:K.dim}}>{selMet?selMet.cat:""}</div></div>}
      {f.metricId&&<div>
        <div className="ta-form-3col" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
          <Sel label="Rule" value={f.rule} onChange={function(v){set("rule",v)}} options={[{v:"gte",l:"≥ At least"},{v:"lte",l:"≤ At most"},{v:"eq",l:"= Exactly"}]} K={K}/>
          <Inp label={"Target"+(selMet?" ("+selMet.unit+")":"")} value={f.value} onChange={function(v){set("value",v)}} type="number" placeholder={selMet&&selMet.unit==="%"?"e.g. 20":"e.g. 5"} K={K}/>
          <Inp label="Period (optional)" value={f.period} onChange={function(v){set("period",v)}} placeholder="Q4 2025" K={K}/></div>
        <div style={{fontSize:12,color:K.dim,marginTop:4,marginBottom:12}}>Auto-fetched from Finnhub when you click Check Earnings</div></div>}
      {/* Queued KPIs */}
      {!ex&&added.length>0&&<div style={{background:K.grn+"08",border:"1px solid "+K.grn+"20",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
        <div style={{fontSize:11,color:K.grn,fontFamily:fm,fontWeight:600,marginBottom:6}}>{added.length} KPI{added.length>1?"s":""} queued</div>
        {added.map(function(a,i){return<div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:K.mid,padding:"2px 0"}}>
          <span style={{color:K.grn}}>{"✓"}</span><span style={{fontWeight:600}}>{a.name}</span><span style={{color:K.dim}}>{a.target}</span>
          <button onClick={function(){setAdded(function(p){return p.filter(function(_,j){return j!==i})})}} style={{background:"none",border:"none",color:K.dim,fontSize:11,cursor:"pointer",marginLeft:"auto"}}>{"✕"}</button></div>})}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        {ex&&<button style={S.btnD} onClick={function(){upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.filter(function(k){return k.id!==kid})})});setModal(null)}}>Delete</button>}
        <div style={{flex:1}}/>
        <button style={S.btn} onClick={function(){setModal(null)}}>{added.length>0&&!f.metricId?"Cancel":"Cancel"}</button>
        {!ex&&f.metricId&&f.value&&<button style={Object.assign({},S.btn,{color:K.acc,borderColor:K.acc+"40"})} onClick={addOne}>+ Add Another</button>}
        <button style={Object.assign({},S.btnP,{opacity:(f.metricId&&f.value)||added.length>0?1:.4})} onClick={doSave} disabled={!f.metricId&&added.length===0&&!f.value}>{ex?"Save":added.length>0?(f.metricId&&f.value?"Save "+(added.length+1)+" KPIs":"Save "+added.length+" KPI"+(added.length>1?"s":"")):"Save"}</button></div></Modal>}
  function ResultModal(){if(!sel)return null;var kpi=sel.kpis.find(function(k){return k.id===modal.data});if(!kpi)return null;
    var _a=useState(kpi.lastResult?String(kpi.lastResult.actual):""),a=_a[0],setA=_a[1];var _ex=useState(kpi.lastResult?kpi.lastResult.excerpt||"":""),ex=_ex[0],setEx=_ex[1];var pv=a?eS(kpi.rule,kpi.value,a):null;
    return<Modal title="Enter Result" onClose={function(){setModal(null)}} w={440} K={K}><div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"14px 18px",marginBottom:20}}><div style={{fontSize:14,color:K.txt}}>{kpi.name}</div><div style={{fontSize:13,color:K.dim}}>Target: {kpi.target}</div></div>
      <Inp label="Actual Value" value={a} onChange={setA} type="number" K={K}/>
      {pv&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"8px 12px",borderRadius:6,background:pv==="met"?"#22C55E10":"#EF444410"}}><div style={S.dot(pv)}/><span style={{fontSize:13,color:pv==="met"?"#22C55E":"#EF4444",fontWeight:500,fontFamily:fm}}>{pv.toUpperCase()}</span></div>}
      <Inp label="Evidence" value={ex} onChange={setEx} ta placeholder="Source..." K={K}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}>{kpi.lastResult&&<button style={S.btnD} onClick={function(){upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.map(function(k){return k.id===modal.data?Object.assign({},k,{lastResult:null}):k})})});setModal(null)}}>Clear</button>}<div style={{flex:1}}/><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:a?1:.4})} onClick={function(){if(!a)return;upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.map(function(k){return k.id===modal.data?Object.assign({},k,{lastResult:{actual:parseFloat(a),status:eS(kpi.rule,kpi.value,a),excerpt:ex.trim()}}):k})})});setModal(null)}}>Save</button></div></Modal>}
  function DelModal(){if(!sel)return null;return<Modal title="Delete Company" onClose={function(){setModal(null)}} w={380} K={K}><p style={{fontSize:14,color:K.mid,marginTop:0}}>Delete <strong style={{color:K.txt}}>{sel.ticker}</strong> and all data?</p><div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:16}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnD} onClick={function(){delCo(selId)}}>Delete</button></div></Modal>}
  function DocModal(){if(!sel)return null;var did=modal.data;var ex=did?sel.docs.find(function(d){return d.id===did}):null;
    var _f=useState({title:ex?ex.title:"",content:ex?ex.content:"",folder:ex?ex.folder:"notes"}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    function doSave(){if(!f.title.trim())return;var doc={title:f.title.trim(),content:f.content,folder:f.folder,updatedAt:new Date().toISOString()};
      if(ex){upd(selId,function(c){return Object.assign({},c,{docs:c.docs.map(function(d){return d.id===did?Object.assign({},d,doc):d})})})}
      else{upd(selId,function(c){return Object.assign({},c,{docs:c.docs.concat([Object.assign({id:nId(c.docs)},doc)])})})}setModal(null)}
    return<Modal title={ex?"Edit Note":"New Note"} onClose={function(){setModal(null)}} w={560} K={K}>
      <Inp label="Title" value={f.title} onChange={function(v){set("title",v)}} placeholder="e.g. Q4 2025 Earnings Analysis" K={K}/>
      <Sel label="Save to Folder" value={f.folder} onChange={function(v){set("folder",v)}} options={FOLDERS.map(function(fo){return{v:fo.id,l:fo.label}})} K={K}/>
      <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:K.dim,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>Content</label>
        <textarea value={f.content} onChange={function(e){set("content",e.target.value)}} rows={10} placeholder="Write your analysis, notes, or paste external research..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"14px",fontSize:14,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.7}}/></div>
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
      ;showToast("\u2713 Investment memo saved for "+c2.ticker,"info",3000);setModal(null)}
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
        <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:10}}>SNAPSHOT (auto-filled)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>PRICE</div><div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>{pos.currentPrice?cSym+pos.currentPrice:"—"}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>CONVICTION</div><div style={{fontSize:16,fontWeight:700,color:c2.conviction>=7?K.grn:c2.conviction>=4?K.amb:K.red,fontFamily:fm}}>{c2.conviction||"—"}/10</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>KPIs</div><div style={{fontSize:14,fontWeight:600,color:h2.c,fontFamily:fm}}>{h2.l}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>MOAT</div><div style={{fontSize:14,fontWeight:600,color:activeMoats.length>0?K.grn:K.dim,fontFamily:fm}}>{activeMoats.length>0?activeMoats.length+" types":"—"}</div></div></div>
        {sec2.core&&<div style={{marginTop:10,padding:"8px 12px",background:K.card,borderLeft:"3px solid "+K.acc,borderRadius:"0 6px 6px 0",fontSize:12,color:K.mid,fontStyle:"italic",lineHeight:1.5}}>{sec2.core.substring(0,150)}{sec2.core.length>150?"...":""}</div>}
      </div>
      {/* Structured prompts */}
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>WHY NOW? <span style={{fontWeight:400,color:K.dim}}>— What’s the catalyst or timing argument?</span></label>
        <textarea value={f.whyNow} onChange={function(e){set("whyNow",e.target.value)}} rows={3} placeholder="Recent earnings beat, sector rotation, valuation reset, management change..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>VALUATION <span style={{fontWeight:400,color:K.dim}}>— Your work on what it’s worth</span></label>
        <textarea value={f.valuation} onChange={function(e){set("valuation",e.target.value)}} rows={3} placeholder="P/E vs peers, DCF assumptions, historical range, margin of safety..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>POSITION SIZING <span style={{fontWeight:400,color:K.dim}}>— Why this allocation?</span></label>
        <textarea value={f.sizing} onChange={function(e){set("sizing",e.target.value)}} rows={2} placeholder="Portfolio weight, concentration risk, how this fits..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:K.red,marginBottom:4,fontFamily:fm}}>RISKS I’M WATCHING <span style={{fontWeight:400,color:K.dim}}>— Beyond thesis risks</span></label>
        <textarea value={f.risksWatching} onChange={function(e){set("risksWatching",e.target.value)}} rows={2} placeholder="What specifically keeps you up at night?" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.red+"20",borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:18}}><label style={{display:"block",fontSize:12,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>12-MONTH OUTLOOK <span style={{fontWeight:400,color:K.dim}}>— What do you expect to happen?</span></label>
        <textarea value={f.outlook} onChange={function(e){set("outlook",e.target.value)}} rows={2} placeholder="Revenue trajectory, catalysts, bear vs bull case..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
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
      ;showToast("\u2713 Research clipped for "+c2.ticker,"info",3000);setModal(null)}
    return<Modal title={"Clip Research — "+c2.ticker} onClose={function(){setModal(null)}} w={520} K={K}>
      <div style={{display:"flex",gap:12,marginBottom:14}}>
        <div style={{width:40,height:40,borderRadius:10,background:K.blue+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><IC name="link" size={18} color={K.blue}/></div>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:K.txt}}>Save research for {c2.ticker}</div>
          <div style={{fontSize:12,color:K.dim}}>Clip an article, report, or podcast with your takeaway</div></div></div>
      <Inp label="URL (optional)" value={f.url} onChange={function(v){set("url",v)}} placeholder="https://..." K={K}/>
      <Inp label="Title / Headline *" value={f.title} onChange={function(v){set("title",v)}} placeholder="e.g. NVIDIA's CUDA Moat Is Deeper Than You Think" K={K}/>
      <Inp label="Source" value={f.source} onChange={function(v){set("source",v)}} placeholder="e.g. Fabricated Intelligence, Company 10-K, Podcast" K={K}/>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>MY TAKEAWAY <span style={{fontWeight:400,color:K.dim}}>— What did you learn?</span></label>
        <textarea value={f.takeaway} onChange={function(e){set("takeaway",e.target.value)}} rows={3} placeholder="The key insight and how it affects your thesis..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
      <div style={{marginBottom:18}}><label style={{display:"block",fontSize:12,fontWeight:600,color:K.txt,marginBottom:6,fontFamily:fm}}>THESIS IMPACT</label>
        <div style={{display:"flex",gap:6}}>
          {[{v:"strengthened",l:"Strengthened",c:K.grn},{v:"unchanged",l:"Unchanged",c:K.dim},{v:"weakened",l:"Weakened",c:K.red}].map(function(opt){return<button key={opt.v} onClick={function(){set("thesisImpact",opt.v)}} style={{flex:1,padding:"8px 12px",borderRadius:6,border:"1px solid "+(f.thesisImpact===opt.v?opt.c+"50":K.bdr),background:f.thesisImpact===opt.v?opt.c+"12":"transparent",color:f.thesisImpact===opt.v?opt.c:K.dim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{opt.l}</button>})}</div></div>
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
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>YOUR NOTES <span style={{fontWeight:400,color:K.dim}}>— Key takeaways from this document</span></label>
        <textarea value={f.notes} onChange={function(e){set("notes",e.target.value)}} rows={3} placeholder="Management guided for... Key metric change was... Watch for..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
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
          <div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>COST BASIS</div><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{cSym}{(parseFloat(f.shares)*parseFloat(f.avgCost)).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
          <div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>MKT VALUE</div><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{cSym}{(parseFloat(f.shares)*parseFloat(f.currentPrice)).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
          <div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>GAIN/LOSS</div><div style={{fontSize:14,fontWeight:600,color:((parseFloat(f.currentPrice)-parseFloat(f.avgCost))/parseFloat(f.avgCost)*100)>=0?K.grn:K.red,fontFamily:fm}}>{((parseFloat(f.currentPrice)-parseFloat(f.avgCost))/parseFloat(f.avgCost)*100).toFixed(1)}%</div></div></div></div>}
      {/* Price alert / Buy zone */}
      <div style={{borderTop:"1px solid "+K.bdr,paddingTop:16,marginTop:8,marginBottom:8}}><div style={{fontSize:12,color:K.dim,letterSpacing:2,textTransform:"uppercase",fontFamily:fm,marginBottom:12}}>Price Alert</div></div>
      <Inp label="Buy Below / Target Price" value={f.targetPrice} onChange={function(v){set("targetPrice",v)}} type="number" placeholder="Set a buy target" K={K}/>
      {tp>0&&cp>0&&<div style={{background:inBuyZone?K.grn+"10":K.bg,border:"1px solid "+(inBuyZone?K.grn+"40":K.bdr),borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14}}>{inBuyZone?"✅":"⏳"}</span>
        <span style={{fontSize:13,color:inBuyZone?K.grn:K.dim,fontWeight:500}}>{inBuyZone?"In the buy zone! Current $"+cp.toFixed(2)+" ≤ target $"+tp.toFixed(2):"Waiting — current $"+cp.toFixed(2)+" is "+(((cp-tp)/tp*100).toFixed(1))+"% above target $"+tp.toFixed(2)}</span></div>}
      {/* Dividends */}
      <div style={{borderTop:"1px solid "+K.bdr,paddingTop:16,marginTop:8,marginBottom:8}}><div style={{fontSize:12,color:K.dim,letterSpacing:2,textTransform:"uppercase",fontFamily:fm,marginBottom:12}}>Dividend</div></div>
      <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Dividend per Payment" value={f.divPerShare} onChange={function(v){set("divPerShare",v)}} type="number" placeholder="0.00" K={K}/>
      <Sel label="Frequency" value={f.divFrequency} onChange={function(v){set("divFrequency",v)}} options={[{v:"quarterly",l:"Quarterly"},{v:"monthly",l:"Monthly"},{v:"semi",l:"Semi-Annual"},{v:"annual",l:"Annual"},{v:"none",l:"No Dividend"}]} K={K}/></div>
      <Inp label="Ex-Dividend Date (next)" value={f.exDivDate} onChange={function(v){set("exDivDate",v)}} type="date" K={K}/>
      {parseFloat(f.divPerShare)>0&&f.divFrequency!=="none"&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:14,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
          <div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>ANNUAL DIV</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>${annDiv.toFixed(2)}</div></div>
          <div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>YIELD</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>{yld.toFixed(2)}%</div></div>
          {f.shares&&<div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>ANNUAL INCOME</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>${(parseFloat(f.shares)*annDiv).toFixed(0)}</div></div>}</div></div>}
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
      // Stoic badge — conviction unchanged (delta 0) while holding is down 15%+
      var pos2=sel.position||{};var drawdown=pos2.currentPrice>0&&pos2.avgCost>0?((pos2.currentPrice-pos2.avgCost)/pos2.avgCost):0;
      if(delta===0&&drawdown<=-0.15){checkMilestone("stoic","🪨 The Stoic — conviction held through a 15%+ drawdown")}
      var deltaMsg=delta!==null&&delta!==0?(delta>0?" (+"+delta+")":"  ("+delta+")"):"";showToast("✓ "+sel.ticker+" conviction: "+r+"/10"+deltaMsg,"info",3000);setModal(null)}
    if(step==="checklist")return<Modal title={null} onClose={function(){setModal(null)}} w={520} K={K}>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:700,color:K.acc,letterSpacing:2,textTransform:"uppercase",fontFamily:fm,marginBottom:8}}>PRE-FLIGHT CHECKLIST</div>
        <div style={{fontSize:22,fontWeight:800,color:K.txt,fontFamily:fh,lineHeight:1.25,letterSpacing:"-0.3px"}}>
          {flagCount>=3?"Hold on — biases detected.":flagCount>0?"A few flags raised.":"Are you acting on facts or feelings?"}
        </div>
        <div style={{fontSize:13,color:K.dim,marginTop:6,lineHeight:1.5}}>Honestly flag any biases active right now before rating conviction.</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {BIAS_CHECKS.map(function(b){var flagged=flags[b.id];var answered=flags[b.id]!==undefined;
          return<div key={b.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:12,background:flagged?K.red+"08":answered?K.grn+"06":K.bg,border:"2px solid "+(flagged?K.red+"30":answered?K.grn+"25":K.bdr),cursor:"pointer",transition:"all .15s"}} onClick={function(){toggleFlag(b.id)}}>
            <div style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:flagged?K.red+"15":answered?K.grn+"15":K.card,border:"1px solid "+(flagged?K.red+"40":answered?K.grn+"40":K.bdr)}}>
              {flagged?<IC name="alert" size={14} color={K.red}/>:answered?<IC name="check" size={14} color={K.grn}/>:<IC name={b.icon} size={14} color={K.dim}/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:flagged?K.red:K.txt}}>{b.label}</div>
              <div style={{fontSize:12,color:K.dim,marginTop:1,lineHeight:1.35}}>{b.q}</div>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:flagged?K.red:answered?K.grn:K.dim,fontFamily:fm,flexShrink:0,minWidth:50,textAlign:"right"}}>
              {flagged?"FLAGGED":answered?"CLEAR":"—"}
            </div>
          </div>})}
      </div>
      {flagCount>=3&&<div style={{background:K.amb+"12",border:"1px solid "+K.amb+"30",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",gap:12,alignItems:"flex-start"}}>
        <span style={{fontSize:18}}>⚠️</span>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:K.amb,marginBottom:2}}>{flagCount} biases active — pause before acting</div>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.4}}>Munger: "The big money is not in the buying and selling, but in the waiting."</div>
        </div>
      </div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:"1px solid "+K.bdr}}>
        <div style={{fontSize:12,color:K.dim}}>
          <span style={{fontWeight:700,color:K.txt}}>{Object.keys(flags).length}</span>/{BIAS_CHECKS.length} reviewed
          {flagCount>0&&<span style={{marginLeft:8,color:K.red,fontWeight:600}}>{flagCount} flagged</span>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button>
          <button style={Object.assign({},S.btnP,{opacity:allAnswered?1:.35})} onClick={function(){if(allAnswered)setStep("rate")}}>Rate Conviction →</button>
        </div>
      </div></Modal>;
    return<Modal title={"Conviction Rating — "+sel.ticker} onClose={function(){setModal(null)}} w={440} K={K}>
      {flagCount>0&&<div style={{background:K.amb+"10",border:"1px solid "+K.amb+"25",borderRadius:6,padding:"8px 12px",marginBottom:16,fontSize:12,color:K.amb,fontFamily:fm}}>{"⚠"} {flagCount} bias flag{flagCount>1?"s":""} active: {BIAS_CHECKS.filter(function(b){return flags[b.id]}).map(function(b){return b.label}).join(", ")}</div>}
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:48,fontWeight:700,color:r>=8?K.grn:r>=5?K.amb:K.red,fontFamily:fm,lineHeight:1}}>{r}</div>
        <div style={{fontSize:12,color:K.dim}}>out of 10</div>
        {/* Delta from previous */}
        {delta!==null&&delta!==0&&<div style={{fontSize:14,fontWeight:600,color:delta>0?K.grn:K.red,fontFamily:fm,marginTop:4}}>
          {delta>0?"▲ +"+delta:"▼ "+delta} from last ({prevRating}/10)</div>}
        {delta===0&&prevRating!==null&&<div style={{fontSize:12,color:K.dim,marginTop:4}}>Same as last ({prevRating}/10)</div>}
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>{[1,2,3,4,5,6,7,8,9,10].map(function(v){return<button key={v} onClick={function(){setR(v)}} style={{width:32,height:32,borderRadius:6,border:"1px solid "+(v===r?K.acc:K.bdr),background:v===r?K.acc+"20":K.bg,color:v===r?K.acc:K.dim,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{v}</button>})}</div>
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
        <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{sel.convictionHistory.length} updates over time</div></div>}
      <Inp label="Note (optional)" value={n2} onChange={setN2} placeholder="Why this rating? What changed?" K={K}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}><button style={{background:"none",border:"none",color:K.acc,fontSize:12,cursor:"pointer",fontFamily:fm,padding:0}} onClick={function(){setStep("checklist")}}>{"←"} Back to checklist</button>
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
      {sel.kpis.length>0&&<div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:K.dim,marginBottom:8,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>KPI Results</label>
        {sel.kpis.map(function(k){return<div key={k.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:13,color:K.mid,flex:1}}>{k.name} <span style={{color:K.dim}}>({k.target})</span></span>
          <input type="number" value={kr[k.id]||""} onChange={function(e){setKr(function(p){var n=Object.assign({},p);n[k.id]=e.target.value;return n})}} placeholder="Actual" style={{width:100,background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 12px",fontSize:13,fontFamily:fm,outline:"none"}}/></div>})}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.quarter.trim()&&f.summary.trim()?1:.4})} onClick={doSave}>Save Earnings</button></div></Modal>}
  function exportPDF(){if(!sel)return;var c=sel;var h=gH(c.kpis);var pos=c.position||{};var sec=parseThesis(c.thesisNote);
    var os=calcOwnerScore([c]);var conv=c.conviction||0;
    var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;
    var total=c.kpis.filter(function(k){return k.lastResult}).length;
    var activeMoats=MOAT_TYPES.filter(function(t){return c.moatTypes&&c.moatTypes[t.id]&&c.moatTypes[t.id].active});
    var style=c.investStyle&&STYLE_MAP[c.investStyle]?STYLE_MAP[c.investStyle]:null;
    var snap=c.financialSnapshot||{};var scenarios=c.scenarios||[];
    function esc(s){return(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>")}
    function pv(f2){if(!snap[f2])return"\u2014";return snap[f2].value||"\u2014"}
    var dps=c.divPerShare||c.lastDiv||0;var divMult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
    var annDiv=dps*divMult;var divYld=pos.currentPrice>0&&annDiv>0?(annDiv/pos.currentPrice*100):0;
    var totalReturn=pos.avgCost>0?((pos.currentPrice-pos.avgCost)/pos.avgCost*100):0;
    var posValue=pos.shares>0&&pos.currentPrice>0?(pos.shares*pos.currentPrice):0;
    var costBasis=pos.shares>0&&pos.avgCost>0?(pos.shares*pos.avgCost):0;
    var today=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    var convSvg="";
    if(c.convictionHistory&&c.convictionHistory.length>1){var ch=c.convictionHistory.slice(-16);var cw=440;var chh=70;
      convSvg='<svg width="'+cw+'" height="'+chh+'" viewBox="0 0 '+cw+' '+chh+'">';
      var pts=ch.map(function(p,i){return{x:i/(ch.length-1)*cw*.92,y:chh-6-(p.rating/10)*(chh-12),r:p.rating}});
      var area="M"+pts[0].x+","+chh+" "+pts.map(function(p){return"L"+p.x.toFixed(1)+","+p.y.toFixed(1)}).join(" ")+" L"+pts[pts.length-1].x+","+chh+" Z";
      convSvg+='<path d="'+area+'" fill="#2563eb" opacity="0.06"/>';
      convSvg+='<path d="'+pts.map(function(p,i){return(i===0?"M":"L")+p.x.toFixed(1)+","+p.y.toFixed(1)}).join(" ")+'" fill="none" stroke="#2563eb" stroke-width="2"/>';
      pts.forEach(function(p){var cl=p.r>=8?"#16a34a":p.r>=5?"#2563eb":"#dc2626";convSvg+='<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.5" fill="'+cl+'" stroke="white" stroke-width="2"/>'});
      convSvg+='</svg>'}
    var moatSvg="";
    if(c._moatCache&&c._moatCache.composite!=null){var mc=c._moatCache;var dims2=[{k:"grossMargin",l:"Pricing Power"},{k:"revGrowth",l:"Revenue Growth"},{k:"opLeverage",l:"Operating Leverage"},{k:"roic",l:"Capital Efficiency"},{k:"fcfConversion",l:"Earnings Quality"},{k:"fortress",l:"Financial Strength"},{k:"netMargin",l:"Profitability"}];
      var visibleDims=dims2.filter(function(dm){return mc[dm.k]!=null&&mc[dm.k]>0});
      if(visibleDims.length>0){moatSvg='<svg width="460" height="'+(visibleDims.length*28+10)+'" viewBox="0 0 460 '+(visibleDims.length*28+10)+'">';
      visibleDims.forEach(function(dm,i){var v=mc[dm.k];var y2=i*28+6;var cl=v>=8?"#16a34a":v>=6?"#2563eb":v>=4?"#d97706":"#dc2626";
        moatSvg+='<text x="0" y="'+(y2+12)+'" font-size="10" fill="#6b7280" font-family="Inter,sans-serif">'+dm.l+'</text>';
        moatSvg+='<rect x="130" y="'+y2+'" width="270" height="16" rx="4" fill="#f3f4f6"/>';
        moatSvg+='<rect x="130" y="'+y2+'" width="'+(v/10*270).toFixed(0)+'" height="16" rx="4" fill="'+cl+'" opacity="0.85"/>';
        moatSvg+='<text x="410" y="'+(y2+12)+'" font-size="12" font-weight="700" fill="'+cl+'" font-family="JetBrains Mono,monospace">'+v.toFixed(1)+'</text>'});
      moatSvg+='</svg>'}}
    var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+c.ticker+' Research Note</title>';
    html+='<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">';
    html+='<style>@page{size:A4;margin:20mm 18mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,sans-serif;color:#1a1a2e;font-size:11px;line-height:1.65}.page{max-width:700px;margin:0 auto;padding:36px 44px}';
    html+='.cover{padding:48px 0 36px;border-bottom:3px solid #1a1a2e;margin-bottom:32px}.cover h1{font-family:Playfair Display,serif;font-size:42px;font-weight:800;letter-spacing:-1px;line-height:1}.cover .cn{font-size:16px;color:#4b5563;margin-top:8px}.cover .meta{font-family:JetBrains Mono,monospace;font-size:10px;color:#9ca3af;margin-top:6px}';
    html+='.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:20px}.tag{font-family:JetBrains Mono,monospace;font-size:8.5px;font-weight:600;padding:4px 12px;border-radius:4px}';
    html+='.kstats{display:grid;grid-template-columns:repeat(5,1fr);gap:0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:28px}.ks{padding:14px 12px;text-align:center;border-right:1px solid #e5e7eb}.ks:last-child{border-right:none}.ks-l{font-family:JetBrains Mono,monospace;font-size:7.5px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:5px}.ks-v{font-family:JetBrains Mono,monospace;font-size:18px;font-weight:800}.ks-s{font-size:9px;color:#9ca3af;margin-top:3px}';
    html+='.sh{font-family:JetBrains Mono,monospace;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:3px;color:#1a1a2e;margin:32px 0 14px;padding-bottom:8px;border-bottom:2px solid #1a1a2e;display:flex;align-items:center;gap:8px}.sh-n{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#1a1a2e;color:#fff;font-size:9px}';
    html+='.tc{font-family:Playfair Display,serif;font-size:13px;line-height:1.85;padding:20px 24px;background:linear-gradient(135deg,#fafafa,#f5f5f5);border-radius:10px;border-left:4px solid #1a1a2e;margin-bottom:14px}';
    html+='.tb{padding:12px 18px;border-radius:8px;margin-bottom:8px;font-size:11px;line-height:1.7;color:#374151;background:#fafafa}.tl{font-family:JetBrains Mono,monospace;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}';
    html+='table{width:100%;border-collapse:collapse;font-size:10.5px}th{font-family:JetBrains Mono,monospace;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;padding:8px 12px;border-bottom:2px solid #e5e7eb;font-weight:700;text-align:left}td{padding:9px 12px;border-bottom:1px solid #f3f4f6}';
    html+='.mono{font-family:JetBrains Mono,monospace}.grn{color:#16a34a}.red{color:#dc2626}.amb{color:#d97706}';
    html+='.fg{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}.fc{border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px}.fch{font-family:JetBrains Mono,monospace;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:10px;font-weight:700}.fr{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f9fafb}.fr:last-child{border-bottom:none}.fk{font-size:10px;color:#6b7280}.fv{font-family:JetBrains Mono,monospace;font-size:11px;font-weight:600;color:#1a1a2e}';
    html+='.sc{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:8px;page-break-inside:avoid}.scc{font-family:JetBrains Mono,monospace;font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#6b4ce6;margin-bottom:4px}.scq{font-size:10px;color:#6b7280;font-style:italic;margin-bottom:6px;line-height:1.5}.sca{font-size:11px;color:#1a1a2e;line-height:1.6}';
    html+='.footer{margin-top:40px;padding-top:14px;border-top:2px solid #1a1a2e;display:flex;justify-content:space-between;align-items:flex-start}';
    html+='@media print{.page{padding:0}}</style></head><body><div class="page">';
    html+='<div class="cover"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1>'+c.ticker+'</h1><div class="cn">'+esc(c.name)+'</div><div class="meta">'+[c.sector,c.industry,c.exchange,c.country].filter(Boolean).join(' \u00B7 ')+'</div>';
    html+='<div class="tags">';
    if(style)html+='<span class="tag" style="background:'+style.color+'12;color:'+style.color+';border:1px solid '+style.color+'30">'+style.label+'</span>';
    html+='<span class="tag" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0">KPIs: '+h.l+'</span>';
    if(conv>0)html+='<span class="tag" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe">Conviction: '+conv+'/10</span>';
    activeMoats.forEach(function(t){html+='<span class="tag" style="background:'+t.color+'10;color:'+t.color+';border:1px solid '+t.color+'30">'+t.label+'</span>'});
    html+='</div></div><div style="text-align:right"><div style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:800;letter-spacing:3px">THESISALPHA</div><div style="font-size:9px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-top:2px">Investment Research Note</div><div style="font-family:JetBrains Mono,monospace;font-size:9px;color:#6b7280;margin-top:10px">'+today+'</div></div></div>';
    html+='<div class="kstats"><div class="ks"><div class="ks-l">Price</div><div class="ks-v">'+(pos.currentPrice>0?'$'+pos.currentPrice.toFixed(2):'\u2014')+'</div>'+(pos.avgCost>0?'<div class="ks-s '+(totalReturn>=0?'grn':'red')+'">'+(totalReturn>=0?'+':'')+totalReturn.toFixed(1)+'%</div>':'')+'</div>';
    html+='<div class="ks"><div class="ks-l">Position</div><div class="ks-v">'+(posValue>0?'$'+(posValue>=1e6?(posValue/1e6).toFixed(1)+'M':(posValue/1e3).toFixed(1)+'k'):'\u2014')+'</div>'+(pos.shares>0?'<div class="ks-s">'+pos.shares+' shares</div>':'')+'</div>';
    html+='<div class="ks"><div class="ks-l">Conviction</div><div class="ks-v '+(conv>=7?'grn':conv>=4?'amb':'red')+'">'+(conv>0?conv+'/10':'\u2014')+'</div></div>';
    html+='<div class="ks"><div class="ks-l">KPI Score</div><div class="ks-v '+(total>0?(met===total?'grn':met>0?'amb':'red'):'')+'">'+(total>0?met+'/'+total:'\u2014')+'</div><div class="ks-s">met</div></div>';
    html+='<div class="ks"><div class="ks-l">Div Yield</div><div class="ks-v '+(divYld>0?'grn':'')+'">'+(divYld>0?divYld.toFixed(1)+'%':'\u2014')+'</div></div>';
    html+='</div></div>';
    if(sec.core||sec.moat||sec.risks||sec.sell){html+='<div class="sh"><span class="sh-n">1</span>Investment Thesis</div>';
      if(sec.core)html+='<div class="tc">'+esc(sec.core)+'</div>';
      if(sec.moat)html+='<div class="tb" style="border-left:3px solid #16a34a"><div class="tl" style="color:#16a34a">Competitive Moat</div>'+esc(sec.moat)+'</div>';
      if(sec.risks)html+='<div class="tb" style="border-left:3px solid #d97706"><div class="tl" style="color:#d97706">Key Risks</div>'+esc(sec.risks)+'</div>';
      if(sec.sell)html+='<div class="tb" style="border-left:3px solid #dc2626"><div class="tl" style="color:#dc2626">Sell Criteria</div>'+esc(sec.sell)+'</div>'}
    var hasFinancials=Object.keys(snap).length>0;
    if(hasFinancials||pos.shares>0){html+='<div class="sh"><span class="sh-n">2</span>Financial Profile</div><div class="fg">';
      var valItems=[[pv("pe"),"P/E"],[pv("pb"),"P/B"],[pv("fcf"),"FCF/Share"],[pv("grossMargin"),"Gross Margin"],[pv("opMargin"),"Op Margin"],[pv("roe"),"ROE"],[pv("roic"),"ROIC"],[pv("revGrowth"),"Rev Growth"]].filter(function(x){return x[0]!=="\u2014"});
      if(valItems.length>0){html+='<div class="fc"><div class="fch">Valuation & Returns</div>';valItems.forEach(function(x){html+='<div class="fr"><span class="fk">'+x[1]+'</span><span class="fv">'+x[0]+'</span></div>'});html+='</div>'}
      var healthItems=[[pv("currentRatio"),"Current Ratio"],[pv("debtEquity"),"Debt/Equity"]].filter(function(x){return x[0]!=="\u2014"});
      if(divYld>0){healthItems.push([divYld.toFixed(2)+"%","Div Yield"]);healthItems.push(["$"+annDiv.toFixed(2),"Annual Div/Share"])}
      if(healthItems.length>0){html+='<div class="fc"><div class="fch">Balance Sheet & Income</div>';healthItems.forEach(function(x){html+='<div class="fr"><span class="fk">'+x[1]+'</span><span class="fv">'+x[0]+'</span></div>'});html+='</div>'}
      html+='</div>'}
    // Valuation Framework
    var valPdf=c.valuation||{metrics:[]};
    if(valPdf.metrics.length>0){html+='<div class="sh"><span class="sh-n">3</span>Valuation Framework</div>';
      var vResults=valPdf.metrics.map(function(vm){var def=VALUATION_METRICS.find(function(m){return m.id===vm.id});if(!def)return null;var cur=getValMetricValue(def,snap,pos.currentPrice||(snap.livePrice&&snap.livePrice.numVal?snap.livePrice.numVal:0),c);var pass=cur!=null&&vm.threshold>0?(vm.rule==="gte"?cur>=vm.threshold:cur<=vm.threshold):null;return{label:def.label,unit:def.unit,rule:vm.rule,threshold:vm.threshold,current:cur,pass:pass}}).filter(Boolean);
      var vPass=vResults.filter(function(r){return r.pass===true}).length;var vTotal=vResults.filter(function(r){return r.pass!=null}).length;
      var vVerdict=vTotal===0?null:vPass>=vTotal*0.75?"Attractive":vPass>=vTotal*0.5?"Fair":"Expensive";
      var vColor=vVerdict==="Attractive"?"#16a34a":vVerdict==="Fair"?"#d97706":"#dc2626";
      if(vVerdict)html+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><span style="font-size:18px;font-weight:800;color:'+vColor+';font-family:JetBrains Mono,monospace">'+vVerdict+'</span><span style="font-size:10px;color:#9ca3af">'+vPass+'/'+vTotal+' criteria met</span></div>';
      html+='<table><thead><tr><th>Metric</th><th style="text-align:right">Threshold</th><th style="text-align:right">Current</th><th style="text-align:center">Pass</th></tr></thead><tbody>';
      vResults.forEach(function(r){var clr=r.pass===true?"#16a34a":r.pass===false?"#dc2626":"#9ca3af";
        html+='<tr><td style="font-weight:600">'+r.label+'</td><td class="mono" style="text-align:right">'+(r.rule==="gte"?"\u2265":"\u2264")+' '+r.threshold+r.unit+'</td><td class="mono" style="text-align:right;font-weight:700;color:'+clr+'">'+(r.current!=null?r.current.toFixed(r.unit==="%"?1:r.current<1?2:1)+r.unit:"\u2014")+'</td><td style="text-align:center"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+clr+'"></span></td></tr>'});
      html+='</tbody></table>'}
    if(c.kpis.length>0){html+='<div class="sh"><span class="sh-n">'+(valPdf.metrics.length>0?4:3)+'</span>KPI Scorecard</div><table><thead><tr><th>Metric</th><th style="text-align:right">Target</th><th style="text-align:right">Actual</th><th style="text-align:center">Status</th></tr></thead><tbody>';
      c.kpis.forEach(function(k){var st=k.lastResult?k.lastResult.status:"pending";var stC=st==="met"?"#16a34a":st==="missed"?"#dc2626":"#9ca3af";var stL=st==="met"?"MET":st==="missed"?"MISSED":"PENDING";var mDef=METRIC_MAP[k.metricId||""]||{};
        html+='<tr><td style="font-weight:600">'+esc(mDef.label||k.name)+'</td><td style="text-align:right" class="mono">'+(k.rule==="gte"?"\u2265":k.rule==="lte"?"\u2264":"=")+' '+k.value+(mDef.unit||"")+'</td><td style="text-align:right;font-weight:700;color:'+stC+'" class="mono">'+(k.lastResult?k.lastResult.actual:'\u2014')+'</td><td style="text-align:center"><span class="mono" style="font-size:8px;font-weight:800;color:'+stC+';background:'+stC+'10;padding:2px 8px;border-radius:3px">'+stL+'</span></td></tr>'});
      html+='</tbody></table>'}
    var _secN=1+(sec.core||sec.moat||sec.risks||sec.sell?1:0)+(Object.keys(snap).length>0||pos.shares>0?1:0)+(valPdf.metrics.length>0?1:0)+(c.kpis.length>0?1:0);
    if(activeMoats.length>0||moatSvg){html+='<div class="sh"><span class="sh-n">'+(_secN++)+'</span>Moat Analysis</div>';
      if(activeMoats.length>0){html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">';activeMoats.forEach(function(t){var d2=c.moatTypes[t.id];var str=d2.strength||3;html+='<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;border:1px solid '+t.color+'30;background:'+t.color+'06"><span style="font-size:11px;font-weight:700;color:'+t.color+'">'+t.label+'</span><span style="display:flex;gap:2px">';for(var di=0;di<5;di++){html+='<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+(di<str?t.color:'#e5e7eb')+'"></span>'}html+='</span></div>'});html+='</div>'}
      if(moatSvg){html+=moatSvg;if(c._moatCache)html+='<div style="text-align:right;font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;margin-top:6px">Composite: '+c._moatCache.composite.toFixed(1)+'/10</div>'}}
    if(convSvg||conv>0){html+='<div class="sh"><span class="sh-n">'+(_secN++)+'</span>Conviction History</div>';if(convSvg)html+=convSvg;
      if(c.convictionHistory&&c.convictionHistory.length>0){var first=c.convictionHistory[0];var last=c.convictionHistory[c.convictionHistory.length-1];html+='<div style="display:flex;gap:20px;font-size:9px;color:#6b7280;margin-top:8px;font-family:JetBrains Mono,monospace"><span>Start: '+first.rating+'/10</span><span>Current: '+last.rating+'/10</span><span>Trend: '+(last.rating>first.rating?'<span class="grn">Rising</span>':last.rating<first.rating?'<span class="red">Falling</span>':'Stable')+'</span></div>'}}
    if(scenarios.length>0){html+='<div class="sh"><span class="sh-n">'+(_secN++)+'</span>Stress Test</div>';scenarios.forEach(function(s){html+='<div class="sc"><div class="scc">'+(s.category||"").toUpperCase()+'</div><div class="scq">'+esc(s.prompt)+'</div><div class="sca">'+esc(s.response)+'</div></div>'})}
    var decs=(c.decisions||[]).filter(function(d2){return d2.cardType==="decision"||(!d2.cardType&&d2.reasoning)});
    if(c.earningsHistory&&c.earningsHistory.length>0){html+='<div class="sh"><span class="sh-n">'+(_secN++)+'</span>Earnings History</div><table><thead><tr><th>Quarter</th><th>Summary</th></tr></thead><tbody>';c.earningsHistory.slice(0,6).forEach(function(e){html+='<tr><td class="mono" style="font-weight:700;white-space:nowrap">'+esc(e.quarter)+'</td><td style="font-size:10px;color:#4b5563;max-width:380px">'+esc((e.summary||"").substring(0,250))+'</td></tr>'});html+='</tbody></table>'}
    if(decs.length>0){html+='<div class="sh"><span class="sh-n">'+(_secN++)+'</span>Decision Ledger</div><table><thead><tr><th>Date</th><th>Action</th><th>Reasoning</th><th>Outcome</th></tr></thead><tbody>';decs.slice(0,8).forEach(function(d){var clr=d.action==="BUY"||d.action==="ADD"?"#16a34a":"#dc2626";html+='<tr><td class="mono" style="white-space:nowrap;font-size:10px">'+esc((d.date||"").substring(0,10))+'</td><td style="font-weight:800;color:'+clr+'" class="mono">'+esc(d.action||"")+'</td><td style="font-size:10px;color:#4b5563;max-width:300px">'+esc((d.reasoning||"").substring(0,180))+'</td><td class="mono" style="font-weight:700;color:'+(d.outcome==="right"?"#16a34a":d.outcome==="wrong"?"#dc2626":"#9ca3af")+'">'+esc(d.outcome||"\u2014")+'</td></tr>'});html+='</tbody></table>'}
    html+='<div class="footer"><div><div style="font-family:JetBrains Mono,monospace;font-size:10px;font-weight:800;letter-spacing:3px">THESISALPHA</div><div style="font-size:8px;color:#9ca3af;margin-top:4px;max-width:320px;line-height:1.5">Generated for personal research purposes. Not financial advice. Data from third-party providers may contain errors. Past performance does not predict future results.</div></div><div style="text-align:right"><div class="mono" style="font-size:10px;font-weight:700">'+c.ticker+'</div><div style="font-size:9px;color:#6b7280">'+today+'</div></div></div>';
    html+='</div></body></html>';
    var w=window.open("","_blank");if(w){w.document.write(html);w.document.close();setTimeout(function(){w.print()},800)}}

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
    var allThemes=[{id:"thesis_dark",name:"Main Theme — Dark",desc:"Default. Outfit font, rounded, purple",color:"#16161D",accent:"#6B4CE6",unlock:0},{id:"thesis_light",name:"Main Theme — Light",desc:"Clean cream with purple accent",color:"#F7F5F0",accent:"#6B4CE6",unlock:0},{id:"dark",name:"Dark",desc:"Easy on the eyes",color:"#1a1a1a",accent:"#ffffff",unlock:0},{id:"light",name:"Light",desc:"Clean and bright",color:"#f7f7f7",accent:"#1a1a1a",unlock:0},{id:"forest",name:"Forest",desc:"Duolingo-inspired, playful",color:"#f0f0f0",accent:"#58cc02",unlock:1},{id:"purple",name:"Purple",desc:"Financial purple",color:"#13111c",accent:"#a78bfa",unlock:1},{id:"paypal",name:"PayPal Blue",desc:"Professional blue",color:"#f5f7fa",accent:"#003087",unlock:3},{id:"bloomberg",name:"Bloomberg",desc:"Terminal black & orange",color:"#000000",accent:"#ff8800",unlock:5}];
    return<Modal title="Settings" onClose={function(){setModal(null)}} K={K} w={500}>
      {/* Tab bar */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid "+K.bdr}}>{[{id:"widgets",l:"Widgets"},{id:"display",l:"Display"},{id:"themes",l:"Themes"},{id:"rewards",l:"Rewards"},{id:"account",l:"Account"}].map(function(t){return<button key={t.id} onClick={function(){setSTab(t.id)}} style={{padding:"8px 16px",fontSize:13,fontFamily:fm,fontWeight:sTab===t.id?600:400,color:sTab===t.id?K.acc:K.dim,background:"transparent",border:"none",borderBottom:sTab===t.id?"2px solid "+K.acc:"2px solid transparent",cursor:"pointer",marginBottom:-1}}>{t.l}</button>})}</div>
      {/* ── Display Tab ── */}
      {sTab==="display"&&<div>
        <div style={{fontSize:13,color:K.dim,marginBottom:20}}>Choose how values are displayed across the app. Note: this changes the currency symbol only — no FX conversion is applied. Stock prices from market data remain in their original currency.</div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:12,textTransform:"uppercase",letterSpacing:.5}}>Currency Symbol</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {CURRENCIES.map(function(cur){var active=currency===cur.code;return<button key={cur.code} onClick={function(){saveCurrency(cur.code)}} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,border:"2px solid "+(active?K.acc:K.bdr),background:active?K.acc+"10":K.card,cursor:"pointer",textAlign:"left",transition:"all .15s"}}>
              <span style={{fontSize:18,fontFamily:fm,fontWeight:700,color:active?K.acc:K.txt,minWidth:28}}>{cur.sym.trim()}</span>
              <div>
                <div style={{fontSize:13,fontWeight:active?700:500,color:active?K.acc:K.txt}}>{cur.code}</div>
                <div style={{fontSize:11,color:K.dim}}>{cur.label}</div>
              </div>
              {active&&<div style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",background:K.acc,flexShrink:0}}/>}
            </button>})}
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={function(){setModal(null)}} style={S.btnP}>Done</button></div>
      </div>}
      {/* ── Widgets Tab ── */}
      {sTab==="widgets"&&<div>
        <div style={{fontSize:13,color:K.dim,marginBottom:16}}>Toggle dashboard widgets on or off.</div>
        {items.map(function(it){return<div key={it.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid "+K.bdr}}>
          <div><div style={{fontSize:14,color:K.txt,fontWeight:500}}>{it.l}</div><div style={{fontSize:12,color:K.dim,marginTop:2}}>{it.d}</div></div>
          <button onClick={function(){toggleDash(it.k)}} style={{width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",background:dashSet[it.k]?K.acc:K.bdr2,position:"relative",transition:"background .2s",flexShrink:0}}>
            <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:dashSet[it.k]?23:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/></button></div>})}
        <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid "+K.bdr,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={function(){setModal(null);setObStep(1)}} style={{display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"1px solid "+K.bdr,borderRadius:6,padding:"7px 14px",fontSize:12,color:K.mid,cursor:"pointer",fontFamily:fm}}><IC name="lightbulb" size={12} color={K.dim}/>Replay Welcome Tour</button>
          <button onClick={function(){setModal(null)}} style={S.btnP}>Done</button></div>
      </div>}
      {/* ── Themes Tab ── */}
      {sTab==="themes"&&<div>
        <div style={{fontSize:13,color:K.dim,marginBottom:16}}>Unlock new themes by building your weekly streak.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {allThemes.map(function(t){var unlocked=(streakData.current||0)>=t.unlock;var active=theme===t.id;
            return<div key={t.id} style={{borderRadius:10,border:"2px solid "+(active?K.acc:unlocked?K.bdr:"transparent"),background:unlocked?K.card:K.bg,padding:"14px 16px",cursor:unlocked?"pointer":"default",opacity:unlocked?1:.5,position:"relative"}} onClick={function(){if(unlocked){setTheme(t.id);try{localStorage.setItem("ta-theme",t.id)}catch(e){}}}}>
              {!unlocked&&<div style={{position:"absolute",top:8,right:8,fontSize:13}}>{String.fromCodePoint(0x1F512)}</div>}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:28,height:28,borderRadius:6,background:t.color,border:"1px solid "+K.bdr,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:10,height:10,borderRadius:2,background:t.accent}}/></div>
                <div><div style={{fontSize:13,fontWeight:600,color:unlocked?K.txt:K.dim}}>{t.name}</div>
                  <div style={{fontSize:10,color:K.dim}}>{t.desc}</div></div></div>
              {!unlocked&&<div style={{fontSize:10,color:K.dim,fontFamily:fm}}>Week {t.unlock} streak</div>}
              {active&&<div style={{fontSize:10,color:K.acc,fontFamily:fm,fontWeight:600}}>Active</div>}
            </div>})}</div>
      </div>}
      {/* ── Rewards Tab ── */}
      {sTab==="rewards"&&<div>
        <div style={{fontSize:13,color:K.dim,marginBottom:16}}>Complete your Weekly Review every week to build a streak. Each milestone unlocks new features and investor lenses.</div>
        <div style={{display:"grid",gap:6}}>
          {[{w:1,icon:String.fromCodePoint(0x1F3A8),label:"Forest & Purple themes",desc:"Two new color palettes"},
            {w:2,icon:String.fromCodePoint(0x1F916),label:"Research Export Pack",desc:"One-click export for AI tools"},
            {w:3,icon:String.fromCodePoint(0x1F4B3),label:"PayPal Blue theme",desc:"Crisp professional blue"},
            {w:2,icon:String.fromCodePoint(0x1F9D0),label:"Munger Lens (free)",desc:"Available to all users"},
            {w:5,icon:String.fromCodePoint(0x1F4BB),label:"Bloomberg Terminal theme",desc:"The iconic black & orange"},
            {w:8,icon:String.fromCodePoint(0x1F3E6),label:"Warren Buffett lens",desc:"Owner Earnings"},
            {w:12,icon:String.fromCodePoint(0x2728),label:"Joel Greenblatt lens",desc:"Magic Formula"},
            {w:16,icon:String.fromCodePoint(0x1F4DA),label:"Peter Lynch lens",desc:"Growth at a Price"},
            {w:20,icon:String.fromCodePoint(0x1F4C8),label:"Shelby Cullom Davis lens",desc:"Davis Double Play"},
            {w:24,icon:String.fromCodePoint(0x1F3AF),label:"Chris Hohn lens",desc:"Activist Value"}
          ].map(function(r){var unlocked=(streakData.current||0)>=r.w;return<div key={r.w} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:unlocked?K.grn+"06":"transparent",border:"1px solid "+(unlocked?K.grn+"20":K.bdr),borderRadius:8,opacity:unlocked?1:.7}}>
            <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:unlocked?600:400,color:unlocked?K.txt:K.mid}}>{r.label}</div>
              <div style={{fontSize:11,color:K.dim}}>{r.desc}</div></div>
            <div style={{fontSize:11,fontFamily:fm,color:unlocked?K.grn:K.dim,fontWeight:600,flexShrink:0}}>{unlocked?"✓":"Wk "+r.w}</div></div>})}</div>
        <div style={{fontSize:11,color:K.dim,marginTop:10,fontStyle:"italic"}}>Current streak: {streakData.current||0} week{(streakData.current||0)!==1?"s":""}. {streakData.freezes>0?streakData.freezes+" freeze"+(streakData.freezes>1?"s":"")+" available. ":""}Earn a freeze every 4 consecutive weeks.</div>
        <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}><button onClick={function(){setModal(null)}} style={S.btnP}>Done</button></div>
      </div>}
      {/* ── Account Tab ── */}
      {sTab==="account"&&<div>
        <div style={{fontSize:13,color:K.dim,marginBottom:20}}>Manage your account, subscription, and profile.</div>
        {/* Email */}
        <div style={{padding:"14px 0",borderBottom:"1px solid "+K.bdr}}>
          <div style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:6}}>Email</div>
          <div style={{fontSize:14,color:K.txt}}>{props.user}</div></div>
        {/* Username */}
        <div style={{padding:"14px 0",borderBottom:"1px solid "+K.bdr}}>
          <div style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:6}}>Username</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:14,color:K.txt}}>{username||"Not set"}</div>
            <button onClick={function(){setModal(null);setShowProfile(true);setEditingName(true);setNameInput(username||"")}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})}>Change</button></div></div>
        {/* Avatar */}
        <div style={{padding:"14px 0",borderBottom:"1px solid "+K.bdr}}>
          <div style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:6}}>Avatar</div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {avatarUrl?<img src={avatarUrl} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",border:"2px solid "+K.bdr}}/>
              :<div style={{width:40,height:40,borderRadius:"50%",background:K.acc+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:K.acc,fontWeight:600,fontFamily:fm}}>{(username||props.user||"U")[0].toUpperCase()}</div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){var inp=document.getElementById("ta-avatar-input");if(inp)inp.click()}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})}>{avatarUrl?"Change":"Upload"}</button>
              <input id="ta-avatar-input" type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarUpload}/>
              {avatarUrl&&<button onClick={function(){setAvatarUrl("");try{localStorage.removeItem("ta-avatar")}catch(e){}showToast("Avatar removed","info",2000)}} style={Object.assign({},S.btnD,{padding:"5px 12px",fontSize:11})}>Remove</button>}
            </div></div></div>
        {/* Password */}
        <div style={{padding:"14px 0",borderBottom:"1px solid "+K.bdr}}>
          <div style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:6}}>Password</div>
          <button onClick={function(){if(!supabase){showToast("Auth not available","info",3000);return}supabase.auth.resetPasswordForEmail(props.user).then(function(){showToast("Password reset email sent to "+props.user,"milestone",5000)}).catch(function(e){showToast("Could not send reset email: "+(e.message||"try again"),"info",4000)})}} style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12})}>Send Password Reset Email</button>
          <div style={{fontSize:11,color:K.dim,marginTop:6}}>A reset link will be sent to {props.user}</div></div>
        {/* Subscription */}
        <div style={{padding:"14px 0",borderBottom:"1px solid "+K.bdr}}>
          <div style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:6}}>Subscription</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div><div style={{fontSize:14,fontWeight:600,color:plan==="pro"?K.grn:K.txt}}>{plan==="pro"?"Pro Plan":trialActive?"Trial ("+trialDaysLeft+"d left)":"Free Plan"}</div>
              {plan==="pro"&&<div style={{fontSize:11,color:K.dim,marginTop:2}}>Manage billing, change plan, or cancel</div>}
              {plan!=="pro"&&<div style={{fontSize:11,color:K.dim,marginTop:2}}>{trialActive?"Upgrade anytime to keep Pro features":"Upgrade to unlock data features"}</div>}</div>
            {plan==="pro"?<button onClick={function(){openManage()}} style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12})}>Manage in Stripe</button>
              :<button onClick={function(){setModal(null);setShowUpgrade(true);setUpgradeCtx("")}} style={Object.assign({},S.btnP,{padding:"6px 14px",fontSize:12})}>Upgrade to Pro</button>}</div></div>
        {/* Logout */}
        <div style={{padding:"14px 0"}}>
          <button onClick={function(){props.onLogout()}} style={{background:K.red+"10",border:"1px solid "+K.red+"25",borderRadius:6,padding:"8px 16px",fontSize:12,color:K.red,cursor:"pointer",fontFamily:fm,fontWeight:600}}>Log Out</button></div>
      </div>}
      <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={function(){setModal(null);setObStep(1)}} style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"1px solid "+K.bdr,borderRadius:6,color:K.mid,fontSize:12,cursor:"pointer",padding:"6px 12px",fontFamily:fm}}><IC name="lightbulb" size={12} color={K.dim}/>Replay Welcome Tour</button>
        <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>ThesisAlpha v1.0</div></div>
    </Modal>}
  // ── Upgrade Modal ──────────────────────────────────────────
  function UpgradeModal(){
    var _loading=useState(null),loading=_loading[0],setLoading=_loading[1];
    var ctxMsg={"trial-ending":"Your trial ends in "+trialDaysLeft+" day"+(trialDaysLeft!==1?"s":"")+". Lock in Pro to keep your data features.","trial-expired":"Your "+(!trialBonusEarned?TRIAL_BASE:TRIAL_TOTAL)+"-day trial has ended. Your theses and data are safe — upgrade to continue using data features.",companies:"Upgrade to unlock data features.",earnings:"Earnings checking is a Pro feature.",financials:"Financial statements are a Pro feature.",charts:"Price charts are a Pro feature.",analysts:"Analyst data is a Pro feature.",import:"CSV import is a Pro feature.",export:"Premium PDF export is a Pro feature."}[upgradeCtx]||"Unlock the full ThesisAlpha experience.";
    function startCheckout(priceId){setLoading(priceId);
      authFetch("/api/stripe/checkout",{method:"POST",body:JSON.stringify({priceId:priceId,userId:props.userId,email:props.user})}).then(function(r){return r.json()}).then(function(d){if(d.url)window.location.href=d.url;else{setLoading(null);showToast("Checkout error — please try again","info",4000)}}).catch(function(e){setLoading(null);showToast("Connection error","info",3000)})}
    return<Modal title="Upgrade to Owner’s Plan" onClose={function(){setShowUpgrade(false)}} w={520} K={K}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:14,color:K.mid,lineHeight:1.7}}>{ctxMsg}</div>
        <div style={{fontSize:13,color:K.dim,marginTop:4}}>Your process tools stay free forever. Add real-time data to supercharge them.</div></div>
      {/* Feature list */}
      <div style={{background:K.bg,borderRadius:10,padding:"16px 20px",marginBottom:24}}>
        {[{t:"Auto earnings check + notifications",i:"⚡"},{t:"Financial statements (10yr history)",i:"📊"},{t:"Data-driven moat analysis (8 metrics)",i:"🏰"},{t:"Analyst targets + insider trades",i:"📋"},{t:"Price charts with conviction markers",i:"📈"},{t:"Community benchmarks & consensus",i:"👥"},{t:"Premium PDF export",i:"📄"}].map(function(f){return<div key={f.t} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0"}}>
          <span style={{fontSize:14,width:20,textAlign:"center"}}>{f.i}</span>
          <span style={{fontSize:13,color:K.txt,fontFamily:fm}}>{f.t}</span></div>})}</div>
      {/* Pricing cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 16px",textAlign:"center"}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:10}}>Monthly</div>
          <div style={{fontSize:28,fontWeight:700,color:K.txt,fontFamily:fm}}>$12.99<span style={{fontSize:13,fontWeight:400,color:K.dim}}>/mo</span></div>
          <div style={{fontSize:11,color:K.dim,marginBottom:14}}>Cancel anytime</div>
          <button onClick={function(){startCheckout(process.env.NEXT_PUBLIC_STRIPE_MONTHLY||"price_1T8P7qB5sSVol2sMKMlNXT47")}} disabled={loading==="monthly"} style={Object.assign({},S.btn,{width:"100%",padding:"10px",fontSize:13,opacity:loading==="monthly"?.5:1})}>{loading==="monthly"?"Redirecting…":"Start Monthly"}</button></div>
        <div style={{background:K.card,border:"2px solid "+K.acc,borderRadius:12,padding:"20px 16px",textAlign:"center",position:"relative"}}>
          <div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:K.acc,color:K.bg,fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:10,fontFamily:fm,letterSpacing:1}}>BEST VALUE</div>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:10}}>Annual</div>
          <div style={{fontSize:28,fontWeight:700,color:K.txt,fontFamily:fm}}>$129<span style={{fontSize:13,fontWeight:400,color:K.dim}}>/yr</span></div>
          <div style={{fontSize:11,color:K.grn,marginBottom:14}}>Save 17% — $10.75/mo</div>
          <button onClick={function(){startCheckout(process.env.NEXT_PUBLIC_STRIPE_ANNUAL||"price_1T8P8AB5sSVol2sM8w18CHMi")}} disabled={loading==="annual"} style={Object.assign({},S.btnP,{width:"100%",padding:"10px",fontSize:13,opacity:loading==="annual"?.5:1})}>{loading==="annual"?"Redirecting…":"Start Annual"}</button></div></div>
      <div style={{textAlign:"center",fontSize:11,color:K.dim,lineHeight:1.6}}>Free forever: unlimited companies, thesis editor, conviction tracking, weekly reviews, decision journal, all process tools</div>
    </Modal>}
  function ScenarioModal(){if(!sel)return null;var c=sel;var sid=modal?modal.data:null;var scenarios=c.scenarios||[];var existing=sid?scenarios.find(function(s){return s.id===sid}):null;var pos=c.position||{};var conv=c.conviction||0;var hasDivs=((c.divPerShare||0)+(c.lastDiv||0))>0;var posVal=pos.shares>0&&pos.currentPrice>0?(pos.shares*pos.currentPrice):0;
    var prompts=[{id:"drawdown",cat:"Price",q:c.ticker+" drops 40% in 30 days with no fundamental news. Your position goes from $"+(posVal>0?Math.round(posVal).toLocaleString():"X")+" to $"+(posVal>0?Math.round(posVal*0.6).toLocaleString():"Y")+". What do you do?",icon:"trending"},{id:"ceo_exit",cat:"Management",q:c.name+"'s CEO "+(c.ceo||"")+" unexpectedly resigns. No successor named. Hold, trim, or sell?",icon:"alert"},{id:"competitor",cat:"Competition",q:"A well-funded competitor launches a product 30% cheaper and arguably better than "+c.ticker+"'s core offering. How does this affect your thesis?",icon:"search"},{id:"kpi_miss",cat:"Thesis",q:c.ticker+" misses your most important KPI for 3 consecutive quarters. At what point does this break your thesis?",icon:"target"},{id:"concentration",cat:"Sizing",q:c.ticker+" runs up 80% and now represents a large portion of your portfolio. Trim to rebalance, or let winners run?",icon:"bar"},{id:"recession",cat:"Macro",q:"A severe recession hits. "+c.ticker+"'s revenue drops 25% YoY. Stock down 50% from entry. You believe in the 10-year thesis. What's your move?",icon:"shield"},{id:"short_attack",cat:"Psychology",q:"A prominent short seller publishes a report alleging accounting irregularities at "+c.ticker+". Stock drops 20% pre-market. What do you do?",icon:"alert"},{id:"double",cat:"Psychology",q:c.ticker+" doubles in 6 months. Conviction is "+conv+"/10. Thesis unchanged. Take profits, hold, or add?",icon:"trending"}];
    if(hasDivs)prompts.push({id:"div_cut",cat:"Income",q:c.ticker+" announces a 50% dividend cut. Stock drops 15%. Does this change your thesis?",icon:"dollar"});
    prompts.push({id:"sell_all",cat:"Psychology",q:"If you had to sell "+c.ticker+" today and never buy it back, how would you feel? What would you miss most?",icon:"lightbulb"});
    var answered=scenarios.map(function(s){return s.promptId});
    var _selP=useState(existing?existing.promptId:null),selPrompt=_selP[0],setSelPrompt=_selP[1];
    var _resp=useState(existing?existing.response:""),resp=_resp[0],setResp=_resp[1];
    var activePrompt=prompts.find(function(p2){return p2.id===selPrompt});
    function doSave(){if(!selPrompt||!resp.trim())return;var entry={id:existing?existing.id:nId(scenarios),promptId:selPrompt,prompt:activePrompt?activePrompt.q:"",category:activePrompt?activePrompt.cat:"",response:resp.trim(),answeredAt:new Date().toISOString()};
      if(existing){upd(selId,function(prev){return Object.assign({},prev,{scenarios:(prev.scenarios||[]).map(function(s){return s.id===existing.id?entry:s})})})}
      else{upd(selId,function(prev){return Object.assign({},prev,{scenarios:(prev.scenarios||[]).concat([entry])})})}
      setModal(null)}
    return<Modal title={"Stress Test \u2014 "+c.ticker} onClose={function(){setModal(null)}} w={600} K={K}>
      <div style={{fontSize:13,color:K.mid,lineHeight:1.7,marginBottom:16}}>Plan your response to difficult situations before they happen — when your mind is clear and emotions are quiet.</div>
      {!selPrompt&&<div>
        <div style={{fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:10}}>Choose a scenario</div>
        <div style={{display:"grid",gap:8}}>{prompts.map(function(p2){var done=answered.indexOf(p2.id)>=0;
            return<div key={p2.id} onClick={function(){setSelPrompt(p2.id);var ex=scenarios.find(function(s){return s.promptId===p2.id});if(ex)setResp(ex.response)}} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 16px",background:done?K.grn+"06":K.card,border:"1px solid "+(done?K.grn+"25":K.bdr),borderRadius:10,cursor:"pointer"}}>
              <div style={{width:32,height:32,borderRadius:8,background:done?K.grn+"12":K.acc+"10",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done?<IC name="check" size={14} color={K.grn}/>:<IC name={p2.icon} size={14} color={K.acc}/>}</div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:10,fontWeight:600,color:done?K.grn:K.acc,fontFamily:fm,letterSpacing:1,marginBottom:3}}>{p2.cat.toUpperCase()}</div>
                <div style={{fontSize:13,color:K.txt,lineHeight:1.5}}>{p2.q.substring(0,120)}{p2.q.length>120?"...":""}</div>
                {done&&<div style={{fontSize:10,color:K.dim,marginTop:4,fontFamily:fm}}>Answered {fD(scenarios.find(function(s){return s.promptId===p2.id}).answeredAt)}</div>}</div></div>})}</div></div>}
      {selPrompt&&activePrompt&&<div>
        <button onClick={function(){setSelPrompt(null);setResp("")}} style={{background:"none",border:"none",color:K.acc,fontSize:12,cursor:"pointer",fontFamily:fm,padding:0,marginBottom:12}}>{"\u2190 Back to scenarios"}</button>
        <div style={{background:K.acc+"08",border:"1px solid "+K.acc+"20",borderRadius:10,padding:"14px 18px",marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,color:K.acc,fontFamily:fm,letterSpacing:1,marginBottom:6}}>{activePrompt.cat.toUpperCase()}</div>
          <div style={{fontSize:14,color:K.txt,lineHeight:1.7}}>{activePrompt.q}</div></div>
        <label style={{display:"block",fontSize:13,color:K.dim,marginBottom:8,fontFamily:fm,fontWeight:600}}>Your plan</label>
        <textarea value={resp} onChange={function(e){setResp(e.target.value)}} placeholder="Write your honest response. What would you actually do?" rows={6} style={{width:"100%",boxSizing:"border-box",background:_isThesis?"rgba(255,255,255,0.05)":K.bg,border:"1px solid "+K.bdr,borderRadius:_isThesis?14:6,color:K.txt,padding:"14px 18px",fontSize:14,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.7}}/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:12}}>
          {existing&&<button style={S.btnD} onClick={function(){upd(selId,function(prev){return Object.assign({},prev,{scenarios:(prev.scenarios||[]).filter(function(s){return s.id!==existing.id})})});setModal(null)}}>Delete</button>}
          <div style={{flex:1}}/><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button>
          <button style={Object.assign({},S.btnP,{opacity:resp.trim().length>10?1:.4})} onClick={doSave}>Save Plan</button></div></div>}
    </Modal>}
  // ── Valuation Modal ──
  var VALUATION_METRICS=[
    {id:"pe",label:"P/E Ratio",desc:"Price to earnings. Lower = cheaper relative to profits.",unit:"x",defaultRule:"lte",defaultVal:25,snap:"pe",calc:null},
    {id:"peg",label:"PEG Ratio",desc:"P/E divided by growth rate. Below 1 suggests undervalued growth.",unit:"x",defaultRule:"lte",defaultVal:1.5,snap:"peg",calc:function(s){if(s.peg&&s.peg.numVal!=null)return s.peg.numVal;var pe=s.pe&&s.pe.numVal?s.pe.numVal:(s.pe?parseFloat(String(s.pe.value).replace(/[^0-9.]/g,""))||0:0);var g=s.epsGrowth&&s.epsGrowth.numVal?Math.abs(s.epsGrowth.numVal):(s.revGrowth&&s.revGrowth.numVal?Math.abs(s.revGrowth.numVal):0);return(pe>0&&g>0)?(pe/g):null}},
    {id:"pb",label:"P/B Ratio",desc:"Price to book value. Below 1 means trading below asset value.",unit:"x",defaultRule:"lte",defaultVal:3,snap:"pb",calc:null},
    {id:"fcfYield",label:"FCF Yield",desc:"Free cash flow per share / price. Higher = more cash generated per dollar invested.",unit:"%",defaultRule:"gte",defaultVal:4,snap:"fcfYield",calc:function(s,p){var fcy=s.fcfYield&&s.fcfYield.numVal!=null?s.fcfYield.numVal:null;if(fcy!=null)return fcy;var fcfN=s.fcf&&s.fcf.numVal!=null?s.fcf.numVal:null;var fcf=fcfN!=null?fcfN:(s.fcf?parseFloat(String(s.fcf.value).replace(/[^0-9.\-]/g,""))||0:0);var pr=p>0?p:(s.livePrice&&s.livePrice.numVal?s.livePrice.numVal:0);return(fcf!==0&&pr>0)?(fcf/pr*100):null}},
    {id:"earningsYield",label:"Earnings Yield",desc:"Inverse of P/E (earnings/price). Compare to bond yields.",unit:"%",defaultRule:"gte",defaultVal:5,snap:null,calc:function(s){var pe=s.pe&&s.pe.numVal?s.pe.numVal:0;return pe>0?(1/pe*100):null}},
    {id:"evEbitda",label:"EV/EBITDA",desc:"Enterprise value to EBITDA. Lower = cheaper on a cash flow basis.",unit:"x",defaultRule:"lte",defaultVal:15,snap:"evEbitda",calc:null},
    {id:"divYield",label:"Dividend Yield",desc:"Annual dividend / price. Income return on investment.",unit:"%",defaultRule:"gte",defaultVal:2,snap:null,calc:function(s,p,c){var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;return(dps>0&&p>0)?(dps*mult/p*100):null}},
    {id:"priceToFcf",label:"Price / FCF",desc:"Price to free cash flow per share. Lower = cheaper.",unit:"x",defaultRule:"lte",defaultVal:20,snap:null,calc:function(s,p){var fcf=s.fcf&&s.fcf.numVal!=null?s.fcf.numVal:(s.fcf?parseFloat(String(s.fcf.value||"").replace(/[^0-9.\-]/g,""))||null:null);return(fcf!=null&&fcf>0&&p>0)?(p/fcf):null}},
    {id:"grossMargin",label:"Gross Margin",desc:"Pricing power indicator. Higher = stronger moat.",unit:"%",defaultRule:"gte",defaultVal:40,snap:"grossMargin",calc:null},
    {id:"roic",label:"ROIC",desc:"Return on invested capital. Measures capital efficiency.",unit:"%",defaultRule:"gte",defaultVal:15,snap:"roic",calc:null},
    {id:"debtEquity",label:"Debt / Equity",desc:"Financial leverage. Lower = less risk.",unit:"x",defaultRule:"lte",defaultVal:1,snap:"debtEquity",calc:null}
  ];
  function getValMetricValue(vm,snap,price,company){
    if(vm.calc){var v=vm.calc(snap,price,company);return v}
    if(vm.snap&&snap[vm.snap]){var sv=snap[vm.snap];return sv.numVal!=null?sv.numVal:parseFloat(String(sv.value).replace(/[^0-9.\-]/g,""))||null}
    return null}
  function ValuationModal(){if(!sel)return null;var c=sel;var snap=c.financialSnapshot||{};var price=(c.position||{}).currentPrice||(snap.livePrice&&snap.livePrice.numVal?snap.livePrice.numVal:0)||(snap.pe&&snap.eps?(parseFloat(String(snap.pe.value).replace(/[^0-9.]/g,""))||0)*(parseFloat(String(snap.eps.value).replace(/[^0-9.\-]/g,""))||0):0);
    var existing=c.valuation||{metrics:[]};
    var _vm=useState(existing.metrics.length>0?existing.metrics:VALUATION_METRICS.slice(0,4).map(function(m){return{id:m.id,threshold:m.defaultVal,rule:m.defaultRule}})),vMetrics=_vm[0],setVMetrics=_vm[1];
    var _adding=useState(false),adding=_adding[0],setAdding=_adding[1];
    function toggleMetric(id){setVMetrics(function(prev){var exists=prev.find(function(m){return m.id===id});if(exists)return prev.filter(function(m){return m.id!==id});var def=VALUATION_METRICS.find(function(m){return m.id===id});return prev.concat([{id:id,threshold:def.defaultVal,rule:def.defaultRule}])})}
    function updateThreshold(id,val){setVMetrics(function(prev){return prev.map(function(m){return m.id===id?Object.assign({},m,{threshold:parseFloat(val)||0}):m})})}
    function updateRule(id,rule){setVMetrics(function(prev){return prev.map(function(m){return m.id===id?Object.assign({},m,{rule:rule}):m})})}
    function doSave(){upd(selId,function(prev){return Object.assign({},prev,{valuation:{metrics:vMetrics,updatedAt:new Date().toISOString()}})});setModal(null)}
    var activeIds=vMetrics.map(function(m){return m.id});
    return<Modal title={"Valuation Framework \u2014 "+c.ticker} onClose={function(){setModal(null)}} w={560} K={K}>
      <div style={{fontSize:13,color:K.mid,lineHeight:1.7,marginBottom:16}}>Define what “good value” means to you. Pick metrics and set your thresholds — the system will tell you when the numbers match your criteria.</div>
      {/* Active metrics */}
      {vMetrics.map(function(vm){var def=VALUATION_METRICS.find(function(m){return m.id===vm.id});if(!def)return null;
        var current=getValMetricValue(def,snap,price,c);
        var pass=current!=null&&vm.threshold>0?(vm.rule==="gte"?current>=vm.threshold:current<=vm.threshold):null;
        return<div key={vm.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:K.bg,borderRadius:10,border:"1px solid "+K.bdr,marginBottom:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:K.txt}}>{def.label}</div>
            <div style={{fontSize:11,color:K.dim,marginTop:2}}>{def.desc}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <select value={vm.rule} onChange={function(e){updateRule(vm.id,e.target.value)}} style={{background:_isThesis?"rgba(255,255,255,0.05)":K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"4px 6px",fontSize:11,fontFamily:fm}}>
              <option value="lte">{"\u2264"}</option><option value="gte">{"\u2265"}</option></select>
            <input type="number" value={vm.threshold} onChange={function(e){updateThreshold(vm.id,e.target.value)}} style={{width:56,background:_isThesis?"rgba(255,255,255,0.05)":K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"4px 8px",fontSize:12,fontFamily:fm,textAlign:"right"}}/>
            <span style={{fontSize:10,color:K.dim,width:14}}>{def.unit}</span>
            {current!=null&&<span style={{fontSize:12,fontWeight:700,color:pass?K.grn:K.red,fontFamily:fm,minWidth:44,textAlign:"right"}}>{current.toFixed(def.unit==="%"?1:current<1?2:1)}</span>}
            {current==null&&<span style={{fontSize:11,color:K.dim,fontFamily:fm,minWidth:44,textAlign:"right"}}>{"\u2014"}</span>}
            <button onClick={function(){toggleMetric(vm.id)}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:14,padding:2}}>{"\u00D7"}</button></div></div>})}
      {/* Add more */}
      {!adding&&<button onClick={function(){setAdding(true)}} style={{background:"none",border:"1px dashed "+K.acc+"40",borderRadius:8,color:K.acc,fontSize:12,cursor:"pointer",padding:"8px 14px",width:"100%",fontFamily:fm}}>+ Add metric</button>}
      {adding&&<div style={{border:"1px solid "+K.bdr,borderRadius:10,padding:"10px 14px",marginTop:4}}>
        <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:8}}>Choose a metric</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{VALUATION_METRICS.filter(function(m){return activeIds.indexOf(m.id)<0}).map(function(m){return<div key={m.id} onClick={function(){toggleMetric(m.id);setAdding(false)}} style={{padding:"8px 10px",borderRadius:6,border:"1px solid "+K.bdr,cursor:"pointer",background:K.bg}} onMouseEnter={function(e){e.currentTarget.style.borderColor=K.acc}} onMouseLeave={function(e){e.currentTarget.style.borderColor=K.bdr}}>
          <div style={{fontSize:12,fontWeight:600,color:K.txt}}>{m.label}</div>
          <div style={{fontSize:10,color:K.dim}}>{m.desc.substring(0,50)}</div></div>})}</div>
        <button onClick={function(){setAdding(false)}} style={{background:"none",border:"none",color:K.dim,fontSize:11,cursor:"pointer",marginTop:6}}>Cancel</button></div>}
      {/* Save */}
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}>
        <button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button>
        <button style={S.btnP} onClick={doSave}>Save Framework</button></div>
    </Modal>}
  function EarningsReportModal(){
    if(!sel)return null;var c=sel;
    var idx=modal&&modal.data!=null?modal.data:0;
    var entries=c.earningsHistory||[];
    var e=entries[idx];
    if(!e)return<Modal title="Earnings Report" onClose={function(){setModal(null)}} w={540} K={K}><div style={{color:K.dim,fontSize:13,textAlign:"center",padding:"32px 0"}}>No earnings data yet. Hit Check Earnings first.</div></Modal>;
    var snap=c.financialSnapshot||{};
    var snapItems=[];
    var snapKeys=["eps","grossMargin","opMargin","netMargin","roe","roic","revGrowth","epsGrowth","fcf","pe","pb","debtEquity","currentRatio","divYield","revPerShare"];
    snapKeys.forEach(function(k2){if(snap[k2]&&snap[k2].value)snapItems.push({l:snap[k2].label,v:snap[k2].value,beat:snap[k2].beat})});
    return<Modal title={(e.quarter||"Latest")+" — "+c.ticker+" Earnings"} onClose={function(){setModal(null)}} w={560} K={K}>
      {/* Quarter nav */}
      {entries.length>1&&<div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {entries.map(function(eq,qi){return<button key={qi} onClick={function(){setModal({type:"earningsReport",data:qi})}} style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontFamily:fm,fontWeight:qi===idx?700:400,background:qi===idx?K.acc+"18":"transparent",border:"1px solid "+(qi===idx?K.acc:K.bdr),color:qi===idx?K.acc:K.mid,cursor:"pointer"}}>{eq.quarter||"Q?"}</button>})}
      </div>}
      {/* Summary */}
      {e.summary&&<div style={{background:K.bg,borderRadius:10,padding:"14px 16px",marginBottom:16,fontSize:13,color:K.txt,lineHeight:1.7,border:"1px solid "+K.bdr}}>{e.summary}</div>}
      {/* KPI results */}
      {e.results&&e.results.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:K.dim,fontFamily:fm,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>KPI Scorecard</div>
        {e.results.map(function(r2,ri){
          var col=r2.status==="met"?K.grn:r2.status==="unclear"?K.dim:K.red;
          var icon=r2.status==="met"?"✓":r2.status==="unclear"?"?":"✗";
          return<div key={ri} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",borderBottom:"1px solid "+K.bdr+"40"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:col+"15",border:"1px solid "+col+"40",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,fontWeight:700,color:col}}>{icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:K.txt}}>{r2.kpi_name}</div>
              {r2.excerpt&&<div style={{fontSize:11,color:K.dim,marginTop:1,lineHeight:1.4}}>{r2.excerpt}</div>}
            </div>
            {r2.actual_value!=null&&<div style={{fontSize:13,fontWeight:700,color:col,fontFamily:fm,flexShrink:0}}>{(function(){var v=r2.actual_value;var abs=Math.abs(v);return(abs>=1000?v.toFixed(0):abs>=10?v.toFixed(1):v.toFixed(2))})()}</div>}
          </div>})}
      </div>}
      {/* Financial snapshot */}
      {snapItems.length>0&&<div>
        <div style={{fontSize:11,fontWeight:700,color:K.dim,fontFamily:fm,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Financial Snapshot</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {snapItems.map(function(si,i){return<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",borderRadius:6,background:K.bg,border:"1px solid "+K.bdr}}>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{si.l}</span>
            <span style={{fontSize:12,fontWeight:600,color:si.beat===true?K.grn:si.beat===false?K.red:K.txt,fontFamily:fm}}>{si.v}</span>
          </div>})}
        </div>
      </div>}
      {/* Source */}
      {e.sourceUrl&&<div style={{marginTop:16,paddingTop:12,borderTop:"1px solid "+K.bdr,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:K.dim}}>{e.sourceLabel||"Source"}</span>
        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:K.blue,textDecoration:"none"}}>Open source ↗</a>
      </div>}
    </Modal>}

  function EarningsPopup(){
    if(!modal||modal.type!=="earningsPopup")return null;
    var d=modal.data||{};var kpis=d.kpis||[];
    var metCount=kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;
    var allMet=metCount===kpis.length&&kpis.length>0;
    var ticker=d.ticker||"";var quarter=d.quarter||"Latest";var srcLabel=d.sourceLabel||"FMP";
    function fmtVal(v,unit){if(v==null)return"—";var abs=Math.abs(v);return(abs>=1000?Number(v).toFixed(0):abs>=10?Number(v).toFixed(1):Number(v).toFixed(2))+(unit||"")}
    return<div style={{position:"fixed",inset:0,zIndex:10001,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,.72)"}} onClick={function(e){if(e.target===e.currentTarget)setModal(null)}}>
      <div style={{background:"#fff",borderRadius:22,padding:"26px 26px 22px",maxWidth:460,width:"100%",boxShadow:"0 32px 80px rgba(0,0,0,.28)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:8}}>
              <span style={{fontSize:26,fontWeight:800,color:"#1a1a2e",letterSpacing:"-0.5px"}}>{ticker}</span>
              <span style={{fontSize:15,color:"#9ca3af",fontWeight:500}}>{quarter} Earnings</span>
            </div>
            <span style={{fontSize:11,fontWeight:700,color:allMet?"#16a34a":metCount>0?"#d97706":"#dc2626",background:allMet?"#f0fdf4":metCount>0?"#fffbeb":"#fef2f2",border:"1px solid "+(allMet?"#bbf7d0":metCount>0?"#fde68a":"#fecaca"),borderRadius:20,padding:"3px 10px",fontFamily:fm}}>
              {metCount}/{kpis.length} KPIs met {allMet?"🎉":metCount>0?"✓":"😬"}
            </span>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            <button onClick={function(){setModal(null)}} style={{background:"#f3f4f6",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#6b7280",fontSize:16,lineHeight:1}}>×</button>
            <span style={{fontSize:10,fontWeight:600,color:"#9ca3af",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:"2px 8px",fontFamily:fm}}>Live Data: {srcLabel}</span>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
          {kpis.map(function(k,i){var res=k.lastResult;var met=res&&res.status==="met";var missed=res&&res.status==="missed";
            var unit=METRIC_MAP[k.metricId]?METRIC_MAP[k.metricId].unit:"";
            var val=res&&res.actual!=null?fmtVal(res.actual,unit):"—";
            var bg=met?"#f0fdf4":missed?"#fef2f2":"#f9fafb";var border=met?"#bbf7d0":missed?"#fecaca":"#e5e7eb";var vc=met?"#16a34a":missed?"#dc2626":"#374151";
            return<div key={i} style={{background:bg,border:"2px solid "+border,borderRadius:14,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",letterSpacing:2,textTransform:"uppercase",fontFamily:fm,marginBottom:4}}>{k.name}</div>
                <div style={{fontSize:32,fontWeight:800,color:vc,letterSpacing:"-0.5px",lineHeight:1}}>{val}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:"#9ca3af",fontFamily:fm,marginBottom:6}}>Target: {k.target}</div>
                {met&&<div style={{background:"#16a34a",color:"#fff",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,fontFamily:fm}}>✓ MET 🎉</div>}
                {missed&&<div style={{background:"#dc2626",color:"#fff",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,fontFamily:fm}}>✗ MISSED</div>}
                {!met&&!missed&&<div style={{background:"#e5e7eb",color:"#6b7280",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,fontFamily:fm}}>? UNCLEAR</div>}
              </div>
            </div>})}
        </div>
        {d.summary&&<div style={{background:"#f9fafb",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#6b7280",lineHeight:1.6}}>{d.summary.substring(0,200)}{d.summary.length>200?"…":""}</div>}
        <div style={{display:"flex",gap:8}}>
          <button style={{flex:1,background:"#1a1a2e",color:"#fff",border:"none",borderRadius:10,padding:"11px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={function(){setModal({type:"conviction"})}}>{allMet?"🎯 Rate Conviction":"Update Conviction"}</button>
          <button style={{background:"#f3f4f6",color:"#374151",border:"none",borderRadius:10,padding:"11px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={function(){setModal({type:"earningsReport",data:0})}}>Full Report</button>
        </div>
      </div>
    </div>}

  function renderModal(){if(!modal)return null;var map={add:AddModal,edit:EditModal,thesis:ThesisModal,kpi:KpiModal,result:ResultModal,del:DelModal,doc:DocModal,memo:MemoModal,clip:ClipModal,irentry:IREntryModal,position:PositionModal,conviction:ConvictionModal,manualEarnings:ManualEarningsModal,earningsReport:EarningsReportModal,earningsPopup:EarningsPopup,settings:SettingsModal,csvImport:CSVImportModal,scenario:ScenarioModal,valuation:ValuationModal};var C=map[modal.type];return C?<C/>:null}

  // ── Onboarding Flow ──────────────────────────────────────
  function finishOnboarding(){setObStep(0);try{localStorage.setItem("ta-onboarded","true")}catch(e){}
    setTimeout(function(){refreshPrices()},500)}

  // ── Dossier Spotlight Tour ───────────────────────────────
  function DossierTour(){
    var co=cos.find(function(c){return c.id===oCoId})||sel;
    var tick=co?co.ticker:"your company";
    var TOUR=[
      {step:1,sectionId:"ds-ledger",color:"#F59E0B",icon:"trending",
       title:"Rate your conviction",
       body:"How confident are you in this investment, 1–10? Conviction tracking is the habit that separates great investors from reactive ones. Update it every quarter and after every earnings report.",
       action:"Rate Conviction",onAction:function(){setModal({type:"conviction"})}},
      {step:2,sectionId:"ds-evidence",color:"#3B82F6",icon:"target",
       title:"Check the first earnings report",
       body:"When "+tick+" reports next quarter, hit Check Earnings. ThesisAlpha fetches the results and instantly compares them to your KPIs. One click, instant verdict.",
       action:null,onAction:null},
      {step:3,sectionId:null,color:"#22C55E",icon:"castle",
       title:"Classify the moat",
       body:"What actually protects "+tick+" from competition? Network effects? Switching costs? Brand? The Moat Tracker scores 8 dimensions and builds a composite moat strength.",
       action:"Open Moat Tracker",onAction:function(){setSubPage("moat")}},
      {step:4,sectionId:"ds-score",color:"#8B5CF6",icon:"shield",
       title:"Your Owner\'s Score",
       body:"This radar shows how well you understand "+tick+". Thesis depth, KPI discipline, conviction, fundamentals, moat, monitoring — all in one view.",
       action:null,onAction:null},
      {step:5,sectionId:null,color:"#EC4899",icon:"lightbulb",
       title:"Two more powerful tools",
       body:"Set a valuation framework — what price is actually fair for "+tick+"? And run a conviction stress test — what single event would make you sell? Investors who pre-commit to these answers make far better decisions in the heat of earnings season.",
       action:"Set Valuation",onAction:function(){setModal({type:"valuation"})}},
    ];
    var cur=TOUR.find(function(t){return t.step===tourStep});
    // Style injection side-effect — runs after paint, safe
    useEffect(function(){
      var styleId="ta-tour-style";
      var styleEl=document.getElementById(styleId);
      if(!styleEl){styleEl=document.createElement("style");styleEl.id=styleId;document.head.appendChild(styleEl)}
      if(cur&&cur.sectionId){
        styleEl.textContent=
          "#"+cur.sectionId+"{outline:2px solid "+cur.color+";outline-offset:4px;border-radius:12px;}"+
          "@keyframes ta-tour-pulse{0%,100%{outline-color:"+cur.color+"}50%{outline-color:"+cur.color+"88}}"+
          "#"+cur.sectionId+"{animation:ta-tour-pulse 1.6s ease-in-out infinite}"
      }else{styleEl.textContent=""}
      // Scroll current section into view
      if(cur&&cur.sectionId){var el=document.getElementById(cur.sectionId);if(el)el.scrollIntoView({behavior:"smooth",block:"center"})}
      return function(){var s=document.getElementById("ta-tour-style");if(s)s.textContent=""}
    },[tourStep]);
    if(!cur)return null;
    var isLast=tourStep===TOUR.length;
    function advance(){
      if(isLast){setTourStep(0);showToast("You know your way around. Go build something worth owning.","info",4000)}
      else{setTourStep(function(s){return s+1})}}
    function dismiss(){setTourStep(0)}
    return<div style={{position:"fixed",bottom:24,right:24,zIndex:8000,width:300,background:K.card,borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,.3)",border:"1px solid "+K.bdr,overflow:"hidden"}}>
      <div style={{height:3,background:cur.color,width:(tourStep/TOUR.length*100)+"%",transition:"width .4s ease"}}/>
      <div style={{padding:"16px 18px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:30,height:30,borderRadius:8,background:cur.color+"20",border:"1px solid "+cur.color+"40",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <IC name={cur.icon} size={14} color={cur.color}/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:cur.color,fontFamily:fm,textTransform:"uppercase",letterSpacing:0.8}}>{tourStep} of {TOUR.length}</div>
              <div style={{fontSize:14,fontWeight:700,color:K.txt,lineHeight:1.2}}>{cur.title}</div>
            </div>
          </div>
          <button onClick={dismiss} style={{background:"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:"0 2px",lineHeight:1,flexShrink:0}}>{"×"}</button>
        </div>
        <p style={{fontSize:12,color:K.mid,lineHeight:1.65,margin:"0 0 14px"}}>{cur.body}</p>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {cur.action&&cur.onAction&&<button onClick={function(){cur.onAction();advance()}} style={Object.assign({},S.btn,{fontSize:11,padding:"6px 12px",color:cur.color,borderColor:cur.color+"40",flex:1})}>{cur.action}</button>}
          <button onClick={advance} style={Object.assign({},S.btnP,{fontSize:12,padding:"7px 16px",flex:cur.action&&cur.onAction?0:1,background:cur.color,borderColor:cur.color})}>{isLast?"Done ✓":"Next →"}</button>
        </div>
      </div>
    </div>}

  // ── Sidebar + TopBar ──────────────────────────────────────
  var _sq=useState(""),sideSearch=_sq[0],setSideSearch=_sq[1];
  function Sidebar(){var pCos=cos.filter(function(c){return(c.status||"portfolio")===sideTab});
    if(sideSearch.trim()){var q=sideSearch.toLowerCase();pCos=pCos.filter(function(c){return c.ticker.toLowerCase().indexOf(q)>=0||c.name.toLowerCase().indexOf(q)>=0||(c.sector||"").toLowerCase().indexOf(q)>=0})}
    if(isMobile&&!sideOpen)return null;
    function navClick(fn){return function(){fn();if(isMobile)setSideOpen(false)}}
    return<div>{isMobile&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:299}} onClick={function(){setSideOpen(false)}}/>}
    <div style={{width:isMobile?300:isThesis?268:240,minWidth:isMobile?300:isThesis?268:240,background:K.side,borderRight:"1px solid "+K.bdr,height:"100vh",position:isMobile?"fixed":"sticky",top:0,left:0,display:"flex",flexDirection:"column",overflowY:"auto",zIndex:isMobile?300:1,boxShadow:isMobile?"4px 0 24px rgba(0,0,0,.3)":isThesis?"4px 0 40px rgba(0,0,0,.2)":"none",transition:"transform .2s ease"}}>
    <div style={{padding:isThesis?"22px 20px":"18px 20px",borderBottom:"1px solid "+(sideDark?K.bdr2:K.bdr),display:"flex",alignItems:"center",gap:isThesis?12:10,cursor:"pointer"}} onClick={navClick(function(){setSelId(null)})}><TLogo size={isThesis?30:22} dark={sideDark}/><span style={{fontSize:isThesis?15:13,fontWeight:isThesis?800:600,color:sideText,letterSpacing:isThesis?"-0.3px":1.5,fontFamily:fm}}>ThesisAlpha</span>{isMobile&&<div style={{flex:1}}/> }{isMobile&&<button onClick={function(){setSideOpen(false)}} style={{background:"none",border:"none",color:sideDim2,fontSize:18,cursor:"pointer",padding:4}}>{"✕"}</button>}</div>
    {!isMobile&&<div style={{padding:"10px 14px",borderBottom:"1px solid "+(sideDark?K.bdr2:K.bdr)}} onClick={function(e){e.stopPropagation();setCmdOpen(true);setCmdQuery("");setCmdIdx(0)}}>
      <div style={{display:"flex",alignItems:"center",gap:8,background:sideDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)",borderRadius:isThesis?10:6,padding:"7px 12px",cursor:"text",border:"1px solid "+(sideDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)"),transition:"border-color .15s"}} onMouseEnter={function(e){e.currentTarget.style.borderColor=K.acc+"50"}} onMouseLeave={function(e){e.currentTarget.style.borderColor=sideDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)"}}>
        <IC name="search" size={13} color={sideDim2}/>
        <span style={{flex:1,fontSize:12,color:sideDim2,fontFamily:fm}}>Search…</span>
        <span style={{fontSize:10,color:sideDim2,fontFamily:fm,background:sideDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",borderRadius:4,padding:"1px 5px",letterSpacing:.3}}>⌘K</span>
      </div>
    </div>}
    <div style={{position:"relative"}} onMouseEnter={function(e){setSideHover("portfolio");setFlyY(e.currentTarget.getBoundingClientRect().top)}} onMouseLeave={function(){setSideHover(null)}}>
    <div style={{padding:"12px 20px",cursor:"pointer",background:!selId&&page==="dashboard"?(isThesis?K.acc+"18":K.blue+"10"):"transparent",borderLeft:isThesis?"none":(!selId&&page==="dashboard"?"2px solid "+K.blue:"2px solid transparent"),borderRadius:isThesis?"0 999px 999px 0":"0",marginRight:isThesis?10:0}} onClick={navClick(function(){setSelId(null);setPage("dashboard")})}><span style={{fontSize:isThesis?13:12,color:!selId&&page==="dashboard"?(isThesis?K.acc:K.blue):sideMid,fontWeight:!selId&&page==="dashboard"?700:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="overview" size={14} color={!selId&&page==="dashboard"?(isThesis?K.acc:K.blue):sideMid}/>Portfolio Overview</span></div>
    {sideHover==="portfolio"&&!isMobile&&<div style={{position:"fixed",left:(isThesis?272:244),top:flyY,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 0",boxShadow:"0 4px 16px rgba(0,0,0,.2)",zIndex:9999,minWidth:160}} onMouseEnter={function(){setSideHover("portfolio")}} onMouseLeave={function(){setSideHover(null)}}>
      {[{l:"Portfolio",pg:"dashboard",icon:"overview"},{l:"Analytics",pg:"analytics",icon:"bar"},{l:"Earnings Calendar",pg:"calendar",icon:"target"},{l:"Dividends",pg:"dividends",icon:"dollar"},{l:"Timeline",pg:"timeline",icon:"trending"}].map(function(sub){return<div key={sub.pg} onClick={navClick(function(){setSelId(null);setPage(sub.pg);setSideHover(null)})} style={{padding:"8px 16px",cursor:"pointer",fontSize:12,color:K.mid,fontFamily:fm,display:"flex",alignItems:"center",gap:8}} onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"10"}} onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}><IC name={sub.icon} size={12} color={K.dim}/>{sub.l}</div>})}</div>}</div>
    <div style={{position:"relative"}} onMouseEnter={function(e){setSideHover("hub");setFlyY(e.currentTarget.getBoundingClientRect().top)}} onMouseLeave={function(){setSideHover(null)}}>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="hub"?(isThesis?K.acc+"18":K.acc+"10"):"transparent",borderLeft:isThesis?"none":(page==="hub"?"2px solid "+K.acc:"2px solid transparent"),borderRadius:isThesis?"0 999px 999px 0":"0",marginRight:isThesis?10:0}} onClick={navClick(function(){setSelId(null);setPage("hub")})}><span style={{fontSize:isThesis?13:12,color:page==="hub"?K.acc:sideMid,fontWeight:page==="hub"?700:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="book" size={14} color={page==="hub"?K.acc:sideMid}/>Owner's Hub</span></div>
    {sideHover==="hub"&&!isMobile&&<div style={{position:"fixed",left:(isThesis?272:244),top:flyY,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 0",boxShadow:"0 4px 16px rgba(0,0,0,.2)",zIndex:9999,minWidth:160}} onMouseEnter={function(){setSideHover("hub")}} onMouseLeave={function(){setSideHover(null)}}>
      {[{l:"Command Center",t:"command",icon:"trending"},{l:"Investor Lenses",t:"lenses",icon:"search"},{l:"Research Journal",t:"journal",icon:"book"},{l:"Research Trail",t:"docs",icon:"file"},{l:"Reading List",t:"reading",icon:"book"},{l:"Performance & Goals",t:"goals",icon:"trending"},{l:"How It Works",t:"guide",icon:"lightbulb"}].map(function(sub){return<div key={sub.l} onClick={navClick(function(){setSelId(null);setPage("hub");setHubTab(sub.t);setSideHover(null)})} style={{padding:"8px 16px",cursor:"pointer",fontSize:12,color:K.mid,fontFamily:fm,display:"flex",alignItems:"center",gap:8}} onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"10"}} onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}><IC name={sub.icon} size={12} color={K.dim}/>{sub.l}</div>})}</div>}</div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="review"?(isThesis?K.grn+"18":K.grn+"10"):"transparent",borderLeft:isThesis?"none":(page==="review"?"2px solid "+K.grn:"2px solid transparent"),borderRadius:isThesis?"0 999px 999px 0":"0",marginRight:isThesis?10:0}} onClick={navClick(function(){setSelId(null);setPage("review")})}><span style={{fontSize:isThesis?13:12,color:page==="review"?K.grn:sideMid,fontWeight:page==="review"?700:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="shield" size={14} color={page==="review"?K.grn:sideMid}/>Weekly Review{!currentWeekReviewed&&<span style={{width:6,height:6,borderRadius:"50%",background:K.grn,display:"inline-block"}}/>}</span></div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="assets"?(isThesis?K.amb+"18":K.amb+"10"):"transparent",borderLeft:isThesis?"none":(page==="assets"?"2px solid "+K.amb:"2px solid transparent"),borderRadius:isThesis?"0 999px 999px 0":"0",marginRight:isThesis?10:0}} onClick={navClick(function(){setSelId(null);setPage("assets")})}><span style={{fontSize:isThesis?13:12,color:page==="assets"?K.amb:sideMid,fontWeight:page==="assets"?700:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="dollar" size={14} color={page==="assets"?K.amb:sideMid}/>All Assets</span></div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="library"?(isThesis?K.acc+"18":K.acc+"10"):"transparent",borderLeft:isThesis?"none":(page==="library"?"2px solid "+K.acc:"2px solid transparent"),borderRadius:isThesis?"0 999px 999px 0":"0",marginRight:isThesis?10:0}} onClick={navClick(function(){setSelId(null);setPage("library")})}><span style={{fontSize:isThesis?13:12,color:page==="library"?K.acc:sideMid,fontWeight:page==="library"?700:400,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><IC name="video" size={14} color={page==="library"?K.acc:sideMid}/>Library</span></div>
    {/* More pages accessible via links, not sidebar */}
    {/* Plan badge */}
    <div style={{padding:"10px 20px"}}>
      {plan==="pro"?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:K.grn+"10",border:"1px solid "+K.grn+"25",borderRadius:8,cursor:"pointer"}} onClick={openManage}>
        <span style={{fontSize:11,fontWeight:700,color:K.grn,fontFamily:fm,letterSpacing:1}}>PRO</span>
        <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>Manage plan</span></div>
      :trialActive?<div style={{padding:"10px 14px",background:K.acc+"08",border:"1px solid "+K.acc+"20",borderRadius:8}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,color:K.acc,fontFamily:fm,letterSpacing:1}}>TRIAL</span>
          <span style={{fontSize:11,color:trialDaysLeft<=3?K.red:trialDaysLeft<=7?K.amb:K.dim,fontWeight:600,fontFamily:fm}}>{trialDaysLeft}d left</span></div>
        {!trialBonusEarned&&<div>
          <div style={{display:"flex",gap:3,marginBottom:4}}>{[0,1,2].map(function(i){return<div key={i} style={{flex:1,height:4,borderRadius:2,background:i<thesisProgress?K.grn:K.bdr,transition:"background .3s"}}/>})}</div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{thesisProgress}/{THESIS_UNLOCK} theses {"→"} +{TRIAL_BONUS} days</div></div>}
        {trialBonusEarned&&<div style={{fontSize:10,color:K.grn,fontFamily:fm}}>{"✓"} Bonus earned — {TRIAL_TOTAL} day trial</div>}
        <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("trial-ending")}} style={{width:"100%",marginTop:8,padding:"7px 12px",background:K.acc+"12",border:"1px solid "+K.acc+"30",borderRadius:6,fontSize:11,fontWeight:600,color:K.acc,cursor:"pointer",fontFamily:fm,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Upgrade to Pro</button></div>
      :<button onClick={function(){setShowUpgrade(true);setUpgradeCtx(trialExpired?"trial-expired":"")}} style={{width:"100%",padding:"9px 14px",background:"transparent",border:"1px solid "+K.acc+"40",borderRadius:8,fontSize:12,color:K.acc,cursor:"pointer",fontFamily:fm,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Upgrade to Pro</button>}</div>
    <div style={{padding:"10px 16px 6px"}}>
      <select value={sideTab} onChange={function(e){setSideTab(e.target.value)}} style={{width:"100%",background:K.bg,border:"1px solid "+(sideTab==="portfolio"?K.acc:sideTab==="toohard"?K.red:K.amb)+"50",borderRadius:8,color:sideTab==="portfolio"?K.acc:sideTab==="toohard"?K.red:K.amb,padding:"9px 14px",fontSize:13,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
        <option value="portfolio">Portfolio ({cos.filter(function(c){return(c.status||"portfolio")==="portfolio"}).length})</option>
        <option value="watchlist">Watchlist ({cos.filter(function(c){return c.status==="watchlist"}).length})</option>
        <option value="toohard">Too Hard ({cos.filter(function(c){return c.status==="toohard"}).length})</option>
      </select>
      {cos.length>4&&<input value={sideSearch} onChange={function(e){setSideSearch(e.target.value)}} placeholder="Search..." style={{width:"100%",boxSizing:"border-box",marginTop:8,background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"7px 10px",fontSize:12,fontFamily:fm,outline:"none"}}/>}</div>
    {!isMobile&&pCos.length>0&&<div style={{padding:"4px 16px 0",display:"flex",gap:8,flexWrap:"wrap"}}>
      {[["↑↓","Navigate"],["N","Add"],["R","Review"],["T","Thesis"]].map(function(h){return<span key={h[0]} style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:sideDim2,fontFamily:fm}}>
        <span style={{background:sideDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)",borderRadius:3,padding:"1px 4px",fontWeight:600}}>{h[0]}</span>{h[1]}
      </span>})}
    </div>}
    <div style={{flex:1,overflowY:"auto",paddingTop:4}}>{pCos.map(function(c){var active=selId===c.id,h=gH(c.kpis),d=dU(c.earningsDate);
      var pos=c.position||{};var hasPrice=pos.currentPrice>0;var hasTarget=c.targetPrice>0&&hasPrice;
      var pctToTarget=hasTarget?((c.targetPrice-pos.currentPrice)/pos.currentPrice*100):0;
      var pctReturn=hasPrice&&pos.avgCost>0?((pos.currentPrice-pos.avgCost)/pos.avgCost*100):0;
      var isWatchlist=c.status==="watchlist";
      var thesisAge=c.thesisUpdatedAt?Math.ceil((new Date()-new Date(c.thesisUpdatedAt))/864e5):999;
      var thesisStaleIndicator=thesisAge>180?"●":thesisAge>90?"·":null;
      return<div key={c.id} className="ta-side-item" style={{padding:isThesis?"11px 18px 11px 20px":"10px 16px 10px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,background:active?(isThesis?K.acc+"15":K.blue+"10"):h.c+"08",borderLeft:isThesis?"none":(active?"2px solid "+K.blue:"2px solid transparent"),borderRadius:isThesis?"0 999px 999px 0":"0",marginRight:isThesis?10:0}} onClick={navClick(function(){setSelId(c.id);setExpKpi(null);setSubPage(null);setDetailTab("dossier");setPage("dashboard")})}>
        <div style={{position:"relative",flexShrink:0}}>
          <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
          {thesisStaleIndicator&&<span style={{position:"absolute",top:-3,right:-3,fontSize:7,color:thesisAge>180?K.amb:K.dim,lineHeight:1}}>{thesisStaleIndicator}</span>}
        </div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:active?sideText:sideMid,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:11,color:sideDim2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div></div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
          {hasPrice&&<div style={{fontSize:11,fontWeight:600,color:active?sideText:sideMid,fontFamily:fm}}>${pos.currentPrice.toFixed(pos.currentPrice<10?2:0)}</div>}
          {isWatchlist&&hasTarget&&<div style={{fontSize:10,color:pctToTarget>0?K.grn:K.amb,fontFamily:fm}}>{pctToTarget>0?pctToTarget.toFixed(0)+"% below":"At target"}</div>}
          {!isWatchlist&&hasPrice&&pos.avgCost>0&&<div style={{fontSize:10,color:pctReturn>=0?K.grn:K.red,fontFamily:fm}}>{pctReturn>=0?"+":""}{pctReturn.toFixed(1)}%</div>}
          {d>=0&&d<=7&&<div style={{fontSize:10,color:d<=2?K.red:K.amb,fontWeight:700,fontFamily:fm,background:(d<=2?K.red:K.amb)+"15",borderRadius:4,padding:"1px 5px"}}>{d===0?"Today":d===1?"Tmrw":d+"d"}</div>}
          {d>7&&d<=14&&<div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{d}d</div>}
          {!hasPrice&&(c.earningsDate==="TBD"||!c.earningsDate)&&<div style={{fontSize:10,color:sideDim2,fontFamily:fm}}>TBD</div>}
          <div style={{width:20,height:4,borderRadius:2,background:h.c,opacity:isDark?0.8:1,marginTop:1,boxShadow:isDark?"none":"0 0 0 1px "+h.c+"30"}}/></div></div>})}</div>
    <div style={{padding:"12px 16px",borderTop:"1px solid "+K.bdr,display:"flex",gap:6,flexDirection:"column"}}>
      {isMobile&&<button onClick={toggleTheme} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.mid,cursor:"pointer",fontSize:12,fontFamily:fm,width:"100%"}}>
        {isDark?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        {isDark?"Switch to Light":"Switch to Dark"}</button>}
      <div style={{display:"flex",gap:6}}>
        <button style={Object.assign({},S.btnP,{flex:1,padding:"8px",fontSize:12})} onClick={function(){setModal({type:"add"});if(isMobile)setSideOpen(false)}} title="Add holding (N)">+ Add</button>
        <button style={Object.assign({},S.btn,{padding:"8px 12px",fontSize:12})} onClick={function(){if(requirePro("import")){setModal({type:"csvImport"});if(isMobile)setSideOpen(false)}}} title="Bulk import tickers">Import</button></div></div></div></div>}
  function TopBar(){
    if(isMobile){return<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",height:54,borderBottom:"1px solid "+K.bdr,background:K.card+"f0",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50}}>
      {/* Left — hamburger */}
      <button onClick={function(){setSideOpen(true)}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:10,padding:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:36,height:36,flexShrink:0}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      {/* Centre — logo + wordmark */}
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={function(){setSelId(null);setPage("dashboard")}}>
        <TLogo size={24} dark={isDark}/>
        <span style={{fontSize:15,fontWeight:800,color:K.txt,fontFamily:fm,letterSpacing:"-0.3px"}}>ThesisAlpha</span></div>
      {/* Right — notifications + avatar only */}
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{position:"relative",cursor:"pointer",padding:4}} onClick={function(){setShowNotifs(!showNotifs);if(!showNotifs)setNotifs(function(p){return p.map(function(n){return Object.assign({},n,{read:true})})})}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={unread>0?K.txt:K.dim} strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {unread>0&&<div style={{position:"absolute",top:2,right:2,width:8,height:8,borderRadius:"50%",background:K.grn,border:"2px solid "+K.card}}/>}</div>
        <div style={{position:"relative",cursor:"pointer"}} onClick={function(){setShowProfile(!showProfile)}}>
          {avatarUrl?<img src={avatarUrl} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",border:"2px solid "+K.acc}}/>
            :<div style={{width:34,height:34,borderRadius:"50%",background:K.acc+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:K.acc,fontWeight:700,fontFamily:fm,border:"2px solid "+K.acc+"40"}}>{(username||props.user||"U")[0].toUpperCase()}</div>}</div></div>
      {showNotifs&&<div style={{position:"fixed",inset:0,zIndex:99}} onClick={function(){setShowNotifs(false)}}/>}
      {showNotifs&&<div className="ta-notif-panel" style={{position:"fixed",top:62,left:12,right:12,maxHeight:"70vh",overflowY:"auto",background:K.card,border:"1px solid "+K.bdr2,borderRadius:16,boxShadow:"0 16px 48px rgba(0,0,0,.3)",zIndex:100}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>Notifications</span>{notifs.length>0&&<button style={Object.assign({},S.btn,{padding:"4px 12px",fontSize:12})} onClick={function(){setNotifs([])}}>Clear</button>}</div>
        {notifs.length===0?<div style={{padding:"36px 18px",textAlign:"center",fontSize:14,color:K.dim}}>No notifications</div>:notifs.slice(0,15).map(function(n){return<div key={n.id} style={{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"flex-start",gap:10}} onClick={function(){if(n.type==="email-alert"){var fresh=cos.find(function(c){return c.ticker===n.ticker});if(fresh)sendEarningsEmail(fresh);setNotifs(function(p){return p.filter(function(x){return x.id!==n.id})})}}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:n.type==="found"?K.grn:n.type==="upcoming"?K.amb:n.type==="ready"?K.blue:n.type==="system"?K.acc:n.type==="price-alert"?"#9333EA":n.type==="milestone"?"#FFD700":n.type==="email-alert"?K.blue:K.dim,flexShrink:0,marginTop:5}}/><div><div style={{fontSize:14,color:K.txt,fontFamily:fm}}><strong>{n.ticker}</strong> <span style={{color:K.mid,fontWeight:400}}>{n.msg}</span></div><div style={{fontSize:12,color:K.dim,marginTop:4}}>{fT(n.time)}</div></div></div>})}
      </div>}
    </div>}
    return<div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"12px 32px",borderBottom:"1px solid "+K.bdr,background:K.card+"e6",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50,gap:12}}>
    <button onClick={toggleTheme} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}} title={theme==="light"?"Light":"Dark"+(theme==="forest"?" Forest":"")+(theme==="purple"?" Purple":"")+(((streakData.current||0)<1&&(theme==="dark"||theme==="light"))?" — streak 1 wk to unlock more themes":"")}>{isDark?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}</button>
    <div style={{position:"relative",cursor:"pointer",padding:4}} onClick={function(){setShowNotifs(!showNotifs);if(!showNotifs)setNotifs(function(p){return p.map(function(n){return Object.assign({},n,{read:true})})})}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={unread>0?K.mid:K.dim} strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      {unread>0&&<div style={{position:"absolute",top:1,right:1,width:8,height:8,borderRadius:"50%",background:K.grn,border:"2px solid "+K.card}}/>}</div>
    {showNotifs&&<div style={{position:"fixed",inset:0,zIndex:99}} onClick={function(){setShowNotifs(false)}}/>}
    {showNotifs&&<div className="ta-notif-panel" style={{position:"absolute",top:48,right:32,width:380,maxHeight:420,overflowY:"auto",background:K.card,border:"1px solid "+K.bdr2,borderRadius:12,boxShadow:"0 16px 48px rgba(0,0,0,.3)",zIndex:100}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Notifications</span>{notifs.length>0&&<button style={Object.assign({},S.btn,{padding:"2px 8px",fontSize:11})} onClick={function(){setNotifs([])}}>Clear</button>}</div>
      {notifs.length===0?<div style={{padding:"36px 18px",textAlign:"center",fontSize:13,color:K.dim}}>No notifications</div>:notifs.slice(0,15).map(function(n){return<div key={n.id} style={{padding:"12px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"flex-start",gap:10,cursor:n.type==="email-alert"?"pointer":"default"}} onClick={function(){if(n.type==="email-alert"){var fresh=cos.find(function(c){return c.ticker===n.ticker});if(fresh)sendEarningsEmail(fresh);setNotifs(function(p){return p.filter(function(x){return x.id!==n.id})})}}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:n.type==="found"?K.grn:n.type==="upcoming"?K.amb:n.type==="ready"?K.blue:n.type==="system"?K.acc:n.type==="price-alert"?"#9333EA":n.type==="milestone"?"#FFD700":n.type==="email-alert"?K.blue:K.dim,flexShrink:0,marginTop:4}}/><div><div style={{fontSize:13,color:K.txt,fontFamily:fm}}><strong>{n.ticker}</strong> <span style={{color:K.mid,fontWeight:400}}>{n.msg}</span>{n.type==="email-alert"&&<span style={{fontSize:11,color:K.blue,marginLeft:6}}>Send email</span>}</div><div style={{fontSize:11,color:K.dim,marginTop:3}}>{fT(n.time)}</div></div></div>})}</div>}
    <button onClick={function(){setModal({type:"settings"})}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}} title="Dashboard Settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
    <button onClick={function(){props.onLogout()}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,color:K.dim}} title="Log out"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
    <div style={{position:"relative",cursor:"pointer"}} onClick={function(){setShowProfile(!showProfile)}}>
      {avatarUrl?<img src={avatarUrl} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",border:"2px solid "+K.acc}}/>
        :<div style={{width:34,height:34,borderRadius:"50%",background:K.acc+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:K.acc,fontWeight:600,fontFamily:fm,border:"2px solid "+K.acc+"40"}}>{(username||props.user||"U")[0].toUpperCase()}</div>}
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}><IC name="link" size={14} color={K.dim}/>Research</div><button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:12})} onClick={function(){setAdding(!adding)}}>+ Add Link</button></div>
      {adding&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
        <Inp label="URL" value={url} onChange={setUrl} placeholder="https://..." K={K}/>
        <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Label (optional)" value={label} onChange={setLabel} placeholder="Article title" K={K}/><Sel label="Type" value={cat} onChange={setCat} options={cats} K={K}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:url.trim()?1:.4})} onClick={addLink}>Add</button></div></div>}
      {links.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:20,textAlign:"center",fontSize:13,color:K.dim}}>Save links to articles, reports, podcasts.</div>}
      {links.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        {links.map(function(l,i){return<div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<links.length-1?"1px solid "+K.bdr:"none"}}>
          <IC name={catIcons[l.category]||"link"} size={14} color={K.dim}/>
          <a href={l.url} target="_blank" rel="noreferrer" style={{flex:1,fontSize:13,color:K.blue,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.label}</a>
          <span style={{fontSize:10,color:K.dim,fontFamily:fm,whiteSpace:"nowrap"}}>{l.category}</span>
          <button onClick={function(){removeLink(l.id)}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:13,padding:2,opacity:.5}}>{"✕"}</button></div>})}</div>}</div>}

  // ── Research Journal (structured card system) ──
  var CARD_STYLES={decision:{icon:"edit",color:"#3B82F6",label:"Decision"},earnings_review:{icon:"bar",color:"#F59E0B",label:"Earnings Review"},thesis_snapshot:{icon:"lightbulb",color:"#8B5CF6",label:"Thesis Update"},conviction_shift:{icon:"trending",color:"#EC4899",label:"Conviction Shift"},note:{icon:"file",color:"#6B7280",label:"Note"}};
  function JournalCard(p){var d=p.entry;var ct=CARD_STYLES[d.cardType]||CARD_STYLES.note;var actionColors={BUY:K.grn,SELL:K.red,HOLD:K.amb,TRIM:K.red,ADD:K.grn,PASS:K.dim};
    return<div style={{background:K.card,border:"1px solid "+K.bdr,borderLeft:"3px solid "+ct.color,borderRadius:10,padding:"14px 18px",marginBottom:10}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div style={{width:24,height:24,borderRadius:6,background:ct.color+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><IC name={ct.icon} size={12} color={ct.color}/></div>
        <span style={{fontSize:11,fontWeight:700,color:ct.color,fontFamily:fm,letterSpacing:1,textTransform:"uppercase"}}>{ct.label}</span>
        {d.ticker&&<span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{d.ticker}</span>}
        {d.action&&d.cardType==="decision"&&<span style={{fontSize:10,fontWeight:700,color:actionColors[d.action]||K.txt,background:(actionColors[d.action]||K.dim)+"15",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>{d.action}</span>}
        {d.outcome&&<span style={{fontSize:10,fontWeight:600,color:d.outcome==="right"?K.grn:d.outcome==="wrong"?K.red:K.amb,fontFamily:fm,background:(d.outcome==="right"?K.grn:d.outcome==="wrong"?K.red:K.amb)+"12",padding:"1px 6px",borderRadius:3}}>{d.outcome}</span>}
        <span style={{marginLeft:"auto",fontSize:10,color:K.dim,fontFamily:fm}}>{d.date?new Date(d.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):""}</span></div>
      {/* ── DECISION CARD ── */}
      {d.cardType==="decision"&&<div>
        {/* Auto-context row */}
        {(d.priceAtTime||d.convictionAtTime>0)&&<div style={{display:"flex",gap:12,marginBottom:8,padding:"6px 10px",background:K.bg,borderRadius:6,fontSize:11,color:K.dim,fontFamily:fm}}>
          {d.priceAtTime>0&&<span>Price: ${d.priceAtTime}</span>}
          {d.convictionAtTime>0&&<span>Conviction: {d.convictionAtTime}/10</span>}
          {d.timeHorizon&&<span>{d.timeHorizon==="short"?"<1yr":d.timeHorizon==="medium"?"1-3yr":"3-10yr"}</span>}
          {d.shares&&<span>{d.shares} shares</span>}</div>}
        {d.reasoning&&<div style={{marginBottom:6}}><div style={{fontSize:10,color:ct.color,fontFamily:fm,letterSpacing:1,fontWeight:600,marginBottom:3}}>REASONING</div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{d.reasoning}</div></div>}
        {d.invalidator&&<div style={{padding:"8px 10px",background:K.red+"06",borderRadius:6,border:"1px solid "+K.red+"15",marginBottom:6}}>
          <div style={{fontSize:10,color:K.red,fontFamily:fm,letterSpacing:1,fontWeight:600,marginBottom:2}}>WHAT WOULD PROVE ME WRONG</div>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{d.invalidator}</div></div>}
      </div>}
      {/* ── EARNINGS REVIEW CARD ── */}
      {d.cardType==="earnings_review"&&<div>
        {d.quarter&&<div style={{fontSize:13,fontWeight:600,color:K.txt,marginBottom:6}}>{d.quarter}</div>}
        {d.kpisTotal>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {(d.kpiDetails||[]).map(function(k,ki){return<div key={ki} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:4,background:(k.status==="met"?K.grn:K.red)+"10",border:"1px solid "+(k.status==="met"?K.grn:K.red)+"20",fontSize:11,fontFamily:fm}}>
            <span style={{color:k.status==="met"?K.grn:K.red,fontWeight:600}}>{k.status==="met"?"✓":"✗"}</span>
            <span style={{color:K.mid}}>{k.name}</span>
            {k.actual!=null&&<span style={{color:k.status==="met"?K.grn:K.red,fontWeight:600}}>{k.actual}</span>}</div>})}</div>}
        {d.kpisTotal>0&&<div style={{fontSize:12,fontWeight:600,color:d.kpisMet===d.kpisTotal?K.grn:d.kpisMet>0?K.amb:K.red,fontFamily:fm,marginBottom:6}}>{d.kpisMet}/{d.kpisTotal} KPIs met</div>}
        {d.summary&&<div style={{fontSize:12,color:K.mid,lineHeight:1.5,marginBottom:6}}>{d.summary.substring(0,200)}</div>}
        {d.userNote&&<div style={{padding:"6px 10px",background:K.bg,borderRadius:6,marginTop:4}}>
          <div style={{fontSize:10,color:ct.color,fontFamily:fm,letterSpacing:1,fontWeight:600,marginBottom:2}}>MY TAKE</div>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{d.userNote}</div></div>}
      </div>}
      {/* ── THESIS SNAPSHOT CARD ── */}
      {d.cardType==="thesis_snapshot"&&<div>
        <div style={{fontSize:13,color:K.mid,lineHeight:1.5,marginBottom:8}}>{d.isNew?"Initial thesis written":"Thesis updated to v"+d.version}</div>
        {d.core&&<div style={{padding:"8px 12px",background:K.bg,borderRadius:6,borderLeft:"2px solid "+ct.color,fontSize:12,color:K.mid,lineHeight:1.5,fontStyle:"italic",marginBottom:6}}>{"“"}{d.core}...{"”"}</div>}
        <div style={{display:"flex",gap:3}}>
          {[{k:"core",c:K.acc,l:"Core"},{k:"hasMoat",c:K.grn,l:"Moat"},{k:"hasRisks",c:K.amb,l:"Risks"},{k:"hasSell",c:K.red,l:"Sell"}].map(function(s){var done=s.k==="core"?d.sectionsFilled>=1:d[s.k];
            return<span key={s.k} style={{fontSize:10,padding:"2px 6px",borderRadius:3,background:done?s.c+"15":"transparent",color:done?s.c:K.dim,fontFamily:fm,border:"1px solid "+(done?s.c+"25":K.bdr)}}>{done?"●":"○"} {s.l}</span>})}</div>
      </div>}
      {/* ── CONVICTION SHIFT CARD ── */}
      {d.cardType==="conviction_shift"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:22,fontWeight:800,color:d.prevConviction>=7?K.grn:d.prevConviction>=4?K.amb:K.red,fontFamily:fm}}>{d.prevConviction}</span>
            <span style={{fontSize:14,color:K.dim}}>{"→"}</span>
            <span style={{fontSize:22,fontWeight:800,color:d.newConviction>=7?K.grn:d.newConviction>=4?K.amb:K.red,fontFamily:fm}}>{d.newConviction}</span>
            <span style={{fontSize:12,fontWeight:600,color:d.delta>0?K.grn:K.red,fontFamily:fm}}>{d.delta>0?"+":""}{d.delta}</span></div>
          {d.action&&d.action!=="hold"&&<span style={{fontSize:10,fontWeight:700,color:d.action==="add"?K.grn:d.action==="sell"?K.red:K.amb,background:(d.action==="add"?K.grn:d.action==="sell"?K.red:K.amb)+"15",padding:"2px 8px",borderRadius:3,fontFamily:fm,textTransform:"uppercase"}}>{d.action}</span>}</div>
        {d.note&&<div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{d.note}</div>}
      </div>}
      {/* ── LEGACY/NOTE CARD ── */}
      {(!d.cardType||d.cardType==="note")&&d.reasoning&&<div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{d.reasoning}</div>}
    </div>}
  function DecisionJournal(p){var c=p.company;var decisions=c.decisions||[];
    var _adding=useState(false),adding=_adding[0],setAdding=_adding[1];
    var _f=useState({action:"BUY",price:"",shares:"",reasoning:"",invalidator:"",timeHorizon:"long"}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p2){var n=Object.assign({},p2);n[k]=v;return n})};
    function addDecision(){if(!f.reasoning.trim())return;
      logJournalEntry(c.id,{cardType:"decision",ticker:c.ticker,action:f.action,price:f.price?parseFloat(f.price):null,shares:f.shares?parseInt(f.shares):null,reasoning:f.reasoning.trim(),invalidator:f.invalidator.trim(),timeHorizon:f.timeHorizon,convictionAtTime:c.conviction||0,priceAtTime:c.position&&c.position.currentPrice?c.position.currentPrice:null,outcome:null,outcomeNote:""});
      ;
      var allDecCount=0;cos.forEach(function(cc){allDecCount+=(cc.decisions||[]).length});
      if(allDecCount<=1)setTimeout(function(){showToast("\u2713 First decision logged","info",3000)},300);
      setF({action:"BUY",price:"",shares:"",reasoning:"",invalidator:"",timeHorizon:"long"});setAdding(false)}
    function markOutcome(decId,outcome){upd(c.id,function(prev){return Object.assign({},prev,{decisions:(prev.decisions||[]).map(function(d){return d.id===decId?Object.assign({},d,{outcome:outcome,outcomeDate:new Date().toISOString()}):d})})})}
    var scored=decisions.filter(function(d){return d.outcome});var rights=scored.filter(function(d){return d.outcome==="right"}).length;
    return<div style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}><IC name="book" size={14} color={K.dim}/>Research Journal</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>{scored.length>0&&<span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{rights}/{scored.length} right ({Math.round(rights/scored.length*100)}%)</span>}
        <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:12})} onClick={function(){setAdding(!adding)}}>+ Log Decision</button></div></div>
      {adding&&<div style={{background:K.card,border:"1px solid "+K.acc+"30",borderRadius:12,padding:"20px 24px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:600,color:K.acc,marginBottom:14,fontFamily:fm,letterSpacing:2}}>NEW DECISION</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Sel label="Action" value={f.action} onChange={function(v){set("action",v)}} options={[{v:"BUY",l:"BUY"},{v:"SELL",l:"SELL"},{v:"ADD",l:"ADD"},{v:"TRIM",l:"TRIM"},{v:"HOLD",l:"HOLD"},{v:"PASS",l:"PASS"}]} K={K}/>
          <Inp label="Price" value={f.price} onChange={function(v){set("price",v)}} type="number" placeholder="$" K={K}/>
          <Inp label="Shares" value={f.shares} onChange={function(v){set("shares",v)}} type="number" placeholder="Qty" K={K}/>
          <Sel label="Horizon" value={f.timeHorizon} onChange={function(v){set("timeHorizon",v)}} options={[{v:"short",l:"< 1yr"},{v:"medium",l:"1-3yr"},{v:"long",l:"3-10yr"}]} K={K}/></div>
        <div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,color:K.txt,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600}}>Why am I making this decision? *</label>
          <textarea value={f.reasoning} onChange={function(e){set("reasoning",e.target.value)}} rows={3} placeholder="What do I believe that the market doesn't?" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
        <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,color:K.red,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600}}>What would prove me wrong?</label>
          <textarea value={f.invalidator} onChange={function(e){set("invalidator",e.target.value)}} rows={2} placeholder="Specific events or metrics that would invalidate this" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.red+"25",borderRadius:6,color:K.txt,padding:"12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/></div>
        {/* Auto-context preview */}
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          {c.conviction>0&&<span style={{fontSize:11,color:K.dim,fontFamily:fm,background:K.bg,padding:"3px 8px",borderRadius:4,border:"1px solid "+K.bdr}}>Conviction: {c.conviction}/10</span>}
          {c.position&&c.position.currentPrice>0&&<span style={{fontSize:11,color:K.dim,fontFamily:fm,background:K.bg,padding:"3px 8px",borderRadius:4,border:"1px solid "+K.bdr}}>Price: ${c.position.currentPrice}</span>}
          {c.kpis.length>0&&<span style={{fontSize:11,color:K.dim,fontFamily:fm,background:K.bg,padding:"3px 8px",borderRadius:4,border:"1px solid "+K.bdr}}>{c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length}/{c.kpis.filter(function(k){return k.lastResult}).length} KPIs met</span>}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.reasoning.trim()?1:.3})} onClick={addDecision}>Save to Journal</button></div></div>}
      {/* Journal entries — beautiful cards */}
      {decisions.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:24,textAlign:"center"}}><div style={{fontSize:36,marginBottom:8}}>{"📖"}</div><div style={{fontSize:14,color:K.dim,marginBottom:4}}>Your research journal is empty</div><div style={{fontSize:12,color:K.dim,lineHeight:1.6}}>Entries appear automatically as you check earnings, update your thesis, and adjust conviction. You can also log decisions manually.</div></div>}
      {decisions.length>0&&<div>
        {decisions.slice(0,15).map(function(d){return<div key={d.id}>
          <JournalCard entry={d}/>
          {/* Outcome scoring for decisions */}
          {d.cardType==="decision"&&!d.outcome&&<div style={{display:"flex",gap:6,padding:"0 18px 10px",marginTop:-6}}>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm,lineHeight:"24px"}}>Score:</span>
            <button style={{fontSize:11,color:K.grn,background:K.grn+"12",border:"1px solid "+K.grn+"30",borderRadius:4,padding:"2px 10px",cursor:"pointer",fontFamily:fm}} onClick={function(){markOutcome(d.id,"right")}}>Right</button>
            <button style={{fontSize:11,color:K.red,background:K.red+"12",border:"1px solid "+K.red+"30",borderRadius:4,padding:"2px 10px",cursor:"pointer",fontFamily:fm}} onClick={function(){markOutcome(d.id,"wrong")}}>Wrong</button>
            <button style={{fontSize:11,color:K.amb,background:K.amb+"12",border:"1px solid "+K.amb+"30",borderRadius:4,padding:"2px 10px",cursor:"pointer",fontFamily:fm}} onClick={function(){markOutcome(d.id,"mixed")}}>Mixed</button></div>}
        </div>})}</div>}
    </div>}

  // ── SEC Filings (Finnhub FREE) ──
  function SECFilings(p){var c=p.company;
    var _filings=useState(null),filings=_filings[0],setFilings=_filings[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    useEffect(function(){setLd(true);fetchFilings(c.ticker).then(function(r){setFilings(r);setLd(false)}).catch(function(){setLd(false)})},[c.ticker]);
    if(ld)return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:20,marginBottom:20}}><div style={S.sec}>SEC Filings</div><div style={{fontSize:12,color:K.dim}}>Loading...</div></div>;
    if(!filings||!filings.length)return null;
    var formColors={"10-K":K.blue,"10-Q":K.acc,"8-K":K.amb,"4":K.grn,SC:K.dim};
    return<div style={{marginBottom:20}}>
      <div style={Object.assign({},S.sec,{marginBottom:12})}>SEC Filings</div>
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        {filings.slice(0,8).map(function(f,i){var form=(f.form||"").toUpperCase();var color=formColors[form]||K.dim;
          return<a key={i} href={f.filingUrl||f.reportUrl||"#"} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<7?"1px solid "+K.bdr:"none",textDecoration:"none"}}>
            <span style={{background:color+"15",color:color,fontFamily:fm,fontWeight:600,fontSize:11,padding:"3px 8px",borderRadius:4,border:"1px solid "+color+"30",minWidth:36,textAlign:"center"}}>{form}</span>
            <span style={{flex:1,fontSize:12,color:K.mid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.symbol} — filed {f.filedDate||f.acceptedDate||""}</span>
            <span style={{fontSize:12,color:K.blue}}>{"↗"}</span></a>})}</div></div>}

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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}><IC name="target" size={14} color={K.dim}/>Thesis Scorecard</div><button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:12})} onClick={function(){setAdding(!adding)}}>+ Review</button></div>
      {adding&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
        <div style={{fontSize:13,color:K.mid,marginBottom:12}}>Is your original thesis still intact?</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>{["intact","weakened","broken"].map(function(s){return<button key={s} onClick={function(){setF(function(p2){return Object.assign({},p2,{status:s})})}} style={{flex:1,padding:"10px",borderRadius:8,fontSize:13,fontWeight:f.status===s?600:400,cursor:"pointer",fontFamily:fm,background:f.status===s?statusColors[s]+"15":"transparent",border:"1px solid "+(f.status===s?statusColors[s]+"50":K.bdr),color:f.status===s?statusColors[s]:K.dim}}>{statusLabels[s]}</button>})}</div>
        <div style={{marginBottom:12}}><textarea value={f.note} onChange={function(e){setF(function(p2){return Object.assign({},p2,{note:e.target.value})})}} rows={2} placeholder="What changed? What would break this thesis?" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical"}}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={S.btnP} onClick={addReview}>Save Review</button></div></div>}
      {reviews.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:20,textAlign:"center",fontSize:13,color:K.dim}}>Periodically review: is your thesis still intact?</div>}
      {reviews.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        {reviews.slice(0,6).map(function(r,i){return<div key={r.id} style={{padding:"10px 16px",borderBottom:i<Math.min(reviews.length,6)-1?"1px solid "+K.bdr:"none",display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:statusColors[r.status]||K.dim,marginTop:5,flexShrink:0}}/>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:statusColors[r.status]||K.mid,fontFamily:fm}}>{statusLabels[r.status]||r.status}</div>
            {r.note&&<div style={{fontSize:12,color:K.dim,lineHeight:1.5,marginTop:2}}>{r.note}</div>}</div>
          <span style={{fontSize:10,color:K.dim,fontFamily:fm,whiteSpace:"nowrap"}}>{new Date(r.date).toLocaleDateString()}</span></div>})}</div>}</div>}

  // ── Notes Editor (local state, debounced sync) ────────────
  function ThesisVault(p){var c=p.company;var docs=c.docs||[];
    var _af=useState("all"),af=_af[0],setAf=_af[1];
    var filtered=af==="all"?docs:docs.filter(function(d){return d.folder===af});
    var folderCounts={};FOLDERS.forEach(function(f){folderCounts[f.id]=docs.filter(function(d){return d.folder===f.id}).length});
    return<div style={{marginBottom:28}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={S.sec}><IC name="folder" size={14} color={K.dim}/>Thesis Vault</div>
        <div style={{display:"flex",gap:4}}>
          <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:11})} onClick={function(){setModal({type:"memo"})}}>+ Memo</button>
          <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:11})} onClick={function(){setModal({type:"clip"})}}>+ Clip</button>
          <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:11})} onClick={function(){setModal({type:"irentry"})}}>+ IR Link</button>
          <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>+ Note</button></div></div>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={function(){setAf("all")}} style={{background:af==="all"?K.acc+"20":"transparent",border:"1px solid "+(af==="all"?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 12px",fontSize:12,color:af==="all"?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>All ({docs.length})</button>
        {FOLDERS.map(function(fo){return<button key={fo.id} onClick={function(){setAf(fo.id)}} style={{background:af===fo.id?K.acc+"20":"transparent",border:"1px solid "+(af===fo.id?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 12px",fontSize:12,color:af===fo.id?K.acc:K.dim,cursor:"pointer",fontFamily:fm,display:"inline-flex",alignItems:"center",gap:5}}><IC name={fo.icon} size={11} color={af===fo.id?K.acc:K.dim}/>{fo.label} {folderCounts[fo.id]>0?"("+folderCounts[fo.id]+")":""}</button>})}</div>
      {filtered.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:28,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>{af==="all"?"No notes yet for "+c.ticker:"No notes in this folder"}</div><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12})} onClick={function(){setModal({type:"doc"})}}>Create note</button><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12,marginLeft:6})} onClick={function(){setModal({type:"memo"})}}>Write memo</button><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12,marginLeft:6})} onClick={function(){setModal({type:"clip"})}}>Clip research</button></div>}
      {filtered.map(function(d){var fo=FOLDERS.find(function(f){return f.id===d.folder});
        return<div key={d.id} style={{background:K.card,border:"1px solid "+(d.isClip?K.blue+"30":d.isIR?K.amb+"30":d.isMemo?K.acc+"30":K.bdr),borderLeft:d.isClip?"3px solid "+K.blue:d.isIR?"3px solid "+K.amb:d.isMemo?"3px solid "+K.acc:"3px solid transparent",borderRadius:10,padding:"14px 20px",marginBottom:8,cursor:"pointer"}} onClick={function(){setModal({type:d.isMemo?"memo":d.isClip?"doc":d.isIR?"doc":"doc",data:d.id})}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <IC name="file" size={12} color={K.dim}/>
            <span style={{fontSize:14,fontWeight:500,color:K.txt,flex:1}}>{d.title}</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{d.updatedAt?new Date(d.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>
          {d.content&&<div style={{fontSize:13,color:K.dim,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{d.content.substring(0,200)}</div>}</div>})}</div>}

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
          {sortedYears.map(function(yr){return<button key={yr} onClick={function(){setSelYear(yr);setSelQ(null)}} style={{background:selYear===yr?K.acc+"20":"transparent",border:"1px solid "+(selYear===yr?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 14px",fontSize:13,fontWeight:600,color:selYear===yr?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>{yr}</button>})}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          {quarters.map(function(qt){var entry=years[selYear]?years[selYear][qt]:null;
            return<div key={qt} onClick={function(){if(entry)setSelQ(selQ===qt?null:qt)}} style={{background:entry?(selQ===qt?K.acc+"15":K.bg):K.bg,border:"1px solid "+(entry?(selQ===qt?K.acc+"40":K.bdr):K.bdr),borderRadius:8,padding:"10px 12px",cursor:entry?"pointer":"default",opacity:entry?1:.4,textAlign:"center",transition:"all .2s"}}>
              <div style={{fontSize:13,fontWeight:600,color:entry?K.txt:K.dim,fontFamily:fm}}>{qt}</div>
              {entry&&<div style={{fontSize:11,color:K.dim,marginTop:4}}>&#x2713; Tracked</div>}
              {!entry&&<div style={{fontSize:11,color:K.dim,marginTop:4}}>&mdash;</div>}</div>})}</div>
        {selectedEntry&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+K.bdr}}>
          <div style={{fontSize:14,color:K.mid,lineHeight:1.6,marginBottom:8}}>{selectedEntry.summary}</div>
          {selectedEntry.results&&selectedEntry.results.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
            {selectedEntry.results.map(function(r,i){return<div key={i} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,padding:"6px 12px"}}>
              <div style={{fontSize:11,color:K.dim}}>{METRIC_MAP[r.kpi_name]?METRIC_MAP[r.kpi_name].label:r.kpi_name}</div>
              <div style={{fontSize:14,fontWeight:600,color:r.status==="met"?K.grn:r.status==="missed"?K.red:K.mid,fontFamily:fm}}>{r.actual_value!=null?r.actual_value:"—"}</div></div>})}</div>}
          {selectedEntry.sourceUrl&&<a href={selectedEntry.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:K.blue,textDecoration:"none"}}>{selectedEntry.sourceLabel||"Source"} &#x2197;</a>}
          <div style={{fontSize:11,color:K.dim,marginTop:4}}>Checked: {fT(selectedEntry.checkedAt)}</div></div>}</div></div>}

  // ── Detail View ───────────────────────────────────────────
  // ── Finnhub-Powered Sections (all FREE, $0) ────────────
  // ── Earnings Report Card (appears after Check Earnings) ──
  function EarningsReportCard(p){var c=p.company;var snap=c.financialSnapshot||{};var news=c.latestNews||[];
    var hasSnap=Object.keys(snap).length>0;var hasSummary=!!c.earningSummary;var hasNews=news.length>0;var hasHistory=c.earningsHistory&&c.earningsHistory.length>0;
    if(!hasSnap&&!hasSummary&&!hasHistory)return null;
    return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden",marginBottom:20}}>
      <div style={{padding:"16px 24px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:14,fontWeight:600,color:K.txt}}>Earnings Report {hasHistory?c.earningsHistory[0].quarter:""}</div>
          {c.lastChecked&&<div style={{fontSize:11,color:K.dim,marginTop:2}}>Updated {fT(c.lastChecked)}</div>}</div>
        {c.sourceUrl&&<a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:K.blue,textDecoration:"none"}}>{c.sourceLabel||"Source"} {"↗"}</a>}</div>
      {/* Summary text — always shows if available */}
      {hasSummary&&<div style={{padding:"14px 24px",borderBottom:hasSnap||hasNews?"1px solid "+K.bdr:"none",fontSize:14,color:K.mid,lineHeight:1.6}}>{c.earningSummary}</div>}
      {/* Financial grid */}
      {hasSnap&&<div style={{padding:"16px 24px",borderBottom:hasNews?"1px solid "+K.bdr:"none"}}>
        <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:10,fontFamily:fm}}>Key Financials</div>
        {(function(){
          // Group snapshot keys into categories for cleaner display
          var SNAP_GROUPS=[
            {label:"Valuation",keys:["pe","pb","ps","evEbitda","evRevenue","peg","fcfYield","grahamDiscount","grahamNum"],icon:"chart"},
            {label:"Margins",keys:["grossMargin","opMargin","netMargin","fcfMargin","rndMargin","sgaMargin"],icon:"trending"},
            {label:"Returns",keys:["roe","roic","roa","revGrowth","epsGrowth"],icon:"star"},
            {label:"Income",keys:["divYield","divGrowth","payoutRatio","shareholderYield","buybackYield"],icon:"dollar"},
            {label:"Balance Sheet",keys:["debtEquity","currentRatio","quickRatio","netDebtEbitda","interestCoverage","cashOnHand","rangePos"],icon:"shield"},
            {label:"Per Share",keys:["eps","bvps","fcfPerShare","revPerShare"],icon:"target"},
          ];
          var rendered=new Set();
          var groups=SNAP_GROUPS.map(function(g){
            var items=g.keys.filter(function(k){return snap[k]&&snap[k].value&&!rendered.has(k)});
            items.forEach(function(k){rendered.add(k)});
            return{label:g.label,icon:g.icon,items:items}
          }).filter(function(g){return g.items.length>0});
          // Any keys not in groups
          var leftover=Object.keys(snap).filter(function(k){return !rendered.has(k)&&snap[k]&&snap[k].value});
          if(leftover.length)groups.push({label:"Other",icon:"overview",items:leftover});
          return groups.map(function(g){return<div key={g.label} style={{marginBottom:16}}>
            <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
              <IC name={g.icon} size={10} color={K.dim}/>{g.label}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:6}}>
              {g.items.map(function(k){var item=snap[k];
                var isGood=item.positive!=null?item.positive:item.beat!=null?item.beat:null;
                var valColor=isGood===true?K.grn:isGood===false?K.red:K.txt;
                return<div key={k} style={{background:K.bg,borderRadius:8,padding:"9px 11px",position:"relative",overflow:"hidden"}}>
                  {isGood!=null&&<div style={{position:"absolute",top:0,left:0,bottom:0,width:2,borderRadius:"2px 0 0 2px",background:isGood?K.grn:K.red}}/>}
                  <div style={{fontSize:9,color:K.dim,marginBottom:3,fontFamily:fm,lineHeight:1.2}}>{item.label}</div>
                  <div style={{fontSize:14,fontWeight:700,color:valColor,fontFamily:fm,lineHeight:1}}>{item.value}</div>
                  {item.detail&&<div style={{fontSize:9,color:K.dim,marginTop:2}}>{item.detail}</div>}
                </div>})}
            </div>
          </div>})})()}
        </div>}
      {!hasSnap&&hasSummary&&<div style={{padding:"12px 24px",fontSize:12,color:K.dim}}>Click Check Earnings again if financial details don't appear — Finnhub may have rate-limited this request.</div>}
      {/* Recent news */}
      {hasNews&&<div style={{padding:"12px 24px"}}>
        <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:8,fontFamily:fm}}>Recent News</div>
        {news.slice(0,4).map(function(n,i){return<a key={i} href={n.url} target="_blank" rel="noreferrer" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<3?"1px solid "+K.bdr:"none",textDecoration:"none",gap:8}}>
          <span style={{fontSize:12,color:K.mid,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.headline}</span>
          <span style={{fontSize:10,color:K.dim,whiteSpace:"nowrap",fontFamily:fm}}>{n.source} · {new Date(n.datetime*1000).toLocaleDateString()}</span></a>})}</div>}</div>}

  function calcMoatFromData(finData){
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
      metrics.push({id:"grossMargin",name:"Gross Margin Stability",score:Math.min(10,Math.max(1,Math.round(gmAvg>=60?8:gmAvg>=40?7:gmAvg>=25?6:gmAvg>=15?4:2)+(gmStd<3?1:gmStd>10?-1:0))),value:gmAvg.toFixed(1)+"%",detail:"Avg "+gmAvg.toFixed(1)+"% (±"+gmStd.toFixed(1)+"%)",trend:gm.map(function(v){return v*100}),icon:"shield",desc:"High & stable margins indicate pricing power"})}
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
      if(roics.length>=2){metrics.push({id:"roic",name:"Return on Invested Capital",score:Math.min(10,Math.max(1,Math.round(avg(roics)>30?9:avg(roics)>20?8:avg(roics)>15?7:avg(roics)>10?6:avg(roics)>5?4:2))),value:avg(roics).toFixed(1)+"%",detail:"Avg ROIC "+avg(roics).toFixed(1)+"% over "+roics.length+"yr",trend:roics,icon:"target",desc:"High ROIC is the hallmark of a true moat"})}}
    // 5. FCF CONVERSION
    if(recentCf.length>=2&&recent.length>=2){var fcfC=[];for(var fi=0;fi<Math.min(recentCf.length,recent.length);fi++){var fcf=recentCf[fi].freeCashFlow!=null?recentCf[fi].freeCashFlow:((recentCf[fi].operatingCashFlow!=null&&recentCf[fi].capitalExpenditure!=null)?(recentCf[fi].operatingCashFlow+Math.min(0,recentCf[fi].capitalExpenditure)):null);var ni=recent[fi].netIncome;if(fcf!=null&&ni&&ni>0)fcfC.push(fcf/ni*100)}
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
        <div style={{fontSize:14,color:K.mid,marginBottom:8}}>Price charts with entry points, conviction markers & earnings dates</div>
        <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("charts")}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",color:K.acc,padding:"6px 16px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:fm}}>Upgrade to Unlock</button>
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
          {hovPt&&<span style={{fontSize:12,fontFamily:fm,color:K.txt,marginRight:8}}>{hovPt.date} <strong>${hovPt.close.toFixed(2)}</strong></span>}
          <span style={{fontSize:11,fontWeight:600,color:totalRet>=0?K.grn:K.red,fontFamily:fm,marginRight:8}}>{totalRet>=0?"+":""}{totalRet.toFixed(1)}% ({range})</span>
          {ranges.map(function(r){return<button key={r} onClick={function(){setRange(r)}} style={{padding:"3px 8px",fontSize:11,fontFamily:fm,background:range===r?K.acc+"18":"transparent",color:range===r?K.acc:K.dim,border:"1px solid "+(range===r?K.acc+"30":"transparent"),borderRadius:4,cursor:"pointer"}}>{r}</button>})}</div></div>
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
        {entries.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:K.grn}}/> Buy/Add <span style={{width:8,height:8,borderRadius:"50%",background:K.red}}/> Sell/Trim</span>}
        {convMarks.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:2,background:K.amb}}/> Conviction updates</span>}
        {earnDates.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:8,color:K.amb,fontWeight:700}}>E</span> Earnings</span>}</div>}
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
      if(!c._moatCache||c._moatCache.composite!==cache.composite||c._moatCache.grossMargin!==(c.pricingPower&&c.pricingPower.score!=null?c.pricingPower.score:cache.grossMargin))upd(c.id,{_moatCache:cache})}},[moat?moat.composite:null,c.pricingPower?c.pricingPower.score:null]);
    var cLabel=!moat?"Insufficient Data":moatLabel(adjComposite);
    var cColor=!moat?K.dim:moatColor(adjComposite);
    return<div className="ta-page-pad" style={{padding:isThesis?"0 40px 80px":"0 32px 60px",maxWidth:900}}>
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"24px 0 12px"}}>
        <button onClick={function(){setSubPage(null)}} style={{background:"none",border:"none",color:K.acc,fontSize:14,cursor:"pointer",fontFamily:fm,padding:0}}>{"←"} Back</button>
        <CoLogo domain={c.domain} ticker={c.ticker} size={32}/>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker} <span style={{fontWeight:300,color:K.mid,fontSize:15}}>Moat Analysis</span></div>
          <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>{c.name} · {c.sector}</div></div></div>
      {ld?<div style={{padding:"32px 0"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[0,1,2,3].map(function(i){return<div key={i} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:22}}>
          <div className="ta-skel" style={{height:14,width:"60%",background:K.bdr,marginBottom:12}}/>
          <div className="ta-skel" style={{height:6,background:K.bdr,marginBottom:8}}/>
          <div className="ta-skel" style={{height:10,width:"40%",background:K.bdr}}/></div>})}</div>
        <div style={{textAlign:"center",fontSize:12,color:K.dim,marginTop:16,fontFamily:fm}}>Analyzing {c.ticker} competitive advantages...</div></div>:
      !moat?<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>Insufficient financial data to analyze moat</div><div style={{fontSize:12,color:K.dim}}>Need at least 2 years of financial statements from SEC EDGAR.</div></div>:
      <div>
      {/* Composite Score */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"28px 32px",marginBottom:24,display:"flex",alignItems:"center",gap:32}}>
        <div style={{width:100,height:100,borderRadius:"50%",border:"4px solid "+cColor,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div style={{fontSize:36,fontWeight:700,color:cColor,fontFamily:fm,lineHeight:1}}>{adjComposite}</div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>/10</div></div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:500,color:cColor,fontFamily:fh,marginBottom:4}}>{cLabel}</div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.7}}>{adjComposite>=8?"This company shows strong competitive advantages across multiple dimensions. Durable moats deserve premium conviction.":adjComposite>=6?"Some competitive advantages are visible, but not all dimensions are strong. Monitor for moat erosion.":adjComposite>=4?"Limited competitive advantages detected. This company may be vulnerable to competition.":"No clear competitive moat identified. High conviction requires a special thesis."}</div>
          <div style={{fontSize:11,color:K.dim,marginTop:8,fontFamily:fm}}>Based on {moat.years} years of SEC EDGAR data · {moat.metrics.length} dimensions analyzed{c.pricingPower&&c.pricingPower.score!=null?" · Pricing power adjusted by owner":""}
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
            <div style={S.sec}><IC name="castle" size={14} color={K.dim}/>Moat Classification</div>
            {classified.length>0&&<button onClick={function(){setSubPage(null);setDetailTab("dossier");showToast(c.ticker+" moat classified — "+classified.length+" type"+(classified.length>1?"s":"")+" identified","info",3000)}} style={Object.assign({},S.btnP,{padding:"6px 16px",fontSize:12,display:"flex",alignItems:"center",gap:5})}><IC name="shield" size={11} color={"#fff"}/>Done — Back to Dossier</button>}</div>
          {/* Morningstar Reference + Moat Trend */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px"}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>MORNINGSTAR RATING</div>
              <select value={c.morningstarMoat||""} onChange={function(e){upd(c.id,{morningstarMoat:e.target.value})}} style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:c.morningstarMoat==="Wide"?K.grn:c.morningstarMoat==="Narrow"?K.amb:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
                <option value="">Not Set</option><option value="Wide">★ Wide Moat</option><option value="Narrow">★ Narrow Moat</option><option value="None">No Moat</option><option value="Not Rated">Not Rated</option></select></div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px"}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>MOAT TREND</div>
              <select value={c.moatTrend||""} onChange={function(e){upd(c.id,{moatTrend:e.target.value})}} style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:c.moatTrend==="Strengthening"?K.grn:c.moatTrend==="Eroding"?K.red:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
                <option value="">Not Set</option><option value="Strengthening">▲ Strengthening</option><option value="Stable">─ Stable</option><option value="Eroding">▼ Eroding</option></select></div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px"}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>YOUR vs M★</div>
              {(function(){var yourWidth=classified.length>=3?"Wide":classified.length>=1?"Narrow":"None";var mstar=c.morningstarMoat||"";
                var agree=mstar&&yourWidth===mstar;var disagree=mstar&&mstar!=="Not Rated"&&yourWidth!==mstar;
                return<div style={{fontSize:13,color:agree?K.grn:disagree?K.amb:K.dim,fontWeight:600,fontFamily:fm}}>
                  {!mstar?"Set Morningstar rating":agree?"✓ Aligned":disagree?"⚠ Divergent":"—"}</div>})()}</div></div>
          {/* Active moat types */}
          {classified.length>0&&<div style={{marginBottom:16}}>
            {classified.map(function(t){var d=mt[t.id]||{};var sug=suggestions.find(function(s){return s.id===t.id});
              return<div key={t.id} style={{background:K.card,border:"1px solid "+t.color+"40",borderLeft:"4px solid "+t.color,borderRadius:12,padding:"16px 20px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <IC name={t.icon} size={16} color={t.color}/>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:K.txt}}>{t.label}</div>
                    <div style={{fontSize:12,color:K.dim,lineHeight:1.5}}>{t.desc}</div></div>
                  <button onClick={function(){toggleType(t.id)}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:13,padding:4,opacity:.5}} title="Remove">{"✕"}</button></div>
                {/* Strength rating */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:11,color:K.dim,fontFamily:fm,width:70}}>STRENGTH</span>
                  <div style={{display:"flex",gap:3}}>
                    {[1,2,3,4,5].map(function(v){return<button key={v} onClick={function(){setStrength(t.id,v)}} style={{width:28,height:24,borderRadius:4,border:"1px solid "+(v<=d.strength?t.color+"60":K.bdr),background:v<=d.strength?t.color+"20":"transparent",color:v<=d.strength?t.color:K.dim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{v}</button>})}</div>
                  <span style={{fontSize:11,color:t.color,fontFamily:fm,marginLeft:4}}>{d.strength>=5?"Dominant":d.strength>=4?"Strong":d.strength>=3?"Moderate":d.strength>=2?"Weak":"Fragile"}</span></div>
                {/* Note */}
                <textarea value={d.note||""} onChange={function(e){setNote(t.id,e.target.value)}} placeholder={"Why does "+c.ticker+" have "+t.label.toLowerCase()+"? Be specific..."} rows={2} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.5}}/>
                {sug&&sug.reasons.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>
                  {sug.reasons.map(function(r,ri){return<span key={ri} style={{fontSize:10,color:t.color,background:t.color+"10",padding:"2px 8px",borderRadius:3,fontFamily:fm}}>{r}</span>})}</div>}
              </div>})}</div>}
          {/* Suggestions + unclassified */}
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}>
            {classified.length===0&&<div style={{fontSize:13,color:K.mid,marginBottom:12,lineHeight:1.6}}>What type of competitive advantage does {c.ticker} have? Select the moat sources that apply. {hasSuggestions?"We've highlighted likely matches based on "+c.ticker+"'s sector and financials.":""}</div>}
            {classified.length>0&&<div style={{fontSize:12,color:K.dim,marginBottom:10}}>Add more moat sources:</div>}
            <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {unclassified.map(function(t){var sug=suggestions.find(function(s){return s.id===t.id});var isSuggested=!!sug;
                return<button key={t.id} onClick={function(){toggleType(t.id)}} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",borderRadius:8,cursor:"pointer",textAlign:"left",background:isSuggested?t.color+"08":"transparent",border:"1px solid "+(isSuggested?t.color+"35":K.bdr),transition:"all .15s"}}>
                  <div style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:t.color+"15",flexShrink:0,marginTop:1}}>
                    <IC name={t.icon} size={14} color={t.color}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:isSuggested?K.txt:K.mid,display:"flex",alignItems:"center",gap:5}}>{t.label}
                      {isSuggested&&<span style={{fontSize:8,fontWeight:700,color:t.color,background:t.color+"15",padding:"1px 5px",borderRadius:3,fontFamily:fm}}>LIKELY</span>}</div>
                    <div style={{fontSize:11,color:K.dim,lineHeight:1.4,marginTop:2}}>{t.desc.split(".")[0]+"."}</div>
                    {isSuggested&&<div style={{fontSize:10,color:t.color,marginTop:3,fontFamily:fm}}>{sug.reasons[0]}</div>}
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
                <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1}}>DATA SCORE</div>
                <div style={{fontSize:16,fontWeight:700,color:gmScore?scoreColor:K.dim,fontFamily:fm}}>{gmScore||"—"}<span style={{fontSize:11,fontWeight:400,color:K.dim}}>/10</span></div>
                <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>Gross margin: {gmVal}</div>
              </div>
              {finalScore!=null&&<div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:11,color:K.acc,fontFamily:fm,letterSpacing:1}}>YOUR SCORE</div>
                <div style={{fontSize:22,fontWeight:700,color:scoreColor,fontFamily:fm}}>{finalScore}<span style={{fontSize:11,fontWeight:400,color:K.dim}}>/10</span></div>
                {isOverridden&&<span style={{fontSize:8,fontWeight:700,color:K.acc,background:K.acc+"15",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>OVERRIDE</span>}
              </div>}
            </div>
            {/* Guided questions */}
            <div style={{fontSize:12,color:K.mid,fontFamily:fm,marginBottom:14,lineHeight:1.5}}>Gross margins alone miss structural pricing power. Answer these to get a better score:</div>
            {qs.map(function(q){var val=answers[q.id]||"";
              return<div key={q.id} style={{marginBottom:14}}>
                <div style={{fontSize:13,color:K.txt,lineHeight:1.5,marginBottom:6}}>{q.q}</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {["yes","partial","no"].map(function(opt){
                    var active=val===opt;var clr=opt==="yes"?K.grn:opt==="partial"?K.amb:K.red;
                    return<button key={opt} onClick={function(){setAnswer(q.id,active?"":opt)}}
                      style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+(active?clr+"60":K.bdr),
                        background:active?clr+"15":"transparent",color:active?clr:K.dim,
                        fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm,textTransform:"capitalize"}}>{opt}</button>})}
                  <span style={{fontSize:11,color:K.dim,fontFamily:fm,marginLeft:8,fontStyle:"italic"}}>{q.tip}</span>
                </div>
              </div>})}
            {/* Suggested + final score */}
            {answered>=3&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 18px",marginTop:6}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1}}>SUGGESTED SCORE</div>
                <div style={{fontSize:16,fontWeight:700,color:suggested>=8?K.grn:suggested>=6?K.amb:K.red,fontFamily:fm}}>{suggested}/10</div>
                <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>({yesCount} yes, {partialCount} partial, {answered-yesCount-partialCount} no)</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:K.dim,fontFamily:fm,width:80}}>SET SCORE</span>
                <div style={{display:"flex",gap:3}}>
                  {[1,2,3,4,5,6,7,8,9,10].map(function(v){
                    var active=finalScore===v;var clr=v>=8?K.grn:v>=6?K.amb:v>=4?"#F59E0B":K.red;
                    return<button key={v} onClick={function(){setScore(v)}}
                      style={{width:28,height:26,borderRadius:4,border:"1px solid "+(active?clr+"80":v===suggested?K.acc+"40":K.bdr),
                        background:active?clr+"20":v===suggested?K.acc+"08":"transparent",
                        color:active?clr:v===suggested?K.acc:K.dim,
                        fontSize:12,fontWeight:active?700:500,cursor:"pointer",fontFamily:fm}}>{v}</button>})}
                </div>
                {finalScore!=null&&<button onClick={clearOverride} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:11,fontFamily:fm,marginLeft:8,textDecoration:"underline"}}>Clear</button>}
              </div>
            </div>}
            {/* Note */}
            <textarea value={pp.note||""} onChange={function(e){setNote(e.target.value)}}
              placeholder={"Why does "+c.ticker+" have "+(finalScore>=7?"strong":"weak")+" pricing power? What’s the structural reason?"}
              rows={2} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.5,marginTop:12}}/>
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
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{ppOverride?"Pricing Power (Owner)":m.name}</div>
                {ppOverride&&<div style={{fontSize:10,color:K.acc,fontFamily:fm}}>Data score: {m.score}/10 · Overridden by your assessment</div>}</div>
              <div style={{fontSize:22,fontWeight:700,color:barColor,fontFamily:fm}}>{displayScore}</div></div>
            {/* Score bar */}
            <div style={{height:6,borderRadius:3,background:K.bdr,marginBottom:8,overflow:"hidden"}}>
              <div style={{height:"100%",width:displayScore*10+"%",borderRadius:3,background:barColor,transition:"width .3s"}}/></div>
            <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:2}}>{m.value}</div>
            <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:6}}>{m.detail}</div>
            {/* Mini sparkline */}
            {m.trend&&m.trend.length>=2&&<div style={{display:"flex",alignItems:"flex-end",gap:2,height:24,marginTop:4}}>
              {m.trend.map(function(v,ti){var mx=Math.max.apply(null,m.trend);var mn=Math.min.apply(null,m.trend);var range=mx-mn||1;var h=Math.max(3,((v-mn)/range)*22);
                return<div key={ti} style={{flex:1,height:h,borderRadius:2,background:barColor+"60"}}/>})}</div>}
            <div style={{fontSize:11,color:K.dim,lineHeight:1.4,marginTop:8,fontStyle:"italic"}}>{m.desc}</div></div>})}</div>
      {/* Munger quote */}
      <div style={{marginTop:24,padding:"16px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:12}}>
        <div style={{fontSize:13,color:K.mid,lineHeight:1.7,fontStyle:"italic"}}>{"“"}The key to investing is not assessing how much an industry is going to affect society, or how much it will grow, but rather determining the competitive advantage of any given company and, above all, the durability of that advantage.{"”"}</div>
        <div style={{fontSize:12,color:K.dim,marginTop:6,fontFamily:fm}}>{"—"} Warren Buffett (Munger's partner)</div></div>
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
      html+='<div class="hdr"><div><h1>'+c.ticker+'</h1><div class="sub">'+c.name+' · '+c.sector+' · Financial Statements ('+(per==="quarter"?"Quarterly":"Annual")+')</div></div>';
      html+='<div style="text-align:right"><div class="logo">ThesisAlpha</div><div class="logo-sub">Financial Statements</div>';
      html+='<div style="font-family:JetBrains Mono,monospace;font-size:9px;color:#6b7280;margin-top:6px">'+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})+'</div></div></div>';
      // Table
      STMT_TABS.forEach(function(stab2){
      var rows2=stab2.id==="income"?(data.income||[]):stab2.id==="balance"?(data.balance||[]):stab2.id==="cashflow"?(data.cashflow||[]):[];
      if(rows2.length===0)return;
      html+='<div style="margin-top:20px;font-family:Playfair Display,Georgia,serif;font-size:16px;font-weight:600;color:#1a1a2e;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:8px">'+stab2.l+'</div>';
      html+='<table><thead><tr><th align="left" style="min-width:160px">Metric</th>';
      rows2.forEach(function(r){html+='<th align="right">'+(per==="quarter"?(r.period||"")+" '"+(r.date||"").substring(2,4):(r.date||"").substring(0,4))+'</th>'});
      html+='</tr></thead><tbody>';
      stab2.items.forEach(function(item){
        if(!item.k){html+='<tr class="spacer"><td colspan="'+(rows2.length+1)+'"></td></tr>';return}
        html+='<tr'+(item.b?' class="bold"':'')+'><td'+(item.d?' class="dim"':'')+'>'+(item.l)+'</td>';
        rows2.forEach(function(r,ci){var v=r[item.k];var yoy=null;
          if(ci>0&&rows2[ci-1]){var prev=rows2[ci-1][item.k];if(prev&&v&&!item.p)yoy=((Number(v)-Number(prev))/Math.abs(Number(prev))*100)}
          var vStr=fmtCell(v,item);var clr=v!=null&&Number(v)<0?' class="red"':(item.d?' class="dim"':'');
          html+='<td align="right"'+clr+'>'+vStr;
          if(yoy!=null&&!isNaN(yoy))html+='<div class="yoy '+(yoy>=0?"grn":"red")+'">'+(yoy>=0?"+":"")+yoy.toFixed(1)+'%</div>';
          html+='</td>'});
        html+='</tr>'});
      html+='</tbody></table>'});
      // Footer
      html+='<div class="footer"><div class="footer-left">ThesisAlpha</div>';
      html+='<div class="footer-right"><div style="font-family:JetBrains Mono,monospace;font-size:9px;color:#6b7280">'+c.ticker+' · '+c.name+'</div>';
      html+='<div>'+new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})+'</div></div></div>';
      html+='<div class="disc">Source: '+(data.source==="sec-edgar"?"SEC EDGAR":"Financial Modeling Prep")+' · Generated by ThesisAlpha · For personal research only. Not financial advice. Verify all data before making investment decisions.</div>';
      html+='</div></body></html>';
      var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.print()},600)}
    if(!isPro){return<div style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 32px 60px",maxWidth:1100}}>
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"24px 0 12px"}}>
        <button onClick={function(){setSubPage(null)}} style={{background:"none",border:"none",color:K.acc,fontSize:14,cursor:"pointer",fontFamily:fm,padding:0}}>{"←"} Back</button>
        <CoLogo domain={c.domain} ticker={c.ticker} size={32}/>
        <div><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker} <span style={{fontWeight:300,color:K.mid,fontSize:15}}>Financial Statements</span></div></div></div>
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:16,padding:"48px 32px",textAlign:"center",marginTop:16}}>
        <div style={{fontSize:36,marginBottom:16}}>📊</div>
        <div style={{fontSize:18,fontWeight:600,color:K.txt,fontFamily:fh,marginBottom:8}}>10-Year Financial Statements</div>
        <div style={{fontSize:14,color:K.mid,lineHeight:1.7,maxWidth:420,margin:"0 auto 24px"}}>Income statements, balance sheets, cash flow — annual and quarterly. Powered by FMP with SEC EDGAR fallback.</div>
        <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("financials")}} style={Object.assign({},S.btnP,{padding:"12px 32px",fontSize:14})}>Upgrade to Unlock</button>
      </div></div>}
    var _data=useState(null),data=_data[0],setData=_data[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    var _per=useState("annual"),per=_per[0],setPer=_per[1];
    var _tab=useState("income"),tab=_tab[0],setTab=_tab[1];
    var chartSel=finChartSel,setChartSel=setFinChartSel;
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
    return<div style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 32px 60px",maxWidth:1100}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"24px 0 12px"}}>
        <button onClick={function(){setSubPage(null)}} style={{background:"none",border:"none",color:K.acc,fontSize:14,cursor:"pointer",fontFamily:fm,padding:0}}>{"←"} Back</button>
        <CoLogo domain={c.domain} ticker={c.ticker} size={32}/>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker} <span style={{fontWeight:300,color:K.mid,fontSize:15}}>Financial Statements</span></div>
          <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>{c.name} · {c.sector}{data&&data.source?<span style={{marginLeft:8,fontSize:10,padding:"2px 6px",borderRadius:3,background:data.source==="sec-edgar"?K.grn+"15":K.acc+"15",color:data.source==="sec-edgar"?K.grn:K.acc}}>{"Source: "+(data.source==="sec-edgar"?"SEC EDGAR":"FMP")}</span>:""}</div></div>
        <div style={{display:"flex",gap:4}}>{["annual","quarter"].map(function(v){return<button key={v} onClick={function(){setPer(v)}} style={{padding:"6px 16px",fontSize:12,fontFamily:fm,fontWeight:per===v?600:400,background:per===v?K.acc+"20":"transparent",color:per===v?K.acc:K.dim,border:"1px solid "+(per===v?K.acc+"40":K.bdr),borderRadius:6,cursor:"pointer"}}>{v==="annual"?"Annual":"Quarterly"}</button>})}
          <button onClick={exportFinancialsPDF} disabled={!data||ld} style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12,opacity:data&&!ld?1:.4,display:"flex",alignItems:"center",gap:5})}><IC name="file" size={12} color={K.mid}/>PDF</button></div></div>
      {/* Statement Tabs */}
      {isMobile?<div style={{marginBottom:16}}>
        <div style={{position:"relative"}}>
          <select value={tab} onChange={function(e){setTab(e.target.value)}} style={{width:"100%",background:K.card,border:"1px solid "+K.acc+"50",borderRadius:12,color:K.txt,padding:"13px 44px 13px 18px",fontSize:15,fontFamily:fm,fontWeight:700,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
            {STMT_TABS.map(function(t){return<option key={t.id} value={t.id}>{t.l}</option>})}</select>
          <div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg></div></div>
      </div>:<div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid "+K.bdr}}>
        {STMT_TABS.map(function(t){return<button key={t.id} onClick={function(){setTab(t.id)}} style={{padding:"10px 20px",fontSize:13,fontFamily:fm,fontWeight:tab===t.id?600:400,color:tab===t.id?K.acc:K.dim,background:"transparent",border:"none",borderBottom:tab===t.id?"2px solid "+K.acc:"2px solid transparent",cursor:"pointer",marginBottom:-1}}>{t.l}</button>})}</div>}
      {ld?<div style={{padding:"32px 0"}}><div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:24}}>
        {[0,1,2,3,4,5].map(function(i){return<div key={i} style={{display:"flex",gap:12,marginBottom:12}}>
          <div className="ta-skel" style={{height:12,flex:1,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/></div>})}</div>
        <div style={{textAlign:"center",fontSize:12,color:K.dim,marginTop:16,fontFamily:fm}}>Loading {c.ticker} financial data from FMP...</div></div>:
      rows.length===0?<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>No {stab.l.toLowerCase()} data available for {c.ticker}</div><div style={{fontSize:12,color:K.dim,lineHeight:1.8,maxWidth:500,margin:"0 auto"}}>Data is fetched from FMP (primary) with SEC EDGAR as fallback. This company may not have filings available.<br/>
        {diag&&<div style={{marginTop:8,padding:"8px 12px",background:K.red+"10",border:"1px solid "+K.red+"20",borderRadius:6,color:K.amb,fontSize:11,fontFamily:fm,textAlign:"left"}}>{diag}</div>}
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
        <button onClick={function(){setLd(true);setDiag("");delete _fincache[c.ticker+"-"+(per||"annual")];fetchFinancialStatements(c.ticker,per==="quarter"?"quarter":"annual").then(function(r){setData(r);setLd(false);var ic=(r&&r.income?r.income.length:0);if(ic===0)setDiag("Still 0 rows. Check browser console for details.")}).catch(function(e){setLd(false);setDiag("Error: "+e.message)})}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",color:K.acc,padding:"6px 14px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:fm}}>Retry</button></div></div></div>:
      <div>
      {/* Interactive multi-metric chart */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>
          {chartItems.map(function(ci,ci2){var isOn=chartSel.indexOf(ci.k)>=0;var col=isOn?CHART_COLORS[chartSel.indexOf(ci.k)%CHART_COLORS.length]:K.dim;
            return<button key={ci.k} onClick={function(){toggleChartMetric(ci.k)}} style={{padding:"3px 10px",fontSize:11,fontFamily:fm,background:isOn?col+"18":"transparent",color:isOn?col:K.dim,border:"1px solid "+(isOn?col+"40":"transparent"),borderRadius:5,cursor:"pointer",whiteSpace:"nowrap",transition:"all .2s",fontWeight:isOn?600:400}}>
              {isOn&&<span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:col,marginRight:4}}/>}{ci.l}</button>})}</div>
        {hasPctMix&&<div style={{fontSize:10,color:K.amb,fontFamily:fm,marginBottom:8}}>{"⚠"} Mixing % and $ metrics — values share the Y-axis</div>}
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
                  <rect x={groupX-2} y={pad.t} width={groupW+4} height={plotH} fill="transparent" style={{cursor:"pointer"}} onMouseEnter={function(){setHov(dt)}}/>
                </g>})}
            </svg>
            {/* Hover tooltip */}
            {(function(){var hovDate=hov||(dates.length>0?dates[dates.length-1]:null);if(!hovDate)return null;var hi=dates.indexOf(hovDate);if(hi<0)return null;var tx=pad.l+hi*(groupW+(numDates>1?groupGap:0));
              return<div style={{position:"absolute",left:Math.min(Math.max(tx,8),cW-170),top:8,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"8px 12px",boxShadow:"0 4px 16px rgba(0,0,0,.2)",pointerEvents:"none",zIndex:10,minWidth:130}}>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>{per==="quarter"?((rows[hi]||{}).period||"")+" "+hovDate:hovDate.substring(0,4)}</div>
                {chartSeries.map(function(s){var pt=s.pts.find(function(p){return p.date===hovDate});if(!pt)return null;
                  var prev=s.pts[s.pts.indexOf(pt)-1];var yoy=prev&&prev.val!==0?((pt.val-prev.val)/Math.abs(prev.val)*100):null;
                  return<div key={s.key} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{width:6,height:6,borderRadius:2,background:s.color,flexShrink:0}}/>
                    <span style={{fontSize:11,color:K.mid,fontFamily:fm,flex:1}}>{s.def.l}</span>
                    <span style={{fontSize:11,fontWeight:700,color:s.color,fontFamily:fm}}>{s.def.p?(pt.val*100).toFixed(1)+"%":s.def.sm?"$"+pt.val.toFixed(2):fmtBig(pt.val)}</span>
                    {yoy!=null&&<span style={{fontSize:8,color:yoy>=0?K.grn:K.red,fontFamily:fm}}>{yoy>=0?"+":""}{yoy.toFixed(0)}%</span>}</div>})}</div>})()}
          </div>})():<div style={{padding:20,textAlign:"center",fontSize:12,color:K.dim}}>Click metrics above to chart them</div>}
        {/* Legend */}
        {chartSeries.length>0&&<div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
          {chartSeries.map(function(s){return<div key={s.key} style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:8,height:3,borderRadius:2,background:s.color}}/>
            <span style={{fontSize:10,color:s.color,fontFamily:fm,fontWeight:600}}>{s.def.l}</span></div>})}</div>}
      </div>
      {/* Full data table */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:fm}}>
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
                  {yoy!=null&&!isNaN(yoy)&&<div style={{fontSize:10,color:yoy>=0?K.grn:K.red,marginTop:1}}>{yoy>=0?"+":""}{yoy.toFixed(1)}%</div>}
                </td>})}</tr>})}</tbody>
        </table></div></div>
      <div style={{fontSize:11,color:K.dim,marginTop:12,padding:"0 4px"}}>Source: Financial Modeling Prep (SEC filings) · {per==="annual"?"Annual":"Quarterly"} data · {rows.length} periods</div>
      </div>}
    </div>}
  function DetailView(){if(!sel)return null;var c=sel;var h=gH(c.kpis);var cs=checkSt[c.id];var pos=c.position||{};var conv=c.conviction||0;
    var _sm=useState(false),showMore=_sm[0],setShowMore=_sm[1];
    // Moat data for dossier display
    var _moatD=useState(null),dossierMoat=_moatD[0],setDossierMoat=_moatD[1];
    var _mktOpen=useState(true),dossierMktOpen=_mktOpen[0],setDossierMktOpen=_mktOpen[1];
    var _keyFin=useState(null),keyFin=_keyFin[0],setKeyFin=_keyFin[1];
    var _hovD=useState(null),hovD=_hovD[0],setHovD=_hovD[1];
    var _descExp=useState(false),descExpanded=_descExp[0],setDescExpanded=_descExp[1];
    var _insiderData=useState(null),insiderData=_insiderData[0],setInsiderData=_insiderData[1];
    useEffect(function(){if(!c||!isPro){setInsiderData(null);return}
      Promise.all([fetchInsiders(c.ticker).catch(function(){return[]}),fetchInstitutionalHolders(c.ticker).catch(function(){return[]})]).then(function(res){
        setInsiderData({transactions:res[0],institutions:res[1]})}).catch(function(){setInsiderData(null)})},[c&&c.ticker,isPro]);
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
    var _thesisAgeDays=c.thesisUpdatedAt?Math.ceil((new Date()-new Date(c.thesisUpdatedAt))/864e5):null;
    var _thesisStale=_thesisAgeDays!=null&&_thesisAgeDays>90;
    var _thesisStaleBadge=_thesisAgeDays==null?"No thesis yet":_thesisAgeDays===0?"Updated today":_thesisAgeDays===1?"Updated yesterday":_thesisAgeDays<30?_thesisAgeDays+"d ago":_thesisAgeDays<365?Math.floor(_thesisAgeDays/30)+"mo ago":Math.floor(_thesisAgeDays/365)+"yr ago";
    var _convDriftDays=c.convictionHistory&&c.convictionHistory.length?(Math.ceil((new Date()-new Date(c.convictionHistory[c.convictionHistory.length-1].date))/864e5)):null;
    var _convDrift=_convDriftDays!=null&&_convDriftDays>120;
    // Per-company thesis completeness (0-100)
    var _tScore=(function(){var s=0;var t=c.thesisNote||"";if(t.length>20)s+=20;if(t.length>300)s+=10;if(t.indexOf("## CORE")>=0||t.length>200)s+=15;if(t.indexOf("## MOAT")>=0||t.indexOf("moat")>=0)s+=15;if(t.indexOf("## RISKS")>=0||t.indexOf("risk")>=0)s+=15;if(t.indexOf("## SELL")>=0||t.indexOf("sell")>=0)s+=15;if(c.thesisVersions&&c.thesisVersions.length>1)s+=10;if(_thesisAgeDays!=null&&_thesisAgeDays>180)s=Math.max(0,s-20);else if(_thesisAgeDays!=null&&_thesisAgeDays>90)s=Math.max(0,s-10);return Math.min(100,s)})();
    var _tScoreColor=_tScore>=80?K.grn:_tScore>=50?K.acc:_tScore>0?K.amb:K.dim;
    return<div className="ta-detail-pad" style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 32px 60px",maxWidth:900}}>
      {/* Thesis staleness + conviction drift banners */}
      {(_thesisStale||_tScore>0)&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:_thesisStale&&c.thesisNote?0:8}}>
        {_tScore>0&&<div style={{display:"flex",alignItems:"center",gap:5,background:_tScoreColor+"12",border:"1px solid "+_tScoreColor+"30",borderRadius:6,padding:"4px 10px"}}>
          <span style={{fontSize:10,fontWeight:700,color:_tScoreColor,fontFamily:fm}}>{_tScore}%</span>
          <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>thesis quality</span>
        </div>}
        {c.thesisUpdatedAt&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>· {_thesisStaleBadge}</span>}
      </div>}
      {_thesisStale&&c.thesisNote&&<div style={{background:K.amb+"12",border:"1px solid "+K.amb+"40",borderRadius:8,padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8,fontSize:12,color:K.amb}}>
        <IC name="alert" size={13} color={K.amb}/>
        <span>Thesis last updated <strong>{_thesisStaleBadge}</strong> — worth a review?</span>
        <button onClick={function(){setDetailTab("dossier");setTimeout(function(){document.getElementById("thesis-editor")&&document.getElementById("thesis-editor").focus()},100)}} style={{marginLeft:"auto",background:"none",border:"1px solid "+K.amb+"60",borderRadius:4,padding:"2px 8px",fontSize:11,color:K.amb,cursor:"pointer",fontFamily:fm,fontWeight:600,whiteSpace:"nowrap"}}>Review Now</button>
      </div>}
      {_convDrift&&<div style={{background:K.blue+"10",border:"1px solid "+K.blue+"30",borderRadius:8,padding:"8px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:8,fontSize:12,color:K.blue}}>
        <IC name="target" size={13} color={K.blue}/>
        <span>Conviction last updated <strong>{_convDriftDays}d ago</strong> — still feels right?</span>
      </div>}
      {/* ── Mobile back ── */}
      {isMobile&&<button onClick={function(){setSelId(null)}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:K.mid,fontSize:13,cursor:"pointer",padding:"10px 0 2px",fontFamily:fm}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Portfolio</button>}
      {/* ── Simplified Header ── */}
      <div className="ta-detail-head" style={{padding:isMobile?"16px 0 12px":"28px 0 16px"}}>
        {/* Top row: logo + name + conviction */}
        <div style={{display:"flex",alignItems:"center",gap:isMobile?12:16,marginBottom:10}}>
          <CoLogo domain={c.domain} ticker={c.ticker} size={isMobile?40:48}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:isMobile?22:26,fontWeight:800,color:K.txt,fontFamily:fh,letterSpacing:"-0.5px",lineHeight:1}}>{c.ticker}</span>
              <span style={{fontSize:isMobile?13:15,color:K.mid,fontWeight:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:isMobile?160:300}}>{c.name}</span>
            </div>
            <div style={{display:"flex",gap:8,marginTop:5,alignItems:"center",flexWrap:"wrap"}}>
              {c.sector&&<span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.sector}</span>}
              {c.sector&&(c.investStyle||true)&&<span style={{color:K.bdr,fontSize:11}}>·</span>}
              {c.investStyle&&STYLE_MAP[c.investStyle]&&<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:600,color:STYLE_MAP[c.investStyle].color,background:STYLE_MAP[c.investStyle].color+"12",padding:"1px 7px",borderRadius:4,fontFamily:fm,cursor:"pointer"}} onClick={function(){setModal({type:"edit"})}}><IC name={STYLE_MAP[c.investStyle].icon} size={8} color={STYLE_MAP[c.investStyle].color}/>{STYLE_MAP[c.investStyle].label}</span>}
              <button onClick={function(){var next=c.status==="portfolio"?"watchlist":c.status==="watchlist"?"toohard":"portfolio";upd(c.id,{status:next})}} style={{background:(c.status||"portfolio")==="portfolio"?K.grn+"15":c.status==="toohard"?K.red+"15":K.amb+"15",border:"1px solid "+((c.status||"portfolio")==="portfolio"?K.grn+"30":c.status==="toohard"?K.red+"30":K.amb+"30"),borderRadius:4,padding:"1px 7px",fontSize:10,color:(c.status||"portfolio")==="portfolio"?K.grn:c.status==="toohard"?K.red:K.amb,cursor:"pointer",fontFamily:fm,fontWeight:600}}>{(c.status||"portfolio")==="portfolio"?"Portfolio":c.status==="toohard"?"Too Hard":"Watchlist"}</button>
            </div>
          </div>
          {/* Conviction badge - right side */}
          {conv>0&&<div onClick={function(){setModal({type:"conviction"})}} style={{cursor:"pointer",textAlign:"center",flexShrink:0,background:conv>=7?K.grn+"12":conv>=4?K.amb+"12":K.red+"12",border:"1px solid "+(conv>=7?K.grn+"30":conv>=4?K.amb+"30":K.red+"30"),borderRadius:12,padding:"8px 14px"}}>
            <div style={{fontSize:isMobile?22:26,fontWeight:800,color:conv>=7?K.grn:conv>=4?K.amb:K.red,fontFamily:fm,lineHeight:1}}>{conv}</div>
            <div style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginTop:2}}>conviction</div>
          </div>}
        </div>
        {/* Second row: earnings + quick actions */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <IC name="target" size={11} color={dU(c.earningsDate)>=0&&dU(c.earningsDate)<=7?K.amb:K.dim}/>
            <span style={{fontSize:12,color:dU(c.earningsDate)>=0&&dU(c.earningsDate)<=7?K.amb:K.dim,fontFamily:fm}}>
              {c.earningsDate==="TBD"?"Earnings TBD":c.earningsDate?("Earnings "+fD(c.earningsDate)+(c.earningsTime?" · "+c.earningsTime:"")):"No earnings date"}
            </span>
            {dU(c.earningsDate)>=0&&dU(c.earningsDate)<=7&&<span style={{fontSize:10,fontWeight:700,color:K.amb,background:K.amb+"15",padding:"1px 7px",borderRadius:3,fontFamily:fm}}>{dU(c.earningsDate)===0?"Today":dU(c.earningsDate)===1?"Tomorrow":dU(c.earningsDate)+"d"}</span>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {c.irUrl&&<a href={c.irUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:K.acc,textDecoration:"none",display:"flex",alignItems:"center",gap:3,padding:"4px 9px",borderRadius:6,border:"1px solid "+K.bdr,fontFamily:fm}}>IR ↗</a>}
            <button style={{fontSize:11,color:K.mid,background:"none",border:"1px solid "+K.bdr,borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:fm}} onClick={function(){setModal({type:"edit"})}}>Edit</button>
            {!isMobile&&<button style={{fontSize:11,color:K.mid,background:"none",border:"1px solid "+K.bdr,borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:fm}} onClick={function(){exportPDF()}}>PDF</button>}
          </div>
        </div>
      </div>
      {/* ── Mobile section anchors ── */}
      {isMobile&&<div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:2}}>
        {[{label:"Thesis",anchor:"ds-story"},{label:"Evidence",anchor:"ds-evidence"},{label:"Numbers",anchor:"ds-numbers"},{label:"Research",anchor:"ds-research"}].map(function(s){return<button key={s.anchor} onClick={function(){var el=document.getElementById(s.anchor);if(el)el.scrollIntoView({behavior:"smooth",block:"start"})}} style={{flexShrink:0,padding:"6px 14px",borderRadius:999,border:"1px solid "+K.bdr,background:"transparent",color:K.mid,fontSize:12,fontFamily:fm,cursor:"pointer"}}>{s.label}</button>})}
      </div>}
      {/* ── Single scrollable company view (no tabs) ── */}
        {/* Guided Setup Flow */}
        {guidedSetup===c.id&&(function(){
          // Only show guided setup within 48h of adding company
          var addedAt=c.addedAt||c.purchaseDate||null;
          var hoursOld=addedAt?Math.floor((new Date()-new Date(addedAt))/3600000):0;
          if(addedAt&&hoursOld>48){setGuidedSetup(null);return null}
          var hasThesis=c.thesisNote&&c.thesisNote.trim().length>20;
          var hasKpis=c.kpis.length>=2;
          var hasConviction=c.conviction>0;
          var steps=[
            {id:"thesis",label:"Write your thesis",desc:"Why do you own "+c.ticker+"? What's the core investment case?",done:hasThesis,icon:"lightbulb",action:function(){setModal({type:"thesis"})}},
            {id:"kpis",label:"Define 2-3 KPIs",desc:"What metrics will prove or disprove your thesis?",done:hasKpis,icon:"target",action:function(){setModal({type:"kpi"})}},
            {id:"conviction",label:"Rate your conviction",desc:"How confident are you on a scale of 1-10?",done:hasConviction,icon:"trending",action:function(){setModal({type:"conviction"})}}
          ];
          var currentStep=steps.findIndex(function(s){return!s.done});
          if(currentStep<0){setTimeout(function(){setGuidedSetup(null);showToast(c.ticker+" setup complete - you're ready to track this investment","info",4000)},500);return null}
          var step=steps[currentStep];
          return<div style={{background:K.acc+"06",border:"1px solid "+K.acc+"20",borderRadius:12,padding:"16px 20px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div><div style={{fontSize:14,fontWeight:600,color:K.txt}}>Set up {c.ticker}</div>
                <div style={{fontSize:12,color:K.dim,marginTop:2}}>Step {currentStep+1} of {steps.length}</div></div>
              <button onClick={function(){setGuidedSetup(null)}} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",fontFamily:fm,padding:"2px 8px"}}>Skip</button></div>
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              {steps.map(function(s,i){return<div key={s.id} style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:s.done?K.grn:i===currentStep?K.acc:K.bdr,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {s.done?<svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" fill="none"/></svg>
                    :<span style={{fontSize:10,fontWeight:700,color:i===currentStep?"#fff":K.dim}}>{i+1}</span>}</div>
                <span style={{fontSize:11,color:s.done?K.grn:i===currentStep?K.txt:K.dim,fontWeight:i===currentStep?600:400,fontFamily:fm}}>{s.label}</span>
                {i<steps.length-1&&<div style={{flex:1,height:1,background:s.done?K.grn:K.bdr}}/>}</div>})}</div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:K.card,borderRadius:8,border:"1px solid "+K.bdr}}>
              <IC name={step.icon} size={18} color={K.acc}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:K.txt}}>{step.label}</div>
                <div style={{fontSize:12,color:K.dim,marginTop:2}}>{step.desc}</div></div>
              <button onClick={step.action} style={Object.assign({},S.btnP,{padding:"8px 20px",fontSize:13,whiteSpace:"nowrap"})}>Start</button></div>
          </div>})()}
        {/* ── OWNER'S CHECKLIST — persistent until complete ── */}
        {guidedSetup!==c.id&&(function(){
          var hasThesis=c.thesisNote&&c.thesisNote.trim().length>20;
          var hasKpis=c.kpis.length>=2;
          var hasConv=c.conviction>0;
          var hasMoat=Object.keys(c.moatTypes||{}).some(function(k2){return c.moatTypes[k2]&&c.moatTypes[k2].active});
          var items=[
            {id:"thesis",label:"Write thesis",done:hasThesis,icon:"lightbulb",action:function(){setModal({type:"thesis"})}},
            {id:"kpis",label:"Add 2+ KPIs",done:hasKpis,icon:"target",action:function(){setModal({type:"kpi"})}},
            {id:"conv",label:"Rate conviction",done:hasConv,icon:"trending",action:function(){setModal({type:"conviction"})}},
            {id:"moat",label:"Classify moat",done:hasMoat,icon:"castle",action:function(){setSubPage("moat")}}
          ];
          var doneCount=items.filter(function(it){return it.done}).length;
          if(doneCount>=items.length)return null;
          return<div style={{background:K.bg,borderRadius:10,padding:"12px 16px",marginBottom:16,border:"1px solid "+K.bdr}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm}}>Owner Checklist</span>
              <span style={{fontSize:11,color:doneCount>=3?K.grn:K.dim,fontFamily:fm,fontWeight:600}}>{doneCount}/{items.length}</span></div>
            <div style={{display:"flex",gap:6}}>
              {items.map(function(it){return<button key={it.id} onClick={it.done?undefined:it.action} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 4px",borderRadius:8,background:it.done?K.grn+"08":"transparent",border:"1px solid "+(it.done?K.grn+"25":K.bdr),cursor:it.done?"default":"pointer",opacity:it.done?.7:1,transition:"all .15s"}} onMouseEnter={function(e){if(!it.done)e.currentTarget.style.borderColor=K.acc}} onMouseLeave={function(e){if(!it.done)e.currentTarget.style.borderColor=K.bdr}}>
                {it.done?<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={K.grn+"20"} stroke={K.grn} strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke={K.grn} strokeWidth="1.5" fill="none"/></svg>
                  :<IC name={it.icon} size={14} color={K.dim}/>}
                <span style={{fontSize:10,color:it.done?K.grn:K.mid,fontFamily:fm,fontWeight:it.done?600:400}}>{it.label}</span></button>})}</div></div>})()}
        {/* Company Summary — auto-fetched from FMP */}
        {c.description&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.7,marginBottom:8}}>{descExpanded||c.description.length<=200?c.description:c.description.substring(0,200)+"…"}
            {c.description.length>200&&<button onClick={function(){setDescExpanded(!descExpanded)}} style={{background:"none",border:"none",color:K.acc,fontSize:12,cursor:"pointer",fontFamily:fm,padding:0,marginLeft:4}}>{descExpanded?"Show less":"Read more"}</button>}</div>
          {(c.ceo||c.employees||c.mktCap||c.exchange)&&<div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:11,color:K.dim,fontFamily:fm}}>
            {c.ceo&&<span>CEO: <strong style={{color:K.mid}}>{c.ceo}</strong></span>}
            {c.employees>0&&<span>Employees: <strong style={{color:K.mid}}>{c.employees.toLocaleString()}</strong></span>}
            {c.mktCap>0&&<span>Mkt Cap: <strong style={{color:K.mid}}>{c.mktCap>=1e12?"$"+(c.mktCap/1e12).toFixed(1)+"T":c.mktCap>=1e9?"$"+(c.mktCap/1e9).toFixed(0)+"B":"$"+(c.mktCap/1e6).toFixed(0)+"M"}</strong></span>}
            {c.exchange&&<span>{c.exchange}</span>}
            {c.country&&<span>{c.country}</span>}
            {c.ipoDate&&<span>IPO: {c.ipoDate.substring(0,4)}</span>}
          </div>}
        </div>}

        {/* Pre-Earnings Briefing */}
        {/* ── PRE-EARNINGS RITUAL ── */}
        {c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)>=0&&dU(c.earningsDate)<=7&&(function(){
          var daysOut=dU(c.earningsDate);
          var urgency=daysOut<=2?K.red:daysOut<=4?K.amb:K.amb;
          var ritualKey="ritual-"+c.id+"-"+c.earningsDate;
          var ritualDone=(function(){try{var s=localStorage.getItem("ta-rituals");var r=s?JSON.parse(s):{};return r[ritualKey]||{}}catch(e){return{}}})();
          var checklist=[
            {id:"thesis",label:"Thesis reviewed",done:!!ritualDone.thesis||(c.thesisNote&&c.thesisNote.length>50),icon:"lightbulb"},
            {id:"kpis",label:"KPIs confirmed",done:!!ritualDone.kpis||(c.kpis.length>=1),icon:"target"},
            {id:"conviction",label:"Conviction noted",done:!!ritualDone.conviction||(c.conviction>0),icon:"star"},
            {id:"bias",label:"Checked for bias",done:!!ritualDone.bias,icon:"shield"},
          ];
          var doneCount=checklist.filter(function(it){return it.done}).length;
          var allDone=doneCount>=checklist.length;
          function tickItem(id){try{var s=localStorage.getItem("ta-rituals");var r=s?JSON.parse(s):{};r[ritualKey]=Object.assign({},r[ritualKey]||{});r[ritualKey][id]=true;localStorage.setItem("ta-rituals",JSON.stringify(r))}catch(e){}}
          return<div style={{background:urgency+"08",border:"2px solid "+urgency+"30",borderRadius:14,padding:"18px 20px",marginBottom:24,position:"relative",overflow:"hidden"}}>
            {/* Countdown pulse */}
            {daysOut<=2&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,"+urgency+","+urgency+"60,"+urgency+")",animation:"shimmer 2s infinite"}}/>}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:38,height:38,borderRadius:10,background:urgency+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <IC name="target" size={18} color={urgency}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:800,color:urgency,fontFamily:fm,letterSpacing:.3}}>
                  {daysOut===0?"EARNINGS TODAY":daysOut===1?"EARNINGS TOMORROW":"EARNINGS IN "+daysOut+" DAYS"}
                </div>
                <div style={{fontSize:11,color:K.mid,fontFamily:fm,marginTop:1}}>{fD(c.earningsDate)} · {c.earningsTime==="BMO"?"Before market open":c.earningsTime==="AMC"?"After market close":c.earningsTime||"Time TBD"}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:20,fontWeight:900,color:allDone?K.grn:urgency,fontFamily:fm,lineHeight:1}}>{doneCount}/{checklist.length}</div>
                <div style={{fontSize:9,color:K.dim,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Ready</div>
              </div>
            </div>
            {/* Checklist */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:14}}>
              {checklist.map(function(it){return<div key={it.id} onClick={function(){if(!it.done){tickItem(it.id);showToast(it.label+" ✓","info",2000);upd(c.id,{})}}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:it.done?(K.grn+"10"):(K.card),border:"1px solid "+(it.done?(K.grn+"30"):K.bdr),cursor:it.done?"default":"pointer",transition:"all .15s"}} onMouseEnter={function(e){if(!it.done)e.currentTarget.style.borderColor=urgency+"60"}} onMouseLeave={function(e){if(!it.done)e.currentTarget.style.borderColor=K.bdr}}>
                <div style={{width:18,height:18,borderRadius:5,background:it.done?K.grn:"transparent",border:"2px solid "+(it.done?K.grn:K.bdr),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                  {it.done&&<span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
                </div>
                <span style={{fontSize:11,color:it.done?K.grn:K.mid,fontFamily:fm,fontWeight:it.done?600:400}}>{it.label}</span>
              </div>})}
            </div>
            {/* KPI targets */}
            {c.kpis.length>0&&<div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Watch These Numbers</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {c.kpis.map(function(k){return<div key={k.id} style={{padding:"4px 10px",borderRadius:6,background:K.card,border:"1px solid "+K.bdr,fontSize:11,fontFamily:fm,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{color:K.txt,fontWeight:600}}>{k.name}</span>
                  <span style={{color:K.dim}}>→ {k.target}</span>
                </div>})}
              </div>
            </div>}
            {/* Conviction + quick thesis preview */}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {c.conviction>0&&<div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:6,background:K.card,border:"1px solid "+K.bdr,fontSize:11,fontFamily:fm}}>
                <IC name="star" size={11} color={K.amb}/>
                <span style={{color:K.mid}}>Conviction</span>
                <span style={{color:K.txt,fontWeight:700}}>{c.conviction}/10</span>
              </div>}
              <button onClick={function(){setModal({type:"thesis"})}} style={{background:"none",border:"1px solid "+urgency+"30",borderRadius:6,padding:"4px 10px",fontSize:11,color:urgency,fontFamily:fm,cursor:"pointer"}}>Review thesis →</button>
              {allDone&&<span style={{marginLeft:"auto",fontSize:11,color:K.grn,fontFamily:fm,fontWeight:600}}>✓ You're prepared</span>}
            </div>
          </div>
        })()}

        {/* ── 1. THE STORY ── */}
        <div id="ds-story" style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>THE STORY</div>
            <button onClick={function(){setModal({type:"thesis"})}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><IC name="edit" size={10} color={K.acc}/>Edit thesis</button></div>
          {c.thesisNote?(function(){var sec=parseThesis(c.thesisNote);
            return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
              <div style={{fontSize:14,color:K.txt,lineHeight:1.8,marginBottom:sec.moat||sec.risks||sec.sell?16:0}}>{sec.core}</div>
              {sec.moat&&<div style={{padding:"10px 14px",background:K.bg,borderRadius:8,borderLeft:"3px solid "+K.grn,marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:K.grn,fontFamily:fm,letterSpacing:1,marginBottom:3}}>MOAT</div>
                <div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{sec.moat}</div></div>}
              {sec.risks&&<div style={{padding:"10px 14px",background:K.bg,borderRadius:8,borderLeft:"3px solid "+K.amb,marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:K.amb,fontFamily:fm,letterSpacing:1,marginBottom:3}}>RISKS</div>
                <div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{sec.risks}</div></div>}
              {sec.sell&&<div style={{padding:"10px 14px",background:K.bg,borderRadius:8,borderLeft:"3px solid "+K.red}}>
                <div style={{fontSize:10,fontWeight:700,color:K.red,fontFamily:fm,letterSpacing:1,marginBottom:3}}>SELL CRITERIA</div>
                <div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{sec.sell}</div></div>}
            </div>})()
          :<div style={{background:K.card,border:"1px dashed "+K.acc+"40",borderRadius:12,padding:"32px 24px",textAlign:"center",cursor:"pointer"}} onClick={function(){setModal({type:"thesis"})}}>
            <div style={{fontSize:14,color:K.acc,fontWeight:600,marginBottom:4}}>Write your thesis</div>
            <div style={{fontSize:12,color:K.dim}}>Why do you own {c.ticker}? What’s the moat? When would you sell?</div></div>}
        </div>

        {/* Investment style */}
        {!c.investStyle&&<div style={{background:K.acc+"06",border:"1px solid "+K.acc+"20",borderRadius:10,padding:"12px 16px",marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:600,color:K.acc,marginBottom:6,fontFamily:fm}}>What type of investment is {c.ticker}?</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {INVEST_STYLES.map(function(st){return<button key={st.id} onClick={function(){upd(c.id,{investStyle:st.id})}} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:5,border:"1px solid "+st.color+"30",background:st.color+"08",color:st.color,fontSize:10,cursor:"pointer",fontFamily:fm,fontWeight:600}}>
              <IC name={st.icon} size={8} color={st.color}/>{st.label}</button>})}</div></div>}


        {/* ── OWNERSHIP SNOWFLAKE ── */}
        <div id="ds-score"/>
        {(function(){
          var mm=calcMastery(c);var fs=c.financialSnapshot||{};
          // 1. Thesis depth (0-100)
          var th=c.thesisNote||"";var thSec=1;if(th.indexOf("## MOAT")>=0)thSec++;if(th.indexOf("## RISKS")>=0)thSec++;if(th.indexOf("## SELL")>=0)thSec++;
          var thesisScore=th.length<20?0:Math.min(100,thSec*25);
          // 2. KPI coverage (0-100)
          var kpiDefined=c.kpis.length;var kpiMet=c.kpis.filter(function(k2){return k2.lastResult&&k2.lastResult.status==="met"}).length;
          var kpiChecked=c.kpis.filter(function(k2){return k2.lastResult}).length;var kpiScore=kpiDefined===0?0:Math.min(100,kpiDefined*15+kpiChecked*10+kpiMet*15);
          // 3. Conviction (0-100)
          var convScore=(c.conviction||0)*10;
          // 4. Fundamentals (0-100) — from snapshot data
          function pv2(k2){if(!fs[k2])return 0;if(fs[k2].numVal!=null)return fs[k2].numVal;var v2=fs[k2].value;return typeof v2==="string"?parseFloat(v2.replace(/[^\d.\-]/g,""))||0:0}
          var fundScore=25;var gm2=pv2("grossMargin");if(gm2>60)fundScore+=15;else if(gm2>40)fundScore+=8;
          var roic3=pv2("roic")||pv2("roe");if(roic3>20)fundScore+=20;else if(roic3>12)fundScore+=10;
          var de2=pv2("debtEquity");if(de2>0&&de2<1)fundScore+=10;else if(de2>=2)fundScore-=10;
          var rg2=pv2("revGrowth");if(rg2>15)fundScore+=15;else if(rg2>5)fundScore+=8;
          if(Object.keys(fs).length>=8)fundScore+=15;else if(Object.keys(fs).length>=4)fundScore+=8;fundScore=Object.keys(fs).length===0?0:Math.max(0,Math.min(100,fundScore));
          // 5. Mastery (0-100)
          var mastScore=Math.round(mm.stars/6*100);
          // 6. Monitoring freshness (0-100)
          var monScore=0;var now3=Date.now();
          if(c.thesisUpdatedAt){var thAge=Math.ceil((now3-new Date(c.thesisUpdatedAt))/864e5);monScore+=thAge<30?35:thAge<90?25:thAge<180?10:0}
          if(c.lastChecked){var lc2=Math.ceil((now3-new Date(c.lastChecked))/864e5);monScore+=lc2<30?35:lc2<90?25:lc2<180?10:0}
          if((c.convictionHistory||[]).length>0){var lastConv=c.convictionHistory[c.convictionHistory.length-1];if(lastConv.date){var cvAge=Math.ceil((now3-new Date(lastConv.date))/864e5);monScore+=cvAge<60?30:cvAge<120?15:0}}
          monScore=Math.min(100,monScore);
          var axes=[{label:"Thesis",score:thesisScore,color:"#8B5CF6",tip:"How thorough is your written thesis? Covers core belief, moat, risks, and sell criteria."},{label:"KPIs",score:kpiScore,color:"#3B82F6",tip:"How many key metrics are you tracking, and how many have been checked against earnings?"},{label:"Conviction",score:convScore,color:"#F59E0B",tip:"Your self-rated confidence in this investment on a 1-10 scale."},{label:"Fundamentals",score:fundScore,color:"#22C55E",tip:"Quality of the underlying business: margins, ROIC, growth, and balance sheet strength."},{label:"Mastery",score:mastScore,color:"#EC4899",tip:"Overall ownership completeness: thesis + KPIs + conviction + moat + monitoring combined."},{label:"Monitoring",score:monScore,color:"#14B8A6",tip:"How recently you have reviewed your thesis, checked earnings, and updated conviction."}];
          var avgScore=Math.round(axes.reduce(function(s2,a2){return s2+a2.score},0)/6);
          // SVG radar — rounded Simply Wall St style
          var cx=100,cy=90,r=65;var n=6;var angleOff=-Math.PI/2;
          function pt(i2,val){var ang=angleOff+i2/n*2*Math.PI;return{x:cx+Math.cos(ang)*r*val/100,y:cy+Math.sin(ang)*r*val/100}}
          var gridLevels=[25,50,75,100];
          // Build smooth rounded path from data points
          function roundedPath(pts2){if(pts2.length<3)return"";var d="";for(var i3=0;i3<pts2.length;i3++){var prev=pts2[(i3-1+pts2.length)%pts2.length];var curr=pts2[i3];var next=pts2[(i3+1)%pts2.length];var smooth=0.25;var cp1x=curr.x+(next.x-prev.x)*smooth;var cp1y=curr.y+(next.y-prev.y)*smooth;var prevNext=pts2[(i3+2)%pts2.length];var cp2x=next.x-(prevNext.x-curr.x)*smooth;var cp2y=next.y-(prevNext.y-curr.y)*smooth;if(i3===0)d+="M"+curr.x.toFixed(1)+","+curr.y.toFixed(1)+" ";d+="C"+cp1x.toFixed(1)+","+cp1y.toFixed(1)+" "+cp2x.toFixed(1)+","+cp2y.toFixed(1)+" "+next.x.toFixed(1)+","+next.y.toFixed(1)+" "}return d+"Z"}
          function roundedGridPath(level){var pts2=[];for(var i3=0;i3<n;i3++)pts2.push(pt(i3,level));return roundedPath(pts2)}
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <svg width="200" height="180" viewBox="0 0 200 180">
                {/* Rounded grid rings */}
                {gridLevels.map(function(gl){return<path key={gl} d={roundedGridPath(gl)} fill="none" stroke={K.bdr} strokeWidth={gl===100?"1":"0.5"}/>})}
                {/* Axis lines — subtle */}
                {axes.map(function(a2,i3){var p3=pt(i3,100);return<line key={i3} x1={cx} y1={cy} x2={p3.x} y2={p3.y} stroke={K.bdr} strokeWidth="0.3" strokeDasharray="2,3"/>})}
                {/* Filled shape — rounded, more opaque */}
                {(function(){var dataPts=axes.map(function(a2,i3){return pt(i3,Math.max(a2.score,8))});
                  return<path d={roundedPath(dataPts)} fill={"#3B82F635"} stroke={"#3B82F6"} strokeWidth="2.5"/>})()}
                {/* Axis labels with hover tooltips */}
                {axes.map(function(a2,i3){var lp=pt(i3,118);
                  return<g key={i3} style={{cursor:"help"}}><title>{a2.label}: {a2.score}/100 — {a2.tip}</title>
                    <text x={lp.x} y={lp.y} fill={K.dim} fontSize="8" fontFamily={fm} textAnchor="middle" dominantBaseline="middle" style={{cursor:"help"}}>{a2.label}</text></g>})}
                {/* Center score */}
                <text x={cx} y={cy-4} fill={K.txt} fontSize="22" fontWeight="800" fontFamily={fm} textAnchor="middle">{avgScore}</text>
                <text x={cx} y={cy+10} fill={K.dim} fontSize="7" fontFamily={fm} textAnchor="middle" letterSpacing="1">OWNERSHIP</text>
              </svg>
              <div style={{flex:1}}>
                <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:10}}>Ownership Depth</div>
                {axes.map(function(a2){return<div key={a2.label} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:a2.color,flexShrink:0}}/>
                  <span style={{fontSize:11,color:K.mid,fontFamily:fm,width:70}}>{a2.label}</span>
                  <div style={{flex:1,height:4,borderRadius:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:a2.score+"%",borderRadius:2,background:a2.color,transition:"width .4s"}}/></div>
                  <span style={{fontSize:11,fontWeight:600,color:a2.score>=70?K.grn:a2.score>=40?K.amb:a2.score>0?K.red:K.dim,fontFamily:fm,width:24,textAlign:"right"}}>{a2.score}</span></div>})}
              </div></div></div>})()}


        {/* ── 2. THE EVIDENCE ── */}
        <div id="ds-evidence" style={{marginBottom:24}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600,marginBottom:10}}>THE EVIDENCE</div>
          {/* KPI Scorecard */}
          {c.kpis.length>0?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:600,color:K.txt}}>KPI Scorecard</span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {(function(){var _fs=c.financialSnapshot||{};return<span>{_fs.shareholderYield&&_fs.shareholderYield.numVal>0.5&&<span style={{fontSize:10,fontWeight:600,color:K.grn,background:K.grn+"12",padding:"2px 7px",borderRadius:4,fontFamily:fm,marginRight:4}}>{_fs.shareholderYield.value} SH yield</span>}{_fs.grahamDiscount&&_fs.grahamDiscount.numVal!=null&&Math.abs(_fs.grahamDiscount.numVal)<80&&<span style={{fontSize:10,fontWeight:600,color:_fs.grahamDiscount.numVal<0?K.grn:K.amb,background:(_fs.grahamDiscount.numVal<0?K.grn:K.amb)+"12",padding:"2px 7px",borderRadius:4,fontFamily:fm}} title={"Graham Number: "+(_fs.grahamNum?_fs.grahamNum.value:"—")}>{_fs.grahamDiscount.numVal<0?Math.abs(_fs.grahamDiscount.numVal).toFixed(0)+"% below Graham":_fs.grahamDiscount.numVal.toFixed(0)+"% above Graham"}</span>}</span>})()}
                <span style={S.badge(h.c)}>{h.l}</span>
              </div>
            </div>
            {c.kpis.map(function(k){
              var hist=[];if(c.earningsHistory){c.earningsHistory.forEach(function(e){if(e.results){var mid=k.metricId||k.name;var match=e.results.find(function(r){return r.kpi_name===mid||r.kpi_name===k.name||(k.metricId&&r.kpi_name===k.metricId)});if(match)hist.push({q:e.quarter,v:match.actual_value,s:match.status})}})}
              hist.sort(function(a,b){return a.q>b.q?1:-1});
              return<div key={k.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+K.bdr+"40",cursor:"pointer"}} onClick={function(){setModal({type:"kpi",data:k.id})}} title="Click to edit or delete">
                <div style={{width:7,height:7,borderRadius:"50%",background:k.lastResult?k.lastResult.status==="met"?K.grn:K.red:K.dim,flexShrink:0}}/>
                <span style={{fontSize:12,color:K.txt,flex:1}}>{k.name}</span>
                <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{k.target}</span>
                {k.lastResult&&k.lastResult.actual!=null&&<span style={{fontSize:11,fontWeight:600,color:k.lastResult.status==="met"?K.grn:k.lastResult.status==="unclear"?K.dim:K.red,fontFamily:fm}}>{(function(){var v=k.lastResult.actual;var u=METRIC_MAP[k.metricId]?METRIC_MAP[k.metricId].unit:"";if(typeof v!=="number")return v+(u||"");var abs=Math.abs(v);var s=abs>=1000?v.toFixed(0):abs>=10?v.toFixed(1):v.toFixed(2);return s+(u||"")})()}</span>}
                {hist.length>=1&&(function(){var streak=0;for(var si=hist.length-1;si>=0;si--){if(hist[si].s==="met")streak++;else break};var prev=hist.length>=2?hist[hist.length-2]:null;var delta=k.lastResult&&k.lastResult.actual!=null&&prev&&prev.v!=null?k.lastResult.actual-prev.v:null;return<div style={{display:"flex",alignItems:"center",gap:4}}>
                  {hist.slice(-4).map(function(hh,hi){return<div key={hi} title={hh.q+": "+(hh.v!=null?hh.v:hh.s)} style={{width:5,height:14,borderRadius:2,background:hh.s==="met"?K.grn:hh.s==="unclear"?K.dim:K.red,opacity:.85}}/>})}
                  {streak>=2&&<span style={{fontSize:9,fontWeight:700,color:K.grn,fontFamily:fm,marginLeft:1}}>{streak}Q↑</span>}
                  {delta!=null&&Math.abs(delta)>0.05&&<span style={{fontSize:9,fontWeight:600,color:delta>0?K.grn:K.red,fontFamily:fm}}>{delta>0?"+":""}{Math.abs(delta)>=100?delta.toFixed(0):Math.abs(delta)>=10?delta.toFixed(1):delta.toFixed(2)}</span>}
                </div>})()} 
                <IC name="edit" size={10} color={K.dim}/>
              </div>})}
            <button onClick={function(){setModal({type:"kpi"})}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,marginTop:8,padding:0}}>+ Add KPI</button>
          </div>
          :<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:"20px",textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:13,color:K.dim,marginBottom:6}}>No KPIs tracked yet</div>
            <button onClick={function(){setModal({type:"kpi"})}} style={Object.assign({},S.btn,{fontSize:11,padding:"5px 12px"})}>+ Add KPIs</button></div>}
          {/* Earnings check */}
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            <button style={Object.assign({},S.btnChk,{padding:"6px 14px",fontSize:12,flex:1,opacity:cs==="checking"?.6:1})} onClick={function(){if(requirePro("earnings"))checkOne(c.id)}} disabled={cs==="checking"}>{cs==="checking"?"Checking…":cs==="found"?"✓ Found":cs==="not-yet"?"Not Yet":cs==="error"?"✘ Error":"Check Earnings"}</button>
            {c.earningsHistory&&c.earningsHistory.length>0&&<button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12})} onClick={function(){setModal({type:"earningsReport",data:0})}}>Read Report</button>}
            <button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12})} onClick={function(){setModal({type:"manualEarnings"})}}>Enter Manually</button></div>
          {/* Latest earnings card from journal */}
          {(function(){var latestEarnings=(c.decisions||[]).find(function(d2){return d2.cardType==="earnings_review"});
            if(latestEarnings)return<JournalCard entry={latestEarnings}/>;return null})()}
        </div>

        {/* ── 3. THE LEDGER ── */}
        <div id="ds-ledger" style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>THE LEDGER</div>
            <button onClick={function(){setModal({type:"conviction"})}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm}}>Rate conviction</button></div>
          {/* Conviction + Position row */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:12}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px",cursor:"pointer"}} onClick={function(){setModal({type:"conviction"})}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>CONVICTION</span>
                <span style={{fontSize:24,fontWeight:800,color:conv>=7?K.grn:conv>=4?K.amb:conv>0?K.red:K.dim,fontFamily:fm}}>{conv||"—"}<span style={{fontSize:13,fontWeight:400,color:K.dim}}>/10</span></span></div>
              {c.convictionHistory&&c.convictionHistory.length>1&&<div style={{display:"flex",gap:2,marginTop:8}}>
                {c.convictionHistory.slice(-12).map(function(ch,i){return<div key={i} style={{flex:1,height:Math.max(4,ch.rating*4),borderRadius:2,background:ch.rating>=7?K.grn:ch.rating>=4?K.amb:K.red,opacity:.7}}/>})}</div>}
            </div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px",cursor:"pointer"}} onClick={function(){setModal({type:"position"})}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:4}}>POSITION</div>
              {pos.shares>0?<div>
                <div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>{pos.shares} shares @ ${pos.avgCost}</div>
                {pos.currentPrice>0&&<div style={{fontSize:13,color:((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?K.grn:K.red,fontFamily:fm,marginTop:2}}>{((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?"+":""}{((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)}% (${((pos.currentPrice-pos.avgCost)*pos.shares).toFixed(0)})</div>}
              </div>:<div style={{fontSize:13,color:K.dim}}>Click to add position</div>}
            </div></div>
          {/* Recent decisions */}
          {(function(){var recent=(c.decisions||[]).filter(function(d2){return d2.cardType==="decision"||(!d2.cardType&&d2.reasoning)}).slice(0,2);
            if(recent.length===0)return null;
            return<div>{recent.map(function(d2){return<JournalCard key={d2.id} entry={d2}/>})}</div>})()}
        </div>

        {/* ── STRESS TEST ── */}
        {(function(){var scenarios=c.scenarios||[];var answeredCount=scenarios.length;
          return<div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>STRESS TEST</div>
            <button onClick={function(){setModal({type:"scenario"})}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><IC name="shield" size={10} color={K.acc}/>{answeredCount>0?"Review plans":"Plan ahead"}</button></div>
          {answeredCount>0?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:600,color:K.txt}}>{answeredCount} scenario{answeredCount>1?"s":""} planned</div>
              <div style={{flex:1}}/>
              <span style={{fontSize:10,color:K.grn,fontFamily:fm,fontWeight:600,background:K.grn+"10",padding:"2px 8px",borderRadius:4}}>{answeredCount>=5?"Well prepared":answeredCount>=3?"Good start":"Keep going"}</span></div>
            {scenarios.slice(0,3).map(function(s){return<div key={s.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 0",borderTop:"1px solid "+K.bdr+"30",cursor:"pointer"}} onClick={function(){setModal({type:"scenario",data:s.id})}}>
              <IC name="check" size={12} color={K.grn}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,fontWeight:600,color:K.acc,fontFamily:fm}}>{(s.category||"").toUpperCase()}</div>
                <div style={{fontSize:12,color:K.mid,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{s.response}</div></div>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm,flexShrink:0}}>{s.answeredAt?fD(s.answeredAt):""}</span></div>})}
          </div>
          :<div style={{background:K.card,border:"1px dashed "+K.acc+"30",borderRadius:12,padding:"20px",textAlign:"center",cursor:"pointer"}} onClick={function(){setModal({type:"scenario"})}}>
            <IC name="shield" size={20} color={K.acc}/>
            <div style={{fontSize:13,color:K.acc,fontWeight:600,marginBottom:4}}>Stress-test your conviction</div>
            <div style={{fontSize:12,color:K.dim,lineHeight:1.5,maxWidth:320,margin:"0 auto"}}>What would you do if {c.ticker} dropped 40%? If the CEO resigned? Plan your response now.</div></div>}
        </div>})()}
        {/* ── VALUATION ── */}
        {(function(){var val=c.valuation||{metrics:[]};var snap2=c.financialSnapshot||{};var price2=(c.position||{}).currentPrice||(snap2.livePrice&&snap2.livePrice.numVal?snap2.livePrice.numVal:0)||(snap2.pe&&snap2.eps?(parseFloat(String(snap2.pe.value||"").replace(/[^0-9.]/g,""))||0)*(parseFloat(String(snap2.eps.value||"").replace(/[^0-9.\-]/g,""))||0):0);
          var results=val.metrics.map(function(vm){var def=VALUATION_METRICS.find(function(m){return m.id===vm.id});if(!def)return null;
            var current=getValMetricValue(def,snap2,price2,c);var pass=current!=null&&vm.threshold>0?(vm.rule==="gte"?current>=vm.threshold:current<=vm.threshold):null;
            return{id:vm.id,label:def.label,unit:def.unit,rule:vm.rule,threshold:vm.threshold,current:current,pass:pass}}).filter(Boolean);
          var passCount=results.filter(function(r){return r.pass===true}).length;var failCount=results.filter(function(r){return r.pass===false}).length;
          var totalJudged=passCount+failCount;var verdict=totalJudged===0?null:passCount>=totalJudged*0.75?"Attractive":passCount>=totalJudged*0.5?"Fair":"Expensive";
          var verdictColor=verdict==="Attractive"?K.grn:verdict==="Fair"?K.amb:verdict==="Expensive"?K.red:K.dim;
          return<div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>VALUATION</div>
            <button onClick={function(){setModal({type:"valuation"})}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm}}>{results.length>0?"Edit framework":"Set up"}</button></div>
          {results.length>0?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px"}}>
            {verdict&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16,fontWeight:800,color:verdictColor,fontFamily:fm}}>{verdict}</span>
                <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{passCount}/{totalJudged} criteria met</span></div>
              <div style={{display:"flex",gap:3}}>{results.map(function(r){return<div key={r.id} style={{width:8,height:8,borderRadius:"50%",background:r.pass===true?K.grn:r.pass===false?K.red:K.dim+"40"}}/>})}</div></div>}
            {results.map(function(r,ri){return<div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:ri>0?"1px solid "+K.bdr+"30":"none"}}>
              <span style={{fontSize:12,color:K.mid,flex:1}}>{r.label}</span>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{r.rule==="gte"?"\u2265":"\u2264"}{r.threshold}{r.unit}</span>
              <span style={{fontSize:13,fontWeight:700,color:r.pass===true?K.grn:r.pass===false?K.red:K.dim,fontFamily:fm,minWidth:48,textAlign:"right"}}>{r.current!=null?r.current.toFixed(r.unit==="%"?1:r.current<1?2:1)+r.unit:"\u2014"}</span>
              <span style={{width:6,height:6,borderRadius:"50%",background:r.pass===true?K.grn:r.pass===false?K.red:K.dim+"40",flexShrink:0}}/></div>})}
            {val.updatedAt&&<div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:8,textAlign:"right"}}>Framework set {fD(val.updatedAt)}</div>}
          </div>
          :<div style={{background:K.card,border:"1px dashed "+K.acc+"30",borderRadius:12,padding:"20px",textAlign:"center",cursor:"pointer"}} onClick={function(){setModal({type:"valuation"})}}>
            <IC name="chart" size={20} color={K.acc}/>
            <div style={{fontSize:13,color:K.acc,fontWeight:600,marginBottom:4,marginTop:6}}>Define your valuation framework</div>
            <div style={{fontSize:12,color:K.dim,lineHeight:1.5,maxWidth:320,margin:"0 auto"}}>Pick the metrics that matter to you — FCF yield, P/E, PEG, earnings yield — and set your own thresholds for what constitutes good value.</div></div>}
        </div>})()}
        {/* ── MARKET DATA DIVIDER ── */}
        {(function(){
          var hasSnap=Object.keys(c.financialSnapshot||{}).length>0;
          var hasEarnings=c.earningSummary||c.earningsHistory&&c.earningsHistory.length>0;
          if(!hasSnap&&!hasEarnings)return null;
          var mktOpen=dossierMktOpen!==false;
          return<div style={{marginBottom:mktOpen?20:0}}>
            <div onClick={function(){setDossierMktOpen(function(v){return v===false?true:false})}} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 0",marginBottom:mktOpen?16:0,userSelect:"none"}}>
              <div style={{flex:1,height:1,background:K.bdr}}/>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:999,background:K.card,border:"1px solid "+K.bdr,flexShrink:0}}>
                <IC name="bar" size={11} color={K.dim}/>
                <span style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600}}>Market Data</span>
                <span style={{fontSize:11,color:K.dim,transform:mktOpen?"rotate(0)":"rotate(-90deg)",transition:"transform .2s",display:"inline-block",lineHeight:1}}>▾</span>
              </div>
              <div style={{flex:1,height:1,background:K.bdr}}/>
            </div>
          </div>
        })()}
        {dossierMktOpen!==false&&<div>
        {/* ── OWNER'S NUMBERS ── */}
        {(function(){var snap=c.financialSnapshot||{};var hasSnap=Object.keys(snap).length>0;
          if(!hasSnap)return null;
          // Group metrics
          var valuation=[];var returns=[];var divInfo=[];var health=[];
          if(snap.pe)valuation.push({l:"P/E",v:snap.pe.value,tip:"Price to earnings"});
          if(snap.pb)valuation.push({l:"P/B",v:snap.pb.value,tip:"Price to book"});
          if(snap.fcf)valuation.push({l:"FCF/Share",v:snap.fcf.value,tip:"Free cash flow per share"});
          if(snap.evSales)valuation.push({l:"EV/Sales",v:snap.evSales.value});
          if(snap.evFcf)valuation.push({l:"EV/FCF",v:snap.evFcf.value});
          // PEG ratio — prefer fetched value, fall back to P/E ÷ EPS growth
          var peVal=snap.pe?parseFloat(String(snap.pe.value).replace(/[^0-9.\-]/g,""))||0:0;
          if(snap.peg&&snap.peg.numVal!=null){var pegV=snap.peg.numVal;valuation.push({l:"PEG",v:pegV.toFixed(2),isGood:pegV<1.5,isNeutral:pegV>=1.5&&pegV<3})}
          else{var egVal=snap.epsGrowth?Math.abs(parseFloat(String(snap.epsGrowth.value).replace(/[^0-9.]/g,""))||0):(snap.revGrowth?Math.abs(parseFloat(String(snap.revGrowth.value).replace(/[^0-9.]/g,""))||0):0);
            if(peVal>0&&egVal>1){var peg2=peVal/egVal;valuation.push({l:"PEG",v:peg2.toFixed(2),isGood:peg2<1.5,isNeutral:peg2>=1.5&&peg2<3})}}
          // Earnings yield
          if(peVal>0){var ey2=(1/peVal*100);valuation.push({l:"Earnings Yield",v:ey2.toFixed(1)+"%",isGood:ey2>5})}
          // FCF yield — use pre-computed snap.fcfYield (numVal) if available; avoids string-parse sign errors
          if(snap.fcfYield&&snap.fcfYield.numVal!=null){valuation.push({l:"FCF Yield",v:snap.fcfYield.value,isGood:snap.fcfYield.numVal>4})}
          else if(snap.fcf&&pos.currentPrice>0){var fcfVal2=parseFloat(String(snap.fcf.value).replace(/[^0-9.\-]/g,""))||0;if(fcfVal2!==0){var fcfY=fcfVal2/pos.currentPrice*100;valuation.push({l:"FCF Yield",v:fcfY.toFixed(1)+"%",isGood:fcfY>4})}}
          if(snap.hi52&&snap.lo52&&snap.hi52.value){var cp=pos.currentPrice||0;if(cp>0){var _h52=parseFloat(String(snap.hi52.value).replace(/[^0-9.]/g,""))||0;if(_h52>0){var pctOfHi=((cp/_h52)*100).toFixed(0);valuation.push({l:"vs 52w High",v:pctOfHi+"%",tip:"Current price as % of 52-week high",isNeutral:true})}}}
          if(snap.roic)returns.push({l:"ROIC",v:snap.roic.value,tip:"Return on invested capital",isGood:parseFloat(snap.roic.value)>=12});
          if(snap.roe)returns.push({l:"ROE",v:snap.roe.value,tip:"Return on equity",isGood:parseFloat(snap.roe.value)>=15});
          if(snap.roce&&snap.roce.value)returns.push({l:"ROCE",v:snap.roce.value,isGood:parseFloat(snap.roce.value)>=12});
          if(snap.grossMargin)returns.push({l:"Gross Margin",v:snap.grossMargin.value,tip:"Revenue minus COGS"});
          if(snap.opMargin)returns.push({l:"Op. Margin",v:snap.opMargin.value,tip:"Operating income / revenue"});
          if(snap.netMargin)returns.push({l:"Net Margin",v:snap.netMargin.value,tip:"Net income / revenue"});
          if(snap.revGrowth)returns.push({l:"Rev Growth",v:snap.revGrowth.value,tip:"Year-over-year revenue growth",isGood:snap.revGrowth.positive});
          // Dividend info
          if(c.divPerShare>0||c.lastDiv>0){var ann=(c.divPerShare||c.lastDiv||0)*(c.divFrequency==="monthly"?12:c.divFrequency==="quarterly"?4:c.divFrequency==="semi"?2:1);
            var yld=pos.currentPrice>0?(ann/pos.currentPrice*100):0;
            var yoc=pos.avgCost>0?(ann/pos.avgCost*100):0;
            divInfo.push({l:"Per Payment",v:"$"+(c.divPerShare||c.lastDiv||0).toFixed(2)});
            divInfo.push({l:"Frequency",v:c.divFrequency==="monthly"?"Monthly":c.divFrequency==="semi"?"Semi-Annual":c.divFrequency==="annual"?"Annual":"Quarterly"});
            if(yld>0)divInfo.push({l:"Yield",v:yld.toFixed(2)+"%",isGood:yld>=2});
            if(yoc>0&&yoc!==yld)divInfo.push({l:"Yield on Cost",v:yoc.toFixed(2)+"%",isGood:yoc>yld});
            divInfo.push({l:"Annual/Share",v:"$"+ann.toFixed(2)});
            if(pos.shares>0)divInfo.push({l:"Annual Income",v:cSym+(pos.shares*ann).toFixed(0),isGood:true});
            if(c.exDivDate)divInfo.push({l:"Next Ex-Div",v:fD(c.exDivDate)})}
          else if(c.divFrequency==="none"||(!c.divPerShare&&!c.lastDiv)){
            divInfo.push({l:"Dividend",v:"None",isNeutral:true})}
          // Shareholder yield = div yield + buyback yield
          try{
          var _divYEntry=divInfo.find(function(d){return d.l==="Yield"});
          var _divYVNum=_divYEntry?Number(parseFloat(_divYEntry.v)||0):0;
          var _bbyVNum=snap.buybackYield&&snap.buybackYield.numVal!=null&&!isNaN(snap.buybackYield.numVal)?Number(snap.buybackYield.numVal):0;
          var _shyNum=_divYVNum+_bbyVNum;
          if(_shyNum>0.5&&isFinite(_shyNum))divInfo.push({l:"Shareholder Yield",v:_shyNum.toFixed(1)+"%",isGood:_shyNum>5,tip:"Div yield + buyback yield"});
          }catch(shyErr){}
          try{if(snap.divGrowth&&snap.divGrowth.numVal!=null&&!isNaN(snap.divGrowth.numVal)&&Math.abs(snap.divGrowth.numVal)<100)divInfo.push({l:"Div Growth",v:(snap.divGrowth.numVal>=0?"+":"")+Number(snap.divGrowth.numVal).toFixed(1)+"%",isGood:snap.divGrowth.numVal>0});}catch(dgErr){}
          if(snap.currentRatio)health.push({l:"Current Ratio",v:snap.currentRatio.value,isGood:parseFloat(snap.currentRatio.value)>=1.5});
          if(snap.debtEquity)health.push({l:"Debt/Equity",v:snap.debtEquity.value,isGood:parseFloat(snap.debtEquity.value)<1});
          if(snap.mktCap)health.push({l:"Market Cap",v:snap.mktCap.value});
          if(snap.quickRatio)health.push({l:"Quick Ratio",v:snap.quickRatio.value,isGood:parseFloat(snap.quickRatio.value)>=1});
          if(snap.interestCoverage)health.push({l:"Interest Coverage",v:snap.interestCoverage.value,isGood:snap.interestCoverage.numVal>=3});
          if(snap.netDebtEbitda)health.push({l:"Net Debt/EBITDA",v:snap.netDebtEbitda.value,isGood:parseFloat(snap.netDebtEbitda.value)<3});
          if(snap.buybackYield)health.push({l:"Buyback Yield",v:snap.buybackYield.value,isGood:true});
          // Price vs Value section
          var pvSection=[];
          try{
          var _cp=pos&&pos.currentPrice>0?pos.currentPrice:0;
          if(c.targetPrice>0&&_cp>0){var _tgap=((c.targetPrice-_cp)/_cp*100);pvSection.push({l:"vs Target",v:(_tgap>0?"+":"")+_tgap.toFixed(0)+"%",isGood:_tgap>0,tip:"Target: "+cSym+Number(c.targetPrice).toFixed(2)})}
          var _gnVal=snap.grahamNum&&snap.grahamNum.numVal!=null?Number(snap.grahamNum.numVal):0;
          if(_gnVal>0&&_cp>0&&_gnVal<_cp*10){var _gg=((_gnVal-_cp)/_cp*100);pvSection.push({l:"Graham #",v:cSym+_gnVal.toFixed(2),isGood:_cp<=_gnVal,tip:(_cp<=_gnVal?"Below":"Above")+" Graham by "+Math.abs(_gg).toFixed(0)+"%"})}
          var _epsVal=snap.eps&&snap.eps.numVal!=null&&!isNaN(snap.eps.numVal)?Number(snap.eps.numVal):0;
          if(_epsVal>0&&_cp>0){var _fv15=_epsVal*15;var _fvUp=((_fv15-_cp)/_cp*100);if(Math.abs(_fvUp)<300)pvSection.push({l:"15x EPS FV",v:cSym+_fv15.toFixed(2),isGood:_cp<_fv15,tip:"15x earnings = "+cSym+_fv15.toFixed(2)+(_fvUp>0?" ("+_fvUp.toFixed(0)+"% upside)":"")})}
          var _fcfVal=snap.fcf&&snap.fcf.numVal!=null&&!isNaN(snap.fcf.numVal)?Number(snap.fcf.numVal):0;
          if(_fcfVal>0&&_cp>0){var _fcfFV=_fcfVal/0.05;if(_fcfFV>0&&_fcfFV<_cp*10)pvSection.push({l:"FCF@5% FV",v:cSym+_fcfFV.toFixed(2),isGood:_cp<_fcfFV,tip:"Price implied by 5% FCF yield"})}
          }catch(pvErr){pvSection=[];}
          var sections=[];
          if(pvSection.length>0)sections.push({title:"PRICE vs VALUE",items:pvSection,color:"#9333EA"});
          if(valuation.length>0)sections.push({title:"VALUATION",items:valuation,color:K.blue});
          if(returns.length>0)sections.push({title:"RETURNS & GROWTH",items:returns,color:K.grn});
          if(divInfo.length>0)sections.push({title:"DIVIDENDS",items:divInfo,color:K.amb});
          if(health.length>0)sections.push({title:"FINANCIAL HEALTH",items:health,color:K.mid});
          if(sections.length===0)return null;
          return<div id="ds-numbers" style={{marginBottom:24}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600,marginBottom:10}}>OWNER'S NUMBERS</div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}>
              {sections.map(function(sec,si){return<div key={si} style={{marginBottom:si<sections.length-1?14:0}}>
                <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:sec.color,fontFamily:fm,fontWeight:700,marginBottom:6}}>{sec.title}</div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:"6px 16px"}}>
                  {sec.items.map(function(item,ii){return<div key={ii} title={item.tip||""} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid "+K.bdr+"30",cursor:item.tip?"help":"default"}}>
                    <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{item.l}{item.tip&&<span style={{color:K.dim,fontSize:9,marginLeft:3}}>ⓘ</span>}</span>
                    <span style={{fontSize:12,fontWeight:700,fontFamily:fm,color:item.isGood===true?K.grn:item.isGood===false?K.red:item.isNeutral?K.mid:K.txt}}>{item.v}</span></div>})}</div></div>})}</div></div>})()}


                {/* -- INSIDER ACTIVITY -- */}
        {isPro&&<div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>INSIDER ACTIVITY</div></div>
          {insiderData?<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            {/* Insider Transactions */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px"}}>
              <div style={{fontSize:12,fontWeight:600,color:K.txt,marginBottom:10}}>Recent Transactions</div>
              {insiderData.transactions&&insiderData.transactions.length>0?
                <div>{(function(){
                  var buys=insiderData.transactions.filter(function(t2){return t2.transactionType==="P"||(!t2.transactionType&&t2.change>0)});
                  var sells=insiderData.transactions.filter(function(t2){return t2.transactionType==="S"||t2.transactionType==="D"||t2.transactionType==="F"||(!t2.transactionType&&t2.change<0)});
                  var netBuy=buys.length>sells.length;
                  return<div>
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <div style={{flex:1,padding:"6px 10px",borderRadius:6,background:K.grn+"08",border:"1px solid "+K.grn+"20",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:700,color:K.grn,fontFamily:fm}}>{buys.length}</div>
                        <div style={{fontSize:8,color:K.grn}}>Purchases</div></div>
                      <div style={{flex:1,padding:"6px 10px",borderRadius:6,background:K.red+"08",border:"1px solid "+K.red+"20",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:700,color:K.red,fontFamily:fm}}>{sells.length}</div>
                        <div style={{fontSize:8,color:K.red}}>Sales</div></div></div>
                    {netBuy&&buys.length>0&&<div style={{fontSize:11,color:K.grn,fontFamily:fm,marginBottom:8}}>Net insider buying — typically a bullish signal</div>}
                    {insiderData.transactions.slice(0,5).map(function(t2,i2){
                      var txT=t2.transactionType||"";
                      var lbl=txT==="P"?"BUY":txT==="S"?"SELL":txT==="A"?"GRANT":txT==="M"?"EXER":txT==="F"?"TAX":txT==="D"?"DISP":t2.change>0?"BUY":"SELL";
                      var lclr=txT==="P"?K.grn:txT==="S"||txT==="D"||txT==="F"?K.red:txT==="A"||txT==="M"?K.blue:t2.change>0?K.grn:K.red;
                      var role=(t2.name||"").toLowerCase();var isExec=role.indexOf("ceo")>=0||role.indexOf("cfo")>=0||role.indexOf("chief")>=0||role.indexOf("president")>=0||role.indexOf("director")>=0;
                      return<div key={i2} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i2<4?"1px solid "+K.bdr+"30":"none"}}>
                        <div style={{width:24,height:24,borderRadius:"50%",background:isExec?K.acc+"15":K.bg,border:"1px solid "+(isExec?K.acc+"30":K.bdr),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isExec?K.acc:K.dim} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                        <div style={{flex:1,overflow:"hidden"}}>
                          <div style={{fontSize:11,fontWeight:600,color:K.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t2.name}</div>
                          <div style={{fontSize:8,color:K.dim}}>{t2.transactionDate}</div></div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:11,fontWeight:600,color:lclr,fontFamily:fm}}>{lbl}</div>
                          <div style={{fontSize:8,color:K.dim,fontFamily:fm}}>{Math.abs(t2.change||0).toLocaleString()} sh</div></div></div>})}</div>})()}</div>
              :<div style={{fontSize:12,color:K.dim,padding:"8px 0"}}>No recent insider transactions</div>}
            </div>
            {/* Top Institutional Holders */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px"}}>
              <div style={{fontSize:12,fontWeight:600,color:K.txt,marginBottom:10}}>Top Institutional Holders</div>
              {insiderData.institutions&&insiderData.institutions.length>0?
                <div>{insiderData.institutions.slice(0,7).map(function(inst,i2){
                  var isVanguard=(inst.holder||"").indexOf("Vanguard")>=0;var isBlackrock=(inst.holder||"").indexOf("BlackRock")>=0||((inst.holder||"").indexOf("Blackrock")>=0);var isFidelity=(inst.holder||"").indexOf("Fidelity")>=0;
                  var isPassive=isVanguard||isBlackrock||isFidelity;
                  return<div key={i2} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i2<6?"1px solid "+K.bdr+"30":"none"}}>
                    <div style={{width:24,height:24,borderRadius:"50%",background:isPassive?K.blue+"12":K.acc+"12",border:"1px solid "+(isPassive?K.blue+"25":K.acc+"25"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isPassive?K.blue:K.acc} strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8l-2 4h12l-2-4z"/></svg></div>
                    <div style={{flex:1,overflow:"hidden"}}>
                      <div style={{fontSize:11,fontWeight:600,color:K.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inst.holder}</div>
                      <div style={{fontSize:8,color:K.dim}}>{inst.dateReported?inst.dateReported.substring(0,10):""}</div></div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm}}>{inst.shares?(inst.shares/1e6).toFixed(1)+"M":"?"}</div>
                      <div style={{fontSize:8,color:K.dim}}>shares</div></div></div>})}</div>
              :<div style={{fontSize:12,color:K.dim,padding:"8px 0"}}>No institutional holder data available</div>}
            </div>
          </div>
          :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px",textAlign:"center"}}>
              <div className="ta-skel" style={{height:8,width:"70%",background:K.bdr,margin:"0 auto 8px",borderRadius:4}}/>
              <div className="ta-skel" style={{height:6,background:K.bdr,borderRadius:3}}/></div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px",textAlign:"center"}}>
              <div className="ta-skel" style={{height:8,width:"70%",background:K.bdr,margin:"0 auto 8px",borderRadius:4}}/>
              <div className="ta-skel" style={{height:6,background:K.bdr,borderRadius:3}}/></div></div>}
        </div>}

                {/* ── 4. THE MOAT ── */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>THE MOAT</div>
            <button onClick={function(){setSubPage("moat")}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm}}>Full analysis {"→"}</button></div>
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
                  <div style={{fontSize:11,color:K.dim}}>{dossierMoat.years}yr data · {dossierMoat.metrics.length} dimensions</div></div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {(function(){var mt2=c.moatTypes||{};return MOAT_TYPES.filter(function(t2){return mt2[t2.id]&&mt2[t2.id].active}).map(function(t2){
                    return<span key={t2.id} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:8,color:t2.color,background:t2.color+"10",padding:"2px 7px",borderRadius:3,fontFamily:fm,fontWeight:600}}><IC name={t2.icon} size={8} color={t2.color}/>{t2.label}</span>})})()}</div></div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"4px 16px"}}>
                {dossierMoat.metrics.slice(0,8).map(function(m){var barColor=m.score>=8?K.grn:m.score>=6?K.amb:K.red;
                  return<div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0"}}>
                    <span style={{fontSize:10,color:K.mid,fontFamily:fm,width:isMobile?90:110,flexShrink:0}}>{m.name.length>18?m.name.substring(0,18)+"…":m.name}</span>
                    <div style={{flex:1,height:6,borderRadius:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:(m.score*10)+"%",borderRadius:3,background:barColor,transition:"width .4s"}}/></div>
                    <span style={{fontSize:10,fontWeight:700,color:barColor,fontFamily:fm,width:20,textAlign:"right"}}>{m.score.toFixed(0)}</span></div>})}</div>
            </div>})()
          :!isPro?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px",textAlign:"center"}}>
            <div style={{fontSize:13,color:K.dim,marginBottom:8}}>Moat analysis powered by financial data</div>
            <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("financials")}} style={Object.assign({},S.btn,{fontSize:11,padding:"5px 14px"})}>Upgrade to unlock</button></div>
          :<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px",textAlign:"center"}}>
            <div className="ta-skel" style={{height:10,width:"60%",background:K.bdr,margin:"0 auto 8px",borderRadius:4}}/>
            <div className="ta-skel" style={{height:6,background:K.bdr,borderRadius:3}}/></div>}
        </div>

        {/* Expected CAGR contribution */}
        {isPro&&(function(){var p2=c.position||{};if(!p2.shares||!p2.currentPrice||p2.currentPrice<=0)return null;
          var fs=c.financialSnapshot||{};
          function dpv(field){if(!fs[field])return 0;var v=fs[field].value;if(typeof v==="number")return v;if(typeof v==="string")return parseFloat(v.replace(/[^\d.\-]/g,""))||0;return 0}
          var eg=0;var kpiA=c.kpis.find(function(k){return(k.metricId==="revGrowth"||k.metricId==="epsGrowth")&&k.lastResult&&k.lastResult.actual});
          var kpiT=c.kpis.find(function(k){return(k.metricId==="revGrowth"||k.metricId==="epsGrowth")&&k.value>0});
          var snapG=dpv("revGrowth")||dpv("epsGrowth");
          if(snapG){eg=snapG}else if(kpiA){eg=kpiA.lastResult.actual}else if(kpiT){eg=kpiT.value}else{var se={growth:18,aggressive:22,quality:12,value:8,income:6,compounder:14,speculative:25};eg=se[c.investStyle]||10}
          // Market cap mean reversion (same logic as Performance & Goals)
          var mcap=c.mktCap||0;
          var baseR=mcap>500e9?9:mcap>100e9?11:mcap>50e9?13:mcap>10e9?15:mcap>1e9?17:20;
          var capG=mcap>500e9?15:mcap>100e9?20:mcap>50e9?25:mcap>10e9?35:mcap>1e9?45:60;
          eg=Math.min(eg,capG);
          var bw=mcap>500e9?0.55:mcap>100e9?0.4:mcap>50e9?0.3:mcap>10e9?0.2:0.1;
          eg=eg*(1-bw)+baseR*bw;
          if(eg>baseR){var dcay=mcap>500e9?0.08:mcap>100e9?0.06:0.04;eg=baseR+(eg-baseR)*Math.pow(1-dcay,Math.max(goals.horizon,5)/2)}
          var dy=dpv("divYield")||(c.divYield||0);var pe=dpv("pe");
          var fairPE=eg>30?40:eg>20?30:eg>12?25:eg>5?18:14;
          var mc=0;if(pe>0&&pe<200){mc=(Math.pow(fairPE/pe,1/Math.max(goals.horizon,1))-1)*100;mc=Math.max(-12,Math.min(12,mc))}
          var expected=eg+dy+mc;if(eg===0&&dy===0)return null;
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm}}>Expected Return Contribution</div>
              <button onClick={function(){if(isPro){setPage("hub");setHubTab("goals")}else{setShowUpgrade(true);setUpgradeCtx("goals")}}} style={{fontSize:11,color:K.acc,background:"none",border:"none",cursor:"pointer",fontFamily:fm}}>Goals {"\u2192"}</button></div>
            <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:6}}>
              <span style={{fontSize:22,fontWeight:700,color:expected>=0?K.grn:K.red,fontFamily:fm}}>{expected>=0?"+":""}{expected.toFixed(1)}%</span>
              <span style={{fontSize:12,color:K.dim}}>expected annual</span></div>
            <div style={{display:"flex",gap:12,fontSize:11,color:K.dim,fontFamily:fm}}>
              <span>Earnings: {eg>=0?"+":""}{eg.toFixed(1)}%</span>
              {dy>0&&<span>Yield: +{dy.toFixed(1)}%</span>}
              <span>Multiple: {mc>=0?"+":""}{mc.toFixed(1)}%</span></div>
          </div>})()}
        {/* ── 5. KEY METRICS CHART ── */}
        {keyFin&&keyFin.length>=2&&<div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>KEY METRICS</div>
            <button onClick={function(){if(isPro)setSubPage("financials");else{setShowUpgrade(true);setUpgradeCtx("financials")}}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm}}>Full financials {"→"}</button></div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}>
            <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
              {[{k:"revenue",l:"Revenue",c:"#1cb0f6"},{k:"netIncome",l:"Net Income",c:"#58cc02"},{k:"fcf",l:"Free Cash Flow",c:"#ff9600"},{k:"sbc",l:"Stock-Based Comp",c:"#ce82ff"}].map(function(m){
                return<div key={m.k} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:8,height:8,borderRadius:2,background:m.c}}/>
                  <span style={{fontSize:10,color:K.mid,fontFamily:fm}}>{m.l}</span></div>})}</div>
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
                    <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>{pt.date?pt.date.substring(0,4):""}</div>
                    {MK.map(function(m){return pt[m.k]!=null?<div key={m.k} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{width:6,height:6,borderRadius:2,background:m.c,flexShrink:0}}/>
                      <span style={{fontSize:10,color:K.mid,fontFamily:fm,flex:1}}>{m.k==="revenue"?"Revenue":m.k==="netIncome"?"Net Income":m.k==="fcf"?"FCF":"SBC"}</span>
                      <span style={{fontSize:11,fontWeight:700,color:m.c,fontFamily:fm}}>{fmtBig(pt[m.k])}</span></div>:null})}</div>})()}
              </div>})()}
          </div>
        </div>}

        {/* ── LINKS ── */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:20}}>
          <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}} onClick={function(){if(isPro){setSubPage("financials")}else{setShowUpgrade(true);setUpgradeCtx("financials")}}}>
            <IC name="chart" size={16} color={K.blue}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt}}>Full Financials</div>
              <div style={{fontSize:10,color:K.dim}}>Income, balance, cash flow</div></div>
            {!isPro&&<span style={{fontSize:8,color:K.acc,fontFamily:fm,background:K.acc+"12",padding:"2px 5px",borderRadius:3}}>PRO</span>}
            <span style={{color:K.acc}}>{"→"}</span></div>
          {c.irUrl&&<a href={c.irUrl} target="_blank" rel="noopener noreferrer" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}>
            <IC name="link" size={16} color={K.mid}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt}}>Investor Relations</div>
              <div style={{fontSize:10,color:K.dim}}>{c.domain||"IR page"}</div></div>
            <span style={{color:K.acc}}>{"↗"}</span></a>}
        </div>
        {/* Research preview */}
        {(c.decisions||[]).length+(c.docs||[]).length>0&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>RESEARCH TRAIL</div>
            </div>
          {(c.decisions||[]).concat((c.docs||[]).map(function(d2){return Object.assign({},d2,{cardType:d2.isClip?"clip":d2.isMemo?"memo":d2.isIR?"ir":"doc",date:d2.updatedAt})})).sort(function(a,b){return(b.date||"")>(a.date||"")?1:-1}).slice(0,3).map(function(d2,di){
            return d2.cardType&&CARD_STYLES[d2.cardType]?<JournalCard key={di} entry={d2}/>:<div key={di} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"10px 14px",marginBottom:6,fontSize:12,color:K.mid}}>
              <span style={{fontWeight:600,color:K.txt}}>{d2.title||d2.ticker||""}</span> {d2.content?d2.content.substring(0,80)+"...":d2.reasoning?d2.reasoning.substring(0,80)+"...":""}</div>})}</div>}

        {/* Charts & analyst data (collapsible) */}
        {dashSet.showPriceChart&&<PriceChart company={c}/>}

        {/* ── RESEARCH TRAIL (inline) ── */}
        <div id="ds-research" style={{marginBottom:24,marginTop:8}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingTop:16,borderTop:"1px solid "+K.bdr}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>RESEARCH TRAIL</div>
            <div style={{display:"flex",gap:6}}>
              <button style={Object.assign({},S.btnP,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"memo"})}}>+ Memo</button>
              <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"clip"})}}>+ Clip</button>
              <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>+ Note</button>
            </div>
          </div>
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
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{nDec} entries</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{nDoc} docs</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{nConv} conviction updates</span>
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
        <div style={{padding:"12px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10,marginTop:8}}><div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>{"ℹ️"} Data from SEC EDGAR + FMP + Finnhub</div></div>
        </div>{/* end research trail */}
    </div>
  }
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
    var streak=streakData.current||0;
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
    var ht=hubTab,setHt=setHubTab;
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

    return<div className="ta-page-pad" style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 32px 60px",maxWidth:1000}}>
      {/* Header with score ring + unified progress */}
      <div style={{padding:isMobile?"20px 0 16px":"28px 0 24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:isMobile?14:24,marginBottom:isMobile?16:0}}>
          <div style={{position:"relative",width:isMobile?68:80,height:isMobile?68:80,flexShrink:0}}>
            <svg width={isMobile?68:80} height={isMobile?68:80} viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke={K.bdr} strokeWidth="5"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke={os.total>=85?"#FFD700":os.total>=70?K.grn:os.total>=50?K.amb:os.total>=25?K.blue:K.red} strokeWidth="5" strokeDasharray={Math.round(os.total/100*214)+" 214"} strokeLinecap="round" transform="rotate(-90 40 40)"/></svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontSize:isMobile?20:24,fontWeight:700,color:os.total>=85?"#FFD700":os.total>=70?K.grn:os.total>=50?K.amb:os.total>=25?K.blue:K.red,fontFamily:fm,lineHeight:1}}>{os.total}</div>
              <div style={{fontSize:8,color:K.dim,fontFamily:fm}}>/ 100</div></div></div>
          <div style={{flex:1,minWidth:0}}>
            <h1 style={{margin:0,fontSize:isMobile?26:26,fontWeight:isMobile?900:400,color:K.txt,fontFamily:fh,letterSpacing:isMobile?"-0.5px":"normal"}}>Owner's Hub</h1>
            <div style={{fontSize:14,color:K.mid,marginTop:2}}>Process Health <span style={{color:K.dim}}>·</span> <span style={{fontSize:12,color:os.total>=80?K.grn:os.total>=50?K.amb:K.red}}>{os.total>=80?"Strong":os.total>=50?"Improving":"Needs attention"}</span></div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8,flexWrap:"wrap"}}>
              <div style={{width:isMobile?120:140,height:4,borderRadius:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:pctToNext+"%",borderRadius:2,background:os.total>=85?"#FFD700":os.total>=70?K.grn:os.total>=50?K.amb:K.blue,transition:"width .3s"}}/></div>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{currentLevel.icon} {currentLevel.name}</span>
            </div></div></div>
        {/* Quick stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:isMobile?8:16,marginTop:isMobile?12:16}}>
          <div style={{textAlign:"center",padding:isMobile?"10px 8px":"8px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10}}>
            <div style={{fontSize:isMobile?22:20,fontWeight:700,color:K.txt,fontFamily:fm}}>{portfolio.length}</div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>holdings</div></div>
          <div style={{textAlign:"center",padding:isMobile?"10px 8px":"8px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10}}>
            <div style={{fontSize:isMobile?22:20,fontWeight:700,color:K.txt,fontFamily:fm}}>{scored.length}</div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>scored</div></div>
          <div style={{textAlign:"center",padding:isMobile?"10px 8px":"8px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10}}>
            <div style={{fontSize:isMobile?22:20,fontWeight:700,color:K.txt,fontFamily:fm}}>{allDecs.length}</div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>decisions</div></div></div></div>

      {/* Tab bar — dropdown on mobile, full bar on desktop */}
      {(function(){
        var tabs=[{id:"command",l:"Command Center",icon:"trending"},{id:"lenses",l:"Investor Lenses",icon:"search"},{id:"journal",l:"Research Journal",icon:"book"},{id:"docs",l:"Research Trail",icon:"file"},{id:"reading",l:"Reading List",icon:"book"},{id:"goals",l:"Performance & Goals",icon:"target"}];
        var active=tabs.find(function(t){return t.id===ht})||tabs[0];
        if(isMobile){return<div style={{marginBottom:20}}>
          <div style={{position:"relative"}}>
            <select value={ht} onChange={function(e){setHt(e.target.value)}} style={{width:"100%",background:K.card,border:"1px solid "+K.acc+"50",borderRadius:12,color:K.txt,padding:"13px 44px 13px 18px",fontSize:15,fontFamily:fm,fontWeight:700,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
              {tabs.map(function(t){return<option key={t.id} value={t.id}>{t.l}</option>})}</select>
            <div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg></div></div>
        </div>}
        return<div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid "+K.bdr,overflowX:"auto"}}>
          {tabs.map(function(tab){return<button key={tab.id} onClick={function(){setHt(tab.id)}} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",fontSize:13,fontFamily:fm,fontWeight:ht===tab.id?700:500,color:ht===tab.id?K.acc:K.dim,background:"transparent",border:"none",borderBottom:ht===tab.id?"2px solid "+K.acc:"2px solid transparent",cursor:"pointer",marginBottom:-1,whiteSpace:"nowrap"}}>
            <IC name={tab.icon} size={12} color={ht===tab.id?K.acc:K.dim}/>{tab.l}{tab.dot>0&&<span style={{fontSize:9,fontWeight:700,color:"#fff",background:K.grn,borderRadius:999,padding:"1px 5px",marginLeft:2,lineHeight:1.4}}>{tab.dot}</span>}</button>})}</div>
      })()}

      {/* ═══ COMMAND CENTER TAB ═══ */}
      {ht==="command"&&<div>
        {/* ── Zone 1: Right Now ── */}
        <div style={{marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:14,borderRadius:2,background:K.acc}}/> Right Now</div></div>
        {/* ═══ 7-DAY QUEST ═══ */}
        {(function(){
          var wk=getWeekId();
          var qCompleted=[];
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
          var questChestClaimed=false;
          return<div style={{marginBottom:20}}>
            {/* Focus header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:K.txt}}>This Week's Focus</div>
                <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>Resets every Monday · {doneCount}/{quests.length} complete</div></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:80,height:6,borderRadius:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:questPct+"%",borderRadius:3,background:allDone2?K.grn:K.acc,transition:"width .5s"}}/></div>
                <span style={{fontSize:12,fontWeight:600,color:allDone2?K.grn:K.acc,fontFamily:fm}}>{questPct}%</span></div></div>
            {/* Focus list */}
            <div style={{display:"grid",gap:6}}>
              {quests.map(function(q){return<div key={q.id} className={q.done?"":"ta-card"} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:q.done?K.grn+"06":K.card,border:"1px solid "+(q.done?K.grn+"20":K.bdr),borderRadius:10,cursor:q.done?"default":"pointer",opacity:q.done?.7:1}} onClick={q.done?undefined:q.onClick}>
                <div style={{width:24,height:24,borderRadius:"50%",border:"2px solid "+(q.done?K.grn:q.color),background:q.done?K.grn:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {q.done?<IC name="check" size={12} color="#fff" strokeWidth={3}/>:<IC name={q.icon} size={10} color={q.color}/>}</div>
                <div style={{flex:1,fontSize:13,color:q.done?K.dim:K.txt,textDecoration:q.done?"line-through":"none"}}>{q.text}</div>
                
                {q.done&&<span style={{fontSize:11,color:K.grn,fontFamily:fm}}>{"✓"}</span>}
              </div>})}</div>
            {/* Focus reward preview */}
            {!allDone2&&<div style={{marginTop:12,padding:"10px 16px",background:K.bg,borderRadius:8,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:28,height:28,borderRadius:8,background:"#a78bfa15",display:"flex",alignItems:"center",justifyContent:"center",animation:"glowPulse 2s ease-in-out infinite"}}><IC name="dice" size={14} color="#a78bfa"/></div>
              <div style={{fontSize:12,color:K.dim}}>Complete all actions to claim your weekly insight</div></div>}
            {/* Focus complete + claim */}
            {allDone2&&!questChestClaimed&&<div style={{marginTop:12,textAlign:"center",padding:"20px",background:"linear-gradient(135deg,"+K.acc+"08,#a78bfa08)",border:"1px solid #a78bfa30",borderRadius:12}}>
              <div style={{fontSize:20,marginBottom:8}}>{String.fromCodePoint(0x1F3C6)}</div>
              <div style={{fontSize:14,fontWeight:600,color:K.txt,marginBottom:4}}>All quests complete!</div>
              <div style={{fontSize:12,color:K.dim,marginBottom:12}}>All actions complete! Claim your weekly insight</div>
              <button onClick={function(){setQuestData(function(p){var n=Object.assign({},p,{weekId:getWeekId(),chestClaimed:true});try{localStorage.setItem("ta-quests",JSON.stringify(n))}catch(e){}return n});setTimeout(function(){openQuestChest()},300)}} style={Object.assign({},S.btnP,{padding:"10px 28px",fontSize:14,background:K.acc,borderColor:K.acc})}>Claim Weekly Insight</button></div>}
            {allDone2&&questChestClaimed&&<div style={{marginTop:12,textAlign:"center",padding:"14px",background:K.grn+"06",border:"1px solid "+K.grn+"20",borderRadius:8}}>
              <div style={{fontSize:13,color:K.grn,fontWeight:500}}>All actions complete this week ✓</div>
              <div style={{fontSize:11,color:K.dim}}>New actions every Monday</div></div>}
          </div>})()}

        {/* Upcoming earnings */}
        {upcoming.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px",marginBottom:20}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:K.amb,marginBottom:10,fontFamily:fm}}>Earnings This Fortnight</div>
          {upcoming.map(function(c){var d3=dU(c.earningsDate);return<div key={c.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid "+K.bdr,cursor:"pointer"}} onClick={function(){setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}>
            <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
            <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</span>
            <span style={{fontSize:12,color:K.dim,flex:1}}>{c.name}</span>
            <span style={{fontSize:12,color:K.dim,fontFamily:fm}}>{c.kpis.length} KPIs</span>
            <span style={{fontSize:13,fontWeight:700,color:d3<=3?K.red:K.amb,fontFamily:fm,minWidth:40,textAlign:"right"}}>{d3===0?"Today":d3===1?"1d":d3+"d"}</span></div>})}</div>}


        {/* Staleness alerts */}
        {(function(){var stale=portfolio.filter(function(c2){if(!c2.thesisUpdatedAt)return c2.thesisNote&&c2.thesisNote.length>20;return Math.ceil((Date.now()-new Date(c2.thesisUpdatedAt))/864e5)>90});
          var unchecked=portfolio.filter(function(c2){return!c2.lastChecked&&c2.kpis.length>0});
          if(stale.length===0&&unchecked.length===0)return null;
          return<div style={{background:K.amb+"06",border:"1px solid "+K.amb+"20",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:K.amb,fontFamily:fm,marginBottom:8}}>Needs Attention</div>
            {stale.length>0&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:stale.length>0&&unchecked.length>0?6:0}}>
              <IC name="clock" size={12} color={K.amb}/><div style={{fontSize:12,color:K.mid}}>Thesis refresh: <strong style={{color:K.txt}}>{stale.map(function(c2){return c2.ticker}).join(", ")}</strong></div></div>}
            {unchecked.length>0&&<div style={{display:"flex",alignItems:"center",gap:8}}>
              <IC name="target" size={12} color={K.amb}/><div style={{fontSize:12,color:K.mid}}>KPIs unchecked: <strong style={{color:K.txt}}>{unchecked.map(function(c2){return c2.ticker}).join(", ")}</strong></div></div>}
          </div>})()}

        {/* ── Zone 2: Your Portfolio ── */}
        <div style={{marginTop:20,marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:14,borderRadius:2,background:"#8B5CF6"}}/> Your Portfolio</div></div>
        {/* Recent decisions (last 5) */}
        {allDecs.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm}}>Recent Decisions</div>
            <button onClick={function(){setHt("journal")}} style={{fontSize:11,color:K.acc,background:"none",border:"none",cursor:"pointer",fontFamily:fm}}>View all {"→"}</button></div>
          {allDecs.sort(function(a,b){return(b.date||"")<(a.date||"")?-1:1}).slice(0,5).map(function(dec,i){
            var clr=dec.action==="BUY"||dec.action==="ADD"?K.grn:dec.action==="SELL"||dec.action==="TRIM"?K.red:dec.action==="HOLD"?K.blue:K.amb;
            return<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<4?"1px solid "+K.bdr:"none"}}>
              <span style={{fontSize:10,fontWeight:700,color:clr,background:clr+"12",padding:"2px 8px",borderRadius:3,fontFamily:fm,minWidth:36,textAlign:"center"}}>{dec.action}</span>
              <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{dec.ticker}</span>
              <span style={{fontSize:12,color:K.dim,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dec.reasoning?dec.reasoning.substring(0,60)+"...":""}</span>
              {dec.outcome&&<span style={{fontSize:10,color:dec.outcome==="right"?K.grn:dec.outcome==="wrong"?K.red:dec.outcome==="lucky"?"#9333EA":K.amb,fontFamily:fm,fontWeight:600}}>{dec.outcome}</span>}
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{dec.date?fD(dec.date):""}</span></div>})}</div>}

        {/* === PERFORMANCE ATTRIBUTION === */}
        {isPro&&portfolio.length>0&&(function(){
          var held=portfolio.filter(function(c2){var p2=c2.position||{};return p2.shares>0&&p2.avgCost>0&&p2.currentPrice>0});
          if(held.length===0)return null;
          var totalCost=held.reduce(function(s2,c2){return s2+(c2.position.shares*c2.position.avgCost)},0);
          var totalVal2=held.reduce(function(s2,c2){return s2+(c2.position.shares*c2.position.currentPrice)},0);
          var totalRet=totalCost>0?((totalVal2-totalCost)/totalCost*100):0;
          var attr=held.map(function(c2){var p2=c2.position;var cost=p2.shares*p2.avgCost;var ret2=(p2.shares*p2.currentPrice-cost)/cost*100;var weight=cost/totalCost;
            var buyDec=(c2.decisions||[]).find(function(d2){return d2.action==="BUY"||d2.action==="ADD"});
            return{ticker:c2.ticker,ret:ret2,contrib:weight*ret2,weight:weight*100,reasoning:buyDec?buyDec.reasoning:"",id:c2.id}}).sort(function(a,b){return b.contrib-a.contrib});
          var bestD=attr[0];var worstD=attr[attr.length-1];
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:12}}>Performance Attribution</div>
            <div style={{display:"flex",gap:16,marginBottom:12}}>
              <div><div style={{fontSize:24,fontWeight:700,color:totalRet>=0?K.grn:K.red,fontFamily:fm}}>{totalRet>=0?"+":""}{totalRet.toFixed(1)}%</div><div style={{fontSize:11,color:K.dim}}>Portfolio return</div></div>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>{attr.slice(0,5).map(function(a2){return<div key={a2.ticker} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={function(){setSelId(a2.id);setDetailTab("dossier");setPage("dashboard")}}>
                <span style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm,width:40}}>{a2.ticker}</span>
                <div style={{flex:1,height:6,borderRadius:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(Math.abs(a2.contrib)/Math.max(Math.abs(attr[0].contrib),1)*100,100)+"%",borderRadius:3,background:a2.contrib>=0?K.grn:K.red}}/></div>
                <span style={{fontSize:11,fontWeight:600,color:a2.contrib>=0?K.grn:K.red,fontFamily:fm,minWidth:42,textAlign:"right"}}>{a2.contrib>=0?"+":""}{a2.contrib.toFixed(1)}%</span></div>})}</div></div>
            {bestD&&bestD.reasoning&&<div style={{fontSize:12,color:K.mid,lineHeight:1.5,padding:"8px 10px",background:K.bg,borderRadius:6}}><span style={{fontWeight:600,color:K.grn}}>Best call:</span> {bestD.ticker} ({bestD.ret>=0?"+":""}{bestD.ret.toFixed(0)}%) {bestD.reasoning.substring(0,80)}</div>}
          </div>})()}
        {/* === GROWTH TIMELINE === */}
        {portfolio.length>0&&(function(){
          var tw=portfolio.filter(function(c2){return c2.thesisNote&&c2.thesisNote.trim().length>30}).length;
          var avgSec=portfolio.reduce(function(s2,c2){var n2=c2.thesisNote||"";var sec=1;if(n2.indexOf("## MOAT")>=0)sec++;if(n2.indexOf("## RISKS")>=0)sec++;if(n2.indexOf("## SELL")>=0)sec++;return s2+sec},0)/Math.max(portfolio.length,1);
          var totalK=portfolio.reduce(function(s2,c2){return s2+c2.kpis.length},0);
          var kpC=portfolio.reduce(function(s2,c2){return s2+c2.kpis.filter(function(k2){return k2.lastResult}).length},0);
          var tE=portfolio.reduce(function(s2,c2){return s2+(c2.earningsHistory||[]).length},0);
          var tCu=portfolio.reduce(function(s2,c2){return s2+(c2.convictionHistory||[]).length},0);
          var avgM=portfolio.reduce(function(s2,c2){return s2+calcMastery(c2).stars},0)/Math.max(portfolio.length,1);
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:12}}>Your Growth</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{l:"Theses",v:tw+"/"+portfolio.length,c:tw===portfolio.length?K.grn:K.txt},{l:"Avg depth",v:avgSec.toFixed(1)+"/4",c:avgSec>=3?K.grn:K.txt},{l:"KPIs tracked",v:totalK+(" (")+kpC+" checked)",c:kpC>0?K.grn:K.txt},{l:"Earnings reviewed",v:tE+"q",c:tE>=portfolio.length*2?K.grn:K.txt},{l:"Conviction updates",v:tCu+"",c:tCu>=portfolio.length*2?K.grn:K.txt},{l:"Mastery avg",v:avgM.toFixed(1)+"/6",c:avgM>=4?K.grn:K.txt}].map(function(g2){return<div key={g2.l} style={{padding:"6px 8px",background:K.bg,borderRadius:6}}>
                <div style={{fontSize:14,fontWeight:700,color:g2.c,fontFamily:fm}}>{g2.v}</div><div style={{fontSize:8,color:K.dim}}>{g2.l}</div></div>})}</div></div>})()}
        {/* === INVESTOR DNA v2 === */}
        {portfolio.length>=2&&(function(){
          var userTickers=portfolio.map(function(c2){return c2.ticker.toUpperCase()});
          // Match against each superinvestor
          var matches=SUPERINVESTORS.map(function(si){
            var shared=si.holdings.filter(function(h2){return userTickers.indexOf(h2)>=0});
            var overlapPct=userTickers.length>0?shared.length/userTickers.length*100:0;
            var coveragePct=si.holdings.length>0?shared.length/si.holdings.length*100:0;
            // Style trait similarity
            var userTraits={quality:0,value:0,growth:0,income:0,concentration:0,turnover:0};
            var styleCounts={growth:0,value:0,quality:0,income:0};
            portfolio.forEach(function(c2){if(c2.investStyle==="growth"||c2.investStyle==="aggressive")styleCounts.growth++;else if(c2.investStyle==="value"||c2.investStyle==="contrarian")styleCounts.value++;else if(c2.investStyle==="income"||c2.investStyle==="dividend")styleCounts.income++;else styleCounts.quality++});
            var tot3=Math.max(portfolio.length,1);
            userTraits.quality=styleCounts.quality/tot3;userTraits.growth=styleCounts.growth/tot3;
            userTraits.value=styleCounts.value/tot3;userTraits.income=styleCounts.income/tot3;
            userTraits.concentration=portfolio.length<=5?0.9:portfolio.length<=10?0.6:portfolio.length<=20?0.3:0.1;
            // Composite match: 60% holdings overlap + 40% style traits
            var traitSim=0;var traitKeys=["quality","value","growth","income","concentration"];
            traitKeys.forEach(function(tk){traitSim+=1-Math.abs((userTraits[tk]||0)-(si.traits[tk]||0))});
            traitSim=traitSim/traitKeys.length*100;
            var composite=overlapPct*0.6+traitSim*0.4;
            return{investor:si,shared:shared,overlapPct:overlapPct,traitSim:traitSim,composite:composite}});
          matches.sort(function(a,b){return b.composite-a.composite});
          var top3=matches.slice(0,3);var best=top3[0];
          if(!best)return null;
          // Sector analysis
          var sectors2={};portfolio.forEach(function(c2){var s3=c2.sector||"Other";sectors2[s3]=(sectors2[s3]||0)+1});
          var topSectors=Object.keys(sectors2).sort(function(a,b){return sectors2[b]-sectors2[a]}).slice(0,3);
          var avgConv=portfolio.reduce(function(s2,c2){return s2+(c2.conviction||0)},0)/Math.max(portfolio.length,1);
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:14}}>Investor DNA</div>
            {/* Top match */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14,padding:"12px 14px",background:K.acc+"06",borderRadius:10,border:"1px solid "+K.acc+"15"}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:K.acc+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:K.txt}}>{best.investor.name}</div>
                <div style={{fontSize:12,color:K.acc,fontWeight:600}}>{best.investor.style}</div>
                <div style={{fontSize:11,color:K.dim,marginTop:2}}>{best.investor.desc}</div></div>
              <div style={{textAlign:"center",padding:"6px 12px",background:K.card,borderRadius:8,border:"1px solid "+K.bdr}}>
                <div style={{fontSize:20,fontWeight:800,color:best.composite>=50?K.grn:best.composite>=25?K.acc:K.dim,fontFamily:fm}}>{Math.round(best.composite)}%</div>
                <div style={{fontSize:8,color:K.dim}}>match</div></div></div>
            {/* Shared holdings */}
            {best.shared.length>0&&<div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:6}}>Shared holdings with {best.investor.name} ({best.shared.length})</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {best.shared.map(function(t2){return<span key={t2} style={{padding:"3px 8px",borderRadius:4,background:K.grn+"10",border:"1px solid "+K.grn+"25",fontSize:11,fontWeight:600,color:K.grn,fontFamily:fm}}>{t2}</span>})}</div></div>}
            {/* Why this match */}
            <div style={{fontSize:12,color:K.mid,lineHeight:1.6,padding:"8px 10px",background:K.bg,borderRadius:6,marginBottom:14}}>
              {"Based on "}<strong style={{color:K.txt}}>{best.shared.length}</strong>{" shared holdings ("+best.overlapPct.toFixed(0)+"% of your portfolio) and "}
              <strong style={{color:K.txt}}>{best.traitSim.toFixed(0)}%</strong>{" style similarity. "}
              {best.investor.fund!==""&&<span>{"Fund: "+best.investor.fund+". "}</span>}
              {"Source: public 13F SEC filings."}</div>
            {/* Other matches */}
            {top3.length>1&&<div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:6}}>Other close matches</div>
              <div style={{display:"flex",gap:8}}>
                {top3.slice(1).map(function(m2){return<div key={m2.investor.id} style={{flex:1,padding:"8px 10px",borderRadius:6,background:K.bg,border:"1px solid "+K.bdr}}>
                  <div style={{fontSize:12,fontWeight:600,color:K.txt}}>{m2.investor.name}</div>
                  <div style={{fontSize:10,color:K.dim}}>{m2.investor.style}</div>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                    <div style={{flex:1,height:4,borderRadius:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(m2.composite,100)+"%",borderRadius:2,background:K.acc}}/></div>
                    <span style={{fontSize:10,fontWeight:600,color:K.acc,fontFamily:fm}}>{Math.round(m2.composite)}%</span></div>
                  {m2.shared.length>0&&<div style={{fontSize:8,color:K.dim,marginTop:3}}>{m2.shared.join(", ")}</div>}</div>})}</div></div>}
            {/* Your portfolio traits */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:11,color:K.dim}}>
              <span>{portfolio.length} holdings</span>
              <span>{"\u00b7"}</span>
              <span>Avg conviction: <strong style={{color:K.txt}}>{avgConv.toFixed(1)}</strong></span>
              <span>{"\u00b7"}</span>
              <span>Top sectors: <strong style={{color:K.txt}}>{topSectors.join(", ")}</strong></span></div></div>})()}

        {/* ── Zone 3: Reflection ── */}
        <div style={{marginTop:20,marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:14,borderRadius:2,background:K.grn}}/> Reflection</div></div>
        {/* === QUARTERLY LETTER === */}
        {weeklyReviews.length>=1&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginTop:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:4}}>Quarterly Letters</div>
                <div style={{fontSize:13,color:K.mid}}>Your personal investment reflections, generated each quarter.</div></div>
              <button onClick={function(){var now3=new Date();var pq=Math.floor(now3.getMonth()/3);var py=now3.getFullYear();if(pq===0){pq=4;py--}setShowQLetter("Q"+pq+"-"+py)}} style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12,whiteSpace:"nowrap"})}>View Latest</button></div></div>}
        {/* === BEHAVIORAL PATTERNS === */}
        {allDecs.length>=3&&(function(){
          var pats=[];
          var lowers=0;var totalCh=0;cos.forEach(function(c2){var ch=c2.convictionHistory||[];totalCh+=ch.length;for(var i2=1;i2<ch.length;i2++){if(ch[i2].rating<ch[i2-1].rating)lowers++}});
          if(totalCh>5&&lowers===0)pats.push({icon:"alert",color:K.amb,t:"You have never lowered conviction on any holding. Stay honest with yourself."});
          var held2=portfolio.filter(function(c2){var p2=c2.position||{};return p2.shares>0&&p2.currentPrice>0});
          if(held2.length>=3){var vals2=held2.map(function(c2){return c2.position.shares*c2.position.currentPrice});var tv2=vals2.reduce(function(a,b){return a+b},0);var mv2=Math.max.apply(null,vals2);
            if(mv2/tv2>0.4)pats.push({icon:"search",color:K.blue,t:"Largest position is "+Math.round(mv2/tv2*100)+"% of portfolio. High concentration demands high conviction."})}
          if(weeklyReviews.length>=6){var gaps=[];for(var i2=1;i2<weeklyReviews.length;i2++){gaps.push(Math.round((new Date(weeklyReviews[i2].date)-new Date(weeklyReviews[i2-1].date))/604800000))}
            var ag=gaps.reduce(function(a,b){return a+b},0)/gaps.length;
            if(ag<=1.3)pats.push({icon:"check",color:K.grn,t:"Review cadence: every "+ag.toFixed(1)+" weeks. Exceptional consistency."})}
          if(pats.length===0)return null;
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:10}}>Behavioral Patterns</div>
            {pats.map(function(p2,i2){return<div key={i2} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 8px",background:K.bg,borderRadius:6,marginBottom:4}}>
              <IC name={p2.icon} size={13} color={p2.color} style={{marginTop:2,flexShrink:0}}/><div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{p2.t}</div></div>})}</div>})()}

        {/* ═══ STRESS TEST ═══ */}
        {portfolio.length>0&&<div style={{marginTop:24}}>
          <div style={S.sec}><IC name="shield" size={14} color={K.acc}/>Stress Test</div>
          {(function(){var planned=portfolio.filter(function(c2){return(c2.scenarios||[]).length>0});var unplanned=portfolio.filter(function(c2){return(c2.scenarios||[]).length===0});var totalScen=portfolio.reduce(function(s,c2){return s+(c2.scenarios||[]).length},0);
            return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{fontSize:28,fontWeight:800,color:planned.length===portfolio.length?K.grn:planned.length>0?K.amb:K.dim,fontFamily:fm}}>{planned.length}<span style={{fontSize:14,fontWeight:400,color:K.dim}}>/{portfolio.length}</span></div>
                <div><div style={{fontSize:13,fontWeight:600,color:K.txt}}>Holdings stress-tested</div>
                  <div style={{fontSize:11,color:K.dim}}>{totalScen} scenario{totalScen!==1?"s":""} planned</div></div></div>
              {unplanned.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{unplanned.slice(0,5).map(function(c2){return<button key={c2.id} onClick={function(){setSelId(c2.id);setDetailTab("dossier");setPage("dashboard");setTimeout(function(){setModal({type:"scenario"})},200)}} style={{padding:"5px 12px",fontSize:11,fontFamily:fm,borderRadius:6,border:"1px solid "+K.bdr,background:K.bg,color:K.mid,cursor:"pointer"}}>{c2.ticker}</button>})}</div>}
              {planned.length===portfolio.length&&<div style={{fontSize:12,color:K.grn,fontFamily:fm}}>Every holding has a crisis plan.</div>}
            </div>})()}</div>}
        {/* ═══ COMMUNITY BENCHMARK ═══ */}
        <div style={{marginTop:24}}>
          <div style={S.sec}><IC name="users" size={14} color={K.dim}/>Community</div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
            <div style={{display:"flex",alignItems:isMobile?"flex-start":"center",gap:16,flexDirection:isMobile?"column":"row"}}>
              {/* Your score */}
              <div style={{flex:1}}>
                <div style={{fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:8}}>YOUR PROCESS SCORE</div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:36,fontWeight:800,color:os.total>=70?K.grn:os.total>=40?K.amb:K.red,fontFamily:fm}}>{os.total}</div>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:K.txt}}>{currentLevel.icon} {currentLevel.name}</div>
                    <div style={{fontSize:12,color:K.dim}}>Top investors maintain 70+ process scores</div></div></div>
              </div>
              {/* Benchmark */}
              <div style={{flex:1,padding:"16px 20px",background:K.bg,borderRadius:10,textAlign:"center"}}>
                <div style={{fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:8}}>COMMUNITY BENCHMARK</div>
                <div style={{fontSize:14,color:K.mid,lineHeight:1.7,marginBottom:8}}>ThesisAlpha is in early access. As more owners join, you'll see how your process compares.</div>
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
                <div style={{fontSize:10,color:K.acc,marginTop:10,fontFamily:fm}}>{"🌱"} You're among the first owners. Early adopters shape the community.</div>
              </div></div>
          </div>
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
            {id:"munger",name:"Charlie Munger",subtitle:"Quality at Scale",unlock:0,quote:"A great business at a fair price is superior to a fair business at a great price.",
              metrics:[
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:25,desc:"The single best measure of a moat"},
                {id:"grossMargin",label:"Pricing Power (Gross Margin)",sp500:45,unit:"%",weight:20,desc:"Can they raise prices without losing customers?"},
                {id:"opLeverage",label:"Operating Margin",sp500:13,unit:"%",weight:15,desc:"Do margins expand as revenue grows?"},
                {id:"revGrowth",label:"Revenue Growth",sp500:5,unit:"%",weight:15,desc:"Sustainable growth within circle of competence"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:15,desc:"Trending up = strengthening position"},
                {id:"rdIntensity",label:"R&D / Revenue",sp500:3,unit:"%",weight:10,desc:"Reinvesting to widen the moat"}
              ]},
            {id:"buffett",name:"Warren Buffett",subtitle:"Owner Earnings",unlock:0,quote:"It’s far better to buy a wonderful company at a fair price than a fair company at a wonderful price.",
              metrics:[
                {id:"netMargin",label:"Net Margin (Owner Earnings)",sp500:12,unit:"%",weight:20,desc:"What the owner actually takes home"},
                {id:"roic",label:"Return on Equity",sp500:15,unit:"%",weight:20,desc:"How much profit per dollar of equity?"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:20,desc:"Conservative balance sheet = margin of safety",invert:true},
                {id:"grossMargin",label:"Gross Margin Stability",sp500:45,unit:"%",weight:20,desc:"Stable margins = durable competitive advantage"},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:20,desc:"Consistent cash generation year after year"}
              ]},
            {id:"greenblatt",name:"Joel Greenblatt",subtitle:"Magic Formula",unlock:0,quote:"Buying good businesses at bargain prices is the secret to making lots of money.",
              metrics:[
                {id:"roic",label:"Return on Capital",sp500:15,unit:"%",weight:35,desc:"The first pillar of the Magic Formula — high ROIC = good business"},
                {id:"netMargin",label:"Earnings Yield",sp500:12,unit:"%",weight:35,desc:"The second pillar — high earnings yield = bargain price"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:10,desc:"Pricing power supporting high returns"},
                {id:"fortress",label:"Debt Level",sp500:1.5,unit:"x",weight:10,desc:"Low leverage = less risk",invert:true},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:10,desc:"Real cash backing up the earnings"}
              ]},
            {id:"lynch",name:"Peter Lynch",subtitle:"Growth at a Price",unlock:0,quote:"Know what you own, and know why you own it.",
              metrics:[
                {id:"revGrowth",label:"Revenue / Earnings Growth",sp500:5,unit:"%",weight:30,desc:"The engine — is the company growing fast enough?"},
                {id:"fortress",label:"Debt Level",sp500:1.5,unit:"x",weight:20,desc:"Low debt = can survive a downturn",invert:true},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:20,desc:"Strong cash flow funds future growth"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:15,desc:"Are margins expanding as the company scales?"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:15,desc:"Is growth translating to bottom line?"}
              ]},
            {id:"davis",name:"Shelby Cullom Davis",subtitle:"Davis Double Play",unlock:0,quote:"You make most of your money in a bear market, you just don’t realize it at the time.",
              metrics:[
                {id:"revGrowth",label:"Earnings Growth",sp500:5,unit:"%",weight:25,desc:"Growing earnings = rising stock price (first play)"},
                {id:"netMargin",label:"Net Margin Expansion",sp500:12,unit:"%",weight:20,desc:"Expanding margins = multiple expansion (second play)"},
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:20,desc:"Capital efficiency sustains compounding"},
                {id:"fortress",label:"Balance Sheet Strength",sp500:1.5,unit:"x",weight:15,desc:"Survive the bear market to reap the double play",invert:true},
                {id:"fcfConversion",label:"Cash Generation",sp500:85,unit:"%",weight:10,desc:"Real cash flow backing earnings growth"},
                {id:"grossMargin",label:"Pricing Power",sp500:45,unit:"%",weight:10,desc:"Durable margins through cycles"}
              ]},
            {id:"hohn",name:"Chris Hohn",subtitle:"Activist Value",unlock:0,quote:"We invest in quality businesses with strong free cash flow and push for better capital allocation.",
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
                return<button key={l.id} onClick={function(){if(!locked)setActiveLens(l.id)}} style={{padding:"7px 14px",borderRadius:8,border:"1px solid "+(active?K.acc+"60":locked?K.bdr:K.bdr),background:active?K.acc+"10":locked?K.bg:"transparent",color:active?K.acc:locked?K.dim:K.mid,fontSize:12,fontWeight:active?600:400,cursor:locked?"default":"pointer",fontFamily:fm,opacity:locked?.6:1,position:"relative"}}>
                  {locked&&<span style={{position:"absolute",top:-4,right:-4,fontSize:11}}>{String.fromCodePoint(0x1F512)}</span>}
                  {l.name}
                  {locked&&<span style={{display:"block",fontSize:8,color:K.dim,marginTop:1}}>Week {l.unlock} streak</span>}
                </button>})}</div>
            {/* Lens header */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div><div style={{fontSize:18,fontWeight:500,color:K.txt,fontFamily:fh}}>{lens.name} <span style={{fontWeight:300,color:K.dim,fontSize:14}}>{lens.subtitle}</span></div></div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:24,fontWeight:700,color:beatPct>=70?K.grn:beatPct>=40?K.amb:K.red,fontFamily:fm}}>{beatPct}%</div>
                  <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>metrics above S&P 500</div></div></div>
              <div style={{fontSize:13,color:K.mid,fontStyle:"italic",lineHeight:1.6}}>“{lens.quote}”</div>
            </div>
            {/* Metrics table with actual values */}
            {lensLoading&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:40,textAlign:"center"}}>
              <div style={{display:"inline-block",width:20,height:20,border:"2px solid "+K.bdr,borderTopColor:K.acc,borderRadius:"50%",animation:"spin .8s linear infinite",marginBottom:12}}/>
              <div style={{fontSize:14,color:K.dim}}>Fetching financial data for your holdings…</div></div>}
            {!lensLoading&&portCos.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:40,textAlign:"center"}}>
              <div style={{fontSize:14,color:K.dim,marginBottom:8}}>No financial data yet</div>
              <div style={{fontSize:13,color:K.dim}}>Add portfolio companies with position data. Financial metrics are fetched automatically from FMP.</div></div>}
            {!lensLoading&&portCos.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{borderBottom:"2px solid "+K.bdr}}>
                  <th style={{textAlign:"left",padding:"12px 14px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>Metric</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600,width:50}}>Weight</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>Your Portfolio</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>S&P 500</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>vs Benchmark</th>
                  <th style={{textAlign:"left",padding:"12px 14px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>By Holding</th>
                </tr></thead>
                <tbody>{portMetrics.map(function(m){
                  return<tr key={m.id} style={{borderBottom:"1px solid "+K.bdr+"60"}}>
                    <td style={{padding:"12px 14px"}}><div style={{fontWeight:500,color:K.txt}}>{m.label}</div><div style={{fontSize:11,color:K.dim,marginTop:2}}>{m.desc}</div></td>
                    <td style={{textAlign:"center",padding:"12px 8px",fontSize:12,color:K.dim,fontFamily:fm}}>{m.weight}%</td>
                    <td style={{textAlign:"center",padding:"12px 8px"}}>
                      <div style={{fontSize:18,fontWeight:700,color:m.portfolioVal!=null?clr(m.delta):K.dim,fontFamily:fm}}>{fmtVal(m.portfolioVal,m.unit,m.invert)}</div></td>
                    <td style={{textAlign:"center",padding:"12px 8px"}}>
                      <div style={{fontSize:14,color:K.dim,fontFamily:fm}}>{fmtVal(m.sp500,m.unit)}</div></td>
                    <td style={{textAlign:"center",padding:"12px 8px"}}>
                      {m.delta!=null?<span style={{fontSize:13,fontWeight:600,color:clr(m.delta),fontFamily:fm,background:clr(m.delta)+"10",padding:"3px 10px",borderRadius:4}}>{m.delta>=0?"+":""}{m.delta.toFixed(1)}{m.unit==="x"?"x":m.unit}</span>:<span style={{color:K.dim}}>—</span>}</td>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{m.holdings.slice(0,8).map(function(h){
                        var hDelta=m.invert?m.sp500-h.value:h.value-m.sp500;
                        return<span key={h.ticker} style={{fontSize:10,fontFamily:fm,padding:"2px 6px",borderRadius:3,background:hDelta>0?K.grn+"12":hDelta>-2?K.amb+"12":K.red+"12",color:hDelta>0?K.grn:hDelta>-2?K.amb:K.red}} title={h.raw}>{h.ticker} {h.raw||fmtVal(h.value,m.unit)}</span>})}</div></td>
                  </tr>})}</tbody>
              </table>
              <div style={{padding:"12px 14px",borderTop:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:11,color:K.dim}}>Weighted by position value. {portCos.length} of {cos.filter(function(c){return(c.status||"portfolio")==="portfolio"}).length} holdings have data. Financial metrics via FMP.</div>
                <div style={{display:"flex",gap:8,fontSize:10,color:K.dim}}><span style={{color:K.grn}}>● Above S&P</span><span style={{color:K.amb}}>● Near S&P</span><span style={{color:K.red}}>● Below S&P</span></div></div>
            </div>}
          </div>})()}
      </div>}

      {/* ═══ DECISION JOURNAL TAB ═══ */}
      {ht==="journal"&&<div>
        {allDecs.length===0?<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:40,textAlign:"center"}}>
          <div style={{fontSize:14,color:K.dim,marginBottom:8}}>No decisions logged yet</div>
          <div style={{fontSize:13,color:K.dim}}>Entries appear automatically as you check earnings, update theses, and adjust conviction during weekly reviews.</div></div>:
        <div>
          <div style={{fontSize:13,color:K.dim,marginBottom:16}}>
            {allDecs.length} decision{allDecs.length>1?"s":""} logged · {scored.length} scored · {rights} right · {rights} right of {scored.length} scored</div>
          {allDecs.sort(function(a,b){return(b.date||"")<(a.date||"")?-1:1}).map(function(dec,i){
            var clr=dec.action==="BUY"||dec.action==="ADD"?K.grn:dec.action==="SELL"||dec.action==="TRIM"?K.red:dec.action==="HOLD"?K.blue:K.amb;
            return<div key={i} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 18px",marginBottom:8,borderLeft:"3px solid "+clr}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{fontSize:11,fontWeight:700,color:clr,background:clr+"12",padding:"2px 10px",borderRadius:4,fontFamily:fm}}>{dec.action}</span>
                <span style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{dec.ticker}</span>
                {dec.price&&<span style={{fontSize:12,color:K.dim,fontFamily:fm}}>@ ${dec.price}</span>}
                <span style={{flex:1}}/>
                {dec.outcome&&<span style={{fontSize:11,fontWeight:600,color:dec.outcome==="right"?K.grn:dec.outcome==="wrong"?K.red:dec.outcome==="lucky"?"#9333EA":K.amb,background:(dec.outcome==="right"?K.grn:dec.outcome==="wrong"?K.red:dec.outcome==="lucky"?"#9333EA":K.amb)+"12",padding:"2px 8px",borderRadius:3,fontFamily:fm}}>{dec.outcome}</span>}
                <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{dec.date?fD(dec.date):""}</span></div>
              {dec.reasoning&&<div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{dec.reasoning}</div>}
              {dec.invalidation&&<div style={{fontSize:12,color:K.amb,marginTop:6,fontStyle:"italic"}}>{"Invalidation: "+dec.invalidation}</div>}
            </div>})}
        </div>}
      </div>}

      {/* ═══ DOCUMENT VAULT TAB ═══ */}
      {ht==="docs"&&<div>
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={function(){var co=portfolio[0];if(co){setSelId(co.id);setModal({type:"memo"})}else{showToast("Add a company first","info",3000)}}} style={Object.assign({},S.btnP,{padding:"6px 14px",fontSize:12})}>+ Investment Memo</button>
          <button onClick={function(){var co=portfolio[0];if(co){setSelId(co.id);setModal({type:"doc"})}else{showToast("Add a company first","info",3000)}}} style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12})}>+ Quick Note</button>
          <select value={hc} onChange={function(e){setHc(e.target.value);setHd(null)}} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"7px 12px",fontSize:12,fontFamily:fm,outline:"none"}}>
            <option value="all">All Companies</option>
            {companies.map(function(c){return<option key={c.id} value={c.id}>{c.ticker}</option>})}</select>
          <button onClick={function(){setHf("all");setHd(null)}} style={{background:hf==="all"?K.acc+"20":"transparent",border:"1px solid "+(hf==="all"?K.acc+"50":K.bdr),borderRadius:6,padding:"6px 14px",fontSize:12,color:hf==="all"?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>All</button>
          {FOLDERS.map(function(fo){var ct=allDocs.filter(function(d2){return d2.folder===fo.id&&(hc==="all"||d2.companyId===parseInt(hc))}).length;
            return<button key={fo.id} onClick={function(){setHf(fo.id);setHd(null)}} style={{background:hf===fo.id?K.acc+"20":"transparent",border:"1px solid "+(hf===fo.id?K.acc+"50":K.bdr),borderRadius:6,padding:"6px 14px",fontSize:12,color:hf===fo.id?K.acc:K.dim,cursor:"pointer",fontFamily:fm,display:"inline-flex",alignItems:"center",gap:5}}><IC name={fo.icon} size={11} color={hf===fo.id?K.acc:K.dim}/>{fo.label}{ct>0?" ("+ct+")":""}</button>})}</div>
        <div className="ta-grid-docs" style={{display:"grid",gridTemplateColumns:selectedDoc?"340px 1fr":"1fr",gap:20}}>
          <div>
            {filteredDocs.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:32,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>No documents yet</div><div style={{fontSize:13,color:K.dim}}>Add notes in company pages and they'll appear here.</div></div>}
            {filteredDocs.map(function(d3){var fo=FOLDERS.find(function(f){return f.id===d3.folder});var isActive=hd===d3.id;
              return<div key={d3.id} style={{background:isActive?K.acc+"08":K.card,border:"1px solid "+(isActive?K.acc+"30":K.bdr),borderRadius:12,padding:"14px 18px",marginBottom:8,cursor:"pointer",transition:"all .15s"}} onClick={function(){setHd(isActive?null:d3.id)}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <CoLogo domain={d3.domain} ticker={d3.ticker} size={18}/>
                  <span style={{fontSize:11,fontWeight:600,color:K.mid,fontFamily:fm}}>{d3.ticker}</span>
                  <IC name={fo?fo.icon:"file"} size={12} color={K.dim}/>
                  <span style={{flex:1}}/>
                  <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{d3.updatedAt?new Date(d3.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>
                <div style={{fontSize:14,fontWeight:500,color:K.txt}}>{d3.title}</div>
                {!selectedDoc&&d3.content&&<div style={{fontSize:13,color:K.dim,lineHeight:1.5,marginTop:4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{d3.content.substring(0,200)}</div>}
              </div>})}</div>
          {selectedDoc&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"24px 28px",position:"sticky",top:80,maxHeight:"calc(100vh - 120px)",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <CoLogo domain={selectedDoc.domain} ticker={selectedDoc.ticker} size={22}/>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:500,color:K.txt}}>{selectedDoc.title}</div>
                <div style={{fontSize:12,color:K.dim}}>{selectedDoc.companyName}{selectedDoc.updatedAt?" • "+new Date(selectedDoc.updatedAt).toLocaleDateString():""}</div></div>
              <button onClick={function(){if(requirePro("export"))exportDocPDF(selectedDoc)}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})}>{isPro?"PDF":"⚡ PDF"}</button>
              {!selectedDoc.isThesis&&<button onClick={function(){setSelId(selectedDoc.companyId);setPage("dashboard");setModal({type:"doc",data:selectedDoc.id})}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})}>Edit</button>}
            </div>
            <div style={{fontSize:14,color:K.mid,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{autoFormat(selectedDoc.content)}</div>
          </div>}
        </div>
      </div>}

      {ht==="goals"&&(function(){
        var portf=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
        // Per-holding TSR calculation (same logic as dossier contribution card)
        var holdingReturns=portf.map(function(c){
          var fs=c.financialSnapshot||{};
          function dpv(field){if(!fs[field])return 0;var v=fs[field].value;if(typeof v==="number")return v;if(typeof v==="string")return parseFloat(v.replace(/[^\d.\-]/g,""))||0;return 0}
          var eg=0;var snapG=dpv("revGrowth")||dpv("epsGrowth");
          if(snapG){eg=snapG}else{var se={growth:18,aggressive:22,quality:12,value:8,income:6,compounder:14,speculative:25};eg=se[c.investStyle]||10}
          var mcap=c.mktCap||0;
          var baseR=mcap>500e9?9:mcap>100e9?11:mcap>50e9?13:mcap>10e9?15:mcap>1e9?17:20;
          var capG=mcap>500e9?15:mcap>100e9?20:mcap>50e9?25:mcap>10e9?35:mcap>1e9?45:60;
          eg=Math.min(eg,capG);
          var bw=mcap>500e9?0.55:mcap>100e9?0.4:mcap>50e9?0.3:mcap>10e9?0.2:0.1;
          eg=eg*(1-bw)+baseR*bw;
          if(eg>baseR){var dcay=mcap>500e9?0.08:mcap>100e9?0.06:0.04;eg=baseR+(eg-baseR)*Math.pow(1-dcay,Math.max(goals.horizon,5)/2)}
          var dy=dpv("divYield")||(c.divYield||0);var pe=dpv("pe");
          var fairPE=eg>30?40:eg>20?30:eg>12?25:eg>5?18:14;
          var mc=0;if(pe>0&&pe<200){mc=(Math.pow(fairPE/pe,1/Math.max(goals.horizon,1))-1)*100;mc=Math.max(-12,Math.min(12,mc))}
          var expected=eg+dy+mc;
          // Predictability score for uncertainty band
          var pred=50;if(c._moatCache&&c._moatCache.composite){pred+=c._moatCache.composite*3}
          if(c.thesis&&c.thesis.length>100)pred+=8;if((c.kpis||[]).length>=3)pred+=8;pred=Math.min(100,pred);
          // Weight by conviction, fallback equal
          var w=(c.conviction||5)/10;
          return{id:c.id,ticker:c.ticker,name:c.name,expected:expected,eg:eg,dy:dy,mc:mc,weight:w,predictability:pred}
        });
        var totalW=holdingReturns.reduce(function(s,h){return s+h.weight},0)||1;
        holdingReturns=holdingReturns.map(function(h){return Object.assign({},h,{weight:h.weight/totalW*100})});
        var portCAGR=holdingReturns.reduce(function(s,h){return s+h.weight/100*h.expected},0);
        var portPred=holdingReturns.reduce(function(s,h){return s+h.weight/100*h.predictability},0);
        var uncertainty=(100-portPred)/100;
        var spread=Math.max(portCAGR*0.4,6)*uncertainty+4;
        var lowCAGR=portCAGR-spread*1.4;var highCAGR=portCAGR+spread*0.7;
        var diff=portCAGR-goals.targetCAGR;var sigma=spread*0.9||1;
        var t2=diff/sigma;
        var prob;if(t2>=0){prob=Math.round(Math.min(85,50+40*(1-Math.exp(-0.5*t2-0.25*t2*t2))))}else{prob=Math.round(Math.max(3,50-45*(1-Math.exp(0.5*t2-0.25*t2*t2))))}
        var character=portPred>=70?"Predictable Compounder Portfolio":portPred>=50?"Balanced Growth Portfolio":portPred>=30?"Growth-Oriented Portfolio":"Speculative Growth Portfolio";
        holdingReturns.sort(function(a,b){return(b.weight/100*b.expected)-(a.weight/100*a.expected)});
        // Bell curve SVG points
        var svgW=400;var svgH=100;
        var bellPts=[];for(var bi=0;bi<=100;bi++){var x2=lowCAGR+(highCAGR-lowCAGR)*bi/100;var z=(x2-portCAGR)/sigma;var y2=Math.exp(-0.5*z*z);bellPts.push([bi/100*svgW,svgH-y2*svgH*0.85])}
        var bellPath="M "+bellPts.map(function(p){return p[0].toFixed(1)+","+p[1].toFixed(1)}).join(" L ");
        var tgtX=Math.max(0,Math.min(1,(goals.targetCAGR-lowCAGR)/(highCAGR-lowCAGR)))*svgW;
        var expX=Math.max(0,Math.min(1,(portCAGR-lowCAGR)/(highCAGR-lowCAGR)))*svgW;
        var onTarget=portCAGR>=goals.targetCAGR;
        return<div>
          {/* Settings row */}
          <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>Target CAGR</span>
              <input type="number" min={1} max={50} value={goals.targetCAGR} onChange={function(e){saveGoals(Object.assign({},goals,{targetCAGR:parseFloat(e.target.value)||12}))}} style={{width:48,background:"transparent",border:"none",color:K.txt,fontSize:18,fontWeight:700,fontFamily:fm,outline:"none",textAlign:"center"}}/>
              <span style={{fontSize:13,color:K.mid,fontFamily:fm}}>%</span>
            </div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>Horizon</span>
              {[5,10,15,20].map(function(yr){return<button key={yr} onClick={function(){saveGoals(Object.assign({},goals,{horizon:yr}))}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+(goals.horizon===yr?K.acc:"transparent"),background:goals.horizon===yr?K.acc+"20":"transparent",color:goals.horizon===yr?K.acc:K.dim,fontSize:12,fontWeight:goals.horizon===yr?700:400,cursor:"pointer",fontFamily:fm}}>{yr}y</button>})}
            </div>
          </div>

          {portf.length===0?<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:40,textAlign:"center",color:K.dim,fontSize:14}}>Add holdings to see your CAGR projection</div>:
          <div>
            {/* Main projection card */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"24px 28px",marginBottom:16}}>
              <div style={{display:"flex",gap:24,alignItems:"flex-start",marginBottom:20,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:140}}>
                  <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:6}}>Expected Portfolio CAGR</div>
                  <div style={{fontSize:38,fontWeight:800,color:onTarget?K.grn:K.amb,fontFamily:fm,lineHeight:1}}>{portCAGR>=0?"+":""}{portCAGR.toFixed(1)}%</div>
                  <div style={{fontSize:12,color:K.dim,marginTop:4}}>Range: {lowCAGR.toFixed(1)}% to {highCAGR.toFixed(1)}%</div>
                  <div style={{fontSize:11,color:K.dim,marginTop:2}}>{character}</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>Probability of {goals.targetCAGR}%+</div>
                  <div style={{width:64,height:64,borderRadius:"50%",border:"4px solid "+(onTarget?K.grn+"30":K.red+"30"),display:"flex",alignItems:"center",justifyContent:"center",position:"relative",margin:"0 auto"}}>
                    <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"4px solid "+(onTarget?K.grn:K.red),borderRightColor:"transparent",borderBottomColor:prob<50?"transparent":onTarget?K.grn:K.red,transform:"rotate(-45deg)"}}/>
                    <span style={{fontSize:16,fontWeight:800,color:onTarget?K.grn:K.red,fontFamily:fm}}>{prob}%</span>
                  </div>
                </div>
              </div>
              {/* Bell curve */}
              <div style={{position:"relative",marginBottom:12}}>
                <svg viewBox={"0 0 "+svgW+" "+svgH} style={{width:"100%",height:80,overflow:"visible"}}>
                  <defs>
                    <linearGradient id="bellGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={K.acc} stopOpacity="0.3"/>
                      <stop offset="100%" stopColor={K.acc} stopOpacity="0.03"/>
                    </linearGradient>
                  </defs>
                  <path d={bellPath+" L "+svgW+","+svgH+" L 0,"+svgH+" Z"} fill="url(#bellGrad)"/>
                  <path d={bellPath} fill="none" stroke={K.acc} strokeWidth="2.5"/>
                  <line x1={expX.toFixed(0)} y1="0" x2={expX.toFixed(0)} y2={svgH} stroke={K.grn} strokeWidth="2"/>
                  <text x={expX.toFixed(0)} y="-4" fill={K.grn} fontSize="9" fontWeight="bold" textAnchor="middle">{portCAGR>=0?"+":""}{portCAGR.toFixed(1)}%</text>
                  {tgtX!==expX&&<line x1={tgtX.toFixed(0)} y1="4" x2={tgtX.toFixed(0)} y2={svgH} stroke={K.amb} strokeWidth="2" strokeDasharray="4,3"/>}
                  {tgtX!==expX&&<text x={tgtX.toFixed(0)} y="-4" fill={K.amb} fontSize="9" fontWeight="bold" textAnchor="middle">Target {goals.targetCAGR}%</text>}
                </svg>
              </div>
              {!onTarget&&<div style={{background:K.amb+"10",border:"1px solid "+K.amb+"30",borderRadius:8,padding:"10px 14px",fontSize:12,color:K.amb}}>
                Your expected {portCAGR.toFixed(1)}% is below your {goals.targetCAGR}% target. Consider whether your target is realistic, or if higher-conviction positions could shift the outlook.
              </div>}
              {onTarget&&<div style={{background:K.grn+"10",border:"1px solid "+K.grn+"30",borderRadius:8,padding:"10px 14px",fontSize:12,color:K.grn}}>
                Your portfolio is on track. Expected {portCAGR.toFixed(1)}% vs {goals.targetCAGR}% target — {prob}% probability of hitting it.
              </div>}
            </div>

            {/* Per-holding breakdown */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"18px 22px"}}>
              <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:14}}>Expected Return by Holding</div>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:10}}>TSR = (1 + EPS Growth + Buyback) × (1 + Multiple Change) + Dividend Yield − 1. Growth adjusted by quality score (ROIC, margins). "Needed" = growth required to hit your target CAGR at current valuation.</div>
              {holdingReturns.map(function(h){
                var needed=goals.targetCAGR-h.dy-h.mc;var onTgt=h.expected>=goals.targetCAGR;
                return<div key={h.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid "+K.bdr+"60"}}>
                  <CoLogo ticker={h.ticker} size={22}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{h.ticker}</div>
                    <div style={{fontSize:10,color:K.dim}}>Earnings {h.eg>=0?"+":""}{h.eg.toFixed(1)}% / Yield {h.dy.toFixed(1)}% / Multiple {h.mc>=0?"+":""}{h.mc.toFixed(1)}%</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:16,fontWeight:700,color:onTgt?K.grn:K.amb,fontFamily:fm}}>{h.expected>=0?"+":""}{h.expected.toFixed(1)}%</div>
                    {!onTgt&&<div style={{fontSize:9,color:K.red}}>Needs {needed.toFixed(1)}% growth</div>}
                  </div>
                </div>
              })}
            </div>
          </div>}
        </div>
      })()}

      {ht==="reading"&&<div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:K.txt}}>Reading List</div>
          <button onClick={function(){setModal({type:"addReading"})}} style={Object.assign({},S.btnP,{padding:"6px 14px",fontSize:12})}>+ Add Book</button>
        </div>
        {readingList.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:40,textAlign:"center",color:K.dim,fontSize:14}}>
          <div style={{marginBottom:8}}>No books yet</div>
          <div style={{fontSize:12}}>Add books, articles, and resources that shape your investment thinking.</div>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
          {readingList.map(function(item,i){
            var statusColor=item.status==="read"?K.grn:item.status==="reading"?K.acc:K.dim;
            return<div key={i} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 18px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:K.txt,marginBottom:2}}>{item.title}</div>
                  {item.author&&<div style={{fontSize:11,color:K.dim,marginBottom:6}}>{item.author}</div>}
                  {item.notes&&<div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{item.notes}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  <select value={item.status||"want"} onChange={function(e){var updated=readingList.map(function(r,j){return j===i?Object.assign({},r,{status:e.target.value}):r});saveRL(updated)}} style={{background:"transparent",border:"1px solid "+K.bdr,borderRadius:6,color:statusColor,fontSize:11,padding:"2px 6px",fontFamily:fm,cursor:"pointer"}}>
                    <option value="want">Want to read</option>
                    <option value="reading">Reading</option>
                    <option value="read">Read</option>
                  </select>
                  <button onClick={function(){saveRL(readingList.filter(function(_,j){return j!==i}))}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:11,padding:0}}>Remove</button>
                </div>
              </div>
            </div>
          })}
        </div>
      </div>}

    </div>
  }


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

    return<div style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 32px 60px",maxWidth:800}}>
      <div style={{padding:isMobile?"16px 0 12px":"28px 0 20px"}}><h1 style={{margin:0,fontSize:isMobile?24:26,fontWeight:isThesis?800:400,color:K.txt,fontFamily:fh,letterSpacing:isThesis?"-0.5px":"normal"}}>Weekly Owner’s Review</h1>
        <p style={{margin:"4px 0 0",fontSize:14,color:K.dim}}>3 minutes to confirm or adjust conviction across your portfolio</p></div>

      {/* Streak banner */}
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:12,marginBottom:24}}>
        <div style={{fontSize:32,fontWeight:700,color:streakColor,fontFamily:fm,lineHeight:1}}>{streakData.current||0}</div>
        <div><div style={{fontSize:14,fontWeight:600,color:K.txt}}>week streak</div>
          <div style={{fontSize:12,color:K.dim}}>{(streakData.current||0)>=4?"Excellent discipline — keep it going":(streakData.current||0)>=1?"Building the habit":"Start your first weekly review"}</div></div>
        <div style={{marginLeft:"auto",display:"flex",gap:3}}>
          {[0,1,2,3,4,5,6,7].map(function(i){return<div key={i} style={{width:8,height:24,borderRadius:2,background:i<(streakData.current||0)?streakColor:K.bdr}}/>})}</div>
      </div>

      {step!=="review"&&(function(){
        // Chest preview - always show one of each tier to build curiosity
        return<div style={{marginBottom:24}}>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"24px 28px",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>{String.fromCodePoint(0x1F4DC)}</div>
            <div style={{fontSize:16,fontWeight:600,color:K.txt,fontFamily:fh,marginBottom:6}}>{plan==="pro"?"Weekly Reflection":"Weekly Insight"}</div>
            <div style={{fontSize:13,color:K.mid,lineHeight:1.6,maxWidth:340,margin:"0 auto",marginBottom:16}}>
              {plan==="pro"?"Complete your review to receive curated investor wisdom and a health report on your portfolio.":"Complete your review to earn investor wisdom and unlock new features as your streak grows."}</div>
            {plan!=="pro"&&(function(){
              var themeUn=[{w:1,l:"Forest Theme"},{w:3,l:"PayPal Blue"},{w:6,l:"Purple Theme"},{w:10,l:"Bloomberg"}];
              var lensUn=[{w:2,l:"Munger Lens"},{w:4,l:"Buffett Lens"},{w:8,l:"Greenblatt Lens"},{w:12,l:"Lynch Lens"}];
              var allUn=themeUn.concat(lensUn).sort(function(a,b){return a.w-b.w});
              var sw=(streakData.current||0);
              var next=allUn.find(function(u){return u.w>sw});
              return next?<div style={{fontSize:12,color:K.acc,fontFamily:fm}}>Next unlock: {next.l} (week {next.w})</div>:null})()}
            {plan==="pro"&&<div style={{fontSize:12,color:K.grn,fontFamily:fm}}>Pro: All features unlocked. Your reward is wisdom + portfolio health insights.</div>}
          </div>
          {currentWeekReviewed?<div style={{textAlign:"center",marginTop:16}}>
            <div style={{fontSize:14,fontWeight:600,color:K.grn,marginBottom:4}}>{"✓"} Review complete for this week</div>
            <div style={{fontSize:13,color:K.dim}}>Come back next week for your next insight</div></div>
          :<div style={{textAlign:"center",marginTop:16}}>
            <button onClick={function(){setStep("review")}} style={Object.assign({},S.btnP,{padding:"12px 32px",fontSize:14})}>Start Review</button></div>}
          {/* Review history */}
          {weeklyReviews.length>1&&<div style={{maxWidth:360,margin:"16px auto 0",background:K.card,borderRadius:10,border:"1px solid "+K.bdr,padding:"14px 16px"}}>
            <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:8}}>PAST REVIEWS</div>
            <div style={{maxHeight:140,overflow:"auto"}}>
            {weeklyReviews.slice(1,15).map(function(h,hi){
              var d2=h.date?new Date(h.date):null;
              var ds2=d2?d2.toLocaleDateString("en-US",{month:"short",day:"numeric"}):"";
              return<div key={hi} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:hi<Math.min(weeklyReviews.length-1,14)-1?"1px solid "+K.bdr+"30":"none"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:K.grn,flexShrink:0}}/>
                <div style={{fontSize:11,color:K.txt,fontFamily:fm,flex:1}}>Week reviewed</div>
                <div style={{fontSize:8,color:K.dim,fontFamily:fm}}>{ds2}</div>
              </div>})}</div>
          </div>}
        </div>})()}

      {step==="review"&&c&&<div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>{idx+1} / {portfolio.length}</div>
          <div style={{flex:1,height:4,borderRadius:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:((idx+1)/portfolio.length*100)+"%",borderRadius:2,background:K.acc,transition:"width .3s"}}/></div>
        </div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:14,padding:"28px 32px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <CoLogo domain={c.domain} ticker={c.ticker} size={36}/>
            <div><div style={{fontSize:18,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker}</div>
              <div style={{fontSize:12,color:K.dim}}>{c.name}</div></div>
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>CURRENT CONVICTION</div>
              <div style={{fontSize:22,fontWeight:700,color:c.conviction>=7?K.grn:c.conviction>=4?K.amb:K.red,fontFamily:fm}}>{c.conviction||"—"}/10</div></div>
          </div>
          {/* Prior review comparison */}
          {(function(){var prevWeek=weeklyReviews.length>0?weeklyReviews[0]:null;var prevEntry=prevWeek?prevWeek.entries.find(function(e){return e.id===c.id}):null;
            if(!prevEntry)return null;
            var delta=c.conviction-(prevEntry.prev||0);
            var prevAction=prevEntry.action||"hold";
            return<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:3}}>LAST WEEK</div>
                <div style={{fontSize:12,color:K.mid}}>Conviction: <strong style={{color:K.txt}}>{prevEntry.prev}→{prevEntry.new}</strong>{prevEntry.note?" · "+prevEntry.note.substring(0,60):""}</div>
              </div>
              {prevAction!=="hold"&&<span style={{fontSize:10,fontWeight:700,color:prevAction==="add"?K.grn:prevAction==="sell"?K.red:K.amb,background:(prevAction==="add"?K.grn:prevAction==="sell"?K.red:K.amb)+"15",padding:"3px 8px",borderRadius:4,fontFamily:fm,textTransform:"uppercase",flexShrink:0}}>{prevAction}</span>}
            </div>})()}
          {/* Conviction history sparkline */}
          {(function(){var ch=c.convictionHistory||[];if(ch.length<2)return null;var pts=ch.slice(-8);var maxV=10;var minV=1;
            return<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:5}}>CONVICTION HISTORY</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:3,height:24}}>
                  {pts.map(function(p,pi){var h=Math.max(3,Math.round((p.rating/10)*24));var isLast=pi===pts.length-1;var clr=p.rating>=7?K.grn:p.rating>=4?K.amb:K.red;
                    return<div key={pi} title={(p.date||"")+": "+p.rating} style={{width:16,height:h,borderRadius:2,background:isLast?clr:clr+"60",transition:"height .2s",flexShrink:0}}/>})}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                {(function(){var first=pts[0].rating;var last=pts[pts.length-1].rating;var delta=last-first;
                  return<div><div style={{fontSize:18,fontWeight:800,color:last>=7?K.grn:last>=4?K.amb:K.red,fontFamily:fm,lineHeight:1}}>{last}</div>
                  {delta!==0&&<div style={{fontSize:10,fontWeight:700,color:delta>0?K.grn:K.red,fontFamily:fm}}>{delta>0?"+":""}{delta} vs {pts.length} wks ago</div>}</div>})()}
              </div>
            </div>})()}
          {/* Quick thesis reminder */}
          {c.thesisNote&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"10px 14px",marginBottom:16,maxHeight:80,overflow:"hidden"}}>
            <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:4}}>YOUR THESIS</div>
            <div style={{fontSize:13,color:K.mid,lineHeight:1.5}}>{c.thesisNote.split("\n")[0].substring(0,200)}</div></div>}
          {/* Munger reflection prompt */}
          {(function(){var prompts=["If you couldn\u2019t look at the stock price for 5 years, would you still own this?","What do you understand about this business that the market doesn\u2019t?","Would you be comfortable if this was your only holding?","Is this business better or worse than when you first bought it?","Are you holding because of conviction or because selling feels like admitting a mistake?","What would a smart skeptic say about your thesis?","Has anything structurally changed, or is this just noise?","Would you buy more at today\u2019s price?"];
            var pi=(idx+c.id)%prompts.length;
            return<div style={{background:K.bg,borderRadius:8,padding:"10px 14px",marginBottom:16,borderLeft:"2px solid "+K.acc}}>
              <div style={{fontSize:12,color:K.mid,lineHeight:1.6,fontStyle:"italic"}}>{prompts[pi]}</div></div>})()}
          {/* Conviction adjustment */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:K.dim,fontFamily:fm,marginBottom:8}}>ADJUST CONVICTION</div>
            <div style={{display:"flex",gap:4}}>
              {[1,2,3,4,5,6,7,8,9,10].map(function(v){var cur=revs[c.id]!=null?revs[c.id]:c.conviction;var active=cur===v;
                var clr=v>=7?K.grn:v>=4?K.amb:K.red;
                return<button key={v} onClick={function(){setConv(c.id,v)}}
                  style={{flex:1,height:36,borderRadius:6,border:"1px solid "+(active?clr:K.bdr),background:active?clr+"20":"transparent",
                    color:active?clr:K.dim,fontSize:14,fontWeight:active?700:500,cursor:"pointer",fontFamily:fm}}>{v}</button>})}</div>
            {revs[c.id]!=null&&revs[c.id]!==c.conviction&&<div style={{fontSize:11,color:K.acc,fontFamily:fm,marginTop:4}}>Changed from {c.conviction} to {revs[c.id]}</div>}
          </div>
          {/* Action flag */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:K.dim,fontFamily:fm,marginBottom:8}}>ACTION THIS WEEK</div>
            <div style={{display:"flex",gap:6}}>
              {[{id:"hold",l:"Hold",c:K.mid},{id:"add",l:"Add",c:K.grn},{id:"trim",l:"Trim",c:K.amb},{id:"review",l:"Deep Review",c:K.acc},{id:"sell",l:"Consider Sell",c:K.red}].map(function(a){
                var act=actions[c.id]||"hold";
                return<button key={a.id} onClick={function(){setAction(c.id,a.id)}}
                  style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+(act===a.id?a.c+"60":K.bdr),
                    background:act===a.id?a.c+"12":"transparent",color:act===a.id?a.c:K.dim,
                    fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{a.l}</button>})}</div></div>
          {/* Note */}
          <input value={notes[c.id]||""} onChange={function(e){setNote(c.id,e.target.value)}} placeholder="Quick note (optional)..."
            style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"8px 12px",fontSize:13,fontFamily:fm,outline:"none"}}/>
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
            <div style={{fontSize:13,color:K.dim,lineHeight:1.6}}>Confirm to save convictions and claim your weekly insight.</div>
          </div>
          {/* Stats row */}
          {(function(){
            var changed=Object.keys(revs).filter(function(k){return revs[k]!==(cos.find(function(x){return x.id===parseInt(k)||x.id===k})||{}).conviction});
            var ups=changed.filter(function(k){var co2=cos.find(function(x){return x.id===parseInt(k)||x.id===k})||{};return(revs[k]||0)>(co2.conviction||0)}).length;
            var downs=changed.filter(function(k){var co2=cos.find(function(x){return x.id===parseInt(k)||x.id===k})||{};return(revs[k]||0)<(co2.conviction||0)}).length;
            var actCount=Object.values(actions).filter(function(a){return a!=="hold"}).length;
            var avgNew=Math.round(portfolio.map(function(c2){return revs[c2.id]!=null?revs[c2.id]:(c2.conviction||0)}).reduce(function(s,v){return s+v},0)/Math.max(portfolio.length,1)*10)/10;
            // Pattern insight — multi-signal detection
            var pats=[];
            if(weeklyReviews.length>=3){var neverLowered=weeklyReviews.slice(0,5).every(function(r){return r.entries.every(function(e){return e.new>=e.prev})});if(neverLowered&&downs===0)pats.push({c:K.amb,t:"You haven't lowered conviction in recent reviews. Healthy investing requires honest reassessment."})}
            var raisedButFlag=Object.keys(revs).filter(function(k){var co2=cos.find(function(x){return x.id===parseInt(k)||x.id===k})||{};return(revs[k]||0)>(co2.conviction||0)&&(actions[k]==="sell"||actions[k]==="review")});
            if(raisedButFlag.length>0)pats.push({c:K.amb,t:"Raised conviction but flagged for review on "+raisedButFlag.length+" holding(s)."}); 
            if(pats.length===0&&ups>downs&&ups>=2)pats.push({c:K.grn,t:"Building conviction across "+ups+" holding"+(ups>1?"s":"")+" this week."});
            if(pats.length===0&&downs>ups&&downs>=2)pats.push({c:K.red,t:"Conviction fell on "+downs+" holding"+(downs>1?"s":"")+". Follow your process."});
            if(weeklyReviews.length>=2){var prevAvg=(weeklyReviews[0].summary&&weeklyReviews[0].summary.avgConv)||0;var avgDelta=avgNew-prevAvg;if(Math.abs(avgDelta)>=0.5&&pats.length<2)pats.push({c:avgDelta>0?K.grn:K.amb,t:"Portfolio avg conviction "+(avgDelta>0?"rose":"fell")+" from "+prevAvg+" to "+avgNew+" this week."})}
            var pat=pats[0]||null;
            return<div>
              <div style={{display:"flex",justifyContent:"center",gap:20,marginBottom:12}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,color:K.txt,fontFamily:fm,lineHeight:1}}>{portfolio.length}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Reviewed</div></div>
                {ups>0&&<div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,color:K.grn,fontFamily:fm,lineHeight:1}}>↑{ups}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Raised</div></div>}
                {downs>0&&<div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,color:K.red,fontFamily:fm,lineHeight:1}}>↓{downs}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Lowered</div></div>}
                <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,color:K.acc,fontFamily:fm,lineHeight:1}}>{avgNew}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Avg conv</div></div>
                {actCount>0&&<div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,color:K.grn,fontFamily:fm,lineHeight:1}}>{actCount}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Actions</div></div>}
              </div>
              {pats.slice(0,2).map(function(p2,pi){return<div key={pi} style={{background:p2.c+"10",border:"1px solid "+p2.c+"30",borderRadius:8,padding:"8px 14px",marginBottom:6,fontSize:12,color:p2.c,textAlign:"center",fontStyle:"italic"}}>{p2.t}</div>})}
            </div>})()}
          {/* Compact holdings — horizontal wrap pills */}
          <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:24,maxHeight:120,overflow:"auto"}}>
            {portfolio.map(function(c2){var newConv=revs[c2.id]!=null?revs[c2.id]:c2.conviction;var changed=newConv!==c2.conviction;var act=actions[c2.id]||"hold";
              return<div key={c2.id} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:changed?K.acc+"10":K.bg,border:"1px solid "+(changed?K.acc+"30":K.bdr),fontSize:12,fontFamily:fm}}>
                <span style={{fontWeight:600,color:K.txt}}>{c2.ticker}</span>
                {changed?<span style={{color:K.acc,fontWeight:600}}>{c2.conviction+"→"+newConv}</span>:<span style={{color:K.dim}}>{newConv}</span>}
                {act!=="hold"&&<span style={{fontSize:8,fontWeight:700,color:act==="add"?K.grn:act==="sell"?K.red:K.amb,textTransform:"uppercase"}}>{act}</span>}
              </div>})}</div>
          {/* Chest preview */}
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:K.grn+"08",border:"1px solid "+K.grn+"20",borderRadius:8,padding:"8px 16px"}}>
              <span style={{fontSize:18,animation:"glowPulse 2s ease-in-out infinite"}}>{String.fromCodePoint(0x1F381)}</span>
              <span style={{fontSize:12,color:K.grn,fontWeight:600,fontFamily:fm}}> & Weekly Insight awaits</span></div></div>
          {/* CTA */}
          <button onClick={finishReview} className="ta-glow" style={Object.assign({},S.btnP,{fontSize:16,padding:"16px 0",borderRadius:12,width:"100%",fontWeight:700,background:K.grn,border:"2px solid "+K.grn,color:"#ffffff",boxShadow:"0 4px 20px "+K.grn+"40"})}>
            {String.fromCodePoint(0x2705)+" Complete Review & Claim Insight"}</button>
          <div style={{textAlign:"center",marginTop:12}}><button onClick={function(){setStep("review");setIdx(0)}} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",fontFamily:fm}}>← Go back and edit</button></div>
        </div>
      </div>}

      {step==="done"&&<div>
        {/* ── Review complete card ── */}
        {(function(){
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:14,padding:"28px 24px",marginBottom:20}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:48,marginBottom:8,display:"inline-block"}}>{"✓"}</div>
              <div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm,letterSpacing:1,marginBottom:4}}>THIS WEEK'S REVIEW COMPLETE</div>
              <div style={{fontSize:13,color:K.dim}}>Come back next week to keep the streak alive.</div></div>
            {weeklyReviews.length>=2&&(function(){
              var last8=weeklyReviews.slice(0,8).reverse();
              return<div style={{background:K.bg,borderRadius:10,border:"1px solid "+K.bdr,padding:"12px 16px",marginBottom:16}}>
                <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:8}}>CONVICTION TREND (8 WEEKS)</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:4,height:40,justifyContent:"center"}}>
                  {last8.map(function(rev,ri){var avg=rev.summary?rev.summary.avgConv:0;var h=Math.max(4,Math.round((avg/10)*40));var isLatest=ri===last8.length-1;var clr=avg>=7?K.grn:avg>=4?K.acc:K.red;
                    return<div key={ri} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <div style={{width:"100%",height:h,borderRadius:2,background:isLatest?clr:clr+"50",transition:"height .3s"}} title={"Wk "+rev.weekId+": avg "+avg}/>
                      {isLatest&&<span style={{fontSize:7,color:clr,fontFamily:fm,fontWeight:700}}>{avg}</span>}
                    </div>})}
                </div>
              </div>})()}
          </div>})()}

        {/* Past reviews */}
        {weeklyReviews.length>0&&<div style={{marginTop:12}}>
          <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Review History</div>
          {weeklyReviews.slice(0,12).map(function(r,ri){
            var increases=r.entries.filter(function(e){return e.new>e.prev});
            var decreases=r.entries.filter(function(e){return e.new<e.prev});
            var actions=r.entries.filter(function(e){return e.action&&e.action!=="hold"});
            return<div key={ri} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 18px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Week of {r.weekId}</div>
                <div style={{display:"flex",gap:6}}>
                  {increases.length>0&&<span style={{fontSize:10,fontWeight:600,color:K.grn,background:K.grn+"12",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>↑{increases.length}</span>}
                  {decreases.length>0&&<span style={{fontSize:10,fontWeight:600,color:K.red,background:K.red+"12",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>↓{decreases.length}</span>}
                  {actions.length>0&&<span style={{fontSize:10,fontWeight:600,color:K.acc,background:K.acc+"12",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>{actions.length} action{actions.length>1?"s":""}</span>}
                </div>
                <span style={{fontSize:11,color:K.dim,fontFamily:fm,marginLeft:"auto"}}>avg {r.summary.avgConv}/10</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {r.entries.map(function(e){var changed=e.prev!==e.new;var isUp=e.new>e.prev;var isDown=e.new<e.prev;
                  return<div key={e.ticker} style={{padding:"3px 8px",borderRadius:4,background:changed?(isUp?K.grn+"12":K.red+"12"):K.bg,border:"1px solid "+(changed?(isUp?K.grn+"30":K.red+"30"):K.bdr),fontSize:11,fontFamily:fm,color:changed?(isUp?K.grn:K.red):K.dim,display:"flex",alignItems:"center",gap:3}}>
                    <span style={{fontWeight:600}}>{e.ticker}</span>
                    {changed&&<span>{isUp?"↑":"↓"}{e.prev}→{e.new}</span>}
                    {!changed&&<span style={{color:K.dim}}>{e.new}</span>}
                    {e.action&&e.action!=="hold"&&<span style={{fontSize:8,fontWeight:700,color:e.action==="add"?K.grn:e.action==="sell"?K.red:K.amb,textTransform:"uppercase",marginLeft:2}}>{e.action}</span>}
                  </div>})}</div>
              {r.entries.some(function(e){return e.note&&e.note.length>0})&&<div style={{marginTop:8,paddingTop:8,borderTop:"1px solid "+K.bdr+"50"}}>
                {r.entries.filter(function(e){return e.note}).map(function(e){return<div key={e.ticker} style={{fontSize:11,color:K.mid,marginBottom:2}}><strong style={{color:K.txt}}>{e.ticker}:</strong> {e.note}</div>})}
              </div>}
            </div>})}</div>}
      </div>}
    </div>}

  // ── All Assets ────────────────────────────────────────────
  function AllAssets(){
    var all=cos;
    var portfolio=all.filter(function(c){return(c.status||"portfolio")==="portfolio"});
    var watchlist=all.filter(function(c){return c.status==="watchlist"});
    var toohard=all.filter(function(c){return c.status==="toohard"});
    var _tab=useState("portfolio"),tab=_tab[0],setTab=_tab[1];
    var _q=useState(""),q=_q[0],setQ=_q[1];
    var list=tab==="portfolio"?portfolio:tab==="watchlist"?watchlist:toohard;
    var filtered=q?list.filter(function(c){return c.ticker.toLowerCase().indexOf(q.toLowerCase())>=0||c.name.toLowerCase().indexOf(q.toLowerCase())>=0}):list;
    return<div style={{padding:isMobile?"0 16px 80px":"0 32px 60px",maxWidth:900}}>
      <div style={{padding:isMobile?"20px 0 16px":"28px 0 24px"}}>
        <div style={{fontSize:isMobile?20:26,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:4}}>All Assets</div>
        <div style={{fontSize:13,color:K.dim}}>{all.length} companies tracked</div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:4}}>
          {[["portfolio","Portfolio",portfolio.length],["watchlist","Watchlist",watchlist.length],["toohard","Too Hard",toohard.length]].map(function(tb){return<button key={tb[0]} onClick={function(){setTab(tb[0])}} style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+(tab===tb[0]?K.acc:K.bdr),background:tab===tb[0]?K.acc+"18":"transparent",color:tab===tb[0]?K.acc:K.dim,fontSize:12,fontWeight:tab===tb[0]?600:400,cursor:"pointer",fontFamily:fm}}>{tb[1]} ({tb[2]})</button>})}
        </div>
        <input value={q} onChange={function(e){setQ(e.target.value)}} placeholder="Search..." style={{flex:1,minWidth:120,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"6px 12px",fontSize:12,fontFamily:fm,outline:"none"}}/>
      </div>
      {filtered.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:40,textAlign:"center",color:K.dim,fontSize:14}}>No companies in this list yet.</div>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(function(c){
          var pos=c.position||{};var ret=pos.shares>0&&pos.avgCost>0&&pos.currentPrice>0?((pos.currentPrice-pos.avgCost)/pos.avgCost*100):null;
          var hasThesis=c.thesisNote&&c.thesisNote.trim().length>20;
          return<div key={c.id} className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}} onClick={function(){setSelId(c.id);setPage("dashboard")}}>
            <CoLogo ticker={c.ticker} domain={c.domain} size={36}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                <span style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</span>
                <span style={{fontSize:12,color:K.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {c.sector&&<span style={{fontSize:10,color:K.dim,background:K.bg,border:"1px solid "+K.bdr,borderRadius:4,padding:"1px 6px"}}>{c.sector}</span>}
                {hasThesis&&<span style={{fontSize:10,color:K.grn,background:K.grn+"12",border:"1px solid "+K.grn+"30",borderRadius:4,padding:"1px 6px"}}>Thesis</span>}
                {(c.kpis||[]).length>0&&<span style={{fontSize:10,color:K.acc,background:K.acc+"12",border:"1px solid "+K.acc+"30",borderRadius:4,padding:"1px 6px"}}>{c.kpis.length} KPIs</span>}
                {c.conviction>0&&<span style={{fontSize:10,color:K.amb,background:K.amb+"12",border:"1px solid "+K.amb+"30",borderRadius:4,padding:"1px 6px"}}>Conv {c.conviction}/10</span>}
              </div>
            </div>
            {ret!==null&&<div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:700,color:ret>=0?K.grn:K.red,fontFamily:fm}}>{ret>=0?"+":""}{ret.toFixed(1)}%</div>
              <div style={{fontSize:10,color:K.dim}}>return</div>
            </div>}
          </div>
        })}
      </div>
    </div>
  }

  // ── Portfolio Timeline ─────────────────────────────────────
  function PortfolioTimeline(){
    var allDecs=[];
    cos.forEach(function(c){(c.decisions||[]).forEach(function(d){allDecs.push(Object.assign({},d,{ticker:c.ticker,companyId:c.id,domain:c.domain}))})});
    allDecs.sort(function(a,b){return(b.date||"")>(a.date||"")?1:-1});
    var allJournal=[];
    cos.forEach(function(c){(c.journalEntries||[]).forEach(function(e){allJournal.push(Object.assign({},e,{ticker:c.ticker,companyId:c.id}))})});
    allJournal.sort(function(a,b){return(b.date||b.createdAt||"")>(a.date||a.createdAt||"")?1:-1});
    var combined=allDecs.map(function(d){return{type:"decision",date:d.date,data:d}})
      .concat(allJournal.slice(0,30).map(function(e){return{type:"journal",date:e.date||e.createdAt,data:e}}));
    combined.sort(function(a,b){return(b.date||"")>(a.date||"")?1:-1});
    return<div style={{padding:isMobile?"0 16px 80px":"0 32px 60px",maxWidth:800}}>
      <div style={{padding:isMobile?"20px 0 16px":"28px 0 24px"}}>
        <div style={{fontSize:isMobile?20:26,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:4}}>Portfolio Timeline</div>
        <div style={{fontSize:13,color:K.dim}}>{allDecs.length} decisions · {allJournal.length} journal entries</div>
      </div>
      {combined.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:12,padding:40,textAlign:"center",color:K.dim,fontSize:14}}>No activity yet. Log decisions and journal entries in company pages.</div>}
      <div style={{display:"flex",flexDirection:"column",gap:0}}>
        {combined.slice(0,60).map(function(item,i){
          var d=item.data;var dt=item.date?new Date(item.date):null;
          var ds=dt?dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"";
          var isDecision=item.type==="decision";
          var clr=isDecision?(d.action==="buy"?K.grn:d.action==="sell"?K.red:K.acc):K.blue;
          return<div key={i} style={{display:"flex",gap:14,paddingBottom:16}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:20,flexShrink:0}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:clr,flexShrink:0,marginTop:4}}/>
              {i<combined.length-1&&<div style={{width:2,flex:1,background:K.bdr,marginTop:4}}/>}
            </div>
            <div style={{flex:1,background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px",marginBottom:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                {isDecision&&<span style={{fontSize:10,fontWeight:700,color:clr,background:clr+"15",border:"1px solid "+clr+"30",borderRadius:4,padding:"2px 7px",textTransform:"uppercase"}}>{d.action||"note"}</span>}
                {!isDecision&&<span style={{fontSize:10,fontWeight:700,color:K.blue,background:K.blue+"15",border:"1px solid "+K.blue+"30",borderRadius:4,padding:"2px 7px"}}>Journal</span>}
                <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,cursor:"pointer"}} onClick={function(){setSelId(d.companyId);setPage("dashboard")}}>{d.ticker}</span>
                <span style={{fontSize:11,color:K.dim,marginLeft:"auto"}}>{ds}</span>
              </div>
              {isDecision&&d.reasoning&&<div style={{fontSize:13,color:K.mid,lineHeight:1.5}}>{d.reasoning.substring(0,200)}{d.reasoning.length>200?"…":""}</div>}
              {!isDecision&&d.content&&<div style={{fontSize:13,color:K.mid,lineHeight:1.5}}>{(d.content||"").substring(0,200)}{(d.content||"").length>200?"…":""}</div>}
              {!isDecision&&d.title&&<div style={{fontSize:13,fontWeight:500,color:K.txt}}>{d.title}</div>}
            </div>
          </div>
        })}
      </div>
    </div>
  }

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

    var secStyle={fontSize:12,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:14,fontWeight:600,fontFamily:fb,display:"flex",alignItems:"center",gap:8};

    return<div style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 32px 60px",maxWidth:1100}}>
      <div style={{padding:isMobile?"16px 0 12px":"28px 0 20px"}}><h1 style={{margin:0,fontSize:isMobile?24:26,fontWeight:isThesis?800:400,color:K.txt,fontFamily:fh,letterSpacing:isThesis?"-0.5px":"normal"}}>Portfolio Analytics</h1>
        <p style={{margin:"4px 0 0",fontSize:14,color:K.dim}}>{portCos.length} portfolio companies{ldM?" • Analyzing ("+prog+"/"+portCos.length+")":withMoat.length>0?" • "+withMoat.length+" analyzed":""}</p></div>

      {ldM?<div style={{padding:40,textAlign:"center"}}><div style={{fontSize:14,color:K.dim}}>Analyzing financial quality of {portCos.length} companies...</div>
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
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><IC name={card.icon} size={14} color={K.dim}/><div style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontWeight:600,fontFamily:fb}}>{card.label}</div></div>
            <div style={{fontSize:28,fontWeight:700,color:clr,fontFamily:fm}}>{v||"—"}<span style={{fontSize:13,fontWeight:400,color:K.dim}}>/10</span></div>
            <div style={{fontSize:11,color:clr,marginTop:4,fontFamily:fb}}>{v?card.sub:""}</div></div>})}</div>

      {/* ── Portfolio Quality Profile (all 8 dimensions) ── */}
      {withMoat.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
        <div style={secStyle}><IC name="bar" size={14} color={K.dim}/>Portfolio Quality Profile</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
          {dimIds.map(function(d){var avg2=dimAvgs[d];if(avg2===null)return null;
            var clr=avg2>=8?K.grn:avg2>=6?K.acc:avg2>=4?K.amb:K.red;
            return<div key={d} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0"}}>
              <IC name={dimIcons[d]} size={14} color={K.dim}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,color:K.mid,fontFamily:fb}}>{dimLabels[d]}</span>
                  <span style={{fontSize:13,fontWeight:600,color:clr,fontFamily:fm}}>{avg2}</span></div>
                <div style={{height:4,borderRadius:2,background:K.bdr}}><div style={{height:"100%",width:avg2*10+"%",borderRadius:2,background:clr,transition:"width .5s"}}/></div></div></div>})}
        </div>
        <div style={{marginTop:14,fontSize:12,color:K.dim,lineHeight:1.6,fontFamily:fb}}>Average scores across {withMoat.length} of {holdings.length} companies. Dimensions below 6 are portfolio-wide vulnerabilities.{withMoat.length<holdings.length?" "+(holdings.length-withMoat.length)+" holding"+(holdings.length-withMoat.length>1?"s":"")+" excluded — no historical data yet.":""}</div></div>}

      {/* ── Red Flags: Munger "avoid losers" ── */}
      {redFlags.length>0&&<div style={{background:K.red+"08",border:"1px solid "+K.red+"20",borderRadius:12,padding:"20px 24px",marginBottom:24}}>
        <div style={secStyle}><IC name="alert" size={14} color={K.red}/>Needs Attention</div>
        <div style={{fontSize:13,color:K.mid,marginBottom:14,lineHeight:1.6,fontFamily:fb}}>These holdings have weak capital efficiency or fragile balance sheets. Munger would ask: why do I own this?</div>
        {redFlags.map(function(x){var issues=[];
          if(x.dims.roic&&x.dims.roic.score<5)issues.push("Low ROIC ("+x.dims.roic.value+")");
          if(x.dims.fortress&&x.dims.fortress.score<4)issues.push("Weak balance sheet ("+x.dims.fortress.value+")");
          if(x.dims.fcfConversion&&x.dims.fcfConversion.score<4)issues.push("Poor FCF conversion ("+x.dims.fcfConversion.value+")");
          if(x.dims.grossMargin){var ppOver=(x.company.pricingPower&&x.company.pricingPower.score!=null)?x.company.pricingPower.score:x.dims.grossMargin.score;if(ppOver<4)issues.push("Weak pricing power ("+ppOver+"/10)")};
          return<div key={x.company.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,cursor:"pointer",padding:"8px 12px",background:K.card,borderRadius:8,border:"1px solid "+K.bdr}} onClick={function(){setSelId(x.company.id);setDetailTab("research");setPage("dashboard")}}>
            <CoLogo domain={x.company.domain} ticker={x.company.ticker} size={24}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{x.company.ticker}</div>
              <div style={{fontSize:11,color:K.red,fontFamily:fb}}>{issues.join(" • ")}</div></div>
            <div style={{fontSize:16,fontWeight:700,color:moatColor(x.moat.composite),fontFamily:fm}}>{x.moat.composite}</div></div>})}</div>}

      {/* ── Strongest / Weakest ── */}
      {withMoat.length>0&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:24}}>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
          <div style={secStyle}><IC name="trending" size={14} color={K.grn}/>Strongest Businesses</div>
          {strongest.map(function(x){return<div key={x.company.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,cursor:"pointer",padding:"6px 0"}} onClick={function(){setSelId(x.company.id);setPage("dashboard")}}>
            <CoLogo domain={x.company.domain} ticker={x.company.ticker} size={24}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{x.company.ticker}</div><div style={{fontSize:11,color:K.dim,fontFamily:fb}}>{moatLabel(x.moat.composite)}</div></div>
            <div style={{fontSize:18,fontWeight:700,color:moatColor(x.moat.composite),fontFamily:fm}}>{x.moat.composite}</div></div>})}</div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
          <div style={secStyle}><IC name="alert" size={14} color={K.amb}/>Weakest Links</div>
          {weakest.map(function(x){return<div key={x.company.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,cursor:"pointer",padding:"6px 0"}} onClick={function(){setSelId(x.company.id);setPage("dashboard")}}>
            <CoLogo domain={x.company.domain} ticker={x.company.ticker} size={24}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{x.company.ticker}</div><div style={{fontSize:11,color:K.dim,fontFamily:fb}}>{moatLabel(x.moat.composite)}</div></div>
            <div style={{fontSize:18,fontWeight:700,color:moatColor(x.moat.composite),fontFamily:fm}}>{x.moat.composite}</div></div>})}</div></div>}

      {/* ── Holdings Quality Table ── */}
      {holdings.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
        <div style={secStyle}><IC name="overview" size={14} color={K.dim}/>Holdings Quality</div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["","Company","Moat","Fortress","Pricing","ROIC","Earnings Q."].map(function(h){return<th key={h} style={{textAlign:h===""||h==="Company"?"left":"center",padding:"8px 10px",fontSize:11,color:K.dim,borderBottom:"1px solid "+K.bdr,fontFamily:fb,fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>})}</tr></thead>
          <tbody>{holdings.map(function(q,i){
            function cellClr(v){return v>=8?K.grn:v>=6?K.acc:v>=4?K.amb:v?K.red:K.dim}
            return<tr key={q.id} style={{cursor:"pointer"}} onClick={function(){setSelId(q.id);setDetailTab("research");setPage("dashboard")}}>
              <td style={{padding:"10px 10px",fontSize:12,color:K.dim,fontFamily:fm,borderBottom:"1px solid "+K.bdr+"50"}}>{i+1}</td>
              <td style={{padding:"10px 10px",borderBottom:"1px solid "+K.bdr+"50"}}><div style={{display:"flex",alignItems:"center",gap:8}}><CoLogo domain={q.domain} ticker={q.ticker} size={20}/><span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{q.ticker}</span></div></td>
              <td style={{padding:"10px 10px",textAlign:"center",borderBottom:"1px solid "+K.bdr+"50"}}><span style={{fontSize:14,fontWeight:700,color:moatColor(q.moat),fontFamily:fm,background:moatColor(q.moat)+"15",padding:"3px 10px",borderRadius:4}}>{q.moat}</span></td>
              {[q.fortress,q.pricing,q.roic,q.fcf].map(function(v,vi){return<td key={vi} style={{padding:"10px 10px",textAlign:"center",fontSize:14,fontWeight:600,color:v?cellClr(v):K.dim,fontFamily:fm,borderBottom:"1px solid "+K.bdr+"50"}}>{v||"—"}</td>})}</tr>})}</tbody></table></div></div>}

      {/* ── Investment Style Distribution ── */}
      {function(){var styleCounts={};portCos.forEach(function(co){var sid=co.investStyle||"unset";styleCounts[sid]=(styleCounts[sid]||0)+1});
        var hasStyles=portCos.some(function(co){return co.investStyle});
        if(!hasStyles)return null;
        var total=portCos.length;
        return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:24}}>
          <div style={secStyle}><IC name="bar" size={14} color={K.dim}/>Investment Style Mix</div>
          <div style={{fontSize:13,color:K.dim,marginBottom:16}}>How your portfolio is distributed across investment approaches.</div>
          <div style={{display:"flex",gap:3,height:28,borderRadius:6,overflow:"hidden",marginBottom:14}}>
            {INVEST_STYLES.map(function(st){var cnt=styleCounts[st.id]||0;if(!cnt)return null;
              return<div key={st.id} style={{flex:cnt,background:st.color,display:"flex",alignItems:"center",justifyContent:"center",minWidth:cnt/total>0.12?0:28}} title={st.label+": "+cnt}>
                <span style={{fontSize:11,fontWeight:700,color:"#fff",fontFamily:fm}}>{cnt}</span></div>}).filter(Boolean)}
            {styleCounts.unset&&<div style={{flex:styleCounts.unset,background:K.bdr,display:"flex",alignItems:"center",justifyContent:"center"}} title={"Unclassified: "+styleCounts.unset}>
              <span style={{fontSize:11,fontWeight:700,color:K.dim,fontFamily:fm}}>{styleCounts.unset}</span></div>}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {INVEST_STYLES.map(function(st){var cnt=styleCounts[st.id]||0;if(!cnt)return null;
              var pct=Math.round(cnt/total*100);var names=portCos.filter(function(co){return co.investStyle===st.id}).map(function(co){return co.ticker});
              return<div key={st.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:st.color+"08",border:"1px solid "+st.color+"25",borderRadius:8,flex:"1 1 200px"}}>
                <IC name={st.icon} size={14} color={st.color}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{st.label} <span style={{fontWeight:400,color:st.color}}>{pct}%</span></div>
                  <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{names.join(", ")}</div></div></div>}).filter(Boolean)}
            {styleCounts.unset&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,flex:"1 1 200px"}}>
              <IC name="alert" size={14} color={K.dim}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:K.mid,fontFamily:fm}}>Unclassified <span style={{fontWeight:400,color:K.dim}}>{Math.round(styleCounts.unset/total*100)}%</span></div>
                <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{portCos.filter(function(co){return!co.investStyle}).map(function(co){return co.ticker}).join(", ")}</div></div></div>}
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
          <div style={{fontSize:13,color:K.dim,marginBottom:16}}>What protects your portfolio? Distribution of competitive advantages across holdings.</div>
          <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
            {activeTypes.map(function(t){var cos2=typeCompanies[t.id]||[];var avgStr=cos2.length?Math.round(cos2.reduce(function(s,x){return s+x.strength},0)/cos2.length*10)/10:0;
              return<div key={t.id} style={{padding:"14px 16px",borderRadius:8,background:t.color+"08",border:"1px solid "+t.color+"25"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{width:24,height:24,borderRadius:5,background:t.color+"15",display:"flex",alignItems:"center",justifyContent:"center"}}><IC name={t.icon} size={12} color={t.color}/></div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{t.label}</div></div>
                  <span style={{fontSize:18,fontWeight:700,color:t.color,fontFamily:fm}}>{cos2.length}</span></div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {cos2.sort(function(a,b){return b.strength-a.strength}).map(function(x){
                    return<span key={x.ticker} style={{fontSize:11,fontWeight:600,color:t.color,background:t.color+"15",padding:"2px 8px",borderRadius:3,fontFamily:fm}}>{x.ticker} {"•".repeat(x.strength)}</span>})}</div>
                <div style={{fontSize:11,color:K.dim,marginTop:6,fontFamily:fm}}>Avg strength: {avgStr}/5</div></div>})}</div>
          {unclass.length>0&&<div style={{marginTop:12,padding:"10px 14px",background:K.amb+"08",border:"1px solid "+K.amb+"25",borderRadius:8}}>
              <div style={{fontSize:12,color:K.amb,fontWeight:600}}>Unclassified: {unclass.map(function(c2){return c2.ticker}).join(", ")}</div>
              <div style={{fontSize:11,color:K.dim,marginTop:2}}>Visit the Moat Tracker for each company to classify their competitive advantages.</div></div>}
        </div>}()}

      {/* ── Munger Quote ── */}
      {withMoat.length>0&&<div style={{padding:"20px 24px",background:K.card,border:"1px solid "+K.bdr,borderRadius:12}}>
        <div style={{fontSize:14,color:K.mid,lineHeight:1.7,fontStyle:"italic",fontFamily:fh}}>{"\"Over the long term, it’s hard for a stock to earn a much better return than the business which underlies it earns. If the business earns 6% on capital over 40 years and you hold it for that 40 years, you’re not going to make much different than a 6% return.\""}</div>
        <div style={{fontSize:12,color:K.dim,marginTop:8,fontFamily:fb}}>{"—"} Charlie Munger</div></div>}

      {portCos.length===0&&<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim}}>No portfolio companies yet. Add companies and set their status to Portfolio.</div></div>}
      </div>}</div>}


  // ── Dividend Hub ──────────────────────────────────────
  function DividendHub(){
    var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
    var divPayers=portfolio.filter(function(c){return(c.divPerShare||c.lastDiv||0)>0});
    var nonPayers=portfolio.filter(function(c){return(c.divPerShare||c.lastDiv||0)<=0});
    var _dht=useState("overview"),divTab=_dht[0],setDivTab=_dht[1];
    var _dhm=useState(null),hovMonth=_dhm[0],setHovMonth=_dhm[1];
    var monthNames=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var TICKER_COLORS=[K.acc,"#22C55E","#F59E0B","#EC4899","#8B5CF6","#06B6D4","#f87171","#a3e635","#fb923c","#38bdf8"];
    var freqLabel=function(f){return f==="monthly"?"Monthly":f==="semi"?"Semi-Annual":f==="annual"?"Annual":"Quarterly"};
    // ── Derived totals ──────────────────────────────────────────
    var totalAnnual=0;var totalValue=0;
    divPayers.forEach(function(c){var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;totalAnnual+=(pos.shares||0)*dps*mult;totalValue+=(pos.shares||0)*(pos.currentPrice||0)});
    var portfolioYield=totalValue>0?(totalAnnual/totalValue*100):0;
    var monthlyAvg=totalAnnual/12;
    // ── Monthly income breakdown (stacked per payer) ────────────
    var tickerColorMap={};divPayers.forEach(function(c,i){tickerColorMap[c.ticker]=TICKER_COLORS[i%TICKER_COLORS.length]});
    var monthlyBreakdown=monthNames.map(function(mn,mi){
      var income=0;var payers=[];
      divPayers.forEach(function(c){var months=estimatePayMonths(c);if(months.indexOf(mi)===-1)return;
        var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var payout=(pos.shares||0)*dps;
        if(payout>0){income+=payout;payers.push({ticker:c.ticker,amount:payout,color:tickerColorMap[c.ticker]})}});
      return{month:mn,idx:mi,income:income,payers:payers}});
    var maxMonthlyIncome=Math.max.apply(null,monthlyBreakdown.map(function(m){return m.income}))||1;
    // ── Safety scoring (1–10 per holding) ──────────────────────
    function calcSafetyScore(c){
      var snap=c.financialSnapshot||{};
      var sector=(c.sector||"").toLowerCase();var industry=(c.industry||"").toLowerCase();
      var isReit=sector.indexOf("real estate")>=0||industry.indexOf("reit")>=0||c.ticker==="O"||c.ticker==="REALTY";
      var isUtility=sector.indexOf("utilit")>=0||industry.indexOf("utilit")>=0||industry.indexOf("electric")>=0||industry.indexOf("gas distribution")>=0;
      var dps=c.divPerShare||c.lastDiv||0;
      var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
      var annDps=dps*mult;
      var pos=c.position||{};
      var g=function(k){return snap[k]&&snap[k].numVal!=null?snap[k].numVal:null};
      // fcfPerShare is stored as snap.fcf — check both keys
      var fcfPs=snap.fcf&&snap.fcf.numVal!=null?snap.fcf.numVal:g("fcfPerShare");
      var payout=g("payoutRatio");var ic=g("interestCoverage");
      var de=g("debtEquity");var revGr=g("revGrowth");var divGr=g("divGrowth");
      var components=[];var total=0;var possible=0;
      // ── 1. Payout Ratio (0–3 pts) — SECTOR-ADJUSTED ───────────
      // REITs must pay out 90%+ legally; utilities are stable at 60-70%; cyclicals need <45%
      if(payout!==null){possible+=3;
        var pr=payout>0&&payout<1?payout*100:payout;
        var safeThresh=isReit?85:isUtility?65:45;
        var warnThresh=isReit?95:isUtility?80:65;
        var pts=pr<safeThresh?3:pr<warnThresh?2:pr<warnThresh+15?1:0;
        var sectorNote=isReit?" (REIT — adjusted)":isUtility?" (Utility — adjusted)":"";
        total+=pts;components.push({label:"Payout Ratio",value:pr.toFixed(0)+"%"+sectorNote,pts:pts,max:3,
          tip:pr<safeThresh?"Conservatively low for this sector — ample coverage":pr<warnThresh?"Within acceptable range — monitor trends":"Elevated — limited headroom if earnings soften"})}
      // ── 2. FCF Coverage (0–2 pts) — does cash actually fund it? ─
      if(fcfPs!==null&&annDps>0){possible+=2;
        var cov=fcfPs/annDps;var pts2=cov>=2?2:cov>=1.1?1:0;
        total+=pts2;components.push({label:"FCF Coverage",value:cov.toFixed(1)+"x",pts:pts2,max:2,
          tip:cov>=2?"Dividend funded comfortably from free cash flow":cov>=1.1?"Covered, but limited buffer":"FCF barely or does not cover the dividend — high risk"})}
      // ── 3. Interest Coverage (0–2 pts) — NEW ──────────────────
      // A company drowning in interest payments will sacrifice the dividend first
      if(ic!==null){possible+=2;
        var pts3=ic>=10?2:ic>=5?1:0;
        total+=pts3;components.push({label:"Interest Coverage",value:ic.toFixed(1)+"x",pts:pts3,max:2,
          tip:ic>=10?"Earnings cover interest 10x+ — financially fortress-like":ic>=5?"Adequate coverage, manageable debt service":"Thin coverage — debt pressure may force a cut"})}
      // ── 4. Dividend Longevity (0–2 pts) — NEW ─────────────────
      // Proxy: company age from ipoDate. Older companies have longer dividend track records.
      // This mirrors SSD's "dividend commitment" factor — a 25yr payer is very different from a 2yr payer.
      var longevityPts=0;var longevityLabel="Unknown";var longevityTip="";
      if(c.ipoDate){
        var yrsPublic=Math.max(0,(new Date()-new Date(c.ipoDate))/864e5/365);
        longevityPts=yrsPublic>=15?2:yrsPublic>=7?1:0;
        longevityLabel=yrsPublic>=1?Math.floor(yrsPublic)+"yr public company":"< 1yr public";
        longevityTip=yrsPublic>=15?"Long-established company — dividend commitment is proven":yrsPublic>=7?"Established track record":"Younger company — dividend history is limited"
      } else if(c.exDivDate){
        // Fallback: if they have an ex-div date, at least they're paying
        longevityPts=1;longevityLabel="Paying dividends";longevityTip="Company has dividend history but age unknown"
      }
      possible+=2;total+=longevityPts;
      components.push({label:"Dividend Longevity",value:longevityLabel,pts:longevityPts,max:2,tip:longevityTip});
      // ── 5. Revenue Growth (0–1 pt) ────────────────────────────
      if(revGr!==null){possible+=1;
        var pts5=revGr>0?1:0;
        total+=pts5;components.push({label:"Revenue Growth",value:(revGr>=0?"+":"")+revGr.toFixed(1)+"%",pts:pts5,max:1,
          tip:revGr>5?"Growing revenues create headroom for future increases":revGr>0?"Modest growth — dividend stable":"Declining revenue is an early warning sign"})}
      // ── 6. Balance Sheet / Leverage (0–1 pt) ─────────────────
      // Debt/equity gives a quick balance sheet check alongside interest coverage
      if(de!==null){possible+=1;
        var pts6=de<1.0?1:0;
        total+=pts6;components.push({label:"Debt / Equity",value:de.toFixed(2)+"x",pts:pts6,max:1,
          tip:de<0.5?"Minimal leverage — strong financial position":de<1?"Conservative debt levels":"Elevated leverage — limits financial flexibility"})}
      // ── 7. Dividend Growth YoY (0–1 pt) ──────────────────────
      if(divGr!==null){possible+=1;
        var pts7=divGr>0?1:0;
        total+=pts7;components.push({label:"Div Growth YoY",value:(divGr>=0?"+":"")+divGr.toFixed(1)+"%",pts:pts7,max:1,
          tip:divGr>5?"Meaningfully growing the payout — management confidence":divGr>0?"Maintaining growth track record":"Flat or declining — growth commitment uncertain"})}
      if(possible===0)return{score:null,components:[],label:"No data"};
      var score=Math.round(total/possible*10);
      var label=score>=8?"Fortress":score>=6?"Solid":score>=4?"Cautious":"At Risk";
      var color=score>=8?K.grn:score>=6?"#4ade80":score>=4?K.amb:K.red;
      return{score:score,components:components,label:label,color:color,possible:possible}}
    var safetyScores=divPayers.map(function(c){return{c:c,s:calcSafetyScore(c)}});
    // ── Cut risk detection ──────────────────────────────────────
    var atRisk=safetyScores.filter(function(x){return x.s.score!==null&&x.s.score<=4});
    var cautious=safetyScores.filter(function(x){return x.s.score!==null&&x.s.score>4&&x.s.score<=6});
    // ── Growth tracker ──────────────────────────────────────────
    function getGrowthMetrics(c){
      var snap=c.financialSnapshot||{};var g=function(k){return snap[k]&&snap[k].numVal!=null?snap[k].numVal:null};
      var divGr=g("divGrowth");var revGr=g("revGrowth");
      var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
      var annDps=dps*mult;var pos=c.position||{};
      var annIncome=(pos.shares||0)*annDps;
      var proj3yr=divGr!=null&&divGr>0?annIncome*Math.pow(1+divGr/100,3):null;
      return{divGr:divGr,revGr:revGr,annDps:annDps,annIncome:annIncome,proj3yr:proj3yr}}
    var totalProj3yr=divPayers.reduce(function(s,c){var gm=getGrowthMetrics(c);return s+(gm.proj3yr||gm.annIncome)},0);
    // ── Tab nav ─────────────────────────────────────────────────
    var tabs=[{id:"overview",label:"Overview"},{id:"income",label:"Income Stream"},{id:"safety",label:"Safety Scores"},{id:"growth",label:"Growth Tracker"},{id:"risk",label:"Cut Risk"}];
    return<div className="ta-page-pad" style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 32px 60px",maxWidth:960}}>
      {/* Header */}
      <div style={{padding:isMobile?"16px 0 12px":"28px 0 20px"}}>
        <h1 style={{margin:0,fontSize:isMobile?24:26,fontWeight:isThesis?800:400,color:K.txt,fontFamily:fh,letterSpacing:isThesis?"-0.5px":"normal"}}>Dividend Hub</h1>
        <p style={{margin:"6px 0 0",fontSize:14,color:K.dim}}>Income analytics for your dividend portfolio</p></div>
      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:12,marginBottom:24}}>
        {[{l:"ANNUAL INCOME",v:"$"+totalAnnual.toFixed(0),c:K.grn},{l:"MONTHLY AVG",v:"$"+monthlyAvg.toFixed(0),c:K.grn},{l:"PORTFOLIO YIELD",v:portfolioYield.toFixed(2)+"%",c:K.acc},{l:"DAILY INCOME",v:"$"+(totalAnnual/365).toFixed(2),c:K.grn},{l:"PAYERS",v:divPayers.length+"/"+portfolio.length,c:K.txt}].map(function(card){return<div key={card.l} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}><div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>{card.l}</div><div style={{fontSize:22,fontWeight:700,color:card.c,fontFamily:fm}}>{card.v}</div></div>})}
      </div>
      {/* Tab bar */}
      <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid "+K.bdr,paddingBottom:0}}>
        {tabs.map(function(t){var active=divTab===t.id;return<button key={t.id} onClick={function(){setDivTab(t.id)}} style={{padding:"8px 16px",background:"none",border:"none",borderBottom:"2px solid "+(active?K.acc:"transparent"),color:active?K.acc:K.dim,fontSize:13,cursor:"pointer",fontFamily:fm,fontWeight:active?700:400,marginBottom:-1,transition:"all .15s"}}>{t.label}{t.id==="risk"&&atRisk.length>0&&<span style={{marginLeft:5,background:K.red,color:"#fff",borderRadius:999,fontSize:10,padding:"1px 6px",fontWeight:700}}>{atRisk.length}</span>}</button>})}
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {divTab==="overview"&&(function(){
        var upcoming2=divPayers.filter(function(c){if(!c.exDivDate)return false;var ed=new Date(c.exDivDate);var now2=new Date();var freq=c.divFrequency;while(ed<now2){if(freq==="monthly")ed.setMonth(ed.getMonth()+1);else if(freq==="semi")ed.setMonth(ed.getMonth()+6);else if(freq==="annual")ed.setFullYear(ed.getFullYear()+1);else ed.setMonth(ed.getMonth()+3)}c._nextExDiv=ed.toISOString().split("T")[0];return Math.ceil((ed-now2)/864e5)<=60}).sort(function(a,b){return a._nextExDiv>b._nextExDiv?1:-1});
        return<div>
          {upcoming2.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:10,fontFamily:fm,fontWeight:600}}>Upcoming Ex-Dividend Dates</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {upcoming2.slice(0,8).map(function(c){var dU2=Math.ceil((new Date(c._nextExDiv)-new Date())/864e5);var pos=c.position||{};var payout=(pos.shares||0)*(c.divPerShare||c.lastDiv||0);
                return<div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:dU2<=7?K.amb+"08":K.bg,borderRadius:8,border:"1px solid "+(dU2<=7?K.amb+"25":K.bdr),cursor:"pointer"}} onClick={function(){setSelId(c.id);setPage("dashboard")}}>
                  <CoLogo domain={c.domain} ticker={c.ticker} size={18}/>
                  <div><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</div>
                    <div style={{fontSize:10,color:dU2<=7?K.amb:K.dim,fontFamily:fm}}>{fD(c._nextExDiv)}{dU2<=30?" ("+dU2+"d)":""}</div></div>
                  {payout>0&&<div style={{fontSize:12,color:K.grn,fontFamily:fm,fontWeight:600}}>${payout.toFixed(0)}</div>}
                </div>})}
            </div></div>}
          {/* Payers table */}
          {divPayers.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:14,fontFamily:fm,fontWeight:600}}>Dividend Payers</div>
            <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{borderBottom:"1px solid "+K.bdr}}>
                {["Company","Price","Per Pmt","Freq","Yield","YoC","Annual $","Income","Safety","Next Ex-Div"].map(function(h,hi){return<th key={h} style={{textAlign:hi<=1||hi===3?"left":"right",padding:"8px 10px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600,whiteSpace:"nowrap",display:isMobile&&(hi===5||hi===9)?"none":""}}>{h}</th>})}
              </tr></thead>
              <tbody>{divPayers.map(function(c){
                var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
                var annDps=dps*mult;var yld=pos.currentPrice?annDps/pos.currentPrice*100:0;var yoc=pos.avgCost>0?annDps/pos.avgCost*100:0;var annIncome=(pos.shares||0)*annDps;
                var nextExDiv="";if(c.exDivDate){var ed2=new Date(c.exDivDate);var now3=new Date();while(ed2<now3){if(c.divFrequency==="monthly")ed2.setMonth(ed2.getMonth()+1);else if(c.divFrequency==="semi")ed2.setMonth(ed2.getMonth()+6);else if(c.divFrequency==="annual")ed2.setFullYear(ed2.getFullYear()+1);else ed2.setMonth(ed2.getMonth()+3)}nextExDiv=ed2.toISOString().split("T")[0]}
                var daysToEx=nextExDiv?Math.ceil((new Date(nextExDiv)-new Date())/864e5):-1;
                var ss=calcSafetyScore(c);
                return<tr key={c.id} style={{borderBottom:"1px solid "+K.bdr+"60",cursor:"pointer"}} onClick={function(){setSelId(c.id);setPage("dashboard");setSubPage(null)}}>
                  <td style={{padding:"10px 10px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><CoLogo domain={c.domain} ticker={c.ticker} size={20}/><div><div style={{fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:11,color:K.dim}}>{c.name}</div></div></div></td>
                  <td style={{textAlign:"right",padding:"10px 10px",color:K.mid,fontFamily:fm,fontSize:12}}>{pos.currentPrice>0?cSym+pos.currentPrice.toFixed(2):"\u2014"}</td>
                  <td style={{textAlign:"right",padding:"10px 10px",color:K.txt,fontFamily:fm}}>${dps.toFixed(2)}</td>
                  <td style={{textAlign:"left",padding:"10px 10px",color:K.mid,fontFamily:fm,fontSize:11}}>{freqLabel(c.divFrequency)}</td>
                  <td style={{textAlign:"right",padding:"10px 10px",color:K.grn,fontWeight:600,fontFamily:fm}}>{yld.toFixed(2)}%</td>
                  <td style={{textAlign:"right",padding:"10px 10px",color:yoc>yld?K.grn:K.dim,fontFamily:fm,fontSize:12,display:isMobile?"none":""}}>{yoc>0?yoc.toFixed(2)+"%":"\u2014"}</td>
                  <td style={{textAlign:"right",padding:"10px 10px",color:K.txt,fontFamily:fm}}>${annDps.toFixed(2)}</td>
                  <td style={{textAlign:"right",padding:"10px 10px",color:K.grn,fontWeight:600,fontFamily:fm}}>{pos.shares>0?"$"+annIncome.toFixed(0):<span style={{color:K.dim,fontSize:11}}>Add shares</span>}</td>
                  <td style={{textAlign:"right",padding:"10px 10px"}}>{ss.score!==null?<span style={{fontSize:12,fontWeight:700,color:ss.color,fontFamily:fm}}>{ss.score}/10</span>:<span style={{fontSize:11,color:K.dim}}>-</span>}</td>
                  <td style={{textAlign:"right",padding:"10px 10px",fontFamily:fm,fontSize:12,color:daysToEx>=0&&daysToEx<=14?K.amb:K.dim,display:isMobile?"none":""}}>{nextExDiv?fD(nextExDiv)+(daysToEx>=0&&daysToEx<=30?" ("+daysToEx+"d)":""):"\u2014"}</td>
                </tr>})}
              </tbody>
            </table></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 10px 0",borderTop:"2px solid "+K.bdr,marginTop:4}}>
              <span style={{fontSize:14,color:K.mid,fontWeight:500}}>Total Annual Income</span>
              <span style={{fontSize:16,fontWeight:700,color:K.grn,fontFamily:fm}}>${totalAnnual.toFixed(0)}</span></div>
          </div>}
          {nonPayers.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px"}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:10,fontFamily:fm,fontWeight:600}}>Non-Dividend Holdings ({nonPayers.length})</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{nonPayers.map(function(c){return<div key={c.id} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",background:K.bg,borderRadius:6,cursor:"pointer"}} onClick={function(){setSelId(c.id);setPage("dashboard");setSubPage(null)}}><CoLogo domain={c.domain} ticker={c.ticker} size={16}/><span style={{fontSize:12,color:K.mid,fontFamily:fm}}>{c.ticker}</span></div>})}</div>
          </div>}
          {divPayers.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:K.dim}}>
            <div style={{fontSize:36,marginBottom:12}}>{String.fromCodePoint(0x1F4B0)}</div>
            <div style={{fontSize:14,marginBottom:6}}>No dividend data yet</div>
            <div style={{fontSize:13,maxWidth:400,margin:"0 auto",lineHeight:1.6}}>Dividend data is fetched automatically when you add companies. If your holdings pay dividends, they'll appear here.</div>
            {portfolio.length>0&&<button onClick={function(){refreshPrices();showToast("Refreshing..","info",2000)}} style={Object.assign({},S.btnP,{padding:"10px 24px",fontSize:13,marginTop:16})}>Refresh</button>}
          </div>}
        </div>})()}

      {/* ── TAB: INCOME STREAM ── */}
      {divTab==="income"&&(function(){
        var nowMonth=new Date().getMonth();
        return<div>
          {/* Stacked bar chart */}
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"24px",marginBottom:20}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:4,fontFamily:fm,fontWeight:600}}>Monthly Income Stream</div>
            <div style={{fontSize:13,color:K.dim,marginBottom:20}}>Hover a month to see which holdings pay</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:isMobile?4:8,alignItems:"flex-end",height:160,marginBottom:8}}>
              {monthlyBreakdown.map(function(m){
                var isNow=m.idx===nowMonth;var isHov=hovMonth===m.idx;var barH=m.income>0?Math.max(10,Math.round(m.income/maxMonthlyIncome*130)):3;
                return<div key={m.idx} style={{display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",height:"100%",justifyContent:"flex-end"}} onMouseEnter={function(){setHovMonth(m.idx)}} onMouseLeave={function(){setHovMonth(null)}}>
                  {(isHov||isNow)&&m.income>0&&<div style={{fontSize:isMobile?8:11,color:K.grn,fontFamily:fm,marginBottom:2,fontWeight:600}}>{cSym}{m.income.toFixed(0)}</div>}
                  <div style={{width:"100%",height:barH,borderRadius:"3px 3px 0 0",overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"flex-end",opacity:isHov?1:0.8,transition:"opacity .15s",outline:isNow?"2px solid "+K.acc:"none",outlineOffset:2}}>
                    {m.payers.length>0?m.payers.map(function(p,pi){var h=Math.round(p.amount/m.income*barH);return<div key={p.ticker} style={{width:"100%",height:Math.max(1,h),background:p.color,flexShrink:0}}/>}):<div style={{width:"100%",height:barH,background:K.bdr}}/>}
                  </div>
                </div>})}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:isMobile?4:8}}>
              {monthlyBreakdown.map(function(m){var isNow=m.idx===nowMonth;return<div key={m.idx} style={{textAlign:"center",fontSize:isMobile?8:11,color:isNow?K.acc:K.dim,fontWeight:isNow?700:400,fontFamily:fm}}>{m.month}</div>})}
            </div>
            {/* Hover detail */}
            {hovMonth!==null&&monthlyBreakdown[hovMonth].income>0&&<div style={{marginTop:16,padding:"12px 16px",background:K.bg,borderRadius:10,border:"1px solid "+K.bdr}}>
              <div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,marginBottom:8}}>{monthNames[hovMonth]} — {cSym}{monthlyBreakdown[hovMonth].income.toFixed(0)} total</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {monthlyBreakdown[hovMonth].payers.map(function(p){return<div key={p.ticker} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",background:p.color+"15",borderRadius:999,border:"1px solid "+p.color+"30"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
                  <span style={{fontSize:12,fontWeight:600,color:p.color,fontFamily:fm}}>{p.ticker}</span>
                  <span style={{fontSize:12,color:K.dim,fontFamily:fm}}>${p.amount.toFixed(0)}</span>
                </div>})}
              </div>
            </div>}
            {hovMonth!==null&&monthlyBreakdown[hovMonth].income===0&&<div style={{marginTop:12,padding:"10px 14px",background:K.bg,borderRadius:8,border:"1px solid "+K.bdr}}>
              <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>{monthNames[hovMonth]} — no income scheduled</div>
            </div>}
          </div>
          {/* Legend */}
          {divPayers.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:12,fontFamily:fm,fontWeight:600}}>Payer Legend</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
              {divPayers.map(function(c){var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;var ann=(pos.shares||0)*dps*mult;var col=tickerColorMap[c.ticker];
                return<div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:col+"08",borderRadius:8,border:"1px solid "+col+"25"}}>
                  <div style={{width:10,height:10,borderRadius:2,background:col,flexShrink:0}}/>
                  <CoLogo domain={c.domain} ticker={c.ticker} size={16}/>
                  <div><div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</div>
                    <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{freqLabel(c.divFrequency)} · ${ann.toFixed(0)}/yr</div></div>
                </div>})}
            </div>
          </div>}
          {/* Cadence guide */}
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:14,fontFamily:fm,fontWeight:600}}>Payment Cadence by Holding</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {divPayers.map(function(c){var payMonths=estimatePayMonths(c);var col=tickerColorMap[c.ticker];
                return<div key={c.id} style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,width:isMobile?60:90,flexShrink:0}}>
                    <CoLogo domain={c.domain} ticker={c.ticker} size={16}/>
                    <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:3,flex:1}}>
                    {monthNames.map(function(mn,mi){var pays=payMonths.indexOf(mi)>=0;return<div key={mi} style={{height:18,borderRadius:3,background:pays?col:K.bdr+"30",display:"flex",alignItems:"center",justifyContent:"center"}} title={pays?mn+" — "+c.ticker+" pays":mn}>
                      {pays&&!isMobile&&<span style={{fontSize:7,color:"#fff",fontWeight:700}}>{mn.charAt(0)}</span>}
                    </div>})}
                  </div>
                </div>})}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:3,marginTop:4,paddingLeft:isMobile?66:102}}>
              {monthNames.map(function(mn,mi){return<div key={mi} style={{textAlign:"center",fontSize:8,color:mi===new Date().getMonth()?K.acc:K.dim,fontFamily:fm,fontWeight:mi===new Date().getMonth()?700:400}}>{mn.charAt(0)}</div>})}
            </div>
          </div>
        </div>})()}

      {/* ── TAB: SAFETY SCORES ── */}
      {divTab==="safety"&&(function(){
        var sorted=safetyScores.slice().sort(function(a,b){return(b.s.score||0)-(a.s.score||0)});
        return<div>
          {sorted.map(function(x){var c=x.c;var ss=x.s;if(ss.score===null)return null;
            var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;var yld=pos.currentPrice?dps*mult/pos.currentPrice*100:0;
            return<div key={c.id} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:16,marginBottom:16}}>
                <CoLogo domain={c.domain} ticker={c.ticker} size={28}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</span>
                    <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.name}</span>
                    <span style={{fontSize:12,color:K.grn,fontFamily:fm}}>{yld.toFixed(2)}% yield</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    {/* Score bar */}
                    <div style={{flex:1,height:8,background:K.bdr,borderRadius:999,overflow:"hidden"}}>
                      <div style={{height:"100%",width:(ss.score/10*100)+"%",background:ss.color,borderRadius:999,transition:"width .4s"}}/>
                    </div>
                    <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                      <span style={{fontSize:22,fontWeight:800,color:ss.color,fontFamily:fm}}>{ss.score}</span>
                      <span style={{fontSize:13,color:K.dim,fontFamily:fm}}>/10</span>
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:ss.color,background:ss.color+"15",padding:"2px 10px",borderRadius:999,fontFamily:fm}}>{ss.label}</span>
                  </div>
                </div>
              </div>
              {/* Component breakdown */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
                {ss.components.map(function(comp){var pct=comp.pts/comp.max;var col=pct>=0.67?K.grn:pct>=0.34?K.amb:K.red;
                  return<div key={comp.label} style={{background:K.bg,borderRadius:8,padding:"10px 12px",border:"1px solid "+col+"25"}} title={comp.tip}>
                    <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4,letterSpacing:.3,lineHeight:1.3}}>{comp.label}</div>
                    <div style={{fontSize:13,fontWeight:700,color:col,fontFamily:fm,lineHeight:1.3}}>{comp.value}</div>
                    <div style={{display:"flex",gap:2,marginTop:6}}>
                      {Array.from({length:comp.max}).map(function(_,i){return<div key={i} style={{flex:1,height:3,borderRadius:999,background:i<comp.pts?col:K.bdr}}/>})}
                    </div>
                  </div>})}
              </div>
            </div>})}
          {safetyScores.every(function(x){return x.s.score===null})&&<div style={{textAlign:"center",padding:"40px 0",color:K.dim,fontSize:13}}>No financial data available yet. Refresh your company data to populate safety scores.</div>}
        </div>})()}

      {/* ── TAB: GROWTH TRACKER ── */}
      {divTab==="growth"&&(function(){
        var growthData=divPayers.map(function(c){return Object.assign({c:c},getGrowthMetrics(c))}).sort(function(a,b){return(b.divGr||b.revGr||0)-(a.divGr||a.revGr||0)});
        return<div>
          {/* 3yr income projection summary */}
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:12,fontFamily:fm,fontWeight:600}}>Income Projection (3 Years)</div>
            <div style={{display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
              <div><div style={{fontSize:12,color:K.dim,marginBottom:4}}>Today's annual income</div><div style={{fontSize:24,fontWeight:800,color:K.txt,fontFamily:fm}}>${totalAnnual.toFixed(0)}</div></div>
              <div style={{fontSize:20,color:K.dim}}>→</div>
              <div><div style={{fontSize:12,color:K.dim,marginBottom:4}}>Projected in 3 years</div><div style={{fontSize:24,fontWeight:800,color:K.grn,fontFamily:fm}}>${totalProj3yr.toFixed(0)}</div></div>
              {totalProj3yr>totalAnnual&&<div style={{background:K.grn+"12",border:"1px solid "+K.grn+"30",borderRadius:8,padding:"8px 14px"}}>
                <div style={{fontSize:12,color:K.grn,fontFamily:fm,fontWeight:600}}>+${(totalProj3yr-totalAnnual).toFixed(0)} / yr</div>
                <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>if growth rates hold</div>
              </div>}
            </div>
          </div>
          {/* Per holding */}
          {growthData.map(function(gd){var c=gd.c;var pos=c.position||{};
            var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
            var yld=pos.currentPrice?dps*mult/pos.currentPrice*100:0;
            var hasGrowthData=gd.divGr!==null||gd.revGr!==null;
            return<div key={c.id} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
                <span style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm,width:60}}>{c.ticker}</span>
                <span style={{fontSize:12,color:K.dim,flex:1}}>{c.name}</span>
                <span style={{fontSize:12,color:K.grn,fontFamily:fm}}>{yld.toFixed(2)}% yield</span>
                <span style={{fontSize:12,color:K.dim,fontFamily:fm}}>{freqLabel(c.divFrequency)}</span>
              </div>
              {hasGrowthData&&<div style={{display:"flex",gap:16,marginTop:14,flexWrap:"wrap"}}>
                {gd.divGr!==null&&<div style={{background:K.bg,borderRadius:8,padding:"10px 16px",border:"1px solid "+K.bdr}}>
                  <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:3}}>DIV GROWTH YoY</div>
                  <div style={{fontSize:16,fontWeight:700,color:gd.divGr>0?K.grn:K.red,fontFamily:fm}}>{gd.divGr>=0?"+":""}{gd.divGr.toFixed(1)}%</div>
                </div>}
                {gd.revGr!==null&&<div style={{background:K.bg,borderRadius:8,padding:"10px 16px",border:"1px solid "+K.bdr}}>
                  <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:3}}>REVENUE GROWTH</div>
                  <div style={{fontSize:16,fontWeight:700,color:gd.revGr>0?K.grn:K.red,fontFamily:fm}}>{gd.revGr>=0?"+":""}{gd.revGr.toFixed(1)}%</div>
                </div>}
                {gd.annIncome>0&&<div style={{background:K.bg,borderRadius:8,padding:"10px 16px",border:"1px solid "+K.bdr}}>
                  <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:3}}>YOUR ANNUAL INCOME</div>
                  <div style={{fontSize:16,fontWeight:700,color:K.txt,fontFamily:fm}}>${gd.annIncome.toFixed(0)}</div>
                </div>}
                {gd.proj3yr!==null&&gd.annIncome>0&&<div style={{background:K.grn+"08",borderRadius:8,padding:"10px 16px",border:"1px solid "+K.grn+"20"}}>
                  <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:3}}>PROJECTED IN 3 YRS</div>
                  <div style={{fontSize:16,fontWeight:700,color:K.grn,fontFamily:fm}}>${gd.proj3yr.toFixed(0)}</div>
                  <div style={{fontSize:10,color:K.grn,fontFamily:fm}}>+${(gd.proj3yr-gd.annIncome).toFixed(0)}</div>
                </div>}
              </div>}
              {!hasGrowthData&&<div style={{fontSize:12,color:K.dim,marginTop:8,fontFamily:fm}}>No growth data available — refresh financial data.</div>}
            </div>})}
        </div>})()}

      {/* ── TAB: CUT RISK ── */}
      {divTab==="risk"&&(function(){
        return<div>
          {atRisk.length===0&&cautious.length===0&&divPayers.length>0&&<div style={{background:K.grn+"08",border:"1px solid "+K.grn+"25",borderRadius:12,padding:"24px",textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:28,marginBottom:8}}>✓</div>
            <div style={{fontSize:14,fontWeight:600,color:K.grn,marginBottom:6}}>All dividends look safe</div>
            <div style={{fontSize:13,color:K.dim,maxWidth:400,margin:"0 auto",lineHeight:1.6}}>No holdings are showing red flags for a dividend cut based on available financial data.</div>
          </div>}
          {atRisk.length>0&&<div style={{marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:K.red}}/>
              <span style={{fontSize:12,fontWeight:700,color:K.red,fontFamily:fm,letterSpacing:.5}}>AT RISK — Safety score ≤ 4/10</span>
            </div>
            {atRisk.map(function(x){var c=x.c;var ss=x.s;var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;var yld=pos.currentPrice?dps*mult/pos.currentPrice*100:0;
              var warnings=ss.components.filter(function(cp){return cp.pts===0});
              return<div key={c.id} style={{background:K.red+"06",border:"1px solid "+K.red+"30",borderRadius:12,padding:"16px 20px",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <CoLogo domain={c.domain} ticker={c.ticker} size={24}/>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:11,color:K.dim}}>{c.name}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:800,color:K.red,fontFamily:fm}}>{ss.score}/10</div><div style={{fontSize:11,color:K.grn,fontFamily:fm}}>{yld.toFixed(2)}% yield</div></div>
                </div>
                {warnings.length>0&&<div style={{background:K.red+"08",borderRadius:8,padding:"10px 14px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:K.red,fontFamily:fm,marginBottom:6,letterSpacing:.5}}>RISK FACTORS</div>
                  {warnings.map(function(w){return<div key={w.label} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:4}}>
                    <span style={{color:K.red,fontSize:13,flexShrink:0}}>•</span>
                    <span style={{fontSize:12,color:K.mid,fontFamily:fm}}><strong>{w.label}:</strong> {w.value} — {w.tip}</span>
                  </div>})}
                </div>}
              </div>})}
          </div>}
          {cautious.length>0&&<div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:K.amb}}/>
              <span style={{fontSize:12,fontWeight:700,color:K.amb,fontFamily:fm,letterSpacing:.5}}>WATCH CLOSELY — Safety score 5–6/10</span>
            </div>
            {cautious.map(function(x){var c=x.c;var ss=x.s;var pos=c.position||{};var dps=c.divPerShare||c.lastDiv||0;var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;var yld=pos.currentPrice?dps*mult/pos.currentPrice*100:0;
              return<div key={c.id} style={{background:K.amb+"06",border:"1px solid "+K.amb+"30",borderRadius:12,padding:"16px 20px",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <CoLogo domain={c.domain} ticker={c.ticker} size={24}/>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:11,color:K.dim}}>{c.name}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:800,color:K.amb,fontFamily:fm}}>{ss.score}/10</div><div style={{fontSize:11,color:K.grn,fontFamily:fm}}>{yld.toFixed(2)}% yield</div></div>
                  <div style={{fontSize:12,fontWeight:700,color:K.amb,background:K.amb+"15",padding:"2px 10px",borderRadius:999,fontFamily:fm}}>{ss.label}</div>
                </div>
              </div>})}
          </div>}
          {divPayers.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:K.dim,fontSize:13}}>No dividend payers in your portfolio.</div>}
          <div style={{marginTop:20,padding:"14px 18px",background:K.bg,borderRadius:10,border:"1px solid "+K.bdr}}>
            <div style={{fontSize:11,fontWeight:600,color:K.dim,fontFamily:fm,marginBottom:6,letterSpacing:.5}}>HOW CUT RISK IS CALCULATED</div>
            <div style={{fontSize:12,color:K.dim,lineHeight:1.7}}>Based on 7 signals inspired by Simply Safe Dividends’ methodology: <strong>payout ratio</strong> (sector-adjusted — a REIT at 85% is safer than a retailer at 85%), <strong>FCF coverage</strong> (does free cash flow actually fund the dividend?), <strong>interest coverage</strong> (a company drowning in interest payments will sacrifice the dividend first), <strong>dividend longevity</strong> (a 20-year payer is far more committed than a 2-year payer), <strong>revenue growth</strong> (declining revenue precedes cuts), <strong>debt/equity</strong> (leverage headroom), and <strong>dividend growth trend</strong>. Each signal is scored and normalised to a 1–10 safety score.</div>
          </div>
        </div>})()}
    </div>}



  // ── Library ──────────────────────────────────────────────────
  function LibraryPage(){
    var lib=library;
    var _lf=useState(null),libFolder=_lf[0],setLibFolder=_lf[1];
    var _lm=useState(null),libModal=_lm[0],setLibModal=_lm[1];
    var _lsrch=useState(""),libSearch=_lsrch[0],setLibSearch=_lsrch[1];
    var _ltype=useState("all"),libTypeFilter=_ltype[0],setLibTypeFilter=_ltype[1];
    var _lplaying=useState(null),libPlaying=_lplaying[0],setLibPlaying=_lplaying[1];
    var FOLDER_COLORS=[K.acc,K.grn,K.amb,K.red,"#8B5CF6","#06B6D4","#EC4899","#14B8A6"];
    var ITEM_TYPES=["Video","Article","Book","Podcast","Course","Other"];
    function getYTId(url){if(!url)return null;var m=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/))([^&?#\s]{11})/);return m?m[1]:null}
    function getVimeoId(url){if(!url)return null;var m=url.match(/vimeo\.com\/(?:video\/)?(\d+)/);return m?m[1]:null}
    function getEmbedUrl(url){var yt=getYTId(url);if(yt)return"https://www.youtube.com/embed/"+yt+"?autoplay=1";var vi=getVimeoId(url);if(vi)return"https://player.vimeo.com/video/"+vi+"?autoplay=1";return null}
    function getThumb(url){var yt=getYTId(url);if(yt)return"https://img.youtube.com/vi/"+yt+"/hqdefault.jpg";return null}
    function isEmbeddable(url){return!!(getYTId(url)||getVimeoId(url))}
    var folders=lib.folders||[];
    var items=lib.items||[];
    var filtered=items.filter(function(it){
      var matchFolder=!libFolder||it.folder===libFolder;
      var matchType=libTypeFilter==="all"||it.type===libTypeFilter;
      var q=libSearch.toLowerCase();
      var matchSearch=!q||(it.title||"").toLowerCase().indexOf(q)>=0||(it.notes||"").toLowerCase().indexOf(q)>=0;
      return matchFolder&&matchType&&matchSearch});
    var totalByFolder={};items.forEach(function(it){totalByFolder[it.folder||""]=(totalByFolder[it.folder||""]||0)+1});
    // Edit modal form state
    function AddEditModal(){
      var isNew=!libModal.item;
      var def=libModal.item||{};
      var _t=useState(def.title||""),title=_t[0],setTitle=_t[1];
      var _u=useState(def.url||""),url=_u[0],setUrl=_u[1];
      var _tp=useState(def.type||"Video"),type=_tp[0],setType=_tp[1];
      var _fo=useState(def.folder||""),folder=_fo[0],setFolder=_fo[1];
      var _no=useState(def.notes||""),notes=_no[0],setNotes=_no[1];
      var _fn=useState(""),folderName=_fn[0],setFolderName=_fn[1];
      var _fc=useState(FOLDER_COLORS[folders.length%FOLDER_COLORS.length]),folderColor=_fc[0],setFolderColor=_fc[1];
      var _nf=useState(false),newFolderMode=_nf[0],setNewFolderMode=_nf[1];
      function save(){
        if(!title.trim())return showToast("Title is required","info",2000);
        var nextFolders=folders.slice();
        var useFolder=folder;
        if(newFolderMode&&folderName.trim()){
          var nf={id:"f"+Date.now(),name:folderName.trim(),color:folderColor};
          nextFolders.push(nf);useFolder=nf.id}
        var nextItems=items.slice();
        if(isNew){nextItems.unshift({id:"li"+Date.now(),title:title.trim(),url:url.trim(),type:type,folder:useFolder,notes:notes.trim(),addedAt:new Date().toISOString()})}
        else{nextItems=nextItems.map(function(it){return it.id===def.id?Object.assign({},it,{title:title.trim(),url:url.trim(),type:type,folder:useFolder,notes:notes.trim()}):it})}
        saveLibrary({folders:nextFolders,items:nextItems});setLibModal(null);showToast(isNew?"Resource added":"Resource updated","info",2000)}
      var thumb=getThumb(url);
      return<Modal K={K} title={isNew?"Add Resource":"Edit Resource"} onClose={function(){setLibModal(null)}} w={520}>
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:12,color:K.dim,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>Type</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{ITEM_TYPES.map(function(tp){return<button key={tp} onClick={function(){setType(tp)}} style={{padding:"6px 14px",borderRadius:999,border:"1px solid "+(type===tp?K.acc:K.bdr),background:type===tp?K.acc+"18":"transparent",color:type===tp?K.acc:K.mid,fontSize:12,cursor:"pointer",fontFamily:fm,fontWeight:type===tp?700:400}}>{tp}</button>})}</div>
        </div>
        <Inp K={K} label="Title" value={title} onChange={setTitle} placeholder="e.g. Howard Marks on Risk"/>
        <Inp K={K} label="URL (YouTube, Vimeo, article, etc.)" value={url} onChange={setUrl} placeholder="https://..."/>
        {thumb&&<div style={{borderRadius:8,overflow:"hidden",marginBottom:16,height:120,background:K.bg}}><img src={thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover",opacity:.85}}/></div>}
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:12,color:K.dim,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>Folder</label>
          {!newFolderMode&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
            <button onClick={function(){setFolder("")}} style={{padding:"6px 14px",borderRadius:999,border:"1px solid "+(folder===""?K.acc:K.bdr),background:folder===""?K.acc+"18":"transparent",color:folder===""?K.acc:K.mid,fontSize:12,cursor:"pointer",fontFamily:fm}}>None</button>
            {folders.map(function(f){return<button key={f.id} onClick={function(){setFolder(f.id)}} style={{padding:"6px 14px",borderRadius:999,border:"1px solid "+(folder===f.id?f.color:K.bdr),background:folder===f.id?f.color+"20":"transparent",color:folder===f.id?f.color:K.mid,fontSize:12,cursor:"pointer",fontFamily:fm,fontWeight:folder===f.id?700:400}}>{f.name}</button>})}
            <button onClick={function(){setNewFolderMode(true)}} style={{padding:"6px 14px",borderRadius:999,border:"1px dashed "+K.bdr,background:"transparent",color:K.dim,fontSize:12,cursor:"pointer",fontFamily:fm}}>+ New folder</button>
          </div>}
          {newFolderMode&&<div>
            <input value={folderName} onChange={function(e){setFolderName(e.target.value)}} placeholder="Folder name" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"10px 14px",fontSize:14,fontFamily:fm,outline:"none",marginBottom:8}}/>
            <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>{FOLDER_COLORS.map(function(c){return<div key={c} onClick={function(){setFolderColor(c)}} style={{width:22,height:22,borderRadius:"50%",background:c,cursor:"pointer",border:folderColor===c?"2px solid "+K.txt:"2px solid transparent"}}/>})}</div>
            <button onClick={function(){setNewFolderMode(false)}} style={{fontSize:12,color:K.dim,background:"none",border:"none",cursor:"pointer",fontFamily:fm}}>← Back to existing</button>
          </div>}
        </div>
        <Inp K={K} label="Notes (optional)" value={notes} onChange={setNotes} ta={true} placeholder="Key takeaways, why you saved this..."/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <button onClick={function(){setLibModal(null)}} style={Object.assign({},S.btn,{padding:"9px 20px"})}>Cancel</button>
          <button onClick={save} style={Object.assign({},S.btnP,{padding:"9px 24px"})}>{isNew?"Add":"Save"}</button>
        </div>
      </Modal>}
    function FolderModal(){
      var isNew=!libModal.folder;
      var def=libModal.folder||{};
      var _fn=useState(def.name||""),folderName=_fn[0],setFolderName=_fn[1];
      var _fc=useState(def.color||FOLDER_COLORS[folders.length%FOLDER_COLORS.length]),folderColor=_fc[0],setFolderColor=_fc[1];
      function save(){if(!folderName.trim())return;
        var nextFolders;
        if(isNew){nextFolders=folders.concat([{id:"f"+Date.now(),name:folderName.trim(),color:folderColor}])}
        else{nextFolders=folders.map(function(f){return f.id===def.id?Object.assign({},f,{name:folderName.trim(),color:folderColor}):f})}
        saveLibrary(Object.assign({},lib,{folders:nextFolders}));setLibModal(null);showToast(isNew?"Folder created":"Folder updated","info",1500)}
      function del(){if(!window.confirm("Delete this folder? Items in it will become unorganized."))return;
        var nextFolders=folders.filter(function(f){return f.id!==def.id});
        var nextItems=items.map(function(it){return it.folder===def.id?Object.assign({},it,{folder:""}):it});
        saveLibrary({folders:nextFolders,items:nextItems});setLibFolder(null);setLibModal(null)}
      return<Modal K={K} title={isNew?"New Folder":"Edit Folder"} onClose={function(){setLibModal(null)}} w={400}>
        <Inp K={K} label="Folder Name" value={folderName} onChange={setFolderName} placeholder="e.g. Mental Models"/>
        <div style={{marginBottom:20}}>
          <label style={{display:"block",fontSize:12,color:K.dim,marginBottom:8,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>Color</label>
          <div style={{display:"flex",gap:8}}>{FOLDER_COLORS.map(function(c){return<div key={c} onClick={function(){setFolderColor(c)}} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:folderColor===c?"3px solid "+K.txt:"3px solid transparent",transition:"border .15s"}}/>})}</div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          {!isNew&&<button onClick={del} style={Object.assign({},S.btnD,{padding:"9px 16px",marginRight:"auto"})}>Delete</button>}
          <button onClick={function(){setLibModal(null)}} style={Object.assign({},S.btn,{padding:"9px 20px"})}>Cancel</button>
          <button onClick={save} style={Object.assign({},S.btnP,{padding:"9px 24px"})}>{isNew?"Create":"Save"}</button>
        </div>
      </Modal>}
    function deleteItem(id){if(!window.confirm("Remove this resource?"))return;
      saveLibrary(Object.assign({},lib,{items:items.filter(function(it){return it.id!==id})}));
      if(libPlaying===id)setLibPlaying(null)}
    function ItemCard(p){var it=p.item;
      var thumb=getThumb(it.url);
      var canEmbed=isEmbeddable(it.url);
      var isPlaying=libPlaying===it.id;
      var embedUrl=getEmbedUrl(it.url);
      var fol=folders.find(function(f){return f.id===it.folder});
      var typeColors={Video:K.acc,Article:K.grn,Book:K.amb,Podcast:"#8B5CF6",Course:"#06B6D4",Other:K.dim};
      var tc=typeColors[it.type]||K.dim;
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isThesis?16:10,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {/* Thumbnail / player area */}
        {canEmbed&&<div style={{position:"relative",width:"100%",paddingTop:"56.25%",background:K.bg,cursor:isPlaying?"default":"pointer"}} onClick={function(){if(!isPlaying)setLibPlaying(it.id)}}>
          {isPlaying&&embedUrl?<iframe src={embedUrl} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}} allowFullScreen allow="autoplay; encrypted-media"/>
          :<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:K.bg}}>
            {thumb&&<img src={thumb} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.6}}/>}
            <div style={{position:"relative",width:44,height:44,borderRadius:"50%",background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
            </div>
          </div>}
        </div>}
        {!canEmbed&&it.url&&<div style={{height:80,background:tc+"10",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}} onClick={function(){window.open(it.url,"_blank")}}>
          <IC name={it.type==="Video"?"video":it.type==="Article"||it.type==="Book"?"file":it.type==="Podcast"?"news":"link"} size={28} color={tc}/>
        </div>}
        {/* Card body */}
        <div style={{padding:"12px 14px",flex:1,display:"flex",flexDirection:"column",gap:6}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:K.txt,fontFamily:fm,lineHeight:1.4,marginBottom:4}}>{it.title}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:10,fontWeight:700,color:tc,background:tc+"15",padding:"2px 8px",borderRadius:999,fontFamily:fm,letterSpacing:.5}}>{it.type}</span>
                {fol&&<span style={{fontSize:10,color:fol.color,background:fol.color+"15",padding:"2px 8px",borderRadius:999,fontFamily:fm}}>{fol.name}</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              {it.url&&!canEmbed&&<button onClick={function(){window.open(it.url,"_blank")}} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:K.dim}} title="Open link"><IC name="link" size={13} color={K.dim}/></button>}
              <button onClick={function(){setLibModal({type:"item",item:it})}} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:K.dim}} title="Edit"><IC name="edit" size={13} color={K.dim}/></button>
              <button onClick={function(){deleteItem(it.id)}} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:K.dim}} title="Remove"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
            </div>
          </div>
          {it.notes&&<p style={{margin:0,fontSize:12,color:K.dim,lineHeight:1.5,fontFamily:fm}}>{it.notes}</p>}
          {it.addedAt&&<div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:"auto",paddingTop:4}}>{fD(it.addedAt.split("T")[0])}</div>}
        </div>
      </div>}
    var allCount=items.length;
    return<div style={{padding:isMobile?"0 16px 80px":_isThesis?"0 40px 80px":"0 32px 60px",maxWidth:1100}}>
      {/* Header */}
      <div style={{padding:isMobile?"16px 0 12px":"28px 0 20px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:isMobile?24:26,fontWeight:_isThesis?800:400,color:K.txt,fontFamily:fh,letterSpacing:_isThesis?"-0.5px":"normal"}}>Library</h1>
          <p style={{margin:"6px 0 0",fontSize:14,color:K.dim}}>Videos, articles, and resources that shape your thinking</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={function(){setLibModal({type:"folder"})}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:13,display:"flex",alignItems:"center",gap:6})}><IC name="folder" size={13} color={K.mid}/>New Folder</button>
          <button onClick={function(){setLibModal({type:"item"})}} style={Object.assign({},S.btnP,{padding:"9px 18px",fontSize:13,display:"flex",alignItems:"center",gap:6})}><IC name="plus" size={13} color={K.primTxt}/>Add Resource</button>
        </div>
      </div>
      {/* Search + type filter */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:1,minWidth:180,maxWidth:300}}>
          <IC name="search" size={13} color={K.dim} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",flexShrink:0}}/>
          <input value={libSearch} onChange={function(e){setLibSearch(e.target.value)}} placeholder="Search..." style={{width:"100%",boxSizing:"border-box",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isThesis?12:8,color:K.txt,padding:"9px 12px 9px 34px",fontSize:13,fontFamily:fm,outline:"none"}}/>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["all"].concat(ITEM_TYPES).map(function(tp){return<button key={tp} onClick={function(){setLibTypeFilter(tp)}} style={{padding:"6px 14px",borderRadius:999,border:"1px solid "+(libTypeFilter===tp?K.acc:K.bdr),background:libTypeFilter===tp?K.acc+"18":"transparent",color:libTypeFilter===tp?K.acc:K.mid,fontSize:12,cursor:"pointer",fontFamily:fm,fontWeight:libTypeFilter===tp?700:400}}>{tp==="all"?"All Types":tp}</button>})}
        </div>
      </div>
      {/* Folders row */}
      {folders.length>0&&<div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={function(){setLibFolder(null)}} style={{padding:"7px 16px",borderRadius:999,border:"1px solid "+(libFolder===null?K.acc:K.bdr),background:libFolder===null?K.acc+"18":"transparent",color:libFolder===null?K.acc:K.mid,fontSize:13,cursor:"pointer",fontFamily:fm,fontWeight:libFolder===null?700:400,display:"flex",alignItems:"center",gap:6}}>
          <IC name="overview" size={12} color={libFolder===null?K.acc:K.mid}/>All <span style={{fontSize:11,opacity:.7}}>({allCount})</span>
        </button>
        {folders.map(function(f){var cnt=totalByFolder[f.id]||0;var isActiveFol=libFolder===f.id;
          return<div key={f.id} style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
            <button onClick={function(){setLibFolder(isActiveFol?null:f.id)}} style={{padding:"7px "+(isActiveFol?"30px":"16px")+" 7px 16px",borderRadius:999,border:"1px solid "+(isActiveFol?f.color:K.bdr),background:isActiveFol?f.color+"18":"transparent",color:isActiveFol?f.color:K.mid,fontSize:13,cursor:"pointer",fontFamily:fm,fontWeight:isActiveFol?700:400,display:"flex",alignItems:"center",gap:6,transition:"padding .1s"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:f.color,flexShrink:0}}/>
              {f.name} <span style={{fontSize:11,opacity:.7}}>({cnt})</span>
            </button>
            {isActiveFol&&<button onClick={function(e){e.stopPropagation();setLibModal({type:"folder",folder:f})}} style={{position:"absolute",right:8,background:"none",border:"none",cursor:"pointer",padding:2,color:f.color,opacity:.75,display:"flex",alignItems:"center"}} title="Edit or delete folder">
              <IC name="edit" size={10} color={f.color}/>
            </button>}
          </div>})}
      </div>}
      {/* Items grid */}
      {filtered.length>0&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":_isThesis?"repeat(auto-fill, minmax(280px,1fr))":"repeat(auto-fill, minmax(260px,1fr))",gap:_isThesis?20:16}}>
        {filtered.map(function(it){return<ItemCard key={it.id} item={it}/>})}
      </div>}
      {/* Empty state */}
      {items.length===0&&<div style={{textAlign:"center",padding:"80px 0",color:K.dim}}>
        <IC name="video" size={40} color={K.bdr} style={{display:"block",margin:"0 auto 16px"}}/>
        <div style={{fontSize:16,fontWeight:600,color:K.mid,marginBottom:8}}>Your library is empty</div>
        <div style={{fontSize:14,maxWidth:400,margin:"0 auto 24px",lineHeight:1.7}}>Save videos, articles, books, and podcasts that shape your investment thinking. Organize them in folders like "Mental Models", "Valuation", or "Sector Research".</div>
        <button onClick={function(){setLibModal({type:"item"})}} style={Object.assign({},S.btnP,{padding:"11px 28px"})}>Add Your First Resource</button>
      </div>}
      {filtered.length===0&&items.length>0&&<div style={{textAlign:"center",padding:"60px 0",color:K.dim}}>
        <div style={{fontSize:14,marginBottom:8}}>No resources match your filters</div>
        <button onClick={function(){setLibSearch("");setLibFolder(null);setLibTypeFilter("all")}} style={{background:"none",border:"none",color:K.acc,cursor:"pointer",fontSize:14,fontFamily:fm}}>Clear filters</button>
      </div>}
      {/* Modals */}
      {libModal&&libModal.type==="item"&&<AddEditModal/>}
      {libModal&&libModal.type==="folder"&&<FolderModal/>}
    </div>}

  // ── Earnings Calendar ──────────────────────────────────────
  function EarningsCalendar(){
    var allCos=cos.filter(function(c){return c.status==="portfolio"||c.status==="watchlist"});
    var upcoming=allCos.filter(function(c){return c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)>=0}).sort(function(a,b){return a.earningsDate>b.earningsDate?1:-1});
    var recent=allCos.filter(function(c){return c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)<0&&dU(c.earningsDate)>=-30}).sort(function(a,b){return b.earningsDate>a.earningsDate?-1:1});
    var tbdCos=allCos.filter(function(c){return!c.earningsDate||c.earningsDate==="TBD"});
    return<div className="ta-page-pad" style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 32px 60px",maxWidth:900}}>
      <div style={{padding:isMobile?"16px 0 12px":"28px 0 20px"}}><h1 style={{margin:0,fontSize:isMobile?24:26,fontWeight:isThesis?800:400,color:K.txt,fontFamily:fh,letterSpacing:isThesis?"-0.5px":"normal"}}>Earnings Calendar</h1>
        <p style={{margin:"4px 0 0",fontSize:14,color:K.dim}}>{upcoming.length} upcoming · {recent.length} recent · {tbdCos.length} TBD</p></div>
      {/* This week */}
      {function(){var thisWeek=upcoming.filter(function(c){return dU(c.earningsDate)<=7});
        if(!thisWeek.length)return null;
        return<div style={{marginBottom:24}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:K.amb,marginBottom:10,fontFamily:fm,fontWeight:600}}>This Week</div>
          {thisWeek.map(function(c){var d=dU(c.earningsDate);var h=gH(c.kpis);
            return<div key={c.id} className="ta-card" style={{background:K.card,border:"1px solid "+K.amb+"30",borderLeft:"4px solid "+K.amb,borderRadius:12,padding:"14px 20px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:14}} onClick={function(){setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}>
              <CoLogo domain={c.domain} ticker={c.ticker} size={28}/>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker} <span style={{fontWeight:400,color:K.mid}}>{c.name}</span></div>
                <div style={{fontSize:12,color:K.dim,marginTop:2}}>{c.kpis.length} KPIs tracked · Conviction: {c.conviction||"—"}/10</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:K.amb,fontFamily:fm}}>{d===0?"Today":d===1?"Tomorrow":d+"d"}</div>
                <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{fD(c.earningsDate)} {c.earningsTime}</div></div>
              <span style={S.badge(h.c)}>{h.l}</span></div>})}</div>}()}
      {/* Upcoming (>7 days) */}
      {function(){var later=upcoming.filter(function(c){return dU(c.earningsDate)>7});
        if(!later.length)return null;
        return<div style={{marginBottom:24}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:10,fontFamily:fm,fontWeight:600}}>Upcoming</div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
            {later.map(function(c,i){var d=dU(c.earningsDate);
              return<div key={c.id} style={{padding:"12px 16px",borderBottom:i<later.length-1?"1px solid "+K.bdr:"none",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={function(){setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}>
                <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
                <div style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</span> <span style={{fontSize:12,color:K.dim}}>{c.name}</span></div>
                <span style={{fontSize:12,color:K.mid,fontFamily:fm}}>{fD(c.earningsDate)} {c.earningsTime}</span>
                <span style={{fontSize:11,color:K.dim,fontFamily:fm,minWidth:30,textAlign:"right"}}>{d}d</span></div>})}</div></div>}()}
      {/* Recently reported */}
      {recent.length>0&&<div style={{marginBottom:24}}>
        <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:10,fontFamily:fm,fontWeight:600}}>Recently Reported</div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden"}}>
          {recent.map(function(c,i){var h=gH(c.kpis);
            return<div key={c.id} style={{padding:"12px 16px",borderBottom:i<recent.length-1?"1px solid "+K.bdr:"none",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={function(){setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}>
              <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
              <div style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</span> <span style={{fontSize:12,color:K.dim}}>{c.name}</span></div>
              <span style={S.badge(h.c)}>{h.l}</span>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{fD(c.earningsDate)}</span></div>})}</div></div>}
      {tbdCos.length>0&&<div><div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:10,fontFamily:fm,fontWeight:600}}>Date Not Set ({tbdCos.length})</div>
        <div style={{fontSize:12,color:K.dim,lineHeight:1.6}}>Earnings dates auto-update via Finnhub. These companies don't have a known upcoming date yet: {tbdCos.map(function(c){return c.ticker}).join(", ")}</div></div>}
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
          if(r&&!r.error){var nc={id:nId(cos.concat(res.filter(function(x){return x.ok}).map(function(x){return x.co}))),ticker:t,name:r.name,sector:r.sector||"",industry:r.industry||"",domain:r.domain||"",irUrl:r.irUrl||"",earningsDate:r.earningsDate||"TBD",earningsTime:r.earningsTime||"AMC",thesisNote:"",kpis:[],docs:[],earningsHistory:[],researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0,position:{shares:0,avgCost:0,currentPrice:r.price||0},conviction:0,convictionHistory:[],status:"watchlist",investStyle:"",lastDiv:r.lastDiv||0,divPerShare:r.lastDiv||0,divFrequency:"quarterly",exDivDate:"",lastChecked:null,notes:"",earningSummary:null,sourceUrl:null,sourceLabel:null,moatTypes:{},pricingPower:null,morningstarMoat:"",moatTrend:"",thesisVersions:[],thesisUpdatedAt:"",addedAt:new Date().toISOString()};
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
      <div style={{fontSize:13,color:K.dim,marginBottom:16,lineHeight:1.6}}>Paste tickers separated by commas, newlines, or semicolons. Each will be looked up via FMP and added to your Watchlist.</div>
      <textarea value={txt} onChange={function(e){setTxt(e.target.value)}} placeholder={"AAPL\nMSFT\nGOOG\nAMZN"} rows={5} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"12px",fontSize:14,fontFamily:fm,outline:"none",resize:"vertical",lineHeight:1.6}} disabled={importing}/>
      {tickers.length>0&&!importing&&<div style={{fontSize:12,color:K.acc,marginTop:8,fontFamily:fm}}>{tickers.length} new ticker{tickers.length>1?"s":""} found: {tickers.slice(0,15).join(", ")}{tickers.length>15?" +"+( tickers.length-15)+" more":""}</div>}
      {results.length>0&&<div style={{marginTop:12,maxHeight:160,overflowY:"auto"}}>{results.map(function(r){
        return<div key={r.ticker} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:12}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:r.ok?K.grn:K.red}}/>
          <span style={{fontWeight:600,color:K.txt,fontFamily:fm}}>{r.ticker}</span>
          <span style={{color:r.ok?K.mid:K.red}}>{r.ok?r.name:r.err}</span></div>})}</div>}
      {status&&<div style={{fontSize:12,color:K.acc,marginTop:8,fontFamily:fm}}>{status}</div>}
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
    return<div style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 60px":"0 32px 60px",maxWidth:1100}}>
    <div style={{padding:isThesis?"36px 0 20px":"28px 0 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isMobile?14:0}}>
        <div><h1 style={{margin:0,fontSize:isMobile?24:isThesis?32:26,fontWeight:isThesis||isMobile?900:400,color:K.txt,fontFamily:fh,letterSpacing:isThesis||isMobile?"-0.5px":"normal"}}>{sideTab==="portfolio"?"Portfolio":sideTab==="toohard"?"Too-Hard Pile":"Watchlist"}</h1><p style={{margin:"6px 0 0",fontSize:isMobile?13:14,color:K.dim}}>{filtered.length} companies{sideTab==="toohard"?" • Outside your circle of competence":priceLoading?" • Updating prices…":""}</p></div>
        {!isMobile&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={function(){if(requirePro("earnings"))toggleAutoNotify()}} style={{display:"flex",alignItems:"center",gap:6,background:autoNotify?K.grn+"15":"transparent",border:"1px solid "+(autoNotify?K.grn+"40":K.bdr),borderRadius:6,padding:"7px 14px",fontSize:12,color:autoNotify?K.grn:K.dim,cursor:"pointer",fontFamily:fm}} title={autoNotify?"Auto-check ON":"Click to enable"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={autoNotify?K.grn:"none"} stroke={autoNotify?K.grn:K.dim} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {autoNotify?"Auto-check ON":"Auto-check"}</button>
          {autoNotify&&<button onClick={toggleEmailNotify} style={{display:"flex",alignItems:"center",gap:5,background:emailNotify?K.blue+"15":"transparent",border:"1px solid "+(emailNotify?K.blue+"40":K.bdr),borderRadius:6,padding:"7px 12px",fontSize:12,color:emailNotify?K.blue:K.dim,cursor:"pointer",fontFamily:fm}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={emailNotify?K.blue:K.dim} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
            {emailNotify?"KPI Email ON":"+ KPI Email"}</button>}
          <button style={S.btnChk} onClick={function(){if(requirePro("earnings"))checkAll()}}>Check All</button>
          <button style={Object.assign({},S.btn,{padding:"9px 14px",fontSize:12})} onClick={function(){exportCSV(filtered)}}>CSV</button>
          <button style={Object.assign({},S.btnP,{padding:"9px 18px",fontSize:13})} onClick={function(){setModal({type:"add"})}}>+ Add</button></div>}
        {isMobile&&<button style={Object.assign({},S.btnP,{padding:"10px 22px",fontSize:14})} onClick={function(){setModal({type:"add"})}}>+ Add</button>}</div>
      {isMobile&&<div style={{display:"flex",gap:8,marginTop:4}}>
        <button onClick={function(){if(requirePro("earnings"))checkAll()}} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:K.acc+"15",border:"1px solid "+K.acc+"40",borderRadius:10,padding:"10px",fontSize:14,color:K.acc,cursor:"pointer",fontFamily:fm,fontWeight:600}}>Check All</button>
        <button onClick={function(){if(requirePro("earnings"))toggleAutoNotify()}} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:autoNotify?K.grn+"15":"transparent",border:"1px solid "+(autoNotify?K.grn+"40":K.bdr),borderRadius:10,padding:"10px",fontSize:14,color:autoNotify?K.grn:K.dim,cursor:"pointer",fontFamily:fm,fontWeight:600}}>
          {autoNotify?"Auto ON":"Auto-check"}</button></div>}</div>
        {xpFloat&&<div key={xpFloat.id} style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:9999,pointerEvents:"none",animation:"xpfloat 1.8s ease-out forwards"}}>
      <div style={{fontSize:28,fontWeight:800,color:K.grn,fontFamily:fm,textShadow:"0 2px 8px rgba(0,0,0,0.3)",display:"flex",alignItems:"center",gap:6}}>+{xpFloat.amount}
        <span style={{fontSize:13,fontWeight:400,color:K.mid}}>{xpFloat.label}</span></div></div>}
    <style dangerouslySetInnerHTML={{__html:"@keyframes xpfloat{0%{opacity:1;transform:translate(-50%,-50%) scale(0.8)}20%{opacity:1;transform:translate(-50%,-60%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-120%) scale(0.9)}}"}}/>
    {/* ── MORNING BRIEFING ── */}
    {sideTab==="portfolio"&&filtered.length>0&&(function(){
      var portfolio=filtered;var now=new Date();var hour=now.getHours();
      var greeting=hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
      // Portfolio value & change
      var held=portfolio.filter(function(c2){var p2=c2.position||{};return p2.shares>0&&p2.currentPrice>0});
      var totalVal=held.reduce(function(s,c2){return s+(c2.position.shares*c2.position.currentPrice)},0);
      var totalCost=held.reduce(function(s,c2){return s+(c2.position.shares*(c2.position.avgCost||c2.position.currentPrice))},0);
      var totalRet=totalCost>0?((totalVal-totalCost)/totalCost*100):0;
      // Notable movers (any holding with position data)
      var movers=held.filter(function(c2){return c2&&c2.position&&c2.position.currentPrice>0}).map(function(c2){var p2=c2.position||{};return{ticker:c2.ticker||"?",id:c2.id,ret:p2.avgCost>0?((p2.currentPrice-p2.avgCost)/p2.avgCost*100):0,price:p2.currentPrice||0,dayChg:c2._dayChangePct||0,hasPos:(p2.avgCost||0)>0}}).sort(function(a,b){return Math.abs(b.dayChg)-Math.abs(a.dayChg)});
      var topMover=movers[0];var worstMover=movers.length>1?movers[movers.length-1]:null;
      // Upcoming earnings
      var upcoming=portfolio.filter(function(c2){return c2.earningsDate&&c2.earningsDate!=="TBD"&&dU(c2.earningsDate)>=0&&dU(c2.earningsDate)<=7}).sort(function(a,b){return dU(a.earningsDate)-dU(b.earningsDate)});
      // Recent insider buys (from cached transactions)
      var insiderSignals=[];portfolio.forEach(function(c2){if(c2._insiderCache){var buys=c2._insiderCache.filter(function(t){return t.transactionType==="P"});if(buys.length>0)insiderSignals.push({ticker:c2.ticker,count:buys.length})}});
      // Pending actions
      var actions=[];
      if(!currentWeekReviewed)actions.push({icon:"shield",color:K.grn,text:"Weekly review due"+(streakData.current>0?" \u2014 "+streakData.current+"wk streak on the line":""),onClick:function(){setPage("review")}});
      var unchecked=portfolio.filter(function(c2){return c2.earningsDate&&c2.earningsDate!=="TBD"&&dU(c2.earningsDate)<0&&dU(c2.earningsDate)>=-14&&c2.kpis.length>0&&!c2.lastChecked});
      if(unchecked.length>0)actions.push({icon:"target",color:K.amb,text:unchecked.map(function(c2){return c2.ticker}).join(", ")+" \u2014 earnings released, KPIs unchecked",onClick:function(){setSelId(unchecked[0].id);setDetailTab("dossier")}});
      var stale=portfolio.filter(function(c2){return c2.thesisUpdatedAt&&Math.ceil((now-new Date(c2.thesisUpdatedAt))/864e5)>90});
      if(stale.length>0)actions.push({icon:"clock",color:K.red,text:stale.length+" thesis"+(stale.length>1?"es":"")+" older than 90 days",onClick:function(){setSelId(stale[0].id);setModal({type:"thesis"})}});
      var noThesis=portfolio.filter(function(c2){return!c2.thesisNote||c2.thesisNote.trim().length<20});
      if(noThesis.length>0)actions.push({icon:"lightbulb",color:K.acc,text:noThesis.length+" holding"+(noThesis.length>1?"s":"")+" without a thesis",onClick:function(){setSelId(noThesis[0].id);setModal({type:"thesis"})}});
      var noScenario=portfolio.filter(function(c2){return(c2.scenarios||[]).length===0});
      if(noScenario.length>0&&actions.length<4)actions.push({icon:"shield",color:"#9333EA",text:noScenario.length+" holding"+(noScenario.length>1?"s":"")+" without a crisis plan",onClick:function(){setSelId(noScenario[0].id);setModal({type:"scenario"})}});
      // Investor quotes
      var quotes=[
        {q:"The stock market is a device for transferring money from the impatient to the patient.",a:"Warren Buffett"},
        {q:"Risk comes from not knowing what you're doing.",a:"Warren Buffett"},
        {q:"The big money is not in the buying and selling, but in the waiting.",a:"Charlie Munger"},
        {q:"In investing, what is comfortable is rarely profitable.",a:"Robert Arnott"},
        {q:"Know what you own, and know why you own it.",a:"Peter Lynch"},
        {q:"The most important quality for an investor is temperament, not intellect.",a:"Warren Buffett"},
        {q:"Wide diversification is only required when investors do not understand what they are doing.",a:"Warren Buffett"},
        {q:"The stock market is filled with individuals who know the price of everything, but the value of nothing.",a:"Philip Fisher"},
        {q:"Time is the friend of the wonderful company, the enemy of the mediocre.",a:"Warren Buffett"},
        {q:"It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.",a:"Warren Buffett"},
        {q:"Our favorite holding period is forever.",a:"Warren Buffett"},
        {q:"The four most dangerous words in investing are: this time it's different.",a:"John Templeton"}
      ];
      var dayIdx=Math.floor(now.getTime()/86400000)%quotes.length;
      var quote=quotes[dayIdx];
      // Portfolio character classification
      var portClass=classifyPortfolio(portfolio);
      // Earnings urgency color
      var earningsToday=upcoming.filter(function(c2){return dU(c2.earningsDate)===0}).length;
      var earningsTomorrow=upcoming.filter(function(c2){return dU(c2.earningsDate)===1}).length;
      return<div className="ta-card" style={{background:K.card,border:"1px solid "+(isDark?K.bdr:K.bdr2),borderRadius:14,marginBottom:20,overflow:"hidden",maxWidth:"100%"}}>
        {/* Header */}
        <div style={{padding:isMobile?"16px 16px 12px":"20px 24px 16px",borderBottom:"1px solid "+K.bdr}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:isMobile?16:18,fontWeight:600,color:K.txt,fontFamily:fh}}>{greeting}, {username||"Investor"}</div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,flexWrap:"wrap"}}>
                <div style={{fontSize:12,color:K.dim}}>{now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
                {portClass.summary&&<span style={{fontSize:12,color:portClass.color,fontFamily:fm,fontStyle:"italic"}}>{portClass.summary}</span>}
              </div>
            </div>
            {totalVal>0&&<div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:isMobile?16:20,fontWeight:700,color:K.txt,fontFamily:fm}}>${totalVal>=1e6?(totalVal/1e6).toFixed(2)+"M":totalVal>=1e3?(totalVal/1e3).toFixed(1)+"k":totalVal.toFixed(0)}</div>
              <div style={{fontSize:13,fontWeight:600,color:totalRet>=0?K.grn:K.red,fontFamily:fm}}>{totalRet>=0?"+":""}{totalRet.toFixed(1)}%</div></div>}</div></div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:0}}>
          {/* Left column — Market Intel */}
          <div style={{padding:isMobile?"14px 16px":"16px 24px",borderRight:isMobile?"none":"1px solid "+(isDark?K.bdr:K.bdr2)}}>
            {/* Upcoming earnings */}
            {upcoming.length>0&&<div style={{marginBottom:14}}>
              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:earningsToday>0?K.red:K.amb,fontFamily:fm,fontWeight:600,marginBottom:8}}>{earningsToday>0?"REPORTING TODAY":earningsTomorrow>0?"REPORTING TOMORROW":"EARNINGS THIS WEEK"}</div>
              {upcoming.slice(0,4).map(function(c2){var d2=dU(c2.earningsDate);var kpiC=c2.kpis.length;
                return<div key={c2.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid "+K.bdr+"30",cursor:"pointer"}} onClick={function(){setSelId(c2.id);setDetailTab("dossier")}}>
                  <CoLogo domain={c2.domain} ticker={c2.ticker} size={18}/>
                  <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{c2.ticker}</span>
                  <span style={{fontSize:11,color:d2===0?K.red:d2===1?K.amb:K.dim,fontWeight:600,fontFamily:fm}}>{d2===0?"Today":d2===1?"Tomorrow":d2+"d"}</span>
                  <span style={{marginLeft:"auto",fontSize:10,color:K.blue,fontFamily:fm}}>{kpiC>0?kpiC+" KPIs":"No KPIs"}</span></div>})}</div>}
            {/* Notable movers */}
            {movers.length>0&&<div style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontSize:10,letterSpacing:isThesis?1:1.5,textTransform:"uppercase",color:isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:700}}>Your Holdings</div>
                <div style={{display:"flex",gap:8,fontSize:8,color:K.dim,fontFamily:fm}}><span style={{width:50,textAlign:"right"}}>Today</span><span style={{width:50,textAlign:"right"}}>Total</span></div></div>
              {movers.slice(0,6).map(function(m){return<div key={m.ticker} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",cursor:"pointer",borderBottom:"1px solid "+K.bdr+"20"}} onClick={function(){setSelId(m.id);setDetailTab("dossier")}}>
                <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,width:44}}>{m.ticker}</span>
                <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>${m.price.toFixed(m.price<10?2:0)}</span>
                <span style={{marginLeft:"auto"}}/>
                <span style={{width:50,textAlign:"right",fontSize:11,fontWeight:600,color:m.dayChg>0?K.grn:m.dayChg<0?K.red:K.dim,fontFamily:fm}}>{m.dayChg!==0?(m.dayChg>0?"+":"")+m.dayChg.toFixed(1)+"%":priceLoading?"\u00B7\u00B7\u00B7":"0.0%"}</span>
                <span style={{width:50,textAlign:"right",fontSize:11,fontWeight:500,color:m.hasPos?(m.ret>=0?K.grn:K.red):K.dim,fontFamily:fm}}>{m.hasPos?(m.ret>=0?"+":"")+m.ret.toFixed(1)+"%":"\u2014"}</span></div>})}</div>}
            {/* Insider signals */}
            {insiderSignals.length>0&&<div>
              <div style={{fontSize:10,letterSpacing:isThesis?1:1.5,textTransform:"uppercase",color:isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:700,marginBottom:6}}>Insider Buying</div>
              <div style={{fontSize:12,color:K.mid}}>{insiderSignals.map(function(s){return s.ticker+" ("+s.count+")"}).join(", ")}</div></div>}
          </div>
          {/* Right column — Actions & Wisdom */}
          <div style={{padding:isMobile?"14px 16px":"16px 24px",borderTop:isMobile?"1px solid "+K.bdr:"none"}}>
            {actions.length>0&&<div style={{marginBottom:14}}>
              <div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600,marginBottom:8}}>Action Items</div>
              {actions.slice(0,3).map(function(a,i){return<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,marginBottom:4,background:a.color+"06",border:"1px solid "+a.color+"15",cursor:"pointer"}} onClick={a.onClick}>
                <IC name={a.icon} size={12} color={a.color}/>
                <span style={{fontSize:isMobile?12:12,color:K.mid,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:isMobile?"nowrap":"normal"}}>{a.text}</span>
                <span style={{fontSize:11,color:a.color,fontFamily:fm,flexShrink:0}}>{"→"}</span></div>})}</div>}
            {actions.length===0&&<div style={{marginBottom:14}}>
              <div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:K.grn,fontFamily:fm,fontWeight:600,marginBottom:6}}>All Clear</div>
              <div style={{fontSize:12,color:K.mid}}>No urgent actions. Your portfolio is in good shape.</div></div>}
            {/* Daily quote */}
            <div style={{background:K.bg,borderRadius:10,padding:"12px 14px",marginTop:actions.length>0?0:8}}>
              <div style={{fontSize:isMobile?13:13,color:K.mid,lineHeight:1.6,fontStyle:"italic"}}>{"\u201C"+quote.q+"\u201D"}</div>
              <div style={{fontSize:11,color:K.dim,marginTop:4,fontFamily:fm}}>{"— "+quote.a}</div></div>
          </div></div>
        {/* ── Owner's Intel Feed ── */}
        {(function(){
          var _nfs=useState(false),showNewsFilter=_nfs[0],setShowNewsFilter=_nfs[1];
          var enabledCats=Object.keys(briefNewsPrefs).filter(function(k){return briefNewsPrefs[k]});
          var shown=(briefNews||[]).filter(function(n){
            if(!portfolio.some(function(c2){return c2.ticker===n.ticker}))return false;
            return enabledCats.indexOf(n.cat)>=0}).slice(0,10);
          if(!briefNewsLoading&&(!briefNews||shown.length===0)&&briefNews!==null)return null;
          return<div style={{borderTop:"1px solid "+K.bdr}}>
            <div style={{padding:isMobile?"12px 16px 14px":"14px 24px 16px"}}>
              {/* Header row */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showNewsFilter?10:8}}>
                <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                  <IC name="news" size={10} color={isThesis?K.acc:K.dim}/>Owner’s Intel
                  {briefNews&&briefNews.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm,fontWeight:400,letterSpacing:0}}>{"(" + shown.length + " stories)"}</span>}
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={function(){setShowNewsFilter(!showNewsFilter)}} style={{background:showNewsFilter?K.acc+"15":"none",border:"1px solid "+(showNewsFilter?K.acc+"40":K.bdr),borderRadius:999,color:showNewsFilter?K.acc:K.dim,fontSize:10,cursor:"pointer",fontFamily:fm,padding:"2px 9px",letterSpacing:.3,display:"flex",alignItems:"center",gap:4}}>
                    <IC name="gear" size={9} color={showNewsFilter?K.acc:K.dim}/>{"Filter"}
                  </button>
                  <button onClick={function(){try{localStorage.removeItem("ta-brief-news")}catch(e){}loadBriefNews(portfolio)}} style={{background:"none",border:"none",color:K.dim,fontSize:10,cursor:"pointer",fontFamily:fm,padding:"2px 4px"}} title="Refresh">{"\u21ba"}</button>
                </div>
              </div>
              {/* Filter panel */}
              {showNewsFilter&&<div style={{background:K.bg,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:11,color:K.mid,fontFamily:fm,marginBottom:8,fontWeight:600}}>{"Show news about\u2026"}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {NEWS_CATS.map(function(cat){var on=!!briefNewsPrefs[cat.id];return<button key={cat.id} onClick={function(){var next=Object.assign({},briefNewsPrefs);next[cat.id]=!on;saveBriefNewsPrefs(next)}} style={{padding:"5px 12px",borderRadius:999,border:"1px solid "+(on?cat.color+"50":K.bdr),background:on?cat.color+"15":"transparent",color:on?cat.color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fm,fontWeight:on?700:400,transition:"all .15s",display:"flex",alignItems:"center",gap:4}} title={cat.desc}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:on?cat.color:K.bdr,flexShrink:0}}/>
                    {cat.label}
                  </button>})}
                </div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:8}}>{"Only stories where your company is the subject, not a footnote."}</div>
              </div>}
              {/* Loading */}
              {briefNewsLoading&&(!briefNews||briefNews.length===0)&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0"}}><div style={{width:8,height:8,borderRadius:"50%",background:K.acc,animation:"pulse 1.2s infinite"}}/><span style={{fontSize:12,color:K.dim}}>{"Scanning news for your holdings\u2026"}</span></div>}
              {/* Stories */}
              {shown.length>0&&<div>{shown.map(function(n,i){
                var timeAgo=(function(){var diff=Math.floor(Date.now()/1000-n.datetime);if(diff<3600)return Math.floor(diff/60)+"m ago";if(diff<86400)return Math.floor(diff/3600)+"h ago";return Math.floor(diff/86400)+"d ago"})();
                var co=portfolio.find(function(c2){return c2.ticker===n.ticker});
                return<a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"flex-start",gap:9,padding:"8px 0",borderBottom:i<shown.length-1?"1px solid "+K.bdr+"20":"none",textDecoration:"none"}}
                  onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06";e.currentTarget.style.borderRadius="6px";e.currentTarget.style.padding="8px 6px";e.currentTarget.style.margin="0 -6px"}}
                  onMouseLeave={function(e){e.currentTarget.style.background="transparent";e.currentTarget.style.padding="8px 0";e.currentTarget.style.margin="0"}}>
                  {co&&<div style={{flexShrink:0,marginTop:1}}><CoLogo domain={co.domain} ticker={co.ticker} size={18}/></div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:isMobile?13:12,color:K.mid,lineHeight:1.5,marginBottom:2}}>{n.headline}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:isMobile?11:10,fontWeight:700,color:K.acc,fontFamily:fm}}>{n.ticker}</span>
                      <span style={{fontSize:isMobile?11:10,color:K.dim,fontFamily:fm}}>{n.source}</span>
                      <span style={{fontSize:isMobile?10:8,color:K.dim,fontFamily:fm}}>{timeAgo}</span>
                    </div>
                  </div>
                  <span style={{flexShrink:0,fontSize:isMobile?11:10,fontWeight:700,color:n.color,background:n.color+"15",padding:"2px 8px",borderRadius:999,fontFamily:fm,whiteSpace:"nowrap",marginTop:2}}>{n.label}</span>
                </a>})}
              </div>}
              {briefNews&&shown.length===0&&!briefNewsLoading&&<div style={{fontSize:12,color:K.dim,padding:"4px 0"}}>{"No matching news in the last 14 days. Try enabling more categories or check back later."}</div>}
            </div>
          </div>})()}
      </div>})()}
    {/* ── Owner's Checklist (persistent onboarding) ── */}
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
        if(!milestones.onboard_complete){showToast("Owner's Checklist complete - the foundation is set","info",4000);
          
          var nm2=Object.assign({},milestones);nm2.onboard_dismissed=true;setMilestones(nm2);try{localStorage.setItem("ta-milestones",JSON.stringify(nm2))}catch(e){}}
        return null}
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"14px 18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>{"📋"}</span>
            <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Owner's Checklist</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{completed}/4</span></div>
          <button onClick={function(){var nm3=Object.assign({},milestones);nm3.onboard_dismissed=true;setMilestones(nm3);try{localStorage.setItem("ta-milestones",JSON.stringify(nm3))}catch(e){}}} style={{background:"none",border:"none",color:K.dim,fontSize:13,cursor:"pointer",padding:2}}>{"✕"}</button></div>
        {/* Progress bar */}
        <div style={{display:"flex",gap:3,marginBottom:12}}>
          {steps.map(function(s,i){return<div key={i} style={{flex:1,height:4,borderRadius:2,background:s.done?K.grn:K.bdr,transition:"background .3s"}}/>})}</div>
        {/* Step buttons */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {steps.map(function(s,i){return<button key={i} onClick={s.done?undefined:s.onClick} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:6,border:"1px solid "+(s.done?K.grn+"40":s.color+"30"),background:s.done?K.grn+"08":"transparent",color:s.done?K.grn:s.color,fontSize:11,fontWeight:600,cursor:s.done?"default":"pointer",fontFamily:fm,opacity:s.done?.7:1}}>
            {s.done?<IC name="check" size={9} color={K.grn}/>:<IC name={s.icon} size={9} color={s.color}/>}{s.label}</button>})}</div>
      </div>})()}
    {dashSet.showSummary&&sideTab==="portfolio"&&function(){
      var held=filtered.filter(function(c){var p=c.position||{};return p.shares>0&&p.avgCost>0&&p.currentPrice>0});
      if(held.length===0)return null;
      var totalCost=held.reduce(function(s,c){return s+(c.position.shares*c.position.avgCost)},0);
      var totalValue=held.reduce(function(s,c){return s+(c.position.shares*c.position.currentPrice)},0);
      var totalReturn=totalValue-totalCost;var totalReturnPct=totalCost>0?(totalReturn/totalCost*100):0;
      var isUp=totalReturn>=0;
      var best=null,worst=null;held.forEach(function(c){var pct=(c.position.currentPrice-c.position.avgCost)/c.position.avgCost*100;if(!best||pct>best.pct)best={ticker:c.ticker,pct:pct,id:c.id};if(!worst||pct<worst.pct)worst={ticker:c.ticker,pct:pct,id:c.id}});
      // Day P&L across portfolio
      var dayPnl=held.reduce(function(s,c){var p2=c.position||{};var d=c._dayChangePct||0;var mv=p2.shares*p2.currentPrice;return s+(mv*d/100)},0);
      var dayPnlPct=totalValue>0?(dayPnl/totalValue*100):0;
      var isDayUp=dayPnl>=0;
      // Holdings in buy zone (below target price)
      var inBuyZone=held.filter(function(c){return c.targetPrice>0&&c.position&&c.position.currentPrice>0&&c.position.currentPrice<c.targetPrice}).length;
      return<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:isMobile?8:16,marginBottom:20}}>
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:isMobile?"12px 14px":"18px 22px",minWidth:0,overflow:"hidden"}}>
          <div style={{fontSize:10,letterSpacing:isMobile?0.5:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:6,fontFamily:fm,whiteSpace:"nowrap"}}>Portfolio Value</div>
          <div style={{fontSize:isMobile?16:22,fontWeight:700,color:K.txt,fontFamily:fm,lineHeight:1.15}}>{cSym}{totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          <div style={{fontSize:11,color:K.dim,marginTop:4,fontFamily:fm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Invested: {cSym}{totalCost.toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:isMobile?"12px 14px":"18px 22px",minWidth:0,overflow:"hidden"}}>
          <div style={{fontSize:10,letterSpacing:isMobile?0.5:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:6,fontFamily:fm,whiteSpace:"nowrap"}}>Total Return</div>
          <div style={{fontSize:isMobile?16:22,fontWeight:700,color:isUp?K.grn:K.red,fontFamily:fm,lineHeight:1.15}}>{isUp?"+":""}{totalReturnPct.toFixed(1)}%</div>
          <div style={{fontSize:11,color:isUp?K.grn:K.red,marginTop:4,fontFamily:fm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isUp?"+":""}{cSym}{Math.abs(totalReturn).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:isMobile?"12px 14px":"18px 22px",minWidth:0,overflow:"hidden"}}>
          <div style={{fontSize:10,letterSpacing:isMobile?0.5:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:6,fontFamily:fm,whiteSpace:"nowrap"}}>Today</div>
          {dayPnl!==0?<div>
            <div style={{fontSize:isMobile?16:22,fontWeight:700,color:isDayUp?K.grn:K.red,fontFamily:fm,lineHeight:1.15}}>{isDayUp?"+":""}{dayPnlPct.toFixed(2)}%</div>
            <div style={{fontSize:11,color:isDayUp?K.grn:K.red,marginTop:4,fontFamily:fm}}>{isDayUp?"+":""}{cSym}{Math.abs(dayPnl).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          </div>:<div style={{fontSize:isMobile?14:18,fontWeight:500,color:K.dim,fontFamily:fm,lineHeight:1.15,marginTop:4}}>Refresh prices</div>}</div>
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:isMobile?"12px 14px":"18px 22px",minWidth:0,overflow:"hidden",cursor:"pointer"}} onClick={function(){if(best)setSelId(best.id)}}>
          <div style={{fontSize:10,letterSpacing:isMobile?0.5:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:6,fontFamily:fm,whiteSpace:"nowrap"}}>Leader / Laggard</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><div style={{fontSize:isMobile?14:16,fontWeight:700,color:K.grn,fontFamily:fm,lineHeight:1.15}}>{best?best.ticker:"—"}</div>
              <div style={{fontSize:11,color:K.grn,marginTop:2,fontFamily:fm}}>{best?(best.pct>=0?"+":"")+best.pct.toFixed(1)+"%":""}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:isMobile?14:16,fontWeight:700,color:K.red,fontFamily:fm,lineHeight:1.15}}>{worst?worst.ticker:"—"}</div>
              <div style={{fontSize:11,color:K.red,marginTop:2,fontFamily:fm}}>{worst?(worst.pct>=0?"+":"")+worst.pct.toFixed(1)+"%":""}</div></div>
          </div>
          {inBuyZone>0&&<div style={{fontSize:9,fontWeight:700,color:K.grn,fontFamily:fm,marginTop:4,background:K.grn+"12",padding:"2px 6px",borderRadius:3,display:"inline-block"}}>{inBuyZone} in buy zone</div>}
        </div>
      </div>}()}
    {/* Analytics quick link */}

    {/* View toggle */}
    {filtered.length>0&&<div style={{display:"flex",justifyContent:"flex-end",gap:4,marginBottom:12}}>
      <button onClick={function(){setDashSet(function(p){var n=Object.assign({},p,{portfolioView:"list"});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}} style={{padding:"5px 10px",fontSize:11,fontFamily:fm,background:dashSet.portfolioView==="list"||!dashSet.portfolioView?K.acc+"18":"transparent",color:dashSet.portfolioView==="list"||!dashSet.portfolioView?K.acc:K.dim,border:"1px solid "+(dashSet.portfolioView==="list"||!dashSet.portfolioView?K.acc+"40":K.bdr),borderRadius:5,cursor:"pointer"}}><IC name="file" size={10} color={dashSet.portfolioView==="list"||!dashSet.portfolioView?K.acc:K.dim}/> List</button>
      <button onClick={function(){setDashSet(function(p){var n=Object.assign({},p,{portfolioView:"cards"});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}} style={{padding:"5px 10px",fontSize:11,fontFamily:fm,background:dashSet.portfolioView==="cards"?K.acc+"18":"transparent",color:dashSet.portfolioView==="cards"?K.acc:K.dim,border:"1px solid "+(dashSet.portfolioView==="cards"?K.acc+"40":K.bdr),borderRadius:5,cursor:"pointer"}}><IC name="overview" size={10} color={dashSet.portfolioView==="cards"?K.acc:K.dim}/> Cards</button></div>}
    {/* Nordnet-style list view */}
    {filtered.length>0&&sideTab!=="toohard"&&dashSet.portfolioView!=="cards"&&(function(){
      var totalVal=filtered.reduce(function(s,cc){var p2=cc.position||{};return s+(p2.shares>0&&p2.currentPrice>0?p2.shares*p2.currentPrice:0)},0);
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,overflow:"hidden",marginBottom:28}}>
        <div style={{display:"flex",alignItems:"center",padding:"10px 20px",borderBottom:"2px solid "+K.bdr,fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",gap:0}}>
          <span style={{width:40}}/>
          <span style={{flex:1,minWidth:100}}>Company</span>
          <span style={{width:75,textAlign:"right"}}>{sideTab==="watchlist"?"Price":"Avg Price"}</span>
          <span style={{width:65,textAlign:"right"}}>{sideTab==="watchlist"?"Target":"Ret / Day"}</span>
          {!isMobile&&<span style={{width:85,textAlign:"right"}}>{sideTab==="watchlist"?"Gap":"Value"}</span>}
          <span style={{width:isMobile?70:140,paddingLeft:8}}>{sideTab==="watchlist"?"Sector":"Allocation"}</span>
          {(function(){var oo=dashSet.listColOrder||["conviction","kpis","earnings","price","mastery"];var hw={conviction:{w:40,a:"center",l:"C"},kpis:{w:55,a:"right",l:"KPIs",d:true},earnings:{w:60,a:"right",l:"Earn.",d:true},price:{w:70,a:"right",l:"Price",d:true},mastery:{w:55,a:"center",l:"Mastery"}};return oo.map(function(k2){var h2=hw[k2];if(!h2)return null;if(!(dashSet.listCols||{})[k2])return null;if(h2.d&&isMobile)return null;return<span key={k2} style={{width:h2.w,textAlign:h2.a}}>{h2.l}</span>})})()}
          <span style={{width:isMobile?0:28,position:"relative",overflow:"hidden"}}>{!isMobile&&<button onClick={function(e){e.stopPropagation();setShowListCfg(!showListCfg)}} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><IC name="gear" size={12} color={K.dim}/></button>}
            {showListCfg&&<div style={{position:"absolute",right:0,top:22,background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"6px 0",boxShadow:"0 4px 16px rgba(0,0,0,.25)",zIndex:50,minWidth:150,textTransform:"none",letterSpacing:0}} onClick={function(e){e.stopPropagation()}}>
              <div style={{padding:"4px 12px 6px",fontSize:11,color:K.dim,fontWeight:600}}>Show columns</div>
              {(function(){var allCols=[{k:"conviction",l:"Conviction"},{k:"kpis",l:"KPI Status"},{k:"earnings",l:"Earnings"},{k:"price",l:"Current Price"},{k:"mastery",l:"Mastery Stars"}];
              var order=dashSet.listColOrder||allCols.map(function(c2){return c2.k});
              var sorted=order.map(function(k2){return allCols.find(function(c2){return c2.k===k2})}).filter(Boolean);
              allCols.forEach(function(c2){if(!sorted.find(function(s2){return s2.k===c2.k}))sorted.push(c2)});
              function moveCol(k2,dir){setDashSet(function(p){var o=p.listColOrder||allCols.map(function(c3){return c3.k});var idx2=o.indexOf(k2);if(idx2<0)return p;var ni=Math.max(0,Math.min(o.length-1,idx2+dir));if(ni===idx2)return p;var no=o.slice();no.splice(idx2,1);no.splice(ni,0,k2);var n=Object.assign({},p,{listColOrder:no});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}
              return sorted.map(function(col){return<div key={col.k} style={{padding:"5px 12px",fontSize:12,color:K.mid,fontFamily:fm,display:"flex",alignItems:"center",gap:6}}>
                <div onClick={function(){setDashSet(function(p){var lc=Object.assign({},p.listCols||{});lc[col.k]=!lc[col.k];var n=Object.assign({},p,{listCols:lc});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}} style={{width:12,height:12,borderRadius:3,border:"1.5px solid "+((dashSet.listCols||{})[col.k]?K.acc:K.bdr),background:(dashSet.listCols||{})[col.k]?K.acc:"transparent",cursor:"pointer",flexShrink:0}}/>
                <span style={{flex:1,cursor:"pointer"}} onClick={function(){setDashSet(function(p){var lc=Object.assign({},p.listCols||{});lc[col.k]=!lc[col.k];var n=Object.assign({},p,{listCols:lc});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}}>{col.l}</span>
                <div style={{display:"flex",gap:2}}>
                  <button onClick={function(){moveCol(col.k,-1)}} style={{background:"none",border:"none",cursor:"pointer",padding:"0 2px",fontSize:10,color:K.dim}}>{"▲"}</button>
                  <button onClick={function(){moveCol(col.k,1)}} style={{background:"none",border:"none",cursor:"pointer",padding:"0 2px",fontSize:10,color:K.dim}}>{"▼"}</button></div></div>})})()}</div>}</span></div>
        {filtered.slice().sort(function(a,b){var va=(a.position&&a.position.shares>0&&a.position.currentPrice>0)?a.position.shares*a.position.currentPrice:0;var vb=(b.position&&b.position.shares>0&&b.position.currentPrice>0)?b.position.shares*b.position.currentPrice:0;return vb-va}).map(function(cc,ci){
          var p2=cc.position||{};var val=p2.shares>0&&p2.currentPrice>0?p2.shares*p2.currentPrice:0;
          var ret=p2.shares>0&&p2.avgCost>0&&p2.currentPrice>0?((p2.currentPrice-p2.avgCost)/p2.avgCost*100):null;
          var weight=totalVal>0&&val>0?(val/totalVal*100):0;
          var h2=gH(cc.kpis);var d2=dU(cc.earningsDate);
          if(isMobile){return<div key={cc.id} style={{display:"flex",alignItems:"center",padding:"14px 16px",borderBottom:"1px solid "+K.bdr+"60",cursor:"pointer",gap:12}} onClick={function(){setSelId(cc.id);setDetailTab("dossier")}}
            onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"08"}} onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
            <CoLogo domain={cc.domain} ticker={cc.ticker} size={36}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,color:K.txt,fontFamily:fm}}>{cc.ticker}</div>
              <div style={{fontSize:13,color:K.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cc.name}</div></div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:700,color:ret!=null?(ret>=0?K.grn:K.red):K.dim,fontFamily:fm}}>{ret!=null?(ret>=0?"+":"")+ret.toFixed(1)+"%":"—"}</div>
              {(cc._dayChangePct||0)!==0&&<div style={{fontSize:11,fontWeight:600,color:(cc._dayChangePct||0)>=0?K.grn:K.red,fontFamily:fm}}>{(cc._dayChangePct||0)>=0?"+":""}{(cc._dayChangePct||0).toFixed(2)}% today</div>}
              <div style={{fontSize:11,color:K.mid,fontFamily:fm,marginTop:1}}>{weight>0?weight.toFixed(1)+"% alloc":"—"}</div></div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>}
          return<div key={cc.id} style={{display:"flex",alignItems:"center",padding:"10px 20px",borderBottom:"1px solid "+K.bdr+"50",cursor:"pointer",transition:"background .1s",gap:0}} onClick={function(){setSelId(cc.id);setDetailTab("dossier")}}
            onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06"}} onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
            <span style={{width:40}}><CoLogo domain={cc.domain} ticker={cc.ticker} size={24}/></span>
            <span style={{flex:1,minWidth:100}}>
              <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{cc.ticker}</div>
              <div style={{fontSize:11,color:K.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140}}>{cc.name}</div></span>
            <span style={{width:75,textAlign:"right",fontSize:12,color:K.mid,fontFamily:fm}}>{sideTab==="watchlist"?(p2.currentPrice>0?cSym+p2.currentPrice.toFixed(2):"—"):(p2.avgCost>0?cSym+p2.avgCost.toFixed(2):"—")}</span>
            <span style={{width:65,textAlign:"right",fontSize:12,fontFamily:fm}}>
              {sideTab==="watchlist"?(cc.targetPrice>0?<span style={{fontWeight:600,color:K.txt}}>{cSym}{cc.targetPrice.toFixed(0)}</span>:<span style={{color:K.dim}}>—</span>):
              <div><div style={{fontWeight:700,color:ret!=null?(ret>=0?K.grn:K.red):K.dim,fontSize:12}}>{ret!=null?(ret>=0?"+":"")+ret.toFixed(1)+"%":"—"}</div>
              {(cc._dayChangePct||0)!==0&&<div style={{fontSize:10,color:(cc._dayChangePct||0)>=0?K.grn:K.red,fontFamily:fm}}>{(cc._dayChangePct||0)>=0?"+":""}{(cc._dayChangePct||0).toFixed(2)}%</div>}</div>}
            </span>
            {!isMobile&&<span style={{width:85,textAlign:"right",fontSize:12,fontFamily:fm}}>{sideTab==="watchlist"?(function(){if(!cc.targetPrice||!p2.currentPrice)return<span style={{color:K.dim}}>{"—"}</span>;var gap=((cc.targetPrice-p2.currentPrice)/p2.currentPrice*100);return<span style={{color:gap>0?K.grn:K.red,fontWeight:600}}>{gap>0?gap.toFixed(0)+"% below":"At target"}</span>})():<span style={{color:K.txt}}>{val>0?cSym+val.toLocaleString(undefined,{maximumFractionDigits:0}):"—"}</span>}</span>}
            <span style={{width:isMobile?70:140,paddingLeft:8}}>{sideTab==="watchlist"?<span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{cc.sector||""}</span>:weight>0?<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{flex:1,height:10,borderRadius:5,background:K.blue+"18",overflow:"hidden"}}><div style={{height:"100%",width:Math.min(weight,100)+"%",borderRadius:5,background:K.blue,transition:"width .4s"}}/></div><span style={{fontSize:10,color:K.blue,fontFamily:fm,fontWeight:600,minWidth:28,textAlign:"right"}}>{weight.toFixed(1)}%</span></div>:<div style={{height:10}}/>}</span>
            {(function(){var oo=dashSet.listColOrder||["conviction","kpis","earnings","price","mastery"];return oo.map(function(k2){if(!(dashSet.listCols||{})[k2])return null;
              if(k2==="conviction")return<span key={k2} style={{width:40,textAlign:"center"}}>{cc.conviction>0?<span style={{fontSize:13,fontWeight:700,color:cc.conviction>=7?K.grn:cc.conviction>=4?K.amb:K.red,fontFamily:fm}}>{cc.conviction}</span>:<span style={{color:K.dim}}>{"—"}</span>}</span>;
              if(k2==="kpis"&&!isMobile)return<span key={k2} style={{width:55,textAlign:"right"}}><span style={S.badge(h2.c)}>{h2.l}</span></span>;
              if(k2==="earnings"&&!isMobile)return<span key={k2} style={{width:60,textAlign:"right",fontSize:11,color:d2>=0&&d2<=7?K.amb:K.dim,fontFamily:fm}}>{cc.earningsDate==="TBD"?"TBD":d2<=0?"Done":d2+"d"}</span>;
              if(k2==="price"&&!isMobile)return<span key={k2} style={{width:70,textAlign:"right",fontSize:12,color:K.txt,fontFamily:fm}}>{p2.currentPrice>0?cSym+p2.currentPrice.toFixed(2):"—"}</span>;
              if(k2==="mastery")return<span key={k2} style={{width:55,textAlign:"center",display:"flex",justifyContent:"center",gap:1}}>{(function(){var _ml=calcMastery(cc);return[1,2,3,4,5,6].map(function(s){return<svg key={s} width="7" height="7" viewBox="0 0 12 12"><polygon points="6,0 7.5,4 12,4.5 8.5,7.5 9.5,12 6,9.5 2.5,12 3.5,7.5 0,4.5 4.5,4" fill={s<=_ml.stars?_ml.color:K.bdr}/></svg>})})()}</span>;
              return null})})()}
            {!isMobile&&<span style={{width:28}}/>}
          </div>})}
      </div>})()}
    {/* Card view */}
    {filtered.length>0&&sideTab!=="toohard"&&dashSet.portfolioView==="cards"&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:16,marginBottom:28}}>
      {filtered.map(function(c,ci){var h=gH(c.kpis);var d=dU(c.earningsDate);var cs2=checkSt[c.id];var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;var total=c.kpis.filter(function(k){return k.lastResult}).length;var pos=c.position||{};
        var _snap=c.financialSnapshot||{};
        var _dayChg=c._dayChangePct||0;var _dayChgAbs=c._dayChangeAbs||0;
        var _totalRet=pos.avgCost>0&&pos.currentPrice>0?((pos.currentPrice-pos.avgCost)/pos.avgCost*100):null;
        var _tgtGap=c.targetPrice>0&&pos.currentPrice>0?((c.targetPrice-pos.currentPrice)/pos.currentPrice*100):null;
        var _mktVal=pos.shares>0&&pos.currentPrice>0?pos.shares*pos.currentPrice:0;
        var _graham=_snap.grahamNum?_snap.grahamNum.numVal:0;
        var _gDisc=_graham>0&&pos.currentPrice>0?((_graham-pos.currentPrice)/pos.currentPrice*100):null;
        var _fy=_snap.fairValue?_snap.fairValue.numVal:0;
        var _pvfv=_fy>0&&pos.currentPrice>0?((_fy-pos.currentPrice)/pos.currentPrice*100):null;
        return<div key={c.id} className="ta-card ta-fade" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",cursor:"pointer",position:"relative",animationDelay:Math.min(ci*40,400)+"ms"}} onClick={function(){setSelId(c.id);setDetailTab("dossier")}}>
          <button onClick={function(e){e.stopPropagation();setCos(function(p){return p.filter(function(x){return x.id!==c.id})})}} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:K.dim,fontSize:14,cursor:"pointer",padding:4,opacity:.4}} title="Remove">{"✕"}</button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><CoLogo domain={c.domain} ticker={c.ticker} size={28}/><div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</span>
              {dashSet.showPrices&&pos.currentPrice>0&&<span style={{fontSize:15,fontWeight:700,color:K.txt,fontFamily:fm}}>{cSym}{pos.currentPrice.toFixed(2)}</span>}
              {_dayChg!==0&&<span style={{fontSize:11,fontWeight:600,color:_dayChg>=0?K.grn:K.red,fontFamily:fm}}>({_dayChg>=0?"+":""}{_dayChg.toFixed(2)}%)</span>}
            </div>
            <div style={{fontSize:11,color:K.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
            <span style={S.badge(h.c)}>{h.l}</span>
            {_totalRet!=null&&<span style={{fontSize:10,fontWeight:700,color:_totalRet>=0?K.grn:K.red,fontFamily:fm}}>{_totalRet>=0?"+":""}{_totalRet.toFixed(1)}%</span>}
          </div>
        </div>
        {/* Price vs value row */}
        {dashSet.showPrices&&((_tgtGap!=null)||(_gDisc!=null&&Math.abs(_gDisc)<100))&&<div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
          {_tgtGap!=null&&<span style={{fontSize:10,background:_tgtGap>0?K.grn+"12":K.red+"12",color:_tgtGap>0?K.grn:K.red,padding:"2px 7px",borderRadius:4,fontFamily:fm,fontWeight:600}}>{_tgtGap>0?"↑":"↓"}{Math.abs(_tgtGap).toFixed(0)}% to target</span>}
          {_gDisc!=null&&Math.abs(_gDisc)<100&&<span style={{fontSize:10,background:_gDisc>0?K.grn+"10":K.amb+"10",color:_gDisc>0?K.grn:K.amb,padding:"2px 7px",borderRadius:4,fontFamily:fm}}>{_gDisc>0?Math.abs(_gDisc).toFixed(0)+"% below Graham":""+Math.abs(_gDisc).toFixed(0)+"% above Graham"}</span>}
        </div>}
          {dashSet.showPositions&&pos.shares>0&&pos.avgCost>0&&pos.currentPrice>0&&<div style={{marginBottom:10,padding:"8px 12px",background:K.bg,borderRadius:8}}>
            <div style={{display:"flex",gap:10,justifyContent:"space-between"}}>
              <span style={{fontSize:12,color:K.dim,fontFamily:fm}}>{pos.shares>=1000?(pos.shares/1000).toFixed(1)+"k":pos.shares} sh</span>
              <span style={{fontSize:12,fontWeight:700,color:_totalRet!=null&&_totalRet>=0?K.grn:K.red,fontFamily:fm}}>{_totalRet!=null?(_totalRet>=0?"+":"")+_totalRet.toFixed(1)+"%":"—"}</span>
              <span style={{fontSize:12,color:K.txt,fontFamily:fm,fontWeight:600}}>{cSym}{(_mktVal>=1000?(_mktVal/1000).toFixed(1)+"k":_mktVal.toFixed(0))}</span>
              {_dayChg!==0&&_dayChgAbs!==0&&<span style={{fontSize:11,color:_dayChg>=0?K.grn:K.red,fontFamily:fm}}>{_dayChg>=0?"+":""}{(pos.shares*_dayChgAbs).toFixed(0)} today</span>}
            </div>
          </div>}
          {/* Investment style + Moat type micro-badges */}
          {c.investStyle&&STYLE_MAP[c.investStyle]&&<div style={{display:"flex",gap:4,marginBottom:8}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:600,color:STYLE_MAP[c.investStyle].color,background:STYLE_MAP[c.investStyle].color+"10",padding:"2px 7px",borderRadius:3,fontFamily:fm}}><IC name={STYLE_MAP[c.investStyle].icon} size={8} color={STYLE_MAP[c.investStyle].color}/>{STYLE_MAP[c.investStyle].label}</span></div>}
          {function(){var mt=c.moatTypes||{};var active=MOAT_TYPES.filter(function(t){return mt[t.id]&&mt[t.id].active});
            if(active.length===0)return null;
            return<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
              {active.slice(0,4).map(function(t){return<span key={t.id} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:t.color,background:t.color+"10",padding:"1px 6px",borderRadius:3,fontFamily:fm}}>
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
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid "+K.bdr}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:d>=0&&d<=7?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"TBD":(d<=0?"Reported":d+"d")}</span>
              {dashSet.showBuyZone&&c.targetPrice>0&&pos.currentPrice>0&&pos.currentPrice<=c.targetPrice&&<span style={{fontSize:10,fontWeight:600,color:K.grn,background:K.grn+"15",padding:"2px 6px",borderRadius:3,fontFamily:fm}}>BUY ZONE</span>}
              {_snap.shareholderYield&&_snap.shareholderYield.numVal>0.5&&<span style={{fontSize:10,color:K.grn,fontFamily:fm,background:K.grn+"10",padding:"2px 6px",borderRadius:3}}>{_snap.shareholderYield.value} yield</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              {total>0&&<span style={{fontSize:11,color:met===total&&total>0?K.grn:K.dim,fontFamily:fm,fontWeight:met===total&&total>0?700:400}}>{met}/{total} KPIs</span>}
              {total===0&&c.kpis.length>0&&<span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.kpis.length} KPIs</span>}
              {cs2==="checking"&&<span style={{fontSize:10,color:K.dim}}>⏳</span>}
            </div>
          </div></div>})}</div>}
    {/* Mastery Overview */}
    {sideTab==="portfolio"&&filtered.length>0&&(function(){
      var items=filtered.map(function(cc2){return{ticker:cc2.ticker,id:cc2.id,m:calcMastery(cc2),domain:cc2.domain}}).sort(function(a,b){return a.m.stars-b.m.stars});
      var avgStars=items.reduce(function(s2,i2){return s2+i2.m.stars},0)/Math.max(items.length,1);
      var mastered=items.filter(function(i2){return i2.m.stars>=6}).length;
      var nextSteps={"Added":"Write a thesis with core investment case, moat, risks, and sell criteria","Thesis":"Define 2+ KPIs and rate your conviction","Tracked":"Check earnings and classify the competitive moat","Monitored":"Log a decision and review your thesis (keep it fresh)","Disciplined":"Accumulate 3+ quarters of earnings data and conviction history"};
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:600,color:K.txt}}>Ownership Mastery</div>
          <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>{avgStars.toFixed(1)}/6 avg {mastered>0?" · "+mastered+" mastered":""}</div></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {items.map(function(it){return<div key={it.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:8,background:K.bg,cursor:"pointer"}} onClick={function(){setSelId(it.id);setDetailTab("dossier")}}>
            <CoLogo domain={it.domain} ticker={it.ticker} size={20}/>
            <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm,width:50}}>{it.ticker}</span>
            <div style={{display:"flex",gap:2}}>{[1,2,3,4,5,6].map(function(s2){return<svg key={s2} width="14" height="14" viewBox="0 0 12 12"><polygon points="6,0.5 7.8,4.2 12,4.7 8.8,7.5 9.7,11.5 6,9.3 2.3,11.5 3.2,7.5 0,4.7 4.2,4.2" fill={s2<=it.m.stars?it.m.color:K.bdr} stroke={s2<=it.m.stars?it.m.color:K.bdr} strokeWidth="0.5"/></svg>})}</div>
            <span style={{fontSize:11,fontWeight:600,color:it.m.color,fontFamily:fm,minWidth:70}}>{it.m.label}</span>
            {it.m.stars<6&&<span style={{fontSize:11,color:K.dim,flex:1}}>{nextSteps[it.m.label]||""}</span>}
            {it.m.stars>=6&&<span style={{fontSize:11,color:K.grn,flex:1}}>{"✓"} Full mastery</span>}
          </div>})}</div></div>})()}
    {sideTab==="portfolio"&&filtered.length>=2&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>
      {[{label:"Analytics",icon:"bar",color:K.acc,pg:"analytics",desc:"Moat scores & quality"},
        {label:"Earnings",icon:"target",color:K.amb,pg:"calendar",desc:"Upcoming & recent"},
        {label:"Dividends",icon:"dollar",color:K.grn,pg:"dividends",desc:"Income tracking"},
        {label:"Timeline",icon:"trending",color:K.blue,pg:"timeline",desc:"Your history"}
      ].map(function(lnk){return<div key={lnk.label} className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 14px",cursor:"pointer",textAlign:"center"}} onClick={function(){setSelId(null);setPage(lnk.pg)}}>
        <IC name={lnk.icon} size={16} color={lnk.color}/>
        <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,marginTop:4}}>{lnk.label}</div>
        <div style={{fontSize:10,color:K.dim}}>{lnk.desc}</div></div>})}</div>}
    {sideTab==="toohard"&&filtered.length>0&&(function(){
      var HARD_CHIPS=["Too complex to model","Outside circle of competence","Requires specialist knowledge","Valuation too opaque","Management concerns","Regulatory unpredictable","Commodity/macro-driven","Come back later"];
      var stale=filtered.filter(function(c){return c.parkedAt&&(new Date()-new Date(c.parkedAt))/864e5>180});
      return<div>
        <div style={{background:K.red+"08",border:"1px solid "+K.red+"20",borderRadius:12,padding:"14px 20px",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:600,color:K.red,marginBottom:4}}>Circle of Competence</div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{"\u201cAcknowledging what you don\u2019t know is the dawning of wisdom.\u201d"} {filtered.length} {filtered.length===1?"company":"companies"} parked here.{stale.length>0?" \u2014 "+stale.length+" have been here 6+ months. Worth a second look?":""}</div>
        </div>
        {stale.length>0&&<div style={{background:K.amb+"08",border:"1px solid "+K.amb+"25",borderRadius:10,padding:"11px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
          <IC name="clock" size={13} color={K.amb}/>
          <span style={{fontSize:13,color:K.amb,fontFamily:fm,fontWeight:600}}>{stale.length} entr{stale.length===1?"y":"ies"} older than 6 months</span>
          <span style={{fontSize:12,color:K.dim,flex:1}}>Has your understanding changed? Consider reconsidering.</span>
        </div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(function(c){
            var daysParked=c.parkedAt?Math.floor((new Date()-new Date(c.parkedAt))/864e5):null;
            var isStale=daysParked!==null&&daysParked>180;
            var tl=daysParked===null?"Unknown":daysParked<30?(daysParked+"d ago"):daysParked<365?(Math.floor(daysParked/30)+"mo ago"):(Math.floor(daysParked/365)+"yr "+Math.floor((daysParked%365)/30)+"mo ago");
            return<div key={c.id} style={{background:K.card,border:"1px solid "+(isStale?K.amb+"50":K.bdr),borderRadius:12,padding:"16px 20px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <CoLogo domain={c.domain} ticker={c.ticker} size={28}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
                    <span style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</span>
                    <span style={{fontSize:12,color:K.dim}}>{c.name}</span>
                    {c.sector&&<span style={{fontSize:11,color:K.dim,background:K.bg,padding:"1px 8px",borderRadius:999,border:"1px solid "+K.bdr}}>{c.sector}</span>}
                    <span style={{fontSize:11,color:isStale?K.amb:K.dim,fontFamily:fm,marginLeft:"auto",fontWeight:isStale?600:400}}>{tl}</span>
                  </div>
                  {c.tooHardReason
                    ?<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        <span style={{fontSize:13,color:K.mid,fontStyle:"italic",flex:1}}>"{c.tooHardReason}"</span>
                        <button onClick={function(e){e.stopPropagation();upd(c.id,{tooHardReason:""})}} style={{background:"none",border:"none",fontSize:11,color:K.dim,cursor:"pointer",fontFamily:fm,flexShrink:0}}>edit</button>
                      </div>
                    :<div style={{marginBottom:8}}>
                        <div style={{fontSize:12,color:K.dim,marginBottom:6}}>Why too hard? <span style={{opacity:.7}}>(helps you decide later)</span></div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                          {HARD_CHIPS.map(function(r){return<button key={r} onClick={function(e){e.stopPropagation();upd(c.id,{tooHardReason:r})}} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:999,padding:"3px 10px",fontSize:11,color:K.mid,cursor:"pointer",fontFamily:fm}}>{r}</button>})}
                        </div>
                      </div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0,marginLeft:8}}>
                  <button onClick={function(e){e.stopPropagation();upd(c.id,{status:"watchlist",parkedAt:""});showToast(c.ticker+" moved to Watchlist","info",2000)}} style={{background:K.grn+"10",border:"1px solid "+K.grn+"30",borderRadius:6,padding:"6px 12px",fontSize:12,color:K.grn,cursor:"pointer",fontFamily:fm,fontWeight:600,whiteSpace:"nowrap"}}>Reconsider \u2192</button>
                  <button onClick={function(e){e.stopPropagation();if(window.confirm("Remove "+c.ticker+"?"))setCos(function(p){return p.filter(function(x){return x.id!==c.id})})}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:6,padding:"6px 12px",fontSize:12,color:K.dim,cursor:"pointer",fontFamily:fm,whiteSpace:"nowrap"}}>Remove</button>
                </div>
              </div>
            </div>})}
        </div>
      </div>}())}
    {sideTab==="toohard"&&filtered.length===0&&<div style={{background:K.red+"08",border:"1px solid "+K.red+"20",borderRadius:12,padding:"14px 20px",marginBottom:20}}><div style={{fontSize:13,fontWeight:600,color:K.red,marginBottom:4}}>Circle of Competence</div><div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{"\u201cAcknowledging what you don\u2019t know is the dawning of wisdom.\u201d"}</div></div>}
    {/* Empty state — warm welcome */}
    {filtered.length===0&&<div className="ta-fade" style={{padding:isMobile?"40px 4px 100px":"60px 20px",textAlign:"center",maxWidth:520,margin:"0 auto"}}>
      {sideTab==="portfolio"&&(function(){
        return<div>
          {/* Hero */}
          <div style={{marginBottom:isMobile?28:32}}>
            <div style={{width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,"+K.acc+"30,"+K.acc+"08)",border:"1px solid "+K.acc+"30",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><IC name="trending" size={28} color={K.acc}/></div>
            <h3 style={{fontSize:isMobile?22:24,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 10px",lineHeight:1.25}}>{"Think like an owner."}</h3>
            <p style={{fontSize:isMobile?14:14,color:K.dim,lineHeight:1.7,margin:"0 auto",maxWidth:360}}>{"Your first company takes 3 minutes to set up. Thesis, KPIs, and a plan — then you're in the system."}</p>
          </div>
          {/* 3-step path */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28,textAlign:"left",background:K.card,border:"1px solid "+K.bdr,borderRadius:16,padding:isMobile?"18px 16px":"20px 24px"}}>
            <div style={{fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600,marginBottom:6}}>{"Your first 3 minutes"}</div>
            {[
              {n:"1",color:K.grn,icon:"plus",title:"Add a company you own",desc:"We auto-fill name, sector & earnings date"},
              {n:"2",color:K.acc,icon:"lightbulb",title:"Write a one-paragraph thesis",desc:"Why do you own it? What needs to stay true?"},
              {n:"3",color:K.blue,icon:"target",title:"Pick 2 KPIs to track",desc:"We check them automatically at earnings"}
            ].map(function(step){return<div key={step.n} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 0",borderBottom:"1px solid "+K.bdr+":last-child{border:none}"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:step.color+"18",border:"1px solid "+step.color+"40",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:13,fontWeight:700,color:step.color,fontFamily:fm}}>{step.n}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:2}}>{step.title}</div>
                <div style={{fontSize:12,color:K.dim,lineHeight:1.4}}>{step.desc}</div>
              </div>
            </div>})}
          </div>
          {/* CTAs */}
          <button onClick={function(){setObStep(1)}} style={Object.assign({},S.btnP,{width:"100%",padding:isMobile?"14px":"12px 24px",fontSize:15,borderRadius:12,marginBottom:10})}>{"Get started →"}</button>
          <button onClick={function(){setCos(SAMPLE);try{localStorage.setItem("ta-onboarded","true")}catch(e){}setTimeout(function(){setSelId(SAMPLE[0].id);setDetailTab("dossier")},100)}} style={{display:"block",width:"100%",background:"none",border:"1px solid "+K.bdr,borderRadius:12,color:K.dim,fontSize:13,cursor:"pointer",padding:isMobile?"12px":"10px",fontFamily:fb}}>{"Explore with demo data first"}</button>
        </div>
      })()}
      {sideTab==="watchlist"&&<div>
        <div style={{width:56,height:56,borderRadius:16,background:K.acc+"12",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><IC name="search" size={24} color={K.acc}/></div>
        <h3 style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 8px"}}>{"Nothing on your watchlist yet"}</h3>
        <p style={{fontSize:14,color:K.dim,lineHeight:1.7,margin:"0 0 24px",maxWidth:340,marginLeft:"auto",marginRight:"auto"}}>{"Add companies you're researching but haven't bought yet. When the thesis is clear and price is right, promote them to your portfolio."}</p>
        <button onClick={function(){setModal({type:"add"})}} style={Object.assign({},S.btnP,{padding:"10px 24px",fontSize:14,borderRadius:10})}>{"+ Add to Watchlist"}</button>
      </div>}
      {sideTab==="toohard"&&<div>
        <div style={{width:56,height:56,borderRadius:16,background:K.red+"12",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><IC name="alert" size={24} color={K.red}/></div>
        <h3 style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 8px"}}>{"Too-Hard Pile is empty"}</h3>
        <p style={{fontSize:14,color:K.dim,lineHeight:1.7,margin:"0 0 4px",maxWidth:340,marginLeft:"auto",marginRight:"auto"}}>{"Companies outside your circle of competence. It takes wisdom to know what you don't know."}</p>
        <p style={{fontSize:13,color:K.dim,fontStyle:"italic",margin:"0 0 24px"}}>{"— Munger"}</p>
      </div>}
    </div>}
    {sideTab==="portfolio"&&filtered.length>0&&(dashSet.showHeatmap||dashSet.showSectors||dashSet.showDividends)&&<div style={{marginBottom:28}}>
      {/* Portfolio Heatmap */}
      {dashSet.showHeatmap&&function(){var withPrice=filtered.filter(function(c){var p=c.position||{};return p.currentPrice>0&&p.avgCost>0&&p.shares>0});
        if(withPrice.length<2)return null;
        return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",marginBottom:16}}>
          <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:14,fontFamily:fm}}>Portfolio Heatmap</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {withPrice.sort(function(a,b){return(b.position.shares*b.position.currentPrice)-(a.position.shares*a.position.currentPrice)}).map(function(c2){
              var pos2=c2.position;var pct=(pos2.currentPrice-pos2.avgCost)/pos2.avgCost*100;var val=pos2.shares*pos2.currentPrice;
              var totalVal=withPrice.reduce(function(s,x){return s+(x.position.shares*x.position.currentPrice)},0);var weight=val/totalVal*100;
              var clr=pct>=20?"#00C853":pct>=5?"#66BB6A":pct>=0?"#A5D6A7":pct>=-10?"#EF9A9A":pct>=-20?"#EF5350":"#C62828";
              var minW=Math.max(60,weight*3);
              return<div key={c2.id} onClick={function(){setSelId(c2.id)}} style={{background:clr+"20",border:"1px solid "+clr+"40",borderRadius:6,padding:"8px 12px",cursor:"pointer",minWidth:minW,flex:weight>15?"1 1 "+minW+"px":"0 1 "+minW+"px"}}>
                <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c2.ticker}</div>
                <div style={{fontSize:14,fontWeight:700,color:clr,fontFamily:fm}}>{pct>=0?"+":""}{pct.toFixed(1)}%</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{weight.toFixed(0)}% of portfolio</div></div>})}</div></div>}()}
      <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:(dashSet.showSectors&&dashSet.showDividends)?"1fr 1fr":"1fr",gap:16}}>
      {/* Sector Concentration (value-weighted) */}
      {dashSet.showSectors&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
        <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:14,fontFamily:fm}}>Sector Concentration</div>
        {function(){var sectorVal={};var totalVal=0;
          filtered.forEach(function(c2){var s=c2.sector||"Other";var pos2=c2.position||{};var val=pos2.shares>0&&pos2.currentPrice>0?pos2.shares*pos2.currentPrice:0;sectorVal[s]=(sectorVal[s]||0)+val;totalVal+=val});
          var useValue=totalVal>0;
          return Object.keys(useValue?sectorVal:sectors).sort(function(a,b){return(useValue?sectorVal[b]-sectorVal[a]:sectors[b]-sectors[a])}).map(function(s){
            var pct=useValue?Math.round(sectorVal[s]/totalVal*100):Math.round(sectors[s]/filtered.length*100);
            var warn=pct>=50;
            return<div key={s} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:K.mid}}>{s}</span><span style={{fontSize:12,color:warn?K.amb:K.dim,fontWeight:warn?600:400,fontFamily:fm}}>{pct}%{warn?" ⚠":""}</span></div>
              <div style={{height:4,borderRadius:2,background:K.bdr}}><div style={{height:"100%",width:pct+"%",borderRadius:2,background:warn?K.amb:K.acc}}/></div></div>})}()}</div>}
      {/* Dividends */}
      {dashSet.showDividends&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
        <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:14,fontFamily:fm}}>Dividend Dashboard</div>
        {divCos.length===0&&<div style={{fontSize:13,color:K.dim,padding:"16px 0",textAlign:"center"}}>No dividend-paying holdings detected.<br/><span style={{fontSize:12}}>Dividend data is auto-fetched when you add companies.</span></div>}
        {divCos.length>0&&(function(){
          var totalVal3=divCos.reduce(function(s2,c2){var p2=c2.position||{};return s2+(p2.shares||0)*(p2.currentPrice||0)},0);
          var portYield=totalVal3>0?totalAnnualDiv/totalVal3*100:0;
          var monthlyInc=totalAnnualDiv/12;
          // Per-holding breakdown
          var holdings=divCos.map(function(c2){var p2=c2.position||{};var dps=c2.divPerShare||c2.lastDiv||0;
            var mult=c2.divFrequency==="monthly"?12:c2.divFrequency==="semi"?2:c2.divFrequency==="annual"?1:4;
            var annDiv2=dps*mult;var yld=p2.currentPrice?annDiv2/p2.currentPrice*100:0;
            var yoc=p2.avgCost>0?annDiv2/p2.avgCost*100:0;var annPay=(p2.shares||0)*annDiv2;
            var paySnap=c2.financialSnapshot&&c2.financialSnapshot.payoutRatio;
            var payoutPct=paySnap?parseFloat((paySnap.value||"0").replace(/[^0-9.]/g,""))||0:0;
            return{id:c2.id,ticker:c2.ticker,domain:c2.domain,dps:dps,freq:c2.divFrequency,annDiv:annDiv2,yield:yld,yoc:yoc,annPay:annPay,shares:p2.shares||0,exDiv:c2.exDivDate||"",payout:payoutPct}}).sort(function(a,b){return b.annPay-a.annPay});
          // Monthly income chart (estimate based on frequency)
          var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          var monthlyArr=months.map(function(){return 0});
          holdings.forEach(function(h2){if(h2.shares<=0)return;
            var payMonths=estimatePayMonths({divFrequency:h2.freq,exDivDate:h2.exDiv});
            payMonths.forEach(function(mi){monthlyArr[mi]+=h2.dps*h2.shares})});
          var maxMonth=Math.max.apply(null,monthlyArr)||1;
          // Upcoming ex-div dates
          var upcoming2=holdings.filter(function(h2){return h2.exDiv&&new Date(h2.exDiv)>=new Date()}).sort(function(a,b){return a.exDiv>b.exDiv?1:-1});
          return<div>
            {/* Summary cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{padding:"12px 14px",background:K.bg,borderRadius:8,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:K.grn,fontFamily:fm}}>${totalAnnualDiv.toFixed(0)}</div>
                <div style={{fontSize:8,color:K.dim}}>Est. Annual Income</div></div>
              <div style={{padding:"12px 14px",background:K.bg,borderRadius:8,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:K.acc,fontFamily:fm}}>{portYield.toFixed(2)}%</div>
                <div style={{fontSize:8,color:K.dim}}>Portfolio Yield</div></div>
              <div style={{padding:"12px 14px",background:K.bg,borderRadius:8,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:K.txt,fontFamily:fm}}>${monthlyInc.toFixed(0)}</div>
                <div style={{fontSize:8,color:K.dim}}>Monthly (avg)</div></div></div>
            {!isPro&&<div style={{fontSize:11,color:K.acc,marginBottom:12,textAlign:"center",cursor:"pointer"}} onClick={function(){setShowUpgrade(true);setUpgradeCtx("dividends")}}>Upgrade for monthly income chart, yield on cost, payout safety analysis</div>}
            {/* Monthly income chart */}
            {isPro&&<div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:6}}>Monthly Income Estimate</div>
              <div style={{display:"flex",gap:3,alignItems:"flex-end",height:60}}>
                {monthlyArr.map(function(v2,mi){return<div key={mi} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{width:"100%",height:Math.max(v2/maxMonth*50,2),borderRadius:3,background:v2>0?K.grn:K.bdr,marginBottom:3}}/>
                  <div style={{fontSize:7,color:K.dim,fontFamily:fm}}>{months[mi]}</div>
                  {v2>0&&<div style={{fontSize:7,color:K.grn,fontFamily:fm}}>${v2.toFixed(0)}</div>}</div>})}</div></div>}
            {/* Holdings table */}
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",fontSize:10,color:K.dim,fontFamily:fm,padding:"4px 0",borderBottom:"1px solid "+K.bdr,gap:0}}>
                <span style={{width:28}}/>
                <span style={{flex:1}}>Ticker</span>
                <span style={{width:55,textAlign:"right"}}>Div/Share</span>
                <span style={{width:50,textAlign:"right"}}>Yield</span>
                {isPro&&<span style={{width:50,textAlign:"right"}}>YOC</span>}
                <span style={{width:60,textAlign:"right"}}>Income</span>
                {isPro&&<span style={{width:50,textAlign:"right"}}>Payout</span>}</div>
              {holdings.map(function(h2){var safeColor=h2.payout>0?(h2.payout<60?K.grn:h2.payout<80?K.amb:K.red):K.dim;
                return<div key={h2.id} style={{display:"flex",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+K.bdr+"30",gap:0,cursor:"pointer"}} onClick={function(){setSelId(h2.id);setDetailTab("dossier");setPage("dashboard")}}>
                  <span style={{width:28}}><CoLogo domain={h2.domain} ticker={h2.ticker} size={18}/></span>
                  <span style={{flex:1}}><span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{h2.ticker}</span></span>
                  <span style={{width:55,textAlign:"right",fontSize:11,color:K.mid,fontFamily:fm}}>${h2.dps.toFixed(2)}/{h2.freq==="monthly"?"mo":h2.freq==="semi"?"semi":h2.freq==="annual"?"yr":"q"}</span>
                  <span style={{width:50,textAlign:"right",fontSize:11,color:K.grn,fontFamily:fm}}>{h2.yield.toFixed(1)}%</span>
                  {isPro&&<span style={{width:50,textAlign:"right",fontSize:11,color:h2.yoc>h2.yield?K.grn:K.txt,fontFamily:fm}}>{h2.yoc>0?h2.yoc.toFixed(1)+"%":"--"}</span>}
                  <span style={{width:60,textAlign:"right",fontSize:11,fontWeight:600,color:K.grn,fontFamily:fm}}>{h2.shares>0?"$"+h2.annPay.toFixed(0):"--"}</span>
                  {isPro&&<span style={{width:50,textAlign:"right",fontSize:11,color:safeColor,fontFamily:fm}}>{h2.payout>0?h2.payout.toFixed(0)+"%":"--"}</span>}</div>})}</div>
            {/* Upcoming ex-div dates */}
            {upcoming2.length>0&&<div style={{padding:"10px 12px",background:K.bg,borderRadius:8,marginBottom:8}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:6}}>Upcoming Ex-Dividend Dates</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {upcoming2.slice(0,5).map(function(h2){var dU2=Math.ceil((new Date(h2.exDiv)-new Date())/864e5);return<div key={h2.ticker} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",borderRadius:4,border:"1px solid "+K.amb+"25",background:K.amb+"06"}}>
                  <span style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm}}>{h2.ticker}</span>
                  <span style={{fontSize:10,color:K.amb,fontFamily:fm}}>{dU2<=0?"Today":dU2+"d"}</span></div>})}</div></div>}
            {/* Yield on cost explanation */}
            <div style={{fontSize:10,color:K.dim,lineHeight:1.5,padding:"6px 0"}}>YOC = Yield on Cost (annual dividend / your purchase price). Higher YOC than current yield means the dividend has grown since you bought. Payout ratio under 60% is generally considered safe.</div>
          </div>})()}
      </div>}</div></div>}
    </div>}
  var contentKey=(page||"dash")+"-"+(selId||"none")+"-"+(subPage||"main");
  return(<div style={{display:"flex",height:"100vh",background:K.bg,color:K.txt,fontFamily:fb,overflow:"hidden"}}>{renderModal()}{showUpgrade&&<UpgradeModal/>}{obStep>0&&<OnboardingFlow K={K} S={S} fm={fm} fb={fb} fh={fh} isDark={isDark} isMobile={isMobile} cSym={cSym} nId={nId} cos={cos} setCos={setCos} selId={selId} setSelId={setSelId} obStep={obStep} setObStep={setObStep} obPath={obPath} setObPath={setObPath} oTicker={oTicker} setOTicker={setOTicker} oName={oName} setOName={setOName} oSector={oSector} setOSector={setOSector} oLook={oLook} setOLook={setOLook} oDomain={oDomain} setODomain={setODomain} oIndustry={oIndustry} setOIndustry={setOIndustry} oPrice={oPrice} setOPrice={setOPrice} oStyle={oStyle} setOStyle={setOStyle} oTCore={oTCore} setOTCore={setOTCore} oTMoat={oTMoat} setOTMoat={setOTMoat} oTRisk={oTRisk} setOTRisk={setOTRisk} oTSell={oTSell} setOTSell={setOTSell} oKpiSel={oKpiSel} setOKpiSel={setOKpiSel} oKpiTargets={oKpiTargets} setOKpiTargets={setOKpiTargets} oCoId={oCoId} setOCoId={setOCoId} oShares={oShares} setOShares={setOShares} oAvgCost={oAvgCost} setOAvgCost={setOAvgCost} oPurchDate={oPurchDate} setOPurchDate={setOPurchDate} oTmrRef={_oTmrRef} upd={upd} lookupTicker={lookupTicker} finishOnboarding={finishOnboarding} setDetailTab={setDetailTab} setGuidedSetup={setGuidedSetup} setTourStep={setTourStep} INVEST_STYLES={INVEST_STYLES} STYLE_MAP={STYLE_MAP} METRIC_MAP={METRIC_MAP} SAMPLE={SAMPLE} IC={IC} TLogo={TLogo}/>}{tourStep>0&&<DossierTour/>}
    {/* ── Weekly Insight Overlay ── */}

    {/* === QUARTERLY LETTER POPUP === */}
    {showQLetter&&(function(){
      var parts=showQLetter.split("-");var qNum=parseInt(parts[0].replace("Q",""));var qYear=parseInt(parts[1]);
      var qLabels=["","Jan \u2014 Mar","Apr \u2014 Jun","Jul \u2014 Sep","Oct \u2014 Dec"];
      var qTitle="Q"+qNum+" "+qYear;var qRange=qLabels[qNum]||"";
      var cut3=new Date(qYear,(qNum-1)*3,1).toISOString();var cutEnd=new Date(qYear,qNum*3,0).toISOString();
      var portfolio2=cos.filter(function(c2){return(c2.status||"portfolio")==="portfolio"});
      var portChar=classifyPortfolio(portfolio2);
      var portCharLabel=portChar.summary||portChar.label;var portCharColor=portChar.color;
      var qRevs=weeklyReviews.filter(function(r2){return r2.date>=cut3&&r2.date<=cutEnd});
      var qDecs=[];cos.forEach(function(c2){(c2.decisions||[]).forEach(function(d2){if(d2.date&&d2.date>=cut3&&d2.date<=cutEnd)qDecs.push(Object.assign({},d2,{ticker:c2.ticker}))})});
      var buys2=qDecs.filter(function(d2){return d2.action==="BUY"||d2.action==="ADD"});
      var sells2=qDecs.filter(function(d2){return d2.action==="SELL"||d2.action==="TRIM"});
      var held2=portfolio2.filter(function(c2){var p2=c2.position||{};return p2.shares>0&&p2.avgCost>0&&p2.currentPrice>0});
      var totalCost2=held2.reduce(function(s2,c2){return s2+(c2.position.shares*c2.position.avgCost)},0);
      var totalVal2=held2.reduce(function(s2,c2){return s2+(c2.position.shares*c2.position.currentPrice)},0);
      var totalRet2=totalCost2>0?((totalVal2-totalCost2)/totalCost2*100):0;var pnl=totalVal2-totalCost2;
      var perfArr=held2.map(function(c2){var p2=c2.position;return{ticker:c2.ticker,ret:((p2.currentPrice-p2.avgCost)/p2.avgCost*100),val:p2.shares*p2.currentPrice,conv:c2.conviction||0,domain:c2.domain}}).sort(function(a,b){return b.ret-a.ret});
      var best2=perfArr[0];var worst2=perfArr.length>1?perfArr[perfArr.length-1]:null;
      var shifts=[];cos.forEach(function(c2){(c2.convictionHistory||[]).forEach(function(cv){if(cv.date&&cv.date>=cut3&&cv.date<=cutEnd)shifts.push({ticker:c2.ticker,rating:cv.rating,note:cv.note||""})})});
      var totalKpis=0;var metKpis=0;portfolio2.forEach(function(c2){c2.kpis.forEach(function(k){if(k.lastResult){totalKpis++;if(k.lastResult.status==="met")metKpis++}})});
      var kpiHitRate=totalKpis>0?Math.round(metKpis/totalKpis*100):0;
      var qDivIncome=0;portfolio2.forEach(function(c2){var dps2=c2.divPerShare||c2.lastDiv||0;if(dps2<=0)return;var pos2=c2.position||{};var mult2=c2.divFrequency==="monthly"?3:c2.divFrequency==="quarterly"?1:c2.divFrequency==="semi"?0.5:0.25;qDivIncome+=(pos2.shares||0)*dps2*mult2});
      var os2=calcOwnerScore(cos);var avgConv=portfolio2.length>0?Math.round(portfolio2.reduce(function(s,c2){return s+(c2.conviction||0)},0)/portfolio2.length*10)/10:0;
      var streakWeeks=streakData.current||0;
      var freshT=portfolio2.filter(function(c2){return c2.thesisUpdatedAt&&Math.ceil((new Date()-new Date(c2.thesisUpdatedAt))/864e5)<90}).length;
      var staleT=portfolio2.filter(function(c2){return c2.thesisNote&&c2.thesisNote.trim().length>20&&(!c2.thesisUpdatedAt||Math.ceil((new Date()-new Date(c2.thesisUpdatedAt))/864e5)>=90)}).length;
      var moatCount=portfolio2.filter(function(c2){var mt2=c2.moatTypes||{};return Object.keys(mt2).some(function(k){return mt2[k]&&mt2[k].active})}).length;
      var scenarioCount=portfolio2.filter(function(c2){return(c2.scenarios||[]).length>0}).length;
      var totalScenarios=portfolio2.reduce(function(s,c2){return s+(c2.scenarios||[]).length},0);
      var earningsChecked=portfolio2.filter(function(c2){return c2.lastChecked&&c2.lastChecked>=cut3}).length;
      var qNotes=0;cos.forEach(function(c2){(c2.docs||[]).forEach(function(d){if(d.updatedAt&&d.updatedAt>=cut3&&d.updatedAt<=cutEnd)qNotes++})});
      var upcomingE=portfolio2.filter(function(c2){return c2.earningsDate&&c2.earningsDate!=="TBD"&&dU(c2.earningsDate)>=0&&dU(c2.earningsDate)<=30}).sort(function(a,b){return dU(a.earningsDate)-dU(b.earningsDate)});
      var scored2=qDecs.filter(function(d2){return d2.outcome});var rights2=scored2.filter(function(d2){return d2.outcome==="right"}).length;
      function dismiss(){var nl=Object.assign({},qLetters);nl[showQLetter]=true;setQLetters(nl);try{localStorage.setItem("ta-qletters",JSON.stringify(nl))}catch(e){}setShowQLetter(null)}
      function QSH(p){return<div style={{fontSize:10,letterSpacing:_isThesis?1:2.5,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:800,marginTop:24,marginBottom:10,paddingBottom:6,borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"center",gap:8}}><div style={{width:4,height:14,borderRadius:2,background:p.color||K.acc}}/>{p.children}</div>}
      // Personalized observations
      var obs=[];
      var highConvLow=perfArr.filter(function(hp){return hp.conv>=8}).sort(function(a,b){return a.val-b.val});
      if(highConvLow.length>0&&perfArr.length>=3){var hc=highConvLow[0];var hcRank=perfArr.indexOf(hc)+1;if(hcRank>perfArr.length/2)obs.push("Your highest-conviction holding ("+hc.ticker+" at "+hc.conv+"/10) is among the smaller positions. Your sizing and conviction tell different stories.")}
      var lowConvHigh=perfArr.filter(function(hp){return hp.conv>0&&hp.conv<=4}).sort(function(a,b){return b.val-a.val});
      if(lowConvHigh.length>0&&perfArr.length>=3){var lc=lowConvHigh[0];var lcRank=perfArr.indexOf(lc)+1;if(lcRank<=2)obs.push(lc.ticker+" is one of your largest positions, but conviction is only "+lc.conv+"/10. Worth reflecting on whether that disconnect is intentional.")}
      var staleList=portfolio2.filter(function(c2){return c2.thesisNote&&c2.thesisNote.trim().length>20&&c2.thesisUpdatedAt}).sort(function(a,b){return new Date(a.thesisUpdatedAt)-new Date(b.thesisUpdatedAt)});
      if(staleList.length>0){var oldest=staleList[0];var days=Math.ceil((new Date()-new Date(oldest.thesisUpdatedAt))/864e5);if(days>120)obs.push("Your "+oldest.ticker+" thesis was last updated "+days+" days ago. Markets change; does your reasoning still hold?")}
      if(perfArr.length>=2&&totalVal2>0){var topWeight=perfArr[0].val/totalVal2*100;if(topWeight>40)obs.push(perfArr[0].ticker+" represents "+topWeight.toFixed(0)+"% of your portfolio. Concentrated positions amplify both conviction and risk.")}
      var highRoic=portfolio2.filter(function(c2){var s=c2.financialSnapshot||{};return s.roic&&s.roic.numVal&&s.roic.numVal>20});
      if(highRoic.length>0&&portfolio2.length>=3)obs.push(highRoic.length+" of your "+portfolio2.length+" holdings have ROIC above 20%. Your portfolio leans toward capital-efficient businesses.");
      if(scored2.length>=3){var rightPct=Math.round(rights2/scored2.length*100);obs.push("You scored "+scored2.length+" decisions this quarter \u2014 "+rightPct+"% were marked correct. Tracking outcomes builds better judgment.")}
      if(qDivIncome>0){var divPayers2=portfolio2.filter(function(c2){return(c2.divPerShare||c2.lastDiv)>0});obs.push("You receive income from "+divPayers2.length+" dividend payers. Estimated quarterly income of $"+Math.round(qDivIncome)+" compounds quietly in the background.")}
      if(scenarioCount>0&&scenarioCount<portfolio2.length)obs.push(scenarioCount+" of "+portfolio2.length+" holdings have pre-mortem plans. The unplanned ones are the most vulnerable in a downturn.");
      var withDate=portfolio2.filter(function(c2){return c2.purchaseDate});
      if(withDate.length>0){var avgDays=Math.round(withDate.reduce(function(s,c2){return s+Math.ceil((new Date()-new Date(c2.purchaseDate))/864e5)},0)/withDate.length);if(avgDays>365)obs.push("Your average holding period is "+Math.round(avgDays/30)+" months. Long-term ownership is where compounding happens.")}
      // PDF export
      function exportPDF(){var h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quarterly Letter '+qTitle+'</title><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:20mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,sans-serif;color:#1a1a2e;font-size:11px;line-height:1.7}.page{max-width:680px;margin:0 auto;padding:40px}h1{font-family:Playfair Display,serif;font-size:36px;font-weight:800;letter-spacing:-1px}.sh{font-size:9px;letter-spacing:3px;text-transform:uppercase;font-family:JetBrains Mono,monospace;font-weight:800;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #1a1a2e}.kstats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:16px 0 20px}.ks{padding:14px 12px;text-align:center;border-right:1px solid #e5e7eb}.ks:last-child{border-right:none}.ks-l{font-family:JetBrains Mono,monospace;font-size:7.5px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:4px}.ks-v{font-family:JetBrains Mono,monospace;font-size:20px;font-weight:800}.ks-s{font-size:9px;color:#9ca3af;margin-top:2px}table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px}th{font-family:JetBrains Mono,monospace;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;padding:6px 10px;border-bottom:2px solid #e5e7eb;font-weight:700;text-align:left}td{padding:7px 10px;border-bottom:1px solid #f3f4f6}.mono{font-family:JetBrains Mono,monospace}.grn{color:#16a34a}.red{color:#dc2626}.pg{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px}.pc{padding:10px;border:1px solid #e5e7eb;border-radius:8px;text-align:center}.pc-v{font-family:JetBrains Mono,monospace;font-size:16px;font-weight:800}.pc-l{font-size:8px;color:#9ca3af;margin-top:2px}.footer{margin-top:36px;padding-top:12px;border-top:2px solid #1a1a2e;display:flex;justify-content:space-between;font-size:8px;color:#9ca3af}</style></head><body><div class="page">';
        h+='<div style="border-bottom:3px solid #1a1a2e;padding-bottom:16px;margin-bottom:24px"><div style="display:flex;justify-content:space-between"><div><h1>Quarterly Letter</h1><div style="font-size:13px;color:#6b7280;margin-top:4px">'+qTitle+' \u2014 '+qRange+'</div><div style="font-size:10px;color:'+portCharColor+';font-family:JetBrains Mono,monospace;font-style:italic;margin-top:6px">'+portCharLabel+'</div></div><div style="text-align:right"><div style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:800;letter-spacing:3px">THESISALPHA</div><div style="font-size:9px;color:#9ca3af">Owner\'s Report</div></div></div></div>';
        h+='<p style="font-size:12px;line-height:1.8;margin-bottom:16px">Dear '+(username||"Investor")+',</p>';
        h+='<p style="font-size:12px;line-height:1.8;margin-bottom:16px">This quarter: <strong>'+qRevs.length+'</strong> reviews, <strong>'+qDecs.length+'</strong> decisions, <strong>'+earningsChecked+'</strong> earnings checked. Portfolio: <strong>'+portfolio2.length+'</strong> holdings.</p>';
        h+='<div class="kstats"><div class="ks"><div class="ks-l">Total Return</div><div class="ks-v '+(totalRet2>=0?"grn":"red")+'">'+(totalRet2>=0?"+":"")+totalRet2.toFixed(1)+'%</div></div>';
        if(best2)h+='<div class="ks"><div class="ks-l">Best</div><div class="ks-v grn">'+best2.ticker+'</div><div class="ks-s">'+(best2.ret>=0?"+":"")+best2.ret.toFixed(0)+'%</div></div>';
        h+='<div class="ks"><div class="ks-l">KPI Hit</div><div class="ks-v">'+kpiHitRate+'%</div></div>';
        h+='<div class="ks"><div class="ks-l">Div Income</div><div class="ks-v '+(qDivIncome>0?"grn":"")+'">$'+Math.round(qDivIncome)+'</div></div></div>';
        if(perfArr.length>0){h+='<div class="sh">Holdings</div><table><thead><tr><th>Ticker</th><th style="text-align:right">Return</th><th style="text-align:right">Value</th><th style="text-align:center">Conv</th></tr></thead><tbody>';perfArr.slice(0,10).forEach(function(hp){h+='<tr><td class="mono" style="font-weight:700">'+hp.ticker+'</td><td class="mono" style="text-align:right;color:'+(hp.ret>=0?"#16a34a":"#dc2626")+'">'+(hp.ret>=0?"+":"")+hp.ret.toFixed(1)+'%</td><td class="mono" style="text-align:right">$'+(hp.val>=1e3?(hp.val/1e3).toFixed(1)+"k":hp.val.toFixed(0))+'</td><td style="text-align:center" class="mono">'+(hp.conv>0?hp.conv+"/10":"\u2014")+'</td></tr>'});h+='</tbody></table>'}
        h+='<div class="sh">Process</div><div class="pg"><div class="pc"><div class="pc-v">'+os2.total+'</div><div class="pc-l">Owner\'s Score</div></div><div class="pc"><div class="pc-v">'+streakWeeks+'</div><div class="pc-l">Streak</div></div><div class="pc"><div class="pc-v">'+moatCount+'/'+portfolio2.length+'</div><div class="pc-l">Moats</div></div><div class="pc"><div class="pc-v">'+scenarioCount+'/'+portfolio2.length+'</div><div class="pc-l">Stress-Tested</div></div></div>';
        if(obs.length>0){h+='<div class="sh">Observations</div>';obs.slice(0,4).forEach(function(o){h+='<p style="font-size:11px;line-height:1.7;margin-bottom:8px;padding-left:12px;border-left:2px solid #e5e7eb">'+o+'</p>'})}
        h+='<p style="font-size:12px;font-style:italic;color:#6b7280;margin-top:20px;line-height:1.8">'+(qRevs.length>=10?"Exceptional discipline. Your process is compounding.":qRevs.length>=4?"Solid quarter. Consistency is your edge.":"Every journey starts with a step. Build the habit next quarter.")+'</p>';
        h+='<div class="footer"><div><strong style="font-family:JetBrains Mono,monospace;letter-spacing:3px;color:#1a1a2e;font-size:10px">THESISALPHA</strong><div style="margin-top:4px">For personal use only. Not financial advice.</div></div><div style="text-align:right">'+new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})+'</div></div></div></body></html>';
        var w2=window.open("","_blank");if(w2){w2.document.write(h);w2.document.close();setTimeout(function(){w2.print()},800)}}
      return<div style={{position:"fixed",inset:0,zIndex:10003,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.65)",backdropFilter:"blur(10px)"}} onClick={dismiss}>
        <div style={{background:K.card,borderRadius:_isThesis?24:16,maxWidth:600,width:"92%",maxHeight:"88vh",overflowY:"auto",padding:_isThesis?"36px 40px":"32px 36px",position:"relative",boxShadow:"0 24px 80px rgba(0,0,0,.4)"}} onClick={function(e){e.stopPropagation()}}>
          {/* Cover */}
          <div style={{borderBottom:"3px solid "+K.txt,paddingBottom:16,marginBottom:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div><div style={{fontSize:28,fontWeight:800,color:K.txt,fontFamily:fh,letterSpacing:"-0.5px"}}>Quarterly Letter</div>
                <div style={{fontSize:14,color:K.dim,marginTop:4}}>{qTitle+" \u2014 "+qRange}</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                  <span style={{fontSize:11,color:portCharColor,fontFamily:fm,fontWeight:700,letterSpacing:.5,background:portCharColor+"18",padding:"2px 10px",borderRadius:999}}>{portCharLabel}</span>
                </div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:11,fontWeight:800,letterSpacing:3,color:K.txt,fontFamily:fm}}>THESISALPHA</div>
                <div style={{fontSize:10,color:K.dim,letterSpacing:1,textTransform:"uppercase"}}>{"Owner\u2019s Report"}</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:6}}>{new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div></div></div></div>
          {/* Salutation + summary */}
          <div style={{fontSize:14,color:K.mid,lineHeight:1.85,marginBottom:20}}>{"Dear "+(username||"Investor")+","}<br/><br/>{"This quarter you completed "}<strong style={{color:K.txt}}>{qRevs.length}</strong>{" weekly reviews, logged "}<strong style={{color:K.txt}}>{qDecs.length}</strong>{" decisions, and checked earnings on "}<strong style={{color:K.txt}}>{earningsChecked}</strong>{" holdings. "}{buys2.length>0&&<span>{"Added to "}<strong style={{color:K.grn}}>{buys2.map(function(b){return b.ticker}).filter(function(v,i,a){return a.indexOf(v)===i}).join(", ")}</strong>{". "}</span>}{sells2.length>0&&<span>{"Exited "}<strong style={{color:K.red}}>{sells2.map(function(s3){return s3.ticker}).filter(function(v,i,a){return a.indexOf(v)===i}).join(", ")}</strong>{". "}</span>}{"Portfolio: "}<strong style={{color:K.txt}}>{portfolio2.length}</strong>{" companies."}</div>
          {/* Performance banner */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:0,border:"1px solid "+K.bdr,borderRadius:10,overflow:"hidden",marginBottom:24}}>
            <div style={{padding:"14px 10px",textAlign:"center",borderRight:"1px solid "+K.bdr}}><div style={{fontSize:7,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:4}}>Total Return</div><div style={{fontSize:22,fontWeight:800,color:totalRet2>=0?K.grn:K.red,fontFamily:fm}}>{totalRet2>=0?"+":""}{totalRet2.toFixed(1)}%</div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>${(pnl>=0?"+":"")+Math.round(pnl).toLocaleString()}</div></div>
            {best2&&<div style={{padding:"14px 10px",textAlign:"center",borderRight:"1px solid "+K.bdr}}><div style={{fontSize:7,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:4}}>Best</div><div style={{fontSize:18,fontWeight:800,color:K.grn,fontFamily:fm}}>{best2.ticker}</div><div style={{fontSize:10,color:K.grn,fontFamily:fm}}>{best2.ret>=0?"+":""}{best2.ret.toFixed(0)}%</div></div>}
            {worst2&&worst2.ticker!==(best2&&best2.ticker)?<div style={{padding:"14px 10px",textAlign:"center",borderRight:"1px solid "+K.bdr}}><div style={{fontSize:7,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:4}}>Weakest</div><div style={{fontSize:18,fontWeight:800,color:K.red,fontFamily:fm}}>{worst2.ticker}</div><div style={{fontSize:10,color:K.red,fontFamily:fm}}>{worst2.ret>=0?"+":""}{worst2.ret.toFixed(0)}%</div></div>:<div style={{padding:"14px 10px",textAlign:"center",borderRight:"1px solid "+K.bdr}}/>}
            <div style={{padding:"14px 10px",textAlign:"center"}}><div style={{fontSize:7,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:4}}>Div Income</div><div style={{fontSize:18,fontWeight:800,color:qDivIncome>0?K.grn:K.dim,fontFamily:fm}}>${Math.round(qDivIncome)}</div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>this quarter</div></div></div>
          {/* Holdings */}
          {perfArr.length>0&&<div><QSH color={K.blue}>Holdings Snapshot</QSH><div style={{marginBottom:20}}>{perfArr.slice(0,10).map(function(hp,hi){return<div key={hp.ticker} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:hi<Math.min(perfArr.length,10)-1?"1px solid "+K.bdr+"30":"none"}}><CoLogo domain={hp.domain} ticker={hp.ticker} size={18}/><span style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,width:48}}>{hp.ticker}</span><span style={{fontSize:12,fontWeight:700,color:hp.ret>=0?K.grn:K.red,fontFamily:fm,width:60,textAlign:"right"}}>{hp.ret>=0?"+":""}{hp.ret.toFixed(1)}%</span><span style={{fontSize:11,color:K.dim,fontFamily:fm,width:56,textAlign:"right"}}>${hp.val>=1e3?(hp.val/1e3).toFixed(1)+"k":hp.val.toFixed(0)}</span><span style={{marginLeft:"auto",fontSize:11,color:hp.conv>=7?K.grn:hp.conv>=4?K.amb:hp.conv>0?K.red:K.dim,fontFamily:fm}}>{hp.conv>0?hp.conv+"/10":"\u2014"}</span></div>})}</div></div>}
          {/* KPIs */}
          {totalKpis>0&&<div><QSH color={K.grn}>KPI Scorecard</QSH><div style={{display:"flex",gap:8,marginBottom:10}}><div style={{flex:1,padding:"10px",background:K.grn+"08",borderRadius:8,textAlign:"center",border:"1px solid "+K.grn+"20"}}><div style={{fontSize:20,fontWeight:800,color:K.grn,fontFamily:fm}}>{kpiHitRate}%</div><div style={{fontSize:8,color:K.dim}}>Hit Rate</div></div><div style={{flex:1,padding:"10px",background:K.bg,borderRadius:8,textAlign:"center",border:"1px solid "+K.bdr}}><div style={{fontSize:20,fontWeight:800,color:K.grn,fontFamily:fm}}>{metKpis}</div><div style={{fontSize:8,color:K.dim}}>Met</div></div><div style={{flex:1,padding:"10px",background:K.bg,borderRadius:8,textAlign:"center",border:"1px solid "+K.bdr}}><div style={{fontSize:20,fontWeight:800,color:K.red,fontFamily:fm}}>{totalKpis-metKpis}</div><div style={{fontSize:8,color:K.dim}}>Missed</div></div></div><div style={{fontSize:12,color:K.mid,lineHeight:1.6}}>{kpiHitRate>=70?"Strong execution \u2014 thesis assumptions holding.":kpiHitRate>=40?"Mixed results \u2014 consider revising persistent misses.":"Several misses \u2014 review whether theses need updating."}</div></div>}
          {/* Process */}
          <QSH color={K.acc}>Process Discipline</QSH>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>{[{v:os2.total,l:"Owner\u2019s Score",c:os2.total>=70?K.grn:os2.total>=40?K.amb:K.red},{v:streakWeeks+"wk",l:"Streak",c:streakWeeks>=4?K.grn:streakWeeks>=1?K.amb:K.dim},{v:avgConv,l:"Avg Conviction",c:avgConv>=7?K.grn:avgConv>=4?K.amb:K.dim},{v:qRevs.length,l:"Reviews",c:qRevs.length>=8?K.grn:qRevs.length>=4?K.amb:K.dim}].map(function(m){return<div key={m.l} style={{padding:"10px",background:K.bg,borderRadius:8,textAlign:"center",border:"1px solid "+K.bdr}}><div style={{fontSize:16,fontWeight:800,color:m.c,fontFamily:fm}}>{m.v}</div><div style={{fontSize:7.5,color:K.dim,fontFamily:fm}}>{m.l}</div></div>})}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>{[{v:moatCount+"/"+portfolio2.length,l:"Moats",c:moatCount>=portfolio2.length?K.grn:K.amb},{v:scenarioCount+"/"+portfolio2.length,l:"Stress-Tested",c:scenarioCount>=portfolio2.length?K.grn:K.amb},{v:freshT,l:"Fresh Theses",c:freshT>=portfolio2.length?K.grn:K.amb},{v:qNotes,l:"Notes",c:qNotes>0?K.txt:K.dim}].map(function(m){return<div key={m.l} style={{padding:"10px",background:K.bg,borderRadius:8,textAlign:"center",border:"1px solid "+K.bdr}}><div style={{fontSize:16,fontWeight:800,color:m.c,fontFamily:fm}}>{m.v}</div><div style={{fontSize:7.5,color:K.dim,fontFamily:fm}}>{m.l}</div></div>})}</div>
          {/* Conviction shifts */}
          {shifts.length>0&&<div><QSH color={K.amb}>Conviction Shifts</QSH><div style={{marginBottom:12}}>{shifts.slice(0,6).map(function(s3,i){return<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid "+K.bdr+"20"}}><span style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,width:44}}>{s3.ticker}</span><span style={{fontSize:13,fontWeight:800,color:s3.rating>=7?K.grn:s3.rating>=4?K.amb:K.red,fontFamily:fm}}>{s3.rating}/10</span>{s3.note&&<span style={{fontSize:11,color:K.dim,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s3.note}</span>}</div>})}</div></div>}
          {/* Dividends */}
          {qDivIncome>0&&<div><QSH color={K.grn}>Dividend Income</QSH><div style={{fontSize:13,color:K.mid,lineHeight:1.7}}>{"Estimated this quarter: "}<strong style={{color:K.grn}}>${Math.round(qDivIncome).toLocaleString()}</strong>{" \u2014 annualized: "}<strong style={{color:K.grn}}>${Math.round(qDivIncome*4).toLocaleString()}</strong>{"/year."}</div></div>}
          {/* Thesis health */}
          {(freshT>0||staleT>0||totalScenarios>0)&&<div><QSH color={"#9333EA"}>Thesis Health</QSH><div style={{fontSize:12,color:K.mid,lineHeight:1.7}}>{freshT>0&&<span><strong style={{color:K.grn}}>{freshT}</strong>{" fresh (<90d). "}</span>}{staleT>0&&<span><strong style={{color:K.amb}}>{staleT}</strong>{" need review. "}</span>}{totalScenarios>0&&<span><strong style={{color:K.acc}}>{totalScenarios}</strong>{" pre-mortem scenario"}{totalScenarios!==1?"s":""}{" across "}<strong>{scenarioCount}</strong>{" holdings."}</span>}</div></div>}
          {/* Observations */}
          {obs.length>0&&<div><QSH color={K.mid}>Observations</QSH><div style={{marginBottom:16}}>{obs.slice(0,4).map(function(o,i){return<div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<Math.min(obs.length,4)-1?"1px solid "+K.bdr+"20":"none"}}><div style={{width:3,height:3,borderRadius:"50%",background:K.acc,marginTop:7,flexShrink:0}}/><div style={{fontSize:12,color:K.mid,lineHeight:1.7}}>{o}</div></div>})}</div></div>}
          {/* Looking ahead */}
          {upcomingE.length>0&&<div><QSH color={K.amb}>Looking Ahead</QSH><div style={{fontSize:12,color:K.mid,lineHeight:1.7}}>{"Upcoming: "}{upcomingE.slice(0,5).map(function(c2,i){return<span key={c2.id}>{i>0?", ":""}<strong style={{color:K.txt}}>{c2.ticker}</strong>{" ("+dU(c2.earningsDate)+"d)"}</span>})}</div></div>}
          {/* Closing */}
          <div style={{fontSize:13,color:K.dim,fontStyle:"italic",marginTop:24,marginBottom:28,lineHeight:1.8,fontFamily:fb}}>{qRevs.length>=10?"Exceptional discipline. Your process is your edge \u2014 and it\u2019s compounding.":qRevs.length>=6?"Strong quarter. Consistency is the most underrated investment skill.":qRevs.length>=3?"Solid start. The investors who outperform aren\u2019t smarter \u2014 they\u2019re more disciplined.":"Every journey starts somewhere. Build the weekly habit next quarter."}</div>
          {/* Actions */}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",borderTop:"2px solid "+K.txt,paddingTop:14}}>
            <button onClick={function(){var eBody='<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e"><div style="border-bottom:3px solid #1a1a2e;padding-bottom:12px;margin-bottom:20px"><h1 style="font-family:Georgia,serif;font-size:24px;margin:0">Quarterly Letter</h1><div style="font-size:12px;color:#6b7280;margin-top:4px">'+qTitle+'</div></div><p style="line-height:1.8">Dear '+(username||"Investor")+', this quarter: <strong>'+qRevs.length+'</strong> reviews, <strong>'+qDecs.length+'</strong> decisions. Return: <strong style="color:'+(totalRet2>=0?"#16a34a":"#dc2626")+'">'+(totalRet2>=0?"+":"")+totalRet2.toFixed(1)+'%</strong>. Score: '+os2.total+'. KPI hit: '+kpiHitRate+'%.'+(qDivIncome>0?' Dividends: $'+Math.round(qDivIncome)+'.':'')+'</p><p style="font-style:italic;color:#9ca3af;margin-top:16px">The process compounds just like the returns.</p><div style="border-top:2px solid #1a1a2e;padding-top:10px;margin-top:20px;font-size:10px;color:#9ca3af"><strong style="color:#1a1a2e;letter-spacing:2px;font-family:monospace">THESISALPHA</strong></div></div>';sendQuarterlyLetterEmail(eBody,qTitle)}} style={Object.assign({},S.btn,{padding:"8px 16px",fontSize:12,display:"flex",alignItems:"center",gap:5})}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>Email</button>
            <button onClick={exportPDF} style={Object.assign({},S.btn,{padding:"8px 16px",fontSize:12,display:"flex",alignItems:"center",gap:5})}><IC name="file" size={12} color={K.mid}/>Export PDF</button>
            <button onClick={dismiss} style={Object.assign({},S.btnP,{padding:"8px 20px",fontSize:13})}>Close</button></div>
        </div></div>})()}
    {chestOverlay&&<div style={{position:"fixed",inset:0,zIndex:10002,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",animation:"fadeInFast .3s ease"}} onClick={function(){setChestOverlay(null)}}>
      <div className="ta-celebrate" style={{textAlign:"center",padding:"40px 48px",borderRadius:20,background:K.card,maxWidth:380,position:"relative",overflow:"hidden",border:"1px solid "+K.bdr,boxShadow:"0 8px 32px rgba(0,0,0,.3)"}} onClick={function(e){e.stopPropagation()}}>
        {/* Tier glow bar */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:chestOverlay.tier==="rare"?"linear-gradient(90deg,#FFD700,#FF8C00,#FFD700)":chestOverlay.tier==="uncommon"?"linear-gradient(90deg,#a78bfa,#818cf8,#a78bfa)":K.acc}}/>
        {/* Tier label */}
        <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:chestOverlay.tier==="rare"?"#FFD700":chestOverlay.tier==="uncommon"?"#a78bfa":K.dim,fontFamily:fm,marginBottom:8}}>{chestOverlay.tier==="rare"?"Rare Find!":chestOverlay.tier==="uncommon"?"Uncommon":"Reward"}</div>
        {/* Icon */}
        <div style={{fontSize:56,marginBottom:12,animation:"streakFlame 1s ease infinite"}}>{chestOverlay.icon}</div>
        {/* Title */}
        <div style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:6}}>{chestOverlay.label}</div>
        {/* Description */}
        <div style={{fontSize:14,color:K.mid,lineHeight:1.7,marginBottom:chestOverlay.author?4:16}}>{chestOverlay.desc}</div>
        {chestOverlay.author&&<div style={{fontSize:12,color:K.dim,fontStyle:"italic",marginBottom:16}}>{"— "+chestOverlay.author}</div>}
        {chestOverlay.healthNote&&<div style={{textAlign:"left",marginTop:4,padding:"12px 14px",background:K.bg,borderRadius:8,border:"1px solid "+K.bdr,marginBottom:12}}><div style={{fontSize:11,fontWeight:600,color:K.txt,marginBottom:4,fontFamily:fm}}>Portfolio Health</div><div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{chestOverlay.healthNote}</div></div>}
        {chestOverlay.teaser&&<div style={{fontSize:12,color:K.acc,marginTop:4,marginBottom:12,fontFamily:fm}}>{chestOverlay.teaser}</div>}
        {/* XP earned */}
        {chestOverlay.xp>0&&<div style={{display:"inline-block",background:K.grn+"12",border:"1px solid "+K.grn+"25",borderRadius:6,padding:"4px 12px",marginBottom:12}}>
          </div>}
        <div><button onClick={function(){setChestOverlay(null)}} style={Object.assign({},S.btnP,{padding:"10px 28px",fontSize:13})}>Collect</button></div>
      </div></div>}
    {celebOverlay&&<div style={{position:"fixed",inset:0,zIndex:10001,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",animation:"fadeInFast .3s ease"}} onClick={function(){setCelebOverlay(null)}}>
      <div className="ta-celebrate" style={{textAlign:"center",padding:"48px 60px",borderRadius:20,background:K.card,border:"2px solid "+(celebOverlay.color||K.acc),boxShadow:"0 0 80px "+(celebOverlay.color||K.acc)+"30, 0 0 40px "+(celebOverlay.color||K.acc)+"15, 0 20px 60px rgba(0,0,0,.3)",maxWidth:420,animation:"celebratePop .5s cubic-bezier(.175,.885,.32,1.275) both, glowPulse 2s ease-in-out infinite"}}>
        <div style={{fontSize:56,marginBottom:16,animation:"streakFlame 1s ease infinite"}}>{celebOverlay.icon||String.fromCodePoint(0x1F389)}</div>
        <div style={{fontSize:24,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:8}}>{celebOverlay.title}</div>
        <div style={{fontSize:14,color:K.mid,lineHeight:1.7,marginBottom:20}}>{celebOverlay.subtitle}</div>
        <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>Click anywhere to continue</div>
      </div></div>}
    {showConfetti&&<div style={{position:"fixed",inset:0,zIndex:10000,pointerEvents:"none",overflow:"hidden"}}>
      {Array.from({length:50}).map(function(_,i){
        var colors=["#FFD700","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE"];
        var left=Math.random()*100;var delay=Math.random()*2;var size=Math.random()*8+4;var dur=Math.random()*2+2;
        return React.createElement("div",{key:i,style:{position:"absolute",left:left+"%",top:-20,width:size,height:size,borderRadius:Math.random()>.5?"50%":"2px",background:colors[i%colors.length],animation:"confettiFall "+dur+"s "+delay+"s ease-in both"}})})}</div>}
    {toast&&<div className="ta-fade" style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:toast.type==="levelup"?"14px 28px":"10px 24px",borderRadius:12,background:toast.type==="levelup"?"linear-gradient(135deg, #FFD700 0%, #FFA500 100%)":toast.type==="streak"?"linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)":toast.type==="milestone"?"linear-gradient(135deg, #667eea 0%, #764ba2 100%)":K.card,border:"1px solid "+(toast.type==="levelup"?"#FFD700":toast.type==="streak"?"#FF6B6B":toast.type==="milestone"?"#764ba2":K.bdr),boxShadow:"0 8px 32px rgba(0,0,0,.25)",display:"flex",alignItems:"center",gap:12,cursor:"pointer",maxWidth:420}} onClick={function(){setToast(null)}}>
      <div style={{fontSize:toast.type==="levelup"||toast.type==="milestone"||toast.type==="streak"?14:12,fontWeight:toast.type==="levelup"||toast.type==="milestone"||toast.type==="streak"?700:500,color:toast.type==="levelup"||toast.type==="streak"?"#1a1a2e":toast.type==="milestone"?K.txt:K.txt,fontFamily:fm}}>{toast.msg}</div>
      {toast.type==="levelup"&&<button onClick={function(e){e.stopPropagation();setPage("hub");setToast(null)}} style={{background:"rgba(0,0,0,.15)",border:"none",borderRadius:6,padding:"4px 12px",fontSize:11,color:"#1a1a2e",cursor:"pointer",fontFamily:fm,fontWeight:600,whiteSpace:"nowrap"}}>View Hub</button>}
    </div>}
    <Sidebar/><div style={{flex:1,overflowY:"auto",overflowX:"hidden",width:isMobile?"100%":"auto",paddingBottom:isMobile?56:0}}><TopBar/>
    {/* ── Profile Panel ── */}
    {showProfile&&<div style={{position:"fixed",inset:0,zIndex:199}} onClick={function(){setShowProfile(false)}}/>}
    {showProfile&&(function(){
      var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
      var withThesis=portfolio.filter(function(c){return c.thesisNote&&c.thesisNote.trim().length>20}).length;
      var totalKpis=portfolio.reduce(function(s,c){return s+c.kpis.length},0);
      var totalDecisions=0;cos.forEach(function(c){totalDecisions+=(c.decisions||[]).length});
      var reviewCount=weeklyReviews.length;
      return<div className="ta-slide" style={{position:"fixed",top:56,right:isMobile?12:32,width:isMobile?"calc(100vw - 24px)":360,maxHeight:"80vh",overflowY:"auto",background:K.card,border:"1px solid "+K.bdr2,borderRadius:12,boxShadow:"0 16px 48px rgba(0,0,0,.3)",zIndex:200,padding:"24px"}} onClick={function(e){e.stopPropagation()}}>
        {/* Avatar + Level */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
          <div style={{position:"relative",cursor:"pointer"}} onClick={function(){avatarFileRef.current&&avatarFileRef.current.click()}}>
            {avatarUrl?<img src={avatarUrl} style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",border:"3px solid "+K.acc}}/>
              :<div style={{width:64,height:64,borderRadius:"50%",background:K.acc+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:K.acc,fontWeight:700,fontFamily:fm,border:"3px solid "+K.acc+"40"}}>{(username||props.user||"U")[0].toUpperCase()}</div>}
            <div style={{position:"absolute",top:0,right:0,background:K.card,border:"1px solid "+K.bdr,borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center"}}><IC name="edit" size={9} color={K.dim}/></div>
            <input ref={avatarFileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarUpload}/>
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:600,color:K.txt}}>{username||props.user||"Investor"}</div>
            {!username&&!editingName&&<button onClick={function(){setEditingName(true);setNameInput("")}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,padding:0}}>Set username</button>}
            {editingName&&<div style={{display:"flex",gap:6,marginTop:4}}><input value={nameInput} onChange={function(e){setNameInput(e.target.value)}} placeholder="Choose a username" maxLength={20} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:4,color:K.txt,padding:"4px 8px",fontSize:12,fontFamily:fm,width:140,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")saveUsername()}} autoFocus/><button onClick={saveUsername} style={{background:K.acc,color:K.primTxt,border:"none",borderRadius:4,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm}}>Save</button></div>}
            {username&&<div style={{fontSize:11,color:K.dim}}>{props.user}</div>}
            <div style={{fontSize:11,color:K.dim,marginTop:2}}>{plan==="pro"?"Pro":"Free"} plan</div></div></div>

        {/* Stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
          {[{label:"Streak",value:streakData.current||0,sub:"weeks",color:K.grn},
            {label:"Reviews",value:reviewCount,sub:"completed",color:K.blue},
            {label:"Decisions",value:totalDecisions,sub:"logged",color:K.amb}
          ].map(function(s){return<div key={s.label} style={{background:K.bg,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:s.color,fontFamily:fm}}>{s.value}</div>
            <div style={{fontSize:10,color:K.dim}}>{s.sub}</div></div>})}</div>
        {/* Portfolio stats */}
        <div style={{background:K.bg,borderRadius:8,padding:"14px 16px",marginBottom:20}}>
          <div style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:10}}>Portfolio Activity</div>
          <div style={{display:"grid",gap:6}}>
            {[{label:"Companies tracked",value:portfolio.length,icon:"overview"},
              {label:"Theses written",value:withThesis,icon:"lightbulb"},
              {label:"KPIs tracked",value:totalKpis,icon:"target"},
              {label:"Best streak",value:(streakData.best||0)+" weeks",icon:"shield"}
            ].map(function(s){return<div key={s.label} style={{display:"flex",alignItems:"center",gap:8}}>
              <IC name={s.icon} size={12} color={K.dim}/>
              <span style={{fontSize:12,color:K.mid,flex:1}}>{s.label}</span>
              <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{s.value}</span></div>})}</div></div>
        <div style={{marginTop:16,textAlign:"center"}}>
          <button onClick={function(){setShowProfile(false)}} style={S.btn}>Close</button></div>
      </div>})()}
    {trial&&trial.start&&plan!=="pro"&&function(){
      var urgent=trialDaysLeft<=3;var warn=trialDaysLeft<=7&&!urgent;
      var barColor=urgent?K.red:warn?K.amb:K.acc;
      // Active trial banner
      if(trialActive){return<div style={{padding:isMobile?"10px 14px":"10px 32px",background:barColor+"08",borderBottom:"1px solid "+barColor+"20",display:"flex",alignItems:isMobile?"flex-start":"center",gap:isMobile?10:16,flexDirection:isMobile?"column":"row"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
          <div style={{fontSize:12,fontWeight:600,color:barColor,fontFamily:fm}}>{trialDaysLeft}d left</div>
          <div style={{fontSize:12,color:K.mid}}>{trialBonusEarned?"Full trial — "+TRIAL_TOTAL+" days earned":"Pro trial — complete "+THESIS_UNLOCK+" theses to earn +"+TRIAL_BONUS+" more days"}</div></div>
        {!trialBonusEarned&&<div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",gap:3}}>{[0,1,2].map(function(i){return<div key={i} style={{width:24,height:6,borderRadius:3,background:i<thesisProgress?K.grn:K.bdr,transition:"background .3s"}}/>})}</div>
          <span style={{fontSize:11,color:thesisProgress>=THESIS_UNLOCK?K.grn:K.dim,fontFamily:fm}}>{thesisProgress}/{THESIS_UNLOCK}</span></div>}
        {urgent&&<button onClick={function(){setShowUpgrade(true);setUpgradeCtx("trial-ending")}} style={{padding:"5px 14px",fontSize:11,fontWeight:600,background:K.red+"15",border:"1px solid "+K.red+"40",color:K.red,borderRadius:6,cursor:"pointer",fontFamily:fm,whiteSpace:"nowrap"}}>Upgrade Now</button>}
      </div>}
      // Expired trial banner
      if(trialExpired){return<div style={{padding:isMobile?"12px 14px":"12px 32px",background:K.amb+"10",borderBottom:"1px solid "+K.amb+"25",display:"flex",alignItems:"center",gap:16}}>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.amb}}>Your Pro trial has ended</div>
          <div style={{fontSize:12,color:K.mid,marginTop:2}}>Your theses, decisions, and data are safe. Upgrade to keep using data features.</div></div>
        <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("trial-expired")}} style={Object.assign({},S.btnP,{padding:"8px 20px",fontSize:12,whiteSpace:"nowrap"})}>Upgrade to Pro</button></div>}
      return null}()}<div className="ta-fade" style={isMobile?{padding:"0 4px"}:undefined}>{page==="hub"?<OwnersHub/>:page==="assets"?<AllAssets/>:page==="library"?<LibraryPage/>:page==="review"?<WeeklyReview/>:page==="timeline"?<PortfolioTimeline/>:page==="analytics"?<PortfolioAnalytics/>:page==="calendar"?<EarningsCalendar/>:page==="dividends"?<DividendHub/>:sel&&subPage==="financials"?<FinancialsPage company={sel}/>:sel&&subPage==="moat"?<MoatTracker company={sel}/>:sel?<DetailView/>:<Dashboard/>}</div></div>
    {isMobile&&<div style={{position:"fixed",bottom:0,left:0,right:0,height:54,background:K.card+"f8",backdropFilter:"blur(12px)",borderTop:"1px solid "+K.bdr,display:"flex",alignItems:"stretch",zIndex:100}}>
      {[{id:"dashboard",icon:"overview",label:"Portfolio"},{id:"calendar",icon:"calendar",label:"Calendar"},{id:"review",icon:"star",label:"Review"},{id:"hub",icon:"castle",label:"Hub"},{id:"library",icon:"book",label:"Library"}].map(function(item){var active=page===item.id&&!selId;return<button key={item.id} onClick={function(){setSelId(null);setPage(item.id)}} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:0,color:active?K.acc:K.dim}}>
        <IC name={item.icon} size={18} color={active?K.acc:K.dim}/>
        <span style={{fontSize:9,fontFamily:fm,fontWeight:active?700:400}}>{item.label}</span>
      </button>})}
    </div>}
    {/* ── ⌘K Command Palette ── */}
    {cmdOpen&&(function(){
      var q=cmdQuery.toLowerCase().trim();
      var cmdPortfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
      // Build result groups
      var results=[];
      // 1. Companies — match ticker or name
      var coMatches=cos.filter(function(c){return!q||(c.ticker.toLowerCase().indexOf(q)>=0||c.name.toLowerCase().indexOf(q)>=0)}).slice(0,q?6:5);
      if(coMatches.length){results.push({group:"Holdings",items:coMatches.map(function(c){
        var h=gH(c.kpis);var pos2=c.position||{};var isPort=(c.status||"portfolio")==="portfolio";
        return{id:"co-"+c.id,label:c.ticker,sub:c.name,badge:isPort?null:"watchlist",badgeColor:K.amb,
          meta:pos2.currentPrice>0?cSym+pos2.currentPrice.toFixed(2):null,
          icon:"overview",color:K.blue,
          action:function(){setCmdOpen(false);setCmdQuery("");setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}
      })})}
      // 2. Pages
      var PAGES=[
        {id:"pg-dash",label:"Portfolio Overview",icon:"overview",color:K.blue,action:function(){setCmdOpen(false);setSelId(null);setPage("dashboard")}},
        {id:"pg-hub",label:"Owner's Hub",icon:"castle",color:K.acc,action:function(){setCmdOpen(false);setSelId(null);setPage("hub")}},
        {id:"pg-trail",label:"Research Trail",icon:"file",color:"#9333EA",action:function(){setCmdOpen(false);setSelId(null);setPage("hub");setHubTab("docs")}},
        {id:"pg-journal",label:"Research Journal",icon:"book",color:K.blue,action:function(){setCmdOpen(false);setSelId(null);setPage("hub");setHubTab("journal")}},
        {id:"pg-review",label:"Weekly Review",icon:"shield",color:K.grn,action:function(){setCmdOpen(false);setSelId(null);setPage("review")}},
        {id:"pg-calendar",label:"Earnings Calendar",icon:"target",color:K.amb,action:function(){setCmdOpen(false);setSelId(null);setPage("calendar")}},
        {id:"pg-analytics",label:"Analytics",icon:"bar",color:K.blue,action:function(){setCmdOpen(false);setSelId(null);setPage("analytics")}},
        {id:"pg-divs",label:"Dividend Hub",icon:"dollar",color:K.grn,action:function(){setCmdOpen(false);setSelId(null);setPage("dividends")}},
        {id:"pg-assets",label:"All Assets",icon:"trending",color:K.amb,action:function(){setCmdOpen(false);setSelId(null);setPage("assets")}},
        {id:"pg-library",label:"Library",icon:"video",color:K.acc,action:function(){setCmdOpen(false);setSelId(null);setPage("library")}},
        {id:"pg-timeline",label:"Timeline",icon:"clock",color:K.mid,action:function(){setCmdOpen(false);setSelId(null);setPage("timeline")}},
        {id:"pg-feed",label:"My Feed",icon:"news",color:K.acc,action:function(){setCmdOpen(false);setSelId(null);setPage("hub");setHubTab("feed")}},
        {id:"pg-lenses",label:"Investor Lenses",icon:"search",color:"#9333EA",action:function(){setCmdOpen(false);setSelId(null);setPage("hub");setHubTab("lenses")}},
      ];
      var pgMatches=PAGES.filter(function(p){return!q||(p.label.toLowerCase().indexOf(q)>=0)});
      if(pgMatches.length)results.push({group:"Pages",items:pgMatches.slice(0,q?8:5)});
      // 3. Actions
      var CMD_ACTIONS=[
        {id:"act-add",label:"Add New Holding",icon:"plus",color:K.acc,action:function(){setCmdOpen(false);setModal({type:"add"})}},
        {id:"act-review",label:"Start Weekly Review",icon:"shield",color:K.grn,action:function(){setCmdOpen(false);setSelId(null);setPage("review")}},
        {id:"act-theme",label:"Switch Theme",icon:"gear",color:K.mid,action:function(){setCmdOpen(false);cycleTheme()}},
      ];
      // Context-sensitive actions — use selected or first company
      var cmdTgt=sel||(cmdPortfolio[0]||null);
      if(cmdTgt){
        CMD_ACTIONS.push({id:"act-thesis",label:"Write Thesis — "+cmdTgt.ticker,icon:"lightbulb",color:K.grn,action:function(){setCmdOpen(false);setSelId(cmdTgt.id);setDetailTab("dossier");setPage("dashboard");setTimeout(function(){setModal({type:"thesis"})},80)}});
        CMD_ACTIONS.push({id:"act-kpi",label:"Edit KPIs — "+cmdTgt.ticker,icon:"target",color:K.amb,action:function(){setCmdOpen(false);setSelId(cmdTgt.id);setDetailTab("dossier");setPage("dashboard");setTimeout(function(){setModal({type:"kpi"})},80)}});
        CMD_ACTIONS.push({id:"act-conv",label:"Rate Conviction — "+cmdTgt.ticker,icon:"star",color:K.amb,action:function(){setCmdOpen(false);setSelId(cmdTgt.id);setPage("dashboard");setTimeout(function(){setModal({type:"conviction"})},80)}});
      }
      var actMatches=CMD_ACTIONS.filter(function(a){return!q||(a.label.toLowerCase().indexOf(q)>=0)});
      if(actMatches.length)results.push({group:"Actions",items:actMatches.slice(0,q?8:4)});
      // Flatten for keyboard nav
      var flat=results.reduce(function(acc,g){return acc.concat(g.items)},[]);
      var selIdx=Math.min(cmdIdx,flat.length-1);
      function runSelected(){if(flat[selIdx])flat[selIdx].action()}
      function onInputKey(e){
        if(e.key==="ArrowDown"){e.preventDefault();setCmdIdx(function(i){return Math.min(i+1,flat.length-1)})}
        else if(e.key==="ArrowUp"){e.preventDefault();setCmdIdx(function(i){return Math.max(i-1,0)})}
        else if(e.key==="Enter"){e.preventDefault();runSelected()}
      }
      var globalIdx=0;
      return<div style={{position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"14vh",background:"rgba(0,0,0,.55)",backdropFilter:"blur(6px)",animation:"fadeInFast .1s ease"}} onClick={function(){setCmdOpen(false)}}>
        <div style={{width:"100%",maxWidth:560,background:K.card,borderRadius:isThesis?20:12,border:"1px solid "+K.bdr2,boxShadow:"0 32px 80px rgba(0,0,0,.5)",overflow:"hidden",animation:"slideUp .18s ease-out both"}} onClick={function(e){e.stopPropagation()}}>
          {/* Search input */}
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",borderBottom:"1px solid "+K.bdr}}>
            <IC name="search" size={18} color={K.dim}/>
            <input ref={cmdInputRef} value={cmdQuery} onChange={function(e){setCmdQuery(e.target.value);setCmdIdx(0)}} onKeyDown={onInputKey}
              placeholder="Search companies, pages, actions…"
              style={{flex:1,background:"none",border:"none",outline:"none",fontSize:16,color:K.txt,fontFamily:fm,caretColor:K.acc}}/>
            {cmdQuery&&<button onClick={function(){setCmdQuery("");setCmdIdx(0);cmdInputRef.current&&cmdInputRef.current.focus()}} style={{background:"none",border:"none",color:K.dim,fontSize:13,cursor:"pointer",padding:"2px 6px",borderRadius:4,fontFamily:fm}}>✕</button>}
            <span style={{fontSize:11,color:K.dim,fontFamily:fm,background:K.bg,border:"1px solid "+K.bdr,borderRadius:5,padding:"2px 7px",flexShrink:0}}>Esc</span>
          </div>
          {/* Results */}
          {flat.length>0?<div style={{maxHeight:380,overflowY:"auto",padding:"8px 0"}}>
            {results.map(function(group){return<div key={group.group}>
              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,padding:"10px 20px 5px",fontWeight:600}}>{group.group}</div>
              {group.items.map(function(item){var gi=globalIdx++;var isActive=gi===selIdx;
                return<div key={item.id} onMouseEnter={function(){setCmdIdx(gi)}} onClick={item.action}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"9px 20px",cursor:"pointer",background:isActive?(K.acc+"18"):("transparent"),transition:"background .08s"}}>
                  <div style={{width:32,height:32,borderRadius:isThesis?10:7,background:item.color+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <IC name={item.icon} size={15} color={item.color}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,color:isActive?K.txt:K.txt,fontFamily:fm,fontWeight:isActive?600:400,display:"flex",alignItems:"center",gap:7}}>
                      {item.label}
                      {item.badge&&<span style={{fontSize:9,fontFamily:fm,color:item.badgeColor,background:item.badgeColor+"18",border:"1px solid "+item.badgeColor+"30",borderRadius:4,padding:"1px 5px",fontWeight:700,textTransform:"uppercase"}}>{item.badge}</span>}
                    </div>
                    {item.sub&&<div style={{fontSize:11,color:K.dim,fontFamily:fm,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.sub}</div>}
                  </div>
                  {item.meta&&<span style={{fontSize:12,color:K.dim,fontFamily:fm,flexShrink:0}}>{item.meta}</span>}
                  {isActive&&<span style={{fontSize:11,color:K.dim,fontFamily:fm,background:K.bg,border:"1px solid "+K.bdr,borderRadius:5,padding:"2px 7px",flexShrink:0}}>↵</span>}
                </div>
              })}
            </div>})}
          </div>:<div style={{padding:"32px 20px",textAlign:"center",color:K.dim,fontSize:13,fontFamily:fm}}>No results for "{cmdQuery}"</div>}
          {/* Footer hint */}
          <div style={{borderTop:"1px solid "+K.bdr,padding:"8px 20px",display:"flex",gap:16}}>
            {[["↑↓","Navigate"],["↵","Open"],["Esc","Close"]].map(function(h){return<span key={h[0]} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:K.dim,fontFamily:fm}}>
              <span style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:4,padding:"1px 6px",fontSize:10}}>{h[0]}</span>{h[1]}
            </span>})}
            <span style={{marginLeft:"auto",fontSize:11,color:K.dim,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}>
              <span style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:4,padding:"1px 5px",fontSize:10}}>⌘K</span>to open
            </span>
          </div>
        </div>
      </div>
    })()}
    {/* ── Desktop Quick-Access FAB ── */}
    {!isMobile&&(function(){
      // All available shortcuts
      var fabPortfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
      var fabTgt=sel||(fabPortfolio[0]||null);
      function goCompany(fn){setFabOpen(false);if(fabTgt){setSelId(fabTgt.id);setDetailTab("dossier");setPage("dashboard");setTimeout(fn,80)}else{showToast("Add a holding first","info",3000)}}
      var FAB_ALL=[
        {id:"hub",label:"Owner's Hub",icon:"castle",color:K.acc,action:function(){setFabOpen(false);setSelId(null);setPage("hub")}},
        {id:"trail",label:"Research Trail",icon:"file",color:"#9333EA",action:function(){setFabOpen(false);setSelId(null);setPage("hub");setHubTab("docs")}},
        {id:"journal",label:"Research Journal",icon:"book",color:K.blue,action:function(){setFabOpen(false);setSelId(null);setPage("hub");setHubTab("journal")}},
        {id:"review",label:"Weekly Review",icon:"shield",color:K.grn,action:function(){setFabOpen(false);setSelId(null);setPage("review")}},
        {id:"add",label:"Add Holding",icon:"trending",color:K.acc,action:function(){setFabOpen(false);setModal({type:"add"})}},
        {id:"calendar",label:"Earnings Calendar",icon:"calendar",color:K.red,action:function(){setFabOpen(false);setSelId(null);setPage("calendar")}},
        {id:"analytics",label:"Analytics",icon:"bar",color:K.blue,action:function(){setFabOpen(false);setSelId(null);setPage("analytics")}},
        {id:"library",label:"Library",icon:"video",color:K.acc,action:function(){setFabOpen(false);setSelId(null);setPage("library")}},
        {id:"thesis",label:"Why I Own",icon:"lightbulb",color:K.grn,action:function(){goCompany(function(){setModal({type:"thesis"})})}},
        {id:"conviction",label:"Rate Conviction",icon:"star",color:K.amb,action:function(){goCompany(function(){setModal({type:"conviction"})})}},
        {id:"kpi",label:"Check Earnings",icon:"target",color:K.amb,action:function(){setFabOpen(false);if(fabTgt){setSelId(fabTgt.id);setDetailTab("dossier");setPage("dashboard")}else{showToast("Select a holding to check earnings","info",3000)}}},
        {id:"quicknote",label:"Quick Note",icon:"edit",color:K.mid,action:function(){setFabOpen(false);if(fabTgt){setSelId(fabTgt.id);setDetailTab("research");setPage("dashboard")}else{showToast("Select a holding to add a note","info",3000)}}},
      ];
      var activeShortcuts=fabCfg.map(function(id){return FAB_ALL.find(function(s){return s.id===id})}).filter(Boolean);
      return<div style={{position:"fixed",bottom:28,right:28,zIndex:150,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10}}>
        {/* Customize panel */}
        {fabCustomize&&<div style={{background:K.card,border:"1px solid "+K.bdr2,borderRadius:16,padding:"20px 22px",boxShadow:"0 16px 48px rgba(0,0,0,.35)",width:260,marginBottom:6}} onClick={function(e){e.stopPropagation()}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,letterSpacing:.5}}>CUSTOMIZE SHORTCUTS</span>
            <button onClick={function(){setFabCustomize(false)}} style={{background:"none",border:"none",color:K.dim,fontSize:14,cursor:"pointer",padding:"2px 6px",borderRadius:6}}>✕</button>
          </div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:12}}>Pick up to 5 shortcuts. Drag to reorder.</div>
          {FAB_ALL.map(function(s){var on=fabCfg.indexOf(s.id)>=0;return<div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid "+K.bdr+"40",cursor:"pointer"}} onClick={function(){var next=on?fabCfg.filter(function(x){return x!==s.id}):fabCfg.length<5?fabCfg.concat([s.id]):fabCfg;saveFabCfg(next)}}>
            <div style={{width:28,height:28,borderRadius:8,background:s.color+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <IC name={s.icon} size={13} color={s.color}/>
            </div>
            <span style={{flex:1,fontSize:12,color:K.txt,fontFamily:fm}}>{s.label}</span>
            <div style={{width:18,height:18,borderRadius:5,border:"2px solid "+(on?s.color:K.bdr),background:on?s.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
              {on&&<span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
            </div>
          </div>})}
          <div style={{marginTop:12,fontSize:10,color:K.dim,fontFamily:fm,textAlign:"center"}}>{fabCfg.length}/5 selected</div>
        </div>}
        {/* Action pills — fan upward when open */}
        {fabOpen&&activeShortcuts.map(function(s,si){return<div key={s.id} style={{display:"flex",alignItems:"center",gap:10,animation:"fabSlideIn "+(0.06+si*0.04)+"s ease-out both",transformOrigin:"right center"}}>
          <span style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:999,padding:"5px 14px",fontSize:12,fontFamily:fm,color:K.txt,whiteSpace:"nowrap",boxShadow:"0 4px 16px rgba(0,0,0,.18)",cursor:"pointer"}} onClick={s.action} onMouseEnter={function(e){e.currentTarget.style.background=s.color+"15";e.currentTarget.style.color=s.color}} onMouseLeave={function(e){e.currentTarget.style.background=K.card;e.currentTarget.style.color=K.txt}}>{s.label}</span>
          <div onClick={s.action} style={{width:40,height:40,borderRadius:"50%",background:s.color,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 4px 16px "+s.color+"50",flexShrink:0,transition:"transform .12s"}} onMouseEnter={function(e){e.currentTarget.style.transform="scale(1.1)"}} onMouseLeave={function(e){e.currentTarget.style.transform="scale(1)"}}>
            <IC name={s.icon} size={16} color="#fff"/>
          </div>
        </div>})}
        {/* Gear button — only when open */}
        {fabOpen&&<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:-2}}>
          <span style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:999,padding:"5px 14px",fontSize:11,fontFamily:fm,color:K.dim,whiteSpace:"nowrap",boxShadow:"0 4px 12px rgba(0,0,0,.15)",cursor:"pointer"}} onClick={function(){setFabCustomize(!fabCustomize)}}>Customize shortcuts</span>
          <div onClick={function(){setFabCustomize(!fabCustomize)}} style={{width:40,height:40,borderRadius:"50%",background:fabCustomize?K.acc:K.bdr,border:"1px solid "+K.bdr2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all .15s"}}>
            <IC name="gear" size={16} color={fabCustomize?"#fff":K.dim}/>
          </div>
        </div>}
        {/* Main FAB button */}
        <div style={{position:"relative"}}>
          <button onClick={function(e){e.stopPropagation();setFabOpen(!fabOpen);if(fabOpen)setFabCustomize(false)}} style={{width:54,height:54,borderRadius:"50%",background:fabOpen?K.mid:K.acc,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:fabOpen?"0 4px 20px rgba(0,0,0,.3)":"0 6px 24px "+K.acc+"60",transition:"all .2s",outline:"none"}} onMouseEnter={function(e){e.currentTarget.style.transform="scale(1.07)"}} onMouseLeave={function(e){e.currentTarget.style.transform="scale(1)"}}>
            <span style={{fontSize:22,lineHeight:1,color:"#fff",display:"block",transform:fabOpen?"rotate(45deg)":"rotate(0deg)",transition:"transform .2s"}}>+</span>
          </button>
        </div>
      </div>})()}
    </div>)}

// ═══ ROOT ═══
function OnboardingFlow(p){
  var {K,S,fm,fb,fh,isDark,isMobile,cSym,nId,cos,setCos,selId,setSelId,obStep,setObStep,obPath,setObPath,oTicker,setOTicker,oName,setOName,oSector,setOSector,oLook,setOLook,oDomain,setODomain,oIndustry,setOIndustry,oPrice,setOPrice,oStyle,setOStyle,oTCore,setOTCore,oTMoat,setOTMoat,oTRisk,setOTRisk,oTSell,setOTSell,oKpiSel,setOKpiSel,oKpiTargets,setOKpiTargets,oCoId,setOCoId,oShares,setOShares,oAvgCost,setOAvgCost,oPurchDate,setOPurchDate,oTmrRef,upd,lookupTicker,finishOnboarding,setDetailTab,setGuidedSetup,setTourStep,INVEST_STYLES,STYLE_MAP,METRIC_MAP,SAMPLE,IC,TLogo}=p;
  var overlay={position:"fixed",inset:0,background:isDark?"rgba(10,10,15,.97)":"rgba(245,245,250,.97)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"};
  var card={position:"relative",background:K.card,borderRadius:16,padding:"32px 36px",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,.35)"};

  // ── Local state ──────────────────────────────────────────
  // All form state lives in parent — see declarations near obPath
  var oTmr=oTmrRef;

  function onTickerChange(v){setOTicker(v);if(oTmr.current)clearTimeout(oTmr.current);
    if(v.length>=1&&v.length<=6&&/^[A-Za-z.]+$/.test(v)){
      setOLook("loading");setOName("");setOSector("");setODomain("");
      oTmr.current=setTimeout(async function(){
        try{var r=await lookupTicker(v);
          if(r&&r.name){setOName(r.name);setOSector(r.sector||"");setOIndustry(r.industry||"");setODomain(r.domain||"");setOPrice(r.currentPrice||0);setOLook("done")}
          else{setOLook("error")}}
        catch(e){setOLook("error")}},500)}
    else{setOLook("idle");setOName("")}}

  function addOnboardingCompany(){
    if(!oTicker.trim()||!oName.trim())return;
    var nc={id:nId(cos),ticker:oTicker.toUpperCase().trim(),name:oName.trim(),sector:oSector,industry:oIndustry,domain:oDomain,irUrl:"",earningsDate:"TBD",earningsTime:"AMC",thesisNote:"",kpis:[],docs:[],earningsHistory:[],researchLinks:[],decisions:[],thesisReviews:[],targetPrice:0,position:{shares:parseFloat(oShares)||0,avgCost:parseFloat(oAvgCost)||0,currentPrice:oPrice},purchaseDate:oPurchDate||null,conviction:0,convictionHistory:[],status:"portfolio",investStyle:oStyle,lastDiv:0,divPerShare:0,divFrequency:"quarterly",exDivDate:"",lastChecked:null,notes:"",earningSummary:null,sourceUrl:null,sourceLabel:null,moatTypes:{},pricingPower:null,morningstarMoat:"",moatTrend:"",thesisVersions:[],thesisUpdatedAt:"",addedAt:new Date().toISOString()};
    setCos(function(p){return p.concat([nc])});setSelId(nc.id);setOCoId(nc.id);setObStep(3)}

  function saveThesisAndContinue(){
    var coId=oCoId;
    if(coId){
      var parts=[];
      if(oTCore.trim())parts.push(oTCore.trim());
      if(oTMoat.trim())parts.push("## MOAT\n"+oTMoat.trim());
      if(oTRisk.trim())parts.push("## RISKS\n"+oTRisk.trim());
      if(oTSell.trim())parts.push("## SELL CRITERIA\n"+oTSell.trim());
      var combined=parts.join("\n\n");
      if(combined.trim()){
        upd(coId,function(c){return Object.assign({},c,{thesisNote:combined,thesisUpdatedAt:new Date().toISOString()})})}}
    setObStep(4)}

  function saveKpisAndFinish(){
    var coId=oCoId;
    if(coId&&oKpiSel.length>0){
      var newKpis=oKpiSel.map(function(kid,i){
        var met=METRIC_MAP[kid];
        var tv=oKpiTargets[kid]||"";
        return{id:i+1,name:met?met.label:kid,target:"≥"+tv+(met?met.unit||"":""),rule:"gte",value:parseFloat(tv)||0,unit:met?met.unit||"":"",period:"Next Q",notes:"",lastResult:null}});
      upd(coId,function(c){return Object.assign({},c,{kpis:newKpis})})}
    finishOnboarding();
    if(coId){setSelId(coId);setDetailTab("dossier");setGuidedSetup(coId);setTimeout(function(){setTourStep(1)},900)}}

  // ── Step dots ─────────────────────────────────────────────
  function stepDots(){return<div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:28}}>
    {[1,2,3,4,5].map(function(s){return<div key={s} style={{width:s===obStep?24:8,height:8,borderRadius:4,background:s===obStep?K.acc:s<obStep?K.acc+"60":K.bdr,transition:"all .3s"}}/>})}</div>}

  // ─────────────────────────────────────────────────────────
  // STEP 1 — Identity welcome
  // ─────────────────────────────────────────────────────────
  if(obStep===1)return<div style={overlay}><div style={card}>
    {stepDots()}
    <div style={{textAlign:"center",marginBottom:28}}>
      <TLogo size={40} dark={isDark}/>
      <h1 style={{fontSize:26,fontWeight:700,color:K.txt,fontFamily:fh,margin:"16px 0 10px",lineHeight:1.2}}>You did the research.<br/>Now keep the conviction.</h1>
      <p style={{fontSize:14,color:K.mid,lineHeight:1.7,margin:0,maxWidth:360,marginLeft:"auto",marginRight:"auto"}}>ThesisAlpha is where your investment thinking lives — thesis, KPIs, earnings checks, all in one place.</p>
    </div>
    <div style={{background:K.bg,borderRadius:10,padding:"14px 18px",marginBottom:24,border:"1px solid "+K.bdr}}>
      <div style={{fontSize:11,fontWeight:600,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>What you'll do in the next 3 minutes</div>
      {[{n:"1",c:K.grn,t:"Add a company you own"},
        {n:"2",c:K.blue,t:"Write a one-paragraph thesis"},
        {n:"3",c:K.acc,t:"Pick 2 KPIs to track at earnings"}
      ].map(function(r){return<div key={r.n} style={{display:"flex",alignItems:"center",gap:12,padding:"6px 0"}}>
        <div style={{width:22,height:22,borderRadius:"50%",background:r.c+"20",border:"1px solid "+r.c+"40",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:11,fontWeight:700,color:r.c,fontFamily:fm}}>{r.n}</span></div>
        <span style={{fontSize:13,color:K.mid,fontWeight:500}}>{r.t}</span>
      </div>})}</div>
    <button onClick={function(){setObPath("fresh");setCos([]);setObStep(2)}} style={Object.assign({},S.btnP,{width:"100%",padding:"13px",fontSize:15,marginBottom:10})}>Start with a company I own →</button>
    <button onClick={function(){setObPath("demo");setCos(SAMPLE);finishOnboarding();setTimeout(function(){setSelId(SAMPLE[0].id);setDetailTab("dossier")},100)}} style={{display:"block",width:"100%",textAlign:"center",background:"none",border:"none",color:K.dim,fontSize:13,cursor:"pointer",padding:"8px",fontFamily:fb}}>Explore with demo data first</button>
  </div></div>;

  // ─────────────────────────────────────────────────────────
  // STEP 2 — Add first company (no skip)
  // ─────────────────────────────────────────────────────────
  if(obStep===2)return<div style={overlay}><div style={card}>
    {stepDots()}
    <h2 style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 4px",textAlign:"center"}}>Which company do you own?</h2>
    <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 24px",lineHeight:1.6}}>Pick one you've already thought about. This becomes your first thesis.</p>
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Ticker symbol</label>
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <input value={oTicker} onChange={function(e){onTickerChange(e.target.value)}} placeholder="AAPL" style={{flex:"0 0 110px",background:K.bg,border:"1px solid "+(oLook==="done"?K.grn:K.bdr),borderRadius:8,color:K.txt,padding:"10px 14px",fontSize:16,fontFamily:fm,fontWeight:600,outline:"none",textTransform:"uppercase",letterSpacing:1,transition:"border .2s"}} spellCheck={false}/>
        {oLook==="loading"&&<span style={{display:"inline-block",width:14,height:14,border:"2px solid "+K.bdr2,borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>}
        {oLook==="done"&&<span style={{fontSize:13,color:K.grn,fontFamily:fm}}>{"✓"} Found — {oName}</span>}
        {oLook==="error"&&<span style={{fontSize:13,color:K.amb}}>Not found — enter name below</span>}
      </div></div>
    {(oLook==="done"||oLook==="error")&&<div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Company name</label>
      <input value={oName} onChange={function(e){setOName(e.target.value)}} placeholder="Apple Inc." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"10px 14px",fontSize:14,fontFamily:fb,outline:"none"}}/>
    </div>}
    {(oLook==="done"||oLook==="error")&&oName.trim()&&<div style={{marginBottom:20}}>
      <label style={{display:"block",fontSize:11,color:K.dim,marginBottom:8,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>How do you invest in this?</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {INVEST_STYLES.map(function(st){var isSel=oStyle===st.id;return<button key={st.id} onClick={function(){setOStyle(isSel?"":st.id)}} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 11px",borderRadius:6,border:"1px solid "+(isSel?st.color+"60":K.bdr),background:isSel?st.color+"15":"transparent",color:isSel?st.color:K.mid,fontSize:11,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400,transition:"all .15s"}}>
          <IC name={st.icon} size={9} color={isSel?st.color:K.dim}/>{st.label}</button>})}
      </div>
      {oStyle&&STYLE_MAP[oStyle]&&<div style={{fontSize:11,color:K.dim,marginTop:6,lineHeight:1.5}}>{STYLE_MAP[oStyle].desc}</div>}
    </div>}
    {(oLook==="done"||oName.trim())&&<div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <label style={{fontSize:11,color:K.dim,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Position</label>
        <span style={{fontSize:10,color:K.dim,fontFamily:fm,background:K.bg,padding:"1px 6px",borderRadius:4,border:"1px solid "+K.bdr}}>optional</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div>
          <label style={{display:"block",fontSize:10,color:K.dim,marginBottom:4,fontFamily:fm}}>Shares owned</label>
          <input value={oShares} onChange={function(e){setOShares(e.target.value)}} placeholder="100" type="number" min="0" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,outline:"none"}}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:K.dim,marginBottom:4,fontFamily:fm}}>Avg cost {cSym}</label>
          <input value={oAvgCost} onChange={function(e){setOAvgCost(e.target.value)}} placeholder="142.50" type="number" min="0" step="0.01" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,outline:"none"}}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:K.dim,marginBottom:4,fontFamily:fm}}>Purchase date</label>
          <input value={oPurchDate} onChange={function(e){setOPurchDate(e.target.value)}} type="date" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,outline:"none",colorScheme:isDark?"dark":"light"}}/>
        </div>
      </div>
    </div>}
    <div style={{display:"flex",gap:12,justifyContent:"space-between",marginTop:8}}>
      <button onClick={function(){setObStep(1)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:13})}>{"←"} Back</button>
      <button onClick={addOnboardingCompany} style={Object.assign({},S.btnP,{padding:"9px 24px",fontSize:13,opacity:oTicker.trim()&&oName.trim()?1:.35})} disabled={!oTicker.trim()||!oName.trim()}>Add & Write Thesis {"→"}</button>
    </div>
  </div></div>;

  // ─────────────────────────────────────────────────────────
  // STEP 3 — Write thesis inline
  // ─────────────────────────────────────────────────────────
  if(obStep===3){
    var sty3=oStyle&&STYLE_MAP[oStyle]?STYLE_MAP[oStyle]:null;
    var taStyle={width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"10px 12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6,minHeight:60};
    var hasAny=oTCore.trim()||oTMoat.trim()||oTRisk.trim()||oTSell.trim();
    return<div style={overlay}><div style={Object.assign({},card,{maxWidth:520})}>
      {stepDots()}
      <h2 style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 4px",textAlign:"center"}}>Why do you own {oName||oTicker}?</h2>
      <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 20px",lineHeight:1.6}}>Write as much or as little as you want. You can always edit this later.</p>
      <div style={{display:"grid",gap:12,marginBottom:20}}>
        {[{key:"core",label:"Core thesis",placeholder:sty3?sty3.thesisPrompt:"Why do you own this business? What's the key insight?",color:K.grn,val:oTCore,set:setOTCore},
          {key:"moat",label:"Moat",placeholder:sty3?sty3.moatPrompt:"What protects this business from competition?",color:K.blue,val:oTMoat,set:setOTMoat},
          {key:"risk",label:"Risks",placeholder:sty3?sty3.riskPrompt:"What could go wrong? What am I watching?",color:K.amb,val:oTRisk,set:setOTRisk},
          {key:"sell",label:"Sell criteria",placeholder:sty3?sty3.sellPrompt:"What specific event or number would make me sell?",color:K.red,val:oTSell,set:setOTSell}
        ].map(function(sec){return<div key={sec.key}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <div style={{width:8,height:8,borderRadius:2,background:sec.color,flexShrink:0}}/>
            <label style={{fontSize:11,fontWeight:600,color:sec.color,fontFamily:fm,textTransform:"uppercase",letterSpacing:0.8}}>{sec.label}</label>
          </div>
          <textarea value={sec.val} onChange={function(e){sec.set(e.target.value)}} placeholder={sec.placeholder} style={taStyle}/>
        </div>})}
      </div>
      <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
        <button onClick={function(){setObStep(2)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:13})}>{"←"} Back</button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={function(){setObStep(4)}} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",padding:"9px 10px",fontFamily:fb}}>Skip for now</button>
          <button onClick={saveThesisAndContinue} style={Object.assign({},S.btnP,{padding:"9px 22px",fontSize:13,opacity:hasAny?1:.5})} disabled={!hasAny}>Save & Continue {"→"}</button>
        </div>
      </div>
    </div></div>}

  // ─────────────────────────────────────────────────────────
  // STEP 4 — Pick KPIs
  // ─────────────────────────────────────────────────────────
  if(obStep===4){
    var sty4=oStyle&&STYLE_MAP[oStyle]?STYLE_MAP[oStyle]:null;
    var sugIds=sty4?sty4.kpis.slice(0,4):["revGrowth","grossMargin","opMargin","fcfPerShare"];
    var sugMetrics=sugIds.map(function(id){return METRIC_MAP[id]}).filter(Boolean);
    return<div style={overlay}><div style={Object.assign({},card,{maxWidth:500})}>
      {stepDots()}
      <h2 style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 4px",textAlign:"center"}}>What numbers prove your thesis?</h2>
      <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 20px",lineHeight:1.6}}>Pick 2 KPIs. At each earnings report, ThesisAlpha checks them automatically.</p>
      <div style={{display:"grid",gap:8,marginBottom:20}}>
        {sugMetrics.map(function(met){
          var isSel=oKpiSel.indexOf(met.id)>=0;
          var tv=oKpiTargets[met.id]||"";
          return<div key={met.id} style={{borderRadius:10,border:"2px solid "+(isSel?K.acc:K.bdr),background:isSel?K.acc+"08":K.bg,padding:"12px 14px",cursor:"pointer",transition:"all .15s"}} onClick={function(){setOKpiSel(function(p){return p.indexOf(met.id)>=0?p.filter(function(x){return x!==met.id}):p.concat([met.id])})}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{met.label}</div>
                <div style={{fontSize:11,color:K.dim,marginTop:2}}>{met.desc||""}</div>
              </div>
              {isSel?<div style={{width:20,height:20,borderRadius:"50%",background:K.acc,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:10,color:"#fff",fontWeight:700}}>{"✓"}</span></div>
              :<div style={{width:20,height:20,borderRadius:"50%",border:"2px solid "+K.bdr,flexShrink:0}}/>}
            </div>
            {isSel&&<div style={{marginTop:10,display:"flex",alignItems:"center",gap:8}} onClick={function(e){e.stopPropagation()}}>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>Target ≥</span>
              <input value={tv} onChange={function(e){var v=e.target.value;setOKpiTargets(function(p){var n=Object.assign({},p);n[met.id]=v;return n})}} placeholder="e.g. 15" style={{width:80,background:K.card,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"5px 8px",fontSize:13,fontFamily:fm,outline:"none"}}/>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{met.unit||""}</span>
            </div>}
          </div>})}
      </div>
      <div style={{background:K.acc+"0a",border:"1px solid "+K.acc+"25",borderRadius:8,padding:"10px 14px",marginBottom:20,fontSize:12,color:K.mid,lineHeight:1.6}}>
        <strong style={{color:K.acc}}>{"💡"} Tip:</strong> Don{"'"}t overthink the target. A rough number beats no number. You can refine after the first earnings check.
      </div>
      <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
        <button onClick={function(){setObStep(3)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:13})}>{"←"} Back</button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveKpisAndFinish} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",padding:"9px 10px",fontFamily:fb}}>Skip</button>
          <button onClick={saveKpisAndFinish} style={Object.assign({},S.btnP,{padding:"9px 22px",fontSize:13,opacity:oKpiSel.length>0?1:.45})} disabled={oKpiSel.length===0}>Add {oKpiSel.length>0?oKpiSel.length+" KPI"+(oKpiSel.length>1?"s":""):"KPIs"} & Finish {"→"}</button>
        </div>
      </div>
    </div></div>}

  // ─────────────────────────────────────────────────────────
  // STEP 5 — Celebration + what happens next
  // ─────────────────────────────────────────────────────────
  if(obStep===5){
    var co5=cos.find(function(c){return c.id===oCoId})||cos[cos.length-1];
    var kpiCount5=co5?co5.kpis.length:oKpiSel.length;
    var hasThesis5=co5&&co5.thesisNote&&co5.thesisNote.trim().length>10;
    var pts=0;if(hasThesis5)pts+=15;if(kpiCount5>0)pts+=10;
    return<div style={overlay}><div style={card}>
      {stepDots()}
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:44,marginBottom:8}}>{"🎯"}</div>
        <h2 style={{fontSize:22,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 6px"}}>Foundation set.</h2>
        <p style={{fontSize:14,color:K.mid,margin:0,lineHeight:1.6}}>You{"'"}ve done more than most investors ever will.</p>
      </div>
      <div style={{display:"grid",gap:8,marginBottom:20}}>
        {[{label:"Company added",done:!!co5,icon:"✓"},
          {label:"Thesis written",done:hasThesis5,icon:"✓"},
          {label:kpiCount5+" KPI"+(kpiCount5!==1?"s":"")+" to track at earnings",done:kpiCount5>0,icon:"✓"}
        ].map(function(row){return<div key={row.label} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,background:row.done?K.grn+"08":K.bg,border:"1px solid "+(row.done?K.grn+"25":K.bdr)}}>
          <div style={{width:22,height:22,borderRadius:"50%",background:row.done?K.grn+"20":"transparent",border:"1px solid "+(row.done?K.grn+"40":K.bdr),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,color:K.grn,fontWeight:700}}>{row.done?row.icon:""}</div>
          <span style={{fontSize:13,fontWeight:row.done?600:400,color:row.done?K.txt:K.dim}}>{row.label}</span>
          {row.done&&pts>0&&row.label.indexOf("Company")>=0&&<span style={{marginLeft:"auto",fontSize:11,color:K.acc,fontFamily:fm,fontWeight:600}}>+{pts} pts</span>}
        </div>})}
      </div>
      <div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:12,color:K.mid,lineHeight:1.7}}>
        <strong style={{color:K.txt,display:"block",marginBottom:4}}>What happens next</strong>
        ThesisAlpha will remind you before the next earnings report. When results drop, open the app and run a 1-click earnings check — your KPIs vs real numbers, instant verdict.
      </div>
      <button onClick={function(){finishOnboarding();if(co5){setSelId(co5.id);setDetailTab("dossier");setGuidedSetup(co5.id)}}} style={Object.assign({},S.btnP,{width:"100%",padding:"13px",fontSize:15})}>Take me to my portfolio {"→"}</button>
    </div></div>}

  return null}


// ── Dossier Spotlight Tour ────────────────────────────────



export default function App(){
  var _user=useState(null),user=_user[0],setUser=_user[1];
  var _ready=useState(false),ready=_ready[0],setReady=_ready[1];
  useEffect(function(){if(!supabase){setReady(true);return}
    supabase.auth.getSession().then(function(res){if(res.data.session){
      var prevId=null;try{prevId=localStorage.getItem("ta-userid")}catch(e){}
      if(prevId&&prevId!==res.data.session.user.id){
        var savedTheme=null;try{savedTheme=localStorage.getItem("ta-theme")}catch(e){}
        var _k=[];for(var _i=0;_i<localStorage.length;_i++){var _key=localStorage.key(_i);if(_key&&_key.indexOf("ta-")===0)_k.push(_key)}_k.forEach(function(k){localStorage.removeItem(k)});
        if(savedTheme)try{localStorage.setItem("ta-theme",savedTheme)}catch(e){}}
      try{localStorage.setItem("ta-userid",res.data.session.user.id)}catch(e){}
      setUser(res.data.session.user)}setReady(true)});
    var sub=supabase.auth.onAuthStateChange(function(event,session){
      if(session){var prevId2=null;try{prevId2=localStorage.getItem("ta-userid")}catch(e){}
        if(prevId2&&prevId2!==session.user.id){
          var savedTheme2=null;try{savedTheme2=localStorage.getItem("ta-theme")}catch(e){}
          var _k=[];for(var _i=0;_i<localStorage.length;_i++){var _key=localStorage.key(_i);if(_key&&_key.indexOf("ta-")===0)_k.push(_key)}_k.forEach(function(k){localStorage.removeItem(k)});
          if(savedTheme2)try{localStorage.setItem("ta-theme",savedTheme2)}catch(e){}
          try{localStorage.setItem("ta-userid",session.user.id)}catch(e){}
          window.location.reload();return}
        try{localStorage.setItem("ta-userid",session.user.id)}catch(e){}}
      setUser(session?session.user:null)});
    return function(){sub.data.subscription.unsubscribe()}},[]);
  function onAuth(u){try{localStorage.setItem("ta-userid",u.id)}catch(e){}setUser(u)}
  async function onLogout(){var _k=[];for(var _i=0;_i<localStorage.length;_i++){var _key=localStorage.key(_i);if(_key&&_key.indexOf("ta-")===0&&_key!=="ta-theme")_k.push(_key)}_k.forEach(function(k){localStorage.removeItem(k)});if(supabase)await supabase.auth.signOut();setUser(null)}
  if(!ready){var _ltheme="thesis_dark";try{_ltheme=localStorage.getItem("ta-theme")||"thesis_dark"}catch(e){}var _ldark=_ltheme==="dark"||_ltheme==="thesis_dark"||_ltheme==="purple"||_ltheme==="bloomberg";
    return<div style={{background:_ldark?"#1a1a1a":"#f7f7f7",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{width:32,height:32,border:"2px solid "+(_ldark?"#333":"#ddd"),borderTopColor:_ldark?"#fff":"#1a1a1a",borderRadius:"50%",animation:"spin .8s linear infinite"}}/><span style={{color:_ldark?"#777":"#888",fontSize:13,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1}}>ThesisAlpha</span></div>}
  if(!user)return<LoginPage onAuth={onAuth}/>;
  return<TrackerApp user={user.email||""} userId={user.id} onLogout={onLogout}/>;
}
