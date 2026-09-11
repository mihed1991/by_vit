const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requiredFiles = ['Dockerfile', 'compose.yaml', '.env.example', 'DEPLOYMENT.md', 'Caddyfile.example'];
const errors = [];
const missing = requiredFiles.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) errors.push(`missing files: ${missing.join(', ')}`);

function value(name) {
  return String(process.env[name] || '').trim();
}

function isPlaceholder(input) {
  return !input || /replace-with|change-me|example\.com/i.test(input);
}

function parsedUrl(name) {
  try {
    return new URL(value(name));
  } catch (error) {
    errors.push(`${name} must be an absolute URL`);
    return null;
  }
}

const requiredEnvironment = [
  'BYVIT_PUBLIC_URL',
  'BYVIT_ALLOWED_ORIGINS',
  'BYVIT_ADMIN_PASSWORD',
  'BYVIT_DATA_DIR',
  'BYVIT_BACKUP_DIR',
  'BYVIT_UPLOAD_DIR',
  'BYVIT_BACKUP_TOKEN',
  'POSTGRES_PASSWORD',
  'DATABASE_URL'
];
requiredEnvironment.forEach(name => {
  if (!value(name)) errors.push(`${name} is required`);
});

if (isPlaceholder(value('BYVIT_ADMIN_PASSWORD')) || value('BYVIT_ADMIN_PASSWORD').length < 12) errors.push('BYVIT_ADMIN_PASSWORD must be a unique value of at least 12 characters');
if (isPlaceholder(value('BYVIT_BACKUP_TOKEN')) || value('BYVIT_BACKUP_TOKEN').length < 24) errors.push('BYVIT_BACKUP_TOKEN must be a unique value of at least 24 characters');
if (isPlaceholder(value('POSTGRES_PASSWORD')) || value('POSTGRES_PASSWORD').length < 16) errors.push('POSTGRES_PASSWORD must be a unique value of at least 16 characters');
if (isPlaceholder(value('DATABASE_URL'))) errors.push('DATABASE_URL must not contain a placeholder');
if (!['postgres', 'postgresql'].includes(value('BYVIT_STORAGE_DRIVER').toLowerCase())) errors.push('BYVIT_STORAGE_DRIVER must be postgres');
if (!/^(1|true|yes)$/i.test(value('BYVIT_MEDIA_PERSISTENT'))) errors.push('BYVIT_MEDIA_PERSISTENT must be true');

const publicUrl = parsedUrl('BYVIT_PUBLIC_URL');
if (publicUrl) {
  const local = ['localhost', '127.0.0.1', '::1'].includes(publicUrl.hostname);
  if (!local && publicUrl.protocol !== 'https:') errors.push('BYVIT_PUBLIC_URL must use HTTPS outside localhost');
}

value('BYVIT_ALLOWED_ORIGINS').split(',').map(origin => origin.trim()).filter(Boolean).forEach(origin => {
  let parsed;
  try { parsed = new URL(origin); } catch (error) { errors.push(`invalid allowed origin: ${origin}`); return; }
  if (parsed.origin !== origin.replace(/\/$/, '')) errors.push(`allowed origin must not contain a path: ${origin}`);
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (!local && parsed.protocol !== 'https:') errors.push(`allowed origin must use HTTPS: ${origin}`);
});

if (errors.length) {
  console.error(`Production environment is invalid:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Production environment check passed.');
}
