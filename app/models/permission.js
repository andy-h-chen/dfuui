module.exports = function(mongoose) {
    var validator = require('../../lib/validator'),
        Schema    = mongoose.Schema,
        Permission;

    Permission = new Schema({
        name  :  {
            type     : String,
            required : true
        },
        key : {
            type     : String,
            unique   : true,
            required : true
        }
    }, {collection: 'permissions'});

    Permission.statics.findById = function findById(id, callback) {
        console.log(id);
        var Model = mongoose.model('Permission'),
            query = Model.find();

        if (id.length !== 24) {
            callback(null, null);
        } else {
            Model.findOne().where('_id', id).exec(callback);
        }
    };
    Permission.set('toObject', {getters: true});
    return mongoose.model('Permission', Permission);
}
