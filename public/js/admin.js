const socket = window.__socket || (window.__socket = io());

// ================= STATE =================
let currentCounterId = null;
let currentDeptId = null;
let currentServingToken = null;
let joinedDept = null;

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  const counterSelect = document.getElementById("counterSelect");
  if (!counterSelect) return;

  counterSelect.addEventListener("change", updateCounter);

  document.getElementById("callNextBtn")?.addEventListener("click", callNext);
  document.getElementById("nextAfterBtn")?.addEventListener("click", nextAfterComplete);
  document.getElementById("recallBtn")?.addEventListener("click", recallToken);
  document.getElementById("completeBtn")?.addEventListener("click", () => updateStatus("COMPLETED"));
  document.getElementById("noShowBtn")?.addEventListener("click", () => updateStatus("NO_SHOW"));

  updateCounter();
});

// ================= COUNTER =================
function updateCounter() {
  const select = document.getElementById("counterSelect");
  if (!select || !select.value) return;

  currentCounterId = Number(select.value);
  currentDeptId = Number(select.options[select.selectedIndex].dataset.dept);

  joinDepartment(currentDeptId);
  loadQueue();

  console.log("Counter:", currentCounterId, "Dept:", currentDeptId);
}

// ================= SOCKET JOIN =================
function joinDepartment(deptId) {
  if (!deptId || joinedDept === deptId) return;

  joinedDept = deptId;
  socket.emit("join-dept", deptId);

  console.log("Joined department:", deptId);
}

// ================= CALL NEXT =================
async function callNext() {
  try {
    if (!currentCounterId || !currentDeptId) {
      alert("Select counter first");
      return;
    }

    const res = await fetch("http://localhost:3000/api/tokens/call-next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counter_id: currentCounterId,
        departmentId: currentDeptId
      })
    });

    const data = await res.json();
    if (!data.success) {
      alert(data.message || "API error");
      return;
    }

    currentServingToken = data.data;
    renderServing(currentServingToken);
    loadQueue();

  } catch (err) {
    console.error("callNext error:", err);
  }
}

// ================= UPDATE STATUS =================
async function updateStatus(status) {
  if (!currentServingToken?.id) return;

  try {
    const res = await fetch(
      `http://localhost:3000/api/tokens/status/${currentServingToken.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      }
    );

    const data = await res.json();
    if (!data.success) return;

    currentServingToken = null;
    renderServing(null);
    loadQueue();

    socket.emit("queue:update", { departmentId: currentDeptId });

  } catch (err) {
    console.error("Status update error:", err);
  }
}

// ================= NEXT AFTER COMPLETE =================
async function nextAfterComplete() {
  if (currentServingToken) {
    await updateStatus("COMPLETED");
  }
  await callNext();
}

// ================= SOCKET EVENTS =================
socket.on("queue:update", loadQueue);
socket.on("token:booked", loadQueue);
socket.on("dept:update", (data) => {
  loadQueue();

  if (data?.type === "SERVING") {
    currentServingToken = data.data;
    renderServing(currentServingToken);
  }
});

// ================= SERVING UI =================
function renderServing(token) {
  const noState = document.getElementById("noServingState");
  const activeState = document.getElementById("activeServingState");

  if (!token) {
    noState.style.display = "block";
    activeState.style.display = "none";
    return;
  }

  noState.style.display = "none";
  activeState.style.display = "block";

  const box = document.querySelector(".ticket-box");
  if (box) {
    box.classList.remove("token-pulse");
    void box.offsetWidth;
    box.classList.add("token-pulse");
  }

  document.getElementById("servingTokenNum").innerText = token.token_number || "-";
  document.getElementById("servingCustomerName").innerText = token.user_name || "-";
  document.getElementById("servingDeptName").innerText = token.department_name || "-";
}

// ================= LOAD QUEUE =================
async function loadQueue() {
  try {
    const res = await fetch("http://localhost:3000/api/tokens/overview");
    const data = await res.json();

    const tbody = document.getElementById("waitingTableBody");
    if (!tbody) return;

    const list = Array.isArray(data.data) ? data.data : [];

    if (!currentDeptId) {
      tbody.innerHTML = `<tr><td colspan="5">Select counter first</td></tr>`;
      return;
    }

    const deptTokens = list.filter(
      t => Number(t.department_id) === Number(currentDeptId)
    );

    tbody.innerHTML = "";

    if (deptTokens.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">No tokens waiting</td></tr>`;
      return;
    }

    deptTokens.forEach((t, index) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${t.token_number}</td>
        <td>${t.user_name}</td>
        <td>${t.status}</td>
        <td>${index + 1}</td>
        <td>${t.estimated_wait_mins || 0} min</td>
      `;

      tbody.appendChild(row);
    });

  } catch (err) {
    console.error("loadQueue error:", err);
  }
}

// ================= RECALL =================
function recallToken() {
  if (!currentServingToken) return;

  socket.emit("token:called", {
    tokenId: currentServingToken.id,
    tokenNumber: currentServingToken.token_number,
    counterId: currentCounterId
  });

  alert(`🔔 Recalled ${currentServingToken.token_number}`);
}