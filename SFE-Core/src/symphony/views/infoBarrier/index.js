var Backbone = require('backbone');
var infoBarrierTmpl = require('./infoBarrier');
var Spin = require("spin");

module.exports = Backbone.View.extend({
    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.$el.attr('id', 'infobarrier-alert');
        this._spinner = new Spin({
            color: '#fff',
            lines: 12,
            radius: 5,
            length: 6,
            width: 2,
            top: "50%",
            left: "50%"
        });
    },
    events: {
        'click .compliance-info' :      'showComplianceInfo',
        'click .close' :                'close',
        'click .submit'  :              'submit'
    },
    render: function() {
        this.$el.append(infoBarrierTmpl({
            'isRoom': this.opts.isRoom
        }));
        this._spinner.spin();
        this.$el.find('.spinner').html(this._spinner.el);
        return this;
    },
    showComplianceInfo: function(e) {
        var $target = $(e.currentTarget);
        var opts = {
            fnName: 'openLink',
            param: {url: $target.attr('href')}
        };
        this.sandbox.publish('appBridge:fn', null, opts);
        e.preventDefault();
    },
    submit: function() {
        if(this.isSending) {
            return;
        }
        var self = this,
            $statusBox = this.$el.find('.status-box');

        this.disableInput();
        this.isSending = true;

        this.sandbox.send({
            'id': 'EXCEPTION_REQUEST',
            'payload': {
                'submitterId':  this.opts.requestorId,
                'threadId':     this.opts.threadId,
                'reason':       this.$el.find('.exception-text').val()
            }
        }).then(function(){
            self.enableInput();
            $statusBox.addClass('success').removeClass('hidden fail').text('Successfully sent information barrier exception request.');
        }, function(rsp){
            self.enableInput();
            if(rsp.statusText) {
                $statusBox.addClass('fail').removeClass('hidden success').text(rsp.statusText)
            } else {
                $statusBox.addClass('fail').removeClass('hidden success').text('There was an error processing the request.');
            }
        });
    },
    disableInput: function() {
        this.$el.find('.exception-text').prop('disabled', true);
        this.$el.find('.spinner').removeClass('hidden');
    },
    enableInput: function() {
        this.$el.find('.exception-text').prop('disabled', false);
        this.$el.find('.spinner').addClass('hidden');
        this.isSending = false;
    },
    close: function() {
        this.sandbox.publish('modal:hide');
    }
});