import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
}

export default function MarkdownContent({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-stone-900 mt-8 mb-4" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-lg font-bold text-stone-900 mt-6 mb-3" {...props} />,
        p: ({node, ...props}) => <p className="mb-4 text-stone-800 leading-relaxed" {...props} />,
        strong: ({node, ...props}) => <strong className="font-bold text-stone-900" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-stone-800" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-stone-800" {...props} />,
        li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
        a: ({node, ...props}) => <a className="text-emerald-700 hover:underline font-medium" {...props} />,
        table: ({node, ...props}) => (
          <div className="overflow-x-auto my-4 border border-stone-200 rounded-xl bg-white shadow-2xs">
            <table className="min-w-full text-sm divide-y divide-stone-200" {...props} />
          </div>
        ),
        th: ({node, ...props}) => <th className="px-4 py-2.5 bg-stone-100/90 text-left text-xs font-bold text-stone-700 uppercase tracking-wider" {...props} />,
        td: ({node, ...props}) => <td className="px-4 py-2.5 text-stone-800 text-sm border-t border-stone-100" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
