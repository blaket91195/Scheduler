import { useState, useEffect, useRef } from 'react';
import type { ScheduleEntry } from '../types';

interface Props {
  entry: ScheduleEntry;
  onClose: () => void;
}

export function PomodoroTimer({ entry, onClose }: Props) {
  const [seconds, setSeconds] = useState(25 * 60); // 25 min default
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    } else if (seconds === 0) {
      if (!isBreak) {
        setPomodoroCount((c) => c + 1);
        setIsBreak(true);
        setSeconds(5 * 60); // 5 min break
      } else {
        setIsBreak(false);
        setSeconds(25 * 60);
      }
      setIsRunning(false);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds, isBreak]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = isBreak
    ? 1 - seconds / (5 * 60)
    : 1 - seconds / (25 * 60);

  return (
    <div className="fixed bottom-6 right-6 bg-surface border border-border rounded-xl p-5 shadow-2xl z-50 w-72">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium truncate">{entry.title}</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text text-sm">
          &times;
        </button>
      </div>

      <div className="text-center mb-4">
        <div className="text-4xl font-mono font-bold tabular-nums">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
        <div className="text-xs text-text-muted mt-1">
          {isBreak ? 'Break time' : 'Focus time'} | {pomodoroCount} pomodoros done
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-surface-hover rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isBreak ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex gap-2 justify-center">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-1.5 rounded text-sm font-medium ${
            isRunning
              ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={() => {
            setIsRunning(false);
            setSeconds(isBreak ? 5 * 60 : 25 * 60);
          }}
          className="px-4 py-1.5 rounded text-sm bg-surface-hover text-text-muted hover:text-text"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
