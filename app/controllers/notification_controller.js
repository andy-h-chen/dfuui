var webPush = require('web-push'),
    NotificationController;

NotificationController = function(app, config) {
	var subscribers = [];
	var VAPID_SUBJECT = config.URL,
		VAPID_PUBLIC_KEY = config.VAPID_PUBLIC_KEY,
		VAPID_PRIVATE_KEY = config.VAPID_PRIVATE_KEY,
		AUTH_SECRET = config.JWT_SECRET;
	webPush.setVapidDetails(
		VAPID_SUBJECT,
		VAPID_PUBLIC_KEY,
		VAPID_PRIVATE_KEY
	);
	app.post('/subscribe', function (req, res) {
		var endpoint = req.body['notificationEndPoint'],
			publicKey = req.body['publicKey'],
			auth = req.body['auth'];
		
		var pushSubscription = {
			endpoint: endpoint,
			keys: {
				p256dh: publicKey,
				auth: auth
			}
		};
		
		subscribers.push(pushSubscription);

		res.send('Subscription accepted!');
	});
	
	app.get('/notify/all', function (req, res) {
		/*
		if(req.get('auth-secret') != AUTH_SECRET) {
			console.log("Missing or incorrect auth-secret header. Rejecting request.");
			return res.sendStatus(401);
		}*/
		
		var message = req.query.message,
		    clickTarget = req.query.clickTarget,
		    title = req.query.title;

		subscribers.forEach(pushSubscription => {
			//Can be anything you want. No specific structure necessary.
			let payload = JSON.stringify({message : message, clickTarget: clickTarget, title: title});
			console.log('pushSubscription', pushSubscription);
			webPush.sendNotification(pushSubscription, payload, {}).then((response) =>{
				//console.log("Status : "+util.inspect(response.statusCode));
				//console.log("Headers : "+JSON.stringify(response.headers));
				//console.log("Body : "+JSON.stringify(response.body));
				console.log(response);
			}).catch((error) =>{
				console.log(error);
				//console.log("Status : "+util.inspect(error.statusCode));
				//console.log("Headers : "+JSON.stringify(error.headers));
				//console.log("Body : "+JSON.stringify(error.body));
			});
		});
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});
		res.send('Notification sent!');
	});
};

module.exports = NotificationController;