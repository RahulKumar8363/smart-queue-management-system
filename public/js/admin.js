
const socket = window.__socket || (window.__socket = io());

// ================= STATE =================
let currentCounterId = null;
let currentDeptId = null;
let currentServingToken = null;
let joinedDept = null;

// QR Scanner State
let html5QrCode = null;
let scannerRunning = false;
let qrProcessing = false;

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

  // QR Scanner buttons
  document.getElementById("startScannerBtn")?.addEventListener("click", startQRScanner);
  document.getElementById("stopScannerBtn")?.addEventListener("click", stopQRScanner);

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

    const res = await fetch("/api/tokens/call-next", {
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
      `/api/tokens/status/${currentServingToken.id}`,
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

  if (!noState || !activeState) return;

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
    const res = await fetch("/api/tokens/overview");
    const data = await res.json();

    const tbody = document.getElementById("waitingTableBody");
    if (!tbody) return;

    const list = Array.isArray(data.data) ? data.data : [];

    if (!currentDeptId) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px 20px; color:var(--text-muted);">Select a counter to load the queue</td></tr>`;
      return;
    }

    const deptTokens = list.filter(
      t => Number(t.department_id) === Number(currentDeptId)
    );

    tbody.innerHTML = "";

    if (deptTokens.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px 20px; color:var(--text-muted);">No patients waiting in this department</td></tr>`;
      return;
    }

    deptTokens.forEach((t, index) => {
      const row = document.createElement("tr");
      const statusClass = "status-" + (t.status || "WAITING");
      const statusLabel = (t.status || "WAITING").replace("_", " ");
      const isServing =
        t.status === "SERVING" ||
        t.status === "CALLED" ||
        t.status === "IN_PROGRESS";

      if (isServing) row.classList.add("row-serving");

      row.innerHTML = `
        <td style="font-size:12px; color:var(--text-muted); font-weight:600;">${index + 1}</td>
        <td class="td-token">${t.token_number}</td>
        <td class="td-name">${t.user_name}</td>
        <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
        <td style="color:var(--text-muted);">${t.estimated_wait_mins ? t.estimated_wait_mins + " min" : "—"}</td>
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

// ================= QR SCANNER =================
async function startQRScanner() {
  const resultBox = document.getElementById("qrScanResult");
  const startBtn = document.getElementById("startScannerBtn");
  const stopBtn = document.getElementById("stopScannerBtn");

  if (!resultBox || !startBtn || !stopBtn) return;

  try {
    if (typeof Html5Qrcode === "undefined") {
      throw new Error("QR Scanner library is not loaded.");
    }

    if (scannerRunning) return;

    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qr-reader");
    }

    resultBox.textContent = "Starting camera...";

    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      async (decodedText) => {
        if (!scannerRunning || qrProcessing) return;

        qrProcessing = true;
        scannerRunning = false;

        try {
          await html5QrCode.stop();
        } catch (error) {
          console.error("Scanner stop error:", error);
        }

        startBtn.disabled = false;
        stopBtn.disabled = true;

        console.log("Scanned QR Data:", decodedText);

        await verifyQRToken(decodedText);

        qrProcessing = false;
      },
      () => {
        // Ignore unsuccessful scan attempts.
      }
    );

    scannerRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    resultBox.textContent = "Camera active. Point it at a QR code.";

  } catch (err) {
    console.error("QR Scanner Error:", err);

    scannerRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    resultBox.textContent = "Camera error: " + err.message;
  }
}

// ================= VERIFY QR TOKEN =================

async function verifyQRToken(qrData) {
  const resultBox = document.getElementById("qrScanResult");

  resultBox.textContent = "Verifying QR code with database...";

  try {
    const res = await fetch("/api/tokens/verify-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrData })
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      resultBox.textContent = result.message || "QR verification failed.";
      return;
    }

    renderQRVerification(result.data);

    if (window.showToast) {
      window.showToast("Patient QR verified successfully!", "success");
    }

  } catch (err) {
    console.error("QR Verification Error:", err);
    resultBox.textContent = "Unable to verify QR. Please try again.";
  }
}

// ================= QR VERIFICATION CARD =================
function renderQRVerification(token) {
  const resultBox = document.getElementById("qrScanResult");
  const card = document.createElement("div");

  card.style.cssText = `
    padding:18px;
    margin-top:12px;
    border:1px solid var(--border);
    border-radius:12px;
    background:var(--card-bg, transparent);
  `;

  const heading = document.createElement("h3");
  heading.textContent = "QR Verified Successfully";
  heading.style.color = "var(--success, #16a34a)";
  card.appendChild(heading);

  const details = [
    ["Patient Name", token.user_name],
    ["Token Number", token.token_number],
    ["Department", token.department_name],
    ["Current Status", token.status]
  ];

  details.forEach(([label, value]) => {
    const row = document.createElement("p");
    row.style.margin = "10px 0";

    const strong = document.createElement("strong");
    strong.textContent = label + ": ";

    const span = document.createElement("span");
    span.textContent = value || "-";

    row.appendChild(strong);
    row.appendChild(span);
    card.appendChild(row);
  });

  // Show Check-in button only for WAITING tokens
  if (token.status === "WAITING") {
    const checkInBtn = document.createElement("button");

    checkInBtn.type = "button";
    checkInBtn.textContent = "Check In Patient";
    checkInBtn.className = "btn btn-primary";
    checkInBtn.style.marginTop = "12px";

    checkInBtn.addEventListener("click", () => {
      checkInToken(token.id, checkInBtn);
    });

    card.appendChild(checkInBtn);
  } else if (token.status === "CHECKED_IN") {
    const message = document.createElement("p");
    message.textContent = "Patient already checked in.";
    message.style.color = "var(--success, #16a34a)";
    card.appendChild(message);
  }

  resultBox.replaceChildren(card);
}

// ================= CHECK-IN PATIENT =================
async function checkInToken(tokenId, button) {
  try {
    button.disabled = true;
    button.textContent = "Checking in...";

    const res = await fetch("/api/tokens/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId })
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      button.disabled = false;
      button.textContent = "Check In Patient";

      if (window.showToast) {
        window.showToast(result.message || "Check-in failed", "error");
      }

      return;
    }

    // Show updated status and remove Check-in button
    renderQRVerification(result.data);

    // Refresh queue
    await loadQueue();

    if (window.showToast) {
      window.showToast("Patient checked in successfully!", "success");
    }

    console.log("Patient checked in:", result.data);

  } catch (err) {
    console.error("Check-in error:", err);

    button.disabled = false;
    button.textContent = "Check In Patient";

    if (window.showToast) {
      window.showToast("Unable to check in patient.", "error");
    }
  }
}


// ================= STOP QR SCANNER =================
async function stopQRScanner() {
  const resultBox = document.getElementById("qrScanResult");
  const startBtn = document.getElementById("startScannerBtn");
  const stopBtn = document.getElementById("stopScannerBtn");

  try {
    if (html5QrCode && scannerRunning) {
      scannerRunning = false;
      await html5QrCode.stop();
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;

    resultBox.textContent = "Scanner stopped.";

  } catch (err) {
    console.error("Stop scanner error:", err);
  }
}
