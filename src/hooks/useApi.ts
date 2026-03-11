import { useState, useEffect, useCallback } from 'react';
import type { Task, ScheduleEntry, ScheduleConfig, AppData } from '../types';
import { DEFAULT_CONFIG } from '../types';

const API = '/api';

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function useApi() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<AppData>(`${API}/data`);
      setTasks(data.tasks || []);
      setSchedule(data.schedule || []);
      setConfig(data.config || DEFAULT_CONFIG);
    } catch {
      console.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addTask = useCallback(async (task: Task) => {
    await fetchJson(`${API}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    });
    setTasks((prev) => [...prev, task]);
  }, []);

  const updateTask = useCallback(async (task: Task) => {
    await fetchJson(`${API}/tasks/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify(task),
    });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await fetchJson(`${API}/tasks/${id}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSchedule((prev) => prev.filter((s) => s.taskId !== id));
  }, []);

  const bulkUpdateTasks = useCallback(
    async (taskIds: string[], updates: Partial<Task>) => {
      await fetchJson(`${API}/tasks/bulk`, {
        method: 'POST',
        body: JSON.stringify({ action: 'update', taskIds, updates }),
      });
      setTasks((prev) =>
        prev.map((t) => (taskIds.includes(t.id) ? { ...t, ...updates } as Task : t))
      );
    },
    []
  );

  const bulkDeleteTasks = useCallback(async (taskIds: string[]) => {
    await fetchJson(`${API}/tasks/bulk`, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', taskIds }),
    });
    setTasks((prev) => prev.filter((t) => !taskIds.includes(t.id)));
    setSchedule((prev) => prev.filter((s) => !s.taskId || !taskIds.includes(s.taskId)));
  }, []);

  const saveSchedule = useCallback(
    async (date: string, entries: ScheduleEntry[]) => {
      await fetchJson(`${API}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ date, entries }),
      });
      setSchedule((prev) => [
        ...prev.filter((s) => s.date !== date),
        ...entries,
      ]);
    },
    []
  );

  const updateScheduleEntry = useCallback(async (entry: ScheduleEntry) => {
    await fetchJson(`${API}/schedule/${entry.id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    });
    setSchedule((prev) => prev.map((s) => (s.id === entry.id ? entry : s)));
  }, []);

  const deleteScheduleEntry = useCallback(async (id: string) => {
    await fetchJson(`${API}/schedule/${id}`, { method: 'DELETE' });
    setSchedule((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateConfig = useCallback(async (newConfig: ScheduleConfig) => {
    await fetchJson(`${API}/config`, {
      method: 'PUT',
      body: JSON.stringify(newConfig),
    });
    setConfig(newConfig);
  }, []);

  const importTasks = useCallback(async (importedTasks: Task[]) => {
    const result = await fetchJson<{ imported: number }>(`${API}/import`, {
      method: 'POST',
      body: JSON.stringify({ tasks: importedTasks }),
    });
    setTasks((prev) => [...prev, ...importedTasks]);
    return result.imported;
  }, []);

  return {
    tasks,
    schedule,
    config,
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
    reload: loadAll,
  };
}
