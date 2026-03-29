import { api } from "../core/api.js";
import { state } from "../core/state.js";
import { escapeHtml, formatDate, qs, setConnection, setStatus } from "../core/dom.js";

export function initChat() {
  qs("#room-form").addEventListener("submit", onCreateRoom);
  qs("#refresh-chat").addEventListener("click", onRefreshChat);
  qs("#chat-room-select").addEventListener("change", loadMessages);
  qs("#chat-form").addEventListener("submit", onSendMessage);
}

export async function loadRooms() {
  try {
    const rooms = await api("/api/chat/rooms");
    state.rooms = Array.isArray(rooms) ? rooms : [];
    renderRoomOptions();
    if (state.rooms.length === 0) setStatus("No rooms yet. Create one.");
  } catch (error) {
    state.rooms = [];
    renderRoomOptions();
    setStatus(`Room load failed: ${error.message}`);
  }
}

function renderRoomOptions() {
  const select = qs("#chat-room-select");
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

function getSelectedRoomId() {
  return qs("#chat-room-select").value || "";
}

async function onCreateRoom(event) {
  event.preventDefault();
  const roomName = qs("#room-name").value.trim();
  if (!roomName) return;

  try {
    await api("/api/chat/rooms", {
      method: "POST",
      body: JSON.stringify({ name: roomName }),
    });
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

export async function loadMessages() {
  const roomId = getSelectedRoomId();
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
  const chatBox = qs("#chat-messages");
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

async function onSendMessage(event) {
  event.preventDefault();
  const roomId = getSelectedRoomId();
  if (!roomId) {
    setStatus("Select a room first");
    return;
  }

  const sender = qs("#chat-sender").value.trim() || "anonymous";
  const content = qs("#chat-message").value.trim();
  if (!content) return;

  try {
    await api("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({ roomId, sender, content }),
    });
    qs("#chat-message").value = "";
    await loadMessages();
  } catch (error) {
    setStatus(`Message send failed: ${error.message}`);
  }
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

export async function connectChatSocket() {
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
        const activeRoom = getSelectedRoomId();
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
