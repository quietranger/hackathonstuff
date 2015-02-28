var Algos = require('../../src/cryptoLib/algos');

suite('AES', function() {
    var V = {
        A: "/u36zt6tvu/+7frO3q2+76ut2tI=",
        C: "Ui3B8JlWfQf0fzejKoRCfWQ6jNy/5cDJdZiivSVV0aqMsI5IWQ27PaewixBWgog4xfYeY5O6egq8yfZi",
        IV: "yv66vvrO263eyviI",
        K: "/v/pkoZlcxxtao+UZzCDCP7/6ZKGZXMcbWqPlGcwgwg=",
        P: "2TEyJfiEBuWlWQnFr/UmmoanqVMVNPfaLkwwPYoxinIcPAyVlWgJUy/PDiRJprUlsWrt9aoN5le6Y3s5",
        T: "dvxuzg9OF2jN34hTuy1VGw=="
    };

    var realCt = "Ui3B8JlWfQf0fzejKoRCfWQ6jNy/5cDJdZiivSVV0aqMsI5IWQ27PaewixBWgog4xfYeY5O6egq8yfZidvxuzg9OF2jN34hTuy1VGw==";

    benchmark('encryption', function() {
        Algos.AESGCMEncrypt(V.IV, V.A, V.K, V.P);
    });

    benchmark('decryption', function() {
        Algos.AESGCMDecrypt(V.IV, V.A, V.K, realCt);
    });
});

suite('PBKDF2', function() {
    var salt = 'c2FsdA==';

    benchmark('with 10000 iterations', function() {
        Algos.PBKDF2(salt, 10000, 'test');
    });

    benchmark('with 5000 iterations', function() {
        Algos.PBKDF2(salt, 5000, 'test');
    });

    benchmark('with 2500 iterations', function() {
        Algos.PBKDF2(salt, 2500, 'test');
    });
});
