"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { DARK, THEMES, METRIC_MAP, INVEST_STYLES, STYLE_MAP, INVESTOR_PROFILES, PROFILE_MAP, SUPERINVESTORS, MSTAR_RATINGS, FOLDERS } from "./constants";
import { calcMastery, calcOwnerScore, classifyPortfolio, dU, fD, fT, nId, gH, bT, eS, autoFormat } from "./utils";

export default function TopBar({
  cos,
  page,
  setPage,
  setSelId,
  setDetailTab,
  setSubPage,
  setModal,
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
  TLogo,
  CoLogo,
  Modal,
  Inp,
  Sel,
  username,
  streakData,
  notifs,
  setNotifs,
  isPro,
  setShowUpgrade,
  setUpgradeCtx,
  showToast,
  checkMilestone,
  logJournalEntry,
  toggleTheme,
  upd
  avatarUrl,
  plan,
  showProfile,
  setShowProfile,
  setShowQLetter,
  setSideOpen,
}) {
  var unread = (notifs || []).filter(function(n){return !n.read}).length;
  var bm = theme === "bloomberg";
    if(isMobile){return<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",height:54,borderBottom:"1px solid "+K.bdr,background:K.card+"f0",backdropFilter:_isBm?"none":"blur(12px)",position:"sticky",top:0,zIndex:50}}>
      {/* Left — hamburger */}
      <button onClick={function(){setSideOpen(true)}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:36,height:36,flexShrink:0}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      {/* Centre — logo + wordmark */}
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={function(){setSelId(null);setPage("dashboard")}}>
        <TLogo size={24} dark={isDark}/>
        <span style={{fontSize:bm?11:15,fontWeight:bm?700:800,color:bm?"#F39F41":K.txt,fontFamily:fm,letterSpacing:bm?"3px":"-0.3px",textTransform:bm?"uppercase":"none"}}>ThesisAlpha</span></div>
      {/* Right — notifications + avatar only */}
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{position:"relative",cursor:"pointer",padding:4}} onClick={function(){setShowNotifs(!showNotifs);if(!showNotifs)setNotifs(function(p){return p.map(function(n){return Object.assign({},n,{read:true})})})}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={unread>0?K.txt:K.dim} strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {unread>0&&<div style={{position:"absolute",top:2,right:2,width:_isBm?6:8,height:_isBm?6:8,borderRadius:_isBm?1:"50%",background:K.grn,border:"2px solid "+K.card}}/>}</div>
        <div style={{position:"relative",cursor:"pointer"}} onClick={function(){setShowProfile(!showProfile)}}>
          {avatarUrl?<img src={avatarUrl} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",border:"2px solid "+K.acc}}/>
            :<div style={{width:34,height:34,borderRadius:"50%",background:K.acc+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:K.acc,fontWeight:700,fontFamily:fm,border:"2px solid "+K.acc+"40"}}>{(username||props.user||"U")[0].toUpperCase()}</div>}</div></div>
      {showNotifs&&<div style={{position:"fixed",inset:0,zIndex:99}} onClick={function(){setShowNotifs(false)}}/>}
      {showNotifs&&<div className="ta-notif-panel" style={{position:"fixed",top:62,left:12,right:12,maxHeight:"70vh",overflowY:"auto",background:K.card,border:"1px solid "+K.bdr2,borderRadius:_isBm?0:16,boxShadow:"0 16px 48px rgba(0,0,0,.3)",zIndex:100}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>Notifications</span>{notifs.length>0&&<button style={Object.assign({},S.btn,{padding:"4px 12px",fontSize:12})} onClick={function(){setNotifs([])}}>Clear</button>}</div>
        {notifs.length===0?<div style={{padding:"36px 18px",textAlign:"center",fontSize:14,color:K.dim}}>No notifications</div>:notifs.slice(0,15).map(function(n){return<div key={n.id} style={n.type==="quarterly"?{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,cursor:"pointer",background:"linear-gradient(135deg,#D4AF3712,transparent)",borderLeft:"3px solid #D4AF37"}:{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"flex-start",gap:10}} onClick={function(){if(n.type==="email-alert"){var fresh=cos.find(function(c){return c.ticker===n.ticker});if(fresh)sendEarningsEmail(fresh);setNotifs(function(p){return p.filter(function(x){return x.id!==n.id})})}else if(n.type==="quarterly"){setShowQLetter(n.qKey);setShowNotifs(false);}}}>
          {n.type==="quarterly"?<div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:_isBm?0:8,background:"#D4AF3720",border:"1px solid #D4AF3740",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,7 12,13 2,7"/></svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:"#D4AF37",fontFamily:fm,marginBottom:2}}>{"Your "+n.qKey+" Letter is ready"}</div>
              <div style={{fontSize:13,color:K.mid,lineHeight:1.5}}>{"Your quarterly owner's letter has arrived."}</div>
              <div style={{fontSize:11,color:K.dim,marginTop:4}}>{fT(n.time)}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="1.8"><polyline points="9 18 15 12 9 6"/></svg>
          </div>:<div style={{display:"flex",alignItems:"flex-start",gap:10}}>
            <div style={{width:_isBm?6:8,height:_isBm?6:8,borderRadius:_isBm?1:"50%",background:n.type==="found"?K.grn:n.type==="upcoming"?K.amb:n.type==="ready"?K.blue:n.type==="system"?K.acc:n.type==="price-alert"?"#9333EA":n.type==="milestone"?"#FFD700":n.type==="email-alert"?K.blue:K.dim,flexShrink:0,marginTop:5}}/><div><div style={{fontSize:14,color:K.txt,fontFamily:fm}}><strong>{n.ticker}</strong> <span style={{color:K.mid,fontWeight:400}}>{n.msg}</span></div><div style={{fontSize:12,color:K.dim,marginTop:4}}>{fT(n.time)}</div></div>
          </div>}</div>})}
      </div>}
    </div>}
    return<div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:bm?"6px 16px":"12px 32px",borderBottom:"1px solid "+K.bdr,background:bm?K.bg:K.card+"e6",backdropFilter:_isBm?"none":"blur(12px)",position:"sticky",top:0,zIndex:50,gap:12}}>
    {["thesis_dark","thesis_light","dark","light"].indexOf(theme)>=0&&<button onClick={toggleTheme} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}} title={theme==="light"?"Light":"Dark"+(theme==="forest"?" Forest":"")+(theme==="purple"?" Purple":"")+(((streakData.current||0)<1&&(theme==="dark"||theme==="light"))?" — streak 1 wk to unlock more themes":"")}>{isDark?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}</button>}
    <div style={{position:"relative",cursor:"pointer",padding:4}} onClick={function(){setShowNotifs(!showNotifs);if(!showNotifs)setNotifs(function(p){return p.map(function(n){return Object.assign({},n,{read:true})})})}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={unread>0?K.mid:K.dim} strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      {unread>0&&<div style={{position:"absolute",top:1,right:1,width:_isBm?6:8,height:_isBm?6:8,borderRadius:_isBm?1:"50%",background:K.grn,border:"2px solid "+K.card}}/>}</div>
    {showNotifs&&<div style={{position:"fixed",inset:0,zIndex:99}} onClick={function(){setShowNotifs(false)}}/>}
    {showNotifs&&<div className="ta-notif-panel" style={{position:"absolute",top:48,right:32,width:380,maxHeight:420,overflowY:"auto",background:K.card,border:"1px solid "+K.bdr2,borderRadius:_isBm?0:12,boxShadow:"0 16px 48px rgba(0,0,0,.3)",zIndex:100}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Notifications</span>{notifs.length>0&&<button style={Object.assign({},S.btn,{padding:"2px 8px",fontSize:11})} onClick={function(){setNotifs([])}}>Clear</button>}</div>
      {notifs.length===0?<div style={{padding:"36px 18px",textAlign:"center",fontSize:13,color:K.dim}}>No notifications</div>:notifs.slice(0,15).map(function(n){return<div key={n.id} style={n.type==="quarterly"?{padding:"14px 18px",borderBottom:"1px solid "+K.bdr,cursor:"pointer",background:"linear-gradient(135deg,#D4AF3712,transparent)",borderLeft:"3px solid #D4AF37"}:{padding:"12px 18px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"flex-start",gap:10,cursor:n.type==="email-alert"?"pointer":"default"}} onClick={function(){if(n.type==="email-alert"){var fresh=cos.find(function(c){return c.ticker===n.ticker});if(fresh)sendEarningsEmail(fresh);setNotifs(function(p){return p.filter(function(x){return x.id!==n.id})})}else if(n.type==="quarterly"){setShowQLetter(n.qKey);setShowNotifs(false);}}}>
        {n.type==="quarterly"?<div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:_isBm?0:8,background:"#D4AF3720",border:"1px solid #D4AF3740",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,7 12,13 2,7"/></svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"#D4AF37",fontFamily:fm,marginBottom:2}}>{"Your "+n.qKey+" Letter is ready"}</div>
            <div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{"Your quarterly owner's letter has arrived. Tap to read."}</div>
            <div style={{fontSize:11,color:K.dim,marginTop:4}}>{fT(n.time)}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="1.8"><polyline points="9 18 15 12 9 6"/></svg>
        </div>:<div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{width:_isBm?6:8,height:_isBm?6:8,borderRadius:_isBm?1:"50%",background:n.type==="found"?K.grn:n.type==="upcoming"?K.amb:n.type==="ready"?K.blue:n.type==="system"?K.acc:n.type==="price-alert"?"#9333EA":n.type==="milestone"?"#FFD700":n.type==="email-alert"?K.blue:K.dim,flexShrink:0,marginTop:4}}/><div><div style={{fontSize:13,color:K.txt,fontFamily:fm}}><strong>{n.ticker}</strong> <span style={{color:K.mid,fontWeight:400}}>{n.msg}</span>{n.type==="email-alert"&&<span style={{fontSize:11,color:K.blue,marginLeft:6}}>Send email</span>}</div><div style={{fontSize:11,color:K.dim,marginTop:3}}>{fT(n.time)}</div></div>
        </div>}</div>})}</div>}
    <button onClick={function(){setModal({type:"settings"})}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34}} title="Dashboard Settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
    <button onClick={function(){props.onLogout()}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,color:K.dim}} title="Log out"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
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
      {adding&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginBottom:12}}>
        <Inp label="URL" value={url} onChange={setUrl} placeholder="https://..." K={K}/>
        <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Label (optional)" value={label} onChange={setLabel} placeholder="Article title" K={K}/><Sel label="Type" value={cat} onChange={setCat} options={cats} K={K}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={Object.assign({},S.btnP,{opacity:url.trim()?1:.4})} onClick={addLink}>Add</button></div></div>}
      {links.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.acc+"25",borderRadius:_isBm?0:14,padding:"24px 20px",textAlign:"center"}}>
      <div style={{width:36,height:36,borderRadius:_isBm?0:10,background:K.acc+"10",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="1.8" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </div>
      <div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:3}}>{"No links saved for "+c.ticker}</div>
      <div style={{fontSize:11,color:K.dim,marginBottom:12,lineHeight:1.5}}>Bookmark articles, reports, investor letters, podcasts.</div>
      <button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:11})} onClick={function(){setAdding(true)}}>+ Add link</button>
    </div>}
      {links.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
        {links.map(function(l,i){return<div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<links.length-1?"1px solid "+K.bdr:"none"}}>
          <IC name={catIcons[l.category]||"link"} size={14} color={K.dim}/>
          <a href={l.url} target="_blank" rel="noreferrer" style={{flex:1,fontSize:13,color:K.blue,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.label}</a>
          <span style={{fontSize:10,color:K.dim,fontFamily:fm,whiteSpace:"nowrap"}}>{l.category}</span>
          <button onClick={function(){removeLink(l.id)}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:13,padding:2,opacity:.5}}>{"✕"}</button></div>})}</div>}</div>}

  // ── Research Journal (structured card system) ──
  var CARD_STYLES={decision:{icon:"edit",color:"#3B82F6",label:"Decision"},earnings_review:{icon:"bar",color:"#F59E0B",label:"Earnings Review"},thesis_snapshot:{icon:"lightbulb",color:"#8B5CF6",label:"Thesis Update"},conviction_shift:{icon:"trending",color:"#EC4899",label:"Conviction Shift"},note:{icon:"file",color:"#6B7280",label:"Note"}};
  function JournalCard(p){var d=p.entry;var ct=CARD_STYLES[d.cardType]||CARD_STYLES.note;var actionColors={BUY:K.grn,SELL:K.red,HOLD:K.amb,TRIM:K.red,ADD:K.grn,PASS:K.dim};
    return<div style={{background:K.card,border:"1px solid "+K.bdr,borderLeft:"3px solid "+ct.color,borderRadius:_isBm?0:10,padding:"14px 18px",marginBottom:10}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div style={{width:24,height:24,borderRadius:_isBm?0:6,background:ct.color+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><IC name={ct.icon} size={12} color={ct.color}/></div>
        <span style={{fontSize:11,fontWeight:700,color:ct.color,fontFamily:fm,letterSpacing:1,textTransform:"uppercase"}}>{ct.label}</span>
        {d.ticker&&<span style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm}}>{d.ticker}</span>}
        {d.action&&d.cardType==="decision"&&<span style={{fontSize:10,fontWeight:700,color:actionColors[d.action]||K.txt,background:(actionColors[d.action]||K.dim)+"15",padding:"2px 6px",borderRadius:_isBm?0:3,fontFamily:fm}}>{d.action}</span>}
        {d.outcome&&<span style={{fontSize:10,fontWeight:600,color:d.outcome==="right"?K.grn:d.outcome==="wrong"?K.red:K.amb,fontFamily:fm,background:(d.outcome==="right"?K.grn:d.outcome==="wrong"?K.red:K.amb)+"12",padding:"1px 6px",borderRadius:_isBm?0:3}}>{d.outcome}</span>}
        <span style={{marginLeft:"auto",fontSize:10,color:K.dim,fontFamily:fm}}>{d.date?new Date(d.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):""}</span></div>
      {/* ── DECISION CARD ── */}
      {d.cardType==="decision"&&<div>
        {/* Auto-context row */}
        {(d.priceAtTime||d.convictionAtTime>0)&&<div style={{display:"flex",gap:12,marginBottom:8,padding:"6px 10px",background:K.bg,borderRadius:_isBm?0:6,fontSize:11,color:K.dim,fontFamily:fm}}>
          {d.priceAtTime>0&&<span>Price: ${d.priceAtTime}</span>}
          {d.convictionAtTime>0&&<span>Conviction: {d.convictionAtTime}/10</span>}
          {d.timeHorizon&&<span>{d.timeHorizon==="short"?"<1yr":d.timeHorizon==="medium"?"1-3yr":"3-10yr"}</span>}
          {d.shares&&<span>{d.shares} shares</span>}</div>}
        {d.reasoning&&<div style={{marginBottom:6}}><div style={{fontSize:10,color:ct.color,fontFamily:fm,letterSpacing:1,fontWeight:600,marginBottom:3}}>REASONING</div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{d.reasoning}</div></div>}
        {d.invalidator&&<div style={{padding:"8px 10px",background:K.red+"06",borderRadius:_isBm?0:6,border:"1px solid "+K.red+"15",marginBottom:6}}>
          <div style={{fontSize:10,color:K.red,fontFamily:fm,letterSpacing:1,fontWeight:600,marginBottom:2}}>WHAT WOULD PROVE ME WRONG</div>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{d.invalidator}</div></div>}
      </div>}
      {/* ── EARNINGS REVIEW CARD ── */}
      {d.cardType==="earnings_review"&&<div>
        {d.quarter&&<div style={{fontSize:13,fontWeight:600,color:K.txt,marginBottom:6}}>{d.quarter}</div>}
        {d.kpisTotal>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {(d.kpiDetails||[]).map(function(k,ki){return<div key={ki} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:_isBm?0:4,background:(k.status==="met"?K.grn:K.red)+"10",border:"1px solid "+(k.status==="met"?K.grn:K.red)+"20",fontSize:11,fontFamily:fm}}>
            <span style={{color:k.status==="met"?K.grn:K.red,fontWeight:600}}>{k.status==="met"?"✓":"✗"}</span>
            <span style={{color:K.mid}}>{k.name}</span>
            {k.actual!=null&&<span style={{color:k.status==="met"?K.grn:K.red,fontWeight:600}}>{k.actual}</span>}</div>})}</div>}
        {d.kpisTotal>0&&<div style={{fontSize:12,fontWeight:600,color:d.kpisMet===d.kpisTotal?K.grn:d.kpisMet>0?K.amb:K.red,fontFamily:fm,marginBottom:6}}>{d.kpisMet}/{d.kpisTotal} KPIs met</div>}
        {d.summary&&<div style={{fontSize:12,color:K.mid,lineHeight:1.5,marginBottom:6}}>{d.summary.substring(0,200)}</div>}
        {d.userNote&&<div style={{padding:"6px 10px",background:K.bg,borderRadius:_isBm?0:6,marginTop:4}}>
          <div style={{fontSize:10,color:ct.color,fontFamily:fm,letterSpacing:1,fontWeight:600,marginBottom:2}}>MY TAKE</div>
          <div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{d.userNote}</div></div>}
      </div>}
      {/* ── THESIS SNAPSHOT CARD ── */}
      {d.cardType==="thesis_snapshot"&&<div>
        <div style={{fontSize:13,color:K.mid,lineHeight:1.5,marginBottom:8}}>{d.isNew?"Initial thesis written":"Thesis updated to v"+d.version}</div>
        {d.core&&<div style={{padding:"8px 12px",background:K.bg,borderRadius:_isBm?0:6,borderLeft:"2px solid "+ct.color,fontSize:12,color:K.mid,lineHeight:1.5,fontStyle:"italic",marginBottom:6}}>{"\u201c"}{d.core}...{"\u201d"}</div>}
        <div style={{display:"flex",gap:3}}>
          {[{k:"core",c:K.acc,l:"Core"},{k:"hasMoat",c:K.grn,l:"Moat"},{k:"hasRisks",c:K.amb,l:"Risks"},{k:"hasSell",c:K.red,l:"Sell"}].map(function(s){var done=s.k==="core"?d.sectionsFilled>=1:d[s.k];
            return<span key={s.k} style={{fontSize:10,padding:"2px 6px",borderRadius:_isBm?0:3,background:done?s.c+"15":"transparent",color:done?s.c:K.dim,fontFamily:fm,border:"1px solid "+(done?s.c+"25":K.bdr)}}>{done?"●":"○"} {s.l}</span>})}</div>
      </div>}
      {/* ── CONVICTION SHIFT CARD ── */}
      {d.cardType==="conviction_shift"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:22,fontWeight:800,color:d.prevConviction>=7?K.grn:d.prevConviction>=4?K.amb:K.red,fontFamily:fm}}>{d.prevConviction}</span>
            <span style={{fontSize:14,color:K.dim}}>{"→"}</span>
            <span style={{fontSize:22,fontWeight:800,color:d.newConviction>=7?K.grn:d.newConviction>=4?K.amb:K.red,fontFamily:fm}}>{d.newConviction}</span>
            <span style={{fontSize:12,fontWeight:600,color:d.delta>0?K.grn:K.red,fontFamily:fm}}>{d.delta>0?"+":""}{d.delta}</span></div>
          {d.action&&d.action!=="hold"&&<span style={{fontSize:10,fontWeight:700,color:d.action==="add"?K.grn:d.action==="sell"?K.red:K.amb,background:(d.action==="add"?K.grn:d.action==="sell"?K.red:K.amb)+"15",padding:"2px 8px",borderRadius:_isBm?0:3,fontFamily:fm,textTransform:"uppercase"}}>{d.action}</span>}</div>
        {d.note&&<div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{d.note}</div>}
      </div>}
      {/* ── LEGACY/NOTE CARD ── */}
      {(!d.cardType||d.cardType==="note")&&d.reasoning&&<div style={{fontSize:13,color:K.mid,lineHeight:1.6}}>{d.reasoning}</div>}
    </div>}
  function DecisionJournal(p){var c=p.company;var decisions=c.decisions||[];
    var _open=useState(false),open=_open[0],setOpen=_open[1];
    var _adding=useState(false),adding=_adding[0],setAdding=_adding[1];
    var _f=useState({action:"BUY",price:"",shares:"",reasoning:"",invalidator:"",timeHorizon:"long"}),f=_f[0],setF=_f[1];
    var set=function(k,v){setF(function(p2){var n=Object.assign({},p2);n[k]=v;return n})};
    var _sg=useState(false),sellGateOpen=_sg[0],setSellGateOpen=_sg[1];
    var _sq=useState(""),sellQ=_sq[0],setSellQ=_sq[1];
    function addDecision(){if(!f.reasoning.trim())return;
      if((f.action==="SELL"||f.action==="TRIM")&&!sellGateOpen){setSellGateOpen(true);return;}
      setSellGateOpen(false);setSellQ("");
      logJournalEntry(c.id,{cardType:"decision",ticker:c.ticker,action:f.action,price:f.price?parseFloat(f.price):null,shares:f.shares?parseInt(f.shares):null,reasoning:f.reasoning.trim()+(sellQ.trim()?"\n\nSell rationale: "+sellQ.trim():""),invalidator:f.invalidator.trim(),timeHorizon:f.timeHorizon,convictionAtTime:c.conviction||0,priceAtTime:c.position&&c.position.currentPrice?c.position.currentPrice:null,outcome:null,outcomeNote:""});
      var allDecCount=0;cos.forEach(function(cc){allDecCount+=(cc.decisions||[]).length});
      if(allDecCount<=1)setTimeout(function(){showToast("\u2713 First decision logged","info",3000)},300);
      setF({action:"BUY",price:"",shares:"",reasoning:"",invalidator:"",timeHorizon:"long"});setAdding(false)}
    function markOutcome(decId,outcome){upd(c.id,function(prev){return Object.assign({},prev,{decisions:(prev.decisions||[]).map(function(d){return d.id===decId?Object.assign({},d,{outcome:outcome,outcomeDate:new Date().toISOString()}):d})})})}
    var scored=decisions.filter(function(d){return d.outcome});
    var rights=scored.filter(function(d){return d.outcome==="right"}).length;
    var pct=scored.length>0?Math.round(rights/scored.length*100):null;
    var actionColors={BUY:K.grn,SELL:K.red,ADD:K.grn,TRIM:K.red,HOLD:K.amb,PASS:K.dim};
    return<div style={{marginBottom:12}}>
      {/* ── Folder header ── */}
      <div onClick={function(){setOpen(!open);setAdding(false)}} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:(open?"12px 12px 0 0":12),cursor:"pointer",userSelect:"none"}}
        onMouseEnter={function(e){e.currentTarget.style.background=K.acc+"08"}}
        onMouseLeave={function(e){e.currentTarget.style.background=K.card}}>
        {/* Folder icon */}
        <div style={{width:32,height:32,borderRadius:_isBm?0:8,background:K.acc+"12",border:"1px solid "+K.acc+"25",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/></svg>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Decision Log</div>
          <div style={{fontSize:11,color:K.dim,marginTop:1}}>
            {decisions.length===0?"No decisions yet":decisions.length+" entr"+(decisions.length===1?"y":"ies")+(pct!==null?" · "+pct+"% right":"")}
          </div>
        </div>
        {/* Recent actions preview */}
        {decisions.length>0&&!open&&<div style={{display:"flex",gap:4,flexShrink:0}}>
          {decisions.slice(0,3).map(function(d,i){var ac=d.action;var cl=actionColors[ac]||K.dim;return<span key={i} style={{fontSize:9,fontWeight:700,color:cl,background:cl+"15",padding:"2px 6px",borderRadius:_isBm?0:3,fontFamily:fm,border:"1px solid "+cl+"25"}}>{ac||"NOTE"}</span>})}
        </div>}
        {/* Log button — only when open */}
        {open&&<button onClick={function(e){e.stopPropagation();setAdding(!adding)}} style={Object.assign({},S.btnP,{padding:"4px 12px",fontSize:11,flexShrink:0})}>
          {adding?"Cancel":"+ Log"}
        </button>}
        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.dim} strokeWidth="2" style={{flexShrink:0,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      {/* ── Expanded content ── */}
      {open&&<div style={{border:"1px solid "+K.bdr,borderTop:"none",borderRadius:_isBm?0:"0 0 12px 12px",overflow:"hidden"}}>
        {/* Add form */}
        {adding&&<div style={{padding:"16px 20px",background:K.acc+"05",borderBottom:"1px solid "+K.bdr}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:"0 10px"}}>
            <Sel label="Action" value={f.action} onChange={function(v){set("action",v)}} options={[{v:"BUY",l:"BUY"},{v:"SELL",l:"SELL"},{v:"ADD",l:"ADD"},{v:"TRIM",l:"TRIM"},{v:"HOLD",l:"HOLD"},{v:"PASS",l:"PASS"}]} K={K}/>
            <Inp label="Price" value={f.price} onChange={function(v){set("price",v)}} type="number" placeholder="$" K={K}/>
            <Inp label="Shares" value={f.shares} onChange={function(v){set("shares",v)}} type="number" placeholder="Qty" K={K}/>
            <Sel label="Horizon" value={f.timeHorizon} onChange={function(v){set("timeHorizon",v)}} options={[{v:"short",l:"< 1yr"},{v:"medium",l:"1-3yr"},{v:"long",l:"3-10yr"}]} K={K}/>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:11,color:K.txt,marginBottom:5,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600}}>Why? *</label>
            <textarea value={f.reasoning} onChange={function(e){set("reasoning",e.target.value)}} rows={2} placeholder={"What do I believe that the market doesn't?"} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:K.txt,padding:"10px 12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.5}}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:11,color:K.red,marginBottom:5,letterSpacing:.5,textTransform:"uppercase",fontFamily:fm,fontWeight:600}}>What would prove me wrong?</label>
            <textarea value={f.invalidator} onChange={function(e){set("invalidator",e.target.value)}} rows={1} placeholder="Specific event or metric that would change my mind" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.red+"25",borderRadius:_isBm?0:6,color:K.txt,padding:"10px 12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.5}}/>
          </div>
          {sellGateOpen&&<div style={{background:K.red+"08",border:"1px solid "+K.red+"25",borderRadius:_isBm?0:10,padding:"14px 16px",marginBottom:4}}>
            <div style={{fontSize:13,fontWeight:700,color:K.red,marginBottom:6}}>{f.action==="SELL"?"Before you sell":"Before you trim"}</div>
            <div style={{fontSize:13,color:K.txt,marginBottom:10,lineHeight:1.6}}>{f.action==="SELL"?"Has the thesis changed \u2014 or are you reacting to price?":"What specifically changed that reduces conviction?"}</div>
            <textarea value={sellQ} onChange={function(e){setSellQ(e.target.value)}} rows={2}
              placeholder={f.action==="SELL"?"e.g. Revenue growth missed my 20% threshold two quarters running":"e.g. Position grew to 25% of portfolio, trimming to manage size"}
              style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:_isBm?0:8,border:"1px solid "+K.bdr,background:K.bg,color:K.txt,fontSize:13,fontFamily:fb,outline:"none",resize:"none",lineHeight:1.5,marginBottom:10}}/>
            <div style={{display:"flex",gap:6}}>
              <button onClick={function(){setSellGateOpen(false);setSellQ("")}} style={{flex:1,padding:"8px",borderRadius:_isBm?0:8,border:"1px solid "+K.bdr,background:"transparent",color:K.dim,fontSize:12,cursor:"pointer",fontFamily:fm}}>Go back</button>
              <button onClick={function(){setSellGateOpen(false);setTimeout(addDecision,50)}} style={{flex:2,padding:"8px",borderRadius:_isBm?0:8,border:"none",background:K.red,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:fm}}>{"Confirm "+f.action}</button>
            </div>
          </div>}
          {!sellGateOpen&&<div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button>
            <button style={Object.assign({},S.btnP,{opacity:f.reasoning.trim()?1:.4})} onClick={addDecision}>Save</button>
          </div>}
        </div>}
        {/* Entries */}
        {decisions.length===0&&!adding&&<div style={{padding:"24px 20px",textAlign:"center"}}>
          <div style={{fontSize:13,color:K.dim,marginBottom:4}}>No decisions logged yet</div>
          <div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>Track every buy, sell, and hold — with your reasoning.</div>
        </div>}
        {decisions.slice(0,15).map(function(d,i){
          var ac=d.action;var cl=actionColors[ac]||K.dim;
          var timeAgo=(function(){if(!d.date)return"";var diff=Math.floor((Date.now()-new Date(d.date))/86400000);if(diff===0)return"Today";if(diff===1)return"Yesterday";if(diff<30)return diff+"d ago";return Math.floor(diff/30)+"mo ago"})();
          return<div key={d.id} style={{padding:"12px 16px",borderBottom:i<decisions.slice(0,15).length-1?"1px solid "+K.bdr+"40":"none"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <span style={{fontSize:10,fontWeight:800,color:cl,background:cl+"15",padding:"3px 8px",borderRadius:_isBm?0:4,fontFamily:fm,border:"1px solid "+cl+"25",flexShrink:0,marginTop:1}}>{ac||"NOTE"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:K.txt,lineHeight:1.6,fontFamily:fb}}>{d.reasoning&&d.reasoning.substring(0,160)}{d.reasoning&&d.reasoning.length>160?"...":""}</div>
                {d.invalidator&&<div style={{fontSize:11,color:K.dim,marginTop:3,fontStyle:"italic"}}>{"If wrong: "+d.invalidator.substring(0,80)}</div>}
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                  <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{timeAgo}</span>
                  {d.priceAtTime&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{"@ $"+d.priceAtTime}</span>}
                  {d.outcome&&<span style={{fontSize:10,fontWeight:700,color:d.outcome==="right"?K.grn:d.outcome==="wrong"?K.red:K.amb,fontFamily:fm}}>{d.outcome==="right"?"✓ Right":d.outcome==="wrong"?"✗ Wrong":"Mixed"}</span>}
                </div>
              </div>
            </div>
            {d.cardType==="decision"&&!d.outcome&&<div style={{display:"flex",gap:5,marginTop:8}}>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm,lineHeight:"22px"}}>Score:</span>
              {["right","wrong","mixed"].map(function(o){var cl2=o==="right"?K.grn:o==="wrong"?K.red:K.amb;return<button key={o} onClick={function(){markOutcome(d.id,o)}} style={{fontSize:10,color:cl2,background:cl2+"10",border:"1px solid "+cl2+"30",borderRadius:_isBm?0:4,padding:"2px 9px",cursor:"pointer",fontFamily:fm,textTransform:"capitalize"}}>{o}</button>})}
            </div>}
          </div>
        })}
        {scored.length>0&&<div style={{padding:"8px 16px",borderTop:"1px solid "+K.bdr,background:K.bg,display:"flex",alignItems:"center",gap:6}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={K.grn} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span style={{fontSize:11,color:K.grn,fontFamily:fm,fontWeight:600}}>{rights}/{scored.length} right · {pct}% accuracy</span>
        </div>}
      </div>}
    </div>}

  // ── SEC Filings (Finnhub FREE) ──
  function SECFilings(p){var c=p.company;
    var _filings=useState(null),filings=_filings[0],setFilings=_filings[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    useEffect(function(){setLd(true);fetchFilings(c.ticker).then(function(r){setFilings(r);setLd(false)}).catch(function(){setLd(false)})},[c.ticker]);
    if(ld)return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:20,marginBottom:20}}><div style={S.sec}>SEC Filings</div><div style={{fontSize:12,color:K.dim}}>Loading...</div></div>;
    if(!filings||!filings.length)return null;
    var formColors={"10-K":K.blue,"10-Q":K.acc,"8-K":K.amb,"4":K.grn,SC:K.dim};
    return<div style={{marginBottom:20}}>
      <div style={Object.assign({},S.sec,{marginBottom:12})}>SEC Filings</div>
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
        {filings.slice(0,8).map(function(f,i){var form=(f.form||"").toUpperCase();var color=formColors[form]||K.dim;
          return<a key={i} href={f.filingUrl||f.reportUrl||"#"} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<7?"1px solid "+K.bdr:"none",textDecoration:"none"}}>
            <span style={{background:color+"15",color:color,fontFamily:fm,fontWeight:600,fontSize:11,padding:"3px 8px",borderRadius:_isBm?0:4,border:"1px solid "+color+"30",minWidth:36,textAlign:"center"}}>{form}</span>
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
      {adding&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginBottom:12}}>
        <div style={{fontSize:13,color:K.mid,marginBottom:12}}>Is your original thesis still intact?</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>{["intact","weakened","broken"].map(function(s){return<button key={s} onClick={function(){setF(function(p2){return Object.assign({},p2,{status:s})})}} style={{flex:1,padding:"10px",borderRadius:_isBm?0:8,fontSize:13,fontWeight:f.status===s?600:400,cursor:"pointer",fontFamily:fm,background:f.status===s?statusColors[s]+"15":"transparent",border:"1px solid "+(f.status===s?statusColors[s]+"50":K.bdr),color:f.status===s?statusColors[s]:K.dim}}>{statusLabels[s]}</button>})}</div>
        <div style={{marginBottom:12}}><textarea value={f.note} onChange={function(e){setF(function(p2){return Object.assign({},p2,{note:e.target.value})})}} rows={2} placeholder="What changed? What would break this thesis?" style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:K.txt,padding:"10px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical"}}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button style={S.btn} onClick={function(){setAdding(false)}}>Cancel</button><button style={S.btnP} onClick={addReview}>Save Review</button></div></div>}
      {reviews.length===0&&!adding&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:_isBm?0:12,padding:20,textAlign:"center",fontSize:13,color:K.dim}}>Periodically review: is your thesis still intact?</div>}
      {reviews.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
        {reviews.slice(0,6).map(function(r,i){return<div key={r.id} style={{padding:"10px 16px",borderBottom:i<Math.min(reviews.length,6)-1?"1px solid "+K.bdr:"none",display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{width:_isBm?6:8,height:_isBm?6:8,borderRadius:_isBm?1:"50%",background:statusColors[r.status]||K.dim,marginTop:5,flexShrink:0}}/>
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
        <button onClick={function(){setAf("all")}} style={{background:af==="all"?K.acc+"20":"transparent",border:"1px solid "+(af==="all"?K.acc+"50":K.bdr),borderRadius:_isBm?0:6,padding:"5px 12px",fontSize:12,color:af==="all"?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>All ({docs.length})</button>
        {FOLDERS.map(function(fo){return<button key={fo.id} onClick={function(){setAf(fo.id)}} style={{background:af===fo.id?K.acc+"20":"transparent",border:"1px solid "+(af===fo.id?K.acc+"50":K.bdr),borderRadius:_isBm?0:6,padding:"5px 12px",fontSize:12,color:af===fo.id?K.acc:K.dim,cursor:"pointer",fontFamily:fm,display:"inline-flex",alignItems:"center",gap:5}}><IC name={fo.icon} size={12} color={af===fo.id?K.acc:K.dim}/>{fo.label} {folderCounts[fo.id]>0?"("+folderCounts[fo.id]+")":""}</button>})}</div>
      {filtered.length===0&&<div style={{background:K.card,border:"1px dashed "+K.acc+"25",borderRadius:_isBm?0:14,padding:"28px 24px",textAlign:"center"}}>
        <div style={{width:38,height:38,borderRadius:_isBm?0:10,background:K.acc+"10",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:4}}>{af==="all"?"No research notes yet":"Nothing in this folder"}</div>
        <div style={{fontSize:11,color:K.dim,marginBottom:14,lineHeight:1.5}}>{"Save your thinking about "+c.ticker+" — deep dives, key quotes, earnings notes."}</div>
        <div style={{display:"flex",gap:6,justifyContent:"center"}}>
          <button style={Object.assign({},S.btnP,{padding:"7px 14px",fontSize:11})} onClick={function(){setModal({type:"memo"})}}>+ Memo</button>
          <button style={Object.assign({},S.btn,{padding:"7px 14px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>+ Note</button>
        </div><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12,marginLeft:6})} onClick={function(){setModal({type:"memo"})}}>Write memo</button><button style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12,marginLeft:6})} onClick={function(){setModal({type:"clip"})}}>Clip research</button></div>}
      {filtered.map(function(d){var fo=FOLDERS.find(function(f){return f.id===d.folder});
        return<div key={d.id} style={{background:K.card,border:"1px solid "+(d.isClip?K.blue+"30":d.isIR?K.amb+"30":d.isMemo?K.acc+"30":K.bdr),borderLeft:d.isClip?"3px solid "+K.blue:d.isIR?"3px solid "+K.amb:d.isMemo?"3px solid "+K.acc:"3px solid transparent",borderRadius:_isBm?0:10,padding:"14px 20px",marginBottom:8,cursor:"pointer"}} onClick={function(){setModal({type:d.isMemo?"memo":d.isClip?"doc":d.isIR?"doc":"doc",data:d.id})}}>
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
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 20px"}}>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {sortedYears.map(function(yr){return<button key={yr} onClick={function(){setSelYear(yr);setSelQ(null)}} style={{background:selYear===yr?K.acc+"20":"transparent",border:"1px solid "+(selYear===yr?K.acc+"50":K.bdr),borderRadius:_isBm?0:6,padding:"5px 14px",fontSize:13,fontWeight:600,color:selYear===yr?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>{yr}</button>})}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          {quarters.map(function(qt){var entry=years[selYear]?years[selYear][qt]:null;
            return<div key={qt} onClick={function(){if(entry)setSelQ(selQ===qt?null:qt)}} style={{background:entry?(selQ===qt?K.acc+"15":K.bg):K.bg,border:"1px solid "+(entry?(selQ===qt?K.acc+"40":K.bdr):K.bdr),borderRadius:_isBm?0:8,padding:"10px 12px",cursor:entry?"pointer":"default",opacity:entry?1:.4,textAlign:"center",transition:"all .2s"}}>
              <div style={{fontSize:13,fontWeight:600,color:entry?K.txt:K.dim,fontFamily:fm}}>{qt}</div>
              {entry&&<div style={{fontSize:11,color:K.dim,marginTop:4}}>&#x2713; Tracked</div>}
              {!entry&&<div style={{fontSize:11,color:K.dim,marginTop:4}}>&mdash;</div>}</div>})}</div>
        {selectedEntry&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+K.bdr}}>
          <div style={{fontSize:14,color:K.mid,lineHeight:1.6,marginBottom:8}}>{selectedEntry.summary}</div>
          {selectedEntry.results&&selectedEntry.results.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
            {selectedEntry.results.map(function(r,i){return<div key={i} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,padding:"6px 12px"}}>
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
    return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden",marginBottom:20}}>
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
                return<div key={k} style={{background:K.bg,borderRadius:_isBm?0:8,padding:"9px 11px",position:"relative",overflow:"hidden"}}>
                  {isGood!=null&&<div style={{position:"absolute",top:0,left:0,bottom:0,width:2,borderRadius:_isBm?"0":"2px 0 0 2px",background:isGood?K.grn:K.red}}/>}
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

  // Business model context — explains why standard metrics can mislead
var BUSINESS_MODEL_CONTEXT={
  serial_acquirer:{
    label:"Serial Acquirer",
    roic:{note:"Serial acquirers constantly deploy capital into new acquisitions before returns fully mature. Reported ROIC understates the true return on each individual acquisition. Look at per-acquisition IRR and organic ROIC of legacy businesses instead.",expectLow:true,adjustedBenchmark:8},
    grossMargin:{note:"Margin varies widely by acquisition mix and sector. Portfolio-level gross margin is less meaningful than unit economics per acquisition.",expectLow:false},
    opMargin:{note:"M&A amortization charges reduce reported operating margin materially. Add back amortization of acquired intangibles to see true operating performance.",expectLow:true},
    guidance:"Focus on: (1) Acquisition IRR > cost of capital, (2) Organic growth in acquired businesses, (3) Decentralised management track record, (4) Runway of M&A candidates. Think Constellation Software, Topicus, Danaher."
  },
  distributor:{
    label:"Low-Margin Distributor",
    grossMargin:{note:"Distributors operate on thin margins by design — their value is scale, logistics, and supplier relationships, not product pricing power. 5-15% gross margin is normal for best-in-class distributors.",expectLow:true,adjustedBenchmark:10},
    opMargin:{note:"Low absolute margins compensated by high asset turns (ROIC = margin × turns). A 3% op margin with 5x asset turnover beats a 30% margin business with 0.3x turns.",expectLow:true},
    roic:{note:"Asset-light business model generates high ROIC through turnover despite low margins. Focus on ROIC rather than gross or op margin in isolation.",expectLow:false},
    guidance:"The key metric is ROIC, not margin. Distributors win through density, scale, and inventory management. Think Fastenal, Grainger, Copart."
  },
  asset_light:{
    label:"Asset-Light / Platform",
    roic:{note:"Asset-light platforms often report extremely high ROIC (50-100%+) because their capital base is small relative to earnings. This is a feature, not a red flag.",expectLow:false},
    grossMargin:{note:"High gross margins (60-80%+) are characteristic of platforms and software. Operating leverage means incremental revenue flows mostly to the bottom line.",expectLow:false},
    guidance:"Key metrics: net revenue retention, CAC payback, gross margin expansion, FCF conversion. Traditional asset/debt ratios are less meaningful."
  },
  financial:{
    label:"Financial / Insurance",
    roic:{note:"Traditional ROIC is not meaningful for financials — their business model is to lever up a capital base profitably. Use ROE and combined ratio instead.",expectLow:true},
    grossMargin:{note:"Gross margin is not a standard metric for banks and insurers. Use net interest margin (banks) or combined ratio (insurers) instead.",expectLow:true},
    opMargin:{note:"Operating margin is not standard for financials. Use efficiency ratio (banks: non-interest expense / revenue) or operating ratio (insurers) instead.",expectLow:true},
    guidance:"For banks: focus on ROE, net interest margin, loan growth, credit quality. For insurers: combined ratio, float, investment returns."
  }
};

function calcMoatFromData(finData,businessModelType){
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
      metrics.push({id:"grossMargin",name:"Gross Margin Stability",score:(function(){var _isDistrib=businessModelType==="distributor";var _base=_isDistrib?(gmAvg>=20?8:gmAvg>=12?7:gmAvg>=8?6:gmAvg>=5?5:3):(gmAvg>=60?8:gmAvg>=40?7:gmAvg>=25?6:gmAvg>=15?4:2);return Math.min(10,Math.max(1,Math.round(_base+(gmStd<3?1:gmStd>10?-1:0))))})(),value:gmAvg.toFixed(1)+"%",detail:"Avg "+gmAvg.toFixed(1)+"% (±"+gmStd.toFixed(1)+"%)"+((businessModelType==="distributor")?" [distributor — thin margin expected]":""),trend:gm.map(function(v){return v*100}),icon:"shield",desc:businessModelType==="distributor"?"Distributors win on scale and asset turns, not gross margin. Stability matters more than the absolute level.":"High & stable margins indicate pricing power"})}
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
      if(roics.length>=2){
        var _roicAvg=avg(roics);
        var _isAcquirer=businessModelType==="serial_acquirer";
        var _isFinancial=businessModelType==="financial";
        var _roicThresh=_isAcquirer?8:15;
        var _roicScore=_isAcquirer
          ?Math.min(10,Math.max(1,Math.round(_roicAvg>20?9:_roicAvg>15?8:_roicAvg>10?7:_roicAvg>8?6:_roicAvg>5?5:3)))
          :Math.min(10,Math.max(1,Math.round(_roicAvg>30?9:_roicAvg>20?8:_roicAvg>15?7:_roicAvg>10?6:_roicAvg>5?4:2)));
        var _roicDesc=_isAcquirer?"ROIC is understated for serial acquirers due to ongoing M&A deployment. A growing acquired portfolio with improving organic returns matters more than the absolute number.":"High ROIC is the hallmark of a true moat";
        var _roicName=_isAcquirer?"ROIC (acquisition-adjusted)":"Return on Invested Capital";
        metrics.push({id:"roic",name:_roicName,score:_roicScore,value:_roicAvg.toFixed(1)+"%",detail:"Avg ROIC "+_roicAvg.toFixed(1)+"% over "+roics.length+"yr"+(_isAcquirer?" [serial acquirer — lower threshold applied]":""),trend:roics,icon:"target",desc:_roicDesc})}}
    // 5. FCF CONVERSION
    if(recentCf.length>=2&&recent.length>=2){var fcfC=[];for(var fi=0;fi<Math.min(recentCf.length,recent.length);fi++){var fcf=recentCf[fi].freeCashFlow!=null?recentCf[fi].freeCashFlow:((recentCf[fi].operatingCashFlow!=null&&recentCf[fi].capitalExpenditure!=null)?(recentCf[fi].operatingCashFlow+Math.min(0,recentCf[fi].capitalExpenditure)):null);var ni=recent[fi].netIncome;if(fcf!=null&&ni&&ni>0)fcfC.push(fcf/ni*100)}
      if(fcfC.length>=2){metrics.push({id:"fcfConversion",name:"FCF Conversion",score:Math.min(10,Math.max(1,Math.round(avg(fcfC)>120?9:avg(fcfC)>100?8:avg(fcfC)>80?7:avg(fcfC)>50?5:avg(fcfC)>0?3:1))),value:avg(fcfC).toFixed(0)+"%",detail:"FCF/NI ratio avg "+avg(fcfC).toFixed(0)+"%",trend:fcfC,icon:"dollar",desc:"High FCF relative to net income shows earnings quality"})}}
    // 6. FINANCIAL FORTRESS
    if(recentBal.length>=1&&recent.length>=1){var lastBal=recentBal[recentBal.length-1];var lastInc=recent[recent.length-1];var nd=lastBal.netDebt||(lastBal.totalDebt||0)-(lastBal.cashAndCashEquivalents||0);var ebitda=lastInc.ebitda||(lastInc.operatingIncome&&lastInc.depreciationAndAmortization?(lastInc.operatingIncome+Math.abs(lastInc.depreciationAndAmortization)):null);
      if(ebitda&&ebitda>0){var ratio=nd/ebitda;
        // Business model-adjusted leverage tolerance
        var _bmt=businessModelType||"competitive";
        var _rawFortress=ratio<0?10:ratio<1?8:ratio<2?7:ratio<3?5:ratio<5?3:1;
        var _floorByBM=_bmt==="monopoly"?7:_bmt==="oligopoly"?6:_bmt==="niche"?5:_bmt==="commodity"?1:3;
        var _fortressScore=Math.min(10,Math.max(_floorByBM,Math.round(_rawFortress)));
        var _adjNote=(_bmt==="monopoly"||_bmt==="oligopoly")&&ratio>=2?" (adjusted for "+_bmt+")":"";
        metrics.push({id:"fortress",name:"Financial Fortress",score:_fortressScore,value:ratio<0?"Net Cash":ratio.toFixed(1)+"x",detail:"Net Debt/EBITDA = "+(ratio<0?"Net Cash":ratio.toFixed(1)+"x")+_adjNote,trend:null,icon:"castle",desc:"Low leverage = resilience and optionality. Score adjusts for business model type."})}
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
    if(!isPro){return<div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:20,marginBottom:20}}>
      <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Price History</div>
      <div style={{background:K.bg,borderRadius:_isBm?0:8,padding:"28px 20px",textAlign:"center"}}>
        <div style={{fontSize:14,color:K.mid,marginBottom:8}}>Price charts with entry points, conviction markers & earnings dates</div>
        <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("charts")}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",color:K.acc,padding:"6px 16px",borderRadius:_isBm?0:6,fontSize:12,cursor:"pointer",fontFamily:fm}}>Upgrade to Unlock</button>
      </div></div>}
    var _pts=useState(null),pts=_pts[0],setPts=_pts[1];
    var _ld=useState(true),ld=_ld[0],setLd=_ld[1];
    var _range=useState("1Y"),range=_range[0],setRange=_range[1];
    var _hov=useState(null),hov=_hov[0],setHov=_hov[1];
    useEffect(function(){setLd(true);
      fetchHistoricalPrice(c.ticker,range).then(function(r){setPts(r);setLd(false)}).catch(function(){setLd(false)})},[c.ticker,range]);
    if(ld)return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:20,marginBottom:20}}>
      <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Price History</div>
      <div className="ta-skel" style={{height:140,background:K.bdr,borderRadius:_isBm?0:8}}/></div>;
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
    return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:isMobile?"14px":"16px 20px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Price History</div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {hovPt&&<span style={{fontSize:12,fontFamily:fm,color:K.txt,marginRight:8}}>{hovPt.date} <strong>${hovPt.close.toFixed(2)}</strong></span>}
          <span style={{fontSize:11,fontWeight:600,color:totalRet>=0?K.grn:K.red,fontFamily:fm,marginRight:8}}>{totalRet>=0?"+":""}{totalRet.toFixed(1)}% ({range})</span>
          {ranges.map(function(r){return<button key={r} onClick={function(){setRange(r)}} style={{padding:"3px 8px",fontSize:11,fontFamily:fm,background:range===r?K.acc+"18":"transparent",color:range===r?K.acc:K.dim,border:"1px solid "+(range===r?K.acc+"30":"transparent"),borderRadius:_isBm?0:4,cursor:"pointer"}}>{r}</button>})}</div></div>
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
        {entries.length>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><span style={{width:_isBm?6:8,height:_isBm?6:8,borderRadius:_isBm?1:"50%",background:K.grn}}/> Buy/Add <span style={{width:_isBm?6:8,height:_isBm?6:8,borderRadius:_isBm?1:"50%",background:K.red}}/> Sell/Trim</span>}
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
        {[0,1,2,3].map(function(i){return<div key={i} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:22}}>
          <div className="ta-skel" style={{height:14,width:"60%",background:K.bdr,marginBottom:12}}/>
          <div className="ta-skel" style={{height:6,background:K.bdr,marginBottom:8}}/>
          <div className="ta-skel" style={{height:10,width:"40%",background:K.bdr}}/></div>})}</div>
        <div style={{textAlign:"center",fontSize:12,color:K.dim,marginTop:16,fontFamily:fm}}>Analyzing {c.ticker} competitive advantages...</div></div>:
      !moat?<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>Insufficient financial data to analyze moat</div><div style={{fontSize:12,color:K.dim}}>Need at least 2 years of financial statements from SEC EDGAR.</div></div>:
      <div>
      {/* Composite Score */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"28px 32px",marginBottom:24,display:"flex",alignItems:"center",gap:32}}>
        <div style={{width:100,height:100,borderRadius:"50%",border:"4px solid "+cColor,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div style={{fontSize:36,fontWeight:700,color:cColor,fontFamily:fm,lineHeight:1}}>{adjComposite}</div>
          <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>/10</div></div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:500,color:cColor,fontFamily:fh,marginBottom:4}}>{cLabel}</div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.7}}>{adjComposite>=8?"This company shows strong competitive advantages across multiple dimensions. Durable moats deserve premium conviction.":adjComposite>=6?"Some competitive advantages are visible, but not all dimensions are strong. Monitor for moat erosion.":adjComposite>=4?"Limited competitive advantages detected. This company may be vulnerable to competition.":"No clear competitive moat identified. High conviction requires a special thesis."}</div>
          {BUSINESS_MODEL_CONTEXT[c.businessModelType||""]&&<div style={{fontSize:11,color:K.blue,marginTop:6,fontFamily:fm,padding:"6px 10px",background:K.blue+"08",borderRadius:_isBm?0:6,lineHeight:1.5}}>{"\u2139\uFE0F "+(BUSINESS_MODEL_CONTEXT[c.businessModelType].label)+": this quantitative score uses financial statement ratios. "+ (c.businessModelType==="serial_acquirer"?"For serial acquirers, the moat is better assessed by acquisition IRR, organic growth rate of acquired businesses, and the decentralised management model. The score below understates true competitive advantage.":c.businessModelType==="distributor"?"Distributors will score lower on gross margin — this is expected. Their moat is in logistics density, supplier relationships, and customer switching costs.":"Standard financial benchmarks may not apply to this business model.")}</div>}
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
            {classified.length>0&&<button onClick={function(){setSubPage(null);setDetailTab("dossier");showToast(c.ticker+" moat classified — "+classified.length+" type"+(classified.length>1?"s":"")+" identified","info",3000)}} style={Object.assign({},S.btnP,{padding:"6px 16px",fontSize:12,display:"flex",alignItems:"center",gap:5})}><IC name="shield" size={12} color={"#fff"}/>Done — Back to Dossier</button>}</div>
          {/* Morningstar Reference + Moat Trend */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:16}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 16px"}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>MORNINGSTAR RATING</div>
              <select value={c.morningstarMoat||""} onChange={function(e){upd(c.id,{morningstarMoat:e.target.value})}} style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:c.morningstarMoat==="Wide"?K.grn:c.morningstarMoat==="Narrow"?K.amb:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
                <option value="">Not Set</option><option value="Wide">★ Wide Moat</option><option value="Narrow">★ Narrow Moat</option><option value="None">No Moat</option><option value="Not Rated">Not Rated</option></select></div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 16px"}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>MOAT TREND</div>
              <select value={c.moatTrend||""} onChange={function(e){upd(c.id,{moatTrend:e.target.value})}} style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:c.moatTrend==="Strengthening"?K.grn:c.moatTrend==="Eroding"?K.red:K.txt,padding:"8px 10px",fontSize:13,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
                <option value="">Not Set</option><option value="Strengthening">▲ Strengthening</option><option value="Stable">─ Stable</option><option value="Eroding">▼ Eroding</option></select></div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 16px"}} title="Business model structure affects how leverage should be interpreted. A monopoly can safely carry debt that would destroy a commodity business.">
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:6}}>BUSINESS MODEL</div>
              <select value={c.businessModelType||""} onChange={function(e){upd(c.id,{businessModelType:e.target.value})}} style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:c.businessModelType==="monopoly"?K.grn:c.businessModelType==="oligopoly"?K.grn:c.businessModelType==="asset_light"?K.grn:c.businessModelType==="serial_acquirer"?K.blue:c.businessModelType==="distributor"?K.amb:c.businessModelType==="financial"?K.blue:c.businessModelType==="commodity"?K.red:K.txt,padding:"8px 10px",fontSize:12,fontFamily:fm,fontWeight:600,outline:"none",cursor:"pointer"}}>
                <option value="">Not Set</option>
                <option value="monopoly">👑 Monopoly / Pricing Power</option>
                <option value="oligopoly">🏰 Oligopoly</option>
                <option value="niche">🎯 Niche Dominant</option>
                <option value="serial_acquirer">🧩 Serial Acquirer</option>
                <option value="asset_light">⚡ Asset-Light / Platform</option>
                <option value="distributor">🚚 Low-Margin Distributor</option>
                <option value="financial">🏦 Financial / Insurance</option>
                <option value="competitive">⚔ Competitive</option>
                <option value="commodity">📦 Commodity</option>
              </select>
              <div style={{fontSize:9,color:K.dim,fontFamily:fb,marginTop:5,lineHeight:1.3}}>Adjusts leverage tolerance in Analytics scoring</div>
            </div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 16px"}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:4}}>YOUR vs M★</div>
              <div style={{fontSize:10,color:K.dim,fontFamily:fb,marginBottom:6,lineHeight:1.4}}>Your moat type count vs M★ analyst opinion</div>
              {(function(){var yourWidth=classified.length>=3?"Wide":classified.length>=1?"Narrow":"None";var mstar=c.morningstarMoat||"";
                var agree=mstar&&yourWidth===mstar;var disagree=mstar&&mstar!=="Not Rated"&&yourWidth!==mstar;
                return<div>
                  <div style={{fontSize:13,color:agree?K.grn:disagree?K.amb:K.dim,fontWeight:600,fontFamily:fm}}>
                    {!mstar?"Set M★ rating first":agree?"✓ Aligned":disagree?"⚠ Divergent":"—"}</div>
                  {disagree&&<div style={{fontSize:10,color:K.dim,fontFamily:fb,marginTop:4,lineHeight:1.4}}>{"You've identified "+classified.length+" type"+(classified.length!==1?"s":"")+", suggesting "+yourWidth.toLowerCase()+" moat. M★ says "+mstar.toLowerCase()+". Worth reflecting on."}</div>}
                </div>})()}</div></div>
          {/* Active moat types */}
          {classified.length>0&&<div style={{marginBottom:16}}>
            {classified.map(function(t){var d=mt[t.id]||{};var sug=suggestions.find(function(s){return s.id===t.id});
              return<div key={t.id} style={{background:K.card,border:"1px solid "+t.color+"40",borderLeft:"4px solid "+t.color,borderRadius:_isBm?0:12,padding:"16px 20px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <IC name={t.icon} size={16} color={t.color}/>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:K.txt}}>{t.label}</div>
                    <div style={{fontSize:12,color:K.dim,lineHeight:1.5}}>{t.desc}</div></div>
                  <button onClick={function(){toggleType(t.id)}} style={{background:"none",border:"none",color:K.dim,cursor:"pointer",fontSize:13,padding:4,opacity:.5}} title="Remove">{"✕"}</button></div>
                {/* Strength rating */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:11,color:K.dim,fontFamily:fm,width:70}}>STRENGTH</span>
                  <div style={{display:"flex",gap:3}}>
                    {[1,2,3,4,5].map(function(v){return<button key={v} onClick={function(){setStrength(t.id,v)}} style={{width:28,height:24,borderRadius:_isBm?0:4,border:"1px solid "+(v<=d.strength?t.color+"60":K.bdr),background:v<=d.strength?t.color+"20":"transparent",color:v<=d.strength?t.color:K.dim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{v}</button>})}</div>
                  <span style={{fontSize:11,color:t.color,fontFamily:fm,marginLeft:4}}>{d.strength>=5?"Dominant":d.strength>=4?"Strong":d.strength>=3?"Moderate":d.strength>=2?"Weak":"Fragile"}</span></div>
                {/* Note */}
                <textarea value={d.note||""} onChange={function(e){setNote(t.id,e.target.value)}} placeholder={"Why does "+c.ticker+" have "+t.label.toLowerCase()+"? Be specific..."} rows={2} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:K.txt,padding:"8px 12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.5}}/>
                {sug&&sug.reasons.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>
                  {sug.reasons.map(function(r,ri){return<span key={ri} style={{fontSize:10,color:t.color,background:t.color+"10",padding:"2px 8px",borderRadius:_isBm?0:3,fontFamily:fm}}>{r}</span>})}</div>}
              </div>})}</div>}
          {/* Suggestions + unclassified */}
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px"}}>
            {classified.length===0&&<div style={{fontSize:13,color:K.mid,marginBottom:12,lineHeight:1.6}}>What type of competitive advantage does {c.ticker} have? Select the moat sources that apply. {hasSuggestions?"We've highlighted likely matches based on "+c.ticker+"'s sector and financials.":""}</div>}
            {classified.length>0&&<div style={{fontSize:12,color:K.dim,marginBottom:10}}>Add more moat sources:</div>}
            <div className="ta-grid-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {unclassified.map(function(t){var sug=suggestions.find(function(s){return s.id===t.id});var isSuggested=!!sug;
                return<button key={t.id} onClick={function(){toggleType(t.id)}} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",borderRadius:_isBm?0:8,cursor:"pointer",textAlign:"left",background:isSuggested?t.color+"08":"transparent",border:"1px solid "+(isSuggested?t.color+"35":K.bdr),transition:"all .15s"}}>
                  <div style={{width:28,height:28,borderRadius:_isBm?0:6,display:"flex",alignItems:"center",justifyContent:"center",background:t.color+"15",flexShrink:0,marginTop:1}}>
                    <IC name={t.icon} size={14} color={t.color}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:isSuggested?K.txt:K.mid,display:"flex",alignItems:"center",gap:5}}>{t.label}
                      {isSuggested&&<span style={{fontSize:8,fontWeight:700,color:t.color,background:t.color+"15",padding:"1px 5px",borderRadius:_isBm?0:3,fontFamily:fm}}>LIKELY</span>}</div>
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
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"22px 24px"}}>
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
                {isOverridden&&<span style={{fontSize:8,fontWeight:700,color:K.acc,background:K.acc+"15",padding:"2px 6px",borderRadius:_isBm?0:3,fontFamily:fm}}>OVERRIDE</span>}
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
                      style={{padding:"5px 14px",borderRadius:_isBm?0:6,border:"1px solid "+(active?clr+"60":K.bdr),
                        background:active?clr+"15":"transparent",color:active?clr:K.dim,
                        fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm,textTransform:"capitalize"}}>{opt}</button>})}
                  <span style={{fontSize:11,color:K.dim,fontFamily:fm,marginLeft:8,fontStyle:"italic"}}>{q.tip}</span>
                </div>
              </div>})}
            {/* Suggested + final score */}
            {answered>=3&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"14px 18px",marginTop:6}}>
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
                      style={{width:28,height:26,borderRadius:_isBm?0:4,border:"1px solid "+(active?clr+"80":v===suggested?K.acc+"40":K.bdr),
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
              rows={2} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:K.txt,padding:"8px 12px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.5,marginTop:12}}/>
          </div>
        </div>}()}
      {/* Individual Metrics */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {moat.metrics.map(function(m){
          var ppOverride=m.id==="grossMargin"&&c.pricingPower&&c.pricingPower.score!=null;
          var displayScore=ppOverride?c.pricingPower.score:m.score;
          var barColor=displayScore>=8?K.grn:displayScore>=6?K.amb:K.red;
          return<div key={m.id} style={{background:K.card,border:"1px solid "+(ppOverride?K.acc+"40":K.bdr),borderRadius:_isBm?0:12,padding:"18px 22px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <IC name={m.icon} size={16} color={K.dim}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{ppOverride?"Pricing Power (Owner)":m.name}</div>
                {ppOverride&&<div style={{fontSize:10,color:K.acc,fontFamily:fm}}>Data score: {m.score}/10 · Overridden by your assessment</div>}</div>
              <div style={{fontSize:22,fontWeight:700,color:barColor,fontFamily:fm}}>{displayScore}</div></div>
            {/* Score bar */}
            <div style={{height:6,borderRadius:_isBm?0:3,background:K.bdr,marginBottom:8,overflow:"hidden"}}>
              <div style={{height:"100%",width:displayScore*10+"%",borderRadius:_isBm?0:3,background:barColor,transition:"width .3s"}}/></div>
            <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:2}}>{m.value}</div>
            <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:6}}>{m.detail}</div>
            {/* Mini sparkline */}
            {m.trend&&m.trend.length>=2&&<div style={{display:"flex",alignItems:"flex-end",gap:2,height:24,marginTop:4}}>
              {m.trend.map(function(v,ti){var mx=Math.max.apply(null,m.trend);var mn=Math.min.apply(null,m.trend);var range=mx-mn||1;var h=Math.max(3,((v-mn)/range)*22);
                return<div key={ti} style={{flex:1,height:h,borderRadius:_isBm?0:2,background:barColor+"60"}}/>})}</div>}
            <div style={{fontSize:11,color:K.dim,lineHeight:1.4,marginTop:8,fontStyle:"italic"}}>{m.desc}</div></div>})}</div>
      {/* Munger quote */}
      <div style={{marginTop:24,padding:"16px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12}}>
        <div style={{fontSize:13,color:K.mid,lineHeight:1.7,fontStyle:"italic"}}>{"\u201c"}The key to investing is not assessing how much an industry is going to affect society, or how much it will grow, but rather determining the competitive advantage of any given company and, above all, the durability of that advantage.{"\u201d"}</div>
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
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:16,padding:"48px 32px",textAlign:"center",marginTop:16}}>
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
          <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>{c.name} · {c.sector}{data&&data.source?<span style={{marginLeft:8,fontSize:10,padding:"2px 6px",borderRadius:_isBm?0:3,background:data.source==="sec-edgar"?K.grn+"15":K.acc+"15",color:data.source==="sec-edgar"?K.grn:K.acc}}>{"Source: "+(data.source==="sec-edgar"?"SEC EDGAR":"FMP")}</span>:""}</div></div>
        <div style={{display:"flex",gap:4}}>{["annual","quarter"].map(function(v){return<button key={v} onClick={function(){setPer(v)}} style={{padding:"6px 16px",fontSize:12,fontFamily:fm,fontWeight:per===v?600:400,background:per===v?K.acc+"20":"transparent",color:per===v?K.acc:K.dim,border:"1px solid "+(per===v?K.acc+"40":K.bdr),borderRadius:_isBm?0:6,cursor:"pointer"}}>{v==="annual"?"Annual":"Quarterly"}</button>})}
          <button onClick={exportFinancialsPDF} disabled={!data||ld} style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12,opacity:data&&!ld?1:.4,display:"flex",alignItems:"center",gap:5})}><IC name="file" size={12} color={K.mid}/>PDF</button></div></div>
      {/* Statement Tabs */}
      {isMobile?<div style={{marginBottom:16}}>
        <div style={{position:"relative"}}>
          <select value={tab} onChange={function(e){setTab(e.target.value)}} style={{width:"100%",background:K.card,border:"1px solid "+K.acc+"50",borderRadius:_isBm?0:12,color:K.txt,padding:"13px 44px 13px 18px",fontSize:15,fontFamily:fm,fontWeight:700,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
            {STMT_TABS.map(function(t){return<option key={t.id} value={t.id}>{t.l}</option>})}</select>
          <div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg></div></div>
      </div>:<div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid "+K.bdr}}>
        {STMT_TABS.map(function(t){return<button key={t.id} onClick={function(){setTab(t.id)}} style={{padding:"10px 20px",fontSize:13,fontFamily:fm,fontWeight:tab===t.id?600:400,color:tab===t.id?K.acc:K.dim,background:"transparent",border:"none",borderBottom:tab===t.id?"2px solid "+K.acc:"2px solid transparent",cursor:"pointer",marginBottom:-1}}>{t.l}</button>})}</div>}
      {ld?<div style={{padding:"32px 0"}}><div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:24}}>
        {[0,1,2,3,4,5].map(function(i){return<div key={i} style={{display:"flex",gap:12,marginBottom:12}}>
          <div className="ta-skel" style={{height:12,flex:1,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/>
          <div className="ta-skel" style={{height:12,width:80,background:K.bdr}}/></div>})}</div>
        <div style={{textAlign:"center",fontSize:12,color:K.dim,marginTop:16,fontFamily:fm}}>Loading {c.ticker} financial data from FMP...</div></div>:
      rows.length===0?<div style={{padding:60,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>No {stab.l.toLowerCase()} data available for {c.ticker}</div><div style={{fontSize:12,color:K.dim,lineHeight:1.8,maxWidth:500,margin:"0 auto"}}>
{isIntlTicker(c.ticker)
  ?"Detailed financial statements for TSX Venture and other international exchanges have limited coverage on our data plan. KPI checking and metrics (gross margin, ROIC etc.) use Finnhub which does support this ticker."
  :"Data is fetched from FMP (primary) with SEC EDGAR as fallback. This company may not have filings available."}<br/>
        {diag&&<div style={{marginTop:8,padding:"8px 12px",background:K.red+"10",border:"1px solid "+K.red+"20",borderRadius:_isBm?0:6,color:K.amb,fontSize:11,fontFamily:fm,textAlign:"left"}}>{diag}</div>}
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
        <button onClick={function(){setLd(true);setDiag("");delete _fincache[c.ticker+"-"+(per||"annual")];fetchFinancialStatements(c.ticker,per==="quarter"?"quarter":"annual").then(function(r){setData(r);setLd(false);var ic=(r&&r.income?r.income.length:0);if(ic===0)setDiag("Still 0 rows. Check browser console for details.")}).catch(function(e){setLd(false);setDiag("Error: "+e.message)})}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",color:K.acc,padding:"6px 14px",borderRadius:_isBm?0:6,fontSize:12,cursor:"pointer",fontFamily:fm}}>Retry</button></div></div></div>:
      <div>
      {/* Interactive multi-metric chart */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginBottom:20}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>
          {chartItems.map(function(ci,ci2){var isOn=chartSel.indexOf(ci.k)>=0;var col=isOn?CHART_COLORS[chartSel.indexOf(ci.k)%CHART_COLORS.length]:K.dim;
            return<button key={ci.k} onClick={function(){toggleChartMetric(ci.k)}} style={{padding:"3px 10px",fontSize:11,fontFamily:fm,background:isOn?col+"18":"transparent",color:isOn?col:K.dim,border:"1px solid "+(isOn?col+"40":"transparent"),borderRadius:_isBm?0:5,cursor:"pointer",whiteSpace:"nowrap",transition:"all .2s",fontWeight:isOn?600:400}}>
              {isOn&&<span style={{display:"inline-block",width:6,height:6,borderRadius:_isBm?1:"50%",background:col,marginRight:4}}/>}{ci.l}</button>})}</div>
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
              return<div style={{position:"absolute",left:Math.min(Math.max(tx,8),cW-170),top:8,background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"8px 12px",boxShadow:"0 4px 16px rgba(0,0,0,.2)",pointerEvents:"none",zIndex:10,minWidth:130}}>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>{per==="quarter"?((rows[hi]||{}).period||"")+" "+hovDate:hovDate.substring(0,4)}</div>
                {chartSeries.map(function(s){var pt=s.pts.find(function(p){return p.date===hovDate});if(!pt)return null;
                  var prev=s.pts[s.pts.indexOf(pt)-1];var yoy=prev&&prev.val!==0?((pt.val-prev.val)/Math.abs(prev.val)*100):null;
                  return<div key={s.key} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{width:6,height:6,borderRadius:_isBm?0:2,background:s.color,flexShrink:0}}/>
                    <span style={{fontSize:11,color:K.mid,fontFamily:fm,flex:1}}>{s.def.l}</span>
                    <span style={{fontSize:11,fontWeight:700,color:s.color,fontFamily:fm}}>{s.def.p?(pt.val*100).toFixed(1)+"%":s.def.sm?"$"+pt.val.toFixed(2):fmtBig(pt.val)}</span>
                    {yoy!=null&&<span style={{fontSize:8,color:yoy>=0?K.grn:K.red,fontFamily:fm}}>{yoy>=0?"+":""}{yoy.toFixed(0)}%</span>}</div>})}</div>})()}
          </div>})():<div style={{padding:20,textAlign:"center",fontSize:12,color:K.dim}}>Click metrics above to chart them</div>}
        {/* Legend */}
        {chartSeries.length>0&&<div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
          {chartSeries.map(function(s){return<div key={s.key} style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:8,height:3,borderRadius:_isBm?0:2,background:s.color}}/>
            <span style={{fontSize:10,color:s.color,fontFamily:fm,fontWeight:600}}>{s.def.l}</span></div>})}</div>}
      </div>
      {/* Full data table */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
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
  // ── AI Prompt Modal ───────────────────────────────────────
