"use client";

export function LinkedInJobsTab() {
  return (
    <div className="animate-rise-in border-2 border-dashed border-foreground/20 bg-card p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center border-2 border-foreground text-primary">
        in
      </div>
      <h3 className="display mt-5 text-2xl font-semibold tracking-tight">LinkedIn jobs are coming soon</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-foreground/60">
        I removed the fake credential-based LinkedIn flow for now. This tab will come back when there is
        a reliable import path, such as saved job URL import or a browser-extension based sync.
      </p>
    </div>
  );
}
