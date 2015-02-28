var config = require('symphony-core').Config;

module.exports =  {
    GET_ACCOUNT: {
        url: config.API_ENDPOINT + '/maestro/Account',
        requestType: 'GET'
    },

    BOOTSTRAP_UNREAD: {
        url: config.API_ENDPOINT + '/bootstrap',
        requestType: 'GET'
    },

    CHECK_AUTH: {
        url: config.API_ENDPOINT + '/CheckAuth',
        requestType: 'GET'
    },

    UPDATE_CONFIG: {
        url: config.API_ENDPOINT + '/maestro/UserInfo',
        requestType: 'POST'
    },

    QUERY_THREAD_HISTORY: {
        url: config.API_ENDPOINT + "/dataquery/retrieve_message_by_thread",
        requestType: 'GET'
    },

    QUERY_MESSAGE_IN_GAP: {
        url: config.API_ENDPOINT + "/dataquery/Thread",
        requestType: 'GET'
    },

    SHARED_BY: {
        url: config.API_ENDPOINT + "/dataquery/shared_by",
        requestType: 'GET'
    },

    LIKED_BY: {
        url: config.API_ENDPOINT + "/dataquery/liked_by",
        requestType: 'GET'
    },

    SEND_CHAT: {
        url: config.API_ENDPOINT + "/ingestor/MessageService",
        requestType: 'POST',
        payloadType: 'json',
        jsonRoot: 'messagepayload'
    },

    GET_PROFILE: {
        url: config.API_ENDPOINT + '/maestro/UserInfo',
        requestType: 'POST'
    },

    LOG_USAGE: {
        url: config.API_ENDPOINT + "/track_user_event",
        requestType: 'POST'
    },

    SOLR_SEARCH_URL: {
        url: config.API_ENDPOINT + "/search/Search",
        requestType: 'GET'
    },

    QUERY_FILTER: {
        url: config.API_ENDPOINT + '/search/FilterQuery',
        requestType: 'GET'
    },

    MESSAGE_SEARCH: {
        url: config.API_ENDPOINT + '/search/MessageSearch',
        requestType: 'GET'
    },

    FILTER_MANAGER: {
        url: config.API_ENDPOINT + '/maestro/FilterManager',
        requestType: 'GET'
    },

    CREATE_FILTER: {
        //caller of this command should set payload to be the {filter: filter rules}
        url: config.API_ENDPOINT + '/maestro/filters/',
        requestType: 'POST',
        jsonRoot: 'filter'
    },

    DELETE_FILTER: {
        //caller of this command should set urlExtension to be the filterId
        url: config.API_ENDPOINT + '/maestro/filters/',
        requestType: 'DELETE'
    },

    UPDATE_FILTER: {
        //caller of this command should set urlExtension to be the filterId and also set the payload
        url: config.API_ENDPOINT + '/maestro/filters/',
        requestType: 'PUT',
        payloadType: 'json'
    },

    GET_FILTER: {
        //caller of this command should set urlExtension to be the filterId and also set the payload
        url: config.API_ENDPOINT + '/maestro/filters/',
        requestType: 'GET'
    },

    ADD_FOLLOWING: {
        url: config.API_ENDPOINT + '/maestro/followees/',
        requestType: 'POST',
        payloadType: 'json',
        jsonRoot: 'followee'
    },

    DELETE_FOLLOWING:{
        //caller of this command should set urlExtension to be '{connector id}/{followee id}'
        url: config.API_ENDPOINT + '/maestro/followees/',
        requestType: 'DELETE'
    },

    ADD_KEYWORDS: {
        url: config.API_ENDPOINT + '/maestro/keywords/',
        requestType: 'POST'
    },

    DELETE_KEYWORDS:{
        //caller of this command should set urlExtension to be '{connector id}/{keyword id}'
        url: config.API_ENDPOINT + '/maestro/keywords/',
        requestType: 'DELETE'
    },

    GET_FOLLOWERS: {
        //caller of this command should set urlExtension to be 'userid'
        url: config.API_ENDPOINT + '/maestro/followers/',
        requestType: 'GET'
    },

    GET_FOLLOWEES: {
        //caller of this command should set urlExtension to be 'userid'
        url: config.API_ENDPOINT + '/maestro/followees/',
        requestType: 'GET'
    },

    ROOM_MANAGER: {
        url: config.API_ENDPOINT + "/maestro/RoomManager",
        requestType: 'POST'
    },

    GET_ROOM_MANAGER: {
        url: config.API_ENDPOINT + "/maestro/RoomManager",
        requestType: 'GET'
    },

    IM_MANAGER_INFO: {
        url: config.API_ENDPOINT + "/maestro/immanager/info",
        requestType: 'GET'
    },

    IM_MANAGER_USERS: {
        url: config.API_ENDPOINT + "/maestro/immanager/im",
        requestType: 'POST'
    },

    IM_MANAGER_THREAD: {
        url: config.API_ENDPOINT + "/maestro/immanager/im",
        requestType: 'GET'
    },

    USER_RESOLVE: {
        url: config.API_ENDPOINT + "/maestro/UserResolver",
        requestType: 'GET'
    },

    DELEGATE: {
        url: config.API_ENDPOINT + "/maestro/Delegates",
        requestType: 'POST'
    },

    LEGAL_NOTICE: {
        url: config.API_ENDPOINT + "/maestro/LegalNotice",
        requestType: 'POST'
    },

    APP_VERSION: {
        url: "version.json",
        requestType: 'GET'
    },

    GET_PRESENCE: {
        url: config.API_ENDPOINT + "/maestro/UserPresence",
        requestType: 'GET'
    },

    IS_TYPING: {
        url: config.API_ENDPOINT + "/typing",
        requestType: 'POST'
    },

    SEND_READ_RECEIPT: {
        url: config.API_ENDPOINT + '/send_read_receipt',
        requestType: 'POST'
    },

    GET_MESSAGE_READ_STATE: {
        url: config.API_ENDPOINT + '/dataquery/message_status_query',
        requestType: 'GET'
    },

    SHOW_EXTERNAL_USERS: {
        url: config.API_ENDPOINT + '/show_external_users',
        requestType: 'GET'
    },

    GET_MESSAGE_CONTEXT: {
        url: config.API_ENDPOINT + '/search/ContextualSearch',
        requestType: 'POST'
    },

    UPLOAD_FILE: {
        url: config.API_ENDPOINT + '/attachment/upload',
        requestType: 'POST',
        ajaxOpts: {
            contentType: false,
            processData: false,
            dataType: 'json'
        }
    },

    DELETE_FILE: {
        url: config.API_ENDPOINT + '/attachment/delete',
        requestType: 'POST'
    },

    UPLOAD_ALLOWED_TYPES: {
        url: config.API_ENDPOINT + '/attachment/supported_mime_types',
        requestType: 'GET'
    },

    BLAST_MESSAGE: {
        url: config.API_ENDPOINT + '/api/v3/blast',
        requestType: 'POST'
    },

    ADVANCED_SEARCH: {
        url: config.API_ENDPOINT + '/search/advance_search',
        requestType: 'GET'
    },

    GET_USER_RECOMMENDATIONS: {
        url: config.API_ENDPOINT + '/users/me/recommendations/users',
        requestType: 'GET'
    },

    GET_KEYWORD_GROUP_RECOMMENDATIONS: {
        url: config.API_ENDPOINT + '/users/me/recommendations/keywordGroups',
        requestType: 'GET'
    },

    EXCEPTION_REQUEST: {
        url: config.API_ENDPOINT + '/maestro/compliance/room/exceptionrequest',
        requestType: 'POST'
    },

    DEV_INFOBARRIER_VIOLATION: {
        url: config.API_ENDPOINT + '/infobarrier/violate',
        requestType: 'POST'
    },

    UPDATE_AVATAR: {
        url: config.API_ENDPOINT + '/users/me/avatar',
        requestType: 'POST',
        ajaxOpts: {
            processData: false,
            contentType: false
        }
    }
};
