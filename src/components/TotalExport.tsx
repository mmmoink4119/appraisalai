"use client";

import type { Property } from "@/lib/appraisal";
import { type ReportData, isUad36 } from "@/lib/report";
import { buildUadXml } from "@/lib/uadXml";

// Downloads the report as UAD 2.6 XML for TOTAL's File > Open UAD XML.
export default function TotalExport({ subject, report }: { subject: Property; report: ReportData }) {
  const download = () => {
    const blob = new Blob([buildUadXml({ subject, report })], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(subject.address ?? "appraisal").replace(/[^\w-]+/g, "-")}-UAD26.xml`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="card print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h2 className="text-lg font-semibold">File for TOTAL</h2>
          <p className="mt-0.5 text-sm text-muted">
            Download the report as a UAD 2.6 XML file (Form 1004) and open it in TOTAL with File &gt; Open UAD XML. It
            fills the subject, contract and neighborhood sections so far; enter the rest in TOTAL for now.
            {isUad36(report) &&
              " TOTAL can't open UAD 3.6 files from other programs yet, so this file uses Form 1004 even though the report is set to UAD 3.6."}
          </p>
        </div>
        <button className="btn btn-primary" onClick={download}>
          Download for TOTAL
        </button>
      </div>
    </section>
  );
}
