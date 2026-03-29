import { api } from "../core/api.js";
import { state } from "../core/state.js";
import { escapeHtml, formatDate, qs, setStatus } from "../core/dom.js";

export function initTodos() {
  qs("#todo-form").addEventListener("submit", onCreateTodo);
  qs("#refresh-todos").addEventListener("click", loadTodos);
  qs("#todo-filter").addEventListener("change", renderTodos);
}

async function onCreateTodo(event) {
  event.preventDefault();
  setStatus("Saving todo");

  const payload = {
    title: qs("#todo-title").value.trim(),
    priority: qs("#todo-priority").value.trim() || "medium",
    dueDate: qs("#todo-dueDate").value.trim(),
    description: qs("#todo-description").value.trim(),
    completed: false,
  };

  try {
    await api("/api/todos", { method: "POST", body: JSON.stringify(payload) });
    event.target.reset();
    await loadTodos();
    setStatus("Todo saved");
  } catch (error) {
    setStatus(`Todo failed: ${error.message}`);
  }
}

export async function loadTodos() {
  try {
    state.todos = await api("/api/todos");
    renderTodos();
  } catch (error) {
    setStatus(`Todo load failed: ${error.message}`);
  }
}

export function renderTodos() {
  const list = qs("#todo-list");
  const filterValue = qs("#todo-filter").value;
  list.innerHTML = "";

  const visible = state.todos.filter((todo) => {
    if (filterValue === "open") return !todo.completed;
    if (filterValue === "done") return !!todo.completed;
    return true;
  });

  visible.forEach((todo) => {
    const node = document.createElement("li");
    node.className = "item";
    node.innerHTML = `
      <div><strong>${escapeHtml(todo.title)}</strong></div>
      <div>${escapeHtml(todo.description || "")}</div>
      <div class="item-meta">Priority: ${escapeHtml(todo.priority || "n/a")} | Due: ${escapeHtml(todo.dueDate || "n/a")}</div>
      <div class="item-meta">Created: ${formatDate(todo.createdAt)} | Updated: ${formatDate(todo.updatedAt)}</div>
      <div class="item-actions">
        <button data-action="toggle">${todo.completed ? "Mark Open" : "Mark Done"}</button>
        <button data-action="delete" class="danger">Delete</button>
      </div>
    `;

    node.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
      try {
        await api(`/api/todo?id=${encodeURIComponent(todo.id)}`, {
          method: "PUT",
          body: JSON.stringify({
            title: todo.title,
            description: todo.description,
            priority: todo.priority,
            dueDate: todo.dueDate,
            completed: !todo.completed,
          }),
        });
        await loadTodos();
      } catch (error) {
        setStatus(`Todo update failed: ${error.message}`);
      }
    });

    node.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      try {
        await api(`/api/todo?id=${encodeURIComponent(todo.id)}`, { method: "DELETE" });
        await loadTodos();
      } catch (error) {
        setStatus(`Todo delete failed: ${error.message}`);
      }
    });

    list.appendChild(node);
  });
}
