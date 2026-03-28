const state = {
  todos: [],
  notes: [],
  rooms: [],
  messages: [],
  ws: null,
};

const routes = ["todos", "notes", "chat"];

init();

function init() {
  bindRouteNavigation();
  bindTodoActions();
  bindNoteActions();
  bindChatActions();
  showRoute("todos");
  bootstrapData();
}

async function bootstrapData() {
  await Promise.all([loadTodos(), loadNotes(), loadRooms()]);
  await loadMessages();
  await connectChatSocket();
}

function setStatus(text) {
  const statusPill = document.querySelector("#status-pill");
  statusPill.textContent = text;
}

function bindRouteNavigation() {
  document.querySelectorAll(".menu-btn").forEach((button) => {
    button.addEventListener("click", () => showRoute(button.dataset.route));
  });
}

function showRoute(route) {
  if (!routes.includes(route)) return;

  document.querySelectorAll(".menu-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${route}`);
  });

  document.querySelector("#page-title").textContent = route[0].toUpperCase() + route.slice(1);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function bindTodoActions() {
  document.querySelector("#todo-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Saving todo...");

    const payload = {
      title: document.querySelector("#todo-title").value.trim(),
      priority: document.querySelector("#todo-priority").value.trim() || "medium",
      dueDate: document.querySelector("#todo-dueDate").value.trim(),
      description: document.querySelector("#todo-description").value.trim(),
      completed: false,
    };

    try {
      await api("/api/todos", { method: "POST", body: JSON.stringify(payload) });
      event.target.reset();
      await loadTodos();
      setStatus("Todo saved");
    } catch (error) {
      setStatus(`Todo error: ${error.message}`);
    }
  });

  document.querySelector("#refresh-todos").addEventListener("click", loadTodos);
  document.querySelector("#todo-filter").addEventListener("change", renderTodos);
}

async function loadTodos() {
  try {
    state.todos = await api("/api/todos");
    renderTodos();
  } catch (error) {
    setStatus(`Load todos failed: ${error.message}`);
  }
}

function renderTodos() {
  const list = document.querySelector("#todo-list");
  list.innerHTML = "";

  const filterValue = document.querySelector("#todo-filter").value;
  const visibleTodos = state.todos.filter((todo) => {
    if (filterValue === "open") return !todo.completed;
    if (filterValue === "done") return !!todo.completed;
    return true;
  });

  visibleTodos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = "item";
    item.innerHTML = `
      <div><strong>${escapeHtml(todo.title)}</strong></div>
      <div>${escapeHtml(todo.description || "")}</div>
      <div class="item-meta">Priority: ${escapeHtml(todo.priority || "n/a")} | Due: ${escapeHtml(todo.dueDate || "n/a")}</div>
      <div class="item-meta">Created: ${formatDate(todo.createdAt)} | Updated: ${formatDate(todo.updatedAt)}</div>
      <div class="item-actions">
        <button data-action="toggle">${todo.completed ? "Mark Open" : "Mark Done"}</button>
        <button data-action="delete" class="danger">Delete</button>
      </div>
    `;

    item.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
      const payload = {
        title: todo.title,
        description: todo.description,
        priority: todo.priority,
        dueDate: todo.dueDate,
        completed: !todo.completed,
      };
      await api(`/api/todo?id=${encodeURIComponent(todo.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await loadTodos();
    });

    item.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      await api(`/api/todo?id=${encodeURIComponent(todo.id)}`, { method: "DELETE" });
      await loadTodos();
    });

    list.appendChild(item);
  });
}

function bindNoteActions() {
  document.querySelector("#note-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Saving note...");

    const payload = {
      title: document.querySelector("#note-title").value.trim(),
      content: document.querySelector("#note-content").value.trim(),
      tags: document
        .querySelector("#note-tags")
        .value.split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    try {
      await api("/api/notes", { method: "POST", body: JSON.stringify(payload) });
      event.target.reset();
      await loadNotes();
      setStatus("Note saved");
    } catch (error) {
      setStatus(`Note error: ${error.message}`);
    }
  });

  document.querySelector("#note-search").addEventListener("input", loadNotes);
  document.querySelector("#refresh-notes").addEventListener("click", loadNotes);
}

async function loadNotes() {
  try {
    const query = document.querySelector("#note-search").value.trim();
    const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
    state.notes = await api(`/api/notes${suffix}`);
    renderNotes();
  } catch (error) {
    setStatus(`Load notes failed: ${error.message}`);
  }
}

function renderNotes() {
  const list = document.querySelector("#note-list");
  list.innerHTML = "";

  state.notes.forEach((note) => {
    const item = document.createElement("li");
    item.className = "item";
    item.innerHTML = `
      <div><strong>${escapeHtml(note.title)}</strong></div>
      <div>${escapeHtml(note.content || "")}</div>
      <div class="item-meta">Tags: ${escapeHtml((note.tags || []).join(", ") || "none")}</div>
      <div class="item-actions">
        <button data-action="edit">Update</button>
        <button data-action="delete" class="danger">Delete</button>
      </div>
    `;

    item.querySelector('[data-action="edit"]').addEventListener("click", async () => {
      const newTitle = prompt("New title", note.title);
      if (!newTitle) return;
      const newContent = prompt("New content", note.content || "");
      if (newContent === null) return;
      await api(`/api/note?id=${encodeURIComponent(note.id)}`, {
        method: "PUT",
        body: JSON.stringify({ title: newTitle, content: newContent, tags: note.tags || [] }),
      });
      await loadNotes();
    });

    item.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      await api(`/api/note?id=${encodeURIComponent(note.id)}`, { method: "DELETE" });
      await loadNotes();
    });

    list.appendChild(item);
  });
}

function bindChatActions() {
  document.querySelector("#room-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const roomName = document.querySelector("#room-name").value.trim();
    if (!roomName) return;

    await api("/api/chat/rooms", {
      method: "POST",
      body: JSON.stringify({ name: roomName }),
    });
    event.target.reset();
    await loadRooms();
  });

  document.querySelector("#chat-room-select").addEventListener("change", loadMessages);
  document.querySelector("#refresh-chat").addEventListener("click", async () => {
    await loadMessages();
    await connectChatSocket();
  });

  document.querySelector("#chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const roomId = getSelectedRoomId();
    if (!roomId) {
      setStatus("Create/select a room first");
      return;
    }

    const sender = document.querySelector("#chat-sender").value.trim() || "anonymous";
    const content = document.querySelector("#chat-message").value.trim();
    if (!content) return;

    await api("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({ roomId, sender, content }),
    });
    document.querySelector("#chat-message").value = "";
    await loadMessages();
  });
}

async function loadRooms() {
  try {
    state.rooms = await api("/api/chat/rooms");
    renderRoomOptions();
  } catch (error) {
    setStatus(`Load rooms failed: ${error.message}`);
  }
}

function renderRoomOptions() {
  const select = document.querySelector("#chat-room-select");
  const current = select.value;
  select.innerHTML = "";

  state.rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.name;
    select.appendChild(option);
  });

  if (current) {
    select.value = current;
  }
}

function getSelectedRoomId() {
  return document.querySelector("#chat-room-select").value || "";
}

async function loadMessages() {
  const roomId = getSelectedRoomId();
  if (!roomId) {
    state.messages = [];
    renderMessages();
    return;
  }

  try {
    state.messages = await api(`/api/chat/messages?roomId=${encodeURIComponent(roomId)}`);
    renderMessages();
  } catch (error) {
    setStatus(`Load chat failed: ${error.message}`);
  }
}

function renderMessages() {
  const chatBox = document.querySelector("#chat-messages");
  chatBox.innerHTML = "";

  state.messages.forEach((message) => {
    const node = document.createElement("div");
    node.className = "chat-msg";
    node.innerHTML = `
      <b>${escapeHtml(message.sender || "anonymous")}</b>
      <span class="item-meta"> ${formatDate(message.createdAt)}</span>
      <div>${escapeHtml(message.content || "")}</div>
    `;
    chatBox.appendChild(node);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

async function connectChatSocket() {
  const statusNode = document.querySelector("#chat-connection");
  try {
    const info = await api("/api/chat/ws");
    if (state.ws) state.ws.close();

    state.ws = new WebSocket(info.websocketUrl);
    state.ws.onopen = () => {
      statusNode.textContent = "online";
    };
    state.ws.onclose = () => {
      statusNode.textContent = "offline";
    };
    state.ws.onerror = () => {
      statusNode.textContent = "error";
    };
    state.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const activeRoom = getSelectedRoomId();
        if (payload.roomId && payload.roomId === activeRoom) {
          state.messages.push(payload);
          renderMessages();
        }
      } catch (_) {
        // Ignore non-JSON websocket messages.
      }
    };
  } catch (error) {
    statusNode.textContent = "offline";
    setStatus(`WebSocket failed: ${error.message}`);
  }
}

function formatDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
