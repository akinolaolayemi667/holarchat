/**
 * Opens a hidden file input from a user gesture (button click).
 * Prefer this over <label> + sr-only file input — Chrome often ignores label activation
 * when the input is clipped/disabled.
 */
export function openFilePicker(input: HTMLInputElement | null): boolean {
  if (!input || input.disabled) return false;
  input.click();
  return true;
}
