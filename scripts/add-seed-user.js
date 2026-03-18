#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'server', 'data', 'seed-users.json');

const [,, username, email, password] = process.argv;

if (!username || !email || !password) {
  console.log('Usage: node scripts/add-seed-user.js <username> <email> <password>');
  console.log('Example: node scripts/add-seed-user.js john john@example.com mypassword');
  process.exit(1);
}

let users = [];
if (fs.existsSync(SEED_PATH)) {
  users = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
}

const exists = users.find(u => u.username === username || u.email === email.toLowerCase());
if (exists) {
  console.log('User already exists in seed file. Updating password.');
  exists.password = password;
} else {
  users.push({ username, email: email.toLowerCase(), password });
}

fs.writeFileSync(SEED_PATH, JSON.stringify(users, null, 2) + '\n');
console.log(`Saved. ${users.length} user(s) in seed file.`);
console.log('Commit and push to persist on Render: git add -A && git commit -m "update users" && git push');
