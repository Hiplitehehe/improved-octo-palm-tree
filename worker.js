
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 🔹 Serve the dashboard page
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // 🔹 Fetch all notes (both approved and pending)
    if (url.pathname === "/api/all-notes") {
      return await fetchAllNotes(env);
    }

    // 🔹 Make a new note
    if (url.pathname === "/make-note" && request.method === "POST") {
      return await makeNote(request, env);
    }

    // 🔹 Approve a note
    if (url.pathname === "/approve" && request.method === "POST") {
      return await approveNote(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Fetch all notes from GitHub
async function fetchAllNotes(env) {
  try {
    const repo = "hiplitehehe/Notes";
    const notesFile = "j.json";
    const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

    const response = await fetch(notesUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CloudflareWorker",
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "GitHub API Error", details: await response.text() }), { 
        status: response.status, 
        headers: { "Content-Type": "application/json" }
      });
    }

    const fileData = await response.json();
    const notes = JSON.parse(atob(fileData.content));

    return new Response(JSON.stringify(notes), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Approve a note by updating GitHub
async function approveNote(request, env) {
  try {
    const { title } = await request.json();
    if (!title) return new Response("Missing note title", { status: 400 });

    // Fetch notes
    const repo = "hiplitehehe/Notes";
    const notesFile = "j.json";
    const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

    const fetchNotes = await fetch(notesUrl, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
    });

    if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

    const fileData = await fetchNotes.json();
    let notes = JSON.parse(atob(fileData.content));
    const sha = fileData.sha;

    // Find and approve note
    const note = notes.find(n => n.title === title);
    if (!note) return new Response("Note not found", { status: 404 });

    note.approved = true;

    // Update GitHub file
    const updateResponse = await fetch(notesUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Approved note: ${title}`,
        content: btoa(JSON.stringify(notes, null, 2)),
        sha: sha,
      }),
    });

    if (!updateResponse.ok) return new Response("Failed to approve note", { status: 500 });

    return new Response(JSON.stringify({ message: `Note "${title}" approved!` }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" }
    });
  }
}
