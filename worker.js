
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    // Handle the creation of a new note
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
