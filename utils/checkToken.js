import axios from "axios";
import { CONFIG } from "../config.js";
import { handleError } from "./errorHandler.js";

export async function checkToken(token) {
  try {
    const res = await axios.get(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/users/@me`, {
      headers: { 
        Authorization: token,
        'Content-Type': 'application/json'
      }
    });

    return {
      valid: true,
      username: res.data.username,
      discriminator: res.data.discriminator,
      id: res.data.id,
      mfa_enabled: res.data.mfa_enabled
    };
  } catch (error) {
    return handleError(error, 'Token Validation');
  }
}