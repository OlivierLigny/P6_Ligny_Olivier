// initialisation
const http = require('http');
const express = require('express');
var multer = require('multer')
var upload = multer({ dest: '/tmp/' })
const app = express();
module.exports = app;
const server = http.createServer(app);
const mongo = require('mongodb');
const mongoose = require('mongoose');
mongoose.connect("mongodb://sopek:bS3hZx8Ur@localhost:27017/sopek");
var db = mongoose.connection; 
const Sauce = require('./models/sauce');
const User = require('./models/user');
var cors = require('cors');
app.use(cors());
app.use(express.json());
var crypto = require('crypto');
var emailValidator = require("email-validator");
const jwt = require('jsonwebtoken');
const fs = require('fs');
var randomstring = require("randomstring");
const sharp = require('sharp');



// test
app.get('/test', (req, res, next) => {

	res.json({ message: 'Hello world.' }); 
	
});


// middleware de gestion des uploads
app.use(express.static('uploads'));


// signup
app.post('/api/auth/signup', (req, res) => {

	// extraction des paramètres
	const e = req.body.email;
	const p = req.body.password;
	console.log('user wants signup with '+e+'/'+p);
	
	// vérif
	if(p.length < 8) {
		return res.status(500).send('Password is too short');
	}
	if(!emailValidator.validate(e)) {
		return res.status(500).send('Email syntax is invalid');
	}
	
	// préparation
	const uid = crypto.createHash('sha256').update(e+p+new Date().getTime()).digest("hex");
	const encP = crypto.createHash('sha256').update(p).digest('hex');
	
	// insertion dans la base
	var newUser = new User({ userId: uid, email: e, password: encP });
	newUser.save(function (err) {
		if(err) {
			console.log("Creation error: "+err);
			res.status(500).send("Creation error: "+err);
		} else {
			// ok
			console.log("User creation ok");
			res.json({ message: 'User created successfully.' }); 
		}
	});
		
});


// login
app.post('/api/auth/login', (req, res) => {

	// extraction des paramètres
	const e = req.body.email;
	const p = req.body.password;
	console.log('user wants login with '+e+'/'+p);
	
	// recherche correspondance
	User.findOne({ email: e })
	.then(user => {              
		console.log('found user : '+user); 
		if(user != null) {
			// user ok
			console.log('res userId: '+user.userId); 
			res.json({ userId: user.userId, token: 
				jwt.sign(
					{ userId: user.userId },
					'dMpz5Jd9!6Erb_sBiE-95Ip',
					{ expiresIn: '24h' }
				)
			}); 
		} else {
			res.status(500).send('Login failed'); 
		}
	});
	
});


// authentication
function authenticateToken(req, res, next) {
	try {
		console.log('req.headers.authorization = '+req.headers.authorization);
		const token = req.headers.authorization.split(' ')[1];
		const decodedToken = jwt.verify(token, 'dMpz5Jd9!6Erb_sBiE-95Ip');
		const userId = decodedToken.userId;
		if (req.body.userId && req.body.userId !== userId) {
			throw 'Invalid user ID';
		} else {
			next();
		}
	} catch {
		res.status(401).json({
			error: new Error('Invalid request!')
		});
	}
}


// sauces : liste
app.get('/api/sauces', authenticateToken, (req, res) => {

	const docs = Sauce.find().
	then(sauces => {              
		console.log('res: '+sauces.length+' sauces found'); 
		res.json(sauces);
	});		
	
});


// sauces : modifier
function updateSauce(req, res, existingSauce) {

	const s = req.body.sauce;
	const img = req.file;
	console.log('user wants modify sauce with '+s+'/'+img);	
	
	var sauce = JSON.parse(s);
	sauce.imageUrl = '';
	if(typeof existingSauce != 'undefined' && typeof existingSauce._id != 'undefined') {
		// c'est une màj 
		console.log('existingSauce = '+existingSauce);
		console.log('typeof sauce.likes = '+(typeof sauce.likes));
		existingSauce.name = typeof sauce.name != 'undefined' ? sauce.name : existingSauce.name;
		existingSauce.manufacturer = typeof sauce.manufacturer != 'undefined' ? sauce.manufacturer : existingSauce.manufacturer;
		existingSauce.description = typeof sauce.description != 'undefined' ? sauce.description : existingSauce.description;
		existingSauce.mainPepper = typeof sauce.mainPepper != 'undefined' ? sauce.mainPepper : existingSauce.mainPepper;
		existingSauce.heat = typeof sauce.heat != 'undefined' ? sauce.heat : existingSauce.heat;
		existingSauce.likes = typeof sauce.likes != 'undefined' ? sauce.likes : existingSauce.likes;
		existingSauce.dislikes = typeof sauce.dislikes != 'undefined' ? sauce.dislikes : existingSauce.dislikes;
		existingSauce.usersLiked = typeof sauce.usersLiked != 'undefined' ? sauce.usersLiked : existingSauce.usersLiked;
		existingSauce.usersDisliked = typeof sauce.usersDisliked != 'undefined' ? sauce.usersDisliked : existingSauce.usersDisliked;
		console.log('updated existingSauce is now '+existingSauce);
		sauce = existingSauce;
	} else {
		// c'est une création
		sauce = new Sauce(sauce);
	}
	
	// traitement de l'image si présente
	var destName = typeof img != 'undefined' ? img.originalname.toLowerCase() : '';
	var destPath = '';
	if(destName.endsWith('.jpg') || destName.endsWith('.png') || destName.endsWith('.gif')) {
		destName = randomstring.generate(10) + destName.substring(destName.lastIndexOf('.'));
		/*fs.copyFile(img.path, 'uploads/'+destName, (err) => {
			if(err) throw err;
		});*/
		sharp(img.path).resize({ height: 500 }).toFile('uploads/'+destName)
		.then(function(newFileInfo) {
			console.log("Image resize success");
			sauce.imageUrl = 'http://127.0.0.1:3000/'+destName;
			goSauceSave(req, res, sauce);
		})
		.catch(function(err) {
			console.log("Image resize error occured : "+err);
			res.status(500).send("Image resize error occured : "+err); 
		});		
	} else {
		goSauceSave(req, res, sauce);
	}
	

		
}
function goSauceSave(req, res, sauce) {
	// enregistrement
	sauce.save(function (err) {
		if (err) {
			console.log("Modification error: "+err);
			res.status(500).send("Modification error: "+err); 
		} else {
			console.log("Modification ok");
			res.json({ message: 'Sauce modified.' }); 
		}

	});
}
app.post('/api/sauces', authenticateToken, upload.single('image'), updateSauce);
app.put('/api/sauces/*', authenticateToken, upload.single('image'), function(req, res) {
	var sid = req.url.substring(req.url.lastIndexOf('/')+1);
	Sauce.findOne({ _id: sid }).
	then(sauce => {              
		if(sauce) {
			// on met à jour la sauce existante
			console.log('found sauce to update : '+sauce); 
			if(typeof req.body.name != 'undefined') { 
				req.body.sauce = JSON.stringify(req.body);
			} 
			updateSauce(req, res, sauce);
		} else {
			res.status(500).send('Sauce not found'); 
		}
	});
});



// sauces : afficher sauce unique
app.get('/api/sauces/*', authenticateToken, (req, res) => {

	var sid = req.url.substring(req.url.lastIndexOf('/')+1);
	Sauce.findOne({ _id: sid }).
	then(sauce => {              
		console.log('res: '+sauce); 
		res.json(sauce);
	});		
	
});


// sauces : supprimer sauce
app.delete('/api/sauces/*', authenticateToken, (req, res) => {

	var sid = req.url.substring(req.url.lastIndexOf('/')+1);
	console.log('deleting: '+sid); 
	Sauce.findByIdAndDelete(sid, function(err) {
		res.json({ message: 'Sauce deleted.' }); 
	});		
	
});


// sauces : liker
app.post('/api/sauces/*/like', authenticateToken, (req, res) => {

	var sid = req.url.substring(req.url.lastIndexOf('sauces/')+7);
	sid = sid.substring(0, sid.indexOf('/'));
	console.log('liking sauce '+sid);
	Sauce.findOne({ _id: sid }).
	then(sauce => {              
		console.log('res: '+sauce); 
		const uid = req.body.userId;
		console.log('request: '+JSON.stringify(req.body));
		var like = req.body.like;
		console.log('uid='+uid+', like='+like);
		
		// on met à jour usersLiked & usersDisliked
		
		var new_usersLiked = [];
		var wasFound = false;
		for(var i=0; i<sauce.usersLiked; i++) {
			var v = sauce.usersLiked[i];
			if(v==uid) wasFound = true;
			if(v!=uid || (v==uid && like==1)) new_usersLiked[new_usersLiked.length] = v;
		}
		if(!wasFound && like==1) new_usersLiked[new_usersLiked.length] = uid;	
		
		var new_usersDisliked = [];
		wasFound = false;
		for(var i=0; i<sauce.usersDisliked; i++) {
			var v = sauce.usersDisliked[i];
			if(v==uid) wasFound = true;
			if(v!=uid || (v==uid && like==-1)) new_usersDisliked[new_usersDisliked.length] = v;
		}
		if(!wasFound && like==-1) new_usersDisliked[new_usersDisliked.length] = uid;
		
		sauce.usersLiked = new_usersLiked;
		sauce.usersDisliked = new_usersDisliked;
		
		// on met à jour les compteurs likes & dislikes
		
		sauce.likes = sauce.usersLiked.length;
		sauce.dislikes = sauce.usersDisliked.length;

		// enregistrement

		console.log('pushing new data : '+JSON.stringify(sauce));
		
		sauce.save(function (err) {
			if (err) return console.log("Like error: "+err);
			console.log("Like ok");
			res.json({ message: 'Sauce liked.' }); 
		});		
	});		
	
});



// lancement du serveur 

server.listen(3000);







