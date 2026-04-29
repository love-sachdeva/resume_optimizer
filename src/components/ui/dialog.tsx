"use client";

import * as React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const DialogContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function Dialog({ children, open: controlledOpen, onOpenChange }: { 
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("DialogTrigger must be used within a Dialog");

  const handleClick = () => context.setOpen(true);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    });
  }

  return <div onClick={handleClick}>{children}</div>;
}

export function DialogClose({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("DialogClose must be used within a Dialog");

  const handleClick = () => context.setOpen(false);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    });
  }

  return <div onClick={handleClick}>{children}</div>;
}

export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("DialogContent must be used within a Dialog");

  // Prevent scroll when open
  React.useEffect(() => {
    if (context.open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [context.open]);

  return (
    <AnimatePresence>
      {context.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => context.setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full max-w-lg overflow-hidden rounded-[32px] bg-white p-6 shadow-2xl",
              className
            )}
          >
            <button
              onClick={() => context.setOpen(false)}
              className="absolute right-6 top-6 z-20 rounded-full bg-white/80 p-2 text-black/30 shadow-sm transition-colors hover:bg-black/5 hover:text-black"
            >
              <X className="h-5 w-5" />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-col space-y-1.5 text-left">{children}</div>;
}

export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h2>;
}

export function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm text-black/50", className)}>{children}</p>;
}
