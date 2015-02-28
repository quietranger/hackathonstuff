var Backbone = require('backbone');
var Q = require('q');
var Handlebars = require('hbsfy/runtime');
var trendingListTmpl = require('../templates/trendingList.handlebars');
var trendingListRoomTmpl = require('../templates/trendingListRoom.handlebars');
var trendingListPeopleTmpl = require('../templates/trendingListPeople.handlebars');

module.exports = Backbone.View.extend({
	className: "trending-list",
	events: {
		// 'click .do-im': 'onIMButton',
		// 'click .do-follow': 'onFollowButton',
		'click .join-room': 'joinRoom',
		'click .open-room': 'openRoom',
		'click .person': 'showProfile'
	},
	initialize: function(opts) {
		this.opts = opts || {};
		this.sandbox = this.opts.sandbox;
		// this.opts.trendingData is required to populate the list
	},
	render: function() {
		var renderOpts = {
			trendingData: this.opts.trendingData,
			entityName: this.opts.entityName,
			entityUnit: this.opts.entityUnit
		};
		switch (this.opts.listType) {
			case "room":
				this.$el.html(trendingListRoomTmpl(renderOpts));
				break;
			case "people":
				this.$el.html(trendingListPeopleTmpl(renderOpts));
				break;
			case "keyword":
			default:
				this.$el.html(trendingListTmpl(renderOpts));
				break;
		}

		return this;
	},
	destroy: function() {
		this.remove();
	},
	showProfile: function(e) {
		var id = $(e.currentTarget).attr('data-userid');
		this.sandbox.publish('view:show', null, {
			module: 'profile',
			userId: id
		});
	},
	joinRoom: function(e) {
		var threadId = $(e.currentTarget).attr('data-threadid');
		var self = this;
		this.sandbox.send({
			id: 'GET_ROOM_MANAGER',
			payload: {
				action: 'adduser',
				threadid: threadId,
				userid: this.opts.userId
			}
		}).then(function() {
			$(e.currentTarget).removeClass('join-room').addClass('open-room').find('span').text('Open');
		}, function() {
			$(e.currentTarget).addClass('error').find('span').text('Error');
			return; //todo errors
		});
	},

	openRoom: function(e) {
		var threadId = $(e.currentTarget).attr('data-threadid');
		this.sandbox.publish('view:show', null, {
			'streamId': threadId,
			'module': 'chatroom'
		});
	}
});