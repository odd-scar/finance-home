import CryptoJS from 'crypto-js'

const CIPHER_SALT = 'fh-aes-v1'

export function encryptData(plaintext: string, pin: string): string {
  return CryptoJS.AES.encrypt(plaintext, pin + CIPHER_SALT).toString()
}

export function decryptData(ciphertext: string, pin: string): string | null {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, pin + CIPHER_SALT)
    const result = bytes.toString(CryptoJS.enc.Utf8)
    return result || null
  } catch {
    return null
  }
}
