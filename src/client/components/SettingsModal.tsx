import { Settings, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useHotkeysContext } from 'react-hotkeys-hook';

import { DEFAULT_EDITOR_ID, EDITOR_OPTIONS, type EditorOptionId } from '../../utils/editorOptions';
import type { ColorVisionMode } from '../utils/appearanceTheme';
import { formatAutoViewedPatterns, parseAutoViewedPatterns } from '../utils/autoViewedPatterns';
import { LIGHT_THEMES, DARK_THEMES } from '../utils/themeLoader';
import { Tooltip } from './Tooltip';

interface AppearanceSettings {
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark' | 'auto';
  syntaxTheme: string;
  editor: EditorOptionId;
  colorVision: ColorVisionMode;
  autoViewedPatterns: string[];
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppearanceSettings;
  onSettingsChange: (settings: AppearanceSettings) => void;
}

type SettingsSection = 'appearance' | 'system';

const DEFAULT_SETTINGS: AppearanceSettings = {
  fontSize: 14,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  theme: 'dark',
  syntaxTheme: 'vsDark',
  editor: DEFAULT_EDITOR_ID,
  colorVision: 'normal',
  autoViewedPatterns: [],
};

const FONT_FAMILIES = [
  {
    name: 'System Font',
    value:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  },
  { name: 'Menlo', value: 'Menlo, Monaco, "Courier New", monospace' },
  { name: 'SF Mono', value: 'SF Mono, Consolas, "Liberation Mono", monospace' },
  { name: 'Fira Code', value: '"Fira Code", "Courier New", monospace' },
  { name: 'JetBrains Mono', value: '"JetBrains Mono", "Courier New", monospace' },
];

const COLOR_VISION_MODES = [
  { id: 'normal', label: 'Normal' },
  {
    id: 'deuteranopia',
    label: 'Deuteranopia',
    tooltip: 'Deuteranopia mode uses blue/orange instead of green/red for diffs.',
  },
] as const;

const SETTINGS_SECTIONS = [
  {
    id: 'appearance',
    label: 'Appearance',
  },
  {
    id: 'system',
    label: 'System',
  },
] as const;

export function SettingsModal({ isOpen, onClose, settings, onSettingsChange }: SettingsModalProps) {
  const [autoViewedPatternsInput, setAutoViewedPatternsInput] = useState(
    formatAutoViewedPatterns(settings.autoViewedPatterns),
  );
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const { enableScope, disableScope } = useHotkeysContext();

  // Manage scopes when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Disable navigation scope when settings modal is open
      disableScope('navigation');
    } else {
      // Re-enable navigation scope when modal closes
      enableScope('navigation');
    }

    return () => {
      // Cleanup: ensure navigation scope is enabled
      enableScope('navigation');
    };
  }, [isOpen, enableScope, disableScope]);

  // Get current theme (resolve 'auto' to actual theme)
  const getCurrentTheme = (): 'light' | 'dark' => {
    if (settings.theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return settings.theme;
  };

  // Get available themes based on current background color
  const getAvailableThemes = () => {
    const currentTheme = getCurrentTheme();
    return currentTheme === 'light' ? LIGHT_THEMES : DARK_THEMES;
  };

  // Handle theme change and auto-select valid syntax theme
  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    const newSettings = { ...settings, theme };

    // Determine the effective theme
    const effectiveTheme =
      theme === 'auto'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;

    // Check if current syntax theme is valid for the new theme
    const availableThemes = effectiveTheme === 'light' ? LIGHT_THEMES : DARK_THEMES;
    const isCurrentThemeValid = availableThemes.some((t) => t.id === settings.syntaxTheme);

    // If current theme becomes invalid, auto-select first item
    if (!isCurrentThemeValid && availableThemes.length > 0) {
      const firstTheme = availableThemes[0];
      if (firstTheme) {
        newSettings.syntaxTheme = firstTheme.id;
      }
    }

    onSettingsChange(newSettings);
  };

  const handleReset = () => {
    if (activeSection === 'appearance') {
      onSettingsChange({
        ...settings,
        fontSize: DEFAULT_SETTINGS.fontSize,
        fontFamily: DEFAULT_SETTINGS.fontFamily,
        theme: DEFAULT_SETTINGS.theme,
        syntaxTheme: DEFAULT_SETTINGS.syntaxTheme,
        colorVision: DEFAULT_SETTINGS.colorVision,
      });
      return;
    }

    onSettingsChange({
      ...settings,
      editor: DEFAULT_SETTINGS.editor,
      autoViewedPatterns: DEFAULT_SETTINGS.autoViewedPatterns,
    });
    setAutoViewedPatternsInput(formatAutoViewedPatterns(DEFAULT_SETTINGS.autoViewedPatterns));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-github-bg-secondary border border-github-border rounded-lg w-full max-w-3xl mx-4 pointer-events-auto overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-github-border">
          <h2 className="text-lg font-semibold text-github-text-primary flex items-center gap-2">
            <Settings size={20} />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-github-text-secondary hover:text-github-text-primary p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row min-h-[420px]">
          <nav
            aria-label="Settings sections"
            className="sm:w-40 border-b sm:border-b-0 sm:border-r border-github-border px-3 py-2"
          >
            <div className="flex sm:flex-col gap-1">
              {SETTINGS_SECTIONS.map((section) => {
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    aria-pressed={isActive}
                    className={`flex-1 sm:flex-none text-left px-3 py-2 text-sm font-medium transition-colors border-b-2 sm:border-b-0 sm:border-l-2 ${
                      isActive
                        ? 'text-github-text-primary border-github-accent'
                        : 'text-github-text-secondary border-transparent hover:text-github-text-primary'
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-github-text-primary mb-2">
                    Font Size
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="10"
                      max="20"
                      step="1"
                      value={settings.fontSize}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          fontSize: Number.parseInt(e.target.value, 10),
                        })
                      }
                      className="flex-1 accent-github-accent"
                    />
                    <span className="text-sm text-github-text-secondary w-8 text-right">
                      {settings.fontSize}px
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-github-text-primary mb-2">
                    Font Family
                  </label>
                  <select
                    value={settings.fontFamily}
                    onChange={(e) => onSettingsChange({ ...settings, fontFamily: e.target.value })}
                    className="w-full p-2 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary text-sm"
                  >
                    {FONT_FAMILIES.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-github-text-primary mb-2">
                    Theme
                  </label>
                  <div className="flex gap-2">
                    {(['light', 'dark', 'auto'] as const).map((theme) => (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => handleThemeChange(theme)}
                        className={`px-3 py-2 text-sm rounded border transition-colors ${
                          settings.theme === theme
                            ? 'bg-github-accent text-white border-github-accent'
                            : 'bg-github-bg-tertiary text-github-text-secondary border-github-border hover:text-github-text-primary'
                        }`}
                      >
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-github-text-primary mb-2">
                    Color Vision
                  </label>
                  <div className="flex gap-2">
                    {COLOR_VISION_MODES.map((mode) => {
                      const isSelected = (settings.colorVision ?? 'normal') === mode.id;
                      const button = (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => onSettingsChange({ ...settings, colorVision: mode.id })}
                          className={`px-3 py-2 text-sm rounded border transition-colors ${
                            isSelected
                              ? 'bg-github-accent text-white border-github-accent'
                              : 'bg-github-bg-tertiary text-github-text-secondary border-github-border hover:text-github-text-primary'
                          }`}
                        >
                          {mode.label}
                        </button>
                      );

                      if (!('tooltip' in mode)) {
                        return button;
                      }

                      return (
                        <Tooltip key={mode.id} content={mode.tooltip}>
                          {button}
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-github-text-primary mb-2">
                    Syntax Highlighting Theme
                  </label>
                  <select
                    value={settings.syntaxTheme}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        syntaxTheme: e.target.value,
                      })
                    }
                    className="w-full p-2 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary text-sm"
                  >
                    {getAvailableThemes().map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {activeSection === 'system' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-github-text-primary mb-2">
                    Open In Editor
                  </label>
                  <select
                    value={settings.editor}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        editor: e.target.value as AppearanceSettings['editor'],
                      })
                    }
                    className="w-full p-2 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary text-sm"
                  >
                    {EDITOR_OPTIONS.map((editor) => (
                      <option key={editor.id} value={editor.id}>
                        {editor.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="auto-viewed-patterns"
                    className="block text-sm font-medium text-github-text-primary mb-2"
                  >
                    Auto-Mark Viewed Patterns
                  </label>
                  <p className="text-sm text-github-text-secondary mb-2">
                    Files matching these glob patterns are marked as Viewed automatically. Enter one
                    pattern per line.
                  </p>
                  <textarea
                    id="auto-viewed-patterns"
                    value={autoViewedPatternsInput}
                    onChange={(e) => {
                      setAutoViewedPatternsInput(e.target.value);
                      onSettingsChange({
                        ...settings,
                        autoViewedPatterns: parseAutoViewedPatterns(e.target.value),
                      });
                    }}
                    rows={6}
                    spellCheck={false}
                    placeholder={'*.test.ts\n*.stories.tsx\nsrc/generated/**'}
                    className="w-full p-3 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary text-sm font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-github-border">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm text-github-text-secondary hover:text-github-text-primary"
          >
            {activeSection === 'appearance' ? 'Reset Appearance Defaults' : 'Reset System Defaults'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-github-accent text-white rounded hover:bg-green-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export type { AppearanceSettings };
