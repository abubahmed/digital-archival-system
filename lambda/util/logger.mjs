import pino from "pino";
import path from "path";
import fs from "fs";

// Create a basic logger that writes to both console and file
const logStream = fs.createWriteStream(path.join(process.cwd(), 'archive.log'), { flags: 'a' });

const log = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
}, pino.multistream([
  { stream: process.stdout },
  { stream: logStream }
]));

export default log;
