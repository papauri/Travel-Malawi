import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Copy, Check, Printer, RefreshCw, 
  Search, BookOpen, ShieldCheck, ExternalLink,
  Layers, Compass, Target, ArrowRight, Eye, Code2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminDocMeta, markdownToReadableText } from '../lib/docUtils';

interface AdminDocResponse {
  doc: AdminDocMeta;
  content: string;
  format: 'text' | 'md';
  filename: string;
}

export default function AdminDocsHub() {
  const [docs, setDocs] = useState<AdminDocMeta[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('marketing-presentation');
  const [activeFormat, setActiveFormat] = useState<'text' | 'formatted' | 'md'>('text');
  const [docData, setDocData] = useState<Record<string, { rawMd: string; plainText: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch documents metadata
  const fetchDocsList = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/docs');
      if (res.ok) {
        const data = await res.json();
        if (data.docs && data.docs.length > 0) {
          setDocs(data.docs);
          if (!selectedDocId) {
            setSelectedDocId(data.docs[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching admin docs list:', err);
      toast.error('Failed to load documentation library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocsList();
  }, []);

  // Fetch document content when selectedDocId changes
  useEffect(() => {
    if (!selectedDocId) return;

    if (docData[selectedDocId]) {
      return; // Already cached
    }

    const fetchDocContent = async () => {
      try {
        // Fetch raw markdown
        const mdRes = await fetch(`/api/admin/docs/${selectedDocId}?format=md`);
        let rawMd = '';
        if (mdRes.ok) {
          const data = await mdRes.json();
          rawMd = data.content || '';
        }

        // Convert or fetch readable text
        const plainText = markdownToReadableText(rawMd);

        setDocData(prev => ({
          ...prev,
          [selectedDocId]: { rawMd, plainText }
        }));
      } catch (err) {
        console.error('Error fetching doc content:', err);
        toast.error('Failed to load document content');
      }
    };

    fetchDocContent();
  }, [selectedDocId, docData]);

  const currentDoc = docs.find(d => d.id === selectedDocId) || docs[0];
  const currentContent = docData[selectedDocId] || { rawMd: '', plainText: '' };

  const handleCopy = () => {
    const textToCopy = activeFormat === 'md' ? currentContent.rawMd : currentContent.plainText;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success(activeFormat === 'md' ? 'Markdown copied to clipboard!' : 'Readable plain text copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = (format: 'text' | 'md') => {
    if (!currentDoc) return;
    const url = `/api/admin/docs/${currentDoc.id}?format=${format}&download=1`;
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'text' 
      ? currentDoc.filename.replace(/\.md$/, '.txt')
      : currentDoc.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloading ${format === 'text' ? 'Readable Text (.txt)' : 'Markdown (.md)'}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredDocs = docs.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-stone-900 text-white rounded-2xl p-5 sm:p-7 relative overflow-hidden shadow-2xs border border-stone-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-stone-800 text-stone-200 text-xs font-semibold uppercase tracking-wider border border-stone-700">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Restricted &bull; Global Admin Only</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
              Executive Documentation &amp; Strategy Hub
            </h2>
            <p className="text-stone-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Confidential internal strategic playbooks, operational guides, and host acquisition frameworks. Available in clean readable text format (.txt) or markdown, protected from public exposure.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleDownload('text')}
              disabled={!currentContent.plainText}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Download as clean, universally readable text file (.txt)"
            >
              <Download className="w-4 h-4" />
              <span>Download .TXT</span>
            </button>
            <button
              onClick={() => handleDownload('md')}
              disabled={!currentContent.rawMd}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 transition cursor-pointer disabled:opacity-50"
              title="Download raw markdown document (.md)"
            >
              <FileText className="w-4 h-4" />
              <span>Download .MD</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Document Selection List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search strategic docs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-stone-900 transition"
            />
          </div>

          <div className="space-y-2">
            {filteredDocs.map((doc, dIdx) => {
              const isSelected = doc.id === selectedDocId;
              return (
                <button
                  key={`${doc.id || 'doc'}-${dIdx}`}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition text-left cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-stone-900/10'
                      : 'bg-white text-stone-800 border-stone-200 hover:border-stone-300 hover:bg-stone-50/70'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isSelected 
                          ? 'bg-stone-800 text-emerald-400' 
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        {doc.category}
                      </span>
                      <span className={`text-[11px] font-mono ${isSelected ? 'text-stone-400' : 'text-stone-400'}`}>
                        ~{doc.estimatedReadMinutes}m read
                      </span>
                    </div>
                    <h3 className={`font-serif font-bold text-sm leading-snug ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                      {doc.title}
                    </h3>
                    <p className={`text-xs mt-1.5 line-clamp-2 leading-relaxed ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                      {doc.subtitle}
                    </p>
                  </div>

                  <div className={`pt-2 border-t flex items-center justify-between text-[11px] font-mono ${
                    isSelected ? 'border-stone-800 text-stone-400' : 'border-stone-100 text-stone-400'
                  }`}>
                    <span>{doc.filename.replace(/\.md$/, '.txt')}</span>
                    <span className="font-sans font-medium text-emerald-500 inline-flex items-center gap-1">
                      {isSelected ? 'Viewing' : 'Select'} &rarr;
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Document Viewer & Tools */}
        <div className="lg:col-span-8 bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs flex flex-col min-h-[600px]">
          
          {/* Viewer Toolbar */}
          <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  {currentDoc?.category || 'Document'}
                </span>
                <span className="text-xs font-mono text-stone-400">
                  {currentDoc?.filename}
                </span>
              </div>
              <h3 className="text-lg font-serif font-bold text-stone-900 mt-1">
                {currentDoc?.title}
              </h3>
            </div>

            {/* Controls & Format Switcher */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Format Toggle Pill */}
              <div className="inline-flex p-1 bg-stone-200/80 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveFormat('text')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeFormat === 'text' 
                      ? 'bg-white text-stone-900 shadow-xs' 
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Readable formatted plain text (.txt) mode"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Readable Text (.txt)</span>
                </button>
                <button
                  onClick={() => setActiveFormat('formatted')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeFormat === 'formatted' 
                      ? 'bg-white text-stone-900 shadow-xs' 
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Formatted editorial reader view"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Reader View</span>
                </button>
                <button
                  onClick={() => setActiveFormat('md')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeFormat === 'md' 
                      ? 'bg-white text-stone-900 shadow-xs' 
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Raw markdown source code"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Raw .MD</span>
                </button>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                title="Copy content to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Print Button */}
              <button
                onClick={handlePrint}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                title="Print or save as PDF"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* Document Content View Area */}
          <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
            {!currentContent.plainText && !currentContent.rawMd ? (
              <div className="h-64 flex flex-col items-center justify-center text-stone-400 gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-stone-400" />
                <p className="text-xs">Loading confidential document...</p>
              </div>
            ) : activeFormat === 'text' ? (
              /* READABLE PLAIN TEXT VIEW ("like tx") */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100 text-xs text-stone-500">
                  <span className="font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                    Plain Text Preview &bull; {currentDoc?.filename.replace(/\.md$/, '.txt')}
                  </span>
                  <span className="text-stone-400">
                    {currentDoc?.wordCount.toLocaleString()} words &bull; UTF-8 Clean Text
                  </span>
                </div>
                <pre className="font-mono text-xs sm:text-[13px] leading-relaxed text-stone-800 whitespace-pre-wrap select-text bg-stone-50 p-5 rounded-2xl border border-stone-200/80 overflow-x-auto">
                  {currentContent.plainText}
                </pre>
              </div>
            ) : activeFormat === 'formatted' ? (
              /* FORMATTED EDITORIAL READER VIEW */
              <div className="prose prose-stone max-w-none text-stone-800 text-sm sm:text-base leading-relaxed space-y-4">
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-800 leading-relaxed mb-6">
                  <strong>CONFIDENTIAL INTERNAL EXECUTIVE STRATEGY:</strong> This document is strictly restricted to Global Administrators. Do not distribute externally.
                </div>
                
                {/* Clean formatted sections split by headers */}
                <div className="space-y-6">
                  {currentContent.rawMd.split(/\n(?=##?\s)/).map((section, sIdx) => {
                    const lines = section.trim().split('\n');
                    const headerLine = lines[0] || '';
                    const body = lines.slice(1).join('\n');
                    const isH1 = headerLine.startsWith('# ');
                    const isH2 = headerLine.startsWith('## ');
                    const title = headerLine.replace(/^#+\s*/, '').trim();

                    if (!title && !body) return null;

                    return (
                      <div key={sIdx} className="pb-6 border-b border-stone-100 last:border-b-0">
                        {isH1 && (
                          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mb-3 tracking-tight">
                            {title}
                          </h1>
                        )}
                        {isH2 && (
                          <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mb-3 mt-4 text-emerald-950">
                            {title}
                          </h2>
                        )}
                        <div className="text-xs sm:text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                          {markdownToReadableText(body)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* RAW MARKDOWN VIEW */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100 text-xs text-stone-500">
                  <span className="font-mono text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded">
                    Raw Markdown Source &bull; {currentDoc?.filename}
                  </span>
                  <span className="text-stone-400">
                    {currentDoc?.sizeBytes} bytes
                  </span>
                </div>
                <pre className="font-mono text-xs sm:text-xs leading-relaxed text-stone-700 whitespace-pre-wrap select-text bg-stone-900 text-stone-200 p-5 rounded-2xl overflow-x-auto">
                  {currentContent.rawMd}
                </pre>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Available offline &bull; Synced with repo</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownload('text')}
                className="text-stone-600 hover:text-stone-900 font-semibold transition cursor-pointer flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save as .TXT</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
