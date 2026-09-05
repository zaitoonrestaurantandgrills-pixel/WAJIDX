import { createServer } from "node:http";
import { httpServerHandler } from "cloudflare:node";
import app from "./server.js";

const server = createServer(app);
server.listen(8080);

export default httpServerHandler({ port: 8080 });
