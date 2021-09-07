## What's this?

This is DFU mobile UI, build with jQuery, Backbone, RequireJS and Twitter Bottstrap on the frontend, and socket.io, Express.js and Mongoose on th backend.
Part of this code is borrowed from Alexandru Vladutu's demo project(https://github.com/alessioalex/ClientManager).

## Setup

- Host multiple domain - https://github.com/virtkick/http-master. 
- http-master needs to restart after certificate updated.
- Sample http-master.config is at `docs/http-master.conf`.
- Allow nodejs to listen port 80 from this app:

    `sudo apt-get install libcap2-bin`

    `sudo setcap cap_net_bind_service=+ep /usr/bin/nodejs`

- If you want to directly serve the domain from this app, you need to create folder `ssl` for https certificates.

    File names are: `cert1.pem  chain1.pem  fullchain1.pem  privkey1.pem`

- Setup `config/environments/development.json`
- Install `forever`, `jake`
- Run `npm install` to install project dependencies
- Setup mongo database. See documents in `docs/`.
- Run `jake app:assets`

## Access RTCMulticonnection admin

- Login using `admin`
- Copy the token from url
- Go to < domain name >/rtcmulticonnection-admin/
- Add `?token=<token>`
