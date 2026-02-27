"use client";

import { useState, useRef, useEffect, FormEvent, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Barcode,
  Building2,
  Search,
  Palette,
  Loader2,
  Hash,
  Layers,
  Package,
  ScanLine,
  ChevronDown,
  AlertTriangle,
  FileText,
  Filter,
  ArrowRight,
  CheckSquare,
  Square,
  Printer,
  Ruler,
  CircleCheck,
  CalendarDays,
} from "lucide-react";

/* ── Types ── */
interface ColorItem {
  id: string;
  name: string;
}

interface SearchResult {
  extractedNumber: string;
  internalId: string;
  fullCclbdNo: string;
  colors: ColorItem[];
}

interface BundleRow {
  barcode: string;
  cuttingNo: string;
  bundleNo: string;
  size: string;
  qty: string;
  inputDate: string;
  challanNo: string;
  lineNo: string;
  sewingOutput: string;
}

interface ReportFilters {
  barcode: string;
  challanNo: string;
  size: string;
  lineNo: string;
  qty: string;
  output: string;
}

type Step = "search" | "colors" | "report";

/* ── Company data ── */
const companies = [
  { id: "2", label: "Cotton Clothing BD" },
  { id: "1", label: "Cotton Club BD" },
  { id: "4", label: "Cotton Clout BD" },
  { id: "3", label: "Tropical Knitex" },
];

export default function BarcodePage() {
  const [step, setStep] = useState<Step>("search");
  const [companyId, setCompanyId] = useState("2");
  const [intRef, setIntRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);

  // Search result state
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [selectedColorIds, setSelectedColorIds] = useState<Set<string>>(new Set());
  const [scanChoice, setScanChoice] = useState<"scanned" | "unscanned">("unscanned");

  // Report state
  const [reportData, setReportData] = useState<BundleRow[]>([]);
  const [reportTotal, setReportTotal] = useState(0);

  // Report search filters
  const [reportFilters, setReportFilters] = useState<ReportFilters>({
    barcode: "",
    challanNo: "",
    size: "",
    lineNo: "",
    qty: "",
    output: "",
  });

  // Date range filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "search") inputRef.current?.focus();
    fetch("/api/csrf", { credentials: "same-origin" }).catch(() => {});
  }, [step]);

  function getCookie(name: string): string {
    const m = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return m ? decodeURIComponent(m[1]) : "";
  }

  const selectedCompanyLabel = companies.find((c) => c.id === companyId)?.label || "";

  /* ── Color selection helpers ── */
  const allColors = searchResult?.colors || [];
  const allSelected = allColors.length > 0 && selectedColorIds.size === allColors.length;

  const toggleColor = (id: string) => {
    setSelectedColorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedColorIds(new Set());
    } else {
      setSelectedColorIds(new Set(allColors.map((c) => c.id)));
    }
  };

  const selectedColorNames = allColors
    .filter((c) => selectedColorIds.has(c.id))
    .map((c) => c.name);

  /* ── Filtered report data ── */
  const filteredReportData = useMemo(() => {
    let logged = false;
    return reportData.filter((row) => {
      if (reportFilters.barcode && !row.barcode.toLowerCase().includes(reportFilters.barcode.toLowerCase())) return false;
      if (reportFilters.challanNo && !row.challanNo.toLowerCase().includes(reportFilters.challanNo.toLowerCase())) return false;
      if (reportFilters.size && !row.size.toLowerCase().includes(reportFilters.size.toLowerCase())) return false;
      if (reportFilters.lineNo && !row.lineNo.toLowerCase().includes(reportFilters.lineNo.toLowerCase())) return false;
      if (reportFilters.qty && !row.qty.toLowerCase().includes(reportFilters.qty.toLowerCase())) return false;
      if (reportFilters.output && !row.sewingOutput.toLowerCase().includes(reportFilters.output.toLowerCase())) return false;

      // Date range filter
      if (dateFrom || dateTo) {
        const raw = row.inputDate.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
        if (!logged) { console.log("[DATE DEBUG] raw inputDate:", JSON.stringify(raw), "| dateFrom:", dateFrom, "| dateTo:", dateTo); }
        
        let rowDate: Date | null = null;
        
        // Method 1: Try native Date.parse (handles many formats)
        const nativeParsed = new Date(raw);
        if (!isNaN(nativeParsed.getTime()) && nativeParsed.getFullYear() > 2000) {
          rowDate = nativeParsed;
        }
        
        // Method 2: Try splitting DD/MM/YYYY or MM/DD/YYYY
        if (!rowDate) {
          const parts = raw.split(/[-/.]/);
          if (parts.length === 3) {
            const [a, b, c] = parts.map(s => s.trim());
            const numA = Number(a), numB = Number(b), numC = Number(c);
            if (a.length === 4 && numB >= 1 && numB <= 12) {
              rowDate = new Date(numA, numB - 1, numC);
            } else if (c.length === 4) {
              if (numA > 12 && numB >= 1 && numB <= 12) {
                rowDate = new Date(numC, numB - 1, numA);
              } else if (numB > 12 && numA >= 1 && numA <= 12) {
                rowDate = new Date(numC, numA - 1, numB);
              } else if (numA >= 1 && numA <= 12) {
                // Ambiguous, try DD/MM/YYYY first (BD format)
                rowDate = new Date(numC, numB - 1, numA);
                // Validate
                if (!rowDate || isNaN(rowDate.getTime()) || rowDate.getMonth() !== numB - 1) {
                  rowDate = new Date(numC, numA - 1, numB);
                }
              }
            }
          }
        }
        
        if (!logged) { console.log("[DATE DEBUG] parsed rowDate:", rowDate?.toISOString?.()); logged = true; }
        
        if (rowDate && !isNaN(rowDate.getTime())) {
          if (dateFrom) {
            const from = new Date(dateFrom + "T00:00:00");
            if (rowDate < from) return false;
          }
          if (dateTo) {
            const to = new Date(dateTo + "T23:59:59");
            if (rowDate > to) return false;
          }
        }
      }

      return true;
    });
  }, [reportData, reportFilters, dateFrom, dateTo]);

  const hasAnyReportFilter = Object.values(reportFilters).some((v) => v.trim() !== "") || dateFrom !== "" || dateTo !== "";

  /* ── Step 1: Search Int. Ref. ── */
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!intRef.trim()) return;

    setLoading(true);
    setError("");

    try {
      const csrfToken = getCookie("__csrf");
      const res = await fetch("/api/barcode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "search",
          int_ref: intRef.trim(),
          company_id: companyId,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to fetch data");
        return;
      }

      setSearchResult(data);
      setSelectedColorIds(new Set());
      setStep("colors");
    } catch {
      setError("Network error — server unreachable");
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: Generate report with selected colors ── */
  const handleGenerateReport = async () => {
    if (!searchResult || selectedColorIds.size === 0) return;

    setLoading(true);
    setError("");

    try {
      const csrfToken = getCookie("__csrf");
      const colorIdsStr = Array.from(selectedColorIds).join(",");
      const res = await fetch("/api/barcode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "report",
          company_id: companyId,
          full_cclbd_no: searchResult.fullCclbdNo,
          internal_id: searchResult.internalId,
          color_ids: colorIdsStr,
          scan_choice: scanChoice,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to generate report");
        return;
      }

      setReportData(data.data || []);
      setReportTotal(data.total || 0);
      setReportFilters({ barcode: "", challanNo: "", size: "", lineNo: "", qty: "", output: "" });
      setDateFrom("");
      setDateTo("");
      setStep("report");
    } catch {
      setError("Network error — server unreachable");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep("search");
    setIntRef("");
    setSearchResult(null);
    setSelectedColorIds(new Set());
    setReportData([]);
    setReportTotal(0);
    setReportFilters({ barcode: "", challanNo: "", size: "", lineNo: "", qty: "", output: "" });
    setDateFrom("");
    setDateTo("");
    setError("");
    setScanChoice("unscanned");
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const goBackToColors = () => {
    setStep("colors");
    setReportData([]);
    setReportTotal(0);
    setReportFilters({ barcode: "", challanNo: "", size: "", lineNo: "", qty: "", output: "" });
    setDateFrom("");
    setDateTo("");
    setError("");
  };

  const updateReportFilter = (key: keyof ReportFilters, value: string) => {
    setReportFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearReportFilters = () => {
    setReportFilters({ barcode: "", challanNo: "", size: "", lineNo: "", qty: "", output: "" });
    setDateFrom("");
    setDateTo("");
  };

  const handlePrint = () => {
    const data = filteredReportData;
    if (data.length === 0) return;

    const colorList = selectedColorNames.join(", ");
    const scanLabel = scanChoice === "scanned" ? "Scanned" : "Unscanned";
    const totalDisplay = hasAnyReportFilter
      ? `${filteredReportData.length} of ${reportTotal}`
      : `${reportTotal}`;

    const rows = data
      .map(
        (r, i) => `
      <tr class="${i % 2 === 0 ? "even" : "odd"}">
        <td class="num">${i + 1}</td>
        <td>${r.barcode}</td>
        <td>${r.cuttingNo}</td>
        <td class="center">${r.bundleNo}</td>
        <td class="center">${r.size}</td>
        <td class="center">${r.qty}</td>
        <td class="center">${r.lineNo}</td>
        <td class="center bold">${r.sewingOutput}</td>
      </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Barcode Report - ${intRef}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: both; margin: 8mm; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #000;
      background: #fff;
      padding: 10px;
    }
    .header {
      text-align: center;
      margin-bottom: 14px;
      border-bottom: 3px solid #000;
      padding-bottom: 10px;
    }
    .header h1 {
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .header .meta {
      font-size: 16px;
      color: #000;
      display: flex;
      justify-content: center;
      gap: 28px;
      flex-wrap: wrap;
    }
    .header .meta span { font-weight: 800; color: #000; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 16px;
    }
    th {
      background: #1a1a1a;
      color: #fff;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 15px;
      letter-spacing: 0.5px;
      padding: 10px 8px;
      border: 2px solid #333;
      text-align: left;
      white-space: nowrap;
    }
    th.center, td.center { text-align: center; }
    td {
      padding: 8px 8px;
      border: 1px solid #aaa;
      color: #000;
      font-weight: 700;
      word-break: break-word;
    }
    td.num { text-align: center; color: #000; font-size: 14px; font-weight: 700; }
    td.bold { font-weight: 900; }
    tr.even td { background: #f5f5f5; }
    tr.odd td { background: #fff; }
    .footer {
      margin-top: 14px;
      text-align: right;
      font-size: 13px;
      color: #000;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Bundle Wise Sewing Tracking Report</h1>
    <div class="meta">
      Int. Ref: <span>${intRef}</span>
      &nbsp;|&nbsp; Colors: <span>${colorList}</span>
      &nbsp;|&nbsp; Filter: <span>${scanLabel}</span>
      &nbsp;|&nbsp; Total: <span>${totalDisplay} Bundles</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width:5%">#</th>
        <th style="width:20%">Barcode</th>
        <th style="width:18%">Cutting No</th>
        <th class="center" style="width:9%">B.No</th>
        <th class="center" style="width:12%">Size</th>
        <th class="center" style="width:8%">Qty</th>
        <th class="center" style="width:8%">Line</th>
        <th class="center" style="width:12%">Output</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  return (
    <div className="min-h-dvh bg-[#0d0d0d]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0d0d0d]/80 backdrop-blur-xl border-b border-white/[0.04] print:hidden">
        <div className={`${step === "report" ? "max-w-5xl" : "max-w-3xl"} mx-auto px-5 sm:px-8 py-4 flex items-center justify-between transition-all`}>
          <Link
            href="/history"
            className="inline-flex items-center gap-2.5 text-sm text-white/40 hover:text-white/70 transition-colors font-display"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">History</span>
          </Link>
          <h1 className="font-display text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <Barcode size={18} className="text-[#66a80f]/60" strokeWidth={1.5} />
            Barcode Tracking
          </h1>
          <div className="w-8" />
        </div>
      </div>

      <div className={`${step === "report" ? "max-w-5xl" : "max-w-3xl"} mx-auto px-5 sm:px-8 py-6 sm:py-8 transition-all`}>
        {/* Step indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center justify-center gap-2 mb-6"
        >
          {[
            { key: "search", label: "Search" },
            { key: "colors", label: "Color" },
            { key: "report", label: "Report" },
          ].map((s, i) => {
            const isActive = step === s.key;
            const isPast =
              (s.key === "search" && (step === "colors" || step === "report")) ||
              (s.key === "colors" && step === "report");
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && (
                  <div className={`w-8 h-px ${isPast || isActive ? "bg-[#66a80f]/30" : "bg-white/[0.06]"}`} />
                )}
                <div
                  className={`px-3 py-1.5 rounded-full text-[10px] font-display font-medium uppercase tracking-[0.15em] transition-all ${
                    isActive
                      ? "bg-[#66a80f]/10 border border-[#66a80f]/25 text-[#66a80f]"
                      : isPast
                      ? "bg-white/[0.04] border border-white/[0.08] text-white/50"
                      : "bg-white/[0.02] border border-white/[0.04] text-white/25"
                  }`}
                >
                  {s.label}
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Error display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-sm text-red-400 font-display"
            >
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ═══ STEP 1: Search ═══ */}
          {step === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <Search size={16} className="text-[#66a80f]/50" />
                  <h2 className="font-display text-sm font-semibold text-white">
                    Search by Internal Reference
                  </h2>
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                  {/* Company selector */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-display font-medium uppercase tracking-wider text-white/60 mb-1.5">
                      <Building2 size={11} className="text-white/40" />
                      Company
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCompanyOpen(!companyOpen)}
                        className="w-full px-3.5 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display text-left flex items-center justify-between focus:outline-none focus:border-[#66a80f]/40 focus:ring-1 focus:ring-[#66a80f]/15 transition-all"
                      >
                        <span>{selectedCompanyLabel}</span>
                        <ChevronDown
                          size={14}
                          className={`text-white/40 transition-transform ${companyOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      <AnimatePresence>
                        {companyOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute z-20 top-full mt-1 w-full bg-[#1a1a1a] border border-white/[0.1] rounded-xl overflow-hidden shadow-xl"
                          >
                            {companies.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setCompanyId(c.id);
                                  setCompanyOpen(false);
                                }}
                                className={`w-full px-3.5 py-2.5 text-left text-sm font-display transition-all ${
                                  companyId === c.id
                                    ? "bg-[#66a80f]/10 text-[#66a80f]"
                                    : "text-white/60 hover:bg-white/[0.04] hover:text-white/80"
                                }`}
                              >
                                {c.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Int. Ref. input */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-display font-medium uppercase tracking-wider text-white/60 mb-1.5">
                      <Hash size={11} className="text-white/40" />
                      Internal Reference
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={intRef}
                      onChange={(e) => setIntRef(e.target.value)}
                      placeholder="e.g. 502/2676a"
                      autoComplete="off"
                      className="w-full px-3.5 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-[#66a80f]/40 focus:ring-1 focus:ring-[#66a80f]/15 transition-all placeholder:text-white/30"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || !intRef.trim()}
                    className="w-full py-2.5 bg-[#66a80f] text-white rounded-full font-display text-sm font-medium tracking-wide hover:bg-[#5a9a0d] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Search size={14} /> Search
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 2: Color Selection (multi-select with Select All) ═══ */}
          {step === "colors" && searchResult && (
            <motion.div
              key="colors"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="space-y-4"
            >
              {/* Job info card */}
              <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-[#66a80f]/50" />
                  <span className="text-[10px] font-display font-medium uppercase tracking-[0.2em] text-white/50">
                    Job Details
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-accent text-white/60">
                  <span className="flex items-center gap-1.5">
                    <Hash size={10} className="text-white/35" />
                    Int. Ref: <span className="text-white/80 font-medium ml-1">{intRef}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Building2 size={10} className="text-white/35" />
                    {selectedCompanyLabel}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers size={10} className="text-white/35" />
                    Job: <span className="text-white/80 font-medium ml-1">{searchResult.fullCclbdNo}</span>
                  </span>
                </div>
              </div>

              {/* Color selection — multi-select with checkboxes */}
              <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <Palette size={14} className="text-[#66a80f]/50" />
                    <span className="text-[10px] font-display font-medium uppercase tracking-[0.2em] text-white/50">
                      Select Colors
                    </span>
                  </div>
                  <span className="text-[10px] font-accent text-white/35">
                    {selectedColorIds.size}/{allColors.length}
                  </span>
                </div>

                {/* Select All */}
                <motion.button
                  type="button"
                  onClick={toggleAll}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 mb-2 ${
                    allSelected
                      ? "bg-[#66a80f]/[0.08] border border-[#66a80f]/25"
                      : "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]"
                  }`}
                >
                  {allSelected ? (
                    <CheckSquare size={14} className="text-[#66a80f] flex-shrink-0" strokeWidth={1.5} />
                  ) : (
                    <Square size={14} className="text-white/25 flex-shrink-0" strokeWidth={1.5} />
                  )}
                  <span
                    className={`text-xs font-display font-semibold transition-colors ${
                      allSelected ? "text-white" : "text-white/50"
                    }`}
                  >
                    Select All
                  </span>
                </motion.button>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allColors.map((color) => {
                    const isSelected = selectedColorIds.has(color.id);
                    return (
                      <motion.button
                        key={color.id}
                        type="button"
                        onClick={() => toggleColor(color.id)}
                        whileTap={{ scale: 0.97 }}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                          isSelected
                            ? "bg-[#66a80f]/[0.08] border border-[#66a80f]/25"
                            : "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]"
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare size={13} className="text-[#66a80f] flex-shrink-0" strokeWidth={1.5} />
                        ) : (
                          <Square size={13} className="text-white/25 flex-shrink-0" strokeWidth={1.5} />
                        )}
                        <span
                          className={`text-xs font-display font-medium transition-colors truncate ${
                            isSelected ? "text-white" : "text-white/50"
                          }`}
                        >
                          {color.name}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Scan type selection */}
              <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3.5">
                  <Filter size={14} className="text-[#66a80f]/50" />
                  <span className="text-[10px] font-display font-medium uppercase tracking-[0.2em] text-white/50">
                    Sewing Scan Filter
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "scanned" as const, label: "Scanned" },
                    { value: "unscanned" as const, label: "Unscanned" },
                  ].map((opt) => {
                    const isActive = scanChoice === opt.value;
                    return (
                      <motion.button
                        key={opt.value}
                        type="button"
                        onClick={() => setScanChoice(opt.value)}
                        whileTap={{ scale: 0.97 }}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 ${
                          isActive
                            ? "bg-[#66a80f]/[0.08] border border-[#66a80f]/25"
                            : "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                            isActive ? "border-[#66a80f]" : "border-white/20"
                          }`}
                        >
                          <AnimatePresence>
                            {isActive && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="w-1.5 h-1.5 rounded-full bg-[#66a80f]"
                              />
                            )}
                          </AnimatePresence>
                        </div>
                        <span
                          className={`text-xs font-display font-medium transition-colors ${
                            isActive ? "text-white" : "text-white/50"
                          }`}
                        >
                          {opt.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetAll}
                  className="flex-1 py-2.5 border-2 border-white/[0.08] text-white/50 rounded-full font-display text-sm font-medium hover:border-white/[0.15] hover:text-white/70 transition-all duration-300"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={loading || selectedColorIds.size === 0}
                  className="flex-1 py-2.5 bg-[#66a80f] text-white rounded-full font-display text-sm font-medium tracking-wide hover:bg-[#5a9a0d] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Generate <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 3: Report Table ═══ */}
          {step === "report" && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="space-y-4"
            >
              {/* Summary bar */}
              <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-accent text-white/70">
                    <span className="flex items-center gap-1.5">
                      <Hash size={10} className="text-white/35" />
                      {intRef}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Palette size={10} className="text-white/35" />
                      {selectedColorNames.length <= 2
                        ? selectedColorNames.join(", ")
                        : `${selectedColorNames.length} colors`}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ScanLine size={10} className="text-white/35" />
                      {scanChoice === "scanned" ? "Scanned" : "Unscanned"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-display font-bold text-[#66a80f]">
                      {hasAnyReportFilter ? `${filteredReportData.length}/` : ""}{reportTotal}
                    </span>
                    <span className="text-xs font-accent text-white/60 uppercase tracking-wider">
                      Bundles
                    </span>
                  </div>
                </div>
              </div>

              {/* Search filters for report */}
              <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4 sm:p-5 print:hidden">
                <div className="flex items-center gap-2 mb-3">
                  <Search size={14} className="text-white/60" />
                  <span className="text-xs font-display font-semibold uppercase tracking-[0.2em] text-white/70">
                    Search
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: "barcode" as const, label: "Barcode", icon: <Barcode size={10} />, placeholder: "Search..." },
                    { key: "challanNo" as const, label: "Challan No", icon: <FileText size={10} />, placeholder: "Search..." },
                    { key: "size" as const, label: "Size", icon: <Ruler size={10} />, placeholder: "Search..." },
                    { key: "lineNo" as const, label: "Line No", icon: <Layers size={10} />, placeholder: "Search..." },
                    { key: "qty" as const, label: "Qty", icon: <Hash size={10} />, placeholder: "Search..." },
                    { key: "output" as const, label: "Output", icon: <CircleCheck size={10} />, placeholder: "Search..." },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="flex items-center gap-1 text-xs font-display font-semibold uppercase tracking-wider text-white/70 mb-1">
                        <span className="text-white/50">{field.icon}</span>
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={reportFilters[field.key]}
                        onChange={(e) => updateReportFilter(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-[#66a80f]/40 focus:ring-1 focus:ring-[#66a80f]/15 transition-all placeholder:text-white/30"
                      />
                    </div>
                  ))}
                </div>

                {/* Date range filters */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-display font-semibold uppercase tracking-wider text-white/70 mb-1">
                      <span className="text-white/50"><CalendarDays size={10} /></span>
                      From Date
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-[#66a80f]/40 focus:ring-1 focus:ring-[#66a80f]/15 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-display font-semibold uppercase tracking-wider text-white/70 mb-1">
                      <span className="text-white/50"><CalendarDays size={10} /></span>
                      To Date
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-[#66a80f]/40 focus:ring-1 focus:ring-[#66a80f]/15 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>

                {hasAnyReportFilter && (
                  <button
                    type="button"
                    onClick={clearReportFilters}
                    className="mt-2 text-xs font-display text-white/50 hover:text-white/80 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Action buttons — at top */}
              <div className="flex gap-3 print:hidden">
                <button
                  type="button"
                  onClick={goBackToColors}
                  className="flex-1 py-2.5 border-2 border-white/[0.08] text-white/50 rounded-full font-display text-sm font-medium hover:border-white/[0.15] hover:text-white/70 transition-all duration-300"
                >
                  Change Filter
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="flex-1 py-2.5 border-2 border-white/[0.08] text-white/50 rounded-full font-display text-sm font-medium hover:border-[#66a80f]/30 hover:bg-[#66a80f]/[0.03] hover:text-white transition-all duration-300"
                >
                  New Search
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 py-2.5 border-2 border-[#66a80f]/20 text-[#66a80f]/70 rounded-full font-display text-sm font-medium hover:border-[#66a80f]/40 hover:bg-[#66a80f]/[0.05] hover:text-[#66a80f] transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Printer size={14} /> Print
                </button>
              </div>

              {/* Data table */}
              {filteredReportData.length === 0 ? (
                <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-10 sm:p-14 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                      <Barcode size={20} className="text-white/30" strokeWidth={1.5} />
                    </div>
                  </div>
                  <p className="font-display text-sm text-white/50 mb-1.5">No bundles found</p>
                  <p className="text-xs font-accent text-white/35">
                    {hasAnyReportFilter ? "Try different search filters" : "No bundles matched the selected filter"}
                  </p>
                </div>
              ) : (
                <div className="bg-[#161616] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <table className="w-full text-left table-fixed">
                    <thead>
                      <tr className="border-b border-white/[0.08]">
                        <th className="w-[15%] px-2 py-3 text-xs font-display font-semibold uppercase tracking-wider text-white/60">Barcode</th>
                        <th className="w-[13%] px-2 py-3 text-xs font-display font-semibold uppercase tracking-wider text-white/60">Cut No</th>
                        <th className="w-[6%] px-1 py-3 text-xs font-display font-semibold uppercase tracking-wider text-white/60 text-center">B.No</th>
                        <th className="w-[8%] px-1 py-3 text-xs font-display font-semibold uppercase tracking-wider text-white/60 text-center">Size</th>
                        <th className="w-[6%] px-1 py-3 text-xs font-display font-semibold uppercase tracking-wider text-white/60 text-center">Qty</th>
                        <th className="w-[13%] px-1.5 py-3 text-xs font-display font-semibold uppercase tracking-wider text-white/60">Date</th>
                        <th className="w-[16%] px-1.5 py-3 text-xs font-display font-semibold uppercase tracking-wider text-white/60">Challan</th>
                        <th className="w-[7%] px-1 py-3 text-xs font-display font-semibold uppercase tracking-wider text-white/60 text-center">Line</th>
                        <th className="w-[10%] px-1 py-3 text-xs font-display font-semibold uppercase tracking-wider text-white/60 text-center">Output</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReportData.map((row, i) => (
                        <motion.tr
                          key={`${row.barcode}-${i}`}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(0.01 * i, 0.5), duration: 0.2 }}
                          className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="px-2 py-2.5 text-sm font-display font-semibold text-white">
                            {row.barcode}
                          </td>
                          <td className="px-2 py-2.5 text-sm font-accent text-white/80 break-all">
                            {row.cuttingNo}
                          </td>
                          <td className="px-1 py-2.5 text-sm font-accent text-white/80 text-center">
                            {row.bundleNo}
                          </td>
                          <td className="px-1 py-2.5 text-sm font-accent text-white/80 text-center">
                            {row.size}
                          </td>
                          <td className="px-1 py-2.5 text-sm font-accent text-white/80 text-center">
                            {row.qty}
                          </td>
                          <td className="px-1.5 py-2.5 text-sm font-accent text-white/80">
                            {row.inputDate}
                          </td>
                          <td className="px-1.5 py-2.5 text-sm font-accent text-white/80">
                            {row.challanNo}
                          </td>
                          <td className="px-1 py-2.5 text-sm font-accent text-white/80 text-center">
                            {row.lineNo}
                          </td>
                          <td className="px-1 py-2.5 text-sm font-accent font-semibold text-center">
                            <span className={row.sewingOutput && row.sewingOutput !== "0" ? "text-[#66a80f]" : "text-red-400"}>
                              {row.sewingOutput}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}


            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-white/[0.04] print:hidden">
          <p className="text-[11px] font-accent text-white/25 text-center leading-relaxed">
            Bundle Wise Sewing Tracking Report
          </p>
        </div>
      </div>
    </div>
  );
}
