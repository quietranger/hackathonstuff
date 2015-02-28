var BASE_LOGIN_URL = process.env.LOGIN_URL;

module.exports = {
    loginUrl: BASE_LOGIN_URL + '/username_password',
    saltUrl: BASE_LOGIN_URL + '/salt',
    checkAuthUrl: BASE_LOGIN_URL + '/checkauth',
    forgotPasswordUrl: BASE_LOGIN_URL + '/emailresetpassword',
    resetPasswordUrl: BASE_LOGIN_URL + '/resetpassword'
};
