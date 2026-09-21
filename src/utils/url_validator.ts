import {
  SSRFError,
  SSRFFetchError,
  validateUrlForSsrf,
  validateUrlForSpec,
  validateSpecPath,
  isPrivateIp,
  resolveHostname,
  type ValidatedURL,
} from "./httpClient.js";

export { SSRFError, SSRFFetchError, validateUrlForSsrf, validateUrlForSpec, validateSpecPath, isPrivateIp, resolveHostname };
export type { ValidatedURL };

export const isIpAllowed = (ip: string): boolean => !isPrivateIp(ip);
export const is_ip_allowed = isIpAllowed;
export const resolve_hostname = resolveHostname;
