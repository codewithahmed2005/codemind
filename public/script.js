// -----------------------------------------------------
// Basic DOM references
// -----------------------------------------------------
const taskTypeSelect = document.getElementById("taskType");
const languageInput = document.getElementById("language");
const targetLanguageInput = document.getElementById("targetLanguage");
const targetLanguageWrapper = document.getElementById("targetLanguageWrapper");
const extraInput = document.getElementById("extra");
const codeTextarea = document.getElementById("code");
const resultBox = document.getElementById("resultBox");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.querySelector(".response-status");
const themeToggle = document.getElementById("themeToggle");

let codeEditor = null;


function goToHome() {
    window.location.href = "index.html";
}


// -----------------------------------------------------
// Theme Toggle Functionality (Updated)
// -----------------------------------------------------
function initTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;
  
  // Check saved theme or prefer color scheme
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  // Set initial theme
  if (savedTheme) {
    body.setAttribute("data-theme", savedTheme);
  } else if (prefersDark) {
    body.setAttribute("data-theme", "dark");
  } else {
    body.setAttribute("data-theme", "light");
  }
  
  // Update toggle button icon
  updateThemeToggleIcon();
  initCodeMirror();
}

function updateThemeToggleIcon() {
  const themeToggle = document.getElementById("themeToggle");
  const currentTheme = document.body.getAttribute("data-theme");
  
  if (themeToggle) {
    const icon = themeToggle.querySelector(".theme-icon");
    if (icon) {
      // Sirf icon change karo, text nahi
      icon.textContent = currentTheme === "light" ? "🌙" : "☀️";
    }
  }
}

// Toggle theme on button click
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const body = document.body;
    const currentTheme = body.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    
    body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    
    updateThemeToggleIcon();
    updateCodeMirrorTheme(newTheme);
  });
}
// -----------------------------------------------------
// Init CodeMirror (syntax highlighting editor)
// -----------------------------------------------------
function initCodeMirror() {
  if (window.CodeMirror && codeTextarea) {
    const currentTheme = document.body.getAttribute("data-theme");
    const editorTheme = currentTheme === "dark" ? "material-darker" : "default";
    
    codeEditor = CodeMirror.fromTextArea(codeTextarea, {
      lineNumbers: true,
      mode: "javascript",
      theme: editorTheme,
      tabSize: 2,
      indentUnit: 2,
      lineWrapping: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      extraKeys: {
        "Ctrl-Enter": function() { runAi(); },
        "Cmd-Enter": function() { runAi(); }
      }
    });

    // Set proper background based on theme
    codeEditor.setValue("// Paste your code here...\n// Or start typing your code\n\nfunction example() {\n  console.log('Hello, AI Code Helper!');\n}");
  }
}

// -----------------------------------------------------
// Initialize everything when DOM loads
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", function() {
  initTheme();
  initUserAuth();
});

// -----------------------------------------------------
// Task type change → show/hide target language input
// -----------------------------------------------------
taskTypeSelect.addEventListener("change", () => {
  if (taskTypeSelect.value === "convert") {
    targetLanguageWrapper.style.display = "block";
    targetLanguageInput.setAttribute("required", "true");
  } else {
    targetLanguageWrapper.style.display = "none";
    targetLanguageInput.removeAttribute("required");
  }
});

// -----------------------------------------------------
// Helper: get current code value (from CodeMirror or textarea)
// -----------------------------------------------------
function getCurrentCode() {
  if (codeEditor) return codeEditor.getValue();
  return codeTextarea.value;
}

// -----------------------------------------------------
// Chat message rendering
// -----------------------------------------------------
function appendChatMessage(role, text) {
  if (!resultBox) return;

  // remove empty placeholder
  const emptyNode = resultBox.querySelector(".chat-empty");
  if (emptyNode) emptyNode.remove();

  const msg = document.createElement("div");
  msg.className = `chat-msg chat-msg-${role}`;

  const label = document.createElement("div");
  label.className = "chat-label";
  label.textContent = role === "user" ? "You" : "AI";

  const body = document.createElement("pre");
  body.className = "chat-text";
  body.textContent = text;

  msg.appendChild(label);
  msg.appendChild(body);
  resultBox.appendChild(msg);

  // scroll to bottom
  resultBox.scrollTop = resultBox.scrollHeight;
}

// -----------------------------------------------------
// Clear chat history
// -----------------------------------------------------
function clearChat() {
  if (resultBox) {
    resultBox.innerHTML = '<div class="chat-empty">Waiting for your first request…</div>';
  }
  if (statusEl) statusEl.textContent = "Ready";
}

// -----------------------------------------------------
// Submit / Run AI
// -----------------------------------------------------
async function runAi() {
  const taskType = taskTypeSelect.value;
  const language = languageInput.value.trim();
  const targetLanguage = targetLanguageInput.value.trim();
  const extra = extraInput.value.trim();
  const code = getCurrentCode().trim();

  if (!code || code === "// Paste your code here...\n// Or start typing your code\n\nfunction example() {\n  console.log('Hello, AI Code Helper!');\n}") {
    alert("Pehle kuch code paste karo ya likho 🙂");
    return;
  }

  // Disable button and show loading
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Processing...</span><span class="btn-kbd">⏳</span>';
  
  if (statusEl) statusEl.textContent = "Thinking...";
  statusEl?.classList.add("loading");

  // show user message in chat
  appendChatMessage("user", `Task: ${taskType}\nLanguage: ${language || 'Not specified'}\n\n${code}`);

  try {
    const res = await fetch("/api/code-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskType,
        language,
        targetLanguage,
        extra,
        code,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      const msg = data.message || "AI is unable to process this code. Thoda check karke dubara try karo.";
      appendChatMessage("ai", `Error: ${msg}`);
      if (statusEl) statusEl.textContent = "Error";
      return;
    }

    appendChatMessage("ai", data.result);
    if (statusEl) statusEl.textContent = "Done";
    
  } catch (err) {
    console.error("API Error:", err);
    appendChatMessage("ai", "Kuch error aa gaya server ya network me. Thodi der baad try karo.\nError: " + err.message);
    if (statusEl) statusEl.textContent = "Error";
  } finally {
    // Re-enable button
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Run with AI</span><span class="btn-kbd">Ctrl + Enter</span>';
    statusEl?.classList.remove("loading");
  }
}

// Button click
submitBtn.addEventListener("click", runAi);

// -----------------------------------------------------
// Keyboard shortcuts
// -----------------------------------------------------
document.addEventListener("keydown", function (e) {
  // SHIFT + ENTER → allow new line in editor
  if (e.shiftKey && e.key === "Enter") {
    return;
  }

  // CTRL/CMD + ENTER → run AI
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click();
    }
  }

  // ESC → clear editor (when editor is focused)
  if (e.key === "Escape") {
    if (codeEditor && codeEditor.hasFocus()) {
      if (confirm("Kya tum code editor clear karna chahte ho?")) {
        codeEditor.setValue("");
      }
    }
  }
});

// -----------------------------------------------------
// User Authentication Logic
// -----------------------------------------------------
function initUserAuth() {
  const authLinks = document.getElementById("authLinks");
  const userBox = document.getElementById("userBox");
  const userNameLabel = document.getElementById("userNameLabel");
  const logoutBtn = document.getElementById("logoutBtn");

  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);

      // User name/email dikhana
      if (userNameLabel) {
        userNameLabel.textContent = `Hi, ${user.name || user.email || "User"}`;
      }

      // Login/Signup hide, user box show
      if (authLinks) authLinks.style.display = "none";
      if (userBox) userBox.style.display = "inline-flex";
    } else {
      // Koi user nahi → auth buttons show
      if (authLinks) authLinks.style.display = "flex";
      if (userBox) userBox.style.display = "none";
    }
  } catch (err) {
    console.error("Error reading user from localStorage:", err);
  }

  // Logout click
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Kya tum logout karna chahte ho?")) {
        localStorage.removeItem("user");
        window.location.href = "login.html";
      }
    });
  }
}

// -----------------------------------------------------
// Copy to clipboard functionality
// -----------------------------------------------------
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show temporary success message
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Copied! ✅</span>';
    setTimeout(() => {
      submitBtn.innerHTML = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Copy failed:', err);
  });
}

// Add copy button to AI responses
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('chat-text')) {
    const text = e.target.textContent;
    copyToClipboard(text);
  }
});

// -----------------------------------------------------
// Auto-resize and other utilities
// -----------------------------------------------------
function autoResizeEditor() {
  if (codeEditor) {
    codeEditor.refresh();
  }
}

// Refresh editor on window resize
window.addEventListener('resize', autoResizeEditor);

// Initialize auto-resize
setTimeout(autoResizeEditor, 100);

// -----------------------------------------------------
// Language detection for CodeMirror
// -----------------------------------------------------
languageInput.addEventListener('input', function() {
  if (codeEditor) {
    const lang = languageInput.value.toLowerCase();
    let mode = 'javascript';
    
    if (lang.includes('python')) mode = 'python';
    else if (lang.includes('java')) mode = 'text/x-java';
    else if (lang.includes('c++') || lang.includes('cpp')) mode = 'text/x-c++src';
    else if (lang.includes('c#')) mode = 'text/x-csharp';
    else if (lang.includes('php')) mode = 'php';
    else if (lang.includes('html')) mode = 'htmlmixed';
    else if (lang.includes('css')) mode = 'css';
    else if (lang.includes('sql')) mode = 'sql';
    
    codeEditor.setOption('mode', mode);
  }
});

console.log("🚀 AI Code Helper initialized successfully!");
console.log("✨ Features: Theme switching, Code syntax highlighting, AI integration");
console.log("🎯 Shortcuts: Ctrl+Enter (Run AI), Esc (Clear editor)");