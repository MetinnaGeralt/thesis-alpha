"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { DARK, THEMES, METRIC_MAP, INVEST_STYLES, STYLE_MAP, INVESTOR_PROFILES, PROFILE_MAP, SUPERINVESTORS, MSTAR_RATINGS, FOLDERS } from "./constants";
import { calcMastery, calcOwnerScore, classifyPortfolio, dU, fD, fT, nId, gH, bT, eS, autoFormat, buildPrompt, calcAlignmentSignals, calcMoatFromData } from "./utils";

export default function AllAssets({
  cos, page, setPage, setSelId, setDetailTab,
  K, fm, fh, fb, isMobile, _isBm,
  IC, CoLogo, Modal,
  currency,
  otherAssets, setOtherAssets,
  netWorthHistory, setNetWorthHistory,
  setAiModal,
  cSym,
  setSellCheckTgt,
}) {
  // ── Prop guards ──
  cos = cos || [];
  otherAssets = otherAssets || [];
  netWorthHistory = netWorthHistory || [];

  // ── Array prop guards ──
  cos = cos || [];
  netWorthHistory = netWorthHistory || [];
  otherAssets = otherAssets || [];

  var _liab=React.useState([]),liabilities=_liab[0],setLiabilities=_liab[1];
  var _nwt=React.useState("summary"),nwTab=_nwt[0],setNwTab=_nwt[1];
  var _at=React.useState({}),assetTargets=_at[0],setAssetTargets=_at[1];
  var _fx=React.useState({}),fxRates=_fx[0],setFxRates=_fx[1];
    var _modal=useState(null),modal=_modal[0],setModal=_modal[1];
    var _lmodal=useState(null),lmodal=_lmodal[0],setLmodal=_lmodal[1];
    var _form=useState({}),form=_form[0],setForm=_form[1];
    var _lform=useState({}),lform=_lform[0],setLform=_lform[1];
    var _prices=useState({}),livePrices=_prices[0],setLivePrices=_prices[1];
    var _ftch=useState(false),fetching=_ftch[0],setFetching=_ftch[1];
    var _p2form=useState({ticker:"",name:"",shares:"",avgCost:""}),p2form=_p2form[0],setP2form=_p2form[1];
    var _expanded=useState({stocks:true}),expanded=_expanded[0],setExpanded=_expanded[1];
    var _step=useState(0),step=_step[0],setStep=_step[1];
    var _editTgt=useState(false),editTgt=_editTgt[0],setEditTgt=_editTgt[1];
    var _tgtDraft=useState({}),tgtDraft=_tgtDraft[0],setTgtDraft=_tgtDraft[1];
    var _lfx=useState({}),localFx=_lfx[0],setLocalFx=_lfx[1];

    var ATYPES=[
      {id:"real_estate",label:"Real Estate",color:"#8b5cf6",icon:"moat"},
      {id:"etf",label:"ETFs & Funds",color:"#10b981",icon:"chart"},
      {id:"gold",label:"Gold & Precious Metals",color:"#f59e0b",icon:"shield"},
      {id:"crypto",label:"Crypto",color:"#f97316",icon:"dice"},
      {id:"portfolio2",label:"2nd Stock Portfolio",color:"#06b6d4",icon:"trending",isPortfolio2:true},
      {id:"cash",label:"Cash & Savings",color:"#22c55e",icon:"dollar"},
      {id:"bonds",label:"Bonds & Fixed Income",color:"#6b7280",icon:"overview"},
      {id:"valuables",label:"Valuables & Collectibles",color:"#ec4899",icon:"shield",manual:true},
      {id:"royalties",label:"Royalties & IP",color:"#a78bfa",icon:"book",manual:true},
      {id:"other",label:"Other Assets",color:"#94a3b8",icon:"folder"},
    ];
    var ATYPES_MAP={};ATYPES.forEach(function(t){ATYPES_MAP[t.id]=t});

    var LTYPES=[
      {id:"mortgage",label:"Mortgage",color:K.red,icon:"moat"},
      {id:"car_loan",label:"Car Loan",color:"#f97316",icon:"trending"},
      {id:"student_loan",label:"Student Loan",color:"#f59e0b",icon:"journal"},
      {id:"credit_card",label:"Credit Card",color:"#ef4444",icon:"overview"},
      {id:"other_debt",label:"Other Debt",color:"#94a3b8",icon:"folder"},
    ];
    var LTYPES_MAP={};LTYPES.forEach(function(t){LTYPES_MAP[t.id]=t});

    var CRYPTO_IDS={BTC:"bitcoin",ETH:"ethereum",SOL:"solana",BNB:"binancecoin",ADA:"cardano",XRP:"ripple",DOGE:"dogecoin",MATIC:"matic-network",POL:"matic-network",DOT:"polkadot",AVAX:"avalanche-2",LINK:"chainlink",UNI:"uniswap",LTC:"litecoin",ATOM:"cosmos",ALGO:"algorand",SHIB:"shiba-inu",NEAR:"near",ARB:"arbitrum",OP:"optimism",INJ:"injective-protocol",SUI:"sui",APT:"aptos",TON:"the-open-network",PEPE:"pepe",WIF:"dogwifcoin"};
    var COMMODITY_MAP={GOLD:"XAUUSD",XAU:"XAUUSD",SILVER:"XAGUSD",XAG:"XAGUSD",OIL:"CLUSD",CRUDE:"CLUSD",PLATINUM:"XPTUSD",PALLADIUM:"XPDUSD"};

    useEffect(function(){
      async function fetchFx(){
        if(currency==="USD"){setLocalFx({USD:1});return}
        try{
          var r=await fetch("https://api.exchangerate-api.com/v4/latest/USD");
          var d=await r.json();
          if(d&&d.rates){setLocalFx(d.rates)}
        }catch(e){setLocalFx({})}
      }
      fetchFx();
    },[currency]);

    var fxRate=(currency==="USD")?1:(localFx[currency]||fxRates[currency]||1);
    function toDisplay(v){return v*fxRate}
    function fmtM(v){
      if(!v||isNaN(v))return cSym+"0";
      var dv=toDisplay(Math.abs(v));
      var s=dv>=1e6?(dv/1e6).toFixed(2)+"M":dv>=1e3?(dv/1e3).toFixed(1)+"K":dv.toFixed(0);
      return(v<0?"-":"")+cSym+s;
    }

    // Portfolio values
    var portCos=cos.filter(function(c){return(c.status||"portfolio")==="portfolio"});
    var portValue=portCos.reduce(function(s,c){var p=c.position||{};return p.shares>0&&p.currentPrice>0?s+p.shares*p.currentPrice:s},0);
    var portCost=portCos.reduce(function(s,c){var p=c.position||{};return p.shares>0&&p.avgCost>0?s+p.shares*p.avgCost:s},0);

    function getAssetValue(a){
      if(a.type==="portfolio2") return(a.holdings||[]).reduce(function(s,h){var px=livePrices["FMP_"+h.ticker]||h.currentPrice||h.avgCost||0;return s+h.shares*px},0);
      if(a.type==="gold"&&a.ticker&&a.quantity){
        var gt=a.ticker.toUpperCase();var gkey=COMMODITY_MAP[gt]?gt:(gt||"GOLD");
        var gp=livePrices["FMP_"+gkey]||livePrices["FMP_XAUUSD"]||0;
        return gp?a.quantity*gp:Number(a.costBasis)||0;
      }
      if(a.type==="etf"&&a.ticker&&a.quantity){var lp=livePrices["FMP_"+a.ticker.toUpperCase()];return lp?a.quantity*lp:Number(a.costBasis)||0}
      if(a.type==="crypto"&&a.ticker&&a.quantity){var cp=livePrices["CG_"+a.ticker.toUpperCase()];return cp?a.quantity*cp:Number(a.costBasis)||0}
      return Number(a.manualValue)||0;
    }
    function getAssetCost(a){
      if(a.type==="portfolio2") return(a.holdings||[]).reduce(function(s,h){return s+h.shares*h.avgCost},0);
      return Number(a.costBasis)||0;
    }

    var _lastRefresh=useState(null),lastRefresh=_lastRefresh[0],setLastRefresh=_lastRefresh[1];

    async function refreshLivePrices(){
      setFetching(true);
      var fmpTickers=[];var cgTickers=[];var commodityTickers=[];
      otherAssets.forEach(function(a){
        if(a.type==="crypto"&&a.ticker){cgTickers.push(a.ticker.toUpperCase());return}
        if(a.type==="gold"&&a.ticker){
          var t=a.ticker.toUpperCase();
          if(COMMODITY_MAP[t])commodityTickers.push(t);
          else if(t==="GLD"||t==="SLV"||t==="IAU"||t==="PPLT")fmpTickers.push(t);
          else{commodityTickers.push("GOLD");} // default gold
          return;
        }
        if(a.type==="etf"&&a.ticker)fmpTickers.push(a.ticker.toUpperCase());
        if(a.type==="portfolio2")(a.holdings||[]).forEach(function(h){if(h.ticker)fmpTickers.push(h.ticker.toUpperCase())});
      });
      fmpTickers=[...new Set(fmpTickers)];cgTickers=[...new Set(cgTickers)];commodityTickers=[...new Set(commodityTickers)];
      var newPrices=Object.assign({},livePrices);
      // FMP equities + ETFs
      if(fmpTickers.length>0){
        try{
          var results=await Promise.all((fmpTickers||[]).map(function(t){return fmp("quote/"+t)}));
          fmpTickers.forEach(function(t,i){var d=results[i];if(d&&d[0]){newPrices["FMP_"+t]=d[0].price||0;newPrices["CHG_"+t]=d[0].changesPercentage||0}});
        }catch(e){}
      }
      // FMP commodities (XAUUSD etc.)
      if(commodityTickers.length>0){
        try{
          var comResults=await Promise.all((commodityTickers||[]).map(function(t){var sym=COMMODITY_MAP[t]||"XAUUSD";return fmp("quote/"+sym)}));
          commodityTickers.forEach(function(t,i){var d=comResults[i];if(d&&d[0]){var sym=COMMODITY_MAP[t]||"XAUUSD";newPrices["FMP_"+t]=d[0].price||0;newPrices["CHG_"+t]=d[0].changesPercentage||0;newPrices["FMP_"+sym]=d[0].price||0}});
        }catch(e){}
      }
      // CoinGecko for crypto
      if(cgTickers.length>0){
        try{
          var cgIds=(cgTickers||[]).map(function(t){return CRYPTO_IDS[t]||t.toLowerCase()}).filter(Boolean).join(",");
          var resp=await fetch("https://api.coingecko.com/api/v3/simple/price?ids="+cgIds+"&vs_currencies=usd&include_24hr_change=true");
          var cgData=await resp.json();
          cgTickers.forEach(function(t){var id=CRYPTO_IDS[t]||t.toLowerCase();if(cgData[id]){newPrices["CG_"+t]=cgData[id].usd;newPrices["CHG_"+t]=cgData[id].usd_24h_change||0}});
        }catch(e){}
      }
      setLivePrices(newPrices);setLastRefresh(new Date());setFetching(false);
    }

    useEffect(function(){if(otherAssets.length>0)refreshLivePrices()},[otherAssets.length]);

    // Totals
    var otherValue=otherAssets.reduce(function(s,a){return s+getAssetValue(a)},0);
    var totalAssetsUSD=portValue+otherValue;
    var totalLiabUSD=liabilities.reduce(function(s,l){return s+Number(l.balance||0)},0);
    var totalValueUSD=totalAssetsUSD-totalLiabUSD;
    var totalCostUSD=portCost+otherAssets.reduce(function(s,a){return s+getAssetCost(a)},0);
    var totalGainUSD=totalAssetsUSD-totalCostUSD;
    var totalGainPct=totalCostUSD>0?totalGainUSD/totalCostUSD*100:0;

    // Auto-log snapshot
    useEffect(function(){
      if(!loaded||totalValueUSD<=0)return;
      var today=new Date().toISOString().slice(0,10);
      var last=netWorthHistory.length>0?netWorthHistory[netWorthHistory.length-1]:null;
      if(last&&last.date===today)return;
      var next=netWorthHistory.concat([{date:today,value:totalValueUSD}]).slice(-365);
      setNetWorthHistory(next);
    },[loaded,page]);

    // Allocation
    var allocData=[];
    if(portValue>0) allocData.push({label:"Stock Portfolio",value:portValue,color:K.acc,id:"stocks"});
    ATYPES.forEach(function(t){
      var val=otherAssets.filter(function(a){return a.type===t.id}).reduce(function(s,a){return s+getAssetValue(a)},0);
      if(val>0) allocData.push({label:t.label,value:val,color:t.color,id:t.id});
    });

    // Income
    var stockIncome=portCos.reduce(function(s,c){
      var p=c.position||{};if(!p.shares||p.shares<=0)return s;
      var dps=c.divPerShare||c.lastDiv||0;
      var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
      return s+dps*mult*p.shares;
    },0);
    var otherIncome=otherAssets.reduce(function(s,a){return s+Number(a.annualIncome||0)},0);
    var totalIncomeUSD=stockIncome+otherIncome;
    var incomeYield=totalAssetsUSD>0?totalIncomeUSD/totalAssetsUSD*100:0;

    // Dividend-paying stocks for income tab
    var incomeCos=portCos.filter(function(c){
      var p=c.position||{};var dps=c.divPerShare||c.lastDiv||0;return dps>0&&p.shares>0;
    }).map(function(c){
      var p=c.position||{};var dps=c.divPerShare||c.lastDiv||0;
      var mult=c.divFrequency==="monthly"?12:c.divFrequency==="semi"?2:c.divFrequency==="annual"?1:4;
      var annual=dps*mult*p.shares;
      return{c:c,annual:annual,monthly:annual/12,yld:p.currentPrice>0?dps*mult/p.currentPrice*100:0,freq:c.divFrequency||"quarterly"};
    }).sort(function(a,b){return b.annual-a.annual});

    // Monthly income calendar — spread by frequency
    // Each source has: {label, annual, monthly, freq, color, type}
    var MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var incomeBreakdown=[];
    // Stock dividends
    incomeCos.forEach(function(item){incomeBreakdown.push({label:item.c.ticker,annual:item.annual,monthly:item.annual/12,freq:item.freq,color:K.acc,type:"stock"})});
    // ETF dividends (via annualIncome field or yield estimate)
    otherAssets.filter(function(a){return a.type==="etf"&&a.annualIncome>0}).forEach(function(a){
      var freq=a.divFrequency||"quarterly";
      incomeBreakdown.push({label:a.ticker||a.name,annual:Number(a.annualIncome),monthly:Number(a.annualIncome)/12,freq:freq,color:"#10b981",type:"etf"})
    });
    // Bonds — typically semi-annual
    otherAssets.filter(function(a){return a.type==="bonds"&&a.annualIncome>0}).forEach(function(a){
      incomeBreakdown.push({label:a.name||"Bond",annual:Number(a.annualIncome),monthly:Number(a.annualIncome)/12,freq:a.divFrequency||"semi",color:"#6b7280",type:"bonds"})
    });
    // Royalties — steady monthly
    otherAssets.filter(function(a){return a.type==="royalties"&&a.annualIncome>0}).forEach(function(a){
      incomeBreakdown.push({label:a.name||"Royalty",annual:Number(a.annualIncome),monthly:Number(a.annualIncome)/12,freq:"monthly",color:"#a78bfa",type:"royalties"})
    });
    // Real estate rental
    otherAssets.filter(function(a){return a.type==="real_estate"&&a.annualIncome>0}).forEach(function(a){
      incomeBreakdown.push({label:a.name||"Property",annual:Number(a.annualIncome),monthly:Number(a.annualIncome)/12,freq:"monthly",color:"#8b5cf6",type:"real_estate"})
    });
    // Everything else with income
    otherAssets.filter(function(a){return["etf","bonds","royalties","real_estate"].indexOf(a.type)<0&&a.annualIncome>0}).forEach(function(a){
      var atp2=ATYPES.find(function(t){return t.id===a.type})||{color:K.dim};
      incomeBreakdown.push({label:a.name||a.ticker||"Other",annual:Number(a.annualIncome),monthly:Number(a.annualIncome)/12,freq:"monthly",color:atp2.color,type:a.type})
    });
    var monthlyIncome=Array(12).fill(0);
    // Per-month breakdown for tooltip
    var monthlyDetail=Array.from({length:12},function(){return[]});
    incomeBreakdown.forEach(function(item){
      var months=[];
      if(item.freq==="monthly"){for(var m=0;m<12;m++)months.push([m,item.monthly])}
      else if(item.freq==="quarterly"){[2,5,8,11].forEach(function(m){months.push([m,item.monthly*3])})}
      else if(item.freq==="semi"){[5,11].forEach(function(m){months.push([m,item.monthly*6])})}
      else if(item.freq==="annual"){months.push([11,item.annual])}
      else{[2,5,8,11].forEach(function(m){months.push([m,item.monthly*3])})}
      months.forEach(function(pair){monthlyIncome[pair[0]]+=pair[1];monthlyDetail[pair[0]].push({label:item.label,val:pair[1],color:item.color})});
    });
    var maxMonthIncome=Math.max.apply(null,monthlyIncome)||1;
    var totalOtherIncome=incomeBreakdown.filter(function(x){return x.type!=="stock"}).reduce(function(s,x){return s+x.annual},0);

    // Donut
    function donutPath(startDeg,endDeg,r,cx,cy){
      function pt(deg){var rad=(deg-90)*Math.PI/180;return{x:(cx+r*Math.cos(rad)).toFixed(2),y:(cy+r*Math.sin(rad)).toFixed(2)}}
      var s=pt(startDeg),e=pt(endDeg),large=endDeg-startDeg>180?1:0;
      return"M "+s.x+" "+s.y+" A "+r+" "+r+" 0 "+large+" 1 "+e.x+" "+e.y;
    }
    var donutR=56,donutCx=75,donutCy=75,donutSW=18,donutCum=0;
    var donutSegments=(allocData||[]).map(function(d){
      var frac=totalAssetsUSD>0?d.value/totalAssetsUSD:0;
      var startDeg=donutCum*360;donutCum+=frac;
      return{d:d,frac:frac,startDeg:startDeg,endDeg:Math.max(startDeg+0.5,donutCum*360-1.5)};
    });

    // Asset type helpers
    var ALL_ALLOC_IDS=["stocks"].concat(ATYPES.map(function(t){return t.id}));
    var ALLOC_LABELS={stocks:"Stock Portfolio",real_estate:"Real Estate",etf:"ETFs & Funds",gold:"Gold & Metals",crypto:"Crypto",portfolio2:"2nd Portfolio",cash:"Cash & Savings",bonds:"Bonds",valuables:"Valuables",royalties:"Royalties",other:"Other"};
    var ALLOC_COLORS={stocks:K.acc,real_estate:"#8b5cf6",etf:"#10b981",gold:"#f59e0b",crypto:"#f97316",portfolio2:"#06b6d4",cash:"#22c55e",bonds:"#6b7280",valuables:"#ec4899",royalties:"#a78bfa",other:"#94a3b8"};
    function getCurrentPct(id){
      if(totalAssetsUSD<=0)return 0;
      if(id==="stocks")return portValue/totalAssetsUSD*100;
      return otherAssets.filter(function(a){return a.type===id}).reduce(function(s,a){return s+getAssetValue(a)},0)/totalAssetsUSD*100;
    }
    function getTargetPct(id){return Number(assetTargets[id])||0}
    function getDrift(id){return getCurrentPct(id)-getTargetPct(id)}

    // Modal helpers
    var inputStyle={width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,color:K.txt,padding:"9px 12px",fontSize:13,fontFamily:fm,outline:"none",boxSizing:"border-box"};
    var secLabel={fontSize:11,letterSpacing:1,textTransform:"uppercase",color:K.dim,fontWeight:600,fontFamily:fb,marginBottom:6,display:"block"};

    function openAdd(type){setForm({type:type,name:"",ticker:"",quantity:"",costBasis:"",manualValue:"",annualIncome:"",divFrequency:type==="bonds"?"semi":"quarterly"});setStep(1);setModal("add")}
    function openEdit(a){setForm(Object.assign({},a));setModal("edit")}
    function saveAsset(){
      var a=Object.assign({},form);
      if(!a.id)a.id="oa_"+Date.now();
      ["quantity","costBasis","manualValue","annualIncome"].forEach(function(k){if(a[k])a[k]=Number(a[k])});
      if(!a.holdings)a.holdings=[];
      setOtherAssets(modal==="edit"?(otherAssets||[]).map(function(x){return x.id===a.id?a:x}):otherAssets.concat([a]));
      setModal(null);setForm({});setStep(0);
    }
    function deleteAsset(id){setOtherAssets(otherAssets.filter(function(a){return a.id!==id}))}

    function addP2Holding(){
      var t=p2form.ticker.toUpperCase().trim();if(!t||!p2form.shares||!p2form.avgCost)return;
      setForm(Object.assign({},form,{holdings:(form.holdings||[]).concat([{id:"h_"+Date.now(),ticker:t,name:p2form.name||t,shares:Number(p2form.shares),avgCost:Number(p2form.avgCost)}])}));
      setP2form({ticker:"",name:"",shares:"",avgCost:""});
    }
    function removeP2Holding(hid){setForm(Object.assign({},form,{holdings:(form.holdings||[]).filter(function(h){return h.id!==hid})}))}

    function openAddLiab(type){setLform({type:type,name:"",balance:"",interestRate:"",monthlyPayment:""});setLmodal("add")}
    function openEditLiab(l){setLform(Object.assign({},l));setLmodal("edit")}
    function saveLiab(){
      var l=Object.assign({},lform);
      if(!l.id)l.id="li_"+Date.now();
      ["balance","interestRate","monthlyPayment"].forEach(function(k){if(l[k])l[k]=Number(l[k])});
      setLiabilities(lmodal==="edit"?(liabilities||[]).map(function(x){return x.id===l.id?l:x}):liabilities.concat([l]));
      setLmodal(null);setLform({});
    }
    function deleteLiab(id){setLiabilities(liabilities.filter(function(l){return l.id!==id}))}

    var atype=ATYPES.find(function(t){return t.id===form.type})||{};

    // NW History sparkline in header card
    function MiniSparkline(){
      var hist=netWorthHistory.slice(-30);
      if(hist.length<2)return null;
      var vals=(hist||[]).map(function(h){return toDisplay(h.value)});
      var minV=Math.min.apply(null,vals);var maxV=Math.max.apply(null,vals);
      if(maxV===minV)return null;
      var W=160,H=40;
      var pts=(vals||[]).map(function(v,i){return(i/(vals.length-1)*W).toFixed(1)+","+(H-(v-minV)/(maxV-minV)*H).toFixed(1)}).join(" ");
      var clr=vals[vals.length-1]>=vals[0]?K.grn:K.red;
      return<svg width={W} height={H} style={{flexShrink:0}}><polyline points={pts} fill="none" stroke={clr} strokeWidth={1.5} strokeLinejoin="round" opacity={0.8}/></svg>;
    }

    return<div style={{padding:isMobile?"0 16px 80px":"0 32px 60px",maxWidth:1000}}>

      {/* ── Header ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:isMobile?"20px 0 20px":"28px 0 20px"}}>
        <div>
          <div style={{fontSize:isMobile?20:26,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:4}}>Net Worth</div>
          <div style={{fontSize:13,color:K.dim}}>{portCos.length} stocks · {otherAssets.length} assets · {liabilities.length} liabilities{currency!=="USD"&&fxRate!==1?" · FX live":""}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={function(){setLmodal("pick")}} style={{padding:"9px 14px",borderRadius:_isBm?0:10,border:"1px solid "+K.red+"50",background:K.red+"0d",color:K.red,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:fm}}>+ Liability</button>
          <button onClick={function(){setStep(0);setModal("add")}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:_isBm?0:10,border:"none",background:K.acc,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:fm}}><IC name="plus" size={14} color="#fff"/>Add Asset</button>
        </div>
      </div>

      {/* ── Summary card ── */}
      <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:16,padding:isMobile?"20px":"24px 32px",marginBottom:16}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:24,alignItems:"center"}}>
          {/* Donut */}
          <div style={{flexShrink:0}}>
            <svg width={150} height={150}>
              {allocData.length===0&&<circle cx={donutCx} cy={donutCy} r={donutR} fill="none" stroke={K.bdr} strokeWidth={donutSW}/>}
              {(donutSegments||[]).map(function(seg){return<path key={seg.d.id} d={donutPath(seg.startDeg,seg.endDeg,donutR,donutCx,donutCy)} fill="none" stroke={seg.d.color} strokeWidth={donutSW} strokeLinecap="butt"/>})}
              <text x={donutCx} y={donutCy-10} textAnchor="middle" fontSize={9} fill={K.dim} fontFamily={fb} letterSpacing="0.5">NET WORTH</text>
              <text x={donutCx} y={donutCy+6} textAnchor="middle" fontSize={13} fill={K.txt} fontWeight={700} fontFamily={fm}>{fmtM(totalValueUSD)}</text>
              {totalLiabUSD>0&&<text x={donutCx} y={donutCy+18} textAnchor="middle" fontSize={8} fill={K.red} fontFamily={fb}>−{fmtM(totalLiabUSD)} debt</text>}
            </svg>
          </div>
          {/* Stats grid */}
          <div style={{flex:1,minWidth:180}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px 24px",marginBottom:16}}>
              {[
                {label:"Total Assets",val:fmtM(totalAssetsUSD),color:K.txt},
                {label:"Total Liabilities",val:fmtM(totalLiabUSD),color:totalLiabUSD>0?K.red:K.dim},
                {label:"Unrealised Gain",val:(totalGainUSD>=0?"+":"")+fmtM(totalGainUSD)+" ("+totalGainPct.toFixed(1)+"%)",color:totalGainUSD>=0?K.grn:K.red},
                {label:"Annual Income",val:fmtM(totalIncomeUSD)+" ("+incomeYield.toFixed(2)+"%)",color:K.grn},
              ].map(function(s){return<div key={s.label}>
                <div style={{fontSize:10,color:K.dim,fontFamily:fb,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{s.label}</div>
                <div style={{fontSize:15,fontWeight:700,color:s.color,fontFamily:fm}}>{s.val}</div>
              </div>})}
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px 14px"}}>
              {(allocData||[]).map(function(d){var pct=totalAssetsUSD>0?(d.value/totalAssetsUSD*100):0;return<div key={d.id} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:8,height:8,borderRadius:_isBm?0:2,background:d.color,flexShrink:0}}/>
                <span style={{fontSize:11,color:K.mid,fontFamily:fb}}>{d.label}</span>
                <span style={{fontSize:11,fontWeight:600,color:K.txt,fontFamily:fm}}>{pct.toFixed(1)}%</span>
              </div>})}
            </div>
          </div>
          {/* Sparkline + refresh */}
          <div style={{display:"flex",flexDirection:"column",gap:12,alignSelf:"flex-start",alignItems:"flex-end"}}>
            <MiniSparkline/>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <button onClick={refreshLivePrices} disabled={fetching} style={{padding:"6px 12px",borderRadius:_isBm?0:8,border:"1px solid "+K.bdr,background:"transparent",color:fetching?K.acc:K.dim,fontSize:11,cursor:"pointer",fontFamily:fb,display:"flex",alignItems:"center",gap:5}}>
                {fetching?<span style={{display:"inline-block",width:10,height:10,border:"1.5px solid "+K.bdr,borderTopColor:K.acc,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>:<IC name="gear" size={12} color={K.dim}/>}
                {fetching?"Refreshing…":"Refresh prices"}
              </button>
              {lastRefresh&&<div style={{fontSize:9,color:K.dim,fontFamily:fb}}>Updated {lastRefresh.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid "+K.bdr}}>
        {[["overview","Overview","bar"],["history","History","chart"],["income","Income","dollar"],["targets","Allocation","target"]].map(function(tb){
          var active=nwTab===tb[0];
          return<button key={tb[0]} onClick={function(){setNwTab(tb[0])}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 14px",borderRadius:_isBm?"0":"8px 8px 0 0",border:"1px solid "+(active?K.bdr:"transparent"),borderBottom:active?"1px solid "+K.card:"none",background:active?K.card:"transparent",color:active?K.txt:K.dim,fontSize:13,fontWeight:active?600:400,cursor:"pointer",fontFamily:fm,marginBottom:active?-1:0}}>
            <IC name={tb[2]} size={14} color={active?K.txt:K.dim}/>{tb[1]}
          </button>;
        })}
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {nwTab==="overview"&&<div>
        {/* ── Conviction/Position Alignment Banner ── */}
        {(function(){
          if(portCos.length<2)return null;
          var signals=calcAlignmentSignals(portCos);
          if(signals.mismatches.length===0&&signals.flags.length===0)return null;
          return<AlignmentWidget
            signals={signals}
            compact={true}
            onAI={function(item){
              var FRAMING_MAP={
                challenge:{why:"This prompt feeds the AI your specific thesis arguments and asks it to attack them using your own words.",dataPoints:["Your thesis","Conviction history","KPIs","Decisions log"]},
                sell:{why:"Takes your sell criteria — written when calm — and asks whether they have actually been triggered.",dataPoints:["Your sell criteria","Recent decisions","Journal entries","Conviction trajectory"]},
                annual:{why:"Uses your own conviction trajectory and decisions to ask if you should still own this.",dataPoints:["Conviction history","Decisions log","Journal entries","Original thesis"]},
              };
              var fr=FRAMING_MAP[item.aiType]||FRAMING_MAP["challenge"];
              setAiModal({title:(item.aiType==="sell"?"Sell Discipline Check":item.aiType==="annual"?"Annual Review":"Challenge My Thesis")+" — "+item.ticker,framing:fr,prompt:buildPrompt(item.aiType,item.c)});
            }}
            onGo={function(c){setSelId(c.id);setDetailTab("dossier");setPage("dashboard");}}
            onSellCheck={function(c){setSellCheckTgt(c)}}
          />;
        })()}
        {/* Main stock portfolio */}
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,marginBottom:12,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",cursor:"pointer"}} onClick={function(){setExpanded(Object.assign({},expanded,{stocks:!expanded.stocks}))}}>
            <IC name="trending" size={14} color={K.acc}/>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>Stock Portfolio</div>
              <div style={{fontSize:12,color:K.dim,fontFamily:fb,marginTop:2}}>{portCos.length} holdings</div>
            </div>
            <div style={{textAlign:"right",marginRight:12}}>
              <div style={{fontSize:15,fontWeight:700,color:K.txt,fontFamily:fm}}>{fmtM(portValue)}</div>
              {portCost>0&&<div style={{fontSize:12,color:portValue>=portCost?K.grn:K.red,fontFamily:fb}}>{portValue>=portCost?"+":""}{((portValue-portCost)/portCost*100).toFixed(1)}%</div>}
            </div>
            <IC name={expanded.stocks?"alert":"plus"} size={12} color={K.dim}/>
          </div>
          {expanded.stocks&&<div style={{borderTop:"1px solid "+K.bdr}}>
            {portCos.length===0&&<div style={{padding:"20px",textAlign:"center",color:K.dim,fontSize:13}}>No portfolio positions yet.</div>}
            {(portCos||[]).map(function(c){
              var p=c.position||{};var val=p.shares>0&&p.currentPrice>0?p.shares*p.currentPrice:null;
              var ret=p.shares>0&&p.avgCost>0&&p.currentPrice>0?((p.currentPrice-p.avgCost)/p.avgCost*100):null;
              var pct=val&&totalAssetsUSD>0?val/totalAssetsUSD*100:null;
              var todayChg=c._moatCache&&c._moatCache.priceChange!==undefined?c._moatCache.priceChange:null;
              return<div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 20px",borderBottom:"1px solid "+K.bdr+"50",cursor:"pointer"}} onClick={function(){setSelId(c.id);setPage("dashboard")}}>
                <CoLogo ticker={c.ticker} domain={c.domain} size={28}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{c.ticker}</span>{todayChg!==null&&<span style={{fontSize:10,color:todayChg>=0?K.grn:K.red,background:(todayChg>=0?K.grn:K.red)+"12",padding:"1px 6px",borderRadius:_isBm?0:4,fontFamily:fm,fontWeight:600}}>{todayChg>=0?"+":""}{todayChg.toFixed(2)}%</span>}</div>
                  <div style={{fontSize:11,color:K.dim,fontFamily:fb,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                </div>
                {pct!==null&&<div style={{fontSize:11,color:K.dim,fontFamily:fb,minWidth:36,textAlign:"right"}}>{pct.toFixed(1)}%</div>}
                {(function(){
                  var conv=c.conviction||0;if(!conv)return null;
                  var cc=conv>=8?K.grn:conv>=5?K.amb:K.red;
                  var portVal2=portCos.reduce(function(s,pc){var pp=pc.position||{};return pp.shares>0&&pp.currentPrice>0?s+pp.shares*pp.currentPrice:s},0);
                  var myVal2=c.position&&c.position.shares>0&&c.position.currentPrice>0?c.position.shares*c.position.currentPrice:0;
                  var myPct2=portVal2>0?myVal2/portVal2*100:0;
                  var sumConv2=portCos.reduce(function(s,pc){return s+(pc.conviction||1)},0);
                  var idealPct2=sumConv2>0?(conv||1)/sumConv2*100:0;
                  var drift2=myPct2-idealPct2;
                  var showDrift=Math.abs(drift2)>5&&myPct2>0;
                  return<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:38}}>
                    <div style={{fontSize:11,fontWeight:700,color:cc,fontFamily:fm,background:cc+"15",borderRadius:_isBm?0:4,padding:"1px 6px",whiteSpace:"nowrap"}}>{conv}/10</div>
                    {showDrift&&<div style={{fontSize:9,color:drift2>0?K.red:K.grn,fontFamily:fb,whiteSpace:"nowrap"}}>{drift2>0?"↑ over":"↓ under"}</div>}
                  </div>;
                })()}
                {val!==null&&<div style={{textAlign:"right",minWidth:70}}>
                  <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{fmtM(val)}</div>
                  {ret!==null&&<div style={{fontSize:11,color:ret>=0?K.grn:K.red,fontFamily:fb}}>{ret>=0?"+":""}{ret.toFixed(1)}%</div>}
                </div>}
              </div>;
            })}
          </div>}
        </div>

        {/* Other asset sections */}
        {(ATYPES||[]).map(function(atp){
          var assets=otherAssets.filter(function(a){return a.type===atp.id});
          var totalTypeVal=assets.reduce(function(s,a){return s+getAssetValue(a)},0);
          var totalTypeCost=assets.reduce(function(s,a){return s+getAssetCost(a)},0);
          var isOpen=expanded[atp.id];
          return<div key={atp.id} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,marginBottom:12,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",cursor:"pointer"}} onClick={function(){setExpanded(Object.assign({},expanded,{[atp.id]:!isOpen}))}}>
              <IC name={atp.icon} size={14} color={atp.color}/>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{atp.label}</div>
                <div style={{fontSize:12,color:K.dim,fontFamily:fb,marginTop:2}}>{assets.length} asset{assets.length!==1?"s":""}</div>
              </div>
              {totalTypeVal>0&&<div style={{textAlign:"right",marginRight:12}}>
                <div style={{fontSize:15,fontWeight:700,color:K.txt,fontFamily:fm}}>{fmtM(totalTypeVal)}</div>
                {totalTypeCost>0&&<div style={{fontSize:12,color:totalTypeVal>=totalTypeCost?K.grn:K.red,fontFamily:fb}}>{totalTypeVal>=totalTypeCost?"+":""}{((totalTypeVal-totalTypeCost)/totalTypeCost*100).toFixed(1)}%</div>}
              </div>}
              <button onClick={function(e){e.stopPropagation();openAdd(atp.id)}} style={{padding:"5px 12px",borderRadius:_isBm?0:7,border:"1px solid "+atp.color+"60",background:atp.color+"12",color:atp.color,fontSize:12,cursor:"pointer",fontFamily:fb,fontWeight:600,flexShrink:0}}>+ Add</button>
              <IC name={isOpen?"alert":"plus"} size={12} color={K.dim}/>
            </div>
            {isOpen&&<div style={{borderTop:"1px solid "+K.bdr}}>
              {assets.length===0&&<div style={{padding:"20px 24px",color:K.dim,fontSize:13,textAlign:"center"}}>No {atp.label.toLowerCase()} added yet. <span style={{color:atp.color,cursor:"pointer"}} onClick={function(){openAdd(atp.id)}}>Add one →</span></div>}
              {(assets||[]).map(function(a){
                var val=getAssetValue(a),cost=getAssetCost(a),gain=val-cost,gainPct=cost>0?gain/cost*100:0;
                var pct=totalAssetsUSD>0?val/totalAssetsUSD*100:0;
                // Live price + day change
                var tk=a.ticker?a.ticker.toUpperCase():"";
                var livePrice=a.type==="crypto"?livePrices["CG_"+tk]:(a.type==="gold"?(livePrices["FMP_"+(COMMODITY_MAP[tk]?tk:"GOLD")]||livePrices["FMP_XAUUSD"]):livePrices["FMP_"+tk])||0;
                var dayChg=livePrices["CHG_"+tk]||0;
                var hasLive=livePrice>0;
                var allocPct=totalAssetsUSD>0?val/totalAssetsUSD*100:0;
                return<div key={a.id} style={{padding:"12px 20px",borderBottom:"1px solid "+K.bdr+"50"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <IC name={atp.icon} size={14} color={atp.color}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{a.name||a.ticker||"—"}</div>
                        {tk&&a.type!=="portfolio2"&&<span style={{fontSize:10,background:atp.color+"15",color:atp.color,padding:"1px 6px",borderRadius:_isBm?0:4,fontFamily:fm,fontWeight:600}}>{tk}</span>}
                        {hasLive&&<span style={{fontSize:10,color:dayChg>=0?K.grn:K.red,background:(dayChg>=0?K.grn:K.red)+"12",padding:"1px 7px",borderRadius:_isBm?0:4,fontFamily:fm,fontWeight:600}}>{dayChg>=0?"+":""}{dayChg.toFixed(2)}% today</span>}
                      </div>
                      <div style={{fontSize:11,color:K.dim,fontFamily:fb,marginTop:3,display:"flex",alignItems:"center",gap:8}}>
                        {a.type==="portfolio2"&&<span>{(a.holdings||[]).length} holdings</span>}
                        {(a.type==="etf"||a.type==="gold")&&a.quantity&&<span>{a.quantity.toLocaleString()} {a.type==="gold"?"oz":"units"}{hasLive?" @ "+cSym+livePrice.toLocaleString("en-US",{maximumFractionDigits:2}):""}</span>}
                        {a.type==="crypto"&&a.quantity&&<span>{a.quantity.toLocaleString()} {tk}{hasLive?" @ "+cSym+livePrice.toLocaleString("en-US",{maximumFractionDigits:2}):""}</span>}
                        {a.annualIncome>0&&<span style={{color:K.grn}}>{fmtM(a.annualIncome)}/yr</span>}
                        {!hasLive&&(a.type==="etf"||a.type==="gold"||a.type==="crypto")&&tk&&<span style={{color:K.amb}}>⚠ No live price — check ticker</span>}
                      </div>
                    </div>
                    {/* Allocation bar + % */}
                    {allocPct>0&&<div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,minWidth:52}}>
                      <div style={{fontSize:11,color:K.dim,fontFamily:fb}}>{allocPct.toFixed(1)}%</div>
                      <div style={{width:52,height:3,borderRadius:_isBm?0:2,background:K.bdr,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,allocPct/Math.max(...(allocData||[]).map(function(d){return totalAssetsUSD>0?d.value/totalAssetsUSD*100:0}),1)*100)+"%",background:atp.color,borderRadius:_isBm?0:2}}/></div>
                    </div>}
                    <div style={{textAlign:"right",minWidth:80}}>
                      <div style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>{fmtM(val)}</div>
                      {cost>0&&val>0&&<div style={{fontSize:11,color:gain>=0?K.grn:K.red,fontFamily:fb}}>{gain>=0?"+":""}{fmtM(gain)} ({gainPct>=0?"+":""}{gainPct.toFixed(1)}%)</div>}
                      {!cost&&hasLive&&<div style={{fontSize:10,color:K.dim,fontFamily:fb}}>Live</div>}
                    </div>
                    <div style={{display:"flex",gap:5,flexShrink:0}}>
                      <button onClick={function(){openEdit(a)}} style={{padding:"4px 9px",borderRadius:_isBm?0:6,border:"1px solid "+K.bdr,background:"transparent",color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fb}}>Edit</button>
                      <button onClick={function(){if(window.confirm("Remove this asset?"))deleteAsset(a.id)}} style={{padding:"4px 9px",borderRadius:_isBm?0:6,border:"1px solid "+K.red+"40",background:"transparent",color:K.red,fontSize:11,cursor:"pointer",fontFamily:fb}}>✕</button>
                    </div>
                  </div>
                </div>;
              })}
            </div>}
          </div>;
        })}

        {/* Liabilities section */}
        <div style={{marginTop:8,marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <IC name="alert" size={14} color={K.red}/>
            <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Liabilities</div>
            <div style={{fontSize:12,color:K.dim,fontFamily:fb,flex:1}}>— {fmtM(totalLiabUSD)} total debt</div>
            <button onClick={function(){setLmodal("pick")}} style={{padding:"5px 12px",borderRadius:_isBm?0:7,border:"1px solid "+K.red+"40",background:K.red+"0d",color:K.red,fontSize:12,cursor:"pointer",fontFamily:fb,fontWeight:600}}>+ Add</button>
          </div>
          {liabilities.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:_isBm?0:12,padding:"20px",textAlign:"center",color:K.dim,fontSize:13}}>
            No liabilities recorded. Add mortgages, loans or credit card balances to see your true net worth.
          </div>}
          {liabilities.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,overflow:"hidden"}}>
            {(liabilities||[]).map(function(l,i){
              var lt=LTYPES_MAP[l.type]||{icon:"overview",color:K.red,label:l.type};
              var annualInt=l.balance>0&&l.interestRate>0?l.balance*l.interestRate/100:0;
              return<div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<liabilities.length-1?"1px solid "+K.bdr+"50":"none"}}>
                <IC name={lt.icon} size={14} color={lt.color}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{l.name||lt.label}</div>
                  <div style={{fontSize:11,color:K.dim,fontFamily:fb,marginTop:2}}>
                    {l.interestRate>0&&<span>{l.interestRate}% interest · </span>}
                    {l.monthlyPayment>0&&<span>{fmtM(l.monthlyPayment)}/mo</span>}
                    {annualInt>0&&<span style={{color:K.red,marginLeft:6}}>{fmtM(annualInt)}/yr interest cost</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",minWidth:80}}>
                  <div style={{fontSize:14,fontWeight:700,color:K.red,fontFamily:fm}}>−{fmtM(l.balance)}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={function(){openEditLiab(l)}} style={{padding:"5px 10px",borderRadius:_isBm?0:6,border:"1px solid "+K.bdr,background:"transparent",color:K.dim,fontSize:11,cursor:"pointer",fontFamily:fb}}>Edit</button>
                  <button onClick={function(){if(window.confirm("Remove this liability?"))deleteLiab(l.id)}} style={{padding:"5px 10px",borderRadius:_isBm?0:6,border:"1px solid "+K.red+"40",background:"transparent",color:K.red,fontSize:11,cursor:"pointer",fontFamily:fb}}>Remove</button>
                </div>
              </div>;
            })}
          </div>}
        </div>
      </div>}

      {/* ══ HISTORY TAB ══ */}
      {nwTab==="history"&&<div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:"24px",marginBottom:16}}>
          {(function(){
            var hist=netWorthHistory.slice(-52);
            if(hist.length<2)return<div style={{padding:"30px 0",textAlign:"center",color:K.dim,fontSize:13}}>Your net worth history will build up as you use the app over time.</div>;
            var vals=(hist||[]).map(function(h){return toDisplay(h.value)});
            var minV=Math.min.apply(null,vals)*0.97,maxV=Math.max.apply(null,vals)*1.03;
            var W=isMobile?300:520,H=160,padL=64,padR=16,padT=12,padB=28;
            var cW=W-padL-padR,cH=H-padT-padB;
            function xPos(i){return padL+(i/(hist.length-1))*cW}
            function yPos(v){return padT+cH-(v-minV)/(maxV-minV)*cH}
            var pts=(hist||[]).map(function(h,i){return xPos(i)+","+yPos(toDisplay(h.value))}).join(" ");
            var areaD="M "+xPos(0)+","+yPos(toDisplay(hist[0].value))+" "+hist.slice(1).map(function(h,i){return"L "+xPos(i+1)+","+yPos(toDisplay(h.value))}).join(" ")+" L "+xPos(hist.length-1)+","+(padT+cH)+" L "+xPos(0)+","+(padT+cH)+" Z";
            var lastVal=vals[vals.length-1],firstVal=vals[0];
            var delta=lastVal-firstVal,deltaPct=firstVal>0?delta/firstVal*100:0;
            // CAGR
            var daysDiff=Math.max(1,(new Date(hist[hist.length-1].date)-new Date(hist[0].date))/(1000*60*60*24));
            var years=daysDiff/365;
            var cagr=years>0.1&&firstVal>0?((Math.pow(lastVal/firstVal,1/years)-1)*100):null;
            var clr=delta>=0?K.grn:K.red;
            var yLabels=[minV,(minV+maxV)/2,maxV];
            function fmtDate(ds){var d=new Date(ds);return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
            return<div>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:11,color:K.dim,fontFamily:fb,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Net worth over time</div>
                  <div style={{fontSize:22,fontWeight:700,color:K.txt,fontFamily:fm}}>{fmtM(totalValueUSD)}</div>
                </div>
                <div style={{display:"flex",gap:20}}>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:K.dim,fontFamily:fb,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Change</div>
                    <div style={{fontSize:15,fontWeight:600,color:clr,fontFamily:fm}}>{delta>=0?"+":""}{fmtM(delta)} ({deltaPct>=0?"+":""}{deltaPct.toFixed(1)}%)</div>
                  </div>
                  {cagr!==null&&<div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:K.dim,fontFamily:fb,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>CAGR</div>
                    <div style={{fontSize:15,fontWeight:600,color:cagr>=0?K.grn:K.red,fontFamily:fm}}>{cagr>=0?"+":""}{cagr.toFixed(1)}%</div>
                  </div>}
                </div>
              </div>
              <div style={{overflowX:"auto"}}>
                <svg width={W} height={H} style={{overflow:"visible"}}>
                  <defs><linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={clr} stopOpacity="0.15"/><stop offset="100%" stopColor={clr} stopOpacity="0.01"/></linearGradient></defs>
                  {(yLabels||[]).map(function(v,i){var y=yPos(v);return<g key={i}><line x1={padL} y1={y} x2={W-padR} y2={y} stroke={K.bdr} strokeWidth={1}/><text x={padL-6} y={y+4} textAnchor="end" fontSize={9} fill={K.dim} fontFamily={fm}>{fmtM(v)}</text></g>})}
                  <path d={areaD} fill="url(#nwGrad)"/>
                  <polyline points={pts} fill="none" stroke={clr} strokeWidth={2} strokeLinejoin="round"/>
                  <circle cx={xPos(hist.length-1)} cy={yPos(lastVal)} r={4} fill={clr}/>
                  {[0,Math.floor((hist.length-1)/2),hist.length-1].map(function(i){return<text key={i} x={xPos(i)} y={H-4} textAnchor="middle" fontSize={9} fill={K.dim} fontFamily={fm}>{fmtDate(hist[i].date)}</text>})}
                </svg>
              </div>
            </div>;
          })()}
        </div>
        {/* Milestone progress */}
        {(function(){
          var milestoneVals=[10000,50000,100000,250000,500000,1000000,2000000,5000000];
          var cur=toDisplay(totalValueUSD);
          var next=milestoneVals.find(function(m){return cur<m});
          var prev=milestoneVals.slice().reverse().find(function(m){return cur>=m});
          if(!next)return null;
          var progress=prev?(cur-prev)/(next-prev)*100:cur/next*100;
          var needed=next-cur;
          function fmtMilestone(m){return cSym+(m>=1e6?m/1e6+"M":m/1000+"K")}
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:"20px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <IC name="target" size={14} color={K.acc}/>
              <div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>Next milestone: {fmtMilestone(next)}</div>
            </div>
            <div style={{fontSize:12,color:K.dim,fontFamily:fb,marginBottom:12}}>{fmtM(needed)} to go · {progress.toFixed(1)}% of the way there</div>
            <div style={{height:8,borderRadius:_isBm?0:4,background:K.bdr,overflow:"hidden"}}>
              <div style={{height:"100%",width:Math.min(100,progress)+"%",borderRadius:_isBm?0:4,background:K.acc,transition:"width .5s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
              <span style={{fontSize:11,color:K.dim,fontFamily:fb}}>{prev?fmtMilestone(prev):"0"}</span>
              <span style={{fontSize:11,color:K.dim,fontFamily:fb}}>{fmtMilestone(next)}</span>
            </div>
          </div>;
        })()}
        {/* ── Did You Know / Wealth wisdom ── */}
        {(function(){
          var now=new Date();var idx=(now.getDate()+now.getMonth()*3)%8;
          var cards=[
            {type:"quote",author:"Charlie Munger",text:"The first $100,000 is a bitch, but you gotta do it. I don't care what you have to do — if it means walking everywhere and not eating anything that wasn't purchased with a coupon, find a way to get your hands on $100,000.",icon:"castle"},
            {type:"fact",title:"Gold's purchasing power",text:"In 1920 you could buy a fine men's suit, a quality meal, and a pair of shoes for one gold coin (roughly 1 oz). Today, one ounce of gold (~$2,000+) still buys exactly that. Stocks and real estate compound — gold preserves.",icon:"shield"},
            {type:"quote",author:"Warren Buffett",text:"Do not save what is left after spending, but spend what is left after saving.",icon:"dollar"},
            {type:"fact",title:"The rule of 72",text:"Divide 72 by your annual return to find how many years it takes to double your money. At 8%: 9 years. At 12%: 6 years. At 6%: 12 years. Compound interest is the eighth wonder of the world.",icon:"trending"},
            {type:"quote",author:"Morgan Housel",text:"Getting money requires taking risks, being optimistic, and putting yourself out there. Keeping money requires the opposite of taking risk. It requires humility, and fear that what you've made can be taken away just as fast.",icon:"shield"},
            {type:"fact",title:"Real estate vs stocks",text:"Over 100 years, US equities have returned ~10% annually vs ~4% for residential real estate. But leverage — a mortgage — can dramatically amplify real estate returns on invested capital.",icon:"moat"},
            {type:"quote",author:"John D. Rockefeller",text:"If you want to be wealthy, think of saving as buying your future self freedom.",icon:"book"},
            {type:"fact",title:"The net worth tipping point",text:"Once your investment income exceeds your living expenses, your wealth compounds whether you work or not. This is the precise moment financial independence begins — not a number, but a ratio.",icon:"target"},
          ];
          var card=cards[idx];
          return<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:"20px 24px",marginTop:12}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{width:32,height:32,borderRadius:_isBm?0:8,background:K.acc+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <IC name={card.icon} size={14} color={K.acc}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,fontWeight:600,color:K.acc,fontFamily:fm,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{card.type==="quote"?"Investor Wisdom":"Did You Know?"}</div>
                {card.title&&<div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm,marginBottom:6}}>{card.title}</div>}
                <div style={{fontSize:13,color:K.mid,lineHeight:1.7,fontStyle:card.type==="quote"?"italic":"normal"}}>{card.type==="quote"?"\u201c"+card.text+"\u201d":card.text}</div>
                {card.author&&<div style={{fontSize:11,color:K.dim,fontFamily:fb,marginTop:6}}>— {card.author}</div>}
              </div>
            </div>
          </div>;
        })()}
      </div>}

      {/* ══ INCOME TAB ══ */}
      {nwTab==="income"&&<div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:12,marginBottom:20}}>
          {[{label:"Annual Income",val:fmtM(totalIncomeUSD)},{label:"Monthly Average",val:fmtM(totalIncomeUSD/12)},{label:"Portfolio Yield",val:incomeYield.toFixed(2)+"%"}].map(function(c){
            return<div key={c.label} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:12,padding:"18px 20px"}}>
              <div style={{fontSize:10,color:K.dim,fontFamily:fb,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{c.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:K.grn,fontFamily:fm}}>{c.val}</div>
            </div>;
          })}
        </div>

        {/* Monthly calendar */}
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,padding:"20px 24px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <IC name="clock" size={14} color={K.dim}/>
            <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>Monthly Income Calendar</div>
            <div style={{fontSize:12,color:K.dim,fontFamily:fb,marginLeft:"auto"}}>based on dividend frequencies</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:4}}>
            {(MONTHS||[]).map(function(m,i){
              var val=monthlyIncome[i];var isNow=new Date().getMonth()===i;
              var barH=val>0?Math.max(8,val/maxMonthIncome*64):3;
              var detail=monthlyDetail[i];
              return<div key={m} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,position:"relative"}} className="ta-month-col">
                <div style={{fontSize:9,color:isNow?K.acc:K.dim,fontFamily:fb,letterSpacing:0.5,fontWeight:isNow?700:400}}>{m}</div>
                <div style={{width:"100%",height:72,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",cursor:val>0?"pointer":"default"}}>
                  <div style={{width:"100%",borderRadius:_isBm?0:4,background:val>0?(isNow?K.acc:K.grn):K.bdr,height:barH,transition:"height .3s",minHeight:3}}/>
                </div>
                <div style={{fontSize:9,color:val>0?K.txt:K.dim,fontFamily:fm,fontWeight:val>0?600:400,textAlign:"center",lineHeight:1.2}}>
                  {val>0?fmtM(val):"—"}
                </div>
                {isNow&&<div style={{width:4,height:4,borderRadius:"50%",background:K.acc}}/>}
                {val>0&&detail.length>0&&<div className="ta-month-tooltip" style={{position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:8,padding:"8px 10px",zIndex:50,minWidth:110,pointerEvents:"none",boxShadow:"0 4px 16px rgba(0,0,0,.15)"}}>
                  <div style={{fontSize:9,color:K.dim,fontFamily:fb,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{m}</div>
                  {detail.slice(0,6).map(function(d,di){return<div key={di} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:10,color:K.mid,fontFamily:fm,marginBottom:2}}>
                    <span style={{color:d.color,fontWeight:600,maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.label}</span>
                    <span style={{color:K.txt,fontWeight:600}}>{fmtM(d.val)}</span>
                  </div>})}
                  {detail.length>6&&<div style={{fontSize:9,color:K.dim,fontFamily:fb}}>+{detail.length-6} more</div>}
                </div>}
              </div>;
            })}
          </div>
        </div>

        {/* Dividend-paying stocks */}
        {incomeCos.length>0&&<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,marginBottom:16,overflow:"hidden"}}>
          <div style={{padding:"16px 20px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><IC name="trending" size={14} color={K.acc}/><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>Stock Dividends</div></div>
            <div style={{fontSize:13,color:K.grn,fontWeight:600,fontFamily:fm}}>{fmtM(stockIncome)}/yr</div>
          </div>
          {(incomeCos||[]).map(function(item){return<div key={item.c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 20px",borderBottom:"1px solid "+K.bdr+"50",cursor:"pointer"}} onClick={function(){setSelId(item.c.id);setPage("dashboard")}}>
            <CoLogo ticker={item.c.ticker} domain={item.c.domain} size={28}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{item.c.ticker}</div>
              <div style={{fontSize:11,color:K.dim,fontFamily:fb}}>{item.freq} · {item.yld.toFixed(2)}% yield</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:600,color:K.grn,fontFamily:fm}}>{fmtM(item.annual)}/yr</div>
              <div style={{fontSize:11,color:K.dim,fontFamily:fb}}>{fmtM(item.monthly)}/mo</div>
            </div>
          </div>})}
        </div>}

        {/* Other income sources — grouped by type */}
        {incomeBreakdown.filter(function(x){return x.type!=="stock"}).length>0&&(function(){
          var groups=[{type:"etf",label:"ETF Dividends",icon:"chart",color:"#10b981"},{type:"bonds",label:"Bond Interest",icon:"overview",color:"#6b7280"},{type:"royalties",label:"Royalties & IP",icon:"book",color:"#a78bfa"},{type:"real_estate",label:"Rental Income",icon:"moat",color:"#8b5cf6"},{type:"other",label:"Other Income",icon:"dollar",color:K.grn},{type:"valuables",label:"Valuables Income",icon:"shield",color:"#ec4899"}];
          return<div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
            {(groups||[]).map(function(g){
              var items=otherAssets.filter(function(a){return a.type===g.type&&a.annualIncome>0});
              if(items.length===0)return null;
              var grpTotal=items.reduce(function(s,a){return s+Number(a.annualIncome)},0);
              return<div key={g.type} style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,overflow:"hidden"}}>
                <div style={{padding:"14px 20px",borderBottom:"1px solid "+K.bdr,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><IC name={g.icon} size={14} color={g.color}/><div style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{g.label}</div></div>
                  <div style={{fontSize:13,color:K.grn,fontWeight:600,fontFamily:fm}}>{fmtM(grpTotal)}/yr</div>
                </div>
                {(items||[]).map(function(a){
                  var freq=a.divFrequency||"monthly";
                  return<div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 20px",borderBottom:"1px solid "+K.bdr+"50"}}>
                    <IC name={g.icon} size={14} color={g.color}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{a.name||a.ticker||g.label}</div>
                      <div style={{fontSize:11,color:K.dim,fontFamily:fb}}>{freq} · {a.ticker&&<span style={{background:g.color+"15",color:g.color,padding:"1px 5px",borderRadius:_isBm?0:3,marginRight:4}}>{a.ticker}</span>}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:600,color:K.grn,fontFamily:fm}}>{fmtM(a.annualIncome)}/yr</div>
                      <div style={{fontSize:11,color:K.dim,fontFamily:fb}}>{fmtM(a.annualIncome/12)}/mo</div>
                    </div>
                  </div>;
                })}
              </div>;
            })}
          </div>;
        })()}

        {incomeCos.length===0&&incomeBreakdown.length===0&&<div style={{background:K.card,border:"1px dashed "+K.bdr,borderRadius:_isBm?0:14,padding:40,textAlign:"center",color:K.dim,fontSize:14}}>
          No income data yet. Stock dividends appear automatically once positions and prices are set. Add rental income, bond interest, or royalties when editing an asset.
        </div>}
      </div>}

      {/* ══ TARGETS TAB ══ */}
      {nwTab==="targets"&&<div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:13,color:K.dim,fontFamily:fb}}>Set your ideal allocation. Flags when you drift more than 5%.</div>
          {!editTgt
            ?<button onClick={function(){setTgtDraft(Object.assign({},assetTargets));setEditTgt(true)}} style={{padding:"7px 14px",borderRadius:_isBm?0:8,border:"1px solid "+K.bdr,background:"transparent",color:K.acc,fontSize:12,cursor:"pointer",fontFamily:fb,fontWeight:600}}>Edit targets</button>
            :<div style={{display:"flex",gap:8}}>
              <button onClick={function(){setEditTgt(false)}} style={{padding:"7px 14px",borderRadius:_isBm?0:8,border:"1px solid "+K.bdr,background:"transparent",color:K.dim,fontSize:12,cursor:"pointer",fontFamily:fb}}>Cancel</button>
              <button onClick={function(){setAssetTargets(Object.assign({},tgtDraft));setEditTgt(false)}} style={{padding:"7px 14px",borderRadius:_isBm?0:8,border:"none",background:K.acc,color:"#fff",fontSize:12,cursor:"pointer",fontFamily:fb,fontWeight:600}}>Save</button>
            </div>}
        </div>
        <div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:_isBm?0:14,overflow:"hidden"}}>
          {(ALL_ALLOC_IDS||[]).map(function(id,i){
            var current=getCurrentPct(id),target=getTargetPct(id),drift=getDrift(id);
            var hasTarget=target>0,bigDrift=Math.abs(drift)>5&&hasTarget;
            var color=ALLOC_COLORS[id]||K.dim;
            return<div key={id} style={{padding:"14px 20px",borderBottom:i<ALL_ALLOC_IDS.length-1?"1px solid "+K.bdr+"50":"none",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:10,height:10,borderRadius:_isBm?0:2,background:color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{ALLOC_LABELS[id]}</span>
                  {bigDrift&&<span style={{fontSize:10,fontWeight:600,background:drift>0?K.amb+"20":K.blue+"20",color:drift>0?K.amb:"#60a5fa",borderRadius:_isBm?0:4,padding:"1px 6px"}}>{drift>0?"Overweight":"Underweight"}</span>}
                </div>
                <div style={{position:"relative",height:6,borderRadius:_isBm?0:3,background:K.bdr,overflow:"hidden"}}>
                  <div style={{position:"absolute",left:0,top:0,height:"100%",width:Math.min(100,current)+"%",borderRadius:_isBm?0:3,background:color,transition:"width .4s"}}/>
                  {hasTarget&&<div style={{position:"absolute",top:-2,height:10,width:2,borderRadius:_isBm?0:1,background:K.txt+"90",left:Math.min(100,target)+"%"}}/>}
                </div>
              </div>
              <div style={{textAlign:"right",minWidth:80,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                <span style={{fontSize:14,fontWeight:700,color:K.txt,fontFamily:fm}}>{current.toFixed(1)}%</span>
                {hasTarget&&<span style={{fontSize:11,color:bigDrift?(drift>0?K.amb:"#60a5fa"):K.dim,fontFamily:fb}}>target {target}%</span>}
              </div>
              {editTgt&&<div style={{flexShrink:0,width:72,display:"flex",alignItems:"center",gap:4}}>
                <input type="number" min="0" max="100" value={tgtDraft[id]||""} onChange={function(e){setTgtDraft(Object.assign({},tgtDraft,{[id]:e.target.value}))}} placeholder="0" style={{width:"100%",background:K.bg,border:"1px solid "+K.bdr,borderRadius:_isBm?0:6,color:K.txt,padding:"5px 8px",fontSize:12,fontFamily:fm,outline:"none",textAlign:"right"}}/>
                <span style={{fontSize:12,color:K.dim,fontFamily:fb}}>%</span>
              </div>}
            </div>;
          })}
        </div>
        {(function(){
          var total=editTgt?ALL_ALLOC_IDS.reduce(function(s,id){return s+Number(tgtDraft[id]||0)},0):ALL_ALLOC_IDS.reduce(function(s,id){return s+getTargetPct(id)},0);
          if(total===0)return null;
          return<div style={{marginTop:10,fontSize:12,color:editTgt?(total===100?K.grn:K.amb):K.dim,fontFamily:fb,textAlign:"right"}}>
            Total: {total.toFixed(0)}%{editTgt&&total!==100?" — should sum to 100%":" ✓"}
          </div>;
        })()}
      </div>}

      {/* ── Asset Add/Edit Modal ── */}
      {modal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={function(){setModal(null);setStep(0)}}>
        <div style={{background:K.card,borderRadius:_isBm?0:18,padding:"28px",maxWidth:520,width:"100%",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}} onClick={function(e){e.stopPropagation()}}>
          {modal==="add"&&step===0&&<div>
            <div style={{fontSize:18,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:6}}>Add Asset</div>
            <div style={{fontSize:13,color:K.dim,marginBottom:20}}>Select asset type</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {(ATYPES||[]).map(function(t){return<button key={t.id} onClick={function(){openAdd(t.id)}} style={{padding:"14px 16px",borderRadius:_isBm?0:12,border:"2px solid "+t.color+"40",background:t.color+"0d",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
                <IC name={t.icon} size={16} color={t.color}/>
                <span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{t.label}</span>
              </button>})}
            </div>
          </div>}

          {(modal==="edit"||(modal==="add"&&step===1))&&<div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              {modal==="add"&&<button onClick={function(){setStep(0)}} style={{background:"transparent",border:"none",color:K.dim,fontSize:18,cursor:"pointer"}}>←</button>}
              <IC name={atype.icon||"folder"} size={16} color={atype.color||K.acc}/>
              <div style={{fontSize:18,fontWeight:700,color:K.txt,fontFamily:fh}}>{modal==="edit"?"Edit Asset":atype.label}</div>
            </div>
            <div style={{marginBottom:14}}><label style={secLabel}>Name</label><input value={form.name||""} onChange={function(e){setForm(Object.assign({},form,{name:e.target.value}))}} placeholder={atype.isPortfolio2?"e.g. ISK Account":"Asset name"} style={inputStyle}/></div>
            {!atype.manual&&!atype.isPortfolio2&&<div style={{marginBottom:14}}><label style={secLabel}>Ticker</label><input value={form.ticker||""} onChange={function(e){setForm(Object.assign({},form,{ticker:e.target.value.toUpperCase()}))}} placeholder="e.g. VOO, BTC" style={inputStyle}/></div>}
            {!atype.manual&&!atype.isPortfolio2&&<div style={{marginBottom:14}}><label style={secLabel}>Quantity</label><input type="number" value={form.quantity||""} onChange={function(e){setForm(Object.assign({},form,{quantity:e.target.value}))}} placeholder="0" style={inputStyle}/></div>}
            {atype.manual&&<div style={{marginBottom:14}}><label style={secLabel}>Current Value ({cSym})</label><input type="number" value={form.manualValue||""} onChange={function(e){setForm(Object.assign({},form,{manualValue:e.target.value}))}} placeholder="0" style={inputStyle}/></div>}
            <div style={{marginBottom:14}}><label style={secLabel}>Total Cost Basis ({cSym})</label><input type="number" value={form.costBasis||""} onChange={function(e){setForm(Object.assign({},form,{costBasis:e.target.value}))}} placeholder="0" style={inputStyle}/><div style={{fontSize:11,color:K.dim,marginTop:4}}>Total amount paid — used for gain/loss calculation</div></div>
            {(atype.manual||atype.id==="bonds"||atype.id==="etf"||atype.id==="royalties"||atype.id==="valuables")&&<div style={{marginBottom:14}}>
              <label style={secLabel}>Annual Income ({cSym}) — optional</label>
              <input type="number" value={form.annualIncome||""} onChange={function(e){setForm(Object.assign({},form,{annualIncome:e.target.value}))}} placeholder={atype.id==="royalties"?"e.g. book/music royalties":atype.id==="etf"?"ETF dividend income p.a.":atype.id==="valuables"?"e.g. watch rental income":"e.g. rental income, bond coupons"} style={inputStyle}/>
              {(atype.id==="etf"||atype.id==="bonds")&&form.annualIncome>0&&<div style={{marginTop:8}}>
                <label style={Object.assign({},secLabel,{marginBottom:4})}>Payment Frequency</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[{v:"monthly",l:"Monthly"},{v:"quarterly",l:"Quarterly"},{v:"semi",l:"Semi-Annual"},{v:"annual",l:"Annual"}].map(function(f){var a=form.divFrequency===f.v;return<button key={f.v} onClick={function(){setForm(Object.assign({},form,{divFrequency:f.v}))}} style={{padding:"5px 12px",borderRadius:_isBm?0:7,border:"1px solid "+(a?K.acc:K.bdr),background:a?K.acc+"15":"transparent",color:a?K.acc:K.dim,fontSize:11,cursor:"pointer",fontFamily:fm,fontWeight:a?600:400}}>{f.l}</button>})}
                </div>
              </div>}
            </div>}
            {atype.isPortfolio2&&<div style={{marginBottom:14}}>
              <label style={secLabel}>Holdings</label>
              {(form.holdings||[]).map(function(h){return<div key={h.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:K.bg,borderRadius:_isBm?0:8,marginBottom:6}}>
                <div style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:K.txt,fontFamily:fm}}>{h.ticker}</span><span style={{fontSize:11,color:K.dim,marginLeft:8}}>{h.shares} @ {cSym}{h.avgCost}</span></div>
                <button onClick={function(){removeP2Holding(h.id)}} style={{background:"transparent",border:"none",color:K.red,fontSize:14,cursor:"pointer"}}>✕</button>
              </div>})}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                <input value={p2form.ticker} onChange={function(e){setP2form(Object.assign({},p2form,{ticker:e.target.value.toUpperCase()}))}} placeholder="Ticker" style={inputStyle}/>
                <input value={p2form.name} onChange={function(e){setP2form(Object.assign({},p2form,{name:e.target.value}))}} placeholder="Name (optional)" style={inputStyle}/>
                <input type="number" value={p2form.shares} onChange={function(e){setP2form(Object.assign({},p2form,{shares:e.target.value}))}} placeholder="Shares" style={inputStyle}/>
                <input type="number" value={p2form.avgCost} onChange={function(e){setP2form(Object.assign({},p2form,{avgCost:e.target.value}))}} placeholder={"Avg cost ("+cSym+")"} style={inputStyle}/>
              </div>
              <button onClick={addP2Holding} style={{marginTop:8,padding:"7px 14px",borderRadius:_isBm?0:8,border:"1px solid "+K.acc+"60",background:K.acc+"12",color:K.acc,fontSize:12,cursor:"pointer",fontFamily:fb,fontWeight:600}}>+ Add Holding</button>
            </div>}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={function(){setModal(null);setStep(0)}} style={{flex:1,padding:"10px",borderRadius:_isBm?0:10,border:"1px solid "+K.bdr,background:"transparent",color:K.dim,fontSize:13,cursor:"pointer",fontFamily:fm}}>Cancel</button>
              <button onClick={saveAsset} style={{flex:2,padding:"10px",borderRadius:_isBm?0:10,border:"none",background:K.acc,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{modal==="edit"?"Save Changes":"Add Asset"}</button>
            </div>
          </div>}
        </div>
      </div>}

      {/* ── Liability Pick/Add/Edit Modal ── */}
      {lmodal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={function(){setLmodal(null);setLform({})}}>
        <div style={{background:K.card,borderRadius:_isBm?0:18,padding:"28px",maxWidth:480,width:"100%",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}} onClick={function(e){e.stopPropagation()}}>
          {lmodal==="pick"&&<div>
            <div style={{fontSize:18,fontWeight:700,color:K.txt,fontFamily:fh,marginBottom:6}}>Add Liability</div>
            <div style={{fontSize:13,color:K.dim,marginBottom:20}}>What type of debt?</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(LTYPES||[]).map(function(t){return<button key={t.id} onClick={function(){openAddLiab(t.id)}} style={{padding:"14px 16px",borderRadius:_isBm?0:12,border:"1px solid "+K.bdr,background:K.bg,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
                <IC name={t.icon} size={16} color={t.color}/>
                <span style={{fontSize:14,fontWeight:600,color:K.txt,fontFamily:fm}}>{t.label}</span>
              </button>})}
            </div>
          </div>}
          {(lmodal==="add"||lmodal==="edit")&&<div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              {lmodal==="add"&&<button onClick={function(){setLmodal("pick")}} style={{background:"transparent",border:"none",color:K.dim,fontSize:18,cursor:"pointer"}}>←</button>}
              <IC name={(LTYPES_MAP[lform.type]||{icon:"overview"}).icon} size={16} color={K.red}/>
              <div style={{fontSize:18,fontWeight:700,color:K.txt,fontFamily:fh}}>{lmodal==="edit"?"Edit Liability":(LTYPES_MAP[lform.type]||{label:""}).label}</div>
            </div>
            <div style={{marginBottom:14}}><label style={secLabel}>Name / Description</label><input value={lform.name||""} onChange={function(e){setLform(Object.assign({},lform,{name:e.target.value}))}} placeholder="e.g. Home mortgage, Car loan" style={inputStyle}/></div>
            <div style={{marginBottom:14}}><label style={secLabel}>Outstanding Balance ({cSym})</label><input type="number" value={lform.balance||""} onChange={function(e){setLform(Object.assign({},lform,{balance:e.target.value}))}} placeholder="0" style={inputStyle}/></div>
            <div style={{marginBottom:14}}><label style={secLabel}>Interest Rate (%) — optional</label><input type="number" value={lform.interestRate||""} onChange={function(e){setLform(Object.assign({},lform,{interestRate:e.target.value}))}} placeholder="e.g. 3.5" style={inputStyle}/></div>
            <div style={{marginBottom:14}}><label style={secLabel}>Monthly Payment ({cSym}) — optional</label><input type="number" value={lform.monthlyPayment||""} onChange={function(e){setLform(Object.assign({},lform,{monthlyPayment:e.target.value}))}} placeholder="0" style={inputStyle}/></div>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={function(){setLmodal(null);setLform({})}} style={{flex:1,padding:"10px",borderRadius:_isBm?0:10,border:"1px solid "+K.bdr,background:"transparent",color:K.dim,fontSize:13,cursor:"pointer",fontFamily:fm}}>Cancel</button>
              <button onClick={saveLiab} style={{flex:2,padding:"10px",borderRadius:_isBm?0:10,border:"none",background:K.red,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:fm}}>{lmodal==="edit"?"Save Changes":"Add Liability"}</button>
            </div>
          </div>}
        </div>
      </div>}
    </div>
  }


  // ── Portfolio Timeline ─────────────────────────────────────
