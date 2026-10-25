import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ExternalLink, Inbox, RefreshCw, Search } from 'lucide-react';
import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Hotel } from '../types';
import { PLACEHOLDER_IMAGE, getHotelImages } from '../lib/images';
import {
  HOST_MESSAGES_COLLECTION, HOST_TEMPLATES, HostMessage, LISTING_REQUESTS_COLLECTION, LISTING_REQUEST_STATUSES,
  ListingRequest, ListingRequestStatus, REQUEST_TEMPLATES, TemplateId, missingItems, toMillis,
} from '../lib/listingRequests';
import HostEmailComposer from './HostEmailComposer';

/**
 * Admin > Hosts: review listing requests and email hosts.
 *
 * Requests live in Firestore. The server also keeps a copy of each request it
 * was told about, so one whose browser copy failed to save still shows here
 * (marked "server copy") and is saved to Firestore the first time it is acted on.
 */

type View = 'requests' | 'hosts';
type Row = ListingRequest & { serverOnly?: boolean };

const STATUS_TAG: Record<ListingRequestStatus, string> = {
  pending_review: 'tm-tag tm-tag-warn',
  needs_info: 'tm-tag',
  approved: 'tm-tag tm-tag-good',
  declined: 'tm-tag tm-tag-bad',
  archived: 'tm-tag',
};
const statusLabel = (s: ListingRequestStatus) => LISTING_REQUEST_STATUSES.find(x => x.id === s)?.label || s;
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Sending a template moves the request along. */
const STATUS_AFTER_SEND: Partial<Record<TemplateId, ListingRequestStatus>> = {
  more_info: 'needs_info',
  invite: 'approved',
  declined: 'declined',
};

function requestSummary(r: Row): string {
  return [
    `Property: ${r.propName}${r.category ? ` (${r.category})` : ''}`,
    r.propLoc && `Area: ${r.propLoc}`,
    r.address && `Address: ${r.address}`,
    r.stayType && `Travellers stay in: ${r.stayType === 'rooms' ? 'individual rooms' : 'the whole place'}${r.roomCount ? `, ${r.roomCount} rooms` : ''}`,
    (r.nightlyMwk || r.nightlyUsd) && `From price: ${[r.nightlyMwk && `MK ${r.nightlyMwk}`, r.nightlyUsd && `$${r.nightlyUsd}`].filter(Boolean).join(' / ')}`,
    r.amenities?.length && `Facilities: ${r.amenities.join(', ')}`,
    r.description && `Description: ${r.description}`,
    `Sender: ${r.contactName || ''}${r.contactRole ? ` (${r.contactRole})` : ''}`,
    r.notes && `Their notes: ${r.notes}`,
  ].filter(Boolean).join('\n');
}

function hotelSummary(h: Hotel): string {
  return [
    `Listing: ${h.name} (${h.status || 'approved'})`,
    h.location && `Area: ${h.location}`,
    h.categories?.length && `Type: ${h.categories.join(', ')}`,
    `Photos on listing: ${getHotelImages(h).filter(u => u !== PLACEHOLDER_IMAGE).length}`,
    `Contact on listing: ${[h.contactPhone, h.contactWhatsapp, h.contactEmail].filter(Boolean).join(', ') || 'none'}`,
    h.moderationNotes && `Last moderation note: ${h.moderationNotes}`,
  ].filter(Boolean).join('\n');
}

function Field({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="text-sm text-stone-900 break-words whitespace-pre-wrap">
        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="tm-link">{value}</a> : value}
      </dd>
    </div>
  );
}

const safeHref = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : undefined);

export default function AdminHostDesk({ hotels }: { hotels: Hotel[] }) {
  const { user } = useAuth();
  const [view, setView] = useState<View>('requests');
  const [requests, setRequests] = useState<Row[]>([]);
  const [messages, setMessages] = useState<HostMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ListingRequestStatus | 'open' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [hostSearch, setHostSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [reqSnap, msgSnap, serverRes] = await Promise.allSettled([
      getDocs(collection(db, LISTING_REQUESTS_COLLECTION)),
      getDocs(collection(db, HOST_MESSAGES_COLLECTION)),
      fetch('/api/admin/surveys').then(r => (r.ok ? r.json() : null)),
    ]);
    const rows: Row[] = reqSnap.status === 'fulfilled'
      ? reqSnap.value.docs.map(d => ({ id: d.id, ...(d.data() as any), status: (d.data() as any).status || 'pending_review' }))
      : [];
    if (reqSnap.status === 'rejected') console.warn('[Hosts] Listing requests unavailable:', reqSnap.reason);
    const known = new Set(rows.flatMap(r => [r.id, r.ref].filter(Boolean) as string[]));
    if (serverRes.status === 'fulfilled' && Array.isArray(serverRes.value?.surveys)) {
      for (const s of serverRes.value.surveys) {
        if (s?.type !== 'host_enquiry' || !s.id || known.has(s.id)) continue;
        rows.push({
          ...s,
          id: s.id,
          ref: s.id,
          amenities: typeof s.amenities === 'string' ? s.amenities.split(',').map((a: string) => a.trim()).filter(Boolean) : s.amenities,
          createdAt: s.submittedAt,
          status: 'pending_review',
          serverOnly: true,
        });
      }
    }
    rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    setRequests(rows);
    if (msgSnap.status === 'fulfilled') {
      setMessages(msgSnap.value.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }) as HostMessage)
        .sort((a, b) => (b.sentAt || b.createdAt) - (a.sentAt || a.createdAt)));
    } else {
      console.warn('[Hosts] Message history unavailable:', msgSnap.reason);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = requests.find(r => r.id === selectedId) || null;
  useEffect(() => { setNotes(selected?.adminNotes || ''); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of requests) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [requests]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter(r =>
      (filter === 'all' || (filter === 'open' ? r.status === 'pending_review' || r.status === 'needs_info' : r.status === filter))
      && (!q || [r.propName, r.propLoc, r.contactName, r.contactEmail, r.ref, r.id].some(v => v?.toLowerCase().includes(q))));
  }, [requests, filter, search]);

  /** Saves a server-only request to Firestore before its first change. */
  const ensureSaved = async (r: Row) => {
    if (!r.serverOnly) return;
    const { serverOnly, id, ...rest } = r as any;
    const clean = Object.fromEntries(Object.entries(rest).filter(([k, v]) => v !== undefined && !['ip', 'userAgent', 'type', 'sourceDoc', 'submittedAt', 'emailSent', 'stayModel', 'declared'].includes(k)));
    await setDoc(doc(db, LISTING_REQUESTS_COLLECTION, id), { ...clean, ref: id, createdAt: r.createdAt || new Date().toISOString() });
  };

  const patchRequest = async (r: Row, patch: Partial<ListingRequest>) => {
    try {
      await ensureSaved(r);
      const full = { ...patch, updatedAt: Date.now(), reviewedBy: user?.email || '' };
      await updateDoc(doc(db, LISTING_REQUESTS_COLLECTION, r.id), full);
      setRequests(prev => prev.map(x => (x.id === r.id ? { ...x, ...full, serverOnly: false } : x)));
      return true;
    } catch (err) {
      console.error('[Hosts] Could not update request:', err);
      toast.error('Could not save. Check that the latest Firestore rules are published.');
      return false;
    }
  };

  const requestMessages = selected ? messages.filter(m => m.requestId === selected.id) : [];

  // Everyone we could email about a listing: manager, owner and the listing's own email.
  const hostRows = useMemo(() => {
    const q = hostSearch.trim().toLowerCase();
    return hotels
      .filter(h => !q || [h.name, h.location, h.managerName, h.managerEmail, h.ownerEmail, h.contactEmail].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [hotels, hostSearch]);
  const selectedHotel = hotels.find(h => h.id === selectedHotelId) || null;
  const hotelEmail = (h: Hotel) => h.managerEmail || h.ownerEmail || h.contactEmail || '';
  const lastSentFor = (pred: (m: HostMessage) => boolean) => messages.find(m => m.status === 'sent' && pred(m));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="tm-tabs" role="tablist" aria-label="Hosts">
          <button type="button" role="tab" aria-selected={view === 'requests'} onClick={() => setView('requests')}
            className={`tm-tab text-xs! py-1.5! cursor-pointer ${view === 'requests' ? 'tm-tab-active' : ''}`}>
            Listing requests
            {(counts.pending_review || 0) > 0 && <span className="tm-tag tm-tag-warn ml-1.5">{counts.pending_review}</span>}
          </button>
          <button type="button" role="tab" aria-selected={view === 'hosts'} onClick={() => setView('hosts')}
            className={`tm-tab text-xs! py-1.5! cursor-pointer ${view === 'hosts' ? 'tm-tab-active' : ''}`}>
            Message a host
          </button>
        </div>
        <button type="button" onClick={load} className="tm-btn tm-btn-quiet tm-btn-sm"><RefreshCw size={14} /> Refresh</button>
      </div>

      {view === 'requests' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4">
          {/* List */}
          <div className={`tm-panel p-0! min-w-0 ${selected ? 'hidden lg:block' : ''}`}>
            <div className="p-3 space-y-2 border-b border-stone-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search property, person, ref"
                  className="tm-input pl-8!" />
              </div>
              <div className="flex flex-wrap gap-1">
                {([['open', 'Open'], ...LISTING_REQUEST_STATUSES.map(s => [s.id, s.label]), ['all', 'All']] as [string, string][]).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setFilter(id as any)}
                    className={`px-2 py-0.5 rounded-full text-xs border cursor-pointer ${filter === id ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
                    {label}{id !== 'open' && id !== 'all' && counts[id] ? ` ${counts[id]}` : ''}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <p className="p-6 text-center tm-muted">Loading requests...</p>
            ) : visible.length === 0 ? (
              <div className="p-8 text-center tm-muted">
                <Inbox size={20} className="mx-auto mb-2 text-stone-400" />
                No listing requests here.
              </div>
            ) : (
              <ul className="divide-y divide-stone-100 max-h-[70vh] overflow-y-auto">
                {visible.map(r => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left px-3 py-2.5 cursor-pointer hover:bg-stone-50 ${selectedId === r.id ? 'bg-stone-100' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-stone-900 truncate">{r.propName || '(no name)'}</span>
                        <span className={`${STATUS_TAG[r.status] || 'tm-tag'} shrink-0`}>{statusLabel(r.status)}</span>
                      </div>
                      <div className="text-xs text-stone-500 truncate mt-0.5">
                        {[r.propLoc, r.contactName, fmtDate(toMillis(r.createdAt))].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detail */}
          {selected ? (
            <div className="tm-panel min-w-0 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <button type="button" onClick={() => setSelectedId(null)} className="tm-link text-xs inline-flex items-center gap-1 lg:hidden mb-1">
                    <ArrowLeft size={12} /> All requests
                  </button>
                  <h3 className="tm-h2 break-words">{selected.propName}</h3>
                  <p className="tm-muted text-xs mt-0.5">
                    Ref {selected.ref || selected.id} · received {fmtDate(toMillis(selected.createdAt))}
                    {selected.source ? ` · from ${selected.source}` : ''}
                    {selected.serverOnly ? ' · server copy' : ''}
                  </p>
                </div>
                <select value={selected.status} aria-label="Request status"
                  onChange={e => patchRequest(selected, { status: e.target.value as ListingRequestStatus })}
                  className="tm-input w-auto! text-sm">
                  {LISTING_REQUEST_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Field label="Type" value={selected.category} />
                <Field label="Travellers stay in" value={selected.stayType ? `${selected.stayType === 'rooms' ? 'Individual rooms' : 'The whole place'}${selected.roomCount ? ` · ${selected.roomCount} ${selected.stayType === 'rooms' ? 'rooms' : 'bedrooms'}` : ''}${selected.maxGuests ? ` · up to ${selected.maxGuests} guests` : ''}` : selected.roomCount} />
                <Field label="Town / area" value={selected.propLoc} />
                <Field label="Address / directions" value={selected.address} />
                <Field label="Map" value={selected.mapLink} href={safeHref(selected.mapLink)} />
                <Field label="From price" value={[selected.nightlyMwk && `MK ${selected.nightlyMwk}`, selected.nightlyUsd && `$${selected.nightlyUsd}`].filter(Boolean).join(' / ')} />
                <Field label="Photos" value={selected.photosLink} href={safeHref(selected.photosLink)} />
                <Field label="Website / social" value={selected.website} href={safeHref(selected.website)} />
                <Field label="Property phone" value={selected.propertyPhone} />
                <Field label="Property WhatsApp" value={selected.propertyWhatsapp} />
                <Field label="Property email" value={selected.propertyEmail} />
                <Field label="Facilities" value={selected.amenities?.join(', ')} />
              </dl>
              <Field label="Description" value={selected.description} />

              <div className="rounded-lg bg-stone-50 border border-stone-200 p-3">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <Field label="Sent by" value={`${selected.contactName || ''}${selected.contactRole ? ` (${selected.contactRole})` : ''}`} />
                  <Field label="Email" value={selected.contactEmail} href={`mailto:${selected.contactEmail}`} />
                  <Field label="Phone" value={selected.contactPhone} href={selected.contactPhone ? `tel:${selected.contactPhone.replace(/\s+/g, '')}` : undefined} />
                  <Field label="Declaration" value={selected.declarationAt ? `Confirmed ${fmtDate(toMillis(selected.declarationAt))}` : 'Not recorded (older request)'} />
                </dl>
                <Field label="Their notes" value={selected.notes} />
              </div>

              {missingItems(selected).length > 0 && (
                <div className="text-sm">
                  <p className="font-semibold text-stone-900">Still needed before it could go live</p>
                  <ul className="list-disc pl-5 text-stone-600 mt-1 space-y-0.5">
                    {missingItems(selected).map(m => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <label className="tm-label" htmlFor="host-desk-notes">Team notes (not sent)</label>
                <textarea id="host-desk-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} maxLength={4000}
                  className="tm-input resize-y" />
                {notes !== (selected.adminNotes || '') && (
                  <button type="button" onClick={async () => { if (await patchRequest(selected, { adminNotes: notes })) toast.success('Notes saved'); }}
                    className="tm-btn tm-btn-secondary tm-btn-sm mt-2">Save notes</button>
                )}
              </div>

              <div className="tm-divider pt-4">
                <h4 className="tm-h2 text-base mb-3">Email {selected.contactName || 'the host'}</h4>
                <HostEmailComposer
                  target={{
                    to: selected.contactEmail,
                    toName: selected.contactName,
                    propName: selected.propName,
                    ref: selected.ref || selected.id,
                    requestId: selected.id,
                    context: requestSummary(selected),
                    missing: missingItems(selected),
                  }}
                  templates={REQUEST_TEMPLATES}
                  messages={requestMessages}
                  onChanged={load}
                  onSent={async (template) => {
                    const next = template ? STATUS_AFTER_SEND[template] : undefined;
                    await patchRequest(selected, { lastEmailAt: Date.now(), ...(next ? { status: next } : {}) });
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="tm-panel hidden lg:flex items-center justify-center text-center tm-muted min-h-[12rem]">
              Choose a request to review it, add notes and reply.
            </div>
          )}
        </div>
      )}

      {view === 'hosts' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4">
          <div className={`tm-panel p-0! min-w-0 ${selectedHotel ? 'hidden lg:block' : ''}`}>
            <div className="p-3 border-b border-stone-100 relative">
              <Search size={14} className="absolute left-5.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={hostSearch} onChange={e => setHostSearch(e.target.value)} placeholder="Search listings or hosts"
                className="tm-input pl-8!" />
            </div>
            <ul className="divide-y divide-stone-100 max-h-[70vh] overflow-y-auto">
              {hostRows.map(h => {
                const last = lastSentFor(m => m.hotelId === h.id);
                return (
                  <li key={h.id}>
                    <button type="button" onClick={() => setSelectedHotelId(h.id!)}
                      className={`w-full text-left px-3 py-2.5 cursor-pointer hover:bg-stone-50 ${selectedHotelId === h.id ? 'bg-stone-100' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-stone-900 truncate">{h.name}</span>
                        <span className={`shrink-0 ${!h.status || h.status === 'approved' ? 'tm-tag tm-tag-good' : h.status === 'pending' ? 'tm-tag tm-tag-warn' : 'tm-tag tm-tag-bad'}`}>
                          {!h.status || h.status === 'approved' ? 'Live' : h.status === 'pending' ? 'Pending' : 'Rejected'}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 truncate mt-0.5">
                        {[h.managerName || h.ownerName, hotelEmail(h) || 'no email', last ? `last emailed ${fmtDate(last.sentAt || last.createdAt)}` : ''].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  </li>
                );
              })}
              {hostRows.length === 0 && <li className="p-6 text-center tm-muted">No listings match.</li>}
            </ul>
          </div>

          {selectedHotel ? (
            <div className="tm-panel min-w-0 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <button type="button" onClick={() => setSelectedHotelId(null)} className="tm-link text-xs inline-flex items-center gap-1 lg:hidden mb-1">
                    <ArrowLeft size={12} /> All hosts
                  </button>
                  <h3 className="tm-h2 break-words">{selectedHotel.name}</h3>
                  <p className="tm-muted text-xs mt-0.5">
                    {[selectedHotel.managerName || selectedHotel.ownerName, selectedHotel.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Link to={`/hotel/${selectedHotel.id}`} target="_blank" className="tm-btn tm-btn-quiet tm-btn-sm">
                  <ExternalLink size={14} /> View listing
                </Link>
              </div>
              {!hotelEmail(selectedHotel) && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  This listing has no host email on file. Type an address in the To field.
                </p>
              )}
              <HostEmailComposer
                target={{
                  to: hotelEmail(selectedHotel),
                  toName: selectedHotel.managerName || selectedHotel.ownerName,
                  propName: selectedHotel.name,
                  hotelId: selectedHotel.id,
                  hotelName: selectedHotel.name,
                  context: hotelSummary(selectedHotel),
                }}
                templates={HOST_TEMPLATES}
                messages={messages.filter(m => m.hotelId === selectedHotel.id)}
                onChanged={load}
              />
            </div>
          ) : (
            <div className="tm-panel hidden lg:flex items-center justify-center text-center tm-muted min-h-[12rem]">
              Choose a listing to email its host. Ulendo can draft the message from the listing details.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
