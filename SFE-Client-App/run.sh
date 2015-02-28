#! /bin/bash

npm install
DISABLE_CRYPTO=true ENABLE_SELF_SERVE=true ENABLE_EMAIL_NOTIFICATIONS=true WEBCONTROLLER_URL=https://dev6-webcontroller.symphony.com/webcontroller gulp watch
