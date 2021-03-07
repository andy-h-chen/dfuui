module.exports = function(mongoose) {
    var validator = require('../../lib/validator'),
        Schema    = mongoose.Schema,
        Alarm;
    Alarm = new Schema({
        alarmType  :  {
            type     : String,
            required : true
        },
        dfuId : {
            type     : Number,
            required : true
        },
        sendEmail: {
            type: Boolean
        },
        streamId: {
            type: Number
        },
		alarmId: {
			type: Number
		},
		clipUrl: {
			type: String
		},
        date: {
            type: Date,
            default: Date.now
        },
		viewed: {
			type: Boolean,
			default: false
		},
		snapshot: {
			type: String
		}
    }, {collection: 'alarm'});

    Alarm.statics.findByDfuId = function findByDfuId(dfuId, callback) {
        mongoose.model('Alarm').find({dfuId: dfuId}).sort({date: -1}).limit(10).exec(callback);
    };
	Alarm.statics.findByAlarmId = function(alarmId, callback) {
		mongoose.model('Alarm').find({alarmId: alarmId}).exec(callback);
	};
    Alarm.set('toObject', {getters: true});
    return mongoose.model('Alarm', Alarm);
}
