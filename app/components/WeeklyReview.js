"use client";
import React, { useState, useEffect, useRef } from "react";

export default function WeeklyReview({
  cos, weeklyReviews, saveReview, streakData, openChest,
  K, S, fm, fh, fb, theme, isMobile, _isBm,
  getWeekId, IC, upd, logJournalEntry,
  setShowUpgrade, setUpgradeCtx, showToast,
  milestones,
  trialActive, trialExpired, effectivePlan,
}) {
  var _saved=React.useState(false),saved=_saved[0],setSaved=_saved[1];
  var trial=null;
  var isThesis = theme === "thesis_dark" || theme === "thesis_light";
  var currentWeekReviewed = weeklyReviews && weeklyReviews.length > 0 && weeklyReviews[0].weekId === getWeekId();
    var portfolio=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
    var weekId=getWeekId();var alreadyDone=weeklyReviews.length>0&&weeklyReviews[0].weekId===weekId;
    var today=new Date().getDay();
    var isReviewDay=today===0||today===5||today===6;
    var _step=useState(alreadyDone?"done":"intro"),step=_step[0],setStep=_step[1];
    var _idx=useState(0),idx=_idx[0],setIdx=_idx[1];
    var _revs=useState({}),revs=_revs[0],setRevs=_revs[1];
    var _notes=useState({}),notes=_notes[0],setNotes=_notes[1];
    var _actions=useState({}),actions=_actions[0],setActions=_actions[1];
    var _refl=useState(""),reflection=_refl[0],setReflection=_refl[1];
    var _milestone=useState(null),milestone=_milestone[0],setMilestone=_milestone[1];
    var c=portfolio[idx];
    var sw=streakData.current||0;
    var isFree=effectivePlan!=="pro"&&!trialActive; // trial = full pro experience

    // Master unlock journey — single source of truth
    var JOURNEY=[
      {w:1,type:"theme",id:"forest",label:"Forest Theme",icon:"seedling",desc:"A calm dark-green workspace"},
      {w:2,type:"lens",id:"munger",label:"Munger Lens",icon:"search",desc:"Quality at scale filter"},
      {w:3,type:"theme",id:"paypal",label:"Ocean",icon:"shield",desc:"Clean professional blue"},
      {w:4,type:"lens",id:"buffett",label:"Buffett Lens",icon:"castle",desc:"Owner earnings framework"},
      {w:6,type:"theme",id:"purple",label:"Purple Theme",icon:"target",desc:"Twilight dark palette"},
      {w:8,type:"lens",id:"greenblatt",label:"Magic Formula Lens",icon:"bar",desc:"Greenblatt's two-factor system"},
      {w:10,type:"theme",id:"bloomberg",label:"Bloomberg Terminal",icon:"trending",desc:"Amber-on-black terminal workspace"},
      {w:12,type:"lens",id:"lynch",label:"Lynch + Akre + Pabrai Lenses",icon:"book",desc:"Three more investor frameworks"},
    ];

    // Countdown timer
    var _ct=useState(null),countdownStr=_ct[0],setCountdownStr=_ct[1];
    useEffect(function(){
      if(isReviewDay)return;
      function tick(){var now=new Date();var fri=new Date(now);var daysUntil=(5-now.getDay()+7)%7;if(daysUntil===0)daysUntil=7;fri.setDate(now.getDate()+daysUntil);fri.setHours(0,0,0,0);
        var diff=fri-now;if(diff<=0){setCountdownStr(null);return}
        var d2=Math.floor(diff/86400000);var h=Math.floor((diff%86400000)/3600000);var m=Math.floor((diff%3600000)/60000);var s=Math.floor((diff%60000)/1000);
        setCountdownStr((d2>0?d2+"d ":"")+h+"h "+m+"m "+s+"s")}
      tick();var iv=setInterval(tick,1000);return function(){clearInterval(iv)}},[isReviewDay]);

    function setConv(id,val){setRevs(function(p){var n=Object.assign({},p);n[id]=val;return n})}
    function setNote(id,val){setNotes(function(p){var n=Object.assign({},p);n[id]=val;return n})}
    function setAction(id,val){setActions(function(p){var n=Object.assign({},p);n[id]=val;return n})}
    function nextHolding(){if(idx<portfolio.length-1){setIdx(idx+1)}else{setStep("summary")}}
    function prevHolding(){if(idx>0)setIdx(idx-1)}

    function finishReview(){
      var entries=portfolio.map(function(c2){return{ticker:c2.ticker,id:c2.id,prev:c2.conviction||0,
        new:revs[c2.id]!=null?revs[c2.id]:c2.conviction||0,note:notes[c2.id]||"",action:actions[c2.id]||"hold"}});
      var rev={weekId:weekId,date:new Date().toISOString(),entries:entries,reflection:reflection.trim(),
        summary:{total:portfolio.length,changed:entries.filter(function(e){return e.prev!==e.new}).length,
        avgConv:Math.round(entries.reduce(function(s,e){return s+e.new},0)/Math.max(entries.length,1)*10)/10}};
      saveReview(rev);
      entries.forEach(function(e){if(e.new!==e.prev||e.note){
        var hist=(cos.find(function(x){return x.id===e.id})||{}).convictionHistory||[];
        hist=hist.slice();hist.push({date:new Date().toISOString().split("T")[0],rating:e.new,note:"Weekly review"+(e.note?" — "+e.note:"")});
        upd(e.id,{conviction:e.new,convictionHistory:hist.slice(-20)})}});
      entries.forEach(function(e2){if(Math.abs(e2.new-e2.prev)>=2){
        logJournalEntry(e2.id,{cardType:"conviction_shift",ticker:e2.ticker,prevConviction:e2.prev,newConviction:e2.new,delta:e2.new-e2.prev,note:e2.note||"",action:e2.action||"hold",weekId:weekId})}});
      // Check for milestone unlock (new streak = sw+1)
      var newStreak=sw+1;
      var hit=JOURNEY.find(function(j){return j.w===newStreak});
      if(hit&&isFree){setMilestone(hit);setStep("milestone")}else{
        showToast("✓ Weekly review logged — "+rev.summary.changed+" conviction change"+(rev.summary.changed!==1?"s":""),"info",4000);
        setTimeout(function(){openChest()},1500);setStep("done")}
    }

    function dismissMilestone(){
      showToast("✓ Week "+(sw+1)+" complete — "+milestone.label+" unlocked!","info",5000);
      setTimeout(function(){openChest()},800);setStep("done")}

    var streakColor=sw>=8?K.grn:sw>=4?K.amb:K.mid;
    var nextUnlock=JOURNEY.find(function(j){return j.w>sw});
    var scored=[];var rights=0;
    cos.forEach(function(c2){(c2.decisions||[]).forEach(function(d){if(d.outcome){scored.push(d);if(d.outcome==="right")rights++}})});
    var dqPct=scored.length>0?Math.round(rights/scored.length*100):0;

    return<div style={{padding:isMobile?"0 16px 80px":isThesis?"0 40px 80px":"0 32px 60px",maxWidth:820}}>
      <div style={{padding:isMobile?"16px 0 12px":"28px 0 20px"}}>
        <h1 style={{margin:0,fontSize:isMobile?22:26,fontWeight:isThesis?800:400,color:K.txt,fontFamily:fh,letterSpacing:isThesis?"-0.5px":"normal"}}>Weekly Owner's Review</h1>
        <p style={{margin:"4px 0 0",fontSize:14,color:K.dim}}>3 minutes. One question per holding. Your portfolio, honestly examined.</p>
      </div>

      {/* ── Streak bar ── */}
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"14px 20px",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,marginBottom:20}}>
        <div>
          <div style={{fontSize:30,fontWeight:800,color:streakColor,fontFamily:fm,lineHeight:1}}>{sw}</div>
          <div style={{fontSize:9,color:K.dim,fontFamily:fm,letterSpacing:1}}>WEEK STREAK</div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:12,color:K.txt,fontWeight:500,marginBottom:5}}>{sw>=8?"Exceptional discipline — Munger-level consistency":sw>=4?"Building the habit — keep it going":sw>=1?"First steps — each week compounds":"Start your review streak today"}</div>
          <div style={{display:"flex",gap:2}}>{[0,1,2,3,4,5,6,7,8,9,10,11].map(function(i){var done=i<sw;var isMil=JOURNEY.some(function(j){return j.w===i+1});return<div key={i} style={{flex:1,height:6,borderRadius:_isBm?0:2,background:done?streakColor:K.bdr,border:isMil&&!done?"1px solid "+K.acc+"60":"none",position:"relative"}} title={isMil?"Week "+(i+1)+" unlock":(done?"Done":"")}/>})}</div>
          {nextUnlock&&<div style={{fontSize:10,color:K.acc,marginTop:4,fontFamily:fm}}>{sw>0?"Next: ":"Start to unlock: "}{nextUnlock.label} at week {nextUnlock.w}</div>}
        </div>
        <div style={{marginLeft:"auto",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
          {!isReviewDay&&countdownStr&&<div style={{fontSize:10,color:K.dim,fontFamily:fm,textAlign:"right"}}>Next review<br/><span style={{fontWeight:600,color:K.txt}}>{countdownStr}</span></div>}
          {isReviewDay&&<div style={{fontSize:11,fontWeight:600,color:K.grn,fontFamily:fm}}>Today is review day</div>}
        </div>
      </div>

      {/* ═══ INTRO STEP ═══ */}
      {step==="intro"&&(function(){
        // Unlock journey track — show all milestones
        return<div>
          {/* Journey track */}
          {trialExpired&&<div style={{background:K.amb+"0d",border:"1px solid "+K.amb+"25",borderRadius:_isBm?0:12,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}><div style={{fontSize:22}}>{"\u23F3"}</div><div><div style={{fontSize:13,fontWeight:700,color:K.amb,fontFamily:fm,marginBottom:2}}>Your Pro trial has ended</div><div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>{"Build your streak to unlock themes, lenses and investor wisdom. Each week unlocks something new."}</div><button onClick={function(){setShowUpgrade(true);setUpgradeCtx("review")}} style={{marginTop:8,padding:"5px 14px",fontSize:11,fontWeight:700,background:K.acc,border:"none",color:"#fff",borderRadius:_isBm?0:6,cursor:"pointer",fontFamily:fm}}>Upgrade to keep Pro</button></div></div>}
          {isFree&&!trialExpired&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"20px 24px",marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:600,color:K.dim,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:14,display:"flex",alignItems:"center",gap:6}}><IC name="trending" size={12} color={K.dim}/>Your Unlock Journey</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {JOURNEY.map(function(j){var done=sw>=j.w;var isNext=!done&&j.w===nextUnlock?.w;
                return<div key={j.w} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:_isBm?0:8,background:done?K.grn+"08":isNext?K.acc+"08":"transparent",border:"1px solid "+(done?K.grn+"30":isNext?K.acc+"30":K.bdr+"50"),opacity:done||isNext?1:0.55}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:done?K.grn+"20":isNext?K.acc+"20":K.bdr,border:"1px solid "+(done?K.grn+"60":isNext?K.acc+"60":K.bdr),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {done?<IC name="check" size={12} color={K.grn}/>:<span style={{fontSize:11,fontWeight:700,color:isNext?K.acc:K.dim,fontFamily:fm}}>{j.w}</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:done?K.grn:isNext?K.acc:K.txt,fontFamily:fm}}>{j.label}</div>
                    <div style={{fontSize:11,color:K.dim}}>{j.desc}</div>
                  </div>
                  <div style={{fontSize:10,color:done?K.grn:isNext?K.acc:K.dim,fontFamily:fm,fontWeight:600}}>{done?"Unlocked":isNext?"Up next":"Week "+j.w}</div>
                </div>})}
            </div>
            <div style={{marginTop:14,padding:"10px 14px",background:K.acc+"08",border:"1px solid "+K.acc+"20",borderRadius:_isBm?0:8,display:"flex",alignItems:"center",gap:10}}>
              <IC name="lightbulb" size={14} color={K.acc}/>
              <div style={{fontSize:12,color:K.mid,lineHeight:1.5}}>Pro users get all themes and lenses immediately. <span style={{color:K.acc,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted"}} onClick={function(){setShowUpgrade(true);setUpgradeCtx("review")}}>See what's included →</span></div>
            </div>
          </div>}
          {!isFree&&<div style={{background:K.grn+"08",border:"1px solid "+K.grn+"20",borderRadius:_isBm?0:12,padding:"14px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
            <IC name="shield" size={16} color={K.grn}/>
            <div style={{fontSize:13,color:K.mid}}>Pro member — all themes and investor lenses are unlocked. Your review generates a full portfolio health report.</div>
          </div>}
          {/* Insight preview chest */}
          <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"24px 28px",textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40,marginBottom:10,display:"inline-block",animation:"glowPulse 2.5s ease-in-out infinite"}}>{String.fromCodePoint(0x1F4DC)}</div>
            <div style={{fontSize:15,fontWeight:600,color:K.txt,fontFamily:fh,marginBottom:6}}>Weekly Insight awaits</div>
            <div style={{fontSize:13,color:K.mid,lineHeight:1.6,maxWidth:340,margin:"0 auto 16px"}}>{isFree?"Complete your review to earn investor wisdom and claim your streak reward.":"Complete your review to receive curated wisdom and your portfolio health report."}</div>
            {currentWeekReviewed
              ?<div><div style={{fontSize:14,fontWeight:600,color:K.grn,marginBottom:4}}>{"✓"} Done for this week</div><div style={{fontSize:12,color:K.dim}}>Come back next week</div></div>
              :<div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"center"}}>
                <button onClick={function(){setStep("review")}} style={Object.assign({},S.btnP,{padding:"12px 40px",fontSize:14,borderRadius:_isBm?0:10})}>Start Review</button>
                {alreadyDone&&<button onClick={function(){setStep("done")}} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",fontFamily:fm}}>View past results →</button>}
              </div>}
          </div>
          {/* Past review mini-history */}
          {weeklyReviews.length>1&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"14px 18px"}}>
            <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:10}}>RECENT REVIEWS</div>
            {weeklyReviews.slice(1,6).map(function(h,hi){var d2=h.date?new Date(h.date):null;var ds2=d2?d2.toLocaleDateString("en-US",{month:"short",day:"numeric"}):"";var inc=h.entries?h.entries.filter(function(e){return e.new>e.prev}).length:0;var dec=h.entries?h.entries.filter(function(e){return e.new<e.prev}).length:0;
              return<div key={hi} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0",borderBottom:hi<Math.min(weeklyReviews.length-2,4)?"1px solid "+K.bdr+"30":"none"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:K.grn,flexShrink:0}}/>
                <div style={{flex:1,fontSize:11,color:K.mid,fontFamily:fm}}>{ds2}</div>
                <div style={{display:"flex",gap:4}}>
                  {inc>0&&<span style={{fontSize:10,color:K.grn,fontFamily:fm,fontWeight:600}}>↑{inc}</span>}
                  {dec>0&&<span style={{fontSize:10,color:K.red,fontFamily:fm,fontWeight:600}}>↓{dec}</span>}
                  <span style={{fontSize:10,color:K.dim,fontFamily:fm}}>avg {h.summary.avgConv}</span>
                </div>
              </div>})}
          </div>}
        </div>
      })()}



      {/* ═══ REVIEW STEP ═══ */}
      {step==="review"&&c&&<div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{fontSize:12,color:K.dim,fontFamily:fm}}>{idx+1} / {portfolio.length}</div>
          <div style={{flex:1,height:4,borderRadius:_isBm?0:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:((idx+1)/portfolio.length*100)+"%",borderRadius:_isBm?0:2,background:K.acc,transition:"width .3s"}}/></div>
          <button onClick={function(){setStep("summary")}} style={{background:"none",border:"none",color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fm,opacity:.6}}>Skip to summary →</button>
        </div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:"28px 32px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <CoLogo domain={c.domain} ticker={c.ticker} size={36}/>
            <div><div style={{fontSize:18,fontWeight:500,color:K.txt,fontFamily:fh}}>{c.ticker}</div>
              <div style={{fontSize:12,color:K.dim}}>{c.name}</div></div>
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div style={{fontSize:11,color:K.dim,fontFamily:fm}}>CURRENT CONVICTION</div>
              <div style={{fontSize:22,fontWeight:700,color:c.conviction>=7?K.grn:c.conviction>=4?K.amb:K.red,fontFamily:fm}}>{c.conviction||"—"}/10</div></div>
          </div>
          {/* Prior review comparison */}
          {(function(){var prevWeek=weeklyReviews.length>0?weeklyReviews[0]:null;var prevEntry=prevWeek?prevWeek.entries.find(function(e){return e.id===c.id}):null;
            if(!prevEntry)return null;
            var prevAction=prevEntry.action||"hold";
            return<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:3}}>LAST WEEK</div>
                <div style={{fontSize:12,color:K.mid}}>Conviction: <strong style={{color:K.txt}}>{prevEntry.prev}→{prevEntry.new}</strong>{prevEntry.note?" · "+prevEntry.note.substring(0,60):""}</div>
              </div>
              {prevAction!=="hold"&&<span style={{fontSize:10,fontWeight:700,color:prevAction==="add"?K.grn:prevAction==="sell"?K.red:K.amb,background:(prevAction==="add"?K.grn:prevAction==="sell"?K.red:K.amb)+"15",padding:"3px 8px",borderRadius:_isBm?0:4,fontFamily:fm,textTransform:"uppercase",flexShrink:0}}>{prevAction}</span>}
            </div>})()}
          {/* Conviction sparkline */}
          {(function(){var ch=c.convictionHistory||[];if(ch.length<2)return null;var pts=ch.slice(-8);
            return<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:5}}>CONVICTION HISTORY</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:3,height:24}}>
                  {pts.map(function(p,pi){var h=Math.max(3,Math.round((p.rating/10)*24));var isLast=pi===pts.length-1;var clr=p.rating>=7?K.grn:p.rating>=4?K.amb:K.red;
                    return<div key={pi} title={(p.date||"")+": "+p.rating} style={{width:16,height:h,borderRadius:_isBm?0:2,background:isLast?clr:clr+"60",flexShrink:0}}/>})}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                {(function(){var first=pts[0].rating;var last=pts[pts.length-1].rating;var delta=last-first;
                  return<div><div style={{fontSize:18,fontWeight:800,color:last>=7?K.grn:last>=4?K.amb:K.red,fontFamily:fm,lineHeight:1}}>{last}</div>
                  {delta!==0&&<div style={{fontSize:10,fontWeight:700,color:delta>0?K.grn:K.red,fontFamily:fm}}>{delta>0?"+":""}{delta} vs start</div>}</div>})()}
              </div>
            </div>})()}
          {/* Thesis reminder */}
          {c.thesisNote&&<div style={{background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"10px 14px",marginBottom:16,maxHeight:80,overflow:"hidden"}}>
            <div style={{fontSize:11,color:K.dim,fontFamily:fm,letterSpacing:1,marginBottom:4}}>YOUR THESIS</div>
            <div style={{fontSize:13,color:K.mid,lineHeight:1.5}}>{c.thesisNote.split("\n")[0].substring(0,200)}</div></div>}
          {/* Reflection prompt */}
          {(function(){var prompts=["If you couldn\u2019t look at the stock price for 5 years, would you still own this?","What do you understand about this business that the market doesn\u2019t?","Would you be comfortable if this was your only holding?","Is this business better or worse than when you first bought it?","Are you holding because of conviction or because selling feels like admitting a mistake?","What would a smart skeptic say about your thesis?","Has anything structurally changed, or is this just noise?","Would you buy more at today\u2019s price?"];
            var pi=(idx+c.id)%prompts.length;
            return<div style={{background:K.bg,borderRadius:_isBm?0:8,padding:"10px 14px",marginBottom:16,borderLeft:"2px solid "+K.acc}}>
              <div style={{fontSize:12,color:K.mid,lineHeight:1.6,fontStyle:"italic"}}>{prompts[pi]}</div></div>})()}
          {/* Conviction adjustment */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:K.dim,fontFamily:fm,marginBottom:8}}>ADJUST CONVICTION</div>
            <div style={{display:"flex",gap:4}}>
              {[1,2,3,4,5,6,7,8,9,10].map(function(v){var cur=revs[c.id]!=null?revs[c.id]:c.conviction;var active=cur===v;var clr=v>=7?K.grn:v>=4?K.amb:K.red;
                return<button key={v} onClick={function(){setConv(c.id,v)}}
                  style={{flex:1,height:36,borderRadius:_isBm?0:6,border:"1px solid "+(active?clr:K.bdr),background:active?clr+"20":"transparent",
                    color:active?clr:K.dim,fontSize:14,fontWeight:active?700:500,cursor:"pointer",fontFamily:fm}}>{v}</button>})}
            </div>
            {revs[c.id]!=null&&revs[c.id]!==c.conviction&&<div style={{fontSize:11,color:K.acc,fontFamily:fm,marginTop:4}}>Changed from {c.conviction} to {revs[c.id]}</div>}
          </div>
          {/* Action flag */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:K.dim,fontFamily:fm,marginBottom:8}}>ACTION THIS WEEK</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[{id:"hold",l:"Hold",c:K.mid},{id:"add",l:"Add",c:K.grn},{id:"trim",l:"Trim",c:K.amb},{id:"review",l:"Deep Review",c:K.acc},{id:"sell",l:"Consider Sell",c:K.red}].map(function(a){
                var act=actions[c.id]||"hold";
                return<button key={a.id} onClick={function(){setAction(c.id,a.id)}}
                  style={{padding:"6px 12px",borderRadius:_isBm?0:6,border:"1px solid "+(act===a.id?a.c+"60":K.bdr),
                    background:act===a.id?a.c+"12":"transparent",color:act===a.id?a.c:K.dim,
                    fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{a.l}</button>})}
            </div>
          </div>
          {/* Note */}
          <input value={notes[c.id]||""} onChange={function(e){setNote(c.id,e.target.value)}} placeholder="Quick note (optional)..."
            style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:K.txt,padding:"8px 12px",fontSize:13,fontFamily:fm,outline:"none"}}/>
          <div style={{display:"flex",gap:12,marginTop:20}}>
            <button onClick={prevHolding} disabled={idx===0} style={Object.assign({},S.btn,{opacity:idx===0?.3:1})}>← Prev</button>
            <div style={{flex:1}}/>
            <button onClick={nextHolding} style={S.btnP}>{idx===portfolio.length-1?"Finish →":"Next →"}</button>
          </div>
        </div>
      </div>}

      {/* ═══ SUMMARY STEP ═══ */}
      {step==="summary"&&<div style={{position:"fixed",inset:0,zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.65)",backdropFilter:"blur(8px)",animation:"fadeInFast .2s ease"}}>
        <div className="ta-celebrate" style={{background:K.card,borderRadius:_isBm?0:20,padding:isMobile?"24px 20px":"36px 40px",width:isMobile?"94vw":480,maxWidth:"94vw",maxHeight:"90vh",overflow:"auto",position:"relative",border:"2px solid "+K.grn+"40",boxShadow:"0 0 60px "+K.grn+"15, 0 20px 60px rgba(0,0,0,.3)"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,"+K.grn+","+K.acc+","+K.grn+")",backgroundSize:"200% 100%"}}/>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:52,marginBottom:8,animation:"glowPulse 2.5s ease-in-out infinite",display:"inline-block",filter:"drop-shadow(0 0 16px rgba(255,215,0,.5))"}}>{String.fromCodePoint(0x1F3C6)}</div>
            <div style={{fontSize:20,fontWeight:600,color:K.txt,fontFamily:fh,marginBottom:4}}>Review Complete</div>
            <div style={{fontSize:13,color:K.dim}}>Confirm to save and claim your weekly insight.</div>
          </div>
          {/* Stats */}
          {(function(){
            var changed=Object.keys(revs).filter(function(k){return revs[k]!==(cos.find(function(x){return x.id===parseInt(k)||x.id===k})||{}).conviction});
            var ups=changed.filter(function(k){var co2=cos.find(function(x){return x.id===parseInt(k)||x.id===k})||{};return(revs[k]||0)>(co2.conviction||0)}).length;
            var downs=changed.filter(function(k){var co2=cos.find(function(x){return x.id===parseInt(k)||x.id===k})||{};return(revs[k]||0)<(co2.conviction||0)}).length;
            var actCount=Object.values(actions).filter(function(a){return a!=="hold"}).length;
            var avgNew=Math.round(portfolio.map(function(c2){return revs[c2.id]!=null?revs[c2.id]:(c2.conviction||0)}).reduce(function(s,v){return s+v},0)/Math.max(portfolio.length,1)*10)/10;
            var pats=[];
            if(weeklyReviews.length>=3){var neverLowered=weeklyReviews.slice(0,5).every(function(r){return r.entries.every(function(e){return e.new>=e.prev})});if(neverLowered&&downs===0)pats.push({c:K.amb,t:"You haven't lowered conviction in recent reviews. Honest reassessment is part of the process."});}
            if(pats.length===0&&ups>downs&&ups>=2)pats.push({c:K.grn,t:"Building conviction across "+ups+" holding"+(ups>1?"s":"")+" this week."});
            if(pats.length===0&&downs>ups&&downs>=2)pats.push({c:K.red,t:"Conviction fell on "+downs+" holding"+(downs>1?"s":"")+". Follow your process."});
            if(weeklyReviews.length>=2){var prevAvg=(weeklyReviews[0].summary&&weeklyReviews[0].summary.avgConv)||0;var avgDelta=avgNew-prevAvg;if(Math.abs(avgDelta)>=0.5&&pats.length<2)pats.push({c:avgDelta>0?K.grn:K.amb,t:"Portfolio avg conviction "+(avgDelta>0?"rose":"fell")+" from "+prevAvg+" → "+avgNew+" this week."});}
            return<div>
              <div style={{display:"flex",justifyContent:"center",gap:20,marginBottom:12}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:800,color:K.txt,fontFamily:fm,lineHeight:1}}>{portfolio.length}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Reviewed</div></div>
                {ups>0&&<div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:800,color:K.grn,fontFamily:fm,lineHeight:1}}>↑{ups}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Raised</div></div>}
                {downs>0&&<div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:800,color:K.red,fontFamily:fm,lineHeight:1}}>↓{downs}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Lowered</div></div>}
                <div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:800,color:K.acc,fontFamily:fm,lineHeight:1}}>{avgNew}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Avg conv</div></div>
                {actCount>0&&<div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:800,color:K.grn,fontFamily:fm,lineHeight:1}}>{actCount}</div><div style={{fontSize:10,color:K.dim,marginTop:2}}>Actions</div></div>}
              </div>
              {pats.slice(0,2).map(function(p2,pi){return<div key={pi} style={{background:p2.c+"10",border:"1px solid "+p2.c+"30",borderRadius:_isBm?0:8,padding:"8px 14px",marginBottom:6,fontSize:12,color:p2.c,textAlign:"center",fontStyle:"italic"}}>{p2.t}</div>})}
            </div>})()}
          {/* Holdings pills */}
          <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center",marginBottom:16,maxHeight:100,overflow:"auto"}}>
            {portfolio.map(function(c2){var newConv=revs[c2.id]!=null?revs[c2.id]:c2.conviction;var chgd=newConv!==c2.conviction;var act=actions[c2.id]||"hold";
              return<div key={c2.id} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:_isBm?0:20,background:chgd?K.acc+"10":K.bg,border:"1px solid "+(chgd?K.acc+"30":K.bdr),fontSize:11,fontFamily:fm}}>
                <span style={{fontWeight:600,color:K.txt}}>{c2.ticker}</span>
                {chgd?<span style={{color:K.acc,fontWeight:600}}>{c2.conviction+"→"+newConv}</span>:<span style={{color:K.dim}}>{newConv}</span>}
                {act!=="hold"&&<span style={{fontSize:8,fontWeight:700,color:act==="add"?K.grn:act==="sell"?K.red:K.amb,textTransform:"uppercase"}}>{act}</span>}
              </div>})}
          </div>
          {/* Pro teasers for free users */}
          {isFree&&<div style={{marginBottom:16,padding:"12px 14px",background:K.bg,borderRadius:_isBm?0:10,border:"1px solid "+K.bdr}}>
            <div style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>Pro members also see after their review</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[{label:"Moat Health Delta",sub:"How your holdings scored vs last week"},
                {label:"Earnings Prep Score",sub:"KPI readiness for upcoming reports"},
                {label:"Insider Trade Alerts",sub:"Buys/sells since your last review"}
              ].map(function(t){return<div key={t.label} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:_isBm?0:6,background:K.card,border:"1px solid "+K.bdr}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:K.txt,filter:"blur(0)"}}>{t.label}</div>
                  <div style={{fontSize:11,color:K.dim}}>{t.sub}</div>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:K.dim,filter:"blur(4px)",userSelect:"none",minWidth:32,textAlign:"right"}}>9.1</div>
                <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("review")}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",borderRadius:_isBm?0:5,padding:"3px 8px",fontSize:10,color:K.acc,cursor:"pointer",fontFamily:fm,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>⚡ Pro</button>
              </div>})}
            </div>
          </div>}
          {/* Next unlock nudge */}
          {isFree&&!trialExpired&&nextUnlock&&<div style={{marginBottom:14,textAlign:"center",fontSize:12,color:K.acc,fontFamily:fm}}>
            {sw+1>=nextUnlock.w?"🎉 Complete this review to unlock "+nextUnlock.label+"!":"Keep going — "+nextUnlock.label+" unlocks at week "+nextUnlock.w}
          </div>}
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:K.dim,fontFamily:fm,letterSpacing:0.5,textTransform:"uppercase",marginBottom:6}}>What did I learn this week? <span style={{fontWeight:400,color:K.dim,textTransform:"none",letterSpacing:0}}>(optional — saved to quarterly letter)</span></label>
            <textarea value={reflection} onChange={function(e){setReflection(e.target.value)}} rows={3} placeholder={"A key insight, a mistake I noticed, something that shifted my thinking..."} style={{width:"100%",boxSizing:"border-box",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,color:K.txt,padding:"10px 14px",fontSize:13,fontFamily:fb,outline:"none",resize:"vertical",lineHeight:1.6}}/>
          </div>
          <button onClick={finishReview} className="ta-glow" style={Object.assign({},S.btnP,{fontSize:15,padding:"14px 0",borderRadius:_isBm?0:12,width:"100%",fontWeight:700,background:K.grn,border:"2px solid "+K.grn,color:"#ffffff",boxShadow:"0 4px 20px "+K.grn+"40"})}>
            {String.fromCodePoint(0x2705)+" Complete Review & Claim Insight"}</button>
          <div style={{textAlign:"center",marginTop:10}}><button onClick={function(){setStep("review");setIdx(0)}} style={{background:"none",border:"none",color:K.dim,fontSize:12,cursor:"pointer",fontFamily:fm}}>← Go back and edit</button></div>
        </div>
      </div>}

      {/* ═══ MILESTONE CELEBRATION ═══ */}
      {step==="milestone"&&milestone&&<div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.75)",backdropFilter:"blur(12px)",animation:"fadeInFast .25s ease"}}>
        <div style={{background:K.card,borderRadius:_isBm?0:24,padding:"40px 44px",width:isMobile?"90vw":400,maxWidth:"90vw",textAlign:"center",border:"2px solid "+K.grn+"60",boxShadow:"0 0 80px "+K.grn+"20, 0 24px 60px rgba(0,0,0,.4)",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:"linear-gradient(90deg,"+K.grn+",#FFD700,"+K.grn+")",animation:"shimmer 2s linear infinite"}}/>
          <div style={{fontSize:64,marginBottom:12,animation:"glowPulse 1.5s ease-in-out infinite",display:"inline-block",filter:"drop-shadow(0 0 20px rgba(255,215,0,.7))"}}>{String.fromCodePoint(0x1F381)}</div>
          <div style={{fontSize:11,fontWeight:700,color:K.grn,fontFamily:fm,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Week {sw+1} Unlocked</div>
          <div style={{fontSize:22,fontWeight:800,color:K.txt,fontFamily:fh,marginBottom:8}}>{milestone.label}</div>
          <div style={{fontSize:13,color:K.mid,lineHeight:1.6,marginBottom:20}}>{milestone.desc}<br/>{milestone.type==="theme"?"Head to Settings to activate it.":"Available now in Investor Lenses."}</div>
          <div style={{padding:"10px 14px",background:K.grn+"10",border:"1px solid "+K.grn+"30",borderRadius:_isBm?0:10,marginBottom:20}}>
            <div style={{fontSize:12,color:K.grn,fontWeight:600,fontFamily:fm}}>{"🔥"} {sw+1} week streak — keep it going!</div>
            {nextUnlock&&sw+1<nextUnlock.w&&<div style={{fontSize:11,color:K.dim,marginTop:4}}>Next: {nextUnlock.label} at week {nextUnlock.w}</div>}
          </div>
          <button onClick={dismissMilestone} style={Object.assign({},S.btnP,{width:"100%",padding:"12px 0",fontSize:14,borderRadius:_isBm?0:10,background:K.grn,border:"none",color:"#fff",fontWeight:700})}>Claim Reward & See Insight</button>
          {!isFree&&<div style={{marginTop:10,fontSize:11,color:K.dim}}>Pro users have this already — but the streak still counts.</div>}
        </div>
      </div>}

      {/* ═══ DONE STEP ═══ */}
      {step==="done"&&<div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:"28px 24px",marginBottom:20}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40,marginBottom:8,display:"inline-block",color:K.grn}}>{"✓"}</div>
            <div style={{fontSize:14,fontWeight:600,color:K.grn,fontFamily:fm,letterSpacing:1,marginBottom:4}}>THIS WEEK'S REVIEW COMPLETE</div>
            <div style={{fontSize:13,color:K.dim}}>Come back next week to keep the streak alive.</div>
          </div>
          {/* 8-week conviction trend chart */}
          {weeklyReviews.length>=2&&(function(){
            var last8=weeklyReviews.slice(0,8).reverse();
            return<div style={{background:K.bg,borderRadius:_isBm?0:10,border:"1px solid "+K.bdr,padding:"12px 16px",marginBottom:16}}>
              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.dim,fontFamily:fm,marginBottom:8}}>CONVICTION TREND (8 WEEKS)</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:4,height:40,justifyContent:"center"}}>
                {last8.map(function(rev,ri){var avg=rev.summary?rev.summary.avgConv:0;var h=Math.max(4,Math.round((avg/10)*40));var isLatest=ri===last8.length-1;var clr=avg>=7?K.grn:avg>=4?K.acc:K.red;
                  return<div key={ri} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <div style={{width:"100%",height:h,borderRadius:_isBm?0:2,background:isLatest?clr:clr+"50"}} title={"Wk "+rev.weekId+": avg "+avg}/>
                    {isLatest&&<span style={{fontSize:7,color:clr,fontFamily:fm,fontWeight:700}}>{avg}</span>}
                  </div>})}
              </div>
            </div>})()}
          {/* Pro post-review health report */}
          {(!isFree||trialActive)&&(function(){
            var upcoming=portfolio.filter(function(c2){return c2.earningsDate&&c2.earningsDate!=="TBD"&&dU(c2.earningsDate)>=0&&dU(c2.earningsDate)<=14});
            var noKpi=portfolio.filter(function(c2){return c2.kpis.length===0});
            var staleThesis=portfolio.filter(function(c2){return c2.thesisUpdatedAt&&Math.ceil((new Date()-new Date(c2.thesisUpdatedAt))/864e5)>90});
            var withInsider=portfolio.filter(function(c2){return c2._insiderCache&&c2._insiderCache.length>0});
            return<div style={{background:K.acc+"06",border:"1px solid "+K.acc+"20",borderRadius:_isBm?0:10,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:K.acc,fontFamily:fm,marginBottom:10,display:"flex",alignItems:"center",gap:5}}><IC name="shield" size={10} color={K.acc}/>Portfolio Health Report</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[{icon:"target",label:"Earnings in next 14 days",value:upcoming.length,good:upcoming.length===0,warn:upcoming.length>0,detail:upcoming.length>0?upcoming.map(function(c2){return c2.ticker}).join(", "):"All clear"},
                  {icon:"bar",label:"Holdings without KPIs",value:noKpi.length,good:noKpi.length===0,warn:noKpi.length>0,detail:noKpi.length>0?noKpi.map(function(c2){return c2.ticker}).join(", "):"All covered"},
                  {icon:"clock",label:"Stale theses (90+ days)",value:staleThesis.length,good:staleThesis.length===0,warn:staleThesis.length>0,detail:staleThesis.length>0?staleThesis.map(function(c2){return c2.ticker}).join(", "):"All current"},
                  {icon:"users",label:"Recent insider activity",value:withInsider.length,good:withInsider.length===0,warn:false,detail:withInsider.length>0?withInsider.map(function(c2){return c2.ticker}).join(", "):"None detected"}
                ].map(function(s){return<div key={s.label} style={{display:"flex",alignItems:"center",gap:8}}>
                  <IC name={s.icon} size={12} color={s.warn?K.amb:s.good?K.grn:K.dim}/>
                  <div style={{flex:1}}><span style={{fontSize:12,color:K.txt}}>{s.label}</span>{s.detail&&<span style={{fontSize:11,color:K.dim}}> — {s.detail}</span>}</div>
                  <div style={{fontSize:13,fontWeight:700,color:s.warn?K.amb:s.good?K.grn:K.dim,fontFamily:fm}}>{s.value}</div>
                </div>})}
              </div>
            </div>})()}
          {/* Free user — subtle Pro nudge */}
          {isFree&&<div style={{padding:"10px 14px",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
            <IC name="lightbulb" size={14} color={K.acc}/>
            <div style={{flex:1,fontSize:12,color:K.dim,lineHeight:1.5}}>Pro members see a full health report after every review — upcoming earnings, stale theses, insider trades.</div>
            <button onClick={function(){setShowUpgrade(true);setUpgradeCtx("review")}} style={{background:K.acc+"15",border:"1px solid "+K.acc+"30",borderRadius:_isBm?0:6,padding:"4px 10px",fontSize:11,color:K.acc,cursor:"pointer",fontFamily:fm,fontWeight:600,flexShrink:0}}>⚡ Pro</button>
          </div>}
        </div>
        {/* Review history */}
        {weeklyReviews.length>0&&<div>
          <div style={S.sec}><IC name="trending" size={14} color={K.dim}/>Review History</div>
          {weeklyReviews.slice(0,12).map(function(r,ri){
            var increases=r.entries.filter(function(e){return e.new>e.prev});
            var decreases=r.entries.filter(function(e){return e.new<e.prev});
            var acts=r.entries.filter(function(e){return e.action&&e.action!=="hold"});
            return<div key={ri} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:10,padding:"14px 18px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Week of {r.weekId}</div>
                <div style={{display:"flex",gap:6}}>
                  {increases.length>0&&<span style={{fontSize:10,fontWeight:600,color:K.grn,background:K.grn+"12",padding:"2px 6px",borderRadius:_isBm?0:3,fontFamily:fm}}>↑{increases.length}</span>}
                  {decreases.length>0&&<span style={{fontSize:10,fontWeight:600,color:K.red,background:K.red+"12",padding:"2px 6px",borderRadius:_isBm?0:3,fontFamily:fm}}>↓{decreases.length}</span>}
                  {acts.length>0&&<span style={{fontSize:10,fontWeight:600,color:K.acc,background:K.acc+"12",padding:"2px 6px",borderRadius:_isBm?0:3,fontFamily:fm}}>{acts.length} action{acts.length>1?"s":""}</span>}
                </div>
                <span style={{fontSize:11,color:K.dim,fontFamily:fm,marginLeft:"auto"}}>avg {r.summary.avgConv}/10</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {r.entries.map(function(e){var changed=e.prev!==e.new;var isUp=e.new>e.prev;
                  return<div key={e.ticker} style={{padding:"3px 8px",borderRadius:_isBm?0:4,background:changed?(isUp?K.grn+"12":K.red+"12"):K.bg,border:"1px solid "+(changed?(isUp?K.grn+"30":K.red+"30"):K.bdr),fontSize:11,fontFamily:fm,color:changed?(isUp?K.grn:K.red):K.dim,display:"flex",alignItems:"center",gap:3}}>
                    <span style={{fontWeight:600}}>{e.ticker}</span>
                    {changed&&<span>{isUp?"↑":"↓"}{e.prev}→{e.new}</span>}
                    {!changed&&<span style={{color:K.dim}}>{e.new}</span>}
                    {e.action&&e.action!=="hold"&&<span style={{fontSize:8,fontWeight:700,color:e.action==="add"?K.grn:e.action==="sell"?K.red:K.amb,textTransform:"uppercase",marginLeft:2}}>{e.action}</span>}
                  </div>})}
              </div>
              {r.entries.some(function(e){return e.note&&e.note.length>0})&&<div style={{marginTop:8,paddingTop:8,borderTop:"1px solid "+K.bdr+"50"}}>
                {r.entries.filter(function(e){return e.note}).map(function(e){return<div key={e.ticker} style={{fontSize:11,color:K.mid,marginBottom:2}}><strong style={{color:K.txt}}>{e.ticker}:</strong> {e.note}</div>})}
              </div>}
            </div>})}
        </div>}
      </div>}
    </div>
 }
