"use client";

import {
  type AdjustmentRates,
  type Comments,
  type Comp,
  type Property,
  adjustComp,
} from "@/lib/appraisal";
import { FIELD_BY_KEY, MC_PERIODS, MC_ROWS, formatValue, mcKey, type ReportData } from "@/lib/report";
import { actualAge, costApproach, incomeApproach } from "@/lib/valuation";
import { money } from "./fields";

type Props = {
  subject: Property;
  comps: Comp[];
  rates: AdjustmentRates;
  report: ReportData;
  comments: Comments;
};

export type MissingItem = { step: string; label: string };

// What a reviewer would bounce the report for, grouped by the step that fills it.
export function missingItems({ subject, comps, report, comments }: Props): MissingItem[] {
  const out: MissingItem[] = [];
  const need = (step: string, label: string, value: unknown) => {
    if (value == null || value === "") out.push({ step, label });
  };
  const r = (key: string) => report[key];
  need("assignment", "Lender/client", r("assignment.clientName"));
  need("assignment", "Borrower", r("assignment.borrower"));
  need("assignment", "Assignment type", r("assignment.assignmentType"));
  need("assignment", "Property rights", r("assignment.propertyRights"));
  need("assignment", "Occupant", r("assignment.occupant"));
  need("assignment", "Effective date", r("assignment.effectiveDate"));
  need("assignment", "Legal description", r("assignment.legalDescription"));
  need("assignment", "R.E. taxes", r("assignment.taxes"));
  if (r("assignment.assignmentType") === "Purchase") {
    need("assignment", "Contract price", r("contract.price"));
    need("assignment", "Date of contract", r("contract.date"));
  }
  need("subject", "Address", subject.address);
  need("subject", "Parcel #", subject.parcelNumber);
  need("subject", "Owner of record", subject.ownerOfRecord);
  need("subject", "Census tract", subject.censusTract);
  need("subject", "Zoning", subject.zoning);
  need("subject", "Zoning compliance", r("site.zoningCompliance"));
  need("subject", "FEMA flood zone", r("site.floodZone"));
  need("subject", "GLA", subject.gla);
  need("subject", "Condition rating", subject.condition);
  need("subject", "Quality rating", subject.quality);
  need("improvements", "Foundation", r("improvements.foundation"));
  need("improvements", "Heating", r("improvements.heating"));
  need("improvements", "Total rooms", r("improvements.totalRooms"));
  need("improvements", "Exterior walls", r("improvements.exteriorWalls"));
  need("improvements", "Roof surface", r("improvements.roofSurface"));
  need("neighborhood", "Location", r("neighborhood.location"));
  need("neighborhood", "Property values", r("neighborhood.propertyValues"));
  need("neighborhood", "Price range", r("neighborhood.priceLow"));
  need("neighborhood", "Boundaries", r("neighborhood.boundaries"));
  need("neighborhood", "Market conditions figures (1004MC)", r(mcKey("salesCount", "p03")));
  const sold = comps.filter((c) => c.salePrice != null).length;
  if (sold < 3) out.push({ step: "comps", label: `${3 - sold} more closed comp${sold === 2 ? "" : "s"}` });
  need("grid", "Indicated value by sales comparison", r("sales.indicatedValue"));
  for (const [key, label] of [
    ["neighborhood", "Neighborhood comment"],
    ["marketConditions", "Market conditions comment"],
    ["subjectImprovements", "Condition comment"],
    ["salesComparison", "Sales comparison summary"],
    ["reconciliation", "Reconciliation comment"],
  ] as const) {
    need("comments", label, comments[key].trim());
  }
  need("value", "Appraisal made as is / subject to", r("reconciliation.basis"));
  need("value", "Opinion of market value", r("reconciliation.finalValue"));
  need("report", "Appraiser name", r("appraiser.name"));
  need("report", "License #", r("appraiser.licenseNumber"));
  need("report", "Signature date", r("appraiser.signatureDate"));
  return out;
}

export default function ReportView({ subject, comps, rates, report, comments }: Props) {
  const v = (key: string) => {
    const field = FIELD_BY_KEY.get(key);
    return field ? formatValue(field, report[key]) : "";
  };
  const yesNo = (b: boolean | null | undefined) => (b == null ? "" : b ? "Yes" : "No");
  const sold = comps.map((c, i) => ({ comp: c, n: i + 1 })).filter(({ comp }) => comp.salePrice != null);
  const results = sold.map(({ comp }) => adjustComp(subject, comp, rates));
  const cost = costApproach(report, subject);
  const income = incomeApproach(report);
  const baths = (p: Property) => (p.fullBaths == null ? "" : `${p.fullBaths}.${p.halfBaths ?? 0}`);
  const address = [subject.address, subject.city, subject.state, subject.zip].filter(Boolean).join(", ");

  return (
    <article className="report mx-auto max-w-[8.5in] space-y-4 bg-surface text-[12px] leading-snug">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-foreground pb-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Uniform Residential Appraisal Report</h1>
          <p className="text-muted">{address || "Subject address"}</p>
        </div>
        <p className="tabular-nums">File # {v("assignment.fileNumber") || "—"}</p>
      </header>

      <Section title="Subject">
        <Pairs
          items={[
            ["Property address", subject.address],
            ["City", subject.city],
            ["State", subject.state],
            ["Zip", subject.zip],
            ["Borrower", v("assignment.borrower")],
            ["Owner of public record", subject.ownerOfRecord],
            ["County", subject.county],
            ["Legal description", v("assignment.legalDescription")],
            ["Assessor's parcel #", subject.parcelNumber],
            ["Tax year", v("assignment.taxYear")],
            ["R.E. taxes", v("assignment.taxes")],
            ["Neighborhood name", v("assignment.neighborhoodName")],
            ["Map reference", v("assignment.mapReference")],
            ["Census tract", subject.censusTract],
            ["Occupant", v("assignment.occupant")],
            ["Special assessments", v("assignment.specialAssessments")],
            ["PUD", v("assignment.pud")],
            ["HOA", [v("assignment.hoaDues"), v("assignment.hoaPeriod")].filter(Boolean).join(" ")],
            ["Property rights appraised", v("assignment.propertyRights")],
            ["Assignment type", v("assignment.assignmentType")],
            ["Lender/client", v("assignment.clientName")],
            ["Address", v("assignment.clientAddress")],
            ["Offered for sale in prior 12 months", v("assignment.offeredForSale")],
          ]}
        />
        <Narrative label="Offering history" text={v("assignment.offeringHistory")} />
      </Section>

      <Section title="Contract">
        <Narrative label="Contract analysis" text={v("contract.analysis")} />
        <Pairs
          items={[
            ["Contract price", v("contract.price")],
            ["Date of contract", v("contract.date")],
            ["Seller is owner of public record", v("contract.sellerIsOwner")],
            ["Data source", v("contract.dataSource")],
            ["Financial assistance", v("contract.assistance")],
            ["Total assistance", v("contract.assistanceAmount")],
          ]}
        />
        <Narrative label="Items to be paid" text={v("contract.assistanceDescription")} />
      </Section>

      <Section title="Neighborhood">
        <Pairs
          items={[
            ["Location", v("neighborhood.location")],
            ["Built-up", v("neighborhood.builtUp")],
            ["Growth", v("neighborhood.growth")],
            ["Property values", v("neighborhood.propertyValues")],
            ["Demand/supply", v("neighborhood.demandSupply")],
            ["Marketing time", v("neighborhood.marketingTime")],
            ["Price low / high / pred.", [v("neighborhood.priceLow"), v("neighborhood.priceHigh"), v("neighborhood.pricePredominant")].join(" / ")],
            ["Age low / high / pred.", [v("neighborhood.ageLow"), v("neighborhood.ageHigh"), v("neighborhood.agePredominant")].join(" / ")],
            ["Land use: one-unit", pctOf(v("neighborhood.landUseOneUnit"))],
            ["2-4 unit", pctOf(v("neighborhood.landUse2to4"))],
            ["Multi-family", pctOf(v("neighborhood.landUseMulti"))],
            ["Commercial", pctOf(v("neighborhood.landUseCommercial"))],
            ["Other", pctOf(v("neighborhood.landUseOther"))],
          ]}
        />
        <Narrative label="Neighborhood boundaries" text={v("neighborhood.boundaries")} />
        <Narrative label="Neighborhood description" text={comments.neighborhood} />
        <Narrative label="Market conditions" text={comments.marketConditions} />
      </Section>

      <Section title="Site">
        <Pairs
          items={[
            ["Dimensions", v("site.dimensions")],
            ["Area", subject.lotSizeSqFt == null ? "" : `${subject.lotSizeSqFt.toLocaleString()} sq ft`],
            ["Shape", v("site.shape")],
            ["View", subject.view],
            ["Zoning classification", subject.zoning],
            ["Zoning description", v("site.zoningDescription")],
            ["Zoning compliance", v("site.zoningCompliance")],
            ["Highest and best use is present use", v("site.highestBestUse")],
            ["Electricity", v("site.electricity")],
            ["Gas", v("site.gas")],
            ["Water", v("site.water")],
            ["Sanitary sewer", v("site.sewer")],
            ["Street", [v("site.street"), v("site.streetType")].filter(Boolean).join(", ")],
            ["Alley", v("site.alley")],
            ["FEMA special flood hazard area", v("site.floodHazard")],
            ["FEMA flood zone", v("site.floodZone")],
            ["FEMA map #", v("site.floodMap")],
            ["FEMA map date", v("site.floodMapDate")],
            ["Utilities and off-site typical", v("site.utilitiesTypical")],
            ["Adverse site conditions", v("site.adverseConditions")],
          ]}
        />
        <Narrative label="Site comments" text={v("site.comments")} />
      </Section>

      <Section title="Improvements">
        <Pairs
          items={[
            ["Units", v("improvements.units")],
            ["Stories", v("improvements.stories")],
            ["Type", v("improvements.type")],
            ["Status", v("improvements.status")],
            ["Design (style)", subject.design],
            ["Year built", subject.yearBuilt?.toString()],
            ["Effective age", v("improvements.effectiveAge")],
            ["Attic", v("improvements.attic")],
            ["Foundation", v("improvements.foundation")],
            ["Basement area", subject.basementSqFt == null ? "" : `${subject.basementSqFt.toLocaleString()} sq ft`],
            ["Basement finish", basementFinish(subject)],
            ["Outside entry/exit", v("improvements.basementOutsideEntry")],
            ["Sump pump", v("improvements.sumpPump")],
            ["Evidence of", v("improvements.evidenceOf")],
            ["Heating", [v("improvements.heating"), v("improvements.fuel")].filter(Boolean).join(", ")],
            ["Cooling", v("improvements.cooling")],
            ["Foundation walls", v("improvements.foundationWalls")],
            ["Exterior walls", v("improvements.exteriorWalls")],
            ["Roof surface", v("improvements.roofSurface")],
            ["Gutters and downspouts", v("improvements.gutters")],
            ["Window type", v("improvements.windowType")],
            ["Storm sash/insulated", v("improvements.stormSash")],
            ["Screens", v("improvements.screens")],
            ["Floors", v("improvements.floors")],
            ["Walls", v("improvements.walls")],
            ["Trim/finish", v("improvements.trim")],
            ["Bath floor", v("improvements.bathFloor")],
            ["Bath wainscot", v("improvements.bathWainscot")],
            ["Fireplaces", subject.fireplaces?.toString()],
            ["Woodstoves", v("improvements.woodstoves")],
            ["Patio/deck", v("improvements.patioDeck")],
            ["Porch", v("improvements.porch")],
            ["Pool", yesNo(subject.pool)],
            ["Fence", v("improvements.fence")],
            ["Other", v("improvements.otherAmenities")],
            ["Driveway", [cars(report["improvements.drivewayCars"]), v("improvements.drivewaySurface")].filter(Boolean).join(", ")],
            ["Garage", [cars(subject.garageSpaces), v("improvements.garageType")].filter(Boolean).join(", ")],
            ["Carport", v("improvements.carportCars")],
            ["Appliances", appliances(report)],
            ["Rooms / bedrooms / baths", [v("improvements.totalRooms"), subject.bedrooms, baths(subject)].map((x) => x ?? "").join(" / ")],
            ["Gross living area", subject.gla == null ? "" : `${subject.gla.toLocaleString()} sq ft`],
            ["Condition / quality", `${subject.condition ? `C${subject.condition}` : ""} / ${subject.quality ? `Q${subject.quality}` : ""}`],
          ]}
        />
        <Narrative label="Additional features" text={v("improvements.additionalFeatures")} />
        <Narrative label="Condition of the property" text={comments.subjectImprovements} />
        <Pairs
          items={[
            ["Physical deficiencies or adverse conditions", v("improvements.deficiencies")],
            ["Conforms to the neighborhood", v("improvements.conforms")],
          ]}
        />
        <Narrative label="Deficiencies" text={v("improvements.deficienciesDescription")} />
      </Section>

      <Section title="Sales comparison approach">
        <p>
          There are {v("sales.listingsCount") || "__"} comparable properties currently offered for sale in the subject
          neighborhood ranging in price from {v("sales.listingsLow") || "$__"} to {v("sales.listingsHigh") || "$__"}. There
          are {v("sales.salesCount") || "__"} comparable sales in the subject neighborhood within the past twelve months
          ranging in sale price from {v("sales.salesLow") || "$__"} to {v("sales.salesHigh") || "$__"}.
        </p>
        <SalesGrid subject={subject} sold={sold} results={results} report={report} />
        <Pairs
          items={[
            ["Subject prior sales/transfers (3 years) found", v("sales.subjectPriorFound")],
            ["Data source", v("sales.subjectPriorSource")],
            ["Comparable prior sales/transfers (1 year) found", v("sales.compPriorFound")],
            ["Data source", v("sales.compPriorSource")],
          ]}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr>
                <Th>Prior sale/transfer</Th>
                <Th>Subject</Th>
                {sold.map(({ n }) => (
                  <Th key={n}>Comp {n}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>Date</Td>
                <Td>{subject.priorSaleDate}</Td>
                {sold.map(({ comp, n }) => (
                  <Td key={n}>{comp.priorSaleDate}</Td>
                ))}
              </tr>
              <tr>
                <Td>Price</Td>
                <Td>{subject.priorSalePrice == null ? "" : money(subject.priorSalePrice)}</Td>
                {sold.map(({ comp, n }) => (
                  <Td key={n}>{comp.priorSalePrice == null ? "" : money(comp.priorSalePrice)}</Td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <Narrative label="Analysis of prior sale or transfer history" text={v("sales.priorAnalysis")} />
        <Narrative label="Summary of sales comparison approach" text={comments.salesComparison} />
        <Pairs items={[["Indicated value by sales comparison approach", v("sales.indicatedValue")]]} />
      </Section>

      <Section title="Reconciliation">
        <Pairs
          items={[
            ["Indicated value by sales comparison", v("sales.indicatedValue")],
            ["Cost approach (if developed)", report["cost.developed"] ? money(cost.indicated) : ""],
            ["Income approach (if developed)", report["income.developed"] ? money(income.indicated) : ""],
          ]}
        />
        <Narrative label="Reconciliation" text={comments.reconciliation} />
        <p>
          This appraisal is made <b>{v("reconciliation.basis").toLowerCase() || "[as is / subject to]"}</b>.
          {v("reconciliation.conditions") && ` ${v("reconciliation.conditions")}`}
        </p>
        <p className="rounded border border-foreground/40 p-2 font-medium">
          Based on a complete visual inspection of the interior and exterior areas of the subject property, defined scope
          of work, statement of assumptions and limiting conditions, and appraiser&apos;s certification, my opinion of the
          market value, as defined, of the real property that is the subject of this report is{" "}
          <b>{v("reconciliation.finalValue") || "$______"}</b>, as of <b>{v("assignment.effectiveDate") || "______"}</b>,
          which is the date of inspection and the effective date of this appraisal.
        </p>
      </Section>

      {v("reconciliation.additionalComments") && (
        <Section title="Additional comments">
          <p className="whitespace-pre-wrap">{v("reconciliation.additionalComments")}</p>
        </Section>
      )}

      {report["cost.developed"] === true && (
        <Section title="Cost approach to value">
          <Narrative label="Support for the opinion of site value" text={v("cost.siteValueSupport")} />
          <Pairs
            items={[
              ["Source of cost data", v("cost.source")],
              ["Quality rating from cost service", v("cost.qualityRating")],
              ["Effective date of cost data", v("cost.effectiveDate")],
              ["Opinion of site value", money(cost.siteValue)],
              ["Dwelling", subject.gla == null ? "" : `${subject.gla.toLocaleString()} sq ft @ ${v("cost.dwellingPerSqFt")} = ${money(cost.dwelling)}`],
              ["Garage/carport", v("cost.garageSqFt") ? `${v("cost.garageSqFt")} sq ft @ ${v("cost.garagePerSqFt")} = ${money(cost.garage)}` : ""],
              ["Other improvements", v("cost.otherCost")],
              ["Total estimate of cost-new", money(cost.costNew)],
              ["Less depreciation", money(cost.depreciation)],
              ["Depreciated cost of improvements", money(cost.depreciated)],
              ["As-is value of site improvements", v("cost.siteImprovements")],
              ["Indicated value by cost approach", money(cost.indicated)],
              ["Remaining economic life", v("cost.remainingLife") && `${v("cost.remainingLife")} years`],
            ]}
          />
          <Narrative label="Comments on cost approach" text={v("cost.comments")} />
        </Section>
      )}

      {report["income.developed"] === true && (
        <Section title="Income approach to value">
          <Pairs
            items={[
              ["Estimated monthly market rent", money(income.rent)],
              ["Gross rent multiplier", v("income.grm")],
              ["Indicated value by income approach", money(income.indicated)],
            ]}
          />
          <Narrative label="Summary of income approach" text={v("income.comments")} />
        </Section>
      )}

      <Section title="Market conditions addendum (1004MC)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse tabular-nums">
            <thead>
              <tr>
                <Th>Inventory analysis</Th>
                {MC_PERIODS.map((p) => (
                  <Th key={p.id}>{p.label}</Th>
                ))}
                <Th>Overall trend</Th>
              </tr>
            </thead>
            <tbody>
              {MC_ROWS.map((row) => (
                <tr key={row.id}>
                  <Td>{row.label}</Td>
                  {MC_PERIODS.map((p) => (
                    <Td key={p.id} className="text-right">
                      {formatValue({ type: row.type }, report[mcKey(row.id, p.id)])}
                      {row.id === "saleToList" && report[mcKey(row.id, p.id)] != null ? "%" : ""}
                    </Td>
                  ))}
                  <Td>{v(mcKey(row.id, "trend"))}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pairs
          items={[
            ["Seller-paid financial assistance prevalent", v("market.assistancePrevalent")],
            ["Foreclosure sales (REO) a factor", v("market.foreclosureFactor")],
            ["Data sources", v("market.dataSources")],
          ]}
        />
        <Narrative label="Trends in seller concessions" text={v("market.assistanceTrend")} />
        <Narrative label="Foreclosure and short sale activity" text={v("market.foreclosureTrend")} />
        <Narrative label="Summary of market conditions" text={v("market.summary")} />
      </Section>

      <Section title="Appraiser">
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <div className="space-y-1">
            <div className="h-10 border-b border-foreground/60" aria-label="Signature line" />
            <Pairs
              single
              items={[
                ["Name", v("appraiser.name")],
                ["Company", v("appraiser.company")],
                ["Company address", v("appraiser.address")],
                ["Phone / email", [v("appraiser.phone"), v("appraiser.email")].filter(Boolean).join(" · ")],
                ["Date of signature and report", v("appraiser.signatureDate")],
                ["Effective date of appraisal", v("assignment.effectiveDate")],
                ["Credential", v("appraiser.licenseType")],
                ["License/certification #", v("appraiser.licenseNumber")],
                ["State", v("appraiser.licenseState")],
                ["Expiration date", v("appraiser.licenseExpiration")],
              ]}
            />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Address of property appraised</p>
            <p>{address}</p>
            <p className="pt-2 font-medium">Appraised value of subject property</p>
            <p>{v("reconciliation.finalValue")}</p>
            <p className="pt-2 font-medium">Lender/client</p>
            <p>{v("assignment.clientName")}</p>
            <p>{v("assignment.clientAddress")}</p>
          </div>
        </div>
      </Section>
    </article>
  );
}

function cars(n: unknown) {
  return typeof n === "number" ? `${n} car${n === 1 ? "" : "s"}` : "";
}

function pctOf(s: string) {
  return s ? `${s}%` : "";
}

function basementFinish(p: Property) {
  if (!p.basementSqFt) return "";
  return `${Math.round(((p.basementFinishedSqFt ?? 0) / p.basementSqFt) * 100)}%`;
}

function appliances(report: ReportData) {
  const names: [string, string][] = [
    ["refrigerator", "Refrigerator"], ["range", "Range/oven"], ["dishwasher", "Dishwasher"],
    ["disposal", "Disposal"], ["microwave", "Microwave"], ["washerDryer", "Washer/dryer"],
  ];
  return names.filter(([k]) => report[`improvements.${k}`] === true).map(([, label]) => label).join(", ");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section break-inside-avoid-page space-y-2 border border-foreground/30">
      <h2 className="bg-foreground/[0.06] px-2 py-1 text-[11px] font-bold uppercase tracking-wider">{title}</h2>
      <div className="space-y-2 px-2 pb-2">{children}</div>
    </section>
  );
}

function Pairs({ items, single }: { items: [string, string | null | undefined][]; single?: boolean }) {
  return (
    <dl className={`grid grid-cols-1 gap-x-4 ${single ? "" : "sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3"}`}>
      {items.map(([label, value], i) => (
        <div key={`${label}-${i}`} className="flex min-w-0 items-baseline justify-between gap-2 border-b border-foreground/10 py-0.5">
          <dt className="min-w-0 text-muted">{label}</dt>
          <dd className={`min-w-0 text-right tabular-nums ${value ? "font-medium" : "text-muted/60"}`}>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Narrative({ label, text }: { label: string; text: string | null | undefined }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <p className={`whitespace-pre-wrap ${text ? "" : "text-muted/60"}`}>{text || "—"}</p>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="border border-foreground/20 px-1.5 py-1 text-left font-semibold">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`border border-foreground/20 px-1.5 py-1 align-top ${className}`}>{children}</td>;
}

type Row = { label: string; subject: string; comp: (c: Comp) => string; adjust?: string[] };

function SalesGrid({
  subject,
  sold,
  results,
  report,
}: {
  subject: Property;
  sold: { comp: Comp; n: number }[];
  results: ReturnType<typeof adjustComp>[];
  report: ReportData;
}) {
  const perGla = (price: number | null | undefined, gla: number | null) => (price && gla ? money(price / gla) : "");
  const contractPrice = typeof report["contract.price"] === "number" ? report["contract.price"] : null;
  const age = (p: Property) => actualAge(p.yearBuilt, report)?.toString() ?? "";
  const sqft = (n: number | null) => (n == null ? "" : n.toLocaleString());
  const rows: Row[] = [
    { label: "Address", subject: subject.address ?? "", comp: (c) => c.address ?? "" },
    { label: "Sale price", subject: contractPrice == null ? "" : money(contractPrice), comp: (c) => money(c.salePrice) },
    { label: "Sale price/GLA", subject: perGla(contractPrice, subject.gla), comp: (c) => perGla(c.salePrice, c.gla) },
    { label: "Data source(s)", subject: "", comp: (c) => c.dataSource ?? "" },
    {
      label: "Sale type; financing; concessions",
      subject: "",
      comp: (c) => [c.saleType, c.financing, c.concessions != null ? money(c.concessions) : null].filter(Boolean).join("; "),
      adjust: ["Concessions"],
    },
    { label: "Date of sale", subject: "", comp: (c) => c.saleDate ?? "" },
    { label: "Site", subject: sqft(subject.lotSizeSqFt), comp: (c) => sqft(c.lotSizeSqFt), adjust: ["Site"] },
    { label: "View", subject: subject.view ?? "", comp: (c) => c.view ?? "" },
    { label: "Design (style)", subject: subject.design ?? "", comp: (c) => c.design ?? "" },
    { label: "Quality of construction", subject: rating("Q", subject.quality), comp: (c) => rating("Q", c.quality), adjust: ["Quality"] },
    { label: "Actual age", subject: age(subject), comp: (c) => age(c), adjust: ["Age"] },
    { label: "Condition", subject: rating("C", subject.condition), comp: (c) => rating("C", c.condition), adjust: ["Condition"] },
    {
      label: "Bedrooms / baths",
      subject: [subject.bedrooms, subject.fullBaths == null ? null : `${subject.fullBaths}.${subject.halfBaths ?? 0}`].filter((x) => x != null).join(" / "),
      comp: (c) => [c.bedrooms, c.fullBaths == null ? null : `${c.fullBaths}.${c.halfBaths ?? 0}`].filter((x) => x != null).join(" / "),
      adjust: ["Full baths", "Half baths"],
    },
    { label: "Gross living area", subject: sqft(subject.gla), comp: (c) => sqft(c.gla), adjust: ["GLA"] },
    {
      label: "Basement & finished",
      subject: [sqft(subject.basementSqFt), sqft(subject.basementFinishedSqFt)].filter(Boolean).join(" / "),
      comp: (c) => [sqft(c.basementSqFt), sqft(c.basementFinishedSqFt)].filter(Boolean).join(" / "),
      adjust: ["Basement", "Finished bsmt"],
    },
    { label: "Heating/cooling", subject: subject.heatingCooling ?? "", comp: (c) => c.heatingCooling ?? "" },
    {
      label: "Garage/carport",
      subject: subject.garageSpaces == null ? "" : `${subject.garageSpaces} car`,
      comp: (c) => (c.garageSpaces == null ? "" : `${c.garageSpaces} car`),
      adjust: ["Garage"],
    },
    {
      label: "Fireplaces / pool",
      subject: [subject.fireplaces, subject.pool == null ? null : subject.pool ? "Pool" : "No pool"].filter((x) => x != null).join(" / "),
      comp: (c) => [c.fireplaces, c.pool == null ? null : c.pool ? "Pool" : "No pool"].filter((x) => x != null).join(" / "),
      adjust: ["Fireplaces", "Pool"],
    },
  ];

  if (!sold.length) return <p className="text-muted">No comparable sales yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse tabular-nums">
        <thead>
          <tr>
            <Th>Feature</Th>
            <Th>Subject</Th>
            {sold.map(({ n }) => (
              <th key={n} colSpan={2} className="border border-foreground/20 px-1.5 py-1 text-left font-semibold">
                Comparable sale #{n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <Td className="font-medium">{row.label}</Td>
              <Td>{row.subject}</Td>
              {sold.map(({ comp, n }, i) => {
                const amount = row.adjust
                  ? results[i].lines.filter((l) => row.adjust!.includes(l.label)).reduce((s, l) => s + l.amount, 0)
                  : null;
                return [
                  <Td key={`${n}-d`}>{row.comp(comp)}</Td>,
                  <Td key={`${n}-a`} className="text-right">
                    {amount ? `${amount > 0 ? "+" : ""}${money(amount)}` : row.adjust ? "0" : ""}
                  </Td>,
                ];
              })}
            </tr>
          ))}
          <tr>
            <Td className="font-medium">Net adjustment (total)</Td>
            <Td />
            {results.map((r, i) => [
              <Td key={`${i}-p`}>
                Net {pctText(r.netPct)} · Gross {pctText(r.grossPct)}
              </Td>,
              <Td key={`${i}-n`} className="text-right">{money(r.net)}</Td>,
            ])}
          </tr>
          <tr className="font-semibold">
            <Td>Adjusted sale price</Td>
            <Td />
            {results.map((r, i) => (
              <td key={i} colSpan={2} className="border border-foreground/20 px-1.5 py-1 text-right">
                {money(r.adjustedPrice)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const rating = (prefix: string, n: number | null) => (n == null ? "" : `${prefix}${n}`);
const pctText = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);
