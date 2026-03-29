import { setStatus } from "./core/dom.js";
import { initRouter, showRoute } from "./features/router.js";
import { initTodos, loadTodos } from "./features/todos.js";
import { initNotes, loadNotes } from "./features/notes.js";
import { connectChatSocket, initChat, loadMessages, loadRooms } from "./features/chat.js";

bootstrap();

async function bootstrap() {
  initRouter();
  initTodos();
  initNotes();
  initChat();
  showRoute("todos");

  try {
    await Promise.all([loadTodos(), loadNotes(), loadRooms()]);
    await loadMessages();
    await connectChatSocket();
    setStatus("Ready");
  } catch (error) {
    setStatus(`Startup issue: ${error.message}`);
  }
}
