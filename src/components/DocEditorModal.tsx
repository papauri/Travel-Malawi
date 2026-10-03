import React, { useState, useEffect } from 'react';
import { 
  X, Save, RotateCcw, Eye, Code2, Columns2, 
  Bold, Italic, Heading2, Heading3, List, Table, 
  AlertCircle, Check, Sparkles, ExternalLink, HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminDocMeta, markdownToReadableText } from '../lib/docUtils';
import { useAuth } from '../contexts/AuthContext';

interface DocEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  onSaved?: (updatedDoc: AdminDocMeta, newContent: string) => void;
}

export default function DocEditorModal({
  isOpen,
  onClose,
  docId,
  onSaved
}: DocEditorModalProps) {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [docMeta, setDocMeta] = useState<AdminDocMeta | null>(null);
  
  const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'split'>('editor');

  // Load document content & metadata on open
  useEffect(() => {
    if (!isOpen || !docId) return;

    const fetchDoc = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/docs/${docId}?format=md`);
        if (res.ok) {
          const data = await res.json();
          setDocMeta(data.doc);
          setTitle(data.doc?.title || '');
          setSubtitle(data.doc?.subtitle || '');
          setCategory(data.doc?.category || '');
          setContent(data.content || '');
        } else {
          toast.error('Failed to load document for editing');
        }
      } catch (err) {
        console.error('Error fetching doc for editing:', err);
        toast.error('Unable to fetch document data');
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [isOpen, docId]);

  if (!isOpen) return null;

  // Insert markdown helpers at cursor position
  const insertSnippet = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = document.getElementById('doc-editor-textarea') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 50);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Document title is required');
      return;
    }

    setSaving(true);
    try {
      const editorEmail = user?.email || user?.displayName || 'Marketing & Super Admin';
      const res = await fetch(`/api/admin/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subtitle,
          category,
          content,
          lastEditedBy: editorEmail,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save changes');
      }

      const data = await res.json();
      toast.success('Document updated and published!');
      if (onSaved && data.doc) {
        onSaved(data.doc, content);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving doc:', err);
      toast.error(err.message || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/docs/${docId}/reset`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reset document');
      }

      const data = await res.json();
      setTitle(data.doc?.title || '');
      setSubtitle(data.doc?.subtitle || '');
      setCategory(data.doc?.category || '');
      setContent(data.content || '');
      setDocMeta(data.doc);
      setShowResetConfirm(false);
      toast.success('Document reverted to factory original defaults');
      if (onSaved && data.doc) {
        onSaved(data.doc, data.content);
      }
    } catch (err: any) {
      console.error('Error resetting doc:', err);
      toast.error(err.message || 'Failed to restore original');
    } finally {
      setResetting(false);
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-stone-900"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header Bar */}
        <div className="p-4 sm:px-6 sm:py-4 bg-stone-900 text-white flex items-center justify-between gap-4 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-stone-800 px-2 py-0.5 rounded">
                  Marketing &amp; Admin Editor
                </span>
                <span className="text-xs text-stone-400 font-mono hidden sm:inline">
                  {docId}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-serif font-bold text-white tracking-tight mt-0.5">
                Edit Partner &amp; Operational Document
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              title="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-stone-500">
            <div className="w-7 h-7 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">Loading document content...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Metadata inputs */}
            <div className="p-4 sm:px-6 bg-stone-50 border-b border-stone-200 space-y-3 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter document title..."
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-stone-900 transition"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                    Category Tag
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Marketing, Host Acquisition"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-stone-900 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="One-line summary or value proposition..."
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-700 focus:outline-none focus:border-stone-900 transition"
                />
              </div>

              {docMeta?.lastEditedAt && (
                <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                  <span>
                    Last customized by <strong className="text-stone-700">{docMeta.lastEditedBy || 'Administrator'}</strong>
                  </span>
                  <span>
                    {new Date(docMeta.lastEditedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Markdown Insertion Toolbar & View Switcher */}
            <div className="px-4 py-2.5 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              {/* Snippet Buttons */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => insertSnippet('**', '**', 'bold text')}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('*', '*', 'italic text')}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('## ', '\n', 'Section Header')}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Heading 2"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('### ', '\n', 'Sub-heading')}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Heading 3"
                >
                  <Heading3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('* ', '\n', 'Bullet list item')}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Bullet list"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('\n| Item | Rate | Notes |\n|------|------|-------|\n| Standard | MK 85,000 | Direct payout |\n\n')}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Insert Table"
                >
                  <Table className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('\n> [!NOTE]\n> Takulandirani! 0% launch commission tier.\n\n')}
                  className="px-2 py-1 rounded-lg hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Callout Box"
                >
                  Callout Box
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('MK 85,000 / $55 ')}
                  className="px-2 py-1 rounded-lg hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Local Currency Snippet"
                >
                  MWK/USD
                </button>
              </div>

              {/* View Switcher Pill */}
              <div className="inline-flex p-0.5 bg-stone-100 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('editor')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                    viewMode === 'editor' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Code2 className="w-3 h-3" />
                  <span>Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                    viewMode === 'preview' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Live Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 hidden md:flex ${
                    viewMode === 'split' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Columns2 className="w-3 h-3" />
                  <span>Split</span>
                </button>
              </div>
            </div>

            {/* Editor Workspace */}
            <div className="flex-1 flex overflow-hidden min-h-[380px]">
              {/* Textarea Editor */}
              {(viewMode === 'editor' || viewMode === 'split') && (
                <div className={`flex-1 flex flex-col p-4 bg-stone-50 ${viewMode === 'split' ? 'border-r border-stone-200' : ''}`}>
                  <textarea
                    id="doc-editor-textarea"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write or edit document markdown..."
                    className="w-full flex-1 p-4 bg-white border border-stone-300 rounded-2xl font-mono text-xs sm:text-[13px] leading-relaxed text-stone-800 focus:outline-none focus:border-stone-900 transition resize-none shadow-2xs"
                  />
                  <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2 px-1">
                    <span>Monospace Markdown &bull; UTF-8</span>
                    <span>{wordCount.toLocaleString()} words &bull; {lineCount} lines</span>
                  </div>
                </div>
              )}

              {/* Formatted Preview */}
              {(viewMode === 'preview' || viewMode === 'split') && (
                <div className="flex-1 p-6 overflow-y-auto bg-white">
                  <div className="max-w-2xl mx-auto space-y-4">
                    <div className="border-b border-stone-200 pb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        {category || 'Document Category'}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-2">
                        {title || 'Untitled Document'}
                      </h2>
                      {subtitle && (
                        <p className="text-xs sm:text-sm text-stone-600 mt-1 italic">
                          {subtitle}
                        </p>
                      )}
                    </div>

                    <div className="prose prose-stone max-w-none text-xs sm:text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                      {markdownToReadableText(content)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 sm:px-6 bg-stone-100 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                disabled={saving || resetting}
                className="text-xs text-stone-600 hover:text-red-700 font-semibold inline-flex items-center gap-1.5 transition cursor-pointer py-1.5 px-2 rounded-lg hover:bg-stone-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Factory Default</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 p-1 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                <span className="font-semibold text-[11px] px-1">Revert all edits?</span>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetting}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  {resetting ? 'Reverting...' : 'Yes, Revert'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2 py-1 text-stone-600 hover:text-stone-900 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || resetting}
              className="px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || resetting}
              className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Publishing Updates...' : 'Save & Publish Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
