// app/components/constants.js
// Auto-extracted from page.js — static data only, no React

// ═══ THEME SYSTEM ═══
var DARK={bg:"#1a1a1a",side:"#141414",card:"#242424",bdr:"#333333",bdr2:"#444444",txt:"#eeeeee",mid:"#b0b0b0",dim:"#777777",blue:"#6ea8fe",grn:"#4ade80",red:"#f87171",amb:"#fbbf24",acc:"#a0a0a0",prim:"#ffffff",primTxt:"#1a1a1a"};
var LIGHT={bg:"#f7f7f7",side:"#ffffff",card:"#ffffff",bdr:"#e0e0e0",bdr2:"#d0d0d0",txt:"#1a1a1a",mid:"#4a4a4a",dim:"#888888",blue:"#2563eb",grn:"#16a34a",red:"#dc2626",amb:"#d97706",acc:"#555555",prim:"#1a1a1a",primTxt:"#ffffff"};
var FOREST={bg:"#f7f7f5",side:"#1a4a00",card:"#ffffff",bdr:"#e2e8df",bdr2:"#c8d6c0",txt:"#1f2f1a",mid:"#4a6040",dim:"#8aaa80",blue:"#1cb0f6",grn:"#58cc02",red:"#ff4b4b",amb:"#ffc800",acc:"#58cc02",prim:"#58cc02",primTxt:"#ffffff",purple:"#ce82ff"};
var PURPLE={bg:"#0d0b14",side:"#090711",card:"#17132a",bdr:"rgba(167,139,250,0.12)",bdr2:"rgba(167,139,250,0.22)",txt:"#f0ecff",mid:"#b8aee0",dim:"#7065a0",blue:"#818cf8",grn:"#34d399",red:"#f87171",amb:"#fbbf24",acc:"#a78bfa",prim:"#a78bfa",primTxt:"#ffffff",glow:"rgba(167,139,250,0.15)"};
var BLOOMBERG={bg:"#000000",side:"#000000",card:"#0d0d0d",bdr:"#222222",bdr2:"#333333",txt:"#ffffff",mid:"#cccccc",dim:"#777777",blue:"#00c8d4",grn:"#00cc44",red:"#ff3333",amb:"#F39F41",acc:"#F39F41",prim:"#F39F41",primTxt:"#000000",sel:"#ffff00",selTxt:"#000000"};
var PAYPAL={bg:"#f0f4f8",side:"#0a2463",card:"#ffffff",bdr:"#cdd9e8",bdr2:"#aec0d4",txt:"#0d1b2a",mid:"#3d5a80",dim:"#7a94ae",blue:"#1a56db",grn:"#057a55",red:"#c81e1e",amb:"#d97706",acc:"#1a56db",prim:"#1a56db",primTxt:"#ffffff"};
// ── Thesis Themes — landing page aesthetic: Outfit font, heavy rounding, purple accent ──
var THESIS_DARK={bg:"#16161D",side:"#0F0F14",card:"#1C1C26",bdr:"rgba(255,255,255,0.07)",bdr2:"rgba(255,255,255,0.14)",txt:"#ffffff",mid:"rgba(255,255,255,0.82)",dim:"rgba(255,255,255,0.56)",blue:"#3B82F6",grn:"#4ADE80",red:"#F87171",amb:"#FACC15",acc:"#6B4CE6",prim:"#6B4CE6",primTxt:"#ffffff"};
var THESIS_LIGHT={bg:"#F7F5F0",side:"#EFECE6",card:"#ffffff",bdr:"rgba(0,0,0,0.08)",bdr2:"rgba(0,0,0,0.14)",txt:"#16161D",mid:"rgba(22,22,29,0.75)",dim:"rgba(22,22,29,0.52)",blue:"#2563eb",grn:"#16a34a",red:"#dc2626",amb:"#d97706",acc:"#6B4CE6",prim:"#6B4CE6",primTxt:"#ffffff"};
var THEMES={thesis_dark:THESIS_DARK,thesis_light:THESIS_LIGHT,dark:DARK,light:LIGHT,forest:FOREST,purple:PURPLE,paypal:PAYPAL,bloomberg:BLOOMBERG};

var fm="'JetBrains Mono','SF Mono',monospace",fh="'Instrument Serif',Georgia,serif",fb="'DM Sans','Helvetica Neue',sans-serif";

// Global theme flags — written by TrackerApp on each render
var _isThesis=true;
var _isBm=false;
var _isForest=false;
var _isPurple=false;
var _isOcean=false;

var FOLDERS=[{id:"why-i-own",label:"Why I Own It",icon:"lightbulb"},{id:"my-writeups",label:"Investment Memos",icon:"edit"},{id:"deep-dives",label:"Research Clips",icon:"link"},{id:"reports",label:"IR Library",icon:"bar"},{id:"notes",label:"Quick Notes",icon:"file"}];

var SAMPLE=[{id:1,ticker:"NVDA",name:"NVIDIA Corporation",sector:"Semiconductors",domain:"nvidia.com",irUrl:"https://investor.nvidia.com",earningsDate:"2026-02-26",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:"https://investor.nvidia.com",sourceLabel:"Q4 FY26",earningSummary:"Data Center revenue surged 93% YoY to $39.2B.",description:"NVIDIA designs and sells graphics processing units and system-on-chip units. The company's GPUs are the dominant platform for AI training and inference, powering data centers for hyperscalers, enterprises, and sovereign AI initiatives worldwide.",ceo:"Jensen Huang",employees:29600,country:"US",exchange:"NASDAQ",ipoDate:"1999-01-22",mktCap:3400000000000,thesisNote:"AI capex cycle still early innings.\n\n## MOAT\nNVIDIA owns the CUDA ecosystem — switching costs are massive. Every ML framework, every training pipeline, every inference stack is optimized for NVIDIA GPUs. This is a platform moat, not just a hardware moat.\n\n## RISKS\nCustom silicon (Google TPU, Amazon Trainium, AMD MI300) could erode share. Concentration in hyperscaler capex — if AI spending pauses, revenue craters.\n\n## SELL CRITERIA\nData Center growth below 30% YoY for 2 consecutive quarters. Gross margins below 65% sustained. Major customer (MSFT/GOOG/AMZN) publicly shifting >50% of AI training to non-NVIDIA silicon.",investStyle:"growth",position:{shares:50,avgCost:128.5},conviction:9,convictionHistory:[{date:"2025-06-01",rating:8,note:"Strong but expensive"},{date:"2025-11-20",rating:9,note:"Data center demand insatiable"},{date:"2026-01-15",rating:9,note:"AI capex still accelerating"}],status:"portfolio",docs:[{id:1,title:"Core Thesis: AI Infrastructure",folder:"why-i-own",content:"NVIDIA is the picks-and-shovels play on AI. Data center GPU demand is insatiable.",updatedAt:"2026-01-15T10:00:00Z"}],earningsHistory:[{quarter:"Q3 2025",summary:"Revenue $35.1B (+94% YoY). Data Center $30.8B. Gross margin 74.6%.",results:[{kpi_name:"Data Center Revenue",actual_value:30.8,status:"met",excerpt:"Data Center $30.8B"},{kpi_name:"Gross Margin",actual_value:74.6,status:"met",excerpt:"GAAP GM 74.6%"}],sourceUrl:"https://investor.nvidia.com",sourceLabel:"NVIDIA Press Release",checkedAt:"2025-11-20T18:00:00Z"},{quarter:"Q2 2025",summary:"Revenue $30.0B (+122% YoY). Data Center $26.3B. Gross margin 75.1%.",results:[{kpi_name:"Data Center Revenue",actual_value:26.3,status:"met",excerpt:"Data Center $26.3B"},{kpi_name:"Gross Margin",actual_value:75.1,status:"met",excerpt:"GAAP GM 75.1%"}],sourceUrl:"https://investor.nvidia.com",sourceLabel:"NVIDIA Press Release",checkedAt:"2025-08-28T18:00:00Z"}],kpis:[{id:1,name:"Data Center Revenue",target:"≥35B",rule:"gte",value:35,unit:"B",period:"Q4 FY26",notes:"",lastResult:{actual:39.2,status:"met",excerpt:"Data Center revenue was $39.2B."}},{id:2,name:"Gross Margin",target:"≥73%",rule:"gte",value:73,unit:"%",period:"Q4 FY26",notes:"GAAP",lastResult:{actual:73.5,status:"met",excerpt:"GAAP gross margin was 73.5%."}}]},{id:2,ticker:"CRWD",name:"CrowdStrike",sector:"Cybersecurity",domain:"crowdstrike.com",irUrl:"https://ir.crowdstrike.com",earningsDate:"2026-03-04",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:null,sourceLabel:null,earningSummary:null,description:"CrowdStrike provides cloud-delivered endpoint and workload protection. Its Falcon platform uses AI to detect and prevent breaches in real time across endpoints, cloud workloads, identity, and data.",ceo:"George Kurtz",employees:8500,country:"US",exchange:"NASDAQ",ipoDate:"2019-06-12",mktCap:85000000000,thesisNote:"Post-outage recovery.\n\n## MOAT\nFalcon platform has deep endpoint integration — rip-and-replace is painful. Threat intelligence network effect: more endpoints = better detection.\n\n## RISKS\nBrand damage from July 2024 outage may linger. Competitive pressure from SentinelOne, Palo Alto. Government contracts at risk.\n\n## SELL CRITERIA\nGross retention dropping below 95%. Net new ARR below $200M for 2+ quarters. Another major incident.",investStyle:"growth",position:{shares:0,avgCost:0},conviction:6,convictionHistory:[{date:"2025-09-01",rating:5,note:"Outage fallout"},{date:"2026-01-10",rating:6,note:"Recovery underway"}],status:"watchlist",docs:[],earningsHistory:[],kpis:[{id:1,name:"Net New ARR",target:"≥220M",rule:"gte",value:220,unit:"M",period:"Q4 FY26",notes:"",lastResult:null},{id:2,name:"Gross Retention",target:"≥95%",rule:"gte",value:95,unit:"%",period:"Q4 FY26",notes:"",lastResult:null}]}];

// ═══ METRICS ═══
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

var KNOWN_MONTHLY=["O","MAIN","STAG","AGNC","SLG","GOOD","LTC","SPHD","JEPI","JEPQ","QYLD","RYLD","DIVO","EPR","LAND","PSEC","GAIN"];


export {
  DARK, LIGHT, FOREST, PURPLE, BLOOMBERG, PAYPAL, THESIS_DARK, THESIS_LIGHT, THEMES,
  fm, fh, fb,
  FOLDERS, SAMPLE,
  METRICS, METRIC_MAP,
  INVEST_STYLES, STYLE_MAP,
  INVESTOR_PROFILES, PROFILE_MAP,
  SUPERINVESTORS, MSTAR_RATINGS,
  KNOWN_MONTHLY,
};
// Note: _isThesis, _isBm, _isForest, _isPurple, _isOcean are mutable globals —
// they stay exported as vars so TrackerApp can update them in place.
export { _isThesis, _isBm, _isForest, _isPurple, _isOcean };
