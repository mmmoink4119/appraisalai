// The parts of the appraisal report beyond the property characteristics and
// comps: assignment, contract, neighborhood, site, improvements, cost and
// income approaches, reconciliation and the appraiser's certification.
// Sections and field names follow the URAR (Fannie Mae Form 1004), plus the
// extra items the redesigned URAR (UAD 3.6) asks for, keyed "uad.*".
//
// Every field is defined once here and drives the section forms, document
// extraction and the printed report. Values live in a flat record keyed by
// the field key, e.g. "contract.price".

export type FieldType = "text" | "longtext" | "number" | "money" | "date" | "bool" | "select";
export type ReportValue = string | number | boolean | null;
export type ReportData = Record<string, ReportValue>;

export type ReportField = {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  // Shown to the extraction model, never in the form.
  hint?: string;
};
export type ReportGroup = { title: string; fields: ReportField[] };

// The redesigned URAR is required for appraisals delivered from Nov 2, 2026;
// Form 1004 stays acceptable under a GSE exception until May 19, 2027.
export const REPORT_FORMS = ["Form 1004 (UAD 2.6)", "Redesigned URAR (UAD 3.6)"] as const;
export const isUad36 = (report: ReportData) => report["assignment.form"] === REPORT_FORMS[1];

const f = (key: string, label: string, type: FieldType, extra: Partial<ReportField> = {}): ReportField => ({
  key, label, type, ...extra,
});

export const ASSIGNMENT_GROUPS: ReportGroup[] = [
  {
    title: "Assignment",
    fields: [
      f("assignment.form", "Report form", "select", { options: REPORT_FORMS, hint: "Only fill if a document names the form" }),
      f("assignment.clientName", "Lender/client", "text"),
      f("assignment.clientAddress", "Lender/client address", "text"),
      f("assignment.borrower", "Borrower", "text"),
      f("assignment.fileNumber", "File #", "text", { hint: "Appraiser's or lender's file/loan number" }),
      f("assignment.assignmentType", "Assignment type", "select", {
        // Form 1004 has Purchase, Refinance and Other; UAD 3.6 lists the rest.
        options: [
          "Purchase", "Refinance", "Construction", "Home Equity", "Deed in Lieu", "Loan Modification",
          "Portfolio Evaluation", "Preforeclosure", "REO", "Short Sale", "Other",
        ],
      }),
      f("assignment.propertyRights", "Property rights appraised", "select", { options: ["Fee Simple", "Leasehold", "Other"] }),
      f("assignment.occupant", "Occupant", "select", { options: ["Owner", "Tenant", "Vacant"] }),
      f("assignment.inspectionDate", "Inspection date", "date"),
      f("assignment.effectiveDate", "Effective date of appraisal", "date", { hint: "Usually the inspection date" }),
    ],
  },
  {
    title: "Taxes and legal",
    fields: [
      f("assignment.legalDescription", "Legal description", "text"),
      f("assignment.taxYear", "Tax year", "text"),
      f("assignment.taxes", "R.E. taxes", "money", { hint: "Annual real estate taxes in dollars" }),
      f("assignment.neighborhoodName", "Neighborhood name", "text"),
      f("assignment.mapReference", "Map reference", "text"),
      f("assignment.specialAssessments", "Special assessments", "money"),
      f("assignment.pud", "PUD", "bool"),
      f("assignment.hoaDues", "HOA dues", "money"),
      f("assignment.hoaPeriod", "HOA dues period", "select", { options: ["per year", "per month"] }),
    ],
  },
  {
    title: "Listing history",
    fields: [
      f("assignment.offeredForSale", "Offered for sale in the prior 12 months", "bool"),
      f("assignment.offeringHistory", "Data sources, offering prices and dates", "longtext"),
    ],
  },
];

export const CONTRACT_GROUPS: ReportGroup[] = [
  {
    title: "Contract",
    fields: [
      f("contract.price", "Contract price", "money"),
      f("contract.date", "Date of contract", "date", { hint: "Date the agreement of sale was fully executed" }),
      f("contract.sellerIsOwner", "Seller is the owner of public record", "bool"),
      f("contract.dataSource", "Contract data source", "text", { hint: "e.g. Agreement of sale provided by lender" }),
      f("contract.assistance", "Financial assistance paid by seller or another party", "bool", {
        hint: "Loan charges, sale concessions, gift or down payment assistance",
      }),
      f("contract.assistanceAmount", "Total assistance amount", "money"),
      f("contract.assistanceDescription", "Items to be paid", "longtext"),
      f("contract.analysis", "Contract analysis", "longtext", {
        hint: "Results of the analysis of the contract for sale, or why it was not analyzed (e.g. refinance)",
      }),
    ],
  },
];

export const SITE_GROUPS: ReportGroup[] = [
  {
    title: "Site",
    fields: [
      f("site.dimensions", "Dimensions", "text", { hint: "e.g. 16 x 81" }),
      f("site.shape", "Shape", "text", { hint: "e.g. Rectangular" }),
      f("site.zoningDescription", "Zoning description", "text", { hint: "e.g. Residential single-family attached" }),
      f("site.zoningCompliance", "Zoning compliance", "select", {
        options: ["Legal", "Legal Nonconforming", "No Zoning", "Illegal"],
      }),
      f("site.highestBestUse", "Present use is the highest and best use", "bool"),
    ],
  },
  {
    title: "Utilities and off-site",
    fields: [
      f("site.electricity", "Electricity", "select", { options: ["Public", "Other"] }),
      f("site.gas", "Gas", "select", { options: ["Public", "Other", "None"] }),
      f("site.water", "Water", "select", { options: ["Public", "Other"] }),
      f("site.sewer", "Sanitary sewer", "select", { options: ["Public", "Other"] }),
      f("site.street", "Street", "text", { hint: "Surface, e.g. Asphalt" }),
      f("site.streetType", "Street ownership", "select", { options: ["Public", "Private"] }),
      f("site.alley", "Alley", "select", { options: ["Public", "Private", "None"] }),
      f("site.utilitiesTypical", "Utilities and off-site improvements typical", "bool"),
    ],
  },
  {
    title: "Flood and site conditions",
    fields: [
      f("site.floodHazard", "FEMA special flood hazard area", "bool"),
      f("site.floodZone", "FEMA flood zone", "text", { hint: "e.g. X" }),
      f("site.floodMap", "FEMA map #", "text"),
      f("site.floodMapDate", "FEMA map date", "date"),
      f("site.adverseConditions", "Adverse site conditions or external factors", "bool", {
        hint: "Easements, encroachments, environmental conditions, land uses",
      }),
      f("site.comments", "Site comments", "longtext"),
    ],
  },
];

const MATERIAL = "Material and condition, e.g. Brick/Average";

export const IMPROVEMENT_GROUPS: ReportGroup[] = [
  {
    title: "General",
    fields: [
      f("improvements.units", "Units", "select", { options: ["One", "One with Accessory Unit"] }),
      f("improvements.stories", "Stories", "number"),
      f("improvements.type", "Type", "select", { options: ["Det.", "Att.", "S-Det./End Unit"] }),
      f("improvements.status", "Status", "select", { options: ["Existing", "Proposed", "Under Const."] }),
      f("improvements.effectiveAge", "Effective age (yrs)", "number"),
      f("improvements.totalRooms", "Total rooms above grade", "number"),
      f("improvements.attic", "Attic", "select", {
        options: ["None", "Drop Stair", "Stairs", "Floor", "Scuttle", "Finished", "Heated"],
      }),
    ],
  },
  {
    title: "Foundation and systems",
    fields: [
      f("improvements.foundation", "Foundation", "select", {
        options: ["Concrete Slab", "Crawl Space", "Full Basement", "Partial Basement"],
      }),
      f("improvements.basementOutsideEntry", "Basement outside entry/exit", "bool"),
      f("improvements.sumpPump", "Sump pump", "bool"),
      f("improvements.evidenceOf", "Evidence of infestation, dampness or settlement", "text"),
      f("improvements.heating", "Heating", "select", { options: ["FWA", "HWBB", "Radiant", "Other"] }),
      f("improvements.fuel", "Fuel", "text", { hint: "e.g. Gas, Oil, Electric" }),
      f("improvements.cooling", "Cooling", "select", { options: ["Central Air", "Individual", "Other", "None"] }),
    ],
  },
  {
    title: "Exterior",
    fields: [
      f("improvements.foundationWalls", "Foundation walls", "text", { hint: MATERIAL }),
      f("improvements.exteriorWalls", "Exterior walls", "text", { hint: MATERIAL }),
      f("improvements.roofSurface", "Roof surface", "text", { hint: MATERIAL }),
      f("improvements.gutters", "Gutters and downspouts", "text", { hint: MATERIAL }),
      f("improvements.windowType", "Window type", "text", { hint: MATERIAL }),
      f("improvements.stormSash", "Storm sash/insulated", "text"),
      f("improvements.screens", "Screens", "text"),
    ],
  },
  {
    title: "Interior",
    fields: [
      f("improvements.floors", "Floors", "text", { hint: MATERIAL }),
      f("improvements.walls", "Walls", "text", { hint: MATERIAL }),
      f("improvements.trim", "Trim/finish", "text", { hint: MATERIAL }),
      f("improvements.bathFloor", "Bath floor", "text", { hint: MATERIAL }),
      f("improvements.bathWainscot", "Bath wainscot", "text", { hint: MATERIAL }),
    ],
  },
  {
    title: "Amenities and car storage",
    fields: [
      f("improvements.woodstoves", "Woodstoves", "number"),
      f("improvements.patioDeck", "Patio/deck", "text"),
      f("improvements.porch", "Porch", "text"),
      f("improvements.fence", "Fence", "text"),
      f("improvements.otherAmenities", "Other amenities", "text"),
      f("improvements.drivewayCars", "Driveway (cars)", "number"),
      f("improvements.drivewaySurface", "Driveway surface", "text"),
      f("improvements.garageType", "Garage", "select", { options: ["Att.", "Det.", "Built-in", "None"] }),
      f("improvements.carportCars", "Carport (cars)", "number"),
    ],
  },
  {
    title: "Appliances",
    fields: [
      f("improvements.refrigerator", "Refrigerator", "bool"),
      f("improvements.range", "Range/oven", "bool"),
      f("improvements.dishwasher", "Dishwasher", "bool"),
      f("improvements.disposal", "Disposal", "bool"),
      f("improvements.microwave", "Microwave", "bool"),
      f("improvements.washerDryer", "Washer/dryer", "bool"),
    ],
  },
  {
    title: "Condition",
    fields: [
      f("improvements.additionalFeatures", "Additional features", "longtext", {
        hint: "Special energy efficient items, recent updates and other features",
      }),
      f("improvements.deficiencies", "Physical deficiencies or adverse conditions", "bool"),
      f("improvements.deficienciesDescription", "Deficiencies affecting livability, soundness or integrity", "longtext"),
      f("improvements.conforms", "Conforms to the neighborhood", "bool"),
    ],
  },
];

export const NEIGHBORHOOD_GROUPS: ReportGroup[] = [
  {
    title: "Neighborhood characteristics",
    fields: [
      f("neighborhood.location", "Location", "select", { options: ["Urban", "Suburban", "Rural"] }),
      f("neighborhood.builtUp", "Built-up", "select", { options: ["Over 75%", "25-75%", "Under 25%"] }),
      f("neighborhood.growth", "Growth", "select", { options: ["Rapid", "Stable", "Slow"] }),
      f("neighborhood.propertyValues", "Property values", "select", { options: ["Increasing", "Stable", "Declining"] }),
      f("neighborhood.demandSupply", "Demand/supply", "select", { options: ["Shortage", "In Balance", "Over Supply"] }),
      f("neighborhood.marketingTime", "Marketing time", "select", { options: ["Under 3 mths", "3-6 mths", "Over 6 mths"] }),
    ],
  },
  {
    title: "One-unit housing",
    fields: [
      f("neighborhood.priceLow", "Price low", "money"),
      f("neighborhood.priceHigh", "Price high", "money"),
      f("neighborhood.pricePredominant", "Price predominant", "money"),
      f("neighborhood.ageLow", "Age low (yrs)", "number"),
      f("neighborhood.ageHigh", "Age high (yrs)", "number"),
      f("neighborhood.agePredominant", "Age predominant (yrs)", "number"),
    ],
  },
  {
    title: "Present land use %",
    fields: [
      f("neighborhood.landUseOneUnit", "One-unit %", "number"),
      f("neighborhood.landUse2to4", "2-4 unit %", "number"),
      f("neighborhood.landUseMulti", "Multi-family %", "number"),
      f("neighborhood.landUseCommercial", "Commercial %", "number"),
      f("neighborhood.landUseOther", "Other %", "number"),
    ],
  },
  {
    title: "Boundaries",
    fields: [f("neighborhood.boundaries", "Neighborhood boundaries", "longtext")],
  },
];

// Market Conditions Addendum (Fannie Mae Form 1004MC): each figure for the
// three periods before the effective date, plus the overall trend.
export const MC_PERIODS = [
  { id: "p712", label: "Prior 7-12 months", months: 6 },
  { id: "p46", label: "Prior 4-6 months", months: 3 },
  { id: "p03", label: "Current-3 months", months: 3 },
] as const;
export type McPeriod = (typeof MC_PERIODS)[number]["id"];
export const TRENDS = ["Increasing", "Stable", "Declining"] as const;

export const MC_ROWS = [
  { id: "salesCount", label: "Total # of comparable sales (settled)", type: "number" },
  { id: "absorption", label: "Absorption rate (total sales/months)", type: "number" },
  { id: "listings", label: "Total # of comparable active listings", type: "number" },
  { id: "supply", label: "Months of housing supply (total listings/ab. rate)", type: "number" },
  { id: "medianSalePrice", label: "Median comparable sale price", type: "money" },
  { id: "medianSaleDom", label: "Median comparable sales days on market", type: "number" },
  { id: "medianListPrice", label: "Median comparable list price", type: "money" },
  { id: "medianListDom", label: "Median comparable listings days on market", type: "number" },
  { id: "saleToList", label: "Median sale price as % of list price", type: "number" },
] as const;
export type McRow = (typeof MC_ROWS)[number]["id"];
export const mcKey = (row: McRow, period: McPeriod | "trend") => `market.${row}.${period}`;

export const MARKET_TABLE_GROUP: ReportGroup = {
  title: "Market conditions figures",
  fields: MC_ROWS.flatMap((row) => [
    ...MC_PERIODS.map((p) => f(mcKey(row.id, p.id), `${row.label}, ${p.label.toLowerCase()}`, row.type)),
    f(mcKey(row.id, "trend"), `${row.label}, overall trend`, "select", { options: TRENDS }),
  ]),
};

export const MARKET_GROUPS: ReportGroup[] = [
  {
    title: "Market conditions notes",
    fields: [
      f("market.assistancePrevalent", "Seller-paid financial assistance prevalent", "bool"),
      f("market.assistanceTrend", "Trends in seller concessions", "longtext", {
        hint: "e.g. typical concession amounts and whether they are rising or falling",
      }),
      f("market.foreclosureFactor", "Foreclosure sales (REO) a factor in the market", "bool"),
      f("market.foreclosureTrend", "Foreclosure and short sale activity", "longtext"),
      f("market.dataSources", "Data sources for the figures above", "text", { hint: "e.g. Bright MLS" }),
      f("market.summary", "Summary of market conditions and support for the conclusions", "longtext"),
    ],
  },
];

export const SALES_GROUPS: ReportGroup[] = [
  {
    title: "Competing listings and sales",
    fields: [
      f("sales.listingsCount", "Comparable listings for sale now", "number"),
      f("sales.listingsLow", "Listings price low", "money"),
      f("sales.listingsHigh", "Listings price high", "money"),
      f("sales.salesCount", "Comparable sales in the past 12 months", "number"),
      f("sales.salesLow", "Sales price low", "money"),
      f("sales.salesHigh", "Sales price high", "money"),
    ],
  },
  {
    title: "Prior sales research",
    fields: [
      f("sales.subjectPriorFound", "Prior sales of the subject in the 3 years before the effective date", "bool"),
      f("sales.subjectPriorSource", "Subject data source", "text"),
      f("sales.compPriorFound", "Prior sales of the comps in the year before their sale", "bool"),
      f("sales.compPriorSource", "Comps data source", "text"),
      f("sales.priorAnalysis", "Analysis of prior sale or transfer history", "longtext"),
    ],
  },
  {
    title: "Indicated value",
    fields: [f("sales.indicatedValue", "Indicated value by sales comparison", "money")],
  },
];

export const COST_GROUPS: ReportGroup[] = [
  {
    title: "Cost approach",
    fields: [
      f("cost.developed", "Cost approach developed", "bool"),
      f("cost.siteValue", "Opinion of site value", "money"),
      f("cost.siteValueSupport", "Support for the site value", "longtext"),
      f("cost.source", "Source of cost data", "text"),
      f("cost.qualityRating", "Quality rating from cost service", "text"),
      f("cost.effectiveDate", "Effective date of cost data", "date"),
      f("cost.dwellingPerSqFt", "Dwelling cost $/sq ft", "money"),
      f("cost.garageSqFt", "Garage/carport sq ft", "number"),
      f("cost.garagePerSqFt", "Garage/carport $/sq ft", "money"),
      f("cost.otherCost", "Other improvements cost", "money", { hint: "Basement, porches, decks and similar" }),
      f("cost.physicalDepreciation", "Physical depreciation", "money"),
      f("cost.functionalDepreciation", "Functional depreciation", "money"),
      f("cost.externalDepreciation", "External depreciation", "money"),
      f("cost.siteImprovements", "As-is value of site improvements", "money"),
      f("cost.remainingLife", "Remaining economic life (yrs)", "number"),
      f("cost.comments", "Cost approach comments", "longtext"),
    ],
  },
];

export const INCOME_GROUPS: ReportGroup[] = [
  {
    title: "Income approach",
    fields: [
      f("income.developed", "Income approach developed", "bool"),
      f("income.marketRent", "Estimated monthly market rent", "money"),
      f("income.grm", "Gross rent multiplier", "number"),
      f("income.comments", "Income approach comments", "longtext"),
    ],
  },
];

export const RECONCILIATION_GROUPS: ReportGroup[] = [
  {
    title: "Reconciliation",
    fields: [
      f("reconciliation.basis", "Appraisal is made", "select", {
        options: [
          "As is",
          "Subject to completion per plans and specifications",
          "Subject to repairs or alterations",
          "Subject to inspection",
        ],
      }),
      f("reconciliation.conditions", "Repairs, alterations or conditions", "longtext"),
      f("reconciliation.finalValue", "Opinion of market value", "money"),
      f("reconciliation.additionalComments", "Additional comments", "longtext"),
    ],
  },
];

export const APPRAISER_GROUPS: ReportGroup[] = [
  {
    title: "Appraiser",
    fields: [
      f("appraiser.name", "Name", "text"),
      f("appraiser.company", "Company", "text"),
      f("appraiser.address", "Company address", "text"),
      f("appraiser.phone", "Phone", "text"),
      f("appraiser.email", "Email", "text"),
      f("appraiser.licenseType", "Credential", "select", {
        options: ["Certified Residential", "Certified General", "Licensed", "Trainee"],
      }),
      f("appraiser.licenseNumber", "License/certification #", "text"),
      f("appraiser.licenseState", "State", "text"),
      f("appraiser.licenseExpiration", "Expiration date", "date"),
      f("appraiser.signatureDate", "Date of signature and report", "date"),
    ],
  },
];

// Items the redesigned URAR (UAD 3.6) adds. Each step shows its group only
// when the report form is UAD 3.6; the rest of the report is shared.
const INSPECTION = ["Physical", "Virtual", "No Inspection"] as const;

export const UAD_ASSIGNMENT_GROUPS: ReportGroup[] = [
  {
    title: "UAD 3.6 assignment information",
    fields: [
      f("uad.valuationMethod", "Property valuation method", "select", {
        options: ["Traditional Appraisal", "Hybrid Appraisal", "Desktop Appraisal", "Exterior Appraisal"],
      }),
      f("uad.exteriorInspection", "Exterior inspection method", "select", { options: INSPECTION }),
      f("uad.interiorInspection", "Interior inspection method", "select", { options: INSPECTION }),
      f("uad.seller", "Seller", "text"),
      f("uad.propertyDataReport", "Property data report used", "bool", { hint: "A third-party property data collection report" }),
      f("uad.governmentAgency", "Government agency appraisal", "select", { options: ["None", "FHA", "USDA", "VA"] }),
      f("uad.investorId", "Investor requested special identification", "text"),
      f("uad.appraiserFee", "Appraiser fee", "money"),
      f("uad.amcName", "Appraisal management company", "text"),
      f("uad.amcFee", "AMC fee", "money"),
      f("uad.scopeOfWork", "Assignment information and scope of work commentary", "longtext"),
    ],
  },
  {
    title: "Subject listing information",
    fields: [
      f("uad.listingStatus", "Listing status", "select", { options: ["None", "Active", "Pending", "Off Market"] }),
      f("uad.listPrice", "List price", "money", { hint: "Current or most recent list price of the subject" }),
      f("uad.listDate", "List date", "date"),
      f("uad.offMarketDate", "Off market date", "date"),
      f("uad.listDom", "Days on market", "number"),
    ],
  },
];

export const UAD_SITE_GROUPS: ReportGroup[] = [
  {
    title: "Restrictions, encroachments and highest and best use",
    fields: [
      f("uad.restrictions", "Property restrictions", "text", {
        hint: "Age, Historic Preservation, Income, Land Use, Rental or Sale Price restrictions",
      }),
      f("uad.encroachments", "Encroachments", "text", { hint: "Building, Driveway, Fence, Overhang or Other" }),
      f("uad.hbuCommentary", "Highest and best use commentary", "longtext"),
    ],
  },
  {
    title: "Disaster mitigation",
    fields: [
      f("uad.disasterFeatures", "Disaster mitigation features", "text", {
        hint: "e.g. hurricane straps, sump pump, flood vents, seismic bracing, fire-resistant roof",
      }),
      f("uad.disasterCommentary", "Disaster mitigation commentary", "longtext"),
    ],
  },
  {
    title: "Energy efficient and green features",
    fields: [
      f("uad.renewableEnergy", "Renewable energy components", "text", { hint: "e.g. solar panels, owned or leased" }),
      f("uad.buildingCertifications", "Building certifications", "text", { hint: "e.g. ENERGY STAR, LEED" }),
      f("uad.efficiencyRatings", "Efficiency ratings", "text", { hint: "e.g. HERS index score" }),
      f("uad.greenImpact", "Impact on value and marketability", "select", { options: ["Beneficial", "Neutral", "Adverse"] }),
      f("uad.greenCommentary", "Energy efficient and green features commentary", "longtext"),
    ],
  },
];

export const UAD_IMPROVEMENT_GROUPS: ReportGroup[] = [
  {
    title: "Dwelling exterior",
    fields: [
      f("uad.structureDesign", "Structure design", "select", {
        options: ["Rowhouse/Townhouse", "Semi-Detached", "Low-rise", "Mid-rise", "High-rise", "Other"],
      }),
      f("uad.constructionMethod", "Construction method", "select", {
        options: ["Site Built", "Modular", "On-Frame Modular", "Manufactured", "Container", "3D Technology", "Other"],
      }),
      f("uad.storiesBelowGrade", "Stories below grade", "number"),
      f("uad.roofStructure", "Roof structure", "select", { options: ["Rafter", "Truss", "Other"] }),
      f("uad.exteriorCommentary", "Dwelling exterior commentary", "longtext"),
    ],
  },
  {
    title: "Unit interior",
    fields: [
      f("uad.adu", "Includes an accessory dwelling unit (ADU)", "bool"),
      f("uad.accessibility", "Accessibility features", "text", { hint: "e.g. ramp, wide doorways, first-floor bedroom" }),
      f("uad.interiorCommentary", "Unit interior commentary", "longtext"),
    ],
  },
  {
    title: "Functional obsolescence",
    fields: [
      f("uad.functionalFeatures", "Functional obsolescence features", "text", {
        hint: "e.g. bedroom accessed through another bedroom, no bath on the bedroom level",
      }),
      f("uad.functionalCommentary", "Functional obsolescence commentary", "longtext"),
    ],
  },
  {
    title: "Outbuilding",
    fields: [
      f("uad.outbuildingType", "Outbuilding type", "select", {
        options: ["None", "Garage", "ADU/Garage", "Standalone ADU", "Carport", "Shed", "Barn", "Bunkhouse", "Other"],
      }),
      f("uad.outbuildingArea", "Outbuilding area (sq ft)", "number"),
      f("uad.outbuildingYear", "Outbuilding year built", "number"),
      f("uad.outbuildingCommentary", "Outbuilding commentary", "longtext"),
    ],
  },
  {
    title: "Vehicle storage",
    fields: [
      f("uad.vehicleStorage", "Vehicle storage type", "select", {
        options: ["Garage", "Carport", "Driveway", "Shared Driveway", "Street Parking", "Other", "None"],
      }),
      f("uad.parkingSpaces", "Number of parking spaces", "number"),
      f("uad.parkingAssignment", "Parking space assignment", "select", { options: ["Assigned", "Unassigned"] }),
      f("uad.vehicleCommentary", "Vehicle storage commentary", "longtext"),
    ],
  },
  {
    title: "Amenities and overall quality and condition",
    fields: [
      f("uad.amenitiesCommentary", "Subject property amenities commentary", "longtext"),
      f("uad.asIsCondition", "As-is overall condition", "select", {
        options: ["C1", "C2", "C3", "C4", "C5", "C6"],
        hint: "Only when the appraisal is made subject to repairs or completion",
      }),
      f("uad.qualityConditionCommentary", "Reconciliation of overall quality and condition", "longtext"),
    ],
  },
];

export const UAD_MARKET_GROUPS: ReportGroup[] = [
  {
    title: "UAD 3.6 market",
    fields: [
      f("uad.searchCriteria", "Search criteria", "longtext", { hint: "How the market data was selected: area, dates, property type, size" }),
      f("uad.marketCharacteristics", "Market characteristics", "longtext"),
      f("uad.distressedPct", "Percent of distressed sales", "number"),
    ],
  },
];

export const UAD_RENTAL_GROUPS: ReportGroup[] = [
  {
    title: "Rental information",
    fields: [
      f("uad.currentlyRented", "Subject is currently rented", "bool"),
      f("uad.monthlyRent", "Current monthly rent", "money"),
      f("uad.leaseStart", "Lease start date", "date"),
      f("uad.rentalCommentary", "Rental information commentary", "longtext"),
    ],
  },
];

export const UAD_REPORT_GROUPS: ReportGroup[] = [
  {
    title: "Revision history and supplemental information",
    fields: [
      f("uad.revisionHistory", "Revision history", "longtext", { hint: "Changes made after the report was first delivered" }),
      f("uad.supplemental", "Supplemental information", "longtext"),
    ],
  },
];

export const UAD_GROUPS = [
  ...UAD_ASSIGNMENT_GROUPS, ...UAD_SITE_GROUPS, ...UAD_IMPROVEMENT_GROUPS, ...UAD_MARKET_GROUPS, ...UAD_RENTAL_GROUPS,
  ...UAD_REPORT_GROUPS,
];

// UAD 3.6 lists each apparent defect, damage or deficiency on its own line.
export const DEFECT_FEATURES = [
  "Exterior Walls and Trim", "Flooring", "Foundation", "Mechanical System", "Roof", "Walls and Ceiling", "Windows", "Other",
] as const;
export const DEFECT_ACTIONS = ["Repair", "Inspection", "Completion", "None"] as const;
export type Defect = {
  feature: (typeof DEFECT_FEATURES)[number] | null;
  location: string;
  description: string;
  affectsSoundness: boolean | null;
  action: (typeof DEFECT_ACTIONS)[number] | null;
  cost: number | null;
};
export const emptyDefect = (): Defect => ({
  feature: null, location: "", description: "", affectsSoundness: null, action: null, cost: null,
});

export const ALL_REPORT_GROUPS = [
  ...ASSIGNMENT_GROUPS, ...CONTRACT_GROUPS, ...SITE_GROUPS, ...IMPROVEMENT_GROUPS, ...NEIGHBORHOOD_GROUPS,
  MARKET_TABLE_GROUP, ...MARKET_GROUPS, ...SALES_GROUPS, ...COST_GROUPS, ...INCOME_GROUPS, ...RECONCILIATION_GROUPS, ...APPRAISER_GROUPS,
  ...UAD_GROUPS,
];
export const REPORT_FIELDS = ALL_REPORT_GROUPS.flatMap((g) => g.fields);
export const FIELD_BY_KEY = new Map(REPORT_FIELDS.map((field) => [field.key, field]));

// The appraiser's own details carry over to the next report.
export const isCarriedOver = (key: string) => key.startsWith("appraiser.") && key !== "appraiser.signatureDate";

export function progress(data: ReportData, groups: ReportGroup[]) {
  const keys = groups.flatMap((g) => g.fields.map((field) => field.key));
  return { filled: keys.filter((k) => data[k] != null && data[k] !== "").length, total: keys.length };
}

// Turns a model- or user-supplied string into the field's type, or null
// when it doesn't fit (an option that isn't on the list, a non-number).
export function coerce(field: Pick<ReportField, "type" | "options">, raw: string): ReportValue {
  const s = raw.trim();
  if (!s) return null;
  switch (field.type) {
    case "number":
    case "money": {
      const n = Number(s.replace(/[$,\s]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    case "bool":
      if (/^(yes|y|true)$/i.test(s)) return true;
      if (/^(no|n|false)$/i.test(s)) return false;
      return null;
    case "date": {
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
      const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      return us ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}` : null;
    }
    case "select":
      return field.options?.find((o) => o.toLowerCase() === s.toLowerCase()) ?? null;
    default:
      return s;
  }
}

export function formatValue(field: Pick<ReportField, "type">, value: ReportValue | undefined): string {
  if (value == null || value === "") return "";
  if (field.type === "bool") return value ? "Yes" : "No";
  if (field.type === "money" && typeof value === "number") {
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  if (field.type === "number" && typeof value === "number") return value.toLocaleString("en-US");
  return String(value);
}
