"use client";

import React from "react";
import { Shield, Sparkles, Wifi, WifiOff } from "lucide-react";

interface HeaderProps {
  wsStatus: "connected" | "disconnected" | "reconnecting";
  metrics: any;
  companyName: string;
}

export default function Header({ wsStatus, metrics, companyName }: HeaderProps) {
  const getStatusConfig = () => {
    switch (wsStatus) {
      case "connected":
        return {
          label: "WS Connected",
          classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: Wifi,
        };
      case "reconnecting":
        return {
          label: "Reconnecting",
          classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          icon: Wifi,
        };
      case "disconnected":
        default:
        return {
          label: "Disconnected",
          classes: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          icon: WifiOff,
        };
    }
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  const formatCurrency = (val: number) => {
    if (val === undefined || val === null) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getHealthBadgeClass = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (score >= 65) return "bg-teal-500/10 text-teal-400 border-teal-500/20";
    if (score >= 45) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  };

  return (
    <header className="border-b border-[rgba(255,255,255,0.06)] bg-[#070b19]/80 backdrop-blur-md px-8 py-4 flex items-center justify-between sticky top-0 z-40">
      {/* Logo & Company Title */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight tracking-tight text-slate-100">
              FinSight <span className="text-indigo-400">AI</span>
            </h1>
          </div>
        </div>

        <div className="h-6 w-[1px] bg-slate-800/80" />

        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-200 tracking-tight">
            {companyName || "Acme Ventures"}
          </h2>
          {/* WS Status Badge */}
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full border ${status.classes}`}
          >
            <span className={`status-dot ${wsStatus}`} />
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="flex items-center gap-6">
        {metrics && (
          <>
            {/* Health Score */}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900/60 rounded-xl border border-[rgba(255,255,255,0.04)]">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Health Score</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-200">{metrics.health_score ?? 0}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${getHealthBadgeClass(metrics.health_score ?? 0)}`}>
                    {metrics.health_status ?? "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Runway */}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900/60 rounded-xl border border-[rgba(255,255,255,0.04)]">
              <Shield className="w-4 h-4 text-emerald-400" />
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Runway</p>
                <p className="text-sm font-bold text-slate-200">
                  {metrics.runway_months !== undefined ? `${metrics.runway_months.toFixed(1)} months` : "N/A"}
                </p>
              </div>
            </div>

            {/* Reserves */}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900/60 rounded-xl border border-[rgba(255,255,255,0.04)]">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cash On Hand</p>
                <p className="text-sm font-bold text-slate-100 mono">
                  {formatCurrency(metrics.cash_reserves)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
