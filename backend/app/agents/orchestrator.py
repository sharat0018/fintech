"""
FinSight AI — Multi-Agent Orchestrator

Coordinates the CFO, Risk, Forecast, and Recommendation agents.
Streams agent thinking steps over WebSocket for real-time visibility.
"""

from typing import List, Dict, Optional, Callable
import asyncio
import logging
import httpx
import json
from app.core.config import settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# OLLAMA HELPERS
# ═══════════════════════════════════════════════════════════════════

ollama_lock = asyncio.Lock()

async def get_best_model() -> str:
    """
    Query the local Ollama instance's tags API to get available models.
    Selects the configured model if present, or falls back to standard Qwen/Gemma models.
    """
    url = f"{settings.OLLAMA_BASE_URL}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                models = [m["name"] for m in data.get("models", [])]
                
                # 1. Configured target model (e.g. qwen3:14b)
                if settings.OLLAMA_MODEL in models:
                    return settings.OLLAMA_MODEL
                
                # 2. Match standard variants that the user might have
                preferred = ["qwen3:14b", "gemma3:12b", "qwen3:8b", "dolphin-llama3:8b", "deepseek-coder:6.7b"]
                for model_tag in preferred:
                    if model_tag in models:
                        return model_tag
                
                # 3. Fuzzy search for model name in tags
                for keyword in ["qwen", "gemma", "llama", "deepseek"]:
                    for existing in models:
                        if keyword in existing.lower():
                            return existing
                
                # 4. Use first available model
                if models:
                    return models[0]
    except Exception as e:
        logger.warning(f"Ollama tags query failed: {e}. Falling back to configured model {settings.OLLAMA_MODEL}")
    return settings.OLLAMA_MODEL


async def _query_ollama_agent(system_prompt: str, user_prompt: str) -> Optional[dict]:
    """Query local Ollama instance with structured JSON constraints."""
    async with ollama_lock:
        try:
            model = await get_best_model()
            url = f"{settings.OLLAMA_BASE_URL}/api/chat"
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "stream": False,
                "format": "json"
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    res_data = response.json()
                    content = res_data.get("message", {}).get("content", "")
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and "thoughts" in parsed and "conclusion" in parsed:
                        return parsed
                else:
                    logger.error(f"Ollama API error {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Error calling Ollama agent: {e}")
        return None


def format_category_breakdown(breakdown: List[dict]) -> str:
    """Format category data into a readable list for LLM context."""
    if not breakdown:
        return "No outflow category breakdown available."
    lines = []
    for item in breakdown[:5]:  # Focus on top 5 categories
        lines.append(f"- {item.get('category', 'Unknown')}: ₹{item.get('total', 0):,.0f} ({item.get('count', 0)} txns)")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════
# AGENT DEFINITIONS
# ═══════════════════════════════════════════════════════════════════

class AgentResult:
    def __init__(self, agent_name: str, thoughts: List[str], conclusion: str):
        self.agent_name = agent_name
        self.thoughts = thoughts
        self.conclusion = conclusion


class CFOAgent:
    """Analyzes financial performance, explains variances, and provides strategic insights."""

    NAME = "CFOAgent"

    async def analyze(self, metrics: dict, query: str, emit_fn: Optional[Callable] = None) -> AgentResult:
        cat_str = format_category_breakdown(metrics.get("category_breakdown", []))
        
        system_prompt = (
            "You are the CFO Agent of FinSight AI. You analyze company financials, explain variances, and answer questions.\n"
            "Respond ONLY with a JSON object in this format:\n"
            "{\n"
            "  \"thoughts\": [\"progressive step 1\", \"progressive step 2\", \"progressive step 3\"],\n"
            "  \"conclusion\": \"2-sentence strategic summary addressing the query\"\n"
            "}"
        )
        
        user_prompt = (
            f"Financial Metrics:\n"
            f"- Monthly Recurring Revenue (MRR): ₹{metrics.get('current_mrr', 0):,.0f}\n"
            f"- Annual Recurring Revenue (ARR): ₹{metrics.get('current_arr', 0):,.0f}\n"
            f"- Total Revenue: ₹{metrics.get('total_revenue', 0):,.0f}\n"
            f"- Total Expenses: ₹{metrics.get('total_expenses', 0):,.0f}\n"
            f"- Net Cash Flow: ₹{metrics.get('net_cash_flow', 0):,.0f}\n"
            f"- Gross Margin: {metrics.get('gross_profit_margin', 0):.1f}%\n"
            f"- Burn Rate: ₹{metrics.get('monthly_burn_rate', 0):,.0f}/month\n"
            f"- Runway: {metrics.get('runway_months', 0):.1f} months\n"
            f"- Health Score: {metrics.get('health_score', 0)}/100 ({metrics.get('health_status', 'Unknown')})\n"
            f"- Revenue Growth: {metrics.get('revenue_growth_pct', 0):.1f}%\n"
            f"- Expense Stability: {metrics.get('expense_stability', 0):.1f}/100\n\n"
            f"Top Outflow Categories:\n{cat_str}\n\n"
            f"Query: \"{query}\""
        )

        logger.info("CFOAgent running analysis...")
        result = await _query_ollama_agent(system_prompt, user_prompt)
        
        if result:
            thoughts = result["thoughts"]
            conclusion = result["conclusion"]
            for thought in thoughts:
                if emit_fn:
                    await emit_fn(self.NAME, "analyzing", thought)
                await asyncio.sleep(0.5)
            return AgentResult(self.NAME, thoughts, conclusion)

        # Fallback to rule-based generation
        logger.info("CFOAgent falling back to rule-based heuristics...")
        thoughts = []
        t1 = f"Analyzing current financial position: MRR ₹{metrics.get('current_mrr', 0):,.0f}, Burn Rate ₹{metrics.get('monthly_burn_rate', 0):,.0f}/month"
        thoughts.append(t1)
        if emit_fn:
            await emit_fn(self.NAME, "analyzing", t1)
        await asyncio.sleep(0.5)

        health = metrics.get("health_score", 0)
        status = metrics.get("health_status", "Unknown")
        t2 = f"Business Health Score: {health}/100 ({status}). Runway: {metrics.get('runway_months', 0):.1f} months"
        thoughts.append(t2)
        if emit_fn:
            await emit_fn(self.NAME, "evaluating", t2)
        await asyncio.sleep(0.5)

        categories = metrics.get("category_breakdown", [])
        if categories:
            top_cat = categories[0]
            t3 = f"Largest expense category: {top_cat['category']} at ₹{top_cat['total']:,.0f}. Reviewing for optimization opportunities."
            thoughts.append(t3)
            if emit_fn:
                await emit_fn(self.NAME, "reviewing", t3)
            await asyncio.sleep(0.3)

        if health >= 70:
            conclusion = f"Financial position is healthy with a score of {health}/100. Revenue growth is positive and burn rate is manageable. Focus on sustaining growth momentum while monitoring expense efficiency."
        elif health >= 45:
            conclusion = f"Financial position is moderate ({health}/100). Burn rate of ₹{metrics.get('monthly_burn_rate', 0):,.0f}/month requires attention. Consider optimizing the top expense categories to improve runway."
        else:
            conclusion = f"Financial position requires immediate attention ({health}/100). Runway is critically low at {metrics.get('runway_months', 0):.1f} months. Recommend immediate cost reduction and revenue acceleration strategies."

        return AgentResult(self.NAME, thoughts, conclusion)


class RiskAgent:
    """Detects financial risks including burn rate, concentration, and liquidity threats."""

    NAME = "RiskAgent"

    async def analyze(self, metrics: dict, emit_fn: Optional[Callable] = None) -> AgentResult:
        cat_str = format_category_breakdown(metrics.get("category_breakdown", []))
        
        system_prompt = (
            "You are the Risk Agent of FinSight AI. You scan financial metrics for runway constraints, burn rate hikes, and vendor concentration risks.\n"
            "Respond ONLY with a JSON object in this format:\n"
            "{\n"
            "  \"thoughts\": [\"risk scan step 1\", \"risk scan step 2\"],\n"
            "  \"conclusion\": \"1-sentence summary of identified risks or 'No critical risks detected.'\"\n"
            "}"
        )
        
        user_prompt = (
            f"Financial Metrics for Risk Assessment:\n"
            f"- Monthly Recurring Revenue (MRR): ₹{metrics.get('current_mrr', 0):,.0f}\n"
            f"- Monthly Burn Rate: ₹{metrics.get('monthly_burn_rate', 0):,.0f}\n"
            f"- Cash Runway: {metrics.get('runway_months', 0):.1f} months\n"
            f"- Cash Reserves: ₹{metrics.get('cash_reserves', 0):,.0f}\n"
            f"- Health Score: {metrics.get('health_score', 0)}/100\n"
            f"- Expense Stability: {metrics.get('expense_stability', 0):.1f}/100\n\n"
            f"Top Outflow Categories:\n{cat_str}"
        )

        logger.info("RiskAgent running analysis...")
        result = await _query_ollama_agent(system_prompt, user_prompt)
        
        if result:
            thoughts = result["thoughts"]
            conclusion = result["conclusion"]
            for thought in thoughts:
                if emit_fn:
                    await emit_fn(self.NAME, "scanning", thought)
                await asyncio.sleep(0.4)
            return AgentResult(self.NAME, thoughts, conclusion)

        # Fallback to rule-based generation
        logger.info("RiskAgent falling back to rule-based heuristics...")
        thoughts = []
        risks = []

        runway = metrics.get("runway_months", 0)
        t1 = f"Scanning runway risk: {runway:.1f} months remaining"
        thoughts.append(t1)
        if emit_fn:
            await emit_fn(self.NAME, "scanning", t1)
        await asyncio.sleep(0.4)

        if runway < 6:
            risks.append({"type": "Runway Risk", "severity": "Critical", "detail": f"Only {runway:.1f} months of runway. Immediate action required."})
        elif runway < 12:
            risks.append({"type": "Runway Risk", "severity": "Medium", "detail": f"Runway at {runway:.1f} months. Monitor closely."})

        burn = metrics.get("monthly_burn_rate", 0)
        rev = metrics.get("current_mrr", 0)
        burn_ratio = burn / max(rev, 1) * 100
        t2 = f"Burn rate analysis: ₹{burn:,.0f}/month ({burn_ratio:.1f}% of revenue)"
        thoughts.append(t2)
        if emit_fn:
            await emit_fn(self.NAME, "analyzing", t2)
        await asyncio.sleep(0.4)

        if burn_ratio > 80:
            risks.append({"type": "Burn Rate Risk", "severity": "High", "detail": f"Burn rate is {burn_ratio:.0f}% of revenue."})

        categories = metrics.get("category_breakdown", [])
        total_exp = sum(c["total"] for c in categories) if categories else 1
        for cat in categories[:3]:
            pct = cat["total"] / total_exp * 100
            if pct > 40:
                t3 = f"Vendor concentration: '{cat['category']}' accounts for {pct:.1f}% of total expenses"
                thoughts.append(t3)
                if emit_fn:
                    await emit_fn(self.NAME, "flagging", t3)
                risks.append({"type": "Concentration Risk", "severity": "Medium", "detail": t3})
                await asyncio.sleep(0.3)

        risk_count = len(risks)
        conclusion = f"Identified {risk_count} risk(s). " + " | ".join([f"{r['type']}: {r['severity']}" for r in risks]) if risks else "No critical risks detected."

        return AgentResult(self.NAME, thoughts, conclusion)


class ForecastAgent:
    """Provides narrative analysis of statistical forecasts."""

    NAME = "ForecastAgent"

    async def analyze(self, forecast_data: dict, emit_fn: Optional[Callable] = None) -> AgentResult:
        rev_forecast = forecast_data.get("revenue_forecast", {})
        trend = rev_forecast.get("trend_direction", "stable")
        confidence = rev_forecast.get("confidence_pct", 0)
        
        runway_forecast = forecast_data.get("runway_forecast", {})
        runway_points = runway_forecast.get("forecast", [])
        last_runway = runway_points[-1]["value"] if runway_points else 0
        runway_trend = runway_forecast.get("trend_direction", "stable")

        system_prompt = (
            "You are the Forecast Agent of FinSight AI. You interpret time-series metrics projections and write brief future runway/revenue outlook summaries.\n"
            "Respond ONLY with a JSON object in this format:\n"
            "{\n"
            "  \"thoughts\": [\"projection thought 1\", \"projection thought 2\"],\n"
            "  \"conclusion\": \"1-sentence statistical projection brief.\"\n"
            "}"
        )
        
        user_prompt = (
            f"Forecasting Engine Metrics:\n"
            f"- Revenue Trend Direction: {trend}\n"
            f"- Revenue Model Confidence: {confidence}%\n"
            f"- 12-Month Projected Runway: {last_runway:.1f} months\n"
            f"- Runway Trend Direction: {runway_trend}"
        )

        logger.info("ForecastAgent running analysis...")
        result = await _query_ollama_agent(system_prompt, user_prompt)
        
        if result:
            thoughts = result["thoughts"]
            conclusion = result["conclusion"]
            for thought in thoughts:
                if emit_fn:
                    await emit_fn(self.NAME, "projecting", thought)
                await asyncio.sleep(0.4)
            return AgentResult(self.NAME, thoughts, conclusion)

        # Fallback to rule-based generation
        logger.info("ForecastAgent falling back to rule-based heuristics...")
        thoughts = []

        t1 = f"Revenue trend: {trend} (confidence: {confidence}%)"
        thoughts.append(t1)
        if emit_fn:
            await emit_fn(self.NAME, "projecting", t1)
        await asyncio.sleep(0.4)

        if runway_points:
            t2 = f"12-month runway projection: {last_runway:.1f} months"
            thoughts.append(t2)
            if emit_fn:
                await emit_fn(self.NAME, "calculating", t2)
            await asyncio.sleep(0.3)

        conclusion = f"Revenue is {trend}. Forecast confidence: {confidence}%. Monitor monthly for deviations."
        return AgentResult(self.NAME, thoughts, conclusion)


class RecommendationAgent:
    """Generates actionable cost optimization and growth strategies."""

    NAME = "RecommendationAgent"

    async def analyze(self, metrics: dict, risks: AgentResult, emit_fn: Optional[Callable] = None) -> AgentResult:
        cat_str = format_category_breakdown(metrics.get("category_breakdown", []))
        
        system_prompt = (
            "You are the Recommendation Agent of FinSight AI. You formulate actionable cost optimization and cash extensions.\n"
            "Respond ONLY with a JSON object in this format:\n"
            "{\n"
            "  \"thoughts\": [\"strategy formulation step 1\", \"strategy formulation step 2\"],\n"
            "  \"conclusion\": \"1-sentence summary of primary recommended actions.\"\n"
            "}"
        )
        
        user_prompt = (
            f"Metrics for Optimization:\n"
            f"- Monthly Recurring Revenue (MRR): ₹{metrics.get('current_mrr', 0):,.0f}\n"
            f"- Monthly Burn Rate: ₹{metrics.get('monthly_burn_rate', 0):,.0f}\n"
            f"- Cash Runway: {metrics.get('runway_months', 0):.1f} months\n"
            f"- Health Score: {metrics.get('health_score', 0)}/100\n\n"
            f"Top Outflow Categories:\n{cat_str}\n\n"
            f"Identified Risk Summary:\n\"{risks.conclusion}\""
        )

        logger.info("RecommendationAgent running analysis...")
        result = await _query_ollama_agent(system_prompt, user_prompt)
        
        if result:
            thoughts = result["thoughts"]
            conclusion = result["conclusion"]
            for thought in thoughts:
                if emit_fn:
                    await emit_fn(self.NAME, "optimizing", thought)
                await asyncio.sleep(0.4)
            return AgentResult(self.NAME, thoughts, conclusion)

        # Fallback to rule-based generation
        logger.info("RecommendationAgent falling back to rule-based heuristics...")
        thoughts = []
        recs = []

        t1 = "Scanning expense categories for optimization opportunities..."
        thoughts.append(t1)
        if emit_fn:
            await emit_fn(self.NAME, "optimizing", t1)
        await asyncio.sleep(0.4)

        categories = metrics.get("category_breakdown", [])
        for cat in categories:
            if cat["category"] in ["SaaS", "Marketing", "Travel"]:
                savings = cat["total"] * 0.15
                rec = f"Optimize {cat['category']} spending: potential savings of ₹{savings:,.0f}/month"
                recs.append(rec)
                thoughts.append(rec)
                if emit_fn:
                    await emit_fn(self.NAME, "recommending", rec)
                await asyncio.sleep(0.2)

        if metrics.get("runway_months", 0) < 9:
            rec = "Prioritize revenue acceleration: consider pricing optimization or new revenue channels"
            recs.append(rec)
            thoughts.append(rec)

        conclusion = f"Generated {len(recs)} actionable recommendation(s) for financial optimization."
        return AgentResult(self.NAME, thoughts, conclusion)


# ═══════════════════════════════════════════════════════════════════
# ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════

class AgentOrchestrator:
    """
    Coordinates multi-agent analysis pipeline.
    Streams agent thinking steps through an emit callback function.
    """

    def __init__(self):
        self.cfo = CFOAgent()
        self.risk = RiskAgent()
        self.forecast = ForecastAgent()
        self.recommendation = RecommendationAgent()

    def parse_simulation_params(self, query: str) -> Optional[dict]:
        """Parse simulation parameters from the user query using regex."""
        import re
        query_lower = query.lower()
        
        # Check if the query indicates simulation/what-if intent
        keywords = ["simulate", "what if", "hiring", "hire", "marketing", "spend", "pricing", "downturn", "grow", "growth", "cost increase", "overhead"]
        if not any(k in query_lower for k in keywords):
            return None
            
        params = {
            "hiring_count": 0,
            "avg_salary_monthly": 80000,
            "marketing_spend_delta": 0,
            "pricing_multiplier": 1.0,
            "revenue_growth_pct": 0,
            "cost_increase_pct": 0,
            "economic_downturn": False
        }
        
        # 1. Economic downturn
        if "downturn" in query_lower or "recession" in query_lower or "economic crisis" in query_lower:
            params["economic_downturn"] = True
            
        # 2. Hiring count & salary
        # Match "hire 2 people", "hiring 3 employees", "add 1 developer", "hire 5 developers"
        hire_match = re.search(r'(?:hire|hiring|add)\s+(\d+)\s*(?:employee|person|people|staff|developer|engineer|worker|headcount)?', query_lower)
        if hire_match:
            params["hiring_count"] = int(hire_match.group(1))
            
        # Match salary: "salary of 100000" or "paying 100000" or "salary 50000" or "at 80000/month"
        salary_match = re.search(r'(?:salary|pay|paying|cost)\s*(?:of|at)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)(?:\s*(?:k|thousand))?', query_lower)
        if salary_match:
            val_str = salary_match.group(1).replace(",", "")
            try:
                val = int(val_str)
                # If they said "100k", convert to 100000
                if "k" in salary_match.group(0).lower() or "thousand" in salary_match.group(0).lower():
                    val *= 1000
                params["avg_salary_monthly"] = val
            except ValueError:
                pass
                
        # 3. Marketing Spend Delta
        # Match "spend 50000 on marketing" or "marketing by 20k" or "marketing spend by 50000" or "increase marketing by 50000"
        mktg_match = re.search(r'(?:marketing|ads|ad spend|spend)\s*(?:by|of|up to|increase|decrease|more|less)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)(?:\s*(?:k|thousand))?', query_lower)
        if mktg_match:
            # Avoid matching salary if it was already matched
            mktg_str = mktg_match.group(1).replace(",", "")
            try:
                val = int(mktg_str)
                if "k" in mktg_match.group(0).lower() or "thousand" in mktg_match.group(0).lower():
                    val *= 1000
                
                # Check if this isn't the salary value
                is_salary_val = salary_match and str(val) in salary_match.group(0)
                if not is_salary_val:
                    if "reduce" in query_lower or "decrease" in query_lower or "less" in query_lower or "cut" in query_lower:
                        params["marketing_spend_delta"] = -val
                    else:
                        params["marketing_spend_delta"] = val
            except ValueError:
                pass
                
        # 4. Pricing Multiplier
        # Match "increase price by 10%" or "price multiplier of 1.2"
        price_pct_match = re.search(r'(?:price|pricing)\s*(?:increase|decrease|by|up|down)?\s*(\d+)%', query_lower)
        if price_pct_match:
            pct = int(price_pct_match.group(1))
            if "decrease" in query_lower or "down" in query_lower or "cut" in query_lower:
                params["pricing_multiplier"] = round(1.0 - (pct / 100.0), 2)
            else:
                params["pricing_multiplier"] = round(1.0 + (pct / 100.0), 2)
        else:
            price_mult_match = re.search(r'(?:price|pricing)\s*(?:multiplier|factor)?\s*(?:of)?\s*([\d\.]+)', query_lower)
            if price_mult_match:
                try:
                    params["pricing_multiplier"] = float(price_mult_match.group(1))
                except ValueError:
                    pass
                
        # 5. Revenue Growth
        # Match "revenue growth of 15%" or "revenue grow by 20%"
        growth_match = re.search(r'(?:revenue|growth|grow)\s*(?:by|of|up)?\s*(\d+)%', query_lower)
        if growth_match and not price_pct_match:
            params["revenue_growth_pct"] = int(growth_match.group(1))
            
        # 6. Cost Overhead Increase
        # Match "costs increase by 10%" or "overhead up by 5%" or "expenses increase by 10%"
        cost_match = re.search(r'(?:cost|costs|overhead|expenses)\s*(?:increase|up|by)?\s*(\d+)%', query_lower)
        if cost_match and not (growth_match or price_pct_match):
            params["cost_increase_pct"] = int(cost_match.group(1))
            
        # Verify if any parameter has been modified from default
        has_changes = (
            params["hiring_count"] > 0 or 
            params["marketing_spend_delta"] != 0 or 
            params["pricing_multiplier"] != 1.0 or 
            params["revenue_growth_pct"] > 0 or 
            params["cost_increase_pct"] > 0 or 
            params["economic_downturn"]
        )
        return params if has_changes else None

    async def full_analysis(
        self,
        metrics: dict,
        forecast_data: dict,
        query: str = "Analyze current financial position",
        emit_fn: Optional[Callable] = None,
    ) -> dict:
        """
        Run the complete multi-agent analysis pipeline.

        Args:
            metrics: Current financial metrics from AnalyticsService
            forecast_data: Forecast results from ForecastingEngine
            query: User question or analysis prompt
            emit_fn: Async callback to emit agent thoughts (for WebSocket streaming)

        Returns:
            Consolidated analysis results from all agents
        """
        if emit_fn:
            await emit_fn("Orchestrator", "initializing", "Starting multi-agent financial analysis pipeline...")
            await asyncio.sleep(0.3)

        # Parse simulation intent
        sim_params = self.parse_simulation_params(query)
        simulation_result = None
        system_action = None

        if sim_params:
            from app.services.simulator import SimulatorEngine
            sim_engine = SimulatorEngine()
            # Inject company_id if available
            sim_params["company_id"] = metrics.get("company_id", "")
            simulation_result = sim_engine.simulate(metrics, sim_params)
            system_action = {"type": "simulator", "params": sim_params}
            
            # Enrich context for agents by appending simulation results to query
            query = (
                f"{query} [System Note: The user wants to simulate a scenario. "
                f"We have computed the simulation results: "
                f"New Runway: {simulation_result['runway']['simulated']:.1f} months (change of {simulation_result['runway']['delta']:.1f} months). "
                f"New Monthly Burn: ₹{simulation_result['burn_rate']['simulated']:,.0f} (change of ₹{simulation_result['burn_rate']['delta']:,.0f}). "
                f"New Health Score: {simulation_result['health_score']['simulated']}/100 (change of {simulation_result['health_score']['delta']}). "
                f"Please analyze these simulated results in your response, evaluate if it is a safe/prudent business move, and give strategic recommendations.]"
            )
        else:
            # Parse other system action intents
            query_lower = query.lower()
            if any(k in query_lower for k in ["risk", "anomaly", "anomalies", "fraud", "spike", "outlier"]):
                system_action = {"type": "risk-radar"}
            elif "board report" in query_lower or "executive brief" in query_lower:
                system_action = {"type": "reports", "subtype": "board"}
            elif any(k in query_lower for k in ["investor report", "investor readiness", "funding readiness", "raise fund", "fundraising"]):
                system_action = {"type": "reports", "subtype": "investor"}
            elif any(k in query_lower for k in ["dashboard", "kpi", "metrics", "financials", "summary", "mrr", "runway"]):
                system_action = {"type": "dashboard"}

        # Run agents in sequence for coherent reasoning chain
        if emit_fn:
            await emit_fn("CFOAgent", "started", "Analyzing current financial position and revenue growth patterns...")
        cfo_result = await self.cfo.analyze(metrics, query, emit_fn)
        if emit_fn:
            await emit_fn("CFOAgent", "completed", "CFO financial analysis complete.")

        if emit_fn:
            await emit_fn("RiskAgent", "started", "Scanning runway constraints, burn rate hikes, and vendor concentration risks...")
        risk_result = await self.risk.analyze(metrics, emit_fn)
        if emit_fn:
            await emit_fn("RiskAgent", "completed", "Risk assessment scan complete.")

        if emit_fn:
            await emit_fn("ForecastAgent", "started", "Projecting time-series trends and future runway outlook...")
        forecast_result = await self.forecast.analyze(forecast_data, emit_fn)
        if emit_fn:
            await emit_fn("ForecastAgent", "completed", "Runway and revenue forecasts complete.")

        if emit_fn:
            await emit_fn("RecommendationAgent", "started", "Formulating cost optimization strategies and pricing adjustments...")
        rec_result = await self.recommendation.analyze(metrics, risk_result, emit_fn)
        if emit_fn:
            await emit_fn("RecommendationAgent", "completed", "Action roadmap and recommendations compiled.")

        if emit_fn:
            await emit_fn("Orchestrator", "synthesizing", "Compiling final analysis from all agents...")
            await asyncio.sleep(0.3)

        return {
            "insight": cfo_result.conclusion,
            "explanation": " ".join(cfo_result.thoughts),
            "business_impact": risk_result.conclusion,
            "recommendation": rec_result.conclusion,
            "confidence_score": 85,
            "supporting_data": [
                {"label": "Health Score", "value": metrics.get("health_score", 0)},
                {"label": "Runway (Months)", "value": metrics.get("runway_months", 0)},
                {"label": "Monthly Burn", "value": metrics.get("monthly_burn_rate", 0)},
                {"label": "MRR", "value": metrics.get("current_mrr", 0)},
            ],
            "agent_logs": {
                "cfo": {"thoughts": cfo_result.thoughts, "conclusion": cfo_result.conclusion},
                "risk": {"thoughts": risk_result.thoughts, "conclusion": risk_result.conclusion},
                "forecast": {"thoughts": forecast_result.thoughts, "conclusion": forecast_result.conclusion},
                "recommendation": {"thoughts": rec_result.thoughts, "conclusion": rec_result.conclusion},
            },
            "system_action": system_action,
            "simulation_result": simulation_result,
        }

