import { qs, qsa } from "../core/dom.js";

const routes = ["todos", "notes", "chat"];

export function initRouter() {
  qsa(".menu-btn").forEach((button) => {
    button.addEventListener("click", () => showRoute(button.dataset.route));
  });
}

export function showRoute(route) {
  if (!routes.includes(route)) return;

  qsa(".menu-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });

  qsa(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${route}`);
  });

  qs("#page-title").textContent = route[0].toUpperCase() + route.slice(1);
}
