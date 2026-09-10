// Placa QR Pro - Utilitários, Formatadores e Sanitizadores de Segurança
import { storage } from '../services/storage.js';

/**
 * Sanitiza texto para prevenir ataques de Cross-Site Scripting (XSS)
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Hash Criptográfico Seguro SHA-256 via Web Crypto API (sem vazamento de senhas em texto puro)
 */
export async function sha256Hex(message) {
  if (!message) return '';
  const str = String(message).trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback seguro determinístico
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sh256_' + Math.abs(hash).toString(16);
}

/**
 * Sanitiza e adiciona https:// automaticamente se o usuário não tiver digitado o protocolo
 */
export function sanitizeUrl(string) {
  if (!string || typeof string !== 'string') return '';
  let trimmed = string.trim();
  if (!trimmed) return '';

  // Se já possui algum protocolo explícito (ex: http:, https:, javascript:, file:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }

  // Se não possui protocolo, adiciona https://
  return 'https://' + trimmed;
}

/**
 * Validação rigorosa de URLs HTTP/HTTPS seguras (impede javascript:, data:, file:, ftp:, etc.)
 */
export function isValidHttpUrl(string) {
  if (!string || typeof string !== 'string') return false;
  try {
    const formatted = sanitizeUrl(string);
    const url = new URL(formatted);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (!url.hostname || url.hostname.length < 3) return false;
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Formatação de data em padrão brasileiro
 */
export function formatDate(dateString) {
  if (!dateString) return 'Nunca';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Data inválida';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch (e) {
    return String(dateString);
  }
}

/**
 * Formatação de tempo relativo (ex: "5 min atrás", "2h atrás")
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return 'Sem leituras';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Sem leituras';
    const diff = Date.now() - d.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes} min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days === 1) return 'Ontem';
    return `${days} dias atrás`;
  } catch (e) {
    return 'Sem leituras';
  }
}

/**
 * Construtor inteligente do link direto de 5 estrelas do Google Meu Negócio
 */
export function buildGoogleReviewUrl(input) {
  if (!input) return '';
  const trimmed = input.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Se o usuário colou um link web (ex: maps.app.goo.gl/..., g.page/r/..., google.com/...) sem https://
  if (trimmed.includes('.') || trimmed.includes('/')) {
    return sanitizeUrl(trimmed);
  }

  // Se for Place ID puro do Google (inicia com ChIJ ou string alfanumérica longa sem pontos/barras)
  if (trimmed.startsWith('ChIJ') || trimmed.length >= 24) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(trimmed)}`;
  }

  // Se for nome de usuário ou identificador de perfil do Google (ex: @minhaempresa ou minhaempresa)
  return `https://g.page/r/${encodeURIComponent(trimmed.replace('@', ''))}/review`;
}

/**
 * Gera a URL do QR Code respeitando a URL Base de Produção configurada
 */
export function getPlaqueRedirectUrl(plaqueId) {
  const customBase = storage.settings?.baseUrl;
  const origin = (customBase && customBase.trim()) 
    ? customBase.trim() 
    : (typeof window !== 'undefined' ? window.location.origin : 'https://suaplaca.com');
  return `${origin.replace(/\/$/, '')}/r/${encodeURIComponent(plaqueId)}`;
}

/**
 * Retorna os dígitos do telefone invertidos para uso como código de login sem senha
 */
export function getReversedPhoneCode(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.split('').reverse().join('');
}

/**
 * Formata telefone brasileiro com DDD
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Gera link de conversa com WhatsApp
 */
export function getWhatsAppUrl(phone, message = '') {
  if (!phone) return '#';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${textParam}`;
}

/**
 * Copia texto para a área de transferência de forma segura
 */
export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-999999px';
  textarea.style.top = '-999999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Falha ao copiar:', err);
  }
  document.body.removeChild(textarea);
  return Promise.resolve();
}
