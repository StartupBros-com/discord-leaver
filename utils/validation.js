export function validateToken(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token is required' };
    }
    
    if (!token.match(/^[A-Za-z0-9._-]+$/)) {
      return { valid: false, error: 'Invalid token format' };
    }
  
    return { valid: true };
  }
  
  export function validate2FACode(code) {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: '2FA code is required' };
    }
  
    if (!code.match(/^\d{6}$/)) {
      return { valid: false, error: 'Invalid 2FA code format' };
    }
  
    return { valid: true };
  }