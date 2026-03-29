const state = {
  todos: [],
  rooms: [],
  messages: [],
  ws: null,
  pollTimer: null,
};

const pageTitle = document.querySelector("#page-title");
const statusPill = document.querySelector("#status-pill");

init();

function init() {
  bindNavigation();
  bindTodos();
  bindChat();
  showPage("home");
  bootstrapData();
}

async function bootstrapData() {
  await Promise.all([loadTodos(), loadRooms()]);
  await loadMessages();
  await connectChatSocket();
  refreshHomeStats();
  setStatus("Ready");
}

function bindNavigation() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => showPage(link.dataset.page));
  });
}

function showPage(page) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.dataset.page === page;
    link.classList.toggle("bg-brand-100", active);
    link.classList.toggle("border", active);
    link.classList.toggle("border-brand-300", active);
  });

  document.querySelectorAll(".page").forEach((section) => {
    section.classList.toggle("hidden", section.id !== `page-${page}`);
  });

  pageTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);
}

function setStatus(text) {
  statusPill.textContent = text;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed (${response.status})`);
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

function bindTodos() {
  document.querySelector("#todo-form").addEventListener("submit", onCreateTodo);
  document.querySelector("#refresh-todos").addEventListener("click", loadTodos);
  document.querySelector("#todo-filter").addEventListener("change", renderTodos);
}

async function onCreateTodo(event) {
  event.preventDefault();
  setStatus("Saving todo");

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
    setStatus(`Todo failed: ${error.message}`);
  }
}

async function loadTodos() {
  try {
    const todos = await api("/api/todos");
    state.todos = Array.isArray(todos) ? todos : [];
    renderTodos();
    refreshHomeStats();
  } catch (error) {
    setStatus(`Todo load failed: ${error.message}`);
  }
}

function renderTodos() {
  const list = document.querySelector("#todo-list");
  const filter = document.querySelector("#todo-filter").value;
  list.innerHTML = "";

  const visible = state.todos.filter((todo) => {
    if (filter === "open") return !todo.completed;
    if (filter === "done") return !!todo.completed;
    return true;
  });

  visible.forEach((todo) => {
    const node = document.createElement("li");
    node.className = "rounded-lg border border-brand-200 bg-brand-50 p-3";
    node.innerHTML = `
      <div class="font-medium">${escapeHtml(todo.title)}</div>
      <div class="mt-1 text-sm text-brand-600">${escapeHtml(todo.description || "")}</div>
      <div class="mt-2 text-xs text-brand-500">Priority: ${escapeHtml(todo.priority || "n/a")} | Due: ${escapeHtml(todo.dueDate || "n/a")}</div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button data-action="toggle" class="rounded-md border border-brand-300 bg-white px-2.5 py-1 text-xs hover:bg-brand-100">
          ${todo.completed ? "Mark Open" : "Mark Done"}
        </button>
        <button data-action="delete" class="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50">Delete</button>
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

function bindChat() {
  document.querySelector("#room-form").addEventListener("submit", onCreateRoom);
  document.querySelector("#refresh-chat").addEventListener("click", onRefreshChat);
  document.querySelector("#chat-room-select").addEventListener("change", loadMessages);
  document.querySelector("#chat-form").addEventListener("submit", onSendMessage);
}

async function onCreateRoom(event) {
  event.preventDefault();
  const name = document.querySelector("#room-name").value.trim();
  if (!name) return;

  try {
    await api("/api/chat/rooms", { method: "POST", body: JSON.stringify({ name }) });
    event.target.reset();
    await loadRooms();
    await loadMessages();
    setStatus("Room created");
  } catch (error) {
    setStatus(`Room create failed: ${error.message}`);
  }
}

async function onRefreshChat() {
  await loadRooms();
  await loadMessages();
  await connectChatSocket();
}

async function loadRooms() {
  try {
    const rooms = await api("/api/chat/rooms");
    state.rooms = Array.isArray(rooms) ? rooms : [];
    renderRoomOptions();
    refreshHomeStats();
  } catch (error) {
    state.rooms = [];
    renderRoomOptions();
    setStatus(`Room load failed: ${error.message}`);
  }
}

function renderRoomOptions() {
  const select = document.querySelector("#chat-room-select");
  const current = select.value;
  select.innerHTML = "";

  if (state.rooms.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No rooms available";
    select.appendChild(option);
    return;
  }

  state.rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.name;
    select.appendChild(option);
  });

  if (current && state.rooms.some((room) => room.id === current)) {
    select.value = current;
  } else {
    select.selectedIndex = 0;
  }
}

function selectedRoomId() {
  return document.querySelector("#chat-room-select").value || "";
}

async function onSendMessage(event) {
  event.preventDefault();
  const roomId = selectedRoomId();
  if (!roomId) {
    setStatus("Select a room first");
    return;
  }

  const sender = document.querySelector("#chat-sender").value.trim() || "anonymous";
  const content = document.querySelector("#chat-message").value.trim();
  if (!content) return;

  try {
    await api("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({ roomId, sender, content }),
    });
    document.querySelector("#chat-message").value = "";
    await loadMessages();
  } catch (error) {
    setStatus(`Message send failed: ${error.message}`);
  }
}

async function loadMessages() {
  const roomId = selectedRoomId();
  if (!roomId) {
    state.messages = [];
    renderMessages();
    return;
  }

  try {
    const messages = await api(`/api/chat/messages?roomId=${encodeURIComponent(roomId)}`);
    state.messages = Array.isArray(messages) ? messages : [];
    renderMessages();
  } catch (error) {
    setStatus(`Chat load failed: ${error.message}`);
  }
}

function renderMessages() {
  const box = document.querySelector("#chat-messages");
  const myName = (document.querySelector("#chat-sender").value.trim() || "anonymous").toLowerCase();
  box.innerHTML = "";

  state.messages.forEach((message) => {
    const mine = String(message.sender || "").toLowerCase() === myName;
    const wrapper = document.createElement("div");
    wrapper.className = `mb-2 flex ${mine ? "justify-end" : "justify-start"}`;
    wrapper.innerHTML = `
      <div class="max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand-800 text-white" : "bg-white border border-brand-200 text-brand-900"}">
        <div class="mb-1 text-[11px] ${mine ? "text-brand-200" : "text-brand-500"}">${escapeHtml(message.sender || "anonymous")} · ${formatDate(message.createdAt)}</div>
        <div>${escapeHtml(message.content || "")}</div>
      </div>
    `;
    box.appendChild(wrapper);
  });

  box.scrollTop = box.scrollHeight;
}

function setConnection(text) {
  document.querySelector("#chat-connection").textContent = text;
  document.querySelector("#home-chat-mode").textContent = text.charAt(0).toUpperCase() + text.slice(1);
}

function startPollingFallback() {
  if (state.pollTimer) return;
  state.pollTimer = setInterval(loadMessages, 4000);
}

function stopPollingFallback() {
  if (!state.pollTimer) return;
  clearInterval(state.pollTimer);
  state.pollTimer = null;
}

async function connectChatSocket() {
  try {
    const info = await api("/api/chat/ws");
    if (!info?.realtimeAvailable || !info.websocketUrl) throw new Error("Realtime unavailable");

    if (state.ws) state.ws.close();
    state.ws = new WebSocket(info.websocketUrl);
    setConnection("connecting");

    state.ws.onopen = () => {
      setConnection("realtime");
      stopPollingFallback();
    };
    state.ws.onclose = () => {
      setConnection("polling");
      startPollingFallback();
    };
    state.ws.onerror = () => {
      setConnection("polling");
      startPollingFallback();
    };
    state.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const activeRoom = selectedRoomId();
        if (payload.roomId && payload.roomId === activeRoom) {
          state.messages.push(payload);
          renderMessages();
        }
      } catch (_) {
        // Ignore non-JSON events.
      }
    };
  } catch (_) {
    setConnection("polling");
    startPollingFallback();
  }
}

function refreshHomeStats() {
  document.querySelector("#home-todos-count").textContent = String(state.todos.length);
  document.querySelector("#home-rooms-count").textContent = String(state.rooms.length);
}

function formatDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
