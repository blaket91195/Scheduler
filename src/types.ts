export type Category = 'work' | 'personal' | 'fun';
export type Priority = 1 | 2 | 3 | 4 | 5;
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'deferred' | 'cancelled';
export type EnergyLevel = 'high' | 'medium' | 'low';
export type RecurrenceRule =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | { type: 'custom'; days: number[] }; // 0=Sun, 1=Mon, ..., 6=Sat

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: Category;
  priority: Priority;
  estimatedMinutes: number;
  dueDate?: string; // ISO date string
  recurrence?: RecurrenceRule;
  status: TaskStatus;
  tags: string[];
  energyLevel: EnergyLevel;
  createdAt: string;
  completedAt?: string;
  parentRecurringId?: string; // for generated instances
}

export interface ScheduleEntry {
  id: string;
  taskId?: string;
  title: string; // for custom blocks
  category: Category | 'break';
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  locked: boolean;
  date: string; // ISO date string
}

export interface ScheduleConfig {
  workStart: string; // HH:MM
  workEnd: string;
  eveningStart: string;
  eveningEnd: string;
  weekendStart: string;
  weekendEnd: string;
  peakStart: string;
  peakEnd: string;
  lunchTime: string;
  lunchDuration: number; // minutes
  dinnerTime: string;
  dinnerDuration: number; // minutes
}

export const DEFAULT_CONFIG: ScheduleConfig = {
  workStart: '08:30',
  workEnd: '17:00',
  eveningStart: '17:30',
  eveningEnd: '22:00',
  weekendStart: '09:00',
  weekendEnd: '22:00',
  peakStart: '09:00',
  peakEnd: '12:00',
  lunchTime: '12:00',
  lunchDuration: 30,
  dinnerTime: '18:00',
  dinnerDuration: 90,
};

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date string (YYYY-MM-DD)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  recurrence?: RecurrenceRule;
  color?: string; // hex color for display
  location?: string;
  createdAt: string;
}

export interface AppData {
  tasks: Task[];
  schedule: ScheduleEntry[];
  config: ScheduleConfig;
  events: CalendarEvent[];
}

export interface WeeklySummary {
  tasksCompleted: number;
  timeByCategory: Record<Category, number>;
  recurringStreaks: Record<string, number>;
}
