"use client";

import { type Property, adjustComp } from "@/lib/appraisal";
import { FIELD_BY_KEY, MC_PERIODS, type McRow, type ReportData, formatValue, mcKey } from "@/lib/report";
import { costApproach, incomeApproach } from "@/lib/valuation";
import { money } from "./fields";
import {
  McTable,
  Narrative,
  Pairs,
  PriorSales,
  type Props,
  SalesGrid,
  Section,
  Td,
  Th,
  appliances,
  basementFinish,
  cars,
  pctOf,
  rating,
} from "./ReportView";

// The redesigned URAR (UAD 3.6) in its section order. Like the real form,
// sections that don't apply to this property (a manufactured home, a
// project, an approach that wasn't developed) are left out.
export default function ReportViewUad36({ subject, comps, rates, report, comments, defects = [] }: Props) {
  const v = (key: string) => {
    const field = FIELD_BY_KEY.get(key);
    return field ? formatValue(field, report[key]) : "";
  };
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ");
  const sold = comps.map((c, i) => ({ comp: c, n: i + 1 })).filter(({ comp }) => comp.salePrice != null);
  const results = sold.map(({ comp }) => adjustComp(subject, comp, rates));
  const cost = costApproach(report, subject);
  const income = incomeApproach(report);
  const address = [subject.address, subject.city, subject.state, subject.zip].filter(Boolean).join(", ");
  const sqft = (n: number | null | undefined) => (n == null ? "" : `${n.toLocaleString()} sq ft`);
  const baths = (p: Property) => (p.fullBaths == null ? "" : `${p.fullBaths} full, ${p.halfBaths ?? 0} half`);

  const manufactured = report["uad.constructionMethod"] === "Manufactured";
  const outbuilding = typeof report["uad.outbuildingType"] === "string" && report["uad.outbuildingType"] !== "None";
  const project = report["assignment.pud"] === true;
  const purchase = report["assignment.assignmentType"] === "Purchase" || report["contract.price"] != null;
  const rented = report["uad.currentlyRented"] === true || report["uad.monthlyRent"] != null;
  const omitted = [
    !manufactured && "Manufactured Home",
    !outbuilding && "Outbuilding",
    !project && "Project Information",
    !purchase && "Sales Contract",
    !rented && "Rental Information",
    report["income.developed"] !== true && "Income Approach",
    report["cost.developed"] !== true && "Cost Approach",
    !v("uad.revisionHistory") && "Revision History",
  ].filter(Boolean);

  return (
    <article className="report mx-auto max-w-[8.5in] space-y-4 bg-surface text-[12px] leading-snug">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-foreground pb-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Uniform Residential Appraisal Report</h1>
          <p className="text-muted">{address || "Subject address"}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Redesigned URAR · UAD 3.6</p>
          <p className="tabular-nums">File # {v("assignment.fileNumber") || "—"}</p>
        </div>
      </header>

      <Section title="Summary">
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-foreground/40 p-2">
          <span>
            Opinion of market value <b className="text-base">{v("reconciliation.finalValue") || "$______"}</b>{" "}
            {valueCondition(report["reconciliation.basis"])}
          </span>
          <span>Effective date <b>{v("assignment.effectiveDate") || "______"}</b></span>
        </div>
        <Pairs
          items={[
            ["Assignment reason", v("assignment.assignmentType")],
            ["Borrower", v("assignment.borrower")],
            ["Current owner of public record", subject.ownerOfRecord],
            ["Contract price", v("contract.price")],
            ["Listing status", v("uad.listingStatus")],
            ["Property valuation method", v("uad.valuationMethod")],
            ["Appraiser", v("appraiser.name")],
            ["Construction method", v("uad.constructionMethod")],
            ["Attachment type", attachment(report["improvements.type"])],
            ["Structure design", v("uad.structureDesign")],
            ["Planned unit development", v("assignment.pud")],
            ["Property rights appraised", v("assignment.propertyRights")],
            ["Highest and best use as present use", v("site.highestBestUse")],
            ["Property restrictions", v("uad.restrictions") || "None"],
            ["Encroachments", v("uad.encroachments") || "None"],
            ["Zoning compliance", v("site.zoningCompliance")],
            ["Overall quality", rating("Q", subject.quality)],
            ["Overall condition", rating("C", subject.condition)],
            ...(v("uad.asIsCondition") ? [["As-is overall condition", v("uad.asIsCondition")] as [string, string]] : []),
          ]}
        />
        <DefectTable defects={defects} />
      </Section>

      <Section title="Assignment information">
        <Pairs
          items={[
            ["Assignment reason", v("assignment.assignmentType")],
            ["Borrower", v("assignment.borrower")],
            ["Seller", v("uad.seller")],
            ["Current owner of public record", subject.ownerOfRecord],
            ["Property valuation method", v("uad.valuationMethod")],
            ["Property data report used", v("uad.propertyDataReport")],
            ["Government agency appraisal", v("uad.governmentAgency")],
            ["Investor special identification", v("uad.investorId")],
            ["Lender/client", v("assignment.clientName")],
            ["Client address", v("assignment.clientAddress")],
            ["Appraisal management company", v("uad.amcName")],
            ["Appraiser fee", v("uad.appraiserFee")],
            ["AMC fee", v("uad.amcFee")],
            ["Exterior inspection", v("uad.exteriorInspection")],
            ["Interior inspection", v("uad.interiorInspection")],
            ["Inspection date", v("assignment.inspectionDate")],
          ]}
        />
        <Narrative label="Assignment information and scope of work" text={v("uad.scopeOfWork")} />
      </Section>

      <Section title="Subject property">
        <Pairs
          items={[
            ["Property address", subject.address],
            ["City", subject.city],
            ["State", subject.state],
            ["Zip", subject.zip],
            ["County", subject.county],
            ["Assessor's parcel #", subject.parcelNumber],
            ["Legal description", v("assignment.legalDescription")],
            ["Census tract", subject.censusTract],
            ["Map reference", v("assignment.mapReference")],
            ["Neighborhood name", v("assignment.neighborhoodName")],
            ["Occupant", v("assignment.occupant")],
            ["Tax year", v("assignment.taxYear")],
            ["R.E. taxes", v("assignment.taxes")],
            ["Special assessments", v("assignment.specialAssessments")],
            ["HOA", join(v("assignment.hoaDues"), v("assignment.hoaPeriod"))],
          ]}
        />
      </Section>

      <Section title="Site">
        <Pairs
          items={[
            ["Dimensions", v("site.dimensions")],
            ["Area", sqft(subject.lotSizeSqFt)],
            ["Shape", v("site.shape")],
            ["View", subject.view],
            ["Zoning classification", subject.zoning],
            ["Zoning description", v("site.zoningDescription")],
            ["Zoning compliance", v("site.zoningCompliance")],
            ["Electricity", v("site.electricity")],
            ["Gas", v("site.gas")],
            ["Water", v("site.water")],
            ["Sanitary sewer", v("site.sewer")],
            ["Street", join(v("site.street"), v("site.streetType"))],
            ["Alley", v("site.alley")],
            ["FEMA special flood hazard area", v("site.floodHazard")],
            ["FEMA flood zone", v("site.floodZone")],
            ["FEMA map # / date", join(v("site.floodMap"), v("site.floodMapDate"))],
            ["Adverse site conditions", v("site.adverseConditions")],
            ["Encroachments", v("uad.encroachments") || "None"],
          ]}
        />
        <Narrative label="Site commentary" text={v("site.comments")} />
      </Section>

      <Section title="Disaster mitigation">
        <Pairs single items={[["Disaster mitigation features", v("uad.disasterFeatures") || "None noted"]]} />
        {v("uad.disasterCommentary") && <Narrative label="Commentary" text={v("uad.disasterCommentary")} />}
      </Section>

      <Section title="Energy efficient and green features">
        <Pairs
          items={[
            ["Renewable energy components", v("uad.renewableEnergy") || "None"],
            ["Building certifications", v("uad.buildingCertifications") || "None"],
            ["Efficiency ratings", v("uad.efficiencyRatings") || "None"],
            ["Impact on value and marketability", v("uad.greenImpact")],
          ]}
        />
        {v("uad.greenCommentary") && <Narrative label="Commentary" text={v("uad.greenCommentary")} />}
      </Section>

      <Section title="Sketch">
        <p className="text-muted">
          Attach the floor plan sketch with ANSI Z765-2021 area calculations from TOTAL. Gross living area:{" "}
          <b className="text-foreground">{sqft(subject.gla) || "—"}</b>.
        </p>
      </Section>

      <Section title="Dwelling exterior">
        <Pairs
          items={[
            ["Structure design", v("uad.structureDesign")],
            ["Attachment type", attachment(report["improvements.type"])],
            ["Construction method", v("uad.constructionMethod")],
            ["Design (style)", subject.design],
            ["Year built", subject.yearBuilt?.toString()],
            ["Effective age", v("improvements.effectiveAge")],
            ["Stories above grade", v("improvements.stories")],
            ["Stories below grade", v("uad.storiesBelowGrade")],
            ["Status", v("improvements.status")],
            ["Exterior walls and trim", v("improvements.exteriorWalls")],
            ["Roof cover", v("improvements.roofSurface")],
            ["Roof structure", v("uad.roofStructure")],
            ["Gutters and downspouts", v("improvements.gutters")],
            ["Window type", v("improvements.windowType")],
            ["Storm sash/screens", join(v("improvements.stormSash"), v("improvements.screens"))],
            ["Foundation", v("improvements.foundation")],
            ["Foundation walls", v("improvements.foundationWalls")],
            ["Basement area", sqft(subject.basementSqFt)],
            ["Basement finish", basementFinish(subject)],
            ["Basement outside entry", v("improvements.basementOutsideEntry")],
            ["Sump pump", v("improvements.sumpPump")],
            ["Evidence of", v("improvements.evidenceOf")],
          ]}
        />
        <Narrative label="Dwelling exterior commentary" text={v("uad.exteriorCommentary")} />
      </Section>

      {manufactured && (
        <Section title="Manufactured home">
          <p className="text-muted">Enter the HUD label numbers, data plate and installation details in TOTAL.</p>
        </Section>
      )}

      <Section title="Unit interior">
        <Pairs
          items={[
            ["Above grade finished area", sqft(subject.gla)],
            ["Below grade finished area", sqft(subject.basementFinishedSqFt)],
            ["Rooms", v("improvements.totalRooms")],
            ["Bedrooms", subject.bedrooms?.toString()],
            ["Bathrooms", baths(subject)],
            ["Accessory dwelling unit", v("uad.adu")],
            ["Heating", join(v("improvements.heating"), v("improvements.fuel"))],
            ["Cooling", v("improvements.cooling")],
            ["Flooring", v("improvements.floors")],
            ["Walls and ceiling", v("improvements.walls")],
            ["Trim/finish", v("improvements.trim")],
            ["Bath floor / wainscot", join(v("improvements.bathFloor"), v("improvements.bathWainscot"))],
            ["Attic", v("improvements.attic")],
            ["Appliances", appliances(report)],
            ["Accessibility features", v("uad.accessibility") || "None"],
          ]}
        />
        <Narrative label="Additional features" text={v("improvements.additionalFeatures")} />
        <Narrative label="Unit interior commentary" text={v("uad.interiorCommentary")} />
      </Section>

      <Section title="Functional obsolescence">
        <Pairs single items={[["Functional obsolescence features", v("uad.functionalFeatures") || "None noted"]]} />
        {v("uad.functionalCommentary") && <Narrative label="Commentary" text={v("uad.functionalCommentary")} />}
      </Section>

      {outbuilding && (
        <Section title="Outbuilding">
          <Pairs
            items={[
              ["Outbuilding type", v("uad.outbuildingType")],
              ["Area", v("uad.outbuildingArea") && `${v("uad.outbuildingArea")} sq ft`],
              ["Year built", report["uad.outbuildingYear"] == null ? "" : String(report["uad.outbuildingYear"])],
            ]}
          />
          <Narrative label="Outbuilding commentary" text={v("uad.outbuildingCommentary")} />
        </Section>
      )}

      <Section title="Vehicle storage">
        <Pairs
          items={[
            ["Vehicle storage type", v("uad.vehicleStorage")],
            ["Parking spaces", v("uad.parkingSpaces") || cars(subject.garageSpaces)],
            ["Garage", join(cars(subject.garageSpaces), v("improvements.garageType"))],
            ["Carport", v("improvements.carportCars")],
            ["Driveway", join(cars(report["improvements.drivewayCars"]), v("improvements.drivewaySurface"))],
            ["Space assignment", v("uad.parkingAssignment")],
          ]}
        />
        {v("uad.vehicleCommentary") && <Narrative label="Commentary" text={v("uad.vehicleCommentary")} />}
      </Section>

      <Section title="Subject property amenities">
        <Pairs
          items={[
            ["Fireplaces", subject.fireplaces?.toString()],
            ["Woodstoves", v("improvements.woodstoves")],
            ["Patio/deck", v("improvements.patioDeck")],
            ["Porch", v("improvements.porch")],
            ["Pool", subject.pool == null ? "" : subject.pool ? "Yes" : "No"],
            ["Fence", v("improvements.fence")],
            ["Other", v("improvements.otherAmenities")],
          ]}
        />
        {v("uad.amenitiesCommentary") && <Narrative label="Commentary" text={v("uad.amenitiesCommentary")} />}
      </Section>

      <Section title="Overall quality and condition">
        <Pairs
          items={[
            ["Overall quality", rating("Q", subject.quality)],
            ["Overall condition", rating("C", subject.condition)],
            ["As-is overall condition", v("uad.asIsCondition")],
            ["Conforms to the neighborhood", v("improvements.conforms")],
          ]}
        />
        <Narrative label="Condition of the property" text={comments.subjectImprovements} />
        <Narrative label="Reconciliation of overall quality and condition" text={v("uad.qualityConditionCommentary")} />
      </Section>

      <Section title="Highest and best use">
        <Pairs single items={[["Highest and best use as improved is the present use", v("site.highestBestUse")]]} />
        <Narrative label="Highest and best use commentary" text={v("uad.hbuCommentary")} />
      </Section>

      <Section title="Market">
        <Narrative label="Market area boundary" text={v("neighborhood.boundaries")} />
        <Narrative label="Search criteria" text={v("uad.searchCriteria")} />
        <Pairs
          items={[
            ["Location", v("neighborhood.location")],
            ["Built-up", v("neighborhood.builtUp")],
            ["Property values", v("neighborhood.propertyValues")],
            ["Demand/supply", v("neighborhood.demandSupply")],
            ["Marketing time", v("neighborhood.marketingTime")],
            ["Percent of distressed sales", pctOf(v("uad.distressedPct"))],
            ["One-unit price range", [v("neighborhood.priceLow"), v("neighborhood.priceHigh")].filter(Boolean).join(" to ")],
            ["Predominant price", v("neighborhood.pricePredominant")],
            ["Data sources", v("market.dataSources")],
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:grid-cols-3">
          <MarketChart report={report} row="absorption" title="Absorption rate (sales per month)" />
          <MarketChart report={report} row="medianSaleDom" title="Median days on market" />
          <MarketChart report={report} row="medianSalePrice" title="Price trend (median sale price)" />
        </div>
        <McTable report={report} />
        <Narrative label="Market characteristics" text={v("uad.marketCharacteristics") || comments.neighborhood} />
        <Narrative label="Market commentary" text={[comments.marketConditions, v("market.summary")].filter(Boolean).join("\n\n")} />
      </Section>

      {project && (
        <Section title="Project information">
          <Pairs
            items={[
              ["Planned unit development", v("assignment.pud")],
              ["HOA dues", join(v("assignment.hoaDues"), v("assignment.hoaPeriod"))],
            ]}
          />
          <p className="text-muted">Enter the project amenities and project factors in TOTAL.</p>
        </Section>
      )}

      <Section title="Subject listing information">
        <Pairs
          items={[
            ["Current or relevant listings", v("assignment.offeredForSale")],
            ["Listing status", v("uad.listingStatus")],
            ["List price", v("uad.listPrice")],
            ["List date", v("uad.listDate")],
            ["Off market date", v("uad.offMarketDate")],
            ["Days on market", v("uad.listDom")],
          ]}
        />
        <Narrative label="Analysis of subject property listing history" text={v("assignment.offeringHistory")} />
      </Section>

      {purchase && (
        <Section title="Sales contract">
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
          <Narrative label="Contract analysis" text={v("contract.analysis")} />
        </Section>
      )}

      <Section title="Prior sale and transfer history">
        <Pairs
          items={[
            ["Subject prior sales/transfers (3 years) found", v("sales.subjectPriorFound")],
            ["Data source", v("sales.subjectPriorSource")],
            ["Comparable prior sales/transfers (1 year) found", v("sales.compPriorFound")],
            ["Data source", v("sales.compPriorSource")],
          ]}
        />
        <PriorSales subject={subject} sold={sold} />
        <Narrative label="Analysis of prior sale or transfer history" text={v("sales.priorAnalysis")} />
      </Section>

      <Section title="Sales comparison approach">
        <p>
          There are {v("sales.listingsCount") || "__"} comparable listings ranging from {v("sales.listingsLow") || "$__"} to{" "}
          {v("sales.listingsHigh") || "$__"}, and {v("sales.salesCount") || "__"} comparable sales in the past twelve months
          ranging from {v("sales.salesLow") || "$__"} to {v("sales.salesHigh") || "$__"}.
        </p>
        <SalesGrid subject={subject} sold={sold} results={results} report={report} />
        <Narrative label="Sales comparison approach commentary" text={comments.salesComparison} />
        <Pairs items={[["Indicated value by sales comparison approach", v("sales.indicatedValue")]]} />
      </Section>

      {rented && (
        <Section title="Rental information">
          <Pairs
            items={[
              ["Currently rented", v("uad.currentlyRented")],
              ["Current monthly rent", v("uad.monthlyRent")],
              ["Lease start date", v("uad.leaseStart")],
            ]}
          />
          <Narrative label="Rental information commentary" text={v("uad.rentalCommentary")} />
        </Section>
      )}

      {report["income.developed"] === true && (
        <Section title="Income approach">
          <Pairs
            items={[
              ["Estimated monthly market rent", money(income.rent)],
              ["Gross rent multiplier", v("income.grm")],
              ["Indicated value by income approach", money(income.indicated)],
            ]}
          />
          <Narrative label="Income approach commentary" text={v("income.comments")} />
        </Section>
      )}

      {report["cost.developed"] === true && (
        <Section title="Cost approach">
          <Pairs
            items={[
              ["Opinion of site value", money(cost.siteValue)],
              ["Source of cost data", v("cost.source")],
              ["Effective date of cost data", v("cost.effectiveDate")],
              ["Total estimate of cost-new", money(cost.costNew)],
              ["Less depreciation", money(cost.depreciation)],
              ["As-is value of site improvements", v("cost.siteImprovements")],
              ["Indicated value by cost approach", money(cost.indicated)],
              ["Remaining economic life", v("cost.remainingLife") && `${v("cost.remainingLife")} years`],
            ]}
          />
          <Narrative label="Support for the opinion of site value" text={v("cost.siteValueSupport")} />
          <Narrative label="Cost approach commentary" text={v("cost.comments")} />
        </Section>
      )}

      <Section title="Reconciliation">
        <Pairs
          items={[
            ["Sales comparison approach", v("sales.indicatedValue")],
            ["Cost approach", report["cost.developed"] ? money(cost.indicated) : "Not developed"],
            ["Income approach", report["income.developed"] ? money(income.indicated) : "Not developed"],
          ]}
        />
        <Narrative label="Reconciliation commentary" text={comments.reconciliation} />
        {v("reconciliation.conditions") && <Narrative label="Conditions of the appraisal" text={v("reconciliation.conditions")} />}
        <p className="rounded border border-foreground/40 p-2 font-medium">
          My opinion of the market value of the subject property, as of <b>{v("assignment.effectiveDate") || "______"}</b>,
          is <b>{v("reconciliation.finalValue") || "$______"}</b> {valueCondition(report["reconciliation.basis"])}.
        </p>
      </Section>

      {v("uad.revisionHistory") && (
        <Section title="Revision history">
          <p className="whitespace-pre-wrap">{v("uad.revisionHistory")}</p>
        </Section>
      )}

      {(v("uad.supplemental") || v("reconciliation.additionalComments")) && (
        <Section title="Supplemental information">
          <p className="whitespace-pre-wrap">{[v("uad.supplemental"), v("reconciliation.additionalComments")].filter(Boolean).join("\n\n")}</p>
        </Section>
      )}

      <Section title="Certifications and scope of work">
        <p className="text-muted">
          The GSE scope of work, assumptions, limiting conditions and appraiser certifications for the redesigned URAR
          print here from TOTAL.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <div className="space-y-1">
            <div className="h-10 border-b border-foreground/60" aria-label="Signature line" />
            <Pairs
              single
              items={[
                ["Appraiser", v("appraiser.name")],
                ["Company", v("appraiser.company")],
                ["Company address", v("appraiser.address")],
                ["Phone / email", [v("appraiser.phone"), v("appraiser.email")].filter(Boolean).join(" · ")],
                ["Credential level", v("appraiser.licenseType")],
                ["Credential # / state", join(v("appraiser.licenseNumber"), v("appraiser.licenseState"))],
                ["Credential expires", v("appraiser.licenseExpiration")],
                ["Date of signature and report", v("appraiser.signatureDate")],
              ]}
            />
          </div>
          <div className="space-y-1">
            <Pairs
              single
              items={[
                ["Exterior inspection", v("uad.exteriorInspection")],
                ["Interior inspection", v("uad.interiorInspection")],
                ["Inspection date", v("assignment.inspectionDate")],
                ["Effective date", v("assignment.effectiveDate")],
                ["Opinion of market value", v("reconciliation.finalValue")],
              ]}
            />
          </div>
        </div>
      </Section>

      {omitted.length > 0 && (
        <p className="text-[11px] text-muted print:hidden">Not applicable to this report: {omitted.join(", ")}.</p>
      )}
    </article>
  );
}

function valueCondition(basis: ReportData[string]) {
  if (typeof basis !== "string") return "";
  if (basis.startsWith("Subject to completion")) return "subject to completion";
  if (basis.startsWith("Subject to repairs")) return "subject to repair";
  if (basis.startsWith("Subject to inspection")) return "subject to inspection";
  return "as is";
}

// Form 1004's Det./Att./S-Det. become UAD 3.6's Detached or Attached; a
// semi-detached home is Attached with a Semi-Detached structure design.
function attachment(type: ReportData[string]) {
  if (type === "Det.") return "Detached";
  if (type === "Att." || type === "S-Det./End Unit") return "Attached";
  return "";
}

function DefectTable({ defects }: { defects: NonNullable<Props["defects"]> }) {
  const rows = defects.filter((d) => d.feature || d.description);
  if (!rows.length) return <Pairs single items={[["Apparent defects, damages, deficiencies", "None noted"]]} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <Th>Feature</Th>
            <Th>Location</Th>
            <Th>Description</Th>
            <Th>Affects soundness</Th>
            <Th>Recommended action</Th>
            <Th>Cost to cure</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => (
            <tr key={i}>
              <Td>{d.feature}</Td>
              <Td>{d.location}</Td>
              <Td>{d.description}</Td>
              <Td>{d.affectsSoundness == null ? "" : d.affectsSoundness ? "Yes" : "No"}</Td>
              <Td>{d.action}</Td>
              <Td className="text-right tabular-nums">{d.cost == null ? "" : money(d.cost)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A small bar chart of one 1004MC figure across the three periods, oldest first.
function MarketChart({ report, row, title }: { report: ReportData; row: McRow; title: string }) {
  const values = MC_PERIODS.map((p) => {
    const n = report[mcKey(row, p.id)];
    return typeof n === "number" ? n : null;
  });
  const max = Math.max(0, ...values.map((n) => n ?? 0));
  const label = (n: number) => (row === "medianSalePrice" ? `$${Math.round(n / 1000)}k` : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));
  const short = ["7-12 mo", "4-6 mo", "0-3 mo"];
  const W = 180, H = 92, base = 74, top = 14, bar = 36;
  return (
    <figure className="min-w-0 rounded border border-foreground/20 p-1.5">
      <figcaption className="text-muted">{title}</figcaption>
      {max === 0 ? (
        <p className="py-6 text-center text-muted/60">No data</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={title}>
          <line x1="4" x2={W - 4} y1={base} y2={base} className="stroke-foreground/40" strokeWidth="1" />
          {values.map((n, i) => {
            const x = 12 + i * 58;
            const h = n == null ? 0 : ((base - top) * n) / max;
            return (
              <g key={i}>
                {n != null && <rect x={x} y={base - h} width={bar} height={h} className="fill-foreground/55" />}
                <text x={x + bar / 2} y={base - h - 3} textAnchor="middle" className="fill-foreground" fontSize="9">
                  {n == null ? "—" : label(n)}
                </text>
                <text x={x + bar / 2} y={base + 12} textAnchor="middle" className="fill-muted" fontSize="9">
                  {short[i]}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </figure>
  );
}
