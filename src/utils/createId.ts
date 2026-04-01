const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 16;

export function createId(): string {
  return Array.from(
    { length: ID_LENGTH },
    () => ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)],
  ).join('');
}
