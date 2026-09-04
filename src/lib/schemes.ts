/**
 * Central government financial-inclusion schemes relevant to gig, platform, and informal
 * workers with irregular income. Runs entirely client-side — no network call — so it keeps
 * working even when the backend or an internet connection is unavailable.
 *
 * Informational only. Simplified for an MVP demo from publicly available scheme guidelines;
 * amounts and rules change over time. This is not an official eligibility determination —
 * always confirm current details at myscheme.gov.in or the scheme's own portal.
 */

export type SchemeCategory = "Pension" | "Insurance" | "Credit" | "Foundational" | "Health";

export interface Scheme {
  id: string;
  name: string;
  category: SchemeCategory;
  administeredBy: string;
  benefit: string;
  note: string;
  officialSite: string;
  minAge?: number;
  maxAge?: number;
  maxMonthlyIncome?: number;
  requiresBankAccount?: boolean;
  manualCheck?: boolean; // occupation- or database-specific; not decided by age/income alone
}

export const SCHEMES: Scheme[] = [
  { id: "eshram", name: "e-Shram — National Database of Unorganised Workers", category: "Foundational", administeredBy: "Ministry of Labour & Employment", benefit: "Free UAN card and ₹2,00,000 accidental death/disability cover; the base registration most other unorganised-sector benefits are built on.", note: "For workers not covered by EPFO, ESIC, or a government pension scheme.", officialSite: "eshram.gov.in", minAge: 16, maxAge: 59 },
  { id: "pm-jdy", name: "PM Jan Dhan Yojana (PMJDY)", category: "Foundational", administeredBy: "Department of Financial Services", benefit: "Zero-balance savings account, RuPay debit card with accident cover, and access to an overdraft facility once the account is active.", note: "The foundational account most other schemes' payouts and premiums rely on.", officialSite: "pmjdy.gov.in", minAge: 10 },
  { id: "pm-sym", name: "PM Shram Yogi Maan-dhan (PM-SYM)", category: "Pension", administeredBy: "Ministry of Labour & Employment", benefit: "Guaranteed pension of ₹3,000/month after age 60, matched government co-contribution.", note: "For unorganised workers not already covered by EPFO, ESIC, or NPS (Government).", officialSite: "maandhan.in", minAge: 18, maxAge: 40, maxMonthlyIncome: 15000, requiresBankAccount: true },
  { id: "apy", name: "Atal Pension Yojana (APY)", category: "Pension", administeredBy: "PFRDA", benefit: "Guaranteed monthly pension of ₹1,000–₹5,000 after age 60, based on contribution chosen.", note: "Open to any savings/post-office account holder; not available to income-tax payers.", officialSite: "npscra.nsdl.co.in", minAge: 18, maxAge: 40, requiresBankAccount: true },
  { id: "nps-traders", name: "National Pension Scheme for Traders & Self-Employed", category: "Pension", administeredBy: "Ministry of Labour & Employment", benefit: "Same ₹3,000/month guaranteed pension structure as PM-SYM, for self-employed traders and shopkeepers.", note: "For small traders/shopkeepers not covered by EPFO, ESIC, NPS (Govt), or PM-SYM.", officialSite: "maandhan.in", minAge: 18, maxAge: 40, maxMonthlyIncome: 15000, requiresBankAccount: true },
  { id: "pmjjby", name: "PM Jeevan Jyoti Bima Yojana (PMJJBY)", category: "Insurance", administeredBy: "Department of Financial Services", benefit: "₹2,00,000 life-insurance cover for any-cause death, low yearly premium auto-debited from a linked bank account.", note: "Renewable yearly; cover typically available up to age 55 with continuous renewal.", officialSite: "jansuraksha.gov.in", minAge: 18, maxAge: 50, requiresBankAccount: true },
  { id: "pmsby", name: "PM Suraksha Bima Yojana (PMSBY)", category: "Insurance", administeredBy: "Department of Financial Services", benefit: "₹2,00,000 accidental-death/full-disability cover (₹1,00,000 for partial disability), very low yearly premium.", note: "Widest age band of these schemes — a good first safety net for most working-age applicants.", officialSite: "jansuraksha.gov.in", minAge: 18, maxAge: 70, requiresBankAccount: true },
  { id: "mudra", name: "PM Mudra Yojana (PMMY)", category: "Credit", administeredBy: "Ministry of Finance", benefit: "Collateral-free loans up to ₹20,00,000 for a non-farm income-generating micro or small activity (Shishu / Kishor / Tarun / Tarun Plus tranches).", note: "For starting or growing a small business — not a personal or consumption loan.", officialSite: "mudra.org.in", minAge: 18 },
  { id: "svanidhi", name: "PM Street Vendor's AtmaNirbhar Nidhi (PM SVANidhi)", category: "Credit", administeredBy: "Ministry of Housing & Urban Affairs", benefit: "Collateral-free working-capital loans in rising tranches (₹10,000 → ₹20,000 → ₹50,000) with interest subsidy for on-time repayment.", note: "For registered or certificate-holding street vendors specifically.", officialSite: "pmsvanidhi.mohua.gov.in", manualCheck: true },
  { id: "vishwakarma", name: "PM Vishwakarma Yojana", category: "Credit", administeredBy: "Ministry of MSME", benefit: "Skill training with a stipend, a toolkit incentive, and collateral-free loans up to ₹3,00,000 across two tranches.", note: "For traditional artisans and craftspeople across 18 recognised trades (carpenters, tailors, cobblers, potters, blacksmiths and similar).", officialSite: "pmvishwakarma.gov.in", manualCheck: true },
  { id: "pmjay", name: "Ayushman Bharat — PM Jan Arogya Yojana (PM-JAY)", category: "Health", administeredBy: "National Health Authority", benefit: "₹5,00,000/family/year cashless health cover at empanelled hospitals.", note: "Eligibility runs off the SECC 2011 deprivation database and state-specific criteria, not a simple income test — check by name at the official portal or a hospital Ayushman help-desk.", officialSite: "pmjay.gov.in", manualCheck: true }
];

export interface EligibilityInput {
  age: number;
  monthlyIncome: number;
  hasBankAccount: boolean;
}

export interface EligibilityResult extends Scheme {
  eligible: boolean;
  reasons: string[];
}

export function evaluateSchemes(input: EligibilityInput): EligibilityResult[] {
  const results = SCHEMES.map((scheme): EligibilityResult => {
    if (scheme.manualCheck) {
      return { ...scheme, eligible: false, reasons: ["Occupation- or database-specific — see note."] };
    }
    const reasons: string[] = [];
    let eligible = true;
    if (scheme.minAge !== undefined && input.age < scheme.minAge) { eligible = false; reasons.push(`Age ${input.age} is below the minimum of ${scheme.minAge}.`); }
    else if (scheme.maxAge !== undefined && input.age > scheme.maxAge) { eligible = false; reasons.push(`Age ${input.age} is above the maximum of ${scheme.maxAge}.`); }
    else if (scheme.minAge !== undefined || scheme.maxAge !== undefined) { reasons.push(`Age ${input.age} fits the ${scheme.minAge ?? "any"}–${scheme.maxAge ?? "any"} band.`); }
    if (scheme.maxMonthlyIncome !== undefined) {
      if (input.monthlyIncome > scheme.maxMonthlyIncome) { eligible = false; reasons.push(`Estimated monthly income ₹${input.monthlyIncome.toLocaleString("en-IN")} is above the ₹${scheme.maxMonthlyIncome.toLocaleString("en-IN")} ceiling.`); }
      else { reasons.push(`Estimated monthly income ₹${input.monthlyIncome.toLocaleString("en-IN")} is within the ₹${scheme.maxMonthlyIncome.toLocaleString("en-IN")} ceiling.`); }
    }
    if (scheme.requiresBankAccount) {
      if (!input.hasBankAccount) { eligible = false; reasons.push("Requires a savings bank or post-office account — PM Jan Dhan Yojana can provide one first."); }
      else { reasons.push("Bank account requirement met."); }
    }
    if (!reasons.length) reasons.push("No age, income, or bank-account restriction for this scheme.");
    return { ...scheme, eligible, reasons };
  });
  return results.sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.name.localeCompare(b.name));
}
