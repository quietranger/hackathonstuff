var Symphony = require('symphony-core');

var helloWorldTmpl = require('../templates/helloWorld.handlebars');

module.exports = Symphony.Module.extend({
	//namespace your css to this unique class name
    className: 'hello-world module',

    //regular backbone events hash
    events: {
		'click .get-account-data' 	: 'getAccountData',
		'click .set-client-data' 	: 'setClientData',
		'click .get-client-data'	: 'getClientData'	
    },

	//any sandbox pubsub events you wish to subscribe to by default
    psEvents: {
        
    },

	//displays on the header of the module inside the client
    moduleHeader: '<h2>Hello World</h2>',

	//render automatically called by Symphony Core
    render: function () {
        this.$content.html(helloWorldTmpl());
        
        return Symphony.Module.prototype.render.call(this);
    },

    postRender: function() {
        // raise a pubSub event to focus this module once it is rendered
        this.sandbox.publish('view:focus:requested', null, {
            viewId: this.viewId
        });
        
        return Symphony.Module.prototype.postRender.apply(this, arguments);
    },
    
    //retrieve the current user's account information
    getAccountData: function () {
    	var self = this;
    	
    	this.sandbox.getData('app.account').then(function (rsp){ //sandbox methods return a promise
            //append the results to a textarea
            self.$content.find('.output').text(JSON.stringify(rsp));
    	}, function(){
    		//error callback if the promise is rejected
    	});
    },
    
    //persist arbitrary data to the server
    setClientData: function () {
    	var dataToPersist = {'myData': true, 'foobar': 'hello world!'};
    
   		this.sandbox.setData('documents.helloworld', dataToPersist).then(function (rsp) {
   			//any setData call that begins with 'documents.' will be persisted
   		}, function(){
   			//error callback
   		});
    },
    
    //retrieve arbitrary data from the server
    getClientData: function () {
        var self = this;

    	this.sandbox.getData('documents.helloworld').then(function(rsp){
			//retrieving previously persisted data
    		self.$content.find('.output').text(JSON.stringify(rsp));
    	}, function(){
    		//promise rejected
    	});
    },

	//remember to clean up once youre done
    destroy: function() {
        Symphony.Module.prototype.destroy.call(this);
    }
});