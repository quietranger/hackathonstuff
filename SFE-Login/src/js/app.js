global.$ = require('jquery');
global._ = require('underscore');

var Backbone = require('backbone');
Backbone.$ = global.$;

$.ajaxSetup({
  xhrFields: {
    withCredentials: true
  },
  dataType: 'json'
});

var Main = require('./modules/main');

$(document).ready(function() {
  var app = new Main();

  app.start();
});