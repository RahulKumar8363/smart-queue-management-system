// Protect Counter Staff Panel
const entryAllowed = sessionStorage.getItem("staffPanelEntry");
const adminToken = sessionStorage.getItem("adminToken");
const adminData = sessionStorage.getItem("adminData");

if (
    entryAllowed !== "1" ||
    !adminToken ||
    !adminData
) {
    window.location.replace("/admin-login.html");
    throw new Error("Admin login required");
}

// Consume one-time entry permission
sessionStorage.removeItem("staffPanelEntry");

// Clear login when leaving Staff Panel
window.addEventListener("pagehide", () => {
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminData");
});

// Handle browser back/forward
window.addEventListener("pageshow", (event) => {
    if (event.persisted && !sessionStorage.getItem("adminToken")) {
        window.location.replace("/admin-login.html");
    }
});

const socket = window.__socket || (window.__socket = io());

// ================= AUTH HELPER =================
function getAdminAuthHeaders() {
    const token = sessionStorage.getItem("adminToken");

    if (!token) {
        sessionStorage.removeItem("adminData");
        window.location.replace("/admin-login.html");
        return null;
    }

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

function handleUnauthorized() {
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminData");
    window.location.replace("/admin-login.html");
}

// ================= STATE =================
let currentCounterId = null;
let currentDeptId = null;
let currentServingToken = null;
let joinedDept = null;

let html5QrCode = null;
let scannerRunning = false;
let qrProcessing = false;

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
    const counterSelect = document.getElementById("counterSelect");
    if (!counterSelect) return;

    counterSelect.addEventListener("change", updateCounter);

    document.getElementById("callNextBtn")
        ?.addEventListener("click", callNext);

    document.getElementById("nextAfterBtn")
        ?.addEventListener("click", nextAfterComplete);

    document.getElementById("recallBtn")
        ?.addEventListener("click", recallToken);

    document.getElementById("completeBtn")
        ?.addEventListener("click", () => updateStatus("COMPLETED"));

    document.getElementById("noShowBtn")
        ?.addEventListener("click", () => updateStatus("NO_SHOW"));

    document.getElementById("startScannerBtn")
        ?.addEventListener("click", startQRScanner);

    document.getElementById("stopScannerBtn")
        ?.addEventListener("click", stopQRScanner);

    updateCounter();
});

// ================= COUNTER =================
function updateCounter() {
    const select = document.getElementById("counterSelect");

    if (!select || !select.value) return;

    currentCounterId = Number(select.value);
    currentDeptId = Number(
        select.options[select.selectedIndex].dataset.dept
    );

    joinDepartment(currentDeptId);
    loadQueue();

    console.log("Counter:", currentCounterId, "Dept:", currentDeptId);
}

// ================= SOCKET JOIN =================
function joinDepartment(deptId) {
    if (!deptId || joinedDept === deptId) return;

    joinedDept = deptId;

    // Must match queueSocket.js
    socket.emit("join:department", deptId);

    console.log("Joined department:", deptId);
}

// ================= CALL NEXT =================
async function callNext() {
    try {
        if (!currentCounterId || !currentDeptId) {
            alert("Select counter first");
            return false;
        }

        const authHeaders = getAdminAuthHeaders();
        if (!authHeaders) return false;

        const res = await fetch("/api/tokens/call-next", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                counter_id: currentCounterId,
                departmentId: currentDeptId
            })
        });

        const data = await res.json();

        if (res.status === 401) {
            handleUnauthorized();
            return false;
        }

        if (!res.ok || !data.success) {
            alert(data.message || "Unable to call next token");
            return false;
        }

        currentServingToken = data.data;
        renderServing(currentServingToken);
        await loadQueue();

        return true;

    } catch (err) {
        console.error("callNext error:", err);
        return false;
    }
}

// ================= UPDATE STATUS =================
async function updateStatus(status) {
    if (!currentServingToken?.id) return false;

    try {
        const authHeaders = getAdminAuthHeaders();
        if (!authHeaders) return false;

        const res = await fetch(
            `/api/tokens/status/${currentServingToken.id}`,
            {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify({ status })
            }
        );

        const data = await res.json();

        if (res.status === 401) {
            handleUnauthorized();
            return false;
        }

        if (!res.ok || !data.success) {
            alert(data.message || "Status update failed");
            return false;
        }

        currentServingToken = null;
        renderServing(null);
        await loadQueue();

        socket.emit("queue:update", {
            departmentId: currentDeptId
        });

        return true;

    } catch (err) {
        console.error("Status update error:", err);
        return false;
    }
}

// ================= NEXT AFTER COMPLETE =================
async function nextAfterComplete() {
    if (currentServingToken) {
        const completed = await updateStatus("COMPLETED");

        if (!completed) return;
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

    document.getElementById("servingTokenNum").innerText =
        token.token_number || "-";

    document.getElementById("servingCustomerName").innerText =
        token.user_name || "-";

    document.getElementById("servingDeptName").innerText =
        token.department_name || "-";
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
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;padding:32px;">
                        Select a counter to load the queue
                    </td>
                </tr>`;
            return;
        }

        const deptTokens = list.filter(
            t => Number(t.department_id) === Number(currentDeptId)
        );

        tbody.innerHTML = "";

        if (deptTokens.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;padding:32px;">
                        No patients waiting in this department
                    </td>
                </tr>`;
            return;
        }

        deptTokens.forEach((t, index) => {
            const row = document.createElement("tr");

            const status = t.status || "WAITING";
            const statusClass = "status-" + status;
            const statusLabel = status.replace("_", " ");

            const isServing = [
                "SERVING",
                "CALLED",
                "IN_PROGRESS"
            ].includes(status);

            if (isServing) {
                row.classList.add("row-serving");
            }

            const cells = [
                String(index + 1),
                t.token_number || "-",
                t.user_name || "-",
                statusLabel,
                t.estimated_wait_mins
                    ? `${t.estimated_wait_mins} min`
                    : "—"
            ];

            cells.forEach((value, cellIndex) => {
                const td = document.createElement("td");

                if (cellIndex === 3) {
                    const badge = document.createElement("span");
                    badge.className = `status-tag ${statusClass}`;
                    badge.textContent = value;
                    td.appendChild(badge);
                } else {
                    td.textContent = value;
                }

                row.appendChild(td);
            });

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

    alert(`Recalled ${currentServingToken.token_number}`);
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

                await verifyQRToken(decodedText);

                qrProcessing = false;
            },
            () => {}
        );

        scannerRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;

        resultBox.textContent =
            "Camera active. Point it at a QR code.";

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
    if (!resultBox) return;

    resultBox.textContent = "Verifying QR code with database...";

    try {
        const authHeaders = getAdminAuthHeaders();
        if (!authHeaders) return;

        const res = await fetch("/api/tokens/verify-qr", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ qrData })
        });

        const result = await res.json();

        if (res.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!res.ok || !result.success) {
            resultBox.textContent =
                result.message || "QR verification failed.";
            return;
        }

        renderQRVerification(result.data);

        if (window.showToast) {
            window.showToast(
                "Patient QR verified successfully!",
                "success"
            );
        }

    } catch (err) {
        console.error("QR Verification Error:", err);
        resultBox.textContent =
            "Unable to verify QR. Please try again.";
    }
}

// ================= QR VERIFICATION CARD =================
function renderQRVerification(token) {
    const resultBox = document.getElementById("qrScanResult");
    if (!resultBox) return;

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
        const authHeaders = getAdminAuthHeaders();
        if (!authHeaders) return;

        button.disabled = true;
        button.textContent = "Checking in...";

        const res = await fetch("/api/tokens/check-in", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ tokenId })
        });

        const result = await res.json();

        if (res.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!res.ok || !result.success) {
            button.disabled = false;
            button.textContent = "Check In Patient";

            if (window.showToast) {
                window.showToast(
                    result.message || "Check-in failed",
                    "error"
                );
            }
            return;
        }

        renderQRVerification(result.data);
        await loadQueue();

        if (window.showToast) {
            window.showToast(
                "Patient checked in successfully!",
                "success"
            );
        }

        console.log("Patient checked in:", result.data);

    } catch (err) {
        console.error("Check-in error:", err);

        button.disabled = false;
        button.textContent = "Check In Patient";

        if (window.showToast) {
            window.showToast(
                "Unable to check in patient.",
                "error"
            );
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

        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;

        if (resultBox) {
            resultBox.textContent = "Scanner stopped.";
        }

    } catch (err) {
        console.error("Stop scanner error:", err);
    }
}
