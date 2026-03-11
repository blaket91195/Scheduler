import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'planner.json');

const app = express();
app.use(cors());
app.use(express.json());

const DEFAULT_DATA = {
  tasks: [],
  schedule: [],
  config: {
    workStart: '08:30',
    workEnd: '17:00',
    eveningStart: '17:30',
    eveningEnd: '22:00',
    weekendStart: '09:00',
    weekendEnd: '22:00',
    peakStart: '09:00',
    peakEnd: '12:00',
    lunchTime: '12:00',
  },
};

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all data
app.get('/api/data', (_req, res) => {
  res.json(readData());
});

// Save all data
app.put('/api/data', (req, res) => {
  writeData(req.body);
  res.json({ ok: true });
});

// ---- Tasks CRUD ----
app.get('/api/tasks', (_req, res) => {
  const data = readData();
  res.json(data.tasks);
});

app.post('/api/tasks', (req, res) => {
  const data = readData();
  data.tasks.push(req.body);
  writeData(data);
  res.json(req.body);
});

app.put('/api/tasks/:id', (req, res) => {
  const data = readData();
  const idx = data.tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.tasks[idx] = req.body;
  writeData(data);
  res.json(req.body);
});

app.delete('/api/tasks/:id', (req, res) => {
  const data = readData();
  data.tasks = data.tasks.filter((t) => t.id !== req.params.id);
  // Also remove schedule entries referencing this task
  data.schedule = data.schedule.filter((s) => s.taskId !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

// Bulk update tasks
app.post('/api/tasks/bulk', (req, res) => {
  const data = readData();
  const { action, taskIds, updates } = req.body;
  if (action === 'update') {
    data.tasks = data.tasks.map((t) =>
      taskIds.includes(t.id) ? { ...t, ...updates } : t
    );
  } else if (action === 'delete') {
    data.tasks = data.tasks.filter((t) => !taskIds.includes(t.id));
    data.schedule = data.schedule.filter((s) => !taskIds.includes(s.taskId));
  }
  writeData(data);
  res.json({ ok: true });
});

// ---- Schedule ----
app.get('/api/schedule', (req, res) => {
  const data = readData();
  const { date } = req.query;
  if (date) {
    res.json(data.schedule.filter((s) => s.date === date));
  } else {
    res.json(data.schedule);
  }
});

app.put('/api/schedule', (req, res) => {
  const data = readData();
  const { date, entries } = req.body;
  // Replace all entries for this date
  data.schedule = data.schedule.filter((s) => s.date !== date);
  data.schedule.push(...entries);
  writeData(data);
  res.json({ ok: true });
});

app.put('/api/schedule/:id', (req, res) => {
  const data = readData();
  const idx = data.schedule.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.schedule[idx] = req.body;
  writeData(data);
  res.json(req.body);
});

app.delete('/api/schedule/:id', (req, res) => {
  const data = readData();
  data.schedule = data.schedule.filter((s) => s.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

// ---- Config ----
app.get('/api/config', (_req, res) => {
  const data = readData();
  res.json(data.config);
});

app.put('/api/config', (req, res) => {
  const data = readData();
  data.config = req.body;
  writeData(data);
  res.json({ ok: true });
});

// ---- Export ----
app.get('/api/export/:format', (req, res) => {
  const data = readData();
  const { date } = req.query;
  const tasks = data.tasks;
  const schedule = date
    ? data.schedule.filter((s) => s.date === date)
    : data.schedule;

  if (req.params.format === 'markdown') {
    let md = `# Daily Planner\n\n## Tasks\n\n`;
    tasks.forEach((t) => {
      const check = t.status === 'completed' ? 'x' : ' ';
      md += `- [${check}] **${t.title}** (${t.category}, P${t.priority}, ${t.estimatedMinutes}m)\n`;
    });
    if (schedule.length) {
      md += `\n## Schedule${date ? ` - ${date}` : ''}\n\n`;
      schedule.forEach((s) => {
        md += `- ${s.startTime} - ${s.endTime}: ${s.title}\n`;
      });
    }
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename=planner.md');
    res.send(md);
  } else if (req.params.format === 'csv') {
    let csv = 'Title,Category,Priority,Duration (min),Status,Due Date,Tags\n';
    tasks.forEach((t) => {
      csv += `"${t.title}","${t.category}",${t.priority},${t.estimatedMinutes},"${t.status}","${t.dueDate || ''}","${t.tags.join(', ')}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
    res.send(csv);
  } else {
    res.status(400).json({ error: 'Unsupported format' });
  }
});

// ---- Import ----
app.post('/api/import', (req, res) => {
  const data = readData();
  const { tasks: importedTasks } = req.body;
  if (Array.isArray(importedTasks)) {
    data.tasks.push(...importedTasks);
    writeData(data);
    res.json({ imported: importedTasks.length });
  } else {
    res.status(400).json({ error: 'Invalid import data' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Planner API running on http://localhost:${PORT}`);
});
