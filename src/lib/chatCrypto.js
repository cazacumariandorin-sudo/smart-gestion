/**
 * Utilidades de cifrado E2E para Chat
 * RSA-OAEP-2048 para intercambio de claves AES
 * AES-256-GCM para cifrado de mensajes
 */

// Generar par de claves RSA-2048
export async function generarClavesRSA() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Exportar clave pública a JWK luego a base64 para almacenar
  const publicKeyJWK = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const publicKeyBase64 = btoa(JSON.stringify(publicKeyJWK));

  // Clave privada se queda en memoria (no se exporta)
  return { publicKeyBase64, privateKey: keyPair.privateKey };
}

// Importar clave pública desde base64
export async function importarClavePublica(publicKeyBase64) {
  try {
    const publicKeyJWK = JSON.parse(atob(publicKeyBase64));
    return await window.crypto.subtle.importKey(
      'jwk',
      publicKeyJWK,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['encrypt']
    );
  } catch (error) {
    console.error('Error importando clave pública:', error);
    return null;
  }
}

// Generar clave AES aleatoria
export async function generarClaveAES() {
  return await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Cifrar mensaje con AES-GCM
export async function cifrarAES(texto, claveAES) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    claveAES,
    data
  );

  // Combinar IV + ciphertext en un solo buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

// Descifrar mensaje con AES-GCM
export async function descifrarAES(textoCifradoBase64, claveAES) {
  try {
    const combined = Uint8Array.from(atob(textoCifradoBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      claveAES,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Error descifrando:', error);
    return null;
  }
}

// Cifrar clave AES con RSA (para enviar a otro usuario)
export async function cifrarClaveAESConRSA(claveAES, publicKeyBase64) {
  const publicKey = await importarClavePublica(publicKeyBase64);
  if (!publicKey) return null;

  // Exportar clave AES a raw
  const rawKey = await window.crypto.subtle.exportKey('raw', claveAES);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawKey
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

// Descifrar clave AES con RSA (clave privada local)
export async function descifrarClaveAESConRSA(claveCifradaBase64, privateKey) {
  try {
    const encrypted = Uint8Array.from(atob(claveCifradaBase64), c => c.charCodeAt(0));
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encrypted
    );

    return await window.crypto.subtle.importKey(
      'raw',
      decrypted,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Error descifrando clave AES:', error);
    return null;
  }
}

// ── Persistencia del par de claves en IndexedDB ─────────────────────────
// Clave privada RSA en memoria se pierde al recargar → las claves AES de
// mensajes antiguos (cifradas con la clave pública anterior) ya no se pueden
// descifrar y aparece "[No se pudo descifrar]". IndexedDB persiste el par
// (por email) entre recargas para no rotar claves en cada carga.
const DB_NAME = 'chat_crypto';
const STORE = 'keypairs';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarParClaves(email, publicKeyBase64, privateKey) {
  try {
    const privJWK = await window.crypto.subtle.exportKey('jwk', privateKey);
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ publicKeyBase64, privateKeyJWK: privJWK }, email);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return false;
  }
}

export async function cargarParClaves(email) {
  try {
    const db = await openDB();
    const rec = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(email);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!rec) return null;
    const privateKey = await window.crypto.subtle.importKey(
      'jwk',
      rec.privateKeyJWK,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['decrypt']
    );
    return { publicKeyBase64: rec.publicKeyBase64, privateKey };
  } catch {
    return null;
  }
}

// Almacenar claves en sessionStorage (solo sesión actual)
const STORAGE_KEY = 'chat_crypto_keys';

export function guardarClavesEnStorage(publicKeyBase64) {
  // La clave privada NO se almacena persistentemente por seguridad
  // Solo guardamos referencia a que existen claves
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    publicKeyBase64,
    generadas: new Date().toISOString()
  }));
}

export function obtenerDeStorage() {
  const data = sessionStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  return JSON.parse(data);
}

export function limpiarClavesStorage() {
  sessionStorage.removeItem(STORAGE_KEY);
}