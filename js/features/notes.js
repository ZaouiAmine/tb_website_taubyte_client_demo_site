import { api } from "../core/api.js";
import { state } from "../core/state.js";
import { escapeHtml, qs, setStatus } from "../core/dom.js";

export function initNotes() {
  qs("#note-form").addEventListener("submit", onCreateNote);
  qs("#note-search").addEventListener("input", loadNotes);
  qs("#refresh-notes").addEventListener("click", loadNotes);
}

async function onCreateNote(event) {
  event.preventDefault();
  setStatus("Saving note");

  const payload = {
    title: qs("#note-title").value.trim(),
    content: qs("#note-content").value.trim(),
    tags: qs("#note-tags")
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
    setStatus(`Note failed: ${error.message}`);
  }
}

export async function loadNotes() {
  try {
    const query = qs("#note-search").value.trim();
    const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
    state.notes = await api(`/api/notes${suffix}`);
    renderNotes();
  } catch (error) {
    setStatus(`Note load failed: ${error.message}`);
  }
}

export function renderNotes() {
  const list = qs("#note-list");
  list.innerHTML = "";

  state.notes.forEach((note) => {
    const node = document.createElement("li");
    node.className = "item";
    node.innerHTML = `
      <div><strong>${escapeHtml(note.title)}</strong></div>
      <div>${escapeHtml(note.content || "")}</div>
      <div class="item-meta">Tags: ${escapeHtml((note.tags || []).join(", ") || "none")}</div>
      <div class="item-actions">
        <button data-action="edit">Update</button>
        <button data-action="delete" class="danger">Delete</button>
      </div>
    `;

    node.querySelector('[data-action="edit"]').addEventListener("click", async () => {
      const title = prompt("New title", note.title);
      if (!title) return;
      const content = prompt("New content", note.content || "");
      if (content === null) return;

      try {
        await api(`/api/note?id=${encodeURIComponent(note.id)}`, {
          method: "PUT",
          body: JSON.stringify({ title, content, tags: note.tags || [] }),
        });
        await loadNotes();
      } catch (error) {
        setStatus(`Note update failed: ${error.message}`);
      }
    });

    node.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      try {
        await api(`/api/note?id=${encodeURIComponent(note.id)}`, { method: "DELETE" });
        await loadNotes();
      } catch (error) {
        setStatus(`Note delete failed: ${error.message}`);
      }
    });

    list.appendChild(node);
  });
}
