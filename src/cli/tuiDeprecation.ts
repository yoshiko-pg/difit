import { waitForEnter } from './utils.js';

const TUI_DEPRECATION_ISSUES_URL = 'https://github.com/yoshiko-pg/difit/issues';

export const TUI_DEPRECATION_NOTICE_LINES = [
  `⚠️ TUI mode will be removed in the next major release because ongoing implementation of core features is difficult. If you have feedback, please open an issue: ${TUI_DEPRECATION_ISSUES_URL}`,
  `⚠️ tuiモードは継続的な主要機能の実装が難しいため次回のメジャーリリースで削除予定です。もしご意見がある場合はissueの起票をお願いします。 ${TUI_DEPRECATION_ISSUES_URL}`,
];

export const TUI_DEPRECATION_PROMPT = [
  'Press Enter to start TUI mode.',
  'Enterを押すとtuiモードを起動します。',
].join('\n');

export async function warnAboutTuiDeprecation(
  waitForEnterFn: (message: string) => Promise<void> = waitForEnter,
): Promise<void> {
  for (const line of TUI_DEPRECATION_NOTICE_LINES) {
    console.warn(line);
  }

  await waitForEnterFn(`\n${TUI_DEPRECATION_PROMPT}\n`);
}
