var restify = require('restify'),
    http = require('http'),
    api_key = require('./api_key.json') || {application_id: '', application_key: ''},
    api_url = 'http://api.yummly.com/v1/api/recipes?_app_id=' + api_key.application_id + '&_app_key=' + api_key.application_key + '&q=',
    redis_client,// = new require('./redis')(),
    config = require('./apiServConfig.json'),
    server = restify.createServer(config),
    log = new require('./logger').Logger('api'),
    userRepo = new require('./userRepo')();


server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.put('/user/username/:name/email/:email',function(req,res,next) {
    var username = req.params.name;
	log.info('adding user: ' + username);
	userRepo.addUser(username,req.params.email,function(err,usr){
        var msg = {
            error: err || '',
            data: usr || {}
        };
        res.send(msg);
		log.info(JSON.stringify(msg));
        next();
	});
});

server.get('/user/username/:name',function(req,res,next) {
    var username = req.params.name;
	log.info('getting user: ' + username);
	userRepo.getUser(username,function(err,usr){
        if(usr) {
            log.info('found user');
        }
        else {
            log.info('no user found');
        }
        var msg = {
            error: err || '',
            data: usr || {}
        };
        res.send(msg);
		log.info(JSON.stringify(msg));
		next();
	});
});

server.get('/recipes/:term', function (req, res, next) {
  var recipes = {};
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");

  redis_client.get(req.params.term, function (err, replies) {
    console.log('replies '+!!replies);
    console.log(replies);
    if (replies) {
      log.info('data served from redis');
      res.send(JSON.parse(replies));
      return next();
    } else {
      recipes = replies;
      console.log('recipes ' + !!recipes);
      console.log(recipes);
        http.get(api_url + req.params.term, function(response) {
          var recipes_raw = '';

          response.on('data', function (chunk){
              recipes_raw += chunk;
          });

          response.on('end',function(){
              recipes = JSON.parse(recipes_raw);
              redis_client.set(req.params.term, JSON.stringify(recipes));
              log.info('data served from API');
              res.send(recipes);
              return next();
          });
        }).on('error', function(e) {
          res.send(e.message);
        });
    }
  });

});

server.listen(8081, function () {
  console.log('%s listening at %s', server.name, server.url);
});

process.on('exit', function() {
  redis_client.quit();
});
