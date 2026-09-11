import React from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export default function SectionCard({
  title,
  description,
  action,
  children,
  collapsible = false,
  defaultOpen = true,
}: SectionCardProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-stone-200 overflow-hidden shadow-2xs transition-all">
      <div
        className={`px-3 sm:px-4 md:px-5 py-2.5 sm:py-3.5 border-b border-stone-100 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 ${
          collapsible ? 'cursor-pointer select-none hover:bg-stone-50' : ''
        }`}
        onClick={collapsible ? () => setIsOpen(!isOpen) : undefined}
      >
        <div className="flex items-start sm:items-center justify-between w-full sm:w-auto">
          <div>
            <h3 className="font-serif text-sm sm:text-base md:text-lg text-stone-900 font-bold tracking-tight">{title}</h3>
            {description && <p className="text-[11px] sm:text-xs md:text-sm text-stone-500 mt-0.5">{description}</p>}
          </div>
          {collapsible && (
            <span className="sm:hidden text-stone-400 p-1">
              <svg
                className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action && <div className="shrink-0">{action}</div>}
          {collapsible && (
            <button
              type="button"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800 bg-white border border-stone-200 px-2.5 py-1 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              <span>{isOpen ? 'Collapse' : 'Expand'}</span>
              <svg
                className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {(!collapsible || isOpen) && (
        <div className="p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4 md:space-y-5 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
