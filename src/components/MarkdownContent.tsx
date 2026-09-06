import React from 'react';
import ReactMarkdown from 'react-markdown';

interface Props {
  content: string;
}

export default function MarkdownContent({ content }: Props) {
  return (
    <ReactMarkdown
      components={{
        h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-stone-900 mt-8 mb-4" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-xl font-bold text-stone-900 mt-8 mb-4" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-lg font-bold text-stone-900 mt-6 mb-3" {...props} />,
        p: ({node, ...props}) => <p className="mb-4" {...props} />,
        strong: ({node, ...props}) => <strong className="font-bold text-stone-900" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2" {...props} />,
        li: ({node, ...props}) => <li {...props} />,
        a: ({node, ...props}) => <a className="text-emerald-600 hover:underline" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
