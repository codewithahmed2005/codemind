// --------------------------------------------------------------
// FULL BACKEND WITH LOGIN + SIGNUP + GROQ AI
// --------------------------------------------------------------

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const axios = require("axios");

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY missing in .env file");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// --------------------------------------------------------------
// LOAD USERS JSON
// --------------------------------------------------------------
let users = [];

if (fs.existsSync("users.json")) {
  users = JSON.parse(fs.readFileSync("users.json", "utf8"));
}

// --------------------------------------------------------------
// MIDDLEWARES
// --------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// --------------------------------------------------------------
// AUTH ROUTES
// --------------------------------------------------------------
app.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.json({ success: false, message: "All fields required" });
  }

  if (users.find(u => u.email === email)) {
    return res.json({ success: false, message: "Email already exists!" });
  }

  const hashed = await bcrypt.hash(password, 10);

  const newUser = {
    id: Date.now(),
    name,
    email,
    password: hashed
  };

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
// HEALTH CHECK
// --------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString()
  });
});

// --------------------------------------------------------------
// AI CODE HELPER (Groq - LLaMA 3)
// --------------------------------------------------------------
app.post("/api/code-helper", async (req, res) => {
  try {
    const { taskType, code, language, targetLanguage } = req.body;

    if (!taskType || !code) {
      return res.status(400).json({
        success: false,
        message: "taskType and code required"
      });
    }

    let prompt = "";

    if (taskType === "explain") {
      prompt = `Explain this ${language || ""} code clearly:\n\n${code}`;
    }
    else if (taskType === "fix") {
      prompt = `Fix errors in this ${language || ""} code and return corrected code:\n\n${code}`;
    }
    else if (taskType === "convert") {
      prompt = `Convert this ${language || ""} code to ${targetLanguage || ""}:\n\n${code}`;
    }
    else if (taskType === "document") {
      prompt = `Write documentation for this ${language || ""} code:\n\n${code}`;
    }
    else {
      return res.status(400).json({
        success: false,
        message: "Invalid task type"
      });
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
       model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a fast and precise coding assistant." },
          { role: "user", content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.3
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    if (!response.data.choices || !response.data.choices.length) {
      throw new Error("Invalid model response");
    }

    const aiText = response.data.choices[0].message?.content || "No response";

    res.json({
      success: true,
      taskType,
      result: aiText
    });

  } catch (err) {
    console.error("Groq Error:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "Groq API Error",
      error: err.response?.data || err.message
    });
  }
});

// --------------------------------------------------------------
// 404
// --------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// --------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
