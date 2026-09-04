"use client";

/**
 * Somebody's own provider key, kept in their browser and nowhere else.
 *
 * ## What the encryption here does, and what it does not
 *
 * The key material is encrypted with AES-GCM under a **non-extractable**
 * `CryptoKey`, which lives in the same IndexedDB. That sounds circular and is
 * not: a non-extractable key cannot be read out by any script, including one in
 * this origin. It can only be *used*. So dumping the database — a browser
 * backup, a profile copied off a laptop, a sync, a forensic image, an extension
 * enumerating storage — yields two things neither of which is a key.
 *
 * It does **not** protect against script running in this origin, because
 * nothing can: script here can call `loadKey` the same way the caption pipeline
 * does. Encryption whose key sits in the same store as the ciphertext protects
 * against reading the store, and claiming more than that would be the kind of
 * security theatre this file exists to avoid.
 *
 * The alternative — a passphrase the user types, with the derived key held only
 * in memory — is genuinely stronger and was rejected on purpose: it means
 * typing a passphrase again after every reload, in the middle of a meeting, to
 * get captions back. People would turn captions off, which protects the key by
 * deleting the feature.
 *
 * ## What never happens
 *
 * The key is never sent to our server unless the provider refuses browser
 * requests, and then only as a header on the one request that uses it — see
 * `lib/stt/transcribe.ts`. It is never put in a URL, never logged, never in an
 * error, and never written to our database. `SECURITY.md` says so publicly.
 */

const DB_NAME = "lor-keys";
const DB_VERSION = 1;
const KEYS = "keys";
const SECRET = "secret";

/** The one wrapping key, under a fixed id in its own store. */
const SECRET_ID = "wrapping";

export interface StoredKey {
  provider: string;
  /**
   * The last four characters, so somebody can tell which key is stored without
   * the interface having to show one. Four is enough to recognise and useless
   * to steal.
   */
  hint: string;
  addedAt: number;
}

interface Record_ extends StoredKey {
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEYS)) {
        db.createObjectStore(KEYS, { keyPath: "provider" });
      }
      if (!db.objectStoreNames.contains(SECRET)) {
        db.createObjectStore(SECRET);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(store, mode).objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * The wrapping key, made once and never readable afterwards.
 *
 * `extractable: false` is the whole point. Generated on first use rather than
 * derived from anything, because there is nothing to derive it from that is not
 * also in this browser.
 */
async function wrappingKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await run<CryptoKey | undefined>(db, SECRET, "readonly", (s) =>
    s.get(SECRET_ID),
  );
  if (existing) return existing;

  const created = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  await run(db, SECRET, "readwrite", (s) => s.put(created, SECRET_ID));
  return created;
}

export async function saveKey(provider: string, apiKey: string): Promise<StoredKey> {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("empty key");

  const db = await open();
  const secret = await wrappingKey(db);

  // A fresh nonce per key. Reusing one across two keys under the same wrapping
  // key is the classic way to make AES-GCM reveal both.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    secret,
    new TextEncoder().encode(trimmed),
  );

  const record: Record_ = {
    provider,
    hint: hintFor(trimmed),
    addedAt: Date.now(),
    iv,
    ciphertext,
  };

  await run(db, KEYS, "readwrite", (s) => s.put(record));
  return { provider, hint: record.hint, addedAt: record.addedAt };
}

export async function loadKey(provider: string): Promise<string | null> {
  const db = await open();
  const record = await run<Record_ | undefined>(db, KEYS, "readonly", (s) =>
    s.get(provider),
  );
  if (!record) return null;

  const secret = await wrappingKey(db);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: record.iv },
      secret,
      record.ciphertext,
    );
    return new TextDecoder().decode(plain);
  } catch {
    // The wrapping key is gone, or the record was written by something else.
    // Either way there is no key here, and saying so is better than throwing
    // in the middle of a caption.
    return null;
  }
}

/** What is stored, without any of it being the key. */
export async function listKeys(): Promise<StoredKey[]> {
  const db = await open();
  const records = await run<Record_[]>(db, KEYS, "readonly", (s) => s.getAll());

  return records
    .map(({ provider, hint, addedAt }) => ({ provider, hint, addedAt }))
    .sort((a, b) => a.provider.localeCompare(b.provider));
}

/** Removing a key removes it. */
export async function removeKey(provider: string): Promise<void> {
  const db = await open();
  await run(db, KEYS, "readwrite", (s) => s.delete(provider));
}

/**
 * The last four characters.
 *
 * Not the first four: provider keys begin with a shared prefix — `sk-`, `gsk_`
 * — so the front identifies the provider and nothing else, and showing it would
 * look like a hint while being none.
 */
export function hintFor(apiKey: string): string {
  return apiKey.trim().slice(-4);
}
