try {
    module.exports = appbridge.CryptoLib;
    return;
} catch(e) {
}

var Forge = require('node-forge');
var Utils = require('./utils');

var Algos = {};

Algos.AESGCMEncrypt = function(iv, adata, key, plaintext) {
    var cipher = Forge.cipher.createCipher('AES-GCM', Utils.b642bits(key));

    cipher.start({
        iv: Utils.b642bits(iv),
        additionalData: Utils.b642bits(adata)
    });

    cipher.update(Forge.util.createBuffer(Utils.b642bits(plaintext)));

    var ret;

    if (!cipher.finish()) {
        ret = false;
    } else {
        var concat = cipher.output.getBytes().concat(cipher.mode.tag.getBytes());

        ret = Forge.util.encode64(concat);
    }

    return ret;
};

Algos.AESGCMDecrypt = function(iv, adata, key, ciphertext) {
    var cipher = Forge.cipher.createCipher('AES-GCM',  Utils.b642bits(key)),
        ctBytes = Forge.util.createBuffer(Utils.b642bits(ciphertext)),
        ct = Forge.util.createBuffer(ctBytes.getBytes(ctBytes.length() - 16)),
        tag = Forge.util.createBuffer(ctBytes.getBytes());

    cipher.start({
        iv: Utils.b642bits(iv),
        additionalData: Utils.b642bits(adata),
        tag: tag
    });

    cipher.update(ct);

    var ret;

    if (!cipher.finish()) {
        ret = false;
    } else {
        ret = Forge.util.encode64(cipher.output.getBytes());
    }

    return ret;
};

Algos.PBKDF2 = function(salt, iterations, plaintext) {
    var saltBytes = Forge.util.decode64(salt),
        hashBits = Forge.pkcs5.pbkdf2(plaintext, saltBytes, iterations, 32, Forge.md.sha256.create());

    return Utils.bits2b64(hashBits);
};

Algos.RSAGenerateKeyPair = function(size, callback) {
    size = size || 2048;

    var self = this;

    var opts = {
        bits: size,
        e: 0x10001
    };

    if (callback) {
        var state = Forge.pki.rsa.createKeyPairGenerationState(opts.bits, opts.e);

        var step = function() {
            if (!Forge.pki.rsa.stepKeyPairGenerationState(state, 50)) {
                setTimeout(step, 1);
            } else {
                callback(self._formatPem(state.keys));
            }
        };

        setTimeout(step);
    } else {
        var keyPair = Forge.pki.rsa.generateKeyPair(opts);

        return self._formatPem(keyPair);
    }
};

Algos._formatPem = function(keyPair) {
    var privatePem = Forge.pki.privateKeyToPem(keyPair.privateKey),
        publicPem = Forge.pki.publicKeyToPem(keyPair.publicKey);

    return {
        privateKey: privatePem,
        publicKey: publicPem
    };
};

Algos.RSAEncrypt = function(publicKeyPem, plaintext) {
    var publicKey = Forge.pki.publicKeyFromPem(publicKeyPem),
        ptBytes = Forge.util.decodeUtf8(plaintext),
        ctBytes = publicKey.encrypt(ptBytes);

    return Forge.util.encode64(ctBytes);
};

Algos.RSADecrypt = function(privateKeyPem, ciphertext) {
    var privateKey = Forge.pki.privateKeyFromPem(privateKeyPem),
        ctBytes = Forge.util.decode64(ciphertext),
        ptBytes = privateKey.decrypt(ctBytes);

    return Forge.util.encodeUtf8(ptBytes);
};

Algos.RSASign = function(privateKeyPem, plaintext) {
    var privateKey = Forge.pki.privateKeyFromPem(privateKeyPem),
        md = Forge.md.sha256.create();

    md.update(plaintext, 'utf8');

    var signature = privateKey.sign(md);

    return Utils.bits2b64(signature);
};

Algos.RSAVerify = function(publicKey, signature, plaintext) {
    var publicKeyPem = Forge.pki.publicKeyFromPem(publicKey),
        sigBytes = Forge.util.decode64(signature),
        md = Forge.md.sha256.create();

    md.update(plaintext, 'utf8');

    var ret;

    try {
        ret = publicKeyPem.verify(md.digest().getBytes(), sigBytes);
    } catch(e) {
        ret = false;
    }

    return ret;
};

module.exports = Algos;
