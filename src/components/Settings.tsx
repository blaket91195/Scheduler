import { useState } from 'react';
import type { ScheduleConfig } from '../types';

interface Props {
  config: ScheduleConfig;
  updateConfig: (config: ScheduleConfig) => Promise<void>;
}

export function Settings({ config, updateConfig }: Props) {
  const [localConfig, setLocalConfig] = useState<ScheduleConfig>({ ...config });
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updateConfig(localConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fields: { key: keyof ScheduleConfig; label: string; group: string }[] = [
    { key: 'workStart', label: 'Work Start', group: 'Work Hours' },
    { key: 'workEnd', label: 'Work End', group: 'Work Hours' },
    { key: 'eveningStart', label: 'Evening Start', group: 'Evening Hours' },
    { key: 'eveningEnd', label: 'Evening End', group: 'Evening Hours' },
    { key: 'weekendStart', label: 'Weekend Start', group: 'Weekend Hours' },
    { key: 'weekendEnd', label: 'Weekend End', group: 'Weekend Hours' },
    { key: 'peakStart', label: 'Peak Start', group: 'Peak Energy' },
    { key: 'peakEnd', label: 'Peak End', group: 'Peak Energy' },
    { key: 'lunchTime', label: 'Lunch Time', group: 'Breaks' },
    { key: 'dinnerTime', label: 'Dinner Time', group: 'Breaks' },
  ];

  const groups = [...new Set(fields.map((f) => f.group))];

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold mb-6">Schedule Configuration</h2>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group} className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-text-muted mb-4">{group}</h3>
            <div className="grid grid-cols-2 gap-4">
              {fields
                .filter((f) => f.group === group)
                .map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs text-text-muted mb-1">
                      {field.label}
                    </label>
                    <input
                      type="time"
                      value={localConfig[field.key]}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          [field.key]: e.target.value,
                        })
                      }
                      className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                    />
                  </div>
                ))}
              {group === 'Breaks' && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Dinner Duration (min)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={120}
                    step={15}
                    value={localConfig.dinnerDuration}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        dinnerDuration: parseInt(e.target.value) || 90,
                      })
                    }
                    className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium"
        >
          Save Configuration
        </button>
        {saved && (
          <span className="text-sm text-green-400">Saved!</span>
        )}
      </div>

      {/* Keyboard Shortcuts Reference */}
      <div className="mt-8 bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-muted mb-4">Keyboard Shortcuts</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['1', 'Dashboard'],
            ['2', 'Tasks'],
            ['3', 'Schedule'],
            ['4', 'Settings'],
            ['n', 'New task (opens Tasks)'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center gap-2">
              <kbd className="bg-surface-hover border border-border rounded px-2 py-0.5 text-xs font-mono">
                {key}
              </kbd>
              <span className="text-text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
