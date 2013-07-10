var http = require('http')
    , express = require('express')
    , ecstatic = require('ecstatic')
    , app = express()
    , path = require('path')
    , ecs = ecstatic({
                root: __dirname + '/public'
                , handleError: false
                , autoIndex: true
                , showDir: true
                , cache: 0
            })
    , publicdir = path.join(__dirname, 'public')
    , appcache = require('appcache-node')

appcache({files: ['/styles.css', '/bundle.js', '/jquery.js', '/index.html', '/'], path: '/lute.appcache'}, app)
app.use(ecs)
app.use(express.bodyParser())
app.use(express.methodOverride())
app.post('/calculate', function(req, res){
    console.log(req.body.description_title);
    console.log(req.body.description_author);
    console.log(req.body.description_tags);
    console.log(req.body.description_textarea);
    console.log(req.files)
    res.send("Done!")
})
http.createServer(app).listen(8080)

console.log('Listening on :8080')
