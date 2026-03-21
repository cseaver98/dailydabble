const archiveListEl = document.getElementById("archiveList");

function renderArchive(items) {
  archiveListEl.innerHTML = "";

  if (!items.length) {
    archiveListEl.textContent = "No archive entries yet.";
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("a");
    row.className = "archive-item archive-item-link";
    row.href = `/?replay=${encodeURIComponent(item.challengeDate)}`;

    const date = document.createElement("p");
    date.className = "archive-date";
    date.textContent = item.challengeDate;

    const location = document.createElement("p");
    location.className = "archive-location";
    location.textContent = [item.city, item.state].filter(Boolean).join(", ");

    row.append(date, location);
    archiveListEl.appendChild(row);
  });
}

async function loadArchive() {
  const response = await fetch("/api/archive?limit=120");
  const data = await response.json();

  if (!response.ok) {
    archiveListEl.textContent = "Could not load archive right now.";
    return;
  }

  renderArchive(data.items || []);
}

loadArchive();
