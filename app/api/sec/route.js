// app/api/sec/route.js — Free financial statements from SEC EDGAR XBRL
export const dynamic = 'force-dynamic';

const SEC_UA = 'ThesisAlpha contact@thesisalpha.com'; // SEC requires User-Agent with contact

// XBRL concept → FMP field name mapping
const INCOME_MAP = {
  revenue: ['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax','SalesRevenueNet','RevenueFromContractWithCustomerIncludingAssessedTax'],
  costOfRevenue: ['CostOfRevenue','CostOfGoodsAndServicesSold','CostOfGoodsSold'],
  grossProfit: ['GrossProfit'],
  researchAndDevelopmentExpenses: ['ResearchAndDevelopmentExpense'],
  sellingGeneralAndAdministrativeExpenses: ['SellingGeneralAndAdministrativeExpense'],
  operatingExpenses: ['OperatingExpenses','CostsAndExpenses'],
  operatingIncome: ['OperatingIncomeLoss'],
  interestExpense: ['InterestExpense','InterestExpenseDebt','InterestIncomeExpenseNet'],
  totalOtherIncomeExpensesNet: ['NonoperatingIncomeExpense','OtherNonoperatingIncomeExpense'],
  incomeBeforeTax: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest','IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments','IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic'],
  incomeTaxExpense: ['IncomeTaxExpenseBenefit'],
  netIncome: ['NetIncomeLoss','ProfitLoss'],
  eps: ['EarningsPerShareBasic'],
  epsdiluted: ['EarningsPerShareDiluted'],
  weightedAverageShsOut: ['WeightedAverageNumberOfSharesOutstandingBasic','CommonStockSharesOutstanding'],
  weightedAverageShsOutDil: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
  ebitda: ['EBITDA'],
  depreciationAndAmortization: ['DepreciationDepletionAndAmortization','DepreciationAndAmortization','Depreciation'],
};

const BALANCE_MAP = {
  cashAndCashEquivalents: ['CashAndCashEquivalentsAtCarryingValue','CashCashEquivalentsAndShortTermInvestments','Cash'],
  shortTermInvestments: ['ShortTermInvestments','MarketableSecuritiesCurrent','AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
  netReceivables: ['AccountsReceivableNetCurrent','AccountsReceivableNet','ReceivablesNetCurrent'],
  inventory: ['InventoryNet','Inventories'],
  totalCurrentAssets: ['AssetsCurrent'],
  propertyPlantEquipmentNet: ['PropertyPlantAndEquipmentNet'],
  goodwill: ['Goodwill'],
  intangibleAssets: ['IntangibleAssetsNetExcludingGoodwill'],
  longTermInvestments: ['LongTermInvestments','MarketableSecuritiesNoncurrent','AvailableForSaleSecuritiesDebtSecuritiesNoncurrent'],
  totalNonCurrentAssets: ['AssetsNoncurrent'],
  totalAssets: ['Assets'],
  accountPayables: ['AccountsPayableCurrent','AccountsPayable'],
  shortTermDebt: ['ShortTermBorrowings','DebtCurrent','CommercialPaper'],
  totalCurrentLiabilities: ['LiabilitiesCurrent'],
  longTermDebt: ['LongTermDebt','LongTermDebtNoncurrent','LongTermDebtAndCapitalLeaseObligations'],
  totalNonCurrentLiabilities: ['LiabilitiesNoncurrent'],
  totalLiabilities: ['Liabilities'],
  retainedEarnings: ['RetainedEarningsAccumulatedDeficit'],
  totalStockholdersEquity: ['StockholdersEquity','StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
};

const CASHFLOW_MAP = {
  netIncome: ['NetIncomeLoss','ProfitLoss'],
  depreciationAndAmortization: ['DepreciationDepletionAndAmortization','DepreciationAndAmortization'],
  stockBasedCompensation: ['ShareBasedCompensation','AllocatedShareBasedCompensationExpense'],
  changeInWorkingCapital: ['IncreaseDecreaseInOperatingCapital'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  capitalExpenditure: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  acquisitionsNet: ['PaymentsToAcquireBusinessesNetOfCashAcquired','PaymentsToAcquireBusinessesAndInterestInAffiliates'],
  purchasesOfInvestments: ['PaymentsToAcquireInvestments','PaymentsToAcquireAvailableForSaleSecuritiesDebt','PaymentsToAcquireMarketableSecurities'],
  salesMaturitiesOfInvestments: ['ProceedsFromSaleAndMaturityOfMarketableSecurities','ProceedsFromMaturitiesPrepaymentsAndCallsOfAvailableForSaleSecurities','ProceedsFromSaleOfAvailableForSaleSecuritiesDebt'],
  netCashUsedForInvestingActivites: ['NetCashProvidedByUsedInInvestingActivities'],
  debtRepayment: ['RepaymentsOfLongTermDebt','RepaymentsOfDebt','RepaymentsOfShortTermDebt'],
  commonStockRepurchased: ['PaymentsForRepurchaseOfCommonStock','PaymentsForRepurchaseOfEquity'],
  dividendsPaid: ['PaymentsOfDividends','PaymentsOfDividendsCommonStock','PaymentsOfOrdinaryDividends'],
  netCashUsedProvidedByFinancingActivities: ['NetCashProvidedByUsedInFinancingActivities'],
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const period = searchParams.get('period') || 'annual';

  if (!ticker) {
    return Response.json({ error: 'Missing ticker' }, { status: 400 });
  }

  try {
    // Step 1: Look up CIK from ticker
    const cik = await lookupCIK(ticker);
    if (!cik) {
      return Response.json({ error: 'CIK not found for ' + ticker, source: 'sec' }, { status: 404 });
    }

    // Step 2: Fetch company facts from EDGAR
    const paddedCik = String(cik).padStart(10, '0');
    const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`;
    console.log(`[SEC] Fetching: ${factsUrl}`);

    const res = await fetch(factsUrl, {
      headers: { 'User-Agent': SEC_UA, 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) {
      console.log(`[SEC] HTTP ${res.status} for CIK ${paddedCik}`);
      return Response.json({ error: `SEC EDGAR returned ${res.status}`, source: 'sec' }, { status: res.status });
    }

    const facts = await res.json();
    const gaap = facts?.facts?.['us-gaap'] || {};
    const ifrs = facts?.facts?.['ifrs-full'] || {};
    // Merge GAAP and IFRS (some foreign filers use IFRS)
    const allFacts = { ...ifrs, ...gaap };

    // Step 3: Parse into statements
    const isAnnual = period === 'annual';
    const income = buildStatement(allFacts, INCOME_MAP, isAnnual);
    const balance = buildStatement(allFacts, BALANCE_MAP, isAnnual);
    const cashflow = buildStatement(allFacts, CASHFLOW_MAP, isAnnual);

    // Step 4: Post-process calculated fields
    for (const row of income) {
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
        row.freeCashFlow = row.operatingCashFlow + row.capitalExpenditure; // capex is negative
      } else if (row.operatingCashFlow != null) {
        row.freeCashFlow = row.operatingCashFlow; // no capex data
      }
    }

    console.log(`[SEC] ${ticker}: income=${income.length}, balance=${balance.length}, cashflow=${cashflow.length} rows`);

    return Response.json({
      income,
      balance,
      cashflow,
      source: 'sec-edgar',
      cik: paddedCik,
      entityName: facts.entityName || ticker
    });

  } catch (e) {
    console.error('[SEC] Error:', e.message);
    return Response.json({ error: e.message, source: 'sec' }, { status: 500 });
  }
}

// Look up CIK from ticker using SEC's company_tickers.json
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
      if (data[key].ticker === upper) {
        return data[key].cik_str;
      }
    }
    return null;
  } catch (e) {
    console.error('[SEC] CIK lookup error:', e.message);
    return null;
  }
}

// Extract a single fact value for a given period end date
function getFactValue(allFacts, xbrlConcepts) {
  for (const concept of xbrlConcepts) {
    const fact = allFacts[concept];
    if (!fact) continue;
    // Try USD first, then other units
    const units = fact.units;
    if (!units) continue;
    const entries = units['USD'] || units['USD/shares'] || units[Object.keys(units)[0]];
    if (entries && entries.length > 0) return { concept, entries };
  }
  return null;
}

// Build a statement (income/balance/cashflow) from XBRL facts
function buildStatement(allFacts, fieldMap, isAnnual) {
  // Step 1: Collect all date endpoints and group data by period
  const periodData = {}; // { "2023-12-31": { revenue: 123, ... } }

  for (const [fieldName, xbrlConcepts] of Object.entries(fieldMap)) {
    const result = getFactValue(allFacts, xbrlConcepts);
    if (!result) continue;

    for (const entry of result.entries) {
      // Filter by period type
      if (isAnnual) {
        // Annual: fp=FY, form=10-K or 20-F
        if (entry.fp !== 'FY') continue;
        if (entry.form && !['10-K', '20-F', '10-K/A', '20-F/A'].includes(entry.form)) continue;
      } else {
        // Quarterly: fp=Q1/Q2/Q3/Q4, form=10-Q or 6-K
        if (!['Q1','Q2','Q3','Q4'].includes(entry.fp)) continue;
        if (entry.form && !['10-Q', '6-K', '10-Q/A', '6-K/A'].includes(entry.form)) continue;
      }

      const key = entry.end; // period end date
      if (!key) continue;

      if (!periodData[key]) {
        periodData[key] = {
          date: key,
          period: isAnnual ? 'FY' : entry.fp,
          calendarYear: entry.fy ? String(entry.fy) : key.substring(0, 4),
          fillingDate: entry.filed || '',
          symbol: '', // filled later
        };
      }

      // Only take the latest filing for each field+period (handle amendments)
      const existing = periodData[key]['_meta_' + fieldName];
      if (!existing || (entry.filed && existing < entry.filed)) {
        periodData[key][fieldName] = entry.val;
        periodData[key]['_meta_' + fieldName] = entry.filed || '';
      }
    }
  }

  // Step 2: Convert to sorted array, remove metadata
  const rows = Object.values(periodData)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => {
      const clean = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.startsWith('_meta_')) clean[k] = v;
      }
      return clean;
    });

  // Limit results
  const limit = isAnnual ? 8 : 20;
  return rows.slice(-limit);
}
