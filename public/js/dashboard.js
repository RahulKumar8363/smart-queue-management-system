const socket = window.__socket || (window.__socket = io());

// ================= STATE =================
let previousState = {};

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
});

// ================= SOCKET =================
socket.on("queue:update", loadDashboard);
socket.on("token:booked", loadDashboard);
socket.on("token:called", loadDashboard);
socket.on("token:updated", loadDashboard);
socket.on("dept:update", loadDashboard);

// ================= MAIN LOAD =================
async function loadDashboard() {
  try {
    const res = await fetch("/api/tokens/overview");
    const data = await res.json();

    const tokens = Array.isArray(data.data) ? data.data : [];

    updateMetrics(tokens);
    renderDepartments(tokens);

  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

// ================= METRICS =================
function updateMetrics(tokens) {
  const total = tokens.length;
  const waiting = tokens.filter(t => t.status === "WAITING").length;
  const completed = tokens.filter(t => t.status === "COMPLETED").length;
  const serving = tokens.filter(t => t.status === "SERVING").length;

  const avg = tokens.length
    ? Math.round(
        tokens.reduce((a, b) => a + (b.estimated_wait_mins || 0), 0) /
        tokens.length
      )
    : 0;

  document.getElementById("metricTotal").innerText = total;
  document.getElementById("metricWaiting").innerText = waiting;
  document.getElementById("metricServed").innerText = completed + serving;
  const avgWaitEl = document.getElementById("metricAvgWait");

if (avgWaitEl) {
  avgWaitEl.innerText = avg + " m";
}
}

// ================= DEPARTMENT CARDS (STABLE + ANIMATED) =================
function renderDepartments(tokens) {
  const container = document.getElementById("departmentGrid");
  if (!container) return;

  const map = {};

  // group
  tokens.forEach(t => {
    const id = t.department_id;

    if (!map[id]) {
      map[id] = {
        total: 0,
        waiting: 0,
        completed: 0,
        serving: null,
        name: t.department_name || `Department ${id}`,
        prefix: t.prefix || ""
      };
    }

    const d = map[id];

    d.total++;
    if (t.status === "WAITING") d.waiting++;
    if (t.status === "COMPLETED") d.completed++;
    if (t.status === "SERVING") d.serving = t;
  });

  container.innerHTML = "";

  Object.keys(map).forEach(id => {
    const d = map[id];

    const prev = previousState[id];

    const changed =
      !prev ||
      prev.waiting !== d.waiting ||
      prev.completed !== d.completed ||
      prev.serving?.token_number !== d.serving?.token_number;

    const card = document.createElement("div");
    card.className = "metric-box";

    if (changed) {
      card.classList.add("card-flash");

      setTimeout(() => {
        card.classList.remove("card-flash");
      }, 700);
    }

    card.innerHTML = `
      <h3>${d.name}</h3>
      <p style="color:#888;">${d.prefix}</p>

      <p style="margin-top:10px;">
        🟢 Serving: ${d.serving ? d.serving.token_number : "None"}
      </p>

      <p style="color:#f59e0b;">Waiting: ${d.waiting}</p>
      <p style="color:#22c55e;">Completed: ${d.completed}</p>
      <p>Total: ${d.total}</p>
    `;

    container.appendChild(card);

    // save state
    previousState[id] = {
      waiting: d.waiting,
      completed: d.completed,
      serving: d.serving
        ? { token_number: d.serving.token_number }
        : null
    };
  });
}