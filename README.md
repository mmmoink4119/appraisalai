# Appraisal AI

A web app that helps fill out residential appraisal reports (URAR and UAD 3.6), with the finished data going into the appraiser's forms software (TOTAL).

## What it does today

- **Subject property form** with the main URAR fields (site, GLA, rooms, basement, garage, UAD condition/quality ratings).
- **Paste to fill**: paste an MLS listing sheet, public record, or notes, and Claude extracts the fields. It only fills what the text states and leaves the rest blank.
- **Comparable sales** with the same fields plus sale price and date, list price, days on market, UAD sale type, financing, concessions and data source.
- **MLS CSV import**: upload a CSV export of an MLS search, tick the sales to use, and they become comps. Claude matches the CSV columns to the comp fields once per export layout (the mapping is remembered and editable); without an API key, common MLS/RESO column names are matched by name.
- **Sales comparison grid** that calculates line adjustments, net and gross adjustment %, and the adjusted price for each comp, flagging comps above the traditional 15% net / 25% gross guidelines.
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
- `src/app/api/extract/route.ts` calls the Claude API with structured outputs to turn pasted text into fields.
- `src/components/Worksheet.tsx` and `src/components/ImportComps.tsx` are the worksheet UI.

## Roadmap ideas

- Upload MLS PDFs and county record PDFs directly.
- Export comps and subject data in a format TOTAL can import (e.g. MISMO / UAD 3.6 XML).
- Draft narrative comments (neighborhood, market conditions, reconciliation).
- Saved reports in a database instead of the browser.
