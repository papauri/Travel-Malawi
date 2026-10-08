import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({ currentPage, totalPages, onPageChange, className }: Props) {
  if (totalPages <= 1) return null;

  // Smart windowing algorithm to keep max 7 items (never overflow horizontally)
  const getPageItems = (): (number | 'ellipsis-left' | 'ellipsis-right')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis-right', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, 'ellipsis-left', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages];
  };

  const pageItems = getPageItems();

  return (
    <nav 
      aria-label="Pagination"
      className={className ?? "flex items-center justify-center gap-1.5 my-6"}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 px-2 sm:px-2.5 rounded-lg border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-medium transition cursor-pointer shadow-2xs flex items-center gap-1 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>
        
        <div className="flex items-center gap-1">
          {pageItems.map((item, idx) => {
            if (typeof item === 'string') {
              return (
                <span 
                  key={`ellipsis-${item}-${idx}`} 
                  className="w-6 text-center text-xs text-stone-400 select-none"
                >
                  …
                </span>
              );
            }

            const isCurrent = currentPage === item;
            return (
              <button
                type="button"
                key={`page-btn-${item}`}
                onClick={() => onPageChange(item)}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isCurrent
                    ? 'bg-stone-900 text-white font-semibold shadow-2xs'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {item}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 px-2 sm:px-2.5 rounded-lg border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-medium transition cursor-pointer shadow-2xs flex items-center gap-1 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
