import { Settings, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useHotkeysContext } from 'react-hotkeys-hook';

import { DEFAULT_EDITOR_ID, EDITOR_OPTIONS, type EditorOptionId } from '../../utils/editorOptions';
import { LIGHT_THEMES, DARK_THEMES } from '../utils/themeLoader';

interface AppearanceSettings {
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark' | 'auto';
  syntaxTheme: string;
  editor: EditorOptionId;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppearanceSettings;
  onSettingsChange: (settings: AppearanceSettings) => void;
}

const DEFAULT_SETTINGS: AppearanceSettings = {
  fontSize: 14,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  theme: 'dark',
  syntaxTheme: 'vsDark',
  editor: DEFAULT_EDITOR_ID,
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

export function SettingsModal({ isOpen, onClose, settings, onSettingsChange }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<AppearanceSettings>(settings);
  const { enableScope, disableScope } = useHotkeysContext();

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

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
    setLocalSettings(DEFAULT_SETTINGS);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-github-bg-secondary border border-github-border rounded-lg w-full max-w-md mx-4 pointer-events-auto">
        <div className="flex items-center justify-between p-4 border-b border-github-border">
          <h2 className="text-lg font-semibold text-github-text-primary flex items-center gap-2">
            <Settings size={20} />
            Appearance Settings
          </h2>
          <button
            onClick={onClose}
            className="text-github-text-secondary hover:text-github-text-primary p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Font Size */}
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
                  setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) })
                }
                className="flex-1 accent-github-accent"
              />
              <span className="text-sm text-github-text-secondary w-8 text-right">
                {localSettings.fontSize}px
              </span>
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium text-github-text-primary mb-2">
              Font Family
            </label>
            <select
              value={localSettings.fontFamily}
              onChange={(e) => setLocalSettings({ ...localSettings, fontFamily: e.target.value })}
              className="w-full p-2 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary text-sm"
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.name}
                </option>
              ))}
            </select>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-github-text-primary mb-2">Theme</label>
            <div className="flex gap-2">
              {(['light', 'dark', 'auto'] as const).map((theme) => (
                <button
                  key={theme}
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

          {/* Syntax Theme */}
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

          {/* Editor */}
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

        <div className="flex items-center justify-between p-4 border-t border-github-border">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm text-github-text-secondary hover:text-github-text-primary"
          >
            Reset to Default
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
