"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Database,
  Hash,
  Layers,
  Calendar,
  BookOpen,
  FileText,
  Printer,
  FileBarChart,
  Search,
  ChevronLeft,
  ChevronRight,
  Palette,
  Package,
  Trash2,
} from "lucide-react";

/* ── Types ── */
interface ChallanEntry {
  id: string;
  challan_no: string;
  system_id: string;
  company_name: string;
  booking_no: string;
  line_no: string;
  color: string;
  date: string;
  total_quantity: number;
  report1_url: string;
  report2_url: string;
  created_at: string | null;
}

interface Stats {
  today: number;
  week: number;
  month: number;
  total: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SearchFilters {
  challan_no: string;
  line_no: string;
  date: string;
  booking_no: string;
}

export default function HistoryPage() {
  const [stats, setStats] = useState<Stats>({ today: 0, week: 0, month: 0, total: 0 });
  const [entries, setEntries] = useState<ChallanEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>({
    challan_no: "",
    line_no: "",
    date: "",
    booking_no: "",
  });

  const fetchData = useCallback(async (page: number, f: SearchFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (f.challan_no) params.set("challan_no", f.challan_no);
      if (f.line_no) params.set("line_no", f.line_no);
      if (f.date) params.set("date", f.date);
      if (f.booking_no) params.set("booking_no", f.booking_no);

      const res = await fetch(`/api/history?${params.toString()}`);
      const data = await res.json();

      if (data.error) {
        console.error(data.error);
        return;
      }

      setEntries(data.entries || []);
      setStats(data.stats || { today: 0, week: 0, month: 0, total: 0 });
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    fetchData(1, filters);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearFilters = () => {
    const empty: SearchFilters = { challan_no: "", line_no: "", date: "", booking_no: "" };
    setFilters(empty);
    fetchData(1, empty);
  };

  const goToPage = (p: number) => {
    if (p < 1 || p > pagination.totalPages) return;
    fetchData(p, filters);
  };

  const hasAnyFilter = Object.values(filters).some((v) => v.trim() !== "");

  const statCards = [
    { label: "Today", value: stats.today, icon: <CalendarDays size={18} strokeWidth={1.5} /> },
    { label: "Last 7 Days", value: stats.week, icon: <CalendarRange size={18} strokeWidth={1.5} /> },
    { label: "Last 30 Days", value: stats.month, icon: <CalendarClock size={18} strokeWidth={1.5} /> },
    { label: "Grand Total", value: stats.total, icon: <Database size={18} strokeWidth={1.5} /> },
  ];

  const searchFields: { key: keyof SearchFilters; label: string; icon: React.ReactNode; placeholder: string; inputMode?: "numeric" | "text" }[] = [
    { key: "challan_no", label: "Challan No", icon: <Hash size={14} />, placeholder: "e.g. 12345", inputMode: "numeric" },
    { key: "line_no", label: "Line No", icon: <Layers size={14} />, placeholder: "e.g. 5", inputMode: "numeric" },
    { key: "date", label: "Date", icon: <Calendar size={14} />, placeholder: "e.g. 26-Feb-2026" },
    { key: "booking_no", label: "Booking No", icon: <BookOpen size={14} />, placeholder: "e.g. BK-1001" },
  ];

  return (
    <div className="min-h-dvh bg-[#0d0d0d]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0d0d0d]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-sm text-white/40 hover:text-white/70 transition-colors font-display"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <h1 className="font-display text-base sm:text-lg font-semibold text-white">
            Challan History
          </h1>
          <Link
            href="/delete"
            className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-red-500/20 hover:bg-red-500/[0.06] transition-all group"
            title="Delete Challan"
          >
            <Trash2 size={15} className="text-white/25 group-hover:text-red-400 transition-colors" strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-6 sm:py-8">

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
        >
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4 sm:p-5"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="text-[#66a80f] opacity-50">{card.icon}</div>
                <span className="text-[10px] font-display font-medium uppercase tracking-[0.15em] text-white/50">
                  {card.label}
                </span>
              </div>
              <p className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {loading ? "\u2014" : card.value}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Search Fields */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4 sm:p-5 mb-6"
        >
          <div className="flex items-center gap-2 mb-3.5">
            <Search size={14} className="text-white/50" />
            <span className="text-[10px] font-display font-medium uppercase tracking-[0.2em] text-white/50">
              Search Filters
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {searchFields.map((field) => (
              <div key={field.key}>
                <label className="flex items-center gap-1.5 text-[10px] font-display font-medium uppercase tracking-wider text-white/60 mb-1.5">
                  <span className="text-white/40">{field.icon}</span>
                  {field.label}
                </label>
                <input
                  type="text"
                  inputMode={field.inputMode || "text"}
                  value={filters[field.key]}
                  onChange={(e) => updateFilter(field.key, e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={field.placeholder}
                  className="w-full px-3.5 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-[#66a80f]/40 focus:ring-1 focus:ring-[#66a80f]/15 transition-all placeholder:text-white/30"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={handleSearch}
              className="px-5 py-2 bg-[#66a80f] text-white rounded-full font-display text-xs font-medium tracking-wide hover:bg-[#5a9a0d] transition-all duration-300 flex items-center gap-2"
            >
              <Search size={13} /> Search
            </button>
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-display text-white/50 hover:text-white/80 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </motion.div>

        {/* Challan List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-display font-medium uppercase tracking-[0.2em] text-white/50">
              Saved Challans
            </h2>
            <span className="text-xs font-accent text-white/40">
              {pagination.total} entries
            </span>
          </div>

          {loading ? (
            <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-10 text-center">
              <div className="w-5 h-5 border-2 border-white/10 border-t-[#66a80f] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-accent text-white/40">Loading...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-10 sm:p-14 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <FileText size={20} className="text-white/30" strokeWidth={1.5} />
                </div>
              </div>
              <p className="font-display text-sm text-white/50 mb-1.5">No challans found</p>
              <p className="text-xs font-accent text-white/35">
                {hasAnyFilter ? "Try different search filters" : "Processed challans will appear here"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 * i, duration: 0.3 }}
                  className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4 sm:px-5 sm:py-4 hover:border-white/[0.1] transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Top row: challan + company */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-display text-base font-semibold text-white">
                          #{entry.challan_no}
                        </span>
                        <span className="text-[10px] font-accent px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 whitespace-nowrap">
                          {entry.company_name}
                        </span>
                      </div>

                      {/* Details grid */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-accent text-white/50">
                        <span className="flex items-center gap-1">
                          <Hash size={10} className="text-white/35" />
                          SID: {entry.system_id}
                        </span>
                        {entry.line_no && (
                          <span className="flex items-center gap-1">
                            <Layers size={10} className="text-white/35" />
                            Line: {entry.line_no}
                          </span>
                        )}
                        {entry.booking_no && (
                          <span className="flex items-center gap-1">
                            <BookOpen size={10} className="text-white/35" />
                            {entry.booking_no}
                          </span>
                        )}
                        {entry.color && (
                          <span className="flex items-center gap-1">
                            <Palette size={10} className="text-white/35" />
                            {entry.color}
                          </span>
                        )}
                        {entry.total_quantity > 0 && (
                          <span className="flex items-center gap-1">
                            <Package size={10} className="text-white/35" />
                            Qty: {entry.total_quantity}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar size={10} className="text-white/35" />
                          {entry.date}
                        </span>
                      </div>
                    </div>

                    {/* Report links */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={`/api/report?url=${encodeURIComponent(entry.report1_url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#66a80f]/20 hover:bg-[#66a80f]/[0.04] transition-all"
                        title="Call List"
                      >
                        <Printer size={14} className="text-white/45 group-hover:text-[#66a80f]" strokeWidth={1.5} />
                      </a>
                      <a
                        href={`/api/report?url=${encodeURIComponent(entry.report2_url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#66a80f]/20 hover:bg-[#66a80f]/[0.04] transition-all"
                        title="Challan Report"
                      >
                        <FileBarChart size={14} className="text-white/45 group-hover:text-[#66a80f]" strokeWidth={1.5} />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`w-9 h-9 rounded-xl font-display text-sm font-medium transition-all ${
                      pageNum === pagination.page
                        ? "bg-[#66a80f] text-white"
                        : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.1]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-white/[0.04]">
          <p className="text-[11px] font-accent text-white/40 text-center">
            Showing page {pagination.page} of {pagination.totalPages || 1}
          </p>
        </div>
      </div>
    </div>
  );
}
