import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Category, Priority, EnergyLevel } from '../types';

interface Props {
  onImport: (tasks: Task[]) => Promise<void>;
  onClose: () => void;
}

export function ImportModal({ onImport, onClose }: Props) {
  const [text, setText] = useState('');
  const [format, setFormat] = useState<'csv' | 'markdown'>('markdown');

  const handleImport = async () => {
    const tasks: Task[] = [];

    if (format === 'markdown') {
      // Parse markdown checklist: - [ ] Task title
      const lines = text.split('\n');
      for (const line of lines) {
        const match = line.match(/^[-*]\s*\[([x ])\]\s*(.+)$/i);
        if (match) {
          const completed = match[1].toLowerCase() === 'x';
          tasks.push({
            id: uuidv4(),
            title: match[2].trim(),
            category: 'personal',
            priority: 3,
            estimatedMinutes: 30,
            status: completed ? 'completed' : 'pending',
            tags: [],
            energyLevel: 'medium',
            createdAt: new Date().toISOString(),
            completedAt: completed ? new Date().toISOString() : undefined,
          });
        }
      }
    } else {
      // Parse CSV
      const lines = text.split('\n').filter((l) => l.trim());
      const hasHeader = lines[0]?.toLowerCase().includes('title');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      for (const line of dataLines) {
        // Simple CSV parser (handles quoted fields)
        const fields: string[] = [];
        let current = '';
        let inQuote = false;
        for (const char of line) {
          if (char === '"') {
            inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
            fields.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        fields.push(current.trim());

        if (fields.length >= 1 && fields[0]) {
          const validCategories: Category[] = ['work', 'personal', 'fun'];
          const validStatuses = ['pending', 'in-progress', 'completed', 'deferred'];
          const validEnergy = ['high', 'medium', 'low'];
          const cat = fields[1]?.toLowerCase();
          const statusVal = fields[7]?.toLowerCase().trim();
          const energyVal = fields[5]?.toLowerCase().trim();
          tasks.push({
            id: uuidv4(),
            title: fields[0],
            category: validCategories.includes(cat as Category)
              ? (cat as Category)
              : 'personal',
            priority: (Math.min(5, Math.max(1, parseInt(fields[2]) || 3)) as Priority),
            estimatedMinutes: parseInt(fields[3]) || 30,
            status: validStatuses.includes(statusVal)
              ? (statusVal as Task['status'])
              : 'pending',
            tags: fields[6] ? fields[6].split(',').map((t) => t.trim()).filter(Boolean) : [],
            energyLevel: validEnergy.includes(energyVal || '')
              ? (energyVal as EnergyLevel)
              : 'medium',
            createdAt: new Date().toISOString(),
            completedAt: statusVal === 'completed' ? new Date().toISOString() : undefined,
            dueDate: fields[4]?.trim() || undefined,
          });
        }
      }
    }

    if (tasks.length > 0) {
      await onImport(tasks);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Import Tasks</h2>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setFormat('markdown')}
            className={`px-3 py-1 rounded text-sm ${
              format === 'markdown' ? 'bg-blue-600 text-white' : 'bg-surface-hover text-text-muted'
            }`}
          >
            Markdown
          </button>
          <button
            onClick={() => setFormat('csv')}
            className={`px-3 py-1 rounded text-sm ${
              format === 'csv' ? 'bg-blue-600 text-white' : 'bg-surface-hover text-text-muted'
            }`}
          >
            CSV
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={
            format === 'markdown'
              ? '- [ ] Task one\n- [x] Task two (completed)\n- [ ] Task three'
              : 'Title,Category,Priority,Duration,DueDate,Energy,Tags,Status\nReview report,work,2,45,2026-03-12,high,client-work,pending'
          }
          className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text font-mono placeholder:text-text-muted focus:outline-none focus:border-blue-500 resize-none"
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleImport}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium"
          >
            Import
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-hover text-text-muted rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
