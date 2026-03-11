import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent, RecurrenceRule } from '../types';

interface Props {
  events: CalendarEvent[];
  addEvent: (event: CalendarEvent) => Promise<void>;
  updateEvent: (event: CalendarEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

const RECURRENCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

const COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6b7280', label: 'Grey' },
];

function formatRecurrence(r?: RecurrenceRule): string {
  if (!r) return 'One-time';
  if (typeof r === 'string') return r.charAt(0).toUpperCase() + r.slice(1);
  return `Custom (${r.days.join(', ')})`;
}

export function EventPanel({ events, addEvent, updateEvent, deleteEvent }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [recurrence, setRecurrence] = useState('none');
  const [color, setColor] = useState('#3b82f6');
  const [location, setLocation] = useState('');

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setStartTime('09:00');
    setEndTime('10:00');
    setRecurrence('none');
    setColor('#3b82f6');
    setLocation('');
    setEditingEvent(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setTitle(event.title);
    setDescription(event.description || '');
    setDate(event.date);
    setStartTime(event.startTime);
    setEndTime(event.endTime);
    setRecurrence(event.recurrence ? (typeof event.recurrence === 'string' ? event.recurrence : 'none') : 'none');
    setColor(event.color || '#3b82f6');
    setLocation(event.location || '');
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    const rec: RecurrenceRule | undefined = recurrence === 'none' ? undefined : recurrence as RecurrenceRule;

    if (editingEvent) {
      await updateEvent({
        ...editingEvent,
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        startTime,
        endTime,
        recurrence: rec,
        color,
        location: location.trim() || undefined,
      });
    } else {
      await addEvent({
        id: uuidv4(),
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        startTime,
        endTime,
        recurrence: rec,
        color,
        location: location.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    }

    setShowForm(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteEvent(id);
  };

  // Filter events
  const today = new Date().toISOString().split('T')[0];
  const filteredEvents = events
    .filter((e) => {
      if (filter === 'upcoming') return e.date >= today || e.recurrence;
      if (filter === 'past') return e.date < today && !e.recurrence;
      return true;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

  // Group by date
  const grouped = filteredEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const key = event.recurrence ? `Recurring` : event.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Events</h2>
          <span className="text-sm text-text-muted">{events.length} total</span>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New Event
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {(['upcoming', 'all', 'past'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'text-text-muted hover:text-text hover:bg-surface-hover'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Event list */}
      {filteredEvents.length === 0 && (
        <div className="text-center text-text-muted py-12">
          No events found. Create one to block time in your schedule.
        </div>
      )}

      {Object.entries(grouped).map(([dateKey, dateEvents]) => (
        <div key={dateKey} className="mb-4">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
            {dateKey === 'Recurring' ? 'Recurring Events' : formatDate(dateKey)}
          </h3>
          <div className="space-y-2">
            {dateEvents.map((event) => (
              <div
                key={event.id}
                className="bg-surface border border-border rounded-lg p-4 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-3 h-3 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: event.color || '#3b82f6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{event.title}</span>
                      {event.recurrence && (
                        <span className="text-xs bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded">
                          {formatRecurrence(event.recurrence)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-text-muted">
                      <span className="font-mono">{event.startTime} - {event.endTime}</span>
                      {event.location && (
                        <span className="truncate">{event.location}</span>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-sm text-text-muted mt-1 truncate">{event.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(event)}
                      className="text-xs px-2 py-1 rounded hover:bg-surface-hover text-text-muted"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="text-xs px-2 py-1 rounded hover:bg-surface-hover text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Create/Edit Event Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              {editingEvent ? 'Edit Event' : 'New Event'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Doctor's appointment, Meeting, etc."
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Repeat</label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Color</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setColor(opt.value)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        color === opt.value ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: opt.value }}
                      title={opt.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Office, Zoom link, etc."
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </button>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 bg-surface-hover text-text-muted rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}
