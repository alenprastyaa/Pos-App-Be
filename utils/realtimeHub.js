const clients = new Set();

const addClient = (client) => {
    clients.add(client);
};

const removeClient = (res) => {
    for (const client of clients) {
        if (client.res === res) {
            clients.delete(client);
            break;
        }
    }
};

const writeEvent = (res, payload, eventName = null) => {
    if (eventName) {
        res.write(`event: ${eventName}\n`);
    }
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const broadcast = (predicate, payload, eventName = null) => {
    for (const client of clients) {
        if (predicate(client)) {
            writeEvent(client.res, payload, eventName);
        }
    }
};

const broadcastToToko = (tokoId, payload, eventName = null) => {
    if (!tokoId) return;
    broadcast((client) => client.tokoId === tokoId, payload, eventName);
};

const broadcastToUser = (userId, payload, eventName = null) => {
    if (!userId) return;
    broadcast((client) => client.userId === userId, payload, eventName);
};

const broadcastToRole = (roleName, payload, eventName = null) => {
    if (!roleName) return;
    broadcast((client) => client.roleName === roleName, payload, eventName);
};

const broadcastToAll = (payload, eventName = null) => {
    broadcast(() => true, payload, eventName);
};

module.exports = {
    addClient,
    removeClient,
    broadcastToToko,
    broadcastToUser,
    broadcastToRole,
    broadcastToAll,
};
