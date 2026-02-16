import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs", "api");
const DEFAULT_SWAGGER_PORT = 55027;
const SHUTDOWN_TIMEOUT_MS = 5000;

if (!existsSync(DOCS_DIR)) {
  console.error(`[dev:all] Missing docs folder: ${DOCS_DIR}`);
  process.exit(1);
}

function isValidPort(port) {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    try {
      server.listen(port, "127.0.0.1");
    } catch {
      resolve(false);
    }
  });
}

function findEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve ephemeral port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function resolveSwaggerPort() {
  const envPort = process.env.SWAGGER_PORT
    ? Number.parseInt(process.env.SWAGGER_PORT, 10)
    : undefined;

  if (envPort !== undefined) {
    if (!isValidPort(envPort)) {
      throw new Error(`SWAGGER_PORT must be in range 1..65535, got: ${process.env.SWAGGER_PORT}`);
    }
    return envPort;
  }

  try {
    if (await canListen(DEFAULT_SWAGGER_PORT)) {
      return DEFAULT_SWAGGER_PORT;
    }

    return await findEphemeralPort();
  } catch (error) {
    console.warn(
      `[dev:all] Port probing failed (${error?.message ?? "unknown"}). Falling back to ${DEFAULT_SWAGGER_PORT}.`
    );
    return DEFAULT_SWAGGER_PORT;
  }
}

const children = [];
let shuttingDown = false;
let exitCode = 0;

function stopChild(child, signal) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Ignore kill errors for already-exited processes.
    }
  }
}

function shutdown(nextExitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  exitCode = nextExitCode;

  for (const { child } of children) {
    stopChild(child, "SIGTERM");
  }

  setTimeout(() => {
    for (const { child } of children) {
      stopChild(child, "SIGKILL");
    }
    process.exit(exitCode);
  }, SHUTDOWN_TIMEOUT_MS);
}

function startProcess(name, command, args) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    detached: true,
  });

  children.push({ name, child });

  child.on("error", (error) => {
    console.error(`[dev:all] ${name} failed to start:`, error.message);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[dev:all] ${name} exited (${reason}). Stopping other services.`);
    shutdown(typeof code === "number" ? code : 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const swaggerPort = await resolveSwaggerPort();

console.log(`[dev:all] Starting services from ${ROOT}`);
console.log(`[dev:all] Swagger UI: http://127.0.0.1:${swaggerPort}/`);

startProcess("landing", "npm", ["run", "dev:landing"]);
startProcess("app", "npm", ["run", "dev:app"]);
startProcess("swagger", "python3", [
  "-m",
  "http.server",
  String(swaggerPort),
  "--bind",
  "127.0.0.1",
  "--directory",
  DOCS_DIR,
]);
