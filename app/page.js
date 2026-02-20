"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ═══ SUPABASE AUTH ═══
var supabase = typeof window !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : null;

// ═══ STORAGE (debounced save) ═══
function ldS(k){try{var r=localStorage.getItem(k);return Promise.resolve(r?JSON.parse(r):null)}catch(e){return Promise.resolve(null)}}
function svS(k,d){try{localStorage.setItem(k,JSON.stringify(d))}catch(e){}return Promise.resolve()}

// ═══ FMP (server proxy) ═══
async function fmp(ep){try{var r=await fetch("/api/fmp?endpoint="+encodeURIComponent(ep));if(!r.ok)return null;var d=await r.json();return d}catch(e){console.warn("FMP proxy error:",e);return null}}

// ═══ AI (server proxy) ═══
function xJSON(text){if(!text)throw new Error("empty");var c=text.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();var d=0,s=-1;
  for(var i=0;i<c.length;i++){if(c[i]==="{"){if(d===0)s=i;d++}else if(c[i]==="}"){d--;if(d===0&&s>=0)return JSON.parse(c.substring(s,i+1))}}throw new Error("No JSON")}
async function aiCall(sys,msg,search,useSonnet){
  var model=useSonnet?"claude-sonnet-4-20250514":"claude-haiku-4-5-20251001";
  var body={model:model,max_tokens:2000};if(sys)body.system=sys;
  if(search)body.tools=[{type:"web_search_20250305",name:"web_search"}];
  body.messages=[{role:"user",content:msg}];
  var r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok)throw new Error("AI "+r.status);var d=await r.json();
  return(d&&d.content||[]).filter(function(b){return b.type==="text"}).map(function(b){return b.text}).join("\n")}
async function aiJSON(sys,msg,search,useSonnet){return xJSON(await aiCall(sys,msg,search,useSonnet))}
var SJ="You are a financial data assistant. CRITICAL: Respond ONLY with a raw JSON object. No markdown, backticks, or text.";

// ═══ DATA FUNCTIONS ═══
async function lookupTicker(ticker){var t=ticker.toUpperCase().trim();
  try{
    var p=await fmp("profile?symbol="+t);
    if(p&&p.length&&p[0].companyName){var pr=p[0],ed="TBD",et="TBD",domain="",irUrl="";
      // Try quote endpoint for earnings date (free tier)
      try{var q=await fmp("quote?symbol="+t);
        if(q&&q.length&&q[0].earningsAnnouncement){var ea=q[0].earningsAnnouncement;
          if(ea){var d=new Date(ea);if(!isNaN(d)){ed=d.toISOString().split("T")[0];et=d.getHours()<12?"BMO":"AMC"}}}}catch(e){}
      if(pr.website){try{domain=new URL(pr.website).hostname.replace("www.","")}catch(e){domain=pr.website.replace(/https?:\/\/(www\.)?/,"").split("/")[0]}
        // Smart IR URL: Google search is the most reliable way to find the right IR page
        irUrl="https://www.google.com/search?q="+encodeURIComponent(t+" "+pr.companyName+" investor relations")+"&btnI=1";
      }
      return{name:pr.companyName,sector:pr.sector||pr.industry||"",earningsDate:ed,earningsTime:et,domain:domain,irUrl:irUrl||""}}
  }catch(e){console.warn("FMP lookup failed:",e)}
  return{error:"Not found on FMP — enter details manually"}}
async function fetchEarnings(co,kpis){var fData="",srcUrl=null,srcLbl=null,quarter="Latest";
  try{
    var inc=await fmp("income-statement?symbol="+co.ticker+"&period=quarter&limit=2");
    // If quarterly fails, try annual
    if(!inc||!inc.length){inc=await fmp("income-statement?symbol="+co.ticker+"&limit=2")}
    var met=await fmp("key-metrics?symbol="+co.ticker+"&period=quarter&limit=2");
    if(!met||!met.length){met=await fmp("key-metrics?symbol="+co.ticker+"&limit=2")}
    var press=null;try{press=await fmp("press-releases?symbol="+co.ticker+"&limit=3")}catch(e){}
  if(inc&&inc.length){var L=inc[0];quarter=(L.period||"FY")+" "+(L.calendarYear||"");fData="DATA ("+quarter+"):\n";
    if(L.revenue)fData+="Revenue: $"+(L.revenue/1e9).toFixed(2)+"B\n";if(L.grossProfitRatio!=null)fData+="Gross Margin: "+(L.grossProfitRatio*100).toFixed(1)+"%\n";
    if(L.operatingIncomeRatio!=null)fData+="Op Margin: "+(L.operatingIncomeRatio*100).toFixed(1)+"%\n";if(L.eps!=null)fData+="EPS: $"+L.eps+"\n";
    if(L.ebitda)fData+="EBITDA: $"+(L.ebitda/1e9).toFixed(2)+"B\n";if(L.netIncome)fData+="Net Income: $"+(L.netIncome/1e9).toFixed(2)+"B\n";
    if(inc.length>=2&&inc[1].revenue)fData+="Rev Growth: "+((L.revenue-inc[1].revenue)/Math.abs(inc[1].revenue)*100).toFixed(1)+"%\n"}
  if(met&&met.length){var M=met[0];if(M.roic!=null)fData+="ROIC: "+(M.roic*100).toFixed(1)+"%\n";if(M.roe!=null)fData+="ROE: "+(M.roe*100).toFixed(1)+"%\n";
    if(M.currentRatio!=null)fData+="Current Ratio: "+M.currentRatio.toFixed(2)+"\n";if(M.freeCashFlowPerShare!=null)fData+="FCF/Share: $"+M.freeCashFlowPerShare.toFixed(2)+"\n"}
  if(press&&press.length){srcUrl=press[0].url;srcLbl=(press[0].title||"Press Release").substring(0,60)}}catch(e){console.warn("FMP fetch error:",e)}
  if(!fData.trim()){return{found:false,reason:"No earnings data found for "+co.ticker+". This may be a free-plan limitation — FMP free tier may restrict quarterly data for some tickers."}}
  if(!kpis||!kpis.length){return{found:true,quarter:quarter,summary:fData.replace("DATA ("+quarter+"):\n","").trim(),results:[],sourceUrl:srcUrl,sourceLabel:srcLbl}}
  var kl=kpis.map(function(k){return"- \""+k.name+"\": target "+k.target+(k.notes?" ("+k.notes+")":"")}).join("\n");
  try{var r=await aiJSON(SJ,"Match KPIs for "+co.ticker+" ("+co.name+").\n"+(fData?"FMP Data:\n"+fData+"\n":"")+"KPIs:\n"+kl+"\nUse only the data provided above. If a KPI cannot be matched to any data point, set status to 'unclear' and actual_value to null.\n"+
    '{"found":true,"quarter":"'+quarter+'","summary":"2-3 sentences","results":[{"kpi_name":"name","actual_value":0,"status":"met or missed","excerpt":"src"}],"sourceUrl":"url","sourceLabel":"label"}\nIf not reported:{"found":false,"reason":"why"}',false,false);
    if(!r.sourceUrl&&srcUrl){r.sourceUrl=srcUrl;r.sourceLabel=srcLbl}return r}catch(e){return{found:false,reason:"AI analysis failed — check your Anthropic API credits"}}}
async function lookupNextEarnings(ticker){try{var q=await fmp("quote?symbol="+ticker);if(q&&q.length&&q[0].earningsAnnouncement){var ea=q[0].earningsAnnouncement;var d=new Date(ea);if(!isNaN(d))return{earningsDate:d.toISOString().split("T")[0],earningsTime:d.getHours()<12?"BMO":"AMC"}}}catch(e){}return{earningsDate:"TBD",earningsTime:"TBD"}}
async function fetchTranscripts(ticker,n){var ts=[],y=2026,q=4;for(var i=0;i<(n||4);i++){try{var t=await fmp("earning-call-transcript?symbol="+ticker+"&year="+y+"&quarter="+q);if(t&&t.length&&t[0].content)ts.push({quarter:"Q"+q+" "+y,content:t[0].content})}catch(e){}q--;if(q<=0){q=4;y--}}return ts}
async function analyzeNarrativeDrift(ticker,name,currentText){var prev="";try{var ts=await fetchTranscripts(ticker,4);if(ts.length>=2)prev=ts.map(function(t){return"=== "+t.quarter+" ===\n"+t.content.substring(0,3000)}).join("\n\n")}catch(e){}
  return aiJSON("You detect narrative shifts. Return ONLY raw JSON.","Analyze drift for "+ticker+" ("+name+").\n"+(prev?"Previous:\n"+prev.substring(0,12000)+"\n\n":"")+"Current:\n"+currentText.substring(0,6000)+"\n"+(prev?"":"Search web for previous quarters.\n")+'{"drifts":[{"type":"missing_kpi|definition_change|tone_shift|new_narrative","title":"t","detail":"d","severity":"high|medium|low","prevQuarter":"Q3","prevLanguage":"before","currentLanguage":"now"}],"overallRisk":"low|medium|high","summary":"s","quartersCompared":["Q1"]}\nIf no data:{"drifts":[],"overallRisk":"unknown","summary":"Upload transcripts manually.","quartersCompared":[]}',true,true)}
async function analyzeQAEvasion(ticker,transcript){return aiJSON("You detect evasive earnings call answers. Return ONLY raw JSON.","Analyze Q&A for "+ticker+":\n"+transcript.substring(0,10000)+"\nFlag evasions with worryPhrases and ignoredTopics.\n"+'{"evasions":[{"analystQuestion":"q","executiveAnswer":"a","evasionType":"topic_redirect|vague_generalization|non_answer|cherry_pick","severity":"high|medium|low","explanation":"why","worryPhrases":["p"],"ignoredTopics":["t"]}],"evasionScore":0.0,"summary":"s"}',false,true)}
async function fetchQATranscript(ticker){try{var ts=await fetchTranscripts(ticker,2);if(ts.length&&ts[0].content){var c=ts[0].content,qi=c.search(/question.{0,5}(and|&).{0,5}answer|q\s*&\s*a/i);if(qi>0)return{found:true,transcript:c.substring(qi,qi+15000),quarter:ts[0].quarter};return{found:true,transcript:c.substring(Math.floor(c.length*.6)),quarter:ts[0].quarter}}}catch(e){}return{found:false}}

// ═══ THEME SYSTEM ═══
var DARK={bg:"#06060A",side:"#0A0A0F",card:"#0D0D12",bdr:"#18181F",bdr2:"#222228",txt:"#E8E8EC",mid:"#9CA3AF",dim:"#5A5A65",blue:"#3B82F6",grn:"#22C55E",red:"#EF4444",amb:"#F59E0B",acc:"#818CF8"};
var LIGHT={bg:"#FFF8F0",side:"#FFFFFF",card:"#FFFFFF",bdr:"#E0D5C7",bdr2:"#D1C4B2",txt:"#1A1A1A",mid:"#555555",dim:"#888888",blue:"#2563EB",grn:"#16A34A",red:"#DC2626",amb:"#D97706",acc:"#6366F1"};
var fm="'JetBrains Mono','SF Mono',monospace",fh="'Instrument Serif',Georgia,serif",fb="'DM Sans','Helvetica Neue',sans-serif";
function TLogo(p){var s=p.size||28;return<img src="/logo.png" width={s} height={s} style={{borderRadius:6,objectFit:"contain"}} alt="T"/>}
var SUGS={Semiconductors:["Revenue","Gross Margin","Data Center Revenue","Next-Q Guidance"],Cybersecurity:["Net New ARR","Revenue Growth YoY","Gross Retention","FCF Margin"],SaaS:["ARR Growth YoY","Net Revenue Retention","FCF Margin"],_def:["Revenue Growth YoY","Gross Margin","Operating Margin","EPS Growth YoY"]};
function getSugs(sec){if(!sec)return SUGS._def;var k=Object.keys(SUGS).find(function(s){return s!=="_def"&&sec.toLowerCase().includes(s.toLowerCase())});return SUGS[k]||SUGS._def}
var FOLDERS=[{id:"why-i-own",label:"Why I Own It",icon:"\uD83D\uDCA1"},{id:"my-writeups",label:"My Write-Ups",icon:"\u270D\uFE0F"},{id:"deep-dives",label:"Other Deep Dives",icon:"\uD83D\uDD0D"},{id:"reports",label:"Reports & Presentations",icon:"\uD83D\uDCCA"},{id:"notes",label:"Quick Notes",icon:"\uD83D\uDCDD"}];
var SAMPLE=[{id:1,ticker:"NVDA",name:"NVIDIA Corporation",sector:"Semiconductors",domain:"nvidia.com",irUrl:"https://investor.nvidia.com",earningsDate:"2026-02-26",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:"https://investor.nvidia.com",sourceLabel:"Q4 FY26",earningSummary:"Data Center revenue surged 93% YoY to $39.2B.",thesisNote:"AI capex cycle still early innings.",docs:[{id:1,title:"Core Thesis: AI Infrastructure",folder:"why-i-own",content:"NVIDIA is the picks-and-shovels play on AI. Data center GPU demand is insatiable.",updatedAt:"2026-01-15T10:00:00Z"}],kpis:[{id:1,name:"Data Center Revenue",target:"\u226535B",rule:"gte",value:35,unit:"B",period:"Q4 FY26",notes:"",lastResult:{actual:39.2,status:"met",excerpt:"Data Center revenue was $39.2B."}},{id:2,name:"Gross Margin",target:"\u226573%",rule:"gte",value:73,unit:"%",period:"Q4 FY26",notes:"GAAP",lastResult:{actual:73.5,status:"met",excerpt:"GAAP gross margin was 73.5%."}}]},{id:2,ticker:"CRWD",name:"CrowdStrike",sector:"Cybersecurity",domain:"crowdstrike.com",irUrl:"https://ir.crowdstrike.com",earningsDate:"2026-03-04",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:null,sourceLabel:null,earningSummary:null,thesisNote:"Post-outage recovery.",docs:[],kpis:[{id:1,name:"Net New ARR",target:"\u2265220M",rule:"gte",value:220,unit:"M",period:"Q4 FY26",notes:"",lastResult:null},{id:2,name:"Gross Retention",target:"\u226595%",rule:"gte",value:95,unit:"%",period:"Q4 FY26",notes:"",lastResult:null}]}];
var dU=function(d){if(!d||d==="TBD")return 999;return Math.ceil((new Date(d)-new Date())/864e5)};
var fD=function(d){try{return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch(e){return d}};
var fT=function(ts){if(!ts)return"";var d=new Date(ts);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})};
var nId=function(a){return a.length?Math.max.apply(null,a.map(function(x){return x.id}))+1:1};
function gH(kpis){var ev=kpis.filter(function(k){return k.lastResult});if(!ev.length)return{l:"Pending",c:"#6B7280"};var m=ev.filter(function(k){return k.lastResult.status==="met"}).length;var p=Math.round(m/ev.length*100);return p>=80?{l:"Strong",c:"#22C55E"}:p>=50?{l:"Mixed",c:"#F59E0B"}:{l:"Weak",c:"#EF4444"}}
var bT=function(r,v,u){return(r==="gte"?"\u2265":r==="lte"?"\u2264":"=")+" "+v+(u||"")};
var eS=function(r,t,a){var n=parseFloat(a);if(isNaN(n))return"unclear";return r==="gte"?(n>=t?"met":"missed"):r==="lte"?(n<=t?"met":"missed"):(n===t?"met":"missed")};
function CoLogo(p){var _s=useState(0),a=_s[0],sA=_s[1];var sz=p.size||24;
  if(p.domain&&a===0)return<img src={"https://logo.clearbit.com/"+p.domain} width={sz} height={sz} style={{borderRadius:4,background:"#18181F",objectFit:"contain",flexShrink:0}} onError={function(){sA(1)}} alt=""/>;
  if(p.domain&&a===1)return<img src={"https://www.google.com/s2/favicons?domain="+p.domain+"&sz=64"} width={sz} height={sz} style={{borderRadius:4,background:"#18181F",objectFit:"contain",flexShrink:0}} onError={function(){sA(2)}} alt=""/>;
  return<div style={{width:sz,height:sz,borderRadius:4,background:"#222228",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*.4,fontWeight:700,color:"#5A5A65",fontFamily:fm,flexShrink:0}}>{(p.ticker||"?")[0]}</div>}
function mkS(K){return{btn:{background:"transparent",border:"1px solid "+K.bdr,color:K.mid,padding:"8px 16px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:fm},btnP:{background:K.blue,border:"1px solid "+K.blue,color:"#fff",padding:"9px 18px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:fm,fontWeight:600},btnD:{background:"transparent",border:"1px solid #7F1D1D",color:K.red,padding:"8px 16px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:fm},btnChk:{background:K.blue+"12",border:"1px solid "+K.blue+"40",color:K.blue,padding:"9px 18px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:fm,fontWeight:600},sec:{fontSize:10,letterSpacing:4,textTransform:"uppercase",color:K.dim,marginBottom:12,fontWeight:500,fontFamily:fm},badge:function(c){return{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:500,color:c,background:c+"15",padding:"3px 10px",borderRadius:4,fontFamily:fm}},dot:function(s){return{width:8,height:8,borderRadius:"50%",background:s==="met"?"#22C55E":s==="missed"?"#EF4444":"#555",flexShrink:0}}}}
function Modal(p){var K=p.K||DARK;return<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(8px)"}} onClick={p.onClose}><div style={{background:K.card,border:"1px solid "+K.bdr2,borderRadius:14,padding:"28px 32px",width:p.w||500,maxWidth:"92vw",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 24px 48px rgba(0,0,0,.3)"}} onClick={function(e){e.stopPropagation()}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><h2 style={{margin:0,fontSize:17,fontWeight:500,color:K.txt,fontFamily:fh}}>{p.title}</h2><button onClick={p.onClose} style={{background:"none",border:"none",color:K.dim,fontSize:18,cursor:"pointer"}}>{"\u2715"}</button></div>{p.children}</div></div>}
function Inp(p){var K=p.K||DARK;var b={width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fm,outline:"none"};return<div style={{marginBottom:16}}>{p.label&&<label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>{p.label}</label>}{p.ta?<textarea value={p.value} onChange={function(e){p.onChange(e.target.value)}} placeholder={p.placeholder} rows={3} style={Object.assign({},b,{resize:"vertical"})}/>:<input type={p.type||"text"} value={p.value} onChange={function(e){p.onChange(e.target.value)}} placeholder={p.placeholder} spellCheck={p.spellCheck!==undefined?p.spellCheck:true} autoCorrect={p.autoCorrect||"on"} autoComplete={p.autoComplete||"on"} style={b}/>}</div>}
function Sel(p){var K=p.K||DARK;return<div style={{marginBottom:16}}>{p.label&&<label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm}}>{p.label}</label>}<select value={p.value} onChange={function(e){p.onChange(e.target.value)}} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fm,outline:"none"}}>{p.options.map(function(o){return<option key={o.v} value={o.v}>{o.l}</option>})}</select></div>}

// ═══ LOGIN ═══
function LoginPage(props){
  var _e=useState(""),email=_e[0],setEmail=_e[1];var _p=useState(""),pw=_p[0],setPw=_p[1];
  var _err=useState(""),err=_err[0],setErr=_err[1];var _mode=useState("login"),mode=_mode[0],setMode=_mode[1];
  var _ld=useState(false),ld2=_ld[0],setLd=_ld[1];
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
  return(<div style={{background:DARK.bg,color:DARK.txt,minHeight:"100vh",fontFamily:fb,display:"flex",alignItems:"center",justifyContent:"center"}}>
  <div style={{width:400,padding:"48px 40px",background:DARK.card,border:"1px solid "+DARK.bdr,borderRadius:20,boxShadow:"0 32px 64px rgba(0,0,0,.4)"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:28}}><TLogo size={24}/><span style={{fontSize:16,fontWeight:600,letterSpacing:2,fontFamily:fm}}>ThesisAlpha</span></div>
    <h2 style={{fontSize:28,fontFamily:fh,fontWeight:400,margin:"0 0 8px",textAlign:"center"}}>{mode==="login"?"Welcome back":"Create account"}</h2>
    <p style={{fontSize:13,color:DARK.dim,textAlign:"center",margin:"0 0 32px"}}>{mode==="login"?"Sign in to your portfolio":"Start tracking your thesis"}</p>
    {err&&<div style={{background:DARK.red+"12",border:"1px solid "+DARK.red+"30",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:DARK.red}}>{err}</div>}
    <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:DARK.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Email</label>
      <input type="email" value={email} onChange={function(e){setEmail(e.target.value);setErr("")}} placeholder="you@email.com" style={{width:"100%",boxSizing:"border-box",background:DARK.bg,border:"1px solid "+DARK.bdr,borderRadius:8,color:DARK.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <div style={{marginBottom:24}}><label style={{display:"block",fontSize:11,color:DARK.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Password</label>
      <input type="password" value={pw} onChange={function(e){setPw(e.target.value);setErr("")}} placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} style={{width:"100%",boxSizing:"border-box",background:DARK.bg,border:"1px solid "+DARK.bdr,borderRadius:8,color:DARK.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <button onClick={submit} disabled={ld2} style={{width:"100%",background:DARK.acc,color:"#fff",border:"none",padding:"14px",borderRadius:10,fontSize:14,fontWeight:600,cursor:ld2?"wait":"pointer",fontFamily:fb,marginBottom:16,opacity:ld2?.6:1}}>{ld2?"...":(mode==="login"?"Sign In":"Create Account")}</button>
    <div style={{textAlign:"center",fontSize:13,color:DARK.dim}}>{mode==="login"?"Don't have an account? ":"Already have an account? "}<span onClick={function(){setMode(mode==="login"?"signup":"login");setErr("")}} style={{color:DARK.acc,cursor:"pointer"}}>{mode==="login"?"Sign up":"Sign in"}</span></div>
  </div></div>)}

// ═══ TRACKER APP ═══
function TrackerApp(props){
  var _th=useState(function(){try{return localStorage.getItem("ta-theme")||"dark"}catch(e){return"dark"}}),theme=_th[0],setTheme=_th[1];
  var K=theme==="dark"?DARK:LIGHT;var S=mkS(K);var isDark=theme==="dark";
  function toggleTheme(){var n=theme==="dark"?"light":"dark";setTheme(n);try{localStorage.setItem("ta-theme",n)}catch(e){}}
  var _c=useState(SAMPLE),cos=_c[0],setCos=_c[1];var _l=useState(false),loaded=_l[0],setLoaded=_l[1];
  var _s=useState(null),selId=_s[0],setSelId=_s[1];var _ek=useState(null),expKpi=_ek[0],setExpKpi=_ek[1];
  var _m=useState(null),modal=_m[0],setModal=_m[1];var _ck=useState({}),checkSt=_ck[0],setCheckSt=_ck[1];
  var _n=useState([]),notifs=_n[0],setNotifs=_n[1];var _sn=useState(false),showNotifs=_sn[0],setShowNotifs=_sn[1];
  var saveTimer=useRef(null);
  useEffect(function(){ldS("ta-data").then(function(d){if(d&&d.cos){setCos(d.cos.map(function(c){return Object.assign({docs:[]},c)}));}if(d&&d.notifs)setNotifs(d.notifs);setLoaded(true)})},[]);
  // DEBOUNCED SAVE — waits 500ms after last change to save
  useEffect(function(){if(!loaded)return;if(saveTimer.current)clearTimeout(saveTimer.current);saveTimer.current=setTimeout(function(){svS("ta-data",{cos:cos,notifs:notifs})},500);return function(){if(saveTimer.current)clearTimeout(saveTimer.current)}},[cos,notifs,loaded]);
  useEffect(function(){if(!loaded)return;cos.forEach(function(c){if(c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)<-7){
    setCos(function(p){return p.map(function(x){return x.id===c.id?Object.assign({},x,{earningsDate:"TBD",earningsTime:"TBD"}):x})});
    lookupNextEarnings(c.ticker).then(function(r){if(r.earningsDate!=="TBD")setCos(function(p){return p.map(function(x){return x.id===c.id?Object.assign({},x,r):x})})}).catch(function(){})}})},[loaded]);
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
      if(r.found&&r.results){setCos(function(prev){return prev.map(function(c){if(c.id!==cid)return c;return Object.assign({},c,{lastChecked:new Date().toISOString(),earningSummary:r.summary||c.earningSummary,sourceUrl:r.sourceUrl||c.sourceUrl,sourceLabel:r.sourceLabel||c.sourceLabel,kpis:c.kpis.map(function(k){var m=r.results.find(function(x){return x.kpi_name===k.name});return m&&m.actual_value!=null?Object.assign({},k,{lastResult:{actual:m.actual_value,status:eS(k.rule,k.value,m.actual_value),excerpt:m.excerpt}}):k})})})});
        setCheckSt(function(p){var n=Object.assign({},p);n[cid]="found";return n});
        setNotifs(function(p){return[{id:Date.now(),type:"found",ticker:co.ticker,msg:(r.quarter||"")+" results found",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}
      else{setCheckSt(function(p){var n=Object.assign({},p);n[cid]="not-yet";return n});upd(cid,{lastChecked:new Date().toISOString()})}}
    catch(e){setCheckSt(function(p){var n=Object.assign({},p);n[cid]="error";return n})}
    setTimeout(function(){setCheckSt(function(p){var n=Object.assign({},p);delete n[cid];return n})},6000)}
  async function checkAll(){var pend=cos.filter(function(c){return c.earningsDate!=="TBD"&&dU(c.earningsDate)<=3});for(var i=0;i<pend.length;i++){await checkOne(pend[i].id);await new Promise(function(r){setTimeout(r,800)})}}

  // ── Modals ─────────────────────────────────────────────────
  function AddModal(){var _f=useState({ticker:"",name:"",sector:"",earningsDate:"",earningsTime:"AMC",domain:"",irUrl:"",thesis:""}),f=_f[0],setF=_f[1];
    var _ls=useState("idle"),ls=_ls[0],setLs=_ls[1];var _lm=useState(""),lm=_lm[0],setLm=_lm[1];var tmr=useRef(null);
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    async function doLookup(t){setLs("loading");setLm("");try{var r=await lookupTicker(t);
      if(r&&r.error){setLs("error");setLm(r.error)}
      else if(r&&r.name){setF(function(p){return Object.assign({},p,{name:p.name||r.name||"",sector:p.sector||r.sector||"",earningsDate:p.earningsDate||r.earningsDate||"",earningsTime:r.earningsTime||p.earningsTime,domain:p.domain||r.domain||"",irUrl:p.irUrl||r.irUrl||""})});setLs("done");setLm("Auto-filled \u2713")}
      else{setLs("error");setLm("Not found")}}catch(e){setLs("error");setLm("Lookup failed — try manually")}}
    function onTicker(v){set("ticker",v);if(tmr.current)clearTimeout(tmr.current);var t=v.toUpperCase().trim();
      if(t.length>=2&&t.length<=6&&/^[A-Z]+$/.test(t)){setLs("idle");tmr.current=setTimeout(function(){doLookup(t)},1000)}else{setLs("idle");setLm("")}}
    function submit(){if(!f.ticker.trim()||!f.name.trim())return;if(tmr.current)clearTimeout(tmr.current);
      var nc={id:nId(cos),ticker:f.ticker.toUpperCase().trim(),name:f.name.trim(),sector:f.sector.trim(),domain:f.domain.trim(),irUrl:f.irUrl.trim(),earningsDate:f.earningsDate||"TBD",earningsTime:f.earningsTime,thesisNote:f.thesis.trim(),kpis:[],docs:[],lastChecked:null,notes:"",earningSummary:null,sourceUrl:null,sourceLabel:null};
      setCos(function(p){return p.concat([nc])});setSelId(nc.id);setModal(null)}
    useEffect(function(){return function(){if(tmr.current)clearTimeout(tmr.current)}},[]);
    return<Modal title="Add Company" onClose={function(){if(tmr.current)clearTimeout(tmr.current);setModal(null)}} K={K}>
      <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"0 16px"}}><div><Inp label="Ticker" value={f.ticker} onChange={onTicker} placeholder="AAPL" K={K} spellCheck={false} autoCorrect="off" autoComplete="off"/>
        {ls!=="idle"&&<div style={{fontSize:11,color:ls==="loading"?K.dim:ls==="done"?K.grn:K.amb,marginTop:-10,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
          {ls==="loading"&&<span style={{display:"inline-block",width:10,height:10,border:"2px solid "+K.bdr2,borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>}{ls==="loading"?"Looking up\u2026":lm}</div>}</div>
        <Inp label="Company Name" value={f.name} onChange={function(v){set("name",v)}} placeholder="Apple Inc." K={K}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}><Inp label="Sector" value={f.sector} onChange={function(v){set("sector",v)}} placeholder="Technology" K={K}/><Inp label="Earnings Date" value={f.earningsDate} onChange={function(v){set("earningsDate",v)}} type="date" K={K}/><Sel label="Timing" value={f.earningsTime} onChange={function(v){set("earningsTime",v)}} options={[{v:"BMO",l:"Before Open"},{v:"AMC",l:"After Close"}]} K={K}/></div>
      <Inp label="Investment Thesis" value={f.thesis} onChange={function(v){set("thesis",v)}} ta placeholder="Why do you own this?" K={K}/>
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
    var _f=useState({name:ex?ex.name:"",rule:ex?ex.rule:"gte",value:ex?String(ex.value):"",unit:ex?ex.unit:"%",period:ex?ex.period:"",notes:ex?ex.notes:""}),f=_f[0],setF=_f[1];var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    var sugs=!ex?getSugs(sel.sector).filter(function(s){return!sel.kpis.some(function(k){return k.name.toLowerCase()===s.toLowerCase()})}):[];
    function doSave(){var nv=parseFloat(f.value);if(!f.name.trim()||isNaN(nv))return;var kd={name:f.name.trim(),rule:f.rule,value:nv,unit:f.unit,period:f.period.trim(),target:bT(f.rule,nv,f.unit),notes:f.notes.trim()};
      if(ex)upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.map(function(k){return k.id===kid?Object.assign({},k,kd):k})})});else upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.concat([Object.assign({id:nId(c.kpis),lastResult:null},kd)])})});setModal(null)}
    return<Modal title={ex?"Edit Metric":"Add Metric"} onClose={function(){setModal(null)}} w={500} K={K}>
      {sugs.length>0&&<div style={{marginBottom:20}}><div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:K.dim,marginBottom:8,fontFamily:fm}}>Suggested for {sel.sector}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{sugs.map(function(s,i){return<button key={i} onClick={function(){set("name",s)}} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:4,padding:"5px 10px",fontSize:11,color:K.mid,cursor:"pointer",fontFamily:fm}}>{s}</button>})}</div></div>}
      <Inp label="Metric Name" value={f.name} onChange={function(v){set("name",v)}} placeholder="Revenue Growth YoY" K={K}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}><Sel label="Rule" value={f.rule} onChange={function(v){set("rule",v)}} options={[{v:"gte",l:"\u2265 At least"},{v:"lte",l:"\u2264 At most"},{v:"eq",l:"= Exactly"}]} K={K}/><Inp label="Target" value={f.value} onChange={function(v){set("value",v)}} type="number" placeholder="35" K={K}/><Sel label="Unit" value={f.unit} onChange={function(v){set("unit",v)}} options={[{v:"%",l:"%"},{v:"B",l:"Billions"},{v:"M",l:"Millions"},{v:"$",l:"$"},{v:"x",l:"x"},{v:"",l:"None"}]} K={K}/></div>
      <Inp label="Period" value={f.period} onChange={function(v){set("period",v)}} placeholder="Q4 2025" K={K}/>
      <Inp label="Lookup Hints" value={f.notes} onChange={function(v){set("notes",v)}} ta placeholder="Help AI find: 'GAAP basis', 'non-GAAP op income'" K={K}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:8}}>{ex&&<button style={S.btnD} onClick={function(){upd(selId,function(c){return Object.assign({},c,{kpis:c.kpis.filter(function(k){return k.id!==kid})})});setModal(null)}}>Delete</button>}<div style={{flex:1}}/><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:f.name.trim()&&f.value?1:.4})} onClick={doSave}>Save</button></div></Modal>}
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
  function renderModal(){if(!modal)return null;var map={add:AddModal,edit:EditModal,thesis:ThesisModal,kpi:KpiModal,result:ResultModal,del:DelModal,doc:DocModal};var C=map[modal.type];return C?<C/>:null}

  // ── Sidebar + TopBar ──────────────────────────────────────
  function Sidebar(){return<div style={{width:240,minWidth:240,background:K.side,borderRight:"1px solid "+K.bdr,height:"100vh",position:"sticky",top:0,display:"flex",flexDirection:"column",overflowY:"auto"}}>
    <div style={{padding:"18px 20px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={function(){setSelId(null)}}><TLogo size={22} dark={isDark}/><span style={{fontSize:13,fontWeight:600,color:K.txt,letterSpacing:1.5,fontFamily:fm}}>ThesisAlpha</span></div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:!selId?K.blue+"10":"transparent",borderLeft:!selId?"2px solid "+K.blue:"2px solid transparent"}} onClick={function(){setSelId(null)}}><span style={{fontSize:12,color:!selId?K.blue:K.mid,fontWeight:!selId?600:400,fontFamily:fm}}>Portfolio Overview</span></div>
    <div style={{padding:"12px 0 6px 20px"}}><div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:K.dim,fontFamily:fm}}>Companies</div></div>
    <div style={{flex:1,overflowY:"auto"}}>{cos.map(function(c){var active=selId===c.id,h=gH(c.kpis),d=dU(c.earningsDate);
      return<div key={c.id} style={{padding:"10px 16px 10px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,background:active?K.blue+"10":"transparent",borderLeft:active?"2px solid "+K.blue:"2px solid transparent"}} onClick={function(){setSelId(c.id);setExpKpi(null)}}>
        <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:active?K.txt:K.mid,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:10,color:K.dim,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div></div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}><div style={{width:6,height:6,borderRadius:"50%",background:h.c}}/>
          {d>=0&&d<=7&&<div style={{fontSize:9,color:K.amb,fontWeight:600,fontFamily:fm}}>{d}d</div>}
          {c.earningsDate==="TBD"&&<div style={{fontSize:9,color:K.dim,fontFamily:fm}}>TBD</div>}</div></div>})}</div>
    <div style={{padding:"12px 16px",borderTop:"1px solid "+K.bdr}}><button style={Object.assign({},S.btnP,{width:"100%",padding:"8px",fontSize:11})} onClick={function(){setModal({type:"add"})}}>+ Add Company</button></div></div>}
  function TopBar(){return<div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"12px 32px",borderBottom:"1px solid "+K.bdr,background:K.card,position:"sticky",top:0,zIndex:50,gap:12}}>
    <button onClick={toggleTheme} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:14,color:K.mid}} title={isDark?"Light mode":"Dark mode"}>{isDark?"\u2600\uFE0F":"\uD83C\uDF19"}</button>
    <div style={{position:"relative",cursor:"pointer",padding:4}} onClick={function(){setShowNotifs(!showNotifs);if(!showNotifs)setNotifs(function(p){return p.map(function(n){return Object.assign({},n,{read:true})})})}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={unread>0?K.mid:K.dim} strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      {unread>0&&<div style={{position:"absolute",top:1,right:1,width:8,height:8,borderRadius:"50%",background:K.grn,border:"2px solid "+K.card}}/>}</div>
    {showNotifs&&<div style={{position:"absolute",top:48,right:32,width:380,maxHeight:420,overflowY:"auto",background:K.card,border:"1px solid "+K.bdr2,borderRadius:12,boxShadow:"0 16px 48px rgba(0,0,0,.3)",zIndex:100}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>Notifications</span>{notifs.length>0&&<button style={Object.assign({},S.btn,{padding:"2px 8px",fontSize:10})} onClick={function(){setNotifs([])}}>Clear</button>}</div>
      {notifs.length===0?<div style={{padding:"36px 18px",textAlign:"center",fontSize:12,color:K.dim}}>No notifications</div>:notifs.slice(0,15).map(function(n){return<div key={n.id} style={{padding:"12px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:n.type==="found"?K.grn:K.amb,flexShrink:0,marginTop:4}}/><div><div style={{fontSize:12,color:K.txt,fontFamily:fm}}><strong>{n.ticker}</strong> <span style={{color:K.mid,fontWeight:400}}>{n.msg}</span></div><div style={{fontSize:10,color:K.dim,marginTop:3}}>{fT(n.time)}</div></div></div>})}</div>}
    <button onClick={function(){props.onLogout()}} style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:10})}>Logout</button>
    <div style={{width:28,height:28,borderRadius:"50%",background:K.acc+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:K.acc,fontWeight:600,fontFamily:fm}}>{(props.user||"U")[0].toUpperCase()}</div></div>}

  // ── AI Detectors (simplified reference — same logic, theme-aware) ──
  function NarrativeDrift(p){var c=p.company;var _st=useState("idle"),st=_st[0],setSt=_st[1];var _d=useState(null),data=_d[0],setData=_d[1];var _txt=useState(""),txt=_txt[0],setTxt=_txt[1];var _su=useState(false),su=_su[0],setSu=_su[1];
    var sev=function(s){return s==="high"?K.red:s==="medium"?K.amb:K.grn};
    function runWith(text){if(!text||!text.trim())return;setSt("loading");analyzeNarrativeDrift(c.ticker,c.name,text).then(function(r){if(r.overallRisk==="unknown"&&(!r.drifts||!r.drifts.length)){setSt("idle");setSu(true)}else{setData(r);setSt("done")}}).catch(function(){setSt("error");setSu(true)})}
    function autoRun(){var t=(c.earningSummary||"");c.kpis.forEach(function(k){if(k.lastResult)t+="\n"+k.name+": "+k.lastResult.actual});if(c.notes)t+="\n"+c.notes;if(!t.trim()){setSu(true);return}runWith(t)}
    function handleFile(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){setTxt(ev.target.result)};r.readAsText(f)}
    return<div style={{marginBottom:28}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={S.sec}>{"\uD83D\uDD0D"} Narrative Drift</div>
      <div style={{display:"flex",gap:6}}>{st!=="loading"&&<button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={autoRun}>{st==="done"?"Re-analyze":"Auto-Analyze"}</button>}{st!=="loading"&&<button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setSu(!su)}}>{su?"Hide":"Upload"}</button>}</div></div>
    {st==="idle"&&!su&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:10,padding:24,textAlign:"center",fontSize:12,color:K.dim}}>Compares current vs previous quarters for narrative changes.</div>}
    {su&&st!=="done"&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:20,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}><label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,cursor:"pointer",fontSize:11,color:K.mid,fontFamily:fm}}>Upload .txt<input type="file" accept=".txt" style={{display:"none"}} onChange={handleFile}/></label><span style={{fontSize:11,color:K.dim}}>or paste below</span></div>
      <textarea value={txt} onChange={function(e){setTxt(e.target.value)}} rows={4} placeholder="Paste transcript..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"12px",fontSize:12,fontFamily:fm,outline:"none",resize:"vertical"}}/>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><button style={Object.assign({},S.btnP,{padding:"7px 16px",fontSize:11,opacity:txt.trim()?1:.4})} onClick={function(){runWith(txt)}} disabled={!txt.trim()}>Analyze</button></div></div>}
    {st==="loading"&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:24,textAlign:"center"}}><span style={{display:"inline-block",width:14,height:14,border:"2px solid "+K.blue+"40",borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite",verticalAlign:"middle",marginRight:8}}/><span style={{fontSize:12,color:K.blue}}>Analyzing{"\u2026"}</span></div>}
    {st==="error"&&<div style={{background:K.red+"10",border:"1px solid "+K.red+"30",borderRadius:10,padding:16,fontSize:12,color:K.red}}>Failed. Try uploading manually.</div>}
    {st==="done"&&data&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,overflow:"hidden"}}>
      <div style={{padding:"14px 20px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><span style={{fontSize:12,color:K.txt}}>Overall Risk</span>{data.quartersCompared&&data.quartersCompared.length>0&&<span style={{fontSize:10,color:K.dim,marginLeft:10,fontFamily:fm}}>vs {data.quartersCompared.join(", ")}</span>}</div><span style={S.badge(sev(data.overallRisk))}>{(data.overallRisk||"low").toUpperCase()}</span></div>
      {data.summary&&<div style={{padding:"14px 20px",borderBottom:"1px solid "+K.bdr,fontSize:12,color:K.mid,lineHeight:1.6}}>{data.summary}</div>}
      {data.drifts&&data.drifts.map(function(d,i){var tl=d.type==="missing_kpi"?"Missing KPI":d.type==="definition_change"?"Def Change":d.type==="tone_shift"?"Tone Shift":"New Narrative";
        return<div key={i} style={{padding:"14px 20px",borderBottom:i<data.drifts.length-1?"1px solid "+K.bdr:"none"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:6,height:6,borderRadius:"50%",background:sev(d.severity)}}/><span style={{fontSize:10,color:sev(d.severity),textTransform:"uppercase",letterSpacing:1,fontWeight:600,fontFamily:fm}}>{tl}</span><span style={{fontSize:12,color:K.txt,fontWeight:500,marginLeft:4}}>{d.title}</span></div>
          <div style={{fontSize:12,color:K.dim,lineHeight:1.6,paddingLeft:14}}>{d.detail}</div></div>})}
      <div style={{padding:"12px 20px",borderTop:"1px solid "+K.bdr}}><button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setSt("idle");setSu(true)}}>Re-analyze</button></div></div>}</div>}
  function QAEvasion(p){var c=p.company;var _st=useState("idle"),st=_st[0],setSt=_st[1];var _d=useState(null),data=_d[0],setData=_d[1];var _txt=useState(""),txt=_txt[0],setTxt=_txt[1];var _su=useState(false),su=_su[0],setSu=_su[1];
    var sev=function(s){return s==="high"?K.red:s==="medium"?K.amb:K.grn};var sc=function(s){return s>=.6?K.red:s>=.3?K.amb:K.grn};
    function run(t){var text=t||txt;if(!text.trim())return;setSt("loading");analyzeQAEvasion(c.ticker,text).then(function(r){setData(r);setSt("done")}).catch(function(){setSt("error")})}
    function autoFetch(){setSt("loading");fetchQATranscript(c.ticker).then(function(r){if(r.found){setTxt(r.transcript);run(r.transcript)}else{setSt("idle");setSu(true)}}).catch(function(){setSt("idle");setSu(true)})}
    function handleFile(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){setTxt(ev.target.result)};r.readAsText(f)}
    return<div style={{marginBottom:28}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={S.sec}>{"\u26A0\uFE0F"} Q&A Evasion</div>
      <div style={{display:"flex",gap:6}}>{st!=="loading"&&<button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={autoFetch}>Auto-Fetch</button>}{st!=="loading"&&<button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setSu(!su)}}>{su?"Hide":"Upload"}</button>}</div></div>
    {st==="idle"&&!su&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:10,padding:24,textAlign:"center",fontSize:12,color:K.dim}}>Flags evasive answers, topic redirects, vague generalizations.</div>}
    {su&&st!=="done"&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:20,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}><label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,cursor:"pointer",fontSize:11,color:K.mid,fontFamily:fm}}>Upload .txt<input type="file" accept=".txt" style={{display:"none"}} onChange={handleFile}/></label><span style={{fontSize:11,color:K.dim}}>or paste Q&A</span></div>
      <textarea value={txt} onChange={function(e){setTxt(e.target.value)}} rows={4} placeholder="Paste Q&A..." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:6,color:K.txt,padding:"12px",fontSize:12,fontFamily:fm,outline:"none",resize:"vertical"}}/>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><button style={Object.assign({},S.btnP,{padding:"7px 16px",fontSize:11,opacity:txt.trim()?1:.4})} onClick={function(){run()}} disabled={!txt.trim()}>Analyze</button></div></div>}
    {st==="loading"&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:24,textAlign:"center"}}><span style={{display:"inline-block",width:14,height:14,border:"2px solid "+K.blue+"40",borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite",verticalAlign:"middle",marginRight:8}}/><span style={{fontSize:12,color:K.blue}}>Analyzing{"\u2026"}</span></div>}
    {st==="error"&&<div style={{background:K.red+"10",border:"1px solid "+K.red+"30",borderRadius:10,padding:16,fontSize:12,color:K.red}}>Failed. Try pasting manually.</div>}
    {st==="done"&&data&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,overflow:"hidden"}}>
      <div style={{padding:"14px 20px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:K.txt}}>Evasion Score</span><span style={S.badge(sc(data.evasionScore||0))}>{Math.round((data.evasionScore||0)*100)}%</span></div>
      {data.summary&&<div style={{padding:"14px 20px",borderBottom:"1px solid "+K.bdr,fontSize:12,color:K.mid,lineHeight:1.6}}>{data.summary}</div>}
      {data.evasions&&data.evasions.map(function(ev,i){var tl=ev.evasionType==="topic_redirect"?"Redirect":ev.evasionType==="vague_generalization"?"Vague":ev.evasionType==="non_answer"?"Non-Answer":"Cherry Pick";
        return<div key={i} style={{padding:"14px 20px",borderBottom:i<data.evasions.length-1?"1px solid "+K.bdr:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:6,height:6,borderRadius:"50%",background:sev(ev.severity)}}/><span style={{fontSize:10,color:sev(ev.severity),textTransform:"uppercase",letterSpacing:1,fontWeight:600,fontFamily:fm}}>{tl}</span></div>
          <div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"12px 16px",marginBottom:8}}><div style={{fontSize:10,color:K.dim,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Analyst</div><div style={{fontSize:12,color:K.txt,lineHeight:1.5}}>{ev.analystQuestion}</div></div>
          <div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:"12px 16px",marginBottom:8}}><div style={{fontSize:10,color:K.dim,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Executive</div><div style={{fontSize:12,color:K.txt,lineHeight:1.5}}>{ev.executiveAnswer}</div></div>
          <div style={{fontSize:11,color:K.amb,lineHeight:1.5}}>{ev.explanation}</div></div>})}
      <div style={{padding:"12px 20px",borderTop:"1px solid "+K.bdr}}><button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setSt("idle");setSu(true)}}>Re-analyze</button></div></div>}
    </div>}

  // ── Notes Editor (local state, debounced sync) ────────────
  function ThesisVault(p){var c=p.company;var docs=c.docs||[];
    var _af=useState("all"),af=_af[0],setAf=_af[1];
    var filtered=af==="all"?docs:docs.filter(function(d){return d.folder===af});
    var folderCounts={};FOLDERS.forEach(function(f){folderCounts[f.id]=docs.filter(function(d){return d.folder===f.id}).length});
    return<div style={{marginBottom:28}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={S.sec}>{"\uD83D\uDCC1"} Thesis Vault</div>
        <button style={Object.assign({},S.btnP,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>+ New Note</button></div>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={function(){setAf("all")}} style={{background:af==="all"?K.acc+"20":"transparent",border:"1px solid "+(af==="all"?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 12px",fontSize:11,color:af==="all"?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>All ({docs.length})</button>
        {FOLDERS.map(function(fo){return<button key={fo.id} onClick={function(){setAf(fo.id)}} style={{background:af===fo.id?K.acc+"20":"transparent",border:"1px solid "+(af===fo.id?K.acc+"50":K.bdr),borderRadius:6,padding:"5px 12px",fontSize:11,color:af===fo.id?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>{fo.icon} {fo.label} {folderCounts[fo.id]>0?"("+folderCounts[fo.id]+")":""}</button>})}</div>
      {filtered.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:10,padding:28,textAlign:"center"}}><div style={{fontSize:13,color:K.dim,marginBottom:8}}>{af==="all"?"No notes yet for "+c.ticker:"No notes in this folder"}</div><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>Create your first note</button></div>}
      {filtered.map(function(d){var fo=FOLDERS.find(function(f){return f.id===d.folder});
        return<div key={d.id} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px",marginBottom:8,cursor:"pointer"}} onClick={function(){setModal({type:"doc",data:d.id})}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:12}}>{fo?fo.icon:"\uD83D\uDCDD"}</span>
            <span style={{fontSize:13,fontWeight:500,color:K.txt,flex:1}}>{d.title}</span>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{d.updatedAt?new Date(d.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>
          {d.content&&<div style={{fontSize:12,color:K.dim,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{d.content.substring(0,200)}</div>}</div>})}</div>}

  // ── Detail View ───────────────────────────────────────────
  function DetailView(){if(!sel)return null;var c=sel;var h=gH(c.kpis);var cs=checkSt[c.id];
    return<div style={{padding:"0 32px 60px",maxWidth:900}}>
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"28px 0 16px"}}><CoLogo domain={c.domain} ticker={c.ticker} size={36}/>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker}<span style={{fontWeight:300,color:K.mid,marginLeft:8,fontSize:16}}>{c.name}</span></div>
          <div style={{display:"flex",gap:8,marginTop:4}}><span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.sector}</span><span style={{fontSize:11,color:K.dim}}>{"\u2022"}</span><span style={{fontSize:11,color:dU(c.earningsDate)<=7&&dU(c.earningsDate)>=0?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"Earnings: TBD":"Earnings: "+fD(c.earningsDate)+" "+c.earningsTime}</span></div></div>
        <div style={{display:"flex",gap:8}}>{c.irUrl&&<a href={c.irUrl} target="_blank" rel="noopener noreferrer" style={Object.assign({},S.btn,{display:"inline-flex",alignItems:"center",gap:5,textDecoration:"none",padding:"5px 12px",fontSize:11})}>IR{"\u2197"}</a>}
          <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"edit"})}}>Settings</button>
          <button style={Object.assign({},S.btnD,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"del"})}}>Remove</button>
          <button style={Object.assign({},S.btnChk,{padding:"7px 16px",fontSize:11,opacity:cs==="checking"?.6:1})} onClick={function(){checkOne(c.id)}} disabled={cs==="checking"}>{cs==="checking"?"Checking\u2026":cs==="found"?"\u2713 Found":cs==="not-yet"?"Not Yet":cs==="error"?"\u2718 Error":"Check Earnings"}</button></div></div>
      {c.thesisNote&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px",marginBottom:20}}><div style={S.sec}>Investment Thesis</div><div style={{fontSize:13,color:K.mid,lineHeight:1.6,cursor:"pointer"}} onClick={function(){setModal({type:"thesis"})}}>{c.thesisNote}</div></div>}
      {c.earningSummary&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px",marginBottom:20}}><div style={S.sec}>Latest Earnings</div><div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{c.earningSummary}</div>
        {c.sourceUrl&&<a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:K.blue,textDecoration:"none",marginTop:8}}>{c.sourceLabel||"Source"}{"\u2197"}</a>}
        {c.lastChecked&&<div style={{fontSize:10,color:K.dim,marginTop:6}}>Checked: {fT(c.lastChecked)}</div>}</div>}
      <div style={{marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sec}>Key Metrics</div><button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"kpi"})}}>+ Add</button></div>
        {c.kpis.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:10,padding:24,textAlign:"center",fontSize:12,color:K.dim}}>No metrics yet.</div>}
        {c.kpis.map(function(k){return<div key={k.id} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px",marginBottom:8,cursor:"pointer"}} onClick={function(){setExpKpi(expKpi===k.id?null:k.id)}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><div style={S.dot(k.lastResult?k.lastResult.status:null)}/>
            <div style={{flex:1}}><div style={{fontSize:13,color:K.txt,fontWeight:500}}>{k.name}</div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{k.target}{k.period?" \u2022 "+k.period:""}</div></div>
            {k.lastResult&&<div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:600,color:k.lastResult.status==="met"?K.grn:K.red,fontFamily:fm}}>{k.lastResult.actual}{k.unit||""}</div><div style={{fontSize:10,color:k.lastResult.status==="met"?K.grn:K.red,fontFamily:fm}}>{k.lastResult.status.toUpperCase()}</div></div>}
            {!k.lastResult&&<span style={{fontSize:11,color:K.dim}}>Pending</span>}</div>
          {expKpi===k.id&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid "+K.bdr,display:"flex",gap:8}}>
            <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:10})} onClick={function(e){e.stopPropagation();setModal({type:"result",data:k.id})}}>Enter Result</button>
            <button style={Object.assign({},S.btn,{padding:"5px 10px",fontSize:10})} onClick={function(e){e.stopPropagation();setModal({type:"kpi",data:k.id})}}>Edit</button>
            {k.lastResult&&k.lastResult.excerpt&&<div style={{flex:1,fontSize:11,color:K.dim,fontStyle:"italic",paddingLeft:8}}>"{k.lastResult.excerpt}"</div>}</div>}</div>})}</div>
      <NarrativeDrift company={c}/><QAEvasion company={c}/>
      <ThesisVault company={c}/>
      <div style={{padding:"16px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10}}><div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>{"\u2139\uFE0F"} Powered by <a href="https://site.financialmodelingprep.com" target="_blank" rel="noopener noreferrer" style={{color:K.blue,textDecoration:"none"}}>FMP</a> + Claude AI</div></div>
    </div>}
  function Dashboard(){return<div style={{padding:"0 32px 60px",maxWidth:1100}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"28px 0 20px"}}><div><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>Portfolio Overview</h1><p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{cos.length} companies tracked</p></div>
      <div style={{display:"flex",gap:8}}><button style={S.btnChk} onClick={checkAll}>Check All</button><button style={Object.assign({},S.btnP,{padding:"9px 18px",fontSize:12})} onClick={function(){setModal({type:"add"})}}>+ Add</button></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
      {cos.map(function(c){var h=gH(c.kpis);var d=dU(c.earningsDate);var cs2=checkSt[c.id];var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;var total=c.kpis.filter(function(k){return k.lastResult}).length;
        return<div key={c.id} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",cursor:"pointer",transition:"border-color .2s",position:"relative"}} onClick={function(){setSelId(c.id)}} onMouseEnter={function(e){e.currentTarget.style.borderColor=K.bdr2}} onMouseLeave={function(e){e.currentTarget.style.borderColor=K.bdr}}>
          <button onClick={function(e){e.stopPropagation();setCos(function(p){return p.filter(function(x){return x.id!==c.id})})}} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:K.dim,fontSize:14,cursor:"pointer",padding:4,opacity:.4}} title="Remove">{"\u2715"}</button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><CoLogo domain={c.domain} ticker={c.ticker} size={28}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</div><div style={{fontSize:11,color:K.dim}}>{c.name}</div></div><span style={S.badge(h.c)}>{h.l}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:"1px solid "+K.bdr}}><div style={{fontSize:11,color:d>=0&&d<=7?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"TBD":(d<=0?"Reported":d+"d \u2014 "+fD(c.earningsDate))}</div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{total>0?met+"/"+total+" met":c.kpis.length+" KPIs"}{cs2==="checking"?" \u23F3":""}</div></div></div>})}</div></div>}
  return(<div style={{display:"flex",height:"100vh",background:K.bg,color:K.txt,fontFamily:fb,overflow:"hidden"}}>{renderModal()}<Sidebar/><div style={{flex:1,overflowY:"auto"}}><TopBar/>{sel?<DetailView/>:<Dashboard/>}</div></div>)}

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
  if(!ready)return<div style={{background:"#06060A",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#5A5A65",fontSize:13,fontFamily:"monospace"}}>Loading...</span></div>;
  if(!user)return<LoginPage onAuth={onAuth}/>;
  return<TrackerApp user={user.email||""} onLogout={onLogout}/>;
}
