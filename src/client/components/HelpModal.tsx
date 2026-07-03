import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useHotkeys, useHotkeysContext } from 'react-hotkeys-hook';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { enableScope, disableScope } = useHotkeysContext();

  // Handle Escape key to close modal
  useHotkeys('escape', () => onClose(), { enabled: isOpen }, [onClose, isOpen]);

  // Manage scopes when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Disable navigation scope when help modal is open
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-github-bg-primary border border-github-border rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-github-bg-primary border-b border-github-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-github-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-github-text-secondary hover:text-github-text-primary transition-colors"
            aria-label="Close help modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <h3 className="text-sm font-semibold text-github-text-primary mb-2">Line Navigation</h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex gap-2">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    j
                  </kbd>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    ↓
                  </kbd>
                </div>
                <span className="text-github-text-secondary">Next line</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex gap-2">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    k
                  </kbd>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    ↑
                  </kbd>
                </div>
                <span className="text-github-text-secondary">Previous line</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-github-text-primary mb-2">File Navigation</h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  ]
                </kbd>
                <span className="text-github-text-secondary">Next file</span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  [
                </kbd>
                <span className="text-github-text-secondary">Previous file</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    Shift
                  </kbd>
                  <span className="text-github-text-muted">+</span>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    [
                  </kbd>
                </div>
                <span className="text-github-text-secondary">Jump to first file</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    Shift
                  </kbd>
                  <span className="text-github-text-muted">+</span>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    ]
                  </kbd>
                </div>
                <span className="text-github-text-secondary">Jump to last file</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-github-text-primary mb-2">
              Chunk Navigation
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  n
                </kbd>
                <span className="text-github-text-secondary">
                  Next change chunk (added/deleted lines)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  p
                </kbd>
                <span className="text-github-text-secondary">
                  Previous change chunk (added/deleted lines)
                </span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-github-text-primary mb-2">
              Comment Navigation
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  N
                </kbd>
                <span className="text-github-text-secondary">Next comment</span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  P
                </kbd>
                <span className="text-github-text-secondary">Previous comment</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-github-text-primary mb-2">
              Side Navigation (Side-by-side mode)
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex gap-2">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    h
                  </kbd>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    ←
                  </kbd>
                </div>
                <span className="text-github-text-secondary">Focus left side</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex gap-2">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    l
                  </kbd>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    →
                  </kbd>
                </div>
                <span className="text-github-text-secondary">Focus right side</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-github-text-primary mb-2">
              Comment Management
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    Shift
                  </kbd>
                  <span className="text-github-text-muted">+</span>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    L
                  </kbd>
                </div>
                <span className="text-github-text-secondary">View all comments list</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    Shift
                  </kbd>
                  <span className="text-github-text-muted">+</span>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    C
                  </kbd>
                </div>
                <span className="text-github-text-secondary">Copy all comments prompt</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    Shift
                  </kbd>
                  <span className="text-github-text-muted">+</span>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    D
                  </kbd>
                </div>
                <span className="text-github-text-secondary">Delete all comments</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-github-text-primary mb-2">Actions</h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  v
                </kbd>
                <span className="text-github-text-secondary">
                  Toggle viewed state of current (or hovered) file
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    Shift
                  </kbd>
                  <span className="text-github-text-muted">+</span>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    V
                  </kbd>
                </div>
                <span className="text-github-text-secondary">
                  Mark file as viewed and go to next unviewed file
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    Shift
                  </kbd>
                  <span className="text-github-text-muted">+</span>
                  <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                    R
                  </kbd>
                </div>
                <span className="text-github-text-secondary">
                  Refresh diff when changes detected
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  c
                </kbd>
                <span className="text-github-text-secondary">Add comment at current line</span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  .
                </kbd>
                <span className="text-github-text-secondary">
                  Move cursor to center of viewport
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary font-mono">
                  ?
                </kbd>
                <span className="text-github-text-secondary">Show/hide this help</span>
              </div>
            </div>
          </section>

          <div className="pt-4 border-t border-github-border lg:col-span-2">
            <p className="text-xs text-github-text-secondary">
              Shortcuts are disabled when typing in input fields.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
