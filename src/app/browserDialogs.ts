export function showAlert(message: string): void {
  window.alert(message);
}

export function showConfirm(message: string): boolean {
  return window.confirm(message);
}

export function showPrompt(message: string, defaultValue?: string): string | null {
  return window.prompt(message, defaultValue);
}
