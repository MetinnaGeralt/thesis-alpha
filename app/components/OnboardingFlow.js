"use client";
import React, { useState, useRef, useEffect } from "react";

export default function OnboardingFlow(p){
  var {K,S,fm,fb,fh,isDark,isMobile,cSym,nId,cos,setCos,selId,setSelId,obStep,setObStep,obPath,setObPath,oUsername,setOUsername,oTicker,setOTicker,oName,setOName,oSector,setOSector,oLook,setOLook,oDomain,setODomain,oIndustry,setOIndustry,oPrice,setOPrice,oStyle,setOStyle,oTCore,setOTCore,oTMoat,setOTMoat,oTRisk,setOTRisk,oTSell,setOTSell,oKpiSel,setOKpiSel,oKpiTargets,setOKpiTargets,oCoId,setOCoId,oShares,setOShares,oAvgCost,setOAvgCost,oPurchDate,setOPurchDate,oTmrRef,upd,lookupTicker,finishOnboarding,setDetailTab,setGuidedSetup,setTourStep,INVEST_STYLES,STYLE_MAP,METRIC_MAP,SAMPLE,IC,TLogo,_isBm}=p;
  var overlay={position:"fixed",inset:0,background:isDark?"rgba(10,10,15,.97)":"rgba(245,245,250,.97)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"};
  var card={position:"relative",background:K.card,borderRadius:_isBm?0:16,padding:"32px 36px",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,.35)"};

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
    setCos(function(p){return p.concat([nc])});setSelId(nc.id);setOCoId(nc.id);setObStep(5)}

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
    setObStep(6)}

  function saveKpisAndFinish(){
    var coId=oCoId;
    if(coId&&oKpiSel.length>0){
      var newKpis=oKpiSel.map(function(kid,i){
        var met=METRIC_MAP[kid];
        var tv=oKpiTargets[kid]||"";
        return{id:i+1,name:met?met.label:kid,target:"≥"+tv+(met?met.unit||"":""),rule:"gte",value:parseFloat(tv)||0,unit:met?met.unit||"":"",period:"Next Q",notes:"",lastResult:null}});
      upd(coId,function(c){return Object.assign({},c,{kpis:newKpis})})}
    // Apply investor profile if selected during onboarding
    if(oStyle&&oStyle.startsWith("profile_")){var pid=oStyle.replace("profile_","");try{localStorage.setItem("ta-investor-profile",pid)}catch(e){}}
    setObStep(7)}

  // ── Step dots ─────────────────────────────────────────────
  function stepDots(){return<div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:24}}>
    {[1,2,3,4,5,6,7].map(function(s){return<div key={s} style={{width:s===obStep?20:6,height:6,borderRadius:_isBm?0:3,background:s===obStep?K.acc:s<obStep?K.acc+"60":K.bdr,transition:"all .3s"}}/>})}</div>}

  // ─────────────────────────────────────────────────────────
  // STEP 1 — Identity welcome
  // ─────────────────────────────────────────────────────────
  if(obStep===1)return<div style={overlay}><div style={Object.assign({},card,{maxWidth:500,padding:"36px 40px"})}>
    {stepDots()}
    <div style={{textAlign:"center",marginBottom:24}}>
      <TLogo size={36} dark={isDark}/>
      <div style={{marginTop:20,marginBottom:12}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:K.acc+"12",border:"1px solid "+K.acc+"25",borderRadius:_isBm?0:999,padding:"4px 14px",marginBottom:16}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:K.acc}}/>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:K.acc,fontFamily:fm}}>For investors who think like owners</span>
        </div>
      </div>
      <h1 style={{fontSize:28,fontWeight:900,color:K.txt,fontFamily:fh,margin:"0 0 12px",lineHeight:1.1,letterSpacing:"-0.5px"}}>{"A quieter way to own"}<br/><span style={{color:K.acc}}>{"great businesses."}</span></h1>
      <p style={{fontSize:14,color:K.dim,lineHeight:1.75,margin:"0 0 6px",maxWidth:340,marginLeft:"auto",marginRight:"auto"}}>{"Morning coffee. One company. Forty-five minutes of real thinking. Then close the laptop."}</p>
    </div>
    <div style={{background:isDark?"rgba(255,255,255,0.04)":K.bg,borderRadius:_isBm?0:12,padding:"16px 18px",marginBottom:24,border:"1px solid "+K.bdr}}>
      <div style={{fontSize:10,fontWeight:700,color:K.dim,fontFamily:fm,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>{"In the next 5 minutes you will"}</div>
      {[{path:"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",c:K.acc,t:"Choose your investor identity — Buffett, Munger, Lynch, or your own"},
        {path:"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",c:K.grn,t:"Add one company you own and write why you own it"},
        {path:"M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",c:K.blue,t:"Pick 2 numbers to check at the next earnings report"}
      ].map(function(r,i){return<div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"7px 0",borderBottom:i<2?"1px solid "+K.bdr+"40":"none"}}>
        <div style={{width:26,height:26,borderRadius:_isBm?0:8,background:r.c+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={r.c} strokeWidth="1.8" strokeLinecap="round"><path d={r.path}/></svg>
        </div>
        <span style={{fontSize:12,color:K.mid,lineHeight:1.55,paddingTop:4}}>{r.t}</span>
      </div>})}
    </div>
    <button onClick={function(){setObPath("fresh");setCos([]);setObStep(2)}} style={Object.assign({},S.btnP,{width:"100%",padding:"14px",fontSize:15,marginBottom:10,letterSpacing:"-0.2px"})}>{"Let’s start →"}</button>
    <button onClick={function(){setObPath("demo");setCos(SAMPLE);finishOnboarding();setTimeout(function(){setSelId(SAMPLE[0].id);setDetailTab("dossier")},100)}} style={{display:"block",width:"100%",textAlign:"center",background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",padding:"8px",fontFamily:fb}}>{"Explore with sample data first"}</button>
  </div></div>

  // ─────────────────────────────────────────────────────────
  // STEP 2 — What's your name?
  // ─────────────────────────────────────────────────────────
  if(obStep===2)return<div style={overlay}><div style={card}>
    {stepDots()}
    <div style={{textAlign:"center",marginBottom:24}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
        <div style={{width:40,height:40,borderRadius:_isBm?0:12,background:K.acc+"15",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
      </div>
      <h2 style={{fontSize:22,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 8px"}}>What should we call you?</h2>
      <p style={{fontSize:13,color:K.dim,margin:0,lineHeight:1.6}}>We'll use this to personalise your experience. You can always change it later.</p>
    </div>
    <div style={{marginBottom:24}}>
      <input
        value={oUsername}
        onChange={function(e){setOUsername(e.target.value)}}
        placeholder="Your first name or nickname"
        autoFocus
        style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,color:K.txt,padding:"13px 16px",fontSize:16,fontFamily:fb,outline:"none",boxSizing:"border-box",textAlign:"center"}}
        onKeyDown={function(e){if(e.key==="Enter"&&oUsername.trim()){setObStep(3)}}}
      />
    </div>
    <button onClick={function(){setObStep(3)}} disabled={!oUsername.trim()} style={Object.assign({},S.btnP,{width:"100%",padding:"13px",fontSize:15,opacity:oUsername.trim()?1:0.4})}>
      {oUsername.trim()?"Nice to meet you, "+oUsername.trim()+"! →":"Continue →"}
    </button>
    <button onClick={function(){setObStep(3)}} style={{display:"block",width:"100%",textAlign:"center",background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",padding:"8px",fontFamily:fb,marginTop:4}}>Skip for now</button>
  </div></div>;

  // ─────────────────────────────────────────────────────────
  // STEP 3 — Investor Profile
  // ─────────────────────────────────────────────────────────
  if(obStep===3){
    var profiles=[
      {id:"terry",   name:"Terry Smith",    fund:"Fundsmith",               color:"#22C55E", tagline:"Buy wonderful companies. Never sell.",           icon:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"},
      {id:"sleep",   name:"Nick Sleep",     fund:"Nomad Partnership",        color:"#3B82F6", tagline:"Scale economies shared. The flywheel.",          icon:"M22 12h-4l-3 9L9 3l-3 9H2"},
      {id:"munger",  name:"Charlie Munger", fund:"Berkshire Hathaway",       color:"#F59E0B", tagline:"Invert, always invert. Moat first.",             icon:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"},
      {id:"lynch",   name:"Peter Lynch",    fund:"Magellan Fund",            color:"#8B5CF6", tagline:"Know what you own and know why you own it.",      icon:"M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0"},
      {id:"buffett", name:"Warren Buffett", fund:"Berkshire Hathaway",       color:"#EF4444", tagline:"Price is what you pay. Value is what you get.",  icon:"M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"},
      {id:"akre",    name:"Chuck Akre",     fund:"Akre Capital",               color:"#F97316", tagline:"Three-legged stool. Compound forever.",             icon:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-5.82 3.25L7 14.14 2 9.27l6.91-1.01L12 2"},
    ];
    return<div style={overlay}><div style={Object.assign({},card,{maxWidth:520})}>
      {stepDots()}
      <div style={{textAlign:"center",marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:800,color:K.txt,fontFamily:fh,margin:"0 0 6px",letterSpacing:"-0.3px"}}>Which investor do you think like?</h2>
        <p style={{fontSize:13,color:K.dim,margin:0,lineHeight:1.6}}>ThesisAlpha adapts your dashboard, morning brief, and dossier to match your framework.</p>
      </div>
      <div style={{display:"grid",gap:8,marginBottom:16}}>
        {profiles.map(function(prof){var isSel=oStyle===("profile_"+prof.id);
          return<button key={prof.id} onClick={function(){setOStyle("profile_"+prof.id)}} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:_isBm?0:10,border:"2px solid "+(isSel?prof.color:K.bdr),background:isSel?prof.color+"10":"transparent",cursor:"pointer",textAlign:"left",transition:"all .15s",width:"100%"}}>
            <div style={{width:32,height:32,borderRadius:_isBm?0:8,background:prof.color+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={prof.color} strokeWidth="1.8" strokeLinecap="round"><path d={prof.icon}/></svg>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:K.txt,fontFamily:fm}}>{prof.name} <span style={{fontSize:10,color:K.dim,fontWeight:400}}>· {prof.fund}</span></div>
              <div style={{fontSize:11,color:K.dim,marginTop:1}}>{prof.tagline}</div>
            </div>
            {isSel&&<div style={{width:18,height:18,borderRadius:"50%",background:prof.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
          </button>;
        })}
      </div>
      <div style={{display:"flex",gap:12,justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={function(){setObStep(2)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:13})}>{"← Back"}</button>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={function(){
            if(oStyle&&oStyle.startsWith("profile_")){var pid=oStyle.replace("profile_","");try{localStorage.setItem("ta-investor-profile",pid)}catch(e){}}
            setObStep(4);
          }} style={Object.assign({},S.btnP,{padding:"9px 22px",fontSize:13,opacity:oStyle&&oStyle.startsWith("profile_")?1:0.45})}>{"Next →"}</button>
        </div>
      </div>
      <div style={{textAlign:"center",marginTop:8}}>
        <button onClick={function(){setObStep(4)}} style={{background:"none",border:"none",color:K.dim,fontSize:11,cursor:"pointer",padding:"4px 8px",fontFamily:fb}}>{"Skip — I’ll decide later"}</button>
      </div>
    </div></div>}

  // ─────────────────────────────────────────────────────────
  // STEP 4 — Add first company (no skip)
  // ─────────────────────────────────────────────────────────
  if(obStep===4)return<div style={overlay}><div style={card}>
    {stepDots()}
    <h2 style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 4px",textAlign:"center"}}>{oUsername.trim()?"Hey "+oUsername.trim()+", which company do you own?":"Which company do you own?"}</h2>
    <p style={{fontSize:13,color:K.dim,textAlign:"center",margin:"0 0 24px",lineHeight:1.6}}>Pick one you've already thought about. This becomes your first thesis.</p>
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Ticker symbol</label>
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <input value={oTicker} onChange={function(e){onTickerChange(e.target.value)}} placeholder="AAPL" style={{flex:"0 0 110px",background:K.bg,border:"1px solid "+(oLook==="done"?K.grn:K.bdr),borderRadius:_isBm?0:8,color:K.txt,padding:"10px 14px",fontSize:16,fontFamily:fm,fontWeight:600,outline:"none",textTransform:"uppercase",letterSpacing:1,transition:"border .2s"}} spellCheck={false}/>
        {oLook==="loading"&&<span style={{display:"inline-block",width:14,height:14,border:"2px solid "+K.bdr2,borderTopColor:K.blue,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>}
        {oLook==="done"&&<span style={{fontSize:13,color:K.grn,fontFamily:fm}}>{"✓"} Found — {oName}</span>}
        {oLook==="error"&&<span style={{fontSize:13,color:K.amb}}>Not found — enter name below</span>}
      </div></div>
    {(oLook==="done"||oLook==="error")&&<div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,color:K.dim,marginBottom:6,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Company name</label>
      <input value={oName} onChange={function(e){setOName(e.target.value)}} placeholder="Apple Inc." style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,color:K.txt,padding:"10px 14px",fontSize:14,fontFamily:fb,outline:"none"}}/>
    </div>}
    {(oLook==="done"||oLook==="error")&&oName.trim()&&<div style={{marginBottom:20}}>
      <label style={{display:"block",fontSize:11,color:K.dim,marginBottom:8,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>How do you invest in this?</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {INVEST_STYLES.map(function(st){var isSel=oStyle===st.id;return<button key={st.id} onClick={function(){setOStyle(isSel?"":st.id)}} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 11px",borderRadius:_isBm?0:6,border:"1px solid "+(isSel?st.color+"60":K.bdr),background:isSel?st.color+"15":"transparent",color:isSel?st.color:K.mid,fontSize:11,cursor:"pointer",fontFamily:fm,fontWeight:isSel?600:400,transition:"all .15s"}}>
          <IC name={st.icon} size={10} color={isSel?st.color:K.dim}/>{st.label}</button>})}
      </div>
      {oStyle&&STYLE_MAP[oStyle]&&<div style={{fontSize:11,color:K.dim,marginTop:6,lineHeight:1.5}}>{STYLE_MAP[oStyle].desc}</div>}
    </div>}
    {(oLook==="done"||oName.trim())&&<div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <label style={{fontSize:11,color:K.dim,fontFamily:fm,textTransform:"uppercase",letterSpacing:1}}>Position</label>
        <span style={{fontSize:10,color:K.dim,fontFamily:fm,background:K.bg,padding:"1px 6px",borderRadius:_isBm?0:4,border:"1px solid "+K.bdr}}>optional</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div>
          <label style={{display:"block",fontSize:10,color:K.dim,marginBottom:4,fontFamily:fm}}>Shares owned</label>
          <input value={oShares} onChange={function(e){setOShares(e.target.value)}} placeholder="100" type="number" min="0" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,color:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,outline:"none"}}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:K.dim,marginBottom:4,fontFamily:fm}}>Avg cost {cSym}</label>
          <input value={oAvgCost} onChange={function(e){setOAvgCost(e.target.value)}} placeholder="142.50" type="number" min="0" step="0.01" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,color:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,outline:"none"}}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:10,color:K.dim,marginBottom:4,fontFamily:fm}}>Purchase date</label>
          <input value={oPurchDate} onChange={function(e){setOPurchDate(e.target.value)}} type="date" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,color:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,outline:"none",colorScheme:isDark?"dark":"light"}}/>
        </div>
      </div>
    </div>}
    <div style={{display:"flex",gap:12,justifyContent:"space-between",marginTop:8}}>
      <button onClick={function(){setObStep(1)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:13})}>{"←"} Back</button>
      <button onClick={addOnboardingCompany} style={Object.assign({},S.btnP,{padding:"9px 24px",fontSize:13,opacity:oTicker.trim()&&oName.trim()?1:.35})} disabled={!oTicker.trim()||!oName.trim()}>Add & Write Thesis {"→"}</button>
    </div>
  </div></div>;

  // ─────────────────────────────────────────────────────────
  // STEP 5 — Write thesis inline
  // ─────────────────────────────────────────────────────────
  if(obStep===5){
    var sty3=oStyle&&STYLE_MAP[oStyle]?STYLE_MAP[oStyle]:null;
    var taStyle={width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,color:K.txt,padding:"10px 12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6,minHeight:60};
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
            <div style={{width:8,height:8,borderRadius:_isBm?0:2,background:sec.color,flexShrink:0}}/>
            <label style={{fontSize:11,fontWeight:600,color:sec.color,fontFamily:fm,textTransform:"uppercase",letterSpacing:0.8}}>{sec.label}</label>
          </div>
          <textarea value={sec.val} onChange={function(e){sec.set(e.target.value)}} placeholder={sec.placeholder} style={taStyle}/>
        </div>})}
      </div>
      <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
        <button onClick={function(){setObStep(4)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:13})}>{"←"} Back</button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={function(){setObStep(6)}} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",padding:"9px 10px",fontFamily:fb}}>Skip for now</button>
          <button onClick={saveThesisAndContinue} style={Object.assign({},S.btnP,{padding:"9px 22px",fontSize:13,opacity:hasAny?1:.5})} disabled={!hasAny}>Save & Continue {"→"}</button>
        </div>
      </div>
    </div></div>}

  // ─────────────────────────────────────────────────────────
  // STEP 6 — Pick KPIs
  // ─────────────────────────────────────────────────────────
  if(obStep===6){
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
          return<div key={met.id} style={{borderRadius:_isBm?0:10,border:"2px solid "+(isSel?K.acc:K.bdr),background:isSel?K.acc+"08":K.bg,padding:"12px 14px",cursor:"pointer",transition:"all .15s"}} onClick={function(){setOKpiSel(function(p){return p.indexOf(met.id)>=0?p.filter(function(x){return x!==met.id}):p.concat([met.id])})}}>
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
              <input value={tv} onChange={function(e){var v=e.target.value;setOKpiTargets(function(p){var n=Object.assign({},p);n[met.id]=v;return n})}} placeholder="e.g. 15" style={{width:80,background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:K.txt,padding:"5px 8px",fontSize:13,fontFamily:fm,outline:"none"}}/>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{met.unit||""}</span>
            </div>}
          </div>})}
      </div>
      <div style={{background:K.acc+"0a",border:"1px solid "+K.acc+"25",borderRadius:_isBm?0:8,padding:"10px 14px",marginBottom:20,fontSize:12,color:K.mid,lineHeight:1.6}}>
        <strong style={{color:K.acc}}>{"💡"} Tip:</strong> Don{"'"}t overthink the target. A rough number beats no number. You can refine after the first earnings check.
      </div>
      <div style={{display:"flex",gap:12,justifyContent:"space-between"}}>
        <button onClick={function(){setObStep(5)}} style={Object.assign({},S.btn,{padding:"9px 16px",fontSize:13})}>{"←"} Back</button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveKpisAndFinish} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",padding:"9px 10px",fontFamily:fb}}>Skip</button>
          <button onClick={saveKpisAndFinish} style={Object.assign({},S.btnP,{padding:"9px 22px",fontSize:13,opacity:oKpiSel.length>0?1:.45})} disabled={oKpiSel.length===0}>Add {oKpiSel.length>0?oKpiSel.length+" KPI"+(oKpiSel.length>1?"s":""):"KPIs"} & Finish {"→"}</button>
        </div>
      </div>
    </div></div>}

  // ─────────────────────────────────────────────────────────
  // STEP 7 — Done
  // ─────────────────────────────────────────────────────────
  if(obStep===7){
    var co5=cos.find(function(c){return c.id===oCoId})||cos[cos.length-1];
    var kpiCount5=co5?co5.kpis.length:oKpiSel.length;
    var hasThesis5=co5&&co5.thesisNote&&co5.thesisNote.trim().length>10;
    var pts=0;if(hasThesis5)pts+=15;if(kpiCount5>0)pts+=10;
    return<div style={overlay}><div style={card}>
      {stepDots()}
      <div style={{textAlign:"center",marginBottom:22}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
          <div style={{width:52,height:52,borderRadius:_isBm?0:16,background:K.grn+"15",border:"1px solid "+K.grn+"30",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={K.grn} strokeWidth="1.8" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <h2 style={{fontSize:22,fontWeight:800,color:K.txt,fontFamily:fh,margin:"0 0 6px",letterSpacing:"-0.3px"}}>{"You’re set up."}</h2>
        <p style={{fontSize:13,color:K.dim,margin:0,lineHeight:1.65}}>{"Most investors never write down why they own something. You just did."}</p>
      </div>
      <div style={{display:"grid",gap:8,marginBottom:20}}>
        {[{label:"Company added",done:!!co5,icon:"✓"},
          {label:"Thesis written",done:hasThesis5,icon:"✓"},
          {label:kpiCount5+" KPI"+(kpiCount5!==1?"s":"")+" to track at earnings",done:kpiCount5>0,icon:"✓"}
        ].map(function(row){return<div key={row.label} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:_isBm?0:8,background:row.done?K.grn+"08":K.bg,border:"1px solid "+(row.done?K.grn+"25":K.bdr)}}>
          <div style={{width:22,height:22,borderRadius:"50%",background:row.done?K.grn+"20":"transparent",border:"1px solid "+(row.done?K.grn+"40":K.bdr),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,color:K.grn,fontWeight:700}}>{row.done?row.icon:""}</div>
          <span style={{fontSize:13,fontWeight:row.done?600:400,color:row.done?K.txt:K.dim}}>{row.label}</span>
          {row.done&&pts>0&&row.label.indexOf("Company")>=0&&<span style={{marginLeft:"auto",fontSize:11,color:K.acc,fontFamily:fm,fontWeight:600}}>+{pts} pts</span>}
        </div>})}
      </div>
      <div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 16px",marginBottom:20,fontSize:12,color:K.mid,lineHeight:1.7}}>
        <strong style={{color:K.txt,display:"block",marginBottom:4}}>What happens next</strong>
        ThesisAlpha will remind you before the next earnings report. When results drop, open the app and run a 1-click earnings check — your KPIs vs real numbers, instant verdict.
      </div>
      <button onClick={function(){finishOnboarding();if(co5){setSelId(co5.id);setDetailTab("dossier");setGuidedSetup(co5.id);setTimeout(function(){setTourStep(1)},900)}}} style={Object.assign({},S.btnP,{width:"100%",padding:"14px",fontSize:15,letterSpacing:"-0.2px"})}>{"Open my portfolio →"}</button>
    </div></div>}

  return null}