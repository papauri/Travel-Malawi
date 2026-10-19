import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hotel, User, Role } from '../types';
import Modal from './Modal';
import { 
  Search, UserCheck, Building2, MapPin, Shield, CheckCircle2, 
  AlertCircle, Users, ArrowRight, Eye, RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ManagerItem {
  user: User;
  properties: Hotel[];
  propertiesCount: number;
  totalRooms: number;
}

export default function ShadowManagerModal({ open, onClose }: Props) {
  const { user: currentUser, actualUser, isShadowing, shadowManager } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [isShadowingInProgress, setIsShadowingInProgress] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const fetchManagersAndProperties = async () => {
      setLoading(true);
      try {
        // Fetch hotels
        const hotelsSnap = await getDocs(collection(db, 'hotels'));
        const allHotels = hotelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));

        // Fetch users with hotel_manager or admin roles
        let allUsers: User[] = [];
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User));
        } catch (e) {
          console.warn('[ShadowModal] Direct users query restricted, deriving from hotels:', e);
        }

        const managerMap = new Map<string, ManagerItem>();
        const usersByUid = new Map<string, User>();
        const usersByEmail = new Map<string, User>();

        // 1. Seed from registered users that have hotel_manager role
        for (const u of allUsers) {
          usersByUid.set(u.uid, u);
          if (u.email) {
            usersByEmail.set(u.email.trim().toLowerCase(), u);
          }
          const roles = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
          if (roles.includes('hotel_manager') || roles.includes('admin') || roles.includes('marketing')) {
            managerMap.set(u.uid, {
              user: { ...u },
              properties: [],
              propertiesCount: 0,
              totalRooms: 0,
            });
          }
        }

        // 2. Associate hotels with their true host manager (prioritizing host email when onboarded by an admin)
        for (const h of allHotels) {
          const rawManagerId = h.managerId && h.managerId !== 'unassigned' && h.managerId !== 'none'
            ? h.managerId
            : null;
          const rawEmail = (h.managerEmail || h.ownerEmail || h.contactEmail || '').trim().toLowerCase();
          const uidOwner = rawManagerId ? usersByUid.get(rawManagerId) : undefined;
          const uidOwnerEmail = (uidOwner?.email || '').trim().toLowerCase();
          const uidOwnerRoles = uidOwner
            ? (Array.isArray(uidOwner.roles) ? uidOwner.roles : (uidOwner.role ? [uidOwner.role] : []))
            : [];
          const isUidStaffAccount = uidOwnerRoles.includes('admin') || uidOwnerRoles.includes('marketing') || rawManagerId === actualUser?.uid;

          let entry: ManagerItem | undefined;

          // If the property specifies a host email that differs from an admin/staff creator's email, group by the host email!
          if (rawEmail && (!rawManagerId || isUidStaffAccount) && rawEmail !== uidOwnerEmail) {
            const matchedUserByEmail = usersByEmail.get(rawEmail);
            if (matchedUserByEmail && matchedUserByEmail.uid !== actualUser?.uid) {
              entry = managerMap.get(matchedUserByEmail.uid);
              if (!entry) {
                entry = {
                  user: { ...matchedUserByEmail },
                  properties: [],
                  propertiesCount: 0,
                  totalRooms: 0,
                };
                managerMap.set(matchedUserByEmail.uid, entry);
              }
            } else {
              const syntheticKey = `shadow_email_${rawEmail}`;
              entry = managerMap.get(syntheticKey);
              if (!entry) {
                const hostDisplayName =
                  (h as any).managerName ||
                  (h as any).ownerName ||
                  h.name ||
                  rawEmail.split('@')[0];
                const hostUser: User = {
                  uid: `shadow_host_${rawEmail.replace(/[^a-z0-9]/gi, '_')}`,
                  email: rawEmail,
                  displayName: hostDisplayName,
                  role: 'hotel_manager',
                  roles: ['hotel_manager'],
                  createdAt: Date.now(),
                };
                entry = {
                  user: hostUser,
                  properties: [],
                  propertiesCount: 0,
                  totalRooms: 0,
                };
                managerMap.set(syntheticKey, entry);
              }
            }
          } else if (rawManagerId && managerMap.has(rawManagerId)) {
            entry = managerMap.get(rawManagerId);
          } else if (rawEmail) {
            const matchedUserByEmail = usersByEmail.get(rawEmail);
            const key = matchedUserByEmail ? matchedUserByEmail.uid : `shadow_email_${rawEmail}`;
            entry = managerMap.get(key);
            if (!entry) {
              const safeUid =
                matchedUserByEmail?.uid ||
                (rawManagerId && rawManagerId !== actualUser?.uid
                  ? rawManagerId
                  : `shadow_host_${rawEmail.replace(/[^a-z0-9]/gi, '_')}`);
              const hostUser: User = matchedUserByEmail || {
                uid: safeUid,
                email: rawEmail,
                displayName: (h as any).managerName || (h as any).ownerName || h.name || rawEmail.split('@')[0],
                role: 'hotel_manager',
                roles: ['hotel_manager'],
                createdAt: Date.now(),
              };
              entry = {
                user: hostUser,
                properties: [],
                propertiesCount: 0,
                totalRooms: 0,
              };
              managerMap.set(key, entry);
            }
          } else if (rawManagerId) {
            entry = managerMap.get(rawManagerId);
            if (!entry) {
              const hostUser: User = {
                uid: rawManagerId === actualUser?.uid ? `shadow_host_${h.id}` : rawManagerId,
                email: `${(h.name || 'host').toLowerCase().replace(/[^a-z0-9]+/g, '')}@host.local`,
                displayName: (h as any).managerName || (h as any).ownerName || `${h.name} Host`,
                role: 'hotel_manager',
                roles: ['hotel_manager'],
                createdAt: Date.now(),
              };
              entry = {
                user: hostUser,
                properties: [],
                propertiesCount: 0,
                totalRooms: 0,
              };
              managerMap.set(rawManagerId, entry);
            }
          }

          if (entry) {
            entry.properties.push(h);
            entry.propertiesCount = entry.properties.length;
            const propIds = entry.properties.map(p => p.id).filter(Boolean) as string[];
            (entry.user as any).managedHotelIds = propIds;
          }
        }

        // Convert to sorted list: hosts with properties first, then alphabetically
        const list = Array.from(managerMap.values())
          .filter(item => {
            // Hide pure admin/staff accounts that have 0 properties assigned so list stays clean
            if (item.user.uid === actualUser?.uid && item.propertiesCount === 0) return false;
            return true;
          })
          .sort((a, b) => {
            if (b.propertiesCount !== a.propertiesCount) {
              return b.propertiesCount - a.propertiesCount;
            }
            const nameA = a.user.displayName || a.user.email || '';
            const nameB = b.user.displayName || b.user.email || '';
            return nameA.localeCompare(nameB);
          });

        if (isMounted) {
          setManagers(list);
        }
      } catch (err: any) {
        console.error('Failed to load managers for shadow selection:', err);
        toast.error('Failed to load property managers.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchManagersAndProperties();
    return () => {
      isMounted = false;
    };
  }, [open, actualUser?.uid]);

  // Extract distinct locations for quick filter pills
  const locations = useMemo(() => {
    const locSet = new Set<string>();
    for (const m of managers) {
      for (const p of m.properties) {
        if (p.location) {
          // Keep primary part of location e.g. "Cape Maclear" from "Cape Maclear, Lake Malawi"
          const primary = p.location.split(',')[0].trim();
          if (primary) locSet.add(primary);
        }
      }
    }
    return Array.from(locSet).slice(0, 8);
  }, [managers]);

  const filteredManagers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return managers.filter(m => {
      const userName = (m.user.displayName || '').toLowerCase();
      const userEmail = (m.user.email || '').toLowerCase();
      const propertyNames = m.properties.map(p => (p.name || '').toLowerCase()).join(' ');
      const propertyLocations = m.properties.map(p => `${p.location || ''} ${(p as any).city || ''}`).join(' ').toLowerCase();

      const matchesSearch = !term ||
        userName.includes(term) ||
        userEmail.includes(term) ||
        propertyNames.includes(term) ||
        propertyLocations.includes(term);

      const matchesLocation = selectedLocation === 'all' ||
        m.properties.some(p => p.location?.toLowerCase().includes(selectedLocation.toLowerCase()));

      return matchesSearch && matchesLocation;
    });
  }, [managers, searchTerm, selectedLocation]);

  const handleSelectShadow = async (target: User) => {
    setIsShadowingInProgress(target.uid);
    try {
      await shadowManager(target);
      onClose();
      const hotelIds = (target as any).managedHotelIds as string[] | undefined;
      if (hotelIds && hotelIds.length === 1) {
        navigate(`/dashboard/hotel/${hotelIds[0]}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Failed to shadow manager:', err);
      toast.error(err?.message || "Couldn't switch to that host. Please try again.");
    } finally {
      setIsShadowingInProgress(null);
    }
  };

  const chipClass = (active: boolean) =>
    `tm-btn tm-btn-sm ${active ? 'tm-btn-primary' : 'tm-btn-secondary'}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="View as a host"
      description="See the site exactly as a property manager sees it, to help them or check their setup."
      size="3xl"
    >
      <div className="space-y-4 text-stone-900 min-w-0">
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, property or town"
              aria-label="Search hosts"
              className="tm-input pl-9 pr-16"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 tm-btn tm-btn-quiet tm-btn-sm"
              >
                Clear
              </button>
            )}
          </div>

          {locations.length > 0 && (
            <div className="tm-actions">
              <button type="button" onClick={() => setSelectedLocation('all')} className={chipClass(selectedLocation === 'all')}>
                All areas
              </button>
              {locations.map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setSelectedLocation(selectedLocation === loc ? 'all' : loc)}
                  className={chipClass(selectedLocation === loc)}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="py-12 flex items-center justify-center gap-2 tm-muted">
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Loading hosts...</span>
          </div>
        )}

        {!loading && filteredManagers.length === 0 && (
          <div className="py-10 text-center">
            <Users className="w-6 h-6 text-stone-400 mx-auto mb-2" aria-hidden="true" />
            <p className="tm-muted">
              {searchTerm
                ? `No host matches "${searchTerm}". Try a property name or town.`
                : 'No property managers have signed up yet.'}
            </p>
          </div>
        )}

        {!loading && filteredManagers.length > 0 && (
          <ul className="max-h-[55vh] overflow-y-auto divide-y divide-stone-200 border-y border-stone-200">
            {filteredManagers.map(({ user: mUser, properties, propertiesCount }) => {
              const initials = mUser.displayName
                ? mUser.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                : (mUser.email?.[0]?.toUpperCase() || 'H');

              const isCurrent = Boolean(
                isShadowing &&
                currentUser?.uid === mUser.uid &&
                (currentUser?.email || '').toLowerCase() === (mUser.email || '').toLowerCase()
              );
              const isShadowingThis = isShadowingInProgress === mUser.uid;

              return (
                <li
                  key={`${mUser.uid}_${mUser.email}`}
                  className="py-3 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-semibold text-xs shrink-0" aria-hidden="true">
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-stone-900 truncate">
                          {mUser.displayName || mUser.email}
                        </span>
                        {propertiesCount > 0 && (
                          <span className="tm-tag">
                            {propertiesCount} {propertiesCount === 1 ? 'property' : 'properties'}
                          </span>
                        )}
                        {isCurrent && <span className="tm-tag tm-tag-warn">Viewing now</span>}
                      </div>

                      <div className="text-xs text-stone-500 truncate mt-0.5">{mUser.email}</div>

                      {properties.length > 0 && (
                        <p className="text-xs text-stone-600 mt-1 break-words">
                          {properties.map((p, i) => (
                            <span key={p.id}>
                              {i > 0 && ' · '}
                              {p.name}
                              {p.location && <span className="text-stone-400"> ({p.location.split(',')[0]})</span>}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isCurrent || isShadowingThis}
                    onClick={() => handleSelectShadow(mUser)}
                    className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                  >
                    {isShadowingThis ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Switching...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>View as host</span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-stone-500">Everything you do while viewing as a host is logged.</span>
          <button type="button" onClick={onClose} className="tm-btn tm-btn-quiet tm-btn-sm">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
