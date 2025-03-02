
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the login page
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=repo`,
        302
      );
    }

    // Handle GitHub OAuth callback
    if (url.pathname === "/callback") {
      return new Response(await env.HTML_FILES.get("callback.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Serve the notes page and fetch approved notes
    if (url.pathname === "/notes") {
      return await fetchNotesPage(env);
    }

    // API route to fetch notes from GitHub
    if (url.pathname === "/api/notes") {
      return await fetchNotesData(env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Fetch and return the notes page with GitHub data injected
async function fetchNotesPage(env) {
  try {
    const notesHtml = await env.HTML_FILES.get("notes.html");
    const notesResponse = await fetchNotesData(env);

    if (!notesResponse.ok) {
      return new Response(`GitHub API Error: ${notesResponse.statusText}`, { status: notesResponse.status });
    }

    const notesData = await notesResponse.json();
    let notesList = "<ul>";
    notesData.forEach((note) => {
      notesList += `<li>${note.title}</li>`;
    });
    notesList += "</ul>";

    return new Response(notesHtml.replace("{{notes}}", notesList), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

// Fetch approved notes from GitHub
async function fetchNotesData(env) {
  try {
    const repo = "hiplitehehe/Notes"; // Replace with your repo
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
      const errorBody = await response.text();
      return new Response(
        JSON.stringify({
          error: `GitHub API Error: ${response.status} ${response.statusText}`,
          details: errorBody,
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const fileData = await response.json();
    const notes = JSON.parse(atob(fileData.content));

    return new Response(JSON.stringify(notes.filter(note => note.approved)), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
