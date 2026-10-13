#!/usr/bin/env node
/**
 * Start both servers with colored output in one terminal.
 * Usage: npm run start:all
 */
const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const AI_DIR = path.join(ROOT, "ai_service");
const PYTHON = path.join(ROOT, "ai_service", "venv312", "Scripts", "python.exe");

const BLUE  = "\x1b[34m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

function prefix(color, label, line) {
  return `${color}[${label}]${RESET} ${line}`;
}

function startProcess(label, color, cmd, args, cwd) {
  const proc = spawn(cmd, args, { cwd, shell: false });

  proc.stdout.on("data", (d) =>
    d.toString().split("\n").filter(Boolean).forEach((l) =>
      process.stdout.write(prefix(color, label, l) + "\n")
    )
  );
  proc.stderr.on("data", (d) =>
    d.toString().split("\n").filter(Boolean).forEach((l) =>
      process.stderr.write(prefix(color, label, l) + "\n")
    )
  );
  proc.on("exit", (code) => {
    console.log(prefix(color, label, `exited with code ${code}`));
    process.exit(code || 0);
  });

  return proc;
}

console.log(`${GREEN}Starting MedXplain...${RESET}`);
console.log(`${BLUE}[WEB]${RESET} http://localhost:3000`);
console.log(`${GREEN}[AI]${RESET}  http://localhost:8000`);
console.log(`${GREEN}[AI]${RESET}  http://localhost:8000/docs\n`);

// Start Next.js
startProcess("WEB", BLUE,
  process.execPath,
  [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "dev"],
  ROOT
);

// Start AI service
startProcess("AI", GREEN,
  PYTHON,
  ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
  AI_DIR
);
