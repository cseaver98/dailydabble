const menuToggleBtn = document.getElementById("menuToggleBtn");
const navMenuEl = document.getElementById("navMenu");
const challengeDateEl = document.getElementById("challengeDate");

function closeNavMenu() {
  if (!menuToggleBtn || !navMenuEl) return;
  navMenuEl.hidden = true;
  menuToggleBtn.setAttribute("aria-expanded", "false");
}

function openNavMenu() {
  if (!menuToggleBtn || !navMenuEl) return;
  navMenuEl.hidden = false;
  menuToggleBtn.setAttribute("aria-expanded", "true");
}

function toggleNavMenu() {
  if (!navMenuEl) return;
  if (navMenuEl.hidden) {
    openNavMenu();
  } else {
    closeNavMenu();
  }
}

function initNavMenu() {
  if (!menuToggleBtn || !navMenuEl) return;
  if (menuToggleBtn.dataset.ddMenuManaged === "react" || navMenuEl.dataset.ddMenuManaged === "react") {
    return;
  }
  closeNavMenu();

  menuToggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNavMenu();
  });

  navMenuEl.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    closeNavMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNavMenu();
    }
  });
}

function initNavLabel() {
  if (!challengeDateEl) return;
  const label = document.body?.dataset?.navLabel;
  if (label) {
    challengeDateEl.textContent = label;
  }
}

initNavLabel();
initNavMenu();
