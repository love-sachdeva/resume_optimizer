/**
 * Deterministic ATS Scoring Engine
 */

export interface ScoringResult {
  score: number;
  breakdown: {
    formatting: number; // 0-20
    content: number;    // 0-40
    relevance: number;  // 0-40
  };
  details: string[];
}

export function calculateAtsScore(resumeText: string, jobText: string): ScoringResult {
  const resume = resumeText.toLowerCase();
  const job = jobText.toLowerCase();
  
  const details: string[] = [];
  
  // 1. Formatting & Structure (Max 20)
  let formatting = 0;
  if (resume.includes("experience") || resume.includes("work history")) formatting += 5;
  if (resume.includes("education")) formatting += 5;
  if (resume.includes("skills")) formatting += 5;
  if (resume.includes("summary") || resume.includes("profile")) formatting += 5;
  
  if (formatting < 20) details.push("Missing core sections like Education or Skills.");

  // 2. Content Quality (Max 40)
  // Check for metrics (numbers, %, $)
  const metricsCount = (resume.match(/\d+(%|\$|k|m|b|lakh|cr)/g) || []).length;
  let content = Math.min(metricsCount * 5, 40);
  
  if (content < 20) details.push("Quantify your achievements with more metrics (%, $, numbers).");

  // 3. Keyword Relevance (Max 40)
  // Extract keywords from job text (simple approach)
  const jobWords = job.split(/\W+/).filter(w => w.length > 4);
  const uniqueJobWords = Array.from(new Set(jobWords));
  
  let matches = 0;
  uniqueJobWords.forEach(word => {
    if (resume.includes(word)) matches++;
  });
  
  const relevance = uniqueJobWords.length > 0 
    ? Math.min((matches / uniqueJobWords.length) * 100, 40) 
    : 20;

  if (relevance < 25) details.push("Low keyword overlap. Try incorporating more industry-specific terms from the JD.");

  const totalScore = Math.round(formatting + content + relevance);

  return {
    score: totalScore,
    breakdown: { formatting, content, relevance },
    details
  };
}
