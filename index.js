require('./logger')('INFO');
const fs = require('fs'),
    dotenv = require('dotenv'),
    express = require('express'),
    cors = require('cors'),
    multer = require('multer'),
    Sequelize = require('sequelize'),
    ratelimit = require('express-rate-limit'),
    fileType = require('file-type'),
    upload = multer(),
    Op = Sequelize.Op,
    ms = require('ms'),
    bcrypt = require('bcrypt'),
    history = require('connect-history-api-fallback'),
    crypto = require('crypto'),
    map = {
        'image/x-icon': 'ico',
        'text/html': 'html',
        'text/javascript': 'js',
        'application/json': 'json',
        'text/css': 'css',
        'image/png': 'png',
        'image/jpg': 'jpeg',
        'audio/wav': 'wav',
        'audio/mpeg': 'mp3',
        'image/svg+xml': 'svg',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'image/gif': 'gif',
        'application/octet-stream': 'exe',
        'text/xml': 'xml',
        'video/mp4': 'mp4',
        'application/zip': 'zip',
        'text/plain': 'txt'
    },
    port = process.argv[2] || 3000;

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

dotenv.config();
const sequelize = new Sequelize({
    database: process.env.SERVERDB,
    username: process.env.SERVERUSERNAME,
    password: process.env.SERVERPASSWORD,
    host: process.env.SERVERIP,
    port: 5432,
    dialect: 'postgres',
    logging: false
});
class user extends Sequelize.Model { };
user.init({
    id: {
        type: Sequelize.STRING,
        primaryKey: true
    },
    username: Sequelize.STRING(60),
    displayName: Sequelize.STRING,
    email: Sequelize.STRING(60),
    staff: Sequelize.STRING,
    password: Sequelize.STRING(2000),
    apiToken: Sequelize.STRING,
    domain: Sequelize.STRING,
    subdomain: Sequelize.STRING,
    bannedAt: Sequelize.DATE
}, {
    sequelize
});
user.sync({
    force: false
}).then(() => {
    console.log('Users synced to database successfully!');
}).catch(err => {
    console.error('an error occurred while performing this operation', err);
});
class uploads extends Sequelize.Model { };
uploads.init({
    filename: {
        type: Sequelize.STRING,
        primaryKey: true
    },
    userid: Sequelize.STRING,
    size: Sequelize.INTEGER
}, {
    sequelize
});
uploads.sync({
    force: false
}).then(() => {
    console.log('Uploads synced to database successfully!');
}).catch(err => {
    console.error('an error occurred while performing this operation', err);
});
class actions extends Sequelize.Model { };
actions.init({
    type: Sequelize.INTEGER,
    by: Sequelize.STRING,
    to: Sequelize.STRING,
    addInfo: Sequelize.STRING(2000)
}, {
    sequelize
});
actions.sync({
    force: false
}).then(() => {
    console.log('Actions synced to database successfully!');
}).catch(err => {
    console.error('an error occurred while performing this operation', err);
});
class domains extends Sequelize.Model { };
domains.init({
    domain: {
        type: Sequelize.STRING,
        primaryKey: true
    },
    allowsSubdomains: Sequelize.BOOLEAN
}, {
    sequelize
});
domains.sync({
    force: false
}).then(() => {
    console.log('Domains synced to database successfully!');
}).catch(err => {
    console.error('an error occurred while performing this operation', err);
});
class instructions extends Sequelize.Model { };
instructions.init({
    name: {
        primaryKey: true,
        type: Sequelize.STRING
    },
    steps: Sequelize.ARRAY(Sequelize.STRING(2000)),
    filename: Sequelize.STRING(500),
    fileContent: Sequelize.STRING(5000),
    description: Sequelize.STRING(300),
    displayName: Sequelize.STRING
}, {
    sequelize
});
instructions.sync({
    force: false
}).then(() => {
    console.log('Instructions synced to database successfully!');
}).catch(err => {
    console.error('an error occurred while performing this operation', err);
});

function newString(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(crypto.randomInt(possible.length)));

    return text;
}
const options = {
    key: fs.readFileSync('./alekeagle.com.key'),
    cert: fs.readFileSync('./alekeagle.com.pem')
}
const corsOptions = {
    origin: "*",
    optionsSuccessStatus: 200
}
let https,
    app = require('express')();
if (process.env.DEBUG) {
    https = require('http');
} else {
    https = require('https');
}
app.use(cors(corsOptions));
app.engine('html', require('mustache-express')());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(history({
    rewrites: [
        {
            from: /^\/api\/.*$/,
            to: function (context) {
                return context.parsedUrl.path
            }
        }
    ],
    index: '/'
}));
let server;
if (process.env.DEBUG) {
    server = https.createServer(app);
} else {
    server = https.createServer(options, app);
}

function tokenGen(id) {
    let now = Date.now().toString();
    return `${Buffer.from(id).toString('base64').replace(/==/g, '')}.${Buffer.from(now.split('').slice(now.length - 3, now.length).join('')).toString('base64')}.${Buffer.from(newString(24)).toString('base64')}`;

}
function authenticate(req) {
    return new Promise((resolve, reject) => {
        if (!req.headers.authorization) {
            reject();
        } else {
            user.findOne({
                where: {
                    apiToken: req.headers.authorization.replace('Bearer ', '')
                }
            }).then(u => {
                if (!u) {
                    reject();
                } else {
                    if (u.bannedAt !== null) {
                        reject();
                    } else {
                        resolve(u);
                    }
                }
            }).catch(err => {
                reject(err);
            });
        }
    });
}
app.use('/api/', ratelimit({
    windowMs: ms('5mins'), max: 100, keyGenerator: (req, res) => {
        authenticate(req).then(u => {
            return u.id;
        }, err => {
            return req.headers['x-forwarded-for'] || req.ip;
        });
    }
}));
app.use((req, res, next) => {
    res.set({
        'Cache-Control': 'no-store'
    });
    console.log(`${req.headers['x-forwarded-for'] || req.ip}: ${req.method} => ${req.protocol}://${req.headers.host}${req.url}`);
    if (req.hostname.startsWith('docs.')) {
        res.set({
            'Cache-Control': `public, max-age=604800`
        });
        express.static('./docs/dist', { acceptRanges: false, lastModified: true })(req, res, next);
        return;
    }
    next();
}, express.static('uploads', { acceptRanges: false, lastModified: true }), (req, res, next) => {
    if (req.headers.host !== 'alekeagle.me' && !req.headers.host.includes('localhost') && !req.headers.host.includes('192.168.') && !req.headers.host.includes('127.0.0.1') && !req.headers.host.includes('::1') && !req.headers.host.includes('.local')) {
        res.redirect(301, 'https://alekeagle.me' + req.path);
        return;
    } else {
        next();
    }
});
app.all('/api/', (req, res) => {
    res.status(200).json({
        hello: 'world',
        version: '1.0.0'
    });
});
app.get('/api/users/', (req, res) => {
    authenticate(req).then(u => {
        let count = parseInt(req.query.count) || 50,
            offset = parseInt(req.query.offset) || 0;
        if (u.staff !== '') {
            user.findAndCountAll({
                offset,
                limit: count,
                order: [
                    ['createdAt', 'DESC']
                ]
            }).then(u => {
                if (u !== null) {
                    res.status(200).json({
                        count: u.count,
                        users: u.rows.map(user => {
                            return {
                                id: user.id,
                                username: user.username,
                                displayName: user.displayName,
                                domain: user.domain,
                                subdomain: user.subdomain,
                                staff: user.staff,
                                createdAt: user.createdAt,
                                updatedAt: user.updatedAt,
                                bannedAt: user.bannedAt
                            }
                        })
                    });
                } else {
                    res.status(200).json({ count: 0, users: [] });
                }
            }).catch(err => {
                res.status(500).json({ error: "Internal Server Error" });
                console.error(err);
            });
        } else {
            res.status(403).json({ error: "Missing Permissions" });
        }
    }).catch(err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.get('/api/brew-coffee/', (req, res) => {
    let ran = random(10000, 30000);
    setTimeout(() => {
        res.status(418).json({ error: 'I\'m a teapot.', body: 'The requested entity body is short and stout.', addInfo: 'Tip me over and pour me out.' });
    }, ran);
});
app.get('/api/user/:id/', (req, res) => {
    authenticate(req).then(u => {
        if (!req.params.id) res.status(400).json({ error: 'Bad Request', missing: ['id'] });
        else {
            if ((u.staff === '' && u.id === req.params.id) || u.staff !== '') {
                user.findOne({
                    where: {
                        id: req.params.id
                    }
                }).then(user => {
                    if (user === null) res.status(404).json({
                        error: 'Not Found'
                    });
                    else res.status(200).json({
                        id: user.id,
                        username: user.username,
                        displayName: user.displayName,
                        domain: user.domain,
                        subdomain: user.subdomain,
                        staff: user.staff,
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                        bannedAt: user.bannedAt
                    });
                }, err => {
                    res.status(500).json({ error: "Internal Server Error" });
                    console.error(err);
                });
            } else {
                res.status(403).json({ error: "Missing Permissions" });
            }
        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.post('/api/user/', upload.none(), (req, res) => {
    let {
        name,
        email,
        password
    } = req.body;
    let vars = { name, email, password };
    let undefinedVars = Object.keys(vars).map(e => vars[e] !== undefined ? null : e).filter(e => e !== null);
    if (undefinedVars.length < 0) {
        res.status(400).json({ error: 'Bad Request', missing: undefinedVars });
        return;
    } else {
        let username = name.toLowerCase();
        user.findOne({
            where: {
                [Op.or]: [
                    {
                        username
                    },
                    {
                        email
                    }
                ]
            }
        }).then(u => {
            let now = new Date(Date.now());
            if (u === null) {
                bcrypt.hash(password, Math.floor(Math.random() * 10)).then(hashedPass => {
                    user.create({
                        id: now.getTime(),
                        username,
                        domain: 'alekeagle.me',
                        subdomain: '',
                        displayName: name,
                        email,
                        createdAt: now,
                        updatedAt: now,
                        password: hashedPass,
                        staff: '',
                        apiToken: tokenGen(now.getTime().toString())
                    }).then(newUser => {
                        res.status(201).json(newUser);
                        actions.create({
                            type: 1,
                            by: newUser.id,
                            to: newUser.id
                        }).then(() => {
                            console.log('New user created');
                        });
                    }, err => {
                        res.status(500).json({ error: "Internal Server Error" });
                        console.error(err);
                    });
                }, err => {
                    res.status(500).json({ error: "Internal Server Error" });
                    console.error(err);
                });
            } else {
                let lolData = { name, email };
                let alreadyExists = Object.keys(lolData).map(e => u[e === 'name' ? 'username' : e] === lolData[e] ? e : null).filter(e => e !== null);
                res.status(401).json({ error: 'User already exists', with: alreadyExists });
                return;
            }
        }, err => {
            res.status(500).json({ error: "Internal Server Error" });
            console.error(err);
        });
    }
});
app.patch('/api/user/:id/ban/', upload.none(), (req, res) => {
    authenticate(req).then(u => {
        if (u.staff !== '') {
            let { banned } = req.body;
            if (!req.params.id) {
                res.status(400).json({ error: 'Bad Request', missing: ['id'] });
                return;
            }
            user.findOne({ where: { id: req.params.id } }).then(usr => {
                usr.update({ bannedAt: banned ? new Date(Date.now()).toISOString() : null }).then(ur => {
                    res.status(200).json({
                        id: ur.id,
                        username: ur.username,
                        displayName: ur.displayName,
                        domain: ur.domain,
                        subdomain: ur.subdomain,
                        staff: ur.staff,
                        createdAt: ur.createdAt,
                        updatedAt: ur.updatedAt,
                        bannedAt: ur.bannedAt
                    });
                }, err => {
                    res.status(500).json({ error: 'Internal server error.' });
                    console.error('bruh ', err);
                });
            });
        } else res.status(403).json({ error: "Missing Permissions" });
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.delete('/api/user/', upload.none(), (req, res) => {
    authenticate(req).then(u => {
        let {
            password
        } = req.body;
        if (password) {
            bcrypt.compare(password, u.password).then(match => {
                if (match) {
                    uploads.findAll({
                        where: {
                            userid: u.id
                        }
                    }).then(files => {
                        let errored = false;
                        for (let i = 0; i < files.length; i++) {
                            if (errored) break;
                            fs.unlink(`uploads/${files[i].filename}`, err => {
                                if (err) {
                                    res.status(500).json({ error: "Internal Server Error" });
                                    errored = true;
                                } else {
                                    files[i].destroy().then(() => { }).catch(() => {
                                        res.status(500).json({ error: "Internal Server Error" });
                                        errored = true;
                                    });
                                }
                            });
                        }
                        if (!errored) {
                            u.destroy().then(() => {
                                actions.create({
                                    type: 4,
                                    by: u.id,
                                    to: u.id
                                }).then(() => {
                                    console.log('User Deleted');
                                });
                                res.status(200).json({ success: true });
                            }, err => {
                                res.status(500).json({ error: 'Internal server error.' });
                                console.error(err);
                            });
                        }
                    });
                } else {
                    res.status(401).json({ error: 'Invalid password.' });
                    return;
                }
            }), err => {
                res.status(500).json({ error: 'Internal server error.' });
                console.error(err);
            };
        } else {
            res.status(400).json({ error: 'Bad Request', missing: ['password'] });
        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.delete('/api/user/:id/', upload.none(), (req, res) => {
    authenticate(req).then(u => {
        let {
            id
        } = req.params;
        if (id) {
            if (u.staff !== '') {
                user.findOne({
                    where: {
                        id
                    }
                }).then(us => {
                    if (us !== null) {
                        uploads.findAll({
                            where: {
                                userid: us.id
                            }
                        }).then(files => {
                            let errored = false;
                            for (let i = 0; i < files.length; i++) {
                                if (errored) break;
                                fs.unlink(`uploads/${files[i].filename}`, err => {
                                    if (err) {
                                        res.status(500).json({ error: "Internal Server Error" });
                                        errored = true;
                                    } else {
                                        files[i].destroy().then(() => { }).catch(() => {
                                            res.status(500).json({ error: "Internal Server Error" });
                                            errored = true;
                                        });
                                    }
                                });
                            }
                            if (!errored) {
                                us.destroy().then(() => {
                                    actions.create({
                                        type: 4,
                                        by: u.id,
                                        to: us.id
                                    }).then(() => {
                                        console.log('User Deleted');
                                    });
                                    res.status(200).json({ success: true });
                                }, err => {
                                    res.status(500).json({ error: 'Internal server error.' });
                                    console.error(err);
                                });
                            }
                        });
                    } else {
                        res.status(404).json({ error: 'No account.' });
                    }
                });
            } else {
                res.status(403).json({ error: "Missing Permissions" });
            }
        } else {
            res.status(400).json({ error: 'Bad Request', missing: ['id'] });
        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.post('/api/login/', upload.none(), (req, res) => {
    let {
        name,
        password
    } = req.body;
    let vars = { name, password };
    let undefinedVars = Object.keys(vars).map(e => vars[e] !== undefined ? null : e).filter(e => e !== null);
    if (undefinedVars.length < 0) {
        res.status(400).json({ error: 'Bad Request', missing: undefinedVars });
        return;
    } else {
        name = name.toLowerCase();
        user.findOne({
            where: {
                [Op.or]: [{
                    username: name
                },
                {
                    email: name
                }
                ]
            }
        }).then(u => {
            if (u !== null) {
                if (u.bannedAt === null) {
                    bcrypt.compare(password, u.password).then(match => {
                        if (match) {
                            actions.create({
                                type: 5,
                                by: u.id,
                                to: u.id
                            }).then(() => {
                                console.log('User login');
                            });
                            let noPass = { ...u.toJSON(), password: null };
                            res.status(200).json(noPass);
                        } else {
                            res.status(401).json({ error: 'Invalid password.' });
                        }
                    }, err => {
                        res.status(500).json({ error: 'Internal server error.' });
                        console.error(err);
                    });
                } else {
                    res.status(401).json({ error: 'Banned.' });
                    return;
                }
            } else {
                res.status(404).json({ error: 'No account.' });
                return;
            }
        }, err => {
            res.status(500).json({ error: 'Internal server error.' });
            console.error(err);
        });
    }
});
app.get('/api/user/', (req, res) => {
    authenticate(req).then(u => {
        let us = { ...u.toJSON() };
        delete us.password;
        res.status(200).json(us);
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.patch('/api/user/token/', upload.none(), (req, res) => {
    authenticate(req).then(u => {
        let {
            password
        } = req.body;
        if (password) {
            bcrypt.compare(password, u.password).then(match => {
                if (match) {
                    u.update({
                        apiToken: tokenGen(u.id)
                    }).then(us => {
                        res.status(200).json({
                            token: us.apiToken
                        });
                        actions.crxeate({
                            type: 3,
                            by: us.id,
                            to: us.id
                        }).then(() => {
                            console.log('API Token refreshed');
                        });
                    }, err => {
                        res.status(500).json({ error: "Internal Server Error" });
                        console.error(err);
                    });
                } else {
                    res.status(401).json({ error: 'Invalid password.' });
                }
            }, err => {
                res.status(500).json({ error: "Internal Server Error" });
                console.error(err);
            });
        } else {

        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.patch('/api/user/:id/token', (req, res) => {
    authenticate(req).then(u => {
        if (req.params.id) {
            if (u.staff === '') {
                res.status(403).json({ error: "Missing Permissions" });
            } else {
                user.findOne({
                    where: {
                        id: req.params.id
                    }
                }).then(us => {
                    if (us) {
                        us.update({ apiToken: tokenGen(us.id) }).then(updatedUser => {
                            res.status(200).json({ token: updatedUser.apiToken });
                        }, err => {
                            res.status(500).json({ error: "Internal Server Error" });
                            console.error(err);
                        })
                    }
                })
            }
        } else {
            res.status(400).json({ error: "Bad Request", missing: ['id'] });
        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.get('/api/domains/', (req, res) => {
    authenticate(req).then(() => {
        domains.findAll().then(d => {
            res.status(200).json(d);
        });
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.patch('/api/user/:id/domain/', upload.none(), (req, res) => {
    authenticate(req).then(u => {
        let {
            domain,
            subdomain
        } = req.body;
        let id = req.params.id;
        subdomain = subdomain !== undefined ? subdomain.replace(/ /g, '-') : '';
        if (domain === 'alekeagle.com' && u.staff === '') {
            res.status(403).json({ error: "Missing Permissions" });
            return;
        }
        if (!domain) {
            res.status(400).json({ error: 'Bad Request', missing: ['domain'] })
        }
        domains.findOne({
            where: {
                domain
            }
        }).then(d => {
            if (d !== null) {
                if (d.allowsSubdomains ? true : (subdomain === undefined || subdomain === '')) {
                    if (u.staff !== '') {
                        user.findOne({
                            where: {
                                id
                            }
                        }).then(us => {
                            if (us !== null) {
                                us.update({ domain, subdomain }).then(() => {
                                    res.status(200).json({ domain, subdomain });
                                }, err => {
                                    res.status(500).json({ error: "Internal Server Error" });
                                    console.error(err);
                                });
                            }
                        })
                    } else {
                        res.status(403).json({ error: "Missing Permissions" });
                    }
                } else {
                    res.status(400).json({ error: `Domain "${domain}" doesn't support subdomains.` });
                }
            } else {
                res.status(404).json({
                    error: 'Not Found'
                });
            }
        }).catch(err => {
            res.status(500).json({ error: "Internal Server Error" });
            console.error(err);
        });
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.patch('/api/user/domain/', upload.none(), (req, res) => {
    authenticate(req).then(u => {
        let {
            domain,
            subdomain
        } = req.body;
        subdomain = subdomain !== undefined ? subdomain.replace(/ /g, '-') : '';
        if (domain === 'alekeagle.com' && u.staff === '') {
            res.status(403).json({ error: "Missing Permissions" });
            return;
        }
        if (!domain) {
            res.status(400).json({ error: 'Bad Request', missing: ['domain'] })
        }
        domains.findOne({
            where: {
                domain
            }
        }).then(d => {
            if (d !== null) {
                if (d.allowsSubdomains ? true : (subdomain === undefined || subdomain === '')) {
                    u.update({
                        domain,
                        subdomain
                    }).then(us => {
                        res.status(200).json({
                            domain,
                            subdomain
                        });
                    });
                } else {
                    res.status(400).json({ error: `Domain "${domain}" doesn't support subdomains.` });
                }
            } else {
                res.status(404).json({
                    error: 'Not Found'
                });
            }
        }).catch(err => {
            res.status(500).json({ error: "Internal Server Error" });
            console.error(err);
        });
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.patch('/api/user/:id/', upload.none(), (req, res) => {
    authenticate(req).then(u => {
        let {
            email,
            name,
            newPassword
        } = req.body;
        let vars = { name, email, newPassword, id: req.params.id };
        let undefinedVars = Object.keys(vars).map(e => vars[e] !== undefined ? null : e).filter(e => e !== null);
        if (undefinedVars.length < 0 || !req.params.id) {
            res.status(400).json({ error: 'Bad Request', missing: undefinedVars });
            return;
        }
        if (u.staff === '') {
            res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
            return;
        } else {
            let username = name.toLowerCase();
            user.findOne({
                where: {
                    id: req.params.id
                }
            }).then(us => {
                if (us === null) {
                    res.status(404).json({
                        error: 'Not Found'
                    });
                    return;
                } else {
                    let now = new Date(Date.now());
                    if (newPassword) {
                        bcrypt.hash(newPassword, Math.floor(Math.random() * 10)).then(hashedPass => {
                            us.update({
                                email: email || us.email,
                                displayName: name || us.displayName,
                                username: username || us.username,
                                updatedAt: now,
                                password: hashedPass
                            }).then(updatedUser => {
                                actions.create({
                                    type: 2,
                                    by: u.id,
                                    to: req.params.id
                                }).then(() => {
                                    console.log('User updated');
                                });
                                let noPass = { ...updatedUser.toJSON(), password: null };
                                res.status(200).json(noPass);
                            }, err => {
                                res.status(500).json({ error: "Internal Server Error" });
                                console.error(err);
                            });
                        }, err => {
                            res.status(500).json({ error: "Internal Server Error" });
                            console.error(err);
                        });
                    } else {
                        us.update({
                            email: email || us.email,
                            displayName: name || us.displayName,
                            username: username || us.username,
                            updatedAt: now
                        }).then(updatedUser => {
                            actions.create({
                                type: 2,
                                by: u.id,
                                to: req.params.id
                            }).then(() => {
                                console.log('User updated');
                            });
                            let noPass = { ...updatedUser.toJSON(), password: null };
                            res.status(200).json(noPass);
                        }, err => {
                            res.status(500).json({ error: "Internal Server Error" });
                            console.error(err);
                        });
                    }
                }
            }, err => {
                res.status(500).json({ error: "Internal Server Error" });
                console.error(err);
            });
        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.patch('/api/user/', upload.none(), (req, res) => {
    authenticate(req).then(u => {
        let {
            email,
            name,
            password,
            newPassword
        } = req.body;
        let vars = { name, email, password };
        let undefinedVars = Object.keys(vars).map(e => vars[e] !== undefined ? null : e).filter(e => e !== null);
        if (undefinedVars.length < 0) {
            res.status(400).json({ error: 'Bad Request', missing: undefinedVars });
            return;
        } else {
            let username = name ? name.toLowerCase() : null;
            if (!password) {
                res.status(400).json({ error: 'Bad Request', missing: ['password'] });
                return;
            }
            let now = new Date(Date.now());
            bcrypt.compare(password, u.password).then(match => {
                if (match) {
                    bcrypt.hash(newPassword ? newPassword : password, Math.floor(Math.random() * 10)).then(hashedPass => {
                        u.update({
                            email: email || u.email,
                            displayName: name || u.displayName,
                            username: username || u.username,
                            updatedAt: now,
                            password: hashedPass
                        }).then(updatedUser => {
                            actions.create({
                                type: 2,
                                by: updatedUser.id,
                                to: updatedUser.id
                            }).then(() => {
                                console.log('User updated');
                            });
                            let noPass = { ...updatedUser.toJSON(), password: null };
                            res.status(200).json(noPass);
                        }, err => {
                            res.status(500).json({ error: "Internal Server Error" });
                            console.error(err);
                        });
                    }, err => {
                        res.status(500).json({ error: "Internal Server Error" });
                        console.error(err);
                    });
                } else {
                    res.status(401).json({ error: 'Invalid password.' });
                }
            }, err => {
                res.status(500).json({ error: "Internal Server Error" });
                console.error(err);
            });
        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.get('/api/files/', (req, res) => {
    authenticate(req).then(u => {
        let count = parseInt(req.query.count) || 50,
            offset = parseInt(req.query.offset) || 0;
        uploads.findAndCountAll({
            offset,
            limit: count,
            order: [
                ['updatedAt', 'DESC']
            ],
            where: {
                userid: u.id
            }
        }).then(files => {
            if (files !== null || files.length !== 0) {

                res.status(200).json({
                    count: files.count,
                    files: files.rows
                });
            } else {
                res.status(200).json({ count: 0, files: [] });
            }
        });
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.get('/api/files/all/', (req, res) => {
    authenticate(req).then(u => {
        let count = parseInt(req.query.count) || 50,
            offset = parseInt(req.query.offset) || 0;

        if (u.staff !== '') {
            uploads.findAndCountAll({
                offset,
                limit: count,
                order: [
                    ['updatedAt', 'DESC']
                ]
            }).then(files => {
                if (files.length !== 0 && files !== null) {
                    res.status(200).json({
                        count: files.count,
                        files: files.rows
                    });
                } else {
                    res.status(200).json({ count: 0, files: [] });
                }
            })
        } else {
            res.status(403).json({ error: "Missing Permissions" });
        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
})
app.get('/api/files/:id/', (req, res) => {
    authenticate(req).then(u => {
        let {
            id
        } = req.params,
            count = parseInt(req.query.count) || 50,
            offset = parseInt(req.query.offset) || 0;
        if (u.staff !== '') {
            uploads.findAndCountAll({
                offset,
                limit: count,
                order: [
                    ['updatedAt', 'DESC']
                ],
                where: {
                    userid: id
                }
            }).then(files => {
                if (files.length !== 0 && files !== null) {

                    res.status(200).json({
                        count: files.count,
                        files: files.rows
                    });
                } else {
                    res.status(200).json({ count: 0, files: [] });
                }
            }).catch(err => {
                res.status(500).json({ error: "Internal Server Error" });
                console.error(err);
            });
        } else {
            res.status(403).json({ error: "Missing Permissions" });
        }

    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.get('/api/file/', (req, res) => {
    authenticate(req).then(u => {
        res.status(400).json({ error: 'Bad Request', missing: ['file'] });
    }).catch(() => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.get('/api/file/:file/', (req, res) => {
    authenticate(req).then(u => {
        let {
            file
        } = req.params;
        if (!file) {
            res.status(400).json({ error: 'Bad Request', missing: ['file'] });
            return;
        }
        uploads.findOne({
            where: {
                [Op.or]: [{
                    filename: file
                }]
            }
        }).then(file => {
            if (file !== null) {
                if (file.userid === u.id) {
                    res.status(200).json(file);
                } else {
                    if (u.staff !== '') {
                        res.status(200).json(file);
                    } else {
                        res.status(403).json({ error: "Missing Permissions" });
                        return;
                    }
                }
            } else {
                res.status(404).json({
                    error: 'Not Found'
                });
                return;
            }
        });
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.get('/api/setup/', (req, res) => {
    authenticate(req).then(u => {
        instructions.findAll().then(ins => {
            res.status(200).json(ins);
        })
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.get('/api/setup/:name/', (req, res) => {
    authenticate(req).then(u => {
        instructions.findOne({
            where: {
                name: req.params.name
            }
        }).then(ins => {
            if (ins !== null) {
                res.status(200).json(ins.toJSON());
            } else {
                res.status(404).json({
                    error: 'Not Found'
                });
            }
        })
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.get('/api/setup/save/:name/', (req, res) => {
    authenticate(req).then(u => {
        instructions.findOne({
            where: {
                name: req.params.name
            }
        }).then(ins => {
            if (ins !== null) {
                res.set('Content-Disposition', `attachment; filename="${ins.filename}"`);
                res.status(200).send(ins.fileContent.replace(/(\{\{apiToken\}\})/g, `${u.apiToken}`));
            } else {
                res.status(404).json({
                    error: 'Not Found'
                });
            }
        });
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.delete('/api/file/', (req, res) => {
    authenticate(req).then(u => {
        res.status(400).json({ error: 'Bad Request', missing: ['file'] });
    }).catch(() => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
})
app.delete('/api/file/:file/', (req, res) => {
    authenticate(req).then(u => {
        let {
            file
        } = req.params;
        if (!file) {
            res.status(400).json({ error: 'Bad Request', missing: ['file'] });
            return;
        }
        uploads.findOne({
            where: {
                [Op.or]: [{
                    filename: file
                }]
            }
        }).then(file => {
            if (file !== null) {
                if (file.userid === u.id) {
                    fs.unlink(`uploads/${file.filename}`, err => {
                        if (err) {
                            res.status(500).json({ error: "Internal Server Error" });
                            return;
                        } else {
                            file.destroy().then(() => {
                                res.status(200).json({ success: true });
                                return;
                            }).catch(() => {
                                res.status(500).json({ error: "Internal Server Error" });
                                return;
                            });
                        }
                    });
                } else if (u.staff !== '') {
                    fs.unlink(`uploads/${file.filename}`, err => {
                        if (err) {
                            res.status(500).json({ error: "Internal Server Error" });
                            return;
                        } else {
                            file.destroy().then(() => {
                                res.status(200).json({ success: true });
                                return;
                            }).catch(() => {
                                res.status(500).json({ error: "Internal Server Error" });
                                return;
                            });
                        }
                    });
                } else {
                    res.status(403).json({ error: "Missing Permissions" });
                    return;
                }
            } else {
                res.status(404).json({
                    error: 'Not Found'
                });
                return;
            }
        }).catch(err => {
            res.status(500).json({ error: "Internal Server Error" });
            console.error(err);
        });
    }).catch(() => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.post('/upload/', upload.single('file'), (req, res) => {
    authenticate(req).then(u => {
        res.set('X-Deprecated', 'https://alekeagle.me/api/upload/');
        res.set('X-Deprecated-Documentation', 'https://docs.alekeagle.me/api/user.html#upload');
        if (!req.file) {
            if (!req.body.file) {
                res.status(400).json({ error: 'Bad Request', missing: ['file'] });
                return;
            }
            let filename = newString(10),
                writeStream = fs.createWriteStream(`${__dirname}/uploads/${filename}.txt`);
            writeStream.write(new Buffer.from(req.body.file), error => {
                if (error) {
                    res.status(500).json({ error: "Internal Server Error" });
                    return;
                } else {
                    uploads.create({
                        filename: `${filename}.txt`,
                        userid: u.id,
                        size: req.body.file.length
                    }).then(() => {
                        res.status(201).end(`https://${u.subdomain ? `${u.subdomain}.` : ''}${u.domain}/${filename}.txt`);
                    });
                }
                writeStream.end();
                writeStream.destroy();
            });
        } else {
            fileType.fromBuffer(req.file.buffer.slice(0, fileType.minimumBytes)).then(ft => {
                let filename = newString(10),
                    writeStream = fs.createWriteStream(`${__dirname}/uploads/${filename}.${ft ? ft.ext : (map[req.file.mimetype] !== undefined ? map[req.file.mimetype] : 'txt')}`);
                writeStream.write(req.file.buffer, error => {
                    if (error) {
                        res.status(500).json({ error: "Internal Server Error" });
                        return;
                    } else {
                        uploads.create({
                            filename: `${filename}.${ft ? ft.ext : (map[req.file.mimetype] !== undefined ? map[req.file.mimetype] : 'txt')}`,
                            userid: u.id,
                            size: req.file.size
                        }).then(() => {
                            res.status(201).end(`https://${u.subdomain ? `${u.subdomain}.` : ''}${u.domain}/${filename}.${ft ? ft.ext : (map[req.file.mimetype] !== undefined ? map[req.file.mimetype] : 'txt')}`);
                        });
                    }
                    writeStream.end();
                    writeStream.destroy();
                });
            });
        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});
app.post('/api/upload/', upload.single('file'), (req, res) => {
    authenticate(req).then(u => {
        if (!req.file) {
            if (!req.body.file) {
                res.status(400).json({ error: 'Bad Request', missing: ['file'] });
                return;
            }
            let filename = newString(10),
                writeStream = fs.createWriteStream(`${__dirname}/uploads/${filename}.txt`);
            writeStream.write(new Buffer.from(req.body.file), error => {
                if (error) {
                    res.status(500).json({ error: "Internal Server Error" });
                    return;
                } else {
                    uploads.create({
                        filename: `${filename}.txt`,
                        userid: u.id,
                        size: req.body.file.length
                    }).then(() => {
                        res.status(201).end(`https://${u.subdomain ? `${u.subdomain}.` : ''}${u.domain}/${filename}.txt`);
                    });
                }
                writeStream.end();
                writeStream.destroy();
            });
        } else {
            fileType.fromBuffer(req.file.buffer.slice(0, fileType.minimumBytes)).then(ft => {
                let filename = newString(10),
                    writeStream = fs.createWriteStream(`${__dirname}/uploads/${filename}.${ft ? ft.ext : (map[req.file.mimetype] !== undefined ? map[req.file.mimetype] : 'txt')}`);
                writeStream.write(req.file.buffer, error => {
                    if (error) {
                        res.status(500).json({ error: "Internal Server Error" });
                        return;
                    } else {
                        uploads.create({
                            filename: `${filename}.${ft ? ft.ext : (map[req.file.mimetype] !== undefined ? map[req.file.mimetype] : 'txt')}`,
                            userid: u.id,
                            size: req.file.size
                        }).then(() => {
                            res.status(201).end(`https://${u.subdomain ? `${u.subdomain}.` : ''}${u.domain}/${filename}.${ft ? ft.ext : (map[req.file.mimetype] !== undefined ? map[req.file.mimetype] : 'txt')}`);
                        });
                    }
                    writeStream.end();
                    writeStream.destroy();
                });
            });
        }
    }, err => {
        if (err) res.status(500).json({ error: "Internal Server Error" });
        else res.status(401).json(req.headers.authorization ? { error: 'Invalid Token' } : { error: 'No Token Provided' });
    });
});

app.use((req, res, next) => {
    if (req.path.includes('manifest.json') || req.path.includes('service-worker.js')) {
        next();
        return;
    }
    res.set({
        'Cache-Control': `public, max-age=604800`
    });
    next();
}, express.static('./dist', { acceptRanges: false, lastModified: true }));

server.listen(port);
console.log(`Server listening on port ${port}`);
