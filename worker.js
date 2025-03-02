
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

    // Handle GitHub OAuth callback and exchange code for token
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Error: No code received.", { status: 400 });
      }

      try {
        const token = await exchangeCodeForToken(code);
        return Response.redirect(`https://your-worker.example.workers.dev/dashboard?token=${token}`, 302);
      } catch (error) {
        return new Response(`Error exchanging token: ${error.message}`, { status: 500 });
      }
    }

    // Serve the dashboard page
    if (url.pathname === "/dashboard") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Error: No token found.", { status: 401 });
      }

      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      const finalHtml = dashboardHtml.replace("{{token}}", token);

      return new Response(finalHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Exchange the code for an access token from GitHub
async function exchangeCodeForToken(code, env) {
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Your-App-Name"
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,  // Access the environment variable
        client_secret: env.GITHUB_CLIENT_SECRET,  // Access the environment variable
        code: code
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("GitHub OAuth Error:", data.error_description);
      throw new Error(`GitHub OAuth Error: ${data.error_description}`);
    }

    console.log("GitHub OAuth Response:", data);
    return data.access_token;

  } catch (error) {
    console.error("Error during OAuth token exchange:", error.message);
    throw new Error(`OAuth Token Exchange Error: ${error.message}`);
  }
}
