import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Category, Priority, EnergyLevel, TaskStatus } from '../types';
import { parseQuickAdd } from '../scheduler';
import { TaskForm } from './TaskForm';
import { ImportModal } from './ImportModal';

interface Props {
  tasks: Task[];
  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  bulkUpdateTasks: (ids: string[], updates: Partial<Task>) => Promise<void>;
  bulkDeleteTasks: (ids: string[]) => Promise<void>;
  importTasks: (tasks: Task[]) => Promise<number>;
}

type SortKey = 'priority' | 'dueDate' | 'category' | 'createdAt' | 'energyLevel';

const CATEGORY_COLORS: Record<Category, string> = {
  work: 'bg-work/20 text-work',
  personal: 'bg-personal/20 text-personal',
  fun: 'bg-fun/20 text-fun',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  1: 'P1 Critical',
  2: 'P2 High',
  3: 'P3 Medium',
  4: 'P4 Low',
  5: 'P5 Nice-to-have',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  'in-progress': 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  deferred: 'bg-gray-500/20 text-gray-400',
};

export function TaskPanel({
  tasks,
  addTask,
  updateTask,
  deleteTask,
  bulkUpdateTasks,
  bulkDeleteTasks,
  importTasks,
}: Props) {
  const [quickAddInput, setQuickAddInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterEnergy, setFilterEnergy] = useState<EnergyLevel | 'all'>('all');
  const [filterTag, setFilterTag] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('priority');

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (filterCategory !== 'all')
      result = result.filter((t) => t.category === filterCategory);
    if (filterStatus !== 'all')
      result = result.filter((t) => t.status === filterStatus);
    if (filterEnergy !== 'all')
      result = result.filter((t) => t.energyLevel === filterEnergy);
    if (filterTag)
      result = result.filter((t) =>
        t.tags.some((tag) => tag.toLowerCase().includes(filterTag.toLowerCase()))
      );

    result.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return a.priority - b.priority;
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'createdAt':
          return b.createdAt.localeCompare(a.createdAt);
        case 'energyLevel': {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.energyLevel] - order[b.energyLevel];
        }
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, filterCategory, filterStatus, filterEnergy, filterTag, sortBy]);

  const handleQuickAdd = async () => {
    if (!quickAddInput.trim()) return;
    const parsed = parseQuickAdd(quickAddInput);
    const task: Task = {
      id: uuidv4(),
      title: parsed.title || quickAddInput,
      category: parsed.category || 'personal',
      priority: parsed.priority || 3,
      estimatedMinutes: parsed.estimatedMinutes || 30,
      status: 'pending',
      tags: parsed.tags || [],
      energyLevel: parsed.energyLevel || 'medium',
      createdAt: new Date().toISOString(),
      dueDate: parsed.dueDate,
      recurrence: parsed.recurrence,
      description: parsed.description,
    };
    await addTask(task);
    setQuickAddInput('');
  };

  const handleToggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkComplete = async () => {
    await bulkUpdateTasks(Array.from(selected), {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    setSelected(new Set());
  };

  const handleBulkDefer = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await bulkUpdateTasks(Array.from(selected), {
      status: 'deferred',
      dueDate: tomorrow.toISOString().split('T')[0],
    });
    setSelected(new Set());
  };

  const handleBulkDelete = async () => {
    await bulkDeleteTasks(Array.from(selected));
    setSelected(new Set());
  };

  const handleComplete = async (task: Task) => {
    await updateTask({
      ...task,
      status: task.status === 'completed' ? 'pending' : 'completed',
      completedAt:
        task.status === 'completed' ? undefined : new Date().toISOString(),
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Quick Add */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={quickAddInput}
            onChange={(e) => setQuickAddInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
            placeholder='Quick add: "Review report | work | p2 | 45m | due:tomorrow | energy:high"'
            className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleQuickAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Add
          </button>
          <button
            onClick={() => {
              setEditingTask(null);
              setShowForm(true);
            }}
            className="bg-surface hover:bg-surface-hover border border-border text-text px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Detailed
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="bg-surface hover:bg-surface-hover border border-border text-text-muted px-3 py-2 rounded-lg text-sm"
          >
            Import
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="all">All Categories</option>
          <option value="work">Work</option>
          <option value="personal">Personal</option>
          <option value="fun">Fun</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="deferred">Deferred</option>
        </select>
        <select
          value={filterEnergy}
          onChange={(e) => setFilterEnergy(e.target.value as EnergyLevel | 'all')}
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="all">All Energy</option>
          <option value="high">High Energy</option>
          <option value="medium">Medium Energy</option>
          <option value="low">Low Energy</option>
        </select>
        <input
          type="text"
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          placeholder="Filter by tag..."
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-text placeholder:text-text-muted w-36"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-text"
        >
          <option value="priority">Sort: Priority</option>
          <option value="dueDate">Sort: Due Date</option>
          <option value="category">Sort: Category</option>
          <option value="createdAt">Sort: Newest</option>
          <option value="energyLevel">Sort: Energy</option>
        </select>
        <span className="text-text-muted text-sm self-center ml-auto">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex gap-2 mb-4 p-3 bg-surface rounded-lg border border-border">
          <span className="text-sm text-text-muted self-center">
            {selected.size} selected
          </span>
          <button
            onClick={handleBulkComplete}
            className="bg-green-600/20 text-green-400 px-3 py-1 rounded text-sm hover:bg-green-600/30"
          >
            Complete All
          </button>
          <button
            onClick={handleBulkDefer}
            className="bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded text-sm hover:bg-yellow-600/30"
          >
            Defer to Tomorrow
          </button>
          <button
            onClick={handleBulkDelete}
            className="bg-red-600/20 text-red-400 px-3 py-1 rounded text-sm hover:bg-red-600/30"
          >
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-text-muted px-3 py-1 rounded text-sm hover:bg-surface-hover"
          >
            Clear
          </button>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 && (
          <div className="text-center text-text-muted py-12">
            No tasks yet. Add one above!
          </div>
        )}
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3 hover:bg-surface-hover transition-colors ${
              task.status === 'completed' ? 'opacity-60' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(task.id)}
              onChange={() => handleToggleSelect(task.id)}
              className="shrink-0 w-4 h-4 rounded accent-blue-500"
            />
            <button
              onClick={() => handleComplete(task)}
              className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                task.status === 'completed'
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-border hover:border-green-500'
              }`}
            >
              {task.status === 'completed' && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`font-medium text-sm ${
                    task.status === 'completed' ? 'line-through text-text-muted' : ''
                  }`}
                >
                  {task.title}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[task.category]}`}>
                  {task.category}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status]}`}>
                  {task.status}
                </span>
                {task.tags.map((tag) => (
                  <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                <span>{PRIORITY_LABELS[task.priority]}</span>
                <span>{task.estimatedMinutes}m</span>
                <span className="capitalize">{task.energyLevel} energy</span>
                {task.dueDate && (
                  <span
                    className={
                      new Date(task.dueDate + 'T00:00:00') <= new Date()
                        ? 'text-red-400 font-medium'
                        : ''
                    }
                  >
                    Due: {task.dueDate}
                  </span>
                )}
                {task.recurrence && (
                  <span className="text-blue-400">
                    Recurs:{' '}
                    {typeof task.recurrence === 'string'
                      ? task.recurrence
                      : 'custom'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setEditingTask(task);
                setShowForm(true);
              }}
              className="text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-hover text-sm"
            >
              Edit
            </button>
            <button
              onClick={() => deleteTask(task.id)}
              className="text-text-muted hover:text-red-400 px-2 py-1 rounded hover:bg-surface-hover text-sm"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Task Form Modal */}
      {showForm && (
        <TaskForm
          task={editingTask}
          onSave={async (task) => {
            if (editingTask) {
              await updateTask(task);
            } else {
              await addTask(task);
            }
            setShowForm(false);
            setEditingTask(null);
          }}
          onClose={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onImport={async (importedTasks) => {
            await importTasks(importedTasks);
            setShowImport(false);
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
