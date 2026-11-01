const token = sessionStorage.getItem("adminToken");
const adminData = JSON.parse(
    sessionStorage.getItem("adminData") || "null"
);

// Protect dashboard
if (!token || !adminData) {
    window.location.replace("/admin-login.html");
}

// Display admin name
document.getElementById("adminName").textContent =
    adminData?.name || "Admin";

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminData");

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
            throw new Error(result.message || "Analytics loading failed");
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

if (token && adminData) {
    loadAdminAnalytics();
}