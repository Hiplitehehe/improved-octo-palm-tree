
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ALLOWED_USERS = ["Hiplitehehe"]; // Replace with your GitHub username

    // 🔹 Serve the Login Page
    if (url.pathname === "/login") {
      const loginHtml = await env.R2_BUCKET.get("login.html"); // Adjust to your R2 bucket
      return new Response(loginHtml.body, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // 🔹 Handle the GitHub OAuth Callback
    if (url.pathname === "/callback") {
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
        return new Response(`Error: ${JSON.stringify(tokenData)}`, { status: 400 });
      }

      // Serve Callback Page
      const callbackHtml = await env.R2_BUCKET.get("callback.html");
      return new Response(callbackHtml.body, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // 🔹 Display Approved Notes
    if (url.pathname === "/notes") {
      const repo = "hiplitehehe/bookish-octo-robot"; // Replace with your repo
      const notesFile = "j.json";
      const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
      });

      if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

      const fileData = await fetchNotes.json();
      const notes = JSON.parse(atob(fileData.content));

      // Filter only approved notes
      const approvedNotes = notes.filter(note => note.approved);

      // Build HTML response
      let notesHtml = "<ul>";
      approvedNotes.forEach(note => {
        notesHtml += `<li>${note.title}</li>`;
      });
      notesHtml += "</ul>";

      const notesPageHtml = await env.R2_BUCKET.get("notes.html");
      const finalHtml = notesPageHtml.body.replace("{{notes}}", notesHtml); // Insert notes into the HTML template

      return new Response(finalHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
