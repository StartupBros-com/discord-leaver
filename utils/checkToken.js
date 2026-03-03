import { CONFIG } from "../config.js";
import { handleError } from "./errorHandler.js";

export async function checkToken(token) {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/users/@me`, {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    return {
      valid: true,
      username: data.username,
      discriminator: data.discriminator,
      id: data.id,
      mfa_enabled: data.mfa_enabled
    };
  } catch (error) {
    return handleError(error, 'Token Validation');
  }
}
