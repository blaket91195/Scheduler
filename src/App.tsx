import { useState, useEffect, useCallback } from 'react';
import { useApi } from './hooks/useApi';
import { TaskPanel } from './components/TaskPanel';
import { ScheduleView } from './components/ScheduleView';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { EventPanel } from './components/EventPanel';
import { PomodoroTimer } from './components/PomodoroTimer';
import { generateRecurringInstances } from './scheduler';

type View = 'dashboard' | 'tasks' | 'schedule' | 'events' | 'settings';

export default function App() {
  const api = useApi();
  const [view, setView] = useState<View>('dashboard');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [pomodoroTitle, setPomodoroTitle] = useState<string | null>(null);

  // Generate recurring task instances on load
  useEffect(() => {
    if (!api.loading && api.tasks.length > 0) {
      const newInstances = generateRecurringInstances(api.tasks, selectedDate);
      for (const inst of newInstances) {
        api.addTask(inst);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.loading, selectedDate]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === '1') setView('dashboard');
      if (e.key === '2') setView('tasks');
      if (e.key === '3') setView('schedule');
      if (e.key === '4') setView('events');
      if (e.key === '5') setView('settings');
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        setView('tasks');
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleExport = useCallback(
    (format: 'markdown' | 'csv') => {
      const todaySchedule = api.schedule.filter(
        (s) => s.date === selectedDate
      );
      let content: string;
      let filename: string;

      if (format === 'markdown') {
        const lines = [`# Daily Planner — ${selectedDate}`, '', '## Schedule', ''];
        for (const entry of todaySchedule) {
          lines.push(`- **${entry.startTime}–${entry.endTime}** ${entry.title} [${entry.category}]${entry.locked ? ' 🔒' : ''}`);
        }
        lines.push('', '## Tasks', '');
        for (const task of api.tasks) {
          const check = task.status === 'completed' ? 'x' : ' ';
          lines.push(`- [${check}] ${task.title} (${task.category}, P${task.priority}, ${task.estimatedMinutes}m)`);
        }
        content = lines.join('\n');
        filename = 'planner.md';
      } else {
        const lines = ['Title,Category,Priority,Duration,DueDate,Energy,Tags,Status'];
        for (const task of api.tasks) {
          lines.push([
            `"${task.title}"`,
            task.category,
            task.priority,
            task.estimatedMinutes,
            task.dueDate || '',
            task.energyLevel,
            `"${(task.tags || []).join(',')}"`,
            task.status,
          ].join(','));
        }
        content = lines.join('\n');
        filename = 'tasks.csv';
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [selectedDate, api.schedule, api.tasks]
  );

  if (api.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-muted text-lg">Loading planner...</div>
      </div>
    );
  }

  const navItems: { key: View; label: string; shortcut: string }[] = [
    { key: 'dashboard', label: 'Dashboard', shortcut: '1' },
    { key: 'tasks', label: 'Tasks', shortcut: '2' },
    { key: 'schedule', label: 'Schedule', shortcut: '3' },
    { key: 'events', label: 'Events', shortcut: '4' },
    { key: 'settings', label: 'Settings', shortcut: '5' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold tracking-tight">
            Daily Planner
          </h1>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  view === item.key
                    ? 'bg-blue-600 text-white'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover'
                }`}
              >
                {item.label}
                <span className="ml-1.5 text-xs opacity-50">
                  {item.shortcut}
                </span>
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-surface-hover border border-border rounded px-2 py-1 text-sm text-text"
          />
          <button
            onClick={() => handleExport('markdown')}
            className="text-xs text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-hover"
          >
            Export MD
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="text-xs text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-hover"
          >
            Export CSV
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {view === 'dashboard' && (
          <Dashboard
            tasks={api.tasks}
            schedule={api.schedule}
            events={api.events}
            selectedDate={selectedDate}
          />
        )}
        {view === 'tasks' && (
          <TaskPanel
            tasks={api.tasks}
            addTask={api.addTask}
            updateTask={api.updateTask}
            deleteTask={api.deleteTask}
            bulkUpdateTasks={api.bulkUpdateTasks}
            bulkDeleteTasks={api.bulkDeleteTasks}
            importTasks={api.importTasks}
          />
        )}
        {view === 'schedule' && (
          <ScheduleView
            tasks={api.tasks}
            schedule={api.schedule}
            config={api.config}
            selectedDate={selectedDate}
            events={api.events}
            saveSchedule={api.saveSchedule}
            updateScheduleEntry={api.updateScheduleEntry}
            deleteScheduleEntry={api.deleteScheduleEntry}
            onStartPomodoro={(title) => setPomodoroTitle(title)}
          />
        )}
        {view === 'events' && (
          <EventPanel
            events={api.events}
            addEvent={api.addEvent}
            updateEvent={api.updateEvent}
            deleteEvent={api.deleteEvent}
          />
        )}
        {view === 'settings' && (
          <Settings config={api.config} updateConfig={api.updateConfig} />
        )}
      </main>

      {/* Global Pomodoro Timer */}
      {pomodoroTitle && (
        <PomodoroTimer
          title={pomodoroTitle}
          onClose={() => setPomodoroTitle(null)}
        />
      )}
    </div>
  );
}
