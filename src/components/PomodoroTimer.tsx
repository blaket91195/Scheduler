import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  title: string;
  onClose: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

const FIREWORK_COLORS = [
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#06b6d4',
];

function Fireworks({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const burstCountRef = useRef(0);

  const createBurst = useCallback((cx: number, cy: number) => {
    const count = 40 + Math.floor(Math.random() * 20);
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 2 + Math.random() * 4;
      const maxLife = 60 + Math.floor(Math.random() * 40);
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 2,
        life: maxLife,
        maxLife,
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Launch bursts over time
    const burstInterval = setInterval(() => {
      burstCountRef.current++;
      const x = Math.random() * canvas.width * 0.6 + canvas.width * 0.2;
      const y = Math.random() * canvas.height * 0.4 + canvas.height * 0.1;
      createBurst(x, y);
      if (burstCountRef.current >= 6) clearInterval(burstInterval);
    }, 400);

    // Initial burst
    createBurst(canvas.width / 2, canvas.height / 3);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // gravity
        p.vx *= 0.98; // drag
        p.life--;

        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();

        // Trail
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.arc(p.x - p.vx, p.y - p.vy, p.size * alpha * 0.5, 0, Math.PI * 2);
        ctx.fill();

        if (p.life <= 0) particles.splice(i, 1);
      }
      ctx.globalAlpha = 1;

      if (particles.length > 0 || burstCountRef.current < 6) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        onDone();
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      clearInterval(burstInterval);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [createBurst, onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100]"
    />
  );
}

export function PomodoroTimer({ title, onClose }: Props) {
  const [seconds, setSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [showFireworks, setShowFireworks] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    } else if (seconds === 0) {
      if (!isBreak) {
        setPomodoroCount((c) => c + 1);
        setShowFireworks(true);
        setIsBreak(true);
        setSeconds(5 * 60);
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
    <>
      {showFireworks && (
        <Fireworks onDone={() => setShowFireworks(false)} />
      )}
      <div className="fixed bottom-6 right-6 bg-surface border border-border rounded-xl p-5 shadow-2xl z-50 w-72">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium truncate">{title}</h3>
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
    </>
  );
}
