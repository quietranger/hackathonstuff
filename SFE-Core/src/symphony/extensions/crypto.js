'use strict';

var Q = require('q');
var CryptoLib = require('symphony-cryptolib');

var encrypt = CryptoLib.Convenience.encrypt,
    decrypt = CryptoLib.Convenience.decrypt;

var config = require('../../../config');

var Crypto = function (transport, dataStore) {
    var self = this;

    this.keyCache = {};

    this.dataStore = dataStore;
    this.transport = transport;
    this.transport.on('transport:willSendData', this.transportWillSendData.bind(this));
    this.transport.on('transport:didReceiveData', this.transportDidReceiveData.bind(this));

    this.transport.setCommands({
        GET_RELAY_PUBLIC_KEY: {
            url: config.RELAY_ENDPOINT + '/publicKey',
            requestType: 'GET'
        },

        GET_MY_KEYS: {
            url: config.RELAY_ENDPOINT + '/keys/me',
            requestType: 'GET'
        },

        GET_PUBLIC_KEYS: {
            url: config.RELAY_ENDPOINT + '/keys',
            requestType: 'GET'
        }
    });

    var account = this.dataStore.get('app.account');

    this.userId = account.userName; //wat

    var myKeysPromise = this.transport.send({
        id: 'GET_MY_KEYS'
    });

    var relayKeysPromise = this.transport.send({
        id: 'GET_RELAY_PUBLIC_KEY'
    });

    Q.spread([ relayKeysPromise, myKeysPromise ], this._verifyAndSetKeyPair.bind(this));

    this._ims = _.indexBy(_.filter(account.pinnedChats, function (item) {
        return item.userIds.length === 2;
    }), 'threadId');
};

Crypto.prototype._verifyAndSetKeyPair = function(relayKeysRsp, myKeysRsp) {
    var relayPublicKey = relayKeysRsp.publicKey;
    var myPublicKey = myKeysRsp.publicKey;
    var myPrivateKey = myKeysRsp.privateKey;

    if (!CryptoLib.RSAVerify(relayPublicKey, myKeysRsp.publicKeySignature, myPublicKey)
        || !CryptoLib.RSAVerify(relayPublicKey, myKeysRsp.privateKeySignature, myPrivateKey)) {
        throw new Error('Could not verify key pair signature.');
    }

    this.publicKey = myPublicKey;
    this.privateKey = myPrivateKey;

    this.dataStore.upsert('publicKeys.'+this.userId, this.publicKey);
};

Crypto.prototype.transportWillSendData = function (id, request) {
    var dispatch = {
        SEND_CHAT: this._encryptMessages.bind(this),
        IM_MANAGER_USERS: this._generateIMKey.bind(this)
    };

    var fn = dispatch[id];

    if (fn) {
        request.asyncTransforms.push(fn(request));
    }
};

Crypto.prototype.transportDidReceiveData = function (id, rsp) {
    if (id === 'QUERY_THREAD_HISTORY') {
        this._decryptMessages(_.pluck(rsp.envelopes, 'message'));
    } else if (id === 'LONG_POLL') {
        this._handleLongPollResponse(rsp);
    } else if (id === 'IM_MANAGER_THREAD' || id === 'IM_MANAGER_USERS') {
        this._handleIMResponse(rsp);
    }
};

Crypto.prototype._generateIMKey = function (request) {
    var userIds = request.urlExtension.replace('/', '').split(','),
        q = Q.defer();

    if (userIds.length > 2) {
        q.resolve(null);
        return q.promise;
    }

    userIds = _.map(userIds, function(item) {
        return Number(item);
    });

    if (userIds.length == 2 && !_.contains(userIds, this.userId)) {
        q.resolve(null);
        return q.promise;
    } else if (userIds.length == 1) {
        userIds.push(this.userId);
    }

    var joinedIds = userIds.join(',');

    this.dataStore.get('publicKeys.' + joinedIds).then(function (publicKeys) {
        var roomKey = CryptoLib.Utils.bits2b64(CryptoLib.Convenience.randomBytes(32)),
            encryptionKeys = [];

        for (var i = 0; i < userIds.length; i++) {
            var id = userIds[i],
                pubKey = publicKeys[id];

            if (!pubKey) {
                q.reject('Could not find public key for user ID ' + id);

                return;
            }

            var ct = CryptoLib.RSAEncrypt(pubKey, roomKey);

            if (!ct) {
                q.reject('Encryption failed for user ID' + id + ' and public' +
                ' key ' + pubKey);

                return;
            }

            encryptionKeys.push({
                userId: id,
                encryptionKey: ct
            });
        }

        request.payload = {};
        request.payload.encryptionKeys = JSON.stringify(encryptionKeys);

        q.resolve();
    });

    return q.promise;
};

Crypto.prototype._encryptMessages = function (request) {
    var q = Q.defer(),
        payload;

    if (request.payload) {
        payload = request.payload;
    } else {
        q.resolve();
        return q.promise;
    }

    var im = this._ims[payload.threadId];

    if (im) {
        if (!im.encryptionKey) {
            q.reject('Encrypted IM ' + payload.threadId + ' has no encryption key.');

            return q.promise;
        }

        var text = payload.text,
            key;

        try {
            key = this._getIMPrivateKey(im.threadId);
        } catch(e) {
            q.reject(e);

            return q.promise;
        }

        payload.text = encrypt(key, false, text);

        if (payload.entities) {
            payload.encryptedEntities = encrypt(key, false, JSON.stringify(payload.entities));
            delete payload.entities;
        }

        payload.msgFeatures = '1';
    }

    request.payload = payload;

    q.resolve();

    return q.promise;
};

Crypto.prototype._handleLongPollResponse = function (rsp) {
    if (rsp.messages && rsp.messages.length > 0) {
        this._decryptMessages(_.pluck(rsp.messages, 'message'));
    }
};

Crypto.prototype._handleIMResponse = function (rsp) {
    var result = rsp.result;

    if (result && result.userIds.length === 2) {
        this._ims[result.threadId] = result;
    }
};

Crypto.prototype.decryptMessage = function (message) {
    this._decryptMessages([message]);
};

Crypto.prototype._decryptMessages = function (messages) {
    if (!messages || messages.length === 0) {
        return;
    }

    for (var i = 0; i < messages.length; i++) {
        var message = messages[i],
            im = this._ims[message.threadId],
            isEncrypted = Number(message.msgFeatures) & 1;

        if (!im || !im.encryptionKey || !isEncrypted) {
            continue;
        }

        var key = this._getIMPrivateKey(im.threadId);

        try {
            message.text = decrypt(key, message.text);

            if (message.encryptedEntities) {
                message.entities = JSON.parse(decrypt(key, message.encryptedEntities));
            }
        } catch(e) {
            message.text = 'Could not decrypt this message.';
        }
    }
};

Crypto.prototype._storePublicKeys = function (people) {
    for (var i = 0; i < people.length; i++) {
        var person = people[i];

        this.dataStore.upsert('publicKeys.' + person.id, person.publicKey);
    }
};

Crypto.prototype._getIMPrivateKey = function (id) {
    var cached = this.keyCache[id],
        ret;


    if (!this.privateKey) {
        throw new Error('Cannot perform encryption without private key.');
    }

    if (cached) {
        ret = cached;
    } else {
        var im = this._ims[id];

        if (!im) {
            return null;
        }

        var key = CryptoLib.RSADecrypt(this.privateKey, im.encryptionKey);

        if (!key) {
            throw new Error('Could not decrypt encryption key belonging to thread ID' +
            im.threadId);
        }

        this.keyCache[im.threadId] = key;

        ret = key;
    }

    return ret;
};

module.exports = Crypto;
