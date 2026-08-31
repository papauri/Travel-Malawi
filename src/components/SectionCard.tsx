import React from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-100 bg-stone-50/50">
        <h3 className="font-serif text-lg text-stone-900">{title}</h3>
        {description && <p className="text-sm text-stone-500 mt-1">{description}</p>}
      </div>
      <div className="p-4 sm:p-6 space-y-6">
        {children}
      </div>
    </div>
  );
}
