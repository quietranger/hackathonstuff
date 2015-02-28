var baseFilterView = require('../../common/baseFilter/index');

module.exports = baseFilterView.extend({
    didGetInitialQuery: function(rsp) {
        var results = this.initialResults = rsp.queryResults[0];

        if (_.isEmpty(results.socialMessages)) {
            this.opts.isEmpty = true;
        } else {
            var department;
            try { //in case deptCode or other attributes are missing
                department = results.socialMessages[0].message.attributes.deptCode;
            } catch(e) {}

            if (department) {
                this.opts.department = department;
                this.opts.name = this.opts.name + ' - ' + department;
            }
        }

        this.render();
    },

    changeName: function(name) {
        this.opts.name = name;
        var department = this.opts.department;

        if (department) {
            name = name + ' - ' + department;
        }

        this.$el.find('header h2 span.name').text(name);
    }
});