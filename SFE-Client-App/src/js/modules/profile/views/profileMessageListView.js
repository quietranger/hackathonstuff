var SocialMessageList = require('../../common/socialMessageList/index');

module.exports = SocialMessageList.extend({
    loadInitialMessages: function () {
        //for profile, need to get data from backend instead of getting data from datastore
        //because updates in profile page won't be pushed to datastore.
        this.loadMoreMessages();
    }
});
