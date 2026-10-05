const socket = window.__socket || (window.__socket = io());

// ================= STATE =================
let currentToken = null;

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  loadDepartments();

  const form = document.getElementById("bookingForm");
  const trackBtn = document.getElementById("trackBtn");

  if (form) form.addEventListener("submit", bookToken);
  if (trackBtn) trackBtn.addEventListener("click", trackToken);
});

// ================= LOAD DEPARTMENTS =================
async function loadDepartments() {
  try {
    const res = await fetch("/api/departments");
    const data = await res.json();

    const select = document.getElementById("departmentSelect");
    if (!select) return;

    select.innerHTML = `<option value="">Select Department</option>`;

    data.data.forEach(dep => {
      select.innerHTML += `
        <option value="${dep.id}">
          ${dep.name} (${dep.prefix})
        </option>
      `;
    });

  } catch (err) {
    console.error("Department load error:", err);
  }
}

// ================= BOOK TOKEN =================
async function bookToken(e) {
  e.preventDefault();

  const userName = document.getElementById("userName").value;
  const userPhone = document.getElementById("userPhone").value;
  const departmentId = document.getElementById("departmentSelect").value;

  if (!userName || !userPhone || !departmentId) {
    alert("Fill all fields");
    return;
  }

  try {
    const res = await fetch("/api/tokens/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName, userPhone, departmentId })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Booking failed");
      return;
    }

    currentToken = data.data;

    localStorage.setItem("smart_token", currentToken.token_number);

    renderToken(currentToken);

    // join department room
    socket.emit("join-dept", departmentId);

  } catch (err) {
    console.error("Book error:", err);
  }
}

// ================= TRACK =================
function trackToken() {
  const val = document.getElementById("trackInput").value;
  if (!val) return;

  fetchToken(val);
}

// ================= FETCH TOKEN =================
async function fetchToken(tokenNo) {
  try {
    const res = await fetch(`/api/tokens/status/${tokenNo}`);
    const data = await res.json();

    if (!data.success) return;

    currentToken = data.data;

    renderToken(currentToken);

    socket.emit("join-dept", currentToken.department_id);

  } catch (err) {
    console.error("Track error:", err);
  }
}

// ================= RENDER =================
function renderToken(token) {
  if (!token) return;

  document.getElementById("noTicketState").style.display = "none";
  document.getElementById("activeTicketState").style.display = "block";

  document.getElementById("ticketDept").innerText = token.department_name || "-";
  document.getElementById("ticketNumber").innerText = token.token_number || "-";
  document.getElementById("ticketHolderName").innerText = token.user_name || "-";
  document.getElementById("ticketStatus").innerText = token.status || "-";
  document.getElementById("waitMins").innerText = token.estimated_wait_mins || 0;
  document.getElementById("aheadCount").innerText = token.waiting_ahead || 0;

  document.getElementById("ticketPosition").innerText =
    token.position_in_line ? `#${token.position_in_line}` : "-";

  document.getElementById("ticketCounter").innerText =
    token.counter_number || "Not assigned";
}

// ================= SOCKET EVENTS =================
socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("token:booked", (token) => {
  if (currentToken && currentToken.token_number === token.token_number) {
    currentToken = token;
    renderToken(token);
  }
});

socket.on("queue:update", () => {
  if (currentToken?.token_number) {
    fetchToken(currentToken.token_number);
  }
});

socket.on("token:status_changed", (token) => {
  if (currentToken?.token_number === token.token_number) {
    currentToken = token;
    renderToken(token);
  }
});