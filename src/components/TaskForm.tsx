import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Category, Priority, EnergyLevel, RecurrenceRule } from '../types';

interface Props {
  task: Task | null;
  onSave: (task: Task) => Promise<void>;
  onClose: () => void;
}

export function TaskForm({ task, onSave, onClose }: Props) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [category, setCategory] = useState<Category>(task?.category || 'personal');
  const [priority, setPriority] = useState<Priority>(task?.priority || 3);
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimatedMinutes || 30);
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [recurrence, setRecurrence] = useState<string>(
    task?.recurrence
      ? typeof task.recurrence === 'string'
        ? task.recurrence
        : 'custom'
      : 'none'
  );
  const [customDays, setCustomDays] = useState<number[]>(
    task?.recurrence && typeof task.recurrence === 'object'
      ? task.recurrence.days
      : []
  );
  const [tags, setTags] = useState(task?.tags.join(', ') || '');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(task?.energyLevel || 'medium');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let recurrenceRule: RecurrenceRule | undefined;
    if (recurrence !== 'none') {
      if (recurrence === 'custom') {
        recurrenceRule = { type: 'custom', days: customDays };
      } else {
        recurrenceRule = recurrence as RecurrenceRule;
      }
    }

    const newTask: Task = {
      id: task?.id || uuidv4(),
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      estimatedMinutes,
      dueDate: dueDate || undefined,
      recurrence: recurrenceRule,
      status: task?.status || 'pending',
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      energyLevel,
      createdAt: task?.createdAt || new Date().toISOString(),
      completedAt: task?.completedAt,
      parentRecurringId: task?.parentRecurringId,
    };

    await onSave(newTask);
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">
          {task ? 'Edit Task' : 'New Task'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-muted mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
              >
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="fun">Fun</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as Priority)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
              >
                <option value={1}>P1 - Critical</option>
                <option value={2}>P2 - High</option>
                <option value={3}>P3 - Medium</option>
                <option value={4}>P4 - Low</option>
                <option value={5}>P5 - Nice-to-have</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-muted mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                min={5}
                step={5}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Energy Level</label>
              <select
                value={energyLevel}
                onChange={(e) => setEnergyLevel(e.target.value as EnergyLevel)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Recurrence</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom days</option>
            </select>
            {recurrence === 'custom' && (
              <div className="flex gap-2 mt-2">
                {dayNames.map((name, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setCustomDays((prev) =>
                        prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
                      )
                    }
                    className={`px-2 py-1 rounded text-xs ${
                      customDays.includes(i)
                        ? 'bg-blue-600 text-white'
                        : 'bg-bg border border-border text-text-muted'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="client-work, admin, health"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text-muted"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium"
            >
              {task ? 'Update Task' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-hover text-text-muted rounded-lg text-sm hover:text-text"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
