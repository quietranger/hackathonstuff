var newVersionView = require('../views/newVersion');

var versionCheck = function(sandbox, transport, dataStore) {
    this.transport = transport;
    this.dataStore = dataStore;
    this.sandbox = sandbox;

    this.versionMajor = /^([0-9]{1,})\./;
    this.versionMinor = /\.([0-9]{1,})\./;
};

versionCheck.prototype.startChecking = function() {
    setTimeout (this.checkVersion.bind(this), 60000); //once a minute
};

versionCheck.prototype.stopChecking = function() {

};

versionCheck.prototype.checkVersion = function() {
    var self = this;

    this.transport.send({
        'id': 'APP_VERSION'
    }).done(function(rsp){
        var currentVersion = self.dataStore.get('app.version');

        if(!currentVersion) {
            self.dataStore.upsert('app.version', rsp.currentVersion);
            self.startChecking();
            return;
        }


        if(currentVersion === rsp.currentVersion) {
            self.startChecking();
            return;
        }
        /*
         From http://semver.org/

         Given a version number MAJOR.MINOR.PATCH, increment the:

         MAJOR version when you make incompatible API changes,
         MINOR version when you add functionality in a backwards-compatible manner, and
         PATCH version when you make backwards-compatible bug fixes.
         */

        if(currentVersion !== rsp.currentVersion) {
            // Is the new version a MAJOR or MINOR/PATCH?

            var isMajor = true; // by default in case there's a problem parsing
            try {
                //if (currentVersion.slice(currentVersion.lastIndexOf('.')+1) === rsp.currentVersion.slice(rsp.currentVersion.lastIndexOf('.')+1)) { // Minor or patch
                if (currentVersion.match(self.versionMajor)[1] === rsp.currentVersion.match(self.versionMajor)[1] &&
                    currentVersion.match(self.versionMinor)[1] === rsp.currentVersion.match(self.versionMinor)[1]) { // Minor or patch
                    isMajor = false;
                }
            } catch (err) {
                // if this fails, who cares. We're defaulting to a MAJOR release and forcing an update
            }
            if (isMajor) {
                self.sandbox.publish('app:kill', null, {
                    'reason': 'version change'
                });
                // TODO change newVersionView to automatically restart in 30s
                //note we dont resume checking
                self.sandbox.publish('modal:show', null, {
                    title: 'Update Available',
                    closable: false,
                    contentView: new newVersionView({
                        sandbox: self.sandbox,
                        isMajor: isMajor
                    })
                });
            } else {
                // It's a minor upgrade
                // Show an icon to demonstrate that something is available
                self.startChecking(); //this should continue checking in case another major update comes out.
            }
        }
    }, function(rsp) {
        //todo error checking version...
        self.startChecking();
    });
};

versionCheck.prototype.promptUpdate = function() {

};

module.exports = versionCheck;
