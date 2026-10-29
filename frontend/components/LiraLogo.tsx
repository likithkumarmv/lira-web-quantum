import React from "react";

export default function LiraLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-label="LIRA-Q Sentinel Logo"
    >
      <rect width="32" height="32" rx="4" fill="currentColor" className="text-[#0B1420] dark:text-[#111F2E]" />
      <path
        d="M7 9 L7 23 L15 23"
        stroke="currentColor"
        className="text-[#067A9B] dark:text-[#39C9DF]"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="21"
        cy="15"
        r="5.5"
        stroke="currentColor"
        className="text-[#067A9B] dark:text-[#39C9DF]"
        strokeWidth="2.2"
      />
      <path
        d="M24 18.5 L27 22.5"
        stroke="currentColor"
        className="text-[#067A9B] dark:text-[#39C9DF]"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

