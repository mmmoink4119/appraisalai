import { OPA_SQL_URL, type OpaRecord, buildOpaQuery, opaNotes, opaToProperty } from "@/lib/phillyRecords";

// Looks up a Philadelphia property by parcel number or street address.
export async function POST(request: Request) {
  const { query } = (await request.json()) as { query?: string };
  const sql = buildOpaQuery(query ?? "");
  if (!sql) {
    return Response.json(
      { error: "Enter a 9-digit parcel number or a street address like 4625 Lansing St." },
      { status: 400 },
    );
  }

  let rows: OpaRecord[];
  try {
    const res = await fetch(`${OPA_SQL_URL}?q=${encodeURIComponent(sql)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = ((await res.json()) as { rows: OpaRecord[] }).rows;
  } catch (err) {
    return Response.json(
      { error: `Couldn't reach Philadelphia's property records (${err instanceof Error ? err.message : err}).` },
      { status: 502 },
    );
  }

  return Response.json({
    matches: rows.map((r) => ({ label: `${r.location} · parcel ${r.parcel_number}`, fields: opaToProperty(r), notes: opaNotes(r) })),
  });
}
