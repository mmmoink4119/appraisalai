# Appraisal AI

A web app that helps fill out residential appraisal reports (URAR and UAD 3.6), with the finished data going into the appraiser's forms software (TOTAL).

## What it does today

The app walks through the whole report in nine steps (Assignment, Subject & site, Improvements, Neighborhood, Comparables, Sales comparison, Comments, Value, Report) and works in light and dark mode.

- **Every URAR (Form 1004) section**: assignment and contract, subject, neighborhood, site, improvements, sales comparison (including prior sale research), cost and income approaches, reconciliation and the appraiser's certification block. Fields are defined once in `src/lib/report.ts`.
- **Fill from documents**: upload the order or engagement letter, the agreement of sale, tax records or inspection notes (PDF, photos or text), or paste text. Claude reads them and proposes values for any field in the report, each with the quote it came from; the appraiser unticks anything wrong before it is filled.
- **Printable report** in URAR order, with the sales comparison grid, prior sales, reconciliation statement and signature block, plus a list of required items still empty. Print or save it as a PDF from the Report step.
- **Subject property form** with the main URAR fields (site, GLA, rooms, basement, garage, UAD condition/quality ratings).
- **Philadelphia public records**: type a subject address or 9-digit OPA parcel number and the app looks it up in the city's open property data (no key needed). It fills year built, living area, lot size, bedrooms, baths, garage, central air, plus owner of record, census tract, zoning, assessed value and the last recorded sale. The city counts all bathrooms together, so split full and half baths yourself; condition, quality and basement aren't filled.
- **Paste to fill**: paste an MLS listing sheet, public record, or notes, and Claude extracts the fields. It only fills what the text states and leaves the rest blank.
- **Comparable sales** with the same fields plus sale price and date, list price, days on market, UAD sale type, financing, concessions and data source.
- **MLS CSV import**: upload a CSV export of an MLS search, tick the sales to use, and they become comps. Claude matches the CSV columns to the comp fields once per export layout (the mapping is remembered and editable); without an API key, common MLS/RESO column names are matched by name.
- **Sales comparison grid** that calculates line adjustments, net and gross adjustment %, and the adjusted price for each comp, flagging comps above the traditional 15% net / 25% gross guidelines.
- **Condition and quality suggestions**: listing remarks come in with the MLS import (HTML entities decoded), and Claude suggests a UAD C1-C6 / Q1-Q6 rating for each comp with its confidence and the remarks that drove it. Ratings only change when the appraiser applies them.
- **Comment drafting**: add your notes (neighborhood boundaries, market trend, inspection observations), and Claude drafts the neighborhood, market conditions, improvements, sales comparison and reconciliation comments from the worksheet. Anything it wasn't told shows up as a [bracketed placeholder]; each section is editable and has a copy button.
- **Adjustment rates** are editable per market (defaults are placeholders).
- The draft is saved in the browser and can be exported as JSON. The appraiser's own details carry over to the next report.

## Running it

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Architecture

- Next.js (App Router, TypeScript, Tailwind).
- `src/lib/appraisal.ts` holds the property/comp data model (Zod schemas) and the adjustment math.
- `src/lib/csvImport.ts` parses MLS CSV exports and turns rows into comps using a column mapping.
- `src/app/api/map-columns/route.ts` asks Claude to map a CSV's columns to comp fields.
- `src/app/api/comments/route.ts` drafts the narrative comments.
- `src/lib/phillyRecords.ts` builds the query against Philadelphia's OPA dataset (`opa_properties_public` on phl.carto.com) and maps a record to subject fields; `src/app/api/public-record/route.ts` runs it.
- `src/app/api/suggest-ratings/route.ts` suggests UAD condition and quality ratings from listing remarks.
- `src/lib/report.ts` defines the report sections and fields; `src/lib/valuation.ts` the cost and income approach math.
- `src/lib/extraction.ts` + `src/app/api/extract-report/route.ts` read documents into report fields. Extraction asks for a list of key/value pairs rather than one object with a nullable field per report field, because structured outputs cap the number of nullable fields per request.
- `src/app/api/extract/route.ts` calls the Claude API with structured outputs to turn pasted text into fields.
- `src/components/Worksheet.tsx` holds the step layout; `fields.tsx` the grouped property fields; `ImportComps.tsx` and `CommentsPanel.tsx` the import and comments steps.

## Roadmap ideas

- Upload MLS PDFs and county record PDFs directly.
- Export the report in a format TOTAL can import (e.g. MISMO / UAD 3.6 XML).
- A printable layout for the UAD 3.6 redesigned URAR.
- 1004MC market conditions figures from the full MLS export.
- Saved reports in a database instead of the browser.
