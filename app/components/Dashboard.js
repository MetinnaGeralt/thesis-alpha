"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { DARK, THEMES, METRIC_MAP, INVEST_STYLES, STYLE_MAP, INVESTOR_PROFILES, PROFILE_MAP, SUPERINVESTORS, MSTAR_RATINGS, FOLDERS, KNOWN_MONTHLY } from "./constants";
var NEWS_CATS = [{id:"earnings",label:"Earnings"},{id:"analyst",label:"Analyst"},{id:"macro",label:"Macro"},{id:"company",label:"Company"},{id:"sector",label:"Sector"}];
import {calcMastery, calcOwnerScore, classifyPortfolio, dU, fD, fT, nId, gH, bT, eS, autoFormat, buildPrompt, calcAlignmentSignals, calcMorningSignals} from "./utils";

export default function Dashboard({
  cos,
  setCos,
  selId,
  setSelId,
  page,
  setPage,
  subPage,
  modal,
  setModal,
  setDetailTab,
  setHubTab,
  K,
  S,
  fm,
  fh,
  fb,
  theme,
  isDark,
  isMobile,
  _isBm,
  _isThesis,
  isThesis,
  IC,
  CoLogo,
  streakData,
  setStreakData,
  milestones,
  setMilestones,
  investorProfile,
  username,
  dashSet,
  setDashSet,
  weeklyReviews,
  readingList,
  saveRL,
  assets,
  library,
  briefNews,
  setBriefNews,
  mrMarket,
  setMrMarket,
  mrMarketLoading,
  setMrMarketLoading,
  notifs,
  setNotifs,
  upd,
  fetchEarnings,
  isPro,
  requirePro,
  setShowUpgrade,
  setUpgradeCtx,
  showToast,
  celebrate,
  autoNotify,
  toggleAutoNotify,
  emailNotify,
  cSym,
  sideTab,
  setQLetters,
  setSellCheckTgt,
  setAiModal,
  OWNER_EMAIL,
  user,
  plan,
  setObStep,
  setTrial,
  setReadingList,
  setWeeklyReviews,
  briefNewsLoading,
  briefNewsPrefs,
  saveBriefNewsPrefs,
  loadBriefNews,
  parseThesis,
  getWeekId,
  toggleEmailNotify,
  exportCSV,
}) {
  // ── Array prop guards ──
  briefNews = briefNews || [];
  cos = cos || [];
  readingList = readingList || [];
  weeklyReviews = weeklyReviews || [];
  dashSet = dashSet || {};
  streakData = streakData || {};
  milestones = milestones || {};
  mrMarket = mrMarket || {};
  library = library || {};
  library.items = library.items || [];
  library.folders = library.folders || [];
  briefNews = briefNews || [];
  cos = cos || [];
  weeklyReviews = weeklyReviews || [];
  readingList = readingList || [];
  notifs = notifs || [];

  var currentWeekReviewed = weeklyReviews && weeklyReviews.length > 0 && weeklyReviews[0].weekId === getWeekId();
  var bm = theme === "bloomberg";
  var _pr=React.useState(false),priceLoading=_pr[0],setPriceLoading=_pr[1];
  var _slc=React.useState(false),showListCfg=_slc[0],setShowListCfg=_slc[1];
  var _xpf=React.useState(null),xpFloat=_xpf[0],setXpFloat=_xpf[1];
  var checkSt={};
var filtered=cos.filter(function(c){return(c.status||"portfolio")===sideTab});
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
          <button onClick={function(){if(requirePro("earnings"))toggleAutoNotify()}} style={{display:"flex",alignItems:"center",gap:6,background:autoNotify?K.grn+"15":"transparent",border:"1px solid "+(autoNotify?K.grn+"40":K.bdr),borderRadius:_isBm?0:6,padding:"7px 14px",fontSize:12,color:autoNotify?K.grn:K.dim,cursor:"pointer",fontFamily:fm}} title={autoNotify?"Auto-check ON":"Click to enable"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={autoNotify?K.grn:"none"} stroke={autoNotify?K.grn:K.dim} strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {autoNotify?"Auto-check ON":"Auto-check"}</button>
          {autoNotify&&<button onClick={toggleEmailNotify} style={{display:"flex",alignItems:"center",gap:5,background:emailNotify?K.blue+"15":"transparent",border:"1px solid "+(emailNotify?K.blue+"40":K.bdr),borderRadius:_isBm?0:6,padding:"7px 12px",fontSize:12,color:emailNotify?K.blue:K.dim,cursor:"pointer",fontFamily:fm}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={emailNotify?K.blue:K.dim} strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
            {emailNotify?"KPI Email ON":"+ KPI Email"}</button>}
          <button onClick={function(){setDashSet(function(p){var n=Object.assign({},p,{businessMode:!p.businessMode});try{localStorage.setItem("ta-dashsettings",JSON.stringify(n))}catch(e){}return n})}} style={{display:"flex",alignItems:"center",gap:6,background:dashSet.businessMode?K.grn+"15":"transparent",border:"1px solid "+(dashSet.businessMode?K.grn+"40":K.bdr),borderRadius:_isBm?0:6,padding:"7px 12px",fontSize:12,color:dashSet.businessMode?K.grn:K.dim,cursor:"pointer",fontFamily:fm}} title="Owner Mode: hides price noise, shows conviction + thesis health">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            Owner mode</button>
          <button style={S.btnChk} onClick={function(){if(requirePro("earnings"))checkAll()}}>Check All</button>
          <button style={Object.assign({},S.btn,{padding:"9px 14px",fontSize:12})} onClick={function(){exportCSV(filtered)}}>CSV</button>
          <button style={Object.assign({},S.btnP,{padding:"9px 18px",fontSize:13})} onClick={function(){setModal({type:"add"})}}>+ Add</button></div>}
        {isMobile&&<button style={Object.assign({},S.btnP,{padding:"10px 22px",fontSize:14})} onClick={function(){setModal({type:"add"})}}>+ Add</button>}</div>
      {isMobile&&<div style={{display:"flex",gap:8,marginTop:4}}>
        <button onClick={function(){if(requirePro("earnings"))checkAll()}} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:K.acc+"15",border:"1px solid "+K.acc+"40",borderRadius:_isBm?0:10,padding:"10px",fontSize:14,color:K.acc,cursor:"pointer",fontFamily:fm,fontWeight:600}}>Check All</button>
        <button onClick={function(){if(requirePro("earnings"))toggleAutoNotify()}} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:autoNotify?K.grn+"15":"transparent",border:"1px solid "+(autoNotify?K.grn+"40":K.bdr),borderRadius:_isBm?0:10,padding:"10px",fontSize:14,color:autoNotify?K.grn:K.dim,cursor:"pointer",fontFamily:fm,fontWeight:600}}>
          {autoNotify?"Auto ON":"Auto-check"}</button></div>}</div>
        {/* ── Investor Profile banner ── */}
        {!isMobile&&sideTab==="portfolio"&&investorProfile&&investorProfile!=="custom"&&PROFILE_MAP[investorProfile]&&(function(){
          var prof=PROFILE_MAP[investorProfile];
          return<div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:prof.color+"08",border:"1px solid "+prof.color+"20",borderRadius:_isBm?0:8,marginTop:8,marginBottom:0,cursor:"pointer"}}
            onClick={function(){setModal({type:"settings"})}}>
            <IC name={prof.icon} size={12} color={prof.color}/>
            <span style={{fontSize:11,color:prof.color,fontWeight:700,fontFamily:fm}}>{prof.name} lens</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm,flex:1}}>{prof.tagline}</span>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>Change →</span>
          </div>;
        })()}
        {!isMobile&&sideTab==="portfolio"&&<div style={{display:"flex",gap:8,marginTop:16,marginBottom:4,flexWrap:"wrap"}}>
          {[
            {label:"Earnings Calendar",icon:"calendar",page:"calendar",color:K.amb,desc:(function(){var n=filtered.filter(function(c){return c.earningsDate&&c.earningsDate!=="TBD"&&dU(c.earningsDate)>=0&&dU(c.earningsDate)<=30}).length;return n>0?n+" upcoming":"No upcoming"})()},
            {label:"Dividends",icon:"dollar",page:"dividends",color:K.grn,desc:totalAnnualDiv>0?"$"+Math.round(totalAnnualDiv/12)+"/mo":"No income"},
            {label:"Analytics",icon:"bar",page:"analytics",color:K.blue,desc:"Portfolio breakdown"},
            {label:"Timeline",icon:"trending",page:"timeline",color:K.acc,desc:"Decision history"},
            {label:"All Assets",icon:"castle",page:"assets",color:"#9333EA",desc:"Net worth view"},
          ].map(function(item){
            return<button key={item.page} onClick={function(){setPage(item.page)}} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,cursor:"pointer",transition:"all .15s",flexShrink:0}}
              onMouseEnter={function(e){e.currentTarget.style.background=item.color+"10";e.currentTarget.style.borderColor=item.color+"40"}}
              onMouseLeave={function(e){e.currentTarget.style.background=K.card;e.currentTarget.style.borderColor=K.bdr}}>
              <IC name={item.icon} size={14} color={item.color}/>
              <div style={{textAlign:"left"}}>
                <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,lineHeight:1.2}}>{item.label}</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:1}}>{item.desc}</div>
              </div>
            </button>;
          })}
        </div>}
        {xpFloat&&<div key={xpFloat.id} style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:9999,pointerEvents:"none",animation:"xpfloat 1.8s ease-out forwards"}}>
      <div style={{fontSize:28,fontWeight:800,color:K.grn,fontFamily:fm,textShadow:"0 2px 8px rgba(0,0,0,0.3)",display:"flex",alignItems:"center",gap:6}}>+{xpFloat.amount}
        <span style={{fontSize:13,fontWeight:400,color:K.mid}}>{xpFloat.label}</span></div></div>}
    <style dangerouslySetInnerHTML={{__html:"@keyframes xpfloat{0%{opacity:1;transform:translate(-50%,-50%) scale(0.8)}20%{opacity:1;transform:translate(-50%,-60%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-120%) scale(0.9)}} .ta-month-col .ta-month-tooltip{opacity:0;transition:opacity .15s} .ta-month-col:hover .ta-month-tooltip{opacity:1}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes spin{to{transform:rotate(360deg)}} .ta-bm *{border-radius:0!important}.ta-bm input,.ta-bm textarea,.ta-bm select{border-radius:0!important;font-family:Consolas,Monaco,monospace!important}.ta-bm *{box-shadow:none!important}.ta-bm *{transition:none!important}.ta-bm{line-height:1.25;letter-spacing:0;font-size:12px}.ta-bm div,.ta-bm button,.ta-bm input,.ta-bm textarea,.ta-bm select,.ta-bm span,.ta-bm a,.ta-bm li{border-radius:0!important}.ta-bm img{border-radius:0!important}.ta-bm ::-webkit-scrollbar{width:4px;height:4px}.ta-bm ::-webkit-scrollbar-track{background:#000}.ta-bm ::-webkit-scrollbar-thumb{background:#F39F4170}.ta-bm ::-webkit-scrollbar-thumb:hover{background:#F39F41}@keyframes bm-blink{0%,49%{border-color:#F39F41}50%,100%{border-color:#333}}.ta-bm input:focus,.ta-bm textarea:focus{animation:bm-blink 1s step-end infinite;outline:none!important}.ta-bm button:hover{background:rgba(243,159,65,0.12)!important;color:#F39F41!important}.ta-forest{}.ta-forest .ta-active-item{box-shadow:0 2px 12px rgba(88,204,2,0.2)}.ta-forest button:active{transform:scale(0.96)!important;transition:transform .08s}.ta-forest ::-webkit-scrollbar{width:6px;height:6px}.ta-forest ::-webkit-scrollbar-track{background:#f7f7f5}.ta-forest ::-webkit-scrollbar-thumb{background:#58cc0260;border-radius:999px}.ta-forest ::-webkit-scrollbar-thumb:hover{background:#58cc02}.ta-purple{}.ta-purple ::-webkit-scrollbar{width:5px;height:5px}.ta-purple ::-webkit-scrollbar-track{background:#0d0b14}.ta-purple ::-webkit-scrollbar-thumb{background:#302a48;border-radius:999px}.ta-purple ::-webkit-scrollbar-thumb:hover{background:#a78bfa}.ta-purple input:focus,.ta-purple textarea:focus,.ta-purple select:focus{border-color:#a78bfa!important;box-shadow:0 0 0 3px rgba(167,139,250,0.15)!important;outline:none!important}.ta-purple button:active{opacity:0.85}.ta-ocean{}.ta-ocean ::-webkit-scrollbar{width:5px;height:5px}.ta-ocean ::-webkit-scrollbar-track{background:#f0f4f8}.ta-ocean ::-webkit-scrollbar-thumb{background:#cdd9e8;border-radius:4px}.ta-ocean ::-webkit-scrollbar-thumb:hover{background:#1a56db}.ta-ocean input:focus,.ta-ocean textarea:focus{border-color:#1a56db!important;box-shadow:0 0 0 3px rgba(26,86,219,0.12)!important;outline:none!important}"}}/>
    {/* ── READING & LIBRARY WIDGET ── */}
    {sideTab==="portfolio"&&!isMobile&&(function(){
      var rl=readingList||[];
      var libItems=(library&&library.items)||[];
      var currentlyReading=rl.filter(function(r){return r.status==="reading"});
      var wantToRead=rl.filter(function(r){return r.status==="want"||!r.status});
      var recentlyRead=rl.filter(function(r){return r.status==="read"}).slice(-3).reverse();
      // Library items linked to portfolio companies
      var linkedItems=libItems.filter(function(it){return it.ticker&&filtered.some(function(c){return c.ticker===it.ticker})}).slice(0,3);
      var isEmpty=rl.length===0&&libItems.length===0;
      return<div style={{marginBottom:20,marginTop:8,paddingTop:20,borderTop:"1px solid "+K.bdr+"60"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="1.8"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:700}}>Reading & Research</div>
            {investorProfile==="munger"&&<span style={{fontSize:9,color:K.amb,fontFamily:fm,fontStyle:"italic",opacity:.7}}>{"\u201cIn my whole life, I have known no wise people who didn’t read all the time\u201d"}</span>}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={function(){setModal({type:"addReading"})}} style={{fontSize:10,color:K.acc,background:"none",border:"1px solid "+K.acc+"40",borderRadius:_isBm?0:5,padding:"3px 10px",cursor:"pointer",fontFamily:fm}}>+ Add</button>
            <button onClick={function(){setPage("library")}} style={{fontSize:10,color:K.dim,background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:5,padding:"3px 10px",cursor:"pointer",fontFamily:fm}}>Library →</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":currentlyReading.length>0?"2fr 1fr":"1fr 1fr",gap:10}}>
          {/* Left: currently reading or queue */}
          <div style={{background:K.card,border:"1px solid "+(currentlyReading.length>0?K.acc+"30":K.bdr),borderRadius:_isBm?0:12,padding:"14px 16px"}}>
            {currentlyReading.length>0?(function(){
              var book=currentlyReading[0];
              return<div>
                <div style={{fontSize:9,fontWeight:700,color:K.acc,letterSpacing:1.5,textTransform:"uppercase",fontFamily:fm,marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:K.acc,animation:"pulse 2s infinite"}}/>
                  Currently reading
                  {currentlyReading.length>1&&<span style={{fontSize:9,color:K.dim,marginLeft:4}}>{"+"+( currentlyReading.length-1)+" more"}</span>}
                </div>
                <div style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:2,lineHeight:1.3}}>{book.title}</div>
                {book.author&&<div style={{fontSize:11,color:K.dim,marginBottom:book.notes?6:0}}>{book.author}</div>}
                {book.notes&&<div style={{fontSize:11,color:K.mid,fontStyle:"italic",lineHeight:1.5,marginBottom:6}}>{book.notes.substring(0,100)+(book.notes.length>100?"...":"")}</div>}
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                  <button onClick={function(){var updated=(readingList||[]).map(function(r){return r===book?Object.assign({},r,{status:"read"}):r});saveRL(updated)}} style={{fontSize:10,color:K.grn,background:K.grn+"10",border:"1px solid "+K.grn+"30",borderRadius:_isBm?0:5,padding:"3px 10px",cursor:"pointer",fontFamily:fm}}>Mark read</button>
                  {wantToRead.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{wantToRead.length+" in queue"}</span>}
                </div>
              </div>;
            })()
            :wantToRead.length>0?(function(){
              var next=wantToRead[0];
              return<div>
                <div style={{fontSize:9,fontWeight:700,color:K.dim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:fm,marginBottom:8}}>Up next</div>
                <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fh,marginBottom:2}}>{next.title}</div>
                {next.author&&<div style={{fontSize:11,color:K.dim,marginBottom:8}}>{next.author}</div>}
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={function(){var updated=(readingList||[]).map(function(r){return r===next?Object.assign({},r,{status:"reading"}):r});saveRL(updated)}} style={{fontSize:10,color:K.acc,background:K.acc+"10",border:"1px solid "+K.acc+"30",borderRadius:_isBm?0:5,padding:"3px 10px",cursor:"pointer",fontFamily:fm}}>Start reading</button>
                  {wantToRead.length>1&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{(wantToRead.length-1)+" more in queue"}</span>}
                </div>
              </div>;
            })()
            :<div style={{textAlign:"center",padding:"8px 0"}}>
              <div style={{fontSize:13,fontWeight:600,color:K.dim,marginBottom:4}}>{"Reading list is empty"}</div>
              {investorProfile==="munger"
                ?<div style={{fontSize:11,color:K.dim,lineHeight:1.5,marginBottom:10,fontStyle:"italic"}}>{"Go to bed smarter than when you woke up. — Munger"}</div>
                :<div style={{fontSize:11,color:K.dim,marginBottom:10}}>Add books, articles, or research to track your reading.</div>}
              <button onClick={function(){setModal({type:"addReading"})}} style={{fontSize:11,color:K.acc,background:K.acc+"10",border:"1px solid "+K.acc+"30",borderRadius:_isBm?0:6,padding:"5px 14px",cursor:"pointer",fontFamily:fm}}>+ Add first book</button>
            </div>}
          </div>
          {/* Right: recently read + library links */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {/* Recently finished */}
            {recentlyRead.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"12px 16px",flex:1}}>
              <div style={{fontSize:9,fontWeight:700,color:K.dim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:fm,marginBottom:8}}>Recently finished</div>
              {(recentlyRead||[]).map(function(book,i){return<div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,padding:i>0?"5px 0 0":"0",borderTop:i>0?"1px solid "+K.bdr+"30":"none"}}>
                <span style={{fontSize:10,color:K.grn,marginTop:1}}>✓</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:K.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{book.title}</div>
                  {book.notes&&<div style={{fontSize:10,color:K.dim,fontStyle:"italic",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{book.notes.substring(0,60)+(book.notes.length>60?"...":"")}</div>}
                </div>
              </div>})}
            </div>}
            {/* Library items linked to holdings */}
            {linkedItems.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"12px 16px"}}>
              <div style={{fontSize:9,fontWeight:700,color:K.dim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:fm,marginBottom:8}}>Research linked to holdings</div>
              {(linkedItems||[]).map(function(it,i){return<div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:i>0?"5px 0 0":"0",borderTop:i>0?"1px solid "+K.bdr+"30":"none",cursor:"pointer"}} onClick={function(){setSelId(filtered.find(function(c){return c.ticker===it.ticker})&&filtered.find(function(c){return c.ticker===it.ticker}).id);setDetailTab("dossier")}}>
                <span style={{fontSize:9,fontWeight:700,color:K.acc,background:K.acc+"10",padding:"1px 5px",borderRadius:2,fontFamily:fm,flexShrink:0}}>{it.ticker}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:K.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.title}</div>
                  {it.type&&<div style={{fontSize:9,color:K.dim,fontFamily:fm}}>{it.type}</div>}
                </div>
              </div>})}
            </div>}
            {/* Stats if queue is healthy */}
            {recentlyRead.length===0&&linkedItems.length===0&&rl.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"12px 16px",display:"flex",gap:16,justifyContent:"space-around",alignItems:"center"}}>
              {[{label:"Read",val:rl.filter(function(r){return r.status==="read"}).length,color:K.grn},
                {label:"Reading",val:currentlyReading.length,color:K.acc},
                {label:"Queue",val:wantToRead.length,color:K.dim}].map(function(s,i){return<div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:s.color,fontFamily:fm,lineHeight:1}}>{s.val}</div>
                <div style={{fontSize:9,color:K.dim,fontFamily:fm,marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{s.label}</div>
              </div>})}
            </div>}
          </div>
        </div>
      </div>;
    })()}

    {/* ── PROFILE-SPECIFIC WIDGETS ── */}
    {sideTab==="portfolio"&&!isMobile&&investorProfile&&investorProfile!=="munger"&&investorProfile!=="custom"&&(function(){
      var portfolio=filtered;
      // ── TERRY SMITH: The Three Tests ─────────────────────────────
      if(investorProfile==="terry"){
        var terryRows=(portfolio||[]).map(function(c){
          var s=c.financialSnapshot||{};
          var roic=s.roic&&s.roic.numVal!=null?s.roic.numVal:s.roce&&s.roce.numVal!=null?s.roce.numVal:null;
          var gm=s.grossMargin&&s.grossMargin.numVal!=null?s.grossMargin.numVal:null;
          var fcf=s.fcfMargin&&s.fcfMargin.numVal!=null?s.fcfMargin.numVal:s.fcfYield&&s.fcfYield.numVal!=null?s.fcfYield.numVal:null;
          var pe=s.pe?parseFloat(String(s.pe.value||"").replace(/[^0-9.\-]/g,"")):null;
          var rev=s.revGrowth&&s.revGrowth.numVal!=null?s.revGrowth.numVal:null;
          var t1=roic!=null&&gm!=null?(roic>=15&&gm>=40):roic!=null?roic>=15:null;
          var t2=rev!=null&&fcf!=null?(rev>=5&&fcf>0):rev!=null?rev>=5:null;
          var t3=pe!=null?(pe>0&&pe<30):(fcf!=null?fcf>3:null);
          var passed=[t1,t2,t3].filter(function(t){return t===true}).length;
          var judged=[t1,t2,t3].filter(function(t){return t!==null}).length;
          return{c:c,t1:t1,t2:t2,t3:t3,passed:passed,judged:judged};
        });
        var allPass=terryRows.filter(function(r){return r.passed===3}).length;
        var hasData=terryRows.some(function(r){return r.judged>0});
        function dot(t){return t===true?<span style={{color:K.grn,fontSize:14}}>{"✓"}</span>:t===false?<span style={{color:K.red,fontSize:13}}>{"✗"}</span>:<span style={{color:K.bdr,fontSize:11}}>{"—"}</span>}
        return<div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <IC name="shield" size={12} color={K.grn}/>
              <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:700}}>The Three Tests</div>
              <span style={{fontSize:9,color:K.dim,fontFamily:fm,fontStyle:"italic",opacity:.7}}>Fundsmith framework</span>
            </div>
            {hasData&&<div style={{fontSize:10,color:allPass===portfolio.length?K.grn:K.amb,fontFamily:fm,fontWeight:700}}>{allPass+"/"+portfolio.length+" pass all three"}</div>}
          </div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 90px 90px 90px",background:K.bg,borderBottom:"1px solid "+K.bdr,padding:"6px 14px",gap:0}}>
              <div style={{fontSize:9,color:K.dim,fontFamily:fm,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Company</div>
              {["High returns","Can reinvest","Fair price"].map(function(l,i){return<div key={i} style={{fontSize:9,color:K.dim,fontFamily:fm,textAlign:"center",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>{l}</div>})}
            </div>
            {(terryRows||[]).map(function(row){
              var c=row.c;
              return<div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr 90px 90px 90px",padding:"8px 14px",borderBottom:"1px solid "+K.bdr+"40",cursor:"pointer"}}
                onClick={function(){setSelId(c.id);setDetailTab("dossier")}}
                onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06"}}
                onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <CoLogo domain={c.domain} ticker={c.ticker} size={20}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</div>
                    <div style={{fontSize:9,color:K.dim}}>{c.name.substring(0,24)+(c.name.length>24?"...":"")}</div>
                  </div>
                </div>
                <div style={{textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>{dot(row.t1)}</div>
                <div style={{textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>{dot(row.t2)}</div>
                <div style={{textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>{dot(row.t3)}</div>
              </div>;
            })}
            {!hasData&&<div style={{padding:"14px",textAlign:"center",fontSize:12,color:K.dim}}>Refresh fundamentals to populate the three tests.</div>}
            <div style={{padding:"8px 14px",borderTop:"1px solid "+K.bdr+"40",display:"flex",gap:12}}>
              {[{l:"1. High returns on capital",s:"ROIC > 15% + gross margin > 40%"},
                {l:"2. Can reinvest those returns",s:"Rev growth > 5% + positive FCF"},
                {l:"3. Reasonable valuation",s:"P/E < 30 or FCF yield > 3%"}].map(function(item,i){return<div key={i} style={{flex:1}}>
                <div style={{fontSize:9,fontWeight:700,color:K.mid,fontFamily:fm,marginBottom:1}}>{item.l}</div>
                <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>{item.s}</div>
              </div>})}
            </div>
          </div>
        </div>;
      }
      // ── NICK SLEEP: Flywheel Check ────────────────────────────────
      if(investorProfile==="sleep"){
        var totalVal2=portfolio.reduce(function(s,c){var p=c.position||{};return s+(p.shares>0&&p.currentPrice>0?p.shares*p.currentPrice:0)},0);
        var top3W=portfolio.slice().sort(function(a,b){var va=(a.position||{}).shares>0&&(a.position||{}).currentPrice>0?(a.position.shares*a.position.currentPrice):0;var vb=(b.position||{}).shares>0&&(b.position||{}).currentPrice>0?(b.position.shares*b.position.currentPrice):0;return vb-va}).slice(0,3).reduce(function(s,c){var p=c.position||{};return s+(totalVal2>0&&p.shares>0&&p.currentPrice>0?p.shares*p.currentPrice/totalVal2*100:0)},0);
        var avgConv=portfolio.length>0?Math.round(portfolio.reduce(function(s,c){return s+(c.conviction||0)},0)/portfolio.length*10)/10:0;
        var concColor=portfolio.length<=4?K.grn:portfolio.length<=7?K.amb:K.red;
        return<div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",marginBottom:10,gap:7}}>
            <IC name="trending" size={12} color={K.blue}/>
            <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:700}}>Flywheel Check</div>
            <span style={{fontSize:9,color:K.dim,fontFamily:fm,fontStyle:"italic",opacity:.7}}>Nomad framework</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
              <div style={{padding:"7px 14px",background:K.bg,borderBottom:"1px solid "+K.bdr}}>
                <div style={{fontSize:9,fontWeight:700,color:K.dim,fontFamily:fm,textTransform:"uppercase",letterSpacing:.5}}>Scale economies shared — does it get better for customers?</div>
              </div>
              {(portfolio||[]).map(function(c){
                var s=c.financialSnapshot||{};
                var revGr=s.revGrowth&&s.revGrowth.numVal!=null?s.revGrowth.numVal:null;
                var gm=s.grossMargin&&s.grossMargin.numVal!=null?s.grossMargin.numVal:null;
                var sec=parseThesis(c.thesisNote||"");
                var excerpt=c.flywheelNote||(sec.core?sec.core.substring(0,80)+(sec.core.length>80?"...":""):"");
                return<div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid "+K.bdr+"40",cursor:"pointer"}}
                  onClick={function(){setSelId(c.id);setDetailTab("dossier")}}
                  onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06"}}
                  onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
                  <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</div>
                    {excerpt?<div style={{fontSize:10,color:K.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{excerpt}</div>:
                    <div style={{fontSize:10,color:K.dim,fontStyle:"italic"}}>Does this business share scale with customers? Add a flywheel note in the dossier.</div>}
                  </div>
                  <div style={{display:"flex",gap:8,flexShrink:0}}>
                    {revGr!=null&&<div style={{textAlign:"right"}}><div style={{fontSize:11,fontWeight:700,color:revGr>=10?K.grn:revGr>=5?K.amb:K.red,fontFamily:fm}}>{(revGr>=0?"+":"")+revGr.toFixed(0)+"%"}</div><div style={{fontSize:8,color:K.dim}}>Rev gr</div></div>}
                    {gm!=null&&<div style={{textAlign:"right"}}><div style={{fontSize:11,fontWeight:700,color:gm>=50?K.grn:gm>=30?K.amb:K.dim,fontFamily:fm}}>{gm.toFixed(0)+"%"}</div><div style={{fontSize:8,color:K.dim}}>Margin</div></div>}
                  </div>
                </div>;
              })}
              <div style={{padding:"7px 14px",fontSize:9,color:K.dim,fontStyle:"italic",borderTop:"1px solid "+K.bdr+"40"}}>
                {"\u201cDestination companies make more economic sense over time.\u201d \u2014 Nick Sleep"}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[{l:"Concentration",v:portfolio.length+" co.",sub:portfolio.length<=4?"Highly concentrated":portfolio.length<=7?"Moderate":"Too diversified?",col:concColor},
                {l:"Top 3 weight",v:totalVal2>0?top3W.toFixed(0)+"%":"—",sub:"Sleep: top 3 often 60-80%",col:top3W>=60?K.grn:top3W>=40?K.amb:K.dim},
                {l:"Avg conviction",v:avgConv>0?avgConv+"/10":"—",sub:"Own fewer, know more",col:avgConv>=7?K.grn:avgConv>=5?K.amb:K.red}].map(function(item,i){return<div key={i} style={{background:K.card,border:"1px solid "+item.col+"30",borderRadius:_isBm?0:10,padding:"10px 12px",flex:1}}>
                <div style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>{item.l}</div>
                <div style={{fontSize:18,fontWeight:800,color:item.col,fontFamily:fm,lineHeight:1,marginBottom:2}}>{item.v}</div>
                <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>{item.sub}</div>
              </div>})}
            </div>
          </div>
        </div>;
      }
      // ── CHUCK AKRE: Three-Legged Stool ──────────────────────────
      if(investorProfile==="akre"){
        var orange="#F97316";
        // Leg 1: Extraordinary Business — ROE + gross margin + FCF
        // Leg 2: Exceptional Management — conviction history trend + decision quality
        // Leg 3: Reinvestment Opportunity — revenue growth + retained earnings proxy
        var akreRows=(portfolio||[]).map(function(c){
          var s=c.financialSnapshot||{};
          function pv(k2){if(!s[k2])return null;if(s[k2].numVal!=null)return s[k2].numVal;var v2=s[k2].value;return typeof v2==="string"?parseFloat(v2.replace(/[^\d.\-]/g,""))||null:null}
          // Leg 1: Extraordinary Business
          var roe=pv("roe");var gm=pv("grossMargin");var fcf=pv("fcfYield")||pv("fcf");
          var leg1Score=0;var leg1Pts=0;
          if(roe!=null){leg1Pts++;if(roe>=20)leg1Score+=2;else if(roe>=15)leg1Score+=1;}
          if(gm!=null){leg1Pts++;if(gm>=50)leg1Score+=2;else if(gm>=35)leg1Score+=1;}
          if(fcf!=null){leg1Pts++;if(fcf>0)leg1Score+=2;}
          var leg1=leg1Pts>0?Math.round(leg1Score/leg1Pts*50):null;
          // Leg 2: Exceptional Management — conviction consistency + decisions logged
          var convH=c.convictionHistory||[];var recentConv=convH.slice(-4);
          var convStable=recentConv.length>=2&&recentConv.every(function(ch){return ch.rating>=6});
          var decCount=(c.decisions||[]).length;
          var leg2=convH.length===0?null:Math.min(100,convStable?70:40)+(decCount>=3?30:decCount>=1?15:0);
          leg2=leg2!==null?Math.min(100,leg2):null;
          // Leg 3: Reinvestment Opportunity — rev growth + roic
          var revGr=pv("revGrowth");var roic=pv("roic")||pv("roe");
          var leg3Score=0;var leg3Pts=0;
          if(revGr!=null){leg3Pts++;if(revGr>=15)leg3Score+=2;else if(revGr>=8)leg3Score+=1;}
          if(roic!=null){leg3Pts++;if(roic>=20)leg3Score+=2;else if(roic>=12)leg3Score+=1;}
          var leg3=leg3Pts>0?Math.round(leg3Score/leg3Pts*50):null;
          var allLegs=[leg1,leg2,leg3];
          var avgLeg=allLegs.filter(function(l){return l!=null}).length>0?Math.round(allLegs.filter(function(l){return l!=null}).reduce(function(a,b){return a+b},0)/allLegs.filter(function(l){return l!=null}).length):null;
          return{c:c,leg1:leg1,leg2:leg2,leg3:leg3,avg:avgLeg};
        });
        var allStrong=akreRows.filter(function(r){return r.avg!=null&&r.avg>=70}).length;
        return<div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <IC name="star" size={12} color={orange}/>
              <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:700}}>Three-Legged Stool</div>
              <span style={{fontSize:9,color:K.dim,fontFamily:fm,fontStyle:"italic",opacity:.7}}>Akre framework</span>
            </div>
            {akreRows.some(function(r){return r.avg!=null})&&<div style={{fontSize:10,color:allStrong===portfolio.length?orange:K.mid,fontFamily:fm,fontWeight:700}}>{allStrong+"/"+portfolio.length+" all-leg pass"}</div>}
          </div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
            {/* Header row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 64px",background:K.bg,borderBottom:"1px solid "+K.bdr,padding:"6px 14px",gap:0}}>
              <div style={{fontSize:9,color:K.dim,fontFamily:fm,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Company</div>
              {[["Leg 1","Biz quality"],["Leg 2","Management"],["Leg 3","Reinvest"]].map(function(l,i){return<div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:9,color:orange,fontFamily:fm,fontWeight:700,letterSpacing:.5}}>{l[0]}</div>
                <div style={{fontSize:8,color:K.dim,fontFamily:fm}}>{l[1]}</div>
              </div>})}
              <div style={{textAlign:"center",fontSize:9,color:K.dim,fontFamily:fm,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Avg</div>
            </div>
            {/* Rows */}
            {(akreRows||[]).map(function(row){
              var c=row.c;
              function leg(val){
                if(val===null)return<div style={{textAlign:"center",color:K.bdr,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>{"—"}</div>;
                var col=val>=70?K.grn:val>=45?orange:K.red;
                return<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{fontSize:10,fontWeight:700,color:col,fontFamily:fm}}>{val}</div>
                  <div style={{width:36,height:3,background:K.bdr+"50",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:val+"%",background:col,borderRadius:2}}/>
                  </div>
                </div>;
              }
              var avgCol=row.avg!=null?(row.avg>=70?K.grn:row.avg>=45?orange:K.red):K.bdr;
              return<div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 64px",padding:"10px 14px",borderBottom:"1px solid "+K.bdr+"40",cursor:"pointer",alignItems:"center"}}
                onClick={function(){setSelId(c.id);setDetailTab("dossier")}}
                onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06"}}
                onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <CoLogo domain={c.domain} ticker={c.ticker} size={20}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</div>
                    <div style={{fontSize:9,color:K.dim}}>{(c.name||"").substring(0,20)+(c.name&&c.name.length>20?"...":"")}</div>
                  </div>
                </div>
                {leg(row.leg1)}{leg(row.leg2)}{leg(row.leg3)}
                <div style={{textAlign:"center"}}>
                  {row.avg!=null?<div style={{width:32,height:32,borderRadius:"50%",background:avgCol+"18",border:"2px solid "+avgCol,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>
                    <span style={{fontSize:10,fontWeight:800,color:avgCol,fontFamily:fm}}>{row.avg}</span>
                  </div>:<span style={{color:K.bdr}}>{"—"}</span>}
                </div>
              </div>;
            })}
            {/* Legend */}
            <div style={{padding:"10px 14px",borderTop:"1px solid "+K.bdr+"40",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[
                {l:"Leg 1 — Extraordinary Business",s:"ROE >15%, gross margin >35%, positive FCF"},
                {l:"Leg 2 — Exceptional Management",s:"Conviction stability + decision journal"},
                {l:"Leg 3 — Reinvestment Opportunity",s:"Revenue growth >8%, ROIC >12%"}
              ].map(function(item,i){return<div key={i}>
                <div style={{fontSize:9,fontWeight:700,color:orange,fontFamily:fm,marginBottom:1}}>{item.l}</div>
                <div style={{fontSize:8,color:K.dim,fontFamily:fm}}>{item.s}</div>
              </div>})}
            </div>
            <div style={{padding:"7px 14px",borderTop:"1px solid "+K.bdr+"40",fontSize:9,color:K.dim,fontStyle:"italic"}}>
              {"“A business that can reinvest its earnings at high rates of return for a long period of time is an extraordinary compounder.” — Chuck Akre"}
            </div>
          </div>
        </div>;
      }
      // ── PETER LYNCH: Category Classifier ─────────────────────────
      if(investorProfile==="lynch"){
        var LCATS=[{id:"fast_grower",label:"Fast Grower",sym:"F",color:"#22C55E",tip:"20-25%+ annual growth. Sell when growth slows."},
          {id:"stalwart",label:"Stalwart",sym:"S",color:"#3B82F6",tip:"Large, solid, 10-12% growth. Sell at 30-50% gain."},
          {id:"slow_grower",label:"Slow Grower",sym:"SG",color:"#6B7280",tip:"GDP growth. Own for dividends only."},
          {id:"cyclical",label:"Cyclical",sym:"C",color:"#F59E0B",tip:"Buy at high P/E (trough), sell at low P/E (peak)."},
          {id:"turnaround",label:"Turnaround",sym:"T",color:"#EF4444",tip:"Broken but fixable. Define the thesis clearly."},
          {id:"asset_play",label:"Asset Play",sym:"A",color:"#8B5CF6",tip:"Hidden assets not in price. Market will recognise."}];
        var catCounts={};LCATS.forEach(function(cat){catCounts[cat.id]=0});
        portfolio.forEach(function(c){if(c.lynchCategory)catCounts[c.lynchCategory]=(catCounts[c.lynchCategory]||0)+1});
        var unclassified=portfolio.filter(function(c){return!c.lynchCategory}).length;
        var pegVals=[];portfolio.forEach(function(c){var s=c.financialSnapshot||{};var pe=s.pe?parseFloat(String(s.pe.value||"").replace(/[^0-9.\-]/g,"")):null;var eg=s.epsGrowth&&s.epsGrowth.numVal!=null?s.epsGrowth.numVal:s.revGrowth&&s.revGrowth.numVal!=null?s.revGrowth.numVal:null;if(pe&&pe>0&&eg&&eg>0)pegVals.push(pe/eg)});
        var avgPeg=pegVals.length>0?(pegVals.reduce(function(s,v){return s+v},0)/pegVals.length):null;
        return<div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <IC name="search" size={12} color="#8B5CF6"/>
              <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:700}}>Lynch Categories</div>
              <span style={{fontSize:9,color:K.dim,fontFamily:fm,fontStyle:"italic",opacity:.7}}>Know what you own</span>
            </div>
            {avgPeg!=null&&<div style={{fontSize:10,fontFamily:fm,color:avgPeg<1?K.grn:avgPeg<2?K.acc:K.red,fontWeight:700}}>{"Avg PEG: "+avgPeg.toFixed(2)}</div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
              {(portfolio||[]).map(function(c){
                var cat=c.lynchCategory?LCATS.find(function(x){return x.id===c.lynchCategory}):null;
                var s=c.financialSnapshot||{};
                var pe2=s.pe?parseFloat(String(s.pe.value||"").replace(/[^0-9.\-]/g,"")):null;
                var eg2=s.epsGrowth&&s.epsGrowth.numVal!=null?s.epsGrowth.numVal:s.revGrowth&&s.revGrowth.numVal!=null?s.revGrowth.numVal:null;
                var peg2=pe2&&pe2>0&&eg2&&eg2>0?(pe2/eg2):null;
                return<div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:"1px solid "+K.bdr+"40",cursor:"pointer"}}
                  onClick={function(){setSelId(c.id);setDetailTab("dossier")}}
                  onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06"}}
                  onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
                  <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</div>
                    {peg2!=null&&<div style={{fontSize:9,color:peg2<1?K.grn:peg2<2?K.acc:K.red,fontFamily:fm,fontWeight:600}}>{"PEG "+peg2.toFixed(2)}</div>}
                  </div>
                  {cat
                    ?<button onClick={function(e){e.stopPropagation();var v=window.prompt("Lynch category for "+c.ticker+"\n1.Fast Grower 2.Stalwart 3.Slow Grower 4.Cyclical 5.Turnaround 6.Asset Play\nEnter number:",String(LCATS.indexOf(cat)+1));if(!v)return;var i2=parseInt(v)-1;if(i2>=0&&i2<LCATS.length)upd(c.id,{lynchCategory:LCATS[i2].id})}} style={{fontSize:9,fontWeight:700,color:cat.color,background:cat.color+"12",border:"1px solid "+cat.color+"30",borderRadius:_isBm?0:4,padding:"3px 8px",cursor:"pointer",fontFamily:fm,flexShrink:0}}>{cat.sym+" "+cat.label}</button>
                    :<button onClick={function(e){e.stopPropagation();var v=window.prompt("Classify "+c.ticker+":\n1.Fast Grower\n2.Stalwart\n3.Slow Grower\n4.Cyclical\n5.Turnaround\n6.Asset Play\nEnter number:");if(!v)return;var i2=parseInt(v)-1;if(i2>=0&&i2<LCATS.length)upd(c.id,{lynchCategory:LCATS[i2].id})}} style={{fontSize:9,color:K.acc,background:"none",border:"1px dashed "+K.acc+"50",borderRadius:_isBm?0:4,padding:"3px 8px",cursor:"pointer",fontFamily:fm,flexShrink:0}}>Classify</button>}
                </div>;
              })}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 14px"}}>
                <div style={{fontSize:9,fontWeight:700,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Portfolio mix</div>
                {LCATS.filter(function(cat){return catCounts[cat.id]>0}).map(function(cat){return<div key={cat.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:cat.color,flexShrink:0}}/>
                  <span style={{fontSize:11,color:K.mid,flex:1,fontFamily:fm}}>{cat.label}</span>
                  <span style={{fontSize:11,fontWeight:700,color:cat.color,fontFamily:fm}}>{catCounts[cat.id]}</span>
                </div>})}
                {unclassified>0&&<div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:4,fontStyle:"italic"}}>{unclassified+" unclassified"}</div>}
              </div>
              <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 14px",flex:1}}>
                <div style={{fontSize:9,fontWeight:700,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Sell rules by type</div>
                {(LCATS||[]).map(function(cat){return<div key={cat.id} style={{marginBottom:5,display:"flex",alignItems:"flex-start",gap:4}}>
                  <span style={{fontSize:9,fontWeight:700,color:cat.color,fontFamily:fm,flexShrink:0,minWidth:16}}>{cat.sym}</span>
                  <span style={{fontSize:9,color:K.dim,fontFamily:fm,lineHeight:1.4}}>{cat.tip}</span>
                </div>})}
              </div>
            </div>
          </div>
        </div>;
      }
      // ── WARREN BUFFETT: IV Scorecard ──────────────────────────────
      if(investorProfile==="buffett"){
        var ivCos=portfolio.filter(function(c){return c.ivEstimate>0});
        var inZoneN=ivCos.filter(function(c){var cp=(c.position||{}).currentPrice||0;return cp>0&&cp<=c.ivEstimate*(1-(c.mosPct||30)/100)}).length;
        var belowIVN=ivCos.filter(function(c){var cp=(c.position||{}).currentPrice||0;return cp>0&&cp<c.ivEstimate}).length;
        var noIV2=portfolio.filter(function(c){return!c.ivEstimate||c.ivEstimate<=0}).length;
        return<div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <IC name="dollar" size={12} color="#EF4444"/>
              <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:700}}>Intrinsic Value Scorecard</div>
              <span style={{fontSize:9,color:K.dim,fontFamily:fm,fontStyle:"italic",opacity:.7}}>Price is what you pay, value is what you get</span>
            </div>
            {ivCos.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{inZoneN+" in buy zone \u00b7 "+belowIVN+"/"+ivCos.length+" below IV"}</span>}
          </div>
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
            {(portfolio||[]).map(function(c){
              var pos=c.position||{};var cp=pos.currentPrice||0;
              var iv=c.ivEstimate||0;var mos=c.mosPct||30;
              var buyBelow=iv*(1-mos/100);
              var mosNow=iv>0&&cp>0?((iv-cp)/iv*100):null;
              var inZone=iv>0&&cp>0&&cp<=buyBelow;
              var aboveIV=iv>0&&cp>0&&cp>iv;
              var sCol=!iv?K.bdr:inZone?K.grn:aboveIV?K.red:K.amb;
              var sLbl=!iv?"No IV set":inZone?"In buy zone":aboveIV?"Above IV":"Below IV, above buy zone";
              return<div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid "+K.bdr+"40",cursor:"pointer"}}
                onClick={function(){setSelId(c.id);setDetailTab("dossier")}}
                onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06"}}
                onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
                <CoLogo domain={c.domain} ticker={c.ticker} size={24}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</div>
                  <div style={{fontSize:10,color:sCol,fontFamily:fm,fontWeight:600}}>{sLbl}</div>
                </div>
                {iv>0?(function(){
                  return<div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
                    <div style={{textAlign:"right"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm}}>IV est.</div><div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm}}>{cSym+iv.toFixed(0)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm}}>Buy below</div><div style={{fontSize:12,fontWeight:700,color:K.grn,fontFamily:fm}}>{cSym+buyBelow.toFixed(0)}</div></div>
                    {mosNow!=null&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:K.dim,fontFamily:fm}}>MoS</div><div style={{fontSize:12,fontWeight:700,color:sCol,fontFamily:fm}}>{mosNow.toFixed(0)+"%"}</div></div>}
                    {cp>0&&<div style={{width:64}}>
                      <div style={{position:"relative",height:4,background:K.bdr,borderRadius:2,marginBottom:2}}>
                        <div style={{position:"absolute",left:0,top:0,height:"100%",width:Math.min(cp/Math.max(iv*1.5,cp)*100,100)+"%",background:sCol,borderRadius:2,transition:"width .3s"}}/>
                        <div style={{position:"absolute",left:Math.min(iv/Math.max(iv*1.5,cp)*100,100)+"%",top:-3,width:1,height:10,background:K.grn,opacity:.6}}/>
                      </div>
                      <div style={{fontSize:8,color:K.dim,fontFamily:fm,textAlign:"right"}}>{cSym+cp.toFixed(0)}</div>
                    </div>}
                  </div>;
                })()
                :<button onClick={function(e){e.stopPropagation();setSelId(c.id);setModal({type:"position"})}} style={{fontSize:10,color:K.acc,background:"none",border:"1px dashed "+K.acc+"50",borderRadius:_isBm?0:5,padding:"4px 10px",cursor:"pointer",fontFamily:fm,flexShrink:0}}>Set IV \u2192</button>}
              </div>;
            })}
            {noIV2>0&&<div style={{padding:"8px 16px",fontSize:10,color:K.dim,fontStyle:"italic",borderTop:"1px solid "+K.bdr+"40"}}>{noIV2+" holding"+(noIV2>1?"s":"")+" without IV estimate \u2014 open Position to set your intrinsic value."}</div>}
            <div style={{padding:"8px 14px",fontSize:9,color:K.dim,fontStyle:"italic",borderTop:"1px solid "+K.bdr+"40",lineHeight:1.6}}>{"\u201cPrice is what you pay. Value is what you get.\u201d \u2014 Warren Buffett"}</div>
          </div>
        </div>;
      }
      return null;
    })()}

    {/* ── MR MARKET WIDGET ── */}
    {sideTab==="portfolio"&&!isMobile&&(function(){
      function MrMarketFace(props){
        var mood=props.mood;var color=props.color;var tint=props.tint||color;var size=props.size||120;
        var isScared=mood==="extreme_fear"||mood==="fear";
        var isHappy=mood==="greed"||mood==="extreme_greed";
        var isManic=mood==="extreme_greed";
        var isPanic=mood==="extreme_fear";
        var skinMap={extreme_fear:"#FFE4E6",fear:"#FEF3C7",neutral:"#FEF9EC",greed:"#ECFDF5",extreme_greed:"#F5F3FF"};
        var skin=skinMap[mood]||"#FEF9EC";
        var stroke=color;
        var sw="1.8";
        return<svg width={size} height={size*1.3} viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:"visible"}}>

          {/* ── BODY / TUXEDO ── */}
          {/* Coat body */}
          <path d="M25 90 Q22 115 24 126 L76 126 Q78 115 75 90 Q65 98 50 98 Q35 98 25 90Z" fill={tint+"25"} stroke={stroke} strokeWidth={sw}/>
          {/* Lapels */}
          <path d="M44 90 L50 105 L56 90" fill={tint+"40"} stroke={stroke} strokeWidth="1.2"/>
          <path d="M44 90 L38 80" stroke={stroke} strokeWidth="1.2"/>
          <path d="M56 90 L62 80" stroke={stroke} strokeWidth="1.2"/>
          {/* Shirt / bow tie */}
          <path d="M46 90 L50 96 L54 90" fill="white" stroke={stroke} strokeWidth="1"/>
          <ellipse cx="50" cy="88" rx="4" ry="2" fill={tint} opacity="0.8"/>
          {/* Buttons */}
          <circle cx="50" cy="104" r="1.2" fill={stroke} opacity="0.5"/>
          <circle cx="50" cy="112" r="1.2" fill={stroke} opacity="0.5"/>

          {/* ── ARMS ── */}
          {/* Left arm — holds cane */}
          <path d={isPanic
            ?"M25 92 Q12 85 8 75"
            :isHappy
            ?"M25 92 Q14 80 16 68"
            :"M25 92 Q14 88 12 100"}
            stroke={stroke} strokeWidth="5" strokeLinecap="round"/>
          {/* Right arm — raised/dropped */}
          <path d={isHappy
            ?"M75 92 Q86 80 84 68"
            :isPanic
            ?"M75 92 Q88 85 92 75"
            :"M75 92 Q86 88 88 100"}
            stroke={stroke} strokeWidth="5" strokeLinecap="round"/>

          {/* ── CANE (left hand) ── */}
          {!isPanic&&<g>
            <line x1={isHappy?"16":"12"} y1={isHappy?"68":"100"} x2={isHappy?"18":"14"} y2={isHappy?"85":"118"} stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/>
            <path d={isHappy?"M13 68 Q16 64 20 67":"M9 100 Q12 96 16 99"} stroke={stroke} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          </g>}
          {/* Panic: papers flying */}
          {isPanic&&<g opacity="0.65">
            <rect x="82" y="58" width="14" height="18" rx="1.5" fill={tint+"40"} stroke={stroke} strokeWidth="1" transform="rotate(20,89,67)"/>
            <rect x="72" y="50" width="11" height="15" rx="1.5" fill={tint+"30"} stroke={stroke} strokeWidth="1" transform="rotate(-12,77,57)"/>
            <line x1="83" y1="63" x2="92" y2="63" stroke={stroke} strokeWidth="0.8" opacity="0.5"/>
            <line x1="84" y1="67" x2="91" y2="67" stroke={stroke} strokeWidth="0.8" opacity="0.5"/>
          </g>}

          {/* ── ROUND BELLY ── */}
          <ellipse cx="50" cy="108" rx="19" ry="12" fill={tint+"15"} stroke={stroke} strokeWidth="1" opacity="0.6"/>

          {/* ── HEAD ── */}
          <ellipse cx="50" cy="52" rx="20" ry="22" fill={skin} stroke={stroke} strokeWidth={sw}/>

          {/* ── TOP HAT ── */}
          {/* Brim */}
          <path d="M28 34 Q50 36 72 34" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/>
          {/* Hat body */}
          <rect x="33" y="8" width="34" height="26" rx="2" fill={isManic?color+"50":color+"30"} stroke={stroke} strokeWidth={sw}/>
          {/* Hat band */}
          <rect x="33" y="30" width="34" height="5" fill={tint+"60"} stroke={stroke} strokeWidth="1"/>
          {/* Monocle glint if greedy */}
          {isHappy&&<circle cx="63" cy="45" r="5" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.6"/>}

          {/* ── EYES ── */}
          {isManic
            ?<g>
               <circle cx="41" cy="50" r="5" fill="white" stroke={stroke} strokeWidth="1.2"/>
               <circle cx="59" cy="50" r="5" fill="white" stroke={stroke} strokeWidth="1.2"/>
               <circle cx="42" cy="50" r="2.5" fill={stroke}/>
               <circle cx="60" cy="50" r="2.5" fill={stroke}/>
               <path d="M37 44 L46 42" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
               <path d="M54 42 L63 44" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
             </g>
            :isPanic
            ?<g>
               <ellipse cx="41" cy="50" rx="4.5" ry="5.5" fill="white" stroke={stroke} strokeWidth="1.2"/>
               <ellipse cx="59" cy="50" rx="4.5" ry="5.5" fill="white" stroke={stroke} strokeWidth="1.2"/>
               <circle cx="41" cy="51" r="2" fill={stroke}/>
               <circle cx="59" cy="51" r="2" fill={stroke}/>
               <path d="M37 44 Q41 47 45 44" stroke={stroke} strokeWidth="1.5" fill="none"/>
               <path d="M55 44 Q59 47 63 44" stroke={stroke} strokeWidth="1.5" fill="none"/>
             </g>
            :isHappy
            ?<g>
               <path d="M37 50 Q41 45 45 50" stroke={stroke} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
               <path d="M55 50 Q59 45 63 50" stroke={stroke} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
             </g>
            :<g>
               <circle cx="41" cy="50" r="4" fill="white" stroke={stroke} strokeWidth="1.2"/>
               <circle cx="59" cy="50" r="4" fill="white" stroke={stroke} strokeWidth="1.2"/>
               <circle cx="41" cy="50" r="1.8" fill={stroke}/>
               <circle cx="59" cy="50" r="1.8" fill={stroke}/>
             </g>}

          {/* ── BIG MOUSTACHE ── */}
          <path d={isManic
            ?"M34 60 Q42 56 50 60 Q58 56 66 60 Q60 68 50 66 Q40 68 34 60Z"
            :isPanic
            ?"M36 60 Q43 56 50 59 Q57 56 64 60 Q58 65 50 63 Q42 65 36 60Z"
            :"M36 59 Q43 55 50 58 Q57 55 64 59 Q58 65 50 62 Q42 65 36 59Z"}
            fill={tint+"60"} stroke={stroke} strokeWidth="1.2"/>
          {/* Cheeks when happy */}
          {isHappy&&<g>
            <ellipse cx="33" cy="56" rx="6" ry="4" fill={tint} opacity="0.2"/>
            <ellipse cx="67" cy="56" rx="6" ry="4" fill={tint} opacity="0.2"/>
          </g>}

          {/* ── MOUTH ── */}
          {isPanic
            ?<path d="M42 67 Q50 63 58 67" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round"/>
            :isManic
            ?<path d="M40 67 Q50 76 60 67" stroke={stroke} strokeWidth="2" fill={tint+"30"} strokeLinecap="round"/>
            :isHappy
            ?<path d="M42 67 Q50 73 58 67" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round"/>
            :mood==="fear"
            ?<path d="M43 68 Q50 64 57 68" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round"/>
            :<path d="M44 67 Q50 69 56 67" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round"/>}

          {/* ── SWEAT DROPS (fear) ── */}
          {isScared&&<g>
            <ellipse cx={isPanic?27:29} cy={isPanic?55:58} rx="1.5" ry="2.5" fill={stroke} opacity="0.4"/>
            <ellipse cx={isPanic?25:27} cy={isPanic?63:66} rx="1" ry="2" fill={stroke} opacity="0.25"/>
          </g>}

          {/* ── MANIC EFFECTS ── */}
          {isManic&&<g>
            <text x="80" y="30" fontSize="14" fill={tint} fontWeight="bold" opacity="0.8">{"$"}</text>
            <text x="10" y="28" fontSize="12" fill={tint} fontWeight="bold" opacity="0.6">{"$"}</text>
          </g>}
        </svg>;
      }
      return<div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.acc,fontFamily:fm,fontWeight:700}}>Mr. Market</div>
          <span style={{fontSize:9,color:K.dim,fontFamily:fm,fontStyle:"italic",opacity:.6}}>B. Graham, 1949</span>
          {mrMarket&&<button onClick={function(){setMrMarket(null);setMrMarketLoading(true);fetchMrMarketData().then(function(d){setMrMarket(d);setMrMarketLoading(false)})}} style={{marginLeft:"auto",background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:12,padding:0}} title="Refresh">{"↺"}</button>}
        </div>
        <div style={{background:K.card,border:"1px solid "+(mrMarket?mrMarket.color+"30":K.bdr),borderRadius:_isBm?0:16,overflow:"hidden",transition:"border-color .3s"}}>
          {mrMarketLoading&&!mrMarket&&<div style={{padding:"24px 20px",textAlign:"center",color:K.dim,fontSize:11,fontFamily:fm}}>{"Reading the market’s mood…"}</div>}
          {!mrMarketLoading&&!mrMarket&&<div style={{padding:"20px",textAlign:"center"}}>
            <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:8}}>Market sentiment unavailable</div>
            <button onClick={function(){setMrMarketLoading(true);fetchMrMarketData().then(function(d){setMrMarket(d);setMrMarketLoading(false)})}} style={{fontSize:10,color:K.acc,background:"none",border:"1px solid "+K.acc+"50",borderRadius:_isBm?0:5,padding:"4px 12px",cursor:"pointer",fontFamily:fm}}>Check now</button>
          </div>}
          {mrMarket&&(function(){
            var d=mrMarket;
            return<div>
              <div style={{display:"flex",alignItems:"flex-start",background:"linear-gradient(135deg, "+d.color+"08 0%, transparent 60%)"}}>
                <div style={{padding:"16px 4px 8px 16px",flexShrink:0}}>
                  <MrMarketFace mood={d.mood} color={K.acc} tint={d.color} size={90}/>
                </div>
                <div style={{flex:1,padding:"18px 16px 14px 8px"}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:6}}>
                    <div style={{fontSize:32,fontWeight:900,color:d.color,fontFamily:fm,lineHeight:1}}>{d.composite}</div>
                    <div style={{fontSize:11,fontWeight:700,color:d.color,fontFamily:fm}}>{d.label}</div>
                  </div>
                  <div style={{height:5,background:K.bdr,borderRadius:999,marginBottom:10,overflow:"hidden",position:"relative"}}>
                    <div style={{position:"absolute",left:0,top:0,height:"100%",width:d.composite+"%",background:"linear-gradient(90deg, #EF4444 0%, #F97316 20%, #6B7280 45%, #6B7280 55%, #10B981 80%, #8B5CF6 100%)",borderRadius:999}}/>
                    <div style={{position:"absolute",left:"calc("+d.composite+"% - 1px)",top:-2,width:2,height:9,background:d.color,borderRadius:1}}/>
                  </div>
                  <p style={{fontSize:10,color:K.mid,fontFamily:fm,lineHeight:1.5,fontStyle:"italic",marginBottom:10}}>{"“"+d.offer+"”"}</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {(d.details||[]).map(function(det,i){return<div key={i} style={{background:K.acc+"10",border:"1px solid "+K.acc+"20",borderRadius:_isBm?0:6,padding:"2px 8px",fontSize:9,fontFamily:fm}}>
                      <span style={{color:K.dim}}>{det.label+": "}</span>
                      <span style={{fontWeight:700,color:K.acc}}>{det.value}</span>
                    </div>;})}
                  </div>
                </div>
              </div>
              <div style={{padding:"7px 14px",borderTop:"1px solid "+d.color+"15",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:9,color:K.dim,fontFamily:fm,fontStyle:"italic"}}>{"Mr. Market is your servant, not your guide. — Buffett"}</span>
                {d.fetched&&<span style={{fontSize:8,color:K.bdr,fontFamily:fm}}>{new Date(d.fetched).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
              </div>
            </div>;
          })()}
        </div>
      </div>;
    })()}

    {/* \u2500\u2500 MORNING BRIEFING \u2500\u2500 */}
    {sideTab==="portfolio"&&filtered.length>0&&(function(){
      var portfolio=filtered;var now=new Date();var hour=now.getHours();
      var dow=now.getDay();// 0=Sun,6=Sat
      var isWeekend=dow===0||dow===6;
      var isFriday=dow===5;var isMonday=dow===1;
      var daySeed=now.getDate()%4;// rotates 0-3 per calendar day, stable within a day
      var mktOpen=!isWeekend&&hour>=9&&(hour<16||(hour===9&&now.getMinutes()>=30));
      var _n=username||"Investor";
      var greeting=(function(){
        if(hour>=23||hour<5){var late=[["Still here, "+_n+"?","The futures don't sleep"],["Night mode, "+_n,"Markets reopen in the morning"],["Late night, "+_n,"Even Buffett sleeps"],["Can't sleep, "+_n+"?","Check the Asia markets while you're up"]];return late[daySeed][0];}
        if(hour<7){var early=[["Early bird, "+_n,"Markets open at 9:30"],["You're up early, "+_n,"Pre-market starts soon"],["Rise and grind, "+_n,"Bell rings at 9:30"],["Morning, "+_n+" ☕","Let's see what overnight brought"]];return early[daySeed][0];}
        if(hour<9){return isMonday?"New week, "+_n:isFriday?"Friday's here, "+_n:"Good morning, "+_n;}
        if(hour===9&&now.getMinutes()<30){return"Bell rings soon, "+_n;}
        if(mktOpen){var open=[["Markets are live, "+_n],["Eyes on the tape, "+_n],["Market hours, "+_n],["In session, "+_n]];return open[daySeed][0];}
        if(hour<17&&isWeekend){return dow===6?"Saturday, "+_n:"Sunday, "+_n+". Markets are closed.";}
        if(hour<17){return isFriday?"TGIF, "+_n:"Good afternoon, "+_n;}
        if(hour<20){var eve=[["After hours, "+_n],["Closing thoughts, "+_n],["Good evening, "+_n],["Wind down, "+_n]];return eve[daySeed][0];}
        return"Bedtime soon, "+_n;
      })();

      // ── Conviction health ───────────────────────────────────────────────
      var convReviewed=portfolio.filter(function(c2){
        if(!c2.thesisUpdatedAt&&!c2.thesisNote)return false;
        var age=c2.thesisUpdatedAt?Math.ceil((now-new Date(c2.thesisUpdatedAt))/864e5):999;
        return age<=60;
      }).length;
      var convStale=portfolio.filter(function(c2){
        var age=c2.thesisUpdatedAt?Math.ceil((now-new Date(c2.thesisUpdatedAt))/864e5):999;
        return age>90;
      }).length;
      var convTotal=portfolio.length;
      var convHealthPct=convTotal>0?Math.round(convReviewed/convTotal*100):0;
      var convHealthColor=convHealthPct>=70?K.grn:convHealthPct>=40?K.amb:K.red;

      // ── Upcoming earnings ───────────────────────────────────────────────
      var upcoming=portfolio.filter(function(c2){return c2.earningsDate&&c2.earningsDate!=="TBD"&&dU(c2.earningsDate)>=0&&dU(c2.earningsDate)<=7}).sort(function(a,b){return dU(a.earningsDate)-dU(b.earningsDate)});
      var earningsToday=upcoming.filter(function(c2){return dU(c2.earningsDate)===0}).length;

      // ── ONE FOCUS — pick the single most urgent action ──────────────────
      var focus=null;
      // Priority 1: earnings TODAY with KPIs
      var todayEarnings=portfolio.filter(function(c2){return c2.earningsDate&&dU(c2.earningsDate)===0&&c2.kpis.length>0});
      if(todayEarnings.length>0)focus={icon:"target",color:K.red,title:todayEarnings[0].ticker+" reports today",sub:"Check your "+todayEarnings[0].kpis.length+" KPIs before the call",onClick:function(){setSelId(todayEarnings[0].id);setDetailTab("dossier")}};
      // Priority 2: unchecked earnings (released but not reviewed)
      if(!focus){var unchecked=portfolio.filter(function(c2){return c2.earningsDate&&c2.earningsDate!=="TBD"&&dU(c2.earningsDate)<0&&dU(c2.earningsDate)>=-14&&c2.kpis.length>0&&!c2.lastChecked});
        if(unchecked.length>0)focus={icon:"check",color:K.amb,title:"Review "+unchecked[0].ticker+" earnings",sub:unchecked.length+" holding"+(unchecked.length>1?"s have":"has")+" recent earnings with unchecked KPIs",onClick:function(){setSelId(unchecked[0].id);setDetailTab("dossier")}}}
      // Priority 3: stale thesis (>90 days)
      if(!focus){var stale=portfolio.filter(function(c2){return c2.thesisUpdatedAt&&Math.ceil((now-new Date(c2.thesisUpdatedAt))/864e5)>90});
        if(stale.length>0){var stalest=stale.sort(function(a,b){return new Date(a.thesisUpdatedAt)-new Date(b.thesisUpdatedAt)})[0];var daysAgo=Math.ceil((now-new Date(stalest.thesisUpdatedAt))/864e5);
          focus={icon:"clock",color:K.amb,title:"Re-read your "+stalest.ticker+" thesis",sub:"Last updated "+daysAgo+" days ago — do you still believe it?",onClick:function(){setSelId(stalest.id);setDetailTab("dossier")}}}}
      // Priority 4: no thesis written
      if(!focus){var noThesis=portfolio.filter(function(c2){return!c2.thesisNote||c2.thesisNote.trim().length<20});
        if(noThesis.length>0)focus={icon:"lightbulb",color:K.acc,title:"Write a thesis for "+noThesis[0].ticker,sub:"Why do you own it? What would make you sell?",onClick:function(){setSelId(noThesis[0].id);setModal({type:"thesis"})}}}
      // Priority 5: no conviction set
      if(!focus){var noConv=portfolio.filter(function(c2){return!c2.conviction||c2.conviction===0});
        if(noConv.length>0)focus={icon:"dial",color:K.acc,title:"Set your conviction on "+noConv[0].ticker,sub:"Rate 1–10 how strongly you believe in this holding",onClick:function(){setSelId(noConv[0].id);setModal({type:"conviction"})}}}
      // Priority 6: weekly review
      if(!focus&&!currentWeekReviewed)focus={icon:"shield",color:K.grn,title:"Weekly portfolio review"+(streakData.current>0?" — "+streakData.current+"wk streak":""),sub:"Reflect on the week before the market opens",onClick:function(){setPage("review")}};
      // Insider signals
      var insiderSignals=[];portfolio.forEach(function(c2){if(c2._insiderCache){var buys=c2._insiderCache.filter(function(t){return t.transactionType==="P"});if(buys.length>0)insiderSignals.push({ticker:c2.ticker,count:buys.length,id:c2.id})}});

      // ── Holdings (price data — de-emphasised) ──────────────────────────
      var held=portfolio.filter(function(c2){var p2=c2.position||{};return p2.shares>0&&p2.currentPrice>0});

      return<div className="ta-card" style={{background:K.card,border:"1px solid "+(isDark?K.bdr:K.bdr2),borderRadius:_isBm?0:14,marginBottom:20,overflow:"hidden"}}>
        {/* ── Sample portfolio banner ── */}
        {portfolio.some(function(c){return c._isSample})&&<div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",background:K.amb+"0d",borderBottom:"1px solid "+K.amb+"30"}}>
          <IC name="lightbulb" size={14} color={K.amb}/>
          <div style={{flex:1}}>
            <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>You're exploring with example data.</span>
            <span style={{fontSize:12,color:K.dim,fontFamily:fm,marginLeft:6}}>NVDA and CRWD are pre-filled so you can see what a complete dossier looks like.</span>
          </div>
          <button onClick={function(){setCos([]);try{localStorage.removeItem("ta-onboarded")}catch(e){}setObStep(1)}} style={{padding:"5px 12px",borderRadius:_isBm?0:7,border:"1px solid "+K.red+"40",background:K.red+"0d",color:K.red,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm,whiteSpace:"nowrap"}}>Clear &amp; start fresh</button>
                {user===OWNER_EMAIL&&<button onClick={function(){var keys=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.startsWith("ta-")&&k!=="ta-theme"&&k!=="ta-userid")keys.push(k)}keys.forEach(function(k){localStorage.removeItem(k)});setCos([]);setWeeklyReviews([]);setNotifs([]);setReadingList([]);setStreakData({current:0,best:0});setTrial(null);setMilestones({});setQLetters({});try{localStorage.removeItem("ta-onboarded")}catch(e){}setObStep(1);showToast("\u2705 Full reset complete","milestone",3000);}} style={{padding:"5px 12px",borderRadius:_isBm?0:7,border:"1px solid #9333EA40",background:"#9333EA0d",color:"#9333EA",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm,whiteSpace:"nowrap"}}>{String.fromCodePoint(0x1F504)+" Full Reset (Owner)"}</button>}
        </div>}
        {/* ── Header: greeting only, no portfolio value ── */}
        <div style={{padding:isMobile?"12px 16px":"14px 24px",borderBottom:"1px solid "+K.bdr}}>
          <div style={{fontSize:isMobile?13:12,color:K.dim,fontFamily:fm}}>{greeting+" \u00b7 "+now.toLocaleDateString("en-US",{month:"long",day:"numeric"})}</div>
        </div>

        {/* ── ONE FOCUS ── */}
        {focus&&<div style={{padding:isMobile?"12px 16px":"14px 24px",borderBottom:"1px solid "+K.bdr,background:focus.color+"09",border:"1px solid "+focus.color+"25",borderRadius:_isBm?0:12}}>
          <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:focus.color,fontFamily:fm,fontWeight:700,marginBottom:6}}>One company. Right now.</div>
          <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={focus.onClick}>
            <div style={{width:32,height:32,borderRadius:_isBm?0:8,background:focus.color+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <IC name={focus.icon} size={14} color={focus.color}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:800,color:K.txt,marginBottom:2,fontFamily:fh}}>{focus.title}</div>
              <div style={{fontSize:11,color:K.dim,lineHeight:1.4}}>{focus.sub}</div>
            </div>
            <span style={{fontSize:13,color:focus.color,flexShrink:0}}>{"→"}</span>
          </div>
        </div>}

        {/* ── Today's Signals — cross-layer ── */}
        {(function(){
          var sigs=calcMorningSignals(K, portfolio,library);
          // Re-sort by investor profile priority if set
          if(investorProfile&&investorProfile!=="custom"&&PROFILE_MAP[investorProfile]){
            var profPrio=PROFILE_MAP[investorProfile].morningPriority||[];
            if(profPrio.length>0){
              sigs=sigs.slice().sort(function(a,b){
                var ai=profPrio.indexOf(a.layer);var bi=profPrio.indexOf(b.layer);
                if(ai>=0&&bi>=0)return ai-bi;
                if(ai>=0)return-1;if(bi>=0)return 1;
                return a.priority-b.priority;
              });
            }
          }
          var _sigEx=useState(false),sigsExpanded=_sigEx[0],setSigsExpanded=_sigEx[1];
          var visibleSigs=sigsExpanded?sigs:sigs.slice(0,3);
          if(sigs.length===0)return null;

          function handleAction(act){
            if(!act)return;
            if(act.type==="ai"){
              var FRAMING_BRIEF={
                challenge:{why:"This prompt feeds the AI your specific thesis arguments and asks it to attack them using your own words.",dataPoints:["Your thesis","Conviction history","KPIs","Decisions log"]},
                sell:{why:"Takes your sell criteria — written when calm — and asks whether they have actually been triggered.",dataPoints:["Your sell criteria","Recent decisions","Journal entries","Conviction trajectory"]},
                bear:{why:"Builds the strongest possible bear case using your own bull thesis as the target.",dataPoints:["Your bull thesis","Moat argument","Risks acknowledged","Conviction level"]},
                earnings:{why:"Tailored entirely to your thesis and KPIs — not a generic earnings preview.",dataPoints:["Your thesis","Your KPIs","Your sell criteria","Earnings date"]},
                annual:{why:"Uses your own conviction trajectory and decisions to ask if you should still own this.",dataPoints:["Conviction history","Decisions log","Journal entries","Original thesis"]},
              };
              var fr=FRAMING_BRIEF[act.aiType]||FRAMING_BRIEF["challenge"];
              var title={challenge:"Challenge My Thesis",sell:"Sell Discipline Check",bear:"Bear Case Generator",earnings:"Pre-Earnings Briefing",annual:"Annual Review"}[act.aiType]||"AI Review";
              setAiModal({title:title+" — "+(act.c?act.c.ticker:""),framing:fr,prompt:buildPrompt(act.aiType,act.c)});
            }
            else if(act.type==="go"){
              setSelId(act.c.id);setDetailTab("dossier");
              if(act.modal)setTimeout(function(){setModal({type:act.modal})},80);
            }
            else if(act.type==="library"){setSelId(null);setPage("library")}
            else if(act.type==="postmortem"){setModal({type:"postmortem",c:act.c,dec:act.dec})}
          }

          var _heldCos2=portfolio.filter(function(cc){return cc.purchaseDate});
          var _avgYrs2=_heldCos2.length?(_heldCos2.reduce(function(s,cc){var d=Math.ceil((Date.now()-new Date(cc.purchaseDate))/864e5);return s+(d>0&&d<18250?d:0)},0)/_heldCos2.length/365):0;
          return<div style={{borderBottom:"1px solid "+K.bdr}}>
            <div style={{padding:isMobile?"14px 16px 12px":"16px 24px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div>
                  <div style={{fontSize:isMobile?13:14,fontWeight:700,color:K.txt,fontFamily:fh}}>{"Your Morning Brief"}</div>
                  <div style={{fontSize:11,color:K.dim,marginTop:1}}>{now.toLocaleDateString("en-US",{weekday:"long"}).toUpperCase()+" MORNING"}</div>
                </div>
                {_avgYrs2>0&&investorProfile==="munger"&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:K.grn+"10",border:"1px solid "+K.grn+"20",borderRadius:_isBm?0:6}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={K.grn} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span style={{fontSize:11,fontWeight:700,color:K.grn,fontFamily:fm}}>{_avgYrs2.toFixed(1)+" yr avg hold"}</span>
                </div>}
              </div>
              <div style={{background:K.acc,color:"#fff",fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:_isBm?0:999,fontFamily:fm,flexShrink:0}}>
                {sigs.length+" signal"+(sigs.length!==1?"s":"")}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,padding:isMobile?"0 12px 14px":"0 20px 16px"}}>
              {(visibleSigs||[]).map(function(sig,i){
                return<div key={i} onClick={function(){handleAction(sig.onAction)}} style={{display:"flex",alignItems:"flex-start",gap:14,padding:isMobile?"12px 14px":"14px 16px",background:sig.color+"0a",border:"1px solid "+sig.color+"25",borderLeft:"3px solid "+sig.color,borderRadius:_isBm?0:10,cursor:"pointer",transition:"background .15s"}}
                  onMouseEnter={function(e){e.currentTarget.style.background=sig.color+"15"}}
                  onMouseLeave={function(e){e.currentTarget.style.background=sig.color+"0a"}}>
                  <div style={{width:30,height:30,borderRadius:_isBm?0:8,background:sig.color+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                    <IC name={sig.icon} size={14} color={sig.color}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:isMobile?13:14,fontWeight:700,color:K.txt,lineHeight:1.35,marginBottom:4}}>{sig.title}</div>
                    <div style={{fontSize:11,color:K.dim,lineHeight:1.5}}>{sig.sub}</div>
                    {!isMobile&&sig.secondary&&sig.onSecondary&&<div style={{marginTop:8,display:"flex",gap:6}}>
                      <button onClick={function(e){e.stopPropagation();handleAction(sig.onSecondary)}} style={{padding:"3px 10px",borderRadius:_isBm?0:5,border:"1px solid "+K.bdr,background:"transparent",color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fm}}>{sig.secondary}</button>
                    </div>}
                  </div>
                </div>;
              })}
              {sigs.length>3&&<button onClick={function(){setSigsExpanded(!sigsExpanded)}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,padding:"2px 0",textAlign:"left"}}>
                {sigsExpanded?"Show less":"Show "+(sigs.length-3)+" more signal"+(sigs.length-3!==1?"s":"")+" →"}
              </button>}
            </div>
          </div>;
        })()}

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:0}}>
          {/* LEFT — business events ── */}
          <div style={{padding:isMobile?"12px 16px":"14px 24px",borderRight:isMobile?"none":"1px solid "+K.bdr}}>

            {/* ── Look-through portfolio table — preset switcher ── */}
            {(function(){
              // ── S&P 500 benchmarks ─────────────────────────────────────
              var SP={roce:13,grossMargin:45,opMargin:16,cashConv:85,interestCover:9,
                      roic:12,fcfMargin:11,netDebtEbitda:2.1,roe:18,
                      revGrowth:5,epsGrowth:8,pe:22,peg:2.1,fcfYield:4.5,divYield:1.4};

              // ── Preset definitions ─────────────────────────────────────
              var PRESETS=[
                {id:"terry",label:"Terry",tip:"Fundsmith-style: quality compounders",rows:[
                  {key:"roce",     label:"ROCE",             bv:SP.roce,        hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){return s.roce?s.roce.numVal:s.roic?s.roic.numVal:null}},
                  {key:"gross",    label:"Gross margin",     bv:SP.grossMargin, hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){return s.grossMargin?s.grossMargin.numVal:null}},
                  {key:"op",       label:"Op margin",        bv:SP.opMargin,    hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){return s.opMargin?s.opMargin.numVal:null}},
                  {key:"cashconv", label:"Cash conversion",  bv:SP.cashConv,    hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){
  // Primary: FCF margin / Op margin = what % of operating profit converts to cash
  var fcf=s.fcfMargin&&s.fcfMargin.numVal!=null?s.fcfMargin.numVal:null;
  var op=s.opMargin&&s.opMargin.numVal!=null?s.opMargin.numVal:null;
  if(fcf!=null&&op!=null&&op>0)return Math.min(fcf/op*100,200);
  // Fallback 1: FCF margin as direct proxy
  if(fcf!=null)return Math.max(0,fcf);
  return null;}},
                  {key:"intcov",   label:"Interest cover",   bv:SP.interestCover,hb:true,fmt:function(v){return v.toFixed(0)+"x"}, get:function(s){
  // Primary: direct interest coverage ratio
  if(s.interestCoverage&&s.interestCoverage.numVal!=null)return s.interestCoverage.numVal;
  // Fallback 1: net-cash company (netDebt negative) -> effectively very high coverage
  if(s.netDebtEbitda&&s.netDebtEbitda.numVal!=null&&s.netDebtEbitda.numVal<0)return 99;
  // Fallback 2: near-zero leverage -> infer from ROIC
  if(s.netDebtEbitda&&s.netDebtEbitda.numVal!=null&&s.netDebtEbitda.numVal<0.5){
    var rc=s.roce&&s.roce.numVal!=null?s.roce.numVal:(s.roic&&s.roic.numVal!=null?s.roic.numVal:null);
    if(rc!=null&&rc>0)return Math.round(rc*2);}
  // Fallback 3: very low debt/equity
  if(s.debtEquity&&s.debtEquity.numVal!=null&&s.debtEquity.numVal<0.1)return 50;
  return null;}},
                ]},
                {id:"quality",label:"Quality",tip:"High-return, cash-generative businesses",rows:[
                  {key:"roic",     label:"ROIC",             bv:SP.roic,        hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){return s.roic?s.roic.numVal:null}},
                  {key:"roe",      label:"ROE",              bv:SP.roe,         hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){return s.roe?s.roe.numVal:null}},
                  {key:"gross",    label:"Gross margin",     bv:SP.grossMargin, hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){return s.grossMargin?s.grossMargin.numVal:null}},
                  {key:"fcfm",     label:"FCF margin",       bv:SP.fcfMargin,   hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){return s.fcfMargin?s.fcfMargin.numVal:null}},
                  {key:"ndeb",     label:"Net debt / EBITDA",bv:SP.netDebtEbitda,hb:false,fmt:function(v){return v.toFixed(1)+"x"},get:function(s){return s.netDebtEbitda?s.netDebtEbitda.numVal:null}},
                ]},
                {id:"garp",label:"GARP",tip:"Growth at a reasonable price",rows:[
                  {key:"revgr",    label:"Rev growth",       bv:SP.revGrowth,   hb:true, fmt:function(v){return(v>=0?"+":"")+v.toFixed(0)+"%"},get:function(s){return s.revGrowth?s.revGrowth.numVal:null}},
                  {key:"epsgr",    label:"EPS growth",       bv:SP.epsGrowth,   hb:true, fmt:function(v){return(v>=0?"+":"")+v.toFixed(0)+"%"},get:function(s){return s.epsGrowth?s.epsGrowth.numVal:null}},
                  {key:"op",       label:"Op margin",        bv:SP.opMargin,    hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){return s.opMargin?s.opMargin.numVal:null}},
                  {key:"pe",       label:"P/E",              bv:SP.pe,          hb:false,fmt:function(v){return v.toFixed(0)+"x"}, get:function(s){return s.pe?parseFloat(String(s.pe.value||"").replace(/[^0-9.\-]/g,"")):null}},
                  {key:"fcfy",     label:"FCF yield",        bv:SP.fcfYield,    hb:true, fmt:function(v){return v.toFixed(1)+"%"}, get:function(s){return s.fcfYield?s.fcfYield.numVal:null}},
                ]},
                {id:"value",label:"Value",tip:"Income and deep value lens",rows:[
                  {key:"pe",       label:"P/E",              bv:SP.pe,          hb:false,fmt:function(v){return v.toFixed(0)+"x"}, get:function(s){return s.pe?parseFloat(String(s.pe.value||"").replace(/[^0-9.\-]/g,"")):null}},
                  {key:"fcfy",     label:"FCF yield",        bv:SP.fcfYield,    hb:true, fmt:function(v){return v.toFixed(1)+"%"}, get:function(s){return s.fcfYield?s.fcfYield.numVal:null}},
                  {key:"divy",     label:"Div yield",        bv:SP.divYield,    hb:true, fmt:function(v){return v.toFixed(1)+"%"}, get:function(s){return s.divYield?s.divYield.numVal:null}},
                  {key:"ndeb",     label:"Net debt / EBITDA",bv:SP.netDebtEbitda,hb:false,fmt:function(v){return v.toFixed(1)+"x"},get:function(s){return s.netDebtEbitda?s.netDebtEbitda.numVal:null}},
                  {key:"roe",      label:"ROE",              bv:SP.roe,         hb:true, fmt:function(v){return v.toFixed(0)+"%"}, get:function(s){return s.roe?s.roe.numVal:null}},
                ]},
                {id:"munger",label:"Munger",tip:"Munger napkin: pre-tax returns, pricing power, owner earnings, fortress balance sheet",
                 mungerNote:"The numbers confirm. They do not decide.",
                 rows:[
                  {key:"pretax_roe", label:"Pre-tax return on equity",bv:22,hb:true,
                   fmt:function(v){return v.toFixed(0)+"%"},
                   get:function(s){var roe=s.roe&&s.roe.numVal!=null?s.roe.numVal:null;if(roe==null)return null;return Math.min(roe*1.35,150)},
                   note:"ROE grossed up for ~25% tax — Munger wants 15%+ pretax on tangible equity"},
                  {key:"gross",  label:"Gross margin (pricing power)", bv:SP.grossMargin,hb:true,
                   fmt:function(v){return v.toFixed(0)+"%"},
                   get:function(s){return s.grossMargin?s.grossMargin.numVal:null},
                   note:"Does management apologise for raising prices, or do customers barely notice?"},
                  {key:"fcfconv",label:"Earnings quality (FCF conv.)",  bv:85,hb:true,
                   fmt:function(v){return v.toFixed(0)+"%"},
                   get:function(s){var fcf=s.fcfMargin&&s.fcfMargin.numVal!=null?s.fcfMargin.numVal:null;var op=s.opMargin&&s.opMargin.numVal!=null?s.opMargin.numVal:null;if(fcf!=null&&op!=null&&op>0)return Math.min(fcf/op*100,200);if(fcf!=null&&fcf>0)return Math.min(fcf*5,150);var fcfy=s.fcfYield&&s.fcfYield.numVal!=null?s.fcfYield.numVal:null;var ey=s.pe?parseFloat(String(s.pe.value||"").replace(/[^0-9.\-]/g,"")):null;if(fcfy&&fcfy>0&&ey&&ey>0)return Math.min(fcfy/(1/ey)*100,200);return null},
                   note:"What % of operating earnings becomes real cash? Great businesses convert 80%+"},
                  {key:"earny",  label:"Owner earnings yield",          bv:4.5,hb:true,
                   fmt:function(v){return v.toFixed(1)+"%"},
                   get:function(s){var pe=s.pe?parseFloat(String(s.pe.value||"").replace(/[^0-9.\-]/g,"")):null;if(pe&&pe>0)return Math.min(1/pe*100,50);var fcfy=s.fcfYield&&s.fcfYield.numVal!=null?s.fcfYield.numVal:null;return fcfy&&fcfy>0?fcfy:null;},
                   note:"What you earn on every dollar invested. Munger: 'I can do the math in my head'"},
                  {key:"ndeb",   label:"Debt (fortress check)",         bv:SP.netDebtEbitda,hb:false,
                   fmt:function(v){return v<0?"Net cash":v.toFixed(1)+"x"},
                   get:function(s){return s.netDebtEbitda?s.netDebtEbitda.numVal:null},
                   note:"Munger hates leverage. Under 2x EBITDA, or ideally net cash."},
                  {key:"circle", label:"Circle of competence",          bv:3.5,hb:true,
                   fmt:function(v){return v.toFixed(1)+"/5"},
                   qual:true,
                   getQ:function(c2){return c2.circleScore||null},
                   note:"Do you truly understand these businesses? Munger: 'Invert, always invert'"},
                  {key:"mgmt",   label:"Management quality",            bv:null,hb:true,
                   fmt:function(v){return v===4?"A avg":v>=3?"B avg":v>=2?"C avg":"D avg"},
                   qual:true,
                   getQ:function(c2){return c2.managementGrade?({A:4,B:3,C:2,D:1}[c2.managementGrade]||null):null},
                   note:"The most important quality is integrity — Munger"},
                ]},
              ];

              // ── State: active preset ───────────────────────────────────
              var _ltp=useState(function(){return investorProfile==="munger"?"munger":"terry"}),activePreset=_ltp[0],setActivePreset=_ltp[1];
              var _exR=useState(null),expandedRow=_exR[0],setExpandedRow=_exR[1];
              var preset=PRESETS.find(function(p){return p.id===activePreset})||PRESETS[0];
              var totalVal3=portfolio.reduce(function(s,c2){var p2=c2.position||{};return s+(p2.shares>0&&p2.currentPrice>0?p2.shares*p2.currentPrice:0)},0);
              function wavg(fn,filterFn){var wSum=0,wN=0;portfolio.forEach(function(c2){var s=c2.financialSnapshot||{};var v=fn(s);if(filterFn&&!filterFn(v))return;var p2=c2.position||{};var w=totalVal3>0&&p2.shares>0&&p2.currentPrice>0?(p2.shares*p2.currentPrice/totalVal3):1/portfolio.length;if(v!=null){wSum+=v*w;wN+=w}});return wN>0?wSum/wN:null;}
              function wavgQual(fn){var sum=0,n=0;portfolio.forEach(function(c2){var v=fn(c2);if(v!=null){sum+=v;n++}});return n>0?sum/n:null;}
              function perHolding(r){return (portfolio||[]).map(function(c2){var v=r.qual?r.getQ(c2):r.get(c2.financialSnapshot||{});return{ticker:c2.ticker,v:v}}).filter(function(x){return x.v!=null&&(r.key!=="earny"||x.v>0)});}
              var _gradedRows=preset.rows.filter(function(r){return r.bv!=null});
              var _beaten=_gradedRows.filter(function(r){var pv=r.qual?wavgQual(r.getQ):wavg(r.get,r.key==="earny"?function(v){return v>0}:null);return pv!=null&&(r.hb?pv>r.bv:pv<r.bv)}).length;
              var _gr=_gradedRows.length>0?_beaten/_gradedRows.length:null;
              var napkinGrade=_gr===null?"?":_gr>=0.8?"A":_gr>=0.6?"B":_gr>=0.4?"C":"D";
              var napkinColor=napkinGrade==="A"?K.grn:napkinGrade==="B"?K.acc:napkinGrade==="C"?K.amb:K.red;
              var hasSpBench=preset.rows.some(function(r){return r.bv!=null&&!r.qual});
              return<div style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:700}}>Portfolio Look-Through</div>
                    {napkinGrade!=="?"&&<div title={_beaten+"/"+_gradedRows.length+" metrics beat benchmark"} style={{width:18,height:18,borderRadius:"50%",background:napkinColor,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"help"}}><span style={{fontSize:9,fontWeight:800,color:"#fff",fontFamily:fm}}>{napkinGrade}</span></div>}
                  </div>
                  <div style={{display:"flex",gap:3}}>{(PRESETS||[]).map(function(p){var on=p.id===activePreset;return<button key={p.id} title={p.tip} onClick={function(){setActivePreset(p.id);setExpandedRow(null)}} style={{padding:"3px 8px",borderRadius:_isBm?0:999,border:"1px solid "+(on?K.acc+"50":K.bdr),background:on?K.acc+"16":"transparent",color:on?K.acc:K.dim,fontSize:9,fontWeight:on?700:400,cursor:"pointer",fontFamily:fm,transition:"all .12s"}}>{p.label}</button>})}</div>
                </div>
                <div style={{borderRadius:_isBm?0:8,overflow:"hidden",border:"1px solid "+K.bdr}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 72px "+(hasSpBench?"72px":""),background:K.bg,borderBottom:"1px solid "+K.bdr}}>
                    <div style={{padding:"5px 10px"}}/>
                    <div style={{padding:"5px 0",fontSize:9,color:K.acc,fontFamily:fm,fontWeight:700,textAlign:"center"}}>Portfolio</div>
                    {hasSpBench&&<div style={{padding:"5px 0",fontSize:9,color:K.dim,fontFamily:fm,textAlign:"center"}}>S&P 500</div>}
                  </div>
                  {(preset.rows||[]).map(function(r,i){
                    var isEarny=r.key==="earny";
                    var pv=r.qual?wavgQual(r.getQ):wavg(r.get,isEarny?function(v){return v>0}:null);
                    var holdings=perHolding(r);
                    var beat=pv!=null&&r.bv!=null&&(r.hb?pv>r.bv:pv<r.bv);
                    var pvColor=pv==null?K.dim:beat?K.grn:K.amb;
                    var isOpen=expandedRow===r.key;
                    var vArr=(holdings||[]).map(function(h){return h.v});
                    var vMin=vArr.length?Math.min.apply(null,vArr):0;
                    var vMax=vArr.length?Math.max.apply(null,vArr):1;
                    var vSpan=Math.max(vMax-vMin,0.001);
                    return<div key={r.key} style={{borderBottom:i<preset.rows.length-1?"1px solid "+K.bdr+"50":"none",background:isOpen?K.acc+"04":"transparent"}}>
                      <div title={r.note||""} style={{display:"grid",gridTemplateColumns:"1fr 72px "+(r.bv!=null&&hasSpBench?"72px":""),cursor:holdings.length>0?"pointer":"default"}} onClick={function(){if(holdings.length>0)setExpandedRow(isOpen?null:r.key)}}>
                        <div style={{padding:"7px 10px",fontSize:11,color:K.mid,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}>
                          {r.label}{r.note&&<span style={{fontSize:9,color:K.dim,opacity:.5}}>ⓘ</span>}
                          {r.qual&&<span style={{fontSize:8,color:K.acc,background:K.acc+"10",padding:"1px 4px",borderRadius:2,marginLeft:2,fontFamily:fm}}>qual</span>}
                          {holdings.length>0&&<span style={{fontSize:8,color:K.dim,marginLeft:"auto",opacity:.4}}>{isOpen?"▲":"▼"}</span>}
                        </div>
                        <div style={{padding:"7px 0",textAlign:"center"}}>
                          {pv!=null?<span style={{fontSize:12,fontWeight:700,color:pvColor,fontFamily:fm}}>{r.fmt(pv)}</span>:r.qual?<button onClick={function(e){e.stopPropagation();setDashSet(function(p){var n=Object.assign({},p,{portfolioView:"ledger"});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(er){}return n})}} style={{fontSize:9,color:K.acc,background:"none",border:"1px dashed "+K.acc+"50",borderRadius:_isBm?0:3,padding:"2px 7px",cursor:"pointer",fontFamily:fm}}>Rate →</button>:<span style={{fontSize:11,color:K.bdr,cursor:"pointer"}} title="Refresh financial data" onClick={function(e){e.stopPropagation();filtered.filter(function(c2){return c2.ticker}).forEach(function(c2,ii){setTimeout(function(){fetchEarnings(c2,c2.kpis).then(function(res){if(res&&res.snapshot)upd(c2.id,{financialSnapshot:Object.assign({},c2.financialSnapshot,res.snapshot),lastChecked:new Date().toISOString()})})},ii*800)})}}>{"↺"}</span>}
                        </div>
                        {r.bv!=null&&hasSpBench&&<div style={{padding:"7px 0",textAlign:"center"}}><span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{r.fmt(r.bv)}</span></div>}
                      </div>
                      {isOpen&&holdings.length>0&&<div style={{padding:"4px 12px 10px",borderTop:"1px solid "+K.bdr+"30"}}>
                        {isEarny&&holdings.length<portfolio.length&&<div style={{fontSize:9,color:K.dim,fontFamily:fm,marginBottom:3,fontStyle:"italic"}}>Loss-making companies excluded</div>}
                        <div style={{position:"relative",height:24,marginBottom:4}}>
                          <div style={{position:"absolute",top:11,left:4,right:4,height:1,background:K.bdr}}/>
                          {r.bv!=null&&(function(){var bp=Math.max(2,Math.min(96,(r.bv-vMin)/vSpan*92+4));return<div style={{position:"absolute",top:5,left:bp+"%",transform:"translateX(-50%)",width:1,height:12,background:K.dim,opacity:.4}} title={"S&P: "+r.fmt(r.bv)}/>})()}
                          {(holdings||[]).map(function(h){var pct=Math.max(2,Math.min(96,(h.v-vMin)/vSpan*92+4));var dc=r.bv!=null?((r.hb?h.v>r.bv:h.v<r.bv)?K.grn:K.amb):K.acc;return<div key={h.ticker} title={h.ticker+": "+r.fmt(h.v)} style={{position:"absolute",top:5,left:pct+"%",transform:"translateX(-50%)",cursor:"pointer"}} onClick={function(e){e.stopPropagation();var f2=cos.find(function(co){return co.ticker===h.ticker});if(f2){setSelId(f2.id);setDetailTab("dossier")}}}><div style={{width:10,height:10,borderRadius:"50%",background:dc,border:"2px solid "+K.card,boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/></div>;})}
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:"2px 10px"}}>{holdings.slice().sort(function(a,b){return b.v-a.v}).map(function(h){var dc=r.bv!=null?((r.hb?h.v>r.bv:h.v<r.bv)?K.grn:K.amb):K.acc;return<span key={h.ticker} style={{fontSize:9,fontFamily:fm,color:dc,fontWeight:700,cursor:"pointer"}} onClick={function(e){e.stopPropagation();var f2=cos.find(function(co){return co.ticker===h.ticker});if(f2){setSelId(f2.id);setDetailTab("dossier")}}}>{h.ticker+" "+r.fmt(h.v)}</span>;})}</div>
                      </div>}
                    </div>;})}
                  {preset.mungerNote&&<div style={{padding:"8px 10px",fontSize:10,color:K.dim,fontStyle:"italic",borderTop:"1px solid "+K.bdr+"40",lineHeight:1.6}}>
                    {"\u201c"+preset.mungerNote+"\u201d"}
                  </div>}
                </div>
              </div>
            })()}

                        {/* Post-earnings review needed */}
            {(function(){var needReview=portfolio.filter(function(c2){return c2.earningsDate&&c2.earningsDate!=="TBD"&&dU(c2.earningsDate)<0&&dU(c2.earningsDate)>=-14&&c2.kpis.length>0&&!c2.lastChecked});
              if(needReview.length===0)return null;
              return<div style={{marginBottom:14}}>
                <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.amb,fontFamily:fm,fontWeight:700,marginBottom:7}}>Post-Earnings Review</div>
                {needReview.slice(0,3).map(function(c2){return<div key={c2.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid "+K.bdr+"25",cursor:"pointer"}} onClick={function(){setSelId(c2.id);setDetailTab("dossier")}}>
                  <CoLogo domain={c2.domain} ticker={c2.ticker} size={16}/>
                  <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c2.ticker}</span>
                  <span style={{fontSize:10,color:K.dim}}>Did the KPIs hold?</span>
                  <span style={{marginLeft:"auto",fontSize:9,color:K.amb,fontFamily:fm}}>{c2.kpis.length} KPIs →</span>
                </div>})}
              </div>})()}

            {/* Upcoming earnings */}
            {upcoming.length>0&&<div style={{marginBottom:14}}>
              <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:earningsToday>0?K.red:K.amb,fontFamily:fm,fontWeight:700,marginBottom:7}}>
                {earningsToday>0?"Reporting Today":upcoming[0]&&dU(upcoming[0].earningsDate)===1?"Reporting Tomorrow":"Earnings This Week"}
              </div>
              {upcoming.slice(0,4).map(function(c2){var d2=dU(c2.earningsDate);var kpiC=c2.kpis.length;
                return<div key={c2.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid "+K.bdr+"25",cursor:"pointer"}} onClick={function(){setSelId(c2.id);setDetailTab("dossier")}}>
                  <CoLogo domain={c2.domain} ticker={c2.ticker} size={16}/>
                  <span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c2.ticker}</span>
                  <span style={{fontSize:11,color:d2===0?K.red:d2===1?K.amb:K.dim,fontWeight:600,fontFamily:fm}}>{d2===0?"Today":d2===1?"Tomorrow":d2+"d"}</span>
                  <span style={{marginLeft:"auto",fontSize:9,color:kpiC>0?K.blue:K.dim,fontFamily:fm}}>{kpiC>0?kpiC+" KPIs":"No KPIs yet"}</span>
                </div>})}
            </div>}

            {/* Insider buying signals */}
            {insiderSignals.length>0&&<div>
              <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:700,marginBottom:6}}>Insider Buying</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {(insiderSignals||[]).map(function(s){return<div key={s.ticker} style={{fontSize:11,color:K.grn,background:K.grn+"12",padding:"2px 8px",borderRadius:_isBm?0:6,fontFamily:fm,cursor:"pointer"}} onClick={function(){setSelId(s.id)}}>{s.ticker} ×{s.count}</div>})}
              </div>
            </div>}

          </div>

          {/* RIGHT — ownership health (no prices) ── */}
          <div style={{padding:isMobile?"12px 16px":"14px 24px",borderTop:isMobile?"1px solid "+K.bdr:"none"}}>
            <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:700,marginBottom:10}}>Ownership Health</div>
            {(portfolio||[]).map(function(c2){
              var convColor=c2.conviction>=7?K.grn:c2.conviction>=4?K.amb:c2.conviction>0?K.red:K.bdr;
              var hasEarningsSoon=c2.earningsDate&&c2.earningsDate!=="TBD"&&dU(c2.earningsDate)>=0&&dU(c2.earningsDate)<=7;
              // --- Progress meter: 0-100 across 5 dimensions ---
              var _th=c2.thesisNote||"";
              var _thSec=(_th.length>20?1:0)+(_th.indexOf("## MOAT")>=0?1:0)+(_th.indexOf("## RISKS")>=0?1:0)+(_th.indexOf("## SELL")>=0?1:0);
              var _tScore=Math.min(100,_thSec*25); // 0/25/50/75/100
              var _kDef=c2.kpis.length;var _kChk=c2.kpis.filter(function(k2){return k2.lastResult}).length;var _kMet=c2.kpis.filter(function(k2){return k2.lastResult&&k2.lastResult.status==="met"}).length;
              var _kScore=_kDef===0?0:Math.min(100,_kDef*15+_kChk*10+_kMet*15);
              var _convScore=(c2.conviction||0)*10;
              var _mt=c2.moatTypes||{};var _hasMoat=Object.keys(_mt).some(function(k2){return _mt[k2]&&_mt[k2].active});
              var _moatScore=_hasMoat?100:0;
              var _decScore=(c2.decisions&&c2.decisions.length>0)?Math.min(100,c2.decisions.length*20):0;
              var _coverage=Math.round((_tScore+_kScore+_convScore+_moatScore+_decScore)/5);
              var _covColor=_coverage>=70?K.grn:_coverage>=40?K.amb:K.red;
              // Weakest dimension label
              var _dims=[{l:"thesis",v:_tScore},{l:"KPIs",v:_kScore},{l:"conviction",v:_convScore},{l:"moat",v:_moatScore},{l:"journal",v:_decScore}];
              var _weakest=_dims.reduce(function(a,b){return a.v<=b.v?a:b});
              var _hint=_coverage>=80?"Well covered":"Work on "+_weakest.l;
              return<div key={c2.id} style={{padding:"7px 0",borderBottom:"1px solid "+K.bdr+"20",cursor:"pointer"}} onClick={function(){setSelId(c2.id);setDetailTab("dossier")}}>
                <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:3}}>
                  <div title={"Conviction: "+(c2.conviction||"unset")} style={{width:6,height:6,borderRadius:_isBm?1:"50%",background:convColor,flexShrink:0,marginRight:8}}/>
                  <CoLogo domain={c2.domain} ticker={c2.ticker} size={16}/>
                  <span style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,marginLeft:6,flex:1}}>{c2.ticker}</span>
                  {hasEarningsSoon&&<span style={{fontSize:9,color:K.amb,background:K.amb+"15",padding:"1px 5px",borderRadius:_isBm?0:4,marginRight:4,flexShrink:0,fontFamily:fm}}>{dU(c2.earningsDate)===0?"today":dU(c2.earningsDate)+"d"}</span>}
                  <span style={{fontSize:10,fontWeight:700,color:_covColor,fontFamily:fm}}>{_coverage}%</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:5,paddingLeft:14}}>
                  <div style={{flex:1,height:3,borderRadius:_isBm?0:2,background:K.bdr,overflow:"hidden"}}>
                    <div style={{height:"100%",width:_coverage+"%",borderRadius:_isBm?0:2,background:_covColor,transition:"width .3s"}}/>
                  </div>
                  <span style={{fontSize:9,color:K.dim,fontFamily:fm,whiteSpace:"nowrap"}}>{_hint}</span>
                </div>
              </div>})}
          </div>
        </div>

        {/* ── Done for today ── */}
        {focus&&!isMobile&&<div style={{padding:"9px 24px",borderTop:"1px solid "+K.bdr+"40",background:K.bg+"60",display:"flex",alignItems:"center",gap:8}}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="1.8" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span style={{fontSize:10,color:K.dim,fontFamily:fm,fontStyle:"italic"}}>{"Do the one thing above. Then close the laptop — your portfolio doesn’t need you right now."}</span>
        </div>}

        {/* ── Owner's Intel feed ── */}
        {(function(){
          var _nfs=useState(false),showNewsFilter=_nfs[0],setShowNewsFilter=_nfs[1];
          var _nex=useState(false),newsExpanded=_nex[0],setNewsExpanded=_nex[1];
          var enabledCats=Object.keys(briefNewsPrefs).filter(function(k){return briefNewsPrefs[k]});
          var shown=(briefNews||[]).filter(function(n){
            if(!portfolio.some(function(c2){return c2.ticker===n.ticker}))return false;
            return enabledCats.indexOf(n.cat)>=0}).slice(0,10);
          var visible=newsExpanded?shown:shown.slice(0,3);
          if(!briefNewsLoading&&briefNews===null)return null; // never loaded yet
          return<div style={{borderTop:"1px solid "+K.bdr}}>
            <div style={{padding:isMobile?"12px 16px 14px":"14px 24px 16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showNewsFilter?10:8}}>
                <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                  <IC name="news" size={12} color={isThesis?K.acc:K.mid}/><span style={{fontSize:13,fontWeight:700,color:K.txt,fontFamily:fm,marginLeft:2}}>Owner's Intel</span>
                  {briefNews&&shown.length>0&&<span style={{fontSize:10,color:isThesis?K.acc:K.dim,background:(isThesis?K.acc:K.dim)+"18",padding:"1px 7px",borderRadius:_isBm?0:999,fontFamily:fm,fontWeight:700,letterSpacing:0}}>{shown.length}</span>}
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={function(){setShowNewsFilter(!showNewsFilter)}} style={{background:showNewsFilter?K.acc+"15":"none",border:"1px solid "+(showNewsFilter?K.acc+"40":K.bdr),borderRadius:_isBm?0:999,color:showNewsFilter?K.acc:K.dim,fontSize:10,cursor:"pointer",fontFamily:fm,padding:"2px 9px",display:"flex",alignItems:"center",gap:4}}>
                    <IC name="gear" size={10} color={showNewsFilter?K.acc:K.dim}/>{"Filter"}
                  </button>
                  <button onClick={function(){try{localStorage.removeItem("ta-brief-news")}catch(e){}setBriefNews([]);loadBriefNews(portfolio)}} style={{background:K.acc,border:"none",borderRadius:_isBm?0:999,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:fm,padding:"5px 14px",display:"flex",alignItems:"center",gap:5,boxShadow:"0 2px 8px "+K.acc+"40"}} title="Refresh news"><IC name="refresh" size={12} color="#fff"/>{briefNewsLoading?"Loading...":"Refresh feed"}</button>
                </div>
              </div>
              {showNewsFilter&&<div style={{background:K.bg,borderRadius:_isBm?0:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:11,color:K.mid,fontFamily:fm,marginBottom:8,fontWeight:600}}>{"Show news about…"}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {(NEWS_CATS||[]).map(function(cat){var on=!!briefNewsPrefs[cat.id];return<button key={cat.id} onClick={function(){var next=Object.assign({},briefNewsPrefs);next[cat.id]=!on;saveBriefNewsPrefs(next)}} style={{padding:"5px 12px",borderRadius:_isBm?0:999,border:"1px solid "+(on?cat.color+"50":K.bdr),background:on?cat.color+"15":"transparent",color:on?cat.color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fm,fontWeight:on?700:400,transition:"all .15s",display:"flex",alignItems:"center",gap:4}} title={cat.desc}>
                    <div style={{width:6,height:6,borderRadius:_isBm?1:"50%",background:on?cat.color:K.bdr,flexShrink:0}}/>
                    {cat.label}
                  </button>})}
                </div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:8}}>{"Only stories where your company is the subject, not a footnote."}</div>
              </div>}
              {briefNewsLoading&&(!briefNews||briefNews.length===0)&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0"}}><div style={{width:7,height:7,borderRadius:"50%",background:K.acc,animation:"pulse 1.2s infinite"}}/><span style={{fontSize:12,color:K.dim}}>{"Scanning news for your holdings…"}</span></div>}
              {shown.length>0&&<div>{(visible||[]).map(function(n,i){
                var timeAgo=(function(){var diff=Math.floor(Date.now()/1000-n.datetime);if(diff<3600)return Math.floor(diff/60)+"m ago";if(diff<86400)return Math.floor(diff/3600)+"h ago";return Math.floor(diff/86400)+"d ago"})();
                var co=portfolio.find(function(c2){return c2.ticker===n.ticker});
                return<a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"flex-start",gap:9,padding:"8px 0",borderBottom:i<shown.length-1?"1px solid "+K.bdr+"20":"none",textDecoration:"none"}}
                  onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06";e.currentTarget.style.borderRadius="6px";e.currentTarget.style.padding="8px 6px";e.currentTarget.style.margin="0 -6px"}}
                  onMouseLeave={function(e){e.currentTarget.style.background="transparent";e.currentTarget.style.padding="8px 0";e.currentTarget.style.margin="0"}}>
                  {co&&<div style={{flexShrink:0,marginTop:2}}><CoLogo domain={co.domain} ticker={co.ticker} size={16}/></div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:isMobile?13:12,color:K.mid,lineHeight:1.5,marginBottom:2}}>{n.headline}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,fontWeight:700,color:K.acc,fontFamily:fm}}>{n.ticker}</span>
                      <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{n.source}</span>
                      <span style={{fontSize:9,color:K.dim,fontFamily:fm}}>{timeAgo}</span>
                    </div>
                  </div>
                  <span style={{flexShrink:0,fontSize:10,fontWeight:700,color:n.color,background:n.color+"15",padding:"2px 8px",borderRadius:_isBm?0:999,fontFamily:fm,whiteSpace:"nowrap",marginTop:2}}>{n.label}</span>
                </a>})}
              </div>}
              {shown.length>3&&<button onClick={function(){setNewsExpanded(!newsExpanded)}} style={{marginTop:8,background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,padding:"4px 0",display:"flex",alignItems:"center",gap:4}}><IC name={newsExpanded?"alert":"plus"} size={10} color={K.acc}/>{newsExpanded?"Show less":"Show "+(shown.length-3)+" more stories"}</button>}
              {briefNews!==null&&shown.length===0&&!briefNewsLoading&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0",color:K.dim}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span style={{fontSize:12,fontFamily:fm}}>{"No curated news found for your holdings in the last 14 days. Try refreshing."}</span></div>}
            </div>
          </div>})()}
      </div>})()}
    {/* ── CONVICTION LEDGER VIEW ── */}
    {filtered.length>0&&sideTab!=="toohard"&&dashSet.portfolioView==="ledger"&&(function(){
      var totalVal=filtered.reduce(function(s,cc){var p=cc.position||{};return s+(p.shares>0&&p.currentPrice>0?p.shares*p.currentPrice:0)},0);
      var heldCos=filtered.filter(function(cc){return cc.purchaseDate});
      var avgYrs=heldCos.length?(heldCos.reduce(function(s,cc){var d=Math.ceil((Date.now()-new Date(cc.purchaseDate))/864e5);return s+(d>0&&d<18250?d:0)},0)/heldCos.length/365).toFixed(1):0;
      var sorted=filtered.slice().sort(function(a,b){var da=a.purchaseDate?Math.ceil((Date.now()-new Date(a.purchaseDate))/864e5):0;var db=b.purchaseDate?Math.ceil((Date.now()-new Date(b.purchaseDate))/864e5):0;return db-da;});
      return<div style={{marginBottom:28}}>
        {/* Patience header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,padding:"16px 22px",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:K.dim,fontFamily:fm,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Conviction Ledger</div>
            <div style={{fontSize:14,color:K.txt,fontFamily:fh,fontWeight:600}}>{"Businesses you own, not stocks you hold"}</div>
          </div>
          <div style={{display:"flex",gap:28}}>
            {Number(avgYrs)>0&&<div style={{textAlign:"right"}}>
              <div style={{fontSize:26,fontWeight:800,color:Number(avgYrs)>=3?K.grn:Number(avgYrs)>=1?K.amb:K.dim,fontFamily:fm,lineHeight:1}}>{avgYrs}<span style={{fontSize:12,fontWeight:400,color:K.dim}}> yr</span></div>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>avg hold time</div>
            </div>}
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:26,fontWeight:800,color:K.txt,fontFamily:fm,lineHeight:1}}>{filtered.length}</div>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>businesses</div>
            </div>
          </div>
        </div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:"0 24px",marginBottom:16}}>
        {(sorted||[]).map(function(cc,ci){
          var pos=cc.position||{};
          var _rawDays=cc.purchaseDate?Math.ceil((Date.now()-new Date(cc.purchaseDate))/864e5):0;
          var days=(_rawDays>0&&_rawDays<18250)?_rawDays:0;
          var holdYrs=days>=365?(days/365).toFixed(1)+"yr":days>=30?Math.floor(days/30)+"mo":days>0?days+"d":null;
          var moatObjs=Object.keys(cc.moatTypes||{}).filter(function(k){return cc.moatTypes[k]&&cc.moatTypes[k].active}).map(function(k){return MOAT_TYPES.find(function(t){return t.id===k})}).filter(Boolean);
          var sec=parseThesis(cc.thesisNote||"");
          var bearLine=sec.risks?sec.risks.split(".")[0].trim():null;
          var coreLine=sec.core?sec.core.substring(0,180)+(sec.core.length>180?"...":""):null;
          var convColor=cc.conviction>=7?K.grn:cc.conviction>=4?K.acc:cc.conviction>0?K.amb:K.bdr;
          var coc=cc.circleScore||0;
          var cocColor=coc>=4?K.grn:coc>=3?K.acc:coc>0?K.amb:K.bdr;
          var weight=totalVal>0&&pos.shares>0&&pos.currentPrice>0?(pos.shares*pos.currentPrice/totalVal*100):0;
          var isLast=ci===sorted.length-1;
          return<div key={cc.id}
            style={{padding:"22px 4px",borderBottom:isLast?"none":"1px solid "+K.bdr+"50",cursor:"pointer",transition:"background .12s"}}
            onClick={function(){setSelId(cc.id);setDetailTab("dossier")}}
            onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"05"}}
            onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:16}}>

              {/* LEFT — logo + hold */}
              <div style={{flexShrink:0,width:48,display:"flex",flexDirection:"column",alignItems:"center",gap:4,paddingTop:2}}>
                <CoLogo domain={cc.domain} ticker={cc.ticker} size={32}/>
                {holdYrs&&<div style={{fontSize:8,color:K.dim,fontFamily:fm,fontWeight:600,letterSpacing:.3}}>{holdYrs}</div>}
              </div>

              {/* CENTRE — the writing */}
              <div style={{flex:1,minWidth:0}}>
                {/* Company line */}
                <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:17,fontWeight:900,color:K.txt,fontFamily:fh,letterSpacing:"-0.3px"}}>{cc.ticker}</span>
                  <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{cc.name}</span>
                  {moatObjs.slice(0,3).map(function(mt){return<span key={mt.id} style={{fontSize:8,fontWeight:700,color:mt.color,background:mt.color+"12",padding:"1px 6px",borderRadius:_isBm?0:3,fontFamily:fm,letterSpacing:.3}}>{mt.label}</span>})}
                  {cc.managementGrade&&<span style={{fontSize:8,fontWeight:700,color:cc.managementGrade==="A"?K.grn:cc.managementGrade==="B"?K.acc:K.amb,background:(cc.managementGrade==="A"?K.grn:cc.managementGrade==="B"?K.acc:K.amb)+"12",padding:"1px 6px",borderRadius:_isBm?0:3,fontFamily:fm}}>{"Mgmt "+cc.managementGrade}</span>}
                </div>

                {/* Thesis / bear — the meat */}
                {bearLine
                  ?<div style={{fontSize:13,color:K.mid,lineHeight:1.75,marginBottom:10,maxWidth:640}}>
                    <span style={{color:K.dim,fontSize:11,fontFamily:fm,fontWeight:600,marginRight:6}}>Bear case</span>
                    {bearLine+(sec.risks&&sec.risks.length>bearLine.length+2?"...":"")}
                  </div>
                  :coreLine
                    ?<div style={{fontSize:13,color:K.mid,lineHeight:1.75,marginBottom:10,maxWidth:640}}>{coreLine}</div>
                    :<div style={{fontSize:12,color:K.bdr,fontStyle:"italic",marginBottom:10,fontFamily:fm}}>No thesis written — what do you own this for?</div>}

                {/* Stats line — quiet, single row */}
                <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  {/* Conviction */}
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    {Array.from({length:10},function(_,i){return<div key={i} style={{width:3,height:i<(cc.conviction||0)?10:5,borderRadius:1,background:i<(cc.conviction||0)?convColor:K.bdr+"60",flexShrink:0}}/>})}
                    <span style={{fontSize:10,fontWeight:700,color:cc.conviction>0?convColor:K.bdr,fontFamily:fm,marginLeft:2}}>{cc.conviction>0?cc.conviction+"/10":"—"}</span>
                  </div>
                  {/* Circle */}
                  <div style={{display:"flex",alignItems:"center",gap:3}}>
                    {[1,2,3,4,5].map(function(n){return<div key={n} style={{width:6,height:6,borderRadius:_isBm?1:"50%",background:n<=coc?cocColor:K.bdr+"50"}}/>})}
                    {!coc&&<button onClick={function(e){e.stopPropagation();var v=parseInt(window.prompt("Circle of competence — "+cc.ticker+"\n\n1 Barely understand\n2 Know the basics\n3 Solid understanding\n4 Deep knowledge\n5 Expert\n\nRate 1-5:","3"));if(!isNaN(v)&&v>=1&&v<=5)upd(cc.id,{circleScore:v})}} style={{fontSize:9,color:K.dim,background:"none",border:"1px dashed "+K.bdr,borderRadius:_isBm?0:3,padding:"1px 6px",cursor:"pointer",fontFamily:fm,marginLeft:2}}>Rate</button>}
                  </div>
                  {/* Weight */}
                  {weight>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{weight.toFixed(1)+"%"}</span>}
                  {/* Inversion */}
                  {cc.inversionNote
                    ?<span style={{fontSize:9,color:K.grn,fontFamily:fm,fontWeight:600}}>✓ Inversion</span>
                    :<button onClick={function(e){e.stopPropagation();setSelId(cc.id);setDetailTab("dossier")}} style={{fontSize:9,color:K.dim,background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:fm,textDecoration:"underline",textUnderlineOffset:2}}>+ inversion</button>}
                  {coc>0&&coc<3&&<span style={{fontSize:9,color:K.amb,fontFamily:fm}}>⚠ outside circle</span>}
                </div>
              </div>

            </div>
          </div>;
        })}
        </div>
        {filtered.some(function(cc){return !cc.circleScore||!cc.inversionNote||!cc.managementGrade})&&<div style={{marginTop:8,padding:"10px 16px",background:K.acc+"06",border:"1px dashed "+K.acc+"25",borderRadius:_isBm?0:8,fontSize:11,color:K.dim,lineHeight:1.6}}>
          Open a holding to complete: Circle of Competence rating, Inversion note, Management grade. The three things Munger checks before anything else.
        </div>}
      </div>;
    })()}
    {/* ── Owner's Checklist (persistent onboarding) ── */}
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
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>{"📋"}</span>
            <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Owner's Checklist</span>
            <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{completed}/4</span></div>
          <button onClick={function(){var nm3=Object.assign({},milestones);nm3.onboard_dismissed=true;setMilestones(nm3);try{localStorage.setItem("ta-milestones",JSON.stringify(nm3))}catch(e){}}} style={{background:"none",border:"none",color:K.dim,fontSize:13,cursor:"pointer",padding:2}}>{"✕"}</button></div>
        {/* Progress bar */}
        <div style={{display:"flex",gap:3,marginBottom:12}}>
          {(steps||[]).map(function(s,i){return<div key={i} style={{flex:1,height:4,borderRadius:_isBm?0:2,background:s.done?K.grn:K.bdr,transition:"background .3s"}}/>})}</div>
        {/* Step buttons */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {(steps||[]).map(function(s,i){return<button key={i} onClick={s.done?undefined:s.onClick} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:_isBm?0:6,border:"1px solid "+(s.done?K.grn+"40":s.color+"30"),background:s.done?K.grn+"08":"transparent",color:s.done?K.grn:s.color,fontSize:11,fontWeight:600,cursor:s.done?"default":"pointer",fontFamily:fm,opacity:s.done?.7:1}}>
            {s.done?<IC name="check" size={10} color={K.grn}/>:<IC name={s.icon} size={10} color={s.color}/>}{s.label}</button>})}</div>
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
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:isMobile?"12px 14px":"18px 22px",minWidth:0,overflow:"hidden"}}>
          <div style={{fontSize:10,letterSpacing:isMobile?0.5:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:6,fontFamily:fm,whiteSpace:"nowrap"}}>Portfolio Value</div>
          <div style={{fontSize:isMobile?16:22,fontWeight:700,color:K.txt,fontFamily:fm,lineHeight:1.15}}>{cSym}{totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          <div style={{fontSize:11,color:K.dim,marginTop:4,fontFamily:fm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Invested: {cSym}{totalCost.toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:isMobile?"12px 14px":"18px 22px",minWidth:0,overflow:"hidden"}}>
          <div style={{fontSize:10,letterSpacing:isMobile?0.5:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:6,fontFamily:fm,whiteSpace:"nowrap"}}>Total Return</div>
          <div style={{fontSize:isMobile?16:22,fontWeight:700,color:isUp?K.grn:K.red,fontFamily:fm,lineHeight:1.15}}>{isUp?"+":""}{totalReturnPct.toFixed(1)}%</div>
          <div style={{fontSize:11,color:isUp?K.grn:K.red,marginTop:4,fontFamily:fm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isUp?"+":""}{cSym}{Math.abs(totalReturn).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:isMobile?"12px 14px":"18px 22px",minWidth:0,overflow:"hidden"}}>
          <div style={{fontSize:10,letterSpacing:isMobile?0.5:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:6,fontFamily:fm,whiteSpace:"nowrap"}}>Today</div>
          {dayPnl!==0?<div>
            <div style={{fontSize:isMobile?16:22,fontWeight:700,color:isDayUp?K.grn:K.red,fontFamily:fm,lineHeight:1.15}}>{isDayUp?"+":""}{dayPnlPct.toFixed(2)}%</div>
            <div style={{fontSize:11,color:isDayUp?K.grn:K.red,marginTop:4,fontFamily:fm}}>{isDayUp?"+":""}{cSym}{Math.abs(dayPnl).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          </div>:<div style={{fontSize:isMobile?14:18,fontWeight:500,color:K.dim,fontFamily:fm,lineHeight:1.15,marginTop:4}}>Refresh prices</div>}</div>
        <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:isMobile?"12px 14px":"18px 22px",minWidth:0,overflow:"hidden",cursor:"pointer"}} onClick={function(){if(best)setSelId(best.id)}}>
          <div style={{fontSize:10,letterSpacing:isMobile?0.5:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:6,fontFamily:fm,whiteSpace:"nowrap"}}>Leader / Laggard</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><div style={{fontSize:isMobile?14:16,fontWeight:700,color:K.grn,fontFamily:fm,lineHeight:1.15}}>{best?best.ticker:"—"}</div>
              <div style={{fontSize:11,color:K.grn,marginTop:2,fontFamily:fm}}>{best?(best.pct>=0?"+":"")+best.pct.toFixed(1)+"%":""}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:isMobile?14:16,fontWeight:700,color:K.red,fontFamily:fm,lineHeight:1.15}}>{worst?worst.ticker:"—"}</div>
              <div style={{fontSize:11,color:K.red,marginTop:2,fontFamily:fm}}>{worst?(worst.pct>=0?"+":"")+worst.pct.toFixed(1)+"%":""}</div></div>
          </div>
          {inBuyZone>0&&<div style={{fontSize:9,fontWeight:700,color:K.grn,fontFamily:fm,marginTop:4,background:K.grn+"12",padding:"2px 6px",borderRadius:_isBm?0:3,display:"inline-block"}}>{inBuyZone} in buy zone</div>}
        </div>
      </div>}()}
    {/* Analytics quick link */}

    {/* ── Conviction/Position Alignment ── */}
    {sideTab==="portfolio"&&function(){
      var portCos2=filtered.filter(function(c){return(c.status||"portfolio")==="portfolio"});
      if(portCos2.length<2)return null;
      var signals=calcAlignmentSignals(K, portCos2);
      if(signals.mismatches.length===0&&signals.flags.length===0)return null;
      return<AlignmentWidget
        signals={signals}
        compact={false}
        onAI={function(item){
          var FRAMING_MAP={
            challenge:{why:"ChatGPT has never seen your thesis. This prompt feeds it your specific arguments and asks it to attack them.",dataPoints:["Your thesis","Conviction history","KPIs","Decisions log"]},
            sell:{why:"This prompt takes your sell criteria — written when you were calm — and asks whether they have actually been triggered.",dataPoints:["Your sell criteria","Recent decisions","Journal entries","Conviction trajectory"]},
            annual:{why:"After months of ownership you have something no AI has seen: your own conviction trajectory and decisions. This asks if you should still own this.",dataPoints:["Conviction history","Decisions log","Journal entries","Original thesis"]},
          };
          var fr=FRAMING_MAP[item.aiType]||FRAMING_MAP["challenge"];
          setAiModal({title:(item.aiType==="sell"?"Sell Discipline Check":item.aiType==="annual"?"Annual Review":"Challenge My Thesis")+" — "+item.ticker,framing:fr,prompt:buildPrompt(item.aiType,item.c)});
        }}
        onGo={function(c){setSelId(c.id);setDetailTab("dossier");}}
        onSellCheck={function(c){setSellCheckTgt(c)}}
      />;
    }()}

    {/* View toggle */}
    {filtered.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{display:"flex",gap:4}}>
        {[{v:"fundamentals",label:"Fundamentals",icon:"chart"},{v:"list",label:"Holdings",icon:"file"},{v:"ledger",label:"Conviction Ledger",icon:"book"},{v:"cards",label:"Cards",icon:"overview"}].map(function(opt){var active=dashSet.portfolioView===opt.v||(opt.v==="fundamentals"&&!dashSet.portfolioView);return<button key={opt.v} onClick={function(){setDashSet(function(p){var n=Object.assign({},p,{portfolioView:opt.v});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}} style={{padding:"5px 10px",fontSize:11,fontFamily:fm,background:active?K.acc+"18":"transparent",color:active?K.acc:K.dim,border:"1px solid "+(active?K.acc+"40":K.bdr),borderRadius:_isBm?0:5,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
          <IC name={opt.icon} size={10} color={active?K.acc:K.dim}/>{opt.label}
        </button>})}
      </div>
      {(dashSet.portfolioView==="fundamentals"||!dashSet.portfolioView)&&!isMobile&&<button onClick={function(){
        var toRefresh=filtered.filter(function(c2){return c2.ticker});
        if(toRefresh.length===0)return;
        showToast("Refreshing fundamentals…","info",3000);
        toRefresh.forEach(function(c2,i){setTimeout(function(){fetchEarnings(c2,c2.kpis).then(function(res){if(res&&res.snapshot)upd(c2.id,{financialSnapshot:Object.assign({},c2.financialSnapshot,res.snapshot),lastChecked:new Date().toISOString()})})},i*800)});
      }} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:5,cursor:"pointer",padding:"4px 10px",display:"flex",alignItems:"center",gap:4,fontSize:10,color:K.dim,fontFamily:fm}}>
        <IC name="refresh" size={10} color={K.dim}/> Refresh fundamentals
      </button>}
    </div>}

    {/* ── FUNDAMENTALS VIEW ── */}
    {filtered.length>0&&sideTab!=="toohard"&&(dashSet.portfolioView==="fundamentals"||!dashSet.portfolioView)&&(function(){
      // ── Auto-refresh holdings missing key fundamentals ─────────────────────
      var _autoRef=useRef(false);
      useEffect(function(){
        if(_autoRef.current)return;
        _autoRef.current=true;
        var needsRefresh=filtered.filter(function(c2){
          var s=c2.financialSnapshot||{};
          // Missing ROIC or ND/EBITDA and hasn't been fetched in last 7 days
          var staleDays=c2.lastChecked?Math.ceil((Date.now()-new Date(c2.lastChecked))/864e5):999;
          return (s.roic==null||s.netDebtEbitda==null)&&staleDays>1;
        });
        if(needsRefresh.length===0)return;
        needsRefresh.forEach(function(c2,i){
          setTimeout(function(){
            fetchEarnings(c2,c2.kpis).then(function(res){
              if(res&&res.snapshot)upd(c2.id,{financialSnapshot:Object.assign({},c2.financialSnapshot,res.snapshot),lastChecked:new Date().toISOString()});
            }).catch(function(){});
          },i*800); // stagger to avoid rate limits
        });
      },[]);
      // ── Metric library ────────────────────────────────────────────────────
      var FUND_METRICS=[
        {id:"revGrowth",  label:"Rev Growth",  short:"Rev Gr",  unit:"%", cat:"Growth",   get:function(s){return s.revGrowth?s.revGrowth.numVal:null},  good:function(v){return v>=10}, ok:function(v){return v>=0},  fmt:function(v){return(v>=0?"+":"")+v.toFixed(1)+"%"}, tip:"Revenue growth YoY (TTM)"},
        {id:"epsGrowth",  label:"EPS Growth",  short:"EPS Gr",  unit:"%", cat:"Growth",   get:function(s){return s.epsGrowth?s.epsGrowth.numVal:null},  good:function(v){return v>=15},ok:function(v){return v>=0},  fmt:function(v){return(v>=0?"+":"")+v.toFixed(1)+"%"}, tip:"EPS growth YoY (TTM)"},
        {id:"grossMargin",label:"Gross Margin",short:"Gross M", unit:"%", cat:"Margins",  get:function(s){return s.grossMargin?s.grossMargin.numVal:null},good:function(v){return v>=40},ok:function(v){return v>=20}, fmt:function(v){return v.toFixed(1)+"%"},              tip:"Gross margin (TTM)"},
        {id:"opMargin",   label:"Op Margin",   short:"Op M",    unit:"%", cat:"Margins",  get:function(s){return s.opMargin?s.opMargin.numVal:null},     good:function(v){return v>=20},ok:function(v){return v>=8},  fmt:function(v){return v.toFixed(1)+"%"},              tip:"Operating margin (TTM)"},
        {id:"netMargin",  label:"Net Margin",  short:"Net M",   unit:"%", cat:"Margins",  get:function(s){return s.netMargin?s.netMargin.numVal:null},   good:function(v){return v>=15},ok:function(v){return v>=5},  fmt:function(v){return v.toFixed(1)+"%"},              tip:"Net profit margin (TTM)"},
        {id:"fcfMargin",  label:"FCF Margin",  short:"FCF M",   unit:"%", cat:"Margins",  get:function(s){return s.fcfMargin?s.fcfMargin.numVal:null},   good:function(v){return v>=15},ok:function(v){return v>=5},  fmt:function(v){return v.toFixed(1)+"%"},              tip:"Free cash flow margin"},
        {id:"roic",       label:"ROIC",        short:"ROIC",    unit:"%", cat:"Returns",  get:function(s){return s.roic?s.roic.numVal:null},             good:function(v){return v>=15},ok:function(v){return v>=8},  fmt:function(v){return v.toFixed(1)+"%"},              tip:"Return on invested capital"},
        {id:"roce",       label:"ROCE",        short:"ROCE",    unit:"%", cat:"Returns",  get:function(s){return s.roce?s.roce.numVal:null},             good:function(v){return v>=15},ok:function(v){return v>=8},  fmt:function(v){return v.toFixed(1)+"%"},              tip:"Return on capital employed"},
        {id:"roe",        label:"ROE",         short:"ROE",     unit:"%", cat:"Returns",  get:function(s){return s.roe?s.roe.numVal:null},               good:function(v){return v>=15},ok:function(v){return v>=8},  fmt:function(v){return v.toFixed(1)+"%"},              tip:"Return on equity"},
        {id:"fcfYield",   label:"FCF Yield",   short:"FCF Y",   unit:"%", cat:"Value",    get:function(s){return s.fcfYield?s.fcfYield.numVal:null},     good:function(v){return v>=5}, ok:function(v){return v>=2},  fmt:function(v){return v.toFixed(1)+"%"},              tip:"Free cash flow yield"},
        {id:"divYield",   label:"Div Yield",   short:"Div Y",   unit:"%", cat:"Value",    get:function(s){return s.divYield?s.divYield.numVal:null},     good:function(v){return v>=2}, ok:function(v){return v>=0.5},fmt:function(v){return v.toFixed(1)+"%"},              tip:"Dividend yield"},
        {id:"netDebtEbitda",label:"ND/EBITDA", short:"ND/EB",   unit:"x", cat:"Health",   get:function(s){return s.netDebtEbitda?s.netDebtEbitda.numVal:null},good:function(v){return v<1.5},ok:function(v){return v<3},fmt:function(v){return v.toFixed(1)+"x"},           tip:"Net Debt / EBITDA — lower is better",lowerBetter:true},
        {id:"debtEquity", label:"Debt/Equity", short:"D/E",     unit:"x", cat:"Health",   get:function(s){return s.debtEquity?s.debtEquity.numVal:null}, good:function(v){return v<0.5},ok:function(v){return v<1.5},fmt:function(v){return v.toFixed(1)+"x"},              tip:"Debt to equity — lower is better",lowerBetter:true},
        {id:"currentRatio",label:"Curr Ratio", short:"Curr R",  unit:"x", cat:"Health",   get:function(s){return s.currentRatio?s.currentRatio.numVal:null},good:function(v){return v>=2},ok:function(v){return v>=1},fmt:function(v){return v.toFixed(1)+"x"},             tip:"Current ratio"},
        {id:"pe",         label:"P/E",         short:"P/E",     unit:"x", cat:"Price",    get:function(s){return s.pe?parseFloat(String(s.pe.value).replace(/[^0-9.\-]/g,"")):null},good:function(v){return v>0&&v<18},ok:function(v){return v<30},fmt:function(v){return v.toFixed(1)+"x"},tip:"Price to earnings",lowerBetter:true},
      ];
      // Default column set: revGrowth, grossMargin, opMargin, roic, netDebtEbitda
      var DEFAULT_FUND_COLS=["revGrowth","grossMargin","opMargin","roic","netDebtEbitda"];
      var activeCols=(dashSet.fundCols||DEFAULT_FUND_COLS).map(function(id){return FUND_METRICS.find(function(m){return m.id===id})}).filter(Boolean);
      var _fcfgState=useState(false),showFundCfg=_fcfgState[0],setShowFundCfg=_fcfgState[1];
      var _fcfgPos=useState({top:0,right:0}),fundCfgPos=_fcfgPos[0],setFundCfgPos=_fcfgPos[1];

      // ── Color helper ──────────────────────────────────────────────────────
      function metricColor(m,v){if(v==null)return K.dim;if(m.good(v))return K.grn;if(m.ok(v))return K.amb;return K.red;}

      // ── Portfolio aggregate row (weighted by position value) ──────────────
      var totalVal2=filtered.reduce(function(s,c2){var p2=c2.position||{};return s+(p2.shares>0&&p2.currentPrice>0?p2.shares*p2.currentPrice:0)},0);
      var aggRow=(activeCols||[]).map(function(m){
        var wSum=0,wN=0;
        filtered.forEach(function(c2){
          var snap=c2.financialSnapshot||{};var v=m.get(snap);
          var p2=c2.position||{};var w=totalVal2>0&&p2.shares>0&&p2.currentPrice>0?(p2.shares*p2.currentPrice/totalVal2):1/filtered.length;
          if(v!=null){wSum+=v*w;wN+=w}
        });
        return wN>0?wSum/wN:null;
      });

      var COL_W=isMobile?54:68;
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden",marginBottom:28}}>
        {/* Table header */}
        <div style={{display:"flex",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid "+K.bdr,gap:0}}>
          <div style={{flex:1,minWidth:isMobile?90:120}}>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase"}}>Company</span>
          </div>
          {(activeCols||[]).map(function(m){return<div key={m.id} style={{width:COL_W,textAlign:"right",flexShrink:0}}>
            <span style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:.3,textTransform:"uppercase",whiteSpace:"nowrap"}} title={m.tip}>{m.short}</span>
          </div>})}
          <div style={{width:28,flexShrink:0,display:"flex",justifyContent:"flex-end",position:"relative"}}>
            {showFundCfg&&<div style={{position:"fixed",inset:0,zIndex:499}} onClick={function(){setShowFundCfg(false)}}/>}
            <button onClick={function(e){var r=e.currentTarget.getBoundingClientRect();setFundCfgPos({top:r.bottom+6,right:window.innerWidth-r.right});setShowFundCfg(!showFundCfg)}} style={{background:showFundCfg?K.acc+"15":"none",border:"1px solid "+(showFundCfg?K.acc+"40":K.bdr),borderRadius:_isBm?0:5,cursor:"pointer",padding:"3px 6px",display:"flex",alignItems:"center",gap:2}} title="Customize columns">
              <IC name="gear" size={10} color={showFundCfg?K.acc:K.dim}/>
            </button>
            {/* Column picker dropdown */}
            {showFundCfg&&<div style={{position:"fixed",right:fundCfgPos.right,top:fundCfgPos.top,background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 16px",boxShadow:"0 8px 32px rgba(0,0,0,.3)",zIndex:500,width:300,maxHeight:"min(500px,70vh)",overflowY:"auto",overflowX:"hidden"}} onClick={function(e){e.stopPropagation()}}>
              <div style={{fontSize:11,fontWeight:700,color:K.txt,marginBottom:10}}>Customize columns</div>
              <div style={{fontSize:10,color:K.dim,marginBottom:10}}>Pick up to 6 metrics for your look-through view</div>
              {["Growth","Margins","Returns","Value","Health","Price"].map(function(cat){
                var catMs=FUND_METRICS.filter(function(m){return m.cat===cat});
                return<div key={cat} style={{marginBottom:10}}>
                  <div style={{fontSize:9,letterSpacing:1,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:5}}>{cat}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                    {(catMs||[]).map(function(m){
                      var on=(dashSet.fundCols||DEFAULT_FUND_COLS).indexOf(m.id)>=0;
                      return<button key={m.id} title={m.tip} onClick={function(){
                        setDashSet(function(p){
                          var cur=p.fundCols||DEFAULT_FUND_COLS;
                          var next=on?cur.filter(function(x){return x!==m.id}):cur.length<6?cur.concat([m.id]):cur;
                          var n=Object.assign({},p,{fundCols:next});
                          try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n;
                        });
                      }} style={{padding:"4px 10px",borderRadius:_isBm?0:999,border:"1px solid "+(on?K.acc+"50":K.bdr),background:on?K.acc+"14":"transparent",color:on?K.acc:K.dim,fontSize:10,cursor:"pointer",fontFamily:fm,fontWeight:on?700:400}}>
                        {m.label}
                      </button>})}
                  </div>
                </div>})}
              <div style={{fontSize:9,color:K.dim,marginTop:8}}>{(dashSet.fundCols||DEFAULT_FUND_COLS).length}/6 selected · data via FMP</div>
            </div>}
          </div>
        </div>

        {/* Portfolio aggregate row */}
        {totalVal2>0&&<div style={{display:"flex",alignItems:"center",padding:"8px 16px",background:K.acc+"07",borderBottom:"2px solid "+K.bdr,gap:0}}>
          <div style={{flex:1,minWidth:isMobile?90:120}}>
            <div style={{fontSize:10,fontWeight:700,color:K.acc,fontFamily:fm}}>Portfolio avg</div>
            <div style={{fontSize:9,color:K.dim}}>weighted by value</div>
          </div>
          {(aggRow||[]).map(function(v,i){var m=activeCols[i];return<div key={m.id} style={{width:COL_W,textAlign:"right",flexShrink:0}}>
            {v!=null?<span style={{fontSize:12,fontWeight:700,color:metricColor(m,v),fontFamily:fm}}>{m.fmt(v)}</span>
            :<span style={{fontSize:11,color:K.dim}}>—</span>}
          </div>})}
          <div style={{width:28}}/>
        </div>}

        {/* Company rows */}
        {filtered.slice().sort(function(a,b){var va=(a.position&&a.position.shares>0&&a.position.currentPrice>0)?a.position.shares*a.position.currentPrice:0;var vb=(b.position&&b.position.shares>0&&b.position.currentPrice>0)?b.position.shares*b.position.currentPrice:0;return vb-va}).map(function(cc){
          var snap=cc.financialSnapshot||{};
          var convColor=cc.conviction>=7?K.grn:cc.conviction>=4?K.amb:cc.conviction>0?K.red:K.bdr;
          var hasAny=activeCols.some(function(m){return m.get(snap)!=null});
          return<div key={cc.id} style={{display:"flex",alignItems:"center",padding:isMobile?"10px 14px":"10px 16px",borderBottom:"1px solid "+K.bdr+"40",cursor:"pointer",transition:"background .1s",gap:0}}
            onClick={function(){setSelId(cc.id);setDetailTab("dossier")}}
            onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06"}}
            onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
            <div style={{flex:1,minWidth:isMobile?90:120,display:"flex",alignItems:"center",gap:8,overflow:"hidden"}}>
              <CoLogo domain={cc.domain} ticker={cc.ticker} size={isMobile?22:26}/>
              <div style={{minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:13,fontWeight:700,color:K.txt,fontFamily:fm}}>{cc.ticker}</span>
                  <div title={"Conviction: "+(cc.conviction||"unset")} style={{width:5,height:5,borderRadius:"50%",background:convColor,flexShrink:0}}/>
                </div>
                {!isMobile&&<div style={{fontSize:10,color:K.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>{cc.name}</div>}
              </div>
            </div>
            {(activeCols||[]).map(function(m){var v=m.get(snap);var color=metricColor(m,v);
              return<div key={m.id} style={{width:COL_W,textAlign:"right",flexShrink:0}}>
                {v!=null
                  ?<span style={{fontSize:isMobile?11:12,fontWeight:600,color:color,fontFamily:fm,background:color+"10",padding:"2px 6px",borderRadius:_isBm?0:4}}>{m.fmt(v)}</span>
                  :<span style={{fontSize:11,color:K.bdr,fontFamily:fm}}>{"—"}</span>}
              </div>})}
            {!isMobile&&<div style={{width:28,display:"flex",justifyContent:"flex-end"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="1.8" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>}
          </div>})}

        {/* No data nudge */}
        {filtered.length>0&&!filtered.some(function(c2){var s=c2.financialSnapshot||{};return activeCols.some(function(m){return m.get(s)!=null})})&&<div style={{padding:"16px 20px",textAlign:"center",fontSize:12,color:K.dim}}>
          No fundamental data yet. Tap a company → refresh financial data to populate.
        </div>}
      </div>
    })()}

    {/* Nordnet-style list view */}
    {filtered.length>0&&sideTab!=="toohard"&&dashSet.portfolioView==="list"&&(function(){
      var totalVal=filtered.reduce(function(s,cc){var p2=cc.position||{};return s+(p2.shares>0&&p2.currentPrice>0?p2.shares*p2.currentPrice:0)},0);
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden",marginBottom:28}}>
        <div style={{display:"flex",alignItems:"center",padding:"10px 20px",borderBottom:"2px solid "+K.bdr,fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",gap:0}}>
          <span style={{width:40}}/>
          <span style={{flex:1,minWidth:100}}>Company</span>
          <span style={{width:75,textAlign:"right"}}>{sideTab==="watchlist"?"Price":"Avg Price"}</span>
          <span style={{width:65,textAlign:"right"}}>{sideTab==="watchlist"?"Target":dashSet.businessMode?"Conv":"Ret / Day"}</span>
          {!isMobile&&<span style={{width:85,textAlign:"right"}}>{sideTab==="watchlist"?"Gap":"Value"}</span>}
          <span style={{width:isMobile?70:140,paddingLeft:8}}>{sideTab==="watchlist"?"Sector":"Allocation"}</span>
          {(function(){var oo=dashSet.listColOrder||["conviction","kpis","earnings","price","mastery"];var hw={conviction:{w:40,a:"center",l:"C"},kpis:{w:55,a:"right",l:"KPIs",d:true},earnings:{w:60,a:"right",l:"Earn.",d:true},price:{w:70,a:"right",l:"Price",d:true},mastery:{w:55,a:"center",l:"Mastery"}};return (oo||[]).map(function(k2){var h2=hw[k2];if(!h2)return null;if(!(dashSet.listCols||{})[k2])return null;if(h2.d&&isMobile)return null;return<span key={k2} style={{width:h2.w,textAlign:h2.a}}>{h2.l}</span>})})()}
          <span style={{width:isMobile?0:28,position:"relative",overflow:"hidden"}}>{!isMobile&&<button onClick={function(e){e.stopPropagation();setShowListCfg(!showListCfg)}} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><IC name="gear" size={12} color={K.dim}/></button>}
            {showListCfg&&<div style={{position:"absolute",right:0,top:22,background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"6px 0",boxShadow:"0 4px 16px rgba(0,0,0,.25)",zIndex:50,minWidth:150,textTransform:"none",letterSpacing:0}} onClick={function(e){e.stopPropagation()}}>
              <div style={{padding:"4px 12px 6px",fontSize:11,color:K.dim,fontWeight:600}}>Show columns</div>
              {(function(){var allCols=[{k:"conviction",l:"Conviction"},{k:"kpis",l:"KPI Status"},{k:"earnings",l:"Earnings"},{k:"price",l:"Current Price"},{k:"mastery",l:"Mastery Stars"}];
              var order=dashSet.listColOrder||(allCols||[]).map(function(c2){return c2.k});
              var sorted=(order||[]).map(function(k2){return allCols.find(function(c2){return c2.k===k2})}).filter(Boolean);
              allCols.forEach(function(c2){if(!sorted.find(function(s2){return s2.k===c2.k}))sorted.push(c2)});
              function moveCol(k2,dir){setDashSet(function(p){var o=p.listColOrder||(allCols||[]).map(function(c3){return c3.k});var idx2=o.indexOf(k2);if(idx2<0)return p;var ni=Math.max(0,Math.min(o.length-1,idx2+dir));if(ni===idx2)return p;var no=o.slice();no.splice(idx2,1);no.splice(ni,0,k2);var n=Object.assign({},p,{listColOrder:no});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}
              return (sorted||[]).map(function(col){return<div key={col.k} style={{padding:"5px 12px",fontSize:12,color:K.mid,fontFamily:fm,display:"flex",alignItems:"center",gap:6}}>
                <div onClick={function(){setDashSet(function(p){var lc=Object.assign({},p.listCols||{});lc[col.k]=!lc[col.k];var n=Object.assign({},p,{listCols:lc});try{localStorage.setItem("ta-dashSet",JSON.stringify(n))}catch(e){}return n})}} style={{width:12,height:12,borderRadius:_isBm?0:3,border:"1.5px solid "+((dashSet.listCols||{})[col.k]?K.acc:K.bdr),background:(dashSet.listCols||{})[col.k]?K.acc:"transparent",cursor:"pointer",flexShrink:0}}/>
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
              {dashSet.businessMode
                ?<div style={{fontSize:15,fontWeight:700,color:cc.conviction>=7?K.grn:cc.conviction>=4?K.amb:cc.conviction>0?K.red:K.dim,fontFamily:fm}}>{cc.conviction>0?cc.conviction+"/10":"—"}</div>
                :<div style={{fontSize:15,fontWeight:700,color:ret!=null?(ret>=0?K.grn:K.red):K.dim,fontFamily:fm}}>{ret!=null?(ret>=0?"+":"")+ret.toFixed(1)+"%":"—"}</div>}
              {!dashSet.businessMode&&(cc._dayChangePct||0)!==0&&<div style={{fontSize:11,fontWeight:600,color:(cc._dayChangePct||0)>=0?K.grn:K.red,fontFamily:fm}}>{(cc._dayChangePct||0)>=0?"+":""}{(cc._dayChangePct||0).toFixed(2)}% today</div>}
              <div style={{fontSize:11,color:K.mid,fontFamily:fm,marginTop:1}}>{weight>0?weight.toFixed(1)+"% alloc":"—"}</div></div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="1.8" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>}
          return<div key={cc.id} style={{display:"flex",alignItems:"center",padding:"10px 20px",borderBottom:"1px solid "+K.bdr+"50",cursor:"pointer",transition:"background .1s",gap:0}} onClick={function(){setSelId(cc.id);setDetailTab("dossier")}}
            onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"06"}} onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
            <span style={{width:40}}><CoLogo domain={cc.domain} ticker={cc.ticker} size={24}/></span>
            <span style={{flex:1,minWidth:100}}>
              <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm,display:"flex",alignItems:"center",gap:5}}>{cc.ticker}{cc.ivEstimate>0&&(function(){var iv=cc.ivEstimate;var cp=(cc.position||{}).currentPrice||0;if(!cp)return null;var mos=(iv-cp)/iv*100;var buyBelow=iv*(1-(cc.mosPct||30)/100);var col=cp<=buyBelow?K.grn:mos>0?K.amb:K.red;var lbl=cp<=buyBelow?"MoS":mos>0?mos.toFixed(0)+"%":"+"+Math.abs(mos).toFixed(0)+"%";return<span style={{fontSize:9,fontWeight:700,color:col,background:col+"15",border:"1px solid "+col+"30",borderRadius:_isBm?0:3,padding:"1px 5px",fontFamily:fm,flexShrink:0}}>{lbl}</span>})()}</div>
              <div style={{fontSize:11,color:K.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140}}>{cc.name}</div></span>
            <span style={{width:75,textAlign:"right",fontSize:12,color:K.mid,fontFamily:fm}}>{sideTab==="watchlist"?(p2.currentPrice>0?cSym+p2.currentPrice.toFixed(2):"—"):(p2.avgCost>0?cSym+p2.avgCost.toFixed(2):"—")}</span>
            <span style={{width:65,textAlign:"right",fontSize:12,fontFamily:fm}}>
              {sideTab==="watchlist"?(cc.targetPrice>0?<span style={{fontWeight:600,color:K.txt}}>{cSym}{cc.targetPrice.toFixed(0)}</span>:<span style={{color:K.dim}}>—</span>):
              dashSet.businessMode
              ?<div><div style={{fontWeight:700,color:cc.conviction>=7?K.grn:cc.conviction>=4?K.amb:cc.conviction>0?K.red:K.dim,fontSize:12}}>{cc.conviction>0?cc.conviction+"/10":"—"}</div>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{cc.thesisUpdatedAt?(Math.ceil((Date.now()-new Date(cc.thesisUpdatedAt))/864e5))+"d ago":"No thesis"}</div></div>
              :<div><div style={{fontWeight:700,color:ret!=null?(ret>=0?K.grn:K.red):K.dim,fontSize:12}}>{ret!=null?(ret>=0?"+":"")+ret.toFixed(1)+"%":"—"}</div>
              {(cc._dayChangePct||0)!==0&&<div style={{fontSize:10,color:(cc._dayChangePct||0)>=0?K.grn:K.red,fontFamily:fm}}>{(cc._dayChangePct||0)>=0?"+":""}{(cc._dayChangePct||0).toFixed(2)}%</div>}</div>}
            </span>
            {!isMobile&&<span style={{width:85,textAlign:"right",fontSize:12,fontFamily:fm}}>{sideTab==="watchlist"?(function(){if(!cc.targetPrice||!p2.currentPrice)return<span style={{color:K.dim}}>{"—"}</span>;var gap=((cc.targetPrice-p2.currentPrice)/p2.currentPrice*100);return<span style={{color:gap>0?K.grn:K.red,fontWeight:600}}>{gap>0?gap.toFixed(0)+"% below":"At target"}</span>})():<span style={{color:K.txt}}>{val>0?cSym+val.toLocaleString(undefined,{maximumFractionDigits:0}):"—"}</span>}</span>}
            <span style={{width:isMobile?70:140,paddingLeft:8}}>{sideTab==="watchlist"?<span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{cc.sector||""}</span>:weight>0?<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{flex:1,height:10,borderRadius:_isBm?0:5,background:K.blue+"18",overflow:"hidden"}}><div style={{height:"100%",width:Math.min(weight,100)+"%",borderRadius:_isBm?0:5,background:K.blue,transition:"width .4s"}}/></div><span style={{fontSize:10,color:K.blue,fontFamily:fm,fontWeight:600,minWidth:28,textAlign:"right"}}>{weight.toFixed(1)}%</span></div>:<div style={{height:10}}/>}</span>
            {(function(){var oo=dashSet.listColOrder||["conviction","kpis","earnings","price","mastery"];return (oo||[]).map(function(k2){if(!(dashSet.listCols||{})[k2])return null;
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
      {(filtered||[]).map(function(c,ci){var h=gH(c.kpis);var d=dU(c.earningsDate);var cs2=checkSt[c.id];var met=c.kpis.filter(function(k){return k.lastResult&&k.lastResult.status==="met"}).length;var total=c.kpis.filter(function(k){return k.lastResult}).length;var pos=c.position||{};
        var _snap=c.financialSnapshot||{};
        var _dayChg=c._dayChangePct||0;var _dayChgAbs=c._dayChangeAbs||0;
        var _totalRet=pos.avgCost>0&&pos.currentPrice>0?((pos.currentPrice-pos.avgCost)/pos.avgCost*100):null;
        var _tgtGap=c.targetPrice>0&&pos.currentPrice>0?((c.targetPrice-pos.currentPrice)/pos.currentPrice*100):null;
        var _mktVal=pos.shares>0&&pos.currentPrice>0?pos.shares*pos.currentPrice:0;
        var _graham=_snap.grahamNum?_snap.grahamNum.numVal:0;
        var _gDisc=_graham>0&&pos.currentPrice>0?((_graham-pos.currentPrice)/pos.currentPrice*100):null;
        var _fy=_snap.fairValue?_snap.fairValue.numVal:0;
        var _pvfv=_fy>0&&pos.currentPrice>0?((_fy-pos.currentPrice)/pos.currentPrice*100):null;
        return<div key={c.id} className="ta-card ta-fade" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px 24px",cursor:"pointer",position:"relative",animationDelay:Math.min(ci*40,400)+"ms"}} onClick={function(){setSelId(c.id);setDetailTab("dossier")}}>
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
          {_tgtGap!=null&&<span style={{fontSize:10,background:_tgtGap>0?K.grn+"12":K.red+"12",color:_tgtGap>0?K.grn:K.red,padding:"2px 7px",borderRadius:_isBm?0:4,fontFamily:fm,fontWeight:600}}>{_tgtGap>0?"↑":"↓"}{Math.abs(_tgtGap).toFixed(0)}% to target</span>}
          {_gDisc!=null&&Math.abs(_gDisc)<100&&<span style={{fontSize:10,background:_gDisc>0?K.grn+"10":K.amb+"10",color:_gDisc>0?K.grn:K.amb,padding:"2px 7px",borderRadius:_isBm?0:4,fontFamily:fm}}>{_gDisc>0?Math.abs(_gDisc).toFixed(0)+"% below Graham":""+Math.abs(_gDisc).toFixed(0)+"% above Graham"}</span>}
        </div>}
          {dashSet.showPositions&&pos.shares>0&&pos.avgCost>0&&pos.currentPrice>0&&<div style={{marginBottom:10,padding:"8px 12px",background:K.bg,borderRadius:_isBm?0:8}}>
            <div style={{display:"flex",gap:10,justifyContent:"space-between"}}>
              <span style={{fontSize:12,color:K.dim,fontFamily:fm}}>{pos.shares>=1000?(pos.shares/1000).toFixed(1)+"k":pos.shares} sh</span>
              <span style={{fontSize:12,fontWeight:700,color:_totalRet!=null&&_totalRet>=0?K.grn:K.red,fontFamily:fm}}>{_totalRet!=null?(_totalRet>=0?"+":"")+_totalRet.toFixed(1)+"%":"—"}</span>
              <span style={{fontSize:12,color:K.txt,fontFamily:fm,fontWeight:600}}>{cSym}{(_mktVal>=1000?(_mktVal/1000).toFixed(1)+"k":_mktVal.toFixed(0))}</span>
              {_dayChg!==0&&_dayChgAbs!==0&&<span style={{fontSize:11,color:_dayChg>=0?K.grn:K.red,fontFamily:fm}}>{_dayChg>=0?"+":""}{(pos.shares*_dayChgAbs).toFixed(0)} today</span>}
            </div>
          </div>}
          {/* Investment style + Moat type micro-badges — hidden on mobile */}
          {!isMobile&&c.investStyle&&STYLE_MAP[c.investStyle]&&<div style={{display:"flex",gap:4,marginBottom:8}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:600,color:STYLE_MAP[c.investStyle].color,background:STYLE_MAP[c.investStyle].color+"10",padding:"2px 7px",borderRadius:_isBm?0:3,fontFamily:fm}}><IC name={STYLE_MAP[c.investStyle].icon} size={10} color={STYLE_MAP[c.investStyle].color}/>{STYLE_MAP[c.investStyle].label}</span></div>}
          {!isMobile&&function(){var mt=c.moatTypes||{};var active=MOAT_TYPES.filter(function(t){return mt[t.id]&&mt[t.id].active});
            if(active.length===0)return null;
            return<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
              {active.slice(0,4).map(function(t){return<span key={t.id} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:t.color,background:t.color+"10",padding:"1px 6px",borderRadius:_isBm?0:3,fontFamily:fm}}>
                <IC name={t.icon} size={10} color={t.color}/>{t.label.split(" ")[0]}</span>})}</div>}()}
          {/* Progress Path — hidden on mobile */}
          {!isMobile&&(function(){var sec=parseThesis(c.thesisNote);var steps=[
            {id:"thesis",label:"Thesis",done:c.thesisNote&&c.thesisNote.trim().length>20,color:K.grn},
            {id:"kpis",label:"KPIs",done:c.kpis.length>=2,color:K.blue},
            {id:"conviction",label:"Conviction",done:c.conviction>0,color:K.amb},
            {id:"moat",label:"Moat",done:(function(){var mt=c.moatTypes||{};return Object.keys(mt).some(function(k){return mt[k]&&mt[k].active})})(),color:"#9333EA"},
            {id:"earnings",label:"Checked",done:c.lastChecked!=null,color:K.acc}];
            var completed=steps.filter(function(s){return s.done}).length;
            if(completed===5)return null; // Don't show if all complete
            return<div style={{display:"flex",alignItems:"center",gap:3,marginBottom:10}}>
              {(steps||[]).map(function(s,i){return React.createElement(React.Fragment,{key:s.id},
                <div style={{display:"flex",alignItems:"center",gap:3}} title={s.label+(s.done?" ✓":" — not done")}>
                  <div style={{width:16,height:16,borderRadius:"50%",background:s.done?s.color:K.bdr,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:s.done?"#fff":K.dim,fontWeight:700}}>{s.done?"✓":(i+1)}</div>
                  <span style={{fontSize:8,color:s.done?s.color:K.dim,fontFamily:fm}}>{s.label}</span></div>,
                i<4&&<div style={{width:8,height:1,background:s.done?s.color:K.bdr}}/>)})}</div>})()}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid "+K.bdr}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:d>=0&&d<=7?K.amb:K.dim,fontFamily:fm}}>{c.earningsDate==="TBD"?"TBD":(d<=0?"Reported":d+"d")}</span>
              {dashSet.showBuyZone&&c.targetPrice>0&&pos.currentPrice>0&&pos.currentPrice<=c.targetPrice&&<span style={{fontSize:10,fontWeight:600,color:K.grn,background:K.grn+"15",padding:"2px 6px",borderRadius:_isBm?0:3,fontFamily:fm}}>BUY ZONE</span>}
              {_snap.shareholderYield&&_snap.shareholderYield.numVal>0.5&&<span style={{fontSize:10,color:K.grn,fontFamily:fm,background:K.grn+"10",padding:"2px 6px",borderRadius:_isBm?0:3}}>{_snap.shareholderYield.value} yield</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              {total>0&&<span style={{fontSize:11,color:met===total&&total>0?K.grn:K.dim,fontFamily:fm,fontWeight:met===total&&total>0?700:400}}>{met}/{total} KPIs</span>}
              {total===0&&c.kpis.length>0&&<span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.kpis.length} KPIs</span>}
              {cs2==="checking"&&<span style={{fontSize:10,color:K.dim}}>⏳</span>}
            </div>
          </div></div>})}</div>}
    {/* Mastery Overview */}
    {sideTab==="portfolio"&&filtered.length>0&&(function(){
      var items=(filtered||[]).map(function(cc2){return{ticker:cc2.ticker,id:cc2.id,m:calcMastery(cc2),domain:cc2.domain}}).sort(function(a,b){return a.m.stars-b.m.stars});
      var avgStars=items.reduce(function(s2,i2){return s2+i2.m.stars},0)/Math.max(items.length,1);
      var mastered=items.filter(function(i2){return i2.m.stars>=6}).length;
      var nextSteps={"Added":"Write a thesis with core investment case, moat, risks, and sell criteria","Thesis":"Define 2+ KPIs and rate your conviction","Tracked":"Check earnings and classify the competitive moat","Monitored":"Log a decision and review your thesis (keep it fresh)","Disciplined":"Accumulate 3+ quarters of earnings data and conviction history"};
      return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:600,color:K.txt}}>Ownership Mastery</div>
          <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>{avgStars.toFixed(1)}/6 avg {mastered>0?" · "+mastered+" mastered":""}</div></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(items||[]).map(function(it){return<div key={it.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:_isBm?0:8,background:K.bg,cursor:"pointer",flexWrap:"wrap"}} onClick={function(){setSelId(it.id);setDetailTab("dossier")}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:"0 0 auto"}}>
              <CoLogo domain={it.domain} ticker={it.ticker} size={20}/>
              <span style={{fontSize:13,fontWeight:700,color:K.txt,fontFamily:fm,width:44,flexShrink:0}}>{it.ticker}</span>
              <div style={{display:"flex",gap:2,flexShrink:0}}>{[1,2,3,4,5,6].map(function(s2){return<svg key={s2} width="14" height="14" viewBox="0 0 12 12"><polygon points="6,0.5 7.8,4.2 12,4.7 8.8,7.5 9.7,11.5 6,9.3 2.3,11.5 3.2,7.5 0,4.7 4.2,4.2" fill={s2<=it.m.stars?it.m.color:K.bdr} stroke={s2<=it.m.stars?it.m.color:K.bdr} strokeWidth="0.5"/></svg>})}</div>
              <span style={{fontSize:11,fontWeight:600,color:it.m.color,fontFamily:fm,flexShrink:0}}>{it.m.label}</span>
            </div>
            {it.m.stars<6&&<span style={{fontSize:11,color:K.dim,flex:1,minWidth:isMobile?"100%":0,paddingLeft:isMobile?34:0,lineHeight:1.5}}>{nextSteps[it.m.label]||""}</span>}
            {it.m.stars>=6&&<span style={{fontSize:11,color:K.grn,flex:1,minWidth:isMobile?"100%":0,paddingLeft:isMobile?34:0}}>{"✓"} Full mastery</span>}
          </div>})}</div></div>})()}
    {sideTab==="portfolio"&&filtered.length>=2&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>
      {[{label:"Analytics",icon:"bar",color:K.acc,pg:"analytics",desc:"Moat scores & quality"},
        {label:"Earnings",icon:"target",color:K.amb,pg:"calendar",desc:"Upcoming & recent"},
        {label:"Dividends",icon:"dollar",color:K.grn,pg:"dividends",desc:"Income tracking"},
        {label:"Timeline",icon:"trending",color:K.blue,pg:"timeline",desc:"Your history"}
      ].map(function(lnk){return<div key={lnk.label} className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 14px",cursor:"pointer",textAlign:"center"}} onClick={function(){setSelId(null);setPage(lnk.pg)}}>
        <IC name={lnk.icon} size={16} color={lnk.color}/>
        <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,marginTop:4}}>{lnk.label}</div>
        <div style={{fontSize:10,color:K.dim}}>{lnk.desc}</div></div>})}</div>}
    {sideTab==="toohard"&&filtered.length>0&&(function(){
      var HARD_CHIPS=["Too complex to model","Outside circle of competence","Requires specialist knowledge","Valuation too opaque","Management concerns","Regulatory unpredictable","Commodity/macro-driven","Come back later"];
      var stale=filtered.filter(function(c){return c.parkedAt&&(new Date()-new Date(c.parkedAt))/864e5>180});
      return<div>
        <div style={{background:K.red+"08",border:"1px solid "+K.red+"20",borderRadius:_isBm?0:12,padding:"14px 20px",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:600,color:K.red,marginBottom:4}}>Circle of Competence</div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{"\u201cAcknowledging what you don\u2019t know is the dawning of wisdom.\u201d"} {filtered.length} {filtered.length===1?"company":"companies"} parked here.{stale.length>0?" \u2014 "+stale.length+" have been here 6+ months. Worth a second look?":""}</div>
        </div>
        {stale.length>0&&<div style={{background:K.amb+"08",border:"1px solid "+K.amb+"25",borderRadius:_isBm?0:10,padding:"11px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
          <IC name="clock" size={14} color={K.amb}/>
          <span style={{fontSize:13,color:K.amb,fontFamily:fm,fontWeight:600}}>{stale.length} entr{stale.length===1?"y":"ies"} older than 6 months</span>
          <span style={{fontSize:12,color:K.dim,flex:1}}>Has your understanding changed? Consider reconsidering.</span>
        </div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {(filtered||[]).map(function(c){
            var daysParked=c.parkedAt?Math.floor((new Date()-new Date(c.parkedAt))/864e5):null;
            var isStale=daysParked!==null&&daysParked>180;
            var tl=daysParked===null?"Unknown":daysParked<30?(daysParked+"d ago"):daysParked<365?(Math.floor(daysParked/30)+"mo ago"):(Math.floor(daysParked/365)+"yr "+Math.floor((daysParked%365)/30)+"mo ago");
            return<div key={c.id}
              onClick={function(){setSelId(c.id);setDetailTab("dossier")}}
              style={{background:K.card,border:"1px solid "+(isStale?K.amb+"50":K.bdr),borderRadius:_isBm?0:12,padding:"16px 20px",cursor:"pointer",transition:"transform .15s, box-shadow .15s, border-color .15s"}}
              onMouseEnter={function(e){if(!isMobile){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.12)";e.currentTarget.style.borderColor=K.acc+"40"}}}
              onMouseLeave={function(e){if(!isMobile){e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";e.currentTarget.style.borderColor=isStale?K.amb+"50":K.bdr}}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <CoLogo domain={c.domain} ticker={c.ticker} size={28}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
                    <span style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>{c.ticker}</span>
                    <span style={{fontSize:12,color:K.dim}}>{c.name}</span>
                    {c.sector&&<span style={{fontSize:11,color:K.dim,background:K.bg,padding:"1px 8px",borderRadius:_isBm?0:999,border:"1px solid "+K.bdr}}>{c.sector}</span>}
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
                          {(HARD_CHIPS||[]).map(function(r){return<button key={r} onClick={function(e){e.stopPropagation();upd(c.id,{tooHardReason:r})}} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:999,padding:"3px 10px",fontSize:11,color:K.mid,cursor:"pointer",fontFamily:fm}}>{r}</button>})}
                        </div>
                      </div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0,marginLeft:8}}>
                  <button onClick={function(e){e.stopPropagation();upd(c.id,{status:"watchlist",parkedAt:""});showToast(c.ticker+" moved to Watchlist","info",2000)}} style={{background:K.grn+"10",border:"1px solid "+K.grn+"30",borderRadius:_isBm?0:6,padding:"6px 12px",fontSize:12,color:K.grn,cursor:"pointer",fontFamily:fm,fontWeight:600,whiteSpace:"nowrap"}}>Reconsider \u2192</button>
                  <button onClick={function(e){e.stopPropagation();if(window.confirm("Remove "+c.ticker+"?"))setCos(function(p){return p.filter(function(x){return x.id!==c.id})})}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,padding:"6px 12px",fontSize:12,color:K.dim,cursor:"pointer",fontFamily:fm,whiteSpace:"nowrap"}}>Remove</button>
                </div>
              </div>
            </div>})}
        </div>
      </div>}())}
    {sideTab==="toohard"&&filtered.length===0&&<div style={{background:K.red+"08",border:"1px solid "+K.red+"20",borderRadius:_isBm?0:12,padding:"14px 20px",marginBottom:20}}><div style={{fontSize:13,fontWeight:600,color:K.red,marginBottom:4}}>Circle of Competence</div><div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{"\u201cAcknowledging what you don\u2019t know is the dawning of wisdom.\u201d"}</div></div>}
    {/* Empty state — warm welcome */}
    {filtered.length===0&&<div className="ta-fade" style={{padding:isMobile?"40px 4px 100px":"60px 20px",textAlign:"center",maxWidth:520,margin:"0 auto"}}>
      {sideTab==="portfolio"&&(function(){
        return<div>
          {/* Hero */}
          <div style={{marginBottom:isMobile?28:32}}>
            <div style={{width:64,height:64,borderRadius:_isBm?0:20,background:"linear-gradient(135deg,"+K.acc+"30,"+K.acc+"08)",border:"1px solid "+K.acc+"30",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><IC name="trending" size={28} color={K.acc}/></div>
            <h3 style={{fontSize:isMobile?22:24,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 10px",lineHeight:1.25}}>{"Think like an owner."}</h3>
            <p style={{fontSize:isMobile?14:14,color:K.dim,lineHeight:1.7,margin:"0 auto",maxWidth:360}}>{"Your first company takes 3 minutes to set up. Thesis, KPIs, and a plan — then you're in the system."}</p>
          </div>
          {/* 3-step path */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28,textAlign:"left",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:16,padding:isMobile?"18px 16px":"20px 24px"}}>
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
          <button onClick={function(){setObStep(1)}} style={Object.assign({},S.btnP,{width:"100%",padding:isMobile?"14px":"12px 24px",fontSize:15,borderRadius:_isBm?0:12,marginBottom:10})}>{"Get started →"}</button>
          <button onClick={function(){
              var sampleWithFlag=(SAMPLE||[]).map(function(s){return Object.assign({},s,{_isSample:true})});
              setCos(sampleWithFlag);
              try{localStorage.setItem("ta-onboarded","true")}catch(e){}
              setTimeout(function(){setSelId(SAMPLE[0].id);setDetailTab("dossier")},100)
            }} style={{display:"block",width:"100%",background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,color:K.dim,fontSize:13,cursor:"pointer",padding:isMobile?"12px":"10px",fontFamily:fb}}>{"Explore with example portfolio →"}</button>
        </div>
      })()}
      {sideTab==="watchlist"&&<div>
        <div style={{width:56,height:56,borderRadius:_isBm?0:16,background:K.acc+"12",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><IC name="search" size={24} color={K.acc}/></div>
        <h3 style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 8px"}}>{"Nothing on your watchlist yet"}</h3>
        <p style={{fontSize:14,color:K.dim,lineHeight:1.7,margin:"0 0 24px",maxWidth:340,marginLeft:"auto",marginRight:"auto"}}>{"Add companies you're researching but haven't bought yet. When the thesis is clear and price is right, promote them to your portfolio."}</p>
        <button onClick={function(){setModal({type:"add"})}} style={Object.assign({},S.btnP,{padding:"10px 24px",fontSize:14,borderRadius:_isBm?0:10})}>{"+ Add to Watchlist"}</button>
      </div>}
      {sideTab==="toohard"&&<div>
        <div style={{width:56,height:56,borderRadius:_isBm?0:16,background:K.red+"12",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><IC name="alert" size={24} color={K.red}/></div>
        <h3 style={{fontSize:20,fontWeight:700,color:K.txt,fontFamily:fh,margin:"0 0 8px"}}>{"Too-Hard Pile is empty"}</h3>
        <p style={{fontSize:14,color:K.dim,lineHeight:1.7,margin:"0 0 4px",maxWidth:340,marginLeft:"auto",marginRight:"auto"}}>{"Companies outside your circle of competence. It takes wisdom to know what you don't know."}</p>
        <p style={{fontSize:13,color:K.dim,fontStyle:"italic",margin:"0 0 24px"}}>{"— Munger"}</p>
      </div>}
    </div>}
    {sideTab==="portfolio"&&filtered.length>0&&(dashSet.showHeatmap||dashSet.showSectors||dashSet.showDividends)&&<div style={{marginBottom:28}}>
      {/* Portfolio Heatmap */}
      {dashSet.showHeatmap&&function(){var withPrice=filtered.filter(function(c){var p=c.position||{};return p.currentPrice>0&&p.avgCost>0&&p.shares>0});
        if(withPrice.length<2)return null;
        return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px 24px",marginBottom:16}}>
          <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:14,fontFamily:fm}}>Portfolio Heatmap</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {withPrice.sort(function(a,b){return(b.position.shares*b.position.currentPrice)-(a.position.shares*a.position.currentPrice)}).map(function(c2){
              var pos2=c2.position;var pct=(pos2.currentPrice-pos2.avgCost)/pos2.avgCost*100;var val=pos2.shares*pos2.currentPrice;
              var totalVal=withPrice.reduce(function(s,x){return s+(x.position.shares*x.position.currentPrice)},0);var weight=val/totalVal*100;
              var clr=pct>=20?"#00C853":pct>=5?"#66BB6A":pct>=0?"#A5D6A7":pct>=-10?"#EF9A9A":pct>=-20?"#EF5350":"#C62828";
              var minW=Math.max(60,weight*3);
              return<div key={c2.id} onClick={function(){setSelId(c2.id)}} style={{background:clr+"20",border:"1px solid "+clr+"40",borderRadius:_isBm?0:6,padding:"8px 12px",cursor:"pointer",minWidth:minW,flex:weight>15?"1 1 "+minW+"px":"0 1 "+minW+"px"}}>
                <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{c2.ticker}</div>
                <div style={{fontSize:14,fontWeight:700,color:clr,fontFamily:fm}}>{pct>=0?"+":""}{pct.toFixed(1)}%</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{weight.toFixed(0)}% of portfolio</div></div>})}</div></div>}()}
      <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:(dashSet.showSectors&&dashSet.showDividends)?"1fr 1fr":"1fr",gap:16}}>
      {/* Sector Concentration (value-weighted) */}
      {dashSet.showSectors&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px 24px"}}>
        <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,marginBottom:14,fontFamily:fm}}>Sector Concentration</div>
        {function(){var sectorVal={};var totalVal=0;
          filtered.forEach(function(c2){var s=c2.sector||"Other";var pos2=c2.position||{};var val=pos2.shares>0&&pos2.currentPrice>0?pos2.shares*pos2.currentPrice:0;sectorVal[s]=(sectorVal[s]||0)+val;totalVal+=val});
          var useValue=totalVal>0;
          return Object.keys(useValue?sectorVal:sectors).sort(function(a,b){return(useValue?sectorVal[b]-sectorVal[a]:sectors[b]-sectors[a])}).map(function(s){
            var pct=useValue?Math.round(sectorVal[s]/totalVal*100):Math.round(sectors[s]/filtered.length*100);
            var warn=pct>=50;
            return<div key={s} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:K.mid}}>{s}</span><span style={{fontSize:12,color:warn?K.amb:K.dim,fontWeight:warn?600:400,fontFamily:fm}}>{pct}%{warn?" ⚠":""}</span></div>
              <div style={{height:4,borderRadius:_isBm?0:2,background:K.bdr}}><div style={{height:"100%",width:pct+"%",borderRadius:_isBm?0:2,background:warn?K.amb:K.acc}}/></div></div>})}()}</div>}
      {/* Dividends */}
      {dashSet.showDividends&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px 24px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm}}>Dividend Dashboard</div>
          <button onClick={function(){setPage("dividends")}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:20,padding:"3px 10px",fontSize:11,color:K.acc,cursor:"pointer",fontFamily:fm,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>Full Hub →</button>
        </div>
        {divCos.length===0&&<div style={{fontSize:13,color:K.dim,padding:"16px 0",textAlign:"center"}}>No dividend-paying holdings detected.<br/><span style={{fontSize:12}}>Dividend data is auto-fetched when you add companies.</span></div>}
        {divCos.length>0&&(function(){
          var totalVal3=divCos.reduce(function(s2,c2){var p2=c2.position||{};return s2+(p2.shares||0)*(p2.currentPrice||0)},0);
          var portYield=totalVal3>0?totalAnnualDiv/totalVal3*100:0;
          var monthlyInc=totalAnnualDiv/12;
          // Per-holding breakdown
          var holdings=(divCos||[]).map(function(c2){var p2=c2.position||{};var dps=c2.divPerShare||c2.lastDiv||0;
            var mult=c2.divFrequency==="monthly"?12:c2.divFrequency==="semi"?2:c2.divFrequency==="annual"?1:4;
            var annDiv2=dps*mult;var yld=p2.currentPrice?annDiv2/p2.currentPrice*100:0;
            var yoc=p2.avgCost>0?annDiv2/p2.avgCost*100:0;var annPay=(p2.shares||0)*annDiv2;
            var paySnap=c2.financialSnapshot&&c2.financialSnapshot.payoutRatio;
            var payoutPct=paySnap?parseFloat((paySnap.value||"0").replace(/[^0-9.]/g,""))||0:0;
            return{id:c2.id,ticker:c2.ticker,domain:c2.domain,dps:dps,freq:c2.divFrequency,annDiv:annDiv2,yield:yld,yoc:yoc,annPay:annPay,shares:p2.shares||0,exDiv:c2.exDivDate||"",payout:payoutPct}}).sort(function(a,b){return b.annPay-a.annPay});
          // Monthly income chart (estimate based on frequency)
          var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          var monthlyArr=(months||[]).map(function(){return 0});
          holdings.forEach(function(h2){if(h2.shares<=0)return;
            var payMonths=estimatePayMonths({divFrequency:h2.freq,exDivDate:h2.exDiv});
            payMonths.forEach(function(mi){monthlyArr[mi]+=h2.dps*h2.shares})});
          var maxMonth=Math.max.apply(null,monthlyArr)||1;
          // Upcoming ex-div dates
          var upcoming2=holdings.filter(function(h2){return h2.exDiv&&new Date(h2.exDiv)>=new Date()}).sort(function(a,b){return a.exDiv>b.exDiv?1:-1});
          return<div>
            {/* Summary cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:8}}>
              <div style={{padding:"12px 14px",background:K.bg,borderRadius:_isBm?0:8,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:K.grn,fontFamily:fm}}>${totalAnnualDiv.toFixed(0)}</div>
                <div style={{fontSize:8,color:K.dim}}>Est. Annual Income</div></div>
              <div style={{padding:"12px 14px",background:K.bg,borderRadius:_isBm?0:8,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:K.acc,fontFamily:fm}}>{portYield.toFixed(2)}%</div>
                <div style={{fontSize:8,color:K.dim}}>Portfolio Yield</div></div>
              <div style={{padding:"12px 14px",background:K.bg,borderRadius:_isBm?0:8,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:K.txt,fontFamily:fm}}>${monthlyInc.toFixed(0)}</div>
                <div style={{fontSize:8,color:K.dim}}>Monthly (avg)</div></div></div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fb,marginBottom:14,display:"flex",alignItems:"center",gap:5}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:K.grn,display:"inline-block",flexShrink:0}}/>
              Live — same data as Dividend Hub. <span style={{color:K.acc,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted"}} onClick={function(){setPage("dividends")}}>Update ex-div dates there.</span>
            </div>
            {!isPro&&<div style={{fontSize:11,color:K.acc,marginBottom:12,textAlign:"center",cursor:"pointer"}} onClick={function(){setShowUpgrade(true);setUpgradeCtx("dividends")}}>Upgrade for monthly income chart, yield on cost, payout safety analysis</div>}
            {/* Monthly income chart */}
            {isPro&&<div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:6}}>Monthly Income Estimate</div>
              <div style={{display:"flex",gap:3,alignItems:"flex-end",height:60}}>
                {(monthlyArr||[]).map(function(v2,mi){return<div key={mi} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{width:"100%",height:Math.max(v2/maxMonth*50,2),borderRadius:_isBm?0:3,background:v2>0?K.grn:K.bdr,marginBottom:3}}/>
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
              {(holdings||[]).map(function(h2){var safeColor=h2.payout>0?(h2.payout<60?K.grn:h2.payout<80?K.amb:K.red):K.dim;
                return<div key={h2.id} style={{display:"flex",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+K.bdr+"30",gap:0,cursor:"pointer"}} onClick={function(){setSelId(h2.id);setDetailTab("dossier");setPage("dashboard")}}>
                  <span style={{width:28}}><CoLogo domain={h2.domain} ticker={h2.ticker} size={18}/></span>
                  <span style={{flex:1}}><span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{h2.ticker}</span></span>
                  <span style={{width:55,textAlign:"right",fontSize:11,color:K.mid,fontFamily:fm}}>${h2.dps.toFixed(2)}/{h2.freq==="monthly"?"mo":h2.freq==="semi"?"semi":h2.freq==="annual"?"yr":"q"}</span>
                  <span style={{width:50,textAlign:"right",fontSize:11,color:K.grn,fontFamily:fm}}>{h2.yield.toFixed(1)}%</span>
                  {isPro&&<span style={{width:50,textAlign:"right",fontSize:11,color:h2.yoc>h2.yield?K.grn:K.txt,fontFamily:fm}}>{h2.yoc>0?h2.yoc.toFixed(1)+"%":"--"}</span>}
                  <span style={{width:60,textAlign:"right",fontSize:11,fontWeight:600,color:K.grn,fontFamily:fm}}>{h2.shares>0?"$"+h2.annPay.toFixed(0):"--"}</span>
                  {isPro&&<span style={{width:50,textAlign:"right",fontSize:11,color:safeColor,fontFamily:fm}}>{h2.payout>0?h2.payout.toFixed(0)+"%":"--"}</span>}</div>})}</div>
            {/* Upcoming ex-div dates */}
            {upcoming2.length>0&&<div style={{padding:"10px 12px",background:K.bg,borderRadius:_isBm?0:8,marginBottom:8}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:6}}>Upcoming Ex-Dividend Dates</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {upcoming2.slice(0,5).map(function(h2){var dU2=Math.ceil((new Date(h2.exDiv)-new Date())/864e5);return<div key={h2.ticker} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",borderRadius:_isBm?0:4,border:"1px solid "+K.amb+"25",background:K.amb+"06"}}>
                  <span style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm}}>{h2.ticker}</span>
                  <span style={{fontSize:10,color:K.amb,fontFamily:fm}}>{dU2<=0?"Today":dU2+"d"}</span></div>})}</div></div>}
            {/* Yield on cost explanation */}
            <div style={{fontSize:10,color:K.dim,lineHeight:1.5,padding:"6px 0"}}>YOC = Yield on Cost (annual dividend / your purchase price). Higher YOC than current yield means the dividend has grown since you bought. Payout ratio under 60% is generally considered safe.</div>
          </div>})()}
      </div>}</div></div>}
    </div>}
