if (typeof globalThis.__dirname === "undefined") {
  globalThis.__dirname = "/";
}
if (typeof globalThis.__filename === "undefined") {
  globalThis.__filename = "/worker.js";
}

import nodeCrypto from "node:crypto";
import bcrypt from "bcryptjs";

if (typeof bcrypt.setRandomFallback === "function") {
  bcrypt.setRandomFallback((len) => {
    return Array.from(nodeCrypto.randomBytes(len));
  });
}

import { createServer } from "node:http";
import { httpServerHandler } from "cloudflare:node";
import app from "./server.js";

const server = createServer(app);
server.listen(8080);

export default httpServerHandler({ port: 8080 });
