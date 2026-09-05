/**
 * Which machine `/connect_mcp` should bind for this row.
 *
 * A listed row already names its device. A pending "Ubuntu desktop" row does
 * not — and must not guess the first Ubuntu machine in the listing. That guess
 * is how an account bound someone else's linux-pc.
 *
 * @param {Object} connection A device row (pending or registered).
 * @returns {{deviceId: string|undefined, deviceLabel: string|undefined}}
 */
export function selectMcpDeviceToBind(connection) {
  if (connection?.pending) {
    return { deviceId: undefined, deviceLabel: undefined };
  }
  const fromField = connection?.device_id;
  const fromKey = String(connection?.connection_key ?? '').replace(/^device:/, '');
  const deviceId = fromField || fromKey || '';
  if (!deviceId || deviceId.startsWith('pending:')) {
    return { deviceId: undefined, deviceLabel: undefined };
  }
  return {
    deviceId,
    deviceLabel: connection?.display_label,
  };
}
