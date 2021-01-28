//jshint esversion:6

require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");

const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const FacebookStrategy = require( 'passport-facebook' ).Strategy;

const findOrCreate = require("mongoose-findorcreate");

//const md5 = require("md5")
//const encrypt = require("mongoose-encryption");

const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useUnifiedTopology: true, useNewUrlParser: true});

mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String
});

// const secret = process.env.SECRET;
// userSchema.plugin(encrypt, {secret: secret, encryptedFields: ["password"] });

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user)
    });
});



passport.use(new GoogleStrategy({
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    passReqToCallback   : true,
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(request, accessToken, refreshToken, profile, done) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", (req, res) => {
    res.render("home");
});

// app.get("/auth/google", (req, res) => {
//     passport.authenticate("google", { scope: ["profile"] })
// });

app.get("/auth/google", 
    passport.authenticate("google", { scope: ["profile"] })
);

app.get( "/auth/google/secrets",
    passport.authenticate( 'google', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
}));


app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

// app.post("/register", (req, res) => {
//     const newUser = new User({
//         email: req.body.username,
//         password: req.body.password
//     });

//     newUser.save((error) => {
//         if (!error) {
//             res.render("secrets");
//         } else {
//             res.send(error);
//         }
//     })
// });

app.get("/secrets", (req, res) => {
    if (req.isAuthenticated()){
        res.render("secrets");
    } else {
        res.redirect("/login");
    }
});

app.post("/register", (req, res) => {

    User.register({ username: req.body.username }, req.body.password, (error, user) => {
        if (error) {
            console.log(error);
            res.redirect("/register")
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    })

});

// app.post("/login", (req, res) => {
//     const username = req.body.username;
//     const password = req.body.password;

//     User.findOne({
//         email: username
//     }, (error, foundUser) => {
//         if (!error) {
//             if (foundUser) {
//                 if (foundUser.password === password) {
//                     res.render("secrets")
//                 }
//             }
//         } else {
//             console.log(error)
//             res.send(error);
//         }
//     })
// })

app.post("/login", (req, res) => {
    let username = req.body.username;
    let password = req.body.password;

    const user = new User({
        username: username,
        password: password
    });

    req.login(user, (error) => {
        if (error){
            console.log(error);
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    });
});

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
});


app.listen(process.env.PORT || 3000, () => {
    console.log("Server running on PORT 3000");
});