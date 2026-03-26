import { describe, it, expect } from 'vitest'
import { encryptData, decryptData } from '../cryptoStore'

describe('encryptData / decryptData', () => {
  it('round-trips plaintext correctly', () => {
    const plain = '{"hello":"world","value":42}'
    const encrypted = encryptData(plain, '1234')
    const decrypted = decryptData(encrypted, '1234')
    expect(decrypted).toBe(plain)
  })

  it('different keys produce different ciphertext', () => {
    const plain = 'sensitive data'
    const c1 = encryptData(plain, 'key1')
    const c2 = encryptData(plain, 'key2')
    expect(c1).not.toBe(c2)
  })

  it('wrong key returns null (does not crash)', () => {
    const encrypted = encryptData('secret', 'correct-key')
    const result = decryptData(encrypted, 'wrong-key')
    expect(result).toBeNull()
  })

  it('garbled ciphertext returns null (does not crash)', () => {
    expect(decryptData('not-valid-ciphertext!!!', 'key')).toBeNull()
  })

  it('encrypts large JSON payloads', () => {
    const large = JSON.stringify({ data: Array.from({ length: 500 }, (_, i) => ({ id: i, value: i * 1.5 })) })
    const enc = encryptData(large, 'testpin')
    const dec = decryptData(enc, 'testpin')
    expect(dec).toBe(large)
  })

  it('encrypts empty string — decryptData returns null (empty is indistinguishable from failure)', () => {
    // CryptoJS decrypts '' back to '' which the falsy check turns into null.
    // This is intentional: the store never stores empty-string data.
    const enc = encryptData('', 'key')
    const dec = decryptData(enc, 'key')
    expect(dec).toBeNull()
  })

  it('produces a different ciphertext each call (IV randomness)', () => {
    const c1 = encryptData('same input', 'same key')
    const c2 = encryptData('same input', 'same key')
    // CryptoJS AES uses random IV so ciphertexts differ
    expect(c1).not.toBe(c2)
  })
})
