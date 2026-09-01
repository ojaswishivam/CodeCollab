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
        return await runInDocker(language, tempDir, fileName, startTime, stdinInput);
      } catch (dockerErr) {
        console.warn("[DOCKER] Docker execution failed, falling back to local isolated:", dockerErr);
        return await runLocallyIsolated(language, tempDir, filePath, startTime, stdinInput);
      }
    } else {
      return await runLocallyIsolated(language, tempDir, filePath, startTime, stdinInput);
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
  stdinInput: string
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

  return spawnProcess("docker", dockerArgs, tempDir, startTime, "docker", stdinInput);
}

function runLocallyIsolated(
  language: string,
  tempDir: string,
  filePath: string,
  startTime: number,
  stdinInput: string
): Promise<ExecutionResult> {
  if (language === "javascript") {
    return spawnProcess("node", [filePath], tempDir, startTime, "local_isolated", stdinInput);
  } else if (language === "python") {
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    return spawnProcess(pythonCmd, [filePath], tempDir, startTime, "local_isolated", stdinInput);
  } else if (language === "cpp") {
    // Compile then run
    const exePath = path.join(tempDir, process.platform === "win32" ? "main.exe" : "main");
    return new Promise((resolve) => {
      exec(`g++ -O2 -o "${exePath}" "${filePath}"`, { timeout: TIMEOUT_MS }, (compileErr, _, compileStderr) => {
        if (compileErr) {
          return resolve({
            stdout: "",
            stderr: compileStderr || compileErr.message,
            exitCode: compileErr.code || 1,
            durationMs: Date.now() - startTime,
            status: "compile_error",
            mode: "local_isolated",
          });
        }
        spawnProcess(exePath, [], tempDir, startTime, "local_isolated", stdinInput).then(resolve);
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
  stdinInput: string = ""
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
      resolve({
        stdout,
        stderr: stderr || `${cmd} execution error: ${err.message}`,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        status: "runtime_error",
        mode,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (isTimedOut) {
        return resolve({
          stdout,
          stderr: stderr + `\n[Execution timed out after ${TIMEOUT_MS / 1000}s limit]`,
          exitCode: null,
          durationMs,
          status: "timed_out",
          mode,
        });
      }

      const status = code === 0 ? "success" : "runtime_error";
      resolve({
        stdout,
        stderr,
        exitCode: code,
        durationMs,
        status,
        mode,
      });
    });
  });
}
