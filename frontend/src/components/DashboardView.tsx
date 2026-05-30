"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Upload,
  Database,
  Calendar,
  Layers,
  ArrowRightLeft,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

interface DashboardViewProps {
  metrics: any;
  setMetrics: (m: any) => void;
  transactions: any[];
  setTransactions: (t: any[]) => void;
  companyId: string;
  setCompanyId: (id: string) => void;
  onRefresh: () => void;
}

export default function DashboardView({
  metrics,
  setMetrics,
  transactions,
  setTransactions,
  companyId,
  setCompanyId,
  onRefresh,
}: DashboardViewProps) {
  const [mounted, setMounted] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Real-time Gateway Ingestion form states
  const [ingestDesc, setIngestDesc] = useState("");
  const [ingestAmount, setIngestAmount] = useState("");
  const [ingestCategory, setIngestCategory] = useState("Miscellaneous");
  const [ingestAccount, setIngestAccount] = useState("Operating");
  const [ingestDate, setIngestDate] = useState(new Date().toISOString().split("T")[0]);
  const [ingestLoading, setIngestLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !ingestDesc || !ingestAmount) return;

    setIngestLoading(true);
    try {
      const res = await api.createTransaction(companyId, {
        date: ingestDate,
        description: ingestDesc,
        category: ingestCategory,
        amount: parseFloat(ingestAmount),
        account_type: ingestAccount,
      });

      if (res.status === "success") {
        setIngestDesc("");
        setIngestAmount("");
        onRefresh();
      }
    } catch (err) {
      console.error("Gateway ingestion failed:", err);
      alert("Gateway error: Failed to ingest transaction.");
    } finally {
      setIngestLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (val === undefined || val === null) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPercent = (val: number) => {
    if (val === undefined || val === null) return "0%";
    return `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
  };

  // Seed default demo data
  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const res = await api.seedDemo();
      if (res.status === "success") {
        setCompanyId(res.company_id);
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to seed data:", err);
    } finally {
      setSeeding(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await api.uploadFile(file);
      if (res.status === "success") {
        setCompanyId(res.company_id);
        onRefresh();
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to parse statement. Ensure it has Date, Description, and Amount columns.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "#10b981"; // emerald
    if (score >= 65) return "#0d9488"; // teal
    if (score >= 45) return "#f59e0b"; // amber
    return "#f43f5e"; // rose
  };

  if (!metrics || !transactions.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[70vh] text-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md p-8 glass-card border border-slate-800 flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
            <Activity className="w-8 h-8 animate-pulse-glow" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-100">Welcome to FinSight AI</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Ingest your financial records to initialize your Autonomous CFO Operating System.
            </p>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 ${
              dragActive
                ? "border-indigo-500 bg-indigo-500/5"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
            }`}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
              disabled={uploading}
            />
            <label htmlFor="file-upload" className="flex flex-col items-center gap-2 cursor-pointer">
              <Upload className="w-6 h-6 text-slate-400" />
              <span className="text-xs font-semibold text-indigo-400">
                {uploading ? "Analyzing statement..." : "Upload Bank Statement (CSV/XLSX)"}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2 w-full">
            <div className="h-px bg-slate-800 flex-1" />
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">or</span>
            <div className="h-px bg-slate-800 flex-1" />
          </div>

          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer"
          >
            <Database className="w-4 h-4" />
            {seeding ? "Generating Demo..." : "Initialize Sandbox Demo Mode"}
          </button>
        </motion.div>
      </div>
    );
  }

  // Prep chart data
  const chartData = metrics.monthly_aggregates?.map((item: any) => ({
    name: `${item.year}-${String(item.month).padStart(2, "0")}`,
    Revenue: item.total_inflow,
    Expenses: item.total_outflow,
    NetFlow: item.net_flow,
  })) || [];

  return (
    <div className="space-y-8">
      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* MRR Card */}
        <div className="p-6 glass-card border border-slate-800 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">MRR</span>
            <span className="flex items-center gap-0.5 text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10">
              <TrendingUp className="w-3 h-3" />
              {formatPercent(metrics.revenue_growth_pct)}
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-100 mt-3 mono">
            {formatCurrency(metrics.current_mrr)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">
            ARR: {formatCurrency(metrics.current_arr)}
          </p>
        </div>

        {/* Burn Rate Card */}
        <div className="p-6 glass-card border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Burn Rate</span>
            {metrics.monthly_burn_rate > 0 ? (
              <span className="flex items-center gap-0.5 text-xs text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/10">
                <TrendingUp className="w-3 h-3" />
                Active Outflow
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10">
                <TrendingDown className="w-3 h-3" />
                Cash Accumulating
              </span>
            )}
          </div>
          <h3 className="text-2xl font-black text-slate-100 mt-3 mono">
            {formatCurrency(metrics.monthly_burn_rate)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">
            Avg Expenses: {formatCurrency(metrics.total_expenses / max(metrics.num_months, 1))}
          </p>
        </div>

        {/* Runway Card */}
        <div className="p-6 glass-card border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Runway Remaining</span>
            <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${
              metrics.runway_months >= 12
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/10"
                : metrics.runway_months >= 6
                ? "bg-amber-500/10 text-amber-400 border-amber-500/10"
                : "bg-rose-500/10 text-rose-400 border-rose-500/10"
            }`}>
              {metrics.runway_months >= 12 ? "Safe" : metrics.runway_months >= 6 ? "Warning" : "Critical"}
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-100 mt-3 mono">
            {metrics.runway_months.toFixed(1)} <span className="text-sm font-normal text-slate-400">months</span>
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">
            Forecasted depletion: Q{Math.floor(metrics.runway_months / 3) + 1}
          </p>
        </div>

        {/* Health Score Card */}
        <div className="p-6 glass-card border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Health</span>
            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10 font-bold uppercase tracking-wider">
              {metrics.health_status}
            </span>
          </div>
          <div className="flex items-end gap-3 mt-3">
            <h3 className="text-2xl font-black text-slate-100 mono">
              {metrics.health_score}%
            </h3>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${metrics.health_score}%`,
                  backgroundColor: getHealthColor(metrics.health_score),
                }}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Based on Liquidity, Margin, and Runway
          </p>
        </div>
      </div>

      {/* Main Charts & Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Core Financial Trend Area Chart */}
        <div className="lg:col-span-2 p-6 glass-card border border-slate-800 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Financial History & Run Rate</h4>
              <p className="text-xs text-slate-400">Historical recurring revenue and expense aggregates</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" /> Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full" /> Expenses</span>
            </div>
          </div>
          <div className="flex-1 w-full h-[300px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis
                    dataKey="name"
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val/1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0b1329",
                      borderColor: "rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      color: "#f1f5f9",
                      fontSize: "11px",
                    }}
                  />
                  <Area type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expense Category Breakdown Chart */}
        <div className="p-6 glass-card border border-slate-800 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-200 mb-1">Expense Categorization</h4>
            <p className="text-xs text-slate-400 mb-6">Top categories driving cash outflows</p>
          </div>

          <div className="flex-1 w-full h-[220px] mb-4">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.category_breakdown?.slice(0, 5) || []}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
                  <XAxis type="number" stroke="#475569" fontSize={8} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <YAxis dataKey="category" type="category" stroke="#475569" fontSize={9} tickLine={false} width={65} />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), "Total Outflow"]}
                    contentStyle={{
                      backgroundColor: "#0b1329",
                      borderColor: "rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      color: "#f1f5f9",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="total" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Upload ledger inline */}
          <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
            <input
              type="file"
              id="file-upload-inline"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
            />
            <label
              htmlFor="file-upload-inline"
              className="flex items-center justify-center gap-2 py-2.5 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-slate-900/60 hover:bg-slate-800/40 text-xs font-semibold text-slate-300 hover:text-slate-100 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload New Statement
            </label>
          </div>
        </div>
      </div>

      {/* WebSocket Real-time Transaction Stream Feed & Gateway Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Pane: Live ledger table */}
        <div className="lg:col-span-2 p-6 glass-card border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Real-Time Ledger Stream</h4>
              <p className="text-xs text-slate-400">Live feeds streamed from banking gateway via WebSockets</p>
            </div>
            <span className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full animate-pulse-glow">
              Live Stream
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)] text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {transactions.slice(0, 10).map((txn) => {
                    const dateStr = new Date(txn.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <motion.tr
                        key={txn.id || txn.transaction_id || Math.random()}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={`border-b border-[rgba(255,255,255,0.02)] transition-colors hover:bg-slate-900/30 ${
                          txn.is_anomaly ? "bg-rose-950/10 border-l-2 border-l-rose-500" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-slate-400 mono">{dateStr}</td>
                        <td className="py-3 px-4 font-medium text-slate-200 flex items-center gap-2">
                          {txn.description}
                          {txn.is_anomaly && (
                            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 font-bold uppercase rounded border bg-rose-500/10 border-rose-500/20 text-rose-400">
                              <AlertTriangle className="w-2.5 h-2.5" /> Anomaly
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-[rgba(255,255,255,0.04)]">
                            {txn.category}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold mono ${
                          txn.amount > 0 ? "text-emerald-400" : "text-slate-300"
                        }`}>
                          {txn.amount > 0 ? "+" : ""}{formatCurrency(txn.amount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {txn.is_anomaly ? (
                            <span className="text-[10px] text-rose-400 font-semibold" title={txn.anomaly_reason}>
                              Spike Detected
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Standard</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Pane: Banking Gateway Terminal Ingestion Form */}
        <div className="p-6 glass-card border border-slate-800 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-200 mb-1">Gateway Terminal</h4>
            <p className="text-xs text-slate-400 mb-6 font-medium">Ingest direct transactions into processing pipelines</p>
            
            <form onSubmit={handleIngestSubmit} className="space-y-4 text-[11px]">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS Billing, Client Payout"
                  value={ingestDesc}
                  onChange={(e) => setIngestDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Amount (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. -25000 or 150000"
                    value={ingestAmount}
                    onChange={(e) => setIngestAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Category</label>
                  <select
                    value={ingestCategory}
                    onChange={(e) => setIngestCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="Revenue">Revenue</option>
                    <option value="Payroll">Payroll</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Hosting">Hosting</option>
                    <option value="SaaS">SaaS</option>
                    <option value="Rent">Rent</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Consulting">Consulting</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Account Type</label>
                  <select
                    value={ingestAccount}
                    onChange={(e) => setIngestAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="Operating">Operating</option>
                    <option value="Investing">Investing</option>
                    <option value="Financing">Financing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={ingestDate}
                    onChange={(e) => setIngestDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={ingestLoading}
                className="w-full py-2.5 mt-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {ingestLoading ? "Processing Ingestion..." : "Push Transaction to Gateway"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Math max helper for tsx
function max(a: number, b: number) {
  return a > b ? a : b;
}
