"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  Bot,
  Brain,
  HelpCircle,
  FileText,
  AlertCircle,
  CheckCircle2,
  Cpu,
} from "lucide-react";
import { motion } from "framer-motion";
import { WebSocketManager } from "@/lib/websocket";

interface AICFOViewProps {
  companyId: string;
  wsAgent: WebSocketManager | null;
  onSystemAction?: (action: { type: string; subtype?: string; params?: any; data?: any }) => void;
  externalPrompt?: { text: string; timestamp: number } | null;
}

interface Thought {
  agent: string;
  status: string;
  message: string;
}

interface ChatMessage {
  sender: "user" | "cfo";
  text?: string;
  thoughts?: Thought[];
  result?: {
    insight: string;
    explanation: string;
    business_impact: string;
    recommendation: string;
    confidence_score: number;
    supporting_data: any[];
    simulation_result?: any;
  };
}

export default function AICFOView({ companyId, wsAgent, onSystemAction, externalPrompt }: AICFOViewProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentThoughts, setCurrentThoughts] = useState<Thought[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, "idle" | "running" | "completed">>({
    CFOAgent: "idle",
    RiskAgent: "idle",
    ForecastAgent: "idle",
    RecommendationAgent: "idle",
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Predefined queries
  const suggestions = [
    "Why did SaaS expenses spike?",
    "How can we improve runway & cash position?",
    "Give me an executive diagnostic report of current metrics.",
    "Recommend cost optimization actions.",
  ];

  useEffect(() => {
    if (!wsAgent) return;

    // Listen to thought stream
    const handleThought = (data: any) => {
      if (data.status === "started") {
        setAgentStatuses((prev) => ({ ...prev, [data.agent]: "running" }));
      } else if (data.status === "completed") {
        setAgentStatuses((prev) => ({ ...prev, [data.agent]: "completed" }));
      } else {
        // Normal thought message
        setCurrentThoughts((prev) => [...prev, data]);
        if (data.agent && data.agent !== "Orchestrator") {
          setAgentStatuses((prev) => ({
            ...prev,
            [data.agent]: prev[data.agent] === "completed" ? "completed" : "running"
          }));
        }
      }
    };

    // Listen to completion
    const handleComplete = (data: any) => {
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          sender: "cfo",
          thoughts: [...currentThoughts],
          result: data,
        },
      ]);
      setCurrentThoughts([]);
      setAgentStatuses({
        CFOAgent: "completed",
        RiskAgent: "completed",
        ForecastAgent: "completed",
        RecommendationAgent: "completed",
      });

      // Invoke system action callback if present
      if (data.system_action && onSystemAction) {
        onSystemAction({
          type: data.system_action.type,
          subtype: data.system_action.subtype,
          params: data.system_action.params,
          data: data.simulation_result,
        });
      }
    };

    wsAgent.on("agent_thought", handleThought);
    wsAgent.on("agent_response_complete", handleComplete);

    return () => {
      wsAgent.off("agent_thought", handleThought);
      wsAgent.off("agent_response_complete", handleComplete);
    };
  }, [wsAgent, currentThoughts, onSystemAction]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentThoughts]);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || prompt;
    if (!query.trim() || !wsAgent) return;

    // Append user message
    setMessages((prev) => [...prev, { sender: "user", text: query }]);
    setLoading(true);
    setCurrentThoughts([]);
    setAgentStatuses({
      CFOAgent: "idle",
      RiskAgent: "idle",
      ForecastAgent: "idle",
      RecommendationAgent: "idle",
    });
    setPrompt("");

    // Trigger analysis over WebSocket
    wsAgent.send({
      action: "analyze_ledger",
      company_id: companyId,
      query: query,
    });
  };

  useEffect(() => {
    if (externalPrompt && externalPrompt.text) {
      handleSend(externalPrompt.text);
    }
  }, [externalPrompt]);

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case "CFOAgent":
        return "text-indigo-400 border-indigo-500/20 bg-indigo-500/5";
      case "RiskAgent":
        return "text-rose-400 border-rose-500/20 bg-rose-500/5";
      case "ForecastAgent":
        return "text-cyan-400 border-cyan-500/20 bg-cyan-500/5";
      case "RecommendationAgent":
        return "text-amber-400 border-amber-500/20 bg-amber-500/5";
      default:
        return "text-slate-400 border-slate-700 bg-slate-800/30";
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Messages / Viewport */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {messages.length === 0 && !loading && (
          <div className="max-w-2xl mx-auto py-12 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Brain className="w-8 h-8 animate-pulse-glow" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">Talk to Your Autonomous AI CFO</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ask queries about burn rate deviations, risk vectors, or future cash trajectories. Our multi-agent orchestrator streams thoughts as it reasons.
              </p>
            </div>

            {/* Suggested Queries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-4">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-left text-xs font-medium text-slate-300 hover:border-indigo-500/30 hover:bg-slate-900/80 transition cursor-pointer flex items-start gap-2.5"
                >
                  <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat History */}
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender !== "user" && (
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
              )}

              <div className="max-w-[85%] space-y-4">
                {msg.sender === "user" ? (
                  <div className="px-4 py-3 rounded-2xl bg-indigo-500 text-white font-medium text-sm shadow-md">
                    {msg.text}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Render Consolidated Agent Report Card */}
                    {msg.result && (
                      <div className="glass-card border border-slate-800 rounded-2xl overflow-hidden shadow-xl animate-slide-up">
                        {/* Header Banner */}
                        <div className="px-6 py-4 bg-gradient-to-r from-indigo-950/60 to-slate-950/60 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5" /> CFO Analysis Complete
                          </span>
                          <span className="text-xs px-2 py-0.5 font-bold bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20">
                            Confidence: {msg.result.confidence_score}%
                          </span>
                        </div>

                        {/* Report Sections */}
                        <div className="p-6 space-y-6 text-sm leading-relaxed">
                          {/* Key Insight */}
                          <div>
                            <h5 className="font-bold text-slate-200 flex items-center gap-2 mb-2">
                              <Brain className="w-4 h-4 text-emerald-400" /> Core Diagnostic
                            </h5>
                            <p className="text-slate-300 bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                              {msg.result.insight}
                            </p>
                          </div>

                          {/* Risk / Impact Assessment */}
                          <div>
                            <h5 className="font-bold text-slate-200 flex items-center gap-2 mb-2">
                              <AlertCircle className="w-4 h-4 text-rose-400" /> Risk Assessment
                            </h5>
                            <p className="text-slate-300 bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl font-medium">
                              {msg.result.business_impact}
                            </p>
                          </div>

                          {/* Actionable recommendations */}
                          <div>
                            <h5 className="font-bold text-slate-200 flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-amber-400" /> Action Roadmap
                            </h5>
                            <p className="text-slate-300 bg-amber-500/5 border border-emerald-500/10 p-4 rounded-xl">
                              {msg.result.recommendation}
                            </p>
                          </div>

                          {/* Inline Simulation Widget */}
                          {msg.result.simulation_result && (
                            <div className="mt-4 p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 space-y-3">
                              <h6 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                                <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Projected Simulation Outputs
                              </h6>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800/85 text-center">
                                  <span className="block text-[9px] font-semibold text-slate-500 uppercase">Runway</span>
                                  <span className={`text-xs font-bold ${msg.result.simulation_result.runway.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {msg.result.simulation_result.runway.simulated.toFixed(1)} mo ({msg.result.simulation_result.runway.delta >= 0 ? "+" : ""}{msg.result.simulation_result.runway.delta.toFixed(1)})
                                  </span>
                                </div>
                                <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800/85 text-center">
                                  <span className="block text-[9px] font-semibold text-slate-500 uppercase">Burn Rate</span>
                                  <span className={`text-xs font-bold ${msg.result.simulation_result.burn_rate.delta <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    ₹{(msg.result.simulation_result.burn_rate.simulated/1000).toFixed(0)}k ({msg.result.simulation_result.burn_rate.delta >= 0 ? "+" : ""}₹{(msg.result.simulation_result.burn_rate.delta/1000).toFixed(0)}k)
                                  </span>
                                </div>
                                <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800/85 text-center">
                                  <span className="block text-[9px] font-semibold text-slate-500 uppercase">Health Score</span>
                                  <span className={`text-xs font-bold ${msg.result.simulation_result.health_score.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {msg.result.simulation_result.health_score.simulated} ({msg.result.simulation_result.health_score.delta >= 0 ? "+" : ""}{msg.result.simulation_result.health_score.delta})
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Real-time thinking log */}
          {loading && (
            <div className="flex gap-4 justify-start max-w-3xl mx-auto">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>

              <div className="flex-1 p-6 glass-card border border-indigo-500/10 rounded-2xl bg-indigo-950/5">
                <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider mb-4">
                  <Brain className="w-3.5 h-3.5 animate-pulse-glow" /> Autonomous Thought Stream
                </h4>

                {/* Real-time Agent Queue / Pipeline Tracker */}
                <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
                  {Object.entries(agentStatuses).map(([agentName, status]) => (
                    <div key={agentName} className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-950/40 border border-slate-900 text-center">
                      <span className="text-[9px] font-bold text-slate-400 mb-1">{agentName.replace("Agent", "")}</span>
                      <div className="flex items-center gap-1">
                        {status === "idle" && (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            <span className="text-[8px] text-slate-500 font-semibold uppercase">Idle</span>
                          </>
                        )}
                        {status === "running" && (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[8px] text-indigo-400 font-bold uppercase animate-pulse">Active</span>
                          </>
                        )}
                        {status === "completed" && (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[8px] text-emerald-400 font-bold uppercase">Done</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 font-mono text-[11px] leading-relaxed text-slate-300">
                  {currentThoughts.map((thought, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className={`px-1.5 py-0.2 text-[9px] rounded font-semibold border w-fit uppercase tracking-wider mb-0.5 ${getAgentColor(thought.agent)}`}>
                          {thought.agent}
                        </span>
                        <span className="text-slate-300">{thought.message}</span>
                      </div>
                    </motion.div>
                  ))}
                  <div className="flex items-center gap-1.5 text-slate-500 pl-6 mt-1">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                    <span>Agent reasoning in progress...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Form Bar */}
      <div className="p-6 border-t border-[rgba(255,255,255,0.06)] bg-[#070b19]/40 backdrop-blur-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="max-w-3xl mx-auto flex gap-3"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            placeholder="Ask AI CFO: e.g. 'Optimize SaaS expenses' or 'Analyze burn trends'..."
            className="flex-1 px-5 py-3.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
