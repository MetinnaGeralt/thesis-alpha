// app/api/sec/route.js — Free financial statements from SEC EDGAR XBRL
export const dynamic = 'force-dynamic';

const SEC_UA = 'ThesisAlpha contact@thesisalpha.com'; // SEC requires User-Agent with contact

// Comprehensive XBRL concept → field name mapping
const INCOME_MAP = {
  revenue: [
    'Revenues',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'SalesRevenueNet',
    'SalesRevenueServicesNet',
    'SalesRevenueGoodsNet',
    'RevenueNet',
    'Revenue',
    'ServiceRevenue',
    'RegulatedAndUnregulatedOperatingRevenue',
    'HealthCareOrganizationRevenue',
    'InterestAndDividendIncomeOperating',
    'RealEstateRevenueNet',
    'ElectricUtilityRevenue',
    'OilAndGasRevenue',
    'FinancialServicesRevenue',
    'BrokerageCommissionsRevenue',
    'ContractsRevenue',
  ],
  costOfRevenue: [
    'CostOfRevenue',
    'CostOfGoodsAndServicesSold',
    'CostOfGoodsSold',
    'CostOfServices',
  ],
  grossProfit: ['GrossProfit'],
  researchAndDevelopmentExpenses: [
    'ResearchAndDevelopmentExpense',
    'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
  ],
  sellingGeneralAndAdministrativeExpenses: [
    'SellingGeneralAndAdministrativeExpense',
    'SellingAndMarketingExpense',
    'GeneralAndAdministrativeExpense',
  ],
  operatingExpenses: [
    'OperatingExpenses',
    'CostsAndExpenses',
    'OperatingCostsAndExpenses',
  ],
  operatingIncome: [
    'OperatingIncomeLoss',
    'IncomeLossFromOperations',
  ],
  interestExpense: [
    'InterestExpense',
    'InterestExpenseDebt',
    'InterestIncomeExpenseNet',
    'InterestIncomeExpenseNonoperatingNet',
  ],
  totalOtherIncomeExpensesNet: [
    'NonoperatingIncomeExpense',
    'OtherNonoperatingIncomeExpense',
    'OtherOperatingIncomeExpenseNet',
  ],
  incomeBeforeTax: [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic',
  ],
  incomeTaxExpense: ['IncomeTaxExpenseBenefit'],
  netIncome: [
    'NetIncomeLoss',
    'NetIncomeLossAvailableToCommonStockholdersBasic',
    'NetIncomeLossAvailableToCommonStockholdersDiluted',
    'ProfitLoss',
    'NetIncomeLossAttributableToParent',
    'IncomeLossFromContinuingOperations',
  ],
  eps: [
    'EarningsPerShareBasic',
    'IncomeLossFromContinuingOperationsPerBasicShare',
  ],
  epsdiluted: [
    'EarningsPerShareDiluted',
    'IncomeLossFromContinuingOperationsPerDilutedShare',
  ],
  weightedAverageShsOut: [
    'WeightedAverageNumberOfSharesOutstandingBasic',
    'CommonStockSharesOutstanding',
  ],
  weightedAverageShsOutDil: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
  ebitda: ['EBITDA'],
  depreciationAndAmortization: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAndAmortization',
    'Depreciation',
    'DepreciationAmortizationAndAccretionNet',
  ],
};

const BALANCE_MAP = {
  cashAndCashEquivalents: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsAndShortTermInvestments',
    'Cash',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
  ],
  shortTermInvestments: [
    'ShortTermInvestments',
    'MarketableSecuritiesCurrent',
    'AvailableForSaleSecuritiesDebtSecuritiesCurrent',
  ],
  netReceivables: [
    'AccountsReceivableNetCurrent',
    'AccountsReceivableNet',
    'ReceivablesNetCurrent',
    'AccountsNotesAndLoansReceivableNetCurrent',
    'ContractWithCustomerAssetNetCurrent',
    'BilledContractReceivables',
  ],
  inventory: ['InventoryNet','Inventories'],
  totalCurrentAssets: ['AssetsCurrent'],
  propertyPlantEquipmentNet: ['PropertyPlantAndEquipmentNet'],
  goodwill: ['Goodwill'],
  intangibleAssets: ['IntangibleAssetsNetExcludingGoodwill','FiniteLivedIntangibleAssetsNet'],
  longTermInvestments: [
    'LongTermInvestments',
    'MarketableSecuritiesNoncurrent',
    'AvailableForSaleSecuritiesDebtSecuritiesNoncurrent',
  ],
  totalNonCurrentAssets: ['AssetsNoncurrent','NoncurrentAssets'],
  totalAssets: ['Assets'],
  accountPayables: ['AccountsPayableCurrent','AccountsPayable','AccountsPayableAndAccruedLiabilitiesCurrent'],
  shortTermDebt: ['ShortTermBorrowings','DebtCurrent','ShortTermDebt'],
  totalCurrentLiabilities: ['LiabilitiesCurrent'],
  longTermDebt: [
    'LongTermDebt',
    'LongTermDebtNoncurrent',
    'LongTermDebtAndCapitalLeaseObligations',
    'LongTermLineOfCredit',
  ],
  totalNonCurrentLiabilities: ['LiabilitiesNoncurrent'],
  totalLiabilities: ['Liabilities'],
  retainedEarnings: ['RetainedEarningsAccumulatedDeficit'],
  totalStockholdersEquity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],
};

const CASHFLOW_MAP = {
  netIncome: ['NetIncomeLoss','ProfitLoss','NetIncomeLossAttributableToParent'],
  depreciationAndAmortization: ['DepreciationDepletionAndAmortization','DepreciationAndAmortization'],
  stockBasedCompensation: ['ShareBasedCompensation','AllocatedShareBasedCompensationExpense'],
  changeInWorkingCapital: ['IncreaseDecreaseInOperatingCapital','IncreaseDecreaseInOperatingLiabilities'],
  operatingCashFlow: [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],
  capitalExpenditure: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
  ],
  acquisitionsNet: ['PaymentsToAcquireBusinessesNetOfCashAcquired','PaymentsToAcquireBusinessesAndInterestInAffiliates'],
  purchasesOfInvestments: ['PaymentsToAcquireInvestments','PaymentsToAcquireAvailableForSaleSecuritiesDebt'],
  salesMaturitiesOfInvestments: ['ProceedsFromSaleAndMaturityOfMarketableSecurities','ProceedsFromMaturitiesPrepaymentsAndCallsOfAvailableForSaleSecurities'],
  netCashUsedForInvestingActivites: [
    'NetCashProvidedByUsedInInvestingActivities',
    'NetCashProvidedByUsedInInvestingActivitiesContinuingOperations',
  ],
  debtRepayment: ['RepaymentsOfLongTermDebt','RepaymentsOfDebt'],
  commonStockRepurchased: ['PaymentsForRepurchaseOfCommonStock','PaymentsForRepurchaseOfEquity'],
  dividendsPaid: ['PaymentsOfDividends','PaymentsOfDividendsCommonStock'],
  netCashUsedProvidedByFinancingActivities: [
    'NetCashProvidedByUsedInFinancingActivities',
    'NetCashProvidedByUsedInFinancingActivitiesContinuingOperations',
  ],
};

const REVENUE_KEYWORDS = ['revenue','sales','income','fee','commission','premium','service','contract'];
const NET_INCOME_KEYWORDS = ['netincome','netloss','profit','earning','incomeloss'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const period = searchParams.get('period') || 'annual';
  const debug = searchParams.get('debug') === '1';

  if (!ticker) {
    return Response.json({ error: 'Missing ticker' }, { status: 400 });
  }

  try {
    const cik = await lookupCIK(ticker);
    if (!cik) {
      return Response.json({ error: 'CIK not found for ' + ticker, source: 'sec' }, { status: 404 });
    }

    const paddedCik = String(cik).padStart(10, '0');
    const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`;
    console.log(`[SEC] Fetching: ${factsUrl}`);

    const res = await fetch(factsUrl, {
      headers: { 'User-Agent': SEC_UA, 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) {
      return Response.json({ error: `SEC EDGAR returned ${res.status}`, source: 'sec' }, { status: res.status });
    }

    const facts = await res.json();
    const gaap = facts?.facts?.['us-gaap'] || {};
    const ifrs = facts?.facts?.['ifrs-full'] || {};
    const allFacts = { ...ifrs, ...gaap };

    // Debug mode: show what XBRL tags this company uses for revenue/income
    if (debug) {
      const debugInfo = { ticker, cik: paddedCik, entityName: facts.entityName };
      debugInfo.revenueRelated = {};
      debugInfo.netIncomeRelated = {};
      
      for (const [concept, data] of Object.entries(allFacts)) {
        const lower = concept.toLowerCase();
        const isRevenue = REVENUE_KEYWORDS.some(k => lower.includes(k));
        const isIncome = NET_INCOME_KEYWORDS.some(k => lower.includes(k));
        
        if (isRevenue || isIncome) {
          const units = data?.units || {};
          const entries = units['USD'] || units['USD/shares'] || units[Object.keys(units)[0]] || [];
          const fyEntries = entries.filter(e => e.fp === 'FY' && ['10-K','20-F','10-K/A','20-F/A'].includes(e.form));
          const latest = fyEntries.sort((a,b) => (b.end||'').localeCompare(a.end||''))[0];
          
          const info = {
            latestFY: latest ? { end: latest.end, val: latest.val, filed: latest.filed } : null,
            fyEntries: fyEntries.length,
          };
          
          if (isRevenue) debugInfo.revenueRelated[concept] = info;
          if (isIncome) debugInfo.netIncomeRelated[concept] = info;
        }
      }
      
      // Also show which of our mapped concepts matched
      debugInfo.matchedConcepts = {};
      for (const [field, concepts] of Object.entries({...INCOME_MAP, ...BALANCE_MAP, ...CASHFLOW_MAP})) {
        for (const c of concepts) {
          if (allFacts[c]) { debugInfo.matchedConcepts[field] = c; break; }
        }
      }
      
      debugInfo.totalConcepts = Object.keys(allFacts).length;
      return Response.json(debugInfo);
    }

    // Build statements
    const isAnnual = period === 'annual';
    const income = buildStatement(allFacts, INCOME_MAP, isAnnual);
    const balance = buildStatement(allFacts, BALANCE_MAP, isAnnual);
    const cashflow = buildStatement(allFacts, CASHFLOW_MAP, isAnnual);

    // Post-process calculated fields
    for (const row of income) {
      if (row.revenue && row.costOfRevenue && !row.grossProfit) row.grossProfit = row.revenue - row.costOfRevenue;
      if (row.revenue && row.grossProfit) row.grossProfitRatio = row.grossProfit / row.revenue;
      if (row.revenue && row.operatingIncome) row.operatingIncomeRatio = row.operatingIncome / row.revenue;
      if (row.revenue && row.netIncome) row.netIncomeRatio = row.netIncome / row.revenue;
      if (!row.ebitda && row.operatingIncome != null && row.depreciationAndAmortization != null) {
        row.ebitda = row.operatingIncome + Math.abs(row.depreciationAndAmortization);
      }
    }
    for (const row of balance) {
      if (row.goodwill != null || row.intangibleAssets != null) {
        row.goodwillAndIntangibleAssets = (row.goodwill || 0) + (row.intangibleAssets || 0);
      }
      if (row.shortTermDebt != null || row.longTermDebt != null) {
        row.totalDebt = (row.shortTermDebt || 0) + (row.longTermDebt || 0);
      }
      if (row.totalDebt != null && row.cashAndCashEquivalents != null) {
        row.netDebt = row.totalDebt - row.cashAndCashEquivalents;
      }
    }
    for (const row of cashflow) {
      if (row.operatingCashFlow != null && row.capitalExpenditure != null) {
        row.freeCashFlow = row.operatingCashFlow + row.capitalExpenditure;
      } else if (row.operatingCashFlow != null) {
        row.freeCashFlow = row.operatingCashFlow;
      }
    }

    console.log(`[SEC] ${ticker}: income=${income.length}, balance=${balance.length}, cashflow=${cashflow.length}`);

    return Response.json({
      income, balance, cashflow,
      source: 'sec-edgar',
      cik: paddedCik,
      entityName: facts.entityName || ticker
    });

  } catch (e) {
    console.error('[SEC] Error:', e.message);
    return Response.json({ error: e.message, source: 'sec' }, { status: 500 });
  }
}

async function lookupCIK(ticker) {
  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': SEC_UA },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    const upper = ticker.toUpperCase();
    for (const key of Object.keys(data)) {
      if (data[key].ticker === upper) return data[key].cik_str;
    }
    return null;
  } catch (e) {
    console.error('[SEC] CIK lookup error:', e.message);
    return null;
  }
}

function getFactValue(allFacts, xbrlConcepts, isAnnual) {
  // Return first concept that has entries matching the requested period type
  for (const concept of xbrlConcepts) {
    const fact = allFacts[concept];
    if (!fact) continue;
    const units = fact.units;
    if (!units) continue;
    const entries = units['USD'] || units['USD/shares'] || units[Object.keys(units)[0]];
    if (!entries || entries.length === 0) continue;
    // Check if this concept has entries for the requested period
    const hasRelevant = entries.some(function(e) {
      if (isAnnual) {
        return e.fp === 'FY' && (!e.form || ['10-K','20-F','10-K/A','20-F/A'].includes(e.form));
      } else {
        return ['Q1','Q2','Q3','Q4'].includes(e.fp) && (!e.form || ['10-Q','6-K','10-Q/A','6-K/A'].includes(e.form));
      }
    });
    if (hasRelevant) return { concept, entries };
  }
  return null;
}

function buildStatement(allFacts, fieldMap, isAnnual) {
  const periodData = {};

  for (const [fieldName, xbrlConcepts] of Object.entries(fieldMap)) {
    const result = getFactValue(allFacts, xbrlConcepts, isAnnual);
    if (!result) continue;

    for (const entry of result.entries) {
      if (isAnnual) {
        if (entry.fp !== 'FY') continue;
        if (entry.form && !['10-K', '20-F', '10-K/A', '20-F/A'].includes(entry.form)) continue;
      } else {
        if (!['Q1','Q2','Q3','Q4'].includes(entry.fp)) continue;
        if (entry.form && !['10-Q', '6-K', '10-Q/A', '6-K/A'].includes(entry.form)) continue;
      }

      const key = entry.end;
      if (!key) continue;

      if (!periodData[key]) {
        periodData[key] = {
          date: key,
          period: isAnnual ? 'FY' : entry.fp,
          calendarYear: entry.fy ? String(entry.fy) : key.substring(0, 4),
          fillingDate: entry.filed || '',
          symbol: '',
        };
      }

      const existing = periodData[key]['_meta_' + fieldName];
      if (!existing || (entry.filed && existing < entry.filed)) {
        periodData[key][fieldName] = entry.val;
        periodData[key]['_meta_' + fieldName] = entry.filed || '';
      }
    }
  }

  const rows = Object.values(periodData)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => {
      const clean = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.startsWith('_meta_')) clean[k] = v;
      }
      return clean;
    });

  return rows.slice(-(isAnnual ? 8 : 20));
}
