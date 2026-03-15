"use client";
import React, { useState } from "react";
import { DARK } from "./constants";
import T from "./themeState";

// ═══ UI COMPONENTS ═══
// These components read theme flags from the shared themeState object (T).
// TrackerApp updates T on every render via page.js.

function TLogo(p){var s=p.size||28;var r=Math.round(s*0.22);if(T.isBm)return<div style={{width:s,height:s,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #F39F41",color:"#F39F41",fontFamily:"'Consolas','Courier New',monospace",fontSize:Math.round(s*0.38),fontWeight:700,letterSpacing:0,flexShrink:0,boxSizing:"border-box"}}>{"TA"}</div>;if(T.isForest)return<div style={{width:s,height:s,display:"flex",alignItems:"center",justifyContent:"center",background:"#58cc02",borderRadius:Math.round(s*0.28),color:"#ffffff",fontFamily:"'Nunito','DM Sans',sans-serif",fontSize:Math.round(s*0.36),fontWeight:800,letterSpacing:-0.5,flexShrink:0}}>{"TA"}</div>;if(T.isOcean)return<div style={{width:s,height:s,display:"flex",alignItems:"center",justifyContent:"center",background:"#1a56db",borderRadius:Math.round(s*0.18),color:"#ffffff",fontFamily:"'Inter',sans-serif",fontSize:Math.round(s*0.36),fontWeight:700,letterSpacing:-0.5,flexShrink:0}}>{"TA"}</div>;return<img src="/logo.png" width={s} height={s} style={{borderRadius:T.isThesis?r:6,objectFit:"contain"}} alt="T"/>;}
// (sector suggestions removed — using predefined METRICS dropdown)
function CoLogo(p){var _s=useState(0),a=_s[0],sA=_s[1];var sz=p.size||24;
  if(p.domain&&a===0)return<img src={"https://www.google.com/s2/favicons?domain="+p.domain+"&sz=128"} width={sz} height={sz} style={{borderRadius:T.isBm?0:4,background:"transparent",objectFit:"contain",flexShrink:0}} onError={function(){sA(1)}} loading="lazy" alt=""/>;
  if(p.domain&&a===1)return<img src={"https://logo.clearbit.com/"+p.domain} width={sz} height={sz} style={{borderRadius:T.isBm?0:4,background:"transparent",objectFit:"contain",flexShrink:0}} onError={function(){sA(2)}} loading="lazy" alt=""/>;
  return<div style={{width:sz,height:sz,borderRadius:T.isBm?0:4,background:"rgba(128,128,128,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*.4,fontWeight:700,color:"rgba(128,128,128,.6)",fontFamily:T.T.fm,flexShrink:0}}>{(p.ticker||"?")[0]}</div>}
// ── Icon System (clean line SVGs, NotebookLM-inspired) ──
function IC(p){var s=p.size||16,c=p.color||"currentColor",w=p.strokeWidth||1.8;
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
    msg:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
  };
  var d=paths[p.name]||paths.file;
  return<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={p.style||{flexShrink:0}}><path d={d}/></svg>}

function mkS(K){
  var th=T.isThesis;
  var br=th?999:T.isBm?0:T.isForest?999:T.isOcean?4:T.isPurple?10:8;
  var btnBase={cursor:"pointer",fontFamily:T.T.fm,transition:"all .15s ease",fontSize:th?13:12,fontWeight:th?700:400};
  var _mkDark=K.bg==="#16161D"||K.bg==="#0F0F14"||K.bg==="#0a0a0f"||K.bg==="#1a1a1a"||K.bg==="#0d1117"||K.bg==="#0a0e1a"||K.bg==="#1a1a2e";  var cardShadow=th?(_mkDark?"0 2px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15)":"0 4px 20px rgba(0,0,0,0.10), 0 1px 6px rgba(107,76,230,0.07), 0 0 0 1px rgba(0,0,0,0.04)"):"none";
  return{
    btn:Object.assign({},btnBase,{background:"transparent",border:"1px solid "+(T.isBm?K.acc+"50":th?"rgba(255,255,255,0.1)":K.bdr),color:T.isBm?K.acc:th?K.txt:K.mid,padding:th?"9px 20px":T.isBm?"5px 10px":"8px 16px",borderRadius:br,fontSize:T.isBm?11:undefined}),
    btnP:Object.assign({},btnBase,{background:T.isBm?K.acc:K.prim,border:"1px solid "+(T.isBm?K.acc:K.prim),color:K.primTxt,padding:th?"11px 28px":T.isBm?"5px 12px":T.isForest?"10px 22px":"9px 18px",borderRadius:br,fontWeight:700,fontSize:T.isBm?11:undefined,boxShadow:"none",letterSpacing:T.isBm?1.5:th?"-0.2px":0,textTransform:T.isBm?"uppercase":"none"}),
    btnD:Object.assign({},btnBase,{background:"transparent",border:"1px solid #7F1D1D",color:K.red,padding:th?"9px 20px":"8px 16px",borderRadius:br}),
    btnChk:Object.assign({},btnBase,{background:_mkDark?K.acc+"18":K.acc+"22",border:"1px solid "+K.acc+(_mkDark?"40":"60"),color:K.acc,padding:th?"11px 24px":"9px 18px",borderRadius:br,fontWeight:700,boxShadow:_mkDark?"none":"inset 0 1px 0 rgba(255,255,255,0.6)"}),
    sec:{fontSize:th?11:T.isBm?10:11,letterSpacing:th?0.5:(T.isBm?1.5:1),textTransform:"uppercase",color:th?K.acc:(T.isBm?K.acc:K.dim),marginBottom:th?16:T.isBm?8:12,fontWeight:700,fontFamily:T.T.fm,display:"flex",alignItems:"center",gap:8},
    badge:function(c){return{display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:th?700:500,color:c,background:c+"18",padding:th?"4px 14px":"3px 10px",borderRadius:th?999:6,fontFamily:T.T.fm}},
    dot:function(s){return{width:T.isBm?6:8,height:T.isBm?6:8,borderRadius:T.isBm?1:"50%",background:s==="met"?"#22C55E":s==="missed"?"#EF4444":"#555",flexShrink:0}},
    card:{background:K.card,border:"1px solid "+(T.isBm?K.acc+"25":T.isPurple?"rgba(167,139,250,0.15)":K.bdr),borderRadius:th?20:T.isBm?0:T.isForest?16:T.isOcean?8:T.isPurple?12:6,padding:th?"24px 28px":T.isBm?"10px 14px":"16px 20px",boxShadow:T.isBm?"none":T.isPurple?"0 4px 24px rgba(167,139,250,0.08)":T.isOcean?"0 2px 8px rgba(26,86,219,0.06)":T.isForest?"0 2px 10px rgba(88,204,2,0.07)":cardShadow},
    inp:{width:"100%",boxSizing:"border-box",background:T.isBm?K.card:th?"rgba(255,255,255,0.05)":K.bg,border:"1px solid "+(T.isBm?K.acc+"50":K.bdr),borderRadius:th?14:(T.isBm?0:6),color:K.txt,padding:th?"12px 18px":"10px 14px",fontSize:14,fontFamily:T.T.fm,outline:"none"},
  }
}
function Modal(p){var K=p.K||DARK;var mob=typeof window!=="undefined"&&window.innerWidth<768;var th=T.isThesis;return<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(12px)",animation:"fadeInFast .15s ease-out"}} onClick={p.onClose}><div className="ta-slide ta-modal-inner" style={{background:K.card,border:mob?"none":"1px solid "+K.bdr2,borderRadius:mob?(th?"28px 28px 0 0":T.isBm?"0":"16px 16px 0 0"):th?28:(T.isBm?0:16),boxShadow:T.isBm?"0 0 0 1px #F39F4130,0 8px 32px rgba(0,0,0,0.8)":undefined,padding:mob?th?"28px 24px 36px":"24px 20px 32px":th?"32px 36px":"28px 32px",width:mob?"100%":p.w||500,maxWidth:mob?"100%":"92vw",maxHeight:mob?"90vh":"85vh",overflowY:"auto",boxShadow:th?"0 32px 80px rgba(0,0,0,.5)":"0 24px 64px rgba(0,0,0,.4)"}} onClick={function(e){e.stopPropagation()}}>{p.title?<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:th?28:24}}><h2 style={{margin:0,fontSize:mob?17:th?18:17,fontWeight:th?800:500,color:K.txt,fontFamily:T.T.fh,letterSpacing:th?"-0.5px":0}}>{p.title}</h2><button onClick={p.onClose} style={{background:th?"rgba(255,255,255,0.08)":"none",border:"none",color:K.dim,fontSize:17,cursor:"pointer",padding:mob?"10px 14px":"6px 10px",borderRadius:th?999:6,lineHeight:1}} onMouseEnter={function(e){e.currentTarget.style.color=K.txt}} onMouseLeave={function(e){e.currentTarget.style.color=K.dim}}>{"✕"}</button></div>:<div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}><button onClick={p.onClose} style={{background:"none",border:"none",color:K.dim,fontSize:16,cursor:"pointer",padding:"6px 10px",borderRadius:T.isBm?0:6,lineHeight:1}} onMouseEnter={function(e){e.currentTarget.style.color=K.txt}} onMouseLeave={function(e){e.currentTarget.style.color=K.dim}}>{"✕"}</button></div>}{p.children}</div></div>}
function Inp(p){var K=p.K||DARK;var th=T.isThesis;var b={width:"100%",boxSizing:"border-box",background:th?"rgba(255,255,255,0.05)":K.bg,border:"1px solid "+K.bdr,borderRadius:th?14:6,color:K.txt,padding:th?"12px 18px":"10px 14px",fontSize:typeof window!=="undefined"&&window.innerWidth<768?16:14,fontFamily:T.T.fm,outline:"none"};return<div style={{marginBottom:18}}>{p.label&&<label style={{display:"block",fontSize:th?12:11,color:K.dim,marginBottom:th?8:6,letterSpacing:th?0:.5,textTransform:th?"none":"uppercase",fontFamily:T.T.fm,fontWeight:th?600:400}}>{p.label}</label>}{p.ta?<textarea value={p.value} onChange={function(e){p.onChange(e.target.value)}} placeholder={p.placeholder} rows={3} style={Object.assign({},b,{resize:"vertical"})}/>:<input type={p.type||"text"} value={p.value} onChange={function(e){p.onChange(e.target.value)}} placeholder={p.placeholder} spellCheck={p.spellCheck!==undefined?p.spellCheck:true} autoCorrect={p.autoCorrect||"on"} autoComplete={p.autoComplete||"on"} style={b}/>}</div>}
function Sel(p){var K=p.K||DARK;var th=T.isThesis;return<div style={{marginBottom:18}}>{p.label&&<label style={{display:"block",fontSize:th?12:11,color:K.dim,marginBottom:th?8:6,letterSpacing:th?0:.5,textTransform:th?"none":"uppercase",fontFamily:T.T.fm,fontWeight:th?600:400}}>{p.label}</label>}<select value={p.value} onChange={function(e){p.onChange(e.target.value)}} style={{width:"100%",boxSizing:"border-box",background:th?"rgba(255,255,255,0.05)":K.bg,border:"1px solid "+K.bdr,borderRadius:th?14:6,color:K.txt,padding:th?"12px 18px":"10px 14px",fontSize:14,fontFamily:T.T.fm,outline:"none"}}>{p.options.map(function(o){return<option key={o.v} value={o.v}>{o.l}</option>})}</select></div>}


export { TLogo, CoLogo, IC, mkS, Modal, Inp, Sel };
