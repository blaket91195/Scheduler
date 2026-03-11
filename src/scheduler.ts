import { v4 as uuidv4 } from 'uuid';
import type {
  Task,
  ScheduleEntry,
  ScheduleConfig,
  CalendarEvent,
} from './types';

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function isWeekend(date: string): boolean {
  const d = new Date(date + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

function getEffectivePriority(task: Task, date: string): number {
  if (!task.dueDate) return task.priority;
  const due = new Date(task.dueDate + 'T00:00:00');
  const today = new Date(date + 'T00:00:00');
  if (due <= today) return Math.min(task.priority, 1); // overdue → critical
  const daysUntil = (due.getTime() - today.getTime()) / 86400000;
  if (daysUntil <= 1) return Math.min(task.priority, 2);
  return task.priority;
}

interface TimeSlot {
  start: number;
  end: number;
  type: 'work' | 'evening' | 'weekend';
}

function getTimeSlots(date: string, config: ScheduleConfig): TimeSlot[] {
  const weekend = isWeekend(date);
  if (weekend) {
    return [
      {
        start: timeToMin(config.weekendStart),
        end: timeToMin(config.weekendEnd),
        type: 'weekend',
      },
    ];
  }
  return [
    {
      start: timeToMin(config.workStart),
      end: timeToMin(config.workEnd),
      type: 'work',
    },
    {
      start: timeToMin(config.eveningStart),
      end: timeToMin(config.eveningEnd),
      type: 'evening',
    },
  ];
}

function getLockedBlocks(
  lockedEntries: ScheduleEntry[]
): Array<{ start: number; end: number }> {
  return lockedEntries.map((e) => ({
    start: timeToMin(e.startTime),
    end: timeToMin(e.endTime),
  }));
}

function findNextAvailableSlot(
  cursor: number,
  duration: number,
  slotEnd: number,
  blocked: Array<{ start: number; end: number }>
): number | null {
  let pos = cursor;
  while (pos + duration <= slotEnd) {
    const conflict = blocked.find(
      (b) => pos < b.end && pos + duration > b.start
    );
    if (!conflict) return pos;
    pos = conflict.end + 10; // 10-min buffer after blocked
  }
  return null;
}

const BUFFER = 10;
const MAX_BLOCK = 90;
const SLACK_PER_4H = 15;

export function getEventsForDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  const directMatch = events.filter((e) => e.date === date);

  // Also check recurring events
  const recurringMatches = events.filter((e) => {
    if (!e.recurrence || e.date === date) return false;
    // Only recur on or after the original event date
    if (date < e.date) return false;
    return shouldRecur(e.recurrence, date);
  });

  return [...directMatch, ...recurringMatches];
}

export function generateSchedule(
  tasks: Task[],
  existingSchedule: ScheduleEntry[],
  config: ScheduleConfig,
  date: string,
  events: CalendarEvent[] = []
): { entries: ScheduleEntry[]; unscheduled: Task[] } {
  const lockedEntries = existingSchedule.filter(
    (e) => e.date === date && e.locked
  );
  const slots = getTimeSlots(date, config);
  const weekend = isWeekend(date);
  const peakStart = timeToMin(config.peakStart);
  const peakEnd = timeToMin(config.peakEnd);

  // Convert events for this date into locked schedule entries
  const dayEvents = getEventsForDate(events, date);
  for (const event of dayEvents) {
    const eventEntry: ScheduleEntry = {
      id: `event-${event.id}-${date}`,
      title: event.title,
      category: 'break', // events are treated as blocked time
      startTime: event.startTime,
      endTime: event.endTime,
      locked: true,
      date,
    };
    lockedEntries.push(eventEntry);
  }

  // Filter to schedulable tasks (include deferred - they're overdue and important)
  const pendingTasks = tasks
    .filter(
      (t) =>
        t.status === 'pending' ||
        t.status === 'in-progress' ||
        t.status === 'deferred'
    )
    .map((t) => ({ ...t, effectivePriority: getEffectivePriority(t, date) }))
    .sort((a, b) => {
      if (a.effectivePriority !== b.effectivePriority)
        return a.effectivePriority - b.effectivePriority;
      // Energy: high first during peak, low first off-peak
      const energyOrder = { high: 0, medium: 1, low: 2 };
      return energyOrder[a.energyLevel] - energyOrder[b.energyLevel];
    });

  const result: ScheduleEntry[] = [...lockedEntries];
  const blocked = getLockedBlocks(lockedEntries);
  const scheduled = new Set<string>();
  const unscheduled: Task[] = [];

  // Add lunch for weekdays
  if (!weekend) {
    const lunchStart = timeToMin(config.lunchTime);
    const lunchExists = lockedEntries.some(
      (e) => e.title === 'Lunch' || (timeToMin(e.startTime) <= lunchStart && timeToMin(e.endTime) >= lunchStart + 30)
    );
    if (!lunchExists) {
      const lunchEntry: ScheduleEntry = {
        id: uuidv4(),
        title: 'Lunch',
        category: 'break',
        startTime: minToTime(lunchStart),
        endTime: minToTime(lunchStart + 30),
        locked: true,
        date,
      };
      result.push(lunchEntry);
      blocked.push({ start: lunchStart, end: lunchStart + 30 });
    }
  }

  // Track slack time
  const slackNeeded = new Map<number, number>(); // slot start -> slack minutes remaining
  for (const slot of slots) {
    const slotDuration = slot.end - slot.start;
    const slackMin = Math.floor(slotDuration / 240) * SLACK_PER_4H;
    slackNeeded.set(slot.start, slackMin);
  }

  // Weekend cycle tracking
  let weekendCyclePersonalMin = 0;
  let needsWeekendBreak = false;

  for (const slot of slots) {
    let cursor = slot.start;

    // Sort tasks for this slot
    let slotTasks: typeof pendingTasks;

    if (slot.type === 'work') {
      slotTasks = pendingTasks.filter(
        (t) => !scheduled.has(t.id) && t.category === 'work'
      );
    } else if (slot.type === 'evening') {
      // Personal first, then fun
      const personal = pendingTasks.filter(
        (t) => !scheduled.has(t.id) && t.category === 'personal'
      );
      const fun = pendingTasks.filter(
        (t) => !scheduled.has(t.id) && t.category === 'fun'
      );
      slotTasks = [...personal, ...fun];
    } else {
      // Weekend: personal and fun mixed
      const personal = pendingTasks.filter(
        (t) => !scheduled.has(t.id) && t.category === 'personal'
      );
      const fun = pendingTasks.filter(
        (t) => !scheduled.has(t.id) && t.category === 'fun'
      );
      slotTasks = [...personal, ...fun];
    }

    // Also allow any category overdue/critical tasks
    const criticalOther = pendingTasks.filter(
      (t) =>
        !scheduled.has(t.id) &&
        t.effectivePriority <= 2 &&
        !slotTasks.some((st) => st.id === t.id)
    );
    slotTasks = [...criticalOther, ...slotTasks];

    // Sort: peak-hour high-energy tasks first during peak
    if (slot.type === 'work') {
      slotTasks.sort((a, b) => {
        if (a.effectivePriority !== b.effectivePriority)
          return a.effectivePriority - b.effectivePriority;
        // During peak, prefer high energy
        const eOrder = { high: 0, medium: 1, low: 2 };
        return eOrder[a.energyLevel] - eOrder[b.energyLevel];
      });
    }

    const slotSlack = slackNeeded.get(slot.start) || 0;
    let slackUsed = 0;

    for (const task of slotTasks) {
      if (scheduled.has(task.id)) continue;

      let remainingDuration = task.estimatedMinutes;

      // Weekend break cycle
      if (weekend && slot.type === 'weekend' && task.category === 'personal') {
        if (needsWeekendBreak) {
          // Insert 60-min break
          const breakPos = findNextAvailableSlot(cursor, 60, slot.end, blocked);
          if (breakPos !== null) {
            const breakEntry: ScheduleEntry = {
              id: uuidv4(),
              title: 'Break',
              category: 'break',
              startTime: minToTime(breakPos),
              endTime: minToTime(breakPos + 60),
              locked: false,
              date,
            };
            result.push(breakEntry);
            blocked.push({ start: breakPos, end: breakPos + 60 });
            cursor = breakPos + 60 + BUFFER;
            needsWeekendBreak = false;
            weekendCyclePersonalMin = 0;
          }
        }
      }

      while (remainingDuration > 0) {
        // Determine block size
        let blockSize: number;
        if (weekend) {
          blockSize = remainingDuration; // No hard cap on weekends
        } else if (task.effectivePriority <= 2) {
          blockSize = remainingDuration; // Priority 1-2 can run full
        } else {
          blockSize = Math.min(remainingDuration, MAX_BLOCK);
        }

        // Reserve slack
        const effectiveEnd =
          slot.end - Math.max(0, slotSlack - slackUsed);

        const pos = findNextAvailableSlot(
          cursor,
          blockSize,
          effectiveEnd,
          blocked
        );

        if (pos === null) {
          // Try with smaller block
          if (blockSize > 30) {
            const smallPos = findNextAvailableSlot(
              cursor,
              30,
              effectiveEnd,
              blocked
            );
            if (smallPos !== null) {
              blockSize = 30;
              const entry: ScheduleEntry = {
                id: uuidv4(),
                taskId: task.id,
                title: task.title,
                category: task.category,
                startTime: minToTime(smallPos),
                endTime: minToTime(smallPos + blockSize),
                locked: false,
                date,
              };
              result.push(entry);
              blocked.push({ start: smallPos, end: smallPos + blockSize });
              cursor = smallPos + blockSize + BUFFER;
              remainingDuration -= blockSize;

              if (weekend && task.category === 'personal') {
                weekendCyclePersonalMin += blockSize;
                if (weekendCyclePersonalMin >= 90) needsWeekendBreak = true;
              }
              continue;
            }
          }
          break; // Can't fit, move to next task
        }

        // Check if high-energy task during peak hours (for work slot)
        if (
          slot.type === 'work' &&
          task.energyLevel === 'high' &&
          pos >= peakStart &&
          pos + blockSize <= peakEnd
        ) {
          // Great, it's in peak hours
        }

        const entry: ScheduleEntry = {
          id: uuidv4(),
          taskId: task.id,
          title: task.title,
          category: task.category,
          startTime: minToTime(pos),
          endTime: minToTime(pos + blockSize),
          locked: false,
          date,
        };
        result.push(entry);
        blocked.push({ start: pos, end: pos + blockSize });
        cursor = pos + blockSize + BUFFER;
        remainingDuration -= blockSize;
        slackUsed += 2; // consume a bit of slack tracking

        if (weekend && task.category === 'personal') {
          weekendCyclePersonalMin += blockSize;
          if (weekendCyclePersonalMin >= 90) needsWeekendBreak = true;
        }
      }

      if (remainingDuration <= 0) {
        scheduled.add(task.id);
      } else {
        unscheduled.push(task);
      }
    }
  }

  // Add tasks that were never attempted
  for (const task of pendingTasks) {
    if (!scheduled.has(task.id) && !unscheduled.some((u) => u.id === task.id)) {
      unscheduled.push(task);
    }
  }

  // Sort result by start time
  result.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

  return { entries: result, unscheduled };
}

export function pushScheduleBack(
  entries: ScheduleEntry[],
  minutes: number
): ScheduleEntry[] {
  return entries.map((e) => {
    if (e.locked) return e;
    return {
      ...e,
      startTime: minToTime(timeToMin(e.startTime) + minutes),
      endTime: minToTime(timeToMin(e.endTime) + minutes),
    };
  });
}

export function shouldRecur(
  recurrence: Task['recurrence'],
  date: string
): boolean {
  if (!recurrence) return false;
  const d = new Date(date + 'T00:00:00');
  const day = d.getDay();

  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') return day >= 1 && day <= 5;
  if (recurrence === 'weekly') return true; // generated once per week
  if (recurrence === 'fortnightly') return true;
  if (recurrence === 'monthly') return true;
  if (typeof recurrence === 'object' && recurrence.type === 'custom') {
    return recurrence.days.includes(day);
  }
  return false;
}

export function generateRecurringInstances(
  tasks: Task[],
  date: string
): Task[] {
  const newInstances: Task[] = [];
  const recurringTasks = tasks.filter((t) => t.recurrence && !t.parentRecurringId);

  for (const task of recurringTasks) {
    if (!shouldRecur(task.recurrence, date)) continue;

    // Check if instance already exists for this date
    const existingInstance = tasks.find(
      (t) =>
        t.parentRecurringId === task.id &&
        t.createdAt.startsWith(date)
    );
    if (existingInstance) continue;

    const instance: Task = {
      ...task,
      id: uuidv4(),
      parentRecurringId: task.id,
      status: 'pending',
      createdAt: new Date(date + 'T00:00:00').toISOString(),
      completedAt: undefined,
      recurrence: undefined, // instances don't recur themselves
    };
    newInstances.push(instance);
  }

  return newInstances;
}

export function parseQuickAdd(input: string): Partial<Task> {
  const parts = input.split('|').map((s) => s.trim());
  const result: Partial<Task> = {
    title: parts[0],
    category: 'personal',
    priority: 3,
    estimatedMinutes: 30,
    energyLevel: 'medium',
    tags: [],
    status: 'pending',
  };

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].toLowerCase();
    if (['work', 'personal', 'fun'].includes(part)) {
      result.category = part as Task['category'];
    } else if (/^p[1-5]$/.test(part)) {
      result.priority = parseInt(part[1]) as Task['priority'];
    } else if (/^\d+m$/.test(part)) {
      result.estimatedMinutes = parseInt(part);
    } else if (part.startsWith('due:')) {
      const val = part.slice(4);
      if (val === 'today') {
        result.dueDate = new Date().toISOString().split('T')[0];
      } else if (val === 'tomorrow') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        result.dueDate = d.toISOString().split('T')[0];
      } else {
        result.dueDate = val;
      }
    } else if (part.startsWith('energy:')) {
      result.energyLevel = part.slice(7) as Task['energyLevel'];
    } else if (part.startsWith('tag:') || part.startsWith('tags:')) {
      const tagStr = part.includes(':') ? part.split(':')[1] : '';
      result.tags = tagStr.split(',').map((t) => t.trim());
    } else if (/^(daily|weekdays|weekly|fortnightly|monthly)$/.test(part)) {
      result.recurrence = part as Task['recurrence'];
    }
  }

  return result;
}
