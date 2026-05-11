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
    <div className="space-y-6 animate-rise-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="display text-2xl font-semibold tracking-tight">My Resumes</h3>
          <p className="text-sm text-foreground/60">Manage your resume versions and templates.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Upload New
        </Button>
      </div>

      {resumes.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-foreground/20 bg-card py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center border-2 border-foreground/30 text-primary">
             <FileText className="h-8 w-8" />
          </div>
          <div>
             <h3 className="font-semibold text-lg">No resumes saved yet</h3>
             <p className="text-sm text-foreground/50">Upload a resume in the Analyze tab to save it here.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <div key={resume.id} className="group relative border-2 border-foreground bg-card p-6 transition-all hover:-translate-y-0.5 hover:bg-primary/10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex h-12 w-12 items-center justify-center border-2 border-foreground text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <Badge className="h-6 border-primary bg-primary/10 text-primary">{resume.domain}</Badge>
              </div>
              <h4 className="display mb-1 truncate text-xl font-bold text-foreground">{resume.label}</h4>
              <p className="mono mb-6 text-sm text-foreground/45">{new Date(resume.updatedAt).toLocaleDateString()}</p>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="flex-1">View Details</Button>
                <Button 
                  variant="ghost" 
                  size="md" 
                  className="flex h-10 w-10 items-center justify-center p-0 text-primary hover:bg-primary/10"
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
