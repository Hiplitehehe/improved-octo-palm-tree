export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      if (!dashboardHtml) {
        return new Response("Dashboard not found", { status: 404 });
      }
      return new Response(dashboardHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};

    if (pathname === "/admin") {
  const token = url.searchParams.get("token");
  if (!token || token !== env.ADMIN_TOKEN) {
    return new Response("Unauthorized", { status: 403 });
  }

  const notesUrl = `https://api.github.com/repos/hiplitehehe/notes/contents/j.json`;

  const notesResponse = await fetch(notesUrl, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "YourApp",
    },
  });

  if (!notesResponse.ok) return new Response("Failed to fetch notes", { status: 500 });

  const fileData = await notesResponse.json();
  let notes = JSON.parse(atob(fileData.content));

  let noteList = "<ul>";
  notes.forEach(note => {
    noteList += `<li>${note.title} - ${note.approved ? "✅ Approved" : "❌ Not Approved"} 
      ${!note.approved ? `<button onclick="approve('${note.title}')">Approve</button>` : ""}
    </li>`;
  });
  noteList += "</ul>";

  const adminHtml = `
    <html>
      <head><title>Admin Panel</title></head>
      <body>
        <h1>Admin Panel</h1>
        <p>Logged in as Admin</p>
        <button onclick="location.href='/dashboard?token=${token}'">Go to Dashboard</button>
        <h2>Manage Notes</h2>
        ${noteList}
        <script>
          function approve(title) {
            fetch('/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ${token}' },
              body: JSON.stringify({ title })
            }).then(() => location.reload());
          }
        </script>
      </body>
    </html>
  `;

  return new Response(adminHtml, {
    headers: { "Content-Type": "text/html" },
    status: 200,
  });
}
    
    // 🔹 Login Route (Redirect to GitHub OAuth)
    if (pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=repo`,
        302
      );
    }

    // 🔹 GitHub OAuth Callback
    if (pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.REDIRECT_URI,
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        return new Response(`GitHub Error: ${JSON.stringify(tokenData)}`, { status: 400 });
      }

      return Response.redirect(
        `https://hiplitehehe.github.io/bookish-octo-robot/dashboard.html?token=${tokenData.access_token}`,
        302
      );
    }

    // 🔹 Fetch Notes (Admin sees all, normal users see only approved)
    if (pathname === "/notes") {
      const token = url.searchParams.get("token");
      if (!token) return new Response("Missing token", { status: 401 });

      const isAdmin = token === env.ADMIN_TOKEN;
      const notesUrl = `https://api.github.com/repos/hiplitehehe/notes/contents/j.json`;

      const notesResponse = await fetch(notesUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "YourApp",
        },
      });

      if (!notesResponse.ok) return new Response("Failed to fetch notes", { status: 500 });

      const fileData = await notesResponse.json();
      let notes = JSON.parse(atob(fileData.content));

      if (!isAdmin) {
        notes = notes.filter(note => note.approved);
      }

      return new Response(JSON.stringify(notes), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 🔹 Approve Note (Only Admin)
    if (pathname === "/approve") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const token = request.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token || token !== env.ADMIN_TOKEN) {
        return new Response("Permission denied: Only admin can approve.", { status: 403 });
      }

      const body = await request.json();
      if (!body.title) return new Response("Missing note title", { status: 400 });

      const notesUrl = `https://api.github.com/repos/hiplitehehe/notes/contents/j.json`;
      const fetchNotes = await fetch(notesUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "YourApp",
        },
      });

      if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

      const fileData = await fetchNotes.json();
      let notes = JSON.parse(atob(fileData.content));

      const noteIndex = notes.findIndex(note => note.title === body.title);
      if (noteIndex === -1) return new Response("Note not found", { status: 404 });

      notes[noteIndex].approved = true;

      const updateResponse = await fetch(notesUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "YourApp",
        },
        body: JSON.stringify({
          message: `Approved note: ${body.title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha: fileData.sha,
        }),
      });

      if (!updateResponse.ok) return new Response("Failed to approve note", { status: 500 });

      return new Response(JSON.stringify({ message: `Note "${body.title}" approved!` }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 🔹 Create Note
    if (pathname === "/make-note") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const body = await request.json();
      if (!body.title || !body.content) return new Response("Missing fields", { status: 400 });

      const notesUrl = `https://api.github.com/repos/hiplitehehe/notes/contents/j.json`;
      const fetchNotes = await fetch(notesUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "YourApp",
        },
      });

      if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

      const fileData = await fetchNotes.json();
      let notes = JSON.parse(atob(fileData.content));

      notes.push({ title: body.title, content: body.content, approved: false });

      const updateResponse = await fetch(notesUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "YourApp",
        },
        body: JSON.stringify({
          message: `Added note: ${body.title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha: fileData.sha,
        }),
      });

      if (!updateResponse.ok) return new Response("Failed to create note", { status: 500 });

      return new Response(JSON.stringify({ message: `Note "${body.title}" created!` }), {
        headers: { "Content-Type": "application/json" },
        status: 201,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
