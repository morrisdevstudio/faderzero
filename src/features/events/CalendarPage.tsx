import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StatusPill } from '@/components/StatusPill';
import { eventsRepository } from '@/db/repositories/eventsRepository';
import type { EventRecord } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { EventFormModal } from './EventFormModal';

const EVENT_TYPE_LABELS: Record<string, string> = {
  rehearsal: 'Répétition',
  concert: 'Concert',
  meeting: 'Réunion',
  other: 'Autre',
};

const GROUP_COLOR_PALETTE = [
  '#00F0FF', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#E11D48', // Rose
  '#6366F1', // Indigo
];

function getWorkspaceColor(workspaceId: string, isPersonal: boolean, userId?: string): string {
  if (isPersonal || workspaceId === 'personal' || workspaceId === 'default-workspace') {
    return '#9D00FF'; // Personal Signature Purple
  }

  const storageKey = `fz_workspace_colors_${userId || 'guest'}`;
  let colorMap: Record<string, string> = {};

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      colorMap = JSON.parse(raw);
    }
  } catch {
    colorMap = {};
  }

  if (colorMap[workspaceId]) {
    return colorMap[workspaceId];
  }

  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    hash = workspaceId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % GROUP_COLOR_PALETTE.length;
  const assignedColor = GROUP_COLOR_PALETTE[colorIndex]!;

  colorMap[workspaceId] = assignedColor;
  try {
    localStorage.setItem(storageKey, JSON.stringify(colorMap));
  } catch {
    // ignore
  }

  return assignedColor;
}

// SVG icons as components
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}



const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function CalendarPage() {
  const { workspaces, session } = useAuthStore();
  const user = session?.user;
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [disabledWorkspaceIds, setDisabledWorkspaceIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMonthView, setIsMonthView] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [creationDate, setCreationDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBottomSheetEvent, setActiveBottomSheetEvent] = useState<EventRecord | null>(null);
  const [calendarFlowCompensation, setCalendarFlowCompensation] = useState(0);
  const collapseSentinelRef = useRef<HTMLDivElement | null>(null);
  const monthGridRef = useRef<HTMLDivElement | null>(null);
  const weekGridRef = useRef<HTMLDivElement | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await eventsRepository.listAll();
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  // Close filter popover on window click
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleOutsideClick = () => setIsFilterOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isFilterOpen]);

  const workspaceMap = useMemo(() => {
    const map = new Map<string, { name: string; type: 'personal' | 'group' }>();
    for (const ws of workspaces) {
      map.set(ws.id, { name: ws.name, type: ws.type });
    }
    return map;
  }, [workspaces]);

  const personalWorkspace = useMemo(() => workspaces.find((w) => w.type === 'personal'), [workspaces]);
  const personalWorkspaceId = personalWorkspace?.id || 'personal';
  const isPersonalEnabled = !disabledWorkspaceIds.has('personal') && !disabledWorkspaceIds.has(personalWorkspaceId);
  const personalAvatarUrl = (personalWorkspace as { avatarUrl?: string })?.avatarUrl || user?.user_metadata?.avatar_url;
  const personalInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'P';

  const groupWorkspaces = useMemo(() => {
    return workspaces.filter((w) => w.type === 'group');
  }, [workspaces]);

  const togglePersonalFilter = () => {
    setDisabledWorkspaceIds((prev) => {
      const next = new Set(prev);
      const currentlyDisabled = next.has('personal') || next.has(personalWorkspaceId);
      if (currentlyDisabled) {
        next.delete('personal');
        next.delete(personalWorkspaceId);
      } else {
        next.add('personal');
        next.add(personalWorkspaceId);
      }
      return next;
    });
  };

  const toggleGroupFilter = (groupId: string) => {
    setDisabledWorkspaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const wsInfo = workspaceMap.get(evt.workspaceId);
      const isPersonal = wsInfo?.type === 'personal' || evt.workspaceId === 'personal' || evt.workspaceId === 'default-workspace';

      if (isPersonal) {
        if (!isPersonalEnabled) return false;
      } else {
        if (disabledWorkspaceIds.has(evt.workspaceId)) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesTitle = evt.title.toLowerCase().includes(query);
        const matchesLocation = evt.location?.toLowerCase().includes(query) ?? false;
        const matchesNotes = evt.notes?.toLowerCase().includes(query) ?? false;
        const matchesType = (EVENT_TYPE_LABELS[evt.eventType] || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesLocation && !matchesNotes && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }, [events, isPersonalEnabled, disabledWorkspaceIds, searchQuery, workspaceMap]);

  // Month grid calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    const str = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [currentDate]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
    const daysInMonth = lastDayOfMonth.getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = new Date().toDateString();
    const days = [];

    // Prev month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({
        date,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: date.toDateString() === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: date.toDateString() === todayStr,
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: date.toDateString() === todayStr,
      });
    }

    return days;
  }, [year, month]);

  // Active week days calculations
  const activeWeekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
    startOfWeek.setDate(diff);

    const todayStr = new Date().toDateString();
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDays.push({
        date,
        dayNumber: date.getDate(),
        isToday: date.toDateString() === todayStr,
      });
    }
    return weekDays;
  }, [selectedDate]);

  const eventsByDayString = useMemo(() => {
    const map = new Map<string, EventRecord[]>();
    for (const evt of filteredEvents) {
      const dateKey = new Date(evt.startAt).toDateString();
      const list = map.get(dateKey) || [];
      list.push(evt);
      map.set(dateKey, list);
    }
    return map;
  }, [filteredEvents]);

  const handlePrevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    setCurrentDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(year, month + 1, 1);
    setCurrentDate(next);
  };

  const handleTodayMonth = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date);
  };

  const handleEditEvent = (event: EventRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedEvent(event);
    setCreationDate(null);
    setIsModalOpen(true);
    setActiveBottomSheetEvent(null); // Close bottom sheet
  };

  const handleCreateNew = (date?: Date) => {
    setSelectedEvent(null);
    setCreationDate(date || selectedDate || null);
    setIsModalOpen(true);
  };

  // Sort and filter feed events starting from selected date (midnight)
  const startOfSelectedDay = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [selectedDate]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => a.startAt - b.startAt);
  }, [filteredEvents]);

  const sortedEventsFiltered = useMemo(() => {
    return sortedEvents.filter(evt => evt.startAt >= startOfSelectedDay);
  }, [sortedEvents, startOfSelectedDay]);

  const getEventStyles = (evt: EventRecord, isPersonal: boolean) => {
    const color = getWorkspaceColor(evt.workspaceId, isPersonal, user?.id);
    const wsInfo = workspaceMap.get(evt.workspaceId);
    return {
      color,
      label: isPersonal ? 'Perso' : wsInfo?.name || EVENT_TYPE_LABELS[evt.eventType] || 'Groupe',
    };
  };

  const groupedEvents = useMemo(() => {
    const dateGroups = new Map<string, EventRecord[]>();

    for (const evt of sortedEventsFiltered) {
      const dateKey = new Date(evt.startAt).toDateString();
      const list = dateGroups.get(dateKey) || [];
      list.push(evt);
      dateGroups.set(dateKey, list);
    }

    const sortedKeys = Array.from(dateGroups.keys()).sort((a, b) => {
      const listA = dateGroups.get(a);
      const listB = dateGroups.get(b);
      const firstA = listA ? listA[0] : undefined;
      const firstB = listB ? listB[0] : undefined;
      const timeA = firstA ? firstA.startAt : 0;
      const timeB = firstB ? firstB.startAt : 0;
      return timeA - timeB;
    });

    const groups = [];
    for (const key of sortedKeys) {
      const evts = dateGroups.get(key) || [];
      const firstEvt = evts[0];
      const dateObj = new Date(firstEvt ? firstEvt.startAt : 0);
      const isToday = dateObj.toDateString() === new Date().toDateString();
      
      let dateLabel = dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
      if (isToday) {
        dateLabel += " (Aujourd'hui)";
      }

      groups.push({
        dateKey: key,
        dateLabel,
        events: evts,
      });
    }

    return groups;
  }, [sortedEventsFiltered]);

  // Selected date events count
  const selectedDayEventsCount = useMemo(() => {
    return eventsByDayString.get(selectedDate.toDateString())?.length || 0;
  }, [eventsByDayString, selectedDate]);

  useEffect(() => {
    const sentinel = collapseSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setIsMonthView(entry.isIntersecting);
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const monthGrid = monthGridRef.current;
    const weekGrid = weekGridRef.current;
    if (!monthGrid || !weekGrid) return;

    const updateCompensation = () => {
      const nextCompensation = isMonthView
        ? 0
        : Math.max(0, Math.ceil(monthGrid.getBoundingClientRect().height - weekGrid.getBoundingClientRect().height));
      setCalendarFlowCompensation((current) => current === nextCompensation ? current : nextCompensation);
    };

    updateCompensation();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateCompensation);
    observer.observe(monthGrid);
    observer.observe(weekGrid);
    return () => observer.disconnect();
  }, [isMonthView]);

  return (
    <div className="relative pb-24 text-slate-200">
      <div
        ref={collapseSentinelRef}
        aria-hidden="true"
        data-calendar-collapse-sentinel
        className="pointer-events-none absolute left-0 top-[140px] h-px w-px"
      />
      {/* STICKY TOP SEARCH HEADER */}
      <section
        className="sticky z-30 -mx-4 -mt-5 mb-4 border-b border-[#222636]/30 bg-[#090A0F]/95 backdrop-blur-md px-4 pb-3 pt-2"
        style={{
          top: 'calc(var(--fz-header-height, 64px) + var(--fz-viewport-offset-top, 0px))',
        }}
      >
        {/* Header Title & Plus button */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-[2rem] font-black tracking-tight text-white">Événements</h1>
          <button
            type="button"
            onClick={() => handleCreateNew()}
            aria-label="Nouvel événement"
            className="fz-button-primary h-11 w-11 shrink-0 p-0"
          >
            <PlusIcon />
          </button>
        </div>

        {/* Search box & Filter Trigger */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un événement..."
            className="fz-input min-w-0 flex-1 text-sm"
          />

          {/* Standard Filter Icon Trigger Button */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFilterOpen(!isFilterOpen);
              }}
              aria-label="Filtrer les événements"
              title="Filtrer les événements"
              className="flex h-10 w-10 items-center justify-center text-white/65 transition hover:text-white shrink-0"
            >
              <FilterIcon />
            </button>

            {/* Filter Popup Dialog */}
            {isFilterOpen &&
              createPortal(
                <div
                  className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setIsFilterOpen(false);
                    }
                  }}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="filter-dialog-title"
                    className="fz-card w-full max-w-md rounded-[1.6rem] p-5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h2 id="filter-dialog-title" className="text-[1.28rem] font-black tracking-tight text-white">
                          Filtrer par espace
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsFilterOpen(false)}
                        aria-label="Fermer"
                        className="fz-dialog-close"
                      >
                        &times;
                      </button>
                    </div>

                    <div role="menu" className="space-y-2">
                      {/* Perso Option */}
                      <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={isPersonalEnabled}
                        onClick={togglePersonalFilter}
                        className="min-h-12 w-full rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-white hover:bg-white/10 transition flex items-center justify-between select-none cursor-pointer"
                      >
                        <span className="flex items-center gap-3 truncate">
                          {personalAvatarUrl ? (
                            <img
                              src={personalAvatarUrl}
                              alt="Perso"
                              className="w-6.5 h-6.5 rounded-full object-cover border border-white/10 shrink-0"
                            />
                          ) : (
                            <span className="w-6.5 h-6.5 rounded-full bg-[#9D00FF]/20 border border-[#9D00FF]/40 text-[#9D00FF] text-[10px] font-bold flex items-center justify-center shrink-0">
                              {personalInitial}
                            </span>
                          )}
                          <span className="truncate">Événements Personnels</span>
                        </span>

                        <input
                          type="checkbox"
                          checked={isPersonalEnabled}
                          onChange={() => {}}
                          className="w-4.5 h-4.5 rounded border-white/20 accent-purple-600 cursor-pointer pointer-events-none"
                        />
                      </button>

                      {/* Group Workspace Options */}
                      {groupWorkspaces.map((g) => {
                        const isGroupEnabled = !disabledWorkspaceIds.has(g.id);
                        const groupAvatarUrl = (g as { avatarUrl?: string }).avatarUrl;
                        const groupColor = getWorkspaceColor(g.id, false, user?.id);

                        return (
                          <button
                            key={g.id}
                            type="button"
                            role="menuitemcheckbox"
                            aria-checked={isGroupEnabled}
                            onClick={() => toggleGroupFilter(g.id)}
                            className="min-h-12 w-full rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-black uppercase leading-5 tracking-[0.12em] text-white hover:bg-white/10 transition flex items-center justify-between select-none cursor-pointer"
                          >
                            <span className="flex items-center gap-3 truncate">
                              {groupAvatarUrl ? (
                                <img
                                  src={groupAvatarUrl}
                                  alt={g.name}
                                  className="w-6.5 h-6.5 rounded-full object-cover border border-white/10 shrink-0"
                                />
                              ) : (
                                <span
                                  style={{
                                    backgroundColor: `${groupColor}25`,
                                    borderColor: `${groupColor}60`,
                                    color: groupColor,
                                  }}
                                  className="w-6.5 h-6.5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border"
                                >
                                  {g.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                              <span className="truncate">{g.name}</span>
                            </span>

                            <input
                              type="checkbox"
                              checked={isGroupEnabled}
                              onChange={() => {}}
                              className="w-4.5 h-4.5 rounded border-white/20 accent-purple-600 cursor-pointer pointer-events-none"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>,
                document.body
              )}
          </div>
        </div>

        {/* ACCORDION CALENDAR CARD (100% FIXED IN STICKY HEADER SHELL) */}
        <div className="bg-[#13151F] border border-[#222636] rounded-2xl p-4 shadow-xl mt-3">
          {/* Calendar Header with selected info & toggle */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-white/8">
            {/* Left: Today button & selected date badge */}
            <div className="flex items-center gap-1.5 min-w-[70px] sm:min-w-[150px] shrink-0">
              <button
                type="button"
                onClick={handleTodayMonth}
                className="fz-button-secondary px-2.5 py-1 text-xs font-bold"
              >
                Auj.
              </button>
              <span className="text-xs text-purple-300 bg-purple-600/20 px-2 py-0.5 rounded-full border border-purple-500/30 font-bold hidden sm:inline-block">
                {selectedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ({selectedDayEventsCount})
              </span>
            </div>

            {/* Center: Fixed-width Month Year Frame with Fixed Arrows */}
            <div className="flex items-center justify-center min-w-0 flex-1">
              <div className="flex items-center justify-between w-[200px] shrink-0">
                <div className="w-8 shrink-0 flex justify-center">
                  {isMonthView && (
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      aria-label="Mois précédent"
                      title="Mois précédent"
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <ChevronLeftIcon />
                    </button>
                  )}
                </div>
                <h2 className="text-base font-black text-white tracking-tight truncate text-center flex-1 px-1">
                  {monthName}
                </h2>
                <div className="w-8 shrink-0 flex justify-center">
                  {isMonthView && (
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      aria-label="Mois suivant"
                      title="Mois suivant"
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <ChevronRightIcon />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Collapse/Expand chevron arrow */}
            <div className="flex items-center justify-end min-w-[70px] sm:min-w-[150px] shrink-0">
              <button
                type="button"
                onClick={() => setIsMonthView(!isMonthView)}
                aria-label={isMonthView ? "Réduire le calendrier" : "Déplier le calendrier"}
                title={isMonthView ? "Réduire le calendrier" : "Déplier le calendrier"}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                {isMonthView ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
            {WEEKDAYS.map((day, idx) => (
              <div key={idx}>{day}</div>
            ))}
          </div>

          {/* Month grid view */}
          <div
            aria-hidden={!isMonthView}
            inert={!isMonthView}
            className={[
              'overflow-hidden',
              isMonthView ? 'max-h-[300px] visible' : 'invisible max-h-0 pointer-events-none',
            ].join(' ')}
          >
            <div ref={monthGridRef} className="grid grid-cols-7 gap-1 text-sm">
              {calendarDays.map((item, idx) => {
                const dayEvents = eventsByDayString.get(item.date.toDateString()) || [];
                const isSelected = selectedDate.toDateString() === item.date.toDateString();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDate(item.date)}
                    className={[
                      'aspect-square rounded-xl hover:bg-[#1B1E2B] flex flex-col items-center justify-center relative transition-all duration-150 p-1',
                      item.isCurrentMonth ? 'text-zinc-200' : 'text-zinc-600 opacity-40',
                      isSelected
                        ? 'bg-purple-600/25 border-2 border-purple-500 text-white font-bold shadow-[0_0_12px_rgba(124,58,237,0.4)] scale-105 z-10'
                        : 'border border-transparent',
                      item.isToday && !isSelected ? 'bg-[#1B1E2B] border border-[#222636]' : '',
                    ].join(' ')}
                  >
                    {item.isToday && !isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-[#FF2A6D] text-white font-bold text-xs flex items-center justify-center shadow-[0_0_8px_rgba(255,42,109,0.4)]">
                        {item.dayNumber}
                      </span>
                    ) : (
                      <span className={isSelected ? 'text-purple-300 font-black text-sm' : 'text-xs font-semibold'}>
                        {item.dayNumber}
                      </span>
                    )}

                    {/* Dots representing workspace colors */}
                    {dayEvents.length > 0 && (
                      <div className="flex gap-1 mt-0.5 max-w-full overflow-hidden shrink-0">
                        {dayEvents.slice(0, 3).map((evt) => {
                          const wsInfo = workspaceMap.get(evt.workspaceId);
                          const isPersonal = wsInfo?.type === 'personal' || evt.workspaceId === 'personal' || evt.workspaceId === 'default-workspace';
                          const dotColor = getWorkspaceColor(evt.workspaceId, isPersonal, user?.id);

                          return (
                            <span
                              key={evt.id}
                              style={{ backgroundColor: dotColor }}
                              className="w-1.5 h-1.5 rounded-full"
                            />
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Week grid view */}
          <div
            aria-hidden={isMonthView}
            inert={isMonthView}
            className={[
              'overflow-hidden',
              !isMonthView ? 'max-h-[90px] visible' : 'invisible max-h-0 pointer-events-none',
            ].join(' ')}
          >
            <div ref={weekGridRef} className="grid grid-cols-7 gap-1 text-sm">
              {activeWeekDays.map((item, idx) => {
                const dayEvents = eventsByDayString.get(item.date.toDateString()) || [];
                const isSelected = selectedDate.toDateString() === item.date.toDateString();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDate(item.date)}
                    className={[
                      'aspect-square rounded-xl hover:bg-[#1B1E2B] flex flex-col items-center justify-center relative transition-all duration-150 p-1',
                      isSelected
                        ? 'bg-purple-600/25 border-2 border-purple-500 text-white font-bold shadow-[0_0_12px_rgba(124,58,237,0.4)] scale-105 z-10'
                        : 'border border-transparent text-zinc-300',
                      item.isToday && !isSelected ? 'bg-[#1B1E2B] border border-[#222636]' : '',
                    ].join(' ')}
                  >
                    {item.isToday && !isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-[#FF2A6D] text-white font-bold text-xs flex items-center justify-center shadow-[0_0_8px_rgba(255,42,109,0.4)]">
                        {item.dayNumber}
                      </span>
                    ) : (
                      <span className={isSelected ? 'text-purple-300 font-black text-sm' : 'text-xs font-semibold'}>
                        {item.dayNumber}
                      </span>
                    )}

                    {/* Dots representing workspace colors */}
                    {dayEvents.length > 0 && (
                      <div className="flex gap-1 mt-0.5 max-w-full overflow-hidden shrink-0">
                        {dayEvents.slice(0, 3).map((evt) => {
                          const wsInfo = workspaceMap.get(evt.workspaceId);
                          const isPersonal = wsInfo?.type === 'personal' || evt.workspaceId === 'personal' || evt.workspaceId === 'default-workspace';
                          const dotColor = getWorkspaceColor(evt.workspaceId, isPersonal, user?.id);

                          return (
                            <span
                              key={evt.id}
                              style={{ backgroundColor: dotColor }}
                              className="w-1.5 h-1.5 rounded-full"
                            />
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FEED LIST AREA */}
      <div
        className="space-y-3"
        style={{ paddingTop: `calc(0.25rem + ${calendarFlowCompensation}px)` }}
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">Chargement des événements...</div>
        ) : groupedEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center bg-[#13151F]/40 backdrop-blur-sm">
            <p className="text-sm text-zinc-500">
              {searchQuery || disabledWorkspaceIds.size > 0
                ? 'Aucun événement ne correspond à vos filtres.'
                : 'Aucun événement prévu pour le moment.'}
            </p>
            <button
              onClick={() => handleCreateNew()}
              className="mt-3 text-xs font-bold text-purple-400 hover:underline"
            >
              Créer un événement
            </button>
          </div>
        ) : (
          groupedEvents.map((group) => (
            <div key={group.dateKey} className="space-y-2">
              {/* Day header */}
              <div className="pt-1">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {group.dateLabel}
                </span>
              </div>

              {/* Event cards in this day */}
              <div className="space-y-2">
                {group.events.map((evt) => {
                  const wsInfo = workspaceMap.get(evt.workspaceId);
                  const isPersonal = wsInfo?.type === 'personal' || evt.workspaceId === 'personal' || evt.workspaceId === 'default-workspace';
                  const styleMeta = getEventStyles(evt, isPersonal);

                  const startVal = new Date(evt.startAt);
                  const startStr = startVal.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  let timeRangeStr = startStr;
                  if (evt.endAt) {
                    const endVal = new Date(evt.endAt);
                    const endStr = endVal.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    timeRangeStr = `${startStr} - ${endStr}`;
                  }

                  const spaceBadgeText = isPersonal
                    ? 'Perso'
                    : wsInfo?.name
                    ? wsInfo.name
                    : 'Groupe';

                  const color = styleMeta.color;

                  return (
                    <div
                      key={evt.id}
                      onClick={() => setActiveBottomSheetEvent(evt)}
                      style={{ borderLeftColor: color }}
                      className="fz-card block rounded-[1.2rem] px-4 py-3.5 border-l-4 transition hover:border-[var(--fz-border-strong)] cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[1.12rem] font-black tracking-tight text-white" title={evt.title}>
                            {evt.title}
                          </h2>
                          <p className="mt-2 truncate whitespace-nowrap text-[0.82rem] text-[var(--fz-text-muted)] flex items-center gap-1.5">
                            <span className="font-mono font-bold shrink-0 flex items-center gap-1">
                              <ClockIcon /> {timeRangeStr}
                            </span>
                            {evt.location && (
                              <>
                                <span>·</span>
                                <span className="truncate flex items-center gap-1">
                                  <LocationIcon /> {evt.location}
                                </span>
                              </>
                            )}
                          </p>
                        </div>

                        {/* Event tag */}
                        <div className="flex shrink-0 items-start pt-0.5">
                          <StatusPill
                            label={spaceBadgeText}
                            style={{ backgroundColor: `${color}15`, borderColor: `${color}40`, color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MOBILE BOTTOM SHEET DRAWER */}
      {/* Event Details Modal matching EventFormModal form fields (readOnly) */}
      {activeBottomSheetEvent && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveBottomSheetEvent(null);
            }
          }}
        >
          <div className="fz-card w-full max-w-md rounded-[1.6rem] p-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-[1.35rem] font-black tracking-tight text-white">
                Détails de l’événement
              </h2>
              <button
                type="button"
                onClick={() => setActiveBottomSheetEvent(null)}
                aria-label="Fermer"
                className="fz-dialog-close"
              >
                &times;
              </button>
            </div>

            {/* Event Information as Form Controls (ReadOnly) */}
            {(() => {
              const wsInfo = workspaceMap.get(activeBottomSheetEvent.workspaceId);
              const isPersonal = wsInfo?.type === 'personal' || activeBottomSheetEvent.workspaceId === 'personal' || activeBottomSheetEvent.workspaceId === 'default-workspace';

              const startVal = new Date(activeBottomSheetEvent.startAt);
              const startYear = startVal.getFullYear();
              const startMonth = String(startVal.getMonth() + 1).padStart(2, '0');
              const startDay = String(startVal.getDate()).padStart(2, '0');
              const startDateStr = `${startDay}-${startMonth}-${startYear}`;
              const startTimeStr = startVal.toTimeString().slice(0, 5);

              let endDateStr = '';
              let endTimeStr = '';
              if (activeBottomSheetEvent.endAt) {
                const endVal = new Date(activeBottomSheetEvent.endAt);
                const endYear = endVal.getFullYear();
                const endMonth = String(endVal.getMonth() + 1).padStart(2, '0');
                const endDay = String(endVal.getDate()).padStart(2, '0');
                endDateStr = `${endDay}-${endMonth}-${endYear}`;
                endTimeStr = endVal.toTimeString().slice(0, 5);
              }

              const spaceBadgeText = isPersonal
                ? 'Perso'
                : wsInfo?.name
                ? wsInfo.name
                : 'Groupe';

              const readOnlyClass = "w-full rounded-2xl bg-white/[0.04] p-3 text-xs text-white border-0 !border-0 border-none !border-none outline-none focus:outline-none focus:ring-0 appearance-none shadow-none pointer-events-none select-none";

              return (
                <div className="mt-4 space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Titre de l’événement
                    </label>
                    <input
                      type="text"
                      value={activeBottomSheetEvent.title}
                      readOnly
                      tabIndex={-1}
                      className={readOnlyClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Espace / Groupe
                    </label>
                    <input
                      type="text"
                      value={spaceBadgeText}
                      readOnly
                      tabIndex={-1}
                      className={readOnlyClass}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        Type
                      </label>
                      <select
                        value={activeBottomSheetEvent.eventType}
                        disabled
                        tabIndex={-1}
                        className={`${readOnlyClass} opacity-90`}
                      >
                        <option value="rehearsal">Répétition</option>
                        <option value="concert">Concert</option>
                        <option value="meeting">Réunion</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        Lieu
                      </label>
                      <input
                        type="text"
                        value={activeBottomSheetEvent.location || ''}
                        readOnly
                        tabIndex={-1}
                        placeholder="--"
                        className={readOnlyClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        Date de début
                      </label>
                      <input
                        type="text"
                        value={startDateStr}
                        readOnly
                        tabIndex={-1}
                        className={readOnlyClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        Heure de début
                      </label>
                      <input
                        type="text"
                        value={startTimeStr}
                        readOnly
                        tabIndex={-1}
                        className={readOnlyClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        Date de fin (optionnelle)
                      </label>
                      <input
                        type="text"
                        value={endDateStr || '--'}
                        readOnly
                        tabIndex={-1}
                        className={readOnlyClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        Heure de fin
                      </label>
                      <input
                        type="text"
                        value={endTimeStr || '--'}
                        readOnly
                        tabIndex={-1}
                        className={readOnlyClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={activeBottomSheetEvent.notes || ''}
                      readOnly
                      tabIndex={-1}
                      rows={3}
                      placeholder="--"
                      className={`${readOnlyClass} resize-none`}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer Buttons matching EventFormModal */}
            <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-4">
              <button
                type="button"
                onClick={async () => {
                  if (!activeBottomSheetEvent) return;
                  const targetId = activeBottomSheetEvent.id;
                  setActiveBottomSheetEvent(null);
                  await eventsRepository.softDelete(targetId);
                  loadEvents();
                }}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20"
              >
                Supprimer
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveBottomSheetEvent(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetEvent = activeBottomSheetEvent;
                    setActiveBottomSheetEvent(null);
                    handleEditEvent(targetEvent);
                  }}
                  className="fz-button-primary px-4 py-2 text-xs font-bold"
                >
                  Modifier
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create/Edit Form Modal */}
      <EventFormModal
        event={selectedEvent}
        initialDate={creationDate}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadEvents}
      />
    </div>
  );
}
