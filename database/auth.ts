import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { db } from './db';

export type User = {
  id: number;
  username: string;
  email: string;
  profile_picture: string | null;
};

type UserRow = User & {
  password_hash: string;
};

const SESSION_KEY = 'foodbuddy_user_id';

// Prototype setting. Do not use for production accounts.
const ITERATIONS = 10000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    throw new Error('Invalid stored password hash.');
  }

  return new Uint8Array(
    hex.match(/.{2}/g)!.map(value => parseInt(value, 16))
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = await Crypto.getRandomBytesAsync(16);

  const hash = await pbkdf2Async(sha256, password, salt, {
    c: ITERATIONS,
    dkLen: 32,
  });

  return `pbkdf2-sha256$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split('$');

  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') {
    return false;
  }

  const iterations = Number(parts[1]);

  if (!Number.isSafeInteger(iterations) ||
      iterations < 1 ||
      iterations > 1000000) {
    return false;
  }

  const salt = fromHex(parts[2]);
  const expected = fromHex(parts[3]);

  const actual = await pbkdf2Async(sha256, password, salt, {
    c: iterations,
    dkLen: expected.length,
  });

  if (actual.length !== expected.length) return false;

  let difference = 0;

  for (let i = 0; i < actual.length; i++) {
    difference |= actual[i] ^ expected[i];
  }

  return difference === 0;
}

function publicUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    profile_picture: row.profile_picture,
  };
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<User> {
  const name = username.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!name) throw new Error('Please enter a username.');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Please enter a valid email.');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM users WHERE email = ?',
    [normalizedEmail]
  );

  if (existing) {
    throw new Error('An account with that email already exists.');
  }

  const passwordHash = await hashPassword(password);

  let result;

  try {
    result = await db.runAsync(
      `INSERT INTO users (username, email, password_hash)
       VALUES (?, ?, ?)`,
      [name, normalizedEmail, passwordHash]
    );
  } catch (error) {
    throw new Error('Could not create account. Check whether the email is already registered.');
  }

  const user: User = {
    id: result.lastInsertRowId,
    username: name,
    email: normalizedEmail,
    profile_picture: null,
  };

  await SecureStore.setItemAsync(SESSION_KEY, String(user.id));

  return user;
}

export async function loginUser(
  email: string,
  password: string
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();

  const row = await db.getFirstAsync<UserRow>(
    `SELECT id, username, email, password_hash, profile_picture
     FROM users WHERE email = ?`,
    [normalizedEmail]
  );

  if (!row) {
    throw new Error('Incorrect email or password.');
  }

console.log('User found in SQLite');
console.log('Starting password verification');

const valid = await verifyPassword(password, row.password_hash);

console.log('Password verification finished:', valid);

if (!valid) {
  throw new Error('Incorrect email or password.');
}

  await SecureStore.setItemAsync(SESSION_KEY, String(row.id));

  return publicUser(row);
}

export async function getCurrentUser(): Promise<User | null> {
  const savedId = await SecureStore.getItemAsync(SESSION_KEY);

  if (!savedId) return null;

  const id = Number(savedId);

  if (!Number.isSafeInteger(id)) return null;

  const row = await db.getFirstAsync<UserRow>(
    `SELECT id, username, email, password_hash, profile_picture
     FROM users WHERE id = ?`,
    [id]
  );

  if (!row) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }

  return publicUser(row);
}

export async function logoutUser(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
export async function updateProfilePicture(
  userId: number,
  pictureUri: string
): Promise<User> {
  await db.runAsync(
    'UPDATE users SET profile_picture = ? WHERE id = ?',
    [pictureUri, userId]
  );

  const updatedUser = await db.getFirstAsync<User>(
    `SELECT id, username, email, profile_picture
     FROM users WHERE id = ?`,
    [userId]
  );

  if (!updatedUser) {
    throw new Error('User not found.');
  }

  return updatedUser;
}
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!currentPassword) {
    throw new Error('Please enter your current password.');
  }

  if (newPassword.length < 8) {
    throw new Error('Your new password must be at least 8 characters.');
  }

  if (currentPassword === newPassword) {
    throw new Error('Your new password must be different.');
  }

  const row = await db.getFirstAsync<{
    password_hash: string;
  }>(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId]
  );

  if (!row) {
    throw new Error('Account not found.');
  }

  const valid = await verifyPassword(
    currentPassword,
    row.password_hash
  );

  if (!valid) {
    throw new Error('Your current password is incorrect.');
  }

  const newHash = await hashPassword(newPassword);

  const result = await db.runAsync(
    'UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?',
    [newHash, userId, row.password_hash]
  );

  if (result.changes !== 1) {
    throw new Error('Password could not be updated. Please try again.');
  }
}