import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, Printer, RefreshCw, Edit3, MessageSquare } from 'lucide-react';
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

  const secondaryBtn =
    'inline-flex items-center gap-1.5 border border-stone-300 text-stone-800 rounded-md px-3 py-1.5 text-sm hover:bg-stone-50 cursor-pointer disabled:opacity-50';
  const primaryBtn =
    'inline-flex items-center gap-1.5 bg-stone-900 text-white rounded-md px-3 py-1.5 text-sm hover:bg-stone-800 cursor-pointer';
  const tabBtn = (active: boolean) => (active ? primaryBtn : secondaryBtn);
  const th = 'bg-stone-50 text-left font-medium text-stone-900 px-3 py-2';
  const td = 'px-3 py-2 border-t border-stone-200 text-stone-700 align-top';
  const textLink = 'text-stone-900 underline underline-offset-2 decoration-stone-300 hover:decoration-stone-900';

  const surveyTypeLabel = (type?: string) =>
    type === 'host_onboarding' ? 'Host Fast-Track' :
    type === 'listing_request' ? 'Listing Request' :
    type === 'partner_inquiry' ? 'Partner Inquiry' :
    type === 'operations_feedback' ? 'Ops Feedback' : 'Concept Survey';

  const formatEdited = (doc: AdminDocMeta) => {
    const date = doc.lastEditedAt ? new Date(doc.lastEditedAt) : null;
    const dateText = date && !isNaN(date.getTime()) ? date.toLocaleDateString() : '';
    if (!dateText && !doc.lastEditedBy) return '—';
    return [dateText, doc.lastEditedBy].filter(Boolean).join(' · ');
  };

  const livePages = [
    { href: '/concept-validation', label: 'Partner Discovery Survey' },
    { href: '/stay-owner-leaflet', label: 'Stay Owner Leaflet' },
    { href: '/host-guide', label: 'Host Starter Pack' },
    { href: '/listing-guide', label: 'Listing Guide' },
    { href: '/marketing', label: 'Commercial Deck' },
    { href: '/operations-guide', label: 'Operations Playbook' },
    { href: '/uat', label: 'Platform & UAT Guide' }
  ];

  return (
    <div className="text-stone-700 font-sans">
      {/* Header */}
      <header className="border-b border-stone-200 pb-6 mb-8">
        <p className="text-sm text-stone-500">Admin &middot; Documentation</p>
        <h2 className="mt-2 text-3xl font-semibold text-stone-900">Outreach &amp; Strategy Library</h2>
        <p className="mt-2 text-stone-500 text-[15px] leading-relaxed">
          Partner surveys, host leaflets, and operational guides. Download as text, HTML, or print to PDF.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => setActiveSection('library')} className={tabBtn(activeSection === 'library')}>
            Documents
          </button>
          <button onClick={() => setActiveSection('surveys')} className={tabBtn(activeSection === 'surveys')}>
            Survey responses ({surveys.length})
          </button>
        </div>
      </header>

      {/* SECTION: INBOUND SURVEY RESPONSES */}
      {activeSection === 'surveys' && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-stone-900">Survey submissions ({surveys.length})</h3>
              <p className="mt-1 text-sm text-stone-500">
                Lodge and cottage managers who completed the online concept survey.
              </p>
            </div>
            <button onClick={fetchSurveys} disabled={loadingSurveys} className={secondaryBtn}>
              <RefreshCw size={16} className={`text-stone-500 ${loadingSurveys ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {surveys.length === 0 ? (
            <div className="mt-6 bg-stone-50 border-l-2 border-stone-300 px-4 py-3 text-[15px] leading-relaxed text-stone-700">
              No survey submissions yet. Share the{' '}
              <a href="/concept-validation" target="_blank" className={textLink}>concept survey</a>{' '}
              with prospective lodge managers over WhatsApp to collect their operational feedback.
            </div>
          ) : (
            <ul className="mt-6 border-b border-stone-200">
              {surveys.map((survey, sIdx) => {
                const phoneClean = (survey.contactPhone || '').replace(/[^0-9+]/g, '');
                const waUrl = phoneClean ? `https://wa.me/${phoneClean.replace(/^\+/, '')}` : null;
                return (
                  <li key={survey.id || sIdx} className="border-t border-stone-200 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-stone-500">
                          {surveyTypeLabel(survey.type)} &middot; {new Date(survey.submittedAt || Date.now()).toLocaleDateString()}
                          {survey.sourceDoc && <> &middot; via {survey.sourceDoc}</>}
                        </p>
                        <h4 className="mt-1 text-base font-semibold text-stone-900">
                          {survey.propName}
                          {survey.propLoc && <span className="font-normal text-stone-500"> ({survey.propLoc})</span>}
                        </h4>
                        <p className="mt-1 text-sm text-stone-700">
                          {survey.contactName || 'Manager'}
                          {survey.contactPhone && <> &middot; {survey.contactPhone}</>}
                          {survey.contactEmail && <> &middot; {survey.contactEmail}</>}
                        </p>
                      </div>
                      {waUrl && (
                        <a href={waUrl} target="_blank" rel="noreferrer" className={secondaryBtn}>
                          <MessageSquare size={16} className="text-stone-500" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>

                    <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <dt className="text-stone-500">Pilot interest</dt>
                        <dd className="text-stone-900">
                          {survey.pilotInterest === 'yes' ? 'Ready for Pilot (0% Tier)' : survey.pilotInterest === 'briefing' ? 'Requested Briefing Call' : 'Keep Informed'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">Channels used</dt>
                        <dd className="text-stone-900">{Array.isArray(survey.channels) ? survey.channels.join(', ') : 'Not specified'}</dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">Key features wanted</dt>
                        <dd className="text-stone-900">{Array.isArray(survey.features) ? survey.features.join(', ') : 'Direct payouts'}</dd>
                      </div>
                    </dl>

                    {survey.notes && (
                      <p className="mt-3 bg-stone-50 border-l-2 border-stone-300 px-4 py-3 text-sm text-stone-700">
                        <span className="font-medium text-stone-900">Host notes: </span>{survey.notes}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* SECTION: DOCUMENT LIBRARY */}
      {activeSection === 'library' && (
        <>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-stone-900">Documents</h3>
              <input
                type="text"
                placeholder="Search documents"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 bg-white border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900"
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border border-stone-200">
                <thead>
                  <tr>
                    <th className={th}>Title</th>
                    <th className={th}>Category</th>
                    <th className={th}>Last edited</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && docs.length === 0 ? (
                    <tr>
                      <td className={`${td} text-stone-500`} colSpan={4}>Loading documents…</td>
                    </tr>
                  ) : filteredDocs.length === 0 ? (
                    <tr>
                      <td className={`${td} text-stone-500`} colSpan={4}>No documents match your search.</td>
                    </tr>
                  ) : (
                    filteredDocs.map((doc, dIdx) => {
                      const isSelected = doc.id === selectedDocId;
                      return (
                        <tr key={`${doc.id || 'doc'}-${dIdx}`} className={isSelected ? 'bg-stone-50' : ''}>
                          <td className={td}>
                            <button
                              onClick={() => setSelectedDocId(doc.id)}
                              className="text-left font-medium text-stone-900 hover:underline cursor-pointer"
                            >
                              {doc.title}
                            </button>
                            <p className="mt-0.5 text-stone-500 line-clamp-1">{doc.subtitle}</p>
                          </td>
                          <td className={`${td} whitespace-nowrap`}>
                            {doc.category}
                            {doc.isCustomized && <span className="block text-stone-500">Customised</span>}
                          </td>
                          <td className={`${td} whitespace-nowrap text-stone-500`}>{formatEdited(doc)}</td>
                          <td className={`${td} whitespace-nowrap text-right`}>
                            <div className="inline-flex items-center gap-3">
                              <button
                                onClick={() => setSelectedDocId(doc.id)}
                                className="text-stone-900 hover:underline cursor-pointer"
                              >
                                {isSelected ? 'Viewing' : 'View'}
                              </button>
                              <button
                                onClick={() => setEditorDocId(doc.id)}
                                className="text-stone-900 hover:underline cursor-pointer"
                              >
                                Edit
                              </button>
                              {doc.liveUrl && (
                                <a href={doc.liveUrl} target="_blank" rel="noreferrer" className="text-stone-900 hover:underline">
                                  Open
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-stone-500 leading-relaxed">
              Live pages:{' '}
              {livePages.map((page, i) => (
                <React.Fragment key={page.href}>
                  {i > 0 && ' · '}
                  <a href={page.href} target="_blank" className={textLink}>{page.label}</a>
                </React.Fragment>
              ))}
            </p>
          </section>

          {/* Document viewer */}
          <section className="border-t border-stone-200 mt-10 pt-10">
            <div className="border border-stone-200 rounded-md">
              {/* Viewer toolbar */}
              <div className="px-4 py-3 border-b border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-stone-500">
                    {currentDoc?.category || 'Document'}
                    {currentDoc?.filename && <> &middot; <span className="font-mono">{currentDoc.filename}</span></>}
                  </p>
                  <h3 className="mt-0.5 text-base font-semibold text-stone-900">{currentDoc?.title}</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveFormat('formatted')}
                    className={tabBtn(activeFormat === 'formatted')}
                    title="Formatted reader view"
                  >
                    Reader
                  </button>
                  <button
                    onClick={() => setActiveFormat('text')}
                    className={tabBtn(activeFormat === 'text')}
                    title="Readable plain text (.txt)"
                  >
                    Text
                  </button>
                  <button
                    onClick={() => setActiveFormat('md')}
                    className={tabBtn(activeFormat === 'md')}
                    title="Raw markdown source"
                  >
                    Markdown
                  </button>
                  <span className="w-px h-5 bg-stone-200 mx-1 hidden sm:block" />
                  <button
                    onClick={() => setEditorDocId(selectedDocId)}
                    className={secondaryBtn}
                    title="Edit document content (Marketing & Super Admin)"
                  >
                    <Edit3 size={16} className="text-stone-500" />
                    <span>Edit</span>
                  </button>
                  <button onClick={handleCopy} className={secondaryBtn} title="Copy content to clipboard">
                    {copied ? <Check size={16} className="text-stone-500" /> : <Copy size={16} className="text-stone-500" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button onClick={handlePrint} className={secondaryBtn} title="Print or save as PDF">
                    <Printer size={16} className="text-stone-500" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-5 py-6 min-h-[400px]">
                {!currentContent.plainText && !currentContent.rawMd ? (
                  <p className="text-sm text-stone-500">Loading document…</p>
                ) : activeFormat === 'text' ? (
                  <>
                    <p className="text-sm text-stone-500 mb-3">
                      {currentDoc?.filename.replace(/\.md$/, '.txt')} &middot; {currentDoc?.wordCount.toLocaleString()} words
                    </p>
                    <pre className="font-mono text-[13px] leading-relaxed text-stone-800 whitespace-pre-wrap select-text bg-stone-50 border border-stone-200 rounded-md p-4 overflow-x-auto">
                      {currentContent.plainText}
                    </pre>
                  </>
                ) : activeFormat === 'formatted' ? (
                  <div className="max-w-3xl">
                    <p className="bg-stone-50 border-l-2 border-stone-300 px-4 py-3 text-sm text-stone-700 mb-6">
                      Internal strategy document, restricted to Global Administrators. Do not distribute externally.
                    </p>
                    {currentContent.rawMd.split(/\n(?=##?\s)/).map((section, sIdx) => {
                      const lines = section.trim().split('\n');
                      const headerLine = lines[0] || '';
                      const body = lines.slice(1).join('\n');
                      const isH1 = headerLine.startsWith('# ');
                      const isH2 = headerLine.startsWith('## ');
                      const title = headerLine.replace(/^#+\s*/, '').trim();

                      if (!title && !body) return null;

                      return (
                        <div key={sIdx}>
                          {isH1 && (
                            <h1 className="text-3xl font-semibold text-stone-900 mb-3">{title}</h1>
                          )}
                          {isH2 && (
                            <h2 className="text-xl font-semibold text-stone-900 mt-10 mb-3">{title}</h2>
                          )}
                          <div className="text-[15px] text-stone-700 whitespace-pre-wrap leading-relaxed">
                            {markdownToReadableText(body)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-stone-500 mb-3">
                      {currentDoc?.filename} &middot; {currentDoc?.sizeBytes} bytes
                    </p>
                    <pre className="font-mono text-[13px] leading-relaxed text-stone-800 whitespace-pre-wrap select-text bg-stone-50 border border-stone-200 rounded-md p-4 overflow-x-auto">
                      {currentContent.rawMd}
                    </pre>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
                <span>Download this document</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => handleDownload('text')} className={secondaryBtn}>
                    <Download size={16} className="text-stone-500" />
                    <span>.txt</span>
                  </button>
                  <button onClick={() => handleDownload('md')} className={secondaryBtn}>
                    <Download size={16} className="text-stone-500" />
                    <span>.md</span>
                  </button>
                  <button onClick={() => handleDownload('html')} className={secondaryBtn}>
                    <Download size={16} className="text-stone-500" />
                    <span>.html</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
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
