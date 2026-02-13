// --------------------------------------------------------------
// FULL BACKEND WITH LOGIN + SIGNUP + GEMINI FLASH 2.0
// --------------------------------------------------------------

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const bcrypt = require("bcryptjs");

// App setup
const app = express();
const PORT = process.env.PORT || 5000;

// --------------------------------------------------------------
// LOAD USERS JSON (TEMPORARY DATABASE)
// --------------------------------------------------------------
let users = [];

if (fs.existsSync("users.json")) {
  users = JSON.parse(fs.readFileSync("users.json", "utf8"));
}

// --------------------------------------------------------------
// MIDDLEWARES (VERY IMPORTANT - ALWAYS BEFORE ROUTES)
// --------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static("public"));

// --------------------------------------------------------------
// AUTH ROUTES (LOGIN + SIGNUP)
// --------------------------------------------------------------
app.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (users.find(u => u.email === email)) {
    return res.json({ success: false, message: "Email already exists!" });
  }

  const hashed = await bcrypt.hash(password, 10);

  const newUser = { id: Date.now(), name, email, password: hashed };
  users.push(newUser);

  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

  res.json({ success: true, message: "Account created successfully!" });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.json({ success: false, message: "Invalid email!" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.json({ success: false, message: "Incorrect password!" });
  }

  res.json({
    success: true,
    message: "Login successful!",
    user: { id: user.id, name: user.name, email: user.email }
  });
});

// --------------------------------------------------------------
// GEMINI FLASH 2.0 SETUP
// --------------------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --------------------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "AI Code Helper backend running",
    time: new Date().toISOString(),
  });
});

// --------------------------------------------------------------
// TEST CRUD API (OPTIONAL)
// --------------------------------------------------------------
let items = [
  { id: 1, name: "First item", completed: false },
  { id: 2, name: "Second item", completed: true }
];
let nextId = 3;

app.get("/api/items", (req, res) => {
  res.json({ success: true, count: items.length, data: items });
});

app.post("/api/items", (req, res) => {
  const { name, completed } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "Name required" });

  const newItem = { id: nextId++, name, completed: completed ?? false };
  items.push(newItem);

  res.status(201).json({ success: true, data: newItem });
});

app.put("/api/items/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const { name, completed } = req.body;

  const index = items.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "Item not found" });

  items[index] = {
    ...items[index],
    name: name ?? items[index].name,
    completed: typeof completed === "boolean" ? completed : items[index].completed,
  };

  res.json({ success: true, data: items[index] });
});

app.delete("/api/items/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = items.findIndex(i => i.id === id);

  if (index === -1) return res.status(404).json({ success: false, message: "Item not found" });

  const deleted = items[index];
  items.splice(index, 1);

  res.json({ success: true, message: "Deleted", data: deleted });
});

// --------------------------------------------------------------
// ⭐ AI CODE HELPER (GEMINI FLASH 2.0) ⭐
// --------------------------------------------------------------
app.post("/api/code-helper", async (req, res) => {
  try {
    const { taskType, code, language, targetLanguage, extra } = req.body;

    if (!code || !taskType)
      return res.status(400).json({
        success: false,
        message: "Fields 'taskType' and 'code' are required"
      });

    // Build dynamic AI prompt
    let prompt = "";

    if (taskType === "explain") {
      prompt = `
Explain this ${language || ""} code in simple language.
Break it step-by-step:

${code}

Extra: ${extra || "None"}
`;
    } else if (taskType === "fix") {
      prompt = `
Find bugs in this ${language || ""} code.
Explain mistakes and give a corrected version:

${code}
`;
    } else if (taskType === "convert") {
      prompt = `
Convert this code from ${language || ""} to ${targetLanguage || ""}.
Preserve logic and optimize:

${code}
`;
    } else if (taskType === "document") {
      prompt = `
Write documentation for this ${language || ""} code.
Include:
- Purpose
- Flow summary
- Function explanations
- Inputs & outputs
- Example usage

${code}
`;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid task type"
      });
    }

    // Call Gemini Flash 2.0
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash"
    });

    const aiResponse = await model.generateContent(prompt);
    const aiText = aiResponse.response.text();

    return res.json({
      success: true,
      taskType,
      result: aiText,
    });

  } catch (err) {
    console.error("Gemini Error:", err);
    return res.status(500).json({
      success: false,
      message: "Gemini Flash 2.0 API Error",
      error: err.message
    });
  }
});

// --------------------------------------------------------------
// 404 ROUTE
// --------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// --------------------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("Unexpected error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message
  });
});

// --------------------------------------------------------------
// START SERVER
// --------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});