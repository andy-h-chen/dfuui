module.exports = function(mongoose) {
    var validator = require('../../lib/validator'),
        Schema    = mongoose.Schema,
        Status;
    Status = new Schema({
        statusType  :  {
            type     : String,
            required : true
        },
        dfuId : {
            type     : Number,
            required : true
        },
        streamId: {
            type: Number
        },
        value: {
            type: Number
        },
        max: {
            type: Number
        },
        date: {
            type: Date,
            default: Date.now
        }
    }, {collection: 'status'});

    Status.statics.findByDfuId = function findByDfuId(dfuId, callback) {
        mongoose.model('Status').find().where('dfuId', dfuId).exec(callback);
    };
    Status.set('toObject', {getters: true});
    return mongoose.model('Status', Status);
}
