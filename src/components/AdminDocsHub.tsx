import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Copy, Check, Printer, RefreshCw, 
  Search, BookOpen, ShieldCheck, ExternalLink,
  Layers, Compass, Target, ArrowRight, Eye, Code2, Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminDocMeta, markdownToReadableText } from '../lib/docUtils';
import DocEditorModal from './DocEditorModal';

interface AdminDocResponse {
  doc: AdminDocMeta;
  content: string;
  format: 'text' | 'md';
  filename: string;
}

export default function AdminDocsHub() {
  const [docs, setDocs] = useState<AdminDocMeta[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('concept-validation-survey');
  const [activeFormat, setActiveFormat] = useState<'text' | 'formatted' | 'md'>('formatted');
  const [docData, setDocData] = useState<Record<string, { rawMd: string; plainText: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSection, setActiveSection] = useState<'library' | 'surveys'>('library');
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState<boolean>(false);
  const [editorDocId, setEditorDocId] = useState<string | null>(null);

  // Check URL parameters for pre-selected docId or edit intent
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlDocId = params.get('docId');
      if (urlDocId) {
        setSelectedDocId(urlDocId);
        if (params.get('edit') === '1' || params.get('edit') === 'true') {
          setEditorDocId(urlDocId);
        }
      }
    } catch {
      // non-fatal
    }
  }, []);

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

  // Fetch surveys submitted by partners
  const fetchSurveys = async () => {
    try {
      setLoadingSurveys(true);
      const res = await fetch('/api/admin/surveys');
      if (res.ok) {
        const data = await res.json();
        setSurveys(data.surveys || []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingSurveys(false);
    }
  };

  useEffect(() => {
    fetchDocsList();
    fetchSurveys();
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

  const handleDownload = (format: 'text' | 'md' | 'html') => {
    if (!currentDoc) return;
    const url = `/api/admin/docs/${currentDoc.id}?format=${format}&download=1`;
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'text' 
      ? currentDoc.filename.replace(/\.md$/, '.txt')
      : format === 'html'
      ? (currentDoc.htmlFilename || currentDoc.filename.replace(/\.md$/, '.html'))
      : currentDoc.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloading ${format === 'html' ? 'Standalone HTML (.html)' : format === 'text' ? 'Readable Text (.txt)' : 'Markdown (.md)'}`);
  };

  const handlePrint = () => {
    if (currentDoc?.liveUrl) {
      window.open(currentDoc.liveUrl, '_blank');
      return;
    }
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
              <span>Admin Documentation &amp; Outreach Hub</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
              Hospitality Outreach &amp; Strategy Library
            </h2>
            <p className="text-stone-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Standardized partner surveys, host leaflets, and operational guides. Download in clean readable text (.txt), standalone HTML, or print as crisp PDFs.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setActiveSection('library')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeSection === 'library'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
              }`}
            >
              Document Library
            </button>
            <button
              onClick={() => setActiveSection('surveys')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'surveys'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
              }`}
            >
              <span>Survey Responses</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                surveys.length > 0 ? 'bg-emerald-500 text-white' : 'bg-stone-700 text-stone-300'
              }`}>
                {surveys.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: INBOUND SURVEY RESPONSES */}
      {activeSection === 'surveys' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <h3 className="text-lg font-serif font-bold text-stone-900">
                Inbound Partner Survey Submissions ({surveys.length})
              </h3>
              <p className="text-xs text-stone-500">
                Lodge and cottage managers who completed the online concept survey.
              </p>
            </div>
            <button
              onClick={fetchSurveys}
              disabled={loadingSurveys}
              className="text-xs text-stone-600 hover:text-stone-900 font-semibold inline-flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSurveys ? 'animate-spin' : ''}`} />
              <span>Refresh Inbound Feed</span>
            </button>
          </div>

          {surveys.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-400">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-stone-800">No Survey Submissions Yet</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Share the Concept Survey link with prospective lodge managers over WhatsApp to collect their operational feedback.
              </p>
              <div className="pt-2">
                <a
                  href="/concept-validation"
                  target="_blank"
                  className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Survey Page</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {surveys.map((survey, sIdx) => {
                const phoneClean = (survey.contactPhone || '').replace(/[^0-9+]/g, '');
                const waUrl = phoneClean ? `https://wa.me/${phoneClean.replace(/^\+/, '')}` : null;
                return (
                  <div key={survey.id || sIdx} className="p-4 sm:p-5 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/80 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            survey.type === 'host_onboarding' || survey.type === 'listing_request'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : survey.type === 'partner_inquiry'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : survey.type === 'operations_feedback'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          }`}>
                            {survey.type === 'host_onboarding' ? 'Host Fast-Track' :
                             survey.type === 'listing_request' ? 'Listing Request' :
                             survey.type === 'partner_inquiry' ? 'Partner Inquiry' :
                             survey.type === 'operations_feedback' ? 'Ops Feedback' : 'Concept Survey'}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-stone-900">{survey.propName}</h4>
                          {survey.propLoc && (
                            <span className="text-xs text-stone-500">({survey.propLoc})</span>
                          )}
                        </div>
                        <div className="text-xs text-stone-600 mt-0.5">
                          Contact: <strong>{survey.contactName || 'Manager'}</strong>
                          {survey.contactPhone && <> &bull; <span>{survey.contactPhone}</span></>}
                          {survey.contactEmail && <> &bull; <span className="text-stone-500">{survey.contactEmail}</span></>}
                          {survey.sourceDoc && <> &bull; <span className="italic text-stone-400">via {survey.sourceDoc}</span></>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs"
                          >
                            <span>WhatsApp Chat</span>
                            &rarr;
                          </a>
                        )}
                        <span className="text-[11px] text-stone-400 font-mono">
                          {new Date(survey.submittedAt || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-stone-700">
                      <div>
                        <span className="text-stone-400 font-semibold block text-[10px] uppercase">Pilot Interest</span>
                        <span className="font-bold text-emerald-800">
                          {survey.pilotInterest === 'yes' ? 'Ready for Pilot (0% Tier)' : survey.pilotInterest === 'briefing' ? 'Requested Briefing Call' : 'Keep Informed'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 font-semibold block text-[10px] uppercase">Channels Used</span>
                        <span>{Array.isArray(survey.channels) ? survey.channels.join(', ') : 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 font-semibold block text-[10px] uppercase">Key Features Wanted</span>
                        <span>{Array.isArray(survey.features) ? survey.features.join(', ') : 'Direct payouts'}</span>
                      </div>
                    </div>

                    {survey.notes && (
                      <div className="bg-white p-3 rounded-lg border border-stone-200 text-xs text-stone-700">
                        <strong className="text-stone-900">Host Notes:</strong> {survey.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION: DOCUMENT LIBRARY (Clean & Standardized) */}
      {activeSection === 'library' && (
        <>
          {/* Quick-Access Document Spotlight */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Partner Outreach Instruments
                </span>
                <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 mt-0.5">
                  Shareable Surveys &amp; Host Leaflets
                </h3>
              </div>
              <span className="text-xs text-stone-400 font-mono">Clean HTML &bull; PDF Ready</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Concept Survey Card */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      Submissible Survey
                    </span>
                    <span className="text-xs text-stone-400 font-mono">Online + PDF</span>
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">
                    Pre-Launch Partner Discovery Survey
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Evaluates lodge booking habits, OTA commission frustration, and local payout requirements. Enables managers to submit responses directly to our team.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-stone-200 flex-wrap">
                  <a
                    href="/concept-validation"
                    target="_blank"
                    className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Live Survey</span>
                  </a>
                  <a
                    href="/api/admin/docs/concept-validation-survey?format=html&download=1"
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-700 font-semibold text-xs inline-flex items-center gap-1.5 transition border border-stone-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download HTML</span>
                  </a>
                </div>
              </div>

              {/* Stay Owner Leaflet Card */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      Host Leaflet
                    </span>
                    <span className="text-xs text-stone-400 font-mono">One-Pager</span>
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">
                    Stay Owner Acquisition Leaflet ("What You Get")
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Clean, simple one-pager ready to send via WhatsApp, email, or print. Explains 0% launch commission, Airtel/Mpamba payouts, and 8-minute listing setup.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-stone-200 flex-wrap">
                  <a
                    href="/stay-owner-leaflet"
                    target="_blank"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Live Leaflet</span>
                  </a>
                  <a
                    href="/api/admin/docs/stay-owner-leaflet?format=html&download=1"
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-700 font-semibold text-xs inline-flex items-center gap-1.5 transition border border-stone-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download HTML</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Live Links Bar */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3 flex-wrap text-xs">
              <span className="text-stone-500 font-medium">All Live Partner Documents:</span>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href="/host-guide"
                  target="_blank"
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium inline-flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3 text-stone-500" />
                  <span>Host Starter Pack</span>
                </a>
                <a
                  href="/listing-guide"
                  target="_blank"
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium inline-flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3 text-stone-500" />
                  <span>Listing Guide</span>
                </a>
                <a
                  href="/marketing"
                  target="_blank"
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium inline-flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3 text-stone-500" />
                  <span>Commercial Deck</span>
                </a>
                <a
                  href="/operations-guide"
                  target="_blank"
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium inline-flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3 text-stone-500" />
                  <span>Operations Playbook</span>
                </a>
                <a
                  href="/uat"
                  target="_blank"
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium inline-flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3 text-stone-500" />
                  <span>Platform &amp; UAT Guide</span>
                </a>
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isSelected 
                            ? 'bg-stone-800 text-emerald-400' 
                            : 'bg-stone-100 text-stone-600'
                        }`}>
                          {doc.category}
                        </span>
                        {doc.isCustomized && (
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            isSelected ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            Customized
                          </span>
                        )}
                      </div>
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
                    {doc.lastEditedBy && (
                      <p className={`text-[10px] mt-1 ${isSelected ? 'text-stone-400' : 'text-stone-400'} italic`}>
                        Customized by {doc.lastEditedBy}
                      </p>
                    )}
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

              {/* Edit Document Button (Marketing & Super Admin) */}
              <button
                onClick={() => setEditorDocId(selectedDocId)}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Edit document content & messaging (Marketing & Super Admin)"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-800" />
                <span className="hidden sm:inline">Edit Content</span>
              </button>

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
    </>
  )}

  {/* Modal Editor for Marketing & Super Admin */}
  {editorDocId && (
    <DocEditorModal
      isOpen={!!editorDocId}
      docId={editorDocId}
      onClose={() => setEditorDocId(null)}
      onSaved={(updatedDoc, newContent) => {
        setDocData(prev => ({
          ...prev,
          [updatedDoc.id]: {
            rawMd: newContent,
            plainText: markdownToReadableText(newContent)
          }
        }));
        setDocs(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
        fetchDocsList();
      }}
    />
  )}
</div>
);
}
