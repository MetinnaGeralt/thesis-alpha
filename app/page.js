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
async function aiCall(sys,msg,search,useSonnet){
  var model=useSonnet?"claude-sonnet-4-20250514":"claude-haiku-4-5-20251001";
  var body={model:model,max_tokens:useSonnet?2000:800};if(sys)body.system=sys;
  if(search)body.tools=[{type:"web_search_20250305",name:"web_search"}];
  body.messages=[{role:"user",content:msg}];
  var r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok)throw new Error("AI "+r.status);var d=await r.json();
  return(d&&d.content||[]).filter(function(b){return b.type==="text"}).map(function(b){return b.text}).join("\n")}
async function aiJSON(sys,msg,search,useSonnet){return xJSON(await aiCall(sys,msg,search,useSonnet))}
var SJ="Financial data assistant. Respond ONLY with raw JSON. No markdown.";

// ═══ DATA FUNCTIONS ═══
async function lookupTicker(ticker){var t=ticker.toUpperCase().trim();
  try{
    var p=await fmp("profile?symbol="+t);
    if(p&&p.length&&p[0].companyName){var pr=p[0],domain="",irUrl="";
      if(pr.website){try{domain=new URL(pr.website).hostname.replace("www.","")}catch(e){domain=pr.website.replace(/https?:\/\/(www\.)?/,"").split("/")[0]}
        irUrl="https://www.google.com/search?q="+encodeURIComponent(t+" "+pr.companyName+" investor relations")+"&btnI=1"}
      return{name:pr.companyName,sector:pr.sector||pr.industry||"",industry:pr.industry||"",earningsDate:"TBD",earningsTime:"TBD",domain:domain,irUrl:irUrl||"",price:pr.price||0,lastDiv:pr.lastDiv||0,mktCap:pr.mktCap||0}}
  }catch(e){console.warn("FMP lookup failed:",e)}
  return{error:"Not found on FMP — enter details manually"}}
async function fetchPrice(ticker){try{var p=await fmp("profile?symbol="+ticker);if(p&&p.length&&p[0].price)return{price:p[0].price,lastDiv:p[0].lastDiv||0};return null}catch(e){return null}}
async function fetchEarnings(co,kpis){
  var kl=kpis&&kpis.length?kpis.map(function(k){return k.name+" (target: "+k.target+")"+(k.notes?" [hint: "+k.notes+"]":"")}).join(", "):"";
  var prompt=co.ticker+" "+co.name+" latest quarterly earnings results.";
  if(kl){prompt+=" IMPORTANT: Search specifically for these metrics: "+kl+".";
    prompt+=" Some may be non-financial (e.g. subscribers, users, bookings). Check the earnings press release AND shareholder letter for ALL metrics.";}
  prompt+=" Also find: revenue, EPS, margins, guidance.";
  prompt+="\nReturn ONLY JSON:\n";
  prompt+='{"found":true,"quarter":"Q? YYYY","summary":"2-3 sentences with ALL key numbers including custom metrics","results":[';
  if(kpis&&kpis.length){prompt+=kpis.map(function(k){return'{"kpi_name":"'+k.name+'","actual_value":NUMBER_OR_NULL,"status":"met|missed|unclear","excerpt":"where you found it"}'}).join(",")}
  prompt+='],"sourceUrl":"press release URL","sourceLabel":"source name"}';
  prompt+='\nIf not yet reported: {"found":false,"reason":"why"}';
  prompt+="\nCRITICAL: You MUST fill actual_value for EVERY KPI. Search the press release, shareholder letter, and investor presentation. Non-financial metrics like daily active users, subscribers, or bookings are often in the press release body, not just the financial tables.";
  try{var r=await aiJSON(SJ,prompt,true,false);return r}
  catch(e){return{found:false,reason:"Earnings lookup failed. Check Anthropic API credits."}}}
async function lookupNextEarnings(ticker){
  try{var r=await aiJSON(SJ,"What is the next earnings date for "+ticker+"? Search the web. Return:{\"earningsDate\":\"YYYY-MM-DD\",\"earningsTime\":\"BMO or AMC\"} If unknown:{\"earningsDate\":\"TBD\",\"earningsTime\":\"TBD\"}",true,false);
    if(r&&r.earningsDate&&r.earningsDate!=="TBD")return r}catch(e){}
  return{earningsDate:"TBD",earningsTime:"TBD"}}
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
var SAMPLE=[{id:1,ticker:"NVDA",name:"NVIDIA Corporation",sector:"Semiconductors",domain:"nvidia.com",irUrl:"https://investor.nvidia.com",earningsDate:"2026-02-26",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:"https://investor.nvidia.com",sourceLabel:"Q4 FY26",earningSummary:"Data Center revenue surged 93% YoY to $39.2B.",thesisNote:"AI capex cycle still early innings.",position:{shares:50,avgCost:128.5},conviction:9,convictionHistory:[{date:"2025-06-01",rating:8,note:"Strong but expensive"},{date:"2025-11-20",rating:9,note:"Data center demand insatiable"},{date:"2026-01-15",rating:9,note:"AI capex still accelerating"}],status:"portfolio",docs:[{id:1,title:"Core Thesis: AI Infrastructure",folder:"why-i-own",content:"NVIDIA is the picks-and-shovels play on AI. Data center GPU demand is insatiable.",updatedAt:"2026-01-15T10:00:00Z"}],earningsHistory:[{quarter:"Q3 2025",summary:"Revenue $35.1B (+94% YoY). Data Center $30.8B. Gross margin 74.6%.",results:[{kpi_name:"Data Center Revenue",actual_value:30.8,status:"met",excerpt:"Data Center $30.8B"},{kpi_name:"Gross Margin",actual_value:74.6,status:"met",excerpt:"GAAP GM 74.6%"}],sourceUrl:"https://investor.nvidia.com",sourceLabel:"NVIDIA Press Release",checkedAt:"2025-11-20T18:00:00Z"},{quarter:"Q2 2025",summary:"Revenue $30.0B (+122% YoY). Data Center $26.3B. Gross margin 75.1%.",results:[{kpi_name:"Data Center Revenue",actual_value:26.3,status:"met",excerpt:"Data Center $26.3B"},{kpi_name:"Gross Margin",actual_value:75.1,status:"met",excerpt:"GAAP GM 75.1%"}],sourceUrl:"https://investor.nvidia.com",sourceLabel:"NVIDIA Press Release",checkedAt:"2025-08-28T18:00:00Z"}],kpis:[{id:1,name:"Data Center Revenue",target:"\u226535B",rule:"gte",value:35,unit:"B",period:"Q4 FY26",notes:"",lastResult:{actual:39.2,status:"met",excerpt:"Data Center revenue was $39.2B."}},{id:2,name:"Gross Margin",target:"\u226573%",rule:"gte",value:73,unit:"%",period:"Q4 FY26",notes:"GAAP",lastResult:{actual:73.5,status:"met",excerpt:"GAAP gross margin was 73.5%."}}]},{id:2,ticker:"CRWD",name:"CrowdStrike",sector:"Cybersecurity",domain:"crowdstrike.com",irUrl:"https://ir.crowdstrike.com",earningsDate:"2026-03-04",earningsTime:"AMC",lastChecked:null,notes:"",sourceUrl:null,sourceLabel:null,earningSummary:null,thesisNote:"Post-outage recovery.",position:{shares:0,avgCost:0},conviction:6,convictionHistory:[{date:"2025-09-01",rating:5,note:"Outage fallout"},{date:"2026-01-10",rating:6,note:"Recovery underway"}],status:"watchlist",docs:[],earningsHistory:[],kpis:[{id:1,name:"Net New ARR",target:"\u2265220M",rule:"gte",value:220,unit:"M",period:"Q4 FY26",notes:"",lastResult:null},{id:2,name:"Gross Retention",target:"\u226595%",rule:"gte",value:95,unit:"%",period:"Q4 FY26",notes:"",lastResult:null}]}];
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
  <button onClick={toggleTheme} style={{position:"absolute",top:20,right:24,background:"none",border:"1px solid "+K.bdr,borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:14,color:K.mid}}>{theme==="dark"?"\u2600\uFE0F":"\uD83C\uDF19"}</button>
  <div style={{width:400,padding:"48px 40px",background:K.card,border:"1px solid "+K.bdr,borderRadius:20,boxShadow:theme==="dark"?"0 32px 64px rgba(0,0,0,.4)":"0 32px 64px rgba(0,0,0,.08)"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:28}}><TLogo size={24}/><span style={{fontSize:16,fontWeight:600,letterSpacing:2,fontFamily:fm,color:K.txt}}>ThesisAlpha</span></div>
    <h2 style={{fontSize:28,fontFamily:fh,fontWeight:400,margin:"0 0 8px",textAlign:"center",color:K.txt}}>{mode==="login"?"Welcome back":"Create account"}</h2>
    <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 32px"}}>{mode==="login"?"Sign in to your portfolio":"Start tracking your thesis"}</p>
    {err&&<div style={{background:K.red+"12",border:"1px solid "+K.red+"30",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:K.red}}>{err}</div>}
    <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Email</label>
      <input type="email" value={email} onChange={function(e){setEmail(e.target.value);setErr("")}} placeholder="you@email.com" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <div style={{marginBottom:24}}><label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,letterSpacing:1,textTransform:"uppercase",fontFamily:fm}}>Password</label>
      <input type="password" value={pw} onChange={function(e){setPw(e.target.value);setErr("")}} placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,color:K.txt,padding:"12px 16px",fontSize:14,fontFamily:fb,outline:"none"}} onKeyDown={function(e){if(e.key==="Enter")submit()}}/></div>
    <button onClick={submit} disabled={ld2} style={{width:"100%",background:K.acc,color:"#fff",border:"none",padding:"14px",borderRadius:10,fontSize:14,fontWeight:600,cursor:ld2?"wait":"pointer",fontFamily:fb,marginBottom:16,opacity:ld2?.6:1}}>{ld2?"...":(mode==="login"?"Sign In":"Create Account")}</button>
    <div style={{textAlign:"center",fontSize:13,color:K.dim}}>{mode==="login"?"Don't have an account? ":"Already have an account? "}<span onClick={function(){setMode(mode==="login"?"signup":"login");setErr("")}} style={{color:K.acc,cursor:"pointer"}}>{mode==="login"?"Sign up":"Sign in"}</span></div>
  </div></div>)}

// ═══ TRACKER APP ═══
function TrackerApp(props){
  var _th=useState(function(){try{return localStorage.getItem("ta-theme")||"dark"}catch(e){return"dark"}}),theme=_th[0],setTheme=_th[1];
  var K=theme==="dark"?DARK:LIGHT;var S=mkS(K);var isDark=theme==="dark";
  function toggleTheme(){var n=theme==="dark"?"light":"dark";setTheme(n);try{localStorage.setItem("ta-theme",n)}catch(e){}}
  var _c=useState(SAMPLE),cos=_c[0],setCos=_c[1];var _l=useState(false),loaded=_l[0],setLoaded=_l[1];
  var _s=useState(null),selId=_s[0],setSelId=_s[1];var _ek=useState(null),expKpi=_ek[0],setExpKpi=_ek[1];
  var _m=useState(null),modal=_m[0],setModal=_m[1];var _ck=useState({}),checkSt=_ck[0],setCheckSt=_ck[1];
  var _pg=useState("dashboard"),page=_pg[0],setPage=_pg[1];
  var _n=useState([]),notifs=_n[0],setNotifs=_n[1];var _sn=useState(false),showNotifs=_sn[0],setShowNotifs=_sn[1];
  var _st2=useState("portfolio"),sideTab=_st2[0],setSideTab=_st2[1];
  var _an=useState(function(){try{return localStorage.getItem("ta-autonotify")==="true"}catch(e){return false}}),autoNotify=_an[0],setAutoNotify=_an[1];
  var _pr=useState(false),priceLoading=_pr[0],setPriceLoading=_pr[1];
  var saveTimer=useRef(null);
  useEffect(function(){ldS("ta-data").then(function(d){if(d&&d.cos){setCos(d.cos.map(function(c){return Object.assign({docs:[],earningsHistory:[],position:{shares:0,avgCost:0,currentPrice:0},conviction:0,convictionHistory:[],status:"portfolio",industry:"",lastDiv:0,divPerShare:0,divFrequency:"quarterly",exDivDate:""},c)}));}if(d&&d.notifs)setNotifs(d.notifs);setLoaded(true)})},[]);
  // Auto-refresh prices on load (FMP profile is free, ~1 req per company)
  useEffect(function(){if(!loaded||cos.length===0)return;
    var t=setTimeout(function(){refreshPrices()},2000);return function(){clearTimeout(t)}},[loaded]);
  // Auto-notify: check earnings for companies whose date has passed
  useEffect(function(){if(!loaded||!autoNotify)return;
    var interval=setInterval(function(){
      cos.forEach(function(c){if(c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)<=0&&dU(c.earningsDate)>=-3){
        if(!c.lastChecked||new Date()-new Date(c.lastChecked)>3600000){checkOne(c.id)}}})
    },60000);// check every 60s
    // Also run once immediately
    cos.forEach(function(c){if(c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)<=0&&dU(c.earningsDate)>=-3){
      if(!c.lastChecked||new Date()-new Date(c.lastChecked)>3600000){checkOne(c.id)}}});
    return function(){clearInterval(interval)}},[loaded,autoNotify]);
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
      if(r.found&&r.results){setCos(function(prev){return prev.map(function(c){if(c.id!==cid)return c;
        var earningsHistory=c.earningsHistory||[];
        var newEntry={quarter:r.quarter||"Latest",summary:stripCite(r.summary||""),results:(r.results||[]).map(function(x){return{kpi_name:x.kpi_name,actual_value:x.actual_value,status:x.status,excerpt:stripCite(x.excerpt||"")}}),sourceUrl:r.sourceUrl,sourceLabel:stripCite(r.sourceLabel||""),checkedAt:new Date().toISOString()};
        // Don't duplicate same quarter
        var exists=earningsHistory.findIndex(function(h){return h.quarter===newEntry.quarter});
        if(exists>=0){earningsHistory=earningsHistory.slice();earningsHistory[exists]=newEntry}else{earningsHistory=[newEntry].concat(earningsHistory)}
        return Object.assign({},c,{lastChecked:new Date().toISOString(),earningSummary:stripCite(r.summary||c.earningSummary),sourceUrl:r.sourceUrl||c.sourceUrl,sourceLabel:stripCite(r.sourceLabel||c.sourceLabel||""),earningsHistory:earningsHistory.slice(0,20),kpis:c.kpis.map(function(k){var m=r.results.find(function(x){return x.kpi_name===k.name});return m&&m.actual_value!=null?Object.assign({},k,{lastResult:{actual:m.actual_value,status:eS(k.rule,k.value,m.actual_value),excerpt:stripCite(m.excerpt||"")}}):k})})})});
        setCheckSt(function(p){var n=Object.assign({},p);n[cid]="found";return n});
        setNotifs(function(p){return[{id:Date.now(),type:"found",ticker:co.ticker,msg:(r.quarter||"")+" results found",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}
      else{setCheckSt(function(p){var n=Object.assign({},p);n[cid]="not-yet";return n});upd(cid,{lastChecked:new Date().toISOString()})}}
    catch(e){setCheckSt(function(p){var n=Object.assign({},p);n[cid]="error";return n})}
    setTimeout(function(){setCheckSt(function(p){var n=Object.assign({},p);delete n[cid];return n})},6000)}
  async function checkAll(){var pend=cos.filter(function(c){return c.earningsDate!=="TBD"&&dU(c.earningsDate)<=3});for(var i=0;i<pend.length;i++){await checkOne(pend[i].id);await new Promise(function(r){setTimeout(r,800)})}}
  async function refreshPrices(){setPriceLoading(true);
    for(var i=0;i<cos.length;i++){var c=cos[i];try{var r=await fetchPrice(c.ticker);
      if(r&&r.price){upd(c.id,function(prev){var updates={position:Object.assign({},prev.position,{currentPrice:r.price})};
        // Auto-populate dividend from FMP if user hasn't manually set one
        if(r.lastDiv>0&&!prev.divPerShare){updates.divPerShare=r.lastDiv;updates.lastDiv=r.lastDiv}
        return Object.assign({},prev,updates)})}}catch(e){}
      await new Promise(function(res){setTimeout(res,300)})}setPriceLoading(false)}
  function toggleAutoNotify(){var nv=!autoNotify;setAutoNotify(nv);try{localStorage.setItem("ta-autonotify",String(nv))}catch(e){}
    if(nv){setNotifs(function(p){return[{id:Date.now(),type:"system",ticker:"",msg:"Auto-notify enabled \u2014 earnings will be checked automatically",time:new Date().toISOString(),read:false}].concat(p).slice(0,30)})}}

  // ── Modals ─────────────────────────────────────────────────
  function AddModal(){var _f=useState({ticker:"",name:"",sector:"",earningsDate:"",earningsTime:"AMC",domain:"",irUrl:"",thesis:"",status:"portfolio"}),f=_f[0],setF=_f[1];
    var _ls=useState("idle"),ls=_ls[0],setLs=_ls[1];var _lm=useState(""),lm=_lm[0],setLm=_lm[1];var tmr=useRef(null);
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    async function doLookup(t){setLs("loading");setLm("");try{var r=await lookupTicker(t);
      if(r&&r.error){setLs("error");setLm(r.error)}
      else if(r&&r.name){setF(function(p){return Object.assign({},p,{name:p.name||r.name||"",sector:p.sector||r.sector||"",earningsDate:p.earningsDate||r.earningsDate||"",earningsTime:r.earningsTime||p.earningsTime,domain:p.domain||r.domain||"",irUrl:p.irUrl||r.irUrl||"",_price:r.price||0,_lastDiv:r.lastDiv||0,_industry:r.industry||""})});setLs("done");setLm("Auto-filled \u2713")}
      else{setLs("error");setLm("Not found")}}catch(e){setLs("error");setLm("Lookup failed — try manually")}}
    function onTicker(v){set("ticker",v);if(tmr.current)clearTimeout(tmr.current);var t=v.toUpperCase().trim();
      if(t.length>=2&&t.length<=6&&/^[A-Z]+$/.test(t)){setLs("idle");tmr.current=setTimeout(function(){doLookup(t)},1000)}else{setLs("idle");setLm("")}}
    function submit(){if(!f.ticker.trim()||!f.name.trim())return;if(tmr.current)clearTimeout(tmr.current);
      var nc={id:nId(cos),ticker:f.ticker.toUpperCase().trim(),name:f.name.trim(),sector:f.sector.trim(),industry:f._industry||"",domain:f.domain.trim(),irUrl:f.irUrl.trim(),earningsDate:f.earningsDate||"TBD",earningsTime:f.earningsTime,thesisNote:f.thesis.trim(),kpis:[],docs:[],earningsHistory:[],position:{shares:0,avgCost:0,currentPrice:f._price||0},conviction:0,convictionHistory:[],status:f.status||"portfolio",lastDiv:f._lastDiv||0,divPerShare:f._lastDiv||0,divFrequency:"quarterly",exDivDate:"",lastChecked:null,notes:"",earningSummary:null,sourceUrl:null,sourceLabel:null};
      setCos(function(p){return p.concat([nc])});setSelId(nc.id);setModal(null)}
    useEffect(function(){return function(){if(tmr.current)clearTimeout(tmr.current)}},[]);
    return<Modal title="Add Company" onClose={function(){if(tmr.current)clearTimeout(tmr.current);setModal(null)}} K={K}>
      <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"0 16px"}}><div><Inp label="Ticker" value={f.ticker} onChange={onTicker} placeholder="AAPL" K={K} spellCheck={false} autoCorrect="off" autoComplete="off"/>
        {ls!=="idle"&&<div style={{fontSize:11,color:ls==="loading"?K.dim:ls==="done"?K.grn:K.amb,marginTop:-10,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
          {ls==="loading"&&<span style={{display:"inline-block",width:10,height:10,border:"2px solid "+K.bdr2,borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>}{ls==="loading"?"Looking up\u2026":lm}</div>}</div>
        <Inp label="Company Name" value={f.name} onChange={function(v){set("name",v)}} placeholder="Apple Inc." K={K}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}><Inp label="Sector" value={f.sector} onChange={function(v){set("sector",v)}} placeholder="Technology" K={K}/><Inp label="Earnings Date" value={f.earningsDate} onChange={function(v){set("earningsDate",v)}} type="date" K={K}/><Sel label="Timing" value={f.earningsTime} onChange={function(v){set("earningsTime",v)}} options={[{v:"BMO",l:"Before Open"},{v:"AMC",l:"After Close"}]} K={K}/></div>
      <Inp label="Investment Thesis" value={f.thesis} onChange={function(v){set("thesis",v)}} ta placeholder="Why do you own this?" K={K}/>
      <Sel label="Add to" value={f.status} onChange={function(v){set("status",v)}} options={[{v:"portfolio",l:"Portfolio (I own this)"},{v:"watchlist",l:"Watchlist (Researching)"}]} K={K}/>
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
  function PositionModal(){if(!sel)return null;var pos=sel.position||{shares:0,avgCost:0};
    var _f=useState({shares:String(pos.shares||""),avgCost:String(pos.avgCost||""),currentPrice:String(pos.currentPrice||""),divPerShare:String(sel.divPerShare||sel.lastDiv||""),divFrequency:sel.divFrequency||"quarterly",exDivDate:sel.exDivDate||""}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    var mult=f.divFrequency==="monthly"?12:f.divFrequency==="quarterly"?4:f.divFrequency==="semi"?2:1;
    var annDiv=parseFloat(f.divPerShare||0)*mult;
    var yld=f.currentPrice?annDiv/parseFloat(f.currentPrice)*100:0;
    return<Modal title={"Position \u2014 "+sel.ticker} onClose={function(){setModal(null)}} w={480} K={K}>
      <Inp label="Shares Held" value={f.shares} onChange={function(v){set("shares",v)}} type="number" placeholder="0" K={K}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Average Cost per Share" value={f.avgCost} onChange={function(v){set("avgCost",v)}} type="number" placeholder="0.00" K={K}/>
      <Inp label="Current Price" value={f.currentPrice} onChange={function(v){set("currentPrice",v)}} type="number" placeholder="0.00" K={K}/></div>
      {f.shares&&f.avgCost&&f.currentPrice&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:14,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>COST BASIS</div><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>${(parseFloat(f.shares)*parseFloat(f.avgCost)).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>MKT VALUE</div><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>${(parseFloat(f.shares)*parseFloat(f.currentPrice)).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>GAIN/LOSS</div><div style={{fontSize:14,fontWeight:600,color:((parseFloat(f.currentPrice)-parseFloat(f.avgCost))/parseFloat(f.avgCost)*100)>=0?K.grn:K.red,fontFamily:fm}}>{((parseFloat(f.currentPrice)-parseFloat(f.avgCost))/parseFloat(f.avgCost)*100).toFixed(1)}%</div></div></div></div>}
      <div style={{borderTop:"1px solid "+K.bdr,paddingTop:16,marginTop:8,marginBottom:8}}><div style={{fontSize:11,color:K.dim,letterSpacing:2,textTransform:"uppercase",fontFamily:fm,marginBottom:12}}>Dividend</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Dividend per Payment" value={f.divPerShare} onChange={function(v){set("divPerShare",v)}} type="number" placeholder="0.00" K={K}/>
      <Sel label="Frequency" value={f.divFrequency} onChange={function(v){set("divFrequency",v)}} options={[{v:"quarterly",l:"Quarterly"},{v:"monthly",l:"Monthly"},{v:"semi",l:"Semi-Annual"},{v:"annual",l:"Annual"},{v:"none",l:"No Dividend"}]} K={K}/></div>
      <Inp label="Ex-Dividend Date (next)" value={f.exDivDate} onChange={function(v){set("exDivDate",v)}} type="date" K={K}/>
      {parseFloat(f.divPerShare)>0&&f.divFrequency!=="none"&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:8,padding:14,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>ANNUAL DIV</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>${annDiv.toFixed(2)}</div></div>
          <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>YIELD</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>{yld.toFixed(2)}%</div></div>
          {f.shares&&<div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>ANNUAL INCOME</div><div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm}}>${(parseFloat(f.shares)*annDiv).toFixed(0)}</div></div>}</div></div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnP} onClick={function(){upd(selId,{position:{shares:parseFloat(f.shares)||0,avgCost:parseFloat(f.avgCost)||0,currentPrice:parseFloat(f.currentPrice)||0},divPerShare:parseFloat(f.divPerShare)||0,divFrequency:f.divFrequency,exDivDate:f.exDivDate});setModal(null)}}>Save</button></div></Modal>}
  function ConvictionModal(){if(!sel)return null;var _r=useState(sel.conviction||5),r=_r[0],setR=_r[1];var _n2=useState(""),n2=_n2[0],setN2=_n2[1];
    return<Modal title={"Conviction \u2014 "+sel.ticker} onClose={function(){setModal(null)}} w={440} K={K}>
      <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:48,fontWeight:700,color:r>=8?K.grn:r>=5?K.amb:K.red,fontFamily:fm}}>{r}</div><div style={{fontSize:11,color:K.dim}}>out of 10</div></div>
      <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>{[1,2,3,4,5,6,7,8,9,10].map(function(v){return<button key={v} onClick={function(){setR(v)}} style={{width:32,height:32,borderRadius:6,border:"1px solid "+(v===r?K.acc:K.bdr),background:v===r?K.acc+"20":K.bg,color:v===r?K.acc:K.dim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{v}</button>})}</div>
      <Inp label="Note (optional)" value={n2} onChange={setN2} placeholder="Why this rating?" K={K}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:12}}><button style={S.btn} onClick={function(){setModal(null)}}>Cancel</button><button style={S.btnP} onClick={function(){var hist=(sel.convictionHistory||[]).slice();hist.push({date:new Date().toISOString().split("T")[0],rating:r,note:n2.trim()});upd(selId,{conviction:r,convictionHistory:hist.slice(-20)});setModal(null)}}>Save</button></div></Modal>}
  function ManualEarningsModal(){if(!sel)return null;
    var _f=useState({quarter:"",summary:"",sourceUrl:"",sourceLabel:""}),f=_f[0],setF=_f[1];
    var _kr=useState({}),kr=_kr[0],setKr=_kr[1];
    var set=function(k,v){setF(function(p){var n=Object.assign({},p);n[k]=v;return n})};
    function doSave(){if(!f.quarter.trim()||!f.summary.trim())return;
      var results=sel.kpis.map(function(k){var v=kr[k.id];return{kpi_name:k.name,actual_value:v!==undefined&&v!==""?parseFloat(v):null,status:v!==undefined&&v!==""?eS(k.rule,k.value,parseFloat(v)):"unclear",excerpt:"Manual entry"}});
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
    if(c.convictionHistory&&c.convictionHistory.length){html+='<h2>Conviction History</h2><div class="card">';c.convictionHistory.forEach(function(ch){html+='<div style="margin-bottom:6px"><strong>'+ch.date+':</strong> '+ch.rating+'/10'+(ch.note?' \u2014 '+ch.note:'')+'</div>'});html+='</div>'}
    html+='<div style="margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#aaa">ThesisAlpha \u2022 thesisalpha.io</div></body></html>';
    var w=window.open("","_blank");w.document.write(html);w.document.close();w.print()}
  function renderModal(){if(!modal)return null;var map={add:AddModal,edit:EditModal,thesis:ThesisModal,kpi:KpiModal,result:ResultModal,del:DelModal,doc:DocModal,position:PositionModal,conviction:ConvictionModal,manualEarnings:ManualEarningsModal};var C=map[modal.type];return C?<C/>:null}

  // ── Sidebar + TopBar ──────────────────────────────────────
  function Sidebar(){var pCos=cos.filter(function(c){return(c.status||"portfolio")===sideTab});
    return<div style={{width:240,minWidth:240,background:K.side,borderRight:"1px solid "+K.bdr,height:"100vh",position:"sticky",top:0,display:"flex",flexDirection:"column",overflowY:"auto"}}>
    <div style={{padding:"18px 20px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={function(){setSelId(null)}}><TLogo size={22} dark={isDark}/><span style={{fontSize:13,fontWeight:600,color:K.txt,letterSpacing:1.5,fontFamily:fm}}>ThesisAlpha</span></div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:!selId&&page==="dashboard"?K.blue+"10":"transparent",borderLeft:!selId&&page==="dashboard"?"2px solid "+K.blue:"2px solid transparent"}} onClick={function(){setSelId(null);setPage("dashboard")}}><span style={{fontSize:12,color:!selId&&page==="dashboard"?K.blue:K.mid,fontWeight:!selId&&page==="dashboard"?600:400,fontFamily:fm}}>Portfolio Overview</span></div>
    <div style={{padding:"12px 20px",cursor:"pointer",background:page==="hub"?K.acc+"10":"transparent",borderLeft:page==="hub"?"2px solid "+K.acc:"2px solid transparent"}} onClick={function(){setSelId(null);setPage("hub")}}><span style={{fontSize:12,color:page==="hub"?K.acc:K.mid,fontWeight:page==="hub"?600:400,fontFamily:fm}}>{"\uD83D\uDCDA"} Owner's Hub</span></div>
    <div style={{display:"flex",padding:"8px 16px 0",gap:0}}>
      <button onClick={function(){setSideTab("portfolio")}} style={{flex:1,padding:"8px 0",fontSize:10,letterSpacing:2,textTransform:"uppercase",fontWeight:600,cursor:"pointer",background:"none",border:"none",borderBottom:sideTab==="portfolio"?"2px solid "+K.acc:"2px solid transparent",color:sideTab==="portfolio"?K.acc:K.dim,fontFamily:fm}}>Portfolio ({cos.filter(function(c){return(c.status||"portfolio")==="portfolio"}).length})</button>
      <button onClick={function(){setSideTab("watchlist")}} style={{flex:1,padding:"8px 0",fontSize:10,letterSpacing:2,textTransform:"uppercase",fontWeight:600,cursor:"pointer",background:"none",border:"none",borderBottom:sideTab==="watchlist"?"2px solid "+K.amb:"2px solid transparent",color:sideTab==="watchlist"?K.amb:K.dim,fontFamily:fm}}>Watchlist ({cos.filter(function(c){return c.status==="watchlist"}).length})</button></div>
    <div style={{flex:1,overflowY:"auto",paddingTop:4}}>{pCos.map(function(c){var active=selId===c.id,h=gH(c.kpis),d=dU(c.earningsDate);
      return<div key={c.id} style={{padding:"10px 16px 10px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,background:active?K.blue+"10":"transparent",borderLeft:active?"2px solid "+K.blue:"2px solid transparent"}} onClick={function(){setSelId(c.id);setExpKpi(null);setPage("dashboard")}}>
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
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px"}}>
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
              <div style={{fontSize:10,color:K.dim}}>{r.kpi_name}</div>
              <div style={{fontSize:13,fontWeight:600,color:r.status==="met"?K.grn:r.status==="missed"?K.red:K.mid,fontFamily:fm}}>{r.actual_value!=null?r.actual_value:"—"}</div></div>})}</div>}
          {selectedEntry.sourceUrl&&<a href={selectedEntry.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:K.blue,textDecoration:"none"}}>{selectedEntry.sourceLabel||"Source"} &#x2197;</a>}
          <div style={{fontSize:10,color:K.dim,marginTop:4}}>Checked: {fT(selectedEntry.checkedAt)}</div></div>}</div></div>}

  // ── Detail View ───────────────────────────────────────────
  function DetailView(){if(!sel)return null;var c=sel;var h=gH(c.kpis);var cs=checkSt[c.id];var pos=c.position||{};var conv=c.conviction||0;
    return<div style={{padding:"0 32px 60px",maxWidth:900}}>
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"28px 0 16px"}}><CoLogo domain={c.domain} ticker={c.ticker} size={36}/>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker}<span style={{fontWeight:300,color:K.mid,marginLeft:8,fontSize:16}}>{c.name}</span></div>
          <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}><span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.sector}</span><span style={{fontSize:11,color:K.dim}}>{"\u2022"}</span><span style={{fontSize:11,color:dU(c.earningsDate)<=7&&dU(c.earningsDate)>=0?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"Earnings: TBD":"Earnings: "+fD(c.earningsDate)+" "+c.earningsTime}</span>
            <span style={{fontSize:11,color:K.dim}}>{"\u2022"}</span><button onClick={function(){upd(c.id,{status:c.status==="watchlist"?"portfolio":"watchlist"})}} style={{background:(c.status||"portfolio")==="portfolio"?K.grn+"15":K.amb+"15",border:"1px solid "+((c.status||"portfolio")==="portfolio"?K.grn+"40":K.amb+"40"),borderRadius:4,padding:"1px 8px",fontSize:10,color:(c.status||"portfolio")==="portfolio"?K.grn:K.amb,cursor:"pointer",fontFamily:fm,fontWeight:600}}>{(c.status||"portfolio")==="portfolio"?"Portfolio":"Watchlist"}</button></div></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{c.irUrl&&<a href={c.irUrl} target="_blank" rel="noopener noreferrer" style={Object.assign({},S.btn,{display:"inline-flex",alignItems:"center",gap:5,textDecoration:"none",padding:"5px 12px",fontSize:11})}>IR{"\u2197"}</a>}
          <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"edit"})}}>Settings</button>
          <button style={Object.assign({},S.btn,{padding:"5px 12px",fontSize:11})} onClick={function(){exportPDF()}}>PDF</button>
          <button style={Object.assign({},S.btnD,{padding:"5px 12px",fontSize:11})} onClick={function(){setModal({type:"del"})}}>Remove</button></div></div>
      {/* Position + Conviction bar */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px",cursor:"pointer"}} onClick={function(){setModal({type:"position"})}}>
          <div style={S.sec}>Position</div>
          {pos.shares>0?<div style={{display:"flex",gap:16}}>
            <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>SHARES</div><div style={{fontSize:16,fontWeight:600,color:K.txt,fontFamily:fm}}>{pos.shares}</div></div>
            <div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>AVG COST</div><div style={{fontSize:16,fontWeight:600,color:K.txt,fontFamily:fm}}>${pos.avgCost}</div></div>
            {pos.currentPrice>0&&<div><div style={{fontSize:10,color:K.dim,fontFamily:fm}}>RETURN</div><div style={{fontSize:16,fontWeight:600,color:((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?K.grn:K.red,fontFamily:fm}}>{((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)}%</div></div>}
          </div>:<div style={{fontSize:12,color:K.dim}}>Click to add position</div>}</div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px",cursor:"pointer"}} onClick={function(){setModal({type:"conviction"})}}>
          <div style={S.sec}>Conviction</div>
          {conv>0?<div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:28,fontWeight:700,color:conv>=8?K.grn:conv>=5?K.amb:K.red,fontFamily:fm}}>{conv}</div>
            <div style={{flex:1}}><div style={{height:6,borderRadius:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:conv*10+"%",borderRadius:3,background:conv>=8?K.grn:conv>=5?K.amb:K.red}}/></div>
              {c.convictionHistory&&c.convictionHistory.length>1&&<div style={{fontSize:10,color:K.dim,marginTop:4}}>{c.convictionHistory.length} updates</div>}</div>
          </div>:<div style={{fontSize:12,color:K.dim}}>Click to rate conviction</div>}</div></div>
      {c.thesisNote&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px",marginBottom:20}}><div style={S.sec}>Investment Thesis</div><div style={{fontSize:13,color:K.mid,lineHeight:1.6,cursor:"pointer"}} onClick={function(){setModal({type:"thesis"})}}>{c.thesisNote}</div></div>}
      {c.earningSummary&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px",marginBottom:20}}><div style={S.sec}>Latest Earnings</div><div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{c.earningSummary}</div>
        {c.sourceUrl&&<a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:K.blue,textDecoration:"none",marginTop:8}}>{c.sourceLabel||"Source"}{"\u2197"}</a>}
        {c.lastChecked&&<div style={{fontSize:10,color:K.dim,marginTop:6}}>Checked: {fT(c.lastChecked)}</div>}</div>}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button style={Object.assign({},S.btnP,{padding:"7px 16px",fontSize:11})} onClick={function(){setModal({type:"manualEarnings"})}}>Enter Earnings</button>
        <button style={Object.assign({},S.btn,{padding:"7px 16px",fontSize:11,opacity:cs==="checking"?.6:1})} onClick={function(){checkOne(c.id)}} disabled={cs==="checking"}>{cs==="checking"?"Checking\u2026":cs==="found"?"\u2713 Found":cs==="not-yet"?"Not Yet":cs==="error"?"\u2718 Error":"Auto-Check (AI)"}</button></div>
      <EarningsTimeline company={c}/>
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
      {c.convictionHistory&&c.convictionHistory.length>1&&<div style={{marginBottom:28}}>
        <div style={S.sec}>Conviction History</div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:10,padding:"14px 20px"}}>
          <div style={{display:"flex",alignItems:"flex-end",gap:2,height:60,marginBottom:8}}>
            {c.convictionHistory.map(function(ch,i){var pct=ch.rating*10;return<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{fontSize:9,fontWeight:600,color:ch.rating>=8?K.grn:ch.rating>=5?K.amb:K.red,fontFamily:fm}}>{ch.rating}</div>
              <div style={{width:"100%",maxWidth:24,height:pct+"%",minHeight:3,borderRadius:3,background:ch.rating>=8?K.grn:ch.rating>=5?K.amb:K.red}}/></div>})}
          </div>
          <div style={{display:"flex",gap:2}}>
            {c.convictionHistory.map(function(ch,i){return<div key={i} style={{flex:1,textAlign:"center",fontSize:8,color:K.dim,fontFamily:fm}}>{ch.date.substring(5)}</div>})}
          </div>
          {c.convictionHistory.length>0&&<div style={{marginTop:10,fontSize:11,color:K.dim}}>Latest: {c.convictionHistory[c.convictionHistory.length-1].note||"No note"}</div>}
        </div></div>}
      <ThesisVault company={c}/>
      <div style={{padding:"16px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:10}}><div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>{"\u2139\uFE0F"} Powered by <a href="https://site.financialmodelingprep.com" target="_blank" rel="noopener noreferrer" style={{color:K.blue,textDecoration:"none"}}>FMP</a> + Claude AI</div></div>
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
      <div style={{padding:"28px 0 20px"}}><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>{"\uD83D\uDCDA"} Owner's Hub</h1><p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{allDocs.length} documents across {companies.length} companies</p></div>
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
          {filtered.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:10,padding:32,textAlign:"center"}}><div style={{fontSize:13,color:K.dim,marginBottom:8}}>No documents yet</div><div style={{fontSize:12,color:K.dim}}>Add notes in company pages and they'll appear here.</div></div>}
          {filtered.map(function(d){var fo=FOLDERS.find(function(f){return f.id===d.folder});var isActive=hd===d.id;
            return<div key={d.id} style={{background:isActive?K.acc+"08":K.card,border:"1px solid "+(isActive?K.acc+"30":K.bdr),borderRadius:10,padding:"14px 18px",marginBottom:8,cursor:"pointer",transition:"all .15s"}} onClick={function(){setHd(isActive?null:d.id)}}>
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

  function Dashboard(){var filtered=cos.filter(function(c){return(c.status||"portfolio")===sideTab});
    // Sector diversification
    var sectors={};filtered.forEach(function(c){var s=c.sector||"Other";sectors[s]=(sectors[s]||0)+1});
    var sectorList=Object.keys(sectors).sort(function(a,b){return sectors[b]-sectors[a]});
    // Dividend data
    var divCos=filtered.filter(function(c){return(c.divPerShare||c.lastDiv)>0&&c.divFrequency!=="none"});
    var totalAnnualDiv=divCos.reduce(function(sum,c){var pos=c.position||{};var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;return sum+(pos.shares||0)*(c.divPerShare||c.lastDiv||0)*mult},0);
    return<div style={{padding:"0 32px 60px",maxWidth:1100}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"28px 0 20px"}}><div><h1 style={{margin:0,fontSize:26,fontWeight:400,color:K.txt,fontFamily:fh}}>{sideTab==="portfolio"?"Portfolio":"Watchlist"}</h1><p style={{margin:"4px 0 0",fontSize:13,color:K.dim}}>{filtered.length} companies{priceLoading?" \u2022 Updating prices\u2026":""}</p></div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={toggleAutoNotify} style={{display:"flex",alignItems:"center",gap:6,background:autoNotify?K.grn+"15":"transparent",border:"1px solid "+(autoNotify?K.grn+"40":K.bdr),borderRadius:6,padding:"7px 14px",fontSize:11,color:autoNotify?K.grn:K.dim,cursor:"pointer",fontFamily:fm}} title={autoNotify?"Auto-notify ON":"Click to enable auto-notify"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={autoNotify?K.grn:"none"} stroke={autoNotify?K.grn:K.dim} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {autoNotify?"Auto-notify ON":"Notify me when earnings drop"}</button>
        <button style={S.btnChk} onClick={checkAll}>Check All</button><button style={Object.assign({},S.btnP,{padding:"9px 18px",fontSize:12})} onClick={function(){setModal({type:"add"})}}>+ Add</button></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16,marginBottom:28}}>
      {filtered.map(function(c){var h=gH(c.kpis);var d=dU(c.earningsDate);var cs2=checkSt[c.id];var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;var total=c.kpis.filter(function(k){return k.lastResult}).length;var pos=c.position||{};
        return<div key={c.id} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px",cursor:"pointer",transition:"border-color .2s",position:"relative"}} onClick={function(){setSelId(c.id)}} onMouseEnter={function(e){e.currentTarget.style.borderColor=K.bdr2}} onMouseLeave={function(e){e.currentTarget.style.borderColor=K.bdr}}>
          <button onClick={function(e){e.stopPropagation();setCos(function(p){return p.filter(function(x){return x.id!==c.id})})}} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:K.dim,fontSize:14,cursor:"pointer",padding:4,opacity:.4}} title="Remove">{"\u2715"}</button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><CoLogo domain={c.domain} ticker={c.ticker} size={28}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}{pos.currentPrice>0&&<span style={{fontWeight:400,color:K.dim,marginLeft:8,fontSize:12}}>${pos.currentPrice.toFixed(2)}</span>}</div><div style={{fontSize:11,color:K.dim}}>{c.name}</div></div><span style={S.badge(h.c)}>{h.l}</span></div>
          {pos.shares>0&&pos.avgCost>0&&pos.currentPrice>0&&<div style={{display:"flex",gap:12,marginBottom:10,padding:"8px 10px",background:K.bg,borderRadius:6}}>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{pos.shares} shares</span>
            <span style={{fontSize:11,color:((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?K.grn:K.red,fontWeight:600,fontFamily:fm}}>{((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?"+":""}{((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)}%</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>${(pos.shares*pos.currentPrice).toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:"1px solid "+K.bdr}}><div style={{fontSize:11,color:d>=0&&d<=7?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"TBD":(d<=0?"Reported":d+"d \u2014 "+fD(c.earningsDate))}</div><div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{total>0?met+"/"+total+" met":c.kpis.length+" KPIs"}{cs2==="checking"?" \u23F3":""}</div></div></div>})}</div>
    {sideTab==="portfolio"&&filtered.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:28}}>
      {/* Sector Diversification */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
        <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:K.dim,marginBottom:14,fontFamily:fm}}>Sector Diversification</div>
        {sectorList.map(function(s){var pct=Math.round(sectors[s]/filtered.length*100);
          return<div key={s} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:K.mid}}>{s}</span><span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{sectors[s]} ({pct}%)</span></div>
            <div style={{height:4,borderRadius:2,background:K.bdr}}><div style={{height:"100%",width:pct+"%",borderRadius:2,background:K.acc}}/></div></div>})}</div>
      {/* Dividends */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:12,padding:"20px 24px"}}>
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
      </div></div>}
    </div>}
  return(<div style={{display:"flex",height:"100vh",background:K.bg,color:K.txt,fontFamily:fb,overflow:"hidden"}}>{renderModal()}<Sidebar/><div style={{flex:1,overflowY:"auto"}}><TopBar/>{page==="hub"?<OwnersHub/>:sel?<DetailView/>:<Dashboard/>}</div></div>)}

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
