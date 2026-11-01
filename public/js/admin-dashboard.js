
const token = sessionStorage.getItem("adminToken");

const adminData = JSON.parse(
    sessionStorage.getItem("adminData") || "null"
);

// Protect dashboard
if (!token || !adminData) {
    window.location.replace("/admin-login.html");
    throw new Error("Login required");
}

// Display admin name
document.getElementById("adminName").textContent =
    adminData.name || "Admin";

// Staff section: Super Admin only
const staffSection = document.getElementById("staffSection");

if (adminData.role === "SUPER_ADMIN") {
    staffSection.hidden = false;
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminData");
    sessionStorage.removeItem("staffPanelEntry");

    window.location.replace("/admin-login.html");
});

// Load analytics
async function loadAdminAnalytics() {
    try {
        const response = await fetch("/api/analytics/admin", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Analytics loading failed"
            );
        }

        const summary = result.data.summary;

        document.getElementById("totalTokens").textContent =
            summary.totalBooked ?? 0;

        document.getElementById("waitingTokens").textContent =
            summary.waitingCount ?? 0;

        document.getElementById("servingTokens").textContent =
            summary.servingCount ?? 0;

        document.getElementById("completedTokens").textContent =
            summary.completedCount ?? 0;

    } catch (error) {
        console.error("Admin Dashboard Error:", error);
    }
}

// Create Staff Account
const staffForm = document.getElementById("staffForm");
const staffMessage = document.getElementById("staffMessage");

staffForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Frontend role check
    if (adminData.role !== "SUPER_ADMIN") {
        staffMessage.textContent =
            "Only Super Admin can create staff accounts.";
        staffMessage.style.color = "red";
        return;
    }

    const name = document.getElementById("staffName").value.trim();
    const email = document.getElementById("staffEmail").value.trim();
    const password = document.getElementById("staffPassword").value;

    staffMessage.textContent = "Creating staff account...";
    staffMessage.style.color = "#2563eb";

    try {
        const response = await fetch("/api/auth/staff", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                email,
                password
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Staff account creation failed"
            );
        }

        staffMessage.textContent =
            "Staff account created successfully!";

        staffMessage.style.color = "green";

        staffForm.reset();

    } catch (error) {
        console.error("Create Staff Error:", error);

        staffMessage.textContent = error.message;
        staffMessage.style.color = "red";
    }
});

// Load analytics
loadAdminAnalytics();
