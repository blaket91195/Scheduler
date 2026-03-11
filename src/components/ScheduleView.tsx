import { useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Task, ScheduleEntry, ScheduleConfig, Category, CalendarEvent } from '../types';
import { generateSchedule, pushScheduleBack, getEventsForDate } from '../scheduler';
import { PomodoroTimer } from './PomodoroTimer';

interface Props {
  tasks: Task[];
  schedule: ScheduleEntry[];
  config: ScheduleConfig;
  selectedDate: string;
  events: CalendarEvent[];
  saveSchedule: (date: string, entries: ScheduleEntry[]) => Promise<void>;
  updateScheduleEntry: (entry: ScheduleEntry) => Promise<void>;
  deleteScheduleEntry: (id: string) => Promise<void>;
}

const CATEGORY_BG: Record<Category | 'break' | 'event', string> = {
  work: 'bg-work/20 border-work/40',
  personal: 'bg-personal/20 border-personal/40',
  fun: 'bg-fun/20 border-fun/40',
  break: 'bg-break/20 border-break/40',
  event: 'bg-purple-500/20 border-purple-500/40',
};

const CATEGORY_DOT: Record<Category | 'break' | 'event', string> = {
  work: 'bg-work',
  personal: 'bg-personal',
  fun: 'bg-fun',
  break: 'bg-break',
  event: 'bg-purple-500',
};

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function ScheduleView({
  tasks,
  schedule,
  config,
  selectedDate,
  events,
  saveSchedule,
  updateScheduleEntry,
  deleteScheduleEntry,
}: Props) {
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [showCustomBlock, setShowCustomBlock] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customStart, setCustomStart] = useState('09:00');
  const [customEnd, setCustomEnd] = useState('10:00');
  const [customCategory, setCustomCategory] = useState<Category | 'break'>('break');
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [pomodoroEntryId, setPomodoroEntryId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const todaySchedule = useMemo(
    () =>
      schedule
        .filter((s) => s.date === selectedDate)
        .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime)),
    [schedule, selectedDate]
  );

  const completedCount = useMemo(() => {
    const scheduledTaskIds = new Set(
      todaySchedule.filter((s) => s.taskId).map((s) => s.taskId)
    );
    return tasks.filter(
      (t) => scheduledTaskIds.has(t.id) && t.status === 'completed'
    ).length;
  }, [tasks, todaySchedule]);

  const totalScheduled = todaySchedule.filter((s) => s.taskId).length;

  const dayEvents = useMemo(
    () => getEventsForDate(events, selectedDate),
    [events, selectedDate]
  );

  const handlePlanDay = async () => {
    const result = generateSchedule(tasks, schedule, config, selectedDate, events);
    await saveSchedule(selectedDate, result.entries);
    setUnscheduledTasks(result.unscheduled);
  };

  const handleRegenerate = async () => {
    const lockedEntries = todaySchedule.filter((e) => e.locked);
    const result = generateSchedule(tasks, lockedEntries, config, selectedDate, events);
    await saveSchedule(selectedDate, result.entries);
    setUnscheduledTasks(result.unscheduled);
  };

  const handleToggleLock = async (entry: ScheduleEntry) => {
    await updateScheduleEntry({ ...entry, locked: !entry.locked });
  };

  const handleRemoveEntry = async (id: string) => {
    await deleteScheduleEntry(id);
    setSelectedEntry(null);
  };

  const handlePushBack = async () => {
    const pushed = pushScheduleBack(todaySchedule, 15);
    await saveSchedule(selectedDate, pushed);
  };

  const handleAddCustomBlock = async () => {
    if (!customTitle.trim()) return;
    const entry: ScheduleEntry = {
      id: uuidv4(),
      title: customTitle,
      category: customCategory,
      startTime: customStart,
      endTime: customEnd,
      locked: true,
      date: selectedDate,
    };
    const newSchedule = [...todaySchedule, entry];
    await saveSchedule(selectedDate, newSchedule);
    setShowCustomBlock(false);
    setCustomTitle('');
  };

  const handleEditSave = async () => {
    if (!editEntry) return;
    await updateScheduleEntry(editEntry);
    setEditEntry(null);
  };

  const handleSwap = useCallback(
    async (entryId: string, targetId: string) => {
      const entries = [...todaySchedule];
      const aIdx = entries.findIndex((e) => e.id === entryId);
      const bIdx = entries.findIndex((e) => e.id === targetId);
      if (aIdx === -1 || bIdx === -1) return;

      // Swap times
      const aStart = entries[aIdx].startTime;
      const aEnd = entries[aIdx].endTime;
      entries[aIdx] = { ...entries[aIdx], startTime: entries[bIdx].startTime, endTime: entries[bIdx].endTime };
      entries[bIdx] = { ...entries[bIdx], startTime: aStart, endTime: aEnd };

      await saveSchedule(selectedDate, entries);
    },
    [todaySchedule, saveSchedule, selectedDate]
  );

  // "What should I do next?" - find optimal next task
  const suggestNextTask = useMemo(() => {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // Find unscheduled pending tasks that could fit
    const scheduledTaskIds = new Set(todaySchedule.map((s) => s.taskId).filter(Boolean));
    const candidates = tasks
      .filter(
        (t) =>
          (t.status === 'pending' || t.status === 'in-progress') &&
          !scheduledTaskIds.has(t.id)
      )
      .sort((a, b) => {
        // Score: priority weight + energy match + due date urgency
        let scoreA = (6 - a.priority) * 10;
        let scoreB = (6 - b.priority) * 10;
        if (a.dueDate) {
          const daysA = (new Date(a.dueDate + 'T00:00:00').getTime() - now.getTime()) / 86400000;
          if (daysA <= 0) scoreA += 50;
          else if (daysA <= 1) scoreA += 30;
        }
        if (b.dueDate) {
          const daysB = (new Date(b.dueDate + 'T00:00:00').getTime() - now.getTime()) / 86400000;
          if (daysB <= 0) scoreB += 50;
          else if (daysB <= 1) scoreB += 30;
        }
        // Prefer high energy in morning, low in afternoon
        if (currentMin < 720) {
          if (a.energyLevel === 'high') scoreA += 15;
          if (b.energyLevel === 'high') scoreB += 15;
        } else {
          if (a.energyLevel === 'low') scoreA += 10;
          if (b.energyLevel === 'low') scoreB += 10;
        }
        return scoreB - scoreA;
      });

    return candidates[0] || null;
  }, [tasks, todaySchedule]);

  // Timeline hours
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7 AM to 10 PM

  return (
    <div className="max-w-5xl mx-auto">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={handlePlanDay}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Plan My Day
        </button>
        <button
          onClick={handleRegenerate}
          className="bg-surface hover:bg-surface-hover border border-border text-text px-4 py-2 rounded-lg text-sm"
        >
          Regenerate (keep locked)
        </button>
        <button
          onClick={handlePushBack}
          className="bg-surface hover:bg-surface-hover border border-border text-text-muted px-3 py-2 rounded-lg text-sm"
        >
          Push All +15min
        </button>
        <button
          onClick={() => setShowCustomBlock(true)}
          className="bg-surface hover:bg-surface-hover border border-border text-text-muted px-3 py-2 rounded-lg text-sm"
        >
          + Custom Block
        </button>

        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-text-muted">
            {completedCount}/{totalScheduled} tasks done
          </span>
          <div className="w-32 h-2 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{
                width: `${totalScheduled > 0 ? (completedCount / totalScheduled) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* What should I do next? */}
      {suggestNextTask && (
        <div className="mb-4 p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg flex items-center gap-3">
          <span className="text-sm text-blue-400 font-medium">Next up:</span>
          <span className="text-sm text-text">{suggestNextTask.title}</span>
          <span className="text-xs text-text-muted">
            P{suggestNextTask.priority} | {suggestNextTask.estimatedMinutes}m | {suggestNextTask.energyLevel} energy
          </span>
        </div>
      )}

      {/* Unscheduled warnings */}
      {unscheduledTasks.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
          <p className="text-sm text-yellow-400 font-medium mb-1">
            {unscheduledTasks.length} task{unscheduledTasks.length !== 1 ? 's' : ''} couldn't fit today:
          </p>
          <ul className="text-sm text-text-muted space-y-0.5">
            {unscheduledTasks.map((t) => (
              <li key={t.id}>
                {t.title} ({t.estimatedMinutes}m, P{t.priority})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {todaySchedule.length === 0 && (
          <div className="text-center text-text-muted py-12">
            No schedule for this day. Click "Plan My Day" to generate one.
          </div>
        )}

        {todaySchedule.length > 0 && (
          <div className="relative ml-16">
            {/* Hour markers */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative"
                style={{ height: '60px' }}
              >
                <span className="absolute -left-16 top-0 text-xs text-text-muted w-12 text-right">
                  {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                </span>
                <div className="absolute left-0 right-0 top-0 border-t border-border/30" />
              </div>
            ))}

            {/* Event blocks */}
            {dayEvents.map((event) => {
              const startMin = timeToMin(event.startTime);
              const endMin = timeToMin(event.endTime);
              const duration = endMin - startMin;
              const top = (startMin - 7 * 60);
              const height = Math.max(duration, 20);

              return (
                <div
                  key={`event-${event.id}`}
                  className="absolute left-0 right-0 rounded-lg border px-3 py-1.5 border-l-4 pointer-events-none"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    minHeight: '24px',
                    backgroundColor: `${event.color || '#8b5cf6'}20`,
                    borderColor: `${event.color || '#8b5cf6'}66`,
                    borderLeftColor: event.color || '#8b5cf6',
                    zIndex: 5,
                  }}
                >
                  <div className="flex items-center gap-2 h-full">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: event.color || '#8b5cf6' }}
                    />
                    <span className="text-sm font-medium truncate">{event.title}</span>
                    <span className="text-xs text-text-muted shrink-0">
                      {event.startTime} - {event.endTime}
                    </span>
                    {event.location && (
                      <span className="text-xs text-text-muted shrink-0 truncate">{event.location}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Schedule blocks */}
            {todaySchedule.map((entry) => {
              const startMin = timeToMin(entry.startTime);
              const endMin = timeToMin(entry.endTime);
              const duration = endMin - startMin;
              const top = (startMin - 7 * 60); // offset from 7 AM
              const height = Math.max(duration, 20);

              return (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={() => setDraggedId(entry.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedId && draggedId !== entry.id) {
                      handleSwap(draggedId, entry.id);
                    }
                    setDraggedId(null);
                  }}
                  onClick={() =>
                    setSelectedEntry(
                      selectedEntry === entry.id ? null : entry.id
                    )
                  }
                  className={`absolute left-0 right-0 rounded-lg border px-3 py-1.5 cursor-pointer transition-all ${
                    CATEGORY_BG[entry.category]
                  } ${selectedEntry === entry.id ? 'ring-2 ring-blue-500' : ''} ${
                    entry.locked ? 'border-l-4' : ''
                  }`}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    minHeight: '24px',
                  }}
                >
                  <div className="flex items-center gap-2 h-full">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_DOT[entry.category]}`} />
                    <span className="text-sm font-medium truncate">{entry.title}</span>
                    <span className="text-xs text-text-muted shrink-0">
                      {entry.startTime} - {entry.endTime}
                    </span>
                    {entry.locked && (
                      <span className="text-xs text-text-muted shrink-0" title="Locked">
                        🔒
                      </span>
                    )}
                    {duration >= 40 && (
                      <span className="text-xs text-text-muted shrink-0">{duration}m</span>
                    )}
                  </div>

                  {/* Actions on selected */}
                  {selectedEntry === entry.id && (
                    <div
                      className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-lg p-2 flex gap-1 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleToggleLock(entry)}
                        className="text-xs px-2 py-1 rounded hover:bg-surface-hover text-text-muted"
                      >
                        {entry.locked ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        onClick={() => setEditEntry(entry)}
                        className="text-xs px-2 py-1 rounded hover:bg-surface-hover text-text-muted"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setPomodoroEntryId(entry.id)}
                        className="text-xs px-2 py-1 rounded hover:bg-surface-hover text-text-muted"
                      >
                        Pomodoro
                      </button>
                      <button
                        onClick={() => handleRemoveEntry(entry.id)}
                        className="text-xs px-2 py-1 rounded hover:bg-surface-hover text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Block Modal */}
      {showCustomBlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCustomBlock(false)}>
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Add Custom Block</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Meeting, Appointment, etc."
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Start</label>
                  <input
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">End</label>
                  <input
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                  />
                </div>
              </div>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as Category | 'break')}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
              >
                <option value="break">Break</option>
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="fun">Fun</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCustomBlock}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm"
                >
                  Add Block
                </button>
                <button
                  onClick={() => setShowCustomBlock(false)}
                  className="px-4 py-2 bg-surface-hover text-text-muted rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditEntry(null)}>
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Edit Block</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editEntry.title}
                onChange={(e) => setEditEntry({ ...editEntry, title: e.target.value })}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Start</label>
                  <input
                    type="time"
                    value={editEntry.startTime}
                    onChange={(e) => setEditEntry({ ...editEntry, startTime: e.target.value })}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">End</label>
                  <input
                    type="time"
                    value={editEntry.endTime}
                    onChange={(e) => setEditEntry({ ...editEntry, endTime: e.target.value })}
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditEntry(null)}
                  className="px-4 py-2 bg-surface-hover text-text-muted rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pomodoro Timer */}
      {pomodoroEntryId && (
        <PomodoroTimer
          entry={todaySchedule.find((e) => e.id === pomodoroEntryId)!}
          onClose={() => setPomodoroEntryId(null)}
        />
      )}
    </div>
  );
}
