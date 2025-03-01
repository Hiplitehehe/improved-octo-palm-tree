
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
        notesData = await fetchNotesData();
      } catch (error) {
        const errorMessage = `GitHub Error: ${error.message}`;
        return new Response(errorMessage, {
          headers: { "Content-Type": "text/html" },
          status: 500,
        });
      }

      // Create a dynamic list of notes
      let notesList = "<ul>";
      notesData.forEach(note => {
        notesList += `<li>${note.title}</li>`;
      });
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

// Mock function for fetching approved notes (replace with actual GitHub API logic)
async function fetchNotesData() {
  // Simulating a GitHub API request that could fail
  const response = await fetch("https://api.github.com/repos/hiplitehehe/Notes/contents/j.json");
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
  const data = await response.json();

  // Simulate decoding and returning notes
  const notes = JSON.parse(atob(data.content));
  return notes.filter(note => note.approved); // Filter approved notes
}
