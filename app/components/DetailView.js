"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { DARK, THEMES, METRIC_MAP, INVEST_STYLES, STYLE_MAP, INVESTOR_PROFILES, PROFILE_MAP, SUPERINVESTORS, MSTAR_RATINGS, FOLDERS } from "./constants";
import { calcMastery, calcOwnerScore, classifyPortfolio, dU, fD, fT, nId, gH, bT, eS, autoFormat, buildPrompt, calcMoatFromData, calcAlignmentSignals, calcMorningSignals, fmtBig, getValMetricValue } from "./utils";

export default function DetailView({
  cos,
  sel,
  selId,
  setSelId,
  page,
  setPage,
  subPage,
  setSubPage,
  modal,
  setModal,
  detailTab,
  setDetailTab,
  setHubTab,
  K,
  S,
  fm,
  fh,
  fb,
  isMobile,
  _isBm,
  _isThesis,
  isThesis,
  IC,
  CoLogo,
  Modal,
  goals,
  library,
  dashSet,
  investorProfile,
  isPro,
  requirePro,
  setShowUpgrade,
  setUpgradeCtx,
  showToast,
  upd,
  cSym,
  sideTab,
  setAiModal,
  parseThesis,
  saveInvestorProfile,
  setGuidedSetup,
  guidedSetup,
}) {
  // ── Prop guards ──
  cos = cos || [];
  dashSet = dashSet || {};
  goals = goals || {};
  library = library || {};
  library.items = library.items || [];
  library.folders = library.folders || [];

  // ── Array prop guards ──
  cos = cos || [];

  var checkSt={};
if(!sel)return null;var c=sel;var h=gH(c.kpis);var cs=checkSt[c.id];var pos=c.position||{};var conv=c.conviction||0;
    var _sm=useState(false),showMore=_sm[0],setShowMore=_sm[1];
    // Moat data for dossier display
    var _moatD=useState(null),dossierMoat=_moatD[0],setDossierMoat=_moatD[1];
    var _mktOpen=useState(true),dossierMktOpen=_mktOpen[0],setDossierMktOpen=_mktOpen[1];
    var _keyFin=useState(null),keyFin=_keyFin[0],setKeyFin=_keyFin[1];
    var _hovD=useState(null),hovD=_hovD[0],setHovD=_hovD[1];
    var _descExp=useState(false),descExpanded=_descExp[0],setDescExpanded=_descExp[1];
    var _insiderData=useState(null),insiderData=_insiderData[0],setInsiderData=_insiderData[1];
    var _peersData=useState(null),peersData=_peersData[0],setPeersData=_peersData[1];
    var _peersLd=useState(false),peersLoading=_peersLd[0],setPeersLoading=_peersLd[1];
    useEffect(function(){if(!c||!isPro){setInsiderData(null);return}
      Promise.all([fetchInsiders(c.ticker).catch(function(){return[]}),fetchInstitutionalHolders(c.ticker).catch(function(){return[]})]).then(function(res){
        setInsiderData({transactions:res[0],institutions:res[1]})}).catch(function(){setInsiderData(null)})},[c&&c.ticker,isPro]);
    useEffect(function(){if(!c)return;setPeersLoading(true);
      fetchPeers(c.ticker).then(function(tickers){
        if(!tickers||!tickers.length){setPeersData([]);setPeersLoading(false);return}
        Promise.all(tickers.slice(0,6).map(function(tk){
          return fetchFMPMetrics(tk).then(function(m){return{ticker:tk,metrics:m}}).catch(function(){return{ticker:tk,metrics:null}})
        })).then(function(results){
          setPeersData(results.filter(function(r){return r.metrics}));
          setPeersLoading(false);
        }).catch(function(){setPeersData([]);setPeersLoading(false)})
      }).catch(function(){setPeersData([]);setPeersLoading(false)})
    },[c&&c.ticker]);
    useEffect(function(){
      // Backfill description from FMP profile if missing (free for all users)
      if(!c.description){fmp("profile/"+c.ticker).then(function(p){
        if(p&&p.length&&p[0].description){upd(c.id,{description:p[0].description||"",ceo:p[0].ceo||"",employees:p[0].fullTimeEmployees||0,country:p[0].country||"",exchange:p[0].exchangeShortName||p[0].exchange||"",ipoDate:p[0].ipoDate||"",mktCap:p[0].mktCap||0})}}).catch(function(){})}
      // Financial data for moat + key metrics (Pro only)
      if(!isPro)return;
      fetchFinancialStatements(c.ticker,"annual").then(function(r){
        if(r){setDossierMoat(calcMoatFromData(r));
          var inc=r.income||[];var cf=r.cashflow||[];
          var pts=(inc||[]).map(function(row,i){var cfRow=cf[i]||{};return{date:row.date,revenue:row.revenue,netIncome:row.netIncome,fcf:cfRow.freeCashFlow||cfRow.operatingCashFlow,sbc:cfRow.stockBasedCompensation||row.stockBasedCompensation}}).filter(function(p){return p.revenue!=null});
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
    return<div className="ta-detail-pad" style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 36px 60px",maxWidth:860}}>
      {/* Thesis staleness + conviction drift banners */}
      {(_thesisStale||_tScore>0)&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:_thesisStale&&c.thesisNote?0:8}}>
        {_tScore>0&&<div style={{display:"flex",alignItems:"center",gap:5,background:_tScoreColor+"12",border:"1px solid "+_tScoreColor+"30",borderRadius:_isBm?0:6,padding:"4px 10px"}}>
          <span style={{fontSize:10,fontWeight:700,color:_tScoreColor,fontFamily:fm}}>{_tScore}%</span>
          <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>thesis quality</span>
        </div>}
        {c.thesisUpdatedAt&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>· {_thesisStaleBadge}</span>}
      </div>}
      {_thesisStale&&c.thesisNote&&<div style={{background:K.amb+"12",border:"1px solid "+K.amb+"40",borderRadius:_isBm?0:8,padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8,fontSize:12,color:K.amb}}>
        <IC name="alert" size={14} color={K.amb}/>
        <span>Thesis last updated <strong>{_thesisStaleBadge}</strong> — worth a review?</span>
        <button onClick={function(){setDetailTab("dossier");setTimeout(function(){document.getElementById("thesis-editor")&&document.getElementById("thesis-editor").focus()},100)}} style={{marginLeft:"auto",background:"none",border:"1px solid "+K.amb+"60",borderRadius:_isBm?0:4,padding:"2px 8px",fontSize:11,color:K.amb,cursor:"pointer",fontFamily:fm,fontWeight:600,whiteSpace:"nowrap"}}>Review Now</button>
      </div>}
      {_convDrift&&<div style={{background:K.blue+"10",border:"1px solid "+K.blue+"30",borderRadius:_isBm?0:8,padding:"8px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:8,fontSize:12,color:K.blue}}>
        <IC name="target" size={14} color={K.blue}/>
        <span>Conviction last updated <strong>{_convDriftDays}d ago</strong> — still feels right?</span>
      </div>}
      {/* ── Mobile back ── */}
      {isMobile&&<button onClick={function(){setSelId(null)}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:K.mid,fontSize:13,cursor:"pointer",padding:"10px 0 2px",fontFamily:fm}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Portfolio</button>}
      {/* ── Simplified Header ── */}
      <div className="ta-detail-head" style={{padding:isMobile?"16px 0 14px":"36px 0 24px",borderBottom:"1px solid "+K.bdr+"50",marginBottom:8}}>
        {/* Top row: logo + name + conviction */}
        <div style={{display:"flex",alignItems:"center",gap:isMobile?12:16,marginBottom:10}}>
          <div style={{width:isMobile?48:56,height:isMobile?48:56,borderRadius:_isBm?0:14,background:"linear-gradient(135deg,"+K.acc+"18,"+K.acc+"06)",border:"1px solid "+K.acc+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <CoLogo domain={c.domain} ticker={c.ticker} size={isMobile?36:44}/>
            </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:isMobile?24:32,fontWeight:900,color:K.txt,fontFamily:fh,letterSpacing:"-1px",lineHeight:1}}>{c.ticker}</span>
              <span style={{fontSize:isMobile?13:16,color:K.mid,fontWeight:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:isMobile?160:360}}>{c.name}</span>
            </div>
            <div style={{display:"flex",gap:8,marginTop:5,alignItems:"center",flexWrap:"wrap"}}>
              {c.sector&&<span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{c.sector}</span>}
              {c.sector&&(c.investStyle||true)&&<span style={{color:K.bdr,fontSize:11}}>·</span>}
              {c.investStyle&&STYLE_MAP[c.investStyle]&&<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:600,color:STYLE_MAP[c.investStyle].color,background:STYLE_MAP[c.investStyle].color+"12",padding:"1px 7px",borderRadius:_isBm?0:4,fontFamily:fm,cursor:"pointer"}} onClick={function(){setModal({type:"edit"})}}><IC name={STYLE_MAP[c.investStyle].icon} size={10} color={STYLE_MAP[c.investStyle].color}/>{STYLE_MAP[c.investStyle].label}</span>}
              <button onClick={function(){var next=c.status==="portfolio"?"watchlist":c.status==="watchlist"?"toohard":"portfolio";upd(c.id,{status:next})}} style={{background:(c.status||"portfolio")==="portfolio"?K.grn+"15":c.status==="toohard"?K.red+"15":K.amb+"15",border:"1px solid "+((c.status||"portfolio")==="portfolio"?K.grn+"30":c.status==="toohard"?K.red+"30":K.amb+"30"),borderRadius:_isBm?0:4,padding:"1px 7px",fontSize:10,color:(c.status||"portfolio")==="portfolio"?K.grn:c.status==="toohard"?K.red:K.amb,cursor:"pointer",fontFamily:fm,fontWeight:600}}>{(c.status||"portfolio")==="portfolio"?"Portfolio":c.status==="toohard"?"Too Hard":"Watchlist"}</button>
            </div>
          </div>
          {/* Conviction badge - right side */}
          {conv>0&&<div onClick={function(){setModal({type:"conviction"})}} style={{cursor:"pointer",textAlign:"center",flexShrink:0,background:conv>=7?K.grn+"12":conv>=4?K.amb+"12":K.red+"12",border:"1px solid "+(conv>=7?K.grn+"30":conv>=4?K.amb+"30":K.red+"30"),borderRadius:_isBm?0:12,padding:"8px 14px"}}>
            <div style={{fontSize:isMobile?22:26,fontWeight:800,color:conv>=7?K.grn:conv>=4?K.amb:K.red,fontFamily:fm,lineHeight:1}}>{conv}</div>
            <div style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginTop:2}}>conviction</div>
          </div>}
        </div>
        {/* Second row: earnings + quick actions */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <IC name="target" size={12} color={dU(c.earningsDate)>=0&&dU(c.earningsDate)<=7?K.amb:K.dim}/>
            <span style={{fontSize:12,color:dU(c.earningsDate)>=0&&dU(c.earningsDate)<=7?K.amb:K.dim,fontFamily:fm}}>
              {c.earningsDate==="TBD"?"Earnings TBD":c.earningsDate?("Earnings "+fD(c.earningsDate)+(c.earningsTime?" · "+c.earningsTime:"")):"No earnings date"}
            </span>
            {dU(c.earningsDate)>=0&&dU(c.earningsDate)<=7&&<span style={{fontSize:10,fontWeight:700,color:K.amb,background:K.amb+"15",padding:"1px 7px",borderRadius:_isBm?0:3,fontFamily:fm}}>{dU(c.earningsDate)===0?"Today":dU(c.earningsDate)===1?"Tomorrow":dU(c.earningsDate)+"d"}</span>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {c.irUrl&&<a href={c.irUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:K.acc,textDecoration:"none",display:"flex",alignItems:"center",gap:3,padding:"4px 9px",borderRadius:_isBm?0:6,border:"1px solid "+K.bdr,fontFamily:fm}}>IR ↗</a>}
            <button style={{fontSize:11,color:K.mid,background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,padding:"4px 9px",cursor:"pointer",fontFamily:fm}} onClick={function(){setModal({type:"edit"})}}>Edit</button>
            {!isMobile&&<button style={{fontSize:11,color:K.mid,background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,padding:"4px 9px",cursor:"pointer",fontFamily:fm}} onClick={function(){exportPDF()}}>PDF</button>}
          </div>
        </div>
      </div>
      {/* ── Mobile section anchors ── */}
      {isMobile&&<div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:2}}>
        {[{label:"Thesis",anchor:"ds-story"},{label:"Evidence",anchor:"ds-evidence"},{label:"Numbers",anchor:"ds-numbers"},{label:"Research",anchor:"ds-research"}].map(function(s){return<button key={s.anchor} onClick={function(){var el=document.getElementById(s.anchor);if(el)el.scrollIntoView({behavior:"smooth",block:"start"})}} style={{flexShrink:0,padding:"6px 16px",borderRadius:_isBm?0:999,border:"1px solid "+K.bdr,background:"transparent",color:K.mid,fontSize:11,fontFamily:fm,cursor:"pointer",fontWeight:500,letterSpacing:0.3}}>{s.label}</button>})}
      </div>}
      {/* ── Company view (dossier always shown, no tab UI) ── */}
      {detailTab==="dossier"&&<div className="ta-fade">
        {!subPage&&<div>
        {/* First-visit profile prompt */}
        {!selId&&sideTab==="portfolio"&&(!investorProfile||investorProfile==="custom")&&cos.length>0&&!isMobile&&(function(){
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:"20px 24px",marginBottom:20}}>
            <div style={{fontSize:15,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:4}}>Which investor do you identify with most?</div>
            <div style={{fontSize:13,color:K.dim,marginBottom:16}}>This shapes your dashboard — what it prioritises, what the morning brief surfaces, how your dossier is organised.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
              {INVESTOR_PROFILES.filter(function(p){return p.id!=="custom"}).map(function(prof){
                return<button key={prof.id} onClick={function(){saveInvestorProfile(prof.id)}}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",
                    borderRadius:_isBm?0:10,border:"1px solid "+prof.color+"40",
                    background:prof.color+"0d",cursor:"pointer",transition:"all .15s"}}
                  onMouseEnter={function(e){e.currentTarget.style.background=prof.color+"20"}}
                  onMouseLeave={function(e){e.currentTarget.style.background=prof.color+"0d"}}>
                  <IC name={prof.icon} size={14} color={prof.color}/>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontSize:13,fontWeight:700,color:prof.color,fontFamily:fm}}>{prof.name}</div>
                    <div style={{fontSize:10,color:K.dim,fontFamily:fm,maxWidth:160}}>{prof.tagline}</div>
                  </div>
                </button>;
              })}
            </div>
            <button onClick={function(){saveInvestorProfile("custom")}} style={{fontSize:11,color:K.dim,background:"none",border:"none",cursor:"pointer",fontFamily:fm}}>Skip — I'll set this later →</button>
          </div>;
        })()}
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
          return<div style={{background:K.acc+"06",border:"1px solid "+K.acc+"20",borderRadius:_isBm?0:12,padding:"16px 20px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div><div style={{fontSize:14,fontWeight:600,color:K.txt}}>Set up {c.ticker}</div>
                <div style={{fontSize:12,color:K.dim,marginTop:2}}>Step {currentStep+1} of {steps.length}</div></div>
              <button onClick={function(){setGuidedSetup(null)}} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",fontFamily:fm,padding:"2px 8px"}}>Skip</button></div>
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              {(steps||[]).map(function(s,i){return<div key={s.id} style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:s.done?K.grn:i===currentStep?K.acc:K.bdr,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {s.done?<svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" fill="none"/></svg>
                    :<span style={{fontSize:10,fontWeight:700,color:i===currentStep?"#fff":K.dim}}>{i+1}</span>}</div>
                <span style={{fontSize:11,color:s.done?K.grn:i===currentStep?K.txt:K.dim,fontWeight:i===currentStep?600:400,fontFamily:fm}}>{s.label}</span>
                {i<steps.length-1&&<div style={{flex:1,height:1,background:s.done?K.grn:K.bdr}}/>}</div>})}</div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:K.card,borderRadius:_isBm?0:8,border:"1px solid "+K.bdr}}>
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
          return<div style={{background:K.bg,borderRadius:_isBm?0:10,padding:"12px 16px",marginBottom:16,border:"1px solid "+K.bdr}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={{fontSize:11,letterSpacing:1,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm}}>Owner Checklist</span>
              <span style={{fontSize:11,color:doneCount>=3?K.grn:K.dim,fontFamily:fm,fontWeight:600}}>{doneCount}/{items.length}</span></div>
            <div style={{display:"flex",gap:6}}>
              {(items||[]).map(function(it){return<button key={it.id} onClick={it.done?undefined:it.action} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 4px",borderRadius:_isBm?0:8,background:it.done?K.grn+"08":"transparent",border:"1px solid "+(it.done?K.grn+"25":K.bdr),cursor:it.done?"default":"pointer",opacity:it.done?.7:1,transition:"all .15s"}} onMouseEnter={function(e){if(!it.done)e.currentTarget.style.borderColor=K.acc}} onMouseLeave={function(e){if(!it.done)e.currentTarget.style.borderColor=K.bdr}}>
                {it.done?<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={K.grn+"20"} stroke={K.grn} strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke={K.grn} strokeWidth="1.5" fill="none"/></svg>
                  :<IC name={it.icon} size={14} color={K.dim}/>}
                <span style={{fontSize:10,color:it.done?K.grn:K.mid,fontFamily:fm,fontWeight:it.done?600:400}}>{it.label}</span></button>})}</div></div>})()}
        {/* Company Summary — auto-fetched from FMP */}
        {c.description&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginBottom:20}}>
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
          return<div style={{background:urgency+"08",border:"2px solid "+urgency+"30",borderRadius:_isBm?0:14,padding:"18px 20px",marginBottom:24,position:"relative",overflow:"hidden"}}>
            {/* Countdown pulse */}
            {daysOut<=2&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,"+urgency+","+urgency+"60,"+urgency+")",animation:"shimmer 2s infinite"}}/>}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:38,height:38,borderRadius:_isBm?0:10,background:urgency+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
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
              {(checklist||[]).map(function(it){return<div key={it.id} onClick={function(){if(!it.done){tickItem(it.id);showToast(it.label+" ✓","info",2000);upd(c.id,{})}}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:_isBm?0:8,background:it.done?(K.grn+"10"):(K.card),border:"1px solid "+(it.done?(K.grn+"30"):K.bdr),cursor:it.done?"default":"pointer",transition:"all .15s"}} onMouseEnter={function(e){if(!it.done)e.currentTarget.style.borderColor=urgency+"60"}} onMouseLeave={function(e){if(!it.done)e.currentTarget.style.borderColor=K.bdr}}>
                <div style={{width:18,height:18,borderRadius:_isBm?0:5,background:it.done?K.grn:"transparent",border:"2px solid "+(it.done?K.grn:K.bdr),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                  {it.done&&<span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
                </div>
                <span style={{fontSize:11,color:it.done?K.grn:K.mid,fontFamily:fm,fontWeight:it.done?600:400}}>{it.label}</span>
              </div>})}
            </div>
            {/* KPI targets */}
            {c.kpis.length>0&&<div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Watch These Numbers</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {(c.kpis||[]).map(function(k){return<div key={k.id} style={{padding:"4px 10px",borderRadius:_isBm?0:6,background:K.card,border:"1px solid "+K.bdr,fontSize:11,fontFamily:fm,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{color:K.txt,fontWeight:600}}>{k.name}</span>
                  <span style={{color:K.dim}}>→ {k.target}</span>
                </div>})}
              </div>
            </div>}
            {/* Conviction + quick thesis preview */}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {c.conviction>0&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:_isBm?0:6,background:K.card,border:"1px solid "+K.bdr,fontSize:11,fontFamily:fm}}>
                <div style={{display:"flex",gap:1.5,alignItems:"flex-end"}}>
                  {Array.from({length:10},function(_,i){return<div key={i} style={{width:3,borderRadius:1,background:i<c.conviction?(c.conviction>=7?K.grn:c.conviction>=5?K.acc:K.amb):K.bdr+"60",height:i<c.conviction?(6+i*0.8)+"px":"4px",transition:"height .3s"}}/>})}
                </div>
                <span style={{color:K.mid,fontSize:10}}>{c.conviction+"/10"}</span>
              </div>}
              <button onClick={function(){setModal({type:"thesis"})}} style={{background:"none",border:"1px solid "+urgency+"30",borderRadius:_isBm?0:6,padding:"4px 10px",fontSize:11,color:urgency,fontFamily:fm,cursor:"pointer"}}>Review thesis →</button>
              {allDone&&<span style={{marginLeft:"auto",fontSize:11,color:K.grn,fontFamily:fm,fontWeight:600}}>✓ You're prepared</span>}
            </div>
          </div>
        })()}

        {/* ── OWNER'S SCORECARD ── */}
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:"16px 20px",marginBottom:20,display:"flex",flexWrap:"wrap",gap:0}}>
          {[
            {label:"Conviction",value:conv>0?conv+"/10":"—",sub:conv>=7?"High":conv>=4?"Medium":conv>0?"Low":"Unrated",color:conv>=7?K.grn:conv>=4?K.amb:conv>0?K.red:K.dim,onClick:function(){setModal({type:"conviction"})}},
            {label:"Thesis",value:_tScore+"%",sub:_tScore>=80?"Strong":_tScore>=50?"Developing":"Weak",color:_tScoreColor,onClick:function(){setModal({type:"thesis"})}},
            {label:"KPIs",value:h.m>0?h.ok+"/"+h.m:"None",sub:h.m>0?(h.ok===h.m?"All met":h.ok>0?"Partial":"Missed"):"Add KPIs",color:h.m>0?(h.ok===h.m?K.grn:h.ok>0?K.amb:K.red):K.dim,onClick:function(){setDetailTab("dossier")}},
            {label:"Held",value:(function(){if(!c.purchaseDate)return"—";var d=Math.ceil((Date.now()-new Date(c.purchaseDate))/864e5);if(d<=0||d>18250)return"—";return d<30?d+"d":d<365?Math.floor(d/30)+"mo":Math.floor(d/365)+"yr"+(Math.floor((d%365)/30)>0?" "+Math.floor((d%365)/30)+"mo":"")})(),sub:(function(){if(!c.purchaseDate)return"Set date";var d=Math.ceil((Date.now()-new Date(c.purchaseDate))/864e5);return d<90?"Short term":d<730?"Medium term":"Long term"})(),color:K.mid,onClick:function(){setModal({type:"position"})}},
            {label:"Return",value:(function(){var p2=c.position||{};if(!p2.avgCost||!p2.currentPrice)return"—";return((p2.currentPrice-p2.avgCost)/p2.avgCost*100).toFixed(1)+"%"})(),sub:(function(){var p2=c.position||{};if(!p2.avgCost||!p2.currentPrice)return"No position";var r=(p2.currentPrice-p2.avgCost)/p2.avgCost*100;return r>=20?"Performing":r>=0?"Positive":r>=-10?"Small loss":"Deep loss"})(),color:(function(){var p2=c.position||{};if(!p2.avgCost||!p2.currentPrice)return K.dim;var r=(p2.currentPrice-p2.avgCost)/p2.avgCost*100;return r>=0?K.grn:K.red})(),onClick:function(){setModal({type:"position"})}},
            {label:"Thesis age",value:_thesisStaleBadge,sub:_thesisStale?"Needs review":_thesisAgeDays!=null&&_thesisAgeDays<30?"Fresh":"OK",color:_thesisStale?K.amb:K.grn,onClick:function(){setModal({type:"thesis"})}},
          ].map(function(item,i){return<div key={i} onClick={item.onClick} style={{flex:"1 1 0",minWidth:80,padding:"6px 12px",cursor:"pointer",borderLeft:i>0?"1px solid "+K.bdr:"none",textAlign:"center"}}
            onMouseEnter={function(e){e.currentTarget.style.background=K.bg}}
            onMouseLeave={function(e){e.currentTarget.style.background="transparent"}}>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:.5,textTransform:"uppercase",marginBottom:4}}>{item.label}</div>
            <div style={{fontSize:17,fontWeight:800,color:item.color,fontFamily:fm,lineHeight:1,marginBottom:2}}>{item.value}</div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>{item.sub}</div>
          </div>})}
        </div>

        {/* ── 1. THE STORY ── */}
        <div id="ds-story" style={{marginBottom:48}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:3,height:22,borderRadius:_isBm?0:2,background:K.acc,flexShrink:0}}/>
              <div>
                <div style={{fontSize:14,letterSpacing:1,textTransform:"uppercase",color:K.txt,fontFamily:fh,fontWeight:800}}>Thesis</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:1,letterSpacing:0.2}}>Your investment case</div>
              </div>
              {(sel.thesisVersions||[]).length>0&&<span style={{fontSize:9,fontWeight:700,color:K.acc,background:K.acc+"12",border:"1px solid "+K.acc+"25",borderRadius:_isBm?0:4,padding:"1px 7px",fontFamily:fm,letterSpacing:0.5}}>{"v"+(sel.thesisVersions.length+1)}</span>}
              {_thesisAgeDays!=null&&_thesisAgeDays>0&&<span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{_thesisAgeDays>365?Math.floor(_thesisAgeDays/365)+"y ago":_thesisAgeDays>30?Math.floor(_thesisAgeDays/30)+"mo ago":_thesisAgeDays+"d ago"}</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {(sel.thesisVersions||[]).length>=1&&<button onClick={function(){setModal({type:"thesisDiary"})}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:5,color:K.dim,fontSize:10,cursor:"pointer",fontFamily:fm,padding:"3px 9px",display:"flex",alignItems:"center",gap:4}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                History
              </button>}
              {sel.thesisNote&&sel.thesisNote.trim().length>20&&<button onClick={function(){setModal({type:"shareThesis"})}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:5,color:K.dim,fontSize:10,cursor:"pointer",fontFamily:fm,padding:"3px 9px",display:"flex",alignItems:"center",gap:4}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share
              </button>}
              <button onClick={function(){setModal({type:"thesis"})}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><IC name="edit" size={10} color={K.acc}/>Edit</button>
            </div></div>
          {c.thesisNote?(function(){var sec=parseThesis(c.thesisNote);
            return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:isMobile?"20px 20px":"28px 32px"}}>
              {(function(){
                var LIMIT=280;
                var _sm2=useState(sec.core.length<=LIMIT),showFullCore=_sm2[0],setShowFullCore=_sm2[1];
                return<div>
                  <div style={{fontSize:16,color:K.txt,lineHeight:1.9,marginBottom:4,fontFamily:"'Lora', serif",fontStyle:"italic",fontWeight:400}}>
                    {showFullCore?sec.core:sec.core.slice(0,LIMIT)+(sec.core.length>LIMIT?"...":"")}
                  </div>
                  {sec.core.length>LIMIT&&<button onClick={function(){setShowFullCore(function(v){return!v})}} style={{background:"none",border:"none",color:K.acc,fontSize:12,cursor:"pointer",padding:"2px 0",fontFamily:fm,marginBottom:sec.moat||sec.risks||sec.sell?20:0,display:"flex",alignItems:"center",gap:4}}>
                    {showFullCore
                      ?<><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>{"Show less"}</>
                      :<><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>{"Read more"}</>}
                  </button>}
                </div>;
              })()}
              {sec.moat&&<div style={{padding:"14px 18px",background:K.bg,borderRadius:_isBm?0:10,borderLeft:"3px solid "+K.grn,marginBottom:10}}>
                <div style={{fontSize:9,fontWeight:700,color:K.grn,fontFamily:fm,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{"Moat — Why it’s defensible"}</div>
                <div style={{fontSize:13,color:K.mid,lineHeight:1.7}}>{sec.moat}</div></div>}
              {sec.risks&&<div style={{padding:"14px 18px",background:K.bg,borderRadius:_isBm?0:10,borderLeft:"3px solid "+K.amb,marginBottom:10}}>
                <div style={{fontSize:9,fontWeight:700,color:K.amb,fontFamily:fm,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{"Risks — What I’m watching"}</div>
                <div style={{fontSize:13,color:K.mid,lineHeight:1.7}}>{sec.risks}</div></div>}
              {sec.sell&&<div style={{padding:"14px 18px",background:K.bg,borderRadius:_isBm?0:10,borderLeft:"3px solid "+K.red}}>
                <div style={{fontSize:9,fontWeight:700,color:K.red,fontFamily:fm,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{"Sell criteria — When I’d exit"}</div>
                <div style={{fontSize:13,color:K.mid,lineHeight:1.7}}>{sec.sell}</div></div>}
            </div>})()
          :<div style={{background:K.card,border:"1px dashed "+K.acc+"30",borderRadius:_isBm?0:14,padding:"40px 32px",textAlign:"center",cursor:"pointer"}} onClick={function(){setModal({type:"thesis"})}}>
            <div style={{width:44,height:44,borderRadius:_isBm?0:12,background:K.acc+"12",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="1.6" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div style={{fontSize:15,color:K.txt,fontWeight:700,marginBottom:6,fontFamily:fh}}>{"Write your thesis for "+c.ticker}</div>
            <div style={{fontSize:13,color:K.dim,lineHeight:1.65,maxWidth:320,margin:"0 auto"}}>{"Why do you own it? What’s the moat? What would make you sell? This is the most important thing you can do as an owner."}</div>
            <div style={{marginTop:20,display:"inline-flex",alignItems:"center",gap:6,background:K.acc,color:"#fff",padding:"9px 20px",borderRadius:_isBm?0:8,fontSize:13,fontWeight:600}}>{"Start writing →"}</div>
          </div>}
          {/* ── THESIS HISTORY + DRIFT ── */}
          {(function(){
            var versions=sel.thesisVersions||[];
            var thesisAge=sel.thesisUpdatedAt?Math.ceil((new Date()-new Date(sel.thesisUpdatedAt))/864e5):null;
            var earnDays=dU(sel.earningsDate);
            var preEarningsAlert=thesisAge!=null&&thesisAge>90&&earnDays>=0&&earnDays<=21;
            var hasHistory=versions.length>=2;

            // Drift detection — compare current to previous version
            function diffSection(curr,prev){
              if(!prev||!curr)return null;
              if(!prev.trim()&&curr.trim())return"added";
              if(prev.trim()&&!curr.trim())return"removed";
              var prevWords=prev.trim().split(/\s+/);
              var currWords=curr.trim().split(/\s+/);
              // Simple word-level change ratio
              var maxLen=Math.max(prevWords.length,currWords.length);
              if(maxLen===0)return null;
              var sameCount=0;
              var minLen=Math.min(prevWords.length,currWords.length);
              for(var wi=0;wi<minLen;wi++){if(prevWords[wi].toLowerCase()===currWords[wi].toLowerCase())sameCount++;}
              var similarity=sameCount/maxLen;
              if(similarity<0.7)return"major";
              if(similarity<0.9)return"minor";
              return null;
            }

            var _dh=useState(false),showHistory=_dh[0],setShowHistory=_dh[1];
            var _dv=useState(null),diffWith=_dv[0],setDiffWith=_dv[1];
            var currentParsed=parseThesis(sel.thesisNote||"");

            // Compute drift from last version
            var driftSignals=[];
            if(hasHistory){
              var lastV=versions[versions.length-1];
              var prevParsed={core:lastV.core||"",moat:lastV.moat||"",risks:lastV.risks||"",sell:lastV.sell||""};
              var coreDrift=diffSection(currentParsed.core,prevParsed.core);
              var moatDrift=diffSection(currentParsed.moat,prevParsed.moat);
              var risksDrift=diffSection(currentParsed.risks,prevParsed.risks);
              var sellDrift=diffSection(currentParsed.sell,prevParsed.sell);
              if(coreDrift)driftSignals.push({section:"Core thesis",change:coreDrift,color:coreDrift==="major"?K.amb:K.blue});
              if(moatDrift)driftSignals.push({section:"Moat",change:moatDrift,color:moatDrift==="major"?K.amb:K.blue});
              if(risksDrift)driftSignals.push({section:"Risks",change:risksDrift,color:K.amb});
              if(sellDrift)driftSignals.push({section:"Sell criteria",change:sellDrift,color:K.red});
            }

            return<div style={{marginTop:16}}>
              {/* Pre-earnings nudge */}
              {preEarningsAlert&&<div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",background:K.amb+"10",border:"1px solid "+K.amb+"30",borderRadius:_isBm?0:10,marginBottom:12}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.amb} strokeWidth="1.8" strokeLinecap="round" style={{flexShrink:0,marginTop:2}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:700,color:K.amb,fontFamily:fm,marginBottom:2}}>{"Earnings in "+earnDays+"d \u2014 thesis is "+thesisAge+" days old"}</div>
                  <div style={{fontSize:11,color:K.mid,lineHeight:1.5}}>{"Worth a quick re-read before results drop. Is your thesis still intact?"}</div>
                </div>
                <button onClick={function(){setModal({type:"thesis"})}} style={{flexShrink:0,padding:"5px 12px",background:K.amb+"15",border:"1px solid "+K.amb+"40",borderRadius:_isBm?0:6,color:K.amb,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm,whiteSpace:"nowrap"}}>{"Review \u2192"}</button>
              </div>}

              {/* Drift signals */}
              {driftSignals.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                <span style={{fontSize:9,fontWeight:700,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",alignSelf:"center"}}>Since last version:</span>
                {(driftSignals||[]).map(function(d,i){return<span key={i} style={{fontSize:10,fontWeight:600,color:d.color,background:d.color+"10",border:"1px solid "+d.color+"25",borderRadius:_isBm?0:4,padding:"2px 8px",fontFamily:fm}}>{d.section+": "+(d.change==="major"?"major change":d.change==="minor"?"refined":d.change==="added"?"added":d.change==="removed"?"removed":"changed")}</span>;})}
              </div>}

              {/* History toggle */}
              {versions.length>0&&<div>
                <button onClick={function(){setShowHistory(!showHistory)}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",padding:0,cursor:"pointer",color:K.dim,fontFamily:fm,fontSize:11,fontWeight:600,marginBottom:showHistory?10:0}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {versions.length} version{versions.length!==1?"s":""} saved
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{showHistory?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}</svg>
                </button>

                {showHistory&&<div style={{display:"flex",flexDirection:"column",gap:0,borderLeft:"2px solid "+K.bdr,marginLeft:5}}>
                  {versions.slice().reverse().map(function(v,i){
                    var isLatest=i===0;
                    var isCurrent=isLatest;
                    var isDiffing=diffWith===i;
                    var vParsed={core:v.core||"",moat:v.moat||"",risks:v.risks||"",sell:v.sell||""};
                    var vDate=v.savedAt?new Date(v.savedAt):new Date(v.date);
                    var daysAgo=Math.floor((new Date()-vDate)/864e5);
                    var daysLabel=daysAgo===0?"Today":daysAgo===1?"Yesterday":daysAgo+"d ago";

                    return<div key={i} style={{marginLeft:12,marginBottom:8}}>
                      {/* Version header */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:isCurrent?K.acc:K.bdr,flexShrink:0,marginLeft:-15.5,border:"2px solid "+K.bg}}/>
                        <span style={{fontSize:11,fontWeight:isCurrent?700:500,color:isCurrent?K.acc:K.mid,fontFamily:fm}}>{v.date||vDate.toISOString().split("T")[0]}</span>
                        <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{daysLabel}</span>
                        {isCurrent&&<span style={{fontSize:9,color:K.acc,background:K.acc+"15",padding:"1px 6px",borderRadius:_isBm?0:3,fontFamily:fm,fontWeight:700}}>Current</span>}
                        {!isCurrent&&v.fullText&&<button onClick={function(){setDiffWith(isDiffing?null:i)}} style={{fontSize:9,color:isDiffing?K.acc:K.dim,background:"none",border:"1px solid "+(isDiffing?K.acc+"40":K.bdr),borderRadius:_isBm?0:3,padding:"1px 6px",cursor:"pointer",fontFamily:fm}}>{isDiffing?"Hide diff":"Diff"}</button>}
                        {!isCurrent&&v.fullText&&<button onClick={function(){
                          // Restore this version
                          if(window.confirm("Restore this version? Your current thesis will be saved as a snapshot first.")){
                            var curVersions=(sel.thesisVersions||[]).slice();
                            var curParsed=parseThesis(sel.thesisNote||"");
                            curVersions.push({date:new Date().toISOString().split("T")[0],savedAt:new Date().toISOString(),summary:"Auto-saved before restore",fullText:sel.thesisNote||"",core:curParsed.core||"",moat:curParsed.moat||"",risks:curParsed.risks||"",sell:curParsed.sell||""});
                            upd(selId,{thesisNote:v.fullText,thesisVersions:curVersions,thesisUpdatedAt:new Date().toISOString()});
                          }
                        }} style={{fontSize:9,color:K.dim,background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:3,padding:"1px 6px",cursor:"pointer",fontFamily:fm}}>Restore</button>}
                      </div>

                      {/* Version excerpt or diff */}
                      {isDiffing&&v.fullText?<div style={{background:K.bg,borderRadius:_isBm?0:8,padding:"10px 12px",fontSize:11,fontFamily:fm,lineHeight:1.7}}>
                        {["core","moat","risks","sell"].map(function(field){
                          var currText=currentParsed[field]||"";
                          var prevText=vParsed[field]||"";
                          if(!currText&&!prevText)return null;
                          var changed=currText!==prevText;
                          var fieldLabels={core:"Core thesis",moat:"Moat",risks:"Risks",sell:"Sell criteria"};
                          var fieldColors={core:K.acc,moat:K.grn,risks:K.amb,sell:K.red};
                          return<div key={field} style={{marginBottom:8}}>
                            <div style={{fontSize:9,fontWeight:700,color:changed?fieldColors[field]:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:3,display:"flex",alignItems:"center",gap:6}}>
                              {fieldLabels[field]}
                              {changed&&<span style={{fontWeight:600,color:fieldColors[field],background:fieldColors[field]+"15",padding:"0px 5px",borderRadius:2}}>changed</span>}
                            </div>
                            {changed?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                              <div style={{borderLeft:"2px solid "+K.red+"60",paddingLeft:8,color:K.dim,fontSize:11,lineHeight:1.6,opacity:0.8}}>{prevText.substring(0,200)+(prevText.length>200?"...":"")}</div>
                              <div style={{borderLeft:"2px solid "+K.grn+"60",paddingLeft:8,color:K.txt,fontSize:11,lineHeight:1.6}}>{currText.substring(0,200)+(currText.length>200?"...":"")}</div>
                            </div>
                            :<div style={{color:K.dim,fontSize:11,lineHeight:1.6}}>{currText.substring(0,120)+(currText.length>120?"...":"")}</div>}
                          </div>;
                        })}
                      </div>
                      :(v.core||v.summary)&&<div style={{fontSize:11,color:K.dim,fontFamily:fb,lineHeight:1.5,fontStyle:"italic",paddingLeft:2}}>
                        {"\u201c"+(v.core||v.summary||"").substring(0,120)+((v.core||v.summary||"").length>120?"...":"")+"\u201d"}
                      </div>}
                    </div>;
                  })}
                </div>}
              </div>}
            </div>;
          })()}

          {/* Flywheel Note — Nick Sleep profile only */}
          {investorProfile==="sleep"&&sel&&<div style={{marginTop:12,marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div style={{fontSize:10,fontWeight:700,color:"#3B82F6",fontFamily:fm,letterSpacing:1,textTransform:"uppercase",display:"flex",alignItems:"center",gap:5}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Flywheel Note
              </div>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm,fontStyle:"italic"}}>Does scale get shared with customers?</span>
            </div>
            {c.flywheelNote
              ?<div style={{background:K.bg,borderRadius:_isBm?0:8,border:"1px solid #3B82F630",borderLeft:"3px solid #3B82F6",padding:"10px 14px",fontSize:13,color:K.txt,lineHeight:1.7,cursor:"pointer"}}
                onClick={function(){var v=window.prompt("Does "+c.ticker+" share its scale economics with customers? How does the flywheel compound?",c.flywheelNote||"");if(v!==null)upd(c.id,{flywheelNote:v.trim()})}}>
                {c.flywheelNote}
              </div>
              :<div style={{background:"#3B82F608",border:"1px dashed #3B82F640",borderRadius:_isBm?0:8,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}
                onClick={function(){var v=window.prompt("Does "+c.ticker+" share its scale economics with customers? How does the flywheel compound?","");if(v&&v.trim())upd(c.id,{flywheelNote:v.trim()})}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#3B82F6",marginBottom:2}}>Add flywheel note</div>
                  <div style={{fontSize:10,color:K.dim}}>{"“Destination companies make more economic sense over time.” — Nick Sleep"}</div>
                </div>
              </div>}
          </div>}

          {/* Lynch Test */}
          <div style={{marginTop:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div style={{fontSize:10,fontWeight:700,color:K.acc,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",display:"flex",alignItems:"center",gap:5}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                The Lynch Test
              </div>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>Can you explain this to an 11-year-old?</span>
            </div>
            {c.lynchExplanation
              ?<div style={{background:K.bg,borderRadius:_isBm?0:8,border:"1px solid "+K.bdr,padding:"10px 14px",fontSize:13,color:K.txt,lineHeight:1.7,cursor:"pointer"}}
                onClick={function(){var v=window.prompt("Explain "+c.ticker+" to an 11-year-old — what does this business do, why do people pay for it, and why can't someone else just copy it?",c.lynchExplanation||"");if(v!==null)upd(c.id,{lynchExplanation:v.trim()})}}>
                {c.lynchExplanation}
              </div>
              :<div style={{background:K.acc+"08",border:"1px dashed "+K.acc+"40",borderRadius:_isBm?0:8,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}
                onClick={function(){var v=window.prompt("Explain "+c.ticker+" to an 11-year-old — what does this business do, why do people pay for it, and why can't someone else just copy it?","");if(v&&v.trim())upd(c.id,{lynchExplanation:v.trim()})}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:K.acc}}>Write the Lynch Test</div>
                  <div style={{fontSize:11,color:K.dim,marginTop:2}}>{"If you can't explain it simply, you don't understand it well enough — Peter Lynch"}</div>
                </div>
              </div>}
          </div>

          {/* Thesis Timeline */}
          {(function(){
            var tevents=[];
            var addedAt=c.addedAt||c.purchaseDate||null;
            if(addedAt)tevents.push({label:"Added",date:addedAt,color:K.dim});
            if(c.thesisVersions&&c.thesisVersions.length>0){var firstV=c.thesisVersions[0];tevents.push({label:"Thesis",date:firstV.savedAt||firstV.date||addedAt,color:K.acc})}
            else if(c.thesisUpdatedAt)tevents.push({label:"Thesis",date:c.thesisUpdatedAt,color:K.acc});
            if(c.thesisVersions&&c.thesisVersions.length>1)tevents.push({label:"Rev "+c.thesisVersions.length,date:c.thesisVersions[c.thesisVersions.length-1].savedAt,color:K.blue});
            if(c.thesisUpdatedAt)tevents.push({label:"Updated",date:c.thesisUpdatedAt,color:_thesisStale?K.amb:K.grn});
            tevents.push({label:"Today",date:null,color:K.mid,today:true});
            if(tevents.length<3)return null;
            return<div style={{marginTop:10,padding:"8px 12px",background:K.bg+"80",borderRadius:_isBm?0:8}}>
              <div style={{display:"flex",alignItems:"flex-start",position:"relative"}}>
                <div style={{position:"absolute",left:"5%",right:"5%",height:1,background:K.bdr,top:4}}/>
                {(tevents||[]).map(function(ev,ei){return<div key={ei} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,position:"relative",zIndex:1}}>
                  <div style={{width:_isBm?6:8,height:_isBm?6:8,borderRadius:_isBm?1:"50%",background:ev.today?K.bg:ev.color,border:"1.5px solid "+(ev.today?K.dim:ev.color)}}/>
                  <div style={{fontSize:8,color:ev.color,fontFamily:fm,textAlign:"center",lineHeight:1.2}}>{ev.label}</div>
                  {!ev.today&&ev.date&&<div style={{fontSize:7,color:K.dim,fontFamily:fm}}>{ev.date.slice(0,7)}</div>}
                </div>})}
              </div>
            </div>
          })()}
        </div>

        {/* Investment style */}
        {!c.investStyle&&<div style={{background:K.acc+"06",border:"1px solid "+K.acc+"20",borderRadius:_isBm?0:10,padding:"12px 16px",marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:600,color:K.acc,marginBottom:6,fontFamily:fm}}>What type of investment is {c.ticker}?</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {INVEST_STYLES.map(function(st){return<button key={st.id} onClick={function(){upd(c.id,{investStyle:st.id})}} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:_isBm?0:5,border:"1px solid "+st.color+"30",background:st.color+"08",color:st.color,fontSize:10,cursor:"pointer",fontFamily:fm,fontWeight:600}}>
              <IC name={st.icon} size={10} color={st.color}/>{st.label}</button>})}</div></div>}


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
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <svg width="200" height="180" viewBox="0 0 200 180">
                {/* Rounded grid rings */}
                {gridLevels.map(function(gl){return<path key={gl} d={roundedGridPath(gl)} fill="none" stroke={K.bdr} strokeWidth={gl===100?"1":"0.5"}/>})}
                {/* Axis lines — subtle */}
                {(axes||[]).map(function(a2,i3){var p3=pt(i3,100);return<line key={i3} x1={cx} y1={cy} x2={p3.x} y2={p3.y} stroke={K.bdr} strokeWidth="0.3" strokeDasharray="2,3"/>})}
                {/* Filled shape — rounded, more opaque */}
                {(function(){var dataPts=(axes||[]).map(function(a2,i3){return pt(i3,Math.max(a2.score,8))});
                  return<g>
                    <path d={roundedPath(dataPts)} fill={"#3B82F618"} stroke={"#3B82F6"} strokeWidth="2"/>
                    {(dataPts||[]).map(function(p4,i4){return<circle key={i4} cx={p4.x} cy={p4.y} r="3" fill={axes[i4].color} stroke={K.bg} strokeWidth="1.5"/>})}
                  </g>;})()}
                {/* Axis labels with hover tooltips */}
                {(axes||[]).map(function(a2,i3){var lp=pt(i3,118);
                  return<g key={i3} style={{cursor:"help"}}><title>{a2.label}: {a2.score}/100 — {a2.tip}</title>
                    <text x={lp.x} y={lp.y} fill={K.dim} fontSize="8" fontFamily={fm} textAnchor="middle" dominantBaseline="middle" style={{cursor:"help"}}>{a2.label}</text></g>})}
                {/* Center score */}
                <text x={cx} y={cy-5} fill={avgScore>=70?K.grn:avgScore>=45?K.acc:K.amb} fontSize="22" fontWeight="900" fontFamily={fm} textAnchor="middle">{avgScore}</text>
                <text x={cx} y={cy+8} fill={K.dim} fontSize="7" fontFamily={fm} textAnchor="middle" letterSpacing="1.5">OWNER SCORE</text>
              </svg>
              <div style={{flex:1}}>
                <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:10}}>Investment Mastery</div>
                {(axes||[]).map(function(a2){return<div key={a2.label} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                  <div style={{width:5,height:5,borderRadius:_isBm?1:"50%",background:a2.color,flexShrink:0}}/>
                  <span style={{fontSize:10,color:K.mid,fontFamily:fm,width:75}}>{a2.label}</span>
                  <div style={{flex:1,height:5,borderRadius:_isBm?0:3,background:K.bdr+"50",overflow:"hidden"}}>
                    <div style={{height:"100%",width:a2.score+"%",background:a2.color,borderRadius:_isBm?0:3,transition:"width .4s"}}/>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,color:a2.score>=70?a2.color:K.dim,fontFamily:fm,width:28,textAlign:"right"}}>{a2.score}</span>
                </div>})}
              </div></div></div>})()}


        {/* ── QUALITATIVE CHECKS (Munger's three questions) ── */}
        {(function(){
          var coc=c.circleScore||0;
          var cocColor=coc>=4?K.grn:coc>=3?K.amb:coc>0?K.red:K.dim;
          var cocLabel=coc===5?"Expert":coc===4?"Deep knowledge":coc===3?"Solid understanding":coc===2?"Know the basics":coc===1?"Barely understand":"Not rated";
          return<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10,marginBottom:16}}>
            {/* 1. Circle of Competence */}
            <div style={{background:K.card,border:"1px solid "+(coc>0&&coc<3?K.amb+"40":K.bdr),borderRadius:_isBm?0:12,padding:"14px 16px",cursor:"pointer"}}
              onClick={function(){var v=parseInt(window.prompt("Circle of competence — "+c.ticker+"\n\nCould you give a one-hour lecture on this industry,\nits economics, and its competitive dynamics?\n\n1  Barely understand the business\n2  Know the basics\n3  Solid understanding\n4  Deep industry knowledge\n5  Expert level\n\nRate 1–5:",String(coc||3)));if(!isNaN(v)&&v>=1&&v<=5)upd(c.id,{circleScore:v})}}>
              <div style={{fontSize:10,fontWeight:700,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Circle of Competence</div>
              <div style={{display:"flex",gap:4,marginBottom:6}}>{[1,2,3,4,5].map(function(n){return<div key={n} style={{flex:1,height:6,borderRadius:_isBm?0:3,background:n<=coc?cocColor:K.bdr,transition:"background .2s"}}/>})}</div>
              <div style={{fontSize:13,fontWeight:700,color:cocColor,fontFamily:fm}}>{cocLabel}</div>
              {coc>0&&coc<3&&<div style={{fontSize:10,color:K.amb,marginTop:4,lineHeight:1.5}}>{"Outside your circle? If you can't describe this business clearly, that's information."}</div>}
              {!coc&&<div style={{fontSize:10,color:K.dim,marginTop:4}}>Click to rate your understanding</div>}
            </div>
            {/* 2. Inversion — pre-mortem */}
            <div style={{background:K.card,border:"1px solid "+(c.inversionNote?K.bdr:K.acc+"20"),borderRadius:_isBm?0:12,padding:"14px 16px",cursor:"pointer"}}
              onClick={function(){var v=window.prompt("Inversion: imagine it is 5 years from now and this investment has failed completely.\n\nWhat happened? Be specific.\n\n(Munger: 'Invert, always invert')",c.inversionNote||"");if(v!==null)upd(c.id,{inversionNote:v.trim()})}}>
              <div style={{fontSize:10,fontWeight:700,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Inversion</div>
              {c.inversionNote
                ?<div>
                  <div style={{fontSize:12,color:K.mid,lineHeight:1.6,marginBottom:4}}>{c.inversionNote.substring(0,120)+(c.inversionNote.length>120?"...":"")}</div>
                  <div style={{fontSize:9,color:K.grn,fontFamily:fm,fontWeight:700}}>{"Pre-mortem written \u2713"}</div>
                </div>
                :<div>
                  <div style={{fontSize:13,fontWeight:600,color:K.acc,marginBottom:3}}>Write the pre-mortem</div>
                  <div style={{fontSize:11,color:K.dim,lineHeight:1.5}}>{"\"Invert, always invert.\" Imagine total failure. What happened?"}</div>
                </div>}
            </div>
            {/* 3. Management Quality */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 16px",cursor:"pointer"}}
              onClick={function(){
                var grade=window.prompt("Management grade for "+c.ticker+"\n\nA — Exceptional. Capital allocation, integrity, owner-operator mentality.\nB — Competent. Does the job well.\nC — Average. Some concerns.\nD — Poor. Material concerns about honesty or ability.\n\nEnter A/B/C/D:",c.managementGrade||"");
                if(!grade)return;
                grade=grade.trim().toUpperCase();
                if(!"ABCD".includes(grade)||grade.length!==1)return;
                var note=window.prompt("One line: what makes you rate management "+grade+"?",c.managementNote||"");
                upd(c.id,{managementGrade:grade,managementNote:note&&note.trim()?note.trim():c.managementNote||""});
              }}>
              <div style={{fontSize:10,fontWeight:700,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Management</div>
              {c.managementGrade
                ?<div>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4}}>
                    <span style={{fontSize:28,fontWeight:900,color:c.managementGrade==="A"?K.grn:c.managementGrade==="B"?K.acc:c.managementGrade==="C"?K.amb:K.red,fontFamily:fm,lineHeight:1}}>{c.managementGrade}</span>
                    <span style={{fontSize:11,color:K.dim}}>{c.ceo||"CEO"}</span>
                  </div>
                  {c.managementNote&&<div style={{fontSize:11,color:K.mid,lineHeight:1.5}}>{c.managementNote}</div>}
                </div>
                :<div>
                  <div style={{fontSize:13,fontWeight:600,color:K.dim,marginBottom:3}}>Not graded yet</div>
                  <div style={{fontSize:11,color:K.dim,lineHeight:1.5}}>{"\"The most important quality is integrity.\" — Munger"}</div>
                </div>}
            </div>
          </div>;
        })()}
        {/* ── 2. THE EVIDENCE ── */}
        <div id="ds-evidence" style={{marginBottom:48}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,paddingBottom:14,borderBottom:"1px solid "+K.bdr+"40"}}>
            <div style={{width:3,height:22,borderRadius:_isBm?0:2,background:K.grn,flexShrink:0}}/>
            <div>
              <div style={{fontSize:14,letterSpacing:1,textTransform:"uppercase",color:K.txt,fontFamily:fh,fontWeight:800}}>Evidence</div>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:1,letterSpacing:0.2}}>KPIs, earnings, stress tests</div>
            </div>
          </div>
          {/* KPI Scorecard */}
          {c.kpis.length>0?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:600,color:K.txt}}>KPI Scorecard</span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {(function(){var _fs=c.financialSnapshot||{};return<span>{_fs.shareholderYield&&_fs.shareholderYield.numVal>0.5&&<span style={{fontSize:10,fontWeight:600,color:K.grn,background:K.grn+"12",padding:"2px 7px",borderRadius:_isBm?0:4,fontFamily:fm,marginRight:4}}>{_fs.shareholderYield.value} SH yield</span>}{_fs.grahamDiscount&&_fs.grahamDiscount.numVal!=null&&Math.abs(_fs.grahamDiscount.numVal)<80&&<span style={{fontSize:10,fontWeight:600,color:_fs.grahamDiscount.numVal<0?K.grn:K.amb,background:(_fs.grahamDiscount.numVal<0?K.grn:K.amb)+"12",padding:"2px 7px",borderRadius:_isBm?0:4,fontFamily:fm}} title={"Graham Number (sqrt(22.5×EPS×BVPS)) — conservative floor for asset-heavy businesses: "+(_fs.grahamNum?_fs.grahamNum.value:"—")}>{_fs.grahamDiscount.numVal<0?Math.abs(_fs.grahamDiscount.numVal).toFixed(0)+"% below Graham":_fs.grahamDiscount.numVal.toFixed(0)+"% above Graham"}</span>}</span>})()}
                <span style={S.badge(h.c)}>{h.l}</span>
              </div>
            </div>
            {/* KPI Tile Grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}}>
            {(c.kpis||[]).map(function(k){
              var hist=[];if(c.earningsHistory){c.earningsHistory.forEach(function(e){if(e.results){var mid=k.metricId||k.name;var match=e.results.find(function(r){return r.kpi_name===mid||r.kpi_name===k.name||(k.metricId&&r.kpi_name===k.metricId)});if(match)hist.push({q:e.quarter,v:match.actual_value,s:match.status})}})}
              hist.sort(function(a,b){return a.q>b.q?1:-1});
              var statusColor=k.lastResult?k.lastResult.status==="met"?K.grn:k.lastResult.status==="unclear"?K.dim:K.red:K.bdr;
              var statusLabel=k.lastResult?k.lastResult.status==="met"?"Met":k.lastResult.status==="unclear"?"N/A":"Missed":"—";
              var lastVal=k.lastResult&&k.lastResult.actual!=null?(function(){var v=k.lastResult.actual;var u=METRIC_MAP[k.metricId]?METRIC_MAP[k.metricId].unit:"";if(typeof v!=="number")return v+(u||"");var abs=Math.abs(v);var s=abs>=1000?v.toFixed(0):abs>=10?v.toFixed(1):v.toFixed(2);return s+(u||"")})():null;
              return<div key={k.id} style={{background:K.bg,borderRadius:_isBm?0:10,padding:"10px 12px",cursor:"pointer",border:"1px solid "+K.bdr+"60",position:"relative",overflow:"hidden"}} onClick={function(){setModal({type:"kpi",data:k.id})}}>
                {/* Status color strip */}
                <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,borderRadius:_isBm?"0":"10px 0 0 10px",background:statusColor}}/>
                <div style={{paddingLeft:6}}>
                  <div style={{fontSize:11,fontWeight:600,color:K.txt,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{k.name}</div>
                  <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:4}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:800,color:statusColor,fontFamily:fm,lineHeight:1}}>{lastVal||"—"}</div>
                      <div style={{fontSize:9,color:K.dim,fontFamily:fm,marginTop:1}}>{k.target||"no target"}</div>
                    </div>
                    {/* Sparkline bars */}
                    {hist.length>0&&<div style={{display:"flex",alignItems:"flex-end",gap:2,height:22}}>
                      {hist.slice(-5).map(function(hh,hi){return<div key={hi} title={hh.q} style={{width:5,borderRadius:_isBm?0:1,height:hh.s==="met"?18:hh.s==="unclear"?10:6,background:hh.s==="met"?K.grn:hh.s==="unclear"?K.dim:K.red,opacity:.8}}/>})}
                    </div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:6,height:6,borderRadius:_isBm?1:"50%",background:statusColor,flexShrink:0}}/>
                    <span style={{fontSize:9,color:statusColor,fontFamily:fm,fontWeight:600}}>{statusLabel}</span>
                    {(function(){var streak=0;for(var si=hist.length-1;si>=0;si--){if(hist[si].s==="met")streak++;else break};return streak>=2?<span style={{fontSize:9,color:K.grn,fontFamily:fm,marginLeft:2}}>{streak}Q↑</span>:null})()}
                  </div>
                </div>
              </div>})}
            </div>
            <button onClick={function(){setModal({type:"kpi"})}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,marginTop:4,padding:0}}>+ Add KPI</button>
          </div>
          :<div style={{background:K.card,border:"1px dashed "+K.acc+"30",borderRadius:_isBm?0:14,padding:"32px 24px",textAlign:"center",marginBottom:12}}>
            <div style={{width:40,height:40,borderRadius:_isBm?0:10,background:K.blue+"12",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.blue} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </div>
            <div style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:5}}>{"Define your KPIs for "+c.ticker}</div>
            <div style={{fontSize:12,color:K.dim,lineHeight:1.6,maxWidth:280,margin:"0 auto 16px"}}>{"Pick 2–3 metrics that would prove or disprove your thesis. You’ll check them after each earnings release."}</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:12,fontSize:10,color:K.dim,fontFamily:fm}}>
              {["Gross margin","Revenue growth","ROIC","Free cash flow","Net income"].map(function(eg){return<span key={eg} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:20,padding:"3px 10px"}}>{eg}</span>})}
            </div>
            <button onClick={function(){setModal({type:"kpi"})}} style={{padding:"9px 20px",borderRadius:_isBm?0:8,background:K.blue,border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:fm}}>{"+ Add KPIs →"}</button>
          </div>}
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
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 18px",cursor:"pointer"}} onClick={function(){setModal({type:"conviction"})}}>
              {(function(){
                var cx=60,cy=62,r=50;
                var ang=function(v){return Math.PI*(1-v/10)};
                var arcP=function(v1,v2){var a1=ang(v1);var a2=ang(v2);var x1=(cx+r*Math.cos(a1)).toFixed(1);var y1=(cy-r*Math.sin(a1)).toFixed(1);var x2=(cx+r*Math.cos(a2)).toFixed(1);var y2=(cy-r*Math.sin(a2)).toFixed(1);return"M"+x1+" "+y1+" A"+r+" "+r+" 0 0 1 "+x2+" "+y2};
                var convColor=conv>=7?K.grn:conv>=4?K.amb:conv>0?K.red:K.dim;
                var cv=Math.max(0.01,Math.min(conv,9.99));
                var na=ang(cv);var nx=(cx+42*Math.cos(na)).toFixed(1);var ny=(cy-42*Math.sin(na)).toFixed(1);
                return<div style={{textAlign:"center"}}>
                  <div style={{fontSize:9,letterSpacing:1.5,color:K.dim,fontFamily:fm,marginBottom:2,textTransform:"uppercase"}}>Conviction</div>
                  <svg viewBox="0 0 120 68" style={{width:"100%",maxWidth:150,display:"block",margin:"0 auto"}}>
                    <path d={arcP(0,3.5)} fill="none" stroke={K.red+"35"} strokeWidth="11"/>
                    <path d={arcP(3.5,6.5)} fill="none" stroke={K.amb+"35"} strokeWidth="11"/>
                    <path d={arcP(6.5,9.99)} fill="none" stroke={K.grn+"35"} strokeWidth="11"/>
                    {conv>0&&<path d={arcP(0.01,cv)} fill="none" stroke={convColor} strokeWidth="11" strokeLinecap="round"/>}
                    {conv>0&&<line x1={cx} y1={cy} x2={nx} y2={ny} stroke={K.txt} strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>}
                    <circle cx={cx} cy={cy} r="4.5" fill={K.card} stroke={conv>0?convColor:K.bdr} strokeWidth="2"/>
                  </svg>
                  <div style={{marginTop:-4,lineHeight:1}}>
                    <span style={{fontSize:22,fontWeight:800,color:convColor,fontFamily:fm}}>{conv||"—"}</span>
                    <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>/10</span>
                  </div>
                  {c.convictionHistory&&c.convictionHistory.length>1&&<div style={{display:"flex",gap:2,marginTop:6,justifyContent:"center",alignItems:"flex-end",height:14}}>
                    {c.convictionHistory.slice(-8).map(function(ch,i2){return<div key={i2} style={{width:8,borderRadius:_isBm?0:1,height:Math.max(2,Math.round(ch.rating/10*12))+"px",background:ch.rating>=7?K.grn:ch.rating>=4?K.amb:K.red,opacity:.75}}/>})}
                  </div>}
                </div>
              })()}
            </div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 18px",cursor:"pointer"}} onClick={function(){setModal({type:"position"})}}>
              <div style={{fontSize:9,letterSpacing:1.5,color:K.dim,fontFamily:fm,marginBottom:6,textTransform:"uppercase"}}>Position</div>
              {pos.shares>0?<div>
                <div style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm,marginBottom:2}}>{pos.shares>=1000?(pos.shares/1000).toFixed(1)+"k":pos.shares}<span style={{fontSize:11,fontWeight:400,color:K.dim}}> sh @ {cSym}{pos.avgCost}</span></div>
                {pos.currentPrice>0&&<div style={{fontSize:12,fontWeight:700,color:((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?K.grn:K.red,fontFamily:fm,marginBottom:8}}>{((pos.currentPrice-pos.avgCost)/pos.avgCost*100)>=0?"+":""}{((pos.currentPrice-pos.avgCost)/pos.avgCost*100).toFixed(1)}% ({cSym}{Math.abs((pos.currentPrice-pos.avgCost)*pos.shares).toFixed(0)})</div>}
              </div>:<div style={{fontSize:12,color:K.dim,marginBottom:10}}>Tap to add position</div>}
              {/* Price vs Target bar */}
              {(function(){
                var price=pos.currentPrice;var tgt=c.targetPrice||0;
                var snap_=c.financialSnapshot||{};var graham=snap_.grahamNum?snap_.grahamNum.numVal:0;
                if(!price||(!tgt&&!graham))return null;
                var lo=Math.min(price*0.55,graham>0?graham*0.8:price*0.55);
                var hi=Math.max(price*1.45,tgt>0?tgt*1.25:price*1.45);
                var pct=Math.max(2,Math.min(98,(price-lo)/(hi-lo)*100));
                var tgtPct=tgt>0?Math.max(2,Math.min(98,(tgt-lo)/(hi-lo)*100)):null;
                var gPct=graham>0?Math.max(2,Math.min(98,(graham-lo)/(hi-lo)*100)):null;
                var priceColor=tgt>0?(price<tgt*0.85?K.grn:price<tgt*1.1?K.amb:K.red):K.mid;
                return<div style={{marginTop:2}}>
                  <div style={{position:"relative",height:6,borderRadius:_isBm?0:3,background:"linear-gradient(90deg,"+K.grn+"55,"+K.amb+"55 50%,"+K.red+"55)",marginBottom:6}}>
                    {gPct!=null&&<div style={{position:"absolute",top:-3,left:gPct+"%",transform:"translateX(-50%)",width:2,height:12,borderRadius:_isBm?0:1,background:K.blue+"bb"}} title={"Graham: "+cSym+graham.toFixed(2)}/>}
                    {tgtPct!=null&&<div style={{position:"absolute",top:-3,left:tgtPct+"%",transform:"translateX(-50%)",width:2,height:12,borderRadius:_isBm?0:1,background:K.acc}} title={"Target: "+cSym+tgt}/>}
                    <div style={{position:"absolute",top:"50%",left:pct+"%",transform:"translate(-50%,-50%)",width:12,height:12,borderRadius:"50%",background:priceColor,border:"2px solid "+K.card,boxShadow:"0 1px 4px rgba(0,0,0,.4)"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:9,color:K.dim,fontFamily:fm}}>
                    <span>Cheap</span>
                    {tgtPct!=null&&<span style={{color:K.acc,fontSize:9}}>Target {cSym}{tgt}</span>}
                    {tgtPct==null&&gPct!=null&&<span style={{color:K.blue,fontSize:9}}>Graham {cSym}{graham.toFixed(0)}</span>}
                    <span>Pricey</span>
                  </div>
                </div>
              })()}
            </div></div>
          {/* Recent decisions */}
          {(function(){var recent=(c.decisions||[]).filter(function(d2){return d2.cardType==="decision"||(!d2.cardType&&d2.reasoning)}).slice(0,2);
            if(recent.length===0)return null;
            return<div>{(recent||[]).map(function(d2){return<JournalCard key={d2.id} entry={d2}/>})}</div>})()}
        </div>

        {/* ── VALUATION ── */}
        {(function(){var val=c.valuation||{metrics:[]};var snap2=c.financialSnapshot||{};var price2=(c.position||{}).currentPrice||(snap2.livePrice&&snap2.livePrice.numVal?snap2.livePrice.numVal:0)||(snap2.pe&&snap2.eps?(parseFloat(String(snap2.pe.value||"").replace(/[^0-9.]/g,""))||0)*(parseFloat(String(snap2.eps.value||"").replace(/[^0-9.\-]/g,""))||0):0);
          var results=(val.metrics||[]).map(function(vm){var def=VALUATION_METRICS.find(function(m){return m.id===vm.id});if(!def)return null;
            var current=getValMetricValue(def,snap2,price2,c);var pass=current!=null&&vm.threshold>0?(vm.rule==="gte"?current>=vm.threshold:current<=vm.threshold):null;
            return{id:vm.id,label:def.label,unit:def.unit,rule:vm.rule,threshold:vm.threshold,current:current,pass:pass}}).filter(Boolean);
          var passCount=results.filter(function(r){return r.pass===true}).length;var failCount=results.filter(function(r){return r.pass===false}).length;
          var totalJudged=passCount+failCount;var verdict=totalJudged===0?null:passCount>=totalJudged*0.75?"Attractive":passCount>=totalJudged*0.5?"Fair":"Expensive";
          var verdictColor=verdict==="Attractive"?K.grn:verdict==="Fair"?K.amb:verdict==="Expensive"?K.red:K.dim;
          return<div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>VALUATION</div>
            <button onClick={function(){setModal({type:"valuation"})}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm}}>{results.length>0?"Edit framework":"Set up"}</button></div>
          {results.length>0?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 18px"}}>
            {verdict&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16,fontWeight:800,color:verdictColor,fontFamily:fm}}>{verdict}</span>
                <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{passCount}/{totalJudged} criteria met</span></div>
              <div style={{display:"flex",gap:3}}>{(results||[]).map(function(r){return<div key={r.id} style={{width:_isBm?6:8,height:_isBm?6:8,borderRadius:_isBm?1:"50%",background:r.pass===true?K.grn:r.pass===false?K.red:K.dim+"40"}}/>})}</div></div>}
            {(results||[]).map(function(r,ri){return<div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:ri>0?"1px solid "+K.bdr+"30":"none"}}>
              <span style={{fontSize:12,color:K.mid,flex:1}}>{r.label}</span>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{r.rule==="gte"?"\u2265":"\u2264"}{r.threshold}{r.unit}</span>
              <span style={{fontSize:13,fontWeight:700,color:r.pass===true?K.grn:r.pass===false?K.red:K.dim,fontFamily:fm,minWidth:48,textAlign:"right"}}>{r.current!=null?r.current.toFixed(r.unit==="%"?1:r.current<1?2:1)+r.unit:"\u2014"}</span>
              <span style={{width:6,height:6,borderRadius:_isBm?1:"50%",background:r.pass===true?K.grn:r.pass===false?K.red:K.dim+"40",flexShrink:0}}/></div>})}
            {val.updatedAt&&<div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:8,textAlign:"right"}}>Framework set {fD(val.updatedAt)}</div>}
          </div>
          :<div style={{background:K.card,border:"1px dashed "+K.acc+"30",borderRadius:_isBm?0:12,padding:"20px",textAlign:"center",cursor:"pointer"}} onClick={function(){setModal({type:"valuation"})}}>
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
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:_isBm?0:999,background:K.card,border:"1px solid "+K.bdr,flexShrink:0}}>
                <IC name="bar" size={12} color={K.dim}/>
                <span style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,fontWeight:600}}>Market Data</span>
                <span style={{fontSize:11,color:K.dim,transform:mktOpen?"rotate(0)":"rotate(-90deg)",transition:"transform .2s",display:"inline-block",lineHeight:1}}>▾</span>
              </div>
              <div style={{flex:1,height:1,background:K.bdr}}/>
            </div>
          </div>
        })()}
        {dossierMktOpen!==false&&<div>
        {/* ── OWNER'S NUMBERS ── */}
        {(function(){var snap=c.financialSnapshot||{};var snapKeys=Object.keys(snap).filter(function(k){return snap[k]&&snap[k].value});var hasSnap=snapKeys.length>0;
          // If international and very sparse data — show manual prompt
          var isIntl=isIntlTicker(c.ticker);
          var isSparse=isIntl&&snapKeys.length<4;
          if(!hasSnap&&isIntl)return<div style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,paddingBottom:14,borderBottom:"1px solid "+K.bdr+"40"}}>
              <div style={{width:3,height:22,borderRadius:_isBm?0:2,background:K.blue,flexShrink:0}}/>
              <div>
                <div style={{fontSize:14,letterSpacing:1,textTransform:"uppercase",color:K.txt,fontFamily:fh,fontWeight:800}}>{"Owner’s Numbers"}</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:1,letterSpacing:0.2}}>Fundamentals, ratios, valuation</div>
              </div>
            </div>
            {isSparse&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:K.amb+"08",border:"1px solid "+K.amb+"20",borderRadius:_isBm?0:8,marginBottom:12}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={K.amb} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{fontSize:10,color:K.amb,fontFamily:fm,flex:1}}>{"Limited data for "+c.ticker+" — international coverage is partial. Key metrics sourced from available data."}</span>
            </div>}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 18px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.amb} strokeWidth="1.8" strokeLinecap="round" style={{flexShrink:0,marginTop:2}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,marginBottom:4}}>{"Financial data unavailable for "+c.ticker}</div>
                  <div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>{"FMP and Finnhub don’t carry full data for this ticker. This is common for smaller international stocks."}</div>
                </div>
              </div>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:10,lineHeight:1.6}}>{"You can still track this company by setting KPIs manually from the company’s annual reports and updating conviction after each earnings release."}</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={function(){setDetailTab("kpis")}} style={{padding:"7px 14px",borderRadius:_isBm?0:8,background:K.acc+"12",border:"1px solid "+K.acc+"30",color:K.acc,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{"Set KPIs manually →"}</button>
                <button onClick={function(){setModal({type:"position",id:c.id})}} style={{padding:"7px 14px",borderRadius:_isBm?0:8,background:"transparent",border:"1px solid "+K.bdr,color:K.mid,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fm}}>Update position</button>
              </div>
            </div>
          </div>;
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
          var _roicCtx=BUSINESS_MODEL_CONTEXT[c.businessModelType||""];
          var _roicNote=_roicCtx&&_roicCtx.roic?_roicCtx.roic.note:null;
          var _roicBench=_roicCtx&&_roicCtx.roic&&_roicCtx.roic.adjustedBenchmark?_roicCtx.roic.adjustedBenchmark:12;
          var _roicExpectLow=_roicCtx&&_roicCtx.roic&&_roicCtx.roic.expectLow;
          if(snap.roic)returns.push({l:"ROIC"+(c.businessModelType&&_roicExpectLow?" *":""),v:snap.roic.value,numVal:snap.roic.numVal,sp500:_roicBench,tip:(_roicNote?"["+(_roicCtx?_roicCtx.label:"")+" context] "+_roicNote+" — ":"")+"S&P 500 avg ~12%",isGood:_roicExpectLow?(snap.roic.numVal>=_roicBench):(snap.roic.numVal>=12),contextNote:_roicNote});
          if(snap.roe)returns.push({l:"ROE",v:snap.roe.value,numVal:snap.roe.numVal,sp500:18,tip:"Return on equity — S&P 500 avg ~18%",isGood:snap.roe.numVal>=15});
          if(snap.roce&&snap.roce.value)returns.push({l:"ROCE",v:snap.roce.value,numVal:snap.roce.numVal,sp500:13,tip:"Return on capital employed — S&P 500 avg ~13%",isGood:parseFloat(snap.roce.value)>=12});
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
          if(_gnVal>0&&_cp>0&&_gnVal<_cp*10){var _gg=((_gnVal-_cp)/_cp*100);pvSection.push({l:"Graham #",v:cSym+_gnVal.toFixed(2),isGood:_cp<=_gnVal,tip:"Graham Number: conservative floor (√22.5×EPS×BV) for asset-heavy co. Capital-light/tech: less relevant. "+(_cp<=_gnVal?"Below":"Above")+" by "+Math.abs(_gg).toFixed(0)+"%"})}
          var _epsVal=snap.eps&&snap.eps.numVal!=null&&!isNaN(snap.eps.numVal)?Number(snap.eps.numVal):0;
          if(_epsVal>0&&_cp>0){var _fv15=_epsVal*15;var _fvUp=((_fv15-_cp)/_cp*100);if(Math.abs(_fvUp)<300)pvSection.push({l:"15x EPS FV",v:cSym+_fv15.toFixed(2),isGood:_cp<_fv15,tip:"15x earnings = "+cSym+_fv15.toFixed(2)+(_fvUp>0?" ("+_fvUp.toFixed(0)+"% upside)":"")})}
          var _fcfVal=snap.fcf&&snap.fcf.numVal!=null&&!isNaN(snap.fcf.numVal)?Number(snap.fcf.numVal):0;
          if(_fcfVal>0&&_cp>0){var _fcfFV=_fcfVal/0.05;if(_fcfFV>0&&_fcfFV<_cp*10)pvSection.push({l:"FCF@5% FV",v:cSym+_fcfFV.toFixed(2),isGood:_cp<_fcfFV,tip:"Price implied by 5% FCF yield"})}
          }catch(pvErr){pvSection=[];}
          // ── Investment framework scores ──────────────────────────────
          var sections=[];
          var scoreItems=[];
          try{
            // — Piotroski F-Score (0-9) —
            var _pF=0;var _pMax=0;var _pHints=[];
            var _roa2=snap.roa&&snap.roa.numVal!=null?snap.roa.numVal:null;
            if(_roa2!==null){_pMax+=3;if(_roa2>0){_pF++;} // F1: ROA>0
              if(snap.fcfYield&&snap.fcfYield.numVal!=null&&snap.fcfYield.numVal>0){_pF++;} // F2: FCF>0 (proxy)
              else _pMax--; // data missing
              if(snap.roe&&snap.roe.numVal!=null&&snap.roe.numVal>_roa2*0.8){_pF++;} // F3: ROA improving proxy
            }
            if(snap.currentRatio&&snap.currentRatio.numVal!=null){_pMax++;var _cr=snap.currentRatio.numVal;if(_cr>1.5)_pF++;} // F4
            if(snap.debtEquity&&snap.debtEquity.numVal!=null){_pMax++;var _de=snap.debtEquity.numVal;if(_de<1)_pF++;} // F5: leverage manageable
            if(snap.grossMargin&&snap.grossMargin.numVal!=null){_pMax++;var _gm=snap.grossMargin.numVal;if(_gm>30)_pF++;} // F6: gross margin ok
            if(snap.roic&&snap.roic.numVal!=null){_pMax++;var _ri=snap.roic.numVal;if(_ri>10)_pF++;} // F7: ROIC>10 proxy for efficiency
            if(snap.opMargin&&snap.opMargin.numVal!=null){_pMax++;var _om=snap.opMargin.numVal;if(_om>0)_pF++;} // F8: positive operating margin
            if(snap.fcfYield&&snap.fcfYield.numVal!=null){_pMax++;var _fcfy=snap.fcfYield.numVal;if(_fcfy>0)_pF++;} // F9: FCF positive
            if(_pMax>=5){
              var _pNorm=Math.round(_pF/_pMax*9);
              var _pLabel=_pNorm>=7?"Strong ("+_pF+"/"+_pMax+")":_pNorm>=4?"Average ("+_pF+"/"+_pMax+")":"Weak ("+_pF+"/"+_pMax+")";
              scoreItems.push({l:"Piotroski F",v:_pNorm+"/9",isGood:_pNorm>=7,isNeutral:_pNorm>=4&&_pNorm<7,tip:"Piotroski F-Score: 9-point quality check across profitability, leverage, and efficiency. 7-9 = strong, 4-6 = average, 0-3 = weak. Result: "+_pLabel})
            }

            // — Greenblatt Magic Formula (Earnings Yield + ROIC quality) —
            var _ey=snap.pe&&snap.pe.numVal!=null&&snap.pe.numVal>0?Math.round(100/snap.pe.numVal*10)/10:
                    (snap.fcfYield&&snap.fcfYield.numVal!=null?snap.fcfYield.numVal:null);
            var _mfRoic=snap.roic&&snap.roic.numVal!=null?snap.roic.numVal:null;
            if(_ey!==null&&_mfRoic!==null){
              var _mfScore=0;if(_ey>7)_mfScore+=2;else if(_ey>4)_mfScore+=1;
              if(_mfRoic>25)_mfScore+=2;else if(_mfRoic>15)_mfScore+=1;
              var _mfLabel=_mfScore>=4?"Top tier":_mfScore>=2?"Decent":"Below average";
              scoreItems.push({l:"Magic Formula",v:_mfScore+"/4",isGood:_mfScore>=4,isNeutral:_mfScore>=2&&_mfScore<4,tip:"Greenblatt Magic Formula — Earnings yield: "+_ey.toFixed(1)+"% + ROIC: "+_mfRoic.toFixed(1)+"% = "+_mfLabel+". Higher earnings yield + higher ROIC = better value/quality combo. Best for profitable, non-financial companies."})
            }

            // — Buffett Quality Checklist (5 criteria) —
            var _bScore=0;var _bTotal=0;var _bLines=[];
            var _skipRoic=c.businessModelType==="serial_acquirer"||c.businessModelType==="financial"||c.businessModelType==="distributor";
            if(_mfRoic!==null&&!_skipRoic){_bTotal++;if(_mfRoic>15){_bScore++;_bLines.push("ROIC>"+_mfRoic.toFixed(0)+"%")}}
            else if(_mfRoic!==null&&_skipRoic){/* ROIC benchmark not applied for this business model */}
            if(snap.grossMargin&&snap.grossMargin.numVal!=null){_bTotal++;if(snap.grossMargin.numVal>40){_bScore++;_bLines.push("Gross margin>"+snap.grossMargin.numVal.toFixed(0)+"%")}}
            if(snap.fcfYield&&snap.fcfYield.numVal!=null){_bTotal++;if(snap.fcfYield.numVal>0){_bScore++;_bLines.push("FCF positive")}}
            if(snap.debtEquity&&snap.debtEquity.numVal!=null){_bTotal++;if(snap.debtEquity.numVal<0.5){_bScore++;_bLines.push("Low debt")}else if(snap.debtEquity.numVal<1.5){_bLines.push("Moderate debt (ok for moat co.)")}}
            if(snap.revGrowth&&snap.revGrowth.numVal!=null){_bTotal++;if(snap.revGrowth.numVal>5){_bScore++;_bLines.push("Growing revenue")}}
            if(_bTotal>=3){
              var _bLabel=_bScore>=4?"Excellent":_bScore>=3?"Good":_bScore>=2?"Fair":"Weak";
              scoreItems.push({l:"Buffett Criteria",v:_bScore+"/"+_bTotal,isGood:_bScore>=4,isNeutral:_bScore>=3&&_bScore<4,tip:"Buffett quality checklist — Criteria met: "+(_bLines.length>0?_bLines.join(", "):"few")+". Looking for: high ROIC, strong margins, FCF generation, modest debt, consistent growth."})
            }
          }catch(scoreErr){}
          if(scoreItems.length>0)sections.push({title:"INVESTMENT SCORES",items:scoreItems,color:"#7C3AED"});

          if(pvSection.length>0)sections.push({title:"PRICE vs VALUE",items:pvSection,color:"#9333EA"});
          if(valuation.length>0)sections.push({title:"VALUATION",items:valuation,color:K.blue});
          if(returns.length>0)sections.push({title:"CAPITAL RETURNS",items:returns,color:K.grn,gauge:true});
          if(divInfo.length>0)sections.push({title:"DIVIDENDS",items:divInfo,color:K.amb});
          if(health.length>0)sections.push({title:"FINANCIAL HEALTH",items:health,color:K.mid});
          // ── BUFFETT BALANCE SHEET SECTION ────────────────────────────────────
          var bsSection=null;
          if(investorProfile==="buffett"){
            var bs=c.financialSnapshot||{};
            var bsRows=[];
            // Book value per share
            if(bs.bookValue&&bs.bookValue.numVal!=null){var bvps=bs.bookValue.numVal;bsRows.push({l:"Book Value/Share",v:"$"+bvps.toFixed(2),tip:"Accumulated equity per share — watch the 10-year trend",isGood:bvps>0,highlight:true});}
            // Cash & equivalents
            if(bs.cashPerShare&&bs.cashPerShare.numVal!=null){bsRows.push({l:"Cash/Share",v:"$"+bs.cashPerShare.numVal.toFixed(2),tip:"Cash & equivalents per share",isGood:true});}
            else if(bs.mktCap&&bs.mktCap.numVal!=null&&bs.cashPerShare==null){/* skip */}
            // Net cash position
            if(bs.netDebtEbitda&&bs.netDebtEbitda.numVal!=null){
              var nd=bs.netDebtEbitda.numVal;
              var isNetCash=nd<0;
              bsRows.push({l:"Net Debt/EBITDA",v:isNetCash?"Net cash":nd.toFixed(1)+"x",tip:"Buffett prefers net cash or < 2x EBITDA",isGood:isNetCash||nd<2,isNeutral:nd>=2&&nd<3});
            }
            // Long-term debt trend signal
            if(bs.debtEquity&&bs.debtEquity.numVal!=null){var de=bs.debtEquity.numVal;bsRows.push({l:"Debt/Equity",v:de.toFixed(2)+"x",tip:"Is the company borrowing to grow or to survive?",isGood:de<0.5,isNeutral:de>=0.5&&de<1.5});}
            // Retained earnings (proxy for compounding)
            if(bs.roe&&bs.roe.numVal!=null){var roe2=bs.roe.numVal;bsRows.push({l:"Return on Equity",v:roe2.toFixed(1)+"%",tip:"Buffett: ROE > 15% consistently = durable compounding machine",isGood:roe2>=15,isNeutral:roe2>=10&&roe2<15});}
            // Goodwill signal
            if(bs.goodwillAndIntangibleAssets&&bs.goodwillAndIntangibleAssets.numVal!=null&&bs.totalAssets&&bs.totalAssets.numVal!=null&&bs.totalAssets.numVal>0){
              var gwPct=(bs.goodwillAndIntangibleAssets.numVal/bs.totalAssets.numVal)*100;
              if(gwPct>5)bsRows.push({l:"Goodwill % Assets",v:gwPct.toFixed(0)+"%",tip:"High goodwill signals acquisition-driven growth — examine carefully",isNeutral:gwPct<30,isGood:gwPct<15});
            }
            // Current ratio — liquidity fortress
            if(bs.currentRatio&&bs.currentRatio.numVal!=null){var cr2=bs.currentRatio.numVal;bsRows.push({l:"Current Ratio",v:cr2.toFixed(2),tip:"Can it pay short-term obligations? > 1.5 is comfortable",isGood:cr2>=1.5,isNeutral:cr2>=1&&cr2<1.5});}
            if(bsRows.length>=3)bsSection=bsRows;
          }
          if(sections.length===0&&!bsSection)return null;
          var _bmt2=c.businessModelType||"";
          var _bmtCtx=BUSINESS_MODEL_CONTEXT[_bmt2]||null;
          return<div id="ds-numbers" style={{marginBottom:48}}>
            {_bmtCtx&&<div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",background:K.blue+"08",border:"1px solid "+K.blue+"20",borderRadius:_isBm?0:10,marginBottom:12}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={K.blue} strokeWidth="1.8" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:700,color:K.blue,fontFamily:fm,marginBottom:3}}>{_bmtCtx.label+": standard benchmarks may not apply"}</div>
                <div style={{fontSize:11,color:K.mid,lineHeight:1.6}}>{_bmtCtx.guidance}</div>
              </div>
            </div>}
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600,marginBottom:12}}>OWNER'S NUMBERS</div>
            {bsSection&&<div style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:3,height:10,borderRadius:_isBm?0:2,background:"#EF4444",flexShrink:0}}/>
                <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"#EF4444",fontFamily:fm,fontWeight:700}}>BALANCE SHEET</div>
                <div style={{fontSize:9,color:K.dim,fontFamily:fm,fontStyle:"italic",opacity:.8}}>{"Buffett: “Read the 10-year balance sheet first. Things are harder to hide there.”"}</div>
              </div>
              <div style={{background:K.card,border:"1px solid #EF444420",borderRadius:_isBm?0:10,overflow:"hidden"}}>
                {(bsSection||[]).map(function(row,ri){
                  var col=row.highlight?K.acc:row.isGood?K.grn:row.isNeutral?K.amb:K.mid;
                  return<div key={ri} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderBottom:ri<bsSection.length-1?"1px solid "+K.bdr+"40":"none",background:row.highlight?"#EF444406":"transparent"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {row.highlight&&<div style={{width:4,height:4,borderRadius:"50%",background:"#EF4444",flexShrink:0}}/>}
                      <span style={{fontSize:11,color:K.mid,fontFamily:fm}} title={row.tip||""}>{row.l}</span>
                      {row.tip&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={K.bdr} strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:col,fontFamily:fm}}>{row.v}</span>
                  </div>;
                })}
              </div>
            </div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {(sections||[]).map(function(sec,si){
                var secColor=sec.color;
                return<div key={si}>
                <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:secColor,fontFamily:fm,fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:3,height:10,borderRadius:_isBm?0:2,background:secColor,flexShrink:0}}/>
                  {sec.title}
                </div>
                {sec.gauge
                  ?<>
                <div style={{display:"grid",gridTemplateColumns:"repeat("+Math.min(sec.items.filter(function(it){return it.numVal!=null}).length,4)+",1fr)",gap:8}}>
                    {sec.items.filter(function(it){return it.numVal!=null}).map(function(item,ii){
                      var v=item.numVal;var sp=item.sp500||15;var maxV=Math.max(sp*2.5,v*1.2,40);
                      var pct=Math.min(v/maxV,1);var spPct=Math.min(sp/maxV,1);
                      var col=v>=sp*1.5?K.grn:v>=sp?K.acc:v>=sp*0.6?K.amb:K.red;
                      var cx=40,cy=42,r=32;
                      var ang=function(frac){return Math.PI*(1-frac);};
                      var ptX=function(frac){return(cx+r*Math.cos(ang(frac))).toFixed(1)};
                      var ptY=function(frac){return(cy-r*Math.sin(ang(frac))).toFixed(1)};
                      var arcD="M"+(cx-r).toFixed(1)+" "+cy+" A"+r+" "+r+" 0 0 1 "+(cx+r).toFixed(1)+" "+cy;
                      var fillD="M"+(cx-r).toFixed(1)+" "+cy+" A"+r+" "+r+" 0 0 1 "+ptX(pct)+" "+ptY(pct);
                      return<div key={ii} style={{background:K.bg,border:"1px solid "+K.bdr+"80",borderRadius:_isBm?0:10,padding:"12px 8px 8px",textAlign:"center",cursor:"help"}} title={item.tip||""}>
                        <svg width="80" height="46" viewBox="0 0 80 46" style={{display:"block",margin:"0 auto 4px"}}>
                          <path d={arcD} fill="none" stroke={K.bdr} strokeWidth="6" strokeLinecap="round"/>
                          <path d={fillD} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"/>
                          {/* S&P500 benchmark tick */}
                          <line x1={(cx+r*0.72*Math.cos(ang(spPct))).toFixed(1)} y1={(cy-r*0.72*Math.sin(ang(spPct))).toFixed(1)} x2={(cx+r*1.28*Math.cos(ang(spPct))).toFixed(1)} y2={(cy-r*1.28*Math.sin(ang(spPct))).toFixed(1)} stroke={K.dim} strokeWidth="1.5" opacity="0.6"/>
                          {/* Needle */}
                          <line x1={cx} y1={cy} x2={ptX(pct)} y2={ptY(pct)} stroke={col} strokeWidth="1.8" strokeLinecap="round"/>
                          <circle cx={cx} cy={cy} r="2.5" fill={col}/>
                        </svg>
                        <div style={{fontSize:13,fontWeight:800,color:col,fontFamily:fm,lineHeight:1}}>{item.v}</div>
                        <div style={{fontSize:9,color:K.dim,fontFamily:fm,marginTop:2,letterSpacing:.3}}>{item.l}</div>
                        <div style={{fontSize:8,color:K.dim,fontFamily:fm,marginTop:1,opacity:.7}}>S&P avg {item.sp500}%</div>
                      </div>})}
                  </div>
                  {sec.items.some(function(it){return it.contextNote})&&<div style={{display:"flex",alignItems:"flex-start",gap:6,marginTop:8,padding:"8px 12px",background:K.blue+"06",border:"1px solid "+K.blue+"15",borderRadius:_isBm?0:8}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={K.blue} strokeWidth="2" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div style={{fontSize:10,color:K.mid,lineHeight:1.6,fontFamily:fm}}>{sec.items.find(function(it){return it.contextNote}).contextNote}</div>
                  </div>}
                  </>
                  :<div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:6}}>
                  {(sec.items||[]).map(function(item,ii){
                    var valColor=item.isGood===true?K.grn:item.isGood===false?K.red:item.isNeutral?K.mid:K.txt;
                    return<div key={ii} title={item.tip||""} style={{background:K.bg,border:"1px solid "+K.bdr+"80",borderRadius:_isBm?0:9,padding:"9px 12px",cursor:item.tip?"help":"default",borderLeft:"2px solid "+valColor+"60"}}>
                      <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {item.l}{item.tip&&<span style={{color:K.dim,fontSize:9,marginLeft:3}}>ⓘ</span>}
                      </div>
                      <div style={{fontSize:14,fontWeight:700,fontFamily:fm,color:valColor,lineHeight:1}}>{item.v}</div>
                    </div>})}</div>}
              </div>})}</div></div>})()}


                {/* -- INSIDER ACTIVITY -- */}
        {isPro&&<div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>INSIDER ACTIVITY</div></div>
          {insiderData?<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            {/* Insider Transactions */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 18px"}}>
              <div style={{fontSize:12,fontWeight:600,color:K.txt,marginBottom:10}}>Recent Transactions</div>
              {insiderData.transactions&&insiderData.transactions.length>0?
                <div>{(function(){
                  var buys=insiderData.transactions.filter(function(t2){return t2.transactionType==="P"||(!t2.transactionType&&t2.change>0)});
                  var sells=insiderData.transactions.filter(function(t2){return t2.transactionType==="S"||t2.transactionType==="D"||t2.transactionType==="F"||(!t2.transactionType&&t2.change<0)});
                  var netBuy=buys.length>sells.length;
                  return<div>
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <div style={{flex:1,padding:"6px 10px",borderRadius:_isBm?0:6,background:K.grn+"08",border:"1px solid "+K.grn+"20",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:700,color:K.grn,fontFamily:fm}}>{buys.length}</div>
                        <div style={{fontSize:8,color:K.grn}}>Purchases</div></div>
                      <div style={{flex:1,padding:"6px 10px",borderRadius:_isBm?0:6,background:K.red+"08",border:"1px solid "+K.red+"20",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:700,color:K.red,fontFamily:fm}}>{sells.length}</div>
                        <div style={{fontSize:8,color:K.red}}>Sales</div></div></div>
                    {netBuy&&buys.length>0&&<div style={{fontSize:11,color:K.grn,fontFamily:fm,marginBottom:8}}>Net insider buying — typically a bullish signal</div>}
                    {(function(){
                      // Detect exercise-and-sell: same person, same date, M+S pair of same magnitude
                      var txns=insiderData.transactions.slice(0,10);
                      var exerciseSellKeys={};
                      txns.forEach(function(t2){
                        if(t2.transactionType==="M"){
                          var key=(t2.name||"")+"_"+(t2.transactionDate||"")+"_"+Math.abs(t2.change||0);
                          exerciseSellKeys[key]=true;
                        }
                      });
                      function isExerciseSell(t2){
                        if(t2.transactionType!=="S")return false;
                        var key=(t2.name||"")+"_"+(t2.transactionDate||"")+"_"+Math.abs(t2.change||0);
                        return!!exerciseSellKeys[key];
                      }
                      return txns.slice(0,6).map(function(t2,i2){
                        var txT=t2.transactionType||"";
                        var exSell=isExerciseSell(t2);
                        var lbl=exSell?"EXER+SELL":txT==="P"?"BUY":txT==="S"?"SELL":txT==="A"?"GRANT":txT==="M"?"EXERCISE":txT==="F"?"TAX-WITHHELD":txT==="D"?"DISPOSE":t2.change>0?"BUY":"SELL";
                        var lclr=exSell?K.dim:txT==="P"?K.grn:txT==="S"||txT==="D"||txT==="F"?K.red:txT==="A"||txT==="M"?K.blue:t2.change>0?K.grn:K.red;
                        var role=(t2.name||"").toLowerCase();var isExec=role.indexOf("ceo")>=0||role.indexOf("cfo")>=0||role.indexOf("chief")>=0||role.indexOf("president")>=0||role.indexOf("director")>=0;
                        return<div key={i2} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 0",borderBottom:i2<5?"1px solid "+K.bdr+"30":"none"}}>
                          <div style={{width:24,height:24,borderRadius:"50%",background:isExec?K.acc+"15":K.bg,border:"1px solid "+(isExec?K.acc+"30":K.bdr),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isExec?K.acc:K.dim} strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                          <div style={{flex:1,overflow:"hidden"}}>
                            <div style={{fontSize:11,fontWeight:600,color:K.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t2.name}</div>
                            <div style={{fontSize:9,color:K.dim}}>{t2.transactionDate}</div>
                            {exSell&&<div style={{fontSize:9,color:K.dim,fontFamily:fb,marginTop:2,lineHeight:1.4}}>Option exercise &amp; same-day sale — not a directional signal</div>}
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:11,fontWeight:600,color:lclr,fontFamily:fm}}>{lbl}</div>
                            <div style={{fontSize:9,color:K.dim,fontFamily:fm}}>{Math.abs(t2.change||0).toLocaleString()} sh</div>
                          </div>
                        </div>;
                      })})()}</div>})()}</div>
              :<div style={{fontSize:12,color:K.dim,padding:"8px 0"}}>No recent insider transactions</div>}
            </div>
            {/* Top Institutional Holders */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 18px"}}>
              <div style={{fontSize:12,fontWeight:600,color:K.txt,marginBottom:10}}>Top Institutional Holders</div>
              {insiderData.institutions&&insiderData.institutions.length>0?
                <div>{insiderData.institutions.slice(0,7).map(function(inst,i2){
                  var isVanguard=(inst.holder||"").indexOf("Vanguard")>=0;var isBlackrock=(inst.holder||"").indexOf("BlackRock")>=0||((inst.holder||"").indexOf("Blackrock")>=0);var isFidelity=(inst.holder||"").indexOf("Fidelity")>=0;
                  var isPassive=isVanguard||isBlackrock||isFidelity;
                  return<div key={i2} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i2<6?"1px solid "+K.bdr+"30":"none"}}>
                    <div style={{width:24,height:24,borderRadius:"50%",background:isPassive?K.blue+"12":K.acc+"12",border:"1px solid "+(isPassive?K.blue+"25":K.acc+"25"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isPassive?K.blue:K.acc} strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8l-2 4h12l-2-4z"/></svg></div>
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
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px",textAlign:"center"}}>
              <div className="ta-skel" style={{height:8,width:"70%",background:K.bdr,margin:"0 auto 8px",borderRadius:_isBm?0:4}}/>
              <div className="ta-skel" style={{height:6,background:K.bdr,borderRadius:_isBm?0:3}}/></div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px",textAlign:"center"}}>
              <div className="ta-skel" style={{height:8,width:"70%",background:K.bdr,margin:"0 auto 8px",borderRadius:_isBm?0:4}}/>
              <div className="ta-skel" style={{height:6,background:K.bdr,borderRadius:_isBm?0:3}}/></div></div>}
        </div>}
        {/* ── STRESS TEST ── */}
        {(function(){var scenarios=c.scenarios||[];var answeredCount=scenarios.length;
          return<div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>STRESS TEST</div>
            <button onClick={function(){setModal({type:"scenario"})}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><IC name="shield" size={10} color={K.acc}/>{answeredCount>0?"Review plans":"Plan ahead"}</button></div>
          {answeredCount>0?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:600,color:K.txt}}>{answeredCount} scenario{answeredCount>1?"s":""} planned</div>
              <div style={{flex:1}}/>
              <span style={{fontSize:10,color:K.grn,fontFamily:fm,fontWeight:600,background:K.grn+"10",padding:"2px 8px",borderRadius:_isBm?0:4}}>{answeredCount>=5?"Well prepared":answeredCount>=3?"Good start":"Keep going"}</span></div>
            {scenarios.slice(0,3).map(function(s){return<div key={s.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 0",borderTop:"1px solid "+K.bdr+"30",cursor:"pointer"}} onClick={function(){setModal({type:"scenario",data:s.id})}}>
              <IC name="check" size={12} color={K.grn}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,fontWeight:600,color:K.acc,fontFamily:fm}}>{(s.category||"").toUpperCase()}</div>
                <div style={{fontSize:12,color:K.mid,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{s.response}</div></div>
              <span style={{fontSize:10,color:K.dim,fontFamily:fm,flexShrink:0}}>{s.answeredAt?fD(s.answeredAt):""}</span></div>})}
          </div>
          :<div style={{background:K.card,border:"1px dashed "+K.acc+"30",borderRadius:_isBm?0:12,padding:"20px",textAlign:"center",cursor:"pointer"}} onClick={function(){setModal({type:"scenario"})}}>
            <IC name="shield" size={20} color={K.acc}/>
            <div style={{fontSize:13,color:K.acc,fontWeight:600,marginBottom:4}}>Stress-test your conviction</div>
            <div style={{fontSize:12,color:K.dim,lineHeight:1.5,maxWidth:320,margin:"0 auto"}}>What would you do if {c.ticker} dropped 40%? If the CEO resigned? Plan your response now.</div></div>}
        </div>})()}
      </div>}{/* end dossierMktOpen */}

        {/* ── PEERS & COMPETITORS ── */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>PEERS & COMPETITORS</div>
            <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>via Finnhub</span>
          </div>
          {peersLoading&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px",textAlign:"center"}}><div style={{fontSize:12,color:K.dim}}>Loading peers...</div></div>}
          {!peersLoading&&peersData&&peersData.length>0&&(function(){
            var COLS=[
              {label:"Gross Margin",key:function(m){return m&&m.ratios?m.ratios.grossProfitMarginTTM!=null?m.ratios.grossProfitMarginTTM*100:null:null},fmt:function(v){return v.toFixed(1)+"%"},good:function(v){return v>40}},
              {label:"Op Margin",key:function(m){return m&&m.ratios?m.ratios.operatingProfitMarginTTM!=null?m.ratios.operatingProfitMarginTTM*100:null:null},fmt:function(v){return v.toFixed(1)+"%"},good:function(v){return v>15}},
              {label:"ROIC",key:function(m){return m&&m.km?m.km.returnOnInvestedCapitalTTM!=null?m.km.returnOnInvestedCapitalTTM*100:null:null},fmt:function(v){return v.toFixed(1)+"%"},good:function(v){return v>12}},
              {label:"P/E",key:function(m){return m&&m.km?m.km.peRatioTTM:null},fmt:function(v){return v.toFixed(1)+"x"},good:function(v){return v<25}},
              {label:"Rev Growth",key:function(m){return m&&m.ratios?m.ratios.revenueGrowthTTM!=null?m.ratios.revenueGrowthTTM*100:null:null},fmt:function(v){return(v>0?"+":"")+v.toFixed(1)+"%"},good:function(v){return v>5}},
            ];
            var mySnap=c.financialSnapshot||{};
            var myRow={ticker:c.ticker,isSelf:true,metrics:{
              ratios:{grossProfitMarginTTM:mySnap.grossMargin&&mySnap.grossMargin.numVal!=null?mySnap.grossMargin.numVal/100:null,
                operatingProfitMarginTTM:mySnap.opMargin&&mySnap.opMargin.numVal!=null?mySnap.opMargin.numVal/100:null,
                revenueGrowthTTM:mySnap.revGrowth&&mySnap.revGrowth.numVal!=null?mySnap.revGrowth.numVal/100:null},
              km:{returnOnInvestedCapitalTTM:mySnap.roic&&mySnap.roic.numVal!=null?mySnap.roic.numVal/100:null,peRatioTTM:mySnap.pe&&mySnap.pe.numVal!=null?mySnap.pe.numVal:null}
            }};
            var allRows=[myRow].concat(peersData);
            return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
              {/* Header */}
              <div style={{display:"flex",padding:"8px 16px",borderBottom:"1px solid "+K.bdr,background:K.bg}}>
                <div style={{width:70,fontSize:9,fontWeight:700,color:K.dim,fontFamily:fm,textTransform:"uppercase",letterSpacing:.5}}>Company</div>
                {COLS.map(function(col,ci){return<div key={ci} style={{flex:1,textAlign:"right",fontSize:9,fontWeight:700,color:K.dim,fontFamily:fm,textTransform:"uppercase",letterSpacing:.5}}>{col.label}</div>})}
              </div>
              {(allRows||[]).map(function(row,ri){
                return<div key={ri} style={{display:"flex",alignItems:"center",padding:"10px 16px",borderBottom:ri<allRows.length-1?"1px solid "+K.bdr+"40":"none",background:row.isSelf?K.acc+"06":"transparent",cursor:row.isSelf?"default":"pointer"}}
                  onClick={function(){if(!row.isSelf){var found=cos.find(function(co){return co.ticker===row.ticker});if(found){setSelId(found.id);setDetailTab("dossier")}}}}
                  onMouseEnter={function(e){if(!row.isSelf)e.currentTarget.style.background=K.acc+"04"}}
                  onMouseLeave={function(e){if(!row.isSelf)e.currentTarget.style.background="transparent"}}>
                  <div style={{width:70,display:"flex",alignItems:"center",gap:4}}>
                    <CoLogo ticker={row.ticker} domain={row.isSelf?c.domain:""} size={16}/>
                    <span style={{fontSize:11,fontWeight:row.isSelf?700:500,color:row.isSelf?K.acc:K.txt,fontFamily:fm}}>{row.ticker}</span>
                    {row.isSelf&&<span style={{fontSize:8,color:K.acc,fontFamily:fm}}>you</span>}
                  </div>
                  {COLS.map(function(col,ci){
                    var val=col.key(row.metrics);
                    var isGood=val!=null&&col.good(val);
                    var color=val!=null?(isGood?K.grn:K.red):K.dim;
                    return<div key={ci} style={{flex:1,textAlign:"right",fontSize:11,fontWeight:600,color:color,fontFamily:fm}}>
                      {val!=null?col.fmt(val):"—"}
                    </div>})}
                </div>})}
            </div>;
          })()}
          {!peersLoading&&(!peersData||peersData.length===0)&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",fontSize:12,color:K.dim}}>No peer data available for {c.ticker}.</div>}
        </div>

                {/* ── 4. THE MOAT ── */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>THE MOAT</div>
            <button onClick={function(){setSubPage("moat")}} style={{background:"none",border:"none",color:K.acc,fontSize:11,cursor:"pointer",fontFamily:fm}}>Full analysis {"→"}</button></div>
          {dossierMoat?(function(){
            var comp=dossierMoat.composite;var mColor=comp>=8?K.grn:comp>=6?K.amb:K.red;
            var mLabel=comp>=8?"Wide Moat":comp>=6?"Narrow Moat":comp>=4?"Weak Moat":"No Moat";
            var _moatBmtCtx=BUSINESS_MODEL_CONTEXT[c.businessModelType||""]||null;
            return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"18px 22px"}}>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
                <div style={{width:56,height:56,borderRadius:"50%",border:"3px solid "+mColor,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontSize:22,fontWeight:800,color:mColor,fontFamily:fm,lineHeight:1}}>{comp}</div>
                  <div style={{fontSize:7,color:K.dim,fontFamily:fm}}>/10</div></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600,color:mColor,fontFamily:fh}}>{mLabel}</div>
                  {_moatBmtCtx
                    ?<div style={{fontSize:10,color:K.blue,fontFamily:fb,lineHeight:1.5}}>
                       {"\u2139\uFE0F "+_moatBmtCtx.label+": score based on financial metrics. "+(_moatBmtCtx===BUSINESS_MODEL_CONTEXT.serial_acquirer?"The real moat is acquisition discipline & organic growth — not fully captured here.":_moatBmtCtx===BUSINESS_MODEL_CONTEXT.distributor?"Low margins are structural. Moat lives in logistics density & switching costs.":"Adjust expectations for this business model.")}
                    </div>
                    :<div style={{fontSize:10,color:K.dim,fontFamily:fb}}>Based on financial fundamentals — ROIC, margins, moat persistence</div>}
                  <div style={{fontSize:11,color:K.dim}}>{dossierMoat.years}yr data · {dossierMoat.metrics.length} dimensions</div></div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  {(function(){var mt2=c.moatTypes||{};var activeMts=MOAT_TYPES.filter(function(t2){return mt2[t2.id]&&mt2[t2.id].active});return activeMts.length>0?<div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                    <div style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:0.5}}>YOUR MOAT TYPES</div>
                    <div style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"flex-end"}}>
                      {(activeMts||[]).map(function(t2){return<span key={t2.id} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:8,color:t2.color,background:t2.color+"10",padding:"2px 7px",borderRadius:_isBm?0:3,fontFamily:fm,fontWeight:600}}><IC name={t2.icon} size={10} color={t2.color}/>{t2.label}</span>})}
                    </div>
                  </div>:<button onClick={function(){setSubPage("moat")}} style={{fontSize:9,color:K.acc,background:"none",border:"1px dashed "+K.acc+"50",borderRadius:_isBm?0:4,padding:"3px 8px",cursor:"pointer",fontFamily:fm}}>+ Tag moat types</button>})()}</div></div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"4px 16px"}}>
                {dossierMoat.metrics.slice(0,8).map(function(m){var barColor=m.score>=8?K.grn:m.score>=6?K.amb:K.red;
                  return<div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0"}}>
                    <span style={{fontSize:10,color:K.mid,fontFamily:fm,width:isMobile?90:110,flexShrink:0}}>{m.name.length>18?m.name.substring(0,18)+"…":m.name}</span>
                    <div style={{flex:1,height:6,borderRadius:_isBm?0:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:(m.score*10)+"%",borderRadius:_isBm?0:3,background:barColor,transition:"width .4s"}}/></div>
                    <span style={{fontSize:10,fontWeight:700,color:barColor,fontFamily:fm,width:20,textAlign:"right"}}>{m.score.toFixed(0)}</span></div>})}</div>
            </div>})()
          :!isPro?<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px",textAlign:"center"}}>
            <div style={{fontSize:13,color:K.dim,marginBottom:8}}>Moat analysis powered by financial data</div>
            <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("financials")}} style={Object.assign({},S.btn,{fontSize:11,padding:"5px 14px"})}>Upgrade to unlock</button></div>
          :<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px",textAlign:"center"}}>
            <div className="ta-skel" style={{height:10,width:"60%",background:K.bdr,margin:"0 auto 8px",borderRadius:_isBm?0:4}}/>
            <div className="ta-skel" style={{height:6,background:K.bdr,borderRadius:_isBm?0:3}}/></div>}
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
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginBottom:16}}>
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
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px"}}>
            <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
              {[{k:"revenue",l:"Revenue",c:"#1cb0f6"},{k:"netIncome",l:"Net Income",c:"#58cc02"},{k:"fcf",l:"Free Cash Flow",c:"#ff9600"},{k:"sbc",l:"Stock-Based Comp",c:"#ce82ff"}].map(function(m){
                return<div key={m.k} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:8,height:8,borderRadius:_isBm?0:2,background:m.c}}/>
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
                  {(keyFin||[]).map(function(pt,di){
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
                  return<div style={{position:"absolute",left:Math.min(Math.max(tx,8),cW3-160),top:4,background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"8px 12px",boxShadow:"0 4px 16px rgba(0,0,0,.2)",pointerEvents:"none",zIndex:10,minWidth:130}}>
                    <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:4}}>{pt.date?pt.date.substring(0,4):""}</div>
                    {MK.map(function(m){return pt[m.k]!=null?<div key={m.k} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{width:6,height:6,borderRadius:_isBm?0:2,background:m.c,flexShrink:0}}/>
                      <span style={{fontSize:10,color:K.mid,fontFamily:fm,flex:1}}>{m.k==="revenue"?"Revenue":m.k==="netIncome"?"Net Income":m.k==="fcf"?"FCF":"SBC"}</span>
                      <span style={{fontSize:11,fontWeight:700,color:m.c,fontFamily:fm}}>{fmtBig(pt[m.k])}</span></div>:null})}</div>})()}
              </div>})()}
          </div>
        </div>}

        {/* ── LINKS ── */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:20}}>
          <div className="ta-card" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}} onClick={function(){if(isPro){setSubPage("financials")}else{setShowUpgrade(true);setUpgradeCtx("financials")}}}>
            <IC name="chart" size={16} color={K.blue}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:K.txt}}>Full Financials</div>
              <div style={{fontSize:10,color:K.dim}}>Income, balance, cash flow</div></div>
            {!isPro&&<span style={{fontSize:8,color:K.acc,fontFamily:fm,background:K.acc+"12",padding:"2px 5px",borderRadius:_isBm?0:3}}>PRO</span>}
            <span style={{color:K.acc}}>{"→"}</span></div>
          {c.irUrl&&<a href={c.irUrl} target="_blank" rel="noopener noreferrer" style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}>
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
            return d2.cardType&&CARD_STYLES[d2.cardType]?<JournalCard key={di} entry={d2}/>:<div key={di} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"10px 14px",marginBottom:6,fontSize:12,color:K.mid}}>
              <span style={{fontWeight:600,color:K.txt}}>{d2.title||d2.ticker||""}</span> {d2.content?d2.content.substring(0,80)+"...":d2.reasoning?d2.reasoning.substring(0,80)+"...":""}</div>})}</div>}

        {/* Charts & analyst data (collapsible) */}
        {dashSet.showPriceChart&&<PriceChart company={c}/>}

        {/* ── RESEARCH TRAIL (tabbed) ── */}
        {(function(){
          var _rtT=useState("notes"),rtTab=_rtT[0],setRtTab=_rtT[1];
          var nDoc=(c.docs||[]).length;
          var nLinks=(c.researchLinks||[]).length;
          var RT_TABS=[
            {id:"notes",label:"Notes",count:nDoc},
            {id:"links",label:"Links",count:nLinks},
            {id:"filings",label:"Filings"},
          ];
          var addBtn=rtTab==="notes"?<div style={{display:"flex",gap:6}}>
              <button style={Object.assign({},S.btnP,{padding:"4px 11px",fontSize:11})} onClick={function(){setModal({type:"memo"})}}>+ Memo</button>
              <button style={Object.assign({},S.btn,{padding:"4px 11px",fontSize:11})} onClick={function(){setModal({type:"clip"})}}>+ Clip</button>
              <button style={Object.assign({},S.btn,{padding:"4px 11px",fontSize:11})} onClick={function(){setModal({type:"doc"})}}>+ Note</button>
            </div>:null;
          return<div id="ds-research" style={{marginBottom:48,marginTop:8}}>
            <div style={{paddingTop:20,borderTop:"1px solid "+K.bdr,marginBottom:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:3,height:22,borderRadius:_isBm?0:2,background:K.acc,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:14,letterSpacing:1,textTransform:"uppercase",color:K.txt,fontFamily:fh,fontWeight:800}}>Research Trail</div>
                    <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginTop:1,letterSpacing:0.2}}>Notes, links, filings</div>
                  </div>
                </div>
                {addBtn}
              </div>
              <div style={{display:"flex",gap:4,marginBottom:14}}>
                {RT_TABS.map(function(tb){
                  var active=rtTab===tb.id;
                  return<button key={tb.id} onClick={function(){setRtTab(tb.id)}} style={{
                    padding:active?"8px 20px":"7px 18px",
                    borderRadius:_isBm?0:999,
                    border:"1px solid "+(active?K.acc:K.bdr),
                    background:active?K.acc+"12":"transparent",
                    color:active?K.acc:K.dim,
                    fontSize:11,fontWeight:active?700:400,cursor:"pointer",fontFamily:fm,
                    display:"flex",alignItems:"center",gap:4,transition:"all .15s"
                  }}>
                    {tb.label}
                    {tb.count>0&&<span style={{fontSize:9,background:active?K.acc+"25":K.bdr,color:active?K.acc:K.dim,borderRadius:_isBm?0:3,padding:"1px 5px",fontFamily:fm,fontWeight:700}}>{tb.count}</span>}
                  </button>;
                })}
              </div>
            </div>
            {rtTab==="notes"&&<ThesisVault company={c}/>}
            {rtTab==="links"&&<ResearchLinks company={c}/>}
            {rtTab==="filings"&&<div>
              <SECFilings company={c}/>
              <ThesisScorecard company={c}/>
              {c.convictionHistory&&c.convictionHistory.length>1&&<div style={{marginBottom:20}}>
                <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Conviction Over Time</div>
                <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 20px"}}>
                  <div style={{display:"flex",alignItems:"flex-end",gap:2,height:50,marginBottom:6}}>
                    {(c.convictionHistory||[]).map(function(ch,i){var pct=ch.rating*10;return<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <div style={{fontSize:8,fontWeight:600,color:ch.rating>=8?K.grn:ch.rating>=5?K.amb:K.red,fontFamily:fm}}>{ch.rating}</div>
                      <div style={{width:"100%",maxWidth:20,height:pct+"%",minHeight:2,borderRadius:_isBm?0:2,background:ch.rating>=8?K.grn:ch.rating>=5?K.amb:K.red}}/></div>})}
                  </div>
                  <div style={{display:"flex",gap:2}}>
                    {(c.convictionHistory||[]).map(function(ch,i){return<div key={i} style={{flex:1,textAlign:"center",fontSize:7,color:K.dim,fontFamily:fm}}>{ch.date.substring(5)}</div>})}
                  </div>
                </div>
              </div>}
              <div style={{padding:"12px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,marginTop:8}}>
                <div style={{fontSize:11,color:K.dim,lineHeight:1.6}}>{"ℹ️"} Data from SEC EDGAR + FMP + Finnhub</div>
              </div>
            </div>}
            {/* Decision Log folder — always visible */}
            <DecisionJournal company={c}/>
          </div>;
        })()}
        {/* ── Research Prompts (dossier inline) ── */}
        {(function(){
          var hasThesis=c.thesisNote&&c.thesisNote.trim().length>30;
          var DOSS_PROMPTS=[
            {type:"challenge",label:"Challenge My Thesis",icon:"shield",color:K.red},
            {type:"earnings",label:"Pre-Earnings Briefing",icon:"target",color:K.amb},
            {type:"annual",label:"Annual Review",icon:"clock",color:K.acc},
            {type:"bear",label:"Bear Case",icon:"alert",color:"#ef4444"},
            {type:"sell",label:"Sell Discipline Check",icon:"check",color:K.grn},
          ];
          var FRAMING_DOSS={
            challenge:{why:"ChatGPT has never seen your thesis. This prompt feeds it your thesis, conviction history, and KPIs — then asks it to attack your specific arguments.",dataPoints:["Your thesis","Conviction history","KPIs","Decisions log"]},
            earnings:{why:"Not a generic earnings preview. This prompt tells the AI exactly what YOU need to see — based on your specific thesis and sell criteria.",dataPoints:["Your thesis","Your KPIs","Your sell criteria","Earnings date"]},
            annual:{why:"After months of ownership you have something no AI has ever seen: your own conviction trajectory, journal entries, and decisions. This prompt sends all of that and asks if you should still own this.",dataPoints:["Conviction history","Decisions log","Journal entries","Original thesis"]},
            bear:{why:"You know the bull case — you wrote it. This prompt asks the AI to dismantle it as aggressively as possible using your own arguments.",dataPoints:["Your bull thesis","Your moat argument","Risks acknowledged","Conviction level"]},
            sell:{why:"This prompt takes your sell criteria — written when you were calm — and asks the AI whether they have actually been triggered, or whether you are making an emotional decision.",dataPoints:["Your sell criteria","Recent decisions","Journal entries","Conviction trajectory"]},
          };
          return<div style={{marginTop:20,paddingTop:20,borderTop:"1px solid "+K.bdr}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <IC name="lightbulb" size={14} color={K.acc}/>
              <div style={{fontSize:12,fontWeight:700,color:K.acc,fontFamily:fb,textTransform:"uppercase",letterSpacing:1}}>Research Prompts</div>
            </div>
            <div style={{fontSize:12,color:K.dim,fontFamily:fb,marginBottom:14,lineHeight:1.5}}>{hasThesis?"Generate a context-rich prompt built from your thesis, KPIs, and decisions — then open it in Claude, ChatGPT, or Gemini.":"Write a thesis first to unlock AI prompts for this holding."}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {DOSS_PROMPTS.map(function(dp){
                var needsThesis=["challenge","annual","bear","sell"].indexOf(dp.type)>=0&&!hasThesis;
                return<button key={dp.type} onClick={function(){
                  if(needsThesis)return;
                  var fr=FRAMING_DOSS[dp.type];
                  setAiModal({title:dp.label+" — "+c.ticker,framing:fr,prompt:buildPrompt(dp.type,c)});
                }} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:_isBm?0:8,border:"1px solid "+dp.color+(needsThesis?"20":"40"),background:dp.color+(needsThesis?"05":"0d"),color:dp.color,fontSize:12,fontWeight:600,cursor:needsThesis?"not-allowed":"pointer",fontFamily:fm,opacity:needsThesis?0.4:1}}>
                  <IC name={dp.icon} size={12} color={dp.color}/>{dp.label}
                </button>;
              })}
            </div>
          </div>;
        })()}


        </div>}
      </div>}
    </div>
  }





  // ── Alignment Widget (shared, used in Dashboard + NW Hub) ─
  function AlignmentWidget({signals, compact, onAI, onGo, onSellCheck}){
    var _open=useState(false),open=_open[0],setOpen=_open[1];
    var all=[].concat(signals.mismatches,signals.flags);
    if(all.length===0)return null;

    var high=signals.mismatches.filter(function(m){return m.severity==="high"});
    var med=[].concat(
      signals.mismatches.filter(function(m){return m.severity==="medium"}),
      signals.flags
    );
    var scoreColor=signals.score>=80?K.grn:signals.score>=60?K.amb:K.red;
    var headerColor=high.length>0?K.red:K.amb;

    if(compact){
      // Compact version for Net Worth Hub — inline banner
      return<div style={{background:headerColor+"0d",border:"1px solid "+headerColor+"30",borderRadius:_isBm?0:12,padding:"14px 18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:open&&all.length>0?12:0}}>
          <IC name="alert" size={14} color={headerColor}/>
          <div style={{flex:1}}>
            <span style={{fontSize:13,fontWeight:700,color:K.txt,fontFamily:fm}}>Ownership Alignment</span>
            <span style={{fontSize:12,color:K.dim,fontFamily:fb,marginLeft:8}}>
              {high.length>0?high.length+" issue"+(high.length>1?"s":"")+" need attention":med.length+" thing"+(med.length>1?"s":"")+" to consider"}
            </span>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:scoreColor,fontFamily:fm,marginRight:8}}>{signals.score}/100</div>
          <button onClick={function(){setOpen(!open)}} style={{background:"none",border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fb,padding:"4px 10px"}}>
            {open?"Hide":"Details"}
          </button>
        </div>
        {open&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(all||[]).map(function(item,i){return<div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",background:item.color+"08",borderRadius:_isBm?0:9,border:"1px solid "+item.color+"25"}}>
            <IC name={item.severity==="high"?"alert":"check"} size={12} color={item.color} style={{marginTop:2,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:2}}>{item.msg}</div>
              <div style={{fontSize:11,color:K.dim,fontFamily:fb}}>{item.action}</div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              {item._sellCheck&&onSellCheck&&<button onClick={function(){onSellCheck(item.c)}} style={{padding:"4px 10px",borderRadius:_isBm?0:6,border:"1px solid "+K.red+"40",background:K.red+"0d",color:K.red,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fb}}>Sell Check</button>}
              {!item._sellCheck&&item.aiType&&onAI&&<button onClick={function(){onAI(item)}} style={{padding:"4px 10px",borderRadius:_isBm?0:6,border:"1px solid "+K.acc+"40",background:K.acc+"0d",color:K.acc,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fb}}>AI Review</button>}
              {!item._sellCheck&&onGo&&<button onClick={function(){onGo(item.c)}} style={{padding:"4px 10px",borderRadius:_isBm?0:6,border:"1px solid "+K.bdr,background:"transparent",color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fb}}>Go →</button>}
            </div>
          </div>})}
        </div>}
      </div>;
    }

    // Full version for Dashboard
    return<div style={{background:K.card,border:"1px solid "+(high.length>0?K.red+"40":K.amb+"40"),borderRadius:_isBm?0:14,marginBottom:16,overflow:"hidden"}}>
      {/* Header row */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",cursor:"pointer",borderBottom:open?"1px solid "+K.bdr:"none"}} onClick={function(){setOpen(!open)}}>
        <div style={{width:36,height:36,borderRadius:_isBm?0:10,background:headerColor+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <IC name="alert" size={16} color={headerColor}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm,marginBottom:2}}>Ownership Alignment</div>
          <div style={{fontSize:12,color:K.dim,fontFamily:fb}}>
            {high.length>0
              ?high.length+" position"+(high.length>1?"s have":" has")+" a mismatch between conviction and size"
              :med.length+" thing"+(med.length>1?"s":"")+" to consider across your portfolio"
            }
          </div>
        </div>
        {/* Score pill */}
        <div style={{flexShrink:0,textAlign:"center",background:scoreColor+"12",border:"1px solid "+scoreColor+"30",borderRadius:_isBm?0:10,padding:"6px 14px"}}>
          <div style={{fontSize:18,fontWeight:800,color:scoreColor,fontFamily:fm,lineHeight:1}}>{signals.score}</div>
          <div style={{fontSize:9,color:K.dim,fontFamily:fb,textTransform:"uppercase",letterSpacing:1,marginTop:2}}>Alignment</div>
        </div>
        <IC name={open?"alert":"plus"} size={12} color={K.dim}/>
      </div>

      {open&&<div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
        {/* High severity first */}
        {high.length>0&&<div>
          <div style={{fontSize:10,fontWeight:700,color:K.red,fontFamily:fb,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Needs attention</div>
          {(high||[]).map(function(item,i){
            return<div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 16px",background:K.red+"08",borderRadius:_isBm?0:10,border:"1px solid "+K.red+"25",marginBottom:8}}>
              <IC name="alert" size={14} color={K.red} style={{flexShrink:0,marginTop:1}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:3}}>{item.msg}</div>
                <div style={{fontSize:11,color:K.dim,fontFamily:fb,marginBottom:8}}>{item.action}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {item.aiType&&onAI&&<button onClick={function(){onAI(item)}} style={{padding:"5px 12px",borderRadius:_isBm?0:7,border:"1px solid "+K.acc+"50",background:K.acc+"0d",color:K.acc,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:fm,display:"flex",alignItems:"center",gap:5}}>
                    <IC name="lightbulb" size={12} color={K.acc}/>Generate AI Review
                  </button>}
                  {onGo&&<button onClick={function(){onGo(item.c)}} style={{padding:"5px 12px",borderRadius:_isBm?0:7,border:"1px solid "+K.bdr,background:"transparent",color:K.mid,fontSize:11,cursor:"pointer",fontFamily:fb}}>
                    Open {item.ticker} →
                  </button>}
                </div>
              </div>
              <div style={{flexShrink:0,textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:800,color:item.pct>=0?K.txt:K.dim,fontFamily:fm}}>{item.pct?item.pct.toFixed(1)+"%":"—"}</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fb}}>of portfolio</div>
                <div style={{fontSize:13,fontWeight:600,color:item.conviction<=4?K.red:item.conviction>=8?K.grn:K.amb,fontFamily:fm,marginTop:4}}>{item.conviction}/10</div>
                <div style={{fontSize:10,color:K.dim,fontFamily:fb}}>conviction</div>
              </div>
            </div>;
          })}
        </div>}
        {/* Medium / flags */}
        {med.length>0&&<div>
          <div style={{fontSize:10,fontWeight:700,color:K.amb,fontFamily:fb,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Worth considering</div>
          {(med||[]).map(function(item,i){
            return<div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:K.amb+"08",borderRadius:_isBm?0:9,border:"1px solid "+K.amb+"25",marginBottom:6}}>
              <IC name="check" size={12} color={K.amb}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:1}}>{item.msg}</div>
                <div style={{fontSize:11,color:K.dim,fontFamily:fb}}>{item.action}</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                {item._sellCheck&&onSellCheck&&<button onClick={function(){onSellCheck(item.c)}} style={{padding:"4px 10px",borderRadius:_isBm?0:6,border:"1px solid "+K.red+"40",background:K.red+"0d",color:K.red,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fb}}>Sell Check</button>}
                {!item._sellCheck&&item.aiType&&onAI&&<button onClick={function(){onAI(item)}} style={{padding:"4px 10px",borderRadius:_isBm?0:6,border:"1px solid "+K.acc+"40",background:K.acc+"0d",color:K.acc,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:fb}}>AI</button>}
                {!item._sellCheck&&onGo&&<button onClick={function(){onGo(item.c)}} style={{padding:"4px 10px",borderRadius:_isBm?0:6,border:"1px solid "+K.bdr,background:"transparent",color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fb}}>{item.ticker} →</button>}
              </div>
            </div>;
          })}
        </div>}

        {/* If all clean for a section */}
        {all.length===0&&<div style={{textAlign:"center",color:K.grn,fontSize:13,padding:"12px 0",fontFamily:fb}}>
          ✓ Conviction and position sizing are well aligned
        </div>}
      </div>}
    </div>;
  }





  function buildPortfolioPrompt(type, portCos){
    var holdings=(portCos||[]).map(function(c){
      var p=c.position||{};
      var val=p.shares>0&&p.currentPrice>0?p.shares*p.currentPrice:0;
      var ret=p.shares>0&&p.avgCost>0&&p.currentPrice>0?((p.currentPrice-p.avgCost)/p.avgCost*100):null;
      var hasThesis=c.thesisNote&&c.thesisNote.trim().length>30;
      var hasSell=(function(){var s=parseThesis(c.thesisNote);return s.sell&&s.sell.trim().length>10})();
      return{c:c,val:val,ret:ret,hasThesis:hasThesis,hasSell:hasSell};
    }).sort(function(a,b){return b.val-a.val});
    var totalVal=holdings.reduce(function(s,h){return s+h.val},0);
    var holdingLines=(holdings||[]).map(function(h){
      var pct=totalVal>0?(h.val/totalVal*100).toFixed(1):0;
      return"- "+h.c.ticker+" ("+pct+"% of portfolio, conviction "+h.c.conviction+"/10"+(h.ret!==null?", return "+(h.ret>=0?"+":"")+h.ret.toFixed(1)+"%":"")+", thesis: "+(h.hasThesis?"written":"MISSING")+", sell criteria: "+(h.hasSell?"written":"MISSING")+")";
    }).join("\n");
    var style=portCos.length>0?(portCos[0].investStyle||"not specified"):"not specified";

    if(type==="port_health"){
      return"You are a portfolio analyst conducting a rigorous review of my equity portfolio. I am not asking for stock picks or financial advice. I am asking you to evaluate the quality of my investment process.\n\n--- MY PORTFOLIO ---\n\nInvestment style: "+style.replace(/_/g," ")+"\nTotal holdings: "+portCos.length+"\n\n"+holdingLines+"\n\n--- YOUR TASK ---\n\n1. Where is my conviction inconsistent with my position sizing? (high conviction but small position, or vice versa)\n2. Which holdings have the most concerning combination of factors — low conviction, negative return, no thesis written?\n3. What does my portfolio say about my actual investment style vs my stated style?\n4. What are the top 3 actions I should take this week based on this data alone?\n5. What question about my portfolio am I probably not asking myself?";
    }
    if(type==="consistency"){
      var theses=portCos.filter(function(c){return c.thesisNote&&c.thesisNote.length>50}).slice(0,5).map(function(c){return c.ticker+":\n"+c.thesisNote.slice(0,400)}).join("\n\n---\n\n");
      return"You are an investment philosopher reviewing whether my portfolio is internally consistent.\n\n--- MY PORTFOLIO OVERVIEW ---\n\nInvestment style: "+style.replace(/_/g," ")+"\n\nHOLDINGS:\n"+holdingLines+"\n\n--- SAMPLE OF MY THESES ---\n\n"+theses+"\n\n--- YOUR TASK ---\n\n1. Are my theses consistent with each other and with my stated investment style? Where are the contradictions?\n2. Which holding looks most out of place in this portfolio? Why?\n3. What does the collection of companies I own reveal about my real mental models and biases?\n4. If this portfolio had a personality, how would you describe it in one paragraph?\n5. What type of holding is conspicuously absent — and should I care?";
    }
    if(type==="concentration"){
      return"You are a risk manager reviewing my portfolio concentration.\n\n--- MY PORTFOLIO ---\n\n"+holdingLines+"\n\n--- YOUR TASK ---\n\n1. What are my top 3 concentration risks — by position size, sector, or correlated thesis?\n2. If my top 2 holdings dropped 40% simultaneously, how damaged would my portfolio be — financially and psychologically?\n3. Where is my diversification false — holdings that feel different but would likely fall together in a downturn?\n4. What is the optimal number of holdings for someone with my conviction levels?\n5. What should I do — add a position, trim a position, or do nothing? Justify it with the data above.";
    }
    if(type==="watchlist_scan"){
      var watchCos=portCos.concat(cos.filter(function(c){return(c.status||"portfolio")!=="portfolio"}));
      var watchLines=cos.filter(function(c){return(c.status||"portfolio")!=="portfolio"}).map(function(c){
        var hasThesis=c.thesisNote&&c.thesisNote.trim().length>30;
        return"- "+c.ticker+" ("+c.name+") — conviction "+c.conviction+"/10, status: "+(c.status||"watchlist")+", thesis: "+(hasThesis?"written":"not written");
      }).join("\n")||"No watchlist companies.";
      return"You are a capital allocation advisor. My job is to decide which company on my watchlist deserves to become a full portfolio position next.\n\n--- MY CURRENT PORTFOLIO ---\n\n"+holdingLines+"\n\n--- MY WATCHLIST / RESEARCH PIPELINE ---\n\n"+watchLines+"\n\n--- YOUR TASK ---\n\n1. Based purely on thesis quality and conviction scores, which watchlist company appears most ready for capital? Why?\n2. Which watchlist company has the biggest gap between conviction and position status — i.e. I\'ve been watching too long?\n3. Is there anything in my current portfolio I should EXIT before adding a new position?\n4. What is the single question I need to answer to unlock the top candidate?\n5. What would a disciplined investor\'s action list look like this week based on this data?";
    }
    return "";
  }
