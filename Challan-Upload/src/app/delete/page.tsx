"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  Search,
  Building2,
  MapPin,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Hash,
  Calendar,
  Layers,
  Palette,
  Package,
  BookOpen,
  FileText,
  Loader2,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";

/* ── Types ── */
interface ChallanDetails {
  challan_no?: string;
  input_date?: string;
  sewing_company?: string;
  floor?: string;
  line?: string;
  location?: string;
  sewing_source?: string;
  buyer?: string;
  style_ref?: string;
  booking_no?: string;
  color?: string;
  total_qty?: string;
  total_bundles?: string;
}

type DeleteStep = "login" | "search" | "preview" | "confirm" | "result";

interface DeleteResult {
  success: boolean;
  message: string;
}

/* ── Company data ── */
const companies = [
  { id: "2", label: "Cotton Clothing BD" },
  { id: "1", label: "Cotton Club BD" },
  { id: "4", label: "Cotton Clout BD" },
];

const locations = [
  { id: "2", label: "Clothing BD Ltd" },
  { id: "1", label: "Other" },
];

export default function DeletePage() {
  // Auth state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Delete flow state
  const [step, setStep] = useState<DeleteStep>("login");
  const [challanNo, setChallanNo] = useState("");
  const [companyId, setCompanyId] = useState("2");
  const [locationId, setLocationId] = useState("2");
  const [systemId, setSystemId] = useState("");
  const [details, setDetails] = useState<ChallanDetails | null>(null);
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stepError, setStepError] = useState("");

  const usernameRef = useRef<HTMLInputElement>(null);
  const challanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "login") usernameRef.current?.focus();
    if (step === "search") challanRef.current?.focus();
  }, [step]);

  // ── Login ──
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Authentication failed");
        return;
      }

      setAuthToken(data.token);
      setStep("search");
      setUsername("");
      setPassword("");
    } catch {
      setAuthError("Network error - server unreachable");
    } finally {
      setAuthLoading(false);
    }
  };

  // ── API helper ──
  const apiCall = async (body: Record<string, string>) => {
    const res = await fetch("/api/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.status === 401) {
      setAuthToken(null);
      setStep("login");
      setAuthError("Session expired. Please login again.");
      throw new Error("Unauthorized");
    }

    return { data, ok: res.ok };
  };

  // ── Search challan ──
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!challanNo.trim()) return;

    setProcessing(true);
    setStepError("");

    try {
      const { data, ok } = await apiCall({
        action: "search",
        challan_no: challanNo.trim(),
        company_id: companyId,
        location_id: locationId,
      });

      if (!ok) {
        setStepError(data.error || "Challan not found");
        return;
      }

      setSystemId(data.system_id);

      // Auto-preview
      const preview = await apiCall({
        action: "preview",
        system_id: data.system_id,
      });

      if (preview.ok) {
        setDetails(preview.data.details || null);
        setStep("preview");
      } else {
        setStepError(preview.data.error || "Failed to load details");
      }
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") return;
      setStepError("Connection error");
    } finally {
      setProcessing(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    setProcessing(true);
    setStepError("");

    try {
      const { data } = await apiCall({
        action: "delete",
        system_id: systemId,
        challan_no: challanNo.trim(),
        company_id: companyId,
        location_id: locationId,
      });

      setDeleteResult({
        success: data.success || false,
        message: data.message || data.error || "Unknown response",
      });
      setStep("result");
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") return;
      setStepError("Delete request failed");
    } finally {
      setProcessing(false);
    }
  };

  // ── Reset for new delete ──
  const resetFlow = () => {
    setChallanNo("");
    setSystemId("");
    setDetails(null);
    setDeleteResult(null);
    setStepError("");
    setStep("search");
  };

  // ── Detail row component ──
  const DetailRow = ({
    icon,
    label,
    value,
  }: {
    icon: React.ReactNode;
    label: string;
    value?: string;
  }) =>
    value ? (
      <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
        <div className="text-[#66a80f]/60 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-display font-medium uppercase tracking-[0.15em] text-white/40 mb-0.5">
            {label}
          </p>
          <p className="text-sm font-display text-white/90">{value}</p>
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-dvh bg-[#0d0d0d]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0d0d0d]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-lg mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <Link
            href="/history"
            className="inline-flex items-center gap-2.5 text-sm text-white/40 hover:text-white/70 transition-colors font-display"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">History</span>
          </Link>
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-500/70" />
            <h1 className="font-display text-base sm:text-lg font-semibold text-white">
              Delete Challan
            </h1>
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 sm:px-8 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          {/* ═══ LOGIN STEP ═══ */}
          {step === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                  <Shield size={28} className="text-red-500/70" strokeWidth={1.5} />
                </div>
                <h2 className="font-display text-xl font-bold text-white mb-2">
                  Restricted Access
                </h2>
                <p className="text-sm font-accent text-white/40 max-w-xs mx-auto">
                  Administrative credentials required to proceed with challan deletion
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5 sm:p-6 space-y-4">
                  {/* Username */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-display font-medium uppercase tracking-wider text-white/50 mb-2">
                      <User size={12} className="text-white/35" />
                      Username
                    </label>
                    <input
                      ref={usernameRef}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/15 transition-all placeholder:text-white/25"
                      placeholder="Enter username"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-display font-medium uppercase tracking-wider text-white/50 mb-2">
                      <Lock size={12} className="text-white/35" />
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="off"
                        className="w-full px-4 py-3 pr-12 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/15 transition-all placeholder:text-white/25"
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Auth Error */}
                <AnimatePresence>
                  {authError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      <XCircle size={16} className="text-red-400 flex-shrink-0" />
                      <p className="text-xs font-accent text-red-300">{authError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={authLoading || !username || !password}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-red-600/30 disabled:cursor-not-allowed text-white rounded-xl font-display text-sm font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5"
                >
                  {authLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <LogIn size={16} />
                  )}
                  {authLoading ? "Authenticating..." : "Authenticate"}
                </button>

                <p className="text-[10px] font-accent text-white/25 text-center mt-3">
                  Protected by HMAC token authentication with rate limiting
                </p>
              </form>
            </motion.div>
          )}

          {/* ═══ SEARCH STEP ═══ */}
          {step === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Search size={18} className="text-amber-500/70" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Find Challan
                  </h2>
                  <p className="text-xs font-accent text-white/35">
                    Enter the challan number to search
                  </p>
                </div>
              </div>

              <form onSubmit={handleSearch} className="space-y-4">
                <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5 sm:p-6 space-y-4">
                  {/* Challan No */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-display font-medium uppercase tracking-wider text-white/50 mb-2">
                      <Hash size={12} className="text-white/35" />
                      Challan Number
                    </label>
                    <input
                      ref={challanRef}
                      type="text"
                      inputMode="numeric"
                      value={challanNo}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "");
                        setChallanNo(v);
                      }}
                      className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/15 transition-all placeholder:text-white/25"
                      placeholder="Enter challan number"
                    />
                  </div>

                  {/* Company */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-display font-medium uppercase tracking-wider text-white/50 mb-2">
                      <Building2 size={12} className="text-white/35" />
                      Company
                    </label>
                    <div className="relative">
                      <select
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/15 transition-all appearance-none cursor-pointer"
                      >
                        {companies.map((c) => (
                          <option key={c.id} value={c.id} className="bg-[#1a1a1a] text-white">
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[10px] font-display font-medium uppercase tracking-wider text-white/50 mb-2">
                      <MapPin size={12} className="text-white/35" />
                      Location
                    </label>
                    <div className="relative">
                      <select
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-sm text-white font-display focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/15 transition-all appearance-none cursor-pointer"
                      >
                        {locations.map((l) => (
                          <option key={l.id} value={l.id} className="bg-[#1a1a1a] text-white">
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {stepError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      <XCircle size={16} className="text-red-400 flex-shrink-0" />
                      <p className="text-xs font-accent text-red-300">{stepError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Search button */}
                <button
                  type="submit"
                  disabled={processing || !challanNo.trim()}
                  className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/30 disabled:cursor-not-allowed text-white rounded-xl font-display text-sm font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5"
                >
                  {processing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                  {processing ? "Searching..." : "Search Challan"}
                </button>
              </form>
            </motion.div>
          )}

          {/* ═══ PREVIEW STEP ═══ */}
          {step === "preview" && details && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#66a80f]/10 border border-[#66a80f]/20 flex items-center justify-center">
                  <FileText size={18} className="text-[#66a80f]/70" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Challan Details
                  </h2>
                  <p className="text-xs font-accent text-white/35">
                    Review before deletion
                  </p>
                </div>
              </div>

              {/* Details card */}
              <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5 sm:p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-display font-medium uppercase tracking-[0.15em] text-white/40">
                    System ID: {systemId}
                  </span>
                </div>

                <div className="space-y-0">
                  <DetailRow
                    icon={<Hash size={14} />}
                    label="Challan No"
                    value={details.challan_no}
                  />
                  <DetailRow
                    icon={<Calendar size={14} />}
                    label="Input Date"
                    value={details.input_date}
                  />
                  <DetailRow
                    icon={<Building2 size={14} />}
                    label="Sewing Company"
                    value={details.sewing_company}
                  />
                  <DetailRow
                    icon={<MapPin size={14} />}
                    label="Location"
                    value={details.location}
                  />
                  <DetailRow
                    icon={<Layers size={14} />}
                    label="Floor"
                    value={details.floor}
                  />
                  <DetailRow
                    icon={<Layers size={14} />}
                    label="Line"
                    value={details.line}
                  />
                  <DetailRow
                    icon={<BookOpen size={14} />}
                    label="Buyer"
                    value={details.buyer}
                  />
                  <DetailRow
                    icon={<FileText size={14} />}
                    label="Style Ref"
                    value={details.style_ref}
                  />
                  <DetailRow
                    icon={<BookOpen size={14} />}
                    label="Booking / Internal Ref"
                    value={details.booking_no}
                  />
                  <DetailRow
                    icon={<Palette size={14} />}
                    label="Color"
                    value={details.color}
                  />
                  <DetailRow
                    icon={<Package size={14} />}
                    label="Total Quantity"
                    value={details.total_qty}
                  />
                  <DetailRow
                    icon={<Package size={14} />}
                    label="Total Bundles"
                    value={details.total_bundles}
                  />
                </div>
              </div>

              {/* Warning */}
              <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl px-4 py-3.5 mb-4 flex items-start gap-3">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-display font-semibold text-red-300 mb-0.5">
                    Irreversible Action
                  </p>
                  <p className="text-[11px] font-accent text-red-300/60">
                    This will permanently delete the challan from the ERP system and local database.
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {stepError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-3 mb-4"
                  >
                    <XCircle size={16} className="text-red-400 flex-shrink-0" />
                    <p className="text-xs font-accent text-red-300">{stepError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={resetFlow}
                  disabled={processing}
                  className="py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white/70 rounded-xl font-display text-sm font-medium tracking-wide transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={15} />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep("confirm")}
                  disabled={processing}
                  className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-display text-sm font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ CONFIRM STEP ═══ */}
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="bg-[#161616] border border-red-500/20 rounded-2xl p-6 sm:p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                  <AlertTriangle size={28} className="text-red-500" strokeWidth={1.5} />
                </div>

                <h3 className="font-display text-xl font-bold text-white mb-2">
                  Final Confirmation
                </h3>
                <p className="text-sm font-accent text-white/40 mb-2">
                  You are about to delete challan
                </p>
                <p className="font-display text-2xl font-bold text-red-400 mb-6">
                  #{challanNo}
                </p>

                <p className="text-xs font-accent text-red-300/50 mb-6">
                  This operation will remove the challan from the ERP system permanently.
                  There is no way to recover it after deletion.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("preview")}
                    disabled={processing}
                    className="py-3.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white/70 rounded-xl font-display text-sm font-medium tracking-wide transition-all duration-300"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={processing}
                    className="py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-red-600/30 disabled:cursor-not-allowed text-white rounded-xl font-display text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    {processing ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ RESULT STEP ═══ */}
          {step === "result" && deleteResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-6 sm:p-8 text-center">
                <div
                  className={`w-16 h-16 rounded-full border flex items-center justify-center mx-auto mb-5 ${
                    deleteResult.success
                      ? "bg-[#66a80f]/10 border-[#66a80f]/20"
                      : "bg-red-500/10 border-red-500/20"
                  }`}
                >
                  {deleteResult.success ? (
                    <CheckCircle2 size={28} className="text-[#66a80f]" strokeWidth={1.5} />
                  ) : (
                    <XCircle size={28} className="text-red-500" strokeWidth={1.5} />
                  )}
                </div>

                <h3 className="font-display text-xl font-bold text-white mb-2">
                  {deleteResult.success ? "Deletion Complete" : "Deletion Failed"}
                </h3>
                <p
                  className={`text-sm font-accent mb-2 ${
                    deleteResult.success ? "text-[#66a80f]/70" : "text-red-400/70"
                  }`}
                >
                  {deleteResult.message}
                </p>
                <p className="text-xs font-accent text-white/30 mb-6">
                  Challan #{challanNo}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/history"
                    className="py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white/70 rounded-xl font-display text-sm font-medium tracking-wide transition-all duration-300 text-center"
                  >
                    History
                  </Link>
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-display text-sm font-semibold tracking-wide transition-all duration-300"
                  >
                    Delete Another
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Security footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d0d]/80 backdrop-blur border-t border-white/[0.03]">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-center gap-2">
          <Lock size={10} className="text-white/20" />
          <p className="text-[10px] font-accent text-white/20">
            Secured session with token-based authentication
          </p>
        </div>
      </div>
    </div>
  );
}
