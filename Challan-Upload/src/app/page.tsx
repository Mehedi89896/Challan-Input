"use client";

import { useState, useRef, FormEvent, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Printer,
  FileBarChart,
  RotateCcw,
  Send,
  Scissors,
  Factory,
  ShieldCheck,
  History,
  ChevronRight,
} from "lucide-react";

/* ── Types ── */
interface SuccessResult {
  status: "success";
  challan_no: string;
  system_id: string;
  report1_url: string;
  report2_url: string;
  report1_sig?: string;
  report2_sig?: string;
}
interface ErrorResult {
  status: "error";
  message: string;
}
type ProcessResult = SuccessResult | ErrorResult;

/* ── Company data ── */
const companies = [
  { id: "2", label: "Cotton Clothing" },
  { id: "1", label: "Cotton Club BD" },
  { id: "4", label: "Cotton Clout BD" },
  { id: "3", label: "Tropical Knitex" },
];

export default function Home() {
  const [challanNo, setChallanNo] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("2");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Fetch CSRF token on mount
    fetch("/api/csrf", { credentials: "same-origin" }).catch(() => {});
  }, []);

  /** Read a cookie value by name */
  function getCookie(name: string): string {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!challanNo) return;
    setLoading(true);
    setResult(null);
    try {
      const csrfToken = getCookie("__csrf");
      const res = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "same-origin",
        body: JSON.stringify({ challan: challanNo, company_id: selectedCompany }),
      });
      const data: ProcessResult = await res.json();
      setResult(data);
    } catch {
      setResult({ status: "error", message: "Network error — server unreachable." });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setChallanNo("");
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  return (
    <div className="min-h-dvh bg-[#0d0d0d] flex relative">

      {/* ═══ FULL-SCREEN Loading Overlay ═══ */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a] select-none"
          >
            <div className="flex flex-col items-center">
              {/* Animated SVG ring */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative w-20 h-20 mb-8"
              >
                {/* Outer faint ring */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                </svg>
                {/* Animated arc */}
                <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: "2.5s" }} viewBox="0 0 80 80">
                  <circle
                    cx="40" cy="40" r="36" fill="none"
                    stroke="#66a80f" strokeWidth="1.5"
                    strokeDasharray="40 186" strokeLinecap="round"
                    className="opacity-60"
                  />
                </svg>
                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Scissors size={18} className="text-[#66a80f]/70" strokeWidth={1.5} />
                  </motion.div>
                </div>
              </motion.div>

              {/* Text group */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="flex flex-col items-center gap-3"
              >
                <span className="text-[10px] font-display font-semibold uppercase tracking-[0.4em] text-white/20">
                  Processing
                </span>
                <div className="w-6 h-px bg-white/[0.06]" />
                <motion.span
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="text-[10px] font-accent tracking-wider text-white/15"
                >
                  Please wait
                </motion.span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ LEFT PANEL — Decorative (hidden on mobile) ═══ */}
      <div className="hidden lg:flex lg:w-[45%] relative bg-[#111111] items-center justify-center overflow-hidden">
        {/* Blur orbs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#66a80f]/8 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#66a80f]/5 blur-3xl" />

        <div className="relative z-10 text-center px-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#66a80f]/10 border border-[#66a80f]/20 flex items-center justify-center">
                <Scissors size={22} className="text-[#66a80f]" />
              </div>
            </div>
            <h2 className="font-display text-4xl font-semibold text-white mb-4">
              Sewing Input
            </h2>
            <p className="font-accent text-[#66a80f] text-xl mb-6">Production Portal</p>
            <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
              Streamline your challan processing workflow. Submit challan numbers, track system entries, and generate production reports instantly.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-14"
          >
            <div className="font-display text-3xl font-semibold text-white">
              Cotton<span className="text-[#66a80f]"> Clothing BD Ltd.</span>
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <ShieldCheck size={13} className="text-[#66a80f]/60" />
              <span className="text-[11px] font-accent uppercase tracking-[0.25em] text-white/30">
                Secure System
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — Form ═══ */}
      <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-6 sm:py-8 lg:py-6 relative overflow-hidden">
        {/* Subtle background orb for right panel */}
        <div className="absolute top-1/4 -right-32 w-80 h-80 rounded-full bg-[#66a80f]/[0.03] blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo (shown only on mobile) */}
          <div className="lg:hidden mb-6 text-center">
            <div className="font-display text-2xl font-semibold text-white inline-flex items-center gap-2.5">
              <Scissors size={20} className="text-[#66a80f]" />
              Sewing<span className="text-[#66a80f]">Input</span>
            </div>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <Factory size={12} className="text-[#66a80f]/60" />
              <span className="text-[10px] font-accent uppercase tracking-[0.2em] text-white/35">
                Production Portal
              </span>
            </div>
          </div>

          {/* ═══ Card ═══ */}
          <div className="bg-[#161616] border border-white/[0.06] rounded-3xl p-6 sm:p-8 shadow-2xl relative">



            <AnimatePresence mode="wait">
              {/* ═══ FORM STATE ═══ */}
              {!result && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-white mb-1">
                    Submit Challan
                  </h1>
                  <p className="text-sm font-accent text-white/40 mb-5">
                    Enter challan number and select your company
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    {/* Challan Number */}
                    <div>
                      <label className="block text-xs font-display font-medium text-white/60 uppercase tracking-wider mb-1.5">
                        Challan Number
                      </label>
                      <div className="relative">
                        <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          ref={inputRef}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={challanNo}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            setChallanNo(v);
                          }}
                          required
                          autoComplete="off"
                          placeholder="Enter challan number"
                          className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white font-display focus:outline-none focus:border-[#66a80f]/50 focus:ring-1 focus:ring-[#66a80f]/20 transition-all placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    {/* Company Selection */}
                    <div>
                      <label className="block text-xs font-display font-medium text-white/60 uppercase tracking-wider mb-1.5">
                        <Building2 size={12} className="inline mr-1.5 -mt-0.5" />
                        Company
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {companies.map((c) => {
                          const active = selectedCompany === c.id;
                          return (
                            <motion.button
                              key={c.id}
                              type="button"
                              onClick={() => setSelectedCompany(c.id)}
                              whileTap={{ scale: 0.97 }}
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 ${
                                active
                                  ? "bg-[#66a80f]/[0.08] border border-[#66a80f]/25"
                                  : "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]"
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                                active ? "border-[#66a80f]" : "border-white/20"
                              }`}>
                                <AnimatePresence>
                                  {active && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      exit={{ scale: 0 }}
                                      className="w-1.5 h-1.5 rounded-full bg-[#66a80f]"
                                    />
                                  )}
                                </AnimatePresence>
                              </div>
                              <span className={`text-xs font-display font-medium transition-colors ${
                                active ? "text-white" : "text-white/50"
                              }`}>
                                {c.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loading || !challanNo}
                      className="w-full py-2.5 sm:py-3 bg-[#66a80f] text-white rounded-full font-display text-sm font-medium tracking-wide hover:bg-[#5a9a0d] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send size={15} /> Submit Challan
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ═══ SUCCESS STATE ═══ */}
              {result?.status === "success" && (() => {
                const r = result as SuccessResult;
                return (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* Checkmark */}
                    <div className="flex justify-center mb-5">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                        className="relative"
                      >
                        <div className="w-16 h-16 rounded-full bg-[#66a80f]/10 border border-[#66a80f]/20 flex items-center justify-center">
                          <CheckCircle2 size={30} className="text-[#66a80f]" strokeWidth={1.5} />
                        </div>
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.5 }}
                          animate={{ scale: 2.2, opacity: 0 }}
                          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                          className="absolute inset-0 rounded-full bg-[#66a80f]/10"
                        />
                      </motion.div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-center mb-6"
                    >
                      <p className="text-[11px] font-display font-semibold uppercase tracking-[0.2em] text-[#66a80f]/70 mb-2">
                        Saved Successfully
                      </p>
                      <p className="font-display text-3xl font-bold tracking-tight text-white">
                        {r.challan_no}
                      </p>
                      <p className="mt-1.5 text-xs font-accent text-white/30">
                        System ID · <span className="text-white/50">{r.system_id}</span>
                      </p>
                    </motion.div>

                    {/* Report buttons */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="grid grid-cols-2 gap-3 mb-5"
                    >
                      <a
                        href={`/api/report?url=${encodeURIComponent(r.report1_url)}&sig=${encodeURIComponent(r.report1_sig || "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 transition-all duration-300 hover:border-[#66a80f]/25 hover:bg-[#66a80f]/[0.04]"
                      >
                        <Printer size={18} className="text-white/25 group-hover:text-[#66a80f] transition-colors" strokeWidth={1.5} />
                        <span className="text-[11px] font-display font-medium text-white/35 group-hover:text-white/80 transition-colors">
                          Call List
                        </span>
                      </a>
                      <a
                        href={`/api/report?url=${encodeURIComponent(r.report2_url)}&sig=${encodeURIComponent(r.report2_sig || "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 transition-all duration-300 hover:border-[#66a80f]/25 hover:bg-[#66a80f]/[0.04]"
                      >
                        <FileBarChart size={18} className="text-white/25 group-hover:text-[#66a80f] transition-colors" strokeWidth={1.5} />
                        <span className="text-[11px] font-display font-medium text-white/35 group-hover:text-white/80 transition-colors">
                          Challan
                        </span>
                      </a>
                    </motion.div>

                    {/* Another entry */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="pt-4 border-t border-white/[0.06]"
                    >
                      <button
                        onClick={reset}
                        className="w-full py-2.5 flex items-center justify-center gap-2 rounded-full border-2 border-white/[0.08] text-white/50 text-sm font-display font-medium hover:border-[#66a80f]/30 hover:bg-[#66a80f]/[0.03] hover:text-white transition-all duration-300"
                      >
                        <RotateCcw size={14} />
                        Input Another Challan
                      </button>
                    </motion.div>
                  </motion.div>
                );
              })()}

              {/* ═══ ERROR STATE ═══ */}
              {result?.status === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-4"
                >
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-sm text-red-400 font-display"
                  >
                    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                    <span>{(result as ErrorResult).message}</span>
                  </motion.div>

                  <button
                    onClick={reset}
                    className="w-full py-2.5 sm:py-3 border-2 border-white/[0.08] text-white/60 rounded-full font-display text-sm font-medium tracking-wide hover:border-[#66a80f]/30 hover:bg-[#66a80f]/[0.03] hover:text-white transition-all duration-300"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Footer ── */}
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-[11px] font-accent text-white/25 text-center leading-relaxed">
                System developed by{" "}
                <span className="text-[#66a80f]/70 font-semibold">Mehedi Hasan</span>
                . All activity is monitored.
              </p>
            </div>
          </div>

          {/* ── Challan History link ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-4"
          >
            <Link
              href="/history"
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#66a80f]/20 hover:bg-[#66a80f]/[0.03] transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <History size={16} className="text-white/25 group-hover:text-[#66a80f]/60 transition-colors" />
                <span className="text-sm font-display font-medium text-white/40 group-hover:text-white/70 transition-colors">
                  Challan History
                </span>
              </div>
              <ChevronRight size={14} className="text-white/15 group-hover:text-white/40 transition-colors" />
            </Link>
          </motion.div>

          {/* ── Below card ── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-3 text-xs font-accent text-white/25"
          >
            Cotton Clothing BD Ltd &middot; {new Date().getFullYear()}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
