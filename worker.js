
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

      try {
        const token = await exchangeCodeForToken(code, env);
        if (!token) {
          return new Response("Error: Failed to exchange code for token", { status: 500 });
        }

        return new Response(`Login Successful. Token: ${token}`, { status: 200 });
      } catch (error) {
        return new Response(`Exchange Error: ${error.message}`, { status: 500 });
      }
    }

    // Serve the notes page
    if (url.pathname === "/notes") {
      const notesHtml = await env.HTML_FILES.get("notes.html");
      const notesData = await fetchNotesData(); // Fetch approved notes data (this can be a GitHub API request)
      let notesList = "<ul>";

      notesData.forEach(note => {
        notesList += `<li>${note.title}</li>`;
      });

      notesList += "</ul>";
      const finalHtml = notesHtml.replace("{{notes}}", notesList);
      return new Response(finalHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Handle make note
    if (url.pathname === "/make-note") {
      const makeNoteHtml = await env.HTML_FILES.get("make-note.html");
      return new Response(makeNoteHtml, {
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

// Mock function for fetching approved notes
async function fetchNotesData() {
  // Replace with actual fetching logic from GitHub or your backend
  return [
    { title: "Approved Note 1" },
    { title: "Approved Note 2" },
  ];
}
