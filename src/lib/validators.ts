/**
 * SOCMind — Input validation utilities for SOAR actions
 */

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
const CIDR_V4_REGEX = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
const HOSTNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidIPv4(ip: string): boolean {
  if (!IPV4_REGEX.test(ip)) return false;
  return ip.split('.').every(octet => {
    const n = parseInt(octet, 10);
    return n >= 0 && n <= 255;
  });
}

export function isValidIPv6(ip: string): boolean {
  return IPV6_REGEX.test(ip);
}

export function isValidCIDR(cidr: string): boolean {
  if (!CIDR_V4_REGEX.test(cidr)) return false;
  const [ip, prefix] = cidr.split('/');
  return isValidIPv4(ip) && parseInt(prefix, 10) >= 0 && parseInt(prefix, 10) <= 32;
}

export function isValidIP(value: string): boolean {
  return isValidIPv4(value) || isValidIPv6(value) || isValidCIDR(value);
}

export function isValidHostname(value: string): boolean {
  return HOSTNAME_REGEX.test(value) && value.length <= 253;
}

/**
 * Validates a SOAR action target based on action type.
 * Returns { valid, error } — error is a human-readable message if invalid.
 */
export function validateSOARTarget(
  actionType: string,
  target: string | null | undefined
): { valid: boolean; error?: string } {
  if (!target || target.trim().length === 0) {
    return { valid: false, error: 'Target is required' };
  }

  const trimmed = target.trim();

  // IP-based actions
  const ipActions = ['block_ip', 'unblock_ip', 'geo_block', 'isolate_host', 'unisolate_host'];
  if (ipActions.includes(actionType)) {
    if (!isValidIP(trimmed) && !isValidHostname(trimmed)) {
      return {
        valid: false,
        error: `Invalid target "${trimmed}" for ${actionType}. Must be a valid IP address (e.g., 192.168.1.1) or hostname.`,
      };
    }
  }

  // User-based actions
  const userActions = ['disable_user', 'reset_credentials', 'lock_user'];
  if (userActions.includes(actionType)) {
    if (trimmed.length < 2) {
      return { valid: false, error: 'User target must be at least 2 characters' };
    }
  }

  return { valid: true };
}
