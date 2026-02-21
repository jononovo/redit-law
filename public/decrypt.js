#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");

const [,, keyHex, ivHex, tagHex, filePath] = process.argv;

if (!keyHex || !ivHex || !tagHex || !filePath) {
  console.error("Usage: node decrypt.js <key_hex> <iv_hex> <tag_hex> <encrypted_file.md>");
  process.exit(1);
}

const raw = fs.readFileSync(filePath, "utf8");
const match = raw.match(/```([\s\S]+?)```/);
if (!match) {
  console.error("Error: No fenced code block found in file.");
  process.exit(1);
}

const b64 = match[1].trim();
const data = Buffer.from(b64, "base64");

const tag = Buffer.from(tagHex, "hex");
const ciphertext = data.slice(0, data.length - 16);

const decipher = crypto.createDecipheriv(
  "aes-256-gcm",
  Buffer.from(keyHex, "hex"),
  Buffer.from(ivHex, "hex")
);
decipher.setAuthTag(tag);

let plain = decipher.update(ciphertext, undefined, "utf8");
plain += decipher.final("utf8");
process.stdout.write(plain);
