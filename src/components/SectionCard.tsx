import React from 'react';
import { ChevronDown } from 'lucide-react';

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
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden min-w-0">
      <div
        className={`px-4 sm:px-5 py-3 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 min-w-0 ${
          collapsible ? 'cursor-pointer select-none hover:bg-stone-50' : ''
        }`}
        onClick={collapsible ? () => setIsOpen(!isOpen) : undefined}
      >
        <div className="flex items-start sm:items-center justify-between w-full sm:w-auto min-w-0">
          <div className="min-w-0">
            <h3 className="font-serif text-base sm:text-lg text-stone-900 font-semibold">{title}</h3>
            {description && <p className="tm-muted mt-0.5">{description}</p>}
          </div>
          {collapsible && (
            <span className="sm:hidden text-stone-400 p-1">
              <ChevronDown className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </span>
          )}
        </div>
        <div className="tm-actions min-w-0">
          {action && <div className="min-w-0 max-w-full">{action}</div>}
          {collapsible && (
            <button
              type="button"
              className="hidden sm:inline-flex tm-btn tm-btn-quiet tm-btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              <span>{isOpen ? 'Hide' : 'Show'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
      {(!collapsible || isOpen) && (
        <div className="p-4 sm:p-5 space-y-4 min-w-0">
          {children}
        </div>
      )}
    </div>
  );
}
