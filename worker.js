
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
      return new Response(callbackHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Serve the notes page with dynamic content
    if (url.pathname === "/notes") {
      const notesHtml = await env.HTML_FILES.get("notes.html");

      // Fetch approved notes data and handle GitHub API errors
      let notesData;
      try {
        notesData = await fetchNotesData(env);
      } catch (error) {
        const errorMessage = `GitHub Error: ${error.message}`;
        return new Response(errorMessage, {
          headers: { "Content-Type": "text/html" },
          status: 500,
        });
      }

      // Create a dynamic list of notes
      let notesList = "<ul>";
      if (notesData.length === 0) {
        notesList = "<p>No approved notes available.</p>";
      } else {
        notesData.forEach(note => {
          notesList += `<li>${note.title}</li>`;
        });
      }
      notesList += "</ul>";

      // Replace the placeholder in the notes HTML template
      const finalHtml = notesHtml.replace("{{notes}}", notesList);

      return new Response(finalHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Fetch approved notes data from GitHub repository
async function fetchNotesData(env) {
  const repo = "Hiplitehehe/Notes"; // Replace with your repo name
  const notesFile = "j.json"; // The file containing the notes
  const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

  try {
    // Fetch the notes file from GitHub with authorization token
    const response = await fetch(notesUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`, // Use GitHub token stored in environment variables
        "Accept": "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch notes from GitHub: ${response.statusText}`);
    }

    const fileData = await response.json();
    const notes = JSON.parse(atob(fileData.content)); // Decode and parse the content
    return notes.filter(note => note.approved); // Filter for approved notes
  } catch (error) {
    console.error("Error fetching notes data:", error);
    throw new Error("Unable to fetch notes from GitHub");
  }
}
