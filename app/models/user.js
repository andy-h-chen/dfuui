module.exports = function(mongoose) {
    var validator = require('../../lib/validator'),
        Schema    = mongoose.Schema,
        User;

    User = new Schema({
        username  :  {
        type     : String,
        lowercase: true,
        trim     : true,
        validate : [validator({
            length: {
                min : 2,
                max : 100
            }
        }), "username"],
        required : true
        },
        email : {
            type     : String,
            validate : [validator({
                isEmail : true,
                length  : {
                    min : 7,
                    max : 100
                }
            }), "email"],
            unique   : true,
            required : true
        },
        password  :  {
            type : String,
            validate : [validator({
                min : 5,
                max : 100
            }), "password"],
            required : true
        },
        lastLogout: {
            type: Date
        },
		subscribers: {
			type: Array,
			default: []
		},
        agentId: {
            type: String,
            default: ''
        },
        dfus_id: [{type: mongoose.Schema.Types.ObjectId, ref: 'Dfu'}],
        roles_id: [{type: mongoose.Schema.Types.ObjectId, ref: 'Role'}],
        perms: [{id: {type:String}, allow: {type: Boolean}, deny: {type: Boolean}, inherit_allow: {type: Boolean}, inherit_deny: {type: Boolean}}],
        all_perms: [{id: {type:String}, key: {type:String}}]
    }, {collection: 'users'});

    // similar to SQL's like
    function like(query, field, val) {
        return (field) ? query.regex(field, new RegExp(val, 'i')) : query;
    }

    User.statics.search = function search(params, callback) {
        var Model = mongoose.model('User');

        //like(query, 'name', params.name);
        //like(query, 'email', params.email);
        var query = params.fields ? Model.find({}, params.fields) : Model.find();

        query.exec(callback);
    };

    User.methods.hasAccess = function (key) {
        if (!key)
            return false;

        for (var i=0; i<this.all_perms.length; i++) {
            if (this.all_perms[i].key == key)
                return true;
        }
        return false;
    };

    User.methods.dfus = function (callback) {
        var Dfu = mongoose.model('Dfu');
        Dfu.find({'_id': {$in: this.dfus_id}}, {dfuId: 1, _id: 0}).exec(callback);
    };

    User.statics.getIdForAllSubAgent = function(agentId, callback) {
        if (agentId === '0') {
            mongoose.model('User').find().exec(callback);
            return;
        }
        var regex = '^' + agentId;
        mongoose.model('User').find({'agentId': new RegExp(regex)}).exec(callback);
    };
    User.statics.findByAgentId = function(agentId, callback) {
      mongoose.model('User').find({'agentId': agentId}).exec(callback);
    };
    User.statics.findById = function findById(id, details, callback) {
        var Model = mongoose.model('User'),
            Role = mongoose.model('Role'),
            Permission = mongoose.model('Permission'),
            query = Model.find();

        if (!id || id.length !== 24) {
            callback(null, null);
        } else {
            if (details) {
                Model.findOne().where('_id', id).populate('roles_id').populate('dfus_id').exec(function (err, user) {
                    Role.find().exec(function(err, roles) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        var u = user.toObject(),
                            r = roles.map(function (role) {
                                return role.toObject();
                            }),
                            p = [];
                        for (var i=0; i<r.length; i++) {
                            for (var j=0; j<u.roles_id.length; j++) {
                                if (r[i]._id.toString() === u.roles_id[j]._id.toString()) {
                                    r[i].allow = true;
                                    for(var k=0; k<u.roles_id[j].permissions_id.length; k++) {
                                        p.push({id: u.roles_id[j].permissions_id[k].toString(), inherit_allow: true});
                                    }
                                    break;
                                }
                            }
                        }
                        for (var i=0; i<u.perms.length; i++) {
                            var result = p.find(function(element, index, array) {
                                if (element.id === u.perms[i].id.toString()) {
                                    return element;
                                }
                            });
                            if (result) {
                                result.allow = u.perms[i].allow;
                                result.deny = u.perms[i].deny;
                                result.inherit_allow = u.perms[i].inherit_allow;
                                result.inherit_deny = u.perms[i].inherit_deny;
                            } else {
                                p.push(u.perms[i]);
                            }
                        }
                        u.roles = r;
                        Permission.find().exec(function(err, perms) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            var p_obj = perms.map(function (perm) {
                                return perm.toObject();
                            });
                            for (var i=0; i<p_obj.length; i++) {
                                var result = p.find(function(element, index, array) {
                                    if (element.id === p_obj[i]._id.toString()) {
                                        return element;
                                    }
                                });
                                if (result) {
                                    p_obj[i].allow = result.allow;
                                    p_obj[i].deny = result.deny;
                                    p_obj[i].inherit_allow = result.inherit_allow;
                                    p_obj[i].inherit_deny = result.inherit_deny;
                                } else {
                                    p_obj[i].inherit_deny = true;
                                }
                            }
                            u.perms = p_obj;
                            callback(null, u);
                        });
                    });
                });
            } else {
                Model.findOne().where('_id', id).exec(callback);
            }
        }
    };

    User.statics.findByUsername = function findByUsername(username, callback) {
        var Model = mongoose.model('User'),
            Perms = mongoose.model('Permission');
        if (!username || username.length <= 1) {
            callback(null, null);
        } else {
            Model.findOne({username: new RegExp(username, 'i')}).populate('roles_id').exec(function (err, user) {
            //Model.findOne().where('username', username).populate('roles_id').exec(function (err, user) {
                if (err) {
                    callback(err);
                    return;
                }
                callback(null, user);
            });
        }
    };

    User.methods.calculateAllPerms = function (user, callback) {
        var Roles = mongoose.model('Role'),
            Perms = mongoose.model('Permission');
		console.log('calculateAllPerms', user);
        if (!user) {
            callback(null, null);
        } else {
            Roles.find().where('_id').in(user.roles_id).exec(function (err, roles) {
                if (err) {
                    callback(err);
                    return;
                }
                var u = user.toObject(),
                    p = [];
                for (var i=0; i<roles.length; i++) {
                    for (var j=0; j<roles[i].permissions_id.length; j++)
                        p.push(roles[i].permissions_id[j].toString());
                }
                p = p.filter(function(item, pos) { return p.indexOf(item) == pos; });
                for (var i=0; i<u.perms.length; i++) {
                    var result;
                    p.find(function (e, index, array) {
                        if (u.perms[i].id == e) {
                            result = {index: index, id: e};
                            return e;
                        } else {
                            result = null;
                        }
                    });
                    if (!result && u.perms[i].allow) {
                        p.push(u.perms[i].id);
                    } else if (u.perms[i].deny && result) {
                        p.splice(result.index, 1);
                    }
                }
                Perms.find().where('_id').in(p).exec(function (err, perms) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    var all_perms = [];
                    for (var i=0; i<perms.length; i++) {
                        all_perms.push({id: perms[i]._id.toString(), key: perms[i].key});
                    }
                    user.all_perms = all_perms;
                    //console.log(user);
                    callback(null, user);
                });
            });
        }
    };
    User.set('toObject', {getters: true});
    return mongoose.model('User', User);
}
