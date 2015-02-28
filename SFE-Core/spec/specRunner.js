var Backbone = require('backbone');

global._ = require('underscore');
global.$ = require('jquery');
Backbone.$ = global.$;

require('./symphony/viewSpec');
require('./symphony/moduleSpec');
require('./symphony/mixins/subscribableSpec');
require('./symphony/mixins/tooltipableSpec');
require('./symphony/mixins/aliasableSpec');
require('./symphony/mixins/hasPresenceSpec');
require('./symphony/utils/prefixEventsSpec');
require('./symphony/extensions/ajaxSpec');
require('./symphony/extensions/modalSpec');
require('./symphony/extensions/sandboxSpec');
require('./symphony/extensions/transportSpec');
require('./symphony/extensions/dataStoreSpec');
require('./symphony/extensions/loggerSpec');
require('./symphony/extensions/presenceSpec');
require('./symphony/extensions/cronJobsSpec');
require('./symphony/extensions/cryptoSpec');
require('./symphony/extensions/longPollSpec');
require('./symphony/coreSpec');
