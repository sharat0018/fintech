"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Sparkles,
  TrendingUp,
  Download,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  ChevronRight,
  TrendingUp as GrowthIcon,
} from "lucide-react";
import { api } from "@/lib/api";

interface ReportsViewProps {
  companyId: string;
  defaultSubTab?: "board" | "investor";
}

export default function ReportsView({ companyId, defaultSubTab }: ReportsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"board" | "investor">("board");
  const [boardReport, setBoardReport] = useState<any>(null);
  const [investorReport, setInvestorReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  const fetchBoardReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getBoardReport(companyId);
      if (res.status === "success") {
        setBoardReport(res);
      }
    } catch (err) {
      console.error("Board report fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchInvestorReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getInvestorReport(companyId);
      if (res.status === "success") {
        setInvestorReport(res);
      }
    } catch (err) {
      console.error("Investor report fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (activeSubTab === "board") {
      fetchBoardReport();
    } else {
      fetchInvestorReport();
    }
  }, [companyId, activeSubTab, fetchBoardReport, fetchInvestorReport]);

  const formatCurrency = (val: number) => {
    if (val === undefined || val === null) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs selector */}
      <div className="flex gap-4 border-b border-[rgba(255,255,255,0.06)] pb-px">
        <button
          onClick={() => setActiveSubTab("board")}
          className={`pb-4 text-sm font-semibold tracking-tight border-b-2 cursor-pointer transition ${
            activeSubTab === "board"
              ? "text-indigo-400 border-indigo-500"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          Executive Board Report
        </button>
        <button
          onClick={() => setActiveSubTab("investor")}
          className={`pb-4 text-sm font-semibold tracking-tight border-b-2 cursor-pointer transition ${
            activeSubTab === "investor"
              ? "text-indigo-400 border-indigo-500"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          Investor Readiness Assessment
        </button>
      </div>

      {loading && (
        <div className="py-12 flex justify-center text-xs text-indigo-400 items-center gap-2">
          <span className="status-dot connected animate-spin" />
          <span>Generating intelligence brief...</span>
        </div>
      )}

      {!loading && activeSubTab === "board" && boardReport && (
        <div className="space-y-6 animate-slide-up max-w-4xl">
          {/* Board Brief Overview Card */}
          <div className="p-6 glass-card border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Board Briefing Package</h4>
                <p className="text-xs text-slate-400">Generated on {boardReport.report_date}</p>
              </div>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-slate-900/60 hover:bg-slate-800/40 text-xs font-semibold text-slate-300 hover:text-slate-100 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Print / Export Brief
              </button>
            </div>

            {/* Executive Summary */}
            <div className="p-5 bg-indigo-950/10 border border-indigo-500/10 rounded-2xl">
              <h5 className="text-xs font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider mb-2.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse-glow" /> Executive Summary
              </h5>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {boardReport.executive_summary}
              </p>
            </div>

            {/* Sections grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {boardReport.sections?.map((sec: any, idx: number) => (
                <div key={idx} className="p-5 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-2">
                  <h6 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-500" /> {sec.title}
                  </h6>
                  <p className="text-xs text-slate-400 leading-normal">{sec.content}</p>
                </div>
              ))}
            </div>

            {/* Supporting metric chips */}
            <div className="border-t border-[rgba(255,255,255,0.06)] pt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-slate-900/30 rounded-xl border border-[rgba(255,255,255,0.02)]">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Health Rating</p>
                <p className="text-sm font-extrabold text-slate-200 mt-1">{boardReport.health_score}/100</p>
              </div>
              <div className="p-3 bg-slate-900/30 rounded-xl border border-[rgba(255,255,255,0.02)]">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">MRR Position</p>
                <p className="text-sm font-extrabold text-slate-200 mt-1 mono">{formatCurrency(boardReport.key_metrics?.current_mrr)}</p>
              </div>
              <div className="p-3 bg-slate-900/30 rounded-xl border border-[rgba(255,255,255,0.02)]">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Runway Safe</p>
                <p className="text-sm font-extrabold text-slate-200 mt-1">{boardReport.key_metrics?.runway_months.toFixed(1)} mos</p>
              </div>
              <div className="p-3 bg-slate-900/30 rounded-xl border border-[rgba(255,255,255,0.02)]">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Outflow Burn</p>
                <p className="text-sm font-extrabold text-slate-200 mt-1 mono">{formatCurrency(boardReport.key_metrics?.monthly_burn_rate)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && activeSubTab === "investor" && investorReport && (
        <div className="space-y-6 animate-slide-up max-w-4xl">
          {/* Investor readiness card */}
          <div className="p-6 glass-card border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Investor Readiness Report</h4>
                <p className="text-xs text-slate-400">Institutional fundraising stress test metrics</p>
              </div>
              <span className={`text-xs px-3 py-1 border font-bold uppercase rounded-full ${
                investorReport.investor_score >= 75
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : investorReport.investor_score >= 55
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}>
                {investorReport.funding_readiness}
              </span>
            </div>

            {/* Score Ring Gauge */}
            <div className="py-6 flex flex-col items-center justify-center border-b border-[rgba(255,255,255,0.04)] gap-2">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-95" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="rgba(255,255,255,0.02)"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={investorReport.investor_score >= 75 ? "#10b981" : investorReport.investor_score >= 55 ? "#f59e0b" : "#f43f5e"}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * investorReport.investor_score) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-100">{investorReport.investor_score}%</span>
                  <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Score</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center max-w-xs mt-2">
                Fundraising benchmark score indexing health, runway safety margin, and top line run rate.
              </p>
            </div>

            {/* Strengths & Weaknesses Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Strengths */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Key Funding Strengths
                </h5>
                <div className="space-y-2.5">
                  {investorReport.strengths?.map((str: string, idx: number) => (
                    <div key={idx} className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-slate-300 leading-normal">
                      {str}
                    </div>
                  ))}
                  {(!investorReport.strengths || investorReport.strengths.length === 0) && (
                    <p className="text-xs text-slate-500 italic">No notable investment strengths identified yet.</p>
                  )}
                </div>
              </div>

              {/* Weaknesses */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Funding Gaps & Risks
                </h5>
                <div className="space-y-2.5">
                  {investorReport.weaknesses?.map((weak: string, idx: number) => (
                    <div key={idx} className="p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-xl text-xs text-slate-300 leading-normal">
                      {weak}
                    </div>
                  ))}
                  {(!investorReport.weaknesses || investorReport.weaknesses.length === 0) && (
                    <p className="text-xs text-slate-500 italic">No key institutional fundability gaps detected.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Improvement Roadmap Checklist */}
            {investorReport.improvement_plan && investorReport.improvement_plan.length > 0 && (
              <div className="border-t border-[rgba(255,255,255,0.06)] pt-6 space-y-4">
                <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Fundability Optimization Roadmap
                </h5>
                <div className="space-y-2.5">
                  {investorReport.improvement_plan.map((item: string, idx: number) => (
                    <div key={idx} className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs text-slate-300 flex items-start gap-3">
                      <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
