"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import DashboardView from "@/components/DashboardView";
import AICFOView from "@/components/AICFOView";
import SimulatorView from "@/components/SimulatorView";
import RiskRadarView from "@/components/RiskRadarView";
import ReportsView from "@/components/ReportsView";
import SettingsView from "@/components/SettingsView";
import { api } from "@/lib/api";
import { WebSocketManager, wsUrl } from "@/lib/websocket";
import { MessageSquare, Sparkles, Bot, Cpu } from "lucide-react";

// Beautiful custom guide panel displayed on the right when 'ai-cfo' tab is selected
function AICFOGuideView({ metrics, wsStatus }: { metrics: any; wsStatus: string }) {
  return (
    <div className="space-y-6 max-w-3xl animate-slide-up">
      <div className="p-6 border border-indigo-500/10 rounded-2xl bg-indigo-950/10">
        <h4 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-indigo-400" /> Autonomous CFO Command Console
        </h4>
        <p className="text-sm text-slate-300 leading-relaxed">
          Welcome to FinSight AI's unified workspace. The chatbot on the left is active at all times. Use it to ask questions, run scenario simulations, check company risks, or review executive briefs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 border border-slate-800 bg-slate-900/40 rounded-xl space-y-3">
          <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" /> Local LLM Engine Status
          </h5>
          <p className="text-xs text-slate-400 leading-normal">
            Local Ollama inference requests run sequentially to keep CPU/GPU utilization stable under heavy loads.
          </p>
          <div className="p-3 bg-slate-900/60 rounded-lg text-[10px] text-slate-300 border border-[rgba(255,255,255,0.02)] space-y-1">
            <p>• Model Tag: <span className="text-indigo-400 font-semibold">qwen3:14b (or fallback)</span></p>
            <p>• Status: <span className={`font-semibold ${wsStatus === 'connected' ? 'text-emerald-400' : 'text-slate-400'}`}>{wsStatus === 'connected' ? 'Ready' : 'Connecting'}</span></p>
            <p>• Lock: <span className="text-indigo-400 font-semibold">Sequential Execution Lock Active</span></p>
          </div>
        </div>

        <div className="p-5 border border-slate-800 bg-slate-900/40 rounded-xl space-y-3">
          <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" /> Interactive Commands
          </h5>
          <p className="text-xs text-slate-400 leading-normal">
            Your chatbot is directly connected to the system dashboards. Try typing:
          </p>
          <div className="space-y-1.5 font-mono text-[10px] text-slate-300">
            <div className="p-2 bg-slate-950/40 rounded border border-slate-800/80 hover:border-indigo-500/20 transition">
              "What if we hire 3 developers at 120,000?"
            </div>
            <div className="p-2 bg-slate-950/40 rounded border border-slate-800/80 hover:border-indigo-500/20 transition">
              "Check risk radar for any ledger anomalies"
            </div>
            <div className="p-2 bg-slate-950/40 rounded border border-slate-800/80 hover:border-indigo-500/20 transition">
              "Generate an investor readiness assessment"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppPortal() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [metrics, setMetrics] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Subtab for reports view (board vs investor)
  const [reportsSubTab, setReportsSubTab] = useState<"board" | "investor">("board");
  // Custom chatbot simulation results state
  const [chatbotSimResult, setChatbotSimResult] = useState<any>(null);
  // Programmatic prompt triggers state
  const [externalPrompt, setExternalPrompt] = useState<{ text: string; timestamp: number } | null>(null);

  // WebSocket statuses
  const [wsTxnStatus, setWsTxnStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");
  const [wsAgentStatus, setWsAgentStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");

  // Keep references to WebSocket managers
  const wsTxnRef = useRef<WebSocketManager | null>(null);
  const wsAgentRef = useRef<WebSocketManager | null>(null);

  // Refresh metrics and transaction lists
  const handleRefresh = useCallback(async () => {
    if (!companyId) return;
    try {
      const metricRes = await api.getMetrics(companyId);
      if (metricRes.status === "success") {
        setMetrics(metricRes.metrics);
      }

      const txnRes = await api.getTransactions(companyId, 50);
      if (txnRes.status === "success") {
        setTransactions(txnRes.transactions || []);
      }
    } catch (err) {
      console.error("Refresh error:", err);
    }
  }, [companyId]);

  // Initial load: Fetch existing company or seed
  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.getCompanies();
        if (res.status === "success" && res.companies && res.companies.length > 0) {
          const comp = res.companies[0];
          setCompanyId(comp.id);
          setCompanyName(comp.name);
        }
      } catch (err) {
        console.error("Init companies fetch error:", err);
      }
    };
    init();
  }, []);

  // Sync metrics on company selection
  useEffect(() => {
    if (companyId) {
      handleRefresh();
    }
  }, [companyId, handleRefresh]);

  // Connect WebSockets when companyId is active
  useEffect(() => {
    if (!companyId) return;

    // 1. Transaction WebSocket Setup
    const txnUrl = wsUrl(`/api/v1/ws/transactions?company_id=${companyId}`);
    const wsTxn = new WebSocketManager(txnUrl);
    wsTxnRef.current = wsTxn;

    wsTxn.onStatusChange((status) => {
      setWsTxnStatus(status);
    });

    // Prepend new transactions and alert on anomalies
    wsTxn.on("transaction_created", (data) => {
      setTransactions((prev) => [data, ...prev]);
      // Refetch aggregates in background to update KPI metrics
      api.getMetrics(companyId).then((res) => {
        if (res.status === "success") setMetrics(res.metrics);
      });
    });

    wsTxn.on("anomaly_alert", (data) => {
      setTransactions((prev) => [data, ...prev]);
      // Refetch aggregates in background to update KPI metrics
      api.getMetrics(companyId).then((res) => {
        if (res.status === "success") setMetrics(res.metrics);
      });
    });

    wsTxn.connect();

    // 2. Agent WebSocket Setup
    const agentUrl = wsUrl(`/api/v1/ws/agents?company_id=${companyId}`);
    const wsAgent = new WebSocketManager(agentUrl);
    wsAgentRef.current = wsAgent;

    wsAgent.onStatusChange((status) => {
      setWsAgentStatus(status);
    });

    wsAgent.connect();

    // Cleanup on companyId change / component unmount
    return () => {
      wsTxn.disconnect();
      wsAgent.disconnect();
    };
  }, [companyId]);

  // Handle system actions returned by Chatbot
  const handleSystemAction = useCallback((action: { type: string; subtype?: string; params?: any; data?: any }) => {
    if (action.type === "simulator") {
      if (action.data) {
        const enriched = { ...action.data, params: action.params };
        setChatbotSimResult(enriched);
      }
      setActiveTab("simulator");
    } else if (action.type === "risk-radar") {
      setActiveTab("risk-radar");
    } else if (action.type === "reports") {
      if (action.subtype === "board" || action.subtype === "investor") {
        setReportsSubTab(action.subtype);
      }
      setActiveTab("reports");
    } else if (action.type === "dashboard") {
      setActiveTab("dashboard");
    }
  }, []);

  // Handle manual project scenarios from Simulator sliders
  const handleSimulateRun = useCallback((params: any, result: any) => {
    const formattedSalary = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(params.avg_salary_monthly);

    const formattedMktg = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(params.marketing_spend_delta);

    setExternalPrompt({
      text: `Explain the strategic impact of this projected scenario:
• Hiring: ${params.hiring_count} employee(s) at ${formattedSalary}/month.
• Marketing: ${params.marketing_spend_delta >= 0 ? "+" : ""}${formattedMktg} change.
• Price Multiplier: ${params.pricing_multiplier}x.
• Revenue Growth: ${params.revenue_growth_pct}%.
• Cost Overhead Increase: ${params.cost_increase_pct}%.
• Downturn Mode: ${params.economic_downturn ? "Active" : "Inactive"}.`,
      timestamp: Date.now()
    });
  }, []);

  // Render current tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardView
            metrics={metrics}
            setMetrics={setMetrics}
            transactions={transactions}
            setTransactions={setTransactions}
            companyId={companyId}
            setCompanyId={setCompanyId}
            onRefresh={handleRefresh}
          />
        );
      case "ai-cfo":
        return <AICFOGuideView metrics={metrics} wsStatus={wsAgentStatus} />;
      case "simulator":
        return (
          <SimulatorView
            companyId={companyId}
            chatbotSimResult={chatbotSimResult}
            onSimulateRun={handleSimulateRun}
          />
        );
      case "risk-radar":
        return <RiskRadarView companyId={companyId} metrics={metrics} />;
      case "reports":
        return <ReportsView companyId={companyId} defaultSubTab={reportsSubTab} />;
      case "settings":
        return (
          <SettingsView
            companyId={companyId}
            setCompanyId={setCompanyId}
            onRefresh={handleRefresh}
          />
        );
      default:
        return (
          <DashboardView
            metrics={metrics}
            setMetrics={setMetrics}
            transactions={transactions}
            setTransactions={setTransactions}
            companyId={companyId}
            setCompanyId={setCompanyId}
            onRefresh={handleRefresh}
          />
        );
    }
  };

  return (
    <div className="flex flex-col bg-[#020617] text-[#f1f5f9] h-screen overflow-hidden">
      {/* Brand Header */}
      <Header wsStatus={wsTxnStatus} metrics={metrics} companyName={companyName} />
      
      {/* Split-pane content view */}
      <div className="flex flex-1 overflow-hidden p-6 gap-6 h-[calc(100vh-80px)] bg-[#020617]">
        {/* Left Column: The Permanent Assistant Chatbot */}
        <div className="w-[35%] min-w-[380px] max-w-[480px] flex flex-col border border-slate-800/80 bg-[#070b19]/60 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl shrink-0">
          <div className="p-4 bg-slate-900/40 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <MessageSquare className="w-4 h-4 text-indigo-400 animate-pulse" /> AI CFO Assistant
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${wsAgentStatus === 'connected' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[10px] text-slate-400 font-semibold">
                {wsAgentStatus === 'connected' ? 'Agent Live' : 'Agent Offline'}
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-slate-950/20">
            <AICFOView 
              companyId={companyId} 
              wsAgent={wsAgentRef.current} 
              onSystemAction={handleSystemAction}
              externalPrompt={externalPrompt}
            />
          </div>
        </div>

        {/* Right Column: Interactive dashboards and settings */}
        <div className="flex-1 flex flex-col min-w-0 border border-slate-800/80 bg-[#070b19]/20 rounded-2xl p-6 backdrop-blur-md shadow-inner overflow-hidden">
          {/* Workspace Tab Switcher */}
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4 mb-6 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
              {[
                { id: "dashboard", label: "Dashboard" },
                { id: "simulator", label: "Financial Twin" },
                { id: "risk-radar", label: "Risk Radar" },
                { id: "reports", label: "Reports & Briefs" },
                { id: "settings", label: "Settings" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-indigo-600/90 text-white shadow-md shadow-indigo-500/10 border border-indigo-500/25"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="text-[10px] text-slate-500 font-mono hidden md:block">
              SYSTEM PORTAL / ACTIVE VIEW
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
