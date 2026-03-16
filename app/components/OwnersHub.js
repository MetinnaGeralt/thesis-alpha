"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { DARK, THEMES, METRIC_MAP, INVEST_STYLES, STYLE_MAP, INVESTOR_PROFILES, PROFILE_MAP, SUPERINVESTORS, MSTAR_RATINGS, FOLDERS } from "./constants";
import { calcMastery, calcOwnerScore, classifyPortfolio, dU, fD, fT, nId, gH, bT, eS, autoFormat, calcMoatFromData} from "./utils";

export default function OwnersHub({
  cos,
  page,
  setPage,
  setSelId,
  setDetailTab,
  setSubPage,
  setHubTab,
  setModal,
  hubTab,
  K,
  S,
  fm,
  fh,
  isMobile,
  _isBm,
  _isThesis,
  isThesis,
  IC,
  CoLogo,
  goals,
  saveGoals,
  weeklyReviews,
  readingList,
  saveRL,
  streakData,
  library,
  isPro,
  requirePro,
  showToast,
  openChest,
  getWeekId,
  getLevel,
  questData,
  setQuestData,
  trialActive,
  LEVELS,
  plan,
  setChestOverlay,
  setShowQLetter,
  calcMoatFromData,
}) {
  // ── Array prop guards ──
  cos = cos || [];
  readingList = readingList || [];
  weeklyReviews = weeklyReviews || [];
  streakData = streakData || {};
  goals = goals || {};
  streakData = streakData || {};
  goals = goals || {};
  cos = cos || [];
  weeklyReviews = weeklyReviews || [];
  readingList = readingList || [];

  var _al=React.useState("quality"),activeLens=_al[0],setActiveLens=_al[1];
  var currentWeekReviewed = weeklyReviews && weeklyReviews.length > 0 && weeklyReviews[0].weekId === getWeekId();
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
      var CSS='@page{size:A4;margin:24mm 26mm 24mm 26mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:"EB Garamond",Georgia,serif;color:#1a1a1a;font-size:13px;line-height:1.85;background:#fff}.page{max-width:600px;margin:0 auto}.rh{font-family:"JetBrains Mono",monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;padding-bottom:8px;border-bottom:1px solid #e8e5e0;margin-bottom:36px;display:flex;justify-content:space-between}.cover{padding:0 0 24px;border-bottom:2px solid #1a1a1a;margin-bottom:32px}.cover-tag{font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;letter-spacing:4px;color:#6B4CE6;text-transform:uppercase;margin-bottom:12px}.cover h1{font-family:"EB Garamond",Georgia,serif;font-size:34px;font-weight:500;letter-spacing:-0.3px;line-height:1.15;color:#1a1a1a}.content p{margin-bottom:20px;font-size:13px;line-height:1.9;color:#1a1a1a}.content p:first-child{font-size:14px}.footer{margin-top:44px;padding-top:14px;border-top:1.5px solid #1a1a1a;display:flex;justify-content:space-between;align-items:flex-end}@media print{.page{padding:0}}';
      var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+doc.ticker+' \u2014 '+doc.title+'</title>'
        +'<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">'
        +'<style>'+CSS+'</style></head><body><div class="page">';
      html+='<div class="rh"><span>'+doc.companyName+' \u2014 '+doc.ticker+'</span><span>'+(doc.updatedAt?new Date(doc.updatedAt).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}))+'</span></div>';
      html+='<div class="cover"><div class="cover-tag">'+doc.ticker+'</div><h1>'+doc.title+'</h1></div>';
      html+='<div class="content">';
      formatted.split("\n\n").forEach(function(p){if(p.trim())html+='<p>'+p.replace(/\n/g,"<br/>")+'</p>'});
      html+='</div>';
      html+='<div class="footer"><div><div style="font-family:JetBrains Mono,monospace;font-size:10px;font-weight:800;letter-spacing:3px;color:#1a1a1a">THESISALPHA</div><div style="font-family:EB Garamond,Georgia,serif;font-size:11px;color:#9ca3af;margin-top:5px;font-style:italic">Personal research note. Not financial advice.</div></div><div style="text-align:right"><div style="font-family:JetBrains Mono,monospace;font-size:10px;font-weight:700;color:#6B4CE6">'+doc.ticker+'</div></div></div>';
      html+='</div></body></html>';
      var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.print()},600)}

    // Score level names      var w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(function(){w.print()},600)}

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
              <div style={{width:isMobile?120:140,height:4,borderRadius:_isBm?0:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:pctToNext+"%",borderRadius:_isBm?0:2,background:os.total>=85?"#FFD700":os.total>=70?K.grn:os.total>=50?K.amb:K.blue,transition:"width .3s"}}/></div>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm,display:"flex",alignItems:"center",gap:4}}><IC name={currentLevel.icon} size={12} color={K.dim}/>{currentLevel.name}</span>
            </div></div></div>
        {/* Quick stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:isMobile?8:16,marginTop:isMobile?12:16}}>
          <div style={{textAlign:"center",padding:isMobile?"10px 8px":"8px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10}}>
            <div style={{fontSize:isMobile?22:20,fontWeight:700,color:K.txt,fontFamily:fm}}>{portfolio.length}</div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>holdings</div></div>
          <div style={{textAlign:"center",padding:isMobile?"10px 8px":"8px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10}}>
            <div style={{fontSize:isMobile?22:20,fontWeight:700,color:K.txt,fontFamily:fm}}>{scored.length}</div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>scored</div></div>
          <div style={{textAlign:"center",padding:isMobile?"10px 8px":"8px 16px",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10}}>
            <div style={{fontSize:isMobile?22:20,fontWeight:700,color:K.txt,fontFamily:fm}}>{allDecs.length}</div>
            <div style={{fontSize:10,color:K.dim,fontFamily:fm}}>decisions</div></div></div></div>

      {/* Tab bar — dropdown on mobile, full bar on desktop */}
      {(function(){
        var tabs=[{id:"command",l:"Command Center",icon:"trending"},{id:"lenses",l:"Investor Lenses",icon:"search"},{id:"docs",l:"Research Trail",icon:"file"},{id:"reading",l:"Reading List",icon:"book"},{id:"goals",l:"Performance & Goals",icon:"target"}];
        var active=tabs.find(function(t){return t.id===ht})||tabs[0];
        if(isMobile){return<div style={{marginBottom:20}}>
          <div style={{position:"relative"}}>
            <select value={ht} onChange={function(e){setHt(e.target.value)}} style={{width:"100%",background:K.card,border:"1px solid "+K.acc+"50",borderRadius:_isBm?0:12,color:K.txt,padding:"13px 44px 13px 18px",fontSize:15,fontFamily:fm,fontWeight:700,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
              {tabs.map(function(t){return<option key={t.id} value={t.id}>{t.l}</option>})}</select>
            <div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg></div></div>
        </div>}
        return<div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid "+K.bdr,overflowX:"auto",msOverflowStyle:"none",scrollbarWidth:"none"}}>
          {tabs.map(function(tab){return<button key={tab.id} onClick={function(){setHt(tab.id)}} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",fontSize:13,fontFamily:fm,fontWeight:ht===tab.id?700:500,color:ht===tab.id?K.acc:K.dim,background:"transparent",border:"none",borderBottom:ht===tab.id?"2px solid "+K.acc:"2px solid transparent",cursor:"pointer",marginBottom:-1,whiteSpace:"nowrap"}}>
            <IC name={tab.icon} size={12} color={ht===tab.id?K.acc:K.dim}/>{tab.l}{tab.dot>0&&<span style={{fontSize:9,fontWeight:700,color:"#fff",background:K.grn,borderRadius:_isBm?0:999,padding:"1px 5px",marginLeft:2,lineHeight:1.4}}>{tab.dot}</span>}</button>})}</div>
      })()}

      {/* ═══ COMMAND CENTER TAB ═══ */}
      {ht==="command"&&<div>
        {/* ── Zone 1: Right Now ── */}
        <div style={{marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:14,borderRadius:_isBm?0:2,background:K.acc}}/> Right Now</div></div>
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
            {id:"r_decision",text:"Log a BUY, SELL, or HOLD decision",icon:"edit",color:K.acc,done:false,check:function(){var recent=[];cos.forEach(function(c2){(c2.decisions||[]).forEach(function(d){if(d.date&&new Date(d.date)>new Date(Date.now()-604800000))recent.push(d)})});return recent.length>0},onClick:function(){if(portfolio[0]){setSelId(portfolio[0].id);setDetailTab("dossier");setPage("dashboard")}}},
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
                <div style={{width:80,height:6,borderRadius:_isBm?0:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:questPct+"%",borderRadius:_isBm?0:3,background:allDone2?K.grn:K.acc,transition:"width .5s"}}/></div>
                <span style={{fontSize:12,fontWeight:600,color:allDone2?K.grn:K.acc,fontFamily:fm}}>{questPct}%</span></div></div>
            {/* Focus list */}
            <div style={{display:"grid",gap:6}}>
              {(quests||[]).map(function(q){return<div key={q.id} className={q.done?"":"ta-card"} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:q.done?K.grn+"06":K.card,border:"1px solid "+(q.done?K.grn+"20":K.bdr),borderRadius:_isBm?0:10,cursor:q.done?"default":"pointer",opacity:q.done?.7:1}} onClick={q.done?undefined:q.onClick}>
                <div style={{width:24,height:24,borderRadius:"50%",border:"2px solid "+(q.done?K.grn:q.color),background:q.done?K.grn:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {q.done?<IC name="check" size={12} color="#fff" strokeWidth={3}/>:<IC name={q.icon} size={10} color={q.color}/>}</div>
                <div style={{flex:1,fontSize:13,color:q.done?K.dim:K.txt,textDecoration:q.done?"line-through":"none"}}>{q.text}</div>
                
                {q.done&&<span style={{fontSize:11,color:K.grn,fontFamily:fm}}>{"✓"}</span>}
              </div>})}</div>
            {/* Focus reward preview */}
            {!allDone2&&<div style={{marginTop:12,padding:"10px 16px",background:K.bg,borderRadius:_isBm?0:8,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:28,height:28,borderRadius:_isBm?0:8,background:"#a78bfa15",display:"flex",alignItems:"center",justifyContent:"center",animation:"glowPulse 2s ease-in-out infinite"}}><IC name="dice" size={14} color="#a78bfa"/></div>
              <div style={{fontSize:12,color:K.dim}}>Complete all actions to claim your weekly insight</div></div>}
            {/* Focus complete + claim */}
            {allDone2&&!questChestClaimed&&<div style={{marginTop:12,textAlign:"center",padding:"20px",background:"linear-gradient(135deg,"+K.acc+"08,#a78bfa08)",border:"1px solid #a78bfa30",borderRadius:_isBm?0:12}}>
              <div style={{fontSize:20,marginBottom:8}}>{String.fromCodePoint(0x1F3C6)}</div>
              <div style={{fontSize:14,fontWeight:600,color:K.txt,marginBottom:4}}>All quests complete!</div>
              <div style={{fontSize:12,color:K.dim,marginBottom:12}}>All actions complete! Claim your weekly insight</div>
              <button onClick={function(){setQuestData(function(p){var n=Object.assign({},p,{weekId:getWeekId(),chestClaimed:true});try{localStorage.setItem("ta-quests",JSON.stringify(n))}catch(e){}return n});setTimeout(function(){openChest()},300)}} style={Object.assign({},S.btnP,{padding:"10px 28px",fontSize:14,background:K.acc,borderColor:K.acc})}>Claim Weekly Insight</button></div>}
            {allDone2&&questChestClaimed&&<div style={{marginTop:12,textAlign:"center",padding:"14px",background:K.grn+"06",border:"1px solid "+K.grn+"20",borderRadius:_isBm?0:8}}>
              <div style={{fontSize:13,color:K.grn,fontWeight:500}}>All actions complete this week ✓</div>
              <div style={{fontSize:11,color:K.dim}}>New actions every Monday</div></div>}
          </div>})()}

        {/* Upcoming earnings */}
        {upcoming.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 20px",marginBottom:20}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:K.amb,marginBottom:10,fontFamily:fm}}>Earnings This Fortnight</div>
          {(upcoming||[]).map(function(c){var d3=dU(c.earningsDate);return<div key={c.id} className="ta-card" style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid "+K.bdr,cursor:"pointer"}} onClick={function(){setSelId(c.id);setDetailTab("dossier");setPage("dashboard")}}>
            <CoLogo domain={c.domain} ticker={c.ticker} size={22}/>
            <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</span>
            <span style={{fontSize:12,color:K.dim,flex:1}}>{c.name}</span>
            <span style={{fontSize:12,color:K.dim,fontFamily:fm}}>{c.kpis.length} KPIs</span>
            <span style={{fontSize:13,fontWeight:700,color:d3<=3?K.red:K.amb,fontFamily:fm,minWidth:40,textAlign:"right"}}>{d3===0?"Today":d3===1?"1d":d3+"d"}</span></div>})}</div>}


        {/* Staleness alerts */}
        {(function(){var stale=portfolio.filter(function(c2){if(!c2.thesisUpdatedAt)return c2.thesisNote&&c2.thesisNote.length>20;return Math.ceil((Date.now()-new Date(c2.thesisUpdatedAt))/864e5)>90});
          var unchecked=portfolio.filter(function(c2){return!c2.lastChecked&&c2.kpis.length>0});
          if(stale.length===0&&unchecked.length===0)return null;
          return<div style={{background:K.amb+"06",border:"1px solid "+K.amb+"20",borderRadius:_isBm?0:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:K.amb,fontFamily:fm,marginBottom:8}}>Needs Attention</div>
            {stale.length>0&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:stale.length>0&&unchecked.length>0?6:0}}>
              <IC name="clock" size={12} color={K.amb}/><div style={{fontSize:12,color:K.mid}}>Thesis refresh: <strong style={{color:K.txt}}>{(stale||[]).map(function(c2){return c2.ticker}).join(", ")}</strong></div></div>}
            {unchecked.length>0&&<div style={{display:"flex",alignItems:"center",gap:8}}>
              <IC name="target" size={12} color={K.amb}/><div style={{fontSize:12,color:K.mid}}>KPIs unchecked: <strong style={{color:K.txt}}>{(unchecked||[]).map(function(c2){return c2.ticker}).join(", ")}</strong></div></div>}
          </div>})()}

        {/* ── Zone 2: Your Portfolio ── */}
        <div style={{marginTop:20,marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:14,borderRadius:_isBm?0:2,background:"#8B5CF6"}}/> Your Portfolio</div></div>
        {/* Recent decisions (last 5) */}
        {allDecs.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"14px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm}}>Recent Decisions</div>
            <button onClick={function(){setHt("journal")}} style={{fontSize:11,color:K.acc,background:"none",border:"none",cursor:"pointer",fontFamily:fm}}>View all {"→"}</button></div>
          {allDecs.sort(function(a,b){return(b.date||"")<(a.date||"")?-1:1}).slice(0,5).map(function(dec,i){
            var clr=dec.action==="BUY"||dec.action==="ADD"?K.grn:dec.action==="SELL"||dec.action==="TRIM"?K.red:dec.action==="HOLD"?K.blue:K.amb;
            return<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<4?"1px solid "+K.bdr:"none"}}>
              <span style={{fontSize:10,fontWeight:700,color:clr,background:clr+"12",padding:"2px 8px",borderRadius:_isBm?0:3,fontFamily:fm,minWidth:36,textAlign:"center"}}>{dec.action}</span>
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
          var attr=(held||[]).map(function(c2){var p2=c2.position;var cost=p2.shares*p2.avgCost;var ret2=(p2.shares*p2.currentPrice-cost)/cost*100;var weight=cost/totalCost;
            var buyDec=(c2.decisions||[]).find(function(d2){return d2.action==="BUY"||d2.action==="ADD"});
            return{ticker:c2.ticker,ret:ret2,contrib:weight*ret2,weight:weight*100,reasoning:buyDec?buyDec.reasoning:"",id:c2.id}}).sort(function(a,b){return b.contrib-a.contrib});
          var bestD=attr[0];var worstD=attr[attr.length-1];
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:12}}>Performance Attribution</div>
            <div style={{display:"flex",gap:16,marginBottom:12}}>
              <div><div style={{fontSize:24,fontWeight:700,color:totalRet>=0?K.grn:K.red,fontFamily:fm}}>{totalRet>=0?"+":""}{totalRet.toFixed(1)}%</div><div style={{fontSize:11,color:K.dim}}>Portfolio return</div></div>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>{attr.slice(0,5).map(function(a2){return<div key={a2.ticker} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={function(){setSelId(a2.id);setDetailTab("dossier");setPage("dashboard")}}>
                <span style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm,width:40}}>{a2.ticker}</span>
                <div style={{flex:1,height:6,borderRadius:_isBm?0:3,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(Math.abs(a2.contrib)/Math.max(Math.abs(attr[0].contrib),1)*100,100)+"%",borderRadius:_isBm?0:3,background:a2.contrib>=0?K.grn:K.red}}/></div>
                <span style={{fontSize:11,fontWeight:600,color:a2.contrib>=0?K.grn:K.red,fontFamily:fm,minWidth:42,textAlign:"right"}}>{a2.contrib>=0?"+":""}{a2.contrib.toFixed(1)}%</span></div>})}</div></div>
            {bestD&&bestD.reasoning&&<div style={{fontSize:12,color:K.mid,lineHeight:1.5,padding:"8px 10px",background:K.bg,borderRadius:_isBm?0:6}}><span style={{fontWeight:600,color:K.grn}}>Best call:</span> {bestD.ticker} ({bestD.ret>=0?"+":""}{bestD.ret.toFixed(0)}%) {bestD.reasoning.substring(0,80)}</div>}
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
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:12}}>Your Growth</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{l:"Theses",v:tw+"/"+portfolio.length,c:tw===portfolio.length?K.grn:K.txt},{l:"Avg depth",v:avgSec.toFixed(1)+"/4",c:avgSec>=3?K.grn:K.txt},{l:"KPIs tracked",v:totalK+(" (")+kpC+" checked)",c:kpC>0?K.grn:K.txt},{l:"Earnings reviewed",v:tE+"q",c:tE>=portfolio.length*2?K.grn:K.txt},{l:"Conviction updates",v:tCu+"",c:tCu>=portfolio.length*2?K.grn:K.txt},{l:"Mastery avg",v:avgM.toFixed(1)+"/6",c:avgM>=4?K.grn:K.txt}].map(function(g2){return<div key={g2.l} style={{padding:"6px 8px",background:K.bg,borderRadius:_isBm?0:6}}>
                <div style={{fontSize:14,fontWeight:700,color:g2.c,fontFamily:fm}}>{g2.v}</div><div style={{fontSize:8,color:K.dim}}>{g2.l}</div></div>})}</div></div>})()}
        {/* === INVESTOR DNA v2 === */}
        {portfolio.length>=2&&(function(){
          var userTickers=(portfolio||[]).map(function(c2){return c2.ticker.toUpperCase()});
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
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:14}}>Investor DNA</div>
            {/* Top match */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14,padding:"12px 14px",background:K.acc+"06",borderRadius:_isBm?0:10,border:"1px solid "+K.acc+"15"}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:K.acc+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={K.acc} strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:K.txt}}>{best.investor.name}</div>
                <div style={{fontSize:12,color:K.acc,fontWeight:600}}>{best.investor.style}</div>
                <div style={{fontSize:11,color:K.dim,marginTop:2}}>{best.investor.desc}</div></div>
              <div style={{textAlign:"center",padding:"6px 12px",background:K.card,borderRadius:_isBm?0:8,border:"1px solid "+K.bdr}}>
                <div style={{fontSize:20,fontWeight:800,color:best.composite>=50?K.grn:best.composite>=25?K.acc:K.dim,fontFamily:fm}}>{Math.round(best.composite)}%</div>
                <div style={{fontSize:8,color:K.dim}}>match</div></div></div>
            {/* Shared holdings */}
            {best.shared.length>0&&<div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:6}}>Shared holdings with {best.investor.name} ({best.shared.length})</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {best.shared.map(function(t2){return<span key={t2} style={{padding:"3px 8px",borderRadius:_isBm?0:4,background:K.grn+"10",border:"1px solid "+K.grn+"25",fontSize:11,fontWeight:600,color:K.grn,fontFamily:fm}}>{t2}</span>})}</div></div>}
            {/* Why this match */}
            <div style={{fontSize:12,color:K.mid,lineHeight:1.6,padding:"8px 10px",background:K.bg,borderRadius:_isBm?0:6,marginBottom:14}}>
              {"Based on "}<strong style={{color:K.txt}}>{best.shared.length}</strong>{" shared holdings ("+best.overlapPct.toFixed(0)+"% of your portfolio) and "}
              <strong style={{color:K.txt}}>{best.traitSim.toFixed(0)}%</strong>{" style similarity. "}
              {best.investor.fund!==""&&<span>{"Fund: "+best.investor.fund+". "}</span>}
              {"Source: public 13F SEC filings."}</div>
            {/* Other matches */}
            {top3.length>1&&<div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginBottom:6}}>Other close matches</div>
              <div style={{display:"flex",gap:8}}>
                {top3.slice(1).map(function(m2){return<div key={m2.investor.id} style={{flex:1,padding:"8px 10px",borderRadius:_isBm?0:6,background:K.bg,border:"1px solid "+K.bdr}}>
                  <div style={{fontSize:12,fontWeight:600,color:K.txt}}>{m2.investor.name}</div>
                  <div style={{fontSize:10,color:K.dim}}>{m2.investor.style}</div>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                    <div style={{flex:1,height:4,borderRadius:_isBm?0:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(m2.composite,100)+"%",borderRadius:_isBm?0:2,background:K.acc}}/></div>
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
        <div style={{marginTop:20,marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:K.txt,fontFamily:fm,display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:14,borderRadius:_isBm?0:2,background:K.grn}}/> Reflection</div></div>
        {/* === QUARTERLY LETTER === */}
        {weeklyReviews.length>=1&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginTop:16}}>
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
          if(held2.length>=3){var vals2=(held2||[]).map(function(c2){return c2.position.shares*c2.position.currentPrice});var tv2=vals2.reduce(function(a,b){return a+b},0);var mv2=Math.max.apply(null,vals2);
            if(mv2/tv2>0.4)pats.push({icon:"search",color:K.blue,t:"Largest position is "+Math.round(mv2/tv2*100)+"% of portfolio. High concentration demands high conviction."})}
          if(weeklyReviews.length>=6){var gaps=[];for(var i2=1;i2<weeklyReviews.length;i2++){gaps.push(Math.round((new Date(weeklyReviews[i2].date)-new Date(weeklyReviews[i2-1].date))/604800000))}
            var ag=gaps.reduce(function(a,b){return a+b},0)/gaps.length;
            if(ag<=1.3)pats.push({icon:"check",color:K.grn,t:"Review cadence: every "+ag.toFixed(1)+" weeks. Exceptional consistency."})}
          if(pats.length===0)return null;
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px",marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:_isThesis?K.acc:K.dim,fontFamily:fm,marginBottom:10}}>Behavioral Patterns</div>
            {(pats||[]).map(function(p2,i2){return<div key={i2} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 8px",background:K.bg,borderRadius:_isBm?0:6,marginBottom:4}}>
              <IC name={p2.icon} size={14} color={p2.color} style={{marginTop:2,flexShrink:0}}/><div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{p2.t}</div></div>})}</div>})()}

        {/* ═══ STRESS TEST ═══ */}
        {portfolio.length>0&&<div style={{marginTop:24}}>
          <div style={S.sec}><IC name="shield" size={14} color={K.acc}/>Stress Test</div>
          {(function(){var planned=portfolio.filter(function(c2){return(c2.scenarios||[]).length>0});var unplanned=portfolio.filter(function(c2){return(c2.scenarios||[]).length===0});var totalScen=portfolio.reduce(function(s,c2){return s+(c2.scenarios||[]).length},0);
            return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 20px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{fontSize:28,fontWeight:800,color:planned.length===portfolio.length?K.grn:planned.length>0?K.amb:K.dim,fontFamily:fm}}>{planned.length}<span style={{fontSize:14,fontWeight:400,color:K.dim}}>/{portfolio.length}</span></div>
                <div><div style={{fontSize:13,fontWeight:600,color:K.txt}}>Holdings stress-tested</div>
                  <div style={{fontSize:11,color:K.dim}}>{totalScen} scenario{totalScen!==1?"s":""} planned</div></div></div>
              {unplanned.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{unplanned.slice(0,5).map(function(c2){return<button key={c2.id} onClick={function(){setSelId(c2.id);setDetailTab("dossier");setPage("dashboard");setTimeout(function(){setModal({type:"scenario"})},200)}} style={{padding:"5px 12px",fontSize:11,fontFamily:fm,borderRadius:_isBm?0:6,border:"1px solid "+K.bdr,background:K.bg,color:K.mid,cursor:"pointer"}}>{c2.ticker}</button>})}</div>}
              {planned.length===portfolio.length&&<div style={{fontSize:12,color:K.grn,fontFamily:fm}}>Every holding has a crisis plan.</div>}
            </div>})()}</div>}
        {/* ═══ PERSONAL RECORD ═══ */}
        <div style={{marginTop:24}}>
          <div style={S.sec}><IC name="bar" size={14} color={K.dim}/>Your Record</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
            {[{label:"Holdings",value:portfolio.length,icon:"overview",color:K.acc},{label:"Decisions Logged",value:allDecs.length,icon:"edit",color:K.blue},{label:"Reviews Done",value:weeklyReviews.length,icon:"shield",color:K.grn},{label:"Decision Accuracy",value:scored.length>0?dqPct+"%":"—",icon:"target",color:dqPct>=60?K.grn:K.amb}].map(function(s){return<div key={s.label} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 18px"}}>
              <IC name={s.icon} size={16} color={s.color}/>
              <div style={{fontSize:26,fontWeight:800,color:s.color,fontFamily:fm,marginTop:8,lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm,marginTop:4}}>{s.label}</div>
            </div>})}
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
            {id:"smith",name:"Terry Smith",subtitle:"Fundsmith Filter",unlock:0,quote:"Only invest in good companies, don’t overpay, do nothing.",bio:"Terry Smith founded Fundsmith in 2010 and built it into one of Europe's largest equity funds. A proponent of buy-and-hold quality investing, he is known for his blunt annual letters and rejection of trading.",wiki:"b/b0/Terry_Smith.jpg/220px-Terry_Smith.jpg",
              metrics:[
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:25,desc:"Pricing power — can the business charge a premium?"},
                {id:"roic",label:"ROCE / ROIC",sp500:15,unit:"%",weight:25,desc:"Returns on capital — is the business capital-efficient?"},
                {id:"opLeverage",label:"Operating Margin",sp500:13,unit:"%",weight:20,desc:"Operational efficiency — does scale create profit?"},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:20,desc:"Earnings quality — does profit turn into real cash?"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:10,desc:"Financial strength — lower is better",invert:true}
              ]},
            {id:"kantesaria",name:"Dev Kantesaria",subtitle:"Compounder Checklist",unlock:0,quote:"We look for businesses that can compound at 15%+ with minimal risk of permanent loss.",bio:"Dev Kantesaria runs Valley Forge Capital, a concentrated fund of 6–8 positions. He looks for recession-resistant monopolies with pricing power, minimal debt, and 15%+ compounding potential.",wiki:null,
              metrics:[
                {id:"revGrowth",label:"Revenue Growth",sp500:5,unit:"%",weight:20,desc:"Organic demand growth — is the TAM expanding?"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:20,desc:"Above 60% signals a capital-light moat"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:15,desc:"Bottom-line profitability after all costs"},
                {id:"fcfConversion",label:"FCF Conversion",sp500:85,unit:"%",weight:20,desc:"Free cash flow quality — the real yield"},
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:15,desc:"Capital efficiency — the engine of compounding"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:10,desc:"Low debt = low risk of permanent impairment",invert:true}
              ]},
            {id:"munger",name:"Charlie Munger",subtitle:"Quality at Scale",unlock:0,quote:"A great business at a fair price is superior to a fair business at a great price.",bio:"Charlie Munger was Warren Buffett's partner at Berkshire Hathaway for over 50 years. He championed the idea of buying wonderful businesses at fair prices and introduced mental models from multiple disciplines.",wiki:"7/7d/Charlie_Munger.jpg/220px-Charlie_Munger.jpg",
              metrics:[
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:25,desc:"The single best measure of a moat"},
                {id:"grossMargin",label:"Pricing Power (Gross Margin)",sp500:45,unit:"%",weight:20,desc:"Can they raise prices without losing customers?"},
                {id:"opLeverage",label:"Operating Margin",sp500:13,unit:"%",weight:15,desc:"Do margins expand as revenue grows?"},
                {id:"revGrowth",label:"Revenue Growth",sp500:5,unit:"%",weight:15,desc:"Sustainable growth within circle of competence"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:15,desc:"Trending up = strengthening position"},
                {id:"rdIntensity",label:"R&D / Revenue",sp500:3,unit:"%",weight:10,desc:"Reinvesting to widen the moat"}
              ]},
            {id:"buffett",name:"Warren Buffett",subtitle:"Owner Earnings",unlock:0,quote:"It’s far better to buy a wonderful company at a fair price than a fair company at a wonderful price.",bio:"Warren Buffett has run Berkshire Hathaway since 1965. Influenced by Ben Graham's margin of safety and Phil Fisher's qualitative analysis, he focuses on durable competitive advantages and owner earnings.",wiki:"7/7d/Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit.jpg/220px-Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit.jpg",
              metrics:[
                {id:"netMargin",label:"Net Margin (Owner Earnings)",sp500:12,unit:"%",weight:20,desc:"What the owner actually takes home"},
                {id:"roic",label:"Return on Equity",sp500:15,unit:"%",weight:20,desc:"How much profit per dollar of equity?"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:20,desc:"Conservative balance sheet = margin of safety",invert:true},
                {id:"grossMargin",label:"Gross Margin Stability",sp500:45,unit:"%",weight:20,desc:"Stable margins = durable competitive advantage"},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:20,desc:"Consistent cash generation year after year"}
              ]},
            {id:"greenblatt",name:"Joel Greenblatt",subtitle:"Magic Formula",unlock:0,quote:"Buying good businesses at bargain prices is the secret to making lots of money.",bio:"Joel Greenblatt teaches investing at Columbia and founded Gotham Capital. His Magic Formula ranks stocks by return on capital and earnings yield — a systematic approach to buying good businesses cheaply.",wiki:null,
              metrics:[
                {id:"roic",label:"Return on Capital",sp500:15,unit:"%",weight:35,desc:"The first pillar of the Magic Formula — high ROIC = good business"},
                {id:"netMargin",label:"Earnings Yield",sp500:12,unit:"%",weight:35,desc:"The second pillar — high earnings yield = bargain price"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:10,desc:"Pricing power supporting high returns"},
                {id:"fortress",label:"Debt Level",sp500:1.5,unit:"x",weight:10,desc:"Low leverage = less risk",invert:true},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:10,desc:"Real cash backing up the earnings"}
              ]},
            {id:"lynch",name:"Peter Lynch",subtitle:"Growth at a Price",unlock:0,quote:"Know what you own, and know why you own it.",bio:"Peter Lynch managed Fidelity's Magellan Fund from 1977–1990, achieving a 29% annual return. He favoured investing in businesses you understand and coined the phrase: invest in what you know.",wiki:"0/0e/Peter_Lynch.jpg/220px-Peter_Lynch.jpg",
              metrics:[
                {id:"revGrowth",label:"Revenue / Earnings Growth",sp500:5,unit:"%",weight:30,desc:"The engine — is the company growing fast enough?"},
                {id:"fortress",label:"Debt Level",sp500:1.5,unit:"x",weight:20,desc:"Low debt = can survive a downturn",invert:true},
                {id:"fcfConversion",label:"Cash Conversion",sp500:85,unit:"%",weight:20,desc:"Strong cash flow funds future growth"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:15,desc:"Are margins expanding as the company scales?"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:15,desc:"Is growth translating to bottom line?"}
              ]},
            {id:"davis",name:"Shelby Cullom Davis",subtitle:"Davis Double Play",unlock:0,quote:"You make most of your money in a bear market, you just don’t realize it at the time.",bio:"Shelby Cullom Davis built a $50M fortune to $900M over 47 years by focusing on financial companies. The Davis Double Play: buy growing earnings at a low multiple, then benefit from both EPS growth and multiple expansion.",wiki:null,
              metrics:[
                {id:"revGrowth",label:"Earnings Growth",sp500:5,unit:"%",weight:25,desc:"Growing earnings = rising stock price (first play)"},
                {id:"netMargin",label:"Net Margin Expansion",sp500:12,unit:"%",weight:20,desc:"Expanding margins = multiple expansion (second play)"},
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:20,desc:"Capital efficiency sustains compounding"},
                {id:"fortress",label:"Balance Sheet Strength",sp500:1.5,unit:"x",weight:15,desc:"Survive the bear market to reap the double play",invert:true},
                {id:"fcfConversion",label:"Cash Generation",sp500:85,unit:"%",weight:10,desc:"Real cash flow backing earnings growth"},
                {id:"grossMargin",label:"Pricing Power",sp500:45,unit:"%",weight:10,desc:"Durable margins through cycles"}
              ]},
            {id:"hohn",name:"Chris Hohn",subtitle:"Activist Value",unlock:0,quote:"We invest in quality businesses with strong free cash flow and push for better capital allocation.",bio:"Chris Hohn founded TCI Fund Management and is one of the world's highest-earning hedge fund managers. He combines activist pressure with long-term holding of high-quality, cash-generative businesses.",wiki:null,
              metrics:[
                {id:"fcfConversion",label:"FCF Conversion",sp500:85,unit:"%",weight:30,desc:"Free cash flow relative to earnings — the real return"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:20,desc:"Is management improving profitability?"},
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:15,desc:"Capital efficiency — allocating capital wisely?"},
                {id:"opLeverage",label:"Operating Margin",sp500:13,unit:"%",weight:20,desc:"Operational efficiency gains over time"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:15,desc:"Capital discipline",invert:true}
              ]},
            {id:"akre",name:"Chuck Akre",subtitle:"Compounding Machine",unlock:0,quote:"The most important thing is the rate of return on reinvested capital.",
              bio:"Chuck Akre ran Akre Capital for decades, seeking 'three-legged stools': exceptional business models, skilled managers, and reinvestment opportunities. Known for owning American Tower for 20+ years.",wiki:null,
              metrics:[
                {id:"roic",label:"Return on Invested Capital",sp500:15,unit:"%",weight:35,desc:"The engine of compounding — must be sustainably high"},
                {id:"fcfConversion",label:"FCF Conversion",sp500:85,unit:"%",weight:25,desc:"Real cash that can be reinvested at high rates"},
                {id:"revGrowth",label:"Revenue Growth",sp500:5,unit:"%",weight:20,desc:"Growth extends the compounding runway"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:10,desc:"Pricing power funds reinvestment"},
                {id:"fortress",label:"Net Debt / EBITDA",sp500:1.5,unit:"x",weight:10,desc:"Moderate leverage is acceptable if returns are high",invert:true}
              ]},
            {id:"pabrai",name:"Mohnish Pabrai",subtitle:"Heads I Win, Tails I Don't Lose",unlock:0,quote:"Invest in businesses where you have a significant probability of a big win and a small probability of permanent loss.",
              bio:"Mohnish Pabrai runs the Pabrai Investment Funds, closely modelling his approach on Buffett. He focuses on low-risk, high-uncertainty situations — cloning great investors and waiting for fat pitches.",wiki:null,
              metrics:[
                {id:"fortress",label:"Balance Sheet Safety",sp500:1.5,unit:"x",weight:30,desc:"Strong balance sheet limits downside risk",invert:true},
                {id:"roic",label:"ROIC",sp500:15,unit:"%",weight:25,desc:"High returns on capital = durable moat"},
                {id:"fcfConversion",label:"FCF Conversion",sp500:85,unit:"%",weight:20,desc:"Cash is the scoreboard — everything else is accounting"},
                {id:"grossMargin",label:"Gross Margin",sp500:45,unit:"%",weight:15,desc:"Pricing power is the moat"},
                {id:"netMargin",label:"Net Margin",sp500:12,unit:"%",weight:10,desc:"Profitability after all obligations"}
              ]}
          ];
          var lens=LENSES.find(function(l){return l.id===activeLens&&(l.unlock===0||trialActive||isPro||(streakData.current||0)>=l.unlock)})||LENSES[0];
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
              {(LENSES||[]).map(function(l){var active=l.id===activeLens;var locked=!trialActive&&!isPro&&l.unlock>0&&(streakData.current||0)<l.unlock;var weeksLeft=locked?l.unlock-(streakData.current||0):0;
                return<button key={l.id} onClick={function(){if(!locked)setActiveLens(l.id)}} style={{padding:"7px 14px",borderRadius:_isBm?0:8,border:"1px solid "+(active?K.acc+"60":locked?K.bdr:K.bdr),background:active?K.acc+"10":locked?K.bg:"transparent",color:active?K.acc:locked?K.dim:K.mid,fontSize:12,fontWeight:active?600:400,cursor:locked?"default":"pointer",fontFamily:fm,opacity:locked?.6:1,position:"relative"}}>
                  {locked&&<span style={{position:"absolute",top:-4,right:-4,fontSize:11}}>{String.fromCodePoint(0x1F512)}</span>}
                  {l.name}
                  {locked&&<span style={{display:"block",fontSize:8,color:K.dim,marginTop:1}}>Week {l.unlock} streak</span>}
                </button>})}</div>
            {/* Lens header */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px 24px",marginBottom:20}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:16,marginBottom:12}}>
                {lens.wiki&&<img src={"https://upload.wikimedia.org/wikipedia/commons/thumb/"+lens.wiki} alt={lens.name} style={{width:52,height:52,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"1px solid "+K.bdr,background:K.bg}} onError={function(e){e.target.style.display="none"}}/>}
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                    <div style={{fontSize:18,fontWeight:600,color:K.txt,fontFamily:fh}}>{lens.name} <span style={{fontWeight:300,color:K.dim,fontSize:14}}>{lens.subtitle}</span></div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:24,fontWeight:700,color:beatPct>=70?K.grn:beatPct>=40?K.amb:K.red,fontFamily:fm}}>{beatPct}%</div>
                      <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>metrics above S&amp;P 500</div></div></div>
                  {lens.bio&&<div style={{fontSize:12,color:K.dim,lineHeight:1.6,marginTop:5}}>{lens.bio}</div>}
                </div></div>
              <div style={{fontSize:13,color:K.mid,fontStyle:"italic",lineHeight:1.6,borderTop:"1px solid "+K.bdr+"40",paddingTop:12}}>"{lens.quote}"</div>
            </div>
            {/* Metrics table with actual values */}
            {lensLoading&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:40,textAlign:"center"}}>
              <div style={{display:"inline-block",width:20,height:20,border:"2px solid "+K.bdr,borderTopColor:K.acc,borderRadius:"50%",animation:"spin .8s linear infinite",marginBottom:12}}/>
              <div style={{fontSize:14,color:K.dim}}>Fetching financial data for your holdings…</div></div>}
            {!lensLoading&&portCos.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:_isBm?0:12,padding:40,textAlign:"center"}}>
              <div style={{fontSize:14,color:K.dim,marginBottom:8}}>No financial data yet</div>
              <div style={{fontSize:13,color:K.dim}}>Add portfolio companies with position data. Financial metrics are fetched automatically from FMP.</div></div>}
            {!lensLoading&&portCos.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{borderBottom:"2px solid "+K.bdr}}>
                  <th style={{textAlign:"left",padding:"12px 14px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>Metric</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600,width:50}}>Weight</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>Your Portfolio</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>S&P 500</th>
                  <th style={{textAlign:"center",padding:"12px 8px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>vs Benchmark</th>
                  <th style={{textAlign:"left",padding:"12px 14px",fontSize:11,color:K.dim,fontFamily:fm,fontWeight:600}}>By Holding</th>
                </tr></thead>
                <tbody>{(portMetrics||[]).map(function(m){
                  return<tr key={m.id} style={{borderBottom:"1px solid "+K.bdr+"60"}}>
                    <td style={{padding:"12px 14px"}}><div style={{fontWeight:500,color:K.txt}}>{m.label}</div><div style={{fontSize:11,color:K.dim,marginTop:2}}>{m.desc}</div></td>
                    <td style={{textAlign:"center",padding:"12px 8px",fontSize:12,color:K.dim,fontFamily:fm}}>{m.weight}%</td>
                    <td style={{textAlign:"center",padding:"12px 8px"}}>
                      <div style={{fontSize:18,fontWeight:700,color:m.portfolioVal!=null?clr(m.delta):K.dim,fontFamily:fm}}>{fmtVal(m.portfolioVal,m.unit,m.invert)}</div></td>
                    <td style={{textAlign:"center",padding:"12px 8px"}}>
                      <div style={{fontSize:14,color:K.dim,fontFamily:fm}}>{fmtVal(m.sp500,m.unit)}</div></td>
                    <td style={{textAlign:"center",padding:"12px 8px"}}>
                      {m.delta!=null?<span style={{fontSize:13,fontWeight:600,color:clr(m.delta),fontFamily:fm,background:clr(m.delta)+"10",padding:"3px 10px",borderRadius:_isBm?0:4}}>{m.delta>=0?"+":""}{m.delta.toFixed(1)}{m.unit==="x"?"x":m.unit}</span>:<span style={{color:K.dim}}>—</span>}</td>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{m.holdings.slice(0,8).map(function(h){
                        var hDelta=m.invert?m.sp500-h.value:h.value-m.sp500;
                        return<span key={h.ticker} style={{fontSize:10,fontFamily:fm,padding:"2px 6px",borderRadius:_isBm?0:3,background:hDelta>0?K.grn+"12":hDelta>-2?K.amb+"12":K.red+"12",color:hDelta>0?K.grn:hDelta>-2?K.amb:K.red}} title={h.raw}>{h.ticker} {h.raw||fmtVal(h.value,m.unit)}</span>})}</div></td>
                  </tr>})}</tbody>
              </table>
              <div style={{padding:"12px 14px",borderTop:"1px solid "+K.bdr,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:11,color:K.dim}}>Weighted by position value. {portCos.length} of {cos.filter(function(c){return(c.status||"portfolio")==="portfolio"}).length} holdings have data. Financial metrics via FMP.</div>
                <div style={{display:"flex",gap:8,fontSize:10,color:K.dim}}><span style={{color:K.grn}}>● Above S&P</span><span style={{color:K.amb}}>● Near S&P</span><span style={{color:K.red}}>● Below S&P</span></div></div>
            </div>}
          </div>})()}
      </div>}

      {/* ═══ DOCUMENT VAULT TAB ═══ */}
      {ht==="docs"&&<div>
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        {/* Decisions journal embedded */}
        {(function(){var _jf=["all","buy","sell","hold","add","trim"];
          return<div style={{marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",display:"flex",alignItems:"center",gap:6}}><IC name="edit" size={12} color={K.dim}/>Decision Log</div>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>{allDecs.length} decision{allDecs.length!==1?"s":""}{scored.length>0?" · "+dqPct+"% accuracy":""}</div>
            </div>
            {allDecs.length===0?<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:_isBm?0:10,padding:"20px 24px",textAlign:"center",color:K.dim,fontSize:13}}>No decisions logged yet. Log BUY / SELL / HOLD decisions from company pages.</div>:
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {allDecs.slice().sort(function(a,b){return(b.date||"")>(a.date||"")?1:-1}).slice(0,20).map(function(dec,i){
                var clr=dec.action==="BUY"||dec.action==="ADD"?K.grn:dec.action==="SELL"||dec.action==="TRIM"?K.red:dec.action==="HOLD"?K.blue:K.amb;
                return<div key={i} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:9,padding:"11px 14px",borderLeft:"3px solid "+clr}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,fontWeight:700,color:clr,background:clr+"12",padding:"2px 8px",borderRadius:_isBm?0:4,fontFamily:fm}}>{dec.action}</span>
                    <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{dec.ticker}</span>
                    {dec.price&&<span style={{fontSize:11,color:K.dim,fontFamily:fm}}>@ ${dec.price}</span>}
                    <span style={{flex:1}}/>
                    {dec.outcome&&<span style={{fontSize:10,fontWeight:600,color:dec.outcome==="right"?K.grn:dec.outcome==="wrong"?K.red:K.amb,fontFamily:fm,background:(dec.outcome==="right"?K.grn:dec.outcome==="wrong"?K.red:K.amb)+"12",padding:"1px 6px",borderRadius:_isBm?0:3}}>{dec.outcome}</span>}
                    <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>{dec.date?fD(dec.date):""}</span>
                  </div>
                  {dec.reasoning&&<div style={{fontSize:12,color:K.mid,lineHeight:1.5,marginTop:5}}>{dec.reasoning.substring(0,160)}{dec.reasoning.length>160?"…":""}</div>}
                  {dec.invalidation&&<div style={{fontSize:11,color:K.amb,marginTop:4,fontStyle:"italic"}}>If wrong: {dec.invalidation}</div>}
                </div>})}
              {allDecs.length>20&&<div style={{fontSize:12,color:K.dim,textAlign:"center",padding:"8px 0"}}>Showing 20 of {allDecs.length} decisions. Full history in Investment Story →</div>}
            </div>}
          </div>
        })()}
        {/* Research documents */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:600,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",display:"flex",alignItems:"center",gap:6}}><IC name="file" size={12} color={K.dim}/>Research Notes</div>
        </div>
          <button onClick={function(){var co=portfolio[0];if(co){setSelId(co.id);setModal({type:"memo"})}else{showToast("Add a company first","info",3000)}}} style={Object.assign({},S.btnP,{padding:"6px 14px",fontSize:12})}>+ Investment Memo</button>
          <button onClick={function(){var co=portfolio[0];if(co){setSelId(co.id);setModal({type:"doc"})}else{showToast("Add a company first","info",3000)}}} style={Object.assign({},S.btn,{padding:"6px 14px",fontSize:12})}>+ Quick Note</button>
          <select value={hc} onChange={function(e){setHc(e.target.value);setHd(null)}} style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:K.txt,padding:"7px 12px",fontSize:12,fontFamily:fm,outline:"none"}}>
            <option value="all">All Companies</option>
            {(companies||[]).map(function(c){return<option key={c.id} value={c.id}>{c.ticker}</option>})}</select>
          <button onClick={function(){setHf("all");setHd(null)}} style={{background:hf==="all"?K.acc+"20":"transparent",border:"1px solid "+(hf==="all"?K.acc+"50":K.bdr),borderRadius:_isBm?0:6,padding:"6px 14px",fontSize:12,color:hf==="all"?K.acc:K.dim,cursor:"pointer",fontFamily:fm}}>All</button>
          {FOLDERS.map(function(fo){var ct=allDocs.filter(function(d2){return d2.folder===fo.id&&(hc==="all"||d2.companyId===parseInt(hc))}).length;
            return<button key={fo.id} onClick={function(){setHf(fo.id);setHd(null)}} style={{background:hf===fo.id?K.acc+"20":"transparent",border:"1px solid "+(hf===fo.id?K.acc+"50":K.bdr),borderRadius:_isBm?0:6,padding:"6px 14px",fontSize:12,color:hf===fo.id?K.acc:K.dim,cursor:"pointer",fontFamily:fm,display:"inline-flex",alignItems:"center",gap:5}}><IC name={fo.icon} size={12} color={hf===fo.id?K.acc:K.dim}/>{fo.label}{ct>0?" ("+ct+")":""}</button>})}</div>
        <div className="ta-grid-docs" style={{display:"grid",gridTemplateColumns:selectedDoc?"340px 1fr":"1fr",gap:20}}>
          <div>
            {filteredDocs.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:_isBm?0:12,padding:32,textAlign:"center"}}><div style={{fontSize:14,color:K.dim,marginBottom:8}}>No documents yet</div><div style={{fontSize:13,color:K.dim}}>Add notes in company pages and they'll appear here.</div></div>}
            {(filteredDocs||[]).map(function(d3){var fo=FOLDERS.find(function(f){return f.id===d3.folder});var isActive=hd===d3.id;
              return<div key={d3.id} style={{background:isActive?K.acc+"08":K.card,border:"1px solid "+(isActive?K.acc+"30":K.bdr),borderRadius:_isBm?0:12,padding:"14px 18px",marginBottom:8,cursor:"pointer",transition:"all .15s"}} onClick={function(){setHd(isActive?null:d3.id)}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <CoLogo domain={d3.domain} ticker={d3.ticker} size={18}/>
                  <span style={{fontSize:11,fontWeight:600,color:K.mid,fontFamily:fm}}>{d3.ticker}</span>
                  <IC name={fo?fo.icon:"file"} size={12} color={K.dim}/>
                  <span style={{flex:1}}/>
                  <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>{d3.updatedAt?new Date(d3.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</span></div>
                <div style={{fontSize:14,fontWeight:500,color:K.txt}}>{d3.title}</div>
                {!selectedDoc&&d3.content&&<div style={{fontSize:13,color:K.dim,lineHeight:1.5,marginTop:4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{d3.content.substring(0,200)}</div>}
              </div>})}</div>
          {selectedDoc&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"24px 28px",position:"sticky",top:80,maxHeight:"calc(100vh - 120px)",overflowY:"auto"}}>
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
        var holdingReturns=(portf||[]).map(function(c){
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
        holdingReturns=(holdingReturns||[]).map(function(h){return Object.assign({},h,{weight:h.weight/totalW*100})});
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
        var bellPath="M "+(bellPts||[]).map(function(p){return p[0].toFixed(1)+","+p[1].toFixed(1)}).join(" L ");
        var tgtX=Math.max(0,Math.min(1,(goals.targetCAGR-lowCAGR)/(highCAGR-lowCAGR)))*svgW;
        var expX=Math.max(0,Math.min(1,(portCAGR-lowCAGR)/(highCAGR-lowCAGR)))*svgW;
        var onTarget=portCAGR>=goals.targetCAGR;
        return<div>
          {/* Settings row */}
          <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>Target CAGR</span>
              <input type="number" min={1} max={50} type="text" inputMode="numeric" defaultValue={goals.targetCAGR} key={"cagr-"+goals.targetCAGR} onBlur={function(e){var v=parseFloat(e.target.value);if(!isNaN(v)&&v>0&&v<=99)saveGoals(Object.assign({},goals,{targetCAGR:v}));else e.target.value=goals.targetCAGR}} style={{width:52,background:"transparent",border:"none",color:K.txt,fontSize:18,fontWeight:700,fontFamily:fm,outline:"none",textAlign:"center"}}/>
              <span style={{fontSize:13,color:K.mid,fontFamily:fm}}>%</span>
            </div>
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:K.dim,fontFamily:fm}}>Horizon</span>
              {[5,10,15,20].map(function(yr){return<button key={yr} onClick={function(){saveGoals(Object.assign({},goals,{horizon:yr}))}} style={{padding:"4px 10px",borderRadius:_isBm?0:6,border:"1px solid "+(goals.horizon===yr?K.acc:"transparent"),background:goals.horizon===yr?K.acc+"20":"transparent",color:goals.horizon===yr?K.acc:K.dim,fontSize:12,fontWeight:goals.horizon===yr?700:400,cursor:"pointer",fontFamily:fm}}>{yr}y</button>})}
            </div>
          </div>

          {portf.length===0?<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:_isBm?0:12,padding:40,textAlign:"center",color:K.dim,fontSize:14}}>Add holdings to see your CAGR projection</div>:
          <div>
            {/* Main projection card */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"24px 28px",marginBottom:16}}>
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
              {!onTarget&&<div style={{background:K.amb+"10",border:"1px solid "+K.amb+"30",borderRadius:_isBm?0:8,padding:"10px 14px",fontSize:12,color:K.amb}}>
                Your expected {portCAGR.toFixed(1)}% is below your {goals.targetCAGR}% target. Consider whether your target is realistic, or if higher-conviction positions could shift the outlook.
              </div>}
              {onTarget&&<div style={{background:K.grn+"10",border:"1px solid "+K.grn+"30",borderRadius:_isBm?0:8,padding:"10px 14px",fontSize:12,color:K.grn}}>
                Your portfolio is on track. Expected {portCAGR.toFixed(1)}% vs {goals.targetCAGR}% target — {prob}% probability of hitting it.
              </div>}
            </div>

            {/* Per-holding breakdown */}
            <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"18px 22px"}}>
              <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:14}}>Expected Return by Holding</div>
              <div style={{fontSize:10,color:K.dim,fontFamily:fm,marginBottom:10}}>TSR = (1 + EPS Growth + Buyback) × (1 + Multiple Change) + Dividend Yield − 1. Growth adjusted by quality score (ROIC, margins). "Needed" = growth required to hit your target CAGR at current valuation.</div>
              {(holdingReturns||[]).map(function(h){
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
        {readingList.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:_isBm?0:12,padding:40,textAlign:"center",color:K.dim,fontSize:14}}>
          <div style={{marginBottom:8}}>No books yet</div>
          <div style={{fontSize:12}}>Add books, articles, and resources that shape your investment thinking.</div>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
          {(readingList||[]).map(function(item,i){
            var statusColor=item.status==="read"?K.grn:item.status==="reading"?K.acc:K.dim;
            return<div key={i} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"16px 18px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:K.txt,marginBottom:2}}>{item.title}</div>
                  {item.author&&<div style={{fontSize:11,color:K.dim,marginBottom:6}}>{item.author}</div>}
                  {item.notes&&<div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{item.notes}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  <select value={item.status||"want"} onChange={function(e){var updated=(readingList||[]).map(function(r,j){return j===i?Object.assign({},r,{status:e.target.value}):r});saveRL(updated)}} style={{background:"transparent",border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:statusColor,fontSize:11,padding:"2px 6px",fontFamily:fm,cursor:"pointer"}}>
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
  var CHEST_REWARDS=[
  {label:"The Patient Investor",desc:"Markets reward those who wait. Every week you review is a vote for long-term thinking.",icon:String.fromCodePoint(0x1F3C6),tier:"rare",xp:50},
  {label:"Process over Outcomes",desc:"A good decision with a bad outcome is still a good decision. Track your reasoning.",icon:String.fromCodePoint(0x1F3AF),tier:"uncommon",xp:30},
  {label:"Conviction Check",desc:"You showed up. That\u2019s 80% of investing. The other 20% is staying honest with yourself.",icon:String.fromCodePoint(0x1F525),tier:"common",xp:15},
  {label:"The Weekly Edge",desc:"Most investors never write down why they own something. You just did.",icon:"\u26A1",tier:"common",xp:15},
  {label:"Owner\u2019s Discipline",desc:"Reviewing your holdings weekly puts you in the top 5% of retail investors by process.",icon:String.fromCodePoint(0x1F4CB),tier:"uncommon",xp:25},
  {label:"Compounding Clarity",desc:"The clearer your thesis, the better your judgment under pressure.",icon:String.fromCodePoint(0x1F4A1),tier:"common",xp:15},
  {label:"The Munger Habit",desc:"Invert, always invert. Did you stress-test your convictions this week?",icon:String.fromCodePoint(0x1F9E0),tier:"uncommon",xp:30},
  {label:"Patience Rewarded",desc:"One more week of discipline in the books. The market rewards patience; so do we.",icon:"\u23F3",tier:"common",xp:10},
];
function openChest(){
  var sw=streakData.current||0;
  var pool=sw>0&&sw%4===0?CHEST_REWARDS.filter(function(r){return r.tier==="rare"||r.tier==="uncommon"}):CHEST_REWARDS;
  var reward=pool[Math.floor(Math.random()*pool.length)];
  setChestOverlay(reward);
}

  // ── All Assets / Net Worth Hub ────────────────────────────
