
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/notes") {
      return await getNotes(env);
    }

    if (url.pathname === "/make-note" && request.method === "POST") {
      return await makeNote(request, env);
    }

    if (url.pathname === "/approve" && request.method === "POST") {
      return await approveNote(request, env);
    }

    return new Response("Not Found", { status: 404 });
  }
};

// 🔹 Function to Get Approved Notes
async function getNotes(env) {
  const repo = "Hiplitehehe/Notes";
  const notesFile = "j.json";
  const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

  try {
    const response = await fetch(notesUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "hiplitehehe-Notes-App",
      },
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      return new Response(JSON.stringify({ error: "GitHub API Error", status: response.status, details: errorDetails }), {
        headers: { "Content-Type": "application/json" },
        status: response.status,
      });
    }

    const fileData = await response.json();
    const notes = JSON.parse(atob(fileData.content));
    const approvedNotes = notes.filter(note => note.approved);

    return new Response(JSON.stringify(approvedNotes), { headers: { "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), { status: 500 });
  }
}

// 🔹 Function to Make a Note
async function makeNote(request, env) {
  try {
    const { title, content } = await request.json();
    if (!title || !content) return new Response("Missing title or content", { status: 400 });

    const repo = "Hiplitehehe/Notes";
    const notesFile = "j.json";
    const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

    const fetchNotes = await fetch(notesUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "hiplitehehe-Notes-App",
      },
    });

    let notes = [];
    let sha = null;
    if (fetchNotes.ok) {
      const fileData = await fetchNotes.json();
      notes = JSON.parse(atob(fileData.content));
      sha = fileData.sha;
    }

    notes.push({ title, content, approved: false });

    const updateResponse = await fetch(notesUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "hiplitehehe-Notes-App",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Added note: ${title}`,
        content: btoa(JSON.stringify(notes, null, 2)),
        sha: sha,
      }),
    });

    if (!updateResponse.ok) {
      const errorDetails = await updateResponse.text();
      return new Response(JSON.stringify({ error: "GitHub API Error", details: errorDetails }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: `Note "${title}" added!` }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), { status: 500 });
  }
}

// 🔹 Function to Approve a Note
async function approveNote(request, env) {
  try {
    const { title } = await request.json();
    if (!title) return new Response("Missing note title", { status: 400 });

    const repo = "Hiplitehehe/Notes";
    const notesFile = "j.json";
    const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

    const fetchNotes = await fetch(notesUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "hiplitehehe-Notes-App",
      },
    });

    if (!fetchNotes.ok) {
      const errorDetails = await fetchNotes.text();
      return new Response(JSON.stringify({ error: "GitHub API Error", details: errorDetails }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    const fileData = await fetchNotes.json();
    let notes = JSON.parse(atob(fileData.content));
    const sha = fileData.sha;

    const note = notes.find(n => n.title === title);
    if (!note) return new Response("Note not found", { status: 404 });

    note.approved = true;

    const updateResponse = await fetch(notesUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "hiplitehehe-Notes-App",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Approved note: ${title}`,
        content: btoa(JSON.stringify(notes, null, 2)),
        sha: sha,
      }),
    });

    if (!updateResponse.ok) {
      const errorDetails = await updateResponse.text();
      return new Response(JSON.stringify({ error: "GitHub API Error", details: errorDetails }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: `Note "${title}" approved!` }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), { status: 500 });
  }
}
