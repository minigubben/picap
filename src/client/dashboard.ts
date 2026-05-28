import { serializeForm } from "./form";
import { readResponsePayload } from "./http";

function setStatus(message: string): void {
  const node = document.querySelector<HTMLElement>("[data-ui-status]");
  if (node) {
    node.textContent = message;
  }
}

async function submitApiForm(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  const confirmMessage = form.dataset.confirm;
  if (confirmMessage && !window.confirm(confirmMessage)) {
    return;
  }

  try {
    const response = await fetch(form.action, {
      method: form.method || "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.CSRF_TOKEN
      },
      body: JSON.stringify(serializeForm(form))
    });
    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(String(payload?.error || "Request failed."));
    }
    setStatus("Action completed.");
    window.location.reload();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Request failed.");
  }
}

async function runApiAction(event: MouseEvent): Promise<void> {
  event.preventDefault();
  const button = event.currentTarget;
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  const confirmMessage = button.dataset.confirm;
  if (confirmMessage && !window.confirm(confirmMessage)) {
    return;
  }

  try {
    const response = await fetch(button.dataset.action || "", {
      method: button.dataset.method || "POST",
      headers: { "X-CSRF-Token": window.CSRF_TOKEN }
    });
    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(String(payload?.error || "Action failed."));
    }
    setStatus("Action completed.");
    window.location.reload();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Action failed.");
  }
}

export function bindDashboard(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>("[data-api-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      void submitApiForm(event);
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-api-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      void runApiAction(event);
    });
  });
}
