## What's this?

This is DFU mobile UI, build with jQuery, Backbone, RequireJS and Twitter Bottstrap on the frontend, and socket.io, Express.js and Mongoose on th backend.
Part of this code is borrowed from Alexandru Vladutu's demo project(https://github.com/alessioalex/ClientManager).

## Setup

- Host multiple domain - https://github.com/virtkick/http-master. 
- http-master needs to restart after certificate updated.
- Sample http-master.config is at docs/http-master.conf.
- Allow nodejs to listen port 80 from this app:

    sudo apt-get install libcap2-bin

    sudo setcap cap_net_bind_service=+ep /usr/bin/nodejs

- If you want to directly serve the domain from this app, you need to create folder ssl for https certificates.

    File names are: `cert1.pem  chain1.pem  fullchain1.pem  privkey1.pem`

- Setup config/environments/development.json
- Run `jake app:assets`

## Quick start

- Make sure Node.js and NPM should be installed (I prefer to do it using NVM). This project was developed on Node 0.6.x.
- Install project dependencies with NPM by running the following command in the terminal (project root): 

    npm install .

- Configure the ports for the application (for multiple environments: dev, test, production) and also the settings for the MongoDB connection (you can either host MongoDB locally or try a free hosting provider such as MongoLab). The config data is in /config
- Start mongo db
  sudo service mongod start (mongod --config /etc/mongod.conf)
  If it does not start, a) try sudo b) delete /var/log/mongodb/mongod.log

- Start the server:

  a) Production

    npm start 

  b) Development (note that if you want to load all the files uncompressed you should visit http://&lt;server&gt;:&lt;port&gt;/dev.html):

    node app.js

- Sample config file
{
    "HTTPS"       : false,
    "HOST"        : "127.0.0.1",
    "PORT"        : 80,
    "WS"          : 8080,
    "RPROXY_PORT" : 4041,
    "SMTP"        : "smtp.gmail.com",
    "SMTP_PORT"   : 3456,
    "SMTP_USER"   : "sample@gmail.com",
    "SMTP_PASS"   : "password",
	"DEFAULT_EMAIL_SENDER": "noreply@gmail.com",
    "URL"         : "http://sample.net",
    "V1_LOGIN"    : "/api/v1/auth/login",
    "JWT_SECRET"  : "dfuui secret",
    "SALT"        : "83d88386463f0623",
    "DEMO"        :
    {
        "user"   : "demo@gmail.com",
        "pass"   : "password"
    }
}

- Create self signed certificates
See self_signed_cert.txt

## App structure

The application has a structure similar to Rails:

- the model and controller folders are within '/app'
- the configuration stored into json files in '/config'.
- public directory for the server: '/public'
- logs are kept into their own '/logs' folder, having one file per environment
- '/lib' is where application specific files reside
- all backend test files are inside '/test', structured into: unit tests ('/unit'), functional tests ('/functional') and the fixtures
- the Jakefile: similar to make or rake, can run tasks

Frontend:

- the '/js' folder is where the 'magic' happens: '/main.js' is the starting point (stores RequireJS configuration), which calls '/app' (that deals with the initialization for the application), the rest of the foldes are self-explanatory
- '/css' and '/img' stores the static stylesheets and images needed
- '/test' has the logic for the test runner (with Mocha), and specs

## Dev gotchas with Jake (in the terminal)

Empty the database:

    jake db:empty

Populate database with data:
    
    jake db:populate[20]

That will empty db and insert 20 new records).

Compress & concatenate assets (one file for JS & one file for CSS):

    jake app:assets

