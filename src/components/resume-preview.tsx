"use client";

import type { GeneratedResume, ResumeProfile } from "@/lib/schemas";

type ResumePreviewProps = {
  identity: ResumeProfile["identity"];
  generated: GeneratedResume;
  diffMode?: boolean;
};

/**
 * A4-proportional resume preview that matches the pm_resume.docx layout:
 * - Centered name + contact line
 * - Yellow-highlighted section headers
 * - Three-column layout: date | content | location
 * - Bullet points indented under the center column
 * - Times New Roman / serif font throughout
 */
export function ResumePreview({ identity, generated, diffMode }: ResumePreviewProps) {
  const contactParts = [identity.email, identity.phone, identity.linkedin]
    .filter(Boolean);

  return (
    <div className="resume-page-wrapper">
      <div className="resume-page">
        {/* ── Name ──────────────────────────────────── */}
        <div className="resume-name">{identity.name?.toUpperCase()}</div>

        {/* ── Contact ───────────────────────────────── */}
        {contactParts.length > 0 && (
          <div className="resume-contact">
            {contactParts.join(" | ")}
          </div>
        )}

        {/* ── Education ─────────────────────────────── */}
        {generated.education.length > 0 && (
          <section className="resume-section">
            <div className="resume-section-header">Education</div>
            {generated.education.map((edu) => (
              <div key={`${edu.institution}-${edu.degree}`} className="resume-entry">
                <div className="resume-three-col">
                  <span className="resume-col-left">
                    {[edu.startDate, edu.endDate].filter(Boolean).join(" – ")}
                  </span>
                  <span className="resume-col-center font-bold">
                    {edu.institution?.toUpperCase()}
                  </span>
                  <span className="resume-col-right">{edu.field}</span>
                </div>
                {edu.degree && (
                  <div className="resume-sub-detail">{edu.degree}</div>
                )}
                {edu.details.length > 0 &&
                  edu.details.map((detail, i) => (
                    <div key={`edu-detail-${i}`} className="resume-bullet">{detail}</div>
                  ))}
              </div>
            ))}
          </section>
        )}

        {/* ── Experience ────────────────────────────── */}
        {generated.experiences.length > 0 && (
          <section className="resume-section">
            <div className="resume-section-header">Experience</div>
            {generated.experiences.map((exp) => (
              <div key={`${exp.company}-${exp.title}`} className="resume-entry">
                <div className="resume-three-col">
                  <span className="resume-col-left">
                    {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
                  </span>
                  <span className="resume-col-center font-bold">
                    {exp.company?.toUpperCase()}
                  </span>
                  <span className="resume-col-right">{exp.location}</span>
                </div>
                {exp.title && (
                  <div className="resume-sub-detail resume-role-title">{exp.title}</div>
                )}
                {exp.bullets.map((bullet, i) => {
                  const diffEntry = diffMode
                    ? generated.lineDiffs.find(
                        (d) =>
                          d.section === `${exp.company} - ${exp.title}` &&
                          d.improved === bullet &&
                          d.original !== d.improved
                      )
                    : undefined;

                  return (
                    <div
                      key={`${exp.company}-bullet-${i}`}
                      className={`resume-bullet ${diffEntry ? "resume-line-changed" : ""}`}
                    >
                      {bullet}
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        )}

        {/* ── Projects / Achievements ───────────────── */}
        {generated.projects.length > 0 && (
          <section className="resume-section">
            <div className="resume-section-header">Achievements</div>
            {generated.projects.map((project) => (
              <div key={project.name} className="resume-entry">
                {project.bullets.length > 0
                  ? project.bullets.map((bullet, i) => (
                      <div key={`${project.name}-bullet-${i}`} className="resume-bullet">
                        {bullet}
                      </div>
                    ))
                  : (
                    <div className="resume-sub-detail">{project.description || project.name}</div>
                  )}
              </div>
            ))}
          </section>
        )}

        {/* ── Certifications ───────────────────────── */}
        {generated.certifications.length > 0 && (
          <section className="resume-section">
            <div className="resume-section-header">Certifications</div>
            {generated.certifications.map((cert, i) => (
              <div key={`cert-${i}`} className="resume-bullet">{cert}</div>
            ))}
          </section>
        )}

        {/* ── Skills ────────────────────────────────── */}
        {generated.skills.length > 0 && (
          <section className="resume-section">
            <div className="resume-section-header">Skills</div>
            <div className="resume-skills-row">
              <span className="resume-skills-label">Technical Skills :</span>
              <span className="resume-skills-list">
                {generated.skills
                  .filter((_, i) => i < Math.ceil(generated.skills.length / 2))
                  .join(", ")}
              </span>
            </div>
            <div className="resume-skills-row">
              <span className="resume-skills-label">Business Skills :</span>
              <span className="resume-skills-list">
                {generated.skills
                  .filter((_, i) => i >= Math.ceil(generated.skills.length / 2))
                  .join(", ")}
              </span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
