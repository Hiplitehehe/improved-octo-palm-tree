
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
      const callbackHtml = await env.HTML_FILES.get("callback.html");
      const urlParams = new URLSearchParams(url.search);
      const code = urlParams.get("code");

      if (!code) {
        return new Response("Error: No code received", { status: 400 });
      }

      const token = await exchangeCodeForToken(code);  // This is your GitHub token exchange function

      if (!token) {
        return new Response("Error: Failed to exchange code for token", { status: 500 });
      }

      return new Response(`Login Successful. Token: ${token}`, { status: 200 });
    }

    // Serve the dashboard page
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");

      // Check if the user is logged in and has a token
      const token = request.headers.get("Authorization");
      if (!token) {
        return new Response("Unauthorized", { status: 401 });
      }

      // Fetch user data using the token (assume you have a GitHub API function)
      const userData = await getUserDataFromGitHub(token);
      if (!userData) {
        return new Response("GitHub OAuth Error", { status: 500 });
      }

      // Replace {{userName}} in the HTML with the user's GitHub username
      const finalHtml = dashboardHtml.replace("{{userName}}", userData.login);

      return new Response(finalHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Handle creating a new note
    if (url.pathname === "/create-note" && request.method === "POST") {
      const token = request.headers.get("Authorization");
      if (!token) {
        return new Response("Unauthorized", { status: 401 });
      }

      const body = await request.json();
      const noteContent = body.content;

      // Store the note content (this could be a GitHub commit or a database)
      await saveNoteToDatabase(noteContent, token);

      return new Response(JSON.stringify({ message: "Note created successfully!" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle fetching notes
    if (url.pathname === "/get-notes" && request.method === "GET") {
      const token = request.headers.get("Authorization");
      if (!token) {
        return new Response("Unauthorized", { status: 401 });
      }

      const notes = await fetchNotesFromDatabase(token);

      return new Response(JSON.stringify(notes), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle approving notes
    if (url.pathname === "/approve-note" && request.method === "POST") {
      const token = request.headers.get("Authorization");
      if (!token) {
        return new Response("Unauthorized", { status: 401 });
      }

      const body = await request.json();
      const noteId = body.noteId;

      // Approve the note
      const result = await approveNoteInDatabase(noteId);

      return new Response(JSON.stringify({ message: result ? "Note approved!" : "Error approving note." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Function to fetch user data from GitHub API
async function getUserDataFromGitHub(token) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

// Function to save a note to your database or GitHub
async function saveNoteToDatabase(content, token) {
  // Replace this with actual logic for saving the note (e.g., commit to GitHub, store in database)
  console.log("Saving note:", content);
}

// Function to fetch notes from your database or GitHub
async function fetchNotesFromDatabase(token) {
  // Replace this with actual logic for fetching notes (e.g., query database, GitHub API)
  return [
    { content: "First note" },
    { content: "Second note" },
  ];
}

// Function to approve a note (this could update a field in your database)
async function approveNoteInDatabase(noteId) {
  // Replace this with actual logic to approve the note (e.g., update a field in GitHub, database)
  console.log(`Approving note with ID: ${noteId}`);
  return true;
}

// Function to exchange GitHub OAuth code for token
async function exchangeCodeForToken(code) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: code,
    }),
  });

  const data = await response.text();
  const params = new URLSearchParams(data);
  const token = params.get("access_token");
  return token;
}
