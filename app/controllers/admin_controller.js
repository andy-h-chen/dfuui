var v1          = '/api/v1',
    express     = require('express'),
    utils       = require('../../lib/utils'),
    _           = require('underscore'),
    fs          = require('fs'),
    NotFound    = utils.NotFound,
    checkErr    = utils.checkErr,
    AdminController;

AdminController = function(app, mongoose, passport) {
   app.get(v1 + '/admin/status', app.canAccessAdmin, function(req, res, next) {
        app.sioStatus(function(clients) {
            var clientList = [];
            clients.forEach(function(client, index, array) {
                clientList.push({
                    username: client.user.username,
                    lastRequest: client.lastRequest,
                    address: client.conn.remoteAddress,
                    loginTime: client.handshake.time});
            });
            res.json(clientList);
        });
    });

    app.get(v1 + '/admin/dailylogs', app.canAccessAdmin, function(req, res, next) {
        fs.readdir(__dirname + '/../../logs', function(err, items) {
            res.json(items);
        });
    });
};

module.exports = AdminController;
