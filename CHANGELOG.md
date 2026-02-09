# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [3.1.6] - 2026-02-09

### Added

- Add previous commit quick preset

### Changed

- Update dependencies (#201 #203)

### Fixed

- Keep iframe scroll changes inside diff container
- Prefetch markdown full preview before showing tab

## [3.1.5] - 2026-02-05

### Added

- Mobile View Support (#200)

### Fixed

- Handle mjs/cjs/mts/cts syntax

## [3.1.4] - 2026-02-04

### Added

- Quick diff menu with commit picker and detail modal (#198)

## [3.1.3] - 2026-02-04

### Added

- Jupyter notebook viewer (#192)
- Open-in-editor actions in diff viewer (#196)
- Persist sidebar width

### Changed

- Rename diff mode labels to split/unified (#195)
- Update dependencies (#190 #191 #193 #194)

## [3.1.2] - 2026-02-01

### Added

- Markdown full preview support
- Enhance markdown preview
- Add markdown all-syntax sample

## [3.1.1] - 2026-01-31

### Added

- Add markdown diff viewer (#187)

### Changed

- Update Prettier trailing comma setting to `all`
- make diff viewers pluggable
- Remove unnecessary chunk header props from comments

## [3.1.0] - 2026-01-31

### Added

- Export hidden lines in diff view (#176)

### Fixed

- Performance improvement for diff viewer rerenders

### Thanks

- [@GarrickZ2](https://github.com/GarrickZ2) for supporting hidden line expansion in diffs #176

## [3.0.9] - 2026-01-30

### Fixed

- Restore scroll-to-top on sticky folder click

## [3.0.8] - 2026-01-29

### Changed

- Performance improvement for sticky directory headers in file tree

## [3.0.7] - 2026-01-29

### Added

- Add sticky directory headers in file tree (#185)

### Thanks

- [@harunonsystem](https://github.com/harunonsystem) for adding sticky directory headers in file tree #185

## [3.0.6] - 2026-01-28

### Added

- Add Perl syntax highlighting support (#182)

### Changed

- Update dependencies #178 #179 #180 #181

### Thanks

- [@sakamossan](https://github.com/sakamossan) for adding Perl syntax highlighting support #182

## [3.0.5] - 2026-01-22

### Added

- Apply color-scheme CSS property for native browser UI dark mode (#172)

### Changed

- Update dependency happy-dom to v20.1.0 (#173)
- Update dependency vite to v7.3.1 (#171)

### Thanks

- [@y-hiraoka](https://github.com/y-hiraoka) for applying color-scheme CSS property for native browser UI dark mode #172

## [3.0.4] - 2026-01-21

### Changed

- Update dependency globals to v17 (#170)
- Update all dev dependencies (#169)
- Swap expand/collapse icon in sidebar

### Added

- Add --include-untracked flag for non-interactive mode (#168)

### Thanks

- [@koh-sh](https://github.com/koh-sh) for adding --include-untracked flag for non-interactive mode #168

## [3.0.3] - 2026-01-19

### Fixed

- Support git worktree in file watcher (#167)

### Thanks

- [@t14i](https://github.com/t14i) for supporting git worktree in file watcher #167

## [3.0.2] - 2026-01-16

### Added

- Revision selector for dynamic base/target selection (#165)

### Changed

- Update Claude release command workflow

## [3.0.1] - 2026-01-16

### Added

- Collapse/expand all button to Files Changed sidebar
- Independent file collapse state with Alt+Click support (#164)
  - Decouple collapse state from viewed state
  - Alt+Click to collapse/expand all files
  - Smooth scroll when marking file as viewed

## [3.0.0] - 2026-01-16

### Added

- Auto-collapse deleted files in diff view (#146)
- Support for launching difit from repository subfolders (#153)

### Fixed

- Working diff isolation bugs with comments and view status (#149)

### Thanks

- [@tsukasaI](https://github.com/tsukasaI) for auto-collapse deleted files feature #146
- [@GarrickZ2](https://github.com/GarrickZ2) for fixing working diff isolation bugs #149
- [@jonashaag](https://github.com/jonashaag) for adding support for launching from repo subfolders #153

## [2.2.7] - 2025-12-21

### Added

- Terraform/HCL syntax highlighting support (#145)

### Thanks

- [@tsukasaI](https://github.com/tsukasaI) for adding Terraform/HCL syntax highlighting support #145

## [2.2.6] - 2025-12-19

### Added

- Automatically collapse generated files in diff view (#136)

### Fixed

- Filter comments by side to prevent duplication and incorrect positioning (#137)
- Comment form now opens on correct side (old/new) in both inline and side-by-side modes

### Thanks

- [@tsukasaI](https://github.com/tsukasaI) for implementing auto-collapse for generated files #136
- [@GarrickZ2](https://github.com/GarrickZ2) for fixing comment side filtering #137

## [2.2.5] - 2025-12-08

### Added

- Word-level diff highlighting showing changed words with darker background (#126)

### Changed

- Enable ESLint React Hooks new rules with immutability and set-state-in-effect checks (#132)
- Update major dependencies (#130)

### Thanks

- [@gehnmaisoda](https://github.com/gehnmaisoda) for adding word-level diff highlighting #126

## [2.2.4] - 2025-11-28

### Changed

- Bump vitest to v4 (#112)
- Remove unused dracula deps (#111)

### Fixed

- Display modifier key on platforms other than macOS (#121)
- Increase code font size to match UI font size
- Dependencies updates

### Thanks

- [@yoshi-taka](https://github.com/yoshi-taka) for bumping vitest to v4 #112 and removing unused dracula deps #111
- [@syohex](https://github.com/syohex) for fixing modifier key display #121

## [2.2.3] - 2025-10-22

### Added

- Renovate bot configuration for automated dependency updates (#98)

### Changed

- Persist diff view mode setting after page refresh (#106)

### Thanks

- [@MtDeity](https://github.com/MtDeity) for persisting diff view mode after refresh #106

## [2.2.2] - 2025-09-18

### Added

- SECURITY.md for security vulnerability reporting guidelines

### Changed

- Use optional chaining for key checks in localStorage (#90)
- Refactored GitHub Actions workflows for improved maintainability (#93)
  - Extract common CI steps to reusable workflow
  - Pin GitHub Actions to specific SHAs for security
  - Performance workflow limited to src changes only

### Fixed

- Make --clean flag properly reset viewed files counter (#92)
- Normalize git diff paths and handle various edge cases (#96)
  - Robust git path decoding for binary and complex file names
  - Fixed false rename detection for new files
  - Properly handle alternate diff prefixes (c/, w/, etc.)
  - Correct comment line markers with spaces in paths

### Thanks

- [@emcd](https://github.com/emcd) for fixing --clean flag behavior #92
- [@noritaka1166](https://github.com/noritaka1166) for localStorage refactoring #90

## [2.2.1] - 2025-08-24

### Added

- Support for Svelte syntax highlighting (#85)

### Changed

- Replace uuid package with native crypto.randomUUID for better performance (#82)

### Fixed

- Comment line numbers now display correctly in server output (#87)
- '.' keyboard shortcut no longer triggers when modifier keys are pressed (#86)

### Thanks

- [@basyura](https://github.com/basyura) for fixing '.' shortcut with modifier keys #86
- [@KraXen72](https://github.com/KraXen72) for adding Svelte syntax highlighting support #85
- [@noritaka1166](https://github.com/noritaka1166) for replacing uuid package with crypto.randomUUID #82

## [2.2.0] - 2025-08-03

### Changed

- Comment storage now saves with diff context (baseCommitish and targetCommitish) to prevent comments from appearing in wrong diff ranges (#78)
- Viewed state persistence now includes file diff content hash to detect changes between reviews (#78)
- Keyboard shortcut for refresh changed from 'r' to 'Shift+R'

### Thanks

- [@noritaka1166](https://github.com/noritaka1166) for removing unused imports and variables #77

## [2.1.2] - 2025-07-30

### Added

- Highlight selected file in the file list when a line is selected in diff view
- Keyboard shortcuts to jump to first/last file with `{` (`Shift+[`) and `}` (`Shift+]`)
- Performance testing infrastructure with GitHub Actions workflow

### Changed

- Restored row selection on mouse click functionality
- Automatic row deselection when clicking outside selected row
- Automatic close of empty comment forms when clicking outside
- Keyboard shortcut 'v' for toggling viewed state (previously 'r')
- Keyboard shortcut 'r' for refresh when changes are detected

### Fixed

- Enable watch mode for dot argument with comparison
- Support for stdin in dev.js script
- Syntax highlighting disappearing on hover by passing filename prop
- Performance degradation with large diffs (81.7% reduction in keyboard navigation latency)

### Thanks

- [@haya14busa](https://github.com/haya14busa) for performance improvements #72, syntax highlighting fix #74, and watch mode fix #73

## [2.1.1] - 2025-07-28

### Added

- Keyboard shortcuts help to footer
- Added screenshot to all README
- Added protobuf support to README

### Changed

- Changed Reload button to Refresh with updated icon

## [2.1.0] - 2025-07-28

### Added

- Comment list view with keyboard navigation (#64)
  - View all comments in one place with Shift+L
  - Navigate comments with j/k, jump with Enter, delete with d
  - Scope-based keyboard shortcuts management
  - Shift+D to delete all comments
- Stdin support for reading unified diffs (#58)
  - Automatically detect piped input
  - Support explicit stdin mode with '-' argument
  - Enable workflows like `git diff | npx difit`
- Hot reload feature with file watching (#61)
  - Automatic diff updates when files change
  - Manual refresh button
  - SSE-based real-time updates
- Word highlighting in diff viewer like Gerrit (#62)
  - Highlight all occurrences of hovered word
  - Theme-aware styling
  - Case-insensitive matching
- Protobuf (.proto) syntax highlighting support

### Changed

- Default port changed from 3000 to 4966
- Refactored code to use optional chaining (#59)

### Fixed

- Cmd+Enter shortcut for updating comments (#67)
- Last comment not output when closing window (#63)
- Empty files handling in keyboard navigation (#60)
- Script hanging when browser tab is closed (#65)
- Support for two commitish arguments in dev script (#65)
- Fix validation for @ symbol as Git HEAD alias (#57)
- Row selection on mouse click disabled - only keyboard navigation moves cursor

### Thanks

- [@haya14busa](https://github.com/haya14busa) for @ symbol support #57, stdin support #58, word highlighting #62, comment list view #64, and bug fixes #60 #63 #65
- [@noritaka1166](https://github.com/noritaka1166) for optional chaining refactor #59
- [@yukukotani](https://github.com/yukukotani) for hot reload feature with file watching #61
- [@tsukasaI](https://github.com/tsukasaI) for Cmd+Enter comment update shortcut #67

## [2.0.11] - 2025-07-21

### Added

- Gerrit-style keyboard navigation with comprehensive shortcuts (#54)
  - j/k for line navigation, ]/[ for file navigation
  - n/p for chunk navigation, N/P for comment navigation
  - h/l or arrow keys for side switching in side-by-side view
  - r for toggling review state, c for creating comments
  - ? for help modal, . for center navigation
  - Shift+C to copy all comments prompt
  - Mouse click to focus on lines
  - Visual cursor indicators and smart scrolling
  - Skip collapsed files during navigation
- Multi-language README support with Japanese, Chinese, and Korean translations (#56)
- --clean option documentation to README

### Fixed

- GitHub Enterprise Server authentication error messages now explain that tokens must be generated on the specific Enterprise instance

### Removed

- Unused dependency (#53)

### Thanks

- [@haya14busa](https://github.com/haya14busa) for implementing Gerrit-style keyboard navigation #54
- [@noritaka1166](https://github.com/noritaka1166) for removing unused dependency #53

## [2.0.10] - 2025-07-20

### Added

- `--clean` flag to clear existing comments on startup and Button menu for cleanup all prompts
- GitHub Enterprise support for --pr option
- C# syntax highlighting support

### Removed

- Unused props from Checkbox and DiffViewer components

### Thanks

- [@hatayama](https://github.com/hatayama) for adding C# syntax highlighting support #52
- [@haya14busa](https://github.com/haya14busa) for adding --clean flag to clear existing comments on startup #51
- [@noritaka1166](https://github.com/noritaka1166) for removing unused props from Checkbox and DiffViewer components #49

## [2.0.9] - 2025-07-17

### Changed

- Replace full line click with dedicated comment button on line numbers for commenting
- Make code area selectable for text copying
- Simplify ESLint config by extracting shared rules and plugins to reduce duplication

### Fixed

- Fix issue where same line numbers in old/new sides both show comment forms
- Resolve ESLint warnings across the codebase with proper type handling

## [2.0.8] - 2025-07-15

### Changed

- Improved type definitions and removed unnecessary casts (#48)
- HP bar style progress display

### Fixed

- Replaced deprecated GitHub icon with new GitHubIcon component (#47)

### Thanks

- [@noritaka1166](https://github.com/noritaka1166) for improving type definitions #48
- [@noritaka1166](https://github.com/noritaka1166) for replacing deprecated GitHub icon #47

## [2.0.7] - 2025-07-14

### Added

- Display progress of reviewed files in client (#45)
- FUNDING.yml for GitHub Sponsors

### Changed

- Refactored code to fix some ESLint warnings (#46)

### Thanks

- [@noritaka1166](https://github.com/noritaka1166) for adding progress display feature #45
- [@noritaka1166](https://github.com/noritaka1166) for fixing ESLint warnings #46

## [2.0.6] - 2025-07-12

### Changed

- Keyboard accessibility improvements for Checkbox component (#42)
- Refactored code to use optional chaining (#41)
- Refactored test code to remove redundant return (#44)

### Fixed

- Fixed file tree display to prevent collapsing root node when showing nested folders

### Thanks

- [@noritaka1166](https://github.com/noritaka1166) for keyboard accessibility improvements #42
- [@noritaka1166](https://github.com/noritaka1166) for optional chaining refactor #41
- [@noritaka1166](https://github.com/noritaka1166) for test code refactor #44

## [2.0.5] - 2025-07-11

### Added

- Dart language support (#40)

### Changed

- Removed unused @eslint/eslintrc dependency (#39)

### Thanks

- [@tsukasaI](https://github.com/tsukasaI) for adding Dart language support #40
- [@noritaka1166](https://github.com/noritaka1166) for removing unused @eslint/eslintrc dependency #39

## [2.0.4] - 2025-07-10

### Added

- Collapsible file tree section (#37)

### Changed

- Simplified loop iteration and removed unnecessary type assertions (#38)
- Smooth CSS transitions for sidebar toggle animations

### Thanks

- [@seesaw-monster](https://github.com/seesaw-monster) for adding collapsible file tree section #37
- [@noritaka1166](https://github.com/noritaka1166) for refactoring loop iteration #38

## [2.0.3] - 2025-07-10

### Changed

- Migrate to ESLint Flat Config with TypeScript support
- File status display now shows line edits as modified (only new files as added, deleted files as deleted)
- Default host changed from 127.0.0.1 to localhost

### Fixed

- Git branch name validation now follows proper git check-ref-format rules

## [2.0.2] - 2025-07-09

### Added

- Multi-line comment support for diff viewer with proper display formatting (#34)

### Changed

- Improve comment UI with resolve button and simplified tooltips
- Improve icons throughout the interface
- Add GitHub link to sidebar footer
- Change logo color for softer appearance

### Fixed

- Fix branch name validation to allow @ character

### Thanks

- [@uzimaru0000](https://github.com/uzimaru0000) for adding multi-line comment support #34

## [2.0.1] - 2025-07-09

### Added

- vim script syntax highlighting support (#32)

### Changed

- Prettier formatting with experimentalTernaries option enabled
- Prettier configuration updated to use oxc plugin

### Thanks

- [@konojunya](https://github.com/konojunya) for adding vim script syntax highlighting support #32

## [2.0.0] - 2025-07-09

### Changed

- Rename to difit (#33)

## [1.1.12] - 2025-07-06

### Added

- Solidity syntax highlighting support (#31)

### Thanks

- [@maguroid](https://github.com/maguroid) for adding Solidity syntax highlighting support #31

## [1.1.11] - 2025-07-06

### Added

- Image diff display support for inline and side-by-side layouts (#30)

### Fixed

- Git diff header parsing now works correctly with diff.noprefix=true (#29)

### Thanks

- [@tsumuchan](https://github.com/tsumuchan) for fixing git diff header parsing #29

## [1.1.10] - 2025-07-03

### Added

- Untracked file detection with CLI prompt (#6)
- --host option to configure server bind address (#13)
- Comprehensive CLI and server integration tests (#27)

### Changed

- UI misc
  - Remove comment badges from directories in left pane
  - Visual feedback for file path copy button
  - Visible border on top of file header in right pane
  - Directory path collapsing in left pane

### Fixed

- Diff display issue when non-default git diff tool is set (#24)
- Server URL to reflect --host option (#25)
- Remove unnecessary default value in help (#22)
- Mode option now working

### Thanks

- [@umiyosh](https://github.com/umiyosh) for fixing diff display issue #24
- [@mitsuru](https://github.com/mitsuru) for fixing server URL to reflect --host option #25
- [@no-yan](https://github.com/no-yan) for adding untracked file detection with CLI prompt #6
- [@yicrotkd](https://github.com/yicrotkd) for adding --host option to configure server bind address #13
- [@kawarimidoll](https://github.com/kawarimidoll) for removing unnecessary default value in help #22

## [1.1.9] - 2025-07-02

### Added

- Customizable appearance settings to Web UI with font size, font family, theme selection, and syntax highlighting options (#16)

### Changed

- Skip browser auto-launch when no differences are found, displaying informative CLI message instead

### Fixed

- Comment areas now use full width in inline mode for improved readability

## [1.1.8] - 2025-07-01

### Fixed

- Fixed port fallback behavior to prevent displaying `localhost:undefined` when the initial port is in use

### Thanks

- [@arayaryoma](https://github.com/arayaryoma) for fixing port fallback behavior #15

## [1.1.7] - 2025-07-01

### Added

- Scala syntax highlighting support

### Fixed

- Fixed error when specifying a specific commit hash that prevented the application from starting
  - Now correctly validates commit formats like `abc123^` and `abc123~1`
  - Resolves "Invalid base commit-ish format" error when using commit^ syntax

### Thanks

- [@rfkm](https://github.com/rfkm) for adding Scala syntax highlighting support #14

## [1.1.6] - 2025-07-01

### Added

- GitHub PR URL support with `--pr <url>` option
  - `npx difit --pr https://github.com/owner/repo/pull/123`

### Changed

- README.md features section simplified for better readability

### Fixed

- Fixed error when using `working` as target argument that was incorrectly causing validation failures

## [1.1.5] - 2025-07-01

### Added

- MIT License
- Line-type specific comment positioning
  - Delete lines: comments positioned on left half
  - Add lines: comments positioned on right half
  - Unchanged lines: comments positioned full width

### Changed

- Comment display format simplified to file:line (removed timestamp)

## [1.1.4] - 2025-07-01

### Fixed

- Fix frontend display to correctly split on three dots (...) instead of two dots (..)
- Fix git diff arguments to use resolvedCommit string instead of individual commitish values

## [1.1.3] - 2025-07-01

### Changed

- Git commit comparison now uses three dots (...) instead of two dots (..) for better range comparison

### Fixed

- Node.js requirement updated to 21+ with ES2022 support
  - fixed: https://github.com/yoshiko-pg/difit/issues/10

## [1.1.2] - 2025-07-01

### Added

- Comment export feature on process termination (#9)
- /release command for automated release workflow
- CI workflow for pull requests

### Changed

- Package dependencies updated
- Improved lint configuration
- Enhanced pre-commit hooks setup

## [1.1.1] - 2025-06-30

### Added

- Compare-with option support

### Thanks

- [@unvalley](https://github.com/unvalley) for removing undefined `staging` option documentation #7
- [@yu7400ki](https://github.com/yu7400ki) for improving build scripts in package.json #3

## [1.1.0] - 2025-06-30

### Added

- TUI (Terminal User Interface) mode

### Thanks

- [@mizchi](https://github.com/mizchi) for TUI implementation #2

## [1.0.8] - 2025-06-30

### Added

- Dynamic syntax highlighting for additional languages - bash, ruby, java, php, sql

## [1.0.7] - 2025-06-30

### Fixed

- Use version from package.json

### Thanks

- [@no-yan](https://github.com/no-yan) for version handling improvement #1

## [1.0.6] - 2025-06-30

### Added

- Automatic server shutdown when browser tab is closed

## [1.0.5] - 2025-06-30

### Added

- `.` argument to show HEAD vs working directory diff

## [1.0.4] - 2025-06-30

### Changed

- Show commit hash range in short format

## [1.0.3] - 2025-06-30

### Changed

- Simplify comment prompt format to file:line format

### Fixed

- Fix folder name truncation in file tree

## [1.0.2] - 2025-06-30

### Changed

- Use custom favicon

## [1.0.1] - 2025-06-30

### Changed

- Auto-collapse lock files by default

## [1.0.0] - 2025-06-30

### Added

- First stable release 🌱

[Unreleased]: https://github.com/yoshiko-pg/difit/compare/v3.1.6...HEAD
[3.1.6]: https://github.com/yoshiko-pg/difit/compare/v3.1.5...v3.1.6
[3.1.5]: https://github.com/yoshiko-pg/difit/compare/v3.1.4...v3.1.5
[3.1.4]: https://github.com/yoshiko-pg/difit/compare/v3.1.3...v3.1.4
[3.1.3]: https://github.com/yoshiko-pg/difit/compare/v3.1.2...v3.1.3
[3.1.2]: https://github.com/yoshiko-pg/difit/compare/v3.1.1...v3.1.2
[3.1.1]: https://github.com/yoshiko-pg/difit/compare/v3.1.0...v3.1.1
[3.1.0]: https://github.com/yoshiko-pg/difit/compare/v3.0.9...v3.1.0
[3.0.9]: https://github.com/yoshiko-pg/difit/compare/v3.0.8...v3.0.9
[3.0.8]: https://github.com/yoshiko-pg/difit/compare/v3.0.7...v3.0.8
[3.0.7]: https://github.com/yoshiko-pg/difit/compare/v3.0.6...v3.0.7
[3.0.6]: https://github.com/yoshiko-pg/difit/compare/v3.0.5...v3.0.6
[3.0.5]: https://github.com/yoshiko-pg/difit/compare/v3.0.4...v3.0.5
[3.0.4]: https://github.com/yoshiko-pg/difit/compare/v3.0.3...v3.0.4
[3.0.3]: https://github.com/yoshiko-pg/difit/compare/v3.0.2...v3.0.3
[3.0.2]: https://github.com/yoshiko-pg/difit/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/yoshiko-pg/difit/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/yoshiko-pg/difit/compare/v2.2.7...v3.0.0
[2.2.7]: https://github.com/yoshiko-pg/difit/compare/v2.2.6...v2.2.7
[2.2.6]: https://github.com/yoshiko-pg/difit/compare/v2.2.5...v2.2.6
[2.2.5]: https://github.com/yoshiko-pg/difit/compare/v2.2.4...v2.2.5
[2.2.4]: https://github.com/yoshiko-pg/difit/compare/v2.2.3...v2.2.4
[2.2.3]: https://github.com/yoshiko-pg/difit/compare/v2.2.2...v2.2.3
[2.2.2]: https://github.com/yoshiko-pg/difit/compare/v2.2.1...v2.2.2
[2.2.1]: https://github.com/yoshiko-pg/difit/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/yoshiko-pg/difit/compare/v2.1.2...v2.2.0
[2.1.2]: https://github.com/yoshiko-pg/difit/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/yoshiko-pg/difit/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/yoshiko-pg/difit/compare/v2.0.11...v2.1.0
[2.0.11]: https://github.com/yoshiko-pg/difit/compare/v2.0.10...v2.0.11
[2.0.10]: https://github.com/yoshiko-pg/difit/compare/v2.0.9...v2.0.10
[2.0.9]: https://github.com/yoshiko-pg/difit/compare/v2.0.8...v2.0.9
[2.0.8]: https://github.com/yoshiko-pg/difit/compare/v2.0.7...v2.0.8
[2.0.7]: https://github.com/yoshiko-pg/difit/compare/v2.0.6...v2.0.7
[2.0.6]: https://github.com/yoshiko-pg/difit/compare/v2.0.5...v2.0.6
[2.0.5]: https://github.com/yoshiko-pg/difit/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/yoshiko-pg/difit/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/yoshiko-pg/difit/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/yoshiko-pg/difit/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/yoshiko-pg/difit/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/yoshiko-pg/difit/compare/v1.1.12...v2.0.0
[1.1.12]: https://github.com/yoshiko-pg/difit/compare/v1.1.11...v1.1.12
[1.1.11]: https://github.com/yoshiko-pg/difit/compare/v1.1.10...v1.1.11
[1.1.10]: https://github.com/yoshiko-pg/difit/compare/v1.1.9...v1.1.10
[1.1.9]: https://github.com/yoshiko-pg/difit/compare/v1.1.8...v1.1.9
[1.1.8]: https://github.com/yoshiko-pg/difit/compare/v1.1.7...v1.1.8
[1.1.7]: https://github.com/yoshiko-pg/difit/compare/v1.1.6...v1.1.7
[1.1.6]: https://github.com/yoshiko-pg/difit/compare/v1.1.5...v1.1.6
[1.1.5]: https://github.com/yoshiko-pg/difit/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/yoshiko-pg/difit/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/yoshiko-pg/difit/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/yoshiko-pg/difit/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/yoshiko-pg/difit/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/yoshiko-pg/difit/compare/v1.0.8...v1.1.0
[1.0.8]: https://github.com/yoshiko-pg/difit/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/yoshiko-pg/difit/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/yoshiko-pg/difit/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/yoshiko-pg/difit/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/yoshiko-pg/difit/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/yoshiko-pg/difit/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/yoshiko-pg/difit/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/yoshiko-pg/difit/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yoshiko-pg/difit/releases/tag/v1.0.0
