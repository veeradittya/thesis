"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

// Recreated from Aceternity UI's "sidebar" (MIT): a collapsible icon rail that expands
// on hover to reveal labels, plus a mobile drawer. Themed to our tokens.

interface SidebarContextProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a <Sidebar>");
  return ctx;
}

export function Sidebar({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: ReactNode;
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  animate?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;
  return <SidebarContext.Provider value={{ open, setOpen, animate }}>{children}</SidebarContext.Provider>;
}

export function SidebarBody({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <>
      <DesktopSidebar className={className}>{children}</DesktopSidebar>
      <MobileSidebar>{children}</MobileSidebar>
    </>
  );
}

function DesktopSidebar({ className, children }: { className?: string; children: ReactNode }) {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "hidden h-full w-[300px] shrink-0 flex-col bg-panel px-4 py-4 md:flex",
        className,
      )}
      animate={{ width: animate ? (open ? 300 : 60) : 300 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
    </motion.div>
  );
}

function MobileSidebar({ children }: { children: ReactNode }) {
  const { open, setOpen } = useSidebar();
  return (
    <div className="flex h-12 w-full flex-row items-center justify-between border-b border-border bg-panel px-4 md:hidden">
      <button onClick={() => setOpen(!open)} aria-label="Open menu" className="text-text">
        <MenuIcon />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col bg-bg p-8"
          >
            <button onClick={() => setOpen(!open)} aria-label="Close menu" className="absolute right-7 top-7 text-text">
              <CloseIcon />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface SidebarLinkItem {
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
}

export function SidebarLink({
  link,
  active,
  className,
}: {
  link: SidebarLinkItem;
  active?: boolean;
  className?: string;
}) {
  const { open, animate } = useSidebar();
  const inner = (
    <>
      <span className={cn("flex shrink-0 items-center justify-center", active ? "text-crimson" : "text-text-muted")}>
        {link.icon}
      </span>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className={cn(
          "!m-0 inline-block whitespace-pre !p-0 text-[13px] transition duration-150 group-hover/sb:translate-x-1",
          active ? "text-accent" : "text-text-muted group-hover/sb:text-text",
        )}
      >
        {link.label}
      </motion.span>
    </>
  );
  const cls = cn("group/sb flex items-center justify-start gap-2 py-2", className);
  if (link.onClick) {
    return (
      <button onClick={link.onClick} className={cn(cls, "w-full text-left")}>
        {inner}
      </button>
    );
  }
  return (
    <a href={link.href} className={cls}>
      {inner}
    </a>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
