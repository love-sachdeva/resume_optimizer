"use client";

import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { listSavedResumes, deleteSavedResume, type SavedResume } from "@/lib/resume-library";

export function ResumesTab() {
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setResumes(listSavedResumes());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight">My Resumes</h3>
          <p className="text-sm text-black/50">Manage your resume versions and templates.</p>
        </div>
        <Button className="rounded-full shadow-soft bg-ink text-bone hover:bg-black">
          <Plus className="mr-2 h-4 w-4" />
          Upload New
        </Button>
      </div>

      {resumes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-black/5 rounded-[40px] text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-black/5 flex items-center justify-center text-black/20">
             <FileText className="h-8 w-8" />
          </div>
          <div>
             <h3 className="font-semibold text-lg">No resumes saved yet</h3>
             <p className="text-sm text-black/40">Upload a resume in the Analyze tab to save it here.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <div key={resume.id} className="group relative rounded-[32px] border border-black/5 bg-white p-6 transition-all hover:shadow-xl">
              <div className="flex items-start justify-between mb-6">
                <div className="h-12 w-12 rounded-2xl bg-ink/5 flex items-center justify-center text-ink">
                  <FileText className="h-6 w-6" />
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 rounded-full h-6">{resume.domain}</Badge>
              </div>
              <h4 className="font-display text-xl font-bold text-ink truncate mb-1">{resume.label}</h4>
              <p className="text-sm text-black/40 mb-6">{new Date(resume.updatedAt).toLocaleDateString()}</p>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="rounded-full flex-1">View Details</Button>
                <Button 
                  variant="ghost" 
                  size="md" 
                  className="h-10 w-10 p-0 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
                  onClick={() => deleteSavedResume(resume.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
