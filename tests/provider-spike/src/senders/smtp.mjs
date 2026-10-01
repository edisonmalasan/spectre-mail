/**
 * Minimal dependency-free SMTP sender used only by the M0 spike.
 *
 * It exists so the spike can prove real external delivery when the maintainer
 * supplies a credential. It is NOT a mail client: no retry queue, no
 * connection pooling, no policy beyond Node's TLS defaults. It must never be
 * reused by product code.
 *
 * Credentials come from the environment and are never written anywhere.
 */

import net from "node:net";
import tls from "node:tls";

import { describeError } from "../probe-runner.mjs";

/** Line-oriented SMTP conversation over a socket. */
class SmtpSession {
  #socket;
  #buffer = "";
  #waiter = null;
  #failure = null;

  constructor(socket) {
    this.#socket = socket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => this.#consume(chunk));
    socket.on("error", (error) => this.#fail(error));
    socket.on("close", () => this.#fail(new Error("SMTP connection closed")));
  }

  #consume(chunk) {
    this.#buffer += chunk;
    const lines = [];
    let consumedChars = 0;
    for (;;) {
      const newline = this.#buffer.indexOf("\n", consumedChars);
      if (newline === -1) break;
      const line = this.#buffer.slice(consumedChars, newline).replace(/\r$/, "");
      lines.push(line);
      consumedChars = newline + 1;
      // A hyphen in the fourth column means more lines follow.
      if (line.length >= 4 && line[3] !== "-") break;
      if (line.length < 4) break;
    }
    if (lines.length === 0) return;
    this.#buffer = this.#buffer.slice(consumedChars);
    const response = lines.join("\n");
    if (this.#waiter) {
      const waiter = this.#waiter;
      this.#waiter = null;
      waiter.resolve(response);
    }
  }

  #fail(error) {
    this.#failure = error;
    if (this.#waiter) {
      const waiter = this.#waiter;
      this.#waiter = null;
      waiter.reject(error);
    }
  }

  write(line) {
    this.#socket.write(`${line}\r\n`);
  }

  read() {
    if (this.#failure) return Promise.reject(this.#failure);
    return new Promise((resolve, reject) => {
      this.#waiter = { resolve, reject };
    });
  }

  /** Send a command and assert the response code. */
  async command(line, expectedCodes, label) {
    this.write(line);
    return this.expect(expectedCodes, label);
  }

  async expect(expectedCodes, label) {
    const response = await this.read();
    const code = response.slice(0, 3);
    if (!expectedCodes.includes(code)) {
      throw new Error(`${label}: expected ${expectedCodes.join("/")}, got "${response}"`);
    }
    return response;
  }

  /** Issue STARTTLS and return a new session over the encrypted socket. */
  upgrade(host) {
    return new Promise((resolve, reject) => {
      const secureSocket = tls.connect(
        { socket: this.#socket, servername: host },
        () => resolve(new SmtpSession(secureSocket)),
      );
      secureSocket.once("error", reject);
    });
  }

  close() {
    try {
      this.#socket.destroy();
    } catch {
      /* already destroyed */
    }
  }
}

export async function sendViaSmtp(config, message) {
  const secure = Boolean(config.secure);
  const socket = secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });

  await new Promise((resolve, reject) => {
    socket.once(secure ? "secureConnect" : "connect", resolve);
    socket.once("error", reject);
  });

  let session = new SmtpSession(socket);
  try {
    await session.expect(["220"], "greeting");

    let capabilities = await session.command("EHLO spike.invalid", ["250"], "EHLO");

    if (!secure && capabilities.includes("STARTTLS")) {
      await session.command("STARTTLS", ["220"], "STARTTLS");
      session = await session.upgrade(config.host);
      capabilities = await session.command("EHLO spike.invalid", ["250"], "EHLO after STARTTLS");
    }

    if (config.user) {
      await session.command("AUTH LOGIN", ["334"], "AUTH LOGIN");
      await session.command(
        Buffer.from(config.user).toString("base64"),
        ["334"],
        "AUTH username",
      );
      await session.command(
        Buffer.from(config.pass ?? "").toString("base64"),
        ["235"],
        "AUTH password",
      );
    }

    await session.command(`MAIL FROM:<${message.from}>`, ["250"], "MAIL FROM");
    await session.command(`RCPT TO:<${message.to}>`, ["250", "251"], "RCPT TO");
    await session.command("DATA", ["354"], "DATA");

    const body = [
      `From: ${message.from}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      `Message-ID: <${Date.now().toString(36)}.spike@spectre.invalid>`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "",
      message.text,
    ].join("\r\n");

    // Dot-stuffing per RFC 5321 4.5.2, then the terminating sequence.
    const escaped = body.replace(/\r?\n\./g, "\r\n..");
    session.write(`${escaped}\r\n.`);
    await session.expect(["250"], "message body");

    session.write("QUIT");
    await session.read().catch(() => null);
    return { accepted: true };
  } catch (error) {
    throw new Error(describeError(error));
  } finally {
    session.close();
  }
}
