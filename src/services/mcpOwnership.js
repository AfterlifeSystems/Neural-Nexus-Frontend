/**
 * Drop machines stamped as belonging to a different account.
 *
 * `/list_mcp_connections` is already account-scoped. This is the client-side
 * belt if a leaked row still carries another account's `owner_user_id`.
 *
 * @param {Array} devices Rows from the listing.
 * @param {string} [accountUserId] The signed-in account, from the same payload.
 * @returns {Array}
 */
export function retainOwnedMcpDevices(devices, accountUserId) {
  const rows = devices ?? [];
  if (!accountUserId) return rows;
  return rows.filter((device) => {
    const owner = device?.owner_user_id;
    return !owner || owner === accountUserId;
  });
}
