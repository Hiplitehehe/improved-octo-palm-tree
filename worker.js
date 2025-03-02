
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
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Error: No code received", { status: 400 });
      }

      try {
        const token = await exchangeCodeForToken(code, env);
        return Response.redirect(`https://my-worker.hiplitehehe.workers.dev/dashboard?token=${token}`);
      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }

    // Dashboard route
    if (url.pathname === "/dashboard") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Error: Unauthorized. Please log in first.", { status: 401 });
      }

      // Fetch user data from GitHub with the token
      const user = await getUserFromToken(token, env);
      if (!user) {
        return new Response("Error: Invalid token", { status: 401 });
      }

      // Serve dashboard HTML with user data
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      const dashboardContent = dashboardHtml.replace("{{userName}}", user.login);
      return new Response(dashboardContent, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Default route (404 if no match)
    return new Response("Not Found", { status: 404 });
  },
};

// Function to exchange the authorization code for an access token
async function exchangeCodeForToken(code, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new Error("GitHub client ID or client secret is missing");
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Your-App-Name",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub OAuth Error: ${data.error_description}`);
  }

  return data.access_token;
}

// Function to get user information from GitHub using the access token
async function getUserFromToken(token, env) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      "Authorization": `Bearer ${token}`,
      "User-Agent": "Your-App-Name",
    },
  });

  if (!response.ok) {
    return null; // Token is invalid or expired
  }

  const user = await response.json();
  return user;
}
