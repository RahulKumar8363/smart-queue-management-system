
const loginForm = document.getElementById("adminLoginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "Logging in...";

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            message.textContent = data.message || "Login failed";
            message.style.color = "red";
            return;
        }

        // Store login details
        sessionStorage.setItem("adminToken", data.token);
        sessionStorage.setItem("adminData", JSON.stringify(data.admin));

        // Allow one-time entry to Counter Staff Panel
        sessionStorage.setItem("staffPanelEntry", "1");

        message.textContent = "Login successful!";
        message.style.color = "green";

        // Redirect directly to Counter Staff Panel
        window.location.href = "/admin.html";

    } catch (error) {
        console.error("Login error:", error);

        message.textContent = "Server connection failed.";
        message.style.color = "red";
    }
});
