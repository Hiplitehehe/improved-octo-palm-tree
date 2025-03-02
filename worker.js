
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the login page
    if (url.pathname === "/login") {
      const loginHtml = await env.HTML_FILES.get("login.html");
      return new Response(loginHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Handle GitHub OAuth callback
    if (url.pathname === "/callback") {
      const urlParams = new URLSearchParams(url.search);
      const code = urlParams.get("code");

      if (!code) {
        return new Response("Error: No code received", { status: 400 });
      }

      try {
        const token = await exchangeCodeForToken(code, env);
        if (!token) {
          return new Response("Error: Failed to exchange code for token", { status: 500 });
        }

        // Store the token in the session or as a cookie
        return Response.redirect('/dashboard', 302);
      } catch (error) {
        return new Response(`Exchange Error: ${error.message}`, { status: 500 });
      }
    }

    // Serve the dashboard page
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      const token = await getTokenFromRequest(request);
      if (!token) {
        return Response.redirect('/login', 302);
      }

      // Show the dashboard content based on the token (you can add more logic here)
      return new Response(dashboardHtml.replace("{{token}}", token), {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Function to exchange GitHub OAuth code for token
async function exchangeCodeForToken(code, env) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,  // Access the environment variable here
      client_secret: env.GITHUB_CLIENT_SECRET,  // Access the environment variable here
      code: code,
    }),
  });

  const data = await response.text();
  const params = new URLSearchParams(data);
  const token = params.get("access_token");
  return token;
}

// Mock function for fetching notes data
async function fetchNotesData() {
  return [
    { title: "Approved Note 1" },
    { title: "Approved Note 2" },
  ];
}

// Get the token from cookies or request headers (you can adjust this based on your logic)
async function getTokenFromRequest(request) {
  const cookies = request.headers.get("Cookie");
  if (cookies) {
    const match = cookies.match(/token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  return null;
}
