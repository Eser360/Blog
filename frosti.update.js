#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const UPSTREAM_REPO = "https://github.com/EveSunMaple/Frosti.git";
const TEMP_DIR = "frosti_temp_update";

// --- Colors ---
const colors = {
  C_RED: '\x1b[31m',
  C_GREEN: '\x1b[32m',
  C_YELLOW: '\x1b[33m',
  C_BLUE: '\x1b[34m',
  C_NC: '\x1b[0m'
};

// --- Helper: Language Loader ---
function loadTranslations(lang) {
  const i18nPath = path.join(__dirname, 'src', 'i18n', `${lang}.sh`);
  if (!fs.existsSync(i18nPath)) {
    return null;
  }
  const content = fs.readFileSync(i18nPath, 'utf-8');
  const translations = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let value = trimmed.substring(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    translations[key] = value;
  }
  return translations;
}

// --- Helper: Format Message with Colors ---
function formatMsg(msg) {
  if (!msg) return '';
  return msg
    .replace(/\${C_RED}/g, colors.C_RED)
    .replace(/\${C_GREEN}/g, colors.C_GREEN)
    .replace(/\${C_YELLOW}/g, colors.C_YELLOW)
    .replace(/\${C_BLUE}/g, colors.C_BLUE)
    .replace(/\${C_NC}/g, colors.C_NC)
    .replace(/\\n/g, '\n');
}

// --- Language Detection ---
let lang = 'en';
const envLang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '';
if (envLang.startsWith('zh')) {
  lang = 'zh';
}
if (process.argv[2]) {
  const arg = process.argv[2].toLowerCase();
  if (arg === 'zh' || arg === 'en') {
    lang = arg;
  }
}

const translations = loadTranslations(lang) || loadTranslations('en') || {};

// --- Load Ignore Rules ---
function loadIgnoreRules() {
  const ignorePath = path.join(__dirname, '.updateignore');
  if (!fs.existsSync(ignorePath)) {
    return [];
  }
  const content = fs.readFileSync(ignorePath, 'utf-8');
  const rules = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  
  // Also always ignore git, node_modules, temp dir, and updater scripts
  const defaultIgnore = [
    '.git/',
    'node_modules/',
    'dist/',
    TEMP_DIR + '/',
    'frosti.update.sh',
    'frosti.update.js',
    '.updateignore'
  ];
  
  return [...new Set([...rules, ...defaultIgnore])];
}

const ignoreRules = loadIgnoreRules();

function shouldIgnore(relativePath, rules) {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  for (const rule of rules) {
    if (rule.endsWith('/')) {
      const dirRule = rule.slice(0, -1);
      if (normalizedPath === dirRule || normalizedPath.startsWith(rule)) {
        return true;
      }
    } else {
      if (normalizedPath === rule || normalizedPath.startsWith(rule + '/')) {
        return true;
      }
    }
  }
  return false;
}

// Recursive file listing
function getFilesRecursive(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(getFilesRecursive(filePath, baseDir));
    } else {
      const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }
  return results;
}

// Recursive empty directory cleaner
function cleanEmptyDirs(dir, baseDir = dir, rules = []) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      cleanEmptyDirs(filePath, baseDir, rules);
    }
  }
  const relativePath = path.relative(baseDir, dir).replace(/\\/g, '/');
  if (relativePath === '') return; // Don't delete root
  
  if (shouldIgnore(relativePath + '/', rules) || shouldIgnore(relativePath, rules)) {
    return; // Don't delete ignored directories
  }
  
  if (fs.readdirSync(dir).length === 0) {
    console.log(`${translations.MSG_STEP3_DELETING_EMPTY_DIR || 'Deleting empty directory:'} ${relativePath}`);
    fs.rmdirSync(dir);
  }
}

// --- Main execution ---
async function main() {
  console.log(`${colors.C_BLUE}=========================================${colors.C_NC}`);
  console.log(`${colors.C_BLUE}      ${translations.MSG_HEADER_TITLE || 'Frosti Project Update Assistant'}      ${colors.C_NC}`);
  console.log(`${colors.C_BLUE}=========================================${colors.C_NC}`);
  
  console.log(`${colors.C_YELLOW}${translations.MSG_WARNING_TITLE || 'Warning'}${colors.C_NC}`);
  console.log(translations.MSG_WARNING_RECOMMENDATION || '');
  console.log(translations.MSG_WARNING_IGNORE || '');
  console.log('');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise(resolve => {
    rl.question(translations.PROMPT_CONTINUE || 'Do you want to continue? (y/N): ', resolve);
  });
  rl.close();
  
  if (!answer.trim().toLowerCase().startsWith('y')) {
    console.log(colors.C_RED + (translations.MSG_CANCELLED || 'Operation cancelled.') + colors.C_NC);
    process.exit(1);
  }
  
  // Check Git status
  let isGit = false;
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    isGit = true;
  } catch (e) {}
  
  if (isGit) {
    let clean = true;
    try {
      execSync('git diff --quiet', { stdio: 'ignore' });
      execSync('git diff --cached --quiet', { stdio: 'ignore' });
    } catch (e) {
      clean = false;
    }
    if (!clean) {
      console.log(`${colors.C_RED}${translations.ERR_GIT_DIRTY || 'Error: Uncommitted changes'}${colors.C_NC}`);
      console.log(translations.ERR_GIT_DIRTY_ADVICE || 'Please commit your changes.');
      process.exit(1);
    }
    console.log(`${colors.C_GREEN}${translations.MSG_GIT_CLEAN || 'Git status clean.'}${colors.C_NC}`);
  }
  
  // Step 1: Clone
  console.log(formatMsg(translations.MSG_STEP1_CLONE || '\nStep 1: Cloning...'));
  try {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    execSync(`git clone --depth 1 "${UPSTREAM_REPO}" "${TEMP_DIR}"`, { stdio: 'inherit' });
    console.log(`${colors.C_GREEN}${translations.MSG_STEP1_CLONE_SUCCESS || 'Cloned successfully!'}${colors.C_NC}`);
  } catch (err) {
    console.log(`${colors.C_RED}${translations.ERR_STEP1_CLONE_FAILED || 'Clone failed.'}${colors.C_NC}`);
    process.exit(1);
  }
  
  // Step 2: Safe Copy (Add and overwrite)
  console.log(formatMsg(translations.MSG_STEP2_RSYNC || '\nStep 2: Updating files...'));
  const tempFiles = getFilesRecursive(TEMP_DIR);
  let copyCount = 0;
  for (const rel of tempFiles) {
    if (!shouldIgnore(rel, ignoreRules)) {
      const srcPath = path.join(TEMP_DIR, rel);
      const destPath = path.join(__dirname, rel);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
      copyCount++;
    }
  }
  console.log(`${colors.C_GREEN}${translations.MSG_STEP2_RSYNC_SUCCESS || 'Files copied successfully!'}${colors.C_NC} (Copied ${copyCount} files)`);
  
  // Step 3: Deletion of obsolete files
  console.log(formatMsg(translations.MSG_STEP3_DELETE || '\nStep 3: Cleaning obsolete files...'));
  const localFiles = getFilesRecursive(__dirname);
  let deleteCount = 0;
  for (const rel of localFiles) {
    if (!shouldIgnore(rel, ignoreRules)) {
      const srcPathInTemp = path.join(TEMP_DIR, rel);
      if (!fs.existsSync(srcPathInTemp)) {
        const destPath = path.join(__dirname, rel);
        console.log(`${translations.MSG_STEP3_DELETING_FILE || 'Deleting file:'} ${rel}`);
        try {
          fs.unlinkSync(destPath);
          deleteCount++;
        } catch (e) {
          console.warn(`Could not delete file ${rel}: ${e.message}`);
        }
      }
    }
  }
  console.log(`${colors.C_GREEN}${translations.MSG_STEP3_DELETE_SUCCESS || 'Obsolete files cleaned.'}${colors.C_NC} (Deleted ${deleteCount} files)`);
  
  // Step 4: Clean remaining empty folders
  console.log(formatMsg(translations.MSG_STEP4_CLEAN_EMPTY || '\nStep 4: Cleaning empty folders...'));
  cleanEmptyDirs(__dirname, __dirname, ignoreRules);
  console.log(`${colors.C_GREEN}${translations.MSG_STEP4_CLEAN_EMPTY_SUCCESS || 'Empty folders cleaned.'}${colors.C_NC}`);
  
  // Step 5: Clean temp folder
  console.log(formatMsg(translations.MSG_STEP5_CLEAN_TEMP || '\nStep 5: Cleaning temp folder...'));
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  console.log(`${colors.C_GREEN}${translations.MSG_STEP5_CLEAN_TEMP_SUCCESS || 'Temp folder cleaned.'}${colors.C_NC}`);
  
  // Step 6: Install dependencies
  console.log(formatMsg(translations.MSG_STEP6_PNPM || '\nStep 6: Installing dependencies...'));
  let hasPnpm = false;
  try {
    execSync('pnpm --version', { stdio: 'ignore' });
    hasPnpm = true;
  } catch (e) {}
  
  if (hasPnpm) {
    try {
      execSync('pnpm install', { stdio: 'inherit' });
      console.log(`${colors.C_GREEN}${translations.MSG_PNPM_INSTALL_SUCCESS || 'Dependencies installed.'}${colors.C_NC}`);
    } catch (e) {
      console.log(`${colors.C_RED}${translations.ERR_PNPM_INSTALL_FAILED || 'Dependency installation failed.'}${colors.C_NC}`);
      process.exit(1);
    }
  } else {
    console.log(`${colors.C_YELLOW}${translations.WARN_PNPM_NOT_FOUND || 'pnpm not found.'}${colors.C_NC}`);
    console.log(translations.WARN_PNPM_GUIDE || 'Please install dependencies manually.');
  }
  
  console.log(formatMsg(translations.MSG_FINAL_SUCCESS || '\nUpdate completed successfully!'));
  console.log(translations.MSG_FINAL_ADVICE || '');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
