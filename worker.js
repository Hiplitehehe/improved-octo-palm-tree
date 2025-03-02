
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = request.headers.get("Authorization")?.split(" ")[1];

    // Serve Dashboard HTML
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/callback") {
  const code = url.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.REDIRECT_URI
    })
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    return new Response(`GitHub Error: ${JSON.stringify(tokenData)}`, { status: 400 });
  }

  return Response.redirect(
    `https://my-worker.hiplitehehe.workers.dev/dashboard?token=${tokenData.access_token}`,
    302
  );
}
    
    // Get GitHub User Info
    if (url.pathname === "/whoami") {
      if (!token) return new Response(JSON.stringify({ error: "No token provided" }), { status: 401 });

      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "HipliteWorker/1.0"
        }
      });

      const userData = await userResponse.json();
      return new Response(JSON.stringify(userData), { headers: { "Content-Type": "application/json" } });
    }

    // Fetch Approved Notes
    if (url.pathname === "/notes") {
      return fetchNotes(env);
    }

    // Make a Note
    if (url.pathname === "/make-note" && request.method === "POST") {
      return makeNote(request, env, token);
    }

    // Approve a Note
    if (url.pathname === "/approve" && request.method === "POST") {
      return approveNote(request, env, token);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Fetch Approved Notes
async function fetchNotes(env) {
  const repo = "hiplitehehe/notes";
  const file = "j.json";
  const url = `https://api.github.com/repos/${repo}/contents/${file}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "HipliteWorker/1.0"
    }
  });

  if (!response.ok) return new Response("Failed to fetch notes", { status: 500 });

  const fileData = await response.json();
  const notes = JSON.parse(atob(fileData.content));

  return new Response(JSON.stringify(notes.filter(note => note.approved)), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

// Create a Note
async function makeNote(request, env, token) {
  if (!token) return new Response("Unauthorized", { status: 401 });

  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "HipliteWorker/1.0" }
  });

  const userData = await userResponse.json();
  if (!userData.login) return new Response("Invalid token", { status: 401 });

  const { title, content } = await request.json();
  if (!title || !content) return new Response("Missing title or content", { status: 400 });

  const repo = "hiplitehehe/notes";
  const file = "j.json";
  const url = `https://api.github.com/repos/${repo}/contents/${file}`;

  const fetchNotes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "HipliteWorker/1.0"
    }
  });

  let notes = [];
  let sha = null;

  if (fetchNotes.ok) {
    const fileData = await fetchNotes.json();
    notes = JSON.parse(atob(fileData.content));
    sha = fileData.sha;
  }

  notes.push({ title, content, approved: false });

  const updateResponse = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "HipliteWorker/1.0"
    },
    body: JSON.stringify({
      message: `New note: ${title}`,
      content: btoa(JSON.stringify(notes, null, 2)),
      sha
    })
  });

  if (!updateResponse.ok) return new Response("Failed to create note", { status: 500 });

  return new Response(JSON.stringify({ message: `Note "${title}" created!` }), { status: 200 });
}

// Approve a Note
async function approveNote(request, env, token) {
  if (!token) return new Response("Unauthorized", { status: 401 });

  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "HipliteWorker/1.0" }
  });

  const userData = await userResponse.json();
  if (!userData.login) return new Response("Invalid token", { status: 401 });

  const ALLOWED_USERS = ["Hiplitehehe"];
  if (!ALLOWED_USERS.includes(userData.login)) {
    return new Response("Permission denied", { status: 403 });
  }

  const { title } = await request.json();
  if (!title) return new Response("Missing note title", { status: 400 });

  const repo = "hiplitehehe/notes";
  const file = "j.json";
  const url = `https://api.github.com/repos/${repo}/contents/${file}`;

  const fetchNotes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "HipliteWorker/1.0"
    }
  });

  if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

  const fileData = await fetchNotes.json();
  const notes = JSON.parse(atob(fileData.content));

  let found = false;
  const updatedNotes = notes.map(note => {
    if (note.title === title) {
      found = true;
      return { ...note, approved: true };
    }
    return note;
  });

  if (!found) return new Response("Note not found", { status: 404 });

  const updateResponse = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "HipliteWorker/1.0"
    },
    body: JSON.stringify({
      message: `Approved note: ${title}`,
      content: btoa(JSON.stringify(updatedNotes, null, 2)),
      sha: fileData.sha
    })
  });

  if (!updateResponse.ok) return new Response("Failed to approve note", { status: 500 });

  return new Response(JSON.stringify({ message: `Note "${title}" approved!` }), { status: 200 });
}
