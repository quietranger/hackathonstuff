if (typeof window === 'undefined') {
    self.window = self; //test if in web worker
}

var Algos = require('./cryptoLib/algos');
var Utils = require('./cryptoLib/utils');
var Convenience = require('./cryptoLib/convenience');

var CryptoLib = Algos;

CryptoLib.Utils = Utils;
CryptoLib.Convenience = Convenience;

module.exports = CryptoLib;
