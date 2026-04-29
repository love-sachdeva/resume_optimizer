import type {
  AdaptiveFollowUpQuestion,
  MatchAnalysis,
  QuestionnaireAnswers,
  QuestionnaireQuestion
} from "@/lib/schemas";

export const QUESTION_BANK: QuestionnaireQuestion[] = [
  {
    id: "resume_primary_domain",
    section: "Role targeting",
    label: "Current resume focus",
    prompt: "Which domain is your current resume strongest for?",
    type: "select",
    options: ["Product", "Software", "Analytics", "Consulting", "Growth", "Category"],
    placeholder: "Product",
    layout: "half",
    required: true
  },
  {
    id: "target_domain",
    section: "Role targeting",
    label: "Target domain",
    prompt: "Which domain is this application for?",
    type: "select",
    options: ["Product", "Software", "Analytics", "Consulting", "Growth", "Category"],
    placeholder: "Product",
    layout: "half",
    required: true
  },
  {
    id: "target_roles",
    section: "Role targeting",
    label: "Target roles",
    prompt: "Pick the roles you want this resume to target.",
    type: "multiselect",
    options: [],
    placeholder: "Choose one or more roles",
    layout: "half",
    required: true
  },
  {
    id: "preferred_titles",
    section: "Role targeting",
    label: "Top titles",
    prompt: "Choose the titles you most want to be seen for.",
    type: "multiselect",
    options: [],
    placeholder: "Choose title variants",
    layout: "half"
  },
  {
    id: "target_industries",
    section: "Role targeting",
    label: "Industries",
    prompt: "Which industries are you targeting?",
    type: "multiselect",
    options: ["Fintech", "SaaS", "AI", "Consumer", "Ecommerce", "Enterprise", "Healthcare", "Edtech"],
    placeholder: "Select target industries",
    layout: "half"
  },
  {
    id: "target_company_type",
    section: "Role targeting",
    label: "Company type",
    prompt: "What type of company are you targeting?",
    type: "multiselect",
    options: ["MNC", "Startup", "Growth-stage", "Enterprise", "Remote-first"],
    placeholder: "Choose company types",
    layout: "half"
  },
  {
    id: "target_geographies",
    section: "Role targeting",
    label: "Geographies",
    prompt: "Which geographies are you open to?",
    type: "text",
    placeholder: "Bengaluru, Mumbai, Dubai, Remote",
    layout: "half"
  },
  {
    id: "relocation_open",
    section: "Role targeting",
    label: "Relocation",
    prompt: "Are you open to relocation?",
    type: "boolean",
    required: true,
    layout: "half"
  },
  {
    id: "relocation_where",
    section: "Role targeting",
    label: "Relocation where",
    prompt: "If yes, where are you open to relocating?",
    type: "text",
    placeholder: "Bengaluru, Gurgaon, Singapore",
    layout: "half",
    dependsOn: {
      id: "relocation_open",
      values: ["true"]
    }
  },
  {
    id: "exact_titles_by_company",
    section: "Work history",
    label: "Exact titles",
    prompt: "List each company with the exact title you held there.",
    type: "textarea",
    placeholder: "LedgerLoop - Founder's Office Associate; PayAxis - Business Analyst Intern"
  },
  {
    id: "dates_by_company",
    section: "Work history",
    label: "Dates",
    prompt: "List the exact start and end dates for each role.",
    type: "textarea",
    placeholder: "LedgerLoop - Jul 2023 to Present"
  },
  {
    id: "intern_to_full_time",
    section: "Work history",
    label: "Conversion",
    prompt: "Did you transition from intern to full-time anywhere?",
    type: "boolean"
  },
  {
    id: "emphasize_work",
    section: "Work history",
    label: "Emphasize",
    prompt: "Which work should be emphasized most?",
    type: "textarea",
    placeholder: "Merchant onboarding, dashboards, founder-facing execution"
  },
  {
    id: "deemphasize_work",
    section: "Work history",
    label: "De-emphasize",
    prompt: "Which work should be de-emphasized or removed?",
    type: "textarea",
    placeholder: "Routine admin tasks, low-signal campus activities"
  },
  {
    id: "ownership_scope",
    section: "Ownership",
    label: "Ownership scope",
    prompt: "What did you actually own end-to-end?",
    type: "textarea",
    placeholder: "Weekly onboarding experiment rollout and merchant feedback synthesis"
  },
  {
    id: "decision_authority",
    section: "Ownership",
    label: "Decisions",
    prompt: "What decisions did you make yourself?",
    type: "textarea",
    placeholder: "Prioritized bug fixes, chose dashboard metrics, proposed rollout order"
  },
  {
    id: "pm_artifacts",
    section: "Ownership",
    label: "Artifacts",
    prompt: "Did you define roadmap items, PRDs, success metrics, launch plans, or GTM materials?",
    type: "textarea",
    placeholder: "Owned launch checklist, success metrics, and merchant communication draft"
  },
  {
    id: "stakeholder_count",
    section: "Ownership",
    label: "Stakeholders",
    prompt: "How many teams or stakeholders did you coordinate with?",
    type: "text",
    placeholder: "5 teams",
    layout: "half"
  },
  {
    id: "leadership_exposure",
    section: "Ownership",
    label: "Leadership",
    prompt: "Did you work directly with founders or leadership?",
    type: "textarea",
    placeholder: "Weekly review with founder and head of operations"
  },
  {
    id: "problem_solved",
    section: "Project depth",
    label: "Problem",
    prompt: "What problem did each project or role solve?",
    type: "textarea",
    placeholder: "Reduced merchant onboarding drop-off caused by document rejection"
  },
  {
    id: "primary_users",
    section: "Project depth",
    label: "Users",
    prompt: "Who were the users or customers?",
    type: "textarea",
    placeholder: "SME merchants, support agents, internal ops teams"
  },
  {
    id: "problem_discovery",
    section: "Project depth",
    label: "Discovery",
    prompt: "How did you discover the problem?",
    type: "textarea",
    placeholder: "Ticket analysis, merchant calls, support review, dashboard drop-off trends"
  },
  {
    id: "tradeoffs",
    section: "Project depth",
    label: "Trade-offs",
    prompt: "What trade-offs did you make?",
    type: "textarea",
    placeholder: "Faster launch vs deeper automation; compliance rules vs lower friction"
  },
  {
    id: "success_measurement",
    section: "Project depth",
    label: "Success metric",
    prompt: "How was success measured?",
    type: "textarea",
    placeholder: "Activation rate, onboarding TAT, document rejection, conversion"
  },
  {
    id: "gtm_influence",
    section: "Business and GTM",
    label: "GTM influence",
    prompt: "Did you influence pricing, onboarding, sales, merchant conversations, or funnel design?",
    type: "textarea",
    placeholder: "Improved onboarding scripts and merchant FAQs"
  },
  {
    id: "experiments_run",
    section: "Business and GTM",
    label: "Experiments",
    prompt: "Did you run experiments?",
    type: "textarea",
    placeholder: "A/B tested reminder timing and onboarding messaging"
  },
  {
    id: "funnel_metrics",
    section: "Business and GTM",
    label: "Funnel metrics",
    prompt: "Did you improve activation, conversion, or retention?",
    type: "textarea",
    placeholder: "Improved merchant activation from 31% to 39%"
  },
  {
    id: "customer_feedback",
    section: "Business and GTM",
    label: "Feedback",
    prompt: "Did you gather direct customer feedback?",
    type: "textarea",
    placeholder: "Interviewed merchants, synthesized common pain points"
  },
  {
    id: "sops_created",
    section: "Business and GTM",
    label: "Operating systems",
    prompt: "Did you create SOPs, templates, or repeatable systems?",
    type: "textarea",
    placeholder: "Built SOPs for merchant exception handling"
  },
  {
    id: "top_wins",
    section: "Metrics",
    label: "Top wins",
    prompt: "What are your top measurable outcomes?",
    type: "textarea",
    placeholder: "Reduced TAT by 20%, improved conversion by 8 points, automated weekly reporting"
  },
  {
    id: "metrics_safe",
    section: "Metrics",
    label: "Verified metrics",
    prompt: "Which metrics are verified and safe to use on your resume?",
    type: "textarea",
    placeholder: "Activation rate, support turnaround, conversion uplift"
  },
  {
    id: "wins_for_jd",
    section: "Metrics",
    label: "Best wins",
    prompt: "Which wins are most impressive for this job description?",
    type: "textarea",
    placeholder: "Merchant onboarding, SQL dashboards, cross-functional launches"
  },
  {
    id: "recognition",
    section: "Metrics",
    label: "Recognition",
    prompt: "Any awards, ratings, rankings, or recognition?",
    type: "textarea",
    placeholder: "Dean's list, founder shout-out, internship PPO"
  },
  {
    id: "public_proof",
    section: "Metrics",
    label: "Public proof",
    prompt: "Do you have public proof like GitHub, demos, blogs, or LinkedIn posts?",
    type: "textarea",
    placeholder: "GitHub project, Notion case study, public post"
  },
  {
    id: "tools_known",
    section: "Tools",
    label: "Tools",
    prompt: "Which tools do you know well?",
    type: "textarea",
    placeholder: "SQL, Excel, Tableau, Jira, Figma, Power BI",
    layout: "half"
  },
  {
    id: "ai_tools",
    section: "Tools",
    label: "AI tools",
    prompt: "Which AI tools do you actively use?",
    type: "textarea",
    placeholder: "ChatGPT, Claude, Cursor, OpenAI API",
    layout: "half"
  },
  {
    id: "stack_confident",
    section: "Tools",
    label: "Technical depth",
    prompt: "Are you comfortable with APIs, SQL, scripting, or dashboards?",
    type: "textarea",
    placeholder: "Comfortable with SQL, API workflows, dashboards, and basic scripting"
  },
  {
    id: "interview_safe_claims",
    section: "Tools",
    label: "Interview-safe claims",
    prompt: "What can you confidently defend in interviews?",
    type: "textarea",
    placeholder: "SQL analysis, merchant research, launch coordination"
  },
  {
    id: "exclude_items",
    section: "Tools",
    label: "Do not include",
    prompt: "What should definitely not be included?",
    type: "textarea",
    placeholder: "Advanced ML, production backend engineering, revenue ownership"
  },
  {
    id: "positioning_preference",
    section: "Positioning",
    label: "Positioning",
    prompt: "Should the resume feel PM-first, FoS-first, consulting-first, or engineering-first?",
    type: "select",
    options: ["PM-first", "FoS-first", "consulting-first", "engineering-first"],
    placeholder: "PM-first",
    layout: "half"
  },
  {
    id: "resume_length",
    section: "Positioning",
    label: "Length",
    prompt: "Do you prefer one page or two pages?",
    type: "select",
    options: ["one-page", "two-page"],
    placeholder: "one-page",
    layout: "half"
  },
  {
    id: "preserve_format_exactly",
    section: "Positioning",
    label: "Preserve format",
    prompt: "Do you want to preserve the original format exactly when possible?",
    type: "boolean",
    layout: "half"
  },
  {
    id: "rewrite_intensity",
    section: "Positioning",
    label: "Rewrite style",
    prompt: "Do you want a conservative rewrite or aggressive optimization?",
    type: "select",
    options: ["conservative", "balanced", "aggressive"],
    placeholder: "balanced",
    layout: "half"
  },
  {
    id: "cover_note_needed",
    section: "Positioning",
    label: "Cover note",
    prompt: "Do you also want a recruiter note or cover note?",
    type: "boolean",
    layout: "half"
  }
];

function getQuestionById(id: string) {
  return QUESTION_BANK.find((question) => question.id === id);
}

export function buildAdaptiveFollowUpQuestions(
  analysis: MatchAnalysis,
  answers: QuestionnaireAnswers
) {
  const picks: AdaptiveFollowUpQuestion[] = [];
  const seen = new Set<string>();

  const addQuestion = (questionId: string, reason: string) => {
    if (seen.has(questionId)) {
      return;
    }

    const question = getQuestionById(questionId);
    if (!question) {
      return;
    }

    if (answers[questionId]?.trim()) {
      return;
    }

    seen.add(questionId);
    picks.push({
      id: question.id,
      label: question.label,
      prompt: question.prompt,
      type: question.type,
      placeholder: typeof question.placeholder === "string" ? question.placeholder : "",
      options: Array.isArray(question.options) ? question.options : [],
      reason
    });
  };

  if (analysis.breakdown.quantifiedImpact < 65) {
    addQuestion("top_wins", "Verified measurable outcomes can lift the score quickly.");
    addQuestion("metrics_safe", "The resume needs clearer interview-safe metrics.");
  }

  if (analysis.breakdown.title < 55) {
    addQuestion("positioning_preference", "The role fit needs a clearer positioning signal.");
    addQuestion("exact_titles_by_company", "Exact prior titles can improve title alignment.");
  }

  if (analysis.breakdown.semantic < 60) {
    addQuestion("ownership_scope", "The JD asks for deeper ownership and problem-solving evidence.");
    addQuestion("success_measurement", "A stronger success metric story can improve semantic fit.");
  }

  if (analysis.breakdown.hardFilters < 75) {
    addQuestion("target_geographies", "Location or mobility details are missing.");
    addQuestion("relocation_where", "Relocation openness can remove a hard-filter risk.");
  }

  if (analysis.breakdown.keyword < 65) {
    addQuestion("wins_for_jd", "This role needs more direct evidence aligned to the JD.");
    addQuestion("pm_artifacts", "Relevant artifacts can safely surface missing JD language.");
  }

  if (!answers.target_roles?.trim()) {
    addQuestion("target_roles", "Target role choices help the rewrite frame the application better.");
  }

  if (!answers.resume_primary_domain?.trim()) {
    addQuestion(
      "resume_primary_domain",
      "Knowing the base resume domain helps reposition adjacent experience safely."
    );
  }

  return picks.slice(0, 4);
}

export function getQuestionSections() {
  return [...new Set(QUESTION_BANK.map((question) => question.section))];
}
