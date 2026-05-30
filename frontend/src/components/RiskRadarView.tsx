"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Activity,
  ShieldCheck,
  TrendingDown,
  Percent,
  Layers,
  Info,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";

interface RiskRadarProps {
  companyId: string;
  metrics: any;
}

export default function RiskRadarView({ companyId, metrics }: RiskRadarProps) {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAnomalies(companyId);
      if (res.status === "success") {
        setAnomalies(res.anomalies || []);
      }
    } catch (err) {
      console.error("Failed to fetch anomalies:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchAnomalies();
  }, [companyId, fetchAnomalies]);

  const formatCurrency = (val: number) => {
    if (val === undefined || val === null) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Determine Overall Risk Level
  const getOverallRisk = () => {
    const score = metrics?.health_score ?? 100;
    const runway = metrics?.runway_months ?? 12;

    if (runway < 3 || score < 30) return { label: "CRITICAL", classes: "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse-glow" };
    if (runway < 6 || score < 50) return { label: "HIGH", classes: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
    if (runway < 12 || score < 70) return { label: "MEDIUM", classes: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    return { label: "LOW", classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  };

  const overall = getOverallRisk();

  // Radar Data calculation
  const runwayPct = Math.min(100, Math.max(0, ((18 - (metrics?.runway_months ?? 0)) / 18) * 100)); // risk is higher when runway is lower
  const burnPct = Math.min(100, Math.max(0, ((metrics?.monthly_burn_rate ?? 0) / max((metrics?.current_mrr ?? 1), 1)) * 100));
  const healthInvPct = 100 - (metrics?.health_score ?? 100);
  const anomalyCountRisk = Math.min(100, anomalies.length * 15);

  const radarData = [
    { subject: "Runway Risk", value: runwayPct },
    { subject: "Burn Ratio", value: burnPct },
    { subject: "Overall Stress", value: healthInvPct },
    { subject: "Anomaly Frequency", value: anomalyCountRisk },
    { subject: "Growth Stress", value: Math.max(0, 50 - (metrics?.revenue_growth_pct ?? 0)) },
  ];

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Risk Metrics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Risk Profile Card */}
        <div className="p-6 glass-card border border-slate-800 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Risk Profile Assessment</h4>
              <p className="text-xs text-slate-400">Statistical risk exposure overview</p>
            </div>

            <div className={`p-6 border rounded-2xl flex flex-col items-center justify-center text-center gap-2 ${overall.classes}`}>
              <AlertTriangle className="w-10 h-10 animate-pulse-glow" />
              <p className="text-[10px] font-bold tracking-wider uppercase opacity-70">Stress Assessment Level</p>
              <h3 className="text-2xl font-black">{overall.label}</h3>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex justify-between border-b border-[rgba(255,255,255,0.04)] pb-2 text-slate-400">
                <span>Runway Threat:</span>
                <span className="text-slate-200 font-semibold">{metrics?.runway_months < 6 ? "Critical" : "Manageable"}</span>
              </div>
              <div className="flex justify-between border-b border-[rgba(255,255,255,0.04)] pb-2 text-slate-400">
                <span>Total Flagged Ledger Spikes:</span>
                <span className="text-slate-200 font-semibold mono">{anomalies.length} items</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Expense Concentration Index:</span>
                <span className="text-slate-200 font-semibold">
                  {metrics?.category_breakdown?.[0]
                    ? `${metrics.category_breakdown[0].category} (${((metrics.category_breakdown[0].total / (sumExpenses(metrics) || 1)) * 100).toFixed(0)}%)`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recharts Radar Exposure Chart */}
        <div className="lg:col-span-2 p-6 glass-card border border-slate-800 flex flex-col min-h-[300px]">
          <div>
            <h4 className="text-sm font-bold text-slate-200">Risk Stress Vectors</h4>
            <p className="text-xs text-slate-400">Multi-axis stress metrics mapping structural business threats</p>
          </div>
          <div className="flex-1 w-full h-[250px] flex items-center justify-center mt-4">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.04)" />
                  <PolarAngleAxis dataKey="subject" stroke="#475569" fontSize={9} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={8} />
                  <Radar name="Threat Factor" dataKey="value" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Anomalies Ledger Board */}
      <div className="p-6 glass-card border border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-sm font-bold text-slate-200">Flagged Anomalies Board</h4>
            <p className="text-xs text-slate-400">Outliers and sudden spending spikes isolated by Isolation Forest ML model</p>
          </div>
          <span className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full font-semibold">
            {anomalies.length} Isolated Outliers
          </span>
        </div>

        {anomalies.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/10 flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <p className="text-xs font-semibold text-slate-300">Clean Bill of Health</p>
            <p className="text-[10px] text-slate-500">No anomalous spikes or structural ledger outliers detected.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)] text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">ML Outlier Score</th>
                  <th className="py-3 px-4 pl-6">Anomaly Explanation</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((txn, idx) => {
                  const dateStr = new Date(txn.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const scorePct = (txn.anomaly_score * 100).toFixed(0);
                  return (
                    <tr
                      key={txn.id || idx}
                      className="border-b border-[rgba(255,255,255,0.02)] hover:bg-slate-900/20"
                    >
                      <td className="py-3.5 px-4 text-slate-400 mono">{dateStr}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-200">{txn.description}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-[rgba(255,255,255,0.04)]">
                          {txn.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-400 mono">
                        {formatCurrency(txn.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] font-bold text-rose-400 mono">{scorePct}%</span>
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-rose-500 rounded-full"
                              style={{ width: `${scorePct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 pl-6 text-slate-400 text-xs italic flex items-center gap-1.5 max-w-sm leading-normal">
                        <Info className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{txn.anomaly_reason || "Transaction deviates significantly from historic mean."}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function max(a: number, b: number) {
  return a > b ? a : b;
}

function sumExpenses(metrics: any) {
  return metrics?.category_breakdown?.reduce((acc: number, item: any) => acc + item.total, 0) || 0;
}
