SFE-Client-App
===

Repository for the main web app. To install the front-end development environment, follow these steps. If you already have the front-end development environment set up, `cd` into your SFE-Client-App repo folder and run `gulp watch`.

1. Install NVM
---

NVM is the Node Version Manager. It allows you to install and manage multiple versions of the Node.js toolchain on one machine. Installation is simple. Run the following commands:

```shell
curl https://raw.githubusercontent.com/creationix/nvm/v0.17.2/install.sh | bash
nvm install 0.10
nvm use 0.10
```

This will install NVM, install Node.js version 0.10, and set the system `$PATH` to Node.js 0.10. To make the NVM version of Node.js your system default, run the following:

```shell
nvm alias default 0.10
```

Otherwise, you will need to run `npm use 0.10` every time you want to build.

2. Updated Your /etc/hosts File
---

Add the following lines to your `/etc/hosts` file:

``
127.0.0.1 local-dev.symphony.com
``

This will allow you to access the client from local-dev.symphony.com. This URL is important, since the backend expect requests to come from a Symphony URL.

3. Clone the Repo
---

`cd` into to your projects folder and run `git clone git@github.com:SymphonyOSF/SFE-Client-App.git`. If you run into problems, make sure that your GitHub account's SSH keys are properly installed both on your machine and in your GitHub account.

4. Install Gulp Globally
---

Gulp is the front-end's build tool. To be able to run Gulp from the command line, you need to install it globally. Run `npm install -g gulp` to do so.


5. Install Dependencies
---

`cd` into the `SFE-Client-App` folder (or whatever folder you cloned the repo into) and run `npm install`. This will install all dependencies from NPM's servers as well as pull the SFE-Core repo from GitHub. SFE-Core contains the common core client code and will throw an authentication error if your SSH keys are not properly configured.

You will need to run `npm install` every time front-end dependencies change.


6. Authenticate with your credentials
---

POST {username: *, password: *} to https://dev-api.symphony.com:8083/login/userlogin to create your session cookie. Alternatively, log into the demo pod at dev.symphony.com.


7. Build the App
---

Finally, run `NODE_EVN=development gulp watch`. This will build the front end and start a small web server that listend on port 3000. You can now access the client app at http://local-dev.symphony.com:3000.
