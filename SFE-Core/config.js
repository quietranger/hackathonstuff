module.exports = {
    CLIENT_ID: 'symphonyPrime',
    LEFTNAV_GROUPS_DOCUMENT_ID: 'leftnavGroups',
    PER_USER_METADATA_DOCUMENT_ID: 'perUserMetadata',
    CLIENT_VERSION: 'DESKTOP',
    LOGIN_PAGE: '/',
    THEMES: [
        {
            name: "Dark Theme",
            key: 'dark',
            version: "1.0.0",
            description: "The default dark theme.",
            config: {
                userColorCodes: ['#b5616a', '#ab8ead', '#96d8fa', '#a3be77', '#91bb4c', '#ebc875', '#995d0f', '#e23030', '#b2b2b2'],
                spinnerColor: '#fff'
            }
        },
        {
            name: "Light Theme",
            key: 'light',
            version: "1.0.0",
            description: "The new light theme.",
            config: {
                userColorCodes: ['#70e28d', '#fbce64', '#e85660', '#b3c1d4', '#f08a49', '#3366cc', '#ec8cbe', '#6633cc', '#29384b'],
                spinnerColor: '#000'
            }
        }
    ],
    RELAY_ENDPOINT: process.env.RELAY_URL,
    API_ENDPOINT: process.env.WEBCONTROLLER_URL,
    SESSION_COOKIE_NAME: 'skey'
};