import { spawn, exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  status: "success" | "runtime_error" | "compile_error" | "timed_out";
  mode: "docker" | "local_isolated";
}

const TIMEOUT_MS = 5000;

export async function executeCode(
  language: string,
  code: string,
  stdinInput: string = ""
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const runId = "run_" + Math.random().toString(36).substring(2, 9);
  const tempDir = path.join(os.tmpdir(), "collab_exec", runId);

  fs.mkdirSync(tempDir, { recursive: true });

  let fileName = "main.js";
  if (language === "python") fileName = "main.py";
  if (language === "cpp") fileName = "main.cpp";

  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, code, "utf8");

  try {
    // Check if Docker is actually running and available
    const hasDocker = await checkDocker();
    if (hasDocker) {
      try {
        return await runInDocker(language, tempDir, fileName, startTime, stdinInput, code);
      } catch (dockerErr) {
        console.warn("[DOCKER] Docker execution failed, falling back to local isolated:", dockerErr);
        return await runLocallyIsolated(language, tempDir, fileName, startTime, stdinInput, code);
      }
    } else {
      return await runLocallyIsolated(language, tempDir, fileName, startTime, stdinInput, code);
    }
  } finally {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

function checkDocker(): Promise<boolean> {
  return new Promise((resolve) => {
    // Use 'docker info' to verify the daemon is actually responsive, not just the CLI
    exec("docker info", { timeout: 1500 }, (err) => resolve(!err));
  });
}

function runInDocker(
  language: string,
  tempDir: string,
  fileName: string,
  startTime: number,
  stdinInput: string,
  code: string
): Promise<ExecutionResult> {
  const imageMap: Record<string, string> = {
    javascript: "sandbox-node",
    python: "sandbox-python",
    cpp: "sandbox-cpp",
  };

  const image = imageMap[language] || "sandbox-node";
  const dockerArgs = [
    "run",
    "-i",
    "--rm",
    "--network", "none",
    "--memory", "128m",
    "--cpus", "0.5",
    "--pids-limit", "64",
    "-v", `${tempDir}:/sandbox:ro`,
    image,
  ];

  return spawnProcess("docker", dockerArgs, tempDir, startTime, "docker", stdinInput, tempDir, fileName, language, code);
}

function runLocallyIsolated(
  language: string,
  tempDir: string,
  fileName: string,
  startTime: number,
  stdinInput: string,
  code: string
): Promise<ExecutionResult> {
  if (language === "javascript") {
    return spawnProcess("node", [fileName], tempDir, startTime, "local_isolated", stdinInput, tempDir, fileName, language, code);
  } else if (language === "python") {
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    return spawnProcess(pythonCmd, [fileName], tempDir, startTime, "local_isolated", stdinInput, tempDir, fileName, language, code);
  } else if (language === "cpp") {
    // Compile then run
    const exeName = process.platform === "win32" ? "main.exe" : "./main";
    const exePath = path.join(tempDir, process.platform === "win32" ? "main.exe" : "main");
    return new Promise((resolve) => {
      exec(`g++ -O2 -o "${exePath}" "${fileName}"`, { cwd: tempDir, timeout: TIMEOUT_MS }, (compileErr, _, compileStderr) => {
        if (compileErr) {
          const cleanedStderr = sanitizeErrorOutput(
            compileStderr || compileErr.message,
            tempDir,
            fileName,
            language,
            code
          );
          return resolve({
            stdout: "",
            stderr: cleanedStderr,
            exitCode: compileErr.code || 1,
            durationMs: Date.now() - startTime,
            status: "compile_error",
            mode: "local_isolated",
          });
        }
        spawnProcess(exeName, [], tempDir, startTime, "local_isolated", stdinInput, tempDir, fileName, language, code).then(resolve);
      });
    });
  }

  throw new Error(`Unsupported language: ${language}`);
}

function spawnProcess(
  cmd: string,
  args: string[],
  cwd: string,
  startTime: number,
  mode: "docker" | "local_isolated",
  stdinInput: string = "",
  tempDir: string = "",
  fileName: string = "",
  language: string = "",
  code: string = ""
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let isTimedOut = false;

    const child = spawn(cmd, args, {
      cwd,
      shell: false,
    });

    if (stdinInput && child.stdin) {
      try {
        child.stdin.write(stdinInput);
        child.stdin.end();
      } catch (_) {}
    } else if (child.stdin) {
      try {
        child.stdin.end();
      } catch (_) {}
    }

    const timer = setTimeout(() => {
      isTimedOut = true;
      try {
        child.kill("SIGKILL");
      } catch (_) {}
    }, TIMEOUT_MS);

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      const rawError = stderr || `${cmd} execution error: ${err.message}`;
      const cleanedStderr = sanitizeErrorOutput(rawError, tempDir, fileName, language, code);
      resolve({
        stdout,
        stderr: cleanedStderr,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        status: "runtime_error",
        mode,
      });
    });

    child.on("close", (codeResult) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (isTimedOut) {
        return resolve({
          stdout,
          stderr: (stderr ? sanitizeErrorOutput(stderr, tempDir, fileName, language, code) + "\n" : "") +
            `[Execution timed out after ${TIMEOUT_MS / 1000}s limit]`,
          exitCode: null,
          durationMs,
          status: "timed_out",
          mode,
        });
      }

      const status = codeResult === 0 ? "success" : "runtime_error";
      const cleanedStderr = sanitizeErrorOutput(stderr, tempDir, fileName, language, code);
      resolve({
        stdout,
        stderr: cleanedStderr,
        exitCode: codeResult,
        durationMs,
        status,
        mode,
      });
    });
  });
}

function sanitizeErrorOutput(
  rawStderr: string,
  tempDir: string,
  fileName: string,
  language: string,
  code: string
): string {
  if (!rawStderr) return "";

  let cleaned = rawStderr;

  // 1. Strip raw temp directory paths (Windows backslashes, forward slashes, 8.3 dos names)
  if (tempDir) {
    const escaped = tempDir.replace(/\\/g, "\\\\");
    cleaned = cleaned.replace(new RegExp(escaped, "gi"), "");
  }

  // Strip generic temp patterns like C:\Users\...\run_xxxx\ or /tmp/collab_exec/.../
  cleaned = cleaned.replace(/[a-zA-Z]:\\[^\\/:*?"<>|\r\n]+\\collab_exec\\[^\\]+\\/gi, "");
  cleaned = cleaned.replace(/\/tmp\/collab_exec\/[^/]+\//gi, "");
  cleaned = cleaned.replace(/\/sandbox\//gi, "");

  // Clean leading backslashes or slashes before the file name
  if (fileName) {
    cleaned = cleaned.replace(new RegExp(`\\\\${fileName}`, "g"), fileName);
    cleaned = cleaned.replace(new RegExp(`/${fileName}`, "g"), fileName);
  }

  cleaned = cleaned.trim();

  // 2. Intelligent Language Runtime Mismatch Detection
  const isPython = language === "python";
  const isJS = language === "javascript";
  const isCPP = language === "cpp";

  if (isPython) {
    const hasJsPatterns =
      /^\s*\/\//m.test(code) ||
      /\bconsole\.log\s*\(/.test(code) ||
      /\bfunction\s+[a-zA-Z0-9_$]+\s*\(/.test(code) ||
      /\bconst\s+[a-zA-Z0-9_$]+\s*=/.test(code) ||
      /\blet\s+[a-zA-Z0-9_$]+\s*=/.test(code);

    if (hasJsPatterns && (cleaned.includes("SyntaxError") || cleaned.includes("NameError"))) {
      cleaned += `\n\n💡 Hint: The selected runtime is Python 3, but the code appears to be JavaScript.\nSwitch the language runtime to JavaScript (Node.js) in the top toolbar to execute this code.`;
    }
  } else if (isJS) {
    const hasPyPatterns =
      /^\s*def\s+[a-zA-Z0-9_]+\s*\(/.test(code) ||
      /\bprint\s*\(/.test(code) ||
      /^\s*import\s+[a-zA-Z0-9_]+/m.test(code) ||
      /^\s*from\s+[a-zA-Z0-9_]+\s+import/m.test(code);

    if (hasPyPatterns && (cleaned.includes("SyntaxError") || cleaned.includes("ReferenceError"))) {
      cleaned += `\n\n💡 Hint: The selected runtime is JavaScript, but the code appears to be Python.\nSwitch the language runtime to Python 3 in the top toolbar to execute this code.`;
    }
  } else if (isCPP) {
    const hasScriptPatterns =
      /\bconsole\.log\s*\(/.test(code) ||
      /^\s*def\s+[a-zA-Z0-9_]+\s*\(/.test(code);

    if (hasScriptPatterns && cleaned.includes("error:")) {
      cleaned += `\n\n💡 Hint: The selected runtime is C++ (GCC), but the code appears to be JavaScript or Python.\nSwitch the language runtime in the top toolbar to match your code.`;
    }
  }

  return cleaned;
}

export interface EvalTestCaseInput {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  points?: number;
}

export interface EvalTestCaseResult {
  testCaseId: string;
  index: number;
  passed: boolean;
  isHidden: boolean;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  error?: string;
  durationMs: number;
}

export interface AutomatedEvaluationResult {
  compilationStatus: "Successful" | "Compilation Error";
  compileError?: string;
  passedCount: number;
  totalCount: number;
  score: number;
  executionTimeSec: number;
  testResults: EvalTestCaseResult[];
}

/**
 * Module 5: Automated Code Evaluation against predefined test cases.
 * Compiles once for compiled languages (C++), then runs each test case in isolation.
 */
export async function evaluateTestCases(
  language: string,
  code: string,
  testCases: EvalTestCaseInput[]
): Promise<AutomatedEvaluationResult> {
  const runId = "eval_" + Math.random().toString(36).substring(2, 9);
  const tempDir = path.join(os.tmpdir(), "collab_exec", runId);
  fs.mkdirSync(tempDir, { recursive: true });

  let fileName = "main.js";
  if (language === "python") fileName = "main.py";
  if (language === "cpp") fileName = "main.cpp";

  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, code, "utf8");

  const normalizeOut = (s: string) => s.replace(/\r\n/g, "\n").trim();

  try {
    const useDocker = await checkDocker();
    let exeName = "";
    if (language === "cpp" && !useDocker) {
      exeName = process.platform === "win32" ? "main.exe" : "./main";
      const exePath = path.join(tempDir, process.platform === "win32" ? "main.exe" : "main");

      const compileRes = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        exec(`g++ -O2 -o "${exePath}" "${fileName}"`, { cwd: tempDir, timeout: TIMEOUT_MS }, (err, _, stderr) => {
          if (err) {
            resolve({
              ok: false,
              error: sanitizeErrorOutput(stderr || err.message, tempDir, fileName, language, code),
            });
          } else {
            resolve({ ok: true });
          }
        });
      });

      if (!compileRes.ok) {
        return {
          compilationStatus: "Compilation Error",
          compileError: compileRes.error,
          passedCount: 0,
          totalCount: testCases.length,
          score: 0,
          executionTimeSec: 0,
          testResults: testCases.map((tc, idx) => ({
            testCaseId: tc.id,
            index: idx + 1,
            passed: false,
            isHidden: Boolean(tc.isHidden),
            input: tc.isHidden ? undefined : tc.input,
            expectedOutput: tc.isHidden ? undefined : tc.expectedOutput,
            error: "Compilation Error",
            durationMs: 0,
          })),
        };
      }
    }

    const results: EvalTestCaseResult[] = [];
    let totalDurationMs = 0;
    let passedCount = 0;
    let earnedPoints = 0;
    let totalPoints = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const pts = tc.points || 10;
      totalPoints += pts;

      const tcStart = Date.now();
      let execRes: ExecutionResult;

      if (useDocker) {
        execRes = await runInDocker(language, tempDir, fileName, tcStart, tc.input, code);
      } else if (language === "javascript") {
        execRes = await spawnProcess("node", [fileName], tempDir, tcStart, "local_isolated", tc.input, tempDir, fileName, language, code);
      } else if (language === "python") {
        const pythonCmd = process.platform === "win32" ? "python" : "python3";
        execRes = await spawnProcess(pythonCmd, [fileName], tempDir, tcStart, "local_isolated", tc.input, tempDir, fileName, language, code);
      } else if (language === "cpp") {
        execRes = await spawnProcess(exeName, [], tempDir, tcStart, "local_isolated", tc.input, tempDir, fileName, language, code);
      } else {
        throw new Error(`Unsupported language: ${language}`);
      }

      totalDurationMs += execRes.durationMs;

      // Check syntax/compile error in interpreted languages on first failure
      if (
        i === 0 &&
        execRes.status === "runtime_error" &&
        execRes.stderr.includes("SyntaxError")
      ) {
        return {
          compilationStatus: "Compilation Error",
          compileError: execRes.stderr,
          passedCount: 0,
          totalCount: testCases.length,
          score: 0,
          executionTimeSec: Number((totalDurationMs / 1000).toFixed(2)),
          testResults: testCases.map((t, idx) => ({
            testCaseId: t.id,
            index: idx + 1,
            passed: false,
            isHidden: Boolean(t.isHidden),
            error: idx === 0 ? execRes.stderr : "Compilation/Syntax Error",
            durationMs: idx === 0 ? execRes.durationMs : 0,
          })),
        };
      }

      const actual = normalizeOut(execRes.stdout);
      const expected = normalizeOut(tc.expectedOutput);
      const passed = execRes.status === "success" && actual === expected;

      if (passed) {
        passedCount++;
        earnedPoints += pts;
      }

      results.push({
        testCaseId: tc.id,
        index: i + 1,
        passed,
        isHidden: Boolean(tc.isHidden),
        input: tc.isHidden ? undefined : tc.input,
        expectedOutput: tc.isHidden ? undefined : expected,
        actualOutput: tc.isHidden ? undefined : actual,
        error: execRes.status !== "success" ? execRes.stderr || execRes.status : undefined,
        durationMs: execRes.durationMs,
      });
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const executionTimeSec = Number((totalDurationMs / 1000).toFixed(2));

    return {
      compilationStatus: "Successful",
      passedCount,
      totalCount: testCases.length,
      score,
      executionTimeSec,
      testResults: results,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}
