module.exports = {
    APP_SETTINGS: {
        PERMISSIONS: {
            ADD_DELEGATE: {
                ALREADY_DELEGATE: ' is already a delegate.',
                NO_AUTHORITY: 'You do not have the authority to grant delegate permissions.'
            },
            REMOVE_DELEGATE: 'Could not remove delegate: '
        },
        SHARED_ACCOUNTS: {
            ADD_OWNER: {
                ALREADY_DELEGATE: ' is already a delegate.',
                ERROR_ADDING: 'Could not add owner: ',
                OWNER_INFORMATION_ERROR: 'Could not get owner information: '
            },
            REMOVE_OWNER: 'Could not remove owner: '
        }
    },
    CHANGE_LOG: {},
    CHANNEL: {},
    CHATROOM: {
        ERROR_RENDERING_ROOM: 'Error when rendering Chatroom: ',
        DEACTIVATE_ROOM: 'Could not deactivate room. Please try again.',
        MANAGE_MEMBERSHIP: {
            NO_THREAD_ID: 'Manage members view instantiated without thread ID.',
            FETCH_FAIL: 'Fetching room membership failed. Please try again.',
            ADD_SELF: 'You cannot re-add yourself to your own chatroom.',
            ADD_MEMBER: 'Could not add member. Please try again.',
            REMOVE_MEMBER: 'Could not remove user. Please try again.',
            SET_ROOM_OWNER: 'Could not set room ownership. Please try again.'
        },
        SETTINGS: {
            ROOM_DESCRIPTION: 'Could not save changes. Room description cannot be empty.',
            VIEW_CONFIG: 'Could not save view config. Please try again.'
        }
    },
    COMMON: {
        ALIAS_COLOR_CODE_PICKER: {},
        BASE_FILTER: {
            DEACTIVATION_PROMPT: 'Could not deactivate filter. Please try again.',
            EDIT: {
                RESOLVE_USERS: 'Error resolving users.',
                RESOLVE_USERS_TWITTER: 'Error resolving Twitter users.',
                FILTER_NAME: 'Filter name cannot be empty.',
                SAVE_ERROR: 'Could not save this filter. Please make sure that at least one rule is selected and that you select users from the drop-down only. Keywords can only contain letters, numbers, and underscores.',
                SAVE_SETTINGS: 'Could not save settings. Please try again.',
                SAVE_KEYWORDS: 'Could not save new keywords. Please try again.'
            },
            SETTINGS: {
                VIEW_CONFIG: 'Could not save view config. Please try again.'
            }
        },
        BASE_MESSAGES: {
            LOAD_ERROR: 'Can\'t load messages... Something went wrong'
        },
        BASE_STATIC_FILTER: {
            ADD_ENTITY: {
                BLANK: 'The search field cannot be left blank.',
                USER_FROM_AUTOCOMPLETE: 'Please choose a user to follow from the autocomplete menu.',
                INVALID: 'Your entry was invalid. Please enter a different value and try again.',
                EXISTING_USER: ' already exists.',
                COULD_NOT_SAVE_USER: 'Could not save '
            },
            DELETE_ENTITY: 'Deletion failed. Please try again.'
        },
        CHAT_MESSAGE_LIST: {
            LOAD_ERROR: 'Can\'t load messages... Something went wrong',
            LOAD_MESSAGE_CONTEXT: 'Could not fetch message.'
        },
        CONTEXTUAL_CHAT_MESSAGE_LIST: {
            LOAD_MESSAGE_CONTEXT: 'Could not fetch message context.'
        },
        EXTERNAL_SOCIAL_MESSAGE_LIST: {
            LOAD_ERROR: 'Can\'t load messages... Something went wrong'
        },
        FILTER_SOCIAL_MESSAGE_LIST: {
            LOAD_ERROR: 'Can\'t load messages... Something went wrong'
        },
        INFO_BARRIER: {
            IB_ERROR: 'Information Barrier Violation: The action you are trying to perform involves individuals who are subject to a Compliance-defined information barrier that restricts communication.  Limited business-critical exceptions may be granted and will require business management and divisional Compliance approval.  If you would like to request an exception, please click <a class="link" target="_blank" href="http://home.gs.com/gsweb/gsc/freeFormPage?nodeID=266169">here.</a>. For questions regarding this Compliance-defined information barrier restriction, please contact your divisional Compliance officer.'
        },
        INLINE_PROFILE: {},
        MODAL: {},
        NEW_VERSION: {},
        NOT_PROVISIONED: {},
        PERSON_LIST: {},
        POPOVER: {},
        SOCIAL_MESSAGE_LIST: {
            LOAD_ERROR: 'Can\'t load messages... Something went wrong'
        },
        STATIC_CONTENT: {},
        TEMPLATES: {
        },
        TEXT_INPUT: {
            JOIN_ROOM: 'Join failed. Retry?',
            UPLOAD: {
                NO_FILE_TYPE: 'No file type found.',
                FILE_TYPE_SUPPORT: 'File type not supported.',
                UPLOAD_FAILED: 'File upload failed.'
            }
        },
        UNAUTHORIZED: {},
        UPLOAD_AGREEMENT: 'Content on Symphony may be public and broadly visible to/shared across the entire firm. Before proceeding you must confirm that any content contained in this upload is suitable for the audience with whom you are sharing it, does not violate the firm\'s confidentiality policies, and is consistent with guidelines regarding the proper use of firm communication.'
    },
    FILTER: {},
    FOLLOWING: {},
    FTUE: {},
    GO: {
        BLAST: {},
        FILTER: {},
        IM: {
            ERROR: 'An error occured. Please try again.'
        },
        CHATROOM: {
            ERROR: 'Could not create room.'
        }
    },
    HASHTAG_CONTEXT: {
        LOAD_ERROR: 'Can\'t load messages... Something went wrong'
    },
    HEADER: {},
    //TODO: remove this after IM & Chatroom is merged
    IM: {
        ERROR_RENDERING: 'Error when rendering IM: ',
        SETTINGS: {
            VIEW_CONFIG: 'COuld not save view config. Please try again.'
        }
    },
    KEYWORDS: {},
    LEFT_NAV: {},
    MENTIONS: {},
    MESSAGE_CONTEXT: {},
    MY_DEPARTMENT: {},
    NEW_FEATURES_MODAL: {},
    ON_BEHALF: {
        OBO: '\n Failed to post OBO msg: '
    },
    ORGANIZATIONAL_LEADERS: {},
    PROFILE: {
        PROFILE_VIEW: {
            ERROR_RENDERING: 'Error when rendering '
        },
        ROOM_LIST: {
            JOIN_FAILED: 'Join failed. Retry?'
        }
    },
    RECONNECT: {},
    SEARCH: {
        RESULTS_VIEW: {
            FETCH_ERROR: 'Error fetching results.'
        },
        ROOM_VIEW: {
            JOIN_FAILED: 'Join failed. Retry?'
        }
    },
    TRENDING: {},
    TWITTER_PROFILE: {},
    USER_AGREEMENT: {
        ERROR: 'An error happen when communicate with the server for one time UA Notice. Please retry later.'
    },
    WELCOME_TOUR: {},
    UPDATE_AVATAR_MODAL: {
        IMAGE_ERRORS: {
            INVALID: 'You have chosen an invalid image. Valid images are JPEGs, PNGs, and GIFs under 10MB in size.',
            TOO_LARGE: 'You have chosen an image that is too large for your browser to handle. Please choose one that is under ' +
            '10 MB.'
        }
    }
}
