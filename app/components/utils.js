"use client";
// app/components/utils.js
// Pure utility functions — no React, no JSX
import { METRIC_MAP, KNOWN_MONTHLY } from './constants';

// Cache
var _cache={};var CACHE_TTL=3600000;

function ldS(k){try{var r=localStorage.getItem(k);return Promise.resolve(r?JSON.parse(r):null)}catch(e){return Promise.resolve(null)}}

function svS(k,d){try{localStorage.setItem(k,JSON.stringify(d))}catch(e){}return Promise.resolve()}

function cacheGet(k){var e=_cache[k];if(!e)return null;if(Date.now()-e.t>CACHE_TTL){delete _cache[k];return null}return e.d}

function cacheSet(k,d){_cache[k]={d:d,t:Date.now()};return d}

function xJSON(text){if(!text)throw new Error("empty");var c=text.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();var d=0,s=-1;
  for(var i=0;i<c.length;i++){if(c[i]==="{"){if(d===0)s=i;d++}else if(c[i]==="}"){d--;if(d===0&&s>=0)return JSON.parse(c.substring(s,i+1))}}throw new Error("No JSON")}

function stripCite(s){if(!s)return s;return s.replace(/<\/?cite[^>]*>/gi,"").replace(/<\/?antml:cite[^>]*>/gi,"").trim()}

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
var INVESTOR_PROFILES=[
  {id:"terry",name:"Terry Smith",fund:"Fundsmith",
   tagline:"Buy wonderful companies at fair prices. Never sell.",
   focus:"Financial quality: ROIC, gross margin, FCF conversion. If the numbers aren't exceptional, the moat isn't real.",
   color:"#22C55E",icon:"shield",
   dashDefault:"fundamentals",
   fundCols:["grossMargin","opMargin","roic","fcfYield","revGrowth"],
   listCols:{conviction:true,kpis:true},
   morningPriority:["kpi_streak","conv_size","above_iv"],
   dossierFirst:"numbers",
   quote:"We do not invest in businesses we do not understand or which we believe have poor prospects.",
   newWidget:"quality_scorecard"},
  {id:"sleep",name:"Nick Sleep",fund:"Nomad Investment Partnership",
   tagline:"Scale economies shared. Find the businesses that get better for customers as they get bigger.",
   focus:"Unit economics, reinvestment rate, customer obsession. The financial metrics are a lagging indicator — the flywheel is what matters.",
   color:"#3B82F6",icon:"trending",
   dashDefault:"list",
   fundCols:["revGrowth","grossMargin","fcfYield","revPerShare"],
   listCols:{conviction:true,kpis:false,mastery:true},
   morningPriority:["stale_thesis","conv_size","anniversary"],
   dossierFirst:"story",
   quote:"The best investments I have made have been where I could see ten years ahead.",
   newWidget:"reinvestment_widget"},
  {id:"munger",name:"Charlie Munger",fund:"Berkshire Hathaway",
   tagline:"All I want to know is where I am going to die, so I will never go there.",
   focus:"Moat first. Business model classification. Circle of competence. Inversion. The financials confirm — they don't decide.",
   color:"#F59E0B",icon:"castle",
   dashDefault:"ledger",
   fundCols:["grossMargin","roic","opMargin","netDebtEbitda"],
   listCols:{conviction:true,mastery:true,kpis:true},
   morningPriority:["conv_size","stale_thesis","above_iv"],
   dossierFirst:"moat",
   quote:"It is remarkable how much long-term advantage we have gotten by trying to be consistently not stupid.",
   newWidget:"checklist_widget"},
  {id:"lynch",name:"Peter Lynch",fund:"Magellan Fund",
   tagline:"Know what you own and know why you own it.",
   focus:"Can you explain the business simply? Growth relative to price. Everyday observation. The best stock is one you understand deeply.",
   color:"#8B5CF6",icon:"search",
   dashDefault:"list",
   fundCols:["revGrowth","epsGrowth","pe","grossMargin"],
   listCols:{conviction:true,kpis:true},
   morningPriority:["stale_thesis","conv_size","kpi_streak"],
   dossierFirst:"story",
   quote:"Behind every stock is a company. Find out what it is doing.",
   newWidget:"lynch_widget"},
  {id:"buffett",name:"Warren Buffett",fund:"Berkshire Hathaway",
   tagline:"Price is what you pay. Value is what you get.",
   focus:"Intrinsic value, margin of safety, economic moats, management quality. Only invest when the price makes sense relative to business value.",
   color:"#EF4444",icon:"dollar",
   dashDefault:"list",
   fundCols:["grossMargin","roic","roe","pe","fcfYield"],
   listCols:{conviction:true,kpis:true,mastery:true},
   morningPriority:["above_iv","conv_size","kpi_streak"],
   dossierFirst:"ledger",
   quote:"Our favourite holding period is forever.",
   newWidget:"iv_widget"},
  {id:"akre",name:"Chuck Akre",fund:"Akre Capital Management",
   tagline:"Three legs: extraordinary business, exceptional management, reinvestment opportunity.",
   focus:"Compounding machines. Return on equity, reinvestment rate, and management quality. Find businesses that can compound at high rates for decades and do nothing.",
   color:"#F97316",icon:"trending",
   dashDefault:"fundamentals",
   fundCols:["roe","roic","revGrowth","fcfYield","grossMargin"],
   listCols:{conviction:true,kpis:true,mastery:true},
   morningPriority:["stale_thesis","kpi_streak","anniversary"],
   dossierFirst:"story",
   quote:"The compounding of money over long periods of time is not limited by markets, economies, or politics. It is limited only by the quality of the businesses in which we invest.",
   newWidget:"akre_widget"},
  {id:"custom",name:"Custom",fund:"",
   tagline:"Your own framework.",
   focus:"No preset. Configure the dashboard exactly as you like.",
   color:"#6B7280",icon:"gear",
   dashDefault:"fundamentals",
   fundCols:["revGrowth","grossMargin","opMargin","roic","netDebtEbitda"],
   listCols:{conviction:true,kpis:true},
   morningPriority:[],
   dossierFirst:"story",
   quote:"",
   newWidget:null}
];
var PROFILE_MAP={};INVESTOR_PROFILES.forEach(function(p){PROFILE_MAP[p.id]=p});

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
    holdings:["GE","V","MSFT","MCO","SPGI","MA","GOOG","CNI","CSGP"],
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
    holdings:["FICO","SPGI","MA","MCO","V","INTU","ROP","GOOG","MSFT"],
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
    traits:{quality:0.8,value:0.5,growth:0.4,income:0.3,concentration:0.3,turnover:0.1}},
  {id:"akre",name:"Chuck Akre",fund:"Akre Capital Management",style:"Compounding Machines",desc:"Three-legged stool: extraordinary business, exceptional management, reinvestment opportunity. Buy and hold forever.",
    holdings:["MA","BN","KKR","V","MCO","FICO","CPRT","ORLY","MSCI","SPGI","CSGP","CCCS"],
    traits:{quality:0.95,value:0.4,growth:0.7,income:0.05,concentration:0.6,turnover:0.03}}
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
        var ec=await finnhub("calendar/earnings?symbol="+toFinnhubSymbol(t)+"&from="+from2+"&to="+to2);
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
  // Try common international suffixes if bare ticker failed
  var SUFFIXES=[".TO",".V",".L",".DE",".PA",".AS",".MI",".MC",".HK",".AX",".BO",".NS"];
  for(var si=0;si<SUFFIXES.length;si++){
    try{
      var pt=await fmp("profile/"+t+SUFFIXES[si]);
      if(pt&&pt.length&&pt[0].companyName){
        var pr2=pt[0];var domain2="",irUrl2="";
        if(pr2.website){try{domain2=new URL(pr2.website).hostname.replace("www.","")}catch(e2){domain2=pr2.website.replace(/https?:\/\/(www\.)?/,"").split("/")[0]}}
        return{name:pr2.companyName,sector:pr2.sector||pr2.industry||"",industry:pr2.industry||"",earningsDate:"TBD",earningsTime:"TBD",domain:domain2,irUrl:irUrl2,price:pr2.price||0,lastDiv:pr2.lastDiv||0,divPerShare:pr2.lastDiv||0,divFrequency:"quarterly",exDivDate:"",divYield:0,mktCap:pr2.mktCap||0,description:pr2.description||"",ceo:pr2.ceo||"",employees:pr2.fullTimeEmployees||0,country:pr2.country||"",exchange:pr2.exchangeShortName||pr2.exchange||"",ipoDate:pr2.ipoDate||"",image:pr2.image||"",_foundAs:t+SUFFIXES[si]}
      }
    }catch(e2){}
  }
  return{error:"Not found — enter details manually. For international stocks, try adding the exchange suffix (e.g. RY.TO for TSX, VOD.L for LSE)"}}
async function fetchPrice(ticker){try{var p=await fmp("profile/"+ticker);if(p&&p.length&&p[0].price)return{price:p[0].price,lastDiv:p[0].lastDiv||0,changes:p[0].changes||0,changesPercentage:p[0].changesPercentage||0};return null}catch(e){return null}}
async function fetchQuote(ticker){
  // Try Finnhub first
  try{var q=await finnhub("quote?symbol="+toFinnhubSymbol(ticker));if(q&&q.c>0)return{price:q.c,prevClose:q.pc||0,change:q.d||0,changePct:q.dp||0};}catch(e){}
  // FMP fallback — try original ticker, then base ticker for intl
  var fmpTickers=[ticker];
  if(isIntlTicker(ticker)){var base=ticker.replace(/\.(TO|V|L|DE|PA|AS|HK|AX|NS|BO|MI|MC|SW|ST|OL|CO|HE|BR|LS|AT|NZ)$/i,"");if(base!==ticker)fmpTickers.push(base);}
  for(var _fi=0;_fi<fmpTickers.length;_fi++){
    try{var fq=await fmp("quote/"+fmpTickers[_fi]);if(fq&&Array.isArray(fq)&&fq[0]&&fq[0].price>0){var _fq=fq[0];return{price:_fq.price,prevClose:_fq.previousClose||0,change:_fq.change||0,changePct:_fq.changesPercentage||0,source:"fmp"};}}catch(e){}}
  return null;}
// Fetch dividend data from Finnhub (FREE tier — stock/metric endpoint)
var KNOWN_MONTHLY=["O","MAIN","STAG","AGNC","SLG","GOOD","LTC","SPHD","JEPI","JEPQ","QYLD","RYLD","DIVO","EPR","LAND","PSEC","GAIN"];
// Convert exchange-suffixed ticker to Finnhub exchange format
// e.g. RY.TO → RY:TSX, TOI.V → TOI:TSXV, VOD.L → VOD:LSE
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

async function fetchDivFromFinnhub(ticker,fmpLastDiv){try{
  var met=await finnhub("stock/metric?symbol="+toFinnhubSymbol(ticker)+"&metric=all");
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
  var divs=hist.historical.slice(0,24); // last 24 dividends for better CAGR
  var latest=divs[0];
  // Determine frequency from gaps between payments
  var freq="quarterly";
  if(divs.length>=3){
    var gaps=[];for(var i=1;i<Math.min(divs.length,6);i++){
      var d1=new Date(divs[i-1].date);var d2=new Date(divs[i].date);
      gaps.push(Math.round((d1-d2)/(1000*60*60*24)))}
    var avgGap=gaps.reduce(function(s,v){return s+v},0)/gaps.length;
    if(avgGap<45)freq="monthly";else if(avgGap<120)freq="quarterly";else if(avgGap<240)freq="semi";else freq="annual"}
  // Compute annual dividend totals per calendar year for CAGR
  var yearTotals={};
  divs.forEach(function(d){
    var yr=new Date(d.date).getFullYear();
    yearTotals[yr]=(yearTotals[yr]||0)+(d.dividend||d.adjDividend||0)});
  var years=Object.keys(yearTotals).map(Number).sort();
  var divCagr=null;
  if(years.length>=3){
    // Use most recent full year vs 3 years ago (or earliest available)
    var curYr=years[years.length-1];var baseYr=years[Math.max(0,years.length-4)];
    var nYrs=curYr-baseYr;
    if(nYrs>=1&&yearTotals[baseYr]>0&&yearTotals[curYr]>0){
      divCagr=(Math.pow(yearTotals[curYr]/yearTotals[baseYr],1/nYrs)-1)*100;
      if(Math.abs(divCagr)>50)divCagr=null}} // sanity cap
  return{divPerShare:latest.dividend||latest.adjDividend||0,divFrequency:freq,exDivDate:latest.date||"",lastDiv:latest.dividend||latest.adjDivident||0,divCagr:divCagr}
}catch(e){console.warn("[FMP] dividend fetch error:",e);return null}}
// Shared: estimate which months a company pays dividends based on frequency + exDivDate
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
    console.log("[ThesisAlpha] FMP returned empty for "+ticker);
    // For international tickers: try the base ticker (without suffix) with FMP
    if(isIntlTicker(ticker)){
      var baseTicker=ticker.replace(/\.(TO|V|L|DE|PA|AS|HK|AX|NS|BO|MI|MC|SW|ST|OL|CO|HE|BR|LS|AT|NZ)$/i,"");
      if(baseTicker!==ticker){
        console.log("[ThesisAlpha] Trying base ticker "+baseTicker+" for FMP financials...");
        var r2=await Promise.all([fmp("income-statement/"+baseTicker+qs),fmp("balance-sheet-statement/"+baseTicker+qs),fmp("cash-flow-statement/"+baseTicker+qs)]);
        var _is2=r2[0],_bs2=r2[1],_cf2=r2[2];
        if(_is2&&Array.isArray(_is2))_is2=_is2.filter(function(x){return x&&x.revenue!=null});
        if(_bs2&&Array.isArray(_bs2))_bs2=_bs2.filter(function(x){return x&&x.totalAssets!=null});
        if(_cf2&&Array.isArray(_cf2))_cf2=_cf2.filter(function(x){return x&&x.netIncome!=null});
        if((_is2&&_is2.length>0)||(_bs2&&_bs2.length>0)||(_cf2&&_cf2.length>0)){
          console.log("[ThesisAlpha] Base ticker fallback success for "+baseTicker);
          var incRows2=(_is2||[]).reverse().map(function(row){
            if(row.grossProfitRatio==null&&row.grossProfit!=null&&row.revenue!=null&&row.revenue!==0)row.grossProfitRatio=row.grossProfit/row.revenue;
            if(row.operatingIncomeRatio==null&&row.operatingIncome!=null&&row.revenue!=null&&row.revenue!==0)row.operatingIncomeRatio=row.operatingIncome/row.revenue;
            if(row.netIncomeRatio==null&&row.netIncome!=null&&row.revenue!=null&&row.revenue!==0)row.netIncomeRatio=row.netIncome/row.revenue;
            return row});
          var res2={income:incRows2,balance:(_bs2||[]).reverse(),cashflow:(_cf2||[]).reverse(),source:"fmp-base"};
          _fincache[key]=res2;return res2;
        }
      }
      // Last resort: synthesise minimal rows from Finnhub metrics (TTM data only)
      console.log("[ThesisAlpha] Trying Finnhub metrics fallback for "+ticker);
      try{
        var fhSym=toFinnhubSymbol(ticker);
        var fhMet=await finnhub("stock/metric?symbol="+fhSym+"&metric=all");
        var fhEarn=await finnhub("stock/earnings?symbol="+fhSym);
        if(fhMet&&fhMet.metric&&Object.keys(fhMet.metric).length>0){
          var m=fhMet.metric;
          var yr=new Date().getFullYear();
          // Build a synthetic TTM income row from Finnhub metrics
          var synthIncome={date:yr+"-12-31",calendarYear:String(yr),period:"TTM",
            revenue:m.revenuePerShareTTM!=null?m.revenuePerShareTTM*1e6:null,
            grossProfitRatio:m.grossMarginTTM!=null?m.grossMarginTTM/100:null,
            operatingIncomeRatio:m.operatingMarginTTM!=null?m.operatingMarginTTM/100:null,
            netIncomeRatio:m.netProfitMarginTTM!=null?m.netProfitMarginTTM/100:null,
            eps:fhEarn&&fhEarn.length?fhEarn[0].actual:null,
            epsDiluted:fhEarn&&fhEarn.length?fhEarn[0].actual:null,
            _isSynthetic:true};
          var synthBalance={date:yr+"-12-31",calendarYear:String(yr),period:"TTM",
            totalDebt:null,totalEquity:null,
            debtToEquity:m["totalDebt/totalEquityQuarterly"]||null,
            currentRatio:m.currentRatioQuarterly||null,_isSynthetic:true};
          var synthCF={date:yr+"-12-31",calendarYear:String(yr),period:"TTM",
            freeCashFlow:m.freeCashFlowPerShareTTM!=null?m.freeCashFlowPerShareTTM*1e6:null,
            _isSynthetic:true};
          var resFh={income:[synthIncome],balance:[synthBalance],cashflow:[synthCF],source:"finnhub-metrics"};
          _fincache[key]=resFh;return resFh;
        }
      }catch(fhErr){console.warn("[ThesisAlpha] Finnhub metrics fallback failed:",fhErr)}
      return{income:[],balance:[],cashflow:[]};
    }
    // US companies only — try SEC EDGAR
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
  // Try with suffix first, then base ticker for international stocks
  var tickersToTry=[ticker];
  if(isIntlTicker(ticker)){
    var base=ticker.replace(/\.(TO|V|L|DE|PA|AS|HK|AX|NS|BO|MI|MC|SW|ST|OL|CO|HE|BR|LS|AT|NZ)$/i,"");
    if(base!==ticker)tickersToTry.push(base);
    // FMP sometimes lists Canadian stocks with exchange prefix: TSX:RY, TSXV:TOI
    var sfxUpper=ticker.match(/\.([A-Z]+)$/i);
    if(sfxUpper){
      var FMP_EXCHANGE_MAP={TO:"TSX",V:"TSXV",L:"LSE",DE:"XETRA",PA:"EPA",AS:"ENXTAM",
        HK:"HKEX",AX:"ASX",NS:"NSE",BO:"BSE",MI:"XMIL",MC:"XMAD",OL:"OSL",SW:"SWX",ST:"STO"};
      var exCode=FMP_EXCHANGE_MAP[sfxUpper[1].toUpperCase()];
      if(exCode)tickersToTry.push(base+"."+exCode);
    }
  }
  for(var _ti=0;_ti<tickersToTry.length;_ti++){
    var _tk=tickersToTry[_ti];
    try{
      var results=await Promise.all([fmp("ratios-ttm/"+_tk),fmp("key-metrics-ttm/"+_tk)]);
      var ratios=results[0]&&Array.isArray(results[0])&&results[0].length?results[0][0]:null;
      var km=results[1]&&Array.isArray(results[1])&&results[1].length?results[1][0]:null;
      if(!ratios&&!km)continue;
      var out={ratios:ratios||{},km:km||{}};
      _fmpmetricscache[ticker]=out;
      console.log("[ThesisAlpha] FMP metrics for "+ticker+(ticker!==_tk?" (via base "+_tk+")":"")+": ratios="+Object.keys(out.ratios).length+" km="+Object.keys(out.km).length);
      return out;
    }catch(e){console.warn("[ThesisAlpha] FMP metrics error for "+_tk+":",e);}
  }
  return null;
}

// ── MR MARKET ─────────────────────────────────────────────────────────────────
async function fetchMrMarketData(){
  try{
    var results=await Promise.all([fmp("quote/%5EVIX"),fmp("quote/%5EGSPC")]);
    var vixQ=results[0]&&results[0][0]?results[0][0]:null;
    var spyQ=results[1]&&results[1][0]?results[1][0]:null;
    if(!vixQ&&!spyQ)return null;
    var scores=[];var details=[];
    if(vixQ&&vixQ.price!=null){
      var vix=parseFloat(vixQ.price);
      var vixScore=Math.max(0,Math.min(100,100-((vix-12)/(35-12))*100));
      scores.push(vixScore);
      details.push({label:"VIX",value:vix.toFixed(1),score:Math.round(vixScore)});
    }
    if(spyQ&&spyQ.changesPercentage!=null){
      var spChg=parseFloat(spyQ.changesPercentage);
      var spScore=Math.max(0,Math.min(100,((spChg+3)/6)*100));
      scores.push(spScore);
      details.push({label:"S&P 500 (1d)",value:(spChg>=0?"+":"")+spChg.toFixed(2)+"%",score:Math.round(spScore)});
    }
    if(spyQ&&spyQ.price!=null&&spyQ.yearHigh!=null){
      var pct=(parseFloat(spyQ.price)/parseFloat(spyQ.yearHigh))*100;
      var highScore=Math.max(0,Math.min(100,(pct-88)/(100-88)*100));
      scores.push(highScore);
      details.push({label:"vs 52w high",value:pct.toFixed(1)+"%",score:Math.round(highScore)});
    }
    if(!scores.length)return null;
    var composite=Math.round(scores.reduce(function(s,v){return s+v},0)/scores.length);
    var mood,label,offer,color;
    if(composite<=20){mood="extreme_fear";label="Extreme Fear";color="#EF4444";
      offer="Mr. Market is in panic. He is offering wonderful businesses at distressed prices. This is Buffett weather.";}
    else if(composite<=38){mood="fear";label="Fear";color="#F97316";
      offer="Mr. Market is nervous. He is pricing in more bad news than is likely to materialise.";}
    else if(composite<=62){mood="neutral";label="Neutral";color="#6B7280";
      offer="Mr. Market is unusually rational today. Prices reflect something close to fair value.";}
    else if(composite<=80){mood="greed";label="Greed";color="#10B981";
      offer="Mr. Market is feeling optimistic. He is asking full price for most businesses.";}
    else{mood="extreme_greed";label="Extreme Greed";color="#8B5CF6";
      offer="Mr. Market is euphoric. He is paying prices that future returns cannot justify. Step back.";}
    return{composite:composite,mood:mood,label:label,offer:offer,color:color,details:details,
      vix:vixQ?parseFloat(vixQ.price):null,spyChg:spyQ?parseFloat(spyQ.changesPercentage):null,
      fetched:new Date().toISOString()};
  }catch(e){console.warn("[MrMarket]",e);return null;}
}

async function fetchEarnings(co,kpis){
  var results=[];var quarter="";var summary="";var srcUrl="";var srcLabel="";var snapshot={};
  // Step 1: Finnhub basic financials (FREE, $0)
  var fhMap={};
  var _fhSym=toFinnhubSymbol(co.ticker);
  try{var met=await finnhub("stock/metric?symbol="+_fhSym+"&metric=all");
    var earn=await finnhub("stock/earnings?symbol="+_fhSym);
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
        fcfMargin:{v:(km.freeCashFlowPerShareTTM!=null&&km.revenuePerShareTTM!=null&&km.revenuePerShareTTM>0)?km.freeCashFlowPerShareTTM/km.revenuePerShareTTM*100:(ra.freeCashFlowPerRevenueTTM!=null?ra.freeCashFlowPerRevenueTTM*100:(ra.freeCashFlowToRevenueTTM!=null?ra.freeCashFlowToRevenueTTM*100:null)),fmt:function(v){return v.toFixed(1)+"%"}},
        rndMargin:{v:ra.researchAndDevelopementToRevenueTTM!=null?ra.researchAndDevelopementToRevenueTTM*100:(ra.researchAndDevelopmentToRevenueTTM!=null?ra.researchAndDevelopmentToRevenueTTM*100:null),fmt:function(v){return v.toFixed(1)+"%"}},
        sgaMargin:{v:ra.sellingGeneralAndAdministrativeExpensesToRevenueTTM!=null?ra.sellingGeneralAndAdministrativeExpensesToRevenueTTM*100:(ra.sgaToRevenueTTM!=null?ra.sgaToRevenueTTM*100:null),fmt:function(v){return v.toFixed(1)+"%"}},
        cashOnHand:{v:km.cashPerShareTTM!=null?km.cashPerShareTTM:null,fmt:function(v){return"$"+v.toFixed(2)}},
        totalDebt:{v:(km.debtToEquityTTM!=null&&km.bookValuePerShareTTM!=null&&km.bookValuePerShareTTM>0)?(km.debtToEquityTTM*km.bookValuePerShareTTM):null,fmt:function(v){return"$"+v.toFixed(2)}}};

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

var LEGACY_MAP={};
var _la={"revenue growth":"revGrowth","eps growth":"epsGrowth","gross margin":"grossMargin","operating margin":"opMargin","net margin":"netMargin","fcf margin":"fcfMargin","free cash flow margin":"fcfMargin","r&d margin":"rndMargin","r&d to revenue":"rndMargin","sga margin":"sgaMargin","sga to revenue":"sgaMargin","return on equity":"roe","return on assets":"roa","return on invested capital":"roic","p/e":"pe","pe ratio":"pe","p/e ratio":"pe","p/b":"pb","price to book":"pb","p/s":"ps","price to sales":"ps","ev/ebitda":"evEbitda","ev/fcf":"evFcf","ev/revenue":"evRevenue","peg":"peg","peg ratio":"peg","current ratio":"currentRatio","quick ratio":"quickRatio","debt to equity":"debtEquity","debt/equity":"debtEquity","d/e ratio":"debtEquity","net debt/ebitda":"netDebtEbitda","interest coverage":"interestCoverage","dividend yield":"divYield","book value per share":"bvps","free cash flow":"fcfPerShare","fcf":"fcfPerShare","fcf yield":"fcfYield","fcf per share":"fcfPerShare","revenue per share":"revPerShare","ebitda":"ebitdaPerShare","ebitda margin":"ebitdaPerShare","rev/share":"revPerShare","revenue growth yoy":"revGrowth","eps growth yoy":"epsGrowth","shareholder yield":"shareholderYield","total shareholder yield":"shareholderYield","buyback yield":"buybackYield","graham number":"grahamNum","graham":"grahamNum","vs graham":"grahamDiscount"};

function resolveMetricId(kpi){if(kpi.metricId)return kpi.metricId;var n=kpi.name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return LEGACY_MAP[n]||null}

function isCustomKpi(name){if(METRIC_MAP[name])return false;var n=name.toLowerCase().replace(/[^a-z0-9 /()]/g,"").trim();return!LEGACY_MAP[n]}

function toFinnhubSymbol(ticker){
  var SUFFIX_MAP={".TO":":TSX",".V":":TSXV",".L":":LSE",".DE":":XETRA",".PA":":EPA",
    ".AS":":ENXTAM",".HK":":HKEX",".AX":":ASX",".NS":":NSE",".BO":":BSE",
    ".MI":":XMIL",".MC":":XMAD",".SW":":SWX",".ST":":STO",".OL":":OSLO",
    ".CO":":CPH",".HE":":HEL",".BR":":ENXTBR",".LS":":ENXTLS",".AT":":XATH",
    ".NZ":":NZX"};
  var t=ticker.toUpperCase();
  for(var sfx in SUFFIX_MAP){if(t.endsWith(sfx))return t.slice(0,t.length-sfx.length)+SUFFIX_MAP[sfx]}
  return ticker}

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
