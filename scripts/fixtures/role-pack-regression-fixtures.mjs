export const rolePackRegressionFixtures = [
  {
    name: "Stashfin Lending PM",
    expectedRolePack: "fintech-lending-pm",
    job: `Product Manager
Stashfin

Responsibilities
- Own digital lending journeys across onboarding, KYC, underwriting, repayment and collections.
- Define PRDs, roadmaps, prioritization and product metrics for credit-line customer workflows.
- Partner with risk, compliance, analytics and engineering teams to improve portfolio quality.`
  },
  {
    name: "Goldman Strats",
    expectedRolePack: "finance-strats",
    job: `Private Finance Strats
Goldman Sachs

Responsibilities
- Build analytics, forecasting and optimization workflows for private finance portfolios.
- Partner with engineering and investing teams on risk controls, portfolio analytics and business metrics.
- Translate financial models and operating data into leadership-ready insights.`
  },
  {
    name: "IDFC Operations Transformation",
    expectedRolePack: "ops-transformation",
    job: `Operations Transformation Associate
IDFC FIRST Bank

Responsibilities
- Map current processes and design end-state workflows for banking operations.
- Drive change management, SOPs, risk controls and impact metrics with business units.
- Partner with technology teams to deliver digital transformation initiatives.`
  },
  {
    name: "Gushwork Chief of Staff",
    expectedRolePack: "chief-of-staff",
    job: `Chief of Staff - Founder's Office
Gushwork

Responsibilities
- Own BizOps, OKRs, operating cadence, board decks and investor updates.
- Build executive dashboards for ARR growth, B2B SaaS delivery and AI-led growth.
- Coordinate hiring ops, strategic projects and cross-functional governance.`
  }
];

export const genericKeywordRegressionFixtures = [
  {
    name: "Generic Customer Success",
    expectedRolePack: "general",
    expectedKeywordSignals: ["customer", "support"],
    job: `Customer Success Associate
HarborDesk

Responsibilities
- Support onboarding, renewal conversations and account health tracking for small business customers.
- Resolve product questions, document recurring issues and coordinate with support teams.
- Analyze customer feedback to improve help-center content and response quality.`
  }
];

export const universalBlueprintRegressionFixtures = [
  {
    name: "Applied AI Engineer",
    expectedArchetype: "applied-ai-engineering",
    expectedSignals: ["AI", "Python", "API"],
    job: `Applied AI Engineer
Build production AI features using LLMs, RAG workflows, model evaluation, Python APIs and deployment.
Partner with product teams to run experiments, improve answer quality and monitor latency, accuracy and reliability.`
  },
  {
    name: "People Ops HR",
    expectedArchetype: "people-hr",
    expectedSignals: ["Onboarding", "Stakeholder Management"],
    job: `People Operations Associate
Own HR operations, employee onboarding, engagement surveys, talent coordination and stakeholder management.
Track time to hire, employee engagement and onboarding completion through clean HRIS workflows.`
  },
  {
    name: "Founder Office Generalist",
    expectedArchetype: "founders-office",
    expectedSignals: ["Business Metrics", "Operating Cadence"],
    job: `Founder’s Office Generalist
Support founders on OKRs, operating cadence, leadership reviews, business metrics and cross-functional execution.
Build executive dashboards, unblock strategic projects and coordinate owners across growth, product and ops.`
  },
  {
    name: "Finance FP&A",
    expectedArchetype: "finance-fpa",
    expectedSignals: ["Forecasting", "ROI"],
    job: `FP&A Analyst
Build financial models, forecasts, variance analysis and budget dashboards for leadership.
Track P&L, ROI, margin movement and operating metrics across business lines.`
  },
  {
    name: "Data Analyst",
    expectedArchetype: "data-analytics",
    expectedSignals: ["SQL", "Dashboarding", "KPI Tracking"],
    job: `Data Analyst
Use SQL, dashboards and KPI tracking to analyze cohorts, funnels and data quality.
Build executive reporting and translate business questions into actionable insights.`
  },
  {
    name: "Marketing Growth",
    expectedArchetype: "marketing-growth",
    expectedSignals: ["Conversion Funnel", "ROAS"],
    job: `Growth Marketing Associate
Own campaigns, conversion funnel analysis, lifecycle marketing, SEO experiments and performance marketing.
Improve ROAS, CTR, activation and retention through channel testing and creative iteration.`
  },
  {
    name: "Operations Program Manager",
    expectedArchetype: "operations-program",
    expectedSignals: ["Program Management", "Launch Execution"],
    job: `Operations Program Manager
Drive launch execution, SOPs, risk management and stakeholder management across multiple workstreams.
Track KPIs, surface blockers and improve operating cadence for cross-functional teams.`
  }
];
