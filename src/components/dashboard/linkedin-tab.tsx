"use client";

export function LinkedInJobsTab() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 rounded-[32px] border border-dashed border-black/10 bg-white/70 p-10 text-center duration-500">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-blue-50 text-blue-600">
        in
      </div>
      <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight">LinkedIn jobs are coming soon</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-black/55">
        I removed the fake credential-based LinkedIn flow for now. This tab will come back when there is
        a reliable import path, such as saved job URL import or a browser-extension based sync.
      </p>
    </div>
  );
}
