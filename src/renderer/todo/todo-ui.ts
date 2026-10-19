/**
 * To-do panel UI. Text is always rendered with textContent (never HTML).
 * Every change is saved through the preload API; main validates it.
 */

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

declare const gokuPetAPI: {
  getTodos: () => Promise<{ todos: TodoItem[] }>;
  saveTodos: (todos: TodoItem[]) => Promise<{ success: boolean; error?: string }>;
  closeTodo: () => Promise<{ success: boolean }>;
};

export {};

const MAX_TEXT = 200;

let todos: TodoItem[] = [];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const form = $<HTMLFormElement>("form");
const input = $<HTMLInputElement>("new");
const addBtn = $<HTMLButtonElement>("add");
const list = $<HTMLUListElement>("list");
const empty = $<HTMLDivElement>("empty");
const footer = $<HTMLElement>("footer");
const count = $<HTMLSpanElement>("count");
const status = $<HTMLSpanElement>("status");
const clearBtn = $<HTMLButtonElement>("clear");

function newId(): string {
  return crypto.randomUUID();
}

async function persist(): Promise<void> {
  const result = await gokuPetAPI.saveTodos(todos);
  status.textContent = result.success ? "" : result.error ?? "Could not save";
  status.className = result.success ? "" : "error";
}

function update(change: () => void): void {
  change();
  render();
  void persist();
}

function render(): void {
  const remaining = todos.filter((t) => !t.done).length;
  const doneCount = todos.length - remaining;
  count.textContent = todos.length ? `${remaining} left` : "";
  empty.hidden = todos.length > 0;
  list.hidden = todos.length === 0;
  footer.hidden = doneCount === 0;
  clearBtn.textContent = `Clear done (${doneCount})`;

  list.replaceChildren(...todos.map(renderItem));
}

function renderItem(todo: TodoItem): HTMLLIElement {
  const li = document.createElement("li");
  if (todo.done) li.classList.add("done");

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "check";
  check.checked = todo.done;
  check.setAttribute("aria-label", "Done");
  check.addEventListener("change", () =>
    update(() => {
      todo.done = check.checked;
    })
  );

  const text = document.createElement("span");
  text.className = "text";
  text.textContent = todo.text;
  text.title = "Double-click to edit";
  text.addEventListener("dblclick", () => startEdit(li, text, todo));

  const del = document.createElement("button");
  del.className = "del";
  del.textContent = "✕";
  del.setAttribute("aria-label", "Delete task");
  del.addEventListener("click", () =>
    update(() => {
      todos = todos.filter((t) => t.id !== todo.id);
    })
  );

  li.append(check, text, del);
  return li;
}

function startEdit(li: HTMLLIElement, text: HTMLSpanElement, todo: TodoItem): void {
  const field = document.createElement("input");
  field.className = "edit";
  field.maxLength = MAX_TEXT;
  field.value = todo.text;
  li.replaceChild(field, text);
  field.focus();
  field.select();

  let finished = false;
  const finish = (save: boolean): void => {
    if (finished) return;
    finished = true;
    const value = field.value.trim();
    if (save && value && value !== todo.text) {
      update(() => {
        todo.text = value;
      });
    } else {
      render();
    }
  };
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") {
      e.stopPropagation();
      finish(false);
    }
  });
  field.addEventListener("blur", () => finish(true));
}

input.addEventListener("input", () => {
  addBtn.disabled = input.value.trim().length === 0;
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = input.value.trim().slice(0, MAX_TEXT);
  if (!value) return;
  update(() => {
    todos.push({ id: newId(), text: value, done: false, createdAt: Date.now() });
  });
  input.value = "";
  addBtn.disabled = true;
  list.scrollTop = list.scrollHeight;
});

clearBtn.addEventListener("click", () =>
  update(() => {
    todos = todos.filter((t) => !t.done);
  })
);

$<HTMLButtonElement>("close").addEventListener("click", () => void gokuPetAPI.closeTodo());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") void gokuPetAPI.closeTodo();
});

async function init(): Promise<void> {
  try {
    const result = await gokuPetAPI.getTodos();
    todos = Array.isArray(result.todos) ? result.todos : [];
  } catch (error) {
    console.error("Failed to load to-do list:", error);
    todos = [];
  }
  render();
  input.focus();
}

void init();
