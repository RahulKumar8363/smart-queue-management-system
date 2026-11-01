const signupForm = document.getElementById("signupForm");
const message = document.getElementById("message");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("/api/auth/staff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();
    message.textContent = data.message;

    if (response.ok) {
      signupForm.reset();
      setTimeout(() => {
        window.location.href = "/admin-login.html";
      }, 1500);
    }
  } catch (error) {
    message.textContent = "Something went wrong!";
  }
});