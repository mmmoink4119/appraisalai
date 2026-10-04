# Appraisal AI

A web app that helps fill out residential appraisal reports (URAR / Form 1004).

## What it does today

- **Subject property form** with the main URAR fields (site, GLA, rooms, basement, garage, UAD condition/quality ratings).
- **Paste to fill**: paste an MLS listing sheet, public record, or notes, and Claude extracts the fields. It only fills what the text states and leaves the rest blank.
- **Comparable sales** with the same fields plus sale price, date, concessions and data source.
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
- `src/app/api/extract/route.ts` calls the Claude API with structured outputs to turn pasted text into fields.
- `src/app/page.tsx` is the worksheet UI.

## Roadmap ideas

- Upload MLS PDFs and county record PDFs directly.
- Export in a format the appraiser's forms software can import (e.g. MISMO/UAD XML).
- Draft narrative comments (neighborhood, market conditions, reconciliation).
- Saved reports in a database instead of the browser.
