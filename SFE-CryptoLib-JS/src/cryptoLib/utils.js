var Forge = require('node-forge');

var Utils = {};

Utils.str2bits = function(str) {
    return Forge.util.createBuffer(str, 'utf8').getBytes();
};

Utils.str2b64 = function(str) {
    return Utils.bits2b64(Utils.str2bits(str));
};

Utils.b642bits = function(b64) {
    return Forge.util.decode64(b64);
};

Utils.bits2b64 = function(bits) {
    return Forge.util.encode64(bits);
};

Utils.b642str = function(b64) {
    return Forge.util.decodeUtf8(Utils.b642bits(b64));
};

Utils.b642hex = function(b64) {
    return Forge.util.bytesToHex(Utils.b642bits(b64));
};

Utils.hex2b64 = function(hex) {
    return Utils.bits2b64(Utils.hex2bits(hex));
};

Utils.hex2bits = function(hex) {
    return Forge.util.hexToBytes(hex);
};

module.exports = Utils;
