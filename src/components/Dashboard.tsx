import { useMemo } from 'react';
import type { Task, ScheduleEntry, Category } from '../types';

interface Props {
  tasks: Task[];
  schedule: ScheduleEntry[];
  selectedDate: string;
}

const CATEGORY_COLORS: Record<Category, string> = {
  work: 'bg-work',
  personal: 'bg-personal',
  fun: 'bg-fun',
};

export function Dashboard({ tasks, schedule, selectedDate }: Props) {
  const todaySchedule = useMemo(
    () => schedule.filter((s) => s.date === selectedDate),
    [schedule, selectedDate]
  );

  const todayStats = useMemo(() => {
    const scheduledTaskIds = new Set(
      todaySchedule.filter((s) => s.taskId).map((s) => s.taskId)
    );
    const total = scheduledTaskIds.size;
    const completed = tasks.filter(
      (t) => scheduledTaskIds.has(t.id) && t.status === 'completed'
    ).length;
    return { total, completed };
  }, [tasks, todaySchedule]);

  // Upcoming due dates (next 7 days)
  const upcomingDue = useMemo(() => {
    const today = new Date(selectedDate + 'T00:00:00');
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    return tasks
      .filter((t) => {
        if (!t.dueDate || t.status === 'completed') return false;
        const due = new Date(t.dueDate + 'T00:00:00');
        return due >= today && due <= weekLater;
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }, [tasks, selectedDate]);

  // Overdue tasks
  const overdue = useMemo(() => {
    const today = new Date(selectedDate + 'T00:00:00');
    return tasks.filter((t) => {
      if (!t.dueDate || t.status === 'completed') return false;
      return new Date(t.dueDate + 'T00:00:00') < today;
    });
  }, [tasks, selectedDate]);

  // Weekly summary
  const weeklySummary = useMemo(() => {
    const today = new Date(selectedDate + 'T00:00:00');
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - today.getDay());

    const completedThisWeek = tasks.filter((t) => {
      if (t.status !== 'completed' || !t.completedAt) return false;
      const completed = new Date(t.completedAt);
      return completed >= weekStart && completed <= today;
    });

    const timeByCategory: Record<Category, number> = { work: 0, personal: 0, fun: 0 };
    completedThisWeek.forEach((t) => {
      timeByCategory[t.category] += t.estimatedMinutes;
    });

    // Recurring streaks
    const recurringTasks = tasks.filter((t) => t.recurrence && !t.parentRecurringId);
    const streaks: Record<string, number> = {};
    for (const rt of recurringTasks) {
      const instances = tasks.filter(
        (t) => t.parentRecurringId === rt.id && t.status === 'completed'
      );
      streaks[rt.title] = instances.length;
    }

    return {
      tasksCompleted: completedThisWeek.length,
      timeByCategory,
      recurringStreaks: streaks,
    };
  }, [tasks, selectedDate]);

  const totalWeeklyMinutes =
    weeklySummary.timeByCategory.work +
    weeklySummary.timeByCategory.personal +
    weeklySummary.timeByCategory.fun;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Today's Progress */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-3">Today's Progress</h3>
          <div className="text-3xl font-bold mb-2">
            {todayStats.completed}
            <span className="text-lg text-text-muted font-normal">/{todayStats.total}</span>
          </div>
          <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{
                width: `${todayStats.total > 0 ? (todayStats.completed / todayStats.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-text-muted mt-2">
            {todayStats.total > 0
              ? `${Math.round((todayStats.completed / todayStats.total) * 100)}% complete`
              : 'No tasks scheduled'}
          </p>
        </div>

        {/* Weekly Summary */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-3">This Week</h3>
          <div className="text-3xl font-bold mb-2">{weeklySummary.tasksCompleted}</div>
          <p className="text-xs text-text-muted mb-3">tasks completed</p>
          <div className="space-y-2">
            {(['work', 'personal', 'fun'] as Category[]).map((cat) => (
              <div key={cat} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[cat]}`} />
                <span className="text-xs capitalize text-text-muted flex-1">{cat}</span>
                <span className="text-xs text-text font-medium">
                  {Math.round(weeklySummary.timeByCategory[cat] / 60 * 10) / 10}h
                </span>
                <div className="w-20 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_COLORS[cat]}`}
                    style={{
                      width: `${totalWeeklyMinutes > 0 ? (weeklySummary.timeByCategory[cat] / totalWeeklyMinutes) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue Alerts */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-3">Alerts</h3>
          {overdue.length === 0 && upcomingDue.length === 0 && (
            <p className="text-sm text-text-muted">All clear! No overdue tasks.</p>
          )}
          {overdue.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-red-400 font-medium mb-1">
                {overdue.length} overdue
              </p>
              {overdue.slice(0, 3).map((t) => (
                <div key={t.id} className="text-sm text-text-muted truncate">
                  {t.title} <span className="text-red-400 text-xs">(due {t.dueDate})</span>
                </div>
              ))}
              {overdue.length > 3 && (
                <p className="text-xs text-text-muted">+{overdue.length - 3} more</p>
              )}
            </div>
          )}
          {upcomingDue.length > 0 && (
            <div>
              <p className="text-xs text-yellow-400 font-medium mb-1">
                Upcoming (7 days)
              </p>
              {upcomingDue.slice(0, 5).map((t) => (
                <div key={t.id} className="text-sm text-text-muted truncate">
                  {t.title} <span className="text-xs">({t.dueDate})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-medium text-text-muted mb-4">Today's Schedule</h3>
        {todaySchedule.length === 0 ? (
          <p className="text-sm text-text-muted">No schedule yet. Go to Schedule tab to plan your day.</p>
        ) : (
          <div className="space-y-1.5">
            {todaySchedule
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((entry) => {
                const task = entry.taskId
                  ? tasks.find((t) => t.id === entry.taskId)
                  : null;
                const isCompleted = task?.status === 'completed';
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                      isCompleted ? 'opacity-50' : ''
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        CATEGORY_COLORS[entry.category as Category] || 'bg-break'
                      }`}
                    />
                    <span className="text-xs text-text-muted font-mono w-24 shrink-0">
                      {entry.startTime} - {entry.endTime}
                    </span>
                    <span
                      className={`text-sm flex-1 ${isCompleted ? 'line-through text-text-muted' : ''}`}
                    >
                      {entry.title}
                    </span>
                    {entry.locked && (
                      <span className="text-xs text-text-muted">locked</span>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Recurring Task Streaks */}
      {Object.keys(weeklySummary.recurringStreaks).length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4">Recurring Streaks</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(weeklySummary.recurringStreaks).map(
              ([title, count]) => (
                <div
                  key={title}
                  className="bg-surface-hover rounded-lg p-3 text-center"
                >
                  <div className="text-2xl font-bold text-green-400">{count}</div>
                  <div className="text-xs text-text-muted truncate">{title}</div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
