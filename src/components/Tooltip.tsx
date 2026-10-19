import React, { useId, useState } from 'react';
import { Info } from 'lucide-react';

export default function Tooltip({ text, children }: { text: React.ReactNode, children?: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const tipId = useId();

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') setShow(false); }}
    >
      {children || (
        <button
          type="button"
          aria-label="More information"
          aria-describedby={show ? tipId : undefined}
          onClick={() => setShow(s => !s)}
          className="rounded-full cursor-help focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
        >
          <Info className="w-4 h-4 text-stone-400 hover:text-stone-600" />
        </button>
      )}
      {show && (
        <div
          id={tipId}
          role="tooltip"
          className="absolute z-50 w-64 max-w-[calc(100vw-3rem)] p-3 text-sm font-normal text-white bg-stone-900 rounded-lg shadow-sm -top-2 left-full ml-3 pointer-events-none"
        >
          <div className="absolute w-2 h-2 bg-stone-900 rotate-45 -left-1 top-3"></div>
          {text}
        </div>
      )}
    </div>
  );
}
