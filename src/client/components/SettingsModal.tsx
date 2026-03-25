import { Settings, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useHotkeysContext } from 'react-hotkeys-hook';

import { DEFAULT_EDITOR_ID, EDITOR_OPTIONS, type EditorOptionId } from '../../utils/editorOptions';
import type { ColorVisionMode } from '../utils/appearanceTheme';
import { LIGHT_THEMES, DARK_THEMES } from '../utils/themeLoader';
import { Tooltip } from './Tooltip';

interface AppearanceSettings {
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark' | 'auto';
  syntaxTheme: string;
  editor: EditorOptionId;
  colorVision: ColorVisionMode;
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
    description: 'Theme, typography, and syntax highlighting.',
  },
  {
    id: 'system',
    label: 'System',
    description: 'Editor integration and local environment behavior.',
  },
] as const;

export function SettingsModal({ isOpen, onClose, settings, onSettingsChange }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<AppearanceSettings>(settings);
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const { enableScope, disableScope } = useHotkeysContext();

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      setActiveSection('appearance');
    }
  }, [isOpen]);

  // Apply changes immediately for real-time preview
  useEffect(() => {
    onSettingsChange(localSettings);
  }, [localSettings, onSettingsChange]);

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
    if (localSettings.theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return localSettings.theme;
  };

  // Get available themes based on current background color
  const getAvailableThemes = () => {
    const currentTheme = getCurrentTheme();
    return currentTheme === 'light' ? LIGHT_THEMES : DARK_THEMES;
  };

  // Handle theme change and auto-select valid syntax theme
  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    const newSettings = { ...localSettings, theme };

    // Determine the effective theme
    const effectiveTheme =
      theme === 'auto'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;

    // Check if current syntax theme is valid for the new theme
    const availableThemes = effectiveTheme === 'light' ? LIGHT_THEMES : DARK_THEMES;
    const isCurrentThemeValid = availableThemes.some((t) => t.id === localSettings.syntaxTheme);

    // If current theme becomes invalid, auto-select first item
    if (!isCurrentThemeValid && availableThemes.length > 0) {
      const firstTheme = availableThemes[0];
      if (firstTheme) {
        newSettings.syntaxTheme = firstTheme.id;
      }
    }

    setLocalSettings(newSettings);
  };

  const handleReset = () => {
    if (activeSection === 'appearance') {
      setLocalSettings({
        ...localSettings,
        fontSize: DEFAULT_SETTINGS.fontSize,
        fontFamily: DEFAULT_SETTINGS.fontFamily,
        theme: DEFAULT_SETTINGS.theme,
        syntaxTheme: DEFAULT_SETTINGS.syntaxTheme,
        colorVision: DEFAULT_SETTINGS.colorVision,
      });
      return;
    }

    setLocalSettings({
      ...localSettings,
      editor: DEFAULT_SETTINGS.editor,
    });
  };

  if (!isOpen) return null;

  const activeSectionMeta = SETTINGS_SECTIONS.find((section) => section.id === activeSection);

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
            className="sm:w-64 border-b sm:border-b-0 sm:border-r border-github-border bg-github-bg-primary p-3"
          >
            <div className="flex sm:flex-col gap-2">
              {SETTINGS_SECTIONS.map((section) => {
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    aria-pressed={isActive}
                    className={`flex-1 sm:flex-none text-left rounded-md border px-3 py-3 transition-colors ${
                      isActive
                        ? 'bg-github-accent text-white border-github-accent'
                        : 'bg-github-bg-secondary text-github-text-secondary border-github-border hover:text-github-text-primary'
                    }`}
                  >
                    <div className="text-sm font-medium">{section.label}</div>
                    <div
                      className={`mt-1 text-xs leading-relaxed ${
                        isActive ? 'text-white' : 'text-github-text-muted'
                      }`}
                    >
                      {section.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-github-text-primary">
                {activeSectionMeta?.label}
              </h3>
              <p className="mt-1 text-sm text-github-text-secondary">
                {activeSectionMeta?.description}
              </p>
            </div>

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
                      value={localSettings.fontSize}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          fontSize: Number.parseInt(e.target.value, 10),
                        })
                      }
                      className="flex-1 accent-github-accent"
                    />
                    <span className="text-sm text-github-text-secondary w-8 text-right">
                      {localSettings.fontSize}px
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-github-text-primary mb-2">
                    Font Family
                  </label>
                  <select
                    value={localSettings.fontFamily}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, fontFamily: e.target.value })
                    }
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
                          localSettings.theme === theme
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
                      const isSelected = (localSettings.colorVision ?? 'normal') === mode.id;
                      const button = (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() =>
                            setLocalSettings({ ...localSettings, colorVision: mode.id })
                          }
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
                    value={localSettings.syntaxTheme}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
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
                    value={localSettings.editor}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
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
