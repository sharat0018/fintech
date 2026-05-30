"use client";

import React from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Cpu,
  ShieldAlert,
  FileText,
  Settings,
  TrendingUp,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "ai-cfo", label: "AI CFO Chat", icon: MessageSquare },
    { id: "simulator", label: "Financial Twin", icon: Cpu },
    { id: "risk-radar", label: "Risk Radar", icon: ShieldAlert },
    { id: "reports", label: "Reports & Briefs", icon: FileText },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-[rgba(255,255,255,0.06)] bg-[#070b19] flex flex-col h-screen sticky top-0">
      {/* Brand Logo */}
      <div className="p-6 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-100">
            FinSight <span className="text-indigo-400">AI</span>
          </h1>
          <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">
            Autonomous CFO
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm shadow-indigo-500/5"
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-6 border-t border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400">
            F
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-300">Founder Account</p>
            <p className="text-[10px] text-slate-500">Acme Ventures</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
