import { useState, useEffect, useCallback } from 'react';
import type { Task, ScheduleEntry, ScheduleConfig, AppData, CalendarEvent } from '../types';
import { DEFAULT_CONFIG } from '../types';

const STORAGE_KEY = 'daily-planner-data';

function loadFromStorage(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    console.error('Failed to load from localStorage');
  }
  return { tasks: [], schedule: [], config: DEFAULT_CONFIG, events: [] };
}

function saveToStorage(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useApi() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_CONFIG);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Persist whenever state changes
  useEffect(() => {
    if (!loading) {
      saveToStorage({ tasks, schedule, config, events });
    }
  }, [tasks, schedule, config, events, loading]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const data = loadFromStorage();
    setTasks(data.tasks || []);
    setSchedule(data.schedule || []);
    setConfig(data.config || DEFAULT_CONFIG);
    setEvents(data.events || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addTask = useCallback(async (task: Task) => {
    setTasks((prev) => [...prev, task]);
  }, []);

  const updateTask = useCallback(async (task: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSchedule((prev) => prev.filter((s) => s.taskId !== id));
  }, []);

  const bulkUpdateTasks = useCallback(
    async (taskIds: string[], updates: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) => (taskIds.includes(t.id) ? { ...t, ...updates } as Task : t))
      );
    },
    []
  );

  const bulkDeleteTasks = useCallback(async (taskIds: string[]) => {
    setTasks((prev) => prev.filter((t) => !taskIds.includes(t.id)));
    setSchedule((prev) => prev.filter((s) => !s.taskId || !taskIds.includes(s.taskId)));
  }, []);

  const saveSchedule = useCallback(
    async (date: string, entries: ScheduleEntry[]) => {
      setSchedule((prev) => [
        ...prev.filter((s) => s.date !== date),
        ...entries,
      ]);
    },
    []
  );

  const updateScheduleEntry = useCallback(async (entry: ScheduleEntry) => {
    setSchedule((prev) => prev.map((s) => (s.id === entry.id ? entry : s)));
  }, []);

  const deleteScheduleEntry = useCallback(async (id: string) => {
    setSchedule((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateConfig = useCallback(async (newConfig: ScheduleConfig) => {
    setConfig(newConfig);
  }, []);

  const importTasks = useCallback(async (importedTasks: Task[]) => {
    setTasks((prev) => [...prev, ...importedTasks]);
    return importedTasks.length;
  }, []);

  const importAll = useCallback(
    async (data: { tasks?: Task[]; schedule?: ScheduleEntry[]; events?: CalendarEvent[] }) => {
      if (data.tasks?.length) {
        setTasks((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          return [...prev, ...data.tasks!.filter((t) => !existingIds.has(t.id))];
        });
      }
      if (data.schedule?.length) {
        setSchedule((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          return [...prev, ...data.schedule!.filter((s) => !existingIds.has(s.id))];
        });
      }
      if (data.events?.length) {
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          return [...prev, ...data.events!.filter((e) => !existingIds.has(e.id))];
        });
      }
    },
    []
  );

  const addEvent = useCallback(async (event: CalendarEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const updateEvent = useCallback(async (event: CalendarEvent) => {
    setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)));
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    tasks,
    schedule,
    config,
    events,
    loading,
    addTask,
    updateTask,
    deleteTask,
    bulkUpdateTasks,
    bulkDeleteTasks,
    saveSchedule,
    updateScheduleEntry,
    deleteScheduleEntry,
    updateConfig,
    importTasks,
    importAll,
    addEvent,
    updateEvent,
    deleteEvent,
    reload: loadAll,
  };
}
