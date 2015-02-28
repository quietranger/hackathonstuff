var Q = require('q');
var Backbone = require('backbone');
var UpdateAvatarModal = require('../../../src/js/modules/header/views/modals/updateAvatarModal');
var config = require('../../../src/js/config/config');

var sandbox = require('../../mocks/sandboxMock');

var testImage = require('../../fixtures/testImage');

function b642blob(b64) {
    var byteChars = window.atob(b64),
        bytes = new Array(byteChars.length);

    for (var i = 0; i < byteChars.length; i++) {
        bytes[i] = byteChars.charCodeAt(i);
    }

    bytes = new Uint8Array(bytes);

    return new Blob([ bytes ]);
}

describe("The update avatar modal", function() {
    var m, q, qA, oldFileReader = window.FileReader, file = b642blob(testImage.split(',')[1]);

    beforeEach(function(done) {
        q = Q.defer();
        qA = Q.defer();

        sandbox.send.and.returnValue(q.promise);

        sandbox.getData.and.returnValue(qA.promise);
        spyOn(FormData.prototype, 'append');

        window.FileReader = $.noop;
        window.FileReader.prototype.readAsDataURL = function() {
            this.onload({
                target: {
                    result: testImage
                }
            });
        };

        qA.resolve(1); //user id

        /**
         * Stub out the validator since true blobs don't work with Phantom
         */
        spyOn(UpdateAvatarModal.prototype, 'validateFile').and.returnValue('VALID');

        m = new UpdateAvatarModal({
            sandbox: sandbox,
            eventBus: _.extend({}, Backbone.Events),
            file: file
        });

        qA.promise.done(done);

        m.$el.appendTo('body');
    });

    describe("validating the uploaded file", function() {
        beforeEach(function() {
            UpdateAvatarModal.prototype.validateFile.and.callThrough();
        });

        it("should disallow files over 10MB", function() {
            m.file = {
                name: 'honk.jpg',
                size: 10e6 + 1
            };

            expect(m.validateFile()).toBe('TOO_LARGE');
        });

        it("should disallow files that aren't in the config.VALID_AVATAR_FILE_EXTENSIONS array", function() {
            m.file = {
                name: 'honk.tiff',
                size: 10000
            };

            expect(m.validateFile()).toBe('INVALID');
        });

        it("should allow files that are in the config.VALID_AVATAR_FILE_EXTENSIONS array", function() {
            var extensions = config.VALID_AVATAR_FILE_EXTENSIONS;

            for (var i = 0; i < extensions.length; i++) {
                var ext = extensions[i];

                m.file = {
                    name: 'honk.' + ext,
                    size: 10000
                };

                expect(m.validateFile()).toBe('VALID');
            }
        });
    });

    it("should throw an error if file is undefined", function() {
        expect(function() {
            new UpdateAvatarModal({
                sandbox: sandbox,
                eventBus: {}
            });
        }).toThrow();
    });
    
    it("should display a spinner while scripts are loading", function() {
        m.render();

        expect(m.$el.find('.spinner').length).toBe(1);
    });

    describe("when scripts are loaded", function() {
        beforeEach(function(done) {
            m.dependenciesPromise.done(done); //calls render internally
        });

        it("should hide the spinner", function() {
            expect(m.$el.find('.spinner').length).toBe(0);
        });
    });

    describe("when the image file is loaded", function() {
        var $img;

        beforeEach(function(done) {
            m.dependenciesPromise.done(function() {
                $img = m.$el.find('img').eq(0);

                done();
            });
        });

        it("should show the image", function() {
            expect($img.attr('src')).toBe(testImage);
        });

        it("should resize the image to a maximum width of 480 pixels", function() {
            expect($img.width()).toBe(480);
        });

        describe("and the cropper is loaded", function() {
            beforeEach(function(done) {
                _.defer(done);
            });

            it("should add a cropper", function() {
                expect(m.$el.find('.cropper-container').length).toBe(1);
            });

            it("should get crop data from the cropper", function() {
                expect(m.cropData).not.toBeNull();
            });
        });
    });

    describe("then _didCropArea function", function() {
        it("should floor the data", function() {
            m._didCropArea({
                xCoordinate: 1.1,
                yCoordinate: 1.5,
                size: 10.8
            });

            expect(m.cropData).toEqual({
                xCoordinate: 1,
                yCoordinate: 1,
                size: 10
            });
        });
    });

    describe("saving the avatar", function() {
        beforeEach(function(done) {
            m.dependenciesPromise.done(function() {
                m.cropData = {
                    x: 0,
                    y: 0,
                    width: 100
                };

                m.saveAvatar();

                done();
            });
        });

        // for some reason this fails in PhantomJS on the server
        it("should send the form data to the backend", function() {
            expect(FormData.prototype.append).toHaveBeenCalledWith('xCoordinate', jasmine.any(Number));
            expect(FormData.prototype.append).toHaveBeenCalledWith('yCoordinate', jasmine.any(Number));
            expect(FormData.prototype.append).toHaveBeenCalledWith('size', jasmine.any(Number));
            expect(FormData.prototype.append).toHaveBeenCalledWith('file', file);

            expect(sandbox.send).toHaveBeenCalledWith({
                id: 'UPDATE_AVATAR',
                payload: jasmine.any(FormData)
            });
        });

        it("should show a spinner", function() {
            expect(m.$el.find('.spinner').length).toBe(1);
        });

        describe("and the data is successfully saved", function() {
            var images;

            beforeEach(function(done) {
                q.promise.done(done);

                images = {
                    '50': 'url',
                    '150': 'url',
                    '300': 'url'
                };

                q.resolve({
                    data: images
                });
            });

            it("should update the dataStore", function() {
                expect(sandbox.setData).toHaveBeenCalledWith('app.account.images', images);
            });

            it("should publish an avatar change", function() {
                expect(sandbox.publish).toHaveBeenCalledWith('avatar:change', null, {
                    userId: 1,
                    images: images
                });
            });

            it("should close the modal", function() {
                expect(sandbox.publish).toHaveBeenCalledWith('modal:hide');
            });
        });

        describe("and the data fails to save", function() {
            beforeEach(function(done) {
                q.reject({
                    status: 422
                });

                q.promise.fail(done);
            });

            it("should hide the spinner on failure", function(done) {
                q.promise.finally(function() {
                    _.defer(function() {
                        expect(m.$el.find('.spinner').length).toBe(0);

                        done();
                    });
                });
            });

            it("should show an error message", function() {
                var message = m.$el.find('.alert-box').text();

                expect(message.match(/invalid/i)).not.toBeNull();
            });
        });
    });

    afterEach(function() {
        window.FileReader = oldFileReader;
    });
});