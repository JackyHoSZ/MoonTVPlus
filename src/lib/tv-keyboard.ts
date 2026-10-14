/** Normalize browser key names; these are DOM keyCodes, not Android KeyEvent codes. */
export function getTVKeyboardKey(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'keyCode'>
): string {
  const aliases: Record<string, string> = {
    Up: 'ArrowUp',
    Down: 'ArrowDown',
    Left: 'ArrowLeft',
    Right: 'ArrowRight',
    Esc: 'Escape',
    Return: 'Enter',
  };
  const known = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Enter',
    'Escape',
    'Home',
    'F1',
  ];
  const key = aliases[event.key] || event.key;
  if (known.includes(key)) return key;
  if (known.includes(event.code)) return event.code;
  // Do not reinterpret printable/editing keys as remote commands.
  if (key && key !== 'Unidentified') return key;
  const codes: Record<number, string> = {
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown',
    13: 'Enter',
    27: 'Escape',
    36: 'Home',
    112: 'F1',
  };
  return codes[event.keyCode] || key || '';
}
