"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Play,
  Briefcase,
  HelpCircle,
  Megaphone,
  Percent,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";

interface SimulatorViewProps {
  companyId: string;
  chatbotSimResult?: any;
  onSimulateRun?: (params: any, result: any) => void;
}

export default function SimulatorView({ companyId, chatbotSimResult, onSimulateRun }: SimulatorViewProps) {
  // Input parameters state
  const [hiringCount, setHiringCount] = useState(0);
  const [avgSalary, setAvgSalary] = useState(80000);
  const [marketingDelta, setMarketingDelta] = useState(0);
  const [pricingMultiplier, setPricingMultiplier] = useState(1.0);
  const [revenueGrowth, setRevenueGrowth] = useState(0);
  const [costIncrease, setCostIncrease] = useState(0);
  const [downturn, setDownturn] = useState(false);

  // Result state
  const [simResult, setSimResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Sync with chatbot simulation runs
  useEffect(() => {
    if (chatbotSimResult) {
      setSimResult(chatbotSimResult);
      if (chatbotSimResult.status === "success" || chatbotSimResult.runway) {
        // Find parameters from response metadata if present
        const params = chatbotSimResult.company_id === undefined ? chatbotSimResult : null;
      }
    }
  }, [chatbotSimResult]);

  // Sync slider state specifically if parameters are passed from parent
  useEffect(() => {
    if (chatbotSimResult && chatbotSimResult.params) {
      const p = chatbotSimResult.params;
      if (p.hiring_count !== undefined) setHiringCount(p.hiring_count);
      if (p.avg_salary_monthly !== undefined) setAvgSalary(p.avg_salary_monthly);
      if (p.marketing_spend_delta !== undefined) setMarketingDelta(p.marketing_spend_delta);
      if (p.pricing_multiplier !== undefined) setPricingMultiplier(p.pricing_multiplier);
      if (p.revenue_growth_pct !== undefined) setRevenueGrowth(p.revenue_growth_pct);
      if (p.cost_increase_pct !== undefined) setCostIncrease(p.cost_increase_pct);
      if (p.economic_downturn !== undefined) setDownturn(p.economic_downturn);
    }
  }, [chatbotSimResult]);

  const runSimulation = useCallback(async (isManual = false) => {
    setLoading(true);
    try {
      const params = {
        company_id: companyId,
        hiring_count: hiringCount,
        avg_salary_monthly: avgSalary,
        marketing_spend_delta: marketingDelta,
        pricing_multiplier: pricingMultiplier,
        revenue_growth_pct: revenueGrowth,
        cost_increase_pct: costIncrease,
        economic_downturn: downturn,
      };
      const res = await api.simulate(params);
      setSimResult(res);
      if (isManual && onSimulateRun) {
        onSimulateRun(params, res);
      }
    } catch (err) {
      console.error("Simulation run error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId, hiringCount, avgSalary, marketingDelta, pricingMultiplier, revenueGrowth, costIncrease, downturn, onSimulateRun]);

  // Run initial simulation on load or company change
  useEffect(() => {
    runSimulation(false);
  }, [companyId, runSimulation]);

  const formatCurrency = (val: number) => {
    if (val === undefined || val === null) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getDeltaBadgeClass = (delta: number, lowerIsBetter = false) => {
    if (delta === 0) return "bg-slate-800 text-slate-400 border-slate-700";
    const positiveIsGood = !lowerIsBetter;
    const isGood = (delta > 0 && positiveIsGood) || (delta < 0 && !positiveIsGood);
    return isGood
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse-glow"
      : "bg-rose-500/10 text-rose-400 border-rose-500/20";
  };

  const getRiskClass = (level: string) => {
    switch (level) {
      case "Critical":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold animate-pulse-glow";
      case "High":
        return "bg-rose-500/10 text-rose-400 border-rose-500/25";
      case "Medium":
        return "bg-amber-500/10 text-amber-400 border-amber-500/25";
      case "Low":
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Simulation parameter sliders */}
      <div className="p-6 glass-card border border-slate-800 space-y-6 flex flex-col justify-between">
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-bold text-slate-200">Financial Twin Parameters</h4>
            <p className="text-xs text-slate-400">Tweak operating plans to simulate 12-month Runway impact</p>
          </div>

          {/* Hiring Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Additional Hiring</span>
              <span className="text-indigo-400 font-bold">{hiringCount} employees</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={hiringCount}
              onChange={(e) => setHiringCount(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Avg Salary Input */}
          {hiringCount > 0 && (
            <div className="space-y-2 animate-slide-up">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Average Salary (Monthly)</span>
                <span className="text-indigo-400 font-bold mono">{formatCurrency(avgSalary)}</span>
              </div>
              <input
                type="range"
                min="30000"
                max="250000"
                step="5000"
                value={avgSalary}
                onChange={(e) => setAvgSalary(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          )}

          {/* Marketing Spend Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5" /> Marketing Spend Delta</span>
              <span className="text-indigo-400 font-bold mono">{formatCurrency(marketingDelta)}</span>
            </div>
            <input
              type="range"
              min="-100000"
              max="500000"
              step="10000"
              value={marketingDelta}
              onChange={(e) => setMarketingDelta(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Pricing Multiplier Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Pricing Multiplier</span>
              <span className="text-indigo-400 font-bold">{(pricingMultiplier * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={pricingMultiplier}
              onChange={(e) => setPricingMultiplier(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Revenue Growth Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Revenue growth rate</span>
              <span className="text-indigo-400 font-bold">+{revenueGrowth}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={revenueGrowth}
              onChange={(e) => setRevenueGrowth(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Operating Cost Growth Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-semibold">Cost Overhead Increase</span>
              <span className="text-indigo-400 font-bold">+{costIncrease}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={costIncrease}
              onChange={(e) => setCostIncrease(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Downturn Toggle */}
          <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 cursor-pointer select-none transition">
            <input
              type="checkbox"
              checked={downturn}
              onChange={(e) => setDownturn(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500/20 bg-slate-800 border-slate-700 cursor-pointer"
            />
            <div>
              <p className="text-xs font-semibold text-slate-200">Economic Downturn Mode</p>
              <p className="text-[10px] text-slate-500">25% revenue reduction, 5% cost inflation</p>
            </div>
          </label>
        </div>

        {/* Trigger Button */}
        <button
          onClick={() => runSimulation(true)}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50 mt-6"
        >
          <Play className="w-3.5 h-3.5" />
          {loading ? "Calculating twin outputs..." : "Project Scenario"}
        </button>
      </div>

      {/* Side-by-Side Simulation Metrics */}
      <div className="lg:col-span-2 space-y-6">
        {simResult && (
          <>
            {/* Risk Banner */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${getRiskClass(simResult.risk_level)}`}>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider">Scenario Risk Rating</h5>
                  <p className="text-xs opacity-90">Simulated risk parameters project a {simResult.risk_level} threat level.</p>
                </div>
              </div>
              <span className="text-sm font-black px-4 py-1.5 rounded-lg border bg-slate-950/20">
                {simResult.risk_level}
              </span>
            </div>

            {/* Live comparative metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Runway */}
              <div className="p-5 glass-card border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Runway (Months)</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-slate-400">
                    <span className="text-[10px]">Current</span>
                    <p className="text-lg font-bold mono">{simResult.runway.original.toFixed(1)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                  <div className="text-right">
                    <span className="text-[10px] text-indigo-400">Simulated</span>
                    <p className="text-lg font-black text-slate-100 mono">{simResult.runway.simulated.toFixed(1)}</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getDeltaBadgeClass(simResult.runway.delta)}`}>
                    {simResult.runway.delta_pct > 0 ? "+" : ""}{simResult.runway.delta_pct.toFixed(1)}% delta
                  </span>
                </div>
              </div>

              {/* Monthly Burn */}
              <div className="p-5 glass-card border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monthly Burn Rate</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-slate-400">
                    <span className="text-[10px]">Current</span>
                    <p className="text-lg font-bold mono">{formatCurrency(simResult.burn_rate.original)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                  <div className="text-right">
                    <span className="text-[10px] text-indigo-400">Simulated</span>
                    <p className="text-lg font-black text-slate-100 mono">{formatCurrency(simResult.burn_rate.simulated)}</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getDeltaBadgeClass(simResult.burn_rate.delta, true)}`}>
                    {simResult.burn_rate.delta_pct > 0 ? "+" : ""}{simResult.burn_rate.delta_pct.toFixed(1)}% delta
                  </span>
                </div>
              </div>

              {/* Monthly Revenue */}
              <div className="p-5 glass-card border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monthly MRR</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-slate-400">
                    <span className="text-[10px]">Current</span>
                    <p className="text-lg font-bold mono">{formatCurrency(simResult.monthly_revenue.original)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                  <div className="text-right">
                    <span className="text-[10px] text-indigo-400">Simulated</span>
                    <p className="text-lg font-black text-slate-100 mono">{formatCurrency(simResult.monthly_revenue.simulated)}</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getDeltaBadgeClass(simResult.monthly_revenue.delta)}`}>
                    {simResult.monthly_revenue.delta_pct > 0 ? "+" : ""}{simResult.monthly_revenue.delta_pct.toFixed(1)}% delta
                  </span>
                </div>
              </div>

              {/* Health Score */}
              <div className="p-5 glass-card border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Business Health Score</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-slate-400">
                    <span className="text-[10px]">Current</span>
                    <p className="text-lg font-bold mono">{simResult.health_score.original}%</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                  <div className="text-right">
                    <span className="text-[10px] text-indigo-400">Simulated</span>
                    <p className="text-lg font-black text-slate-100 mono">{simResult.health_score.simulated}%</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getDeltaBadgeClass(simResult.health_score.delta)}`}>
                    {simResult.health_score.delta_pct > 0 ? "+" : ""}{simResult.health_score.delta_pct.toFixed(1)}% delta
                  </span>
                </div>
              </div>
            </div>

            {/* AI Advisor Panel */}
            <div className="p-6 glass-card border border-indigo-500/10 rounded-2xl bg-indigo-950/5">
              <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider mb-3">
                <Sparkles className="w-4 h-4 animate-pulse-glow" /> AI Simulation Diagnostic
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {simResult.ai_explanation}
              </p>

              {/* Recommendations list */}
              <div className="space-y-2 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Advisory Action Checklist</h5>
                {simResult.recommendations.map((rec: string, idx: number) => (
                  <p key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-indigo-400 font-bold shrink-0 mt-0.5">•</span>
                    <span>{rec}</span>
                  </p>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
