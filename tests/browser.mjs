import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export async function startBrowser() {
  const directory = mkdtempSync(join(tmpdir(), "homestead-browser-"));
  const executable = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const child = spawn(executable, [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${directory}`,
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--disable-component-update", "--disable-sync", "--disable-extensions", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let output = "";
  let launchError;
  child.on("error", (error) => { launchError = error; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  let socket;
  const pending = new Map();
  let nextId = 0;

  async function close() {
    socket?.close();
    if (child.exitCode === null && child.pid) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  }

  try {
    await waitFor(() => {
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw new Error(`Chrome exited: ${output}`);
      return output.includes("DevTools listening on ");
    });
    const endpoint = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
    const origin = new URL(endpoint);
    const targets = await (await fetch(`http://${origin.host}/json/list`)).json();
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("Chrome did not create a test page.");
    socket = new WebSocket(page.webSocketDebuggerUrl);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    });
    await once(socket, "open");

    function command(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Browser command timed out: ${method}`));
        }, 15_000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }

    async function navigate(url) {
      await command("Page.navigate", { url });
      await waitFor(() => evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === "complete"`));
    }

    return { command, evaluate, navigate, close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function waitFor(check, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error("Timed out waiting for the expected browser state.");
}
