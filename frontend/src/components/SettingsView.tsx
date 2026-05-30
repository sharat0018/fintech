"use client";

import React, { useState } from "react";
import {
  Database,
  Cpu,
  Server,
  RefreshCw,
  HardDrive,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";

interface SettingsViewProps {
  companyId: string;
  setCompanyId: (id: string) => void;
  onRefresh: () => void;
}

export default function SettingsView({ companyId, setCompanyId, onRefresh }: SettingsViewProps) {
  const [seeding, setSeeding] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSeedData = async () => {
    setSeeding(true);
    setSuccess(false);
    try {
      const res = await api.seedDemo();
      if (res.status === "success") {
        setCompanyId(res.company_id);
        onRefresh();
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to seed data:", err);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-slide-up">
      {/* DB Controls Card */}
      <div className="p-6 glass-card border border-slate-800 space-y-6">
        <div>
          <h4 className="text-sm font-bold text-slate-200">Database & Demo Management</h4>
          <p className="text-xs text-slate-400">Initialize sandbox company models and control ledger states</p>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-900/40 border border-slate-800 rounded-xl gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-indigo-400" />
            <div>
              <p className="text-xs font-semibold text-slate-200">Reset & Seed Sandbox Ledger</p>
              <p className="text-[10px] text-slate-500">Injects 12 months of synthetic bank statement records with typical SaaS patterns</p>
            </div>
          </div>
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/25 text-xs font-semibold hover:border-indigo-500/40 transition cursor-pointer disabled:opacity-50"
          >
            {seeding ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Seeding DB...
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Seed Complete
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5" /> Reseed Demo Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* System info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* API specifications */}
        <div className="p-6 glass-card border border-slate-800 space-y-4">
          <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" /> System Specifications
          </h5>
          <div className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between border-b border-[rgba(255,255,255,0.04)] pb-2 text-slate-400">
              <span>Framework Engine:</span>
              <span className="text-slate-200 font-semibold mono">FastAPI v0.115</span>
            </div>
            <div className="flex justify-between border-b border-[rgba(255,255,255,0.04)] pb-2 text-slate-400">
              <span>Database Layer:</span>
              <span className="text-slate-200 font-semibold mono">MongoDB 7.0 (via Motor)</span>
            </div>
            <div className="flex justify-between border-b border-[rgba(255,255,255,0.04)] pb-2 text-slate-400">
              <span>Real-Time Layer:</span>
              <span className="text-slate-200 font-semibold mono">WebSocket Gateway</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Frontend Core:</span>
              <span className="text-slate-200 font-semibold mono">Next.js 15 (Tailwind CSS)</span>
            </div>
          </div>
        </div>

        {/* AI specifications */}
        <div className="p-6 glass-card border border-slate-800 space-y-4">
          <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" /> AI Agent Core Specs
          </h5>
          <div className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between border-b border-[rgba(255,255,255,0.04)] pb-2 text-slate-400">
              <span>Multi-Agent Orchestrator:</span>
              <span className="text-slate-200 font-semibold">CFO, Risk, Forecast, Recs</span>
            </div>
            <div className="flex justify-between border-b border-[rgba(255,255,255,0.04)] pb-2 text-slate-400">
              <span>Inference Host:</span>
              <span className="text-slate-200 font-semibold">Ollama Local API</span>
            </div>
            <div className="flex justify-between border-b border-[rgba(255,255,255,0.04)] pb-2 text-slate-400">
              <span>Target LLM:</span>
              <span className="text-slate-200 font-semibold mono">qwen3:14b</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Thought Delivery:</span>
              <span className="text-slate-200 font-semibold">Async Stream (JSON events)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
