var Forge = require('node-forge');

var Algos = require('./algos');
var Utils = require('./utils');

var usedRandoms = {};

var Convenience = {};

var b2b64 = Utils.bits2b64,
    s2b64 = Utils.str2b64,
    b642b = Utils.b642bits,
    b642s = Utils.b642str,
    h2b = Utils.hex2bits;

var FORMAT_VERSION_BITS = h2b('01');

Convenience.encrypt = function(keyOrPassword, usePassword, plaintext) {
    var ivBytes = Convenience.randomBytes(16),
        adBytes = Convenience.randomBytes(16),
        ptB64 = s2b64(plaintext),
        saltBits = [],
        usePWBits,
        key;

    if (usePassword) {
        usePWBits = h2b('01');
        saltBits = Convenience.randomBytes(16);
        key = Algos.PBKDF2(b2b64(saltBits), 10000, keyOrPassword);
    } else {
        usePWBits = h2b('00');
        key = keyOrPassword;
    }

    var ct = Algos.AESGCMEncrypt(b2b64(ivBytes), b2b64(adBytes), key, ptB64),
        ctBits = b642b(ct),
        components = [FORMAT_VERSION_BITS, usePWBits, saltBits, ivBytes, adBytes, ctBits],
        buf = Forge.util.createBuffer();

    for (var i = 0; i < components.length; i++) {
        var component = components[i];

        buf.putBytes(component);
    }

    return b2b64(buf.getBytes());
};

Convenience.decrypt = function(keyOrPassword, ciphertext) {
    var ctBits = Forge.util.createBuffer(b642b(ciphertext)),
        version = ctBits.getBytes(1),
        usePassword = ctBits.getBytes(1),
        key, iv, adata, ct;

    if (Forge.util.createBuffer(version).toHex() !== '01') {
        throw new Error ('Invalid format.');
    }

    if (Forge.util.createBuffer(usePassword).toHex() === '01') {
        var salt = ctBits.getBytes(16);

        key = Algos.PBKDF2(b2b64(salt), 10000, keyOrPassword);
    } else {
        key = keyOrPassword;
    }

    iv = ctBits.getBytes(16);
    adata = ctBits.getBytes(16);
    ct = ctBits.getBytes();

    var pt = Algos.AESGCMDecrypt(b2b64(iv), b2b64(adata), key, b2b64(ct));

    return b642s(pt);
};

Convenience.randomBytes = function(n) {
    var i = 0,
        data;

    var generate = function() {
        var bytes = Forge.random.getBytesSync(n);

        data = {
            bytes: bytes,
            b64: b2b64(bytes)
        };
    };

    generate();

    while (usedRandoms[data.b64]) {
        if (i === 2) {
            throw new Error('The same random data has been generated three times. Something ' +
                'is extremely wrong.');
        }

        generate();
        i++;
    }

    usedRandoms[data.b64] = true;

    return data.bytes;
};

module.exports = Convenience;
