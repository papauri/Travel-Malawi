import React, { useState } from 'react';
import { Info } from 'lucide-react';

export default function Tooltip({ text, children }: { text: React.ReactNode, children?: React.ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <div 
      className="relative flex items-center" 
      onMouseEnter={() => setShow(true)} 
      onMouseLeave={() => setShow(false)}
    >
      {children || <Info className="w-4 h-4 text-stone-400 hover:text-stone-600 cursor-help" />}
      {show && (
        <div className="absolute z-50 w-64 p-3 text-sm font-normal text-white bg-stone-900 rounded-lg shadow-lg -top-2 left-full ml-3 pointer-events-none">
          <div className="absolute w-2 h-2 bg-stone-900 rotate-45 -left-1 top-3"></div>
          {text}
        </div>
      )}
    </div>
  );
}
