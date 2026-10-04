# Appraisal AI

A web app that helps fill out residential appraisal reports (URAR and UAD 3.6), with the finished data going into the appraiser's forms software (TOTAL).

## What it does today

The worksheet is laid out as four steps (Subject, Comparables, Adjustments, Comments) and works in light and dark mode.

- **Subject property form** with the main URAR fields (site, GLA, rooms, basement, garage, UAD condition/quality ratings).
- **Philadelphia public records**: type a subject address or 9-digit OPA parcel number and the app looks it up in the city's open property data (no key needed). It fills year built, living area, lot size, bedrooms, baths, garage, central air, plus owner of record, census tract, zoning, assessed value and the last recorded sale. The city counts all bathrooms together, so split full and half baths yourself; condition, quality and basement aren't filled.
- **Paste to fill**: paste an MLS listing sheet, public record, or notes, and Claude extracts the fields. It only fills what the text states and leaves the rest blank.
- **Comparable sales** with the same fields plus sale price and date, list price, days on market, UAD sale type, financing, concessions and data source.
- **MLS CSV import**: upload a CSV export of an MLS search, tick the sales to use, and they become comps. Claude matches the CSV columns to the comp fields once per export layout (the mapping is remembered and editable); without an API key, common MLS/RESO column names are matched by name.
- **Sales comparison grid** that calculates line adjustments, net and gross adjustment %, and the adjusted price for each comp, flagging comps above the traditional 15% net / 25% gross guidelines.
- **Comment drafting**: add your notes (neighborhood boundaries, market trend, inspection observations), and Claude drafts the neighborhood, market conditions, improvements, sales comparison and reconciliation comments from the worksheet. Anything it wasn't told shows up as a [bracketed placeholder]; each section is editable and has a copy button.
- **Adjustment rates** are editable per market (defaults are placeholders).
- The draft is saved in the browser and can be exported as JSON.

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
- `src/app/api/extract/route.ts` calls the Claude API with structured outputs to turn pasted text into fields.
- `src/components/Worksheet.tsx` holds the step layout; `fields.tsx` the grouped property fields; `ImportComps.tsx` and `CommentsPanel.tsx` the import and comments steps.

## Roadmap ideas

- Upload MLS PDFs and county record PDFs directly.
- Export comps and subject data in a format TOTAL can import (e.g. MISMO / UAD 3.6 XML).
- Saved reports in a database instead of the browser.
