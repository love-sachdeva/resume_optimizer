"use client";

import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

type ResumeDiffViewerProps = {
  originalText: string;
  improvedText: string;
};

const diffStyles = {
  variables: {
    light: {
      diffViewerBackground: "hsl(var(--card))",
      diffViewerColor: "hsl(var(--foreground))",
      addedBackground: "hsl(var(--primary) / 0.10)",
      addedColor: "hsl(var(--foreground))",
      removedBackground: "hsl(var(--foreground) / 0.06)",
      removedColor: "hsl(var(--foreground))",
      wordAddedBackground: "hsl(var(--primary) / 0.22)",
      wordRemovedBackground: "hsl(var(--foreground) / 0.14)",
      addedGutterBackground: "hsl(var(--primary) / 0.16)",
      removedGutterBackground: "hsl(var(--foreground) / 0.10)",
      gutterBackground: "hsl(var(--background))",
      gutterColor: "hsl(var(--foreground) / 0.55)",
      codeFoldGutterBackground: "hsl(var(--background))",
      codeFoldBackground: "hsl(var(--background))",
      emptyLineBackground: "hsl(var(--background))",
      highlightBackground: "hsl(var(--primary) / 0.16)",
      highlightGutterBackground: "hsl(var(--primary) / 0.22)"
    }
  },
  diffContainer: {
    border: "2px solid hsl(var(--foreground))",
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: "12px"
  },
  contentText: {
    lineHeight: "1.65",
    wordBreak: "break-word" as const
  },
  line: {
    minHeight: "26px"
  },
  titleBlock: {
    background: "hsl(var(--background))",
    borderBottom: "2px solid hsl(var(--foreground))",
    color: "hsl(var(--foreground))",
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: "11px",
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const
  }
};

export function ResumeDiffViewer({ originalText, improvedText }: ResumeDiffViewerProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px]">
        <ReactDiffViewer
          oldValue={originalText.trim()}
          newValue={improvedText.trim()}
          splitView
          compareMethod={DiffMethod.WORDS}
          showDiffOnly={false}
          extraLinesSurroundingDiff={2}
          leftTitle="Original resume"
          rightTitle="Optimized resume"
          hideSummary
          disableWorker
          styles={diffStyles}
        />
      </div>
    </div>
  );
}
