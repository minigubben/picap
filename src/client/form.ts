export function serializeForm(form: HTMLFormElement): Record<string, string> {
  const data = new FormData(form);
  const payload: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (key === "_csrf") {
      continue;
    }
    payload[key] = String(value);
  }
  return payload;
}
