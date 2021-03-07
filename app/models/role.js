module.exports = function(mongoose) {
    var validator = require('../../lib/validator'),
        Schema    = mongoose.Schema,
        Role;

    Role = new Schema({
        name  :  {
            type     : String,
            required : true
        },
        permissions_id: [{type: mongoose.Schema.Types.ObjectId, ref: 'Permission'}]
    }, {collection: 'roles'});

    Role.statics.findById = function findById(id, details, callback) {
        console.log(id);
        var Model = mongoose.model('Role'),
            Permission = mongoose.model('Permission'),
            query = Model.find();

        if (id.length !== 24) {
            callback(null, null);
        } else {
            if (details) {
                Model.findOne().where('_id', id).exec(function(err, role) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    Permission.find().exec(function (err, perms) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        var r = role.toObject(),
                            p = perms.map(function(perm) {
                                return perm.toObject();
                            });
                        for(var i=0; i<p.length; i++) {
                            for (var j=0; j<r.permissions_id.length; j++) {
                                if (r.permissions_id[j] == p[i]._id.toString()) {
                                    p[i].allow = true;
                                    break;
                                }
                            }
                        }
                        r.perms = p;
                        callback(null, r);
                    });
                });
            } else {
                Model.findOne().where('_id', id).exec(callback);
            }
        }
    };
    Role.set('toObject', {getters: true});
    return mongoose.model('Role', Role);
}
