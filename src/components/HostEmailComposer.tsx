import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, FileText, Mail, Save, Send, Sparkles, Trash2 } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  HOST_MESSAGES_COLLECTION, HostMessage, TemplateId, buildTemplate,
} from '../lib/listingRequests';

/**
 * Write, save and send one email to a host from Admin > Hosts: start from a
 * template or let Ulendo draft it, edit, keep it as a draft, then send it
 * through the platform's email. Every saved draft and sent email is kept in
 * `host_messages` so the whole conversation is visible in the app.
 */

export interface ComposerTarget {
  to: string;
  toName?: string;
  propName?: string;
  ref?: string;
  requestId?: string;
  hotelId?: string;
  hotelName?: string;
  /** What we know about the property, passed to Ulendo as context. */
  context?: string;
  missing?: string[];
}

interface Props {
  target: ComposerTarget;
  templates: { id: TemplateId; label: string }[];
  messages: HostMessage[];
  onChanged: () => void;
  /** Called after a successful send with the template it started from. */
  onSent?: (template: TemplateId | undefined) => void | Promise<void>;
}

const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function HostEmailComposer({ target, templates, messages, onChanged, onSent }: Props) {
  const { user } = useAuth();
  const [to, setTo] = useState(target.to);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [template, setTemplate] = useState<TemplateId | undefined>();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const targetKey = target.requestId || target.hotelId || target.to;
  useEffect(() => {
    setTo(target.to);
    setSubject('');
    setBody('');
    setTemplate(undefined);
    setDraftId(null);
    setInstruction('');
  }, [targetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTemplate = (id: TemplateId) => {
    const t = buildTemplate(id, { name: target.toName, propName: target.propName || target.hotelName, ref: target.ref, missing: target.missing });
    setTemplate(id);
    setSubject(t.subject);
    setBody(t.body);
  };

  const historyText = () => messages
    .filter(m => m.status === 'sent')
    .slice(0, 3)
    .map(m => `${fmt(m.sentAt)} - ${m.subject}\n${m.body.slice(0, 600)}`)
    .join('\n\n');

  const draftWithUlendo = async () => {
    setDrafting(true);
    try {
      const res = await fetch('/api/admin/host-email/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: instruction.trim() || (template ? templates.find(t => t.id === template)?.label : ''),
          purpose: template ? templates.find(t => t.id === template)?.label : 'general message',
          recipientName: target.toName,
          propertyName: target.propName || target.hotelName,
          context: [target.context, target.missing?.length ? `Still missing: ${target.missing.join('; ')}` : ''].filter(Boolean).join('\n'),
          currentDraft: body.trim() ? `Subject: ${subject}\n\n${body}` : '',
          history: historyText(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Ulendo could not draft that email.');
      if (data.subject) setSubject(data.subject);
      setBody(data.body || '');
      toast.success('Draft ready. Check it before sending.');
    } catch (err: any) {
      toast.error(err?.message || 'Ulendo is not available right now. Use a template instead.');
    } finally {
      setDrafting(false);
    }
  };

  const record = (status: HostMessage['status'], extra: Partial<HostMessage> = {}) => {
    const now = Date.now();
    const data: Record<string, unknown> = {
      to: to.trim().toLowerCase(),
      toName: target.toName || '',
      subject: subject.trim(),
      body,
      status,
      createdAt: now,
      createdBy: user?.uid || '',
      createdByEmail: user?.email || '',
      ...(template ? { template } : {}),
      ...(target.requestId ? { requestId: target.requestId } : {}),
      ...(target.hotelId ? { hotelId: target.hotelId, hotelName: target.hotelName || '' } : {}),
      ...extra,
    };
    return draftId
      ? updateDoc(doc(db, HOST_MESSAGES_COLLECTION, draftId), data)
      : addDoc(collection(db, HOST_MESSAGES_COLLECTION), data).then(ref => { setDraftId(ref.id); });
  };

  const saveDraft = async () => {
    if (!subject.trim() && !body.trim()) return toast.error('Nothing to save yet.');
    setBusy(true);
    try {
      await record('draft');
      toast.success('Draft saved');
      onChanged();
    } catch (err) {
      console.error('[HostEmail] Could not save draft:', err);
      toast.error('Could not save the draft.');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to.trim())) return toast.error('Enter a valid email address.');
    if (!subject.trim() || !body.trim()) return toast.error('Add a subject and a message.');
    if (/\[[^\]]{2,}\]|\(add [^)]*\)/i.test(body)) {
      return toast.error('Fill in or remove the [placeholders] before sending.');
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/host-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'The email could not be sent.');
      try {
        await record('sent', { sentAt: Date.now() });
      } catch (err) {
        console.warn('[HostEmail] Sent, but not saved to history:', err);
        toast('Sent, but it could not be saved to the history.', { icon: '!' });
      }
      toast.success(`Email sent to ${to.trim()}`);
      await onSent?.(template);
      setSubject('');
      setBody('');
      setTemplate(undefined);
      setDraftId(null);
      setInstruction('');
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'The email could not be sent. Check Settings > Email.');
    } finally {
      setBusy(false);
    }
  };

  const loadDraft = (m: HostMessage) => {
    setDraftId(m.id);
    setTo(m.to);
    setSubject(m.subject);
    setBody(m.body);
    setTemplate(m.template as TemplateId | undefined);
  };

  const removeDraft = async (m: HostMessage) => {
    try {
      await deleteDoc(doc(db, HOST_MESSAGES_COLLECTION, m.id));
      if (draftId === m.id) setDraftId(null);
      onChanged();
    } catch {
      toast.error('Could not delete the draft.');
    }
  };

  const drafts = messages.filter(m => m.status === 'draft');
  const sent = messages.filter(m => m.status !== 'draft');
  const mailto = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Start from a template">
          {templates.map(t => (
            <button key={t.id} type="button" onClick={() => applyTemplate(t.id)}
              className={`tm-btn tm-btn-sm ${template === t.id ? 'tm-btn-primary' : 'tm-btn-secondary'}`}>
              <FileText size={13} /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input value={instruction} onChange={e => setInstruction(e.target.value)} maxLength={1000}
            placeholder="Tell Ulendo what to write, e.g. ask for photos of the rooms and the beach"
            className="tm-input flex-1 min-w-0" />
          <button type="button" onClick={draftWithUlendo} disabled={drafting} className="tm-btn tm-btn-secondary tm-btn-sm shrink-0">
            <Sparkles size={14} /> {drafting ? 'Drafting...' : body.trim() ? 'Redraft with Ulendo' : 'Draft with Ulendo'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[5rem_1fr] gap-2 items-center">
          <label className="tm-label mb-0!" htmlFor="hec-to">To</label>
          <input id="hec-to" type="email" value={to} onChange={e => setTo(e.target.value)} className="tm-input" />
          <label className="tm-label mb-0!" htmlFor="hec-subject">Subject</label>
          <input id="hec-subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} className="tm-input" />
        </div>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} maxLength={8000}
          placeholder="Pick a template, ask Ulendo for a draft, or write your own message."
          className="tm-input resize-y font-sans text-sm leading-relaxed" />
        <p className="text-[11px] text-stone-500">
          Sent from the platform address with replies to info@ulendomalawi.com. A short footer is added saying Travel Malawi is an
          information directory and that licences are the owner's responsibility.
        </p>
        <div className="tm-actions">
          <button type="button" onClick={send} disabled={busy} className="tm-btn tm-btn-primary tm-btn-sm">
            <Send size={14} /> {busy ? 'Working...' : 'Send email'}
          </button>
          <button type="button" onClick={saveDraft} disabled={busy} className="tm-btn tm-btn-secondary tm-btn-sm">
            <Save size={14} /> {draftId ? 'Update draft' : 'Save draft'}
          </button>
          <a href={mailto} className="tm-btn tm-btn-quiet tm-btn-sm"><Mail size={14} /> Open in mail app</a>
          <button type="button" onClick={() => { navigator.clipboard.writeText(`${subject}\n\n${body}`); toast.success('Copied'); }}
            className="tm-btn tm-btn-quiet tm-btn-sm">
            <Copy size={14} /> Copy
          </button>
        </div>
      </div>

      {drafts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Saved drafts</h4>
          <ul className="divide-y divide-stone-100 border border-stone-200 rounded-lg">
            {drafts.map(m => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <button type="button" onClick={() => loadDraft(m)} className="min-w-0 text-left cursor-pointer">
                  <span className={`block truncate ${draftId === m.id ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{m.subject || '(no subject)'}</span>
                  <span className="text-xs text-stone-500">{fmt(m.createdAt)}{m.createdByEmail ? ` · ${m.createdByEmail}` : ''}</span>
                </button>
                <button type="button" onClick={() => removeDraft(m)} aria-label="Delete draft" className="tm-btn tm-btn-quiet tm-btn-sm shrink-0">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Emails sent</h4>
        {sent.length === 0 ? (
          <p className="tm-muted text-sm">Nothing sent yet.</p>
        ) : (
          <ul className="space-y-2">
            {sent.map(m => (
              <li key={m.id} className="border border-stone-200 rounded-lg">
                <button type="button" onClick={() => setOpenId(openId === m.id ? null : m.id)}
                  className="w-full text-left px-3 py-2 cursor-pointer">
                  <span className="block text-sm font-medium text-stone-900 truncate">{m.subject}</span>
                  <span className="text-xs text-stone-500">
                    {fmt(m.sentAt || m.createdAt)} · to {m.to}{m.createdByEmail ? ` · by ${m.createdByEmail}` : ''}
                  </span>
                </button>
                {openId === m.id && (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700 px-3 pb-3 border-t border-stone-100 pt-2">{m.body}</pre>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-stone-500">Replies from hosts arrive in the info@ulendomalawi.com inbox.</p>
      </div>
    </div>
  );
}
