var Symphony = require('symphony-core');
var Q = require('q');
var _ = require('underscore');
var config = Symphony.Config;

module.exports = {
	URL: {
		realtimeQuery: config.API_ENDPOINT+"api/v3/trend",
		historyQuery: config.API_ENDPOINT+"api/v3/trend"
	},
	doGET: function(opts) {
		return this.makeRequest(opts, 'GET');
	},

	doPOST: function(opts) {
		return this.makeRequest(opts, 'POST');
	},

	makeRequest: function(opts, requestType) {
		return Q.promise(function(resolve, reject, notify) {
			jQuery.ajax({
				type: requestType,
				url: opts.baseUrl,
				data: opts.payload,
				xhrFields: {
					withCredentials: true
				},
				dataType: 'json'
			}).then(function(data, textStatus, jqXHR) {
				resolve(data);
			}, function(jqXHR, textStatus, errorThrown) {
				delete jqXHR.then; // treat xhr as a non-promise

				// if (jqXHR.status === 401) {
				// 	//user not authenticated
				// 	self.sandbox.publish('modal:show', null, {
				// 		title: 'Unauthorized',
				// 		closable: false,
				// 		contentView: new unauthorizedView({
				// 			sandbox: self.sandbox
				// 		})
				// 	});

				// 	self.sandbox.warn('Authorization check failed. User must login.');

				// 	self.sandbox.publish('app:kill', null, {
				// 		'error': 'Unauthorized'
				// 	});
				// }

				// if (jqXHR.status === 403) {
				// 	//user not provisioned
				// 	self.sandbox.publish('modal:show', null, {
				// 		title: 'Not provisioned',
				// 		contentView: new notProvisionedView({
				// 			sandbox: self.sandbox
				// 		})
				// 	});

				// 	self.sandbox.warn('User not provisioned for this application.');

				// 	self.sandbox.publish('app:kill', null, {
				// 		'error': 'Not provisioned'
				// 	});
				// }

				// if (jqXHR.status === 411) {
				// 	//todo this is not tested
				// 	//info barrier error
				// 	self.sandbox.publish('modal:show', null, {
				// 		title: 'Info barrier alert',
				// 		contentView: new infoBarrierView({
				// 			sandbox: self.sandbox,
				// 			msg: jqXHR.responseJSON.message
				// 		})
				// 	});

				// 	self.sandbox.warn('Info barrier alert.');
				// }

				reject(jqXHR);
			});
		});
	}
};
